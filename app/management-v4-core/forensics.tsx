import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function ForensicsLab() {
    return (
        <View className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Forensics Unit',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-white">Investigation #402</Text>
                    <View className="px-3 py-1 bg-red-500/20 rounded-full border border-red-500/50">
                        <Text className="text-red-400 font-bold text-xs uppercase">High Probability Fraud</Text>
                    </View>
                </View>

                {/* Graph Mock */}
                <View className="h-[400px] bg-slate-800 rounded-3xl border border-slate-700 relative overflow-hidden mb-6">
                    <Text className="absolute top-4 left-4 text-slate-500 font-bold text-[10px] uppercase">Link Analysis (Shared Device ID)</Text>

                    {/* Nodes */}
                    <View className="absolute top-[30%] left-[40%] items-center z-20">
                        <View className="w-16 h-16 bg-red-600 rounded-full items-center justify-center border-4 border-slate-800">
                            <Ionicons name="phone-portrait" size={24} color="white" />
                        </View>
                        <Text className="text-white font-bold text-xs mt-2 bg-slate-900 px-2 py-1 rounded">iPhone 14 Pro</Text>
                    </View>

                    <View className="absolute top-[10%] left-[20%] items-center z-10">
                        <View className="w-10 h-10 bg-slate-600 rounded-full items-center justify-center border-2 border-slate-800">
                            <Text className="font-bold text-white text-xs">U1</Text>
                        </View>
                        <Text className="text-slate-400 text-[10px] mt-1">User A</Text>
                    </View>

                    <View className="absolute top-[60%] left-[15%] items-center z-10">
                        <View className="w-10 h-10 bg-slate-600 rounded-full items-center justify-center border-2 border-slate-800">
                            <Text className="font-bold text-white text-xs">U2</Text>
                        </View>
                        <Text className="text-slate-400 text-[10px] mt-1">User B</Text>
                    </View>

                    <View className="absolute top-[20%] right-[20%] items-center z-10">
                        <View className="w-10 h-10 bg-slate-600 rounded-full items-center justify-center border-2 border-slate-800">
                            <Text className="font-bold text-white text-xs">U3</Text>
                        </View>
                        <Text className="text-slate-400 text-[10px] mt-1">User C</Text>
                    </View>

                    {/* Lines (CSS Borders) */}
                    <View className="absolute top-[20%] left-[25%] w-[80px] h-[60px] border-b border-l border-slate-500/30 rotate-12" />
                    <View className="absolute top-[40%] left-[20%] w-[90px] h-[50px] border-t border-r border-slate-500/30 -rotate-12" />
                    <View className="absolute top-[30%] right-[35%] w-[60px] h-[40px] border-b border-r border-slate-500/30 rotate-45" />
                </View>

                <View className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-3">AI Analysis</Text>
                    <View className="flex-row gap-3">
                        <Ionicons name="alert-circle" size={24} color="#F87171" />
                        <View className="flex-1">
                            <Text className="text-slate-200 font-bold text-sm mb-1">Multi-Accounting Detected</Text>
                            <Text className="text-slate-500 text-xs leading-5">3 Accounts logged in from the same Device ID (IMEI ending 9822) within 4 minutes. High likelihood of referral fraud.</Text>
                        </View>
                    </View>
                    <TouchableOpacity className="mt-4 bg-red-600 py-3 rounded-lg items-center">
                        <Text className="text-white font-bold text-sm">Freeze All 3 Accounts</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
