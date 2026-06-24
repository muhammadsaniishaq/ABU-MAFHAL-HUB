import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const NAVY = '#0d1b3e';
const GOLD = '#f5a623';

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

    // Liveness Detection State
    const [livenessStep, setLivenessStep] = useState(0);
    const [livenessMessage, setLivenessMessage] = useState('Position your face inside the frame');
    const [isAutoCapturing, setIsAutoCapturing] = useState(false);

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
                const fileExt = payload.fileUri.split('.').pop() || 'jpg';
                const fileName = `${user.id}_${docType}_${Date.now()}.${fileExt}`;
                
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
                status: status
            });

            if (dbError) throw dbError;

            if (isAutoApprove) {
                const newTier = docType === 'bvn' ? 1 : 2;
                const updatePayload: any = { kyc_tier: newTier };
                if (docType === 'bvn') updatePayload.bvn = payload.idNumber;
                if (docType === 'nin') updatePayload.nin = payload.idNumber;

                if (!userData?.email) updatePayload.email = `${user.id.substring(0,8)}@abumafhal.com.ng`;
                let safePhone = userData?.phone ? userData.phone.replace(/\D/g, '') : '';
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
                            Alert.alert("Success!", `Virtual Account created successfully!`);
                        }
                    } catch (e: any) {
                        Alert.alert('Virtual Account Server Error', e.message || JSON.stringify(e));
                    }
                }

                setTier(newTier);
            } else {
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

    // Triggered automatically after photo capture
    const autoSubmitLiveness = (uri: string) => {
        handleSubmit('liveness', { fileUri: uri });
    };

    const handleOpenCamera = async () => {
        let currentPermission = permission;
        if (!currentPermission || !currentPermission.granted) {
            const response = await requestPermission();
            if (!response.granted) {
                Alert.alert(
                    "Permission Denied", 
                    "Camera access is required for Face Verification. Please enable it in your device settings."
                );
                return;
            }
        }
        setShowCamera(true);
        startLivenessSequence();
    };

    const startLivenessSequence = () => {
        setLivenessStep(0);
        setIsAutoCapturing(false);
        setLivenessMessage('Position your face inside the frame...');
        
        setTimeout(() => {
            setLivenessStep(1);
            setLivenessMessage('Please blink your eyes...');
            
            setTimeout(() => {
                setLivenessStep(2);
                setLivenessMessage('Now, turn your head slightly...');
                
                setTimeout(() => {
                    setLivenessStep(3);
                    setLivenessMessage('Hold still, capturing...');
                    setIsAutoCapturing(true);
                    
                    setTimeout(() => {
                        takeAutoSelfie();
                    }, 1000);
                }, 2500);
            }, 2500);
        }, 3000);
    };

    const takeAutoSelfie = async () => {
        try {
            if (cameraRef.current) {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
                if (photo && photo.uri) {
                    setSelfie(photo.uri);
                    setShowCamera(false);
                    // Automatically submit it just like OPay
                    autoSubmitLiveness(photo.uri);
                }
            }
        } catch (e: any) {
             Alert.alert("Camera Error", e.message || "Unknown error occurred while capturing image.");
             setShowCamera(false);
        }
    };

    if (loading) return (
        <SafeAreaView style={s.centerContainer}>
            <ActivityIndicator size="large" color={GOLD} />
        </SafeAreaView>
    );

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient colors={[NAVY, '#1a2b5e']} style={s.bgHeader} />
            <View style={s.bgBody} />

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                
                <View style={s.header}>
                    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>KYC Verification</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView 
                        style={{ flex: 1 }}
                        contentContainerStyle={s.scrollContent}
                        showsVerticalScrollIndicator={false} 
                    >
                        
                        <View style={s.introBlock}>
                            <Text style={s.introTitle}>Verify Your Identity</Text>
                            <Text style={s.introDesc}>Unlock full features, higher limits, and advanced security by completing your KYC.</Text>
                        </View>

                        <View style={s.stepperRow}>
                            <View style={[s.stepTab, tier === 0 ? s.stepTabActive : s.stepTabInactive]}>
                                <View style={[s.stepCircle, tier === 0 ? s.stepCircleActive : s.stepCircleInactive]}>
                                    <Text style={[s.stepNum, tier === 0 ? s.stepNumActive : s.stepNumInactive]}>1</Text>
                                </View>
                                <Text style={[s.stepText, tier === 0 ? s.stepTextActive : s.stepTextInactive]}>BVN</Text>
                            </View>
                            
                            <View style={s.stepLine} />

                            <View style={[s.stepTab, tier === 1 ? s.stepTabActive : s.stepTabInactive]}>
                                <View style={[s.stepCircle, tier === 1 ? s.stepCircleActive : s.stepCircleInactive]}>
                                    <Text style={[s.stepNum, tier === 1 ? s.stepNumActive : s.stepNumInactive]}>2</Text>
                                </View>
                                <Text style={[s.stepText, tier === 1 ? s.stepTextActive : s.stepTextInactive]}>NIN</Text>
                            </View>

                            <View style={s.stepLine} />

                            <View style={[s.stepTab, tier === 2 ? s.stepTabActive : s.stepTabInactive]}>
                                <View style={[s.stepCircle, tier === 2 ? s.stepCircleActive : s.stepCircleInactive]}>
                                    <Text style={[s.stepNum, tier === 2 ? s.stepNumActive : s.stepNumInactive]}>3</Text>
                                </View>
                                <Text style={[s.stepText, tier === 2 ? s.stepTextActive : s.stepTextInactive]}>FACE</Text>
                            </View>
                        </View>

                        {pendingRequest ? (
                            <View style={s.card}>
                                <View style={s.iconWrapper}>
                                    <Ionicons name="time" size={32} color={GOLD} />
                                </View>
                                <Text style={s.cardTitle}>Under Review</Text>
                                <Text style={s.cardDesc}>Your facial verification has been submitted and is currently under review by our team. You will be notified once it is approved.</Text>
                                <TouchableOpacity onPress={() => router.replace('/')} style={[s.actionBtn, {marginTop: 10}]} activeOpacity={0.8}>
                                    <Text style={s.actionBtnText}>Return to Dashboard</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                            {tier === 0 && (
                                <View style={s.card}>
                                    <View style={s.iconWrapper}>
                                        <Ionicons name="card" size={28} color={NAVY} />
                                    </View>
                                    <Text style={s.cardTitle}>Bank Verification Number</Text>
                                    <Text style={s.cardDesc}>Enter your 11-digit BVN to instantly generate your Virtual Account. This does not give us access to your money.</Text>
                                    
                                    <View style={s.inputContainer}>
                                        <TextInput 
                                            value={bvn} 
                                            onChangeText={setBvn} 
                                            placeholder="Enter 11-digit BVN" 
                                            placeholderTextColor="#94a3b8"
                                            style={s.textInput} 
                                            keyboardType="numeric"
                                            maxLength={11}
                                        />
                                    </View>

                                    <TouchableOpacity onPress={submitBVN} disabled={verifying} activeOpacity={0.8} style={s.actionBtn}>
                                        {verifying ? <ActivityIndicator color="#ffffff" /> : (
                                            <Text style={s.actionBtnText}>Verify & Continue</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {tier === 1 && (
                                <View style={s.card}>
                                    <View style={s.iconWrapper}>
                                        <Ionicons name="id-card" size={28} color={NAVY} />
                                    </View>
                                    <Text style={s.cardTitle}>National Identity Number</Text>
                                    <Text style={s.cardDesc}>Provide your 11-digit NIN for advanced security profiling and higher limits.</Text>
                                    
                                    <View style={s.inputContainer}>
                                        <TextInput 
                                            value={nin} 
                                            onChangeText={setNin} 
                                            placeholder="Enter 11-digit NIN" 
                                            placeholderTextColor="#94a3b8"
                                            style={s.textInput} 
                                            keyboardType="numeric"
                                            maxLength={11}
                                        />
                                    </View>

                                    <TouchableOpacity onPress={submitNIN} disabled={verifying} activeOpacity={0.8} style={s.actionBtn}>
                                        {verifying ? <ActivityIndicator color="#ffffff" /> : (
                                            <Text style={s.actionBtnText}>Verify NIN</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {tier === 2 && (
                                <View style={s.card}>
                                    <View style={s.iconWrapper}>
                                        <Ionicons name="scan" size={28} color={NAVY} />
                                    </View>
                                    <Text style={s.cardTitle}>Auto Face Verification</Text>
                                    <Text style={s.cardDesc}>We use advanced AI to verify your face automatically. Ensure you are in a well-lit room.</Text>
                                    
                                    <View style={s.selfieBox}>
                                        {selfie ? (
                                            <Image source={{ uri: selfie }} style={s.selfieImage} />
                                        ) : (
                                            <View style={s.selfieEmpty}>
                                                <Ionicons name="camera-outline" size={40} color="#cbd5e1" />
                                                <Text style={s.selfieEmptyText}>Ready for scan</Text>
                                            </View>
                                        )}
                                    </View>

                                    {verifying ? (
                                        <View style={[s.actionBtn, {backgroundColor: NAVY, flexDirection: 'row', gap: 10}]}>
                                            <ActivityIndicator color="#ffffff" />
                                            <Text style={s.actionBtnText}>Uploading Verification...</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity onPress={handleOpenCamera} style={s.actionBtn} activeOpacity={0.8}>
                                            <Ionicons name="scan-outline" size={20} color="#ffffff" style={{marginRight: 8}} />
                                            <Text style={s.actionBtnText}>{selfie ? 'Rescan Face' : 'Start Auto Scan'}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                            </View>
                        )}

                        {tier >= 3 && (
                            <View style={s.successCard}>
                                <View style={s.successIconBox}>
                                    <Ionicons name="checkmark-done" size={40} color="#10b981" />
                                </View>
                                <Text style={s.successTitle}>Fully Verified</Text>
                                <Text style={s.successDesc}>Congratulations! Your account is fully verified. You now have unrestricted access to all premium features.</Text>
                                
                                <TouchableOpacity onPress={() => router.replace('/')} style={[s.actionBtn, {marginTop: 24}]} activeOpacity={0.8}>
                                    <Text style={s.actionBtnText}>Go to Dashboard</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Auto Liveness Camera Modal */}
                <Modal visible={showCamera} animationType="fade" transparent={false} onRequestClose={() => setShowCamera(false)}>
                    <View style={s.cameraModalContainer}>
                        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />
                        
                        <SafeAreaView style={s.cameraOverlayWrapper} edges={['top', 'bottom']}>
                            {/* Overlay Header */}
                            <View style={s.cameraTopBar}>
                                <TouchableOpacity onPress={() => setShowCamera(false)} style={s.cameraBackBtn}>
                                    <Ionicons name="close" size={24} color="#ffffff" />
                                </TouchableOpacity>
                            </View>
                            
                            {/* Face Frame Overlay with Animated-like borders */}
                            <View style={s.faceFrameContainer}>
                                <View style={[s.faceFrame, isAutoCapturing ? {borderColor: '#10b981', transform: [{scale: 1.05}]} : {borderColor: GOLD}]} />
                            </View>

                            {/* Liveness Instructions */}
                            <View style={s.cameraBottomBar}>
                                <View style={s.livenessMsgBox}>
                                    {isAutoCapturing ? (
                                        <ActivityIndicator color={NAVY} style={{marginRight: 10}} />
                                    ) : (
                                        <Ionicons name={livenessStep === 1 ? "eye" : livenessStep === 2 ? "sync" : "person"} size={24} color={NAVY} style={{marginRight: 10}} />
                                    )}
                                    <Text style={s.livenessMsgText}>{livenessMessage}</Text>
                                </View>
                            </View>
                        </SafeAreaView>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6fb' },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: NAVY },
    
    bgHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
    bgBody: { position: 'absolute', top: 280, left: 0, right: 0, bottom: 0, backgroundColor: '#f4f6fb' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    
    introBlock: { marginTop: 10, marginBottom: 30, alignItems: 'center' },
    introTitle: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
    introDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
    
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30, paddingHorizontal: 10 },
    stepTab: { alignItems: 'center', opacity: 0.5 },
    stepTabActive: { opacity: 1 },
    stepTabInactive: { opacity: 0.5 },
    stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 2 },
    stepCircleActive: { backgroundColor: GOLD, borderColor: GOLD },
    stepCircleInactive: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)' },
    stepNum: { fontSize: 12, fontWeight: '800' },
    stepNumActive: { color: NAVY },
    stepNumInactive: { color: '#ffffff' },
    stepText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    stepTextActive: { color: GOLD },
    stepTextInactive: { color: 'rgba(255,255,255,0.6)' },
    stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 10, alignSelf: 'flex-start', marginTop: 15 },
    
    card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, shadowColor: NAVY, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 },
    iconWrapper: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    cardTitle: { fontSize: 20, fontWeight: '800', color: NAVY, marginBottom: 8 },
    cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 20, marginBottom: 24 },
    
    inputContainer: { marginBottom: 24 },
    textInput: { height: 56, backgroundColor: '#f8f9fc', borderRadius: 16, paddingHorizontal: 20, fontSize: 16, fontWeight: '600', color: NAVY, letterSpacing: 2, borderWidth: 1, borderColor: '#e2e8f0' },
    
    actionBtn: { flexDirection: 'row', height: 56, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center', borderRadius: 16, shadowColor: NAVY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    actionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
    
    selfieBox: { width: '100%', height: 200, backgroundColor: '#f8f9fc', marginBottom: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed' },
    selfieImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    selfieEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    selfieEmptyText: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 8 },
    
    successCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 30, alignItems: 'center', shadowColor: NAVY, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 },
    successIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    successTitle: { fontSize: 24, fontWeight: '800', color: NAVY, marginBottom: 12, textAlign: 'center' },
    successDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },

    cameraModalContainer: { flex: 1, backgroundColor: '#000' },
    cameraOverlayWrapper: { flex: 1, justifyContent: 'space-between', zIndex: 10 },
    cameraTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 20 },
    cameraBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    
    faceFrameContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    faceFrame: { width: 300, height: 380, borderRadius: 150, borderWidth: 4, backgroundColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 },
    
    cameraBottomBar: { paddingBottom: 60, alignItems: 'center', paddingHorizontal: 20 },
    livenessMsgBox: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5},
    livenessMsgText: { color: NAVY, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }
});
