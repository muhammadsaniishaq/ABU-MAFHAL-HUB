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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import {
  payvesselEsimService,
  EsimRegion,
  EsimPackage,
  UserEsim,
} from '../../services/payvesselEsim';

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
    if (walletBalance < selectedPackage.price_ngn) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₦${selectedPackage.price_ngn.toLocaleString()} to purchase this eSIM, but your wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => router.push('/wallet') }
        ]
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
      Alert.alert('Activation Notice', e.message || 'Failed to complete eSIM order.');
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
      Alert.alert('Status Check', e.message ?? 'Could not check eSIM status.');
    } finally {
      setCheckingStatusRef(null);
    }
  };

  const handleOpenTopup = async (esim: UserEsim) => {
    if (!esim.iccid) {
      Alert.alert('Notice', 'This eSIM profile does not have an ICCID yet or is still provisioning. Please check status first.');
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
      Alert.alert(
        'Insufficient Balance',
        `You need ₦${selectedTopupPackage.price_ngn.toLocaleString()} to top up this eSIM, but your wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => { setTopupModalEsim(null); router.push('/wallet'); } }
        ]
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
      Alert.alert('Top-Up Notice', e.message || 'Failed to complete eSIM top-up.');
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Global eSIM Roaming</Text>
          <Text style={styles.headerSubtitle}>PayVessel High-Speed Travel Data 🌐</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/wallet')}
          style={styles.walletBadge}
        >
          <Ionicons name="wallet-outline" size={15} color="#0056D2" />
          <Text style={styles.walletBadgeText}>₦{walletBalance.toLocaleString()}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('buy')}
          style={[styles.tabButton, activeTab === 'buy' && styles.activeTabButton]}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={activeTab === 'buy' ? '#FFFFFF' : '#64748B'}
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
        >
          <Ionicons
            name="cellular-outline"
            size={16}
            color={activeTab === 'my_esims' ? '#FFFFFF' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'my_esims' && styles.activeTabText]}>
            My eSIMs ({myEsims.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#0056D2" />
          <Text style={styles.loaderText}>Connecting to Global eSIM Gateway...</Text>
        </View>
      ) : activeTab === 'buy' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0056D2']} />
          }
        >

          {/* DESTINATION DROPDOWN SELECTOR */}
          <Text style={styles.sectionLabel}>SELECT DESTINATION COUNTRY</Text>
          
          <TouchableOpacity
            activeOpacity={0.7}
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
                    ? `${selectedRegion.code} • Tap to change country (${regions.length} available)`
                    : 'Tap to choose from 240+ global destinations'}
                </Text>
              </View>
            </View>
            <View style={styles.dropdownChevronBox}>
              <Ionicons name="chevron-down" size={18} color="#0056D2" />
            </View>
          </TouchableOpacity>

          {/* Selected Destination Banner Card */}
          {selectedRegion && (
            <View style={styles.destinationCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 32 }}>{selectedRegion.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.destCardName}>
                      {selectedRegion.name}
                    </Text>
                    <Text style={styles.destCardSub}>
                      4G & 5G High-Speed Roaming
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeInstant}>
                  <Ionicons name="flash" size={11} color="#15803D" />
                  <Text style={styles.badgeInstantText}>INSTANT</Text>
                </View>
              </View>
            </View>
          )}

          {/* Packages List */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
            <Text style={styles.sectionLabel}>AVAILABLE DATA PLANS</Text>
            {packages.length > 0 && (
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                {packages.length} bundles available
              </Text>
            )}
          </View>

          {packagesLoading ? (
            <View style={styles.packagesLoader}>
              <ActivityIndicator color="#0056D2" size="small" />
              <Text style={styles.packagesLoaderText}>Loading packages for {selectedRegion?.name}...</Text>
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
                    onPress={() => setSelectedPackage(pkg)}
                    style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[styles.dataIconBox, isSelected && styles.dataIconBoxSelected]}>
                        <Ionicons
                          name="cellular"
                          size={18}
                          color={isSelected ? '#FFFFFF' : '#0056D2'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.packageDataAmount}>{pkg.data_amount}</Text>
                          <View style={styles.dayBadge}>
                            <Text style={styles.dayBadgeText}>{pkg.validity_days} Days</Text>
                          </View>
                        </View>
                        {operators ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <Ionicons name="radio" size={11} color="#059669" />
                            <Text style={styles.operatorBadgeText} numberOfLines={1}>
                              {operators}
                            </Text>
                          </View>
                        ) : pkg.name ? (
                          <Text style={styles.packageNetworkName} numberOfLines={1}>{pkg.name}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                      <Text style={[styles.packagePriceNgn, isSelected && { color: '#0056D2' }]}>
                        ₦{pkg.price_ngn.toLocaleString()}
                      </Text>
                      <Text style={styles.packagePriceUsd}>${pkg.price_usd.toFixed(2)} USD</Text>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Info Notice */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#0056D2" />
            <Text style={styles.infoBannerText}>
              Compatible with all unlocked eSIM smartphones (iPhone XS & above, Samsung Galaxy S20+, Google Pixel 3+). QR code & manual codes are generated instantly upon order.
            </Text>
          </View>

          {/* Checkout Button */}
          {selectedPackage && (
            <TouchableOpacity
              onPress={handlePurchasePress}
              disabled={actionLoading}
              activeOpacity={0.85}
              style={styles.checkoutButton}
            >
              <LinearGradient
                colors={['#0056D2', '#0040A8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkoutGradient}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color="#FFFFFF" />
                    <Text style={styles.checkoutText}>
                      Activate {selectedPackage.data_amount} — ₦{selectedPackage.price_ngn.toLocaleString()}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        /* MY ESIMS TAB */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0056D2']} />
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
                      <Text style={[styles.countryItemName, isCurrent && { color: '#0056D2', fontWeight: '900' }]}>
                        {item.name}
                      </Text>
                      <Text style={styles.countryItemCode}>
                        {item.code} {item.popular ? '• Popular Travel Destination' : ''}
                      </Text>
                    </View>
                    {isCurrent && (
                      <Ionicons name="checkmark-circle" size={22} color="#0056D2" />
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
              <View style={styles.confirmIconRing}>
                <Ionicons name="cellular" size={28} color="#0056D2" />
              </View>
              <Text style={styles.modalTitle}>Confirm eSIM Purchase</Text>
              <Text style={styles.modalSubtitle}>Instant Roaming Data Activation</Text>
            </View>

            <View style={styles.confirmBreakdown}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Destination</Text>
                <Text style={styles.confirmRowVal}>{selectedRegion?.name}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Data Volume</Text>
                <Text style={styles.confirmRowVal}>{selectedPackage?.data_amount}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Validity Period</Text>
                <Text style={styles.confirmRowVal}>{selectedPackage?.validity_days} Days</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                <Text style={[styles.confirmRowLabel, { color: '#0F172A', fontWeight: 'bold' }]}>Wallet Deduction</Text>
                <Text style={[styles.confirmRowVal, { color: '#0056D2', fontSize: 18, fontWeight: '900' }]}>
                  ₦{selectedPackage?.price_ngn.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setShowConfirmModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmOrder}
                disabled={actionLoading}
                style={styles.confirmPayBtn}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmPayBtnText}>Pay & Activate ⚡</Text>
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
                      <Ionicons name="qr-code" size={90} color="#0056D2" />
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
                >
                  <Ionicons name="share-social-outline" size={16} color="#0056D2" />
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
                    <Ionicons name="copy-outline" size={16} color="#0056D2" />
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
                    <Ionicons name="copy-outline" size={16} color="#0056D2" />
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
                      <Ionicons name="copy-outline" size={16} color="#0056D2" />
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
                  style={[styles.checkoutButton, { marginTop: 16 }]}
                >
                  <View style={[styles.checkoutGradient, { backgroundColor: '#0056D2' }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Done</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 5,
  },
  walletBadgeText: {
    color: '#0056D2',
    fontWeight: '900',
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: '#0056D2',
    shadowColor: '#0056D2',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // ── Country Dropdown Button Styles ──
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000000',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
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
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 4,
  },
  destCardName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  destCardSub: {
    color: '#0056D2',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  packageCardSelected: {
    borderColor: '#0056D2',
    backgroundColor: '#EFF6FF',
  },
  dataIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataIconBoxSelected: {
    backgroundColor: '#0056D2',
  },
  packageDataAmount: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
  packageValidity: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 1,
  },
  packageNetworkName: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  operatorBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  packagePriceNgn: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
  packagePriceUsd: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  radioCircleSelected: {
    borderColor: '#0056D2',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0056D2',
  },
  dayBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dayBadgeText: {
    color: '#0056D2',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Info Notice ──
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Checkout Button ──
  checkoutButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0056D2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    gap: 8,
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
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
    backgroundColor: '#0056D2',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  esimIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myEsimCountryName: {
    color: '#0F172A',
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
    color: '#0F172A',
    marginTop: 2,
  },
  viewQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewQrBtnText: {
    color: '#0056D2',
    fontWeight: '800',
    fontSize: 12,
  },

  // ── Modals Common ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    color: '#0F172A',
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
    backgroundColor: '#0056D2',
    borderColor: '#0056D2',
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
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
  },
  countryItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
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
    backgroundColor: '#EFF6FF',
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
    color: '#0F172A',
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
    backgroundColor: '#0056D2',
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 8,
  },
  shareSetupBtnText: {
    color: '#0056D2',
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
    color: '#0F172A',
    fontWeight: 'bold',
    marginTop: 2,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
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
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#0056D2',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#0056D2',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
