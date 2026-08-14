import React, { useState, useEffect } from 'react';
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
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [userName, setUserName] = useState<string>('');

    useEffect(() => {
        initPinScreen();
    }, []);

    const initPinScreen = async () => {
        setLoading(true);
        try {
            // Get user session & details
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.replace('/');
                return;
            }

            setUserEmail(session.user.email || '');

            // Get cached role & user name
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, transaction_pin, role')
                .eq('id', session.user.id)
                .maybeSingle();

            if (profile?.full_name) {
                setUserName(profile.full_name);
            }

            // Check for saved PIN in local storage or profile
            let localPin: string | null = null;
            if (Platform.OS === 'web') {
                localPin = await AsyncStorage.getItem(PIN_KEY);
            } else {
                localPin = await SecureStore.getItemAsync(PIN_KEY);
            }

            let effectivePin = localPin || profile?.transaction_pin || null;

            if (effectivePin) {
                setSavedPin(effectivePin);
                // Sync back to local storage if needed
                if (!localPin) {
                    if (Platform.OS === 'web') {
                        await AsyncStorage.setItem(PIN_KEY, effectivePin);
                    } else {
                        await SecureStore.setItemAsync(PIN_KEY, effectivePin);
                    }
                }
            } else {
                // If user has no PIN configured at all, mark as unlocked & let them go to dashboard
                await AsyncStorage.setItem('app_unlocked', 'true');
                const role = profile?.role || (await AsyncStorage.getItem(`user_role_${session.user.id}`));
                if (role === 'admin' || role === 'super_admin') {
                    router.replace('/manage/dashboard' as any);
                } else {
                    router.replace('/dashboard' as any);
                }
                return;
            }

            // Check biometric availability
            if (Platform.OS !== 'web') {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                const bioEnabled = await AsyncStorage.getItem('biometrics_enabled');
                if (hasHardware && isEnrolled && bioEnabled === 'true') {
                    setBiometricAvailable(true);
                    // Prompt biometrics automatically on open
                    setTimeout(() => {
                        triggerBiometricAuth(effectivePin);
                    }, 300);
                }
            }
        } catch (e) {
            console.error('PinUnlockScreen init error:', e);
        } finally {
            setLoading(false);
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

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const cachedRole = await AsyncStorage.getItem(`user_role_${session.user.id}`);
            if (cachedRole === 'admin' || cachedRole === 'super_admin') {
                router.replace('/manage/dashboard' as any);
                return;
            }
        }
        router.replace('/dashboard' as any);
    };

    const handlePress = (digit: string) => {
        if (verifying || loading) return;

        if (digit === 'back') {
            setPin(prev => prev.slice(0, -1));
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
        if (enteredPin === savedPin) {
            unlockSuccess();
        } else {
            if (Platform.OS !== 'web') {
                Vibration.vibrate([50, 50, 50]);
            }
            if (Platform.OS === 'web') {
                alert('Incorrect PIN. The PIN you entered is incorrect. Please try again.');
                setPin('');
                setVerifying(false);
            } else {
                Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect. Please try again.', [
                    {
                        text: 'OK',
                        onPress: () => {
                            setPin('');
                            setVerifying(false);
                        },
                    },
                ]);
            }
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out of your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    await forceSignOut();
                    await AsyncStorage.removeItem('app_unlocked');
                    await AsyncStorage.removeItem('has_active_session');
                    router.replace('/');
                },
            },
        ]);
    };

    const handleForgotPin = () => {
        Alert.alert(
            'Forgot PIN?',
            'Please contact ABU MAFHAL SUB support or log in again to reset your PIN securely.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out & Reset',
                    onPress: handleSignOut,
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={s.centerContainer}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#f5a623" />
                <Text style={s.loadingText}>Securing Session...</Text>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Premium Dark Mesh Gradients */}
            <LinearGradient colors={['#030C22', '#0A1E4A', '#030C22']} style={StyleSheet.absoluteFillObject} />

            {/* Glowing Orbs */}
            <View style={s.topGlow} />
            <View style={s.bottomGlow} />

            <SafeAreaView style={s.safeArea}>
                <View style={s.card}>
                    {/* Brand Header */}
                    <View style={s.headerContainer}>
                        <View style={s.logoCircle}>
                            <Image
                                source={
                                    settings?.app_logo
                                        ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url }
                                        : require('../../assets/images/logo.png')
                                }
                                style={s.logo}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={s.welcomeText}>
                            {userName ? `Welcome back, ${userName.split(' ')[0]}` : 'Welcome Back'}
                        </Text>
                        <Text style={s.emailSub}>{userEmail || 'Enter your PIN to unlock'}</Text>
                    </View>

                    {/* 4 PIN Dots */}
                    <View style={s.dotsContainer}>
                        {[0, 1, 2, 3].map((idx) => {
                            const filled = idx < pin.length;
                            return (
                                <View
                                    key={idx}
                                    style={[s.dot, filled ? s.dotFilled : s.dotEmpty]}
                                />
                            );
                        })}
                    </View>

                    {/* Keypad */}
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
                                        activeOpacity={0.7}
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
                                >
                                    <MaterialCommunityIcons
                                        name={Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'}
                                        size={26}
                                        color="#f5a623"
                                    />
                                </TouchableOpacity>
                            ) : (
                                <View style={[s.keypadButton, { backgroundColor: 'transparent', borderWidth: 0 }]} />
                            )}

                            {/* Digit 0 */}
                            <TouchableOpacity
                                onPress={() => handlePress('0')}
                                style={s.keypadButton}
                                activeOpacity={0.7}
                            >
                                <Text style={s.keypadButtonText}>0</Text>
                            </TouchableOpacity>

                            {/* Backspace Button */}
                            <TouchableOpacity
                                onPress={() => handlePress('back')}
                                style={[s.keypadButton, s.actionKeypadButton]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="backspace-outline" size={24} color="#f5a623" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Actions */}
                    <View style={s.bottomActions}>
                        <TouchableOpacity style={s.actionBtn} onPress={handleForgotPin}>
                            <Text style={s.actionBtnText}>Forgot PIN?</Text>
                        </TouchableOpacity>

                        <Text style={s.dotDivider}>•</Text>

                        <TouchableOpacity style={s.actionBtn} onPress={handleSignOut}>
                            <Text style={[s.actionBtnText, { color: '#ef4444' }]}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030C22',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#030C22',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 14,
        marginTop: 12,
        fontWeight: '600',
    },
    topGlow: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 350,
        height: 350,
        borderRadius: 175,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 350,
        height: 350,
        borderRadius: 175,
        backgroundColor: 'rgba(10, 30, 74, 0.6)',
    },
    safeArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(247, 201, 72, 0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#f5a623',
        shadowColor: '#f5a623',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    logo: {
        width: 38,
        height: 38,
    },
    welcomeText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    emailSub: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
        marginTop: 4,
        textAlign: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 16,
        marginVertical: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
    },
    dotEmpty: {
        backgroundColor: 'transparent',
        borderColor: '#475569',
    },
    dotFilled: {
        backgroundColor: '#f5a623',
        borderColor: '#f5a623',
        shadowColor: '#f5a623',
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 4,
    },
    keypadGrid: {
        gap: 12,
        width: '100%',
        alignItems: 'center',
        marginVertical: 10,
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 12,
    },
    keypadButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    actionKeypadButton: {
        backgroundColor: 'rgba(245, 166, 35, 0.1)',
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    keypadButtonText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
    },
    bottomActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 12,
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    actionBtnText: {
        color: '#f5a623',
        fontSize: 13,
        fontWeight: '700',
    },
    dotDivider: {
        color: '#475569',
        fontSize: 14,
    },
});
