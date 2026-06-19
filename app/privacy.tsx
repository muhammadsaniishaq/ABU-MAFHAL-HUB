import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function PrivacyScreen() {
    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Privacy Policy', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <Text className="font-bold text-lg text-slate mb-2">1. Data Collection</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    We collect personal information such as your name, email address, and phone number when you create an account to provide our services.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">2. Use of Information</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    Your data is used to process transactions, send notifications, and improve our services. We do not sell your personal data to third parties.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">3. Payment Security</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    We use secure third-party payment processors (Paystack). We do not store your full credit/debit card details on our servers.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">4. User Rights</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    You have the right to access, correct, or delete your personal information. Contact support for assistance with data inquiries.
                </Text>

                <Text className="text-gray-400 text-xs text-center mt-8 mb-12">
                    Effective Date: January 1, 2026
                </Text>
            </ScrollView>
        </View>
    );
}
