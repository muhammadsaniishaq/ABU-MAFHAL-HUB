import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Clipboard, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../services/supabase';

export default function FundWalletScreen() {
    const [method, setMethod] = useState<'transfer' | 'card'>('transfer');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text);
        Alert.alert("Copied", "Account number copied to clipboard");
    };

    const handleCardPayment = () => {
        if (!amount) return;
        const depositAmount = parseFloat(amount);
        if (isNaN(depositAmount) || depositAmount <= 0) return;

        Alert.alert("Paystack", `Initializing payment of ₦${depositAmount.toLocaleString()}...`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Proceed", onPress: async () => {
                    setLoading(true);
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error("Not authenticated");

                        // 1. Fetch current profile
                        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                        const currentBalance = parseFloat(profile?.balance?.toString() || '0');

                        // 2. Record Transaction
                        const { error: txError } = await supabase
                            .from('transactions')
                            .insert({
                                user_id: user.id,
                                type: 'deposit',
                                amount: depositAmount,
                                status: 'success',
                                description: `Wallet Top-up via Card (Paystack)`,
                                reference: `PAY-${Date.now()}`
                            });

                        if (txError) throw txError;

                        // 3. Update Balance
                        const { error: balanceError } = await supabase
                            .from('profiles')
                            .update({ balance: currentBalance + depositAmount })
                            .eq('id', user.id);

                        if (balanceError) throw balanceError;

                        Alert.alert("Success", "Wallet funded successfully!");
                        router.replace('/dashboard');
                    } catch (error: any) {
                        Alert.alert("Funding Failed", error.message);
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Fund Wallet', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                {/* Method Switcher */}
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-8">
                    <TouchableOpacity
                        className={`flex-1 py-3 items-center rounded-lg ${method === 'transfer' ? 'bg-white shadow-sm' : ''}`}
                        onPress={() => setMethod('transfer')}
                    >
                        <Text className={`font-bold ${method === 'transfer' ? 'text-primary' : 'text-gray-500'}`}>Bank Transfer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-3 items-center rounded-lg ${method === 'card' ? 'bg-white shadow-sm' : ''}`}
                        onPress={() => setMethod('card')}
                    >
                        <Text className={`font-bold ${method === 'card' ? 'text-primary' : 'text-gray-500'}`}>Card Payment</Text>
                    </TouchableOpacity>
                </View>

                {method === 'transfer' ? (
                    <View>
                        <View className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                            <Text className="text-primary font-medium mb-2">Automated Bank Transfer</Text>
                            <Text className="text-gray-600 text-sm leading-5">
                                Transfer to any of the account numbers below. Your wallet will be funded automatically instantly.
                            </Text>
                        </View>

                        <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="font-bold text-gray-500">Wema Bank</Text>
                                <View className="bg-green-100 px-2 py-1 rounded">
                                    <Text className="text-green-700 text-xs font-bold">Active</Text>
                                </View>
                            </View>
                            <View className="flex-row justify-between items-center">
                                <Text className="text-2xl font-bold text-slate">803 000 0000</Text>
                                <TouchableOpacity onPress={() => copyToClipboard('8030000000')}>
                                    <Ionicons name="copy-outline" size={24} color="#0056D2" />
                                </TouchableOpacity>
                            </View>
                            <Text className="text-gray-500 text-sm mt-1">Abu Mafhal Hub</Text>
                        </View>

                        <View className="bg-white border border-gray-200 rounded-xl p-4">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="font-bold text-gray-500">Sterling Bank</Text>
                                <View className="bg-green-100 px-2 py-1 rounded">
                                    <Text className="text-green-700 text-xs font-bold">Active</Text>
                                </View>
                            </View>
                            <View className="flex-row justify-between items-center">
                                <Text className="text-2xl font-bold text-slate">803 111 2222</Text>
                                <TouchableOpacity onPress={() => copyToClipboard('8031112222')}>
                                    <Ionicons name="copy-outline" size={24} color="#0056D2" />
                                </TouchableOpacity>
                            </View>
                            <Text className="text-gray-500 text-sm mt-1">Abu Mafhal Hub</Text>
                        </View>
                    </View>
                ) : (
                    <View>
                        <View className="bg-orange-50 p-4 rounded-xl mb-6 border border-orange-100">
                            <Text className="text-orange-700 font-medium mb-2">Card Payment</Text>
                            <Text className="text-gray-600 text-sm leading-5">
                                Fund your wallet using your ATM card via Paystack. A 1.5% charge applies.
                            </Text>
                        </View>

                        <Text className="text-slate font-bold mb-4">Amount</Text>
                        <View className="flex-row items-center border border-gray-300 rounded-xl px-4 h-16 bg-gray-50 mb-8">
                            <Text className="text-gray-500 text-xl font-bold mr-2">₦</Text>
                            <TextInput
                                className="flex-1 text-2xl font-bold text-slate"
                                keyboardType="number-pad"
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                            />
                        </View>

                        <TouchableOpacity
                            className={`h-14 rounded-full items-center justify-center mb-8 ${amount && !loading ? 'bg-primary' : 'bg-gray-300'}`}
                            onPress={handleCardPayment}
                            disabled={!amount || loading}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Pay with Paystack</Text>}
                        </TouchableOpacity>

                        <View className="flex-row justify-center items-center gap-2">
                            <Ionicons name="lock-closed" size={16} color="#6B7280" />
                            <Text className="text-gray-500 text-sm">Secured by Paystack</Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
