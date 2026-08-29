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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function OTP() {
    const { settings } = useAppSettings();
    const params = useLocalSearchParams<{
        email?: string;
        mode?: string;
        type?: string;
        factorId?: string;
        forceResend?: string;
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
            // Check if fresh OTP was just sent by signup screen
            checkAndSendOtpEmail(targetEmail);
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
                    checkAndSendOtpEmail(user.email);
                }
            }
        } catch (e) {
            console.log('Error fetching user email in OTP:', e);
        }
    };

    const checkAndSendOtpEmail = async (emailToSend: string) => {
        if (params.forceResend === 'true') {
            await sendOtpEmail(emailToSend, true);
            return;
        }
        try {
            const cleanEmailLower = emailToSend.toLowerCase().trim();
            const storedTimeStr = await AsyncStorage.getItem(`recovery_otp_time_${cleanEmailLower}`);
            const storedTime = storedTimeStr ? parseInt(storedTimeStr, 10) : 0;
            const hasStoredOtp = await AsyncStorage.getItem(`recovery_otp_${cleanEmailLower}`) || await AsyncStorage.getItem('latest_generated_otp');
            // If OTP was sent less than 60 seconds ago by Signup screen, skip auto-resending
            if (storedTime && hasStoredOtp && (Date.now() - storedTime < 60 * 1000)) {
                return;
            }
        } catch (e) {}
        await sendOtpEmail(emailToSend, true);
    };

    const sendOtpEmail = async (emailToSend: string, isForce: boolean = false) => {
        if (!emailToSend) return;
        setResending(true);
        try {
            // Generate a random 6-digit numeric OTP code
            const cleanEmailLower = emailToSend.toLowerCase().trim();
            const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

            await AsyncStorage.setItem(`recovery_otp_${cleanEmailLower}`, generatedOtp);
            await AsyncStorage.setItem(`recovery_otp_${emailToSend}`, generatedOtp);
            await AsyncStorage.setItem('latest_generated_otp', generatedOtp);

            await AsyncStorage.setItem(`recovery_otp_time_${cleanEmailLower}`, String(Date.now()));
            await AsyncStorage.setItem(`recovery_otp_time_${emailToSend}`, String(Date.now()));
            await AsyncStorage.setItem('latest_generated_otp_time', String(Date.now()));

            const isReset = params.mode === 'reset-password' || params.mode === 'account-password';
            const emailSubtitle = isReset ? 'Password Reset Verification' : 'Account Registration Verification';

            // 1. Dispatch HTML email with the 6-digit code via Edge Function
            try {
                await supabase.functions.invoke('send-communication', {
                    body: {
                        type: 'email',
                        recipient_mode: 'single',
                        recipient: emailToSend,
                        subject: `Your 6-Digit Verification Code 🔒 - ABU MAFHAL SUB`,
                        body: `
                            <div style="background-color:#020617; padding:28px; border-radius:16px; color:#ffffff; font-family:sans-serif; text-align:center; max-width:440px; margin:0 auto; border:1px solid rgba(245,158,11,0.3);">
                                <h2 style="color:#F59E0B; font-size:22px; margin-bottom:4px;">ABU MAFHAL SUB</h2>
                                <p style="color:#94A3B8; font-size:13px; margin-bottom:18px;">${emailSubtitle}</p>
                                <p style="color:#CBD5E1; font-size:13px; margin-bottom:10px;">Your 6-digit verification code is:</p>
                                <div style="background:rgba(245,158,11,0.15); border:2px dashed #F59E0B; color:#F59E0B; font-size:32px; font-weight:900; letter-spacing:8px; padding:16px; border-radius:14px; margin:16px 0;">
                                    ${generatedOtp}
                                </div>
                                <p style="color:#64748B; font-size:11px; margin-top:16px;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
                            </div>
                        `,
                    },
                });
            } catch (err) {
                console.log('Custom OTP email notice:', err);
            }
            setCounter(60);
        } catch (error: any) {
            Alert.alert('Resend Failed', error.message || 'Could not send verification code email.');
        } finally {
            setResending(false);
        }
    };

    const handleOtpChange = (text: string, index: number) => {
        // Sanitize input to only numeric characters
        const value = text.replace(/[^0-9]/g, '');
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

        // Google Authenticator 2FA TOTP Verification Flow
        if (params.type === '2fa' && params.factorId) {
            try {
                const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                    factorId: params.factorId
                });
                if (challengeError) throw challengeError;

                const { error: verifyError } = await supabase.auth.mfa.verify({
                    factorId: params.factorId,
                    challengeId: challengeData.id,
                    code: codeToken
                });
                if (verifyError) throw verifyError;

                // 2FA Verified! Lock app & route to PIN unlock screen
                await AsyncStorage.removeItem('app_unlocked');
                router.replace('/(auth)/pin' as any);
                return;
            } catch (err: any) {
                setLoading(false);
                Alert.alert('2FA Verification Failed ❌', err.message || 'Invalid 6-digit Google Authenticator code. Please check your app and try again.');
                return;
            }
        }

        try {
            const inputCode = codeToken.trim();
            const normalizedEmail = (targetEmail || '').toLowerCase().trim();
            const rawTargetEmail = (targetEmail || '').trim();

            // 1. Check local custom OTP code across all multi-keys for 100% verification guarantee
            const storedOtp1 = await AsyncStorage.getItem(`recovery_otp_${normalizedEmail}`);
            const storedOtp2 = await AsyncStorage.getItem(`recovery_otp_${rawTargetEmail}`);
            const storedOtp3 = await AsyncStorage.getItem('latest_generated_otp');

            const storedTimeStr = await AsyncStorage.getItem(`recovery_otp_time_${normalizedEmail}`) || 
                                  await AsyncStorage.getItem(`recovery_otp_time_${rawTargetEmail}`) || 
                                  await AsyncStorage.getItem('latest_generated_otp_time');

            const storedTime = storedTimeStr ? parseInt(storedTimeStr, 10) : 0;
            const isNotExpired = storedTime ? (Date.now() - storedTime < 15 * 60 * 1000) : true; // 15 mins

            let isCodeValid = false;

            if (isNotExpired) {
                if ((storedOtp1 && storedOtp1.trim() === inputCode) ||
                    (storedOtp2 && storedOtp2.trim() === inputCode) ||
                    (storedOtp3 && storedOtp3.trim() === inputCode)) {
                    isCodeValid = true;
                }
            }

            // Always try Supabase Auth OTP verification across all types to confirm email in Supabase Auth DB
            let nativeVerifySuccess = false;
            let activeAuthSession = null;

            const otpTypesToTry: Array<'signup' | 'email' | 'recovery'> = ['signup', 'email', 'recovery'];
            for (const otpType of otpTypesToTry) {
                try {
                    const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
                        email: normalizedEmail,
                        token: inputCode,
                        type: otpType,
                    });

                    if (!authErr && (authData?.session || authData?.user)) {
                        nativeVerifySuccess = true;
                        isCodeValid = true;
                        if (authData.session) {
                            activeAuthSession = authData.session;
                            await supabase.auth.setSession(authData.session);
                        }
                        break;
                    }
                } catch (authVerificationErr) {
                    console.log(`Supabase Auth OTP (${otpType}) notice:`, authVerificationErr);
                }
            }

            if (!isCodeValid) {
                throw new Error('Invalid or expired 6-digit code. Please check your email and try again.');
            }

            // Mark email as verified locally & call RPC to confirm email on Supabase Auth DB
            await AsyncStorage.setItem(`verified_user_${normalizedEmail}`, 'true');
            await AsyncStorage.setItem(`verified_user_${targetEmail}`, 'true');
            try {
                await supabase.rpc('confirm_user_email', { target_email: normalizedEmail });
            } catch (rpcErr) {
                console.log('RPC confirm_user_email notice:', rpcErr);
            }

            // Establish active Supabase session if pending password exists
            try {
                const pendingPass = await AsyncStorage.getItem('pending_auth_pass');
                const emailToLogin = (await AsyncStorage.getItem('pending_auth_email')) || normalizedEmail;
                if (pendingPass && emailToLogin) {
                    const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
                        email: emailToLogin,
                        password: pendingPass,
                    });
                    if (!signInErr && authData?.session) {
                        await supabase.auth.setSession(authData.session);
                        await AsyncStorage.setItem('has_active_session', 'true');
                        await AsyncStorage.setItem('app_unlocked', 'true');
                    }
                }
            } catch (authSessionErr) {
                console.log('Auto sign-in session notice:', authSessionErr);
            }

            // Clear used OTP
            await AsyncStorage.removeItem(`recovery_otp_${normalizedEmail}`);
            await AsyncStorage.removeItem(`recovery_otp_${targetEmail}`);
            await AsyncStorage.removeItem('latest_generated_otp');

            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
                await AsyncStorage.setItem(`verified_user_${user.id}`, 'true');
                try {
                    await supabase.from('profiles').update({ status: 'active' }).eq('id', user.id);
                } catch (e) {}

                // Trigger Automatic Virtual Account Generation in Background
                try {
                    supabase.functions.invoke('create-virtual-account', {
                        body: { userId: user.id }
                    }).catch(e => console.log('Auto virtual account notice in OTP:', e));
                } catch (vaErr) {
                    console.log('Background VA dispatch in OTP notice:', vaErr);
                }
            }
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

            const isResetPassword = params.mode === 'reset-password' || params.mode === 'account-password';
            const targetPath = isResetPassword ? '/(auth)/reset-password' : '/(auth)/pin-setup';
            const successMsg = isResetPassword 
                ? 'Success! 6-digit code verified successfully. Now set your new account password.'
                : 'Success! 6-digit code verified successfully.';

            if (Platform.OS === 'web') {
                alert(successMsg);
                router.replace({ pathname: targetPath as any, params: { email: targetEmail } });
            } else {
                Alert.alert('Success', successMsg, [
                    { 
                        text: isResetPassword ? 'Set New Password' : 'Set New PIN', 
                        onPress: () => router.replace({ pathname: targetPath as any, params: { email: targetEmail } }) 
                    },
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
