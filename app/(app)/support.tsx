import { View, Text, TouchableOpacity, ScrollView, Linking, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAppSettings } from '../../hooks/useAppSettings';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';

export default function SupportScreen() {
    const { settings } = useAppSettings();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const handleContact = (type: 'whatsapp' | 'email' | 'phone' | 'facebook' | 'twitter' | 'instagram' | 'telegram') => {
        let url = '';
        const whatsappNumber = settings.support_whatsapp || '2348145853539';
        const emailAddress = settings.support_email || 'admin@abumafhal.com.ng';
        
        switch (type) {
            case 'whatsapp': url = `whatsapp://send?phone=${whatsappNumber}`; break;
            case 'email': url = `mailto:${emailAddress}`; break;
            case 'phone': url = `tel:+${whatsappNumber}`; break;
            case 'facebook': url = `https://facebook.com/abumafhal`; break;
            case 'twitter': url = `https://twitter.com/abumafhal0`; break;
            case 'instagram': url = `https://instagram.com/abumafhal`; break;
            case 'telegram': url = `https://t.me/abumafhal`; break;
        }
        Linking.openURL(url).catch(() => {});
    };

    const FAQs = [
        { q: "How do I fund my wallet?", a: "You can fund your wallet via Bank Transfer or Card Payment in the 'Fund Wallet' section." },
        { q: "What if my transaction fails?", a: "If a transaction fails but you are debited, the amount will be refunded to your wallet automatically within 24 hours." },
        { q: "Is my card information safe?", a: "Yes, we use Paystack for payment processing. We do not store your card details." },
        { q: "How do I upgrade my account?", a: "Navigate to the settings menu and provide your KYC details to upgrade your account limit." },
    ];

    return (
        <View className="flex-1 bg-[#f1f5f9] relative">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* ABSTRACT BACKGROUND DECORATIONS */}
            <View className="absolute top-0 left-0 right-0 h-80 bg-[#0d1b3e] rounded-b-[40px] overflow-hidden">
                <View className="absolute -top-10 -right-20 w-64 h-64 rounded-full bg-[#f5a623]/10" />
                <View className="absolute top-20 -left-10 w-40 h-40 rounded-full bg-[#3b82f6]/10" />
            </View>

            {/* HEADER */}
            <View className="pt-12 pb-2 px-6 z-10">
                <View className="flex-row items-center justify-between mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-full border border-white/20">
                        <Ionicons name="arrow-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <Text className="text-base font-black text-white tracking-wide">Help Center</Text>
                    <View className="w-9" />
                </View>

                {/* SEARCH BAR */}
                <View className="bg-white/10 border border-white/20 rounded-2xl h-11 flex-row items-center px-4 shadow-sm">
                    <Ionicons name="search" size={16} color="#f5a623" />
                    <TextInput 
                        className="flex-1 ml-3 text-white font-medium text-[11px]"
                        placeholder="Search for answers or topics..."
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <ScrollView className="flex-1 z-10" contentContainerStyle={{ paddingBottom: 50, paddingTop: 10 }} showsVerticalScrollIndicator={false}>
                
                {/* DECORATIVE TOP SECTION WITH AI CHAT */}
                <View className="px-5 mb-5">
                    <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/ai-chat')}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                            className="rounded-3xl p-4 shadow-sm border border-white/20 flex-row items-center justify-between"
                        >
                            <View className="flex-1 pr-4">
                                <View className="flex-row items-center mb-1.5">
                                    <View className="w-2 h-2 rounded-full bg-[#f5a623] mr-2 shadow-sm shadow-[#f5a623]" />
                                    <Text className="text-[#f5a623] font-bold text-[8px] uppercase tracking-widest bg-[#f5a623]/10 px-2 py-0.5 rounded-full">AI Assistant</Text>
                                </View>
                                <Text className="text-white font-black text-sm mb-1">Talk to Cotex AI</Text>
                                <Text className="text-slate-300 font-medium text-[9px] leading-3">Get instant, intelligent answers to your queries without waiting.</Text>
                            </View>
                            <View className="w-12 h-12 rounded-2xl bg-[#f5a623] items-center justify-center shadow-md shadow-[#f5a623]/30">
                                <Ionicons name="chatbubbles" size={20} color="#0d1b3e" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* GRID: TICKETS & COMMUNITY */}
                <View className="px-5 mb-6 flex-row justify-between">
                    <TouchableOpacity className="flex-1 bg-white p-4 rounded-[20px] shadow-sm shadow-[#0d1b3e]/5 border border-slate-100 mr-2 items-center" onPress={() => router.push('/manage/tickets')} activeOpacity={0.7}>
                        <View className="w-10 h-10 rounded-full bg-rose-50 items-center justify-center mb-2 border border-rose-100">
                            <Ionicons name="ticket" size={16} color="#e11d48" />
                        </View>
                        <Text className="text-[#0d1b3e] font-black text-[10px] mb-0.5">Open Ticket</Text>
                        <Text className="text-slate-400 font-medium text-[8px] text-center">Report an issue</Text>
                    </TouchableOpacity>

                    <TouchableOpacity className="flex-1 bg-white p-4 rounded-[20px] shadow-sm shadow-[#0d1b3e]/5 border border-slate-100 ml-2 items-center" onPress={() => handleContact('telegram')} activeOpacity={0.7}>
                        <View className="w-10 h-10 rounded-full bg-sky-50 items-center justify-center mb-2 border border-sky-100">
                            <Ionicons name="paper-plane" size={16} color="#0ea5e9" />
                        </View>
                        <Text className="text-[#0d1b3e] font-black text-[10px] mb-0.5">Community</Text>
                        <Text className="text-slate-400 font-medium text-[8px] text-center">Join Telegram</Text>
                    </TouchableOpacity>
                </View>

                {/* QUICK SUPPORT ACTIONS */}
                <View className="px-5 mb-8">
                    <View className="flex-row items-center justify-between mb-3 px-1">
                        <Text className="text-[#0d1b3e] font-black tracking-widest text-[9px] uppercase">Live Agents</Text>
                        <Text className="text-slate-400 font-bold text-[8px] uppercase tracking-widest bg-slate-200 px-2 py-0.5 rounded-full">Human Support</Text>
                    </View>
                    <View className="flex-row justify-between bg-white p-2 rounded-[24px] shadow-sm shadow-[#0d1b3e]/5 border border-slate-100">
                        <TouchableOpacity className="items-center py-2 px-1 flex-1" onPress={() => handleContact('whatsapp')} activeOpacity={0.7}>
                            <View className="w-10 h-10 rounded-full bg-[#25D366]/10 items-center justify-center mb-1">
                                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                            </View>
                            <Text className="text-[#0d1b3e] font-black text-[9px] uppercase tracking-wider">WhatsApp</Text>
                        </TouchableOpacity>
                        <View className="w-[1px] bg-slate-100 my-2" />
                        <TouchableOpacity className="items-center py-2 px-1 flex-1" onPress={() => handleContact('email')} activeOpacity={0.7}>
                            <View className="w-10 h-10 rounded-full bg-[#f5a623]/10 items-center justify-center mb-1">
                                <Ionicons name="mail" size={18} color="#f5a623" />
                            </View>
                            <Text className="text-[#0d1b3e] font-black text-[9px] uppercase tracking-wider">Email</Text>
                        </TouchableOpacity>
                        <View className="w-[1px] bg-slate-100 my-2" />
                        <TouchableOpacity className="items-center py-2 px-1 flex-1" onPress={() => handleContact('phone')} activeOpacity={0.7}>
                            <View className="w-10 h-10 rounded-full bg-[#0d1b3e]/5 items-center justify-center mb-1">
                                <Ionicons name="call" size={18} color="#0d1b3e" />
                            </View>
                            <Text className="text-[#0d1b3e] font-black text-[9px] uppercase tracking-wider">Call</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* FAQs */}
                <View className="px-5 mb-8">
                    <Text className="text-[#0d1b3e] font-black tracking-widest text-[9px] uppercase mb-3 px-1">Top Questions</Text>
                    <View className="bg-white rounded-[24px] shadow-sm shadow-[#0d1b3e]/5 border border-slate-100 overflow-hidden">
                        {FAQs.map((faq, index) => (
                            <View key={index} className={`p-4 ${index !== FAQs.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                <View className="flex-row items-start">
                                    <View className="w-6 h-6 rounded-full bg-[#f5a623]/10 items-center justify-center mr-3">
                                        <Text className="text-[#f5a623] font-black text-[9px]">Q</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-black text-[#0d1b3e] text-[11px] mb-1 leading-4">{faq.q}</Text>
                                        <Text className="text-slate-500 text-[10px] leading-relaxed font-medium">{faq.a}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* OFFICE LOCATION BANNER */}
                <View className="px-5 mb-8">
                    <View className="bg-[#0d1b3e] p-4 rounded-[24px] shadow-md shadow-[#0d1b3e]/20 flex-row items-center relative overflow-hidden">
                        {/* Decorative background lines */}
                        <View className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 translate-x-8" />
                        <View className="absolute right-10 top-0 bottom-0 w-16 bg-white/5 skew-x-12 translate-x-4" />
                        
                        <View className="w-10 h-10 rounded-full bg-[#f5a623] items-center justify-center mr-3 z-10">
                            <Ionicons name="location" size={18} color="#0d1b3e" />
                        </View>
                        <View className="flex-1 z-10">
                            <Text className="font-black text-white text-[10px] uppercase tracking-widest mb-0.5">Head Office</Text>
                            <Text className="text-slate-300 text-[9px] font-medium leading-4">No 1. Abu Mafhal Ltd, Goni Aji Street,{"\n"}Gashua, Yobe State, Nigeria.</Text>
                        </View>
                    </View>
                </View>

                {/* SOCIAL MEDIA DECORATIVE SECTION */}
                <View className="px-5 mb-6">
                    <View className="items-center">
                        <Text className="text-slate-400 font-black text-[8px] uppercase tracking-widest mb-3">Follow Us</Text>
                        <View className="flex-row justify-center items-center gap-x-3 bg-white p-2 rounded-full shadow-sm shadow-[#0d1b3e]/5 border border-slate-100">
                            <TouchableOpacity onPress={() => handleContact('facebook')} className="w-8 h-8 rounded-full bg-[#1877F2]/10 items-center justify-center">
                                <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleContact('twitter')} className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                                <Ionicons name="logo-twitter" size={14} color="#000000" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleContact('instagram')} className="w-8 h-8 rounded-full bg-[#E4405F]/10 items-center justify-center">
                                <Ionicons name="logo-instagram" size={14} color="#E4405F" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}
