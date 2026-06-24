import { View, Text, TouchableOpacity, Image, Dimensions, Vibration, Platform, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export default function PinSetupScreen() {
    const { action } = useLocalSearchParams(); // could be 'verify' or 'setup' explicitly if needed
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    
    // Modes: 'create' -> 'confirm' -> 'verify'
    const [mode, setMode] = useState<'create' | 'confirm' | 'verify'>('create');
    const [storedPin, setStoredPin] = useState<string | null>(null);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        checkExistingPin();
    }, []);

    const checkExistingPin = async () => {
        try {
            // Check local secure store first
            let savedPin = Platform.OS === 'web' 
                ? await AsyncStorage.getItem('user_transaction_pin')
                : await SecureStore.getItemAsync('user_transaction_pin');
            
            // If not found locally, check Supabase profile
            if (!savedPin) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase.from('profiles').select('transaction_pin').eq('id', user.id).single();
                    if (data?.transaction_pin) {
                        savedPin = data.transaction_pin;
                        // Save it back locally
                        if (Platform.OS === 'web') await AsyncStorage.setItem('user_transaction_pin', savedPin as string);
                        else await SecureStore.setItemAsync('user_transaction_pin', savedPin as string);
                    }
                }
            }

            if (savedPin) {
                setStoredPin(savedPin);
                setMode('verify');
            } else {
                setMode('create');
            }

            // Check if biometrics is explicitly enabled by user
            const bioStatus = await AsyncStorage.getItem('biometrics_enabled');
            if (bioStatus === 'true') {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                if (hasHardware && isEnrolled) {
                    setBiometricEnabled(true);
                }
            }

        } catch (error) {
            console.error("Error checking PIN:", error);
            setMode('create');
        } finally {
            setLoading(false);
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
        Vibration.vibrate(10);
        
        const currentPin = mode === 'confirm' ? confirmPin : pin;
        const setCurrent = mode === 'confirm' ? setConfirmPin : setPin;

        if (key === 'back') {
            setCurrent(prev => prev.slice(0, -1));
            return;
        }

        if (currentPin.length < 4) {
             setCurrent(prev => prev + key);
        }
    };

    const handleSuccessfulVerification = async () => {
        Vibration.vibrate(50);
        await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));
        router.back(); // Go back to where they came from
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
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("User not found");

                    // Save to local SecureStore
                    if (Platform.OS === 'web') {
                        await AsyncStorage.setItem('user_transaction_pin', pin);
                    } else {
                        await SecureStore.setItemAsync('user_transaction_pin', pin);
                    }

                    // Update in DB
                    const { error: dbError } = await supabase
                        .from('profiles')
                        .update({ transaction_pin: pin })
                        .eq('id', user.id);

                    if (dbError) throw dbError;

                    Vibration.vibrate(50);
                    setStoredPin(pin);
                    setMode('verify');
                    
                    Alert.alert("Success", "PIN created successfully!", [
                        { text: "Continue", onPress: () => router.replace('/(app)/dashboard') }
                    ]);
                } catch (error: any) {
                    Alert.alert("Error", error.message || "Failed to set PIN");
                    setConfirmPin('');
                    setPin('');
                    setMode('create');
                } finally {
                    setLoading(false);
                }
            } else {
                Vibration.vibrate([50, 50, 50]);
                Alert.alert("Mismatch", "PINs do not match. Please try again.");
                setConfirmPin('');
                setPin('');
                setMode('create');
            }
        } else if (mode === 'verify') {
            if (pin === storedPin) {
                handleSuccessfulVerification();
            } else {
                Vibration.vibrate([50, 50, 50]);
                Alert.alert("Incorrect PIN", "The PIN you entered is incorrect. Please try again.");
                setPin('');
            }
        }
    };

    // Auto-advance
    useEffect(() => {
        if (mode === 'create' && pin.length === 4) {
            processCompletePin();
        } else if (mode === 'confirm' && confirmPin.length === 4) {
            processCompletePin();
        } else if (mode === 'verify' && pin.length === 4) {
            processCompletePin();
        }
    }, [pin, confirmPin, mode]);

    const handleForgotPin = () => {
        Alert.alert(
            "Reset PIN",
            "To reset your PIN, we need to send an OTP to your email or phone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Proceed", onPress: () => {
                    // Logic for forgot PIN. E.g. logging out or sending OTP
                    Alert.alert("Notice", "Please contact support to reset your PIN securely.");
                }}
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <ActivityIndicator size="large" color="#0d1b3e" />
            </SafeAreaView>
        );
    }

    const currentPinStr = mode === 'confirm' ? confirmPin : pin;

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            {/* Colorful Mesh Gradient Background */}
            <View style={StyleSheet.absoluteFillObject} className="pointer-events-none">
                <LinearGradient colors={['rgba(245, 166, 35, 0.08)', 'rgba(245, 166, 35, 0)']} style={s.topGlow} />
                <LinearGradient colors={['rgba(13, 27, 62, 0.06)', 'rgba(13, 27, 62, 0)']} style={s.bottomGlow} />
            </View>

            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {/* Header bar with Back Button */}
                <View style={s.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#0d1b3e" />
                    </TouchableOpacity>
                </View>

                {/* Compact Premium Dialer Card */}
                <View style={s.card}>
                    
                    {/* Header Section */}
                    <View style={s.headerContainer}>
                        <View style={s.logoCard}>
                            <Image 
                                source={require('../../assets/images/logo.png')}
                                style={s.logo}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={s.title}>
                            {mode === 'create' ? 'Create PIN' : mode === 'confirm' ? 'Confirm PIN' : 'Enter PIN'}
                        </Text>
                        <Text style={s.subtitle}>
                            {mode === 'create' ? 'Secure your transactions' : mode === 'confirm' ? 'Re-enter your PIN' : 'Verify your identity to proceed'}
                        </Text>
                    </View>

                    {/* Modern Dots */}
                    <View style={s.dotsContainer}>
                        {[0, 1, 2, 3].map((idx) => {
                            const filled = idx < currentPinStr.length;
                            return (
                                <View 
                                    key={idx} 
                                    style={[s.dot, filled ? s.dotFilled : s.dotEmpty]} 
                                />
                            );
                        })}
                    </View>

                    {/* Premium Keypad */}
                    <View style={s.keypadContainer}>
                         <View style={s.keypadGrid}>
                            {[
                                [1, 2, 3],
                                [4, 5, 6],
                                [7, 8, 9]
                            ].map((row, rIdx) => (
                                <View key={rIdx} style={s.keypadRow}>
                                    {row.map(num => (
                                        <TouchableOpacity
                                            key={num}
                                            onPress={() => handlePress(num.toString())}
                                            style={s.keypadButton}
                                            activeOpacity={0.6}
                                        >
                                            <Text style={s.keypadButtonText}>{num}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                            
                            <View style={s.keypadRow}>
                                {/* Bottom Left: Biometric (Only show if Verify mode AND enabled) */}
                                {mode === 'verify' && biometricEnabled ? (
                                    <TouchableOpacity
                                        onPress={handleBiometricAuth}
                                        style={[s.keypadButton, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}
                                        activeOpacity={0.6}
                                    >
                                        <Ionicons name="finger-print" size={24} color="#0d1b3e" />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={[s.keypadButton, { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 }]} />
                                )}
                                
                                <TouchableOpacity
                                    onPress={() => handlePress('0')}
                                    style={s.keypadButton}
                                    activeOpacity={0.6}
                                >
                                    <Text style={s.keypadButtonText}>0</Text>
                                </TouchableOpacity>

                                {/* Bottom Right: Backspace */}
                                <TouchableOpacity
                                    onPress={() => handlePress('back')}
                                    style={s.keypadButton}
                                    activeOpacity={0.6}
                                >
                                    <Ionicons name="backspace-outline" size={24} color="#f5a623" style={{ marginRight: 2 }} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Forgot PIN Link (Only in verify mode) */}
                    {mode === 'verify' && (
                        <TouchableOpacity style={s.forgotPinBtn} onPress={handleForgotPin}>
                            <Text style={s.forgotPinText}>Forgot PIN?</Text>
                        </TouchableOpacity>
                    )}

                </View>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6fb',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#f4f6fb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topGlow: {
        position: 'absolute',
        top: -150,
        right: -150,
        width: 450,
        height: 450,
        borderRadius: 225,
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -150,
        left: -150,
        width: 450,
        height: 450,
        borderRadius: 225,
    },
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 44 : 20,
        left: 20,
        zIndex: 10,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    card: {
        width: '90%',
        maxWidth: 320,
        backgroundColor: '#ffffff',
        borderRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 4,
    },
    headerContainer: {
        alignItems: 'center',
        width: '100%',
    },
    logoCard: {
        width: 48, // Reduced size slightly for a cleaner look
        height: 48,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)', 
    },
    logo: {
        width: 24,
        height: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0d1b3e',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: 12,
        lineHeight: 14,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginVertical: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.2,
    },
    dotEmpty: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    dotFilled: {
        backgroundColor: '#f5a623',
        borderColor: '#f5a623',
        transform: [{ scale: 1.1 }],
    },
    keypadContainer: {
        width: '100%',
    },
    keypadGrid: {
        gap: 8, // Reduced gap for a tighter layout
        width: '100%',
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10, // Added slight padding so buttons don't touch edges
    },
    keypadButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.01,
        shadowRadius: 3,
        elevation: 1,
    },
    keypadButtonText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    forgotPinBtn: {
        marginTop: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    forgotPinText: {
        color: '#f5a623',
        fontSize: 12,
        fontWeight: '700',
    }
});
