import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
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

    // Validation States
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

    const [checkingPhone, setCheckingPhone] = useState(false);
    const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

    const router = useRouter();

    // Real-time Username Check
    useEffect(() => {
        const checkUsername = async () => {
            if (username.length < 3) {
                setUsernameAvailable(null);
                setUsernameSuggestions([]);
                return;
            }
            setCheckingUsername(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'username', value: username }
                });

                if (error) throw error;

                if (data.available) {
                    setUsernameAvailable(true);
                    setUsernameSuggestions([]);
                } else {
                    setUsernameAvailable(false);
                    setUsernameSuggestions(data.suggestions || []);
                }
            } catch (error) {
                console.log('Username check error', error);
                // Fallback or ignore error
            } finally {
                setCheckingUsername(false);
            }
        };
        const timer = setTimeout(checkUsername, 600);
        return () => clearTimeout(timer);
    }, [username]);

    // Real-time Email Check
    useEffect(() => {
        const checkEmail = async () => {
             const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                setEmailAvailable(null);
                return;
            }
            setCheckingEmail(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'email', value: email }
                });

                if (error) throw error;
                
                setEmailAvailable(data.available);
            } catch (error) {
                console.log('Email check error', error);
            } finally {
                setCheckingEmail(false);
            }
        };
        const timer = setTimeout(checkEmail, 600);
        return () => clearTimeout(timer);
    }, [email]);

     // Real-time Phone Check
    useEffect(() => {
        const checkPhone = async () => {
            if (phone.length < 10) {
                setPhoneAvailable(null);
                return;
            }
            setCheckingPhone(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'phone', value: phone }
                });

                if (error) throw error;

                setPhoneAvailable(data.available);
            } catch (error) {
                console.log('Phone check error', error);
            } finally {
                setCheckingPhone(false);
            }
        };
        const timer = setTimeout(checkPhone, 600);
        return () => clearTimeout(timer);
    }, [phone]);

    const handleSignup = async () => {
        if (!email || !password || !fullName || !phone || !username) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (usernameAvailable === false) {
            Alert.alert('Username Taken', 'Please choose a different username');
            return;
        }
        if (emailAvailable === false) {
             Alert.alert('Email Exists', 'This email is already registered. Please login.');
             return;
        }
        if (phoneAvailable === false) {
             Alert.alert('Phone Used', 'This phone number is already linked to an account.');
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
                                    <View className={`flex-row items-center bg-slate-50 border rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 ${usernameAvailable === false ? 'border-red-300 bg-red-50' : usernameAvailable === true ? 'border-green-300 bg-green-50' : 'border-slate-100'}`}>
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
                                        {checkingUsername ? (
                                            <ActivityIndicator size="small" color="#3B82F6" />
                                        ) : usernameAvailable === true ? (
                                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        ) : usernameAvailable === false ? (
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        ) : null}
                                    </View>
                                    {usernameAvailable === false && (
                                        <View className="mt-2">
                                            <Text className="text-red-500 text-xs ml-1 mb-1">Username is taken. Try these:</Text>
                                            <View className="flex-row flex-wrap gap-2">
                                                {usernameSuggestions.map((suggestion, index) => (
                                                    <TouchableOpacity 
                                                        key={index}
                                                        onPress={() => setUsername(suggestion)}
                                                        className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100"
                                                    >
                                                        <Text className="text-blue-600 text-xs font-bold">{suggestion}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Email Address</Text>
                                    <View className={`flex-row items-center bg-slate-50 border rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 ${emailAvailable === false ? 'border-red-300 bg-red-50' : emailAvailable === true ? 'border-green-300 bg-green-50' : 'border-slate-100'}`}>
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
                                        {checkingEmail ? (
                                            <ActivityIndicator size="small" color="#3B82F6" />
                                        ) : emailAvailable === true ? (
                                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        ) : emailAvailable === false ? (
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        ) : null}
                                    </View>
                                    {emailAvailable === false && (
                                         <Text className="text-red-500 text-xs ml-1 mt-1">Email already registered</Text>
                                    )}
                                </View>

                                <View>
                                    <Text className="text-slate-600 font-bold text-sm mb-1.5 ml-1">Phone Number</Text>
                                    <View className={`flex-row items-center bg-slate-50 border rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 ${phoneAvailable === false ? 'border-red-300 bg-red-50' : phoneAvailable === true ? 'border-green-300 bg-green-50' : 'border-slate-100'}`}>
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
                                         {checkingPhone ? (
                                            <ActivityIndicator size="small" color="#3B82F6" />
                                        ) : phoneAvailable === true ? (
                                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        ) : phoneAvailable === false ? (
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        ) : null}
                                    </View>
                                    {phoneAvailable === false && (
                                         <Text className="text-red-500 text-xs ml-1 mt-1">Phone number already in use</Text>
                                    )}
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
