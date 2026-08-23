import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Dimensions, StyleSheet, StatusBar,
  Image, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { supabase } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

type Language = 'hausa' | 'english' | 'pidgin';

// ─── BILINGUAL & SMART KNOWLEDGE BASE ───────────────────────────────────────────
const KNOWLEDGE_BASE_DATA: Record<Language, Array<{ keywords: string[]; response: string; action?: { label: string; route: string; icon?: string } }>> = {
  hausa: [
    { 
      keywords: ['hello', 'hi', 'hey', 'start', 'sannu', 'slm', 'yaya', 'barka', 'inawuni', 'ina kwana', 'ina wuni'], 
      response: "Barka da zuwa, {{name}}! 👋\nNi ne **Cotex AI**, Mataimakin Abokan Ciniki na Abu Mafhal Sub.\n\n💰 Kudin Wallet ɗinka: **{{balance}}**\n\nTa yaya zan iya taimaka maka a yau?\n• 💳 **Sa Kudi A Wallet** (Bank Transfer)\n• 📶 **Siyan Data & Kati** (MTN, Airtel, Glo, 9mobile)\n• 📄 **Samun Shaida da Risiti** (Receipts)\n• ⚡ **Biya NEPA & Cable TV**\n• 💳 **Katin Dollar** (Virtual USD Card)\n• 🎓 **WAEC/NECO/JAMB Pins**\n• 🆔 **NIN & BVN Services**",
      action: undefined 
    },
    { 
      keywords: ['fund', 'deposit', 'money', 'wallet', 'add', 'kudi', 'sa kudi', 'sanya kudi', 'yaya ake sa kudi', 'ya zanyi fund', 'turasawa', 'transfer', 'monnify', 'payvessel'], 
      response: "Domin Sanya Kudi a Wallet dinka:\n\n1️⃣ Shiga shafin **Wallet**.\n2️⃣ Kwafi lambar asusunka na musamman (Monnify / Payvessel).\n3️⃣ Tura kudin daga kowane bank app; wallet dinka za ta karu nan take!\n\nKudin Wallet na yanzu: **{{balance}}**.",
      action: { label: "Bude Wallet / Sa Kudi", route: "/(app)/wallet", icon: "wallet-outline" }
    },
    { 
      keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'siyan data', 'sayan data', 'airtel', '9mobile', 'megabyte', 'gigabyte', 'gb', 'mb'], 
      response: "Muna sayar da Data a farashi mai sauƙi ga dukkan layuka (MTN, Airtel, Glo, 9mobile)! 🌐\n\nDanna maɓallin da ke ƙasa domin siyan Data cikin sauƙi.",
      action: { label: "Siyan Data Yanzu", route: "/data", icon: "wifi-outline" }
    },
    {
      keywords: ['airtime', 'recharge', 'card', 'kati', 'siyan kati', 'sayan kati', 'vtu'],
      response: "Kuna buƙatar Airtime? Muna ba da cikon VTU na take tare da ragi mai ban sha'awa a duk hanyoyin sadarwa. 📱",
      action: { label: "Siyan Kati Yanzu", route: "/airtime", icon: "phone-portrait-outline" }
    },
    { 
      keywords: ['receipt', 'evidence', 'biya', 'transaction', 'shaida', 'print', 'history', 'risiti', 'tarihi'], 
      response: "Zaka iya duba da kuma fitar da Shaida (Receipt) na kowane ciniki da ka yi a baya cikin sauƙi! 📄\n\nDanna ƙasa don duba Tarihin Ciniki da Buga Shaida.",
      action: { label: "Duba Tarihi & Shaida", route: "/history", icon: "receipt-outline" }
    },
    { 
      keywords: ['pending', 'wait', 'hold', 'fail', 'matsala', 'balance not added', 'delay', 'kudi basu shiga ba', 'ba a bani ba', 'network error'], 
      response: "Kayi hakuri game da jinkirin transaction ɗinka. 🔄\n\nZaka iya buɗe **Support Ticket** nan take domin wakilanmu na Live Support su duba tare da warware matsalar cikin gaggawa!",
      action: { label: "Bude Support Ticket", route: "/(app)/tickets", icon: "headset-outline" }
    },
    { 
      keywords: ['waec', 'neco', 'jamb', 'result', 'pin', 'checker', 'exam', 'karatu', 'nabteb'], 
      response: "Kuna buƙatar Result Checker Pin na WAEC, NECO ko JAMB? 🎓 Muna da su a shirye na take.\n\nDanna ƙasa domin siyan Result Pin.",
      action: { label: "Siyan Pins din Karatu", route: "/education", icon: "school-outline" }
    },
    { 
      keywords: ['cac', 'registration', 'business name', 'company', 'sajilar kamfani', 'sajila', 'sunan kamfani', 'incorporation'], 
      response: "Kuna buƙatar Yin Rajistar Kamfani ko Sunan Kasuwanci a hukumar CAC? 📜\n\nMuna taimaka muku yin rajistar Business Name ko Limited Company cikin sauƙi da sauri abun alfahari!\n\nDanna ƙasa don fara Rajistar CAC.",
      action: { label: "Rajistar CAC Yanzu", route: "/kyc", icon: "briefcase-outline" }
    },
    { 
      keywords: ['dollar', 'usd', 'virtual card', 'mastercard', 'visa', 'siyan kayan waje', 'online shopping'], 
      response: "Kuna son Katin Dollar (Virtual Dollar Card) domin siyan kayayyaki a yanar gizo (AliExpress, Facebook Ads, Netflix, ChatGPT)? 💳\n\nDanna ƙasa don buɗe Katin Dollar nan take.",
      action: { label: "Bude Virtual Dollar Card", route: "/virtual-cards", icon: "card-outline" }
    },
  ],
  english: [
    { 
      keywords: ['hello', 'hi', 'hey', 'start', 'welcome', 'good morning', 'good afternoon', 'good evening'], 
      response: "Welcome, {{name}}! 👋\nI am **Cotex AI**, your 24/7 Smart Virtual Assistant for Abu Mafhal Sub.\n\n💰 Wallet Balance: **{{balance}}**\n\nHow can I help you today?\n• 💳 **Wallet Funding** (Bank Transfer / Dedicated Accounts)\n• 📶 **Data & Airtime Purchase**\n• 📄 **Transaction History & Receipts**\n• ⚡ **Electricity (NEPA) & Cable TV**\n• 💳 **Virtual Dollar Card**\n• 🎓 **WAEC/NECO/NABTEB Pins**\n• 🆔 **NIN & BVN Verification**",
      action: undefined 
    },
    { 
      keywords: ['fund', 'deposit', 'money', 'wallet', 'add money', 'transfer', 'monnify', 'payvessel', 'topup'], 
      response: "To fund your wallet instantly:\n\n1️⃣ Navigate to the **Wallet** tab.\n2️⃣ Copy your dedicated Virtual Bank Account Number (Monnify / Payvessel).\n3️⃣ Send funds from any bank app — your wallet will credit in seconds!\n\nCurrent Balance: **{{balance}}**.",
      action: { label: "Go to Wallet", route: "/(app)/wallet", icon: "wallet-outline" }
    },
    { 
      keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'airtel', '9mobile', 'sme', 'gifting', 'corporate'], 
      response: "We offer the cheapest, highest speed data plans across all Nigerian networks (MTN, Airtel, Glo, 9mobile)! 🌐\n\nClick below to buy instant data.",
      action: { label: "Buy Cheap Data", route: "/data", icon: "wifi-outline" }
    },
    { 
      keywords: ['airtime', 'recharge', 'card', 'vtu', 'topup airtime'], 
      response: "Need instant airtime? Enjoy instant VTU top-up with exclusive discounts on all networks. 📱",
      action: { label: "Recharge Airtime", route: "/airtime", icon: "phone-portrait-outline" }
    },
    { 
      keywords: ['receipt', 'evidence', 'transaction', 'statement', 'history', 'invoice', 'proof'], 
      response: "You can download, view, and share clean official receipts for any previous transactions! 📄\n\nClick below to access your transaction history.",
      action: { label: "View Receipts", route: "/history", icon: "receipt-outline" }
    },
    { 
      keywords: ['pending', 'failed', 'issue', 'not received', 'delay', 'debited', 'network error'], 
      response: "We apologize for any transaction delay. 🔄\n\nYou can open an official **Support Ticket** right away to chat directly with our live human support agents.",
      action: { label: "Open Support Ticket", route: "/(app)/tickets", icon: "headset-outline" }
    },
  ],
  pidgin: [
    { 
      keywords: ['hello', 'hi', 'how far', 'wetin dey', 'bro', 'start'], 
      response: "How far {{name}}! 👋 Welcome!\nNa me be **Cotex AI**, your personal sharp assistant for Abu Mafhal Sub.\n\n💰 Your Wallet Balance: **{{balance}}**\n\nWetin you wan do today?\n• 💳 **Put Money for Wallet**\n• 📶 **Buy Cheap Data & Card**\n• 📄 **Check Transaction Receipts**\n• ⚡ **Pay NEPA & Cable TV**\n• 💳 **Get Virtual Dollar Card**",
      action: undefined 
    },
    { 
      keywords: ['fund', 'deposit', 'wallet', 'money', 'put money'], 
      response: "To put money for your wallet sharp-sharp:\n\n1️⃣ Open your **Wallet** tab.\n2️⃣ Copy your dedicated Bank Account number.\n3️⃣ Transfer money from your bank app, e go enter your wallet instantly!\n\nYour Balance: **{{balance}}**.",
      action: { label: "Fund Wallet Now", route: "/(app)/wallet", icon: "wallet-outline" }
    },
    { 
      keywords: ['data', 'internet', 'bundle', 'mtn', 'glo', 'airtel'], 
      response: "We get the cheapest data bundle for MTN, Airtel, Glo and 9mobile! 🌐\n\nClick below to buy sharp-sharp.",
      action: { label: "Buy Data", route: "/data", icon: "wifi-outline" }
    },
  ]
};

const QUICK_PROMPTS_BY_LANG: Record<Language, string[]> = {
  hausa: [
    "💳 Sa Kudi A Wallet", 
    "📶 Siyan Data", 
    "📱 Siyan Kati", 
    "📄 Shaida / Receipts", 
    "⚡ NEPA / Wuta", 
    "📺 Cable TV", 
    "🎓 WAEC/NECO Pin",
    "💳 Dollar Card",
    "📜 CAC Rajista",
    "👨‍💻 Support Ticket"
  ],
  english: [
    "💳 Fund Wallet",
    "📶 Buy Data Bundle",
    "📱 Recharge Airtime",
    "📄 Transaction Receipts",
    "⚡ Pay Electricity",
    "📺 Cable TV Sub",
    "💳 Dollar Card",
    "🎓 Exam Pins",
    "📜 CAC Registration",
    "👨‍💻 Open Support Ticket"
  ],
  pidgin: [
    "💳 Put Money for Wallet",
    "📶 Buy Cheap Data",
    "📱 Buy Card",
    "📄 Check Receipts",
    "⚡ Pay NEPA Light",
    "📺 Cable TV",
    "👨‍💻 Talk to Agent"
  ]
};

export default function CotexAIChat() {
  const router = useRouter(); 
  const navigation = useNavigation(); 
  const [userData, setUserData] = useState({ name: 'User', balance: '0.00' });
  const [language, setLanguage] = useState<Language>('hausa');

  const [messages, setMessages] = useState<any[]>([
    { 
      id: '1', 
      text: "Barka da zuwa! I am Cotex AI, your Smart Virtual Support Assistant. Zan iya taimaka maka wajen **Siyan Data**, **Sa Kudi (Funding)**, ko **Samun Shaida (Receipts)**.", 
      sender: 'bot', 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
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
            balance: '₦' + (Number(data.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }))
          });
        }
      }
    } catch (e) {
      console.log("Error fetching user data", e);
    }
  };

  const handleSpeak = (id: string, text: string) => {
    if (speakingId === id) {
      Speech.stop();
      setSpeakingId(null);
    } else {
      Speech.speak(text, {
        onStart: () => setSpeakingId(id),
        onDone: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    }
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, feedback: type } : msg
    ));
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", "Message copied to clipboard!");
  };

  const handleClearChat = () => {
    setMessages([
      { 
        id: Date.now().toString(), 
        text: "Chat cleared. Barka da zuwa! How can Cotex AI assist you?", 
        sender: 'bot', 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }
    ]);
  };

  const handleEscalateToTicket = () => {
    Alert.alert(
      "Connect with Human Agent",
      "Do you want to transfer this conversation to an official Live Support Ticket?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Open Ticket", 
          onPress: () => router.push('/(app)/tickets') 
        }
      ]
    );
  };

  const processResponseText = (text: string) => {
    return text.replace(/{{name}}/g, userData.name).replace(/{{balance}}/g, userData.balance);
  };

  const generateResponse = (text: string) => {
    const lowerText = text.toLowerCase();
    const currentKnowledge = KNOWLEDGE_BASE_DATA[language] || KNOWLEDGE_BASE_DATA.hausa;
    let bestMatch: any = null;
    let maxScore = 0;

    currentKnowledge.forEach(item => {
      let score = 0;
      item.keywords.forEach(word => {
        if (lowerText.includes(word)) score += 2;
      });
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    });

    if (bestMatch && maxScore > 0) {
      return {
        text: processResponseText(bestMatch.response),
        action: bestMatch.action
      };
    }

    const defaultFallback: Record<Language, string> = {
      hausa: `Na fahimci tambayarka game da "${text}". Don samun cikakken bayani na musamman, zaka iya danna maɓallin da ke ƙasa domin buɗe Support Ticket ga wakilanmu na Live Support!`,
      english: `I understand your question regarding "${text}". For personalized resolution, you can click below to connect with a Live Human Support Agent!`,
      pidgin: `I hear your matter about "${text}". Make you click below to open Live Support Ticket make our agent attend to you sharp-sharp!`
    };

    return {
      text: defaultFallback[language],
      action: { label: language === 'hausa' ? "Bude Support Ticket" : language === 'pidgin' ? "Open Support Ticket" : "Connect with Live Agent", route: "/(app)/tickets", icon: "headset-outline" }
    };
  };

  const handleSend = (textToSend?: string) => {
    const msg = textToSend || inputText.trim();
    if (!msg) return;

    if (!textToSend) setInputText('');
    const userMsgId = Date.now().toString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, {
      id: userMsgId,
      text: msg,
      sender: 'user',
      time: timeStr
    }]);

    setIsTyping(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    setTimeout(() => {
      const resp = generateResponse(msg);
      const botMsgId = (Date.now() + 1).toString();

      setMessages(prev => [...prev, {
        id: botMsgId,
        text: resp.text,
        action: resp.action,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      setIsTyping(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }, 550);
  };

  const quickPrompts = QUICK_PROMPTS_BY_LANG[language];

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* COMPACT ROYAL HEADER */}
      <View style={s.headerContainer}>
        <LinearGradient colors={['#0d1b3e', '#142258']} style={s.headerGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={16} color="#ffffff" />
          </TouchableOpacity>
          
          <View style={s.headerTitleBox}>
            <View style={s.aiAvatarBox}>
              <Ionicons name="sparkles" size={12} color="#f5a623" />
            </View>
            <View>
              <Text style={s.aiTitleText}>Cotex AI</Text>
              <View style={s.onlineRow}>
                <View style={s.onlineDot} />
                <Text style={s.onlineText}>Smart 24/7 Assistant</Text>
              </View>
            </View>
          </View>

          <View style={s.headerRightBox}>
            <TouchableOpacity onPress={handleEscalateToTicket} style={s.escalateBtn} activeOpacity={0.8}>
              <Ionicons name="headset" size={11} color="#0d1b3e" />
              <Text style={s.escalateBtnText}>Live Agent</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClearChat} style={s.trashBtn} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={14} color="#f87171" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* CLEAN LANGUAGE SELECTOR BAR */}
        <View style={s.langBar}>
          <Text style={s.langLabel}>Harshe / Lang:</Text>
          <View style={s.langPillsRow}>
            {[
              { id: 'hausa', label: '🇳🇬 Hausa' },
              { id: 'english', label: '🇬🇧 English' },
              { id: 'pidgin', label: '⚡ Pidgin' },
            ].map((l) => {
              const isLangActive = language === l.id;
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => setLanguage(l.id as Language)}
                  style={[s.langPill, isLangActive && s.langPillActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.langPillText, isLangActive && s.langPillTextActive]}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* LIGHT ELEGANT CHAT AREA */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.chatArea}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={s.messagesScroll}
          contentContainerStyle={s.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* USER WALLET MINI BADGE */}
          <View style={s.walletMiniBadgeWrap}>
            <View style={s.walletMiniBadge}>
              <Ionicons name="wallet-outline" size={12} color="#0d1b3e" />
              <Text style={s.walletMiniText}>Wallet Balance: <Text style={{ fontWeight: '800', color: '#0d1b3e' }}>{userData.balance}</Text></Text>
            </View>
          </View>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            
            if (isUser) {
              return (
                <View key={msg.id} style={s.userMsgRow}>
                  <LinearGradient colors={['#2563eb', '#1d4ed8']} style={s.userBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={s.userMsgText}>{msg.text}</Text>
                    <Text style={s.userTimeText}>{msg.time}</Text>
                  </LinearGradient>
                </View>
              );
            } else {
              return (
                <View key={msg.id} style={s.botMsgRow}>
                  <View style={s.botAvatarBox}>
                    <Ionicons name="sparkles" size={12} color="#f5a623" />
                  </View>
                  
                  <View style={s.botBubbleWrapper}>
                    <View style={s.botBubble}>
                      <TouchableOpacity 
                        onLongPress={() => handleCopy(msg.text)}
                        activeOpacity={0.9}
                      >
                        <Text style={s.botMsgText}>{msg.text}</Text>
                        
                        {/* COMPACT ACTION BUTTON */}
                        {msg.action && (
                          <TouchableOpacity 
                            onPress={() => router.push(msg.action?.route as any)}
                            style={s.actionBtn}
                            activeOpacity={0.8}
                          >
                            <View style={s.actionBtnLeft}>
                              <Ionicons name={(msg.action.icon || "flash") as any} size={12} color="#0d1b3e" style={{ marginRight: 5 }} />
                              <Text style={s.actionBtnText}>{msg.action.label}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color="#0d1b3e" />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>

                      {/* COMPACT MESSAGE TOOLBAR */}
                      <View style={s.msgToolbar}>
                        <View style={s.toolbarIcons}>
                          <TouchableOpacity onPress={() => handleSpeak(msg.id, msg.text)} style={s.toolIconBtn}>
                            <Ionicons name={speakingId === msg.id ? "volume-high" : "volume-medium-outline"} size={13} color={speakingId === msg.id ? "#f5a623" : "#64748b"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleCopy(msg.text)} style={s.toolIconBtn}>
                            <Ionicons name="copy-outline" size={12} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={s.toolbarFeedback}>
                          <TouchableOpacity onPress={() => handleFeedback(msg.id, 'up')} style={s.toolIconBtn}>
                            <Ionicons name={msg.feedback === 'up' ? "thumbs-up" : "thumbs-up-outline"} size={12} color={msg.feedback === 'up' ? "#10b981" : "#94a3b8"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleFeedback(msg.id, 'down')} style={s.toolIconBtn}>
                            <Ionicons name={msg.feedback === 'down' ? "thumbs-down" : "thumbs-down-outline"} size={12} color={msg.feedback === 'down' ? "#ef4444" : "#94a3b8"} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }
          })}

          {isTyping && (
            <View style={s.typingRow}>
              <View style={s.botAvatarBox}>
                <Ionicons name="sparkles" size={12} color="#f5a623" />
              </View>
              <View style={s.typingBubble}>
                <ActivityIndicator size="small" color="#0d1b3e" />
                <Text style={s.typingText}>Cotex AI is typing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* QUICK PROMPTS CHIPS */}
        <View style={s.quickPromptsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickPromptsContent}>
            {quickPrompts.map((prompt, i) => (
              <TouchableOpacity 
                key={i} 
                onPress={() => handleSend(prompt)}
                style={s.promptChip}
                activeOpacity={0.75}
              >
                <Ionicons name="flash" size={10} color="#f5a623" style={{ marginRight: 4 }} />
                <Text style={s.promptChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* COMPACT WHITE INPUT BAR */}
        <View style={s.inputContainer}>
          <View style={s.inputWrapper}>
            <TextInput 
              style={s.textInput}
              placeholder={language === 'hausa' ? "Rubuta tambayarka..." : language === 'pidgin' ? "Ask Cotex AI question..." : "Ask Cotex AI anything..."}
              placeholderTextColor="#94a3b8"
              multiline
              value={inputText}
              onChangeText={setInputText}
              selectionColor="#f5a623"
            />

            <TouchableOpacity 
              onPress={() => handleSend()}
              disabled={!inputText.trim()}
              style={s.sendBtn}
              activeOpacity={0.85}
            >
              <LinearGradient 
                colors={inputText.trim() ? ['#f5a623', '#d97706'] : ['#e2e8f0', '#cbd5e1']} 
                style={s.sendBtnGrad}
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }} 
              >
                <Ionicons name="arrow-up" size={15} color={inputText.trim() ? '#060d21' : '#94a3b8'} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d1b3e',
  },
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerGrad: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  aiAvatarBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitleText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  onlineText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '600',
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  escalateBtn: {
    backgroundColor: '#f5a623',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  escalateBtnText: {
    color: '#0d1b3e',
    fontWeight: '800',
    fontSize: 10,
  },
  trashBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBar: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  langLabel: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '700',
    marginRight: 6,
  },
  langPillsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  langPillActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderColor: '#f5a623',
  },
  langPillText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: '#b45309',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  walletMiniBadgeWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  walletMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  walletMiniText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  userMsgRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  userBubble: {
    maxWidth: '82%',
    borderRadius: 14,
    borderBottomRightRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  userMsgText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#ffffff',
    fontWeight: '500',
  },
  userTimeText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
    marginTop: 3,
  },
  botMsgRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    width: '100%',
  },
  botAvatarBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    marginTop: 2,
  },
  botBubbleWrapper: {
    flex: 1,
    maxWidth: '86%',
  },
  botBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderBottomLeftRadius: 2,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  botMsgText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '400',
  },
  actionBtn: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#0d1b3e',
    fontWeight: '800',
    fontSize: 11,
  },
  msgToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  toolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  toolIconBtn: {
    padding: 3,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  typingText: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
  },
  quickPromptsWrap: {
    paddingVertical: 5,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  quickPromptsContent: {
    paddingHorizontal: 10,
    gap: 6,
  },
  promptChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptChipText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  textInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 12.5,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxHeight: 70,
    fontWeight: '500',
  },
  sendBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendBtnGrad: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
