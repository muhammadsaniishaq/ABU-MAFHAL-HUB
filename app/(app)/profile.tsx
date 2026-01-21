import { View, Text, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useEffect, useState } from 'react';

// ... (code)

// ... imports ...

export default function ProfileScreen() {
    const [profile, setProfile] = useState<{ full_name: string; email: string; role: string; phone?: string } | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (data) setProfile(data);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await forceSignOut();
                        router.replace('/(auth)/login');
                    }
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
                    <Text className="text-3xl font-bold text-primary">{profile?.full_name?.charAt(0) || 'U'}</Text>
                </View>
                <Text className="text-white text-xl font-bold">{profile?.full_name || 'User'}</Text>
                <Text className="text-blue-100">{profile?.email || 'email@example.com'}</Text>
            </View>

            <ScrollView className="flex-1 px-6 -mt-4">
                <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-8 mt-4">
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
                    <Text className="text-gray-400 text-xs">Version 1.0.1</Text>
                    <Text className="text-gray-400 text-xs">Abu Mafhal Hub</Text>
                </View>
            </ScrollView>
            <StatusBar style="light" />
        </View>
    );
}
