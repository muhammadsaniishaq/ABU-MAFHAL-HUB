import { 
    View, Text, TouchableOpacity, ScrollView, Image, Alert, 
    ActivityIndicator, Platform, RefreshControl 
} from 'react-native';
import { useAppSettings } from '../../hooks/useAppSettings';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useState, useCallback, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InstallAppButton from '../../components/InstallAppButton';

const CACHE_KEY = '@profile_data_v9';

// Executive Royal Navy & 24K Gold Design System
const L = {
    bg: '#F3F5FA',
    card: '#FFFFFF',
    cardBorder: 'rgba(226, 232, 240, 0.9)',
    navyHeader: '#070E24',
    navyMid: '#121F45',
    navyLight: '#1E3264',
    gold: '#F5A623',
    goldLight: '#FCD34D',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: '#FEF3C7',
    goldBorder: 'rgba(245, 166, 35, 0.45)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#EF4444',
    roseBg: '#FEF2F2',
    roseBorder: '#FECACA',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE'
};

export default function UserProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { settings } = useAppSettings();

    // Default Profile State (Instant render)
    const [profile, setProfile] = useState<{ 
        full_name: string; 
        email: string; 
        phone?: string; 
        username?: string; 
        custom_id?: string; 
        referral_code?: string;
        avatar_url?: string; 
        kyc_tier?: number; 
        balance?: number; 
        created_at?: string;
        role?: string;
    }>({
        full_name: 'User Profile',
        email: 'Loading details...',
        kyc_tier: 0,
        balance: 0
    });

    const [virtualAcc, setVirtualAcc] = useState<any>(null);
    const [txCount, setTxCount] = useState<number>(0);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    useEffect(() => {
        loadCachedData();
        loadAllData();
    }, []);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    };

    const loadCachedData = async () => {
        try {
            const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const cached = JSON.parse(cachedStr);
                if (cached.profile) setProfile(cached.profile);
                if (cached.txCount !== undefined) setTxCount(cached.txCount);
                if (cached.unreadCount !== undefined) setUnreadCount(cached.unreadCount);
                if (cached.virtualAcc) setVirtualAcc(cached.virtualAcc);
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

            fetchProfileData(user.id);
            fetchVirtualAccount(user.id);
            fetchTransactionCount(user.id);
            fetchUnreadNotifications(user.id);
        } catch (e) {
            console.log("Background profile sync:", e);
        } finally {
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAllData();
    }, []);

    const fetchProfileData = async (userId: string) => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            if (data && !error) {
                setProfile(data);
                saveCache({ profile: data });
            }
        } catch (e) {
            console.warn("fetchProfileData error:", e);
        }
    };

    const fetchVirtualAccount = async (userId: string) => {
        try {
            const { data, error } = await supabase.from('virtual_accounts').select('*').eq('user_id', userId).maybeSingle();
            if (data && !error) {
                setVirtualAcc(data);
                saveCache({ virtualAcc: data });
            }
        } catch (e) {
            console.warn("fetchVirtualAccount error:", e);
        }
    };

    const fetchTransactionCount = async (userId: string) => {
        try {
            const { count, error } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            if (count !== null && count !== undefined && !error) {
                setTxCount(count);
                saveCache({ txCount: count });
            }
        } catch (e) {
            console.warn("fetchTransactionCount error:", e);
        }
    };

    const fetchUnreadNotifications = async (userId: string) => {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('read', false);
            if (count !== null && count !== undefined && !error) {
                setUnreadCount(count);
                saveCache({ unreadCount: count });
            }
        } catch (e) {
            console.warn("fetchUnreadNotifications error:", e);
        }
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Camera roll permissions are required to change your avatar.");
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
            let publicUrl = `data:image/jpeg;base64,${image.base64}`;

            try {
                const { error } = await supabase
                    .storage
                    .from('avatars')
                    .upload(fileName, decode(image.base64), {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (!error) {
                    const { data: { publicUrl: storageUrl } } = supabase
                        .storage
                        .from('avatars')
                        .getPublicUrl(fileName);
                    if (storageUrl) publicUrl = storageUrl;
                }
            } catch (storageErr) {
                console.warn("Avatar storage upload fallback:", storageErr);
            }

            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
            showToast("Profile photo updated! ✨");
        } catch (error: any) {
            Alert.alert("Upload Failed", error.message);
        } finally {
            setUploading(false);
        }
    };

    const copyToClipboard = (text?: string, label?: string) => {
        if (!text) return;
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            Clipboard.setString(text);
        }
        showToast(`Copied ${label || 'text'}! ✨`);
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to log out safely?")) performLogout();
        } else {
            Alert.alert(
                "Exit Session",
                "Are you sure you want to securely log out of your account?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Log Out", style: "destructive", onPress: performLogout }
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

    const tierLimitText = (tier?: number) => {
        switch (tier) {
            case 1: return 'Tier 1 (₦100k)';
            case 2: return 'Tier 2 (₦500k)';
            case 3: return 'Tier 3 (₦5M)';
            case 4: return 'Tier 4 (VIP)';
            default: return 'Tier 0 (Unverified)';
        }
    };

    const refLink = `https://abumafhal.com.ng/signup?ref=${profile?.referral_code || profile?.username || profile?.custom_id || ''}`;

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Mobile-First Shell (100% on Mobile, Max 500px on Web/Tablet) */}
            <View style={{ flex: 1, width: '100%', maxWidth: 500, backgroundColor: L.bg }}>
                
                {/* Micro Toast */}
                {toastMsg && (
                    <View style={{ 
                        position: 'absolute', 
                        top: insets.top + 6, 
                        left: 14, 
                        right: 14, 
                        zIndex: 99, 
                        backgroundColor: L.navyHeader, 
                        borderColor: L.gold, 
                        borderWidth: 1, 
                        borderRadius: 10, 
                        paddingHorizontal: 12, 
                        paddingVertical: 7, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 6, 
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 10 
                    }}>
                        <Ionicons name="sparkles" size={13} color={L.gold} />
                        <Text style={{ color: L.goldBg, fontWeight: '700', fontSize: 11, flex: 1 }}>{toastMsg}</Text>
                    </View>
                )}

                {/* SINGLE SCREEN CONTAINER (CIF A SHAFI DAYA - Zero Overflow, Ends Exactly Above Bottom Bar) */}
                <ScrollView 
                    style={{ flex: 1 }} 
                    bounces={false}
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ 
                        flexGrow: 1, 
                        justifyContent: 'space-between',
                        paddingBottom: Platform.OS === 'ios' ? 94 : 84 
                    }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={L.gold} />
                    }
                >
                    <View style={{ width: '100%' }}>
                        
                        {/* 1. LUXURY ROYAL NAVY & GOLD DECORATIVE HEADER */}
                        <LinearGradient
                            colors={['#050B1A', '#0B132B', '#142258']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ 
                                paddingTop: insets.top + 2, 
                                paddingBottom: 10, 
                                paddingHorizontal: 12, 
                                borderBottomLeftRadius: 20, 
                                borderBottomRightRadius: 20, 
                                borderBottomWidth: 1.5, 
                                borderColor: L.goldBorder,
                                shadowColor: '#070E24',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.15,
                                shadowRadius: 8,
                                elevation: 6
                            }}
                        >
                            {/* Header Bar */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <TouchableOpacity 
                                    onPress={() => router.back()} 
                                    style={{ 
                                        width: 30, 
                                        height: 30, 
                                        borderRadius: 9, 
                                        backgroundColor: 'rgba(255,255,255,0.08)', 
                                        borderWidth: 1, 
                                        borderColor: L.goldBorder, 
                                        alignItems: 'center', 
                                        justifyContent: 'center' 
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="arrow-back" size={15} color={L.gold} />
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <MaterialCommunityIcons name="shield-crown" size={14} color={L.gold} />
                                    <Text style={{ fontSize: 12.5, fontWeight: '900', color: L.gold, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                                        Profile Hub
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <TouchableOpacity 
                                        onPress={() => router.push('/notifications')} 
                                        style={{ 
                                            width: 30, 
                                            height: 30, 
                                            borderRadius: 9, 
                                            backgroundColor: 'rgba(255,255,255,0.08)', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            borderWidth: 1, 
                                            borderColor: 'rgba(255,255,255,0.15)' 
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="notifications-outline" size={15} color="#FFFFFF" />
                                        {unreadCount > 0 && (
                                            <View style={{ position: 'absolute', top: 3, right: 3, backgroundColor: L.gold, width: 7, height: 7, borderRadius: 3.5 }} />
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => router.push('/edit-profile')} 
                                        style={{ 
                                            width: 30, 
                                            height: 30, 
                                            borderRadius: 9, 
                                            backgroundColor: 'rgba(255,255,255,0.08)', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            borderWidth: 1, 
                                            borderColor: L.goldBorder 
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="pencil" size={13} color={L.gold} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* User Identity Row with Double Gold Rim Avatar */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ position: 'relative' }}>
                                    <LinearGradient
                                        colors={[L.goldLight, L.gold, L.goldDk]}
                                        style={{ width: 48, height: 48, borderRadius: 24, padding: 1.5, alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <View style={{ width: 45, height: 45, borderRadius: 22.5, overflow: 'hidden', backgroundColor: L.navyHeader }}>
                                            {profile?.avatar_url && typeof profile.avatar_url === 'string' && profile.avatar_url.trim().length > 5 ? (
                                                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                            ) : (
                                                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: L.navyMid }}>
                                                    <Text style={{ fontSize: 17, fontWeight: '900', color: L.gold }}>
                                                        {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </LinearGradient>

                                    <TouchableOpacity 
                                        onPress={pickImage} 
                                        style={{ 
                                            position: 'absolute', 
                                            bottom: -1, 
                                            right: -1, 
                                            backgroundColor: L.gold, 
                                            width: 16, 
                                            height: 16, 
                                            borderRadius: 8, 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            borderWidth: 1, 
                                            borderColor: L.navyHeader 
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        {uploading ? (
                                            <ActivityIndicator size="small" color={L.navyHeader} />
                                        ) : (
                                            <Ionicons name="camera" size={8.5} color={L.navyHeader} />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }} numberOfLines={1}>
                                            {profile?.full_name || 'System User'}
                                        </Text>
                                        {profile?.role === 'admin' ? (
                                            <View style={{ backgroundColor: L.gold, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                                                <Text style={{ color: L.navyHeader, fontSize: 7, fontWeight: '900' }}>ADMIN</Text>
                                            </View>
                                        ) : (
                                            <Ionicons name="checkmark-circle" size={12} color={L.emerald} />
                                        )}
                                    </View>

                                    <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '600', marginTop: 0.5 }} numberOfLines={1}>
                                        {profile?.email || 'No Email Set'} {profile?.phone ? `• ${profile.phone}` : ''}
                                    </Text>

                                    {/* Copyable ID & KYC Pill Row */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                                        <TouchableOpacity 
                                            onPress={() => copyToClipboard(profile?.custom_id || profile?.username, 'User ID')} 
                                            style={{ 
                                                backgroundColor: 'rgba(255,255,255,0.09)', 
                                                paddingHorizontal: 5, 
                                                paddingVertical: 1.5, 
                                                borderRadius: 4, 
                                                flexDirection: 'row', 
                                                alignItems: 'center', 
                                                gap: 2.5 
                                            }}
                                        >
                                            <Ionicons name="copy-outline" size={8} color={L.gold} />
                                            <Text style={{ color: L.gold, fontSize: 8, fontWeight: '800' }}>
                                                ID: {profile?.custom_id || profile?.username || 'AM-USER'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            onPress={() => router.push('/kyc')} 
                                            style={{ 
                                                backgroundColor: Number(profile?.kyc_tier || 0) >= 2 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 166, 35, 0.18)', 
                                                paddingHorizontal: 5, 
                                                paddingVertical: 1.5, 
                                                borderRadius: 4, 
                                                borderWidth: 0.8, 
                                                borderColor: Number(profile?.kyc_tier || 0) >= 2 ? L.emeraldBorder : L.goldBorder,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 2.5
                                            }}
                                        >
                                            <Ionicons 
                                                name={Number(profile?.kyc_tier || 0) >= 2 ? "shield-checkmark" : "shield-outline"} 
                                                size={8} 
                                                color={Number(profile?.kyc_tier || 0) >= 2 ? L.emerald : L.gold} 
                                            />
                                            <Text style={{ color: Number(profile?.kyc_tier || 0) >= 2 ? L.emerald : L.gold, fontSize: 8, fontWeight: '900' }}>
                                                {tierLimitText(profile?.kyc_tier)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>

                        {/* 2. BODY PANELS (Clustered & Neatly Unified - YA TSUKE A WAJE DAYA) */}
                        <View style={{ paddingHorizontal: 10, paddingTop: 6, gap: 6 }}>

                            {/* PANEL A: UNIFIED FINANCIAL & VIRTUAL BANK ACCOUNT CARD */}
                            <View style={{ 
                                backgroundColor: L.card, 
                                borderRadius: 12, 
                                padding: 8, 
                                borderWidth: 1, 
                                borderColor: L.goldBorder,
                                shadowColor: '#070E24',
                                shadowOffset: { width: 0, height: 1.5 },
                                shadowOpacity: 0.06,
                                shadowRadius: 3,
                                elevation: 2 
                            }}>
                                {/* Top Half: Mini Stats (Balance, Tx Count, Status) */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 6, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                                    <View style={{ alignItems: 'center', flex: 1 }}>
                                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Wallet Balance</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 12.5, fontWeight: '900', marginTop: 1 }}>
                                            ₦{Number(profile?.balance || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={{ width: 1, height: 16, backgroundColor: '#E2E8F0' }} />
                                    <View style={{ alignItems: 'center', flex: 1 }}>
                                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Transactions</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 12.5, fontWeight: '900', marginTop: 1 }}>
                                            {txCount}
                                        </Text>
                                    </View>
                                    <View style={{ width: 1, height: 16, backgroundColor: '#E2E8F0' }} />
                                    <View style={{ alignItems: 'center', flex: 1 }}>
                                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Account Status</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: L.emerald }} />
                                            <Text style={{ color: L.emerald, fontSize: 10.5, fontWeight: '900' }}>Active</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Bottom Half: Dedicated Virtual Bank Deposit Account */}
                                <View style={{ paddingTop: 5 }}>
                                    {virtualAcc ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#EDF2F7' }}>
                                            <View>
                                                <Text style={{ color: L.navyHeader, fontSize: 12, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                                    {virtualAcc.account_number}
                                                </Text>
                                                <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '700' }}>
                                                    {virtualAcc.bank_name || 'Wema Bank / Payvessel'} • {virtualAcc.account_name || profile.full_name}
                                                </Text>
                                            </View>
                                            <TouchableOpacity 
                                                onPress={() => copyToClipboard(virtualAcc.account_number, 'Account Number')} 
                                                style={{ 
                                                    backgroundColor: L.navyHeader, 
                                                    paddingHorizontal: 7, 
                                                    paddingVertical: 3, 
                                                    borderRadius: 4, 
                                                    borderWidth: 0.8, 
                                                    borderColor: L.gold 
                                                }}
                                            >
                                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 8 }}>COPY</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity 
                                            onPress={() => router.push('/kyc')} 
                                            style={{ backgroundColor: L.goldBg, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                        >
                                            <Text style={{ color: L.goldAmber, fontWeight: '800', fontSize: 9 }}>
                                                Verify Tier 2 (BVN/NIN) to activate instant virtual account
                                            </Text>
                                            <Ionicons name="arrow-forward" size={11} color={L.goldAmber} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* PANEL B: 4 BALANCED QUICK TOUCH ACTION CHIPS */}
                            <View style={{ flexDirection: 'row', gap: 5 }}>
                                <TouchableOpacity 
                                    onPress={() => router.push('/profile-details')} 
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: L.card, 
                                        paddingVertical: 6, 
                                        borderRadius: 8, 
                                        borderWidth: 1, 
                                        borderColor: L.cardBorder, 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        gap: 1.5 
                                    }}
                                >
                                    <Ionicons name="person-circle-outline" size={15} color={L.navyHeader} />
                                    <Text style={{ color: L.navyHeader, fontSize: 8.5, fontWeight: '800' }}>Profile Info</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => router.push('/kyc')} 
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: L.card, 
                                        paddingVertical: 6, 
                                        borderRadius: 8, 
                                        borderWidth: 1, 
                                        borderColor: L.cardBorder, 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        gap: 1.5 
                                    }}
                                >
                                    <Ionicons name="shield-checkmark" size={15} color={L.goldAmber} />
                                    <Text style={{ color: L.navyHeader, fontSize: 8.5, fontWeight: '800' }}>KYC Level</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => router.push('/referrals')} 
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: L.card, 
                                        paddingVertical: 6, 
                                        borderRadius: 8, 
                                        borderWidth: 1, 
                                        borderColor: L.cardBorder, 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        gap: 1.5 
                                    }}
                                >
                                    <Ionicons name="gift-outline" size={15} color={L.emerald} />
                                    <Text style={{ color: L.navyHeader, fontSize: 8.5, fontWeight: '800' }}>Earn ₦500</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => router.push('/support')} 
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: L.card, 
                                        paddingVertical: 6, 
                                        borderRadius: 8, 
                                        borderWidth: 1, 
                                        borderColor: L.cardBorder, 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        gap: 1.5 
                                    }}
                                >
                                    <Ionicons name="chatbubbles-outline" size={15} color={L.blue} />
                                    <Text style={{ color: L.navyHeader, fontSize: 8.5, fontWeight: '800' }}>Support</Text>
                                </TouchableOpacity>
                            </View>

                            {/* PANEL C: UNIFIED SETTINGS & SECURITY CARD */}
                            <View style={{ 
                                backgroundColor: L.card, 
                                borderRadius: 12, 
                                paddingHorizontal: 10, 
                                paddingVertical: 3, 
                                borderWidth: 1, 
                                borderColor: L.cardBorder, 
                                elevation: 1 
                            }}>
                                <Text style={{ color: L.navyHeader, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', marginTop: 4, marginBottom: 1, letterSpacing: 0.3 }}>
                                    Account & Credentials
                                </Text>

                                {/* 1. Profile Details (Opens View Details Screen) */}
                                <TouchableOpacity 
                                    onPress={() => router.push('/profile-details')} 
                                    style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        paddingVertical: 7, 
                                        borderBottomWidth: 1, 
                                        borderColor: '#F1F5F9' 
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="person-outline" size={13} color={L.navyHeader} />
                                        </View>
                                        <View>
                                            <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '800' }}>Profile Details</Text>
                                            <Text style={{ color: L.textMuted, fontSize: 8 }}>View verified credentials & account data</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                                </TouchableOpacity>

                                {/* 2. Consolidated Security Center (PIN, Password, Biometrics & 2FA) */}
                                <TouchableOpacity 
                                    onPress={() => router.push('/security')} 
                                    style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        paddingVertical: 7 
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: L.emeraldBg, borderWidth: 1, borderColor: L.emeraldBorder, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="shield-checkmark" size={13} color={L.emerald} />
                                        </View>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '800' }}>Security & Credentials</Text>
                                                <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 3.5, paddingVertical: 0.8, borderRadius: 2.5 }}>
                                                    <Text style={{ color: L.emerald, fontSize: 7, fontWeight: '900' }}>PROTECTED</Text>
                                                </View>
                                            </View>
                                            <Text style={{ color: L.textMuted, fontSize: 8 }}>4-digit PIN, login password, 2FA & biometrics</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* PANEL D: REFERRAL PROGRAM COMPACT STRIP */}
                            <View style={{ 
                                backgroundColor: L.card, 
                                borderRadius: 10, 
                                paddingVertical: 4.5, 
                                paddingHorizontal: 8, 
                                borderWidth: 1, 
                                borderColor: L.cardBorder, 
                                elevation: 1 
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="gift" size={11} color={L.emerald} />
                                        <Text style={{ color: L.navyHeader, fontSize: 8.5, fontWeight: '900' }}>
                                            Referral Link <Text style={{ color: L.goldAmber }}>(Earn ₦500)</Text>
                                        </Text>
                                    </View>
                                    {Platform.OS === 'web' && <InstallAppButton />}
                                </View>
                                
                                <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, borderWidth: 0.8, borderColor: '#E2E8F0' }}>
                                    <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                        {refLink}
                                    </Text>
                                    <TouchableOpacity 
                                        onPress={() => copyToClipboard(refLink, 'Referral Link')}
                                        style={{ backgroundColor: L.navyHeader, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginLeft: 4 }}
                                    >
                                        <Text style={{ color: L.gold, fontSize: 7.5, fontWeight: '900' }}>COPY</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* PANEL E: EXECUTIVE LOG OUT BUTTON (Sitting cleanly right above bottom bar) */}
                            <TouchableOpacity 
                                onPress={handleLogout}
                                style={{ 
                                    backgroundColor: L.roseBg, 
                                    borderRadius: 9, 
                                    paddingVertical: 7.5, 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    flexDirection: 'row', 
                                    gap: 4, 
                                    borderWidth: 1, 
                                    borderColor: L.roseBorder 
                                }}
                            >
                                <Ionicons name="log-out-outline" size={13} color={L.rose} />
                                <Text style={{ color: L.rose, fontWeight: '900', fontSize: 9.5, textTransform: 'uppercase' }}>
                                    Log Out Account
                                </Text>
                            </TouchableOpacity>

                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}
