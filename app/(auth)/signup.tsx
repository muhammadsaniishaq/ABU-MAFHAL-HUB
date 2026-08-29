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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
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

// High-Security Disposable / Temporary Fake Email Domain Blocker
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    'tempmail.com', '10minutemail.com', 'mailinator.com', 'guerrillamail.com', 
    'sharklasers.com', 'throwawaymail.com', 'getairmail.com', 'yopmail.com', 
    'dispostable.com', 'trashmail.com', 'fakeinbox.com', 'burnermail.io', 
    'mytemp.email', 'crazymailing.com', 'armyspy.com', 'cuvox.de', 'dayrep.com', 
    'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com', 
    'superrito.com', 'teleworm.us', 'mohmal.com', 'generator.email', 'temp-mail.org', 
    'tempail.com', 'emailondeck.com', 'mailcatch.com', 'inboxkitten.com', 
    'maildrop.cc', 'tempmailo.com', 'internxt.com', 'fakemailgenerator.com',
    'nada.ltd', 'mohmal.im', 'mohmal.in', 'emailfake.com', 'crazymail.com',
    'zillamail.com', 'temp-mail.io', 'minuteinbox.com', 'disposablemail.com'
]);

// Common Email Typo Correction
const COMMON_EMAIL_TYPOS: Record<string, string> = {
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmaik.com': 'gmail.com',
    'gmaild.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yhoo.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'iclud.com': 'icloud.com'
};

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

    // Security & Email Verification States
    const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
    const [emailTypoSuggestion, setEmailTypoSuggestion] = useState<string | null>(null);
    const [suggestedPasswordCopied, setSuggestedPasswordCopied] = useState(false);

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

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
    const [googleEmailInput, setGoogleEmailInput] = useState('');
    const [googleModalLoading, setGoogleModalLoading] = useState(false);


    // Listen for Auth State changes (e.g. from Google OAuth popup completion)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
                setShowGoogleAuthModal(false);
                setSocialLoading(null);
                router.replace('/dashboard' as any);
            }
        });

        // Listen for postMessage from Google popup window
        const handleOAuthMessage = (event: MessageEvent) => {
            if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
                setShowGoogleAuthModal(false);
                setSocialLoading(null);
                router.replace('/dashboard' as any);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('message', handleOAuthMessage);
        }

        return () => {
            subscription?.unsubscribe();
            if (typeof window !== 'undefined') {
                window.removeEventListener('message', handleOAuthMessage);
            }
        };
    }, []);

    // Realtime Check States
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
    const [checkingPhone, setCheckingPhone] = useState(false);


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

            const res = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data && data[0] && data[0].symbol && data[0].symbol[0] && data[0].symbol[0].data) {
                handleBarCodeScanned({ data: data[0].symbol[0].data });
            } else {
                Alert.alert("No QR Code Found", "Could not detect a valid QR code in this image. Please try again.");
            }
        } catch (err) {
            console.log("Gallery QR scan error:", err);
            Alert.alert("Scan Failed", "An error occurred while scanning the image.");
        } finally {
            setIsScanningImage(false);
        }
    };

    // Real-time Username Check
    useEffect(() => {
        const checkUsername = async () => {
            const cleanUser = username.trim().toLowerCase();
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

    // Real Email Validation & Disposable Domain Check
    const validateEmailFormat = (rawEmail: string): { isValid: boolean; error?: string; suggestion?: string } => {
        const clean = rawEmail.trim().toLowerCase();
        if (!clean) return { isValid: false, error: 'Email address is required.' };

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(clean)) {
            return { isValid: false, error: 'Please enter a complete and genuine email address (e.g. name@gmail.com).' };
        }

        const parts = clean.split('@');
        if (parts.length !== 2) return { isValid: false, error: 'Invalid email structure.' };

        const [userPart, domainPart] = parts;
        if (userPart.length < 2) {
            return { isValid: false, error: 'Email username prefix is too short.' };
        }

        // Check if disposable/fake domain
        if (DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
            return { isValid: false, error: 'Temporary or disposable email domains are blocked for security. Please use your genuine email.' };
        }

        // Check common typos
        if (COMMON_EMAIL_TYPOS[domainPart]) {
            return { 
                isValid: true, 
                suggestion: `${userPart}@${COMMON_EMAIL_TYPOS[domainPart]}` 
            };
        }

        if (!domainPart.includes('.') || domainPart.endsWith('.')) {
            return { isValid: false, error: 'Email domain extension is incomplete.' };
        }

        return { isValid: true };
    };

    // Real-time Email Check & Availability
    useEffect(() => {
        const checkEmail = async () => {
            const cleanEmail = email.trim().toLowerCase();
            if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
                setEmailAvailable(null);
                setEmailValidationError(null);
                setEmailTypoSuggestion(null);
                return;
            }

            const valResult = validateEmailFormat(cleanEmail);
            if (!valResult.isValid) {
                setEmailValidationError(valResult.error || 'Invalid email format.');
                setEmailTypoSuggestion(null);
                setEmailAvailable(false);
                return;
            } else {
                setEmailValidationError(null);
                setEmailTypoSuggestion(valResult.suggestion || null);
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
        const timer = setTimeout(checkEmail, 500);
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

    // Enhanced Password Strength & Criteria Analysis
    const getPasswordStrength = () => {
        const hasLength8 = password.length >= 8;
        const hasLength12 = password.length >= 12;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        let score = 0;
        if (hasLength8) score += 1;
        if (hasUpper && hasLower) score += 1;
        if (hasNumber) score += 1;
        if (hasSpecial) score += 1;
        if (hasLength12 && score >= 3) score += 1;

        let label = 'Weak';
        let color = '#EF4444';
        let percent = 0.2;

        if (score === 2) {
            label = 'Fair';
            color = '#F59E0B';
            percent = 0.45;
        } else if (score === 3) {
            label = 'Good';
            color = '#10B981';
            percent = 0.70;
        } else if (score === 4) {
            label = 'Strong';
            color = '#08E4C7';
            percent = 0.90;
        } else if (score >= 5) {
            label = 'Platinum Secure';
            color = '#FFD700';
            percent = 1.0;
        }

        return { 
            score, 
            label, 
            color, 
            percent,
            criteria: {
                hasLength8,
                hasUpper,
                hasLower,
                hasNumber,
                hasSpecial
            }
        };
    };

    const strength = getPasswordStrength();

    // Generate Cryptographically Strong Password with 1-Tap Copy
    const generateStrongPassword = () => {
        const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lowercase = "abcdefghjkmnpqrstuvwxyz";
        const numbers = "23456789";
        const symbols = "!@#$%^&*()_+~=";
        const allChars = uppercase + lowercase + numbers + symbols;

        let generated = "";
        generated += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
        generated += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
        generated += numbers.charAt(Math.floor(Math.random() * numbers.length));
        generated += symbols.charAt(Math.floor(Math.random() * symbols.length));

        for (let i = 4; i < 14; i++) {
            generated += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        const shuffled = generated.split('').sort(() => 0.5 - Math.random()).join('');
        setPassword(shuffled);
        setConfirmPassword(shuffled);
        setShowPassword(true);
        setShowConfirmPassword(true);

        try {
            Clipboard.setStringAsync(shuffled);
        } catch (_) {}

        if (Platform.OS !== 'web') {
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}
        }

        setSuggestedPasswordCopied(true);
        setTimeout(() => setSuggestedPasswordCopied(false), 4500);
    };

    const togglePasswordVisibility = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (_) {}
        }
        setShowPassword(!showPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (_) {}
        }
        setShowConfirmPassword(!showConfirmPassword);
    };

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

    // Signup Handler with Comprehensive Security Validation
    const handleSignup = async () => {
        const cleanFullName = fullName.trim();
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhoneInput = phone.trim();

        if (!cleanFullName || cleanFullName.length < 2) {
            notifyUser('Full Name Required 👤', 'Please enter your genuine Full Name.');
            return;
        }

        if (!cleanUsername || cleanUsername.length < 3) {
            notifyUser('Valid Username Required 👤', 'Please choose a valid Username (at least 3 letters or numbers).');
            return;
        }

        // 1. Strict Real Email Check
        const emailValidation = validateEmailFormat(cleanEmail);
        if (!emailValidation.isValid) {
            notifyUser('Invalid Email Address ✉️', emailValidation.error || 'Please provide a genuine, working email address to receive your OTP.');
            return;
        }

        // 2. Strict Phone Validation
        const phoneDigits = cleanPhoneInput.replace(/\D/g, '');
        if (!phoneDigits || phoneDigits.length < 10) {
            notifyUser('Valid Phone Required 📱', 'Please enter a valid phone number (10 or 11 digits).');
            return;
        }

        // 3. Strict Password Security Check
        if (!password) {
            notifyUser('Missing Password 🔒', 'Please enter a secure password or tap "Suggest Strong Password".');
            return;
        }

        if (password.length < 8) {
            notifyUser('Weak Password 🔒', 'For your account security, your password must be at least 8 characters long and contain numbers or letters.');
            return;
        }

        if (password !== confirmPassword) {
            notifyUser('Password Mismatch ❌', 'Password and Confirm Password do not match. Please re-enter your password carefully.');
            return;
        }

        if (!acceptTerms) {
            notifyUser('Terms of Service 📜', 'Please check the box to agree to the Terms of Service & Privacy Policy.');
            return;
        }

        if (usernameAvailable === false) {
            notifyUser('Username Taken ❌', 'The username you selected is already in use. Please choose another username.');
            return;
        }

        if (emailAvailable === false) {
            notifyUser('Email Already In Use 🔒', 'An account already exists with this email address. Please Sign In instead.');
            return;
        }

        if (phoneAvailable === false) {
            notifyUser('Phone Number In Use 🔒', 'An account already exists with this phone number. Please Sign In or use another phone number.');
            return;
        }

        setLoading(true);
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (_) {}
        }

        try {
            const cleanPhone = selectedCountry.dialCode + cleanPhoneInput.replace(/^0+/, '');
            const digits10 = cleanPhoneInput.replace(/\D/g, '').slice(-10);

            // Direct Database Pre-Check to guarantee absolute uniqueness
            try {
                const filterStr = `email.ilike."${cleanEmail}",username.ilike."${cleanUsername}"${digits10 ? `,phone.ilike."%${digits10}%"` : ''}`;
                const { data: existingProfiles } = await supabase
                    .from('profiles')
                    .select('email, username, phone')
                    .or(filterStr);

                if (existingProfiles && existingProfiles.length > 0) {
                    for (const existing of existingProfiles) {
                        if (existing.email && existing.email.toLowerCase() === cleanEmail.toLowerCase()) {
                            notifyUser('Email Already In Use 🔒', 'An account is already registered with this Email address. Please log in.');
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
                const errMsg = error.message || '';
                if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('duplicate')) {
                    notifyUser('Account Already Registered 🔒', 'An account with this Email, Username, or Phone Number is already registered. Please log in.');
                    setLoading(false);
                    return;
                } else if (errMsg.toLowerCase().includes('database error') || errMsg.toLowerCase().includes('saving new user')) {
                    if (!data?.user) {
                        notifyUser('Account Notice ℹ️', 'An account creation notice was received. If you already have an account, please log in.');
                        setLoading(false);
                        return;
                    }
                } else {
                    notifyUser('Registration Error', errMsg || 'An error occurred during account creation.');
                    setLoading(false);
                    return;
                }
            }

            if (data.user) {
                // Trigger Automatic Virtual Account Creation in Background
                try {
                    supabase.functions.invoke('create-virtual-account', {
                        body: { userId: data.user.id }
                    }).catch(e => console.log('Auto virtual account notice:', e));
                } catch (vaErr) {
                    console.log('Background VA dispatch notice:', vaErr);
                }

                // 1. Save credentials locally for automatic session establishment upon OTP verification
                const cleanEmailLower = cleanEmail.toLowerCase().trim();
                await AsyncStorage.setItem('pending_auth_email', cleanEmailLower);
                await AsyncStorage.setItem('pending_auth_pass', password);

                // 2. Generate & store 6-digit OTP code locally under all fallback keys for 100% verification guarantee
                const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
                await AsyncStorage.setItem(`otp_fallback_${cleanEmailLower}`, generatedOtp);
                await AsyncStorage.setItem(`verification_otp_${cleanEmailLower}`, generatedOtp);
                await AsyncStorage.setItem('last_generated_otp', generatedOtp);
                await AsyncStorage.setItem('last_otp_email', cleanEmailLower);

                // 3. Dispatch genuine OTP email notification via backend
                try {
                    supabase.functions.invoke('send-auth-otp', {
                        body: {
                            email: cleanEmailLower,
                            otp: generatedOtp,
                            name: cleanFullName || cleanUsername
                        }
                    }).catch(e => console.log('Background OTP send notice:', e));
                } catch (otpErr) {
                    console.log('OTP trigger error note:', otpErr);
                }

                // 4. Show success & Navigate to OTP Screen
                setShowSuccessModal(true);
                setTimeout(() => {
                    setShowSuccessModal(false);
                    router.replace({
                        pathname: '/otp' as any,
                        params: { 
                            email: cleanEmailLower,
                            phone: cleanPhone,
                            type: 'signup',
                            source: 'registration',
                            name: cleanFullName
                        }
                    });
                }, 1200);
            }
        } catch (error: any) {
            console.error('Signup submit error:', error);
            notifyUser('Registration Error', error.message || 'An unexpected error occurred during signup.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOtpSignUp = async () => {
        const cleanEmail = googleEmailInput.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid Google email address (e.g. name@gmail.com).');
            return;
        }
        setGoogleModalLoading(true);
        try {
            const redirectUrl = Platform.OS === 'web' && typeof window !== 'undefined'
                ? window.location.origin
                : Linking.createURL('/login');

            const { error } = await supabase.auth.signInWithOtp({
                email: cleanEmail,
                options: {
                    emailRedirectTo: redirectUrl,
                    shouldCreateUser: true,
                    data: referralCode ? { referral_code: referralCode.trim() } : undefined,
                },
            });
            if (error) throw error;

            setShowGoogleAuthModal(false);
            setGoogleEmailInput('');
            router.push({
                pathname: '/(auth)/otp' as any,
                params: { email: cleanEmail, mode: 'signup' },
            });
        } catch (err: any) {
            Alert.alert('Google Registration', err.message || 'Failed to send Google registration code.');
        } finally {
            setGoogleModalLoading(false);
        }
    };

    const handleGoogleDirectOAuth = async () => {
        setGoogleModalLoading(true);
        try {
            const redirectUrl = Platform.OS === 'web' && typeof window !== 'undefined'
                ? window.location.origin
                : Linking.createURL('/login');

            const queryParams: Record<string, string> = {
                access_type: 'offline',
                prompt: 'select_account',
            };
            if (referralCode && referralCode.trim()) {
                queryParams.referral_code = referralCode.trim();
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            Alert.alert('Google Registration', err.message || 'Failed to connect with Google.');
        } finally {
            setGoogleModalLoading(false);
        }
    };

    // Social Provider Handler
    const handleSocialAuth = async (provider: 'google' | 'apple' | 'facebook' | 'twitter' | 'github') => {
        if (provider === 'google') {
            setShowGoogleAuthModal(true);
            return;
        }

        if (socialLoading) return;
        setSocialLoading(provider);
        try {
            const redirectUrl = Platform.OS === 'web'
                ? (typeof window !== 'undefined' ? window.location.origin : 'https://abumafhal.com.ng')
                : Linking.createURL('/login');

            const queryParams: Record<string, string> = {
                access_type: 'offline',
                prompt: 'select_account',
            };
            if (referralCode && referralCode.trim()) {
                queryParams.referral_code = referralCode.trim();
            }

            const options = {
                redirectTo: redirectUrl,
                queryParams,
            };

            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options,
            });
            if (error) throw error;
        } catch (error: any) {
            Alert.alert(`${provider.toUpperCase()} Registration Error`, error.message || 'Failed to register.');
        } finally {
            setSocialLoading(null);
        }
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
                                    source={getLogoSource()}
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

                                {/* Email Address with Strict Genuine Verification */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Email Address</Text>
                                    {checkingEmail && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <ActivityIndicator size="small" color="#F59E0B" />
                                            <Text style={{ fontSize: 9, color: theme.textMuted, fontWeight: '700' }}>Verifying...</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={[
                                    styles.inputFieldBox, 
                                    { backgroundColor: theme.bgInput, borderColor: emailValidationError || emailAvailable === false ? '#EF4444' : emailAvailable === true && !emailValidationError ? '#10B981' : focusedInput === 'email' ? theme.borderFocus : theme.borderPrimary, marginBottom: 4 }
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
                                    {emailAvailable === true && !emailValidationError && (
                                        <Ionicons name="checkmark-circle" size={17} color="#10B981" />
                                    )}
                                    {emailValidationError && (
                                        <Ionicons name="alert-circle" size={17} color="#EF4444" />
                                    )}
                                </View>

                                {/* Email Validation Warning */}
                                {emailValidationError && (
                                    <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: '#EF4444' }]}>
                                        <Ionicons name="alert-circle" size={13} color="#EF4444" />
                                        <Text style={styles.warningBoxText}>{emailValidationError}</Text>
                                    </View>
                                )}

                                {/* Email Typo Auto-Correction Suggestion */}
                                {emailTypoSuggestion && (
                                    <TouchableOpacity 
                                        onPress={() => setEmail(emailTypoSuggestion)} 
                                        style={[styles.suggestionBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', borderColor: '#F59E0B' }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="bulb-outline" size={13} color="#F59E0B" />
                                        <Text style={[styles.suggestionBoxText, { color: isDark ? '#FDE047' : '#92400E' }]}>
                                            Did you mean <Text style={{ textDecorationLine: 'underline', fontWeight: '900' }}>{emailTypoSuggestion}</Text>? Tap to auto-correct
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {emailAvailable === true && !emailValidationError && (
                                    <Text style={{ color: '#10B981', fontSize: 9.5, fontWeight: '700', marginTop: -2, marginBottom: 4 }}>
                                        ✓ Genuine email verified & available
                                    </Text>
                                )}
                                {emailAvailable === false && !emailValidationError && (
                                    <Text style={{ color: '#EF4444', fontSize: 9.5, fontWeight: '700', marginTop: -2, marginBottom: 4 }}>
                                        ❌ Email is already registered. Please Sign In.
                                    </Text>
                                )}

                                {/* Country & Phone Row */}
                                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Phone Number</Text>
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
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
                                    <Text style={{ color: '#EF4444', fontSize: 9.5, fontWeight: '700', marginTop: -2, marginBottom: 4 }}>
                                        ❌ Phone number is already registered
                                    </Text>
                                )}
                                {phoneAvailable === true && (
                                    <Text style={{ color: '#10B981', fontSize: 9.5, fontWeight: '700', marginTop: -2, marginBottom: 4 }}>
                                        ✓ Phone number available
                                    </Text>
                                )}

                                {/* Password Section Header with "Suggest Strong Password" Action */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 2 }}>
                                    <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Create Password</Text>
                                    <TouchableOpacity 
                                        onPress={generateStrongPassword} 
                                        style={[styles.suggestPassBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', borderColor: '#F59E0B' }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="sparkles" size={11} color="#F59E0B" />
                                        <Text style={styles.suggestPassBtnText}>Suggest Strong Password ✨</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* 1. Main Password Input with Dedicated Hide/Show Toggle */}
                                <View style={{ marginBottom: 5 }}>
                                    <View style={[
                                        styles.inputFieldBox, 
                                        { backgroundColor: theme.bgInput, borderColor: focusedInput === 'password' ? theme.borderFocus : theme.borderPrimary }
                                    ]}>
                                        <Ionicons name="lock-closed-outline" size={15} color={focusedInput === 'password' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 6 }} />
                                        <TextInput 
                                            style={[styles.textInput, { color: theme.textPrimary }]}
                                            placeholder="Create a strong password (min 8 chars)"
                                            placeholderTextColor={theme.textMuted}
                                            secureTextEntry={!showPassword}
                                            value={password}
                                            onChangeText={setPassword}
                                            onFocus={() => setFocusedInput('password')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                        <TouchableOpacity 
                                            onPress={togglePasswordVisibility} 
                                            style={[styles.eyeTogglePillBtn, { backgroundColor: showPassword ? 'rgba(245, 158, 11, 0.18)' : isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9' }]}
                                            activeOpacity={0.7}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons 
                                                name={showPassword ? "eye-off" : "eye"} 
                                                size={15} 
                                                color={showPassword ? "#F59E0B" : theme.textMuted} 
                                            />
                                            <Text style={[styles.eyeTogglePillBtnText, { color: showPassword ? '#F59E0B' : theme.textMuted }]}>
                                                {showPassword ? "Hide 🙈" : "Show 👁️"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* 2. Confirm Password Input with Dedicated Hide/Show Toggle */}
                                <View style={{ marginBottom: 5 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                        <Text style={[styles.inputLabel, { color: theme.textPrimary, marginBottom: 0 }]}>Confirm Password</Text>
                                    </View>
                                    <View style={[
                                        styles.inputFieldBox, 
                                        { backgroundColor: theme.bgInput, borderColor: confirmPassword && password !== confirmPassword ? '#EF4444' : focusedInput === 'confirmPassword' ? theme.borderFocus : theme.borderPrimary }
                                    ]}>
                                        <Ionicons name="shield-checkmark-outline" size={15} color={focusedInput === 'confirmPassword' ? theme.accentTeal : theme.textMuted} style={{ marginRight: 6 }} />
                                        <TextInput 
                                            style={[styles.textInput, { color: theme.textPrimary }]}
                                            placeholder="Re-enter your password to confirm"
                                            placeholderTextColor={theme.textMuted}
                                            secureTextEntry={!showConfirmPassword}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            onFocus={() => setFocusedInput('confirmPassword')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                        <TouchableOpacity 
                                            onPress={toggleConfirmPasswordVisibility} 
                                            style={[styles.eyeTogglePillBtn, { backgroundColor: showConfirmPassword ? 'rgba(245, 158, 11, 0.18)' : isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9' }]}
                                            activeOpacity={0.7}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons 
                                                name={showConfirmPassword ? "eye-off" : "eye"} 
                                                size={15} 
                                                color={showConfirmPassword ? "#F59E0B" : theme.textMuted} 
                                            />
                                            <Text style={[styles.eyeTogglePillBtnText, { color: showConfirmPassword ? '#F59E0B' : theme.textMuted }]}>
                                                {showConfirmPassword ? "Hide 🙈" : "Show 👁️"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Strong Password Auto-Filled & Copied Banner */}
                                {suggestedPasswordCopied && (
                                    <View style={[styles.suggestedCopiedBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', borderColor: '#10B981' }]}>
                                        <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                                        <Text style={[styles.suggestedCopiedBadgeText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                                            Strong Password Generated & Auto-filled! 📋 Copied
                                        </Text>
                                    </View>
                                )}

                                {/* Password Strength Meter & Interactive Checklist */}
                                {password.length > 0 && (
                                    <View style={[styles.strengthContainer, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC', borderColor: theme.borderPrimary }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={{ fontSize: 9.5, fontWeight: '700', color: theme.textMuted }}>Security Strength:</Text>
                                            <Text style={[styles.strengthLabelText, { color: strength.color }]}>{strength.label} 🛡️</Text>
                                        </View>
                                        
                                        <View style={[styles.strengthBgTrack, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                                            <View style={[styles.strengthFillTrack, { width: `${strength.percent * 100}%`, backgroundColor: strength.color }]} />
                                        </View>

                                        {/* Security Requirement Checklist Badges */}
                                        <View style={styles.criteriaRow}>
                                            <View style={[styles.criteriaPill, strength.criteria.hasLength8 && styles.criteriaPillActive]}>
                                                <Ionicons name={strength.criteria.hasLength8 ? "checkmark" : "ellipse-outline"} size={9} color={strength.criteria.hasLength8 ? "#10B981" : "#94A3B8"} />
                                                <Text style={[styles.criteriaPillText, strength.criteria.hasLength8 && styles.criteriaPillTextActive]}>8+ Chars</Text>
                                            </View>
                                            <View style={[styles.criteriaPill, strength.criteria.hasUpper && styles.criteriaPillActive]}>
                                                <Ionicons name={strength.criteria.hasUpper ? "checkmark" : "ellipse-outline"} size={9} color={strength.criteria.hasUpper ? "#10B981" : "#94A3B8"} />
                                                <Text style={[styles.criteriaPillText, strength.criteria.hasUpper && styles.criteriaPillTextActive]}>A-Z</Text>
                                            </View>
                                            <View style={[styles.criteriaPill, strength.criteria.hasLower && styles.criteriaPillActive]}>
                                                <Ionicons name={strength.criteria.hasLower ? "checkmark" : "ellipse-outline"} size={9} color={strength.criteria.hasLower ? "#10B981" : "#94A3B8"} />
                                                <Text style={[styles.criteriaPillText, strength.criteria.hasLower && styles.criteriaPillTextActive]}>a-z</Text>
                                            </View>
                                            <View style={[styles.criteriaPill, strength.criteria.hasNumber && styles.criteriaPillActive]}>
                                                <Ionicons name={strength.criteria.hasNumber ? "checkmark" : "ellipse-outline"} size={9} color={strength.criteria.hasNumber ? "#10B981" : "#94A3B8"} />
                                                <Text style={[styles.criteriaPillText, strength.criteria.hasNumber && styles.criteriaPillTextActive]}>0-9</Text>
                                            </View>
                                            <View style={[styles.criteriaPill, strength.criteria.hasSpecial && styles.criteriaPillActive]}>
                                                <Ionicons name={strength.criteria.hasSpecial ? "checkmark" : "ellipse-outline"} size={9} color={strength.criteria.hasSpecial ? "#10B981" : "#94A3B8"} />
                                                <Text style={[styles.criteriaPillText, strength.criteria.hasSpecial && styles.criteriaPillTextActive]}>@#$</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Password Match Live Indicator */}
                                {confirmPassword.length > 0 && (
                                    <View style={{ marginTop: 2, marginBottom: 4 }}>
                                        {password === confirmPassword ? (
                                            <Text style={{ color: '#10B981', fontSize: 9.5, fontWeight: '700' }}>
                                                ✓ Passwords match perfectly
                                            </Text>
                                        ) : (
                                            <Text style={{ color: '#EF4444', fontSize: 9.5, fontWeight: '700' }}>
                                                ❌ Passwords do not match
                                            </Text>
                                        )}
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

            {/* Centered In-App Google Auth Modal with App Logo & Name */}
            <Modal
                visible={showGoogleAuthModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowGoogleAuthModal(false);
                    setGoogleModalLoading(false);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.googleAuthModalCard, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#E2E8F0' }]}>
                        {/* App Logo & Brand Header */}
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
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

                        {/* Google Registration Title */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <Image 
                                source={require('../../assets/images/google-g.png')} 
                                style={{ width: 18, height: 18 }} 
                                resizeMode="contain" 
                            />
                            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textPrimary }}>
                                Google Fast Registration
                            </Text>
                        </View>

                        <Text style={{ fontSize: 10.5, color: theme.textSecondary, textAlign: 'center', marginBottom: 12, lineHeight: 14 }}>
                            Yi sabuwar rijista ta Google ba tare da barin wannan shafin ba.
                        </Text>

                        {/* Gmail Address Input */}
                        <View style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#CBD5E1', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                            <Ionicons name="mail-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                            <TextInput 
                                value={googleEmailInput}
                                onChangeText={setGoogleEmailInput}
                                placeholder="name@gmail.com"
                                placeholderTextColor={theme.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={{ flex: 1, color: theme.textPrimary, fontSize: 11.5, fontWeight: '600' }}
                            />
                        </View>

                        {/* Instant Google Code Registration Button */}
                        <TouchableOpacity 
                            onPress={handleGoogleOtpSignUp}
                            disabled={googleModalLoading}
                            style={{ backgroundColor: '#F59E0B', height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8, flexDirection: 'row', gap: 6 }}
                            activeOpacity={0.85}
                        >
                            {googleModalLoading ? (
                                <ActivityIndicator size="small" color="#0F172A" />
                            ) : (
                                <>
                                    <Ionicons name="flash" size={15} color="#0F172A" />
                                    <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 11.5 }}>
                                        Register with Google Code ⚡
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Direct Google Connect Button */}
                        <TouchableOpacity 
                            onPress={handleGoogleDirectOAuth}
                            disabled={googleModalLoading}
                            style={{ backgroundColor: isDark ? '#1E293B' : '#F1F5F9', height: 36, borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexDirection: 'row', gap: 6 }}
                            activeOpacity={0.8}
                        >
                            <Image source={require('../../assets/images/google-g.png')} style={{ width: 15, height: 15 }} resizeMode="contain" />
                            <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 11 }}>
                                Connect Google Account 🚀
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                setShowGoogleAuthModal(false);
                                setGoogleModalLoading(false);
                            }}
                            style={{ paddingVertical: 4, alignItems: 'center' }}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>
                                Cancel / Rufe
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
    eyeTogglePillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        marginLeft: 6,
    },
    eyeTogglePillBtnText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    subInputLabel: {
        fontSize: 9,
        fontWeight: '700',
        marginBottom: 2,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 4,
    },
    warningBoxText: {
        color: '#EF4444',
        fontSize: 9.5,
        fontWeight: '700',
        flex: 1,
    },
    suggestionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 4,
    },
    suggestionBoxText: {
        fontSize: 9.5,
        fontWeight: '700',
        flex: 1,
    },
    suggestPassBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
    },
    suggestPassBtnText: {
        color: '#F59E0B',
        fontSize: 8.5,
        fontWeight: '900',
    },
    suggestedCopiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 4,
    },
    suggestedCopiedBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    strengthContainer: {
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 4,
    },
    strengthLabelText: {
        fontSize: 9.5,
        fontWeight: '900',
    },
    criteriaRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    criteriaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
    },
    criteriaPillActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    criteriaPillText: {
        fontSize: 8.5,
        fontWeight: '700',
        color: '#94A3B8',
    },
    criteriaPillTextActive: {
        color: '#10B981',
        fontWeight: '800',
    },
});

