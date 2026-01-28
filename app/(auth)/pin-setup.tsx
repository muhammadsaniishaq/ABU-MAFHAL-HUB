import { View, Text, TouchableOpacity, Image, Dimensions, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

export default function PinSetupScreen() {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handlePress = (key: string) => {
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
        // Validation Logic
        if (step === 'create') {
            if (pin.length === 4) {
                setStep('confirm');
            }
        } else {
             // Confirm Step
             if (confirmPin === pin) {
                 setLoading(true);
                 try {
                     const { data: { user } } = await supabase.auth.getUser();
                     if (!user) throw new Error("User not found");

                     // Save to SecureStore
                     await SecureStore.setItemAsync('user_transaction_pin', pin);

                     // Success Animation/Alert
                     Vibration.vibrate(50);
                     router.replace('/(app)/dashboard');
                 } catch (error: any) {
                     alert(error.message);
                 } finally {
                     setLoading(false);
                 }
             } else {
                 // Mismatch
                 Vibration.vibrate([50, 50, 50]);
                 alert("PINs do not match. Please try again.");
                 setConfirmPin('');
                 setStep('create'); // Reset to start for safety
                 setPin('');
             }
        }
    };

    const renderDot = (index: number) => {
        const currentLength = step === 'create' ? pin.length : confirmPin.length;
        const filled = index < currentLength;
        return (
            <View 
                key={index} 
                className={`w-6 h-6 rounded-full mx-2 border-2 ${
                    filled ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-blue-200'
                }`} 
            />
        );
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            {/* Colorful Mesh Gradient Background */}
            <View className="absolute inset-0 overflow-hidden pointer-events-none bg-[#F8FAFC]">
                {/* Top Right - Purple/Pink Glow */}
                <LinearGradient
                    colors={['rgba(168, 85, 247, 0.15)', 'rgba(168, 85, 247, 0)']}
                    className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-[80px]"
                />
                
                {/* Bottom Left - Cyan/Teal Glow */}
                <LinearGradient
                    colors={['rgba(6, 182, 212, 0.15)', 'rgba(6, 182, 212, 0)']}
                    className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full blur-[80px]"
                />

                {/* Center - Primary Blue Subtle */}
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0)']}
                    className="absolute top-1/2 left-1/2 -ml-[300px] -mt-[300px] w-[600px] h-[600px] rounded-full blur-[100px]"
                />
            </View>

            <SafeAreaView className="flex-1">
                <View className="flex-1 px-8 py-6 justify-between">
                    
                    {/* Header Section (Top) */}
                    <View className="items-center mt-12">
                         <View className="w-24 h-24 bg-white/80 rounded-[32px] items-center justify-center mb-8 border border-white backdrop-blur-md shadow-sm shadow-sky-100">
                           <Image 
                                source={require('../../assets/images/logo.png')}
                                className="w-12 h-12"
                                resizeMode="contain"
                            />
                        </View>
                        <Text className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">
                            {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
                        </Text>
                        <Text className="text-slate-500 text-base font-medium tracking-wide">
                            {step === 'create' ? 'Secure your account' : 'Verify your identity'}
                        </Text>

                        {/* Modern Dots */}
                        <View className="flex-row gap-6 mt-12">
                            {[0, 1, 2, 3].map((idx) => {
                                const currentLength = step === 'create' ? pin.length : confirmPin.length;
                                const filled = idx < currentLength;
                                return (
                                    <View 
                                        key={idx} 
                                        className={`w-4 h-4 rounded-full transition-all duration-300 ${
                                            filled 
                                            ? 'bg-sky-500 shadow-lg shadow-sky-200 scale-110' 
                                            : 'bg-slate-200 border border-slate-300'
                                        }`} 
                                    />
                                );
                            })}
                        </View>
                    </View>

                    {/* Premium Glass Keypad (Bottom) */}
                    <View className="w-full max-w-[340px] self-center mb-8">
                         <View className="gap-y-6">
                            {[
                                [1, 2, 3],
                                [4, 5, 6],
                                [7, 8, 9]
                            ].map((row, rIdx) => (
                                <View key={rIdx} className="flex-row justify-between px-2">
                                    {row.map(num => (
                                        <TouchableOpacity
                                            key={num}
                                            onPress={() => handlePress(num.toString())}
                                            className="w-[85px] h-[85px] rounded-[32px] bg-white items-center justify-center border border-white shadow-sm active:bg-slate-50 active:scale-95 transition-all"
                                        >
                                            <Text className="text-3xl font-semibold text-slate-700">{num}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                            
                            <View className="flex-row justify-between items-center px-2">
                                <View className="w-[85px] h-[85px]" /> 
                                <TouchableOpacity
                                    onPress={() => handlePress('0')}
                                    className="w-[85px] h-[85px] rounded-[32px] bg-white items-center justify-center border border-white shadow-sm active:bg-slate-50 active:scale-95 transition-all"
                                >
                                    <Text className="text-3xl font-semibold text-slate-700">0</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handlePress('back')}
                                    className="w-[85px] h-[85px] rounded-[32px] items-center justify-center active:bg-slate-100/50 active:scale-95 transition-all"
                                >
                                    <Ionicons name="backspace-outline" size={32} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                </View>
            </SafeAreaView>
        </View>
    );
}
