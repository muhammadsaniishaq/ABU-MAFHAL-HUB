import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />

            <View className="flex-1 items-center justify-center px-6">
                <View className="w-full aspect-square items-center justify-center mb-10 overflow-hidden relative">
                    <Image
                        source={require('../assets/images/logo.png')}
                        className="w-32 h-32 rounded-full"
                        resizeMode="contain"
                    />
                </View>

                <Text className="text-3xl font-bold text-slate text-center mb-4">
                    Fast & Secure Payments
                </Text>
                <Text className="text-gray-500 text-center text-lg leading-7 mb-12">
                    Pay bills, buy airtime, and transfer money securely within seconds. Experience the future of fintech with Abu Mafhal Hub.
                </Text>

                <TouchableOpacity
                    className="w-full h-16 bg-primary rounded-full items-center justify-center shadow-lg shadow-blue-200"
                    onPress={() => router.push('/(auth)/signup')}
                >
                    <Text className="text-white font-bold text-xl">Get Started</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
