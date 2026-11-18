import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Switch,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, forceSignOut } from '../../services/supabase';

const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
    'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara'
];

/**
 * Robust Nigerian phone normalizer
 * Handles:
 * - 08012345678 (11 digits starting with 0)
 * - 8012345678  (10 digits without leading 0 -> adds 0)
 * - +2348012345678 (international with + -> converts to 080...)
 * - 2348012345678 (international without + -> converts to 080...)
 */
export function normalizeNigerianPhone(raw: string): { isValid: boolean; formatted: string; error?: string } {
    if (!raw || !raw.trim()) {
        return { isValid: false, formatted: '', error: 'Please enter your phone number.' };
    }
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('234')) {
        digits = '0' + digits.slice(3);
    }
    if (digits.length === 10 && !digits.startsWith('0')) {
        digits = '0' + digits;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
        return { isValid: true, formatted: digits };
    }
    if (digits.length < 11) {
        return { isValid: false, formatted: digits, error: `Incomplete phone number (${digits.length}/11 digits). Please enter full 11 digits.` };
    }
    return { isValid: false, formatted: digits, error: 'Please enter a valid 11-digit phone number (e.g. 08012345678).' };
}

export default function CompleteProfileScreen() {
    const router = useRouter();

    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [fullName, setFullName] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [whatsappNumber, setWhatsappNumber] = useState<string>('');
    const [sameAsPhone, setSameAsPhone] = useState<boolean>(true);
    const [selectedState, setSelectedState] = useState<string>('Kano');
    const [showStateModal, setShowStateModal] = useState<boolean>(false);
    const [stateSearch, setStateSearch] = useState<string>('');

    // Error & Notice banners
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Loading & Action states
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // WhatsApp OTP Modal State
    const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
    const [otpCode, setOtpCode] = useState<string[]>(new Array(6).fill(''));
    const [otpLoading, setOtpLoading] = useState<boolean>(false);
    const [otpCountdown, setOtpCountdown] = useState<number>(60);
    const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
    const [activeWaTarget, setActiveWaTarget] = useState<string>('');
    const otpInputRefs = useRef<Array<TextInput | null>>([]);

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        let timer: any;
        if (showOtpModal && otpCountdown > 0) {
            timer = setInterval(() => setOtpCountdown(c => c - 1), 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showOtpModal, otpCountdown]);

    const notifyError = (title: string, message: string) => {
        setErrorMessage(message);
        if (Platform.OS === 'web') {
            try {
                if (typeof window !== 'undefined' && window.alert) {
                    window.alert(`${title}\n\n${message}`);
                }
            } catch (_) {}
        } else {
            Alert.alert(title, message);
        }
    };

    const loadUserProfile = async () => {
        try {
            let activeUser = (await supabase.auth.getUser()).data.user;
            if (!activeUser) {
                const { data: { session } } = await supabase.auth.getSession();
                activeUser = session?.user || null;
            }

            if (!activeUser) {
                const cachedEmail = await AsyncStorage.getItem('pending_auth_email');
                if (cachedEmail) {
                    setUserEmail(cachedEmail);
                }
                notifyError('Session Notice', 'Authentication session not found. Please log in.');
                setTimeout(() => {
                    router.replace('/(auth)/login' as any);
                }, 1500);
                return;
            }

            setUserId(activeUser.id);
            setUserEmail(activeUser.email || '');

            const cachedName = await AsyncStorage.getItem('pending_reg_full_name');
            const cachedUsername = await AsyncStorage.getItem('pending_reg_username');
            const cachedPhone = await AsyncStorage.getItem('pending_reg_phone');

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username, phone, whatsapp_number, state')
                .eq('id', activeUser.id)
                .maybeSingle();

            // 1. Full name resolution
            if (profile?.full_name && profile.full_name.trim().length >= 2) {
                setFullName(profile.full_name);
            } else if (activeUser.user_metadata?.full_name) {
                setFullName(activeUser.user_metadata.full_name);
            } else if (activeUser.user_metadata?.name) {
                setFullName(activeUser.user_metadata.name);
            } else if (cachedName) {
                setFullName(cachedName);
            }

            // 2. Username resolution
            if (profile?.username && profile.username.trim().length >= 2) {
                setUsername(profile.username);
            } else if (activeUser.user_metadata?.username) {
                setUsername(activeUser.user_metadata.username);
            } else if (cachedUsername) {
                setUsername(cachedUsername);
            } else if (activeUser.email) {
                const fallbackUser = activeUser.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                setUsername(fallbackUser);
            }

            // 3. Phone resolution
            const candidatePhone = profile?.phone || cachedPhone || '';
            if (candidatePhone) {
                const norm = normalizeNigerianPhone(candidatePhone);
                setPhone(norm.formatted || candidatePhone);
                setWhatsappNumber(profile?.whatsapp_number || norm.formatted || candidatePhone);
            }

            if (profile?.whatsapp_number && profile?.phone && profile.whatsapp_number !== profile.phone) {
                setSameAsPhone(false);
                setWhatsappNumber(profile.whatsapp_number);
            }

            if (profile?.state) {
                setSelectedState(profile.state);
            }
        } catch (e) {
            console.error('Error loading profile in CompleteProfile:', e);
        } finally {
            setInitialLoading(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        setErrorMessage(null);
        let cleaned = text.replace(/[^0-9+]/g, '');
        if (cleaned.startsWith('+234')) {
            cleaned = '0' + cleaned.slice(4);
        } else if (cleaned.startsWith('234') && cleaned.length > 10) {
            cleaned = '0' + cleaned.slice(3);
        }
        const digitsOnly = cleaned.replace(/\D/g, '').slice(0, 11);
        setPhone(digitsOnly);
        if (sameAsPhone) {
            setWhatsappNumber(digitsOnly);
        }
    };

    const handleWhatsappChange = (text: string) => {
        setErrorMessage(null);
        let cleaned = text.replace(/[^0-9+]/g, '');
        if (cleaned.startsWith('+234')) {
            cleaned = '0' + cleaned.slice(4);
        } else if (cleaned.startsWith('234') && cleaned.length > 10) {
            cleaned = '0' + cleaned.slice(3);
        }
        const digitsOnly = cleaned.replace(/\D/g, '').slice(0, 11);
        setWhatsappNumber(digitsOnly);
    };

    const toggleSameAsPhone = (val: boolean) => {
        setErrorMessage(null);
        setSameAsPhone(val);
        if (val) {
            setWhatsappNumber(phone);
        }
    };

    // Step 1: Pre-validation & Strict Anti-Duplicate Check before launching WhatsApp OTP
    const handleInitiateVerification = async () => {
        setErrorMessage(null);
        setSuccessMessage(null);

        let currentUserId = userId;
        if (!currentUserId) {
            const { data: { user } } = await supabase.auth.getUser();
            currentUserId = user?.id || null;
            if (!currentUserId) {
                const { data: { session } } = await supabase.auth.getSession();
                currentUserId = session?.user?.id || null;
            }
        }

        if (!currentUserId) {
            notifyError('Session Error', 'User authentication session not found. Please log in.');
            router.replace('/(auth)/login' as any);
            return;
        }

        // 1. Full Name Validation
        if (!fullName || !fullName.trim() || fullName.trim().length < 3) {
            notifyError('Full Name Required ⚠️', 'Please enter your genuine full name (minimum 3 characters).');
            return;
        }

        // 2. Username Validation
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3) {
            notifyError('Username Required ⚠️', 'Please choose a valid username (min 3 characters, letters and numbers only).');
            return;
        }

        // 3. Phone Number Format Validation
        const phoneVal = normalizeNigerianPhone(phone);
        if (!phoneVal.isValid) {
            notifyError('Invalid Phone Number ⚠️', phoneVal.error || 'Please enter an 11-digit Nigerian phone number (e.g. 08012345678).');
            return;
        }

        const effectiveWhatsapp = sameAsPhone ? phoneVal.formatted : whatsappNumber.trim();
        let waVal = phoneVal;
        if (!sameAsPhone && effectiveWhatsapp) {
            waVal = normalizeNigerianPhone(effectiveWhatsapp);
            if (!waVal.isValid) {
                notifyError('Invalid WhatsApp Number ⚠️', 'Please enter a valid 11-digit WhatsApp phone number.');
                return;
            }
        }

        setSubmitting(true);
        try {
            // 🛡️ 4. STRICT DATABASE CHECK: PREVENT DUPLICATE PHONE NUMBER ACROSS ALL PROFILES
            // Check via Edge Function (runs with service role key, bypassing RLS completely)
            const { data: phoneCheckData, error: phoneCheckErr } = await supabase.functions.invoke('send-otp', {
                body: {
                    action: 'check_duplicate',
                    identifier: phoneVal.formatted,
                    userId: currentUserId
                }
            });

            if (phoneCheckData?.is_duplicate) {
                notifyError(
                    'Phone Number Already Registered 🔒',
                    `The phone number ${phoneVal.formatted} is already registered to another account in our system. Duplicate phone numbers are strictly prohibited. Please provide your personal phone number.`
                );
                setSubmitting(false);
                return;
            }

            // Check WhatsApp Number for duplicates if different
            if (!sameAsPhone && waVal.formatted !== phoneVal.formatted) {
                const { data: waCheckData } = await supabase.functions.invoke('send-otp', {
                    body: {
                        action: 'check_duplicate',
                        identifier: waVal.formatted,
                        userId: currentUserId
                    }
                });

                if (waCheckData?.is_duplicate) {
                    notifyError(
                        'WhatsApp Number In Use 🔒',
                        `The WhatsApp number ${waVal.formatted} is already linked to another account. Please use your personal number.`
                    );
                    setSubmitting(false);
                    return;
                }
            }

            // 🛡️ 5. STRICT DATABASE CHECK: PREVENT DUPLICATE USERNAME
            const { data: duplicateUsernames } = await supabase
                .from('profiles')
                .select('id, username')
                .ilike('username', cleanUsername)
                .neq('id', currentUserId)
                .limit(1);

            if (duplicateUsernames && duplicateUsernames.length > 0) {
                notifyError(
                    'Username Already Taken 🔒',
                    `The username "${cleanUsername}" is already taken by another user. Please choose a different username.`
                );
                setSubmitting(false);
                return;
            }

            // 🚀 6. DISPATCH WHATSAPP OTP VIA SEND-OTP EDGE FUNCTION
            const targetIdentifier = waVal.formatted;
            setActiveWaTarget(targetIdentifier);

            const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-otp', {
                body: {
                    action: 'send',
                    identifier: targetIdentifier,
                    channel: 'whatsapp',
                    purpose: 'profile_completion',
                    userId: currentUserId,
                    name: fullName.trim(),
                }
            });

            if (sendErr || sendData?.success === false) {
                throw new Error(sendData?.message || sendErr?.message || 'Failed to dispatch WhatsApp verification code.');
            }

            if (sendData?.whatsapp_url) {
                setWhatsappUrl(sendData.whatsapp_url);
            }

            setOtpCode(new Array(6).fill(''));
            setOtpCountdown(60);
            setShowOtpModal(true);

            if (Platform.OS !== 'web') {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
            }
        } catch (err: any) {
            notifyError('Verification Notice ⚠️', err.message || 'Unable to dispatch WhatsApp code. Please check your phone number and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // OTP Digit Inputs Handling
    const handleOtpDigitChange = (val: string, index: number) => {
        const cleanDigits = val.replace(/\D/g, '');
        if (cleanDigits.length >= 6) {
            const digits = cleanDigits.slice(0, 6).split('');
            setOtpCode(digits);
            handleVerifyCode(cleanDigits.slice(0, 6));
            return;
        }

        const value = cleanDigits.slice(-1);
        const newCode = [...otpCode];
        newCode[index] = value;
        setOtpCode(newCode);

        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }

        if (newCode.every(d => d !== '') && newCode.join('').length === 6) {
            handleVerifyCode(newCode.join(''));
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handlePasteClipboard = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            const cleanDigits = text.replace(/\D/g, '').slice(0, 6);
            if (cleanDigits.length === 6) {
                setOtpCode(cleanDigits.split(''));
                handleVerifyCode(cleanDigits);
            } else {
                notifyError('Clipboard Notice', 'Clipboard does not contain a 6-digit verification code.');
            }
        } catch (_) {}
    };

    const handleResendWhatsappOtp = async () => {
        if (otpCountdown > 0 || otpLoading) return;
        setOtpLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-otp', {
                body: {
                    action: 'send',
                    identifier: activeWaTarget || phone,
                    channel: 'whatsapp',
                    purpose: 'profile_completion',
                    userId: userId,
                    name: fullName.trim(),
                }
            });

            if (error || data?.success === false) {
                throw new Error(data?.message || 'Failed to resend WhatsApp code.');
            }

            if (data?.whatsapp_url) {
                setWhatsappUrl(data.whatsapp_url);
            }

            setOtpCountdown(60);
            const notice = `Fresh 6-digit WhatsApp code sent to ${activeWaTarget || phone}!`;
            if (Platform.OS === 'web') alert(notice);
            else Alert.alert('Code Sent 🟢', notice);
        } catch (err: any) {
            Alert.alert('Resend Failed', err.message || 'Unable to resend OTP.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Step 2: Verify WhatsApp OTP and Commit Profile Updates to Database
    const handleVerifyCode = async (codeToVerify: string) => {
        if (codeToVerify.length !== 6 || otpLoading) return;

        setOtpLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-otp', {
                body: {
                    action: 'verify',
                    identifier: activeWaTarget || phone,
                    code: codeToVerify,
                    purpose: 'profile_completion',
                    userId: userId,
                }
            });

            if (error || data?.success === false) {
                throw new Error(data?.message || 'Invalid or expired WhatsApp OTP code. Please check and try again.');
            }

            // Direct Database Update
            const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            const phoneVal = normalizeNigerianPhone(phone);
            const effectiveWhatsapp = sameAsPhone ? phoneVal.formatted : whatsappNumber.trim();
            const waVal = normalizeNigerianPhone(effectiveWhatsapp);

            const updatePayload: Record<string, any> = {
                full_name: fullName.trim(),
                username: cleanUsername,
                phone: phoneVal.formatted,
                whatsapp_number: waVal.formatted || phoneVal.formatted,
                state: selectedState,
                phone_verified: true,
                whatsapp_verified: true,
                status: 'active',
                updated_at: new Date().toISOString()
            };

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', userId);

            if (profileUpdateError) {
                throw new Error(profileUpdateError.message || 'Failed to update profile record.');
            }

            // Background Auto Virtual Account Generation
            try {
                supabase.functions.invoke('create-virtual-account', {
                    body: { userId: userId }
                }).catch(() => {});
            } catch (_) {}

            setShowOtpModal(false);

            if (Platform.OS !== 'web') {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
            }

            const successMsg = 'Profile & WhatsApp verified successfully! Proceeding to setup your 4-digit transaction PIN...';
            setSuccessMessage(successMsg);

            setTimeout(() => {
                router.replace('/(auth)/pin-setup' as any);
            }, 600);

        } catch (err: any) {
            Alert.alert('Verification Failed ❌', err.message || 'Invalid WhatsApp code. Please check and try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleSignOut = async () => {
        await forceSignOut();
        router.replace('/(auth)/login' as any);
    };

    const filteredStates = NIGERIAN_STATES.filter(st =>
        st.toLowerCase().includes(stateSearch.toLowerCase().trim())
    );

    if (initialLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <Text style={styles.loadingText}>Loading profile details...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Top Security Step Badge */}
                    <View style={styles.stepBadgeRow}>
                        <View style={styles.stepBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#B45309" />
                            <Text style={styles.stepBadgeText}>STEP 2 OF 2 • SECURE ONBOARDING</Text>
                        </View>
                    </View>

                    {/* Executive Modern Light Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#0A1128', '#111D3B']}
                            style={styles.logoBadge}
                        >
                            <FontAwesome5 name="user-check" size={18} color="#D4AF37" />
                        </LinearGradient>
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>
                            Provide your genuine contact information to activate automated VTU services, virtual accounts, and 24/7 transaction alerts.
                        </Text>
                    </View>

                    {/* Clean White Card */}
                    <View style={styles.card}>
                        {/* 🚨 VISIBLE ERROR BANNER */}
                        {errorMessage && (
                            <View style={styles.errorBannerBox}>
                                <Ionicons name="alert-circle" size={22} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.errorBannerTitle}>Input Required</Text>
                                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setErrorMessage(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Ionicons name="close" size={18} color="#991B1B" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ✅ VISIBLE SUCCESS BANNER */}
                        {successMessage && (
                            <View style={styles.successBannerBox}>
                                <Ionicons name="checkmark-circle" size={22} color="#16A34A" style={{ marginRight: 8, marginTop: 1 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.successBannerTitle}>Profile Saved</Text>
                                    <Text style={styles.successBannerText}>{successMessage}</Text>
                                </View>
                            </View>
                        )}

                        {/* Email (Read Only - Authenticated) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>AUTHENTICATED EMAIL</Text>
                            <View style={[styles.inputBox, styles.readOnlyBox]}>
                                <Ionicons name="mail" size={16} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.readOnlyText]}
                                    value={userEmail}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={15} color="#94A3B8" />
                            </View>
                        </View>

                        {/* Full Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                FULL NAME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="person-outline" size={17} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Muhammad Sani Isyaku"
                                    placeholderTextColor="#94A3B8"
                                    value={fullName}
                                    onChangeText={(t) => {
                                        setErrorMessage(null);
                                        setFullName(t);
                                    }}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        {/* Username */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                UNIQUE USERNAME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="at" size={17} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. sani_hub"
                                    placeholderTextColor="#94A3B8"
                                    value={username}
                                    onChangeText={(t) => {
                                        setErrorMessage(null);
                                        setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                    }}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Phone Number with Nigerian Flag */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                PHONE NUMBER <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <View style={styles.countryPrefix}>
                                    <Text style={styles.flag}>🇳🇬</Text>
                                    <Text style={styles.countryCode}>+234</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="08012345678"
                                    placeholderTextColor="#94A3B8"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    maxLength={14}
                                />
                            </View>
                            <Text style={styles.helperText}>Each account must have a unique personal phone number.</Text>
                        </View>

                        {/* WhatsApp Number Switch */}
                        <View style={styles.switchCard}>
                            <View style={styles.switchLeft}>
                                <View style={styles.whatsappIconCircle}>
                                    <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Same WhatsApp Number</Text>
                                    <Text style={styles.switchSubtitle}>Use your phone number for WhatsApp verification</Text>
                                </View>
                            </View>
                            <Switch
                                value={sameAsPhone}
                                onValueChange={toggleSameAsPhone}
                                trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                                thumbColor={sameAsPhone ? '#FFFFFF' : '#F1F5F9'}
                            />
                        </View>

                        {/* Separate WhatsApp Input (Only when toggled off) */}
                        {!sameAsPhone && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.microLabel}>
                                    WHATSAPP NUMBER <Text style={styles.required}>*</Text>
                                </Text>
                                <View style={styles.inputBox}>
                                    <View style={styles.countryPrefix}>
                                        <Ionicons name="logo-whatsapp" size={15} color="#16A34A" style={{ marginRight: 4 }} />
                                        <Text style={styles.countryCode}>+234</Text>
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="08012345678"
                                        placeholderTextColor="#94A3B8"
                                        value={whatsappNumber}
                                        onChangeText={handleWhatsappChange}
                                        keyboardType="phone-pad"
                                        maxLength={14}
                                    />
                                </View>
                            </View>
                        )}

                        {/* State Selection */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>STATE OF RESIDENCE</Text>
                            <TouchableOpacity
                                style={[styles.inputBox, styles.selectBox]}
                                onPress={() => {
                                    setStateSearch('');
                                    setShowStateModal(true);
                                }}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="location-outline" size={17} color="#D4AF37" style={styles.inputIcon} />
                                    <Text style={styles.selectText}>{selectedState}</Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Primary Action Button (Triggers WhatsApp OTP Verification) */}
                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, submitting && styles.disabledButton]}
                                onPress={handleInitiateVerification}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#0A1128', '#111D3B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <View style={styles.btnContentRow}>
                                            <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 8 }} />
                                            <Text style={styles.primaryButtonText}>Verify on WhatsApp & Proceed</Text>
                                            <Ionicons name="arrow-forward" size={16} color="#D4AF37" style={{ marginLeft: 8 }} />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={handleSignOut}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.logoutText}>Switch Account or Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* State Picker Modal (Clean Light Theme) */}
            <Modal
                visible={showStateModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowStateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.stateModalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="map-outline" size={18} color="#D4AF37" />
                                <Text style={styles.modalTitle}>Select State</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowStateModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search Nigerian state..."
                                placeholderTextColor="#94A3B8"
                                value={stateSearch}
                                onChangeText={setStateSearch}
                                autoCapitalize="none"
                            />
                            {stateSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setStateSearch('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                            {filteredStates.map((st) => {
                                const isSelected = selectedState === st;
                                return (
                                    <TouchableOpacity
                                        key={st}
                                        style={[styles.stateItem, isSelected && styles.selectedStateItem]}
                                        onPress={() => {
                                            setSelectedState(st);
                                            setShowStateModal(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.stateItemText, isSelected && styles.selectedStateItemText]}>
                                            {st}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            {filteredStates.length === 0 && (
                                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748B', fontSize: 13 }}>No states matching "{stateSearch}"</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 🟢 Ultra-Modern Executive Light WhatsApp OTP Modal */}
            <Modal
                visible={showOtpModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowOtpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.otpModalCard}>
                        {/* WhatsApp Emblem */}
                        <View style={styles.otpIconBadgeWa}>
                            <Ionicons name="logo-whatsapp" size={28} color="#16A34A" />
                        </View>

                        <Text style={styles.otpTitle}>Verify WhatsApp</Text>
                        <Text style={styles.otpSubtitle}>
                            We sent a 6-digit security code directly to your WhatsApp on{' '}
                            <Text style={styles.otpHighlight}>{activeWaTarget || phone}</Text>
                        </Text>

                        {/* Open WhatsApp Direct Button */}
                        {whatsappUrl && (
                            <TouchableOpacity
                                style={styles.openWhatsappPill}
                                onPress={() => Linking.openURL(whatsappUrl).catch(() => {})}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                                <Text style={styles.openWhatsappText}>Open WhatsApp to View Code</Text>
                                <Ionicons name="open-outline" size={13} color="#16A34A" />
                            </TouchableOpacity>
                        )}

                        {/* 6 Digit Inputs */}
                        <View style={styles.otpRow}>
                            {otpCode.map((digit, idx) => (
                                <TextInput
                                    key={idx}
                                    ref={ref => { otpInputRefs.current[idx] = ref; }}
                                    style={[
                                        styles.otpBox,
                                        digit ? styles.otpBoxFilled : null
                                    ]}
                                    value={digit}
                                    onChangeText={v => handleOtpDigitChange(v, idx)}
                                    onKeyPress={e => handleOtpKeyPress(e, idx)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    textAlign="center"
                                    selectTextOnFocus
                                />
                            ))}
                        </View>

                        {/* Actions: Paste and Resend */}
                        <View style={styles.otpHelperRow}>
                            <TouchableOpacity style={styles.pasteBtn} onPress={handlePasteClipboard}>
                                <Ionicons name="clipboard-outline" size={15} color="#B45309" />
                                <Text style={styles.pasteText}>Paste Code</Text>
                            </TouchableOpacity>

                            {otpCountdown > 0 ? (
                                <Text style={styles.timerText}>Resend in {otpCountdown}s</Text>
                            ) : (
                                <TouchableOpacity onPress={handleResendWhatsappOtp} disabled={otpLoading}>
                                    <Text style={styles.resendText}>Resend Code</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Primary Verify Button */}
                        <TouchableOpacity
                            style={[styles.primaryButton, { width: '100%', marginBottom: 10 }]}
                            onPress={() => handleVerifyCode(otpCode.join(''))}
                            disabled={otpLoading || otpCode.join('').length !== 6}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#0A1128', '#111D3B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                {otpLoading ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <View style={styles.btnContentRow}>
                                        <Text style={styles.primaryButtonText}>Verify & Complete Profile</Text>
                                        <Ionicons name="checkmark-done" size={17} color="#D4AF37" style={{ marginLeft: 8 }} />
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Cancel / Change Number */}
                        <TouchableOpacity
                            style={styles.cancelOtpButton}
                            onPress={() => setShowOtpModal(false)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelOtpText}>Change Phone Number</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 14,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 36,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 440,
    },
    stepBadgeRow: {
        alignItems: 'center',
        marginBottom: 10,
    },
    stepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    stepBadgeText: {
        color: '#B45309',
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoBadge: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 4,
        shadowColor: '#0A1128',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#071435',
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12.5,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 5,
        lineHeight: 18,
        paddingHorizontal: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#071435',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 3,
    },
    errorBannerBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF2F2',
        borderWidth: 1.5,
        borderColor: '#F87171',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorBannerTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#991B1B',
        marginBottom: 2,
    },
    errorBannerText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#B91C1C',
        lineHeight: 16,
    },
    successBannerBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    successBannerTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#166534',
        marginBottom: 2,
    },
    successBannerText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#15803D',
        lineHeight: 16,
    },
    inputGroup: {
        marginBottom: 14,
    },
    microLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    required: {
        color: '#EF4444',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    readOnlyBox: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#071435',
        fontSize: 14,
        fontWeight: '600',
    },
    readOnlyText: {
        color: '#64748B',
        fontWeight: '500',
    },
    countryPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
        paddingRight: 8,
    },
    flag: {
        fontSize: 14,
        marginRight: 4,
    },
    countryCode: {
        color: '#B45309',
        fontSize: 13,
        fontWeight: '800',
    },
    helperText: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 4,
        marginLeft: 2,
    },
    switchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    switchLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 8,
        gap: 10,
    },
    whatsappIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchTitle: {
        color: '#071435',
        fontSize: 13,
        fontWeight: '700',
    },
    switchSubtitle: {
        color: '#64748B',
        fontSize: 10.5,
        marginTop: 1,
    },
    selectBox: {
        justifyContent: 'space-between',
    },
    selectText: {
        color: '#071435',
        fontSize: 14,
        fontWeight: '600',
    },
    actionContainer: {
        marginTop: 10,
        marginBottom: 12,
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#071435',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    buttonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 48,
    },
    btnContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    logoutButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    logoutText: {
        color: '#64748B',
        fontSize: 12.5,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    disabledButton: {
        opacity: 0.6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 20, 53, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    stateModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#071435',
    },
    modalCloseBtn: {
        padding: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        color: '#071435',
        fontSize: 13,
        fontWeight: '600',
    },
    stateItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 2,
    },
    selectedStateItem: {
        backgroundColor: '#FEF3C7',
    },
    stateItemText: {
        color: '#334155',
        fontSize: 13.5,
        fontWeight: '500',
    },
    selectedStateItemText: {
        color: '#B45309',
        fontWeight: '800',
    },
    // Executive Modern Light OTP Modal Styling
    otpModalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 22,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        shadowColor: '#071435',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    otpIconBadgeWa: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#DCFCE7',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    otpTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: '#071435',
        letterSpacing: -0.2,
    },
    otpSubtitle: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 5,
        lineHeight: 17,
        paddingHorizontal: 6,
    },
    otpHighlight: {
        color: '#0F766E',
        fontWeight: '800',
    },
    openWhatsappPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#DCFCE7',
        borderColor: '#86EFAC',
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginTop: 12,
        marginBottom: 12,
    },
    openWhatsappText: {
        color: '#16A34A',
        fontSize: 12,
        fontWeight: '700',
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginVertical: 14,
    },
    otpBox: {
        width: 44,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        color: '#071435',
        fontSize: 22,
        fontWeight: '900',
    },
    otpBoxFilled: {
        borderColor: '#10B981',
        backgroundColor: '#ECFDF5',
        color: '#065F46',
    },
    otpHelperRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    pasteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pasteText: {
        color: '#B45309',
        fontSize: 12,
        fontWeight: '700',
    },
    timerText: {
        color: '#64748B',
        fontSize: 11.5,
    },
    resendText: {
        color: '#16A34A',
        fontSize: 12,
        fontWeight: '800',
    },
    cancelOtpButton: {
        paddingVertical: 6,
    },
    cancelOtpText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
});
