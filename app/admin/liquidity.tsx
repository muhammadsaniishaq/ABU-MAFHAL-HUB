import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const reserves = [
    { currency: 'NGN', amount: '₦ 45,200,000', level: '85%', color: '#10B981', status: 'Healthy' },
    { currency: 'USDT', amount: '$ 12,500', level: '40%', color: '#22C55E', status: 'Low Float' },
    { currency: 'BTC', amount: '0.45 BTC', level: '60%', color: '#F59E0B', status: 'Optimal' },
];

export default function LiquidityVault() {
    return (
        <View className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Liquidity Vault',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row items-center justify-between mb-8">
                    <View>
                        <Text className="text-3xl font-black text-white">Reserves</Text>
                        <Text className="text-slate-400 font-medium">Total Solvency Ratio: <Text className="text-green-400 font-bold">142%</Text></Text>
                    </View>
                    <TouchableOpacity className="bg-indigo-600 px-4 py-2 rounded-lg flex-row items-center gap-2">
                        <Ionicons name="swap-horizontal" size={16} color="white" />
                        <Text className="text-white font-bold text-xs">Rebalance</Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row justify-between gap-4 h-[400px]">
                    {reserves.map((res, i) => (
                        <View key={i} className="flex-1 bg-slate-800 rounded-[30px] p-2 items-center justify-end relative overflow-hidden border border-slate-700">
                            {/* Fluid Mock */}
                            <LinearGradient
                                colors={[res.color, '#0F172A']}
                                style={{ height: res.level, width: '100%', borderRadius: 20 }}
                                className="absolute bottom-2 opacity-80"
                            />

                            <View className="absolute top-4 items-center w-full">
                                <View className="w-12 h-12 rounded-full bg-slate-900/50 items-center justify-center border border-white/10 mb-2">
                                    <Text className="font-black text-white text-xs">{res.currency}</Text>
                                </View>
                                <View className={`px-2 py-1 rounded-full ${res.status === 'Low Float' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                    <Text className={`text-[8px] font-bold uppercase ${res.status === 'Low Float' ? 'text-red-400' : 'text-green-400'}`}>{res.status}</Text>
                                </View>
                            </View>

                            <View className="mb-6 items-center z-10">
                                <Text className="text-white font-bold text-lg text-center leading-5 mb-1">{res.amount}</Text>
                                <Text className="text-slate-400 text-xs font-bold">{res.level}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View className="mt-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-3">Recent Inflows</Text>
                    <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center gap-3">
                            <Ionicons name="arrow-down-circle" size={24} color="#10B981" />
                            <View>
                                <Text className="text-white font-bold text-sm">Paystack Settlement</Text>
                                <Text className="text-slate-500 text-[10px]">Today, 09:41 AM</Text>
                            </View>
                        </View>
                        <Text className="text-green-400 font-mono font-bold">+ ₦2,500,000</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
