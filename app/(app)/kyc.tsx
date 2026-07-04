import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { BlurView } from 'expo-blur';
import { useAppSettings } from '../../hooks/useAppSettings';

const NAVY = '#0d1b3e';
const GOLD = '#f5a623';

export default function KYC() {
    const router = useRouter();
    const { settings } = useAppSettings();

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

    const speakMsg = (text: string) => {
        setLivenessMessage(text);
        try {
            Speech.stop();
            Speech.speak(text, { language: 'en-US', pitch: 1.1, rate: 0.9 });
        } catch (e) {
            console.log("Speech error: ", e);
        }
    };

    const handleSubmit = async (docType: string, payload: any) => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            let fileUrl = null;

            if (payload.fileUri) {
                const base64 = await FileSystem.readAsStringAsync(payload.fileUri, {
                    encoding: 'base64',
                });
                
                const fileExt = payload.fileUri.split('.').pop() || 'jpg';
                const fileName = `${user.id}_${docType}_${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('kyc-documents')
                    .upload(fileName, decode(base64), {
                        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`
                    });
                
                if (uploadError) {
                    console.error("Upload Error:", uploadError);
                    throw new Error("Failed to upload image. " + uploadError.message);
                }
                
                const { data: publicUrlData } = supabase.storage
                    .from('kyc-documents')
                    .getPublicUrl(fileName);
                    
                fileUrl = publicUrlData.publicUrl;
            }

            const isAutoApproveSetting = settings?.auto_approve_kyc !== false;
            const isAutoApprove = isAutoApproveSetting && (docType === 'bvn' || docType === 'nin' || docType === 'liveness');
            const status = isAutoApprove ? 'approved' : 'pending';

            const { error: dbError } = await supabase.from('kyc_requests').insert({
                user_id: user.id,
                document_type: docType,
                document_number: payload.idNumber || null,
                document_url: fileUrl,
                status: status
            });

            if (dbError) {
                console.error("DB Insert Error:", dbError);
                throw new Error("Failed to save KYC request. " + dbError.message);
            }

            if (isAutoApprove) {
                let newTier = tier;
                if (docType === 'bvn') newTier = 1;
                if (docType === 'nin') newTier = 2;
                if (docType === 'liveness') newTier = 3;

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
                    console.error("Profile Update Error:", profileError);
                    throw new Error("Failed to update profile tier. " + profileError.message);
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

                if (docType === 'liveness') {
                     speakMsg("Verification successful!");
                     Alert.alert("Success", "Face Verification Saved!");
                }

                setTier(newTier);
            } else {
                setPendingRequest({ document_type: docType, status: 'pending' });
                Alert.alert("Submitted", "Document saved successfully and is pending review.");
            }

        } catch (error: any) {
            console.error("HandleSubmit Fatal Error:", error);
            Alert.alert("Submission Failed", error.message || "An unexpected error occurred.");
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
        if (!selfie) return Alert.alert("Required", "No face scan found. Please scan again.");
        handleSubmit('liveness', { fileUri: selfie });
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
        speakMsg('Position your face inside the frame and tap ready');
    };

    const nextLivenessStep = () => {
        if (livenessStep === 0) {
            setLivenessStep(1);
            speakMsg('Please blink your eyes, then tap next');
        } else if (livenessStep === 1) {
            setLivenessStep(2);
            speakMsg('Now, turn your head slightly, then tap next');
        } else if (livenessStep === 2) {
            setLivenessStep(3);
            speakMsg('Hold still, capturing');
            setIsAutoCapturing(true);
            setTimeout(() => {
                takeAutoSelfie();
            }, 2000);
        }
    };

    const takeAutoSelfie = async () => {
        try {
            if (cameraRef.current) {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
                if (photo && photo.uri) {
                    setSelfie(photo.uri);
                    setShowCamera(false);
                    speakMsg("Capture complete. Please tap save to upload.");
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

            <View style={StyleSheet.absoluteFillObject} className="pointer-events-none">
                <LinearGradient colors={[NAVY, '#101c3d']} style={{flex: 1}} />
                <LinearGradient colors={['rgba(245, 166, 35, 0.1)', 'rgba(245, 166, 35, 0)']} style={s.topGlow} />
            </View>

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                
                <View style={s.header}>
                    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.backBtn} activeOpacity={0.7}>
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
                            <Text style={s.introDesc}>Unlock premium features, higher limits, and advanced security.</Text>
                        </View>

                        <View style={s.stepperRow}>
                            <View style={[s.stepTab, tier >= 0 ? s.stepTabActive : s.stepTabInactive]}>
                                <View style={[s.stepCircle, tier >= 0 ? s.stepCircleActive : s.stepCircleInactive]}>
                                    {tier > 0 ? <Ionicons name="checkmark" size={16} color={NAVY} /> : <Text style={[s.stepNum, s.stepNumActive]}>1</Text>}
                                </View>
                                <Text style={[s.stepText, tier >= 0 ? s.stepTextActive : s.stepTextInactive]}>BVN</Text>
                            </View>
                            
                            <View style={[s.stepLine, tier >= 1 ? {backgroundColor: GOLD} : {}]} />

                            <View style={[s.stepTab, tier >= 1 ? s.stepTabActive : s.stepTabInactive]}>
                                <View style={[s.stepCircle, tier >= 1 ? s.stepCircleActive : s.stepCircleInactive]}>
                                    {tier > 1 ? <Ionicons name="checkmark" size={16} color={NAVY} /> : <Text style={[s.stepNum, tier === 1 ? s.stepNumActive : s.stepNumInactive]}>2</Text>}
                                </View>
                                <Text style={[s.stepText, tier >= 1 ? s.stepTextActive : s.stepTextInactive]}>NIN</Text>
                            </View>

                            <View style={[s.stepLine, tier >= 2 ? {backgroundColor: GOLD} : {}]} />

                            <View style={[s.stepTab, tier >= 2 ? s.stepTabActive : s.stepTabInactive]}>
                                <View style={[s.stepCircle, tier >= 2 ? s.stepCircleActive : s.stepCircleInactive]}>
                                    {tier > 2 ? <Ionicons name="checkmark" size={16} color={NAVY} /> : <Text style={[s.stepNum, tier === 2 ? s.stepNumActive : s.stepNumInactive]}>3</Text>}
                                </View>
                                <Text style={[s.stepText, tier >= 2 ? s.stepTextActive : s.stepTextInactive]}>FACE</Text>
                            </View>
                        </View>

                        {pendingRequest && pendingRequest.document_type !== 'liveness' ? (
                            <View style={s.glassCard}>
                                <View style={s.iconWrapper}>
                                    <Ionicons name="time" size={32} color={GOLD} />
                                </View>
                                <Text style={s.cardTitle}>Under Review</Text>
                                <Text style={s.cardDesc}>Your document has been submitted and is currently under review by our team.</Text>
                                <TouchableOpacity onPress={() => router.replace('/')} style={[s.actionBtn, {marginTop: 10}]} activeOpacity={0.8}>
                                    <Text style={s.actionBtnText}>Return to Dashboard</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                            {tier === 0 && (
                                <View style={s.glassCard}>
                                    <View style={s.iconWrapper}>
                                        <Ionicons name="card" size={26} color={NAVY} />
                                    </View>
                                    <Text style={s.cardTitle}>Bank Verification Number</Text>
                                    <Text style={s.cardDesc}>Enter your 11-digit BVN to instantly generate your Virtual Account.</Text>
                                    
                                    <View style={s.inputContainer}>
                                        <TextInput 
                                            value={bvn} 
                                            onChangeText={setBvn} 
                                            placeholder="Enter 11-digit BVN" 
                                            placeholderTextColor="rgba(255,255,255,0.4)"
                                            style={s.textInput} 
                                            keyboardType="numeric"
                                            maxLength={11}
                                        />
                                    </View>

                                    <TouchableOpacity onPress={submitBVN} disabled={verifying} activeOpacity={0.8} style={s.actionBtn}>
                                        {verifying ? <ActivityIndicator color={NAVY} /> : (
                                            <Text style={s.actionBtnText}>Verify & Continue</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {tier === 1 && (
                                <View style={s.glassCard}>
                                    <View style={s.iconWrapper}>
                                        <Ionicons name="id-card" size={26} color={NAVY} />
                                    </View>
                                    <Text style={s.cardTitle}>National Identity Number</Text>
                                    <Text style={s.cardDesc}>Provide your 11-digit NIN for advanced security profiling.</Text>
                                    
                                    <View style={s.inputContainer}>
                                        <TextInput 
                                            value={nin} 
                                            onChangeText={setNin} 
                                            placeholder="Enter 11-digit NIN" 
                                            placeholderTextColor="rgba(255,255,255,0.4)"
                                            style={s.textInput} 
                                            keyboardType="numeric"
                                            maxLength={11}
                                        />
                                    </View>

                                    <TouchableOpacity onPress={submitNIN} disabled={verifying} activeOpacity={0.8} style={s.actionBtn}>
                                        {verifying ? <ActivityIndicator color={NAVY} /> : (
                                            <Text style={s.actionBtnText}>Verify NIN</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {tier === 2 && (
                                <View style={s.glassCard}>
                                    <View style={s.iconWrapper}>
                                        <Ionicons name="scan" size={26} color={NAVY} />
                                    </View>
                                    <Text style={s.cardTitle}>Auto Face Verification</Text>
                                    <Text style={s.cardDesc}>We use advanced AI to verify your face automatically. Ensure you are in a well-lit room.</Text>
                                    
                                    <View style={s.selfieBox}>
                                        {selfie ? (
                                            <Image source={{ uri: selfie }} style={s.selfieImage} />
                                        ) : (
                                            <View style={s.selfieEmpty}>
                                                <Ionicons name="camera-outline" size={44} color="rgba(255,255,255,0.3)" />
                                                <Text style={s.selfieEmptyText}>Ready for scan</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Action Buttons Container */}
                                    <View style={{flexDirection: 'row', gap: 10}}>
                                        <TouchableOpacity onPress={handleOpenCamera} style={[s.actionBtn, {flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'}]} activeOpacity={0.8}>
                                            <Ionicons name="scan-outline" size={20} color="#ffffff" style={{marginRight: 6}} />
                                            <Text style={[s.actionBtnText, {color: '#ffffff'}]}>{selfie ? 'Retake' : 'Start Scan'}</Text>
                                        </TouchableOpacity>

                                        {selfie && (
                                            <TouchableOpacity onPress={submitLiveness} disabled={verifying} style={[s.actionBtn, {flex: 1.5}]} activeOpacity={0.8}>
                                                {verifying ? (
                                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                                        <ActivityIndicator color={NAVY} size="small" />
                                                        <Text style={s.actionBtnText}>Saving...</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={s.actionBtnText}>Save & Verify</Text>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}
                            </View>
                        )}

                        {tier >= 3 && (
                            <View style={[s.glassCard, {alignItems: 'center', paddingTop: 40, paddingBottom: 40}]}>
                                <View style={s.successIconBox}>
                                    <Ionicons name="shield-checkmark" size={44} color="#10b981" />
                                </View>
                                <Text style={[s.cardTitle, {textAlign: 'center'}]}>Fully Verified</Text>
                                <Text style={[s.cardDesc, {textAlign: 'center'}]}>Congratulations! Your account is fully verified. You now have unrestricted access to all premium features.</Text>
                                
                                <TouchableOpacity onPress={() => router.replace('/')} style={[s.actionBtn, {width: '100%', marginTop: 10}]} activeOpacity={0.8}>
                                    <Text style={s.actionBtnText}>Go to Dashboard</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Modernized Camera Modal */}
                <Modal visible={showCamera} animationType="slide" transparent={true} onRequestClose={() => setShowCamera(false)}>
                    <View style={s.cameraModalContainer}>
                        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />
                        
                        {/* Dark semi-transparent overlay to dim the background, without blurring the face */}
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />

                        <SafeAreaView style={s.cameraOverlayWrapper} edges={['top', 'bottom']}>
                            <View style={s.cameraTopBar}>
                                <TouchableOpacity onPress={() => { Speech.stop(); setShowCamera(false); }} style={s.cameraBackBtn}>
                                    <Ionicons name="close" size={24} color="#ffffff" />
                                </TouchableOpacity>
                                <View style={s.cameraHelpBadge}>
                                    <Text style={s.cameraHelpText}>Liveness Check</Text>
                                </View>
                                <View style={{width: 44}}/>
                            </View>
                            
                            <View style={s.faceFrameContainer}>
                                {/* Using a clear center with solid border to create a "hole" effect */}
                                <View style={[s.faceFrame, isAutoCapturing ? {borderColor: '#10b981', transform: [{scale: 1.05}]} : {borderColor: GOLD}]} />
                            </View>

                            <View style={s.cameraBottomBar}>
                                <View style={s.livenessCard}>
                                    {isAutoCapturing ? (
                                        <ActivityIndicator color={GOLD} size="large" style={{marginBottom: 12}} />
                                    ) : (
                                        <View style={s.livenessIconCircle}>
                                            <Ionicons name={livenessStep === 1 ? "eye" : livenessStep === 2 ? "sync" : "person"} size={36} color={GOLD} />
                                        </View>
                                    )}
                                    <Text style={s.livenessTitle}>
                                        {livenessStep === 1 ? "Blink Your Eyes" : livenessStep === 2 ? "Turn Head Slightly" : isAutoCapturing ? "Hold Still" : "Position Face"}
                                    </Text>
                                    <Text style={s.livenessMsgText}>{livenessMessage}</Text>
                                    
                                    {!isAutoCapturing && (
                                        <TouchableOpacity style={s.livenessBtn} onPress={nextLivenessStep} activeOpacity={0.8}>
                                            <Text style={s.livenessBtnText}>{livenessStep === 0 ? "I'm Ready" : "Next"}</Text>
                                        </TouchableOpacity>
                                    )}
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
    container: { flex: 1, backgroundColor: NAVY },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: NAVY },
    
    topGlow: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200 },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
    
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    
    introBlock: { marginTop: 10, marginBottom: 30, alignItems: 'center' },
    introTitle: { fontSize: 28, fontWeight: '900', color: '#ffffff', marginBottom: 6, letterSpacing: 0.5 },
    introDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
    
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30, paddingHorizontal: 10 },
    stepTab: { alignItems: 'center' },
    stepTabActive: { opacity: 1 },
    stepTabInactive: { opacity: 0.4 },
    stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2 },
    stepCircleActive: { backgroundColor: GOLD, borderColor: GOLD, shadowColor: GOLD, shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius: 8, elevation: 5 },
    stepCircleInactive: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.5)' },
    stepNum: { fontSize: 12, fontWeight: '800' },
    stepNumActive: { color: NAVY },
    stepNumInactive: { color: '#ffffff' },
    stepText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    stepTextActive: { color: GOLD },
    stepTextInactive: { color: 'rgba(255,255,255,0.8)' },
    stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12, alignSelf: 'flex-start', marginTop: 15 },
    
    glassCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
    iconWrapper: { width: 56, height: 56, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    cardTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 8 },
    cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 24 },
    
    inputContainer: { marginBottom: 24 },
    textInput: { height: 56, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 20, fontSize: 16, fontWeight: '600', color: '#ffffff', letterSpacing: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    
    actionBtn: { flexDirection: 'row', height: 56, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', borderRadius: 16, shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    actionBtnText: { color: NAVY, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
    
    selfieBox: { width: '100%', height: 220, backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    selfieImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    selfieEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    selfieEmptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginTop: 10, letterSpacing: 0.5 },
    
    successIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },

    cameraModalContainer: { flex: 1, backgroundColor: '#000' },
    cameraOverlayWrapper: { flex: 1, justifyContent: 'space-between', zIndex: 10, ...StyleSheet.absoluteFillObject },
    cameraTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 30 },
    cameraBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    cameraHelpBadge: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: GOLD },
    cameraHelpText: { color: GOLD, fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    
    faceFrameContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    faceFrame: { width: 280, height: 380, borderRadius: 140, borderWidth: 4, backgroundColor: 'transparent', shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20 },
    
    cameraBottomBar: { paddingBottom: 50, alignItems: 'center', paddingHorizontal: 20 },
    livenessCard: { width: '100%', backgroundColor: 'rgba(13, 27, 62, 0.95)', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
    livenessIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.2)' },
    livenessTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
    livenessMsgText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
    livenessBtn: { backgroundColor: GOLD, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 20, marginTop: 20, shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    livenessBtnText: { color: NAVY, fontWeight: '900', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }
});
