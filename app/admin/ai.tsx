import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useRef } from 'react';
import { AIService } from '../../services/ai';

export default function AIInsights() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'system', text: 'Cortex AI v4.0 Online. I have full access to the database. Ask me anything.' }
    ]);
    const scrollRef = useRef<ScrollView>(null);

    const handleAskAI = async () => {
        if (!query.trim()) return;

        const userMsg = { role: 'user', text: query };
        setMessages(prev => [...prev, userMsg]);
        setQuery('');
        setLoading(true);

        try {
            const responseText = await AIService.askCortex(userMsg.text);
            setMessages(prev => [...prev, { role: 'system', text: responseText }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', text: 'Error: Could not connect to Neural Core. Please check API configuration.' }]);
        } finally {
            setLoading(false);
            if (scrollRef.current) {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-950">
            <Stack.Screen options={{
                title: 'Cortex AI',
                headerStyle: { backgroundColor: '#020617' },
                headerTintColor: '#fff'
            }} />

            <View className="flex-1 p-4">
                <ScrollView
                    ref={scrollRef}
                    className="flex-1 mb-4"
                    contentContainerStyle={{ gap: 16 }}
                >
                    {messages.map((msg, i) => (
                        <View key={i} className={`flex-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'system' && (
                                <View className="w-8 h-8 rounded-full bg-indigo-600 items-center justify-center mr-2 mt-2">
                                    <Ionicons name="sparkles" size={16} color="white" />
                                </View>
                            )}
                            <View className={`p-4 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-slate-800 rounded-tr-none' : 'bg-indigo-900/40 border border-indigo-500/30 rounded-tl-none'}`}>
                                <Text className={`${msg.role === 'user' ? 'text-white' : 'text-indigo-100'} leading-5`}>{msg.text}</Text>
                            </View>
                        </View>
                    ))}
                    {loading && (
                        <View className="flex-row items-center gap-2">
                            <View className="w-8 h-8 rounded-full bg-indigo-600/50 items-center justify-center mr-2">
                                <ActivityIndicator color="white" size="small" />
                            </View>
                            <Text className="text-slate-500 text-xs italic">Processing neural query...</Text>
                        </View>
                    )}
                </ScrollView>

                <View className="flex-row gap-3 items-center bg-slate-900 p-2 rounded-full border border-slate-800">
                    <TextInput
                        className="flex-1 text-white px-4 py-3 h-12"
                        placeholder="Ask about revenue, users, risks..."
                        placeholderTextColor="#64748B"
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleAskAI}
                    />
                    <TouchableOpacity
                        onPress={handleAskAI}
                        disabled={loading}
                        className={`w-10 h-10 rounded-full items-center justify-center ${loading ? 'bg-slate-700' : 'bg-indigo-600'}`}
                    >
                        <Ionicons name="arrow-up" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
