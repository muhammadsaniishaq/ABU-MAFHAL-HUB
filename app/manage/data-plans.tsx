import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ManageDataPlans() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [newPrice, setNewPrice] = useState('');

    const networks = ['mtn', 'glo', 'airtel', '9mobile'];

    useEffect(() => {
        fetchPlans();
    }, [selectedNetwork]);

    const fetchPlans = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('data_plans')
            .select('*')
            .eq('network', selectedNetwork)
            .order('cost_price', { ascending: true });

        if (error) Alert.alert('Error', error.message);
        else setPlans(data || []);
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('sync-plans');
            if (error) throw error;
            Alert.alert('Success', data.message || 'Plans synced successfully');
            fetchPlans();
        } catch (err: any) {
            Alert.alert('Sync Failed', err.message);
        } finally {
            setSyncing(false);
        }
    };

    const handleUpdatePrice = async () => {
        if (!editingPlan || !newPrice) return;
        
        const price = parseFloat(newPrice);
        if (isNaN(price)) {
            Alert.alert('Error', 'Invalid price');
            return;
        }

        const { error } = await supabase
            .from('data_plans')
            .update({ selling_price: price })
            .eq('id', editingPlan.id);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setEditingPlan(null);
            setNewPrice('');
            fetchPlans(); // Refresh
        }
    };

    const toggleActive = async (plan: any) => {
        const { error } = await supabase
            .from('data_plans')
            .update({ is_active: !plan.is_active })
            .eq('id', plan.id);
            
        if (error) Alert.alert('Error', error.message);
        else fetchPlans();
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Data Plans', headerTintColor: '#0F172A' }} />
            
            {/* Header / Sync */}
            <View className="p-4 bg-white border-b border-gray-200 flex-row justify-between items-center">
                <Text className="text-lg font-bold text-slate-800">Manage Pricing</Text>
                <TouchableOpacity 
                    onPress={handleSync} 
                    disabled={syncing}
                    className={`flex-row items-center px-4 py-2 rounded-full ${syncing ? 'bg-gray-100' : 'bg-primary'}`}
                >
                    {syncing && <ActivityIndicator size="small" color="#0056D2" className="mr-2" />}
                    <Ionicons name="refresh" size={16} color={syncing ? '#666' : 'white'} className="mr-2" />
                    <Text className={syncing ? 'text-gray-500 font-bold' : 'text-white font-bold'}>Sync from ClubKonnect</Text>
                </TouchableOpacity>
            </View>

            {/* Network Tabs */}
            <View className="flex-row p-4 space-x-2">
                {networks.map(net => (
                    <TouchableOpacity
                        key={net}
                        onPress={() => setSelectedNetwork(net)}
                        className={`px-6 py-2 rounded-xl border ${selectedNetwork === net ? 'bg-slate-800 border-slate-800' : 'bg-white border-gray-200'}`}
                    >
                        <Text className={`font-bold capitalize ${selectedNetwork === net ? 'text-white' : 'text-slate-600'}`}>{net}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#0056D2" />
                </View>
            ) : (
                <ScrollView className="flex-1 px-4">
                    {plans.map(plan => (
                        <View key={plan.id} className="bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm flex-row justify-between items-center">
                            <View className="flex-1">
                                <View className="flex-row items-center mb-1">
                                    <Text className="font-bold text-slate-800 text-base mr-2">{plan.name}</Text>
                                    <View className={`px-2 py-0.5 rounded text-[10px] ${plan.is_active ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Text className={`${plan.is_active ? 'text-green-700' : 'text-red-700'} text-[10px] font-bold uppercase`}>
                                            {plan.is_active ? 'Active' : 'Inactive'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-gray-400 text-xs">Cost: ₦{plan.cost_price}</Text>
                                <Text className="text-primary font-bold text-lg">Selling: ₦{plan.selling_price}</Text>
                                {plan.profit && <Text className="text-emerald-600 text-xs font-medium">Profit: ₦{plan.profit}</Text>}
                            </View>

                            <View className="flex-row items-center gap-2">
                                <TouchableOpacity 
                                    onPress={() => {
                                        setEditingPlan(plan);
                                        setNewPrice(plan.selling_price.toString());
                                    }}
                                    className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center border border-blue-100"
                                >
                                    <Ionicons name="pencil" size={18} color="#0056D2" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => toggleActive(plan)}
                                    className={`w-10 h-10 rounded-full items-center justify-center border ${plan.is_active ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}
                                >
                                    <Ionicons name={plan.is_active ? "eye-off" : "eye"} size={18} color={plan.is_active ? "#EF4444" : "#10B981"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    {plans.length === 0 && (
                        <View className="items-center py-10">
                            <Text className="text-gray-400">No plans found. Sync to populate.</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Edit Modal / Overlay */}
            {editingPlan && (
                <View className="absolute inset-0 bg-black/60 justify-center items-center px-6">
                    <View className="bg-white w-full rounded-2xl p-6">
                        <Text className="font-bold text-xl text-slate-800 mb-2">Edit Price</Text>
                        <Text className="text-gray-500 mb-4">{editingPlan.name}</Text>
                        
                        <View className="mb-2">
                             <Text className="text-xs text-gray-400 uppercase font-bold mb-1">Cost Price</Text>
                             <Text className="text-lg font-medium text-slate-700">₦{editingPlan.cost_price}</Text>
                        </View>

                        <Text className="text-xs text-slate-500 uppercase font-bold mb-2 mt-2">New Selling Price (₦)</Text>
                        <TextInput 
                            className="w-full h-14 bg-gray-50 border border-gray-200 rounded-xl px-4 text-xl font-bold text-slate-800 mb-6"
                            keyboardType="numeric"
                            value={newPrice}
                            onChangeText={setNewPrice}
                            autoFocus
                        />

                        <View className="flex-row gap-4">
                            <TouchableOpacity 
                                className="flex-1 h-14 bg-gray-100 rounded-xl items-center justify-center"
                                onPress={() => setEditingPlan(null)}
                            >
                                <Text className="font-bold text-gray-600">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                className="flex-1 h-14 bg-primary rounded-xl items-center justify-center"
                                onPress={handleUpdatePrice}
                            >
                                <Text className="font-bold text-white">Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}
