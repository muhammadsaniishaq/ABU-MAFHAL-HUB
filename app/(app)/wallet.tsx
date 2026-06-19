import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Clipboard, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export default function WalletScreen() {
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWalletData();
    }, []);

    const fetchWalletData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Profile Balance
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (profile) setBalance(profile.balance);

            // 2. Fetch Virtual Account
            const { data: vAccount } = await supabase.from('virtual_accounts').select('*').eq('user_id', user.id).maybeSingle();
            setVirtualAccount(vAccount);

            // 3. Calculate Stats from Transactions
            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount, type, status')
                .eq('user_id', user.id)
                .eq('status', 'success');

            if (transactions) {
                let income = 0;
                let expenses = 0;

                transactions.forEach(tx => {
                    const amt = parseFloat(tx.amount);
                    if (tx.type === 'deposit') {
                        income += amt;
                    } else {
                        expenses += amt;
                    }
                });

                setTotalIn(income);
                setTotalOut(expenses);
            }

        } catch (error) {
            console.error("Error fetching wallet data:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text);
        Alert.alert("Copied", "Account number copied to clipboard");
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="pt-12 px-6 pb-4 bg-white border-b border-gray-200 mb-6">
                <Text className="text-2xl font-bold text-slate">Wallet</Text>
            </View>

            <ScrollView 
                className="px-6"
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchWalletData} />}
            >
                {/* Balance Card */}
                <View className="bg-primary rounded-2xl p-6 mb-8 shadow-sm">
                    <Text className="text-blue-100 text-sm font-medium mb-2">Total Balance</Text>
                    <View className="flex-row items-baseline mb-6">
                        <Text className="text-white text-3xl font-bold mr-2">₦</Text>
                        <Text className="text-white text-4xl font-bold tracking-tight">
                            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
                            onPress={() => router.push('/fund-wallet')}
                        >
                            <Ionicons name="add-circle" size={20} color="white" />
                            <Text className="text-white font-bold ml-2">Fund</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
                            onPress={() => router.push('/transfer')}
                        >
                            <Ionicons name="arrow-up-circle" size={20} color="white" />
                            <Text className="text-white font-bold ml-2">Withdraw</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Account Details */}
                <View className="bg-white p-5 rounded-xl mb-6 shadow-sm border border-gray-100">
                    <Text className="text-slate font-bold mb-4 flex-row items-center">
                        <Ionicons name="card-outline" size={18} color="#0056D2" />
                        <Text className="ml-2"> Dedicated Account Number</Text>
                    </Text>

                    {virtualAccount ? (
                        <View>
                            <Text className="text-gray-500 text-xs mb-1 uppercase">{virtualAccount.bank_name}</Text>
                            <View className="flex-row justify-between items-center">
                                <Text className="text-xl font-bold text-slate">{virtualAccount.account_number}</Text>
                                <TouchableOpacity onPress={() => copyToClipboard(virtualAccount.account_number)}>
                                    <Ionicons name="copy-outline" size={20} color="#0056D2" />
                                </TouchableOpacity>
                            </View>
                            <Text className="text-xs text-gray-400 mt-1">{virtualAccount.account_name}</Text>
                        </View>
                    ) : (
                        <View className="items-center py-4">
                            <Text className="text-gray-400 text-sm mb-2">No active account number</Text>
                            <TouchableOpacity 
                                onPress={() => router.push('/kyc')}
                                className="bg-blue-50 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-primary font-bold text-xs">Verify Identity to Generate</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Stats */}
                <View className="flex-row gap-4 mb-20">
                    <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <Ionicons name="arrow-down" size={24} color="#107C10" />
                        <Text className="text-gray-500 text-xs mt-2">Total In</Text>
                        <Text className="text-slate font-bold text-lg">
                            ₦{totalIn >= 1000 ? (totalIn / 1000).toFixed(1) + 'k' : totalIn.toLocaleString()}
                        </Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <Ionicons name="arrow-up" size={24} color="#EF4444" />
                        <Text className="text-gray-500 text-xs mt-2">Total Out</Text>
                        <Text className="text-slate font-bold text-lg">
                            ₦{totalOut >= 1000 ? (totalOut / 1000).toFixed(1) + 'k' : totalOut.toLocaleString()}
                        </Text>
                    </View>
                </View>
            </ScrollView>
            <StatusBar style="dark" />
        </View>
    );
}
