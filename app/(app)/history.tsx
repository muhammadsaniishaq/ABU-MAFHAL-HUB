import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    SectionList,
    TouchableOpacity,
    StyleSheet,
    Platform,
    TextInput,
    Modal,
    ScrollView,
    Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function HistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const { settings } = useAppSettings();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) {
                    const mapped = data.map(tx => {
                        const amount = parseFloat(tx.amount.toString());
                        const isIncome = tx.type === 'deposit' || (tx.type !== 'withdrawal' && tx.type !== 'transfer' && amount > 0);
                        let icon = 'receipt-outline';
                        let color = '#F59E0B';

                        if (tx.type === 'transfer') { icon = 'send-outline'; color = '#3B82F6'; }
                        else if (tx.type === 'withdrawal') { icon = 'card-outline'; color = '#EF4444'; }
                        else if (tx.type === 'deposit') { icon = 'arrow-down-circle-outline'; color = '#10B981'; }
                        else if (tx.description?.toLowerCase().includes('airtime')) { icon = 'phone-portrait-outline'; color = '#10B981'; }
                        else if (tx.description?.toLowerCase().includes('data')) { icon = 'wifi-outline'; color = '#3B82F6'; }
                        else if (tx.description?.toLowerCase().includes('cable') || tx.description?.toLowerCase().includes('dstv')) { icon = 'tv-outline'; color = '#8B5CF6'; }

                        return {
                            ...tx,
                            displayAmount: `${isIncome ? '+' : '-'}₦${Math.abs(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
                            rawAmount: Math.abs(amount),
                            isIncome,
                            icon,
                            color,
                            dateObj: new Date(tx.created_at)
                        };
                    });
                    setHistory(mapped);
                }
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        fetchHistory();
    };

    const copyToClipboard = async (text: string, label: string = 'Reference') => {
        await Clipboard.setStringAsync(text);
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (Platform.OS === 'web') alert(`${label} Copied to Clipboard!`);
        else Alert.alert("Copied!", `${label} copied to clipboard.`);
    };

    const contactSupport = (tx: any) => {
        const supportPhone = settings?.support_whatsapp || '2348000000000';
        const cleanPhone = supportPhone.replace(/[^0-9]/g, '');
        const message = `Hello Support, I need assistance regarding my Transaction:\n\n• Type: ${tx.type}\n• Amount: ${tx.displayAmount}\n• Reference: ${tx.reference || tx.id}\n• Status: ${tx.status}\n• Date: ${tx.dateObj.toLocaleString()}`;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        Linking.openURL(url).catch(() => {
            Alert.alert("Error", "Could not launch WhatsApp. Please try again.");
        });
    };

    const filteredHistory = useMemo(() => {
        return history.filter(tx => {
            let matchesFilter = true;
            if (filter === 'Deposits') matchesFilter = tx.isIncome;
            else if (filter === 'Withdrawals') matchesFilter = tx.type === 'withdrawal' || tx.type === 'transfer';
            else if (filter === 'Services') matchesFilter = !tx.isIncome && tx.type !== 'withdrawal' && tx.type !== 'transfer';
            else if (filter === 'Pending/Failed') matchesFilter = tx.status !== 'success';

            let matchesSearch = true;
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const desc = (tx.description || '').toLowerCase();
                const ref = (tx.reference || tx.id || '').toLowerCase();
                const amt = tx.rawAmount.toString();
                matchesSearch = desc.includes(query) || ref.includes(query) || amt.includes(query);
            }

            return matchesFilter && matchesSearch;
        });
    }, [history, filter, searchQuery]);

    const totalVolume = useMemo(() => {
        return filteredHistory.reduce((acc, tx) => acc + tx.rawAmount, 0);
    }, [filteredHistory]);

    const sections = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        const today = new Date().setHours(0, 0, 0, 0);
        const yesterday = new Date(today - 86400000).setHours(0, 0, 0, 0);

        filteredHistory.forEach(tx => {
            const txDate = new Date(tx.dateObj).setHours(0, 0, 0, 0);
            let title = tx.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            if (txDate === today) title = 'Today';
            else if (txDate === yesterday) title = 'Yesterday';

            if (!groups[title]) groups[title] = [];
            groups[title].push(tx);
        });

        return Object.keys(groups).map(title => ({
            title,
            data: groups[title]
        }));
    }, [filteredHistory]);

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Top Accent Gold Bar */}
            <View style={s.topAccentLine} />

            {/* Executive Header Banner */}
            <LinearGradient colors={['#020617', '#0F172A', '#1E293B']} style={s.headerContainer}>
                <View style={s.headerNavRow}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
                        <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    <Text style={s.headerTitleText}>Transaction History</Text>

                    <TouchableOpacity onPress={() => fetchHistory()} style={s.refreshBtn} activeOpacity={0.8}>
                        <Ionicons name="reload-outline" size={16} color="#F59E0B" />
                    </TouchableOpacity>
                </View>

                {/* Summary Metrics Pill Bar */}
                <View style={s.summaryPillRow}>
                    <View style={s.summaryPill}>
                        <Ionicons name="receipt" size={13} color="#F59E0B" />
                        <Text style={s.summaryPillText}>
                            {filteredHistory.length} {filteredHistory.length === 1 ? 'Record' : 'Records'}
                        </Text>
                    </View>

                    <View style={s.summaryPill}>
                        <Ionicons name="analytics" size={13} color="#10B981" />
                        <Text style={s.summaryPillText}>
                            Total: ₦{totalVolume.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Search & Filter Container */}
            <View style={s.searchFilterBox}>
                {/* Search Input Bar */}
                <View style={s.searchBarInputContainer}>
                    <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search ref, service, amount..."
                        placeholderTextColor="#94A3B8"
                        style={s.searchBarInput}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 2 }}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Category Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsScroll}>
                    {['All', 'Deposits', 'Withdrawals', 'Services', 'Pending/Failed'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[s.filterChip, filter === f && s.filterChipActive]}
                            onPress={() => {
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setFilter(f);
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Transaction Section List */}
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id || Math.random().toString()}
                contentContainerStyle={s.listPadding}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={7}
                removeClippedSubviews={Platform.OS !== 'web'}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={s.sectionHeaderTitle}>{title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={s.txItemCard}
                        onPress={() => {
                            if (Platform.OS !== 'web') Haptics.selectionAsync();
                            setSelectedTx(item);
                        }}
                        activeOpacity={0.75}
                    >
                        <View style={s.txCardLeft}>
                            <View style={[s.txIconBox, { backgroundColor: item.color + '18' }]}>
                                <Ionicons name={item.icon as any} size={16} color={item.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.txTitleText} numberOfLines={1}>
                                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                </Text>
                                <Text style={s.txSubText} numberOfLines={1}>
                                    {item.description || item.reference || 'Wallet transaction'}
                                </Text>
                            </View>
                        </View>

                        <View style={s.txCardRight}>
                            <Text style={[s.txAmountText, { color: item.isIncome ? '#10B981' : '#0F172A' }]}>
                                {item.displayAmount}
                            </Text>

                            <View style={s.statusRow}>
                                <View style={[s.statusDotSmall, { backgroundColor: item.status === 'success' ? '#10B981' : item.status === 'failed' ? '#EF4444' : '#F59E0B' }]} />
                                <Text style={s.txTimeText}>
                                    {item.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View style={s.emptyBox}>
                        <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />
                        <Text style={s.emptyTitle}>No Transactions Found</Text>
                        <Text style={s.emptySub}>
                            {searchQuery ? 'Try matching another keyword or filter.' : 'Your transactions history will appear here.'}
                        </Text>
                    </View>
                )}
            />

            {/* INTERACTIVE TRANSACTION DETAILS MODAL SHEET */}
            <Modal
                visible={!!selectedTx}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedTx(null)}
            >
                {selectedTx && (
                    <View style={s.modalBackdrop}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedTx(null)} activeOpacity={1} />

                        <View style={s.modalSheet}>
                            <View style={s.modalDragBar} />

                            <View style={s.modalHeader}>
                                <Text style={s.modalHeaderTitle}>Transaction Details</Text>
                                <TouchableOpacity onPress={() => setSelectedTx(null)} style={s.modalCloseBtn}>
                                    <Ionicons name="close" size={18} color="#64748B" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                {/* Big Amount Badge */}
                                <View style={s.detailAmountCard}>
                                    <Text style={[s.detailAmountText, { color: selectedTx.isIncome ? '#10B981' : '#0F172A' }]}>
                                        {selectedTx.displayAmount}
                                    </Text>

                                    <View style={[s.detailStatusPill, { backgroundColor: selectedTx.status === 'success' ? '#ECFDF5' : selectedTx.status === 'failed' ? '#FEF2F2' : '#FEF3C7' }]}>
                                        <Ionicons
                                            name={selectedTx.status === 'success' ? 'checkmark-circle' : selectedTx.status === 'failed' ? 'close-circle' : 'time-sharp'}
                                            size={14}
                                            color={selectedTx.status === 'success' ? '#047857' : selectedTx.status === 'failed' ? '#B91C1C' : '#B45309'}
                                        />
                                        <Text style={[s.detailStatusPillText, { color: selectedTx.status === 'success' ? '#047857' : selectedTx.status === 'failed' ? '#B91C1C' : '#B45309' }]}>
                                            {selectedTx.status ? selectedTx.status.toUpperCase() : 'SUCCESS'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Key-Value Details Card */}
                                <View style={s.detailInfoCard}>
                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Transaction Type</Text>
                                        <Text style={s.infoValue}>{selectedTx.type.toUpperCase()}</Text>
                                    </View>

                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Description</Text>
                                        <Text style={s.infoValue} numberOfLines={2}>{selectedTx.description || 'Wallet Transaction'}</Text>
                                    </View>

                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Date & Time</Text>
                                        <Text style={s.infoValue}>{selectedTx.dateObj.toLocaleString()}</Text>
                                    </View>

                                    <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
                                        <Text style={s.infoLabel}>Reference ID</Text>
                                        <TouchableOpacity onPress={() => copyToClipboard(selectedTx.reference || selectedTx.id)} style={s.refCopyRow}>
                                            <Text style={s.refText} numberOfLines={1}>{selectedTx.reference || selectedTx.id}</Text>
                                            <Ionicons name="copy-outline" size={13} color="#F59E0B" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={s.modalActionsCol}>
                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(selectedTx.reference || selectedTx.id, 'Transaction Reference')}
                                        style={s.copyRefBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="copy-outline" size={16} color="#0F172A" />
                                        <Text style={s.copyRefBtnText}>Copy Reference ID</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => contactSupport(selectedTx)}
                                        style={s.whatsappSupportBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                                        <Text style={s.whatsappSupportBtnText}>Need Help? WhatsApp Support</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topAccentLine: {
        height: 2.5,
        backgroundColor: '#F59E0B',
    },
    headerContainer: {
        paddingTop: Platform.OS === 'android' ? 32 : 42,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderBottomWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    refreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    summaryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    summaryPillText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },
    searchFilterBox: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    searchBarInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 38,
        marginBottom: 10,
    },
    searchBarInput: {
        flex: 1,
        fontSize: 12,
        color: '#0F172A',
        fontWeight: '600',
    },
    filterChipsScroll: {
        flexDirection: 'row',
        gap: 6,
        paddingBottom: 4,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#F59E0B',
    },
    filterChipText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#F59E0B',
        fontWeight: '900',
    },
    listPadding: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    sectionHeaderTitle: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 12,
        marginBottom: 6,
        marginLeft: 2,
    },
    txItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 14,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    txCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    txIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txTitleText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    txSubText: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '500',
        marginTop: 1,
    },
    txCardRight: {
        alignItems: 'flex-end',
    },
    txAmountText: {
        fontSize: 12,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    statusDotSmall: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    txTimeText: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '600',
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 6,
    },
    emptySub: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },

    // MODAL SHEET STYLES
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        borderTopWidth: 2.5,
        borderColor: '#F59E0B',
        maxHeight: '80%',
    },
    modalDragBar: {
        width: 36,
        height: 4,
        backgroundColor: '#CBD5E1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    modalHeaderTitle: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '900',
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailAmountCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    detailAmountText: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    detailStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    detailStatusPillText: {
        fontSize: 10,
        fontWeight: '900',
    },
    detailInfoCard: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        marginBottom: 14,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    infoValue: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '800',
        maxWidth: 200,
        textAlign: 'right',
    },
    refCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    refText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    modalActionsCol: {
        gap: 8,
    },
    copyRefBtn: {
        backgroundColor: '#F1F5F9',
        height: 42,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    copyRefBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    whatsappSupportBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#25D366',
        borderWidth: 1.2,
        height: 42,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    whatsappSupportBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
});
