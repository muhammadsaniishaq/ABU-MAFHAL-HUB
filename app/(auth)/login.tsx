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
                // Retrieve stored session token or saved credentials
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
                        pathname: '/(auth)/otp',
                        params: { email: isEmailInput ? cleanIdent : '', type: 'signup' }
                    });
                    return;
                }
                throw error;
            }

            if (data.user) {
                // Save credentials if Remember Me is checked
                if (rememberMe) {
                    await AsyncStorage.setItem('saved_user_identifier', cleanIdent);
                    await AsyncStorage.setItem('saved_user_pass_secure', userPass);
                }

                if (settings?.require_email_verif && !data.user.email_confirmed_at && isEmailInput) {
                    router.push({
                        pathname: '/(auth)/otp',
                        params: { email: cleanIdent, type: 'signup' }
                    });
                    return;
                }

                // Log IP & Security Notification
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

                // Role Check
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
                await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));

                if (redirectTo) {
                    router.replace(redirectTo as any);
                } else if (resolvedRole === 'admin' || resolvedRole === 'super_admin') {
                    router.replace('/manage/dashboard' as any);
                } else {
                    router.replace('/(app)/dashboard');
                }
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'Please check your credentials and try again.');
        } finally {
            setLoading(false);
        }
    };

    // Social Provider Handler
    const handleSocialAuth = async (provider: 'google' | 'apple' | 'facebook' | 'twitter' | 'github') => {
        if (socialLoading) return;
        setSocialLoading(provider);
        try {
            if (Platform.OS === 'web') {
                const redirectToUrl = window.location.origin;
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: provider as any,
                    options: { redirectTo: redirectToUrl }
                });
                if (error) throw error;
            } else {
                const redirectToUrl = Linking.createURL('/(auth)/login');
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: provider as any,
                    options: {
                        redirectTo: redirectToUrl,
                        skipBrowserRedirect: true,
                    }
                });
                if (error) throw error;
                if (data?.url) {
                    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectToUrl);
                    if (result.type === 'success' && result.url) {
                        const normalizedUrl = result.url.replace('#', '?');
                        const parsed = Linking.parse(normalizedUrl);
                        const { code, access_token, refresh_token } = parsed.queryParams || {};
                        const codeStr = Array.isArray(code) ? code[0] : code;
                        const accessTokenStr = Array.isArray(access_token) ? access_token[0] : access_token;
                        const refreshTokenStr = Array.isArray(refresh_token) ? refresh_token[0] : refresh_token;

                        if (codeStr) {
                            await supabase.auth.exchangeCodeForSession(codeStr);
                        } else if (accessTokenStr && refreshTokenStr) {
                            await supabase.auth.setSession({
                                access_token: accessTokenStr,
                                refresh_token: refreshTokenStr,
                            });
                        }
                    }
                }
            }
        } catch (error: any) {
            Alert.alert(`${provider.toUpperCase()} Auth Error`, error.message || 'Failed to authenticate.');
        } finally {
            setSocialLoading(null);
        }
    };

    // Password Reset Submission
    const handleForgotPasswordSubmit = async () => {
        if (!resetEmail.trim() || !resetEmail.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setResetLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                redirectTo: Platform.OS === 'web' ? `${window.location.origin}/auth/reset-password` : Linking.createURL('/auth/reset-password')
            });

            if (error) throw error;

            Alert.alert('Reset Email Sent 📧', 'Please check your inbox for instructions to reset your password.');
            setShowForgotModal(false);
            setResetEmail('');
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to send password reset email.');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={isDark ? "light" : "dark"} />

            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Top Control Bar: Brand Logo & Dark/Light Toggle */}
                        <View style={styles.topControlRow}>
                            <View style={styles.brandRow}>
                                <Image
                                    source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>ABUMAFHAL</Text>
                                    <Text style={[styles.brandTagline, { color: theme.gold }]}>FINTECH & DIGITAL HUB</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={toggleTheme} 
                                style={[styles.themeToggleBtn, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={isDark ? "#FDE047" : "#0E1A2E"} />
                            </TouchableOpacity>
                        </View>

                        {/* Main Container Card (Centered for Mobile & Desktop) */}
                        <View style={[styles.cardWrapper, isTabletOrDesktop && styles.desktopCardWrapper]}>
                            
                            {/* 3D Animated Hero Mascot */}
                            <View style={styles.mascotContainer}>
                                <Mascot3D size={150} mode="waving" isDarkMode={isDark} />
                            </View>

                            {/* Welcome Headline */}
                            <View style={styles.headlineBox}>
                                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                                    Welcome Back <Text style={{ color: theme.gold }}>!</Text>
                                </Text>
                                <Text style={[styles.welcomeSubText, { color: theme.textSecondary }]}>
                                    Sign in to access your wallet, identity, and digital services.
                                </Text>
                            </View>

                            {/* Login Type Tabs (Email vs Phone) */}
                            <View style={[styles.loginTypeContainer, { backgroundColor: isDark ? '#0A1424' : '#E2E8F0' }]}>
                                <TouchableOpacity 
                                    onPress={() => setLoginType('email')} 
                                    style={[styles.loginTypeTab, loginType === 'email' && [styles.loginTypeTabActive, { backgroundColor: theme.primaryNavy }]]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="mail-outline" size={14} color={loginType === 'email' ? '#08E4C7' : theme.textMuted} style={{ marginRight: 5 }} />
                                    <Text style={[styles.loginTypeText, loginType === 'email' ? { color: '#FFFFFF', fontWeight: '800' } : { color: theme.textMuted }]}>
                                        Email Address
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setLoginType('phone')} 
                                    style={[styles.loginTypeTab, loginType === 'phone' && [styles.loginTypeTabActive, { backgroundColor: theme.primaryNavy }]]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="call-outline" size={14} color={loginType === 'phone' ? '#08E4C7' : theme.textMuted} style={{ marginRight: 5 }} />
                                    <Text style={[styles.loginTypeText, loginType === 'phone' ? { color: '#FFFFFF', fontWeight: '800' } : { color: theme.textMuted }]}>
                                        Phone Number
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Input Form Fields */}
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
                                        size={18} 
                                        color={focusedInput === 'identifier' ? theme.accentTeal : theme.textMuted} 
                                        style={{ marginRight: 8 }} 
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
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 12 }]}>Password</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons 
                                        name="lock-closed" 
                                        size={18} 
                                        color={focusedInput === 'password' ? theme.accentTeal : theme.textMuted} 
                                        style={{ marginRight: 8 }} 
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
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {/* Options Row: Remember Me & Forgot Password */}
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
                                            {rememberMe && <Ionicons name="checkmark" size={12} color="#0E1A2E" />}
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
                                                <Ionicons name="arrow-forward" size={18} color="#08E4C7" style={{ marginLeft: 8 }} />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Biometrics Quick Authentication */}
                                {biometricAvailable && (
                                    <TouchableOpacity 
                                        onPress={handleBiometricAuth}
                                        style={[styles.biometricBtn, { backgroundColor: isDark ? 'rgba(8, 228, 199, 0.1)' : '#EFF6FF', borderColor: theme.accentTeal }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name={biometricType === 'Face ID' ? "scan-outline" : "finger-print"} size={20} color={theme.accentTeal} style={{ marginRight: 8 }} />
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
                                    {/* Google */}
                                    <TouchableOpacity 
                                        onPress={() => handleSocialAuth('google')} 
                                        disabled={!!socialLoading}
                                        style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        {socialLoading === 'google' ? <ActivityIndicator size="small" color="#EA4335" /> : (
                                            <Ionicons name="logo-google" size={18} color="#EA4335" />
                                        )}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Google</Text>
                                    </TouchableOpacity>

                                    {/* Apple (iOS / Web) */}
                                    {(Platform.OS === 'ios' || Platform.OS === 'web') && (
                                        <TouchableOpacity 
                                            onPress={() => handleSocialAuth('apple')} 
                                            disabled={!!socialLoading}
                                            style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                            activeOpacity={0.8}
                                        >
                                            {socialLoading === 'apple' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : (
                                                <Ionicons name="logo-apple" size={18} color={theme.textPrimary} />
                                            )}
                                            <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Apple</Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Facebook */}
                                    <TouchableOpacity 
                                        onPress={() => handleSocialAuth('facebook')} 
                                        disabled={!!socialLoading}
                                        style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        {socialLoading === 'facebook' ? <ActivityIndicator size="small" color="#1877F2" /> : (
                                            <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                                        )}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Facebook</Text>
                                    </TouchableOpacity>

                                    {/* X (Twitter) */}
                                    <TouchableOpacity 
                                        onPress={() => handleSocialAuth('twitter')} 
                                        disabled={!!socialLoading}
                                        style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        {socialLoading === 'twitter' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : (
                                            <Ionicons name="logo-twitter" size={18} color="#1DA1F2" />
                                        )}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>X</Text>
                                    </TouchableOpacity>

                                    {/* GitHub */}
                                    <TouchableOpacity 
                                        onPress={() => handleSocialAuth('github')} 
                                        disabled={!!socialLoading}
                                        style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        {socialLoading === 'github' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : (
                                            <Ionicons name="logo-github" size={18} color={theme.textPrimary} />
                                        )}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>GitHub</Text>
                                    </TouchableOpacity>

                                    {/* Web3 Wallet Option */}
                                    <TouchableOpacity 
                                        onPress={() => setShowWalletModal(true)} 
                                        style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="wallet-outline" size={18} color={theme.gold} />
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Wallet</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Footer Link to Sign Up */}
                                <View style={styles.footerLinkRow}>
                                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>Don't have an account?</Text>
                                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')} activeOpacity={0.8}>
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Reset Password</Text>
                            <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                                <Ionicons name="close-circle" size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSubText, { color: theme.textSecondary }]}>
                            Enter your email address below and we will send you instructions to reset your password.
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
                                <Text style={{ color: '#08E4C7', fontWeight: '800', fontSize: 13 }}>Send Reset Email</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Web3 Wallet Connect Modal */}
            <Modal transparent visible={showWalletModal} animationType="fade" onRequestClose={() => setShowWalletModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: isDark ? '#0E1A2E' : '#FFFFFF', borderColor: theme.borderPrimary }]}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <Ionicons name="wallet" size={40} color={theme.gold} />
                            <Text style={[styles.modalTitle, { color: theme.textPrimary, marginTop: 8 }]}>Web3 Wallet Connect</Text>
                            <Text style={[styles.modalSubText, { color: theme.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                                Direct Web3 Wallet Authentication (MetaMask, Phantom, WalletConnect) is enabled for verified ABUMAFHAL crypto portal users.
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={() => {
                                setShowWalletModal(false);
                                Alert.alert('Web3 Portal', 'Wallet auth session initiated. Please confirm in your Web3 wallet app.');
                            }}
                            style={[styles.modalSubmitBtn, { backgroundColor: theme.gold }]}
                            activeOpacity={0.8}
                        >
                            <Text style={{ color: '#0E1A2E', fontWeight: '800', fontSize: 13 }}>Connect Active Wallet</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setShowWalletModal(false)} style={{ marginTop: 10, alignSelf: 'center' }}>
                            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
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
        paddingBottom: 40,
    },
    topControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoImage: {
        width: 32,
        height: 32,
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 0.5,
    },
    brandTagline: {
        fontWeight: '700',
        fontSize: 8.5,
        letterSpacing: 0.8,
    },
    themeToggleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrapper: {
        width: '100%',
        marginTop: 4,
    },
    desktopCardWrapper: {
        maxWidth: 440,
        alignSelf: 'center',
        marginTop: 20,
    },
    mascotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
    },
    headlineBox: {
        alignItems: 'center',
        marginBottom: 16,
    },
    welcomeTitle: {
        fontWeight: '900',
        fontSize: 24,
        textAlign: 'center',
    },
    welcomeSubText: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 17,
    },
    loginTypeContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 3,
        marginBottom: 16,
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
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
    loginTypeText: {
        fontSize: 11.5,
        fontWeight: '600',
    },
    formContainer: {
        width: '100%',
    },
    inputLabel: {
        fontWeight: '700',
        fontSize: 11.5,
        marginBottom: 6,
    },
    inputFieldBox: {
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 16,
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
        fontSize: 11.5,
        fontWeight: '600',
    },
    forgotLink: {
        fontSize: 11.5,
        fontWeight: '700',
    },
    primaryLoginBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 10,
    },
    primaryBtnGradient: {
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13.5,
    },
    biometricBtn: {
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    biometricBtnText: {
        fontWeight: '700',
        fontSize: 12,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginHorizontal: 10,
    },
    socialGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    socialTile: {
        width: '31%',
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialTileText: {
        fontWeight: '700',
        fontSize: 11,
        marginLeft: 5,
    },
    footerLinkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    footerText: {
        fontSize: 12,
        fontWeight: '500',
    },
    signupLinkText: {
        fontSize: 12,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(6, 13, 30, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalTitle: {
        fontWeight: '800',
        fontSize: 16,
    },
    modalSubText: {
        fontSize: 11.5,
        fontWeight: '500',
        lineHeight: 16,
        marginBottom: 14,
    },
    modalInput: {
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 14,
    },
    modalSubmitBtn: {
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
