import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function Signup() {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSignup = async () => {
        if (!email || !password || !fullName || !phone || !username) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const customId = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // Generate ID

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                // data passed in options is for metadata, not params
                options: {
                    data: {
                        full_name: fullName,
                        username: username,
                        phone: phone,
                        custom_id: customId,
                        referral_code: referralCode
                    },
                },
            });

            if (error) throw error;

            if (data.user) {
                // Hard Guard: Pass data to OTP screen instead of inserting here
                router.push({
                    pathname: '/(auth)/otp',
                    params: { 
                        email, 
                        type: 'signup',
                        // Pass profile data to be saved AFTER verification
                        tempFullName: fullName,
                        tempUsername: username,
                        tempPhone: phone,
                        tempCustomId: customId,
                        tempReferralCode: referralCode || ''
                    }
                });
            }
        } catch (error: any) {
            Alert.alert('Signup Failed', error.message || 'An error occurred during signup');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            {/* Advanced Background Decorations */}
            <View className="absolute inset-0 overflow-hidden">
                {/* Large Gradient Blobs */}
                <LinearGradient
                    colors={['rgba(139, 92, 246, 0.06)', 'rgba(59, 130, 246, 0.08)']}
                    className="absolute -top-[10%] -right-[20%] w-[120%] aspect-square rounded-full"
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />
                <LinearGradient
                    colors={['rgba(16, 185, 129, 0.06)', 'transparent']}
                    className="absolute top-[40%] -left-[30%] w-[90%] aspect-square rounded-full"
                    style={{ transform: [{ rotate: '15deg' }] }}
                />
                <LinearGradient
                    colors={['rgba(245, 158, 11, 0.04)', 'rgba(236, 72, 153, 0.04)']}
                    className="absolute bottom-[-10%] right-[-10%] w-[80%] aspect-square rounded-full"
                />

                {/* Geometric Patterns */}
                <View 
                    style={{
                        position: 'absolute',
                        top: height * 0.15,
                        right: -width * 0.1,
                        width: width * 0.7,
                        height: width * 0.7,
                        borderRadius: width,
                        borderWidth: 1,
                        borderColor: 'rgba(59, 130, 246, 0.15)',
                    }}
                />
                <View 
                    style={{
                        position: 'absolute',
                        bottom: height * 0.1,
                        left: -width * 0.2,
                        width: width * 0.6,
                        height: width * 0.6,
                        borderRadius: width,
                        borderWidth: 1.5,
                        borderColor: 'rgba(139, 92, 246, 0.12)',
                        transform: [{ scale: 1.3 }]
                    }}
                />

                {/* Floating Bubbles */}
                <View className="absolute top-[10%] left-[15%] w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20" />
                <View className="absolute top-[30%] right-[25%] w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20" />
                <View className="absolute bottom-[40%] right-[10%] w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
                <View className="absolute bottom-[15%] left-[30%] w-4 h-4 rounded-full bg-pink-500/10 border border-pink-500/20" />
            </View>

            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                        <View className="px-8 pt-10 pb-8 items-center flex-1">
                            <TouchableOpacity
                            onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/(auth)/login');
                                }
                            }}
                            className="self-start mb-6 w-11 h-11 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shadow-sm"
                        >
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>

                            {/* Logo & Header */}
                            <View className="mb-10 items-center">
                                <View className="shadow-2xl shadow-blue-500/40 bg-white p-1 rounded-[30px]">
                                    <LinearGradient
                                        colors={['#3B82F6', '#8B5CF6']}
                                        className="p-1 rounded-[28px]"
                                    >
                                        <View className="bg-white p-3 rounded-[26px] items-center justify-center" style={{ width: 70, height: 70 }}>
                                            <Image 
                                                source={require('../../assets/images/logo.png')}
                                                style={{ width: 48, height: 48 }}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </LinearGradient>
                                </View>
                                <Text className="text-3xl font-bold text-slate-900 mt-6 text-center tracking-tight">Create Account</Text>
                                <Text className="text-slate-500 text-base mt-2 text-center font-medium">Join the future of finance today</Text>
                            </View>

                            {/* Input Fields */}
                            <View className="w-full gap-y-4">
                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Full Name</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                                        <Ionicons name="person-outline" size={20} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="Enter full name"
                                            placeholderTextColor="#94A3B8"
                                            value={fullName}
                                            onChangeText={setFullName}
                                            selectionColor="#3B82F6"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Username</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                                        <Ionicons name="at-outline" size={20} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="Choose a username"
                                            placeholderTextColor="#94A3B8"
                                            value={username}
                                            onChangeText={setUsername}
                                            autoCapitalize="none"
                                            selectionColor="#3B82F6"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Email Address</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                                        <Ionicons name="mail-outline" size={20} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="Enter your email"
                                            placeholderTextColor="#94A3B8"
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            selectionColor="#3B82F6"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Phone Number</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                                        <Ionicons name="call-outline" size={20} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="Enter phone number"
                                            placeholderTextColor="#94A3B8"
                                            value={phone}
                                            onChangeText={setPhone}
                                            keyboardType="phone-pad"
                                            selectionColor="#3B82F6"
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Password</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                                        <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="Create a password"
                                            placeholderTextColor="#94A3B8"
                                            secureTextEntry={!showPassword}
                                            value={password}
                                            onChangeText={setPassword}
                                            selectionColor="#3B82F6"
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Referral Code (Optional) */}
                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Referral Code (Optional)</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                                        <Ionicons name="gift-outline" size={20} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="e.g. johndoe123"
                                            placeholderTextColor="#94A3B8"
                                            value={referralCode}
                                            onChangeText={setReferralCode}
                                            autoCapitalize="none"
                                            selectionColor="#3B82F6"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Signup Button */}
                            <TouchableOpacity
                                onPress={handleSignup}
                                disabled={loading}
                                activeOpacity={0.8}
                                className="w-full mt-10"
                            >
                                <LinearGradient
                                    colors={['#3B82F6', '#6366F1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    className="h-16 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/30"
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg tracking-wide">Create Account</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Login Link */}
                            <View className="flex-row mt-8 pb-6 items-center">
                                <Text className="text-slate-500 font-medium text-base">Already have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                                    <Text className="text-blue-600 font-bold text-base">Sign In</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
