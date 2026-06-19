import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function CardManager() {
    return (
        <View className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Card Issuer',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-8">
                    <Text className="text-2xl font-black text-white">Issued Cards</Text>
                    <TouchableOpacity className="bg-indigo-600 px-4 py-2 rounded-lg flex-row items-center gap-2">
                        <Ionicons name="add" size={16} color="white" />
                        <Text className="text-white font-bold text-xs">Issue New</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8 pl-2">
                    {/* Visa Card Mock */}
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        className="w-[300px] h-[180px] rounded-2xl p-6 justify-between mr-4 border border-slate-700 relative overflow-hidden"
                    >
                        <View className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-10 -mt-10" />

                        <View className="flex-row justify-between items-start">
                            <Text className="text-white font-bold text-lg italic">Visa</Text>
                            <Ionicons name="wifi" size={20} color="white" style={{ opacity: 0.5 }} />
                        </View>

                        <View className="flex-row items-center gap-4">
                            <View className="w-10 h-8 bg-yellow-400/20 rounded border border-yellow-400/40" />
                            <Text className="text-white font-mono text-lg tracking-widest">4242  ••••  ••••  9912</Text>
                        </View>

                        <View className="flex-row justify-between items-end">
                            <View>
                                <Text className="text-slate-400 text-[8px] uppercase font-bold">Card Holder</Text>
                                <Text className="text-white font-bold text-sm">AHMED MUSA</Text>
                            </View>
                            <Text className="text-white font-bold text-xs">09/28</Text>
                        </View>
                    </LinearGradient>

                    {/* Mastercard Mock */}
                    <LinearGradient
                        colors={['#451a03', '#7c2d12']}
                        className="w-[300px] h-[180px] rounded-2xl p-6 justify-between mr-4 border border-orange-900/50 relative overflow-hidden"
                    >
                        <View className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl -ml-10 -mb-10" />
                        <View className="flex-row justify-between items-start">
                            <View className="flex-row">
                                <View className="w-6 h-6 rounded-full bg-red-500/80" />
                                <View className="w-6 h-6 rounded-full bg-yellow-500/80 -ml-3" />
                            </View>
                            <Ionicons name="wifi" size={20} color="white" style={{ opacity: 0.5 }} />
                        </View>
                        <View className="flex-row items-center gap-4">
                            <View className="w-10 h-8 bg-slate-400/20 rounded border border-slate-400/40" />
                            <Text className="text-white font-mono text-lg tracking-widest">5399  ••••  ••••  8821</Text>
                        </View>
                        <View className="flex-row justify-between items-end">
                            <View>
                                <Text className="text-orange-200 text-[8px] uppercase font-bold">Card Holder</Text>
                                <Text className="text-white font-bold text-sm">FATIMA UMAR</Text>
                            </View>
                            <Text className="text-white font-bold text-xs">11/27</Text>
                        </View>
                    </LinearGradient>
                </ScrollView>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Merchant Controls</Text>

                {[
                    { name: 'Betting & Gambling', status: 'Blocked', color: 'red' },
                    { name: 'Crypto Exchanges', status: 'Allowed', color: 'green' },
                    { name: 'International Tx', status: 'Flagged', color: 'orange' },
                ].map((rule, i) => (
                    <View key={i} className="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700 flex-row justify-between items-center">
                        <Text className="text-white font-bold">{rule.name}</Text>
                        <View className={`px-3 py-1 rounded-lg ${rule.color === 'red' ? 'bg-red-500/20' : rule.color === 'green' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                            <Text className={`font-bold text-xs ${rule.color === 'red' ? 'text-red-400' : rule.color === 'green' ? 'text-green-400' : 'text-orange-400'}`}>{rule.status}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
