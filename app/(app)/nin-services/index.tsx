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
  const [globalNINMsg, setGlobalNINMsg] = useState('NIMC portal infrastructure is currently undergoing scheduled optimization. Services will resume shortly.');

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

      // 1. Fetch nin_service_controls from app_settings
      const { data: configData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'nin_service_controls')
        .maybeSingle();

      if (configData?.value) {
        try {
          const parsed = typeof configData.value === 'string' ? JSON.parse(configData.value) : configData.value;
          if (parsed?.global_status) setGlobalNINStatus(parsed.global_status);
          if (parsed?.global_maintenance_msg) setGlobalNINMsg(parsed.global_maintenance_msg);
          if (parsed?.services && typeof parsed.services === 'object') {
            for (const [k, v] of Object.entries(parsed.services as Record<string, any>)) {
              map[k] = {
                status: v.status || 'active',
                msg: v.maintenance_message || 'This service is currently undergoing scheduled maintenance.',
              };
            }
          }
        } catch (_) {}
      }

      // 2. Fetch prices from service_pricing
      const { data: priceData } = await supabase
        .from('service_pricing')
        .select('id, cost_price, markup_price, selling_price, status');

      if (priceData && Array.isArray(priceData)) {
        for (const item of priceData) {
          const cost = parseFloat(item.cost_price?.toString() || '0');
          const markup = parseFloat(item.markup_price?.toString() || '0');
          const selling = item.selling_price ? parseFloat(item.selling_price.toString()) : (cost + markup);
          const finalPrice = selling > 0 ? selling : (cost + markup);
          priceMap[item.id] = finalPrice;

          if (item.status === 'maintenance' || item.status === 'inactive') {
            map[item.id] = {
              status: item.status,
              msg: 'Service is temporarily inactive or under maintenance.',
            };
          }
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
    const statusObj = serviceStatuses[service.pricingId];
    if (statusObj && (statusObj.status === 'maintenance' || statusObj.status === 'inactive')) {
      showAlert(
        `${service.title} Inactive`,
        statusObj.msg || 'This specific NIN service is currently undergoing optimization. Please try again later.',
        'warning'
      );
      return;
    }

    // 3. Low balance check
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
    const s = serviceStatuses[service.pricingId];
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

      {/* Royal Navy & Gold Executive Header */}
      <LinearGradient
        colors={['#071630', '#0B2246', '#112D5E']}
        style={[
          styles.headerGradient,
          { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 16 },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#F5A623" />
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
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
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, globalNINStatus === 'maintenance' && { backgroundColor: '#EF4444' }]} />
            <Text style={styles.statusPillTxt}>
              {globalNINStatus === 'maintenance' ? 'GATEWAY MAINTENANCE' : 'SKBTECH LIVE GATEWAY • 99.9% UPTIME'}
            </Text>
          </View>

          <Text style={styles.headerTitle}>National Identity Services</Text>
          <Text style={styles.headerSubtitle}>Official Automated NIMC Verification Gateway</Text>
        </View>

        {/* Executive Wallet Balance Chip in Navy & Gold */}
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
            <Ionicons name="add-circle" size={13} color="#0B2246" />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B2246" />}
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
              colors={['#0B2246', '#0F2C59', '#14376F']}
              locations={[0, 0.5, 1]}
              style={styles.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="flash" size={11} color="#F5A623" style={{ marginRight: 4 }} />
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
                  <Ionicons name="finger-print" size={28} color="#F5A623" />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>{heroService.title}</Text>
                  <Text style={styles.heroDesc}>{heroService.desc}</Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroFormatsRow}>
                  <Text style={styles.formatChip}>Digital ID</Text>
                  <Text style={styles.formatChip}>Standard</Text>
                  <Text style={styles.formatChip}>Regular</Text>
                </View>
                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionTxt}>Verify Now</Text>
                  <Ionicons name="arrow-forward" size={12} color="#0B2246" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Decorative Trust Strip (Clean Crisp White & Navy) */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={14} color="#0B2246" />
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
            <Ionicons name="grid-outline" size={15} color="#0B2246" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>ALL NIN SERVICES</Text>
          </View>

          {/* Segmented Filter Tabs */}
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

        {/* 🌟 3-COLUMN MODERN GRID (CLEAN WHITE CARDS, NAVY & GOLD, NO AMOUNT ON FRONT) 🌟 */}
        <View style={styles.gridContainer}>
          {filteredServices.map(service => renderServiceGridCard(service))}
        </View>

        {/* Executive 24/7 Support Strip */}
        <View style={styles.supportBanner}>
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons name="headset-outline" size={18} color="#0B2246" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Need Help with NIN?</Text>
              <Text style={styles.supportSub}>Our identity specialists are online to assist 24/7</Text>
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
          {/* Top Micro-Bar: Category Tag & Status (NO AMOUNT) */}
          <View style={styles.gridCardTopRow}>
            {service.badge === 'INSTANT API' ? (
              <View style={styles.gridInstantTag}>
                <Ionicons name="flash" size={7} color="#D4AF37" />
                <Text style={styles.gridInstantTagTxt}>API</Text>
              </View>
            ) : (
              <View style={styles.gridDeskTag}>
                <Text style={styles.gridDeskTagTxt}>DESK</Text>
              </View>
            )}

            {isMaint ? (
              <Text style={styles.gridMaintTxt}>MAINT</Text>
            ) : (
              <View style={styles.gridActiveTag}>
                <View style={styles.gridActiveDot} />
                <Text style={styles.gridActiveTxt}>ACTIVE</Text>
              </View>
            )}
          </View>

          {/* Icon in Gold & Navy Frame */}
          <View style={styles.gridIconFrame}>
            <Ionicons name={service.icon} size={22} color="#0B2246" />
          </View>

          {/* Title in Deep Navy */}
          <Text style={styles.gridCardTitle} numberOfLines={2}>
            {service.shortTitle || service.title}
          </Text>

          {/* Sub description / format chip */}
          <View style={styles.gridCardBottomChip}>
            <Text style={styles.gridCardBottomChipTxt} numberOfLines={1}>
              {service.id === 'nin' ? 'Slips & Cards' :
               service.id === 'phone' ? 'Phone Lookup' :
               service.id === 'bvn' ? 'NIBSS Link' :
               service.id === 'mod' ? 'Name / DOB' :
               service.id === 'val' ? 'Record Sync' :
               service.id === 'delink' ? 'Unlink' :
               service.id === 'ipe' ? 'Clearance' :
               service.id === 'demo' ? 'Name Search' : 'Verify'}
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
    backgroundColor: '#F4F7FC', // Crisp, modern, elegant light background (NOT black!)
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
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
  },
  historyBtnTxt: {
    color: '#F5A623',
    fontSize: 11,
    fontWeight: '800',
  },
  headerTitleBlock: {
    marginTop: 2,
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    marginBottom: 6,
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
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  walletBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
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
    color: '#0B2246',
    fontSize: 11,
    fontWeight: '900',
  },

  content: {
    flex: 1,
    backgroundColor: '#F4F7FC',
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
    fontSize: 10.5,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 14,
  },

  // Hero Card in Executive Navy & Gold
  heroCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    shadowColor: '#0B2246',
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
    backgroundColor: 'rgba(245, 166, 35, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
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
    backgroundColor: 'rgba(245, 166, 35, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
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
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroFormatsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  formatChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
    color: '#0B2246',
    fontSize: 11,
    fontWeight: '900',
  },

  // Trust Strip in Clean White
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
    backgroundColor: '#0B2246',
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

  // 🌟 3-COLUMN GRID STYLES (CLEAN WHITE CARDS, NAVY & GOLD ACCENTS) 🌟
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
  gridInstantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  gridInstantTagTxt: {
    color: '#B45309',
    fontSize: 7.5,
    fontWeight: '900',
    marginLeft: 2,
  },
  gridDeskTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gridDeskTagTxt: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '800',
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
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0B2246',
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
  supportSub: {
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
