import { View, Text, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ProfileScreen() {
    const router = useRouter();

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: () => router.replace('/(auth)/login')
                }
            ]
        );
    };

    const menuItems = [
        { icon: 'person-outline', label: 'Edit Profile', route: '/edit-profile' },
        { icon: 'lock-closed-outline', label: 'Security', route: '/security' },
        { icon: 'card-outline', label: 'Saved Cards', route: '/saved-cards' },
        { icon: 'people-outline', label: 'Beneficiaries', route: '/beneficiaries' },
        { icon: 'gift-outline', label: 'Refer & Earn', route: '/referrals' },
        { icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
        { icon: 'headset-outline', label: 'Support & Help', route: '/support' },
        { icon: 'shield-checkmark-outline', label: 'KYC Verification', route: '/kyc' },
        { icon: 'document-lock-outline', label: 'Privacy Policy', route: '/privacy' },
        { icon: 'document-text-outline', label: 'Terms & Conditions', route: '/terms' },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="bg-primary pt-16 pb-8 px-6 items-center rounded-b-3xl">
                <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-4 border-4 border-white/30">
                    <Text className="text-3xl font-bold text-primary">AM</Text>
                </View>
                <Text className="text-white text-xl font-bold">Abu Mafhal</Text>
                <Text className="text-blue-100">0803 000 0000</Text>
            </View>

            <ScrollView className="flex-1 px-6 -mt-4">
                {/* Admin Access Point */}
                <TouchableOpacity
                    className="bg-slate-900 mb-6 p-4 rounded-2xl flex-row items-center shadow-lg shadow-slate-900/20"
                    onPress={() => router.push('/admin')}
                >
                    <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center mr-4">
                        <Ionicons name="shield-checkmark" size={20} color="#38BDF8" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-bold text-lg">Admin Console</Text>
                        <Text className="text-slate-400 text-xs">Manage Users & Transactions</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#64748B" />
                </TouchableOpacity>

                <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-8">
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            className={`flex-row items-center py-4 ${index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''}`}
                            onPress={() => item.route && router.push(item.route as any)}
                        >
                            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-4">
                                <Ionicons name={item.icon as any} size={20} color="#2C3E50" />
                            </View>
                            <Text className="flex-1 text-slate font-medium text-base">{item.label}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    className="flex-row items-center justify-center bg-red-50 p-4 rounded-xl mb-12 border border-red-100"
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text className="text-red-500 font-bold ml-2 text-lg">Logout</Text>
                </TouchableOpacity>

                <View className="items-center mb-8">
                    <Text className="text-gray-400 text-xs">Version 1.0.0</Text>
                    <Text className="text-gray-400 text-xs">Abu Mafhal Hub</Text>
                </View>
            </ScrollView>
            <StatusBar style="light" />
        </View>
    );
}
