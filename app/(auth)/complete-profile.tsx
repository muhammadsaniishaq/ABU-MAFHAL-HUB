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
    Linking,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { supabase, forceSignOut } from '../../services/supabase';

const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
    'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara'
];

function validateNigerianPhone(phone: string): { isValid: boolean; formatted: string; error?: string } {
    const cleaned = (phone || '').replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        return { isValid: true, formatted: cleaned };
    }
    if (cleaned.length === 10 && !cleaned.startsWith('0')) {
        return { isValid: true, formatted: '0' + cleaned };
    }
    return { isValid: false, formatted: cleaned, error: 'Please enter a valid 11-digit phone number (e.g. 08012345678).' };
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

    // Initial Loading & Action states
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // OTP Verification Modal State
    const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
    const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
    const [otpCode, setOtpCode] = useState<string[]>(new Array(6).fill(''));
    const [otpLoading, setOtpLoading] = useState<boolean>(false);
    const [otpCountdown, setOtpCountdown] = useState<number>(60);
    const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
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

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/(auth)/login' as any);
                return;
            }

            setUserId(user.id);
            setUserEmail(user.email || '');

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username, phone, whatsapp_number, state')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                if (profile.full_name) setFullName(profile.full_name);
                else if (user.user_metadata?.full_name) setFullName(user.user_metadata.full_name);
                else if (user.user_metadata?.name) setFullName(user.user_metadata.name);

                if (profile.username) {
                    setUsername(profile.username);
                } else if (user.email) {
                    const fallbackUser = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    setUsername(fallbackUser);
                }

                if (profile.phone) setPhone(profile.phone);
                if (profile.whatsapp_number) {
                    setWhatsappNumber(profile.whatsapp_number);
                    if (profile.phone && profile.phone !== profile.whatsapp_number) {
                        setSameAsPhone(false);
                    }
                }
                if (profile.state) setSelectedState(profile.state);
            }
        } catch (e) {
            console.error('Error loading profile in CompleteProfile:', e);
        } finally {
            setInitialLoading(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        setPhone(cleaned);
        if (sameAsPhone) {
            setWhatsappNumber(cleaned);
        }
    };

    const handleWhatsappChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        setWhatsappNumber(cleaned);
    };

    const toggleSameAsPhone = (val: boolean) => {
        setSameAsPhone(val);
        if (val) {
            setWhatsappNumber(phone);
        }
    };

    // Trigger OTP sending
    const handleSendOtp = async (channel: 'whatsapp' | 'sms') => {
        // Validate inputs
        if (!fullName.trim() || fullName.trim().length < 3) {
            Alert.alert('Full Name Required', 'Please enter your genuine full name.');
            return;
        }

        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3) {
            Alert.alert('Username Required', 'Please enter a valid username (min 3 alphanumeric characters).');
            return;
        }

        const phoneVal = validateNigerianPhone(phone);
        if (!phoneVal.isValid) {
            Alert.alert('Invalid Phone', phoneVal.error || 'Please enter a valid 11-digit Nigerian phone number.');
            return;
        }

        const effectiveWhatsapp = sameAsPhone ? phoneVal.formatted : whatsappNumber;
        const waVal = validateNigerianPhone(effectiveWhatsapp);
        if (!waVal.isValid) {
            Alert.alert('Invalid WhatsApp Number', 'Please enter a valid 11-digit WhatsApp phone number.');
            return;
        }

        const targetIdentifier = channel === 'whatsapp' ? waVal.formatted : phoneVal.formatted;

        setSubmitting(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-otp', {
                body: {
                    action: 'send',
                    identifier: targetIdentifier,
                    channel: channel,
                    purpose: 'profile_completion',
                    userId: userId,
                    name: fullName.trim(),
                }
            });

            if (error || data?.success === false) {
                throw new Error(data?.message || error?.message || 'Failed to dispatch verification code.');
            }

            if (data?.whatsapp_url) {
                setWhatsappUrl(data.whatsapp_url);
            } else {
                setWhatsappUrl(`https://wa.me/2349065645747?text=VERIFY`);
            }

            setOtpChannel(channel);
            setOtpCode(new Array(6).fill(''));
            setOtpCountdown(60);
            setShowOtpModal(true);

            if (Platform.OS !== 'web') {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
            }
        } catch (err: any) {
            Alert.alert('Delivery Notice', err.message || 'Unable to send OTP at this time. Please try another channel.');
        } finally {
            setSubmitting(false);
        }
    };

    // OTP Inputs handling
    const handleOtpDigitChange = (val: string, index: number) => {
        const cleanDigits = val.replace(/\D/g, '');
        if (cleanDigits.length >= 6) {
            const split = cleanDigits.slice(0, 6).split('');
            setOtpCode(split);
            handleVerifyOtp(cleanDigits.slice(0, 6));
            return;
        }

        const char = cleanDigits.slice(-1);
        const next = [...otpCode];
        next[index] = char;
        setOtpCode(next);

        if (char && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }

        if (next.every(d => d !== '') && next.join('').length === 6) {
            handleVerifyOtp(next.join(''));
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handlePasteOtp = async () => {
        try {
            const clip = await Clipboard.getStringAsync();
            const cleaned = (clip || '').replace(/\D/g, '').slice(0, 6);
            if (cleaned.length === 6) {
                setOtpCode(cleaned.split(''));
                handleVerifyOtp(cleaned);
            } else {
                Alert.alert('Clipboard Empty', 'No 6-digit verification code found in clipboard.');
            }
        } catch (_) {}
    };

    const handleVerifyOtp = async (codeToVerify: string) => {
        if (!codeToVerify || codeToVerify.length !== 6 || otpLoading) return;

        setOtpLoading(true);
        const effectiveWhatsapp = sameAsPhone ? phone : whatsappNumber;
        const targetIdentifier = otpChannel === 'whatsapp' ? effectiveWhatsapp : phone;

        try {
            const { data, error } = await supabase.functions.invoke('send-otp', {
                body: {
                    action: 'verify',
                    identifier: targetIdentifier,
                    code: codeToVerify,
                    purpose: 'profile_completion',
                    userId: userId,
                }
            });

            if (error || data?.success === false) {
                throw new Error(data?.message || error?.message || 'Invalid or expired OTP code.');
            }

            // Save completed profile details to Supabase profiles
            const updatePayload: Record<string, any> = {
                full_name: fullName.trim(),
                username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
                phone: phone.trim(),
                whatsapp_number: effectiveWhatsapp.trim(),
                state: selectedState,
                phone_verified: true,
                whatsapp_verified: true,
                updated_at: new Date().toISOString()
            };

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', userId);

            if (profileUpdateError) {
                console.warn('Profile update notice:', profileUpdateError);
            }

            // Trigger background virtual account creation
            try {
                supabase.functions.invoke('create-virtual-account', {
                    body: { userId: userId }
                }).catch(() => {});
            } catch (_) {}

            setShowOtpModal(false);

            if (Platform.OS !== 'web') {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
            }

            const successMsg = 'Profile verified & completed successfully! Please set your 4-digit transaction PIN to secure your wallet.';
            if (Platform.OS === 'web') {
                alert(successMsg);
                router.replace('/(auth)/pin-setup' as any);
            } else {
                Alert.alert('Verified! 🎉', successMsg, [
                    {
                        text: 'Set Transaction PIN',
                        onPress: () => router.replace('/(auth)/pin-setup' as any)
                    }
                ]);
            }
        } catch (err: any) {
            Alert.alert('Verification Failed ❌', err.message || 'Incorrect verification code. Please try again.');
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
            <StatusBar style="light" />

            {/* Subtle Executive Gradient Mesh Background */}
            <LinearGradient
                colors={['#060B1E', '#0A192F', '#0D1B2A']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Glowing Accent Orbs */}
            <View style={styles.topAuraGold} />
            <View style={styles.topAuraEmerald} />

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
                            <Ionicons name="shield-checkmark" size={12} color="#D4AF37" />
                            <Text style={styles.stepBadgeText}>STEP 2 OF 2 • SECURE ONBOARDING</Text>
                        </View>
                    </View>

                    {/* Compact Modern Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#D4AF37', '#AA7C11']}
                            style={styles.logoBadge}
                        >
                            <FontAwesome5 name="user-check" size={20} color="#060B1E" />
                        </LinearGradient>
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>
                            Link your verified phone number & WhatsApp to unlock automated VTU services, instant wallet funding, and 24/7 alerts.
                        </Text>
                    </View>

                    {/* Compact Form Card */}
                    <View style={styles.card}>
                        {/* Email (Read Only - Compact Pill) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>AUTHENTICATED EMAIL</Text>
                            <View style={[styles.inputBox, styles.readOnlyBox]}>
                                <Ionicons name="mail" size={15} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.readOnlyText]}
                                    value={userEmail}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={14} color="#64748B" />
                            </View>
                        </View>

                        {/* Full Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                FULL NAME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="person-outline" size={16} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Muhammad Sani"
                                    placeholderTextColor="#475569"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        {/* Username */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                CHOOSE USERNAME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="at" size={16} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. sani_hub"
                                    placeholderTextColor="#475569"
                                    value={username}
                                    onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Phone Number with Nigeria Flag Pill */}
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
                                    placeholderTextColor="#475569"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                />
                            </View>
                        </View>

                        {/* Modern WhatsApp Compact Switch Row */}
                        <View style={styles.switchCard}>
                            <View style={styles.switchLeft}>
                                <View style={styles.whatsappIconCircle}>
                                    <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                                </View>
                                <View>
                                    <Text style={styles.switchTitle}>Same WhatsApp Number</Text>
                                    <Text style={styles.switchSubtitle}>Use this phone number for WhatsApp verification</Text>
                                </View>
                            </View>
                            <Switch
                                value={sameAsPhone}
                                onValueChange={toggleSameAsPhone}
                                trackColor={{ false: '#1E293B', true: '#10B981' }}
                                thumbColor={sameAsPhone ? '#FFFFFF' : '#94A3B8'}
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
                                        <Ionicons name="logo-whatsapp" size={14} color="#25D366" style={{ marginRight: 4 }} />
                                        <Text style={styles.countryCode}>+234</Text>
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="08012345678"
                                        placeholderTextColor="#475569"
                                        value={whatsappNumber}
                                        onChangeText={handleWhatsappChange}
                                        keyboardType="phone-pad"
                                        maxLength={11}
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
                                    <Ionicons name="location-outline" size={16} color="#D4AF37" style={styles.inputIcon} />
                                    <Text style={styles.selectText}>{selectedState}</Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {/* Instant Verification CTA Buttons */}
                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, submitting && styles.disabledButton]}
                                onPress={() => handleSendOtp('whatsapp')}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#25D366', '#128C7E']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    {submitting && otpChannel === 'whatsapp' ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <View style={styles.btnContentRow}>
                                            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.primaryButtonText}>Verify via WhatsApp (Instant OTP)</Text>
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => handleSendOtp('sms')}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#D4AF37" style={{ marginRight: 6 }} />
                                <Text style={styles.secondaryButtonText}>Verify via SMS Code</Text>
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

            {/* Modern Searchable State Picker Modal */}
            <Modal
                visible={showStateModal}
                animationType="slide"
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
                                <Ionicons name="close" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={15} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search Nigerian state..."
                                placeholderTextColor="#64748B"
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

            {/* Ultra-Modern WhatsApp OTP Modal */}
            <Modal
                visible={showOtpModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowOtpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.otpModalCard}>
                        {/* Emblem Badge */}
                        <View style={[
                            styles.otpIconBadge,
                            otpChannel === 'whatsapp' ? styles.otpIconBadgeWa : styles.otpIconBadgeSms
                        ]}>
                            <Ionicons
                                name={otpChannel === 'whatsapp' ? "logo-whatsapp" : "chatbubble-ellipses"}
                                size={26}
                                color={otpChannel === 'whatsapp' ? "#25D366" : "#D4AF37"}
                            />
                        </View>

                        <Text style={styles.otpTitle}>Enter 6-Digit Code</Text>
                        <Text style={styles.otpSubtitle}>
                            Dispatched via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to{' '}
                            <Text style={styles.otpHighlight}>
                                {otpChannel === 'whatsapp' ? (sameAsPhone ? phone : whatsappNumber) : phone}
                            </Text>
                        </Text>

                        {/* 1-Tap Open WhatsApp Button (Instant Access) */}
                        {otpChannel === 'whatsapp' && (
                            <TouchableOpacity
                                style={styles.openWhatsappPill}
                                onPress={() => {
                                    const target = whatsappUrl || `https://wa.me/2349065645747`;
                                    Linking.openURL(target).catch(() => {
                                        Alert.alert('Notice', 'Unable to launch WhatsApp on this device.');
                                    });
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                                <Text style={styles.openWhatsappText}>Open WhatsApp App 🟢</Text>
                            </TouchableOpacity>
                        )}

                        {/* 6 Compact OTP Boxes */}
                        <View style={styles.otpRow}>
                            {otpCode.map((digit, idx) => (
                                <TextInput
                                    key={idx}
                                    ref={el => { otpInputRefs.current[idx] = el; }}
                                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                                    keyboardType="number-pad"
                                    maxLength={idx === 0 ? 6 : 1}
                                    value={digit}
                                    onChangeText={v => handleOtpDigitChange(v, idx)}
                                    onKeyPress={e => handleOtpKeyPress(e, idx)}
                                    textAlign="center"
                                    selectionColor="#D4AF37"
                                />
                            ))}
                        </View>

                        {/* 1-Tap Paste & Timer Row */}
                        <View style={styles.otpHelperRow}>
                            <TouchableOpacity onPress={handlePasteOtp} style={styles.pasteBtn} activeOpacity={0.7}>
                                <Ionicons name="clipboard-outline" size={14} color="#D4AF37" />
                                <Text style={styles.pasteText}>Paste Code</Text>
                            </TouchableOpacity>

                            {otpCountdown > 0 ? (
                                <Text style={styles.timerText}>Resend in <Text style={{ color: '#D4AF37', fontWeight: '700' }}>{otpCountdown}s</Text></Text>
                            ) : (
                                <TouchableOpacity onPress={() => handleSendOtp(otpChannel)}>
                                    <Text style={styles.resendText}>Resend Code</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.verifyButton, (otpLoading || otpCode.some(d => !d)) && styles.disabledButton]}
                            onPress={() => handleVerifyOtp(otpCode.join(''))}
                            disabled={otpLoading || otpCode.some(d => !d)}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#D4AF37', '#AA7C11']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                {otpLoading ? (
                                    <ActivityIndicator color="#060B1E" size="small" />
                                ) : (
                                    <View style={styles.btnContentRow}>
                                        <Ionicons name="checkmark-done-circle" size={18} color="#060B1E" style={{ marginRight: 6 }} />
                                        <Text style={styles.verifyButtonText}>Confirm & Continue</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Change Number or Channel */}
                        <TouchableOpacity
                            style={styles.cancelOtpButton}
                            onPress={() => setShowOtpModal(false)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelOtpText}>Change Number or Method</Text>
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
        backgroundColor: '#060B1E',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#060B1E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 14,
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
    },
    topAuraGold: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    topAuraEmerald: {
        position: 'absolute',
        top: -40,
        left: -80,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 32,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 420,
    },
    stepBadgeRow: {
        alignItems: 'center',
        marginBottom: 8,
    },
    stepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderColor: 'rgba(212, 175, 55, 0.35)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    stepBadgeText: {
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 6,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
    title: {
        fontSize: 21,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 5,
        lineHeight: 17,
        paddingHorizontal: 10,
    },
    card: {
        backgroundColor: '#0D1B2A',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.22)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    inputGroup: {
        marginBottom: 12,
    },
    microLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#94A3B8',
        marginBottom: 5,
        letterSpacing: 0.6,
    },
    required: {
        color: '#EF4444',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#060B1E',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 11,
        paddingHorizontal: 12,
        height: 44,
    },
    readOnlyBox: {
        backgroundColor: '#050914',
        borderColor: '#151D2A',
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    readOnlyText: {
        color: '#64748B',
    },
    countryPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
        borderRightWidth: 1,
        borderRightColor: '#1E293B',
        paddingRight: 8,
    },
    flag: {
        fontSize: 14,
        marginRight: 4,
    },
    countryCode: {
        color: '#D4AF37',
        fontSize: 13,
        fontWeight: '700',
    },
    switchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#060B1E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    switchLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 8,
        gap: 10,
    },
    whatsappIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(37, 211, 102, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchTitle: {
        color: '#FFFFFF',
        fontSize: 12.5,
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
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    actionContainer: {
        marginTop: 6,
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 10,
        elevation: 4,
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    buttonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 46,
    },
    btnContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.6)',
        backgroundColor: 'rgba(212, 175, 55, 0.06)',
        marginBottom: 12,
    },
    secondaryButtonText: {
        color: '#D4AF37',
        fontSize: 13,
        fontWeight: '700',
    },
    logoutButton: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    logoutText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    disabledButton: {
        opacity: 0.55,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    stateModalContent: {
        backgroundColor: '#0D1B2A',
        borderRadius: 20,
        padding: 16,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    modalCloseBtn: {
        padding: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#060B1E',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 10,
        height: 38,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13,
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
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
    },
    stateItemText: {
        color: '#CBD5E1',
        fontSize: 13.5,
    },
    selectedStateItemText: {
        color: '#D4AF37',
        fontWeight: '700',
    },
    otpModalCard: {
        backgroundColor: '#0D1B2A',
        borderRadius: 22,
        padding: 20,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    otpIconBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    otpIconBadgeWa: {
        backgroundColor: 'rgba(37, 211, 102, 0.12)',
        borderColor: 'rgba(37, 211, 102, 0.3)',
        borderWidth: 1,
    },
    otpIconBadgeSms: {
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderColor: 'rgba(212, 175, 55, 0.3)',
        borderWidth: 1,
    },
    otpTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    otpSubtitle: {
        fontSize: 11.5,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
        paddingHorizontal: 8,
    },
    otpHighlight: {
        color: '#D4AF37',
        fontWeight: '700',
    },
    openWhatsappPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(37, 211, 102, 0.12)',
        borderColor: 'rgba(37, 211, 102, 0.35)',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginTop: 10,
        marginBottom: 12,
    },
    openWhatsappText: {
        color: '#25D366',
        fontSize: 11.5,
        fontWeight: '700',
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginVertical: 12,
    },
    otpBox: {
        width: 42,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#060B1E',
        borderWidth: 1.5,
        borderColor: '#1E293B',
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
    },
    otpBoxFilled: {
        borderColor: '#D4AF37',
        backgroundColor: '#15243B',
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
        color: '#D4AF37',
        fontSize: 12,
        fontWeight: '700',
    },
    timerText: {
        color: '#64748B',
        fontSize: 11.5,
    },
    resendText: {
        color: '#25D366',
        fontSize: 12,
        fontWeight: '800',
    },
    verifyButton: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 10,
    },
    verifyButtonText: {
        color: '#060B1E',
        fontSize: 14,
        fontWeight: '800',
    },
    cancelOtpButton: {
        paddingVertical: 6,
    },
    cancelOtpText: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '500',
    },
});
