import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    RefreshControl,
    ScrollView,
    Platform,
    useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

// Executive Color Tokens matching KYC Manager
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldLight: '#FEF3C7',
    goldBg: 'rgba(254, 243, 199, 0.75)',
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
    blueBorder: '#BFDBFE',
    cyan: '#06B6D4',
    cyanBg: '#ECFEFF',
    cyanBorder: '#A5F3FC'
};

interface AdminTransferQueueProps {
    onShowToast?: (msg: string) => void;
}

export default function AdminTransferQueue({ onShowToast }: AdminTransferQueueProps) {
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
    const isTabletWeb = Platform.OS === 'web' && width >= 768 && width < 1024;
    const numColumns = isDesktopWeb ? 2 : 1;

    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'pending' | 'cooldown' | 'unlocked' | 'rejected' | 'all'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal & Inspector States
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isActionProcessing, setIsActionProcessing] = useState(false);

    const showToast = (msg: string) => {
        if (onShowToast) onShowToast(msg);
        else Alert.alert('Notice', msg);
    };

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('transfer_activation_requests')
                .select(`
                    *,
                    profiles:user_id (
                        id,
                        full_name,
                        email,
                        phone,
                        kyc_tier,
                        balance,
                        transfer_status,
                        transfer_approved,
                        transfer_approved_at,
                        transfer_unlock_at,
                        transfer_rejection_reason
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching transfer activation requests:", error);
            } else {
                setRequests(data || []);
            }
        } catch (e: any) {
            console.error("Exception fetching transfer activation requests:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Helpers
    const getStatusClassification = (item: any) => {
        const reqStatus = item.status;
        const profile = item.profiles;
        if (reqStatus === 'rejected' || profile?.transfer_status === 'rejected') {
            return 'rejected';
        }
        if (reqStatus === 'approved' || profile?.transfer_approved === true) {
            const unlockTime = profile?.transfer_unlock_at ? new Date(profile.transfer_unlock_at).getTime() : 0;
            if (Date.now() < unlockTime) {
                return 'cooldown';
            }
            return 'unlocked';
        }
        return 'pending';
    };

    const formatCooldownTime = (unlockAt: string | null) => {
        if (!unlockAt) return '24h 00m';
        const diffMs = new Date(unlockAt).getTime() - Date.now();
        if (diffMs <= 0) return 'Unlocked';
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${hours}h ${mins}m left`;
    };

    // Filtered data
    const filteredRequests = useMemo(() => {
        return requests.filter(item => {
            const classification = getStatusClassification(item);
            
            // Tab filter
            if (activeFilter === 'pending' && classification !== 'pending') return false;
            if (activeFilter === 'cooldown' && classification !== 'cooldown') return false;
            if (activeFilter === 'unlocked' && classification !== 'unlocked') return false;
            if (activeFilter === 'rejected' && classification !== 'rejected') return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const name = (item.full_name || item.profiles?.full_name || '').toLowerCase();
                const email = (item.email || item.profiles?.email || '').toLowerCase();
                const phone = (item.phone || item.profiles?.phone || '').toLowerCase();
                const occ = (item.occupation || '').toLowerCase();
                const emp = (item.employer_business_name || '').toLowerCase();
                const idNum = (item.id_number || '').toLowerCase();
                const bvn = (item.bvn || '').toLowerCase();
                const cat = (item.account_category || '').toLowerCase();
                const destBank = (item.destination_bank || '').toLowerCase();
                const destAcc = (item.destination_account_number || '').toLowerCase();

                const match = name.includes(q) || email.includes(q) || phone.includes(q) ||
                              occ.includes(q) || emp.includes(q) || idNum.includes(q) ||
                              bvn.includes(q) || cat.includes(q) || destBank.includes(q) || destAcc.includes(q);
                if (!match) return false;
            }

            return true;
        });
    }, [requests, activeFilter, searchQuery]);

    // Metric counts
    const metrics = useMemo(() => {
        let pending = 0;
        let cooldown = 0;
        let unlocked = 0;
        let rejected = 0;

        requests.forEach(r => {
            const c = getStatusClassification(r);
            if (c === 'pending') pending++;
            else if (c === 'cooldown') cooldown++;
            else if (c === 'unlocked') unlocked++;
            else if (c === 'rejected') rejected++;
        });

        return { pending, cooldown, unlocked, rejected, total: requests.length };
    }, [requests]);

    // Actions
    const handleApprove = async (item: any) => {
        Alert.alert(
            "Approve Transfer Access?",
            `Are you sure you want to approve transfer privileges for ${item.full_name}?\n\nStrict 24-Hour Cooldown:\nTransfers will be locked for exactly 24 hours from approval time before the channel opens for transactions.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Approve (24h Lock)",
                    style: "default",
                    onPress: async () => {
                        try {
                            setIsActionProcessing(true);
                            const { data: { user } } = await supabase.auth.getUser();

                            const now = new Date();
                            const unlockTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

                            // 1. Update transfer_activation_requests
                            const { error: reqErr } = await supabase
                                .from('transfer_activation_requests')
                                .update({
                                    status: 'approved',
                                    reviewed_by: user?.id || null,
                                    reviewed_at: now.toISOString(),
                                    admin_notes: 'Approved via Admin KYC Panel with mandatory 24-hour maturation cooldown.',
                                    updated_at: now.toISOString()
                                })
                                .eq('id', item.id);

                            if (reqErr) throw reqErr;

                            // 2. Update profiles table
                            const { error: profErr } = await supabase
                                .from('profiles')
                                .update({
                                    kyc_tier: Math.max(item.profiles?.kyc_tier || 1, 3),
                                    transfer_status: 'approved',
                                    transfer_approved: true,
                                    transfer_approved_at: now.toISOString(),
                                    transfer_unlock_at: unlockTime.toISOString(),
                                    transfer_rejection_reason: null
                                })
                                .eq('id', item.user_id);

                            if (profErr) throw profErr;

                            // 3. Send Notification to User
                            await supabase.from('notifications').insert({
                                user_id: item.user_id,
                                title: "🛡️ Transfer Application Approved",
                                body: "Your transfer access application has been approved by compliance. For your account security, transfers will unlock in 24 hours.",
                                data: { type: 'transfer_approved', unlock_at: unlockTime.toISOString() }
                            });

                            showToast(`Transfer approved for ${item.full_name}! 24h cooldown active.`);
                            setSelectedRequest(null);
                            fetchRequests();
                        } catch (e: any) {
                            Alert.alert("Approval Error", e.message || "Failed to approve request.");
                        } finally {
                            setIsActionProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        const reason = rejectionReason.trim() || "Compliance requirements not met or unverified details.";

        try {
            setIsActionProcessing(true);
            const { data: { user } } = await supabase.auth.getUser();
            const now = new Date();

            // 1. Update transfer_activation_requests
            const { error: reqErr } = await supabase
                .from('transfer_activation_requests')
                .update({
                    status: 'rejected',
                    reviewed_by: user?.id || null,
                    reviewed_at: now.toISOString(),
                    admin_notes: reason,
                    updated_at: now.toISOString()
                })
                .eq('id', selectedRequest.id);

            if (reqErr) throw reqErr;

            // 2. Update profile
            const { error: profErr } = await supabase
                .from('profiles')
                .update({
                    transfer_status: 'rejected',
                    transfer_approved: false,
                    transfer_rejection_reason: reason
                })
                .eq('id', selectedRequest.user_id);

            if (profErr) throw profErr;

            // 3. Send Notification
            await supabase.from('notifications').insert({
                user_id: selectedRequest.user_id,
                title: "⚠️ Transfer Application Declined",
                body: `Your transfer access application was declined. Reason: ${reason}. You may re-apply with accurate details.`,
                data: { type: 'transfer_rejected', reason }
            });

            showToast("Application declined. User notified.");
            setShowRejectModal(false);
            setRejectionReason('');
            setSelectedRequest(null);
            fetchRequests();
        } catch (e: any) {
            Alert.alert("Rejection Error", e.message || "Failed to decline request.");
        } finally {
            setIsActionProcessing(false);
        }
    };

    const handleRevoke = async (item: any) => {
        Alert.alert(
            "Revoke Transfer Access?",
            `Are you sure you want to immediately lock and revoke transfer privileges for ${item.full_name}? The user will not be able to transfer funds until re-approved.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Revoke Privileges",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsActionProcessing(true);
                            await supabase
                                .from('profiles')
                                .update({
                                    transfer_status: 'rejected',
                                    transfer_approved: false,
                                    transfer_rejection_reason: 'Revoked by compliance administration.'
                                })
                                .eq('id', item.user_id);

                            await supabase
                                .from('transfer_activation_requests')
                                .update({
                                    status: 'rejected',
                                    admin_notes: 'Revoked by administration.'
                                })
                                .eq('id', item.id);

                            await supabase.from('notifications').insert({
                                user_id: item.user_id,
                                title: "🔒 Transfer Privileges Suspended",
                                body: "Your transfer access has been suspended by compliance administration. Please contact support.",
                                data: { type: 'transfer_revoked' }
                            });

                            showToast(`Transfer privileges revoked for ${item.full_name}`);
                            setSelectedRequest(null);
                            fetchRequests();
                        } catch (e: any) {
                            Alert.alert("Error", e.message || "Failed to revoke.");
                        } finally {
                            setIsActionProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    // Render individual card
    const renderRequestCard = ({ item }: { item: any }) => {
        const classification = getStatusClassification(item);
        const profile = item.profiles;
        const cooldownRemaining = formatCooldownTime(profile?.transfer_unlock_at);

        return (
            <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setSelectedRequest(item)}
                style={{
                    backgroundColor: L.card,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: classification === 'pending' ? L.gold : L.inputBorder,
                    elevation: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    flex: numColumns > 1 ? 1 / numColumns : undefined
                }}
            >
                {/* Top Row: User Name & Status Badge */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: L.textPrimary }}>
                                {item.full_name || profile?.full_name || 'Anonymous User'}
                            </Text>
                            <View style={{ backgroundColor: L.goldLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 0.8, borderColor: L.goldDk }}>
                                <Text style={{ fontSize: 8, fontWeight: '900', color: L.goldAmber }}>
                                    TIER {profile?.kyc_tier ?? 3}
                                </Text>
                            </View>
                            {item.account_category && (
                                <View style={{ backgroundColor: item.account_category === 'Corporate' ? '#F3E8FF' : '#E0F2FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 0.8, borderColor: item.account_category === 'Corporate' ? '#C084FC' : '#7DD3FC' }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: item.account_category === 'Corporate' ? '#7E22CE' : '#0369A1' }}>
                                        {item.account_category.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            {item.bvn ? (
                                <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 0.8, borderColor: L.emeraldBorder }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: L.emerald }}>
                                        BVN ✓
                                    </Text>
                                </View>
                            ) : null}
                            {item.pep_declared ? (
                                <View style={{ backgroundColor: L.roseBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 0.8, borderColor: L.roseBorder }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: L.rose }}>
                                        PEP ⚠️
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <Text style={{ fontSize: 10, color: L.textMuted, marginTop: 2 }}>
                            {item.email || profile?.email || item.phone || profile?.phone}
                        </Text>
                    </View>

                    {/* Status Badge */}
                    {classification === 'pending' && (
                        <View style={{ backgroundColor: L.goldLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.goldDk, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="time" size={10} color={L.goldAmber} />
                            <Text style={{ fontSize: 8, fontWeight: '900', color: L.goldAmber }}>PENDING</Text>
                        </View>
                    )}

                    {classification === 'cooldown' && (
                        <View style={{ backgroundColor: L.cyanBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.cyan, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="hourglass" size={10} color={L.cyan} />
                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#0E7490' }}>24H LOCK ({cooldownRemaining})</Text>
                        </View>
                    )}

                    {classification === 'unlocked' && (
                        <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.emeraldBorder, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="shield-checkmark" size={10} color={L.emerald} />
                            <Text style={{ fontSize: 8, fontWeight: '900', color: L.emerald }}>ACTIVE / UNLOCKED</Text>
                        </View>
                    )}

                    {classification === 'rejected' && (
                        <View style={{ backgroundColor: L.roseBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.roseBorder, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="close-circle" size={10} color={L.rose} />
                            <Text style={{ fontSize: 8, fontWeight: '900', color: L.rose }}>DECLINED</Text>
                        </View>
                    )}
                </View>

                {/* Key Details Grid */}
                <View style={{ backgroundColor: L.bg, borderRadius: 10, padding: 10, gap: 6, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>Occupation & Employer:</Text>
                        <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>
                            {item.occupation} • {item.employer_business_name}
                        </Text>
                    </View>
                    {item.cac_number ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>CAC Reg. Number:</Text>
                            <Text style={{ fontSize: 10, color: L.goldAmber, fontWeight: '900' }}>
                                {item.cac_number}
                            </Text>
                        </View>
                    ) : null}
                    {item.destination_bank ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>Settlement Bank:</Text>
                            <Text style={{ fontSize: 10, color: L.navyHeader, fontWeight: '800' }}>
                                {item.destination_bank} • {item.destination_account_number || ''}
                            </Text>
                        </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>Source of Funds:</Text>
                        <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>
                            {item.source_of_funds}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>Est. Monthly Volume:</Text>
                        <Text style={{ fontSize: 10, color: L.emerald, fontWeight: '900' }}>
                            ₦{item.estimated_monthly_volume}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>Transfer Purpose:</Text>
                        <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 8 }} numberOfLines={1}>
                            {item.purpose}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 10, color: L.textMuted, fontWeight: '600' }}>Next of Kin:</Text>
                        <Text style={{ fontSize: 10, color: L.textSecondary, fontWeight: '800' }}>
                            {item.next_of_kin_name} ({item.next_of_kin_relationship})
                        </Text>
                    </View>
                </View>

                {/* Action Buttons Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontSize: 9, color: L.textMuted }}>
                        Applied: {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {classification === 'pending' && (
                            <>
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedRequest(item);
                                        setShowRejectModal(true);
                                    }}
                                    style={{ backgroundColor: L.roseBg, borderWidth: 1, borderColor: L.roseBorder, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                                >
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: L.rose }}>DECLINE</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleApprove(item)}
                                    style={{ backgroundColor: L.navyHeader, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: L.gold }}
                                >
                                    <Ionicons name="lock-closed" size={10} color={L.gold} />
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: L.gold }}>APPROVE (24H)</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {(classification === 'cooldown' || classification === 'unlocked') && (
                            <TouchableOpacity
                                onPress={() => handleRevoke(item)}
                                style={{ backgroundColor: L.roseBg, borderWidth: 1, borderColor: L.roseBorder, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                            >
                                <Text style={{ fontSize: 9, fontWeight: '900', color: L.rose }}>REVOKE ACCESS</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => setSelectedRequest(item)}
                            style={{ backgroundColor: L.bg, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                        >
                            <Text style={{ fontSize: 9, fontWeight: '800', color: L.textSecondary }}>DETAILS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            {/* Search Input Bar */}
            <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 38 }}>
                    <Ionicons name="search-outline" size={14} color={L.goldDk} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search applicant name, email, employer, ID..."
                        placeholderTextColor={L.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: L.textPrimary, fontWeight: '600', fontSize: 11 }}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={14} color={L.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Metrics Strip */}
            <View style={{ backgroundColor: L.card, paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>Pending</Text>
                    <Text style={{ color: metrics.pending > 0 ? L.rose : L.navyHeader, fontSize: 13, fontWeight: '900' }}>{metrics.pending}</Text>
                </View>
                <View style={{ width: 1, height: 20, backgroundColor: L.inputBorder }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>24h Lock</Text>
                    <Text style={{ color: L.cyan, fontSize: 13, fontWeight: '900' }}>{metrics.cooldown}</Text>
                </View>
                <View style={{ width: 1, height: 20, backgroundColor: L.inputBorder }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>Unlocked</Text>
                    <Text style={{ color: L.emerald, fontSize: 13, fontWeight: '900' }}>{metrics.unlocked}</Text>
                </View>
                <View style={{ width: 1, height: 20, backgroundColor: L.inputBorder }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>Declined</Text>
                    <Text style={{ color: L.rose, fontSize: 13, fontWeight: '900' }}>{metrics.rejected}</Text>
                </View>
            </View>

            {/* Filter Tabs */}
            <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <TouchableOpacity
                        onPress={() => setActiveFilter('pending')}
                        style={{
                            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
                            backgroundColor: activeFilter === 'pending' ? L.navyHeader : L.card,
                            borderColor: activeFilter === 'pending' ? L.gold : L.inputBorder
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: activeFilter === 'pending' ? L.gold : L.textSecondary }}>
                            Pending Review ({metrics.pending})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveFilter('cooldown')}
                        style={{
                            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
                            backgroundColor: activeFilter === 'cooldown' ? L.navyHeader : L.card,
                            borderColor: activeFilter === 'cooldown' ? L.cyan : L.inputBorder
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: activeFilter === 'cooldown' ? L.cyan : L.textSecondary }}>
                            24h Cooldown ({metrics.cooldown})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveFilter('unlocked')}
                        style={{
                            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
                            backgroundColor: activeFilter === 'unlocked' ? L.navyHeader : L.card,
                            borderColor: activeFilter === 'unlocked' ? L.emerald : L.inputBorder
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: activeFilter === 'unlocked' ? L.emerald : L.textSecondary }}>
                            Active Transfers ({metrics.unlocked})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveFilter('rejected')}
                        style={{
                            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
                            backgroundColor: activeFilter === 'rejected' ? L.navyHeader : L.card,
                            borderColor: activeFilter === 'rejected' ? L.rose : L.inputBorder
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: activeFilter === 'rejected' ? L.rose : L.textSecondary }}>
                            Declined ({metrics.rejected})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveFilter('all')}
                        style={{
                            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
                            backgroundColor: activeFilter === 'all' ? L.navyHeader : L.card,
                            borderColor: activeFilter === 'all' ? L.navyHeader : L.inputBorder
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: activeFilter === 'all' ? L.gold : L.textSecondary }}>
                            All ({metrics.total})
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* List */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <ActivityIndicator size="large" color={L.goldDk} />
                    <Text style={{ marginTop: 10, color: L.textMuted, fontSize: 11, fontWeight: '700' }}>Loading Transfer Queue...</Text>
                </View>
            ) : (
                <FlatList
                    key={`transfer-queue-grid-${numColumns}`}
                    data={filteredRequests}
                    keyExtractor={(item) => item.id}
                    numColumns={numColumns}
                    columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
                    renderItem={renderRequestCard}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />
                    }
                    ListEmptyComponent={
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 30, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 1, borderColor: L.inputBorder }}>
                            <Ionicons name="shield-checkmark-outline" size={42} color={L.textMuted} />
                            <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', marginTop: 12 }}>No Transfer Requests Found</Text>
                            <Text style={{ color: L.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                                {searchQuery ? "No applicant matches your search query." : "There are currently no requests in this category."}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Full Inspector Modal */}
            <Modal visible={!!selectedRequest && !showRejectModal} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: (isDesktopWeb || isTabletWeb) ? 'center' : 'flex-end', alignItems: (isDesktopWeb || isTabletWeb) ? 'center' : 'stretch', padding: (isDesktopWeb || isTabletWeb) ? 20 : 0 }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderRadius: (isDesktopWeb || isTabletWeb) ? 24 : undefined, width: '100%', maxWidth: 720, alignSelf: 'center', maxHeight: '90%', paddingBottom: Platform.OS === 'ios' ? 34 : 20, overflow: 'hidden' }}>
                        {/* Header */}
                        <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 16, paddingVertical: 14, borderTopLeftRadius: (isDesktopWeb || isTabletWeb) ? 24 : 24, borderTopRightRadius: (isDesktopWeb || isTabletWeb) ? 24 : 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ color: L.gold, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' }}>TRANSFER COMPLIANCE DOSSIER</Text>
                                <Text style={{ color: '#94A3B8', fontSize: 10 }}>Application ID: {selectedRequest?.id.slice(0, 8)}...</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedRequest(null)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 16 }}>
                            {selectedRequest && (
                                <>
                                    {/* User Banner */}
                                    <View style={{ backgroundColor: L.bg, padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: L.inputBorder }}>
                                        <Text style={{ fontSize: 14, fontWeight: '900', color: L.textPrimary }}>{selectedRequest.full_name}</Text>
                                        <Text style={{ fontSize: 11, color: L.textMuted, marginTop: 2 }}>
                                            Phone: {selectedRequest.phone || selectedRequest.profiles?.phone} • Email: {selectedRequest.email || selectedRequest.profiles?.email}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                            <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                                <Text style={{ fontSize: 9, fontWeight: '900', color: L.emerald }}>
                                                    TIER {selectedRequest.profiles?.kyc_tier ?? 3} VERIFIED
                                                </Text>
                                            </View>
                                            {selectedRequest.account_category && (
                                                <View style={{ backgroundColor: selectedRequest.account_category === 'Corporate' ? '#F3E8FF' : '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: selectedRequest.account_category === 'Corporate' ? '#C084FC' : '#7DD3FC' }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: selectedRequest.account_category === 'Corporate' ? '#7E22CE' : '#0369A1' }}>
                                                        {selectedRequest.account_category.toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedRequest.bvn ? (
                                                <View style={{ backgroundColor: L.goldLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: L.goldDk }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: L.goldAmber }}>
                                                        BVN: {selectedRequest.bvn}
                                                    </Text>
                                                </View>
                                            ) : null}
                                            {selectedRequest.pep_declared ? (
                                                <View style={{ backgroundColor: L.roseBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: L.roseBorder }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: L.rose }}>
                                                        PEP DECLARED ⚠️
                                                    </Text>
                                                </View>
                                            ) : null}
                                            <Text style={{ fontSize: 10, color: L.textSecondary, fontWeight: '700' }}>
                                                Balance: ₦{Number(selectedRequest.profiles?.balance || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 24-Hour Notice Alert */}
                                    <View style={{ backgroundColor: L.goldBg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: L.goldDk, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="lock-closed" size={18} color={L.goldAmber} />
                                        <Text style={{ fontSize: 10, color: L.goldAmber, fontWeight: '800', flex: 1, lineHeight: 14 }}>
                                            Security Rule: Once approved by an Admin, transfers remain locked for exactly 24 hours to prevent unauthorized account takeovers.
                                        </Text>
                                    </View>

                                    {/* Section 1: Account & Regulatory KYC */}
                                    <Text style={{ fontSize: 11, fontWeight: '900', color: L.navyHeader, textTransform: 'uppercase', marginBottom: 6 }}>Regulatory & KYC Identity</Text>
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Account Classification:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.account_category || 'Individual / Personal'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Bank Verification No (BVN):</Text>
                                            <Text style={{ fontSize: 10, color: selectedRequest.bvn ? L.goldAmber : L.textMuted, fontWeight: '900' }}>
                                                {selectedRequest.bvn || 'Not Supplied'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Govt. ID Document:</Text>
                                            <Text style={{ fontSize: 10, color: L.navyHeader, fontWeight: '900' }}>
                                                {selectedRequest.id_type?.toUpperCase()}: {selectedRequest.id_number}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Security Challenge Word:</Text>
                                            <Text style={{ fontSize: 10, color: selectedRequest.security_secret_word ? L.textPrimary : L.textMuted, fontWeight: '800' }}>
                                                {selectedRequest.security_secret_word || 'None Provided'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 6, marginTop: 2 }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>PEP Declaration:</Text>
                                            <Text style={{ fontSize: 10, color: selectedRequest.pep_declared ? L.rose : L.emerald, fontWeight: '900' }}>
                                                {selectedRequest.pep_declared ? '⚠️ Politically Exposed Person (PEP)' : 'Standard / Non-PEP Confirmed'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Section 2: Settlement / Beneficiary Account */}
                                    <Text style={{ fontSize: 11, fontWeight: '900', color: L.navyHeader, textTransform: 'uppercase', marginBottom: 6 }}>Designated Settlement Bank</Text>
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Destination Bank:</Text>
                                            <Text style={{ fontSize: 10, color: L.navyHeader, fontWeight: '900' }}>
                                                {selectedRequest.destination_bank || 'Not Specified'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Account Number (NUBAN):</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>
                                                {selectedRequest.destination_account_number || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Account Beneficiary Name:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>
                                                {selectedRequest.destination_account_name || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 6, marginTop: 2 }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Daily Transfer Frequency:</Text>
                                            <Text style={{ fontSize: 10, color: L.emerald, fontWeight: '900' }}>
                                                {selectedRequest.daily_transfer_frequency || '1 - 5 transfers/day'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Section 3: Financial & Employment */}
                                    <Text style={{ fontSize: 11, fontWeight: '900', color: L.navyHeader, textTransform: 'uppercase', marginBottom: 6 }}>Financial & Employment Profile</Text>
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Occupation:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.occupation}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Employer / Business:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.employer_business_name}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>CAC Reg. Number:</Text>
                                            <Text style={{ fontSize: 10, color: selectedRequest.cac_number ? L.goldAmber : L.textMuted, fontWeight: '800' }}>
                                                {selectedRequest.cac_number || 'N/A (Individual)'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Source of Funds:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.source_of_funds}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Originating Bank:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.originating_bank || 'Not Specified'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Transfer Purpose:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.purpose}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Est. Monthly Volume:</Text>
                                            <Text style={{ fontSize: 10, color: L.emerald, fontWeight: '900' }}>₦{selectedRequest.estimated_monthly_volume}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Avg Transfer Amount:</Text>
                                            <Text style={{ fontSize: 10, color: L.emerald, fontWeight: '900' }}>₦{selectedRequest.average_transfer_amount}</Text>
                                        </View>
                                    </View>

                                    {/* Section 4: Residential Address */}
                                    <Text style={{ fontSize: 11, fontWeight: '900', color: L.navyHeader, textTransform: 'uppercase', marginBottom: 6 }}>Residential Address</Text>
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.residential_address}</Text>
                                        <Text style={{ fontSize: 10, color: L.textSecondary }}>City: {selectedRequest.city} • State: {selectedRequest.state}</Text>
                                        {selectedRequest.nearest_landmark && (
                                            <Text style={{ fontSize: 9, color: L.textMuted }}>Landmark: {selectedRequest.nearest_landmark}</Text>
                                        )}
                                    </View>

                                    {/* Section 5: Next of Kin */}
                                    <Text style={{ fontSize: 11, fontWeight: '900', color: L.navyHeader, textTransform: 'uppercase', marginBottom: 6 }}>Next of Kin & AML Confirmation</Text>
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Next of Kin Name:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.next_of_kin_name}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Relationship:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.next_of_kin_relationship}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 10, color: L.textMuted }}>Phone Number:</Text>
                                            <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800' }}>{selectedRequest.next_of_kin_phone}</Text>
                                        </View>
                                        {selectedRequest.next_of_kin_address && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 10, color: L.textMuted }}>Contact Address:</Text>
                                                <Text style={{ fontSize: 10, color: L.textPrimary, fontWeight: '800', flex: 1, textAlign: 'right', marginLeft: 8 }}>
                                                    {selectedRequest.next_of_kin_address}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 6 }}>
                                            <Ionicons name="checkmark-circle" size={14} color={L.emerald} />
                                            <Text style={{ fontSize: 9, color: L.emerald, fontWeight: '800' }}>AML / Anti-Fraud Legal Terms Accepted</Text>
                                        </View>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={{ gap: 8, marginTop: 8 }}>
                                        {getStatusClassification(selectedRequest) === 'pending' && (
                                            <>
                                                <TouchableOpacity
                                                    onPress={() => handleApprove(selectedRequest)}
                                                    disabled={isActionProcessing}
                                                    style={{ backgroundColor: L.navyHeader, paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: L.gold }}
                                                >
                                                    {isActionProcessing ? (
                                                        <ActivityIndicator size="small" color={L.gold} />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="shield-checkmark" size={16} color={L.gold} />
                                                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 12 }}>APPROVE WITH 24H LOCK</Text>
                                                        </>
                                                    )}
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    onPress={() => setShowRejectModal(true)}
                                                    disabled={isActionProcessing}
                                                    style={{ backgroundColor: L.roseBg, borderWidth: 1, borderColor: L.roseBorder, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                                                >
                                                    <Text style={{ color: L.rose, fontWeight: '900', fontSize: 11 }}>DECLINE REQUEST</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}

                                        {(getStatusClassification(selectedRequest) === 'cooldown' || getStatusClassification(selectedRequest) === 'unlocked') && (
                                            <TouchableOpacity
                                                onPress={() => handleRevoke(selectedRequest)}
                                                disabled={isActionProcessing}
                                                style={{ backgroundColor: L.roseBg, borderWidth: 1, borderColor: L.roseBorder, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                                            >
                                                <Text style={{ color: L.rose, fontWeight: '900', fontSize: 11 }}>SUSPEND / REVOKE TRANSFER PRIVILEGES</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Reject Modal */}
            <Modal visible={showRejectModal} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 520, padding: 18 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: L.rose }}>Decline Transfer Application</Text>
                            <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                                <Ionicons name="close" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 11, color: L.textSecondary, marginBottom: 8 }}>
                            Please specify the reason for declining this request. The applicant will be notified and given the opportunity to re-apply.
                        </Text>

                        {/* Presets */}
                        <View style={{ gap: 4, marginBottom: 10 }}>
                            {[
                                "Incomplete next of kin information",
                                "Employment details unverified",
                                "Address does not match KYC documentation",
                                "Disproportionate volume for declared occupation",
                                "Please re-submit with verifiable identification"
                            ].map((preset, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => setRejectionReason(preset)}
                                    style={{ backgroundColor: L.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.8, borderColor: L.inputBorder }}
                                >
                                    <Text style={{ fontSize: 9, color: L.textSecondary, fontWeight: '700' }}>• {preset}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            placeholder="Type specific rejection reason..."
                            placeholderTextColor={L.textMuted}
                            multiline
                            style={{ backgroundColor: L.bg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, padding: 10, height: 70, fontSize: 11, color: L.textPrimary, textAlignVertical: 'top', marginBottom: 12 }}
                        />

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => setShowRejectModal(false)}
                                style={{ flex: 1, backgroundColor: L.bg, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                            >
                                <Text style={{ color: L.textSecondary, fontWeight: '800', fontSize: 11 }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleReject}
                                disabled={isActionProcessing}
                                style={{ flex: 1, backgroundColor: L.rose, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                            >
                                {isActionProcessing ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11 }}>Confirm Decline</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
