import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { supabase } from '../../services/supabase';
import { useEffect } from 'react';

type Ticket = {
    id: string;
    user_id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    profiles?: { full_name: string };
};

type TicketMessage = {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
};

export default function SupportTickets() {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [reply, setReply] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (selectedTicket) {
            fetchMessages(selectedTicket.id);
        }
    }, [selectedTicket]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false });
            if (data) setTickets(data as any);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (ticketId: string) => {
        const { data } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
        if (data) setMessages(data);
    };

    const sendMessage = async () => {
        if (!reply.trim() || !selectedTicket) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: selectedTicket.id,
                sender_id: user.id,
                message: reply.trim()
            });

        if (!error) {
            setReply('');
            fetchMessages(selectedTicket.id);
        }
    };

    const resolveTicket = async () => {
        if (!selectedTicket) return;
        const { error } = await supabase
            .from('tickets')
            .update({ status: 'resolved' })
            .eq('id', selectedTicket.id);
        if (!error) {
            setSelectedTicket(null);
            fetchTickets();
        }
    };


    const renderTicketList = () => (
        <View className="flex-1 bg-slate-50">
            <View className="p-4 bg-white border-b border-gray-100">
                <View className="flex-row gap-3 overflow-scroll">
                    {['All', 'Open', 'In Progress', 'Resolved'].map((filter, i) => (
                        <TouchableOpacity key={filter} className={`px-4 py-2 rounded-full border ${i === 0 ? 'bg-slate-900 border-slate-900' : 'bg-white border-gray-200'}`}>
                            <Text className={`font-bold text-xs ${i === 0 ? 'text-white' : 'text-slate-600'}`}>{filter}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <FlatList
                data={tickets}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => setSelectedTicket(item)}
                        className={`bg-white p-4 rounded-2xl mb-3 border shadow-sm border-gray-100`}
                    >
                        <View className="flex-row justify-between mb-2">
                            <View className="flex-row items-center gap-2">
                                <Text className="font-bold text-slate-800 text-base">{item.profiles?.full_name || 'Anonymous'}</Text>
                            </View>
                            <Text className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                        <Text className="text-slate-600 font-bold text-sm mb-1">{item.subject}</Text>
                        <Text className="text-gray-400 text-[10px] mb-3 uppercase font-bold text-blue-500">{item.priority} Priority</Text>

                        <View className="flex-row items-center justify-between">
                            <View className={`px-2 py-1 rounded text-[10px] ${item.status === 'open' ? 'bg-red-100' :
                                item.status === 'in_progress' ? 'bg-blue-100' : 'bg-green-100'
                                }`}>
                                <Text className={`text-[10px] font-bold ${item.status === 'open' ? 'text-red-700' :
                                    item.status === 'in_progress' ? 'text-blue-700' : 'text-green-700'
                                    }`}>{item.status.toUpperCase()}</Text>
                            </View>
                            <Text className="text-[10px] text-gray-300 font-mono">{item.id}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );

    const renderChatInterface = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-50">
            <View className="bg-white p-4 border-b border-gray-100 flex-row items-center justify-between shadow-sm z-10">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => setSelectedTicket(null)} className="mr-3">
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View>
                        <Text className="font-bold text-slate-800 text-lg">Support Chat</Text>
                        <Text className="text-xs text-gray-400 font-mono">{selectedTicket?.id?.split('-')[0]}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={resolveTicket} className="bg-green-500 px-3 py-1.5 rounded-lg">
                    <Text className="text-white text-xs font-bold">Mark Resolved</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 20 }}>
                {selectedTicket && messages.length > 0 ? (
                    messages.map((m) => (
                        <View key={m.id} className={`mb-4 w-full items-${m.sender_id === selectedTicket.user_id ? 'start' : 'end'}`}>
                            <View className={`p-3 rounded-2xl shadow-sm max-w-[80%] ${m.sender_id === selectedTicket.user_id
                                ? 'bg-white rounded-tl-none border border-gray-100'
                                : 'bg-blue-600 rounded-tr-none'
                                }`}>
                                <Text className={`${m.sender_id === selectedTicket.user_id ? 'text-slate-700' : 'text-white'} mb-1`}>
                                    {m.message}
                                </Text>
                                <Text className={`text-[10px] ${m.sender_id === selectedTicket.user_id ? 'text-gray-300' : 'text-blue-200'}`}>
                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {m.sender_id !== selectedTicket.user_id && ' • Admin'}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View className="flex-1 items-center justify-center pt-20">
                        <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
                        <Text className="text-gray-400 mt-2">No messages yet</Text>
                    </View>
                )}
            </ScrollView>

            <View className="p-4 bg-white border-t border-gray-100">
                <View className="flex-row items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
                    <TouchableOpacity className="mr-2">
                        <Ionicons name="attach" size={24} color="#94A3B8" />
                    </TouchableOpacity>
                    <TextInput
                        placeholder="Type your reply..."
                        placeholderTextColor="#94A3B8"
                        className="flex-1 h-10 font-medium text-slate-800"
                        value={reply}
                        onChangeText={setReply}
                    />
                    <TouchableOpacity
                        onPress={sendMessage}
                        className="bg-slate-900 w-8 h-8 rounded-full items-center justify-center ml-2"
                    >
                        <Ionicons name="send" size={16} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            {selectedTicket ? renderChatInterface() : (
                <>
                    <Stack.Screen options={{ title: 'Help Desk', headerShown: true }} />
                    {renderTicketList()}
                </>
            )}
        </View>
    );
}
