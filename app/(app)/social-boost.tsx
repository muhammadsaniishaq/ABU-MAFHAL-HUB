import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

// Theme Configuration matching the rest of the app
const T = {
    primary: '#ec4899', 
    primaryLight: '#fbcfe8',
    navy: '#0d1b3e', // Main app navy
    white: '#ffffff',
    gray: '#f4f6fb', // Main app background
    text: '#334155',
    textLight: '#64748b',
    border: '#e2e8f0',
    gold: '#f5a623',
};

interface SMMService {
    service: string | number;
    name: string;
    category: string;
    rate: string;
    min: string | number;
    max: string | number;
}

export default function SocialBoostScreen() {
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<SMMService[]>([]);
    
    // Form State
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<SMMService | null>(null);
    const [link, setLink] = useState('');
    const [quantity, setQuantity] = useState('');
    
    // UI State
    const [serviceModal, setServiceModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);

    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            // Fetch Wallet Balance
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', session.user.id).single();
            if (profile) setWalletBalance(profile.balance || 0);

            // Fetch Services from Edge Function
            const { data, error } = await supabase.functions.invoke('smm-api', {
                body: { action: 'services' }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            setServices(data.services || []);
        } catch (error: any) {
            console.error("Error fetching services:", error);
            Alert.alert("Error", error.message || "Failed to load services");
        } finally {
            setLoading(false);
        }
    };

    // Group services by category
    const categories = useMemo(() => {
        const cats = Array.from(new Set(services.map(s => s.category.trim())));
        return cats.sort();
    }, [services]);

    const filteredServices = useMemo(() => {
        if (!selectedCategory) return [];
        return services.filter(s => s.category.trim() === selectedCategory);
    }, [services, selectedCategory]);

    const calculatePrice = () => {
        if (!selectedService || !quantity) return 0;
        const q = parseInt(quantity);
        if (isNaN(q)) return 0;
        const rate = parseFloat(selectedService.rate);
        return (rate / 1000) * q;
    };

    const totalPrice = calculatePrice();

    const handleSubmit = async () => {
        if (!selectedService) {
            Platform.OS === 'web' ? alert("Please select a service") : Alert.alert("Error", "Please select a service");
            return;
        }
        if (!link.trim()) {
            Platform.OS === 'web' ? alert("Please enter a valid link") : Alert.alert("Error", "Please enter a valid link");
            return;
        }
        
        const q = parseInt(quantity);
        if (isNaN(q) || q < parseInt(String(selectedService.min)) || q > parseInt(String(selectedService.max))) {
            const msg = `Quantity must be between ${selectedService.min} and ${selectedService.max}`;
            Platform.OS === 'web' ? alert(msg) : Alert.alert("Error", msg);
            return;
        }

        if (walletBalance < totalPrice) {
            const msg = "Please fund your wallet to place this order.";
            Platform.OS === 'web' ? alert(msg) : Alert.alert("Insufficient Balance", msg);
            return;
        }

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Are you sure you want to place this order for ₦${totalPrice.toLocaleString()}?`);
            if (confirmed) {
                placeOrder();
            }
        } else {
            Alert.alert(
                "Confirm Order",
                `Are you sure you want to place this order for ₦${totalPrice.toLocaleString()}?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Proceed", style: "default", onPress: placeOrder }
                ]
            );
        }
    };

    const placeOrder = async () => {
        try {
            setIsSubmitting(true);
            const { data, error } = await supabase.functions.invoke('smm-api', {
                body: {
                    action: 'place_order',
                    serviceId: selectedService?.service,
                    link: link.trim(),
                    quantity: quantity,
                    expectedPrice: totalPrice
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            const msg = `Your order has been placed successfully. Order ID: ${data.order}`;
            if (Platform.OS === 'web') {
                alert(msg);
                router.push('/social-orders');
            } else {
                Alert.alert(
                    "Success!",
                    msg,
                    [{ text: "OK", onPress: () => router.push('/social-orders') }]
                );
            }
            
            setLink('');
            setQuantity('');
            setSelectedService(null);
            setWalletBalance(prev => prev - totalPrice);
        } catch (error: any) {
            const msg = error.message || "Could not place order";
            Platform.OS === 'web' ? alert(msg) : Alert.alert("Failed", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPlatformIcon = (cat: string) => {
        const l = cat.toLowerCase();
        if (l.includes('instagram') || l.includes('ig')) return { name: 'logo-instagram', color: '#E1306C' };
        if (l.includes('facebook') || l.includes('fb')) return { name: 'logo-facebook', color: '#1877F2' };
        if (l.includes('youtube') || l.includes('yt')) return { name: 'logo-youtube', color: '#FF0000' };
        if (l.includes('tiktok') || l.includes('tik')) return { name: 'logo-tiktok', color: '#000000' };
        if (l.includes('twitter') || l.includes('x')) return { name: 'logo-twitter', color: '#1DA1F2' };
        if (l.includes('telegram') || l.includes('tg')) return { name: 'paper-plane', color: '#0088CC' };
        if (l.includes('spotify')) return { name: 'musical-notes', color: '#1DB954' };
        if (l.includes('linkedin')) return { name: 'logo-linkedin', color: '#0A66C2' };
        return { name: 'globe-outline', color: T.textLight };
    };

    if (loading) {
        return (
            <View className="flex-1 bg-slate-50 justify-center items-center">
                <ActivityIndicator size="large" color="#f5a623" />
                <Text className="text-slate-500 mt-3 text-xs font-bold uppercase tracking-widest">Loading Services...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Premium Header */}
            <LinearGradient 
                colors={['#0F172A', '#1E293B', '#334155']} 
                style={{ paddingTop: insets.top + 10, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View className="flex-row items-center justify-between mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/5">
                        <Ionicons name="chevron-back" size={20} color="#f5a623" />
                    </TouchableOpacity>
                    <Text className="text-white font-bold text-lg">Social Boost</Text>
                    <TouchableOpacity onPress={() => router.push('/social-orders')} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/5">
                        <Ionicons name="receipt-outline" size={18} color="#f5a623" />
                    </TouchableOpacity>
                </View>
                
                {/* Wallet Balance (Compact) */}
                <View className="bg-white/10 rounded-2xl p-3 border border-white/10 flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-[#f5a623]/20 items-center justify-center mr-3">
                        <Ionicons name="wallet" size={20} color="#f5a623" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-slate-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Available Balance</Text>
                        <Text className="text-white text-lg font-black tracking-tight">₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
                        <Text className="text-[#f5a623] text-[9px] font-bold">FUND</Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
                    
                    <Text className="text-slate-800 text-xs font-bold mb-3 ml-1 uppercase tracking-widest">Select Platform</Text>
                    
                    {/* Compact Grid */}
                    <View className="flex-row flex-wrap justify-between gap-y-3 mb-6">
                        {categories.map((cat, i) => {
                            const isSelected = selectedCategory === cat;
                            const icon = getPlatformIcon(cat);
                            return (
                                <TouchableOpacity 
                                    key={i} 
                                    onPress={() => {
                                        setSelectedCategory(cat);
                                        setSelectedService(null);
                                    }}
                                    activeOpacity={0.7}
                                    className={`w-[23%] aspect-square items-center justify-center rounded-2xl border ${isSelected ? 'bg-[#0F172A] border-[#0F172A]' : 'bg-white border-slate-200 shadow-sm shadow-slate-200/50'}`}
                                >
                                    <View className={`w-8 h-8 rounded-full items-center justify-center mb-1.5 ${isSelected ? 'bg-white/10' : 'bg-slate-50'}`}>
                                        <Ionicons name={icon.name as any} size={16} color={isSelected ? '#fff' : icon.color} />
                                    </View>
                                    <Text className={`text-[9px] font-bold text-center ${isSelected ? 'text-[#f5a623]' : 'text-slate-600'}`} numberOfLines={1}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Service Selection */}
                    {selectedCategory && (
                        <View className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50">
                            <Text className="text-slate-800 text-xs font-bold uppercase tracking-widest mb-4 ml-1">Order Details</Text>
                            
                            <View className="mb-4">
                                <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1.5 tracking-wider ml-1">Service Type</Text>
                                <TouchableOpacity 
                                    onPress={() => setServiceModal(true)}
                                    className="bg-slate-50 flex-row justify-between items-center rounded-xl px-4 py-3.5 border border-slate-200"
                                >
                                    <Text className={`text-xs flex-1 mr-2 leading-5 ${selectedService ? 'text-slate-800 font-bold' : 'text-slate-400 font-medium'}`} numberOfLines={2}>
                                        {selectedService ? selectedService.name : "Select a service..."}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            {selectedService && (
                                <>
                                    <View className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-4 flex-row justify-between items-center">
                                        <View>
                                            <Text className="text-blue-800 text-[10px] font-bold mb-0.5">Rate per 1000</Text>
                                            <Text className="text-blue-900 font-black text-sm">₦{parseFloat(selectedService.rate).toLocaleString()}</Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className="text-blue-600 text-[9px] font-bold mb-0.5">Limits</Text>
                                            <Text className="text-blue-800 text-[10px] font-bold">{selectedService.min} - {selectedService.max}</Text>
                                        </View>
                                    </View>

                                    <View className="mb-4">
                                        <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1.5 tracking-wider ml-1">Target Link</Text>
                                        <TextInput
                                            className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-800 font-medium border border-slate-200"
                                            placeholder="Paste profile or post link here"
                                            placeholderTextColor="#94a3b8"
                                            value={link}
                                            onChangeText={setLink}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </View>

                                    <View className="mb-5">
                                        <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1.5 tracking-wider ml-1">Quantity</Text>
                                        <TextInput
                                            className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-800 font-medium border border-slate-200"
                                            placeholder={`Minimum: ${selectedService.min}`}
                                            placeholderTextColor="#94a3b8"
                                            value={quantity}
                                            onChangeText={setQuantity}
                                            keyboardType="numeric"
                                        />
                                    </View>

                                    <View className="flex-row justify-between items-center bg-amber-50/50 p-4 rounded-xl border border-amber-100 mb-5">
                                        <Text className="text-amber-800 text-[10px] font-bold uppercase tracking-widest">Total Charge</Text>
                                        <Text className="text-amber-900 font-black text-xl">₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={handleSubmit}
                                        disabled={isSubmitting}
                                        className={`w-full py-4 rounded-xl items-center justify-center flex-row gap-2 ${isSubmitting ? 'bg-[#0F172A]/70' : 'bg-[#0F172A]'}`}
                                        style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <>
                                                <Ionicons name="flash" size={16} color="#f5a623" />
                                                <Text className="text-white text-sm font-bold">Place Order</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Compact Service Modal */}
            <Modal visible={serviceModal} animationType="slide" transparent={true}>
                <View className="flex-1 bg-[#0F172A]/60 justify-end">
                    <View className="bg-white rounded-t-3xl p-5 max-h-[75%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-slate-800 text-sm font-black uppercase tracking-widest">Select Service</Text>
                            <TouchableOpacity onPress={() => setServiceModal(false)} className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {filteredServices.map((srv, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    className="py-3 border-b border-slate-100 flex-row justify-between items-center"
                                    onPress={() => {
                                        setSelectedService(srv);
                                        setServiceModal(false);
                                    }}
                                >
                                    <Text className="text-slate-600 text-xs font-medium flex-1 mr-3 leading-5">{srv.name}</Text>
                                    <Text className="text-[#0F172A] font-black text-xs">₦{parseFloat(srv.rate).toLocaleString()}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
