import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';

// --- KNOWLEDGE BASE (The Brain) ---
const KNOWLEDGE_BASE = [
  { 
      keywords: ['hello', 'hi', 'hey', 'start', 'sannu', 'slm', 'salama'], 
      response: "Welcome to ABU MAFHAL HUB! I am **Cotex**, your Smart Admin.\nIna jin Hausa da Turanci. How can I help you?\n\n• **Identity**: NIN Modification, Slip.\n• **Finance**: Cards, Loans.\n• **Bills**: Data, Airtime.",
      action: undefined 
  },
  { 
      keywords: ['fund', 'deposit', 'money', 'wallet', 'add', 'kudi', 'sa kudi', 'account', 'transfer', 'transfa'], 
      response: "To fund your wallet (Sa Kudi):\nUse **Monnify** for instant funding or **Manual Transfer**. Click below to start.",
      action: { label: "Fund Wallet / Sa Kudi", route: "/fund-wallet" }
  },
  { 
      keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'airtel', '9mobile', 'siyan data', 'sub'], 
      response: "We offer cheapest data for all networks (MTN, Glo, etc). System na gane network da kanshi.\nClick below to buy.",
      action: { label: "Buy Data", route: "/data" }
  },
  { 
      keywords: ['airtime', 'recharge', 'credit', 'vtu', 'kati', 'siyan kati'], 
      response: "Top up airtime instantly with discount. Click below.",
      action: { label: "Buy Airtime", route: "/airtime" }
  },
  { 
      keywords: ['crypto', 'bitcoin', 'usdt', 'trade', 'futures', 'leverage', 'short', 'long', 'canji'], 
      response: "Trade Crypto Pro! We offer **Spot** and **Futures (125x)**. Long or Short BTC/USDT now.",
      action: { label: "Go to Crypto", route: "/crypto" }
  },
  { 
      keywords: ['education', 'waec', 'neco', 'jamb', 'nabteb', 'result', 'checker', 'pin', 'exam'], 
      response: "Get Result Checker PINs for WAEC, NECO, JAMB instantly.",
      action: { label: "Buy Exam Pins", route: "/education" }
  },
  { 
      keywords: ['card', 'visa', 'mastercard', 'dollar', 'netflix', 'amazon', 'payment', 'kati na dollar'], 
      response: "Get a **Virtual Dollar Visa Card** for international payments (Netflix, AliExp, Amazon).",
      action: { label: "Get Virtual Card", route: "/virtual-cards" }
  },
  { 
      keywords: ['nin', 'nimc', 'identity', 'slip', 'verify', 'gyara', 'suna', 'date', 'birthday'], 
      response: "Official NIN Services:\n• **Validation**\n• **Print Slip** (Original)\n• **Modification** (Gyaran Suna/Date of Birth).",
      action: { label: "Open NIN Hub", route: "/nin-services" }
  },
  { 
      keywords: ['bvn', 'bank', 'verification', 'biometric'], 
      response: "Verify and print your BVN details securely from NIBSS.",
      action: { label: "BVN Services", route: "/bvn-services" }
  },
  { 
      keywords: ['loan', 'borrow', 'credit', 'bashi', 'aro'], 
      response: "Need quick cash (Bashi)? Check your eligibility for an instant loan.",
      action: { label: "Check Loans", route: "/loans" }
  },
  { 
      keywords: ['save', 'savings', 'interest', 'invest', 'ajiya'], 
      response: "Save money and earn up to **15% Interest**. SafeLock your funds.",
      action: { label: "Start Saving", route: "/savings" }
  },
  {
      keywords: ['support', 'help', 'human', 'error', 'failed', 'issue', 'matsala', 'admin'],
      response: "If you have an issue, please describe it. You can also contact Human Support below.",
      action: { label: "Contact Support", route: "/support" }
  }
];

const QUICK_PROMPTS = ["Sa Kudi", "Buy Data", "NIN Gyara", "Dollar Card", "Crypto"];

export default function CotexAIChat() {
    const router = useRouter(); 
    const navigation = useNavigation(); 

    const [messages, setMessages] = useState<any[]>([
        { id: '1', text: "Sannu! I am Cotex (Smart Admin). Ina jin Hausa & English. Ask me about Data, NIN, Funding, or Crypto.", sender: 'bot', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

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
            return { text: (bestMatch as any).response, action: (bestMatch as any).action };
        }
        return { 
            text: "Yi hakuri, ban fahimci abunda kake nufi ba sosai.\nKo kana nufin:\n• **Sa Kudi** (Funding)\n• **Siyan Data**\n• **NIN Services**\n\nRubuta 'Help' don ganin commands.", 
            action: undefined 
        };
    };

    const handleSend = (text: string = inputText) => {
        if (!text.trim()) return;

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
            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: response.text,
                sender: 'bot',
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                action: response.action
            };
            setMessages(prev => [...prev, botMsg]);
            setIsTyping(false);
        }, 1200);
    };

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages, isTyping]);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-50">
            {/* HEADER */}
            <LinearGradient
                colors={['#1e293b', '#0f172a']}
                className="pt-12 pb-4 px-4 rounded-b-3xl shadow-lg z-10"
            >
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="bg-white/10 p-2 rounded-full">
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View className="relative">
                            <View className="w-10 h-10 rounded-full bg-indigo-500 items-center justify-center border-2 border-white/20">
                                <Ionicons name="sparkles" size={20} color="white" />
                            </View>
                            <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-slate-900" />
                        </View>
                        <View>
                            <Text className="text-white font-bold text-lg">Cotex AI</Text>
                            <Text className="text-indigo-300 text-xs font-medium">Online • Smart Admin</Text>
                        </View>
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="ellipsis-vertical" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* CHAT AREA */}
            <ScrollView 
                ref={scrollViewRef}
                className="flex-1 px-4 pt-4"
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                <Text className="text-center text-slate-400 text-xs mb-4 uppercase tracking-widest font-bold">Today</Text>

                {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                        <View key={msg.id} className={"mb-4 flex-row " + (isUser ? 'justify-end' : 'justify-start')}>
                            {!isUser && (
                                <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2 mt-1">
                                    <Ionicons name="logo-android" size={16} color="#4f46e5" />
                                </View>
                            )}
                            
                            <View 
                                className={`p-3 rounded-2xl max-w-[80%] ${
                                    isUser 
                                    ? 'bg-indigo-600 rounded-tr-none' 
                                    : 'bg-white border border-slate-200 rounded-tl-none shadow-sm'
                                }`}
                            >
                                <Text className={`text-sm leading-5 ${isUser ? 'text-white' : 'text-slate-800'}`}>
                                    {msg.text}
                                </Text>
                                
                                {/* ACTION BUTTON */}
                                {msg.action && (
                                    <TouchableOpacity 
                                        onPress={() => router.push(msg.action?.route as any)}
                                        className="mt-3 bg-indigo-600 py-2 px-4 rounded-xl flex-row items-center justify-center"
                                    >
                                        <Text className="text-white font-bold text-xs">{msg.action.label}</Text>
                                        <Ionicons name="arrow-forward" size={14} color="white" style={{marginLeft: 4}} />
                                    </TouchableOpacity>
                                )}

                                <Text className={`text-[10px] mt-1 text-right ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {msg.time}
                                </Text>
                            </View>
                        </View>
                    );
                })}

                {isTyping && (
                    <View className="flex-row items-center mb-4">
                        <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2">
                             <Ionicons name="logo-android" size={16} color="#4f46e5" />
                        </View>
                        <View className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex-row gap-1">
                            <View className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                            <View className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75" />
                            <View className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150" />
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* QUICK PROMPTS */}
            {!isTyping && messages.length < 4 && (
                <View className="px-4 pb-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                        {QUICK_PROMPTS.map((prompt, i) => (
                            <TouchableOpacity 
                                key={i} 
                                onPress={() => handleSend(prompt)}
                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm active:bg-slate-50"
                            >
                                <Text className="text-slate-600 text-xs font-bold">{prompt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* INPUT AREA */}
            <View className="bg-white p-2 pb-6 border-t border-slate-100">
                <View className="flex-row items-center gap-2 bg-slate-50 px-2 py-1 rounded-full border border-slate-200">
                    <TouchableOpacity className="p-2 bg-slate-200 rounded-full">
                        <Ionicons name="add" size={20} color="#64748b" />
                    </TouchableOpacity>
                    
                    <TextInput 
                        className="flex-1 py-2 text-slate-800 font-medium max-h-20"
                        placeholder="Type a message..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        value={inputText}
                        onChangeText={setInputText}
                    />

                    <TouchableOpacity 
                        onPress={() => handleSend()}
                        disabled={inputText.trim().length === 0}
                        className="p-2 rounded-full items-center justify-center"
                        style={{
                            backgroundColor: inputText.trim().length > 0 ? '#4f46e5' : '#e2e8f0'
                        }}
                    >
                        <Ionicons name="send" size={20} color={inputText.trim().length > 0 ? "white" : "#94a3b8"} />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
