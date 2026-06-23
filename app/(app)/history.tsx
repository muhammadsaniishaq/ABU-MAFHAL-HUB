import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                        let icon = 'wallet';
                        let color = '#f5a623'; // Default gold

                        if (tx.type === 'transfer') { icon = 'send'; color = '#3b82f6'; }
                        else if (tx.type === 'withdrawal') { icon = 'cash'; color = '#ef4444'; }
                        else if (tx.description?.toLowerCase().includes('airtime')) { icon = 'phone-portrait'; color = '#8b5cf6'; }
                        else if (tx.description?.toLowerCase().includes('data')) { icon = 'wifi'; color = '#10b981'; }
                        else if (tx.type === 'payment') { icon = 'flash'; color = '#f59e0b'; }

                        return {
                            ...tx,
                            displayAmount: `${amount > 0 ? '+' : ''}₦${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                            isIncome: amount > 0,
                            icon,
                            color,
                            dateDisplay: new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        };
                    });
                    setHistory(mapped);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <ActivityIndicator size="large" color="#0d1b3e" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Minimalist Modern Header */}
            <View style={s.header}>
                <View>
                    <Text style={s.headerTitle}>Transaction History</Text>
                    <Text style={s.headerSubtitle}>Track your latest activities</Text>
                </View>
                <View style={s.iconWrapper}>
                    <Ionicons name="calendar-outline" size={22} color="#f5a623" />
                </View>
            </View>

            <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.listContent}
                onRefresh={fetchHistory}
                refreshing={loading}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={s.transactionCard}
                        onPress={() => router.push(`/transaction-details/${item.id}`)}
                    >
                        <View style={s.cardLeft}>
                            <View style={[s.txIcon, { backgroundColor: item.color + '15' }]}>
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
                            <View style={s.statusRow}>
                                <Text style={s.txDate}>{item.dateDisplay}</Text>
                                <View style={[s.statusDot, item.status === 'success' ? s.dotSuccess : s.dotPending]} />
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View style={s.emptyState}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="receipt-outline" size={40} color="#cbd5e1" />
                        </View>
                        <Text style={s.emptyText}>No transactions yet</Text>
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
        backgroundColor: '#f8f9fc',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#f8f9fc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        backgroundColor: '#f8f9fc',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0d1b3e',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
        marginTop: 4,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(245, 166, 35, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    transactionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    txIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    txInfo: {
        flex: 1,
        paddingRight: 10,
    },
    txTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0d1b3e',
        marginBottom: 2,
    },
    txDesc: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    cardRight: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 15,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    amountPlus: {
        color: '#10b981',
    },
    amountMinus: {
        color: '#0d1b3e',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    txDate: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        marginRight: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dotSuccess: {
        backgroundColor: '#10b981',
    },
    dotPending: {
        backgroundColor: '#f59e0b',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 15,
        color: '#94a3b8',
        fontWeight: '600',
    },
});
