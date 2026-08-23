import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Dimensions, StyleSheet, StatusBar,
  Image, ActivityIndicator, Modal
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

// ─── BILINGUAL & SMART KNOWLEDGE BASE FOR USERS ────────────────────────────────
const KNOWLEDGE_BASE_DATA: Record<Language, Array<{ keywords: string[]; response: string; action?: { label: string; route: string } }>> = {
  hausa: [
    { 
      keywords: ['hello', 'hi', 'hey', 'start', 'sannu', 'slm', 'yaya', 'barka', 'inawuni', 'ina kwana', 'ina wuni'], 
      response: "Barka da zuwa, {{name}}! 👋\nNi ne **Cotex AI**, Mataimakin Abokan Ciniki na Abu Mafhal Sub.\n\n💰 Kudin Wallet ɗinka: **{{balance}}**\n\nTa yaya zan iya taimaka maka a yau?\n• 💳 **Sa Kudi A Wallet (Wallet Funding)**\n• 📶 **Siyan Data & Kati (Airtime)**\n• 📄 **Samun Shaida da Tarihi (Receipts)**\n• ⚡ **Biya NEPA & Cable TV**\n• 💳 **Katin Dollar (Virtual Card)**\n• 🎓 **WAEC/NECO Pins**\n• 🆔 **NIN & BVN Services**",
      action: undefined 
    },
    { 
      keywords: ['fund', 'deposit', 'money', 'wallet', 'add', 'kudi', 'sa kudi', 'sanya kudi', 'yaya ake sa kudi', 'ya zanyi fund', 'turasawa', 'transfer', 'monnify', 'payvessel'], 
      response: "Domin Sanya Kudi a Wallet dinka (Wallet Funding):\n\n1️⃣ Shiga shafin **Wallet**.\n2️⃣ Kwafi lambar asusunka na banki (Monnify / Payvessel).\n3️⃣ Tura kudin daga kowane bank app; wallet dinka za ta karu nan take!\n\nKudin Wallet na yanzu: **{{balance}}**.",
      action: { label: "Bude Wallet / Sa Kudi", route: "/(app)/wallet" }
    },
    { 
      keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'siyan data', 'sayan data', 'airtel', '9mobile', 'megabyte', 'gigabyte', 'gb', 'mb'], 
      response: "Muna sayar da Data a araha ga duk hanyoyin sadarwa (MTN, Airtel, Glo, 9mobile)! 🌐\n\nDanna maɓallin da ke ƙasa domin siyan Data cikin sauƙi.",
      action: { label: "Siyan Data Yanzu", route: "/data" }
    },
    {
      keywords: ['airtime', 'recharge', 'card', 'kati', 'siyan kati', 'sayan kati', 'vtu'],
      response: "Kuna buƙatar Airtime? Muna ba da cikon VTU na take tare da ragi mai ban mamaki a duk hanyoyin sadarwa. 📱",
      action: { label: "Siyan Kati Yanzu", route: "/airtime" }
    },
    { 
      keywords: ['receipt', 'evidence', 'biya', 'transaction', 'shaida', 'print', 'history', 'risiti', 'tarihi'], 
      response: "Zaka iya samun da kuma fitar da Shaida (Receipt) na kowane ciniki da ka yi a baya cikin sauki! 📄\n\nDanna ƙasa don duba Tarihin Ciniki da Buga Shaida.",
      action: { label: "Duba Tarihi & Shaida", route: "/history" }
    },
    { 
      keywords: ['pending', 'wait', 'hold', 'fail', 'matsala', 'balance not added', 'delay', 'kudi basu shiga ba', 'ba a bani ba', 'network error'], 
      response: "Kayi hakuri game da jinkirin transaction ɗinka. 🔄\n\nZaka iya buɗe **Support Ticket** nan take domin wakilanmu na Live Support su duba tare da warware matsalar cikin mintuna!",
      action: { label: "Bude Support Ticket", route: "/(app)/tickets" }
    },
    { 
      keywords: ['waec', 'neco', 'jamb', 'result', 'pin', 'checker', 'exam', 'karatu'], 
      response: "Kuna buƙatar Result Checker Pin na WAEC, NECO ko JAMB? 🎓 Muna da su a shirye na take.\n\nDanna ƙasa domin siyan Result Pin.",
      action: { label: "Siyan Pins din Karatu", route: "/education" }
    },
    { 
      keywords: ['cac', 'registration', 'business name', 'company', 'sajilar kamfani', 'sajila', 'sunan kamfani', 'incorporation'], 
      response: "Kuna buƙatar Yin Rajistar Kamfani ko Sunan Kasuwanci a hukumar CAC? 📜\n\nMuna taimaka muku yin rajistar Business Name ko Limited Company cikin sauki da sauri abun alfahari!\n\nDanna ƙasa don fara Rajistar CAC.",
      action: { label: "Rajistar CAC Yanzu", route: "/kyc" }
    },
    { 
      keywords: ['dollar', 'usd', 'virtual card', 'mastercard', 'visa', 'siyan kayan waje', 'online shopping'], 
      response: "Kuna son Katin Dollar (Virtual Dollar Card) domin siyan kayayyaki a yanar gizo (AliExpress, Facebook Ads, Netflix, ChatGPT)? 💳\n\nDanna ƙasa don buɗe Katin Dollar nan take.",
      action: { label: "Bude Virtual Dollar Card", route: "/virtual-cards" }
    },
  ],
  english: [
    { 
      keywords: ['hello', 'hi', 'hey', 'start', 'welcome', 'good morning', 'good afternoon', 'good evening'], 
      response: "Welcome, {{name}}! 👋\nI am **Cotex AI**, your 24/7 Smart Virtual Customer Assistant for Abu Mafhal Sub.\n\n💰 Current Wallet Balance: **{{balance}}**\n\nHow can I help you today?\n• 💳 **Wallet Funding** (Bank Transfer / Cards)\n• 📶 **Data & Airtime Purchase**\n• 📄 **Transaction History & Receipts**\n• ⚡ **Electricity (NEPA) & Cable TV**\n• 💳 **Virtual Dollar Card**\n• 🎓 **WAEC/NECO/NABTEB Pins**\n• 🆔 **NIN & BVN Verification**",
      action: undefined 
    },
    { 
      keywords: ['fund', 'deposit', 'money', 'wallet', 'add money', 'transfer', 'monnify', 'payvessel', 'topup'], 
      response: "To fund your wallet instantly:\n\n1️⃣ Navigate to the **Wallet** tab.\n2️⃣ Copy your dedicated Virtual Bank Account Number (Monnify / Payvessel).\n3️⃣ Send funds from any bank app — your wallet will credit in seconds!\n\nCurrent Balance: **{{balance}}**.",
      action: { label: "Go to Wallet", route: "/(app)/wallet" }
    },
    { 
      keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'airtel', '9mobile', 'sme', 'gifting', 'corporate'], 
      response: "We offer the cheapest, highest speed data plans across all Nigerian networks (MTN, Airtel, Glo, 9mobile)! 🌐\n\nClick below to buy instant data.",
      action: { label: "Buy Cheap Data", route: "/data" }
    },
    { 
      keywords: ['airtime', 'recharge', 'card', 'vtu', 'topup airtime'], 
      response: "Need instant airtime? Enjoy instant VTU top-up with exclusive discounts on all networks. 📱",
      action: { label: "Recharge Airtime", route: "/airtime" }
    },
    { 
      keywords: ['receipt', 'evidence', 'transaction', 'statement', 'history', 'invoice', 'proof'], 
      response: "You can download, view, and share clean official receipts for any previous transactions! 📄\n\nClick below to access your transaction history.",
      action: { label: "View Receipts", route: "/history" }
    },
    { 
      keywords: ['pending', 'failed', 'issue', 'not received', 'delay', 'debited', 'network error'], 
      response: "We apologize for any transaction delay. 🔄\n\nYou can open an official **Support Ticket** right away to chat directly with our live human support agents.",
      action: { label: "Open Support Ticket", route: "/(app)/tickets" }
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
      action: { label: "Fund Wallet Now", route: "/(app)/wallet" }
    },
    { 
      keywords: ['data', 'internet', 'bundle', 'mtn', 'glo', 'airtel'], 
      response: "We get the cheapest data bundle for MTN, Airtel, Glo and 9mobile! 🌐\n\nClick below to buy sharp-sharp.",
      action: { label: "Buy Data", route: "/data" }
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
    "🪙 Crypto Trade",
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
    Alert.alert("Copied", "Copied to clipboard!");
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
      action: { label: language === 'hausa' ? "Bude Support Ticket" : language === 'pidgin' ? "Open Support Ticket" : "Connect with Live Agent", route: "/(app)/tickets" }
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
    }, 600);
  };

  const quickPrompts = QUICK_PROMPTS_BY_LANG[language];

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* HEADER BAR */}
      <View style={s.headerContainer}>
        <LinearGradient colors={['#060d21', '#0b132b']} style={s.headerGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={18} color="#f5a623" />
          </TouchableOpacity>
          
          <View style={s.headerTitleBox}>
            <View style={s.aiAvatarBox}>
              <Ionicons name="sparkles" size={13} color="#f5a623" />
            </View>
            <View>
              <Text style={s.aiTitleText}>Cotex AI</Text>
              <View style={s.onlineRow}>
                <View style={s.onlineDot} />
                <Text style={s.onlineText}>24/7 Smart Assistant</Text>
              </View>
            </View>
          </View>

          <View style={s.headerRightBox}>
            <TouchableOpacity onPress={handleEscalateToTicket} style={s.escalateBtn} activeOpacity={0.8}>
              <Ionicons name="headset" size={12} color="#060d21" />
              <Text style={s.escalateBtnText}>Human Agent</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClearChat} style={s.trashBtn} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* LANGUAGE SWITCHER BAR */}
        <View style={s.langBar}>
          <Text style={s.langLabel}>Language:</Text>
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

      {/* CHAT AREA */}
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
          <View style={s.dateDividerWrap}>
            <View style={s.dateDividerBadge}>
              <Text style={s.dateDividerText}>
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            
            if (isUser) {
              return (
                <View key={msg.id} style={s.userMsgRow}>
                  <LinearGradient colors={['#1d4ed8', '#1e40af']} style={s.userBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={s.userMsgText}>{msg.text}</Text>
                    <Text style={s.userTimeText}>{msg.time}</Text>
                  </LinearGradient>
                </View>
              );
            } else {
              return (
                <View key={msg.id} style={s.botMsgRow}>
                  <View style={s.botAvatarBox}>
                    <Ionicons name="sparkles" size={13} color="#f5a623" />
                  </View>
                  
                  <View style={s.botBubbleWrapper}>
                    <View style={s.botBubble}>
                      <TouchableOpacity 
                        onLongPress={() => handleCopy(msg.text)}
                        activeOpacity={0.9}
                      >
                        <Text style={s.botMsgText}>{msg.text}</Text>
                        
                        {/* SMART ACTION BUTTON */}
                        {msg.action && (
                          <TouchableOpacity 
                            onPress={() => router.push(msg.action?.route as any)}
                            style={s.actionBtn}
                            activeOpacity={0.8}
                          >
                            <View style={s.actionBtnLeft}>
                              <Ionicons name="flash" size={13} color="#f5a623" style={{ marginRight: 6 }} />
                              <Text style={s.actionBtnText}>{msg.action.label}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={13} color="#f5a623" />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>

                      {/* MESSAGE TOOLBAR */}
                      <View style={s.msgToolbar}>
                        <View style={s.toolbarIcons}>
                          <TouchableOpacity onPress={() => handleSpeak(msg.id, msg.text)} style={s.toolIconBtn}>
                            <Ionicons name={speakingId === msg.id ? "volume-high" : "volume-medium-outline"} size={14} color={speakingId === msg.id ? "#f5a623" : "#64748b"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleCopy(msg.text)} style={s.toolIconBtn}>
                            <Ionicons name="copy-outline" size={13} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={s.toolbarFeedback}>
                          <TouchableOpacity onPress={() => handleFeedback(msg.id, 'up')} style={s.toolIconBtn}>
                            <Ionicons name={msg.feedback === 'up' ? "thumbs-up" : "thumbs-up-outline"} size={13} color={msg.feedback === 'up' ? "#10b981" : "#64748b"} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleFeedback(msg.id, 'down')} style={s.toolIconBtn}>
                            <Ionicons name={msg.feedback === 'down' ? "thumbs-down" : "thumbs-down-outline"} size={13} color={msg.feedback === 'down' ? "#ef4444" : "#64748b"} />
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
                <Ionicons name="sparkles" size={13} color="#f5a623" />
              </View>
              <View style={s.typingBubble}>
                <ActivityIndicator size="small" color="#f5a623" />
                <Text style={s.typingText}>Cotex AI is responding...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* QUICK PROMPTS CAROUSEL */}
        <View style={s.quickPromptsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickPromptsContent}>
            {quickPrompts.map((prompt, i) => (
              <TouchableOpacity 
                key={i} 
                onPress={() => handleSend(prompt)}
                style={s.promptChip}
                activeOpacity={0.75}
              >
                <Ionicons name="flash" size={11} color="#f5a623" style={{ marginRight: 4 }} />
                <Text style={s.promptChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* FLOATING COMPACT INPUT BAR */}
        <View style={s.inputContainer}>
          <View style={s.inputWrapper}>
            <TextInput 
              style={s.textInput}
              placeholder={language === 'hausa' ? "Rubuta tambayarka ga Cotex AI..." : language === 'pidgin' ? "Ask Cotex AI any question..." : "Ask Cotex AI anything..."}
              placeholderTextColor="#64748b"
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
                colors={inputText.trim() ? ['#f5a623', '#d97706']} 
                style={s.sendBtnGrad}
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }} 
              >
                <Ionicons name="arrow-up" size={17} color={inputText.trim() ? '#060d21' : '#64748b'} />
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
    backgroundColor: '#040814',
  },
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerGrad: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitleText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  onlineText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  escalateBtn: {
    backgroundColor: '#f5a623',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  escalateBtnText: {
    color: '#060d21',
    fontWeight: '900',
    fontSize: 10.5,
  },
  trashBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBar: {
    backgroundColor: '#060d21',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.6)',
  },
  langLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginRight: 8,
  },
  langPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  langPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  langPillActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.18)',
    borderColor: '#f5a623',
  },
  langPillText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: '#f5a623',
  },
  chatArea: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  dateDividerWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  dateDividerBadge: {
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dateDividerText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userMsgRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  userMsgText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#ffffff',
    fontWeight: '500',
  },
  userTimeText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'right',
    marginTop: 4,
  },
  botMsgRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 14,
    width: '100%',
  },
  botAvatarBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  botBubbleWrapper: {
    flex: 1,
    maxWidth: '86%',
  },
  botBubble: {
    backgroundColor: '#09132e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  botMsgText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#f1f5f9',
    fontWeight: '400',
  },
  actionBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#f5a623',
    fontWeight: '800',
    fontSize: 12,
  },
  msgToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.7)',
  },
  toolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolIconBtn: {
    padding: 4,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09132e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  quickPromptsWrap: {
    paddingVertical: 6,
    backgroundColor: 'rgba(4, 8, 20, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
  },
  quickPromptsContent: {
    paddingHorizontal: 10,
    gap: 7,
  },
  promptChip: {
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: '#060d21',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1633',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13.5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxHeight: 85,
    fontWeight: '500',
  },
  sendBtn: {
    borderRadius: 17,
    overflow: 'hidden',
  },
  sendBtnGrad: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
