import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useRef } from 'react';
import { AIService } from '../../services/ai';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';

const ADMIN_QUICK_PROMPTS = [
    "📊 Revenue Summary",
    "👥 Today's User Stats",
    "⚠️ Risk & Fraud Audit",
    "💳 Wallet Ingestion Logs",
    "📜 Pending CAC Approvals"
];

export default function AIInsights() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [speakingId, setSpeakingId] = useState<number | null>(null);
    const [messages, setMessages] = useState<any[]>([
        { role: 'system', text: '⚡ Cortex Neural Core v4.0 Active.\nI have real-time administrative access to platform analytics, user records, and database secrets. What would you like to inspect today?' }
    ]);
    const scrollRef = useRef<ScrollView>(null);

    const handleAskAI = async (customQuery?: string) => {
        const textToAsk = customQuery || query;
        if (!textToAsk.trim()) return;

        const userMsg = { role: 'user', text: textToAsk };
        setMessages(prev => [...prev, userMsg]);
        if (!customQuery) setQuery('');
        setLoading(true);

        try {
            const responseText = await AIService.askCortex(userMsg.text);
            setMessages(prev => [...prev, { role: 'system', text: responseText }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', text: 'Error: Could not connect to Neural Core. Please verify database API configuration.' }]);
        } finally {
            setLoading(false);
            if (scrollRef.current) {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }
        }
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert("Copied", "Copied to clipboard!");
    };

    const handleSpeak = (index: number, text: string) => {
        if (speakingId === index) {
            Speech.stop();
            setSpeakingId(null);
        } else {
            Speech.speak(text, {
                onStart: () => setSpeakingId(index),
                onDone: () => setSpeakingId(null),
                onError: () => setSpeakingId(null),
            });
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#040814]">
            <Stack.Screen options={{
                title: 'Cortex AI Core',
                headerStyle: { backgroundColor: '#060d21' },
                headerTintColor: '#f5a623',
                headerTitleStyle: { fontWeight: '800' }
            }} />

            {/* STATUS BADGE HEADER */}
            <View className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex-row items-center justify-between shadow-sm">
                <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Text className="text-slate-300 text-[11.5px] font-bold">Neural Engine • Real-time DB Access</Text>
                </View>
                <TouchableOpacity onPress={() => setMessages([{ role: 'system', text: 'Cortex AI v4.0 System Reset.' }])} className="p-1">
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <View className="flex-1 px-3.5 pt-3">
                <ScrollView
                    ref={scrollRef}
                    className="flex-1 mb-2"
                    contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((msg, i) => (
                        <View key={i} className={`flex-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'system' && (
                                <View className="w-7 h-7 rounded-full bg-slate-900 border border-indigo-500/40 items-center justify-center mr-2 mt-1 shadow-sm">
                                    <Ionicons name="sparkles" size={13} color="#818cf8" />
                                </View>
                            )}
                            <View className={`p-3 rounded-2xl max-w-[85%] border shadow-md ${
                                msg.role === 'user' 
                                    ? 'bg-blue-900/80 border-blue-600/40 rounded-tr-xs' 
                                    : 'bg-slate-900/90 border-slate-800/90 rounded-tl-xs'
                            }`}>
                                <Text className={`${msg.role === 'user' ? 'text-white font-medium' : 'text-slate-100 font-normal'} text-[13.5px] leading-5`}>
                                    {msg.text}
                                </Text>

                                {/* TOOLBAR FOR SYSTEM RESPONSES */}
                                {msg.role === 'system' && (
                                    <View className="flex-row items-center mt-2 pt-1.5 border-t border-slate-800/80 gap-3">
                                        <TouchableOpacity onPress={() => handleSpeak(i, msg.text)} className="p-0.5">
                                            <Ionicons name={speakingId === i ? "volume-high" : "volume-medium-outline"} size={13} color={speakingId === i ? "#818cf8" : "#64748b"} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleCopy(msg.text)} className="p-0.5">
                                            <Ionicons name="copy-outline" size={12} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                    {loading && (
                        <View className="flex-row items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-2xl self-start">
                            <ActivityIndicator color="#818cf8" size="small" />
                            <Text className="text-slate-400 text-[11px] font-semibold italic">Analyzing Database & Running Neural Logic...</Text>
                        </View>
                    )}
                </ScrollView>

                {/* ADMIN QUICK PROMPTS */}
                {!loading && (
                    <View className="pb-2 pt-1">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                            {ADMIN_QUICK_PROMPTS.map((prompt, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => handleAskAI(prompt)}
                                    className="bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full active:bg-slate-800 flex-row items-center gap-1.5"
                                >
                                    <Ionicons name="sparkles-outline" size={11} color="#818cf8" />
                                    <Text className="text-slate-300 text-[11.5px] font-semibold">{prompt}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* INPUT BAR */}
                <View className="bg-[#060d21] pb-5 pt-2 border-t border-slate-800/80">
                    <View className="flex-row items-center gap-2 bg-slate-900/90 px-2 py-1 rounded-full border border-slate-800">
                        <TextInput
                            className="flex-1 text-slate-100 text-[13.5px] px-3 py-2 max-h-24 leading-4 font-medium"
                            placeholder="Ask Cortex AI about users, revenue, risk..."
                            placeholderTextColor="#64748B"
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={() => handleAskAI()}
                        />
                        <TouchableOpacity
                            onPress={() => handleAskAI()}
                            disabled={loading || !query.trim()}
                            className="rounded-full overflow-hidden active:scale-95 shadow-md"
                        >
                            <LinearGradient
                                colors={loading || !query.trim() ? ['#334155', '#1e293b'] : ['#6366f1', '#4f46e5']}
                                className="h-[34px] w-[34px] items-center justify-center rounded-full"
                            >
                                <Ionicons name="arrow-up" size={18} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
