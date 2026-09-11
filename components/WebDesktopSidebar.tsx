import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    ScrollView,
    Platform,
    StyleSheet,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, forceSignOut } from '../services/supabase';
import { useAppSettings } from '../hooks/useAppSettings';

interface WebDesktopSidebarProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export default function WebDesktopSidebar({
    collapsed = false,
    onToggleCollapse,
}: WebDesktopSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { settings } = useAppSettings();

    const [userProfile, setUserProfile] = useState<{
        full_name?: string;
        email?: string;
        balance?: number;
        role?: string;
        avatar_url?: string;
    } | null>(null);

    const [showBalance, setShowBalance] = useState(true);
    const [loggingOut, setLoggingOut] = useState(false);
    const [hiddenFeatures, setHiddenFeatures] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;

        const loadProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;

                // Load cached role or profile first
                const cachedRole = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                const cachedHide = await AsyncStorage.getItem('hide_balance_by_default');
                if (cachedHide === 'true') setShowBalance(false);

                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, email, balance, role, avatar_url')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (isMounted && data) {
                    setUserProfile({
                        full_name: data.full_name || session.user.user_metadata?.full_name || 'Valued User',
                        email: data.email || session.user.email || '',
                        balance: Number(data.balance) || 0,
                        role: data.role || cachedRole || 'user',
                        avatar_url: data.avatar_url,
                    });
                }
            } catch (err) {
                // Ignore transient errors
            }
        };

        loadProfile();

        // Load hidden features cache
        AsyncStorage.getItem('@app_hidden_features_cache').then(val => {
            if (val && isMounted) {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) setHiddenFeatures(parsed);
                } catch (_) {}
            }
        });

        // Load hidden features from Supabase
        supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'hidden_features')
            .maybeSingle()
            .then(({ data }) => {
                if (data?.value && isMounted) {
                    try {
                        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                        if (Array.isArray(parsed)) {
                            setHiddenFeatures(parsed);
                            AsyncStorage.setItem('@app_hidden_features_cache', JSON.stringify(parsed)).catch(() => {});
                        }
                    } catch (_) {}
                }
            });

        // Subscribe to live balance updates
        const channel = supabase
            .channel('sidebar-balance-changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                (payload) => {
                    if (payload.new && isMounted) {
                        setUserProfile((prev) => ({
                            ...prev,
                            balance: Number(payload.new.balance) || 0,
                            role: payload.new.role || prev?.role,
                        }));
                    }
                }
            )
            .subscribe();

        // Subscribe to real-time hidden features changes
        const hiddenChannel = supabase
            .channel('web-sidebar-hidden-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.hidden_features' },
                (payload: any) => {
                    if (payload.new?.value && isMounted) {
                        try {
                            const parsed = typeof payload.new.value === 'string' ? JSON.parse(payload.new.value) : payload.new.value;
                            if (Array.isArray(parsed)) {
                                setHiddenFeatures(parsed);
                                AsyncStorage.setItem('@app_hidden_features_cache', JSON.stringify(parsed)).catch(() => {});
                            }
                        } catch (_) {}
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
            supabase.removeChannel(hiddenChannel);
        };
    }, []);

    const isAdmin =
        userProfile?.role === 'admin' ||
        userProfile?.role === 'super_admin' ||
        (userProfile?.email &&
            (userProfile.email.toLowerCase().includes('admin') ||
                userProfile.email.toLowerCase() === 'sale.abumafhal@gmail.com' ||
                userProfile.email.toLowerCase() === 'admin@abumafhal.com'));

    const handleSignOut = async () => {
        try {
            setLoggingOut(true);
            await forceSignOut();
            await AsyncStorage.removeItem('has_active_session');
            await AsyncStorage.removeItem('app_unlocked');
            router.replace('/' as any);
        } catch (e) {
            router.replace('/' as any);
        } finally {
            setLoggingOut(false);
        }
    };

    const navItems = [
        {
            group: 'MAIN MENU',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid', route: '/(app)/dashboard' },
                { id: 'wallet', label: 'Wallet & Funding', icon: 'wallet', route: '/(app)/wallet' },
                { id: 'transfer', label: 'Bank Transfer', icon: 'paper-plane', route: '/(app)/transfer' },
                { id: 'history', label: 'Transaction History', icon: 'receipt', route: '/(app)/history' },
            ],
        },
        {
            group: 'TELECOM & BILLS',
            items: [
                { id: 'data', label: '5G Data Bundle', icon: 'wifi', route: '/(app)/data', badge: '5G FAST' },
                { id: 'airtime', label: 'Airtime VTU', icon: 'call', route: '/(app)/airtime', badge: '3% BACK' },
                { id: 'bills', label: 'Electricity & TV', icon: 'flash', route: '/(app)/bills' },
                { id: 'education', label: 'Education Pins', icon: 'school', route: '/(app)/education' },
            ],
        },
        {
            group: 'IDENTITY & LEGAL',
            items: [
                { id: 'nin-services', label: 'NIN Services', icon: 'finger-print', route: '/(app)/nin-services' },
                { id: 'bvn-services', label: 'BVN Services', icon: 'card', route: '/(app)/bvn-services' },
                { id: 'cac-services', label: 'CAC Registration', icon: 'business', route: '/(app)/cac-services' },
            ],
        },
        {
            group: 'VALUE SERVICES',
            items: [
                { id: 'virtual-cards', label: 'Dollar Cards', icon: 'card-outline', route: '/(app)/virtual-cards', badge: 'USD' },
                { id: 'qr-pay', label: 'QR Code Pay', icon: 'qr-code', route: '/(app)/qr-pay' },
                { id: 'airtime-to-cash', label: 'Airtime to Cash', icon: 'swap-horizontal', route: '/(app)/airtime-to-cash' },
                { id: 'recharge-pin', label: 'Recharge PINs', icon: 'print', route: '/(app)/recharge-pin' },
                { id: 'social-boost', label: 'Social Boost', icon: 'trending-up', route: '/(app)/social-boost' },
            ],
        },
        {
            group: 'ACCOUNT & HELP',
            items: [
                { id: 'profile', label: 'Profile & Security', icon: 'person', route: '/(app)/profile' },
                { id: 'support', label: 'Support & Helpdesk', icon: 'help-buoy', route: '/(app)/support' },
                { id: 'tickets', label: 'Support Tickets', icon: 'chatbubbles', route: '/(app)/tickets' },
                { id: 'referrals', label: 'Refer & Earn', icon: 'gift', route: '/(app)/referrals', badge: 'BONUS' },
            ],
        },
    ];

    const ROUTE_FEATURE_MAP: Record<string, string> = {
        '/(app)/transfer': 'feature_transfer',
        '/(app)/airtime': 'feature_airtime',
        '/(app)/data': 'feature_data',
        '/(app)/bills': 'feature_bills',
        '/(app)/education': 'feature_education',
        '/(app)/nin-services': 'feature_nin',
        '/(app)/bvn-services': 'feature_bvn',
        '/(app)/cac-services': 'feature_cac',
        '/(app)/virtual-cards': 'feature_cards',
        '/(app)/qr-pay': 'feature_qr',
        '/(app)/airtime-to-cash': 'feature_airtime',
        '/(app)/recharge-pin': 'feature_airtime',
        '/(app)/social-boost': 'feature_social',
        '/(app)/referrals': 'feature_rewards',
        '/(app)/crypto': 'feature_crypto',
        '/(app)/bulk-sms': 'feature_bulk_sms',
        '/(app)/smile': 'feature_smile',
    };

    const visibleNavItems = navItems.map(section => ({
        ...section,
        items: section.items.filter(item => {
            const featKey = ROUTE_FEATURE_MAP[item.route];
            return !featKey || !hiddenFeatures.includes(featKey);
        })
    })).filter(section => section.items.length > 0);

    const getLogoUri = () => {
        if (settings?.app_logo_icon) return settings.app_logo_icon;
        if (typeof settings?.app_logo === 'string') return settings.app_logo;
        if (settings?.app_logo?.url) return settings.app_logo.url;
        return null;
    };

    const logoUri = getLogoUri();

    return (
        <View style={[styles.sidebarRoot, collapsed && styles.sidebarCollapsed]}>
            {/* 1. Header: Brand Logo & Title */}
            <View style={[styles.brandHeader, collapsed && styles.brandHeaderCollapsed]}>
                <View style={styles.logoRing}>
                    {logoUri ? (
                        <Image source={{ uri: logoUri }} style={styles.logoImg} resizeMode="contain" />
                    ) : (
                        <Image
                            source={require('../assets/images/logo.png')}
                            style={styles.logoImg}
                            resizeMode="contain"
                        />
                    )}
                </View>

                {!collapsed && (
                    <View style={styles.brandTitleCol}>
                        <View style={styles.brandNameRow}>
                            <Text style={styles.brandNameMain}>ABU MAFHAL</Text>
                            <View style={styles.brandChip}>
                                <Text style={styles.brandChipText}>SUB</Text>
                            </View>
                        </View>
                        <Text style={styles.brandTagline}>SMART TELECOM & FINTECH</Text>
                    </View>
                )}

                {onToggleCollapse && (
                    <TouchableOpacity
                        onPress={onToggleCollapse}
                        style={styles.collapseToggleBtn}
                        accessibilityLabel="Toggle Sidebar"
                    >
                        <Ionicons
                            name={collapsed ? 'chevron-forward' : 'chevron-back'}
                            size={16}
                            color="#94A3B8"
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* 2. User Balance Pill Card */}
            {!collapsed && (
                <View style={styles.walletCardWrapper}>
                    <LinearGradient
                        colors={['#0F1E4A', '#0D1B3E']}
                        style={styles.walletCardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.walletCardTop}>
                            <View style={styles.walletBadgeRow}>
                                <View style={styles.greenLiveDot} />
                                <Text style={styles.walletBadgeText}>AVAILABLE BALANCE</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowBalance(prev => !prev)}
                                style={styles.eyeToggleBtn}
                                accessibilityLabel="Toggle balance visibility"
                            >
                                <Ionicons
                                    name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                                    size={14}
                                    color="#94A3B8"
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.walletBalanceAmount} numberOfLines={1}>
                            {showBalance
                                ? `₦${(userProfile?.balance || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                  })}`
                                : '₦••••••••'}
                        </Text>

                        <View style={styles.walletActionBtnsRow}>
                            <TouchableOpacity
                                onPress={() => router.push('/(app)/wallet' as any)}
                                style={styles.walletPrimaryBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add-circle" size={13} color="#0D1B3E" style={{ marginRight: 4 }} />
                                <Text style={styles.walletPrimaryBtnText}>Fund</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => router.push('/(app)/transfer' as any)}
                                style={styles.walletSecondaryBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="paper-plane" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={styles.walletSecondaryBtnText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>
            )}

            {/* 3. Navigation Links List */}
            <ScrollView
                style={styles.navScrollView}
                contentContainerStyle={styles.navScrollContent}
                showsVerticalScrollIndicator={false}
            >
                {visibleNavItems.map((section, sIdx) => (
                    <View key={`sec-${sIdx}`} style={styles.navSection}>
                        {!collapsed && (
                            <Text style={styles.navSectionHeader}>{section.group}</Text>
                        )}
                        {section.items.map((item) => {
                            const isActive =
                                pathname === item.route ||
                                pathname?.startsWith(item.route + '/') ||
                                (item.id === 'nin-services' && pathname?.includes('nin-services')) ||
                                (item.id === 'bvn-services' && pathname?.includes('bvn-services')) ||
                                (item.id === 'tickets' && pathname?.includes('tickets'));

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => router.push(item.route as any)}
                                    style={[
                                        styles.navItemBtn,
                                        isActive && styles.navItemBtnActive,
                                        collapsed && styles.navItemBtnCollapsed,
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.navIconBox, isActive && styles.navIconBoxActive]}>
                                        <Ionicons
                                            name={item.icon as any}
                                            size={17}
                                            color={isActive ? '#F59E0B' : '#94A3B8'}
                                        />
                                    </View>

                                    {!collapsed && (
                                        <Text
                                            style={[styles.navItemLabel, isActive && styles.navItemLabelActive]}
                                            numberOfLines={1}
                                        >
                                            {item.label}
                                        </Text>
                                    )}

                                    {!collapsed && item.badge && (
                                        <View
                                            style={[
                                                styles.itemBadge,
                                                isActive && styles.itemBadgeActive,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.itemBadgeText,
                                                    isActive && styles.itemBadgeTextActive,
                                                ]}
                                            >
                                                {item.badge}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}

                {/* Admin Management Button (Visible if User has Admin privileges) */}
                {isAdmin && (
                    <View style={styles.navSection}>
                        {!collapsed && (
                            <Text style={[styles.navSectionHeader, { color: '#F59E0B' }]}>ADMINISTRATION</Text>
                        )}
                        <TouchableOpacity
                            onPress={() => router.push('/manage' as any)}
                            style={[
                                styles.navItemBtn,
                                styles.adminNavItemBtn,
                                collapsed && styles.navItemBtnCollapsed,
                            ]}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.navIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                <Ionicons name="shield-checkmark" size={17} color="#F59E0B" />
                            </View>
                            {!collapsed && (
                                <Text style={[styles.navItemLabel, { color: '#F59E0B', fontWeight: '800' }]}>
                                    Admin Portal
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* 4. Footer: 24/7 WhatsApp & Sign Out */}
            <View style={[styles.sidebarFooter, collapsed && styles.sidebarFooterCollapsed]}>
                {!collapsed && (
                    <TouchableOpacity
                        onPress={() => {
                            const phone = settings?.support_whatsapp || '2348145853539';
                            Linking.openURL(`https://wa.me/${phone}?text=Hello%20Abu%20Mafhal%20Support`).catch(() => {});
                        }}
                        style={styles.whatsAppSupportBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="logo-whatsapp" size={15} color="#25D366" style={{ marginRight: 6 }} />
                        <Text style={styles.whatsAppSupportText}>24/7 WhatsApp Help</Text>
                    </TouchableOpacity>
                )}

                <View style={[styles.footerUserRow, collapsed && { justifyContent: 'center' }]}>
                    {!collapsed && (
                        <View style={styles.footerUserInfo}>
                            <Text style={styles.footerUserName} numberOfLines={1}>
                                {userProfile?.full_name || 'My Account'}
                            </Text>
                            <Text style={styles.footerVersion}>v1.0.4 · Enterprise Web</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={handleSignOut}
                        disabled={loggingOut}
                        style={styles.logoutBtn}
                        accessibilityLabel="Log Out"
                    >
                        {loggingOut ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebarRoot: {
        width: 260,
        backgroundColor: '#0D1B3E',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.08)',
        height: '100%',
        flexDirection: 'column',
        zIndex: 40,
        ...Platform.select({
            web: {
                position: 'sticky' as any,
                top: 0,
            },
            default: {},
        }),
    },
    sidebarCollapsed: {
        width: 76,
    },
    brandHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    brandHeaderCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    logoRing: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1.5,
        borderColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logoImg: {
        width: 32,
        height: 32,
    },
    brandTitleCol: {
        marginLeft: 10,
        flex: 1,
    },
    brandNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandNameMain: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    brandChip: {
        backgroundColor: '#F59E0B',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginLeft: 5,
    },
    brandChipText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#0D1B3E',
    },
    brandTagline: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 0.8,
        marginTop: 2,
    },
    collapseToggleBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletCardWrapper: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 6,
    },
    walletCardGradient: {
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    walletCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    walletBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    greenLiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 6,
    },
    walletBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#CBD5E1',
        letterSpacing: 0.5,
    },
    eyeToggleBtn: {
        padding: 4,
    },
    walletBalanceAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
        marginBottom: 10,
    },
    walletActionBtnsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    walletPrimaryBtn: {
        flex: 1,
        backgroundColor: '#F59E0B',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletPrimaryBtnText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0D1B3E',
    },
    walletSecondaryBtn: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    walletSecondaryBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    navScrollView: {
        flex: 1,
    },
    navScrollContent: {
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    navSection: {
        marginBottom: 14,
    },
    navSectionHeader: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 6,
        paddingHorizontal: 10,
    },
    navItemBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 10,
        marginBottom: 2,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
                transition: 'all 0.18s ease' as any,
            },
            default: {},
        }),
    },
    navItemBtnActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        borderLeftWidth: 3,
        borderLeftColor: '#F59E0B',
    },
    navItemBtnCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    adminNavItemBtn: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    navIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    navIconBoxActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    navItemLabel: {
        marginLeft: 10,
        fontSize: 12.5,
        fontWeight: '600',
        color: '#CBD5E1',
        flex: 1,
    },
    navItemLabelActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    itemBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    itemBadgeActive: {
        backgroundColor: '#F59E0B',
    },
    itemBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
    },
    itemBadgeTextActive: {
        color: '#0D1B3E',
    },
    sidebarFooter: {
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
        backgroundColor: '#09132C',
    },
    sidebarFooterCollapsed: {
        paddingHorizontal: 8,
    },
    whatsAppSupportBtn: {
        backgroundColor: 'rgba(37, 211, 102, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(37, 211, 102, 0.3)',
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
            default: {},
        }),
    },
    whatsAppSupportText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#25D366',
    },
    footerUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerUserInfo: {
        flex: 1,
        marginRight: 6,
    },
    footerUserName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    footerVersion: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 1,
    },
    logoutBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
            default: {},
        }),
    },
});
