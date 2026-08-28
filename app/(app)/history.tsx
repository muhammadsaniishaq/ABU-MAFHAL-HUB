import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
    ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../../hooks/useAppSettings';
import { ReceiptData } from '../../services/receiptGenerator';
import ReceiptExportModal from '../../components/ReceiptExportModal';

// Executive Color Tokens
const L = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    navyHeader: '#0F172A',
    navyMid: '#1E293B',
    gold: '#FFD700',
    goldDk: '#DAA520',
    goldAmber: '#D97706',
    goldLight: '#FEF3C7',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    sky: '#0EA5E9',
    skyBg: '#F0F9FF',
    coral: '#EF4444',
    coralBg: '#FFF1F2',
    purple: '#8B5CF6',
    purpleBg: '#F5F3FF',
    pink: '#EC4899',
    pinkBg: '#FDF2F8',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
};

const FILTER_TABS = [
    { id: 'All', label: 'All' },
    { id: 'Telecom', label: '📱 Airtime/Data' },
    { id: 'Boost', label: '🚀 Social Boost' },
    { id: 'Verification', label: '📜 NIN / BVN / CAC' },
    { id: 'Deposits', label: '⬇️ Deposits' },
    { id: 'Transfers', label: '⬆️ Transfers' },
    { id: 'Bills', label: '⚡ Utilities' },
    { id: 'Pending', label: '⏳ Pending' },
];

export default function HistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [exportReceiptData, setExportReceiptData] = useState<ReceiptData | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const { settings } = useAppSettings();

    const currentUserIdRef = useRef('');

    useEffect(() => {
        initHistory();
    }, []);

    const initHistory = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                currentUserIdRef.current = user.id;
                // 1. Instant Cache Load (0ms Render)
                await loadCachedHistory(user.id);
                // 2. Fresh Network Sync
                await fetchLiveHistory(user.id);
                // 3. Realtime Subscription Setup
                setupRealtimeListener(user.id);
            }
        } catch (e) {
            console.warn('History init error:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadCachedHistory = async (userId: string) => {
        try {
            const cachedStr = await AsyncStorage.getItem(`@user_tx_history_v3_${userId}`);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setHistory(parsed);
                    setLoading(false);
                }
            }
        } catch (e) {}
    };

    const saveCachedHistory = async (userId: string, data: any[]) => {
        try {
            await AsyncStorage.setItem(`@user_tx_history_v3_${userId}`, JSON.stringify(data));
        } catch (e) {}
    };

    const mapTransactionRecord = (tx: any) => {
        const rawAmount = Math.abs(parseFloat(tx.amount?.toString() || '0'));
        const typeStr = (tx.type || '').toLowerCase();
        const descStr = (tx.description || '').toLowerCase();
        const isIncome = typeStr === 'deposit' || typeStr === 'credit' || (typeStr !== 'withdrawal' && typeStr !== 'transfer' && parseFloat(tx.amount || '0') > 0);

        let icon = 'receipt-outline';
        let color = '#F59E0B';
        let category = 'Services';

        if (typeStr === 'transfer') {
            icon = 'send-outline';
            color = '#3B82F6';
            category = 'Transfers';
        } else if (typeStr === 'withdrawal') {
            icon = 'card-outline';
            color = '#EF4444';
            category = 'Transfers';
        } else if (typeStr === 'deposit' || typeStr === 'credit') {
            icon = 'arrow-down-circle-outline';
            color = '#10B981';
            category = 'Deposits';
        } else if (descStr.includes('airtime') || typeStr === 'airtime') {
            icon = 'phone-portrait-outline';
            color = '#10B981';
            category = 'Telecom';
        } else if (descStr.includes('data') || typeStr === 'data') {
            icon = 'wifi-outline';
            color = '#3B82F6';
            category = 'Telecom';
        } else if (descStr.includes('nin') || descStr.includes('bvn') || descStr.includes('cac') || descStr.includes('slip') || descStr.includes('verification') || typeStr.includes('nin') || typeStr.includes('bvn') || typeStr.includes('cac')) {
            icon = 'document-text-outline';
            color = '#8B5CF6';
            category = 'Verification';
        } else if (descStr.includes('cable') || descStr.includes('dstv') || descStr.includes('gotv') || descStr.includes('electricity') || descStr.includes('bill')) {
            icon = 'flash-outline';
            color = '#F59E0B';
            category = 'Bills';
        } else if (descStr.includes('boost') || typeStr.includes('boost') || typeStr.includes('smm')) {
            icon = 'rocket-outline';
            color = '#EC4899';
            category = 'Social Boost';
        }

        const dateObj = new Date(tx.created_at || Date.now());

        return {
            ...tx,
            displayAmount: `${isIncome ? '+' : '-'}₦${rawAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            rawAmount,
            isIncome,
            icon,
            color,
            category,
            dateObj,
            statusNormalized: (tx.status || 'success').toLowerCase()
        };
    };

    const fetchLiveHistory = async (userId: string) => {
        try {
            // Parallel Fetch: Standard Transactions + Verification Services History
            const [txRes, verifRes] = await Promise.allSettled([
                supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('verification_history')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(100)
            ]);

            const standardTxList = txRes.status === 'fulfilled' && txRes.value.data ? txRes.value.data : [];
            const verifTxList = verifRes.status === 'fulfilled' && verifRes.value.data ? verifRes.value.data : [];

            // Transform verification records into standard format if not already mirrored in transactions
            const mappedVerif = verifTxList.map(v => ({
                id: v.id || `verif-${v.reference || Date.now()}`,
                user_id: v.user_id,
                type: (v.service_type || 'verification').toLowerCase(),
                amount: v.amount_paid || v.price || 0,
                status: v.status || 'completed',
                description: `${(v.service_type || 'Verification').toUpperCase()}: ${v.identifier || v.nin || v.bvn || v.cac_name || 'Slip Search'}`,
                reference: v.reference || v.id,
                created_at: v.created_at,
                metadata: {
                    slip_url: v.slip_url || v.pdf_url || v.download_url,
                    result_data: v.result_data || v.data_payload,
                    service_type: v.service_type,
                    identifier: v.identifier || v.nin || v.bvn
                }
            }));

            // Merge and deduplicate by reference or ID
            const seenKeys = new Set<string>();
            const combinedRaw = [...standardTxList, ...mappedVerif].filter(item => {
                const key = item.reference || item.id;
                if (!key || seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
            });

            const mappedCombined = combinedRaw.map(mapTransactionRecord).sort(
                (a, b) => b.dateObj.getTime() - a.dateObj.getTime()
            );

            setHistory(mappedCombined);
            saveCachedHistory(userId, mappedCombined);
        } catch (error) {
            console.error('Error fetching live history:', error);
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    const setupRealtimeListener = (userId: string) => {
        const channel = supabase
            .channel(`user_tx_sync_${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, (payload: any) => {
                if (payload.new) {
                    const newMapped = mapTransactionRecord(payload.new);
                    setHistory(prev => {
                        const updated = [newMapped, ...prev.filter(t => t.id !== newMapped.id && t.reference !== newMapped.reference)];
                        saveCachedHistory(userId, updated);
                        return updated;
                    });
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_history', filter: `user_id=eq.${userId}` }, () => {
                fetchLiveHistory(userId);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        if (currentUserIdRef.current) {
            fetchLiveHistory(currentUserIdRef.current);
        } else {
            initHistory();
        }
    }, []);

    const copyToClipboard = async (text: string, label: string = 'Reference') => {
        await Clipboard.setStringAsync(text);
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (Platform.OS === 'web') alert(`${label} Copied to Clipboard!`);
        else Alert.alert('Copied!', `${label} copied to clipboard.`);
    };

    const contactSupport = (tx: any) => {
        const supportPhone = settings?.support_whatsapp || '2348000000000';
        const cleanPhone = supportPhone.replace(/[^0-9]/g, '');
        const message = `Hello Support, I need assistance regarding my Transaction:\n\n• Type: ${tx.type}\n• Amount: ${tx.displayAmount}\n• Reference: ${tx.reference || tx.id}\n• Status: ${tx.status}\n• Date: ${tx.dateObj.toLocaleString()}`;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not launch WhatsApp. Please try again.');
        });
    };

    // Fast Filtering & Search
    const filteredHistory = useMemo(() => {
        return history.filter(tx => {
            let matchesFilter = true;
            if (filter === 'Telecom') matchesFilter = tx.category === 'Telecom';
            else if (filter === 'Boost') matchesFilter = tx.category === 'Social Boost';
            else if (filter === 'Verification') matchesFilter = tx.category === 'Verification';
            else if (filter === 'Deposits') matchesFilter = tx.category === 'Deposits';
            else if (filter === 'Transfers') matchesFilter = tx.category === 'Transfers';
            else if (filter === 'Bills') matchesFilter = tx.category === 'Bills';
            else if (filter === 'Pending') matchesFilter = tx.statusNormalized === 'pending' || tx.statusNormalized === 'processing';

            let matchesSearch = true;
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const desc = (tx.description || '').toLowerCase();
                const ref = (tx.reference || tx.id || '').toLowerCase();
                const amt = tx.rawAmount.toString();
                const typeName = (tx.type || '').toLowerCase();
                matchesSearch = desc.includes(query) || ref.includes(query) || amt.includes(query) || typeName.includes(query);
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

                    <TouchableOpacity onPress={handleRefresh} style={s.refreshBtn} activeOpacity={0.8}>
                        <Ionicons name="reload-outline" size={16} color={L.gold} />
                    </TouchableOpacity>
                </View>

                {/* Summary Metrics Pill Bar */}
                <View style={s.summaryPillRow}>
                    <View style={s.summaryPill}>
                        <Ionicons name="receipt" size={13} color={L.gold} />
                        <Text style={s.summaryPillText}>
                            {filteredHistory.length} Record{filteredHistory.length === 1 ? '' : 's'}
                        </Text>
                    </View>

                    <View style={[s.summaryPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)' }]}>
                        <Ionicons name="wallet" size={13} color={L.emerald} />
                        <Text style={[s.summaryPillText, { color: L.emerald }]}>
                            Vol: ₦{totalVolume.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>

                    <View style={[s.summaryPill, { backgroundColor: 'rgba(255, 215, 0, 0.15)', borderColor: 'rgba(255, 215, 0, 0.4)' }]}>
                        <Ionicons name="flash" size={13} color={L.gold} />
                        <Text style={[s.summaryPillText, { color: L.gold }]}>Live Realtime</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchBarWrap}>
                    <Ionicons name="search-outline" size={16} color="#94A3B8" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search type, reference, description..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Tabs Scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterTabsScroll}>
                    {FILTER_TABS.map(tab => {
                        const isSelected = filter === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setFilter(tab.id)}
                                style={[s.filterTabBtn, isSelected && s.filterTabBtnActive]}
                                activeOpacity={0.8}
                            >
                                <Text style={[s.filterTabBtnText, isSelected && s.filterTabBtnTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </LinearGradient>

            {/* Content List Section */}
            {loading && history.length === 0 ? (
                <View style={s.centerBox}>
                    <ActivityIndicator size="large" color={L.goldDk} />
                    <Text style={s.loadingText}>Syncing transaction ledger...</Text>
                </View>
            ) : filteredHistory.length === 0 ? (
                <View style={s.emptyBox}>
                    <Ionicons name="receipt-outline" size={44} color={L.goldDk} />
                    <Text style={s.emptyTitle}>No Transactions Found</Text>
                    <Text style={s.emptySub}>
                        {searchQuery
                            ? `No records match "${searchQuery}".`
                            : 'All your recharge, bill payments, and transfers will appear here automatically.'}
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.id || `tx-${index}`}
                    contentContainerStyle={s.listContent}
                    stickySectionHeadersEnabled={false}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    showsVerticalScrollIndicator={false}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionHeaderText}>{title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const isSuccess = item.statusNormalized === 'success' || item.statusNormalized === 'completed';
                        const isPending = item.statusNormalized === 'pending' || item.statusNormalized === 'processing';
                        const isFailed = item.statusNormalized === 'failed' || item.statusNormalized === 'reversed';

                        return (
                            <TouchableOpacity
                                onPress={() => setSelectedTx(item)}
                                style={s.txItemCard}
                                activeOpacity={0.75}
                            >
                                <View style={[s.txIconBox, { backgroundColor: `${item.color}15`, borderColor: `${item.color}40` }]}>
                                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                                </View>

                                <View style={s.txMainCol}>
                                    <Text style={s.txTitle} numberOfLines={1}>
                                        {item.description || item.type?.toUpperCase() || 'Transaction'}
                                    </Text>
                                    <Text style={s.txDateText}>
                                        {item.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Ref: {(item.reference || item.id || '').slice(-8)}
                                    </Text>
                                </View>

                                <View style={s.txAmountCol}>
                                    <Text style={[s.txAmountText, { color: item.isIncome ? L.emerald : L.navyHeader }]}>
                                        {item.displayAmount}
                                    </Text>
                                    <View style={[
                                        s.statusBadge,
                                        isSuccess && s.statusSuccess,
                                        isPending && s.statusPending,
                                        isFailed && s.statusFailed
                                    ]}>
                                        <Text style={[
                                            s.statusBadgeText,
                                            isSuccess && { color: L.emerald },
                                            isPending && { color: L.goldAmber },
                                            isFailed && { color: L.coral }
                                        ]}>
                                            {isSuccess ? 'SUCCESS' : isPending ? 'PENDING' : 'FAILED'}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* TRANSACTION DETAIL MODAL SHEET */}
            <Modal visible={!!selectedTx} transparent animationType="slide" onRequestClose={() => setSelectedTx(null)}>
                <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setSelectedTx(null)}>
                    <View style={s.modalSheet}>
                        <View style={s.modalDragBar} />

                        <View style={s.modalHeader}>
                            <Text style={s.modalHeaderTitle}>Transaction Receipt</Text>
                            <TouchableOpacity onPress={() => setSelectedTx(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={L.navyHeader} />
                            </TouchableOpacity>
                        </View>

                        {selectedTx && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Amount Card */}
                                <View style={s.detailAmountCard}>
                                    <Text style={[s.detailAmountText, { color: selectedTx.isIncome ? L.emerald : L.navyHeader }]}>
                                        {selectedTx.displayAmount}
                                    </Text>
                                    <View style={[
                                        s.detailStatusPill,
                                        selectedTx.statusNormalized === 'success' || selectedTx.statusNormalized === 'completed'
                                            ? { backgroundColor: L.emeraldBg, borderColor: L.emeraldBorder, borderWidth: 1 }
                                            : selectedTx.statusNormalized === 'pending'
                                                ? { backgroundColor: L.goldLight, borderColor: L.goldDk, borderWidth: 1 }
                                                : { backgroundColor: L.coralBg, borderColor: L.coral, borderWidth: 1 }
                                    ]}>
                                        <Ionicons
                                            name={
                                                selectedTx.statusNormalized === 'success' || selectedTx.statusNormalized === 'completed'
                                                    ? 'checkmark-circle'
                                                    : selectedTx.statusNormalized === 'pending'
                                                        ? 'time'
                                                        : 'alert-circle'
                                            }
                                            size={12}
                                            color={
                                                selectedTx.statusNormalized === 'success' || selectedTx.statusNormalized === 'completed'
                                                    ? L.emerald
                                                    : selectedTx.statusNormalized === 'pending'
                                                        ? L.goldAmber
                                                        : L.coral
                                            }
                                        />
                                        <Text style={[
                                            s.detailStatusPillText,
                                            {
                                                color: selectedTx.statusNormalized === 'success' || selectedTx.statusNormalized === 'completed'
                                                    ? L.emerald
                                                    : selectedTx.statusNormalized === 'pending'
                                                        ? L.goldAmber
                                                        : L.coral
                                            }
                                        ]}>
                                            {(selectedTx.status || 'COMPLETED').toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Info Card */}
                                <View style={s.detailInfoCard}>
                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Service Description</Text>
                                        <Text style={s.infoValue}>{selectedTx.description || selectedTx.type}</Text>
                                    </View>

                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Category</Text>
                                        <Text style={s.infoValue}>{selectedTx.category || 'Payment'}</Text>
                                    </View>

                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Transaction Date</Text>
                                        <Text style={s.infoValue}>{selectedTx.dateObj.toLocaleString()}</Text>
                                    </View>

                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Reference Code</Text>
                                        <TouchableOpacity
                                            onPress={() => copyToClipboard(selectedTx.reference || selectedTx.id, 'Reference')}
                                            style={s.refCopyRow}
                                        >
                                            <Text style={s.refText}>{selectedTx.reference || selectedTx.id}</Text>
                                            <Ionicons name="copy-outline" size={13} color={L.goldAmber} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Slip Download Button (For NIN / BVN / CAC) */}
                                {selectedTx.metadata?.slip_url && (
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(selectedTx.metadata.slip_url)}
                                        style={s.slipDownloadBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="download-outline" size={16} color="#0F172A" />
                                        <Text style={s.slipDownloadBtnText}>Download Verification Slip (PDF)</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Action Buttons */}
                                <View style={s.modalActionsCol}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setExportReceiptData({
                                                reference: selectedTx.reference || selectedTx.id,
                                                type: selectedTx.type || selectedTx.category || 'Transaction',
                                                description: selectedTx.description,
                                                amount: selectedTx.rawAmount,
                                                status: selectedTx.statusNormalized || selectedTx.status || 'SUCCESSFUL',
                                                date: selectedTx.dateObj,
                                                paymentMethod: selectedTx.payment_method || 'Wallet Balance',
                                                beneficiary: selectedTx.metadata?.identifier || selectedTx.metadata?.phone || selectedTx.metadata?.account_number || selectedTx.metadata?.link
                                            });
                                            setExportModalVisible(true);
                                        }}
                                        style={s.pdfReceiptBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="download-outline" size={16} color="#0F172A" />
                                        <Text style={s.pdfReceiptBtnText}>Download Receipt (PDF / PNG)</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(selectedTx.reference || selectedTx.id, 'Reference')}
                                        style={s.copyRefBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="copy-outline" size={15} color={L.navyHeader} />
                                        <Text style={s.copyRefBtnText}>Copy Transaction Reference</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => contactSupport(selectedTx)}
                                        style={s.whatsappSupportBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                                        <Text style={s.whatsappSupportBtnText}>Get Help on WhatsApp</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* DUAL FORMAT RECEIPT EXPORT MODAL (PDF / PNG) */}
            <ReceiptExportModal
                visible={exportModalVisible}
                onClose={() => setExportModalVisible(false)}
                receiptData={exportReceiptData}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: L.bg,
    },
    topAccentLine: {
        height: 3,
        backgroundColor: L.gold,
        width: '100%',
    },
    headerContainer: {
        paddingTop: Platform.OS === 'ios' ? 44 : 32,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        borderBottomWidth: 1.5,
        borderColor: L.goldDk,
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 0.2,
    },
    refreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    summaryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.25)',
    },
    summaryPillText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800',
    },
    searchBarWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#060B19',
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 32,
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.3)',
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 11,
        marginLeft: 6,
    },
    filterTabsScroll: {
        flexDirection: 'row',
        gap: 5,
        paddingVertical: 2,
    },
    filterTabBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    filterTabBtnActive: {
        backgroundColor: L.gold,
        borderColor: L.goldDk,
    },
    filterTabBtnText: {
        color: '#E2E8F0',
        fontSize: 9.5,
        fontWeight: '700',
    },
    filterTabBtnTextActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 8,
    },
    loadingText: {
        color: L.textMuted,
        fontSize: 12,
        fontWeight: '700',
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        margin: 16,
        backgroundColor: L.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: L.cardBorder,
        gap: 6,
    },
    emptyTitle: {
        color: L.navyHeader,
        fontWeight: '900',
        fontSize: 14,
    },
    emptySub: {
        color: L.textMuted,
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 15,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 40,
        maxWidth: 700,
        width: '100%',
        alignSelf: 'center',
    },
    sectionHeader: {
        paddingVertical: 6,
        backgroundColor: L.bg,
    },
    sectionHeaderText: {
        color: L.textMuted,
        fontWeight: '900',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    txItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: L.card,
        borderRadius: 12,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: L.cardBorder,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    txIconBox: {
        width: 34,
        height: 34,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    txMainCol: {
        flex: 1,
        marginLeft: 10,
        marginRight: 6,
    },
    txTitle: {
        color: L.navyHeader,
        fontWeight: '800',
        fontSize: 11.5,
    },
    txDateText: {
        color: L.textMuted,
        fontSize: 9,
        marginTop: 2,
    },
    txAmountCol: {
        alignItems: 'flex-end',
    },
    txAmountText: {
        fontWeight: '900',
        fontSize: 12,
    },
    statusBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 2,
    },
    statusSuccess: {
        backgroundColor: L.emeraldBg,
    },
    statusPending: {
        backgroundColor: L.goldLight,
    },
    statusFailed: {
        backgroundColor: L.coralBg,
    },
    statusBadgeText: {
        fontSize: 7.5,
        fontWeight: '900',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 14,
        borderTopWidth: 2,
        borderColor: L.goldDk,
        maxHeight: '80%',
        maxWidth: 550,
        width: '100%',
        alignSelf: 'center',
    },
    modalDragBar: {
        width: 32,
        height: 3.5,
        backgroundColor: '#CBD5E1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalHeaderTitle: {
        color: L.navyHeader,
        fontSize: 14,
        fontWeight: '900',
    },
    modalCloseBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailAmountCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
    },
    detailAmountText: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    detailStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 8,
    },
    detailStatusPillText: {
        fontSize: 9,
        fontWeight: '900',
    },
    detailInfoCard: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700',
    },
    infoValue: {
        color: L.navyHeader,
        fontSize: 10.5,
        fontWeight: '800',
        maxWidth: 220,
        textAlign: 'right',
    },
    refCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    refText: {
        color: L.navyHeader,
        fontSize: 10,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    slipDownloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: L.gold,
        paddingVertical: 9,
        borderRadius: 10,
        marginBottom: 8,
    },
    slipDownloadBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 11,
    },
    modalActionsCol: {
        gap: 6,
        marginBottom: 10,
    },
    pdfReceiptBtn: {
        backgroundColor: L.gold,
        height: 40,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: L.goldDk,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    pdfReceiptBtnText: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    copyRefBtn: {
        backgroundColor: '#F1F5F9',
        height: 38,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    copyRefBtnText: {
        color: L.navyHeader,
        fontSize: 11,
        fontWeight: '800',
    },
    whatsappSupportBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#25D366',
        borderWidth: 1,
        height: 38,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    whatsappSupportBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
});
