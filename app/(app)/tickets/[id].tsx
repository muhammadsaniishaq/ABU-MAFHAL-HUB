import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';

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
    const [sending, setSending] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [ticketDetails, setTicketDetails] = useState<any>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        setupChat();

        // Realtime Subscription for Live Messages
        if (id) {
            const channel = supabase
                .channel(`ticket:${id}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'ticket_messages', 
                    filter: `ticket_id=eq.${id}` 
                }, (payload) => {
                    setMessages(prev => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new as TicketMessage];
                    });
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [id]);

    const setupChat = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);
            await fetchTicketDetails();
            await fetchMessages();
        }
        setLoading(false);
    };

    const fetchTicketDetails = async () => {
        if (!id) return;
        const { data } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', id)
            .single();
        if (data) setTicketDetails(data);
    };

    const fetchMessages = async () => {
        if (!id) return;
        const { data } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', id)
            .order('created_at', { ascending: true });
        if (data) {
            setMessages(data);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 50);
        }
    };

    const sendMessage = async (textOverride?: string) => {
        const textToSend = textOverride || reply.trim();
        if (!textToSend || !userId || !id) return;

        setSending(true);
        if (!textOverride) setReply('');

        try {
            const { error } = await supabase
                .from('ticket_messages')
                .insert({
                    ticket_id: id as string,
                    sender_id: userId,
                    message: textToSend
                });

            if (error) {
                Alert.alert("Failed to Send", error.message);
            } else {
                fetchMessages();
            }
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        if (!userId || !id) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
            base64: true
        });

        if (!result.canceled && result.assets[0].base64) {
            try {
                setSending(true);
                const base64Data = result.assets[0].base64;
                const filePath = `tickets/${id}/${Date.now()}.jpg`;
                
                const { error } = await supabase.storage
                    .from('chat_images')
                    .upload(filePath, decode(base64Data), {
                        contentType: 'image/jpeg'
                    });
                
                if (error) {
                    Alert.alert('Upload Warning', 'Could not upload file directly. Sending message instead.');
                    return;
                }
                
                const { data: { publicUrl } } = supabase.storage.from('chat_images').getPublicUrl(filePath);
                await sendMessage(`[IMAGE] ${publicUrl}`);
            } catch (e: any) {
                Alert.alert('Error', e.message);
            } finally {
                setSending(false);
            }
        }
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert("Copied", "Message copied to clipboard!");
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#040814]">
            <Stack.Screen options={{ 
                title: ticketDetails?.subject || 'Live Support Chat',
                headerShown: true,
                headerStyle: { backgroundColor: '#060d21' },
                headerTintColor: '#f5a623',
                headerTitleStyle: { fontWeight: '800' },
                headerRight: () => (
                    <View className="flex-row items-center gap-1">
                        <View className="bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex-row items-center gap-1 mr-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <Text className="text-emerald-400 font-bold text-[10px]">Realtime</Text>
                        </View>
                    </View>
                )
            }} />

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#f5a623" />
                </View>
            ) : (
                <>
                    {/* TICKET DETAILS HEADER BANNER */}
                    <View className="bg-slate-900/90 border-b border-slate-800 px-3.5 py-2 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="headset" size={14} color="#f5a623" />
                            <Text className="text-slate-200 text-[11.5px] font-bold" numberOfLines={1}>
                                #{id ? (id as string).split('-')[0] : ''} • {ticketDetails?.subject || 'Live Ticket'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={fetchMessages} className="p-1">
                            <Ionicons name="refresh-outline" size={15} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {/* MESSAGES LIST */}
                    <ScrollView 
                        ref={scrollViewRef}
                        className="flex-1 px-3.5 py-3" 
                        contentContainerStyle={{ paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.length > 0 ? (
                            messages.map((m) => {
                                const isUser = m.sender_id === userId;
                                const isImage = m.message.startsWith('[IMAGE]');
                                const imageUrl = isImage ? m.message.replace('[IMAGE]', '').trim() : null;

                                return (
                                    <View key={m.id} className={`mb-3.5 w-full flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        {!isUser && (
                                            <View className="w-7 h-7 rounded-full bg-slate-900 border border-[#f5a623]/40 items-center justify-center mr-2 mt-0.5 shadow-sm">
                                                <Ionicons name="shield-checkmark" size={13} color="#f5a623" />
                                            </View>
                                        )}

                                        <View className={`max-w-[84%] rounded-2xl p-3 border shadow-md ${
                                            isUser 
                                                ? 'bg-blue-900/80 border-blue-600/40 rounded-tr-xs' 
                                                : 'bg-slate-900/90 border-slate-800/90 rounded-tl-xs'
                                        }`}>
                                            {!isUser && (
                                                <View className="flex-row items-center gap-1 mb-1 pb-1 border-b border-slate-800/80">
                                                    <Ionicons name="headset" size={11} color="#f5a623" />
                                                    <Text className="text-[#f5a623] font-bold text-[10px] uppercase">Admin Agent</Text>
                                                </View>
                                            )}

                                            <TouchableOpacity onLongPress={() => handleCopy(m.message)} activeOpacity={0.9}>
                                                {isImage && imageUrl ? (
                                                    <Image 
                                                        source={{ uri: imageUrl }} 
                                                        className="w-52 h-52 rounded-xl mb-1 bg-slate-800"
                                                        resizeMode="cover" 
                                                    />
                                                ) : (
                                                    <Text className={`text-[13.5px] leading-5 font-normal ${isUser ? 'text-white' : 'text-slate-100'}`}>
                                                        {m.message}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>

                                            <View className="flex-row items-center justify-between mt-1.5 pt-1 border-t border-slate-800/50">
                                                <Text className="text-[9.5px] font-semibold text-slate-400">
                                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                                {isUser && (
                                                    <Ionicons name="checkmark-done" size={12} color="#60a5fa" />
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        ) : (
                            <View className="flex-1 items-center justify-center pt-24 px-6">
                                <View className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 items-center justify-center mb-3">
                                    <Ionicons name="chatbubbles-outline" size={28} color="#f5a623" />
                                </View>
                                <Text className="text-white font-extrabold text-[14px] text-center">Support Chat Active</Text>
                                <Text className="text-slate-400 mt-1 font-medium text-[12px] text-center leading-4">
                                    Send your message below. A support agent will reply you in real-time.
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* FLOATING COMPACT INPUT BAR */}
                    <View className="bg-[#060d21] px-3 pb-5 pt-2 border-t border-slate-800/80 shadow-2xl">
                        <View className="flex-row items-center gap-2 bg-slate-900/90 px-2 py-1 rounded-full border border-slate-800 shadow-inner">
                            
                            <TouchableOpacity 
                                onPress={pickImage} 
                                className="p-1.5 bg-slate-800/90 rounded-full active:scale-95"
                            >
                                <Ionicons name="attach" size={18} color="#f5a623" />
                            </TouchableOpacity>

                            <TextInput
                                placeholder="Write a message to support..."
                                placeholderTextColor="#64748b"
                                className="flex-1 py-2 px-1 text-slate-100 text-[13.5px] max-h-24 leading-4 font-medium"
                                value={reply}
                                onChangeText={setReply}
                                multiline
                            />

                            <TouchableOpacity
                                onPress={() => sendMessage()}
                                disabled={sending || !reply.trim()}
                                className="rounded-full overflow-hidden active:scale-95 shadow-md shadow-amber-500/20"
                            >
                                <LinearGradient
                                    colors={sending || !reply.trim() ? ['#334155', '#1e293b'] : ['#f5a623', '#d97706']}
                                    className="h-[34px] w-[34px] items-center justify-center rounded-full"
                                >
                                    {sending ? (
                                        <ActivityIndicator color="#060d21" size="small" />
                                    ) : (
                                        <Ionicons name="paper-plane" size={16} color="#060d21" style={{ marginLeft: 2 }} />
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}
        </KeyboardAvoidingView>
    );
}
