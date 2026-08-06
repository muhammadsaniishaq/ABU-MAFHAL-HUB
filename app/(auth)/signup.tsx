import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, 
    Platform, Image, ScrollView, ActivityIndicator, StyleSheet, 
    useWindowDimensions, Alert, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

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

    // Real-time Phone Check
    useEffect(() => {
        const checkPhone = async () => {
            const cleanPhone = phone.trim();
            if (cleanPhone.length < 10) {
                setPhoneAvailable(null);
                return;
            }
            setCheckingPhone(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'phone', value: cleanPhone }
                });
                if (error) throw error;
                setPhoneAvailable(data.available);
            } catch (error) {
                console.log('Phone check error', error);
            } finally {
                setCheckingPhone(false);
            }
        };
        const timer = setTimeout(checkPhone, 600);
        return () => clearTimeout(timer);
    }, [phone]);

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

    // Signup Handler
    const handleSignup = async () => {
        if (!fullName.trim() || !username.trim() || !email.trim() || !phone.trim() || !password) {
            Alert.alert('Missing Fields', 'Please fill in all required fields.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
            return;
        }

        if (!acceptTerms) {
            Alert.alert('Terms Required', 'Please accept the Terms of Service & Privacy Policy to proceed.');
            return;
        }

        if (usernameAvailable === false) {
            Alert.alert('Username Taken', 'The username you selected is already in use. Please choose another username.');
            return;
        }

        if (emailAvailable === false) {
            Alert.alert('Email In Use', 'An account already exists with this email address. Please log in instead.');
            return;
        }

        setLoading(true);

        try {
            const cleanPhone = selectedCountry.dialCode + phone.replace(/^0+/, '').trim();

            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        username: username.trim().toLowerCase(),
                        phone: cleanPhone,
                        referral_code: referralCode.trim() || null,
                        country: selectedCountry.name,
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                setShowSuccessModal(true);
                setTimeout(() => {
                    setShowSuccessModal(false);
                    if (settings?.require_email_verif && !data.user?.email_confirmed_at) {
                        router.push({
                            pathname: '/(auth)/otp',
                            params: { email: email.trim(), type: 'signup' }
                        });
                    } else {
                        router.replace('/(auth)/pin-setup');
                    }
                }, 1800);
            }
        } catch (error: any) {
            Alert.alert('Registration Error', error.message || 'An error occurred during account creation.');
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
                        ref={scrollViewRef}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Top Control Bar */}
                        <View style={styles.topControlRow}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
                                <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
                            </TouchableOpacity>

                            <View style={styles.brandRow}>
                                <Image
                                    source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                                <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>ABUMAFHAL</Text>
                            </View>

                            <TouchableOpacity 
                                onPress={toggleTheme} 
                                style={[styles.themeToggleBtn, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={isDark ? "#FDE047" : "#0E1A2E"} />
                            </TouchableOpacity>
                        </View>

                        {/* Centered Form Card Wrapper */}
                        <View style={[styles.cardWrapper, isTabletOrDesktop && styles.desktopCardWrapper]}>
                            
                            {/* 3D Animated Hero Mascot */}
                            <View style={styles.mascotContainer}>
                                <Mascot3D size={140} mode="waving" isDarkMode={isDark} />
                            </View>

                            {/* Headline */}
                            <View style={styles.headlineBox}>
                                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                                    Create Account <Text style={{ color: theme.gold }}>.</Text>
                                </Text>
                                <Text style={[styles.welcomeSubText, { color: theme.textSecondary }]}>
                                    Join ABUMAFHAL to start managing payments & identity.
                                </Text>
                            </View>

                            {/* Form Inputs */}
                            <View style={styles.formContainer}>

                                {/* 1. Full Name */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Full Legal Name</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'fullName' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons name="person-outline" size={18} color={focusedInput === 'fullName' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="e.g. Sani Muhammad Abubakar"
                                        placeholderTextColor={theme.textMuted}
                                        value={fullName}
                                        onChangeText={setFullName}
                                        onFocus={() => setFocusedInput('fullName')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* 2. Username (with Real-time Check & Suggestions) */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                                    <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Username</Text>
                                    {checkingUsername ? (
                                        <ActivityIndicator size="small" color={theme.accentTeal} />
                                    ) : usernameAvailable === true ? (
                                        <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>✓ Available</Text>
                                    ) : usernameAvailable === false ? (
                                        <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '800' }}>✕ Username Taken</Text>
                                    ) : null}
                                </View>

                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: usernameAvailable === false ? '#EF4444' : focusedInput === 'username' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons name="at-outline" size={18} color={focusedInput === 'username' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="e.g. abumafhal"
                                        placeholderTextColor={theme.textMuted}
                                        autoCapitalize="none"
                                        value={username}
                                        onChangeText={setUsername}
                                        onFocus={() => setFocusedInput('username')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Username Suggestion Pills */}
                                {usernameSuggestions.length > 0 && (
                                    <View style={styles.suggestionsRow}>
                                        <Text style={[styles.suggestionLabel, { color: theme.textMuted }]}>Suggestions:</Text>
                                        {usernameSuggestions.map((sug, idx) => (
                                            <TouchableOpacity 
                                                key={idx} 
                                                onPress={() => setUsername(sug)}
                                                style={[styles.suggestionPill, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
                                            >
                                                <Text style={[styles.suggestionPillText, { color: theme.accentTeal }]}>@{sug}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {/* 3. Email Address (with Real-time Check) */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                                    <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Email Address</Text>
                                    {checkingEmail ? (
                                        <ActivityIndicator size="small" color={theme.accentTeal} />
                                    ) : emailAvailable === true ? (
                                        <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>✓ Valid</Text>
                                    ) : emailAvailable === false ? (
                                        <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '800' }}>✕ Email Exists</Text>
                                    ) : null}
                                </View>

                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: emailAvailable === false ? '#EF4444' : focusedInput === 'email' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons name="mail-outline" size={18} color={focusedInput === 'email' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 8 }} />
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

                                {/* 4. Country & Phone Number Row */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 12 }]}>Country & Phone Number</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    
                                    {/* Country Selector Button */}
                                    <TouchableOpacity 
                                        onPress={() => setShowCountryModal(true)}
                                        style={[styles.countryBtn, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ fontSize: 16, marginRight: 4 }}>{selectedCountry.flag}</Text>
                                        <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 11 }}>{selectedCountry.dialCode}</Text>
                                        <Ionicons name="chevron-down" size={12} color={theme.textMuted} style={{ marginLeft: 3 }} />
                                    </TouchableOpacity>

                                    {/* Phone Input */}
                                    <View style={[
                                        styles.inputFieldBox, 
                                        { flex: 1, backgroundColor: theme.bgInput, borderColor: phoneAvailable === false ? '#EF4444' : focusedInput === 'phone' ? theme.borderFocus : theme.borderPrimary }
                                    ]}>
                                        <Ionicons name="call-outline" size={18} color={focusedInput === 'phone' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 8 }} />
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

                                {/* 5. Password & Strength Meter */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 12 }]}>Password</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons name="lock-closed-outline" size={18} color={focusedInput === 'password' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="At least 8 characters"
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

                                {/* Password Strength Meter Bar */}
                                {password.length > 0 && (
                                    <View style={{ marginTop: 6 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted }}>Password Strength</Text>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: strength.color }}>{strength.label}</Text>
                                        </View>
                                        <View style={[styles.strengthBgTrack, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                                            <View style={[styles.strengthFillTrack, { width: `${strength.percent * 100}%`, backgroundColor: strength.color }]} />
                                        </View>
                                    </View>
                                )}

                                {/* 6. Confirm Password */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 12 }]}>Confirm Password</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: confirmPassword && password !== confirmPassword ? '#EF4444' : focusedInput === 'confirmPassword' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons name="shield-checkmark-outline" size={18} color={focusedInput === 'confirmPassword' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="Repeat password"
                                        placeholderTextColor={theme.textMuted}
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        onFocus={() => setFocusedInput('confirmPassword')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                                        <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {/* 7. Referral Code (Optional) */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: 12 }]}>Referral Code (Optional)</Text>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'referralCode' ? theme.borderFocus : theme.borderPrimary }
                                ]}>
                                    <Ionicons name="gift-outline" size={18} color={focusedInput === 'referralCode' ? theme.gold : theme.textMuted} style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="e.g. ABUMAF123"
                                        placeholderTextColor={theme.textMuted}
                                        autoCapitalize="characters"
                                        value={referralCode}
                                        onChangeText={setReferralCode}
                                        onFocus={() => setFocusedInput('referralCode')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>

                                {/* Accept Terms Checkbox */}
                                <TouchableOpacity 
                                    onPress={() => setAcceptTerms(!acceptTerms)}
                                    style={styles.termsRow}
                                    activeOpacity={0.8}
                                >
                                    <View style={[
                                        styles.checkboxBox, 
                                        acceptTerms && { backgroundColor: theme.accentTeal, borderColor: theme.accentTeal }
                                    ]}>
                                        {acceptTerms && <Ionicons name="checkmark" size={12} color="#0E1A2E" />}
                                    </View>
                                    <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                                        I agree to ABUMAFHAL's <Text style={{ color: theme.accentTeal, fontWeight: '800' }}>Terms of Service</Text> and <Text style={{ color: theme.accentTeal, fontWeight: '800' }}>Privacy Policy</Text>.
                                    </Text>
                                </TouchableOpacity>

                                {/* Primary Create Account Button */}
                                <TouchableOpacity 
                                    onPress={handleSignup}
                                    disabled={loading}
                                    style={styles.primaryBtn}
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
                                                <Text style={styles.primaryBtnText}>Create My Account</Text>
                                                <Ionicons name="checkmark-circle" size={18} color="#08E4C7" style={{ marginLeft: 8 }} />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Social Provider Row */}
                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.borderPrimary }]} />
                                    <Text style={[styles.dividerText, { color: theme.textMuted }]}>OR SIGN UP WITH</Text>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.borderPrimary }]} />
                                </View>

                                <View style={styles.socialGrid}>
                                    <TouchableOpacity onPress={() => handleSocialAuth('google')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                        {socialLoading === 'google' ? <ActivityIndicator size="small" color="#EA4335" /> : <Ionicons name="logo-google" size={18} color="#EA4335" />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Google</Text>
                                    </TouchableOpacity>

                                    {(Platform.OS === 'ios' || Platform.OS === 'web') && (
                                        <TouchableOpacity onPress={() => handleSocialAuth('apple')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                            {socialLoading === 'apple' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-apple" size={18} color={theme.textPrimary} />}
                                            <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Apple</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity onPress={() => handleSocialAuth('github')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                        {socialLoading === 'github' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-github" size={18} color={theme.textPrimary} />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>GitHub</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Footer Link */}
                                <View style={styles.footerLinkRow}>
                                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>Already have an account?</Text>
                                    <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.8}>
                                        <Text style={[styles.signupLinkText, { color: theme.accentTeal }]}> Sign In</Text>
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Country</Text>
                            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                                <Ionicons name="close-circle" size={24} color={theme.textMuted} />
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
                                <Text style={{ fontSize: 20, marginRight: 10 }}>{c.flag}</Text>
                                <Text style={{ flex: 1, color: theme.textPrimary, fontWeight: '700', fontSize: 13 }}>{c.name}</Text>
                                <Text style={{ color: theme.accentTeal, fontWeight: '800', fontSize: 12 }}>{c.dialCode}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* Registration Success Celebration Modal */}
            <Modal transparent visible={showSuccessModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.successCard, { backgroundColor: isDark ? '#0E1A2E' : '#FFFFFF' }]}>
                        <View style={styles.successIconCircle}>
                            <Ionicons name="checkmark-done" size={40} color="#08E4C7" />
                        </View>
                        <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Welcome to ABUMAFHAL 🎉</Text>
                        <Text style={[styles.successSubText, { color: theme.textSecondary }]}>
                            Your account has been created successfully! Preparing your personalized fintech portal...
                        </Text>
                        <ActivityIndicator size="small" color="#08E4C7" style={{ marginTop: 12 }} />
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
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoImage: {
        width: 28,
        height: 28,
        marginRight: 6,
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 0.5,
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
        marginTop: 14,
    },
    mascotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 2,
    },
    headlineBox: {
        alignItems: 'center',
        marginBottom: 14,
    },
    welcomeTitle: {
        fontWeight: '900',
        fontSize: 22,
        textAlign: 'center',
    },
    welcomeSubText: {
        fontSize: 11.5,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
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
    suggestionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    suggestionLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    suggestionPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 99,
    },
    suggestionPillText: {
        fontSize: 10.5,
        fontWeight: '700',
    },
    countryBtn: {
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    strengthBgTrack: {
        height: 5,
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
        marginTop: 14,
        marginBottom: 16,
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    termsText: {
        flex: 1,
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 15,
    },
    primaryBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 14,
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
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
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
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    socialTile: {
        flex: 1,
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
    },
    modalTitle: {
        fontWeight: '800',
        fontSize: 16,
    },
    countryOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    successCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    successIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(8, 228, 199, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        borderWidth: 2,
        borderColor: '#08E4C7',
    },
    successTitle: {
        fontWeight: '900',
        fontSize: 17,
        textAlign: 'center',
        marginBottom: 6,
    },
    successSubText: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 17,
    },
});
