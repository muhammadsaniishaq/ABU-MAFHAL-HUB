import { View, Text, TouchableOpacity, Image, Dimensions, Vibration, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PinSetupScreen() {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handlePress = (key: string) => {
        if (loading) return;
        Vibration.vibrate(10);
        const currentPin = step === 'create' ? pin : confirmPin;
        const setCurrent = step === 'create' ? setPin : setConfirmPin;

        if (key === 'back') {
            setCurrent(prev => prev.slice(0, -1));
            return;
        }

        if (currentPin.length < 4) {
             setCurrent(prev => prev + key);
        }
    };

    const handleNext = async () => {
        if (step === 'create') {
            if (pin.length === 4) {
                setStep('confirm');
            }
        } else {
             if (confirmPin === pin) {
                 setLoading(true);
                 try {
                     const { data: { user } } = await supabase.auth.getUser();
                     if (!user) throw new Error("User not found");

                     // Save to local SecureStore (or AsyncStorage on web)
                     if (Platform.OS === 'web') {
                         await AsyncStorage.setItem('user_transaction_pin', pin);
                     } else {
                         await SecureStore.setItemAsync('user_transaction_pin', pin);
                     }

                     // Avoid immediate PIN verification prompt after setup
                     await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));

                     // Update PIN in Supabase public.profiles
                     const { error: dbError } = await supabase
                         .from('profiles')
                         .update({ transaction_pin: pin })
                         .eq('id', user.id);

                     if (dbError) throw dbError;

                     Vibration.vibrate(50);
                     Alert.alert("Success", "Transaction PIN configured successfully!", [
                         { text: "Continue", onPress: () => router.replace('/(app)/dashboard') }
                     ]);
                 } catch (error: any) {
                     Alert.alert("Error", error.message || "Failed to set PIN");
                     setConfirmPin('');
                     setPin('');
                     setStep('create');
                 } finally {
                     setLoading(false);
                 }
              } else {
                 Vibration.vibrate([50, 50, 50]);
                 Alert.alert("Mismatch", "PINs do not match. Please try again.");
                 setConfirmPin('');
                 setPin('');
                 setStep('create');
             }
        }
    };

    // Auto-advance or confirm when 4 digits are input
    useEffect(() => {
        if (step === 'create' && pin.length === 4) {
            handleNext();
        } else if (step === 'confirm' && confirmPin.length === 4) {
            handleNext();
        }
    }, [pin, confirmPin, step]);

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            {/* Colorful Mesh Gradient Background */}
            <View style={StyleSheet.absoluteFillObject} className="pointer-events-none">
                {/* Top Right - Gold Glow */}
                <LinearGradient
                    colors={['rgba(245, 166, 35, 0.08)', 'rgba(245, 166, 35, 0)']}
                    style={s.topGlow}
                />
                
                {/* Bottom Left - Navy Glow */}
                <LinearGradient
                    colors={['rgba(13, 27, 62, 0.06)', 'rgba(13, 27, 62, 0)']}
                    style={s.bottomGlow}
                />
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
                    
                    {/* Header Section (Top) */}
                    <View style={s.headerContainer}>
                        <View style={s.logoCard}>
                            <Image 
                                source={require('../../assets/images/logo.png')}
                                style={s.logo}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={s.title}>
                            {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
                        </Text>
                        <Text style={s.subtitle}>
                            {step === 'create' ? 'Secure your transactions' : 'Re-enter your PIN'}
                        </Text>
                    </View>

                    {/* Modern Dots */}
                    <View style={s.dotsContainer}>
                        {[0, 1, 2, 3].map((idx) => {
                            const currentLength = step === 'create' ? pin.length : confirmPin.length;
                            const filled = idx < currentLength;
                            return (
                                <View 
                                    key={idx} 
                                    style={[
                                        s.dot,
                                        filled ? s.dotFilled : s.dotEmpty
                                    ]} 
                                />
                            );
                        })}
                    </View>

                    {/* Premium Keypad (Bottom) */}
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
                                <View style={[s.keypadButton, { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 }]} /> 
                                <TouchableOpacity
                                    onPress={() => handlePress('0')}
                                    style={s.keypadButton}
                                    activeOpacity={0.6}
                                >
                                    <Text style={s.keypadButtonText}>0</Text>
                                </TouchableOpacity>
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

                </View>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6fb', // Premium soft gray-navy
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
        paddingVertical: 28,
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
        width: 54,
        height: 54,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)', // Soft gold border
    },
    logo: {
        width: 26,
        height: 26,
    },
    title: {
        fontSize: 19,
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
        marginVertical: 20,
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
        marginTop: 4,
    },
    keypadGrid: {
        gap: 10,
        width: '100%',
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    keypadButton: {
        width: 60,
        height: 60,
        borderRadius: 30, // Perfectly circular small buttons
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
        fontSize: 21,
        fontWeight: '700',
        color: '#0d1b3e',
    },
});
