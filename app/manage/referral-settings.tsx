import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch, FlatList, Share, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function ReferralSettings() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Config State
    const [rewardAmount, setRewardAmount] = useState('4.00');
    const [referralUrl, setReferralUrl] = useState('https://abumafhal.com.ng');
    const [minWithdrawal, setMinWithdrawal] = useState('1000');
    const [systemEnabled, setSystemEnabled] = useState(true);

    // Data Lists
    const [stats, setStats] = useState({ totalReferrals: 0, totalPaid: 0, pendingAmount: 0 });
    const [allReferrals, setAllReferrals] = useState<any[]>([]); // Store full list
    const [filteredReferrals, setFilteredReferrals] = useState<any[]>([]); // Display list
    const [topReferrers, setTopReferrers] = useState<any[]>([]);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

    // Management Action State
    const [selectedReferral, setSelectedReferral] = useState<any>(null);

    const fetchSettingsAndData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Configs
            const { data: settings, error } = await supabase
                .from('app_settings')
                .select('*')
                .in('key', ['referral_reward', 'referral_url', 'referral_enabled', 'min_withdrawal']);

            if (error) throw error;

            settings?.forEach(item => {
                if (item.key === 'referral_reward') setRewardAmount(item.value.amount.toString());
                if (item.key === 'referral_url') setReferralUrl(item.value.url);
                if (item.key === 'referral_enabled') setSystemEnabled(item.value.enabled);
                if (item.key === 'min_withdrawal') setMinWithdrawal(item.value.amount.toString());
            });

            // 2. Fetch Referrals Data
            const { data: referrals, error: refError } = await supabase
                .from('referrals')
                .select(`
                    id, status, reward_amount, created_at,
                    referrer:referrer_id(username, full_name, id),
                    referee:referee_id(username, full_name, avatar_url, id)
                `)
                .order('created_at', { ascending: false });

            if (refError) throw refError;

            // Stats Logic
            const total = referrals?.length || 0;
            const paid = referrals?.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.reward_amount, 0) || 0;
            const pending = referrals?.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.reward_amount, 0) || 0;

            setStats({ totalReferrals: total, totalPaid: paid, pendingAmount: pending });
            setAllReferrals(referrals || []);
            setFilteredReferrals(referrals || []); // Initial load

            // Leaderboard Logic
            const leaderboard: any = {};
            referrals?.forEach((r: any) => {
                const name = r.referrer?.username || 'Unknown';
                if (!leaderboard[name]) leaderboard[name] = 0;
                leaderboard[name]++;
            });
            const sortedLeaderboard = Object.entries(leaderboard)
                .sort(([, a]: any, [, b]: any) => b - a)
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));
            setTopReferrers(sortedLeaderboard);

        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettingsAndData();
    }, []);

    // Effect to handle Filtering & Search
    useEffect(() => {
        let result = allReferrals;

        // 1. Search (Username of Referrer or Referee)
        if (searchQuery) {
            const lowQ = searchQuery.toLowerCase();
            result = result.filter(r => 
                r.referrer?.username?.toLowerCase().includes(lowQ) || 
                r.referee?.username?.toLowerCase().includes(lowQ) ||
                r.referee?.full_name?.toLowerCase().includes(lowQ)
            );
        }

        // 2. Status Filter
        if (statusFilter !== 'all') {
            result = result.filter(r => r.status === statusFilter);
        }

        // 3. Date Filter
        if (dateFilter !== 'all') {
            const now = new Date();
            const todayStart = new Date(now.setHours(0,0,0,0)).getTime();
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
            await supabase.from('app_settings').upsert({ key: 'referral_reward', value: { amount: Number(rewardAmount), currency: 'NGN' } });
            await supabase.from('app_settings').upsert({ key: 'referral_url', value: { url: referralUrl } });
            await supabase.from('app_settings').upsert({ key: 'referral_enabled', value: { enabled: systemEnabled } });
            await supabase.from('app_settings').upsert({ key: 'min_withdrawal', value: { amount: Number(minWithdrawal) } });
            Alert.alert("Success", "Configuration saved!");
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        if (filteredReferrals.length === 0) {
            Alert.alert("No Data", "Nothing to export based on current filters.");
            return;
        }

        // Generate CSV Content
        let csv = "ID,Date,Referrer,Referee,Amount,Status\n";
        filteredReferrals.forEach(r => {
            const date = new Date(r.created_at).toLocaleDateString();
            csv += `${r.id},${date},${r.referrer?.username},${r.referee?.username},${r.reward_amount},${r.status}\n`;
        });

        try {
            await Share.share({
                title: 'Referral_Report.csv',
                message: csv
            });
        } catch (error: any) {
            Alert.alert("Export Error", error.message);
        }
    };

    const updateStatus = async (status: string) => {
        if (!selectedReferral) return;
        try {
            const { error } = await supabase
                .from('referrals')
                .update({ status })
                .eq('id', selectedReferral.id);

            if (error) throw error;
            
            // Optimistic update
            const updated = allReferrals.map(r => r.id === selectedReferral.id ? { ...r, status } : r);
            setAllReferrals(updated);
            setSelectedReferral(null);
            Alert.alert("Success", `Status updated to ${status}`);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    const revokeReward = async () => {
         if (!selectedReferral) return;
         // For now, we just set amount to 0 and status to revoked/cancelled logic if needed, 
         // but 'status' column constraint might only be paid/pending. 
         // Let's assume we can set status to 'pending' and amount to 0 or just delete it?
         // Safer: Set reward_amount to 0.
         try {
            const { error } = await supabase
                .from('referrals')
                .update({ reward_amount: 0, status: 'paid' }) // Effectively voiding it
                .eq('id', selectedReferral.id);

            if (error) throw error;

             const updated = allReferrals.map(r => r.id === selectedReferral.id ? { ...r, reward_amount: 0, status: 'paid' } : r);
            setAllReferrals(updated);
            setSelectedReferral(null);
            Alert.alert("Revoked", "Reward set to 0 and marked processed.");
         } catch (error: any) {
            Alert.alert("Error", error.message);
         }
    };

    const viewUserProfile = (userId: string) => {
        setSelectedReferral(null);
        // Navigate and maybe pass params if UserManagement supports it, otherwise generic link
        // Current UserManagement supports search, but we can't easily deep link with params like `?search=` 
        // unless we modify UserManagement to read params.
        // For now, we'll just go to users.
        router.push('/manage/users'); 
        Alert.alert("Navigation", `Please search for ID: ${userId} or username manually (Deep link coming soon)`);
    };

    return (
        <View className="flex-1 bg-slate-50">
             <Stack.Screen options={{ 
                title: "Referral Manager",
                headerStyle: { backgroundColor: '#F8FAFC' },
                headerTintColor: '#0F172A',
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={handleExport} className="bg-slate-200 p-2 rounded-full">
                        <Ionicons name="share-outline" size={20} color="#334155" />
                    </TouchableOpacity>
                )
            }} />
            
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#4F46E5" />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
                        
                        {/* Stats Overview */}
                        <View className="flex-row gap-3 mb-6">
                            <LinearGradient colors={['#4F46E5', '#4338ca']} className="flex-1 p-4 rounded-2xl shadow-sm">
                                <Text className="text-indigo-200 text-xs font-bold uppercase">Total Referrals</Text>
                                <Text className="text-white text-2xl font-black mt-1">{stats.totalReferrals}</Text>
                            </LinearGradient>
                            <View className="flex-1 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <Text className="text-slate-400 text-xs font-bold uppercase">Pending</Text>
                                <Text className="text-slate-900 text-xl font-black mt-1">₦{stats.pendingAmount.toLocaleString()}</Text>
                            </View>
                            <View className="flex-1 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <Text className="text-slate-400 text-xs font-bold uppercase">Paid Out</Text>
                                <Text className="text-slate-900 text-xl font-black mt-1">₦{stats.totalPaid.toLocaleString()}</Text>
                            </View>
                        </View>

                        {/* Master Control */}
                        <View className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6 flex-row items-center justify-between">
                            <View className="flex-1 pr-4">
                                <Text className="text-slate-900 font-bold text-base">Referral System</Text>
                                <Text className="text-slate-400 text-xs mt-1">
                                    {systemEnabled ? "System is LIVE. Users earn rewards." : "System is OFF. No rewards granted."}
                                </Text>
                            </View>
                            <Switch 
                                value={systemEnabled} 
                                onValueChange={setSystemEnabled}
                                trackColor={{ false: "#E2E8F0", true: "#4F46E5" }}
                            />
                        </View>

                        {/* Configuration Form */}
                        <Text className="text-slate-900 font-bold text-lg mb-3">Settings</Text>
                        <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
                            <View className="flex-row gap-4 mb-4">
                                <View className="flex-1">
                                    <Text className="text-slate-500 font-bold text-xs uppercase mb-2">Reward (₦)</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 h-12">
                                        <TextInput 
                                            value={rewardAmount}
                                            onChangeText={setRewardAmount}
                                            keyboardType="numeric"
                                            className="flex-1 font-bold text-slate-900 text-base"
                                        />
                                    </View>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 font-bold text-xs uppercase mb-2">Min Withdraw (₦)</Text>
                                    <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 h-12">
                                        <TextInput 
                                            value={minWithdrawal}
                                            onChangeText={setMinWithdrawal}
                                            keyboardType="numeric"
                                            className="flex-1 font-bold text-slate-900 text-base"
                                        />
                                    </View>
                                </View>
                            </View>

                            <View className="mb-6">
                                <Text className="text-slate-500 font-bold text-xs uppercase mb-2">Base URL</Text>
                                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 h-12">
                                    <Ionicons name="link-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                                    <TextInput 
                                        value={referralUrl}
                                        onChangeText={setReferralUrl}
                                        autoCapitalize="none"
                                        className="flex-1 font-medium text-slate-900 text-base"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={saveSettings}
                                disabled={saving}
                                className="bg-slate-900 py-4 rounded-xl items-center flex-row justify-center gap-2"
                            >
                                {saving ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <Ionicons name="save-outline" size={18} color="white" />
                                        <Text className="text-white font-bold">Save Changes</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Top Referrers */}
                        <Text className="text-slate-900 font-bold text-lg mb-3">Top Referrers 🏆</Text>
                        <View className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-8">
                             {topReferrers.length === 0 ? (
                                <Text className="text-slate-400 italic text-sm text-center py-4">No data yet</Text>
                             ) : (
                                 topReferrers.map((user, index) => (
                                     <View key={user.name} className="flex-row justify-between items-center py-3 border-b border-slate-50 last:border-0">
                                         <View className="flex-row items-center gap-3">
                                             <View className={`w-8 h-8 rounded-full items-center justify-center ${index === 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                                 <Text className={`font-bold ${index === 0 ? 'text-amber-600' : 'text-slate-500'}`}>{index + 1}</Text>
                                             </View>
                                             <Text className="font-bold text-slate-700">@{user.name}</Text>
                                         </View>
                                         <Text className="font-bold text-indigo-600">{user.count} Refs</Text>
                                     </View>
                                 ))
                             )}
                        </View>

                        {/* Advanced Activity Section */}
                        <Text className="text-slate-900 font-bold text-lg mb-3">Detailed Activity</Text>
                        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-4">
                            
                            {/* Search Bar */}
                            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 mb-4">
                                <Ionicons name="search" size={18} color="#94A3B8" />
                                <TextInput 
                                    placeholder="Search user..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    className="flex-1 ml-2 text-slate-900 font-medium"
                                />
                            </View>

                            {/* Filter Pills */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                                {['all', 'paid', 'pending'].map((s) => (
                                    <TouchableOpacity 
                                        key={s} 
                                        onPress={() => setStatusFilter(s as any)}
                                        className={`mr-2 px-3 py-1.5 rounded-full border ${statusFilter === s ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}
                                    >
                                        <Text className={`text-xs font-bold uppercase ${statusFilter === s ? 'text-white' : 'text-slate-500'}`}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                                <View className="w-4" />
                                {['all', 'today', 'week'].map((d) => (
                                    <TouchableOpacity 
                                        key={d} 
                                        onPress={() => setDateFilter(d as any)}
                                        className={`mr-2 px-3 py-1.5 rounded-full border ${dateFilter === d ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}
                                    >
                                        <Text className={`text-xs font-bold uppercase ${dateFilter === d ? 'text-white' : 'text-slate-500'}`}>{d}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* List */}
                            {filteredReferrals.length === 0 ? (
                                <Text className="text-slate-400 italic text-sm text-center py-8">No matching records</Text>
                             ) : (
                                filteredReferrals.map((item) => (
                                    <TouchableOpacity 
                                        key={item.id} 
                                        onPress={() => setSelectedReferral(item)}
                                        className="py-3 border-b border-slate-50 flex-row items-center justify-between last:border-0 active:bg-slate-50"
                                    >
                                        <View className="flex-row items-center gap-3">
                                            <View className="w-10 h-10 bg-indigo-50 rounded-full items-center justify-center">
                                                <Ionicons name="person-add" size={18} color="#4F46E5" />
                                            </View>
                                            <View>
                                                <Text className="font-bold text-slate-700">{item.referee?.full_name || 'New User'}</Text>
                                                <Text className="text-xs text-slate-400">
                                                    Ref: <Text className="font-bold text-indigo-500">@{item.referrer?.username}</Text>
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <View className="flex-row items-center gap-1">
                                                 <Text className={`font-bold ${item.status === 'paid' ? 'text-green-600' : 'text-amber-500'}`}>
                                                    {item.status === 'paid' ? 'PAID' : 'PENDING'}
                                                </Text>
                                                <Ionicons name="ellipsis-vertical" size={12} color="#CBD5E1" />
                                            </View>
                                            <Text className="text-[10px] text-slate-400 font-mono">₦{item.reward_amount}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                             )}
                        </View>

                    </ScrollView>

                    {/* Action Modal */}
                    <Modal visible={!!selectedReferral} transparent animationType="fade" onRequestClose={() => setSelectedReferral(null)}>
                        <BlurView intensity={20} className="flex-1 justify-end">
                            <TouchableOpacity className="flex-1" onPress={() => setSelectedReferral(null)} />
                            <View className="bg-white rounded-t-3xl p-6 pb-12 shadow-2xl">
                                <View className="items-center mb-6">
                                    <View className="w-12 h-1 bg-slate-200 rounded-full mb-4" />
                                    <Text className="font-black text-xl text-slate-800">Manage Referral</Text>
                                    <Text className="text-slate-400 text-sm mt-1">ID: {selectedReferral?.id}</Text>
                                </View>

                                {/* Actions */}
                                <View className="space-y-3">
                                    <TouchableOpacity onPress={() => updateStatus(selectedReferral?.status === 'paid' ? 'pending' : 'paid')} className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                         <View className={`w-10 h-10 rounded-full items-center justify-center ${selectedReferral?.status === 'paid' ? 'bg-amber-100' : 'bg-green-100'}`}>
                                            <Ionicons name={selectedReferral?.status === 'paid' ? "time" : "checkmark"} size={20} color={selectedReferral?.status === 'paid' ? "#D97706" : "#16A34A"} />
                                         </View>
                                         <View className="ml-3 flex-1">
                                             <Text className="font-bold text-slate-800">
                                                 {selectedReferral?.status === 'paid' ? "Mark as Pending" : "Mark as Paid"}
                                             </Text>
                                             <Text className="text-xs text-slate-400">Change payment status manually</Text>
                                         </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => viewUserProfile(selectedReferral?.referee?.id)} className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                         <View className="w-10 h-10 rounded-full items-center justify-center bg-blue-100">
                                            <Ionicons name="person" size={20} color="#2563EB" />
                                         </View>
                                         <View className="ml-3 flex-1">
                                             <Text className="font-bold text-slate-800">View Referee Profile</Text>
                                             <Text className="text-xs text-slate-400">See user details for {selectedReferral?.referee?.username}</Text>
                                         </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => viewUserProfile(selectedReferral?.referrer?.id)} className="flex-row items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                         <View className="w-10 h-10 rounded-full items-center justify-center bg-indigo-100">
                                            <Ionicons name="people" size={20} color="#4F46E5" />
                                         </View>
                                         <View className="ml-3 flex-1">
                                             <Text className="font-bold text-slate-800">View Referrer Profile</Text>
                                             <Text className="text-xs text-slate-400">See user details for {selectedReferral?.referrer?.username}</Text>
                                         </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={revokeReward} className="flex-row items-center p-4 bg-red-50 rounded-xl border border-red-100 mt-2">
                                         <View className="w-10 h-10 rounded-full items-center justify-center bg-red-200">
                                            <Ionicons name="trash" size={20} color="#DC2626" />
                                         </View>
                                         <View className="ml-3 flex-1">
                                             <Text className="font-bold text-red-800">Revoke Reward</Text>
                                             <Text className="text-xs text-red-400">Set amount to 0 (Fraud prevention)</Text>
                                         </View>
                                    </TouchableOpacity>
                                </View>

                                 <TouchableOpacity onPress={() => setSelectedReferral(null)} className="mt-6 py-4 bg-slate-100 rounded-xl items-center">
                                    <Text className="font-bold text-slate-600">Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    </Modal>

                </KeyboardAvoidingView>
            )}
        </View>
    );
}
