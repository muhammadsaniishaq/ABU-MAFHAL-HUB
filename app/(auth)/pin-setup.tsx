import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Platform,
    Alert,
    Vibration,
    ActivityIndicator,
    Animated,
    Modal,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase, forceSignOut } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function PinSetupScreen() {
    const { settings } = useAppSettings();
    const router = useRouter();
    const { action, reset, email } = useLocalSearchParams<{ action?: string; reset?: string; email?: string }>();

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [mode, setMode] = useState<'create' | 'confirm' | 'verify'>('create');
    const [storedPin, setStoredPin] = useState<string | null>(null);
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    const [loading, setLoading] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    // Profile Details
    const [userName, setUserName] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    // Animation
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkExistingPin();
    }, []);

    const triggerShakeAnimation = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
    };

    const checkExistingPin = async () => {
        try {
            let savedPin = Platform.OS === 'web'
                ? await AsyncStorage.getItem('user_transaction_pin')
                : await SecureStore.getItemAsync('user_transaction_pin');

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || '');
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url, transaction_pin')
                    .eq('id', user.id)
                    .maybeSingle();

                if (data?.full_name) setUserName(data.full_name);
                if (data?.avatar_url) setUserAvatar(data.avatar_url);

                if (!savedPin && data?.transaction_pin) {
                    savedPin = data.transaction_pin;
                    if (Platform.OS === 'web') await AsyncStorage.setItem('user_transaction_pin', savedPin as string);
                    else await SecureStore.setItemAsync('user_transaction_pin', savedPin as string);
                }
            }

            const isResetFlow = action === 'reset' || action === 'setup' || action === 'create' || reset === 'true' || !!email;

            if (savedPin && !isResetFlow) {
                setStoredPin(savedPin);
                setMode('verify');
            } else {
                // If user has no PIN set yet or is in setup/create/reset flow, ALWAYS show Create PIN
                setMode('create');
            }

            const bioStatus = await AsyncStorage.getItem('biometrics_enabled');
            if (bioStatus === 'true' && Platform.OS !== 'web') {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                if (hasHardware && isEnrolled) {
                    setBiometricEnabled(true);
                }
            }
        } catch (error) {
            console.error('Error checking PIN:', error);
            setMode('create');
        }
    };

    const handleBiometricAuth = async () => {
        if (!biometricEnabled) return;
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Verify identity to continue',
                fallbackLabel: 'Use PIN',
                disableDeviceFallback: false,
            });
            if (result.success) {
                handleSuccessfulVerification();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handlePress = (key: string) => {
        if (loading) return;
        if (Platform.OS !== 'web') Vibration.vibrate(10);

        const currentPin = mode === 'confirm' ? confirmPin : pin;
        const setCurrent = mode === 'confirm' ? setConfirmPin : setPin;

        if (key === 'back') {
            setCurrent((prev) => prev.slice(0, -1));
            return;
        }

        if (currentPin.length < 4) {
            setCurrent((prev) => prev + key);
        }
    };

    const handleSuccessfulVerification = async () => {
        if (Platform.OS !== 'web') Vibration.vibrate(50);
        await AsyncStorage.setItem('app_unlocked', 'true');
        await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));
        router.replace('/dashboard' as any);
    };

    const processCompletePin = async () => {
        if (mode === 'create') {
            if (pin.length === 4) {
                setMode('confirm');
            }
        } else if (mode === 'confirm') {
            if (confirmPin === pin) {
                setLoading(true);
                try {
                    // 1. Store PIN in local storage & unlock app instantly
                    if (Platform.OS === 'web') {
                        await AsyncStorage.setItem('user_transaction_pin', pin);
                    } else {
                        await SecureStore.setItemAsync('user_transaction_pin', pin);
                    }
                    await AsyncStorage.setItem('app_unlocked', 'true');
                    await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));
                    setStoredPin(pin);

                    // 2. Sync to Supabase profiles gracefully
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user?.id) {
                            await supabase
                                .from('profiles')
                                .update({ transaction_pin: pin })
                                .eq('id', user.id);
                        }
                    } catch (e) {
                        console.log('Profile transaction_pin sync notice:', e);
                    }

                    if (Platform.OS !== 'web') Vibration.vibrate(50);

                    // 3. Check active session & navigate appropriately (avoids falling back to Splash Page '/')
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    if (session) {
                        if (Platform.OS === 'web') {
                            alert('Success! Your 4-digit Transaction PIN has been set successfully.');
                            router.replace('/dashboard' as any);
                        } else {
                            Alert.alert('Success! 🎉', 'Your 4-digit Transaction PIN has been set successfully.', [
                                { text: 'Go to Dashboard', onPress: () => router.replace('/dashboard' as any) },
                            ]);
                        }
                    } else {
                        const msg = 'Success! Your account & 4-digit Transaction PIN have been created successfully. Please sign in to access your dashboard.';
                        if (Platform.OS === 'web') {
                            alert(msg);
                            router.replace('/login' as any);
                        } else {
                            Alert.alert('Setup Complete! 🎉', msg, [
                                { text: 'Sign In Now', onPress: () => router.replace('/login' as any) },
                            ]);
                        }
                    }
                } catch (error: any) {
                    const errMsg = error.message || 'Failed to save PIN';
                    if (Platform.OS === 'web') alert(errMsg);
                    else Alert.alert('Error', errMsg);
                } finally {
                    setLoading(false);
                }
            } else {
                triggerShakeAnimation();
                if (Platform.OS !== 'web') Vibration.vibrate([50, 50, 50]);
                const msg = 'PINs do not match. Please enter your PIN again.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Mismatch', msg);
                setConfirmPin('');
                setPin('');
                setMode('create');
            }
        } else if (mode === 'verify') {
            if (pin === storedPin) {
                handleSuccessfulVerification();
            } else {
                triggerShakeAnimation();
                if (Platform.OS !== 'web') Vibration.vibrate([50, 50, 50]);
                const msg = 'The PIN you entered is incorrect. Please try again.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Incorrect PIN', msg);
                setPin('');
            }
        }
    };

    useEffect(() => {
        if (mode === 'create' && pin.length === 4) {
            processCompletePin();
        } else if (mode === 'confirm' && confirmPin.length === 4) {
            processCompletePin();
        } else if (mode === 'verify' && pin.length === 4) {
            processCompletePin();
        }
    }, [pin, confirmPin, mode]);

    const handleSignOut = async () => {
        try {
            await forceSignOut();
            await AsyncStorage.removeItem('app_unlocked');
            await AsyncStorage.removeItem('has_active_session');
            await AsyncStorage.removeItem('user_transaction_pin');
            router.replace('/');
        } catch (e) {
            router.replace('/');
        }
    };

    const handleContactSupport = () => {
        setShowForgotModal(false);
        const supportPhone = settings?.support_phone || '2348000000000';
        const url = `https://wa.me/${supportPhone.replace(/\+/g, '')}?text=Hello%20Support,%20I%20need%20help%20resetting%20my%20PIN.`;
        Linking.openURL(url).catch(() => {
            router.push('/support' as any);
        });
    };

    const getUserInitial = () => {
        if (userName && userName.trim()) return userName.trim().charAt(0).toUpperCase();
        if (userEmail && userEmail.trim()) return userEmail.trim().charAt(0).toUpperCase();
        return 'U';
    };

    const currentPinStr = mode === 'confirm' ? confirmPin : pin;

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Deep Royal Mesh Gradient */}
            <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={StyleSheet.absoluteFillObject} />

            {/* Glowing Ambient Lights */}
            <View style={s.topGlow} />
            <View style={s.bottomGlow} />

            <SafeAreaView style={s.safeArea}>
                {/* Header Navigation Bar */}
                <View style={s.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#F59E0B" />
                    </TouchableOpacity>

                    <View style={s.securityBadge}>
                        <Ionicons name="shield-checkmark" size={13} color="#F59E0B" />
                        <Text style={s.securityBadgeText}>ENCRYPTED RESET</Text>
                    </View>

                    <View style={{ width: 36 }} />
                </View>

                {/* Main Setup Card */}
                <View style={s.card}>
                    {/* User Profile Avatar Ring */}
                    <View style={s.avatarWrapper}>
                        <LinearGradient colors={['#F59E0B', '#D97706', '#78350F']} style={s.avatarBorderRing}>
                            {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={s.avatarImage} />
                            ) : (
                                <View style={s.avatarFallback}>
                                    <Text style={s.avatarInitialText}>{getUserInitial()}</Text>
                                </View>
                            )}
                        </LinearGradient>
                        <View style={s.activeBadge}>
                            <Ionicons name="lock-closed" size={12} color="#020617" />
                        </View>
                    </View>

                    {/* Title & Subtitle */}
                    <Text style={s.titleText}>
                        {mode === 'create' ? 'Create New PIN' : mode === 'confirm' ? 'Confirm New PIN' : 'Enter PIN'}
                    </Text>
                    <Text style={s.subtitleText}>
                        {mode === 'create'
                            ? 'Set a 4-digit PIN to secure all transactions'
                            : mode === 'confirm'
                            ? 'Re-enter your 4-digit PIN to verify'
                            : 'Enter your PIN to complete verification'}
                    </Text>

                    {/* Step Indicator Pills */}
                    <View style={s.stepPillsContainer}>
                        <View style={[s.stepPill, mode === 'create' ? s.stepPillActive : s.stepPillCompleted]}>
                            <Text style={[s.stepPillText, mode === 'create' ? s.stepPillTextActive : s.stepPillTextCompleted]}>
                                1. Create PIN
                            </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={14} color="#64748B" />

                        <View style={[s.stepPill, mode === 'confirm' ? s.stepPillActive : s.stepPillInactive]}>
                            <Text style={[s.stepPillText, mode === 'confirm' ? s.stepPillTextActive : s.stepPillTextInactive]}>
                                2. Confirm
                            </Text>
                        </View>
                    </View>

                    {/* PIN Mask Toggle & Dots */}
                    <View style={s.pinSection}>
                        <Animated.View style={[s.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
                            {[0, 1, 2, 3].map((idx) => {
                                const filled = idx < currentPinStr.length;
                                const currentDigit = currentPinStr[idx];
                                return (
                                    <View key={idx} style={[s.dot, filled ? s.dotFilled : s.dotEmpty]}>
                                        {filled && showPin && (
                                            <Text style={s.dotNumberText}>{currentDigit}</Text>
                                        )}
                                    </View>
                                );
                            })}
                        </Animated.View>

                        <TouchableOpacity
                            onPress={() => setShowPin(!showPin)}
                            style={s.eyeToggleBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    {/* Keypad Grid */}
                    <View style={s.keypadGrid}>
                        {[
                            [1, 2, 3],
                            [4, 5, 6],
                            [7, 8, 9],
                        ].map((row, rIdx) => (
                            <View key={rIdx} style={s.keypadRow}>
                                {row.map((num) => (
                                    <TouchableOpacity
                                        key={num}
                                        onPress={() => handlePress(num.toString())}
                                        style={s.keypadButton}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={s.keypadButtonText}>{num}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}

                        <View style={s.keypadRow}>
                            {/* Biometric (Verify Mode Only) */}
                            {mode === 'verify' && biometricEnabled ? (
                                <TouchableOpacity
                                    onPress={handleBiometricAuth}
                                    style={[s.keypadButton, s.actionKeypadButton]}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="finger-print" size={26} color="#F59E0B" />
                                </TouchableOpacity>
                            ) : (
                                <View style={[s.keypadButton, { backgroundColor: 'transparent', borderWidth: 0 }]} />
                            )}

                            {/* Digit 0 */}
                            <TouchableOpacity
                                onPress={() => handlePress('0')}
                                style={s.keypadButton}
                                activeOpacity={0.75}
                            >
                                <Text style={s.keypadButtonText}>0</Text>
                            </TouchableOpacity>

                            {/* Backspace */}
                            <TouchableOpacity
                                onPress={() => handlePress('back')}
                                style={[s.keypadButton, s.actionKeypadButton]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="backspace-outline" size={24} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Reset & Recovery Help Button */}
                    <TouchableOpacity
                        style={s.helpBtn}
                        onPress={() => setShowForgotModal(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="help-circle-outline" size={15} color="#F59E0B" />
                        <Text style={s.helpBtnText}>Need Help Resetting PIN?</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Forgot / Reset Help Modal */}
            <Modal
                visible={showForgotModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowForgotModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View style={s.modalIconCircle}>
                                <Ionicons name="key-outline" size={26} color="#F59E0B" />
                            </View>
                            <Text style={s.modalTitle}>PIN Reset Assistance</Text>
                            <Text style={s.modalSub}>
                                Choose an option to get help setting your 4-digit transaction PIN.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={s.modalOptionBtn}
                            onPress={() => {
                                setShowForgotModal(false);
                                router.push('/otp' as any);
                            }}
                        >
                            <Ionicons name="mail-unread-outline" size={20} color="#F59E0B" />
                            <View style={s.modalOptionTextCol}>
                                <Text style={s.modalOptionTitle}>Reset via Email OTP</Text>
                                <Text style={s.modalOptionSub}>Send a 6-digit verification code to your email</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#64748B" />
                        </TouchableOpacity>

                        <TouchableOpacity style={s.modalOptionBtn} onPress={handleContactSupport}>
                            <Ionicons name="chatbubbles-outline" size={20} color="#10B981" />
                            <View style={s.modalOptionTextCol}>
                                <Text style={s.modalOptionTitle}>Contact Support Desk</Text>
                                <Text style={s.modalOptionSub}>Get live assistance from ABU MAFHAL SUB team</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#64748B" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[s.modalOptionBtn, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                            onPress={() => {
                                setShowForgotModal(false);
                                handleSignOut();
                            }}
                        >
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                            <View style={s.modalOptionTextCol}>
                                <Text style={[s.modalOptionTitle, { color: '#EF4444' }]}>Sign Out</Text>
                                <Text style={s.modalOptionSub}>Log out of your account cleanly</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#64748B" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.modalCloseBtn}
                            onPress={() => setShowForgotModal(false)}
                        >
                            <Text style={s.modalCloseBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    topGlow: {
        position: 'absolute',
        top: -100,
        alignSelf: 'center',
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -100,
        alignSelf: 'center',
        width: 340,
        height: 340,
        borderRadius: 170,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
    },
    safeArea: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    securityBadgeText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 12,
    },
    avatarBorderRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        padding: 3,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    avatarImage: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#0F172A',
    },
    avatarFallback: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    avatarInitialText: {
        color: '#F59E0B',
        fontSize: 28,
        fontWeight: '900',
    },
    activeBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#F59E0B',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    subtitleText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 14,
    },
    stepPillsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
    },
    stepPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
    },
    stepPillActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#F59E0B',
    },
    stepPillCompleted: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10B981',
    },
    stepPillInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    stepPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    stepPillTextActive: {
        color: '#F59E0B',
    },
    stepPillTextCompleted: {
        color: '#10B981',
    },
    stepPillTextInactive: {
        color: '#64748B',
    },
    pinSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    dot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotEmpty: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1.5,
    },
    dotFilled: {
        backgroundColor: '#F59E0B',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 6,
    },
    dotNumberText: {
        color: '#020617',
        fontSize: 11,
        fontWeight: '900',
    },
    eyeToggleBtn: {
        padding: 6,
    },
    keypadGrid: {
        width: '100%',
        maxWidth: 290,
        gap: 14,
        marginBottom: 16,
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    keypadButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    keypadButtonText: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '700',
    },
    actionKeypadButton: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    helpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    helpBtnText: {
        color: '#F59E0B',
        fontSize: 13,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#0F172A',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderRadius: 24,
        padding: 22,
        alignItems: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 18,
    },
    modalIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    modalSub: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 16,
    },
    modalOptionBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    modalOptionTextCol: {
        flex: 1,
    },
    modalOptionTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    modalOptionSub: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '500',
    },
    modalCloseBtn: {
        width: '100%',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    modalCloseBtnText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '700',
    },
});
