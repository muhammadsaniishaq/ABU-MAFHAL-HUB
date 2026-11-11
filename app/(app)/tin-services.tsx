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

// Search criteria types
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
  // TAB 1: RETRIEVE TAX ID CERTIFICATE STATE
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
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Modals & Selection States
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showLgaModal, setShowLgaModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [lgaSearchQuery, setLgaSearchQuery] = useState('');

  // ── IN-APP SUBMISSION & CONFIRMATION MODALS (Replaces Broken Alert.alert) ──
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    type: 'retrieval' | 'registration';
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
    type: string;
  } | null>(null);

  const [insufficientModalVisible, setInsufficientModalVisible] = useState(false);
  const [insufficientRequiredFee, setInsufficientRequiredFee] = useState(0);

  // Filtered States based on search query
  const filteredStateList = useMemo(() => {
    if (!stateSearchQuery.trim()) return STATE_LIST;
    const q = stateSearchQuery.toLowerCase().trim();
    return STATE_LIST.filter(s => s.toLowerCase().includes(q));
  }, [stateSearchQuery]);

  // Available & Filtered LGAs for selected state
  const availableLgas = useMemo(() => {
    if (!regState) return [];
    return (NIGERIA_STATES as Record<string, string[]>)[regState] || [];
  }, [regState]);

  const filteredLgaList = useMemo(() => {
    if (!lgaSearchQuery.trim()) return availableLgas;
    const q = lgaSearchQuery.toLowerCase().trim();
    return availableLgas.filter(l => l.toLowerCase().includes(q));
  }, [availableLgas, lgaSearchQuery]);

  // Filtered History list
  const filteredHistory = useMemo(() => {
    return historyList.filter(item => {
      const details = item.details || {};
      const status = (details.status || 'PENDING').toUpperCase();

      // Status Filter
      if (historyFilter === 'pending' && status !== 'PENDING' && status !== 'PROCESSING') {
        return false;
      }
      if (historyFilter === 'completed' && status !== 'COMPLETED') {
        return false;
      }

      // Search Filter
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const holder = (item.holder_name || '').toLowerCase();
        const ref = (item.search_number || '').toLowerCase();
        const tin = (details.generated_tin || details.retrieved_tin || details.taxId || '').toLowerCase();
        return holder.includes(q) || ref.includes(q) || tin.includes(q);
      }

      return true;
    });
  }, [historyList, historyFilter, historySearch]);

  // Bottom padding clearance calculation to guarantee buttons NEVER hide behind bottom bars
  const bottomClearance = Math.max(insets.bottom, 24) + 120;

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

  // Copy helper
  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('An Kwafi 📋', `${label} an kwafa cikin clipboard din ku.`);
  };

  // WhatsApp Support Helper
  const openWhatsAppSupport = (customText?: string) => {
    const msg = customText || 'Barka da rana, ina neman karin bayani dangane da Tax ID (TIN) a Abu Mafhal Hub.';
    const url = `https://wa.me/2349065645747?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert('Notice', 'Ba a iya bude WhatsApp ba.'));
  };

  // -------------------------------------------------------------
  // INITIATE: RETRIEVE TAX ID CERTIFICATE
  // -------------------------------------------------------------
  const handleRetrieveCertificate = () => {
    // 1. Validation
    if (category === 'individual') {
      if (indivCriteria === 'nin_name_dob') {
        if (!firstName.trim()) return Alert.alert('Ana Bukata', 'Da fatan a shigar da Sunan Farko (First Name).');
        if (!lastName.trim()) return Alert.alert('Ana Bukata', 'Da fatan a shigar da Sunan Karshe (Last Name).');
        if (nin.replace(/\D/g, '').length !== 11) return Alert.alert('Lambar NIN Ba Daidai Ba', 'Lambar NIN ta zama dole ta kasance lambobi 11 ne kacal.');
        if (dob.length < 10) return Alert.alert('Ranar Haihuwa', 'Shigar da Ranar Haihuwa a tsarin DD/MM/YYYY.');
      } else if (indivCriteria === 'tax_id_dob') {
        if (!taxId.trim()) return Alert.alert('Ana Bukata', 'Shigar da Lambar Haraji (Tax ID / TIN).');
        if (dob.length < 10) return Alert.alert('Ranar Haihuwa', 'Shigar da Ranar Haihuwa a tsarin DD/MM/YYYY.');
      } else if (indivCriteria === 'prev_tin_dob') {
        if (!previousTin.trim()) return Alert.alert('Ana Bukata', 'Shigar da Lambar TIN ta baya.');
        if (dob.length < 10) return Alert.alert('Ranar Haihuwa', 'Shigar da Ranar Haihuwa a tsarin DD/MM/YYYY.');
      }
    } else {
      // Non-individual
      if (entityType === 'corporate') {
        if (!cacRegNumber.trim()) return Alert.alert('Ana Bukata', 'Shigar da Lambar Rijistar CAC (misali RC123456 ko BN123456).');
        if (dateOfIncorporation.length < 10) return Alert.alert('Ranar Rijista', 'Shigar da Ranar Rijistar Kamfani (DD/MM/YYYY).');
      } else if (entityType === 'mda') {
        if (!registeredName.trim()) return Alert.alert('Ana Bukata', 'Shigar da Cikakken Sunan Hukuma (MDA).');
      } else {
        if (!registeredName.trim()) return Alert.alert('Ana Bukata', 'Shigar da Sunan Kungiyar Hadin Kai (Cooperative).');
      }
    }

    if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 11) {
      return Alert.alert('Lambar Waya', 'Da fatan a shigar da lambar waya/WhatsApp mai lambobi 11.');
    }

    // 2. Wallet Balance Check
    const currentBal = walletBalance || 0;
    if (currentBal < retrievalPrice) {
      setInsufficientRequiredFee(retrievalPrice);
      setInsufficientModalVisible(true);
      return;
    }

    // 3. Prepare In-App Confirmation (No broken browser Alert.alert)
    const searchNumber = category === 'individual'
      ? (indivCriteria === 'nin_name_dob' ? nin.trim() : (indivCriteria === 'tax_id_dob' ? taxId.trim() : previousTin.trim()))
      : (entityType === 'corporate' ? cacRegNumber.trim() : registeredName.trim());

    const holderName = category === 'individual'
      ? `${firstName.trim()} ${lastName.trim()}`
      : (entityType === 'corporate' ? `${organizationType} (${cacRegNumber})` : registeredName.trim());

    setConfirmData({
      type: 'retrieval',
      title: 'Binciko Tax ID Certificate',
      applicantName: holderName,
      referenceNumber: searchNumber,
      fee: retrievalPrice,
      onConfirm: async () => {
        setLoading(true);
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (!userId) throw new Error('Ba a samu shiga ba. Da fatan a sake yin login.');

          // 1. Strict Live Database Balance Verification
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
            throw new Error(`Kudin da ke wallet dinka bai isa ba. Kana da ₦${liveBal.toLocaleString()} ne kacal.`);
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
            throw new Error('Cire kudi ya faskara: Kudin wallet dinka bai isa ba ko an samu tsaiko.');
          }

          setWalletBalance(newBal);

          // 3. Create transaction record
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

          // 4. Save task to verification_history for admin manual fulfillment
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

          setConfirmModalVisible(false);
          setSuccessData({
            holderName,
            ref: searchNumber,
            fee: retrievalPrice,
            type: 'Tax ID Certificate Retrieval'
          });
          setSuccessModalVisible(true);
          fetchHistory();
        } catch (err: any) {
          Alert.alert('Kuskure Wajen Tura Aiki', err.message || 'An samu matsala wajen tura bukatar.');
        } finally {
          setLoading(false);
        }
      }
    });
    setConfirmModalVisible(true);
  };

  // -------------------------------------------------------------
  // INITIATE: REGISTER NEW TIN
  // -------------------------------------------------------------
  const handleRegisterNewTIN = () => {
    if (regCategory === 'individual') {
      if (!regFullName.trim()) return Alert.alert('Ana Bukata', 'Shigar da Cikakken Suna kamar yadda yake a jikin NIN.');
      if (regNin.replace(/\D/g, '').length !== 11) return Alert.alert('Lambar NIN Ba Daidai Ba', 'Lambar NIN ta zama dole ta kasance lambobi 11 ne kacal.');
      if (regDob.length < 10) return Alert.alert('Ranar Haihuwa', 'Shigar da Ranar Haihuwa (DD/MM/YYYY).');
      if (regPhone.replace(/\D/g, '').length < 11) return Alert.alert('Lambar Waya', 'Shigar da lambar waya mai lambobi 11.');
      if (!regState) return Alert.alert('Jihar Asali', 'Zabi Jihar Asali daga jerin jihohi.');
      if (!regAddress.trim()) return Alert.alert('Adireshin Gida', 'Shigar da cikakken adireshin gida.');
    } else {
      // Business
      if (!regBusinessName.trim()) return Alert.alert('Ana Bukata', 'Shigar da Sunan Kasuwanci ko Kamfani.');
      if (!regCacNumber.trim()) return Alert.alert('Ana Bukata', 'Shigar da Lambar Rijistar CAC (RC ko BN).');
      if (regIncorpDate.length < 10) return Alert.alert('Ranar Rijista', 'Shigar da Ranar Rijistar Kamfani (DD/MM/YYYY).');
      if (regDirectorNin.replace(/\D/g, '').length !== 11) return Alert.alert('NIN na Mai Kamfani', 'Shigar da lambar NIN mai lambobi 11 ta Daraktan kamfani.');
      if (!regState) return Alert.alert('Jihar Kasuwanci', 'Zabi jihar da kasuwancin ke gudana.');
      if (!regAddress.trim()) return Alert.alert('Adireshin Kasuwanci', 'Shigar da adireshin ofishin kamfani.');
    }

    const currentBal = walletBalance || 0;
    if (currentBal < registrationPrice) {
      setInsufficientRequiredFee(registrationPrice);
      setInsufficientModalVisible(true);
      return;
    }

    const applicantName = regCategory === 'individual' ? regFullName.trim() : regBusinessName.trim();
    const primaryId = regCategory === 'individual' ? regNin.trim() : regCacNumber.trim();

    setConfirmData({
      type: 'registration',
      title: 'Rijistar Sabuwar TIN',
      applicantName,
      referenceNumber: primaryId,
      fee: registrationPrice,
      onConfirm: async () => {
        setLoading(true);
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (!userId) throw new Error('Ba a samu shiga ba. Da fatan a sake login.');

          // 1. Strict Live Database Balance Verification
          const { data: liveProfile, error: profileErr } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

          if (profileErr || !liveProfile) {
            throw new Error('Ba a iya tabbatar da kudin wallet ba.');
          }

          const liveBal = Number(liveProfile.balance || 0);
          if (liveBal < registrationPrice) {
            setWalletBalance(liveBal);
            throw new Error(`Kudin da ke wallet dinka bai isa ba. Kana da ₦${liveBal.toLocaleString()} ne kacal.`);
          }

          // 2. Strict Atomic Debit
          const newBal = liveBal - registrationPrice;
          const { data: updateRes, error: balErr } = await supabase
            .from('profiles')
            .update({ balance: newBal })
            .eq('id', userId)
            .gte('balance', registrationPrice)
            .select();

          if (balErr || !updateRes || updateRes.length === 0) {
            throw new Error('Cire kudi ya faskara: Kudin wallet dinka bai isa ba ko an samu tsaiko.');
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

          setConfirmModalVisible(false);
          setSuccessData({
            holderName: applicantName,
            ref: primaryId,
            fee: registrationPrice,
            type: 'New TIN Registration'
          });
          setSuccessModalVisible(true);
          fetchHistory();
        } catch (err: any) {
          Alert.alert('Kuskure Wajen Rijista', err.message || 'An samu matsala wajen tura rijista.');
        } finally {
          setLoading(false);
        }
      }
    });
    setConfirmModalVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
        </TouchableOpacity>

        <View style={{ flex: 1, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>TIN & Tax ID Portal</Text>
            <View style={styles.headerVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.emerald} />
              <Text style={styles.headerVerifiedText}>Official</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Joint Revenue Board (JRB / JTB) Tax Services
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.walletBadge, (walletBalance || 0) < 1500 && styles.walletBadgeLow]} 
          onPress={() => router.push('/wallet')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="wallet-outline" 
            size={14} 
            color={(walletBalance || 0) < 1500 ? COLORS.gold : COLORS.emerald} 
          />
          <View>
            <Text style={[styles.walletText, (walletBalance || 0) < 1500 && styles.walletTextLow]}>
              ₦{walletBalance !== null ? walletBalance.toLocaleString() : '---'}
            </Text>
            <Text style={styles.walletFundHint}>+ Saka Kudi</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── HERO BANNER ── */}
      <View style={styles.heroWrapper}>
        <LinearGradient
          colors={['#071026', '#0f2347', '#083344']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroLeft}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroPill}>
                <Ionicons name="shield-checkmark" size={12} color="#34d399" />
                <Text style={styles.heroPillText}>JTB & FIRS Direct Desk</Text>
              </View>
              <View style={[styles.heroPill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <Ionicons name="flash" size={11} color="#fbbf24" />
                <Text style={[styles.heroPillText, { color: '#fbbf24' }]}>Quick Fulfillment</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Binciko ko Rijistar Tax ID (TIN)</Text>
            <Text style={styles.heroDesc}>
              Bukatarka za ta je kai tsaye zuwa ofishin kula da haraji. Da zarar an kammala za ku sauke (Download) PDF takardarku anan nan take.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.heroHelpBtn}
            onPress={() => openWhatsAppSupport()}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            <Text style={styles.heroHelpBtnText}>Taimako</Text>
          </TouchableOpacity>
        </LinearGradient>
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
            size={15} 
            color={activeTab === 'retrieve' ? COLORS.white : COLORS.subText} 
          />
          <Text style={[styles.tabText, activeTab === 'retrieve' && styles.activeTabText]}>
            Binciko Certificate
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'register' && styles.activeTabButton]}
          onPress={() => setActiveTab('register')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="create-outline" 
            size={15} 
            color={activeTab === 'register' ? COLORS.white : COLORS.subText} 
          />
          <Text style={[styles.tabText, activeTab === 'register' && styles.activeTabText]}>
            Rijistar Sabuwar TIN
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
          onPress={() => { setActiveTab('history'); fetchHistory(); }}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="time-outline" 
            size={15} 
            color={activeTab === 'history' ? COLORS.white : COLORS.subText} 
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            Ayyukana
          </Text>
          {historyList.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'history' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'history' && styles.tabBadgeTextActive]}>
                {historyList.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── TAB CONTENT ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => { fetchUserData(); fetchHistory(); }}
              tintColor={COLORS.emerald}
            />
          }
        >
          {/* ========================================================= */}
          {/* TAB 1: RETRIEVE TAX ID CERTIFICATE                        */}
          {/* ========================================================= */}
          {activeTab === 'retrieve' && (
            <View style={styles.card}>
              <View style={styles.portalBadge}>
                <View style={styles.govPill}>
                  <Ionicons name="shield-checkmark" size={13} color={COLORS.emerald} />
                  <Text style={styles.govPillText}>Official JTB Retrieval</Text>
                </View>
                <View style={styles.feeBadge}>
                  <Text style={styles.feeLabel}>Kudin Aiki:</Text>
                  <Text style={styles.portalFee}>₦{retrievalPrice.toLocaleString()}</Text>
                </View>
              </View>

              <Text style={styles.sectionHeaderTitle}>Neman Takardar Tax ID Certificate</Text>
              <Text style={styles.sectionHeaderDesc}>
                Shigar da bayananku don nemo lambar TIN da fitar da ingantacciyar takardar shaida (Certificate PDF).
              </Text>

              {/* Category: Individual vs Non-Individual */}
              <Text style={styles.inputLabel}>
                Rukuni (Category) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.categorySegment}>
                <TouchableOpacity
                  style={[styles.categoryOption, category === 'individual' && styles.categoryOptionActive]}
                  onPress={() => setCategory('individual')}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name="person" 
                    size={15} 
                    color={category === 'individual' ? COLORS.emerald : COLORS.subText} 
                  />
                  <Text style={[styles.categoryOptionText, category === 'individual' && styles.categoryOptionTextActive]}>
                    Mutum Daya (Individual)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.categoryOption, category === 'non_individual' && styles.categoryOptionActive]}
                  onPress={() => setCategory('non_individual')}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name="business" 
                    size={15} 
                    color={category === 'non_individual' ? COLORS.emerald : COLORS.subText} 
                  />
                  <Text style={[styles.categoryOptionText, category === 'non_individual' && styles.categoryOptionTextActive]}>
                    Kamfani / Kungiya
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── IF INDIVIDUAL ── */}
              {category === 'individual' && (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>
                    Hanyar Bincike (Search Criteria) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity 
                    style={styles.dropdownSelector} 
                    onPress={() => setShowCriteriaModal(true)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Ionicons name="filter-circle-outline" size={18} color={COLORS.emerald} />
                      <Text style={styles.dropdownText}>
                        {indivCriteria === 'nin_name_dob' && 'NIN (Tare da Suna da Ranar Haihuwa)'}
                        {indivCriteria === 'tax_id_dob' && 'Tax ID / TIN (Tare da Ranar Haihuwa)'}
                        {indivCriteria === 'prev_tin_dob' && 'Lambar TIN Ta Baya (Previous TIN)'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                  </TouchableOpacity>

                  {/* Dynamic Inputs based on Criteria */}
                  {indivCriteria === 'nin_name_dob' && (
                    <>
                      <View style={styles.rowInputs}>
                        <View style={{ flex: 1, marginRight: 6 }}>
                          <Text style={styles.inputLabel}>
                            Sunan Farko <Text style={styles.requiredStar}>*</Text>
                          </Text>
                          <View style={styles.inputWithIcon}>
                            <Ionicons name="person-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                            <TextInput
                              style={styles.inputBoxField}
                              placeholder="First Name"
                              placeholderTextColor={COLORS.mutedText}
                              value={firstName}
                              onChangeText={setFirstName}
                            />
                          </View>
                        </View>
                        <View style={{ flex: 1, marginLeft: 6 }}>
                          <Text style={styles.inputLabel}>
                            Sunan Karshe <Text style={styles.requiredStar}>*</Text>
                          </Text>
                          <View style={styles.inputWithIcon}>
                            <Ionicons name="person-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                            <TextInput
                              style={styles.inputBoxField}
                              placeholder="Last Name"
                              placeholderTextColor={COLORS.mutedText}
                              value={lastName}
                              onChangeText={setLastName}
                            />
                          </View>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.inputLabel}>
                          Lambar NIN <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <Text style={[styles.charCounter, nin.replace(/\D/g, '').length === 11 && styles.charCounterFull]}>
                          {nin.replace(/\D/g, '').length}/11 lambobi
                        </Text>
                      </View>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="finger-print-outline" size={18} color={COLORS.emerald} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="Shigar da lambobin NIN 11"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="number-pad"
                          maxLength={11}
                          value={nin}
                          onChangeText={t => setNin(t.replace(/\D/g, ''))}
                        />
                      </View>

                      <Text style={styles.inputLabel}>
                        Ranar Haihuwa (DOB) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="calendar-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="DD/MM/YYYY"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="number-pad"
                          maxLength={10}
                          value={dob}
                          onChangeText={t => formatDOBInput(t, setDob)}
                        />
                      </View>
                    </>
                  )}

                  {indivCriteria === 'tax_id_dob' && (
                    <>
                      <Text style={styles.inputLabel}>
                        Lambar Tax ID (TIN) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="barcode-outline" size={18} color={COLORS.emerald} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="Shigar da Tax ID / TIN"
                          placeholderTextColor={COLORS.mutedText}
                          value={taxId}
                          onChangeText={setTaxId}
                        />
                      </View>

                      <Text style={styles.inputLabel}>
                        Ranar Haihuwa (DOB) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="calendar-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="DD/MM/YYYY"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="number-pad"
                          maxLength={10}
                          value={dob}
                          onChangeText={t => formatDOBInput(t, setDob)}
                        />
                      </View>
                    </>
                  )}

                  {indivCriteria === 'prev_tin_dob' && (
                    <>
                      <Text style={styles.inputLabel}>
                        Lambar TIN Ta Baya <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="time-outline" size={18} color={COLORS.emerald} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="Shigar da Previous TIN"
                          placeholderTextColor={COLORS.mutedText}
                          value={previousTin}
                          onChangeText={setPreviousTin}
                        />
                      </View>

                      <Text style={styles.inputLabel}>
                        Ranar Haihuwa (DOB) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="calendar-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="DD/MM/YYYY"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="number-pad"
                          maxLength={10}
                          value={dob}
                          onChangeText={t => formatDOBInput(t, setDob)}
                        />
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* ── IF NON-INDIVIDUAL ── */}
              {category === 'non_individual' && (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>
                    Nau'in Kungiya ko Kamfani (Entity Type) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.entitySegment}>
                    <TouchableOpacity
                      style={[styles.entityOption, entityType === 'corporate' && styles.entityOptionActive]}
                      onPress={() => setEntityType('corporate')}
                    >
                      <Ionicons name="business" size={14} color={entityType === 'corporate' ? COLORS.emerald : COLORS.subText} />
                      <Text style={[styles.entityOptionText, entityType === 'corporate' && styles.entityOptionTextActive]}>
                        Corporate
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.entityOption, entityType === 'mda' && styles.entityOptionActive]}
                      onPress={() => setEntityType('mda')}
                    >
                      <Ionicons name="library" size={14} color={entityType === 'mda' ? COLORS.emerald : COLORS.subText} />
                      <Text style={[styles.entityOptionText, entityType === 'mda' && styles.entityOptionTextActive]}>
                        MDA (Hukuma)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.entityOption, entityType === 'cooperative' && styles.entityOptionActive]}
                      onPress={() => setEntityType('cooperative')}
                    >
                      <Ionicons name="people" size={14} color={entityType === 'cooperative' ? COLORS.emerald : COLORS.subText} />
                      <Text style={[styles.entityOptionText, entityType === 'cooperative' && styles.entityOptionTextActive]}>
                        Cooperative
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {entityType === 'corporate' && (
                    <>
                      <Text style={styles.inputLabel}>
                        Tsarin Kamfani <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TouchableOpacity 
                        style={styles.dropdownSelector} 
                        onPress={() => setShowOrgModal(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dropdownText} numberOfLines={1}>{organizationType}</Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                      </TouchableOpacity>

                      <Text style={styles.inputLabel}>
                        Lambar Rijistar CAC (RC / BN) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="briefcase-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="misali RC1234567 ko BN987654"
                          placeholderTextColor={COLORS.mutedText}
                          value={cacRegNumber}
                          onChangeText={setCacRegNumber}
                          autoCapitalize="characters"
                        />
                      </View>

                      <Text style={styles.inputLabel}>
                        Ranar Rijista (Date of Incorporation) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="calendar-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="DD/MM/YYYY"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="number-pad"
                          maxLength={10}
                          value={dateOfIncorporation}
                          onChangeText={t => formatDOBInput(t, setDateOfIncorporation)}
                        />
                      </View>
                    </>
                  )}

                  {entityType === 'mda' && (
                    <>
                      <Text style={styles.inputLabel}>
                        Sunan Hukuma (MDA Name) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="business-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="Cikakken sunan ma'aikata ko hukuma"
                          placeholderTextColor={COLORS.mutedText}
                          value={registeredName}
                          onChangeText={setRegisteredName}
                        />
                      </View>
                    </>
                  )}

                  {entityType === 'cooperative' && (
                    <>
                      <Text style={styles.inputLabel}>
                        Sunan Kungiyar Hadin Kai (Cooperative) <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons name="people-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputBoxField}
                          placeholder="Cikakken sunan kungiya"
                          placeholderTextColor={COLORS.mutedText}
                          value={registeredName}
                          onChangeText={setRegisteredName}
                        />
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Recipient Phone & Email for delivery */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputLabel}>
                  Lambar Waya / WhatsApp (Domin Tura Bayani) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputBoxField}
                    placeholder="08012345678"
                    placeholderTextColor={COLORS.mutedText}
                    keyboardType="phone-pad"
                    maxLength={11}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                  />
                </View>

                <Text style={styles.inputLabel}>Email (Na Zabi)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputBoxField}
                    placeholder="example@mail.com"
                    placeholderTextColor={COLORS.mutedText}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={contactEmail}
                    onChangeText={setContactEmail}
                  />
                </View>
              </View>

              {/* Order Summary Box */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Kudin Binciko Certificate:</Text>
                  <Text style={styles.summaryValue}>₦{retrievalPrice.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Kudin Da Ke Asusu (Wallet):</Text>
                  <Text style={[styles.summaryValue, { color: (walletBalance || 0) < retrievalPrice ? COLORS.danger : COLORS.emerald }]}>
                    ₦{(walletBalance || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>Sauran Kudin Wallet:</Text>
                  <Text style={styles.summaryValueBold}>
                    ₦{Math.max(0, (walletBalance || 0) - retrievalPrice).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  loading && styles.buttonDisabled,
                  (walletBalance !== null && walletBalance < retrievalPrice) && styles.buttonWarning
                ]}
                onPress={handleRetrieveCertificate}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="search-circle" size={22} color={COLORS.white} />
                    <Text style={styles.primaryButtonText}>
                      Binciko & Sauke Certificate (₦{retrievalPrice.toLocaleString()})
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
                  <Ionicons name="create" size={13} color={COLORS.emerald} />
                  <Text style={styles.govPillText}>Official New TIN Enrollment</Text>
                </View>
                <View style={styles.feeBadge}>
                  <Text style={styles.feeLabel}>Kudin Rijista:</Text>
                  <Text style={styles.portalFee}>₦{registrationPrice.toLocaleString()}</Text>
                </View>
              </View>

              <Text style={styles.sectionHeaderTitle}>Rijistar Sabuwar Lambar Haraji (TIN)</Text>
              <Text style={styles.sectionHeaderDesc}>
                Yi rijistar sabuwar lambar haraji ta Joint Tax Board (JTB) domin amfani a banki, CAC, da harkokin gwamnati.
              </Text>

              {/* Category Segment */}
              <Text style={styles.inputLabel}>
                Nau'in Rijista <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.categorySegment}>
                <TouchableOpacity
                  style={[styles.categoryOption, regCategory === 'individual' && styles.categoryOptionActive]}
                  onPress={() => setRegCategory('individual')}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name="person" 
                    size={15} 
                    color={regCategory === 'individual' ? COLORS.emerald : COLORS.subText} 
                  />
                  <Text style={[styles.categoryOptionText, regCategory === 'individual' && styles.categoryOptionTextActive]}>
                    Mutum Daya (Individual TIN)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.categoryOption, regCategory === 'business' && styles.categoryOptionActive]}
                  onPress={() => setRegCategory('business')}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name="briefcase" 
                    size={15} 
                    color={regCategory === 'business' ? COLORS.emerald : COLORS.subText} 
                  />
                  <Text style={[styles.categoryOptionText, regCategory === 'business' && styles.categoryOptionTextActive]}>
                    Kamfani (Business TIN)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Individual Form */}
              {regCategory === 'individual' && (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>
                    Cikakken Suna (Kamar Yadda Yake A Jikin NIN) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="person-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="misali Muhammad Sani Bello"
                      placeholderTextColor={COLORS.mutedText}
                      value={regFullName}
                      onChangeText={setRegFullName}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.inputLabel}>
                      Lambar NIN Mai Lambobi 11 <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Text style={[styles.charCounter, regNin.replace(/\D/g, '').length === 11 && styles.charCounterFull]}>
                      {regNin.replace(/\D/g, '').length}/11 lambobi
                    </Text>
                  </View>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="finger-print-outline" size={18} color={COLORS.emerald} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="Shigar da lambobin NIN 11"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="number-pad"
                      maxLength={11}
                      value={regNin}
                      onChangeText={t => setRegNin(t.replace(/\D/g, ''))}
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Ranar Haihuwa (DOB) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={regDob}
                      onChangeText={t => formatDOBInput(t, setRegDob)}
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Lambar Waya <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="call-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="08012345678"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={regPhone}
                      onChangeText={setRegPhone}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Email (Na Zabi)</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="mail-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="example@mail.com"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={regEmail}
                      onChangeText={setRegEmail}
                    />
                  </View>

                  {/* State & LGA Selection */}
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>
                        Jihar Asali <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TouchableOpacity 
                        style={styles.dropdownSelector} 
                        onPress={() => { setStateSearchQuery(''); setShowStateModal(true); }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dropdownText} numberOfLines={1}>{regState || 'Zabi Jiha'}</Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.inputLabel}>Karamar Hukuma (LGA)</Text>
                      <TouchableOpacity 
                        style={[styles.dropdownSelector, !regState && { opacity: 0.6 }]} 
                        onPress={() => {
                          if (!regState) return Alert.alert('Zabi Jiha', 'Da fatan a fara zabar jiha tukuna.');
                          setLgaSearchQuery('');
                          setShowLgaModal(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dropdownText} numberOfLines={1}>{regLga || 'Zabi LGA'}</Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>
                    Adireshin Gida <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={[styles.inputWithIcon, { height: 'auto', alignItems: 'flex-start', paddingTop: 8 }]}>
                    <Ionicons name="home-outline" size={16} color={COLORS.subText} style={[styles.inputIcon, { marginTop: 4 }]} />
                    <TextInput
                      style={[styles.inputBoxField, { height: 60, textAlignVertical: 'top' }]}
                      placeholder="Shigar da cikakken adireshin gida"
                      placeholderTextColor={COLORS.mutedText}
                      multiline
                      value={regAddress}
                      onChangeText={setRegAddress}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Sana'a / Aikin Yi</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="construct-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="misali Dan Kasuwa, Ma'aikaci, Makanike"
                      placeholderTextColor={COLORS.mutedText}
                      value={regOccupation}
                      onChangeText={setRegOccupation}
                    />
                  </View>
                </View>
              )}

              {/* Business Form */}
              {regCategory === 'business' && (
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>
                    Sunan Kamfani / Kasuwanci <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="business-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="misali Abu Mafhal Enterprises Limited"
                      placeholderTextColor={COLORS.mutedText}
                      value={regBusinessName}
                      onChangeText={setRegBusinessName}
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Lambar Rijistar CAC (RC / BN) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="document-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="misali RC1234567 ko BN987654"
                      placeholderTextColor={COLORS.mutedText}
                      autoCapitalize="characters"
                      value={regCacNumber}
                      onChangeText={setRegCacNumber}
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Ranar Rijista a CAC <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={regIncorpDate}
                      onChangeText={t => formatDOBInput(t, setRegIncorpDate)}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.inputLabel}>
                      NIN na Mai Kamfani / Darakta <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Text style={[styles.charCounter, regDirectorNin.replace(/\D/g, '').length === 11 && styles.charCounterFull]}>
                      {regDirectorNin.replace(/\D/g, '').length}/11 lambobi
                    </Text>
                  </View>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="finger-print-outline" size={18} color={COLORS.emerald} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="11-digit NIN na mai kamfani"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="number-pad"
                      maxLength={11}
                      value={regDirectorNin}
                      onChangeText={t => setRegDirectorNin(t.replace(/\D/g, ''))}
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Lambar Waya Ta Kasuwanci <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="call-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="08012345678"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={regPhone}
                      onChangeText={setRegPhone}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Email na Kamfani</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="mail-outline" size={16} color={COLORS.subText} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputBoxField}
                      placeholder="contact@company.com"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={regEmail}
                      onChangeText={setRegEmail}
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Jihar Da Kasuwancin Ke Gudana <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity 
                    style={styles.dropdownSelector} 
                    onPress={() => { setStateSearchQuery(''); setShowStateModal(true); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownText}>{regState || 'Zabi Jiha'}</Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>
                    Cikakken Adireshin Ofishin Kamfani <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={[styles.inputWithIcon, { height: 'auto', alignItems: 'flex-start', paddingTop: 8 }]}>
                    <Ionicons name="location-outline" size={16} color={COLORS.subText} style={[styles.inputIcon, { marginTop: 4 }]} />
                    <TextInput
                      style={[styles.inputBoxField, { height: 60, textAlignVertical: 'top' }]}
                      placeholder="Shigar da cikakken adireshin ofis"
                      placeholderTextColor={COLORS.mutedText}
                      multiline
                      value={regAddress}
                      onChangeText={setRegAddress}
                    />
                  </View>
                </View>
              )}

              {/* Order Summary Box */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Kudin Rijistar TIN:</Text>
                  <Text style={styles.summaryValue}>₦{registrationPrice.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Kudin Da Ke Asusu (Wallet):</Text>
                  <Text style={[styles.summaryValue, { color: (walletBalance || 0) < registrationPrice ? COLORS.danger : COLORS.emerald }]}>
                    ₦{(walletBalance || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>Sauran Kudin Wallet:</Text>
                  <Text style={styles.summaryValueBold}>
                    ₦{Math.max(0, (walletBalance || 0) - registrationPrice).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  loading && styles.buttonDisabled,
                  (walletBalance !== null && walletBalance < registrationPrice) && styles.buttonWarning
                ]}
                onPress={handleRegisterNewTIN}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-done-circle" size={22} color={COLORS.white} />
                    <Text style={styles.primaryButtonText}>
                      Rijista & Fitar Da TIN (₦{registrationPrice.toLocaleString()})
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
            <View style={{ gap: 14 }}>
              {/* Search & Filter Header */}
              <View style={styles.historyToolbar}>
                <View style={styles.historySearchBox}>
                  <Ionicons name="search" size={16} color={COLORS.subText} />
                  <TextInput
                    style={styles.historySearchInput}
                    placeholder="Binciko da Suna, Reference, ko TIN..."
                    placeholderTextColor={COLORS.mutedText}
                    value={historySearch}
                    onChangeText={setHistorySearch}
                  />
                  {historySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setHistorySearch('')}>
                      <Ionicons name="close-circle" size={16} color={COLORS.mutedText} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Pills */}
                <View style={styles.filterPillsRow}>
                  <TouchableOpacity
                    style={[styles.filterPill, historyFilter === 'all' && styles.filterPillActive]}
                    onPress={() => setHistoryFilter('all')}
                  >
                    <Text style={[styles.filterPillText, historyFilter === 'all' && styles.filterPillTextActive]}>
                      Duka ({historyList.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, historyFilter === 'pending' && styles.filterPillActive]}
                    onPress={() => setHistoryFilter('pending')}
                  >
                    <Text style={[styles.filterPillText, historyFilter === 'pending' && styles.filterPillTextActive]}>
                      Ana Aiki ⏳
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, historyFilter === 'completed' && styles.filterPillActive]}
                    onPress={() => setHistoryFilter('completed')}
                  >
                    <Text style={[styles.filterPillText, historyFilter === 'completed' && styles.filterPillTextActive]}>
                      An Kammala ✅
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {filteredHistory.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="document-text-outline" size={38} color={COLORS.subText} />
                  </View>
                  <Text style={styles.emptyTitle}>Babu Wani Aiki A Wannan Sashe</Text>
                  <Text style={styles.emptySubtitle}>
                    {historySearch.trim()
                      ? `Babu bukatun da suka dace da binciken "${historySearch}".`
                      : 'Ba ku riga kun tura bukatar binciko ko sabuwar rijistar TIN ba tukuna.'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => setActiveTab('retrieve')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={COLORS.white} />
                    <Text style={styles.emptyButtonText}>Fara Neman Tax ID Certificate</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredHistory.map(item => {
                  const details = item.details || {};
                  const status = (details.status || 'PENDING').toUpperCase();
                  const certUrl = details.certificate_url || details.file_url;
                  const issuedTin = details.generated_tin || details.retrieved_tin || details.taxId;

                  return (
                    <View key={item.id} style={styles.historyCard}>
                      {/* Top Header */}
                      <View style={styles.historyCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyHolderName} numberOfLines={1}>
                            {item.holder_name}
                          </Text>
                          <Text style={styles.historyServiceType}>
                            {item.service_type === 'tin_certificate_retrieval' ? '📄 Tax ID Certificate' : '✍️ Sabuwar Rijistar TIN'}
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
                            {status === 'COMPLETED' ? 'AN KAMMALA' :
                             status === 'PROCESSING' ? 'ANA AIKI' :
                             status === 'REJECTED' ? 'AN FASA' : 'ANA DUBAWA'}
                          </Text>
                        </View>
                      </View>

                      {/* Details Content Box */}
                      <View style={styles.historyDetailsBox}>
                        <View style={styles.historyRow}>
                          <Text style={styles.historyLabel}>Reference ID:</Text>
                          <Text style={styles.historyValue}>{item.search_number}</Text>
                        </View>

                        {issuedTin ? (
                          <View style={[styles.historyRow, styles.tinHighlightRow]}>
                            <View>
                              <Text style={styles.tinHighlightLabel}>Official Tax ID (TIN):</Text>
                              <Text style={styles.tinHighlightValue}>{issuedTin}</Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.copyTinBtn}
                              onPress={() => copyToClipboard(issuedTin, 'Tax ID (TIN)')}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="copy-outline" size={14} color={COLORS.emerald} />
                              <Text style={styles.copyTinBtnText}>Kwafa</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}

                        <View style={styles.historyRow}>
                          <Text style={styles.historyLabel}>Ranar Da Aka Tura:</Text>
                          <Text style={styles.historyValue}>
                            {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        </View>

                        {details.admin_notes ? (
                          <View style={styles.adminNoteBox}>
                            <Ionicons name="information-circle" size={16} color={COLORS.info} />
                            <Text style={styles.adminNoteText}>{details.admin_notes}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Action Area: Download or Pending Message */}
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
                            activeOpacity={0.85}
                          >
                            <LinearGradient
                              colors={['#059669', '#047857']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.downloadGradient}
                            >
                              <Ionicons name="cloud-download-outline" size={18} color={COLORS.white} />
                              <Text style={styles.downloadButtonText}>Sauke Official Certificate (PDF)</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : status === 'PENDING' || status === 'PROCESSING' ? (
                          <View style={styles.processingNote}>
                            <Ionicons name="hourglass-outline" size={16} color={COLORS.warning} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.processingNoteTitle}>Ana Gudanar Da Aikin:</Text>
                              <Text style={styles.processingNoteText}>
                                Jami'anmu suna kan aikin takardarku a ofishin haraji na JTB. Da zarar an kammala, takardar PDF za ta bayyana anan domin ku sauke.
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        {/* WhatsApp support quick help */}
                        <TouchableOpacity 
                          style={styles.historySupportBtn}
                          onPress={() => openWhatsAppSupport(`Sannu, ina tambaya dangane da aikina na TIN mai Ref: ${item.search_number}`)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                          <Text style={styles.historySupportBtnText}>Yi Magana Da Jami'i A WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── MODAL: CONFIRMATION MODAL (IN-APP NATIVE SHEET, 100% RELIABLE) ── */}
      <Modal visible={confirmModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.confirmIconBox}>
                  <Ionicons name="card" size={20} color={COLORS.emerald} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Tabbatar da Biyan Kudi</Text>
                  <Text style={styles.confirmSubTitle}>Abu Mafhal Hub • Tax Desk</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => !loading && setConfirmModalVisible(false)}
                disabled={loading}
              >
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            {confirmData && (
              <View style={{ gap: 12 }}>
                <View style={styles.confirmItemCard}>
                  <Text style={styles.confirmItemService}>{confirmData.title}</Text>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Mai Nema / Kamfani:</Text>
                    <Text style={styles.confirmRowValue} numberOfLines={1}>{confirmData.applicantName}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Reference ID:</Text>
                    <Text style={styles.confirmRowValue}>{confirmData.referenceNumber}</Text>
                  </View>
                  <View style={[styles.confirmRow, { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                    <Text style={styles.confirmFeeLabel}>Kudin da za a cire:</Text>
                    <Text style={styles.confirmFeeValue}>₦{confirmData.fee.toLocaleString()}</Text>
                  </View>
                </View>

                {/* Wallet balance comparison */}
                <View style={styles.confirmWalletBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="wallet-outline" size={16} color={COLORS.navy} />
                    <Text style={styles.confirmWalletText}>
                      Kudin Wallet Dinka: <Text style={{ fontWeight: '800' }}>₦{(walletBalance || 0).toLocaleString()}</Text>
                    </Text>
                  </View>
                  <Text style={styles.confirmWalletAfter}>
                    Sauran Kudi: ₦{Math.max(0, (walletBalance || 0) - confirmData.fee).toLocaleString()}
                  </Text>
                </View>

                {/* Action buttons */}
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={styles.confirmPayBtn}
                    onPress={confirmData.onConfirm}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                        <Text style={styles.confirmPayBtnText}>
                          Tabbatar & Biyan Kudi (₦{confirmData.fee.toLocaleString()})
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmCancelBtn}
                    onPress={() => setConfirmModalVisible(false)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmCancelBtnText}>A Fasa (Cancel)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: SUCCESS CONFIRMATION MODAL ── */}
      <Modal visible={successModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 24 }]}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={38} color={COLORS.white} />
            </View>

            <Text style={styles.successModalTitle}>An Tura Bukatar Ku Cikin Nasara! 🎉</Text>
            <Text style={styles.successModalDesc}>
              An karbi bukatarku ta <Text style={{ fontWeight: '700', color: COLORS.navy }}>{successData?.type}</Text> na <Text style={{ fontWeight: '700', color: COLORS.navy }}>{successData?.holderName}</Text>.
            </Text>

            <View style={styles.successRefBox}>
              <Text style={styles.successRefLabel}>Reference ID:</Text>
              <Text style={styles.successRefValue}>{successData?.ref}</Text>
            </View>

            <Text style={styles.successModalSubtext}>
              Jami'an ofishin haraji na JTB za su fitar da takardar shaidarku su dora muku ita a shafin "Ayyukana" domin ku sauke.
            </Text>

            <TouchableOpacity
              style={styles.successActionBtn}
              onPress={() => {
                setSuccessModalVisible(false);
                setActiveTab('history');
                fetchHistory();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="time" size={18} color={COLORS.white} />
              <Text style={styles.successActionBtnText}>Duba Ayyukana (My Requests)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: INSUFFICIENT BALANCE MODAL ── */}
      <Modal visible={insufficientModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 24 }]}>
            <View style={styles.warningIconCircle}>
              <Ionicons name="wallet-outline" size={36} color={COLORS.gold} />
            </View>

            <Text style={styles.successModalTitle}>Kudin Wallet Bai Isa Ba</Text>
            <Text style={styles.successModalDesc}>
              Kudin wannan aiki ₦{insufficientRequiredFee.toLocaleString()} ne, amma kudin da ke asusunka ₦{(walletBalance || 0).toLocaleString()} ne kacal.
            </Text>

            <View style={{ width: '100%', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.fundWalletBtn}
                onPress={() => {
                  setInsufficientModalVisible(false);
                  router.push('/wallet');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
                <Text style={styles.fundWalletBtnText}>Saka Kudi a Wallet (Fund Wallet)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setInsufficientModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelBtnText}>A Fasa (Cancel)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: INDIVIDUAL CRITERIA SELECTOR ── */}
      <Modal visible={showCriteriaModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="filter-circle" size={20} color={COLORS.emerald} />
                <Text style={styles.modalTitle}>Zabi Hanyar Bincike</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCriteriaModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { setIndivCriteria('nin_name_dob'); setShowCriteriaModal(false); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalOptionText, indivCriteria === 'nin_name_dob' && styles.modalOptionTextActive]}>
                  NIN (Tare da Suna da Ranar Haihuwa)
                </Text>
                <Text style={styles.modalOptionSub}>Mafi sauki da sauri ta hanyar amfani da lambar NIN.</Text>
              </View>
              {indivCriteria === 'nin_name_dob' && (
                <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { setIndivCriteria('tax_id_dob'); setShowCriteriaModal(false); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalOptionText, indivCriteria === 'tax_id_dob' && styles.modalOptionTextActive]}>
                  Tax ID / TIN (Tare da Ranar Haihuwa)
                </Text>
                <Text style={styles.modalOptionSub}>Ga masu tsohuwar lambar TIN da suke son sabon Certificate.</Text>
              </View>
              {indivCriteria === 'tax_id_dob' && (
                <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { setIndivCriteria('prev_tin_dob'); setShowCriteriaModal(false); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalOptionText, indivCriteria === 'prev_tin_dob' && styles.modalOptionTextActive]}>
                  Lambar TIN Ta Baya (Previous TIN)
                </Text>
                <Text style={styles.modalOptionSub}>Nemo takarda da lambar TIN da aka bayar a can baya.</Text>
              </View>
              {indivCriteria === 'prev_tin_dob' && (
                <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: ORGANIZATION TYPE ── */}
      <Modal visible={showOrgModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business" size={20} color={COLORS.emerald} />
                <Text style={styles.modalTitle}>Zabi Nau'in Kamfani</Text>
              </View>
              <TouchableOpacity onPress={() => setShowOrgModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {ORG_TYPES.map(org => (
                <TouchableOpacity
                  key={org}
                  style={styles.modalOption}
                  onPress={() => { setOrganizationType(org); setShowOrgModal(false); }}
                >
                  <Text style={[styles.modalOptionText, organizationType === org && styles.modalOptionTextActive]}>
                    {org}
                  </Text>
                  {organizationType === org && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: SEARCHABLE STATE SELECTOR ── */}
      <Modal visible={showStateModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="map" size={20} color={COLORS.emerald} />
                <Text style={styles.modalTitle}>Zabi Jiha</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            {/* Quick State Search Input */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={16} color={COLORS.subText} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Binciko Jiha (misali Kano, Lagos, Kaduna)..."
                placeholderTextColor={COLORS.mutedText}
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
                autoCorrect={false}
              />
              {stateSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setStateSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.mutedText} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="always">
              {filteredStateList.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: COLORS.subText }}>Ba a samu jiha mai sunan nan ba.</Text>
                </View>
              ) : (
                filteredStateList.map(st => (
                  <TouchableOpacity
                    key={st}
                    style={styles.modalOption}
                    onPress={() => { 
                      setRegState(st); 
                      setRegLga(''); 
                      setShowStateModal(false); 
                    }}
                  >
                    <Text style={[styles.modalOptionText, regState === st && styles.modalOptionTextActive]}>
                      {st}
                    </Text>
                    {regState === st && (
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: SEARCHABLE LGA SELECTOR ── */}
      <Modal visible={showLgaModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={20} color={COLORS.emerald} />
                <Text style={styles.modalTitle}>Karamar Hukuma ({regState})</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLgaModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            {/* Quick LGA Search Input */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={16} color={COLORS.subText} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Binciko Karamar Hukuma..."
                placeholderTextColor={COLORS.mutedText}
                value={lgaSearchQuery}
                onChangeText={setLgaSearchQuery}
                autoCorrect={false}
              />
              {lgaSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setLgaSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.mutedText} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="always">
              {filteredLgaList.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: COLORS.subText }}>Ba a samu LGA mai sunan nan ba.</Text>
                </View>
              ) : (
                filteredLgaList.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={styles.modalOption}
                    onPress={() => { setRegLga(l); setShowLgaModal(false); }}
                  >
                    <Text style={[styles.modalOptionText, regLga === l && styles.modalOptionTextActive]}>
                      {l}
                    </Text>
                    {regLga === l && (
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
                    )}
                  </TouchableOpacity>
                ))
              )}
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
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
  },
  headerVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  headerVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 1,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  walletBadgeLow: {
    backgroundColor: COLORS.goldLight,
    borderColor: COLORS.goldBorder,
  },
  walletText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.emerald,
  },
  walletTextLow: {
    color: COLORS.gold,
  },
  walletFundHint: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.subText,
  },
  heroWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 10,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.2,
  },
  heroDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 16,
  },
  heroHelpBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroHelpBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.white,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 5,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
  },
  activeTabButton: {
    backgroundColor: COLORS.navy,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.subText,
  },
  activeTabText: {
    color: COLORS.white,
  },
  tabBadge: {
    backgroundColor: '#cbd5e1',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: COLORS.emerald,
  },
  tabBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.navy,
  },
  tabBadgeTextActive: {
    color: COLORS.white,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContentContainer: {
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
    marginBottom: 8,
  },
  govPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  govPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.emeraldDark,
  },
  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  feeLabel: {
    fontSize: 11,
    color: COLORS.subText,
  },
  portalFee: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gold,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: 4,
  },
  sectionHeaderDesc: {
    fontSize: 11.5,
    color: COLORS.subText,
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 5,
    marginTop: 10,
  },
  requiredStar: {
    color: COLORS.danger,
  },
  charCounter: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.subText,
  },
  charCounterFull: {
    color: COLORS.emerald,
    fontWeight: '800',
  },
  categorySegment: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    padding: 3,
    marginBottom: 10,
    gap: 4,
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
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.subText,
  },
  categoryOptionTextActive: {
    color: COLORS.navy,
    fontWeight: '700',
  },
  entitySegment: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  entityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 6,
  },
  entityOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  entityOptionText: {
    fontSize: 11,
    color: COLORS.subText,
    fontWeight: '600',
  },
  entityOptionTextActive: {
    color: COLORS.emerald,
    fontWeight: '700',
  },
  formSection: {
    marginTop: 2,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputBoxField: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
  },
  dropdownSelector: {
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11.5,
    color: COLORS.subText,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  summaryLabelBold: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
  },
  summaryValueBold: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.emerald,
  },
  primaryButton: {
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 20,
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonWarning: {
    backgroundColor: '#d97706',
    shadowColor: '#d97706',
  },
  primaryButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.white,
  },
  historyToolbar: {
    gap: 10,
  },
  historySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  historySearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.text,
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.subText,
  },
  filterPillTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.navy,
  },
  historyServiceType: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPending: { backgroundColor: COLORS.warningBg },
  statusPendingText: { color: COLORS.warning },
  statusProcessing: { backgroundColor: COLORS.infoBg },
  statusProcessingText: { color: COLORS.info },
  statusCompleted: { backgroundColor: COLORS.successBg },
  statusCompletedText: { color: COLORS.success },
  statusRejected: { backgroundColor: COLORS.dangerBg },
  statusRejectedText: { color: COLORS.danger },
  historyDetailsBox: {
    paddingVertical: 10,
    gap: 7,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLabel: {
    fontSize: 11.5,
    color: COLORS.subText,
  },
  historyValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  tinHighlightRow: {
    backgroundColor: COLORS.emeraldLight,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    marginTop: 2,
  },
  tinHighlightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emeraldDark,
    textTransform: 'uppercase',
  },
  tinHighlightValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.emeraldDark,
    letterSpacing: 0.5,
  },
  copyTinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  copyTinBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.infoBg,
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  adminNoteText: {
    fontSize: 11,
    color: COLORS.info,
    flex: 1,
  },
  historyActions: {
    marginTop: 6,
    gap: 6,
  },
  downloadButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  downloadGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  downloadButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.white,
  },
  processingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  processingNoteTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  processingNoteText: {
    fontSize: 10.5,
    color: '#92400e',
    lineHeight: 15,
    marginTop: 2,
  },
  historySupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  historySupportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
  },
  confirmIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  confirmSubTitle: {
    fontSize: 10.5,
    color: COLORS.subText,
    fontWeight: '600',
  },
  confirmItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  confirmItemService: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmRowLabel: {
    fontSize: 11.5,
    color: COLORS.subText,
  },
  confirmRowValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    maxWidth: '65%',
  },
  confirmFeeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.navy,
  },
  confirmFeeValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.emerald,
  },
  confirmWalletBox: {
    backgroundColor: COLORS.emeraldLight,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    gap: 4,
  },
  confirmWalletText: {
    fontSize: 11.5,
    color: COLORS.navy,
  },
  confirmWalletAfter: {
    fontSize: 11,
    color: COLORS.emeraldDark,
    fontWeight: '600',
    marginLeft: 22,
  },
  confirmPayBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  confirmPayBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.white,
  },
  confirmCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.subText,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  successModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
  },
  successModalDesc: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  successRefBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  successRefLabel: {
    fontSize: 11,
    color: COLORS.subText,
    fontWeight: '600',
  },
  successRefValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
  },
  successModalSubtext: {
    fontSize: 11,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  successActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  successActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  warningIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  fundWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingVertical: 13,
    width: '100%',
  },
  fundWalletBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 6,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.text,
    padding: 0,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalOptionTextActive: {
    color: COLORS.emerald,
    fontWeight: '800',
  },
  modalOptionSub: {
    fontSize: 10.5,
    color: COLORS.subText,
    marginTop: 2,
  },
});
