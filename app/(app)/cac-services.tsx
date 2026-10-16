import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  ActivityIndicator, Alert, Image, Modal, StyleSheet, 
  Platform, KeyboardAvoidingView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../../services/supabase';
import DynamicBanners from '../../components/DynamicBanners';
import { NIGERIA_STATES, STATE_LIST } from '../../utils/nigeriaStates';
import {
  CacServiceCode,
  CacPricingConfig,
  CacCalculationResult,
  fetchCacPricingConfigurations,
  calculateCacPrice,
  resolveServiceCode,
  formatNaira,
  DEFAULT_CAC_PRICING_CONFIGS,
  CAC_SERVICES_ORDER,
} from '../../services/cacPricingService';

const COLORS = {
  navy: '#0d1b3e',
  navyMid: '#162854',
  navyLight: '#1f3875',
  gold: '#f5a623',
  goldLight: '#fff9ed',
  goldDk: '#d4890e',
  bg: '#f8fafc',
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
  textMain: '#0f172a',
  textSub: '#64748b',
  border: '#e2e8f0',
  borderFocus: '#94a3b8',
  error: '#ef4444',
  success: '#10b981',
  successLight: '#ecfdf5',
  info: '#3b82f6',
  infoLight: '#eff6ff',
};

const PLACEHOLDER_COLOR = '#94a3b8';

type Pricing = { 
  id: string; 
  name: string; 
  price: number; 
  original_price?: number | null;
  discount_label?: string | null;
  active?: boolean 
};

// Reusable Select Modal (Zero layout collision, high-performance modal picker with search)
const SelectModal = ({ 
  label, 
  value, 
  options = [], 
  onSelect, 
  placeholder = "Select option...", 
  required = false, 
  style, 
  title,
  searchable = true
}: any) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const safeOptions = Array.isArray(options) ? options : [];

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return safeOptions;
    const q = searchQuery.toLowerCase().trim();
    return safeOptions.filter((opt: string) => opt.toLowerCase().includes(q));
  }, [safeOptions, searchQuery]);

  return (
    <View style={[s.inputContainer, style]}>
      {label ? (
        <Text style={s.inputLabel}>
          {label} {required && <Text style={{ color: COLORS.error }}>*</Text>}
        </Text>
      ) : null}
      <TouchableOpacity 
        style={s.inputBox} 
        onPress={() => {
          if (safeOptions.length === 0) {
            Alert.alert('Notice', placeholder === 'Select State First' ? 'Please select State first.' : 'No options available.');
            return;
          }
          setSearchQuery('');
          setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={[s.inputText, !value && s.inputPlaceholderText]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.navy} />
      </TouchableOpacity>

      <Modal 
        visible={modalVisible} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.selectModalCard}>
            <View style={s.selectModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="list" size={18} color={COLORS.navy} />
                <Text style={s.selectModalTitle}>{title || label || 'Select Option'}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={22} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            {searchable && safeOptions.length > 5 && (
              <View style={s.searchBox}>
                <Ionicons name="search" size={14} color={COLORS.textSub} style={{ marginRight: 6 }} />
                <TextInput
                  style={s.searchInput}
                  placeholder={`Search ${label || 'options'}...`}
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={15} color={COLORS.textSub} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView 
              style={{ maxHeight: 320 }} 
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {filteredOptions.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: COLORS.textSub }}>No results found</Text>
                </View>
              ) : (
                filteredOptions.map((opt: string, i: number) => {
                  const isSelected = value === opt;
                  return (
                    <TouchableOpacity 
                      key={i} 
                      style={[s.selectModalItem, isSelected && s.selectModalItemActive]} 
                      onPress={() => { 
                        onSelect(opt); 
                        setModalVisible(false); 
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.selectModalItemTxt, isSelected && s.selectModalItemTxtActive]} numberOfLines={1}>
                        {opt}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={17} color={COLORS.navy} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Reusable Gender Selector (Segmented toggle with zero height shift)
const GenderSelector = ({ label = "Gender", value, onSelect, style }: any) => {
  return (
    <View style={[s.inputContainer, style]}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.genderRow}>
        {['Male', 'Female'].map((g) => {
          const isSel = (value || 'Male') === g;
          return (
            <TouchableOpacity
              key={g}
              style={[s.genderBtn, isSel && s.genderBtnActive]}
              onPress={() => onSelect(g)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={g === 'Male' ? "male" : "female"} 
                size={13} 
                color={isSel ? COLORS.white : COLORS.navy} 
              />
              <Text style={[s.genderBtnTxt, isSel && s.genderBtnTxtActive]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const CustomDropdown = SelectModal;

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = [
  { name: 'January', value: '01' }, { name: 'February', value: '02' }, { name: 'March', value: '03' },
  { name: 'April', value: '04' }, { name: 'May', value: '05' }, { name: 'June', value: '06' },
  { name: 'July', value: '07' }, { name: 'August', value: '08' }, { name: 'September', value: '09' },
  { name: 'October', value: '10' }, { name: 'November', value: '11' }, { name: 'December', value: '12' }
];
const YEARS = Array.from({ length: 70 }, (_, i) => String(2008 - i));

// Date Picker Modal (Mobile-first, compact & sleek)
const CustomDatePicker = ({ label, value, onChange, required = false, style }: any) => {
  const [showModal, setShowModal] = useState(false);
  const parts = (value || '').split('-');
  const [selYear, setSelYear] = useState(parts[0] || '1998');
  const [selMonth, setSelMonth] = useState(parts[1] || '05');
  const [selDay, setSelDay] = useState(parts[2] || '14');

  useEffect(() => {
    if (value && value.includes('-')) {
      const p = value.split('-');
      if (p.length === 3) {
        setSelYear(p[0]);
        setSelMonth(p[1]);
        setSelDay(p[2]);
      }
    }
  }, [value]);

  const handleConfirm = () => {
    onChange(`${selYear}-${selMonth}-${selDay}`);
    setShowModal(false);
  };

  const getMonthName = (mCode: string) => {
    const mObj = MONTHS.find(m => m.value === mCode);
    return mObj ? mObj.name : mCode;
  };

  const formattedDisplay = value 
    ? `${selDay} ${getMonthName(selMonth)} ${selYear}` 
    : 'Select date of birth';

  return (
    <View style={[s.inputContainer, style]}>
      <Text style={s.inputLabel}>
        {label} {required && <Text style={{ color: COLORS.error }}>*</Text>}
      </Text>
      <TouchableOpacity 
        style={s.inputBox} 
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <Text style={[s.inputText, !value && s.inputPlaceholderText]}>
          {formattedDisplay}
        </Text>
        <Ionicons name="calendar-outline" size={15} color={COLORS.navy} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.datePickerCard}>
            <View style={s.datePickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar" size={20} color={COLORS.navy} />
                <Text style={s.datePickerTitle}>Select Date of Birth</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={22} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <View style={s.selectedDateBadge}>
              <Text style={s.selectedDateLabel}>SELECTED DATE</Text>
              <Text style={s.selectedDateValue}>{selDay} {getMonthName(selMonth)} {selYear}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, height: 180, marginBottom: 16 }}>
              {/* Day */}
              <View style={s.wheelCol}>
                <Text style={s.wheelHeader}>DAY</Text>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {DAYS.map(d => (
                    <TouchableOpacity 
                      key={d} 
                      onPress={() => setSelDay(d)}
                      style={[s.wheelItem, selDay === d && s.wheelItemActive]}
                    >
                      <Text style={[s.wheelItemTxt, selDay === d && s.wheelItemTxtActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month */}
              <View style={[s.wheelCol, { flex: 1.4 }]}>
                <Text style={s.wheelHeader}>MONTH</Text>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {MONTHS.map(m => (
                    <TouchableOpacity 
                      key={m.value} 
                      onPress={() => setSelMonth(m.value)}
                      style={[s.wheelItem, selMonth === m.value && s.wheelItemActive]}
                    >
                      <Text style={[s.wheelItemTxt, selMonth === m.value && s.wheelItemTxtActive]} numberOfLines={1}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year */}
              <View style={s.wheelCol}>
                <Text style={s.wheelHeader}>YEAR</Text>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {YEARS.map(y => (
                    <TouchableOpacity 
                      key={y} 
                      onPress={() => setSelYear(y)}
                      style={[s.wheelItem, selYear === y && s.wheelItemActive]}
                    >
                      <Text style={[s.wheelItemTxt, selYear === y && s.wheelItemTxtActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={handleConfirm}>
              <Text style={s.btnPrimaryTxt}>Confirm Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function CACServices() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();

  // Flow State (Step 1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Pricing State
  const [pricings, setPricings] = useState<Pricing[]>([]);
  const [regType, setRegType] = useState<Pricing | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // Dynamic Pricing Configuration State
  const [pricingConfigs, setPricingConfigs] = useState<Record<CacServiceCode, CacPricingConfig>>({
    ...DEFAULT_CAC_PRICING_CONFIGS,
  });
  const [activeServiceCode, setActiveServiceCode] = useState<CacServiceCode>('business_name');
  const [shareCapital, setShareCapital] = useState<number>(1000000);
  const [customShareCapital, setCustomShareCapital] = useState<string>('');

  // TIN & Retrieval Add-on State
  const [includeTin, setIncludeTin] = useState(false);
  const [tinFee, setTinFee] = useState(3000);
  const [rcNumber, setRcNumber] = useState('');
  const [registrationYear, setRegistrationYear] = useState('');

  const handleSelectServiceCode = (code: CacServiceCode) => {
    const config = pricingConfigs[code] || DEFAULT_CAC_PRICING_CONFIGS[code];
    if (!config.is_available) {
      return Alert.alert('Service Unavailable', 'This registration service is currently offline for maintenance.');
    }
    setActiveServiceCode(code);
    const matched = pricings.find(p => p.id === code || resolveServiceCode(p.name) === code);
    const effectivePrice = config.is_promo_active && config.promo_price ? config.promo_price : config.regular_price;
    if (matched) {
      setRegType(matched);
    } else {
      setRegType({
        id: code,
        name: config.service_name,
        price: effectivePrice,
        original_price: config.regular_price,
      });
    }

    if (code === 'plc') {
      setShareCapital(2000000);
    } else if (code === 'ltd' || code === 'upgrade_to_ltd') {
      setShareCapital(1000000);
    }
  };

  // Form State: Names
  const [proposedName1, setProposedName1] = useState('');
  const [proposedName2, setProposedName2] = useState('');
  const [proposedName3, setProposedName3] = useState('');

  // Form State: Business Info
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [natureOfBusiness, setNatureOfBusiness] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [tenure, setTenure] = useState('');
  const [aims, setAims] = useState('');

  // Persons
  const defaultPerson = {
    fullName: '', dob: '', gender: 'Male', phone: '', nin: '', email: '',
    state: '', lga: '', houseNumber: '', address: '', signatureUri: '', passportUri: ''
  };

  const [proprietors, setProprietors] = useState([{ ...defaultPerson }]);
  const [chairman, setChairman] = useState({ ...defaultPerson });
  const [secretary, setSecretary] = useState({ ...defaultPerson });
  const [trustees, setTrustees] = useState([{ ...defaultPerson }]);
  const [witness, setWitness] = useState({ ...defaultPerson });

  useEffect(() => {
    fetchPricing();
    fetchUserBalance();
  }, []);

  const fetchUserBalance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).maybeSingle();
        if (profile) setWalletBalance(profile.balance || 0);
      }
    } catch (e) {
      console.log('Balance fetch err:', e);
    }
  };

  const fetchPricing = async () => {
    try {
      setLoading(true);
      
      const { configs, tinFee: fetchedTin } = await fetchCacPricingConfigurations();
      setPricingConfigs(configs);
      if (fetchedTin > 0) setTinFee(fetchedTin);

      const legacyPricings: Pricing[] = CAC_SERVICES_ORDER.map(code => {
        const c = configs[code];
        const effectivePrice = c.is_promo_active && c.promo_price ? c.promo_price : c.regular_price;
        return {
          id: c.service_code,
          name: c.service_name,
          price: effectivePrice,
          original_price: c.regular_price,
          discount_label: c.is_promo_active && c.regular_price > effectivePrice 
            ? `${Math.round(((c.regular_price - effectivePrice) / c.regular_price) * 100)}% OFF` 
            : null,
          active: c.is_available,
        };
      });

      setPricings(legacyPricings);

      if (editId) {
        await loadEditData(editId as string, legacyPricings);
      } else if (legacyPricings.length > 0) {
        setRegType(legacyPricings[0]);
        const initialCode = resolveServiceCode(legacyPricings[0].name);
        setActiveServiceCode(initialCode);
        if (initialCode === 'plc') {
          setShareCapital(2000000);
        } else if (initialCode === 'ltd' || initialCode === 'upgrade_to_ltd') {
          setShareCapital(1000000);
        }
      }
    } catch (e) {
      console.error('Pricing fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadEditData = async (id: string, availablePricings: Pricing[]) => {
    try {
      const { data, error } = await supabase.from('cac_requests').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setProposedName1(data.proposed_names?.name1 || '');
        setProposedName2(data.proposed_names?.name2 || '');
        setProposedName3(data.proposed_names?.name3 || '');

        if (data.business_info) {
          setEmail(data.business_info.email || '');
          setPhone(data.business_info.phone || '');
          setNatureOfBusiness(data.business_info.natureOfBusiness || '');
          setState(data.business_info.state || '');
          setLga(data.business_info.lga || '');
          setOfficeNumber(data.business_info.officeNumber || '');
          setOfficeAddress(data.business_info.officeAddress || '');
          setTenure(data.business_info.tenure || '');
          setRcNumber(data.business_info.rcNumber || '');
          setRegistrationYear(data.business_info.registrationYear || '');
          if (data.business_info.apply_with_tin !== undefined) {
            setIncludeTin(Boolean(data.business_info.apply_with_tin));
          }
          if (data.business_info.share_capital) {
            setShareCapital(Number(data.business_info.share_capital));
          }
        }

        if (data.proprietors && data.proprietors.length > 0) setProprietors(data.proprietors);
        if (data.chairman && Object.keys(data.chairman).length > 0) setChairman(data.chairman);
        if (data.secretary && Object.keys(data.secretary).length > 0) setSecretary(data.secretary);
        if (data.trustees && data.trustees.length > 0) setTrustees(data.trustees);
        if (data.witness && Object.keys(data.witness).length > 0) setWitness(data.witness);
        if (data.aims_and_objectives) setAims(data.aims_and_objectives);

        if (data.pricing_id || data.registration_type) {
          const resolvedCode = resolveServiceCode(data.registration_type || data.pricing_id);
          setActiveServiceCode(resolvedCode);
          const matchedPricing = availablePricings.find(p => p.id === data.pricing_id || p.id === resolvedCode);
          if (matchedPricing) setRegType(matchedPricing);
        }
      }
    } catch (e) {
      console.error('Error loading edit data:', e);
      Alert.alert('Error', 'Failed to load application data.');
    }
  };

  // Dynamic Calculation Result (Single Source of Truth)
  const currentConfig: CacPricingConfig = useMemo(() => {
    return pricingConfigs[activeServiceCode] || DEFAULT_CAC_PRICING_CONFIGS[activeServiceCode];
  }, [pricingConfigs, activeServiceCode]);

  const quoteCalculation: CacCalculationResult = useMemo(() => {
    const isCo = activeServiceCode === 'ltd' || activeServiceCode === 'plc' || activeServiceCode === 'upgrade_to_ltd';
    const effectiveShareCap = isCo ? shareCapital : 0;
    const directorsCount = isCo ? Math.max(proprietors.length, 1) : proprietors.length;
    const shareholdersCount = isCo ? Math.max(proprietors.length, 2) : 0;
    const trusteesCount = activeServiceCode === 'incorporated_trustee' ? trustees.length : 0;

    return calculateCacPrice(currentConfig, {
      shareCapital: effectiveShareCap,
      directorsCount,
      shareholdersCount,
      trusteesCount,
      includeTin,
      tinFee,
    });
  }, [currentConfig, activeServiceCode, shareCapital, proprietors.length, trustees.length, includeTin, tinFee]);

  const totalCost = quoteCalculation.totalAmount;

  const isNgo = activeServiceCode === 'incorporated_trustee' || regType?.name?.toLowerCase().includes('ngo');
  const isPartnership = activeServiceCode === 'business_name' && proprietors.length > 1;
  const isLimitedLiability = activeServiceCode === 'ltd' || activeServiceCode === 'plc' || activeServiceCode === 'upgrade_to_ltd';
  const isRetrieval = activeServiceCode === 'cac_retrieval';

  // Pick Image Helper
  const pickImage = async (setter: Function, field: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setter((prev: any) => ({ ...prev, [field]: result.assets[0].uri }));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickArrayImage = async (array: any[], index: number, field: string, setArray: Function) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newArr = [...array];
        newArr[index][field] = result.assets[0].uri;
        setArray(newArr);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadFileToSupabase = async (uri: string, path: string) => {
    if (!uri) return null;
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri; // Already uploaded
    const filename = uri.split('/').pop() || 'file.jpg';
    const filepath = `${path}/${Date.now()}_${filename}`;
    
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const { data, error } = await supabase.storage.from('cac_documents').upload(filepath, decode(base64), { contentType: 'image/jpeg' });
    if (error) throw error;
    
    const { data: publicData } = supabase.storage.from('cac_documents').getPublicUrl(filepath);
    return publicData.publicUrl;
  };

  const uploadPersonFiles = async (p: any, prefix: string) => {
    const copy = { ...p };
    if (copy.signatureUri) {
      copy.signatureUrl = await uploadFileToSupabase(copy.signatureUri, `${prefix}_signatures`);
      delete copy.signatureUri;
    }
    if (copy.passportUri) {
      copy.passportUrl = await uploadFileToSupabase(copy.passportUri, `${prefix}_passports`);
      delete copy.passportUri;
    }
    return copy;
  };

  // Step Validation
  const handleNextFromStep1 = () => {
    if (!regType) return Alert.alert('Notice', 'Please choose a registration service');
    if (isRetrieval) {
      if (!proposedName1.trim()) return Alert.alert('Required', 'Please enter Registered Business / Company Name');
      if (!rcNumber.trim()) return Alert.alert('Required', 'Please enter CAC RC or BN Number');
    } else {
      if (!proposedName1.trim()) return Alert.alert('Required', 'Please enter your Primary Proposed Business Name (Choice 1)');
      if (!isNgo && !proposedName2.trim()) return Alert.alert('Required', 'Please enter an Alternative Business Name (Choice 2)');
    }
    setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!isRetrieval) {
      if (!phone.trim()) return Alert.alert('Required', 'Please enter a contact phone number');
      if (!state) return Alert.alert('Required', 'Please select business state location');
    }
    setCurrentStep(3);
  };

  const handleNextFromStep3 = () => {
    // Basic verification for primary person
    const primaryPerson = isNgo ? chairman : proprietors[0];
    if (!primaryPerson.fullName.trim()) {
      return Alert.alert('Required', `Please enter the full name of ${isNgo ? 'Chairman' : 'Proprietor / Applicant'}`);
    }
    setCurrentStep(4);
  };

  // Final Submit Handler
  const handleSubmit = async () => {
    if (!regType) return Alert.alert('Error', 'Please select a service type');

    try {
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check balance first before heavy uploads
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
      if (!profile || profile.balance < totalCost) {
        throw new Error(`Insufficient wallet balance. You need ₦${totalCost.toLocaleString()} for this service.`);
      }

      // Process and upload files
      let uploadedProprietors = null;
      let uploadedChairman = null;
      let uploadedSecretary = null;
      let uploadedTrustees = null;

      if (isNgo) {
        uploadedChairman = await uploadPersonFiles(chairman, 'chairman');
        uploadedSecretary = await uploadPersonFiles(secretary, 'secretary');
        uploadedTrustees = await Promise.all(trustees.map((t, i) => uploadPersonFiles(t, `trustee_${i}`)));
      } else {
        uploadedProprietors = await Promise.all(proprietors.map((p, i) => uploadPersonFiles(p, `proprietor_${i}`)));
        if (isLimitedLiability) {
          uploadedChairman = await uploadPersonFiles(witness, 'witness');
          if (secretary.fullName) {
             uploadedSecretary = await uploadPersonFiles(secretary, 'secretary');
          }
        }
      }

      const businessInfo = {
        email, phone, natureOfBusiness, state, lga, officeNumber, officeAddress, tenure,
        rcNumber: isRetrieval ? rcNumber.trim() : undefined,
        registrationYear: isRetrieval ? registrationYear.trim() : undefined,
        service_code: activeServiceCode,
        share_capital: isLimitedLiability ? shareCapital : 0,
        directors_count: proprietors.length,
        shareholders_count: isLimitedLiability ? Math.max(proprietors.length, 2) : 0,
        trustees_count: isNgo ? trustees.length : 0,
        apply_with_tin: includeTin,
        tin_fee: includeTin ? tinFee : 0,
        base_price: quoteCalculation.effectiveBasePrice,
        regular_price: quoteCalculation.regularPrice,
        promo_savings: quoteCalculation.promoSavings,
        share_capital_fee: quoteCalculation.shareCapitalFee,
        directors_fee: quoteCalculation.directorsFee,
        shareholders_fee: quoteCalculation.shareholdersFee,
        trustees_fee: quoteCalculation.trusteesFee,
        total_cost: totalCost,
        quote_breakdown: quoteCalculation.items,
        quote_valid_until: quoteCalculation.quoteExpiresAt,
        is_retrieval: isRetrieval
      };

      const proposedNames = {
        name1: proposedName1,
        name2: isRetrieval ? proposedName1 : proposedName2,
        name3: proposedName3
      };

      if (editId) {
        const { error: updateError } = await supabase.from('cac_requests').update({
          pricing_id: regType.id,
          registration_type: regType.name,
          proposed_names: proposedNames,
          business_info: businessInfo,
          proprietors: uploadedProprietors,
          chairman: uploadedChairman,
          secretary: uploadedSecretary,
          trustees: uploadedTrustees,
          aims_and_objectives: aims,
          status: 'pending'
        }).eq('id', editId);

        if (updateError) throw updateError;

        Alert.alert('Success', 'CAC Application updated successfully!', [
          { text: 'View History', onPress: () => router.push('/cac-history') },
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      // New submission RPC (Charges wallet and notifies)
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_cac_request', {
        p_pricing_id: regType.id,
        p_registration_type: regType.name,
        p_proposed_names: proposedNames,
        p_business_info: businessInfo,
        p_proprietors: uploadedProprietors,
        p_chairman: uploadedChairman,
        p_secretary: uploadedSecretary,
        p_trustees: uploadedTrustees,
        p_aims_and_objectives: aims,
        p_cost: totalCost
      });

      if (rpcError) throw rpcError;

      Alert.alert('Success 🎉', isRetrieval ? 'Certificate Retrieval Request submitted successfully!' : 'CAC Registration submitted successfully!', [
        { text: 'View History', onPress: () => router.push('/cac-history') },
        { text: 'Done', onPress: () => router.back() }
      ]);
      
    } catch (e: any) {
      console.error(e);
      Alert.alert('Application Failed', e.message || 'Failed to submit CAC request');
    } finally {
      setSubmitting(false);
    }
  };

  // Render Person Card in Step 3
  const renderPersonForm = (person: any, title: string, setter: Function, isArray: boolean = false, index: number = 0, onRemove?: () => void) => {
    const updateField = (f: string, v: string) => {
      if (isArray) {
        setter((prev: any[]) => {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], [f]: v };
          return newArr;
        });
      } else {
        setter((prev: any) => ({ ...prev, [f]: v }));
      }
    };

    const data = isArray ? person[index] : person;

    return (
      <View style={s.personCard} key={title + index}>
        <View style={s.personCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={s.personAvatarIcon}>
              <Ionicons name="person" size={15} color={COLORS.navy} />
            </View>
            <Text style={s.personCardTitle}>{title}</Text>
          </View>
          {onRemove && (
            <TouchableOpacity onPress={onRemove} style={s.removeBtn}>
              <Ionicons name="trash-outline" size={14} color={COLORS.error} />
              <Text style={s.removeBtnTxt}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.inputContainer}>
          <Text style={s.inputLabel}>Full Legal Name <Text style={{ color: COLORS.error }}>*</Text></Text>
          <TextInput 
            style={s.inputBox} 
            placeholder="Full name as on NIN / ID"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={data.fullName} 
            onChangeText={t => updateField('fullName', t)} 
          />
        </View>

        <View style={s.formGrid2}>
          <CustomDatePicker style={{ flex: 1, minWidth: 0 }} label="Date of Birth" value={data.dob} onChange={(v: string) => updateField('dob', v)} required />
          <GenderSelector style={{ flex: 1, minWidth: 0 }} label="Gender" value={data.gender} onSelect={(v: string) => updateField('gender', v)} />
        </View>

        <View style={s.formGrid2}>
          <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
            <Text style={s.inputLabel}>Phone Number <Text style={{ color: COLORS.error }}>*</Text></Text>
            <TextInput 
              style={s.inputBox} 
              keyboardType="phone-pad" 
              placeholder="e.g. 08012345678" 
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={data.phone} 
              onChangeText={t => updateField('phone', t)} 
            />
          </View>
          <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
            <Text style={s.inputLabel}>NIN (11 Digits)</Text>
            <TextInput 
              style={s.inputBox} 
              keyboardType="numeric" 
              maxLength={11} 
              placeholder="11-digit NIN" 
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={data.nin} 
              onChangeText={t => updateField('nin', t)} 
            />
          </View>
        </View>

        <View style={s.inputContainer}>
          <Text style={s.inputLabel}>Email Address</Text>
          <TextInput 
            style={s.inputBox} 
            keyboardType="email-address" 
            placeholder="officer@email.com" 
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={data.email} 
            onChangeText={t => updateField('email', t)} 
          />
        </View>

        <View style={s.formGrid2}>
          <SelectModal 
            style={{ flex: 1, minWidth: 0 }} 
            label="State of Origin" 
            title="Select State of Origin"
            value={data.state} 
            options={STATE_LIST} 
            onSelect={(val: string) => { updateField('state', val); updateField('lga', ''); }} 
          />
          <SelectModal 
            style={{ flex: 1, minWidth: 0 }} 
            label="LGA" 
            title={data.state ? `${data.state} State LGAs` : 'Select LGA'}
            value={data.lga} 
            options={data.state ? NIGERIA_STATES[data.state] : []} 
            onSelect={(v: string) => updateField('lga', v)} 
            placeholder="Select State First" 
          />
        </View>

        <View style={s.inputContainer}>
          <Text style={s.inputLabel}>Residential Address</Text>
          <TextInput 
            style={s.inputBox} 
            placeholder="Street address, house number, area" 
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={data.address} 
            onChangeText={t => updateField('address', t)} 
          />
        </View>

        {/* Upload Tiles with Live Preview */}
        <View style={s.uploadGrid}>
          {/* Signature Upload */}
          <TouchableOpacity 
            style={[s.uploadTile, data.signatureUri && s.uploadTileDone]} 
            onPress={() => isArray ? pickArrayImage(person as any[], index, 'signatureUri', setter) : pickImage(setter, 'signatureUri')}
            activeOpacity={0.8}
          >
            {data.signatureUri ? (
              <View style={s.uploadThumbWrapper}>
                <Image source={{ uri: data.signatureUri }} style={s.uploadedThumbImg} resizeMode="contain" />
                <View style={s.uploadDoneBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
                  <Text style={s.uploadDoneBadgeTxt}>Signature Added</Text>
                </View>
                <Text style={s.uploadChangeTxt}>Tap to replace</Text>
              </View>
            ) : (
              <>
                <View style={s.uploadIconBadge}>
                  <Ionicons name="create-outline" size={19} color={COLORS.navy} />
                </View>
                <Text style={s.uploadTileTitle}>Applicant Signature</Text>
                <Text style={s.uploadTileSub}>Sign on plain paper & snap photo</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Passport Upload */}
          <TouchableOpacity 
            style={[s.uploadTile, data.passportUri && s.uploadTileDone]} 
            onPress={() => isArray ? pickArrayImage(person as any[], index, 'passportUri', setter) : pickImage(setter, 'passportUri')}
            activeOpacity={0.8}
          >
            {data.passportUri ? (
              <View style={s.uploadThumbWrapper}>
                <Image source={{ uri: data.passportUri }} style={s.uploadedThumbImg} resizeMode="cover" />
                <View style={s.uploadDoneBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
                  <Text style={s.uploadDoneBadgeTxt}>Passport Added</Text>
                </View>
                <Text style={s.uploadChangeTxt}>Tap to replace</Text>
              </View>
            ) : (
              <>
                <View style={s.uploadIconBadge}>
                  <Ionicons name="camera-outline" size={19} color={COLORS.navy} />
                </View>
                <Text style={s.uploadTileTitle}>Passport Photo</Text>
                <Text style={s.uploadTileSub}>Clear front portrait photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      {/* Sleek Gradient Header */}
      <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerIconBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={s.headerTitleArea}>
          <Text style={s.headerTitle}>{editId ? 'Edit CAC Application' : 'CAC Registration'}</Text>
          <Text style={s.headerSubtitle}>Official CAC & Business Registration Hub</Text>
        </View>
        <TouchableOpacity style={s.historyBtn} onPress={() => router.push('/cac-history')} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={15} color={COLORS.gold} />
          <Text style={s.historyBtnTxt}>History</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Modern 4-Step Stepper Bar */}
      <View style={s.stepperBar}>
        {[
          { num: 1, label: 'Service' },
          { num: 2, label: 'Business' },
          { num: 3, label: 'Officers' },
          { num: 4, label: 'Review' },
        ].map((st, idx) => {
          const isActive = currentStep === st.num;
          const isDone = currentStep > st.num;
          return (
            <React.Fragment key={st.num}>
              <TouchableOpacity 
                style={s.stepItem} 
                onPress={() => isDone && setCurrentStep(st.num)} 
                disabled={!isDone}
                activeOpacity={0.7}
              >
                <View style={[s.stepCircle, isActive && s.stepCircleActive, isDone && s.stepCircleDone]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={13} color={COLORS.white} />
                  ) : (
                    <Text style={[s.stepNum, isActive && s.stepNumActive]}>{st.num}</Text>
                  )}
                </View>
                <Text style={[s.stepLabel, isActive && s.stepLabelActive, isDone && s.stepLabelDone]}>
                  {st.label}
                </Text>
              </TouchableOpacity>
              {idx < 3 && <View style={[s.stepDivider, currentStep > idx + 1 && s.stepDividerDone]} />}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Dynamic Promotional Banner */}
        <DynamicBanners placement="cac" />

        {/* ======================================================== */}
        {/* STEP 1: SERVICE & PROPOSED NAME */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <View style={s.stepContent}>
            
            <View style={s.sectionTitleRow}>
              <View style={s.sectionNumberBadge}>
                <Text style={s.sectionNumberTxt}>1</Text>
              </View>
              <View>
                <Text style={s.stepHeading}>Choose Service Type</Text>
                <Text style={s.stepSubheading}>Select the CAC registration or document category</Text>
              </View>
            </View>

            {/* Choose Service Dropdown & Mobile Pills */}
            {loading ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.navy} />
                <Text style={{ marginTop: 8, fontSize: 13, color: COLORS.textSub }}>Loading available services...</Text>
              </View>
            ) : (
              <View style={s.serviceDropdownCard}>
                <Text style={s.inputLabel}>
                  Select Service Package <Text style={{ color: COLORS.error }}>*</Text>
                </Text>

                {/* Mobile Fast Service Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                  {CAC_SERVICES_ORDER.map((code) => {
                    const cfg = pricingConfigs[code] || DEFAULT_CAC_PRICING_CONFIGS[code];
                    const isSel = activeServiceCode === code;
                    const effPrice = cfg.is_promo_active && cfg.promo_price ? cfg.promo_price : cfg.regular_price;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[s.quickPill, isSel && s.quickPillActive]}
                        onPress={() => !editId && handleSelectServiceCode(code)}
                        disabled={Boolean(editId) || !cfg.is_available}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.quickPillTxt, isSel && s.quickPillTxtActive]}>
                          {code === 'business_name' ? 'Business Name' :
                           code === 'ltd' ? 'LTD Company' :
                           code === 'incorporated_trustee' ? 'NGO / Trustee' :
                           code === 'cac_retrieval' ? 'Retrieval' :
                           code === 'plc' ? 'PLC' : 'Upgrade LTD'}
                        </Text>
                        <Text style={[s.quickPillPrice, isSel && s.quickPillPriceActive]}>
                          ₦{effPrice >= 1000 ? `${(effPrice / 1000).toFixed(0)}k` : effPrice}
                        </Text>
                        {cfg.is_promo_active && cfg.regular_price > effPrice && (
                          <View style={s.quickPillPromoBadge}>
                            <Text style={s.quickPillPromoBadgeTxt}>PROMO</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={s.serviceSelectTrigger}
                  onPress={() => !editId && setShowServiceModal(true)}
                  disabled={Boolean(editId)}
                  activeOpacity={0.85}
                >
                  <View style={s.serviceSelectIconBox}>
                    <Ionicons 
                      name={isRetrieval ? "document-text" : isNgo ? "people" : "briefcase"} 
                      size={20} 
                      color={COLORS.goldDk} 
                    />
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={s.serviceSelectName} numberOfLines={1}>
                        {currentConfig.service_name}
                      </Text>
                      {quoteCalculation.isPromoActive && quoteCalculation.promoSavings > 0 && (
                        <View style={s.discountBadgePill}>
                          <Ionicons name="pricetag" size={10} color="#15803d" />
                          <Text style={s.discountBadgePillTxt}>
                            Save {formatNaira(quoteCalculation.promoSavings)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                      <Text style={s.serviceSelectPrice}>
                        {formatNaira(quoteCalculation.effectiveBasePrice)}
                      </Text>
                      {quoteCalculation.isPromoActive && quoteCalculation.regularPrice > quoteCalculation.effectiveBasePrice && (
                        <Text style={s.serviceSelectOrigPrice}>
                          {formatNaira(quoteCalculation.regularPrice)}
                        </Text>
                      )}
                      <Text style={{ fontSize: 11, color: COLORS.textSub, marginLeft: 4 }}>
                        • ⏱ {currentConfig.processing_time}
                      </Text>
                    </View>
                  </View>

                  <View style={s.serviceSelectChevron}>
                    <Ionicons name="chevron-down" size={18} color={COLORS.navy} />
                  </View>
                </TouchableOpacity>

                {/* Dropdown Modal Selection Sheet */}
                <Modal visible={showServiceModal} transparent animationType="slide" onRequestClose={() => setShowServiceModal(false)}>
                  <View style={s.modalBackdrop}>
                    <View style={s.serviceModalCard}>
                      <View style={s.serviceModalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="briefcase" size={20} color={COLORS.navy} />
                          <Text style={s.serviceModalTitle}>Select CAC Service</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowServiceModal(false)} style={{ padding: 4 }}>
                          <Ionicons name="close-circle" size={24} color={COLORS.textSub} />
                        </TouchableOpacity>
                      </View>

                      <Text style={s.serviceModalSubtitle}>
                        Select from available official registration and search packages below:
                      </Text>

                      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                        {CAC_SERVICES_ORDER.map((code) => {
                          const config = pricingConfigs[code] || DEFAULT_CAC_PRICING_CONFIGS[code];
                          const isSelected = activeServiceCode === code;
                          const effectivePrice = config.is_promo_active && config.promo_price ? config.promo_price : config.regular_price;
                          const hasDiscount = config.is_promo_active && config.regular_price > effectivePrice;
                          const isCert = code === 'cac_retrieval';
                          const isNgoType = code === 'incorporated_trustee';
                          const discountPct = hasDiscount ? Math.round(((config.regular_price - effectivePrice) / config.regular_price) * 100) : 0;

                          return (
                            <TouchableOpacity
                              key={code}
                              style={[s.serviceModalItem, isSelected && s.serviceModalItemActive, !config.is_available && { opacity: 0.6 }]}
                              onPress={() => {
                                if (!config.is_available) {
                                  return Alert.alert('Service Unavailable', 'This registration service is currently offline for maintenance.');
                                }
                                setActiveServiceCode(code);
                                const matched = pricings.find(p => p.id === code || resolveServiceCode(p.name) === code);
                                if (matched) {
                                  setRegType(matched);
                                } else {
                                  setRegType({
                                    id: code,
                                    name: config.service_name,
                                    price: effectivePrice,
                                    original_price: config.regular_price,
                                  });
                                }

                                if (code === 'plc') {
                                  setShareCapital(2000000);
                                } else if (code === 'ltd' || code === 'upgrade_to_ltd') {
                                  setShareCapital(1000000);
                                }
                                setShowServiceModal(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={[s.serviceModalItemIcon, isSelected && { backgroundColor: COLORS.navy }]}>
                                <Ionicons 
                                  name={isCert ? "document-text" : isNgoType ? "people" : "briefcase"} 
                                  size={18} 
                                  color={isSelected ? COLORS.white : COLORS.navy} 
                                />
                              </View>

                              <View style={{ flex: 1, marginHorizontal: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[s.serviceModalItemName, isSelected && { color: COLORS.navy, fontWeight: '800' }]}>
                                    {config.service_name}
                                  </Text>
                                  {!config.is_available && (
                                    <View style={[s.discountBadgePill, { backgroundColor: '#fee2e2' }]}>
                                      <Text style={[s.discountBadgePillTxt, { color: '#dc2626' }]}>Offline</Text>
                                    </View>
                                  )}
                                </View>

                                <Text style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>
                                  ⏱ {config.processing_time}
                                  {config.included_share_capital > 0 ? ` • Inc. ₦${(config.included_share_capital / 1000000).toFixed(0)}M Share` : ''}
                                  {config.included_directors > 0 ? ` • ${config.included_directors} Directors Inc.` : ''}
                                  {config.included_trustees > 0 ? ` • ${config.included_trustees} Trustees Inc.` : ''}
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                  <Text style={s.serviceModalItemPrice}>
                                    ₦{effectivePrice.toLocaleString()}
                                  </Text>
                                  {hasDiscount && (
                                    <Text style={s.serviceModalItemOrigPrice}>
                                      ₦{config.regular_price.toLocaleString()}
                                    </Text>
                                  )}
                                  {hasDiscount && (
                                    <View style={s.discountBadgePill}>
                                      <Text style={s.discountBadgePillTxt}>
                                        Save ₦{(config.regular_price - effectivePrice).toLocaleString()} ({discountPct}% OFF)
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>

                              <View style={[s.radioCircle, isSelected && s.radioCircleSelected]}>
                                {isSelected && <View style={s.radioInner} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </View>
            )}

            {/* TIN Processing Add-on (Clean switch-like card) */}
            <TouchableOpacity 
              style={[s.tinCard, includeTin && s.tinCardActive]} 
              onPress={() => setIncludeTin(!includeTin)}
              activeOpacity={0.8}
            >
              <View style={[s.tinCheckbox, includeTin && s.tinCheckboxActive]}>
                {includeTin && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.tinTitle}>Apply with TIN (Tax ID)</Text>
                  <Text style={s.tinPrice}>+₦{tinFee.toLocaleString()}</Text>
                </View>
                <Text style={s.tinSub}>Process official JTB Tax Identification Number alongside your registration.</Text>
              </View>
            </TouchableOpacity>

            {/* Names Input Section */}
            <View style={s.cleanCard}>
              <Text style={s.cardSectionTitle}>
                {isRetrieval ? 'REGISTERED BUSINESS INFO' : 'PROPOSED BUSINESS NAMES'}
              </Text>
              
              {isRetrieval ? (
                <>
                  <View style={s.inputContainer}>
                    <Text style={s.inputLabel}>Registered Business / Company Name <Text style={{ color: COLORS.error }}>*</Text></Text>
                    <TextInput 
                      style={s.inputBox} 
                      placeholder="e.g. Abu Mafhal Multi Services"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={proposedName1} 
                      onChangeText={setProposedName1} 
                    />
                  </View>

                  <View style={s.formGrid2}>
                    <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                      <Text style={s.inputLabel}>RC or BN Number <Text style={{ color: COLORS.error }}>*</Text></Text>
                      <TextInput 
                        style={s.inputBox} 
                        placeholder="e.g. BN-1234567" 
                        placeholderTextColor={PLACEHOLDER_COLOR}
                        value={rcNumber} 
                        onChangeText={setRcNumber} 
                      />
                    </View>
                    <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                      <Text style={s.inputLabel}>Registration Year</Text>
                      <TextInput 
                        style={s.inputBox} 
                        placeholder="e.g. 2021" 
                        placeholderTextColor={PLACEHOLDER_COLOR}
                        keyboardType="numeric"
                        value={registrationYear} 
                        onChangeText={setRegistrationYear} 
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.inputContainer}>
                    <Text style={s.inputLabel}>Proposed Name 1 (Primary Choice) <Text style={{ color: COLORS.error }}>*</Text></Text>
                    <TextInput 
                      style={s.inputBox} 
                      placeholder="e.g. Abu Mafhal General Merchant"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={proposedName1} 
                      onChangeText={setProposedName1} 
                    />
                  </View>

                  <View style={s.inputContainer}>
                    <Text style={s.inputLabel}>
                      Proposed Name 2 (Alternative Choice) {!isNgo && <Text style={{ color: COLORS.error }}>*</Text>}
                    </Text>
                    <TextInput 
                      style={s.inputBox} 
                      placeholder="e.g. Abu Mafhal Integrated Services"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={proposedName2} 
                      onChangeText={setProposedName2} 
                    />
                  </View>

                  {isNgo && (
                    <View style={s.inputContainer}>
                      <Text style={s.inputLabel}>Proposed Name 3 (Optional for NGO)</Text>
                      <TextInput 
                        style={s.inputBox} 
                        placeholder="Optional third alternative choice"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                        value={proposedName3} 
                        onChangeText={setProposedName3} 
                      />
                    </View>
                  )}
                </>
              )}
            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 2: BUSINESS & CONTACT DETAILS */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <View style={s.stepContent}>
            
            <View style={s.sectionTitleRow}>
              <View style={s.sectionNumberBadge}>
                <Text style={s.sectionNumberTxt}>2</Text>
              </View>
              <View>
                <Text style={s.stepHeading}>Business & Contact Info</Text>
                <Text style={s.stepSubheading}>Provide operational office address and contact channels</Text>
              </View>
            </View>

            <View style={s.cleanCard}>
              <Text style={s.cardSectionTitle}>CONTACT CHANNELS</Text>
              
              <View style={s.formGrid2}>
                <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                  <Text style={s.inputLabel}>Contact Phone <Text style={{ color: COLORS.error }}>*</Text></Text>
                  <TextInput 
                    style={s.inputBox} 
                    keyboardType="phone-pad" 
                    placeholder="e.g. 08012345678" 
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={phone} 
                    onChangeText={setPhone} 
                  />
                </View>
                <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                  <Text style={s.inputLabel}>Contact Email</Text>
                  <TextInput 
                    style={s.inputBox} 
                    keyboardType="email-address" 
                    placeholder="company@email.com" 
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={email} 
                    onChangeText={setEmail} 
                  />
                </View>
              </View>

              <View style={s.inputContainer}>
                <Text style={s.inputLabel}>Nature of Business / Core Activities</Text>
                <TextInput 
                  style={s.inputBox} 
                  placeholder="e.g. Trading, General Contracts, Logistics" 
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={natureOfBusiness} 
                  onChangeText={setNatureOfBusiness} 
                />
              </View>
            </View>

            <View style={s.cleanCard}>
              <Text style={s.cardSectionTitle}>OPERATIONAL ADDRESS</Text>
              
              <View style={s.formGrid2}>
                <SelectModal 
                  style={{ flex: 1, minWidth: 0 }}
                  label="State Location" 
                  title="Select State Location"
                  value={state} 
                  options={STATE_LIST} 
                  onSelect={(val: string) => { setState(val); setLga(''); }} 
                  required 
                />
                <SelectModal 
                  style={{ flex: 1, minWidth: 0 }}
                  label="LGA / City" 
                  title={state ? `${state} State LGAs` : 'Select LGA / City'}
                  value={lga} 
                  options={state ? NIGERIA_STATES[state] : []} 
                  onSelect={setLga} 
                  placeholder="Select State First" 
                />
              </View>

              <View style={s.formGrid2}>
                <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                  <Text style={s.inputLabel}>Shop / Suite / House No.</Text>
                  <TextInput 
                    style={s.inputBox} 
                    placeholder="e.g. Suite 4B or No. 12" 
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={officeNumber} 
                    onChangeText={setOfficeNumber} 
                  />
                </View>
                <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                  <Text style={s.inputLabel}>Street / Area</Text>
                  <TextInput 
                    style={s.inputBox} 
                    placeholder="e.g. Ahmadu Bello Way" 
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={officeAddress} 
                    onChangeText={setOfficeAddress} 
                  />
                </View>
              </View>

              {isNgo && (
                <>
                  <View style={s.inputContainer}>
                    <Text style={s.inputLabel}>Trustees Tenure (Years)</Text>
                    <TextInput 
                      style={s.inputBox} 
                      keyboardType="numeric" 
                      placeholder="e.g. 5" 
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={tenure} 
                      onChangeText={setTenure} 
                    />
                  </View>
                  <View style={s.inputContainer}>
                    <Text style={s.inputLabel}>Aims & Objectives</Text>
                    <TextInput 
                      style={[s.inputBox, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]} 
                      multiline 
                      placeholder="Brief summary of organizational aims & goals..."
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={aims} 
                      onChangeText={setAims} 
                    />
                  </View>
                </>
              )}
            </View>

            {/* COMPANY AUTHORIZED SHARE CAPITAL SECTION */}
            {isLimitedLiability && (
              <View style={s.cleanCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={s.cardSectionTitle}>AUTHORIZED SHARE CAPITAL</Text>
                  {quoteCalculation.shareCapitalFee > 0 && (
                    <View style={s.calcExtraBadge}>
                      <Text style={s.calcExtraBadgeTxt}>+{formatNaira(quoteCalculation.shareCapitalFee)} extra</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: COLORS.textSub, marginBottom: 12, lineHeight: 17 }}>
                  Base package covers up to{' '}
                  <Text style={{ fontWeight: '700', color: COLORS.navy }}>{formatNaira(currentConfig.included_share_capital)}</Text> share capital.
                  {currentConfig.share_capital_increment_fee > 0 && (
                    <Text>
                      {' '}Each additional {formatNaira(currentConfig.share_capital_increment_step)} is charged at{' '}
                      <Text style={{ fontWeight: '700', color: COLORS.goldDk }}>+{formatNaira(currentConfig.share_capital_increment_fee)}</Text>.
                    </Text>
                  )}
                </Text>

                {/* Quick Selection Buttons */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    currentConfig.included_share_capital || 1000000,
                    2000000,
                    5000000,
                    10000000,
                  ].map((cap) => {
                    const active = shareCapital === cap;
                    const isBase = cap === currentConfig.included_share_capital;
                    return (
                      <TouchableOpacity
                        key={cap}
                        style={[s.shareCapChip, active && s.shareCapChipActive]}
                        onPress={() => {
                          setShareCapital(cap);
                          setCustomShareCapital('');
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.shareCapChipTxt, active && s.shareCapChipTxtActive]}>
                          ₦{(cap / 1000000).toFixed(0)} Million {isBase ? '(Included)' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Share Capital Option */}
                <View style={s.inputContainer}>
                  <Text style={s.inputLabel}>Or Enter Custom Share Capital (₦)</Text>
                  <TextInput
                    style={s.inputBox}
                    keyboardType="numeric"
                    placeholder={`e.g. ${(currentConfig.included_share_capital || 1000000).toLocaleString()}`}
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={customShareCapital}
                    onChangeText={(val) => {
                      setCustomShareCapital(val);
                      const num = parseFloat(val.replace(/[^0-9]/g, ''));
                      if (!isNaN(num) && num > 0) {
                        setShareCapital(num);
                      } else if (!val) {
                        setShareCapital(currentConfig.included_share_capital || 1000000);
                      }
                    }}
                  />
                  <Text style={{ fontSize: 11, color: COLORS.textSub, marginTop: 4 }}>
                    Current Selected Capital: <Text style={{ fontWeight: '700', color: COLORS.navy }}>{formatNaira(shareCapital)}</Text>
                    {quoteCalculation.shareCapitalFee > 0
                      ? ` (${quoteCalculation.shareCapitalIncrements} extra increment(s) = +${formatNaira(quoteCalculation.shareCapitalFee)})`
                      : ' (Fully covered in base fee)'}
                  </Text>
                </View>
              </View>
            )}

          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 3: OFFICERS & UPLOADS */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <View style={s.stepContent}>
            
            <View style={s.sectionTitleRow}>
              <View style={s.sectionNumberBadge}>
                <Text style={s.sectionNumberTxt}>3</Text>
              </View>
              <View>
                <Text style={s.stepHeading}>Officers & Identification</Text>
                <Text style={s.stepSubheading}>Personal details, signature, and passport photos</Text>
              </View>
            </View>

            {/* Dynamic Director Allowance Banner */}
            {isLimitedLiability && (
              <View style={s.allowanceBanner}>
                <View style={s.allowanceIconBox}>
                  <Ionicons name="people" size={20} color={COLORS.navy} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.allowanceTitle}>
                    Director Allowance: {proprietors.length} of {currentConfig.included_directors} Included
                  </Text>
                  <Text style={s.allowanceSub}>
                    {proprietors.length > currentConfig.included_directors
                      ? `${proprietors.length - currentConfig.included_directors} extra director(s) added @ ${formatNaira(currentConfig.additional_director_fee)} each = +${formatNaira(quoteCalculation.directorsFee)} surcharge.`
                      : `Base package includes up to ${currentConfig.included_directors} directors without extra fee.`}
                  </Text>
                </View>
                {quoteCalculation.directorsFee > 0 && (
                  <View style={s.calcExtraBadge}>
                    <Text style={s.calcExtraBadgeTxt}>+{formatNaira(quoteCalculation.directorsFee)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Dynamic Trustee Allowance Banner */}
            {isNgo && (
              <View style={s.allowanceBanner}>
                <View style={s.allowanceIconBox}>
                  <Ionicons name="people" size={20} color={COLORS.navy} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.allowanceTitle}>
                    Trustee Allowance: {trustees.length} of {currentConfig.included_trustees} Included
                  </Text>
                  <Text style={s.allowanceSub}>
                    {trustees.length > currentConfig.included_trustees
                      ? `${trustees.length - currentConfig.included_trustees} extra trustee(s) added @ ${formatNaira(currentConfig.additional_trustee_fee)} each = +${formatNaira(quoteCalculation.trusteesFee)} surcharge.`
                      : `Base package includes up to ${currentConfig.included_trustees} trustees without extra fee.`}
                  </Text>
                </View>
                {quoteCalculation.trusteesFee > 0 && (
                  <View style={s.calcExtraBadge}>
                    <Text style={s.calcExtraBadgeTxt}>+{formatNaira(quoteCalculation.trusteesFee)}</Text>
                  </View>
                )}
              </View>
            )}

            {isRetrieval ? (
              // Retrieval Owner / Applicant
              <>
                {proprietors.map((_, i) => renderPersonForm(
                  proprietors, 
                  'Business Owner / Applicant', 
                  setProprietors, 
                  true, 
                  i
                ))}
              </>
            ) : isNgo ? (
              // NGO Chairman, Secretary, Trustees
              <>
                {renderPersonForm(chairman, 'Chairman', setChairman)}
                {renderPersonForm(secretary, 'Secretary', setSecretary)}
                {trustees.map((_, i) => renderPersonForm(
                  trustees, 
                  `Trustee ${i + 1}`, 
                  setTrustees, 
                  true, 
                  i,
                  i > 0 ? () => {
                    const newArr = [...trustees];
                    newArr.splice(i, 1);
                    setTrustees(newArr);
                  } : undefined
                ))}
                
                <TouchableOpacity 
                  style={s.addPartnerBtn} 
                  onPress={() => setTrustees([...trustees, { ...defaultPerson }])}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.navy} />
                  <Text style={s.addPartnerBtnTxt}>Add Another Trustee</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Sole Proprietor / Partnership / Ltd
              <>
                {proprietors.map((_, i) => renderPersonForm(
                  proprietors, 
                  isPartnership ? `Partner / Proprietor ${i + 1}` : 'Proprietor / Business Owner', 
                  setProprietors, 
                  true, 
                  i,
                  isPartnership && i > 0 ? () => {
                    const newArr = [...proprietors];
                    newArr.splice(i, 1);
                    setProprietors(newArr);
                  } : undefined
                ))}

                {(isPartnership || isLimitedLiability) && (
                  <TouchableOpacity 
                    style={s.addPartnerBtn} 
                    onPress={() => setProprietors([...proprietors, { ...defaultPerson }])}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.navy} />
                    <Text style={s.addPartnerBtnTxt}>Add Another Partner</Text>
                  </TouchableOpacity>
                )}

                {isLimitedLiability && (
                  <>
                    {renderPersonForm(witness, 'Company Witness', setWitness)}
                    {renderPersonForm(secretary, 'Company Secretary (Optional)', setSecretary)}
                  </>
                )}
              </>
            )}

          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 4: REVIEW & PAYMENT SUMMARY */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <View style={s.stepContent}>
            
            <View style={s.sectionTitleRow}>
              <View style={s.sectionNumberBadge}>
                <Text style={s.sectionNumberTxt}>4</Text>
              </View>
              <View>
                <Text style={s.stepHeading}>Review & Confirm</Text>
                <Text style={s.stepSubheading}>Check your details and confirm wallet payment</Text>
              </View>
            </View>

            {/* Dynamic Official CAC Proforma Invoice */}
            <View style={s.invoiceCard}>
              <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={s.invoiceHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-checkmark" size={18} color={COLORS.gold} />
                    <Text style={s.invoiceHeaderTitle}>CAC PROFORMA QUOTATION</Text>
                  </View>
                  <Text style={s.invoiceHeaderSub}>Abu Mafhal Corporate Affairs Portal</Text>
                </View>
                <View style={s.invoiceLockBadge}>
                  <Ionicons name="lock-closed" size={11} color={COLORS.gold} />
                  <Text style={s.invoiceLockBadgeTxt}>24h Locked Rate</Text>
                </View>
              </LinearGradient>

              <View style={s.invoiceMetaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.invoiceMetaLabel}>SERVICE PACKAGE</Text>
                  <Text style={s.invoiceMetaVal}>{currentConfig.service_name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.invoiceMetaLabel}>PROCESSING TIME</Text>
                  <Text style={[s.invoiceMetaVal, { color: COLORS.goldDk }]}>⏱ {currentConfig.processing_time}</Text>
                </View>
              </View>

              <View style={s.invoiceDivider} />

              {/* Business Recap */}
              <View style={s.invoiceRecapBox}>
                <View style={s.invoiceRecapRow}>
                  <Text style={s.invoiceRecapLabel}>{isRetrieval ? 'Registered Name:' : 'Proposed Name (Choice 1):'}</Text>
                  <Text style={s.invoiceRecapVal} numberOfLines={1}>{proposedName1 || 'Not specified'}</Text>
                </View>
                {!isRetrieval && proposedName2 ? (
                  <View style={s.invoiceRecapRow}>
                    <Text style={s.invoiceRecapLabel}>Alternative Choice:</Text>
                    <Text style={s.invoiceRecapVal} numberOfLines={1}>{proposedName2}</Text>
                  </View>
                ) : null}
                {isRetrieval && rcNumber ? (
                  <View style={s.invoiceRecapRow}>
                    <Text style={s.invoiceRecapLabel}>RC / BN Number:</Text>
                    <Text style={s.invoiceRecapVal}>{rcNumber}</Text>
                  </View>
                ) : null}
                {isLimitedLiability && (
                  <View style={s.invoiceRecapRow}>
                    <Text style={s.invoiceRecapLabel}>Authorized Capital:</Text>
                    <Text style={s.invoiceRecapVal}>{formatNaira(shareCapital)}</Text>
                  </View>
                )}
                <View style={s.invoiceRecapRow}>
                  <Text style={s.invoiceRecapLabel}>Operating Location:</Text>
                  <Text style={s.invoiceRecapVal}>{lga ? `${lga}, ${state}` : state || 'Nigeria'}</Text>
                </View>
                <View style={s.invoiceRecapRow}>
                  <Text style={s.invoiceRecapLabel}>Applicant Contact:</Text>
                  <Text style={s.invoiceRecapVal}>{phone || 'N/A'}</Text>
                </View>
              </View>

              <View style={s.invoiceDivider} />

              {/* Dynamic Itemized Breakdown directly from Pricing Engine */}
              <Text style={s.invoiceBreakdownHeader}>ITEMIZED COST BREAKDOWN</Text>
              <View style={s.invoiceItemsTable}>
                {quoteCalculation.items.map((item, idx) => {
                  const isDiscount = item.type === 'discount' || item.amount < 0;
                  return (
                    <View key={idx} style={[s.invoiceItemRow, idx % 2 === 1 && s.invoiceItemRowAlt]}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[s.invoiceItemName, isDiscount && { color: COLORS.success, fontWeight: '700' }]}>
                          {item.label}
                        </Text>
                        {item.detail ? (
                          <Text style={s.invoiceItemDetail}>{item.detail}</Text>
                        ) : null}
                      </View>
                      <Text style={[s.invoiceItemAmt, isDiscount && { color: COLORS.success, fontWeight: '800' }]}>
                        {isDiscount ? `-₦${Math.abs(item.amount).toLocaleString()}` : `₦${item.amount.toLocaleString()}`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Total Row */}
              <View style={s.invoiceTotalRow}>
                <View>
                  <Text style={s.invoiceTotalLabel}>TOTAL PAYABLE AMOUNT</Text>
                  <Text style={s.invoiceTotalSub}>Inclusive of verified registry filing & charges</Text>
                </View>
                <Text style={s.invoiceTotalAmt}>₦{totalCost.toLocaleString()}</Text>
              </View>
            </View>

            {/* Official 24-Hour Price Lock Guarantee Banner */}
            <View style={s.guaranteeCard}>
              <View style={s.guaranteeIconCircle}>
                <Ionicons name="shield-checkmark" size={20} color="#92400e" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.guaranteeTitle}>Official Rate Guaranteed</Text>
                <Text style={s.guaranteeBody}>
                  Locked for 24h until {new Date(quoteCalculation.quoteExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Verified registry pricing with zero hidden charges.
                </Text>
              </View>
            </View>

            {/* Wallet Balance Readiness & Top-Up CTA */}
            <View style={[
              s.walletStatusCard, 
              walletBalance !== null && walletBalance < totalCost ? s.walletStatusCardLow : s.walletStatusCardOk
            ]}>
              <View style={s.walletStatusIcon}>
                <Ionicons 
                  name={walletBalance !== null && walletBalance >= totalCost ? "wallet" : "alert-circle"} 
                  size={24} 
                  color={walletBalance !== null && walletBalance >= totalCost ? COLORS.success : COLORS.error} 
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.walletStatusLabel}>Your Wallet Balance</Text>
                <Text style={s.walletStatusAmt}>
                  ₦{(walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                {walletBalance !== null && walletBalance < totalCost ? (
                  <Text style={s.walletShortfallTxt}>
                    Shortfall: ₦{(totalCost - walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                ) : (
                  <Text style={s.walletReadyTxt}>✓ Sufficient balance available for instant deduction</Text>
                )}
              </View>

              {walletBalance !== null && walletBalance < totalCost ? (
                <TouchableOpacity 
                  style={s.walletTopUpBtn} 
                  onPress={() => router.push('/wallet')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={14} color={COLORS.white} />
                  <Text style={s.walletTopUpBtnTxt}>Top Up</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.walletStatusBadgeOk}>
                  <Text style={s.walletStatusBadgeOkTxt}>Ready</Text>
                </View>
              )}
            </View>

          </View>
        )}

      </ScrollView>

      {/* Modern In-Flow Docked Navigation & Live Quote Bar */}
      <View style={s.dockedFooterBar}>
        {currentStep > 1 && (
          <TouchableOpacity 
            style={s.dockedBackBtn} 
            onPress={() => setCurrentStep(currentStep - 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={14} color={COLORS.navy} />
            <Text style={s.dockedBackBtnTxt}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={s.dockedQuoteInfo} 
          onPress={() => setShowBreakdownModal(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={s.dockedQuoteLabel}>Live Quote</Text>
            <Ionicons name="chevron-up-circle" size={13} color={COLORS.gold} />
          </View>
          <Text style={s.dockedQuoteAmount}>₦{totalCost.toLocaleString()}</Text>
          <Text style={s.dockedQuoteTime}>⏱ {currentConfig.processing_time || '24-48h'}</Text>
        </TouchableOpacity>

        <View style={s.dockedActionRight}>
          {currentStep === 1 && (
            <TouchableOpacity style={s.dockedNextBtn} onPress={handleNextFromStep1} activeOpacity={0.85}>
              <Text style={s.dockedNextBtnTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
            </TouchableOpacity>
          )}
          {currentStep === 2 && (
            <TouchableOpacity style={s.dockedNextBtn} onPress={handleNextFromStep2} activeOpacity={0.85}>
              <Text style={s.dockedNextBtnTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
            </TouchableOpacity>
          )}
          {currentStep === 3 && (
            <TouchableOpacity style={s.dockedNextBtn} onPress={handleNextFromStep3} activeOpacity={0.85}>
              <Text style={s.dockedNextBtnTxt}>Review</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
            </TouchableOpacity>
          )}
          {currentStep === 4 && (
            <TouchableOpacity 
              style={[
                s.dockedSubmitBtn, 
                (submitting || (walletBalance !== null && walletBalance < totalCost)) && s.dockedSubmitBtnDisabled
              ]} 
              onPress={handleSubmit} 
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color={COLORS.white} />
                  <Text style={s.dockedNextBtnTxt}>{editId ? 'Update' : 'Pay & Submit'}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Live Quotation Breakdown Bottom Sheet Modal */}
      <Modal visible={showBreakdownModal} transparent animationType="slide" onRequestClose={() => setShowBreakdownModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.breakdownModalSheet}>
            <View style={s.breakdownModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="receipt-outline" size={20} color={COLORS.navy} />
                <Text style={s.breakdownModalTitle}>Dynamic Pricing Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBreakdownModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={24} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11.5, color: COLORS.textSub, marginBottom: 12 }}>
              Verified official CAC registration cost calculation based on current inputs:
            </Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {quoteCalculation.items.map((it, i) => {
                const isDisc = it.type === 'discount' || it.amount < 0;
                return (
                  <View key={i} style={[s.invoiceItemRow, i % 2 === 1 && s.invoiceItemRowAlt]}>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={[s.invoiceItemName, isDisc && { color: COLORS.success, fontWeight: '700' }]}>
                        {it.label}
                      </Text>
                      {it.detail ? <Text style={s.invoiceItemDetail}>{it.detail}</Text> : null}
                    </View>
                    <Text style={[s.invoiceItemAmt, isDisc && { color: COLORS.success, fontWeight: '800' }]}>
                      {isDisc ? `-₦${Math.abs(it.amount).toLocaleString()}` : `₦${it.amount.toLocaleString()}`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={s.invoiceTotalRow}>
              <Text style={s.invoiceTotalLabel}>TOTAL AMOUNT</Text>
              <Text style={s.invoiceTotalAmt}>₦{totalCost.toLocaleString()}</Text>
            </View>

            <TouchableOpacity 
              style={[s.btnPrimary, { marginTop: 14 }]} 
              onPress={() => setShowBreakdownModal(false)}
              activeOpacity={0.8}
            >
              <Text style={s.btnPrimaryTxt}>Close Breakdown</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
  },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitleArea: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSubtitle: { fontSize: 11, color: COLORS.gold, marginTop: 1 },
  historyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,166,35,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.gold, gap: 4 },
  historyBtnTxt: { fontSize: 11, fontWeight: '700', color: COLORS.gold },

  // Stepper Bar
  stepperBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    width: '100%',
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: COLORS.navy },
  stepCircleDone: { backgroundColor: COLORS.success },
  stepNum: { fontSize: 10, fontWeight: '700', color: COLORS.textSub },
  stepNumActive: { color: COLORS.white },
  stepLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  stepLabelActive: { color: COLORS.navy, fontWeight: '800' },
  stepLabelDone: { color: COLORS.success, fontWeight: '700' },
  stepDivider: { flex: 1, height: 2, backgroundColor: '#f1f5f9', marginHorizontal: 4 },
  stepDividerDone: { backgroundColor: COLORS.success },

  content: { flex: 1, width: '100%' },
  stepContent: { marginTop: 4, width: '100%' },

  // Section Heading
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sectionNumberBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  sectionNumberTxt: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  stepHeading: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  stepSubheading: { fontSize: 11.5, color: COLORS.textSub, marginTop: 1 },

  // Service Dropdown Styles
  serviceDropdownCard: {
    marginBottom: 14,
    width: '100%',
  },
  serviceSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    width: '100%',
  },
  serviceSelectIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff9ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  serviceSelectName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  serviceSelectPrice: {
    fontSize: 13.5,
    fontWeight: '900',
    color: COLORS.navy,
  },
  serviceSelectOrigPrice: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSub,
    textDecorationLine: 'line-through',
  },
  serviceSelectChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  discountBadgePillTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  serviceModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 420,
  },
  serviceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  serviceModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
  },
  serviceModalSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSub,
    marginBottom: 14,
    lineHeight: 16,
  },
  serviceModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginBottom: 8,
  },
  serviceModalItemActive: {
    borderColor: COLORS.navy,
    backgroundColor: '#f8fafc',
  },
  serviceModalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceModalItemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  serviceModalItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  serviceModalItemOrigPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSub,
    textDecorationLine: 'line-through',
  },

  // Service Selection Cards
  serviceCardsContainer: { gap: 8, marginBottom: 14 },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  serviceCardSelected: { borderColor: COLORS.navy, backgroundColor: '#f8fafc' },
  serviceIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  serviceIconBoxSelected: { backgroundColor: COLORS.navy },
  serviceTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  serviceTitleSelected: { color: COLORS.navy },
  servicePrice: { fontSize: 12, fontWeight: '800', color: COLORS.goldDk, marginTop: 2 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioCircleSelected: { borderColor: COLORS.navy },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.navy },

  // TIN Card
  tinCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 14,
    width: '100%',
  },
  tinCardActive: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  tinCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.textSub, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  tinCheckboxActive: { backgroundColor: COLORS.goldDk, borderColor: COLORS.goldDk },
  tinTitle: { fontSize: 12.5, fontWeight: '700', color: COLORS.navy },
  tinPrice: { fontSize: 12, fontWeight: '800', color: COLORS.goldDk },
  tinSub: { fontSize: 10.5, color: COLORS.textSub, marginTop: 2 },

  // Clean White Card
  cleanCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
    width: '100%', maxWidth: '100%', overflow: 'hidden',
  },
  cardSectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.navy, letterSpacing: 0.5, marginBottom: 12 },

  // Inputs & Grid
  inputContainer: { marginBottom: 11, width: '100%', maxWidth: '100%' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 },
  inputBox: {
    height: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8,
    paddingHorizontal: 12, fontSize: 12.5, color: COLORS.textMain, backgroundColor: '#ffffff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: '100%',
  },
  inputBoxActive: { borderColor: COLORS.navy, borderWidth: 1.5 },
  inputText: { fontSize: 12.5, color: COLORS.textMain },
  inputPlaceholderText: { fontSize: 12, color: '#94a3b8' },
  formGrid2: { flexDirection: 'row', gap: 10, width: '100%', alignItems: 'flex-start' },

  // Select Modal Styles (Clean Modal Picker)
  selectModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    width: '100%',
    maxWidth: 380,
  },
  selectModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.textMain,
    padding: 0,
  },
  selectModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 3,
  },
  selectModalItemActive: {
    backgroundColor: '#eff6ff',
  },
  selectModalItemTxt: {
    fontSize: 13,
    color: COLORS.textMain,
  },
  selectModalItemTxtActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },

  // Gender Selector Segmented Toggle
  genderRow: {
    flexDirection: 'row',
    height: 42,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    gap: 5,
  },
  genderBtnActive: {
    backgroundColor: COLORS.navy,
  },
  genderBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  genderBtnTxtActive: {
    color: COLORS.white,
  },

  // Dropdown Legacy fallback
  dropdownList: {
    position: 'relative', marginTop: 4, backgroundColor: COLORS.white,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
    width: '100%',
  },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 11, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  dropdownItemActive: { backgroundColor: '#f1f5f9' },
  dropdownItemTxt: { fontSize: 12.5, color: COLORS.textMain },
  dropdownItemTxtActive: { fontWeight: '700', color: COLORS.navy },

  // Person Card in Step 3
  personCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
    width: '100%', maxWidth: '100%', overflow: 'hidden',
  },
  personCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  personAvatarIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  personCardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.navy },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  removeBtnTxt: { fontSize: 11, fontWeight: '700', color: COLORS.error },
  addPartnerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5,
    borderColor: COLORS.navy, borderStyle: 'dashed', marginBottom: 14,
  },
  addPartnerBtnTxt: { fontSize: 12.5, fontWeight: '700', color: COLORS.navy },

  // Upload Tiles
  uploadGrid: { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  uploadTile: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, alignItems: 'center', backgroundColor: '#fcfcfd', borderStyle: 'dashed',
    minWidth: 0, justifyContent: 'center', minHeight: 95,
  },
  uploadTileDone: { borderColor: COLORS.success, backgroundColor: '#f0fdf4', borderStyle: 'solid' },
  uploadIconBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  uploadTileTitle: { fontSize: 11.5, fontWeight: '700', color: COLORS.navy, textAlign: 'center' },
  uploadTileSub: { fontSize: 10, color: COLORS.textSub, marginTop: 2, textAlign: 'center' },
  uploadThumbWrapper: { alignItems: 'center', width: '100%' },
  uploadedThumbImg: { width: '100%', height: 60, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 6 },
  uploadDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  uploadDoneBadgeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.success },
  uploadChangeTxt: { fontSize: 9.5, color: COLORS.textSub, marginTop: 3, fontWeight: '600' },

  // Mobile Fast Service Pills
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickPillActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  quickPillTxt: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  quickPillTxtActive: {
    color: COLORS.white,
  },
  quickPillPrice: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldDk,
    marginTop: 1,
  },
  quickPillPriceActive: {
    color: COLORS.gold,
  },
  quickPillPromoBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  quickPillPromoBadgeTxt: {
    color: COLORS.white,
    fontSize: 7.5,
    fontWeight: '900',
  },

  // Allowance Banner in Step 3
  allowanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  allowanceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowanceTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.navy,
  },
  allowanceSub: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
    lineHeight: 15,
  },
  calcExtraBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calcExtraBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },

  // Share Capital Chips in Step 2
  shareCapChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#f8fafc',
  },
  shareCapChipActive: {
    borderColor: COLORS.navy,
    backgroundColor: COLORS.navy,
  },
  shareCapChipTxt: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  shareCapChipTxtActive: {
    color: COLORS.white,
    fontWeight: '800',
  },

  // Official Proforma Invoice in Step 4
  invoiceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  invoiceHeaderTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  invoiceHeaderSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 1,
  },
  invoiceLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,166,35,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  invoiceLockBadgeTxt: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.gold,
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  invoiceMetaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 0.3,
  },
  invoiceMetaVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: 2,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  invoiceRecapBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  invoiceRecapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceRecapLabel: {
    fontSize: 11.5,
    color: COLORS.textSub,
  },
  invoiceRecapVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    maxWidth: '55%',
    textAlign: 'right',
  },
  invoiceBreakdownHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  invoiceItemsTable: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  invoiceItemRowAlt: {
    backgroundColor: '#f8fafc',
  },
  invoiceItemName: {
    fontSize: 12,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  invoiceItemDetail: {
    fontSize: 10,
    color: COLORS.textSub,
    marginTop: 2,
  },
  invoiceItemAmt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.navy,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0d1b3e',
  },
  invoiceTotalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  invoiceTotalSub: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  invoiceTotalAmt: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
  },

  // 24-Hour Guarantee Box
  guaranteeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
  },
  guaranteeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  guaranteeBody: {
    fontSize: 11,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 16,
  },

  // Wallet Status
  walletStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 18,
  },
  walletStatusCardOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  walletStatusCardLow: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  walletStatusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  walletStatusLabel: { fontSize: 10.5, color: COLORS.textSub, fontWeight: '600' },
  walletStatusAmt: { fontSize: 15, fontWeight: '900', color: COLORS.navy, marginTop: 1 },
  walletShortfallTxt: { fontSize: 10.5, fontWeight: '700', color: COLORS.error, marginTop: 2 },
  walletReadyTxt: { fontSize: 10.5, fontWeight: '600', color: COLORS.success, marginTop: 2 },
  walletTopUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.error,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  walletTopUpBtnTxt: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  walletStatusBadgeOk: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  walletStatusBadgeOkTxt: { color: COLORS.success, fontSize: 11, fontWeight: '800' },

  // Buttons
  navButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnPrimary: {
    backgroundColor: COLORS.navy, height: 46, borderRadius: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 18,
  },
  btnPrimaryTxt: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: COLORS.white, height: 46, borderRadius: 11,
    borderWidth: 1.5, borderColor: COLORS.border, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16,
  },
  btnSecondaryTxt: { color: COLORS.navy, fontSize: 13, fontWeight: '700' },

  // Modern In-Flow Docked Bottom Bar (Zero Overlap)
  dockedFooterBar: {
    backgroundColor: '#0a142f',
    borderTopWidth: 1.5,
    borderTopColor: '#1e293b',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dockedBackBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  dockedBackBtnTxt: {
    color: COLORS.navy,
    fontSize: 11.5,
    fontWeight: '700',
  },
  dockedQuoteInfo: {
    flex: 1,
    paddingHorizontal: 4,
  },
  dockedQuoteLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dockedQuoteAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 1,
  },
  dockedQuoteTime: {
    fontSize: 9,
    color: COLORS.gold,
    marginTop: 1,
    fontWeight: '600',
  },
  dockedActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dockedNextBtn: {
    backgroundColor: COLORS.goldDk,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dockedNextBtnTxt: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  dockedSubmitBtn: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dockedSubmitBtnDisabled: {
    opacity: 0.5,
  },

  // Live Breakdown Modal Sheet
  breakdownModalSheet: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 420,
  },
  breakdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
  },

  // Date Picker Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13,27,62,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  datePickerCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 18, width: '100%', maxWidth: 360 },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  datePickerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  selectedDateBadge: { backgroundColor: COLORS.navy, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginBottom: 12 },
  selectedDateLabel: { fontSize: 9.5, color: COLORS.gold, fontWeight: '700', letterSpacing: 0.5 },
  selectedDateValue: { fontSize: 15, color: COLORS.white, fontWeight: '800', marginTop: 1 },
  wheelCol: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 3 },
  wheelHeader: { fontSize: 9.5, fontWeight: '800', color: COLORS.textSub, textAlign: 'center', marginVertical: 3 },
  wheelItem: { paddingVertical: 7, borderRadius: 6, alignItems: 'center', marginVertical: 1 },
  wheelItemActive: { backgroundColor: COLORS.navy },
  wheelItemTxt: { fontSize: 12, color: COLORS.textMain, fontWeight: '600' },
  wheelItemTxtActive: { color: COLORS.white, fontWeight: '800' },
});
