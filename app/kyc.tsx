import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';

export default function KYCScreen() {
    const [tier, setTier] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<any>(null);

    // Tier 2 State (ID)
    const [idType, setIdType] = useState<'bvn' | 'nin'>('bvn');
    const [idNumber, setIdNumber] = useState('');

    // Tier 3 State (Address)
    const [address, setAddress] = useState('');
    const [utilityBill, setUtilityBill] = useState<string | null>(null);

    // Tier 4 State (Selfie)
    const [selfie, setSelfie] = useState<string | null>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [showCamera, setShowCamera] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    const router = useRouter();

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            // Fetch Profile
            const { data: profile } = await supabase.from('profiles').select('kyc_tier').eq('id', user.id).single();
            if (profile) setTier(profile.kyc_tier || 0);

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
        let ext = uri.substring(uri.lastIndexOf('.') + 1).toLowerCase();
        if (ext === 'jpg') ext = 'jpeg';
        
        const fileName = `${folder}/${Date.now()}.${ext}`;
        const formData = new FormData();
        
        // @ts-ignore
        formData.append('file', {
            uri,
            name: fileName,
            type: `image/${ext}`
        });

        const { data, error } = await supabase.storage.from('kyc-documents').upload(fileName, formData as any, {
            contentType: `image/${ext}`,
        });
        if (error) throw error;
        return data.path;
    };

    const handleSubmit = async (type: 'bvn' | 'nin' | 'utility_bill' | 'liveness', dataPayload: any) => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            let docUrl = null;

            // Handle File Uploads
            if (type === 'utility_bill' && dataPayload.fileUri) {
                docUrl = await uploadFile(dataPayload.fileUri, `bills/${user.id}`);
            } else if (type === 'liveness' && dataPayload.fileUri) {
                docUrl = await uploadFile(dataPayload.fileUri, `liveness/${user.id}`);
            }

            // Create Request
            const { error } = await supabase.from('kyc_requests').insert({
                user_id: user.id,
                document_type: type, // 'bvn', 'nin', 'utility_bill', 'liveness'
                document_number: dataPayload.number || null,
                document_url: docUrl,
                status: 'pending', // FORCE PENDING
                notes: dataPayload.address ? `Address: ${dataPayload.address}` : null
            });

            if (error) throw error;

            Alert.alert("Submitted", "Your verification is pending admin approval.", [{ text: "OK", onPress: fetchStatus }]);

        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setVerifying(false);
        }
    };

    // --- SUBMISSION HANDLERS ---
    const submitTier2 = () => {
        if (!idNumber || idNumber.length < 11) return Alert.alert("Invalid Input", "Please enter valid ID number");
        handleSubmit(idType, { number: idNumber });
    };

    const submitTier3 = () => {
        if (!address || !utilityBill) return Alert.alert("Missing Details", "Address and Utility Bill required");
        handleSubmit('utility_bill', { address, fileUri: utilityBill });
    };

    const submitTier4 = () => {
        if (!selfie) return Alert.alert("Selfie Required", "Please take a selfie");
        handleSubmit('liveness', { fileUri: selfie });
    };

    // --- HELPERS ---
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
        if (!result.canceled) setUtilityBill(result.assets[0].uri);
    };

    const takeSelfie = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
            setSelfie(photo.uri);
            setShowCamera(false);
        }
    };

    if (loading) return <View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator size="large" color="#4F46E5" /></View>;

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* HEADER WITH PREMIUM GRADIENT */}
            <View className="shadow-2xl shadow-indigo-500/30 z-10">
                <LinearGradient 
                    colors={['#4F46E5', '#312E81']} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="pt-16 pb-12 px-6 rounded-b-[40px]"
                >
                    <View className="absolute top-0 right-0 opacity-10">
                        <Ionicons name="shield-checkmark" size={150} color="white" />
                    </View>
                    
                    <View className="flex-row items-center justify-between mb-8">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/20 backdrop-blur-md">
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <View className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-md flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <Text className="text-white font-bold text-xs uppercase tracking-widest">Secure Area</Text>
                        </View>
                    </View>
                    
                    <View>
                        <Text className="text-white text-4xl font-black mb-2 tracking-tight">Verify Identity</Text>
                        <Text className="text-indigo-200 text-base font-medium leading-6 max-w-[80%]">
                            Complete verification to unlock unlimited transactions and global features.
                        </Text>
                    </View>
                </LinearGradient>
            </View>

            <ScrollView className="flex-1 px-6 -mt-10 mb-6 z-20" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                
                {/* MODERN STATUS CARD */}
                <View className="bg-white p-6 rounded-[30px] shadow-sm shadow-slate-200 border border-white/50 mb-8">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Current Level</Text>
                            <Text className="text-slate-900 font-Black text-2xl font-bold">Tier {tier}</Text>
                        </View>
                        <View className={`w-14 h-14 rounded-2xl items-center justify-center ${pendingRequest ? 'bg-orange-50' : 'bg-indigo-50'}`}>
                            <Ionicons 
                                name={pendingRequest ? "time" : "ribbon"} 
                                size={28} 
                                color={pendingRequest ? "#EA580C" : "#4F46E5"} 
                            />
                        </View>
                    </View>
                    
                    {pendingRequest ? (
                        <View className="bg-orange-50/80 p-5 rounded-3xl border border-orange-100/50">
                             <View className="flex-row items-center mb-2">
                                <View className="w-2 h-2 bg-orange-500 rounded-full mr-2" />
                                <Text className="font-bold text-orange-900 text-sm uppercase tracking-wide">In Review</Text>
                             </View>
                             <Text className="text-orange-700/80 text-sm leading-6 font-medium">
                                 Your <Text className="font-bold">{pendingRequest.document_type}</Text> submission is being reviewed by our compliance team. This normally takes 5-10 minutes.
                             </Text>
                        </View>
                    ) : (
                        <View className="flex-row gap-2 mt-2">
                            {[1, 2, 3, 4].map(step => (
                                <View key={step} className={`flex-1 h-2 rounded-full ${tier >= step ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40' : 'bg-slate-100'}`} />
                            ))}
                        </View>
                    )}
                </View>

                {/* CONTENT AREA */}
                {!pendingRequest && (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        
                        {/* TIER 1 -> 2: ID */}
                        {tier < 2 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center">
                                        <Text className="text-white font-bold">1</Text>
                                    </View>
                                    <Text className="font-bold text-slate-900 text-xl">Official ID</Text>
                                </View>
                                
                                <View className="bg-white p-2 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    <View className="flex-row bg-slate-50 p-1.5 rounded-[28px] mb-6">
                                        <TouchableOpacity 
                                            onPress={() => setIdType('bvn')} 
                                            className={`flex-1 py-4 items-center rounded-[24px] ${idType === 'bvn' ? 'bg-white shadow-sm border border-slate-100' : ''}`}
                                        >
                                            <Text className={`font-bold ${idType === 'bvn' ? 'text-indigo-600' : 'text-slate-400'}`}>BVN</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => setIdType('nin')} 
                                            className={`flex-1 py-4 items-center rounded-[24px] ${idType === 'nin' ? 'bg-white shadow-sm border border-slate-100' : ''}`}
                                        >
                                            <Text className={`font-bold ${idType === 'nin' ? 'text-indigo-600' : 'text-slate-400'}`}>NIN</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View className="px-4 pb-4">
                                        <Text className="text-slate-400 text-xs font-bold uppercase ml-2 mb-2">Enter Number</Text>
                                        <TextInput 
                                            className="bg-slate-50 border border-slate-100 rounded-3xl px-6 py-5 mb-6 font-bold text-xl text-slate-800 tracking-widest text-center"
                                            placeholder="000 000 000 00"
                                            placeholderTextColor="#CBD5E1"
                                            value={idNumber}
                                            onChangeText={setIdNumber}
                                            keyboardType="number-pad"
                                            maxLength={11}
                                            selectionColor="#4F46E5"
                                        />
                                        <TouchableOpacity 
                                            onPress={submitTier2} 
                                            disabled={verifying}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={['#1e293b', '#0f172a']}
                                                className="h-16 rounded-[24px] items-center justify-center shadow-xl shadow-slate-900/20"
                                            >
                                                {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Verify Identity</Text>}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* TIER 2 -> 3: ADDRESS */}
                        {tier === 2 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center">
                                        <Text className="text-white font-bold">2</Text>
                                    </View>
                                    <Text className="font-bold text-slate-900 text-xl">Address Proof</Text>
                                </View>

                                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
                                    <Text className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1">Residential Address</Text>
                                    <TextInput 
                                        className="bg-slate-50 border border-slate-200 rounded-3xl px-6 py-5 mb-6 font-semibold text-slate-700 min-h-[100px]"
                                        placeholder="Enter your full home address..."
                                        placeholderTextColor="#94A3B8"
                                        value={address}
                                        onChangeText={setAddress}
                                        multiline
                                        textAlignVertical="top"
                                    />

                                    <Text className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1">Utility Bill Upload</Text>
                                    <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                                        {utilityBill ? (
                                            <View className="h-48 rounded-3xl overflow-hidden mb-6 border border-slate-100 shadow-sm relative">
                                                <Image source={{ uri: utilityBill }} className="w-full h-full" resizeMode="cover" />
                                                <View className="absolute bottom-4 right-4 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
                                                    <Text className="text-white text-xs font-bold">Change Image</Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <View className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 h-48 rounded-3xl items-center justify-center mb-6">
                                                <View className="w-16 h-16 bg-white rounded-full items-center justify-center shadow-sm mb-3">
                                                    <Ionicons name="cloud-upload" size={32} color="#4F46E5" />
                                                </View>
                                                <Text className="text-indigo-900 font-bold">Upload Document</Text>
                                                <Text className="text-indigo-400 text-xs mt-1">PNG, JPG or PDF up to 5MB</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={submitTier3} 
                                        disabled={verifying}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={['#1e293b', '#0f172a']}
                                            className="h-16 rounded-[24px] items-center justify-center shadow-xl shadow-slate-900/20"
                                        >
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Submit Address</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TIER 3 -> 4: SELFIE */}
                        {tier === 3 && (
                            <View>
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View className="w-8 h-8 rounded-full bg-slate-900 items-center justify-center">
                                        <Text className="text-white font-bold">3</Text>
                                    </View>
                                    <Text className="font-bold text-slate-900 text-xl">Liveness Check</Text>
                                </View>

                                <View className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 mb-6 items-center">
                                    <View className="relative mb-8">
                                        <View className="w-48 h-48 bg-slate-50 rounded-full border-8 border-slate-100 shadow-inner items-center justify-center overflow-hidden">
                                            {selfie ? (
                                                <Image source={{ uri: selfie }} className="w-full h-full" />
                                            ) : (
                                                <Ionicons name="person" size={80} color="#E2E8F0" />
                                            )}
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => { requestPermission(); setShowCamera(true); }}
                                            className="absolute bottom-0 right-0 w-14 h-14 bg-indigo-600 rounded-full items-center justify-center border-4 border-white shadow-lg"
                                        >
                                            <Ionicons name="camera" size={24} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <Text className="text-slate-800 font-bold text-lg mb-2 text-center">Take a Selfie</Text>
                                    <Text className="text-slate-400 text-center mb-8 px-4 leading-6">
                                        Make sure your face is clearly visible, well-lit, and without glasses or hats.
                                    </Text>

                                    <TouchableOpacity 
                                        onPress={submitTier4} 
                                        disabled={verifying}
                                        activeOpacity={0.8}
                                        className="w-full"
                                    >
                                        <LinearGradient
                                            colors={['#1e293b', '#0f172a']}
                                            className="h-16 rounded-[24px] items-center justify-center shadow-xl shadow-slate-900/20"
                                        >
                                            {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Complete Verification</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* COMPLETED */}
                        {tier >= 4 && (
                            <View className="items-center py-10">
                                <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6 animate-bounce">
                                    <Ionicons name="shield-checkmark" size={48} color="#16A34A" />
                                </View>
                                <Text className="text-slate-900 font-black text-3xl mb-3">You're Verified!</Text>
                                <Text className="text-slate-500 text-center font-medium px-10 leading-7 text-lg">
                                    Congratulations! You have successfully completed all KYC requirements.
                                </Text>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                )}
            </ScrollView>

            {/* CAMERA MODAL */}
            <Modal visible={showCamera} animationType="slide">
                 <View className="flex-1 bg-black">
                     <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front">
                         <View className="flex-1 items-center justify-center">
                             <View className="w-72 h-96 border-4 border-white/50 rounded-[120px]" />
                             <Text className="text-white font-bold mt-8 bg-black/50 px-6 py-3 rounded-full overflow-hidden">Position face in oval</Text>
                             <TouchableOpacity onPress={takeSelfie} className="absolute bottom-12 w-20 h-20 bg-white rounded-full border-4 border-slate-300 items-center justify-center">
                                <View className="w-16 h-16 bg-white rounded-full border-2 border-black" />
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => setShowCamera(false)} className="absolute top-12 left-6 bg-black/40 p-2 rounded-full">
                                 <Ionicons name="close" size={24} color="white" />
                             </TouchableOpacity>
                         </View>
                     </CameraView>
                 </View>
            </Modal>
        </View>
    );
}
