import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, 
    Platform, Image, ScrollView, ActivityIndicator, StyleSheet, 
    useWindowDimensions, Alert, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

import { supabase, processOAuthReturn } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useAuthTheme } from '../../hooks/useAuthTheme';
import Mascot3D from '../../components/Mascot3D';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const { width, height } = useWindowDimensions();
    const isTabletOrDesktop = width >= 768;
    const router = useRouter();
    const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
    const { settings } = useAppSettings();
    const { isDark, toggleTheme, theme } = useAuthTheme();

    // Form States
    const [loginType, setLoginType] = useState<'email' | 'phone'>('email');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    // Focus & Micro-interaction States
    const [focusedInput, setFocusedInput] = useState<'identifier' | 'password' | null>(null);

    // Processing & Social Loading States
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState<string>('Biometrics');

    // Forgot Password & Wallet Modal States
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);

    useEffect(() => {
        checkBiometrics();
        loadSavedCredentials();

        // Listen for Google OAuth returns & error responses in web URL query/hash params
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            (async () => {
                const isOAuthSessionSet = await processOAuthReturn();
                if (isOAuthSessionSet) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        let localPin = await AsyncStorage.getItem('user_transaction_pin');
                        if (!localPin) {
                            const { data } = await supabase
                                .from('profiles')
                                .select('transaction_pin')
                                .eq('id', session.user.id)
                                .maybeSingle();

                            if (data?.transaction_pin) {
                                localPin = data.transaction_pin;
                                await AsyncStorage.setItem('user_transaction_pin', localPin as string);
                            }
                        }

                        if (!localPin) {
                            router.replace('/pin-setup' as any);
                        } else {
                            router.replace('/dashboard' as any);
                        }
                        return;
                    }
                }

                try {
                    const searchParams = new URLSearchParams(window.location.search);
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
                    const errCode = searchParams.get('error') || hashParams.get('error');

                    if (errorDesc || errCode) {
                        const cleanError = (errorDesc || errCode || '').replace(/\+/g, ' ');
                        Alert.alert('Google Authentication Notice', cleanError);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } catch (e) {}
            })();
        }
    }, []);


    const loadSavedCredentials = async () => {
        try {
            const savedId = await AsyncStorage.getItem('saved_user_identifier');
            if (savedId) {
                setIdentifier(savedId);
                if (savedId.includes('@')) setLoginType('email');
                else setLoginType('phone');
            }
        } catch (e) {
            console.warn('Failed loading saved credentials', e);
        }
    };

    const checkBiometrics = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && isEnrolled) {
                setBiometricAvailable(true);
                const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
                if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                    setBiometricType('Face ID');
                } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                    setBiometricType('Fingerprint');
                }
            }
        } catch (e) {
            console.warn('Biometric check error', e);
        }
    };

    const handleBiometricAuth = async () => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: `Sign in to ABUMAFHAL with ${biometricType}`,
                fallbackLabel: 'Use Password',
                cancelLabel: 'Cancel',
            });

            if (result.success) {
                const savedId = await AsyncStorage.getItem('saved_user_identifier');
                const savedPass = await AsyncStorage.getItem('saved_user_pass_secure');

                if (savedId && savedPass) {
                    setIdentifier(savedId);
                    setPassword(savedPass);
                    handleLoginWithCredentials(savedId, savedPass);
                } else {
                    Alert.alert('Setup Required', 'Please log in with your email and password once to enable quick biometric sign in.');
                }
            }
        } catch (e: any) {
            Alert.alert('Biometric Authentication Error', e.message || 'Could not authenticate.');
        }
    };

    const handleLogin = () => {
        handleLoginWithCredentials(identifier, password);
    };

    const handleLoginWithCredentials = async (userIdent: string, userPass: string) => {
        const cleanIdent = userIdent.trim();
        if (!cleanIdent || !userPass) {
            const msg = 'Please enter your email, phone number, or username and password.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Missing Credentials', msg);
            return;
        }

        setLoading(true);
        try {
            let emailToUse = cleanIdent;
            const isEmailInput = cleanIdent.includes('@');

            if (!isEmailInput) {
                // Check if user entered phone number or username
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('email, phone_number, username')
                    .or(`phone_number.eq.${cleanIdent},username.eq.${cleanIdent},id.eq.${cleanIdent}`)
                    .maybeSingle();

                if (profile?.email) {
                    emailToUse = profile.email;
                }
            }

            const loginCredentials = emailToUse.includes('@')
                ? { email: emailToUse, password: userPass }
                : { phone: cleanIdent, password: userPass };

            let { data, error } = await supabase.auth.signInWithPassword(loginCredentials);

            if (error) {
                if (error.message.includes('Email not confirmed') || error.message.includes('Email not verified')) {
                    const cleanEmail = emailToUse.toLowerCase().trim();
                    const isLocallyVerified = (await AsyncStorage.getItem(`verified_user_${cleanEmail}`)) === 'true' ||
                                               (await AsyncStorage.getItem(`verified_user_${emailToUse}`)) === 'true';

                    if (isLocallyVerified) {
                        try {
                            await supabase.rpc('confirm_user_email', { target_email: cleanEmail });
                            const retryRes = await supabase.auth.signInWithPassword(loginCredentials);
                            if (!retryRes.error && retryRes.data?.user) {
                                data = retryRes.data;
                                error = null;
                            }
                        } catch (retryErr) {
                            console.log('Auto-confirm retry notice:', retryErr);
                        }
                    }

                    if (error) {
                        await AsyncStorage.setItem('pending_auth_email', cleanEmail);
                        if (userPass) {
                            await AsyncStorage.setItem('pending_auth_pass', userPass);
                        }

                        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

                        await AsyncStorage.setItem(`recovery_otp_${cleanEmail}`, generatedOtp);
                        await AsyncStorage.setItem(`recovery_otp_${emailToUse}`, generatedOtp);
                        await AsyncStorage.setItem('latest_generated_otp', generatedOtp);

                        await AsyncStorage.setItem(`recovery_otp_time_${cleanEmail}`, String(Date.now()));
                        await AsyncStorage.setItem(`recovery_otp_time_${emailToUse}`, String(Date.now()));
                        await AsyncStorage.setItem('latest_generated_otp_time', String(Date.now()));

                        try {
                            await supabase.functions.invoke('send-communication', {
                                body: {
                                    type: 'email',
                                    recipient_mode: 'single',
                                    recipient: cleanEmail,
                                    subject: 'Your 6-Digit Verification Code 🔒 - ABU MAFHAL SUB',
                                    body: `
                                        <div style="background-color:#020617; padding:28px; border-radius:16px; color:#ffffff; font-family:sans-serif; text-align:center; max-width:440px; margin:0 auto; border:1px solid rgba(245,158,11,0.3);">
                                            <h2 style="color:#F59E0B; font-size:22px; margin-bottom:4px;">ABU MAFHAL SUB</h2>
                                            <p style="color:#94A3B8; font-size:13px; margin-bottom:18px;">Account Email Verification</p>
                                            <p style="color:#CBD5E1; font-size:13px; margin-bottom:10px;">Your 6-digit verification code is:</p>
                                            <div style="background:rgba(245,158,11,0.15); border:2px dashed #F59E0B; color:#F59E0B; font-size:32px; font-weight:900; letter-spacing:8px; padding:16px; border-radius:14px; margin:16px 0;">
                                                ${generatedOtp}
                                            </div>
                                            <p style="color:#64748B; font-size:11px; margin-top:16px;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
                                        </div>
                                    `,
                                },
                            });
                        } catch (e) {
                            console.log('Login OTP email dispatch notice:', e);
                        }

                        try {
                            await supabase.auth.resend({ type: 'signup', email: cleanEmail });
                        } catch (e) {}

                        router.push({
                            pathname: '/otp' as any,
                            params: { email: cleanEmail, mode: 'signup', forceResend: 'true' }
                        });
                        setLoading(false);
                        return;
                    }
                } else {
                    throw error;
                }
            }

            if (data?.user) {
                if (rememberMe) {
                    await AsyncStorage.setItem('saved_user_identifier', cleanIdent);
                    await AsyncStorage.setItem('saved_user_pass_secure', userPass);
                }

                const cleanEmail = emailToUse.toLowerCase().trim();
                const isLocallyVerified = (await AsyncStorage.getItem(`verified_user_${cleanEmail}`)) === 'true' ||
                                           (await AsyncStorage.getItem(`verified_user_${data.user.id}`)) === 'true';

                if (settings?.require_email_verif && !data.user.email_confirmed_at && !isLocallyVerified && isEmailInput) {
                    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

                    await AsyncStorage.setItem(`recovery_otp_${cleanEmail}`, generatedOtp);
                    await AsyncStorage.setItem(`recovery_otp_${emailToUse}`, generatedOtp);
                    await AsyncStorage.setItem('latest_generated_otp', generatedOtp);

                    await AsyncStorage.setItem(`recovery_otp_time_${cleanEmail}`, String(Date.now()));
                    await AsyncStorage.setItem(`recovery_otp_time_${emailToUse}`, String(Date.now()));
                    await AsyncStorage.setItem('latest_generated_otp_time', String(Date.now()));

                    try {
                        await supabase.functions.invoke('send-communication', {
                            body: {
                                type: 'email',
                                recipient_mode: 'single',
                                recipient: cleanEmail,
                                subject: 'Your 6-Digit Verification Code 🔒 - ABU MAFHAL SUB',
                                body: `
                                    <div style="background-color:#020617; padding:28px; border-radius:16px; color:#ffffff; font-family:sans-serif; text-align:center; max-width:440px; margin:0 auto; border:1px solid rgba(245,158,11,0.3);">
                                        <h2 style="color:#F59E0B; font-size:22px; margin-bottom:4px;">ABU MAFHAL SUB</h2>
                                        <p style="color:#94A3B8; font-size:13px; margin-bottom:18px;">Account Email Verification</p>
                                        <p style="color:#CBD5E1; font-size:13px; margin-bottom:10px;">Your 6-digit verification code is:</p>
                                        <div style="background:rgba(245,158,11,0.15); border:2px dashed #F59E0B; color:#F59E0B; font-size:32px; font-weight:900; letter-spacing:8px; padding:16px; border-radius:14px; margin:16px 0;">
                                            ${generatedOtp}
                                        </div>
                                        <p style="color:#64748B; font-size:11px; margin-top:16px;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
                                    </div>
                                `,
                            },
                        });
                    } catch (e) {}

                    router.push({
                        pathname: '/otp' as any,
                        params: { email: cleanEmail, mode: 'signup', forceResend: 'true' }
                    });
                    setLoading(false);
                    return;
                }

                let ip = "Unknown IP";
                try {
                    const res = await fetch('https://api.ipify.org?format=json');
                    const json = await res.json();
                    ip = json.ip;
                } catch (e) { console.log("Failed fetching IP", e); }

                await supabase.from('notifications').insert({
                    user_id: data.user.id,
                    title: "New Login Detected 🔐",
                    body: `New login from IP: ${ip} on ${Platform.OS.toUpperCase()}.`,
                    data: { priority: 'high', type: 'security', ip }
                });

                const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];
                const userEmail = data.user.email ? data.user.email.toLowerCase().trim() : '';
                const isAdminEmail = userEmail && KNOWN_ADMIN_EMAILS.includes(userEmail);

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, status')
                    .eq('id', data.user.id)
                    .maybeSingle();

                let resolvedRole = profile?.role;
                if (isAdminEmail) {
                    resolvedRole = 'admin';
                    try { await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id); } catch (err) {}
                } else if (profile?.role === 'admin' && !isAdminEmail) {
                    resolvedRole = 'user';
                    try { await supabase.from('profiles').update({ role: 'user' }).eq('id', data.user.id); } catch (err) {}
                }

                if (profile && profile.status === 'suspended') {
                    Alert.alert('Account Suspended', 'Your account has been suspended. Please contact support.');
                    await supabase.auth.signOut();
                    setLoading(false);
                    return;
                }

                await supabase.from('profiles').update({ 
                    last_login: new Date().toISOString(),
                    status: profile?.status === 'inactive' ? 'active' : profile?.status || 'active'
                }).eq('id', data.user.id);

                await AsyncStorage.setItem(`user_role_${data.user.id}`, resolvedRole || 'user');
                await AsyncStorage.setItem('has_active_session', 'true');
                
                // MANDATORY SECURITY: Lock app on fresh login so PIN or 2FA MUST be entered!
                await AsyncStorage.removeItem('app_unlocked');
                await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));

                // Check 2FA Google Authenticator status
                try {
                    const { data: mfaData } = await supabase.auth.mfa.listFactors();
                    const activeTotp = mfaData?.totp?.find((f: any) => f.status === 'verified');
                    if (activeTotp) {
                        // 2FA is enabled -> Route to 2FA OTP verification!
                        router.replace({
                            pathname: '/(auth)/otp' as any,
                            params: { email: userEmail, type: '2fa', factorId: activeTotp.id }
                        });
                        return;
                    }
                } catch (mfaErr) {
                    console.log('Login MFA check notice:', mfaErr);
                }

                // Check if user has a PIN configured
                let userPin = Platform.OS === 'web'
                    ? await AsyncStorage.getItem('user_transaction_pin')
                    : await SecureStore.getItemAsync('user_transaction_pin');

                if (!userPin) {
                    const { data: profPin } = await supabase
                        .from('profiles')
                        .select('transaction_pin')
                        .eq('id', data.user.id)
                        .maybeSingle();

                    if (profPin?.transaction_pin) {
                        const fetchedPin = profPin.transaction_pin;
                        userPin = fetchedPin;
                        if (Platform.OS === 'web') await AsyncStorage.setItem('user_transaction_pin', fetchedPin);
                        else await SecureStore.setItemAsync('user_transaction_pin', fetchedPin);
                    }
                }

                if (!userPin) {
                    // Fresh user with no PIN set yet -> Must setup PIN first!
                    router.replace('/(auth)/pin-setup' as any);
                } else {
                    // User has PIN -> Must enter PIN on /pin screen! No bypass!
                    router.replace('/(auth)/pin' as any);
                }
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'Please check your credentials and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialAuth = async (provider: 'google' | 'apple' | 'facebook' | 'twitter' | 'github') => {
        if (socialLoading) return;
        setSocialLoading(provider);
        try {
            const redirectUrl = Platform.OS === 'web'
                ? (typeof window !== 'undefined' ? window.location.origin : 'https://abumafhal.com.ng')
                : Linking.createURL('/login');

            const options: any = {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account',
                },
            };

            if (Platform.OS === 'web') {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: provider as any,
                    options,
                });
                if (error) throw error;
            } else {
                options.skipBrowserRedirect = true;
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: provider as any,
                    options,
                });
                if (error) throw error;

                if (data?.url) {
                    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                    if (result.type === 'success' && result.url) {
                        const normalizedUrl = result.url.replace('#', '?');
                        let codeStr: string | null = null;
                        let accessTokenStr: string | null = null;
                        let refreshTokenStr: string | null = null;

                        try {
                            const urlObj = new URL(normalizedUrl);
                            codeStr = urlObj.searchParams.get('code');
                            accessTokenStr = urlObj.searchParams.get('access_token');
                            refreshTokenStr = urlObj.searchParams.get('refresh_token');
                        } catch (e) {
                            const parsed = Linking.parse(normalizedUrl);
                            const q = parsed.queryParams || {};
                            codeStr = Array.isArray(q.code) ? q.code[0] : (q.code as string);
                            accessTokenStr = Array.isArray(q.access_token) ? q.access_token[0] : (q.access_token as string);
                            refreshTokenStr = Array.isArray(q.refresh_token) ? q.refresh_token[0] : (q.refresh_token as string);
                        }

                        if (codeStr) {
                            const { error: exErr } = await supabase.auth.exchangeCodeForSession(codeStr);
                            if (exErr) throw exErr;
                        } else if (accessTokenStr && refreshTokenStr) {
                            const { error: setErr } = await supabase.auth.setSession({
                                access_token: accessTokenStr,
                                refresh_token: refreshTokenStr,
                            });
                            if (setErr) throw setErr;
                        }

                        router.replace('/dashboard' as any);
                    }
                }
            }
        } catch (error: any) {
            Alert.alert(`${provider.toUpperCase()} Login Error`, error.message || 'Failed to sign in with Google.');
        } finally {
            setSocialLoading(null);
        }
    };



    const handleForgotPasswordSubmit = async () => {
        const cleanEmail = resetEmail.trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            const msg = 'Please enter a valid email address.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Invalid Email', msg);
            return;
        }

        setShowForgotModal(false);
        setResetEmail('');
        router.push({
            pathname: '/(auth)/otp' as any,
            params: { email: cleanEmail, mode: 'reset-password' },
        });
    };

    const getLogoSource = () => {
        if (settings?.app_logo) {
            let logoUrl = '';
            if (typeof settings.app_logo === 'string') {
                const trimmed = settings.app_logo.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        logoUrl = parsed.url || parsed.uri || parsed.src || '';
                    } catch (e) {
                        logoUrl = '';
                    }
                } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
                    logoUrl = trimmed;
                }
            } else if (typeof settings.app_logo === 'object') {
                logoUrl = settings.app_logo.url || settings.app_logo.uri || settings.app_logo.src || '';
            }

            if (logoUrl && logoUrl.trim().length > 0) {
                return { uri: logoUrl.trim() };
            }
        }
        return require('../../assets/images/logo.png');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={isDark ? "light" : "dark"} />

            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        scrollEnabled={height < 620}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Top Control Bar with Prestigious Brand, Support & Theme Toggle */}
                        <View style={styles.topControlRow}>
                            <View style={styles.brandRow}>
                                {/* Royal Golden Bezel Decorated Logo */}
                                <View style={styles.royalLogoBezel}>
                                    <LinearGradient
                                        colors={['#F59E0B', '#FDE047', '#D97706']}
                                        style={styles.logoGradientRing}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <View style={[styles.logoInnerDisc, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
                                            <Image
                                                source={getLogoSource()}
                                                style={styles.logoImage}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </LinearGradient>
                                    <View style={[styles.royalStarBadge, { borderColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
                                        <Ionicons name="shield-checkmark" size={9} color="#0F172A" />
                                    </View>
                                </View>

                                <View style={{ marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>
                                            ABU<Text style={{ color: '#F59E0B' }}>MAFHAL</Text>
                                        </Text>
                                        <View style={[styles.proBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7', borderColor: '#F59E0B' }]}>
                                            <Text style={styles.proBadgeText}>5G SUB</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 }} />
                                        <Text style={[styles.brandTagline, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                                            AUTOMATED VTU & HUB
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                {/* WhatsApp Quick Support Header Action */}
                                <TouchableOpacity
                                    onPress={() => Linking.openURL('https://wa.me/2348001234567?text=Hello%20ABUMAFHAL%20Support')}
                                    style={[styles.supportHeaderBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#E6F4EA', borderColor: '#10B981' }]}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="logo-whatsapp" size={13} color="#10B981" />
                                    <Text style={[styles.supportHeaderBtnText, { color: isDark ? '#6EE7B7' : '#047857' }]}>Help</Text>
                                </TouchableOpacity>

                                {/* Theme Toggle */}
                                <TouchableOpacity 
                                    onPress={toggleTheme} 
                                    style={[styles.themeToggleBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: isDark ? '#334155' : '#CBD5E1' }]}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name={isDark ? "sunny" : "moon"} size={13} color={isDark ? "#FDE047" : "#0F172A"} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Multi-Stop Royal Gold Accent Line */}
                        <LinearGradient
                            colors={['rgba(245, 158, 11, 0.05)', '#F59E0B', 'rgba(245, 158, 11, 0.05)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientAccentLine}
                        />

                        {/* Centered Single-Screen Locked Card */}
                        <View style={[styles.cardWrapper, isTabletOrDesktop && styles.desktopCardWrapper]}>
                            
                            {/* Welcome Headline */}
                            <View style={styles.headlineBox}>
                                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                                    Welcome Back <Text style={{ color: '#F59E0B' }}>!</Text>
                                </Text>
                                <Text style={[styles.welcomeSubText, { color: theme.textSecondary }]}>
                                    Sign in to access your royal wallet, VTU services, and rewards.
                                </Text>

                                {/* Feature Pills Badge Row */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                                    <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' }}>
                                        <Text style={{ color: isDark ? '#FDE047' : '#92400E', fontSize: 11, fontWeight: '800' }}>⚡ Instant VTU</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#10B981' }}>
                                        <Text style={{ color: isDark ? '#6EE7B7' : '#065F46', fontSize: 11, fontWeight: '800' }}>🔒 100% Encrypted</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#3B82F6' }}>
                                        <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 11, fontWeight: '800' }}>💎 Zero Fee</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Form Input Fields */}
                            <View style={styles.formContainer}>
                                
                                {/* Login Identifier Input */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                                    Email or Phone Number
                                </Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'identifier' ? '#F59E0B' : theme.borderPrimary }
                                ]}>
                                    <Ionicons 
                                        name="person-circle" 
                                        size={20} 
                                        color={focusedInput === 'identifier' ? '#F59E0B' : theme.textMuted} 
                                        style={{ marginRight: 10 }} 
                                    />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="Email or phone number"
                                        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={identifier}
                                        onChangeText={setIdentifier}
                                        onFocus={() => setFocusedInput('identifier')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Password Input */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 10 }]}>
                                    Password
                                </Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? '#F59E0B' : theme.borderPrimary }
                                ]}>
                                    <Ionicons 
                                        name="lock-closed" 
                                        size={18} 
                                        color={focusedInput === 'password' ? '#F59E0B' : theme.textMuted} 
                                        style={{ marginRight: 10 }} 
                                    />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="Enter password"
                                        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        onFocus={() => setFocusedInput('password')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                    <TouchableOpacity 
                                        onPress={() => {
                                            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                                            setShowPassword(!showPassword);
                                        }} 
                                        style={{ padding: 6 }}
                                        activeOpacity={0.6}
                                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    >
                                        <Ionicons 
                                            name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                            size={22} 
                                            color={showPassword ? "#F59E0B" : theme.textMuted} 
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Options Row */}
                                <View style={styles.optionsRow}>
                                    <TouchableOpacity 
                                        onPress={() => setRememberMe(!rememberMe)} 
                                        style={styles.checkboxRow}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[
                                            styles.checkboxBox, 
                                            rememberMe && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }
                                        ]}>
                                            {rememberMe && <Ionicons name="checkmark" size={13} color="#0F172A" />}
                                        </View>
                                        <Text style={[styles.checkboxLabel, { color: theme.textSecondary }]}>Remember Me</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setShowForgotModal(true)} activeOpacity={0.8}>
                                        <Text style={[styles.forgotLink, { color: '#F59E0B' }]}>Forgot Password?</Text>
                                    </TouchableOpacity>
                                </View>

                                 {/* Primary Login Button */}
                                <TouchableOpacity 
                                    onPress={handleLogin}
                                    disabled={loading}
                                    style={styles.primaryLoginBtn}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient 
                                        colors={['#F59E0B', '#D97706']} 
                                        style={styles.primaryBtnGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#0F172A" size="small" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={styles.primaryBtnText} numberOfLines={1}>Sign In</Text>
                                                <Ionicons name="arrow-forward-circle" size={18} color="#0F172A" style={{ marginLeft: 6 }} />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Quick Biometrics Button */}
                                {biometricAvailable && (
                                    <TouchableOpacity 
                                        onPress={handleBiometricAuth}
                                        style={[styles.biometricBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', borderColor: '#F59E0B' }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name={biometricType === 'Face ID' ? "scan-outline" : "finger-print"} size={17} color="#F59E0B" style={{ marginRight: 6 }} />
                                        <Text style={[styles.biometricBtnText, { color: isDark ? '#FDE047' : '#92400E' }]} numberOfLines={1}>
                                            Sign In with {biometricType}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {/* Social Login Divider */}
                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.borderPrimary }]} />
                                    <Text style={[styles.dividerText, { color: theme.textMuted }]}>OR SIGN IN WITH</Text>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.borderPrimary }]} />
                                </View>

                                {/* Official Google Sign In Button */}
                                <TouchableOpacity 
                                    onPress={() => handleSocialAuth('google')} 
                                    disabled={!!socialLoading} 
                                    style={[
                                        styles.googleLoginBtn, 
                                        { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#CBD5E1' }
                                    ]} 
                                    activeOpacity={0.85}
                                >
                                    {socialLoading === 'google' ? (
                                        <ActivityIndicator size="small" color="#EA4335" />
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                            <Image 
                                                source={require('../../assets/images/google-g.png')} 
                                                style={{ width: 18, height: 18, marginRight: 8 }} 
                                                resizeMode="contain" 
                                            />
                                            <Text style={[styles.googleLoginBtnText, { color: theme.textPrimary }]} numberOfLines={1}>Continue with Google</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Security Active Micro Banner */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 5 }}>
                                    <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                                    <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontWeight: '700' }}>
                                        Bank-Grade 256-Bit SSL Encrypted Session
                                    </Text>
                                </View>

                                {/* Footer Link */}
                                <View style={styles.footerLinkRow}>
                                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>Don't have an account?</Text>
                                    <TouchableOpacity 
                                        onPress={() => router.push('/signup' as any)} 
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.signupLinkText, { color: '#F59E0B' }]}> Create Account</Text>
                                    </TouchableOpacity>
                                </View>

                            </View>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Forgot Password Modal */}
            <Modal transparent visible={showForgotModal} animationType="slide" onRequestClose={() => setShowForgotModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: isDark ? '#0E1A2E' : '#FFFFFF', borderColor: theme.borderPrimary }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Reset Password</Text>
                            <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                                <Ionicons name="close-circle" size={22} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSubText, { color: theme.textSecondary }]}>
                            Enter your email address below to receive password reset instructions.
                        </Text>

                        <TextInput 
                            style={[styles.modalInput, { backgroundColor: theme.bgInput, color: theme.textPrimary, borderColor: theme.borderPrimary }]}
                            placeholder="name@example.com"
                            placeholderTextColor={theme.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={resetEmail}
                            onChangeText={setResetEmail}
                        />

                        <TouchableOpacity 
                            onPress={handleForgotPasswordSubmit}
                            disabled={resetLoading}
                            style={[styles.modalSubmitBtn, { backgroundColor: theme.primaryNavy }]}
                            activeOpacity={0.8}
                        >
                            {resetLoading ? <ActivityIndicator color="#08E4C7" size="small" /> : (
                                <Text style={{ color: '#08E4C7', fontWeight: '800', fontSize: 12 }}>Send Reset Email</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 4 : 8,
        paddingBottom: 24,
    },
    topControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    royalLogoBezel: {
        width: 44,
        height: 44,
        position: 'relative',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 4,
    },
    logoGradientRing: {
        width: 44,
        height: 44,
        borderRadius: 22,
        padding: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoInnerDisc: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 1,
    },
    logoImage: {
        width: '100%',
        height: '100%',
        borderRadius: 19,
    },
    royalStarBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 15,
        height: 15,
        borderRadius: 7.5,
        backgroundColor: '#F59E0B',
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 17,
        letterSpacing: 0.6,
    },
    proBadge: {
        marginLeft: 6,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
        borderWidth: 1,
    },
    proBadgeText: {
        color: '#F59E0B',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    brandTagline: {
        fontWeight: '800',
        fontSize: 8.5,
        letterSpacing: 0.8,
    },
    supportHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 14,
        borderWidth: 1,
        gap: 3,
    },
    supportHeaderBtnText: {
        fontSize: 10,
        fontWeight: '800',
    },
    themeToggleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientAccentLine: {
        height: 2,
        width: '100%',
        marginVertical: 6,
        borderRadius: 1,
    },
    cardWrapper: {
        width: '100%',
        marginTop: 6,
        paddingHorizontal: 2,
    },
    desktopCardWrapper: {
        maxWidth: 440,
        alignSelf: 'center',
        marginTop: 10,
    },
    mascotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 2,
    },
    headlineBox: {
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 10,
    },
    welcomeTitle: {
        fontWeight: '900',
        fontSize: 22,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    welcomeSubText: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
        lineHeight: 16,
    },
    loginTypeContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 2,
        marginBottom: 8,
    },
    loginTypeTab: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    loginTypeTabActive: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
        elevation: 1,
    },
    loginTypeText: {
        fontSize: 12.5,
        fontWeight: '700',
    },
    formContainer: {
        width: '100%',
    },
    inputLabel: {
        fontWeight: '700',
        fontSize: 11.5,
        marginBottom: 3,
    },
    inputFieldBox: {
        height: 44,
        borderRadius: 12,
        borderWidth: 1.2,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        fontSize: 11,
        fontWeight: '400',
        paddingVertical: 0,
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        marginBottom: 10,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    checkboxLabel: {
        fontSize: 12.5,
        fontWeight: '600',
    },
    forgotLink: {
        fontSize: 12.5,
        fontWeight: '800',
    },
    primaryLoginBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 8,
    },
    primaryBtnGradient: {
        height: 45,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    primaryBtnText: {
        color: '#0F172A',
        fontWeight: '800',
        fontSize: 13.5,
        letterSpacing: 0.2,
    },
    biometricBtn: {
        height: 42,
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    biometricBtnText: {
        fontWeight: '700',
        fontSize: 12,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginHorizontal: 8,
    },
    googleLoginBtn: {
        width: '100%',
        height: 44,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    googleLoginBtnText: {
        fontWeight: '700',
        fontSize: 12.5,
        letterSpacing: 0.1,
    },
    socialGrid: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    socialTile: {
        flex: 1,
        height: 40,
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialTileText: {
        fontWeight: '700',
        fontSize: 11.5,
        marginLeft: 5,
    },
    footerLinkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 6,
        paddingVertical: 4,
    },
    footerText: {
        fontSize: 12.5,
        fontWeight: '500',
    },
    signupLinkText: {
        fontSize: 13,
        fontWeight: '900',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(6, 13, 30, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    googleAuthModalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    modalTitle: {
        fontWeight: '800',
        fontSize: 15,
    },
    modalSubText: {
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 15,
        marginBottom: 12,
    },
    modalInput: {
        height: 38,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
    },
    modalSubmitBtn: {
        height: 38,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 99,
    },
    securityPillText: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    eyeTogglePillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    eyeTogglePillBtnText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
});
