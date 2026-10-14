import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, TextInput, ActivityIndicator, 
  Alert, Image, ScrollView, KeyboardAvoidingView, Platform, 
  StyleSheet, Modal, Switch 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import { NIGERIA_STATES, STATE_LIST } from '../../utils/nigeriaStates';

// Design Tokens matching reference UI
const C = {
  navy: '#0D1B3E',
  navyMid: '#162854',
  gold: '#D99414',
  goldDark: '#B87B0B',
  goldLight: '#FFF8EB',
  goldBorder: '#F3C366',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',
  textMain: '#0D1B3E',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  green: '#10B981',
  greenLight: '#ECFDF5',
  greenBorder: '#A7F3D0',
  blueInfo: '#EFF6FF',
  blueBorder: '#BFDBFE',
  blueShield: '#1D4ED8',
  error: '#EF4444',
  amber: '#F59E0B',
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function UserKYCScreen() {
  const router = useRouter();
  const { settings } = useAppSettings();

  // Screen State: 'intro' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'in_progress' | 'verified'
  const [currentStep, setCurrentStep] = useState<number | string>('intro');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Step 1: Consent & Privacy
  const [consentAgreed, setConsentAgreed] = useState(true);

  // Step 2: NIN & DOB
  const [ninInput, setNinInput] = useState('');
  const [dobDay, setDobDay] = useState('15');
  const [dobMonth, setDobMonth] = useState('Mar');
  const [dobYear, setDobYear] = useState('2000');
  const [showDobModal, setShowDobModal] = useState(false);

  // Step 3: BVN
  const [bvnInput, setBvnInput] = useState('');

  // Step 4: Upload ID Card
  const [docImageUri, setDocImageUri] = useState<string | null>(null);

  // Step 5: Selfie
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  // Step 6: Residential Address
  const [state, setState] = useState('Yobe');
  const [lga, setLga] = useState('Gashua');
  const [addressInput, setAddressInput] = useState('No. 12, Main Road, Gashua');
  const [useAddressForAll, setUseAddressForAll] = useState(true);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showLgaDropdown, setShowLgaDropdown] = useState(false);

  // Load User Data
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Session Expired', 'Please log in to continue.');
        router.replace('/(auth)/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setUserProfile({ ...profile, id: user.id });

      // Pre-fill profile values if already present
      if (profile?.nin) setNinInput(profile.nin);
      if (profile?.bvn) setBvnInput(profile.bvn);
      if (profile?.state) setState(profile.state);
      if (profile?.lga) setLga(profile.lga);
      if (profile?.address) setAddressInput(profile.address);

      // Check for pending KYC requests
      const { data: pending } = await supabase
        .from('kyc_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profile?.kyc_verified || (profile?.kyc_tier && profile.kyc_tier >= 2)) {
        setCurrentStep('verified');
      } else if (pending) {
        setCurrentStep('in_progress');
      } else {
        setCurrentStep('intro');
      }

    } catch (e: any) {
      console.warn('KYC load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Image Pickers
  const handleTakePhoto = async (type: 'document' | 'selfie') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        cameraType: type === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (type === 'document') setDocImageUri(result.assets[0].uri);
        else setSelfieUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to capture photo');
    }
  };

  const handlePickFromGallery = async (type: 'document' | 'selfie') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant gallery access to select a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (type === 'document') setDocImageUri(result.assets[0].uri);
        else setSelfieUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pick image');
    }
  };

  const uploadFileToSupabase = async (uri: string, prefix: string, userId: string) => {
    if (!uri) return null;
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    const fileExt = (uri.split('.').pop() || 'jpg').split('?')[0];
    const fileName = `${userId}_${prefix}_${Date.now()}.${fileExt}`;
    const mime = fileExt.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, decode(base64), { contentType: mime, upsert: true });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);
      return publicUrlData?.publicUrl || fileName;
    }
    return `data:${mime};base64,${base64}`;
  };

  // Step 1 Validation
  const handleContinueFromStep1 = () => {
    if (!consentAgreed) {
      return Alert.alert('Consent Required', 'Please agree to the privacy policy to continue.');
    }
    setCurrentStep(2);
  };

  // Step 2 Validation (NIN)
  const handleVerifyNIN = () => {
    const cleanNin = ninInput.replace(/\s+/g, '');
    if (!cleanNin || cleanNin.length !== 11 || !/^\d{11}$/.test(cleanNin)) {
      return Alert.alert('Invalid NIN', 'Please enter your valid 11-digit National Identification Number (NIN).');
    }
    setCurrentStep(3);
  };

  // Step 3 Validation (BVN)
  const handleVerifyBVN = () => {
    const cleanBvn = bvnInput.replace(/\s+/g, '');
    if (!cleanBvn || cleanBvn.length !== 11 || !/^\d{11}$/.test(cleanBvn)) {
      return Alert.alert('Invalid BVN', 'Please enter your valid 11-digit Bank Verification Number (BVN). Both NIN and BVN are required.');
    }
    setCurrentStep(4);
  };

  // Step 4 Validation (ID Document)
  const handleContinueFromStep4 = () => {
    if (!docImageUri) {
      return Alert.alert('Document Required', 'Please upload or capture a photo of your National ID card.');
    }
    setCurrentStep(5);
  };

  // Step 5 Validation (Selfie)
  const handleContinueFromStep5 = () => {
    if (!selfieUri) {
      return Alert.alert('Selfie Required', 'Please take a clear selfie photo to confirm your identity.');
    }
    setCurrentStep(6);
  };

  // Step 6 Validation (Address)
  const handleContinueFromStep6 = () => {
    if (!state) return Alert.alert('State Required', 'Please select your residential State.');
    if (!lga) return Alert.alert('LGA Required', 'Please select your LGA.');
    if (!addressInput.trim() || addressInput.trim().length < 5) {
      return Alert.alert('Address Required', 'Please enter your complete residential street address.');
    }
    setCurrentStep(7);
  };

  // Step 7: Final Submit
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session expired. Please log in.');

      // 1. Upload Document & Selfie Photos
      const docUploadedUrl = await uploadFileToSupabase(docImageUri || '', 'doc', user.id);
      const selfieUploadedUrl = await uploadFileToSupabase(selfieUri || '', 'selfie', user.id);

      const isAutoApprove = 
        settings?.auto_kyc_verification_enabled === true || 
        settings?.auto_approve_kyc === true;

      const formattedDob = `${dobDay} ${dobMonth} ${dobYear}`;

      // 2. Insert into kyc_requests table
      await supabase.from('kyc_requests').insert({
        user_id: user.id,
        document_type: 'nin',
        document_number: ninInput.trim(),
        document_url: docUploadedUrl,
        status: isAutoApprove ? 'approved' : 'pending',
        admin_note: JSON.stringify({
          nin: ninInput.trim(),
          bvn: bvnInput.trim(),
          dob: formattedDob,
          state: state,
          lga: lga,
          address: addressInput.trim(),
          selfie_url: selfieUploadedUrl,
        })
      });

      // 3. Update Profiles with both NIN, BVN, & Address
      const profileUpdate: any = {
        nin: ninInput.trim(),
        bvn: bvnInput.trim(),
        state: state,
        lga: lga,
        address: addressInput.trim(),
      };

      if (isAutoApprove) {
        profileUpdate.kyc_tier = 2;
        profileUpdate.kyc_verified = true;
      }

      await supabase.from('profiles').update(profileUpdate).eq('id', user.id);

      // 4. Trigger Automatic Dedicated Virtual Account (Wema/PalmPay/9PSB)
      try {
        await supabase.functions.invoke('create-virtual-account', {
          body: { userId: user.id, bvn: bvnInput.trim(), forceSecondAccount: true, forceUpdate: true }
        });
      } catch (vaErr) {
        console.warn('Virtual account creation trigger warning:', vaErr);
      }

      // Transition Screen
      if (isAutoApprove) {
        setCurrentStep('verified');
      } else {
        setCurrentStep('in_progress');
      }

    } catch (e: any) {
      console.error('KYC submit error:', e);
      Alert.alert('Submission Error', e.message || 'Could not complete verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const STEP_LABELS = ['Consent','NIN','BVN','ID Card','Selfie','Address','Review'];

  // Premium 7-step header with gold progress bar
  const render7StepHeader = (stepNum: number, onBack: () => void) => (
    <View style={s.stepHeaderContainer}>
      <View style={s.stepHeaderTop}>
        <TouchableOpacity onPress={onBack} style={s.headerBackBtn} activeOpacity={0.7}>
          <View style={s.backBtnCircle}>
            <Ionicons name="chevron-back" size={20} color={C.navy} />
          </View>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.stepHeaderTitle}>Identity Verification</Text>
          <Text style={s.stepHeaderSubtitle}>{STEP_LABELS[stepNum - 1]} · Step {stepNum} of 7</Text>
        </View>
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeTxt}>{stepNum}/7</Text>
        </View>
      </View>

      {/* Progress Track */}
      <View style={s.progressBarTrack}>
        {[1, 2, 3, 4, 5, 6, 7].map((seg) => (
          <View
            key={seg}
            style={[
              s.progressSegment,
              seg < stepNum
                ? s.progressSegmentDone
                : seg === stepNum
                  ? s.progressSegmentActive
                  : s.progressSegmentInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={{ marginTop: 12, color: C.textSub, fontSize: 13, fontWeight: '600' }}>Loading KYC profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* ======================================================== */}
        {/* INTRO SCREEN */}
        {/* ======================================================== */}
        {currentStep === 'intro' && (
          <View style={s.screenWrapper}>
            <View style={s.introTopBar}>
              <TouchableOpacity onPress={() => router.back()} style={s.headerBackBtn}>
                <View style={s.backBtnCircle}>
                  <Ionicons name="chevron-back" size={20} color={C.navy} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.skipBtnTxt}>Skip</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.introContent} showsVerticalScrollIndicator={false}>

              {/* Hero Panel */}
              <View style={s.introHeroPanel}>
                <View style={s.introShieldGlow} />
                <View style={s.introShieldOuter}>
                  <View style={s.introShieldInner}>
                    <Ionicons name="shield-checkmark" size={44} color={C.gold} />
                  </View>
                </View>
                <View style={s.introBrandRow}>
                  <View style={s.introBrandDot} />
                  <Text style={s.introBrandTxt}>ABU <Text style={{ color: C.gold }}>MAFHAL</Text> SUB</Text>
                </View>
              </View>

              <Text style={s.introHeading}>Verify Your Identity</Text>
              <Text style={s.introSubheading}>
                Complete your KYC in 7 easy steps to unlock higher limits and all premium services.
              </Text>

              {/* Step roadmap */}
              <View style={s.introRoadmap}>
                {[
                  { icon: 'document-text-outline', label: 'Consent & Privacy', sub: 'Review data usage policy' },
                  { icon: 'card-outline',           label: 'NIN Verification',  sub: '11-digit national ID number' },
                  { icon: 'business-outline',        label: 'BVN Verification',  sub: 'Bank verification number' },
                  { icon: 'id-card-outline',         label: 'Upload ID Card',    sub: 'Clear photo of your NIN card' },
                  { icon: 'camera-outline',          label: 'Take a Selfie',     sub: 'Face matching for security' },
                  { icon: 'location-outline',        label: 'Residential Address',sub: 'Your current state & LGA' },
                  { icon: 'checkmark-circle-outline',label: 'Review & Submit',   sub: 'Confirm all your details' },
                ].map((step, i) => (
                  <View key={i} style={s.introRoadmapRow}>
                    <View style={s.introRoadmapNum}>
                      <Text style={s.introRoadmapNumTxt}>{i + 1}</Text>
                    </View>
                    {i < 6 && <View style={s.introRoadmapLine} />}
                    <View style={s.introRoadmapIconBox}>
                      <Ionicons name={step.icon as any} size={18} color={C.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.introRoadmapLabel}>{step.label}</Text>
                      <Text style={s.introRoadmapSub}>{step.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </ScrollView>

            {/* Bottom Action */}
            <View style={s.introBottomBar}>
              <TouchableOpacity
                style={s.btnGold}
                onPress={() => setCurrentStep(1)}
                activeOpacity={0.85}
              >
                <Ionicons name="shield-checkmark" size={18} color={C.white} />
                <Text style={s.btnGoldTxt}>Start Verification</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
              <View style={s.footnoteRow}>
                <Ionicons name="lock-closed" size={13} color={C.textSub} />
                <Text style={s.footnoteTxt}>256-bit encrypted · NDPR & CBN compliant</Text>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 1 OF 7: CONSENT & PRIVACY */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(1, () => setCurrentStep('intro'))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Consent & Privacy</Text>

              {/* Graphic: Document with Padlock + Blue Shield & Checkmark */}
              <View style={s.consentGraphicContainer}>
                <View style={s.consentDocSheet}>
                  <View style={s.docSheetLineLong} />
                  <View style={s.docSheetLineMid} />
                  <View style={s.docSheetLineShort} />
                  <View style={s.docPadlockBadge}>
                    <Ionicons name="lock-closed" size={14} color={C.gold} />
                  </View>
                </View>

                <View style={s.consentShieldBadge}>
                  <Ionicons name="shield-checkmark" size={36} color={C.blueShield} />
                </View>
              </View>

              <Text style={s.consentBodyText}>
                We collect and verify your NIN and BVN for identity verification in compliance with Nigerian regulations. Your data is encrypted and used only for verification purposes.
              </Text>

              {/* Checkbox Card */}
              <TouchableOpacity 
                style={s.consentCheckboxRow} 
                onPress={() => setConsentAgreed(!consentAgreed)}
                activeOpacity={0.8}
              >
                <View style={[s.checkboxSquare, consentAgreed && s.checkboxSquareActive]}>
                  {consentAgreed && <Ionicons name="checkmark" size={14} color={C.white} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.consentCheckLabel}>
                    I agree to the collection and verification of my NIN and BVN data and I have read the{' '}
                    <Text style={s.privacyLinkTxt}>Privacy Policy.</Text>
                  </Text>
                  <TouchableOpacity 
                    onPress={() => Alert.alert('Privacy Policy', 'Abu Mafhal Sub uses bank-grade encryption to safeguard your identity data in compliance with NDPR and CBN guidelines.')}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={s.readPolicyBtnTxt}>Read Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={[s.btnNavy, !consentAgreed && { opacity: 0.6 }]} 
                onPress={handleContinueFromStep1}
                disabled={!consentAgreed}
                activeOpacity={0.85}
              >
                <Text style={s.btnNavyTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 2 OF 7: ENTER YOUR NIN */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(2, () => setCurrentStep(1))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Enter Your NIN</Text>
              <Text style={s.pageSubheading}>
                Provide your National Identification Number (NIN) as printed on your NIN slip.
              </Text>

              {/* NIN Number Input */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>NIN Number (11 digits)</Text>
                <View style={s.textInputWrapper}>
                  <Ionicons name="card-outline" size={19} color={C.textSub} style={{ marginRight: 10 }} />
                  <TextInput
                    style={s.textInputField}
                    placeholder="1234 5678 901"
                    placeholderTextColor={C.textMuted}
                    keyboardType="numeric"
                    maxLength={11}
                    value={ninInput}
                    onChangeText={setNinInput}
                  />
                </View>
              </View>

              {/* Blue Info Notice */}
              <View style={s.infoNoticeBox}>
                <Ionicons name="information-circle" size={19} color="#2563EB" style={{ marginTop: 1 }} />
                <Text style={s.infoNoticeTxt}>
                  Your NIN will be verified with the official NIMC database.
                </Text>
              </View>

              {/* Date of Birth Input */}
              <View style={[s.fieldGroup, { marginTop: 16 }]}>
                <Text style={s.fieldLabel}>Date of Birth</Text>
                <TouchableOpacity 
                  style={s.textInputWrapper} 
                  onPress={() => setShowDobModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color={C.textSub} style={{ marginRight: 10 }} />
                  <Text style={[s.textInputField, { paddingTop: 2 }]}>
                    {`${dobDay} ${dobMonth} ${dobYear}`}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={C.textSub} />
                </TouchableOpacity>
              </View>

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnGold} 
                onPress={handleVerifyNIN}
                activeOpacity={0.85}
              >
                <Text style={s.btnGoldTxt}>Verify NIN</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 3 OF 7: ENTER YOUR BVN */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(3, () => setCurrentStep(2))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Enter Your BVN</Text>
              <Text style={s.pageSubheading}>
                Provide your Bank Verification Number (BVN) to verify your identity.
              </Text>

              {/* BVN Number Input */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>BVN Number (11 digits)</Text>
                <View style={s.textInputWrapper}>
                  <Ionicons name="business-outline" size={19} color={C.textSub} style={{ marginRight: 10 }} />
                  <TextInput
                    style={s.textInputField}
                    placeholder="1234 5678 901"
                    placeholderTextColor={C.textMuted}
                    keyboardType="numeric"
                    maxLength={11}
                    value={bvnInput}
                    onChangeText={setBvnInput}
                  />
                </View>
              </View>

              {/* Blue Info Notice */}
              <View style={s.infoNoticeBox}>
                <Ionicons name="information-circle" size={19} color="#2563EB" style={{ marginTop: 1 }} />
                <Text style={s.infoNoticeTxt}>
                  Your BVN will be verified with the official CBN database.
                </Text>
              </View>

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnGold} 
                onPress={handleVerifyBVN}
                activeOpacity={0.85}
              >
                <Text style={s.btnGoldTxt}>Verify BVN</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 4 OF 7: UPLOAD YOUR ID CARD */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(4, () => setCurrentStep(3))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Upload Your ID Card</Text>
              <Text style={s.pageSubheading}>
                Take a clear photo of your National ID. Make sure the details are visible.
              </Text>

              {/* ID Card Graphic / Preview with Premium NIN Mockup */}
              <View style={s.idCardGraphicContainer}>
                {docImageUri ? (
                  <View style={s.uploadedPreviewFrame}>
                    <Image source={{ uri: docImageUri }} style={s.uploadedDocImg} resizeMode="cover" />
                    <View style={s.uploadedSuccessBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={C.white} />
                      <Text style={s.uploadedSuccessBadgeTxt}>Photo Selected</Text>
                    </View>
                    <TouchableOpacity 
                      style={s.changePhotoChip} 
                      onPress={() => setDocImageUri(null)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh" size={13} color={C.navy} />
                      <Text style={s.changePhotoChipTxt}>Change Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.sampleCardContainer}>
                    {/* Badge Row */}
                    <View style={s.sampleCardBadgeRow}>
                      <View style={s.sampleBadgePill}>
                        <Ionicons name="shield-checkmark" size={13} color={C.gold} />
                        <Text style={s.sampleBadgeTxt}>SAMPLE NIN CARD MOCKUP</Text>
                      </View>
                      <View style={s.sampleAcceptedPill}>
                        <Ionicons name="checkmark-circle" size={12} color={C.green} />
                        <Text style={s.sampleAcceptedTxt}>Accepted Format</Text>
                      </View>
                    </View>

                    {/* Premium NIN Card Mockup Image */}
                    <TouchableOpacity 
                      style={s.sampleCardImageHolder} 
                      onPress={() => handlePickFromGallery('document')}
                      activeOpacity={0.92}
                    >
                      <Image 
                        source={require('../../assets/images/premium.png')} 
                        style={s.sampleCardImg} 
                        resizeMode="cover" 
                      />
                      <View style={s.sampleWatermarkChip}>
                        <Ionicons name="camera-outline" size={13} color="#FFFFFF" />
                        <Text style={s.sampleWatermarkTxt}>Tap to upload your ID</Text>
                      </View>
                    </TouchableOpacity>

                    <Text style={s.sampleCardHelperTxt}>
                      Upload a clear photo of your NIN Premium Card, Standard Slip, or National e-ID.
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons: Take Photo & Choose Gallery */}
              <View style={s.uploadButtonsGroup}>
                <TouchableOpacity 
                  style={s.btnOutlined} 
                  onPress={() => handleTakePhoto('document')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={19} color={C.navy} />
                  <Text style={s.btnOutlinedTxt}>Take Photo</Text>
                </TouchableOpacity>

                <View style={s.orDividerRow}>
                  <View style={s.orLine} />
                  <Text style={s.orTxt}>or</Text>
                  <View style={s.orLine} />
                </View>

                <TouchableOpacity 
                  style={s.btnOutlined} 
                  onPress={() => handlePickFromGallery('document')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="image-outline" size={19} color={C.navy} />
                  <Text style={s.btnOutlinedTxt}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>

              {/* Tips for Best Results */}
              <View style={s.tipsContainer}>
                <Text style={s.tipsHeading}>Tips for best results:</Text>
                <View style={s.tipRow}>
                  <Ionicons name="checkmark" size={15} color={C.textSub} />
                  <Text style={s.tipTxt}>Good lighting</Text>
                </View>
                <View style={s.tipRow}>
                  <Ionicons name="checkmark" size={15} color={C.textSub} />
                  <Text style={s.tipTxt}>All corners visible</Text>
                </View>
                <View style={s.tipRow}>
                  <Ionicons name="checkmark" size={15} color={C.textSub} />
                  <Text style={s.tipTxt}>No blur or glare</Text>
                </View>
              </View>

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnNavy} 
                onPress={handleContinueFromStep4}
                activeOpacity={0.85}
              >
                <Text style={s.btnNavyTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 5 OF 7: TAKE A SELFIE */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(5, () => setCurrentStep(4))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Take a Selfie</Text>
              <Text style={s.pageSubheading}>
                Take a clear selfie to confirm it's you. Make sure your face is well lit.
              </Text>

              {/* Premium Selfie Viewfinder */}
              <View style={s.selfieViewfinderBox}>
                {selfieUri ? (
                  <Image source={{ uri: selfieUri }} style={s.selfieCapturedImg} resizeMode="cover" />
                ) : (
                  <View style={s.selfiePlaceholderArea}>
                    {/* Oval face guide */}
                    <View style={s.selfieFaceOval}>
                      <Ionicons name="person-outline" size={80} color="rgba(255,255,255,0.25)" />
                    </View>
                    <Text style={s.selfiePlaceholderTxt}>Position your face inside the oval</Text>
                    <Text style={s.selfiePlaceholderSub}>Ensure good lighting · Look straight ahead</Text>
                  </View>
                )}

                {/* Corner brackets overlay */}
                <View style={s.viewfinderBracketsFrame} pointerEvents="none">
                  <View style={[s.bracketCorner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
                  <View style={[s.bracketCorner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
                  <View style={[s.bracketCorner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
                  <View style={[s.bracketCorner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
                </View>

                {/* Shutter Controls */}
                <View style={s.viewfinderControlsRow}>
                  <View style={{ width: 44 }} />
                  <TouchableOpacity
                    style={s.shutterBtnOuter}
                    onPress={() => handleTakePhoto('selfie')}
                    activeOpacity={0.85}
                  >
                    <View style={s.shutterBtnInner} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.cameraToggleBtn}
                    onPress={() => handlePickFromGallery('selfie')}
                  >
                    <Ionicons name="images-outline" size={20} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Selfie tips */}
              {!selfieUri && (
                <View style={[s.tipsContainer, { marginTop: 12 }]}>
                  {[
                    { icon: 'sunny-outline',       tip: 'Good even lighting, avoid backlighting' },
                    { icon: 'glasses-outline',     tip: 'Remove glasses or face mask' },
                    { icon: 'eye-outline',          tip: 'Look directly at the camera' },
                  ].map((t, i) => (
                    <View key={i} style={[s.tipRow, i > 0 && { marginTop: 6 }]}>
                      <Ionicons name={t.icon as any} size={14} color={C.gold} />
                      <Text style={s.tipTxt}>{t.tip}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selfieUri && (
                <TouchableOpacity
                  style={[s.btnOutlined, { marginTop: 12 }]}
                  onPress={() => handleTakePhoto('selfie')}
                >
                  <Ionicons name="camera-reverse-outline" size={18} color={C.navy} />
                  <Text style={s.btnOutlinedTxt}>Retake Selfie</Text>
                </TouchableOpacity>
              )}

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnNavy} 
                onPress={handleContinueFromStep5}
                activeOpacity={0.85}
              >
                <Text style={s.btnNavyTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 6 OF 7: RESIDENTIAL ADDRESS */}
        {/* ======================================================== */}
        {currentStep === 6 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(6, () => setCurrentStep(5))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Residential Address</Text>
              <Text style={s.pageSubheading}>
                Provide your current residential address.
              </Text>

              {/* State Dropdown */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>State</Text>
                <TouchableOpacity 
                  style={s.textInputWrapper} 
                  onPress={() => setShowStateDropdown(!showStateDropdown)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-outline" size={18} color={C.textSub} style={{ marginRight: 10 }} />
                  <Text style={s.textInputField}>{state || 'Select State'}</Text>
                  <Ionicons name={showStateDropdown ? "chevron-up" : "chevron-down"} size={18} color={C.textSub} />
                </TouchableOpacity>

                {showStateDropdown && (
                  <View style={s.dropdownCard}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {STATE_LIST.map((st) => (
                        <TouchableOpacity 
                          key={st} 
                          style={s.dropdownItem} 
                          onPress={() => {
                            setState(st);
                            setLga(NIGERIA_STATES[st]?.[0] || '');
                            setShowStateDropdown(false);
                          }}
                        >
                          <Text style={[s.dropdownItemTxt, state === st && { color: C.navy, fontWeight: '800' }]}>{st}</Text>
                          {state === st && <Ionicons name="checkmark" size={16} color={C.navy} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* LGA Dropdown */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>LGA</Text>
                <TouchableOpacity 
                  style={s.textInputWrapper} 
                  onPress={() => setShowLgaDropdown(!showLgaDropdown)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-outline" size={18} color={C.textSub} style={{ marginRight: 10 }} />
                  <Text style={s.textInputField}>{lga || 'Select LGA'}</Text>
                  <Ionicons name={showLgaDropdown ? "chevron-up" : "chevron-down"} size={18} color={C.textSub} />
                </TouchableOpacity>

                {showLgaDropdown && (
                  <View style={s.dropdownCard}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {(state && NIGERIA_STATES[state] ? NIGERIA_STATES[state] : []).map((l: string) => (
                        <TouchableOpacity 
                          key={l} 
                          style={s.dropdownItem} 
                          onPress={() => {
                            setLga(l);
                            setShowLgaDropdown(false);
                          }}
                        >
                          <Text style={[s.dropdownItemTxt, lga === l && { color: C.navy, fontWeight: '800' }]}>{l}</Text>
                          {lga === l && <Ionicons name="checkmark" size={16} color={C.navy} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Address Input */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Address</Text>
                <View style={s.textInputWrapper}>
                  <Ionicons name="home-outline" size={18} color={C.textSub} style={{ marginRight: 10 }} />
                  <TextInput
                    style={s.textInputField}
                    placeholder="No. 12, Main Road, Gashua"
                    placeholderTextColor={C.textMuted}
                    value={addressInput}
                    onChangeText={setAddressInput}
                  />
                </View>
              </View>

              {/* Switch Toggle */}
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Use this address for all services</Text>
                <Switch
                  value={useAddressForAll}
                  onValueChange={setUseAddressForAll}
                  trackColor={{ false: C.border, true: C.gold }}
                  thumbColor={C.white}
                />
              </View>

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnNavy} 
                onPress={handleContinueFromStep6}
                activeOpacity={0.85}
              >
                <Text style={s.btnNavyTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* STEP 7 OF 7: REVIEW YOUR INFORMATION */}
        {/* ======================================================== */}
        {currentStep === 7 && (
          <View style={s.screenWrapper}>
            {render7StepHeader(7, () => setCurrentStep(6))}

            <ScrollView contentContainerStyle={s.stepBodyContent} showsVerticalScrollIndicator={false}>
              <Text style={s.pageHeading}>Review Your Information</Text>
              <Text style={s.pageSubheading}>
                Please confirm your details before submitting for verification.
              </Text>

              {/* Review Card */}
              <View style={s.reviewCard}>
                {/* Full Name */}
                <View style={s.reviewRow}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="person" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>Full Name</Text>
                    <Text style={s.reviewValue}>
                      {userProfile?.full_name || 'Customer'}
                    </Text>
                  </View>
                </View>

                {/* Date of Birth */}
                <View style={s.reviewRow}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="calendar" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>Date of Birth</Text>
                    <Text style={s.reviewValue}>{`${dobDay} ${dobMonth} ${dobYear}`}</Text>
                  </View>
                </View>

                {/* NIN */}
                <View style={s.reviewRow}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="card" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>NIN</Text>
                    <Text style={s.reviewValue}>{ninInput}</Text>
                  </View>
                </View>

                {/* BVN */}
                <View style={s.reviewRow}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="business" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>BVN</Text>
                    <Text style={s.reviewValue}>{bvnInput}</Text>
                  </View>
                </View>

                {/* ID Document (with thumbnail) */}
                <View style={s.reviewRow}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="images" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>ID Document</Text>
                    <Text style={s.reviewValue}>NIN Card (Uploaded)</Text>
                  </View>
                  {docImageUri && (
                    <Image
                      source={{ uri: docImageUri }}
                      style={s.reviewDocThumbnail}
                      resizeMode="cover"
                    />
                  )}
                </View>

                {/* Selfie thumbnail */}
                {selfieUri && (
                <View style={s.reviewRow}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="camera" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>Selfie Photo</Text>
                    <Text style={s.reviewValue}>Captured ✓</Text>
                  </View>
                  <Image
                    source={{ uri: selfieUri }}
                    style={[s.reviewDocThumbnail, { width: 40, height: 48, borderRadius: 8 }]}
                    resizeMode="cover"
                  />
                </View>
                )}

                {/* Residential Address */}
                <View style={[s.reviewRow, { borderBottomWidth: 0 }]}>
                  <View style={s.reviewIconCol}>
                    <Ionicons name="home" size={16} color={C.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.reviewLabel}>Residential Address</Text>
                    <Text style={s.reviewValue}>
                      {`${addressInput}, ${lga} LGA, ${state} State`}
                    </Text>
                  </View>
                </View>
              </View>

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnGold} 
                onPress={handleFinalSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <>
                    <Text style={s.btnGoldTxt}>Submit for Verification</Text>
                    <Ionicons name="arrow-forward" size={18} color={C.white} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* POST-SUBMIT: VERIFICATION IN PROGRESS */}
        {/* ======================================================== */}
        {currentStep === 'in_progress' && (
          <View style={s.screenWrapper}>
            <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
              
              {/* Shield with Magnifying Glass / Radiant Checkmark */}
              <View style={s.progressShieldGraphicOuter}>
                <View style={s.progressShieldSunburstRing} />
                <View style={s.progressShieldInner}>
                  <Ionicons name="shield" size={48} color={C.navy} />
                  <View style={s.progressShieldCheckOverlay}>
                    <Ionicons name="checkmark" size={20} color={C.gold} />
                  </View>
                </View>
              </View>

              <Text style={s.progressTitle}>Verification in Progress</Text>
              <Text style={s.progressSubtitle}>
                We are securely verifying your information with the official databases. This usually takes 1–5 minutes.
              </Text>

              {/* Progress Milestones Checklist */}
              <View style={s.milestoneCard}>
                <View style={s.milestoneRow}>
                  <Ionicons name="checkmark-circle" size={22} color={C.green} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={s.milestoneName}>NIN Verification</Text>
                    <Text style={[s.milestoneStatus, { color: C.green }]}>Completed</Text>
                  </View>
                </View>

                <View style={s.milestoneDivider} />

                <View style={s.milestoneRow}>
                  <Ionicons name="checkmark-circle" size={22} color={C.amber} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={s.milestoneName}>BVN Verification</Text>
                    <Text style={[s.milestoneStatus, { color: C.amber }]}>In Progress</Text>
                  </View>
                </View>

                <View style={s.milestoneDivider} />

                <View style={s.milestoneRow}>
                  <Ionicons name="ellipse" size={18} color={C.borderDark} style={{ marginLeft: 2 }} />
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={s.milestoneName}>ID Document Check</Text>
                    <Text style={s.milestoneStatus}>Pending</Text>
                  </View>
                </View>

                <View style={s.milestoneDivider} />

                <View style={s.milestoneRow}>
                  <Ionicons name="ellipse" size={18} color={C.borderDark} style={{ marginLeft: 2 }} />
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={s.milestoneName}>Selfie Matching</Text>
                    <Text style={s.milestoneStatus}>Pending</Text>
                  </View>
                </View>

                <View style={s.milestoneDivider} />

                <View style={s.milestoneRow}>
                  <Ionicons name="ellipse" size={18} color={C.borderDark} style={{ marginLeft: 2 }} />
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={s.milestoneName}>Address Verification</Text>
                    <Text style={s.milestoneStatus}>Pending</Text>
                  </View>
                </View>
              </View>

              {/* Lock Security Notice */}
              <View style={s.noticeBannerPill}>
                <Ionicons name="lock-closed" size={14} color={C.navy} />
                <Text style={s.noticeBannerTxt}>You will be notified once verification is complete.</Text>
              </View>

            </View>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnNavy} 
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={s.btnNavyTxt}>Return to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* POST-SUBMIT: KYC VERIFIED! */}
        {/* ======================================================== */}
        {currentStep === 'verified' && (
          <View style={s.screenWrapper}>
            <ScrollView contentContainerStyle={s.verifiedContent} showsVerticalScrollIndicator={false}>
              
              {/* Celebratory Green Check */}
              <View style={s.verifiedCheckOuter}>
                <View style={s.verifiedCheckCircle}>
                  <Ionicons name="checkmark" size={48} color={C.white} />
                </View>
              </View>

              <Text style={s.verifiedHeading}>KYC Verified!</Text>
              <Text style={s.verifiedSubheading}>
                Your identity has been successfully verified. You can now enjoy all features on ABU MAFHAL SUB.
              </Text>

              {/* Unlocked Benefits */}
              <View style={s.benefitsCard}>
                <View style={s.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={C.green} />
                  <Text style={s.benefitTxt}>Higher Transaction Limits</Text>
                </View>
                <View style={s.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={C.green} />
                  <Text style={s.benefitTxt}>Access to All Services</Text>
                </View>
                <View style={s.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={C.green} />
                  <Text style={s.benefitTxt}>More Secure Account</Text>
                </View>
                <View style={s.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={C.green} />
                  <Text style={s.benefitTxt}>Faster Transactions</Text>
                </View>
              </View>

              {/* Verified Badge Summary */}
              {userProfile?.nin && (
                <View style={s.verifiedIdBadgeCard}>
                  <View style={s.verifiedIdBadgeRow}>
                    <Text style={s.verifiedIdLabel}>Verified NIN</Text>
                    <Text style={s.verifiedIdValue}>
                      {userProfile.nin.substring(0, 4)} **** {userProfile.nin.substring(8)}
                    </Text>
                  </View>
                  {userProfile?.bvn && (
                    <View style={[s.verifiedIdBadgeRow, { marginTop: 6 }]}>
                      <Text style={s.verifiedIdLabel}>Verified BVN</Text>
                      <Text style={s.verifiedIdValue}>
                        {userProfile.bvn.substring(0, 4)} **** {userProfile.bvn.substring(8)}
                      </Text>
                    </View>
                  )}
                  <View style={[s.verifiedIdBadgeRow, { marginTop: 6 }]}>
                    <Text style={s.verifiedIdLabel}>KYC Status</Text>
                    <Text style={[s.verifiedIdValue, { color: C.green, fontWeight: '800' }]}>
                      Tier {userProfile.kyc_tier || 2} (Full Access)
                    </Text>
                  </View>
                </View>
              )}

            </ScrollView>

            <View style={s.fixedBottomBar}>
              <TouchableOpacity 
                style={s.btnGold} 
                onPress={() => router.replace('/(app)/dashboard')}
                activeOpacity={0.85}
              >
                <Text style={s.btnGoldTxt}>Continue to Dashboard</Text>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* DATE OF BIRTH PICKER MODAL */}
        {/* ======================================================== */}
        <Modal visible={showDobModal} transparent animationType="fade" onRequestClose={() => setShowDobModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Select Date of Birth</Text>
                <TouchableOpacity onPress={() => setShowDobModal(false)}>
                  <Ionicons name="close-circle" size={22} color={C.textSub} />
                </TouchableOpacity>
              </View>

              <View style={s.dateWheelRow}>
                {/* Day */}
                <View style={s.dateWheelCol}>
                  <Text style={s.dateWheelColTitle}>DAY</Text>
                  <ScrollView style={{ height: 160 }} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                      <TouchableOpacity 
                        key={d} 
                        style={[s.dateWheelItem, dobDay === d && s.dateWheelItemActive]}
                        onPress={() => setDobDay(d)}
                      >
                        <Text style={[s.dateWheelTxt, dobDay === d && s.dateWheelTxtActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Month */}
                <View style={[s.dateWheelCol, { flex: 1.3 }]}>
                  <Text style={s.dateWheelColTitle}>MONTH</Text>
                  <ScrollView style={{ height: 160 }} showsVerticalScrollIndicator={false}>
                    {MONTHS.map((m) => (
                      <TouchableOpacity 
                        key={m} 
                        style={[s.dateWheelItem, dobMonth === m && s.dateWheelItemActive]}
                        onPress={() => setDobMonth(m)}
                      >
                        <Text style={[s.dateWheelTxt, dobMonth === m && s.dateWheelTxtActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Year */}
                <View style={s.dateWheelCol}>
                  <Text style={s.dateWheelColTitle}>YEAR</Text>
                  <ScrollView style={{ height: 160 }} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 65 }, (_, i) => String(2008 - i)).map((y) => (
                      <TouchableOpacity 
                        key={y} 
                        style={[s.dateWheelItem, dobYear === y && s.dateWheelItemActive]}
                        onPress={() => setDobYear(y)}
                      >
                        <Text style={[s.dateWheelTxt, dobYear === y && s.dateWheelTxtActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <TouchableOpacity 
                style={s.btnGold} 
                onPress={() => setShowDobModal(false)}
              >
                <Text style={s.btnGoldTxt}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.white,
  },
  screenWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Intro Screen
  introTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  skipBtnTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: C.navy,
  },
  introContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 24,
  },
  // Intro hero panel
  introHeroPanel: {
    width: '100%',
    height: 160,
    borderRadius: 20,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  introShieldGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(217,148,20,0.12)',
  },
  introShieldOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(217,148,20,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(217,148,20,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introShieldInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(217,148,20,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  introBrandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  introBrandTxt: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  introHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: C.navy,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  introSubheading: {
    fontSize: 12.5,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 22,
  },
  // Roadmap list
  introRoadmap: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 0,
  },
  introRoadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
    position: 'relative',
  },
  introRoadmapNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introRoadmapNumTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: C.white,
  },
  introRoadmapLine: {
    position: 'absolute',
    left: 10,
    top: 30,
    width: 2,
    height: 10,
    backgroundColor: C.gold,
    opacity: 0.4,
  },
  introRoadmapIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introRoadmapLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: C.navy,
  },
  introRoadmapSub: {
    fontSize: 10.5,
    color: C.textSub,
    marginTop: 1,
  },
  featureCardList: { width: '100%', gap: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  featureIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTextBox: { marginLeft: 14, flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: C.navy },
  featureDesc: { fontSize: 12, color: C.textSub, marginTop: 2 },
  introBottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  footnoteTxt: {
    fontSize: 11.5,
    color: C.textSub,
  },

  // 7-Step Progress Header
  stepHeaderContainer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: C.white,
  },
  stepHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: C.navy,
    letterSpacing: 0.2,
  },
  stepHeaderSubtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: C.textSub,
    marginTop: 1,
  },
  stepBadge: {
    backgroundColor: C.goldLight,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: C.goldDark,
  },
  progressBarTrack: {
    flexDirection: 'row',
    gap: 5,
    height: 7,
    width: '100%',
    alignItems: 'center',
  },
  progressSegment: {
    flex: 1,
    height: 7,
    borderRadius: 4,
  },
  progressSegmentActive: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  progressSegmentDone: {
    backgroundColor: C.navy,
  },
  progressSegmentInactive: {
    backgroundColor: '#E2E8F0',
    height: 5,
  },

  // Common Step Body
  stepBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  pageHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: C.navy,
    marginBottom: 6,
  },
  pageSubheading: {
    fontSize: 12.5,
    color: C.textSub,
    lineHeight: 18,
    marginBottom: 16,
  },
  fixedBottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },

  // Step 1: Consent & Privacy Graphic
  consentGraphicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    height: 120,
  },
  consentDocSheet: {
    width: 90,
    height: 110,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  docSheetLineLong: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  docSheetLineMid: {
    width: '60%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  docSheetLineShort: {
    width: '40%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  docPadlockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentShieldBadge: {
    position: 'absolute',
    right: 90,
    top: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.white,
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  consentBodyText: {
    fontSize: 12.5,
    color: C.textSub,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.borderDark,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxSquareActive: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  consentCheckLabel: {
    fontSize: 12,
    color: C.navy,
    lineHeight: 17,
  },
  privacyLinkTxt: {
    color: C.navy,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  readPolicyBtnTxt: {
    fontSize: 11.5,
    color: '#2563EB',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Form Fields (Step 2, 3, 6)
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.navy,
    marginBottom: 6,
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: C.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: '#FCFDFD',
  },
  textInputField: {
    flex: 1,
    fontSize: 13.5,
    color: C.navy,
    fontWeight: '500',
  },
  infoNoticeBox: {
    flexDirection: 'row',
    backgroundColor: C.blueInfo,
    borderWidth: 1,
    borderColor: C.blueBorder,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    gap: 8,
    alignItems: 'center',
  },
  infoNoticeTxt: {
    flex: 1,
    fontSize: 11.5,
    color: C.navy,
    lineHeight: 16,
  },

  // Step 4: ID Card Graphic
  idCardGraphicContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  sampleCardContainer: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sampleCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sampleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.navy,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
  },
  sampleBadgeTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: C.gold,
    letterSpacing: 0.5,
  },
  sampleAcceptedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  sampleAcceptedTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    color: C.green,
  },
  sampleCardImageHolder: {
    width: '100%',
    height: 195,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#F3C366',
    backgroundColor: '#0D1B3E',
  },
  sampleCardImg: {
    width: '100%',
    height: '100%',
  },
  sampleWatermarkChip: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(13, 27, 62, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(217, 148, 20, 0.4)',
  },
  sampleWatermarkTxt: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  sampleCardHelperTxt: {
    fontSize: 11.5,
    color: C.textSub,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
    lineHeight: 16,
  },
  uploadedSuccessBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: C.green,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  uploadedSuccessBadgeTxt: {
    color: C.white,
    fontSize: 10.5,
    fontWeight: '800',
  },
  uploadedPreviewFrame: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: C.green,
  },
  uploadedDocImg: {
    width: '100%',
    height: '100%',
  },
  changePhotoChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: C.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  changePhotoChipTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: C.navy,
  },
  uploadButtonsGroup: {
    marginVertical: 10,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  orTxt: {
    paddingHorizontal: 12,
    fontSize: 11.5,
    color: C.textMuted,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  tipsHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.navy,
    marginBottom: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  tipTxt: {
    fontSize: 11,
    color: C.textSub,
  },

  // Step 5: Selfie
  selfieViewfinderBox: {
    width: '100%',
    height: 340,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieCapturedImg: {
    width: '100%',
    height: '100%',
  },
  selfiePlaceholderArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  selfieFaceOval: {
    width: 140,
    height: 175,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: 'rgba(217,148,20,0.7)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  selfiePlaceholderTxt: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 4,
  },
  selfiePlaceholderSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10.5,
    marginTop: 4,
  },
  viewfinderBracketsFrame: {
    position: 'absolute',
    width: 200,
    height: 250,
  },
  bracketCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: C.white,
  },
  viewfinderControlsRow: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutterBtnOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.gold,
  },
  cameraToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 6: Address
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.navy,
  },
  dropdownCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemTxt: {
    fontSize: 13,
    color: C.navy,
  },

  // Step 7: Review Your Information
  reviewCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reviewIconCol: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewLabel: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '600',
  },
  reviewValue: {
    fontSize: 13,
    color: C.navy,
    fontWeight: '700',
    marginTop: 1,
  },
  reviewDocThumbnail: {
    width: 48,
    height: 32,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Progress Screen
  progressShieldGraphicOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  progressShieldSunburstRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderColor: C.gold,
    borderStyle: 'dashed',
  },
  progressShieldInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressShieldCheckOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 14,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.navy,
    textAlign: 'center',
    marginBottom: 6,
  },
  progressSubtitle: {
    fontSize: 12.5,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  milestoneCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.navy,
  },
  milestoneStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSub,
    marginTop: 1,
  },
  milestoneDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 10,
  },
  noticeBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 20,
  },
  noticeBannerTxt: {
    fontSize: 11.5,
    color: C.textSub,
    fontWeight: '600',
  },

  // Verified Screen
  verifiedContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 24,
  },
  verifiedCheckOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifiedCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifiedHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: C.navy,
    marginBottom: 6,
  },
  verifiedSubheading: {
    fontSize: 13,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: C.navy,
  },
  verifiedIdBadgeCard: {
    width: '100%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
  },
  verifiedIdBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedIdLabel: {
    fontSize: 11.5,
    color: C.textSub,
    fontWeight: '600',
  },
  verifiedIdValue: {
    fontSize: 12.5,
    color: C.navy,
    fontWeight: '700',
  },

  // Buttons
  btnNavy: {
    backgroundColor: C.navy,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  btnNavyTxt: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  btnGold: {
    backgroundColor: C.gold,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  btnGoldTxt: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  btnOutlined: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: C.borderDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
  },
  btnOutlinedTxt: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '700',
  },

  // DOB Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,27,62,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.navy,
  },
  dateWheelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dateWheelCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
  },
  dateWheelColTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: C.textSub,
    textAlign: 'center',
    marginVertical: 4,
  },
  dateWheelItem: {
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
    marginVertical: 1,
  },
  dateWheelItemActive: {
    backgroundColor: C.navy,
  },
  dateWheelTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: C.navy,
  },
  dateWheelTxtActive: {
    color: C.white,
    fontWeight: '800',
  },
});
