import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function ProfileScreen() {
    const [profile, setProfile] = useState<{ 
        full_name: string; 
        email: string; 
        phone?: string; 
        username?: string; 
        custom_id?: string; 
        avatar_url?: string; 
        kyc_tier?: number; 
        balance?: number; 
        created_at?: string;
    } | null>(null);
    const [kycStatus, setKycStatus] = useState<'pending' | 'approved' | 'none'>('none');
    const [txCount, setTxCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
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
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (error) throw error;
                if (data) {
                    setProfile(data);
                    // Fetch Transaction count for current month
                    await fetchTransactionCount(user.id);
                }

                // Check for Pending KYC
                const { data: requests } = await supabase
                    .from('kyc_requests')
                    .select('id, status')
                    .eq('user_id', user.id)
                    .eq('status', 'pending')
                    .limit(1);
                
                if (requests && requests.length > 0) {
                    setKycStatus('pending');
                } else {
                    setKycStatus('approved');
                }
            }
        } catch (e) {
            console.log("Error fetching profile", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactionCount = async (userId: string) => {
        try {
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const { count, error } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'success')
                .gte('created_at', startOfMonth);
            if (error) throw error;
            setTxCount(count || 0);
        } catch (e) {
            console.log("Error fetching transaction count:", e);
        }
    };

    const pickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permission Denied", "You need to allow access to your photos to upload an avatar.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                await uploadImage(result.assets[0]);
            }
        } catch (error: any) {
            Alert.alert("Error", "Could not pick image: " + error.message);
        }
    };

    const uploadImage = async (image: ImagePicker.ImagePickerAsset) => {
        try {
            setUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (!image.base64) throw new Error('No image data');

            const fileName = `${user.id}/${Date.now()}.jpg`;
            const { data, error } = await supabase
                .storage
                .from('avatars')
                .upload(fileName, decode(image.base64), {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase
                .storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update profile with new avatar URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;
            
            setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
            Alert.alert("Success", "Profile photo updated successfully!");
        } catch (error: any) {
            Alert.alert("Upload Failed", error.message);
        } finally {
            setUploading(false);
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
        if (Platform.OS === 'web') {
            window.location.href = '/';
        } else {
            router.replace('/');
        }
    };

    const formatCurrency = (val?: number | string) => {
        if (val === undefined || val === null) return ['0', '00'];
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return ['0', '00'];
        const formatted = num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return formatted.split('.');
    };

    const getMemberSince = (createdAtString?: string) => {
        if (!createdAtString) return 'May 2024';
        const date = new Date(createdAtString);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const getTierLabel = (tier?: number) => {
        switch (tier) {
            case 1:
                return 'Standard';
            case 2:
                return 'Silver';
            case 3:
                return 'Gold';
            case 4:
                return 'Premium';
            default:
                return 'Standard';
        }
    };

    const handleLanguageSelect = () => {
        Alert.alert(
            "Select Language",
            "Choose your preferred language",
            [
                { text: "English", onPress: () => console.log("Language set to English") },
                { text: "Hausa", onPress: () => console.log("Language set to Hausa") },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handleThemeSelect = () => {
        Alert.alert(
            "Select Theme",
            "Choose app appearance",
            [
                { text: "System Default", onPress: () => console.log("Theme set to System") },
                { text: "Light Mode", onPress: () => console.log("Theme set to Light") },
                { text: "Dark Mode", onPress: () => console.log("Theme set to Dark") },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-950">
                <ActivityIndicator size="large" color="#f5a623" />
            </View>
        );
    }

    const [balanceWhole, balanceDecimal] = formatCurrency(profile?.balance);

    return (
        <View className="flex-1 bg-[#f8f9fc]">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
                
                {/* 1. CURVED HEADER GRADIENT */}
                <LinearGradient
                    colors={['#060d21', '#0d1b3e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    className="pt-16 pb-24 px-6 rounded-b-[32px] shadow-xl relative"
                >
                    {/* Background Gold Mesh Glow */}
                    <LinearGradient
                        colors={['rgba(245, 166, 35, 0.12)', 'rgba(245, 166, 35, 0)']}
                        className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[80px] pointer-events-none"
                    />

                    {/* Decorative Bottom Gold Line */}
                    <View className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f5a623] opacity-80" style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }} />

                    {/* Top Row: Page Title & Action Icons */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center gap-2">
                            <Image 
                                source={require('../../assets/images/logo-icon.png')} 
                                className="w-8 h-8"
                                resizeMode="contain"
                            />
                            <View className="flex-col leading-none">
                                <Text className="text-white font-black text-sm tracking-wider leading-4">MAFHAL</Text>
                                <Text className="text-[#f5a623] font-bold text-[10px] tracking-widest leading-3">HUB</Text>
                            </View>
                        </View>
                        
                        <View className="flex-row items-center gap-3">
                            {/* Notification Bell */}
                            <TouchableOpacity 
                                onPress={() => router.push('/notifications')} 
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', position: 'relative' }}
                            >
                                <Ionicons name="notifications" size={18} color="white" />
                                <View style={{ position: 'absolute', top: -1, right: -1, backgroundColor: '#f5a623', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#060d21' }}>
                                    <Text className="text-white text-[8px] font-black">3</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Settings Cog */}
                            <TouchableOpacity 
                                onPress={() => router.push('/edit-profile')} 
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <Ionicons name="settings" size={18} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Profile Information Row (Horizontal Alignment) */}
                    <View className="flex-row items-center">
                        {/* Avatar Picker Container with Double Gold Ring */}
                        <View className="relative">
                            <View style={{ width: 72, height: 72, borderRadius: 36, padding: 3, backgroundColor: '#f5a623', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}>
                                <View style={{ width: 66, height: 66, borderRadius: 33, padding: 2, backgroundColor: '#0d1b3e', alignItems: 'center', justifyContent: 'center' }}>
                                    <View style={{ width: 62, height: 62, borderRadius: 31, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                        {profile?.avatar_url ? (
                                            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <LinearGradient
                                                colors={['#0d1b3e', '#f5a623']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                className="w-full h-full items-center justify-center"
                                            >
                                                <Text className="text-xl font-black text-white">{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
                                            </LinearGradient>
                                        )}
                                    </View>
                                </View>
                            </View>
                            {/* Tappable Camera Icon Overlay */}
                            <TouchableOpacity 
                                onPress={pickImage} 
                                disabled={uploading}
                                style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#f5a623', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 }}
                                activeOpacity={0.7}
                            >
                                {uploading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Ionicons name="camera" size={11} color="white" />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Name & Contact Info */}
                        <View className="ml-4 flex-1">
                            <View className="flex-row items-center gap-1.5 mb-0.5">
                                <Text className="text-white text-lg font-black tracking-tight max-w-[200px]" numberOfLines={1}>
                                    {profile?.full_name || 'User'}
                                </Text>
                                <Ionicons name="ribbon" size={16} color="#f5a623" />
                            </View>
                            
                            <Text className="text-slate-300 text-xs font-semibold mb-2">
                                {profile?.phone || profile?.email || 'No Contact Details'}
                            </Text>
                            
                            {/* Verification Pill */}
                            <View className="flex-row">
                                {profile?.kyc_tier && profile.kyc_tier > 1 ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 166, 35, 0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)', gap: 4 }}>
                                        <Ionicons name="shield-checkmark" size={10} color="#f5a623" />
                                        <Text style={{ color: '#f5a623', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>Verified Account</Text>
                                    </View>
                                ) : kycStatus === 'pending' ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)', gap: 4 }}>
                                        <Ionicons name="time" size={10} color="#f59e0b" />
                                        <Text style={{ color: '#f59e0b', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending Review</Text>
                                    </View>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', gap: 4 }}>
                                        <Ionicons name="alert-circle" size={10} color="#cbd5e1" />
                                        <Text style={{ color: '#cbd5e1', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unverified Profile</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* 2. FLOATING STATS CARD (2x2 Grid) */}
                <View style={{ backgroundColor: '#ffffff', marginHorizontal: 24, borderRadius: 16, padding: 16, marginTop: -40, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.25)', zIndex: 20 }}>
                    {/* Row 1 */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                        {/* Wallet Balance */}
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252, 249, 242, 0.8)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.15)', marginRight: 6 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="wallet-sharp" size={16} color="#f5a623" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Balance</Text>
                                <Text style={{ fontSize: 13, color: '#0d1b3e', fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
                                    ₦{balanceWhole}
                                    <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '500' }}>.{balanceDecimal}</Text>
                                </Text>
                            </View>
                        </View>

                        {/* Total Transactions */}
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252, 249, 242, 0.8)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.15)', marginLeft: 6 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="swap-horizontal-sharp" size={16} color="#f5a623" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Transactions</Text>
                                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
                                    {txCount} <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '500' }}>this mo</Text>
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Row 2 */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        {/* Member Since */}
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252, 249, 242, 0.8)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.15)', marginRight: 6 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="calendar-sharp" size={16} color="#f5a623" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Member Since</Text>
                                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
                                    {getMemberSince(profile?.created_at)}
                                </Text>
                            </View>
                        </View>

                        {/* Account Tier */}
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252, 249, 242, 0.8)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.15)', marginLeft: 6 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="ribbon-sharp" size={16} color="#f5a623" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tier</Text>
                                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
                                    {getTierLabel(profile?.kyc_tier)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 3. GROUPED LIST GROUPS */}
                <View className="mt-6 px-6 gap-y-5">
                    
                    {/* ACCOUNT SECTION */}
                    <View>
                        <Text className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-2 ml-1">Account</Text>
                        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {/* Personal Info */}
                            <TouchableOpacity 
                                onPress={() => router.push('/edit-profile')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="person" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Personal Information</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">View and update your personal details</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Bank Accounts */}
                            <TouchableOpacity 
                                onPress={() => router.push('/beneficiaries')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="business" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Bank Accounts</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Manage your linked bank accounts</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Security */}
                            <TouchableOpacity 
                                onPress={() => router.push('/security')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="shield-checkmark" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Security</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Password, PIN and security settings</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Verification */}
                            <TouchableOpacity 
                                onPress={() => router.push('/kyc')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="checkmark-done-circle" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Verification</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">KYC verification and account status</Text>
                                </View>
                                <View className="flex-row items-center mr-2">
                                    {profile?.kyc_tier && profile.kyc_tier > 1 ? (
                                        <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                            <Text className="text-emerald-600 text-[8px] font-black uppercase">Verified</Text>
                                        </View>
                                    ) : kycStatus === 'pending' ? (
                                        <View className="bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                            <Text className="text-amber-600 text-[8px] font-black uppercase">Pending</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                            <Text className="text-slate-500 text-[8px] font-black uppercase">Unverified</Text>
                                        </View>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* PREFERENCES SECTION */}
                    <View>
                        <Text className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-2 ml-1">Preferences</Text>
                        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {/* Notification Settings */}
                            <TouchableOpacity 
                                onPress={() => router.push('/notifications')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="notifications" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Notification Settings</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Manage your notification preferences</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Language */}
                            <TouchableOpacity 
                                onPress={handleLanguageSelect} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="globe" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Language</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Choose your preferred language</Text>
                                </View>
                                <Text className="text-slate-400 text-[11px] font-bold mr-1">English</Text>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Theme */}
                            <TouchableOpacity 
                                onPress={handleThemeSelect} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="moon" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Theme</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Choose app appearance</Text>
                                </View>
                                <Text className="text-slate-400 text-[11px] font-bold mr-1">System</Text>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* SUPPORT & ABOUT SECTION */}
                    <View>
                        <Text className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-2 ml-1">Support & About</Text>
                        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {/* Help Center */}
                            <TouchableOpacity 
                                onPress={() => router.push('/support')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="headset" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Help Center</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Get help and support</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* About Mafhal Hub */}
                            <TouchableOpacity 
                                onPress={() => router.push('/onboarding')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="information-circle" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">About Mafhal Hub</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Learn more about us</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Terms & Conditions */}
                            <TouchableOpacity 
                                onPress={() => router.push('/terms')} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4 border-b border-slate-50"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                    <Ionicons name="document-text" size={15} color="#0d1b3e" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-slate-800">Terms & Conditions</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Read our terms and conditions</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Log Out */}
                            <TouchableOpacity 
                                onPress={handleLogout} 
                                activeOpacity={0.6}
                                className="flex-row items-center py-3.5 px-4"
                            >
                                <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center mr-3">
                                    <Ionicons name="log-out" size={15} color="#ef4444" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-extrabold text-xs text-red-500">Log Out</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Sign out from your account</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>

            </ScrollView>
        </View>
    );
}
