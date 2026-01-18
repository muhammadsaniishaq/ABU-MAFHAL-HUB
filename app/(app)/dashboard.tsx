import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Platform, Image } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useEffect } from 'react';

export default function Dashboard() {
    const [showBalance, setShowBalance] = useState(true);
    const [userData, setUserData] = useState<{ full_name: string; balance: number; role?: string } | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dbError, setDbError] = useState<boolean>(false);
    const router = useRouter();

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, balance, role')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setUserData(data);
                    setDbError(false);
                } else if (error) {
                    console.error('Dashboard profile fetch error:', error);
                    if (error.message.includes('recursion') || error.code === '42P17') {
                        setDbError(true);
                    }
                }

                const { data: txData } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(3);

                if (txData) setTransactions(txData);
            }
        } finally {
            setLoading(false);
        }
    };

    const actions = [
        { icon: 'add-circle', label: 'Top Up', color: '#107C10', route: '/fund-wallet' },
        { icon: 'send', label: 'Transfer', color: '#0056D2', route: '/transfer' },
        { icon: 'phone-portrait', label: 'Airtime', color: '#F37021', route: '/airtime' },
        { icon: 'wifi', label: 'Data', color: '#008080', route: '/data' },
        { icon: 'school', label: 'Edu', color: '#6B7280', route: '/education' },
        { icon: 'flash', label: 'Bills', color: '#D97706', route: '/bills' },
        { icon: 'card', label: 'Cards', color: '#8B5CF6', route: '/virtual-cards' },
        { icon: 'wallet', label: 'Savings', color: '#107C10', route: '/savings' },
        { icon: 'cash', label: 'Loans', color: '#EA580C', route: '/loans' },
        { icon: 'logo-bitcoin', label: 'Crypto', color: '#F7931A', route: '/crypto' },
        { icon: 'pie-chart', label: 'Insights', color: '#DB2777', route: '/analytics' },
        { icon: 'gift', label: 'Rewards', color: '#9333EA', route: '/rewards' },
        { icon: 'qr-code', label: 'QR Pay', color: '#10B981', route: '/qr-pay' },
        { icon: 'trending-up', label: 'Invest', color: '#3B82F6', route: '/investments' },
        { icon: 'shield-checkmark', label: 'Insurance', color: '#107C10', route: '/insurance' },
        { icon: 'finger-print', label: 'BVN Svcs', color: '#0056D2', route: '/bvn-services' },
        { icon: 'person-add', label: 'NIN Svcs', color: '#15803D', route: '/nin-services' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-gray-50 pt-8" style={{ paddingTop: Platform.OS === 'android' ? 30 : 0 }}>
            {/* Header */}
            <View className="px-6 py-4 flex-row justify-between items-center bg-white border-b border-gray-100">
                <View className="flex-row items-center">
                    <Image
                        source={require('../../assets/images/logo-icon.png')}
                        style={{ width: 12, height: 12 }}
                        className="rounded-full mr-2"
                        resizeMode="contain"
                    />
                    <View>
                        <Text className="text-gray-500 text-[10px] uppercase font-bold">Welcome,</Text>
                        <Text className="text-lg font-bold text-slate">{userData?.full_name || 'User'}</Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => router.push('/notifications')} className="p-2 bg-gray-100 rounded-full">
                        <Ionicons name="notifications-outline" size={24} color="#374151" />
                    </TouchableOpacity>
                    {['admin', 'super_admin'].includes(userData?.role || '') && (
                        <TouchableOpacity
                            onPress={() => router.push('/management-v4-core')}
                            className="bg-primary px-3 py-2 rounded-lg flex-row items-center border border-primary/20"
                        >
                            <Ionicons name="shield-checkmark" size={16} color="white" />
                            <Text className="text-white text-[10px] font-bold ml-1">Console</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                {/* Balance Card - Wealth Green */}
                <View className="bg-success rounded-2xl p-6 mb-4 shadow-sm">
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="text-green-100 text-sm font-medium">Available Balance</Text>
                        <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                            <Ionicons name={showBalance ? "eye-off" : "eye"} size={20} color="#D1FAE5" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row items-baseline mb-6">
                        <Text className="text-white text-3xl font-bold mr-2">₦</Text>
                        <Text className="text-white text-4xl font-bold tracking-tight">
                            {showBalance ? (userData?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00") : "****"}
                        </Text>
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 bg-white/20 py-2.5 rounded-lg flex-row items-center justify-center"
                            onPress={() => router.push('/fund-wallet')}
                        >
                            <Ionicons name="add" size={20} color="white" />
                            <Text className="text-white font-bold ml-1">Add Money</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 bg-white/20 py-2.5 rounded-lg flex-row items-center justify-center">
                            <Ionicons name="time-outline" size={20} color="white" />
                            <Text className="text-white font-bold ml-1">History</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Database Warning */}
                {dbError && (
                    <View className="bg-red-50 p-4 rounded-xl border border-red-100 mb-8">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="warning" size={20} color="#EF4444" />
                            <Text className="text-red-700 font-bold ml-2">Database Access Limited</Text>
                        </View>
                        <Text className="text-red-600 text-[10px] leading-4">
                            Infinite recursion detected in database policies. Please apply the SQL fix provided in the chat to your Supabase SQL Editor to restore full access.
                        </Text>
                    </View>
                )}

                {/* Quick Actions Grid */}
                <View className="mb-8">
                    <Text className="text-slate font-bold text-lg mb-4">Quick Actions</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-6">
                        {actions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                className="w-[23%] items-center"
                                onPress={() => action.route && router.push(action.route as any)}
                            >
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center mb-2 bg-white shadow-sm border border-gray-100`}>
                                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                                </View>
                                <Text className="text-gray-600 text-[10px] font-medium text-center leading-tight">{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Recent Transactions */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-slate font-bold text-lg">Recent Transactions</Text>
                        <Text className="text-primary text-sm font-medium">View All</Text>
                    </View>

                    {transactions.length > 0 ? (
                        transactions.map((tx, i) => (
                            <View key={tx.id || i} className="flex-row justify-between items-center bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-50">
                                <View className="flex-row items-center">
                                    <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                                        <Ionicons
                                            name={tx.type === 'payment' ? 'flash' : tx.type === 'transfer' ? 'send' : 'wallet'}
                                            size={18}
                                            color="#F37021"
                                        />
                                    </View>
                                    <View>
                                        <Text className="font-bold text-gray-800">{tx.description || 'Transaction'}</Text>
                                        <Text className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className={`font-bold ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                                        {tx.type === 'deposit' ? '+' : '-'}₦{parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                    <Text className={`text-[10px] ${tx.status === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                                        {tx.status}
                                    </Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View className="bg-white p-8 rounded-xl items-center border border-gray-50">
                            <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
                            <Text className="text-gray-400 mt-2 text-sm italic">No recent transactions</Text>
                        </View>
                    )}

                </View>

                {/* Identity Services Section */}
                <View className="mb-12">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-slate font-bold text-lg">Identity Services</Text>
                        <Ionicons name="finger-print" size={20} color="#0056D2" />
                    </View>
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => router.push('/bvn-services')}
                            className="flex-1 bg-blue-50 p-3 rounded-xl border border-blue-100 flex-row items-center"
                        >
                            <Ionicons name="finger-print" size={20} color="#0056D2" />
                            <View className="ml-2">
                                <Text className="font-bold text-blue-900 text-xs">BVN Hub</Text>
                                <Text className="text-blue-500 text-[10px]">Verify & Print</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/nin-services')}
                            className="flex-1 bg-green-50 p-3 rounded-xl border border-green-100 flex-row items-center"
                        >
                            <Ionicons name="person-add" size={20} color="#15803D" />
                            <View className="ml-2">
                                <Text className="font-bold text-green-900 text-xs">NIN Hub</Text>
                                <Text className="text-green-500 text-[10px]">Official Svcs</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <StatusBar style="dark" />
        </SafeAreaView >
    );
}
