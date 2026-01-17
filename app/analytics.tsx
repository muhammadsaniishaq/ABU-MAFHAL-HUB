import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AnalyticsScreen() {
    const spendingData = [
        { category: 'Airtime & Data', amount: '₦15,000', percent: 0.45, color: '#F37021' },
        { category: 'Transfers', amount: '₦10,000', percent: 0.30, color: '#0056D2' },
        { category: 'Bills', amount: '₦5,000', percent: 0.15, color: '#D97706' },
        { category: 'Shopping', amount: '₦3,200', percent: 0.10, color: '#8B5CF6' },
    ];

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Insights', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="items-center mb-8">
                    <Text className="text-gray-500 mb-1">Total Spent (Jan)</Text>
                    <Text className="text-slate text-3xl font-bold">₦33,200.00</Text>
                </View>

                {/* Mock Chart Visualization */}
                <View className="h-4 bg-gray-100 rounded-full flex-row overflow-hidden mb-8 w-full">
                    {spendingData.map((item, index) => (
                        <View
                            key={index}
                            style={{ width: `${item.percent * 100}%`, backgroundColor: item.color }}
                            className="h-full"
                        />
                    ))}
                </View>

                {/* Breakdown */}
                <Text className="font-bold text-slate text-lg mb-4">Category Breakdown</Text>
                {spendingData.map((item, index) => (
                    <View key={index} className="flex-row items-center justify-between py-4 border-b border-gray-50">
                        <View className="flex-row items-center">
                            <View className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }} />
                            <Text className="text-gray-700 font-medium">{item.category}</Text>
                        </View>
                        <View className="items-end">
                            <Text className="font-bold text-slate">{item.amount}</Text>
                            <Text className="text-gray-400 text-xs">{(item.percent * 100).toFixed(0)}%</Text>
                        </View>
                    </View>
                ))}

                <View className="bg-blue-50 p-6 rounded-2xl mt-8">
                    <View className="flex-row gap-3 mb-2">
                        <Ionicons name="information-circle" size={24} color="#0056D2" />
                        <Text className="text-primary font-bold text-lg">Spending Tip</Text>
                    </View>
                    <Text className="text-gray-600 leading-6">
                        You spent 15% more on Airtime this month compared to last month. Consider getting a monthly data plan to save more.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
