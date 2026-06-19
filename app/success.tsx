import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

export default function SuccessScreen() {
    const router = useRouter();
    const { amount, type } = useLocalSearchParams();

    // Prevent back button from going back to form
    useEffect(() => {
        const backAction = () => {
            router.replace('/(app)/dashboard');
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, []);

    return (
        <View className="flex-1 bg-green-600 items-center justify-center px-6">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <View className="w-32 h-32 bg-white/20 rounded-full items-center justify-center mb-8 animate-bounce">
                <Ionicons name="checkmark" size={64} color="white" />
            </View>

            <Text className="text-white text-3xl font-bold mb-2">Success!</Text>
            <Text className="text-green-100 text-lg text-center mb-8">
                Your transaction has been processed successfully.
            </Text>

            <View className="bg-white/10 w-full rounded-2xl p-6 mb-12 border border-white/20">
                <View className="flex-row justify-between mb-4 border-b border-white/20 pb-4">
                    <Text className="text-green-100">Amount</Text>
                    <Text className="text-white font-bold text-lg">{amount || '₦0.00'}</Text>
                </View>
                <View className="flex-row justify-between">
                    <Text className="text-green-100">Transaction Type</Text>
                    <Text className="text-white font-bold">{type || 'Payment'}</Text>
                </View>
            </View>

            <TouchableOpacity
                className="w-full h-14 bg-white rounded-full items-center justify-center mb-4"
                onPress={() => router.replace('/(app)/dashboard')}
            >
                <Text className="text-green-700 font-bold text-lg">Back to Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="py-4"
                onPress={() => router.replace('/(app)/history')}
            >
                <Text className="text-green-100 font-bold">View Receipt</Text>
            </TouchableOpacity>
        </View>
    );
}
