import React, { useState, useEffect, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useAuthTheme } from '../../hooks/useAuthTheme';
import Mascot3D from '../../components/Mascot3D';

WebBrowser.maybeCompleteAuthSession();

const COUNTRIES = [
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234' },
    { code: 'GH', name: 'Ghana', flag: '🇬🇭', dialCode: '+233' },
    { code: 'KE', name: 'Kenya', flag: '🇰🇪', dialCode: '+254' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
    { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
];

export default function SignupScreen() {
    const { width } = useWindowDimensions();
    const isTabletOrDesktop = width >= 768;
    const router = useRouter();
    const params = useLocalSearchParams<{ ref?: string; referral?: string; code?: string }>();
    const { settings } = useAppSettings();
    const { isDark, toggleTheme, theme } = useAuthTheme();
    const scrollViewRef = useRef<ScrollView>(null);

    // Form Field States
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);

    // Auto-capture referral code from URL & listen for OAuth error responses
    useEffect(() => {
        let codeFromUrl = params.ref || params.referral || params.code || '';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
                const searchParams = new URLSearchParams(window.location.search);
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                if (!codeFromUrl) {
                    codeFromUrl = searchParams.get('ref') || searchParams.get('referral') || searchParams.get('code') || hashParams.get('ref') || '';
                }

                const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
                const errCode = searchParams.get('error') || hashParams.get('error');
                if (errorDesc || errCode) {
                    const cleanError = (errorDesc || errCode || '').replace(/\+/g, ' ');
                    Alert.alert('Google Registration Notice', cleanError);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) {}
        }
        if (codeFromUrl) {
            setReferralCode(String(codeFromUrl).trim());
        }
    }, [params.ref, params.referral, params.code]);

    // Visibility & UI States
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    // Real-Time Availability Validation States
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

    const [checkingPhone, setCheckingPhone] = useState(false);
    const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

    // Processing & Success States
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Real-time Username Check
    useEffect(() => {
        const checkUsername = async () => {
            const cleanUser = username.trim();
            if (cleanUser.length < 3) {
                setUsernameAvailable(null);
                setUsernameSuggestions([]);
                return;
            }
            setCheckingUsername(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'username', value: cleanUser }
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
            const cleanEmail = email.trim();
            if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
                setEmailAvailable(null);
                return;
            }
            setCheckingEmail(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'email', value: cleanEmail }
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

    // Password Strength Logic
    const getPasswordStrength = () => {
        let score = 0;
        if (password.length >= 8) score += 1;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (score === 0) return { score: 0, label: 'Weak', color: '#EF4444', percent: 0.15 };
        if (score === 1 || score === 2) return { score: 2, label: 'Fair', color: '#F59E0B', percent: 0.45 };
        if (score === 3) return { score: 3, label: 'Good', color: '#10B981', percent: 0.75 };
        return { score: 4, label: 'Strong', color: '#08E4C7', percent: 1.0 };
    };

    const strength = getPasswordStrength();

    const notifyUser = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && window.alert) {
                window.alert(`${title}\n\n${message}`);
            } else {
                Alert.alert(title, message);
            }
        } else {
            Alert.alert(title, message);
        }
    };

    // Signup Handler
    const handleSignup = async () => {
        const cleanFullName = fullName.trim();
        const cleanUsername = username.trim().toLowerCase();
        const cleanEmail = email.trim();
        const cleanPhoneInput = phone.trim();

        if (!cleanFullName) {
            notifyUser('Missing Field', 'Please enter your Full Name.');
            return;
        }

        if (!cleanUsername) {
            notifyUser('Missing Field', 'Please choose a Username.');
            return;
        }

        if (!cleanEmail || !cleanEmail.includes('@')) {
            notifyUser('Invalid Email', 'Please enter a valid Email Address.');
            return;
        }

        if (!cleanPhoneInput) {
            notifyUser('Missing Field', 'Please enter your Phone Number.');
            return;
        }

        if (!password) {
            notifyUser('Missing Password', 'Please enter a Password.');
            return;
        }

        if (password.length < 6) {
            notifyUser('Weak Password', 'Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            notifyUser('Password Mismatch', 'Password and Confirm Password do not match.');
            return;
        }

        if (!acceptTerms) {
            notifyUser('Terms Required', 'Please check the box to accept the Terms of Service & Privacy Policy.');
            return;
        }

        if (usernameAvailable === false) {
            notifyUser('Username Taken', 'The username you selected is already in use. Please try another.');
            return;
        }

        if (emailAvailable === false) {
            notifyUser('Email In Use', 'An account already exists with this email address. Please Log In instead.');
            return;
        }

        setLoading(true);

        try {
            const cleanPhone = selectedCountry.dialCode + cleanPhoneInput.replace(/^0+/, '');

            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password: password,
                options: {
                    data: {
                        full_name: cleanFullName,
                        username: cleanUsername,
                        phone: cleanPhone,
                        referral_code: referralCode.trim() || null,
                        country: selectedCountry.name,
                    }
                }
            });

            if (error) {
                notifyUser('Registration Error', error.message || 'An error occurred during account creation.');
                return;
            }

            if (data.user) {
                // 1. Generate & store 6-digit OTP code locally for immediate verification
                const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
                await AsyncStorage.setItem(`recovery_otp_${cleanEmail}`, generatedOtp);
                await AsyncStorage.setItem(`recovery_otp_time_${cleanEmail}`, String(Date.now()));

                // 2. Dispatch OTP email & trigger Supabase resend
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
                                    <p style="color:#94A3B8; font-size:13px; margin-bottom:18px;">Account Registration Verification</p>
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
                    console.log('Signup OTP email dispatch notice:', e);
                }

                try {
                    await supabase.auth.resend({ type: 'signup', email: cleanEmail });
                } catch (e) {
                    console.log('Supabase resend notice:', e);
                }

                setShowSuccessModal(true);
                setTimeout(() => {
                    setShowSuccessModal(false);
                    router.push({
                        pathname: '/otp' as any,
                        params: { email: cleanEmail, mode: 'signup' }
                    });
                }, 1600);
            }
        } catch (error: any) {
            notifyUser('Registration Error', error.message || 'An error occurred during account creation.');
        } finally {
            setLoading(false);
        }
    };

    // Social Provider Handler
    const handleSocialAuth = async (provider: 'google' | 'apple' | 'facebook' | 'twitter' | 'github') => {
        if (socialLoading) return;
        setSocialLoading(provider);
        try {
            const redirectUrl = Platform.OS === 'web'
                ? (typeof window !== 'undefined' ? window.location.origin : 'https://abumafhal.com.ng')
                : Linking.createURL('/login');

            const refCodeToPass = referralCode ? referralCode.trim() : '';

            const options: any = {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account',
                },
                data: refCodeToPass ? { referral_code: refCodeToPass } : undefined,
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
            Alert.alert(`${provider.toUpperCase()} Registration Error`, error.message || 'Failed to register with Google.');
        } finally {
            setSocialLoading(null);
        }
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
                        ref={scrollViewRef}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Top Control Bar */}
                        <View style={styles.topControlRow}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="arrow-back" size={16} color={theme.textPrimary} />
                            </TouchableOpacity>

                            <View style={styles.brandRow}>
                                <Image
                                    source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                                <View style={{ marginLeft: 4 }}>
                                    <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>ABUMAFHAL</Text>
                                    <Text style={{ color: '#F59E0B', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 }}>ROYAL FINTECH</Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL('https://wa.me/2348001234567?text=Hello%20ABUMAFHAL%20Support')}
                                    style={[styles.supportHeaderBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#E6F4EA', borderColor: '#10B981' }]}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="logo-whatsapp" size={12} color="#10B981" />
                                    <Text style={[styles.supportHeaderBtnText, { color: isDark ? '#6EE7B7' : '#047857' }]}>Help</Text>
                                </TouchableOpacity>

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

                        {/* Centered Form Card Wrapper */}
                        <View style={[styles.cardWrapper, isTabletOrDesktop && styles.desktopCardWrapper]}>
                            
                            {/* Compact 3D Male Cartoon Mascot */}
                            <View style={styles.mascotContainer}>
                                <Mascot3D size={85} greetingText="Welcome to ABUMAFHAL! ✨" isDarkMode={isDark} />
                            </View>

                            {/* Headline */}
                            <View style={styles.headlineBox}>
                                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                                    Create Account <Text style={{ color: '#F59E0B' }}>.</Text>
                                </Text>

                                {/* Feature Badges Pill Row */}
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, justifyContent: 'center' }}>
                                    <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' }}>
                                        <Text style={{ color: isDark ? '#FDE047' : '#92400E', fontSize: 8.5, fontWeight: '900' }}>🎁 ₦500 Bonus</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#10B981' }}>
                                        <Text style={{ color: isDark ? '#6EE7B7' : '#065F46', fontSize: 8.5, fontWeight: '900' }}>🔒 Instant Access</Text>
                                    </View>
                                    <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#3B82F6' }}>
                                        <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 8.5, fontWeight: '900' }}>⚡ Automated VTU</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Form Inputs Grid */}
                            <View style={styles.formContainer}>

                                {/* Full Name & Username Side-by-Side */}
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Full Name</Text>
                                        <View style={[
                                            styles.inputFieldBox, 
                                            { backgroundColor: theme.bgInput, borderColor: focusedInput === 'fullName' ? theme.borderFocus : theme.borderPrimary }
                                        ]}>
                                            <TextInput 
                                                style={[styles.textInput, { color: theme.textPrimary }]}
                                                placeholder="Sani Abubakar"
                                                placeholderTextColor={theme.textMuted}
                                                value={fullName}
                                                onChangeText={setFullName}
                                                onFocus={() => setFocusedInput('fullName')}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Username</Text>
                                        <View style={[
                                            styles.inputFieldBox, 
                                            { backgroundColor: theme.bgInput, borderColor: usernameAvailable === false ? '#EF4444' : focusedInput === 'username' ? theme.borderFocus : theme.borderPrimary }
                                        ]}>
                                            <TextInput 
                                                style={[styles.textInput, { color: theme.textPrimary }]}
                                                placeholder="abumafhal"
                                                placeholderTextColor={theme.textMuted}
                                                autoCapitalize="none"
                                                value={username}
                                                onChangeText={setUsername}
                                                onFocus={() => setFocusedInput('username')}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Email Address */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Email Address</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: emailAvailable === false ? '#EF4444' : focusedInput === 'email' ? theme.borderFocus : theme.borderPrimary, marginBottom: 6 }
                                ]}>
                                    <Ionicons name="mail-outline" size={15} color={focusedInput === 'email' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 6 }} />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="name@example.com"
                                        placeholderTextColor={theme.textMuted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        onFocus={() => setFocusedInput('email')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Country & Phone Row */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Phone Number</Text>
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                                    <TouchableOpacity 
                                        onPress={() => setShowCountryModal(true)}
                                        style={[styles.countryBtn, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ fontSize: 14, marginRight: 2 }}>{selectedCountry.flag}</Text>
                                        <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 10.5 }}>{selectedCountry.dialCode}</Text>
                                    </TouchableOpacity>

                                    <View style={[
                                        styles.inputFieldBox, 
                                        { flex: 1, backgroundColor: theme.bgInput, borderColor: focusedInput === 'phone' ? theme.borderFocus : theme.borderPrimary }
                                    ]}>
                                        <TextInput 
                                            style={[styles.textInput, { color: theme.textPrimary }]}
                                            placeholder="8012345678"
                                            placeholderTextColor={theme.textMuted}
                                            keyboardType="phone-pad"
                                            value={phone}
                                            onChangeText={setPhone}
                                            onFocus={() => setFocusedInput('phone')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                    </View>
                                </View>

                                {/* Password & Confirm Password Side-by-Side */}
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Password</Text>
                                        <View style={[
                                            styles.inputFieldBox, 
                                            { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? theme.borderFocus : theme.borderPrimary }
                                        ]}>
                                            <TextInput 
                                                style={[styles.textInput, { color: theme.textPrimary }]}
                                                placeholder="••••••••"
                                                placeholderTextColor={theme.textMuted}
                                                secureTextEntry={!showPassword}
                                                value={password}
                                                onChangeText={setPassword}
                                                onFocus={() => setFocusedInput('password')}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Confirm Pass</Text>
                                        <View style={[
                                            styles.inputFieldBox, 
                                            { backgroundColor: theme.bgInput, borderColor: confirmPassword && password !== confirmPassword ? '#EF4444' : focusedInput === 'confirmPassword' ? theme.borderFocus : theme.borderPrimary }
                                        ]}>
                                            <TextInput 
                                                style={[styles.textInput, { color: theme.textPrimary }]}
                                                placeholder="••••••••"
                                                placeholderTextColor={theme.textMuted}
                                                secureTextEntry={!showConfirmPassword}
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                onFocus={() => setFocusedInput('confirmPassword')}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Password Strength Bar */}
                                {password.length > 0 && (
                                    <View style={{ marginBottom: 6 }}>
                                        <View style={[styles.strengthBgTrack, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                                            <View style={[styles.strengthFillTrack, { width: `${strength.percent * 100}%`, backgroundColor: strength.color }]} />
                                        </View>
                                    </View>
                                )}

                                {/* Referral Code (Optional) */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Referral Code (Optional)</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'referralCode' ? theme.borderFocus : theme.borderPrimary, marginBottom: 8 }
                                ]}>
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="ABUMAF123"
                                        placeholderTextColor={theme.textMuted}
                                        autoCapitalize="characters"
                                        value={referralCode}
                                        onChangeText={setReferralCode}
                                        onFocus={() => setFocusedInput('referralCode')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Terms & Privacy Acceptance Row */}
                                <View style={styles.termsRow}>
                                    <TouchableOpacity 
                                        onPress={() => setAcceptTerms(!acceptTerms)}
                                        style={styles.checkboxTouch}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <View style={[
                                            styles.checkboxBox, 
                                            acceptTerms && { backgroundColor: theme.accentTeal, borderColor: theme.accentTeal }
                                        ]}>
                                            {acceptTerms && <Ionicons name="checkmark" size={10} color="#0E1A2E" />}
                                        </View>
                                        <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                                            I agree to
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => router.push('/terms')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <Text style={[styles.termsLink, { color: theme.accentTeal }]}> Terms</Text>
                                    </TouchableOpacity>

                                    <Text style={[styles.termsText, { color: theme.textSecondary }]}> & </Text>

                                    <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <Text style={[styles.termsLink, { color: theme.accentTeal }]}>Privacy Policy</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Primary Button */}
                                <TouchableOpacity 
                                    onPress={handleSignup}
                                    disabled={loading}
                                    style={styles.primaryBtn}
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
                                                <Text style={styles.primaryBtnText}>Create My Account</Text>
                                                <Ionicons name="checkmark-circle" size={18} color="#0F172A" style={{ marginLeft: 6 }} />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Social Sign Up Grid */}
                                <View style={styles.socialGrid}>
                                    <TouchableOpacity 
                                        onPress={() => handleSocialAuth('google')} 
                                        disabled={!!socialLoading} 
                                        style={[styles.socialTile, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: 'rgba(245, 158, 11, 0.3)' }]} 
                                        activeOpacity={0.8} 
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        {socialLoading === 'google' ? <ActivityIndicator size="small" color="#EA4335" /> : <Ionicons name="logo-google" size={16} color="#EA4335" />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Google</Text>
                                    </TouchableOpacity>

                                    {(Platform.OS === 'ios' || Platform.OS === 'web') && (
                                        <TouchableOpacity 
                                            onPress={() => handleSocialAuth('apple')} 
                                            disabled={!!socialLoading} 
                                            style={[styles.socialTile, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: 'rgba(245, 158, 11, 0.3)' }]} 
                                            activeOpacity={0.8} 
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                            {socialLoading === 'apple' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-apple" size={16} color={theme.textPrimary} />}
                                            <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Apple</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity 
                                        onPress={() => handleSocialAuth('github')} 
                                        disabled={!!socialLoading} 
                                        style={[styles.socialTile, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: 'rgba(245, 158, 11, 0.3)' }]} 
                                        activeOpacity={0.8} 
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        {socialLoading === 'github' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-github" size={16} color={theme.textPrimary} />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>GitHub</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Footer Link */}
                                <View style={styles.footerLinkRow}>
                                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>Already have an account?</Text>
                                    <TouchableOpacity onPress={() => router.push('/login' as any)} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <Text style={[styles.signupLinkText, { color: '#F59E0B' }]}> Sign In</Text>
                                    </TouchableOpacity>
                                </View>

                            </View>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Country Selector Modal */}
            <Modal transparent visible={showCountryModal} animationType="fade" onRequestClose={() => setShowCountryModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: isDark ? '#0E1A2E' : '#FFFFFF', borderColor: theme.borderPrimary }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Country</Text>
                            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                                <Ionicons name="close-circle" size={22} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {COUNTRIES.map((c) => (
                            <TouchableOpacity 
                                key={c.code}
                                onPress={() => {
                                    setSelectedCountry(c);
                                    setShowCountryModal(false);
                                }}
                                style={[
                                    styles.countryOptionRow,
                                    { borderBottomColor: theme.borderPrimary },
                                    selectedCountry.code === c.code && { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={{ fontSize: 18, marginRight: 8 }}>{c.flag}</Text>
                                <Text style={{ flex: 1, color: theme.textPrimary, fontWeight: '700', fontSize: 12 }}>{c.name}</Text>
                                <Text style={{ color: theme.accentTeal, fontWeight: '800', fontSize: 11 }}>{c.dialCode}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* Success Celebration Modal */}
            <Modal transparent visible={showSuccessModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.successCard, { backgroundColor: isDark ? '#0E1A2E' : '#FFFFFF' }]}>
                        <View style={styles.successIconCircle}>
                            <Ionicons name="checkmark-done" size={36} color="#08E4C7" />
                        </View>
                        <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Welcome to ABUMAFHAL 🎉</Text>
                        <Text style={[styles.successSubText, { color: theme.textSecondary }]}>
                            Account created successfully! Redirecting...
                        </Text>
                        <ActivityIndicator size="small" color="#08E4C7" style={{ marginTop: 10 }} />
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
        paddingBottom: 100,
    },
    topControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    backBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoImage: {
        width: 24,
        height: 24,
        marginRight: 5,
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 13.5,
        letterSpacing: 0.5,
    },
    supportHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 14,
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
        marginTop: 0,
    },
    desktopCardWrapper: {
        maxWidth: 420,
        alignSelf: 'center',
        marginTop: 4,
    },
    mascotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 0,
    },
    headlineBox: {
        alignItems: 'center',
        marginBottom: 6,
    },
    welcomeTitle: {
        fontWeight: '900',
        fontSize: 18,
        textAlign: 'center',
    },
    formContainer: {
        width: '100%',
    },
    inputLabel: {
        fontWeight: '800',
        fontSize: 9.5,
        marginBottom: 3,
    },
    inputFieldBox: {
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        fontSize: 11,
        fontWeight: '600',
    },
    countryBtn: {
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    strengthBgTrack: {
        height: 4,
        borderRadius: 99,
        width: '100%',
        overflow: 'hidden',
    },
    strengthFillTrack: {
        height: '100%',
        borderRadius: 99,
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    checkboxTouch: {
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
        marginRight: 6,
    },
    termsText: {
        fontSize: 9.5,
        fontWeight: '500',
    },
    termsLink: {
        fontSize: 9.5,
        fontWeight: '800',
        textDecorationLine: 'underline',
    },
    primaryBtn: {
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 8,
    },
    primaryBtnGradient: {
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 11.5,
    },
    socialGrid: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 10,
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
        marginTop: 2,
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
    },
    modalTitle: {
        fontWeight: '800',
        fontSize: 15,
    },
    countryOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    successCard: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    successIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(8, 228, 199, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#08E4C7',
    },
    successTitle: {
        fontWeight: '900',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 4,
    },
    successSubText: {
        fontSize: 11.5,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 16,
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
