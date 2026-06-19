import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
    const [profile, setProfile] = useState<{ full_name: string; email: string; username?: string; custom_id?: string; avatar_url?: string; kyc_tier?: number } | null>(null);
    const [kycStatus, setKycStatus] = useState<'pending' | 'approved' | 'none'>('none');
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
                // Fetch Profile
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (data) setProfile(data);

                // Check for Pending KYC
                const { data: requests } = await supabase
                    .from('kyc_requests')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('status', 'pending')
                    .limit(1);
                
                if (requests && requests.length > 0) {
                    setKycStatus('pending');
                } else {
                    setKycStatus('approved'); // Default to approved (meaning no pending request)
                }
            }
        } catch (e) {
            console.log("Error fetching profile", e);
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to logout?");
            if (confirmed) {
                performLogout();
            }
        } else {
            Alert.alert(
                "Logout",
                "Are you sure you want to logout?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Logout", style: "destructive", onPress: performLogout }
                ]
            );
        }
    };

    const performLogout = async () => {
        await forceSignOut();
        
        // Explicitly navigate for Web/Native to ensure we don't get stuck on a protected screen
        // while the auth state propagates
        if (Platform.OS === 'web') {
            window.location.href = '/'; // Hard reload is safest for clearing state on Web
        } else {
            router.replace('/');
        }
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
        { icon: 'shield-checkmark-outline', label: 'KYC Verification', route: '/kyc', isKyc: true },
        { icon: 'document-lock-outline', label: 'Privacy Policy', route: '/privacy' },
        { icon: 'document-text-outline', label: 'Terms & Conditions', route: '/terms' },
    ];

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                className="pt-16 pb-10 px-6 items-center rounded-b-[40px] shadow-lg z-10"
            >
                 <View className="w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-4 border-2 border-white/30 backdrop-blur-md overflow-hidden relative">
                    {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                    ) : (
                         <Text className="text-4xl font-bold text-white">{profile?.full_name?.charAt(0) || 'U'}</Text>
                    )}
                    {/* Tier Badge inside Avatar */}
                    <View className="absolute bottom-0 right-0 bg-green-500 w-6 h-6 rounded-full items-center justify-center border border-white">
                        <Text className="text-white text-[10px] font-bold">{profile?.kyc_tier || 1}</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-bold mb-1">{profile?.full_name || 'User'}</Text>
                 <Text className="text-indigo-200 font-medium text-sm mb-1">@{profile?.username || 'username'}</Text>
                 
                 <View className="flex-row gap-2 mt-2">
                    <View className="bg-white/10 px-3 py-1 rounded-full border border-white/20">
                        <Text className="text-white text-xs font-bold tracking-widest">ID: {profile?.custom_id || 'Generating...'}</Text>
                    </View>
                    {kycStatus === 'pending' && (
                        <View className="bg-orange-500/20 px-3 py-1 rounded-full border border-orange-400">
                            <Text className="text-orange-300 text-xs font-bold tracking-widest">PENDING REVIEW</Text>
                        </View>
                    )}
                 </View>
            </LinearGradient>

            <ScrollView className="flex-1 px-6 -mt-6" contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 mb-8 overflow-hidden z-20">
                    {menuItems.map((item: any, index) => (
                        <TouchableOpacity
                            key={index}
                            className={`flex-row items-center py-4 px-4 ${index !== menuItems.length - 1 ? 'border-b border-slate-50' : ''}`}
                            onPress={() => item.route && router.push(item.route as any)}
                        >
                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${index === 0 ? 'bg-indigo-100' : 'bg-slate-50'}`}>
                                <Ionicons name={item.icon as any} size={20} color={index === 0 ? '#4f46e5' : '#64748b'} />
                            </View>
                            <Text className={`flex-1 font-semibold text-[15px] ${index === 0 ? 'text-indigo-600' : 'text-slate-700'}`}>{item.label}</Text>
                            
                            {/* Alert/Status Logic */}
                            {item.isKyc && (
                                <View className="mr-2">
                                    {kycStatus === 'pending' ? (
                                        <View className="bg-orange-100 px-2 py-1 rounded-md">
                                            <Text className="text-orange-600 text-[10px] font-bold uppercase">Pending</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-green-100 px-2 py-1 rounded-md">
                                            <Text className="text-green-600 text-[10px] font-bold uppercase">Tier {profile?.kyc_tier || 1}</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    className="flex-row items-center justify-center bg-red-50 p-4 rounded-2xl mb-12 border border-red-100 active:bg-red-100 z-50 shadow-sm"
                    onPress={handleLogout}
                     style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
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
