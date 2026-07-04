import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BillsPricingManager() {
    const [electricityFee, setElectricityFee] = useState<string>('50');
    const [tvFee, setTvFee] = useState<string>('50');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch Global Markups
            const { data: settings } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['electricity_markup_fee', 'tv_markup_fee']);
                
            if (settings) {
                const elec = settings.find(s => s.key === 'electricity_markup_fee');
                const tv = settings.find(s => s.key === 'tv_markup_fee');
                
                if (elec?.value) setElectricityFee(elec.value);
                if (tv?.value) setTvFee(tv.value);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMarkup = async () => {
        const elecVal = parseFloat(electricityFee);
        const tvVal = parseFloat(tvFee);
        
        if (isNaN(elecVal) || elecVal < 0 || isNaN(tvVal) || tvVal < 0) {
            Alert.alert("Error", "Please enter a valid amount");
            return;
        }
        
        try {
            setSaving(true);
            
            const updates = [
                { key: 'electricity_markup_fee', value: electricityFee, updated_at: new Date().toISOString() },
                { key: 'tv_markup_fee', value: tvFee, updated_at: new Date().toISOString() }
            ];

            const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });
            
            if (error) throw error;
            
            Alert.alert("Success", "Bills pricing updated globally!");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update pricing");
        } finally {
            setSaving(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <LinearGradient colors={['#0d1b3e', '#142258']} className="pt-14 pb-6 px-4 rounded-b-3xl z-10 shadow-lg shadow-slate-300">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-lg font-bold">Bills Pricing</Text>
                    <View className="w-10" />
                </View>
            </LinearGradient>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#0d1b3e" />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        
                        {/* Info Card */}
                        <View className="bg-blue-50 p-4 rounded-2xl mb-6 border border-blue-100 flex-row items-start">
                            <Ionicons name="information-circle" size={24} color="#0056D2" className="mr-3 mt-1" />
                            <View className="flex-1 ml-2">
                                <Text className="font-bold text-blue-900 mb-1">How it works</Text>
                                <Text className="text-blue-700 text-sm leading-5">
                                    Set the extra fee you want to charge users for Electricity and Cable TV transactions. 
                                    This fee will be automatically added to the original API price.
                                </Text>
                            </View>
                        </View>

                        {/* Electricity Fee Configuration */}
                        <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm shadow-slate-200 border border-slate-100">
                            <View className="flex-row items-center mb-4">
                                <View className="w-10 h-10 rounded-xl bg-orange-50 items-center justify-center mr-3">
                                    <Ionicons name="flash" size={20} color="#f5a623" />
                                </View>
                                <View>
                                    <Text className="font-bold text-slate-800 text-base">Electricity Fee (₦)</Text>
                                    <Text className="text-slate-500 text-xs">Added to every power purchase</Text>
                                </View>
                            </View>
                            
                            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl h-14 px-4">
                                <Text className="font-bold text-slate-400 text-lg mr-2">₦</Text>
                                <TextInput 
                                    className="flex-1 text-slate-800 font-bold text-lg"
                                    value={electricityFee}
                                    onChangeText={setElectricityFee}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#cbd5e1"
                                />
                            </View>
                        </View>

                        {/* TV Fee Configuration */}
                        <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm shadow-slate-200 border border-slate-100">
                            <View className="flex-row items-center mb-4">
                                <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
                                    <Ionicons name="tv" size={20} color="#0056D2" />
                                </View>
                                <View>
                                    <Text className="font-bold text-slate-800 text-base">Cable TV Fee (₦)</Text>
                                    <Text className="text-slate-500 text-xs">Added to every TV subscription</Text>
                                </View>
                            </View>
                            
                            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl h-14 px-4">
                                <Text className="font-bold text-slate-400 text-lg mr-2">₦</Text>
                                <TextInput 
                                    className="flex-1 text-slate-800 font-bold text-lg"
                                    value={tvFee}
                                    onChangeText={setTvFee}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#cbd5e1"
                                />
                            </View>
                        </View>
                        
                    </ScrollView>

                    {/* Floating Save Button */}
                    <View className="absolute bottom-0 left-0 right-0 p-5 bg-white/90" style={{ paddingBottom: Math.max(20, insets.bottom) }}>
                        <TouchableOpacity 
                            onPress={handleSaveMarkup}
                            disabled={saving}
                            className={`h-14 rounded-2xl items-center justify-center shadow-lg shadow-blue-200 ${saving ? 'bg-slate-400' : 'bg-primary'}`}
                        >
                            {saving ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Save Configuration</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}
        </View>
    );
}
