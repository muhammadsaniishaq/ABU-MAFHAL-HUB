import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export default function TransferScreen() {
    const [bank, setBank] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isLoadingName, setIsLoadingName] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userBalance, setUserBalance] = useState<number>(0);
    const router = useRouter();

    useEffect(() => {
        fetchUserBalance();
    }, []);

    const fetchUserBalance = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (data) setUserBalance(parseFloat(data.balance.toString()));
        }
    };

    const banks = [
        { id: 'gtb', name: 'GTBank', color: '#E03C31' },
        { id: 'zenith', name: 'Zenith', color: '#FF0000' },
        { id: 'access', name: 'Access', color: '#0033A1' },
        { id: 'uba', name: 'UBA', color: '#D42E12' },
        { id: 'opay', name: 'OPay', color: '#00B050' },
        { id: 'palm', name: 'PalmPay', color: '#662D91' },
        { id: 'first', name: 'First Bank', color: '#003B70' },
        { id: 'kuda', name: 'Kuda', color: '#40196D' },
    ];

    // Mock Name Resolution
    useEffect(() => {
        if (accountNumber.length === 10 && bank) {
            setIsLoadingName(true);
            // Simulate API call
            setTimeout(() => {
                setAccountName("MUSA IBRAHIM");
                setIsLoadingName(false);
            }, 1500);
        } else {
            setAccountName("");
        }
    }, [accountNumber, bank]);

    const handleTransfer = async () => {
        if (!bank || !accountNumber || !amount) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        const transferAmount = parseFloat(amount);
        if (isNaN(transferAmount) || transferAmount <= 0) {
            Alert.alert("Error", "Invalid amount");
            return;
        }

        if (transferAmount > userBalance) {
            Alert.alert("Insufficient Balance", `You only have ₦${userBalance.toLocaleString()} in your wallet.`);
            return;
        }

        Alert.alert(
            "Confirm Transfer",
            `Send ₦${transferAmount.toLocaleString()} to ${accountName} (${bank.toUpperCase()})?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm", onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) throw new Error("Not authenticated");

                            // 1. Record Transaction
                            const { error: txError } = await supabase
                                .from('transactions')
                                .insert({
                                    user_id: user.id,
                                    type: 'transfer',
                                    amount: transferAmount,
                                    status: 'success',
                                    description: `Transfer to ${accountName} (${bank.toUpperCase()})`,
                                    reference: `TXN${Date.now()}`
                                });

                            if (txError) throw txError;

                            // 2. Update Balance
                            const { error: balanceError } = await supabase
                                .from('profiles')
                                .update({ balance: userBalance - transferAmount })
                                .eq('id', user.id);

                            if (balanceError) throw balanceError;

                            Alert.alert("Success", "Transfer Successful!");
                            router.replace('/dashboard');
                        } catch (error: any) {
                            Alert.alert("Transfer Failed", error.message || "An error occurred");
                        } finally {
                            setIsSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Transfer', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <Text className="text-slate font-bold mb-4">Select Bank</Text>
                <View className="flex-row flex-wrap justify-between gap-y-4 mb-6">
                    {banks.map((b) => (
                        <TouchableOpacity
                            key={b.id}
                            className={`w-[23%] aspect-square rounded-2xl items-center justify-center border ${bank === b.id ? 'bg-blue-50/50 border-primary' : 'bg-white border-gray-100'
                                }`}
                            onPress={() => setBank(b.id)}
                        >
                            <View className="w-8 h-8 rounded-full items-center justify-center mb-1" style={{ backgroundColor: b.color }}>
                                <Text className="text-white font-bold text-xs">{b.name[0]}</Text>
                            </View>
                            <Text className={`text-[10px] font-bold text-center ${bank === b.id ? 'text-primary' : 'text-gray-600'}`}>
                                {b.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Account Number */}
                <Text className="text-slate font-bold mb-4">Account Number</Text>
                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 h-14 bg-gray-50 mb-2">
                    <TextInput
                        className="flex-1 text-lg font-medium text-slate"
                        keyboardType="number-pad"
                        value={accountNumber}
                        onChangeText={(text) => {
                            // Only allow numbers and max 10 chars
                            if (/^\d*$/.test(text) && text.length <= 10) {
                                setAccountNumber(text);
                            }
                        }}
                        placeholder="0123456789"
                        maxLength={10}
                    />
                </View>

                {/* Account Name Resolve State */}
                <View className="h-8 mb-6">
                    {isLoadingName ? (
                        <View className="flex-row items-center">
                            <ActivityIndicator size="small" color="#0056D2" />
                            <Text className="text-primary ml-2 text-sm">Verifying account name...</Text>
                        </View>
                    ) : accountName ? (
                        <View className="flex-row items-center bg-green-50 px-3 py-1 rounded-lg self-start">
                            <Ionicons name="checkmark-circle" size={16} color="#107C10" />
                            <Text className="text-green-700 font-bold ml-2 text-sm">{accountName}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Amount */}
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

                {/* Button */}
                <TouchableOpacity
                    className={`h-14 rounded-full items-center justify-center mb-8 ${bank && accountNumber.length === 10 && amount && !isSubmitting ? 'bg-primary' : 'bg-gray-300'
                        }`}
                    onPress={handleTransfer}
                    disabled={!bank || accountNumber.length !== 10 || !amount || isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Send Money</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
