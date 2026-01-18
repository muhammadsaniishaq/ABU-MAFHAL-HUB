import { View, Text, FlatList, TouchableOpacity, Image, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

// Mock Banners
const initialBanners = [
    { id: '1', title: 'Welcome Promo', status: true, image: 'https://via.placeholder.com/300x150/3B82F6/ffffff?text=Promo+1', clicks: 1205 },
    { id: '2', title: 'Weekend Sale', status: false, image: 'https://via.placeholder.com/300x150/10B981/ffffff?text=Promo+2', clicks: 850 },
    { id: '3', title: 'Crypto Alert', status: true, image: 'https://via.placeholder.com/300x150/F59E0B/ffffff?text=Promo+3', clicks: 3400 },
];

export default function ContentManager() {
    const [banners, setBanners] = useState(initialBanners);

    const toggleSwitch = (id: string) => {
        setBanners(prev => prev.map(b =>
            b.id === id ? { ...b, status: !b.status } : b
        ));
    };

    return (
        <View className="flex-1 bg-slate-50 p-4">
            <Stack.Screen options={{ title: 'CMS Manager' }} />

            <View className="bg-indigo-600 rounded-3xl p-6 mb-6 shadow-xl shadow-indigo-500/30">
                <View className="flex-row justify-between items-start mb-4">
                    <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center backdrop-blur-md">
                        <Ionicons name="images" size={24} color="white" />
                    </View>
                    <TouchableOpacity className="bg-white px-4 py-2 rounded-xl flex-row items-center">
                        <Ionicons name="add" size={18} color="#4F46E5" />
                        <Text className="text-indigo-600 font-bold ml-1">New Banner</Text>
                    </TouchableOpacity>
                </View>
                <Text className="text-white text-2xl font-black mb-1">Active Banners</Text>
                <Text className="text-indigo-200 font-medium">Manage home screen promotions</Text>
            </View>

            <Text className="text-slate-400 font-bold uppercase text-xs mb-3 ml-1">Current Campaigns</Text>

            <FlatList
                data={banners}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-2xl mb-4 border border-gray-100 shadow-sm">
                        <View className="h-32 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                            {/* Placeholder for actual image */}
                            <View className="absolute inset-0 items-center justify-center">
                                <Ionicons name="image-outline" size={48} color="#CBD5E1" />
                            </View>
                            <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm">
                                <Text className="text-white text-[10px] font-bold">{item.clicks} Clicks</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center justify-between">
                            <View>
                                <Text className="font-bold text-slate-800 text-lg">{item.title}</Text>
                                <Text className={`text-xs font-bold ${item.status ? 'text-green-600' : 'text-gray-400'}`}>
                                    {item.status ? '● LIVE' : '○ DISABLED'}
                                </Text>
                            </View>
                            <Switch
                                value={item.status}
                                onValueChange={() => toggleSwitch(item.id)}
                                trackColor={{ false: '#E2E8F0', true: '#4F46E5' }}
                                thumbColor={'white'}
                            />
                        </View>

                        <View className="flex-row gap-2 mt-4 pt-4 border-t border-gray-50">
                            <TouchableOpacity className="flex-1 bg-gray-50 py-2 rounded-lg items-center border border-gray-100">
                                <Text className="text-slate-600 font-bold text-xs">Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-1 bg-red-50 py-2 rounded-lg items-center border border-red-100">
                                <Text className="text-red-600 font-bold text-xs">Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}
