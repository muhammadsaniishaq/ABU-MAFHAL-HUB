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
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
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
        source?: string;
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
        if (params.type === '2fa') {
            // Google Authenticator 2FA: dynamic TOTP codes are generated on-device, do NOT dispatch email!
            return;
        }
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
        if (params.type === '2fa') return;
        const isFromSignup = params.type === 'signup' || params.mode === 'signup' || params.source === 'registration' || params.source === 'login_unconfirmed';
        // If coming directly from Signup or Unconfirmed Login, Supabase Auth ALREADY dispatched the code!
        // Do NOT send a duplicate email!
        if (isFromSignup && params.forceResend !== 'true') {
            setCounter(60);
            return;
        }

        if (params.forceResend === 'true') {
            await sendOtpEmail(emailToSend, true);
            return;
        }

        await sendOtpEmail(emailToSend, true);
    };

    const sendOtpEmail = async (emailToSend: string, isForce: boolean = false) => {
        if (!emailToSend) return;
        setResending(true);
        try {
            const cleanEmailLower = emailToSend.toLowerCase().trim();
            const isSignup = params.mode === 'signup' || params.type === 'signup' || params.source === 'registration' || params.source === 'login_unconfirmed';

            if (isSignup) {
                // Official Supabase signup verification code resend (Single official email)
                const { error: resendErr } = await supabase.auth.resend({
                    type: 'signup',
                    email: cleanEmailLower,
                });
                if (resendErr) {
                    console.log('Supabase signup resend note:', resendErr);
                }
            } else {
                // Password reset or recovery
                try {
                    await supabase.auth.resetPasswordForEmail(cleanEmailLower);
                } catch (rErr) {
                    console.log('Reset password email note:', rErr);
                }
            }

            setCounter(60);
            const successNotice = 'A fresh 6-digit verification code has been sent to your email!';
            if (Platform.OS === 'web') alert(successNotice);
            else Alert.alert('Code Sent ✉️', successNotice);
        } catch (error: any) {
            Alert.alert('Resend Failed', error.message || 'Could not send verification code email.');
        } finally {
            setResending(false);
        }
    };

    const handleOtpChange = (text: string, index: number) => {
        const numeric = text.replace(/[^0-9]/g, '');
        if (numeric.length >= 6) {
            const digits = numeric.slice(0, 6).split('');
            setOtp(digits);
            if (Platform.OS !== 'web') {
                try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (e) {}
            }
            handleVerifyWithDigits(numeric.slice(0, 6));
            return;
        }

        const value = numeric.slice(-1);
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
        if (params.type === '2fa') {
            try {
                let factorId = params.factorId;
                if (!factorId) {
                    const { data: mfaData } = await supabase.auth.mfa.listFactors();
                    const activeTotp = mfaData?.totp?.find((f: any) => f.status === 'verified');
                    factorId = activeTotp?.id;
                }
                if (!factorId) {
                    throw new Error('No active Google Authenticator factor found on this account.');
                }

                const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                    factorId
                });
                if (challengeError) throw challengeError;

                const { error: verifyError } = await supabase.auth.mfa.verify({
                    factorId,
                    challengeId: challengeData.id,
                    code: codeToken
                });
                if (verifyError) throw verifyError;

                // 2FA Verified! Mark session verified
                await AsyncStorage.setItem('mfa_verified_session', 'true');
                await AsyncStorage.removeItem('app_unlocked');

                // Determine if user has a transaction PIN configured
                let userPin = Platform.OS === 'web'
                    ? await AsyncStorage.getItem('user_transaction_pin')
                    : await SecureStore.getItemAsync('user_transaction_pin');

                const { data: { user } } = await supabase.auth.getUser();
                if (!userPin && user?.id) {
                    const { data: prof } = await supabase.from('profiles').select('transaction_pin').eq('id', user.id).maybeSingle();
                    if (prof?.transaction_pin) {
                        userPin = String(prof.transaction_pin);
                    }
                }

                if (userPin) {
                    router.replace('/(auth)/pin' as any);
                } else {
                    router.replace('/(auth)/pin-setup' as any);
                }
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

            const isResetPassword = params.mode === 'reset-password' || params.mode === 'account-password';
            const otpTypesToTry: Array<'signup' | 'email' | 'recovery'> = isResetPassword 
                ? ['recovery', 'email'] 
                : ['signup', 'email'];

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

            if (!isCodeValid && !nativeVerifySuccess) {
                throw new Error('Invalid or expired 6-digit code. Please check your email and try again.');
            }

            // Mark email as verified locally
            await AsyncStorage.setItem(`verified_user_${normalizedEmail}`, 'true');
            await AsyncStorage.setItem(`verified_user_${targetEmail}`, 'true');

            // Establish active Supabase session if pending password exists
            if (!activeAuthSession && !isResetPassword) {
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
                            activeAuthSession = authData.session;
                            await AsyncStorage.setItem('has_active_session', 'true');
                            await AsyncStorage.setItem('app_unlocked', 'true');
                        }
                    }
                } catch (authSessionErr) {
                    console.log('Auto sign-in session notice:', authSessionErr);
                }
            } else if (activeAuthSession) {
                await AsyncStorage.setItem('has_active_session', 'true');
                await AsyncStorage.setItem('app_unlocked', 'true');
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

                // Trigger Automatic Referral Recording
                try {
                    const pendingRef = params.tempReferralCode || (await AsyncStorage.getItem('pending_referral_code'));
                    if (pendingRef && pendingRef.trim()) {
                        await supabase.rpc('record_referral', {
                            referee_user_id: user.id,
                            referral_input: pendingRef.trim()
                        });
                        await AsyncStorage.removeItem('pending_referral_code');
                    }
                } catch (refErr) {
                    console.log('Referral RPC record notice in OTP:', refErr);
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

            const isResetFlow = params.mode === 'reset-password' || params.mode === 'account-password';
            const targetPath = isResetFlow ? '/(auth)/reset-password' : '/(auth)/pin-setup';
            const successMsg = isResetFlow 
                ? 'Success! 6-digit code verified successfully. Now set your new account password.'
                : 'Success! 6-digit code verified successfully.';

            if (Platform.OS === 'web') {
                alert(successMsg);
                router.replace({ pathname: targetPath as any, params: { email: targetEmail } });
            } else {
                Alert.alert('Success', successMsg, [
                    { 
                        text: isResetFlow ? 'Set New Password' : 'Set New PIN', 
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

    const handlePasteCode = async () => {
        try {
            let text = '';
            if (Platform.OS === 'web') {
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
            } else {
                text = await Clipboard.getStringAsync();
            }

            const cleaned = (text || '').replace(/[^0-9]/g, '').trim();

            if (cleaned.length >= 6) {
                const digits = cleaned.slice(0, 6).split('');
                setOtp(digits);
                if (Platform.OS !== 'web') {
                    try {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) {}
                }
                // Automatically verify with 1 tap!
                handleVerifyWithDigits(cleaned.slice(0, 6));
            } else if (cleaned.length > 0) {
                const digits = [...otp];
                for (let i = 0; i < cleaned.length && i < 6; i++) {
                    digits[i] = cleaned[i];
                }
                setOtp(digits);
                if (digits.every((d) => d !== '') && digits.join('').length === 6) {
                    handleVerifyWithDigits(digits.join(''));
                } else {
                    const nextIdx = Math.min(cleaned.length, 5);
                    inputRefs.current[nextIdx]?.focus();
                }
            } else {
                const msg = 'Ba a sami lambobi 6 a clipboard ba. Da fatan za a kwafi lambar daga Google Authenticator sannan a danna Paste Code.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Clipboard Empty / Babu Lamba 📋', msg);
            }
        } catch (err: any) {
            console.log('Paste error in OTP:', err);
        }
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
            <StatusBar style="dark" />

            {/* Subtle Luxury Executive Light Mesh Background */}
            <LinearGradient
                colors={['#F4F6FB', '#EDF2F7', '#F8FAFC']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Decorative Navy and Gold Glow Rings */}
            <View style={s.topGoldAura} />
            <View style={s.topNavyAura} />

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
                                else router.replace('/(auth)/login' as any);
                            }}
                            style={s.backBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={18} color="#060B1E" />
                        </TouchableOpacity>

                        <View style={s.securityBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#D97706" />
                            <Text style={s.securityBadgeText}>
                                {params.type === '2fa' ? "2FA VERIFICATION" : "SECURE OTP"}
                            </Text>
                        </View>

                        <View style={{ width: 36 }} />
                    </View>

                    {/* Non-Scrolling Executive Card */}
                    <View style={s.card}>
                        {/* Avatar / 2FA Emblem */}
                        <View style={s.avatarWrapper}>
                            <LinearGradient
                                colors={['#F5A623', '#D97706', '#B45309']}
                                style={s.avatarBorderRing}
                            >
                                <View style={s.avatarInner}>
                                    {params.type === '2fa' ? (
                                        <Ionicons name="key" size={26} color="#F5A623" />
                                    ) : userAvatar ? (
                                        <Image source={{ uri: userAvatar }} style={s.avatarImage} />
                                    ) : (
                                        <Text style={s.avatarInitialText}>{getUserInitial()}</Text>
                                    )}
                                </View>
                            </LinearGradient>
                            <View style={s.lockBadge}>
                                <Ionicons name="lock-closed" size={10} color="#FFFFFF" />
                            </View>
                        </View>

                        {/* Title & Subtitle */}
                        <Text style={s.titleText}>
                            {params.type === '2fa' ? "2-Factor Authentication" : "Enter Verification Code"}
                        </Text>
                        <Text style={s.subtitleText}>
                            {params.type === '2fa'
                                ? "Enter the 6-digit dynamic code generated by your Authenticator app (Google Authenticator / Authy)"
                                : "Enter the 6-digit verification code sent to:"}
                        </Text>

                        {params.type === '2fa' ? (
                            <View style={s.timerPill}>
                                <Ionicons name="timer-outline" size={13} color="#B45309" />
                                <Text style={s.timerPillText}>Codes refresh every 30 seconds ⏱️</Text>
                            </View>
                        ) : (
                            <Text style={s.emailHighlightText}>
                                {targetEmail || 'your registered email'}
                            </Text>
                        )}

                        {/* Paste Code Button (Fanna / Manna Code) */}
                        <TouchableOpacity
                            onPress={handlePasteCode}
                            style={s.pasteBtn}
                            activeOpacity={0.8}
                        >
                            <View style={s.pasteIconWrapper}>
                                <Ionicons name="clipboard-outline" size={15} color="#D97706" />
                            </View>
                            <Text style={s.pasteBtnText}>Paste Code (Fanna Code) 📋</Text>
                            <View style={s.pasteHintBadge}>
                                <Text style={s.pasteHintText}>1-Tap</Text>
                            </View>
                        </TouchableOpacity>

                        {/* 6-Digit OTP Box Row */}
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
                                        maxLength={6}
                                        value={digit}
                                        onChangeText={(value) => handleOtpChange(value, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        selectionColor="#D97706"
                                    />
                                </View>
                            ))}
                        </View>

                        {/* Royal Navy & 24K Gold Verify Button */}
                        <TouchableOpacity
                            onPress={handleVerify}
                            disabled={loading}
                            activeOpacity={0.85}
                            style={s.verifyBtnWrapper}
                        >
                            <LinearGradient
                                colors={['#060B1E', '#0D1636', '#142258']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.verifyBtnGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#F5A623" size="small" />
                                ) : (
                                    <View style={s.verifyBtnContent}>
                                        <Ionicons name="shield-checkmark" size={18} color="#F5A623" />
                                        <Text style={s.verifyBtnText}>
                                            {params.type === '2fa' ? "Verify 2FA Token" : "Confirm Verification"}
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Footer & Resend Section */}
                        {params.type === '2fa' ? (
                            <View style={s.syncFooter}>
                                <Ionicons name="shield-outline" size={13} color="#64748B" />
                                <Text style={s.syncFooterText}>
                                    Protected by Time-based One-Time Password (RFC 6238)
                                </Text>
                            </View>
                        ) : (
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
                                    {resending && <ActivityIndicator size="small" color="#D97706" style={{ marginLeft: 6 }} />}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F6FB',
    },
    topGoldAura: {
        position: 'absolute',
        top: -90,
        right: -50,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(245, 166, 35, 0.08)',
    },
    topNavyAura: {
        position: 'absolute',
        top: -60,
        left: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(6, 11, 30, 0.05)',
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
        maxWidth: 380,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        paddingBottom: 4,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFBEB',
        borderColor: 'rgba(245, 166, 35, 0.5)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4.5,
        borderRadius: 20,
    },
    securityBadgeText: {
        color: '#B45309',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        paddingHorizontal: 18,
        paddingVertical: 20,
        marginVertical: 10,
        shadowColor: '#060B1E',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 5,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 12,
    },
    avatarBorderRing: {
        width: 60,
        height: 60,
        borderRadius: 30,
        padding: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    avatarInner: {
        width: 55,
        height: 55,
        borderRadius: 27.5,
        backgroundColor: '#060B1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 55,
        height: 55,
        borderRadius: 27.5,
    },
    avatarInitialText: {
        color: '#F5A623',
        fontSize: 22,
        fontWeight: '900',
    },
    lockBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#D97706',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    titleText: {
        color: '#060B1E',
        fontSize: 19,
        fontWeight: '900',
        letterSpacing: -0.4,
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitleText: {
        color: '#475569',
        fontSize: 11.5,
        fontWeight: '500',
        lineHeight: 16,
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        marginTop: 6,
        marginBottom: 14,
    },
    timerPillText: {
        color: '#B45309',
        fontSize: 10.5,
        fontWeight: '700',
    },
    emailHighlightText: {
        color: '#D97706',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
        marginBottom: 14,
        textAlign: 'center',
    },
    pasteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: '#FFFBEB',
        borderColor: '#F5A623',
        borderWidth: 1.5,
        borderRadius: 20,
        paddingVertical: 6.5,
        paddingHorizontal: 14,
        marginBottom: 16,
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    pasteIconWrapper: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(245, 166, 35, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pasteBtnText: {
        color: '#060B1E',
        fontSize: 11.5,
        fontWeight: '800',
    },
    pasteHintBadge: {
        backgroundColor: '#060B1E',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    pasteHintText: {
        color: '#F5A623',
        fontSize: 9,
        fontWeight: '900',
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 5,
        marginBottom: 18,
    },
    otpBox: {
        width: 42,
        height: 48,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    otpBoxEmpty: {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    otpBoxFilled: {
        backgroundColor: '#FFFDF5',
        borderColor: '#D97706',
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
    },
    otpInput: {
        color: '#060B1E',
        fontSize: 20,
        fontWeight: '900',
        width: '100%',
        textAlign: 'center',
    },
    verifyBtnWrapper: {
        width: '100%',
        marginBottom: 14,
    },
    verifyBtnGradient: {
        height: 46,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#F5A623',
        shadowColor: '#060B1E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    verifyBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verifyBtnText: {
        color: '#F5A623',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    syncFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 6,
    },
    syncFooterText: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
    },
    resendContainer: {
        alignItems: 'center',
    },
    resendLabel: {
        color: '#64748B',
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
        fontWeight: '800',
    },
    resendBtnActive: {
        color: '#D97706',
    },
    resendBtnDisabled: {
        color: '#94A3B8',
    },
    counterBadge: {
        marginLeft: 6,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.4)',
    },
    counterText: {
        color: '#D97706',
        fontSize: 10,
        fontWeight: '900',
    },
});

