import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function LendingHQ() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Lending HQ' }} />

            <View className="p-6">
                <View className="bg-white p-6 rounded-3xl mb-8 shadow-sm border border-slate-100">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-2">Total Loan Book</Text>
                    <Text className="text-4xl font-black text-slate-800">₦ 84.5M</Text>
                    <View className="flex-row gap-4 mt-6">
                        <View>
                            <Text className="text-green-600 font-bold text-lg">92%</Text>
                            <Text className="text-slate-400 text-[10px]">Performing</Text>
                        </View>
                        <View className="w-[1px] bg-gray-200" />
                        <View>
                            <Text className="text-red-500 font-bold text-lg">8%</Text>
                            <Text className="text-slate-400 text-[10px]">Defaulted</Text>
                        </View>
                    </View>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Loan Requests (AI Scored)</Text>

                {[
                    { name: 'Ibrahim Sani', amount: '₦ 500,000', score: 98, status: 'safe' },
                    { name: 'Grace Okoye', amount: '₦ 1,200,000', score: 45, status: 'risk' },
                    { name: 'John Doe', amount: '₦ 250,000', score: 72, status: 'medium' },
                ].map((loan, i) => (
                    <View key={i} className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm">
                        <View className="flex-row justify-between items-start mb-2">
                            <View>
                                <Text className="font-bold text-slate-800 text-base">{loan.name}</Text>
                                <Text className="text-slate-400 text-xs">Requesting {loan.amount}</Text>
                            </View>
                            <View className={`w-10 h-10 rounded-full items-center justify-center border-4 ${loan.status === 'safe' ? 'border-green-100 bg-green-50' : loan.status === 'risk' ? 'border-red-100 bg-red-50' : 'border-yellow-100 bg-yellow-50'}`}>
                                <Text className={`font-black text-xs ${loan.status === 'safe' ? 'text-green-600' : loan.status === 'risk' ? 'text-red-600' : 'text-yellow-600'}`}>{loan.score}</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-2 mt-2">
                            <TouchableOpacity className="flex-1 bg-slate-900 py-2 rounded-lg items-center">
                                <Text className="text-white font-bold text-xs">Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-1 bg-red-50 py-2 rounded-lg items-center">
                                <Text className="text-red-500 font-bold text-xs">Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
