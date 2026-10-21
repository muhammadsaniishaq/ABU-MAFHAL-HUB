import React, { useState, useEffect } from 'react';
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

// Status color helper
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE:   { bg: 'rgba(34,197,94,0.18)',  border: '#22c55e', text: '#4ade80' },
  PENDING:  { bg: 'rgba(245,166,35,0.18)', border: '#f5a623', text: '#fbbf24' },
  EXPIRED:  { bg: 'rgba(100,116,139,0.2)', border: '#64748b', text: '#94a3b8' },
  DEPLETED: { bg: 'rgba(100,116,139,0.2)', border: '#64748b', text: '#94a3b8' },
  FAILED:   { bg: 'rgba(239,68,68,0.18)',  border: '#ef4444', text: '#f87171' },
};

const { width: W } = Dimensions.get('window');

export default function EsimScreen() {
  const router = useRouter();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'buy' | 'my_esims'>('buy');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Data States
  const [regions, setRegions] = useState<EsimRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<EsimRegion | null>(null);
  const [packages, setPackages] = useState<EsimPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<EsimPackage | null>(null);
  const [myEsims, setMyEsims] = useState<UserEsim[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');

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

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // 1. Fetch user wallet balance
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();
        if (profile) setWalletBalance(Number(profile.balance) || 0);
      }

      // 2. Fetch Regions
      const { regions: fetchedRegions } = await payvesselEsimService.getRegions();
      setRegions(fetchedRegions);

      // Default to Saudi Arabia if available, else first region
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
    loadPackagesForRegion(region.code);
  };

  const handlePurchasePress = () => {
    if (!selectedPackage || !selectedRegion) return;
    if (walletBalance < selectedPackage.price_ngn) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₦${selectedPackage.price_ngn.toLocaleString()} to purchase this eSIM, but your wallet balance is ₦${walletBalance.toLocaleString()}. Please top up your wallet.`,
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

      // Update local wallet balance
      setWalletBalance(prev => Math.max(0, prev - selectedPackage.price_ngn));

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
        // Fallback: load standard packages for this eSIM country
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

      // Update local wallet balance
      setWalletBalance(prev => Math.max(0, prev - selectedTopupPackage.price_ngn));
      setTopupModalEsim(null);
      showToast('eSIM Top-Up Successful! 📶⚡');

      // Refresh status in background
      handleCheckStatus(topupModalEsim);
    } catch (e: any) {
      Alert.alert('Top-Up Notice', e.message || 'Failed to complete eSIM top-up.');
    } finally {
      setTopupSubmitting(false);
    }
  };

  const filteredRegions = regions.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Global eSIM Roaming</Text>
          <Text style={styles.headerSubtitle}>PayVessel High-Speed Travel Data 🌐</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/wallet')}
          style={styles.walletBadge}
        >
          <Ionicons name="wallet-outline" size={14} color="#f5a623" />
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
            color={activeTab === 'buy' ? '#0f172a' : '#94a3b8'}
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
            color={activeTab === 'my_esims' ? '#0f172a' : '#94a3b8'}
          />
          <Text style={[styles.tabText, activeTab === 'my_esims' && styles.activeTabText]}>
            My eSIMs ({myEsims.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={styles.loaderText}>Connecting to Global eSIM Gateway...</Text>
        </View>
      ) : activeTab === 'buy' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Quick Country Pills */}
          <Text style={styles.sectionLabel}>POPULAR DESTINATIONS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {regions.filter(r => r.popular).map((r) => {
                const isSelected = selectedRegion?.code === r.code;
                return (
                  <TouchableOpacity
                    key={r.code}
                    onPress={() => handleSelectRegion(r)}
                    style={[styles.popularPill, isSelected && styles.popularPillActive]}
                  >
                    <Text style={{ fontSize: 18 }}>{r.flag}</Text>
                    <Text style={[styles.popularPillText, isSelected && styles.popularPillTextActive]}>
                      {r.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search 150+ countries (e.g. Saudi, UK, USA)..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* If searching, show country search list */}
          {searchQuery.length > 0 && (
            <View style={styles.searchDropdown}>
              {filteredRegions.length === 0 ? (
                <Text style={{ color: '#94a3b8', padding: 12, textAlign: 'center' }}>No countries found</Text>
              ) : (
                filteredRegions.slice(0, 6).map((reg) => (
                  <TouchableOpacity
                    key={reg.code}
                    onPress={() => {
                      handleSelectRegion(reg);
                      setSearchQuery('');
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={{ fontSize: 20, marginRight: 10 }}>{reg.flag}</Text>
                    <Text style={{ color: '#ffffff', fontWeight: 'bold', flex: 1 }}>{reg.name}</Text>
                    <Text style={{ color: '#f5a623', fontSize: 11, fontWeight: '700' }}>{reg.code}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Selected Region Hero Banner */}
          {selectedRegion && (
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.regionHero}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 34 }}>{selectedRegion.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>
                      {selectedRegion.name}
                    </Text>
                    <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                      4G / 5G Roaming Available
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeInstant}>
                  <Ionicons name="flash" size={12} color="#22c55e" />
                  <Text style={styles.badgeInstantText}>INSTANT</Text>
                </View>
              </View>
            </LinearGradient>
          )}

          {/* Packages List */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>SELECT DATA PLAN</Text>
          {packagesLoading ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <ActivityIndicator color="#f5a623" />
              <Text style={{ color: '#94a3b8', marginTop: 10, fontSize: 12 }}>Fetching live packages...</Text>
            </View>
          ) : packages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={36} color="#64748b" />
              <Text style={{ color: '#94a3b8', marginTop: 8 }}>No packages found for this destination</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {packages.map((pkg) => {
                const isSelected = selectedPackage?.package_code === pkg.package_code;
                return (
                  <TouchableOpacity
                    key={pkg.package_code}
                    onPress={() => setSelectedPackage(pkg)}
                    style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.dataIconBox, isSelected && styles.dataIconBoxSelected]}>
                        <Ionicons
                          name="cellular"
                          size={20}
                          color={isSelected ? '#0f172a' : '#38bdf8'}
                        />
                      </View>
                      <View>
                        <Text style={styles.packageDataAmount}>{pkg.data_amount}</Text>
                        <Text style={styles.packageValidity}>Valid for {pkg.validity_days} Days</Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.packagePriceNgn}>₦{pkg.price_ngn.toLocaleString()}</Text>
                      <Text style={styles.packagePriceUsd}>${pkg.price_usd.toFixed(2)} USD</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Information / Instructions Notice */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#f5a623" />
            <Text style={styles.infoBannerText}>
              eSIM works with all unlocked iPhone models (XR & above) and eSIM-supported Android devices (Samsung S20+, Google Pixel 3+). QR code is issued immediately upon payment.
            </Text>
          </View>

          {/* Checkout Button */}
          {selectedPackage && (
            <TouchableOpacity
              onPress={handlePurchasePress}
              disabled={actionLoading}
              style={styles.checkoutButton}
            >
              <LinearGradient
                colors={['#f5a623', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkoutGradient}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color="#0f172a" />
                    <Text style={styles.checkoutText}>
                      Activate {selectedPackage.data_amount} for ₦{selectedPackage.price_ngn.toLocaleString()}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        /* MY ESIMS TAB */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {myEsims.length === 0 ? (
            <View style={styles.emptyEsims}>
              <Ionicons name="qr-code-outline" size={60} color="#334155" />
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 14 }}>
                No Active eSIMs Found
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 30 }}>
                You have not purchased any global eSIM yet. Select a destination to get high-speed roaming data today.
              </Text>
              <TouchableOpacity
                onPress={() => setActiveTab('buy')}
                style={styles.emptyActionBtn}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13 }}>Browse Destinations ✈️</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {myEsims.map((esim) => (
                <View key={esim.id || esim.order_reference} style={styles.myEsimCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={styles.esimIconBox}>
                        <Ionicons name="globe" size={20} color="#f5a623" />
                      </View>
                      <View>
                        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '900' }}>
                          {esim.country_name}
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
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
                    <View>
                      <Text style={styles.metaLabel}>DATA PACKAGE</Text>
                      <Text style={styles.metaVal}>{esim.data_amount}</Text>
                    </View>
                    <View>
                      <Text style={styles.metaLabel}>VALIDITY</Text>
                      <Text style={styles.metaVal}>{esim.validity_days} Days</Text>
                    </View>
                    <View>
                      <Text style={styles.metaLabel}>ICCID</Text>
                      <Text style={styles.metaVal}>{esim.iccid ? esim.iccid.substring(0, 10) + '...' : 'Provisioned'}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setActiveEsimModal(esim)}
                      style={[styles.viewQrBtn, { flex: 2 }]}
                    >
                      <Ionicons name="qr-code" size={16} color="#0ea5e9" />
                      <Text style={styles.viewQrBtnText}>QR Code & Guide</Text>
                    </TouchableOpacity>

                    {esim.iccid ? (
                      <TouchableOpacity
                        onPress={() => handleOpenTopup(esim)}
                        style={[styles.viewQrBtn, { flex: 1.5, borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.12)' }]}
                      >
                        <Ionicons name="flash" size={13} color="#f5a623" />
                        <Text style={[styles.viewQrBtnText, { color: '#f5a623', fontSize: 11 }]}>Top Up</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => handleCheckStatus(esim)}
                      disabled={checkingStatusRef === esim.order_reference}
                      style={[styles.viewQrBtn, { flex: 1, borderColor: '#334155', backgroundColor: 'rgba(51,65,85,0.3)' }]}
                    >
                      {checkingStatusRef === esim.order_reference ? (
                        <ActivityIndicator size={14} color="#94a3b8" />
                      ) : (
                        <Ionicons name="refresh-outline" size={14} color="#94a3b8" />
                      )}
                      <Text style={[styles.viewQrBtnText, { color: '#94a3b8', fontSize: 11 }]}>Status</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* CONFIRMATION PURCHASE MODAL */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={styles.confirmIconRing}>
                <Ionicons name="cellular" size={28} color="#f5a623" />
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
                <Text style={[styles.confirmRowLabel, { color: '#ffffff', fontWeight: 'bold' }]}>Total Cost</Text>
                <Text style={[styles.confirmRowVal, { color: '#f5a623', fontSize: 18, fontWeight: '900' }]}>
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
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.confirmPayBtnText}>Pay & Activate ⚡</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ACTIVE ESIM DETAILS & QR CODE MODAL */}
      {activeEsimModal && (
        <Modal visible={Boolean(activeEsimModal)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 24 }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <View>
                    <Text style={styles.modalTitle}>{activeEsimModal.country_name} eSIM</Text>
                    <Text style={styles.modalSubtitle}>{activeEsimModal.data_amount} - {activeEsimModal.validity_days} Days</Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveEsimModal(null)}>
                    <Ionicons name="close-circle" size={28} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* QR Code Container */}
                <View style={styles.qrCodeBox}>
                  {activeEsimModal.qr_code_url ? (
                    <Image
                      source={{ uri: activeEsimModal.qr_code_url }}
                      style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: '#ffffff' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={{ width: 220, height: 220, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="qr-code" size={100} color="#0f172a" />
                      <Text style={{ color: '#0f172a', fontWeight: 'bold', marginTop: 10 }}>Scan to Activate</Text>
                    </View>
                  )}
                  <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '800', marginTop: 8 }}>
                    Scan with iPhone / Android Camera
                  </Text>
                </View>

                {/* Manual Setup Details */}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>MANUAL SETUP CODES</Text>

                <View style={styles.codeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>SM-DP+ ADDRESS</Text>
                    <Text style={styles.codeVal}>{activeEsimModal.smdp_address || 'rsp.truphone.com'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(activeEsimModal.smdp_address || 'rsp.truphone.com', 'SM-DP+ Address')}
                    style={styles.copyBtn}
                  >
                    <Ionicons name="copy-outline" size={16} color="#38bdf8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.codeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>ACTIVATION CODE</Text>
                    <Text style={styles.codeVal}>{activeEsimModal.activation_code || activeEsimModal.iccid || 'AUTO-PROVISIONED'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(activeEsimModal.activation_code || activeEsimModal.iccid || '', 'Activation Code')}
                    style={styles.copyBtn}
                  >
                    <Ionicons name="copy-outline" size={16} color="#38bdf8" />
                  </TouchableOpacity>
                </View>

                {activeEsimModal.lpa_activation_code && (
                  <View style={styles.codeItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeLabel}>FULL LPA STRING</Text>
                      <Text style={styles.codeVal} numberOfLines={1}>{activeEsimModal.lpa_activation_code}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(activeEsimModal.lpa_activation_code || '', 'LPA String')}
                      style={styles.copyBtn}
                    >
                      <Ionicons name="copy-outline" size={16} color="#38bdf8" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Installation Steps */}
                <View style={styles.installGuideBox}>
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>
                    📱 Quick Installation Steps:
                  </Text>
                  <Text style={styles.guideStep}>
                    1. <Text style={{ fontWeight: 'bold' }}>iPhone:</Text> Settings &gt; Cellular / Mobile Data &gt; Add eSIM &gt; Use QR Code.
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
                  <View style={[styles.checkoutGradient, { backgroundColor: '#334155' }]}>
                    <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Done</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* TOP-UP MODAL */}
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
                  <Ionicons name="close-circle" size={28} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {topupLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#f5a623" />
                  <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 13, textAlign: 'center' }}>
                    Fetching top-up bundles from PayVessel...
                  </Text>
                </View>
              ) : topupPackages.length === 0 ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={42} color="#f5a623" />
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', marginTop: 10, fontSize: 15 }}>
                    No Top-Up Bundles Found
                  </Text>
                  <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 6, fontSize: 12, paddingHorizontal: 16 }}>
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
                              <Text style={[styles.packageData, { fontSize: 16 }]}>{pkg.data_amount}</Text>
                              <View style={[styles.dayBadge, { paddingHorizontal: 6, paddingVertical: 2 }]}>
                                <Text style={styles.dayBadgeText}>{pkg.validity_days} Days</Text>
                              </View>
                            </View>
                            <Text style={[styles.packageName, { fontSize: 11, marginTop: 2 }]} numberOfLines={1}>
                              {pkg.name}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.packageNgn, { fontSize: 15 }]}>
                              ₦{pkg.price_ngn.toLocaleString()}
                            </Text>
                            <Text style={styles.packageUsd}>${pkg.price_usd.toFixed(2)} USD</Text>
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
                    <Text style={[styles.confirmRowLabel, { color: '#ffffff', fontWeight: 'bold' }]}>Wallet Deduction</Text>
                    <Text style={[styles.confirmRowVal, { color: '#f5a623', fontSize: 17, fontWeight: '900' }]}>
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
                    <ActivityIndicator color="#0f172a" />
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
    backgroundColor: '#0b0f19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 5,
  },
  walletBadgeText: {
    color: '#f5a623',
    fontWeight: '900',
    fontSize: 11,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: '#f5a623',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#0f172a',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 8,
  },
  popularPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  popularPillActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#38bdf8',
  },
  popularPillText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 12,
  },
  popularPillTextActive: {
    color: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#ffffff',
    fontSize: 13,
  },
  searchDropdown: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  regionHero: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  badgeInstant: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
    gap: 4,
  },
  badgeInstantText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '900',
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  packageCardSelected: {
    borderColor: '#f5a623',
    backgroundColor: '#1e293b',
  },
  dataIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataIconBoxSelected: {
    backgroundColor: '#f5a623',
  },
  packageDataAmount: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  packageValidity: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  packagePriceNgn: {
    color: '#f5a623',
    fontSize: 16,
    fontWeight: '900',
  },
  packagePriceUsd: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginTop: 20,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  checkoutButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
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
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyEsims: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyActionBtn: {
    backgroundColor: '#f5a623',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  myEsimCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  esimIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  statusBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '900',
  },
  esimMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0b0f19',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 2,
  },
  viewQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewQrBtnText: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  confirmIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  confirmBreakdown: {
    backgroundColor: '#0b0f19',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  confirmRowLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  confirmRowVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 13,
  },
  confirmPayBtn: {
    flex: 2,
    backgroundColor: '#f5a623',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmPayBtnText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 13,
  },
  qrCodeBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  codeLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
  },
  codeVal: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
    marginTop: 2,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  installGuideBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  guideStep: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#f5a623',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 12,
  },
});
