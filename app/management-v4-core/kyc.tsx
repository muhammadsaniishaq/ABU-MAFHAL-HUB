import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const kycQueue = Array.from({ length: 8 }).map((_, i) => ({
    id: `KYC-${800 + i}`,
    user: ['Fatima Zahra', 'Musa Ibrahim', 'Chidinma Ngozi', 'Emeka Okonkwo'][i % 4],
    docType: 'NIN Slip',
    status: 'Pending Review',
    submitted: `${i * 10 + 5}m ago`
}));

export default function KYCQueue() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'KYC Verification' }} />

            <View className="p-4">
                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-blue-500 p-4 rounded-2xl items-center">
                        <Text className="text-white text-2xl font-black">{kycQueue.length}</Text>
                        <Text className="text-blue-100 text-xs font-bold uppercase">Pending</Text>
                    </View>
                    <View className="flex-1 bg-green-500 p-4 rounded-2xl items-center">
                        <Text className="text-white text-2xl font-black">104</Text>
                        <Text className="text-green-100 text-xs font-bold uppercase">Approved Today</Text>
                    </View>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-xs mb-3 ml-1">Verification Queue</Text>
            </View>

            <FlatList
                data={kycQueue}
                keyExtractor={item => item.id}
                className="px-4"
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-2xl mb-4 border border-gray-100 shadow-sm">
                        <View className="flex-row justify-between items-start mb-4">
                            <View className="flex-row items-center gap-3">
                                <View className="w-12 h-12 bg-slate-100 rounded-full items-center justify-center">
                                    <Text className="font-bold text-slate-500 text-lg">{item.user[0]}</Text>
                                </View>
                                <View>
                                    <Text className="font-bold text-slate-800 text-base">{item.user}</Text>
                                    <View className="flex-row items-center gap-1">
                                        <Ionicons name="document-text" size={12} color="#94A3B8" />
                                        <Text className="text-gray-400 text-xs">{item.docType}</Text>
                                    </View>
                                </View>
                            </View>
                            <View className="bg-orange-100 px-2 py-1 rounded text-[10px]">
                                <Text className="text-orange-600 text-[10px] font-bold">PENDING</Text>
                            </View>
                        </View>

                        <View className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 flex-row items-center justify-between">
                            <Text className="text-xs text-gray-500">Submitted {item.submitted}</Text>
                            <TouchableOpacity>
                                <Text className="text-blue-600 text-xs font-bold">View Document</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity className="flex-1 h-10 bg-gray-100 rounded-xl items-center justify-center border border-gray-200">
                                <Text className="text-slate-600 font-bold">Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-1 h-10 bg-slate-900 rounded-xl items-center justify-center shadow-lg shadow-slate-900/20">
                                <Text className="text-white font-bold">Approve</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}
