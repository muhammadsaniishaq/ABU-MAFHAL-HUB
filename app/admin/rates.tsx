import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const rates = [
    { pair: 'USDT / NGN', buy: 1580, sell: 1620, trend: 'up' },
    { pair: 'BTC / USD', buy: 68500, sell: 69200, trend: 'up' },
    { pair: 'ETH / USD', buy: 3450, sell: 3510, trend: 'down' },
];

export default function RatesBoard() {
    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{
                title: 'Market Maker',
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <Text className="text-red-500 font-mono text-xs mb-2">● LIVE FEED CONNECTED</Text>

                {rates.map((rate, i) => (
                    <View key={i} className="mb-6 bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black text-white">{rate.pair}</Text>
                            <View className={`flex-row items-center gap-1 ${rate.trend === 'up' ? 'bg-green-900/30' : 'bg-red-900/30'} px-2 py-1 rounded`}>
                                <Ionicons name={rate.trend === 'up' ? 'trending-up' : 'trending-down'} size={16} color={rate.trend === 'up' ? '#4ADE80' : '#F87171'} />
                                <Text className={rate.trend === 'up' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>0.4%</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-4">
                            {/* BUY SIDE */}
                            <View className="flex-1 bg-black rounded-lg p-4 border border-green-900/30 items-center">
                                <Text className="text-slate-500 font-bold text-xs uppercase mb-2">We Buy At</Text>
                                <Text className="text-3xl font-mono font-bold text-green-500">{rate.buy.toLocaleString()}</Text>
                                <View className="flex-row mt-4 gap-4">
                                    <TouchableOpacity className="bg-gray-800 w-8 h-8 rounded items-center justify-center">
                                        <Ionicons name="remove" size={16} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity className="bg-gray-800 w-8 h-8 rounded items-center justify-center">
                                        <Ionicons name="add" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* SELL SIDE */}
                            <View className="flex-1 bg-black rounded-lg p-4 border border-red-900/30 items-center">
                                <Text className="text-slate-500 font-bold text-xs uppercase mb-2">We Sell At</Text>
                                <Text className="text-3xl font-mono font-bold text-red-500">{rate.sell.toLocaleString()}</Text>
                                <View className="flex-row mt-4 gap-4">
                                    <TouchableOpacity className="bg-gray-800 w-8 h-8 rounded items-center justify-center">
                                        <Ionicons name="remove" size={16} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity className="bg-gray-800 w-8 h-8 rounded items-center justify-center">
                                        <Ionicons name="add" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity className="bg-indigo-600 py-4 rounded-xl items-center mt-4">
                    <Text className="text-white font-bold text-lg">Push Rate Update</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
