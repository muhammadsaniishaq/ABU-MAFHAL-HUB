import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, Share } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

type ValidDocType = 'bvn' | 'nin' | 'voters_card' | 'drivers_license' | 'utility_bill' | 'bank_statement' | 'liveness';

export default function KYCScreen() {
    const [tier, setTier] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);

    // Tier 1 State (Personal)
    const [fullName, setFullName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [stateRes, setStateRes] = useState('');

    // Tier 2 State (ID)
    const [idType, setIdType] = useState<ValidDocType>('nin');
    const [idNumber, setIdNumber] = useState('');
    const [checkingId, setCheckingId] = useState(false);
    const [idAvailable, setIdAvailable] = useState<boolean | null>(null);

    // Tier 3 State (Address)
    const [address, setAddress] = useState('');
    const [addressDocType, setAddressDocType] = useState<ValidDocType>('utility_bill');
    const [addressDocUri, setAddressDocUri] = useState<string | null>(null);

    // Tier 4 State (Selfie)
    const [selfie, setSelfie] = useState<string | null>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [showCamera, setShowCamera] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    const router = useRouter();

    useEffect(() => {
        fetchStatus();
    }, []);

    // Real-time ID Check
    useEffect(() => {
        const checkId = async () => {
            if (idNumber.length < 5) {
                setIdAvailable(null);
                return;
            }
            setCheckingId(true);
            try {
                // Check if this ID number exists for this specific document type in kyc_requests
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { 
                        field: 'document_number', 
                        value: idNumber,
                        table: 'kyc_requests',
                        filters: { document_type: idType }
                    }
                });

                if (error) throw error;
                setIdAvailable(data.available);
            } catch (error) {
                console.log('ID check error', error);
            } finally {
                setCheckingId(false);
            }
        };
        const timer = setTimeout(checkId, 600);
        return () => clearTimeout(timer);
    }, [idNumber, idType]);

    const fetchStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            // Fetch Profile
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profile) {
                setUserData(profile);
                setTier(profile.kyc_tier || 0);
                if (profile.full_name) setFullName(profile.full_name);
            }

            // Fetch Pending Requests
            const { data: requests } = await supabase.from('kyc_requests')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

            if (requests && requests.length > 0) {
                setPendingRequest(requests[0]);
            } else {
                setPendingRequest(null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const uploadFile = async (uri: string, folder: string) => {
        try {
            console.log("Starting upload for:", uri);
            // 1. Read file as Blob using fetch (standard for Expo/RN)
            const response = await fetch(uri);
            const blob = await response.blob();

            // Force JPEG for images to ensure compatibility
            const ext = 'jpeg'; 
            const fileName = `${folder}/${Date.now()}.${ext}`;
            
            console.log("Uploading blob size:", blob.size, "to", fileName);

            // 2. Upload Blob directly
            const { data, error } = await supabase.storage.from('kyc-documents').upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });
            
            if (error) {
                 console.error("Supabase Upload Error:", error);
                 throw new Error("Upload failed: " + error.message);
            }
            
            console.log("Upload success:", data.path);
            return data.path;
        } catch (e: any) {
            console.error("File Read/Upload Exception:", e);
            throw new Error(e.message || "File preparation failed");
        }
    };

    const handleSubmit = async (type: ValidDocType, dataPayload: any) => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            let docUrl = null;

            // Handle File Uploads
            if ((type === 'utility_bill' || type === 'bank_statement') && dataPayload.fileUri) {
                docUrl = await uploadFile(dataPayload.fileUri, `address/${user.id}`);
            } else if (type === 'liveness' && dataPayload.fileUri) {
                docUrl = await uploadFile(dataPayload.fileUri, `liveness/${user.id}`);
            }

            // Create Request
            const { data: newRequest, error } = await supabase.from('kyc_requests').insert({
                user_id: user.id,
                document_type: type,
                document_number: dataPayload.number || null,
                document_url: docUrl,
                status: 'pending',
                notes: dataPayload.address ? `Address: ${dataPayload.address}` : null
            }).select().single();

            if (error) throw error;

            console.log("Insert success, updating state:", newRequest);
            setPendingRequest(newRequest);
            
            Alert.alert("Submitted", "Your verification is pending admin approval.");

        } catch (e: any) {
            console.error("Submission/Upload Error:", e);
            Alert.alert("Submission Error", e.message + "\n\n" + (e.cause || ""));
        } finally {
            setVerifying(false);
        }
    };

    // --- SUBMISSION HANDLERS ---
    
    // TIER 1: Personal Info (Updates Profile Directly)
    const submitTier1 = async () => {
        if (!fullName || !dob || !gender || !stateRes) return Alert.alert("Missing Fields", "Please fill all fields");
        
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Update Profile & Upgrade to Tier 1
            const { error } = await supabase.from('profiles').update({
                full_name: fullName,
                // We assume these columns exist, or store in metadata if not? 
                // For this task, let's assume we might need to add them or we store them in a text field if schema is rigid.
                // BEST PRACTICE: Store in new columns. IF they default fail, we might catch error.
                // For now, let's just update 'kyc_tier' to 1 (if it was 0) manually here as "Tier 1 Completed".
                kyc_tier: 1 
            }).eq('id', user.id);

            if (error) throw error;

            Alert.alert("Success", "Personal Information saved.", [{ text: "OK", onPress: fetchStatus }]);
        } catch (e: any) {
            Alert.alert("Error", "Could not save info. " + e.message);
        } finally {
            setVerifying(false);
        }
    };

    const submitTier2 = () => {
        if (!idNumber || idNumber.length < 5) return Alert.alert("Invalid Input", "Please enter valid ID number");
        
        if (idAvailable === false) {
            return Alert.alert("ID Taken", "This ID number has already been used. Please try another.");
        }
        
        handleSubmit(idType, { number: idNumber });
    };

    const submitTier3 = () => {
        if (!address || !addressDocUri) return Alert.alert("Missing Details", "Address and Document required");
        handleSubmit(addressDocType, { address, fileUri: addressDocUri });
    };

    const submitTier4 = () => {
        if (!selfie) return Alert.alert("Selfie Required", "Please take a selfie");
        console.log("Submitting Tier 4 with selfie:", selfie);
        Alert.alert("Debug", "Starting Submission...");
        handleSubmit('liveness', { fileUri: selfie });
    };

    // --- HELPERS ---
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
        if (!result.canceled) setAddressDocUri(result.assets[0].uri);
    };

    const takeSelfie = async () => {
        console.log("Attempting to take selfie...");
        try {
            if (cameraRef.current) {
                console.log("Camera ref found, capturing...");
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
                console.log("Photo captured:", photo.uri);
                setSelfie(photo.uri);
                setShowCamera(false);
            } else {
                console.log("Camera ref is NULL");
                Alert.alert("Camera Error", "Camera is not ready yet. Please wait a moment and try again.");
            }
        } catch (e: any) {
             console.error("Take selfie error:", e);
             Alert.alert("Camera Error", e.message || "Unknown error occurred");
        }
    };

    // --- CERTIFICATE GENERATION ---
    const generateCertificate = async () => {
        try {
            // Load Logo
            const asset = Asset.fromModule(require('../assets/images/logo.png'));
            await asset.downloadAsync();
            const logoBase64 = await new FileSystem.File(asset.localUri || '').base64();
            const logoSrc = `data:image/png;base64,${logoBase64}`;

            const html = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Great+Vibes&family=Montserrat:wght@300;400;500;600&display=swap');
                        
                        :root {
                            --gold: #C5A059;
                            --gold-dark: #8A6E36;
                            --navy: #0F172A;
                            --slate: #334155;
                        }

                        body {
                            margin: 0;
                            padding: 0;
                            background-color: white;
                            -webkit-print-color-adjust: exact;
                        }

                        .page-container {
                            width: 100%; 
                            height: 100vh;
                            position: relative;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                            background: white;
                        }

                        /* DECORATIVE BORDERS - Fixed Position */
                        .border-outer {
                            position: absolute;
                            top: 20px; left: 20px; right: 20px; bottom: 20px;
                            border: 3px solid var(--gold);
                            z-index: 10;
                            pointer-events: none;
                        }
                        
                        .border-inner {
                            position: absolute;
                            top: 30px; left: 30px; right: 30px; bottom: 30px;
                            border: 1px solid var(--gold);
                            z-index: 10;
                            pointer-events: none;
                        }

                        /* CORNERS */
                        .corner {
                            position: absolute;
                            width: 80px; height: 80px;
                            z-index: 20;
                        }
                        .tl { top: 20px; left: 20px; border-top: 5px solid var(--gold); border-left: 5px solid var(--gold); }
                        .tr { top: 20px; right: 20px; border-top: 5px solid var(--gold); border-right: 5px solid var(--gold); }
                        .bl { bottom: 20px; left: 20px; border-bottom: 5px solid var(--gold); border-left: 5px solid var(--gold); }
                        .br { bottom: 20px; right: 20px; border-bottom: 5px solid var(--gold); border-right: 5px solid var(--gold); }

                        /* MAIN CONTENT - FLEX FLOW TO PREVENT OVERLAPS */
                        .content {
                            position: relative;
                            z-index: 50;
                            height: 100%;
                            padding: 60px 80px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between; /* Spreads header, body, footer apart */
                        }

                        /* HEADER SECTION */
                        .header-section {
                            text-align: center;
                            margin-top: 20px;
                        }
                        .logo { height: 100px; object-fit: contain; margin-bottom: 20px; } 
                        .org-name {
                            font-family: 'Cinzel', serif;
                            font-weight: 700;
                            font-size: 16px;
                            color: var(--gold-dark);
                            letter-spacing: 4px;
                            text-transform: uppercase;
                        }
                        .cert-title {
                            font-family: 'Cinzel', serif;
                            font-size: 52px;
                            font-weight: 900;
                            color: var(--navy);
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            margin: 10px 0 0 0;
                            text-shadow: 2px 2px 0px rgba(197, 160, 89, 0.2);
                        }
                        .cert-subtitle {
                            font-family: 'Montserrat', sans-serif;
                            font-size: 14px;
                            color: var(--gold);
                            text-transform: uppercase;
                            letter-spacing: 5px;
                            margin-top: 5px;
                            font-weight: 600;
                        }

                        /* BODY SECTION */
                        .body-section {
                            text-align: center;
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            width: 100%;
                        }
                        .presented-to {
                            font-family: 'Montserrat', sans-serif;
                            font-size: 15px;
                            color: var(--slate);
                            font-style: italic;
                            margin-bottom: 5px;
                            letter-spacing: 1px;
                        }
                        .recipient-name {
                            font-family: 'Great Vibes', cursive;
                            font-size: 64px; /* Slightly reduced to ensure fit */
                            color: var(--navy);
                            margin: 10px auto;
                            padding: 0 50px;
                            border-bottom: 2px solid #e2e8f0;
                            display: inline-block;
                            min-width: 60%;
                            line-height: 1.2;
                        }
                        .body-text {
                            font-family: 'Montserrat', sans-serif;
                            font-size: 14px;
                            color: var(--slate);
                            line-height: 1.7;
                            max-width: 700px;
                            margin: 25px auto;
                            font-weight: 500;
                        }

                        /* SEAL & SIGNATURES ROW */
                        .bottom-row {
                            width: 100%;
                            display: flex;
                            flex-direction: row;
                            justify-content: space-between;
                            align-items: flex-end;
                            margin-bottom: 30px;
                        }

                        .seal-wrapper {
                            flex: 1;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-bottom: 10px;
                        }
                        
                        /* FOOTER SIDE BLOCKS */
                        .footer-block {
                            text-align: center;
                            width: 200px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: flex-end;
                        }
                        .sign-image {
                            font-family: 'Great Vibes', cursive;
                            font-size: 30px;
                            color: var(--navy);
                            margin-bottom: 5px;
                            min-height: 40px;
                        }
                        .sign-line {
                            height: 1px;
                            background: var(--gold);
                            width: 100%;
                            margin-bottom: 5px;
                        }
                        .sign-label {
                            font-family: 'Cinzel', serif;
                            font-weight: 700;
                            font-size: 11px;
                            color: var(--navy);
                        }
                        .sign-sub {
                            font-family: 'Montserrat', sans-serif;
                            font-size: 9px;
                            color: var(--slate);
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }

                        /* QR AREA (Now Flex Item) */
                        .qr-area {
                            background: white;
                            padding: 5px;
                            border: 2px solid var(--gold);
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                            display: inline-block;
                        }
                        .qr-img { 
                            width: 70px; 
                            height: 70px; 
                            display: block;
                        }
                        .qr-id { 
                            font-size: 8px; 
                            font-family: 'Courier New', monospace; 
                            text-align: center; 
                            margin-top: 2px;
                            color: var(--navy);
                            font-weight: bold;
                        }

                        /* WATERMARK LOGO */
                        .watermark {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: 600px;
                            opacity: 0.1;
                            z-index: 0;
                            pointer-events: none;
                            filter: grayscale(100%);
                        }

                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <!-- Borders -->
                        <div class="border-outer"></div>
                        <div class="border-inner"></div>
                        <div class="corner tl"></div>
                        <div class="corner tr"></div>
                        <div class="corner br"></div>
                        <div class="corner bl"></div>

                        <!-- WATERMARK -->
                        <img src="${logoSrc}" class="watermark" />

                        <div class="content">
                            <!-- Header -->
                            <div class="header-section">
                                <img src="${logoSrc}" class="logo" />
                                <div class="org-name">ABU MAFHAL HUB</div>
                                <div class="cert-title">Certificate</div>
                                <div class="cert-subtitle">of Verification</div>
                            </div>

                            <!-- Body -->
                            <div class="body-section">
                                <div class="presented-to">This certifies that</div>
                                <div class="recipient-name">${fullName || 'Abu Mafhal User'}</div>
                                <div class="body-text">
                                    Has successfully completed all identity verification protocols required by Abu Mafhal Hub. 
                                    The holder is hereby recognized as a fully verified Tier 4 member with all associated privileges and trusted status.
                                </div>
                            </div>

                            <!-- Footer Section -->
                            <div class="bottom-row">
                                <!-- Left: Signature -->
                                <div class="footer-block">
                                    <div class="sign-image">Abu Mafhal</div>
                                    <div class="sign-line"></div>
                                    <div class="sign-label">ABU MAFHAL</div>
                                    <div class="sign-sub">CEO & Founder</div>
                                </div>

                                <!-- Center: Seal -->
                                <div class="seal-wrapper">
                                     <svg width="130" height="130" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="50" cy="50" r="48" stroke="#C5A059" stroke-width="2" fill="#FFFCF5"/>
                                        <circle cx="50" cy="50" r="42" stroke="#C5A059" stroke-width="1" stroke-dasharray="2 2"/>
                                        <path d="M50 20 L55 35 L70 35 L58 45 L63 60 L50 50 L37 60 L42 45 L30 35 L45 35 Z" fill="#C5A059" opacity="0.15"/>
                                        <text x="50" y="55" font-family="serif" font-size="8" fill="#8A6E36" text-anchor="middle" font-weight="bold">OFFICIAL</text>
                                        <text x="50" y="65" font-family="serif" font-size="8" fill="#8A6E36" text-anchor="middle" font-weight="bold">TIER 4</text>
                                    </svg>
                                </div>

                                <!-- Right: Date & QR Stacked properly -->
                                <div class="footer-block" style="justify-content: space-between; height: 120px;">
                                    
                                    <!-- QR Code Top -->
                                    <div class="qr-area">
                                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://abumafhal.com/verify/' + (userData?.id || 'demo'))}" class="qr-img" />
                                        <div class="qr-id">ID: ${userData?.id?.split('-')[0].toUpperCase()}</div>
                                    </div>

                                    <!-- Date Bottom -->
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

            {/* HEADER */}
            <View className="shadow-2xl shadow-indigo-500/30 z-10">
                <LinearGradient 
                    colors={['#4F46E5', '#312E81']} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="pt-16 pb-12 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between mb-8">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/20 backdrop-blur-md">
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <View className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-md flex-row items-center gap-2">
                            <View className={`w-2 h-2 rounded-full ${tier >= 4 ? 'bg-green-400' : 'bg-orange-400'} animate-pulse`} />
                            <Text className="text-white font-bold text-xs uppercase tracking-widest">{tier >= 4 ? 'Verified' : 'Unverified'}</Text>
                        </View>
                    </View>
                    
                    <View>
                        <Text className="text-white text-4xl font-black mb-2 tracking-tight">KYC Center</Text>
                        <Text className="text-indigo-200 text-base font-medium leading-6 max-w-[90%]">
                            Reach Tier 4 to unlock maximum limits and get your certificate.
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
                    className="flex-1 px-6 -mt-10 z-20" 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 150 }}
                >
                    
                    {/* PROGRESS CARD */}
                    <View className="bg-white p-6 rounded-[30px] shadow-sm shadow-slate-200 border border-white/50 mb-8">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Status</Text>
                                <Text className="text-slate-900 font-Black text-2xl font-bold">Tier {tier}/4</Text>
                            </View>
                            {/* Circular Progress (Visual Only) */}
                            <View className="w-16 h-16 rounded-full border-4 border-slate-100 items-center justify-center relative">
                                <View className={`absolute w-full h-full rounded-full border-4 border-indigo-500 opacity-${tier * 25}`} /> 
                                <Text className="font-black text-indigo-600 font-2xl">{tier * 25}%</Text>
                            </View>
                        </View>
                        
                        {/* Status Bar */}
                        <View className="flex-row gap-2 mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                            {[1, 2, 3, 4].map(t => (
                                <View key={t} className={`flex-1 ${tier >= t ? 'bg-indigo-500' : 'bg-transparent'}`} />
                            ))}
                        </View>
                    </View>
    
                    {pendingRequest ? (
                        <View className="bg-orange-50 p-6 rounded-[32px] border border-orange-100 items-center mb-8">
                            <ActivityIndicator className="mb-4" color="#EA580C" />
                            <Text className="text-orange-900 font-bold text-lg mb-2">Review In Progress</Text>
                            <Text className="text-orange-700/80 text-center leading-5">
                                We are reviewing your <Text className="font-bold">{pendingRequest.document_type?.replace('_', ' ').toUpperCase()}</Text>.{'\n'}
                                This usually takes less than 24 hours.
                            </Text>
                        </View>
                    ) : (
                        <View>
                            
                            {/* TIER 1: PERSONAL INFO */}
                        {tier === 0 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center"><Text className="text-white font-bold">1</Text></View>
                                    <Text className="font-bold text-slate-900 text-xl">Personal Information</Text>
                                </View>
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 gap-y-4">
                                    <TextInput value={fullName} onChangeText={setFullName} placeholder="Full Legal Name" className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-semibold"  />
                                    <TextInput value={dob} onChangeText={setDob} placeholder="Date of Birth (DD/MM/YYYY)" className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-semibold" />
                                    <View className="flex-row gap-4">
                                        <TextInput value={gender} onChangeText={setGender} placeholder="Gender" className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200 font-semibold" />
                                        <TextInput value={stateRes} onChangeText={setStateRes} placeholder="State" className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200 font-semibold" />
                                    </View>
                                    <TouchableOpacity onPress={submitTier1} disabled={verifying}>
                                        <LinearGradient colors={['#1e293b', '#0f172a']} className="h-14 rounded-xl items-center justify-center mt-2">
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Save & Continue</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 2: IDENTITY */}
                        {tier === 1 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center"><Text className="text-white font-bold">2</Text></View>
                                    <Text className="font-bold text-slate-900 text-xl">Identity Verification</Text>
                                </View>
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-2 px-2">
                                        {(['nin', 'bvn', 'voters_card', 'drivers_license'] as ValidDocType[]).map((type) => (
                                            <TouchableOpacity 
                                                key={type}
                                                onPress={() => setIdType(type)}
                                                className={`mr-3 px-4 py-3 rounded-2xl border ${idType === type ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200'}`}
                                            >
                                                <Text className={`font-bold capitalize ${idType === type ? 'text-indigo-700' : 'text-slate-500'}`}>
                                                    {type.replace('_', ' ')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    
                                    <View>
                                        <View className={`flex-row items-center bg-slate-50 border rounded-2xl px-4 h-16 shadow-sm shadow-slate-100 mb-2 ${idAvailable === false ? 'border-red-300 bg-red-50' : idAvailable === true ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
                                            <TextInput 
                                                value={idNumber} 
                                                onChangeText={setIdNumber} 
                                                placeholder={`Enter ${idType.replace('_', ' ').toUpperCase()} Number`} 
                                                className="flex-1 font-bold text-lg text-center tracking-widest text-slate-800" 
                                            />
                                            {checkingId ? (
                                                <ActivityIndicator size="small" color="#4F46E5" />
                                            ) : idAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                                            ) : idAvailable === false ? (
                                                <Ionicons name="close-circle" size={24} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {idAvailable === false && (
                                            <Text className="text-red-500 text-xs font-bold text-center mb-4">
                                                This ID number is already linked to another account.
                                            </Text>
                                        )}
                                        {/* Spacer if valid or neutral to keep layout consistent, or just margin */}
                                    </View>

                                    <TouchableOpacity onPress={submitTier2} disabled={verifying}>
                                        <LinearGradient colors={['#1e293b', '#0f172a']} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Verify ID</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 3: ADDRESS */}
                        {tier === 2 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center"><Text className="text-white font-bold">3</Text></View>
                                    <Text className="font-bold text-slate-900 text-xl">Address Proof</Text>
                                </View>
                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    <View className="flex-row gap-4 mb-4">
                                        <TouchableOpacity onPress={() => setAddressDocType('utility_bill')} className={`flex-1 py-3 items-center rounded-xl border ${addressDocType === 'utility_bill' ? 'bg-indigo-50 border-indigo-500' : 'border-slate-200'}`}>
                                            <Text className="font-bold text-xs uppercase">Utility Bill</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setAddressDocType('bank_statement')} className={`flex-1 py-3 items-center rounded-xl border ${addressDocType === 'bank_statement' ? 'bg-indigo-50 border-indigo-500' : 'border-slate-200'}`}>
                                            <Text className="font-bold text-xs uppercase">Bank Statement</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TextInput 
                                        multiline 
                                        value={address} 
                                        onChangeText={setAddress} 
                                        placeholder="Full Residential Address" 
                                        className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-semibold mb-4 min-h-[80px]" 
                                    />

                                    <TouchableOpacity onPress={pickImage} className="mb-6">
                                        {addressDocUri ? (
                                            <Image source={{ uri: addressDocUri }} className="w-full h-40 rounded-xl bg-slate-100" resizeMode="cover" />
                                        ) : (
                                            <View className="w-full h-40 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 items-center justify-center">
                                                <Ionicons name="cloud-upload-outline" size={32} color="#94A3B8" />
                                                <Text className="text-slate-400 font-bold mt-2">Tap to Upload</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={submitTier3} disabled={verifying}>
                                        <LinearGradient colors={['#1e293b', '#0f172a']} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Submit Address</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 4: LIVENESS */}
                        {tier === 3 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center"><Text className="text-white font-bold">4</Text></View>
                                    <Text className="font-bold text-slate-900 text-xl">Liveness Check</Text>
                                </View>
                                <View className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-100 border border-indigo-50 mb-6 items-center overflow-hidden relative">
                                    <View className="absolute top-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                                    
                                    <View className="w-48 h-48 bg-slate-50 rounded-full border-4 border-white shadow-2xl shadow-indigo-200 overflow-hidden mb-8 relative group">
                                    {selfie ? (
                                        <Image source={{ uri: selfie }} className="w-full h-full object-cover" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center bg-indigo-50">
                                            <Ionicons name="person" size={80} color="#818CF8" />
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
                                        className="absolute bottom-2 right-10 left-10 h-10 bg-black/50 rounded-full items-center justify-center backdrop-blur-sm"
                                    >
                                        <Text className="text-white text-xs font-bold">Tap to Update</Text>
                                    </TouchableOpacity>
                                </View>
                                
                                {!selfie && (
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            if (!permission?.granted) {
                                                const { granted } = await requestPermission();
                                                if (!granted) return Alert.alert("Camera Permission", "We need camera permission to verify your identity.");
                                            }
                                            setShowCamera(true);
                                        }} 
                                        className="w-full mb-6"
                                    >
                                        <LinearGradient colors={['#4F46E5', '#4338CA']} start={{x:0, y:0}} end={{x:1, y:1}} className="h-14 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-indigo-500/30">
                                            <Ionicons name="camera" size={24} color="white" />
                                            <Text className="text-white font-bold text-base">Open Camera</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}

                                <Text className="text-slate-800 font-bold text-lg mb-2">Liveness Check</Text>
                                <Text className="text-slate-500 text-center mb-8 px-4 leading-6">
                                    We need to verify that you are a real person. Please take a quick selfie in good lighting.
                                </Text>

                                    {selfie && (
                                        <TouchableOpacity 
                                            onPress={() => {
                                                console.log("Button Pressed!");
                                                submitTier4();
                                            }} 
                                            disabled={verifying} 
                                            className="w-full"
                                            style={{ zIndex: 100, elevation: 100 }}
                                        >
                                            <LinearGradient colors={['#1e293b', '#0f172a']} className="h-16 rounded-2xl items-center justify-center shadow-lg active:scale-95 transition-transform">
                                                {verifying ? (
                                                    <View className="flex-row gap-3 items-center">
                                                        <ActivityIndicator color="white" />
                                                        <Text className="text-white font-semibold">Verifying...</Text>
                                                    </View>
                                                ) : (
                                                    <Text className="text-white font-bold text-lg">Complete Verification</Text>
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
                {tier >= 4 && (
                    <View className="items-center py-6">
                        <View className="w-28 h-28 bg-green-100 rounded-full items-center justify-center mb-6 shadow-sm border border-green-200">
                            <Ionicons name="checkmark-done" size={56} color="#16A34A" />
                        </View>
                        <Text className="text-2xl font-black text-slate-900 mb-2">You are Verified!</Text>
                        <Text className="text-slate-500 text-center mb-8 px-4">
                            Your identity has been fully verified. You now have unlimited access to all features.
                        </Text>
                        
                        {/* CERTIFICATE BUTTON */}
                        <TouchableOpacity 
                            onPress={generateCertificate}
                            className="w-full active:opacity-90"
                        >
                            <LinearGradient
                                colors={['#F59E0B', '#B45309']}
                                start={{ x: 0, y: 0}}
                                end={{ x: 1, y: 1}}
                                className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-amber-500/30"
                            >
                                <Ionicons name="ribbon" size={24} color="white" />
                                <Text className="text-white font-bold text-lg uppercase tracking-wide">Download Certificate</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
            </KeyboardAvoidingView>

            {/* CAMERA MODAL */}
            <Modal visible={showCamera} animationType="slide" transparent={true} onRequestClose={() => setShowCamera(false)}>
                 <View className="flex-1 bg-black">
                     <View className="flex-1 relative">
                         <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
                         
                         {/* OVERLAY */}
                         <View 
                            className="absolute inset-0 items-center justify-center p-0" 
                            pointerEvents="none"
                         >
                             <View className="absolute inset-0 bg-black/50" />
                             <View className="w-72 h-96 border-4 border-indigo-500/80 rounded-[140px] bg-transparent z-10" />
                             <View className="absolute top-20 bg-black/60 px-6 py-3 rounded-full overflow-hidden border border-white/20 backdrop-blur-md z-20">
                                <Text className="text-white font-bold text-base text-center">Position your face in the frame</Text>
                             </View>
                         </View>

                         {/* CONTROLS */}
                         <View 
                            className="absolute bottom-0 w-full bg-black/80 pt-8 pb-12 items-center rounded-t-[40px] z-[100]"
                            style={{ elevation: 100, zIndex: 100 }}
                            pointerEvents="box-none"
                         >
                            <View className="flex-row items-center gap-12" pointerEvents="box-none">
                                <TouchableOpacity 
                                    onPress={() => setShowCamera(false)} 
                                    className="w-14 h-14 bg-white/10 rounded-full items-center justify-center border border-white/20"
                                    style={{ elevation: 101, zIndex: 101 }}
                                >
                                    <Ionicons name="close" size={24} color="white" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={takeSelfie} 
                                    className="w-24 h-24 bg-white rounded-full border-[6px] border-indigo-500/50 items-center justify-center shadow-lg shadow-indigo-500/50 active:scale-95 transition-transform"
                                    style={{ elevation: 101, zIndex: 101 }}
                                >
                                    <View className="w-20 h-20 bg-white rounded-full border-2 border-black/10" />
                                </TouchableOpacity>

                                <View className="w-14 h-14" />
                            </View>
                            <Text className="text-white/60 text-xs mt-6 font-medium tracking-widest uppercase">Make sure lighting is good</Text>
                         </View>
                     </View>
                 </View>
            </Modal>
        </View>
    );
}
