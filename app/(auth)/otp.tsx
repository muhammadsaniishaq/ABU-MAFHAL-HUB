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
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const inputRefs = useRef<Array<TextInput | null>>([]);
    const initialEmailSentRef = useRef(false);

    useEffect(() => {
        if (!targetEmail) {
            fetchActiveUserEmail();
        } else if (!initialEmailSentRef.current) {
            initialEmailSentRef.current = true;
            sendOtpEmail(targetEmail);
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
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', user.id)
                    .maybeSingle();
                if (profile?.full_name) setUserName(profile.full_name);
                if (profile?.avatar_url) setUserAvatar(profile.avatar_url);

                if (!initialEmailSentRef.current) {
                    initialEmailSentRef.current = true;
                    sendOtpEmail(user.email);
                }
            }
        } catch (e) {
            console.log('Error fetching user email in OTP:', e);
        }
    };

    const sendOtpEmail = async (emailToSend: string) => {
        if (!emailToSend) return;
        setResending(true);
        try {
            // Trigger Supabase Auth Password/PIN Reset Recovery Code
            const { error } = await supabase.auth.resetPasswordForEmail(emailToSend);
            if (error) {
                console.log('Supabase resetPasswordForEmail info:', error.message);
                await supabase.auth.resend({
                    type: params.tempFullName ? 'signup' : 'recovery',
                    email: emailToSend,
                });
            }
        } catch (err: any) {
            console.error('Error triggering OTP email:', err);
        } finally {
            setResending(false);
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto submit if all 6 digits entered
        if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === 6) {
            handleVerifyWithDigits(newOtp.join(''));
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyWithDigits = async (codeToken: string) => {
        if (codeToken.length !== 6 || loading) return;

        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: targetEmail,
                token: codeToken,
                type: params.tempFullName ? 'signup' : 'recovery',
            });

            if (error) {
                const { error: magicErr } = await supabase.auth.verifyOtp({
                    email: targetEmail,
                    token: codeToken,
                    type: 'magiclink',
                });
                if (magicErr && error) throw error;
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
            const errMsg = error.message || 'Invalid 6-digit code. Please check your email and try again.';
            if (Platform.OS === 'web') alert(errMsg);
            else Alert.alert('Verification Failed', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = () => {
        handleVerifyWithDigits(otp.join(''));
    };

    const handleResend = async () => {
        if (!targetEmail) {
            const msg = 'Email address is missing. Please log in again.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Error', msg);
            return;
        }

        setCounter(60);
        await sendOtpEmail(targetEmail);
        const msg = 'A fresh 6-digit code has been sent to your email inbox.';
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Code Sent', msg);
    };

    const getUserInitial = () => {
        if (userName && userName.trim()) return userName.trim().charAt(0).toUpperCase();
        if (targetEmail && targetEmail.trim()) return targetEmail.trim().charAt(0).toUpperCase();
        return 'U';
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
                            <Ionicons name="arrow-back" size={18} color="#F59E0B" />
                        </TouchableOpacity>

                        <View style={s.securityBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#F59E0B" />
                            <Text style={s.securityBadgeText}>ENCRYPTED OTP</Text>
                        </View>

                        <View style={{ width: 32 }} />
                    </View>

                    {/* Compact Card Content */}
                    <View style={s.card}>
                        {/* Compact Avatar / Logo Badge */}
                        <View style={s.avatarWrapper}>
                            <LinearGradient colors={['#F59E0B', '#D97706', '#78350F']} style={s.avatarBorderRing}>
                                {userAvatar ? (
                                    <Image source={{ uri: userAvatar }} style={s.avatarImage} />
                                ) : (
                                    <View style={s.avatarFallback}>
                                        <Text style={s.avatarInitialText}>{getUserInitial()}</Text>
                                    </View>
                                )}
                            </LinearGradient>
                            <View style={s.activeBadge}>
                                <Ionicons name="mail" size={11} color="#020617" />
                            </View>
                        </View>

                        {/* Title & Subtitle */}
                        <Text style={s.titleText}>Verify Email Code</Text>
                        <Text style={s.subtitleText}>Enter the 6-digit code sent to</Text>
                        <Text style={s.emailHighlightText}>{targetEmail || 'your registered email'}</Text>

                        {/* Compact 6-Digit OTP Box Row */}
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

                        {/* Verify Code Button */}
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
                                        <Ionicons name="checkmark-circle" size={18} color="#020617" />
                                        <Text style={s.verifyBtnText}>Verify Code</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Resend Section */}
                        <View style={s.resendContainer}>
                            <Text style={s.resendLabel}>Didn't receive the email?</Text>
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
        top: -80,
        alignSelf: 'center',
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -80,
        alignSelf: 'center',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 340,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 16,
    },
    securityBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    avatarBorderRing: {
        width: 58,
        height: 58,
        borderRadius: 29,
        padding: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarImage: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        backgroundColor: '#0F172A',
    },
    avatarFallback: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    avatarInitialText: {
        color: '#F59E0B',
        fontSize: 22,
        fontWeight: '900',
    },
    activeBadge: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        backgroundColor: '#F59E0B',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 3,
    },
    subtitleText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    emailHighlightText: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 1,
        marginBottom: 18,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 6,
        marginBottom: 20,
    },
    otpBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
    },
    otpBoxEmpty: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    otpBoxFilled: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: '#F59E0B',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 3,
    },
    otpInput: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        width: '100%',
        textAlign: 'center',
    },
    verifyBtnWrapper: {
        width: '100%',
        marginBottom: 16,
    },
    verifyBtnGradient: {
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    verifyBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    verifyBtnText: {
        color: '#020617',
        fontSize: 14,
        fontWeight: '800',
    },
    resendContainer: {
        alignItems: 'center',
    },
    resendLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 4,
    },
    resendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    resendBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    resendBtnActive: {
        color: '#F59E0B',
    },
    resendBtnDisabled: {
        color: '#64748B',
    },
    counterBadge: {
        marginLeft: 5,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    counterText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '800',
    },
});
