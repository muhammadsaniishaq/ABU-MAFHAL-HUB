import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const MOCK_HISTORY = [
    { id: '1', type: 'Airtime', title: 'Airtime Purchase', subtitle: 'MTN - 08030000000', amount: '-₦1,000.00', status: 'Success', date: 'Today, 9:41 AM', icon: 'phone-portrait', color: '#F37021' },
    { id: '2', type: 'Data', title: 'Data Bundle', subtitle: 'Glo - 1GB', amount: '-₦500.00', status: 'Success', date: 'Yesterday, 4:30 PM', icon: 'wifi', color: '#008080' },
    { id: '3', type: 'Transfer', title: 'Transfer to Musa', subtitle: 'GTBank - 0123456789', amount: '-₦5,000.00', status: 'Success', date: 'Jan 14, 2:15 PM', icon: 'send', color: '#0056D2' },
    { id: '4', type: 'Deposit', title: 'Wallet Top Up', subtitle: 'Paystack', amount: '+₦20,000.00', status: 'Success', date: 'Jan 12, 10:00 AM', icon: 'wallet', color: '#107C10' },
    { id: '5', type: 'Electricity', title: 'Electricity Bill', subtitle: 'Ikeja Electric', amount: '-₦3,000.00', status: 'Failed', date: 'Jan 10, 8:20 PM', icon: 'flash', color: '#D97706' },
];

export default function HistoryScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header if not handled by tabs, but tabs usually handle it. 
                However, layout says headerShown: false, so we need a header here or in layout options.
                Layout has title: 'History' in options, but headerShown: false on Tabs.
                Wait, Tabs screenOptions says headerShown: false. 
                Individual screens have options.
                But usually we want a header. 
                I will add a custom header or SafeAreaView.
            */}
            <Stack.Screen options={{ headerShown: false }} />

            <View className="pt-12 px-6 pb-4 bg-white border-b border-gray-200">
                <Text className="text-2xl font-bold text-slate">History</Text>
            </View>

            <FlatList
                data={MOCK_HISTORY}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        className="flex-row justify-between items-center bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100"
                        onPress={() => router.push(`/transaction-details/${item.id}`)}
                    >
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: item.color + '20' }}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>
                            <View>
                                <Text className="font-bold text-gray-800 text-base">{item.title}</Text>
                                <Text className="text-sm text-gray-500">{item.subtitle}</Text>
                                <Text className="text-xs text-gray-400 mt-1">{item.date}</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className={`font-bold text-base ${item.amount.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                                {item.amount}
                            </Text>
                            <Text className={`text-xs mt-1 ${item.status === 'Success' ? 'text-green-500' : 'text-red-500'}`}>
                                {item.status}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
            <StatusBar style="dark" />
        </View>
    );
}
