const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');

const fullAdminPricingCode = `import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function NinPricingBoard() {
    const [prices, setPrices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPrices();
    }, []);

    const fetchPrices = async () => {
        setLoading(true);
        try {
            // Self-healing database check: Auto-seed IPE Clearance pricing entries if missing
            const { data: ipeCheck, error: ipeError } = await supabase
                .from('service_pricing')
                .select('id')
                .eq('service_category', 'ipe');
            
            if (!ipeError && (!ipeCheck || ipeCheck.length === 0)) {
                const ipePricingDefaults = [
                    { id: 'ipe_inprocessing', service_category: 'ipe', name: 'InProcessing Error', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_still_processed', service_category: 'ipe', name: 'Still Being Processed', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_new_enrollment', service_category: 'ipe', name: 'New Enrollment For Tracking ID', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_invalid_tracking', service_category: 'ipe', name: 'Invalid Tracking ID', cost_price: 700, markup_price: 0 },
                    { id: 'ipe_slip_regular', service_category: 'ipe', name: 'Regular Slip (Clearance)', cost_price: 0, markup_price: 0 },
                    { id: 'ipe_slip_premium', service_category: 'ipe', name: 'Premium Slip (Clearance)', cost_price: 150, markup_price: 0 }
                ];
                await supabase.from('service_pricing').insert(ipePricingDefaults);
            }

            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .in('service_category', ['nin', 'ipe'])
                .order('name', { ascending: true });

            if (error) throw error;
            setPrices(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateMarkup = (id: string, newMarkup: string) => {
        const val = parseInt(newMarkup, 10);
        if (isNaN(val) && newMarkup !== '') return;

        setPrices(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, markup_price: newMarkup === '' ? 0 : val };
            }
            return p;
        }));
    };

    const updateCost = (id: string, newCost: string) => {
        const val = parseInt(newCost, 10);
        if (isNaN(val) && newCost !== '') return;

        setPrices(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, cost_price: newCost === '' ? 0 : val };
            }
            return p;
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            for (const item of prices) {
                const { error } = await supabase
                    .from('service_pricing')
                    .update({
                        cost_price: item.cost_price,
                        markup_price: item.markup_price,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
                if (error) throw error;
            }
            Alert.alert('Success', 'Verification & Clearance prices updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const ninPrices = prices.filter(p => p.service_category === 'nin');
    const ipePrices = prices.filter(p => p.service_category === 'ipe');

    const renderPriceCard = (item: any) => {
        const total = Number(item.cost_price) + Number(item.markup_price);
        return (
            <View key={item.id} className="mb-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text className="text-base font-black text-slate-800" numberOfLines={2}>{item.name}</Text>
                        <Text className="text-slate-400 text-[10px] mt-1">ID: {item.id}</Text>
                    </View>
                    <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        <Text className="text-[9px] font-bold text-emerald-600 uppercase mb-0.5">Total Price</Text>
                        <Text className="text-base font-black text-emerald-600">₦{total.toLocaleString()}</Text>
                    </View>
                </View>

                <View className="flex-row gap-3">
                    {/* Cost Price */}
                    <View className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-wider mb-1">Cost Price (Base)</Text>
                        <View className="flex-row items-center border-b border-slate-300 h-8">
                            <Text className="text-slate-600 font-bold text-base">₦</Text>
                            <TextInput
                                className="flex-1 text-base font-bold text-slate-700 ml-1 h-full"
                                value={String(item.cost_price)}
                                onChangeText={(val) => updateCost(item.id, val)}
                                keyboardType="number-pad"
                            />
                        </View>
                    </View>

                    {/* Profit / Markup */}
                    <View className="flex-[1.2] bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
                        <Text className="text-indigo-400 font-bold text-[9px] uppercase tracking-wider mb-1">Your Profit (Markup)</Text>
                        <View className="flex-row items-center border-b border-indigo-200 h-8">
                            <Text className="text-indigo-600 font-bold text-base">₦</Text>
                            <TextInput
                                className="flex-1 text-base font-black text-indigo-700 ml-1 h-full"
                                value={String(item.markup_price)}
                                onChangeText={(val) => updateMarkup(item.id, val)}
                                keyboardType="number-pad"
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{
                title: 'NIN & IPE Pricing',
                headerStyle: { backgroundColor: '#060d21' },
                headerTintColor: '#fff'
            }} />

            <ScrollView className="flex-1">
                <View className="p-4">
                    {loading ? (
                        <ActivityIndicator size="large" color="#060d21" className="mt-10" />
                    ) : prices.length === 0 ? (
                        <Text className="text-slate-500 text-center mt-10">No pricing data found.</Text>
                    ) : (
                        <View>
                            <Text className="text-slate-500 font-bold text-xs uppercase mb-4 tracking-widest">NIN Verification Slips</Text>
                            {ninPrices.map(renderPriceCard)}

                            <Text className="text-slate-500 font-bold text-xs uppercase my-6 tracking-widest">IPE Clearance Services</Text>
                            {ipePrices.map(renderPriceCard)}
                        </View>
                    )}

                    {!loading && prices.length > 0 && (
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            className={\`py-4 rounded-xl items-center mt-6 shadow-sm flex-row justify-center \${saving ? 'bg-[#060d21]/70' : 'bg-[#060d21]'}\`}
                        >
                            {saving && <ActivityIndicator color="#fff" size="small" className="mr-2" />}
                            <Text className="text-white font-bold text-lg tracking-wide">{saving ? 'Saving...' : 'Save Price Changes'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
`;

fs.writeFileSync(targetPath, fullAdminPricingCode, 'utf8');
console.log('Successfully updated app/manage/nin-pricing.tsx to include IPE clearance pricing options with auto-seeding!');
