import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter your email and password');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                // Check for unconfirmed email error
                if (error.message.includes('Email not confirmed') || error.message.includes('Email not verified')) {
                    console.log("Redirecting to verification for:", email);
                    router.push({
                        pathname: '/(auth)/otp',
                        params: { email, type: 'signup' }
                    });
                    return;
                }
                throw error;
            }

            if (data.user) {
                // Automation: IP Tracking & Login Alert
                let ip = "Unknown IP";
                try {
                    const res = await fetch('https://api.ipify.org?format=json');
                    const json = await res.json();
                    ip = json.ip;
                } catch (e) { console.log("Failed to fetch IP", e); }

                await supabase.from('notifications').insert({
                    user_id: data.user.id,
                    title: "New Login Detected 🔐",
                    body: `New login from IP: ${ip} on ${Platform.OS.toUpperCase()}.`,
                    data: { priority: 'high', type: 'security', ip }
                });

                // Automation: Send Login Email
                await supabase.functions.invoke('send-communication', {
                    body: {
                        type: 'email',
                        recipient_mode: 'single',
                        recipient: email, // Use state email
                        subject: "🔐 Security Alert: New Login Detected",
                        body: `<h3>New Login Detected</h3><p>We noticed a new login to your account.</p><p><b>Device:</b> ${Platform.OS.toUpperCase()}</p><p><b>IP Address:</b> ${ip}</p><p><b>Time:</b> ${new Date().toLocaleString()}</p><p>If this was you, you can ignore this email.</p>`
                    }
                });

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                const role = profile?.role || 'user';
                if (role === 'admin' || role === 'super_admin') {
                    router.replace('/manage');
                } else {
                    router.replace('/(app)/dashboard');
                }
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'Please check your credentials');
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
                    colors={['rgba(59, 130, 246, 0.08)', 'rgba(139, 92, 246, 0.08)']}
                    className="absolute -top-[15%] -left-[15%] w-[110%] aspect-square rounded-full"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <LinearGradient
                    colors={['rgba(236, 72, 153, 0.05)', 'transparent']}
                    className="absolute top-[20%] -right-[20%] w-[80%] aspect-square rounded-full"
                />
                <LinearGradient
                    colors={['rgba(16, 185, 129, 0.05)', 'rgba(59, 130, 246, 0.03)']}
                    className="absolute -bottom-[10%] -left-[10%] w-[70%] aspect-square rounded-full"
                />

                {/* Geometric Patterns */}
                <View 
                    style={{
                        position: 'absolute',
                        top: height * 0.1,
                        left: -width * 0.2,
                        width: width * 0.8,
                        height: width * 0.8,
                        borderRadius: width,
                        borderWidth: 1.5,
                        borderColor: 'rgba(59, 130, 246, 0.1)',
                        transform: [{ scale: 1.2 }]
                    }}
                />
                <View 
                    style={{
                        position: 'absolute',
                        bottom: height * 0.15,
                        right: -width * 0.3,
                        width: width * 0.6,
                        height: width * 0.6,
                        borderRadius: width,
                        borderWidth: 1,
                        borderColor: 'rgba(16, 185, 129, 0.12)',
                        transform: [{ rotate: '45deg' }]
                    }}
                />

                {/* Floating Bubbles */}
                <View className="absolute top-[15%] left-[20%] w-6 h-6 rounded-full bg-blue-400/10 border border-blue-400/20" />
                <View className="absolute top-[40%] right-[10%] w-10 h-10 rounded-full bg-purple-400/10 border border-purple-400/20" />
                <View className="absolute bottom-[25%] left-[5%] w-8 h-8 rounded-full bg-pink-400/10 border border-pink-400/20" />
                <View className="absolute top-[60%] left-[40%] w-4 h-4 rounded-full bg-emerald-400/10 border border-emerald-400/20" />
                
                {/* Additional Glowing Accents */}
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.8)', 'transparent']}
                    className="absolute top-[5%] left-[10%] w-32 h-32 rounded-full opacity-40"
                    style={{ transform: [{ rotate: '-45deg' }] }}
                />
            </View>

            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                        <View className="px-8 pt-12 pb-8 items-center flex-1 justify-center">
                            {/* Logo Section */}
                            <View className="mb-12 items-center">
                                <View className="shadow-2xl shadow-blue-500/40 bg-white p-1 rounded-[32px]">
                                    <LinearGradient
                                        colors={['#3B82F6', '#8B5CF6']}
                                        className="p-1 rounded-[30px]"
                                    >
                                        <View className="bg-white p-3 rounded-[28px] items-center justify-center" style={{ width: 80, height: 80 }}>
                                            <Image 
                                                source={require('../../assets/images/logo.png')}
                                                style={{ width: 56, height: 56 }}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </LinearGradient>
                                </View>
                                <Text className="text-3xl font-bold text-slate-900 mt-6 tracking-tight">Welcome Back</Text>
                                <Text className="text-slate-500 text-base mt-2 font-medium">Log in to your premium account</Text>
                            </View>

                            {/* Input Fields */}
                            <View className="w-full gap-y-5">
                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-2 ml-1">Email Address</Text>
                                    <View 
                                        className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-16 shadow-sm shadow-slate-200"
                                    >
                                        <Ionicons name="mail-outline" size={22} color="#94A3B8" />
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
                                    <Text className="text-slate-600 font-bold text-sm mb-2 ml-1">Password</Text>
                                    <View 
                                        className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 h-16 shadow-sm shadow-slate-200"
                                    >
                                        <Ionicons name="lock-closed-outline" size={22} color="#94A3B8" />
                                        <TextInput
                                            className="flex-1 ml-3 text-slate-900 font-semibold"
                                            placeholder="Enter your password"
                                            placeholderTextColor="#94A3B8"
                                            secureTextEntry={!showPassword}
                                            value={password}
                                            onChangeText={setPassword}
                                            selectionColor="#3B82F6"
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity className="mt-3 self-end">
                                        <Text className="text-blue-600 font-bold text-sm">Forgot Password?</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                onPress={handleLogin}
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
                                        <Text className="text-white font-bold text-lg tracking-wide">Sign In</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Sign Up Link */}
                            <View className="mt-auto pt-12 items-center">
                                <View className="flex-row items-center">
                                    <Text className="text-slate-500 font-medium text-base">New here? </Text>
                                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                                        <Text className="text-blue-600 font-bold text-base">Create Account</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
