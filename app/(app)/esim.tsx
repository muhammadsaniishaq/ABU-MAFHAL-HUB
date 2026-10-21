import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  StyleSheet,
  StatusBar,
  Alert,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import {
  payvesselEsimService,
  EsimRegion,
  EsimPackage,
  UserEsim,
} from '../../services/payvesselEsim';
import BrandAlertModal, { BrandAlertState } from '../../components/BrandAlertModal';

// Brand Design Tokens
const BRAND = {
  navy: '#0D1B3E',
  navyDark: '#070D1E',
  navyLight: '#162A5A',
  gold: '#F5A623',
  goldDark: '#D97706',
  goldLight: '#FEF3C7',
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  textMain: '#0F172A',
  textSub: '#64748B',
  green: '#15803D',
};

// Light theme status badge colors
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE:   { bg: '#DCFCE7', border: '#86EFAC', text: '#15803D' },
  PENDING:  { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },
  EXPIRED:  { bg: '#F1F5F9', border: '#E2E8F0', text: '#64748B' },
  DEPLETED: { bg: '#F1F5F9', border: '#E2E8F0', text: '#64748B' },
  FAILED:   { bg: '#FEE2E2', border: '#FECACA', text: '#B91C1C' },
};

// Aliases for intuitive, fast search across top travel destinations
const COUNTRY_ALIASES: Record<string, string[]> = {
  SA: ['saudi', 'arabia', 'makkah', 'mecca', 'medina', 'madinah', 'hajj', 'umrah', 'ksa', 'riyadh', 'jeddah'],
  AE: ['uae', 'dubai', 'emirates', 'abu dhabi', 'sharjah'],
  GB: ['uk', 'united kingdom', 'england', 'britain', 'london', 'great britain'],
  US: ['usa', 'united states', 'america', 'new york', 'california'],
  TR: ['turkey', 'turkiye', 'istanbul', 'ankara'],
  EG: ['egypt', 'cairo', 'alexandria', 'misr'],
  GH: ['ghana', 'accra', 'kumasi'],
  NG: ['nigeria', 'lagos', 'abuja'],
  ZA: ['south africa', 'johannesburg', 'cape town'],
  CA: ['canada', 'toronto', 'vancouver', 'montreal'],
  DE: ['germany', 'berlin', 'frankfurt', 'munich', 'europe'],
  FR: ['france', 'paris', 'europe'],
  QA: ['qatar', 'doha'],
  KW: ['kuwait', 'kuwait city'],
  CN: ['china', 'beijing', 'shanghai', 'guangzhou', 'hong kong'],
  MY: ['malaysia', 'kuala lumpur'],
  IN: ['india', 'delhi', 'mumbai'],
};

// Continent categorization mapping for fast filtering
const REGION_CATEGORIES: Record<string, string[]> = {
  'MIDDLE EAST': ['SA', 'AE', 'QA', 'KW', 'OM', 'BH', 'JO', 'IL', 'IQ', 'LB'],
  'EUROPE':      ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CH', 'PT', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'GR', 'CZ', 'RO', 'HU'],
  'AFRICA':      ['NG', 'GH', 'EG', 'ZA', 'KE', 'MA', 'RW', 'UG', 'TZ', 'SN', 'CI', 'ET', 'CM', 'DZ', 'TN'],
  'AMERICAS':    ['US', 'CA', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'],
  'ASIA':        ['CN', 'JP', 'KR', 'SG', 'MY', 'TH', 'ID', 'IN', 'VN', 'PH', 'HK', 'TW'],
};

export default function EsimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'buy' | 'my_esims'>('buy');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Data States
  const [regions, setRegions] = useState<EsimRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<EsimRegion | null>(null);
  const [packages, setPackages] = useState<EsimPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<EsimPackage | null>(null);
  const [myEsims, setMyEsims] = useState<UserEsim[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Country Dropdown Picker States
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<'ALL' | 'POPULAR' | 'MIDDLE EAST' | 'EUROPE' | 'AFRICA' | 'AMERICAS' | 'ASIA'>('ALL');

  // Modals & Popups
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeEsimModal, setActiveEsimModal] = useState<UserEsim | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [checkingStatusRef, setCheckingStatusRef] = useState<string | null>(null);

  // Smooth Brand Alert State (works on both Web & Native)
  const [brandAlert, setBrandAlert] = useState<BrandAlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttonText: 'OK',
  });

  const showBrandAlert = useCallback((
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    buttonText: string = 'OK',
    onConfirm?: () => void,
    showCancel: boolean = false,
    cancelText: string = 'Cancel',
    onCancel?: () => void
  ) => {
    try {
      if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    setBrandAlert({
      visible: true,
      title,
      message,
      type,
      buttonText,
      onConfirm,
      showCancel,
      cancelText,
      onCancel,
    });
  }, []);

  // Top-Up States
  const [topupModalEsim, setTopupModalEsim] = useState<UserEsim | null>(null);
  const [topupPackages, setTopupPackages] = useState<EsimPackage[]>([]);
  const [selectedTopupPackage, setSelectedTopupPackage] = useState<EsimPackage | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshBalance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();
        if (profile) setWalletBalance(Number(profile.balance) || 0);
      }
    } catch (_) {}
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await refreshBalance();

      // 2. Fetch Regions from PayVessel
      const { regions: fetchedRegions } = await payvesselEsimService.getRegions();
      setRegions(fetchedRegions);

      // Default to Saudi Arabia or first available
      const defaultReg = fetchedRegions.find(r => r.code === 'SA') || fetchedRegions[0];
      if (defaultReg) {
        setSelectedRegion(defaultReg);
        loadPackagesForRegion(defaultReg.code);
      }

      // 3. Fetch user's existing eSIMs
      const esims = await payvesselEsimService.getMyEsims();
      setMyEsims(esims);
    } catch (e) {
      console.error('Error loading eSIM data:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBalance();
      if (activeTab === 'buy') {
        const { regions: fetchedRegions } = await payvesselEsimService.getRegions();
        setRegions(fetchedRegions);
        if (selectedRegion) {
          await loadPackagesForRegion(selectedRegion.code);
        }
      } else {
        const esims = await payvesselEsimService.getMyEsims();
        setMyEsims(esims);
      }
      showToast('Updated successfully! 🔄');
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, selectedRegion]);

  const loadPackagesForRegion = async (code: string) => {
    try {
      setPackagesLoading(true);
      const pkgs = await payvesselEsimService.getPackages(code);
      setPackages(pkgs);
      if (pkgs.length > 0) {
        setSelectedPackage(pkgs[0]);
      } else {
        setSelectedPackage(null);
      }
    } catch (e) {
      console.error('Error loading packages:', e);
    } finally {
      setPackagesLoading(false);
    }
  };

  const handleSelectRegion = (region: EsimRegion) => {
    setSelectedRegion(region);
    setShowCountryPicker(false);
    setCountrySearch('');
    loadPackagesForRegion(region.code);
  };

  const handlePurchasePress = () => {
    if (!selectedPackage || !selectedRegion) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    if (walletBalance < selectedPackage.price_ngn) {
      showBrandAlert(
        'Insufficient Balance',
        `You need ₦${selectedPackage.price_ngn.toLocaleString()} to purchase this eSIM bundle, but your current wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        'warning',
        'Fund Wallet',
        () => router.push('/wallet'),
        true,
        'Cancel'
      );
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    if (!selectedPackage || !selectedRegion) return;
    try {
      setActionLoading(true);
      const createdEsim = await payvesselEsimService.orderEsim({
        package_code: selectedPackage.package_code,
        country_code: selectedRegion.code,
        country_name: selectedRegion.name,
        data_amount: selectedPackage.data_amount,
        validity_days: selectedPackage.validity_days,
        price_ngn: selectedPackage.price_ngn,
        price_usd: selectedPackage.price_usd
      });

      // Synchronize fresh wallet balance
      await refreshBalance();

      // Refresh list & select newly created eSIM
      setMyEsims(prev => [createdEsim, ...prev]);
      setShowConfirmModal(false);
      setActiveEsimModal(createdEsim);
      showToast('eSIM Activated Successfully! 🎉');
    } catch (e: any) {
      showBrandAlert(
        'Activation Notice',
        e.message || 'Failed to complete eSIM order. Please verify your balance and try again.',
        'error',
        'OK'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    showToast(`${label} copied to clipboard! 📋`);
  };

  const shareActivationDetails = async (esim: UserEsim) => {
    try {
      const shareText =
        `🌐 ABU-MAFHAL Global eSIM Setup\n` +
        `Destination: ${esim.country_name}\n` +
        `Data Plan: ${esim.data_amount} (${esim.validity_days} Days)\n` +
        `ICCID: ${esim.iccid || 'Provisioned'}\n` +
        `SM-DP+ Address: ${esim.smdp_address || 'rsp.truphone.com'}\n` +
        `Activation Code: ${esim.activation_code || esim.order_reference}\n` +
        `LPA String: ${esim.lpa_activation_code || 'LPA:1$rsp.truphone.com$' + (esim.activation_code || '')}\n` +
        `Status: ${esim.status}\n` +
        `Reference: ${esim.order_reference}\n\n` +
        `Instructions: Go to Settings > Cellular / Mobile Data > Add eSIM, then scan the QR code or enter the SM-DP+ Address and Activation Code manually.`;
      await Share.share({ message: shareText, title: `${esim.country_name} eSIM Activation Details` });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const handleCheckStatus = async (esim: UserEsim) => {
    try {
      setCheckingStatusRef(esim.order_reference);
      const result = await payvesselEsimService.checkEsimStatus(esim.order_reference);
      const newStatus = result.status?.toUpperCase() ?? 'UNKNOWN';
      setMyEsims(prev =>
        prev.map(e =>
          e.order_reference === esim.order_reference
            ? { ...e, status: newStatus as UserEsim['status'] }
            : e
        )
      );
      showToast(`eSIM Status: ${newStatus} ✅`);
    } catch (e: any) {
      showBrandAlert('Status Check', e.message ?? 'Could not check eSIM status.', 'info');
    } finally {
      setCheckingStatusRef(null);
    }
  };

  const handleOpenTopup = async (esim: UserEsim) => {
    if (!esim.iccid) {
      showBrandAlert('Notice', 'This eSIM profile does not have an ICCID yet or is still provisioning. Please check status first.', 'info');
      return;
    }
    setTopupModalEsim(esim);
    setTopupLoading(true);
    setTopupPackages([]);
    setSelectedTopupPackage(null);

    try {
      let pkgs = await payvesselEsimService.getTopupPackages(esim.iccid);
      if (!pkgs || pkgs.length === 0) {
        pkgs = await payvesselEsimService.getPackages(esim.country_code);
      }
      setTopupPackages(pkgs);
      if (pkgs && pkgs.length > 0) setSelectedTopupPackage(pkgs[0]);
    } catch (e: any) {
      console.warn('Failed to fetch top-up packages, falling back:', e);
      try {
        const fallbackPkgs = await payvesselEsimService.getPackages(esim.country_code);
        setTopupPackages(fallbackPkgs);
        if (fallbackPkgs && fallbackPkgs.length > 0) setSelectedTopupPackage(fallbackPkgs[0]);
      } catch (_) {}
    } finally {
      setTopupLoading(false);
    }
  };

  const handleConfirmTopup = async () => {
    if (!topupModalEsim || !topupModalEsim.iccid || !selectedTopupPackage) return;

    if (walletBalance < selectedTopupPackage.price_ngn) {
      showBrandAlert(
        'Insufficient Balance',
        `You need ₦${selectedTopupPackage.price_ngn.toLocaleString()} to top up this eSIM, but your wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        'warning',
        'Fund Wallet',
        () => {
          setTopupModalEsim(null);
          router.push('/wallet');
        },
        true,
        'Cancel'
      );
      return;
    }

    try {
      setTopupSubmitting(true);
      await payvesselEsimService.topupEsim({
        iccid: topupModalEsim.iccid,
        package_code: selectedTopupPackage.package_code,
        price_ngn: selectedTopupPackage.price_ngn,
        price_usd: selectedTopupPackage.price_usd,
      });

      await refreshBalance();
      setTopupModalEsim(null);
      showToast('eSIM Top-Up Successful! 📶⚡');
      handleCheckStatus(topupModalEsim);
    } catch (e: any) {
      showBrandAlert('Top-Up Notice', e.message || 'Failed to complete eSIM top-up.', 'error');
    } finally {
      setTopupSubmitting(false);
    }
  };

  // Helper to extract clean supported operator names
  const getOperatorsText = (pkg: EsimPackage) => {
    if (!pkg.networks || !Array.isArray(pkg.networks)) return null;
    const names: string[] = [];
    for (const net of pkg.networks) {
      const ops = net.operators || [];
      for (const op of ops) {
        if (op.operator_name) {
          const type = op.network_type ? ` (${op.network_type})` : '';
          names.push(`${op.operator_name}${type}`);
        }
      }
    }
    return names.length > 0 ? names.slice(0, 3).join(' • ') : null;
  };

  // Filter regions with smart aliases + continent tabs
  const filteredRegions = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();

    return regions.filter(r => {
      // 1. Region category filter
      if (regionFilter === 'POPULAR' && !r.popular) return false;
      if (regionFilter !== 'ALL' && regionFilter !== 'POPULAR') {
        const allowedCodes = REGION_CATEGORIES[regionFilter] || [];
        if (!allowedCodes.includes(r.code.toUpperCase())) return false;
      }

      // 2. Search query filter
      if (!q) return true;
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.code.toLowerCase().includes(q)) return true;

      const aliases = COUNTRY_ALIASES[r.code.toUpperCase()] || [];
      return aliases.some(a => a.includes(q) || q.includes(a));
    });
  }, [regions, countrySearch, regionFilter]);

  const headerTopPadding = Math.max(insets?.top || 0, Platform.OS === 'android' ? 36 : 22) + 8;
  const bottomBarPadding = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 16);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.navyDark} />

      {/* Modern Brand Navy Header */}
      <LinearGradient
        colors={[BRAND.navyDark, BRAND.navy, BRAND.navyLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerContainer, { paddingTop: headerTopPadding }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerTitle}>Global eSIM Roaming</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Ionicons name="flash" size={11} color={BRAND.gold} />
              <Text style={styles.headerSubtitle}>PayVessel High-Speed Data 🌐</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/wallet')}
            style={styles.balancePill}
            activeOpacity={0.8}
          >
            <View style={styles.balanceIconWrap}>
              <Ionicons name="wallet-outline" size={13} color={BRAND.gold} />
            </View>
            <View>
              <Text style={styles.balancePillLabel}>Balance</Text>
              <Text style={styles.balancePillText}>₦{walletBalance.toLocaleString()}</Text>
            </View>
            <View style={styles.balancePlusWrap}>
              <Ionicons name="add" size={12} color={BRAND.navy} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Tabs Bar in Header */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab('buy')}
            style={[styles.tabButton, activeTab === 'buy' && styles.activeTabButton]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="globe-outline"
              size={15}
              color={activeTab === 'buy' ? '#FFFFFF' : 'rgba(255,255,255,0.65)'}
            />
            <Text style={[styles.tabText, activeTab === 'buy' && styles.activeTabText]}>
              Buy eSIM Data
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setActiveTab('my_esims');
              payvesselEsimService.getMyEsims().then(setMyEsims);
            }}
            style={[styles.tabButton, activeTab === 'my_esims' && styles.activeTabButton]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cellular-outline"
              size={15}
              color={activeTab === 'my_esims' ? '#FFFFFF' : 'rgba(255,255,255,0.65)'}
            />
            <Text style={[styles.tabText, activeTab === 'my_esims' && styles.activeTabText]}>
              My eSIMs ({myEsims.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={BRAND.navy} />
          <Text style={styles.loaderText}>Connecting to Global eSIM Gateway...</Text>
        </View>
      ) : activeTab === 'buy' ? (
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: selectedPackage ? 140 : 60 }
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND.navy, BRAND.gold]} />
            }
          >
            {/* Zero Roaming Charge Guarantee Banner */}
            <LinearGradient
              colors={['#ECFDF5', '#F0FDF4']}
              style={styles.guaranteeCard}
            >
              <View style={styles.guaranteeIconWrap}>
                <Ionicons name="shield-checkmark" size={17} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.guaranteeTitle}>Instant Global eSIM Roaming</Text>
                  <View style={styles.guaranteePill}>
                    <Text style={styles.guaranteePillText}>ZERO SURCHARGE</Text>
                  </View>
                </View>
                <Text style={styles.guaranteeSubtitle}>
                  Instant QR code & activation credentials generated straight from PayVessel roaming server.
                </Text>
              </View>
            </LinearGradient>

            {/* DESTINATION DROPDOWN SELECTOR */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
              <Text style={styles.sectionLabel}>SELECT DESTINATION COUNTRY</Text>
              <Text style={{ fontSize: 11, color: BRAND.textSub, fontWeight: '700' }}>
                {regions.length}+ countries
              </Text>
            </View>
            
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowCountryPicker(true)}
              style={styles.dropdownButton}
            >
              <View style={styles.dropdownLeft}>
                <View style={styles.flagCircle}>
                  <Text style={{ fontSize: 24 }}>{selectedRegion?.flag || '🌐'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownTitle} numberOfLines={1}>
                    {selectedRegion ? selectedRegion.name : 'Choose a Country / Region'}
                  </Text>
                  <Text style={styles.dropdownSubtitle}>
                    {selectedRegion
                      ? `${selectedRegion.code} • Tap to switch destination country`
                      : 'Tap to choose from 240+ global destinations'}
                  </Text>
                </View>
              </View>
              <View style={styles.dropdownChevronBox}>
                <Ionicons name="chevron-down" size={18} color={BRAND.navy} />
              </View>
            </TouchableOpacity>

            {/* Section Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
              <Text style={styles.sectionLabel}>AVAILABLE DATA PLANS</Text>
              {packages.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {packages.length} plans • {selectedRegion?.name}
                  </Text>
                </View>
              )}
            </View>

            {packagesLoading ? (
              <View style={styles.packagesLoader}>
                <ActivityIndicator color={BRAND.navy} size="small" />
                <Text style={styles.packagesLoaderText}>Loading bundles for {selectedRegion?.name}...</Text>
              </View>
            ) : packages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>No Packages Found</Text>
                <Text style={styles.emptyStateSub}>No active plans for this country right now. Please select another destination.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {packages.map((pkg) => {
                  const isSelected = selectedPackage?.package_code === pkg.package_code;
                  const operators = getOperatorsText(pkg);
                  return (
                    <TouchableOpacity
                      key={pkg.package_code}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedPackage(pkg);
                        try {
                          Haptics.selectionAsync();
                        } catch (_) {}
                      }}
                      style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                    >
                      {/* Active indicator bar */}
                      <View style={[styles.packageCardIndicator, isSelected && styles.packageCardIndicatorActive]} />

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingLeft: 4 }}>
                        <View style={[styles.dataIconBox, isSelected && styles.dataIconBoxSelected]}>
                          <Ionicons
                            name="wifi"
                            size={16}
                            color={isSelected ? '#FFFFFF' : BRAND.navy}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.packageDataAmount, isSelected && { color: BRAND.navy }]}>
                              {pkg.data_amount}
                            </Text>
                            <View style={[styles.dayBadge, isSelected && styles.dayBadgeSelected]}>
                              <Ionicons name="time-outline" size={10} color={isSelected ? BRAND.navy : '#64748B'} />
                              <Text style={[styles.dayBadgeText, isSelected && { color: BRAND.navy }]}>
                                {pkg.validity_days} {pkg.validity_days === 1 ? 'Day' : 'Days'}
                              </Text>
                            </View>
                          </View>
                          {operators ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Ionicons name="checkmark-circle" size={10} color="#059669" />
                              <Text style={styles.operatorBadgeText} numberOfLines={1}>
                                {operators}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.packageNetworkName} numberOfLines={1}>Instant Roaming Data</Text>
                          )}
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
                        <Text style={[styles.packagePriceNgn, isSelected && { color: BRAND.navy }]}>
                          ₦{pkg.price_ngn.toLocaleString()}
                        </Text>
                        <Text style={styles.packagePriceUsd}>${pkg.price_usd.toFixed(2)}</Text>
                      </View>

                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Info Notice */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color={BRAND.navy} />
              <Text style={styles.infoBannerText}>
                Compatible with all unlocked eSIM smartphones (iPhone XS & above, Samsung Galaxy S20+, Google Pixel 3+). QR code & manual codes are generated instantly upon order.
              </Text>
            </View>
          </ScrollView>
        </View>
      ) : (
        /* MY ESIMS TAB */
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND.navy, BRAND.gold]} />
          }
        >
          {myEsims.length === 0 ? (
            <View style={styles.emptyEsims}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="qr-code-outline" size={48} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Active eSIMs Found</Text>
              <Text style={styles.emptySub}>
                You have not purchased any global eSIM yet. Select a destination to get high-speed roaming data today.
              </Text>
              <TouchableOpacity
                onPress={() => setActiveTab('buy')}
                style={styles.emptyActionBtn}
              >
                <Text style={styles.emptyActionBtnText}>Browse Destinations ✈️</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {myEsims.map((esim) => (
                <View key={esim.id || esim.order_reference} style={styles.myEsimCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={styles.esimIconBox}>
                        <Ionicons name="globe" size={18} color="#0056D2" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.myEsimCountryName} numberOfLines={1}>
                          {esim.country_name}
                        </Text>
                        <Text style={styles.myEsimRef}>
                          Ref: {esim.order_reference}
                        </Text>
                      </View>
                    </View>

                    <View style={[
                      styles.statusBadge,
                      {
                        backgroundColor: (STATUS_COLORS[esim.status] ?? STATUS_COLORS.ACTIVE).bg,
                        borderColor:     (STATUS_COLORS[esim.status] ?? STATUS_COLORS.ACTIVE).border,
                      }
                    ]}>
                      <Text style={[styles.statusBadgeText, { color: (STATUS_COLORS[esim.status] ?? STATUS_COLORS.ACTIVE).text }]}>
                        {esim.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.esimMetaGrid}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>DATA PACKAGE</Text>
                      <Text style={styles.metaVal}>{esim.data_amount}</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>VALIDITY</Text>
                      <Text style={styles.metaVal}>{esim.validity_days} Days</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>ICCID</Text>
                      <Text style={styles.metaVal}>{esim.iccid ? esim.iccid.substring(0, 10) + '...' : 'Provisioned'}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setActiveEsimModal(esim)}
                      style={[styles.viewQrBtn, { flex: 2 }]}
                    >
                      <Ionicons name="qr-code" size={15} color="#0056D2" />
                      <Text style={styles.viewQrBtnText}>QR & Details</Text>
                    </TouchableOpacity>

                    {esim.iccid ? (
                      <TouchableOpacity
                        onPress={() => handleOpenTopup(esim)}
                        style={[styles.viewQrBtn, { flex: 1.6, borderColor: '#FDE68A', backgroundColor: '#FEF3C7' }]}
                      >
                        <Ionicons name="flash" size={14} color="#B45309" />
                        <Text style={[styles.viewQrBtnText, { color: '#B45309', fontSize: 11 }]}>Top Up</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => handleCheckStatus(esim)}
                      disabled={checkingStatusRef === esim.order_reference}
                      style={[styles.viewQrBtn, { flex: 1.2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}
                    >
                      {checkingStatusRef === esim.order_reference ? (
                        <ActivityIndicator size={13} color="#475569" />
                      ) : (
                        <Ionicons name="refresh-outline" size={14} color="#475569" />
                      )}
                      <Text style={[styles.viewQrBtnText, { color: '#475569', fontSize: 11 }]}>Status</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* COUNTRY DROPDOWN MODAL PICKER WITH CONTINENT TABS & SMART SEARCH     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 16 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Select Destination</Text>
                <Text style={styles.modalSubtitle}>Choose from {regions.length} supported global countries</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.dropdownSearchBox}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <TextInput
                style={styles.dropdownSearchInput}
                placeholder="Search country (e.g. Saudi, UK, Dubai, USA)..."
                placeholderTextColor="#94A3B8"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus={false}
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Category / Continent Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['ALL', 'POPULAR', 'MIDDLE EAST', 'EUROPE', 'AFRICA', 'AMERICAS', 'ASIA'] as const).map((cat) => {
                  const isActive = regionFilter === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setRegionFilter(cat)}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                    >
                      <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* List of Countries */}
            <FlatList
              data={filteredRegions}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isCurrent = selectedRegion?.code === item.code;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelectRegion(item)}
                    style={[styles.countryListItem, isCurrent && styles.countryListItemActive]}
                  >
                    <Text style={{ fontSize: 26, marginRight: 12 }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.countryItemName, isCurrent && { color: BRAND.navy, fontWeight: '900' }]}>
                        {item.name}
                      </Text>
                      <Text style={styles.countryItemCode}>
                        {item.code} {item.popular ? '• Popular Travel Destination' : ''}
                      </Text>
                    </View>
                    {isCurrent && (
                      <Ionicons name="checkmark-circle" size={22} color={BRAND.navy} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="search" size={32} color="#CBD5E1" />
                  <Text style={{ color: '#64748B', marginTop: 8, fontSize: 13 }}>No countries match your search</Text>
                </View>
              }
            />

            <TouchableOpacity
              onPress={() => setShowCountryPicker(false)}
              style={[styles.cancelBtn, { marginTop: 12 }]}
            >
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONFIRMATION PURCHASE MODAL                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[styles.confirmIconRing, { backgroundColor: BRAND.goldLight, borderColor: '#FDE68A' }]}>
                <Ionicons name="cellular" size={26} color={BRAND.navy} />
              </View>
              <Text style={styles.modalTitle}>Confirm eSIM Activation</Text>
              <Text style={styles.modalSubtitle}>Direct PayVessel Roaming Gateway 🌐</Text>
            </View>

            <View style={styles.confirmBreakdown}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Destination</Text>
                <Text style={styles.confirmRowVal}>{selectedRegion?.flag} {selectedRegion?.name}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Data Volume</Text>
                <Text style={[styles.confirmRowVal, { color: BRAND.navy }]}>{selectedPackage?.data_amount}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Validity Period</Text>
                <Text style={styles.confirmRowVal}>{selectedPackage?.validity_days} Days</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                <Text style={[styles.confirmRowLabel, { color: '#0F172A', fontWeight: 'bold' }]}>Wallet Deduction</Text>
                <Text style={[styles.confirmRowVal, { color: BRAND.navy, fontSize: 18, fontWeight: '900' }]}>
                  ₦{selectedPackage?.price_ngn.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setShowConfirmModal(false)}
                style={styles.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmOrder}
                disabled={actionLoading}
                style={[styles.confirmPayBtn, { backgroundColor: BRAND.navy }]}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flash" size={15} color={BRAND.gold} />
                    <Text style={styles.confirmPayBtnText}>Pay & Activate</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ACTIVE ESIM DETAILS & QR CODE MODAL                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeEsimModal && (
        <Modal visible={Boolean(activeEsimModal)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 24 }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{activeEsimModal.country_name} eSIM</Text>
                    <Text style={styles.modalSubtitle}>{activeEsimModal.data_amount} — {activeEsimModal.validity_days} Days</Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveEsimModal(null)}>
                    <Ionicons name="close-circle" size={28} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* QR Code Container */}
                <View style={styles.qrCodeBox}>
                  {activeEsimModal.qr_code_url ? (
                    <Image
                      source={{ uri: activeEsimModal.qr_code_url }}
                      style={{ width: 200, height: 200, borderRadius: 8, backgroundColor: '#FFFFFF' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="qr-code" size={90} color={BRAND.navy} />
                      <Text style={{ color: '#0F172A', fontWeight: 'bold', marginTop: 10 }}>Scan to Activate</Text>
                    </View>
                  )}
                  <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', marginTop: 8 }}>
                    Scan with your iPhone or Android Camera
                  </Text>
                </View>

                {/* Quick Share / Export Button */}
                <TouchableOpacity
                  onPress={() => shareActivationDetails(activeEsimModal)}
                  style={styles.shareSetupBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-social-outline" size={16} color={BRAND.navy} />
                  <Text style={styles.shareSetupBtnText}>Share Setup Details to WhatsApp / Notes</Text>
                </TouchableOpacity>

                {/* Manual Setup Details */}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>MANUAL ACTIVATION DETAILS</Text>

                <View style={styles.codeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>SM-DP+ ADDRESS</Text>
                    <Text style={styles.codeVal}>{activeEsimModal.smdp_address || 'rsp.truphone.com'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(activeEsimModal.smdp_address || 'rsp.truphone.com', 'SM-DP+ Address')}
                    style={styles.copyBtn}
                  >
                    <Ionicons name="copy-outline" size={16} color={BRAND.navy} />
                  </TouchableOpacity>
                </View>

                <View style={styles.codeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>ACTIVATION CODE</Text>
                    <Text style={styles.codeVal}>{activeEsimModal.activation_code || activeEsimModal.order_reference}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(activeEsimModal.activation_code || activeEsimModal.order_reference, 'Activation Code')}
                    style={styles.copyBtn}
                  >
                    <Ionicons name="copy-outline" size={16} color={BRAND.navy} />
                  </TouchableOpacity>
                </View>

                {activeEsimModal.iccid ? (
                  <View style={styles.codeItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeLabel}>ICCID</Text>
                      <Text style={styles.codeVal}>{activeEsimModal.iccid}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(activeEsimModal.iccid!, 'ICCID')}
                      style={styles.copyBtn}
                    >
                      <Ionicons name="copy-outline" size={16} color={BRAND.navy} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Installation Steps */}
                <View style={styles.installGuideBox}>
                  <Text style={{ color: '#0F172A', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                    Quick Installation Guide:
                  </Text>
                  <Text style={styles.guideStep}>
                    1. <Text style={{ fontWeight: 'bold' }}>iPhone:</Text> Settings &gt; Cellular &gt; Add eSIM &gt; Use QR Code.
                  </Text>
                  <Text style={styles.guideStep}>
                    2. <Text style={{ fontWeight: 'bold' }}>Samsung / Android:</Text> Settings &gt; Connections &gt; SIM Manager &gt; Add Mobile Plan.
                  </Text>
                  <Text style={styles.guideStep}>
                    3. Turn on <Text style={{ fontWeight: 'bold' }}>Data Roaming</Text> once you arrive at your destination.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setActiveEsimModal(null)}
                  style={[styles.activateCtaButton, { marginTop: 16 }]}
                >
                  <View style={[styles.activateCtaGradient, { backgroundColor: '#0D1B3E', paddingVertical: 14 }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14 }}>Done</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TOP-UP MODAL                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {topupModalEsim && (
        <Modal visible={Boolean(topupModalEsim)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '85%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.modalTitle}>Recharge eSIM Data</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {topupModalEsim.country_name} • ICCID: {topupModalEsim.iccid ? topupModalEsim.iccid.substring(0, 12) + '...' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setTopupModalEsim(null)}>
                  <Ionicons name="close-circle" size={28} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {topupLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#0056D2" />
                  <Text style={{ color: '#64748B', marginTop: 12, fontSize: 13, textAlign: 'center' }}>
                    Fetching top-up bundles from PayVessel...
                  </Text>
                </View>
              ) : topupPackages.length === 0 ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={42} color="#D97706" />
                  <Text style={{ color: '#0F172A', fontWeight: 'bold', marginTop: 10, fontSize: 15 }}>
                    No Top-Up Bundles Found
                  </Text>
                  <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 6, fontSize: 12, paddingHorizontal: 16 }}>
                    This profile might not support online top-up or the operator is updating catalog.
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300, marginVertical: 6 }}>
                  <Text style={styles.sectionLabel}>SELECT RECHARGE PACKAGE</Text>
                  <View style={{ gap: 8 }}>
                    {topupPackages.map((pkg) => {
                      const isSelected = selectedTopupPackage?.package_code === pkg.package_code;
                      return (
                        <TouchableOpacity
                          key={pkg.package_code}
                          onPress={() => setSelectedTopupPackage(pkg)}
                          style={[
                            styles.packageCard,
                            isSelected && styles.packageCardSelected,
                            { padding: 12 }
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.packageDataAmount, { fontSize: 16 }]}>{pkg.data_amount}</Text>
                              <View style={[styles.dayBadge, { paddingHorizontal: 6, paddingVertical: 2 }]}>
                                <Text style={styles.dayBadgeText}>{pkg.validity_days} Days</Text>
                              </View>
                            </View>
                            <Text style={[styles.packageValidity, { fontSize: 11, marginTop: 2 }]} numberOfLines={1}>
                              {pkg.name}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.packagePriceNgn, { fontSize: 15 }]}>
                              ₦{pkg.price_ngn.toLocaleString()}
                            </Text>
                            <Text style={styles.packagePriceUsd}>${pkg.price_usd.toFixed(2)} USD</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {selectedTopupPackage && (
                <View style={[styles.confirmBreakdown, { marginTop: 10, marginBottom: 12 }]}>
                  <View style={[styles.confirmRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <Text style={[styles.confirmRowLabel, { color: '#0F172A', fontWeight: 'bold' }]}>Wallet Deduction</Text>
                    <Text style={[styles.confirmRowVal, { color: '#0056D2', fontSize: 17, fontWeight: '900' }]}>
                      ₦{selectedTopupPackage.price_ngn.toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setTopupModalEsim(null)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmTopup}
                  disabled={topupSubmitting || !selectedTopupPackage}
                  style={[styles.confirmPayBtn, (!selectedTopupPackage || topupSubmitting) && { opacity: 0.6 }]}
                >
                  {topupSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmPayBtnText}>Top-Up Now ⚡</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* In-App Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Modern Brand Alert Modal */}
      <BrandAlertModal
        visible={brandAlert.visible}
        title={brandAlert.title}
        message={brandAlert.message}
        type={brandAlert.type}
        buttonText={brandAlert.buttonText || 'OK'}
        onClose={() => {
          const cb = brandAlert.onConfirm;
          setBrandAlert(prev => ({ ...prev, visible: false }));
          if (cb) cb();
        }}
        showCancel={brandAlert.showCancel}
        cancelText={brandAlert.cancelText}
        onCancel={() => {
          const cb = brandAlert.onCancel;
          setBrandAlert(prev => ({ ...prev, visible: false }));
          if (cb) cb();
        }}
      />

      {/* STICKY BOTTOM CHECKOUT ACTION BAR */}
      {activeTab === 'buy' && selectedPackage && (
        <View style={[styles.stickyBottomBar, { paddingBottom: bottomBarPadding }]}>
          <View style={styles.stickyBottomInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stickySelectedLabel}>Selected Plan:</Text>
              <Text style={styles.stickySelectedVal} numberOfLines={1}>
                {selectedPackage.data_amount} • {selectedPackage.validity_days} Days
              </Text>
              <Text style={styles.stickyPriceVal}>
                ₦{selectedPackage.price_ngn.toLocaleString()}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handlePurchasePress}
              disabled={actionLoading}
              activeOpacity={0.8}
              style={styles.activateCtaButton}
            >
              <LinearGradient
                colors={[BRAND.navyDark, BRAND.navy, BRAND.goldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activateCtaGradient}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flash" size={17} color={BRAND.gold} />
                    <Text style={styles.activateCtaText}>Activate Now</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#070D1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  balanceIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balancePillLabel: {
    fontSize: 8.5,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  balancePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  balancePlusWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  guaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 14,
    gap: 10,
  },
  guaranteeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guaranteeTitle: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
  guaranteePill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  guaranteePillText: {
    color: '#047857',
    fontSize: 8.5,
    fontWeight: '900',
  },
  guaranteeSubtitle: {
    color: '#047857',
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },

  // ── Country Dropdown Button Styles ──
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  flagCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D1B3E',
  },
  dropdownSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  dropdownChevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // ── Destination Banner Card ──
  destinationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  destCardName: {
    color: '#0D1B3E',
    fontSize: 15,
    fontWeight: '900',
  },
  destCardSub: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeInstant: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 4,
  },
  badgeInstantText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '900',
  },

  // ── Packages ──
  packagesLoader: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  packagesLoaderText: {
    color: '#64748B',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  packageCardIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: 'transparent',
  },
  packageCardIndicatorActive: {
    backgroundColor: '#F5A623',
  },
  packageCardSelected: {
    borderColor: '#0D1B3E',
    backgroundColor: '#F8FAFC',
    shadowColor: '#0D1B3E',
    shadowOpacity: 0.09,
    shadowRadius: 6,
    elevation: 3,
  },
  dataIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataIconBoxSelected: {
    backgroundColor: '#0D1B3E',
  },
  packageDataAmount: {
    color: '#0D1B3E',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  packageValidity: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  packageNetworkName: {
    color: '#94A3B8',
    fontSize: 9.5,
    marginTop: 2,
  },
  operatorBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  packagePriceNgn: {
    color: '#0D1B3E',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  packagePriceUsd: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  radioCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  radioCircleSelected: {
    borderColor: '#0D1B3E',
  },
  radioInner: {
    width: 7.5,
    height: 7.5,
    borderRadius: 3.75,
    backgroundColor: '#0D1B3E',
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayBadgeSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  dayBadgeText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  countBadgeText: {
    fontSize: 11,
    color: '#0D1B3E',
    fontWeight: '800',
  },

  // ── Info Notice ──
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 17,
  },

  // ── STICKY BOTTOM CHECKOUT ACTION BAR ──
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 25,
    zIndex: 999,
  },
  stickyBottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stickySelectedLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  stickySelectedVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  stickyPriceVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1B3E',
    letterSpacing: -0.3,
  },
  activateCtaButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  activateCtaGradient: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyStateSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyEsims: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: 'bold',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionBtn: {
    backgroundColor: '#0D1B3E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },

  // ── My eSIM Cards ──
  myEsimCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  esimIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myEsimCountryName: {
    color: '#0D1B3E',
    fontSize: 15,
    fontWeight: '900',
  },
  myEsimRef: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  esimMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0D1B3E',
    marginTop: 2,
  },
  viewQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewQrBtnText: {
    color: '#0D1B3E',
    fontWeight: '800',
    fontSize: 12,
  },

  // ── Modals Common ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 62, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    color: '#0D1B3E',
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },

  // ── Dropdown Picker Modal ──
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginVertical: 8,
    gap: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0D1B3E',
    borderColor: '#0D1B3E',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  countryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  countryListItemActive: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  countryItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B3E',
  },
  countryItemCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // ── Confirmation Modal ──
  confirmIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBreakdown: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  confirmRowLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  confirmRowVal: {
    color: '#0D1B3E',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 13,
  },
  confirmPayBtn: {
    flex: 2,
    backgroundColor: '#0D1B3E',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmPayBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },

  // ── QR Code & Manual Codes ──
  qrCodeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shareSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 8,
  },
  shareSetupBtnText: {
    color: '#0D1B3E',
    fontWeight: '800',
    fontSize: 12,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  codeLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '800',
  },
  codeVal: {
    fontSize: 12,
    color: '#0D1B3E',
    fontWeight: 'bold',
    marginTop: 2,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  installGuideBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 10,
  },
  guideStep: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  // ── In-App Toast ──
  toastContainer: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: '#0D1B3E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#0D1B3E',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 25,
    zIndex: 999,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
