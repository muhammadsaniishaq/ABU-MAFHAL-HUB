import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { useEffect, useState } from 'react';

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
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) {
                    const mapped = data.map(tx => {
                        const amount = parseFloat(tx.amount.toString());
                        const isIncome = tx.type === 'deposit' || amount > 0; // Simplified
                        let icon = 'wallet';
                        let color = '#107C10';

                        if (tx.type === 'transfer') { icon = 'send'; color = '#0056D2'; }
                        else if (tx.type === 'withdrawal') { icon = 'cash'; color = '#EF4444'; }
                        else if (tx.description?.toLowerCase().includes('airtime')) { icon = 'phone-portrait'; color = '#F37021'; }
                        else if (tx.description?.toLowerCase().includes('data')) { icon = 'wifi'; color = '#008080'; }
                        else if (tx.type === 'payment') { icon = 'flash'; color = '#D97706'; }

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
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#0056D2" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header if not handled by tabs, but tabs usually handle it. 
                However, layout says headerShown: false, so we need a header here or in layout options.
                Layout has title: 'History' in options, but headerShown: false on Tabs.
                Wait, Tabs screenOptions says headerShown: false. 
                Individual screens have options.
                But usually we want a header. 
                I will add a custom header or SafeAreaView.
            */}
            <Stack.Screen options={{ headerShown: false }} />

            <View className="pt-12 px-6 pb-4 bg-white border-b border-gray-200">
                <Text className="text-2xl font-bold text-slate">History</Text>
            </View>

            <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                onRefresh={fetchHistory}
                refreshing={loading}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        className="flex-row justify-between items-center bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100"
                        onPress={() => router.push(`/transaction-details/${item.id}`)}
                    >
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: item.color + '20' }}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>
                            <View>
                                <Text className="font-bold text-gray-800 text-base">{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                                <Text className="text-sm text-gray-500" numberOfLines={1}>{item.description || item.reference}</Text>
                                <Text className="text-xs text-gray-400 mt-1">{item.dateDisplay}</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className={`font-bold text-base ${item.isIncome ? 'text-green-600' : 'text-red-500'}`}>
                                {item.displayAmount}
                            </Text>
                            <Text className={`text-xs mt-1 ${item.status === 'success' ? 'text-green-500' : 'text-yellow-600'}`}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View className="items-center justify-center pt-20">
                        <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                        <Text className="text-gray-400 mt-4 font-medium">No transactions yet</Text>
                    </View>
                )}
            />
            <StatusBar style="dark" />
        </View>
    );
}
