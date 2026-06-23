const fs = require('fs');

const code = `import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet } from 'react-native';
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

    // Core States
    const [loading, setLoading] = useState(true);
    const [tier, setTier] = useState(0);
    const [userData, setUserData] = useState<any>(null);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [verifying, setVerifying] = useState(false);

    // Camera Permissions
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [showCamera, setShowCamera] = useState(false);

    // Form Data States
    const [bvn, setBvn] = useState('');
    const [bvnAvailable, setBvnAvailable] = useState<boolean | null>(null);
    const [checkingBvn, setCheckingBvn] = useState(false);

    const [nin, setNin] = useState('');
    const [ninAvailable, setNinAvailable] = useState<boolean | null>(null);
    const [checkingNin, setCheckingNin] = useState(false);

    const [selfie, setSelfie] = useState<string | null>(null);

    // Layout Constants - reduced significantly for smaller mobile view
    const { width } = useWindowDimensions();
    const scale = width < 400 ? 0.8 : width < 600 ? 0.9 : 1; // Made scale even smaller for smaller screens

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

                // CRITICAL FIX FOR PAYVESSEL VIRTUAL ACCOUNTS
                // Ensure the database has safe email, phone and name so the Edge Function doesn't fail
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
                    try {
                        const { data: vAccountData, error: vAccountErr } = await supabase.functions.invoke('create-virtual-account', {
                            body: { userId: user.id, bvn: payload.idNumber }
                        });
                        
                        if (vAccountErr) {
                            Alert.alert('Virtual Account Error', vAccountErr.message || JSON.stringify(vAccountErr));
                        } else if (vAccountData?.error) {
                            Alert.alert('Virtual Account Failed', vAccountData.error + (vAccountData.message ? "\\n" + vAccountData.message : ""));
                        } else {
                            Alert.alert("Verified!", \`Your \${docType.toUpperCase()} has been instantly verified, and your Virtual Account is ready!\`);
                        }
                    } catch (e: any) {
                        Alert.alert('Virtual Account Exception', e.message || "Unknown error");
                    }
                } else {
                    Alert.alert("Verified!", \`Your \${docType.toUpperCase()} has been instantly verified!\`);
                }

                setTier(newTier);
            } else {
                Alert.alert("Submitted", "Your document is under review. This usually takes less than 24 hours.");
                setPendingRequest({ document_type: docType, status: 'pending' });
            }

        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to submit document");
        } finally {
            setVerifying(false);
        }
    };

    const submitBVN = () => {
        if (!bvn) return Alert.alert("Required", "Please enter your BVN");
        if (bvnAvailable === false) return Alert.alert("Error", "BVN already in use");
        handleSubmit('bvn', { idNumber: bvn });
    };

    const submitNIN = () => {
        if (!nin) return Alert.alert("Required", "Please enter your NIN");
        if (ninAvailable === false) return Alert.alert("Error", "NIN already in use");
        handleSubmit('nin', { idNumber: nin });
    };

    const submitLiveness = () => {
        if (!selfie) return Alert.alert("Selfie Required", "Please take a selfie");
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

    if (loading) return <View style={s.centerContainer}><ActivityIndicator size="small" color="#4F46E5" /></View>;

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <View style={s.headerContainer}>
                <LinearGradient 
                    colors={['#0F172A', '#1E293B']} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.headerGradient, { paddingBottom: 24 * scale, paddingTop: 16 * scale }]}
                >
                    {/* Add decorative elements */}
                    <View style={s.headerDecoration1} />
                    <View style={s.headerDecoration2} />

                    <View style={s.headerRow}>
                        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={[s.backBtn, { width: 32 * scale, height: 32 * scale }]}>
                            <Ionicons name="chevron-back" size={16 * scale} color="white" />
                        </TouchableOpacity>
                        <View style={[s.statusBadge, { paddingHorizontal: 10 * scale, paddingVertical: 4 * scale }]}>
                            <View style={[s.statusDot, { backgroundColor: tier >= 3 ? '#34D399' : '#FBBF24', width: 6 * scale, height: 6 * scale }]} />
                            <Text style={[s.statusText, { fontSize: 9 * scale }]}>{tier >= 3 ? 'Verified' : 'Unverified'}</Text>
                        </View>
                    </View>
                    
                    <View style={{ paddingHorizontal: 16 * scale }}>
                        <Text style={[s.headerTitle, { fontSize: 22 * scale }]}>KYC Center</Text>
                        <Text style={[s.headerSubtitle, { fontSize: 11 * scale, maxWidth: '90%' }]}>
                            Complete 3 simple steps to unlock maximum limits and your official certificate.
                        </Text>
                    </View>
                </LinearGradient>
            </View>
            
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={[s.scrollContent, { paddingHorizontal: 16 * scale }]}
                    showsVerticalScrollIndicator={false} 
                >
                    {/* PROGRESS CARD */}
                    <View style={[s.card, { padding: 16 * scale, marginTop: -20 * scale, marginBottom: 16 * scale }]}>
                        <View style={[s.progressHeader, { marginBottom: 16 * scale }]}>
                            <View>
                                <Text style={[s.progressLabel, { fontSize: 9 * scale }]}>Current Progress</Text>
                                <Text style={[s.progressStepText, { fontSize: 16 * scale }]}>Step {Math.min(tier + 1, 3)} of 3</Text>
                            </View>
                            <View style={[s.progressRing, { width: 44 * scale, height: 44 * scale }]}>
                                <Text style={[s.progressPercent, { fontSize: 13 * scale }]}>{Math.floor((tier / 3) * 100)}%</Text>
                            </View>
                        </View>
                        
                        <View style={[s.stepperRow, { paddingHorizontal: 8 * scale }]}>
                            {[1, 2, 3].map((t, index) => (
                                <View key={t} style={s.stepItem}>
                                    <View style={[s.stepCircle, { width: 28 * scale, height: 28 * scale }, tier >= t ? s.stepCircleDone : tier + 1 === t ? s.stepCircleActive : s.stepCirclePending]}>
                                        {tier >= t ? (
                                            <Ionicons name="checkmark" size={14 * scale} color="white" />
                                        ) : (
                                            <Text style={[s.stepCircleText, { fontSize: 11 * scale }, tier + 1 === t ? { color: '#4F46E5' } : { color: '#94A3B8' }]}>{t}</Text>
                                        )}
                                    </View>
                                    {index < 2 && (
                                        <View style={[s.stepLine, tier > t ? { backgroundColor: '#4F46E5' } : { backgroundColor: '#F1F5F9' }]} />
                                    )}
                                </View>
                            ))}
                        </View>
                        
                        <View style={[s.stepLabelsRow, { marginTop: 8 * scale }]}>
                            <Text style={[s.stepLabelText, { fontSize: 8 * scale }, tier >= 0 ? { color: '#4F46E5' } : { color: '#94A3B8' }]}>BVN</Text>
                            <Text style={[s.stepLabelText, { fontSize: 8 * scale }, tier >= 1 ? { color: '#4F46E5' } : { color: '#94A3B8' }]}>NIN</Text>
                            <Text style={[s.stepLabelText, { fontSize: 8 * scale }, tier >= 2 ? { color: '#4F46E5' } : { color: '#94A3B8' }]}>Biometric</Text>
                        </View>
                    </View>
    
                    {pendingRequest ? (
                        <View style={[s.card, s.pendingCard, { padding: 24 * scale }]}>
                            <View style={[s.pendingIconWrapper, { width: 48 * scale, height: 48 * scale, marginBottom: 16 * scale }]}>
                                <ActivityIndicator size="small" color="#F59E0B" />
                            </View>
                            <Text style={[s.pendingTitle, { fontSize: 16 * scale, marginBottom: 4 * scale }]}>Review In Progress</Text>
                            <Text style={[s.pendingSubtitle, { fontSize: 11 * scale }]}>
                                We are carefully reviewing your document. This usually takes less than 24 hours.
                            </Text>
                        </View>
                    ) : (
                        <View>
                            
                        {/* STEP 1: BVN */}
                        {tier === 0 && (
                            <View>
                                <View style={[s.stepHeader, { marginBottom: 12 * scale }]}>
                                    <View style={[s.stepIconBox, { width: 28 * scale, height: 28 * scale, borderRadius: 8 * scale }]}><Ionicons name="card" size={14 * scale} color="#4F46E5" /></View>
                                    <Text style={[s.stepTitle, { fontSize: 16 * scale }]}>BVN Verification</Text>
                                </View>
                                
                                <View style={[s.card, { padding: 16 * scale }]}>
                                    <View style={[s.instantBadge, { padding: 12 * scale, marginBottom: 16 * scale }]}>
                                        <View style={[s.instantIcon, { width: 32 * scale, height: 32 * scale }]}><Ionicons name="flash" size={16 * scale} color="#059669" /></View>
                                        <View style={{ flex: 1, marginLeft: 10 * scale }}>
                                            <Text style={[s.instantTitle, { fontSize: 11 * scale }]}>Instant Virtual Account</Text>
                                            <Text style={[s.instantSubtitle, { fontSize: 9 * scale }]}>Submitting your BVN instantly unlocks and creates your Virtual Account!</Text>
                                        </View>
                                    </View>
                                    
                                    <View style={{ marginBottom: 16 * scale }}>
                                        <Text style={[s.inputLabel, { fontSize: 9 * scale, marginBottom: 6 * scale }]}>Enter 11-Digit BVN</Text>
                                        <View style={[s.inputBox, { height: 44 * scale, paddingHorizontal: 12 * scale }, bvnAvailable === false ? s.inputError : bvnAvailable === true ? s.inputSuccess : {}]}>
                                            <Ionicons name="keypad" size={14 * scale} color="#94A3B8" style={{ marginRight: 8 * scale }} />
                                            <TextInput 
                                                value={bvn} 
                                                onChangeText={setBvn} 
                                                placeholder="00000000000" 
                                                style={[s.inputText, { fontSize: 14 * scale, letterSpacing: 2 * scale }]} 
                                                keyboardType="numeric"
                                                maxLength={11}
                                            />
                                            {checkingBvn ? <ActivityIndicator size="small" color="#4F46E5" /> : bvnAvailable === true ? <Ionicons name="checkmark-circle" size={16 * scale} color="#059669" /> : bvnAvailable === false ? <Ionicons name="close-circle" size={16 * scale} color="#EF4444" /> : null}
                                        </View>
                                        {bvnAvailable === false && <Text style={[s.errorText, { fontSize: 9 * scale, marginTop: 6 * scale }]}>This BVN is already linked.</Text>}
                                    </View>

                                    <TouchableOpacity onPress={submitBVN} disabled={verifying} activeOpacity={0.8}>
                                        <LinearGradient colors={['#0F172A', '#1E293B']} style={[s.submitBtn, { height: 44 * scale, borderRadius: 12 * scale }]}>
                                            {verifying ? <ActivityIndicator color="white" size="small" /> : (
                                                <View style={s.btnInner}>
                                                    <Text style={[s.btnText, { fontSize: 12 * scale }]}>Verify BVN Now</Text>
                                                    <Ionicons name="arrow-forward" size={14 * scale} color="white" />
                                                </View>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* STEP 2: NIN */}
                        {tier === 1 && (
                            <View>
                                <View style={[s.stepHeader, { marginBottom: 12 * scale }]}>
                                    <View style={[s.stepIconBox, { width: 28 * scale, height: 28 * scale, borderRadius: 8 * scale }]}><Ionicons name="document-text" size={14 * scale} color="#4F46E5" /></View>
                                    <Text style={[s.stepTitle, { fontSize: 16 * scale }]}>NIN Verification</Text>
                                </View>
                                
                                <View style={[s.card, { padding: 16 * scale }]}>
                                    <Text style={[s.instructionText, { fontSize: 11 * scale, marginBottom: 16 * scale }]}>
                                        Please provide your National Identification Number (NIN) to proceed to the final step.
                                    </Text>
                                    
                                    <View style={{ marginBottom: 16 * scale }}>
                                        <Text style={[s.inputLabel, { fontSize: 9 * scale, marginBottom: 6 * scale }]}>Enter 11-Digit NIN</Text>
                                        <View style={[s.inputBox, { height: 44 * scale, paddingHorizontal: 12 * scale }, ninAvailable === false ? s.inputError : ninAvailable === true ? s.inputSuccess : {}]}>
                                            <Ionicons name="keypad" size={14 * scale} color="#94A3B8" style={{ marginRight: 8 * scale }} />
                                            <TextInput 
                                                value={nin} 
                                                onChangeText={setNin} 
                                                placeholder="00000000000" 
                                                style={[s.inputText, { fontSize: 14 * scale, letterSpacing: 2 * scale }]} 
                                                keyboardType="numeric"
                                                maxLength={11}
                                            />
                                            {checkingNin ? <ActivityIndicator size="small" color="#4F46E5" /> : ninAvailable === true ? <Ionicons name="checkmark-circle" size={16 * scale} color="#059669" /> : ninAvailable === false ? <Ionicons name="close-circle" size={16 * scale} color="#EF4444" /> : null}
                                        </View>
                                        {ninAvailable === false && <Text style={[s.errorText, { fontSize: 9 * scale, marginTop: 6 * scale }]}>This NIN is already linked.</Text>}
                                    </View>

                                    <TouchableOpacity onPress={submitNIN} disabled={verifying} activeOpacity={0.8}>
                                        <LinearGradient colors={['#0F172A', '#1E293B']} style={[s.submitBtn, { height: 44 * scale, borderRadius: 12 * scale }]}>
                                            {verifying ? <ActivityIndicator color="white" size="small" /> : (
                                                <View style={s.btnInner}>
                                                    <Text style={[s.btnText, { fontSize: 12 * scale }]}>Verify NIN</Text>
                                                    <Ionicons name="arrow-forward" size={14 * scale} color="white" />
                                                </View>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* STEP 3: LIVENESS */}
                        {tier === 2 && (
                            <View>
                                <View style={[s.stepHeader, { marginBottom: 12 * scale }]}>
                                    <View style={[s.stepIconBox, { width: 28 * scale, height: 28 * scale, borderRadius: 8 * scale }]}><Ionicons name="scan" size={14 * scale} color="#4F46E5" /></View>
                                    <Text style={[s.stepTitle, { fontSize: 16 * scale }]}>Biometric Check</Text>
                                </View>
                                <View style={[s.card, { padding: 24 * scale, alignItems: 'center' }]}>
                                    
                                    <Text style={[s.instructionText, { fontSize: 11 * scale, marginBottom: 20 * scale, textAlign: 'center' }]}>
                                        We need to verify that you are a real person. Please take a quick selfie in good lighting.
                                    </Text>
                                    
                                    <View style={[s.selfieBox, { width: 140 * scale, height: 140 * scale, borderRadius: 70 * scale, marginBottom: 20 * scale, borderWidth: 6 * scale }]}>
                                        {selfie ? (
                                            <Image source={{ uri: selfie }} style={{ width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 70 * scale }} />
                                        ) : (
                                            <View style={[s.selfiePlaceholder]}>
                                                <Ionicons name="person" size={48 * scale} color="#CBD5E1" />
                                            </View>
                                        )}
                                        <TouchableOpacity 
                                            onPress={async () => {
                                                if (!permission?.granted) {
                                                    const { granted } = await requestPermission();
                                                    if (!granted) return Alert.alert("Permission", "Need camera permission");
                                                }
                                                setShowCamera(true);
                                            }} 
                                            style={[s.cameraBtn, { height: 28 * scale, bottom: 8 * scale, paddingHorizontal: 12 * scale }]}
                                        >
                                            <Text style={[s.cameraBtnText, { fontSize: 8 * scale }]}>{selfie ? 'Retake' : 'Open Camera'}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {selfie && (
                                        <TouchableOpacity onPress={submitLiveness} disabled={verifying} activeOpacity={0.8} style={{ width: '100%' }}>
                                            <LinearGradient colors={['#0F172A', '#1E293B']} style={[s.submitBtn, { height: 44 * scale, borderRadius: 12 * scale }]}>
                                                {verifying ? <ActivityIndicator color="white" size="small" /> : (
                                                    <View style={s.btnInner}>
                                                        <Text style={[s.btnText, { fontSize: 12 * scale }]}>Complete KYC</Text>
                                                        <Ionicons name="checkmark-circle" size={14 * scale} color="white" />
                                                    </View>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                        </View>
                    )}

                    {/* COMPLETED VIEW */}
                    {tier >= 3 && (
                        <View style={[s.completedView, { paddingVertical: 24 * scale }]}>
                            <View style={[s.successIconWrap, { marginBottom: 20 * scale }]}>
                                <View style={[s.successIconBlur, { width: 100 * scale, height: 100 * scale }]} />
                                <View style={[s.successIconInner, { width: 70 * scale, height: 70 * scale, borderWidth: 3 * scale }]}>
                                    <Ionicons name="checkmark-done" size={32 * scale} color="#059669" />
                                </View>
                            </View>
                            <Text style={[s.successTitle, { fontSize: 20 * scale, marginBottom: 8 * scale }]}>Fully Verified!</Text>
                            <Text style={[s.successSubtitle, { fontSize: 11 * scale, marginBottom: 24 * scale, paddingHorizontal: 16 * scale }]}>
                                Your identity has been fully verified. You now have unlimited access to all features.
                            </Text>
                            
                            <View style={[s.certCard, { padding: 16 * scale, borderRadius: 16 * scale, marginBottom: 20 * scale }]}>
                                <View style={[s.certRow, { marginBottom: 16 * scale }]}>
                                    <View style={[s.certIcon, { width: 32 * scale, height: 32 * scale }]}><Ionicons name="ribbon" size={16 * scale} color="#F59E0B" /></View>
                                    <View style={{ marginLeft: 12 * scale }}>
                                        <Text style={[s.certTitle, { fontSize: 13 * scale }]}>Official Certificate</Text>
                                        <Text style={[s.certSub, { fontSize: 9 * scale }]}>Fully Verified Status</Text>
                                    </View>
                                </View>
                                
                                <TouchableOpacity onPress={generateCertificate} activeOpacity={0.8}>
                                    <LinearGradient colors={['#F59E0B', '#D97706']} style={[s.submitBtn, { height: 40 * scale, borderRadius: 10 * scale }]}>
                                        <View style={s.btnInner}>
                                            <Text style={[s.btnText, { fontSize: 11 * scale, letterSpacing: 1 * scale, textTransform: 'uppercase' }]}>Download PDF</Text>
                                            <Ionicons name="cloud-download" size={14 * scale} color="white" />
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={showCamera} animationType="fade" transparent={true} onRequestClose={() => setShowCamera(false)}>
                 <View style={s.modalBg}>
                     <View style={{ flex: 1, position: 'relative' }}>
                         <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
                         
                         <View style={s.cameraOverlay} pointerEvents="none">
                             <View style={s.cameraOverlayBg} />
                             <View style={[s.cameraFrame, { width: 220 * scale, height: 280 * scale, borderRadius: 110 * scale, borderWidth: 3 * scale }]} />
                             <View style={[s.cameraPrompt, { top: 60 * scale, paddingHorizontal: 16 * scale, paddingVertical: 8 * scale }]}>
                                <Text style={[s.cameraPromptText, { fontSize: 11 * scale }]}>Position your face inside</Text>
                             </View>
                         </View>

                         <View style={[s.cameraControls, { paddingBottom: 30 * scale, paddingTop: 40 * scale }]} pointerEvents="box-none">
                            <View style={s.cameraControlsRow} pointerEvents="box-none">
                                <TouchableOpacity onPress={() => setShowCamera(false)} style={[s.cameraCloseBtn, { width: 40 * scale, height: 40 * scale }]}>
                                    <Ionicons name="close" size={20 * scale} color="white" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity onPress={takeSelfie} style={[s.shutterBtn, { width: 64 * scale, height: 64 * scale, borderWidth: 4 * scale }]}>
                                    <View style={[s.shutterBtnInner, { width: 50 * scale, height: 50 * scale, borderWidth: 2 * scale }]} />
                                </TouchableOpacity>

                                <View style={{ width: 40 * scale, height: 40 * scale }} />
                            </View>
                            <Text style={[s.cameraHintText, { fontSize: 9 * scale, marginTop: 16 * scale }]}>ENSURE GOOD LIGHTING</Text>
                         </View>
                     </View>
                 </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
    headerContainer: { zIndex: 10, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    headerGradient: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 16, position: 'relative', overflow: 'hidden' },
    
    // Extra Decorations
    headerDecoration1: { position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 0 },
    headerDecoration2: { position: 'absolute', left: -30, bottom: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', zIndex: 0 },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, zIndex: 1 },
    backBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    statusBadge: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center' },
    statusDot: { borderRadius: 10, marginRight: 4 },
    statusText: { color: 'white', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    headerTitle: { color: 'white', fontWeight: '900', marginBottom: 4, letterSpacing: -0.5, zIndex: 1 },
    headerSubtitle: { color: '#94A3B8', fontWeight: '500', lineHeight: 16, zIndex: 1 },
    
    scrollContent: { paddingBottom: 80, maxWidth: 600, alignSelf: 'center', width: '100%' },
    
    card: { backgroundColor: 'white', borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
    progressStepText: { color: '#0F172A', fontWeight: '900' },
    progressRing: { backgroundColor: '#EEF2FF', borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0E7FF' },
    progressPercent: { color: '#4F46E5', fontWeight: '900' },
    
    stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
    stepCircle: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    stepCircleDone: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    stepCircleActive: { backgroundColor: 'white', borderColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
    stepCirclePending: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
    stepCircleText: { fontWeight: '700' },
    stepLine: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 6 },
    stepLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
    stepLabelText: { fontWeight: '700', textTransform: 'uppercase' },

    pendingCard: { alignItems: 'center', backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' },
    pendingIconWrapper: { backgroundColor: 'white', borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
    pendingTitle: { color: '#78350F', fontWeight: '900', textAlign: 'center' },
    pendingSubtitle: { color: '#92400E', textAlign: 'center', fontWeight: '500', lineHeight: 16 },

    stepHeader: { flexDirection: 'row', alignItems: 'center' },
    stepIconBox: { backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    stepTitle: { color: '#0F172A', fontWeight: '900', letterSpacing: -0.5 },
    
    instantBadge: { backgroundColor: '#ECFDF5', borderRadius: 16, borderWidth: 1, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'center' },
    instantIcon: { backgroundColor: '#D1FAE5', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    instantTitle: { color: '#064E3B', fontWeight: '900', marginBottom: 2 },
    instantSubtitle: { color: '#047857', fontWeight: '600', lineHeight: 14 },

    inputLabel: { color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12 },
    inputSuccess: { borderColor: '#34D399', backgroundColor: '#ECFDF5' },
    inputError: { borderColor: '#F87171', backgroundColor: '#FEF2F2' },
    inputText: { flex: 1, color: '#1E293B', fontWeight: '900' },
    errorText: { color: '#EF4444', fontWeight: '700', textAlign: 'center', backgroundColor: '#FEF2F2', paddingVertical: 6, borderRadius: 8 },
    
    instructionText: { color: '#64748b', fontWeight: '500', lineHeight: 16 },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: '700', marginRight: 6 },

    selfieBox: { backgroundColor: '#F8FAFC', borderColor: '#EEF2FF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, alignItems: 'center', justifyContent: 'center' },
    selfiePlaceholder: { width: '100%', height: '100%', backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderRadius: 70 },
    cameraBtn: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    cameraBtnText: { color: 'white', fontWeight: '700', letterSpacing: 1 },

    completedView: { alignItems: 'center' },
    successIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    successIconBlur: { position: 'absolute', backgroundColor: '#34D399', borderRadius: 80, opacity: 0.3 },
    successIconInner: { backgroundColor: '#ECFDF5', borderRadius: 40, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#34D399', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    successTitle: { color: '#0F172A', fontWeight: '900', letterSpacing: -0.5 },
    successSubtitle: { color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: 16 },
    
    certCard: { width: '100%', backgroundColor: '#0F172A', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 5 },
    certRow: { flexDirection: 'row', alignItems: 'center' },
    certIcon: { backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
    certTitle: { color: 'white', fontWeight: '900' },
    certSub: { color: '#94A3B8', fontWeight: '600' },

    modalBg: { flex: 1, backgroundColor: 'black' },
    cameraOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
    cameraOverlayBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
    cameraFrame: { borderColor: 'rgba(52,211,153,0.8)', backgroundColor: 'transparent' },
    cameraPrompt: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    cameraPromptText: { color: 'white', fontWeight: '900', letterSpacing: -0.5 },
    
    cameraControls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
    cameraControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30 },
    cameraCloseBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    shutterBtn: { backgroundColor: 'white', borderRadius: 40, borderColor: 'rgba(52,211,153,0.5)', alignItems: 'center', justifyContent: 'center' },
    shutterBtnInner: { backgroundColor: 'white', borderRadius: 30, borderColor: 'rgba(0,0,0,0.1)' },
    cameraHintText: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 1 }
});
`;

fs.writeFileSync('app/kyc.tsx', code, 'utf8');
console.log('Successfully applied micro styling and decorations to kyc.tsx');
