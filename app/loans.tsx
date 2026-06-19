import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function LoansScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Quick Loans', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="items-center py-6">
                    <View className="w-24 h-24 bg-purple-50 rounded-full items-center justify-center mb-6">
                        <Ionicons name="cash" size={48} color="#8B5CF6" />
                    </View>
                    <Text className="text-2xl font-bold text-slate text-center mb-2">Instant Cash Loans</Text>
                    <Text className="text-gray-500 text-center mb-8 px-4">
                        Get up to ₦100,000 instantly with no collateral. Repay flexibly over 4 months.
                    </Text>

                    <View className="bg-purple-50 w-full p-6 rounded-2xl mb-8 border border-purple-100">
                        <Text className="text-purple-900 font-bold mb-4">Your Usage Limit</Text>
                        <View className="flex-row items-baseline mb-2">
                            <Text className="text-purple-700 text-3xl font-bold mr-1">₦</Text>
                            <Text className="text-purple-700 text-5xl font-bold tracking-tight">50,000</Text>
                        </View>
                        <Text className="text-purple-500 text-xs">Based on your transaction history</Text>
                    </View>

                    <TouchableOpacity
                        className="w-full bg-purple-600 h-16 rounded-2xl items-center justify-center shadow-lg shadow-purple-200 mb-6"
                        onPress={() => router.push('/success?amount=₦50,000&type=Loan Application')}
                    >
                        <Text className="text-white font-bold text-xl">Apply Now</Text>
                    </TouchableOpacity>

                    <View className="w-full">
                        <Text className="font-bold text-slate mb-4">Why use our loans?</Text>

                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center mr-4">
                                <Ionicons name="flash" size={20} color="#107C10" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate">Instant Disbursement</Text>
                                <Text className="text-gray-500 text-sm">Money in your wallet in 5 mins.</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-4">
                                <Ionicons name="calendar" size={20} color="#0056D2" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate">Flexible Repayment</Text>
                                <Text className="text-gray-500 text-sm">Choose between 14 to 60 days.</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center mr-4">
                                <Ionicons name="shield-checkmark" size={20} color="#D97706" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate">No Collateral</Text>
                                <Text className="text-gray-500 text-sm">No paperwork or guarantor needed.</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
