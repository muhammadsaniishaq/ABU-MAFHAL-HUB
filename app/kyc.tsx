import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../services/supabase';

export default function KYCScreen() {
    const [tier, setTier] = useState<number>(1);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [idNumber, setIdNumber] = useState('');
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const router = useRouter();

    const tiers = [
        { level: 1, limit: '₦50,000', req: 'Email & Phone Verified' },
        { level: 2, limit: '₦500,000', req: 'BVN / NIN' },
        { level: 3, limit: 'Unlimited', req: 'ID Card & Utility Bill' },
    ];

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get Profile Tier
            const { data: profile } = await supabase
                .from('profiles')
                .select('kyc_tier')
                .eq('id', user.id)
                .single();

            if (profile) setTier(profile.kyc_tier);

            // Check for pending requests
            const { data: request } = await supabase
                .from('kyc_requests')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .maybeSingle(); // Use maybeSingle to avoid error if none

            setPendingRequest(request);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const uploadToSupabase = async (uri: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const filePath = `${user.id}/${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
            .from('kyc-documents')
            .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

        if (error) throw error;

        // Get public URL (or signed URL if private)
        const { data: { publicUrl } } = supabase.storage
            .from('kyc-documents')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const submitKYC = async () => {
        if (!image || !idNumber) {
            Alert.alert('Missing Information', 'Please provide both an ID number and upload a document.');
            return;
        }

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const imageUrl = await uploadToSupabase(image);

            const { error } = await supabase
                .from('kyc_requests')
                .insert({
                    user_id: user.id,
                    document_type: tier === 1 ? 'nin' : 'passport', // Simplification for logic
                    document_url: imageUrl,
                    status: 'pending' // pending review
                });

            if (error) throw error;

            Alert.alert('Success', 'Your KYC request has been submitted for review.');
            fetchStatus();
            setImage(null);
            setIdNumber('');
        } catch (error: any) {
            Alert.alert('Submission Failed', error.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator color="#0056D2" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Identity Verification', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="flex-1">
                {/* Header Status */}
                <View className="bg-blue-600 px-6 pt-6 pb-12 rounded-b-[40px] shadow-lg">
                    <Text className="text-blue-100 font-bold text-center uppercase text-xs mb-2">Current Level</Text>
                    <Text className="text-white font-black text-center text-4xl mb-1">Tier {tier}</Text>
                    <Text className="text-blue-200 text-center text-sm font-medium">Limit: {tiers[tier - 1].limit}</Text>
                </View>

                <View className="px-6 -mt-8">
                    <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <Text className="font-bold text-slate-800 text-lg mb-4">Required Actions</Text>

                        {pendingRequest ? (
                            <View className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center">
                                    <Ionicons name="time" size={20} color="#EA580C" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-slate-800 text-sm">Verification in Progress</Text>
                                    <Text className="text-slate-500 text-xs mt-1">Our team is reviewing your documents. This usually takes 24 hours.</Text>
                                </View>
                            </View>
                        ) : tier >= 3 ? (
                            <View className="items-center py-4">
                                <Ionicons name="checkmark-circle" size={48} color="#107C10" />
                                <Text className="text-green-700 font-bold text-lg mt-2">All Verified!</Text>
                                <Text className="text-gray-500 text-center text-sm">You have reached the maximum tier.</Text>
                            </View>
                        ) : (
                            <View>
                                <Text className="text-slate-500 text-sm mb-6">Upgrade to Tier {tier + 1} to increase your transaction limits.</Text>

                                <Text className="font-bold text-slate-700 mb-2">Government ID / NIN</Text>
                                <TextInput
                                    placeholder="Enter your BVN or NIN Number"
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-12 mb-6 text-slate-800"
                                    value={idNumber}
                                    onChangeText={setIdNumber}
                                />

                                <Text className="font-bold text-slate-700 mb-2">Upload Document</Text>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 items-center justify-center mb-8 bg-gray-50 active:bg-gray-100"
                                >
                                    {image ? (
                                        <Image source={{ uri: image }} className="w-full h-40 rounded-lg" resizeMode="cover" />
                                    ) : (
                                        <>
                                            <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mb-2">
                                                <Ionicons name="cloud-upload" size={24} color="#3B82F6" />
                                            </View>
                                            <Text className="text-slate-600 font-medium">Tap to upload ID Card</Text>
                                            <Text className="text-slate-400 text-xs mt-1">JPG or PNG, max 5MB</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className={`bg-blue-600 h-14 rounded-full items-center justify-center shadow-lg shadow-blue-600/30 ${uploading ? 'opacity-70' : ''}`}
                                    onPress={submitKYC}
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg">Submit Verification</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
