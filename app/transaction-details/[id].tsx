import { View, Text, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function TransactionDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Mock data based on ID - in real app fetch from API
    const transaction = {
        id: id || '12345678',
        amount: '₦1,000.00',
        type: 'Airtime Purchase',
        status: 'Success',
        date: 'Jan 16, 2026 10:30 AM',
        reference: 'REF-8374829374',
        details: {
            'Network': 'MTN',
            'Phone Number': '0803 000 0000',
            'Balance Before': '₦51,200.00',
            'Balance After': '₦50,200.00'
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Transaction Receipt\nAmount: ${transaction.amount}\nType: ${transaction.type}\nRef: ${transaction.reference}\nStatus: ${transaction.status}`,
            });
        } catch (error) { }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Transaction Details', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 items-center mb-6">
                    <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                        <Ionicons name="checkmark" size={32} color="#107C10" />
                    </View>
                    <Text className="text-2xl font-bold text-slate mb-1">{transaction.amount}</Text>
                    <Text className="text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full text-xs uppercase mb-6">
                        {transaction.status}
                    </Text>

                    <Text className="text-gray-400 text-xs mb-8">
                        {transaction.date}
                    </Text>

                    <View className="w-full border-t border-gray-100 pt-6 gap-4">
                        <View className="flex-row justify-between">
                            <Text className="text-gray-500">Transaction Type</Text>
                            <Text className="font-bold text-slate">{transaction.type}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-gray-500">Reference</Text>
                            <Text className="font-bold text-slate text-xs">{transaction.reference}</Text>
                        </View>
                        {Object.entries(transaction.details).map(([key, value]) => (
                            <View key={key} className="flex-row justify-between">
                                <Text className="text-gray-500">{key}</Text>
                                <Text className="font-bold text-slate">{value}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <TouchableOpacity
                    className="bg-primary py-4 rounded-xl items-center mb-4"
                    onPress={handleShare}
                >
                    <Text className="text-white font-bold">Share Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="bg-white border border-red-100 py-4 rounded-xl items-center"
                    onPress={() => {
                        Alert.alert("Report Issue", "Contacting support about this transaction...");
                        router.push('/support');
                    }}
                >
                    <Text className="text-red-500 font-bold">Report Issue</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
