import { View, Text, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function RewardsScreen() {
    const missions = [
        { id: '1', title: 'Daily Login', points: '10 pts', status: 'Claimed', icon: 'calendar', color: '#3B82F6' },
        { id: '2', title: 'Fund Wallet min ₦5000', points: '50 pts', status: 'In Progress', icon: 'wallet', color: '#107C10' },
        { id: '3', title: 'Refer a Friend', points: '100 pts', status: 'In Progress', icon: 'people', color: '#8B5CF6' },
        { id: '4', title: 'Pay 3 Bills this month', points: '200 pts', status: 'In Progress', icon: 'flash', color: '#D97706' },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Rewards', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                {/* Points Summary Card */}
                <View className="bg-primary p-6 rounded-2xl mb-8 shadow-sm">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-blue-200 text-sm font-medium">My Reward Points</Text>
                        <Ionicons name="gift" size={24} color="#D1FAE5" />
                    </View>
                    <Text className="text-white text-4xl font-bold tracking-tight">1,250 <Text className="text-xl font-normal text-blue-100">pts</Text></Text>
                    <TouchableOpacity className="bg-white/20 mt-4 py-2 rounded-lg items-center">
                        <Text className="text-white font-bold text-sm">Convert to Cash</Text>
                    </TouchableOpacity>
                </View>

                {/* Cashback Balance */}
                <View className="bg-white p-4 rounded-xl flex-row justify-between items-center mb-8 border border-gray-100">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
                            <Ionicons name="cash" size={20} color="#107C10" />
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs">Cashback Balance</Text>
                            <Text className="text-slate font-bold text-lg">₦450.00</Text>
                        </View>
                    </View>
                    <TouchableOpacity className="bg-success/10 px-4 py-1.5 rounded-full">
                        <Text className="text-success font-bold text-xs">Redeem</Text>
                    </TouchableOpacity>
                </View>

                {/* Active Missions */}
                <Text className="text-slate font-bold text-lg mb-4">Active Missions</Text>
                {missions.map((mission) => (
                    <View key={mission.id} className="bg-white p-4 rounded-xl mb-3 flex-row items-center justify-between border border-gray-100 shadow-sm">
                        <View className="flex-row items-center flex-1">
                            <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: mission.color + '20' }}>
                                <Ionicons name={mission.icon as any} size={20} color={mission.color} />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate text-base">{mission.title}</Text>
                                <Text className="text-gray-500 text-xs">{mission.points}</Text>
                            </View>
                        </View>
                        <View className={`px-3 py-1 rounded-full ${mission.status === 'Claimed' ? 'bg-gray-100' : 'bg-blue-50'}`}>
                            <Text className={`font-bold text-xs ${mission.status === 'Claimed' ? 'text-gray-400' : 'text-primary'}`}>
                                {mission.status}
                            </Text>
                        </View>
                    </View>
                ))}

                <View className="bg-gray-100 p-6 rounded-2xl mt-8 mb-12 items-center">
                    <Ionicons name="information-circle-outline" size={32} color="#6B7280" />
                    <Text className="text-gray-500 text-center text-sm mt-3 px-4">
                        Points are earned on every data purchase, bill payment, and referral. Convert points to wallet cash anytime!
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
