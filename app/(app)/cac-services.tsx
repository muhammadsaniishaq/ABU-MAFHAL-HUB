import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';
import DynamicBanners from '../../components/DynamicBanners';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NIGERIA_STATES, STATE_LIST } from '../../utils/nigeriaStates';

const COLORS = {
  navy: '#0d1b3e',
  navyMid: '#142258',
  gold: '#f5a623',
  goldDk: '#d4890e',
  bg: '#f4f6fb',
  white: '#FFFFFF',
  textMain: '#0d1b3e',
  textSub: '#5a6890',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#10b981',
};

type Pricing = { id: string; name: string; price: number; };

const CustomDropdown = ({ label, value, options, onSelect, placeholder = "Select..." }: any) => {
  const [visible, setVisible] = useState(false);
  const safeOptions = Array.isArray(options) ? options : [];
  return (
    <View style={[s.inputContainer, { zIndex: visible ? 100 : 1 }]}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={[s.input, { justifyContent: 'center' }]} onPress={() => setVisible(!visible)}>
        <Text style={{ color: value ? COLORS.navy : COLORS.textSub }}>{value || placeholder}</Text>
        <Ionicons name={visible ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSub} style={{ position: 'absolute', right: 12, top: 12 }} />
      </TouchableOpacity>
      
      {visible && (
        <View style={[s.dropdownList, { position: 'relative', top: 0, marginTop: 4, maxHeight: 250, zIndex: 1000 }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {safeOptions.length === 0 ? (
              <Text style={{ textAlign: 'center', padding: 12, color: COLORS.textSub }}>No options</Text>
            ) : (
              safeOptions.map((opt: string, i: number) => (
                <TouchableOpacity key={i} style={[s.dropdownItem, value === opt && s.dropdownItemActive]} onPress={() => { onSelect(opt); setVisible(false); }}>
                  <Text style={[s.dropdownItemTxt, value === opt && s.dropdownItemTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const CustomDatePicker = ({ label, value, onChange }: any) => {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value) : new Date();
  
  const handleConfirm = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      onChange(formatted);
    }
  };

  return (
    <View style={s.inputContainer}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={[s.input, { justifyContent: 'center' }]} onPress={() => setShow(true)}>
        <Text style={{ color: value ? COLORS.navy : COLORS.textSub }}>{value || "Select Date"}</Text>
        <Ionicons name="calendar-outline" size={16} color={COLORS.textSub} style={{ position: 'absolute', right: 12, top: 12 }} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          onChange={handleConfirm}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
};

export default function CACServices() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pricings, setPricings] = useState<Pricing[]>([]);
  const [regType, setRegType] = useState<Pricing | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // TIN & Retrieval Add-on State
  const [includeTin, setIncludeTin] = useState(false);
  const [tinFee, setTinFee] = useState(3000);
  const [rcNumber, setRcNumber] = useState('');
  const [registrationYear, setRegistrationYear] = useState('');

  // Form State
  const [proposedName1, setProposedName1] = useState('');
  const [proposedName2, setProposedName2] = useState('');
  const [proposedName3, setProposedName3] = useState(''); // Only for NGO

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [natureOfBusiness, setNatureOfBusiness] = useState(''); // Org type for NGO
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [tenure, setTenure] = useState(''); // For NGO

  // Dynamic Persons (Proprietor, Chairman, Secretary, Trustees)
  const defaultPerson = {
    fullName: '', dob: '', gender: 'Male', phone: '', nin: '', email: '',
    state: '', lga: '', houseNumber: '', address: '', signatureUri: '', passportUri: ''
  };

  const [proprietors, setProprietors] = useState([{ ...defaultPerson }]);
  const [chairman, setChairman] = useState({ ...defaultPerson });
  const [secretary, setSecretary] = useState({ ...defaultPerson });
  const [trustees, setTrustees] = useState([{ ...defaultPerson }]);
  const [witness, setWitness] = useState({ ...defaultPerson });
  
  const [aims, setAims] = useState('');

  useEffect(() => {
    fetchPricing();
  }, []);

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
          price: 7500
        });
      }

      setPricings(allPricings);

      if (editId) {
        await loadEditData(editId as string, allPricings);
      } else if (allPricings.length > 0) {
        setRegType(allPricings[0]); // Default first pricing
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

  const pickImage = async (setter: Function, field: string) => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setter((prev: any) => {
          if (Array.isArray(prev)) {
            // Not handling array logic directly here to keep it simple, but we map index if needed.
            return prev;
          }
          return { ...prev, [field]: result.assets[0].uri };
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickArrayImage = async (array: any[], index: number, field: string, setArray: Function) => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={[s.personTitle, { marginBottom: 0 }]}>{title}</Text>
          {onRemove && (
            <TouchableOpacity onPress={onRemove}>
              <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: 'bold' }}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.row}>
          <View style={s.inputContainer}>
            <Text style={s.label}>Full name</Text>
            <TextInput style={s.input} value={data.fullName} onChangeText={t => updateField('fullName', t)} />
          </View>
          <CustomDatePicker label="Date of birth" value={data.dob} onChange={(v: string) => updateField('dob', v)} />
        </View>

        <View style={s.row}>
          <CustomDropdown label="Gender" value={data.gender} options={['Male', 'Female']} onSelect={(v: string) => updateField('gender', v)} />
          <View style={s.inputContainer}>
            <Text style={s.label}>Phone number</Text>
            <TextInput style={s.input} keyboardType="phone-pad" value={data.phone} onChangeText={t => updateField('phone', t)} />
          </View>
        </View>

        <View style={s.row}>
          <View style={s.inputContainer}>
            <Text style={s.label}>NIN number</Text>
            <TextInput style={s.input} keyboardType="numeric" value={data.nin} onChangeText={t => updateField('nin', t)} />
          </View>
          <View style={s.inputContainer}>
            <Text style={s.label}>Email address</Text>
            <TextInput style={s.input} keyboardType="email-address" value={data.email} onChangeText={t => updateField('email', t)} />
          </View>
        </View>

        <View style={s.row}>
          <CustomDropdown label="State" value={data.state} options={STATE_LIST} onSelect={(val: string) => { updateField('state', val); updateField('lga', ''); }} />
          <CustomDropdown label="LGA and city" value={data.lga} options={data.state ? NIGERIA_STATES[data.state] : []} onSelect={(v: string) => updateField('lga', v)} placeholder="Select State First" />
        </View>

        <View style={s.row}>
          <View style={s.inputContainer}>
            <Text style={s.label}>House number</Text>
            <TextInput style={s.input} value={data.houseNumber} onChangeText={t => updateField('houseNumber', t)} />
          </View>
          <View style={s.inputContainer}>
            <Text style={s.label}>Home address</Text>
            <TextInput style={s.input} value={data.address} onChangeText={t => updateField('address', t)} />
          </View>
        </View>

        <View style={s.row}>
          <TouchableOpacity 
            style={s.filePickerBtn} 
            onPress={() => isArray ? pickArrayImage(person as any[], index, 'signatureUri', setter) : pickImage(setter, 'signatureUri')}
          >
            <Text style={s.label}>Signature (upload)</Text>
            <View style={s.fileBox}>
              <Text style={data.signatureUri ? s.fileTextActive : s.fileText}>{data.signatureUri ? 'Image Selected ✓' : 'Choose File No file chosen'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={s.filePickerBtn} 
            onPress={() => isArray ? pickArrayImage(person as any[], index, 'passportUri', setter) : pickImage(setter, 'passportUri')}
          >
            <Text style={s.label}>Passport (upload)</Text>
            <View style={s.fileBox}>
              <Text style={data.passportUri ? s.fileTextActive : s.fileText}>{data.passportUri ? 'Image Selected ✓' : 'Choose File No file chosen'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const uploadFileToSupabase = async (uri: string, path: string) => {
    if (!uri) return null;
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

  const handleSubmit = async () => {
    if (!regType) return Alert.alert('Error', 'Please select a service type');
    
    if (isRetrieval) {
      if (!proposedName1.trim()) return Alert.alert('Error', 'Please enter your Registered Business / Company Name');
      if (!rcNumber.trim()) return Alert.alert('Error', 'Please enter your CAC RC or BN Number');
    } else {
      if (!proposedName1.trim() || (!isNgo && !proposedName2.trim())) {
        return Alert.alert('Error', 'Please enter your proposed business names');
      }
    }

    try {
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalCost = regType.price + (includeTin ? tinFee : 0);

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

      // If editing, bypass payment RPC and just update the table directly
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

      // Call RPC for new requests (charges wallet total cost including TIN)
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

      Alert.alert('Success', isRetrieval ? 'Certificate Retrieval Request submitted successfully!' : 'CAC Registration submitted successfully!', [
        { text: 'View History', onPress: () => router.push('/cac-history') },
        { text: 'OK', onPress: () => router.back() }
      ]);
      
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={s.headerTitleArea}>
          <Text style={s.headerTitle}>{editId ? 'Edit Application' : 'CAC Registration'}</Text>
          <Text style={s.headerSubTitle}>Register a business name, company or NGO</Text>
        </View>
        <TouchableOpacity style={s.historyBtnTop} onPress={() => router.push('/cac-history')}>
          <Ionicons name="time-outline" size={16} color={COLORS.gold} />
          <Text style={s.historyBtnTxt}>History</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Dynamic Banners */}
        <DynamicBanners placement="cac" />
        
        {/* Info Banner Feature */}
        <View style={s.infoBanner}>
          <Ionicons name="information-circle" size={20} color={COLORS.navy} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={s.infoBannerTitle}>Registration Guide</Text>
            <Text style={s.infoBannerText}>Ensure all names and addresses are accurate. Provide clear passport and signature uploads to avoid queries.</Text>
          </View>
        </View>

        {!editId && (
          <View style={s.chargeCard}>
             <View style={s.chargeRow}>
                <Text style={s.chargeRowLabel}>Base Service Fee:</Text>
                <Text style={s.chargeRowAmt}>₦{regType?.price ? regType.price.toLocaleString() : '0.00'}</Text>
             </View>
             {includeTin && (
               <View style={[s.chargeRow, { marginTop: 4 }]}>
                  <Text style={[s.chargeRowLabel, { color: COLORS.goldDk }]}>TIN Processing Add-on:</Text>
                  <Text style={[s.chargeRowAmt, { color: COLORS.goldDk }]}>+₦{tinFee.toLocaleString()}</Text>
               </View>
             )}
             <View style={[s.chargeRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#e2e8f0' }]}>
                <Text style={[s.chargeRowLabel, { fontWeight: 'bold', color: COLORS.navy }]}>Total Amount Payable:</Text>
                <Text style={[s.chargeRowAmt, { fontSize: 18, color: COLORS.navy }]}>
                  ₦{((regType?.price || 0) + (includeTin ? tinFee : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
             </View>
          </View>
        )}

        <View style={s.formCard}>
          
          <View style={s.inputGroup}>
            <Text style={s.labelReq}>Service / Registration Type *</Text>
            <TouchableOpacity 
              style={[s.dropdownBtn, editId ? { backgroundColor: '#f1f5f9' } : {}]} 
              onPress={() => !editId && setShowTypeDropdown(!showTypeDropdown)}
              activeOpacity={editId ? 1 : 0.2}
            >
              <Text style={[s.dropdownTxt, editId ? { color: COLORS.textSub } : {}]}>
                {regType ? regType.name : 'Select Type'}
              </Text>
              {!editId && <Ionicons name="chevron-down" size={20} color={COLORS.textSub} />}
            </TouchableOpacity>
            
            {showTypeDropdown && !editId && (
              <View style={s.dropdownList}>
                {loading ? <ActivityIndicator color={COLORS.navy} /> : pricings.map((p) => (
                  <TouchableOpacity 
                    key={p.id} 
                    style={[s.dropdownItem, regType?.id === p.id && s.dropdownItemActive]}
                    onPress={() => { setRegType(p); setShowTypeDropdown(false); }}
                  >
                    <Text style={[s.dropdownItemTxt, regType?.id === p.id && s.dropdownItemTxtActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Apply with TIN Checkbox Feature */}
          <TouchableOpacity 
            style={[s.tinCard, includeTin && s.tinCardActive]} 
            onPress={() => setIncludeTin(!includeTin)}
            activeOpacity={0.8}
          >
            <View style={[s.tinCheckbox, includeTin && s.tinCheckboxActive]}>
              {includeTin && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={s.tinTitle}>Apply with TIN (Tax Identification Number)</Text>
                <View style={s.tinBadge}>
                  <Text style={s.tinBadgeTxt}>RECOMMENDED</Text>
                </View>
              </View>
              <Text style={s.tinSub}>Process official JTB Tax Identification Number alongside your CAC (+₦{tinFee.toLocaleString()})</Text>
            </View>
          </TouchableOpacity>

          {isRetrieval ? (
            /* CAC Certificate Retrieval Specific Form */
            <>
              <Text style={s.sectionHeader}>CAC CERTIFICATE RETRIEVAL DETAILS</Text>
              <View style={s.inputContainer}>
                <Text style={s.labelReq}>Registered Business / Company Name *</Text>
                <TextInput 
                  style={s.input} 
                  placeholder="e.g. Abu Mafhal Enterprises LTD" 
                  value={proposedName1} 
                  onChangeText={setProposedName1} 
                />
              </View>

              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.labelReq}>CAC RC or BN Number *</Text>
                  <TextInput 
                    style={s.input} 
                    placeholder="e.g. BN-1234567 or RC-987654" 
                    value={rcNumber} 
                    onChangeText={setRcNumber} 
                  />
                </View>

                <View style={s.inputContainer}>
                  <Text style={s.label}>Registration Year / Date</Text>
                  <TextInput 
                    style={s.input} 
                    placeholder="e.g. 2021 or 15/04/2021" 
                    value={registrationYear} 
                    onChangeText={setRegistrationYear} 
                  />
                </View>
              </View>

              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Contact Email Address</Text>
                  <TextInput style={s.input} keyboardType="email-address" value={email} onChangeText={setEmail} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Contact Phone Number</Text>
                  <TextInput style={s.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                </View>
              </View>

              <Text style={s.sectionHeader}>APPLICANT / BUSINESS OWNER DETAILS</Text>
              {proprietors.map((_, i) => renderPersonForm(
                proprietors, 
                'Business Owner / Applicant', 
                setProprietors, 
                true, 
                i
              ))}
            </>
          ) : (
            /* Standard CAC Registration Form */
            <>
              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.labelReq}>Proposed Name 1 *</Text>
                  <TextInput style={s.input} placeholder="First choice name" value={proposedName1} onChangeText={setProposedName1} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.labelReq}>Proposed Name 2 *</Text>
                  <TextInput style={s.input} placeholder="Alternative name" value={proposedName2} onChangeText={setProposedName2} />
                </View>
              </View>

              <Text style={s.sectionHeader}>BUSINESS INFORMATION</Text>

          {isNgo && (
            <View style={s.row}>
              <View style={s.inputContainer}>
                <Text style={s.label}>Proposed name 3</Text>
                <TextInput style={s.input} value={proposedName3} onChangeText={setProposedName3} />
              </View>
              <View style={s.inputContainer}>
                <Text style={s.label}>NGO email address</Text>
                <TextInput style={s.input} keyboardType="email-address" value={email} onChangeText={setEmail} />
              </View>
            </View>
          )}

          {!isNgo && !isLimitedLiability && (
            <>
              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company email address</Text>
                  <TextInput style={s.input} keyboardType="email-address" value={email} onChangeText={setEmail} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Nature of business</Text>
                  <TextInput style={s.input} value={natureOfBusiness} onChangeText={setNatureOfBusiness} />
                </View>
              </View>

              <View style={s.row}>
                <CustomDropdown label="Company state" value={state} options={STATE_LIST} onSelect={(val: string) => { setState(val); setLga(''); }} />
                <CustomDropdown label="Company LGA and city" value={lga} options={state ? NIGERIA_STATES[state] : []} onSelect={setLga} placeholder="Select State First" />
              </View>

              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Office/House Number</Text>
                  <TextInput style={s.input} value={officeNumber} onChangeText={setOfficeNumber} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Office address</Text>
                  <TextInput style={s.input} value={officeAddress} onChangeText={setOfficeAddress} />
                </View>
              </View>
            </>
          )}

          {isLimitedLiability && (
            <>
              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company email address</Text>
                  <TextInput style={s.input} keyboardType="email-address" value={email} onChangeText={setEmail} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company phone number</Text>
                  <TextInput style={s.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                </View>
              </View>

              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Nature of business</Text>
                  <TextInput style={s.input} value={natureOfBusiness} onChangeText={setNatureOfBusiness} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company state</Text>
                  <TextInput style={s.input} value={state} onChangeText={setState} />
                </View>
              </View>

              <View style={s.row}>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company LGA and city</Text>
                  <TextInput style={s.input} value={lga} onChangeText={setLga} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Office/House Number</Text>
                  <TextInput style={s.input} value={officeNumber} onChangeText={setOfficeNumber} />
                </View>
              </View>

              <View style={s.inputContainer}>
                 <Text style={s.label}>Office address</Text>
                 <TextInput style={s.input} value={officeAddress} onChangeText={setOfficeAddress} />
              </View>
            </>
          )}

          <View style={s.row}>
            {isNgo && (
               <>
                 <View style={s.inputContainer}>
                  <Text style={s.label}>Company phone number</Text>
                  <TextInput style={s.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                 </View>
                 <View style={s.inputContainer}>
                  <Text style={s.label}>Organisation type or category</Text>
                  <TextInput style={s.input} value={natureOfBusiness} onChangeText={setNatureOfBusiness} />
                 </View>
               </>
            )}
          </View>

          <View style={s.row}>
            {isNgo && (
              <>
                 <View style={s.inputContainer}>
                  <Text style={s.label}>Company state</Text>
                  <TextInput style={s.input} value={state} onChangeText={setState} />
                 </View>
                 <View style={s.inputContainer}>
                  <Text style={s.label}>Company LGA and city</Text>
                  <TextInput style={s.input} value={lga} onChangeText={setLga} />
                 </View>
              </>
            )}
          </View>

          <View style={s.row}>
            {isNgo && (
               <>
                 <View style={s.inputContainer}>
                  <Text style={s.label}>Office/House Number</Text>
                  <TextInput style={s.input} value={officeNumber} onChangeText={setOfficeNumber} />
                 </View>
                 <View style={s.inputContainer}>
                  <Text style={s.label}>Trustees tenure (years)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={tenure} onChangeText={setTenure} />
                 </View>
               </>
            )}
          </View>

          {isNgo && (
             <View style={s.inputContainer}>
                <Text style={s.label}>Office address</Text>
                <TextInput style={s.input} value={officeAddress} onChangeText={setOfficeAddress} />
             </View>
          )}

          {isNgo ? (
            <>
              <Text style={s.sectionHeader}>CHAIRMAN</Text>
              {renderPersonForm(chairman, 'Chairman', setChairman)}

              <Text style={s.sectionHeader}>SECRETARY</Text>
              {renderPersonForm(secretary, 'Secretary', setSecretary)}

              <Text style={s.sectionHeader}>TRUSTEE DETAILS</Text>
              {trustees.map((_, i) => renderPersonForm(
                trustees, 
                `Trustee ${i+1}`, 
                setTrustees, 
                true, 
                i,
                i > 0 ? () => {
                  const newArr = [...trustees];
                  newArr.splice(i, 1);
                  setTrustees(newArr);
                } : undefined
              ))}
              
              <TouchableOpacity onPress={() => setTrustees([...trustees, { ...defaultPerson }])}>
                <Text style={s.addText}>+ Add Trustee</Text>
              </TouchableOpacity>

              <Text style={s.sectionHeader}>AIMS AND OBJECTIVES</Text>
              <TextInput 
                style={[s.input, { height: 100, textAlignVertical: 'top' }]} 
                placeholder="Describe the aims and objectives of the organization"
                multiline
                value={aims}
                onChangeText={setAims}
              />
            </>
          ) : (
            <>
              <Text style={s.sectionHeader}>PROPRIETOR DETAILS</Text>
              {proprietors.map((_, i) => renderPersonForm(
                proprietors, 
                isPartnership ? `Proprietor ${i+1}` : 'Proprietor', 
                setProprietors, 
                true, 
                i,
                isPartnership && i > 0 ? () => {
                  const newArr = [...proprietors];
                  newArr.splice(i, 1);
                  setProprietors(newArr);
                } : undefined
              ))}
              
              {isPartnership || isLimitedLiability ? (
                <TouchableOpacity onPress={() => setProprietors([...proprietors, { ...defaultPerson }])}>
                  <Text style={s.addText}>+ Add Proprietor</Text>
                </TouchableOpacity>
              ) : null}

              {isLimitedLiability && (
                <>
                  <Text style={s.sectionHeader}>WITNESS</Text>
                  {renderPersonForm(witness, 'Witness', setWitness)}

                  <Text style={s.sectionHeader}>SECRETARY (OPTIONAL)</Text>
                  {renderPersonForm(secretary, 'Secretary (optional)', setSecretary)}
                </>
              )}
            </>
          )}
        </>
      )}

          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={s.submitBtnTxt}>{editId ? 'Update Application' : 'Submit Registration'}</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: COLORS.navy,
  },
  backBtn: { marginRight: 16 },
  headerTitleArea: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  headerSubTitle: { fontSize: 12, color: COLORS.gold, marginTop: 2 },
  historyBtnTop: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,166,35,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gold, gap: 4 },
  historyBtnTxt: { fontSize: 12, fontWeight: 'bold', color: COLORS.gold },
  chargeCard: { backgroundColor: COLORS.white, padding: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chargeRowLabel: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  chargeRowAmt: { fontSize: 15, fontWeight: '800', color: COLORS.success },
  content: { flex: 1 },

  tinCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 16 },
  tinCardActive: { backgroundColor: '#fffbeb', borderColor: COLORS.goldDk },
  tinCheckbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.textSub, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  tinCheckboxActive: { backgroundColor: COLORS.goldDk, borderColor: COLORS.goldDk },
  tinTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy },
  tinSub: { fontSize: 10, color: COLORS.textSub, marginTop: 2, lineHeight: 14 },
  tinBadge: { backgroundColor: 'rgba(245,166,35,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  tinBadgeTxt: { fontSize: 8, fontWeight: '900', color: COLORS.goldDk },
  
  infoBanner: { flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 12, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#c7d2fe', alignItems: 'center' },
  infoBannerTitle: { fontSize: 12, fontWeight: '700', color: COLORS.navy, marginBottom: 2 },
  infoBannerText: { fontSize: 10, color: COLORS.textSub, lineHeight: 14 },
  
  formCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 20 },
  inputGroup: { marginBottom: 14, zIndex: 10 },
  labelReq: { fontSize: 11, fontWeight: '700', color: COLORS.navy, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.textSub, marginBottom: 4 },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 42, backgroundColor: '#f8fafc' },
  dropdownTxt: { fontSize: 13, color: COLORS.navy, fontWeight: '600' },
  dropdownList: { position: 'absolute', top: 65, left: 0, right: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, zIndex: 100 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownItemActive: { backgroundColor: 'rgba(245,166,35,0.1)' },
  dropdownItemTxt: { fontSize: 13, color: COLORS.textMain },
  dropdownItemTxtActive: { color: COLORS.goldDk, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputContainer: { flex: 1 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, height: 42, paddingHorizontal: 12, fontSize: 13, color: COLORS.textMain, backgroundColor: '#f8fafc' },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy, marginTop: 12, marginBottom: 10, letterSpacing: 0.5, borderBottomWidth: 2, borderBottomColor: COLORS.gold, alignSelf: 'flex-start', paddingBottom: 4 },
  personCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: '#fcfdfd' },
  personTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.navy, marginBottom: 12 },
  filePickerBtn: { flex: 1, marginBottom: 10 },
  fileBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, height: 42, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#f8fafc', borderStyle: 'dashed' },
  fileText: { fontSize: 11, color: COLORS.textSub },
  fileTextActive: { fontSize: 11, color: COLORS.success, fontWeight: 'bold' },
  addText: { color: COLORS.goldDk, fontSize: 12, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', paddingVertical: 8, borderWidth: 1, borderColor: COLORS.gold, borderRadius: 6 },
  submitBtn: { backgroundColor: COLORS.navy, flexDirection: 'row', height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8, width: '60%', alignSelf: 'center' },
  submitBtnTxt: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalOptionText: { fontSize: 16, color: COLORS.textMain },
});
