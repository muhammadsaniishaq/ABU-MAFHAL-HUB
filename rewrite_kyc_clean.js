const fs = require('fs');

const code = `import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function KYC() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [tier, setTier] = useState(0);
    const [userData, setUserData] = useState<any>(null);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [verifying, setVerifying] = useState(false);

    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [showCamera, setShowCamera] = useState(false);

    const [bvn, setBvn] = useState('');
    const [nin, setNin] = useState('');
    const [selfie, setSelfie] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profErr) {
                console.error(profErr);
            }
            setUserData({ ...profile, id: user.id });
            
            const { data: pending } = await supabase
                .from('kyc_requests')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (pending) {
                setPendingRequest(pending);
            }

            setTier(profile?.kyc_tier || 0);

        } catch (error: any) {
            console.error("KYC Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (docType: string, payload: any) => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            let fileUrl = null;

            if (payload.fileUri) {
                const fileExt = payload.fileUri.split('.').pop();
                const fileName = \`\${user.id}_\${docType}_\${Date.now()}.\${fileExt}\`;
                
                const response = await fetch(payload.fileUri);
                const blob = await response.blob();
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('kyc-documents')
                    .upload(fileName, blob);
                
                if (uploadError) throw uploadError;
                
                const { data: publicUrlData } = supabase.storage
                    .from('kyc-documents')
                    .getPublicUrl(fileName);
                    
                fileUrl = publicUrlData.publicUrl;
            }

            const isAutoApprove = docType === 'bvn' || docType === 'nin';
            const status = isAutoApprove ? 'approved' : 'pending';

            const { error: dbError } = await supabase.from('kyc_requests').insert({
                user_id: user.id,
                document_type: docType,
                document_number: payload.idNumber || null,
                document_url: fileUrl,
                data: payload.extra || null,
                status: status
            });

            if (dbError) throw dbError;

            if (isAutoApprove) {
                const newTier = docType === 'bvn' ? 1 : 2;
                const updatePayload: any = { kyc_tier: newTier };
                if (docType === 'bvn') updatePayload.bvn = payload.idNumber;
                if (docType === 'nin') updatePayload.nin = payload.idNumber;

                // Ensure safe fallback data for virtual account
                if (!userData?.email) updatePayload.email = \`\${user.id.substring(0,8)}@abumafhal.com.ng\`;
                let safePhone = userData?.phone ? userData.phone.replace(/\\D/g, '') : '';
                if (!safePhone || safePhone.length < 10) safePhone = '08000000000';
                if (!userData?.phone || userData.phone !== safePhone) updatePayload.phone = safePhone;
                if (!userData?.full_name) updatePayload.full_name = 'Abu Mafhal User';

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update(updatePayload)
                    .eq('id', user.id);

                if (profileError) {
                    Alert.alert("Profile Update Error", JSON.stringify(profileError));
                    throw profileError;
                }

                if (docType === 'bvn') {
                    // Using Promise.race to enforce a 15-second timeout for the edge function
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Timeout: The server took too long to create the virtual account.")), 15000)
                    );
                    
                    try {
                        const response: any = await Promise.race([
                            supabase.functions.invoke('create-virtual-account', {
                                body: { userId: user.id, bvn: payload.idNumber }
                            }),
                            timeoutPromise
                        ]);
                        
                        const vAccountData = response?.data;
                        const vAccountErr = response?.error;
                        
                        if (vAccountErr) {
                            Alert.alert('Virtual Account Creation Error', JSON.stringify(vAccountErr));
                        } else if (vAccountData?.error) {
                            Alert.alert('Virtual Account Backend Failed', JSON.stringify(vAccountData));
                        } else {
                            Alert.alert("Success!", \`Virtual Account created successfully!\`);
                        }
                    } catch (e: any) {
                        Alert.alert('Virtual Account Server Error', e.message || JSON.stringify(e));
                    }
                }

                setTier(newTier);
            } else {
                Alert.alert("Submitted", "Your document is under review.");
                setPendingRequest({ document_type: docType, status: 'pending' });
            }

        } catch (error: any) {
            Alert.alert("Fatal Error", JSON.stringify(error) || error.message);
        } finally {
            setVerifying(false);
        }
    };

    const submitBVN = () => {
        if (!bvn) return Alert.alert("Required", "Please enter your 11-digit BVN");
        if (bvn.length !== 11) return Alert.alert("Required", "BVN must be exactly 11 digits");
        handleSubmit('bvn', { idNumber: bvn });
    };

    const submitNIN = () => {
        if (!nin) return Alert.alert("Required", "Please enter your 11-digit NIN");
        if (nin.length !== 11) return Alert.alert("Required", "NIN must be exactly 11 digits");
        handleSubmit('nin', { idNumber: nin });
    };

    const submitLiveness = () => {
        if (!selfie) return Alert.alert("Required", "Please take a selfie first");
        handleSubmit('liveness', { fileUri: selfie });
    };

    const takeSelfie = async () => {
        try {
            if (cameraRef.current) {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
                setSelfie(photo.uri);
                setShowCamera(false);
            }
        } catch (e: any) {
             Alert.alert("Camera Error", e.message || "Unknown error occurred");
        }
    };

    if (loading) return (
        <View style={s.centerContainer}>
            <ActivityIndicator size="large" color="#000" />
        </View>
    );

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />

            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <View style={s.headerSection}>
                <Text style={s.titleText}>Identity</Text>
                <Text style={s.titleTextLight}>Verification</Text>
            </View>
            
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false} 
                >
                    <View style={s.stepperRow}>
                        <View style={[s.stepTab, tier === 0 ? s.stepTabActive : s.stepTabInactive]}>
                            <Text style={[s.stepTabText, tier === 0 ? s.stepTabTextActive : s.stepTabTextInactive]}>01 BVN</Text>
                        </View>
                        <View style={[s.stepTab, tier === 1 ? s.stepTabActive : s.stepTabInactive]}>
                            <Text style={[s.stepTabText, tier === 1 ? s.stepTabTextActive : s.stepTabTextInactive]}>02 NIN</Text>
                        </View>
                        <View style={[s.stepTab, tier === 2 ? s.stepTabActive : s.stepTabInactive]}>
                            <Text style={[s.stepTabText, tier === 2 ? s.stepTabTextActive : s.stepTabTextInactive]}>03 FACE</Text>
                        </View>
                    </View>

                    {pendingRequest ? (
                        <View style={s.cleanCard}>
                            <Text style={s.cleanCardTitle}>Pending Review</Text>
                            <Text style={s.cleanCardDesc}>Your document has been submitted and is currently under review by our team.</Text>
                        </View>
                    ) : (
                        <View>
                        {tier === 0 && (
                            <View style={s.cleanCard}>
                                <Text style={s.cleanCardTitle}>Enter BVN</Text>
                                <Text style={s.cleanCardDesc}>Your 11-digit Bank Verification Number is required to instantly generate your Virtual Account.</Text>
                                
                                <View style={s.inputContainer}>
                                    <TextInput 
                                        value={bvn} 
                                        onChangeText={setBvn} 
                                        placeholder="00000000000" 
                                        placeholderTextColor="#A1A1AA"
                                        style={s.textInput} 
                                        keyboardType="numeric"
                                        maxLength={11}
                                    />
                                </View>

                                <TouchableOpacity onPress={submitBVN} disabled={verifying} activeOpacity={0.8} style={s.actionButton}>
                                    {verifying ? <ActivityIndicator color="#FFF" /> : (
                                        <Text style={s.actionButtonText}>VERIFY & OPEN ACCOUNT</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {tier === 1 && (
                            <View style={s.cleanCard}>
                                <Text style={s.cleanCardTitle}>Enter NIN</Text>
                                <Text style={s.cleanCardDesc}>Your 11-digit National Identity Number is required for advanced verification.</Text>
                                
                                <View style={s.inputContainer}>
                                    <TextInput 
                                        value={nin} 
                                        onChangeText={setNin} 
                                        placeholder="00000000000" 
                                        placeholderTextColor="#A1A1AA"
                                        style={s.textInput} 
                                        keyboardType="numeric"
                                        maxLength={11}
                                    />
                                </View>

                                <TouchableOpacity onPress={submitNIN} disabled={verifying} activeOpacity={0.8} style={s.actionButton}>
                                    {verifying ? <ActivityIndicator color="#FFF" /> : (
                                        <Text style={s.actionButtonText}>VERIFY NIN</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {tier === 2 && (
                            <View style={s.cleanCard}>
                                <Text style={s.cleanCardTitle}>Facial Check</Text>
                                <Text style={s.cleanCardDesc}>Take a clear selfie to finalize your identity verification process.</Text>
                                
                                <View style={s.selfieBox}>
                                    {selfie ? (
                                        <Image source={{ uri: selfie }} style={s.selfieImage} />
                                    ) : (
                                        <View style={s.selfieEmpty} />
                                    )}
                                </View>

                                <TouchableOpacity 
                                    onPress={async () => {
                                        if (!permission?.granted) {
                                            const { granted } = await requestPermission();
                                            if (!granted) return Alert.alert("Permission Required", "Camera access needed.");
                                        }
                                        setShowCamera(true);
                                    }} 
                                    style={s.secondaryButton}
                                >
                                    <Text style={s.secondaryButtonText}>{selfie ? 'RETAKE PHOTO' : 'OPEN CAMERA'}</Text>
                                </TouchableOpacity>

                                {selfie && (
                                    <TouchableOpacity onPress={submitLiveness} disabled={verifying} activeOpacity={0.8} style={s.actionButton}>
                                        {verifying ? <ActivityIndicator color="#FFF" /> : (
                                            <Text style={s.actionButtonText}>COMPLETE VERIFICATION</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        </View>
                    )}

                    {tier >= 3 && (
                        <View style={s.cleanCard}>
                            <Text style={s.cleanCardTitle}>Verification Complete</Text>
                            <Text style={s.cleanCardDesc}>Your account is fully verified and you have unrestricted access.</Text>
                            
                            <View style={s.successBox}>
                                <Text style={s.successBoxText}>ALL SYSTEMS ACTIVE</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={showCamera} animationType="slide" transparent={false} onRequestClose={() => setShowCamera(false)}>
                 <View style={s.cameraModalContainer}>
                     <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />
                     
                     <SafeAreaView style={s.cameraOverlayWrapper}>
                         <View style={s.cameraTopBar}>
                            <TouchableOpacity onPress={() => setShowCamera(false)} style={s.cameraBackBtn}>
                                <Text style={s.cameraBackText}>CANCEL</Text>
                            </TouchableOpacity>
                         </View>
                         
                         <View style={s.cameraBottomBar}>
                            <TouchableOpacity onPress={takeSelfie} style={s.cameraCaptureBtn}>
                                <View style={s.cameraCaptureInner} />
                            </TouchableOpacity>
                         </View>
                     </SafeAreaView>
                 </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    
    topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    
    headerSection: { paddingHorizontal: 24, marginBottom: 32 },
    titleText: { fontSize: 36, fontWeight: '900', color: '#000000', letterSpacing: -1 },
    titleTextLight: { fontSize: 36, fontWeight: '300', color: '#000000', letterSpacing: -1, marginTop: -8 },
    
    scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
    
    stepperRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
    stepTab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2 },
    stepTabActive: { borderBottomColor: '#000000' },
    stepTabInactive: { borderBottomColor: '#F4F4F5' },
    stepTabText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
    stepTabTextActive: { color: '#000000' },
    stepTabTextInactive: { color: '#A1A1AA' },

    cleanCard: { marginBottom: 24 },
    cleanCardTitle: { fontSize: 20, fontWeight: '800', color: '#000000', marginBottom: 8 },
    cleanCardDesc: { fontSize: 14, color: '#71717A', lineHeight: 22, marginBottom: 32 },

    inputContainer: { marginBottom: 32 },
    textInput: { height: 60, backgroundColor: '#F4F4F5', borderRadius: 0, paddingHorizontal: 20, fontSize: 18, fontWeight: '600', color: '#000000', letterSpacing: 2 },

    actionButton: { height: 60, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', borderRadius: 0 },
    actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 2 },

    secondaryButton: { height: 60, backgroundColor: '#F4F4F5', justifyContent: 'center', alignItems: 'center', borderRadius: 0, marginBottom: 16 },
    secondaryButtonText: { color: '#000000', fontSize: 14, fontWeight: '800', letterSpacing: 2 },

    selfieBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F4F4F5', marginBottom: 32 },
    selfieImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    selfieEmpty: { width: '100%', height: '100%' },

    successBox: { padding: 24, backgroundColor: '#F4F4F5', alignItems: 'center', marginTop: 24 },
    successBoxText: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: '#000000' },

    cameraModalContainer: { flex: 1, backgroundColor: '#000' },
    cameraOverlayWrapper: { flex: 1, justifyContent: 'space-between' },
    cameraTopBar: { padding: 24, alignItems: 'flex-start' },
    cameraBackBtn: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
    cameraBackText: { color: 'white', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
    cameraBottomBar: { paddingBottom: 60, alignItems: 'center' },
    cameraCaptureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
    cameraCaptureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' }
});
`;

fs.writeFileSync('app/kyc.tsx', code, 'utf8');
console.log('Successfully rewrote kyc.tsx with ultra-clean modern minimalist design');
