import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function BeneficiariesScreen() {
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBeneficiaries();
    }, []);

    const fetchBeneficiaries = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('beneficiaries')
                .select('*')
                .eq('user_id', user.id);

            if (data) setBeneficiaries(data);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        Alert.alert("Delete Beneficiary", `Are you sure you want to remove ${name}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('beneficiaries').delete().eq('id', id);
                    if (!error) {
                        setBeneficiaries(prev => prev.filter(b => b.id !== id));
                    }
                }
            }
        ]);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Beneficiaries', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <FlatList
                data={beneficiaries}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                onRefresh={fetchBeneficiaries}
                refreshing={loading}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-4">
                                <Text className="text-primary font-bold text-lg">{item.name.charAt(0)}</Text>
                            </View>
                            <View>
                                <Text className="font-bold text-slate text-base">{item.name}</Text>
                                <Text className="text-gray-500 text-sm">{item.bank_name || 'Bank'} - {item.account_number}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} className="p-2">
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={!loading ? (
                    <View className="items-center justify-center pt-20">
                        <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                        <Text className="text-gray-400 mt-4 font-medium">No beneficiaries saved yet</Text>
                    </View>
                ) : null}
                ListFooterComponent={
                    <TouchableOpacity className="flex-row items-center justify-center p-4 bg-white border border-dashed border-gray-300 rounded-xl mt-4">
                        <Ionicons name="add" size={24} color="#6B7280" />
                        <Text className="text-gray-500 font-bold ml-2">Add New Beneficiary</Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );
}
