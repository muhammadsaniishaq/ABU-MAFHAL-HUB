import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
import DynamicBanners from '../../../components/DynamicBanners';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

interface BVNServiceItem {
    id: string;
    pricingId: string;
    title: string;
    desc: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    category: 'instant' | 'retrieval' | 'modification' | 'desk';
    badge: string;
    defaultPrice: number;
    color: string;
    bgColor: string;
}

const BVN_SERVICES: BVNServiceItem[] = [
    {
        id: 'verify',
        pricingId: 'bvn_num_advanced',
        title: 'BVN Verification',
        desc: 'Instant biometric lookup & HD Printable Card',
        icon: 'finger-print',
        route: '/(app)/bvn-services/verify',
        category: 'instant',
        badge: 'INSTANT API',
        defaultPrice: 100,
        color: '#D97706',
        bgColor: '#FEF3C7',
    },
    {
        id: 'premium-slip',
        pricingId: 'bvn_premium_slip',
        title: 'BVN Premium Slip',
        desc: 'Official electronic printable PDF slip',
        icon: 'document-text',
        route: '/(app)/bvn-services/premium-slip',
        category: 'instant',
        badge: 'PDF SLIP',
        defaultPrice: 100,
        color: '#2563EB',
        bgColor: '#EFF6FF',
    },
    {
        id: 'retrieval',
        pricingId: 'bvn_retrieval_phone',
        title: 'BVN Retrieval (Phone/CRM)',
        desc: 'Recover lost BVN via phone number or CRM lookup',
        icon: 'search',
        route: '/(app)/bvn-services/retrieval',
        category: 'retrieval',
        badge: 'PHONE / CRM',
        defaultPrice: 800,
        color: '#0D9488',
        bgColor: '#F0FDFA',
    },
    {
        id: 'vnin-to-nibss',
        pricingId: 'vnin_to_nibss',
        title: 'VNIN to NIBSS',
        desc: 'Link VNIN directly to NIBSS database records',
        icon: 'link',
        route: '/(app)/bvn-services/vnin-to-nibss',
        category: 'retrieval',
        badge: 'NIBSS SYNC',
        defaultPrice: 700,
        color: '#4F46E5',
        bgColor: '#EEF2FF',
    },
    {
        id: 'modification',
        pricingId: 'bvn_mod_name',
        title: 'BVN Modification',
        desc: 'Official correction of Name, DOB or Phone',
        icon: 'create',
        route: '/(app)/bvn-services/modification',
        category: 'modification',
        badge: 'ASSISTED',
        defaultPrice: 6000,
        color: '#DC2626',
        bgColor: '#FEF2F2',
    },
    {
        id: 'enrollment',
        pricingId: 'bvn_enrollment',
        title: 'User Enrollment',
        desc: 'Assisted new BVN holder biometric setup',
        icon: 'person-add',
        route: '/(app)/bvn-services/enrollment',
        category: 'modification',
        badge: 'NEW ENROLL',
        defaultPrice: 2000,
        color: '#059669',
        bgColor: '#ECFDF5',
    },
    {
        id: 'history',
        pricingId: 'history',
        title: 'BVN History & Logs',
        desc: 'Past searches & free instant reprints',
        icon: 'time',
        route: '/(app)/bvn-services/history',
        category: 'desk',
        badge: 'HISTORY',
        defaultPrice: 0,
        color: '#64748B',
        bgColor: '#F1F5F9',
    },
];

export default function BVNServicesGatewayScreen() {
    const insets = useSafeAreaInsets();
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [filterCategory, setFilterCategory] = useState<'all' | 'instant' | 'retrieval' | 'modification'>('all');
    const [refreshing, setRefreshing] = useState(false);
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

    const fetchServiceVisibilityAndPrices = async () => {
        try {
            const map: Record<string, { status: string; msg?: string }> = {};
            const priceMap: Record<string, number> = {};

            // 1. Fetch bvn_service_controls from app_settings
            const { data: configData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'bvn_service_controls')
                .maybeSingle();

            if (configData?.value) {
                try {
                    const parsed = typeof configData.value === 'string' ? JSON.parse(configData.value) : configData.value;
                    if (parsed?.global_status) setGlobalBVNStatus(parsed.global_status);
                    if (parsed?.global_maintenance_msg) setGlobalBVNMsg(parsed.global_maintenance_msg);
                    if (parsed?.services) {
                        Object.entries(parsed.services).forEach(([id, svc]: [string, any]) => {
                            map[id] = {
                                status: svc.status || 'active',
                                msg: svc.maintenance_msg,
                            };
                        });
                    }
                    if (Array.isArray(parsed?.hidden_services)) {
                        parsed.hidden_services.forEach((id: string) => {
                            map[id] = { ...(map[id] || {}), status: 'hidden' };
                        });
                    }
                } catch (e) {
                    console.warn('Error parsing bvn_service_controls in user app:', e);
                }
            }

            // 2. Fetch from service_pricing table
            const { data: pricingRows } = await supabase
                .from('service_pricing')
                .select('id, cost_price, markup_price, selling_price, status, maintenance_msg')
                .eq('service_category', 'bvn');

            if (pricingRows && pricingRows.length > 0) {
                pricingRows.forEach(row => {
                    if (row.status) {
                        map[row.id] = {
                            status: row.status,
                            msg: row.maintenance_msg || map[row.id]?.msg,
                        };
                    }
                    const total = row.selling_price
                        ? Number(row.selling_price)
                        : (Number(row.cost_price || 0) + Number(row.markup_price || 0));
                    if (total > 0) {
                        priceMap[row.id] = total;
                    }
                });
            }

            setServiceStatuses(map);
            setPrices(priceMap);
        } catch (e) {
            console.warn('Failed to load BVN service statuses and prices', e);
        }
    };

    const loadData = async () => {
        await Promise.all([fetchWalletBalance(), fetchServiceVisibilityAndPrices()]);
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const handleServicePress = (service: BVNServiceItem) => {
        if (globalBVNStatus === 'maintenance') {
            setAlertConfig({
                visible: true,
                title: 'Gateway Maintenance',
                message: globalBVNMsg,
                type: 'warning',
            });
            return;
        }

        const currentStatusObj = serviceStatuses[service.pricingId] || serviceStatuses[service.id];
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
    const isVisible = (service: BVNServiceItem) => {
        const statusById = serviceStatuses[service.id]?.status;
        const statusByPricingId = serviceStatuses[service.pricingId]?.status;
        return statusById !== 'hidden' && statusByPricingId !== 'hidden';
    };

    const visibleServices = BVN_SERVICES.filter(service => isVisible(service));
    const filteredServices = visibleServices.filter(service => {
        if (filterCategory === 'all') return true;
        return service.category === filterCategory;
    });

    const heroService = BVN_SERVICES[0];
    const heroPrice = prices[heroService.pricingId] || heroService.defaultPrice;
    const heroMaint = serviceStatuses[heroService.pricingId]?.status === 'maintenance';

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Obsidian & Imperial Gold Modern Header */}
            <LinearGradient
                colors={['#070D1E', '#0F172A', '#1E293B']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 16 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.headerRightActions}>
                        <View style={styles.secureBadge}>
                            <View style={[styles.secureDot, globalBVNStatus === 'maintenance' && { backgroundColor: '#F59E0B' }]} />
                            <Text style={styles.secureText}>
                                {globalBVNStatus === 'maintenance' ? 'GATEWAY UNDER MAINTENANCE' : 'SKBTECH LIVE • NIBSS CONNECTED'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push('/(app)/bvn-services/history' as any)}
                            style={styles.historyBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="time-outline" size={14} color="#FCD34D" style={{ marginRight: 4 }} />
                            <Text style={styles.historyBtnTxt}>History</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <View style={styles.titleIconBox}>
                        <Ionicons name="finger-print" size={20} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.titleText}>Bank Verification Number</Text>
                        <Text style={styles.subtitleText}>Official NIBSS Biometric Identity Gateway</Text>
                    </View>
                </View>

                {/* Compact Wallet Bar */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <View style={styles.walletIconWrap}>
                            <Ionicons name="wallet-outline" size={15} color="#D97706" />
                        </View>
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.walletLabel}>Available Balance</Text>
                            <Text style={styles.walletVal}>
                                {userBalance !== null ? `₦${userBalance.toLocaleString()}` : '...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.fundBtn}
                        onPress={() => router.push('/(app)/wallet/fund' as any)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={13} color="#070D1E" />
                        <Text style={styles.fundBtnText}>Top Up</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]} 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D97706" />}
            >
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

                {/* 🌟 HERO CARD: BVN Verification & Printable Slip 🌟 */}
                {isVisible(heroService) && (
                    <TouchableOpacity
                        onPress={() => handleServicePress(heroService)}
                        activeOpacity={0.9}
                        style={styles.heroCard}
                    >
                        <LinearGradient
                            colors={['#0F172A', '#1C2541', '#0B132B']}
                            style={styles.heroGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.heroTopRow}>
                                <View style={styles.heroBadge}>
                                    <Ionicons name="flash" size={10} color="#F59E0B" style={{ marginRight: 4 }} />
                                    <Text style={styles.heroBadgeTxt}>INSTANT API • SKBTECH</Text>
                                </View>
                                {heroMaint ? (
                                    <View style={styles.maintPill}>
                                        <Text style={styles.maintPillText}>MAINTENANCE</Text>
                                    </View>
                                ) : (
                                    <View style={styles.heroPricePill}>
                                        <Text style={styles.heroPriceTxt}>₦{heroPrice.toLocaleString()}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.heroBody}>
                                <View style={styles.heroIconBox}>
                                    <Ionicons name="finger-print" size={28} color="#F59E0B" />
                                </View>
                                <View style={styles.heroTextWrap}>
                                    <Text style={styles.heroTitle}>{heroService.title}</Text>
                                    <Text style={styles.heroDesc}>{heroService.desc}</Text>
                                </View>
                            </View>

                            <View style={styles.heroFooter}>
                                <View style={styles.heroFormatsRow}>
                                    <Text style={styles.formatChip}>Instant Lookup</Text>
                                    <Text style={styles.formatChip}>HD ID Card</Text>
                                    <Text style={styles.formatChip}>PDF Slip</Text>
                                </View>
                                <View style={styles.heroActionBtn}>
                                    <Text style={styles.heroActionTxt}>Verify Now</Text>
                                    <Ionicons name="arrow-forward" size={12} color="#070D1E" />
                                </View>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Dynamic Marketing Banner Slider */}
                <DynamicBanners />

                {/* Category Filter Pills */}
                <View style={styles.categoryRow}>
                    {[
                        { id: 'all', label: 'All Services' },
                        { id: 'instant', label: 'Instant API' },
                        { id: 'retrieval', label: 'Retrieval & CRM' },
                        { id: 'modification', label: 'Modifications' },
                    ].map(tab => {
                        const active = filterCategory === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setFilterCategory(tab.id as any)}
                                style={[styles.categoryBtn, active && styles.categoryBtnActive]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.categoryTxt, active && styles.categoryTxtActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Services List / Grid */}
                <View style={styles.serviceList}>
                    {filteredServices
                        .filter(s => s.id !== 'verify' || filterCategory !== 'all')
                        .map((service) => {
                            const isMaint = serviceStatuses[service.pricingId]?.status === 'maintenance';
                            const priceVal = prices[service.pricingId] || service.defaultPrice;

                            return (
                                <TouchableOpacity
                                    key={service.id}
                                    onPress={() => handleServicePress(service)}
                                    style={[styles.serviceRow, isMaint && styles.serviceRowMaint]}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.serviceIconWrap, { backgroundColor: service.bgColor }]}>
                                        <Ionicons name={service.icon} size={20} color={isMaint ? '#B45309' : service.color} />
                                    </View>

                                    <View style={styles.serviceTextCol}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <Text style={styles.serviceRowTitle}>{service.title}</Text>
                                            {service.badge ? (
                                                <View style={styles.badgePill}>
                                                    <Text style={styles.badgePillTxt}>{service.badge}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={styles.serviceRowDesc} numberOfLines={1}>{service.desc}</Text>
                                    </View>

                                    <View style={styles.servicePriceCol}>
                                        {isMaint ? (
                                            <View style={styles.maintPillSmall}>
                                                <Text style={styles.maintPillSmallTxt}>MAINT</Text>
                                            </View>
                                        ) : priceVal > 0 ? (
                                            <View style={styles.priceChip}>
                                                <Text style={styles.priceChipTxt}>₦{priceVal.toLocaleString()}</Text>
                                            </View>
                                        ) : (
                                            <View style={[styles.priceChip, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                                                <Text style={[styles.priceChipTxt, { color: '#64748B' }]}>FREE</Text>
                                            </View>
                                        )}
                                        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginLeft: 6 }} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                </View>

                {/* Support Banner */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <View style={styles.supportIconWrap}>
                            <Ionicons name="headset-outline" size={16} color="#D97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.supportTitle}>Need Help with BVN?</Text>
                            <Text style={styles.supportDesc}>Contact our support team for any issues or guidance</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.supportButton}
                        activeOpacity={0.8}
                        onPress={() => router.push('/(app)/support' as any)}
                    >
                        <Text style={styles.supportBtnTxt}>Support</Text>
                        <Ionicons name="chevron-forward" size={12} color="#D97706" />
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
    container: { 
        flex: 1, 
        backgroundColor: '#F8FAFC' 
    },
    headerGradient: { 
        paddingHorizontal: 16, 
        borderBottomLeftRadius: 22, 
        borderBottomRightRadius: 22,
        shadowColor: '#070D1E',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 4,
    },
    headerTop: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 10 
    },
    backButton: { 
        width: 34, 
        height: 34, 
        borderRadius: 12, 
        backgroundColor: 'rgba(255,255,255,0.08)', 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    secureBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: 'rgba(255,255,255,0.08)', 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: 'rgba(255,255,255,0.12)' 
    },
    secureDot: { 
        width: 5, 
        height: 5, 
        borderRadius: 2.5, 
        backgroundColor: '#10B981', 
        marginRight: 5 
    },
    secureText: { 
        color: '#ffffff', 
        fontSize: 9, 
        fontWeight: '800', 
        letterSpacing: 0.4 
    },
    historyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217,119,6,0.18)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
    },
    historyBtnTxt: {
        color: '#FCD34D',
        fontSize: 10.5,
        fontWeight: '800',
    },
    titleRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10, 
        marginBottom: 10 
    },
    titleIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(217,119,6,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.4)',
    },
    titleText: { 
        color: '#ffffff', 
        fontSize: 18, 
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    subtitleText: { 
        color: '#94A3B8', 
        fontSize: 11, 
        marginTop: 1 
    },
    walletBar: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'rgba(255,255,255,0.06)', 
        borderRadius: 12, 
        paddingHorizontal: 12, 
        paddingVertical: 8, 
        borderWidth: 1, 
        borderColor: 'rgba(245,158,11,0.25)' 
    },
    walletLeft: { 
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    walletIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(217,119,6,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletLabel: { 
        color: '#94A3B8', 
        fontSize: 9.5, 
        fontWeight: '600' 
    },
    walletVal: { 
        color: '#ffffff', 
        fontSize: 13, 
        fontWeight: '900', 
        marginTop: 1 
    },
    fundBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F59E0B', 
        paddingHorizontal: 10, 
        paddingVertical: 5, 
        borderRadius: 8, 
        gap: 4 
    },
    fundBtnText: { 
        color: '#070D1E', 
        fontSize: 11, 
        fontWeight: '900' 
    },
    content: { 
        flex: 1 
    },
    scrollContent: { 
        paddingHorizontal: 16,
        paddingTop: 14 
    },

    globalMaintBanner: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 14,
    },
    globalMaintTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#B45309',
    },
    globalMaintDesc: {
        fontSize: 10.5,
        color: '#92400E',
        marginTop: 2,
        lineHeight: 14,
    },

    // Hero Card
    heroCard: {
        borderRadius: 18,
        marginBottom: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#D97706',
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    heroGradient: {
        padding: 14,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245,158,11,0.18)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
    },
    heroBadgeTxt: {
        fontSize: 9,
        fontWeight: '900',
        color: '#FCD34D',
        letterSpacing: 0.4,
    },
    heroPricePill: {
        backgroundColor: '#D97706',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    heroPriceTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '900',
    },
    heroBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    heroIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(245,158,11,0.4)',
    },
    heroTextWrap: {
        flex: 1,
    },
    heroTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    heroDesc: {
        fontSize: 11,
        color: '#CBD5E1',
        lineHeight: 15,
    },
    heroFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 10,
    },
    heroFormatsRow: {
        flexDirection: 'row',
        gap: 5,
    },
    formatChip: {
        fontSize: 9,
        fontWeight: '700',
        color: '#FCD34D',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.25)',
    },
    heroActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    heroActionTxt: {
        color: '#070D1E',
        fontSize: 11,
        fontWeight: '900',
    },

    // Category Filter
    categoryRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    categoryBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    categoryBtnActive: {
        backgroundColor: '#070D1E',
        borderColor: '#070D1E',
    },
    categoryTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    categoryTxtActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },

    // Service Rows
    serviceList: {
        gap: 8,
        marginBottom: 16,
    },
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    serviceRowMaint: {
        opacity: 0.7,
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
    },
    serviceIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    serviceTextCol: {
        flex: 1,
    },
    serviceRowTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    serviceRowDesc: {
        fontSize: 10.5,
        color: '#64748B',
    },
    badgePill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    badgePillTxt: {
        fontSize: 8,
        fontWeight: '900',
        color: '#B45309',
    },
    servicePriceCol: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    priceChip: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    priceChipTxt: {
        color: '#B45309',
        fontSize: 10.5,
        fontWeight: '900',
    },
    maintPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    maintPillText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#B45309',
    },
    maintPillSmall: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    maintPillSmallTxt: {
        fontSize: 8,
        fontWeight: '900',
        color: '#B45309',
    },

    // Support Banner
    supportBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    supportLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    supportIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    supportTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
    },
    supportDesc: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1,
    },
    supportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FDE68A',
        gap: 2,
    },
    supportBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#B45309',
    },
});
