import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Image, 
    ActivityIndicator, Platform, Alert 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

// Executive Royal Navy & Gold Theme
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    navyHeader: '#0B132B',
    navyMid: '#1C2541',
    navyLight: '#3A506B',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: '#FEF3C7',
    goldBorder: 'rgba(245, 166, 35, 0.4)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE'
};

export default function ProfileDetailsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [virtualAcc, setVirtualAcc] = useState<any>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Profile
            const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (profData) setProfile(profData);

            // 2. Fetch Virtual Account
            const { data: vaData } = await supabase
                .from('virtual_accounts')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (vaData) setVirtualAcc(vaData);
        } catch (e) {
            console.error("Profile details load error:", e);
        } finally {
            setLoading(false);
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

    const maskNumber = (val?: string) => {
        if (!val || val.length < 6) return val || 'Not Provided';
        return val.slice(0, 3) + '*****' + val.slice(-3);
    };

    const tierLabel = (tier?: number) => {
        switch (tier) {
            case 1: return 'Tier 1 (Basic • ₦100k Limit)';
            case 2: return 'Tier 2 (Verified • ₦500k Limit)';
            case 3: return 'Tier 3 (Enhanced • ₦5M Limit)';
            case 4: return 'Tier 4 (VIP • Unlimited)';
            default: return 'Tier 0 (Unverified)';
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Active Member';
        try {
            return new Date(dateStr).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const refLink = `https://abumafhal.com.ng/signup?ref=${profile?.referral_code || profile?.username || profile?.custom_id || ''}`;

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={L.gold} />
                <Text style={{ color: L.navyHeader, fontWeight: '700', fontSize: 12, marginTop: 10 }}>
                    Loading Profile Details...
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <View style={{ flex: 1, width: '100%', maxWidth: 540, backgroundColor: L.bg }}>
                
                {/* Micro Toast */}
                {toastMsg && (
                    <View style={{ 
                        position: 'absolute', 
                        top: insets.top + 8, 
                        left: 16, 
                        right: 16, 
                        zIndex: 99, 
                        backgroundColor: L.navyHeader, 
                        borderColor: L.gold, 
                        borderWidth: 1, 
                        borderRadius: 10, 
                        paddingHorizontal: 14, 
                        paddingVertical: 8, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 8,
                        elevation: 10 
                    }}>
                        <Ionicons name="sparkles" size={14} color={L.gold} />
                        <Text style={{ color: L.goldBg, fontWeight: '700', fontSize: 11, flex: 1 }}>{toastMsg}</Text>
                    </View>
                )}

                {/* Top Header */}
                <LinearGradient
                    colors={['#070D1E', '#0B132B', '#1C2541']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ 
                        paddingTop: insets.top + 6, 
                        paddingBottom: 14, 
                        paddingHorizontal: 16, 
                        borderBottomLeftRadius: 20, 
                        borderBottomRightRadius: 20, 
                        borderBottomWidth: 1.5, 
                        borderColor: L.goldBorder 
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TouchableOpacity 
                            onPress={() => router.back()} 
                            style={{ 
                                width: 34, 
                                height: 34, 
                                borderRadius: 10, 
                                backgroundColor: 'rgba(255,255,255,0.08)', 
                                borderWidth: 1, 
                                borderColor: L.goldBorder, 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="arrow-back" size={18} color={L.gold} />
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: L.gold, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                                Personal Profile Details
                            </Text>
                            <Text style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: '600' }}>Verified Account Information</Text>
                        </View>

                        <TouchableOpacity 
                            onPress={() => router.push('/edit-profile')} 
                            style={{ 
                                width: 34, 
                                height: 34, 
                                borderRadius: 10, 
                                backgroundColor: 'rgba(255,255,255,0.08)', 
                                borderWidth: 1, 
                                borderColor: L.goldBorder, 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="pencil" size={16} color={L.gold} />
                        </TouchableOpacity>
                    </View>

                    {/* Profile Identity Card */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
                        <View style={{ width: 62, height: 62, borderRadius: 31, padding: 2, backgroundColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: L.navyHeader }}>
                                {profile?.avatar_url && typeof profile.avatar_url === 'string' && profile.avatar_url.trim().length > 5 ? (
                                    <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: L.navyMid }}>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: L.gold }}>
                                            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
                                    {profile?.full_name || 'System User'}
                                </Text>
                                {profile?.role === 'admin' ? (
                                    <View style={{ backgroundColor: L.gold, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}>
                                        <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: '900' }}>ADMIN</Text>
                                    </View>
                                ) : (
                                    <Ionicons name="checkmark-circle" size={15} color={L.emerald} />
                                )}
                            </View>

                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
                                {profile?.username ? `@${profile.username}` : profile?.email}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 0.8, borderColor: L.emeraldBorder }}>
                                    <Text style={{ color: L.emerald, fontSize: 9.5, fontWeight: '800' }}>
                                        {tierLabel(profile?.kyc_tier)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Details Scroll Area */}
                <ScrollView 
                    style={{ flex: 1 }} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}
                >
                    {/* SECTION 1: PERSONAL & CONTACT INFORMATION */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <Ionicons name="person-outline" size={15} color={L.navyHeader} />
                            <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                Personal & Contact Information
                            </Text>
                        </View>

                        <DetailRow label="Full Legal Name" value={profile?.full_name || 'Not Provided'} />
                        <DetailRow label="Username" value={profile?.username ? `@${profile.username}` : 'Not Set'} />
                        <DetailRow 
                            label="Email Address" 
                            value={profile?.email || 'Not Provided'} 
                            onCopy={() => copyToClipboard(profile?.email, 'Email')}
                        />
                        <DetailRow 
                            label="Phone Number" 
                            value={profile?.phone || 'Not Provided'} 
                            onCopy={() => copyToClipboard(profile?.phone, 'Phone')}
                        />
                        <DetailRow label="Gender" value={profile?.gender ? profile.gender.toUpperCase() : 'Not Specified'} />
                        <DetailRow label="Date of Birth" value={profile?.dob || 'Not Specified'} />
                        <DetailRow label="State of Residence" value={profile?.state || 'Not Specified'} />
                        <DetailRow label="Residential Address" value={profile?.address || 'Not Specified'} isLast />
                    </View>

                    {/* SECTION 2: IDENTIFIERS & KYC VERIFICATION */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <Ionicons name="shield-checkmark-outline" size={15} color={L.goldAmber} />
                            <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                Identity & KYC Verification
                            </Text>
                        </View>

                        <DetailRow 
                            label="Customer ID" 
                            value={profile?.custom_id || profile?.username || 'AM-USER'} 
                            onCopy={() => copyToClipboard(profile?.custom_id || profile?.username, 'Customer ID')}
                        />
                        <DetailRow label="KYC Level" value={tierLabel(profile?.kyc_tier)} />
                        <DetailRow label="Bank Verification Number (BVN)" value={maskNumber(profile?.bvn)} />
                        <DetailRow label="National Identity Number (NIN)" value={maskNumber(profile?.nin)} />
                        <DetailRow label="Account Status" value="Active & Operating" status="active" />
                        <DetailRow label="Member Since" value={formatDate(profile?.created_at)} isLast />
                    </View>

                    {/* SECTION 3: VIRTUAL BANK ACCOUNT DETAILS */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <Ionicons name="card-outline" size={15} color={L.blue} />
                            <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                Dedicated Bank Deposit Account
                            </Text>
                        </View>

                        {virtualAcc ? (
                            <>
                                <DetailRow label="Assigned Bank" value={virtualAcc?.bank_name || 'Wema Bank / Payvessel'} />
                                <DetailRow 
                                    label="Account Number" 
                                    value={virtualAcc?.account_number} 
                                    isMonospace 
                                    onCopy={() => copyToClipboard(virtualAcc?.account_number, 'Account Number')}
                                />
                                <DetailRow label="Account Name" value={virtualAcc?.account_name || profile?.full_name} />
                                <DetailRow label="Settlement Type" value="Automated Instant Wallet Credit" status="active" isLast />
                            </>
                        ) : (
                            <TouchableOpacity 
                                onPress={() => router.push('/kyc')} 
                                style={{ backgroundColor: L.goldBg, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: L.goldBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: L.goldAmber, fontWeight: '900', fontSize: 11 }}>No Dedicated Account Assigned</Text>
                                    <Text style={{ color: L.textSecondary, fontSize: 9.5, marginTop: 2 }}>Complete Tier 2 KYC (BVN/NIN) to generate instant virtual bank account.</Text>
                                </View>
                                <Ionicons name="arrow-forward" size={16} color={L.goldAmber} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* SECTION 4: NEXT OF KIN INFORMATION */}
                    {(profile?.next_of_kin_name || profile?.next_of_kin_phone) && (
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                <Ionicons name="people-outline" size={15} color={L.navyHeader} />
                                <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                    Next of Kin Information
                                </Text>
                            </View>

                            <DetailRow label="Next of Kin Name" value={profile?.next_of_kin_name || 'Not Provided'} />
                            <DetailRow label="Next of Kin Phone" value={profile?.next_of_kin_phone || 'Not Provided'} isLast />
                        </View>
                    )}

                    {/* SECTION 5: REFERRAL PROGRAM */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <Ionicons name="gift-outline" size={15} color={L.emerald} />
                            <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                Referral & Bonus Program
                            </Text>
                        </View>

                        <DetailRow 
                            label="Referral Code" 
                            value={profile?.referral_code || profile?.username || profile?.custom_id || 'AM-USER'} 
                            onCopy={() => copyToClipboard(profile?.referral_code || profile?.username || profile?.custom_id, 'Referral Code')}
                        />
                        <DetailRow 
                            label="Referral Link" 
                            value={refLink} 
                            onCopy={() => copyToClipboard(refLink, 'Referral Link')}
                            isLast
                        />
                    </View>

                    {/* ACTION BUTTONS */}
                    <View style={{ gap: 10, marginTop: 4 }}>
                        <TouchableOpacity 
                            onPress={() => router.push('/edit-profile')} 
                            style={{ 
                                backgroundColor: L.navyHeader, 
                                borderRadius: 12, 
                                paddingVertical: 13, 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                flexDirection: 'row', 
                                gap: 6,
                                borderWidth: 1,
                                borderColor: L.gold
                            }}
                        >
                            <Ionicons name="pencil" size={15} color={L.gold} />
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>
                                Edit Profile Information
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => router.push('/security')} 
                            style={{ 
                                backgroundColor: L.card, 
                                borderRadius: 12, 
                                paddingVertical: 12, 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                flexDirection: 'row', 
                                gap: 6,
                                borderWidth: 1,
                                borderColor: L.cardBorder
                            }}
                        >
                            <Ionicons name="shield-checkmark-outline" size={15} color={L.navyHeader} />
                            <Text style={{ color: L.navyHeader, fontWeight: '800', fontSize: 11.5 }}>
                                Manage Security, PIN & Password
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

// Reusable Detail Row Component
function DetailRow({ 
    label, 
    value, 
    onCopy, 
    isMonospace, 
    isLast, 
    status 
}: { 
    label: string; 
    value?: string; 
    onCopy?: () => void; 
    isMonospace?: boolean; 
    isLast?: boolean;
    status?: 'active';
}) {
    return (
        <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingVertical: 9, 
            borderBottomWidth: isLast ? 0 : 1, 
            borderColor: '#F1F5F9' 
        }}>
            <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '600', flex: 1 }}>{label}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {status === 'active' && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: L.emerald }} />
                )}
                
                <Text 
                    style={{ 
                        color: status === 'active' ? L.emerald : L.navyHeader, 
                        fontSize: 11, 
                        fontWeight: '800',
                        fontFamily: isMonospace && Platform.OS === 'ios' ? 'Courier' : (isMonospace ? 'monospace' : undefined),
                        letterSpacing: isMonospace ? 0.8 : undefined
                    }}
                    numberOfLines={1}
                >
                    {value || '—'}
                </Text>

                {onCopy && (
                    <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="copy-outline" size={13} color={L.goldAmber} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
