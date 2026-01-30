import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function KYCQueue() {
    const insets = useSafeAreaInsets();
    const [kycQueue, setKycQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [approvedToday, setApprovedToday] = useState(0);
    const [loadingImage, setLoadingImage] = useState(false);
    
    // New Features State
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Create a proper modal state object
    const [inspectorItem, setInspectorItem] = useState<any | null>(null);
    const [inspectorDocUrl, setInspectorDocUrl] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    useEffect(() => {
        fetchKYC();
    }, []);

    const fetchKYC = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('kyc_requests')
                .select('*, profiles(full_name, kyc_tier, phone, email)')
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
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchKYC();
    }, []);

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Copied", "Text copied to clipboard");
    };

    const toggleSort = () => {
        Haptics.selectionAsync();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    // Open Inspector Modal
    const openInspector = async (item: any) => {
        Haptics.selectionAsync();
        setInspectorItem(item);
        setInspectorDocUrl(null); // Reset doc url
        setIsRejecting(false); 
        setRejectionReason('');

        if (item.document_url) {
            setLoadingImage(true);
            try {
                const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(item.document_url, 60 * 60);
                if (data?.signedUrl) {
                    setInspectorDocUrl(data.signedUrl);
                }
            } catch (e) {
                console.log("Error loading doc", e);
            } finally {
                setLoadingImage(false);
            }
        }
    };

    const closeInspector = () => {
        setInspectorItem(null);
        setInspectorDocUrl(null);
    };

    const handleAction = async (request: any, status: 'approved' | 'rejected') => {
        // Haptic Feedback
        if (status === 'approved') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        try {
            // 1. Update Request Status
            const { error: reqError } = await supabase
                .from('kyc_requests')
                .update({ status })
                .eq('id', request.id);

            if (reqError) throw reqError;

            let emailSubject = "";
            let emailBody = "";

            // 2. If Approved, Upgrade User Tier
            if (status === 'approved') {
                let newTier = request.profiles?.kyc_tier || 1;
                
                // Logic based on document type
                switch (request.document_type) {
                    case 'bvn':
                    case 'nin':
                    case 'voters_card':
                    case 'drivers_license':
                        if (newTier < 2) newTier = 2;
                        break;
                    case 'utility_bill':
                    case 'bank_statement':
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
                         emailSubject = "KYC Verification Approved! 🎉";
                         emailBody = `Dear User,\n\nWe are pleased to inform you that your ${request.document_type?.toUpperCase().replace('_', ' ')} verification has been successfully approved.\n\nYou have been upgraded to Tier ${newTier}. You can now enjoy higher limits and more features on Abu Mafhal Hub.\n\nThank you for ensuring your account security.`;

                         await supabase.from('notifications').insert({
                            user_id: request.user_id,
                            title: "KYC Approved! 🎉",
                            body: `Your ${request.document_type?.toUpperCase().replace('_', ' ')} verification has been approved. You are now Tier ${newTier}.`,
                            data: { type: 'kyc_approved' }
                        });
                    }
                }
            } else {
                 // REJECTION LOGIC
                 const reasonText = rejectionReason ? `Reason: ${rejectionReason}` : "Reason: Document requirements not met.";
                 emailSubject = "KYC Verification Update";
                 
                 // If we are revoking a previously approved request, we must downgrade the user
                 if (request.status === 'approved') {
                     await supabase.from('profiles').update({ kyc_tier: 1 }).eq('id', request.user_id);
                     emailSubject = "KYC Verification Revoked ⚠️"; // Different subject for revocation
                 }

                 emailBody = `Dear User,\n\nWe regret to inform you that your ${request.document_type?.toUpperCase().replace('_', ' ')} verification request was declined.\n\n${reasonText}\n\nPlease review the requirements and try submitting again.\n\nIf you have questions, please contact support.`;

                 await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: request.status === 'approved' ? "KYC Revoked ⚠️" : "KYC Declined",
                    body: `Your verification was declined. ${reasonText}`,
                    data: { type: 'kyc_rejected' }
                });
            }

            // 3. Send Email Notification if email exists
            if (request.profiles?.email && emailSubject) {
                // Don't await strictly to not block UI
                supabase.functions.invoke('send-communication', {
                    body: {
                        type: 'email',
                        recipient: request.profiles.email,
                        recipient_mode: 'single',
                        subject: emailSubject,
                        body: emailBody
                    }
                }).then(({ error }) => {
                    if (error) console.warn("Failed to send KYC email:", error);
                });
            }

            // Close modal if open
            if (inspectorItem?.id === request.id) {
                closeInspector();
            }

            fetchKYC();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const getTierLabel = (type: string) => {
        switch(type) {
            case 'bvn': return 'Tier 2 (Identity)';
            case 'nin': return 'Tier 2 (Identity)';
            case 'voters_card': return 'Tier 2 (Identity)';
            case 'drivers_license': return 'Tier 2 (Identity)';
            case 'utility_bill': return 'Tier 3 (Address)';
            case 'bank_statement': return 'Tier 3 (Address)';
            case 'liveness': return 'Tier 4 (Liveness)';
            default: return 'Request';
        }
    };

    const filteredQueue = kycQueue.filter(item => {
        const matchesTab = activeTab === 'pending' 
            ? item.status === 'pending'
            : item.status !== 'pending';
        
        const matchesSearch = item.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.document_number?.includes(searchQuery);

        const matchesFilter = filterType === 'all' || item.document_type === filterType;

        return matchesTab && matchesSearch && matchesFilter;
    }).sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const filters = [
        { id: 'all', label: 'All' },
        { id: 'bvn', label: 'BVN' },
        { id: 'nin', label: 'NIN' },
        { id: 'voters_card', label: 'Voters Card' },
        { id: 'drivers_license', label: 'License' },
        { id: 'utility_bill', label: 'Utility' },
        { id: 'bank_statement', label: 'Bank Stmt' },
        { id: 'liveness', label: 'Liveness' },
    ];

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* MODERN HEADER */}
            <View className="shadow-2xl shadow-slate-900/30 z-20 bg-[#0F172A] rounded-b-[40px]">
                <LinearGradient 
                    colors={['#0F172A', '#1E293B']} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="pb-8 px-6 rounded-b-[40px]"
                    style={{ paddingTop: insets.top + (searchQuery ? 40 : 60) }} // Dynamic padding
                >
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-row items-center gap-4">
                            <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center border border-white/10 backdrop-blur-md">
                                <Ionicons name="shield-checkmark" size={24} color="#60A5FA" />
                            </View>
                            <View>
                                <Text className="text-white font-black text-xl tracking-tight">Compliance</Text>
                                <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest">Admin Center</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            onPress={() => fetchKYC()}
                            className="bg-white/10 w-10 h-10 rounded-full items-center justify-center border border-white/10"
                        >
                            <Ionicons name="refresh" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                    
                    {/* SEARCH BAR (Bottom of Header now) */}
                    <View className="flex-row items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 mb-2 backdrop-blur-sm">
                        <Ionicons name="search" size={20} color="#94A3B8" />
                        <TextInput 
                            placeholder="Search user, BVN or NIN..." 
                            placeholderTextColor="#64748B"
                            className="flex-1 ml-3 text-white font-semibold text-base"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                         {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>
            </View>

            <View className="flex-1 -mt-8 z-10">
                {/* CONTENT BODY */}
                <View className="bg-slate-50 rounded-t-[32px] pt-8 shadow-inner flex-1">
                    
                    {/* STATS ROW - MOVED HERE */}
                    <View className="flex-row gap-4 px-6 mb-6">
                         <View className="flex-1 bg-white p-3 rounded-2xl flex-row items-center gap-3 shadow-sm border border-blue-100/50">
                            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
                                <Text className="text-blue-600 font-black text-lg">{kycQueue.filter(k => k.status === 'pending').length}</Text>
                            </View>
                            <Text className="text-slate-500 text-[10px] font-bold uppercase leading-3">Pending{'\n'}Action</Text>
                         </View>
                         <View className="flex-1 bg-white p-3 rounded-2xl flex-row items-center gap-3 shadow-sm border border-emerald-100/50">
                            <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center">
                                <Text className="text-emerald-600 font-black text-lg">{approvedToday}</Text>
                            </View>
                            <Text className="text-slate-500 text-[10px] font-bold uppercase leading-3">Approved{'\n'}Today</Text>
                         </View>
                    </View>

                    {/* TABS & SORT */}
                    <View className="px-6 flex-row items-center justify-between mb-4">
                        <View className="flex-row">
                            <TouchableOpacity 
                                onPress={() => setActiveTab('pending')}
                                className={`mr-6 pb-2 ${activeTab === 'pending' ? 'border-b-2 border-slate-900' : ''}`}
                            >
                                <Text className={`font-bold text-base ${activeTab === 'pending' ? 'text-slate-900' : 'text-slate-400'}`}>Pending Review</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setActiveTab('history')}
                                className={`pb-2 ${activeTab === 'history' ? 'border-b-2 border-slate-900' : ''}`}
                            >
                                <Text className={`font-bold text-base ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-400'}`}>History Log</Text>
                            </TouchableOpacity>
                        </View>

                        {/* SORT TOGGLE */}
                        <TouchableOpacity 
                            onPress={toggleSort}
                            className="bg-slate-100 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                        >
                            <Text className="text-[10px] font-bold text-slate-500 uppercase">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</Text>
                            <Ionicons name={sortOrder === 'desc' ? "arrow-down" : "arrow-up"} size={12} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {/* FILTERS SCROLL */}
                    <View className="mb-2">
                         <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6" contentContainerStyle={{ paddingRight: 40 }}>
                            {filters.map((filter) => (
                                <TouchableOpacity
                                    key={filter.id}
                                    onPress={() => setFilterType(filter.id)}
                                    className={`px-4 py-2 rounded-full mr-2 border ${filterType === filter.id ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                                >
                                    <Text className={`text-xs font-bold ${filterType === filter.id ? 'text-white' : 'text-slate-600'}`}>
                                        {filter.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {loading && !refreshing && kycQueue.length === 0 ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#4F46E5" />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredQueue}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E293B" />
                            }
                            ListEmptyComponent={
                                <View className="mt-10 items-center opacity-50 py-10">
                                    <Ionicons name="filter-circle-outline" size={64} color="#CBD5E1" />
                                    <Text className="text-slate-400 font-bold mt-4 text-center">No records found matching{'\n'}your filters</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    onPress={() => openInspector(item)}
                                    activeOpacity={0.9}
                                    className={`bg-white p-5 rounded-[24px] mb-5 shadow-sm border ${item.status === 'pending' ? 'border-indigo-100 shadow-indigo-100/50' : 'border-slate-100'} relative overflow-hidden`}
                                >
                                    {item.status === 'pending' && (
                                        <LinearGradient
                                            colors={['#EEF2FF', '#FFFFFF']}
                                            className="absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-10 -mt-10 opacity-50"
                                        />
                                    )}
                                    
                                    {/* CARD HEADER */}
                                    <View className="flex-row justify-between items-start mb-5">
                                        <View className="flex-row gap-4">
                                            <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                                <Text className="font-black text-slate-700 text-lg">
                                                    {item.profiles?.full_name?.[0] || 'U'}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text className="font-bold text-slate-900 text-base">{item.profiles?.full_name || 'System User'}</Text>
                                                <Text className="text-slate-400 text-xs font-bold mt-1">Tier {item.profiles?.kyc_tier || 1} • {getTierLabel(item.document_type)}</Text>
                                            </View>
                                        </View>
                                        
                                        <View className={`px-2 py-1 rounded-lg ${item.status === 'pending' ? 'bg-orange-50' : item.status === 'approved' ? 'bg-green-50' : 'bg-red-50'}`}>
                                            <Text className={`text-[10px] font-black uppercase ${item.status === 'pending' ? 'text-orange-600' : item.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                                {item.status}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* DOCUMENT INFO PREVIEW */}
                                    <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 mb-2">
                                        <View className="flex-row items-center gap-3">
                                            <View className="w-8 h-8 rounded-full bg-white items-center justify-center border border-slate-200 shadow-sm">
                                                <Ionicons 
                                                    name={item.document_type === 'liveness' ? 'camera' : item.document_type === 'utility_bill' ? 'home' : 'card'} 
                                                    size={14} 
                                                    color="#64748B" 
                                                />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document</Text>
                                                <Text className="text-slate-800 font-bold capitalize text-sm">{item.document_type.replace('_', ' ')}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>

            {/* DETAIL INSPECTOR MODAL */}
            <Modal visible={!!inspectorItem} transparent animationType="slide" onRequestClose={closeInspector}>
                {inspectorItem && (
                    <View className="flex-1 justify-end bg-black/80">
                        <View className="bg-white rounded-t-[32px] h-[92%] overflow-hidden">
                            {/* GRAB BAR */}
                            <View className="items-center pt-4 pb-2 bg-white z-10">
                                <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
                            </View>

                            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                                
                                {/* 1. IMAGE SECTION (Like User Manager Avatar but bigger) */}
                                <View className="items-center mb-6 relative px-6">
                                    <View className="w-full h-64 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative mb-4">
                                        {inspectorDocUrl ? (
                                            <Image 
                                                source={{ uri: inspectorDocUrl }} 
                                                className="w-full h-full" 
                                                resizeMode="contain" 
                                            />
                                        ) : loadingImage ? (
                                            <View className="flex-1 items-center justify-center">
                                                <ActivityIndicator color="#4F46E5" />
                                            </View>
                                        ) : (
                                            <View className="flex-1 items-center justify-center bg-slate-50">
                                                <Ionicons name="image-outline" size={48} color="#CBD5E1" />
                                                <Text className="text-slate-400 font-bold mt-2">No Document</Text>
                                            </View>
                                        )}
                                        
                                        {/* Floating Badge */}
                                        <View className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-sm">
                                            <Text className="text-[10px] font-bold uppercase text-slate-800 tracking-wide">
                                                {inspectorItem.document_type?.replace('_', ' ')}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* User Info Below Image */}
                                    <Text className="text-2xl font-black text-slate-900 text-center mb-1">
                                        {inspectorItem.profiles?.full_name || 'Unknown User'}
                                    </Text>
                                    <Text className="text-slate-400 font-bold text-sm tracking-wide mb-4">
                                        Submitted {new Date(inspectorItem.created_at).toLocaleDateString()}
                                    </Text>

                                    {/* Status Badge */}
                                    <View className={`px-4 py-1.5 rounded-full ${inspectorItem.status === 'pending' ? 'bg-orange-100' : inspectorItem.status === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Text className={`text-xs font-black uppercase ${inspectorItem.status === 'pending' ? 'text-orange-700' : inspectorItem.status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                                            {inspectorItem.status}
                                        </Text>
                                    </View>
                                </View>

                                <View className="px-6">
                                    <View className="bg-slate-50 p-6 rounded-3xl border border-slate-100 gap-y-6">
                                        
                                        {/* ID NUMBER */}
                                        {inspectorItem.document_number && (
                                            <View>
                                                <Text className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Document Number</Text>
                                                <TouchableOpacity 
                                                    onPress={() => copyToClipboard(inspectorItem.document_number)}
                                                    className="bg-white p-4 rounded-2xl border border-slate-200 flex-row justify-between items-center shadow-sm active:bg-slate-50"
                                                >
                                                    <View className="flex-row items-center gap-3">
                                                        <View className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center">
                                                            <Ionicons name="key-outline" size={20} color="#64748B" />
                                                        </View>
                                                        <View>
                                                            <Text className="text-xl font-mono font-bold text-slate-800 tracking-wider">
                                                                {inspectorItem.document_number}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Ionicons name="copy-outline" size={20} color="#94A3B8" />
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* CONTACT */}
                                        {(inspectorItem.profiles?.email || inspectorItem.profiles?.phone) && (
                                            <View>
                                                <Text className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Contact Details</Text>
                                                <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                                    {inspectorItem.profiles?.email && (
                                                        <View className="p-4 border-b border-slate-100 flex-row items-center gap-3">
                                                            <Ionicons name="mail-outline" size={18} color="#94A3B8" />
                                                            <Text className="text-slate-700 font-bold flex-1">{inspectorItem.profiles.email}</Text>
                                                        </View>
                                                    )}
                                                    {inspectorItem.profiles?.phone && (
                                                        <View className="p-4 flex-row items-center gap-3">
                                                            <Ionicons name="call-outline" size={18} color="#94A3B8" />
                                                            <Text className="text-slate-700 font-bold flex-1">{inspectorItem.profiles.phone}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        )}

                                        {/* NOTES */}
                                        {inspectorItem.notes && (
                                            <View>
                                                <Text className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Notes</Text>
                                                <View className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                                    <Text className="text-amber-900 font-medium font-serif italic text-base">"{inspectorItem.notes}"</Text>
                                                </View>
                                            </View>
                                        )}

                                    </View>
                                </View>
                            </ScrollView>

                             {/* ACTION BAR (FIXED BOTTOM) */}
                            {(inspectorItem.status === 'pending' || inspectorItem.status === 'approved') && (
                                <View className="absolute bottom-0 left-0 right-0 p-6 pt-4 bg-white border-t border-slate-100">
                                    
                                    {isRejecting ? (
                                        <View>
                                            <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Reason for {inspectorItem.status === 'approved' ? 'Revocation' : 'Rejection'}</Text>
                                            <TextInput
                                                className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-slate-800 h-24"
                                                placeholder="Enter reason (e.g., fraudulent document, expired)..."
                                                multiline
                                                textAlignVertical="top"
                                                value={rejectionReason}
                                                onChangeText={setRejectionReason}
                                                autoFocus
                                            />
                                            <View className="flex-row gap-4">
                                                <TouchableOpacity
                                                    onPress={() => setIsRejecting(false)}
                                                    className="h-14 flex-1 bg-slate-100 rounded-xl items-center justify-center border border-slate-200"
                                                >
                                                    <Text className="font-bold text-slate-600">Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleAction(inspectorItem, 'rejected')}
                                                    className="h-14 flex-[2] bg-red-500 rounded-xl items-center justify-center shadow-md shadow-red-500/20"
                                                >
                                                    <Text className="font-bold text-white text-lg">Confirm {inspectorItem.status === 'approved' ? 'Revoke' : 'Reject'}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="flex-row gap-4 mb-4">
                                            {inspectorItem.status === 'approved' ? (
                                                <TouchableOpacity
                                                    onPress={() => setIsRejecting(true)}
                                                    className="flex-1 h-14 bg-red-50 rounded-2xl items-center justify-center border border-red-100 active:bg-red-100 flex-row gap-2"
                                                >
                                                    <Ionicons name="alert-circle" size={24} color="#EF4444" />
                                                    <Text className="text-red-600 font-bold text-lg">Revoke Verification</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <>
                                                    <TouchableOpacity
                                                        onPress={() => setIsRejecting(true)}
                                                        className="h-16 w-16 bg-red-50 rounded-2xl items-center justify-center border border-red-100 active:bg-red-100"
                                                    >
                                                        <Ionicons name="close" size={32} color="#EF4444" />
                                                    </TouchableOpacity>
                                                    
                                                    <TouchableOpacity
                                                        onPress={() => handleAction(inspectorItem, 'approved')}
                                                        activeOpacity={0.8}
                                                        className="flex-1"
                                                    >
                                                        <LinearGradient
                                                            colors={['#0F172A', '#1E293B']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 0 }}
                                                            className="h-16 rounded-2xl items-center justify-center flex-row gap-3 shadow-lg shadow-slate-900/30"
                                                        >
                                                            <Text className="text-white font-bold text-xl tracking-wide">Approve</Text>
                                                            <Ionicons name="checkmark-circle" size={28} color="#60A5FA" />
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                             {/* CLOSE BUTTON (FLOATING OVERLAY) */}
                             <View className="absolute top-4 right-4 z-50">
                                <TouchableOpacity 
                                    onPress={closeInspector}
                                    className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
                                >
                                    <Ionicons name="close" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    );
}
