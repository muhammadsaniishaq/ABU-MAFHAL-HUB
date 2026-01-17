import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function OTPScreen() {
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const [code, setCode] = useState('');
    const [timer, setTimer] = useState(60);
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleVerify = () => {
        if (code.length === 6) {
            // Mock verification success
            router.push('/(auth)/pin-setup');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <StatusBar style="dark" />
            <View className="flex-1 px-6 pt-12">
                <View className="mb-8">
                    <Text className="text-primary text-2xl font-bold mb-2">Verify Phone</Text>
                    <Text className="text-slate-600">
                        We sent a 6-digit code to <Text className="font-bold">{phone}</Text>
                    </Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-primary mt-1 font-medium">Change Number</Text>
                    </TouchableOpacity>
                </View>

                <View className="mb-6">
                    <TextInput
                        className="border-b-2 border-gray-300 text-3xl font-bold text-center h-16 tracking-[10px]"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={code}
                        onChangeText={setCode}
                        autoFocus
                        placeholder="000000"
                        placeholderTextColor="#E5E7EB"
                    />
                </View>

                <TouchableOpacity
                    className={`h-14 rounded-full items-center justify-center ${code.length === 6 ? 'bg-primary' : 'bg-gray-300'}`}
                    onPress={handleVerify}
                    disabled={code.length !== 6}
                >
                    <Text className="text-white font-bold text-lg">Verify</Text>
                </TouchableOpacity>

                <View className="mt-6 items-center">
                    {timer > 0 ? (
                        <Text className="text-gray-500">Resend code in {timer}s</Text>
                    ) : (
                        <TouchableOpacity onPress={() => setTimer(60)}>
                            <Text className="text-primary font-bold">Resend Code</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
