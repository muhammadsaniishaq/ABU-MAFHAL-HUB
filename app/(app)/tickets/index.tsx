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
                    contentContainerStyle={{ padding: 12, paddingBottom: 150 }}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center pt-20">
                            <Ionicons name="ticket-outline" size={48} color="#CBD5E1" />
                            <Text className="text-slate-400 mt-4 text-center font-medium">No support tickets found.</Text>
                            <TouchableOpacity 
                                onPress={createNewTicket}
                                disabled={isCreating}
                                className="mt-6 bg-[#0A192F] px-5 py-2.5 rounded-xl flex-row items-center shadow-sm"
                            >
                                {isCreating ? <ActivityIndicator color="#D4AF37" size="small" className="mr-2" /> : <Ionicons name="add" size={18} color="#D4AF37" className="mr-2" />}
                                <Text className="text-[#D4AF37] font-bold text-sm">Create New Ticket</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => router.push(`/tickets/${item.id}`)}
                            className="bg-white p-3.5 rounded-xl mb-3 border border-slate-100"
                            style={{ shadowColor: '#0A192F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}
                        >
                            <View className="flex-row justify-between mb-3 items-center">
                                <Text className="text-slate-800 font-bold text-[13px] flex-1 mr-2" numberOfLines={1}>{item.subject}</Text>
                                <Text className="text-[10px] text-slate-400 font-medium">{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>

                            <View className="flex-row items-center justify-between">
                                <View className={`px-2.5 py-1 rounded-md ${
                                    item.status === 'open' ? 'bg-red-50 border border-red-100' :
                                    item.status === 'in_progress' ? 'bg-blue-50 border border-blue-100' : 'bg-emerald-50 border border-emerald-100'
                                }`}>
                                    <Text className={`text-[9px] font-extrabold ${
                                        item.status === 'open' ? 'text-red-600' :
                                        item.status === 'in_progress' ? 'text-blue-600' : 'text-emerald-600'
                                    }`}>{item.status.toUpperCase()}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <Ionicons name="finger-print" size={10} color="#94a3b8" className="mr-1" />
                                    <Text className="text-[10px] text-slate-400 font-medium">ID: {item.id.split('-')[0]}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}
