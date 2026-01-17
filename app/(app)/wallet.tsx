import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function WalletScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="pt-12 px-6 pb-4 bg-white border-b border-gray-200 mb-6">
                <Text className="text-2xl font-bold text-slate">Wallet</Text>
            </View>

            <ScrollView className="px-6">
                {/* Balance Card */}
                <View className="bg-primary rounded-2xl p-6 mb-8 shadow-sm">
                    <Text className="text-blue-100 text-sm font-medium mb-2">Total Balance</Text>
                    <View className="flex-row items-baseline mb-6">
                        <Text className="text-white text-3xl font-bold mr-2">₦</Text>
                        <Text className="text-white text-4xl font-bold tracking-tight">50,200.00</Text>
                    </View>
                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
                            onPress={() => router.push('/fund-wallet')}
                        >
                            <Ionicons name="add-circle" size={20} color="white" />
                            <Text className="text-white font-bold ml-2">Fund</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-white/20 py-3 rounded-xl flex-row items-center justify-center"
                            onPress={() => router.push('/transfer')}
                        >
                            <Ionicons name="arrow-up-circle" size={20} color="white" />
                            <Text className="text-white font-bold ml-2">Withdraw</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Account Details */}
                <View className="bg-white p-5 rounded-xl mb-6 shadow-sm border border-gray-100">
                    <Text className="text-slate font-bold mb-4 flex-row items-center">
                        <Ionicons name="card-outline" size={18} color="#0056D2" />
                        <Text className="ml-2"> Dedicated Account Numbers</Text>
                    </Text>

                    <View className="mb-4 pb-4 border-b border-gray-100">
                        <Text className="text-gray-500 text-xs mb-1">Monnify (Wema Bank)</Text>
                        <View className="flex-row justify-between items-center">
                            <Text className="text-xl font-bold text-slate">803 000 0000</Text>
                            <TouchableOpacity>
                                <Ionicons name="copy-outline" size={20} color="#0056D2" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-500 text-xs mb-1">Monnify (Sterling Bank)</Text>
                        <View className="flex-row justify-between items-center">
                            <Text className="text-xl font-bold text-slate">803 111 2222</Text>
                            <TouchableOpacity>
                                <Ionicons name="copy-outline" size={20} color="#0056D2" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Stats */}
                <View className="flex-row gap-4">
                    <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <Ionicons name="arrow-down" size={24} color="#107C10" />
                        <Text className="text-gray-500 text-xs mt-2">Total In</Text>
                        <Text className="text-slate font-bold text-lg">₦150k</Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <Ionicons name="arrow-up" size={24} color="#EF4444" />
                        <Text className="text-gray-500 text-xs mt-2">Total Out</Text>
                        <Text className="text-slate font-bold text-lg">₦99.8k</Text>
                    </View>
                </View>
            </ScrollView>
            <StatusBar style="dark" />
        </View>
    );
}
