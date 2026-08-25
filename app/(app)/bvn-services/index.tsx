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
        title: 'BVN Verification',
        desc: 'Instant lookup & HD ID Card',
        icon: 'finger-print-outline',
        route: '/(app)/bvn-services/verify',
    },
    {
        id: 'premium-slip',
        title: 'BVN Premium Slip',
        desc: 'Official electronic printable PDF',
        icon: 'document-text-outline',
        route: '/(app)/bvn-services/premium-slip',
    },
    {
        id: 'retrieval',
        title: 'BVN Retrieval',
        desc: 'Recover BVN via Phone or CRM',
        icon: 'search-outline',
        route: '/(app)/bvn-services/retrieval',
    },
    {
        id: 'vnin-to-nibss',
        title: 'VNIN to NIBSS',
        desc: 'Link VNIN directly to NIBSS',
        icon: 'link-outline',
        route: '/(app)/bvn-services/vnin-to-nibss',
    },
    {
        id: 'modification',
        title: 'BVN Modification',
        desc: 'Change Name, DOB, or Phone',
        icon: 'create-outline',
        route: '/(app)/bvn-services/modification',
    },
    {
        id: 'enrollment',
        title: 'User Enrollment',
        desc: 'Direct enrollment for new holders',
        icon: 'person-add-outline',
        route: '/(app)/bvn-services/enrollment',
    },
    {
        id: 'history',
        title: 'BVN History',
        desc: 'Past logs & instant reprints',
        icon: 'time-outline',
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
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 24 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <View style={styles.secureDot} />
                        <Text style={styles.secureText}>NIBSS CONNECTED</Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Ionicons name="shield-checkmark" size={20} color="#D4AF37" />
                    <Text style={styles.titleText}>BVN Services</Text>
                </View>
                <Text style={styles.subtitleText}>Official Bank Verification Gateway</Text>

                {/* Compact Wallet Bar */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <Ionicons name="wallet-outline" size={16} color="#D4AF37" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.walletLabel}>Available Balance</Text>
                            <Text style={styles.walletVal}>
                                {userBalance !== null ? `₦${userBalance.toLocaleString()}` : '...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.fundBtn}
                        onPress={() => router.push('/(app)/wallet')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={14} color="#0B192C" />
                        <Text style={styles.fundBtnText}>Fund</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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
                                <View style={styles.iconBox}>
                                    <Ionicons name={service.icon as any} size={18} color="#D4AF37" />
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                            </View>
                            <Text style={styles.menuTitle} numberOfLines={1}>{service.title}</Text>
                            <Text style={styles.menuDesc} numberOfLines={1}>{service.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Compact Support Banner */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <Text style={styles.supportTitle}>Need Help with BVN?</Text>
                        <Text style={styles.supportDesc}>Contact support for instant assistance</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.supportButton} 
                        activeOpacity={0.8}
                        onPress={() => router.push('/(app)/support')}
                    >
                        <Ionicons name="chatbubbles-outline" size={16} color="#0B192C" />
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
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    backButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212,175,55,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    secureDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#D4AF37',
        marginRight: 5,
    },
    secureText: {
        color: '#D4AF37',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    titleText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
    },
    subtitleText: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 2,
        marginBottom: 12,
    },
    walletBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletLabel: {
        color: '#94a3b8',
        fontSize: 9,
        fontWeight: '600',
    },
    walletVal: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    fundBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D4AF37',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    fundBtnText: {
        color: '#0B192C',
        fontSize: 11,
        fontWeight: '800',
        marginLeft: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: 14,
        marginTop: 8,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    menuItem: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF9E7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
    },
    menuTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0B192C',
        marginBottom: 2,
    },
    menuDesc: {
        fontSize: 10,
        color: '#64748b',
    },
    supportBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    supportLeft: {
        flex: 1,
        marginRight: 10,
    },
    supportTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0B192C',
    },
    supportDesc: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 1,
    },
    supportButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
