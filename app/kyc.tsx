import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

type ValidDocType = 'bvn' | 'nin';

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

    // --- INITIAL DATA LOAD ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setUserData(profile);
            
            // For this flow, we will compute tier dynamically based on what's missing, or just rely on profile.kyc_tier
            // Let's rely on kyc_tier directly if possible, or build custom mapping
            // In the new 3-step system:
            // kyc_tier 0: Needs BVN
            // kyc_tier 1: Needs NIN
            // kyc_tier 2: Needs Biometric
            // kyc_tier 3: Fully Verified
            
            // Check pending requests
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
            Alert.alert("Error", "Could not load KYC data");
        } finally {
            setLoading(false);
        }
    };

    // --- BVN AVAILABILITY CHECK ---
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
                if (error) throw error;
                setBvnAvailable(data.available);
            } catch (e) {
                console.error(e);
            } finally {
                setCheckingBvn(false);
            }
        };
        const timer = setTimeout(checkBvn, 500);
        return () => clearTimeout(timer);
    }, [bvn]);

    // --- NIN AVAILABILITY CHECK ---
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
                if (error) throw error;
                setNinAvailable(data.available);
            } catch (e) {
                console.error(e);
            } finally {
                setCheckingNin(false);
            }
        };
        const timer = setTimeout(checkNin, 500);
        return () => clearTimeout(timer);
    }, [nin]);

    // --- SUBMISSION HELPERS ---
    const handleSubmit = async (docType: string, payload: any) => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            let fileUrl = null;

            // Handle file upload (Selfie)
            if (payload.fileUri) {
                const fileExt = payload.fileUri.split('.').pop();
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

            // AUTO-APPROVAL LOGIC FOR BVN AND NIN
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
                // Determine new tier
                const newTier = docType === 'bvn' ? 1 : 2;
                const updatePayload: any = { kyc_tier: newTier };
                if (docType === 'bvn') updatePayload.bvn = payload.idNumber;
                if (docType === 'nin') updatePayload.nin = payload.idNumber;

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update(updatePayload)
                    .eq('id', user.id);

                if (profileError) throw profileError;

                Alert.alert("Verified!", `Your ${docType.toUpperCase()} has been instantly verified!`);
                
                // Fetch latest state immediately
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

    // --- STEP ACTIONS ---
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

    // --- CAMERA ACTIONS ---
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

    // --- CERTIFICATE GENERATION ---
    const generateCertificate = async () => {
        try {
            const asset = Asset.fromModule(require('../assets/images/logo.png'));
            await asset.downloadAsync();
            const logoBase64 = await FileSystem.readAsStringAsync(asset.localUri || '', { encoding: 'base64' });
            const logoSrc = `data:image/png;base64,${logoBase64}`;

            const html = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Great+Vibes&family=Montserrat:wght@300;400;500;600&display=swap');
                        
                        :root { --gold: #C5A059; --gold-dark: #8A6E36; --navy: #0F172A; --slate: #334155; }
                        body { margin: 0; padding: 0; background-color: white; -webkit-print-color-adjust: exact; }
                        .page-container { width: 100%; height: 100vh; position: relative; overflow: hidden; display: flex; flex-direction: column; background: white; }
                        .border-outer { position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; border: 3px solid var(--gold); z-index: 10; pointer-events: none; }
                        .border-inner { position: absolute; top: 30px; left: 30px; right: 30px; bottom: 30px; border: 1px solid var(--gold); z-index: 10; pointer-events: none; }
                        .corner { position: absolute; width: 80px; height: 80px; z-index: 20; }
                        .tl { top: 20px; left: 20px; border-top: 5px solid var(--gold); border-left: 5px solid var(--gold); }
                        .tr { top: 20px; right: 20px; border-top: 5px solid var(--gold); border-right: 5px solid var(--gold); }
                        .bl { bottom: 20px; left: 20px; border-bottom: 5px solid var(--gold); border-left: 5px solid var(--gold); }
                        .br { bottom: 20px; right: 20px; border-bottom: 5px solid var(--gold); border-right: 5px solid var(--gold); }
                        .content { position: relative; z-index: 50; height: 100%; padding: 60px 80px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
                        .header-section { text-align: center; margin-top: 20px; }
                        .logo { height: 100px; object-fit: contain; margin-bottom: 20px; } 
                        .org-name { font-family: 'Cinzel', serif; font-weight: 700; font-size: 16px; color: var(--gold-dark); letter-spacing: 4px; text-transform: uppercase; }
                        .cert-title { font-family: 'Cinzel', serif; font-size: 52px; font-weight: 900; color: var(--navy); text-transform: uppercase; letter-spacing: 2px; margin: 10px 0 0 0; text-shadow: 2px 2px 0px rgba(197, 160, 89, 0.2); }
                        .cert-subtitle { font-family: 'Montserrat', sans-serif; font-size: 14px; color: var(--gold); text-transform: uppercase; letter-spacing: 5px; margin-top: 5px; font-weight: 600; }
                        .body-section { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; }
                        .presented-to { font-family: 'Montserrat', sans-serif; font-size: 15px; color: var(--slate); font-style: italic; margin-bottom: 5px; letter-spacing: 1px; }
                        .recipient-name { font-family: 'Great Vibes', cursive; font-size: 64px; color: var(--navy); margin: 10px auto; padding: 0 50px; border-bottom: 2px solid #e2e8f0; display: inline-block; min-width: 60%; line-height: 1.2; }
                        .body-text { font-family: 'Montserrat', sans-serif; font-size: 14px; color: var(--slate); line-height: 1.7; max-width: 700px; margin: 25px auto; font-weight: 500; }
                        .bottom-row { width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; }
                        .seal-wrapper { flex: 1; display: flex; justify-content: center; align-items: center; margin-bottom: 10px; }
                        .footer-block { text-align: center; width: 200px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
                        .sign-image { font-family: 'Great Vibes', cursive; font-size: 30px; color: var(--navy); margin-bottom: 5px; min-height: 40px; }
                        .sign-line { height: 1px; background: var(--gold); width: 100%; margin-bottom: 5px; }
                        .sign-label { font-family: 'Cinzel', serif; font-weight: 700; font-size: 11px; color: var(--navy); }
                        .sign-sub { font-family: 'Montserrat', sans-serif; font-size: 9px; color: var(--slate); text-transform: uppercase; letter-spacing: 1px; }
                        .qr-area { background: white; padding: 5px; border: 2px solid var(--gold); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: inline-block; }
                        .qr-img { width: 70px; height: 70px; display: block; }
                        .qr-id { font-size: 8px; font-family: 'Courier New', monospace; text-align: center; margin-top: 2px; color: var(--navy); font-weight: bold; }
                        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; opacity: 0.1; z-index: 0; pointer-events: none; filter: grayscale(100%); }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="border-outer"></div>
                        <div class="border-inner"></div>
                        <div class="corner tl"></div>
                        <div class="corner tr"></div>
                        <div class="corner br"></div>
                        <div class="corner bl"></div>
                        <img src="${logoSrc}" class="watermark" />
                        <div class="content">
                            <div class="header-section">
                                <img src="${logoSrc}" class="logo" />
                                <div class="org-name">ABU MAFHAL SUB</div>
                                <div class="cert-title">Certificate</div>
                                <div class="cert-subtitle">of Verification</div>
                            </div>
                            <div class="body-section">
                                <div class="presented-to">This certifies that</div>
                                <div class="recipient-name">${userData?.full_name || 'Abu Mafhal User'}</div>
                                <div class="body-text">
                                    Has successfully completed all identity verification protocols required by Abu Mafhal Sub. 
                                    The holder is hereby recognized as a fully verified member with all associated privileges and trusted status.
                                </div>
                            </div>
                            <div class="bottom-row">
                                <div class="footer-block">
                                    <div class="sign-image">Abu Mafhal</div>
                                    <div class="sign-line"></div>
                                    <div class="sign-label">ABU MAFHAL</div>
                                    <div class="sign-sub">CEO & Founder</div>
                                </div>
                                <div class="seal-wrapper">
                                     <svg width="130" height="130" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="50" cy="50" r="48" stroke="#C5A059" stroke-width="2" fill="#FFFCF5"/>
                                        <circle cx="50" cy="50" r="42" stroke="#C5A059" stroke-width="1" stroke-dasharray="2 2"/>
                                        <path d="M50 20 L55 35 L70 35 L58 45 L63 60 L50 50 L37 60 L42 45 L30 35 L45 35 Z" fill="#C5A059" opacity="0.15"/>
                                        <text x="50" y="55" font-family="serif" font-size="8" fill="#8A6E36" text-anchor="middle" font-weight="bold">OFFICIAL</text>
                                        <text x="50" y="65" font-family="serif" font-size="8" fill="#8A6E36" text-anchor="middle" font-weight="bold">VERIFIED</text>
                                    </svg>
                                </div>
                                <div class="footer-block" style="justify-content: space-between; height: 120px;">
                                    <div class="qr-area">
                                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://abumafhal.com.ng/verify/' + (userData?.id || 'demo'))}" class="qr-img" />
                                        <div class="qr-id">ID: ${userData?.id?.split('-')[0].toUpperCase()}</div>
                                    </div>
                                    <div style="width: 100%; margin-top: 15px;">
                                        <div class="sign-image" style="font-size: 18px; min-height: 20px;">${new Date().toLocaleDateString('en-GB')}</div>
                                        <div class="sign-line"></div>
                                        <div class="sign-label">DATE ISSUED</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error: any) {
            Alert.alert("Error", "Could not generate certificate: " + error.message);
        }
    };

    if (loading) return <View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator size="large" color="#4F46E5" /></View>;

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* MODERN HEADER */}
            <View className="shadow-2xl shadow-indigo-500/20 z-10">
                <LinearGradient 
                    colors={['#0F172A', '#1E293B']} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="pt-16 pb-12 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between mb-8">
                        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/10 backdrop-blur-md">
                            <Ionicons name="chevron-back" size={24} color="white" />
                        </TouchableOpacity>
                        <View className="bg-white/5 px-5 py-2 rounded-full border border-white/10 backdrop-blur-md flex-row items-center gap-2">
                            <View className={`w-2 h-2 rounded-full ${tier >= 3 ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                            <Text className="text-white font-bold text-xs uppercase tracking-widest">{tier >= 3 ? 'Verified' : 'Unverified'}</Text>
                        </View>
                    </View>
                    
                    <View>
                        <Text className="text-white text-4xl font-black mb-2 tracking-tight">KYC Center</Text>
                        <Text className="text-slate-400 text-sm font-medium leading-6 max-w-[90%]">
                            Complete 3 simple steps to unlock maximum limits and your official certificate.
                        </Text>
                    </View>
                </LinearGradient>
            </View>
            
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView 
                    className="flex-1 px-6 -mt-8 z-20" 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 150 }}
                >
                    
                    {/* PROGRESS CARD (3 Steps) */}
                    <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-8 mt-2">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Current Progress</Text>
                                <Text className="text-slate-900 font-black text-2xl">Step {Math.min(tier + 1, 3)} of 3</Text>
                            </View>
                            {/* Modern Circular Progress */}
                            <View className="w-16 h-16 rounded-full bg-indigo-50 items-center justify-center border border-indigo-100 shadow-sm">
                                <Text className="font-black text-indigo-600 text-xl">{Math.floor((tier / 3) * 100)}%</Text>
                            </View>
                        </View>
                        
                        {/* Stepper Dots (3 Steps: BVN, NIN, Liveness) */}
                        <View className="flex-row justify-between items-center px-4">
                            {[1, 2, 3].map((t, index) => (
                                <View key={t} className="flex-row items-center flex-1 justify-center">
                                    <View className={`w-12 h-12 rounded-full items-center justify-center border-2 ${tier >= t ? 'bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/30' : tier + 1 === t ? 'bg-white border-indigo-500' : 'bg-slate-50 border-slate-200'}`}>
                                        {tier >= t ? (
                                            <Ionicons name="checkmark" size={20} color="white" />
                                        ) : (
                                            <Text className={`font-bold ${tier + 1 === t ? 'text-indigo-600' : 'text-slate-400'}`}>{t}</Text>
                                        )}
                                    </View>
                                    {index < 2 && (
                                        <View className={`flex-1 h-1 mx-2 rounded-full ${tier > t ? 'bg-indigo-500' : 'bg-slate-100'}`} />
                                    )}
                                </View>
                            ))}
                        </View>
                        
                        <View className="flex-row justify-between mt-3 px-2">
                            <Text className={`text-[10px] font-bold uppercase ${tier >= 0 ? 'text-indigo-600' : 'text-slate-400'}`}>BVN</Text>
                            <Text className={`text-[10px] font-bold uppercase ${tier >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}>NIN</Text>
                            <Text className={`text-[10px] font-bold uppercase ${tier >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}>Biometric</Text>
                        </View>
                    </View>
    
                    {pendingRequest ? (
                        <View className="bg-amber-50 p-8 rounded-[32px] border border-amber-100 items-center mb-8 shadow-sm">
                            <View className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-md shadow-amber-200/50 mb-6">
                                <ActivityIndicator size="large" color="#F59E0B" />
                            </View>
                            <Text className="text-amber-900 font-black text-2xl mb-3 text-center">Review In Progress</Text>
                            <Text className="text-amber-700/80 text-center leading-6 font-medium text-base">
                                We are carefully reviewing your <Text className="font-bold text-amber-900">{pendingRequest.document_type?.replace('_', ' ').toUpperCase()}</Text>.{'\n'}
                                This usually takes less than 24 hours.
                            </Text>
                        </View>
                    ) : (
                        <View>
                            
                        {/* STEP 1: BVN (Auto virtual account) */}
                        {tier === 0 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="card" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">BVN Verification</Text>
                                </View>
                                
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    
                                    {/* INSTANT VERIFICATION BADGE */}
                                    <View className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-200/50 mb-6 flex-row items-center gap-4">
                                        <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center shadow-sm shadow-emerald-200/50">
                                            <Ionicons name="flash" size={24} color="#059669" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-emerald-900 font-black text-base tracking-tight mb-0.5">Instant Virtual Account</Text>
                                            <Text className="text-emerald-700/80 text-xs font-bold leading-5">Submitting your BVN instantly unlocks and creates your Virtual Account!</Text>
                                        </View>
                                    </View>
                                    
                                    <View className="mb-8">
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Enter 11-Digit BVN</Text>
                                        <View className={`flex-row items-center bg-slate-50 border-2 rounded-2xl px-5 h-16 transition-colors ${bvnAvailable === false ? 'border-red-400 bg-red-50' : bvnAvailable === true ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 focus:border-indigo-500'}`}>
                                            <Ionicons name="keypad" size={20} color="#94A3B8" className="mr-3" />
                                            <TextInput 
                                                value={bvn} 
                                                onChangeText={setBvn} 
                                                placeholder="00000000000" 
                                                className="flex-1 font-black text-xl tracking-[0.2em] text-slate-800" 
                                                keyboardType="numeric"
                                                maxLength={11}
                                            />
                                            {checkingBvn ? (
                                                <ActivityIndicator size="small" color="#4F46E5" />
                                            ) : bvnAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={24} color="#059669" />
                                            ) : bvnAvailable === false ? (
                                                <Ionicons name="close-circle" size={24} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {bvnAvailable === false && (
                                            <Text className="text-red-500 text-xs font-bold text-center mt-3 bg-red-50 py-2 rounded-lg">
                                                This BVN is already linked to another account.
                                            </Text>
                                        )}
                                    </View>

                                    <TouchableOpacity onPress={submitBVN} disabled={verifying} className="active:scale-95 transition-transform">
                                        <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-slate-900/20">
                                            {verifying ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Text className="text-white font-bold text-lg">Verify BVN Now</Text>
                                                    <Ionicons name="arrow-forward" size={20} color="white" />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* STEP 2: NIN */}
                        {tier === 1 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="document-text" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">NIN Verification</Text>
                                </View>
                                
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    <Text className="text-slate-500 font-medium text-sm mb-6 leading-6 px-2">
                                        Please provide your National Identification Number (NIN) to proceed to the final step.
                                    </Text>
                                    
                                    <View className="mb-8">
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Enter 11-Digit NIN</Text>
                                        <View className={`flex-row items-center bg-slate-50 border-2 rounded-2xl px-5 h-16 transition-colors ${ninAvailable === false ? 'border-red-400 bg-red-50' : ninAvailable === true ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 focus:border-indigo-500'}`}>
                                            <Ionicons name="keypad" size={20} color="#94A3B8" className="mr-3" />
                                            <TextInput 
                                                value={nin} 
                                                onChangeText={setNin} 
                                                placeholder="00000000000" 
                                                className="flex-1 font-black text-xl tracking-[0.2em] text-slate-800" 
                                                keyboardType="numeric"
                                                maxLength={11}
                                            />
                                            {checkingNin ? (
                                                <ActivityIndicator size="small" color="#4F46E5" />
                                            ) : ninAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={24} color="#059669" />
                                            ) : ninAvailable === false ? (
                                                <Ionicons name="close-circle" size={24} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {ninAvailable === false && (
                                            <Text className="text-red-500 text-xs font-bold text-center mt-3 bg-red-50 py-2 rounded-lg">
                                                This NIN is already linked to another account.
                                            </Text>
                                        )}
                                    </View>

                                    <TouchableOpacity onPress={submitNIN} disabled={verifying} className="active:scale-95 transition-transform">
                                        <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-slate-900/20">
                                            {verifying ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Text className="text-white font-bold text-lg">Verify NIN</Text>
                                                    <Ionicons name="arrow-forward" size={20} color="white" />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* STEP 3: LIVENESS (Biometric) */}
                        {tier === 2 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center"><Ionicons name="scan" size={20} color="#4F46E5" /></View>
                                    <Text className="font-black text-slate-900 text-2xl tracking-tight">Biometric Check</Text>
                                </View>
                                <View className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-100/50 border border-slate-100 mb-6 items-center relative">
                                    
                                    <Text className="text-slate-500 font-medium text-center mb-8 px-2 leading-6">
                                        We need to verify that you are a real person. Please take a quick selfie in good lighting.
                                    </Text>
                                    
                                    <View className="w-56 h-56 rounded-[100px] bg-slate-50 border-8 border-indigo-50 shadow-inner overflow-hidden mb-8 relative justify-center items-center">
                                    {selfie ? (
                                        <Image source={{ uri: selfie }} className="w-full h-full object-cover" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100">
                                            <Ionicons name="person" size={80} color="#CBD5E1" />
                                        </View>
                                    )}
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            if (!permission?.granted) {
                                                const { granted } = await requestPermission();
                                                if (!granted) return Alert.alert("Camera Permission", "We need camera permission to verify your identity.");
                                            }
                                            setShowCamera(true);
                                        }} 
                                        className="absolute bottom-4 right-12 left-12 h-10 bg-black/60 rounded-full items-center justify-center backdrop-blur-md"
                                    >
                                        <Text className="text-white text-xs font-bold uppercase tracking-widest">{selfie ? 'Retake' : 'Open Camera'}</Text>
                                    </TouchableOpacity>
                                </View>

                                    {selfie && (
                                        <TouchableOpacity 
                                            onPress={() => {
                                                submitLiveness();
                                            }} 
                                            disabled={verifying} 
                                            className="w-full active:scale-95 transition-transform"
                                        >
                                            <LinearGradient colors={['#0F172A', '#1E293B']} className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-slate-900/20">
                                                {verifying ? (
                                                    <>
                                                        <ActivityIndicator color="white" />
                                                        <Text className="text-white font-semibold">Verifying...</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Text className="text-white font-bold text-lg">Complete KYC</Text>
                                                        <Ionicons name="checkmark-circle" size={20} color="white" />
                                                    </>
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
                    <View className="items-center py-8">
                        <View className="relative mb-8">
                            <View className="absolute inset-0 bg-emerald-400 blur-2xl opacity-40 rounded-full scale-150 animate-pulse" />
                            <View className="w-32 h-32 bg-gradient-to-br from-emerald-100 to-green-50 rounded-full items-center justify-center shadow-xl shadow-emerald-200/50 border-4 border-white relative z-10">
                                <Ionicons name="checkmark-done" size={64} color="#059669" />
                            </View>
                        </View>
                        <Text className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Fully Verified!</Text>
                        <Text className="text-slate-500 font-medium text-center text-base mb-10 px-4 leading-6">
                            Your identity has been fully verified. You now have unlimited access to all features and higher transaction limits.
                        </Text>
                        
                        {/* CERTIFICATE PREVIEW CARD */}
                        <View className="w-full bg-slate-900 p-6 rounded-[32px] mb-8 shadow-2xl shadow-slate-900/40 relative overflow-hidden">
                            <View className="absolute top-0 right-0 w-40 h-40 bg-amber-500/20 blur-3xl rounded-full" />
                            <View className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full" />
                            
                            <View className="flex-row items-center gap-4 mb-6 relative z-10">
                                <View className="w-12 h-12 bg-amber-500/20 rounded-full items-center justify-center border border-amber-500/30">
                                    <Ionicons name="ribbon" size={24} color="#F59E0B" />
                                </View>
                                <View>
                                    <Text className="text-white font-black text-lg">Official Certificate</Text>
                                    <Text className="text-slate-400 font-medium text-xs">Fully Verified Status</Text>
                                </View>
                            </View>
                            
                            <TouchableOpacity 
                                onPress={generateCertificate}
                                className="w-full active:scale-95 transition-transform relative z-10"
                            >
                                <LinearGradient
                                    colors={['#F59E0B', '#D97706']}
                                    start={{ x: 0, y: 0}}
                                    end={{ x: 1, y: 1}}
                                    className="h-14 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-amber-500/30"
                                >
                                    <Text className="text-white font-black uppercase tracking-widest text-sm">Download PDF</Text>
                                    <Ionicons name="cloud-download" size={18} color="white" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
            </KeyboardAvoidingView>

            {/* CAMERA MODAL */}
            <Modal visible={showCamera} animationType="fade" transparent={true} onRequestClose={() => setShowCamera(false)}>
                 <View className="flex-1 bg-black">
                     <View className="flex-1 relative">
                         <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
                         
                         {/* OVERLAY */}
                         <View 
                            className="absolute inset-0 items-center justify-center p-0" 
                            pointerEvents="none"
                         >
                             <View className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                             <View className="w-80 h-[400px] border-4 border-emerald-400/80 rounded-[160px] bg-transparent z-10 relative overflow-hidden shadow-[0_0_50px_rgba(52,211,153,0.3)]">
                                {/* Scanning line animation simulation */}
                                <View className="absolute top-0 w-full h-1 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)] opacity-50" style={{ transform: [{translateY: 200}] }} />
                             </View>
                             <View className="absolute top-24 bg-black/80 px-8 py-4 rounded-full overflow-hidden border border-white/10 backdrop-blur-md z-20">
                                <Text className="text-white font-black text-lg text-center tracking-tight">Position your face inside</Text>
                             </View>
                         </View>

                         {/* CONTROLS */}
                         <View 
                            className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-20 pb-12 items-center z-[100]"
                            style={{ elevation: 100, zIndex: 100 }}
                            pointerEvents="box-none"
                         >
                            <View className="flex-row items-center gap-12" pointerEvents="box-none">
                                <TouchableOpacity 
                                    onPress={() => setShowCamera(false)} 
                                    className="w-14 h-14 bg-white/10 rounded-full items-center justify-center border border-white/20 backdrop-blur-md"
                                >
                                    <Ionicons name="close" size={24} color="white" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={takeSelfie} 
                                    className="w-24 h-24 bg-white rounded-full border-[6px] border-emerald-500/50 items-center justify-center shadow-2xl shadow-emerald-500/50 active:scale-95 transition-transform"
                                >
                                    <View className="w-20 h-20 bg-white rounded-full border-2 border-black/10" />
                                </TouchableOpacity>

                                <View className="w-14 h-14" />
                            </View>
                            <Text className="text-white/60 text-xs mt-8 font-bold tracking-[0.2em] uppercase">Ensure good lighting</Text>
                         </View>
                     </View>
                 </View>
            </Modal>
        </View>
    );
}
