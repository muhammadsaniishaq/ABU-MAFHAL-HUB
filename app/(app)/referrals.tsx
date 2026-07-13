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
            const refLink = `${stats.baseUrl}?ref=${stats.code}`;
            await Share.share({
                message: `Join me on Abu Mafhal Sub and get cheaper data!\n\nUse my code "${stats.code}" to sign up or click the link below:\n${refLink}`,
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

            // 1. Withdraw using Secure RPC
            const { error: rpcError } = await supabase.rpc('withdraw_referral_earnings', {
                amount: stats.balance
            });
            
            if(rpcError) throw rpcError;

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
                <View className="bg-[#0d1b3e] p-5 rounded-3xl mb-5 shadow-xl relative overflow-hidden z-0">
                    <View className="absolute top-0 right-0 w-24 h-24 bg-[#f5a623]/20 rounded-full blur-3xl translate-x-8 -translate-y-8" />
                    <View className="absolute bottom-0 left-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -translate-x-4 translate-y-4" />
                    
                    <View className="flex-row justify-between items-start mb-5">
                        <View>
                            <Text className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mb-1">Available Rewards</Text>
                            <Text className="text-white text-3xl font-black">₦{stats.balance.toLocaleString()}</Text>
                        </View>
                        <View className="bg-white/10 p-2.5 rounded-full border border-white/5">
                            <Ionicons name="gift" size={24} color="#f5a623" />
                        </View>
                    </View>

                    <View className="flex-row gap-5">
                        <View>
                            <Text className="text-slate-400 text-[9px] uppercase tracking-wider font-bold mb-0.5">Total Earned</Text>
                            <Text className="text-white font-bold text-base">₦{stats.totalEarnings.toLocaleString()}</Text>
                        </View>
                        <View className="w-[1px] bg-white/10 h-full" />
                        <View>
                            <Text className="text-slate-400 text-[9px] uppercase tracking-wider font-bold mb-0.5">Invited</Text>
                            <Text className="text-white font-bold text-base">{stats.referralCount} Users</Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleWithdraw}
                        disabled={withdrawing || stats.balance <= 0}
                        className={`mt-5 py-3 rounded-xl items-center flex-row justify-center gap-2 ${stats.balance > 0 ? 'bg-[#f5a623]' : 'bg-white/10'}`}
                    >
                         {withdrawing ? <ActivityIndicator color="#0d1b3e" /> : (
                            <>
                                <Text className={`font-bold text-sm ${stats.balance > 0 ? 'text-[#0d1b3e]' : 'text-slate-400'}`}>Withdraw to Wallet</Text>
                                <Ionicons name="wallet" size={16} color={stats.balance > 0 ? '#0d1b3e' : '#94a3b8'} />
                            </>
                         )}
                    </TouchableOpacity>
                </View>

                {/* Referral Code Section */}
                <View className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mb-5">
                    <Text className="text-center text-slate-500 font-medium text-[10px] uppercase tracking-widest mb-3">Your Unique Code</Text>
                    
                    <TouchableOpacity onPress={copyToClipboard} className="bg-slate-50 border-2 border-dashed border-slate-200 p-3 rounded-2xl flex-row items-center justify-between mb-4 active:bg-slate-100">
                        <View className="flex-1 items-center">
                            <Text className="text-2xl font-black text-[#0d1b3e] tracking-widest font-mono">{stats.code}</Text>
                        </View>
                        <View className="w-8 h-8 rounded-full bg-[#f5a623]/10 items-center justify-center">
                            <Ionicons name="copy" size={16} color="#f5a623" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={shareLink} className="bg-[#0d1b3e] py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-[#0d1b3e]/30">
                        <Ionicons name="share-social" size={18} color="#f5a623" />
                        <Text className="text-white font-bold text-base">Invite Friends Now</Text>
                    </TouchableOpacity>
                </View>

                {/* How It Works Section */}
                <Text className="text-slate-900 font-bold text-lg mb-3 ml-1">How It Works</Text>
                <View className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-5">
                    <View className="flex-row items-start gap-3 mb-3">
                        <View className="w-6 h-6 rounded-full bg-[#0d1b3e]/10 items-center justify-center">
                            <Text className="text-[#0d1b3e] font-black text-xs">1</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-slate-800 font-bold text-sm mb-0.5">Share your Code</Text>
                            <Text className="text-slate-500 text-[10px]">Send your unique link or code to friends & family.</Text>
                        </View>
                    </View>
                    <View className="w-[2px] h-5 bg-slate-100 ml-3 mb-2 -mt-4" />
                    
                    <View className="flex-row items-start gap-3 mb-3">
                        <View className="w-6 h-6 rounded-full bg-[#0d1b3e]/10 items-center justify-center">
                            <Text className="text-[#0d1b3e] font-black text-xs">2</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-slate-800 font-bold text-sm mb-0.5">They Sign Up & Fund</Text>
                            <Text className="text-slate-500 text-[10px]">Your friend creates an account and funds their wallet.</Text>
                        </View>
                    </View>
                    <View className="w-[2px] h-5 bg-slate-100 ml-3 mb-2 -mt-4" />

                    <View className="flex-row items-start gap-3">
                        <View className="w-6 h-6 rounded-full bg-[#f5a623]/20 items-center justify-center">
                            <Ionicons name="cash" size={12} color="#d97706" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-slate-800 font-bold text-sm mb-0.5">You Get Paid!</Text>
                            <Text className="text-slate-500 text-[10px]">Cash bonus is instantly added to your Available Rewards.</Text>
                        </View>
                    </View>
                </View>

                {/* History List */}
                <Text className="text-slate-900 font-bold text-xl mb-4 ml-1">Referral History</Text>
                
                {stats.referralCount === 0 ? (
                    <View className="items-center py-10 opacity-50">
                        <Ionicons name="people" size={48} color="#94A3B8" />
                        <Text className="text-slate-400 font-medium mt-2">No referrals yet. Invite someone!</Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                        {referrals.map((item, index) => (
                            <View key={item.id} className={`p-4 flex-row items-center justify-between ${index !== referrals.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                <View className="flex-row items-center gap-3">
                                    <View className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 items-center justify-center overflow-hidden">
                                        {item.profiles?.avatar_url ? (
                                             <Image source={{ uri: item.profiles.avatar_url }} className="w-full h-full" />
                                        ) : (
                                            <Text className="text-[#0d1b3e] font-black text-lg">{item.profiles?.full_name?.charAt(0).toUpperCase()}</Text>
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
