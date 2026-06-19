import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { supabase } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// --- EXPANDED KNOWLEDGE BASE ---
const KNOWLEDGE_BASE = [
  { 
      keywords: ['hello', 'hi', 'hey', 'start', 'sannu', 'slm'], 
      response: "Welcome back, {{name}}! 👋\nI am **Cotex**, your Smart Admin.\n\nYour current balance is **{{balance}}**.\n\nHow can I help you today?\n• **Identity**: NIN Modification, Slip.\n• **Finance**: Cards, Loans.\n• **Bills**: Data, Airtime.",
      action: undefined 
  },
  { 
      keywords: ['fund', 'deposit', 'money', 'wallet', 'add', 'kudi', 'sa kudi'], 
      response: "To fund your wallet (Sa Kudi):\nUse **Monnify** for instant funding or **Manual Transfer**. Click below to start adding money to your balance of {{balance}}.",
      action: { label: "Fund Wallet / Sa Kudi", route: "/fund-wallet" }
  },
  { 
      keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'siyan data'], 
      response: "We offer cheapest data for all networks (MTN, Glo, etc). System na gane network da kanshi.\nClick below to buy.",
      action: { label: "Buy Data", route: "/data" }
  },
  { 
      keywords: ['receipt', 'evidence', 'biya', 'transaction', 'shaida', 'print'], 
      response: "You can generate receipts for any past transaction.\nClick below to view your **Transaction Receipts**.",
      action: { label: "Get Receipts", route: "/receipts" }
  },
  { 
      keywords: ['pending', 'wait', 'hold', 'fail', 'matsala', 'balance not added'], 
      response: "Sorry about the delay regarding your transaction.\nPlease check your **Transaction History** or Contact Support if it persists.",
      action: { label: "View History", route: "/history" }
  },
  { 
      keywords: ['refer', 'friend', 'invite', 'gayyata', 'bonus', 'earn'], 
      response: "Invite friends and earn bonuses! 🎁\nShare your link from the **Referral Dashboard**.",
      action: { label: "Refer & Earn", route: "/referrals" }
  },
  { 
      keywords: ['crypto', 'bitcoin', 'usdt', 'trade', 'futures'], 
      response: "Trade Crypto Pro! We offer **Spot** and **Futures (125x)**. Long or Short BTC/USDT now.",
      action: { label: "Go to Crypto", route: "/crypto" }
  },
  { 
      keywords: ['loan', 'borrow', 'credit', 'bashi', 'aro'], 
      response: "Need quick cash (Bashi), {{name}}? Check your eligibility for an instant loan.",
      action: { label: "Check Loans", route: "/loans" }
  },
  {
      keywords: ['balance', 'how much', 'nawa', 'kudi na'],
      response: "Your current wallet balance is **{{balance}}**.",
      action: { label: "View Wallet", route: "/(app)/wallet" }
  },
  {
    keywords: ['help', 'support', 'taimako'],
    response: "I can help with:\n• **Funding**\n• **Data/Airtime**\n• **Receipts**\n• **NIN/BVN**\n• **Crypto**\n\nOr contact a human agent.",
    action: { label: "Contact Support", route: "/support" }
  }
];

const QUICK_PROMPTS = ["Sa Kudi", "Buy Data", "Get Receipt", "Check Balance", "Pending Transaction", "Refer Friend"];

export default function CotexAIChat() {
    const router = useRouter(); 
    const navigation = useNavigation(); 
    const [userData, setUserData] = useState({ name: 'User', balance: '0.00' });

    const [messages, setMessages] = useState<any[]>([
        { id: '1', text: "Sannu! I am Cotex. Ask me about Data, Receipts, or Funding.", sender: 'bot', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, balance')
                    .eq('id', user.id)
                    .single();
                
                if (data) {
                    setUserData({
                        name: data.full_name || 'User',
                        balance: '₦' + (data.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00')
                    });
                }
            }
        } catch (e) {
            console.log("Error fetching user data", e);
        }
    };

    const processResponseText = (text: string) => {
        return text.replace(/{{name}}/g, userData.name).replace(/{{balance}}/g, userData.balance);
    };

    const generateResponse = (text: string) => {
        const lowerText = text.toLowerCase();
        let bestMatch = null;
        let maxScore = 0;

        KNOWLEDGE_BASE.forEach(item => {
            let score = 0;
            item.keywords.forEach(word => {
                if (lowerText.includes(word)) score++;
            });
            if (score > maxScore) {
                maxScore = score;
                bestMatch = item;
            }
        });
        
        if (bestMatch) {
            return { text: processResponseText((bestMatch as any).response), action: (bestMatch as any).action };
        }
        return { 
            text: processResponseText("Yi hakuri {{name}}, ban fahimci wannan ba.\nTry keywords like: **Receipt**, **Data**, **Funding**."), 
            action: undefined 
        };
    };

    // --- TYPEWRITER STREAMING LOGIC ---
    const streamResponse = (fullText: string, action: any) => {
        const botMsgId = (Date.now() + 1).toString();
        const initialMsg = {
            id: botMsgId,
            text: "",
            sender: 'bot',
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            action: undefined, // Don't show action until done
            isStreaming: true
        };

        setMessages(prev => [...prev, initialMsg]);
        setIsTyping(false); // Stop "thinking" bubbles, start streaming

        let i = 0;
        const speed = 20; // ms per char

        const interval = setInterval(() => {
            setMessages(prev => prev.map(msg => {
                if (msg.id === botMsgId) {
                    return { ...msg, text: fullText.substring(0, i + 1) };
                }
                return msg;
            }));

            i++;
            if (i === fullText.length) {
                clearInterval(interval);
                // Final update to add action and remove streaming status
                setMessages(prev => prev.map(msg => {
                    if (msg.id === botMsgId) {
                        return { ...msg, action: action, isStreaming: false };
                    }
                    return msg;
                }));
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }, speed);
    };

    const handleSend = (text: string = inputText) => {
        if (!text.trim()) return;

        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const userMsg = {
            id: Date.now().toString(),
            text: text,
            sender: 'user',
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        setTimeout(() => {
            const response = generateResponse(text);
            streamResponse(response.text, response.action);
        }, 1200);
    };

    const handleClearChat = () => {
        Alert.alert("Clear Chat", "Are you sure you want to wipe this conversation?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Clear", 
                style: "destructive", 
                onPress: () => {
                    setMessages([{ id: Date.now().toString(), text: "Chat cleared. How can I help?", sender: 'bot', time: "Now" }]);
                    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            }
        ]);
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Copied", "Message copied to clipboard.");
    };

    useEffect(() => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
    }, [messages, isTyping]); // Auto-scroll on new chars

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* GLASSMORPHISM HEADER */}
            <View className="absolute top-0 left-0 right-0 z-20 overflow-hidden rounded-b-3xl">
                <BlurView intensity={80} tint="dark" className="px-4 pb-4 pt-2">
                     <SafeAreaView edges={['top']}>
                        <View className="flex-row items-center justify-between mt-2">
                            <View className="flex-row items-center gap-3">
                                <TouchableOpacity onPress={() => navigation.goBack()} className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                                    <Ionicons name="arrow-back" size={20} color="white" />
                                </TouchableOpacity>
                                <View className="relative">
                                    <LinearGradient
                                        colors={['#6366f1', '#a855f7']}
                                        className="w-10 h-10 rounded-full items-center justify-center border-2 border-white/20"
                                    >
                                        <Ionicons name="sparkles" size={20} color="white" />
                                    </LinearGradient>
                                    <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-slate-900" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">Cotex AI</Text>
                                    <Text className="text-indigo-200 text-xs font-medium">Online • v2.1</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={handleClearChat} className="bg-white/10 p-2 rounded-full">
                                <Ionicons name="trash-outline" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </BlurView>
            </View>

            {/* CHAT AREA */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView 
                    ref={scrollViewRef}
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingTop: 110, paddingBottom: 20 }}
                >
                    <Text className="text-center text-slate-400 text-[10px] mb-6 uppercase tracking-widest font-bold opacity-60">
                        {new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
                    </Text>

                    {messages.map((msg) => {
                        const isUser = msg.sender === 'user';
                        return (
                            <View key={msg.id} className={"mb-6 flex-row " + (isUser ? 'justify-end' : 'justify-start')}>
                                {!isUser && (
                                    <LinearGradient
                                        colors={['#e0e7ff', '#c7d2fe']}
                                        className="w-8 h-8 rounded-full items-center justify-center mr-2 mt-1 shadow-sm"
                                    >
                                        <Ionicons name="logo-android" size={16} color="#4f46e5" />
                                    </LinearGradient>
                                )}
                                
                                <TouchableOpacity 
                                    onLongPress={() => handleCopy(msg.text)}
                                    activeOpacity={0.8}
                                    className={`p-4 rounded-2xl max-w-[85%] ${
                                        isUser 
                                        ? 'bg-indigo-600 rounded-tr-sm shadow-md shadow-indigo-200' 
                                        : 'bg-white rounded-tl-sm shadow-sm border border-slate-100'
                                    }`}
                                >
                                    <Text className={`text-[15px] leading-6 ${isUser ? 'text-white' : 'text-slate-700'}`}>
                                        {msg.text}
                                        {msg.isStreaming && <Text className="text-indigo-400">|</Text>} 
                                    </Text>
                                    
                                    {/* ACTION BUTTON */}
                                    {msg.action && !msg.isStreaming && (
                                        <TouchableOpacity 
                                            onPress={() => router.push(msg.action?.route as any)}
                                            className="mt-3 bg-indigo-50 py-2.5 px-4 rounded-xl flex-row items-center border border-indigo-100"
                                        >
                                            <Text className="text-indigo-600 font-bold text-xs flex-1">{msg.action.label}</Text>
                                            <View className="bg-indigo-100 p-1 rounded-full">
                                                <Ionicons name="arrow-forward" size={12} color="#4f46e5" />
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    <Text className={`text-[9px] mt-1.5 text-right ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {msg.time}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}

                    {isTyping && (
                        <View className="flex-row items-center mb-4 ml-1">
                            <View className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex-row gap-1.5 shadow-sm">
                                <View className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                <View className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75" />
                                <View className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150" />
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* QUICK PROMPTS */}
                {!isTyping && (
                    <View className="pb-2">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 16, gap: 8}}>
                            {QUICK_PROMPTS.map((prompt, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    onPress={() => handleSend(prompt)}
                                    className="bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm active:bg-indigo-50 active:border-indigo-200"
                                >
                                    <Text className="text-slate-600 text-[11px] font-bold">{prompt}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* INPUT AREA */}
                <View className="bg-white px-4 pb-8 pt-2 border-t border-slate-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <View className="flex-row items-end gap-2 bg-slate-50 px-2 py-1.5 rounded-[24px] border border-slate-200 focus:border-indigo-500">
                        <TouchableOpacity className="p-2.5 bg-slate-200/50 rounded-full">
                            <Ionicons name="mic-outline" size={20} color="#64748b" />
                        </TouchableOpacity>
                        
                        <TextInput 
                            className="flex-1 py-3 text-slate-800 font-medium max-h-24 text-[15px]"
                            placeholder="Type a message..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={inputText}
                            onChangeText={setInputText}
                        />

                        <TouchableOpacity 
                            onPress={() => handleSend()}
                            disabled={inputText.trim().length === 0}
                            className="p-2.5 rounded-full items-center justify-center transition-all"
                            style={{
                                backgroundColor: inputText.trim().length > 0 ? '#4f46e5' : '#e2e8f0',
                                transform: [{ scale: inputText.trim().length > 0 ? 1 : 0.95 }]
                            }}
                        >
                            <Ionicons name="send" size={18} color={inputText.trim().length > 0 ? "white" : "#94a3b8"} />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
