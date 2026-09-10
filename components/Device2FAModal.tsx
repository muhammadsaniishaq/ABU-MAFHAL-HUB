import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';

interface Device2FAModalProps {
    visible: boolean;
    userId: string;
    userEmail?: string;
    onVerified: () => void;
    onCancel: () => void;
}

const PIN_KEY = 'user_transaction_pin';

export default function Device2FAModal({
    visible,
    userId,
    userEmail,
    onVerified,
    onCancel,
}: Device2FAModalProps) {
    const [authMode, setAuthMode] = useState<'totp' | 'email' | 'pin'>('pin');
    const [hasTotp, setHasTotp] = useState(false);
    const [hasPin, setHasPin] = useState(false);
    const [savedPin, setSavedPin] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [displayEmail, setDisplayEmail] = useState(userEmail || '');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const inputRef = useRef<TextInput | null>(null);
    const generatedOtpRef = useRef<string | null>(null);

    const targetLength = authMode === 'pin' ? 4 : 6;

    // Reset and initialize when modal becomes visible
    useEffect(() => {
        if (visible && userId) {
            setCode('');
            setErrorMessage(null);
            setSuccessMessage(null);
            initSecurityMethods();
        }
    }, [visible, userId]);

    // Resend countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((c) => (c > 0 ? c - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const initSecurityMethods = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            // 1. Resolve User Email
            let activeEmail = userEmail || '';
            if (!activeEmail) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) {
                    activeEmail = user.email;
                    setDisplayEmail(user.email);
                }
            } else {
                setDisplayEmail(activeEmail);
            }

            // 2. Check Transaction PIN availability
            let existingPin: string | null = null;
            if (Platform.OS === 'web') {
                existingPin = await AsyncStorage.getItem(PIN_KEY);
            } else {
                existingPin = await SecureStore.getItemAsync(PIN_KEY);
            }

            if (!existingPin && userId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('transaction_pin')
                    .eq('id', userId)
                    .maybeSingle();
                if (profile?.transaction_pin) {
                    existingPin = String(profile.transaction_pin);
                    if (Platform.OS === 'web') {
                        await AsyncStorage.setItem(PIN_KEY, existingPin);
                    } else {
                        await SecureStore.setItemAsync(PIN_KEY, existingPin);
                    }
                }
            }

            const pinFound = !!existingPin;
            setHasPin(pinFound);
            setSavedPin(existingPin);

            // 3. Check Google Authenticator (TOTP)
            let totpFound = false;
            try {
                const { data: factors, error } = await supabase.auth.mfa.listFactors();
                const activeTotp = !error && factors?.totp?.find((f) => f.status === 'verified');
                if (activeTotp) {
                    totpFound = true;
                }
            } catch (_) {}
            setHasTotp(totpFound);

            // 4. Set Default Preferred Auth Mode
            // If user has TOTP, prioritize it; otherwise, PIN is fastest & most reliable; fallback to email.
            if (totpFound) {
                setAuthMode('totp');
            } else if (pinFound) {
                setAuthMode('pin');
            } else {
                setAuthMode('email');
                if (activeEmail) {
                    dispatchEmailOtp(activeEmail, false);
                }
            }
        } catch (e) {
            console.log('Error initializing device security methods:', e);
            setAuthMode('pin');
        } finally {
            setLoading(false);
        }
    };

    const maskEmail = (email: string) => {
        if (!email || !email.includes('@')) return 'your registered email';
        const [user, domain] = email.split('@');
        if (user.length <= 2) return `${user[0]}***@${domain}`;
        return `${user[0]}***${user[user.length - 1]}@${domain}`;
    };

    // Send or retrieve active Email OTP without overwriting if still valid
    const dispatchEmailOtp = async (targetEmail: string, isForceResend: boolean = false) => {
        if (!targetEmail || emailSending) return;

        // If not a forced resend, check if an unexpired OTP is already stored in AsyncStorage
        if (!isForceResend) {
            try {
                const existingRaw = await AsyncStorage.getItem(`@device_otp_${userId}`);
                if (existingRaw) {
                    const parsed = JSON.parse(existingRaw);
                    if (parsed?.code && Date.now() < parsed.expiresAt) {
                        generatedOtpRef.current = parsed.code;
                        return; // Keep existing active code! Do NOT overwrite!
                    }
                }
            } catch (_) {}
        }

        setEmailSending(true);
        setErrorMessage(null);

        try {
            // Generate a fresh 6-digit random code
            const freshCode = Math.floor(100000 + Math.random() * 900000).toString();
            generatedOtpRef.current = freshCode;

            const otpPayload = {
                code: freshCode,
                expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes validity
            };
            await AsyncStorage.setItem(`@device_otp_${userId}`, JSON.stringify(otpPayload));

            const htmlMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #070D1E; color: #FFFFFF; border-radius: 12px; border: 1px solid #F5A623;">
                    <h2 style="color: #F5A623; margin-bottom: 8px;">Abu Mafhal Hub 🛡️</h2>
                    <h3 style="color: #FFFFFF; margin-top: 0;">New Device Authorization Code</h3>
                    <p style="color: #CBD5E1; font-size: 14px; line-height: 1.5;">
                        A request was made to authorize transfers on a new device. Use the verification code below to confirm this is you:
                    </p>
                    <div style="background: #0D1B3E; border: 1.5px solid #F5A623; padding: 18px; border-radius: 10px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #FFD700;">${freshCode}</span>
                    </div>
                    <p style="color: #94A3B8; font-size: 12px;">This code is valid for 15 minutes. If you did not make this request, please change your password immediately.</p>
                </div>
            `;

            try {
                await supabase.functions.invoke('send-email', {
                    body: {
                        to: targetEmail,
                        subject: 'New Device Authorization Code - Abu Mafhal Hub',
                        html: htmlMessage,
                        text: `Your Abu Mafhal new device verification code is ${freshCode}. Valid for 15 minutes.`,
                    },
                });
            } catch (invokeErr) {
                console.log('send-email invoke notice:', invokeErr);
            }

            setCountdown(60);
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err: any) {
            setErrorMessage('Unable to dispatch email code. You can also verify using your Transaction PIN.');
        } finally {
            setEmailSending(false);
        }
    };

    const handleCodeChange = (text: string) => {
        setErrorMessage(null);
        const numeric = text.replace(/[^0-9]/g, '').slice(0, targetLength);
        setCode(numeric);

        // Auto verify when length is met
        if (numeric.length === targetLength) {
            verifySubmission(numeric);
        }
    };

    const handlePaste = async () => {
        setErrorMessage(null);
        try {
            let text = '';
            if (Platform.OS === 'web') {
                text = await navigator.clipboard.readText();
            } else {
                text = await Clipboard.getStringAsync();
            }
            const numeric = text.replace(/[^0-9]/g, '').slice(0, targetLength);
            if (numeric.length > 0) {
                setCode(numeric);
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                if (numeric.length === targetLength) {
                    verifySubmission(numeric);
                }
            } else {
                setErrorMessage('No valid digits found in clipboard.');
            }
        } catch (e) {
            console.log('Paste error:', e);
        }
    };

    const handleTabSwitch = (mode: 'totp' | 'email' | 'pin') => {
        setAuthMode(mode);
        setCode('');
        setErrorMessage(null);
        setSuccessMessage(null);
        if (mode === 'email' && displayEmail && countdown === 0) {
            dispatchEmailOtp(displayEmail, false);
        }
    };

    const verifySubmission = async (inputCode: string) => {
        if (!inputCode || inputCode.length !== targetLength || loading) return;

        setLoading(true);
        setErrorMessage(null);

        try {
            if (authMode === 'pin') {
                // 1. Verify Transaction PIN
                let currentPin = savedPin;
                if (!currentPin) {
                    // Try to re-fetch from storage or DB
                    if (Platform.OS === 'web') {
                        currentPin = await AsyncStorage.getItem(PIN_KEY);
                    } else {
                        currentPin = await SecureStore.getItemAsync(PIN_KEY);
                    }
                    if (!currentPin && userId) {
                        const { data: p } = await supabase
                            .from('profiles')
                            .select('transaction_pin')
                            .eq('id', userId)
                            .maybeSingle();
                        if (p?.transaction_pin) {
                            currentPin = String(p.transaction_pin);
                        }
                    }
                }

                if (!currentPin) {
                    throw new Error('No Transaction PIN found on your account. Please select Email Code or Authenticator.');
                }

                if (currentPin.trim() !== inputCode.trim()) {
                    throw new Error('Incorrect Transaction PIN. Please try again.');
                }
            } else if (authMode === 'totp') {
                // 2. Verify Google Authenticator 2FA TOTP code
                const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
                if (listError) throw listError;

                const activeFactor = factors?.totp?.find((f) => f.status === 'verified');
                if (!activeFactor) {
                    throw new Error('No active Google Authenticator enrolled. Please verify with Email Code or Transaction PIN.');
                }

                const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
                    factorId: activeFactor.id,
                });
                if (challengeErr) throw challengeErr;

                const { error: verifyErr } = await supabase.auth.mfa.verify({
                    factorId: activeFactor.id,
                    challengeId: challengeData.id,
                    code: inputCode,
                });
                if (verifyErr) {
                    throw new Error(verifyErr.message || 'Invalid 6-digit Authenticator code. Check your app and try again.');
                }
            } else {
                // 3. Verify Email OTP
                const storedRaw = await AsyncStorage.getItem(`@device_otp_${userId}`);
                let isValid = false;

                if (storedRaw) {
                    const stored = JSON.parse(storedRaw);
                    if (stored.code && String(stored.code).trim() === inputCode.trim() && Date.now() < stored.expiresAt) {
                        isValid = true;
                        await AsyncStorage.removeItem(`@device_otp_${userId}`);
                    }
                }

                if (!isValid && generatedOtpRef.current && generatedOtpRef.current === inputCode.trim()) {
                    isValid = true;
                }

                if (!isValid) {
                    throw new Error('Invalid or expired 6-digit code. Check your inbox or tap Resend.');
                }
            }

            // ✅ Verification Successful! Mark device verified for this user
            const deviceKey = `@device_transfer_verified_${userId}`;
            await AsyncStorage.setItem(deviceKey, 'true');
            if (Platform.OS !== 'web') {
                await SecureStore.setItemAsync(deviceKey, 'true').catch(() => {});
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setSuccessMessage('Device Authorized Successfully! 🛡️');

            setTimeout(() => {
                onVerified();
            }, 600);

        } catch (err: any) {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            setErrorMessage(err.message || 'Verification failed. Please check the code and try again.');
            setCode('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={s.backdrop}>
                <View style={s.card}>
                    {/* Header Emblem */}
                    <View style={s.emblemWrapper}>
                        <LinearGradient
                            colors={['#070D1E', '#0D1B3E', '#162447']}
                            style={s.emblemGradient}
                        >
                            <Ionicons name="shield-checkmark" size={28} color="#FFD700" />
                        </LinearGradient>
                    </View>

                    {/* Title */}
                    <Text style={s.title}>New Device Authorization</Text>
                    <Text style={s.subtitle}>
                        For account security, transfers from an unverified device require quick identity confirmation.
                    </Text>

                    {/* Mode Selector Tabs */}
                    <View style={s.tabRow}>
                        {hasPin && (
                            <TouchableOpacity
                                style={[s.tabBtn, authMode === 'pin' && s.tabBtnActive]}
                                onPress={() => handleTabSwitch('pin')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="keypad-outline"
                                    size={13}
                                    color={authMode === 'pin' ? '#FFD700' : '#64748B'}
                                />
                                <Text style={[s.tabText, authMode === 'pin' && s.tabTextActive]}>
                                    PIN
                                </Text>
                            </TouchableOpacity>
                        )}

                        {hasTotp && (
                            <TouchableOpacity
                                style={[s.tabBtn, authMode === 'totp' && s.tabBtnActive]}
                                onPress={() => handleTabSwitch('totp')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="phone-portrait-outline"
                                    size={13}
                                    color={authMode === 'totp' ? '#FFD700' : '#64748B'}
                                />
                                <Text style={[s.tabText, authMode === 'totp' && s.tabTextActive]}>
                                    Authenticator
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[s.tabBtn, authMode === 'email' && s.tabBtnActive]}
                            onPress={() => handleTabSwitch('email')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="mail-outline"
                                size={13}
                                color={authMode === 'email' ? '#FFD700' : '#64748B'}
                            />
                            <Text style={[s.tabText, authMode === 'email' && s.tabTextActive]}>
                                Email Code
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* On-screen Error Banner */}
                    {errorMessage && (
                        <View style={s.errorBanner}>
                            <Ionicons name="alert-circle" size={15} color="#E11D48" style={{ marginRight: 6 }} />
                            <Text style={s.errorBannerText}>{errorMessage}</Text>
                        </View>
                    )}

                    {/* On-screen Success Banner */}
                    {successMessage && (
                        <View style={s.successBanner}>
                            <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
                            <Text style={s.successBannerText}>{successMessage}</Text>
                        </View>
                    )}

                    {/* Instructions Text */}
                    <View style={s.instructionBox}>
                        <Ionicons
                            name={authMode === 'pin' ? 'lock-closed-outline' : authMode === 'totp' ? 'key-outline' : 'mail-unread-outline'}
                            size={14}
                            color="#D97706"
                            style={{ marginRight: 6 }}
                        />
                        <Text style={s.instructionText}>
                            {authMode === 'pin'
                                ? 'Enter your 4-digit secret Transaction PIN to authorize this device.'
                                : authMode === 'totp'
                                ? 'Enter the 6-digit dynamic code from Google Authenticator.'
                                : `Enter the 6-digit code sent to ${maskEmail(displayEmail)}.`}
                        </Text>
                    </View>

                    {/* Visual Digit Boxes Row with Direct Tap Overlay Input */}
                    <View style={s.inputWrapper}>
                        <View style={s.boxesContainer}>
                            {Array.from({ length: targetLength }).map((_, idx) => {
                                const char = code[idx] || '';
                                const isCurrent = idx === code.length;
                                return (
                                    <View
                                        key={idx}
                                        style={[
                                            s.box,
                                            char ? s.boxFilled : null,
                                            isCurrent && !char ? s.boxCurrent : null,
                                        ]}
                                    >
                                        <Text style={s.boxDigit}>
                                            {authMode === 'pin' ? (char ? '•' : '') : char}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Single TextInput that safely captures all taps and keystrokes */}
                        <TextInput
                            ref={inputRef}
                            style={s.overlayInput}
                            value={code}
                            onChangeText={handleCodeChange}
                            keyboardType="number-pad"
                            maxLength={targetLength}
                            autoFocus
                            editable={!loading}
                            caretHidden
                        />
                    </View>

                    {/* Paste Code Button */}
                    <TouchableOpacity
                        onPress={handlePaste}
                        style={s.pasteBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="clipboard-outline" size={13} color="#D97706" style={{ marginRight: 4 }} />
                        <Text style={s.pasteBtnText}>Paste Code 📋</Text>
                    </TouchableOpacity>

                    {/* Email Resend Timer Row */}
                    {authMode === 'email' && (
                        <View style={s.resendContainer}>
                            {countdown > 0 ? (
                                <Text style={s.resendCountdown}>Resend code in {countdown}s</Text>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => displayEmail && dispatchEmailOtp(displayEmail, true)}
                                    disabled={emailSending}
                                    style={s.resendButton}
                                >
                                    {emailSending ? (
                                        <ActivityIndicator size="small" color="#D97706" />
                                    ) : (
                                        <Text style={s.resendButtonText}>Resend Verification Code ✉️</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={s.actionRow}>
                        <TouchableOpacity
                            style={s.cancelBtn}
                            onPress={onCancel}
                            disabled={loading}
                            activeOpacity={0.7}
                        >
                            <Text style={s.cancelBtnText}>Back</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                s.verifyBtn,
                                code.length !== targetLength && s.verifyBtnDisabled,
                            ]}
                            onPress={() => verifySubmission(code)}
                            disabled={code.length !== targetLength || loading}
                            activeOpacity={0.88}
                        >
                            <LinearGradient
                                colors={code.length === targetLength ? ['#D97706', '#F5A623', '#D97706'] : ['#CBD5E1', '#CBD5E1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.verifyGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#070D1E" size="small" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="shield-checkmark"
                                            size={15}
                                            color={code.length === targetLength ? '#070D1E' : '#64748B'}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text
                                            style={[
                                                s.verifyBtnText,
                                                code.length !== targetLength && s.verifyBtnTextDisabled,
                                            ]}
                                        >
                                            AUTHORIZE DEVICE
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 13, 30, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        padding: 22,
        alignItems: 'center',
        shadowColor: '#070D1E',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 12,
    },
    emblemWrapper: {
        marginBottom: 12,
    },
    emblemGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F5A623',
        shadowColor: '#F5A623',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        color: '#070D1E',
        textAlign: 'center',
        letterSpacing: -0.2,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 15.5,
        marginBottom: 14,
        paddingHorizontal: 8,
    },
    tabRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 14,
        width: '100%',
        justifyContent: 'center',
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    tabBtnActive: {
        backgroundColor: '#0D1B3E',
        borderColor: '#F5A623',
    },
    tabText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#FFD700',
        fontWeight: '900',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF1F2',
        borderWidth: 1,
        borderColor: '#FECDD3',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 12,
        width: '100%',
    },
    errorBannerText: {
        flex: 1,
        fontSize: 10.5,
        color: '#BE123C',
        fontWeight: '700',
        lineHeight: 14,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 12,
        width: '100%',
    },
    successBannerText: {
        flex: 1,
        fontSize: 11,
        color: '#047857',
        fontWeight: '800',
        lineHeight: 14,
    },
    instructionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginBottom: 14,
        width: '100%',
    },
    instructionText: {
        flex: 1,
        fontSize: 10.5,
        color: '#92400E',
        fontWeight: '600',
        lineHeight: 14.5,
    },
    boxesContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10,
        width: '100%',
    },
    box: {
        width: 44,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    boxFilled: {
        borderColor: '#0D1B3E',
        backgroundColor: '#FFFFFF',
    },
    boxCurrent: {
        borderColor: '#F5A623',
        backgroundColor: '#FFFBEB',
    },
    boxDigit: {
        fontSize: 20,
        fontWeight: '900',
        color: '#070D1E',
    },
    inputWrapper: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    overlayInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.01,
        fontSize: 1,
        color: 'transparent',
    },
    pasteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 12,
    },
    pasteBtnText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#B45309',
    },
    resendContainer: {
        marginBottom: 14,
    },
    resendCountdown: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
    },
    resendButton: {
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    resendButtonText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#D97706',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginTop: 6,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
    },
    verifyBtn: {
        flex: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    verifyBtnDisabled: {
        opacity: 0.6,
    },
    verifyGradient: {
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifyBtnText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#070D1E',
        letterSpacing: 0.5,
    },
    verifyBtnTextDisabled: {
        color: '#64748B',
    },
});
