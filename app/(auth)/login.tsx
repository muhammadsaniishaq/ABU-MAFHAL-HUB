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
    const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
    const [googleAuthUrl, setGoogleAuthUrl] = useState<string | null>(null);

    useEffect(() => {
        checkBiometrics();
        loadSavedCredentials();

        // Listen for Auth State changes (e.g. from Google OAuth popup completion)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
                setShowGoogleAuthModal(false);
                setSocialLoading(null);
                router.replace('/dashboard' as any);
            }
        });

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

        return () => {
            subscription?.unsubscribe();
        };
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
                // Centered popup window geometry
                const popupWidth = 500;
                const popupHeight = 620;
                const left = typeof window !== 'undefined' ? Math.max(0, Math.floor(window.screenX + (window.outerWidth - popupWidth) / 2)) : 50;
                const top = typeof window !== 'undefined' ? Math.max(0, Math.floor(window.screenY + (window.outerHeight - popupHeight) / 2)) : 50;

                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: provider as any,
                    options: {
                        ...options,
                        skipBrowserRedirect: true,
                    },
                });
                if (error) throw error;

                if (data?.url && typeof window !== 'undefined') {
                    setGoogleAuthUrl(data.url);
                    setShowGoogleAuthModal(true);

                    const popup = window.open(
                        data.url,
                        'GoogleAuthPopup',
                        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no,resizable=yes,scrollbars=yes`
                    );

                    if (popup) {
                        const checkInterval = setInterval(async () => {
                            if (popup.closed) {
                                clearInterval(checkInterval);
                                setSocialLoading(null);
                                const { data: { session } } = await supabase.auth.getSession();
                                if (session) {
                                    setShowGoogleAuthModal(false);
                                    router.replace('/dashboard' as any);
                                }
                            }
                        }, 800);
                    }
                }
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
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Top Control Bar with Brand, Support & Theme Toggle */}
                        <View style={styles.topControlRow}>
                            <View style={styles.brandRow}>
                                <Image
                                    source={getLogoSource()}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                                <View style={{ marginLeft: 6 }}>
                                    <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>ABUMAFHAL</Text>
                                    <Text style={[styles.brandTagline, { color: '#F59E0B' }]}>ROYAL FINTECH & DIGITAL HUB</Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {/* WhatsApp Quick Support Header Action */}
                                <TouchableOpacity
                                    onPress={() => Linking.openURL('https://wa.me/2348001234567?text=Hello%20ABUMAFHAL%20Support')}
                                    style={[styles.supportHeaderBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#E6F4EA', borderColor: '#10B981' }]}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="logo-whatsapp" size={12} color="#10B981" />
                                    <Text style={[styles.supportHeaderBtnText, { color: isDark ? '#6EE7B7' : '#047857' }]}>Help</Text>
                                </TouchableOpacity>

                                {/* Theme Toggle */}
                                <TouchableOpacity 
                                    onPress={toggleTheme} 
                                    style={[styles.themeToggleBtn, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name={isDark ? "sunny" : "moon"} size={13} color={isDark ? "#FDE047" : "#0F172A"} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Royal Gold Header Accent Line */}
                        <View style={{ height: 2, backgroundColor: '#F59E0B', borderRadius: 1, marginVertical: 6, opacity: 0.8 }} />

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
                                <View style={{ flexDirection: 'row', gap: 5, marginTop: 5, justifyContent: 'center' }}>
                                    <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#F59E0B' }}>
                                        <Text style={{ color: isDark ? '#FDE047' : '#92400E', fontSize: 8, fontWeight: '900' }}>⚡ Instant VTU</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#D1FAE5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#10B981' }}>
                                        <Text style={{ color: isDark ? '#6EE7B7' : '#065F46', fontSize: 8, fontWeight: '900' }}>🔒 100% Encrypted</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#DBEAFE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#3B82F6' }}>
                                        <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 8, fontWeight: '900' }}>💎 Zero Cashout Fee</Text>
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
                                        size={15} 
                                        color={focusedInput === 'identifier' ? '#F59E0B' : theme.textMuted} 
                                        style={{ marginRight: 6 }} 
                                    />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="Enter Email or Phone Number"
                                        placeholderTextColor={theme.textMuted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={identifier}
                                        onChangeText={setIdentifier}
                                        onFocus={() => setFocusedInput('identifier')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Password Input */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 2 }}>
                                    <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Password</Text>
                                    <TouchableOpacity 
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={[styles.eyeTogglePillBtn, { backgroundColor: showPassword ? 'rgba(245, 158, 11, 0.18)' : isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9' }]}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={13} color={showPassword ? "#F59E0B" : theme.textMuted} />
                                        <Text style={[styles.eyeTogglePillBtnText, { color: showPassword ? '#F59E0B' : theme.textMuted }]}>
                                            {showPassword ? "Hide 🙈" : "Show 👁️"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? '#F59E0B' : theme.borderPrimary }
                                ]}>
                                    <Ionicons 
                                        name="lock-closed" 
                                        size={15} 
                                        color={focusedInput === 'password' ? '#F59E0B' : theme.textMuted} 
                                        style={{ marginRight: 6 }} 
                                    />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="••••••••••••"
                                        placeholderTextColor={theme.textMuted}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        onFocus={() => setFocusedInput('password')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                    <TouchableOpacity 
                                        onPress={() => setShowPassword(!showPassword)} 
                                        style={[styles.eyeTogglePillBtn, { backgroundColor: showPassword ? 'rgba(245, 158, 11, 0.18)' : isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9', marginLeft: 6 }]}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={14} color={showPassword ? "#F59E0B" : theme.textMuted} />
                                        <Text style={[styles.eyeTogglePillBtnText, { color: showPassword ? '#F59E0B' : theme.textMuted }]}>
                                            {showPassword ? "Hide 🙈" : "Show 👁️"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Security Active Micro Banner */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, gap: 4 }}>
                                    <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                    <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 8.5, fontWeight: '700' }}>
                                        Bank-Grade 256-Bit SSL Encrypted Session
                                    </Text>
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
                                            {rememberMe && <Ionicons name="checkmark" size={9} color="#0F172A" />}
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
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                    <LinearGradient 
                                        colors={['#F59E0B', '#D97706']} 
                                        style={styles.primaryBtnGradient}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#0F172A" size="small" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.primaryBtnText}>Sign In to Account</Text>
                                                <Ionicons name="arrow-forward-circle" size={15} color="#0F172A" style={{ marginLeft: 5 }} />
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
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Ionicons name={biometricType === 'Face ID' ? "scan-outline" : "finger-print"} size={14} color="#F59E0B" style={{ marginRight: 5 }} />
                                        <Text style={[styles.biometricBtnText, { color: isDark ? '#FDE047' : '#92400E' }]}>
                                            Quick Sign In with {biometricType}
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
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
                                            <Text style={[styles.googleLoginBtnText, { color: theme.textPrimary }]}>Continue with Google</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Footer Link */}
                                <View style={styles.footerLinkRow}>
                                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>Don't have an account?</Text>
                                    <TouchableOpacity 
                                        onPress={() => router.push('/signup' as any)} 
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

            {/* Centered Google Auth Modal with App Logo & Name */}
            <Modal
                visible={showGoogleAuthModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowGoogleAuthModal(false);
                    setSocialLoading(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.googleAuthModalCard, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#E2E8F0' }]}>
                        {/* App Logo & Brand Header */}
                        <View style={{ alignItems: 'center', marginBottom: 14 }}>
                            <Image 
                                source={getLogoSource()} 
                                style={{ width: 50, height: 50, marginBottom: 6 }} 
                                resizeMode="contain" 
                            />
                            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.textPrimary, letterSpacing: 0.5 }}>
                                ABUMAFHAL
                            </Text>
                            <Text style={{ color: '#F59E0B', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 }}>
                                ROYAL FINTECH
                            </Text>
                        </View>

                        {/* Google Auth Status Box */}
                        <View style={{ backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <Image 
                                    source={require('../../assets/images/google-g.png')} 
                                    style={{ width: 20, height: 20 }} 
                                    resizeMode="contain" 
                                />
                                <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.textPrimary }}>
                                    Google Secure Sign-In
                                </Text>
                            </View>
                            <ActivityIndicator size="small" color="#F59E0B" style={{ marginVertical: 6 }} />
                            <Text style={{ fontSize: 10.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 15 }}>
                                A centered Google authorization popup is open. Please choose your Google account to sign in securely.
                            </Text>
                        </View>

                        {/* Fallback Action to Re-Open Window */}
                        {googleAuthUrl && (
                            <TouchableOpacity 
                                onPress={() => {
                                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                        const popupWidth = 500;
                                        const popupHeight = 620;
                                        const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - popupWidth) / 2));
                                        const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - popupHeight) / 2));
                                        window.open(googleAuthUrl, 'GoogleAuthPopup', `width=${popupWidth},height=${popupHeight},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no,resizable=yes,scrollbars=yes`);
                                    }
                                }}
                                style={{ backgroundColor: '#F59E0B', height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
                                activeOpacity={0.8}
                            >
                                <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 11.5 }}>
                                    Re-open Centered Window 🪟
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            onPress={() => {
                                setShowGoogleAuthModal(false);
                                setSocialLoading(null);
                            }}
                            style={{ paddingVertical: 6, alignItems: 'center' }}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>
                                Cancel
                            </Text>
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
        flexGrow: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 4 : 8,
        paddingBottom: 12,
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
    logoImage: {
        width: 32,
        height: 32,
        marginRight: 6,
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 0.4,
    },
    brandTagline: {
        fontWeight: '700',
        fontSize: 7.5,
        letterSpacing: 0.6,
    },
    supportHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        gap: 3,
    },
    supportHeaderBtnText: {
        fontSize: 9,
        fontWeight: '800',
    },
    themeToggleBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrapper: {
        width: '100%',
        flex: 1,
        justifyContent: 'space-evenly',
        marginTop: 2,
    },
    desktopCardWrapper: {
        maxWidth: 420,
        alignSelf: 'center',
        marginTop: 6,
    },
    mascotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
    },
    headlineBox: {
        alignItems: 'center',
        marginBottom: 8,
    },
    welcomeTitle: {
        fontWeight: '900',
        fontSize: 17.5,
        textAlign: 'center',
    },
    welcomeSubText: {
        fontSize: 9.5,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
        lineHeight: 13,
    },
    loginTypeContainer: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 2,
        marginBottom: 8,
    },
    loginTypeTab: {
        flex: 1,
        height: 30,
        borderRadius: 8,
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
        fontSize: 9.5,
        fontWeight: '600',
    },
    formContainer: {
        width: '100%',
    },
    inputLabel: {
        fontWeight: '800',
        fontSize: 10,
        marginBottom: 3,
    },
    inputFieldBox: {
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        fontSize: 11.5,
        fontWeight: '600',
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        marginBottom: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxBox: {
        width: 14,
        height: 14,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 5,
    },
    checkboxLabel: {
        fontSize: 9.5,
        fontWeight: '600',
    },
    forgotLink: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    primaryLoginBtn: {
        borderRadius: 19,
        overflow: 'hidden',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 6,
    },
    primaryBtnGradient: {
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 12,
    },
    biometricBtn: {
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    biometricBtnText: {
        fontWeight: '800',
        fontSize: 10,
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
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginHorizontal: 8,
    },
    googleLoginBtn: {
        width: '100%',
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    googleLoginBtnText: {
        fontWeight: '800',
        fontSize: 11,
        letterSpacing: 0.2,
    },
    socialGrid: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    socialTile: {
        flex: 1,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialTileText: {
        fontWeight: '700',
        fontSize: 9.5,
        marginLeft: 4,
    },
    footerLinkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        paddingVertical: 2,
    },
    footerText: {
        fontSize: 10,
        fontWeight: '500',
    },
    signupLinkText: {
        fontSize: 10,
        fontWeight: '800',
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
