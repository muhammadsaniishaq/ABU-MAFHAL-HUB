import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';

type TicketMessage = {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
};

export default function UserTicketChatScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [reply, setReply] = useState('');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        setupChat();
    }, [id]);

    const setupChat = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);
            await fetchMessages();
        }
        setLoading(false);
    };

    const fetchMessages = async () => {
        if (!id) return;
        const { data } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', id)
            .order('created_at', { ascending: true });
        if (data) setMessages(data);
    };

    const sendMessage = async () => {
        if (!reply.trim() || !userId || !id) return;

        const { error } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: id,
                sender_id: userId,
                message: reply.trim()
            });

        if (!error) {
            setReply('');
            fetchMessages();
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-50">
            <Stack.Screen options={{ 
                title: 'Live Chat',
                headerShown: true,
                headerStyle: { backgroundColor: '#0d1b3e' },
                headerTintColor: '#fff',
            }} />

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#0d1b3e" />
                </View>
            ) : (
                <>
                    <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 20 }}>
                        {messages.length > 0 ? (
                            messages.map((m) => (
                                <View key={m.id} className={`mb-4 w-full items-${m.sender_id === userId ? 'end' : 'start'}`}>
                                    <View className={`p-3 rounded-2xl shadow-sm max-w-[80%] ${m.sender_id === userId
                                        ? 'bg-[#0d1b3e] rounded-tr-none'
                                        : 'bg-white rounded-tl-none border border-gray-100'
                                        }`}>
                                        <Text className={`${m.sender_id === userId ? 'text-white' : 'text-slate-700'} mb-1 text-[15px]`}>
                                            {m.message}
                                        </Text>
                                        <Text className={`text-[10px] ${m.sender_id === userId ? 'text-blue-200' : 'text-gray-400'}`}>
                                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {m.sender_id !== userId && ' • Support'}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View className="flex-1 items-center justify-center pt-20">
                                <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
                                <Text className="text-gray-400 mt-2">A support agent will be with you shortly.</Text>
                            </View>
                        )}
                    </ScrollView>

                    <View className="p-4 bg-white border-t border-gray-100 pb-8">
                        <View className="flex-row items-center bg-[#f8fafc] rounded-full px-4 py-2 border border-slate-200">
                            <TextInput
                                placeholder="Type a message..."
                                placeholderTextColor="#94A3B8"
                                className="flex-1 h-10 font-medium text-slate-800"
                                value={reply}
                                onChangeText={setReply}
                                multiline
                            />
                            {reply.trim().length > 0 && (
                                <TouchableOpacity
                                    onPress={sendMessage}
                                    className="bg-[#0d1b3e] w-8 h-8 rounded-full items-center justify-center ml-2"
                                >
                                    <Ionicons name="arrow-up" size={16} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </>
            )}
        </KeyboardAvoidingView>
    );
}
