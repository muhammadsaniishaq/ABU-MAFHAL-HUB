import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
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
  category: 'instant' | 'retrieval' | 'modification';
  defaultPrice: number;
}

const BVN_SERVICES: BVNServiceItem[] = [
  {
    id: 'verify',
    pricingId: 'bvn_num_advanced',
    title: 'BVN Verification',
    shortTitle: 'Verify BVN',
    desc: 'Biometric verification & HD printable card',
    icon: 'finger-print',
    route: '/(app)/bvn-services/verify',
    category: 'instant',
    defaultPrice: 150,
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
    defaultPrice: 150,
  },
  {
    id: 'retrieval',
    pricingId: 'bvn_retrieval_phone',
    title: 'Phone Retrieval',
    shortTitle: 'By Phone',
    desc: 'Recover lost BVN using linked mobile number',
    icon: 'call',
    route: '/(app)/bvn-services/retrieval',
    category: 'retrieval',
    defaultPrice: 1000,
  },
  {
    id: 'central-risk',
    pricingId: 'bvn_retrieval_crm',
    title: 'CRM Retrieval',
    shortTitle: 'CRM Ticket',
    desc: 'Central Risk Management ticket search',
    icon: 'search',
    route: '/(app)/bvn-services/retrieval',
    category: 'retrieval',
    defaultPrice: 700,
  },
  {
    id: 'vnin-to-nibss',
    pricingId: 'vnin_to_nibss',
    title: 'VNIN to NIBSS',
    shortTitle: 'NIBSS Link',
    desc: 'Link VNIN directly to NIBSS database',
    icon: 'link',
    route: '/(app)/bvn-services/vnin-to-nibss',
    category: 'retrieval',
    defaultPrice: 700,
  },
  {
    id: 'modification',
    pricingId: 'bvn_mod_name',
    title: 'BVN Modification',
    shortTitle: 'Modification',
    desc: 'Official correction of Name, DOB or Phone',
    icon: 'create',
    route: '/(app)/bvn-services/modification',
    category: 'modification',
    defaultPrice: 7000,
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
    defaultPrice: 2000,
  },
  {
    id: 'track',
    pricingId: 'track_status',
    title: 'Track Request',
    shortTitle: 'Track Status',
    desc: 'Live query on ongoing request progress',
    icon: 'shield-checkmark',
    route: '/(app)/bvn-services/retrieval',
    category: 'retrieval',
    defaultPrice: 0,
  },
  {
    id: 'history',
    pricingId: 'history',
    title: 'History & Logs',
    shortTitle: 'History',
    desc: 'Past searches & free instant reprints',
    icon: 'time',
    route: '/(app)/bvn-services/history',
    category: 'instant',
    defaultPrice: 0,
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
  const [globalBVNMsg, setGlobalBVNMsg] = useState('Gateway is undergoing maintenance. Services will resume shortly.');

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

      // 1. Fetch saved controls from app_settings
      const { data: configData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['bvn_service_controls', 'bvn_global_status', 'bvn_global_maintenance_msg']);

      if (configData && configData.length > 0) {
        configData.forEach(row => {
          if (row.key === 'bvn_global_status' && typeof row.value === 'string') {
            setGlobalBVNStatus(row.value as any);
          } else if (row.key === 'bvn_global_maintenance_msg' && typeof row.value === 'string') {
            setGlobalBVNMsg(row.value);
          } else if (row.key === 'bvn_service_controls' && row.value) {
            try {
              const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
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
        });
      }

      // 2. Fetch live status & prices from service_pricing table
      const { data: pricingData } = await supabase
        .from('service_pricing')
        .select('id, cost_price, markup_price, status, maintenance_msg')
        .eq('service_category', 'bvn');

      if (pricingData) {
        pricingData.forEach((row: any) => {
          const st = row.status || 'active';
          map[row.id] = {
            status: st,
            msg: row.maintenance_msg || (st === 'maintenance' ? 'Service is temporarily under maintenance.' : undefined),
          };
          const total = Number(row.cost_price || 0) + Number(row.markup_price || 0);
          if (total > 0) {
            priceMap[row.id] = total;
          }
        });
      }

      // Alias synchronizations
      if (map['bvn_retrieval_crm']) {
        map['bvn_central_risk'] = map['bvn_retrieval_crm'];
      }
      if (map['bvn_retrieval_phone']) {
        map['retrieval'] = map['bvn_retrieval_phone'];
      }
      if (map['bvn_num_advanced']) {
        map['verify'] = map['bvn_num_advanced'];
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
    // 1. Global maintenance check
    if (globalBVNStatus === 'maintenance') {
      setAlertConfig({
        visible: true,
        title: 'Gateway Maintenance',
        message: globalBVNMsg,
        type: 'warning',
      });
      return;
    }

    // 2. Individual service maintenance check
    const currentStatusObj = serviceStatuses[service.pricingId] || serviceStatuses[service.id];
    if (currentStatusObj && currentStatusObj.status === 'maintenance') {
      setAlertConfig({
        visible: true,
        title: `${service.title} - Maintenance`,
        message: currentStatusObj.msg || `${service.title} is currently paused for routine optimization.`,
        type: 'warning',
      });
      return;
    }

    // 3. Security Pre-Check: Strict Balance Validation before launching service
    const price = prices[service.pricingId] || service.defaultPrice;
    if (userBalance !== null && userBalance < price && price > 0) {
      setAlertConfig({
        visible: true,
        title: 'Insufficient Balance',
        message: `This service requires ₦${price.toLocaleString()}. Your current wallet balance is ₦${userBalance.toLocaleString()}. Please top up your wallet.`,
        type: 'warning',
      });
      return;
    }

    router.push(service.route as any);
  };

  const isVisible = (service: BVNServiceItem) => {
    if (globalBVNStatus === 'hidden') return false;
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
  const heroMaint = serviceStatuses[heroService.pricingId]?.status === 'maintenance';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* Royal Obsidian Navy & Imperial Gold Header */}
      <LinearGradient
        colors={['#071630', '#0B2044', '#102E5C']}
        style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 4, paddingBottom: 16 }]}
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
                {globalBVNStatus === 'maintenance' ? 'GATEWAY UNDER MAINTENANCE' : 'OFFICIAL LIVE • NIBSS'}
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
            <Text style={styles.titleText}>Bank Verification Portal</Text>
            <Text style={styles.subtitleText}>Official Biometric Identity Gateway</Text>
          </View>
        </View>

        {/* Executive Wallet Balance Pill in Navy & Gold */}
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
            <Ionicons name="add-circle" size={13} color="#071630" />
            <Text style={styles.fundBtnText}>Top Up</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B2044" />}
      >
        {/* Global Maintenance Banner */}
        {globalBVNStatus === 'maintenance' && (
          <View style={styles.globalMaintBanner}>
            <Ionicons name="construct-outline" size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.globalMaintTitle}>Gateway Maintenance</Text>
              <Text style={styles.globalMaintDesc}>{globalBVNMsg}</Text>
            </View>
          </View>
        )}

        {/* 🌟 LUXURY HERO SPOTLIGHT CARD: BVN Verification (NO AMOUNT ON FRONT PAGE) 🌟 */}
        {isVisible(heroService) && (
          <TouchableOpacity
            onPress={() => handleServicePress(heroService)}
            activeOpacity={0.88}
            style={styles.heroCard}
          >
            <LinearGradient
              colors={['#071630', '#0B2246', '#112D5E']}
              style={styles.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="flash" size={10} color="#F5A623" style={{ marginRight: 4 }} />
                  <Text style={styles.heroBadgeTxt}>INSTANT API • NIBSS</Text>
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
                  <Ionicons name="finger-print" size={26} color="#F5A623" />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>{heroService.title}</Text>
                  <Text style={styles.heroDesc}>{heroService.desc}</Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroFooterLeft}>
                  <Ionicons name="checkmark-circle" size={13} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.heroFooterTxt}>Instant Digital ID & Slip</Text>
                </View>
                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionTxt}>Verify Now</Text>
                  <Ionicons name="arrow-forward" size={12} color="#071630" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Refined Dignified Trust Strip */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={14} color="#071630" />
            <Text style={styles.trustText}>NIBSS Direct</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="flash" size={14} color="#D4AF37" />
            <Text style={styles.trustText}>Instant Slips</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="refresh-circle" size={15} color="#10B981" />
            <Text style={styles.trustText}>Auto-Refund</Text>
          </View>
        </View>

        {/* Section Header & Minimal Category Filter Tabs */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="grid-outline" size={15} color="#071630" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>ALL BVN SERVICES</Text>
          </View>

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

        {/* 🌟 3-COLUMN LUXURY MINIMALIST GRID (NO NOISE, NO AMOUNT ON FRONT) 🌟 */}
        <View style={styles.gridContainer}>
          {filteredServices.map(service => renderServiceGridCard(service))}
        </View>

        {/* Dignified 24/7 Support Strip */}
        <View style={styles.supportBanner}>
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons name="headset-outline" size={18} color="#071630" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Need Help with BVN?</Text>
              <Text style={styles.supportDesc}>Our identity support desk is active 24/7</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.supportButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(app)/support' as any)}
          >
            <Text style={styles.supportBtnTxt}>Support</Text>
            <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
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
          {/* Top Status Dot: Clean, minimal, zero clutter */}
          <View style={styles.gridCardTopRow}>
            {isMaint ? (
              <View style={styles.maintDot} />
            ) : (
              <View style={styles.liveDot} />
            )}
          </View>

          {/* Centered Circular Navy & Gold Icon Frame */}
          <View style={styles.gridIconFrame}>
            <Ionicons name={service.icon} size={22} color="#071630" />
          </View>

          {/* Bold, Legible Royal Navy Title */}
          <Text style={styles.gridCardTitle} numberOfLines={2}>
            {service.shortTitle || service.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },
  headerGradient: {
    paddingHorizontal: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 166, 35, 0.3)',
    shadowColor: '#071630',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  secureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  secureText: {
    color: '#F5A623',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
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
    marginBottom: 12,
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitleText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
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
    color: '#F5A623',
    fontSize: 14,
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
    color: '#071630',
    fontSize: 11,
    fontWeight: '900',
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },

  globalMaintBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  globalMaintTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
  },
  globalMaintDesc: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 15,
  },

  // Hero Card in Obsidian Navy & Gold
  heroCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    shadowColor: '#071630',
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
  heroFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroFooterTxt: {
    color: '#E2E8F0',
    fontSize: 10.5,
    fontWeight: '700',
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
    color: '#071630',
    fontSize: 11,
    fontWeight: '900',
  },

  // Dignified Trust Strip
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
    shadowColor: '#071630',
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

  // Section Header & Segmented Filter
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#071630',
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
    borderRadius: 6,
  },
  categoryBtnActive: {
    backgroundColor: '#071630',
  },
  categoryTxt: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  categoryTxtActive: {
    color: '#FFFFFF',
    fontWeight: '900',
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
    borderColor: 'rgba(7, 22, 48, 0.08)',
    shadowColor: '#071630',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  gridCardMaint: {
    opacity: 0.6,
    borderColor: '#FECACA',
  },
  gridCardInner: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 108,
  },
  gridCardTopRow: {
    position: 'absolute',
    top: 7,
    right: 7,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  maintDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  gridIconFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F4FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    marginBottom: 8,
  },
  gridCardTitle: {
    color: '#071630',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
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
    shadowColor: '#071630',
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
    color: '#071630',
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
    backgroundColor: '#071630',
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
