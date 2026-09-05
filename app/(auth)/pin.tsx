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
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase, forceSignOut } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';

const PIN_KEY = 'user_transaction_pin';

export default function PinUnlockScreen() {
    const { settings } = useAppSettings();
    const router = useRouter();

    const [pin, setPin] = useState('');
    const [savedPin, setSavedPin] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [greeting, setGreeting] = useState<string>('Welcome Back');

    // Security & Lockout States
    const [failedAttempts, setFailedAttempts] = useState<number>(0);
    const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
    const [showPin, setShowPin] = useState<boolean>(false);
    const [showForgotModal, setShowForgotModal] = useState<boolean>(false);

    // Animations
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        calculateGreeting();
        initPinScreen();
    }, []);

    useEffect(() => {
        let timer: any = null;
        if (lockoutSeconds > 0) {
            timer = setInterval(() => {
                setLockoutSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setFailedAttempts(0);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [lockoutSeconds]);

    const calculateGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning ☀️');
        else if (hour < 17) setGreeting('Good Afternoon ☀️');
        else setGreeting('Good Evening 🌙');
    };

    const triggerShakeAnimation = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
    };

    const initPinScreen = async () => {
        try {
            // Check for saved PIN in local storage first for instant rendering
            let localPin: string | null = null;
            if (Platform.OS === 'web') {
                localPin = await AsyncStorage.getItem(PIN_KEY);
            } else {
                localPin = await SecureStore.getItemAsync(PIN_KEY);
            }

            if (localPin) {
                setSavedPin(localPin);
            }

            // Load cached profile
            AsyncStorage.getItem('user_profile_cache').then((cachedProf) => {
                if (cachedProf) {
                    try {
                        const parsed = JSON.parse(cachedProf);
                        if (parsed.full_name) setUserName(parsed.full_name);
                        if (parsed.avatar_url) setUserAvatar(parsed.avatar_url);
                    } catch (_) {}
                }
            }).catch(() => {});

            // Get active session non-blockingly
            supabase.auth.getSession().then(async ({ data: { session } }) => {
                if (session?.user) {
                    setUserEmail(session.user.email || '');

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url, transaction_pin, role')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (profile?.full_name) {
                        setUserName(profile.full_name);
                    }
                    if (profile?.avatar_url) {
                        setUserAvatar(profile.avatar_url);
                    }
                    if (profile) {
                        AsyncStorage.setItem('user_profile_cache', JSON.stringify(profile)).catch(() => {});
                    }

                    if (!localPin && profile?.transaction_pin) {
                        const fetchedPin = profile.transaction_pin;
                        setSavedPin(fetchedPin);
                        if (Platform.OS === 'web') {
                            await AsyncStorage.setItem(PIN_KEY, fetchedPin);
                        } else {
                            await SecureStore.setItemAsync(PIN_KEY, fetchedPin);
                        }
                        localPin = fetchedPin;
                    }
                }

                if (!localPin && !savedPin) {
                    // If user has no PIN configured yet, show Create PIN screen
                    router.replace('/(auth)/pin-setup?action=create' as any);
                }
            }).catch(() => {});

            // Check biometric availability on native mobile
            if (Platform.OS !== 'web') {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                const bioEnabled = await AsyncStorage.getItem('biometrics_enabled');
                if (hasHardware && isEnrolled && bioEnabled === 'true') {
                    setBiometricAvailable(true);
                    setTimeout(() => {
                        triggerBiometricAuth(localPin);
                    }, 200);
                }
            }
        } catch (e) {
            console.error('PinUnlockScreen init error:', e);
        }
    };

    const triggerBiometricAuth = async (targetPin?: string | null) => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock ABU MAFHAL SUB',
                fallbackLabel: 'Use PIN',
                cancelLabel: 'Cancel',
            });
            if (result.success) {
                unlockSuccess();
            }
        } catch (e) {
            console.log('Biometric auth error:', e);
        }
    };

    const unlockSuccess = async () => {
        if (Platform.OS !== 'web') {
            Vibration.vibrate(40);
        }
        await AsyncStorage.setItem('app_unlocked', 'true');
        await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));
        try {
            const returnPath = await AsyncStorage.getItem('pin_return_path');
            if (returnPath) {
                await AsyncStorage.removeItem('pin_return_path');
                router.replace(returnPath as any);
                return;
            }
        } catch (_) {}
        router.replace('/dashboard' as any);
    };

    const handlePress = (digit: string) => {
        if (verifying || loading || lockoutSeconds > 0) return;

        if (digit === 'back') {
            setPin((prev) => prev.slice(0, -1));
            return;
        }

        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            if (newPin.length === 4) {
                verifyPin(newPin);
            }
        }
    };

    const verifyPin = async (enteredPin: string) => {
        setVerifying(true);
        let validPin = savedPin;

        // 1. Check local storage if state was unpopulated
        if (!validPin) {
            if (Platform.OS === 'web') {
                validPin = await AsyncStorage.getItem(PIN_KEY);
            } else {
                validPin = await SecureStore.getItemAsync(PIN_KEY);
            }
        }

        // 2. Fallback check Supabase DB profile
        if (!validPin) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('transaction_pin')
                        .eq('id', user.id)
                        .maybeSingle();
                    if (prof?.transaction_pin) {
                        const fetchedPin = prof.transaction_pin;
                        validPin = fetchedPin;
                        setSavedPin(fetchedPin);
                        if (Platform.OS === 'web') await AsyncStorage.setItem(PIN_KEY, fetchedPin);
                        else await SecureStore.setItemAsync(PIN_KEY, fetchedPin);
                    }
                }
            } catch (e) {
                console.log('PIN DB fallback error:', e);
            }
        }

        // 3. Verify against valid PIN or live DB check
        if (validPin && enteredPin === validPin) {
            unlockSuccess();
            return;
        }

        // 4. Live DB verify check in case PIN was recently set or updated in another session
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: latestProf } = await supabase
                    .from('profiles')
                    .select('transaction_pin')
                    .eq('id', user.id)
                    .maybeSingle();

                if (latestProf?.transaction_pin && latestProf.transaction_pin === enteredPin) {
                    const livePin = latestProf.transaction_pin;
                    setSavedPin(livePin);
                    if (Platform.OS === 'web') await AsyncStorage.setItem(PIN_KEY, livePin);
                    else await SecureStore.setItemAsync(PIN_KEY, livePin);
                    unlockSuccess();
                    return;
                }
            }
        } catch (e) {}

        // If verification fails:
        triggerShakeAnimation();
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (Platform.OS !== 'web') {
            Vibration.vibrate([60, 60, 60]);
        }

        if (newAttempts >= 5) {
            setLockoutSeconds(30);
            const errMsg = 'Too many failed attempts. Security lock active for 30 seconds.';
            if (Platform.OS === 'web') alert(errMsg);
            else Alert.alert('Security Lock', errMsg);
            setPin('');
            setVerifying(false);
            return;
        }

        const attemptsLeft = 5 - newAttempts;
        const msg = `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before security lock.`;

        if (Platform.OS === 'web') {
            alert(msg);
            setPin('');
            setVerifying(false);
        } else {
            Alert.alert('Incorrect PIN', msg, [
                {
                    text: 'Try Again',
                    onPress: () => {
                        setPin('');
                        setVerifying(false);
                    },
                },
            ]);
        }
    };

    const handleSignOut = () => {
        const executeSignOut = async () => {
            try {
                await forceSignOut();
                await AsyncStorage.removeItem('app_unlocked');
                await AsyncStorage.removeItem('has_active_session');
                await AsyncStorage.removeItem(PIN_KEY);
                router.replace('/');
            } catch (e) {
                router.replace('/');
            }
        };

        if (Platform.OS === 'web') {
            if (confirm('Sign Out: Are you sure you want to sign out of your account?')) {
                executeSignOut();
            }
        } else {
            Alert.alert('Sign Out', 'Are you sure you want to sign out of your account?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: executeSignOut,
                },
            ]);
        }
    };

    const handleForgotPin = () => {
        setShowForgotModal(true);
    };

    const handleContactSupport = () => {
        setShowForgotModal(false);
        const supportPhone = settings?.support_phone || '2348000000000';
        const url = `https://wa.me/${supportPhone.replace(/\+/g, '')}?text=Hello%20Support,%20I%20need%20help%20resetting%20my%20ABU%20MAFHAL%20SUB%20PIN.`;
        Linking.openURL(url).catch(() => {
            router.push('/support' as any);
        });
    };

    const getUserInitial = () => {
        if (userName && userName.trim()) {
            return userName.trim().charAt(0).toUpperCase();
        }
        if (userEmail && userEmail.trim()) {
            return userEmail.trim().charAt(0).toUpperCase();
        }
        return 'U';
    };

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
                {/* Security Top Bar */}
                <View style={s.topSecurityBar}>
                    <View style={s.securityBadge}>
                        <Ionicons name="shield-checkmark" size={13} color="#F59E0B" />
                        <Text style={s.securityBadgeText}>256-BIT SECURE</Text>
                    </View>
                    <Text style={s.brandBadgeText}>ABU MAFHAL SUB</Text>
                </View>

                {/* Main Card */}
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
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        </View>
                    </View>

                    {/* Greeting & Name */}
                    <View style={s.headerTextContainer}>
                        <Text style={s.greetingText}>{greeting}</Text>
                        <Text style={s.welcomeNameText}>{userName || 'Valued Partner'}</Text>
                        <Text style={s.emailSubText}>{userEmail || 'Enter your 4-digit PIN to unlock'}</Text>
                    </View>

                    {/* Lockout Warning */}
                    {lockoutSeconds > 0 ? (
                        <View style={s.lockoutBadge}>
                            <Ionicons name="timer-outline" size={16} color="#EF4444" />
                            <Text style={s.lockoutText}>Try again in {lockoutSeconds}s</Text>
                        </View>
                    ) : (
                        /* PIN Mask Toggle & Dot Input Indicator */
                        <View style={s.pinSection}>
                            <Animated.View style={[s.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
                                {[0, 1, 2, 3].map((idx) => {
                                    const filled = idx < pin.length;
                                    const currentDigit = pin[idx];
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
                    )}

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
                                        disabled={lockoutSeconds > 0}
                                    >
                                        <Text style={s.keypadButtonText}>{num}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}

                        <View style={s.keypadRow}>
                            {/* Biometric Button */}
                            {biometricAvailable ? (
                                <TouchableOpacity
                                    onPress={() => triggerBiometricAuth(savedPin)}
                                    style={[s.keypadButton, s.actionKeypadButton]}
                                    activeOpacity={0.7}
                                    disabled={lockoutSeconds > 0}
                                >
                                    <MaterialCommunityIcons
                                        name={Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'}
                                        size={26}
                                        color="#F59E0B"
                                    />
                                </TouchableOpacity>
                            ) : (
                                <View style={[s.keypadButton, { backgroundColor: 'transparent', borderWidth: 0 }]} />
                            )}

                            {/* Digit 0 */}
                            <TouchableOpacity
                                onPress={() => handlePress('0')}
                                style={s.keypadButton}
                                activeOpacity={0.75}
                                disabled={lockoutSeconds > 0}
                            >
                                <Text style={s.keypadButtonText}>0</Text>
                            </TouchableOpacity>

                            {/* Backspace Button */}
                            <TouchableOpacity
                                onPress={() => handlePress('back')}
                                style={[s.keypadButton, s.actionKeypadButton]}
                                activeOpacity={0.7}
                                disabled={lockoutSeconds > 0}
                            >
                                <Ionicons name="backspace-outline" size={24} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Action Footer Buttons */}
                    <View style={s.bottomActions}>
                        <TouchableOpacity style={s.forgotBtn} onPress={handleForgotPin} activeOpacity={0.7}>
                            <Ionicons name="key-outline" size={15} color="#F59E0B" />
                            <Text style={s.forgotBtnText}>Forgot PIN?</Text>
                        </TouchableOpacity>

                        <Text style={s.dotDivider}>•</Text>

                        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
                            <Ionicons name="log-out-outline" size={15} color="#EF4444" />
                            <Text style={s.signOutBtnText}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Forgot PIN Action Modal */}
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
                                <Ionicons name="shield-half-outline" size={26} color="#F59E0B" />
                            </View>
                            <Text style={s.modalTitle}>PIN Recovery & Help</Text>
                            <Text style={s.modalSub}>
                                Choose an option to reset your PIN or log in with fresh credentials.
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
                                <Text style={s.modalOptionTitle}>Contact Live Support</Text>
                                <Text style={s.modalOptionSub}>Get instant PIN reset help via Support Desk</Text>
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
                                <Text style={[s.modalOptionTitle, { color: '#EF4444' }]}>Sign Out & Reset</Text>
                                <Text style={s.modalOptionSub}>Log out of your account to set a new PIN</Text>
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
        height: '100%',
        overflow: 'hidden',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#020617',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 12,
        fontWeight: '600',
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
        paddingBottom: 12,
        height: '100%',
        overflow: 'hidden',
    },
    topSecurityBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
        paddingHorizontal: 6,
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
    brandBadgeText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingVertical: 4,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 8,
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
        backgroundColor: '#020617',
        borderRadius: 10,
    },
    headerTextContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    greetingText: {
        color: '#F59E0B',
        fontSize: 11.5,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    welcomeNameText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    emailSubText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '500',
    },
    pinSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
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
    lockoutBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#EF4444',
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 14,
    },
    lockoutText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
    },
    keypadGrid: {
        width: '100%',
        maxWidth: 270,
        gap: 10,
        marginBottom: 10,
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    keypadButton: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderColor: 'rgba(245, 158, 11, 0.2)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
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
    bottomActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 6,
    },
    forgotBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    forgotBtnText: {
        color: '#F59E0B',
        fontSize: 13,
        fontWeight: '700',
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    signOutBtnText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
    },
    dotDivider: {
        color: '#64748B',
        fontSize: 14,
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
