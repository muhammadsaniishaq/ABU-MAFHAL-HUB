import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const folders = [
    { name: 'User Documents', count: 1205, color: '#3B82F6' },
    { name: 'Invoices', count: 450, color: '#10B981' },
    { name: 'App Assets', count: 89, color: '#F59E0B' },
    { name: 'System Logs', count: 12, color: '#64748B' },
];

export default function FileManager() {
    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Cloud Files' }} />

            <View className="p-6 pb-2">
                <View className="bg-slate-900 rounded-2xl p-6 mb-6">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-2">Storage Usage</Text>
                    <Text className="text-white text-3xl font-black mb-1">45.2 GB <Text className="text-lg text-slate-500 font-medium">/ 100 GB</Text></Text>

                    <View className="h-2 w-full bg-slate-800 rounded-full mt-4 overflow-hidden flex-row">
                        <View className="h-full w-[40%] bg-blue-500" />
                        <View className="h-full w-[15%] bg-green-500" />
                        <View className="h-full w-[8%] bg-orange-500" />
                    </View>
                    <View className="flex-row gap-4 mt-3">
                        <View className="flex-row items-center gap-1">
                            <View className="w-2 h-2 rounded-full bg-blue-500" />
                            <Text className="text-slate-400 text-[10px]">Docs</Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            <View className="w-2 h-2 rounded-full bg-green-500" />
                            <Text className="text-slate-400 text-[10px]">Media</Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            <View className="w-2 h-2 rounded-full bg-orange-500" />
                            <Text className="text-slate-400 text-[10px]">Other</Text>
                        </View>
                    </View>
                </View>

                <View className="flex-row justify-between mb-4">
                    <Text className="text-slate-800 font-bold text-lg">My Folders</Text>
                    <TouchableOpacity>
                        <Ionicons name="add-circle" size={24} color="#3B82F6" />
                    </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap justify-between gap-y-4">
                    {folders.map((folder, i) => (
                        <TouchableOpacity key={i} className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <Ionicons name="folder" size={32} color={folder.color} className="mb-2" />
                            <Text className="font-bold text-slate-700 text-sm">{folder.name}</Text>
                            <Text className="text-gray-400 text-xs">{folder.count} items</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-4">
                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-3">Recent Uploads</Text>
                {[1, 2, 3, 4, 5].map((_, i) => (
                    <View key={i} className="flex-row items-center justify-between py-3 border-b border-gray-50">
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 bg-slate-100 rounded-lg items-center justify-center">
                                <Ionicons name={i % 2 === 0 ? 'image' : 'document-text'} size={20} color="#64748B" />
                            </View>
                            <View>
                                <Text className="font-bold text-slate-700 text-sm">invoice_january_{i + 1}.pdf</Text>
                                <Text className="text-gray-400 text-[10px]">2.4 MB • Just now</Text>
                            </View>
                        </View>
                        <Ionicons name="ellipsis-vertical" size={16} color="#CBD5E1" />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
