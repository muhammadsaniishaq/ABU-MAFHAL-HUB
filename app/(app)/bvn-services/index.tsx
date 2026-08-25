import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import DynamicBanners from '../../../components/DynamicBanners';

const BVN_SERVICES = [
    {
        id: 'verify',
        title: 'BVN Verification & Card',
        desc: 'Instant BVN details & printable HD ID Card',
        icon: 'finger-print',
        bgColor: '#f0f9ff',
        iconColor: '#0284c7',
        priceTag: '₦150',
        route: '/(app)/bvn-services/verify',
    },
    {
        id: 'premium-slip',
        title: 'BVN Premium Slip',
        desc: 'Official electronic printable PDF slip',
        icon: 'document-text',
        bgColor: '#ecfdf5',
        iconColor: '#059669',
        priceTag: '₦150',
        route: '/(app)/bvn-services/premium-slip',
    },
    {
        id: 'retrieval',
        title: 'BVN Retrieval (Phone/CRM)',
        desc: 'Recover lost/forgotten BVN via phone number',
        icon: 'call',
        bgColor: '#eff6ff',
        iconColor: '#2563eb',
        priceTag: '₦900',
        route: '/(app)/bvn-services/retrieval',
    },
    {
        id: 'vnin-to-nibss',
        title: 'VNIN to NIBSS',
        desc: 'Link VNIN & BVN directly to NIBSS database',
        icon: 'link',
        bgColor: '#faf5ff',
        iconColor: '#9333ea',
        priceTag: '₦2,500',
        route: '/(app)/bvn-services/vnin-to-nibss',
    },
    {
        id: 'modification',
        title: 'BVN Modification',
        desc: 'Change Date of Birth, Name, Phone Number',
        icon: 'create',
        bgColor: '#fffbeb',
        iconColor: '#d97706',
        priceTag: 'From ₦5,000',
        route: '/(app)/bvn-services/modification',
    },
    {
        id: 'enrollment',
        title: 'BVN User Enrollment',
        desc: 'Direct enrollment for new BVN account holders',
        icon: 'person-add',
        bgColor: '#eef2ff',
        iconColor: '#4f46e5',
        priceTag: 'Agent Portal',
        route: '/(app)/bvn-services/enrollment',
    },
    {
        id: 'history',
        title: 'BVN History & Reprints',
        desc: 'View past verifications and reprint cards/slips',
        icon: 'time',
        bgColor: '#fef9c3',
        iconColor: '#b45309',
        priceTag: 'Free Reprint',
        route: '/(app)/bvn-services/history',
    },
];

export default function BVNServicesGatewayScreen() {
    const insets = useSafeAreaInsets();
    const [userBalance, setUserBalance] = useState<number | null>(null);

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) {
                    setUserBalance(Number(data.balance));
                }
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#050B14', '#0B163A']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: 36 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.decorator1} />
                <View style={styles.decorator2} />

                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <View style={styles.secureDot} />
                        <Text style={styles.secureText}>NIBSS CONNECTED</Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Ionicons name="shield-checkmark" size={22} color="#f5a623" />
                    <Text style={styles.titleText}>BVN Services</Text>
                </View>
                <Text style={styles.subtitleText}>Bank Verification Number Gateway & Identity Suite</Text>

                {/* Wallet Balance widget */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <Ionicons name="wallet-outline" size={18} color="#060d21" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.walletLabel}>Available Balance</Text>
                            <Text style={styles.walletVal}>
                                {userBalance !== null ? `₦${userBalance.toLocaleString()}` : 'Loading...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.fundBtn}
                        onPress={() => router.push('/(app)/wallet')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={14} color="#ffffff" />
                        <Text style={styles.fundBtnText}>Fund Wallet</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16, marginTop: -12 }} contentContainerStyle={styles.scrollContent}>
                <DynamicBanners placement="nin_bvn" />

                <View style={styles.grid}>
                    {BVN_SERVICES.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            onPress={() => router.push(service.route as any)}
                            style={styles.menuItem}
                            activeOpacity={0.8}
                        >
                            <View style={styles.menuHeader}>
                                <View style={[styles.iconBox, { backgroundColor: service.bgColor }]}>
                                    <Ionicons name={service.icon as any} size={20} color={service.iconColor} />
                                </View>
                                <View style={[styles.priceBadge, { backgroundColor: service.bgColor }]}>
                                    <Text style={[styles.priceBadgeText, { color: service.iconColor }]}>{service.priceTag}</Text>
                                </View>
                            </View>
                            <Text style={styles.menuTitle}>{service.title}</Text>
                            <Text style={styles.menuDesc}>{service.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Support Banner */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <Text style={styles.supportTitle}>Need Help with BVN?</Text>
                        <Text style={styles.supportDesc}>Contact our support team for issues regarding BVN retrieval, modifications or NIBSS linking.</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.supportButton} 
                        activeOpacity={0.8}
                        onPress={() => router.push('/(app)/support')}
                    >
                        <Ionicons name="chatbubbles" size={18} color="#050B14" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerGradient: {
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
        paddingHorizontal: 20,
        position: 'relative',
    },
    decorator1: {
        position: 'absolute',
        top: -40,
        right: -32,
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: '#f5a623',
        opacity: 0.05,
    },
    decorator2: {
        position: 'absolute',
        top: 40,
        left: -32,
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#4F46E5',
        opacity: 0.06,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    secureBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    secureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 6,
    },
    secureText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    titleText: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '900',
        marginLeft: 8,
        letterSpacing: 0.2,
    },
    subtitleText: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 4,
        marginBottom: 14,
    },
    walletBar: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    walletVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
    },
    fundBtn: {
        backgroundColor: '#060d21',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    fundBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
        marginLeft: 4,
    },
    scrollContent: {
        paddingBottom: 40,
        paddingTop: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    menuItem: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    priceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    priceBadgeText: {
        fontSize: 9,
        fontWeight: '800',
    },
    menuTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    menuDesc: {
        fontSize: 11,
        color: '#64748b',
        lineHeight: 15,
    },
    supportBanner: {
        backgroundColor: '#fef3c7',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    supportLeft: {
        flex: 1,
        marginRight: 12,
    },
    supportTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#92400e',
        marginBottom: 2,
    },
    supportDesc: {
        fontSize: 11,
        color: '#78350f',
        lineHeight: 15,
    },
    supportButton: {
        backgroundColor: '#f59e0b',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
