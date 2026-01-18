import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function WealthManager() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Wealth & Assets' }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-slate-800">Assets Under Mgmt</Text>
                    <Ionicons name="briefcase" size={24} color="#64748B" />
                </View>

                {/* Crypto Pool */}
                <View className="bg-indigo-600 p-5 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                                <Ionicons name="logo-bitcoin" size={16} color="white" />
                            </View>
                            <Text className="text-white font-bold">Crypto Vault</Text>
                        </View>
                        <Text className="text-indigo-200 font-bold text-xs">High Risk</Text>
                    </View>
                    <Text className="text-3xl font-black text-white">$ 4.2M</Text>
                    <Text className="text-indigo-200 text-xs mt-1">Users staked: 8,420</Text>
                </View>

                {/* Stocks Pool */}
                <View className="bg-white p-5 rounded-2xl mb-4 border border-gray-100 shadow-sm">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                                <Ionicons name="trending-up" size={16} color="#15803d" />
                            </View>
                            <Text className="text-slate-800 font-bold">US Stocks</Text>
                        </View>
                        <Text className="text-slate-400 font-bold text-xs">Stable</Text>
                    </View>
                    <Text className="text-3xl font-black text-slate-800">$ 12.8M</Text>
                    <Text className="text-slate-400 text-xs mt-1">Users invested: 14,200</Text>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4 mt-4">Savings APY Control</Text>

                {[
                    { name: 'Standard Savings', rate: '8.5%', color: 'blue' },
                    { name: 'Fixed Deposit (30 Days)', rate: '12.0%', color: 'purple' },
                    { name: 'Halal Savings', rate: '0% (Profit Share)', color: 'green' },
                ].map((plan, i) => (
                    <View key={i} className="flex-row justify-between items-center py-4 border-b border-gray-100">
                        <Text className="font-bold text-slate-700">{plan.name}</Text>
                        <View className="flex-row items-center gap-3">
                            <Text className="font-black text-lg text-slate-800">{plan.rate}</Text>
                            <TouchableOpacity>
                                <Ionicons name="create-outline" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
