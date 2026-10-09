import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
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
}

const ALL_SERVICES: ServiceItem[] = [
  // 1. Instant Automated API Services
  {
    id: 'nin',
    pricingId: 'nin_premium',
    title: 'Verify & Print Slip',
    desc: 'Digital ID cards & official slips',
    icon: 'finger-print',
    color: '#059669',
    bgColor: '#ECFDF5',
    route: '/(app)/nin-services/verify-nin',
    category: 'instant',
    badge: 'INSTANT API',
  },
  {
    id: 'phone',
    pricingId: 'nin_phone',
    title: 'Verify by Phone',
    desc: 'Lookup by phone number',
    icon: 'call',
    color: '#0D9488',
    bgColor: '#F0FDFA',
    route: '/(app)/nin-services/verify-phone',
    category: 'instant',
    badge: 'INSTANT API',
  },
  {
    id: 'bvn',
    pricingId: 'vnin_val',
    title: 'BVN & VNIN Link',
    desc: 'Validate BVN & link identity',
    icon: 'card',
    color: '#0284C7',
    bgColor: '#F0F9FF',
    route: '/(app)/nin-services/validation',
    category: 'instant',
    badge: 'INSTANT API',
  },

  // 2. Assisted Desk & NIMC Requests
  {
    id: 'demo',
    pricingId: 'nin_verify',
    title: 'Demographic Search',
    desc: 'Lookup by Name & Date of Birth',
    icon: 'people',
    color: '#475569',
    bgColor: '#F1F5F9',
    route: '/(app)/nin-services/demographic',
    category: 'desk',
    badge: 'ASSISTED DESK',
  },
  {
    id: 'mod',
    pricingId: 'nin_mod_name',
    title: 'NIN Modification',
    desc: 'Update bio & contact details',
    icon: 'create',
    color: '#D97706',
    bgColor: '#FEF3C7',
    route: '/(app)/nin-services/modification',
    category: 'desk',
    badge: 'ASSISTED DESK',
  },
  {
    id: 'val',
    pricingId: 'nin_val_norecord',
    title: 'NIN Validation',
    desc: 'Fix record sync errors',
    icon: 'checkmark-circle',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    route: '/(app)/nin-services/validation',
    category: 'desk',
    badge: 'ASSISTED DESK',
  },
  {
    id: 'delink',
    pricingId: 'nin_mod_phone',
    title: 'Delink Phone',
    desc: 'Remove old mobile numbers',
    icon: 'cut',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    route: '/(app)/nin-services/delink',
    category: 'desk',
    badge: 'ASSISTED DESK',
  },
  {
    id: 'ipe',
    pricingId: 'ipe_clearance',
    title: 'IPE Clearance',
    desc: 'Pre-employment & institutional',
    icon: 'briefcase',
    color: '#4F46E5',
    bgColor: '#EEF2FF',
    route: '/(app)/nin-services/ipe-clearance',
    category: 'desk',
    badge: 'ASSISTED DESK',
  },
  {
    id: 'track',
    pricingId: 'pers_status',
    title: 'Tracking Status',
    desc: 'Check request progress',
    icon: 'shield-checkmark',
    color: '#0891B2',
    bgColor: '#ECFEFF',
    route: '/(app)/nin-services/tracking',
    category: 'desk',
    badge: 'ASSISTED DESK',
  },
];

export default function NINServicesScreen() {
  const insets = useSafeAreaInsets();
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

  const fetchServiceVisibilityAndMaintenance = async () => {
    try {
      const map: Record<string, { status: string; msg?: string }> = {};

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

      const { data: pricingRows } = await supabase
        .from('service_pricing')
        .select('id, status, maintenance_msg')
        .eq('service_category', 'nin');

      if (pricingRows && pricingRows.length > 0) {
        pricingRows.forEach(row => {
          if (row.status) {
            map[row.id] = {
              status: row.status,
              msg: row.maintenance_msg || map[row.id]?.msg,
            };
          }
        });
      }

      setServiceStatuses(map);
    } catch (e) {
      console.warn('Failed to load NIN service statuses', e);
    }
  };

  useEffect(() => {
    fetchServiceVisibilityAndMaintenance();
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

  const instantServices = ALL_SERVICES.filter(s => s.category === 'instant' && isVisible(s));
  const deskServices = ALL_SERVICES.filter(s => s.category === 'desk' && isVisible(s));

  const heroService = ALL_SERVICES[0];
  const heroMaint = serviceStatuses[heroService.pricingId]?.status === 'maintenance';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* Fresh Executive Header */}
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={[
          styles.headerGradient,
          { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 18 },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/(app)/nin-services/history' as any)}
              style={styles.historyBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={14} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={styles.historyBtnTxt}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerTitleBlock}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, globalNINStatus === 'maintenance' && { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.statusPillTxt}>
              {globalNINStatus === 'maintenance' ? 'GATEWAY MAINTENANCE' : 'NIMC SECURE GATEWAY'}
            </Text>
          </View>

          <Text style={styles.headerTitle}>National Identity Services</Text>
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
              locations={[0, 0.7, 1]}
              style={styles.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="flash" size={11} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.heroBadgeTxt}>INSTANT API</Text>
                </View>
                {heroMaint ? (
                  <View style={styles.maintPill}>
                    <Text style={styles.maintPillText}>MAINTENANCE</Text>
                  </View>
                ) : (
                  <View style={styles.instantSpeedPill}>
                    <Ionicons name="sparkles" size={10} color="#059669" style={{ marginRight: 3 }} />
                    <Text style={styles.instantSpeedTxt}>PDF & PNG</Text>
                  </View>
                )}
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroIconBox}>
                  <Ionicons name="finger-print" size={26} color="#059669" />
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
                  <Text style={styles.heroActionTxt}>Verify</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Section 1: Automated Instant Services */}
        {instantServices.filter(s => s.id !== 'nin').length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash-outline" size={14} color="#059669" style={{ marginRight: 6 }} />
              <Text style={[styles.sectionTitle, { color: '#059669' }]}>Instant Verification</Text>
            </View>

            <View style={styles.cardList}>
              {instantServices
                .filter(s => s.id !== 'nin')
                .map(service => renderServiceRow(service))}
            </View>
          </View>
        )}

        {/* Section 2: Assisted Desk Services */}
        {deskServices.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase-outline" size={14} color="#475569" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Assisted Services</Text>
            </View>

            <View style={styles.cardList}>
              {deskServices.map(service => renderServiceRow(service))}
            </View>
          </View>
        )}

        {/* Fresh Minimalist Support Strip */}
        <View style={styles.supportBanner}>
          <View style={styles.supportLeft}>
            <Ionicons name="headset-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
            <Text style={styles.supportTitle}>Need Help?</Text>
          </View>
          <TouchableOpacity
            style={styles.supportButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(app)/support')}
          >
            <Text style={styles.supportBtnTxt}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={12} color="#059669" style={{ marginLeft: 2 }} />
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
    return (
      <TouchableOpacity
        key={service.id}
        onPress={() => handleServicePress(service)}
        style={[styles.serviceRow, isMaint && styles.serviceRowMaint]}
        activeOpacity={0.78}
      >
        <View style={[styles.serviceIconWrap, { backgroundColor: service.bgColor }]}>
          <Ionicons name={service.icon} size={18} color={isMaint ? '#B45309' : service.color} />
        </View>

        <View style={styles.serviceTextCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={styles.serviceRowTitle}>{service.title}</Text>
            {service.badge === 'INSTANT API' ? (
              <View style={styles.instantTag}>
                <Ionicons name="flash" size={8} color="#059669" />
                <Text style={styles.instantTagTxt}>INSTANT</Text>
              </View>
            ) : (
              <View style={styles.deskTag}>
                <Text style={styles.deskTagTxt}>DESK</Text>
              </View>
            )}
          </View>
          <Text style={styles.serviceRowDesc}>{service.desc}</Text>
        </View>

        {isMaint ? (
          <View style={styles.maintPill}>
            <Text style={styles.maintPillText}>MAINTENANCE</Text>
          </View>
        ) : (
          <View style={styles.chevronBox}>
            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
          </View>
        )}
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
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
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
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  heroGradient: {
    padding: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  heroBadgeTxt: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.4,
  },
  instantSpeedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  instantSpeedTxt: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#059669',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#A7F3D0',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 1,
  },
  heroDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 14,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(5,150,105,0.1)',
  },
  heroFormatsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  formatChip: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#065F46',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  heroActionTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // Section Styles
  sectionWrap: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  serviceRowMaint: {
    backgroundColor: '#FFFDF7',
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  serviceTextCol: {
    flex: 1,
  },
  serviceRowTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  instantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: '#A7F3D0',
    gap: 2,
  },
  instantTagTxt: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#059669',
  },
  deskTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
  },
  deskTagTxt: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#64748B',
  },
  serviceRowDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 13,
  },
  chevronBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  maintPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#FDE68A',
  },
  maintPillText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#B45309',
  },

  // Support Banner
  supportBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 4,
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
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
  },
  supportBtnTxt: {
    color: '#059669',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
