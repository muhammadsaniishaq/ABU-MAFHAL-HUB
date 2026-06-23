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
    const [bvnAvailable, setBvnAvailable] = useState<boolean | null>(null);
    const [checkingBvn, setCheckingBvn] = useState(false);

    const [nin, setNin] = useState('');
    const [ninAvailable, setNinAvailable] = useState<boolean | null>(null);
    const [checkingNin, setCheckingNin] = useState(false);

    const [selfie, setSelfie] = useState<string | null>(null);

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

    useEffect(() => {
        const checkBvn = async () => {
            if (bvn.length < 11) {
                setBvnAvailable(null);
                return;
            }
            setCheckingBvn(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'id_number', value: bvn }
                });
                if (!error) setBvnAvailable(data.available);
            } catch (e) {
                console.error(e);
            } finally {
                setCheckingBvn(false);
            }
        };
        const timer = setTimeout(checkBvn, 500);
        return () => clearTimeout(timer);
    }, [bvn]);

    useEffect(() => {
        const checkNin = async () => {
            if (nin.length < 11) {
                setNinAvailable(null);
                return;
            }
            setCheckingNin(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'id_number', value: nin }
                });
                if (!error) setNinAvailable(data.available);
            } catch (e) {
                console.error(e);
            } finally {
                setCheckingNin(false);
            }
        };
        const timer = setTimeout(checkNin, 500);
        return () => clearTimeout(timer);
    }, [nin]);

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

                if (profileError) throw profileError;

                if (docType === 'bvn') {
                    // Using Promise.race to enforce a 15-second timeout for the edge function
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Request timed out. The server took too long to respond.")), 15000)
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
                            Alert.alert('Virtual Account Error', vAccountErr.message || JSON.stringify(vAccountErr));
                        } else if (vAccountData?.error) {
                            Alert.alert('Virtual Account Failed', vAccountData.error + (vAccountData.message ? "\\n" + vAccountData.message : ""));
                        } else {
                            Alert.alert("Success!", \`Your \${docType.toUpperCase()} is verified and Virtual Account created!\`);
                        }
                    } catch (e: any) {
                        Alert.alert('Server Error', e.message || "Failed to contact server.");
                    }
                } else {
                    Alert.alert("Success!", \`Your \${docType.toUpperCase()} has been verified!\`);
                }

                setTier(newTier);
            } else {
                Alert.alert("Submitted", "Your document is under review. This usually takes less than 24 hours.");
                setPendingRequest({ document_type: docType, status: 'pending' });
            }

        } catch (error: any) {
            Alert.alert("Error", error.message || "An unexpected error occurred");
        } finally {
            setVerifying(false);
        }
    };

    const submitBVN = () => {
        if (!bvn) return Alert.alert("Required", "Please enter your 11-digit BVN");
        if (bvn.length !== 11) return Alert.alert("Required", "BVN must be exactly 11 digits");
        if (bvnAvailable === false) return Alert.alert("Error", "BVN already in use");
        handleSubmit('bvn', { idNumber: bvn });
    };

    const submitNIN = () => {
        if (!nin) return Alert.alert("Required", "Please enter your 11-digit NIN");
        if (nin.length !== 11) return Alert.alert("Required", "NIN must be exactly 11 digits");
        if (ninAvailable === false) return Alert.alert("Error", "NIN already in use");
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

    const generateCertificate = async () => {
        try {
            const asset = Asset.fromModule(require('../assets/images/logo.png'));
            await asset.downloadAsync();
            const logoBase64 = await FileSystem.readAsStringAsync(asset.localUri || '', { encoding: 'base64' });
            const logoSrc = \`data:image/png;base64,\${logoBase64}\`;

            const html = \`
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Great+Vibes&family=Montserrat:wght@300;400;500;600&display=swap');
                        :root { --gold: #C5A059; --gold-dark: #8A6E36; --navy: #0F172A; --slate: #334155; }
                        body { margin: 0; padding: 0; background-color: white; -webkit-print-color-adjust: exact; }
                        .page-container { width: 100%; height: 100vh; position: relative; overflow: hidden; display: flex; flex-direction: column; background: white; }
                        .border-outer { position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; border: 3px solid var(--gold); z-index: 10; pointer-events: none; }
                        .border-inner { position: absolute; top: 30px; left: 30px; right: 30px; bottom: 30px; border: 1px solid var(--gold); z-index: 10; pointer-events: none; }
                        .content { position: relative; z-index: 50; height: 100%; padding: 60px 80px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
                        .header-section { text-align: center; margin-top: 20px; }
                        .logo { height: 100px; object-fit: contain; margin-bottom: 20px; } 
                        .org-name { font-family: 'Cinzel', serif; font-weight: 700; font-size: 16px; color: var(--gold-dark); letter-spacing: 4px; text-transform: uppercase; }
                        .cert-title { font-family: 'Cinzel', serif; font-size: 52px; font-weight: 900; color: var(--navy); text-transform: uppercase; letter-spacing: 2px; margin: 10px 0 0 0; }
                        .cert-subtitle { font-family: 'Montserrat', sans-serif; font-size: 14px; color: var(--gold); text-transform: uppercase; letter-spacing: 5px; margin-top: 5px; font-weight: 600; }
                        .body-section { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; }
                        .presented-to { font-family: 'Montserrat', sans-serif; font-size: 15px; color: var(--slate); font-style: italic; margin-bottom: 5px; letter-spacing: 1px; }
                        .recipient-name { font-family: 'Great Vibes', cursive; font-size: 64px; color: var(--navy); margin: 10px auto; padding: 0 50px; border-bottom: 2px solid #e2e8f0; display: inline-block; min-width: 60%; line-height: 1.2; }
                        .body-text { font-family: 'Montserrat', sans-serif; font-size: 14px; color: var(--slate); line-height: 1.7; max-width: 700px; margin: 25px auto; font-weight: 500; }
                        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; opacity: 0.1; z-index: 0; pointer-events: none; filter: grayscale(100%); }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="border-outer"></div>
                        <div class="border-inner"></div>
                        <img src="\${logoSrc}" class="watermark" />
                        <div class="content">
                            <div class="header-section">
                                <img src="\${logoSrc}" class="logo" />
                                <div class="org-name">ABU MAFHAL SUB</div>
                                <div class="cert-title">Certificate</div>
                                <div class="cert-subtitle">of Verification</div>
                            </div>
                            <div class="body-section">
                                <div class="presented-to">This certifies that</div>
                                <div class="recipient-name">\${userData?.full_name || 'Abu Mafhal User'}</div>
                                <div class="body-text">
                                    Has successfully completed all identity verification protocols required by Abu Mafhal Sub. 
                                    The holder is hereby recognized as a fully verified member.
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            \`;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error: any) {
            Alert.alert("Error", "Could not generate certificate: " + error.message);
        }
    };

    if (loading) return (
        <View style={s.centerContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
        </View>
    );

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* SUPER MODERN HEADER WITH ABSTRACT SHAPES */}
            <View style={s.headerContainer}>
                <LinearGradient 
                    colors={['#0F172A', '#1E293B', '#0F172A']} 
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.headerGradient}
                >
                    <View style={s.abstractShape1} />
                    <View style={s.abstractShape2} />
                    <View style={s.abstractShape3} />

                    <View style={s.headerRow}>
                        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={s.statusBadge}>
                            <View style={[s.statusDot, { backgroundColor: tier >= 3 ? '#10B981' : '#F59E0B' }]} />
                            <Text style={s.statusText}>{tier >= 3 ? 'Verified' : 'Unverified'}</Text>
                        </View>
                    </View>
                    
                    <View style={s.headerTextWrap}>
                        <Text style={s.headerTitle}>KYC Verification</Text>
                        <Text style={s.headerSubtitle}>Complete your profile to unlock full features, increased limits, and your Virtual Account.</Text>
                    </View>
                </LinearGradient>
            </View>
            
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false} 
                >
                    {/* SLEEK STEPPER CARD */}
                    <View style={s.stepperCard}>
                        <View style={s.stepperHeader}>
                            <Text style={s.stepperLabel}>Current Phase</Text>
                            <Text style={s.stepperTitle}>Step {Math.min(tier + 1, 3)} of 3</Text>
                        </View>

                        <View style={s.stepperTrackWrap}>
                            {[1, 2, 3].map((t, index) => (
                                <View key={t} style={s.stepItem}>
                                    <View style={[s.stepDot, tier >= t ? s.stepDotDone : tier + 1 === t ? s.stepDotActive : s.stepDotPending]}>
                                        {tier >= t ? (
                                            <Ionicons name="checkmark" size={12} color="white" />
                                        ) : (
                                            <View style={tier + 1 === t ? s.stepDotInnerActive : s.stepDotInnerPending} />
                                        )}
                                    </View>
                                    <Text style={[s.stepText, tier >= t ? s.stepTextDone : tier + 1 === t ? s.stepTextActive : s.stepTextPending]}>
                                        {t === 1 ? 'BVN' : t === 2 ? 'NIN' : 'Selfie'}
                                    </Text>
                                    {index < 2 && (
                                        <View style={s.stepConnector}>
                                            <View style={[s.stepConnectorFill, { width: tier > t ? '100%' : '0%' }]} />
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
    
                    {pendingRequest ? (
                        <View style={s.glassCard}>
                            <View style={s.pendingIconBg}>
                                <Ionicons name="time" size={32} color="#F59E0B" />
                            </View>
                            <Text style={s.cardTitle}>Under Review</Text>
                            <Text style={s.cardDesc}>
                                We are reviewing your document. This usually takes less than 24 hours to process.
                            </Text>
                        </View>
                    ) : (
                        <View>
                        {/* STEP 1: BVN */}
                        {tier === 0 && (
                            <View style={s.glassCard}>
                                <View style={s.cardHeaderRow}>
                                    <View style={s.cardIconWrap}><Ionicons name="card" size={20} color="#3B82F6" /></View>
                                    <View>
                                        <Text style={s.cardTitle}>BVN Verification</Text>
                                        <Text style={s.cardDesc}>Step 1 required for Virtual Account</Text>
                                    </View>
                                </View>
                                
                                <LinearGradient colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']} style={s.promoBanner}>
                                    <Ionicons name="flash" size={20} color="#10B981" />
                                    <View style={s.promoBannerTextWrap}>
                                        <Text style={s.promoBannerTitle}>Instant Virtual Account</Text>
                                        <Text style={s.promoBannerDesc}>Submitting your BVN creates your account instantly!</Text>
                                    </View>
                                </LinearGradient>
                                
                                <View style={s.inputGroup}>
                                    <Text style={s.inputLabel}>Bank Verification Number (11 Digits)</Text>
                                    <View style={[s.inputWrapper, bvnAvailable === false ? s.inputWrapperError : bvnAvailable === true ? s.inputWrapperSuccess : {}]}>
                                        <TextInput 
                                            value={bvn} 
                                            onChangeText={setBvn} 
                                            placeholder="Enter 11 Digits" 
                                            placeholderTextColor="#94A3B8"
                                            style={s.inputElement} 
                                            keyboardType="numeric"
                                            maxLength={11}
                                        />
                                        {checkingBvn ? <ActivityIndicator size="small" color="#3B82F6" /> : bvnAvailable === true ? <Ionicons name="checkmark-circle" size={20} color="#10B981" /> : bvnAvailable === false ? <Ionicons name="close-circle" size={20} color="#EF4444" /> : <Ionicons name="keypad" size={20} color="#CBD5E1" />}
                                    </View>
                                    {bvnAvailable === false && <Text style={s.errorHintText}>This BVN is already registered to another account.</Text>}
                                </View>

                                <TouchableOpacity onPress={submitBVN} disabled={verifying} activeOpacity={0.8}>
                                    <LinearGradient colors={['#3B82F6', '#2563EB']} style={s.primaryBtn}>
                                        {verifying ? <ActivityIndicator color="white" /> : (
                                            <>
                                                <Text style={s.primaryBtnText}>Verify & Open Account</Text>
                                                <Ionicons name="arrow-forward" size={18} color="white" />
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* STEP 2: NIN */}
                        {tier === 1 && (
                            <View style={s.glassCard}>
                                <View style={s.cardHeaderRow}>
                                    <View style={s.cardIconWrap}><Ionicons name="document-text" size={20} color="#3B82F6" /></View>
                                    <View>
                                        <Text style={s.cardTitle}>NIN Verification</Text>
                                        <Text style={s.cardDesc}>Step 2 for identity confirmation</Text>
                                    </View>
                                </View>
                                
                                <View style={s.inputGroup}>
                                    <Text style={s.inputLabel}>National Identity Number (11 Digits)</Text>
                                    <View style={[s.inputWrapper, ninAvailable === false ? s.inputWrapperError : ninAvailable === true ? s.inputWrapperSuccess : {}]}>
                                        <TextInput 
                                            value={nin} 
                                            onChangeText={setNin} 
                                            placeholder="Enter 11 Digits" 
                                            placeholderTextColor="#94A3B8"
                                            style={s.inputElement} 
                                            keyboardType="numeric"
                                            maxLength={11}
                                        />
                                        {checkingNin ? <ActivityIndicator size="small" color="#3B82F6" /> : ninAvailable === true ? <Ionicons name="checkmark-circle" size={20} color="#10B981" /> : ninAvailable === false ? <Ionicons name="close-circle" size={20} color="#EF4444" /> : <Ionicons name="keypad" size={20} color="#CBD5E1" />}
                                    </View>
                                    {ninAvailable === false && <Text style={s.errorHintText}>This NIN is already registered to another account.</Text>}
                                </View>

                                <TouchableOpacity onPress={submitNIN} disabled={verifying} activeOpacity={0.8}>
                                    <LinearGradient colors={['#3B82F6', '#2563EB']} style={s.primaryBtn}>
                                        {verifying ? <ActivityIndicator color="white" /> : (
                                            <>
                                                <Text style={s.primaryBtnText}>Verify NIN</Text>
                                                <Ionicons name="arrow-forward" size={18} color="white" />
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* STEP 3: LIVENESS */}
                        {tier === 2 && (
                            <View style={s.glassCard}>
                                <View style={s.cardHeaderRow}>
                                    <View style={s.cardIconWrap}><Ionicons name="scan" size={20} color="#3B82F6" /></View>
                                    <View>
                                        <Text style={s.cardTitle}>Facial Verification</Text>
                                        <Text style={s.cardDesc}>Final step: Take a quick selfie</Text>
                                    </View>
                                </View>
                                
                                <View style={s.selfieContainer}>
                                    <View style={s.selfieFrame}>
                                        {selfie ? (
                                            <Image source={{ uri: selfie }} style={s.selfieImage} />
                                        ) : (
                                            <View style={s.selfiePlaceholder}>
                                                <Ionicons name="person" size={56} color="#CBD5E1" />
                                            </View>
                                        )}
                                        <TouchableOpacity 
                                            onPress={async () => {
                                                if (!permission?.granted) {
                                                    const { granted } = await requestPermission();
                                                    if (!granted) return Alert.alert("Permission Required", "We need camera access to take your selfie.");
                                                }
                                                setShowCamera(true);
                                            }} 
                                            style={s.cameraTriggerBtn}
                                        >
                                            <Ionicons name="camera" size={16} color="white" />
                                            <Text style={s.cameraTriggerText}>{selfie ? 'Retake' : 'Open Camera'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {selfie && (
                                    <TouchableOpacity onPress={submitLiveness} disabled={verifying} activeOpacity={0.8}>
                                        <LinearGradient colors={['#10B981', '#059669']} style={s.primaryBtn}>
                                            {verifying ? <ActivityIndicator color="white" /> : (
                                                <>
                                                    <Text style={s.primaryBtnText}>Complete KYC</Text>
                                                    <Ionicons name="checkmark-circle" size={18} color="white" />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        </View>
                    )}

                    {/* COMPLETED VIEW */}
                    {tier >= 3 && (
                        <View style={s.completedContainer}>
                            <View style={s.completedIconPulse}>
                                <View style={s.completedIconBg}>
                                    <Ionicons name="shield-checkmark" size={48} color="#10B981" />
                                </View>
                            </View>
                            <Text style={s.completedTitle}>Account Verified!</Text>
                            <Text style={s.completedDesc}>
                                Congratulations, you have successfully completed all KYC requirements. You now have full access to all features.
                            </Text>
                            
                            <TouchableOpacity onPress={generateCertificate} activeOpacity={0.8} style={{ width: '100%' }}>
                                <LinearGradient colors={['#1E293B', '#0F172A']} style={s.certBtn}>
                                    <View style={s.certBtnIcon}><Ionicons name="ribbon" size={20} color="#F59E0B" /></View>
                                    <View style={s.certBtnContent}>
                                        <Text style={s.certBtnTitle}>Official Certificate</Text>
                                        <Text style={s.certBtnSub}>Download your verified status PDF</Text>
                                    </View>
                                    <Ionicons name="download" size={20} color="#94A3B8" />
                                </LinearGradient>
                            </TouchableOpacity>
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
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                            <Text style={s.cameraTitleText}>Face Alignment</Text>
                            <View style={{ width: 44 }} />
                         </View>
                         
                         <View style={s.cameraFrameContainer}>
                             <View style={s.cameraOvalFrame} />
                             <Text style={s.cameraHintText}>Position your face clearly within the frame</Text>
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
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
    
    headerContainer: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    headerGradient: { paddingHorizontal: 24, paddingVertical: 24, position: 'relative' },
    abstractShape1: { position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
    abstractShape2: { position: 'absolute', bottom: -30, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(16, 185, 129, 0.05)' },
    abstractShape3: { position: 'absolute', top: 20, left: 60, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 255, 255, 0.02)' },
    
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, zIndex: 2 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { color: 'white', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    
    headerTextWrap: { zIndex: 2, marginBottom: 10 },
    headerTitle: { color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
    headerSubtitle: { color: '#94A3B8', fontSize: 13, lineHeight: 20, opacity: 0.9 },
    
    scrollContent: { padding: 20, paddingBottom: 60 },
    
    stepperCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F8FAFC' },
    stepperHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    stepperLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 },
    stepperTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    
    stepperTrackWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
    stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    stepDotDone: { backgroundColor: '#3B82F6' },
    stepDotActive: { backgroundColor: 'white', borderWidth: 2, borderColor: '#3B82F6' },
    stepDotPending: { backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: '#E2E8F0' },
    stepDotInnerActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
    stepDotInnerPending: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CBD5E1' },
    stepText: { fontSize: 11, fontWeight: '700', marginLeft: 8 },
    stepTextDone: { color: '#3B82F6' },
    stepTextActive: { color: '#0F172A' },
    stepTextPending: { color: '#94A3B8' },
    stepConnector: { flex: 1, height: 3, backgroundColor: '#F1F5F9', borderRadius: 2, marginHorizontal: 8, overflow: 'hidden' },
    stepConnectorFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },

    glassCard: { backgroundColor: 'white', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4, borderWidth: 1, borderColor: '#F8FAFC' },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    cardIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    cardDesc: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    
    promoBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
    promoBannerTextWrap: { marginLeft: 12, flex: 1 },
    promoBannerTitle: { fontSize: 13, fontWeight: '800', color: '#064E3B', marginBottom: 2 },
    promoBannerDesc: { fontSize: 11, color: '#047857', lineHeight: 16 },

    inputGroup: { marginBottom: 24 },
    inputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 8, letterSpacing: 0.5 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 52, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 16 },
    inputWrapperSuccess: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
    inputWrapperError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    inputElement: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: 2 },
    errorHintText: { fontSize: 11, color: '#EF4444', marginTop: 8, fontWeight: '600' },

    primaryBtn: { flexDirection: 'row', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '800', marginRight: 8, letterSpacing: 0.5 },

    selfieContainer: { alignItems: 'center', marginBottom: 32 },
    selfieFrame: { width: 160, height: 160, borderRadius: 80, padding: 4, backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: '#DBEAFE', position: 'relative' },
    selfieImage: { width: '100%', height: '100%', borderRadius: 80, resizeMode: 'cover' },
    selfiePlaceholder: { width: '100%', height: '100%', borderRadius: 80, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    cameraTriggerBtn: { position: 'absolute', bottom: -10, alignSelf: 'center', backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
    cameraTriggerText: { color: 'white', fontSize: 11, fontWeight: '700', marginLeft: 6 },

    pendingIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },

    completedContainer: { alignItems: 'center', paddingVertical: 20 },
    completedIconPulse: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    completedIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
    completedTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
    completedDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 20 },
    
    certBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, width: '100%' },
    certBtnIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    certBtnContent: { flex: 1 },
    certBtnTitle: { color: 'white', fontSize: 15, fontWeight: '800', marginBottom: 2 },
    certBtnSub: { color: '#94A3B8', fontSize: 11, fontWeight: '500' },

    cameraModalContainer: { flex: 1, backgroundColor: '#000' },
    cameraOverlayWrapper: { flex: 1, justifyContent: 'space-between' },
    cameraTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
    cameraBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    cameraTitleText: { color: 'white', fontSize: 16, fontWeight: '700' },
    cameraFrameContainer: { alignItems: 'center', justifyContent: 'center' },
    cameraOvalFrame: { width: 250, height: 350, borderRadius: 125, borderWidth: 4, borderColor: 'rgba(59, 130, 246, 0.8)', backgroundColor: 'transparent' },
    cameraHintText: { color: 'white', fontSize: 14, fontWeight: '600', marginTop: 24, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    cameraBottomBar: { alignItems: 'center', paddingBottom: 40 },
    cameraCaptureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
    cameraCaptureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' }
});
`;

fs.writeFileSync('app/kyc.tsx', code, 'utf8');
console.log('Successfully modernized kyc.tsx completely');
