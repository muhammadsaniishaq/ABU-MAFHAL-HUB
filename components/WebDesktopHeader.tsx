import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Linking,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAppSettings } from '../hooks/useAppSettings';

interface WebDesktopHeaderProps {
    onToggleSidebar?: () => void;
    showToggle?: boolean;
}

export default function WebDesktopHeader({
    onToggleSidebar,
    showToggle = false,
}: WebDesktopHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { settings } = useAppSettings();

    const [userProfile, setUserProfile] = useState<{
        full_name?: string;
        email?: string;
        avatar_url?: string;
    } | null>(null);

    useEffect(() => {
        let isMounted = true;
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && isMounted) {
                supabase
                    .from('profiles')
                    .select('full_name, email, avatar_url')
                    .eq('id', user.id)
                    .maybeSingle()
                    .then(({ data }) => {
                        if (isMounted && data) {
                            setUserProfile({
                                full_name: data.full_name || user.user_metadata?.full_name || 'Account',
                                email: data.email || user.email || '',
                                avatar_url: data.avatar_url,
                            });
                        }
                    });
            }
        });
        return () => {
            isMounted = false;
        };
    }, []);

    const getPageTitle = () => {
        if (!pathname || pathname === '/' || pathname.includes('dashboard')) return 'Dashboard Overview';
        if (pathname.includes('wallet')) return 'Wallet & Funding Accounts';
        if (pathname.includes('transfer')) return 'Bank & Wallet Transfer';
        if (pathname.includes('data')) return '5G High-Speed Data Bundles';
        if (pathname.includes('airtime-to-cash')) return 'Airtime to Cash Conversion';
        if (pathname.includes('airtime')) return 'Instant Airtime VTU Top-Up';
        if (pathname.includes('bills')) return 'Electricity & Cable TV Bills';
        if (pathname.includes('education')) return 'Education Exam PINs';
        if (pathname.includes('history')) return 'Transaction History & Receipts';
        if (pathname.includes('profile')) return 'Profile & Security Settings';
        if (pathname.includes('support')) return 'Customer Support & Helpdesk';
        if (pathname.includes('tickets')) return 'Customer Support Tickets';
        if (pathname.includes('referrals')) return 'Referrals & Rewards Program';
        if (pathname.includes('nin-services')) return 'NIN Identity Verification & Services';
        if (pathname.includes('bvn-services')) return 'BVN Verification & Validation';
        if (pathname.includes('cac-services')) return 'CAC Corporate Registration';
        if (pathname.includes('virtual-cards')) return 'USD Virtual Dollar Cards';
        if (pathname.includes('recharge-pin')) return 'Recharge Cards & EPINs';
        if (pathname.includes('social-boost')) return 'Social Media Marketing Boost';
        if (pathname.includes('qr-pay')) return 'QR Code Payments';
        if (pathname.includes('manage')) return 'Enterprise Admin Management';
        return 'Abu Mafhal Sub';
    };

    return (
        <View style={styles.headerRoot}>
            {/* Left: Optional Sidebar Toggle + Page Title */}
            <View style={styles.leftCol}>
                {showToggle && onToggleSidebar && (
                    <TouchableOpacity
                        onPress={onToggleSidebar}
                        style={styles.toggleBtn}
                        accessibilityLabel="Toggle Menu"
                    >
                        <Ionicons name="menu-outline" size={22} color="#0D1B3E" />
                    </TouchableOpacity>
                )}

                <View>
                    <Text style={styles.pageTitleText}>{getPageTitle()}</Text>
                    <View style={styles.breadcrumbRow}>
                        <Text style={styles.breadcrumbMuted}>Abu Mafhal Hub</Text>
                        <Ionicons name="chevron-forward" size={10} color="#94A3B8" style={{ marginHorizontal: 4 }} />
                        <Text style={styles.breadcrumbActive}>{getPageTitle()}</Text>
                    </View>
                </View>
            </View>

            {/* Center: Live Status Engine Badge */}
            <View style={styles.centerBadge}>
                <View style={styles.pulsingGreenDot} />
                <Text style={styles.centerBadgeText}>0.4s Fast Delivery Engine · 99.98% Uptime</Text>
            </View>

            {/* Right: Actions (WhatsApp, AI Chat, Notifications, User) */}
            <View style={styles.rightActionsRow}>
                {/* 24/7 WhatsApp Action */}
                <TouchableOpacity
                    onPress={() => {
                        const phone = settings?.support_whatsapp || '2348145853539';
                        Linking.openURL(`https://wa.me/${phone}?text=Hello%20Abu%20Mafhal%20Support`).catch(() => {});
                    }}
                    style={styles.actionPillBtn}
                    activeOpacity={0.8}
                >
                    <Ionicons name="logo-whatsapp" size={15} color="#25D366" style={{ marginRight: 5 }} />
                    <Text style={styles.actionPillText}>24/7 Support</Text>
                </TouchableOpacity>

                {/* AI Assistant */}
                <TouchableOpacity
                    onPress={() => router.push('/ai-chat')}
                    style={styles.iconCircleBtn}
                    activeOpacity={0.8}
                    accessibilityLabel="AI Assistant"
                >
                    <Ionicons name="sparkles" size={16} color="#4F46E5" />
                </TouchableOpacity>

                {/* Notification Bell */}
                <TouchableOpacity
                    onPress={() => router.push('/notifications')}
                    style={styles.iconCircleBtn}
                    activeOpacity={0.8}
                    accessibilityLabel="Notifications"
                >
                    <Ionicons name="notifications-outline" size={17} color="#0D1B3E" />
                    <View style={styles.notifDot} />
                </TouchableOpacity>

                {/* User Profile Quick Link */}
                <TouchableOpacity
                    onPress={() => router.push('/(app)/profile')}
                    style={styles.userProfilePill}
                    activeOpacity={0.8}
                >
                    <View style={styles.userAvatarDisc}>
                        {userProfile?.avatar_url ? (
                            <Image source={{ uri: userProfile.avatar_url }} style={styles.userAvatarImg} />
                        ) : (
                            <Ionicons name="person" size={14} color="#0D1B3E" />
                        )}
                    </View>
                    <Text style={styles.userPillName} numberOfLines={1}>
                        {userProfile?.full_name || 'My Profile'}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color="#64748B" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerRoot: {
        height: 64,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 30,
        ...Platform.select({
            web: {
                position: 'sticky' as any,
                top: 0,
            },
            default: {},
        }),
    },
    leftCol: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
            default: {},
        }),
    },
    pageTitleText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0D1B3E',
        letterSpacing: 0.2,
    },
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    breadcrumbMuted: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
    },
    breadcrumbActive: {
        fontSize: 11,
        fontWeight: '700',
        color: '#F59E0B',
    },
    centerBadge: {
        display: 'none',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...Platform.select({
            web: {
                display: 'flex' as any,
            },
            default: {},
        }),
    },
    pulsingGreenDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10B981',
        marginRight: 8,
    },
    centerBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    rightActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
            default: {},
        }),
    },
    actionPillText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#047857',
    },
    iconCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
            default: {},
        }),
    },
    notifDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
    },
    userProfilePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 20,
        paddingLeft: 4,
        paddingRight: 10,
        paddingVertical: 3,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
            default: {},
        }),
    },
    userAvatarDisc: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        overflow: 'hidden',
    },
    userAvatarImg: {
        width: 28,
        height: 28,
    },
    userPillName: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0D1B3E',
        maxWidth: 100,
        marginRight: 6,
    },
});
