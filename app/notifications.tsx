import { View, Text, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const NOTIFICATIONS = [
    { id: '1', title: 'Wallet Funded', message: 'Your wallet has been credited with ₦20,000.00 via Paystack.', date: '2 mins ago', type: 'success', icon: 'wallet' },
    { id: '2', title: 'Data Purchase Successful', message: 'You purchased 1GB MTN SME for 08030000000.', date: '1 hour ago', type: 'success', icon: 'wifi' },
    { id: '3', title: 'System Maintenance', message: 'MTN SME service will be down from 12AM to 2AM for maintenance.', date: 'Yesterday', type: 'warning', icon: 'construct' },
    { id: '4', title: 'Welcome!', message: 'Welcome to Abu Mafhal Hub! Enjoy cheap data and airtime.', date: 'Jan 10', type: 'info', icon: 'rocket' },
];

export default function NotificationsScreen() {
    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Notifications', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <FlatList
                data={NOTIFICATIONS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100 flex-row">
                        <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 
                            ${item.type === 'success' ? 'bg-green-100' : item.type === 'warning' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                            <Ionicons
                                name={item.icon as any}
                                size={20}
                                color={item.type === 'success' ? '#107C10' : item.type === 'warning' ? '#F37021' : '#0056D2'}
                            />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row justify-between items-start">
                                <Text className="font-bold text-slate text-base mb-1">{item.title}</Text>
                                <Text className="text-xs text-gray-400">{item.date}</Text>
                            </View>
                            <Text className="text-gray-600 text-sm leading-5">{item.message}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
                        <Text className="text-gray-400 mt-4">No notifications yet</Text>
                    </View>
                }
            />
        </View>
    );
}
