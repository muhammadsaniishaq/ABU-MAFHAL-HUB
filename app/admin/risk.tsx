import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function RiskMonitor() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Risk Control' }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-slate-800">System Exposure</Text>
                    <View className="px-3 py-1 bg-green-100 rounded-full">
                        <Text className="text-green-700 font-bold text-xs uppercase">Low Risk</Text>
                    </View>
                </View>

                {/* Net Position Card */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Net Open Position</Text>
                    <View className="flex-row items-end gap-2">
                        <Text className="text-4xl font-black text-slate-800">₦ 12.4M</Text>
                        <Text className="text-slate-400 font-bold mb-2">Long</Text>
                    </View>
                    <View className="h-2 w-full bg-gray-100 rounded-full mt-4 overflow-hidden relative">
                        <View className="absolute left-[50%] h-full w-[20%] bg-blue-500 rounded-full" />
                        <View className="absolute left-[50%] w-0.5 h-4 -top-1 bg-slate-900" />
                    </View>
                    <View className="flex-row justify-between mt-1">
                        <Text className="text-[10px] text-slate-400 font-bold">Short Limit</Text>
                        <Text className="text-[10px] text-slate-400 font-bold">Long Limit</Text>
                    </View>
                </View>

                {/* PnL Card */}
                <View className="flex-row gap-4 mb-6">
                    <View className="flex-1 bg-green-50 p-4 rounded-2xl border border-green-100">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="bar-chart" size={16} color="#15803d" />
                            <Text className="text-green-800 font-bold text-xs">Daily PnL</Text>
                        </View>
                        <Text className="text-2xl font-black text-green-700">+ ₦850K</Text>
                    </View>
                    <View className="flex-1 bg-orange-50 p-4 rounded-2xl border border-orange-100">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="alert-circle" size={16} color="#c2410c" />
                            <Text className="text-orange-800 font-bold text-xs">Pending Flags</Text>
                        </View>
                        <Text className="text-2xl font-black text-orange-700">3 Tx</Text>
                    </View>
                </View>

                {/* Counterparty Risk */}
                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Counterparty Risk</Text>
                {[1, 2, 3].map((_, i) => (
                    <View key={i} className="flex-row items-center justify-between py-3 border-b border-gray-100">
                        <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                                <Text className="font-bold text-slate-500 text-xs">VN</Text>
                            </View>
                            <Text className="font-bold text-slate-700">Vendor Node {i + 1}</Text>
                        </View>
                        <Text className="font-bold text-indigo-600">98% Score</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
