import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, SafeAreaView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width, height } = Dimensions.get('window');

export default function PinSetupScreen() {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const inputRef = useRef<TextInput>(null);

    const handleNext = async () => {
        if (step === 'create') {
            if (pin.length === 4) {
                setStep('confirm');
                setConfirmPin('');
            }
        } else {
            if (confirmPin === pin) {
                setLoading(true);
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("User not found");

                    const { error } = await supabase
                        .from('profiles')
                        .update({ transaction_pin: pin })
                        .eq('id', user.id);

                    if (error) throw error;

                    Alert.alert("Success", "Security PIN created successfully!", [
                        { text: "Continue", onPress: () => router.replace('/(app)/dashboard') }
                    ]);
                } catch (error: any) {
                    Alert.alert("Error", error.message || "Failed to save PIN");
                } finally {
                    setLoading(false);
                }
            } else {
                Alert.alert("Error", "PINs do not match", [
                    { text: "Try Again", onPress: () => {
                        setStep('create');
                        setPin('');
                        setConfirmPin('');
                        inputRef.current?.focus();
                    }}
                ]);
            }
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            {/* Advanced Background Decorations */}
            <View className="absolute inset-0 overflow-hidden">
                {/* Large Gradient Blobs */}
                <LinearGradient
                    colors={['rgba(236, 72, 153, 0.04)', 'rgba(59, 130, 246, 0.06)']}
                    className="absolute -top-[10%] -left-[10%] w-[100%] aspect-square rounded-full"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.05)', 'transparent']}
                    className="absolute top-[30%] -right-[20%] w-[80%] aspect-square rounded-full"
                />
                <LinearGradient
                    colors={['rgba(16, 185, 129, 0.05)', 'rgba(139, 92, 246, 0.03)']}
                    className="absolute bottom-[-5%] right-[-5%] w-[70%] aspect-square rounded-full"
                />

                {/* Geometric Patterns */}
                <View 
                    style={{
                        position: 'absolute',
                        top: height * 0.1,
                        right: -width * 0.15,
                        width: width * 0.75,
                        height: width * 0.75,
                        borderRadius: width,
                        borderWidth: 1.5,
                        borderColor: 'rgba(59, 130, 246, 0.12)',
                        transform: [{ scale: 1.1 }]
                    }}
                />

                {/* Floating Bubbles */}
                <View className="absolute top-[20%] right-[10%] w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20" />
                <View className="absolute bottom-[35%] left-[15%] w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20" />
                <View className="absolute top-[50%] left-[5%] w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
            </View>

            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <View className="flex-1 px-8 py-12 items-center justify-center">
                        <View className="mb-12 items-center">
                            <View className="shadow-2xl shadow-blue-500/40 bg-white p-1 rounded-[32px] mb-10">
                                <LinearGradient
                                    colors={['#3B82F6', '#6366F1']}
                                    className="p-1 rounded-[30px]"
                                >
                                    <View className="bg-white p-5 rounded-[28px] items-center justify-center" style={{ width: 90, height: 90 }}>
                                        <Image 
                                            source={require('../../assets/images/logo.png')}
                                            style={{ width: 64, height: 64 }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </LinearGradient>
                            </View>
                            <Text className="text-3xl font-bold text-slate-900 mb-3 tracking-tight text-center">
                                {step === 'create' ? 'Secure Your Hub' : 'Confirm Security PIN'}
                            </Text>
                            <Text className="text-slate-500 text-center text-base font-medium leading-6 px-4">
                                {step === 'create'
                                    ? 'Create a 4-digit PIN to authorize your transactions safely.'
                                    : 'Please re-enter your 4-digit PIN to confirm.'}
                            </Text>
                        </View>

                        <View className="mb-12 w-full items-center">
                            <View className="flex-row gap-8">
                                {[...Array(4)].map((_, i) => (
                                    <View
                                        key={i}
                                        className={`w-5 h-5 rounded-full border-2 ${
                                            (step === 'create' ? pin.length : confirmPin.length) > i
                                                ? 'bg-blue-600 border-blue-500 shadow-md shadow-blue-500/30'
                                                : 'bg-slate-50 border-slate-200'
                                        }`}
                                    />
                                ))}
                            </View>

                            <TextInput
                                ref={inputRef}
                                className="w-full h-full absolute opacity-0"
                                keyboardType="number-pad"
                                maxLength={4}
                                value={step === 'create' ? pin : confirmPin}
                                onChangeText={step === 'create' ? setPin : setConfirmPin}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleNext}
                            disabled={((step === 'create' ? pin.length : confirmPin.length) !== 4) || loading}
                            activeOpacity={0.8}
                            className="w-full"
                        >
                            <LinearGradient
                                colors={((step === 'create' ? pin.length : confirmPin.length) === 4) 
                                    ? ['#3B82F6', '#6366F1'] 
                                    : ['#E2E8F0', '#E2E8F0']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="h-16 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/30"
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className={`font-bold text-lg tracking-wide ${((step === 'create' ? pin.length : confirmPin.length) === 4) ? 'text-white' : 'text-slate-400'}`}>
                                        {step === 'create' ? 'Set PIN' : 'Complete Setup'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                setPin('');
                                setConfirmPin('');
                                setStep('create');
                            }}
                            className="mt-10"
                        >
                            <Text className="text-slate-400 text-sm font-bold">Start over</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
