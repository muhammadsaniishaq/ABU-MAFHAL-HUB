import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function PinSetupScreen() {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const router = useRouter();

    const handleNext = () => {
        if (step === 'create') {
            if (pin.length === 4) {
                setStep('confirm');
            }
        } else {
            if (confirmPin === pin) {
                // Success
                Alert.alert("Success", "PIN created successfully!");
                router.replace('/(app)/dashboard');
            } else {
                Alert.alert("Error", "PINs do not match");
                setConfirmPin('');
                setStep('create'); // Reset logic could be better but simplified for MVP
                setPin('');
            }
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <StatusBar style="dark" />
            <View className="flex-1 px-6 pt-12 items-center">
                <View className="mb-10 items-center">
                    <Text className="text-primary text-2xl font-bold mb-2">
                        {step === 'create' ? 'Create Transaction PIN' : 'Confirm Your PIN'}
                    </Text>
                    <Text className="text-slate-600 text-center">
                        {step === 'create'
                            ? 'Choose a secure 4-digit PIN for your transactions.'
                            : 'Re-enter your PIN to confirm.'}
                    </Text>
                </View>

                <View className="mb-10 w-full items-center">
                    <View className="flex-row gap-4 mb-4">
                        {[...Array(4)].map((_, i) => (
                            <View
                                key={i}
                                className={`w-4 h-4 rounded-full ${(step === 'create' ? pin.length : confirmPin.length) > i
                                        ? 'bg-primary'
                                        : 'bg-gray-200 border border-gray-300'
                                    }`}
                            />
                        ))}
                    </View>

                    <TextInput
                        className="w-full h-full absolute opacity-0"
                        keyboardType="number-pad"
                        maxLength={4}
                        value={step === 'create' ? pin : confirmPin}
                        onChangeText={step === 'create' ? setPin : setConfirmPin}
                        autoFocus
                    />
                </View>

                <TouchableOpacity
                    className={`w-full h-14 rounded-full items-center justify-center ${(step === 'create' ? pin.length === 4 : confirmPin.length === 4)
                            ? 'bg-primary'
                            : 'bg-gray-300'
                        }`}
                    onPress={handleNext}
                    disabled={(step === 'create' ? pin.length : confirmPin.length) !== 4}
                >
                    <Text className="text-white font-bold text-lg">
                        {step === 'create' ? 'Continue' : 'Finish Setup'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
