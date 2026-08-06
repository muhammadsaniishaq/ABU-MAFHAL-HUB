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
            Alert.alert('Username Taken', 'The username you selected is already in use.');
            return;
        }

        if (emailAvailable === false) {
            Alert.alert('Email In Use', 'An account already exists with this email address.');
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
                }, 1600);
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
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
                                <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
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
                                <Ionicons name={isDark ? "sunny" : "moon"} size={14} color={isDark ? "#FDE047" : "#0E1A2E"} />
                            </TouchableOpacity>
                        </View>

                        {/* Centered Form Card Wrapper */}
                        <View style={[styles.cardWrapper, isTabletOrDesktop && styles.desktopCardWrapper]}>
                            
                            {/* Compact 3D Male Cartoon Mascot */}
                            <View style={styles.mascotContainer}>
                                <Mascot3D size={85} greetingText="Welcome to ABUMAFHAL! ✨" isDarkMode={isDark} />
                            </View>

                            {/* Headline */}
                            <View style={styles.headlineBox}>
                                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                                    Create Account <Text style={{ color: theme.gold }}>.</Text>
                                </Text>
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

                                {/* Terms Checkbox */}
                                <TouchableOpacity 
                                    onPress={() => setAcceptTerms(!acceptTerms)}
                                    style={styles.termsRow}
                                    activeOpacity={0.8}
                                >
                                    <View style={[
                                        styles.checkboxBox, 
                                        acceptTerms && { backgroundColor: theme.accentTeal, borderColor: theme.accentTeal }
                                    ]}>
                                        {acceptTerms && <Ionicons name="checkmark" size={10} color="#0E1A2E" />}
                                    </View>
                                    <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                                        I accept ABUMAFHAL's <Text style={{ color: theme.accentTeal, fontWeight: '800' }}>Terms</Text> & <Text style={{ color: theme.accentTeal, fontWeight: '800' }}>Privacy Policy</Text>.
                                    </Text>
                                </TouchableOpacity>

                                {/* Primary Button */}
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
                                                <Ionicons name="checkmark-circle" size={16} color="#08E4C7" style={{ marginLeft: 6 }} />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Social Sign Up Grid */}
                                <View style={styles.socialGrid}>
                                    <TouchableOpacity onPress={() => handleSocialAuth('google')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                        {socialLoading === 'google' ? <ActivityIndicator size="small" color="#EA4335" /> : <Ionicons name="logo-google" size={14} color="#EA4335" />}
                                        <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Google</Text>
                                    </TouchableOpacity>

                                    {(Platform.OS === 'ios' || Platform.OS === 'web') && (
                                        <TouchableOpacity onPress={() => handleSocialAuth('apple')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                            {socialLoading === 'apple' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-apple" size={14} color={theme.textPrimary} />}
                                            <Text style={[styles.socialTileText, { color: theme.textPrimary }]}>Apple</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity onPress={() => handleSocialAuth('github')} disabled={!!socialLoading} style={[styles.socialTile, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]} activeOpacity={0.8}>
                                        {socialLoading === 'github' ? <ActivityIndicator size="small" color={theme.textPrimary} /> : <Ionicons name="logo-github" size={14} color={theme.textPrimary} />}
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
        paddingBottom: 10,
    },
    topControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    backBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
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
        fontSize: 14,
        letterSpacing: 0.5,
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
        fontWeight: '700',
        fontSize: 10,
        marginBottom: 3,
    },
    inputFieldBox: {
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        fontSize: 11.5,
        fontWeight: '600',
    },
    countryBtn: {
        height: 36,
        borderRadius: 8,
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
        marginBottom: 10,
    },
    checkboxBox: {
        width: 15,
        height: 15,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    termsText: {
        flex: 1,
        fontSize: 10,
        fontWeight: '500',
        lineHeight: 14,
    },
    primaryBtn: {
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
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12.5,
    },
    socialGrid: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'space-between',
        marginBottom: 10,
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
});
