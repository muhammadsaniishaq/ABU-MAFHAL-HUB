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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { supabase } from '../../services/supabase';
import { verificationHistory } from '../../services/verificationHistory';
import { NIGERIA_STATES } from '../../utils/nigeriaStates';

const STATE_LIST = Object.keys(NIGERIA_STATES);

// Official JTB Theme Colors
const COLORS = {
  jtbGreen: '#008751',
  jtbGreenDark: '#00663d',
  jtbGreenLight: '#e6f4ea',
  jtbGreenBorder: '#a8dab5',
  navyDark: '#0d1b3e',
  navy: '#132347',
  gold: '#d97706',
  white: '#ffffff',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#1f2937',
  subText: '#4b5563',
  mutedText: '#9ca3af',
  border: '#d1d5db',
  borderLight: '#e5e7eb',
  success: '#10b981',
  successBg: '#dcfce7',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
};

// Official Organization Types from Screenshot 5 & 6
const ORGANIZATION_TYPES = [
  'BUSINESS NAME',
  'INCORPORATED TRUSTEE',
  'LIMITED PARTNERSHIP',
  'LIMITED BY GUARANTEE',
  'LIMITED LIABILITY PARTNERSHIP',
  'PARTNERSHIP',
  'PRIVATE LIMITED COMPANY',
  'PRIVATE UNLIMITED COMPANY',
  'PUBLIC LIMITED COMPANY',
  'SOLE PROPRIETORSHIP',
];

const MDA_TYPES = [
  'Federal Ministry, Department or Agency',
  'State Ministry, Department or Agency',
  'Local Government Authority',
  'Parastatal or Statutory Body',
];

export default function TinServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Top Tabs: Search Portal vs Requests History
  const [activeTab, setActiveTab] = useState<'portal' | 'history'>('portal');

  // Category (Screenshot 1 & 3): Individual vs Non-Individual
  const [category, setCategory] = useState<'individual' | 'non_individual'>('individual');

  // Search Criteria for Individual (Screenshot 2)
  // Options: 'nin_name_dob' | 'tax_id_dob' | 'prev_tin_dob'
  const [indivCriteria, setIndivCriteria] = useState<'nin_name_dob' | 'tax_id_dob' | 'prev_tin_dob'>('nin_name_dob');

  // Entity Type for Non-Individual (Screenshot 3, 8, 10): Corporate | MDA | Cooperative
  const [entityType, setEntityType] = useState<'corporate' | 'mda' | 'cooperative'>('corporate');

  // Search Criteria for Corporate (Screenshot 4)
  // Options: 'cac_reg' | 'tax_id' | 'prev_tin'
  const [corpCriteria, setCorpCriteria] = useState<'cac_reg' | 'tax_id' | 'prev_tin'>('cac_reg');

  // Search Criteria for MDA (Screenshot 9)
  // Options: 'registered_name' | 'registration_number' | 'tax_id' | 'prev_tin'
  const [mdaCriteria, setMdaCriteria] = useState<'registered_name' | 'registration_number' | 'tax_id' | 'prev_tin'>('registered_name');

  // Search Criteria for Cooperative (Screenshot 10)
  // Options: 'registration_number' | 'tax_id' | 'prev_tin'
  const [coopCriteria, setCoopCriteria] = useState<'registration_number' | 'tax_id' | 'prev_tin'>('registration_number');

  // ── Form Fields ──
  // Individual Fields (Screenshot 1)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nin, setNin] = useState('');
  const [dob, setDob] = useState('');
  const [taxId, setTaxId] = useState('');
  const [previousTin, setPreviousTin] = useState('');

  // Non-Individual Fields
  const [orgType, setOrgType] = useState('PRIVATE LIMITED COMPANY');
  const [cacRegNumber, setCacRegNumber] = useState('');
  const [dateOfIncorp, setDateOfIncorp] = useState('');
  const [mdaType, setMdaType] = useState(MDA_TYPES[0]);
  const [registeredName, setRegisteredName] = useState('');
  const [coopState, setCoopState] = useState('');

  // Contact Phone (For receiving official certificate notice)
  const [phone, setPhone] = useState('');

  // ── Modals ──
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showMdaModal, setShowMdaModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Dropdown selector modals
  const [showIndivCriteriaModal, setShowIndivCriteriaModal] = useState(false);
  const [showCorpCriteriaModal, setShowCorpCriteriaModal] = useState(false);
  const [showMdaCriteriaModal, setShowMdaCriteriaModal] = useState(false);
  const [showCoopCriteriaModal, setShowCoopCriteriaModal] = useState(false);

  // Confirmation, Balance & Success
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [insufficientModalVisible, setInsufficientModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successRef, setSuccessRef] = useState('');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Pricing: Individual vs Non-Individual (Business)
  const [individualPrice, setIndividualPrice] = useState<number>(1500);
  const [businessPrice, setBusinessPrice] = useState<number>(3000);

  const activeFee = category === 'individual' ? individualPrice : businessPrice;

  // History List
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const bottomClearance = Math.max(insets.bottom, 24) + 140;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance, full_name, phone')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setWalletBalance(Number(profile.balance || 0));
          if (profile.full_name) {
            const parts = profile.full_name.trim().split(' ');
            if (parts.length > 0 && !firstName) setFirstName(parts[0]);
            if (parts.length > 1 && !lastName) setLastName(parts.slice(1).join(' '));
          }
          if (profile.phone && !phone) setPhone(profile.phone);
        }
      }

      // Read pricing
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['tin_pricing_controls', 'price_tin_individual', 'price_tin_business', 'price_tin_certificate', 'price_tin_registration']);

      if (settingsData && settingsData.length > 0) {
        settingsData.forEach(item => {
          if (item.key === 'tin_pricing_controls' && item.value) {
            try {
              const p = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
              if (p?.individual_tin?.selling_price) setIndividualPrice(Number(p.individual_tin.selling_price));
              else if (p?.tin_certificate?.selling_price) setIndividualPrice(Number(p.tin_certificate.selling_price));

              if (p?.business_tin?.selling_price) setBusinessPrice(Number(p.business_tin.selling_price));
              else if (p?.tin_registration?.selling_price) setBusinessPrice(Number(p.tin_registration.selling_price));
            } catch (_) {}
          }
          if (item.key === 'price_tin_individual' && item.value) {
            const val = parseFloat(item.value);
            if (!isNaN(val) && val > 0) setIndividualPrice(val);
          }
          if (item.key === 'price_tin_business' && item.value) {
            const val = parseFloat(item.value);
            if (!isNaN(val) && val > 0) setBusinessPrice(val);
          }
        });
      }

      const items = await verificationHistory.getAll('tin');
      setHistoryList(items || []);
    } catch (e) {
      console.warn('Error loading JTB portal data:', e);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, []);

  const handleDateInput = (val: string, setter: (v: string) => void) => {
    const digits = val.replace(/[^0-9]/g, '');
    if (digits.length <= 2) setter(digits);
    else if (digits.length <= 4) setter(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    else setter(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`);
  };

  const handleSearchSubmit = () => {
    if (walletBalance !== null && walletBalance < activeFee) {
      setInsufficientModalVisible(true);
      return;
    }

    if (category === 'individual') {
      if (indivCriteria === 'nin_name_dob') {
        if (!firstName.trim()) return Alert.alert('Required', 'Please enter First Name.');
        if (!lastName.trim()) return Alert.alert('Required', 'Please enter Last Name.');
        if (nin.replace(/\D/g, '').length !== 11) return Alert.alert('Required', 'Please enter valid 11-digit NIN.');
        if (dob.length < 10) return Alert.alert('Required', 'Please enter Date of Birth (DD/MM/YYYY).');
      } else if (indivCriteria === 'tax_id_dob') {
        if (!taxId.trim()) return Alert.alert('Required', 'Please enter Tax ID.');
        if (dob.length < 10) return Alert.alert('Required', 'Please enter Date of Birth (DD/MM/YYYY).');
      } else if (indivCriteria === 'prev_tin_dob') {
        if (!previousTin.trim()) return Alert.alert('Required', 'Please enter Previous TIN.');
        if (dob.length < 10) return Alert.alert('Required', 'Please enter Date of Birth (DD/MM/YYYY).');
      }
    } else {
      // Non-Individual
      if (entityType === 'corporate') {
        if (corpCriteria === 'cac_reg') {
          if (!cacRegNumber.trim()) return Alert.alert('Required', 'Please enter CAC Registration Number (RC/BN).');
          if (dateOfIncorp.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation (DD/MM/YYYY).');
        } else if (corpCriteria === 'tax_id') {
          if (!taxId.trim()) return Alert.alert('Required', 'Please enter Tax ID.');
          if (dateOfIncorp.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation (DD/MM/YYYY).');
        } else if (corpCriteria === 'prev_tin') {
          if (!previousTin.trim()) return Alert.alert('Required', 'Please enter Previous JTB TIN.');
          if (dateOfIncorp.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation (DD/MM/YYYY).');
        }
      } else if (entityType === 'mda') {
        if (!registeredName.trim()) return Alert.alert('Required', 'Please enter Registered MDA Name.');
      } else if (entityType === 'cooperative') {
        if (!coopState) return Alert.alert('Required', 'Please select State of Registration.');
        if (!cacRegNumber.trim()) return Alert.alert('Required', 'Please enter Registration Number.');
        if (dateOfIncorp.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation (DD/MM/YYYY).');
      }
    }

    if (phone.replace(/\D/g, '').length < 11) {
      return Alert.alert('Phone Required', 'Please enter an 11-digit phone number for notification.');
    }

    setConfirmModalVisible(true);
  };

  const executeSearch = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Please sign in to continue.');

      // Balance check & atomic debit
      const { data: prof } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      const bal = Number(prof?.balance || 0);
      if (bal < activeFee) {
        setConfirmModalVisible(false);
        setInsufficientModalVisible(true);
        throw new Error('Insufficient wallet balance.');
      }

      const newBal = bal - activeFee;
      const { error: debitErr } = await supabase
        .from('profiles')
        .update({ balance: newBal })
        .eq('id', userId)
        .gte('balance', activeFee);

      if (debitErr) throw new Error('Payment deduction failed. Please check wallet balance.');
      setWalletBalance(newBal);

      const txnRef = `JTB_${Date.now()}`;
      const applicantName = category === 'individual'
        ? `${firstName.trim()} ${lastName.trim()}`
        : (registeredName.trim() || cacRegNumber.trim() || 'Corporate Entity');

      const searchNumber = category === 'individual'
        ? (nin.trim() || taxId.trim() || previousTin.trim())
        : (cacRegNumber.trim() || taxId.trim() || previousTin.trim() || registeredName.trim());

      // Save transaction
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'debit',
        category: 'verification',
        amount: activeFee,
        status: 'success',
        reference: txnRef,
        description: `Tax ID Certificate Retrieval: ${applicantName} (${searchNumber})`,
      });

      // Save to verification_history for admin fulfillment
      await verificationHistory.save({
        service_category: 'tin',
        service_type: 'tin_certificate_retrieval',
        search_number: searchNumber,
        holder_name: applicantName,
        layout: 'jtb_tax_certificate',
        details: {
          category,
          entityType: category === 'non_individual' ? entityType : undefined,
          indivCriteria: category === 'individual' ? indivCriteria : undefined,
          corpCriteria: category === 'non_individual' && entityType === 'corporate' ? corpCriteria : undefined,
          mdaCriteria: category === 'non_individual' && entityType === 'mda' ? mdaCriteria : undefined,
          coopCriteria: category === 'non_individual' && entityType === 'cooperative' ? coopCriteria : undefined,
          firstName,
          lastName,
          nin,
          dob,
          taxId,
          previousTin,
          orgType: category === 'non_individual' && entityType === 'corporate' ? orgType : undefined,
          cacRegNumber,
          dateOfIncorp,
          mdaType: category === 'non_individual' && entityType === 'mda' ? mdaType : undefined,
          registeredName,
          coopState: category === 'non_individual' && entityType === 'cooperative' ? coopState : undefined,
          phone,
          fee: activeFee,
          txnRef,
          status: 'PENDING',
          portal: 'taxidcert.jrb.gov.ng',
        },
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setConfirmModalVisible(false);
      setSuccessRef(txnRef);
      setSuccessModalVisible(true);
      loadData();
    } catch (err: any) {
      Alert.alert('Search Error', err.message || 'Failed to submit search request.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (t: string, label: string) => {
    Clipboard.setStringAsync(t);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const filteredHistory = useMemo(() => {
    return historyList.filter(item => {
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase().trim();
      const holder = (item.holder_name || '').toLowerCase();
      const ref = (item.search_number || '').toLowerCase();
      return holder.includes(q) || ref.includes(q);
    });
  }, [historyList, historySearch]);

  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return STATE_LIST;
    return STATE_LIST.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase().trim()));
  }, [stateSearch]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* JTB TOP BRANDED HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Tax ID Certificate Retrieval</Text>
            <Text style={styles.headerSubtitle}>Joint Revenue Board (JRB / JTB) Portal</Text>
          </View>

          <View style={styles.walletPill}>
            <Ionicons name="wallet-outline" size={13} color={COLORS.jtbGreenDark} style={{ marginRight: 4 }} />
            <Text style={styles.walletPillText}>
              ₦{walletBalance !== null ? walletBalance.toLocaleString() : '---'}
            </Text>
          </View>
        </View>

        {/* TOP TAB SWITCHER: SEARCH FORM VS MY REQUESTS */}
        <View style={styles.topTabBar}>
          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'portal' && styles.topTabBtnActive]}
            onPress={() => setActiveTab('portal')}
            activeOpacity={0.7}
          >
            <Text style={[styles.topTabBtnText, activeTab === 'portal' && styles.topTabBtnTextActive]}>
              Search Certificate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'history' && styles.topTabBtnActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.7}
          >
            <Text style={[styles.topTabBtnText, activeTab === 'history' && styles.topTabBtnTextActive]}>
              My Certificates ({historyList.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'portal' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.jtbGreen} />}
        >
          {/* WHITE PORTAL CARD (Matching Screenshot 1 & 3) */}
          <View style={styles.portalCard}>
            <Text style={styles.portalCardTitle}>Tax ID Certificate Retrieval</Text>
            <Text style={styles.portalCardSubtitle}>Enter your details to retrieve your Tax ID certificate</Text>

            {/* CATEGORY SWITCHER (Screenshot 1: Individual vs Non-Individual) */}
            <Text style={styles.fieldHeading}>Category</Text>
            <View style={styles.categoryToggleBox}>
              <TouchableOpacity
                style={[styles.categoryOption, category === 'individual' && styles.categoryOptionActive]}
                onPress={() => setCategory('individual')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={category === 'individual' ? COLORS.jtbGreen : COLORS.subText}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.categoryOptionText, category === 'individual' && styles.categoryOptionTextActive]}>
                  Individual (₦{individualPrice.toLocaleString()})
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
                  color={category === 'non_individual' ? COLORS.jtbGreen : COLORS.subText}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.categoryOptionText, category === 'non_individual' && styles.categoryOptionTextActive]}>
                  Non-Individual (₦{businessPrice.toLocaleString()})
                </Text>
              </TouchableOpacity>
            </View>

            {/* ═════════════════════════════════════════════════════ */}
            {/* 1. INDIVIDUAL SECTION (Screenshots 1 & 2)             */}
            {/* ═════════════════════════════════════════════════════ */}
            {category === 'individual' && (
              <View style={{ marginTop: 16 }}>
                {/* Search Criteria Dropdown */}
                <Text style={styles.fieldHeading}>Search Criteria</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setShowIndivCriteriaModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {indivCriteria === 'nin_name_dob' && 'NIN (with Name and DOB)'}
                    {indivCriteria === 'tax_id_dob' && 'Tax ID (with DOB)'}
                    {indivCriteria === 'prev_tin_dob' && 'Previous TIN (with DOB)'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                </TouchableOpacity>

                {/* Form fields based on selected criteria */}
                {indivCriteria === 'nin_name_dob' && (
                  <>
                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.fieldHeading}>First Name</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter first name"
                          placeholderTextColor={COLORS.mutedText}
                          value={firstName}
                          onChangeText={setFirstName}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.fieldHeading}>Last Name</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter last name"
                          placeholderTextColor={COLORS.mutedText}
                          value={lastName}
                          onChangeText={setLastName}
                        />
                      </View>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1.2, marginRight: 8 }}>
                        <Text style={styles.fieldHeading}>National Identification Number (NIN)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter 11-digit NIN"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="numeric"
                          maxLength={11}
                          value={nin}
                          onChangeText={t => setNin(t.replace(/\D/g, ''))}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.fieldHeading}>Date of Birth</Text>
                        <View style={styles.inputWithIcon}>
                          <TextInput
                            style={styles.inputInside}
                            placeholder="DD/MM/YYYY"
                            placeholderTextColor={COLORS.mutedText}
                            keyboardType="numeric"
                            maxLength={10}
                            value={dob}
                            onChangeText={t => handleDateInput(t, setDob)}
                          />
                          <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {indivCriteria === 'tax_id_dob' && (
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1.2, marginRight: 8 }}>
                      <Text style={styles.fieldHeading}>Tax ID</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter Tax Identification Number"
                        placeholderTextColor={COLORS.mutedText}
                        value={taxId}
                        onChangeText={setTaxId}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.fieldHeading}>Date of Birth</Text>
                      <View style={styles.inputWithIcon}>
                        <TextInput
                          style={styles.inputInside}
                          placeholder="DD/MM/YYYY"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="numeric"
                          maxLength={10}
                          value={dob}
                          onChangeText={t => handleDateInput(t, setDob)}
                        />
                        <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                      </View>
                    </View>
                  </View>
                )}

                {indivCriteria === 'prev_tin_dob' && (
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1.2, marginRight: 8 }}>
                      <Text style={styles.fieldHeading}>Previous TIN</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter Previous TIN"
                        placeholderTextColor={COLORS.mutedText}
                        value={previousTin}
                        onChangeText={setPreviousTin}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.fieldHeading}>Date of Birth</Text>
                      <View style={styles.inputWithIcon}>
                        <TextInput
                          style={styles.inputInside}
                          placeholder="DD/MM/YYYY"
                          placeholderTextColor={COLORS.mutedText}
                          keyboardType="numeric"
                          maxLength={10}
                          value={dob}
                          onChangeText={t => handleDateInput(t, setDob)}
                        />
                        <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Contact Phone Number */}
                <Text style={styles.fieldHeading}>WhatsApp / Notification Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="08012345678"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phone}
                  onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                />
              </View>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* 2. NON-INDIVIDUAL SECTION (Screenshots 3 to 10)       */}
            {/* ═════════════════════════════════════════════════════ */}
            {category === 'non_individual' && (
              <View style={{ marginTop: 16 }}>
                {/* Entity Type Chips (Screenshot 3, 8, 10) */}
                <Text style={styles.fieldHeading}>Entity Type *</Text>
                <View style={styles.entityTypeRow}>
                  <TouchableOpacity
                    style={[styles.entityChip, entityType === 'corporate' && styles.entityChipActive]}
                    onPress={() => setEntityType('corporate')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="business" size={15} color={entityType === 'corporate' ? COLORS.jtbGreen : COLORS.subText} style={{ marginRight: 6 }} />
                    <Text style={[styles.entityChipText, entityType === 'corporate' && styles.entityChipTextActive]}>
                      Corporate
                    </Text>
                    {entityType === 'corporate' && (
                      <Ionicons name="checkmark-circle" size={15} color={COLORS.jtbGreen} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.entityChip, entityType === 'mda' && styles.entityChipActive]}
                    onPress={() => setEntityType('mda')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="business-outline" size={15} color={entityType === 'mda' ? COLORS.jtbGreen : COLORS.subText} style={{ marginRight: 6 }} />
                    <Text style={[styles.entityChipText, entityType === 'mda' && styles.entityChipTextActive]}>
                      MDA
                    </Text>
                    {entityType === 'mda' && (
                      <Ionicons name="checkmark-circle" size={15} color={COLORS.jtbGreen} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.entityChip, entityType === 'cooperative' && styles.entityChipActive]}
                    onPress={() => setEntityType('cooperative')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="people-outline" size={15} color={entityType === 'cooperative' ? COLORS.jtbGreen : COLORS.subText} style={{ marginRight: 6 }} />
                    <Text style={[styles.entityChipText, entityType === 'cooperative' && styles.entityChipTextActive]}>
                      Cooperative So...
                    </Text>
                    {entityType === 'cooperative' && (
                      <Ionicons name="checkmark-circle" size={15} color={COLORS.jtbGreen} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* ── Sub-Form: CORPORATE (Screenshots 3, 4, 5, 6, 7) ── */}
                {entityType === 'corporate' && (
                  <>
                    {/* Search Criteria Dropdown (Screenshot 4) */}
                    <Text style={[styles.fieldHeading, { marginTop: 14 }]}>Search Criteria</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowCorpCriteriaModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText}>
                        {corpCriteria === 'cac_reg' && 'CAC Registration Number'}
                        {corpCriteria === 'tax_id' && 'Tax ID'}
                        {corpCriteria === 'prev_tin' && 'Previous JTB TIN'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                    </TouchableOpacity>

                    {corpCriteria === 'cac_reg' && (
                      <>
                        {/* Organization Type Dropdown (Screenshots 5 & 6) */}
                        <Text style={styles.fieldHeading}>Organization Type</Text>
                        <TouchableOpacity
                          style={styles.dropdownTrigger}
                          onPress={() => setShowOrgModal(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownTriggerText}>{orgType}</Text>
                          <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                        </TouchableOpacity>

                        {/* CAC Reg Number & Date of Incorporation */}
                        <View style={styles.twoColRow}>
                          <View style={{ flex: 1.2, marginRight: 8 }}>
                            <Text style={styles.fieldHeading}>CAC Registration Number</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Enter CAC Registration Number (e.g. RC...)"
                              placeholderTextColor={COLORS.mutedText}
                              autoCapitalize="characters"
                              value={cacRegNumber}
                              onChangeText={setCacRegNumber}
                            />
                          </View>

                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.fieldHeading}>Date of Incorporation</Text>
                            <View style={styles.inputWithIcon}>
                              <TextInput
                                style={styles.inputInside}
                                placeholder="DD/MM/YYYY"
                                placeholderTextColor={COLORS.mutedText}
                                keyboardType="numeric"
                                maxLength={10}
                                value={dateOfIncorp}
                                onChangeText={t => handleDateInput(t, setDateOfIncorp)}
                              />
                              <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                            </View>
                          </View>
                        </View>
                      </>
                    )}

                    {corpCriteria === 'tax_id' && (
                      <View style={styles.twoColRow}>
                        <View style={{ flex: 1.2, marginRight: 8 }}>
                          <Text style={styles.fieldHeading}>Tax ID</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Enter Tax Identification Number"
                            placeholderTextColor={COLORS.mutedText}
                            value={taxId}
                            onChangeText={setTaxId}
                          />
                        </View>

                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.fieldHeading}>Date of Incorporation</Text>
                          <View style={styles.inputWithIcon}>
                            <TextInput
                              style={styles.inputInside}
                              placeholder="DD/MM/YYYY"
                              placeholderTextColor={COLORS.mutedText}
                              keyboardType="numeric"
                              maxLength={10}
                              value={dateOfIncorp}
                              onChangeText={t => handleDateInput(t, setDateOfIncorp)}
                            />
                            <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                          </View>
                        </View>
                      </View>
                    )}

                    {corpCriteria === 'prev_tin' && (
                      <View style={styles.twoColRow}>
                        <View style={{ flex: 1.2, marginRight: 8 }}>
                          <Text style={styles.fieldHeading}>Previous JTB TIN</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Enter Previous JTB TIN"
                            placeholderTextColor={COLORS.mutedText}
                            value={previousTin}
                            onChangeText={setPreviousTin}
                          />
                        </View>

                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.fieldHeading}>Date of Incorporation</Text>
                          <View style={styles.inputWithIcon}>
                            <TextInput
                              style={styles.inputInside}
                              placeholder="DD/MM/YYYY"
                              placeholderTextColor={COLORS.mutedText}
                              keyboardType="numeric"
                              maxLength={10}
                              value={dateOfIncorp}
                              onChangeText={t => handleDateInput(t, setDateOfIncorp)}
                            />
                            <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* ── Sub-Form: MDA (Screenshots 8 & 9) ── */}
                {entityType === 'mda' && (
                  <>
                    <Text style={[styles.fieldHeading, { marginTop: 14 }]}>Search Criteria</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowMdaCriteriaModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText}>
                        {mdaCriteria === 'registered_name' && 'Registered Name'}
                        {mdaCriteria === 'registration_number' && 'Registration Number'}
                        {mdaCriteria === 'tax_id' && 'Tax ID'}
                        {mdaCriteria === 'prev_tin' && 'Previous JTB TIN'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                    </TouchableOpacity>

                    <Text style={styles.fieldHeading}>MDA Type *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowMdaModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText}>{mdaType}</Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                    </TouchableOpacity>

                    <Text style={styles.fieldHeading}>Registered Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter Registered Name"
                      placeholderTextColor={COLORS.mutedText}
                      value={registeredName}
                      onChangeText={setRegisteredName}
                    />
                  </>
                )}

                {/* ── Sub-Form: COOPERATIVE SOCIETY (Screenshot 10) ── */}
                {entityType === 'cooperative' && (
                  <>
                    <Text style={[styles.fieldHeading, { marginTop: 14 }]}>Search Criteria</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowCoopCriteriaModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText}>
                        {coopCriteria === 'registration_number' && 'Registration Number'}
                        {coopCriteria === 'tax_id' && 'Tax ID'}
                        {coopCriteria === 'prev_tin' && 'Previous JTB TIN'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                    </TouchableOpacity>

                    <Text style={styles.fieldHeading}>State of Registration *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => {
                        setStateSearch('');
                        setShowStateModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={coopState ? styles.dropdownTriggerText : { color: COLORS.mutedText }}>
                        {coopState || 'Select State'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                    </TouchableOpacity>
                    <Text style={styles.helperText}>The same registration number can exist in more than one state.</Text>

                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1.2, marginRight: 8 }}>
                        <Text style={styles.fieldHeading}>Registration Number</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter Registration Number"
                          placeholderTextColor={COLORS.mutedText}
                          value={cacRegNumber}
                          onChangeText={setCacRegNumber}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.fieldHeading}>Date of Incorporation</Text>
                        <View style={styles.inputWithIcon}>
                          <TextInput
                            style={styles.inputInside}
                            placeholder="DD/MM/YYYY"
                            placeholderTextColor={COLORS.mutedText}
                            keyboardType="numeric"
                            maxLength={10}
                            value={dateOfIncorp}
                            onChangeText={t => handleDateInput(t, setDateOfIncorp)}
                          />
                          <Ionicons name="calendar-outline" size={16} color={COLORS.jtbGreen} />
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {/* Contact Phone Number */}
                <Text style={styles.fieldHeading}>Notification Phone / WhatsApp</Text>
                <TextInput
                  style={styles.input}
                  placeholder="08012345678"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phone}
                  onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                />
              </View>
            )}

            {/* ACTION SUBMIT BUTTON (Matching Screenshot Search Certificate) */}
            <TouchableOpacity
              style={[styles.searchBtn, loading && { opacity: 0.7 }]}
              onPress={handleSearchSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.searchBtnText}>
                  Search Certificate (₦{activeFee.toLocaleString()})
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              © 2026 Joint Revenue Board. All Rights Reserved. Go to Settings to activate Windows.
            </Text>
          </View>
        </ScrollView>
      ) : (
        /* ═════════════════════════════════════════════════════ */
        /* MY CERTIFICATES & REQUESTS HISTORY TAB               */
        /* ═════════════════════════════════════════════════════ */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.jtbGreen} />}
        >
          {historyList.length > 0 && (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={COLORS.subText} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search certificates..."
                placeholderTextColor={COLORS.mutedText}
                value={historySearch}
                onChangeText={setHistorySearch}
              />
            </View>
          )}

          {filteredHistory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={44} color={COLORS.mutedText} />
              <Text style={styles.emptyTitle}>No Tax ID Certificates Yet</Text>
              <Text style={styles.emptySub}>Your verified Tax ID certificates and retrieval requests will appear here.</Text>
            </View>
          ) : (
            filteredHistory.map((item, i) => {
              const details = item.details || {};
              const status = (details.status || item.status || 'PENDING').toUpperCase();
              const isDone = status === 'COMPLETED' || status === 'SUCCESS';
              const certUrl = details.certificate_url || details.download_url;
              const assignedTin = details.generated_tin || details.retrieved_tin || details.taxId;

              return (
                <View key={item.id || i} style={styles.historyCard}>
                  <View style={styles.historyCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyName} numberOfLines={1}>
                        {item.holder_name || 'Tax ID Applicant'}
                      </Text>
                      <Text style={styles.historyRef}>
                        {details.category === 'non_individual' ? 'Non-Individual' : 'Individual'} • Ref: {item.search_number || 'N/A'}
                      </Text>
                    </View>

                    <View style={[styles.badge, isDone ? styles.badgeDone : styles.badgePending]}>
                      <Text style={[styles.badgeText, isDone ? styles.badgeTextDone : styles.badgeTextPending]}>
                        {status}
                      </Text>
                    </View>
                  </View>

                  {assignedTin && (
                    <View style={styles.tinRow}>
                      <Text style={styles.tinLabel}>Assigned Tax ID: </Text>
                      <TouchableOpacity
                        onPress={() => copyText(assignedTin, 'Tax ID')}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={styles.tinValue}>{assignedTin}</Text>
                        <Ionicons name="copy-outline" size={12} color={COLORS.jtbGreenDark} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.historyFooter}>
                    <Text style={styles.historyDate}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                    </Text>

                    {certUrl ? (
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => {
                          if (Platform.OS === 'web') window.open(certUrl, '_blank');
                          else WebBrowser.openBrowserAsync(certUrl);
                        }}
                      >
                        <Ionicons name="download-outline" size={13} color={COLORS.white} style={{ marginRight: 4 }} />
                        <Text style={styles.downloadBtnText}>Download PDF</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.pendingNote}>Processing Search</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ───────────────── CONFIRMATION MODAL ───────────────── */}
      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Certificate Search</Text>
            <Text style={styles.modalSub}>
              {category === 'individual' ? 'Individual' : 'Non-Individual'} Certificate Retrieval
            </Text>

            <View style={styles.modalFeeRow}>
              <Text style={styles.modalFeeLabel}>Service Fee</Text>
              <Text style={styles.modalFeeVal}>₦{activeFee.toLocaleString()}</Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={executeSearch} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Search Certificate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───────────────── INSUFFICIENT BALANCE MODAL ───────────────── */}
      <Modal visible={insufficientModalVisible} transparent animationType="fade" onRequestClose={() => setInsufficientModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: COLORS.danger }]}>Insufficient Wallet Balance</Text>
            <Text style={styles.modalSub}>
              Available: ₦{walletBalance !== null ? walletBalance.toLocaleString() : '0'}. Required: ₦{activeFee.toLocaleString()}.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setInsufficientModalVisible(false)}>
                <Text style={styles.modalCancelText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: COLORS.gold }]}
                onPress={() => {
                  setInsufficientModalVisible(false);
                  router.push('/(app)/fund-wallet' as any);
                }}
              >
                <Text style={styles.modalSubmitText}>Fund Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ───────────────── SUCCESS MODAL ───────────────── */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.jtbGreen} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.modalTitle}>Search Request Submitted!</Text>
            <Text style={styles.modalSub}>Reference: {successRef}</Text>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: COLORS.jtbGreen, marginTop: 14 }]}
              onPress={() => {
                setSuccessModalVisible(false);
                setActiveTab('history');
              }}
            >
              <Text style={styles.modalSubmitText}>View in My Certificates</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ───────────────── INDIVIDUAL CRITERIA DROPDOWN MODAL ───────────────── */}
      <Modal visible={showIndivCriteriaModal} transparent animationType="fade" onRequestClose={() => setShowIndivCriteriaModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Search Criteria</Text>
            {[
              { id: 'nin_name_dob', label: 'NIN (with Name and DOB)' },
              { id: 'tax_id_dob', label: 'Tax ID (with DOB)' },
              { id: 'prev_tin_dob', label: 'Previous TIN (with DOB)' },
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.dropdownItemRow, indivCriteria === item.id && styles.dropdownItemRowActive]}
                onPress={() => {
                  setIndivCriteria(item.id as any);
                  setShowIndivCriteriaModal(false);
                }}
              >
                <Text style={[styles.dropdownItemText, indivCriteria === item.id && styles.dropdownItemTextActive]}>
                  {item.label}
                </Text>
                {indivCriteria === item.id && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ───────────────── CORPORATE CRITERIA DROPDOWN MODAL ───────────────── */}
      <Modal visible={showCorpCriteriaModal} transparent animationType="fade" onRequestClose={() => setShowCorpCriteriaModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Search Criteria</Text>
            {[
              { id: 'cac_reg', label: 'CAC Registration Number' },
              { id: 'tax_id', label: 'Tax ID' },
              { id: 'prev_tin', label: 'Previous JTB TIN' },
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.dropdownItemRow, corpCriteria === item.id && styles.dropdownItemRowActive]}
                onPress={() => {
                  setCorpCriteria(item.id as any);
                  setShowCorpCriteriaModal(false);
                }}
              >
                <Text style={[styles.dropdownItemText, corpCriteria === item.id && styles.dropdownItemTextActive]}>
                  {item.label}
                </Text>
                {corpCriteria === item.id && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ───────────────── ORGANIZATION TYPE MODAL (Screenshots 5 & 6) ───────────────── */}
      <Modal visible={showOrgModal} transparent animationType="slide" onRequestClose={() => setShowOrgModal(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Organization Type</Text>
              <TouchableOpacity onPress={() => setShowOrgModal(false)}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {ORGANIZATION_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={styles.sheetItem}
                  onPress={() => {
                    setOrgType(type);
                    setShowOrgModal(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, orgType === type && { fontWeight: '700', color: COLORS.jtbGreen }]}>
                    {type}
                  </Text>
                  {orgType === type && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────────── MDA CRITERIA MODAL ───────────────── */}
      <Modal visible={showMdaCriteriaModal} transparent animationType="fade" onRequestClose={() => setShowMdaCriteriaModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Search Criteria</Text>
            {[
              { id: 'registered_name', label: 'Registered Name' },
              { id: 'registration_number', label: 'Registration Number' },
              { id: 'tax_id', label: 'Tax ID' },
              { id: 'prev_tin', label: 'Previous JTB TIN' },
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.dropdownItemRow, mdaCriteria === item.id && styles.dropdownItemRowActive]}
                onPress={() => {
                  setMdaCriteria(item.id as any);
                  setShowMdaCriteriaModal(false);
                }}
              >
                <Text style={[styles.dropdownItemText, mdaCriteria === item.id && styles.dropdownItemTextActive]}>
                  {item.label}
                </Text>
                {mdaCriteria === item.id && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ───────────────── MDA TYPE MODAL ───────────────── */}
      <Modal visible={showMdaModal} transparent animationType="slide" onRequestClose={() => setShowMdaModal(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select MDA Type</Text>
              <TouchableOpacity onPress={() => setShowMdaModal(false)}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              {MDA_TYPES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={styles.sheetItem}
                  onPress={() => {
                    setMdaType(m);
                    setShowMdaModal(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, mdaType === m && { fontWeight: '700', color: COLORS.jtbGreen }]}>
                    {m}
                  </Text>
                  {mdaType === m && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ───────────────── COOP CRITERIA MODAL ───────────────── */}
      <Modal visible={showCoopCriteriaModal} transparent animationType="fade" onRequestClose={() => setShowCoopCriteriaModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Search Criteria</Text>
            {[
              { id: 'registration_number', label: 'Registration Number' },
              { id: 'tax_id', label: 'Tax ID' },
              { id: 'prev_tin', label: 'Previous JTB TIN' },
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.dropdownItemRow, coopCriteria === item.id && styles.dropdownItemRowActive]}
                onPress={() => {
                  setCoopCriteria(item.id as any);
                  setShowCoopCriteriaModal(false);
                }}
              >
                <Text style={[styles.dropdownItemText, coopCriteria === item.id && styles.dropdownItemTextActive]}>
                  {item.label}
                </Text>
                {coopCriteria === item.id && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ───────────────── STATE MODAL ───────────────── */}
      <Modal visible={showStateModal} transparent animationType="slide" onRequestClose={() => setShowStateModal(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select State of Registration</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.sheetSearch}
              placeholder="Search state..."
              placeholderTextColor={COLORS.mutedText}
              value={stateSearch}
              onChangeText={setStateSearch}
            />

            <ScrollView style={{ maxHeight: 280 }}>
              {filteredStates.map(st => (
                <TouchableOpacity
                  key={st}
                  style={styles.sheetItem}
                  onPress={() => {
                    setCoopState(st);
                    setShowStateModal(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, coopState === st && { fontWeight: '700', color: COLORS.jtbGreen }]}>
                    {st}
                  </Text>
                  {coopState === st && <Ionicons name="checkmark" size={16} color={COLORS.jtbGreen} />}
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navyDark,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.subText,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.jtbGreenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  walletPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.jtbGreenDark,
  },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
  },
  topTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  topTabBtnActive: {
    backgroundColor: COLORS.white,
  },
  topTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  topTabBtnTextActive: {
    color: COLORS.navyDark,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  portalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  portalCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  portalCardSubtitle: {
    fontSize: 12,
    color: COLORS.subText,
    marginTop: 2,
    marginBottom: 14,
  },
  fieldHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  categoryToggleBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  categoryOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  categoryOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  categoryOptionTextActive: {
    color: COLORS.jtbGreenDark,
    fontWeight: '800',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  dropdownTriggerText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  twoColRow: {
    flexDirection: 'row',
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  inputInside: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    height: '100%',
  },
  entityTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  entityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  entityChipActive: {
    borderColor: COLORS.jtbGreen,
    backgroundColor: COLORS.jtbGreenLight,
  },
  entityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.subText,
  },
  entityChipTextActive: {
    color: COLORS.jtbGreenDark,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: -8,
    marginBottom: 10,
  },
  searchBtn: {
    backgroundColor: COLORS.jtbGreen,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  searchBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 10,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginTop: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
  },
  historyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  historyRef: {
    fontSize: 10,
    color: COLORS.subText,
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeDone: {
    backgroundColor: COLORS.successBg,
  },
  badgePending: {
    backgroundColor: COLORS.warningBg,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  badgeTextDone: {
    color: COLORS.success,
  },
  badgeTextPending: {
    color: '#B45309',
  },
  tinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  tinLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.jtbGreenDark,
  },
  tinValue: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.jtbGreenDark,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  historyDate: {
    fontSize: 10,
    color: COLORS.mutedText,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.jtbGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  downloadBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },
  pendingNote: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  modalFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  modalFeeLabel: {
    fontSize: 12,
    color: COLORS.subText,
    fontWeight: '600',
  },
  modalFeeVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.jtbGreen,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.subText,
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.jtbGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  dropdownModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    maxWidth: 340,
  },
  dropdownModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemRowActive: {
    backgroundColor: COLORS.jtbGreenLight,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dropdownItemText: {
    fontSize: 13,
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    color: COLORS.jtbGreenDark,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  sheetSearch: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    fontSize: 12,
    marginBottom: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  sheetItemText: {
    fontSize: 13,
    color: COLORS.text,
  },
});
