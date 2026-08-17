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
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

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

    // Camera QR Scanner States & Handlers
    const [permission, requestPermission] = useCameraPermissions();
    const [showCameraScannerModal, setShowCameraScannerModal] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [isScanningImage, setIsScanningImage] = useState(false);

    const openCameraScanner = async () => {
        setScanned(false);
        setShowCameraScannerModal(true);
        if (!permission?.granted) {
            try {
                await requestPermission();
            } catch (e) {
                console.log('Camera permission error:', e);
            }
        }
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned || !data) return;
        setScanned(true);
        
        let extractedCode = data.trim();
        try {
            if (extractedCode.includes('ref=') || extractedCode.includes('code=')) {
                const searchStr = extractedCode.includes('?') ? extractedCode.split('?')[1] : extractedCode;
                const searchParams = new URLSearchParams(searchStr);
                const codeParam = searchParams.get('ref') || searchParams.get('code') || searchParams.get('referral');
                if (codeParam) extractedCode = codeParam;
            } else if (extractedCode.includes('/')) {
                const parts = extractedCode.split('/');
                extractedCode = parts[parts.length - 1] || extractedCode;
            }
        } catch (e) {
            console.log('QR parse notice:', e);
        }

        const cleanCode = extractedCode.toUpperCase().trim();
        setReferralCode(cleanCode);
        setShowCameraScannerModal(false);
        Alert.alert("QR Code Scanned! 🎉", `Referral code "${cleanCode}" successfully applied.`);
    };

    const pickImageFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const selectedAsset = result.assets[0];
            setIsScanningImage(true);

            const formData = new FormData();
            if (Platform.OS === 'web') {
                const response = await fetch(selectedAsset.uri);
                const blob = await response.blob();
                formData.append('file', blob, 'qr.png');
            } else {
                formData.append('file', {
                    uri: selectedAsset.uri,
                    name: 'qr.png',
                    type: 'image/png',
                } as any);
            }

            const apiRes = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
                method: 'POST',
                body: formData,
            });

            const jsonRes = await apiRes.json();
            setIsScanningImage(false);

            const qrText = jsonRes[0]?.symbol[0]?.data;
            if (qrText) {
                handleBarCodeScanned({ data: qrText });
            } else {
                Alert.alert("Scan Notice", "Could not detect a clear QR code in this image. Please ensure the QR code is centered and clear.");
            }
        } catch (e: any) {
            setIsScanningImage(false);
            console.log('Gallery QR decode error:', e);
            Alert.alert("Notice", "Unable to decode image automatically. You can paste or type the referral code directly into the box.");
        }
    };

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
            const cleanP = phone.trim();
            if (cleanP.length < 7) {
                setPhoneAvailable(null);
                return;
            }
            setCheckingPhone(true);
            try {
                const fullPhone = selectedCountry.dialCode + cleanP.replace(/^0+/, '');
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'phone', value: fullPhone }
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
    }, [phone, selectedCountry]);

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
            notifyUser('Username Taken ❌', 'The username you selected is already in use. Please try another.');
            return;
        }

        if (emailAvailable === false) {
            notifyUser('Email In Use ❌', 'An account already exists with this email address. Please Log In instead.');
            return;
        }

        if (phoneAvailable === false) {
            notifyUser('Phone Number In Use ❌', 'An account already exists with this phone number. Please Log In or use another phone number.');
            return;
        }

        setLoading(true);

        try {
            const cleanPhone = selectedCountry.dialCode + cleanPhoneInput.replace(/^0+/, '');
            const digits10 = cleanPhoneInput.replace(/\D/g, '').slice(-10);

            // Direct Database Pre-Check to guarantee absolute uniqueness
            try {
                const { data: existingProfiles } = await supabase
                    .from('profiles')
                    .select('email, username, phone')
                    .or(`email.ilike.${cleanEmail},username.ilike.${cleanUsername}${digits10 ? `,phone.ilike.%${digits10}%` : ''}`);

                if (existingProfiles && existingProfiles.length > 0) {
                    for (const existing of existingProfiles) {
                        if (existing.email && existing.email.toLowerCase() === cleanEmail.toLowerCase()) {
                            notifyUser('Email Already In Use 🔒', 'An account is already registered with this Email address.');
                            setLoading(false);
                            return;
                        }
                        if (existing.username && existing.username.toLowerCase() === cleanUsername.toLowerCase()) {
                            notifyUser('Username Already Taken 🔒', 'This Username is already registered. Please choose a different username.');
                            setLoading(false);
                            return;
                        }
                        if (existing.phone && digits10 && existing.phone.includes(digits10)) {
                            notifyUser('Phone Number Already In Use 🔒', 'An account is already registered with this Phone Number.');
                            setLoading(false);
                            return;
                        }
                    }
                }
            } catch (preCheckError) {
                console.log('Pre-signup DB check notice:', preCheckError);
            }

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
                                        { flex: 1, backgroundColor: theme.bgInput, borderColor: phoneAvailable === false ? '#EF4444' : focusedInput === 'phone' ? theme.borderFocus : theme.borderPrimary }
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
                                        {checkingPhone && <ActivityIndicator size="small" color={theme.accentTeal} />}
                                    </View>
                                </View>
                                {phoneAvailable === false && (
                                    <Text style={{ color: '#EF4444', fontSize: 9.5, fontWeight: '700', marginTop: -4, marginBottom: 4 }}>
                                        ❌ Phone number is already registered
                                    </Text>
                                )}
                                {phoneAvailable === true && (
                                    <Text style={{ color: '#10B981', fontSize: 9.5, fontWeight: '700', marginTop: -4, marginBottom: 4 }}>
                                        ✓ Phone number available
                                    </Text>
                                )}

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

                                {/* Referral Code (Optional) + Camera Scan Button */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Referral Code (Optional)</Text>
                                    <TouchableOpacity 
                                        onPress={openCameraScanner} 
                                        style={[styles.scanQrPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', borderColor: '#F59E0B' }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="qr-code-outline" size={13} color="#F59E0B" />
                                        <Text style={styles.scanQrPillText}>Scan QR 📷</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: focusedInput === 'referralCode' ? theme.borderFocus : theme.borderPrimary, marginBottom: 6, paddingRight: 8 }
                                ]}>
                                    <TextInput 
                                        style={[styles.textInput, { color: theme.textPrimary }]}
                                        placeholder="ABUMAF123 or @username"
                                        placeholderTextColor={theme.textMuted}
                                        autoCapitalize="characters"
                                        value={referralCode}
                                        onChangeText={setReferralCode}
                                        onFocus={() => setFocusedInput('referralCode')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                    {referralCode.trim().length > 0 ? (
                                        <TouchableOpacity onPress={() => setReferralCode('')} style={{ padding: 4 }}>
                                            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity onPress={openCameraScanner} style={{ padding: 4 }}>
                                            <Ionicons name="camera-outline" size={20} color="#F59E0B" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Applied Referral Code Badge Indicator */}
                                {referralCode.trim().length > 0 && (
                                    <View style={[styles.referralBadgeBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', borderColor: '#10B981' }]}>
                                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                        <Text style={[styles.referralBadgeText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                                            Referral Applied: <Text style={{ fontWeight: '900' }}>{referralCode.trim().toUpperCase()}</Text> 🎉
                                        </Text>
                                    </View>
                                )}

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

                                {/* Official Google Sign Up Button */}
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
                                            <Text style={[styles.googleLoginBtnText, { color: theme.textPrimary }]}>Sign Up with Google</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

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

            {/* Camera QR Scanner Modal */}
            <Modal
                visible={showCameraScannerModal}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowCameraScannerModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
                    <StatusBar style="light" />
                    <View style={styles.scannerHeader}>
                        <TouchableOpacity onPress={() => setShowCameraScannerModal(false)} style={styles.scannerCloseBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.scannerTitle}>SCAN REFERRAL QR CODE</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <View style={styles.scannerBody}>
                        {permission?.granted ? (
                            <View style={styles.cameraContainer}>
                                <CameraView
                                    style={StyleSheet.absoluteFillObject}
                                    facing="back"
                                    onBarcodeScanned={scanned ? undefined : (res) => {
                                        const val = res?.data || (res as any)?.nativeEvent?.data;
                                        if (val) handleBarCodeScanned({ data: val });
                                    }}
                                    barcodeScannerSettings={{
                                        barcodeTypes: ["qr"],
                                    }}
                                />
                                <View style={styles.viewfinderOverlay}>
                                    <View style={styles.targetFrame}>
                                        <View style={[styles.corner, styles.topLeft]} />
                                        <View style={[styles.corner, styles.topRight]} />
                                        <View style={[styles.corner, styles.bottomLeft]} />
                                        <View style={[styles.corner, styles.bottomRight]} />
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.permissionBox}>
                                <Ionicons name="camera-outline" size={64} color="#F59E0B" />
                                <Text style={styles.permissionTitle}>Camera Access Needed</Text>
                                <Text style={styles.permissionSub}>We need camera access to scan your friend's referral QR code.</Text>
                                <TouchableOpacity onPress={requestPermission} style={styles.grantBtn}>
                                    <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={styles.scannerFooter}>
                        <Text style={styles.scannerSubText}>Align the referral QR code inside the box to scan automatically</Text>
                        <TouchableOpacity onPress={pickImageFromGallery} style={styles.galleryBtn} disabled={isScanningImage}>
                            {isScanningImage ? (
                                <ActivityIndicator size="small" color="#0F172A" />
                            ) : (
                                <>
                                    <Ionicons name="images-outline" size={18} color="#0F172A" />
                                    <Text style={styles.galleryBtnText}>Pick from Gallery 🖼️</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
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
        width: 32,
        height: 32,
        marginRight: 6,
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 0.4,
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
        height: 3,
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
        marginRight: 5,
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
    scanQrPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
    },
    scanQrPillText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#F59E0B',
    },
    referralBadgeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 10,
    },
    referralBadgeText: {
        fontSize: 10.5,
        fontWeight: '600',
    },
    scannerHeader: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    scannerCloseBtn: {
        padding: 4,
    },
    scannerTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1,
    },
    scannerBody: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    viewfinderOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    targetFrame: {
        width: 240,
        height: 240,
        position: 'relative',
        borderRadius: 16,
    },
    corner: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderColor: '#F59E0B',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 12,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 12,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 12,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 12,
    },
    permissionBox: {
        alignItems: 'center',
        padding: 24,
    },
    permissionTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 18,
        marginTop: 16,
        marginBottom: 6,
    },
    permissionSub: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 18,
    },
    grantBtn: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 16,
    },
    grantBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 13,
    },
    scannerFooter: {
        padding: 20,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        gap: 12,
    },
    scannerSubText: {
        color: '#94A3B8',
        fontSize: 11,
        textAlign: 'center',
    },
    galleryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 16,
    },
    galleryBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 12,
    },
});
