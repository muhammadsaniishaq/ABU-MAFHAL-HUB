import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { DataPlan } from '../services/partners';

export default function DataScreen() {
    const [network, setNetwork] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
    const [plans, setPlans] = useState<DataPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    const router = useRouter();

    const networks = [
        { id: 'mtn', name: 'MTN', color: '#FFCC00' },
        { id: 'glo', name: 'Glo', color: '#0F6A37' },
        { id: 'airtel', name: 'Airtel', color: '#FF0000' },
        { id: '9mobile', name: '9mobile', color: '#006B3E' },
    ];

    // Fetch plans when network changes
    useEffect(() => {
        if (network) {
            fetchPlans(network);
        } else {
            setPlans([]);
        }
    }, [network]);

    const fetchPlans = async (netId: string) => {
        setLoadingPlans(true);
        try {
            const data = await api.data.getPlans(netId);
            setPlans(data);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load data plans");
        } finally {
            setLoadingPlans(false);
        }
    };

    const handlePurchase = () => {
        if (!network || !phoneNumber || !selectedPlan) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        Alert.alert(
            "Confirm Purchase",
            `Buy ${selectedPlan.name} for ${phoneNumber} on ${network.toUpperCase()} @ ₦${selectedPlan.price}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        await processTransaction();
                    }
                }
            ]
        );
    };

    const processTransaction = async () => {
        if (!selectedPlan) return;
        setLoadingPurchase(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const result = await api.data.purchase(user.id, {
                network,
                phone: phoneNumber,
                planId: selectedPlan.id,
                amount: selectedPlan.price,
                planName: selectedPlan.name
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${selectedPlan.price}`,
                        type: 'Data Bundle',
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
            setLoadingPurchase(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Buy Data', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                {/* Network Selection */}
                <Text className="text-slate font-bold mb-4">Select Network</Text>
                <View className="flex-row flex-wrap gap-4 mb-8">
                    {networks.map((net) => (
                        <TouchableOpacity
                            key={net.id}
                            className={`w-[48%] h-20 rounded-2xl items-center flex-row px-4 border ${network === net.id ? 'border-primary bg-blue-50/50' : 'border-gray-100 bg-white shadow-sm'
                                }`}
                            onPress={() => { setNetwork(net.id); setSelectedPlan(null); }}
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

                {/* Phone Number */}
                <Text className="text-slate font-bold mb-4">Phone Number</Text>
                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 h-14 bg-gray-50 mb-8">
                    <TextInput
                        className="flex-1 text-lg font-medium text-slate"
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="08012345678"
                        maxLength={11}
                        editable={!loadingPurchase}
                    />
                </View>

                {/* Data Plans */}
                {network && (
                    <View>
                        <Text className="text-slate font-bold mb-4">Select Plan</Text>
                        {loadingPlans ? (
                            <View className="h-40 items-center justify-center">
                                <ActivityIndicator color="#0056D2" />
                            </View>
                        ) : (
                            <View className="gap-3 mb-8">
                                {plans.map((plan) => (
                                    <TouchableOpacity
                                        key={plan.id}
                                        className={`p-4 rounded-2xl border flex-row justify-between items-center ${selectedPlan?.id === plan.id ? 'border-primary bg-blue-50/50' : 'border-gray-100 bg-white shadow-sm'
                                            }`}
                                        onPress={() => setSelectedPlan(plan)}
                                        disabled={loadingPurchase}
                                    >
                                        <View className="flex-row items-center">
                                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${selectedPlan?.id === plan.id ? 'bg-primary/10' : 'bg-gray-100'}`}>
                                                <Ionicons name="wifi" size={20} color={selectedPlan?.id === plan.id ? '#0056D2' : '#6B7280'} />
                                            </View>
                                            <View>
                                                <Text className={`font-bold text-base ${selectedPlan?.id === plan.id ? 'text-primary' : 'text-slate'}`}>{plan.name}</Text>
                                                <Text className="text-gray-400 text-xs">{plan.validity}</Text>
                                            </View>
                                        </View>
                                        <Text className="font-bold text-slate text-lg">₦{plan.price}</Text>
                                    </TouchableOpacity>
                                ))}
                                {plans.length === 0 && <Text className="text-gray-400 font-medium italic">No plans available for this network.</Text>}
                            </View>
                        )}
                    </View>
                )}

                <TouchableOpacity
                    className={`h-14 rounded-full items-center justify-center mb-8 ${network && phoneNumber && selectedPlan && !loadingPurchase ? 'bg-primary' : 'bg-gray-300'
                        }`}
                    onPress={handlePurchase}
                    disabled={!network || !phoneNumber || !selectedPlan || loadingPurchase}
                >
                    {loadingPurchase ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Purchase Data</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
