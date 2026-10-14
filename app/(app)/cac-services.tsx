import React, { useState, useEffect } from 'react';
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

type Pricing = { 
  id: string; 
  name: string; 
  price: number; 
  original_price?: number | null;
  discount_label?: string | null;
  active?: boolean 
};

// Reusable Custom Dropdown (Mobile-first)
const CustomDropdown = ({ label, value, options, onSelect, placeholder = "Select...", required = false, style }: any) => {
  const [visible, setVisible] = useState(false);
  const safeOptions = Array.isArray(options) ? options : [];
  return (
    <View style={[s.inputContainer, { zIndex: visible ? 100 : 1 }, style]}>
      <Text style={s.inputLabel}>
        {label} {required && <Text style={{ color: COLORS.error }}>*</Text>}
      </Text>
      <TouchableOpacity 
        style={[s.inputBox, visible && s.inputBoxActive]} 
        onPress={() => setVisible(!visible)}
        activeOpacity={0.8}
      >
        <Text style={[s.inputText, !value && { color: COLORS.textSub }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={visible ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSub} />
      </TouchableOpacity>
      
      {visible && (
        <View style={s.dropdownList}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
            {safeOptions.length === 0 ? (
              <Text style={{ textAlign: 'center', padding: 12, color: COLORS.textSub, fontSize: 13 }}>No options</Text>
            ) : (
              safeOptions.map((opt: string, i: number) => (
                <TouchableOpacity 
                  key={i} 
                  style={[s.dropdownItem, value === opt && s.dropdownItemActive]} 
                  onPress={() => { onSelect(opt); setVisible(false); }}
                >
                  <Text style={[s.dropdownItemTxt, value === opt && s.dropdownItemTxtActive]}>{opt}</Text>
                  {value === opt && <Ionicons name="checkmark" size={16} color={COLORS.navy} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = [
  { name: 'January', value: '01' }, { name: 'February', value: '02' }, { name: 'March', value: '03' },
  { name: 'April', value: '04' }, { name: 'May', value: '05' }, { name: 'June', value: '06' },
  { name: 'July', value: '07' }, { name: 'August', value: '08' }, { name: 'September', value: '09' },
  { name: 'October', value: '10' }, { name: 'November', value: '11' }, { name: 'December', value: '12' }
];
const YEARS = Array.from({ length: 70 }, (_, i) => String(2008 - i));

// Date Picker Modal (Mobile-first)
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
    : 'Select Date of Birth';

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
        <Text style={[s.inputText, !value && { color: COLORS.textSub }]}>
          {formattedDisplay}
        </Text>
        <Ionicons name="calendar-outline" size={17} color={COLORS.navy} />
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

  // TIN & Retrieval Add-on State
  const [includeTin, setIncludeTin] = useState(false);
  const [tinFee, setTinFee] = useState(5000);
  const [rcNumber, setRcNumber] = useState('');
  const [registrationYear, setRegistrationYear] = useState('');

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
      
      // Fetch TIN Add-on Fee from settings
      try {
        const { data: tinSetting } = await supabase.from('app_settings').select('value').eq('key', 'cac_tin_fee').maybeSingle();
        if (tinSetting && tinSetting.value) {
          const parsed = parseFloat(tinSetting.value);
          if (!isNaN(parsed) && parsed >= 0) setTinFee(parsed);
        }
      } catch (err) {
        console.log("Failed to fetch tin setting:", err);
      }

      const { data, error } = await supabase.from('cac_pricing').select('*').eq('active', true).order('price', { ascending: true });
      if (error && error.code !== '42P01') {
        console.error('Error fetching CAC pricing:', error);
      }

      let allPricings: Pricing[] = data ? [...data] : [];
      
      // Ensure "CAC Certificate Retrieval" option is available
      const hasRetrieval = allPricings.some(p => p.name.toLowerCase().includes('retrieval') || p.name.toLowerCase().includes('certificate search'));
      if (!hasRetrieval) {
        allPricings.push({
          id: 'cac-certificate-retrieval-default',
          name: 'CAC Certificate Retrieval / Document Search',
          price: 4000
        });
      }

      // Fetch custom discount & original price data from app_settings
      try {
        const { data: settingsData } = await supabase.from('app_settings').select('key, value').like('key', 'cac_price_%');
        if (settingsData) {
          const metaMap: Record<string, any> = {};
          settingsData.forEach(s => {
            try {
              metaMap[s.key] = JSON.parse(s.value);
            } catch (_) {
              metaMap[s.key] = { price: parseFloat(s.value) };
            }
          });

          allPricings = allPricings.map(p => {
            const meta = metaMap[`cac_price_${p.id}`];
            return {
              ...p,
              original_price: p.original_price ?? (meta?.original_price || null),
              discount_label: p.discount_label ?? (meta?.discount_label || null),
            };
          });
        }
      } catch (err) {
        console.log("Pricing meta fetch err:", err);
      }

      setPricings(allPricings);

      if (editId) {
        await loadEditData(editId as string, allPricings);
      } else if (allPricings.length > 0) {
        setRegType(allPricings[0]);
      }
    } catch (e) {
      console.error(e);
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
        }

        if (data.proprietors && data.proprietors.length > 0) setProprietors(data.proprietors);
        if (data.chairman && Object.keys(data.chairman).length > 0) setChairman(data.chairman);
        if (data.secretary && Object.keys(data.secretary).length > 0) setSecretary(data.secretary);
        if (data.trustees && data.trustees.length > 0) setTrustees(data.trustees);
        if (data.witness && Object.keys(data.witness).length > 0) setWitness(data.witness);
        if (data.aims_and_objectives) setAims(data.aims_and_objectives);

        if (data.pricing_id) {
          const matchedPricing = availablePricings.find(p => p.id === data.pricing_id);
          if (matchedPricing) setRegType(matchedPricing);
        }
      }
    } catch (e) {
      console.error('Error loading edit data:', e);
      Alert.alert('Error', 'Failed to load application data.');
    }
  };

  const isNgo = regType?.name?.toLowerCase().includes('ngo');
  const isPartnership = regType?.name?.toLowerCase().includes('partnership');
  const isLimitedLiability = regType?.name?.toLowerCase().includes('limited liability') || regType?.name?.toLowerCase().includes('ltd') || regType?.name?.toLowerCase().includes('share');
  const isRetrieval = regType?.name?.toLowerCase().includes('retrieval') || regType?.name?.toLowerCase().includes('certificate');

  const totalCost = (regType?.price || 0) + (includeTin ? tinFee : 0);

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
        apply_with_tin: includeTin,
        tin_fee: includeTin ? tinFee : 0,
        base_price: regType.price,
        total_cost: totalCost,
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
            placeholder="As written on NIN or Valid ID"
            value={data.fullName} 
            onChangeText={t => updateField('fullName', t)} 
          />
        </View>

        <View style={s.formGrid2}>
          <CustomDatePicker style={{ flex: 1, minWidth: 0 }} label="Date of Birth" value={data.dob} onChange={(v: string) => updateField('dob', v)} required />
          <CustomDropdown style={{ flex: 1, minWidth: 0 }} label="Gender" value={data.gender} options={['Male', 'Female']} onSelect={(v: string) => updateField('gender', v)} />
        </View>

        <View style={s.formGrid2}>
          <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
            <Text style={s.inputLabel}>Phone Number <Text style={{ color: COLORS.error }}>*</Text></Text>
            <TextInput style={s.inputBox} keyboardType="phone-pad" placeholder="080..." value={data.phone} onChangeText={t => updateField('phone', t)} />
          </View>
          <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
            <Text style={s.inputLabel}>NIN (11 Digits)</Text>
            <TextInput style={s.inputBox} keyboardType="numeric" maxLength={11} placeholder="11 digits" value={data.nin} onChangeText={t => updateField('nin', t)} />
          </View>
        </View>

        <View style={s.inputContainer}>
          <Text style={s.inputLabel}>Email Address</Text>
          <TextInput style={s.inputBox} keyboardType="email-address" placeholder="name@email.com" value={data.email} onChangeText={t => updateField('email', t)} />
        </View>

        <View style={s.formGrid2}>
          <CustomDropdown style={{ flex: 1, minWidth: 0 }} label="State of Origin" value={data.state} options={STATE_LIST} onSelect={(val: string) => { updateField('state', val); updateField('lga', ''); }} />
          <CustomDropdown style={{ flex: 1, minWidth: 0 }} label="LGA" value={data.lga} options={data.state ? NIGERIA_STATES[data.state] : []} onSelect={(v: string) => updateField('lga', v)} placeholder="Select State" />
        </View>

        <View style={s.inputContainer}>
          <Text style={s.inputLabel}>Residential Address</Text>
          <TextInput style={s.inputBox} placeholder="Street, house number, area" value={data.address} onChangeText={t => updateField('address', t)} />
        </View>

        {/* Upload Tiles */}
        <View style={s.uploadGrid}>
          {/* Signature Upload */}
          <TouchableOpacity 
            style={[s.uploadTile, data.signatureUri && s.uploadTileDone]} 
            onPress={() => isArray ? pickArrayImage(person as any[], index, 'signatureUri', setter) : pickImage(setter, 'signatureUri')}
            activeOpacity={0.8}
          >
            <View style={[s.uploadIconBadge, data.signatureUri && { backgroundColor: COLORS.successLight }]}>
              <Ionicons name={data.signatureUri ? "checkmark-circle" : "create-outline"} size={20} color={data.signatureUri ? COLORS.success : COLORS.navy} />
            </View>
            <Text style={s.uploadTileTitle}>Signature</Text>
            <Text style={[s.uploadTileSub, data.signatureUri && { color: COLORS.success, fontWeight: '700' }]}>
              {data.signatureUri ? 'Uploaded ✓' : 'Upload photo'}
            </Text>
          </TouchableOpacity>

          {/* Passport Upload */}
          <TouchableOpacity 
            style={[s.uploadTile, data.passportUri && s.uploadTileDone]} 
            onPress={() => isArray ? pickArrayImage(person as any[], index, 'passportUri', setter) : pickImage(setter, 'passportUri')}
            activeOpacity={0.8}
          >
            <View style={[s.uploadIconBadge, data.passportUri && { backgroundColor: COLORS.successLight }]}>
              <Ionicons name={data.passportUri ? "checkmark-circle" : "camera-outline"} size={20} color={data.passportUri ? COLORS.success : COLORS.navy} />
            </View>
            <Text style={s.uploadTileTitle}>Passport Photo</Text>
            <Text style={[s.uploadTileSub, data.passportUri && { color: COLORS.success, fontWeight: '700' }]}>
              {data.passportUri ? 'Uploaded ✓' : 'Upload photo'}
            </Text>
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

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
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

            {/* Choose Service Dropdown */}
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
                        {regType ? regType.name : 'Choose CAC Service...'}
                      </Text>
                      {regType?.original_price && regType.original_price > regType.price && (
                        <View style={s.discountBadgePill}>
                          <Ionicons name="pricetag" size={10} color="#15803d" />
                          <Text style={s.discountBadgePillTxt}>
                            {regType.discount_label || `${Math.round(((regType.original_price - regType.price) / regType.original_price) * 100)}% OFF`}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                      <Text style={s.serviceSelectPrice}>
                        ₦{(regType?.price || 0).toLocaleString()}
                      </Text>
                      {regType?.original_price && regType.original_price > regType.price && (
                        <Text style={s.serviceSelectOrigPrice}>
                          ₦{regType.original_price.toLocaleString()}
                        </Text>
                      )}
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

                      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                        {pricings.map((p) => {
                          const isSelected = regType?.id === p.id;
                          const hasDiscount = p.original_price && p.original_price > p.price;
                          const isCert = p.name.toLowerCase().includes('retrieval') || p.name.toLowerCase().includes('search');
                          const isNgoType = p.name.toLowerCase().includes('ngo') || p.name.toLowerCase().includes('club');
                          const discountPct = hasDiscount ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100) : 0;

                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[s.serviceModalItem, isSelected && s.serviceModalItemActive]}
                              onPress={() => {
                                setRegType(p);
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
                                <Text style={[s.serviceModalItemName, isSelected && { color: COLORS.navy, fontWeight: '800' }]}>
                                  {p.name}
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                  <Text style={s.serviceModalItemPrice}>
                                    ₦{p.price.toLocaleString()}
                                  </Text>
                                  {hasDiscount && (
                                    <Text style={s.serviceModalItemOrigPrice}>
                                      ₦{p.original_price?.toLocaleString()}
                                    </Text>
                                  )}
                                  {hasDiscount && (
                                    <View style={s.discountBadgePill}>
                                      <Text style={s.discountBadgePillTxt}>
                                        {p.discount_label || `${discountPct}% OFF`}
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
                        value={rcNumber} 
                        onChangeText={setRcNumber} 
                      />
                    </View>
                    <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                      <Text style={s.inputLabel}>Registration Year</Text>
                      <TextInput 
                        style={s.inputBox} 
                        placeholder="e.g. 2021" 
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
                      value={proposedName2} 
                      onChangeText={setProposedName2} 
                    />
                  </View>

                  {isNgo && (
                    <View style={s.inputContainer}>
                      <Text style={s.inputLabel}>Proposed Name 3 (Optional for NGO)</Text>
                      <TextInput 
                        style={s.inputBox} 
                        placeholder="Third alternative name"
                        value={proposedName3} 
                        onChangeText={setProposedName3} 
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Next Step Button */}
            <TouchableOpacity style={s.btnPrimary} onPress={handleNextFromStep1} activeOpacity={0.8}>
              <Text style={s.btnPrimaryTxt}>Next: Business Details</Text>
              <Ionicons name="arrow-forward" size={17} color={COLORS.white} />
            </TouchableOpacity>

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
                    placeholder="08012345678" 
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
                    value={email} 
                    onChangeText={setEmail} 
                  />
                </View>
              </View>

              <View style={s.inputContainer}>
                <Text style={s.inputLabel}>Nature of Business / Core Activities</Text>
                <TextInput 
                  style={s.inputBox} 
                  placeholder="e.g. General Contracts, Trading, Logistics" 
                  value={natureOfBusiness} 
                  onChangeText={setNatureOfBusiness} 
                />
              </View>
            </View>

            <View style={s.cleanCard}>
              <Text style={s.cardSectionTitle}>OPERATIONAL ADDRESS</Text>
              
              <View style={s.formGrid2}>
                <CustomDropdown 
                  style={{ flex: 1, minWidth: 0 }}
                  label="State Location" 
                  value={state} 
                  options={STATE_LIST} 
                  onSelect={(val: string) => { setState(val); setLga(''); }} 
                  required 
                />
                <CustomDropdown 
                  style={{ flex: 1, minWidth: 0 }}
                  label="LGA / City" 
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
                    placeholder="e.g. Suite 4B or No 12" 
                    value={officeNumber} 
                    onChangeText={setOfficeNumber} 
                  />
                </View>
                <View style={[s.inputContainer, { flex: 1, minWidth: 0 }]}>
                  <Text style={s.inputLabel}>Street / Area</Text>
                  <TextInput 
                    style={s.inputBox} 
                    placeholder="e.g. Ahmadu Bello Way" 
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
                      value={tenure} 
                      onChangeText={setTenure} 
                    />
                  </View>
                  <View style={s.inputContainer}>
                    <Text style={s.inputLabel}>Aims & Objectives</Text>
                    <TextInput 
                      style={[s.inputBox, { height: 75, textAlignVertical: 'top', paddingTop: 8 }]} 
                      multiline 
                      placeholder="Summary of organizational goals and objectives..."
                      value={aims} 
                      onChangeText={setAims} 
                    />
                  </View>
                </>
              )}
            </View>

            {/* Stepper Buttons */}
            <View style={s.navButtonsRow}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={16} color={COLORS.navy} />
                <Text style={s.btnSecondaryTxt}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnPrimary, { flex: 1 }]} onPress={handleNextFromStep2} activeOpacity={0.8}>
                <Text style={s.btnPrimaryTxt}>Next: Officers & Docs</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>

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

            {/* Stepper Buttons */}
            <View style={s.navButtonsRow}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setCurrentStep(2)} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={16} color={COLORS.navy} />
                <Text style={s.btnSecondaryTxt}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnPrimary, { flex: 1 }]} onPress={handleNextFromStep3} activeOpacity={0.8}>
                <Text style={s.btnPrimaryTxt}>Next: Review & Payment</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>

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

            {/* Summary Receipt Card */}
            <View style={s.summaryCard}>
              <View style={s.summaryHeader}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.gold} />
                <Text style={s.summaryHeaderTitle}>Application Summary</Text>
              </View>

              <View style={s.summaryBody}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Registration Type</Text>
                  <Text style={s.summaryVal}>{regType?.name}</Text>
                </View>
                <View style={s.summaryDivider} />

                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{isRetrieval ? 'Registered Name' : 'Primary Choice'}</Text>
                  <Text style={[s.summaryVal, { fontWeight: '700' }]}>{proposedName1}</Text>
                </View>

                {!isRetrieval && proposedName2 ? (
                  <>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryRow}>
                      <Text style={s.summaryLabel}>Alternative Name</Text>
                      <Text style={s.summaryVal}>{proposedName2}</Text>
                    </View>
                  </>
                ) : null}

                {isRetrieval && rcNumber ? (
                  <>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryRow}>
                      <Text style={s.summaryLabel}>RC / BN Number</Text>
                      <Text style={s.summaryVal}>{rcNumber}</Text>
                    </View>
                  </>
                ) : null}

                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Applicant Name</Text>
                  <Text style={s.summaryVal}>
                    {isNgo ? chairman.fullName || 'N/A' : proprietors[0]?.fullName || 'N/A'}
                  </Text>
                </View>

                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Base CAC Fee</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.summaryVal}>₦{(regType?.price || 0).toLocaleString()}</Text>
                    {regType?.original_price && regType.original_price > regType.price && (
                      <Text style={{ fontSize: 11, color: COLORS.textSub, textDecorationLine: 'line-through' }}>
                        ₦{regType.original_price.toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>

                {regType?.original_price && regType.original_price > regType.price && (
                  <>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryRow}>
                      <Text style={[s.summaryLabel, { color: COLORS.success }]}>Discount Savings</Text>
                      <Text style={[s.summaryVal, { color: COLORS.success, fontWeight: '800' }]}>
                        -₦{(regType.original_price - regType.price).toLocaleString()} ({regType.discount_label || `${Math.round(((regType.original_price - regType.price) / regType.original_price) * 100)}% OFF`})
                      </Text>
                    </View>
                  </>
                )}

                {includeTin && (
                  <>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryRow}>
                      <Text style={[s.summaryLabel, { color: COLORS.goldDk }]}>TIN Processing Add-on</Text>
                      <Text style={[s.summaryVal, { color: COLORS.goldDk, fontWeight: '700' }]}>+₦{tinFee.toLocaleString()}</Text>
                    </View>
                  </>
                )}

                <View style={[s.summaryDivider, { backgroundColor: COLORS.navyLight, height: 1.5 }]} />
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { fontSize: 14, fontWeight: '800', color: COLORS.navy }]}>Total Amount Payable</Text>
                  <Text style={[s.summaryVal, { fontSize: 18, fontWeight: '900', color: COLORS.navy }]}>
                    ₦{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Wallet Balance Readiness Badge */}
            <View style={[s.walletStatusCard, walletBalance !== null && walletBalance < totalCost ? s.walletStatusCardLow : s.walletStatusCardOk]}>
              <Ionicons 
                name={walletBalance !== null && walletBalance >= totalCost ? "wallet" : "alert-circle"} 
                size={22} 
                color={walletBalance !== null && walletBalance >= totalCost ? COLORS.success : COLORS.error} 
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.walletStatusLabel}>Your Wallet Balance</Text>
                <Text style={s.walletStatusAmt}>₦{(walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={[s.walletStatusPill, walletBalance !== null && walletBalance < totalCost ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#d1fae5' }]}>
                <Text style={[s.walletStatusPillTxt, walletBalance !== null && walletBalance < totalCost ? { color: COLORS.error } : { color: COLORS.success }]}>
                  {walletBalance !== null && walletBalance >= totalCost ? 'Ready' : 'Low Balance'}
                </Text>
              </View>
            </View>

            {/* Navigation & Submit Buttons */}
            <View style={s.navButtonsRow}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setCurrentStep(3)} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={16} color={COLORS.navy} />
                <Text style={s.btnSecondaryTxt}>Edit Details</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.btnPrimary, { flex: 1.8 }]} 
                onPress={handleSubmit} 
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color={COLORS.white} />
                    <Text style={s.btnPrimaryTxt}>{editId ? 'Update Application' : 'Pay & Submit'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        )}

      </ScrollView>
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
  inputContainer: { marginBottom: 12, width: '100%', maxWidth: '100%' },
  inputLabel: { fontSize: 11.5, fontWeight: '700', color: COLORS.textMain, marginBottom: 5 },
  inputBox: {
    height: 42, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9,
    paddingHorizontal: 12, fontSize: 13, color: COLORS.textMain, backgroundColor: '#fcfcfd',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: '100%',
  },
  inputBoxActive: { borderColor: COLORS.navy },
  inputText: { fontSize: 13, color: COLORS.textMain },
  formGrid2: { flexDirection: 'row', gap: 10, width: '100%', alignItems: 'flex-start' },

  // Dropdown
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
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, alignItems: 'center', backgroundColor: '#fcfcfd', borderStyle: 'dashed',
    minWidth: 0,
  },
  uploadTileDone: { borderColor: COLORS.success, backgroundColor: COLORS.successLight, borderStyle: 'solid' },
  uploadIconBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  uploadTileTitle: { fontSize: 11.5, fontWeight: '700', color: COLORS.navy },
  uploadTileSub: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },

  // Step 4 Summary Card
  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.navy, overflow: 'hidden', marginBottom: 14,
    width: '100%', maxWidth: '100%',
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.navy, paddingVertical: 12, paddingHorizontal: 16 },
  summaryHeaderTitle: { color: COLORS.white, fontWeight: '800', fontSize: 13.5 },
  summaryBody: { padding: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  summaryVal: { fontSize: 12.5, color: COLORS.navy, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },

  // Wallet Status
  walletStatusCard: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    borderWidth: 1, marginBottom: 18,
  },
  walletStatusCardOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  walletStatusCardLow: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  walletStatusLabel: { fontSize: 10.5, color: COLORS.textSub, fontWeight: '600' },
  walletStatusAmt: { fontSize: 14, fontWeight: '800', color: COLORS.navy, marginTop: 1 },
  walletStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  walletStatusPillTxt: { fontSize: 10.5, fontWeight: '800' },

  // Buttons
  navButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnPrimary: {
    backgroundColor: COLORS.navy, height: 44, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 18,
  },
  btnPrimaryTxt: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: COLORS.white, height: 44, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16,
  },
  btnSecondaryTxt: { color: COLORS.navy, fontSize: 13, fontWeight: '700' },

  // Date Picker Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13,27,62,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
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
