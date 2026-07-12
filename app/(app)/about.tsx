import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function AboutScreen() {
    const router = useRouter();
    const { settings } = useAppSettings();

    const appVersion = '1.0.0';

    const handleSocial = (type: string) => {
        let url = '';
        switch (type) {
            case 'facebook': url = settings.support_facebook || `https://facebook.com/abumafhal`; break;
            case 'twitter': url = settings.support_twitter || `https://twitter.com/abumafhal0`; break;
            case 'instagram': url = settings.support_instagram || `https://instagram.com/abumafhal`; break;
            case 'telegram': url = settings.support_telegram || `https://t.me/abumafhal`; break;
            case 'website': url = `https://abumafhal.com.ng`; break;
        }
        if (url) Linking.openURL(url).catch(() => {});
    };

    return (
        <View className="flex-1 bg-[#f8fafc] relative">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* HIGHLY DECORATED LIGHT THEME TOP BANNER */}
            <LinearGradient 
                colors={['#0d1b3e', '#1a2951']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                className="absolute top-0 left-0 right-0 h-[380px] rounded-b-[50px] overflow-hidden shadow-lg shadow-[#0d1b3e]/30"
            >
                {/* Floating Decorative Orbs */}
                <View className="absolute -top-10 -right-20 w-64 h-64 rounded-full bg-[#f5a623]/20" />
                <View className="absolute top-32 -left-10 w-48 h-48 rounded-full bg-[#3b82f6]/20" />
                
                {/* Grid Overlay for texture */}
                <View className="absolute inset-0 opacity-10">
                    {[...Array(20)].map((_, i) => (
                        <View key={`h-${i}`} className="w-full h-[1px] bg-white mb-6" />
                    ))}
                </View>
            </LinearGradient>

            {/* HEADER */}
            <View className="pt-12 pb-4 px-6 z-10">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-2xl border border-white/20 items-center justify-center">
                        <Ionicons name="arrow-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <Text className="text-lg font-black text-white tracking-widest uppercase">About Us</Text>
                    <View className="w-10" />
                </View>
            </View>

            <ScrollView className="flex-1 z-10" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                
                {/* OVERLAPPING LOGO & BRANDING SECTION */}
                <View className="items-center mt-4 mb-10 px-6">
                    {/* Glowing Logo Container */}
                    <View className="w-32 h-32 bg-white rounded-[40px] shadow-xl shadow-[#0d1b3e]/30 items-center justify-center overflow-hidden mb-5 border-4 border-white">
                        <View className="absolute inset-0 bg-slate-50 opacity-50" />
                        <Image 
                            source={require('../../assets/images/logo-icon.png')} 
                            className="w-[85%] h-[85%]"
                            resizeMode="contain"
                        />
                    </View>
                    <Text className="text-3xl font-black text-white tracking-tight mb-2">Abu Mafhal Sub</Text>
                    
                    <View className="bg-white/10 px-4 py-2 rounded-full border border-white/20 flex-row items-center shadow-sm">
                        <Ionicons name="code-working" size={12} color="#f5a623" className="mr-2" />
                        <Text className="text-white font-bold text-[10px] uppercase tracking-wider">Version {appVersion} • Operational</Text>
                    </View>
                </View>

                {/* PREMIUM MAIN CONTENT CARD */}
                <View className="px-5 mb-8">
                    <LinearGradient
                        colors={['#ffffff', '#f8fafc']}
                        className="p-6 rounded-[32px] shadow-md shadow-slate-200 border border-slate-100"
                    >
                        {/* Who We Are */}
                        <View className="flex-row items-center mb-3">
                            <View className="w-10 h-10 rounded-2xl bg-[#0d1b3e]/5 items-center justify-center mr-3 border border-[#0d1b3e]/10">
                                <Ionicons name="information" size={20} color="#0d1b3e" />
                            </View>
                            <Text className="text-[#0d1b3e] font-black text-[15px] tracking-wide">Who We Are</Text>
                        </View>
                        <Text className="text-slate-500 font-medium text-[12px] leading-relaxed mb-6 pl-13">
                            Abu Mafhal Hub is Nigeria's premium, most reliable, and affordable digital utility platform. We provide seamless access to cheap Data, Airtime, Cable TV subscriptions, and Electricity bill payments. 
                        </Text>

                        {/* Our Mission */}
                        <View className="flex-row items-center mb-3">
                            <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center mr-3 border border-emerald-100">
                                <Ionicons name="leaf" size={18} color="#10b981" />
                            </View>
                            <Text className="text-[#0d1b3e] font-black text-[15px] tracking-wide">Our Mission</Text>
                        </View>
                        <Text className="text-slate-500 font-medium text-[12px] leading-relaxed mb-8 pl-13">
                            To bridge the gap in digital connectivity by delivering lightning-fast, highly secure, and cost-effective VTU services to millions of Nigerians, empowering individuals and businesses alike.
                        </Text>

                        {/* DECORATIVE FEATURES BADGES */}
                        <View className="flex-row justify-between bg-slate-50 p-2 rounded-2xl border border-slate-100">
                            <View className="items-center flex-1 py-2">
                                <View className="w-12 h-12 rounded-full bg-sky-100 items-center justify-center mb-2 shadow-sm shadow-sky-200">
                                    <Ionicons name="flash" size={18} color="#0ea5e9" />
                                </View>
                                <Text className="text-[#0d1b3e] font-black text-[10px] uppercase">Fast</Text>
                            </View>
                            <View className="w-[1px] bg-slate-200 my-2" />
                            <View className="items-center flex-1 py-2">
                                <View className="w-12 h-12 rounded-full bg-emerald-100 items-center justify-center mb-2 shadow-sm shadow-emerald-200">
                                    <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                                </View>
                                <Text className="text-[#0d1b3e] font-black text-[10px] uppercase">Secure</Text>
                            </View>
                            <View className="w-[1px] bg-slate-200 my-2" />
                            <View className="items-center flex-1 py-2">
                                <View className="w-12 h-12 rounded-full bg-[#f5a623]/20 items-center justify-center mb-2 shadow-sm shadow-[#f5a623]/30">
                                    <Ionicons name="headset" size={18} color="#f5a623" />
                                </View>
                                <Text className="text-[#0d1b3e] font-black text-[10px] uppercase">24/7</Text>
                            </View>
                        </View>

                    </LinearGradient>
                </View>

                {/* HIGH-END SOCIAL BANNER (LIGHT) */}
                <View className="px-5 mb-8">
                    <Text className="text-[#0d1b3e] font-black tracking-widest text-[10px] uppercase mb-4 ml-2">Connect Digitally</Text>
                    
                    <View className="bg-white rounded-[32px] shadow-sm shadow-slate-200 border border-slate-100 overflow-hidden">
                        
                        <TouchableOpacity onPress={() => handleSocial('website')} className="flex-row items-center p-5 border-b border-slate-50 active:bg-slate-50">
                            <View className="w-12 h-12 rounded-2xl bg-[#0d1b3e]/5 items-center justify-center mr-4 border border-[#0d1b3e]/10">
                                <Ionicons name="globe-outline" size={20} color="#0d1b3e" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#0d1b3e] font-black text-[13px] mb-0.5">Official Website</Text>
                                <Text className="text-slate-400 font-medium text-[10px]">www.abumafhal.com.ng</Text>
                            </View>
                            <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center">
                                <Ionicons name="arrow-forward" size={14} color="#0d1b3e" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleSocial('telegram')} className="flex-row items-center p-5 border-b border-slate-50 active:bg-slate-50">
                            <View className="w-12 h-12 rounded-2xl bg-[#0ea5e9]/10 items-center justify-center mr-4 border border-[#0ea5e9]/20">
                                <Ionicons name="paper-plane" size={20} color="#0ea5e9" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#0d1b3e] font-black text-[13px] mb-0.5">Telegram Community</Text>
                                <Text className="text-slate-400 font-medium text-[10px]">Join our active channel</Text>
                            </View>
                            <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center">
                                <Ionicons name="arrow-forward" size={14} color="#0ea5e9" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleSocial('facebook')} className="flex-row items-center p-5 active:bg-slate-50">
                            <View className="w-12 h-12 rounded-2xl bg-[#1877F2]/10 items-center justify-center mr-4 border border-[#1877F2]/20">
                                <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#0d1b3e] font-black text-[13px] mb-0.5">Facebook Page</Text>
                                <Text className="text-slate-400 font-medium text-[10px]">Follow for updates</Text>
                            </View>
                            <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center">
                                <Ionicons name="arrow-forward" size={14} color="#1877F2" />
                            </View>
                        </TouchableOpacity>

                    </View>
                </View>

                {/* COPYRIGHT */}
                <View className="items-center px-6 mt-2 mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#e11d48]/10 items-center justify-center mb-3">
                        <Ionicons name="heart" size={18} color="#e11d48" />
                    </View>
                    <Text className="text-[#0d1b3e] font-black text-[10px] uppercase tracking-widest text-center mb-1">
                        Made with love in Nigeria
                    </Text>
                    <Text className="text-slate-400 font-medium text-[9px] text-center uppercase tracking-widest">
                        © {new Date().getFullYear()} Abu Mafhal Hub. All rights reserved.
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
}
