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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';

import { supabase } from '../../services/supabase';
import { verificationHistory } from '../../services/verificationHistory';
import { NIGERIA_STATES, STATE_LIST } from '../../utils/nigeriaStates';

// Design Palette
const COLORS = {
  navyDark: '#070f26',
  navy: '#0d1b3e',
  navyCard: '#132347',
  gold: '#f5a623',
  goldLight: '#fef3c7',
  white: '#ffffff',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#0f172a',
  subText: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  successBg: '#dcfce7',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  info: '#2563eb',
  infoBg: '#eff6ff',
  emerald: '#059669',
  emeraldLight: '#ecfdf5',
};

// Search criteria types as shown in screenshots
type IndividualCriteria = 'nin_name_dob' | 'tax_id_dob' | 'prev_tin_dob';
type CorporateCriteria = 'cac_reg' | 'tax_id' | 'prev_tin';
type MdaCriteria = 'registered_name' | 'reg_number' | 'tax_id' | 'prev_tin';

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

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'retrieve' | 'register' | 'history'>('retrieve');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Dynamic Prices from database (default fallback)
  const [retrievalPrice, setRetrievalPrice] = useState<number>(1500);
  const [registrationPrice, setRegistrationPrice] = useState<number>(2500);

  // -------------------------------------------------------------
  // TAB 1: RETRIEVE TAX ID CERTIFICATE STATE (From screenshots)
  // -------------------------------------------------------------
  const [category, setCategory] = useState<'individual' | 'non_individual'>('individual');
  
  // Individual fields
  const [indivCriteria, setIndivCriteria] = useState<IndividualCriteria>('nin_name_dob');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nin, setNin] = useState('');
  const [taxId, setTaxId] = useState('');
  const [previousTin, setPreviousTin] = useState('');
  const [dob, setDob] = useState(''); // DD/MM/YYYY

  // Non-Individual fields
  const [entityType, setEntityType] = useState<'corporate' | 'mda' | 'cooperative'>('corporate');
  const [corpCriteria, setCorpCriteria] = useState<CorporateCriteria>('cac_reg');
  const [mdaCriteria, setMdaCriteria] = useState<MdaCriteria>('registered_name');
  const [organizationType, setOrganizationType] = useState('Private Limited Liability Company (LTD)');
  const [cacRegNumber, setCacRegNumber] = useState('');
  const [dateOfIncorporation, setDateOfIncorporation] = useState(''); // DD/MM/YYYY
  const [registeredName, setRegisteredName] = useState('');

  // Contact fields for retrieval
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // -------------------------------------------------------------
  // TAB 2: REGISTER NEW TIN STATE
  // -------------------------------------------------------------
  const [regCategory, setRegCategory] = useState<'individual' | 'business'>('individual');
  const [regFullName, setRegFullName] = useState('');
  const [regNin, setRegNin] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regState, setRegState] = useState('');
  const [regLga, setRegLga] = useState('');
  const [regOccupation, setRegOccupation] = useState('');
  
  // Business Registration specific
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regCacNumber, setRegCacNumber] = useState('');
  const [regIncorpDate, setRegIncorpDate] = useState('');
  const [regDirectorNin, setRegDirectorNin] = useState('');

  // -------------------------------------------------------------
  // TAB 3: HISTORY & REQUESTS
  // -------------------------------------------------------------
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Modals
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showLgaModal, setShowLgaModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);

  // Available LGAs for selected state
  const availableLgas = useMemo(() => {
    if (!regState) return [];
    return (NIGERIA_STATES as Record<string, string[]>)[regState] || [];
  }, [regState]);

  // Load user data & history on mount
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
        if (profile.phone && !contactPhone) setContactPhone(profile.phone);
        if (profile.email && !contactEmail) setContactEmail(profile.email);
        if (profile.full_name) {
          const parts = profile.full_name.trim().split(' ');
          if (parts.length > 0 && !firstName) setFirstName(parts[0]);
          if (parts.length > 1 && !lastName) setLastName(parts.slice(1).join(' '));
          if (!regFullName) setRegFullName(profile.full_name);
        }
      }
    } catch (err) {
      console.warn('Error fetching user data:', err);
    }
  };

  const fetchPricing = async () => {
    try {
      // 1. Check app_settings first (where Admin sets pricing)
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['tin_pricing_controls', 'price_tin_certificate', 'price_tin_registration']);

      let foundInSettings = false;
      if (settingsData && settingsData.length > 0) {
        settingsData.forEach(item => {
          if (item.key === 'tin_pricing_controls' && item.value) {
            try {
              const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
              if (parsed?.tin_certificate?.selling_price) {
                setRetrievalPrice(Number(parsed.tin_certificate.selling_price));
                foundInSettings = true;
              }
              if (parsed?.tin_registration?.selling_price) {
                setRegistrationPrice(Number(parsed.tin_registration.selling_price));
                foundInSettings = true;
              }
            } catch (_) {}
          }
          if (item.key === 'price_tin_certificate' && item.value) {
            const p = parseFloat(item.value);
            if (!isNaN(p) && p > 0) {
              setRetrievalPrice(p);
              foundInSettings = true;
            }
          }
          if (item.key === 'price_tin_registration' && item.value) {
            const p = parseFloat(item.value);
            if (!isNaN(p) && p > 0) {
              setRegistrationPrice(p);
              foundInSettings = true;
            }
          }
        });
      }

      // 2. Fallback to service_pricing table
      if (!foundInSettings) {
        const { data } = await supabase
          .from('service_pricing')
          .select('id, cost_price, markup_price')
          .in('id', ['tin_certificate', 'tin_registration']);

        if (data && Array.isArray(data)) {
          data.forEach(p => {
            const total = Number(p.cost_price || 0) + Number(p.markup_price || 0);
            if (total > 0) {
              if (p.id === 'tin_certificate') setRetrievalPrice(total);
              if (p.id === 'tin_registration') setRegistrationPrice(total);
            }
          });
        }
      }
    } catch (_) {}
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

  // Date of birth auto-formatter (DD/MM/YYYY)
  const formatDOBInput = (raw: string, setter: (val: string) => void) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length >= 5) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    } else if (cleaned.length >= 3) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    setter(formatted);
  };

  // -------------------------------------------------------------
  // SUBMIT: RETRIEVE TAX ID CERTIFICATE
  // -------------------------------------------------------------
  const handleRetrieveCertificate = async () => {
    // 1. Validation
    if (category === 'individual') {
      if (indivCriteria === 'nin_name_dob') {
        if (!firstName.trim()) return Alert.alert('Required', 'Please enter your First Name.');
        if (!lastName.trim()) return Alert.alert('Required', 'Please enter your Last Name.');
        if (nin.replace(/\D/g, '').length !== 11) return Alert.alert('Invalid NIN', 'National Identification Number (NIN) must be exactly 11 digits.');
        if (dob.length < 10) return Alert.alert('Required', 'Please enter your Date of Birth in DD/MM/YYYY format.');
      } else if (indivCriteria === 'tax_id_dob') {
        if (!taxId.trim()) return Alert.alert('Required', 'Please enter your Tax ID / TIN Number.');
        if (dob.length < 10) return Alert.alert('Required', 'Please enter your Date of Birth in DD/MM/YYYY format.');
      } else if (indivCriteria === 'prev_tin_dob') {
        if (!previousTin.trim()) return Alert.alert('Required', 'Please enter your Previous TIN.');
        if (dob.length < 10) return Alert.alert('Required', 'Please enter your Date of Birth in DD/MM/YYYY format.');
      }
    } else {
      // Non-individual
      if (entityType === 'corporate') {
        if (!cacRegNumber.trim()) return Alert.alert('Required', 'Please enter your CAC Registration Number (e.g. RC123456).');
        if (dateOfIncorporation.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation in DD/MM/YYYY format.');
      } else if (entityType === 'mda') {
        if (!registeredName.trim()) return Alert.alert('Required', 'Please enter MDA Registered Name.');
      } else {
        if (!registeredName.trim()) return Alert.alert('Required', 'Please enter Cooperative Society Name.');
      }
    }

    if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 11) {
      return Alert.alert('Required', 'Please provide a valid 11-digit WhatsApp/Phone number for delivery.');
    }

    // 2. Wallet Balance Check
    const currentBal = walletBalance || 0;
    if (currentBal < retrievalPrice) {
      return Alert.alert(
        'Insufficient Wallet Balance',
        `This service fee is ₦${retrievalPrice.toLocaleString()}. Your balance is ₦${currentBal.toLocaleString()}. Please fund your wallet to proceed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => router.push('/wallet') }
        ]
      );
    }

    // 3. Confirmation Dialog
    const searchNumber = category === 'individual'
      ? (indivCriteria === 'nin_name_dob' ? nin.trim() : (indivCriteria === 'tax_id_dob' ? taxId.trim() : previousTin.trim()))
      : (entityType === 'corporate' ? cacRegNumber.trim() : registeredName.trim());

    const holderName = category === 'individual'
      ? `${firstName.trim()} ${lastName.trim()}`
      : (entityType === 'corporate' ? `${organizationType} (${cacRegNumber})` : registeredName.trim());

    Alert.alert(
      'Confirm Tax ID Certificate Retrieval',
      `Category: ${category === 'individual' ? 'Individual' : `Non-Individual (${entityType.toUpperCase()})`}\nReference: ${searchNumber}\nFee: ₦${retrievalPrice.toLocaleString()}\n\nProceed to retrieve official Tax ID Certificate?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Pay',
          onPress: async () => {
            setLoading(true);
            try {
              const { data: authData } = await supabase.auth.getUser();
              const userId = authData?.user?.id;
              if (!userId) throw new Error('Not authenticated');

              // 1. Strict Live Database Balance Verification (Prevents race conditions & bypass)
              const { data: liveProfile, error: profileErr } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', userId)
                .single();

              if (profileErr || !liveProfile) {
                throw new Error('Ba a iya tabbatar da kudin wallet ba. Da fatan a sake gwadawa.');
              }

              const liveBal = Number(liveProfile.balance || 0);
              if (liveBal < retrievalPrice) {
                setWalletBalance(liveBal);
                throw new Error(`Kudin da ke wallet dinka bai isa ba. Kana da ₦${liveBal.toLocaleString()} ne kacal, yayin da kuɗin aikin ₦${retrievalPrice.toLocaleString()} ne. Da fatan a saka kudi a wallet.`);
              }

              // 2. Strict Atomic Debit with gte barrier
              const newBal = liveBal - retrievalPrice;
              const { data: updateRes, error: balErr } = await supabase
                .from('profiles')
                .update({ balance: newBal })
                .eq('id', userId)
                .gte('balance', retrievalPrice)
                .select();

              if (balErr || !updateRes || updateRes.length === 0) {
                throw new Error('Cire kudi ya faskara: Kudin wallet dinka bai isa ba ko an samu tsaiko. Da fatan a duba asusunka.');
              }

              setWalletBalance(newBal);

              // Create transaction record
              const txnRef = `TIN_RET_${Date.now()}`;
              await supabase.from('transactions').insert({
                user_id: userId,
                type: 'debit',
                category: 'verification',
                amount: retrievalPrice,
                status: 'success',
                reference: txnRef,
                description: `Tax ID Certificate Retrieval: ${holderName} (${searchNumber})`,
                metadata: {
                  service: 'tax_id_certificate',
                  category,
                  entityType,
                  searchNumber,
                  holderName,
                  contactPhone,
                  contactEmail
                }
              });

              // Save task to verification_history
              await verificationHistory.save({
                service_category: 'tin',
                service_type: 'tin_certificate_retrieval',
                search_number: searchNumber,
                holder_name: holderName,
                layout: 'jtb_tax_certificate',
                details: {
                  status: 'PENDING',
                  type: 'retrieval',
                  category,
                  entityType,
                  criteria: category === 'individual' ? indivCriteria : corpCriteria,
                  firstName,
                  lastName,
                  nin: category === 'individual' ? nin : undefined,
                  taxId: category === 'individual' ? taxId : undefined,
                  previousTin: category === 'individual' ? previousTin : undefined,
                  dob: category === 'individual' ? dob : undefined,
                  organizationType: category === 'non_individual' ? organizationType : undefined,
                  cacRegNumber: category === 'non_individual' ? cacRegNumber : undefined,
                  dateOfIncorporation: category === 'non_individual' ? dateOfIncorporation : undefined,
                  registeredName: category === 'non_individual' ? registeredName : undefined,
                  contactPhone,
                  contactEmail,
                  amountPaid: retrievalPrice,
                  txnRef,
                  portal: 'taxidcert.jrb.gov.ng'
                }
              });

              Alert.alert(
                'Request Submitted Successfully! 🎉',
                `Your Tax ID Certificate retrieval request for "${holderName}" has been received. Our automated portal desk is generating and fetching your official document.\n\nYou can track and download it in the "My Requests" tab.`,
                [{ text: 'View Requests', onPress: () => { setActiveTab('history'); fetchHistory(); } }]
              );
            } catch (err: any) {
              Alert.alert('Submission Error', err.message || 'Failed to submit retrieval request.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // -------------------------------------------------------------
  // SUBMIT: REGISTER NEW TIN
  // -------------------------------------------------------------
  const handleRegisterNewTIN = async () => {
    if (regCategory === 'individual') {
      if (!regFullName.trim()) return Alert.alert('Required', 'Please enter your Full Name.');
      if (regNin.replace(/\D/g, '').length !== 11) return Alert.alert('Invalid NIN', 'National Identification Number (NIN) must be 11 digits.');
      if (regDob.length < 10) return Alert.alert('Required', 'Please enter Date of Birth (DD/MM/YYYY).');
      if (regPhone.replace(/\D/g, '').length < 11) return Alert.alert('Required', 'Please enter a valid 11-digit phone number.');
      if (!regState) return Alert.alert('Required', 'Please select State of Origin.');
      if (!regAddress.trim()) return Alert.alert('Required', 'Please enter residential address.');
    } else {
      // Business
      if (!regBusinessName.trim()) return Alert.alert('Required', 'Please enter Business / Company Name.');
      if (!regCacNumber.trim()) return Alert.alert('Required', 'Please enter CAC Registration Number (RC/BN).');
      if (regIncorpDate.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation (DD/MM/YYYY).');
      if (regDirectorNin.replace(/\D/g, '').length !== 11) return Alert.alert('Required', 'Please enter Director / Owner 11-digit NIN.');
      if (!regState) return Alert.alert('Required', 'Please select State of Business Operation.');
      if (!regAddress.trim()) return Alert.alert('Required', 'Please enter Business Address.');
    }

    const currentBal = walletBalance || 0;
    if (currentBal < registrationPrice) {
      return Alert.alert(
        'Insufficient Wallet Balance',
        `New TIN Registration fee is ₦${registrationPrice.toLocaleString()}. Your balance is ₦${currentBal.toLocaleString()}. Please fund your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => router.push('/wallet') }
        ]
      );
    }

    const applicantName = regCategory === 'individual' ? regFullName.trim() : regBusinessName.trim();
    const primaryId = regCategory === 'individual' ? regNin.trim() : regCacNumber.trim();

    Alert.alert(
      'Confirm New TIN Registration',
      `Category: ${regCategory === 'individual' ? 'Individual TIN' : 'Corporate Business TIN'}\nName: ${applicantName}\nFee: ₦${registrationPrice.toLocaleString()}\n\nProceed to register and generate official JTB TIN?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Register',
          onPress: async () => {
            setLoading(true);
            try {
              const { data: authData } = await supabase.auth.getUser();
              const userId = authData?.user?.id;
              if (!userId) throw new Error('Not authenticated');

              // 1. Strict Live Database Balance Verification (Prevents race conditions & bypass)
              const { data: liveProfile, error: profileErr } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', userId)
                .single();

              if (profileErr || !liveProfile) {
                throw new Error('Ba a iya tabbatar da kudin wallet ba. Da fatan a sake gwadawa.');
              }

              const liveBal = Number(liveProfile.balance || 0);
              if (liveBal < registrationPrice) {
                setWalletBalance(liveBal);
                throw new Error(`Kudin da ke wallet dinka bai isa ba. Kana da ₦${liveBal.toLocaleString()} ne kacal, yayin da kuɗin aikin ₦${registrationPrice.toLocaleString()} ne. Da fatan a saka kudi a wallet.`);
              }

              // 2. Strict Atomic Debit with gte barrier
              const newBal = liveBal - registrationPrice;
              const { data: updateRes, error: balErr } = await supabase
                .from('profiles')
                .update({ balance: newBal })
                .eq('id', userId)
                .gte('balance', registrationPrice)
                .select();

              if (balErr || !updateRes || updateRes.length === 0) {
                throw new Error('Cire kudi ya faskara: Kudin wallet dinka bai isa ba ko an samu tsaiko. Da fatan a duba asusunka.');
              }

              setWalletBalance(newBal);

              const txnRef = `TIN_REG_${Date.now()}`;
              await supabase.from('transactions').insert({
                user_id: userId,
                type: 'debit',
                category: 'verification',
                amount: registrationPrice,
                status: 'success',
                reference: txnRef,
                description: `New TIN Registration: ${applicantName} (${primaryId})`,
                metadata: {
                  service: 'new_tin_registration',
                  regCategory,
                  applicantName,
                  primaryId
                }
              });

              await verificationHistory.save({
                service_category: 'tin',
                service_type: 'tin_registration',
                search_number: primaryId,
                holder_name: applicantName,
                layout: 'jtb_new_tin',
                details: {
                  status: 'PENDING',
                  type: 'registration',
                  regCategory,
                  fullName: regCategory === 'individual' ? regFullName : regBusinessName,
                  nin: regCategory === 'individual' ? regNin : regDirectorNin,
                  cacNumber: regCategory === 'business' ? regCacNumber : undefined,
                  dob: regCategory === 'individual' ? regDob : undefined,
                  incorpDate: regCategory === 'business' ? regIncorpDate : undefined,
                  phone: regPhone,
                  email: regEmail,
                  address: regAddress,
                  state: regState,
                  lga: regLga,
                  occupation: regOccupation,
                  amountPaid: registrationPrice,
                  txnRef
                }
              });

              Alert.alert(
                'Registration Submitted! 🎉',
                `Your New TIN Registration application for "${applicantName}" has been logged successfully.\n\nOur certified tax compliance desk will register and issue your official JTB TIN and certificate.`,
                [{ text: 'View My Requests', onPress: () => { setActiveTab('history'); fetchHistory(); } }]
              );
            } catch (err: any) {
              Alert.alert('Registration Error', err.message || 'Failed to submit registration.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Copy helper
  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied 📋', `${label} copied to clipboard.`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.navy} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tax ID & TIN Portal</Text>
          <Text style={styles.headerSubtitle}>Joint Revenue Board (JRB / JTB) Services</Text>
        </View>

        <TouchableOpacity 
          style={styles.walletBadge} 
          onPress={() => router.push('/wallet')}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={14} color={COLORS.emerald} />
          <Text style={styles.walletText}>
            ₦{walletBalance !== null ? walletBalance.toLocaleString() : '---'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TOP NAV TABS ── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'retrieve' && styles.activeTabButton]}
          onPress={() => setActiveTab('retrieve')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="document-text" 
            size={16} 
            color={activeTab === 'retrieve' ? COLORS.white : COLORS.subText} 
          />
          <Text style={[styles.tabText, activeTab === 'retrieve' && styles.activeTabText]}>
            Tax ID Cert
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'register' && styles.activeTabButton]}
          onPress={() => setActiveTab('register')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="create-outline" 
            size={16} 
            color={activeTab === 'register' ? COLORS.white : COLORS.subText} 
          />
          <Text style={[styles.tabText, activeTab === 'register' && styles.activeTabText]}>
            Register TIN
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
          onPress={() => { setActiveTab('history'); fetchHistory(); }}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="time-outline" 
            size={16} 
            color={activeTab === 'history' ? COLORS.white : COLORS.subText} 
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            My Requests
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB CONTENT ── */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { fetchUserData(); fetchHistory(); }} />
        }
      >
        {/* ========================================================= */}
        {/* TAB 1: RETRIEVE TAX ID CERTIFICATE (taxidcert.jrb.gov.ng) */}
        {/* ========================================================= */}
        {activeTab === 'retrieve' && (
          <View style={styles.card}>
            {/* Government Portal Badge */}
            <View style={styles.portalBadge}>
              <View style={styles.govPill}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.emerald} />
                <Text style={styles.govPillText}>Official JRB / JTB Retrieval</Text>
              </View>
              <Text style={styles.portalFee}>Fee: ₦{retrievalPrice.toLocaleString()}</Text>
            </View>

            <Text style={styles.sectionHeaderTitle}>Tax ID Certificate Retrieval</Text>
            <Text style={styles.sectionHeaderDesc}>
              Enter your details to retrieve and download your official Tax ID certificate.
            </Text>

            {/* Category: Individual vs Non-Individual */}
            <Text style={styles.inputLabel}>Category <Text style={styles.requiredStar}>*</Text></Text>
            <View style={styles.categorySegment}>
              <TouchableOpacity
                style={[styles.categoryOption, category === 'individual' && styles.categoryOptionActive]}
                onPress={() => setCategory('individual')}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="person-outline" 
                  size={16} 
                  color={category === 'individual' ? COLORS.emerald : COLORS.subText} 
                />
                <Text style={[styles.categoryOptionText, category === 'individual' && styles.categoryOptionTextActive]}>
                  Individual
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.categoryOption, category === 'non_individual' && styles.categoryOptionActive]}
                onPress={() => setCategory('non_individual')}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="people-outline" 
                  size={16} 
                  color={category === 'non_individual' ? COLORS.emerald : COLORS.subText} 
                />
                <Text style={[styles.categoryOptionText, category === 'non_individual' && styles.categoryOptionTextActive]}>
                  Non-Individual
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── IF INDIVIDUAL ── */}
            {category === 'individual' && (
              <View style={styles.formSection}>
                {/* Search Criteria Picker */}
                <Text style={styles.inputLabel}>Search Criteria <Text style={styles.requiredStar}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => setShowCriteriaModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownText}>
                    {indivCriteria === 'nin_name_dob' && 'NIN (with Name and DOB)'}
                    {indivCriteria === 'tax_id_dob' && 'Tax ID (with DOB)'}
                    {indivCriteria === 'prev_tin_dob' && 'Previous TIN (with DOB)'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                </TouchableOpacity>

                {/* Dynamic Inputs based on Criteria */}
                {indivCriteria === 'nin_name_dob' && (
                  <>
                    <View style={styles.rowInputs}>
                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.inputLabel}>First Name <Text style={styles.requiredStar}>*</Text></Text>
                        <TextInput
                          style={styles.inputBox}
                          placeholder="Enter first name"
                          placeholderTextColor="#94a3b8"
                          value={firstName}
                          onChangeText={setFirstName}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 6 }}>
                        <Text style={styles.inputLabel}>Last Name <Text style={styles.requiredStar}>*</Text></Text>
                        <TextInput
                          style={styles.inputBox}
                          placeholder="Enter last name"
                          placeholderTextColor="#94a3b8"
                          value={lastName}
                          onChangeText={setLastName}
                        />
                      </View>
                    </View>

                    <Text style={styles.inputLabel}>National Identification Number (NIN) <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Enter 11-digit NIN"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={11}
                      value={nin}
                      onChangeText={t => setNin(t.replace(/\D/g, ''))}
                    />

                    <Text style={styles.inputLabel}>Date of Birth <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={dob}
                      onChangeText={t => formatDOBInput(t, setDob)}
                    />
                  </>
                )}

                {indivCriteria === 'tax_id_dob' && (
                  <>
                    <Text style={styles.inputLabel}>Tax ID (TIN) <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Enter Tax ID"
                      placeholderTextColor="#94a3b8"
                      value={taxId}
                      onChangeText={setTaxId}
                    />

                    <Text style={styles.inputLabel}>Date of Birth <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={dob}
                      onChangeText={t => formatDOBInput(t, setDob)}
                    />
                  </>
                )}

                {indivCriteria === 'prev_tin_dob' && (
                  <>
                    <Text style={styles.inputLabel}>Previous TIN <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Enter Previous TIN"
                      placeholderTextColor="#94a3b8"
                      value={previousTin}
                      onChangeText={setPreviousTin}
                    />

                    <Text style={styles.inputLabel}>Date of Birth <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={dob}
                      onChangeText={t => formatDOBInput(t, setDob)}
                    />
                  </>
                )}
              </View>
            )}

            {/* ── IF NON-INDIVIDUAL ── */}
            {category === 'non_individual' && (
              <View style={styles.formSection}>
                {/* Entity Type: Corporate, MDA, Cooperative */}
                <Text style={styles.inputLabel}>Entity Type <Text style={styles.requiredStar}>*</Text></Text>
                <View style={styles.entitySegment}>
                  <TouchableOpacity
                    style={[styles.entityOption, entityType === 'corporate' && styles.entityOptionActive]}
                    onPress={() => setEntityType('corporate')}
                  >
                    <Ionicons name="business-outline" size={14} color={entityType === 'corporate' ? COLORS.emerald : COLORS.subText} />
                    <Text style={[styles.entityOptionText, entityType === 'corporate' && styles.entityOptionTextActive]}>Corporate</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.entityOption, entityType === 'mda' && styles.entityOptionActive]}
                    onPress={() => setEntityType('mda')}
                  >
                    <Ionicons name="library-outline" size={14} color={entityType === 'mda' ? COLORS.emerald : COLORS.subText} />
                    <Text style={[styles.entityOptionText, entityType === 'mda' && styles.entityOptionTextActive]}>MDA</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.entityOption, entityType === 'cooperative' && styles.entityOptionActive]}
                    onPress={() => setEntityType('cooperative')}
                  >
                    <Ionicons name="people-circle-outline" size={14} color={entityType === 'cooperative' ? COLORS.emerald : COLORS.subText} />
                    <Text style={[styles.entityOptionText, entityType === 'cooperative' && styles.entityOptionTextActive]}>Cooperative</Text>
                  </TouchableOpacity>
                </View>

                {entityType === 'corporate' && (
                  <>
                    <Text style={styles.inputLabel}>Organization Type <Text style={styles.requiredStar}>*</Text></Text>
                    <TouchableOpacity 
                      style={styles.dropdownSelector} 
                      onPress={() => setShowOrgModal(true)}
                    >
                      <Text style={styles.dropdownText}>{organizationType}</Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                    </TouchableOpacity>

                    <Text style={styles.inputLabel}>CAC Registration Number <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Enter CAC Registration Number (e.g. RC123456 or BN123456)"
                      placeholderTextColor="#94a3b8"
                      value={cacRegNumber}
                      onChangeText={setCacRegNumber}
                      autoCapitalize="characters"
                    />

                    <Text style={styles.inputLabel}>Date of Incorporation <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={dateOfIncorporation}
                      onChangeText={t => formatDOBInput(t, setDateOfIncorporation)}
                    />
                  </>
                )}

                {entityType === 'mda' && (
                  <>
                    <Text style={styles.inputLabel}>MDA Registered Name <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Enter Official MDA Registered Name"
                      placeholderTextColor="#94a3b8"
                      value={registeredName}
                      onChangeText={setRegisteredName}
                    />
                  </>
                )}

                {entityType === 'cooperative' && (
                  <>
                    <Text style={styles.inputLabel}>Cooperative Society Name <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Enter Full Cooperative Society Name"
                      placeholderTextColor="#94a3b8"
                      value={registeredName}
                      onChangeText={setRegisteredName}
                    />
                  </>
                )}
              </View>
            )}

            {/* Recipient Phone & Email for delivery */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>WhatsApp / Contact Phone <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={styles.inputBox}
                placeholder="08012345678"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={11}
                value={contactPhone}
                onChangeText={setContactPhone}
              />

              <Text style={styles.inputLabel}>Delivery Email (Optional)</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="example@mail.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={contactEmail}
                onChangeText={setContactEmail}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRetrieveCertificate}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="search" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>
                    Search & Retrieve Certificate (₦{retrievalPrice.toLocaleString()})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: REGISTER NEW TIN (INDIVIDUAL & BUSINESS)           */}
        {/* ========================================================= */}
        {activeTab === 'register' && (
          <View style={styles.card}>
            <View style={styles.portalBadge}>
              <View style={styles.govPill}>
                <Ionicons name="create" size={14} color={COLORS.emerald} />
                <Text style={styles.govPillText}>Official New TIN Enrollment</Text>
              </View>
              <Text style={styles.portalFee}>Fee: ₦{registrationPrice.toLocaleString()}</Text>
            </View>

            <Text style={styles.sectionHeaderTitle}>Register New Tax ID (TIN)</Text>
            <Text style={styles.sectionHeaderDesc}>
              Enroll and obtain an official Joint Tax Board (JTB) Tax Identification Number for banking, CAC, and government clearance.
            </Text>

            {/* Category Segment */}
            <Text style={styles.inputLabel}>Registration Type <Text style={styles.requiredStar}>*</Text></Text>
            <View style={styles.categorySegment}>
              <TouchableOpacity
                style={[styles.categoryOption, regCategory === 'individual' && styles.categoryOptionActive]}
                onPress={() => setRegCategory('individual')}
              >
                <Ionicons name="person-outline" size={16} color={regCategory === 'individual' ? COLORS.emerald : COLORS.subText} />
                <Text style={[styles.categoryOptionText, regCategory === 'individual' && styles.categoryOptionTextActive]}>
                  Individual TIN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.categoryOption, regCategory === 'business' && styles.categoryOptionActive]}
                onPress={() => setRegCategory('business')}
              >
                <Ionicons name="briefcase-outline" size={16} color={regCategory === 'business' ? COLORS.emerald : COLORS.subText} />
                <Text style={[styles.categoryOptionText, regCategory === 'business' && styles.categoryOptionTextActive]}>
                  Business TIN
                </Text>
              </TouchableOpacity>
            </View>

            {/* Individual Form */}
            {regCategory === 'individual' && (
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>Full Name (As on NIN) <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Sani Muhammad Bello"
                  placeholderTextColor="#94a3b8"
                  value={regFullName}
                  onChangeText={setRegFullName}
                />

                <Text style={styles.inputLabel}>National Identification Number (NIN) <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="11-digit NIN"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={11}
                  value={regNin}
                  onChangeText={t => setRegNin(t.replace(/\D/g, ''))}
                />

                <Text style={styles.inputLabel}>Date of Birth <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={regDob}
                  onChangeText={t => formatDOBInput(t, setRegDob)}
                />

                <Text style={styles.inputLabel}>Phone Number <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="08012345678"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={regPhone}
                  onChangeText={setRegPhone}
                />

                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="example@mail.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                />

                <Text style={styles.inputLabel}>State of Origin <Text style={styles.requiredStar}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => setShowStateModal(true)}
                >
                  <Text style={styles.dropdownText}>{regState || 'Select State'}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                </TouchableOpacity>

                {availableLgas.length > 0 && (
                  <>
                    <Text style={styles.inputLabel}>LGA <Text style={styles.requiredStar}>*</Text></Text>
                    <TouchableOpacity 
                      style={styles.dropdownSelector} 
                      onPress={() => setShowLgaModal(true)}
                    >
                      <Text style={styles.dropdownText}>{regLga || 'Select LGA'}</Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                    </TouchableOpacity>
                  </>
                )}

                <Text style={styles.inputLabel}>Residential Address <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={[styles.inputBox, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Enter full home address"
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={regAddress}
                  onChangeText={setRegAddress}
                />

                <Text style={styles.inputLabel}>Occupation / Business</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Trader, Civil Servant, Freelancer"
                  placeholderTextColor="#94a3b8"
                  value={regOccupation}
                  onChangeText={setRegOccupation}
                />
              </View>
            )}

            {/* Business Form */}
            {regCategory === 'business' && (
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>Business / Company Name <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Abu Mafhal Enterprises Limited"
                  placeholderTextColor="#94a3b8"
                  value={regBusinessName}
                  onChangeText={setRegBusinessName}
                />

                <Text style={styles.inputLabel}>CAC Registration Number (RC / BN) <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. RC1234567 or BN987654"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  value={regCacNumber}
                  onChangeText={setRegCacNumber}
                />

                <Text style={styles.inputLabel}>Date of Incorporation <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={regIncorpDate}
                  onChangeText={t => formatDOBInput(t, setRegIncorpDate)}
                />

                <Text style={styles.inputLabel}>Director / Owner NIN <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="11-digit NIN"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={11}
                  value={regDirectorNin}
                  onChangeText={t => setRegDirectorNin(t.replace(/\D/g, ''))}
                />

                <Text style={styles.inputLabel}>Contact Phone Number <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="08012345678"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={regPhone}
                  onChangeText={setRegPhone}
                />

                <Text style={styles.inputLabel}>Official Business Email</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="contact@company.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                />

                <Text style={styles.inputLabel}>Business Operating State <Text style={styles.requiredStar}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => setShowStateModal(true)}
                >
                  <Text style={styles.dropdownText}>{regState || 'Select State'}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Registered Office Address <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={[styles.inputBox, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Enter full registered business office address"
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={regAddress}
                  onChangeText={setRegAddress}
                />
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRegisterNewTIN}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-done-circle" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>
                    Register & Generate TIN (₦{registrationPrice.toLocaleString()})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MY REQUESTS & DOWNLOAD CERTIFICATE                 */}
        {/* ========================================================= */}
        {activeTab === 'history' && (
          <View style={{ gap: 12 }}>
            {historyList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={48} color={COLORS.subText} />
                <Text style={styles.emptyTitle}>No TIN Requests Found</Text>
                <Text style={styles.emptySubtitle}>
                  You have not submitted any TIN registration or Tax ID certificate retrieval requests yet.
                </Text>
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => setActiveTab('retrieve')}
                >
                  <Text style={styles.emptyButtonText}>Retrieve Tax ID Certificate</Text>
                </TouchableOpacity>
              </View>
            ) : (
              historyList.map(item => {
                const details = item.details || {};
                const status = (details.status || 'PENDING').toUpperCase();
                const certUrl = details.certificate_url || details.file_url;
                const issuedTin = details.generated_tin || details.retrieved_tin || details.taxId;

                return (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyHolderName}>{item.holder_name}</Text>
                        <Text style={styles.historyServiceType}>
                          {item.service_type === 'tin_certificate_retrieval' ? '📄 Tax ID Certificate' : '✍️ New TIN Registration'}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      <View style={[
                        styles.statusBadge,
                        status === 'COMPLETED' ? styles.statusCompleted :
                        status === 'PROCESSING' ? styles.statusProcessing :
                        status === 'REJECTED' ? styles.statusRejected : styles.statusPending
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          status === 'COMPLETED' ? styles.statusCompletedText :
                          status === 'PROCESSING' ? styles.statusProcessingText :
                          status === 'REJECTED' ? styles.statusRejectedText : styles.statusPendingText
                        ]}>
                          {status}
                        </Text>
                      </View>
                    </View>

                    {/* Details Rows */}
                    <View style={styles.historyDetailsBox}>
                      <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Reference:</Text>
                        <Text style={styles.historyValue}>{item.search_number}</Text>
                      </View>

                      {issuedTin ? (
                        <View style={styles.historyRow}>
                          <Text style={styles.historyLabel}>Tax ID (TIN):</Text>
                          <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={() => copyToClipboard(issuedTin, 'Tax Identification Number (TIN)')}
                          >
                            <Text style={[styles.historyValue, { color: COLORS.emerald, fontWeight: '700' }]}>
                              {issuedTin}
                            </Text>
                            <Ionicons name="copy-outline" size={14} color={COLORS.emerald} />
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      <View style={styles.historyRow}>
                        <Text style={styles.historyLabel}>Date Submitted:</Text>
                        <Text style={styles.historyValue}>
                          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>

                      {details.admin_notes ? (
                        <View style={styles.adminNoteBox}>
                          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
                          <Text style={styles.adminNoteText}>{details.admin_notes}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Actions */}
                    <View style={styles.historyActions}>
                      {certUrl ? (
                        <TouchableOpacity
                          style={styles.downloadButton}
                          onPress={async () => {
                            try {
                              await WebBrowser.openBrowserAsync(certUrl);
                            } catch (_) {
                              Linking.openURL(certUrl);
                            }
                          }}
                        >
                          <Ionicons name="cloud-download-outline" size={16} color={COLORS.white} />
                          <Text style={styles.downloadButtonText}>Download Certificate PDF</Text>
                        </TouchableOpacity>
                      ) : status === 'PENDING' || status === 'PROCESSING' ? (
                        <View style={styles.processingNote}>
                          <Ionicons name="time" size={14} color={COLORS.warning} />
                          <Text style={styles.processingNoteText}>
                            Processing with JTB tax desk... Certificate will appear here.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ── MODAL: INDIVIDUAL CRITERIA SELECTOR ── */}
      <Modal visible={showCriteriaModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Search Criteria</Text>
              <TouchableOpacity onPress={() => setShowCriteriaModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { setIndivCriteria('nin_name_dob'); setShowCriteriaModal(false); }}
            >
              <Text style={[styles.modalOptionText, indivCriteria === 'nin_name_dob' && styles.modalOptionTextActive]}>
                NIN (with Name and DOB)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { setIndivCriteria('tax_id_dob'); setShowCriteriaModal(false); }}
            >
              <Text style={[styles.modalOptionText, indivCriteria === 'tax_id_dob' && styles.modalOptionTextActive]}>
                Tax ID (with DOB)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { setIndivCriteria('prev_tin_dob'); setShowCriteriaModal(false); }}
            >
              <Text style={[styles.modalOptionText, indivCriteria === 'prev_tin_dob' && styles.modalOptionTextActive]}>
                Previous TIN (with DOB)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: ORGANIZATION TYPE ── */}
      <Modal visible={showOrgModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Organization Type</Text>
              <TouchableOpacity onPress={() => setShowOrgModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {ORG_TYPES.map(org => (
                <TouchableOpacity
                  key={org}
                  style={styles.modalOption}
                  onPress={() => { setOrganizationType(org); setShowOrgModal(false); }}
                >
                  <Text style={[styles.modalOptionText, organizationType === org && styles.modalOptionTextActive]}>
                    {org}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: STATE OF ORIGIN ── */}
      <Modal visible={showStateModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {STATE_LIST.map(st => (
                <TouchableOpacity
                  key={st}
                  style={styles.modalOption}
                  onPress={() => { setRegState(st); setRegLga(''); setShowStateModal(false); }}
                >
                  <Text style={[styles.modalOptionText, regState === st && styles.modalOptionTextActive]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: LGA ── */}
      <Modal visible={showLgaModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select LGA in {regState}</Text>
              <TouchableOpacity onPress={() => setShowLgaModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {availableLgas.map(l => (
                <TouchableOpacity
                  key={l}
                  style={styles.modalOption}
                  onPress={() => { setRegLga(l); setShowLgaModal(false); }}
                >
                  <Text style={[styles.modalOptionText, regLga === l && styles.modalOptionTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.subText,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  walletText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: COLORS.navy,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  activeTabText: {
    color: COLORS.white,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  govPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  govPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  portalFee: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gold,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
  },
  sectionHeaderDesc: {
    fontSize: 12,
    color: COLORS.subText,
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 8,
  },
  requiredStar: {
    color: COLORS.danger,
  },
  categorySegment: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    padding: 3,
    marginBottom: 12,
  },
  categoryOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  categoryOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subText,
  },
  categoryOptionTextActive: {
    color: COLORS.emerald,
    fontWeight: '700',
  },
  entitySegment: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  entityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  entityOptionActive: {
    backgroundColor: COLORS.emeraldLight,
    borderColor: COLORS.emerald,
  },
  entityOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.subText,
  },
  entityOptionTextActive: {
    color: COLORS.emerald,
    fontWeight: '700',
  },
  formSection: {
    gap: 4,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  inputBox: {
    height: 46,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.emerald,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: COLORS.emerald,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyButton: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyHolderName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
  },
  historyServiceType: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPending: { backgroundColor: COLORS.warningBg },
  statusPendingText: { color: COLORS.warning, fontSize: 10, fontWeight: '700' },
  statusProcessing: { backgroundColor: COLORS.infoBg },
  statusProcessingText: { color: COLORS.info, fontSize: 10, fontWeight: '700' },
  statusCompleted: { backgroundColor: COLORS.successBg },
  statusCompletedText: { color: COLORS.success, fontSize: 10, fontWeight: '700' },
  statusRejected: { backgroundColor: COLORS.dangerBg },
  statusRejectedText: { color: COLORS.danger, fontSize: 10, fontWeight: '700' },
  historyDetailsBox: {
    paddingVertical: 10,
    gap: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLabel: {
    fontSize: 12,
    color: COLORS.subText,
  },
  historyValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.infoBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  adminNoteText: {
    fontSize: 11,
    color: COLORS.info,
    flex: 1,
  },
  historyActions: {
    marginTop: 6,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.emerald,
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  processingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 6,
  },
  processingNoteText: {
    fontSize: 11,
    color: '#b45309',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    fontSize: 13,
    color: COLORS.text,
  },
  modalOptionTextActive: {
    color: COLORS.emerald,
    fontWeight: '700',
  },
});

