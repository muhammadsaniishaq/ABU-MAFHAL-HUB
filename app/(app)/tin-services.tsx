import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { supabase } from '../../services/supabase';
import { verificationHistory } from '../../services/verificationHistory';
import { NIGERIA_STATES } from '../../utils/nigeriaStates';

const STATE_LIST = Object.keys(NIGERIA_STATES);

// Executive Palette
const COLORS = {
  navyDark: '#070f26',
  navy: '#0d1b3e',
  navyCard: '#132347',
  navySoft: '#1e2d60',
  gold: '#d97706',
  goldBright: '#f59e0b',
  goldLight: '#fef3c7',
  goldBg: '#fffbeb',
  goldBorder: '#fde68a',
  white: '#ffffff',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#0f172a',
  subText: '#64748b',
  mutedText: '#94a3b8',
  border: '#e2e8f0',
  borderFocus: '#059669',
  success: '#10b981',
  successBg: '#dcfce7',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  info: '#2563eb',
  infoBg: '#eff6ff',
  emerald: '#059669',
  emeraldDark: '#047857',
  emeraldLight: '#ecfdf5',
  emeraldBorder: '#a7f3d0',
};

// Business Organization Categories for Corporate TIN
const ORG_TYPES = [
  'Private Limited Liability Company (LTD)',
  'Business Name (Sole Proprietorship / Enterprise)',
  'Incorporated Trustee (NGO / Church / Mosque / Club)',
  'Public Limited Company (PLC)',
  'Partnership',
  'Company Limited by Guarantee (LTD/GTE)',
];

export default function TinServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Primary Navigation: Services vs History
  const [activeMainTab, setActiveMainTab] = useState<'services' | 'history'>('services');

  // Unified Entity Category: Individual vs Business / Corporate
  const [entityCategory, setEntityCategory] = useState<'individual' | 'business'>('individual');

  // Service Action Type: New Registration vs Certificate Retrieval
  const [serviceAction, setServiceAction] = useState<'register' | 'retrieve'>('register');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Dynamic Prices from database (differentiated by Individual vs Business)
  const [individualPrice, setIndividualPrice] = useState<number>(1500);
  const [businessPrice, setBusinessPrice] = useState<number>(3000);

  // Active Fee based on current entity category
  const activeServiceFee = entityCategory === 'individual' ? individualPrice : businessPrice;

  // -------------------------------------------------------------
  // INDIVIDUAL FORM FIELDS
  // -------------------------------------------------------------
  const [indivFullName, setIndivFullName] = useState('');
  const [indivNin, setIndivNin] = useState('');
  const [indivDob, setIndivDob] = useState('');
  const [indivGender, setIndivGender] = useState<'Male' | 'Female'>('Male');
  const [indivState, setIndivState] = useState('');
  const [indivLga, setIndivLga] = useState('');
  const [indivAddress, setIndivAddress] = useState('');
  const [indivTaxId, setIndivTaxId] = useState(''); // Used for retrieval
  const [indivPhone, setIndivPhone] = useState('');
  const [indivEmail, setIndivEmail] = useState('');

  // -------------------------------------------------------------
  // BUSINESS / CORPORATE FORM FIELDS
  // -------------------------------------------------------------
  const [bizName, setBizName] = useState('');
  const [bizCacNumber, setBizCacNumber] = useState('');
  const [bizIncorpDate, setBizIncorpDate] = useState('');
  const [bizOrgType, setBizOrgType] = useState(ORG_TYPES[0]);
  const [bizAddress, setBizAddress] = useState('');
  const [bizDirectorName, setBizDirectorName] = useState('');
  const [bizDirectorNin, setBizDirectorNin] = useState('');
  const [bizTaxId, setBizTaxId] = useState(''); // Used for retrieval
  const [bizPhone, setBizPhone] = useState('');
  const [bizEmail, setBizEmail] = useState('');

  // -------------------------------------------------------------
  // MODALS & SELECTION STATES
  // -------------------------------------------------------------
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showLgaModal, setShowLgaModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [lgaSearchQuery, setLgaSearchQuery] = useState('');

  // Confirmation & Result Modals
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    category: 'individual' | 'business';
    action: 'register' | 'retrieve';
    title: string;
    applicantName: string;
    referenceNumber: string;
    fee: number;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successData, setSuccessData] = useState<{
    holderName: string;
    ref: string;
    fee: number;
    title: string;
  } | null>(null);

  const [insufficientModalVisible, setInsufficientModalVisible] = useState(false);

  // -------------------------------------------------------------
  // HISTORY & REQUESTS
  // -------------------------------------------------------------
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Filtered States
  const filteredStateList = useMemo(() => {
    if (!stateSearchQuery.trim()) return STATE_LIST;
    const q = stateSearchQuery.toLowerCase().trim();
    return STATE_LIST.filter((s: string) => s.toLowerCase().includes(q));
  }, [stateSearchQuery]);

  // Available LGAs for selected State
  const availableLgas = useMemo(() => {
    if (!indivState) return [];
    return NIGERIA_STATES[indivState] || [];
  }, [indivState]);

  const filteredLgaList = useMemo(() => {
    if (!lgaSearchQuery.trim()) return availableLgas;
    const q = lgaSearchQuery.toLowerCase().trim();
    return availableLgas.filter((l: string) => l.toLowerCase().includes(q));
  }, [availableLgas, lgaSearchQuery]);

  // History filtering
  const filteredHistory = useMemo(() => {
    return historyList.filter(item => {
      const details = item.details || {};
      const status = (details.status || item.status || 'PENDING').toUpperCase();

      if (historyFilter === 'pending' && !(status === 'PENDING' || status === 'PROCESSING')) {
        return false;
      }
      if (historyFilter === 'completed' && status !== 'COMPLETED' && status !== 'SUCCESS') {
        return false;
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const holder = (item.holder_name || details.holderName || details.applicantName || '').toLowerCase();
        const ref = (item.search_number || '').toLowerCase();
        const tin = (details.generated_tin || details.retrieved_tin || details.taxId || '').toLowerCase();
        return holder.includes(q) || ref.includes(q) || tin.includes(q);
      }

      return true;
    });
  }, [historyList, historyFilter, historySearch]);

  // Bottom padding clearance calculation to guarantee elements NEVER hide behind bottom bars
  // Elevates content so inputs and action buttons sit comfortably above the navigation bar
  const bottomClearance = Math.max(insets.bottom, 24) + 140;

  // Load user profile, pricing, and history
  useEffect(() => {
    fetchUserData();
    fetchPricing();
    fetchHistory();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setUserProfile(profile);
        setWalletBalance(Number(profile.balance || 0));
        if (profile.phone) {
          if (!indivPhone) setIndivPhone(profile.phone);
          if (!bizPhone) setBizPhone(profile.phone);
        }
        if (profile.email) {
          if (!indivEmail) setIndivEmail(profile.email);
          if (!bizEmail) setBizEmail(profile.email);
        }
        if (profile.full_name) {
          if (!indivFullName) setIndivFullName(profile.full_name);
          if (!bizDirectorName) setBizDirectorName(profile.full_name);
        }
      }
    } catch (err) {
      console.warn('Error fetching user data:', err);
    }
  };

  const fetchPricing = async () => {
    try {
      // 1. Read from app_settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'tin_pricing_controls',
          'price_tin_individual',
          'price_tin_business',
          'price_tin_certificate',
          'price_tin_registration'
        ]);

      let found = false;
      if (settingsData && settingsData.length > 0) {
        settingsData.forEach(item => {
          if (item.key === 'tin_pricing_controls' && item.value) {
            try {
              const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
              if (parsed?.individual_tin?.selling_price) {
                setIndividualPrice(Number(parsed.individual_tin.selling_price));
                found = true;
              } else if (parsed?.tin_certificate?.selling_price) {
                setIndividualPrice(Number(parsed.tin_certificate.selling_price));
                found = true;
              }

              if (parsed?.business_tin?.selling_price) {
                setBusinessPrice(Number(parsed.business_tin.selling_price));
                found = true;
              } else if (parsed?.tin_registration?.selling_price) {
                setBusinessPrice(Number(parsed.tin_registration.selling_price));
                found = true;
              }
            } catch (_) {}
          }
          if (item.key === 'price_tin_individual' && item.value) {
            const p = parseFloat(item.value);
            if (!isNaN(p) && p > 0) {
              setIndividualPrice(p);
              found = true;
            }
          }
          if (item.key === 'price_tin_business' && item.value) {
            const p = parseFloat(item.value);
            if (!isNaN(p) && p > 0) {
              setBusinessPrice(p);
              found = true;
            }
          }
        });
      }

      // 2. Fallback to service_pricing table if needed
      if (!found) {
        const { data: spRows } = await supabase
          .from('service_pricing')
          .select('id, cost_price, markup_price')
          .in('id', ['individual_tin', 'business_tin', 'tin_certificate', 'tin_registration']);

        if (spRows && spRows.length > 0) {
          spRows.forEach((r: any) => {
            const total = Number(r.cost_price || 0) + Number(r.markup_price || 0);
            if ((r.id === 'individual_tin' || r.id === 'tin_certificate') && total > 0) {
              setIndividualPrice(total);
            }
            if ((r.id === 'business_tin' || r.id === 'tin_registration') && total > 0) {
              setBusinessPrice(total);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error reading TIN pricing:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      setRefreshing(true);
      const items = await verificationHistory.getAll('tin');
      setHistoryList(items || []);
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchUserData();
    fetchPricing();
    fetchHistory();
  }, []);

  // Format Date of Birth automatically with slashes DD/MM/YYYY
  const handleDateChange = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 2) {
      setter(cleaned);
    } else if (cleaned.length <= 4) {
      setter(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setter(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`);
    }
  };

  // -------------------------------------------------------------
  // VALIDATION & SUBMISSION HANDLER
  // -------------------------------------------------------------
  const handleSubmit = () => {
    const currentFee = activeServiceFee;

    // Check wallet balance
    if (walletBalance !== null && walletBalance < currentFee) {
      setInsufficientModalVisible(true);
      return;
    }

    if (entityCategory === 'individual') {
      // Individual Validations
      if (serviceAction === 'register') {
        if (!indivFullName.trim()) return Alert.alert('Required Field', 'Please enter your Full Name as registered on your NIN.');
        const cleanNin = indivNin.replace(/\D/g, '');
        if (cleanNin.length !== 11) return Alert.alert('Invalid NIN', 'Please enter a valid 11-digit National Identity Number (NIN).');
        if (indivDob.length < 10) return Alert.alert('Date of Birth Required', 'Please enter Date of Birth in DD/MM/YYYY format.');
        if (!indivState) return Alert.alert('State Required', 'Please select your State of Origin.');
        if (!indivAddress.trim()) return Alert.alert('Address Required', 'Please enter your current residential address.');
        const cleanPhone = indivPhone.replace(/\D/g, '');
        if (cleanPhone.length < 11) return Alert.alert('Phone Number Required', 'Please enter an 11-digit WhatsApp or mobile phone number.');
      } else {
        // Individual Retrieve
        if (!indivFullName.trim()) return Alert.alert('Required Field', 'Please enter your Registered Full Name.');
        if (!indivNin.trim() && !indivTaxId.trim()) {
          return Alert.alert('Search Identifier Required', 'Please enter either your 11-digit NIN or existing Tax ID / TIN Number.');
        }
        if (indivDob.length < 10) return Alert.alert('Date of Birth Required', 'Please enter Date of Birth in DD/MM/YYYY format.');
        const cleanPhone = indivPhone.replace(/\D/g, '');
        if (cleanPhone.length < 11) return Alert.alert('Phone Number Required', 'Please enter an 11-digit WhatsApp or mobile phone number.');
      }
    } else {
      // Business Validations
      if (serviceAction === 'register') {
        if (!bizName.trim()) return Alert.alert('Required Field', 'Please enter the Registered Business Name as approved on CAC Certificate.');
        if (!bizCacNumber.trim()) return Alert.alert('Required Field', 'Please enter the CAC Registration Number (e.g. RC123456 or BN654321).');
        if (bizIncorpDate.length < 10) return Alert.alert('Date Required', 'Please enter the Date of Incorporation (DD/MM/YYYY).');
        if (!bizAddress.trim()) return Alert.alert('Address Required', 'Please enter the official Business Operating Address.');
        if (!bizDirectorName.trim()) return Alert.alert('Director Name Required', 'Please enter the Full Name of Director or Authorized Owner.');
        const cleanDirNin = bizDirectorNin.replace(/\D/g, '');
        if (cleanDirNin.length !== 11) return Alert.alert('Director NIN Required', 'Please enter the 11-digit NIN of the Director or Business Owner.');
        const cleanPhone = bizPhone.replace(/\D/g, '');
        if (cleanPhone.length < 11) return Alert.alert('Phone Number Required', 'Please enter an 11-digit contact phone number.');
      } else {
        // Business Retrieve
        if (!bizName.trim()) return Alert.alert('Required Field', 'Please enter your Registered Business / Company Name.');
        if (!bizCacNumber.trim() && !bizTaxId.trim()) {
          return Alert.alert('Search Identifier Required', 'Please enter either your CAC Registration Number (RC/BN) or Existing Tax ID.');
        }
        if (bizIncorpDate.length < 10) return Alert.alert('Date Required', 'Please enter the Date of Incorporation in DD/MM/YYYY format.');
        const cleanPhone = bizPhone.replace(/\D/g, '');
        if (cleanPhone.length < 11) return Alert.alert('Phone Number Required', 'Please enter an 11-digit contact phone number.');
      }
    }

    // Prepare Confirmation Data
    const applicantName = entityCategory === 'individual' ? indivFullName.trim() : bizName.trim();
    const referenceNumber = entityCategory === 'individual'
      ? (indivNin.trim() || indivTaxId.trim())
      : (bizCacNumber.trim() || bizTaxId.trim());
    const serviceTitle = `${entityCategory === 'individual' ? 'Individual' : 'Business'} Tax ID (${serviceAction === 'register' ? 'New Registration' : 'Certificate Retrieval'})`;

    setConfirmData({
      category: entityCategory,
      action: serviceAction,
      title: serviceTitle,
      applicantName,
      referenceNumber,
      fee: currentFee,
      onConfirm: executeSubmission,
    });
    setConfirmModalVisible(true);
  };

  const executeSubmission = async () => {
    if (!confirmData) return;
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Authentication required. Please sign in to continue.');

      // 1. Strict Live Database Balance Verification
      const { data: liveProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (profileErr || !liveProfile) {
        throw new Error('Unable to verify wallet balance. Please check your network connection.');
      }

      const liveBal = Number(liveProfile.balance || 0);
      if (liveBal < confirmData.fee) {
        setWalletBalance(liveBal);
        setConfirmModalVisible(false);
        setInsufficientModalVisible(true);
        throw new Error(`Insufficient wallet balance. Available: ₦${liveBal.toLocaleString()}, Required: ₦${confirmData.fee.toLocaleString()}`);
      }

      // 2. Strict Atomic Debit
      const newBal = liveBal - confirmData.fee;
      const { data: updateRes, error: balErr } = await supabase
        .from('profiles')
        .update({ balance: newBal })
        .eq('id', userId)
        .gte('balance', confirmData.fee)
        .select();

      if (balErr || !updateRes || updateRes.length === 0) {
        throw new Error('Debit failed: Insufficient wallet balance or concurrency collision.');
      }

      setWalletBalance(newBal);

      // 3. Insert Transaction Record
      const txnRef = `TIN_${Date.now()}`;
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'debit',
        category: 'verification',
        amount: confirmData.fee,
        status: 'success',
        reference: txnRef,
        description: `${confirmData.title} for ${confirmData.applicantName} (${confirmData.referenceNumber})`,
        metadata: {
          service: 'tin_services',
          entityCategory: confirmData.category,
          serviceAction: confirmData.action,
          applicantName: confirmData.applicantName,
          referenceNumber: confirmData.referenceNumber,
          fee: confirmData.fee,
        }
      });

      // 4. Save Task in verification_history for Admin Manual Fulfillment
      const detailsPayload: any = {
        status: 'PENDING',
        serviceTitle: confirmData.title,
        entityCategory: confirmData.category,
        serviceAction: confirmData.action,
        fee: confirmData.fee,
        txnRef,
        submittedAt: new Date().toISOString(),
      };

      if (confirmData.category === 'individual') {
        detailsPayload.fullName = indivFullName.trim();
        detailsPayload.nin = indivNin.trim();
        detailsPayload.dob = indivDob.trim();
        detailsPayload.gender = indivGender;
        detailsPayload.state = indivState;
        detailsPayload.lga = indivLga;
        detailsPayload.address = indivAddress.trim();
        detailsPayload.taxId = indivTaxId.trim();
        detailsPayload.phone = indivPhone.trim();
        detailsPayload.email = indivEmail.trim();
      } else {
        detailsPayload.businessName = bizName.trim();
        detailsPayload.cacNumber = bizCacNumber.trim();
        detailsPayload.incorpDate = bizIncorpDate.trim();
        detailsPayload.orgType = bizOrgType;
        detailsPayload.address = bizAddress.trim();
        detailsPayload.directorName = bizDirectorName.trim();
        detailsPayload.directorNin = bizDirectorNin.trim();
        detailsPayload.taxId = bizTaxId.trim();
        detailsPayload.phone = bizPhone.trim();
        detailsPayload.email = bizEmail.trim();
      }

      await verificationHistory.save({
        service_category: 'tin',
        service_type: confirmData.action === 'register' ? 'tin_registration' : 'tin_certificate_retrieval',
        search_number: confirmData.referenceNumber,
        holder_name: confirmData.applicantName,
        layout: 'jtb_official_tin',
        details: detailsPayload,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setConfirmModalVisible(false);
      setSuccessData({
        holderName: confirmData.applicantName,
        ref: txnRef,
        fee: confirmData.fee,
        title: confirmData.title,
      });
      setSuccessModalVisible(true);
      fetchHistory();
    } catch (err: any) {
      console.error('Submission error:', err);
      Alert.alert('Request Failed', err.message || 'Failed to submit Tax ID request.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setStringAsync(text);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const openDocument = async (url: string) => {
    if (!url) return;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (e) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open document link.');
      });
    }
  };

  const shareRequest = async (item: any) => {
    const details = item.details || {};
    const tin = details.generated_tin || details.retrieved_tin || details.taxId || 'Pending';
    const message = `Tax ID / TIN Details:\nName: ${item.holder_name}\nReference: ${item.search_number}\nTIN / Tax ID: ${tin}\nStatus: ${details.status || 'Processing'}`;
    Share.share({ message });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER BANNER */}
      <LinearGradient
        colors={[COLORS.navyDark, COLORS.navy, COLORS.navyCard]}
        style={[styles.headerBanner, { paddingTop: Math.max(insets.top, 16) }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Joint Tax Board (JTB)</Text>
            <Text style={styles.headerSubTitle}>National Tax ID & TIN Portal</Text>
          </View>

          <View style={styles.walletBadge}>
            <Ionicons name="wallet" size={13} color={COLORS.goldBright} style={{ marginRight: 4 }} />
            <Text style={styles.walletBadgeText}>
              ₦{walletBalance !== null ? walletBalance.toLocaleString() : '---'}
            </Text>
          </View>
        </View>

        {/* Education Notice: Tax ID = TIN */}
        <View style={styles.noticePill}>
          <Ionicons name="information-circle" size={15} color={COLORS.goldBright} style={{ marginRight: 6 }} />
          <Text style={styles.noticePillText}>
            Tax ID and TIN (Tax Identification Number) are the same official identifier in Nigeria.
          </Text>
        </View>

        {/* TOP LEVEL NAVIGATION TABS */}
        <View style={styles.topTabBar}>
          <TouchableOpacity
            style={[styles.topTabItem, activeMainTab === 'services' && styles.topTabItemActive]}
            onPress={() => setActiveMainTab('services')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={activeMainTab === 'services' ? COLORS.white : COLORS.mutedText}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.topTabText, activeMainTab === 'services' && styles.topTabTextActive]}>
              Tax ID Services
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTabItem, activeMainTab === 'history' && styles.topTabItemActive]}
            onPress={() => setActiveMainTab('history')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={activeMainTab === 'history' ? COLORS.white : COLORS.mutedText}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.topTabText, activeMainTab === 'history' && styles.topTabTextActive]}>
              My Requests ({historyList.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* BODY CONTENT */}
      {activeMainTab === 'services' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          {/* STEP 1: ENTITY CATEGORY SELECTION (INDIVIDUAL VS BUSINESS) */}
          <Text style={styles.sectionTitle}>1. Select Taxpayer Category</Text>
          <Text style={styles.sectionSubtitle}>
            Pricing and required verification credentials vary based on entity type.
          </Text>

          <View style={styles.categoryCardsRow}>
            {/* Card A: Individual */}
            <TouchableOpacity
              style={[
                styles.categoryCard,
                entityCategory === 'individual' && styles.categoryCardActiveIndividual,
              ]}
              onPress={() => setEntityCategory('individual')}
              activeOpacity={0.8}
            >
              <View style={styles.categoryCardHeader}>
                <View style={[styles.categoryIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="person" size={20} color={COLORS.emerald} />
                </View>
                <View style={[styles.priceTag, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.priceTagText, { color: COLORS.emeraldDark }]}>
                    ₦{individualPrice.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={styles.categoryCardTitle}>Individual TIN</Text>
              <Text style={styles.categoryCardDesc}>
                Personal Tax ID for citizens, employees, salary earners, self-employed & NIN holders.
              </Text>

              {entityCategory === 'individual' && (
                <View style={[styles.selectedCheckBadge, { backgroundColor: COLORS.emerald }]}>
                  <Ionicons name="checkmark" size={13} color={COLORS.white} />
                  <Text style={styles.selectedCheckText}>SELECTED</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Card B: Business */}
            <TouchableOpacity
              style={[
                styles.categoryCard,
                entityCategory === 'business' && styles.categoryCardActiveBusiness,
              ]}
              onPress={() => setEntityCategory('business')}
              activeOpacity={0.8}
            >
              <View style={styles.categoryCardHeader}>
                <View style={[styles.categoryIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="business" size={20} color="#2563EB" />
                </View>
                <View style={[styles.priceTag, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={[styles.priceTagText, { color: '#1E40AF' }]}>
                    ₦{businessPrice.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={styles.categoryCardTitle}>Business & Corporate</Text>
              <Text style={styles.categoryCardDesc}>
                CAC Registered Companies (RC), Business Names (BN), Enterprises & NGOs.
              </Text>

              {entityCategory === 'business' && (
                <View style={[styles.selectedCheckBadge, { backgroundColor: '#2563EB' }]}>
                  <Ionicons name="checkmark" size={13} color={COLORS.white} />
                  <Text style={styles.selectedCheckText}>SELECTED</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* STEP 2: SERVICE ACTION (REGISTER NEW VS RETRIEVE CERTIFICATE) */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Select Service Type</Text>
          <Text style={styles.sectionSubtitle}>
            Choose whether to generate a new registration or retrieve an existing certificate.
          </Text>

          <View style={styles.actionSegmentRow}>
            <TouchableOpacity
              style={[
                styles.actionSegmentBtn,
                serviceAction === 'register' && styles.actionSegmentBtnActive,
              ]}
              onPress={() => setServiceAction('register')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle"
                size={16}
                color={serviceAction === 'register' ? COLORS.navyDark : COLORS.subText}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.actionSegmentText,
                  serviceAction === 'register' && styles.actionSegmentTextActive,
                ]}
              >
                Apply New Registration
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionSegmentBtn,
                serviceAction === 'retrieve' && styles.actionSegmentBtnActive,
              ]}
              onPress={() => setServiceAction('retrieve')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="document-text"
                size={16}
                color={serviceAction === 'retrieve' ? COLORS.navyDark : COLORS.subText}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.actionSegmentText,
                  serviceAction === 'retrieve' && styles.actionSegmentTextActive,
                ]}
              >
                Retrieve Certificate (PDF)
              </Text>
            </TouchableOpacity>
          </View>

          {/* STEP 3: DYNAMIC FORM CONTAINER */}
          <View style={styles.formContainer}>
            {/* Form Header Info Box */}
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.formHeaderTitle}>
                  {entityCategory === 'individual' ? 'Individual' : 'Business'}{' '}
                  {serviceAction === 'register' ? 'New TIN Application' : 'Certificate Retrieval'}
                </Text>
                <Text style={styles.formHeaderSub}>
                  {serviceAction === 'register'
                    ? 'Enter official details to submit for Joint Tax Board enrollment.'
                    : 'Search and retrieve verified JTB Tax ID Certificate document.'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* ───────────────── INDIVIDUAL FORM ───────────────── */}
            {entityCategory === 'individual' && (
              <>
                {/* Full Name */}
                <Text style={styles.label}>
                  Full Legal Name (as on NIN) <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ibrahim Abubakar Muhammad"
                  placeholderTextColor={COLORS.mutedText}
                  value={indivFullName}
                  onChangeText={setIndivFullName}
                />

                {/* NIN / Tax ID Input */}
                {serviceAction === 'register' ? (
                  <>
                    <Text style={styles.label}>
                      11-Digit National Identity Number (NIN) <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 12345678901"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="numeric"
                      maxLength={11}
                      value={indivNin}
                      onChangeText={(t) => setIndivNin(t.replace(/\D/g, ''))}
                    />
                  </>
                ) : (
                  <View style={styles.rowTwoInputs}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>NIN (11 Digits)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="NIN Number"
                        placeholderTextColor={COLORS.mutedText}
                        keyboardType="numeric"
                        maxLength={11}
                        value={indivNin}
                        onChangeText={(t) => setIndivNin(t.replace(/\D/g, ''))}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>Or Tax ID / TIN</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 2301456789"
                        placeholderTextColor={COLORS.mutedText}
                        value={indivTaxId}
                        onChangeText={setIndivTaxId}
                      />
                    </View>
                  </View>
                )}

                {/* Date of Birth & Gender Row */}
                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1.2, marginRight: 8 }}>
                    <Text style={styles.label}>
                      Date of Birth (DD/MM/YYYY) <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="numeric"
                      maxLength={10}
                      value={indivDob}
                      onChangeText={(t) => handleDateChange(t, setIndivDob)}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.genderRow}>
                      <TouchableOpacity
                        style={[
                          styles.genderBtn,
                          indivGender === 'Male' && styles.genderBtnActive,
                        ]}
                        onPress={() => setIndivGender('Male')}
                      >
                        <Text
                          style={[
                            styles.genderBtnText,
                            indivGender === 'Male' && styles.genderBtnTextActive,
                          ]}
                        >
                          Male
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.genderBtn,
                          indivGender === 'Female' && styles.genderBtnActive,
                        ]}
                        onPress={() => setIndivGender('Female')}
                      >
                        <Text
                          style={[
                            styles.genderBtnText,
                            indivGender === 'Female' && styles.genderBtnTextActive,
                          ]}
                        >
                          Female
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* State & LGA of Origin (Register Action) */}
                {serviceAction === 'register' && (
                  <View style={styles.rowTwoInputs}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>
                        State of Origin <Text style={styles.star}>*</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.dropdownBtn}
                        onPress={() => {
                          setStateSearchQuery('');
                          setShowStateModal(true);
                        }}
                      >
                        <Text style={indivState ? styles.dropdownValText : styles.dropdownPlaceholder}>
                          {indivState || 'Select State'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>LGA of Origin</Text>
                      <TouchableOpacity
                        style={[styles.dropdownBtn, !indivState && { opacity: 0.6 }]}
                        onPress={() => {
                          if (!indivState) {
                            Alert.alert('Select State', 'Please select a State first.');
                            return;
                          }
                          setLgaSearchQuery('');
                          setShowLgaModal(true);
                        }}
                        disabled={!indivState}
                      >
                        <Text style={indivLga ? styles.dropdownValText : styles.dropdownPlaceholder}>
                          {indivLga || 'Select LGA'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Residential Address (Register Action) */}
                {serviceAction === 'register' && (
                  <>
                    <Text style={styles.label}>
                      Current Residential Address <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                      placeholder="e.g. No. 14 Bompai Road, Nassarawa, Kano"
                      placeholderTextColor={COLORS.mutedText}
                      multiline
                      value={indivAddress}
                      onChangeText={setIndivAddress}
                    />
                  </>
                )}

                {/* Contact Phone & Email */}
                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1.1, marginRight: 8 }}>
                    <Text style={styles.label}>
                      Phone / WhatsApp <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="08012345678"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={indivPhone}
                      onChangeText={(t) => setIndivPhone(t.replace(/\D/g, ''))}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="user@example.com"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={indivEmail}
                      onChangeText={setIndivEmail}
                    />
                  </View>
                </View>
              </>
            )}

            {/* ───────────────── BUSINESS FORM ───────────────── */}
            {entityCategory === 'business' && (
              <>
                {/* Registered Business Name */}
                <Text style={styles.label}>
                  Registered Business / Corporate Name <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Abu Mafhal Integrated Services LTD"
                  placeholderTextColor={COLORS.mutedText}
                  value={bizName}
                  onChangeText={setBizName}
                />

                {/* CAC Reg Number & Existing Tax ID */}
                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1.2, marginRight: 8 }}>
                    <Text style={styles.label}>
                      CAC Registration Number <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. RC1845620 / BN39482"
                      placeholderTextColor={COLORS.mutedText}
                      autoCapitalize="characters"
                      value={bizCacNumber}
                      onChangeText={setBizCacNumber}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>
                      Incorp. Date (DD/MM/YYYY) <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="numeric"
                      maxLength={10}
                      value={bizIncorpDate}
                      onChangeText={(t) => handleDateChange(t, setBizIncorpDate)}
                    />
                  </View>
                </View>

                {/* Business Entity Type */}
                <Text style={styles.label}>Business Entity Type</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowOrgModal(true)}
                >
                  <Text style={styles.dropdownValText}>{bizOrgType}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                </TouchableOpacity>

                {/* Business Operating Address */}
                {serviceAction === 'register' && (
                  <>
                    <Text style={styles.label}>
                      Business Operating Address <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                      placeholder="e.g. Suite 204, Gidan Dan Asabe, Airport Road, Kano"
                      placeholderTextColor={COLORS.mutedText}
                      multiline
                      value={bizAddress}
                      onChangeText={setBizAddress}
                    />
                  </>
                )}

                {/* Director Name & Director NIN */}
                {serviceAction === 'register' && (
                  <View style={styles.rowTwoInputs}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>
                        Director / Owner Full Name <Text style={styles.star}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Director Name"
                        placeholderTextColor={COLORS.mutedText}
                        value={bizDirectorName}
                        onChangeText={setBizDirectorName}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>
                        Director's NIN (11 Digits) <Text style={styles.star}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Director NIN"
                        placeholderTextColor={COLORS.mutedText}
                        keyboardType="numeric"
                        maxLength={11}
                        value={bizDirectorNin}
                        onChangeText={(t) => setBizDirectorNin(t.replace(/\D/g, ''))}
                      />
                    </View>
                  </View>
                )}

                {/* Business Contact Phone & Email */}
                <View style={styles.rowTwoInputs}>
                  <View style={{ flex: 1.1, marginRight: 8 }}>
                    <Text style={styles.label}>
                      Official Phone / WhatsApp <Text style={styles.star}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="08012345678"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={bizPhone}
                      onChangeText={(t) => setBizPhone(t.replace(/\D/g, ''))}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Official Business Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="company@domain.com"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={bizEmail}
                      onChangeText={setBizEmail}
                    />
                  </View>
                </View>
              </>
            )}

            {/* FEE BREAKDOWN & SUBMISSION BOX */}
            <View style={styles.feeBreakdownBox}>
              <View style={styles.feeBreakdownRow}>
                <View>
                  <Text style={styles.feeBreakdownTitle}>Total Service Fee:</Text>
                  <Text style={styles.feeBreakdownSub}>
                    Deducted directly from wallet balance
                  </Text>
                </View>
                <Text style={styles.feeBreakdownAmount}>
                  ₦{activeServiceFee.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* ACTION SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.submitButton, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Ionicons
                    name={serviceAction === 'register' ? 'paper-plane' : 'search'}
                    size={18}
                    color={COLORS.white}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitButtonText}>
                    {serviceAction === 'register'
                      ? `Submit ${entityCategory === 'individual' ? 'Individual' : 'Business'} TIN Request (₦${activeServiceFee.toLocaleString()})`
                      : `Retrieve ${entityCategory === 'individual' ? 'Individual' : 'Business'} Certificate (₦${activeServiceFee.toLocaleString()})`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.complianceNote}>
              🔒 Secure Tax Administration: All applications are verified directly against Joint Tax Board (JTB) and State Internal Revenue registries.
            </Text>
          </View>
        </ScrollView>
      ) : (
        /* ───────────────── MY REQUESTS & HISTORY TAB ───────────────── */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHistory} tintColor={COLORS.gold} />}
        >
          {/* Search & Filter Header */}
          <View style={styles.historySearchWrapper}>
            <Ionicons name="search" size={18} color={COLORS.subText} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.historySearchInput}
              placeholder="Search by Applicant Name, NIN, or Ref..."
              placeholderTextColor={COLORS.mutedText}
              value={historySearch}
              onChangeText={setHistorySearch}
            />
            {historySearch.length > 0 && (
              <TouchableOpacity onPress={() => setHistorySearch('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.mutedText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <View style={styles.filterPillsRow}>
            {(['all', 'pending', 'completed'] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, historyFilter === f && styles.filterPillActive]}
                onPress={() => setHistoryFilter(f)}
              >
                <Text style={[styles.filterPillText, historyFilter === f && styles.filterPillTextActive]}>
                  {f.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* History Cards List */}
          {filteredHistory.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.mutedText} />
              <Text style={styles.emptyStateTitle}>No Tax ID Requests Found</Text>
              <Text style={styles.emptyStateSub}>
                {historySearch ? 'No submissions match your search query.' : 'You have not submitted any Tax ID or TIN requests yet.'}
              </Text>
            </View>
          ) : (
            filteredHistory.map((item, idx) => {
              const details = item.details || {};
              const status = (details.status || item.status || 'PENDING').toUpperCase();
              const isCompleted = status === 'COMPLETED' || status === 'SUCCESS';
              const isPending = status === 'PENDING' || status === 'PROCESSING';
              const certUrl = details.certificate_url || details.download_url || details.document_url;
              const generatedTin = details.generated_tin || details.retrieved_tin || details.taxId;

              return (
                <View key={item.id || idx} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyIconBadge}>
                      <Ionicons
                        name={details.entityCategory === 'business' ? 'business' : 'person'}
                        size={18}
                        color={details.entityCategory === 'business' ? '#2563EB' : COLORS.emerald}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.historyApplicantName} numberOfLines={1}>
                        {item.holder_name || details.holderName || details.applicantName || 'Tax ID Applicant'}
                      </Text>
                      <Text style={styles.historyRefCode}>
                        ID: {item.search_number || details.nin || details.cacNumber || 'N/A'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isCompleted
                          ? { backgroundColor: COLORS.successBg }
                          : isPending
                          ? { backgroundColor: COLORS.warningBg }
                          : { backgroundColor: COLORS.dangerBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isCompleted
                            ? { color: COLORS.success }
                            : isPending
                            ? { color: '#B45309' }
                            : { color: COLORS.danger },
                        ]}
                      >
                        {status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historyDivider} />

                  {/* Details Meta */}
                  <View style={styles.historyMetaRow}>
                    <Text style={styles.historyMetaLabel}>Service Category:</Text>
                    <Text style={styles.historyMetaVal}>
                      {details.serviceTitle || (details.entityCategory === 'business' ? 'Business TIN' : 'Individual TIN')}
                    </Text>
                  </View>

                  {generatedTin && (
                    <View style={[styles.historyMetaRow, { backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8, marginTop: 4 }]}>
                      <Text style={[styles.historyMetaLabel, { color: COLORS.emeraldDark, fontWeight: '700' }]}>
                        Assigned Tax ID:
                      </Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(generatedTin, 'Tax ID')}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={[styles.historyMetaVal, { color: COLORS.emeraldDark, fontWeight: '800' }]}>
                          {generatedTin}
                        </Text>
                        <Ionicons name="copy-outline" size={13} color={COLORS.emeraldDark} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.historyMetaRow}>
                    <Text style={styles.historyMetaLabel}>Submitted On:</Text>
                    <Text style={styles.historyMetaVal}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                    </Text>
                  </View>

                  {/* Actions Row */}
                  <View style={styles.historyActionsRow}>
                    {certUrl ? (
                      <TouchableOpacity
                        style={styles.historyActionBtnPrimary}
                        onPress={() => openDocument(certUrl)}
                      >
                        <Ionicons name="download-outline" size={15} color={COLORS.white} style={{ marginRight: 6 }} />
                        <Text style={styles.historyActionBtnPrimaryText}>Download Certificate PDF</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.pendingBadgeInfo}>
                        <Ionicons name="hourglass-outline" size={14} color="#B45309" style={{ marginRight: 4 }} />
                        <Text style={styles.pendingBadgeInfoText}>Admin Fulfillment In Progress</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.historyActionBtnSecondary}
                      onPress={() => shareRequest(item)}
                    >
                      <Ionicons name="share-social-outline" size={16} color={COLORS.navyDark} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ───────────────── CONFIRMATION MODAL ───────────────── */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loading) setConfirmModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeaderIcon}>
              <Ionicons name="shield-checkmark" size={32} color={COLORS.gold} />
            </View>

            <Text style={styles.confirmTitle}>Confirm Tax ID Request</Text>
            <Text style={styles.confirmSub}>
              Please verify your application details before submitting.
            </Text>

            {confirmData && (
              <View style={styles.confirmDetailsBox}>
                <View style={styles.confirmDetailItem}>
                  <Text style={styles.confirmDetailLabel}>Category:</Text>
                  <Text style={styles.confirmDetailVal}>
                    {confirmData.category === 'individual' ? 'Individual (Personal)' : 'Business & Corporate'}
                  </Text>
                </View>

                <View style={styles.confirmDetailItem}>
                  <Text style={styles.confirmDetailLabel}>Applicant / Entity:</Text>
                  <Text style={styles.confirmDetailVal}>{confirmData.applicantName}</Text>
                </View>

                <View style={styles.confirmDetailItem}>
                  <Text style={styles.confirmDetailLabel}>Identifier:</Text>
                  <Text style={styles.confirmDetailVal}>{confirmData.referenceNumber}</Text>
                </View>

                <View style={[styles.confirmDetailItem, { borderBottomWidth: 0, paddingTop: 8 }]}>
                  <Text style={[styles.confirmDetailLabel, { fontWeight: '800', color: COLORS.text }]}>
                    Service Fee:
                  </Text>
                  <Text style={[styles.confirmDetailVal, { fontWeight: '800', color: COLORS.emerald, fontSize: 16 }]}>
                    ₦{confirmData.fee.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.confirmNoticeBox}>
              <Ionicons name="alert-circle" size={16} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.confirmNoticeText}>
                Your request is directly submitted to our Tax Operations Desk. Once completed, your certificate will be instantly available in your History tab.
              </Text>
            </View>

            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                disabled={loading}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.confirmCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmSubmitBtn}
                disabled={loading}
                onPress={() => confirmData?.onConfirm()}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.confirmSubmitBtnText}>Confirm & Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───────────────── SUCCESS MODAL ───────────────── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-done" size={36} color={COLORS.emerald} />
            </View>

            <Text style={styles.successTitle}>Request Submitted Successfully!</Text>
            <Text style={styles.successSub}>
              Your Tax ID application has been queued for official verification.
            </Text>

            {successData && (
              <View style={styles.successRefBox}>
                <Text style={styles.successRefLabel}>Tracking Reference:</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(successData.ref, 'Reference')}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
                >
                  <Text style={styles.successRefVal}>{successData.ref}</Text>
                  <Ionicons name="copy-outline" size={14} color={COLORS.text} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => {
                setSuccessModalVisible(false);
                setActiveMainTab('history');
              }}
            >
              <Text style={styles.successBtnText}>View in My Requests</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ───────────────── INSUFFICIENT BALANCE MODAL ───────────────── */}
      <Modal
        visible={insufficientModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsufficientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.insufficientCard}>
            <View style={styles.insufficientIconCircle}>
              <Ionicons name="wallet-outline" size={32} color={COLORS.danger} />
            </View>

            <Text style={styles.insufficientTitle}>Insufficient Wallet Balance</Text>
            <Text style={styles.insufficientSub}>
              Your current wallet balance is ₦{walletBalance !== null ? walletBalance.toLocaleString() : '0'}, but this service requires ₦{activeServiceFee.toLocaleString()}.
            </Text>

            <View style={styles.insufficientBtnRow}>
              <TouchableOpacity
                style={styles.insufficientDismissBtn}
                onPress={() => setInsufficientModalVisible(false)}
              >
                <Text style={styles.insufficientDismissBtnText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.insufficientFundBtn}
                onPress={() => {
                  setInsufficientModalVisible(false);
                  router.push('/(app)/fund-wallet' as any);
                }}
              >
                <Text style={styles.insufficientFundBtnText}>Fund Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───────────────── STATE SELECTION MODAL ───────────────── */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStateModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Select State of Origin</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={16} color={COLORS.subText} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search State..."
                placeholderTextColor={COLORS.mutedText}
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {filteredStateList.map(st => (
                <TouchableOpacity
                  key={st}
                  style={styles.modalItemRow}
                  onPress={() => {
                    setIndivState(st);
                    setIndivLga('');
                    setShowStateModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, indivState === st && { fontWeight: '800', color: COLORS.emerald }]}>
                    {st}
                  </Text>
                  {indivState === st && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────────── LGA SELECTION MODAL ───────────────── */}
      <Modal
        visible={showLgaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLgaModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Select Local Government ({indivState})</Text>
              <TouchableOpacity onPress={() => setShowLgaModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={16} color={COLORS.subText} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search LGA..."
                placeholderTextColor={COLORS.mutedText}
                value={lgaSearchQuery}
                onChangeText={setLgaSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {filteredLgaList.map((l: string) => (
                <TouchableOpacity
                  key={l}
                  style={styles.modalItemRow}
                  onPress={() => {
                    setIndivLga(l);
                    setShowLgaModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, indivLga === l && { fontWeight: '800', color: COLORS.emerald }]}>
                    {l}
                  </Text>
                  {indivLga === l && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────────── ORG TYPE SELECTION MODAL ───────────────── */}
      <Modal
        visible={showOrgModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrgModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Select Business Entity Type</Text>
              <TouchableOpacity onPress={() => setShowOrgModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {ORG_TYPES.map(o => (
                <TouchableOpacity
                  key={o}
                  style={styles.modalItemRow}
                  onPress={() => {
                    setBizOrgType(o);
                    setShowOrgModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, bizOrgType === o && { fontWeight: '800', color: '#2563EB' }]}>
                    {o}
                  </Text>
                  {bizOrgType === o && (
                    <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerBanner: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  walletBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  noticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  noticePillText: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 3,
  },
  topTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  topTabItemActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  topTabText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  topTabTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.subText,
    marginBottom: 10,
  },
  categoryCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  categoryCardActiveIndividual: {
    borderColor: COLORS.emerald,
    backgroundColor: '#F0FDF4',
  },
  categoryCardActiveBusiness: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  categoryCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  categoryCardDesc: {
    fontSize: 11,
    color: COLORS.subText,
    lineHeight: 15,
  },
  selectedCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
    gap: 3,
  },
  selectedCheckText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  actionSegmentRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  actionSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionSegmentBtnActive: {
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  actionSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  actionSegmentTextActive: {
    color: COLORS.navyDark,
    fontWeight: '800',
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formHeaderRow: {
    marginBottom: 12,
  },
  formHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  formHeaderSub: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 5,
  },
  star: {
    color: COLORS.danger,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 12,
  },
  rowTwoInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 2,
    height: 44,
    marginBottom: 12,
  },
  genderBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  genderBtnActive: {
    backgroundColor: COLORS.white,
  },
  genderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  genderBtnTextActive: {
    color: COLORS.navyDark,
    fontWeight: '800',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  dropdownValText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  dropdownPlaceholder: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  feeBreakdownBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeBreakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  feeBreakdownSub: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
  },
  feeBreakdownAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.emerald,
  },
  submitButton: {
    backgroundColor: COLORS.navyDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  complianceNote: {
    fontSize: 10,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 14,
  },
  historySearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  historySearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.navyDark,
    borderColor: COLORS.navyDark,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.subText,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyApplicantName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  historyRefCode: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  historyDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyMetaLabel: {
    fontSize: 11,
    color: COLORS.subText,
  },
  historyMetaVal: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  historyActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.emerald,
    paddingVertical: 8,
    borderRadius: 8,
  },
  historyActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  pendingBadgeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningBg,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pendingBadgeInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  historyActionBtnSecondary: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 440,
  },
  confirmHeaderIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14,
  },
  confirmDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 12,
  },
  confirmDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  confirmDetailLabel: {
    fontSize: 12,
    color: COLORS.subText,
  },
  confirmDetailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  confirmNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  confirmNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.subText,
  },
  confirmSubmitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.navyDark,
    alignItems: 'center',
  },
  confirmSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  successCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 17,
  },
  successRefBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
  },
  successRefLabel: {
    fontSize: 10,
    color: COLORS.subText,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  successRefVal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  successBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  insufficientCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  insufficientIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  insufficientTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.danger,
    textAlign: 'center',
  },
  insufficientSub: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 17,
  },
  insufficientBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  insufficientDismissBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  insufficientDismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.subText,
  },
  insufficientFundBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
  },
  insufficientFundBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '75%',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalSheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemText: {
    fontSize: 13,
    color: COLORS.text,
  },
});
