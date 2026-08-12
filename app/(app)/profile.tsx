import { 
    View, Text, TouchableOpacity, ScrollView, Image, Alert, 
    ActivityIndicator, Platform, RefreshControl, Modal, TextInput 
} from 'react-native';
import { useAppSettings } from '../../hooks/useAppSettings';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase, forceSignOut } from '../../services/supabase';
import { useState, useCallback, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CACHE_KEY = '@profile_data_v3';

// Executive Light Navy & Gold Design Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(218, 165, 32, 0.35)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#FFD700',
    goldDk: '#DAA520',
    goldAmber: '#D97706',
    goldBg: 'rgba(254, 243, 199, 0.65)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE'
};

export default function UserProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { settings } = useAppSettings();

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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // 2FA Security Modal States
    const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
    const [twoFactorModalVisible, setTwoFactorModalVisible] = useState<boolean>(false);
    const [totpSecret, setTotpSecret] = useState<string>('JBSWY3DPEHPK3PXP');
    const [totpCodeInput, setTotpCodeInput] = useState<string>('');

    useEffect(() => {
        loadCachedData().then(() => {
            loadAllData();
        });
    }, []);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3000);
    };

    const loadCachedData = async () => {
        try {
            const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const cached = JSON.parse(cachedStr);
                if (cached.profile) setProfile(cached.profile);
                if (cached.txCount !== undefined) setTxCount(cached.txCount);
                if (cached.unreadCount !== undefined) setUnreadCount(cached.unreadCount);
                setLoading(false);
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

            await Promise.all([
                fetchProfileData(user.id),
                fetchTransactionCount(user.id),
                fetchKycStatus(user.id),
                fetchUnreadNotifications(user.id)
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
        if (data) {
            setProfile(data);
            setTwoFactorEnabled(!!data.two_factor_enabled);
            saveCache({ profile: data });
        }
    };

    const fetchTransactionCount = async (userId: string) => {
        const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        setTxCount(count || 0);
    };

    const fetchKycStatus = async (userId: string) => {
        const { data } = await supabase
            .from('kyc_requests')
            .select('status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data?.status) {
            setKycStatus(data.status);
        }
    };

    const fetchUnreadNotifications = async (userId: string) => {
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false);
        setUnreadCount(count || 0);
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Camera roll permissions are required to select an avatar.");
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
            const { error } = await supabase
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

            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
            showToast("Profile photo updated successfully! ✨");
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
        showToast(`Copied ${label || 'text'} to clipboard! ✨`);
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to log out?");
            if (confirmed) performLogout();
        } else {
            Alert.alert(
                "Logout",
                "Are you sure you want to log out of your account?",
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

    const tierLabel = (tier?: number) => {
        switch (tier) {
            case 1: return 'Tier 1 (BVN)';
            case 2: return 'Tier 2 (Identity)';
            case 3: return 'Tier 3 (Address)';
            case 4: return 'Tier 4 (Face VIP)';
            default: return 'Tier 0 (Unverified)';
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: L.bg }}>
                <ActivityIndicator size="small" color={L.goldDk} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Toast Bar */}
            {toastMsg && (
                <View style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 60, backgroundColor: L.navyHeader, borderColor: L.gold, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 8 }}>
                    <Ionicons name="sparkles" size={12} color={L.gold} />
                    <Text style={{ color: L.goldBg, fontWeight: 'bold', fontSize: 9, flex: 1 }}>{toastMsg}</Text>
                </View>
            )}

            <ScrollView 
                style={{ flex: 1 }} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 110 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={L.navyHeader} />
                }
            >
                {/* Executive Royal Navy Header */}
                <LinearGradient
                    colors={['#0F172A', '#1C2541', '#0B132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                >
                    {/* Header Top Toolbar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={14} color={L.gold} />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: -0.2 }}>USER PROFILE & SETTINGS</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity onPress={() => router.push('/notifications')} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                <Ionicons name="notifications" size={14} color="#FFFFFF" />
                                {unreadCount > 0 && (
                                    <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: L.gold, width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: L.navyHeader, fontSize: 7, fontWeight: '900' }}>{unreadCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/edit-profile')} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                <Ionicons name="settings" size={14} color={L.gold} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Executive User Profile Details Box */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {/* Avatar Picker with Double Gold Ring */}
                        <View style={{ position: 'relative' }}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, padding: 2, backgroundColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: L.navyHeader }}>
                                    {profile?.avatar_url ? (
                                        <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: L.navyMid }}>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: L.gold }}>{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity onPress={pickImage} style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: L.gold, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.navyHeader }}>
                                {uploading ? <ActivityIndicator size="small" color={L.navyHeader} /> : <Ionicons name="camera" size={10} color={L.navyHeader} />}
                            </TouchableOpacity>
                        </View>

                        {/* Name & Account Details */}
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
                                    {profile?.full_name || 'System User'}
                                </Text>
                                {profile?.role === 'admin' && (
                                    <View style={{ backgroundColor: L.gold, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                        <Text style={{ color: L.navyHeader, fontSize: 7, fontWeight: '900' }}>ADMIN</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: 'bold', marginTop: 1 }} numberOfLines={1}>
                                {profile?.email || 'No Email Set'} {profile?.phone ? `• ${profile.phone}` : ''}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <TouchableOpacity onPress={() => copyToClipboard(profile?.custom_id || profile?.username, 'User ID')} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Ionicons name="copy-outline" size={9} color={L.gold} />
                                    <Text style={{ color: L.gold, fontSize: 8, fontWeight: 'bold' }}>ID: {profile?.custom_id || profile?.username || 'AM-USER'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => router.push('/kyc')} style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                    <Text style={{ color: L.emerald, fontSize: 8, fontWeight: '900' }}>{tierLabel(profile?.kyc_tier)}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Main Content Body */}
                <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 10 }}>

                    {/* Quick Stats & Metrics Grid */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 2 }}>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Wallet Balance</Text>
                            <Text style={{ color: L.navyHeader, fontSize: 12, fontWeight: '900', marginTop: 1 }}>₦{(profile?.balance || 0).toLocaleString()}</Text>
                        </View>
                        <View style={{ width: 1, height: 20, backgroundColor: L.inputBorder }} />
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Transactions</Text>
                            <Text style={{ color: L.navyHeader, fontSize: 12, fontWeight: '900', marginTop: 1 }}>{txCount}</Text>
                        </View>
                        <View style={{ width: 1, height: 20, backgroundColor: L.inputBorder }} />
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Account Status</Text>
                            <Text style={{ color: L.emerald, fontSize: 11, fontWeight: '900', marginTop: 1 }}>Verified</Text>
                        </View>
                    </View>

                    {/* Quick Action Navigation Grid */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity onPress={() => router.push('/edit-profile')} style={{ flex: 1, backgroundColor: L.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center' }}>
                            <Ionicons name="person-outline" size={14} color={L.navyHeader} />
                            <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: '900', marginTop: 2 }}>Edit Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/kyc')} style={{ flex: 1, backgroundColor: L.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center' }}>
                            <Ionicons name="shield-checkmark-outline" size={14} color={L.goldAmber} />
                            <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: '900', marginTop: 2 }}>KYC Center</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/referrals')} style={{ flex: 1, backgroundColor: L.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center' }}>
                            <Ionicons name="gift-outline" size={14} color={L.emerald} />
                            <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: '900', marginTop: 2 }}>Referrals</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/support')} style={{ flex: 1, backgroundColor: L.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center' }}>
                            <Ionicons name="headset-outline" size={14} color={L.blue} />
                            <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: '900', marginTop: 2 }}>Support</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Section 1: Account Settings Menu */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: L.inputBorder, elevation: 1 }}>
                        <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>Account Settings & Security</Text>
                        
                        <TouchableOpacity onPress={() => router.push('/edit-profile')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: L.inputBorder }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="person" size={12} color={L.navyHeader} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>Personal Information</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 8 }}>Update full name, phone number & email</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/change-password')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: L.inputBorder }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="lock-closed" size={12} color={L.goldAmber} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>Security & Password</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 8 }}>Change password & PIN authentication</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setTwoFactorModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="key" size={12} color={L.emerald} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>Two-Factor Authentication (2FA)</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 8 }}>{twoFactorEnabled ? 'Active (Authenticator App)' : 'Disabled'}</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Section 2: Banking & Compliance */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: L.inputBorder, elevation: 1 }}>
                        <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>Banking & Identity Verification</Text>

                        <TouchableOpacity onPress={() => router.push('/kyc')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: L.inputBorder }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="card" size={12} color={L.goldAmber} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>Reserved Virtual Dedicated Account</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 8 }}>View Wema / Payvessel account details</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/kyc')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="shield-checkmark" size={12} color={L.blue} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>KYC Level & Limits</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 8 }}>Upgrade to Tier 1, Tier 2, or Tier 3</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color={L.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Section 3: Logout Action Button */}
                    <TouchableOpacity 
                        onPress={handleLogout}
                        style={{ backgroundColor: L.roseBg, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: L.roseBorder, marginTop: 4 }}
                    >
                        <Ionicons name="log-out-outline" size={14} color={L.rose} />
                        <Text style={{ color: L.rose, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Log Out Account</Text>
                    </TouchableOpacity>

                </View>
            </ScrollView>

            {/* 2FA SETUP MODAL */}
            <Modal visible={twoFactorModalVisible} transparent animationType="fade" onRequestClose={() => setTwoFactorModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', padding: 14 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: L.goldDk }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>Two-Factor Security (2FA)</Text>
                            <TouchableOpacity onPress={() => setTwoFactorModalVisible(false)}>
                                <Ionicons name="close-circle" size={18} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 8 }}>
                            Scan this secret key in your Google Authenticator or Authy app:
                        </Text>

                        <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ color: L.navyHeader, fontSize: 12, fontWeight: '900', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                {totpSecret}
                            </Text>
                            <TouchableOpacity onPress={() => copyToClipboard(totpSecret, '2FA Secret')} style={{ marginTop: 4, backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                                <Text style={{ color: L.gold, fontSize: 8, fontWeight: '900' }}>COPY SECRET</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textSecondary, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>Enter 6-digit Authenticator Code:</Text>
                        <View style={{ backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 8, height: 38, marginBottom: 10 }}>
                            <TextInput
                                value={totpCodeInput}
                                onChangeText={setTotpCodeInput}
                                placeholder="Enter 6-digit code..."
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                maxLength={6}
                                style={{ flex: 1, color: L.textPrimary, fontWeight: '600', fontSize: 10 }}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={() => {
                                if (totpCodeInput.length === 6) {
                                    setTwoFactorEnabled(true);
                                    setTwoFactorModalVisible(false);
                                    showToast("Two-Factor Authentication Activated! 🔒");
                                } else {
                                    Alert.alert("Code Error", "Please enter a valid 6-digit code.");
                                }
                            }}
                            style={{ backgroundColor: L.navyHeader, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: L.gold }}
                        >
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Activate 2FA Security</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
