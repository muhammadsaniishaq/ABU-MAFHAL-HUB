import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../services/supabase';
import { useEffect, useState } from 'react';

type Transaction = {
    id: string;
    type: string;
    amount: string | number;
    status: string;
    description: string;
    reference?: string;
    created_at: string;
    user_id: string;
};

type GroupedTransactions = {
    title: string;
    data: Transaction[];
};

export default function TransactionHistory() {
    const [sections, setSections] = useState<GroupedTransactions[]>([]);
    const [stats, setStats] = useState({ totalVol: 0, successRate: 100 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAllTransactions();
    }, []);

    const fetchAllTransactions = async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) {
                const grouped = data.reduce((acc: any, tx: any) => {
                    const date = new Date(tx.created_at).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(tx);
                    return acc;
                }, {});

                const sectionData = Object.keys(grouped).map(date => ({
                    title: date,
                    data: grouped[date]
                }));

                setSections(sectionData);

                // Calculate stats
                const total = data.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
                const success = data.filter(tx => tx.status === 'success').length;
                const rate = data.length > 0 ? (success / data.length) * 100 : 100;

                setStats({ totalVol: total, successRate: rate });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            {/* Stats Header */}
            <View className="flex-row p-4 gap-4">
                <View className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Total Vol (All Time)</Text>
                    <Text className="text-xl font-black text-slate-800">₦{stats.totalVol.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Success Rate</Text>
                    <Text className={`text-xl font-black ${stats.successRate > 90 ? 'text-green-600' : 'text-orange-600'}`}>{stats.successRate.toFixed(1)}%</Text>
                </View>
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item, index) => item.id}
                renderSectionHeader={({ section: { title } }) => (
                    <Text className="px-6 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">{title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity className="bg-white mx-4 mb-3 p-4 rounded-2xl border border-gray-100 shadow-sm flex-row items-center">
                        <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${item.type === 'deposit' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                            <Ionicons
                                name={item.type === 'deposit' ? 'arrow-down' : 'arrow-up'}
                                size={20}
                                color={item.type === 'deposit' ? '#10B981' : '#EF4444'}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-slate-800">{item.description || item.type}</Text>
                            <View className="flex-row items-center mt-1">
                                <Text className="text-xs text-gray-300 font-medium mr-2">{item.reference || item.id.split('-')[0]}</Text>
                                <Text className="text-xs text-gray-400">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className={`font-black text-base ${item.type === 'deposit' ? 'text-green-600' : 'text-slate-800'
                                }`}>
                                {item.type === 'deposit' ? '+' : '-'}₦{parseFloat(item.amount.toString()).toLocaleString()}
                            </Text>
                            <Text className={`text-[10px] font-bold mt-1 uppercase ${item.status === 'success' ? 'text-green-500' :
                                item.status === 'pending' ? 'text-orange-500' : 'text-red-500'
                                }`}>{item.status}</Text>
                        </View>
                    </TouchableOpacity>
                )}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            />
        </View>
    );
}
