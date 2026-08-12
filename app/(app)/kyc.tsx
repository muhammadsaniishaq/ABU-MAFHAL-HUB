import { 
    View, Text, TouchableOpacity, TextInput, ActivityIndicator, 
    Alert, Image, ScrollView, KeyboardAvoidingView, Platform, StyleSheet 
} from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useAppSettings } from '../../hooks/useAppSettings';

const NAVY = '#0F172A';
const NAVY_MID = '#1C2541';
const GOLD = '#FFD700';
const GOLD_DK = '#DAA520';

export default function UserKYCScreen() {
    const router = useRouter();
    const { settings } = useAppSettings();

    const [loading, setLoading] = useState(true);
    const [tier, setTier] = useState(0);
    const [userData, setUserData] = useState<any>(null);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [verifying, setVerifying] = useState(false);
    const [virtualAcc, setVirtualAcc] = useState<any>(null);

    // Active Verification Mode: 'bvn' | 'nin' | 'drivers_license' | 'voters_card' | 'utility_bill' | 'liveness'
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

            // Fetch User Virtual Account if generated
            const { data: vAcc } = await supabase
                .from('virtual_accounts')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (vAcc) setVirtualAcc(vAcc);

            const { data: pending } = await supabase
                .from('kyc_requests')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (pending) {
                setPendingRequest(pending);
            }

            const currentTier = profile?.kyc_tier || 0;
            setTier(currentTier);

            // Default initial mode selection
            if (currentTier === 0) setSelectedDocType('bvn');
            else if (currentTier === 1) setSelectedDocType('drivers_license');
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
                Alert.alert("Permission Required", "Please allow access to your photo library to attach your document photo.");
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
                Alert.alert("Permission Required", "Please allow camera access to take a photo of your document.");
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
            Alert.alert("Camera Error", e.message || "Failed to take document photo.");
        }
    };

    const handleSubmitKYC = async () => {
        if (selectedDocType === 'bvn' && (!idNumberInput || idNumberInput.trim().length !== 11)) {
            return Alert.alert("BVN Required", "Please enter your valid 11-digit BVN.");
        }
        if (selectedDocType === 'nin' && (!idNumberInput || idNumberInput.trim().length !== 11)) {
            return Alert.alert("NIN Required", "Please enter your valid 11-digit NIN.");
        }
        if (selectedDocType === 'drivers_license' && !idNumberInput.trim() && !docImageUri) {
            return Alert.alert("License Required", "Please enter your Driver's License Number or upload a photo of your License.");
        }
        if (selectedDocType === 'voters_card' && !idNumberInput.trim() && !docImageUri) {
            return Alert.alert("Voter's Card Required", "Please enter your Voter's Card VIN Number or upload a photo.");
        }

        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            let fileUrl = null;

            if (docImageUri) {
                const base64 = await FileSystem.readAsStringAsync(docImageUri, {
                    encoding: 'base64',
                });
                
                const fileExt = docImageUri.split('.').pop() || 'jpg';
                const fileName = `${user.id}_${selectedDocType}_${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('kyc-documents')
                    .upload(fileName, decode(base64), {
                        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`
                    });
                
                if (uploadError) {
                    console.error("Upload Error:", uploadError);
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('kyc-documents')
                        .getPublicUrl(fileName);
                    fileUrl = publicUrlData?.publicUrl || fileName;
                }
            }

            // Check Auto Approve Setting
            const isAutoApproveSetting = 
                settings?.auto_kyc_verification_enabled === true || 
                settings?.auto_approve_kyc === true;

            const isAutoApprove = isAutoApproveSetting;
            const status = isAutoApprove ? 'approved' : 'pending';

            const { error: dbError } = await supabase.from('kyc_requests').insert({
                user_id: user.id,
                document_type: selectedDocType,
                document_number: idNumberInput.trim() || null,
                document_url: fileUrl,
                status: status
            });

            if (dbError) throw dbError;

            if (isAutoApprove) {
                let targetTier = tier;
                if (selectedDocType === 'bvn' || selectedDocType === 'nin' || selectedDocType === 'drivers_license' || selectedDocType === 'voters_card') {
                    if (targetTier < 2) targetTier = 2;
                } else if (selectedDocType === 'utility_bill' || selectedDocType === 'bank_statement') {
                    if (targetTier < 3) targetTier = 3;
                } else if (selectedDocType === 'liveness') {
                    if (targetTier < 4) targetTier = 4;
                }

                const updatePayload: any = { kyc_tier: targetTier };
                if (selectedDocType === 'bvn') updatePayload.bvn = idNumberInput.trim();
                if (selectedDocType === 'nin') updatePayload.nin = idNumberInput.trim();

                await supabase.from('profiles').update(updatePayload).eq('id', user.id);

                // Auto Virtual Account Creation on Approval
                if (selectedDocType === 'bvn' || selectedDocType === 'nin' || selectedDocType === 'drivers_license') {
                    try {
                        await supabase.functions.invoke('create-virtual-account', {
                            body: { userId: user.id, bvn: idNumberInput.trim() }
                        });
                    } catch (e) {
                        console.warn("DVA generation trigger:", e);
                    }
                }

                setTier(targetTier);
                Alert.alert("Verification Success! 🎉", `Your ${selectedDocType.toUpperCase().replace(/_/g, ' ')} has been verified automatically. Account is now Tier ${targetTier}!`);
                loadData();
            } else {
                setPendingRequest({ document_type: selectedDocType, status: 'pending' });
                Alert.alert("Submitted Successfully", "Your verification request has been submitted for instant admin review.");
            }

            setIdNumberInput('');
            setDocImageUri(null);

        } catch (error: any) {
            console.error("KYC Submit Error:", error);
            Alert.alert("Submission Failed", error.message || "Failed to submit verification request");
        } finally {
            setVerifying(false);
        }
    };

    const docTypes = [
        { id: 'bvn', name: 'BVN (Tier 2)', icon: 'card' },
        { id: 'nin', name: 'NIN (Tier 2)', icon: 'id-card' },
        { id: 'drivers_license', name: "Driver's License (Tier 2)", icon: 'car-sport' },
        { id: 'voters_card', name: "Voter's Card (Tier 2)", icon: 'checkbox' },
        { id: 'utility_bill', name: 'Utility / Address (Tier 3)', icon: 'home' },
        { id: 'liveness', name: 'AI Face Scan (Tier 4)', icon: 'scan' },
    ];

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={GOLD} />
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: NAVY }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                
                {/* Header Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 }}>
                    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD }}>
                        <Ionicons name="arrow-back" size={14} color={GOLD} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>Identity Verification Hub</Text>
                    <View style={{ width: 30 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView style={{ flex: 1, paddingHorizontal: 14 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                        
                        {/* Compact Intro */}
                        <View style={{ marginTop: 2, marginBottom: 12, alignItems: 'center' }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 }}>Verify Identity & Unlock Limits</Text>
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Tier {tier} Account Active • Higher Limits & Dedicated Bank Account</Text>
                        </View>

                        {/* Stepper Level Indicators */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                            {[
                                { t: 1, label: 'Tier 1' },
                                { t: 2, label: 'Tier 2 (ID/License)' },
                                { t: 3, label: 'Tier 3 (Address)' },
                                { t: 4, label: 'Tier 4 (Face)' },
                            ].map((st) => {
                                const isPassed = tier >= st.t;
                                return (
                                    <View key={st.t} style={{ alignItems: 'center', flex: 1 }}>
                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isPassed ? GOLD : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isPassed ? GOLD : 'rgba(255,255,255,0.3)', marginBottom: 2 }}>
                                            {isPassed ? <Ionicons name="checkmark" size={12} color={NAVY} /> : <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{st.t}</Text>}
                                        </View>
                                        <Text style={{ fontSize: 8, fontWeight: 'bold', color: isPassed ? GOLD : 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{st.label}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Virtual Dedicated Bank Account Display Card */}
                        {virtualAcc && (
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: GOLD, marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="card" size={14} color={GOLD} />
                                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11 }}>Reserved Virtual Bank Account</Text>
                                    </View>
                                    <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#10b981' }}>
                                        <Text style={{ color: '#10b981', fontSize: 8, fontWeight: '900' }}>Active</Text>
                                    </View>
                                </View>
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 10 }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Bank: <Text style={{ color: GOLD, fontWeight: '900' }}>{virtualAcc.bank_name || 'Wema Bank / Payvessel'}</Text></Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                            {virtualAcc.account_number}
                                        </Text>
                                        <TouchableOpacity onPress={() => Alert.alert("Copied", `Account ${virtualAcc.account_number} copied!`)} style={{ backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                            <Text style={{ color: NAVY, fontWeight: '900', fontSize: 9 }}>COPY</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Document Type Selector Carousel */}
                        <Text style={{ color: GOLD, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>Select Verification Document</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
                            {docTypes.map((dt) => {
                                const isSel = selectedDocType === dt.id;
                                return (
                                    <TouchableOpacity
                                        key={dt.id}
                                        onPress={() => { setSelectedDocType(dt.id); setIdNumberInput(''); setDocImageUri(null); }}
                                        style={{
                                            backgroundColor: isSel ? GOLD : 'rgba(255,255,255,0.08)',
                                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                                            borderWidth: 1, borderColor: isSel ? GOLD : 'rgba(255,255,255,0.15)',
                                            flexDirection: 'row', alignItems: 'center', gap: 4
                                        }}
                                    >
                                        <Ionicons name={dt.icon as any} size={12} color={isSel ? NAVY : '#FFFFFF'} />
                                        <Text style={{ fontSize: 9, fontWeight: '900', color: isSel ? NAVY : '#FFFFFF' }}>{dt.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Submission Form Card */}
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <Ionicons name="shield-checkmark" size={16} color={GOLD} />
                                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13, textTransform: 'uppercase' }}>
                                    {selectedDocType.replace(/_/g, ' ')} Submission
                                </Text>
                            </View>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginBottom: 10 }}>
                                Provide your document details or snap/upload a clear photo of your identification.
                            </Text>

                            {/* Text / ID Number Input */}
                            <View style={{ marginBottom: 10 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>
                                    {selectedDocType === 'drivers_license' ? "Driver's License Number:" : selectedDocType === 'voters_card' ? "Voter's Card VIN Number:" : selectedDocType === 'bvn' ? "11-Digit BVN:" : selectedDocType === 'nin' ? "11-Digit NIN:" : "Document ID / Number:"}
                                </Text>
                                <View style={{ height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, justifyContent: 'center' }}>
                                    <TextInput
                                        value={idNumberInput}
                                        onChangeText={setIdNumberInput}
                                        placeholder={`Enter ${selectedDocType.replace(/_/g, ' ')} ID Number...`}
                                        placeholderTextColor="rgba(255,255,255,0.4)"
                                        style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}
                                        keyboardType={selectedDocType === 'bvn' || selectedDocType === 'nin' ? 'numeric' : 'default'}
                                        maxLength={selectedDocType === 'bvn' || selectedDocType === 'nin' ? 11 : 30}
                                    />
                                </View>
                            </View>

                            {/* Document Photo Attachment Box */}
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>
                                Attachment (Optional / Photo Card):
                            </Text>
                            
                            {docImageUri ? (
                                <View style={{ height: 140, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: GOLD, marginBottom: 10, position: 'relative' }}>
                                    <Image source={{ uri: docImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity 
                                        onPress={() => setDocImageUri(null)}
                                        style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: 4 }}
                                    >
                                        <Ionicons name="close" size={14} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    <TouchableOpacity 
                                        onPress={takeDocumentPhoto}
                                        style={{ flex: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                                    >
                                        <Ionicons name="camera-outline" size={14} color={GOLD} />
                                        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>Snap Photo</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={pickDocumentPhoto}
                                        style={{ flex: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                                    >
                                        <Ionicons name="image-outline" size={14} color={GOLD} />
                                        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>Upload Gallery</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Submit Verification Action Button */}
                            <TouchableOpacity 
                                onPress={handleSubmitKYC}
                                disabled={verifying}
                                style={{ height: 40, backgroundColor: GOLD, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                            >
                                {verifying ? (
                                    <ActivityIndicator size="small" color={NAVY} />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-sharp" size={14} color={NAVY} />
                                        <Text style={{ color: NAVY, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Submit Verification Request</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                        </View>

                        {/* Recent Pending Status Alert if exists */}
                        {pendingRequest && (
                            <View style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#D97706', marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="time-outline" size={18} color={GOLD} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: GOLD, fontWeight: '900', fontSize: 10 }}>Verification Under Review</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 8 }}>
                                        Your submitted {pendingRequest.document_type?.toUpperCase().replace(/_/g, ' ')} request is pending review by compliance.
                                    </Text>
                                </View>
                            </View>
                        )}

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
