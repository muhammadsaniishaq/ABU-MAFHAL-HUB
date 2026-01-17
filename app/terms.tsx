import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function TermsScreen() {
    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Terms & Conditions', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <Text className="font-bold text-lg text-slate mb-2">1. Introduction</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    Welcome to Abu Mafhal Hub. By using our app, you agree to these terms. Please read them carefully.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">2. Services</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    We provide VTU services including Airtime, Data, Cable TV subscriptions, and Electricity bill payments. We act as a platform connecting you to these service providers.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">3. User Responsibility</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    You are responsible for maintaining the confidentiality of your account credentials, including your PIN and Password. Any transaction performed with your credentials is considered authorized by you.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">4. Payments & Refunds</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    All payments are final. Refunds are only processed for failed transactions where value was not delivered. Wallet funding via bank transfer is automated but may be subject to bank delays.
                </Text>

                <Text className="font-bold text-lg text-slate mb-2">5. Termination</Text>
                <Text className="text-gray-600 mb-6 leading-6">
                    We reserve the right to suspend or terminate your account if we suspect fraudulent activity or violation of these terms.
                </Text>

                <Text className="text-gray-400 text-xs text-center mt-8 mb-12">
                    Last updated: January 2026
                </Text>
            </ScrollView>
        </View>
    );
}
