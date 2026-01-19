import { View, Text, Switch, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function AdminSettings() {
    const [maintenance, setMaintenance] = useState(false);
    const [registrations, setRegistrations] = useState(true);
    const [usdNgnRate, setUsdNgnRate] = useState('1450.00');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('exchange_rates')
                .select('sell_rate')
                .eq('pair', 'USDT / NGN')
                .single();
            if (data) setUsdNgnRate(String(data.sell_rate));
        } catch (e) { }
    };

    const handleUpdateEconomics = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('exchange_rates')
                .update({ sell_rate: parseFloat(usdNgnRate), updated_at: new Date().toISOString() })
                .eq('pair', 'USDT / NGN');

            if (error) throw error;
            Alert.alert('Success', 'Economic parameters updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 p-6">
            <View className="mb-8">
                <Text className="text-slate-500 font-bold uppercase text-xs mb-4 ml-2">General Controls</Text>
                <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    <View className="flex-row items-center justify-between p-4 border-b border-gray-50">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center mr-3">
                                <Ionicons name="power" size={16} color="#EF4444" />
                            </View>
                            <Text className="font-bold text-slate-800">Maintenance Mode</Text>
                        </View>
                        <Switch value={maintenance} onValueChange={setMaintenance} trackColor={{ true: '#EF4444' }} />
                    </View>
                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                                <Ionicons name="person-add" size={16} color="#3B82F6" />
                            </View>
                            <Text className="font-bold text-slate-800">Allow Registrations</Text>
                        </View>
                        <Switch value={registrations} onValueChange={setRegistrations} trackColor={{ true: '#3B82F6' }} />
                    </View>
                </View>
            </View>

            <View className="mb-8">
                <Text className="text-slate-500 font-bold uppercase text-xs mb-4 ml-2">Economic Parameters</Text>
                <View className="bg-white rounded-2xl p-6 border border-gray-100 gap-4">
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">USD/NGN Exchange Rate (Live)</Text>
                        <View className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center">
                            <Text className="text-slate-400 font-bold mr-2">₦</Text>
                            <TextInput
                                value={usdNgnRate}
                                onChangeText={setUsdNgnRate}
                                className="flex-1 font-bold text-slate-800 text-lg"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Transaction Fee (%)</Text>
                        <View className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center">
                            <Text className="text-slate-400 font-bold mr-2">%</Text>
                            <TextInput defaultValue="1.5" className="flex-1 font-bold text-slate-800 text-lg" keyboardType="numeric" />
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleUpdateEconomics}
                        className="bg-slate-900 h-12 rounded-xl items-center justify-center mt-2"
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Update Economics</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            <View className="mb-12">
                <Text className="text-slate-500 font-bold uppercase text-xs mb-4 ml-2">API Configurations</Text>
                <View className="bg-white rounded-2xl p-6 border border-gray-100 gap-4">
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Paystack Secret Key</Text>
                        <TextInput defaultValue="sk_live_xxxx...94a" secureTextEntry className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" />
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Monnify API Key</Text>
                        <TextInput defaultValue="MK_PROD_xxxx...12b" secureTextEntry className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" />
                    </View>
                    <TouchableOpacity className="bg-blue-600 h-12 rounded-xl items-center justify-center mt-2">
                        <Text className="text-white font-bold">Save Keys</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}
