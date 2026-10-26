import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
    Alert, KeyboardAvoidingView, Platform, Switch, Share, Modal, StyleSheet
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

// Executive Royal Light Palette (Consistent with Brand)
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    navy: '#0F172A',
    navyLight: '#1E293B',
    gold: '#D97706',
    goldLight: '#FEF3C7',
    goldBorder: '#FDE68A',
    emerald: '#059669',
    emeraldLight: '#D1FAE5',
    blue: '#2563EB',
    blueLight: '#DBEAFE',
    red: '#DC2626',
    redLight: '#FEE2E2',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    textMuted: '#64748B',
    textDim: '#94A3B8',
};

interface ReferralItem {
    id: string;
    status: 'paid' | 'pending' | 'revoked';
    reward_amount: number;
    created_at: string;
    referrer_id?: string;
    referee_id?: string;
    referrer?: {
        id?: string;
        username?: string;
        full_name?: string;
    };
    referee?: {
        id?: string;
        username?: string;
        full_name?: string;
        avatar_url?: string;
    };
}

export default function ReferralSettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Config State
    const [rewardAmount, setRewardAmount] = useState('500');
    const [referralUrl, setReferralUrl] = useState('https://abumafhal.com.ng');
    const [minWithdrawal, setMinWithdrawal] = useState('1000');
    const [systemEnabled, setSystemEnabled] = useState(true);

    // Data State
    const [stats, setStats] = useState({ totalReferrals: 0, totalPaid: 0, pendingAmount: 0 });
    const [allReferrals, setAllReferrals] = useState<ReferralItem[]>([]);
    const [filteredReferrals, setFilteredReferrals] = useState<ReferralItem[]>([]);
    const [topReferrers, setTopReferrers] = useState<{ name: string; count: number }[]>([]);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

    // Management Modal State
    const [selectedReferral, setSelectedReferral] = useState<ReferralItem | null>(null);

    const fetchSettingsAndData = useCallback(async () => {
        try {
            // 1. Fetch Configs from app_settings
            const { data: settings } = await supabase
                .from('app_settings')
                .select('*')
                .in('key', ['referral_reward', 'referral_url', 'referral_enabled', 'min_withdrawal']);

            settings?.forEach(item => {
                if (item.key === 'referral_reward') {
                    const amt = item.value?.amount !== undefined ? item.value.amount : item.value;
                    if (amt !== undefined) setRewardAmount(String(amt));
                }
                if (item.key === 'referral_url') {
                    const u = item.value?.url || item.value;
                    if (u) setReferralUrl(String(u));
                }
                if (item.key === 'referral_enabled') {
                    const en = item.value?.enabled !== undefined ? item.value.enabled : item.value;
                    if (en !== undefined) setSystemEnabled(Boolean(en));
                }
                if (item.key === 'min_withdrawal') {
                    const mw = item.value?.amount !== undefined ? item.value.amount : item.value;
                    if (mw !== undefined) setMinWithdrawal(String(mw));
                }
            });

            // 2. Fetch Referrals Data with Fallback
            let combinedReferrals: ReferralItem[] = [];

            // Primary query with join
            const { data: referrals, error: refError } = await supabase
                .from('referrals')
                .select(`
                    id, status, reward_amount, created_at,
                    referrer_id, referee_id,
                    referrer:referrer_id(id, username, full_name),
                    referee:referee_id(id, username, full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (!refError && referrals && referrals.length > 0) {
                combinedReferrals = referrals as any;
            } else {
                // Raw table fallback
                const { data: rawRefs } = await supabase
                    .from('referrals')
                    .select('id, referrer_id, referee_id, status, reward_amount, created_at')
                    .order('created_at', { ascending: false });

                if (rawRefs && rawRefs.length > 0) {
                    const uids = Array.from(new Set([...rawRefs.map(r => r.referrer_id), ...rawRefs.map(r => r.referee_id)].filter(Boolean)));
                    let profMap: Record<string, any> = {};
                    if (uids.length > 0) {
                        const { data: profs } = await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', uids);
                        profs?.forEach((p: any) => { profMap[p.id] = p; });
                    }
                    combinedReferrals = rawRefs.map((r: any) => ({
                        id: r.id,
                        status: r.status || 'paid',
                        reward_amount: Number(r.reward_amount || 0),
                        created_at: r.created_at,
                        referrer_id: r.referrer_id,
                        referee_id: r.referee_id,
                        referrer: profMap[r.referrer_id] || { username: 'User' },
                        referee: profMap[r.referee_id] || { username: 'User' }
                    }));
                }
            }

            // Also check profiles with referrer_id directly
            const { data: refProfiles } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url, referrer_id, created_at')
                .not('referrer_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(100);

            if (refProfiles && refProfiles.length > 0) {
                const existingRefereeIds = new Set(combinedReferrals.map(r => r.referee_id || r.referee?.id));
                const missingUids = refProfiles.filter(p => !existingRefereeIds.has(p.id)).map(p => p.referrer_id);

                if (missingUids.length > 0) {
                    const { data: refUserProfs } = await supabase.from('profiles').select('id, username, full_name').in('id', missingUids);
                    const refMap: Record<string, any> = {};
                    refUserProfs?.forEach((p: any) => { refMap[p.id] = p; });

                    refProfiles.forEach(p => {
                        if (!existingRefereeIds.has(p.id)) {
                            combinedReferrals.push({
                                id: `prof-${p.id}`,
                                status: 'paid',
                                reward_amount: Number(rewardAmount) || 500,
                                created_at: p.created_at || new Date().toISOString(),
                                referrer_id: p.referrer_id,
                                referee_id: p.id,
                                referrer: refMap[p.referrer_id] || { username: 'Referrer' },
                                referee: {
                                    id: p.id,
                                    username: p.username,
                                    full_name: p.full_name,
                                    avatar_url: p.avatar_url
                                }
                            });
                        }
                    });
                }
            }

            // Calculate Stats
            const total = combinedReferrals.length;
            const paid = combinedReferrals.filter(r => r.status === 'paid').reduce((sum, r) => sum + (Number(r.reward_amount) || 0), 0);
            const pending = combinedReferrals.filter(r => r.status === 'pending').reduce((sum, r) => sum + (Number(r.reward_amount) || 0), 0);

            setStats({ totalReferrals: total, totalPaid: paid, pendingAmount: pending });
            setAllReferrals(combinedReferrals);
            setFilteredReferrals(combinedReferrals);

            // Leaderboard
            const leaderboard: Record<string, number> = {};
            combinedReferrals.forEach(r => {
                const name = r.referrer?.username || 'User';
                leaderboard[name] = (leaderboard[name] || 0) + 1;
            });
            const sortedLeaderboard = Object.entries(leaderboard)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));
            setTopReferrers(sortedLeaderboard);

        } catch (error: any) {
            console.warn('Fetch referral error:', error);
            Alert.alert("Notice", error.message || "Could not retrieve all referral records.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [rewardAmount]);

    useEffect(() => {
        fetchSettingsAndData();
    }, [fetchSettingsAndData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSettingsAndData();
    };

    // Filter Logic
    useEffect(() => {
        let result = allReferrals;

        if (searchQuery.trim()) {
            const lowQ = searchQuery.toLowerCase().trim();
            result = result.filter(r =>
                r.referrer?.username?.toLowerCase().includes(lowQ) ||
                r.referee?.username?.toLowerCase().includes(lowQ) ||
                r.referee?.full_name?.toLowerCase().includes(lowQ)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter(r => r.status === statusFilter);
        }

        if (dateFilter !== 'all') {
            const now = new Date();
            const todayStart = new Date(now.setHours(0, 0, 0, 0)).getTime();
            const weekStart = new Date(now.setDate(now.getDate() - 7)).getTime();

            result = result.filter(r => {
                const rTime = new Date(r.created_at).getTime();
                if (dateFilter === 'today') return rTime >= todayStart;
                if (dateFilter === 'week') return rTime >= weekStart;
                return true;
            });
        }

        setFilteredReferrals(result);
    }, [searchQuery, statusFilter, dateFilter, allReferrals]);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const cleanUrl = referralUrl
                .trim()
                .replace(/\/\(app\)/gi, '')
                .replace(/\/\(auth\)/gi, '')
                .replace(/\/referrals\/?$/gi, '')
                .replace(/\/signup\/?$/gi, '')
                .replace(/\/+$/, '');

            await supabase.from('app_settings').upsert({ key: 'referral_reward', value: { amount: Number(rewardAmount), currency: 'NGN' } });
            await supabase.from('app_settings').upsert({ key: 'referral_url', value: { url: cleanUrl } });
            await supabase.from('app_settings').upsert({ key: 'referral_enabled', value: { enabled: systemEnabled } });
            await supabase.from('app_settings').upsert({ key: 'min_withdrawal', value: { amount: Number(minWithdrawal) } });
            Alert.alert("Success 🎉", "Referral configuration updated successfully!");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update configuration.");
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        if (filteredReferrals.length === 0) {
            Alert.alert("No Data", "Nothing to export based on current filters.");
            return;
        }

        let csv = "ID,Date,Referrer,Referee,Amount(NGN),Status\n";
        filteredReferrals.forEach(r => {
            const date = new Date(r.created_at).toLocaleDateString();
            csv += `"${r.id}","${date}","${r.referrer?.username || ''}","${r.referee?.username || ''}",${r.reward_amount},"${r.status}"\n`;
        });

        try {
            await Share.share({
                title: 'AbuMafhal_Referrals_Report.csv',
                message: csv
            });
        } catch (error: any) {
            Alert.alert("Export Notice", error.message || "Could not complete export.");
        }
    };

    const updateStatus = async (status: 'paid' | 'pending') => {
        if (!selectedReferral) return;
        try {
            if (!selectedReferral.id.startsWith('prof-')) {
                const { error } = await supabase
                    .from('referrals')
                    .update({ status })
                    .eq('id', selectedReferral.id);

                if (error) throw error;
            }

            const updated = allReferrals.map(r => r.id === selectedReferral.id ? { ...r, status } : r);
            setAllReferrals(updated);
            setSelectedReferral(null);
            Alert.alert("Success", `Referral marked as ${status.toUpperCase()}!`);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Could not update status.");
        }
    };

    const revokeReward = async () => {
        if (!selectedReferral) return;
        try {
            if (!selectedReferral.id.startsWith('prof-')) {
                const { error } = await supabase
                    .from('referrals')
                    .update({ reward_amount: 0, status: 'pending' })
                    .eq('id', selectedReferral.id);

                if (error) throw error;
            }

            const updated = allReferrals.map(r => r.id === selectedReferral.id ? { ...r, reward_amount: 0, status: 'pending' as const } : r);
            setAllReferrals(updated);
            setSelectedReferral(null);
            Alert.alert("Revoked", "Referral reward set to ₦0.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to revoke reward.");
        }
    };

    const viewUserProfile = (userId?: string) => {
        setSelectedReferral(null);
        router.push('/manage/users' as any);
        if (userId) {
            Alert.alert("Staff Lookup", `Navigated to Users. Lookup User ID: ${userId.substring(0, 8)}...`);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: "Affiliate Referrals Manager",
                    headerStyle: { backgroundColor: C.navy },
                    headerTintColor: '#FFFFFF',
                    headerTitleStyle: { fontWeight: '800', fontSize: 16 },
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={handleExport} style={styles.exportHeaderBtn} activeOpacity={0.8}>
                            <Ionicons name="share-outline" size={17} color="#FFFFFF" />
                            <Text style={styles.exportHeaderBtnText}>Export</Text>
                        </TouchableOpacity>
                    )
                }}
            />

            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={C.gold} />
                    <Text style={styles.loadingText}>Loading Referral System Data...</Text>
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>

                        {/* Top Overview Cards */}
                        <View style={styles.statsRow}>
                            <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.statCardHero}>
                                <Text style={styles.statHeroLabel}>TOTAL REFERRALS</Text>
                                <Text style={styles.statHeroVal}>{stats.totalReferrals}</Text>
                                <Text style={styles.statHeroSub}>All-Time Network Registrations</Text>
                            </LinearGradient>

                            <View style={styles.statCardSide}>
                                <View style={styles.statSubBox}>
                                    <Text style={styles.statSubLabel}>PENDING PAYOUT</Text>
                                    <Text style={[styles.statSubVal, { color: C.gold }]}>₦{stats.pendingAmount.toLocaleString()}</Text>
                                </View>
                                <View style={[styles.statSubBox, { borderTopWidth: 1, borderTopColor: C.borderLight }]}>
                                    <Text style={styles.statSubLabel}>TOTAL REWARD PAID</Text>
                                    <Text style={[styles.statSubVal, { color: C.emerald }]}>₦{stats.totalPaid.toLocaleString()}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Master System On/Off Switch */}
                        <View style={styles.card}>
                            <View style={styles.switchRow}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={[styles.dotLive, { backgroundColor: systemEnabled ? C.emerald : C.red }]} />
                                        <Text style={styles.cardTitle}>Affiliate Program Status</Text>
                                    </View>
                                    <Text style={styles.cardSub}>
                                        {systemEnabled
                                            ? "System is ACTIVE. Users receive automatic instant referral credits."
                                            : "System is PAUSED. Registration tracking continues, payouts halted."}
                                    </Text>
                                </View>
                                <Switch
                                    value={systemEnabled}
                                    onValueChange={setSystemEnabled}
                                    trackColor={{ false: "#CBD5E1", true: "#F59E0B" }}
                                    thumbColor={systemEnabled ? "#0F172A" : "#F8FAFC"}
                                />
                            </View>
                        </View>

                        {/* Configuration Form */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="settings" size={17} color={C.gold} />
                                <Text style={styles.cardTitle}>Global Referral Settings</Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>REWARD PER SIGNUP (₦)</Text>
                                    <TextInput
                                        value={rewardAmount}
                                        onChangeText={setRewardAmount}
                                        keyboardType="numeric"
                                        style={styles.inputBox}
                                        placeholder="500"
                                        placeholderTextColor={C.textDim}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>MIN WITHDRAWAL (₦)</Text>
                                    <TextInput
                                        value={minWithdrawal}
                                        onChangeText={setMinWithdrawal}
                                        keyboardType="numeric"
                                        style={styles.inputBox}
                                        placeholder="1000"
                                        placeholderTextColor={C.textDim}
                                    />
                                </View>
                            </View>

                            <View style={{ marginTop: 12 }}>
                                <Text style={styles.inputLabel}>BASE DOMAIN / REFERRAL URL</Text>
                                <View style={styles.urlInputBox}>
                                    <Ionicons name="link-outline" size={18} color={C.textDim} style={{ marginRight: 6 }} />
                                    <TextInput
                                        value={referralUrl}
                                        onChangeText={setReferralUrl}
                                        autoCapitalize="none"
                                        style={styles.urlInput}
                                        placeholder="https://abumafhal.com.ng"
                                        placeholderTextColor={C.textDim}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={saveSettings}
                                disabled={saving}
                                style={styles.saveBtn}
                                activeOpacity={0.8}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="save" size={16} color="#FFFFFF" />
                                        <Text style={styles.saveBtnText}>Save Configuration Changes</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Top Referrers Leaderboard */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="trophy" size={18} color={C.gold} />
                                <Text style={styles.cardTitle}>Top Referrers Leaderboard 🏆</Text>
                            </View>

                            {topReferrers.length === 0 ? (
                                <Text style={styles.emptyNote}>No referral records available yet.</Text>
                            ) : (
                                topReferrers.map((user, index) => (
                                    <View key={user.name + index} style={[styles.leaderRow, index === topReferrers.length - 1 && { borderBottomWidth: 0 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={[styles.rankBadge, index === 0 ? { backgroundColor: C.goldLight } : { backgroundColor: '#F1F5F9' }]}>
                                                <Text style={[styles.rankBadgeText, index === 0 ? { color: C.gold } : { color: C.textMuted }]}>
                                                    #{index + 1}
                                                </Text>
                                            </View>
                                            <Text style={styles.leaderName}>@{user.name}</Text>
                                        </View>
                                        <View style={styles.leaderCountBadge}>
                                            <Text style={styles.leaderCountText}>{user.count} Referrals</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Detailed Referral Activity Log */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="list" size={18} color={C.navy} />
                                <Text style={styles.cardTitle}>Referral Audit & Operations</Text>
                            </View>

                            {/* Search Input */}
                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={16} color={C.textDim} />
                                <TextInput
                                    placeholder="Search referrer or referee username..."
                                    placeholderTextColor={C.textDim}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    style={styles.searchInput}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={16} color={C.textDim} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Filter Chips */}
                            <View style={styles.filterRow}>
                                {(['all', 'paid', 'pending'] as const).map(s => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => setStatusFilter(s)}
                                        style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                                    >
                                        <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                                            {s.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}

                                <View style={{ width: 1, height: 16, backgroundColor: C.border, marginHorizontal: 4 }} />

                                {(['all', 'today', 'week'] as const).map(d => (
                                    <TouchableOpacity
                                        key={d}
                                        onPress={() => setDateFilter(d)}
                                        style={[styles.filterChip, dateFilter === d && { backgroundColor: C.navy, borderColor: C.navy }]}
                                    >
                                        <Text style={[styles.filterChipText, dateFilter === d && { color: '#FFFFFF' }]}>
                                            {d === 'all' ? 'ANYTIME' : d.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Referrals List */}
                            {filteredReferrals.length === 0 ? (
                                <View style={styles.emptyList}>
                                    <Ionicons name="people-outline" size={36} color={C.textDim} />
                                    <Text style={styles.emptyListText}>No referrals match your current filters.</Text>
                                </View>
                            ) : (
                                filteredReferrals.map((item, idx) => {
                                    const isPaid = item.status === 'paid';
                                    const refName = item.referee?.full_name || (item.referee?.username ? `@${item.referee.username}` : 'New User');
                                    const inviter = item.referrer?.username ? `@${item.referrer.username}` : 'Direct Link';
                                    const rewardVal = Number(item.reward_amount) || 0;

                                    return (
                                        <TouchableOpacity
                                            key={item.id || idx}
                                            onPress={() => setSelectedReferral(item)}
                                            style={[
                                                styles.referralItem,
                                                idx === filteredReferrals.length - 1 && { borderBottomWidth: 0 }
                                            ]}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                                <View style={[styles.refereeAvatar, isPaid ? { backgroundColor: C.emeraldLight } : { backgroundColor: C.goldLight }]}>
                                                    <Ionicons name="person" size={17} color={isPaid ? C.emerald : C.gold} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.refereeName} numberOfLines={1}>{refName}</Text>
                                                    <Text style={styles.inviterName}>
                                                        Referred by: <Text style={{ color: C.navy, fontWeight: '700' }}>{inviter}</Text>
                                                    </Text>
                                                    <Text style={styles.refDate}>{new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                                </View>
                                            </View>

                                            <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                                                <View style={[styles.statusBadge, isPaid ? { backgroundColor: C.emeraldLight } : { backgroundColor: C.goldLight }]}>
                                                    <Text style={[styles.statusBadgeText, { color: isPaid ? C.emerald : C.gold }]}>
                                                        {item.status.toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={styles.amountText}>₦{rewardVal.toLocaleString()}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>

                    </ScrollView>

                    {/* Operational Action Modal */}
                    <Modal visible={!!selectedReferral} transparent animationType="fade" onRequestClose={() => setSelectedReferral(null)}>
                        <View style={styles.modalBackdrop}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedReferral(null)} />
                            <View style={styles.modalSheet}>
                                <View style={styles.sheetHandle} />

                                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={styles.modalTitle}>Manage Referral Transaction</Text>
                                    <Text style={styles.modalSub}>Record Ref: {selectedReferral?.id.substring(0, 16)}...</Text>
                                </View>

                                <View style={styles.actionList}>
                                    <TouchableOpacity
                                        onPress={() => updateStatus(selectedReferral?.status === 'paid' ? 'pending' : 'paid')}
                                        style={styles.actionOption}
                                    >
                                        <View style={[styles.actionIconBox, { backgroundColor: selectedReferral?.status === 'paid' ? C.goldLight : C.emeraldLight }]}>
                                            <Ionicons
                                                name={selectedReferral?.status === 'paid' ? "time-outline" : "checkmark-circle-outline"}
                                                size={20}
                                                color={selectedReferral?.status === 'paid' ? C.gold : C.emerald}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.actionOptionTitle}>
                                                {selectedReferral?.status === 'paid' ? "Set as PENDING" : "Approve as PAID"}
                                            </Text>
                                            <Text style={styles.actionOptionSub}>Toggle manual commission verification</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => viewUserProfile(selectedReferral?.referee_id || selectedReferral?.referee?.id)}
                                        style={styles.actionOption}
                                    >
                                        <View style={[styles.actionIconBox, { backgroundColor: C.blueLight }]}>
                                            <Ionicons name="person-outline" size={20} color={C.blue} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.actionOptionTitle}>Inspect Referee Profile</Text>
                                            <Text style={styles.actionOptionSub}>View wallet & account records for {selectedReferral?.referee?.username || 'user'}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => viewUserProfile(selectedReferral?.referrer_id || selectedReferral?.referrer?.id)}
                                        style={styles.actionOption}
                                    >
                                        <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
                                            <Ionicons name="people-outline" size={20} color="#7C3AED" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.actionOptionTitle}>Inspect Referrer Profile</Text>
                                            <Text style={styles.actionOptionSub}>Check referral wallet balance for @{selectedReferral?.referrer?.username || 'referrer'}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={revokeReward}
                                        style={[styles.actionOption, { backgroundColor: C.redLight, borderColor: '#FECACA' }]}
                                    >
                                        <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                                            <Ionicons name="trash-outline" size={20} color={C.red} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.actionOptionTitle, { color: C.red }]}>Revoke Commission</Text>
                                            <Text style={[styles.actionOptionSub, { color: '#B91C1C' }]}>Set reward amount to ₦0 (Anti-Fraud protection)</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setSelectedReferral(null)}
                                    style={styles.modalCloseBtn}
                                >
                                    <Text style={styles.modalCloseBtnText}>Close Modal</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                </KeyboardAvoidingView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    exportHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 6,
    },
    exportHeaderBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        color: C.textMuted,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
    },
    statCardHero: {
        flex: 1.2,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 6, 0.3)',
        justifyContent: 'space-between',
    },
    statHeroLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FDE68A',
        letterSpacing: 0.5,
    },
    statHeroVal: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        marginVertical: 4,
    },
    statHeroSub: {
        fontSize: 10.5,
        color: '#94A3B8',
        fontWeight: '500',
    },
    statCardSide: {
        flex: 1,
        backgroundColor: C.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
    },
    statSubBox: {
        flex: 1,
        padding: 12,
        justifyContent: 'center',
    },
    statSubLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.textMuted,
        letterSpacing: 0.5,
    },
    statSubVal: {
        fontSize: 16,
        fontWeight: '900',
        marginTop: 2,
    },
    card: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dotLive: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
    },
    cardSub: {
        fontSize: 11.5,
        color: C.textMuted,
        marginTop: 3,
        lineHeight: 16,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: C.textMuted,
        letterSpacing: 0.5,
        marginBottom: 5,
    },
    inputBox: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        fontWeight: '700',
        color: C.navy,
    },
    urlInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    urlInput: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: '600',
        color: C.navy,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: C.navy,
        borderRadius: 10,
        paddingVertical: 12,
        marginTop: 14,
    },
    saveBtnText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    emptyNote: {
        fontSize: 12,
        color: C.textDim,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 14,
    },
    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
    },
    rankBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankBadgeText: {
        fontSize: 11,
        fontWeight: '900',
    },
    leaderName: {
        fontSize: 13,
        fontWeight: '700',
        color: C.navy,
    },
    leaderCountBadge: {
        backgroundColor: C.goldLight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    leaderCountText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.gold,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 12,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: C.navy,
        marginLeft: 6,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: C.border,
    },
    filterChipActive: {
        backgroundColor: C.gold,
        borderColor: C.gold,
    },
    filterChipText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.textMuted,
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    emptyList: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyListText: {
        fontSize: 12,
        color: C.textDim,
        marginTop: 6,
    },
    referralItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
    },
    refereeAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    refereeName: {
        fontSize: 13,
        fontWeight: '700',
        color: C.navy,
    },
    inviterName: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 1,
    },
    refDate: {
        fontSize: 10,
        color: C.textDim,
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 3,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    amountText: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: C.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 36,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#CBD5E1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: C.navy,
    },
    modalSub: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 2,
    },
    actionList: {
        gap: 10,
        marginVertical: 12,
    },
    actionOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    actionIconBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionOptionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy,
    },
    actionOptionSub: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 1,
    },
    modalCloseBtn: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 6,
    },
    modalCloseBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: C.textMuted,
    },
});
