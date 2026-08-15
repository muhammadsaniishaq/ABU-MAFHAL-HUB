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

import { supabase } from '../../services/supabase';
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

        // Listen for Google OAuth error responses in web URL query/hash params
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
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
            Alert.alert('Missing Credentials', 'Please enter your email/phone and password.');
            return;
        }

        setLoading(true);
        try {
            const isEmailInput = cleanIdent.includes('@');
            const loginCredentials = isEmailInput 
                ? { email: cleanIdent, password: userPass }
                : { phone: cleanIdent, password: userPass };

            const { data, error } = await supabase.auth.signInWithPassword(loginCredentials);

            if (error) {
                if (error.message.includes('Email not confirmed') || error.message.includes('Email not verified')) {
                    router.push({
                        pathname: '/otp' as any,
                        params: { email: isEmailInput ? cleanIdent : '', type: 'signup' }
                    });
                    return;
                }
                throw error;
            }

            if (data.user) {
                if (rememberMe) {
                    await AsyncStorage.setItem('saved_user_identifier', cleanIdent);
                    await AsyncStorage.setItem('saved_user_pass_secure', userPass);
                }

                if (settings?.require_email_verif && !data.user.email_confirmed_at && isEmailInput) {
                    router.push({
                        pathname: '/otp' as any,
                        params: { email: cleanIdent, type: 'signup' }
                    });
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
                const isAdminEmail = userEmail && (KNOWN_ADMIN_EMAILS.includes(userEmail) || userEmail.includes('admin'));

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, status')
                    .eq('id', data.user.id)
                    .maybeSingle();

                let resolvedRole = profile?.role;
                if (isAdminEmail) {
                    resolvedRole = 'admin';
                    try { await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id); } catch (err) {}
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
                await AsyncStorage.setItem('app_unlocked', 'true');
                await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));

                const validRedirect = redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith('/') && !redirectTo.includes('://') && !redirectTo.includes('/auth/login') ? redirectTo : null;

                if (validRedirect) {
                    router.replace(validRedirect as any);
                } else {
                    router.replace('/dashboard' as any);
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
                        {/* Top Control Bar with Brand & Security Badge */}
                        <View style={styles.topControlRow}>
                            <View style={styles.brandRow}>
                                <Image
                                    source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                                <View style={{ marginLeft: 6 }}>
                                    <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>ABUMAFHAL</Text>
                                    <Text style={[styles.brandTagline, { color: '#F59E0B' }]}>ROYAL FINTECH & DIGITAL HUB</Text>
                                </View>
                            </View>

                            {/* Security Badge Pill */}
                            <View style={[styles.securityPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.08)', borderColor: '#F59E0B', borderWidth: 1 }]}>
                                <Ionicons name="shield-checkmark" size={11} color="#F59E0B" style={{ marginRight: 3 }} />
                                <Text style={[styles.securityPillText, { color: isDark ? '#F59E0B' : '#0F172A' }]}>256-Bit SSL</Text>
                            </View>

                            <TouchableOpacity 
                                onPress={toggleTheme} 
                                style={[styles.themeToggleBtn, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
                                activeOpacity={0.8}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name={isDark ? "sunny" : "moon"} size={14} color={isDark ? "#FDE047" : "#0F172A"} />
                            </TouchableOpacity>
                        </View>

                        {/* Royal Gold Header Accent Line */}
                        <View style={{ height: 2, backgroundColor: '#F59E0B', borderRadius: 1, marginVertical: 6, opacity: 0.8 }} />

                        {/* Centered Single-Screen Locked Card */}
                        <View style={[styles.cardWrapper, isTabletOrDesktop && styles.desktopCardWrapper]}>
                            
                            {/* Compact 3D Male Cartoon Mascot */}
                            <View style={styles.mascotContainer}>
                                <Mascot3D size={95} greetingText="Welcome Back! 👋" isDarkMode={isDark} />
                            </View>

                            {/* Welcome Headline */}
                            <View style={styles.headlineBox}>
                                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                                    Welcome Back <Text style={{ color: '#F59E0B' }}>!</Text>
                                </Text>
                                <Text style={[styles.welcomeSubText, { color: theme.textSecondary }]}>
                                    Sign in to access your royal wallet, VTU services, and rewards.
                                </Text>

                                {/* Feature Pills Badge Row */}
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, justifyContent: 'center' }}>
                                    <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' }}>
                                        <Text style={{ color: isDark ? '#FDE047' : '#92400E', fontSize: 8.5, fontWeight: '900' }}>⚡ Instant VTU</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 12, borderWidth: 1, borderColor: '#10B981' }}>
                                        <Text style={{ color: isDark ? '#6EE7B7' : '#065F46', fontSize: 8.5, fontWeight: '900' }}>🔒 100% Secure</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 12, borderWidth: 1, borderColor: '#3B82F6' }}>
                                        <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 8.5, fontWeight: '900' }}>💎 Zero Fees</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Login Type Tabs (Email vs Phone) */}
                            <View style={[styles.loginTypeContainer, { backgroundColor: isDark ? '#0A1424' : '#E2E8F0' }]}>
                                <TouchableOpacity 
                                    onPress={() => setLoginType('email')} 
                                    style={[styles.loginTypeTab, loginType === 'email' && [styles.loginTypeTabActive, { backgroundColor: theme.primaryNavy }]]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="mail-outline" size={13} color={loginType === 'email' ? '#08E4C7' : theme.textMuted} style={{ marginRight: 4 }} />
                                    <Text style={[styles.loginTypeText, loginType === 'email' ? { color: '#FFFFFF', fontWeight: '800' } : { color: theme.textMuted }]}>
                                        Email
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setLoginType('phone')} 
                                    style={[styles.loginTypeTab, loginType === 'phone' && [styles.loginTypeTabActive, { backgroundColor: theme.primaryNavy }]]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="call-outline" size={13} color={loginType === 'phone' ? '#08E4C7' : theme.textMuted} style={{ marginRight: 4 }} />
                                    <Text style={[styles.loginTypeText, loginType === 'phone' ? { color: '#FFFFFF', fontWeight: '800' } : { color: theme.textMuted }]}>
                                        Phone
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Form Input Fields */}
                            <View style={styles.formContainer}>
                                
                                {/* Identifier Input */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                                    {loginType === 'email' ? 'Email Address' : 'Phone Number'}
                                </Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'identifier' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons 
                                        name={loginType === 'email' ? "mail" : "call"} 
                                        size={16} 
                                        color={focusedInput === 'identifier' ? theme.accentTeal : theme.textMuted} 
                                        style={{ marginRight: 6 }} 
                                    />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder={loginType === 'email' ? 'name@example.com' : '08012345678'}
                                        placeholderTextColor={theme.textMuted}
                                        keyboardType={loginType === 'email' ? 'email-address' : 'phone-pad'}
                                        autoCapitalize="none"
                                        value={identifier}
                                        onChangeText={setIdentifier}
                                        onFocus={() => setFocusedInput('identifier')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Password Input */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 8 }]}>Password</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons 
                                        name="lock-closed" 
                                        size={16} 
                                        color={focusedInput === 'password' ? theme.accentTeal : theme.textMuted} 
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
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 2 }}>
                                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={16} color={theme.textMuted} />
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
                                            rememberMe && { backgroundColor: theme.accentTeal, borderColor: theme.accentTeal }
                                        ]}>
                                            {rememberMe && <Ionicons name="checkmark" size={10} color="#0E1A2E" />}
                                        </View>
                                        <Text style={[styles.checkboxLabel, { color: theme.textSecondary }]}>Remember Me</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setShowForgotModal(true)} activeOpacity={0.8}>
                                        <Text style={[styles.forgotLink, { color: theme.gold }]}>Forgot Password?</Text>
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
                                        colors={['#0E1A2E', '#1E293B']} 
                                        style={styles.primaryBtnGradient}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#08E4C7" size="small" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.primaryBtnText}>Sign In to Account</Text>
                                                <Ionicons name="arrow-forward" size={16} color="#08E4C7" style={{ marginLeft: 6 }} />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Quick Biometrics Button */}
                                {biometricAvailable && (
                                    <TouchableOpacity 
                                        onPress={handleBiometricAuth}
                                        style={[styles.biometricBtn, { backgroundColor: isDark ? 'rgba(8, 228, 199, 0.1)' : '#EFF6FF', borderColor: theme.accentTeal }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name={biometricType === 'Face ID' ? "scan-outline" : "finger-print"} size={16} color={theme.accentTeal} style={{ marginRight: 6 }} />
                                        <Text style={[styles.biometricBtnText, { color: theme.textPrimary }]}>
                                            Quick Sign In with {biometricType}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {/* Social Login Divider */}
                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.borderPrimary }]} />
                                    <Text style={[styles.dividerText, { color: theme.textMuted }]}>OR CONTINUE WITH</Text>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.borderPrimary }]} />
                                </View>

                                {/* Social Provider Buttons Grid */}
                                <View style={styles.socialGrid}>
                                    <TouchableOpacity onPress={() => handleSocialAuth('google')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                        {socialLoading === 'google' ? <ActivityIndicator size="small" color="#EA4335" /> : <Ionicons name="logo-google" size={15} color="#EA4335" />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Google</Text>
                                    </TouchableOpacity>

                                    {(Platform.OS === 'ios' || Platform.OS === 'web') && (
                                        <TouchableOpacity onPress={() => handleSocialAuth('apple')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                            {socialLoading === 'apple' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-apple" size={15} color={theme.textPrimary} />}
                                            <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Apple</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity onPress={() => handleSocialAuth('github')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                        {socialLoading === 'github' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-github" size={15} color={theme.textPrimary} />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>GitHub</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Footer Link */}
                                <View style={styles.footerLinkRow}>
                                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>Don't have an account?</Text>
                                    <TouchableOpacity onPress={() => router.push('/signup' as any)} activeOpacity={0.8}>
                                        <Text style={[styles.signupLinkText, { color: theme.accentTeal }]}> Create Account</Text>
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
        paddingHorizontal: 14,
        paddingTop: 2,
        paddingBottom: 80,
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
        width: 26,
        height: 26,
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    brandTagline: {
        fontWeight: '700',
        fontSize: 7.5,
        letterSpacing: 0.8,
    },
    themeToggleBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrapper: {
        width: '100%',
        marginTop: 0,
    },
    desktopCardWrapper: {
        maxWidth: 420,
        alignSelf: 'center',
        marginTop: 6,
    },
    mascotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 0,
    },
    headlineBox: {
        alignItems: 'center',
        marginBottom: 10,
    },
    welcomeTitle: {
        fontWeight: '900',
        fontSize: 20,
        textAlign: 'center',
    },
    welcomeSubText: {
        fontSize: 10.5,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
        lineHeight: 14,
    },
    loginTypeContainer: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 2,
        marginBottom: 10,
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
        fontSize: 10.5,
        fontWeight: '600',
    },
    formContainer: {
        width: '100%',
    },
    inputLabel: {
        fontWeight: '700',
        fontSize: 10.5,
        marginBottom: 4,
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
        fontSize: 12,
        fontWeight: '600',
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 10,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxBox: {
        width: 15,
        height: 15,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 5,
    },
    checkboxLabel: {
        fontSize: 10.5,
        fontWeight: '600',
    },
    forgotLink: {
        fontSize: 10.5,
        fontWeight: '700',
    },
    primaryLoginBtn: {
        borderRadius: 10,
        overflow: 'hidden',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 8,
    },
    primaryBtnGradient: {
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12.5,
    },
    biometricBtn: {
        height: 34,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    biometricBtnText: {
        fontWeight: '700',
        fontSize: 11,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginHorizontal: 8,
    },
    socialGrid: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    socialTile: {
        flex: 1,
        height: 34,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialTileText: {
        fontWeight: '700',
        fontSize: 10.5,
        marginLeft: 4,
    },
    footerLinkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    footerText: {
        fontSize: 11,
        fontWeight: '500',
    },
    signupLinkText: {
        fontSize: 11,
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
});
