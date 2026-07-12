import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useState, useCallback, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
const CACHE_KEY = '@profile_data_v2';

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
        role?: string;
    } | null>(null);
    const [kycStatus, setKycStatus] = useState<'pending' | 'approved' | 'none'>('none');
    const [txCount, setTxCount] = useState<number>(0);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [appLogo, setAppLogo] = useState<string | null>(null);
    const [appName, setAppName] = useState<string>('ABU MAFHAL');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        loadCachedData().then(() => {
            loadAllData();
        });
    }, []);

    const loadCachedData = async () => {
        try {
            const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const cached = JSON.parse(cachedStr);
                
                // Stale check (1 hour limit)
                const cacheAgeMs = Date.now() - (cached.updatedAt || 0);
                const IS_CACHE_STALE = cacheAgeMs > 60 * 60 * 1000;
                
                if (cached.profile) setProfile(cached.profile);
                if (cached.txCount !== undefined) setTxCount(cached.txCount);
                if (cached.unreadCount !== undefined) setUnreadCount(cached.unreadCount);
                if (cached.appLogo) setAppLogo(cached.appLogo);
                if (cached.appName) setAppName(cached.appName);
                
                if (!IS_CACHE_STALE) {
                    if (cached.kycStatus) setKycStatus(cached.kycStatus);
                }
                
                setLoading(false); // Instantly ready
            }
        } catch (e) {
            console.warn("Cache read error:", e);
        }
    };

    const saveCache = async (data: any) => {
        try {
            const currentCacheStr = await AsyncStorage.getItem(CACHE_KEY);
            const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
            const newCache = { ...currentCache, ...data, updatedAt: Date.now() };
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
        } catch (e) {
            console.warn("Cache write error:", e);
        }
    };

    const loadAllData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch everything concurrently
            await Promise.all([
                fetchProfileData(user.id),
                fetchTransactionCount(user.id),
                fetchKycStatus(user.id),
                fetchUnreadNotifications(user.id),
                fetchAppSettings()
            ]);
        } catch (e) {
            console.log("Error loading profile data", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAllData();
    }, []);

    const fetchProfileData = async (userId: string) => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (error) console.error("Profile fetch error:", error);
        if (data) {
            setProfile(data);
            saveCache({ profile: data });
        }
    };

    const fetchUnreadNotifications = async (userId: string) => {
        const { count, error } = await supabase.from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        if (!error && count !== null) {
            setUnreadCount(count);
            saveCache({ unreadCount: count });
        }
    };

    const fetchAppSettings = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('key, value').in('key', ['app_logo', 'app_name']);
            if (data) {
                let logoUrl = null;
                let name = 'ABU MAFHAL';
                data.forEach(setting => {
                    if (setting.key === 'app_logo') {
                        logoUrl = setting.value?.url || setting.value || null;
                    }
                    if (setting.key === 'app_name') {
                        name = setting.value?.name || setting.value || 'ABU MAFHAL';
                    }
                });
                if (logoUrl) setAppLogo(logoUrl);
                setAppName(name);
                saveCache({ appLogo: logoUrl, appName: name });
            }
        } catch (e) {
            console.warn("Failed to fetch app settings:", e);
        }
    };

    const fetchKycStatus = async (userId: string) => {
        const { data: requests } = await supabase
            .from('kyc_requests')
            .select('id, status')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .limit(1);
        
        let newStatus: 'pending' | 'approved' | 'none' = 'none';
        if (requests && requests.length > 0) {
            newStatus = 'pending';
        } else {
            newStatus = 'approved';
        }
        setKycStatus(newStatus);
        saveCache({ kycStatus: newStatus });
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
            saveCache({ txCount: count || 0 });
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
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#020617" }}>
                <ActivityIndicator size="large" color="#f5a623" />
            </View>
        );
    }

    const [balanceWhole, balanceDecimal] = formatCurrency(profile?.balance);

    return (
        <View style={{ flex: 1, backgroundColor: "#f8f9fc" }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <ScrollView 
                style={{ flex: 1 }} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 160 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5a623" />
                }
            >
                
                {/* 1. CURVED HEADER GRADIENT */}
                <LinearGradient
                    colors={['#060d21', '#0d1b3e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 72, paddingHorizontal: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, position: 'relative' }}
                >
                    {/* Background Gold Mesh Glow */}
                    <LinearGradient
                        colors={['rgba(245, 166, 35, 0.12)', 'rgba(245, 166, 35, 0)']}
                        style={{ position: 'absolute', top: -96, right: -96, width: 288, height: 288, borderRadius: 144 }}
                        pointerEvents="none"
                    />

                    {/* Decorative Bottom Gold Line */}
                    <View className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f5a623] opacity-80" style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }} />

                    {/* Top Row: Page Title & Action Icons */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', padding: 2 }}>
                                {appLogo ? (
                                    <Image 
                                        source={{ uri: appLogo }} 
                                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <Image 
                                        source={require('../../assets/images/logo-icon.png')} 
                                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                        resizeMode="cover"
                                    />
                                )}
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: 'white', letterSpacing: 0.5 }}>{appName}</Text>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {/* Notification Bell */}
                            <TouchableOpacity 
                                onPress={() => router.push('/notifications')} 
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', position: 'relative' }}
                            >
                                <Ionicons name="notifications" size={18} color="white" />
                                {unreadCount > 0 && (
                                    <View style={{ position: 'absolute', top: -1, right: -1, backgroundColor: '#f5a623', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#060d21' }}>
                                        <Text className="text-white text-[8px] font-black">{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                    </View>
                                )}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Avatar Picker Container with Double Gold Ring */}
                        <View style={{ position: 'relative' }}>
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
                                                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Text style={{ fontSize: 20, fontWeight: '900', color: 'white' }}>{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
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
                        <View style={{ marginLeft: 16, flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: -0.5, maxWidth: 200 }} numberOfLines={1}>
                                    {profile?.full_name || 'User'}
                                </Text>
                                <Ionicons name="ribbon" size={16} color="#f5a623" />
                            </View>
                            
                            <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                                {profile?.phone || profile?.email || 'No Contact Details'}
                            </Text>
                            
                            {/* Verification Pill */}
                            <View style={{ flexDirection: 'row' }}>
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

                {/* 2. FLOATING STATS CARD (Single Row - Thin/Compact) */}
                <View style={{ backgroundColor: '#ffffff', marginHorizontal: 20, borderRadius: 16, marginTop: -24, paddingVertical: 12, paddingHorizontal: 6, shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 6, zIndex: 20, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
                    
                    {/* Wallet Balance */}
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                            <Ionicons name="wallet" size={12} color="#f5a623" />
                        </View>
                        <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '900' }} numberOfLines={1}>₦{balanceWhole}</Text>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Balance</Text>
                    </View>

                    {/* Divider */}
                    <View style={{ width: 1, height: 32, backgroundColor: '#f1f5f9' }} />

                    {/* Total Transactions */}
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                            <Ionicons name="swap-horizontal" size={12} color="#f5a623" />
                        </View>
                        <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '900' }} numberOfLines={1}>{txCount}</Text>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Transacts</Text>
                    </View>

                    {/* Divider */}
                    <View style={{ width: 1, height: 32, backgroundColor: '#f1f5f9' }} />

                    {/* Member Since */}
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                            <Ionicons name="calendar" size={12} color="#f5a623" />
                        </View>
                        <Text style={{ fontSize: 11, color: '#1e293b', fontWeight: '900' }} numberOfLines={1}>{getMemberSince(profile?.created_at)}</Text>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Joined</Text>
                    </View>

                    {/* Divider */}
                    <View style={{ width: 1, height: 32, backgroundColor: '#f1f5f9' }} />

                    {/* Account Tier */}
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                            <Ionicons name="ribbon" size={12} color="#f5a623" />
                        </View>
                        <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '900' }} numberOfLines={1}>{getTierLabel(profile?.kyc_tier)}</Text>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Tier</Text>
                    </View>
                </View>

                {/* 3. GROUPED LIST GROUPS */}
                <View style={{ marginTop: 24, paddingHorizontal: 24, gap: 20 }}>
                    


                    {/* ACCOUNT SECTION */}
                    <View>
                        <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Account</Text>
                        <View style={{ backgroundColor: "white", borderRadius: 16, shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2, overflow: "hidden" }}>
                            {/* Personal Info */}
                            <TouchableOpacity 
                                onPress={() => router.push('/edit-profile')} 
                                activeOpacity={0.7}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="person" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Personal Information</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>View and update your personal details</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Bank Accounts */}
                            <TouchableOpacity 
                                onPress={() => router.push('/beneficiaries')} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="business" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Bank Accounts</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Manage your linked bank accounts</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Security */}
                            <TouchableOpacity 
                                onPress={() => router.push('/security')} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="shield-checkmark" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Security</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Password, PIN and security settings</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Verification */}
                            <TouchableOpacity 
                                onPress={() => router.push('/kyc')} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="checkmark-done-circle" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Verification</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>KYC verification and account status</Text>
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

                            {/* Refer & Earn */}
                            <TouchableOpacity 
                                onPress={() => router.push('/referrals')} 
                                activeOpacity={0.7}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(245, 166, 35, 0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="gift" size={14} color="#f5a623" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Refer & Earn</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Invite friends and earn rewards</Text>
                                </View>
                                <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginRight: 6 }}>
                                    <Text style={{ color: '#d97706', fontSize: 8, fontWeight: '900' }}>NEW</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* PREFERENCES SECTION */}
                    <View>
                        <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Preferences</Text>
                        <View style={{ backgroundColor: "white", borderRadius: 16, shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2, overflow: "hidden" }}>
                            {/* Notification Settings */}
                            <TouchableOpacity 
                                onPress={() => router.push('/notifications')} 
                                activeOpacity={0.7}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="notifications" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Notification Settings</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Manage your notification preferences</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Language */}
                            <TouchableOpacity 
                                onPress={handleLanguageSelect} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="globe" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Language</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Choose your preferred language</Text>
                                </View>
                                <Text className="text-slate-400 text-[11px] font-bold mr-1">English</Text>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Theme */}
                            <TouchableOpacity 
                                onPress={handleThemeSelect} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="moon" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Theme</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Choose app appearance</Text>
                                </View>
                                <Text className="text-slate-400 text-[11px] font-bold mr-1">System</Text>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* SUPPORT & ABOUT SECTION */}
                    <View>
                        <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Support & About</Text>
                        <View style={{ backgroundColor: "white", borderRadius: 16, shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2, overflow: "hidden" }}>
                            {/* Help Center */}
                            <TouchableOpacity 
                                onPress={() => router.push('/support')} 
                                activeOpacity={0.7}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="headset" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Help Center</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Get help and support</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* About Mafhal Sub */}
                            <TouchableOpacity 
                                onPress={() => router.push('/about')} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="information-circle" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>About Mafhal Sub</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Learn more about us</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Terms & Conditions */}
                            <TouchableOpacity 
                                onPress={() => router.push('/terms')} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(13, 27, 62, 0.04)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="document-text" size={14} color="#0d1b3e" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#1e293b" }}>Terms & Conditions</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Read our terms and conditions</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                            </TouchableOpacity>

                            {/* Log Out */}
                            <TouchableOpacity 
                                onPress={handleLogout} 
                                activeOpacity={0.6}
                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(239, 68, 68, 0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                    <Ionicons name="log-out" size={14} color="#ef4444" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "700", fontSize: 13, color: "#ef4444" }}>Log Out</Text>
                                    <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "500", marginTop: 2 }}>Sign out from your account</Text>
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
