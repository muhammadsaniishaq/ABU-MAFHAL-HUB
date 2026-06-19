import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function BillsScreen() {
    const [category, setCategory] = useState<'electricity' | 'tv'>('electricity');
    const [provider, setProvider] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [amount, setAmount] = useState('');
    const router = useRouter();

    const electricityProviders = [
        { id: 'ikedc', name: 'Ikeja Electric' },
        { id: 'ekedc', name: 'Eko Electric' },
        { id: 'aedc', name: 'Abuja Electric' },
        { id: 'ibedc', name: 'Ibadan Electric' },
    ];

    const tvProviders = [
        { id: 'dstv', name: 'DSTV' },
        { id: 'gotv', name: 'GOTV' },
        { id: 'startimes', name: 'StarTimes' },
    ];

    const providers = category === 'electricity' ? electricityProviders : tvProviders;

    const handlePay = () => {
        if (!provider || !customerId || !amount) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        Alert.alert(
            "Confirm Payment",
            `Pay ₦${amount} for ${provider.toUpperCase()} (${customerId})?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm", onPress: () => {
                        Alert.alert("Success", "Payment Successful!");
                        router.back();
                    }
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Pay Bills', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                {/* Category Switcher */}
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-6">
                    <TouchableOpacity
                        className={`flex-1 py-3 items-center rounded-lg ${category === 'electricity' ? 'bg-white shadow-sm' : ''}`}
                        onPress={() => { setCategory('electricity'); setProvider(''); }}
                    >
                        <Text className={`font-bold ${category === 'electricity' ? 'text-primary' : 'text-gray-500'}`}>Electricity</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-3 items-center rounded-lg ${category === 'tv' ? 'bg-white shadow-sm' : ''}`}
                        onPress={() => { setCategory('tv'); setProvider(''); }}
                    >
                        <Text className={`font-bold ${category === 'tv' ? 'text-primary' : 'text-gray-500'}`}>Cable TV</Text>
                    </TouchableOpacity>
                </View>

                {/* Provider Selection */}
                <Text className="text-slate font-bold mb-4">Select Provider</Text>
                <View className="flex-row flex-wrap justify-between gap-y-4 mb-6">
                    {providers.map((p) => (
                        <TouchableOpacity
                            key={p.id}
                            className={`w-[48%] py-4 rounded-2xl border items-center justify-center ${provider === p.id ? 'bg-blue-50/50 border-primary' : 'bg-gray-50 border-gray-100'
                                }`}
                            onPress={() => setProvider(p.id)}
                        >
                            <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${provider === p.id ? 'bg-primary' : 'bg-white border border-gray-100'}`}>
                                <Ionicons
                                    name={category === 'electricity' ? 'flash' : 'tv'}
                                    size={20}
                                    color={provider === p.id ? 'white' : '#64748B'}
                                />
                            </View>
                            <Text className={`font-bold text-center ${provider === p.id ? 'text-primary' : 'text-gray-600'}`}>
                                {p.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Customer ID */}
                <Text className="text-slate font-bold mb-4">
                    {category === 'electricity' ? 'Meter Number' : 'IUC / SmartCard Number'}
                </Text>
                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 h-14 bg-gray-50 mb-6">
                    <TextInput
                        className="flex-1 text-lg font-medium text-slate"
                        keyboardType="number-pad"
                        value={customerId}
                        onChangeText={setCustomerId}
                        placeholder={category === 'electricity' ? '1234567890' : '7012345678'}
                    />
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
                    className={`h-14 rounded-full items-center justify-center mb-8 ${provider && customerId && amount ? 'bg-primary' : 'bg-gray-300'
                        }`}
                    onPress={handlePay}
                    disabled={!provider || !customerId || !amount}
                >
                    <Text className="text-white font-bold text-lg">Pay Bill</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
