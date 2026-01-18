import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

// Define User Interface matching our Schema
interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    balance: number;
}

export default function UserManagement() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    const handleSearch = async (text: string) => {
        setSearch(text);
        if (text.length === 0) {
            fetchUsers();
            return;
        }

        // Simple search by name or email
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`full_name.ilike.%${text}%,email.ilike.%${text}%`);

        if (!error && data) {
            setUsers(data);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'User Management' }} />

            <View className="p-4">
                {/* Stats Header */}
                <View className="flex-row gap-4 mb-6">
                    <View className="flex-1 bg-indigo-600 p-4 rounded-xl shadow-sm">
                        <Text className="text-white text-xs font-bold uppercase opacity-80 mb-1">Total Users</Text>
                        <Text className="text-white text-2xl font-black">{users.length}</Text>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <Text className="text-slate-500 text-xs font-bold uppercase mb-1">Active</Text>
                        <Text className="text-slate-800 text-2xl font-black">{users.filter(u => u.status === 'active').length}</Text>
                    </View>
                </View>

                {/* Search */}
                <View className="bg-white p-3 rounded-xl border border-slate-200 flex-row items-center mb-4">
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        placeholder="Search users..."
                        placeholderTextColor="#94A3B8"
                        className="flex-1 ml-2 font-medium"
                        value={search}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {/* User List */}
            <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity className="bg-white p-4 rounded-xl border border-slate-100 flex-row items-center justify-between mb-3 shadow-sm">
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 bg-indigo-50 rounded-full items-center justify-center">
                                <Text className="text-indigo-600 font-bold text-lg">
                                    {item.full_name?.charAt(0).toUpperCase() || 'U'}
                                </Text>
                            </View>
                            <View>
                                <Text className="font-bold text-slate-800 text-base">{item.full_name || 'Unknown User'}</Text>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-xs text-slate-500">{item.email}</Text>
                                    <View className="bg-slate-100 px-1.5 py-0.5 rounded">
                                        <Text className="text-xs font-bold text-slate-600 capitalize">{item.role}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className="font-bold text-slate-800">₦{item.balance?.toLocaleString() || '0'}</Text>
                            <View className={`px-2 py-0.5 rounded-full ${item.status === 'active' ? 'bg-green-100' : 'bg-slate-100'}`}>
                                <Text className={`text-[10px] uppercase font-bold ${item.status === 'active' ? 'text-green-700' : 'text-slate-500'}`}>
                                    {item.status}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                className="flex-1"
                ListEmptyComponent={
                    <View className="items-center justify-center mt-10">
                        {loading ? (
                            <ActivityIndicator size="large" color="#4F46E5" />
                        ) : (
                            <Text className="text-slate-400 font-medium">No users found</Text>
                        )}
                    </View>
                }
            />
        </View>
    );
}
