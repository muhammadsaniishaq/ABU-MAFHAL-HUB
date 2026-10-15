import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import {
  CacServiceCode,
  CacPricingConfig,
  DEFAULT_CAC_PRICING_CONFIGS,
  CAC_SERVICES_ORDER,
  fetchCacPricingConfigurations,
  saveCacPricingConfiguration,
  fetchCacPricingAuditLogs,
  calculateCacPrice,
  formatNaira,
  CacAuditLogEntry,
} from '../../services/cacPricingService';

const { width } = Dimensions.get('window');

// Brand Colors: Navy Blue, Imperial Gold, White & Refined Accents
const COLORS = {
  navyDark: '#0A1128',
  navy: '#0F172A',
  navyMid: '#1E293B',
  navyLight: '#334155',
  navySoft: '#F1F5F9',
  gold: '#D97706',
  goldBright: '#F59E0B',
  goldLight: '#FEF3C7',
  goldBg: '#FFFBEB',
  goldBorder: '#FDE68A',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderFocus: '#CBD5E1',
  textMain: '#0F172A',
  textSub: '#475569',
  textMuted: '#94A3B8',
  success: '#10B981',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  white: '#FFFFFF',
};

type ActiveViewTab = CacServiceCode | 'tin_settings' | 'preview' | 'audit';

export default function CacPricingManagement() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('ltd');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Source of truth from database
  const [serverConfigs, setServerConfigs] = useState<Record<CacServiceCode, CacPricingConfig>>({
    ...DEFAULT_CAC_PRICING_CONFIGS,
  });
  const [serverTinFee, setServerTinFee] = useState<number>(3000);

  // Local draft state for modifications
  const [draftConfigs, setDraftConfigs] = useState<Record<CacServiceCode, CacPricingConfig>>({
    ...DEFAULT_CAC_PRICING_CONFIGS,
  });
  const [draftTinFee, setDraftTinFee] = useState<string>('3000');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<CacAuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Interactive Live Simulator State (for Preview tab)
  const [simService, setSimService] = useState<CacServiceCode>('ltd');
  const [simShareCapital, setSimShareCapital] = useState<number>(2000000);
  const [simDirectors, setSimDirectors] = useState<number>(3);
  const [simShareholders, setSimShareholders] = useState<number>(2);
  const [simTrustees, setSimTrustees] = useState<number>(2);
  const [simIncludeTin, setSimIncludeTin] = useState<boolean>(true);

  // -----------------------------------------------------------------
  // 1. Initial Load & Auth Verification
  // -----------------------------------------------------------------
  useEffect(() => {
    verifyAdminAndLoad();
  }, []);

  const verifyAdminAndLoad = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        Alert.alert('Access Denied', 'You must be logged in as an administrator.');
        router.replace('/(auth)/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const authorized = profile && ['admin', 'super_admin'].includes(profile.role);
      setIsAdmin(Boolean(authorized));

      if (!authorized) {
        Alert.alert('Restricted Access', 'Only authorized administrators have permission to manage CAC pricing.');
        router.back();
        return;
      }

      await loadConfigurations();
    } catch (e: any) {
      console.error('Auth verification error:', e);
      Alert.alert('Error', e.message || 'Failed to authenticate admin session');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadConfigurations = async () => {
    const { configs, tinFee } = await fetchCacPricingConfigurations();
    setServerConfigs(configs);
    setServerTinFee(tinFee);
    setDraftConfigs(JSON.parse(JSON.stringify(configs)));
    setDraftTinFee(String(tinFee));
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await fetchCacPricingAuditLogs();
      setAuditLogs(logs);
    } catch (_) {}
    setLoadingAudit(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConfigurations();
    if (activeTab === 'audit') await loadAuditLogs();
    setRefreshing(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // -----------------------------------------------------------------
  // 2. Dirty State & Change Detection
  // -----------------------------------------------------------------
  const modifiedList = useMemo(() => {
    const changes: Array<{
      serviceCode: CacServiceCode | 'tin_fee';
      serviceName: string;
      field: string;
      label: string;
      from: any;
      to: any;
    }> = [];

    // Check TIN fee
    const numTin = parseFloat(draftTinFee) || 0;
    if (numTin !== serverTinFee) {
      changes.push({
        serviceCode: 'tin_fee',
        serviceName: 'Global Setting',
        field: 'tin_fee',
        label: 'TIN Processing Add-on Fee',
        from: formatNaira(serverTinFee),
        to: formatNaira(numTin),
      });
    }

    // Check each CAC service
    CAC_SERVICES_ORDER.forEach((code) => {
      const orig = serverConfigs[code];
      const draft = draftConfigs[code];
      if (!orig || !draft) return;

      const compare = (field: keyof CacPricingConfig, label: string, isCurrency = false) => {
        if (draft[field] !== orig[field]) {
          changes.push({
            serviceCode: code,
            serviceName: draft.service_name,
            field: String(field),
            label,
            from: isCurrency ? formatNaira(Number(orig[field])) : String(orig[field] ?? 'None'),
            to: isCurrency ? formatNaira(Number(draft[field])) : String(draft[field] ?? 'None'),
          });
        }
      };

      compare('regular_price', 'Regular Price', true);
      compare('promo_price', 'Promotional Price', true);
      compare('is_promo_active', 'Promotional Pricing Toggle');
      compare('promo_start_at', 'Promotion Start Date');
      compare('promo_end_at', 'Promotion End Date');
      compare('included_share_capital', 'Included Share Capital', true);
      compare('share_capital_increment_step', 'Increment Step', true);
      compare('share_capital_increment_fee', 'Fee Per Share Increment', true);
      compare('included_directors', 'Included Directors');
      compare('additional_director_fee', 'Fee Per Extra Director', true);
      compare('included_shareholders', 'Included Shareholders');
      compare('additional_shareholder_fee', 'Fee Per Extra Shareholder', true);
      compare('included_trustees', 'Included Trustees');
      compare('additional_trustee_fee', 'Fee Per Extra Trustee', true);
      compare('processing_time', 'Processing Time');
      compare('is_available', 'Service Availability');
      compare('quote_validity_hours', 'Quote Validity (Hours)');
    });

    return changes;
  }, [serverConfigs, draftConfigs, draftTinFee, serverTinFee]);

  const hasUnsavedChanges = modifiedList.length > 0;

  // -----------------------------------------------------------------
  // 3. Draft Updaters with Validation
  // -----------------------------------------------------------------
  const updateDraftField = (code: CacServiceCode, field: keyof CacPricingConfig, value: any) => {
    setDraftConfigs((prev) => {
      const current = prev[code] || DEFAULT_CAC_PRICING_CONFIGS[code];
      return {
        ...prev,
        [code]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleCurrencyInput = (code: CacServiceCode, field: keyof CacPricingConfig, text: string) => {
    // Strip non-numeric except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    const validVal = isNaN(num) || num < 0 ? 0 : num;
    updateDraftField(code, field, validVal);
  };

  const handleResetDrafts = () => {
    Alert.alert('Discard Unsaved Changes?', 'All modified pricing inputs will revert to the saved settings on the server.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard All',
        style: 'destructive',
        onPress: () => {
          setDraftConfigs(JSON.parse(JSON.stringify(serverConfigs)));
          setDraftTinFee(String(serverTinFee));
        },
      },
    ]);
  };

  // -----------------------------------------------------------------
  // 4. Save & Publish
  // -----------------------------------------------------------------
  const handleSaveConfirmed = async () => {
    setShowConfirmModal(false);
    setSaving(true);

    try {
      const tinNum = parseFloat(draftTinFee) || 0;
      const summaryMsg = `Admin updated ${modifiedList.length} pricing rules: ` +
        modifiedList.map((m) => `${m.serviceName} [${m.label}: ${m.from} → ${m.to}]`).slice(0, 4).join(', ');

      const res = await saveCacPricingConfiguration(draftConfigs, tinNum, summaryMsg);

      if (!res.success) {
        throw new Error(res.error || 'Failed to update pricing');
      }

      // Update baseline server snapshot
      setServerConfigs(JSON.parse(JSON.stringify(draftConfigs)));
      setServerTinFee(tinNum);

      Alert.alert(
        'Pricing Matrix Updated 🎉',
        'All CAC registration fees, share capital increments, director allowances, and promotional rules have been saved and applied system-wide without application restart.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert('Save Failed', e.message || 'Unable to persist changes to the database');
    } finally {
      setSaving(false);
    }
  };

  // Current selected service draft
  const currentServiceDraft: CacPricingConfig = useMemo(() => {
    if (activeTab === 'tin_settings' || activeTab === 'preview' || activeTab === 'audit') {
      return draftConfigs.ltd;
    }
    return draftConfigs[activeTab] || DEFAULT_CAC_PRICING_CONFIGS[activeTab];
  }, [activeTab, draftConfigs]);

  // Live Simulator Calculation
  const simulatorResult = useMemo(() => {
    const config = draftConfigs[simService] || DEFAULT_CAC_PRICING_CONFIGS[simService];
    return calculateCacPrice(config, {
      shareCapital: simShareCapital,
      directorsCount: simDirectors,
      shareholdersCount: simShareholders,
      trusteesCount: simTrustees,
      includeTin: simIncludeTin,
      tinFee: parseFloat(draftTinFee) || 3000,
    });
  }, [draftConfigs, simService, simShareCapital, simDirectors, simShareholders, simTrustees, simIncludeTin, draftTinFee]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.navy} />
        <Text style={styles.loadingText}>Loading CAC Pricing Engine...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Stack.Screen
        options={{
          title: 'CAC Pricing & Configuration',
          headerStyle: { backgroundColor: COLORS.navy },
          headerTintColor: COLORS.white,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={onRefresh} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Ionicons name="refresh" size={18} color={COLORS.goldBright} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Top Hero Telemetry Bar */}
      <LinearGradient colors={[COLORS.navyDark, COLORS.navy, COLORS.navyMid]} style={styles.heroSummaryBar}>
        <View style={styles.heroTopRow}>
          <View style={styles.statusPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusPillText}>DYNAMIC PRICING ENGINE • ACTIVE</Text>
          </View>
          {hasUnsavedChanges && (
            <View style={styles.unsavedBadge}>
              <Ionicons name="alert-circle" size={13} color="#B45309" />
              <Text style={styles.unsavedBadgeText}>{modifiedList.length} Unsaved</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroTitle}>CAC Pricing & Configuration</Text>
        <Text style={styles.heroSubtitle}>
          Real-time dynamic pricing control for official Corporate Affairs Commission registrations.
        </Text>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>6</Text>
            <Text style={styles.statLbl}>Total Services</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: COLORS.goldBright }]}>
              {Object.values(draftConfigs).filter((c) => c.is_promo_active).length}
            </Text>
            <Text style={styles.statLbl}>Promo Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: COLORS.success }]}>
              {Object.values(draftConfigs).filter((c) => c.is_available).length}
            </Text>
            <Text style={styles.statLbl}>Live Online</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: hasUnsavedChanges ? COLORS.goldBright : COLORS.textMuted }]}>
              {hasUnsavedChanges ? 'Draft' : 'Synced'}
            </Text>
            <Text style={styles.statLbl}>Status</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Segmented Service Selector Carousel */}
      <View style={styles.tabScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {CAC_SERVICES_ORDER.map((code) => {
            const item = draftConfigs[code] || DEFAULT_CAC_PRICING_CONFIGS[code];
            const isSelected = activeTab === code;
            const isDirty = modifiedList.some((m) => m.serviceCode === code);

            return (
              <TouchableOpacity
                key={code}
                style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
                onPress={() => setActiveTab(code)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                    {item.service_name.replace('Registration', '').trim()}
                  </Text>
                  {isDirty && <View style={styles.dirtyDot} />}
                </View>
                <Text style={[styles.tabBtnSub, isSelected && styles.tabBtnSubActive]}>
                  {formatNaira(item.is_promo_active && item.promo_price ? item.promo_price : item.regular_price)}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tin_settings' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tin_settings')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="options-outline" size={14} color={activeTab === 'tin_settings' ? COLORS.navy : COLORS.textSub} />
              <Text style={[styles.tabBtnText, activeTab === 'tin_settings' && styles.tabBtnTextActive]}>TIN & Add-ons</Text>
            </View>
            <Text style={[styles.tabBtnSub, activeTab === 'tin_settings' && styles.tabBtnSubActive]}>
              {formatNaira(parseFloat(draftTinFee) || 3000)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'preview' && styles.tabBtnActive]}
            onPress={() => setActiveTab('preview')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="calculator-outline" size={14} color={activeTab === 'preview' ? COLORS.navy : COLORS.textSub} />
              <Text style={[styles.tabBtnText, activeTab === 'preview' && styles.tabBtnTextActive]}>Live Simulator</Text>
            </View>
            <Text style={[styles.tabBtnSub, activeTab === 'preview' && styles.tabBtnSubActive]}>Price Matrix</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'audit' && styles.tabBtnActive]}
            onPress={() => setActiveTab('audit')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="time-outline" size={14} color={activeTab === 'audit' ? COLORS.navy : COLORS.textSub} />
              <Text style={[styles.tabBtnText, activeTab === 'audit' && styles.tabBtnTextActive]}>Audit Logs</Text>
            </View>
            <Text style={[styles.tabBtnSub, activeTab === 'audit' && styles.tabBtnSubActive]}>History</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Body */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.navy} />}
      >
        {/* ========================================================= */}
        {/* TAB 1: INDIVIDUAL SERVICE EDITORS */}
        {/* ========================================================= */}
        {activeTab !== 'tin_settings' && activeTab !== 'preview' && activeTab !== 'audit' && (
          <View>
            {/* Service Header Overview Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceHeading}>{currentServiceDraft.service_name}</Text>
                  <Text style={styles.serviceCategoryBadge}>
                    CODE: {currentServiceDraft.service_code.toUpperCase()} • CATEGORY: {currentServiceDraft.category.toUpperCase()}
                  </Text>
                </View>

                {/* Service Availability Toggle */}
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: currentServiceDraft.is_available ? COLORS.success : COLORS.danger }}>
                      {currentServiceDraft.is_available ? 'ONLINE' : 'MAINTENANCE'}
                    </Text>
                    <Switch
                      value={currentServiceDraft.is_available}
                      onValueChange={(val) => updateDraftField(currentServiceDraft.service_code, 'is_available', val)}
                      trackColor={{ false: '#FECACA', true: '#A7F3D0' }}
                      thumbColor={currentServiceDraft.is_available ? COLORS.success : '#DC2626'}
                    />
                  </View>
                  <Text style={styles.inputHelp}>Toggle client-facing service availability</Text>
                </View>
              </View>

              <Text style={styles.serviceDesc}>{currentServiceDraft.description}</Text>
            </View>

            {/* 1. Base & Promotional Pricing Section */}
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="pricetags-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>Base & Promotional Pricing</Text>
              </View>

              <View style={styles.inputGrid2}>
                {/* Regular Price */}
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Regular Price (Official ₦)</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.currencyPrefix}>₦</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={String(currentServiceDraft.regular_price || 0)}
                      onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'regular_price', t)}
                    />
                  </View>
                  <Text style={styles.inputHelp}>Standard fee when promotion is inactive</Text>
                </View>

                {/* Promotional Price */}
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Promotional Price (Offer ₦)</Text>
                  <View style={[styles.inputWrapper, currentServiceDraft.is_promo_active && { borderColor: COLORS.gold }]}>
                    <Text style={[styles.currencyPrefix, currentServiceDraft.is_promo_active && { color: COLORS.gold }]}>₦</Text>
                    <TextInput
                      style={[styles.textInput, currentServiceDraft.is_promo_active && { fontWeight: '700' }]}
                      keyboardType="numeric"
                      value={currentServiceDraft.promo_price !== null && currentServiceDraft.promo_price !== undefined ? String(currentServiceDraft.promo_price) : ''}
                      placeholder="e.g. 80000"
                      placeholderTextColor={COLORS.textMuted}
                      onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'promo_price', t)}
                    />
                  </View>
                  <Text style={styles.inputHelp}>Discounted customer checkout rate</Text>
                </View>
              </View>

              {/* Promo Toggle Switch */}
              <View style={styles.promoToggleBox}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flash" size={16} color={currentServiceDraft.is_promo_active ? COLORS.goldBright : COLORS.textMuted} />
                    <Text style={styles.promoToggleTitle}>Enable Promotional Pricing</Text>
                  </View>
                  <Text style={styles.promoToggleDesc}>
                    When active, customers are charged the promotional rate instead of regular price.
                  </Text>
                </View>

                <Switch
                  value={currentServiceDraft.is_promo_active}
                  onValueChange={(val) => updateDraftField(currentServiceDraft.service_code, 'is_promo_active', val)}
                  trackColor={{ false: '#E2E8F0', true: COLORS.goldBorder }}
                  thumbColor={currentServiceDraft.is_promo_active ? COLORS.gold : '#94A3B8'}
                />
              </View>

              {/* Promo Savings Preview */}
              {currentServiceDraft.is_promo_active &&
                currentServiceDraft.promo_price !== null &&
                currentServiceDraft.regular_price > (currentServiceDraft.promo_price || 0) && (
                  <View style={styles.savingsBanner}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.savingsBannerText}>
                      Active Discount: Customer saves{' '}
                      {formatNaira(currentServiceDraft.regular_price - (currentServiceDraft.promo_price || 0))} (
                      {Math.round(
                        ((currentServiceDraft.regular_price - (currentServiceDraft.promo_price || 0)) /
                          currentServiceDraft.regular_price) *
                          100
                      )}
                      % OFF)
                    </Text>
                  </View>
                )}

              {/* Promotion Schedule Dates */}
              <View style={styles.inputGrid2}>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Promotion Start Date (Optional)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="YYYY-MM-DD (or blank for always)"
                    placeholderTextColor={COLORS.textMuted}
                    value={currentServiceDraft.promo_start_at ? currentServiceDraft.promo_start_at.split('T')[0] : ''}
                    onChangeText={(val) => updateDraftField(currentServiceDraft.service_code, 'promo_start_at', val ? `${val}T00:00:00Z` : null)}
                  />
                </View>

                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Promotion End Date (Optional)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="YYYY-MM-DD (or blank for perpetual)"
                    placeholderTextColor={COLORS.textMuted}
                    value={currentServiceDraft.promo_end_at ? currentServiceDraft.promo_end_at.split('T')[0] : ''}
                    onChangeText={(val) => updateDraftField(currentServiceDraft.service_code, 'promo_end_at', val ? `${val}T23:59:59Z` : null)}
                  />
                </View>
              </View>
            </View>

            {/* 2. Share Capital Increment Controls (LTD, PLC, Upgrade) */}
            {(currentServiceDraft.service_code === 'ltd' ||
              currentServiceDraft.service_code === 'plc' ||
              currentServiceDraft.service_code === 'upgrade_to_ltd') && (
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="pie-chart-outline" size={18} color={COLORS.navy} />
                  <Text style={styles.sectionTitle}>Share Capital Pricing Rules</Text>
                </View>
                <Text style={styles.sectionDesc}>
                  Configure base included share capital and incremental charges for extra capital requested by the customer.
                </Text>

                <View style={styles.inputGrid3}>
                  {/* Included Share Capital */}
                  <View style={styles.inputCol}>
                    <Text style={styles.fieldLabel}>Included Share Capital</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>₦</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(currentServiceDraft.included_share_capital || 0)}
                        onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'included_share_capital', t)}
                      />
                    </View>
                    <Text style={styles.inputHelp}>e.g. ₦1,000,000 included in base</Text>
                  </View>

                  {/* Increment Step */}
                  <View style={styles.inputCol}>
                    <Text style={styles.fieldLabel}>Increment Unit Step</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>₦</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(currentServiceDraft.share_capital_increment_step || 1000000)}
                        onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'share_capital_increment_step', t)}
                      />
                    </View>
                    <Text style={styles.inputHelp}>Step interval (usually ₦1,000,000)</Text>
                  </View>

                  {/* Fee per increment */}
                  <View style={styles.inputCol}>
                    <Text style={styles.fieldLabel}>Fee Per Increment</Text>
                    <View style={[styles.inputWrapper, { borderColor: COLORS.gold }]}>
                      <Text style={[styles.currencyPrefix, { color: COLORS.gold }]}>₦</Text>
                      <TextInput
                        style={[styles.textInput, { fontWeight: '700' }]}
                        keyboardType="numeric"
                        value={String(currentServiceDraft.share_capital_increment_fee || 0)}
                        onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'share_capital_increment_fee', t)}
                      />
                    </View>
                    <Text style={styles.inputHelp}>e.g. ₦30,000 or ₦40,000 each</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 3. Officers, Directors, Shareholders, and Trustees Allowances */}
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="people-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>Personnel & Officer Allowances</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Set the number of included directors, shareholders, or trustees and the surcharge for each additional member.
              </Text>

              {/* Directors Section */}
              <View style={styles.subSectionDivider}>
                <Text style={styles.subSectionTitle}>DIRECTORS</Text>
                <View style={styles.inputGrid2}>
                  <View style={styles.inputCol}>
                    <Text style={styles.fieldLabel}>Number of Included Directors</Text>
                    <TextInput
                      style={styles.textInputBox}
                      keyboardType="numeric"
                      value={String(currentServiceDraft.included_directors ?? 0)}
                      onChangeText={(t) => updateDraftField(currentServiceDraft.service_code, 'included_directors', parseInt(t) || 0)}
                    />
                    <Text style={styles.inputHelp}>Directors covered in base price (e.g. 2)</Text>
                  </View>

                  <View style={styles.inputCol}>
                    <Text style={styles.fieldLabel}>Fee Per Additional Director</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>₦</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(currentServiceDraft.additional_director_fee ?? 0)}
                        onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'additional_director_fee', t)}
                      />
                    </View>
                    <Text style={styles.inputHelp}>Charge per extra director (e.g. ₦5,000)</Text>
                  </View>
                </View>
              </View>

              {/* Shareholders Section (if company or upgrade) */}
              {(currentServiceDraft.service_code === 'ltd' ||
                currentServiceDraft.service_code === 'plc' ||
                currentServiceDraft.service_code === 'upgrade_to_ltd') && (
                <View style={styles.subSectionDivider}>
                  <Text style={styles.subSectionTitle}>SHAREHOLDERS</Text>
                  <View style={styles.inputGrid2}>
                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>Number of Included Shareholders</Text>
                      <TextInput
                        style={styles.textInputBox}
                        keyboardType="numeric"
                        value={String(currentServiceDraft.included_shareholders ?? 0)}
                        onChangeText={(t) => updateDraftField(currentServiceDraft.service_code, 'included_shareholders', parseInt(t) || 0)}
                      />
                      <Text style={styles.inputHelp}>Shareholders included in base (e.g. 2)</Text>
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>Fee Per Additional Shareholder</Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.currencyPrefix}>₦</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          value={String(currentServiceDraft.additional_shareholder_fee ?? 0)}
                          onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'additional_shareholder_fee', t)}
                        />
                      </View>
                      <Text style={styles.inputHelp}>₦0 if no additional charge configured</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Trustees Section (for Incorporated Trustee) */}
              {currentServiceDraft.service_code === 'incorporated_trustee' && (
                <View style={styles.subSectionDivider}>
                  <Text style={styles.subSectionTitle}>TRUSTEES (INCORPORATED TRUSTEE)</Text>
                  <View style={styles.inputGrid2}>
                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>Number of Included Trustees</Text>
                      <TextInput
                        style={styles.textInputBox}
                        keyboardType="numeric"
                        value={String(currentServiceDraft.included_trustees ?? 2)}
                        onChangeText={(t) => updateDraftField(currentServiceDraft.service_code, 'included_trustees', parseInt(t) || 0)}
                      />
                      <Text style={styles.inputHelp}>Base included trustees (e.g. 2)</Text>
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>Fee Per Additional Trustee</Text>
                      <View style={[styles.inputWrapper, { borderColor: COLORS.gold }]}>
                        <Text style={[styles.currencyPrefix, { color: COLORS.gold }]}>₦</Text>
                        <TextInput
                          style={[styles.textInput, { fontWeight: '700' }]}
                          keyboardType="numeric"
                          value={String(currentServiceDraft.additional_trustee_fee ?? 5000)}
                          onChangeText={(t) => handleCurrencyInput(currentServiceDraft.service_code, 'additional_trustee_fee', t)}
                        />
                      </View>
                      <Text style={styles.inputHelp}>Charge for each extra trustee (e.g. ₦5,000)</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* 4. Processing Time, Quotation Validity & Policy Notes */}
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>Processing SLA & Quotation Validity</Text>
              </View>

              <View style={styles.inputGrid2}>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Processing Time / SLA</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="e.g. 24 hours or 3 - 5 Business Days"
                    placeholderTextColor={COLORS.textMuted}
                    value={currentServiceDraft.processing_time || ''}
                    onChangeText={(t) => updateDraftField(currentServiceDraft.service_code, 'processing_time', t)}
                  />
                  <Text style={styles.inputHelp}>Displayed prominently to customer</Text>
                </View>

                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Quotation Validity Period (Hours)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    keyboardType="numeric"
                    placeholder="24"
                    placeholderTextColor={COLORS.textMuted}
                    value={String(currentServiceDraft.quote_validity_hours || 24)}
                    onChangeText={(t) => updateDraftField(currentServiceDraft.service_code, 'quote_validity_hours', parseInt(t) || 24)}
                  />
                  <Text style={styles.inputHelp}>Promotional quote validity lock period (default 24h)</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: GLOBAL TIN & ADD-ON SETTINGS */}
        {/* ========================================================= */}
        {activeTab === 'tin_settings' && (
          <View>
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="card-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>JTB Tax ID (TIN) Processing Add-on</Text>
              </View>
              <Text style={styles.sectionDesc}>
                When customers check "Apply with TIN (Tax ID)", this add-on charge is automatically appended to their quote.
              </Text>

              <View style={{ maxWidth: 400, marginTop: 8 }}>
                <Text style={styles.fieldLabel}>TIN Processing Add-on Fee</Text>
                <View style={[styles.inputWrapper, { borderColor: COLORS.gold, height: 46 }]}>
                  <Text style={[styles.currencyPrefix, { color: COLORS.gold, fontSize: 16 }]}>₦</Text>
                  <TextInput
                    style={[styles.textInput, { fontSize: 16, fontWeight: '700' }]}
                    keyboardType="numeric"
                    value={draftTinFee}
                    onChangeText={setDraftTinFee}
                  />
                </View>
                <Text style={styles.inputHelp}>
                  Current saved rate: {formatNaira(serverTinFee)}
                </Text>
              </View>
            </View>

            {/* Certificate Search / Retrieval Service Card */}
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>CAC Certificate Retrieval / Document Search</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Fee for retrieving certified true copies (CTC) of lost certificates and company status reports.
              </Text>

              <View style={{ maxWidth: 400, marginTop: 8 }}>
                <Text style={styles.fieldLabel}>Retrieval Search Fee (₦)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>₦</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={String(draftConfigs.cac_retrieval?.regular_price || 4000)}
                    onChangeText={(t) => handleCurrencyInput('cac_retrieval', 'regular_price', t)}
                  />
                </View>
                <Text style={styles.inputHelp}>Flat fee for registry archive search</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: LIVE SIMULATOR & CUSTOMER PRICE MATRIX */}
        {/* ========================================================= */}
        {activeTab === 'preview' && (
          <View>
            {/* Interactive Quotation Calculator */}
            <View style={[styles.card, { borderColor: COLORS.gold }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="calculator" size={20} color={COLORS.gold} />
                <Text style={[styles.sectionTitle, { color: COLORS.navy }]}>
                  Live Customer Pricing Simulator
                </Text>
              </View>
              <Text style={styles.sectionDesc}>
                Test how the customer interface calculates quotations in real-time with your current draft settings.
              </Text>

              {/* Service Select Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CAC_SERVICES_ORDER.map((code) => {
                    const cfg = draftConfigs[code];
                    const active = simService === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.simServicePill, active && styles.simServicePillActive]}
                        onPress={() => setSimService(code)}
                      >
                        <Text style={[styles.simServicePillText, active && styles.simServicePillTextActive]}>
                          {cfg.service_name.replace('Registration', '')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Parameter Controls */}
              <View style={styles.simParamsBox}>
                {(simService === 'ltd' || simService === 'plc' || simService === 'upgrade_to_ltd') && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.fieldLabel}>
                      Share Capital: {formatNaira(simShareCapital)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      {[1000000, 2000000, 5000000, 10000000].map((cap) => (
                        <TouchableOpacity
                          key={cap}
                          style={[styles.simOptionBtn, simShareCapital === cap && styles.simOptionBtnActive]}
                          onPress={() => setSimShareCapital(cap)}
                        >
                          <Text style={[styles.simOptionBtnTxt, simShareCapital === cap && styles.simOptionBtnTxtActive]}>
                            {cap >= 1000000 ? `${cap / 1000000}M` : formatNaira(cap)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Directors Counter */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.fieldLabel}>Number of Directors / Partners:</Text>
                  <View style={styles.counterRow}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setSimDirectors(Math.max(1, simDirectors - 1))}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                    <Text style={styles.counterVal}>{simDirectors}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setSimDirectors(simDirectors + 1)}
                    >
                      <Ionicons name="add" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Trustees Counter (if incorporated trustee) */}
                {simService === 'incorporated_trustee' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={styles.fieldLabel}>Number of Trustees:</Text>
                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => setSimTrustees(Math.max(1, simTrustees - 1))}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.navy} />
                      </TouchableOpacity>
                      <Text style={styles.counterVal}>{simTrustees}</Text>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => setSimTrustees(simTrustees + 1)}
                      >
                        <Ionicons name="add" size={16} color={COLORS.navy} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Include TIN switch */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  <Text style={styles.fieldLabel}>Include JTB TIN Tax ID Add-on (+{formatNaira(parseFloat(draftTinFee) || 3000)})</Text>
                  <Switch
                    value={simIncludeTin}
                    onValueChange={setSimIncludeTin}
                    trackColor={{ false: '#E2E8F0', true: COLORS.goldBorder }}
                    thumbColor={simIncludeTin ? COLORS.gold : '#94A3B8'}
                  />
                </View>
              </View>

              {/* Calculated Quotation Output Breakdown */}
              <View style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <Text style={styles.quoteTitle}>QUOTATION BREAKDOWN (SIMULATED)</Text>
                  <Text style={styles.quoteValidity}>24-HOUR VALIDITY LOCK</Text>
                </View>

                {simulatorResult.items.map((item, idx) => (
                  <View key={idx} style={styles.quoteRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.quoteItemLabel, item.type === 'discount' && { color: COLORS.success }]}>
                        {item.label}
                      </Text>
                      {item.detail && <Text style={styles.quoteItemDetail}>{item.detail}</Text>}
                    </View>
                    <Text style={[styles.quoteItemAmount, item.type === 'discount' && { color: COLORS.success, fontWeight: '800' }]}>
                      {item.amount < 0 ? `-${formatNaira(Math.abs(item.amount))}` : formatNaira(item.amount)}
                    </Text>
                  </View>
                ))}

                <View style={styles.quoteTotalRow}>
                  <Text style={styles.quoteTotalLabel}>TOTAL PAYABLE</Text>
                  <Text style={styles.quoteTotalAmount}>{formatNaira(simulatorResult.totalAmount)}</Text>
                </View>
              </View>
            </View>

            {/* Official Customer Price List Preview Table */}
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="list-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>Customer-Facing Public Price Matrix</Text>
              </View>

              {CAC_SERVICES_ORDER.map((code) => {
                const c = draftConfigs[code];
                const activePrice = c.is_promo_active && c.promo_price ? c.promo_price : c.regular_price;
                const hasDiscount = c.is_promo_active && c.regular_price > activePrice;

                return (
                  <View key={code} style={styles.matrixRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.matrixServiceName}>{c.service_name}</Text>
                        {hasDiscount && (
                          <View style={styles.matrixPromoBadge}>
                            <Text style={styles.matrixPromoBadgeTxt}>
                              SAVE {formatNaira(c.regular_price - activePrice)}
                            </Text>
                          </View>
                        )}
                        {!c.is_available && (
                          <View style={[styles.matrixPromoBadge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={[styles.matrixPromoBadgeTxt, { color: '#DC2626' }]}>OFFLINE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.matrixServiceSub}>
                        SLA: {c.processing_time} • {c.included_share_capital > 0 ? `Includes ₦${(c.included_share_capital / 1000000).toFixed(0)}M Share` : 'Standard Filing'}
                        {c.included_directors > 0 ? ` • ${c.included_directors} Directors Inc.` : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.matrixPrice}>{formatNaira(activePrice)}</Text>
                      {hasDiscount && <Text style={styles.matrixOrigPrice}>{formatNaira(c.regular_price)}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 4: AUDIT LOGS */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <View>
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.navy} />
                <Text style={styles.sectionTitle}>Administrative Audit Trail</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Complete chronological log of authorized administrators who changed pricing parameters and rules.
              </Text>

              {loadingAudit ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={COLORS.navy} />
                </View>
              ) : auditLogs.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={36} color={COLORS.border} />
                  <Text style={{ marginTop: 8, color: COLORS.textMuted, fontSize: 13 }}>No audit logs recorded yet.</Text>
                </View>
              ) : (
                auditLogs.map((log) => (
                  <View key={log.id} style={styles.auditLogItem}>
                    <View style={styles.auditLogIconBox}>
                      <Ionicons name="person" size={15} color={COLORS.navy} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.auditAdminEmail}>{log.admin_email || 'Administrator'}</Text>
                        <Text style={styles.auditTimestamp}>
                          {new Date(log.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.auditSummary}>{log.summary || 'Updated pricing settings'}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarStatus}>
            {hasUnsavedChanges ? `${modifiedList.length} field(s) modified` : 'All changes saved'}
          </Text>
          <Text style={styles.bottomBarSub}>
            {hasUnsavedChanges ? 'Tap Save to publish changes live' : 'Client apps reflect current settings'}
          </Text>
        </View>

        <View style={styles.bottomBarActions}>
          <TouchableOpacity
            style={[styles.cancelBtn, !hasUnsavedChanges && { opacity: 0.5 }]}
            onPress={handleResetDrafts}
            disabled={!hasUnsavedChanges || saving}
          >
            <Text style={styles.cancelBtnText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, !hasUnsavedChanges && { opacity: 0.5 }]}
            onPress={() => setShowConfirmModal(true)}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={16} color={COLORS.white} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirmation Modal Before Publishing */}
      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={24} color={COLORS.gold} />
                <Text style={styles.confirmModalTitle}>Confirm Pricing Publish</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.confirmModalSubtitle}>
              You are about to publish the following dynamic pricing modifications. All new customer quotations and checkouts will immediately use these updated rates:
            </Text>

            <ScrollView style={{ maxHeight: 260, marginVertical: 12 }}>
              {modifiedList.map((m, idx) => (
                <View key={idx} style={styles.confirmDiffRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.diffServiceName}>{m.serviceName}</Text>
                    <Text style={styles.diffFieldLabel}>{m.label}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.diffOldVal}>{m.from}</Text>
                    <Ionicons name="arrow-down" size={10} color={COLORS.textMuted} />
                    <Text style={styles.diffNewVal}>{m.to}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPublishBtn}
                onPress={handleSaveConfirmed}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalPublishBtnTxt}>Publish Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
  headerIconBtn: { padding: 8, marginRight: 8 },

  // Hero Telemetry Header
  heroSummaryBar: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  unsavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  unsavedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
    lineHeight: 16,
  },

  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  statVal: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  statLbl: { color: '#94A3B8', fontSize: 10, fontWeight: '600', marginTop: 1 },

  // Tab Carousel
  tabScrollWrap: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: COLORS.goldBorder,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  tabBtnTextActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },
  tabBtnSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  tabBtnSubActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },

  scrollArea: { flex: 1 },

  // Card Structure
  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  serviceHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
  },
  serviceCategoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  serviceDesc: {
    fontSize: 12,
    color: COLORS.textSub,
    lineHeight: 18,
    marginTop: 4,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
  },
  sectionDesc: {
    fontSize: 12,
    color: COLORS.textSub,
    marginBottom: 12,
    lineHeight: 16,
  },

  // Inputs & Grid Layouts
  inputGrid2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGrid3: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inputCol: { flex: 1, minWidth: 0 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSub,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
    paddingVertical: 0,
    height: '100%',
  },
  textInputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
  },
  inputHelp: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 3,
  },

  // Promo Toggle Box
  promoToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    marginBottom: 12,
  },
  promoToggleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  promoToggleDesc: {
    fontSize: 11,
    color: COLORS.textSub,
    marginTop: 2,
    lineHeight: 15,
  },

  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 12,
  },
  savingsBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },

  // Subsections
  subSectionDivider: {
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Simulator
  simServicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  simServicePillActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  simServicePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  simServicePillTextActive: {
    color: COLORS.white,
  },
  simParamsBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  simOptionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  simOptionBtnActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  simOptionBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  simOptionBtnTxtActive: {
    color: COLORS.white,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
    minWidth: 20,
    textAlign: 'center',
  },

  // Quote Card
  quoteCard: {
    backgroundColor: COLORS.navy,
    padding: 14,
    borderRadius: 12,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  quoteTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.goldBright,
    letterSpacing: 0.5,
  },
  quoteValidity: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quoteItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quoteItemDetail: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  quoteItemAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quoteTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  quoteTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  quoteTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.goldBright,
  },

  // Public Matrix Preview
  matrixRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  matrixServiceName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  matrixPromoBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matrixPromoBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  matrixServiceSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  matrixPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
  },
  matrixOrigPrice: {
    fontSize: 11,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },

  // Audit Logs
  auditLogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  auditLogIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditAdminEmail: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  auditTimestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  auditSummary: {
    fontSize: 11,
    color: COLORS.textSub,
    marginTop: 2,
    lineHeight: 15,
  },

  // Bottom Sticky Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomBarInfo: { flex: 1, marginRight: 10 },
  bottomBarStatus: { fontSize: 13, fontWeight: '800', color: COLORS.navy },
  bottomBarSub: { fontSize: 11, color: COLORS.textSub, marginTop: 1 },
  bottomBarActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
  },
  saveBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.white },

  // Confirmation Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
  },
  confirmModalSubtitle: {
    fontSize: 12,
    color: COLORS.textSub,
    lineHeight: 18,
    marginBottom: 8,
  },
  confirmDiffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  diffServiceName: { fontSize: 11, fontWeight: '800', color: COLORS.navy },
  diffFieldLabel: { fontSize: 10, color: COLORS.textSub },
  diffOldVal: { fontSize: 10, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  diffNewVal: { fontSize: 12, fontWeight: '800', color: COLORS.navy },
  confirmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnTxt: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  modalPublishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
  },
  modalPublishBtnTxt: { fontSize: 13, fontWeight: '800', color: COLORS.white },
});
