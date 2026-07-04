import { View, Text, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function InvestmentsScreen() {
    const investmentOptions = [
        { id: '1', title: 'US Stocks', description: 'Invest in Apple, Tesla, etc.', returns: '15-25% p.a', icon: 'logo-apple', color: '#000000' },
        { id: '2', title: 'Mutual Funds', description: 'Diversified portfolio of assets.', returns: '10-15% p.a', icon: 'stats-chart', color: '#0056D2' },
        { id: '3', title: 'Fixed Deposits', description: 'Low risk, guaranteed returns.', returns: '8-12% p.a', icon: 'lock-closed', color: '#107C10' },
        { id: '4', title: 'Real Estate', description: 'Invest in prime properties.', returns: '20-30% p.a', icon: 'business', color: '#8B5CF6' },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Investments', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                {/* Portfolio Card */}
                <View className="bg-slate-900 p-6 rounded-2xl mb-8 shadow-sm">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-slate-400 text-sm font-medium">Portfolio Value</Text>
                        <Ionicons name="trending-up" size={24} color="#107C10" />
                    </View>
                    <Text className="text-white text-3xl font-bold tracking-tight">₦1,250,000.00</Text>
                    <View className="flex-row items-center mt-2">
                        <Text className="text-green-400 font-bold text-xs">+ ₦45,000 (3.6%)</Text>
                        <Text className="text-slate-500 text-[10px] ml-2 font-medium uppercase tracking-wider">all time</Text>
                    </View>
                </View>

                {/* Categories */}
                <Text className="text-slate font-bold text-lg mb-4">Investment Opportunities</Text>
                {investmentOptions.map((option) => (
                    <TouchableOpacity key={option.id} className="bg-white p-5 rounded-xl mb-4 flex-row items-center border border-gray-100 shadow-sm">
                        <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: option.color + '15' }}>
                            <Ionicons name={option.icon as any} size={24} color={option.color} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-slate text-base">{option.title}</Text>
                            <Text className="text-gray-500 text-xs mt-0.5">{option.description}</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-green-600 font-bold text-sm">{option.returns}</Text>
                            <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-tighter">EST. RETURNS</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                <View className="bg-blue-50 p-5 rounded-2xl mt-4 mb-10 border border-blue-100 flex-row items-center">
                    <Ionicons name="bulb-outline" size={24} color="#0056D2" className="mr-3" />
                    <Text className="text-gray-600 text-xs flex-1 ml-3 leading-5">
                        Diversifying your investments into US Stocks and Mutual Funds can help beat inflation over the long term.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
