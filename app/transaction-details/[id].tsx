import { View, Text, TouchableOpacity, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { useEffect, useState } from 'react';

export default function TransactionDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [transaction, setTransaction] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchTransaction();
    }, [id]);

    const fetchTransaction = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (data) {
                const amount = parseFloat(data.amount.toString());
                setTransaction({
                    ...data,
                    displayAmount: `₦${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    dateDisplay: new Date(data.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!transaction) return;
        try {
            await Share.share({
                message: `Transaction Receipt\nAmount: ${transaction.displayAmount}\nType: ${transaction.type}\nRef: ${transaction.reference}\nStatus: ${transaction.status}`,
            });
        } catch (error) { }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#0056D2" />
            </View>
        );
    }

    if (!transaction) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 p-6">
                <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
                <Text className="text-xl font-bold text-slate mt-4">Transaction Not Found</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-primary px-8 py-3 rounded-full">
                    <Text className="text-white font-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Transaction Details', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 items-center mb-6">
                    <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                        <Ionicons name={transaction.status === 'success' ? 'checkmark' : 'close'} size={32} color={transaction.status === 'success' ? '#107C10' : '#EF4444'} />
                    </View>
                    <Text className="text-2xl font-bold text-slate mb-1">{transaction.displayAmount}</Text>
                    <Text className={`font-bold px-3 py-1 rounded-full text-xs uppercase mb-6 ${transaction.status === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                        }`}>
                        {transaction.status}
                    </Text>

                    <Text className="text-gray-400 text-xs mb-8">
                        {transaction.dateDisplay}
                    </Text>

                    <View className="w-full border-t border-gray-100 pt-6 gap-4">
                        <View className="flex-row justify-between">
                            <Text className="text-gray-500">Transaction Type</Text>
                            <Text className="font-bold text-slate uppercase">{transaction.type}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-gray-500">Reference</Text>
                            <Text className="font-bold text-slate text-xs">{transaction.reference || transaction.id}</Text>
                        </View>
                        {transaction.description && (
                            <View className="flex-row justify-between">
                                <Text className="text-gray-500">Description</Text>
                                <Text className="font-bold text-slate text-right flex-1 ml-4">{transaction.description}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    className="bg-primary py-4 rounded-xl items-center mb-4"
                    onPress={handleShare}
                >
                    <Text className="text-white font-bold">Share Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="bg-white border border-red-100 py-4 rounded-xl items-center"
                    onPress={() => {
                        Alert.alert("Report Issue", "Contacting support about this transaction...");
                        router.push('/support');
                    }}
                >
                    <Text className="text-red-500 font-bold">Report Issue</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
