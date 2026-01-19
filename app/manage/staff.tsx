import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function StaffManager() {
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['admin', 'super_admin'])
                .order('full_name', { ascending: true });

            if (error) throw error;
            setStaff(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Staff & HR' }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-slate-800">Team Roster</Text>
                    <TouchableOpacity className="bg-slate-900 px-4 py-2 rounded-lg flex-row items-center gap-2">
                        <Ionicons name="person-add" size={16} color="white" />
                        <Text className="text-white font-bold text-xs">Invite Member</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0F172A" />
                ) : (
                    <ScrollView className="mb-8">
                        {staff.map((member, i) => (
                            <View key={member.id} className="flex-row items-center justify-between py-4 border-b border-gray-100">
                                <View className="flex-row items-center gap-4">
                                    <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
                                        <Text className="font-bold text-slate-600">
                                            {member.full_name?.[0] || 'A'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text className="font-bold text-slate-800 text-base">{member.full_name || 'Admin'}</Text>
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-slate-500 text-xs capitalize">{member.role}</Text>
                                            <View className={`px-1.5 py-0.5 rounded ${member.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                                                <Text className={`text-[10px] font-bold ${member.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                                                    {member.status === 'active' ? 'Online' : 'Offline'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity>
                                    <Ionicons name="settings-outline" size={20} color="#CBD5E1" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Shift Schedule (Today)</Text>
                <View className="flex-row gap-4">
                    <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <Text className="text-blue-800 font-bold mb-1">Morning Shift</Text>
                        <Text className="text-blue-500 text-xs">08:00 - 16:00</Text>
                        <View className="flex-row mt-3">
                            <View className="w-6 h-6 rounded-full bg-blue-200 border-2 border-white" />
                            <View className="w-6 h-6 rounded-full bg-blue-300 border-2 border-white -ml-2" />
                        </View>
                    </View>
                    <View className="flex-1 bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <Text className="text-purple-800 font-bold mb-1">Evening Shift</Text>
                        <Text className="text-purple-500 text-xs">16:00 - 00:00</Text>
                        <View className="flex-row mt-3">
                            <View className="w-6 h-6 rounded-full bg-purple-200 border-2 border-white" />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
