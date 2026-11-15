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
        const prefix = cleaned.slice(0, 4);
        const validPrefixes = [
            '0802', '0803', '0804', '0805', '0806', '0807', '0808', '0809',
            '0810', '0811', '0812', '0813', '0814', '0815', '0816', '0817', '0818', '0819',
            '0909', '0908', '0901', '0902', '0903', '0904', '0905', '0906', '0907',
            '0701', '0702', '0703', '0704', '0705', '0706', '0707', '0708', '0709',
            '0912', '0913', '0915', '0916', '0911'
        ];
        if (validPrefixes.includes(prefix)) {
            return { isValid: true, formatted: cleaned };
        }
        return { isValid: true, formatted: cleaned }; // Allow valid 11 digit standard
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

    // Initial Loading & Action states
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // OTP Verification Modal State
    const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
    const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
    const [otpCode, setOtpCode] = useState<string[]>(new Array(6).fill(''));
    const [otpLoading, setOtpLoading] = useState<boolean>(false);
    const [otpCountdown, setOtpCountdown] = useState<number>(60);
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

    const toggleSameAsPhone = () => {
        const nextVal = !sameAsPhone;
        setSameAsPhone(nextVal);
        if (nextVal) {
            setWhatsappNumber(phone);
        }
    };

    // Trigger OTP sending
    const handleSendOtp = async (channel: 'whatsapp' | 'sms') => {
        // Validate inputs
        if (!fullName.trim() || fullName.trim().length < 3) {
            Alert.alert('Required', 'Please enter your genuine full name.');
            return;
        }

        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3) {
            Alert.alert('Required', 'Please choose a valid username (min 3 characters).');
            return;
        }

        const phoneVal = validateNigerianPhone(phone);
        if (!phoneVal.isValid) {
            Alert.alert('Invalid Phone', phoneVal.error || 'Please enter a valid 11-digit Nigerian phone number.');
            return;
        }

        const effectiveWhatsapp = sameAsPhone ? phone : whatsappNumber;
        const waVal = validateNigerianPhone(effectiveWhatsapp);
        if (!waVal.isValid) {
            Alert.alert('Invalid WhatsApp Number', 'Please enter a valid 11-digit WhatsApp phone number.');
            return;
        }

        const targetIdentifier = channel === 'whatsapp' ? effectiveWhatsapp : phone;

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

    const handlePasteOtp = async () => {
        try {
            const clip = await Clipboard.getStringAsync();
            const cleaned = (clip || '').replace(/\D/g, '').slice(0, 6);
            if (cleaned.length === 6) {
                setOtpCode(cleaned.split(''));
                handleVerifyOtp(cleaned);
            }
        } catch (_) {}
    };

    const handleVerifyOtp = async (codeToVerify: string) => {
        if (!codeToVerify || codeToVerify.length !== 6 || otpLoading) return;

        setOtpLoading(true);
        const targetIdentifier = otpChannel === 'whatsapp' ? (sameAsPhone ? phone : whatsappNumber) : phone;

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
            const effectiveWhatsapp = sameAsPhone ? phone : whatsappNumber;
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

            const successMsg = 'Profile completed & verified successfully! Please set your 4-digit transaction PIN to protect your account.';
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#D4AF37', '#AA7C11']}
                            style={styles.logoBadge}
                        >
                            <FontAwesome5 name="user-check" size={26} color="#0A192F" />
                        </LinearGradient>
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>
                            Set your verified phone number and WhatsApp to enable high-speed transactions, instant alerts, and secure wallet transfers.
                        </Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.card}>
                        {/* Email (Read Only) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={[styles.inputBox, styles.readOnlyBox]}>
                                <Ionicons name="mail" size={18} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.readOnlyText]}
                                    value={userEmail}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={16} color="#64748B" />
                            </View>
                        </View>

                        {/* Full Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="person-outline" size={18} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Muhammad Sani"
                                    placeholderTextColor="#64748B"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        {/* Username */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Username <Text style={styles.required}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="at" size={18} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. sani_hub"
                                    placeholderTextColor="#64748B"
                                    value={username}
                                    onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Phone Number */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number <Text style={styles.required}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <View style={styles.countryPrefix}>
                                    <Text style={styles.flag}>🇳🇬</Text>
                                    <Text style={styles.countryCode}>+234</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="08012345678"
                                    placeholderTextColor="#64748B"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                />
                            </View>
                            <Text style={styles.helperText}>Enter 11-digit phone number used for SMS & calls.</Text>
                        </View>

                        {/* WhatsApp Toggle */}
                        <TouchableOpacity
                            style={styles.toggleRow}
                            onPress={toggleSameAsPhone}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={sameAsPhone ? "checkbox" : "square-outline"}
                                size={22}
                                color="#D4AF37"
                            />
                            <Text style={styles.toggleText}>Use this phone number for WhatsApp</Text>
                        </TouchableOpacity>

                        {/* WhatsApp Number (if different) */}
                        {!sameAsPhone && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>WhatsApp Number <Text style={styles.required}>*</Text></Text>
                                <View style={styles.inputBox}>
                                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="08012345678"
                                        placeholderTextColor="#64748B"
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
                            <Text style={styles.label}>State of Residence</Text>
                            <TouchableOpacity
                                style={[styles.inputBox, styles.selectBox]}
                                onPress={() => setShowStateModal(true)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="location-outline" size={18} color="#D4AF37" style={styles.inputIcon} />
                                <Text style={styles.selectText}>{selectedState}</Text>
                                <Ionicons name="chevron-down" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, submitting && styles.disabledButton]}
                                onPress={() => handleSendOtp('whatsapp')}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#25D366', '#128C7E']}
                                    style={styles.buttonGradient}
                                >
                                    {submitting && otpChannel === 'whatsapp' ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.primaryButtonText}>Verify via WhatsApp (Instant)</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => handleSendOtp('sms')}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#D4AF37" style={{ marginRight: 8 }} />
                                <Text style={styles.secondaryButtonText}>Verify via SMS Code</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={handleSignOut}
                        >
                            <Text style={styles.logoutText}>Switch Account or Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* State Picker Modal */}
            <Modal
                visible={showStateModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowStateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.stateModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Your State</Text>
                            <TouchableOpacity onPress={() => setShowStateModal(false)}>
                                <Ionicons name="close" size={24} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {NIGERIAN_STATES.map((st) => (
                                <TouchableOpacity
                                    key={st}
                                    style={[styles.stateItem, selectedState === st && styles.selectedStateItem]}
                                    onPress={() => {
                                        setSelectedState(st);
                                        setShowStateModal(false);
                                    }}
                                >
                                    <Text style={[styles.stateItemText, selectedState === st && styles.selectedStateItemText]}>
                                        {st}
                                    </Text>
                                    {selectedState === st && (
                                        <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* OTP Verification Modal */}
            <Modal
                visible={showOtpModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowOtpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.otpModalCard}>
                        <View style={styles.otpHeader}>
                            <View style={styles.otpIconBadge}>
                                <Ionicons
                                    name={otpChannel === 'whatsapp' ? "logo-whatsapp" : "chatbubble-ellipses"}
                                    size={28}
                                    color={otpChannel === 'whatsapp' ? "#25D366" : "#D4AF37"}
                                />
                            </View>
                            <Text style={styles.otpTitle}>Enter 6-Digit Code</Text>
                            <Text style={styles.otpSubtitle}>
                                Code sent to {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} on{' '}
                                <Text style={{ color: '#D4AF37', fontWeight: '700' }}>
                                    {otpChannel === 'whatsapp' ? (sameAsPhone ? phone : whatsappNumber) : phone}
                                </Text>
                            </Text>
                        </View>

                        {/* OTP Boxes */}
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
                                    textAlign="center"
                                />
                            ))}
                        </View>

                        <View style={styles.otpHelperRow}>
                            <TouchableOpacity onPress={handlePasteOtp}>
                                <Text style={styles.pasteText}>📋 Paste Code</Text>
                            </TouchableOpacity>

                            {otpCountdown > 0 ? (
                                <Text style={styles.timerText}>Resend in {otpCountdown}s</Text>
                            ) : (
                                <TouchableOpacity onPress={() => handleSendOtp(otpChannel)}>
                                    <Text style={styles.resendText}>Resend OTP</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.verifyButton, (otpLoading || otpCode.some(d => !d)) && styles.disabledButton]}
                            onPress={() => handleVerifyOtp(otpCode.join(''))}
                            disabled={otpLoading || otpCode.some(d => !d)}
                        >
                            <LinearGradient
                                colors={['#D4AF37', '#AA7C11']}
                                style={styles.buttonGradient}
                            >
                                {otpLoading ? (
                                    <ActivityIndicator color="#0A192F" size="small" />
                                ) : (
                                    <Text style={styles.verifyButtonText}>Confirm & Continue</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelOtpButton}
                            onPress={() => setShowOtpModal(false)}
                        >
                            <Text style={styles.cancelOtpText}>Change Number or Channel</Text>
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
        backgroundColor: '#0A192F',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0A192F',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 14,
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '500',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 24,
    },
    logoBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        elevation: 6,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 19,
        paddingHorizontal: 12,
    },
    card: {
        backgroundColor: '#112240',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#CBD5E1',
        marginBottom: 6,
    },
    required: {
        color: '#EF4444',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A192F',
        borderWidth: 1,
        borderColor: '#233554',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
    },
    readOnlyBox: {
        backgroundColor: '#081220',
        borderColor: '#1e293b',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
    },
    readOnlyText: {
        color: '#64748B',
    },
    countryPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
        borderRightWidth: 1,
        borderRightColor: '#233554',
        paddingRight: 8,
    },
    flag: {
        fontSize: 16,
        marginRight: 4,
    },
    countryCode: {
        color: '#D4AF37',
        fontSize: 14,
        fontWeight: '700',
    },
    helperText: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 5,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
        paddingVertical: 4,
    },
    toggleText: {
        color: '#E2E8F0',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 10,
    },
    selectBox: {
        justifyContent: 'space-between',
    },
    selectText: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
    },
    actionContainer: {
        marginTop: 10,
    },
    primaryButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
        elevation: 4,
    },
    buttonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 52,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        marginBottom: 16,
    },
    secondaryButtonText: {
        color: '#D4AF37',
        fontSize: 14,
        fontWeight: '700',
    },
    logoutButton: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    logoutText: {
        color: '#94A3B8',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    disabledButton: {
        opacity: 0.6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    stateModalContent: {
        backgroundColor: '#112240',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: '#233554',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#233554',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    stateItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1A2E4C',
    },
    selectedStateItem: {
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderRadius: 8,
    },
    stateItemText: {
        color: '#E2E8F0',
        fontSize: 15,
    },
    selectedStateItemText: {
        color: '#D4AF37',
        fontWeight: '700',
    },
    otpModalCard: {
        backgroundColor: '#112240',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        alignItems: 'center',
    },
    otpHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    otpIconBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    otpTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    otpSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    otpBox: {
        width: 44,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#0A192F',
        borderWidth: 1.5,
        borderColor: '#233554',
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
    },
    otpBoxFilled: {
        borderColor: '#D4AF37',
        backgroundColor: '#152C4E',
    },
    otpHelperRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    pasteText: {
        color: '#D4AF37',
        fontSize: 13,
        fontWeight: '600',
    },
    timerText: {
        color: '#64748B',
        fontSize: 13,
    },
    resendText: {
        color: '#25D366',
        fontSize: 13,
        fontWeight: '700',
    },
    verifyButton: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
    },
    verifyButtonText: {
        color: '#0A192F',
        fontSize: 15,
        fontWeight: '800',
    },
    cancelOtpButton: {
        paddingVertical: 8,
    },
    cancelOtpText: {
        color: '#94A3B8',
        fontSize: 13,
    },
});
