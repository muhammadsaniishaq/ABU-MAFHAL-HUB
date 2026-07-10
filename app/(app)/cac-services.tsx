import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function CACServices() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pricings, setPricings] = useState<Pricing[]>([]);
  const [regType, setRegType] = useState<Pricing | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

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
      const { data, error } = await supabase.from('cac_pricing').select('*').eq('active', true).order('price', { ascending: true });
      if (error && error.code !== '42P01') {
        // Ignore 42P01 if table doesn't exist yet in cache
        console.error('Error fetching CAC pricing:', error);
      }
      if (data) {
        setPricings(data);
        if (data.length > 0) setRegType(data[data.length - 1]); // Default to NGO based on user request
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isNgo = regType?.name?.toLowerCase().includes('ngo');
  const isPartnership = regType?.name?.toLowerCase().includes('partnership');
  const isLimitedLiability = regType?.name?.toLowerCase().includes('limited liability') || regType?.name?.toLowerCase().includes('ltd') || regType?.name?.toLowerCase().includes('share');

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
        const newArr = [...(person as any[])];
        newArr[index][f] = v;
        setter(newArr);
      } else {
        setter({ ...person, [f]: v });
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
          <View style={s.inputContainer}>
            <Text style={s.label}>Date of birth (mm/dd/yyyy)</Text>
            <TextInput style={s.input} placeholder="mm/dd/yyyy" value={data.dob} onChangeText={t => updateField('dob', t)} />
          </View>
        </View>

        <View style={s.row}>
          <View style={s.inputContainer}>
            <Text style={s.label}>Gender</Text>
            <TextInput style={s.input} value={data.gender} onChangeText={t => updateField('gender', t)} />
          </View>
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
          <View style={s.inputContainer}>
            <Text style={s.label}>State</Text>
            <TextInput style={s.input} value={data.state} onChangeText={t => updateField('state', t)} />
          </View>
          <View style={s.inputContainer}>
            <Text style={s.label}>LGA and city</Text>
            <TextInput style={s.input} value={data.lga} onChangeText={t => updateField('lga', t)} />
          </View>
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
    if (!regType) return Alert.alert('Error', 'Please select a registration type');
    if (!proposedName1 || !proposedName2) return Alert.alert('Error', 'Please enter proposed names');

    try {
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check balance first before heavy uploads
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
      if (!profile || profile.balance < regType.price) {
        throw new Error(`Insufficient wallet balance. You need ₦${regType.price.toLocaleString()} for this service.`);
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
        email, phone, natureOfBusiness, state, lga, officeNumber, officeAddress, tenure
      };

      const proposedNames = {
        name1: proposedName1,
        name2: proposedName2,
        name3: proposedName3
      };

      // Call RPC
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
        p_cost: regType.price
      });

      if (rpcError) throw rpcError;

      Alert.alert('Success', 'CAC Registration submitted successfully!', [
        { text: 'View History', onPress: () => router.push('/cac-history') },
        { text: 'OK', onPress: () => router.back() }
      ]);
      
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to submit registration');
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
          <Text style={s.headerTitle}>CAC Registration</Text>
          <Text style={s.headerSubTitle}>Register a business name, company or NGO</Text>
        </View>
        <TouchableOpacity style={s.historyBtnTop} onPress={() => router.push('/cac-history')}>
          <Ionicons name="time-outline" size={16} color={COLORS.gold} />
          <Text style={s.historyBtnTxt}>History</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        {/* Info Banner Feature */}
        <View style={s.infoBanner}>
          <Ionicons name="information-circle" size={20} color={COLORS.navy} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={s.infoBannerTitle}>Registration Guide</Text>
            <Text style={s.infoBannerText}>Ensure all names and addresses are accurate. Provide clear passport and signature uploads to avoid queries.</Text>
          </View>
        </View>

        <View style={s.chargeRow}>
           <Text style={s.chargeRowLabel}>Service Charge:</Text>
           <Text style={s.chargeRowAmt}>₦{regType?.price ? regType.price.toLocaleString() : '0.00'}</Text>
        </View>

        <View style={s.formCard}>
          
          <View style={s.inputGroup}>
            <Text style={s.labelReq}>Registration Type *</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowTypeDropdown(!showTypeDropdown)}>
              <Text style={s.dropdownTxt}>{regType ? regType.name : 'Select Type'}</Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textSub} />
            </TouchableOpacity>
            
            {showTypeDropdown && (
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
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company state</Text>
                  <TextInput style={s.input} value={state} onChangeText={setState} />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Company LGA and city</Text>
                  <TextInput style={s.input} value={lga} onChangeText={setLga} />
                </View>
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

          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="document-text" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={s.submitBtnTxt}>Submit Registration</Text>
              </>
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
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, padding: 14, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  chargeRowLabel: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  chargeRowAmt: { fontSize: 16, fontWeight: '800', color: COLORS.success },
  content: { flex: 1 },
  
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
});
