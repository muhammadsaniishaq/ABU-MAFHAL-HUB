import { 
    View, Text, FlatList, TouchableOpacity, Image, 
    ActivityIndicator, Alert, Modal, TextInput, RefreshControl, 
    ScrollView, Platform, KeyboardAvoidingView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import * as Clipboard from 'expo-clipboard';

// Executive Light Navy & Gold Design System Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(218, 165, 32, 0.35)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#FFD700',
    goldDk: '#DAA520',
    goldAmber: '#D97706',
    goldLight: '#FEF3C7',
    goldBg: 'rgba(254, 243, 199, 0.65)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE'
};

export default function KYCManagerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Core Data States
    const [kycQueue, setKycQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [approvedToday, setApprovedToday] = useState(0);
    const [totalApprovedCount, setTotalApprovedCount] = useState(0);
    const [totalRejectedCount, setTotalRejectedCount] = useState(0);
    
    // Filter & Search States
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Inspector & Rejection Modal States
    const [inspectorItem, setInspectorItem] = useState<any | null>(null);
    const [inspectorDocUrl, setInspectorDocUrl] = useState<string | null>(null);
    const [loadingDocImage, setLoadingDocImage] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [isActionProcessing, setIsActionProcessing] = useState(false);

    // Automation & Virtual Account States
    const [autoKycEnabled, setAutoKycEnabled] = useState(false);
    const [autoVirtualAccEnabled, setAutoVirtualAccEnabled] = useState(true);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    useEffect(() => {
        fetchKYCData();
        fetchAutoSettings();
    }, []);

    const fetchAutoSettings = async () => {
        try {
            const { data: kycSetting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'auto_kyc_verification_enabled')
                .maybeSingle();

            if (kycSetting?.value != null) {
                const val = typeof kycSetting.value === 'string' ? JSON.parse(kycSetting.value) : kycSetting.value;
                setAutoKycEnabled(Boolean(val));
            }

            const { data: dvaSetting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'auto_generate_virtual_account_enabled')
                .maybeSingle();

            if (dvaSetting?.value != null) {
                const val = typeof dvaSetting.value === 'string' ? JSON.parse(dvaSetting.value) : dvaSetting.value;
                setAutoVirtualAccEnabled(Boolean(val));
            }
        } catch (e) {
            console.error("Error fetching auto settings:", e);
        }
    };

    const toggleAutoKycSetting = async (newValue: boolean) => {
        setAutoKycEnabled(newValue);
        try {
            await supabase.from('app_settings').upsert({
                key: 'auto_kyc_verification_enabled',
                value: JSON.stringify(newValue),
                updated_at: new Date().toISOString()
            });
            showToast(newValue ? "Auto-KYC Verification Enabled! ⚡" : "Auto-KYC Disabled. Manual Mode Active.");
        } catch (e: any) {
            Alert.alert("Setting Error", e.message);
        }
    };

    const toggleAutoVirtualAccSetting = async (newValue: boolean) => {
        setAutoVirtualAccEnabled(newValue);
        try {
            await supabase.from('app_settings').upsert({
                key: 'auto_generate_virtual_account_enabled',
                value: JSON.stringify(newValue),
                updated_at: new Date().toISOString()
            });
            showToast(newValue ? "Auto Virtual Account Issue Enabled! 🏦" : "Auto Virtual Account Disabled.");
        } catch (e: any) {
            Alert.alert("Setting Error", e.message);
        }
    };

    const triggerVirtualAccountGeneration = async (userId: string, bvn?: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('create-virtual-account', {
                body: { userId, bvn }
            });
            if (error) console.warn("Virtual account invocation warning:", error);
            return data;
        } catch (e) {
            console.error("Virtual account error:", e);
        }
    };

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3500);
    };

    const fetchKYCData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('kyc_requests')
                .select('*, profiles(full_name, kyc_tier, phone, email)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setKycQueue(data || []);

            // Calculate Today's Approved Metrics
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            const approvedTodayList = (data || []).filter(k => 
                k.status === 'approved' && new Date(k.updated_at || k.created_at) >= startOfDay
            );
            setApprovedToday(approvedTodayList.length);

            const approvedAll = (data || []).filter(k => k.status === 'approved').length;
            const rejectedAll = (data || []).filter(k => k.status === 'rejected').length;
            setTotalApprovedCount(approvedAll);
            setTotalRejectedCount(rejectedAll);

        } catch (error: any) {
            console.error("KYC Fetch error:", error);
            Alert.alert('Error', error.message || "Failed to load KYC requests");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchKYCData();
    }, []);

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            Clipboard.setString(text);
        }
        showToast(`Copied ${label} to clipboard! ✨`);
    };

    // Open Inspector Modal with Signed Storage Document URL
    const openInspector = async (item: any) => {
        setInspectorItem(item);
        setInspectorDocUrl(null);
        setRejectionReason('');
        setShowRejectModal(false);

        if (item.document_url) {
            setLoadingDocImage(true);
            try {
                // If it's already a full HTTP URL
                if (item.document_url.startsWith('http')) {
                    setInspectorDocUrl(item.document_url);
                } else {
                    const { data, error } = await supabase.storage
                        .from('kyc-documents')
                        .createSignedUrl(item.document_url, 60 * 60);
                    if (data?.signedUrl) {
                        setInspectorDocUrl(data.signedUrl);
                    }
                }
            } catch (e) {
                console.log("Error resolving document image:", e);
            } finally {
                setLoadingDocImage(false);
            }
        }
    };

    const closeInspector = () => {
        setInspectorItem(null);
        setInspectorDocUrl(null);
        setShowRejectModal(false);
        setRejectionReason('');
    };

    const handleBulkAutoApprove = async () => {
        const pendingItems = kycQueue.filter(k => k.status === 'pending');
        if (pendingItems.length === 0) {
            Alert.alert("Queue Empty", "There are no pending KYC requests to approve.");
            return;
        }

        Alert.alert(
            "Bulk Auto-Approval & Virtual Accounts",
            `Are you sure you want to Auto-Approve ${pendingItems.length} pending KYC request(s) and issue Virtual Bank Accounts for each user?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm Bulk Approve",
                    style: "default",
                    onPress: async () => {
                        setIsBulkProcessing(true);
                        try {
                            let processed = 0;
                            for (const item of pendingItems) {
                                await handleAction(item, 'approved');
                                processed++;
                            }
                            showToast(`Processed ${processed} KYC requests & issued virtual accounts! 🚀`);
                            fetchKYCData();
                        } catch (e: any) {
                            Alert.alert("Bulk Approval Error", e.message);
                        } finally {
                            setIsBulkProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    // Process Approval or Rejection
    const handleAction = async (request: any, status: 'approved' | 'rejected') => {
        setIsActionProcessing(true);
        try {
            // 1. Update KYC Request Status
            const updatePayload: any = { status, updated_at: new Date().toISOString() };
            if (status === 'rejected' && rejectionReason.trim()) {
                updatePayload.rejection_reason = rejectionReason.trim();
            }

            const { error: reqError } = await supabase
                .from('kyc_requests')
                .update(updatePayload)
                .eq('id', request.id);

            if (reqError) throw reqError;

            let emailSubject = "";
            let emailBody = "";

            // 2. If Approved, Upgrade User Tier
            if (status === 'approved') {
                let currentTier = request.profiles?.kyc_tier || 1;
                let targetTier = currentTier;
                
                switch (request.document_type) {
                    case 'bvn':
                    case 'nin':
                    case 'voters_card':
                    case 'drivers_license':
                        if (targetTier < 2) targetTier = 2;
                        break;
                    case 'utility_bill':
                    case 'bank_statement':
                        if (targetTier < 3) targetTier = 3;
                        break;
                    case 'liveness':
                        if (targetTier < 4) targetTier = 4;
                        break;
                    default:
                        if (targetTier < 2) targetTier = 2;
                        break;
                }

                if (targetTier > currentTier) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ kyc_tier: targetTier })
                        .eq('id', request.user_id);

                    if (profileError) {
                        console.warn("Tier upgrade warning:", profileError.message);
                    }
                }

                // 3. Auto Generate Virtual Bank Account if enabled or approved
                if (autoVirtualAccEnabled) {
                    triggerVirtualAccountGeneration(request.user_id, request.document_number);
                }

                emailSubject = "KYC Verification Approved & Virtual Account Issued! 🎉";
                emailBody = `Dear ${request.profiles?.full_name || 'User'},\n\nWe are pleased to inform you that your ${request.document_type?.toUpperCase().replace(/_/g, ' ')} verification has been successfully approved.\n\nYour account has been upgraded to Tier ${targetTier} and your dedicated Reserved Virtual Bank Account (Wema/Payvessel) has been issued for automated wallet funding.\n\nThank you for choosing Abu Mafhal Hub.`;

                await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: "KYC Approved & Virtual Account Issued! 🎉",
                    body: `Your ${request.document_type?.toUpperCase().replace(/_/g, ' ')} verification was approved. Tier ${targetTier} & Virtual Bank Account activated!`,
                    data: { type: 'kyc_approved' }
                });

                showToast(`Verification Approved! Tier ${targetTier} & Virtual Account Issued ✨`);
            } else {
                // Rejection Logic
                const reasonText = rejectionReason.trim() ? `Reason: ${rejectionReason.trim()}` : "Reason: Document requirements not met.";
                emailSubject = "KYC Verification Declined Update ⚠️";

                // Downgrade if previously approved
                if (request.status === 'approved') {
                    await supabase.from('profiles').update({ kyc_tier: 1 }).eq('id', request.user_id);
                    emailSubject = "KYC Verification Revoked ⚠️";
                }

                emailBody = `Dear ${request.profiles?.full_name || 'User'},\n\nYour ${request.document_type?.toUpperCase().replace(/_/g, ' ')} verification request was declined.\n\n${reasonText}\n\nPlease re-submit clear documents adhering to our guidelines in the app.\n\nThank you.`;

                await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: request.status === 'approved' ? "KYC Revoked ⚠️" : "KYC Verification Declined ❌",
                    body: `Your ${request.document_type?.toUpperCase().replace(/_/g, ' ')} verification was declined. ${reasonText}`,
                    data: { type: 'kyc_rejected' }
                });

                showToast(`Request Declined. Notification sent to user.`);
            }

            // 3. Send Email Notification
            if (request.profiles?.email && emailSubject) {
                supabase.functions.invoke('send-communication', {
                    body: {
                        type: 'email',
                        recipient: request.profiles.email,
                        recipient_mode: 'single',
                        subject: emailSubject,
                        body: emailBody
                    }
                }).then(({ error }) => {
                    if (error) console.warn("KYC email dispatch warning:", error);
                });
            }

            closeInspector();
            fetchKYCData();
        } catch (error: any) {
            Alert.alert('Error', error.message || "Failed to complete action");
        } finally {
            setIsActionProcessing(false);
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
            default: return 'Tier 2';
        }
    };

    const targetTierNumber = (type: string) => {
        switch(type) {
            case 'bvn':
            case 'nin':
            case 'voters_card':
            case 'drivers_license': return 2;
            case 'utility_bill':
            case 'bank_statement': return 3;
            case 'liveness': return 4;
            default: return 2;
        }
    };

    // Filter & Sort Logic
    const filteredQueue = useMemo(() => {
        return kycQueue.filter(item => {
            const matchesTab = activeTab === 'pending' 
                ? item.status === 'pending'
                : item.status !== 'pending';
            
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                item.profiles?.full_name?.toLowerCase().includes(q) || 
                item.profiles?.email?.toLowerCase().includes(q) ||
                item.profiles?.phone?.includes(q) ||
                item.document_number?.toLowerCase().includes(q);

            const matchesFilter = filterType === 'all' || item.document_type === filterType;

            return matchesTab && matchesSearch && matchesFilter;
        }).sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [kycQueue, activeTab, searchQuery, filterType, sortOrder]);

    const filters = [
        { id: 'all', label: 'All Documents' },
        { id: 'bvn', label: 'BVN' },
        { id: 'nin', label: 'NIN' },
        { id: 'voters_card', label: 'Voters Card' },
        { id: 'drivers_license', label: 'License' },
        { id: 'utility_bill', label: 'Utility' },
        { id: 'bank_statement', label: 'Bank Stmt' },
        { id: 'liveness', label: 'Liveness' },
    ];

    const presetRejectionReasons = [
        "Blurry or unreadable photo document",
        "Document name does not match user profile",
        "Expired identification document",
        "Invalid BVN / NIN format submitted",
        "Unclear selfie or liveness verification failure"
    ];

    const pendingCount = kycQueue.filter(k => k.status === 'pending').length;

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                
                {/* Toast Notification Bar */}
                {toastMsg && (
                    <View style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 60, backgroundColor: L.navyHeader, borderColor: L.gold, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 8 }}>
                        <Ionicons name="sparkles" size={14} color={L.gold} />
                        <Text style={{ color: L.goldLight, fontWeight: 'bold', fontSize: 10, flex: 1 }}>{toastMsg}</Text>
                    </View>
                )}

                {/* Compact Royal Navy Header */}
                <LinearGradient 
                    colors={['#0F172A', '#1C2541', '#0B132B']} 
                    style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: L.goldDk, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="shield-checkmark-sharp" size={12} color={L.gold} />
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>KYC Manager</Text>
                            </View>
                            <TouchableOpacity onPress={fetchKYCData} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                <Ionicons name="refresh" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={{ color: L.gold, fontSize: 13, fontWeight: '900', letterSpacing: -0.2, marginBottom: 1 }}>COMPLIANCE & KYC QUEUE</Text>
                    <Text style={{ color: '#CBD5E1', fontSize: 9, marginBottom: 6 }}>Review user identities, BVN, NIN, utility bills & tier upgrades.</Text>

                    {/* Search Input Bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', paddingHorizontal: 8, height: 32 }}>
                        <Ionicons name="search-outline" size={12} color={L.gold} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search user name, email, BVN or NIN..."
                            placeholderTextColor="#94A3B8"
                            style={{ flex: 1, marginLeft: 6, color: '#FFFFFF', fontWeight: '600', fontSize: 10 }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={12} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>

                {/* Master Automation & Virtual Account Control Bar */}
                <View style={{ backgroundColor: '#0F172A', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: L.goldDk }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="hardware-chip-outline" size={12} color={L.gold} />
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>KYC Automation Engine</Text>
                        </View>

                        <TouchableOpacity 
                            onPress={handleBulkAutoApprove}
                            disabled={isBulkProcessing}
                            style={{ backgroundColor: L.gold, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 2 }}
                        >
                            {isBulkProcessing ? (
                                <ActivityIndicator size="small" color="#0F172A" />
                            ) : (
                                <>
                                    <Ionicons name="flash-sharp" size={9} color="#0F172A" />
                                    <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 8, textTransform: 'uppercase' }}>Bulk Approve & Issue</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {/* Auto-KYC Verification Toggle */}
                        <TouchableOpacity 
                            onPress={() => toggleAutoKycSetting(!autoKycEnabled)}
                            style={{
                                flex: 1, backgroundColor: autoKycEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                padding: 5, borderRadius: 6, borderWidth: 1,
                                borderColor: autoKycEnabled ? L.emerald : 'rgba(255,255,255,0.15)',
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
                            }}
                        >
                            <View style={{ flex: 1, marginRight: 4 }}>
                                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 8 }}>Auto-Verify KYC</Text>
                                <Text style={{ color: autoKycEnabled ? L.emerald : '#94A3B8', fontSize: 7 }}>{autoKycEnabled ? '⚡ Instant Approve' : 'Manual Mode'}</Text>
                            </View>
                            <View style={{ width: 24, height: 14, borderRadius: 7, backgroundColor: autoKycEnabled ? L.emerald : '#475569', padding: 1.5, alignItems: autoKycEnabled ? 'flex-end' : 'flex-start' }}>
                                <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#FFFFFF' }} />
                            </View>
                        </TouchableOpacity>

                        {/* Auto-Virtual Account Generation Toggle */}
                        <TouchableOpacity 
                            onPress={() => toggleAutoVirtualAccSetting(!autoVirtualAccEnabled)}
                            style={{
                                flex: 1, backgroundColor: autoVirtualAccEnabled ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.05)',
                                padding: 5, borderRadius: 6, borderWidth: 1,
                                borderColor: autoVirtualAccEnabled ? L.gold : 'rgba(255,255,255,0.15)',
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
                            }}
                        >
                            <View style={{ flex: 1, marginRight: 4 }}>
                                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 8 }}>Auto Virtual Acc</Text>
                                <Text style={{ color: autoVirtualAccEnabled ? L.gold : '#94A3B8', fontSize: 7 }}>{autoVirtualAccEnabled ? '🏦 Wema / Payvessel' : 'Off'}</Text>
                            </View>
                            <View style={{ width: 24, height: 14, borderRadius: 7, backgroundColor: autoVirtualAccEnabled ? L.gold : '#475569', padding: 1.5, alignItems: autoVirtualAccEnabled ? 'flex-end' : 'flex-start' }}>
                                <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#0F172A' }} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Metrics Summary Strip */}
                <View style={{ backgroundColor: L.card, paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Pending</Text>
                        <Text style={{ color: pendingCount > 0 ? L.rose : L.navyHeader, fontSize: 11, fontWeight: '900' }}>{pendingCount}</Text>
                    </View>
                    <View style={{ width: 1, height: 18, backgroundColor: L.inputBorder }} />
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Approved Today</Text>
                        <Text style={{ color: L.emerald, fontSize: 11, fontWeight: '900' }}>{approvedToday}</Text>
                    </View>
                    <View style={{ width: 1, height: 18, backgroundColor: L.inputBorder }} />
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Total Approved</Text>
                        <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900' }}>{totalApprovedCount}</Text>
                    </View>
                    <View style={{ width: 1, height: 18, backgroundColor: L.inputBorder }} />
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: L.textMuted, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>Total Rejected</Text>
                        <Text style={{ color: L.rose, fontSize: 11, fontWeight: '900' }}>{totalRejectedCount}</Text>
                    </View>
                </View>

                {/* Tabs & Sort Controls */}
                <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('pending')}
                            style={{
                                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
                                backgroundColor: activeTab === 'pending' ? L.navyHeader : L.card,
                                borderColor: activeTab === 'pending' ? L.navyHeader : L.inputBorder
                            }}
                        >
                            <Text style={{ fontSize: 10, fontWeight: '900', color: activeTab === 'pending' ? L.gold : L.textSecondary }}>
                                Pending Queue ({pendingCount})
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveTab('history')}
                            style={{
                                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
                                backgroundColor: activeTab === 'history' ? L.navyHeader : L.card,
                                borderColor: activeTab === 'history' ? L.navyHeader : L.inputBorder
                            }}
                        >
                            <Text style={{ fontSize: 10, fontWeight: '900', color: activeTab === 'history' ? L.gold : L.textSecondary }}>
                                Verification Log
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        onPress={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
                        style={{ backgroundColor: L.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                    >
                        <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: 'bold' }}>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</Text>
                        <Ionicons name={sortOrder === 'desc' ? "arrow-down" : "arrow-up"} size={10} color={L.navyHeader} />
                    </TouchableOpacity>
                </View>

                {/* Category Document Filters Bar */}
                <View style={{ borderBottomWidth: 1, borderColor: L.inputBorder, paddingVertical: 4 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12 }} contentContainerStyle={{ gap: 5 }}>
                        {filters.map((f) => {
                            const isSelected = filterType === f.id;
                            return (
                                <TouchableOpacity
                                    key={f.id}
                                    onPress={() => setFilterType(f.id)}
                                    style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        backgroundColor: isSelected ? L.navyHeader : L.card,
                                        borderColor: isSelected ? L.navyHeader : L.inputBorder
                                    }}
                                >
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: isSelected ? L.gold : L.textSecondary }}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* KYC Requests List */}
                <ScrollView 
                    style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }} 
                    contentContainerStyle={{ paddingBottom: 90 }} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={L.navyHeader} />}
                >
                    {loading && !refreshing && kycQueue.length === 0 ? (
                        <ActivityIndicator color={L.goldDk} size="small" style={{ marginTop: 30 }} />
                    ) : filteredQueue.length === 0 ? (
                        <View style={{ backgroundColor: L.card, padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder, marginTop: 10 }}>
                            <Ionicons name="shield-outline" size={32} color={L.textMuted} />
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12, marginTop: 8 }}>No KYC Requests Found</Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                                {activeTab === 'pending' ? 'All pending verification requests have been processed.' : 'No records match your active search filter.'}
                            </Text>
                        </View>
                    ) : (
                        filteredQueue.map((item: any, idx: number) => {
                            const isPending = item.status === 'pending';
                            const isApproved = item.status === 'approved';
                            const targetTier = targetTierNumber(item.document_type);

                            return (
                                <View 
                                    key={item.id || idx}
                                    style={{
                                        backgroundColor: L.card,
                                        borderRadius: 14,
                                        padding: 12,
                                        marginBottom: 10,
                                        borderWidth: 1,
                                        borderColor: isPending ? L.cardBorder : L.inputBorder,
                                        elevation: 2
                                    }}
                                >
                                    {/* Card Header Row */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 12 }}>
                                                    {item.profiles?.full_name?.[0]?.toUpperCase() || 'U'}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }} numberOfLines={1}>
                                                    {item.profiles?.full_name || 'System User'}
                                                </Text>
                                                <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>
                                                    Current Tier {item.profiles?.kyc_tier || 1} • {item.profiles?.email || item.profiles?.phone || 'No Contact'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Status Badge */}
                                        <View style={{
                                            backgroundColor: isPending ? L.goldLight : isApproved ? L.emeraldBg : L.roseBg,
                                            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                                            borderWidth: 1, borderColor: isPending ? L.goldDk : isApproved ? L.emeraldBorder : L.roseBorder
                                        }}>
                                            <Text style={{
                                                fontSize: 8, fontWeight: '900', textTransform: 'uppercase',
                                                color: isPending ? L.goldAmber : isApproved ? L.emerald : L.rose
                                            }}>
                                                {item.status}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Document Type & Tier Upgrade Banner */}
                                    <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ionicons 
                                                    name={item.document_type === 'liveness' ? 'camera' : item.document_type === 'utility_bill' ? 'home' : 'card'} 
                                                    size={12} 
                                                    color={L.navyHeader} 
                                                />
                                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>
                                                    {item.document_type?.replace(/_/g, ' ')}
                                                </Text>
                                            </View>
                                            <View style={{ backgroundColor: L.blueBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: L.blueBorder }}>
                                                <Text style={{ color: L.blue, fontSize: 8, fontWeight: '900' }}>Upgrades to Tier {targetTier}</Text>
                                            </View>
                                        </View>

                                        {item.document_number && (
                                            <TouchableOpacity onPress={() => copyToClipboard(item.document_number, 'Doc Number')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                                <Text style={{ color: L.textSecondary, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' }}>
                                                    No: {item.document_number}
                                                </Text>
                                                <Ionicons name="copy-outline" size={10} color={L.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Action Buttons Row */}
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <TouchableOpacity 
                                            onPress={() => openInspector(item)}
                                            style={{ flex: 1, backgroundColor: L.navyHeader, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.gold }}
                                        >
                                            <Ionicons name="eye-outline" size={12} color={L.gold} />
                                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9 }}>Inspect Details</Text>
                                        </TouchableOpacity>

                                        {isPending && (
                                            <>
                                                <TouchableOpacity 
                                                    onPress={() => handleAction(item, 'approved')}
                                                    style={{ flex: 1, backgroundColor: L.emeraldBg, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.emeraldBorder }}
                                                >
                                                    <Ionicons name="checkmark-circle" size={12} color={L.emerald} />
                                                    <Text style={{ color: L.emerald, fontWeight: '900', fontSize: 9 }}>Approve Tier</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity 
                                                    onPress={() => { setInspectorItem(item); setShowRejectModal(true); }}
                                                    style={{ backgroundColor: L.roseBg, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.roseBorder }}
                                                >
                                                    <Ionicons name="close-circle" size={12} color={L.rose} />
                                                </TouchableOpacity>
                                            </>
                                        )}

                                        {!isPending && isApproved && (
                                            <TouchableOpacity 
                                                onPress={() => { setInspectorItem(item); setShowRejectModal(true); }}
                                                style={{ backgroundColor: L.roseBg, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3, borderWidth: 1, borderColor: L.roseBorder }}
                                            >
                                                <Ionicons name="alert-circle" size={10} color={L.rose} />
                                                <Text style={{ color: L.rose, fontWeight: '900', fontSize: 8 }}>Revoke</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* DOCUMENT INSPECTOR MODAL */}
            <Modal visible={inspectorItem !== null && !showRejectModal} transparent animationType="fade" onRequestClose={closeInspector}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', padding: 14 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: L.goldDk, maxHeight: '90%' }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            
                            {/* Modal Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderColor: L.inputBorder, paddingBottom: 6 }}>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13 }}>KYC Inspector & Audit</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9 }}>User: {inspectorItem?.profiles?.full_name || 'System User'}</Text>
                                </View>
                                <TouchableOpacity onPress={closeInspector}>
                                    <Ionicons name="close-circle" size={20} color={L.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* User Profile Information Card */}
                            <View style={{ backgroundColor: L.bg, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 10 }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Applicant Details</Text>
                                <Text style={{ color: L.textSecondary, fontSize: 9, fontWeight: 'bold' }}>Email: {inspectorItem?.profiles?.email || 'N/A'}</Text>
                                <Text style={{ color: L.textSecondary, fontSize: 9, fontWeight: 'bold', marginTop: 2 }}>Phone: {inspectorItem?.profiles?.phone || 'N/A'}</Text>
                                <Text style={{ color: L.textSecondary, fontSize: 9, fontWeight: 'bold', marginTop: 2 }}>Current Tier: Tier {inspectorItem?.profiles?.kyc_tier || 1}</Text>
                                <Text style={{ color: L.goldAmber, fontSize: 9, fontWeight: '900', marginTop: 2 }}>Document Type: {inspectorItem?.document_type?.toUpperCase().replace(/_/g, ' ')}</Text>
                                {inspectorItem?.document_number && (
                                    <TouchableOpacity onPress={() => copyToClipboard(inspectorItem.document_number, 'Doc Number')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>Doc Number: {inspectorItem.document_number}</Text>
                                        <Ionicons name="copy-outline" size={10} color={L.goldDk} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Document Photo Image Preview */}
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Uploaded Document Attachment</Text>
                            <View style={{ height: 200, backgroundColor: L.navyHeader, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: L.goldDk }}>
                                {loadingDocImage ? (
                                    <ActivityIndicator size="small" color={L.gold} />
                                ) : inspectorDocUrl ? (
                                    <Image source={{ uri: inspectorDocUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                ) : (
                                    <View style={{ alignItems: 'center', padding: 10 }}>
                                        <Ionicons name="document-text-outline" size={32} color={L.gold} />
                                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>No Photo Document Uploaded</Text>
                                        <Text style={{ color: '#CBD5E1', fontSize: 8 }}>Text-based verification request</Text>
                                    </View>
                                )}
                            </View>

                            {/* Action Buttons inside Modal */}
                            {inspectorItem?.status === 'pending' ? (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity 
                                        onPress={() => handleAction(inspectorItem, 'approved')}
                                        disabled={isActionProcessing}
                                        style={{ flex: 1, backgroundColor: L.emerald, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                                    >
                                        {isActionProcessing ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                                                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Approve Verification</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => setShowRejectModal(true)}
                                        disabled={isActionProcessing}
                                        style={{ flex: 1, backgroundColor: L.rose, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                                    >
                                        <Ionicons name="close-circle" size={14} color="#FFFFFF" />
                                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Decline Request</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity onPress={closeInspector} style={{ flex: 1, backgroundColor: L.navyHeader, paddingVertical: 9, borderRadius: 10, alignItems: 'center' }}>
                                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10 }}>Close Inspector</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setShowRejectModal(true)} style={{ backgroundColor: L.roseBg, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: L.roseBorder }}>
                                        <Text style={{ color: L.rose, fontWeight: '900', fontSize: 9 }}>Revoke Approval</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* REJECTION REASON MODAL */}
            <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', padding: 14 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: L.roseBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ color: L.rose, fontWeight: '900', fontSize: 12 }}>Decline / Revoke Verification</Text>
                            <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                                <Ionicons name="close-circle" size={18} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 6 }}>Select or enter a reason for declining this request:</Text>

                        {/* Preset Rejection Reason Chips */}
                        <View style={{ gap: 4, marginBottom: 10 }}>
                            {presetRejectionReasons.map((preset, idx) => (
                                <TouchableOpacity 
                                    key={idx}
                                    onPress={() => setRejectionReason(preset)}
                                    style={{
                                        backgroundColor: rejectionReason === preset ? L.roseBg : L.bg,
                                        paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
                                        borderWidth: 1, borderColor: rejectionReason === preset ? L.roseBorder : L.inputBorder
                                    }}
                                >
                                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: rejectionReason === preset ? L.rose : L.textSecondary }}>
                                        • {preset}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>Custom Reason Note:</Text>
                        <View style={{ backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 8, height: 44, marginBottom: 10 }}>
                            <TextInput
                                value={rejectionReason}
                                onChangeText={setRejectionReason}
                                placeholder="Enter reason details..."
                                placeholderTextColor="#94A3B8"
                                style={{ flex: 1, color: L.textPrimary, fontWeight: '600', fontSize: 10 }}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={() => handleAction(inspectorItem, 'rejected')}
                            disabled={isActionProcessing}
                            style={{ backgroundColor: L.rose, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {isActionProcessing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Confirm Decline & Notify User</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
