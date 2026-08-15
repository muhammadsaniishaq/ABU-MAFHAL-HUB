import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    View,
    Text,
    SectionList,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    TextInput,
    Share,
    RefreshControl,
    StyleSheet,
    Platform,
    Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [sortAsc, setSortAsc] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'transaction' | 'security' | 'promo'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modal State
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Undo State
    const [deletedItem, setDeletedItem] = useState<{ item: any; index: number } | null>(null);
    const [showUndo, setShowUndo] = useState(false);
    const undoTimeout = useRef<any>(null);
    const router = useRouter();

    useEffect(() => {
        fetchNotifications();
        const subscribe = subscribeToNotifications();
        return () => {
            subscribe();
        };
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) setNotifications(data);
        } catch (e) {
            console.error('Error fetching notifications:', e);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        await fetchNotifications();
        setRefreshing(false);
    };

    const subscribeToNotifications = () => {
        const channel = supabase
            .channel('notifications-modern')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => setNotifications((prev) => [payload.new, ...prev])
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const markAsRead = async (item: any, status = true) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        const updated = notifications.map((n) => (n.id === item.id ? { ...n, is_read: status } : n));
        setNotifications(updated);
        await supabase.from('notifications').update({ is_read: status }).eq('id', item.id);
    };

    const handlePressNotification = (item: any) => {
        if (!item.is_read) {
            markAsRead(item, true);
        }
        setSelectedItem(item);
        setShowDetailModal(true);
    };

    const markAllAsRead = async () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const updated = notifications.map((n) => ({ ...n, is_read: true }));
        setNotifications(updated);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    };

    const confirmDelete = (id: string, item: any) => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const index = notifications.findIndex((n) => n.id === id);

        setDeletedItem({ item, index });
        const updated = notifications.filter((n) => n.id !== id);
        setNotifications(updated);
        setShowUndo(true);

        if (showDetailModal && selectedItem?.id === id) {
            setShowDetailModal(false);
            setSelectedItem(null);
        }

        if (undoTimeout.current) clearTimeout(undoTimeout.current);

        undoTimeout.current = setTimeout(async () => {
            setShowUndo(false);
            setDeletedItem(null);
            await supabase.from('notifications').delete().eq('id', id);
        }, 3500);
    };

    const handleUndo = () => {
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        if (deletedItem) {
            setNotifications((prev) => {
                const newArr = [...prev];
                newArr.splice(deletedItem.index, 0, deletedItem.item);
                return newArr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            });
            setShowUndo(false);
            setDeletedItem(null);
        }
    };

    const clearAll = () => {
        const executeClear = async () => {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            setNotifications([]);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await supabase.from('notifications').delete().eq('user_id', user.id);
        };

        if (Platform.OS === 'web') {
            if (confirm('Delete All: Are you sure you want to clear all notifications?')) {
                executeClear();
            }
        } else {
            Alert.alert('Clear All Notifications', 'Are you sure you want to delete all notifications?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: executeClear,
                },
            ]);
        }
    };

    const shareNotification = async (item: any) => {
        try {
            await Share.share({
                message: `*${item.title}*\n\n${item.body}\n\n- Sent via ABU MAFHAL SUB`,
            });
        } catch (error: any) {
            Alert.alert('Share Failed', error.message);
        }
    };

    const counts = useMemo(
        () => ({
            all: notifications.length,
            unread: notifications.filter((n) => !n.is_read).length,
            transaction: notifications.filter((n) => n.type === 'transaction' || n.type === 'funding').length,
            security: notifications.filter((n) => n.type === 'security' || n.data?.priority === 'high').length,
            promo: notifications.filter((n) => n.type === 'promo' || n.type === 'announcement').length,
        }),
        [notifications]
    );

    const getFilteredAndGrouped = () => {
        let filtered = notifications;
        if (filter === 'unread') filtered = filtered.filter((n) => !n.is_read);
        if (filter === 'transaction') filtered = filtered.filter((n) => n.type === 'transaction' || n.type === 'funding');
        if (filter === 'security') filtered = filtered.filter((n) => n.type === 'security' || n.data?.priority === 'high');
        if (filter === 'promo') filtered = filtered.filter((n) => n.type === 'promo' || n.type === 'announcement');

        if (searchQuery) {
            const lowQ = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (n) => n.title?.toLowerCase().includes(lowQ) || n.body?.toLowerCase().includes(lowQ)
            );
        }

        const sections: { title: string; data: any[] }[] = [];
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const seenKeys = new Set<string>();
        const groups: { [key: string]: any[] } = {};

        filtered.forEach((item) => {
            const d = new Date(item.created_at).toDateString();
            let k = d === today ? 'Today' : d === yesterday ? 'Yesterday' : d;
            if (!groups[k]) groups[k] = [];
            groups[k].push(item);
        });

        filtered.forEach((item) => {
            const d = new Date(item.created_at).toDateString();
            let k = d === today ? 'Today' : d === yesterday ? 'Yesterday' : d;
            if (!seenKeys.has(k)) {
                seenKeys.add(k);
                sections.push({ title: k, data: groups[k] });
            }
        });
        return sections;
    };

    const getCategoryIcon = (item: any) => {
        if (item.type === 'security' || item.data?.priority === 'high') {
            return { icon: 'shield-checkmark', color: '#EF4444', bg: '#FEE2E2' };
        }
        if (item.type === 'transaction' || item.type === 'funding') {
            return { icon: 'card', color: '#10B981', bg: '#D1FAE5' };
        }
        if (item.type === 'promo' || item.type === 'announcement') {
            return { icon: 'megaphone', color: '#8B5CF6', bg: '#EDE9FE' };
        }
        return { icon: 'notifications', color: '#F59E0B', bg: '#FEF3C7' };
    };

    const renderItem = ({ item }: { item: any }) => {
        const catInfo = getCategoryIcon(item);
        const hasAction = !!item.data?.route;

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePressNotification(item)}
                onLongPress={() => {
                    if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    }
                    if (Platform.OS === 'web') {
                        if (confirm(`Notification: ${item.title}\n\nDo you want to delete this notification?`)) {
                            confirmDelete(item.id, item);
                        }
                    } else {
                        Alert.alert('Notification Options', item.title, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Copy Text',
                                onPress: async () => {
                                    await Clipboard.setStringAsync(item.body);
                                    Alert.alert('Copied!');
                                },
                            },
                            {
                                text: item.is_read ? 'Mark Unread' : 'Mark Read',
                                onPress: () => markAsRead(item, !item.is_read),
                            },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => confirmDelete(item.id, item),
                            },
                        ]);
                    }
                }}
                style={[
                    s.notificationCard,
                    !item.is_read ? s.notificationCardUnread : s.notificationCardRead,
                ]}
            >
                {!item.is_read && <View style={s.unreadBadgeDot} />}

                <View style={s.cardContentRow}>
                    <View style={[s.iconBox, { backgroundColor: catInfo.bg }]}>
                        <Ionicons name={catInfo.icon as any} size={18} color={catInfo.color} />
                    </View>

                    <View style={s.cardBodyCol}>
                        <View style={s.titleTimeRow}>
                            <Text
                                style={[
                                    s.cardTitle,
                                    !item.is_read ? s.cardTitleUnread : s.cardTitleRead,
                                ]}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>

                            <Text style={s.cardTimeText}>
                                {new Date(item.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </View>

                        {item.type && item.type !== 'general' && (
                            <View style={s.typeTag}>
                                <Text style={s.typeTagText}>{item.type}</Text>
                            </View>
                        )}

                        <Text style={s.cardBodyText} numberOfLines={2}>
                            {item.body}
                        </Text>

                        <View style={s.cardFooterRow}>
                            {hasAction && (
                                <TouchableOpacity
                                    onPress={() => {
                                        markAsRead(item, true);
                                        router.push(item.data.route);
                                    }}
                                    style={s.actionViewBtn}
                                    activeOpacity={0.7}
                                >
                                    <Text style={s.actionViewBtnText}>View Details</Text>
                                    <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => shareNotification(item)}
                                style={s.actionIconButton}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="share-outline" size={14} color="#64748B" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => confirmDelete(item.id, item)}
                                style={s.actionIconButton}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Top Royal Navy Header Bar */}
            <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={s.headerGradient}>
                <SafeAreaView edges={['top']} style={s.headerSafeArea}>
                    <View style={s.headerNavRow}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backButton} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={s.headerCenterCol}>
                            <Text style={s.headerTitleText}>Notifications 🔔</Text>
                            <Text style={s.headerSubText}>
                                {counts.unread > 0 ? `${counts.unread} unread updates` : 'All alerts up to date'}
                            </Text>
                        </View>

                        <View style={s.headerRightActions}>
                            <TouchableOpacity onPress={markAllAsRead} style={s.headerActionIconBtn} activeOpacity={0.7}>
                                <Ionicons name="checkmark-done" size={18} color="#F59E0B" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={clearAll} style={s.headerActionIconBtn} activeOpacity={0.7}>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Search Bar inside Header */}
                    <View style={s.searchContainer}>
                        <Ionicons name="search" size={16} color="#94A3B8" style={s.searchIcon} />
                        <TextInput
                            placeholder="Search by keyword, type, or title..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={s.searchInput}
                            selectionColor="#F59E0B"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={s.clearSearchBtn}>
                                <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* Light Body Section */}
            <View style={s.bodyContainer}>
                {/* Category Filter Chips Bar */}
                <View style={s.filterBarRow}>
                    <TouchableOpacity
                        onPress={() => setFilter('all')}
                        style={[s.filterChip, filter === 'all' ? s.filterChipActive : s.filterChipInactive]}
                    >
                        <Text style={[s.filterChipText, filter === 'all' ? s.filterChipTextActive : s.filterChipTextInactive]}>
                            All ({counts.all})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilter('unread')}
                        style={[s.filterChip, filter === 'unread' ? s.filterChipActive : s.filterChipInactive]}
                    >
                        <Text style={[s.filterChipText, filter === 'unread' ? s.filterChipTextActive : s.filterChipTextInactive]}>
                            Unread ({counts.unread})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilter('transaction')}
                        style={[s.filterChip, filter === 'transaction' ? s.filterChipActive : s.filterChipInactive]}
                    >
                        <Text style={[s.filterChipText, filter === 'transaction' ? s.filterChipTextActive : s.filterChipTextInactive]}>
                            Txns ({counts.transaction})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilter('security')}
                        style={[s.filterChip, filter === 'security' ? s.filterChipActive : s.filterChipInactive]}
                    >
                        <Text style={[s.filterChipText, filter === 'security' ? s.filterChipTextActive : s.filterChipTextInactive]}>
                            Security ({counts.security})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setSortAsc(!sortAsc)}
                        style={s.sortIconButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="swap-vertical" size={14} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {/* Notifications List */}
                {loading ? (
                    <View style={s.loadingBox}>
                        <ActivityIndicator size="large" color="#0F172A" />
                        <Text style={s.loadingText}>Loading notifications...</Text>
                    </View>
                ) : (
                    <SectionList
                        sections={sortAsc ? getFilteredAndGrouped().reverse() : getFilteredAndGrouped()}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={s.listContentPadding}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />
                        }
                        renderSectionHeader={({ section: { title } }) => (
                            <View style={s.sectionHeaderRow}>
                                <View style={s.sectionHeaderPill}>
                                    <Text style={s.sectionHeaderPillText}>{title}</Text>
                                </View>
                            </View>
                        )}
                        renderItem={renderItem}
                        ListEmptyComponent={
                            <View style={s.emptyBox}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="notifications-off-outline" size={42} color="#94A3B8" />
                                </View>
                                <Text style={s.emptyTitle}>No Notifications Found 🎉</Text>
                                <Text style={s.emptySubtitle}>
                                    You have no notifications in this category. We'll update you as soon as new activity occurs!
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* Undo Toast */}
            {showUndo && (
                <View style={s.undoToast}>
                    <Text style={s.undoToastText}>Notification deleted</Text>
                    <TouchableOpacity onPress={handleUndo} style={s.undoToastBtn}>
                        <Text style={s.undoToastBtnText}>UNDO</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Notification Detail Modal */}
            <Modal
                visible={showDetailModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDetailModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeaderRow}>
                            <View style={s.modalCategoryBadge}>
                                <Ionicons name="notifications" size={14} color="#F59E0B" />
                                <Text style={s.modalCategoryBadgeText}>
                                    {selectedItem?.type || 'Notification'}
                                </Text>
                            </View>

                            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={s.modalTitle}>{selectedItem?.title}</Text>
                        <Text style={s.modalDateText}>
                            {selectedItem?.created_at
                                ? new Date(selectedItem.created_at).toLocaleString()
                                : ''}
                        </Text>

                        <View style={s.modalBodyBox}>
                            <Text style={s.modalBodyContent}>{selectedItem?.body}</Text>
                        </View>

                        <View style={s.modalActionsRow}>
                            <TouchableOpacity
                                onPress={async () => {
                                    if (selectedItem?.body) {
                                        await Clipboard.setStringAsync(selectedItem.body);
                                        Alert.alert('Copied!', 'Notification text copied to clipboard.');
                                    }
                                }}
                                style={s.modalCopyBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="copy-outline" size={16} color="#0F172A" />
                                <Text style={s.modalCopyBtnText}>Copy Text</Text>
                            </TouchableOpacity>

                            {selectedItem?.data?.route && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowDetailModal(false);
                                        router.push(selectedItem.data.route);
                                    }}
                                    style={s.modalActionBtn}
                                    activeOpacity={0.7}
                                >
                                    <Text style={s.modalActionBtnText}>Go to Page</Text>
                                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderColor: '#F59E0B',
    },
    headerSafeArea: {
        paddingTop: Platform.OS === 'android' ? 10 : 0,
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenterCol: {
        alignItems: 'center',
    },
    headerTitleText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    headerSubText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerActionIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 42,
        borderColor: '#E2E8F0',
        borderWidth: 1,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '600',
    },
    clearSearchBtn: {
        padding: 4,
    },
    bodyContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    filterBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 14,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 14,
        borderWidth: 1,
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    filterChipInactive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#F59E0B',
    },
    filterChipTextInactive: {
        color: '#475569',
    },
    sortIconButton: {
        marginLeft: 'auto',
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingBox: {
        paddingVertical: 50,
        alignItems: 'center',
    },
    loadingText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10,
    },
    listContentPadding: {
        paddingBottom: 60,
    },
    sectionHeaderRow: {
        alignItems: 'center',
        marginVertical: 10,
    },
    sectionHeaderPill: {
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 3,
    },
    sectionHeaderPillText: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    notificationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        position: 'relative',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    notificationCardUnread: {
        borderColor: 'rgba(245, 158, 11, 0.5)',
        backgroundColor: '#FFFDF5',
    },
    notificationCardRead: {
        borderColor: '#E2E8F0',
    },
    unreadBadgeDot: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    cardContentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBodyCol: {
        flex: 1,
    },
    titleTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        paddingRight: 10,
    },
    cardTitle: {
        fontSize: 13.5,
        flex: 1,
        marginRight: 6,
    },
    cardTitleUnread: {
        color: '#0F172A',
        fontWeight: '800',
    },
    cardTitleRead: {
        color: '#334155',
        fontWeight: '600',
    },
    cardTimeText: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
    },
    typeTag: {
        backgroundColor: '#F1F5F9',
        alignSelf: 'flex-start',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6,
    },
    typeTagText: {
        color: '#475569',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    cardBodyText: {
        color: '#64748B',
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 10,
    },
    cardFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionViewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0F172A',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    actionViewBtnText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    actionIconButton: {
        padding: 4,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    emptySubtitle: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
        maxWidth: 270,
        lineHeight: 18,
    },
    undoToast: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    undoToastText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    undoToastBtn: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    undoToastBtnText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '900',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        borderTopWidth: 3,
        borderColor: '#F59E0B',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalCategoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    modalCategoryBadgeText: {
        color: '#B45309',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 4,
    },
    modalDateText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 14,
    },
    modalBodyBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    modalBodyContent: {
        color: '#334155',
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
    },
    modalActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalCopyBtn: {
        flex: 1,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    modalCopyBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    modalActionBtn: {
        flex: 1,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    modalActionBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
});
