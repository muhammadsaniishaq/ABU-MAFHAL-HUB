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

interface ServiceItem {
  id: string;
  pricingId: string;
  title: string;
  shortTitle: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  category: 'instant' | 'desk';
  badge: 'INSTANT API' | 'ASSISTED DESK';
  defaultPrice: number;
}

const ALL_SERVICES: ServiceItem[] = [
  // 1. Instant Automated API Services
  {
    id: 'nin',
    pricingId: 'nin_premium',
    title: 'Verify & Print Slip',
    shortTitle: 'Print Slip',
    desc: 'Digital ID cards & official slips (PDF & PNG)',
    icon: 'finger-print',
    color: '#F5A623',
    route: '/(app)/nin-services/verify-nin',
    category: 'instant',
    badge: 'INSTANT API',
    defaultPrice: 120,
  },
  {
    id: 'phone',
    pricingId: 'nin_phone',
    title: 'Verify by Phone',
    shortTitle: 'NIN by Phone',
    desc: 'Instant NIN lookup via mobile phone number',
    icon: 'call',
    color: '#F5A623',
    route: '/(app)/nin-services/verify-phone',
    category: 'instant',
    badge: 'INSTANT API',
    defaultPrice: 120,
  },
  {
    id: 'bvn',
    pricingId: 'vnin_val',
    title: 'BVN & VNIN Link',
    shortTitle: 'VNIN Link',
    desc: 'Validate BVN & link identity to NIBSS',
    icon: 'card',
    color: '#F5A623',
    route: '/(app)/nin-services/validation',
    category: 'instant',
    badge: 'INSTANT API',
    defaultPrice: 500,
  },

  // 2. Assisted Desk & NIMC Requests
  {
    id: 'demo',
    pricingId: 'nin_verify',
    title: 'Demographic Search',
    shortTitle: 'Demographics',
    desc: 'Lookup by Full Name, State & Date of Birth',
    icon: 'people',
    color: '#F5A623',
    route: '/(app)/nin-services/demographic',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 300,
  },
  {
    id: 'mod',
    pricingId: 'nin_mod_name',
    title: 'NIN Modification',
    shortTitle: 'Modification',
    desc: 'Update bio, Name, DOB & contact details',
    icon: 'create',
    color: '#F5A623',
    route: '/(app)/nin-services/modification',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 6000,
  },
  {
    id: 'val',
    pricingId: 'nin_val_norecord',
    title: 'NIN Validation',
    shortTitle: 'Validation',
    desc: 'Fix record sync errors & NIMC no-record issues',
    icon: 'checkmark-circle',
    color: '#F5A623',
    route: '/(app)/nin-services/validation',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 700,
  },
  {
    id: 'delink',
    pricingId: 'nin_mod_phone',
    title: 'Delink Phone',
    shortTitle: 'Delink Phone',
    desc: 'Remove old mobile numbers linked to your NIN',
    icon: 'cut',
    color: '#F5A623',
    route: '/(app)/nin-services/delink',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 1500,
  },
  {
    id: 'ipe',
    pricingId: 'ipe_clearance',
    title: 'IPE Clearance',
    shortTitle: 'IPE Clear',
    desc: 'Pre-employment & institutional verification',
    icon: 'briefcase',
    color: '#F5A623',
    route: '/(app)/nin-services/ipe-clearance',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 500,
  },
  {
    id: 'track',
    pricingId: 'pers_status',
    title: 'Tracking Status',
    shortTitle: 'Status Check',
    desc: 'Check progress of ongoing modification or slip',
    icon: 'shield-checkmark',
    color: '#F5A623',
    route: '/(app)/nin-services/tracking',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 0,
  },
];

export default function NINServicesScreen() {
  const insets = useSafeAreaInsets();
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [filterTab, setFilterTab] = useState<'all' | 'instant' | 'desk'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, { status: string; msg?: string }>>({});
  const [globalNINStatus, setGlobalNINStatus] = useState<'active' | 'maintenance' | 'hidden'>('active');
  const [globalNINMsg, setGlobalNINMsg] = useState('Gateway is undergoing maintenance. Services will resume shortly.');

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

  const fetchPricesAndStatuses = async () => {
    try {
      const map: Record<string, { status: string; msg?: string }> = {};
      const priceMap: Record<string, number> = {};

      // 1. Fetch saved controls from app_settings
      const { data: configData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['nin_service_controls', 'nin_global_status', 'nin_global_maintenance_msg']);

      if (configData && configData.length > 0) {
        configData.forEach(row => {
          if (row.key === 'nin_global_status' && typeof row.value === 'string') {
            setGlobalNINStatus(row.value as any);
          } else if (row.key === 'nin_global_maintenance_msg' && typeof row.value === 'string') {
            setGlobalNINMsg(row.value);
          } else if (row.key === 'nin_service_controls' && row.value) {
            try {
              const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
              if (parsed?.global_status) setGlobalNINStatus(parsed.global_status);
              if (parsed?.global_maintenance_msg) setGlobalNINMsg(parsed.global_maintenance_msg);
              if (parsed?.services && typeof parsed.services === 'object') {
                for (const [k, v] of Object.entries(parsed.services as Record<string, any>)) {
                  map[k] = {
                    status: v.status || 'active',
                    msg: v.maintenance_msg || v.maintenance_message || 'Service is temporarily under maintenance.',
                  };
                }
              }
            } catch (_) {}
          }
        });
      }

      // 2. Fetch live status & prices from service_pricing table
      const { data: priceData } = await supabase
        .from('service_pricing')
        .select('id, cost_price, markup_price, status, maintenance_msg')
        .eq('service_category', 'nin');

      if (priceData && Array.isArray(priceData)) {
        for (const item of priceData) {
          const cost = parseFloat(item.cost_price?.toString() || '0');
          const markup = parseFloat(item.markup_price?.toString() || '0');
          const finalPrice = cost + markup;
          priceMap[item.id] = finalPrice;

          const st = item.status || 'active';
          map[item.id] = {
            status: st,
            msg: item.maintenance_msg || (st === 'maintenance' ? 'Service is temporarily under maintenance.' : undefined),
          };
        }
      }

      setServiceStatuses(map);
      setPrices(priceMap);
    } catch (e) {
      console.warn('Error fetching prices and statuses', e);
    }
  };

  useEffect(() => {
    fetchWalletBalance();
    fetchPricesAndStatuses();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletBalance(), fetchPricesAndStatuses()]);
    setRefreshing(false);
  }, []);

  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleServicePress = (service: ServiceItem) => {
    // 1. Global maintenance check
    if (globalNINStatus === 'maintenance') {
      showAlert('Gateway Maintenance', globalNINMsg, 'warning');
      return;
    }

    // 2. Specific service maintenance check
    const statusObj = serviceStatuses[service.pricingId] || serviceStatuses[service.id];
    if (statusObj && (statusObj.status === 'maintenance' || statusObj.status === 'inactive')) {
      showAlert(
        `${service.title} - Maintenance`,
        statusObj.msg || 'This service is currently undergoing routine maintenance. Please try again shortly.',
        'warning'
      );
      return;
    }

    // 3. Low balance check: Protect user & platform from zero balance failures
    const price = prices[service.pricingId] || service.defaultPrice;
    if (userBalance !== null && userBalance < price && price > 0) {
      showAlert(
        'Insufficient Wallet Balance',
        `This service requires ₦${price.toLocaleString()}. Your current wallet balance is ₦${userBalance.toLocaleString()}. Please top up your wallet.`,
        'warning'
      );
      return;
    }

    router.push(service.route as any);
  };

  const isVisible = (service: ServiceItem) => {
    if (globalNINStatus === 'hidden') return false;
    const s = serviceStatuses[service.pricingId] || serviceStatuses[service.id];
    if (s?.status === 'hidden') return false;
    return true;
  };

  const filteredServices = ALL_SERVICES.filter(service => {
    if (!isVisible(service)) return false;
    if (filterTab === 'instant') return service.category === 'instant';
    if (filterTab === 'desk') return service.category === 'desk';
    return true;
  });

  const heroService = ALL_SERVICES[0];
  const heroMaint = serviceStatuses[heroService.pricingId]?.status === 'maintenance';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* Royal Obsidian Navy & Imperial Gold Header */}
      <LinearGradient
        colors={['#071630', '#0B2044', '#102E5C']}
        style={[
          styles.headerGradient,
          { paddingTop: Math.max(insets.top, 20) + 4, paddingBottom: 16 },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#F5A623" />
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, globalNINStatus === 'maintenance' && { backgroundColor: '#EF4444' }]} />
              <Text style={styles.statusPillTxt}>
                {globalNINStatus === 'maintenance' ? 'GATEWAY UNDER MAINTENANCE' : 'SKBTECH LIVE • NIMC'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(app)/nin-services/history' as any)}
              style={styles.historyBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={14} color="#F5A623" style={{ marginRight: 4 }} />
              <Text style={styles.historyBtnTxt}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>National Identity Services</Text>
          <Text style={styles.headerSubtitle}>Official Automated NIMC Verification Gateway</Text>
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

      {/* Main Content Area in Crisp Modern Light Background */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B2044" />}
      >
        {/* Global Maintenance Banner */}
        {globalNINStatus === 'maintenance' && (
          <View style={styles.globalMaintBanner}>
            <Ionicons name="construct-outline" size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.globalMaintTitle}>Gateway Maintenance</Text>
              <Text style={styles.globalMaintDesc}>{globalNINMsg}</Text>
            </View>
          </View>
        )}

        {/* 🌟 LUXURY HERO SPOTLIGHT CARD: Verify & Print NIN Slip (NO AMOUNT ON FRONT PAGE) 🌟 */}
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
                  <Text style={styles.heroBadgeTxt}>INSTANT API • SKBTECH</Text>
                </View>
                {heroMaint ? (
                  <View style={styles.maintPill}>
                    <Text style={styles.maintPillText}>MAINTENANCE</Text>
                  </View>
                ) : (
                  <View style={styles.heroStatusPill}>
                    <Ionicons name="shield-checkmark" size={10} color="#10B981" style={{ marginRight: 3 }} />
                    <Text style={styles.heroStatusTxt}>OFFICIAL SLIP</Text>
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
                  <Text style={styles.heroFooterTxt}>Digital ID & High-Res PDF</Text>
                </View>
                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionTxt}>Verify Now</Text>
                  <Ionicons name="arrow-forward" size={12} color="#071630" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Dignified Trust Strip in Crisp White & Navy */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={14} color="#071630" />
            <Text style={styles.trustText}>Official NIMC</Text>
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

        {/* Section Header with Segmented Filter Tabs */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="grid-outline" size={15} color="#071630" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>ALL NIN SERVICES</Text>
          </View>

          <View style={styles.categoryTabRow}>
            {[
              { id: 'all', label: 'All' },
              { id: 'instant', label: 'Instant' },
              { id: 'desk', label: 'Desk' },
            ].map(tab => {
              const active = filterTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setFilterTab(tab.id as any)}
                  style={[styles.categoryTabBtn, active && styles.categoryTabBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryTabTxt, active && styles.categoryTabTxtActive]}>
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

        {/* Executive 24/7 Support Strip */}
        <View style={styles.supportBanner}>
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons name="headset-outline" size={18} color="#071630" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Need Help with NIN?</Text>
              <Text style={styles.supportSub}>Our identity support desk is active 24/7</Text>
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

  function renderServiceGridCard(service: ServiceItem) {
    const isMaint = serviceStatuses[service.pricingId]?.status === 'maintenance';

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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusPillTxt: {
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
  headerTitleBlock: {
    marginTop: 2,
    marginBottom: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
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

  // Dignified Trust Strip in Crisp White
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

  // Section Header & Segmented Filter Tabs
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
  categoryTabRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  categoryTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryTabBtnActive: {
    backgroundColor: '#071630',
  },
  categoryTabTxt: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '700',
  },
  categoryTabTxtActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // 🌟 3-COLUMN LUXURY MINIMALIST GRID (NO NOISE, NO AMOUNT ON FRONT) 🌟
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
    fontSize: 11,
    fontWeight: '800',
    color: '#071630',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
  },

  // 24/7 Support Banner in Clean White & Navy
  supportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  supportSub: {
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
