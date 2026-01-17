import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function SupportScreen() {

    const handleContact = (type: 'whatsapp' | 'email' | 'phone') => {
        let url = '';
        switch (type) {
            case 'whatsapp':
                url = 'whatsapp://send?phone=2348000000000';
                break;
            case 'email':
                url = 'mailto:support@abumafhalhub.com';
                break;
            case 'phone':
                url = 'tel:+2348000000000';
                break;
        }
        Linking.openURL(url).catch(() => {
            // Handle error (e.g. app not installed)
        });
    };

    const FAQs = [
        { q: "How do I fund my wallet?", a: "You can fund your wallet via Bank Transfer or Card Payment in the 'Fund Wallet' section." },
        { q: "What if my transaction fails?", a: "If a transaction fails but you are debited, the amount will be refunded to your wallet automatically within 24 hours." },
        { q: "Is my card information safe?", a: "Yes, we use Paystack for payment processing. We do not store your card details." },
    ];

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Help & Support', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <Text className="text-slate font-bold mb-4 text-lg">Contact Us</Text>
                <View className="flex-row gap-4 mb-8">
                    <TouchableOpacity
                        className="flex-1 bg-green-50 p-4 rounded-xl items-center border border-green-100"
                        onPress={() => handleContact('whatsapp')}
                    >
                        <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
                        <Text className="text-green-700 font-bold mt-2">WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 bg-blue-50 p-4 rounded-xl items-center border border-blue-100"
                        onPress={() => handleContact('email')}
                    >
                        <Ionicons name="mail" size={32} color="#0056D2" />
                        <Text className="text-primary font-bold mt-2">Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 bg-orange-50 p-4 rounded-xl items-center border border-orange-100"
                        onPress={() => handleContact('phone')}
                    >
                        <Ionicons name="call" size={32} color="#F37021" />
                        <Text className="text-orange-600 font-bold mt-2">Call</Text>
                    </TouchableOpacity>
                </View>

                <Text className="text-slate font-bold mb-4 text-lg">Frequently Asked Questions</Text>
                <View className="gap-3">
                    {FAQs.map((faq, index) => (
                        <View key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <Text className="font-bold text-slate mb-2">{faq.q}</Text>
                            <Text className="text-gray-600 text-sm leading-5">{faq.a}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
