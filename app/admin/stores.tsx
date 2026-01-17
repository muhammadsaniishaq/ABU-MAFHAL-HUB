import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function AppStores() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'App Release' }} />

            <View className="p-6">
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Current Production Build</Text>
                    <View className="flex-row justify-between items-end">
                        <View>
                            <Text className="text-4xl font-black text-slate-800">v2.4.1</Text>
                            <Text className="text-green-500 font-bold text-xs mt-1">● Live on Stores</Text>
                        </View>
                        <View className="flex-row gap-2">
                            <View className="w-10 h-10 bg-black rounded-xl items-center justify-center">
                                <Ionicons name="logo-apple" size={20} color="white" />
                            </View>
                            <View className="w-10 h-10 bg-green-600 rounded-xl items-center justify-center">
                                <Ionicons name="logo-google-playstore" size={20} color="white" />
                            </View>
                        </View>
                    </View>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Release Pipeline</Text>

                {/* Release Card */}
                <View className="bg-white p-5 rounded-2xl border border-gray-100 mb-4">
                    <View className="flex-row justify-between mb-2">
                        <Text className="font-bold text-lg text-slate-800">v2.5.0 <Text className="text-slate-400 font-normal">(Beta)</Text></Text>
                        <View className="px-2 py-1 bg-blue-100 rounded text-blue-600 text-[10px] font-bold">
                            <Text className="text-blue-600 font-bold text-[10px]">IN REVIEW</Text>
                        </View>
                    </View>
                    <Text className="text-slate-500 text-sm mb-4">Adds Admin Console Phase 10 features and performance improvements.</Text>

                    <View className="flex-row gap-4">
                        <TouchableOpacity className="flex-1 bg-slate-900 py-3 rounded-lg items-center">
                            <Text className="text-white font-bold text-xs">View Metadata</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 bg-red-50 py-3 rounded-lg items-center border border-red-100">
                            <Text className="text-red-500 font-bold text-xs">Reject Build</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Release Card */}
                <View className="bg-white p-5 rounded-2xl border border-gray-100 opacity-60">
                    <View className="flex-row justify-between mb-2">
                        <Text className="font-bold text-lg text-slate-800">v2.6.0 <Text className="text-slate-400 font-normal">(Alpha)</Text></Text>
                        <View className="px-2 py-1 bg-orange-100 rounded text-blue-600 text-[10px] font-bold">
                            <Text className="text-orange-600 font-bold text-[10px]">DEVELOPMENT</Text>
                        </View>
                    </View>
                    <Text className="text-slate-500 text-sm mb-4">Planned: Biometric authentication upgrade.</Text>
                </View>

                <TouchableOpacity className="mt-8 border-2 border-dashed border-gray-300 p-4 rounded-2xl items-center">
                    <Ionicons name="cloud-upload" size={24} color="#CBD5E1" />
                    <Text className="text-slate-400 font-bold text-sm mt-2">Upload New Binary (.ipa / .apk)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
