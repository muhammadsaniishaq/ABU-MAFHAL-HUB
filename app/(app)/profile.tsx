import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
    const [profile, setProfile] = useState<{ full_name: string; email: string; username?: string; custom_id?: string; avatar_url?: string } | null>(null);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (data) setProfile(data);
            }
        } catch (e) {
            console.log("Error fetching profile", e);
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
                        // router.replace('/(auth)/login'); // Let _layout.tsx handle the redirect state change
                    }
                }
            ]
        );
    };

    const menuItems = [
        { icon: 'person-outline', label: 'Edit Profile', route: '/edit-profile' },
        { icon: 'sparkles-outline', label: 'Cotex AI Assistant', route: '/ai-chat' },
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
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                className="pt-16 pb-10 px-6 items-center rounded-b-[40px] shadow-lg"
            >
                 <View className="w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-4 border-2 border-white/30 backdrop-blur-md overflow-hidden">
                    {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                    ) : (
                         <Text className="text-4xl font-bold text-white">{profile?.full_name?.charAt(0) || 'U'}</Text>
                    )}
                </View>
                <Text className="text-white text-2xl font-bold mb-1">{profile?.full_name || 'User'}</Text>
                 <Text className="text-indigo-200 font-medium text-sm mb-1">@{profile?.username || 'username'}</Text>
                 <View className="bg-white/10 px-3 py-1 rounded-full border border-white/20 mt-2">
                    <Text className="text-white text-xs font-bold tracking-widest">ID: {profile?.custom_id || 'Generating...'}</Text>
                 </View>
            </LinearGradient>

            <ScrollView className="flex-1 px-6 -mt-6">
                <View className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 mb-8 overflow-hidden">
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            className={`flex-row items-center py-4 px-4 ${index !== menuItems.length - 1 ? 'border-b border-slate-50' : ''}`}
                            onPress={() => item.route && router.push(item.route as any)}
                        >
                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${index === 0 ? 'bg-indigo-100' : 'bg-slate-50'}`}>
                                <Ionicons name={item.icon as any} size={20} color={index === 0 ? '#4f46e5' : '#64748b'} />
                            </View>
                            <Text className={`flex-1 font-semibold text-[15px] ${index === 0 ? 'text-indigo-600' : 'text-slate-700'}`}>{item.label}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    className="flex-row items-center justify-center bg-red-50 p-4 rounded-2xl mb-12 border border-red-100 active:bg-red-100"
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    <Text className="text-red-500 font-bold ml-2 text-base">Logout</Text>
                </TouchableOpacity>

                <View className="items-center mb-8">
                    <Text className="text-slate-400 text-xs font-medium">Version 1.0.1 • Abu Mafhal Hub</Text>
                </View>
            </ScrollView>
            <StatusBar style="light" />
        </View>
    );
}
