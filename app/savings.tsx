import { View, Text, TouchableOpacity, ScrollView, FlatList, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function SavingsScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'plans' | 'create'>('plans');

    // Mock active plans
    const plans = [
        { id: '1', title: 'New Car Fund', target: '₦2,000,000', saved: '₦450,000', progress: 0.22, color: '#0056D2' },
        { id: '2', title: 'Rent 2026', target: '₦800,000', saved: '₦100,000', progress: 0.12, color: '#107C10' },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Savings', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <View className="flex-row p-4 bg-white border-b border-gray-100">
                <TouchableOpacity
                    className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'plans' ? 'border-primary' : 'border-transparent'}`}
                    onPress={() => setActiveTab('plans')}
                >
                    <Text className={`font-bold ${activeTab === 'plans' ? 'text-primary' : 'text-gray-400'}`}>My Plans</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'create' ? 'border-primary' : 'border-transparent'}`}
                    onPress={() => setActiveTab('create')}
                >
                    <Text className={`font-bold ${activeTab === 'create' ? 'text-primary' : 'text-gray-400'}`}>Create New</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'plans' ? (
                <View className="flex-1 p-6">
                    <View className="bg-primary p-6 rounded-3xl mb-8 shadow-lg shadow-blue-900/20 overflow-hidden relative">
                        {/* Decorative circles */}
                        <View className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                        <View className="absolute bottom-10 -left-10 w-20 h-20 bg-white/10 rounded-full" />

                        <View className="flex-row items-center mb-2">
                            <Ionicons name="wallet-outline" size={20} color="#BFDBFE" />
                            <Text className="text-blue-100 text-sm font-medium ml-2">Total Savings Balance</Text>
                        </View>
                        <Text className="text-white text-4xl font-extrabold tracking-tight mb-4">₦550,000.00</Text>
                        <View className="flex-row items-center bg-white/20 self-start px-3 py-1 rounded-full">
                            <Ionicons name="trending-up" size={16} color="#86EFAC" />
                            <Text className="text-green-300 text-xs font-bold ml-1">+ ₦1,250 interest earned</Text>
                        </View>
                    </View>

                    <Text className="text-slate font-bold mb-4 text-lg">Active Plans</Text>
                    {plans.map((plan) => (
                        <TouchableOpacity key={plan.id} className="bg-white p-5 rounded-2xl mb-4 border border-gray-100 shadow-sm flex-row items-center">
                            <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: plan.color + '15' }}>
                                <Ionicons name={plan.id === '1' ? 'car' : 'home'} size={24} color={plan.color} />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row justify-between items-center mb-1">
                                    <Text className="font-bold text-slate text-base">{plan.title}</Text>
                                    <Text className="font-bold text-base" style={{ color: plan.color }}>{plan.saved}</Text>
                                </View>
                                <View className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                                    <View className="h-full rounded-full" style={{ width: `${plan.progress * 100}%`, backgroundColor: plan.color }} />
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-xs text-gray-400 font-medium">{Math.round(plan.progress * 100)}% Achieved</Text>
                                    <Text className="text-xs text-gray-500 font-medium">Target: {plan.target}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        className="flex-row items-center justify-center p-4 bg-white border border-dashed border-gray-300 rounded-xl mt-4"
                        onPress={() => setActiveTab('create')}
                    >
                        <Ionicons name="add" size={24} color="#6B7280" />
                        <Text className="text-gray-500 font-bold ml-2">Create New Savings Plan</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView className="flex-1 p-6">
                    <Text className="text-2xl font-bold text-slate mb-2">Create a Target</Text>
                    <Text className="text-gray-500 mb-8">Save towards a specific goal automatically.</Text>

                    <Text className="text-slate font-bold mb-2">Goal Title</Text>
                    <TextInput
                        placeholder="e.g. New Laptop"
                        className="bg-white border border-gray-200 p-4 rounded-xl mb-6 text-slate"
                    />

                    <Text className="text-slate font-bold mb-2">Target Amount</Text>
                    <TextInput
                        placeholder="₦0.00"
                        keyboardType="numeric"
                        className="bg-white border border-gray-200 p-4 rounded-xl mb-6 text-slate"
                    />

                    <Text className="text-slate font-bold mb-2">Frequency</Text>
                    <View className="flex-row gap-4 mb-8">
                        {['Daily', 'Weekly', 'Monthly'].map((freq) => (
                            <TouchableOpacity key={freq} className="bg-white px-6 py-3 rounded-xl border border-gray-200">
                                <Text className="text-slate">{freq}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        className="bg-primary h-14 rounded-full items-center justify-center"
                        onPress={() => {
                            setActiveTab('plans');
                            // Logic to save would go here
                        }}
                    >
                        <Text className="text-white font-bold text-lg">Create Plan</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}
