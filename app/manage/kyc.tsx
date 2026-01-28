import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function KYCQueue() {
    const [kycQueue, setKycQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvedToday, setApprovedToday] = useState(0);
    const [viewingDoc, setViewingDoc] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(false);

    useEffect(() => {
        fetchKYC();
    }, []);

    const fetchKYC = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('kyc_requests')
                .select('*, profiles(full_name, kyc_tier)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setKycQueue(data || []);

            // Fetch approved today count
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { count } = await supabase
                .from('kyc_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .gte('created_at', startOfDay.toISOString());

            setApprovedToday(count || 0);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (request: any, status: 'approved' | 'rejected') => {
        try {
            // 1. Update Request Status
            const { error: reqError } = await supabase
                .from('kyc_requests')
                .update({ status })
                .eq('id', request.id);

            if (reqError) throw reqError;

            // 2. If Approved, Upgrade User Tier
            if (status === 'approved') {
                let newTier = request.profiles?.kyc_tier || 1;
                
                // Logic based on document type
                switch (request.document_type) {
                    case 'bvn':
                    case 'nin':
                        if (newTier < 2) newTier = 2;
                        break;
                    case 'utility_bill':
                        if (newTier < 3) newTier = 3;
                        break;
                    case 'liveness':
                        if (newTier < 4) newTier = 4;
                        break;
                    default:
                        // Fallback or unknown
                        break;
                }

                // Only update if tier increases
                if (newTier > (request.profiles?.kyc_tier || 0)) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ kyc_tier: newTier })
                        .eq('id', request.user_id);

                    if (profileError) {
                        Alert.alert('Warning', 'Request approved but failed to upgrade user tier: ' + profileError.message);
                    } else {
                        // Send Notification (Optional but good UX)
                         await supabase.from('notifications').insert({
                            user_id: request.user_id,
                            title: "KYC Approved! 🎉",
                            body: `Your ${request.document_type?.toUpperCase().replace('_', ' ')} verification has been approved. You are now Tier ${newTier}.`,
                            data: { type: 'kyc_approved' }
                        });
                    }
                }
            } else {
                 // REJECTED Notification
                 await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: "KYC Update",
                    body: `Your ${request.document_type?.toUpperCase().replace('_', ' ')} verification was declined. Please try again with clear details.`,
                    data: { type: 'kyc_rejected' }
                });
            }

            fetchKYC();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const openDocument = async (path: string) => {
        if (!path) return;
        setLoadingImage(true);
        setViewingDoc(null); // Reset
        try {
            // Create Signed URL for security
            const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 60 * 60); // 1 hour
            if (error) throw error;
            if (data?.signedUrl) {
                setViewingDoc(data.signedUrl);
            }
        } catch (e: any) {
            Alert.alert("Error loading image", e.message);
        } finally {
            setLoadingImage(false);
        }
    };

    const getTierLabel = (type: string) => {
        switch(type) {
            case 'bvn': return 'Tier 2 (Identity)';
            case 'nin': return 'Tier 2 (Identity)';
            case 'utility_bill': return 'Tier 3 (Address)';
            case 'liveness': return 'Tier 4 (Liveness)';
            default: return 'Request';
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'KYC Operations' }} />

            <View className="p-4">
                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-blue-600 p-4 rounded-2xl items-center shadow-lg shadow-blue-600/20">
                        <Text className="text-white text-3xl font-black">{kycQueue.filter(k => k.status === 'pending').length}</Text>
                        <Text className="text-blue-100 text-xs font-bold uppercase tracking-wider">Pending Review</Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-2xl items-center shadow-sm border border-gray-100">
                        <Text className="text-slate-800 text-3xl font-black">{approvedToday}</Text>
                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Approved Today</Text>
                    </View>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-xs mb-3 ml-1">Verification Queue</Text>
            </View>

            {loading && kycQueue.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                <FlatList
                    data={kycQueue}
                    keyExtractor={item => item.id}
                    className="px-4"
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <View className="bg-white p-4 rounded-2xl mb-4 border border-gray-100 shadow-sm">
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-row items-center gap-3">
                                    <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center">
                                        <Text className="font-bold text-blue-600 text-lg">
                                            {item.profiles?.full_name?.[0] || 'U'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text className="font-bold text-slate-800 text-base">{item.profiles?.full_name || 'System User'}</Text>
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="shield-checkmark" size={12} color="#64748B" />
                                            <Text className="text-slate-500 text-xs text-xs">Current Tier: {item.profiles?.kyc_tier || 1}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View className={`px-2 py-1 rounded ${item.status === 'pending' ? 'bg-orange-100' : item.status === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Text className={`text-[10px] font-bold uppercase ${item.status === 'pending' ? 'text-orange-600' : item.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>

                            <View className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="document-text" size={16} color="#64748B" />
                                        <Text className="text-xs font-bold text-slate-700 uppercase">{item.document_type}</Text>
                                    </View>
                                    <Text className="text-xs text-blue-600 font-medium">{getTierLabel(item.document_type)}</Text>
                                </View>
                                
                                {item.document_number && (
                                    <Text className="text-slate-800 font-mono text-sm bg-white p-2 border border-slate-100 rounded mb-2">{item.document_number}</Text>
                                )}
                                
                                {item.notes && (
                                     <Text className="text-slate-500 text-xs italic mb-2">{item.notes}</Text>
                                )}

                                {item.document_url && (
                                    <TouchableOpacity onPress={() => openDocument(item.document_url)} className="flex-row items-center gap-1 bg-white p-2 rounded border border-blue-100 self-start">
                                        <Ionicons name="eye" size={14} color="#2563EB" />
                                        <Text className="text-blue-600 text-xs font-bold">View User Upload</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {item.status === 'pending' && (
                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={() => handleAction(item, 'rejected')}
                                        className="flex-1 h-10 bg-white border border-gray-200 rounded-xl items-center justify-center"
                                    >
                                        <Text className="text-slate-600 font-bold">Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleAction(item, 'approved')}
                                        className="flex-1 h-10 bg-slate-900 rounded-xl items-center justify-center shadow-lg shadow-slate-900/20"
                                    >
                                        <Text className="text-white font-bold">Approve</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                    ListEmptyComponent={
                        <View className="mt-10 items-center">
                            <Text className="text-gray-400">No verification requests found</Text>
                        </View>
                    }
                />
            )}

            {/* Document Viewer Modal */}
            <Modal visible={!!viewingDoc || loadingImage} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/95 justify-center items-center relative">
                    <TouchableOpacity
                        onPress={() => setViewingDoc(null)}
                        className="absolute top-12 right-6 z-10 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
                    >
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>

                    {loadingImage && <ActivityIndicator size="large" color="white" />}

                    {viewingDoc && !loadingImage && (
                        <Image
                            source={{ uri: viewingDoc }}
                            className="w-full h-full"
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}
