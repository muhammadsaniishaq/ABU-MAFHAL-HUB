import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
import DynamicBanners from '../../../components/DynamicBanners';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

const { width } = Dimensions.get('window');

interface BVNServiceItem {
    id: string;
    pricingId: string;
    title: string;
    shortTitle: string;
    desc: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    category: 'instant' | 'retrieval' | 'modification' | 'desk';
    badge: string;
    defaultPrice: number;
    color: string;
}

const BVN_SERVICES: BVNServiceItem[] = [
    {
        id: 'verify',
        pricingId: 'bvn_num_advanced',
        title: 'BVN Verification',
        shortTitle: 'Verify BVN',
        desc: 'Instant biometric lookup & HD Printable Card',
        icon: 'finger-print',
        route: '/(app)/bvn-services/verify',
        category: 'instant',
        badge: 'INSTANT API',
        defaultPrice: 100,
        color: '#F5A623',
    },
    {
        id: 'premium-slip',
        pricingId: 'bvn_premium_slip',
        title: 'BVN Premium Slip',
        shortTitle: 'Print Slip',
        desc: 'Official electronic printable PDF slip',
        icon: 'document-text',
        route: '/(app)/bvn-services/premium-slip',
        category: 'instant',
        badge: 'PDF SLIP',
        defaultPrice: 100,
        color: '#F5A623',
    },
    {
        id: 'retrieval',
        pricingId: 'bvn_retrieval_phone',
        title: 'Phone Retrieval',
        shortTitle: 'By Phone',
        desc: 'Recover lost BVN using linked phone number',
        icon: 'call',
        route: '/(app)/bvn-services/retrieval',
        category: 'retrieval',
        badge: 'PHONE',
        defaultPrice: 800,
        color: '#F5A623',
    },
    {
        id: 'central-risk',
        pricingId: 'bvn_central_risk',
        title: 'CRM Retrieval',
        shortTitle: 'CRM Ticket',
        desc: 'Retrieve BVN via Central Risk Management ticket',
        icon: 'search',
        route: '/(app)/bvn-services/retrieval',
        category: 'retrieval',
        badge: 'CRM',
        defaultPrice: 700,
        color: '#F5A623',
    },
    {
        id: 'vnin-to-nibss',
        pricingId: 'vnin_to_nibss',
        title: 'VNIN to NIBSS',
        shortTitle: 'NIBSS Link',
        desc: 'Link VNIN directly to NIBSS database records',
        icon: 'link',
        route: '/(app)/bvn-services/vnin-to-nibss',
        category: 'retrieval',
        badge: 'NIBSS SYNC',
        defaultPrice: 700,
        color: '#F5A623',
    },
    {
        id: 'modification',
        pricingId: 'bvn_mod_name',
        title: 'BVN Modification',
        shortTitle: 'Modification',
        desc: 'Official correction of Name, DOB, Phone or Address',
        icon: 'create',
        route: '/(app)/bvn-services/modification',
        category: 'modification',
        badge: 'ASSISTED',
        defaultPrice: 6000,
        color: '#F5A623',
    },
    {
        id: 'enrollment',
        pricingId: 'bvn_enrollment',
        title: 'User Enrollment',
        shortTitle: 'Enrollment',
        desc: 'Assisted new BVN holder biometric setup',
        icon: 'person-add',
        route: '/(app)/bvn-services/enrollment',
        category: 'modification',
        badge: 'NEW ENROLL',
        defaultPrice: 2000,
        color: '#F5A623',
    },
    {
        id: 'track',
        pricingId: 'track_status',
        title: 'Track Request',
        shortTitle: 'Track Status',
        desc: 'Free live progress query on retrieval or modification',
        icon: 'shield-checkmark',
        route: '/(app)/bvn-services/retrieval',
        category: 'retrieval',
        badge: 'FREE',
        defaultPrice: 0,
        color: '#F5A623',
    },
    {
        id: 'history',
        pricingId: 'history',
        title: 'History & Logs',
        shortTitle: 'History',
        desc: 'Past searches & free instant reprints',
        icon: 'time',
        route: '/(app)/bvn-services/history',
        category: 'desk',
        badge: 'HISTORY',
        defaultPrice: 0,
        color: '#F5A623',
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
                } catch (_) {}
            }

            // 2. Fetch prices from service_pricing table
            const { data: pricingData } = await supabase
                .from('service_pricing')
                .select('id, cost_price, markup_price, selling_price, status, maintenance_msg');

            if (pricingData) {
                pricingData.forEach((row: any) => {
                    if (row.status === 'maintenance' || row.status === 'hidden') {
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
                colors={['#060D21', '#0B192C', '#122547']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 16 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={18} color="#F5A623" />
                    </TouchableOpacity>
                    <View style={styles.headerRightActions}>
                        <View style={styles.secureBadge}>
                            <View style={[styles.secureDot, globalBVNStatus === 'maintenance' && { backgroundColor: '#EF4444' }]} />
                            <Text style={styles.secureText}>
                                {globalBVNStatus === 'maintenance' ? 'GATEWAY UNDER MAINTENANCE' : 'SKBTECH LIVE • NIBSS CONNECTED'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push('/(app)/bvn-services/history' as any)}
                            style={styles.historyBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="time-outline" size={14} color="#F5A623" style={{ marginRight: 4 }} />
                            <Text style={styles.historyBtnTxt}>History</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <View style={styles.titleIconBox}>
                        <Ionicons name="finger-print" size={20} color="#F5A623" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.titleText}>Bank Verification Number</Text>
                        <Text style={styles.subtitleText}>Official NIBSS Biometric Identity Gateway</Text>
                    </View>
                </View>

                {/* Compact Wallet Bar in Navy & Gold */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <View style={styles.walletIconWrap}>
                            <Ionicons name="wallet-outline" size={15} color="#F5A623" />
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
                        <Ionicons name="add-circle" size={13} color="#060D21" />
                        <Text style={styles.fundBtnText}>Top Up</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]} 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A623" />}
            >
                {/* Global Maintenance Banner */}
                {globalBVNStatus === 'maintenance' && (
                    <View style={styles.globalMaintBanner}>
                        <Ionicons name="construct-outline" size={18} color="#F5A623" />
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
                        activeOpacity={0.88}
                        style={styles.heroCard}
                    >
                        <LinearGradient
                            colors={['#0B2246', '#0F2C59', '#14376F']}
                            style={styles.heroGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.heroTopRow}>
                                <View style={styles.heroBadge}>
                                    <Ionicons name="flash" size={10} color="#F5A623" style={{ marginRight: 4 }} />
                                    <Text style={styles.heroBadgeTxt}>INSTANT API • SKBTECH</Text>
                                </View>
                                {heroMaint ? (
                                    <View style={styles.maintPill}>
                                        <Text style={styles.maintPillText}>MAINTENANCE</Text>
                                    </View>
                                ) : (
                                    <View style={styles.heroStatusPill}>
                                        <Ionicons name="shield-checkmark" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                        <Text style={styles.heroStatusTxt}>OFFICIAL BVN</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.heroBody}>
                                <View style={styles.heroIconBox}>
                                    <Ionicons name="finger-print" size={28} color="#F5A623" />
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
                                    <Ionicons name="arrow-forward" size={12} color="#060D21" />
                                </View>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Decorative Trust Strip (Navy & Gold) */}
                <View style={styles.trustStrip}>
                    <View style={styles.trustItem}>
                        <Ionicons name="shield-checkmark" size={14} color="#F5A623" />
                        <Text style={styles.trustText}>NIBSS Direct</Text>
                    </View>
                    <View style={styles.trustDivider} />
                    <View style={styles.trustItem}>
                        <Ionicons name="flash" size={14} color="#F5A623" />
                        <Text style={styles.trustText}>HD Slips</Text>
                    </View>
                    <View style={styles.trustDivider} />
                    <View style={styles.trustItem}>
                        <Ionicons name="refresh-circle" size={15} color="#F5A623" />
                        <Text style={styles.trustText}>Auto-Refund</Text>
                    </View>
                </View>

                {/* Dynamic Marketing Banner Slider */}
                <DynamicBanners />

                {/* Section Header with Category Filter Pills */}
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="grid-outline" size={15} color="#F5A623" style={{ marginRight: 6 }} />
                        <Text style={styles.sectionTitle}>ALL BVN SERVICES</Text>
                    </View>

                    {/* Filter Pills */}
                    <View style={styles.categoryRow}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'instant', label: 'Instant' },
                            { id: 'retrieval', label: 'Retrieval' },
                            { id: 'modification', label: 'Mods' },
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
                </View>

                {/* 🌟 3-COLUMN MODERN GRID (NAVY & GOLD) 🌟 */}
                <View style={styles.gridContainer}>
                    {filteredServices.map((service) => renderServiceGridCard(service))}
                </View>

                {/* Executive 24/7 Support Strip */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <View style={styles.supportIconWrap}>
                            <Ionicons name="headset-outline" size={18} color="#F5A623" />
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
                        <Ionicons name="chevron-forward" size={12} color="#060D21" />
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

    function renderServiceGridCard(service: BVNServiceItem) {
        const isMaint = serviceStatuses[service.pricingId]?.status === 'maintenance' || serviceStatuses[service.id]?.status === 'maintenance';

        return (
            <TouchableOpacity
                key={service.id}
                onPress={() => handleServicePress(service)}
                style={[styles.gridCard, isMaint && styles.gridCardMaint]}
                activeOpacity={0.78}
            >
                <View style={styles.gridCardInner}>
                    {/* Top Micro-Bar: Category Tag & Status (NO AMOUNT ON FRONT PAGE) */}
                    <View style={styles.gridCardTopRow}>
                        <View style={styles.gridCategoryBadge}>
                            <Text style={styles.gridCategoryBadgeTxt}>{service.badge}</Text>
                        </View>

                        {isMaint ? (
                            <Text style={styles.gridMaintTxt}>MAINT</Text>
                        ) : (
                            <View style={styles.gridActiveTag}>
                                <View style={styles.gridActiveDot} />
                                <Text style={styles.gridActiveTxt}>ACTIVE</Text>
                            </View>
                        )}
                    </View>

                    {/* Centered Glowing Gold & Navy Icon */}
                    <View style={styles.gridIconFrame}>
                        <Ionicons name={service.icon} size={22} color="#0B2246" />
                    </View>

                    {/* Title in Deep Navy */}
                    <Text style={styles.gridCardTitle} numberOfLines={2}>
                        {service.shortTitle || service.title}
                    </Text>

                    {/* Bottom Feature Pill */}
                    <View style={styles.gridCardBottomChip}>
                        <Text style={styles.gridCardBottomChipTxt} numberOfLines={1}>
                            {service.id === 'verify' ? 'Card & Slip' :
                             service.id === 'premium-slip' ? 'PDF Print' :
                             service.id === 'retrieval' ? 'Phone Lookup' :
                             service.id === 'central-risk' ? 'Ticket Search' :
                             service.id === 'vnin-to-nibss' ? 'NIBSS Sync' :
                             service.id === 'modification' ? 'Name/DOB' :
                             service.id === 'enrollment' ? 'Agent Desk' :
                             service.id === 'track' ? 'Status Check' : 'Past Records'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#F4F7FC' 
    },
    headerGradient: { 
        paddingHorizontal: 16, 
        borderBottomLeftRadius: 22, 
        borderBottomRightRadius: 22,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245, 166, 35, 0.3)',
        shadowColor: '#071630',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
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
        backgroundColor: 'rgba(245, 166, 35, 0.12)', 
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
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
        backgroundColor: 'rgba(245, 166, 35, 0.12)', 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: 'rgba(245, 166, 35, 0.25)' 
    },
    secureDot: { 
        width: 6, 
        height: 6, 
        borderRadius: 3, 
        backgroundColor: '#10B981', 
        marginRight: 6 
    },
    secureText: { 
        color: '#F5A623', 
        fontSize: 9, 
        fontWeight: '800', 
        letterSpacing: 0.4 
    },
    historyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.35)',
    },
    historyBtnTxt: {
        color: '#F5A623',
        fontSize: 10.5,
        fontWeight: '800',
    },
    titleRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 12 
    },
    titleIconBox: { 
        width: 38, 
        height: 38, 
        borderRadius: 12, 
        backgroundColor: 'rgba(245, 166, 35, 0.15)', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.35)',
    },
    titleText: { 
        color: '#ffffff', 
        fontSize: 18, 
        fontWeight: '900', 
        letterSpacing: -0.3 
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
        backgroundColor: 'rgba(245, 166, 35, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.25)',
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    walletLabel: {
        color: '#CBD5E1',
        fontSize: 9.5,
        fontWeight: '600',
    },
    walletVal: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        marginTop: 1,
    },
    fundBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5A623',
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    fundBtnText: {
        color: '#060D21',
        fontSize: 11,
        fontWeight: '900',
    },

    content: { 
        flex: 1 
    },
    scrollContent: { 
        paddingHorizontal: 14, 
        paddingTop: 12 
    },

    globalMaintBanner: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
        marginBottom: 12,
    },
    globalMaintTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#F5A623',
    },
    globalMaintDesc: {
        fontSize: 10.5,
        color: '#CBD5E1',
        marginTop: 2,
        lineHeight: 14,
    },

    // Hero Card in Navy & Gold
    heroCard: {
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.35)',
        shadowColor: '#F5A623',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
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
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    heroBadgeTxt: {
        color: '#F5A623',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    heroPricePill: {
        backgroundColor: '#F5A623',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    heroPriceTxt: {
        color: '#060D21',
        fontSize: 11,
        fontWeight: '900',
    },
    heroStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    heroStatusTxt: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    maintPill: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    maintPillText: {
        color: '#EF4444',
        fontSize: 9.5,
        fontWeight: '900',
    },
    heroBody: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    heroIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.35)',
        marginRight: 12,
    },
    heroTextWrap: {
        flex: 1,
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    heroDesc: {
        color: '#CBD5E1',
        fontSize: 11,
        marginTop: 2,
        lineHeight: 15,
    },
    heroFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(245, 166, 35, 0.15)',
    },
    heroFormatsRow: {
        flexDirection: 'row',
        gap: 5,
    },
    formatChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        color: '#CBD5E1',
        fontSize: 9,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    heroActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5A623',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    heroActionTxt: {
        color: '#060D21',
        fontSize: 11,
        fontWeight: '900',
    },

    // Trust Strip
    trustStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
        shadowColor: '#0B2246',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    trustItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    trustDivider: {
        width: 1,
        height: 14,
        backgroundColor: '#E2E8F0',
    },
    trustText: {
        color: '#334155',
        fontSize: 10,
        fontWeight: '700',
    },

    // Section Header & Filter Tabs
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sectionTitle: {
        color: '#0B2246',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    categoryRow: { 
        flexDirection: 'row', 
        backgroundColor: '#E2E8F0', 
        borderRadius: 8, 
        padding: 2,
    },
    categoryBtn: { 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 6 
    },
    categoryBtnActive: { 
        backgroundColor: '#0B2246' 
    },
    categoryTxt: { 
        color: '#64748B', 
        fontSize: 10, 
        fontWeight: '700' 
    },
    categoryTxtActive: { 
        color: '#FFFFFF', 
        fontWeight: '900' 
    },

    // 🌟 3-COLUMN MODERN GRID (CLEAN WHITE CARDS, NAVY & GOLD) 🌟
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    gridCard: {
        width: '31.8%',
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0B2246',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 5,
        elevation: 2,
    },
    gridCardMaint: {
        opacity: 0.6,
        borderColor: '#FECACA',
    },
    gridCardInner: {
        paddingVertical: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 128,
    },
    gridCardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 2,
    },
    gridCategoryBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#FDE68A',
    },
    gridCategoryBadgeTxt: {
        color: '#B45309',
        fontSize: 7,
        fontWeight: '900',
    },
    gridActiveTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    gridActiveDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#10B981',
    },
    gridActiveTxt: {
        color: '#10B981',
        fontSize: 7.5,
        fontWeight: '900',
    },
    gridMaintTxt: {
        color: '#EF4444',
        fontSize: 8,
        fontWeight: '900',
    },
    gridIconFrame: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F0F4FA',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        marginVertical: 4,
    },
    gridCardTitle: {
        color: '#0B2246',
        fontSize: 10.5,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 13.5,
        minHeight: 27,
    },
    gridCardBottomChip: {
        marginTop: 3,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: '100%',
        alignItems: 'center',
    },
    gridCardBottomChipTxt: {
        color: '#64748B',
        fontSize: 8,
        fontWeight: '700',
    },

    // Support Banner in Clean White
    supportBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 4,
        shadowColor: '#0B2246',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    supportLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    supportIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F4FA',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 10,
    },
    supportTitle: {
        color: '#0B2246',
        fontSize: 12.5,
        fontWeight: '900',
    },
    supportDesc: {
        color: '#64748B',
        fontSize: 10.5,
        marginTop: 1,
    },
    supportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0B2246',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        gap: 3,
    },
    supportBtnTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
});
