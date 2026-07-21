import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';

type Ticket = {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
};

export default function UserTicketsScreen() {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) setTickets(data as any);
        } finally {
            setLoading(false);
        }
    };

    const createNewTicket = async () => {
        setIsCreating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('tickets')
                .insert({
                    user_id: user.id,
                    subject: 'New Support Ticket',
                    status: 'open',
                    priority: 'normal'
                })
                .select()
                .single();

            if (data && !error) {
                router.push(`/tickets/${data.id}`);
            } else if (error) {
                console.error("Ticket Insert Error:", error);
                alert("Failed to create ticket: " + error.message);
            }
        } catch (e: any) {
            console.log(e);
            alert("Error: " + e.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ 
                title: 'My Support Tickets',
                headerShown: true,
                headerStyle: { backgroundColor: '#0d1b3e' },
                headerTintColor: '#fff',
                headerRight: () => (
                    <TouchableOpacity onPress={createNewTicket} disabled={isCreating} className="mr-2">
                        {isCreating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="add-circle-outline" size={26} color="#fff" />}
                    </TouchableOpacity>
                )
            }} />
            
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#0d1b3e" />
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center pt-20">
                            <Ionicons name="ticket-outline" size={48} color="#CBD5E1" />
                            <Text className="text-gray-400 mt-4 text-center">No support tickets found.</Text>
                            <TouchableOpacity 
                                onPress={createNewTicket}
                                disabled={isCreating}
                                className="mt-4 bg-[#0d1b3e] px-4 py-2 rounded-lg flex-row items-center"
                            >
                                {isCreating ? <ActivityIndicator color="#fff" size="small" className="mr-2" /> : <Ionicons name="add" size={18} color="#fff" className="mr-1" />}
                                <Text className="text-white font-bold">Create New Ticket</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => router.push(`/tickets/${item.id}`)}
                            className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-slate-100"
                        >
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-slate-800 font-bold text-sm flex-1 mr-2" numberOfLines={1}>{item.subject}</Text>
                                <Text className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>

                            <View className="flex-row items-center justify-between">
                                <View className={`px-2 py-1 rounded text-[10px] ${
                                    item.status === 'open' ? 'bg-red-100' :
                                    item.status === 'in_progress' ? 'bg-blue-100' : 'bg-green-100'
                                }`}>
                                    <Text className={`text-[10px] font-bold ${
                                        item.status === 'open' ? 'text-red-700' :
                                        item.status === 'in_progress' ? 'text-blue-700' : 'text-green-700'
                                    }`}>{item.status.toUpperCase()}</Text>
                                </View>
                                <Text className="text-[10px] text-gray-400 font-mono">ID: {item.id.split('-')[0]}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}
