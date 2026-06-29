import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function NINHistoryScreen() {
    const router = useRouter();
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('recent_nin_verifications');
            if (stored) {
                setHistoryList(JSON.parse(stored));
            } else {
                setHistoryList([]);
            }
        } catch (e) {
            console.warn('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    // Load history when screen gets focus
    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [])
    );

    const deleteHistoryItem = async (itemId: string, name: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to delete ${name || 'this record'} from history?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updated = historyList.filter(item => item.id !== itemId);
                            setHistoryList(updated);
                            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete record');
                        }
                    }
                }
            ]
        );
    };

    const clearAllHistory = async () => {
        Alert.alert(
            'Clear All History',
            'Are you sure you want to permanently clear all verification history? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem('recent_nin_verifications');
                            setHistoryList([]);
                        } catch (e) {
                            Alert.alert('Error', 'Failed to clear history');
                        }
                    }
                }
            ]
        );
    };

    const filteredList = historyList.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
            item.name.toLowerCase().includes(query) ||
            item.nin.includes(query) ||
            item.layout.toLowerCase().includes(query)
        );
    });

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen 
                options={{ 
                    title: 'NIN History', 
                    headerStyle: { backgroundColor: '#050B14' }, 
                    headerTintColor: '#fff', 
                    headerShadowVisible: false,
                    headerRight: () => historyList.length > 0 ? (
                        <TouchableOpacity onPress={clearAllHistory} className="mr-2">
                            <Ionicons name="trash-bin-outline" size={20} color="#ff4d4d" />
                        </TouchableOpacity>
                    ) : null
                }} 
            />
            <StatusBar style="light" />

            <LinearGradient colors={['#050B14', '#0B163A']} className="pt-2 pb-10 px-4 rounded-b-[24px]">
                <Text className="text-white text-xl font-black tracking-tight">Reprint Center</Text>
                <Text className="text-slate-300 text-xs font-medium opacity-90 mt-0.5">Access past NIN prints and download them instantly for free.</Text>
            </LinearGradient>

            <View className="flex-1 px-3 -mt-6">
                {/* Search Bar */}
                <View className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex-row items-center mb-4">
                    <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search by Name, NIN or Slip Type..."
                        placeholderTextColor="#94a3b8"
                        className="flex-1 text-slate-800 font-bold text-xs"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#cbd5e1" />
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <ActivityIndicator size="large" color="#0B163A" />
                    </View>
                ) : filteredList.length === 0 ? (
                    <View className="flex-1 bg-white rounded-2xl items-center justify-center p-6 shadow-sm border border-slate-100 py-16">
                        <View className="bg-slate-50 w-16 h-16 rounded-full items-center justify-center mb-4 border border-slate-100">
                            <Ionicons name="receipt-outline" size={32} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-800 font-black text-sm mb-1 text-center">No Records Found</Text>
                        <Text className="text-slate-400 text-xs text-center leading-4 max-w-[240px]">
                            {searchQuery.length > 0 
                                ? "No past verifications match your search query." 
                                : "You haven't verified any NIN yet. Verified slips will appear here for free reprints."}
                        </Text>
                        {searchQuery.length === 0 && (
                            <TouchableOpacity 
                                onPress={() => router.push('/nin-services/verify-nin')} 
                                className="bg-[#0B163A] px-6 h-11 rounded-xl items-center justify-center mt-6 flex-row"
                            >
                                <Ionicons name="add-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text className="text-white font-bold text-xs">Verify New NIN</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
                        <View className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                            <View className="divide-y divide-slate-100">
                                {filteredList.map((item) => (
                                    <View key={item.id} className="flex-row items-center justify-between py-3">
                                        <TouchableOpacity 
                                            onPress={() => {
                                                router.push({
                                                    pathname: '/nin-services/verify-nin',
                                                    params: { reprintId: item.id }
                                                });
                                            }}
                                            className="flex-1 flex-row items-center mr-2"
                                        >
                                            <View className="bg-slate-50 w-10 h-10 rounded-xl items-center justify-center mr-3 border border-slate-100">
                                                <Ionicons name="document-text" size={20} color="#0B163A" />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-slate-800 font-black text-xs uppercase" numberOfLines={1}>{item.name}</Text>
                                                <Text className="text-slate-400 font-bold text-[10px] mt-0.5">
                                                    NIN: {item.nin} • <Text className="text-[#D97706] uppercase">{item.layout}</Text>
                                                </Text>
                                            </View>
                                        </TouchableOpacity>

                                        <View className="flex-row items-center">
                                            <View className="items-end mr-3">
                                                <Text className="text-slate-400 font-bold text-[9px]">{item.date.split(',')[0]}</Text>
                                                <Text className="text-slate-300 font-bold text-[8px] mt-0.5">{item.date.split(',')[1]?.trim()}</Text>
                                            </View>
                                            <TouchableOpacity 
                                                onPress={() => deleteHistoryItem(item.id, item.name)}
                                                className="p-2 rounded-lg bg-red-50"
                                            >
                                                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
