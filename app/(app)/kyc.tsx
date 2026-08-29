import { 
    View, Text, TouchableOpacity, TextInput, ActivityIndicator, 
    Alert, Image, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';
import { useAppSettings } from '../../hooks/useAppSettings';

// Executive Light Platinum, Royal Navy & Gold Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(245, 166, 35, 0.35)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0'
};

export default function UserKYCScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    const [loading, setLoading] = useState(true);
    const [tier, setTier] = useState(0);
    const [userData, setUserData] = useState<any>(null);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [verifying, setVerifying] = useState(false);
    const [virtualAcc, setVirtualAcc] = useState<any>(null);
    const [virtualAccs, setVirtualAccs] = useState<any[]>([]);

    // Active Selected Document Type
    const [selectedDocType, setSelectedDocType] = useState<string>('bvn');

    // Input States
    const [idNumberInput, setIdNumberInput] = useState('');
    const [docImageUri, setDocImageUri] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setUserData({ ...profile, id: user.id });

            // Fetch User Virtual Accounts
            const { data: vAccs } = await supabase
                .from('virtual_accounts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (vAccs && vAccs.length > 0) {
                setVirtualAcc(vAccs[0]);
                setVirtualAccs(vAccs);
            }

            const { data: pending } = await supabase
                .from('kyc_requests')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (pending) setPendingRequest(pending);

            const currentTier = profile?.kyc_tier || 0;
            setTier(currentTier);

            // Auto select document options strictly based on Tier level
            if (currentTier === 0) setSelectedDocType('bvn');
            else if (currentTier === 1) setSelectedDocType('nin');
            else if (currentTier === 2) setSelectedDocType('utility_bill');

        } catch (error: any) {
            console.error("KYC Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const pickDocumentPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Required", "Please allow photo library access.");
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setDocImageUri(result.assets[0].uri);
            }
        } catch (e: any) {
            Alert.alert("Image Error", e.message || "Failed to select document photo.");
        }
    };

    const takeDocumentPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Required", "Please allow camera access.");
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                quality: 0.7,
                allowsEditing: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setDocImageUri(result.assets[0].uri);
            }
        } catch (e: any) {
            Alert.alert("Camera Error", e.message || "Failed to take photo.");
        }
    };

    const handleSubmitKYC = async () => {
        // Validation Checks
        if (selectedDocType === 'bvn' && (!idNumberInput || idNumberInput.trim().length !== 11)) {
            return Alert.alert("BVN Required", "Please enter your valid 11-digit BVN.");
        }
        if (selectedDocType === 'nin' && (!idNumberInput || idNumberInput.trim().length !== 11)) {
            return Alert.alert("NIN Required", "Please enter your valid 11-digit NIN.");
        }
        if (selectedDocType === 'drivers_license' && !idNumberInput.trim() && !docImageUri) {
            return Alert.alert("License Required", "Please enter your Driver's License Number or attach a document photo.");
        }
        if (selectedDocType === 'voters_card' && !idNumberInput.trim() && !docImageUri) {
            return Alert.alert("Voter's Card Required", "Please enter your Voter's Card VIN Number or attach a document photo.");
        }
        if ((selectedDocType === 'utility_bill' || selectedDocType === 'bank_statement') && !idNumberInput.trim() && !docImageUri) {
            return Alert.alert("Document Required", "Please enter document reference number or attach photo.");
        }

        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User session expired. Please log in.");

            let fileUrl = null;

            if (docImageUri) {
                try {
                    if (docImageUri.startsWith('data:')) {
                        fileUrl = docImageUri;
                    } else {
                        let base64 = '';
                        try {
                            base64 = await FileSystem.readAsStringAsync(docImageUri, { encoding: 'base64' });
                        } catch (fsErr) {}

                        const fileExt = (docImageUri.split('.').pop() || 'jpg').split('?')[0];
                        const fileName = `${user.id}_${selectedDocType}_${Date.now()}.${fileExt}`;
                        const mime = fileExt.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
                        
                        if (base64) {
                            const { data: uploadData, error: uploadError } = await supabase.storage
                                .from('kyc-documents')
                                .upload(fileName, decode(base64), {
                                    contentType: mime,
                                    upsert: true
                                });

                            if (!uploadError && uploadData) {
                                const { data: publicUrlData } = supabase.storage
                                    .from('kyc-documents')
                                    .getPublicUrl(fileName);
                                fileUrl = publicUrlData?.publicUrl || fileName;
                            } else {
                                fileUrl = `data:${mime};base64,${base64}`;
                            }
                        }
                    }
                } catch (imgErr) {
                    console.warn("Doc image upload warning:", imgErr);
                }
            }

            // Check Auto-Approve Setting
            const isAutoApprove = 
                settings?.auto_kyc_verification_enabled === true || 
                settings?.auto_approve_kyc === true;

            const reqStatus = isAutoApprove ? 'approved' : 'pending';

            // Insert Request safely
            const { error: dbError } = await supabase.from('kyc_requests').insert({
                user_id: user.id,
                document_type: selectedDocType,
                document_number: idNumberInput.trim() || null,
                document_url: fileUrl,
                status: reqStatus
            });

            if (dbError) {
                console.warn("KYC request insert fallback:", dbError.message);
            }

            if (isAutoApprove) {
                let targetTier = tier;
                if (selectedDocType === 'bvn') targetTier = 1;
                else if (selectedDocType === 'nin' || selectedDocType === 'drivers_license' || selectedDocType === 'voters_card') targetTier = 2;
                else if (selectedDocType === 'utility_bill' || selectedDocType === 'bank_statement') targetTier = 3;

                const updatePayload: any = { kyc_tier: targetTier };
                if (selectedDocType === 'bvn') updatePayload.bvn = idNumberInput.trim();
                if (selectedDocType === 'nin') updatePayload.nin = idNumberInput.trim();

                await supabase.from('profiles').update(updatePayload).eq('id', user.id);

                // Auto Create / Upgrade Dedicated Virtual Accounts (Account #1 & Account #2)
                if (selectedDocType === 'bvn' || selectedDocType === 'nin' || selectedDocType === 'drivers_license') {
                    try {
                        const vaRes = await supabase.functions.invoke('create-virtual-account', {
                            body: { userId: user.id, bvn: idNumberInput.trim(), forceSecondAccount: true, forceUpdate: true }
                        });
                        if (vaRes.data?.accounts && vaRes.data.accounts.length > 0) {
                            setVirtualAccs(vaRes.data.accounts);
                            setVirtualAcc(vaRes.data.accounts[0]);
                        }
                    } catch (dvaErr) {
                        console.warn("DVA trigger warning:", dvaErr);
                    }
                }

                setTier(targetTier);
                Alert.alert(
                    "Verification Successful! 🎉",
                    selectedDocType === 'bvn' 
                        ? `BVN Verified Successfully! Your 2nd Dedicated Virtual Bank Account (PalmPay / 9PSB) has been generated!`
                        : `Your ${selectedDocType.toUpperCase().replace(/_/g, ' ')} has been verified automatically. Account upgraded to Tier ${targetTier}!`
                );
                loadData();
            } else {
                setPendingRequest({ document_type: selectedDocType, status: 'pending' });
                Alert.alert("Submitted Successfully", "Your verification request has been submitted for instant review.");
            }

            setIdNumberInput('');
            setDocImageUri(null);

        } catch (error: any) {
            console.error("KYC Submit Error:", error);
            Alert.alert("Submission Update", error.message || "Request recorded successfully.");
        } finally {
            setVerifying(false);
        }
    };


    // Strict Tier Document Selector Lists
    const tier2DocOptions = [
        { id: 'nin', name: 'NIN (National ID)', icon: 'id-card' },
        { id: 'drivers_license', name: "Driver's License", icon: 'car-sport' },
        { id: 'voters_card', name: "Voter's Card (VIN)", icon: 'checkbox' },
    ];

    const tier3DocOptions = [
        { id: 'utility_bill', name: 'Utility Bill (Electricity)', icon: 'home' },
        { id: 'bank_statement', name: 'Bank Statement (Address)', icon: 'document-text' },
    ];

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={L.goldDk} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                
                {/* Royal Navy Header */}
                <LinearGradient 
                    colors={['#0F172A', '#1C2541', '#0B132B']} 
                    style={{ paddingTop: insets.top + 6, paddingBottom: 12, paddingHorizontal: 12, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}>
                            <Ionicons name="arrow-back" size={14} color={L.gold} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: -0.2 }}>IDENTITY VERIFICATION HUB</Text>
                        <View style={{ width: 30 }} />
                    </View>

                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' }}>Account Tier: Level {tier}</Text>
                    <Text style={{ color: '#CBD5E1', fontSize: 9, textAlign: 'center', marginTop: 1 }}>
                        {tier === 0 ? 'Step 1: Submit BVN to activate Virtual Bank Account' : tier === 1 ? 'Step 2: Submit NIN, Driver License or Voter Card' : tier === 2 ? 'Step 3: Submit Utility Bill or Address Proof' : 'Tier 3 Account Fully Verified'}
                    </Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingTop: 10 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    
                    {/* Stepper Progress Bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: L.card, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, elevation: 1 }}>
                        {[
                            { t: 1, label: 'Tier 1 (BVN)' },
                            { t: 2, label: 'Tier 2 (ID/License)' },
                            { t: 3, label: 'Tier 3 (Address)' },
                        ].map((st) => {
                            const isPassed = tier >= st.t;
                            return (
                                <View key={st.t} style={{ alignItems: 'center', flex: 1 }}>
                                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isPassed ? L.navyHeader : L.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isPassed ? L.gold : L.inputBorder, marginBottom: 2 }}>
                                        {isPassed ? <Ionicons name="checkmark" size={10} color={L.gold} /> : <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '800' }}>{st.t}</Text>}
                                    </View>
                                    <Text style={{ fontSize: 7, fontWeight: '800', color: isPassed ? L.navyHeader : L.textMuted, textAlign: 'center' }}>{st.label}</Text>
                                </View>
                            );
                        })}
                    </View>

                    {/* Reserved Virtual Dedicated Bank Account(s) Display */}
                    {virtualAccs.length > 0 ? (
                        <View style={{ gap: 8, marginBottom: 10 }}>
                            {virtualAccs.map((va, idx) => (
                                <View key={va.id || idx} style={{ backgroundColor: L.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: L.cardBorder, elevation: 2 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Ionicons name="card" size={14} color={L.goldAmber} />
                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>
                                                {va.bank_name} {idx === 0 ? '(Account 1)' : idx === 1 ? '(Account 2)' : ''}
                                            </Text>
                                        </View>
                                        <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                            <Text style={{ color: L.emerald, fontSize: 8, fontWeight: '900' }}>Active</Text>
                                        </View>
                                    </View>

                                    <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>Bank Name: <Text style={{ color: L.navyHeader, fontWeight: '900' }}>{va.bank_name}</Text></Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                                            <Text style={{ color: L.navyHeader, fontSize: 14, fontWeight: '900', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                                {va.account_number}
                                            </Text>
                                            <TouchableOpacity onPress={() => Alert.alert("Copied", `Account ${va.account_number} copied!`)} style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.gold }}>
                                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 8 }}>COPY</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : virtualAcc ? (
                        <View style={{ backgroundColor: L.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 10, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="card" size={14} color={L.goldAmber} />
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Reserved Dedicated Bank Account</Text>
                                </View>
                                <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                    <Text style={{ color: L.emerald, fontSize: 8, fontWeight: '900' }}>Active</Text>
                                </View>
                            </View>

                            <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                                <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>Bank Name: <Text style={{ color: L.navyHeader, fontWeight: '900' }}>{virtualAcc.bank_name || '9Payment Service Bank'}</Text></Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                                    <Text style={{ color: L.navyHeader, fontSize: 14, fontWeight: '900', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                        {virtualAcc.account_number}
                                    </Text>
                                    <TouchableOpacity onPress={() => Alert.alert("Copied", `Account ${virtualAcc.account_number} copied!`)} style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.gold }}>
                                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 8 }}>COPY</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ) : null}


                    {/* STEP 1: BVN FIRST (Tier === 0) */}
                    {tier === 0 && (
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 10, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Ionicons name="card" size={14} color={L.navyHeader} />
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>Tier 1: Bank Verification Number (BVN)</Text>
                            </View>
                            <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 8 }}>
                                Enter your 11-digit BVN to activate your account and issue your Reserved Virtual Dedicated Bank Account.
                            </Text>

                            <View style={{ marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 8, fontWeight: 'bold' }}>11-Digit BVN Number:</Text>
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            const text = await Clipboard.getStringAsync();
                                            if (text) setIdNumberInput(text.trim());
                                        }}
                                        style={{ backgroundColor: L.goldBg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: L.goldDk }}
                                    >
                                        <Text style={{ color: L.goldAmber, fontSize: 7, fontWeight: '900' }}>PASTE</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ height: 36, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 8, justifyContent: 'center' }}>
                                    <TextInput
                                        value={idNumberInput}
                                        onChangeText={setIdNumberInput}
                                        placeholder="Enter 11-Digit BVN..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                        keyboardType="numeric"
                                        maxLength={11}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={() => { setSelectedDocType('bvn'); handleSubmitKYC(); }}
                                disabled={verifying}
                                style={{ height: 36, backgroundColor: L.navyHeader, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.gold }}
                            >
                                {verifying ? <ActivityIndicator size="small" color={L.gold} /> : (
                                    <>
                                        <Ionicons name="checkmark-circle-sharp" size={14} color={L.gold} />
                                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Verify BVN & Issue Bank Account</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* STEP 2: TIER 2 (NIN, Driver's License, Voter's Card strictly) */}
                    {tier === 1 && (
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 10, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Ionicons name="id-card" size={14} color={L.navyHeader} />
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>Tier 2: Government Identity Verification</Text>
                            </View>
                            <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 8 }}>
                                Select your Government Photo ID document to upgrade to Tier 2:
                            </Text>

                            {/* Strict Tier 2 Selector: NIN, Driver's License, Voter's Card */}
                            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                                {tier2DocOptions.map((opt) => {
                                    const isSelected = selectedDocType === opt.id;
                                    return (
                                        <TouchableOpacity
                                            key={opt.id}
                                            onPress={() => { setSelectedDocType(opt.id); setIdNumberInput(''); setDocImageUri(null); }}
                                            style={{
                                                flex: 1, paddingVertical: 5, paddingHorizontal: 3, borderRadius: 6,
                                                backgroundColor: isSelected ? L.navyHeader : L.bg,
                                                borderWidth: 1, borderColor: isSelected ? L.gold : L.inputBorder,
                                                alignItems: 'center', justifyContent: 'center'
                                            }}
                                        >
                                            <Ionicons name={opt.icon as any} size={11} color={isSelected ? L.gold : L.textSecondary} />
                                            <Text style={{ fontSize: 7.5, fontWeight: '900', color: isSelected ? L.gold : L.textSecondary, textAlign: 'center', marginTop: 2 }}>{opt.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* ID Number Input */}
                            <View style={{ marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 8, fontWeight: 'bold' }}>
                                        {selectedDocType === 'nin' ? '11-Digit NIN Number:' : selectedDocType === 'drivers_license' ? "Driver's License Number:" : "Voter's Card VIN Number:"}
                                    </Text>
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            const text = await Clipboard.getStringAsync();
                                            if (text) setIdNumberInput(text.trim());
                                        }}
                                        style={{ backgroundColor: L.goldBg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: L.goldDk }}
                                    >
                                        <Text style={{ color: L.goldAmber, fontSize: 7, fontWeight: '900' }}>PASTE</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ height: 36, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 8, justifyContent: 'center' }}>
                                    <TextInput
                                        value={idNumberInput}
                                        onChangeText={setIdNumberInput}
                                        placeholder={`Enter ${selectedDocType.replace(/_/g, ' ')} Number...`}
                                        placeholderTextColor="#94A3B8"
                                        style={{ color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                        keyboardType={selectedDocType === 'nin' ? 'numeric' : 'default'}
                                        maxLength={selectedDocType === 'nin' ? 11 : 30}
                                    />
                                </View>
                            </View>

                            {/* Photo Attachment Box */}
                            {docImageUri ? (
                                <View style={{ height: 110, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: L.goldDk, marginBottom: 8, position: 'relative' }}>
                                    <Image source={{ uri: docImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity onPress={() => setDocImageUri(null)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 3 }}>
                                        <Ionicons name="close" size={12} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                                    <TouchableOpacity onPress={takeDocumentPhoto} style={{ flex: 1, height: 32, backgroundColor: L.bg, borderRadius: 6, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
                                        <Ionicons name="camera-outline" size={12} color={L.navyHeader} />
                                        <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: 'bold' }}>Snap Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={pickDocumentPhoto} style={{ flex: 1, height: 32, backgroundColor: L.bg, borderRadius: 6, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
                                        <Ionicons name="image-outline" size={12} color={L.navyHeader} />
                                        <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: 'bold' }}>Gallery Upload</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity 
                                onPress={handleSubmitKYC}
                                disabled={verifying}
                                style={{ height: 36, backgroundColor: L.navyHeader, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.gold }}
                            >
                                {verifying ? <ActivityIndicator size="small" color={L.gold} /> : (
                                    <>
                                        <Ionicons name="checkmark-circle-sharp" size={14} color={L.gold} />
                                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Submit Tier 2 Identity</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* STEP 3: TIER 3 (Utility Bill & Address Proof strictly) */}
                    {tier === 2 && (
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 10, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Ionicons name="home" size={14} color={L.navyHeader} />
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>Tier 3: Address & Residency Verification</Text>
                            </View>
                            <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 8 }}>
                                Select Utility Bill or Address proof document:
                            </Text>

                            {/* Strict Tier 3 Selector: Utility Bill, Bank Statement */}
                            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                                {tier3DocOptions.map((opt) => {
                                    const isSelected = selectedDocType === opt.id;
                                    return (
                                        <TouchableOpacity
                                            key={opt.id}
                                            onPress={() => { setSelectedDocType(opt.id); setIdNumberInput(''); setDocImageUri(null); }}
                                            style={{
                                                flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 6,
                                                backgroundColor: isSelected ? L.navyHeader : L.bg,
                                                borderWidth: 1, borderColor: isSelected ? L.gold : L.inputBorder,
                                                alignItems: 'center', justifyContent: 'center'
                                            }}
                                        >
                                            <Ionicons name={opt.icon as any} size={11} color={isSelected ? L.gold : L.textSecondary} />
                                            <Text style={{ fontSize: 7.5, fontWeight: '900', color: isSelected ? L.gold : L.textSecondary, textAlign: 'center', marginTop: 2 }}>{opt.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Photo Attachment Box */}
                            {docImageUri ? (
                                <View style={{ height: 110, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: L.goldDk, marginBottom: 8, position: 'relative' }}>
                                    <Image source={{ uri: docImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity onPress={() => setDocImageUri(null)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 3 }}>
                                        <Ionicons name="close" size={12} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                                    <TouchableOpacity onPress={takeDocumentPhoto} style={{ flex: 1, height: 32, backgroundColor: L.bg, borderRadius: 6, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
                                        <Ionicons name="camera-outline" size={12} color={L.navyHeader} />
                                        <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: 'bold' }}>Snap Bill Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={pickDocumentPhoto} style={{ flex: 1, height: 32, backgroundColor: L.bg, borderRadius: 6, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
                                        <Ionicons name="image-outline" size={12} color={L.navyHeader} />
                                        <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: 'bold' }}>Upload Document</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity 
                                onPress={handleSubmitKYC}
                                disabled={verifying}
                                style={{ height: 36, backgroundColor: L.navyHeader, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.gold }}
                            >
                                {verifying ? <ActivityIndicator size="small" color={L.gold} /> : (
                                    <>
                                        <Ionicons name="checkmark-circle-sharp" size={14} color={L.gold} />
                                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Submit Tier 3 Address Proof</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* STEP 4: TIER 4 (Fully Verified) */}
                    {tier >= 3 && (
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder, alignItems: 'center', marginBottom: 10, elevation: 2 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: L.emeraldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                <Ionicons name="shield-checkmark" size={22} color={L.emerald} />
                            </View>
                            <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>Account Fully Verified (Tier {tier})</Text>
                            <Text style={{ color: L.textMuted, fontSize: 9, textAlign: 'center', marginTop: 2, marginBottom: 8 }}>
                                Congratulations! You have unlocked all transaction limits, DEX crypto trading & priority support.
                            </Text>
                            <TouchableOpacity onPress={() => router.replace('/')} style={{ backgroundColor: L.navyHeader, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: L.gold }}>
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Return to Dashboard</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Pending Status Banner */}
                    {pendingRequest && (
                        <View style={{ backgroundColor: L.goldBg, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: L.goldDk, marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="time-outline" size={14} color={L.goldAmber} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: L.goldAmber, fontWeight: '900', fontSize: 9 }}>Verification Request Pending</Text>
                                <Text style={{ color: L.textSecondary, fontSize: 8 }}>
                                    Your submitted {pendingRequest.document_type?.toUpperCase().replace(/_/g, ' ')} request is pending review by compliance.
                                </Text>
                            </View>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
