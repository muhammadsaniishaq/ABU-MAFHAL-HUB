import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, UIManager, Platform, Share } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const termsData = [
    {
        icon: 'document-text',
        title: 'Introduction',
        content: 'Welcome to Abu Mafhal Sub. By using our app, you agree to these terms.'
    },
    {
        icon: 'flash',
        title: 'Our Services',
        content: 'We provide VTU services including Airtime, Data, and Cable TV.'
    },
    {
        icon: 'shield-checkmark',
        title: 'User Responsibility',
        content: 'You are responsible for maintaining your account credentials.'
    },
    {
        icon: 'card',
        title: 'Payments',
        content: 'All payments are final. Refunds only for failed transactions.'
    },
    {
        icon: 'close-circle',
        title: 'Termination',
        content: 'We reserve the right to suspend your account for violations.'
    }
];

export default function TermsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
    const [isChecked, setIsChecked] = useState(false);
    const [alreadyAccepted, setAlreadyAccepted] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const checkAcceptance = async () => {
                try {
                    const accepted = await AsyncStorage.getItem('@terms_accepted');
                    if (accepted === 'true') {
                        setAlreadyAccepted(true);
                        setIsChecked(true);
                    }
                } catch (error) {
                    console.log("Error reading terms status", error);
                }
            };
            checkAcceptance();
        }, [])
    );

    const toggleAccordion = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const handleShare = async () => {
        try {
            await Share.share({ message: 'Abu Mafhal Sub - Terms & Conditions' });
        } catch (error) {}
    };

    const handleAccept = async () => {
        if (isChecked || alreadyAccepted) {
            try {
                await AsyncStorage.setItem('@terms_accepted', 'true');
            } catch (error) {
                console.log("Error saving terms status", error);
            }
            router.back();
        }
    };

    return (
        <View className="flex-1 bg-[#f0f4f8] relative">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* HIGHLY DECORATED SHAPED BACKGROUND HEADER */}
            <View className="absolute top-0 left-0 right-0 h-[260px] overflow-hidden rounded-b-[60px] shadow-lg shadow-[#0d1b3e]/20" style={{ elevation: 10 }}>
                <LinearGradient 
                    colors={['#0d1b3e', '#1e3a8a']} 
                    start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                    className="absolute inset-0" 
                />
                
                {/* Floating Decorative Shapes */}
                <View className="absolute -top-10 -right-20 w-56 h-56 rounded-full bg-[#f5a623]/30 blur-[40px]" />
                <View className="absolute top-20 -left-16 w-40 h-40 rounded-full bg-[#3b82f6]/30 blur-[30px]" />
                
                {/* Abstract Line Grid */}
                <View className="absolute inset-0 opacity-10">
                    {[...Array(6)].map((_, i) => (
                        <View key={`line-${i}`} className="w-full h-[1px] bg-white mb-6" />
                    ))}
                </View>
            </View>

            {/* HEADER FOR DECORATED TOP */}
            <View 
                style={{ paddingTop: Math.max(insets.top + 10, 40) }} 
                className="pb-2 px-4 z-10 flex-row items-center justify-between"
            >
                <TouchableOpacity onPress={() => router.back()} className="w-7 h-7 bg-white/20 rounded-full items-center justify-center border border-white/30 backdrop-blur-md">
                    <Ionicons name="arrow-back" size={12} color="#ffffff" />
                </TouchableOpacity>
                <Text className="text-[10px] font-black text-white tracking-widest uppercase shadow-sm">Legal Terms</Text>
                <TouchableOpacity onPress={handleShare} className="w-7 h-7 bg-white/20 rounded-full items-center justify-center border border-white/30 backdrop-blur-md">
                    <Ionicons name="share-social" size={12} color="#f5a623" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                className="flex-1 z-10" 
                contentContainerStyle={{ paddingBottom: 30, paddingTop: 10 }} 
                showsVerticalScrollIndicator={false}
            >
                {/* MICRO HERO CARD FLOATING OVER THE DECORATED BACKGROUND */}
                <View className="mx-4 mb-5 mt-4">
                    <LinearGradient
                        colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
                        start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                        className="p-3 rounded-[16px] border border-white/50 shadow-md shadow-black/10 flex-row items-center relative overflow-hidden"
                    >
                        {/* Inner decorative shape */}
                        <View className="absolute -right-4 -top-4 w-16 h-16 bg-[#f5a623]/10 rounded-full blur-md" />
                        
                        <View className="w-8 h-8 bg-white rounded-[8px] items-center justify-center mr-3 shadow-sm shadow-[#0d1b3e]/10">
                            <Ionicons name="shield-checkmark" size={14} color="#f5a623" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[10px] font-black text-[#0d1b3e] tracking-widest uppercase mb-0.5">Agreement</Text>
                            <Text className="text-slate-500 font-bold text-[7px] uppercase tracking-widest leading-3">
                                {alreadyAccepted ? "You have agreed to our terms" : "Review and accept to continue"}
                            </Text>
                        </View>
                        <View className="bg-[#0d1b3e]/5 px-2 py-1 rounded-[6px] border border-[#0d1b3e]/10">
                            <Text className="text-[#0d1b3e] font-black text-[7px] uppercase tracking-widest">v2.0</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* TINY DECORATED ACCORDIONS */}
                <View className="px-4 mb-5 mt-4">
                    <Text className="text-[#0d1b3e] font-black tracking-widest text-[8px] uppercase mb-2 ml-1 opacity-60">Table of Contents</Text>
                    
                    {termsData.map((term, index) => {
                        const isExpanded = expandedIndex === index;
                        return (
                            <TouchableOpacity 
                                key={index} 
                                onPress={() => toggleAccordion(index)}
                                activeOpacity={0.8}
                                className={`mb-2 bg-white rounded-[16px] border ${isExpanded ? 'border-[#0d1b3e]/30 shadow-sm shadow-[#0d1b3e]/10' : 'border-slate-200/50 shadow-sm shadow-slate-200/50'} overflow-hidden transition-all duration-300`}
                            >
                                <View className="flex-row items-center justify-between p-2.5">
                                    <View className="flex-row items-center flex-1 pr-2">
                                        <LinearGradient
                                            colors={isExpanded ? ['#0d1b3e', '#1e3a8a'] : ['#f8fafc', '#f1f5f9']}
                                            className={`w-7 h-7 rounded-[10px] items-center justify-center mr-2 border ${isExpanded ? 'border-[#1e3a8a]' : 'border-slate-100'}`}
                                        >
                                            <Ionicons name={term.icon as any} size={12} color={isExpanded ? "#f5a623" : "#64748b"} />
                                        </LinearGradient>
                                        <Text className={`font-black text-[9px] uppercase tracking-wide ${isExpanded ? 'text-[#0d1b3e]' : 'text-slate-600'}`}>
                                            {term.title}
                                        </Text>
                                    </View>
                                    <View className={`w-5 h-5 rounded-full items-center justify-center ${isExpanded ? 'bg-[#f5a623]/20' : 'bg-slate-50 border border-slate-100'}`}>
                                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={10} color={isExpanded ? "#f5a623" : "#cbd5e1"} />
                                    </View>
                                </View>
                                
                                {isExpanded && (
                                    <View className="px-3 pb-3 pt-0 ml-10">
                                        <Text className="text-slate-500 font-bold text-[8px] leading-[12px]">
                                            {term.content}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* MICRO PRIVACY CARD */}
                <View className="px-4 mb-5">
                    <TouchableOpacity activeOpacity={0.8} className="overflow-hidden rounded-[16px] shadow-sm shadow-emerald-100">
                        <LinearGradient colors={['#ecfdf5', '#d1fae5']} start={{x:0, y:0}} end={{x:1, y:1}} className="p-2.5 flex-row items-center justify-between border border-emerald-200">
                            <View className="flex-row items-center">
                                <View className="w-7 h-7 rounded-[8px] bg-white items-center justify-center mr-2 border border-emerald-100 shadow-sm shadow-emerald-200">
                                    <Ionicons name="lock-closed" size={12} color="#10b981" />
                                </View>
                                <View>
                                    <Text className="font-black text-[9px] uppercase tracking-wide text-[#064e3b]">Privacy Policy</Text>
                                    <Text className="text-[#047857] font-bold text-[7px] uppercase tracking-widest mt-0.5">Secure Data</Text>
                                </View>
                            </View>
                            <View className="w-5 h-5 bg-emerald-500 rounded-full items-center justify-center">
                                <Ionicons name="arrow-forward" size={10} color="#ffffff" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* MICRO DECORATED CHECKBOX & BUTTON */}
                <View className="px-4 mt-2">
                    <TouchableOpacity 
                        onPress={() => !alreadyAccepted && setIsChecked(!isChecked)}
                        activeOpacity={alreadyAccepted ? 1 : 0.7}
                        className={`flex-row items-center mb-3 p-3 rounded-[16px] border shadow-sm ${alreadyAccepted ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100' : isChecked ? 'bg-[#f5a623]/10 border-[#f5a623]/30 shadow-[#f5a623]/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}
                    >
                        <View className={`w-5 h-5 rounded-[6px] border flex-row items-center justify-center mr-2 ${alreadyAccepted ? 'bg-[#10b981] border-[#10b981]' : isChecked ? 'bg-[#0d1b3e] border-[#0d1b3e]' : 'bg-slate-50 border-slate-300'}`}>
                            {(isChecked || alreadyAccepted) && <Ionicons name="checkmark-sharp" size={12} color={alreadyAccepted ? '#ffffff' : '#f5a623'} />}
                        </View>
                        <View className="flex-1">
                            <Text className={`font-black text-[9px] uppercase tracking-wide mb-0.5 ${alreadyAccepted ? 'text-[#064e3b]' : isChecked ? 'text-[#0d1b3e]' : 'text-slate-600'}`}>
                                {alreadyAccepted ? "Terms Accepted" : "I Accept the Terms"}
                            </Text>
                            <Text className="text-slate-500 font-bold text-[7px] leading-3">
                                {alreadyAccepted ? "You have already agreed to our terms." : "I confirm and agree to the terms"}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={handleAccept}
                        activeOpacity={0.9}
                        disabled={!isChecked && !alreadyAccepted}
                        className="overflow-hidden rounded-[16px] shadow-md shadow-[#0d1b3e]/20"
                    >
                        <LinearGradient
                            colors={alreadyAccepted ? ['#10b981', '#059669'] : isChecked ? ['#0d1b3e', '#1e3a8a'] : ['#e2e8f0', '#cbd5e1']}
                            start={{x:0, y:0}} end={{x:1, y:1}}
                            className="h-12 flex-row items-center justify-center border border-white/20"
                        >
                            <Ionicons 
                                name={alreadyAccepted ? "checkmark-circle" : isChecked ? "shield-checkmark" : "warning"} 
                                size={14} 
                                color={alreadyAccepted ? "#ffffff" : isChecked ? "#f5a623" : "#64748b"} 
                                className="mr-2" 
                            />
                            <Text className={`font-black tracking-widest uppercase text-[10px] ${alreadyAccepted || isChecked ? 'text-white' : 'text-slate-500'}`}>
                                {alreadyAccepted ? "Go Back" : !isChecked ? "Check The Box" : "Accept & Continue"}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}
