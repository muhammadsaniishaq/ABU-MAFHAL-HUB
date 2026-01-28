import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Image, Share, Alert, ActivityIndicator, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';

interface Referral {
    id: string;
    referee_id: string;
    status: string;
    reward_amount: number;
    created_at: string;
    profiles: {
        full_name: string;
        username?: string;
        avatar_url?: string;
    };
}

export default function Referrals() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [stats, setStats] = useState({
        totalEarnings: 0,
        pendingEarnings: 0,
        referralCount: 0,
        balance: 0,
        code: '',
        baseUrl: 'https://abumafhal.com.ng'
    });
    const [withdrawing, setWithdrawing] = useState(false);

    const fetchReferralData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 0. Fetch Dynamic Settings
            const { data: settings } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'referral_url')
                .single();
            
            const dynamicUrl = settings?.value?.url || 'https://abumafhal.com.ng';

            // 1. Get User Profile for Code and Balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('referral_balance, referral_code, username')
                .eq('id', user.id)
                .single();

            // 2. Get Referrals List
            const { data: refs, error } = await supabase
                .from('referrals')
                .select(`
                    id, 
                    status, 
                    reward_amount, 
                    created_at,
                    profiles:referee_id (full_name, username, avatar_url)
                `)
                .eq('referrer_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // 3. Calculate Stats
            const total = refs?.reduce((acc, curr) => acc + (curr.status === 'paid' ? curr.reward_amount : 0), 0) || 0;
            const pending = refs?.reduce((acc, curr) => acc + (curr.status === 'pending' ? curr.reward_amount : 0), 0) || 0;

            setReferrals(refs as any || []);
            setStats({
                totalEarnings: total,
                pendingEarnings: pending,
                referralCount: refs?.length || 0,
                balance: profile?.referral_balance || 0,
                code: profile?.referral_code || profile?.username || 'user',
                baseUrl: dynamicUrl
            });

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReferralData();
    }, []);

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(stats.code);
        Alert.alert("Copied", "Referral code copied to clipboard!");
    };

    const shareLink = async () => {
        try {
            await Share.share({
                message: `Join me on Abu Mafhal Hub! Use my code "${stats.code}" to sign up and get started. Download app: ${stats.baseUrl}`,
            });
        } catch (error) {
            console.log(error);
        }
    };

    const handleWithdraw = async () => {
        if (stats.balance < 100) {
            Alert.alert("Minimum Withdrawal", "You need at least ₦100 to withdraw.");
            return;
        }

        setWithdrawing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) throw new Error("No user");

            // 1. Debit Referral Balance
            const newRefBal = stats.balance - stats.balance; // Withdraw All
            const { error: debitError } = await supabase
                .from('profiles')
                .update({ referral_balance: newRefBal })
                .eq('id', user.id);
            
            if(debitError) throw debitError;

            // 2. Credit Main Balance (Using RPC or direct update if safe - using deducting function reversed for now or direct update)
            // Ideally we use a transaction. For now, sequential update.
            const { data: mainProfile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            const newMainBal = (mainProfile?.balance || 0) + stats.balance;
            
            await supabase.from('profiles').update({ balance: newMainBal }).eq('id', user.id);

            // 3. Log Transaction
             await supabase.from('transactions').insert({
                user_id: user.id,
                type: 'referral_withdrawal',
                amount: stats.balance,
                status: 'success',
                description: 'Withdrawal from Referral Earnings'
            });

            Alert.alert("Success", "Earnings transferred to main wallet!");
            fetchReferralData(); // Refresh

        } catch (e: any) {
            Alert.alert("Error", e.message || "Withdrawal failed");
        } finally {
            setWithdrawing(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ 
                title: "Referrals",
                headerShown: true,
                headerStyle: { backgroundColor: '#F8FAFC' },
                headerTintColor: '#0F172A',
                headerShadowVisible: false
            }} />
            <StatusBar style="dark" />

            <ScrollView 
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReferralData} />}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            >
                {/* Hero Card */}
                <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="p-6 rounded-3xl mb-6 shadow-xl shadow-indigo-200"
                >
                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <Text className="text-indigo-200 font-medium text-xs uppercase tracking-widest mb-1">Available Rewards</Text>
                            <Text className="text-white text-4xl font-black">₦{stats.balance.toLocaleString()}</Text>
                        </View>
                        <View className="bg-white/20 p-2 rounded-full">
                            <Ionicons name="gift" size={24} color="white" />
                        </View>
                    </View>

                    <View className="flex-row gap-4">
                        <View>
                            <Text className="text-indigo-200 text-[10px] uppercase font-bold">Total Earned</Text>
                            <Text className="text-white font-bold text-lg">₦{stats.totalEarnings.toLocaleString()}</Text>
                        </View>
                        <View className="w-[1px] bg-indigo-400/30 h-full" />
                        <View>
                            <Text className="text-indigo-200 text-[10px] uppercase font-bold">Invited</Text>
                            <Text className="text-white font-bold text-lg">{stats.referralCount} Users</Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleWithdraw}
                        disabled={withdrawing || stats.balance <= 0}
                        className={`mt-6 py-3 rounded-xl items-center flex-row justify-center gap-2 ${stats.balance > 0 ? 'bg-white' : 'bg-white/50'}`}
                    >
                         {withdrawing ? <ActivityIndicator color="#4F46E5" /> : (
                            <>
                                <Text className="text-indigo-600 font-bold text-base">Withdraw to Wallet</Text>
                                <Ionicons name="wallet-outline" size={18} color="#4F46E5" />
                            </>
                         )}
                    </TouchableOpacity>
                </LinearGradient>

                {/* Referral Code Section */}
                <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                    <Text className="text-center text-slate-500 font-medium text-xs uppercase tracking-widest mb-4">Your Unique Referral Code</Text>
                    
                    <TouchableOpacity onPress={copyToClipboard} className="bg-slate-50 border-2 border-dashed border-indigo-200 p-4 rounded-xl flex-row items-center justify-center gap-3 mb-4 active:bg-indigo-50">
                        <Text className="text-2xl font-black text-slate-800 tracking-wider font-mono">{stats.code}</Text>
                        <Ionicons name="copy-outline" size={20} color="#6366F1" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={shareLink} className="bg-indigo-600 py-4 rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-indigo-200 mb-2">
                        <Ionicons name="share-social" size={20} color="white" />
                        <Text className="text-white font-bold text-lg">Invite Friends</Text>
                    </TouchableOpacity>
                </View>

                {/* History List */}
                <Text className="text-slate-900 font-bold text-xl mb-4 ml-1">Referral History</Text>
                
                {stats.referralCount === 0 ? (
                    <View className="items-center py-10 opacity-50">
                        <Ionicons name="people-outline" size={48} color="#94A3B8" />
                        <Text className="text-slate-400 font-medium mt-2">No referrals yet. Invite someone!</Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                        {referrals.map((item, index) => (
                            <View key={item.id} className={`p-4 flex-row items-center justify-between ${index !== referrals.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                <View className="flex-row items-center gap-3">
                                    <View className="w-10 h-10 rounded-full bg-indigo-50 items-center justify-center overflow-hidden">
                                        {item.profiles?.avatar_url ? (
                                             <Image source={{ uri: item.profiles.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <Text className="text-indigo-600 font-bold text-lg">{item.profiles?.full_name?.charAt(0).toUpperCase()}</Text>
                                        )}
                                    </View>
                                    <View>
                                        <Text className="font-bold text-slate-800">{item.profiles?.username || item.profiles?.full_name}</Text>
                                        <Text className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className="font-bold text-green-600">+₦{item.reward_amount}</Text>
                                    <Text className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-0.5 ${item.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

            </ScrollView>
        </View>
    );
}
