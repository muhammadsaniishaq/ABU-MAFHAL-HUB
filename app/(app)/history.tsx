import { View, Text, SectionList, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function HistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
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
                        const isIncome = tx.type === 'deposit' || amount > 0;
                        let icon = 'wallet-outline';
                        let color = '#f5a623'; // Gold brand color

                        if (tx.type === 'transfer') { icon = 'send-outline'; color = '#0d1b3e'; } // Navy brand color
                        else if (tx.type === 'withdrawal') { icon = 'cash-outline'; color = '#DC2626'; }
                        else if (tx.description?.toLowerCase().includes('airtime')) { icon = 'phone-portrait-outline'; color = '#107C10'; }
                        else if (tx.description?.toLowerCase().includes('data')) { icon = 'wifi-outline'; color = '#0d1b3e'; }
                        else if (tx.type === 'payment') { icon = 'flash-outline'; color = '#f5a623'; }

                        return {
                            ...tx,
                            displayAmount: `${isIncome ? '+' : '-'}₦${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                            isIncome,
                            icon,
                            color,
                            dateObj: new Date(tx.created_at)
                        };
                    });
                    setHistory(mapped);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const getGroupedTransactions = () => {
        let filtered = history;
        if (filter === 'In') filtered = history.filter(tx => tx.isIncome);
        if (filter === 'Out') filtered = history.filter(tx => !tx.isIncome);

        const groups: { [key: string]: any[] } = {};
        const today = new Date().setHours(0,0,0,0);
        const yesterday = new Date(today - 86400000).setHours(0,0,0,0);

        filtered.forEach(tx => {
            const txDate = new Date(tx.dateObj).setHours(0,0,0,0);
            let title = tx.dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            if (txDate === today) title = 'Today';
            else if (txDate === yesterday) title = 'Yesterday';

            if (!groups[title]) groups[title] = [];
            groups[title].push(tx);
        });

        return Object.keys(groups).map(title => ({
            title,
            data: groups[title]
        }));
    };

    const sections = getGroupedTransactions();

    if (loading && history.length === 0) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <ActivityIndicator size="large" color="#0d1b3e" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="chevron-back" size={20} color="#0d1b3e" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>History</Text>
                <TouchableOpacity style={s.iconButton}>
                    <Ionicons name="filter" size={18} color="#0d1b3e" />
                </TouchableOpacity>
            </View>

            {/* Compact Summary Card with Brand Colors */}
            <View style={s.summaryContainer}>
                <LinearGradient 
                    colors={['#0d1b3e', '#142258']} 
                    style={s.summaryCard} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }}
                >
                    <View style={s.summaryContent}>
                        <View>
                            <Text style={s.summaryLabel}>Total Records</Text>
                            <Text style={s.summaryValue}>{history.length}</Text>
                        </View>
                        <View style={s.summaryIconBox}>
                            <Ionicons name="stats-chart" size={18} color="#f5a623" />
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Compact Filters */}
            <View style={s.filterRow}>
                {['All', 'In', 'Out'].map(f => (
                    <TouchableOpacity 
                        key={f} 
                        style={[s.filterChip, filter === f && s.filterChipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Compact Section List */}
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.listContent}
                onRefresh={fetchHistory}
                refreshing={loading}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={s.sectionHeader}>{title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={s.transactionCard}
                        onPress={() => router.push(`/transaction-details/${item.id}`)}
                        activeOpacity={0.6}
                    >
                        <View style={s.cardLeft}>
                            <View style={[s.txIcon, { backgroundColor: item.color + '10' }]}>
                                <Ionicons name={item.icon as any} size={18} color={item.color} />
                            </View>
                            <View style={s.txInfo}>
                                <Text style={s.txTitle} numberOfLines={1}>
                                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                </Text>
                                <Text style={s.txDesc} numberOfLines={1}>{item.description || item.reference}</Text>
                            </View>
                        </View>
                        <View style={s.cardRight}>
                            <Text style={[s.txAmount, item.isIncome ? s.amountPlus : s.amountMinus]}>
                                {item.displayAmount}
                            </Text>
                            <Text style={s.txTime}>
                                {item.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View style={s.emptyState}>
                        <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />
                        <Text style={s.emptyText}>No records found</Text>
                    </View>
                )}
            />
            <StatusBar style="dark" />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    summaryContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    summaryCard: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    summaryContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryLabel: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    summaryValue: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '800',
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipActive: {
        backgroundColor: '#0d1b3e',
        borderColor: '#0d1b3e',
    },
    filterText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        marginTop: 12,
        marginBottom: 8,
        marginLeft: 4,
    },
    transactionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    txIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    txInfo: {
        flex: 1,
        paddingRight: 8,
    },
    txTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 2,
    },
    txDesc: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '400',
    },
    cardRight: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 14,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 2,
    },
    amountPlus: {
        color: '#107C10',
    },
    amountMinus: {
        color: '#0d1b3e',
    },
    txTime: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 12,
    },
});
