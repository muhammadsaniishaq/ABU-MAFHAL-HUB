
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';

// Define the message type based on our schema join
type ChatMessage = {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    profiles: {
        full_name: string | null;
        role: string | null;
    } | null;
};

export default function TeamChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [activeChannel, setActiveChannel] = useState('# general');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        getCurrentUser();
    }, []);

    useEffect(() => {
        fetchMessages();
        const subscription = subscribeToMessages();
        return () => {
            subscription.unsubscribe();
        };
    }, [activeChannel]);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setCurrentUser(profile);
        }
    };

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('team_messages')
                .select('*, profiles(full_name, role)')
                .eq('channel', activeChannel)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching messages:', error);
            } else if (data) {
                setMessages(data as any);
            }
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel('public:team_messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'team_messages',
                    filter: `channel=eq.${activeChannel}`,
                },
                async (payload) => {
                    // Fetch the full message with profile to show correctly
                    const { data } = await supabase
                        .from('team_messages')
                        .select('*, profiles(full_name, role)')
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        setMessages((prev) => [data as any, ...prev]);
                    }
                }
            )
            .subscribe();

        return channel;
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        const content = newMessage.trim();
        setNewMessage(''); // Optimistic clear

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('team_messages')
            .insert({
                channel: activeChannel,
                sender_id: user.id,
                content: content,
            });

        if (error) {
            console.error('Error sending message:', error);
            // Could add error handling UI here
        }
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getInitials = (name?: string | null) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    };

    return (
        <View className="flex-1 bg-white flex-row">
            <Stack.Screen options={{ title: 'Team Comms' }} />

            {/* Sidebar Channels */}
            <View className="w-1/4 bg-slate-50 border-r border-gray-100 pt-4 hidden sm:flex">
                <View className="mb-6 px-4">
                    <Text className="font-black text-slate-800 text-lg">Nexus</Text>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase">
                        {currentUser ? `Online: ${currentUser.role}` : 'Connecting...'}
                    </Text>
                </View>

                <View className="gap-1">
                    {['# general', '# alerts', '# engineering', '# sales', '# random'].map((c) => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setActiveChannel(c)}
                            className={`px-4 py-2 ${activeChannel === c ? 'bg-white border-l-4 border-blue-500 shadow-sm' : ''}`}
                        >
                            <Text className={`font-bold text-xs ${activeChannel === c ? 'text-slate-800' : 'text-slate-400'}`}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="mt-auto p-4 border-t border-gray-100">
                    <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 rounded-full bg-green-500" />
                        <Text className="text-slate-600 text-xs font-bold truncate">
                            {currentUser?.full_name || 'Loading...'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1 bg-white flex-col"
            >
                <View className="h-12 border-b border-gray-100 flex-row items-center justify-between px-4">
                    <Text className="font-bold text-slate-800">{activeChannel}</Text>
                    <Ionicons name="information-circle" size={20} color="#94A3B8" />
                </View>

                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1 p-4"
                // ScrollView does not support 'inverted'. Using standard order (latest at top due to desc fetch). 
                // Current implementation maps messages (which are fetched desc) so the latest is at top. 
                // Standard chat is usually bottom-aligned. Let's keep it simple: Latest at top (Twitter style) or Bottom (standard chat).
                // The fetch is 'order created_at desc', so setMessages(data) puts newest at index 0.
                // To show newest at bottom, we'd flex-col-reverse or fetch asc.
                // Let's stick to the previous design which seemed to show list.
                >
                    {loading ? (
                        <ActivityIndicator color="#3B82F6" />
                    ) : (
                        messages.map((m) => {
                            const isMe = currentUser?.id === m.sender_id;
                            return (
                                <View key={m.id} className={`flex-row gap-3 mb-4 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    <View className={`w-8 h-8 rounded items-center justify-center ${isMe ? 'bg-blue-500' : 'bg-blue-100'}`}>
                                        <Text className={`${isMe ? 'text-white' : 'text-blue-600'} font-bold text-xs`}>
                                            {getInitials(m.profiles?.full_name)}
                                        </Text>
                                    </View>
                                    <View className={isMe ? 'items-end' : ''}>
                                        <View className={`flex-row items-baseline gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            <Text className="font-bold text-slate-800 text-xs">{m.profiles?.full_name || 'Unknown'}</Text>
                                            <Text className="text-gray-300 text-[10px]">{formatTime(m.created_at)}</Text>
                                        </View>
                                        <View className={`px-3 py-2 rounded-lg mt-1 ${isMe ? 'bg-blue-500' : 'bg-gray-100'}`}>
                                            <Text className={`${isMe ? 'text-white' : 'text-slate-600'} text-sm`}>{m.content}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                <View className="p-4 border-t border-gray-100">
                    <View className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 flex-row items-center">
                        <TextInput
                            placeholder={`Message ${activeChannel}`}
                            className="flex-1 font-medium text-slate-700"
                            value={newMessage}
                            onChangeText={setNewMessage}
                            onSubmitEditing={sendMessage}
                        />
                        <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim()}>
                            <Ionicons name="send" size={16} color={newMessage.trim() ? "#3B82F6" : "#A0AEC0"} />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
