import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SMMPricingManager() {
    const [markup, setMarkup] = useState<string>('20');
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch Global Markup
            const { data: setting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'smm_markup_percentage')
                .maybeSingle();
                
            if (setting && setting.value) {
                setMarkup(setting.value);
            }

            // Fetch Services from Edge Function (which includes original_rate)
            const { data: srvData, error } = await supabase.functions.invoke('smm-api', {
                body: { action: 'services' }
            });

            if (error) throw error;
            if (srvData?.error) throw new Error(srvData.error);
            
            if (srvData?.services) {
                setServices(srvData.services);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMarkup = async () => {
        const val = parseFloat(markup);
        if (isNaN(val) || val < 0) {
            Alert.alert("Error", "Please enter a valid percentage number");
            return;
        }
        
        try {
            setSaving(true);
            const { error } = await supabase.from('app_settings').upsert({
                key: 'smm_markup_percentage',
                value: markup,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            
            if (error) throw error;
            
            Alert.alert("Success", "Profit margin updated globally!");
            
            // Refresh to see updated rates
            fetchData();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update margin");
        } finally {
            setSaving(false);
        }
    };

    const categories = useMemo(() => {
        const cats = Array.from(new Set(services.map(s => s.category.trim())));
        return ['All', ...cats.sort()];
    }, [services]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.service).includes(searchQuery);
            const matchesCat = selectedCategory === 'All' || s.category.trim() === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [services, searchQuery, selectedCategory]);

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                {/* Premium Header */}
                <LinearGradient 
                    colors={['#0F172A', '#1E293B', '#334155']} 
                    style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View className="flex-row items-center justify-between mb-5">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/5">
                            <Ionicons name="chevron-back" size={20} color="#f5a623" />
                        </TouchableOpacity>
                        <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10 flex-row items-center gap-1.5">
                            <Ionicons name="sparkles" size={14} color="#f5a623" />
                            <Text className="text-[#f5a623] font-bold text-[10px] uppercase tracking-widest">SMM Pricing</Text>
                        </View>
                    </View>
                    
                    <Text className="text-white text-2xl font-black tracking-tighter mb-1">Global Margin</Text>
                    <Text className="text-slate-400 text-xs mb-5 font-medium">Set the profit percentage applied to all SMM services automatically.</Text>
                    
                    {/* Glassmorphism Markup Control */}
                    <View className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <Text className="text-slate-300 text-[10px] font-bold mb-3 uppercase tracking-widest">Markup Percentage</Text>
                        <View className="flex-row gap-3">
                            <View className="flex-1 flex-row items-center bg-black/40 rounded-xl px-4 border border-white/5 h-12">
                                <TextInput
                                    className="flex-1 text-white text-lg font-black py-0"
                                    value={markup}
                                    onChangeText={setMarkup}
                                    keyboardType="numeric"
                                    placeholderTextColor="#475569"
                                />
                                <View className="bg-[#f5a623]/20 px-2.5 py-0.5 rounded-md">
                                    <Text className="text-[#f5a623] text-xs font-black">%</Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                onPress={handleSaveMarkup}
                                disabled={saving}
                                className={`px-6 rounded-xl items-center justify-center h-12 ${saving ? 'bg-[#f5a623]/50' : 'bg-[#f5a623]'}`}
                                style={{ shadowColor: '#f5a623', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 }}
                            >
                                {saving ? <ActivityIndicator size="small" color="#0F172A" /> : <Text className="text-[#0F172A] text-sm font-black">Apply</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {/* Search & Filter */}
                <View className="bg-slate-50 z-10 pt-3 pb-2">
                    <View className="px-4 mb-3">
                        <View className="flex-row items-center bg-white rounded-xl px-4 border border-slate-200 h-11 shadow-sm shadow-slate-200/50">
                            <Ionicons name="search" size={16} color="#94a3b8" />
                            <TextInput
                                className="flex-1 ml-2.5 text-slate-800 text-sm font-medium"
                                placeholder="Search services or ID..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color="#cbd5e1" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4" contentContainerStyle={{ gap: 8, paddingRight: 32 }}>
                        {categories.map(cat => (
                            <TouchableOpacity 
                                key={cat} 
                                onPress={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl border ${selectedCategory === cat ? 'bg-[#0F172A] border-[#0F172A]' : 'bg-white border-slate-200 shadow-sm shadow-slate-200/50'}`}
                            >
                                <Text className={`${selectedCategory === cat ? 'text-[#f5a623] font-bold' : 'text-slate-500 font-semibold'} text-xs`}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Content Cards */}
                <ScrollView className="flex-1 px-4 pt-3" contentContainerStyle={{ paddingBottom: 100 }}>
                    {loading ? (
                        <View className="items-center justify-center py-10">
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text className="text-slate-400 mt-3 text-xs font-medium">Loading services...</Text>
                        </View>
                    ) : filteredServices.length === 0 ? (
                        <View className="items-center justify-center py-10 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50">
                            <Ionicons name="folder-open-outline" size={36} color="#cbd5e1" />
                            <Text className="text-slate-500 mt-3 text-xs font-medium">No services found</Text>
                        </View>
                    ) : (
                        filteredServices.map(srv => (
                            <View key={srv.service} className="bg-white p-4 rounded-2xl mb-4 shadow-sm shadow-slate-200/50 border border-slate-100">
                                <View className="flex-row justify-between items-center mb-3">
                                    <View className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 max-w-[70%]">
                                        <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-widest truncate" numberOfLines={1}>{srv.category}</Text>
                                    </View>
                                    <View className="bg-slate-100 px-2 py-1 rounded-md">
                                        <Text className="text-slate-400 text-[9px] font-bold">ID: {srv.service}</Text>
                                    </View>
                                </View>
                                
                                <Text className="text-slate-800 font-bold text-sm mb-3 leading-5">{srv.name}</Text>
                                
                                <View className="h-[1px] bg-slate-100 w-full mb-3" />
                                
                                <View className="flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-slate-400 text-[9px] uppercase font-bold mb-0.5 tracking-wider">Provider Cost</Text>
                                        <Text className="text-slate-600 font-bold text-xs">₦{parseFloat(srv.original_rate || '0').toFixed(2)}</Text>
                                    </View>
                                    
                                    <View className="items-center px-2">
                                        <View className="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/50 flex-row items-center gap-1">
                                            <Ionicons name="trending-up" size={10} color="#059669" />
                                            <Text className="text-emerald-600 font-bold text-[10px]">
                                                +₦{(parseFloat(srv.rate || '0') - parseFloat(srv.original_rate || '0')).toFixed(2)} Profit
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View className="items-end">
                                        <Text className="text-[#f5a623] text-[9px] uppercase font-bold mb-0.5 tracking-widest">User Pays</Text>
                                        <Text className="text-[#0F172A] font-black text-lg">₦{parseFloat(srv.rate || '0').toFixed(2)}</Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
