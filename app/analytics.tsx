import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../services/supabase';
import { useEffect, useState } from 'react';

export default function AnalyticsScreen() {
    const [spendingData, setSpendingData] = useState<any[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState('');

    useEffect(() => {
        fetchSpendingData();
    }, []);

    const fetchSpendingData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            setCurrentMonth(now.toLocaleString('default', { month: 'long' }));

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .neq('type', 'deposit') // Only spending
                .gte('created_at', startOfMonth);

            if (data) {
                const categories = {
                    'Airtime & Data': { amount: 0, color: '#F37021', icon: 'phone-portrait' },
                    'Transfers': { amount: 0, color: '#0056D2', icon: 'send' },
                    'Bills': { amount: 0, color: '#D97706', icon: 'flash' },
                    'Other': { amount: 0, color: '#8B5CF6', icon: 'cart' },
                };

                let total = 0;
                data.forEach(tx => {
                    const amount = parseFloat(tx.amount);
                    total += amount;
                    if (tx.description?.toLowerCase().includes('airtime') || tx.description?.toLowerCase().includes('data')) {
                        categories['Airtime & Data'].amount += amount;
                    } else if (tx.type === 'transfer') {
                        categories['Transfers'].amount += amount;
                    } else if (tx.type === 'payment') {
                        categories['Bills'].amount += amount;
                    } else {
                        categories['Other'].amount += amount;
                    }
                });

                const formattedData = Object.keys(categories).map(key => {
                    const item = (categories as any)[key];
                    return {
                        category: key,
                        amount: `₦${item.amount.toLocaleString()}`,
                        rawAmount: item.amount,
                        percent: total > 0 ? item.amount / total : 0,
                        color: item.color,
                        icon: item.icon
                    };
                }).filter(item => item.rawAmount > 0);

                setSpendingData(formattedData);
                setTotalSpent(total);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#0056D2" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Insights', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="items-center mb-8">
                    <Text className="text-gray-500 mb-1">Total Spent ({currentMonth})</Text>
                    <Text className="text-slate text-3xl font-bold">₦{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>

                {/* Mock Chart Visualization */}
                <View className="h-4 bg-gray-100 rounded-full flex-row overflow-hidden mb-8 w-full">
                    {spendingData.map((item, index) => (
                        <View
                            key={index}
                            style={{ width: `${item.percent * 100}%`, backgroundColor: item.color }}
                            className="h-full"
                        />
                    ))}
                </View>

                {/* Breakdown */}
                <Text className="font-bold text-slate text-lg mb-4">Category Breakdown</Text>
                {spendingData.map((item, index) => (
                    <View key={index} className="flex-row items-center justify-between py-4 border-b border-gray-50">
                        <View className="flex-row items-center">
                            <View className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }} />
                            <Text className="text-gray-700 font-medium">{item.category}</Text>
                        </View>
                        <View className="items-end">
                            <Text className="font-bold text-slate">{item.amount}</Text>
                            <Text className="text-gray-400 text-xs">{(item.percent * 100).toFixed(0)}%</Text>
                        </View>
                    </View>
                ))}

                <View className="bg-blue-50 p-6 rounded-2xl mt-8">
                    <View className="flex-row gap-3 mb-2">
                        <Ionicons name="information-circle" size={24} color="#0056D2" />
                        <Text className="text-primary font-bold text-lg">Spending Tip</Text>
                    </View>
                    <Text className="text-gray-600 leading-6">
                        {totalSpent > 0
                            ? `You've spent ₦${totalSpent.toLocaleString()} so far this month. Keep track of your ${spendingData[0]?.category.toLowerCase() || 'spending'} to stay within budget.`
                            : "No spending recorded yet for this month. Your insights will appear here once you start using your wallet."}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
