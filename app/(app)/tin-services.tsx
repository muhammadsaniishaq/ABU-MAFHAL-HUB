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
  gold: '#d97706',
  goldBright: '#f59e0b',
  goldBg: '#fffbeb',
  white: '#ffffff',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#0f172a',
  subText: '#64748b',
  mutedText: '#94a3b8',
  border: '#e2e8f0',
  success: '#10b981',
  successBg: '#dcfce7',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  emerald: '#059669',
  emeraldDark: '#047857',
  emeraldLight: '#ecfdf5',
  blue: '#2563eb',
  blueLight: '#eff6ff',
};

export default function TinServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Navigation: Form vs History
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Category: Individual vs Business
  const [category, setCategory] = useState<'individual' | 'business'>('individual');

  // Action: Register vs Retrieve
  const [action, setAction] = useState<'register' | 'retrieve'>('register');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Pricing
  const [individualPrice, setIndividualPrice] = useState<number>(1500);
  const [businessPrice, setBusinessPrice] = useState<number>(3000);

  const activeFee = category === 'individual' ? individualPrice : businessPrice;

  // Individual Fields
  const [fullName, setFullName] = useState('');
  const [nin, setNin] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [taxId, setTaxId] = useState('');

  // Business Fields
  const [bizName, setBizName] = useState('');
  const [cacNumber, setCacNumber] = useState('');
  const [incorpDate, setIncorpDate] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorNin, setDirectorNin] = useState('');

  // Modals
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [insufficientModalVisible, setInsufficientModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successRef, setSuccessRef] = useState('');

  // History
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return STATE_LIST;
    return STATE_LIST.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase().trim()));
  }, [stateSearch]);

  const filteredHistory = useMemo(() => {
    return historyList.filter(item => {
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase().trim();
      const holder = (item.holder_name || '').toLowerCase();
      const ref = (item.search_number || '').toLowerCase();
      return holder.includes(q) || ref.includes(q);
    });
  }, [historyList, historySearch]);

  // Bottom clearance to ensure submit button is elevated comfortably above bottom navigation bar
  const bottomClearance = Math.max(insets.bottom, 24) + 140;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Fetch user profile
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
          if (profile.full_name && !fullName) setFullName(profile.full_name);
          if (profile.phone && !phone) setPhone(profile.phone);
        }
      }

      // 2. Fetch pricing
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

      // 3. Fetch history
      const items = await verificationHistory.getAll('tin');
      setHistoryList(items || []);
    } catch (e) {
      console.warn('Error loading TIN data:', e);
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

  const validateAndConfirm = () => {
    if (walletBalance !== null && walletBalance < activeFee) {
      setInsufficientModalVisible(true);
      return;
    }

    if (category === 'individual') {
      if (!fullName.trim()) return Alert.alert('Required', 'Please enter your Full Name.');
      const cleanNin = nin.replace(/\D/g, '');
      if (cleanNin.length !== 11 && !taxId.trim()) {
        return Alert.alert('Required', 'Please enter your 11-digit NIN.');
      }
      if (dob.length < 10) return Alert.alert('Required', 'Please enter Date of Birth (DD/MM/YYYY).');
      if (phone.replace(/\D/g, '').length < 11) return Alert.alert('Required', 'Please enter an 11-digit Phone number.');
    } else {
      if (!bizName.trim()) return Alert.alert('Required', 'Please enter Business / Company Name.');
      if (!cacNumber.trim() && !taxId.trim()) return Alert.alert('Required', 'Please enter CAC Registration Number (RC/BN).');
      if (incorpDate.length < 10) return Alert.alert('Required', 'Please enter Date of Incorporation (DD/MM/YYYY).');
      if (phone.replace(/\D/g, '').length < 11) return Alert.alert('Required', 'Please enter an 11-digit Phone number.');
    }

    setConfirmModalVisible(true);
  };

  const executeSubmit = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Please sign in to proceed.');

      // Balance check
      const { data: prof } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      const bal = Number(prof?.balance || 0);
      if (bal < activeFee) {
        setConfirmModalVisible(false);
        setInsufficientModalVisible(true);
        throw new Error('Insufficient wallet balance.');
      }

      // Deduct
      const newBal = bal - activeFee;
      const { error: debitErr } = await supabase
        .from('profiles')
        .update({ balance: newBal })
        .eq('id', userId)
        .gte('balance', activeFee);

      if (debitErr) throw new Error('Payment deduction failed. Please check wallet balance.');
      setWalletBalance(newBal);

      const txnRef = `TIN_${Date.now()}`;
      const applicant = category === 'individual' ? fullName.trim() : bizName.trim();
      const searchNum = category === 'individual' ? (nin.trim() || taxId.trim()) : (cacNumber.trim() || taxId.trim());

      // Transaction
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'debit',
        category: 'verification',
        amount: activeFee,
        status: 'success',
        reference: txnRef,
        description: `${category === 'individual' ? 'Individual' : 'Business'} Tax ID (${action}): ${applicant}`,
      });

      // Verification history
      await verificationHistory.save({
        service_category: 'tin',
        service_type: action === 'register' ? 'tin_registration' : 'tin_certificate_retrieval',
        search_number: searchNum,
        holder_name: applicant,
        layout: 'jtb_official_tin',
        details: {
          category,
          action,
          fee: activeFee,
          fullName: category === 'individual' ? fullName : undefined,
          nin: category === 'individual' ? nin : undefined,
          dob: category === 'individual' ? dob : undefined,
          state: category === 'individual' ? state : undefined,
          businessName: category === 'business' ? bizName : undefined,
          cacNumber: category === 'business' ? cacNumber : undefined,
          incorpDate: category === 'business' ? incorpDate : undefined,
          directorName: category === 'business' ? directorName : undefined,
          directorNin: category === 'business' ? directorNin : undefined,
          phone,
          taxId,
          txnRef,
          status: 'PENDING',
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
      Alert.alert('Error', err.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (t: string, label: string) => {
    Clipboard.setStringAsync(t);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    Alert.alert('Copied', `${label} copied.`);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* COMPACT CLEAN HEADER */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.headerTitle}>Tax ID / TIN</Text>
            <Text style={s.headerSubtitle}>Joint Tax Board (JTB) Portal</Text>
          </View>

          <View style={s.walletPill}>
            <Ionicons name="wallet-outline" size={13} color={COLORS.emerald} style={{ marginRight: 4 }} />
            <Text style={s.walletPillText}>
              ₦{walletBalance !== null ? walletBalance.toLocaleString() : '---'}
            </Text>
          </View>
        </View>

        {/* CLEAN TAB SWITCH */}
        <View style={s.tabBar}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'form' && s.tabBtnActive]}
            onPress={() => setActiveTab('form')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabBtnText, activeTab === 'form' && s.tabBtnTextActive]}>
              New Request
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'history' && s.tabBtnActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabBtnText, activeTab === 'history' && s.tabBtnTextActive]}>
              My Requests ({historyList.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'form' ? (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          {/* SMOOTH CATEGORY SWITCHER */}
          <View style={s.segmentContainer}>
            <TouchableOpacity
              style={[s.segmentBtn, category === 'individual' && s.segmentBtnActiveIndiv]}
              onPress={() => setCategory('individual')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person"
                size={16}
                color={category === 'individual' ? COLORS.emeraldDark : COLORS.subText}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.segmentText, category === 'individual' && s.segmentTextActiveIndiv]}>
                Individual • ₦{individualPrice.toLocaleString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.segmentBtn, category === 'business' && s.segmentBtnActiveBiz]}
              onPress={() => setCategory('business')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="business"
                size={16}
                color={category === 'business' ? '#1E40AF' : COLORS.subText}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.segmentText, category === 'business' && s.segmentTextActiveBiz]}>
                Business • ₦{businessPrice.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ACTION CHIPS: REGISTER VS RETRIEVE */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.actionChip, action === 'register' && s.actionChipActive]}
              onPress={() => setAction('register')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle-outline"
                size={14}
                color={action === 'register' ? COLORS.white : COLORS.subText}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.actionChipText, action === 'register' && s.actionChipTextActive]}>
                Register New TIN
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionChip, action === 'retrieve' && s.actionChipActive]}
              onPress={() => setAction('retrieve')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={action === 'retrieve' ? COLORS.white : COLORS.subText}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.actionChipText, action === 'retrieve' && s.actionChipTextActive]}>
                Retrieve Certificate
              </Text>
            </TouchableOpacity>
          </View>

          {/* STREAMLINED INPUT CARD */}
          <View style={s.card}>
            {category === 'individual' ? (
              <>
                <Text style={s.label}>Full Name (as on NIN)</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Ibrahim Abubakar"
                  placeholderTextColor={COLORS.mutedText}
                  value={fullName}
                  onChangeText={setFullName}
                />

                <Text style={s.label}>{action === 'register' ? 'NIN (11 Digits)' : 'NIN or Tax ID'}</Text>
                <TextInput
                  style={s.input}
                  placeholder="11-digit NIN or Tax ID"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="numeric"
                  value={nin}
                  onChangeText={t => setNin(t.replace(/\D/g, ''))}
                />

                <View style={s.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={s.label}>Date of Birth</Text>
                    <TextInput
                      style={s.input}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="numeric"
                      maxLength={10}
                      value={dob}
                      onChangeText={t => handleDateInput(t, setDob)}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={s.label}>Phone Number</Text>
                    <TextInput
                      style={s.input}
                      placeholder="08012345678"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={phone}
                      onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                    />
                  </View>
                </View>

                {action === 'register' && (
                  <>
                    <Text style={s.label}>State of Origin</Text>
                    <TouchableOpacity
                      style={s.pickerBtn}
                      onPress={() => {
                        setStateSearch('');
                        setShowStateModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={state ? s.pickerText : s.pickerPlaceholder}>
                        {state || 'Select State'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.subText} />
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={s.label}>Company / Business Name</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Abu Mafhal Integrated Services LTD"
                  placeholderTextColor={COLORS.mutedText}
                  value={bizName}
                  onChangeText={setBizName}
                />

                <View style={s.rowInputs}>
                  <View style={{ flex: 1.2, marginRight: 8 }}>
                    <Text style={s.label}>CAC Number (RC / BN)</Text>
                    <TextInput
                      style={s.input}
                      placeholder="e.g. RC123456"
                      placeholderTextColor={COLORS.mutedText}
                      autoCapitalize="characters"
                      value={cacNumber}
                      onChangeText={setCacNumber}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={s.label}>Incorp. Date</Text>
                    <TextInput
                      style={s.input}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.mutedText}
                      keyboardType="numeric"
                      maxLength={10}
                      value={incorpDate}
                      onChangeText={t => handleDateInput(t, setIncorpDate)}
                    />
                  </View>
                </View>

                <Text style={s.label}>Contact Phone Number</Text>
                <TextInput
                  style={s.input}
                  placeholder="08012345678"
                  placeholderTextColor={COLORS.mutedText}
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phone}
                  onChangeText={t => setPhone(t.replace(/\D/g, ''))}
                />

                {action === 'register' && (
                  <View style={s.rowInputs}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={s.label}>Director Name</Text>
                      <TextInput
                        style={s.input}
                        placeholder="Director Name"
                        placeholderTextColor={COLORS.mutedText}
                        value={directorName}
                        onChangeText={setDirectorName}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.label}>Director NIN</Text>
                      <TextInput
                        style={s.input}
                        placeholder="11-digit NIN"
                        placeholderTextColor={COLORS.mutedText}
                        keyboardType="numeric"
                        maxLength={11}
                        value={directorNin}
                        onChangeText={t => setDirectorNin(t.replace(/\D/g, ''))}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* DIRECT SUBMIT BUTTON */}
            <TouchableOpacity
              style={[s.submitBtn, loading && { opacity: 0.7 }]}
              onPress={validateAndConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={s.submitBtnText}>
                  Submit Request • ₦{activeFee.toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* MY REQUESTS TAB */
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          {historyList.length > 0 && (
            <View style={s.searchBox}>
              <Ionicons name="search" size={16} color={COLORS.subText} style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search requests..."
                placeholderTextColor={COLORS.mutedText}
                value={historySearch}
                onChangeText={setHistorySearch}
              />
            </View>
          )}

          {filteredHistory.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color={COLORS.mutedText} />
              <Text style={s.emptyTitle}>No Requests Yet</Text>
              <Text style={s.emptySub}>Your submitted Tax ID requests will appear here.</Text>
            </View>
          ) : (
            filteredHistory.map((item, i) => {
              const details = item.details || {};
              const status = (details.status || item.status || 'PENDING').toUpperCase();
              const isDone = status === 'COMPLETED' || status === 'SUCCESS';
              const certUrl = details.certificate_url || details.download_url;
              const assignedTin = details.generated_tin || details.retrieved_tin || details.taxId;

              return (
                <View key={item.id || i} style={s.historyCard}>
                  <View style={s.historyCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyName} numberOfLines={1}>
                        {item.holder_name || 'Tax ID Applicant'}
                      </Text>
                      <Text style={s.historyRef}>
                        {details.category === 'business' ? 'Business' : 'Individual'} • Ref: {item.search_number || 'N/A'}
                      </Text>
                    </View>

                    <View style={[s.badge, isDone ? s.badgeDone : s.badgePending]}>
                      <Text style={[s.badgeText, isDone ? s.badgeTextDone : s.badgeTextPending]}>
                        {status}
                      </Text>
                    </View>
                  </View>

                  {assignedTin && (
                    <View style={s.tinRow}>
                      <Text style={s.tinLabel}>Tax ID: </Text>
                      <TouchableOpacity
                        onPress={() => copyText(assignedTin, 'Tax ID')}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={s.tinValue}>{assignedTin}</Text>
                        <Ionicons name="copy-outline" size={12} color={COLORS.emeraldDark} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={s.historyFooter}>
                    <Text style={s.historyDate}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                    </Text>

                    {certUrl ? (
                      <TouchableOpacity
                        style={s.downloadBtn}
                        onPress={() => {
                          if (Platform.OS === 'web') window.open(certUrl, '_blank');
                          else WebBrowser.openBrowserAsync(certUrl);
                        }}
                      >
                        <Ionicons name="download-outline" size={13} color={COLORS.white} style={{ marginRight: 4 }} />
                        <Text style={s.downloadBtnText}>Certificate PDF</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={s.pendingNote}>In Progress</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* CONFIRMATION MODAL */}
      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Confirm Request</Text>
            <Text style={s.modalSub}>
              {category === 'individual' ? 'Individual' : 'Business'} Tax ID ({action === 'register' ? 'Registration' : 'Retrieval'})
            </Text>

            <View style={s.modalFeeRow}>
              <Text style={s.modalFeeLabel}>Service Fee</Text>
              <Text style={s.modalFeeVal}>₦{activeFee.toLocaleString()}</Text>
            </View>

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.modalSubmitBtn} onPress={executeSubmit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={s.modalSubmitText}>Confirm & Pay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* INSUFFICIENT BALANCE MODAL */}
      <Modal visible={insufficientModalVisible} transparent animationType="fade" onRequestClose={() => setInsufficientModalVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={[s.modalTitle, { color: COLORS.danger }]}>Insufficient Balance</Text>
            <Text style={s.modalSub}>
              Available: ₦{walletBalance !== null ? walletBalance.toLocaleString() : '0'}. Required: ₦{activeFee.toLocaleString()}.
            </Text>

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setInsufficientModalVisible(false)}>
                <Text style={s.modalCancelText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalSubmitBtn, { backgroundColor: COLORS.gold }]}
                onPress={() => {
                  setInsufficientModalVisible(false);
                  router.push('/(app)/fund-wallet' as any);
                }}
              >
                <Text style={s.modalSubmitText}>Fund Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.emerald} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={s.modalTitle}>Request Submitted!</Text>
            <Text style={s.modalSub}>Reference: {successRef}</Text>

            <TouchableOpacity
              style={[s.modalSubmitBtn, { backgroundColor: COLORS.emerald, marginTop: 14 }]}
              onPress={() => {
                setSuccessModalVisible(false);
                setActiveTab('history');
              }}
            >
              <Text style={s.modalSubmitText}>View in Requests</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* STATE MODAL */}
      <Modal visible={showStateModal} transparent animationType="slide" onRequestClose={() => setShowStateModal(false)}>
        <View style={s.sheetBackdrop}>
          <View style={s.sheetCard}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.sheetSearch}
              placeholder="Search state..."
              placeholderTextColor={COLORS.mutedText}
              value={stateSearch}
              onChangeText={setStateSearch}
            />

            <ScrollView style={{ maxHeight: 300 }}>
              {filteredStates.map(st => (
                <TouchableOpacity
                  key={st}
                  style={s.sheetItem}
                  onPress={() => {
                    setState(st);
                    setShowStateModal(false);
                  }}
                >
                  <Text style={[s.sheetItemText, state === st && { fontWeight: '700', color: COLORS.emerald }]}>
                    {st}
                  </Text>
                  {state === st && <Ionicons name="checkmark" size={16} color={COLORS.emerald} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.subText,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  walletPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emeraldDark,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  tabBtnTextActive: {
    fontWeight: '800',
    color: COLORS.navyDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActiveIndiv: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: COLORS.emerald,
  },
  segmentBtnActiveBiz: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: COLORS.blue,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  segmentTextActiveIndiv: {
    fontWeight: '800',
    color: COLORS.emeraldDark,
  },
  segmentTextActiveBiz: {
    fontWeight: '800',
    color: '#1E40AF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionChipActive: {
    backgroundColor: COLORS.navyDark,
    borderColor: COLORS.navyDark,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.subText,
  },
  actionChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  pickerText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  pickerPlaceholder: {
    fontSize: 13,
    color: COLORS.mutedText,
  },
  submitBtn: {
    backgroundColor: COLORS.navyDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
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
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.emeraldDark,
  },
  tinValue: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.emeraldDark,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyDate: {
    fontSize: 10,
    color: COLORS.mutedText,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
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
    backgroundColor: '#F8FAFC',
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
    color: COLORS.emerald,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
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
    backgroundColor: COLORS.navyDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
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
    backgroundColor: '#F1F5F9',
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
    borderBottomColor: '#F8FAFC',
  },
  sheetItemText: {
    fontSize: 13,
    color: COLORS.text,
  },
});
