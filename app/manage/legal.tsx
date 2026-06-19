import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function LegalVault() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Legal Vault' }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-slate-800">Contracts</Text>
                    <View className="px-3 py-1 bg-indigo-100 rounded-full">
                        <Text className="text-indigo-700 font-bold text-xs">All Active</Text>
                    </View>
                </View>

                {/* Doc Card */}
                <View className="bg-white p-4 rounded-xl border border-gray-100 mb-4 flex-row items-center shadow-sm">
                    <View className="w-12 h-14 bg-red-50 border border-red-100 rounded items-center justify-center mr-4">
                        <Text className="text-red-500 font-black text-[10px]">PDF</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="font-bold text-slate-800 text-base">CBN License 2026.pdf</Text>
                        <Text className="text-slate-400 text-xs">Expires in 342 days • Official</Text>
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="ellipsis-vertical" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                </View>

                <View className="bg-white p-4 rounded-xl border border-gray-100 mb-4 flex-row items-center shadow-sm">
                    <View className="w-12 h-14 bg-blue-50 border border-blue-100 rounded items-center justify-center mr-4">
                        <Text className="text-blue-500 font-black text-[10px]">DOC</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="font-bold text-slate-800 text-base">Partner Agreement - Visa</Text>
                        <Text className="text-slate-400 text-xs">Signed on Jan 12 • Active</Text>
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="ellipsis-vertical" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4 mt-4">Pending Signatures</Text>

                <View className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="font-bold text-orange-900">NDA - New Developer</Text>
                        <Ionicons name="time" size={16} color="#c2410c" />
                    </View>
                    <Text className="text-orange-700/70 text-xs mb-4">Waiting for signature from John Doe.</Text>
                    <TouchableOpacity className="bg-white py-2 rounded border border-orange-200 items-center">
                        <Text className="text-orange-600 font-bold text-xs">Resend Email</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity className="mt-auto bg-slate-900 py-4 rounded-xl items-center flex-row justify-center gap-2">
                    <Ionicons name="add-circle" size={20} color="white" />
                    <Text className="text-white font-bold text-lg">Upload Document</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
