import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase, forceSignOut } from '../services/supabase';

export default function KYCScreen() {
    const [tier, setTier] = useState<number>(1);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);

    // Form State
    const [idType, setIdType] = useState<'bvn' | 'nin'>('bvn');
    const [idNumber, setIdNumber] = useState('');

    const router = useRouter();

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('kyc_tier')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error("Error fetching profile status:", error);
                
                // If unauthorized or bad request, session is likely invalid
                const err = error as any;
                if (err.code === 'PGRST301' || err.message?.includes('JWT') || err.status === 401 || err.status === 400 || err.code === '401' || err.code === '400') {
                    console.log("Fetch Status Error: Forcing logout...");
                    Alert.alert("Session Expired", "Please login again.", [
                        { text: "OK", onPress: () => {
                             forceSignOut().then(() => router.replace('/(auth)/login'));
                        }}
                    ]);
                    return;
                }
                
                // If the column doesn't exist or there's an RLS issue, we stay at tier 1
                return;
            }

            if (profile) setTier(profile.kyc_tier);
        } catch (error) {
            console.error("Fetch Status Catch:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!idNumber || idNumber.length < 11) {
            Alert.alert("Invalid Input", `Please enter a valid ${idType.toUpperCase()}`);
            return;
        }

        setVerifying(true);
        try {
            // 1. FRESH SESSION CHECK
            console.log("Checking session validity before KYC...");
            const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
            
            if (sessionError || !sessionData.session) {
                console.warn("Session Refresh Failed:", sessionError);
                Alert.alert("Session Expired", "Please login again.", [
                    { text: "Login", onPress: async () => {
                         await forceSignOut();
                         router.replace('/(auth)/login');
                    }}
                ]);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('verify-identity', {
                body: { idType, idNumber, userId: user.id }
            });

            if (error) throw error;

            if (data.success) {
                Alert.alert("Success", "Identity Verified Successfully!", [
                    {
                        text: "Continue", onPress: () => {
                            fetchStatus(); // Refresh tier
                            router.replace('/dashboard');
                        }
                    }
                ]);
            } else {
                const errorMsg = data.error || data.message || "Could not verify details. Please try again.";
                const details = data.details ? `\nDetails: ${data.details}` : '';
                Alert.alert("Verification Failed", `${errorMsg}${details}`);
            }

        } catch (error: any) {
            console.error("Verification Error:", error);
            
            // Handle Session Expiry / Unauthorized Access
            // Since we return 200 for logic errors, any thrown FunctionsHttpError is likely 401/403/500
            const errString = JSON.stringify(error) + error.toString();
            if (
                error.status === 401 || 
                error.message?.includes('Invalid Refresh Token') ||
                error.message?.includes('JWT') ||
                errString.includes('401') ||
                errString.includes('FunctionsHttpError') // Catch the Edge Function rejection
            ) {
                Alert.alert("Session Expired", "Please login again to continue.", [
                    { 
                        text: "Login", 
                        onPress: async () => {
                            await forceSignOut();
                            router.replace('/(auth)/login');
                        }
                    }
                ]);
                return;
            }

            Alert.alert("Error", error.message || "An unexpected error occurred.");
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator color="#0056D2" size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Premium Header */}
            <LinearGradient
                colors={['#0056D2', '#1E3A8A']} // Blue gradient
                className="pt-16 pb-20 px-6 rounded-b-[40px] shadow-xl"
            >
                <TouchableOpacity 
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/(app)/dashboard');
                        }
                    }} 
                    className="mb-6 w-10 h-10 bg-white/20 rounded-full items-center justify-center backdrop-blur-md"
                >
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>

                <Text className="text-blue-100 font-bold uppercase text-xs tracking-widest mb-2">Identity Verification</Text>
                <Text className="text-white font-black text-3xl mb-1">Upgrade your Tier</Text>
                <Text className="text-blue-200 text-sm">Unlock higher limits with instant verification.</Text>
            </LinearGradient>

            <ScrollView className="flex-1 -mt-12 px-6" showsVerticalScrollIndicator={false}>
                {/* Status Card */}
                <View className="bg-white p-6 rounded-3xl shadow-lg shadow-blue-900/10 mb-6">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-gray-500 font-medium text-sm">Current Status</Text>
                        <View className={`px-3 py-1 rounded-full ${tier >= 2 ? 'bg-green-100' : 'bg-orange-100'}`}>
                            <Text className={`text-xs font-bold ${tier >= 2 ? 'text-green-700' : 'text-orange-700'}`}>
                                {tier >= 2 ? 'Verified' : 'Pending Upgrade'}
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row items-end gap-2">
                        <Text className="text-4xl font-black text-slate-800">Tier {tier}</Text>
                        <Text className="text-gray-400 font-bold mb-2">/ 3</Text>
                    </View>
                </View>

                {/* Verification Form */}
                {tier < 2 ? (
                    <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-20">
                        <Text className="font-bold text-slate-800 text-lg mb-6">Instant Verification</Text>

                        {/* ID Type Selector */}
                        <Text className="text-slate-600 font-bold mb-3 ml-1">Select ID Type</Text>
                        <View className="flex-row gap-4 mb-6">
                            <TouchableOpacity
                                onPress={() => setIdType('bvn')}
                                className={`flex-1 p-4 rounded-xl border-2 items-center justify-center ${idType === 'bvn' ? 'border-primary bg-blue-50' : 'border-gray-100 bg-white'}`}
                            >
                                <Ionicons name="card-outline" size={24} color={idType === 'bvn' ? '#0056D2' : '#94A3B8'} />
                                <Text className={`font-bold mt-2 ${idType === 'bvn' ? 'text-primary' : 'text-gray-400'}`}>BVN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setIdType('nin')}
                                className={`flex-1 p-4 rounded-xl border-2 items-center justify-center ${idType === 'nin' ? 'border-primary bg-blue-50' : 'border-gray-100 bg-white'}`}
                            >
                                <Ionicons name="finger-print-outline" size={24} color={idType === 'nin' ? '#0056D2' : '#94A3B8'} />
                                <Text className={`font-bold mt-2 ${idType === 'nin' ? 'text-primary' : 'text-gray-400'}`}>NIN</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Input Field */}
                        <Text className="text-slate-600 font-bold mb-3 ml-1">Enter {idType.toUpperCase()} Number</Text>
                        <View className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-8">
                            <TextInput
                                className="text-xl font-bold text-slate-800 h-10"
                                placeholder={`11-digit ${idType.toUpperCase()}`}
                                placeholderTextColor="#CBD5E1"
                                keyboardType="number-pad"
                                maxLength={11}
                                value={idNumber}
                                onChangeText={setIdNumber}
                            />
                        </View>

                        {/* Info Note */}
                        <View className="flex-row gap-3 mb-8 bg-blue-50 p-4 rounded-xl">
                            <Ionicons name="information-circle" size={22} color="#0056D2" />
                            <Text className="flex-1 text-slate-600 text-xs leading-5">
                                We will verify your name against the database. Please ensure your profile name matches your ID.
                            </Text>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            className={`h-16 rounded-full items-center justify-center shadow-lg shadow-blue-600/20 mb-4 ${verifying ? 'bg-blue-400' : 'bg-primary'}`}
                            onPress={handleVerify}
                            disabled={verifying}
                        >
                            {verifying ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Verify Identity</Text>
                            )}
                        </TouchableOpacity>

                        <View className="flex-row justify-center items-center gap-2">
                            <Ionicons name="shield-checkmark" size={14} color="#64748B" />
                            <Text className="text-slate-500 text-xs font-bold">Secured by Flutterwave</Text>
                        </View>

                    </View>
                ) : (
                    <View className="items-center py-10">
                        <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
                            <Ionicons name="checkmark" size={48} color="#15803D" />
                        </View>
                        <Text className="text-slate-800 font-black text-2xl mb-2">Identity Verified</Text>
                        <Text className="text-slate-500 text-center px-8">
                            Your identity has been confirmed. You now have access to higher transaction limits.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
