import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width, height } = Dimensions.get('window');

export default function OTP() {
    const { email, tempFullName, tempUsername, tempPhone, tempCustomId, tempReferralCode } = useLocalSearchParams<{ 
        email: string, 
        tempFullName?: string,
        tempUsername?: string,
        tempPhone?: string,
        tempCustomId?: string,
        tempReferralCode?: string
    }>();
    const router = useRouter();
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [counter, setCounter] = useState(60);
    const inputRefs = useRef<Array<TextInput | null>>([]);

    useEffect(() => {
        const timer = counter > 0 && setInterval(() => setCounter(c => c - 1), 1000);
        return () => { if (timer) clearInterval(timer); };
    }, [counter]);

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const token = otp.join('');
        if (token.length !== 6) {
            Alert.alert('Error', 'Please enter the complete 6-digit code');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: email as string,
                token,
                type: 'signup'
            });

            if (error) throw error;

            // Automation: Send Welcome Notification & Email
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                 // Hard Guard: Insert Profile HERE after verification
                 if (tempFullName) {
                     const { error: profileError } = await supabase.from('profiles').insert({
                         id: user.id,
                         full_name: tempFullName,
                         username: tempUsername,
                         phone: tempPhone,
                         email: email,
                         custom_id: tempCustomId,
                         referral_code: tempReferralCode || null,
                         role: 'user', // Default role
                         balance: 0
                     });
                     
                     if (profileError) {
                         console.error("Profile Creation Failed:", profileError);
                         Alert.alert("Notice", "Account verified but profile setup failed. Please contact support.");
                     }
                 }

                await supabase.from('notifications').insert({
                    user_id: user.id,
                    title: "Welcome to Abu Mafhal Hub! 🎉",
                    body: "Your account is verified. Fund your wallet to start trading.",
                    data: { priority: 'normal', type: 'welcome' }
                });

                // Automation: Send Welcome Email
                await supabase.functions.invoke('send-communication', {
                    body: {
                        type: 'email',
                        recipient_mode: 'single',
                        recipient: email, // Use the email from params
                        subject: "Welcome to Abu Mafhal Hub! 🚀",
                        body: `<h3>Welcome to the Family!</h3><p>Your account has been successfully verified.</p><p><b>Next Steps:</b></p><ul><li>Fund your wallet</li><li>Explore our services</li><li>Start trading</li></ul><p>We are glad to have you!</p>`
                    }
                });
            }

            Alert.alert('Success', 'Email verified successfully!', [
                { text: 'Continue', onPress: () => router.replace('/(auth)/pin-setup') }
            ]);
        } catch (error: any) {
            Alert.alert('Verification Failed', error.message || 'Invalid code');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email as string,
            });

            if (error) throw error;

            setCounter(60);
            Alert.alert('Success', 'A new verification code has been sent');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar style="dark" />
            
            {/* Advanced Background Decorations */}
            <View className="absolute inset-0 overflow-hidden">
                {/* Large Gradient Blobs */}
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.08)', 'rgba(139, 92, 246, 0.08)']}
                    className="absolute -top-[5%] -left-[10%] w-[90%] aspect-square rounded-full"
                />
                <LinearGradient
                    colors={['rgba(236, 72, 153, 0.04)', 'transparent']}
                    className="absolute bottom-[20%] -right-[20%] w-[80%] aspect-square rounded-full"
                />
                <LinearGradient
                    colors={['rgba(16, 185, 129, 0.06)', 'rgba(59, 130, 246, 0.04)']}
                    className="absolute bottom-[-15%] -left-[15%] w-[70%] aspect-square rounded-full"
                    style={{ transform: [{ rotate: '-15deg' }] }}
                />

                {/* Geometric Patterns */}
                <View 
                    style={{
                        position: 'absolute',
                        top: height * 0.2,
                        right: -width * 0.2,
                        width: width * 0.7,
                        height: width * 0.7,
                        borderRadius: width,
                        borderWidth: 1.2,
                        borderColor: 'rgba(59, 130, 246, 0.15)',
                    }}
                />
                <View 
                    style={{
                        position: 'absolute',
                        bottom: height * 0.2,
                        left: -width * 0.1,
                        width: width * 0.6,
                        height: width * 0.6,
                        borderRadius: width,
                        borderWidth: 1.5,
                        borderColor: 'rgba(16, 185, 129, 0.12)',
                        transform: [{ scale: 1.4 }]
                    }}
                />

                {/* Floating Bubbles */}
                <View className="absolute top-[25%] left-[10%] w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20" />
                <View className="absolute top-[50%] right-[15%] w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20" />
                <View className="absolute bottom-[30%] left-[20%] w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20" />
            </View>

            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <View className="flex-1 px-8 py-10">
                        <TouchableOpacity
                            onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/(auth)/login');
                                }
                            }}
                            className="mb-8 w-11 h-11 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shadow-sm"
                        >
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>

                        <View className="flex-1 justify-center">
                            <View className="items-center mb-10">
                                <View className="shadow-2xl shadow-blue-500/40 bg-white p-1 rounded-[32px] mb-8">
                                    <LinearGradient
                                        colors={['#3B82F6', '#6366F1']}
                                        className="p-1 rounded-[30px]"
                                    >
                                        <View className="bg-white p-4 rounded-[28px] items-center justify-center" style={{ width: 84, height: 84 }}>
                                            <Image 
                                                source={require('../../assets/images/logo.png')}
                                                style={{ width: 60, height: 60 }}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </LinearGradient>
                                </View>
                                <Text className="text-3xl font-bold text-slate-900 tracking-tight">Verify Email</Text>
                                <Text className="text-slate-500 text-center mt-3 text-base font-medium">
                                    We've sent a 6-digit verification code to
                                </Text>
                                <Text className="text-blue-600 font-bold mt-1 text-base">{email}</Text>
                            </View>

                            {/* OTP Inputs */}
                            <View className="flex-row justify-between mb-10">
                                {otp.map((digit, index) => (
                                    <View
                                        key={index}
                                        className={`w-[14%] aspect-[2/3] rounded-2xl border-2 items-center justify-center bg-slate-50 ${digit ? 'border-blue-500 shadow-md shadow-blue-500/20' : 'border-slate-100'}`}
                                    >
                                        <TextInput
                                            ref={(ref) => { inputRefs.current[index] = ref as TextInput; }}
                                            className="text-2xl font-bold text-slate-900 w-full text-center"
                                            keyboardType="number-pad"
                                            maxLength={1}
                                            value={digit}
                                            onChangeText={(value) => handleOtpChange(value, index)}
                                            onKeyPress={(e) => handleKeyPress(e, index)}
                                            selectionColor="#3B82F6"
                                        />
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={handleVerify}
                                disabled={loading}
                                activeOpacity={0.8}
                                className="w-full mb-8"
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
                                        <Text className="text-white font-bold text-lg tracking-wide">Verify Code</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View className="items-center">
                                <Text className="text-slate-500 font-medium mb-3">Didn't receive code?</Text>
                                <TouchableOpacity
                                    disabled={counter > 0 || resending}
                                    onPress={handleResend}
                                    className="flex-row items-center"
                                >
                                    <Text className={`font-bold text-base ${counter > 0 ? 'text-slate-300' : 'text-blue-600'}`}>
                                        Resend Code
                                    </Text>
                                    {counter > 0 && (
                                        <View className="ml-2 bg-slate-100 px-2 py-0.5 rounded-full">
                                            <Text className="text-slate-500 text-xs font-bold">{counter}s</Text>
                                        </View>
                                    )}
                                    {resending && <ActivityIndicator size="small" color="#3B82F6" className="ml-2" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
