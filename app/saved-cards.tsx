import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function SavedCardsScreen() {
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullName, setFullName] = useState('User');

    useEffect(() => {
        fetchCards();
    }, []);

    const fetchCards = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            if (profile) setFullName(profile.full_name || 'User');

            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .eq('user_id', user.id)
                .eq('type', 'card');

            if (data) setCards(data);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert("Remove Card", "Are you sure you want to remove this card?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
                    if (!error) {
                        setCards(prev => prev.filter(c => c.id !== id));
                    }
                }
            }
        ]);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Saved Cards', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <FlatList
                data={cards}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 24 }}
                onRefresh={fetchCards}
                refreshing={loading}
                renderItem={({ item }) => (
                    <View className="bg-primary p-6 rounded-2xl mb-4 shadow-sm relative overflow-hidden">
                        {/* decorative shapes */}
                        <View className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                        <View className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

                        <View className="flex-row justify-between items-start mb-8">
                            <Text className="text-white font-bold text-lg italic">{item.provider || 'Card'}</Text>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                <Ionicons name="trash-outline" size={20} color="white" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-white text-2xl font-bold tracking-widest mb-4">
                            **** **** **** {item.last_four}
                        </Text>

                        <View className="flex-row justify-between">
                            <Text className="text-blue-200 text-xs">Card Holder</Text>
                            <Text className="text-blue-200 text-xs">Expires</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-white font-bold uppercase">{fullName}</Text>
                            <Text className="text-white font-bold">{item.expiry_month}/{item.expiry_year.toString().slice(-2)}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={!loading ? (
                    <View className="items-center justify-center pt-20">
                        <Ionicons name="card-outline" size={48} color="#CBD5E1" />
                        <Text className="text-gray-400 mt-4 font-medium">No saved cards found</Text>
                    </View>
                ) : null}
                ListFooterComponent={
                    <TouchableOpacity className="flex-row items-center justify-center p-4 bg-white border border-dashed border-gray-300 rounded-xl mt-4">
                        <Ionicons name="add" size={24} color="#6B7280" />
                        <Text className="text-gray-500 font-bold ml-2">Add New Card</Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );
}
