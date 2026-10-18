import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

interface ServiceItem {
  id: string;
  pricingId: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
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
    desc: 'Digital ID cards & official slips (PDF & PNG)',
    icon: 'finger-print',
    color: '#059669',
    bgColor: '#ECFDF5',
    route: '/(app)/nin-services/verify-nin',
    category: 'instant',
    badge: 'INSTANT API',
    defaultPrice: 120,
  },
  {
    id: 'phone',
    pricingId: 'nin_phone',
    title: 'Verify by Phone',
    desc: 'Instant NIN lookup via mobile phone number',
    icon: 'call',
    color: '#0D9488',
    bgColor: '#F0FDFA',
    route: '/(app)/nin-services/verify-phone',
    category: 'instant',
    badge: 'INSTANT API',
    defaultPrice: 120,
  },
  {
    id: 'bvn',
    pricingId: 'vnin_val',
    title: 'BVN & VNIN Link',
    desc: 'Validate BVN & link identity to NIBSS',
    icon: 'card',
    color: '#0284C7',
    bgColor: '#F0F9FF',
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
    desc: 'Lookup by Full Name, State & Date of Birth',
    icon: 'people',
    color: '#475569',
    bgColor: '#F1F5F9',
    route: '/(app)/nin-services/demographic',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 300,
  },
  {
    id: 'mod',
    pricingId: 'nin_mod_name',
    title: 'NIN Modification',
    desc: 'Update bio, Name, DOB & contact details',
    icon: 'create',
    color: '#D97706',
    bgColor: '#FEF3C7',
    route: '/(app)/nin-services/modification',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 6000,
  },
  {
    id: 'val',
    pricingId: 'nin_val_norecord',
    title: 'NIN Validation',
    desc: 'Fix record sync errors & NIMC no-record issues',
    icon: 'checkmark-circle',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    route: '/(app)/nin-services/validation',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 700,
  },
  {
    id: 'delink',
    pricingId: 'nin_mod_phone',
    title: 'Delink Phone Number',
    desc: 'Remove old mobile numbers linked to your NIN',
    icon: 'cut',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    route: '/(app)/nin-services/delink',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 1500,
  },
  {
    id: 'ipe',
    pricingId: 'ipe_clearance',
    title: 'IPE Clearance',
    desc: 'Pre-employment & institutional verification',
    icon: 'briefcase',
    color: '#4F46E5',
    bgColor: '#EEF2FF',
    route: '/(app)/nin-services/ipe-clearance',
    category: 'desk',
    badge: 'ASSISTED DESK',
    defaultPrice: 500,
  },
  {
    id: 'track',
    pricingId: 'pers_status',
    title: 'Tracking Status',
    desc: 'Check progress of ongoing modification or slip',
    icon: 'shield-checkmark',
    color: '#0891B2',
    bgColor: '#ECFEFF',
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
          console.warn('Error parsing nin_service_controls:', e);
        }
      }

      // 2. Fetch from service_pricing table
      const { data: pricingRows } = await supabase
        .from('service_pricing')
        .select('id, cost_price, markup_price, selling_price, status, maintenance_msg')
        .eq('service_category', 'nin');

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
      console.warn('Failed to load NIN service statuses and prices', e);
    }
  };

  const loadData = async () => {
    await Promise.all([fetchWalletBalance(), fetchPricesAndStatuses()]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleServicePress = (service: ServiceItem) => {
    if (globalNINStatus === 'maintenance') {
      setAlertConfig({
        visible: true,
        title: 'Gateway Maintenance',
        message: globalNINMsg,
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

  const isVisible = (service: ServiceItem) => {
    const statusById = serviceStatuses[service.id]?.status;
    const statusByPricingId = serviceStatuses[service.pricingId]?.status;
    return statusById !== 'hidden' && statusByPricingId !== 'hidden';
  };

  const visibleServices = ALL_SERVICES.filter(s => isVisible(s));
  const filteredServices = visibleServices.filter(s => {
    if (filterTab === 'all') return true;
    return s.category === filterTab;
  });

  const heroService = ALL_SERVICES[0];
  const heroMaint = serviceStatuses[heroService.pricingId]?.status === 'maintenance';
  const heroPrice = prices[heroService.pricingId] || heroService.defaultPrice;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* Fresh Executive Royal Navy & Gold Header */}
      <LinearGradient
        colors={['#070D1E', '#0F172A', '#1E293B']}
        style={[
          styles.headerGradient,
          { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 16 },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => router.push('/(app)/nin-services/history' as any)}
              style={styles.historyBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={14} color="#6EE7B7" style={{ marginRight: 4 }} />
              <Text style={styles.historyBtnTxt}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerTitleBlock}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, globalNINStatus === 'maintenance' && { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.statusPillTxt}>
              {globalNINStatus === 'maintenance' ? 'GATEWAY MAINTENANCE' : 'SKBTECH LIVE GATEWAY • 99.9% UPTIME'}
            </Text>
          </View>

          <Text style={styles.headerTitle}>National Identity Services</Text>
          <Text style={styles.headerSubtitle}>Official Automated NIMC Verification Gateway</Text>
        </View>

        {/* Compact Wallet Balance Chip */}
        <View style={styles.walletBar}>
          <View style={styles.walletLeft}>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet-outline" size={15} color="#10B981" />
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

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
      >
        {/* Global Maintenance Banner */}
        {globalNINStatus === 'maintenance' && (
          <View style={styles.globalMaintBanner}>
            <Ionicons name="construct-outline" size={18} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.globalMaintTitle}>Gateway Maintenance</Text>
              <Text style={styles.globalMaintDesc}>{globalNINMsg}</Text>
            </View>
          </View>
        )}

        {/* 🌟 HERO CARD: Instant Verify & Print NIN Slip */}
        {isVisible(heroService) && (
          <TouchableOpacity
            onPress={() => handleServicePress(heroService)}
            activeOpacity={0.9}
            style={styles.heroCard}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F0FDF4', '#DCFCE7']}
              locations={[0, 0.65, 1]}
              style={styles.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="flash" size={11} color="#059669" style={{ marginRight: 4 }} />
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
                  <Ionicons name="finger-print" size={28} color="#059669" />
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
                  <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Segmented Filter Tabs */}
        <View style={styles.categoryTabRow}>
          {[
            { id: 'all', label: 'All Services' },
            { id: 'instant', label: 'Instant API' },
            { id: 'desk', label: 'Assisted Services' },
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

        {/* Services List */}
        <View style={styles.cardList}>
          {filteredServices
            .filter(s => s.id !== 'nin' || filterTab !== 'all')
            .map(service => renderServiceRow(service))}
        </View>

        {/* Fresh Support Strip */}
        <View style={styles.supportBanner}>
          <View style={styles.supportLeft}>
            <View style={styles.supportIconWrap}>
              <Ionicons name="headset-outline" size={16} color="#059669" />
            </View>
            <View>
              <Text style={styles.supportTitle}>Need Help with NIN?</Text>
              <Text style={styles.supportSub}>Our NIMC identity specialists are online 24/7</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.supportButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(app)/support' as any)}
          >
            <Text style={styles.supportBtnTxt}>Support</Text>
            <Ionicons name="chevron-forward" size={12} color="#059669" />
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

  function renderServiceRow(service: ServiceItem) {
    const isMaint = serviceStatuses[service.pricingId]?.status === 'maintenance';
    const priceVal = prices[service.pricingId] || service.defaultPrice;

    return (
      <TouchableOpacity
        key={service.id}
        onPress={() => handleServicePress(service)}
        style={[styles.serviceRow, isMaint && styles.serviceRowMaint]}
        activeOpacity={0.78}
      >
        <View style={[styles.serviceIconWrap, { backgroundColor: service.bgColor }]}>
          <Ionicons name={service.icon} size={20} color={isMaint ? '#B45309' : service.color} />
        </View>

        <View style={styles.serviceTextCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={styles.serviceRowTitle}>{service.title}</Text>
            {service.badge === 'INSTANT API' ? (
              <View style={styles.instantTag}>
                <Ionicons name="flash" size={8} color="#059669" />
                <Text style={styles.instantTagTxt}>INSTANT</Text>
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
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  historyBtnTxt: {
    color: '#6EE7B7',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  statusPillTxt: {
    color: '#E2E8F0',
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
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
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
    borderColor: 'rgba(255,255,255,0.1)',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: {
    color: '#94A3B8',
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
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  fundBtnText: {
    color: '#070D1E',
    fontSize: 11,
    fontWeight: '900',
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
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
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  heroBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.4,
  },
  heroPricePill: {
    backgroundColor: '#059669',
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#064E3B',
    marginBottom: 2,
  },
  heroDesc: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 15,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(5,150,105,0.15)',
    paddingTop: 10,
  },
  heroFormatsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  formatChip: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  heroActionTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  // Category Tabs
  categoryTabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  categoryTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryTabBtnActive: {
    backgroundColor: '#070D1E',
    borderColor: '#070D1E',
  },
  categoryTabTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  categoryTabTxtActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // Card List
  cardList: {
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
  instantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 2,
  },
  instantTagTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#059669',
  },
  servicePriceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  priceChip: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceChipTxt: {
    color: '#059669',
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

  // Support
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
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  supportTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  supportSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 2,
  },
  supportBtnTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
});
