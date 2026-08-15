import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function OTP() {
    const { settings } = useAppSettings();
    const params = useLocalSearchParams<{
        email?: string;
        tempFullName?: string;
        tempUsername?: string;
        tempPhone?: string;
        tempCustomId?: string;
        tempReferralCode?: string;
    }>();

    const router = useRouter();
    const [targetEmail, setTargetEmail] = useState<string>(params.email || '');
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [counter, setCounter] = useState(60);
    const inputRefs = useRef<Array<TextInput | null>>([]);

    useEffect(() => {
        if (!targetEmail) {
            fetchActiveUserEmail();
        }
    }, [targetEmail]);

    useEffect(() => {
        const timer = counter > 0 && setInterval(() => setCounter((c) => c - 1), 1000);
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [counter]);

    const fetchActiveUserEmail = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setTargetEmail(user.email);
            }
        } catch (e) {
            console.log('Error fetching user email in OTP:', e);
        }
    };

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
            const msg = 'Please enter the complete 6-digit verification code.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Invalid Code', msg);
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: targetEmail,
                token,
                type: params.tempFullName ? 'signup' : 'recovery',
            });

            if (error) {
                // Fallback attempt with magiclink or recovery token if signup type failed
                const { error: recoveryErr } = await supabase.auth.verifyOtp({
                    email: targetEmail,
                    token,
                    type: 'magiclink',
                });
                if (recoveryErr && error) throw error;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user && params.tempFullName) {
                await supabase.from('profiles').insert({
                    id: user.id,
                    full_name: params.tempFullName,
                    username: params.tempUsername,
                    phone: params.tempPhone,
                    email: targetEmail,
                    custom_id: params.tempCustomId,
                    referral_code: params.tempReferralCode || null,
                    role: 'user',
                    balance: 0,
                });

                await supabase.from('notifications').insert({
                    user_id: user.id,
                    title: 'Welcome to ABU MAFHAL SUB! 🎉',
                    body: 'Your account is verified. Fund your wallet to start trading.',
                    data: { priority: 'normal', type: 'welcome' },
                });
            }

            if (Platform.OS === 'web') {
                alert('Success! Code verified successfully.');
                router.replace('/(auth)/pin-setup' as any);
            } else {
                Alert.alert('Success', 'Code verified successfully!', [
                    { text: 'Set New PIN', onPress: () => router.replace('/(auth)/pin-setup' as any) },
                ]);
            }
        } catch (error: any) {
            const errMsg = error.message || 'Verification failed. Please check the code and try again.';
            if (Platform.OS === 'web') alert(errMsg);
            else Alert.alert('Verification Failed', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!targetEmail) {
            const msg = 'Email address is missing. Please log in again.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Error', msg);
            return;
        }

        setResending(true);
        try {
            const { error } = await supabase.auth.resend({
                type: params.tempFullName ? 'signup' : 'recovery',
                email: targetEmail,
            });

            if (error) throw error;

            setCounter(60);
            const msg = 'A new 6-digit verification code has been sent to your email.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Code Sent', msg);
        } catch (error: any) {
            const msg = error.message || 'Failed to resend code';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Error', msg);
        } finally {
            setResending(false);
        }
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Deep Royal Mesh Gradient */}
            <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={StyleSheet.absoluteFillObject} />

            {/* Glowing Ambient Lights */}
            <View style={s.topGlow} />
            <View style={s.bottomGlow} />

            <SafeAreaView style={s.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={s.keyboardView}
                >
                    {/* Top Bar Header */}
                    <View style={s.topBar}>
                        <TouchableOpacity
                            onPress={() => {
                                if (router.canGoBack()) router.back();
                                else router.replace('/(auth)/pin' as any);
                            }}
                            style={s.backBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={20} color="#F59E0B" />
                        </TouchableOpacity>

                        <View style={s.securityBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#F59E0B" />
                            <Text style={s.securityBadgeText}>OTP VERIFICATION</Text>
                        </View>

                        <View style={{ width: 36 }} />
                    </View>

                    {/* Main Card Content */}
                    <View style={s.card}>
                        {/* Logo Circle */}
                        <View style={s.logoWrapper}>
                            <LinearGradient colors={['#F59E0B', '#D97706']} style={s.logoBorderRing}>
                                <View style={s.logoInnerCard}>
                                    <Image
                                        source={
                                            settings?.app_logo
                                                ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url }
                                                : require('../../assets/images/logo.png')
                                        }
                                        style={s.logoImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            </LinearGradient>
                        </View>

                        {/* Title & Subtitle */}
                        <Text style={s.titleText}>Verify Security Code</Text>
                        <Text style={s.subtitleText}>
                            We sent a 6-digit verification code to
                        </Text>
                        <Text style={s.emailHighlightText}>{targetEmail || 'your registered email'}</Text>

                        {/* 6-Digit OTP Inputs */}
                        <View style={s.otpRow}>
                            {otp.map((digit, index) => (
                                <View
                                    key={index}
                                    style={[
                                        s.otpBox,
                                        digit ? s.otpBoxFilled : s.otpBoxEmpty,
                                    ]}
                                >
                                    <TextInput
                                        ref={(ref) => {
                                            inputRefs.current[index] = ref as TextInput;
                                        }}
                                        style={s.otpInput}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        value={digit}
                                        onChangeText={(value) => handleOtpChange(value, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        selectionColor="#F59E0B"
                                    />
                                </View>
                            ))}
                        </View>

                        {/* Verify Button */}
                        <TouchableOpacity
                            onPress={handleVerify}
                            disabled={loading}
                            activeOpacity={0.8}
                            style={s.verifyBtnWrapper}
                        >
                            <LinearGradient
                                colors={['#F59E0B', '#D97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.verifyBtnGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#020617" size="small" />
                                ) : (
                                    <View style={s.verifyBtnContent}>
                                        <Ionicons name="checkmark-circle" size={20} color="#020617" />
                                        <Text style={s.verifyBtnText}>Verify Code & Continue</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Resend Section */}
                        <View style={s.resendContainer}>
                            <Text style={s.resendLabel}>Didn't receive the code?</Text>
                            <TouchableOpacity
                                disabled={counter > 0 || resending}
                                onPress={handleResend}
                                style={s.resendBtn}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        s.resendBtnText,
                                        counter > 0 ? s.resendBtnDisabled : s.resendBtnActive,
                                    ]}
                                >
                                    Resend Code
                                </Text>
                                {counter > 0 && (
                                    <View style={s.counterBadge}>
                                        <Text style={s.counterText}>{counter}s</Text>
                                    </View>
                                )}
                                {resending && <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 6 }} />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    topGlow: {
        position: 'absolute',
        top: -100,
        alignSelf: 'center',
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -100,
        alignSelf: 'center',
        width: 340,
        height: 340,
        borderRadius: 170,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 440,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    securityBadgeText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    logoWrapper: {
        marginBottom: 16,
    },
    logoBorderRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        padding: 3,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    logoInnerCard: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    logoImage: {
        width: 42,
        height: 42,
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    subtitleText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    emailHighlightText: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
        marginBottom: 24,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
        marginBottom: 28,
    },
    otpBox: {
        flex: 1,
        height: 54,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    otpBoxEmpty: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    otpBoxFilled: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: '#F59E0B',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
    },
    otpInput: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        width: '100%',
        textAlign: 'center',
    },
    verifyBtnWrapper: {
        width: '100%',
        marginBottom: 20,
    },
    verifyBtnGradient: {
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    verifyBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verifyBtnText: {
        color: '#020617',
        fontSize: 16,
        fontWeight: '800',
    },
    resendContainer: {
        alignItems: 'center',
    },
    resendLabel: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 6,
    },
    resendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    resendBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    resendBtnActive: {
        color: '#F59E0B',
    },
    resendBtnDisabled: {
        color: '#64748B',
    },
    counterBadge: {
        marginLeft: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    counterText: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '800',
    },
});
