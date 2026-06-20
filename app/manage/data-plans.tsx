import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
};

export default function ManageDataPlans() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [newPrice, setNewPrice] = useState('');

    // Markup configs states
    const [configs, setConfigs] = useState<any[]>([]);
    const [editingConfig, setEditingConfig] = useState<any | null>(null);
    const [newMarkupValue, setNewMarkupValue] = useState('');
    const [newMarkupType, setNewMarkupType] = useState<'fixed' | 'percentage'>('fixed');
    const [applyingMarkups, setApplyingMarkups] = useState(false);

    const networks = ['mtn', 'glo', 'airtel', '9mobile'];

    useEffect(() => {
        fetchConfigs();
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [selectedNetwork]);

    const fetchConfigs = async () => {
        try {
            const { data, error } = await supabase
                .from('data_configs')
                .select('*')
                .order('network', { ascending: true });
            if (error) throw error;
            if (data) setConfigs(data);
        } catch (e: any) {
            console.error("Error fetching configs:", e.message);
        }
    };

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
            if (data && data.success === false) {
                 throw new Error(data.error || 'Sync Failed');
            }
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

    const handleUpdateConfig = async () => {
        if (!editingConfig || !newMarkupValue) return;

        const val = parseFloat(newMarkupValue);
        if (isNaN(val) || val < 0) {
            Alert.alert('Error', 'Invalid markup value');
            return;
        }

        const { error } = await supabase
            .from('data_configs')
            .update({
                markup_type: newMarkupType,
                markup_value: val
            })
            .eq('id', editingConfig.id);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setEditingConfig(null);
            setNewMarkupValue('');
            fetchConfigs();
            Alert.alert('Success', 'Markup settings updated. Click "Apply Markup (Daura Riba)" to update existing plans.');
        }
    };

    const handleApplyMarkups = async () => {
        setApplyingMarkups(true);
        try {
            const config = configs.find(c => c.network === selectedNetwork);
            if (!config) {
                Alert.alert("Error", `No markup configuration found for ${selectedNetwork}`);
                return;
            }

            // Fetch current plans for selected network
            const { data: activePlans, error: fetchErr } = await supabase
                .from('data_plans')
                .select('*')
                .eq('network', selectedNetwork);

            if (fetchErr) throw fetchErr;
            if (!activePlans || activePlans.length === 0) {
                Alert.alert("Info", "No plans found for this network. Sync first.");
                return;
            }

            // Apply markup formulas in bulk
            const updatedPlans = activePlans.map(plan => {
                const cost = parseFloat(plan.cost_price);
                let selling = cost;
                if (config.markup_type === 'percentage') {
                    selling = cost * (1 + (parseFloat(config.markup_value) / 100));
                } else {
                    selling = cost + parseFloat(config.markup_value);
                }
                selling = Math.round(selling);

                return {
                    ...plan,
                    selling_price: selling
                };
            });

            // Push in a single bulk upsert query
            const { error: upsertErr } = await supabase
                .from('data_plans')
                .upsert(updatedPlans);

            if (upsertErr) throw upsertErr;

            Alert.alert("Success", `Daura Riba: Selling prices for ${selectedNetwork.toUpperCase()} plans updated successfully using ${config.markup_type === 'percentage' ? `${config.markup_value}%` : `₦${config.markup_value}`} markup.`);
            fetchPlans();
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to apply markup");
        } finally {
            setApplyingMarkups(false);
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
            <Stack.Screen options={{ 
                title: 'Data Pricing Dashboard', 
                headerTintColor: T.white,
                headerStyle: { backgroundColor: T.navy },
                headerTitleStyle: { fontWeight: '800', fontSize: 16 }
            }} />
            
            {/* Header Controls */}
            <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
                <View>
                    <Text className="text-sm font-extrabold text-[#0d1b3e]">Daura Riba & pricing</Text>
                    <Text className="text-[10px] text-slate-400">Configure margins and data plans</Text>
                </View>
                <TouchableOpacity 
                    onPress={handleSync} 
                    disabled={syncing}
                    className={`flex-row items-center px-3 py-1.5 rounded-lg ${syncing ? 'bg-gray-100' : 'bg-[#0d1b3e]'}`}
                >
                    {syncing ? (
                        <ActivityIndicator size="small" color={T.gold} className="mr-1.5" />
                    ) : (
                        <Ionicons name="refresh" size={13} color={T.white} className="mr-1.5" />
                    )}
                    <Text className={`text-[11px] font-bold ${syncing ? 'text-gray-400' : 'text-white'}`}>Sync ClubKonnect</Text>
                </TouchableOpacity>
            </View>

            {/* Markup Dashboard Card */}
            <View className="p-3 mx-4 mt-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <View className="flex-row justify-between items-center mb-2.5">
                    <View className="flex-row items-center">
                        <Ionicons name="trending-up" size={15} color={T.gold} className="mr-1.5" />
                        <Text className="font-extrabold text-xs text-[#0d1b3e]">Riba Configurations</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={handleApplyMarkups}
                        disabled={applyingMarkups}
                        style={{ backgroundColor: T.navy }}
                        className="flex-row items-center px-2.5 py-1.5 rounded-lg"
                    >
                        {applyingMarkups ? (
                            <ActivityIndicator size="small" color={T.gold} className="mr-1.5" />
                        ) : (
                            <Ionicons name="flash" size={11} color={T.gold} className="mr-1.5" />
                        )}
                        <Text className="text-white text-[10px] font-extrabold">Apply Riba ({selectedNetwork.toUpperCase()})</Text>
                    </TouchableOpacity>
                </View>
                <View className="flex-row justify-between gap-1.5">
                    {networks.map(net => {
                        const conf = configs.find(c => c.network === net) || { markup_type: 'fixed', markup_value: 50 };
                        return (
                            <TouchableOpacity
                                key={net}
                                onPress={() => {
                                    setEditingConfig(conf);
                                    setNewMarkupValue(conf.markup_value.toString());
                                    setNewMarkupType(conf.markup_type as any);
                                }}
                                className="flex-1 bg-slate-50 border border-slate-100 p-2 rounded-lg items-center justify-between"
                            >
                                <Text className="text-[9px] uppercase font-extrabold text-slate-400">{net}</Text>
                                <Text className="text-xs font-black text-[#0d1b3e] mt-0.5">
                                    {conf.markup_type === 'percentage' ? `${conf.markup_value}%` : `₦${conf.markup_value}`}
                                </Text>
                                <Text className="text-[8px] text-[#f5a623] mt-1 font-semibold underline">Configure</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Network Selector Tabs */}
            <View className="flex-row px-4 pt-3 pb-2 space-x-1.5">
                {networks.map(net => (
                    <TouchableOpacity
                        key={net}
                        onPress={() => setSelectedNetwork(net)}
                        style={{
                            backgroundColor: selectedNetwork === net ? T.navy : 'white',
                            borderColor: selectedNetwork === net ? T.navy : '#e2e8f0',
                        }}
                        className={`flex-1 py-1.5 rounded-lg border items-center`}
                    >
                        <Text className={`font-bold text-[11px] capitalize ${selectedNetwork === net ? 'text-white' : 'text-slate-600'}`}>{net}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* plans list */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={T.navy} />
                </View>
            ) : (
                <ScrollView className="flex-1 px-4">
                    {plans.map(plan => (
                        <View key={plan.id} className="bg-white p-2.5 rounded-xl mb-2 border border-slate-100 shadow-sm flex-row justify-between items-center">
                            <View className="flex-1 pr-2">
                                <View className="flex-row items-center mb-0.5">
                                    <Text className="font-extrabold text-slate-800 text-xs mr-1.5" numberOfLines={1}>{plan.name}</Text>
                                    <View className={`px-1.5 py-0.5 rounded ${plan.is_active ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                        <Text className={`${plan.is_active ? 'text-emerald-700' : 'text-red-700'} text-[8px] font-black uppercase`}>
                                            {plan.is_active ? 'Active' : 'Off'}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-1.5 mt-0.5">
                                    <Text className="text-slate-400 text-[10px]">Cost: ₦{plan.cost_price}</Text>
                                    <Text className="text-slate-300 text-[10px]">|</Text>
                                    <Text className="text-[#0d1b3e] font-extrabold text-xs">Selling: ₦{plan.selling_price}</Text>
                                    {plan.profit && (
                                        <>
                                            <Text className="text-slate-300 text-[10px]">|</Text>
                                            <Text className="text-emerald-600 text-[9px] font-bold">Riba: ₦{plan.profit}</Text>
                                        </>
                                    )}
                                </View>
                            </View>

                            <View className="flex-row items-center gap-1.5">
                                <TouchableOpacity 
                                    onPress={() => {
                                        setEditingPlan(plan);
                                        setNewPrice(plan.selling_price.toString());
                                    }}
                                    className="w-7 h-7 bg-slate-50 rounded-full items-center justify-center border border-slate-100"
                                >
                                    <Ionicons name="pencil" size={12} color={T.navy} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => toggleActive(plan)}
                                    className={`w-7 h-7 rounded-full items-center justify-center border ${plan.is_active ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}
                                >
                                    <Ionicons name={plan.is_active ? "eye-off" : "eye"} size={12} color={plan.is_active ? "#EF4444" : "#10B981"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    {plans.length === 0 && (
                        <View className="items-center py-8">
                            <Text className="text-gray-400 text-xs">No plans found. Sync from ClubKonnect.</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Edit Plan Price Modal */}
            {editingPlan && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} className="flex-1 justify-center items-center px-6">
                        <View className="bg-white w-full max-w-sm rounded-xl p-5 border border-slate-100 shadow-xl">
                            <Text className="font-extrabold text-sm text-[#0d1b3e] mb-1">Edit Price Manually</Text>
                            <Text className="text-slate-400 text-[11px] mb-3" numberOfLines={1}>{editingPlan.name}</Text>
                            
                            <View className="mb-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                 <Text className="text-[9px] text-slate-400 uppercase font-extrabold">Cost Price</Text>
                                 <Text className="text-sm font-extrabold text-slate-600">₦{editingPlan.cost_price}</Text>
                            </View>

                            <Text className="text-[9px] text-[#0d1b3e] uppercase font-extrabold mb-1">New Selling Price (₦)</Text>
                            <TextInput 
                                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm font-bold text-[#0d1b3e] mb-4"
                                keyboardType="numeric"
                                value={newPrice}
                                onChangeText={setNewPrice}
                                autoFocus
                            />

                            <View className="flex-row gap-3">
                                <TouchableOpacity 
                                    className="flex-1 h-9 bg-slate-100 rounded-lg items-center justify-center"
                                    onPress={() => setEditingPlan(null)}
                                >
                                    <Text className="font-bold text-slate-600 text-xs">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={{ backgroundColor: T.navy }}
                                    className="flex-1 h-9 rounded-lg items-center justify-center"
                                    onPress={handleUpdatePrice}
                                >
                                    <Text className="font-bold text-white text-xs">Save Price</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Edit Markup Configuration Modal */}
            {editingConfig && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} className="flex-1 justify-center items-center px-6">
                        <View className="bg-white w-full max-w-sm rounded-xl p-5 border border-slate-100 shadow-xl">
                            <View className="flex-row items-center mb-1">
                                <Ionicons name="settings-outline" size={16} color={T.gold} className="mr-1.5" />
                                <Text className="font-extrabold text-sm text-[#0d1b3e]">Markup (Riba) Config</Text>
                            </View>
                            <Text className="text-slate-400 text-[11px] mb-3">Adjust default markup for {editingConfig.network.toUpperCase()}</Text>
                            
                            {/* Markup Type Toggle */}
                            <Text className="text-[9px] text-slate-400 uppercase font-extrabold mb-1.5">Markup Type</Text>
                            <View className="flex-row gap-2 mb-3">
                                <TouchableOpacity 
                                    onPress={() => setNewMarkupType('fixed')}
                                    style={{
                                        backgroundColor: newMarkupType === 'fixed' ? T.navy : '#f1f5f9',
                                        borderColor: newMarkupType === 'fixed' ? T.navy : '#cbd5e1'
                                    }}
                                    className="flex-1 h-8 rounded-lg border items-center justify-center"
                                >
                                    <Text className={`font-bold text-xs ${newMarkupType === 'fixed' ? 'text-white' : 'text-slate-600'}`}>Fixed Amount (₦)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setNewMarkupType('percentage')}
                                    style={{
                                        backgroundColor: newMarkupType === 'percentage' ? T.navy : '#f1f5f9',
                                        borderColor: newMarkupType === 'percentage' ? T.navy : '#cbd5e1'
                                    }}
                                    className="flex-1 h-8 rounded-lg border items-center justify-center"
                                >
                                    <Text className={`font-bold text-xs ${newMarkupType === 'percentage' ? 'text-white' : 'text-slate-600'}`}>Percentage (%)</Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-[9px] text-[#0d1b3e] uppercase font-extrabold mb-1">
                                {newMarkupType === 'percentage' ? 'Markup Percentage (%)' : 'Markup Amount (₦)'}
                            </Text>
                            <TextInput 
                                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm font-bold text-[#0d1b3e] mb-4"
                                keyboardType="numeric"
                                value={newMarkupValue}
                                onChangeText={setNewMarkupValue}
                                autoFocus
                            />

                            <View className="flex-row gap-3">
                                <TouchableOpacity 
                                    className="flex-1 h-9 bg-slate-100 rounded-lg items-center justify-center"
                                    onPress={() => setEditingConfig(null)}
                                >
                                    <Text className="font-bold text-slate-600 text-xs">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={{ backgroundColor: T.navy }}
                                    className="flex-1 h-9 rounded-lg items-center justify-center"
                                    onPress={handleUpdateConfig}
                                >
                                    <Text className="font-bold text-white text-xs">Save Config</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}
