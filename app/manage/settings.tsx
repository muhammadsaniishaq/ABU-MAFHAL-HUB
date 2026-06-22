import { View, Text, Switch, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function AdminSettings() {
    const [maintenance, setMaintenance] = useState(false);
    const [registrations, setRegistrations] = useState(true);
    const [usdNgnRate, setUsdNgnRate] = useState('1450.00');
    const [loading, setLoading] = useState(false);
    const [keysLoading, setKeysLoading] = useState(false);

    // API Keys state
    const [paystackKey, setPaystackKey] = useState('');
    const [monnifyKey, setMonnifyKey] = useState('');
    const [payvesselKey, setPayvesselKey] = useState('');
    const [payvesselSecret, setPayvesselSecret] = useState('');
    const [termiiKey, setTermiiKey] = useState('');
    const [flutterwaveKey, setFlutterwaveKey] = useState('');

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

            // Fetch keys from system_secrets (Only works if user is admin)
            const { data: secrets } = await supabase.from('system_secrets').select('key, value');
            if (secrets) {
                secrets.forEach((secret) => {
                    if (secret.key === 'PAYSTACK_SECRET_KEY') setPaystackKey(secret.value);
                    if (secret.key === 'MONNIFY_API_KEY') setMonnifyKey(secret.value);
                    if (secret.key === 'PAYVESSEL_API_KEY') setPayvesselKey(secret.value);
                    if (secret.key === 'PAYVESSEL_API_SECRET') setPayvesselSecret(secret.value);
                    if (secret.key === 'TERMII_API_KEY') setTermiiKey(secret.value);
                    if (secret.key === 'FLUTTERWAVE_SECRET_KEY') setFlutterwaveKey(secret.value);
                });
            }
        } catch (e) { }
    };

    const handleSaveKeys = async () => {
        setKeysLoading(true);
        try {
            const keysToSave = [
                { key: 'PAYSTACK_SECRET_KEY', value: paystackKey, description: 'Paystack Secret Key' },
                { key: 'MONNIFY_API_KEY', value: monnifyKey, description: 'Monnify API Key' },
                { key: 'PAYVESSEL_API_KEY', value: payvesselKey, description: 'Payvessel API Key' },
                { key: 'PAYVESSEL_API_SECRET', value: payvesselSecret, description: 'Payvessel API Secret' },
                { key: 'TERMII_API_KEY', value: termiiKey, description: 'Termii SMS API Key' },
                { key: 'FLUTTERWAVE_SECRET_KEY', value: flutterwaveKey, description: 'Flutterwave Secret Key' }
            ].filter(k => k.value && k.value.trim() !== '');

            if (keysToSave.length > 0) {
                const { error } = await supabase.from('system_secrets').upsert(keysToSave);
                if (error) throw error;
            }
            Alert.alert('Success', 'API keys have been securely saved.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setKeysLoading(false);
        }
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
                        <TextInput 
                            value={paystackKey}
                            onChangeText={setPaystackKey}
                            placeholder="sk_live_..." 
                            secureTextEntry 
                            className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" 
                        />
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Payvessel API Key</Text>
                        <TextInput 
                            value={payvesselKey}
                            onChangeText={setPayvesselKey}
                            placeholder="PVKEY-..." 
                            secureTextEntry 
                            className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" 
                        />
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Payvessel API Secret</Text>
                        <TextInput 
                            value={payvesselSecret}
                            onChangeText={setPayvesselSecret}
                            placeholder="PVSECRET-..." 
                            secureTextEntry 
                            className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" 
                        />
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Flutterwave Secret Key</Text>
                        <TextInput 
                            value={flutterwaveKey}
                            onChangeText={setFlutterwaveKey}
                            placeholder="FLWSECK-..." 
                            secureTextEntry 
                            className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" 
                        />
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Termii API Key</Text>
                        <TextInput 
                            value={termiiKey}
                            onChangeText={setTermiiKey}
                            placeholder="..." 
                            secureTextEntry 
                            className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" 
                        />
                    </View>
                    <View>
                        <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Monnify API Key</Text>
                        <TextInput 
                            value={monnifyKey}
                            onChangeText={setMonnifyKey}
                            placeholder="MK_PROD_..." 
                            secureTextEntry 
                            className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-slate-800 text-sm" 
                        />
                    </View>
                    <TouchableOpacity 
                        onPress={handleSaveKeys}
                        className="bg-blue-600 h-12 rounded-xl items-center justify-center mt-2"
                    >
                        {keysLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Save Keys</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}
