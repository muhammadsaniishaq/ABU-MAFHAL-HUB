import { View, Text, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function KYCScreen() {
    const [tier, setTier] = useState<1 | 2 | 3>(1);
    const router = useRouter();

    const tiers = [
        { level: 1, limit: '₦50,000', req: 'Email & Phone Verified' },
        { level: 2, limit: '₦500,000', req: 'BVN / NIN' },
        { level: 3, limit: 'Unlimited', req: 'ID Card & Utility Bill' },
    ];

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'KYC Verification', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="flex-row justify-between mb-8">
                    {tiers.map((t) => (
                        <TouchableOpacity
                            key={t.level}
                            onPress={() => setTier(t.level as any)}
                            className={`items-center flex-1 ${tier === t.level ? 'opacity-100' : 'opacity-50'}`}
                        >
                            <View className={`w-8 h-8 rounded-full items-center justify-center mb-2 ${tier >= t.level ? 'bg-primary' : 'bg-gray-200'}`}>
                                <Text className={`font-bold ${tier >= t.level ? 'text-white' : 'text-gray-500'}`}>{t.level}</Text>
                            </View>
                            <Text className="text-xs font-bold text-slate">Tier {t.level}</Text>
                        </TouchableOpacity>
                    ))}
                    <View className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 -z-10 mt-0.5" />
                </View>

                <View className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
                    <Text className="text-primary font-bold text-xl mb-2">Tier {tier} Account</Text>
                    <Text className="text-gray-600 mb-4">Daily Transaction Limit: <Text className="font-bold text-slate">{tiers[tier - 1].limit}</Text></Text>

                    <View className="flex-row items-center gap-2 mb-2">
                        <Ionicons name="checkmark-circle" size={20} color="#107C10" />
                        <Text className="text-sm text-gray-700">Requirements: {tiers[tier - 1].req}</Text>
                    </View>
                </View>

                {tier === 1 ? (
                    <View className="items-center py-8">
                        <Ionicons name="shield-checkmark" size={64} color="#107C10" />
                        <Text className="text-green-700 font-bold text-lg mt-4">Verified</Text>
                        <Text className="text-gray-500 text-center mt-2 px-8">Your account is currently at Tier 1. Upgrade to increase your limits.</Text>
                    </View>
                ) : (
                    <View>
                        <Text className="font-bold text-slate mb-4">Upload Documents</Text>

                        <TouchableOpacity className="border-2 border-dashed border-gray-300 rounded-xl p-8 items-center justify-center mb-4 bg-gray-50">
                            <Ionicons name="cloud-upload-outline" size={32} color="#6B7280" />
                            <Text className="text-gray-500 mt-2 font-medium">Click to Upload ID Card</Text>
                            <Text className="text-gray-400 text-xs">Max file size: 5MB</Text>
                        </TouchableOpacity>

                        {tier === 3 && (
                            <TouchableOpacity className="border-2 border-dashed border-gray-300 rounded-xl p-8 items-center justify-center mb-8 bg-gray-50">
                                <Ionicons name="document-text-outline" size={32} color="#6B7280" />
                                <Text className="text-gray-500 mt-2 font-medium">Click to Upload Utility Bill</Text>
                            </TouchableOpacity>
                        )}

                        <TextInput
                            placeholder="Enter BVN / NIN"
                            className="border border-gray-300 rounded-xl px-4 h-14 bg-white mb-8"
                            keyboardType="number-pad"
                        />

                        <TouchableOpacity
                            className="bg-primary h-14 rounded-full items-center justify-center"
                            onPress={() => router.back()}
                        >
                            <Text className="text-white font-bold text-lg">Submit for Verification</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
