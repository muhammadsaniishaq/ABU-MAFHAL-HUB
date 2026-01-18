import { View, Text, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { Alert } from 'react-native';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                const role = data.user.app_metadata?.role;
                if (role === 'admin') {
                    router.replace('/management-v4-core');
                } else {
                    router.replace('/(app)/dashboard');
                }
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'Please check your credentials');
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
                    <View className="px-8 pt-12 pb-8 items-center">
                        {/* Logo */}
                        <View className="mb-6 items-center">
                            <Image
                                source={require('../../assets/images/logo.png')}
                                className="w-8 h-8 rounded-full"
                                resizeMode="contain"
                            />
                            <Text className="text-lg font-bold text-slate mt-3">Welcome Back</Text>
                            <Text className="text-gray-400 text-sm mt-1">Sign in to your Abu Mafhal account</Text>
                        </View>

                        {/* Input Fields */}
                        <View className="w-full gap-y-5">
                            <View>
                                <Text className="text-slate font-bold text-sm mb-2 ml-1">Email Address</Text>
                                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-16">
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
                                <Text className="text-slate font-bold text-sm mb-2 ml-1">Password</Text>
                                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-16">
                                    <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                                    <TextInput
                                        className="flex-1 ml-3 text-slate font-medium"
                                        placeholder="Enter your password"
                                        placeholderTextColor="#94A3B8"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity className="mt-3 self-end">
                                    <Text className="text-primary font-bold text-xs">Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            onPress={handleLogin}
                            className="bg-primary w-full h-16 rounded-2xl items-center justify-center mt-10 shadow-lg shadow-primary/30"
                        >
                            <Text className="text-white font-bold text-lg">Sign In</Text>
                        </TouchableOpacity>

                        {/* Fingerprint / FaceID Placeholder */}
                        <TouchableOpacity className="mt-8 p-4 bg-gray-50 rounded-full">
                            <Ionicons name="finger-print" size={32} color="#0056D2" />
                        </TouchableOpacity>

                        {/* Sign Up Link */}
                        <View className="flex-row mt-auto pt-10 pb-6">
                            <Text className="text-gray-400 font-medium">Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                                <Text className="text-primary font-bold">Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
