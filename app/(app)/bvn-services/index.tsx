import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import DynamicBanners from '../../../components/DynamicBanners';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

const BVN_SERVICES = [
    {
        id: 'verify',
        pricingId: 'bvn_num_advanced',
        title: 'BVN Verification',
        desc: 'Instant lookup & HD ID Card',
        icon: 'finger-print-outline',
        route: '/(app)/bvn-services/verify',
    },
    {
        id: 'premium-slip',
        pricingId: 'bvn_premium_slip',
        title: 'BVN Premium Slip',
        desc: 'Official electronic printable PDF',
        icon: 'document-text-outline',
        route: '/(app)/bvn-services/premium-slip',
    },
    {
        id: 'retrieval',
        pricingId: 'bvn_retrieval_phone',
        title: 'BVN Retrieval',
        desc: 'Recover BVN via Phone or CRM',
        icon: 'search-outline',
        route: '/(app)/bvn-services/retrieval',
    },
    {
        id: 'vnin-to-nibss',
        pricingId: 'vnin_to_nibss',
        title: 'VNIN to NIBSS',
        desc: 'Link VNIN directly to NIBSS',
        icon: 'link-outline',
        route: '/(app)/bvn-services/vnin-to-nibss',
    },
    {
        id: 'modification',
        pricingId: 'bvn_mod_name',
        title: 'BVN Modification',
        desc: 'Change Name, DOB, or Phone',
        icon: 'create-outline',
        route: '/(app)/bvn-services/modification',
    },
    {
        id: 'enrollment',
        pricingId: 'bvn_enrollment',
        title: 'User Enrollment',
        desc: 'Direct enrollment for new holders',
        icon: 'person-add-outline',
        route: '/(app)/bvn-services/enrollment',
    },
    {
        id: 'history',
        pricingId: 'history',
        title: 'BVN History',
        desc: 'Past logs & instant reprints',
        icon: 'time-outline',
        route: '/(app)/bvn-services/history',
    },
];

export default function BVNServicesGatewayScreen() {
    const insets = useSafeAreaInsets();
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [serviceStatuses, setServiceStatuses] = useState<Record<string, { status: string; msg?: string }>>({});
    const [globalBVNStatus, setGlobalBVNStatus] = useState<'active' | 'maintenance' | 'hidden'>('active');
    const [globalBVNMsg, setGlobalBVNMsg] = useState('BVN verification services are currently undergoing routine core server maintenance. Services will resume shortly.');

    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

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

    const fetchServiceVisibilityAndMaintenance = async () => {
        try {
            // 1. Fetch Global Settings
            const { data: globalSettings } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['bvn_global_status', 'bvn_global_maintenance_msg']);

            if (globalSettings) {
                const gStatus = globalSettings.find(s => s.key === 'bvn_global_status');
                if (gStatus?.value) setGlobalBVNStatus(gStatus.value as any);
                const gMsg = globalSettings.find(s => s.key === 'bvn_global_maintenance_msg');
                if (gMsg?.value) setGlobalBVNMsg(gMsg.value);
            }

            // 2. Fetch Individual Service Statuses
            const { data: pricingRows } = await supabase
                .from('service_pricing')
                .select('id, status, maintenance_msg')
                .eq('service_category', 'bvn');

            if (pricingRows && pricingRows.length > 0) {
                const map: Record<string, { status: string; msg?: string }> = {};
                pricingRows.forEach(row => {
                    map[row.id] = {
                        status: row.status || 'active',
                        msg: row.maintenance_msg || undefined,
                    };
                });
                setServiceStatuses(map);
            }
        } catch (e) {
            console.warn('Failed to load BVN service statuses', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
        fetchServiceVisibilityAndMaintenance();
    }, []);

    const handleServicePress = (service: typeof BVN_SERVICES[0]) => {
        if (globalBVNStatus === 'maintenance') {
            setAlertConfig({
                visible: true,
                title: 'Gateway Maintenance',
                message: globalBVNMsg,
                type: 'warning',
            });
            return;
        }

        const currentStatusObj = serviceStatuses[service.pricingId];
        if (currentStatusObj && currentStatusObj.status === 'maintenance') {
            setAlertConfig({
                visible: true,
                title: `${service.title} - Maintenance`,
                message: currentStatusObj.msg || `${service.title} is currently paused for routine server maintenance. Please check back shortly.`,
                type: 'warning',
            });
            return;
        }

        router.push(service.route as any);
    };

    // Filter out services marked as HIDDEN by Admin
    const visibleServices = BVN_SERVICES.filter(service => {
        const itemStatus = serviceStatuses[service.pricingId]?.status;
        return itemStatus !== 'hidden';
    });

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 20 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <View style={[styles.secureDot, globalBVNStatus === 'maintenance' && { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.secureText}>
                            {globalBVNStatus === 'maintenance' ? 'GATEWAY UNDER MAINTENANCE' : 'NIBSS CONNECTED'}
                        </Text>
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
                        onPress={() => router.push('/(app)/wallet/fund')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={14} color="#0B192C" />
                        <Text style={styles.fundBtnText}>Top Up</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]} showsVerticalScrollIndicator={false}>
                {/* Global Maintenance Banner */}
                {globalBVNStatus === 'maintenance' && (
                    <View style={styles.globalMaintBanner}>
                        <Ionicons name="construct-outline" size={18} color="#B45309" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.globalMaintTitle}>Routine Gateway Maintenance</Text>
                            <Text style={styles.globalMaintDesc}>{globalBVNMsg}</Text>
                        </View>
                    </View>
                )}

                {/* Dynamic Marketing Banner Slider */}
                <DynamicBanners />

                {/* Services Grid */}
                <View style={styles.grid}>
                    {visibleServices.map((service) => {
                        const isMaint = serviceStatuses[service.pricingId]?.status === 'maintenance';
                        return (
                            <TouchableOpacity
                                key={service.id}
                                onPress={() => handleServicePress(service)}
                                style={[styles.menuItem, isMaint && styles.menuItemMaint]}
                                activeOpacity={0.8}
                            >
                                <View style={styles.menuHeader}>
                                    <View style={[styles.iconBox, isMaint && { backgroundColor: '#FEF3C7' }]}>
                                        <Ionicons name={service.icon as any} size={18} color={isMaint ? '#B45309' : '#D4AF37'} />
                                    </View>
                                    {isMaint ? (
                                        <View style={styles.maintPill}>
                                            <Text style={styles.maintPillText}>MAINTENANCE</Text>
                                        </View>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                                    )}
                                </View>
                                <Text style={styles.menuTitle} numberOfLines={1}>{service.title}</Text>
                                <Text style={styles.menuDesc} numberOfLines={1}>{service.desc}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Support Banner */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <Text style={styles.supportTitle}>Need Help with BVN?</Text>
                        <Text style={styles.supportDesc}>Contact our support team for any issues or guidance</Text>
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

            <BrandAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    secureBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    secureDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981', marginRight: 5 },
    secureText: { color: '#ffffff', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
    titleText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    subtitleText: { color: '#94a3b8', fontSize: 11, marginBottom: 10 },
    walletBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    walletLeft: { flexDirection: 'row', alignItems: 'center' },
    walletLabel: { color: '#94a3b8', fontSize: 9.5, fontWeight: '600' },
    walletVal: { color: '#ffffff', fontSize: 13, fontWeight: '900', marginTop: 1 },
    fundBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4AF37', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, gap: 3 },
    fundBtnText: { color: '#0B192C', fontSize: 11, fontWeight: '800' },
    content: { flex: 1 },
    scrollContent: { padding: 14 },
    globalMaintBanner: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12 },
    globalMaintTitle: { fontSize: 11.5, fontWeight: '900', color: '#B45309' },
    globalMaintDesc: { fontSize: 10, color: '#92400E', marginTop: 1, lineHeight: 13 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    menuItem: { width: '48.3%', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    menuItemMaint: { borderColor: '#FDE68A', backgroundColor: '#FFFDF5' },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    iconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#0B192C', alignItems: 'center', justifyContent: 'center' },
    maintPill: { backgroundColor: '#FEF3C7', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
    maintPillText: { fontSize: 7, fontWeight: '900', color: '#B45309' },
    menuTitle: { fontSize: 12, fontWeight: '800', color: '#0B192C', marginBottom: 2 },
    menuDesc: { fontSize: 9.5, color: '#64748B', lineHeight: 13 },
    supportBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0B192C', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    supportLeft: { flex: 1 },
    supportTitle: { color: '#ffffff', fontSize: 12.5, fontWeight: '800' },
    supportDesc: { color: '#94a3b8', fontSize: 10, marginTop: 1 },
    supportButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
});
