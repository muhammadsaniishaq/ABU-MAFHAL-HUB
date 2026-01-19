import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function LendingHQ() {
    const [loans, setLoans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, performing: 0, defaulted: 0 });

    useEffect(() => {
        fetchLoans();
    }, []);

    const fetchLoans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('loans')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLoans(data || []);

            // Calculate stats
            const total = data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
            const performing = data?.filter(l => l.status === 'approved' || l.status === 'repaid').length || 0;
            const totalActive = data?.filter(l => l.status !== 'pending').length || 1;

            setStats({
                total,
                performing: Math.round((performing / totalActive) * 100),
                defaulted: 100 - Math.round((performing / totalActive) * 100)
            });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, status: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('loans')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
            fetchLoans();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Lending HQ' }} />

            <ScrollView className="flex-1">
                <View className="p-6">
                    <View className="bg-white p-6 rounded-3xl mb-8 shadow-sm border border-slate-100">
                        <Text className="text-slate-400 font-bold uppercase text-[10px] mb-2">Total Loan Book</Text>
                        <Text className="text-4xl font-black text-slate-800">₦ {stats.total.toLocaleString()}</Text>
                        <View className="flex-row gap-4 mt-6">
                            <View>
                                <Text className="text-green-600 font-bold text-lg">{stats.performing}%</Text>
                                <Text className="text-slate-400 text-[10px]">Performing</Text>
                            </View>
                            <View className="w-[1px] bg-gray-200" />
                            <View>
                                <Text className="text-red-500 font-bold text-lg">{stats.defaulted}%</Text>
                                <Text className="text-slate-400 text-[10px]">Non-Performing</Text>
                            </View>
                        </View>
                    </View>

                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Loan Requests (AI Scored)</Text>

                    {loading ? (
                        <ActivityIndicator size="large" color="#0F172A" />
                    ) : (
                        loans.map((loan, i) => (
                            <View key={i} className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View>
                                        <Text className="font-bold text-slate-800 text-base">{loan.profiles?.full_name || 'System User'}</Text>
                                        <Text className="text-slate-400 text-xs">Requesting ₦{Number(loan.amount).toLocaleString()}</Text>
                                        <Text className="text-[10px] text-indigo-500 font-bold mt-1 uppercase">{loan.status}</Text>
                                    </View>
                                    <View className={`w-10 h-10 rounded-full items-center justify-center border-4 ${loan.ai_score >= 70 ? 'border-green-100 bg-green-50' : loan.ai_score < 40 ? 'border-red-100 bg-red-50' : 'border-yellow-100 bg-yellow-50'}`}>
                                        <Text className={`font-black text-xs ${loan.ai_score >= 70 ? 'text-green-600' : loan.ai_score < 40 ? 'text-red-600' : 'text-yellow-600'}`}>{loan.ai_score || '??'}</Text>
                                    </View>
                                </View>

                                {loan.status === 'pending' && (
                                    <View className="flex-row gap-2 mt-2">
                                        <TouchableOpacity
                                            onPress={() => handleAction(loan.id, 'approved')}
                                            className="flex-1 bg-slate-900 py-2 rounded-lg items-center"
                                        >
                                            <Text className="text-white font-bold text-xs">Approve</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleAction(loan.id, 'rejected')}
                                            className="flex-1 bg-red-50 py-2 rounded-lg items-center"
                                        >
                                            <Text className="text-red-500 font-bold text-xs">Reject</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                    {!loading && loans.length === 0 && (
                        <Text className="text-center text-gray-400 mt-10">No loan requests found</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
