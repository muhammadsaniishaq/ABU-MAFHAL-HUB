import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function AirtimePricing() {
    const [networks, setNetworks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNetworks();
    }, []);

    const fetchNetworks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('airtime_configs')
                .select('*')
                .order('network', { ascending: true });

            if (error) throw error;
            setNetworks(data || []);
        } catch (error: any) {
            console.log("Error fetching airtime configs", error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateLocalNetwork = (id: string, field: 'cost_percentage' | 'sell_percentage', value: string) => {
        setNetworks(prev => prev.map(n => {
            if (n.id === id) {
                return { ...n, [field]: value };
            }
            return n;
        }));
    };

    const handleSave = async (id: string) => {
        const network = networks.find(n => n.id === id);
        if (!network) return;

        try {
            const { error } = await supabase
                .from('airtime_configs')
                .update({
                    cost_percentage: parseFloat(network.cost_percentage),
                    sell_percentage: parseFloat(network.sell_percentage),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            Alert.alert('Success', `Updated ${network.network}`);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{
                title: 'Airtime Pricing',
                headerStyle: { backgroundColor: '#fff' },
                headerTintColor: '#0f172a',
                headerShadowVisible: false
            }} />

            <ScrollView className="flex-1">
                <View className="p-6">
                    <View className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
                        <Text className="text-blue-800 text-sm">
                            Manage your airtime profitability. "Cost" is the discount you get from ClubKonnect. "Sell" is the discount you give to users.
                            {"\n\n"}
                            <Text className="font-bold">Profit = Cost % - Sell %</Text>
                        </Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#4F46E5" />
                    ) : (
                        networks.map((net) => {
                            const cost = parseFloat(net.cost_percentage) || 0;
                            const sell = parseFloat(net.sell_percentage) || 0;
                            const margin = cost - sell;
                            const isProfit = margin >= 0;

                            return (
                                <View key={net.id} className="mb-6 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                    <View className="flex-row justify-between items-center mb-6">
                                        <Text className="text-2xl font-black text-slate-800">{net.network}</Text>
                                        <View className={`px-3 py-1 rounded-full ${isProfit ? 'bg-green-100' : 'bg-red-100'}`}>
                                            <Text className={`${isProfit ? 'text-green-700' : 'text-red-700'} font-bold`}>
                                                Margin: {margin.toFixed(2)}%
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="flex-row gap-4">
                                        {/* Cost Price */}
                                        <View className="flex-1">
                                            <Text className="text-slate-500 font-bold text-xs uppercase mb-2">Cost Discount (%)</Text>
                                            <View className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                                <TextInput
                                                    className="text-slate-900 font-mono font-bold text-lg"
                                                    value={String(net.cost_percentage)}
                                                    onChangeText={(v) => updateLocalNetwork(net.id, 'cost_percentage', v)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>

                                        {/* Sell Price */}
                                        <View className="flex-1">
                                            <Text className="text-slate-500 font-bold text-xs uppercase mb-2">Sell Discount (%)</Text>
                                            <View className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                                <TextInput
                                                    className="text-slate-900 font-mono font-bold text-lg"
                                                    value={String(net.sell_percentage)}
                                                    onChangeText={(v) => updateLocalNetwork(net.id, 'sell_percentage', v)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => handleSave(net.id)}
                                        className="bg-indigo-600 mt-4 py-3 rounded-lg items-center"
                                    >
                                        <Text className="text-white font-bold">Update {net.network}</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                    
                    {!loading && networks.length === 0 && (
                        <View className="items-center justify-center py-10">
                            <Text className="text-slate-500">No airtime configurations found.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
