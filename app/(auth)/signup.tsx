import { View, Text, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, Image, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';

export default function Signup() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSignup = async () => {
        if (!email || !password || !fullName || !phone) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        phone: phone,
                    },
                },
            });

            if (error) throw error;

            if (data.user) {
                Alert.alert('Success', 'Account created! Please check your email for verification.');
                router.replace('/(auth)/login');
            }
        } catch (error: any) {
            Alert.alert('Signup Failed', error.message || 'An error occurred during signup');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                    <View className="px-8 pt-10 pb-8 items-center">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="self-start mb-4"
                        >
                            <Ionicons name="arrow-back" size={24} color="#1E293B" />
                        </TouchableOpacity>

                        {/* Logo */}
                        <View className="mb-4 items-center">
                            <Image
                                source={require('../../assets/images/logo.png')}
                                style={{ width: 24, height: 24 }}
                                className="rounded-full"
                                resizeMode="contain"
                            />
                            <Text className="text-base font-bold text-slate mt-2">Create Account</Text>
                            <Text className="text-gray-400 text-[10px] mt-0.5">Join Abu Mafhal Hub today</Text>
                        </View>

                        {/* Input Fields */}
                        <View className="w-full gap-y-4">
                            <View>
                                <Text className="text-slate font-bold text-sm mb-1 ml-1">Full Name</Text>
                                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-14">
                                    <Ionicons name="person-outline" size={20} color="#94A3B8" />
                                    <TextInput
                                        className="flex-1 ml-3 text-slate font-medium"
                                        placeholder="Enter full name"
                                        placeholderTextColor="#94A3B8"
                                        value={fullName}
                                        onChangeText={setFullName}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-slate font-bold text-sm mb-1 ml-1">Email Address</Text>
                                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-14">
                                    <Ionicons name="mail-outline" size={20} color="#94A3B8" />
                                    <TextInput
                                        className="flex-1 ml-3 text-slate font-medium"
                                        placeholder="Enter your email"
                                        placeholderTextColor="#94A3B8"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-slate font-bold text-sm mb-1 ml-1">Phone Number</Text>
                                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-14">
                                    <Ionicons name="call-outline" size={20} color="#94A3B8" />
                                    <TextInput
                                        className="flex-1 ml-3 text-slate font-medium"
                                        placeholder="Enter phone number"
                                        placeholderTextColor="#94A3B8"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-slate font-bold text-sm mb-1 ml-1">Password</Text>
                                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-14">
                                    <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                                    <TextInput
                                        className="flex-1 ml-3 text-slate font-medium"
                                        placeholder="Create a password"
                                        placeholderTextColor="#94A3B8"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Signup Button */}
                        <TouchableOpacity
                            onPress={handleSignup}
                            disabled={loading}
                            className={`bg-primary w-full h-14 rounded-2xl items-center justify-center mt-8 shadow-lg shadow-primary/30 ${loading ? 'opacity-70' : ''}`}
                        >
                            <Text className="text-white font-bold text-lg">
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </Text>
                        </TouchableOpacity>

                        {/* Login Link */}
                        <View className="flex-row mt-8 pb-6">
                            <Text className="text-gray-400 font-medium">Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                                <Text className="text-primary font-bold">Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
