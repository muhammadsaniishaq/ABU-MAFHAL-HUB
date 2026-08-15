import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
    Animated as RNAnimated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [sortAsc, setSortAsc] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
    const [searchQuery, setSearchQuery] = useState('');

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
        if (item.data?.route) {
            router.push(item.data.route);
        }
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
            if (confirm('Delete All: Are you sure you want to delete all notifications?')) {
                executeClear();
            }
        } else {
            Alert.alert('Clear All', 'Delete all notifications?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: executeClear,
                },
            ]);
        }
    };

    const shareNotification = async (item: any) => {
        try {
            await Share.share({
                message: `*${item.title}*\n\n${item.body}\n\n- Shared via ABU MAFHAL SUB`,
            });
        } catch (error: any) {
            Alert.alert('Share Failed', error.message);
        }
    };

    const counts = useMemo(
        () => ({
            all: notifications.length,
            unread: notifications.filter((n) => !n.is_read).length,
            high: notifications.filter((n) => n.data?.priority === 'high').length,
        }),
        [notifications]
    );

    const getFilteredAndGrouped = () => {
        let filtered = notifications;
        if (filter === 'unread') filtered = filtered.filter((n) => !n.is_read);
        if (filter === 'high') filtered = filtered.filter((n) => n.data?.priority === 'high');
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

    const renderItem = ({ item }: { item: any }) => {
        const isHigh = item.data?.priority === 'high';
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
                        Alert.alert('Options', 'What do you want to do?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Copy Text',
                                onPress: async () => {
                                    await Clipboard.setStringAsync(item.body);
                                    Alert.alert('Copied!');
                                },
                            },
                            {
                                text: item.is_read ? 'Mark as Unread' : 'Mark as Read',
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
                {!item.is_read && <View style={s.unreadDot} />}

                <View style={s.cardHeaderRow}>
                    <LinearGradient
                        colors={
                            isHigh
                                ? ['#EF4444', '#DC2626']
                                : !item.is_read
                                ? ['#F59E0B', '#D97706']
                                : ['#334155', '#1E293B']
                        }
                        style={s.iconCircle}
                    >
                        <Ionicons
                            name={isHigh ? 'warning' : 'notifications'}
                            size={16}
                            color={isHigh || !item.is_read ? '#020617' : '#94A3B8'}
                        />
                    </LinearGradient>

                    <View style={s.cardBodyCol}>
                        <View style={s.titleTimeRow}>
                            <Text
                                style={[
                                    s.titleText,
                                    !item.is_read ? s.titleUnread : s.titleRead,
                                ]}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>

                            <Text style={s.timeText}>
                                {new Date(item.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </View>

                        {item.type && item.type !== 'general' && (
                            <View style={s.typeBadge}>
                                <Text style={s.typeBadgeText}>{item.type}</Text>
                            </View>
                        )}

                        <Text style={s.bodyText} numberOfLines={3}>
                            {item.body}
                        </Text>

                        <View style={s.cardFooterActions}>
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
                                    <Ionicons name="chevron-forward" size={12} color="#020617" />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => shareNotification(item)}
                                style={s.actionShareBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="share-outline" size={13} color="#94A3B8" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => confirmDelete(item.id, item)}
                                style={s.actionDeleteBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="trash-outline" size={13} color="#EF4444" />
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

            {/* Deep Royal Mesh Gradient */}
            <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={StyleSheet.absoluteFillObject} />

            {/* Glowing Ambient Lights */}
            <View style={s.topGlow} />
            <View style={s.bottomGlow} />

            <SafeAreaView style={s.safeArea}>
                {/* Header Bar */}
                <View style={s.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#F59E0B" />
                    </TouchableOpacity>

                    <View style={s.headerTitleCol}>
                        <Text style={s.headerTitleText}>Notifications</Text>
                        {counts.unread > 0 && (
                            <View style={s.unreadBadge}>
                                <Text style={s.unreadBadgeText}>{counts.unread} New Alerts</Text>
                            </View>
                        )}
                    </View>

                    <View style={s.topActionsRow}>
                        <TouchableOpacity onPress={markAllAsRead} style={s.topActionBtn} activeOpacity={0.7}>
                            <Ionicons name="checkmark-done" size={16} color="#F59E0B" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={clearAll} style={[s.topActionBtn, { borderColor: 'rgba(239, 68, 68, 0.3)' }]} activeOpacity={0.7}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchBarContainer}>
                    <Ionicons name="search" size={16} color="#94A3B8" style={s.searchIcon} />
                    <TextInput
                        placeholder="Search notifications..."
                        placeholderTextColor="#64748B"
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

                {/* Filter Tabs */}
                <View style={s.filterTabsRow}>
                    <TouchableOpacity
                        onPress={() => setFilter('all')}
                        style={[s.filterTab, filter === 'all' ? s.filterTabActive : s.filterTabInactive]}
                    >
                        <Text style={[s.filterTabText, filter === 'all' ? s.filterTabTextActive : s.filterTabTextInactive]}>
                            All ({counts.all})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilter('unread')}
                        style={[s.filterTab, filter === 'unread' ? s.filterTabActive : s.filterTabInactive]}
                    >
                        <Text style={[s.filterTabText, filter === 'unread' ? s.filterTabTextActive : s.filterTabTextInactive]}>
                            Unread ({counts.unread})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilter('high')}
                        style={[s.filterTab, filter === 'high' ? s.filterTabActive : s.filterTabInactive]}
                    >
                        <Text style={[s.filterTabText, filter === 'high' ? s.filterTabTextActive : s.filterTabTextInactive]}>
                            Urgent ({counts.high})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setSortAsc(!sortAsc)}
                        style={s.sortBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="swap-vertical" size={14} color="#F59E0B" />
                    </TouchableOpacity>
                </View>

                {/* Main Section List */}
                <View style={s.contentListContainer}>
                    {loading ? (
                        <View style={s.loadingContainer}>
                            <ActivityIndicator size="large" color="#F59E0B" />
                            <Text style={s.loadingText}>Fetching Notifications...</Text>
                        </View>
                    ) : (
                        <SectionList
                            sections={sortAsc ? getFilteredAndGrouped().reverse() : getFilteredAndGrouped()}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ paddingBottom: 60 }}
                            showsVerticalScrollIndicator={false}
                            stickySectionHeadersEnabled={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
                            }
                            renderSectionHeader={({ section: { title } }) => (
                                <View style={s.sectionHeaderContainer}>
                                    <View style={s.sectionHeaderPill}>
                                        <Text style={s.sectionHeaderText}>{title}</Text>
                                    </View>
                                </View>
                            )}
                            renderItem={renderItem}
                            ListEmptyComponent={
                                <View style={s.emptyContainer}>
                                    <View style={s.emptyIconCircle}>
                                        <Ionicons name="checkmark-circle-outline" size={42} color="#F59E0B" />
                                    </View>
                                    <Text style={s.emptyTitleText}>All Caught Up 🎉</Text>
                                    <Text style={s.emptySubText}>
                                        You have no unread notifications or security alerts at this time.
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
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    topGlow: {
        position: 'absolute',
        top: -100,
        alignSelf: 'center',
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -100,
        alignSelf: 'center',
        width: 340,
        height: 340,
        borderRadius: 170,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
    },
    safeArea: {
        flex: 1,
        paddingHorizontal: 16,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginBottom: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleCol: {
        alignItems: 'center',
    },
    headerTitleText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    unreadBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginTop: 2,
    },
    unreadBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '800',
    },
    topActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topActionBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 42,
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    clearSearchBtn: {
        padding: 4,
    },
    filterTabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    filterTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    filterTabActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    filterTabInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    filterTabText: {
        fontSize: 11,
        fontWeight: '700',
    },
    filterTabTextActive: {
        color: '#020617',
    },
    filterTabTextInactive: {
        color: '#94A3B8',
    },
    sortBtn: {
        marginLeft: 'auto',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentListContainer: {
        flex: 1,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#94A3B8',
        fontSize: 13,
        marginTop: 10,
        fontWeight: '600',
    },
    sectionHeaderContainer: {
        alignItems: 'center',
        marginVertical: 8,
    },
    sectionHeaderPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 3,
        borderRadius: 12,
    },
    sectionHeaderText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    notificationCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        position: 'relative',
    },
    notificationCardUnread: {
        borderColor: 'rgba(245, 158, 11, 0.4)',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
    },
    notificationCardRead: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    unreadDot: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F59E0B',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        paddingRight: 14,
    },
    titleText: {
        fontSize: 14,
        flex: 1,
        marginRight: 8,
    },
    titleUnread: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    titleRead: {
        color: '#CBD5E1',
        fontWeight: '600',
    },
    timeText: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
    },
    typeBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6,
    },
    typeBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    bodyText: {
        color: '#94A3B8',
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 10,
    },
    cardFooterActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionViewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    actionViewBtnText: {
        color: '#020617',
        fontSize: 10,
        fontWeight: '800',
    },
    actionShareBtn: {
        padding: 4,
    },
    actionDeleteBtn: {
        padding: 4,
        marginLeft: 'auto',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitleText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    emptySubText: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        maxWidth: 260,
    },
    undoToast: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        backgroundColor: '#0F172A',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#F59E0B',
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
});
