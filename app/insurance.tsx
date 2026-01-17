import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function InsuranceScreen() {
    const policies = [
        { id: '1', title: 'Health Insurance', price: 'from ₦2,500/mo', description: 'Comprehensive coverage for you and your family.', icon: 'medical', color: '#EF4444' },
        { id: '2', title: 'Auto Insurance', price: 'from ₦5,000/yr', description: 'Protect your vehicle against accidents and theft.', icon: 'car', color: '#3B82F6' },
        { id: '3', title: 'Life Insurance', price: 'from ₦1,000/mo', description: 'Secure the future for your loved ones.', icon: 'heart', color: '#EC4899' },
        { id: '4', title: 'Travel Insurance', price: 'from ₦3,500/trip', description: 'Coverage for flight delays and medical emergencies abroad.', icon: 'airplane', color: '#8B5CF6' },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Insurance', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                {/* Promo Card */}
                <View className="bg-indigo-600 p-6 rounded-2xl mb-8 relative overflow-hidden">
                    <View className="absolute right-[-20] top-[-20] bg-white opacity-10 w-40 h-40 rounded-full" />
                    <Text className="text-white text-2xl font-bold mb-2">Stay Protected</Text>
                    <Text className="text-indigo-100 leading-5">Secure your assets and health with affordable insurance plans.</Text>
                    <TouchableOpacity className="bg-white px-5 py-2.5 rounded-lg self-start mt-6">
                        <Text className="text-indigo-600 font-bold text-sm">Get a Quote</Text>
                    </TouchableOpacity>
                </View>

                {/* Policies List */}
                <Text className="text-slate font-bold text-lg mb-4">Insurance Marketplace</Text>
                {policies.map((policy) => (
                    <TouchableOpacity key={policy.id} className="bg-white p-5 rounded-xl mb-4 flex-row items-center border border-gray-50 shadow-sm">
                        <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: policy.color + '15' }}>
                            <Ionicons name={policy.icon as any} size={24} color={policy.color} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-slate text-base">{policy.title}</Text>
                            <Text className="text-gray-500 text-xs mt-1 leading-4">{policy.description}</Text>
                            <Text className="text-primary font-bold text-xs mt-2">{policy.price}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                ))}

                <View className="mt-6 mb-12 p-5 bg-white rounded-xl border border-gray-100 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                            <Ionicons name="document-text" size={20} color="#F37021" />
                        </View>
                        <View>
                            <Text className="font-bold text-slate text-sm">My Policies</Text>
                            <Text className="text-gray-500 text-[10px]">You have 0 active policies</Text>
                        </View>
                    </View>
                    <TouchableOpacity className="bg-gray-100 px-4 py-1.5 rounded-full">
                        <Text className="text-gray-600 font-bold text-[10px] uppercase">Review</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
