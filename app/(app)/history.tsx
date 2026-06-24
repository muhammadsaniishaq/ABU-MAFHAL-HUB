import { View, Text, SectionList, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
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
                        let color = '#f5a623';

                        if (tx.type === 'transfer') { icon = 'send-outline'; color = '#3b82f6'; }
                        else if (tx.type === 'withdrawal') { icon = 'cash-outline'; color = '#ef4444'; }
                        else if (tx.description?.toLowerCase().includes('airtime')) { icon = 'phone-portrait-outline'; color = '#8b5cf6'; }
                        else if (tx.description?.toLowerCase().includes('data')) { icon = 'wifi-outline'; color = '#10b981'; }
                        else if (tx.type === 'payment') { icon = 'flash-outline'; color = '#f59e0b'; }

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
            let title = tx.dateObj.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
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
                <ActivityIndicator size="large" color="#f5a623" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Ultra Modern Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="chevron-back" size={24} color="#0d1b3e" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Transactions</Text>
                <TouchableOpacity style={s.iconButton}>
                    <Ionicons name="options-outline" size={22} color="#0d1b3e" />
                </TouchableOpacity>
            </View>

            {/* Glassmorphic-like Summary Card */}
            <View style={s.summaryContainer}>
                <LinearGradient 
                    colors={['#0d1b3e', '#1e3a8a', '#2563eb']} 
                    style={s.summaryCard} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }}
                >
                    <View style={s.summaryTop}>
                        <View style={s.summaryIconBox}>
                            <Ionicons name="bar-chart" size={20} color="#fff" />
                        </View>
                        <Text style={s.summaryLabel}>Total Records</Text>
                    </View>
                    <Text style={s.summaryValue}>{history.length}</Text>
                    <Text style={s.summarySub}>Lifetime transaction history</Text>
                    
                    {/* Decorative Elements */}
                    <View style={s.circleDecoration1} />
                    <View style={s.circleDecoration2} />
                </LinearGradient>
            </View>

            {/* Smooth Filters */}
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

            {/* Clean Section List */}
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.listContent}
                onRefresh={fetchHistory}
                refreshing={loading}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section: { title } }) => (
                    <View style={s.sectionHeaderContainer}>
                        <Text style={s.sectionHeader}>{title}</Text>
                        <View style={s.sectionLine} />
                    </View>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={s.transactionCard}
                        onPress={() => router.push(`/transaction-details/${item.id}`)}
                        activeOpacity={0.7}
                    >
                        <View style={s.cardLeft}>
                            <View style={[s.txIcon, { backgroundColor: item.color + '15' }]}>
                                <Ionicons name={item.icon as any} size={22} color={item.color} />
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
                        <View style={s.emptyIcon}>
                            <Ionicons name="document-text-outline" size={40} color="#cbd5e1" />
                        </View>
                        <Text style={s.emptyText}>No records found</Text>
                        <Text style={s.emptySubText}>Your transaction history will appear here.</Text>
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
        backgroundColor: '#F3F6F8', // Lighter, cleaner background
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#F3F6F8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0d1b3e',
        letterSpacing: -0.5,
    },
    summaryContainer: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    summaryCard: {
        borderRadius: 28,
        padding: 24,
        shadowColor: '#1e3a8a',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    summaryTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    summaryIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    summaryLabel: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '600',
    },
    summaryValue: {
        color: '#ffffff',
        fontSize: 38,
        fontWeight: '900',
        marginBottom: 6,
        letterSpacing: -1,
    },
    summarySub: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: '500',
    },
    circleDecoration1: {
        position: 'absolute',
        top: -30,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    circleDecoration2: {
        position: 'absolute',
        bottom: -40,
        right: 40,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    filterChip: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: '#ffffff',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    filterChipActive: {
        backgroundColor: '#0d1b3e',
        borderColor: '#0d1b3e',
    },
    filterText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '700',
    },
    filterTextActive: {
        color: '#ffffff',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '800',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginRight: 10,
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    transactionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderRadius: 24,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    txIcon: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    txInfo: {
        flex: 1,
        paddingRight: 10,
    },
    txTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    txDesc: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    cardRight: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 17,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 6,
    },
    amountPlus: {
        color: '#10b981',
    },
    amountMinus: {
        color: '#0f172a',
    },
    txTime: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyIcon: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    emptyText: {
        fontSize: 18,
        color: '#0f172a',
        fontWeight: '800',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
});
