import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';

interface Device2FAModalProps {
    visible: boolean;
    userId: string;
    userEmail?: string;
    onVerified: () => void;
    onCancel: () => void;
}

export default function Device2FAModal({
    visible,
    userId,
    userEmail,
    onVerified,
    onCancel,
}: Device2FAModalProps) {
    const [authMode, setAuthMode] = useState<'totp' | 'email'>('totp');
    const [hasTotp, setHasTotp] = useState(false);
    const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
    const [digits, setDigits] = useState<string[]>(new Array(6).fill(''));
    const [loading, setLoading] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [displayEmail, setDisplayEmail] = useState(userEmail || '');
    const [initChecked, setInitChecked] = useState(false);

    const inputRefs = useRef<Array<TextInput | null>>([]);
    const generatedOtpRef = useRef<string | null>(null);

    // Check available MFA factors on open
    useEffect(() => {
        if (visible && userId) {
            setDigits(new Array(6).fill(''));
            detectFactors();
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

    const detectFactors = async () => {
        setLoading(true);
        try {
            // 1. Fetch user email if missing
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

            // 2. Check if user has Google Authenticator (TOTP)
            const { data: factors, error } = await supabase.auth.mfa.listFactors();
            const activeTotp = !error && factors?.totp?.find((f) => f.status === 'verified');

            if (activeTotp) {
                setHasTotp(true);
                setTotpFactorId(activeTotp.id);
                setAuthMode('totp');
            } else {
                setHasTotp(false);
                setTotpFactorId(null);
                setAuthMode('email');
                // Automatically dispatch email code on initial load if email mode
                if (activeEmail) {
                    sendEmailOtp(activeEmail);
                }
            }
        } catch (e) {
            console.log('Error detecting factors:', e);
            setAuthMode('email');
            if (displayEmail) sendEmailOtp(displayEmail);
        } finally {
            setLoading(false);
            setInitChecked(true);
        }
    };

    const maskEmail = (email: string) => {
        if (!email || !email.includes('@')) return 'your registered email';
        const [user, domain] = email.split('@');
        if (user.length <= 2) return `${user[0]}***@${domain}`;
        return `${user[0]}***${user[user.length - 1]}@${domain}`;
    };

    const sendEmailOtp = async (targetEmail: string) => {
        if (!targetEmail || emailSending || countdown > 0) return;
        setEmailSending(true);
        try {
            // Generate a 6-digit random code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            generatedOtpRef.current = code;

            const otpPayload = {
                code,
                expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
            };
            await AsyncStorage.setItem(`@device_otp_${userId}`, JSON.stringify(otpPayload));

            // Send email via edge function
            const htmlMessage = `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0B0F19; color: #FFFFFF; border-radius: 12px; border: 1px solid #1E293B;">
                    <h2 style="color: #F59E0B; margin-bottom: 8px;">Abu Mafhal Hub 🛡️</h2>
                    <h3 style="color: #FFFFFF; margin-top: 0;">New Device Authorization Code</h3>
                    <p style="color: #94A3B8; font-size: 14px; line-height: 1.5;">
                        A request was made to authorize transfers on a new device. Use the verification code below to confirm this is you:
                    </p>
                    <div style="background: #111827; border: 1px solid #D97706; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #F59E0B;">${code}</span>
                    </div>
                    <p style="color: #64748B; font-size: 12px;">This code will expire in 10 minutes. If you did not make this request, please change your password immediately.</p>
                </div>
            `;

            try {
                await supabase.functions.invoke('send-email', {
                    body: {
                        to: targetEmail,
                        subject: 'New Device Authorization Code - Abu Mafhal Hub',
                        html: htmlMessage,
                        text: `Your Abu Mafhal new device verification code is ${code}. Valid for 10 minutes.`,
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
            Alert.alert('Notice', 'Unable to send email code. Please check your network and try again.');
        } finally {
            setEmailSending(false);
        }
    };

    const handleDigitChange = (text: string, index: number) => {
        const numeric = text.replace(/[^0-9]/g, '');

        // Handle pasting 6 digits
        if (numeric.length >= 6) {
            const pasted = numeric.slice(0, 6).split('');
            setDigits(pasted);
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            inputRefs.current[5]?.blur();
            verifyCode(pasted.join(''));
            return;
        }

        const value = numeric.slice(-1);
        const newDigits = [...digits];
        newDigits[index] = value;
        setDigits(newDigits);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (newDigits.every((d) => d !== '') && newDigits.join('').length === 6) {
            inputRefs.current[index]?.blur();
            verifyCode(newDigits.join(''));
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const verifyCode = async (enteredCode: string) => {
        if (enteredCode.length !== 6 || loading) return;
        setLoading(true);

        try {
            if (authMode === 'totp') {
                // Verify Google Authenticator 2FA TOTP code
                if (!totpFactorId) {
                    throw new Error('Google Authenticator factor not found.');
                }

                const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
                    factorId: totpFactorId,
                });
                if (challengeErr) throw challengeErr;

                const { error: verifyErr } = await supabase.auth.mfa.verify({
                    factorId: totpFactorId,
                    challengeId: challengeData.id,
                    code: enteredCode,
                });
                if (verifyErr) throw verifyErr;
            } else {
                // Verify Email OTP
                const storedRaw = await AsyncStorage.getItem(`@device_otp_${userId}`);
                let isValid = false;

                if (storedRaw) {
                    const stored = JSON.parse(storedRaw);
                    if (stored.code === enteredCode && Date.now() < stored.expiresAt) {
                        isValid = true;
                        await AsyncStorage.removeItem(`@device_otp_${userId}`);
                    }
                } else if (generatedOtpRef.current && generatedOtpRef.current === enteredCode) {
                    isValid = true;
                }

                if (!isValid) {
                    throw new Error('Invalid or expired 6-digit code. Please verify and try again.');
                }
            }

            // ✅ Success: Mark this device as verified for this user
            const deviceKey = `@device_transfer_verified_${userId}`;
            await AsyncStorage.setItem(deviceKey, 'true');
            if (Platform.OS !== 'web') {
                await SecureStore.setItemAsync(deviceKey, 'true').catch(() => {});
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                'Device Authorized 🛡️',
                'Your device has been verified successfully. Transfers are now unlocked on this device.',
                [{ text: 'Continue', onPress: onVerified }]
            );
        } catch (err: any) {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            Alert.alert('Verification Failed ❌', err.message || 'Incorrect verification code. Please try again.');
            setDigits(new Array(6).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={s.backdrop}>
                <View style={s.card}>
                    {/* Header Icon */}
                    <View style={s.iconWrapper}>
                        <LinearGradient colors={['#D97706', '#92400E']} style={s.iconGradient}>
                            <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
                        </LinearGradient>
                    </View>

                    {/* Title & Subtitle */}
                    <Text style={s.title}>New Device Verification</Text>
                    <Text style={s.subtitle}>
                        For your account security, transfers from a new device require Two-Factor Authentication (2FA).
                    </Text>

                    {/* Mode Tabs if TOTP is available */}
                    {hasTotp && (
                        <View style={s.tabRow}>
                            <TouchableOpacity
                                style={[s.tabBtn, authMode === 'totp' && s.tabBtnActive]}
                                onPress={() => {
                                    setAuthMode('totp');
                                    setDigits(new Array(6).fill(''));
                                }}
                            >
                                <Ionicons
                                    name="phone-portrait-outline"
                                    size={14}
                                    color={authMode === 'totp' ? '#FFFFFF' : '#94A3B8'}
                                />
                                <Text style={[s.tabText, authMode === 'totp' && s.tabTextActive]}>
                                    Authenticator
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[s.tabBtn, authMode === 'email' && s.tabBtnActive]}
                                onPress={() => {
                                    setAuthMode('email');
                                    setDigits(new Array(6).fill(''));
                                    if (displayEmail && countdown === 0) sendEmailOtp(displayEmail);
                                }}
                            >
                                <Ionicons
                                    name="mail-outline"
                                    size={14}
                                    color={authMode === 'email' ? '#FFFFFF' : '#94A3B8'}
                                />
                                <Text style={[s.tabText, authMode === 'email' && s.tabTextActive]}>
                                    Email Code
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Instructions */}
                    <View style={s.instructionBox}>
                        <Ionicons
                            name={authMode === 'totp' ? 'key-outline' : 'mail-unread-outline'}
                            size={16}
                            color="#F59E0B"
                            style={{ marginRight: 6 }}
                        />
                        <Text style={s.instructionText}>
                            {authMode === 'totp'
                                ? 'Enter the 6-digit code generated in your Google Authenticator app.'
                                : `Enter the 6-digit code sent to ${maskEmail(displayEmail)}.`}
                        </Text>
                    </View>

                    {/* 6 Digit Input Boxes */}
                    <View style={s.otpRow}>
                        {digits.map((digit, idx) => (
                            <TextInput
                                key={idx}
                                ref={(ref) => { inputRefs.current[idx] = ref; }}
                                style={[
                                    s.otpBox,
                                    digit ? s.otpBoxFilled : null,
                                ]}
                                value={digit}
                                onChangeText={(val) => handleDigitChange(val, idx)}
                                onKeyPress={(e) => handleKeyPress(e, idx)}
                                keyboardType="number-pad"
                                maxLength={idx === 0 ? 6 : 1}
                                selectTextOnFocus
                                autoFocus={idx === 0}
                                editable={!loading}
                            />
                        ))}
                    </View>

                    {/* Resend for Email Mode */}
                    {authMode === 'email' && (
                        <View style={s.resendRow}>
                            {countdown > 0 ? (
                                <Text style={s.countdownText}>Resend code in {countdown}s</Text>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => displayEmail && sendEmailOtp(displayEmail)}
                                    disabled={emailSending}
                                    style={s.resendBtn}
                                >
                                    {emailSending ? (
                                        <ActivityIndicator size="small" color="#F59E0B" />
                                    ) : (
                                        <Text style={s.resendText}>Resend Verification Code</Text>
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
                                digits.some((d) => !d) && s.verifyBtnDisabled,
                            ]}
                            onPress={() => verifyCode(digits.join(''))}
                            disabled={digits.some((d) => !d) || loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={s.verifyBtnText}>Authorize Device</Text>
                                </>
                            )}
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
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    iconWrapper: {
        marginBottom: 14,
    },
    iconGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
    },
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#020617',
        borderRadius: 10,
        padding: 4,
        gap: 6,
        width: '100%',
        marginBottom: 14,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    tabBtnActive: {
        backgroundColor: '#D97706',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    instructionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 119, 6, 0.1)',
        borderColor: 'rgba(217, 119, 6, 0.3)',
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        width: '100%',
        marginBottom: 20,
    },
    instructionText: {
        flex: 1,
        fontSize: 12,
        color: '#FDE68A',
        lineHeight: 16,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        marginBottom: 16,
    },
    otpBox: {
        width: 44,
        height: 52,
        backgroundColor: '#020617',
        borderWidth: 1.5,
        borderColor: '#334155',
        borderRadius: 10,
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
    },
    otpBoxFilled: {
        borderColor: '#D97706',
        backgroundColor: '#1E293B',
    },
    resendRow: {
        alignItems: 'center',
        marginBottom: 16,
    },
    countdownText: {
        fontSize: 12,
        color: '#64748B',
    },
    resendBtn: {
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    resendText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F59E0B',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginTop: 6,
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#1E293B',
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: '#94A3B8',
        fontWeight: '700',
        fontSize: 14,
    },
    verifyBtn: {
        flex: 2,
        backgroundColor: '#D97706',
        flexDirection: 'row',
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifyBtnDisabled: {
        backgroundColor: '#475569',
        opacity: 0.6,
    },
    verifyBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
    },
});
