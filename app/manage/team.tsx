
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

export default function TeamChat() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [activeChannel, setActiveChannel] = useState('# general');

    useEffect(() => {
        fetchMessages();
    }, [activeChannel]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            // In a real app, this would be a dedicated 'internal_comms' table
            const { data, error } = await supabase
                .from('audit_logs') // Using audit logs as a proxy for 'real' data if a specific table is missing
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                const mapped = data.map(log => ({
                    id: log.id,
                    sender: log.admin_id?.split('-')[0] || 'System',
                    text: `${log.action}: ${log.target_resource}`,
                    time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    initials: 'SYS'
                }));
                setMessages(mapped.reverse());
            }
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        // Logic to send message would go here
        setNewMessage('');
        fetchMessages();
    };
    return (
        <View className="flex-1 bg-white flex-row">
            <Stack.Screen options={{ title: 'Team Comms' }} />

            {/* Sidebar Channels */}
            <View className="w-1/4 bg-slate-50 border-r border-gray-100 pt-4">
                <View className="mb-6 px-4">
                    <Text className="font-black text-slate-800 text-lg">Nexus</Text>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase">Online: 4</Text>
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
                        <Text className="text-slate-600 text-xs font-bold">You (Admin)</Text>
                    </View>
                </View>
            </View>

            {/* Chat Area */}
            <View className="flex-1 bg-white flex-col">
                <View className="h-12 border-b border-gray-100 flex-row items-center justify-between px-4">
                    <Text className="font-bold text-slate-800"># general</Text>
                    <Ionicons name="information-circle" size={20} color="#94A3B8" />
                </View>

                <ScrollView className="flex-1 p-4">
                    {loading ? (
                        <ActivityIndicator color="#3B82F6" />
                    ) : (
                        messages.map((m) => (
                            <View key={m.id} className="flex-row gap-3 mb-4">
                                <View className="w-8 h-8 rounded bg-blue-100 items-center justify-center">
                                    <Text className="text-blue-600 font-bold text-xs">{m.initials}</Text>
                                </View>
                                <View>
                                    <View className="flex-row items-baseline gap-2">
                                        <Text className="font-bold text-slate-800 text-xs">{m.sender}</Text>
                                        <Text className="text-gray-300 text-[10px]">{m.time}</Text>
                                    </View>
                                    <Text className="text-slate-600 text-sm">{m.text}</Text>
                                </View>
                            </View>
                        ))
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
                        <TouchableOpacity onPress={sendMessage}>
                            <Ionicons name="send" size={16} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}
