import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DynamicBanners from '../../components/DynamicBanners';
import { api } from '../../services/api';

import * as Clipboard from 'expo-clipboard';

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
    const [platformFilter, setPlatformFilter] = useState<string>('All');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<SMMService | null>(null);
    const [link, setLink] = useState('');
    const [quantity, setQuantity] = useState('');
    
    // UI State
    const [serviceModal, setServiceModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState(false);
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);

    // Custom Decorated Alert Modal State
    const [alertModal, setAlertModal] = useState<{
        visible: boolean;
        type: 'success' | 'error' | 'info';
        title: string;
        message: string;
        orderId?: string;
    }>({
        visible: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info', orderId?: string) => {
        setAlertModal({ visible: true, type, title, message, orderId });
    };

    const pasteFromClipboard = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (text && text.trim()) {
                setLink(text.trim());
            } else {
                showAlert("Clipboard Empty", "No text link found in your clipboard.", "info");
            }
        } catch (err) {
            console.error("Paste error:", err);
        }
    };

    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // First load from cache for instant display
            const cachedServices = await AsyncStorage.getItem('smm_services_cache');
            if (cachedServices) {
                setServices(JSON.parse(cachedServices));
                setLoading(false);
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            // Fetch Wallet Balance in background
            (async () => {
                try {
                    const { data } = await supabase.from('profiles').select('balance').eq('id', session.user.id).single();
                    if (data) setWalletBalance(data.balance || 0);
                } catch (err: any) {
                    console.error("Balance fetch error:", err);
                }
            })();

            // Fetch Services from Edge Function in background to get latest prices
            const data = await api.smm.invoke({ action: 'services' });

            if (data && data.services && data.services.length > 0) {
                setServices(data.services);
                await AsyncStorage.setItem('smm_services_cache', JSON.stringify(data.services));
            }
        } catch (error: any) {
            console.error("Error fetching services:", error);
            if (services.length === 0) {
                Alert.alert("Error", error.message || "Failed to load services");
            }
        } finally {
            setLoading(false);
        }
    };

    // Filter categories by selected platform filter tab
    const categories = useMemo(() => {
        const cats = Array.from(new Set(services.map(s => s.category.trim())));
        if (platformFilter === 'All') return cats.sort();
        return cats.filter(c => c.toLowerCase().includes(platformFilter.toLowerCase())).sort();
    }, [services, platformFilter]);

    const filteredServices = useMemo(() => {
        let list = services;
        if (selectedCategory) {
            list = list.filter(s => s.category.trim() === selectedCategory);
        }
        if (modalSearchQuery.trim()) {
            const q = modalSearchQuery.toLowerCase().trim();
            list = list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
        }
        return list;
    }, [services, selectedCategory, modalSearchQuery]);

    const calculatePrice = () => {
        if (!selectedService || !quantity) return 0;
        const q = parseInt(quantity);
        if (isNaN(q)) return 0;
        const rate = parseFloat(selectedService.rate);
        return (rate / 1000) * q;
    };

    const totalPrice = calculatePrice();

    // Link Platform Detector
    const linkDetector = useMemo(() => {
        if (!link.trim()) return null;
        const l = link.toLowerCase();
        if (l.includes('instagram.com') || l.includes('instagr.am')) return { platform: 'Instagram', icon: 'logo-instagram', color: '#E1306C' };
        if (l.includes('tiktok.com')) return { platform: 'TikTok', icon: 'logo-tiktok', color: '#000000' };
        if (l.includes('youtube.com') || l.includes('youtu.be')) return { platform: 'YouTube', icon: 'logo-youtube', color: '#FF0000' };
        if (l.includes('facebook.com') || l.includes('fb.watch')) return { platform: 'Facebook', icon: 'logo-facebook', color: '#1877F2' };
        if (l.includes('twitter.com') || l.includes('x.com')) return { platform: 'Twitter/X', icon: 'logo-twitter', color: '#1DA1F2' };
        if (l.includes('t.me') || l.includes('telegram.org')) return { platform: 'Telegram', icon: 'paper-plane', color: '#0088CC' };
        return { platform: 'Web', icon: 'link-outline', color: '#64748b' };
    }, [link]);

    const handleSubmit = () => {
        if (!selectedService) {
            showAlert("Service Required", "Please select a boost service type before proceeding.", "info");
            return;
        }
        if (!link.trim()) {
            showAlert("Target Link Required", "Please enter or paste a valid post or profile link.", "info");
            return;
        }
        
        const q = parseInt(quantity);
        if (isNaN(q) || q < parseInt(String(selectedService.min)) || q > parseInt(String(selectedService.max))) {
            showAlert("Invalid Quantity", `Quantity must be between ${selectedService.min} and ${selectedService.max}`, "info");
            return;
        }

        if (walletBalance < totalPrice) {
            showAlert("Insufficient Wallet Balance", "Please fund your wallet balance to launch this boost order.", "error");
            return;
        }

        setConfirmModal(true);
    };

    const placeOrder = async () => {
        try {
            setIsSubmitting(true);
            const data = await api.smm.invoke({
                action: 'place_order',
                serviceId: selectedService?.service,
                link: link.trim(),
                quantity: quantity,
                expectedPrice: totalPrice
            });

            showAlert("Boost Order Launched!", "Your social boost order has been submitted successfully.", "success", String(data.order || ''));
            
            setLink('');
            setQuantity('');
            setSelectedService(null);
            setWalletBalance(prev => prev - totalPrice);
        } catch (error: any) {
            const msg = error.message || "Could not place order";
            showAlert("Order Failed", msg, "error");
        } finally {
            setIsSubmitting(false);
            setConfirmModal(false);
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
            
            {/* Compact Ultra-Sleek Header */}
            <LinearGradient 
                colors={['#0F172A', '#1E293B', '#334155']} 
                style={{ paddingTop: insets.top + 6, paddingBottom: 12, paddingHorizontal: 16, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 items-center justify-center border border-white/5">
                        <Ionicons name="chevron-back" size={18} color="#f5a623" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-white font-bold text-base">Social Boost</Text>
                        <View className="flex-row items-center bg-white/10 px-2.5 py-0.5 rounded-full mt-0.5 border border-white/10">
                            <Ionicons name="wallet-outline" size={10} color="#f5a623" style={{ marginRight: 4 }} />
                            <Text className="text-[#f5a623] text-[10px] font-extrabold">₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/social-orders')} className="w-9 h-9 rounded-full bg-white/10 items-center justify-center border border-white/5">
                        <Ionicons name="receipt-outline" size={16} color="#f5a623" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 180, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
                    {/* Dynamic Banners */}
                    <DynamicBanners placement="social_boost" />
                    
                    {/* Horizontal Platform Filter Tabs */}
                    <Text className="text-slate-800 text-xs font-bold mb-2 ml-1 uppercase tracking-widest">Filter Platform</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
                        {[
                            { id: 'All', name: 'All', icon: 'sparkles' },
                            { id: 'instagram', name: 'Instagram', icon: 'logo-instagram' },
                            { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok' },
                            { id: 'youtube', name: 'YouTube', icon: 'logo-youtube' },
                            { id: 'facebook', name: 'Facebook', icon: 'logo-facebook' },
                            { id: 'twitter', name: 'Twitter / X', icon: 'logo-twitter' },
                            { id: 'telegram', name: 'Telegram', icon: 'paper-plane' },
                        ].map((tab) => {
                            const isActive = platformFilter === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    onPress={() => {
                                        setPlatformFilter(tab.id);
                                        setSelectedCategory(null);
                                        setSelectedService(null);
                                    }}
                                    activeOpacity={0.8}
                                    className={`flex-row items-center px-3.5 py-2 rounded-full mr-2 border ${isActive ? 'bg-[#0F172A] border-[#0F172A]' : 'bg-white border-slate-200'}`}
                                >
                                    <Ionicons name={tab.icon as any} size={13} color={isActive ? '#f5a623' : '#64748b'} style={{ marginRight: 6 }} />
                                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>{tab.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <Text className="text-slate-800 text-xs font-bold mb-3 ml-1 uppercase tracking-widest">Select Service Category</Text>
                    
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
                                            <Text className="text-blue-600 text-[9px] font-bold mb-0.5">Limits & Speed</Text>
                                            <Text className="text-blue-800 text-[10px] font-bold">{selectedService.min} - {selectedService.max} • ⚡ Instant</Text>
                                        </View>
                                    </View>

                                    <View className="mb-4">
                                        <View className="flex-row items-center justify-between mb-1.5">
                                            <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider ml-1">Target Link</Text>
                                            {linkDetector && (
                                                <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                    <Ionicons name={linkDetector.icon as any} size={10} color={linkDetector.color} style={{ marginRight: 4 }} />
                                                    <Text className="text-emerald-800 text-[9px] font-bold">{linkDetector.platform} Detected</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View className="flex-row items-center bg-slate-50 rounded-xl px-3 py-1 border border-slate-200">
                                            <TextInput
                                                className="flex-1 py-2 text-xs text-slate-800 font-medium"
                                                placeholder="Paste profile or post link here (e.g. https://...)"
                                                placeholderTextColor="#94a3b8"
                                                value={link}
                                                onChangeText={setLink}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                            />
                                            <TouchableOpacity 
                                                onPress={pasteFromClipboard}
                                                activeOpacity={0.7}
                                                className="bg-[#0F172A] px-2.5 py-1.5 rounded-lg border border-slate-700 flex-row items-center"
                                            >
                                                <Ionicons name="clipboard-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                                <Text className="text-[#f5a623] text-[10px] font-bold uppercase">Paste</Text>
                                            </TouchableOpacity>
                                        </View>
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
                                        
                                        {/* Quick Quantity Selector Chips */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-2">
                                            {['100', '500', '1000', '5000', '10000'].map((val) => (
                                                <TouchableOpacity
                                                    key={val}
                                                    onPress={() => setQuantity(val)}
                                                    activeOpacity={0.7}
                                                    className="bg-slate-100 px-3 py-1.5 rounded-lg mr-2 border border-slate-200"
                                                >
                                                    <Text className="text-slate-700 text-[10px] font-bold">+{parseInt(val).toLocaleString()}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    {/* CAC-Style Premium Summary Breakdown */}
                                    <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-5 shadow-lg shadow-slate-950/20">
                                        <View className="flex-row items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                                            <View className="flex-row items-center">
                                                <Ionicons name="receipt-outline" size={14} color="#f5a623" style={{ marginRight: 6 }} />
                                                <Text className="text-slate-300 text-[10px] uppercase font-bold tracking-widest">Order Summary</Text>
                                            </View>
                                            <View className="bg-[#f5a623]/10 px-2.5 py-0.5 rounded-full border border-[#f5a623]/30">
                                                <Text className="text-[#f5a623] text-[9px] font-extrabold uppercase">Instant Delivery</Text>
                                            </View>
                                        </View>

                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-slate-400 text-xs font-medium">Service Rate (per 1k)</Text>
                                            <Text className="text-slate-200 text-xs font-bold">₦{parseFloat(selectedService.rate).toLocaleString()}</Text>
                                        </View>

                                        <View className="flex-row justify-between items-center mb-2">
                                            <Text className="text-slate-400 text-xs font-medium">Target Quantity</Text>
                                            <Text className="text-slate-200 text-xs font-bold">{quantity || '0'}</Text>
                                        </View>

                                        <View className="flex-row justify-between items-center pt-3 border-t border-slate-800">
                                            <Text className="text-white text-xs font-black uppercase tracking-wider">Total Charge</Text>
                                            <Text className="text-[#f5a623] font-black text-xl">₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                        </View>
                                    </View>

                                    {/* CAC-Style Glowing Submit Button */}
                                    <TouchableOpacity 
                                        onPress={handleSubmit}
                                        disabled={isSubmitting}
                                        activeOpacity={0.85}
                                        className={`w-full py-4 px-5 rounded-2xl items-center justify-between flex-row ${isSubmitting ? 'bg-slate-800' : 'bg-[#0F172A]'}`}
                                        style={{ 
                                            borderWidth: 1, 
                                            borderColor: '#f5a623',
                                            shadowColor: '#f5a623', 
                                            shadowOffset: { width: 0, height: 4 }, 
                                            shadowOpacity: 0.25, 
                                            shadowRadius: 10, 
                                            elevation: 6 
                                        }}
                                    >
                                        {isSubmitting ? (
                                            <View className="w-full flex-row items-center justify-center py-0.5">
                                                <ActivityIndicator size="small" color="#f5a623" />
                                                <Text className="text-[#f5a623] text-sm font-bold ml-2 uppercase tracking-wider">Processing Order...</Text>
                                            </View>
                                        ) : (
                                            <>
                                                <View className="flex-row items-center">
                                                    <View className="w-8 h-8 rounded-full bg-[#f5a623]/20 items-center justify-center mr-3 border border-[#f5a623]/40">
                                                        <Ionicons name="flash" size={16} color="#f5a623" />
                                                    </View>
                                                    <View>
                                                        <Text className="text-white text-sm font-black uppercase tracking-wider">Submit Order Now</Text>
                                                        <Text className="text-slate-400 text-[9px] font-semibold">Instant Execution • Safe & Secure</Text>
                                                    </View>
                                                </View>
                                                <View className="bg-[#f5a623] px-3 py-1.5 rounded-xl">
                                                    <Text className="text-[#0F172A] text-xs font-extrabold">₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                                </View>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Decorated Service Selection Modal */}
            <Modal visible={serviceModal} animationType="slide" transparent={true}>
                <View className="flex-1 bg-[#0F172A]/70 justify-end">
                    <View className="bg-white rounded-t-[32px] p-6 max-h-[80%] border-t border-white/20">
                        {/* Modal Drag Handle */}
                        <View className="w-12 h-1 bg-slate-200 rounded-full self-center mb-4" />
                        
                        <View className="flex-row justify-between items-center mb-3">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-[#f5a623]/20 items-center justify-center mr-2">
                                    <Ionicons name="sparkles" size={16} color="#f5a623" />
                                </View>
                                <Text className="text-slate-900 text-base font-black tracking-tight">Select Boost Service</Text>
                            </View>
                            <TouchableOpacity onPress={() => setServiceModal(false)} className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input Bar */}
                        <View className="bg-slate-100 flex-row items-center px-3.5 py-2.5 rounded-xl border border-slate-200 mb-4">
                            <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                            <TextInput 
                                className="flex-1 text-xs text-slate-800 font-medium"
                                placeholder="Search services (e.g. Followers, Likes, Views)..."
                                placeholderTextColor="#94a3b8"
                                value={modalSearchQuery}
                                onChangeText={setModalSearchQuery}
                                autoCapitalize="none"
                            />
                            {modalSearchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setModalSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Category Badge Pill */}
                        {selectedCategory && (
                            <View className="flex-row items-center bg-slate-900 px-3 py-1.5 rounded-lg align-self-start mb-3 self-start">
                                <Text className="text-[#f5a623] text-[10px] font-bold uppercase tracking-wider">{selectedCategory}</Text>
                            </View>
                        )}

                        <FlatList 
                            data={filteredServices}
                            keyExtractor={(item, index) => item.service.toString() + index.toString()}
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 24 }}
                            ListEmptyComponent={() => (
                                <View className="py-10 items-center justify-center">
                                    <Ionicons name="search-outline" size={32} color="#cbd5e1" />
                                    <Text className="text-slate-400 text-xs font-semibold mt-2">No matching services found</Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const isSelected = selectedService?.service === item.service;
                                return (
                                    <TouchableOpacity 
                                        activeOpacity={0.8}
                                        className={`p-3.5 rounded-2xl mb-2.5 border flex-row items-center justify-between ${isSelected ? 'bg-slate-900 border-[#f5a623]' : 'bg-slate-50 border-slate-200/80'}`}
                                        onPress={() => {
                                            setSelectedService(item);
                                            setServiceModal(false);
                                        }}
                                    >
                                        <View className="flex-1 mr-3">
                                            <Text className={`text-xs font-bold leading-5 ${isSelected ? 'text-white' : 'text-slate-800'}`}>{item.name}</Text>
                                            <View className="flex-row items-center gap-2 mt-1.5">
                                                <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                    <Text className="text-emerald-700 text-[9px] font-bold">⚡ Instant</Text>
                                                </View>
                                                <Text className={`text-[10px] font-semibold ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    Min: {item.min} • Max: {item.max}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <View className="items-end">
                                            <View className="bg-[#0F172A] px-2.5 py-1 rounded-lg border border-slate-700">
                                                <Text className="text-[#f5a623] font-black text-xs">₦{parseFloat(item.rate).toLocaleString()}</Text>
                                            </View>
                                            <Text className={`text-[8px] uppercase font-bold mt-1 ${isSelected ? 'text-[#f5a623]' : 'text-slate-400'}`}>
                                                {isSelected ? '✓ Selected' : 'per 1,000'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Ultra-Decorated Order Confirmation Modal */}
            <Modal visible={confirmModal} animationType="fade" transparent={true}>
                <View className="flex-1 bg-[#0F172A]/80 justify-center items-center px-5">
                    <View className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-800 shadow-2xl shadow-black">
                        {/* Header Badge */}
                        <View className="items-center mb-5">
                            <View className="w-14 h-14 rounded-full bg-[#f5a623]/20 items-center justify-center mb-3 border border-[#f5a623]/40">
                                <Ionicons name={linkDetector?.icon as any || "flash"} size={26} color="#f5a623" />
                            </View>
                            <Text className="text-white text-lg font-black tracking-tight">Confirm Social Boost</Text>
                            <Text className="text-slate-400 text-xs font-medium text-center mt-1">Review your order details before launching</Text>
                        </View>

                        {/* Order Receipt Details */}
                        <View className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 mb-5">
                            <View className="mb-3 pb-3 border-b border-slate-800">
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Selected Service</Text>
                                <Text className="text-white text-xs font-bold leading-5">{selectedService?.name}</Text>
                            </View>

                            <View className="flex-row justify-between items-center mb-2.5">
                                <Text className="text-slate-400 text-xs font-medium">Target Link</Text>
                                <Text className="text-slate-200 text-xs font-bold max-w-[160px]" numberOfLines={1}>{link}</Text>
                            </View>

                            <View className="flex-row justify-between items-center mb-2.5">
                                <Text className="text-slate-400 text-xs font-medium">Quantity</Text>
                                <Text className="text-slate-200 text-xs font-bold">{quantity}</Text>
                            </View>

                            <View className="flex-row justify-between items-center mb-2.5">
                                <Text className="text-slate-400 text-xs font-medium">Delivery Speed</Text>
                                <Text className="text-emerald-400 text-xs font-bold">⚡ 0 - 15 Mins</Text>
                            </View>

                            <View className="flex-row justify-between items-center pt-3 border-t border-slate-800">
                                <Text className="text-white text-xs font-black uppercase">Total Payable</Text>
                                <Text className="text-[#f5a623] text-xl font-black">₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                            </View>
                        </View>

                        {/* Wallet Balance Check Pill */}
                        <View className="bg-slate-800/80 px-3.5 py-2.5 rounded-xl border border-slate-700/80 flex-row items-center justify-between mb-5">
                            <Text className="text-slate-300 text-xs font-semibold">Wallet After Order:</Text>
                            <Text className="text-slate-100 text-xs font-bold">₦{(walletBalance - totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>

                        {/* Modal Action Buttons */}
                        <View className="flex-row gap-3">
                            <TouchableOpacity 
                                onPress={() => setConfirmModal(false)}
                                disabled={isSubmitting}
                                className="flex-1 py-3.5 rounded-xl bg-slate-800 items-center justify-center border border-slate-700"
                            >
                                <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={placeOrder}
                                disabled={isSubmitting}
                                activeOpacity={0.8}
                                className="flex-[2] py-3.5 rounded-xl bg-[#f5a623] items-center justify-center flex-row"
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#0F172A" />
                                ) : (
                                    <>
                                        <Ionicons name="rocket" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                                        <Text className="text-[#0F172A] text-xs font-black uppercase tracking-wider">Confirm & Launch</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            {/* Custom Decorated Alert Modal (Replacing Native Alerts) */}
            <Modal visible={alertModal.visible} animationType="fade" transparent={true}>
                <View className="flex-1 bg-[#0F172A]/80 justify-center items-center px-6">
                    <View className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-800 shadow-2xl items-center">
                        <View className={`w-14 h-14 rounded-full items-center justify-center mb-4 border ${
                            alertModal.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40' :
                            alertModal.type === 'error' ? 'bg-rose-500/20 border-rose-500/40' : 'bg-amber-500/20 border-amber-500/40'
                        }`}>
                            <Ionicons 
                                name={
                                    alertModal.type === 'success' ? 'checkmark-circle' :
                                    alertModal.type === 'error' ? 'alert-circle' : 'information-circle'
                                } 
                                size={32} 
                                color={
                                    alertModal.type === 'success' ? '#10b981' :
                                    alertModal.type === 'error' ? '#f43f5e' : '#f5a623'
                                } 
                            />
                        </View>

                        <Text className="text-white text-lg font-black text-center mb-1.5 tracking-tight">{alertModal.title}</Text>
                        <Text className="text-slate-300 text-xs font-medium text-center mb-4 leading-5">{alertModal.message}</Text>

                        {alertModal.orderId && (
                            <View className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 flex-row items-center justify-between w-full mb-5">
                                <Text className="text-slate-400 text-xs font-semibold">Order ID: #{alertModal.orderId}</Text>
                                <TouchableOpacity 
                                    onPress={async () => {
                                        if (alertModal.orderId) {
                                            await Clipboard.setStringAsync(alertModal.orderId);
                                            showAlert("Copied!", "Order ID copied to clipboard.", "success");
                                        }
                                    }}
                                    className="flex-row items-center bg-white/10 px-2 py-1 rounded"
                                >
                                    <Ionicons name="copy-outline" size={12} color="#f5a623" style={{ marginRight: 3 }} />
                                    <Text className="text-[#f5a623] text-[9px] font-bold">Copy</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View className="flex-row gap-3 w-full">
                            {alertModal.type === 'success' ? (
                                <>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setAlertModal(prev => ({ ...prev, visible: false }));
                                        }}
                                        className="flex-1 py-3 rounded-xl bg-slate-800 items-center justify-center border border-slate-700"
                                    >
                                        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">Close</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => {
                                            setAlertModal(prev => ({ ...prev, visible: false }));
                                            router.push('/social-orders');
                                        }}
                                        className="flex-[1.5] py-3 rounded-xl bg-[#f5a623] items-center justify-center flex-row"
                                    >
                                        <Ionicons name="receipt" size={14} color="#0F172A" style={{ marginRight: 4 }} />
                                        <Text className="text-[#0F172A] text-xs font-black uppercase tracking-wider">View Orders</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity 
                                    onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                                    className="w-full py-3.5 rounded-xl bg-[#0F172A] border border-[#f5a623] items-center justify-center"
                                >
                                    <Text className="text-[#f5a623] text-xs font-black uppercase tracking-wider">OK, Got It</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
