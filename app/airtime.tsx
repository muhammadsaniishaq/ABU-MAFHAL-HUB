import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

export default function AirtimeScreen() {
    const [network, setNetwork] = useState('');
    const [amount, setAmount] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const networks = [
        { id: 'mtn', name: 'MTN', color: '#FFCC00' },
        { id: 'glo', name: 'Glo', color: '#0F6A37' },
        { id: 'airtel', name: 'Airtel', color: '#FF0000' },
        { id: '9mobile', name: '9mobile', color: '#006B3E' },
    ];

    const handlePurchase = async () => {
        // Validation moved to button disabled state mostly, but good to check
        if (!network || !amount || phoneNumber.length < 10) return;

        Alert.alert(
            "Confirm Purchase",
            `Buy ₦${amount} Airtime for ${phoneNumber} (${network.toUpperCase()})?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm", onPress: async () => {
                        await processTransaction();
                    }
                }
            ]
        );
    };

    const processTransaction = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const result = await api.airtime.purchase(user.id, {
                network,
                phone: phoneNumber,
                amount: Number(amount)
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${amount}`,
                        type: 'Airtime Purchase',
                        reference: result.reference
                    }
                });
            } else {
                Alert.alert("Transaction Failed", result.message);
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Buy Airtime', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <Text className="text-slate font-bold mb-4">Select Network</Text>
                <View className="flex-row flex-wrap gap-4 mb-8">
                    {networks.map((net) => (
                        <TouchableOpacity
                            key={net.id}
                            className={`w-[45%] h-20 rounded-2xl items-center flex-row px-4 border ${network === net.id ? 'border-primary bg-blue-50/50' : 'border-gray-100 bg-white shadow-sm'
                                }`}
                            onPress={() => setNetwork(net.id)}
                        >
                            <View
                                className="w-8 h-8 rounded-full mr-3 items-center justify-center"
                                style={{ backgroundColor: net.color }}
                            >
                                <Text className="text-white font-bold text-xs">{net.name[0]}</Text>
                            </View>
                            <Text className={`font-bold ${network === net.id ? 'text-primary' : 'text-gray-700'}`}>{net.name}</Text>
                            {network === net.id && (
                                <View className="ml-auto bg-primary rounded-full p-1">
                                    <Ionicons name="checkmark" size={12} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Phone Number Input Added */}
                <Text className="text-slate font-bold mb-4">Phone Number</Text>
                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 h-14 bg-gray-50 mb-8">
                    <TextInput
                        className="flex-1 text-lg font-medium text-slate"
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="08012345678"
                        maxLength={11}
                        editable={!loading}
                    />
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
                        editable={!loading}
                    />
                </View>

                <TouchableOpacity
                    className={`h-14 rounded-full items-center justify-center ${network && amount && phoneNumber.length >= 10 && !loading ? 'bg-primary' : 'bg-gray-300'
                        }`}
                    onPress={handlePurchase}
                    disabled={!network || !amount || phoneNumber.length < 10 || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Purchase</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
