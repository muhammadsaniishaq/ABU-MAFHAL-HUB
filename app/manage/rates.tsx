import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function RatesBoard() {
    const [rates, setRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('exchange_rates')
                .select('*')
                .order('pair', { ascending: true });

            if (error) throw error;
            setRates(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateLocalRate = (id: string, field: 'buy_rate' | 'sell_rate', delta: number) => {
        setRates(prev => prev.map(r => {
            if (r.id === id) {
                return { ...r, [field]: Number(r[field]) + delta };
            }
            return r;
        }));
    };

    const handlePushUpdate = async () => {
        try {
            setLoading(true);
            for (const rate of rates) {
                const { error } = await supabase
                    .from('exchange_rates')
                    .update({
                        buy_rate: rate.buy_rate,
                        sell_rate: rate.sell_rate,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', rate.id);
                if (error) throw error;
            }
            Alert.alert('Success', 'Market rates pushed to live production');
            fetchRates();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{
                title: 'Market Maker',
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff'
            }} />

            <ScrollView className="flex-1">
                <View className="p-6">
                    <Text className="text-red-500 font-mono text-xs mb-2">● LIVE FEED CONNECTED</Text>

                    {loading && rates.length === 0 ? (
                        <ActivityIndicator size="large" color="#4F46E5" />
                    ) : (
                        rates.map((rate, i) => (
                            <View key={rate.id} className="mb-6 bg-gray-900 rounded-xl p-6 border border-gray-800">
                                <View className="flex-row justify-between items-center mb-6">
                                    <Text className="text-2xl font-black text-white">{rate.pair}</Text>
                                    <View className={`flex-row items-center gap-1 ${rate.trend === 'up' ? 'bg-green-900/30' : 'bg-red-900/30'} px-2 py-1 rounded`}>
                                        <Ionicons name={rate.trend === 'up' ? 'trending-up' : 'trending-down'} size={16} color={rate.trend === 'up' ? '#4ADE80' : '#F87171'} />
                                        <Text className={rate.trend === 'up' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>0.4%</Text>
                                    </View>
                                </View>

                                <View className="flex-row gap-4">
                                    {/* BUY SIDE */}
                                    <View className="flex-1 bg-black rounded-lg p-4 border border-green-900/30 items-center">
                                        <Text className="text-slate-500 font-bold text-xs uppercase mb-2">We Buy At</Text>
                                        <Text className="text-2xl font-mono font-bold text-green-500">{Number(rate.buy_rate).toLocaleString()}</Text>
                                        <View className="flex-row mt-4 gap-4">
                                            <TouchableOpacity
                                                onPress={() => updateLocalRate(rate.id, 'buy_rate', -1)}
                                                className="bg-gray-800 w-8 h-8 rounded items-center justify-center"
                                            >
                                                <Ionicons name="remove" size={16} color="white" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => updateLocalRate(rate.id, 'buy_rate', 1)}
                                                className="bg-gray-800 w-8 h-8 rounded items-center justify-center"
                                            >
                                                <Ionicons name="add" size={16} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* SELL SIDE */}
                                    <View className="flex-1 bg-black rounded-lg p-4 border border-red-900/30 items-center">
                                        <Text className="text-slate-500 font-bold text-xs uppercase mb-2">We Sell At</Text>
                                        <Text className="text-2xl font-mono font-bold text-red-500">{Number(rate.sell_rate).toLocaleString()}</Text>
                                        <View className="flex-row mt-4 gap-4">
                                            <TouchableOpacity
                                                onPress={() => updateLocalRate(rate.id, 'sell_rate', -1)}
                                                className="bg-gray-800 w-8 h-8 rounded items-center justify-center"
                                            >
                                                <Ionicons name="remove" size={16} color="white" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => updateLocalRate(rate.id, 'sell_rate', 1)}
                                                className="bg-gray-800 w-8 h-8 rounded items-center justify-center"
                                            >
                                                <Ionicons name="add" size={16} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}

                    <TouchableOpacity
                        onPress={handlePushUpdate}
                        disabled={loading}
                        className="bg-indigo-600 py-4 rounded-xl items-center mt-4"
                    >
                        <Text className="text-white font-bold text-lg">{loading ? 'Pushing...' : 'Push Rate Update'}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
