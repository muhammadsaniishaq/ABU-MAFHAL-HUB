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
import { useLocalSearchParams } from 'expo-router';

const { width: W } = Dimensions.get('window');

// ─── BILINGUAL & SMART KNOWLEDGE BASE FOR USERS ────────────────────────────────
const KNOWLEDGE_BASE = [
  { 
    keywords: ['hello', 'hi', 'hey', 'start', 'sannu', 'slm', 'yaya', 'barka', 'inawuni', 'ina kwana', 'ina wuni'], 
    response: "Barka da zuwa, {{name}}! 👋 Welcome!\nI am **Cotex AI**, your personal Virtual Customer Assistant for Abu Mafhal Sub.\n\n💰 Your Wallet Balance: **{{balance}}**\n\nHow can I help you today?\n• 💳 **Wallet Funding / Sa Kudi A Wallet**\n• 📶 **Data & Airtime / Siyan Data da Kati**\n• 📄 **Receipts & History / Samun Shaida da Tarihi**\n• ⚡ **NEPA & Cable TV / Biya Wuta da Cable**\n• 💳 **Virtual Dollar Card / Katin Dollar**\n• 🎓 **WAEC/NECO Pins / Pins din Karatu**\n• 🆔 **NIN & BVN Verification**",
    action: undefined 
  },
  { 
    keywords: ['fund', 'deposit', 'money', 'wallet', 'add', 'kudi', 'sa kudi', 'sanya kudi', 'yaya ake sa kudi', 'ya zanyi fund', 'turasawa', 'transfer', 'monnify', 'payvessel'], 
    response: "To fund your wallet (Domin Sanya Kudi A Wallet):\n\n1️⃣ Open **Wallet** tab.\n2️⃣ Copy your dedicated Bank Account Number (Monnify / Payvessel).\n3️⃣ Transfer money from any bank app & your wallet will be credited instantly!\n\nCurrent Balance: **{{balance}}**.",
    action: { label: "Fund Wallet / Sa Kudi", route: "/(app)/wallet" }
  },
  { 
    keywords: ['data', 'bundle', 'internet', 'browsing', 'mtn', 'glo', 'siyan data', 'sayan data', 'airtel', '9mobile', 'megabyte', 'gigabyte', 'gb', 'mb'], 
    response: "Muna sayar da Data a araha ga duk hanyoyin sadarwa (MTN, Airtel, Glo, 9mobile)! 🌐\n\nClick below to buy instant high-speed data now.",
    action: { label: "Buy Data / Siyan Data", route: "/data" }
  },
  {
    keywords: ['airtime', 'recharge', 'card', 'kati', 'siyan kati', 'sayan kati', 'vtu'],
    response: "Kuna buƙatar Airtime? Muna ba da cikon VTU na take tare da ragi mai ban mamaki a duk hanyoyin sadarwa. 📱",
    action: { label: "Buy Airtime / Siyan Kati", route: "/airtime" }
  },
  { 
    keywords: ['receipt', 'evidence', 'biya', 'transaction', 'shaida', 'print', 'history', 'risiti', 'tarihi'], 
    response: "Zaka iya samun da kuma fitar da Shaida (Receipt) na kowane ciniki da ka yi a baya cikin sauki! 📄\n\nClick below to view your Transaction History & Print Receipts.",
    action: { label: "Get Receipts / Samun Shaida", route: "/history" }
  },
  { 
    keywords: ['pending', 'wait', 'hold', 'fail', 'matsala', 'balance not added', 'delay', 'kudi basu shiga ba', 'ba a bani ba', 'network error'], 
    response: "Sanyi mu hakuri game da jinkirin transaction ɗinka. 🔄\n\nDa fatan zaka duba **Transaction History** dinka ko ka buɗe **Support Ticket** idan kudi suka fita amma basu isa ba. Muna gyarawa cikin mintuna kadan!",
    action: { label: "Open Ticket / Bude Ticket", route: "/(app)/tickets" }
  },
  { 
    keywords: ['waec', 'neco', 'jamb', 'result', 'pin', 'checker', 'exam', 'karatu', 'nortification'], 
    response: "Kuna buƙatar Result Checker Pin na WAEC, NECO ko JAMB? 🎓 Muna da su a shirye na take.\n\nClick below to buy your exam pin.",
    action: { label: "Buy Edu Pins / Pins din Karatu", route: "/education" }
  },
  { 
    keywords: ['cac', 'registration', 'business name', 'company', 'sajilar kamfani', 'sajila', 'sunan kamfani', 'incorporation', 'bn', 'rc'], 
    response: "Kuna buƙatar Yin Rajistar Kamfani ko Sunan Kasuwanci a hukumar CAC (Corporate Affairs Commission)? 📜\n\nMuna taimaka muku yin rajistar Business Name ko Limited Company cikin sauki da sauri abun alfahari!\n\nClick below to start your CAC Registration.",
    action: { label: "CAC Registration / Rajistar CAC", route: "/kyc" }
  },
  { 
    keywords: ['crypto', 'bitcoin', 'usdt', 'trading', 'deriv', 'coin', 'trade', 'siyan crypto', 'sayar da crypto', 'ethereum', 'binance'], 
    response: "Kuna son siyan ko sayar da Crypto (USDT, Bitcoin, Ethereum) ko yin Trading a Deriv? 🪙\n\nMuna ba da hanzari wajen siyan Crypto da biyan kudi cikin sakanni.\n\nClick below to access Crypto Trading.",
    action: { label: "Crypto Trading / Kasuwancin Crypto", route: "/crypto" }
  },
  { 
    keywords: ['boost', 'social', 'followers', 'likes', 'views', 'tiktok', 'instagram', 'facebook', 'youtube', '9boost', 'shafuka'], 
    response: "Kuna son haɓaka shafukan sadarwa (Increase Instagram/TikTok Followers, Likes, Views & Engagement)? 🚀\n\nMuna ba da sabis na Social Boost na take!",
    action: { label: "Social Boost / Boost Shafuka", route: "/social-boost" }
  },
  { 
    keywords: ['save', 'savings', 'invest', 'investment', 'ajiye kudi', 'ribar kudi', 'interest'], 
    response: "Kuna son ajiye kuɗi (Savings) domin samun riba mai yawa a kowace rana? 💰\n\nAjiye kuɗinku cikin aminci tare da tsarin Savings ɗinmu.",
    action: { label: "Savings & Investment", route: "/savings" }
  },
  { 
    keywords: ['airtime to cash', 'kati zuwa kudi', 'mayar da kati', 'convert airtime'], 
    response: "Kuna da katin waya (Airtime) da kuke son maidawa kudi a asusunku na banki? 📲\n\nMuna maida Airtime zuwa Cash cikin mintuna biyar!",
    action: { label: "Airtime to Cash / Kati Zuwa Kudi", route: "/airtime-to-cash" }
  },
  { 
    keywords: ['dollar', 'usd', 'virtual card', 'mastercard', 'visa', 'siyan kayan waje', 'online shopping'], 
    response: "Kuna son Katin Dollar (Virtual Dollar Card) domin siyan kayayyaki a yanar gizo (AliExpress, Facebook Ads, Netflix, ChatGPT)? 💳\n\nClick below to create your instant Virtual Dollar Card.",
    action: { label: "Virtual Card / Katin Dollar", route: "/virtual-cards" }
  },
  { 
    keywords: ['nin', 'bvn', 'slip', 'identity', 'verification', 'tattace', 'katartattace', 'sunan nin'], 
    response: "Kuna buƙatar Tantance NIN, BVN ko Buga NIN Slip? 🆔 Muna ba da ingantaccen sabis na gaggawa.",
    action: { label: "NIN/BVN Verification", route: "/nin-services" }
  },
  { 
    keywords: ['loan', 'borrow', 'credit', 'bashi', 'aro'], 
    response: "Kuna buƙatar bashi na gaggawa, {{name}}? 💸 Duba cancantar ku don samun rance na take yanzu.",
    action: { label: "Check Loans", route: "/loans" }
  },
  {
    keywords: ['balance', 'how much', 'nawa', 'kudi na', 'check balance', 'raga'],
    response: "Asusunka na dauke da **{{balance}}** a yanzu. 💰 Shin kuna son sanya kudi?",
    action: { label: "View Wallet / Kalli Wallet", route: "/(app)/wallet" }
  },
  {
    keywords: ['electricity', 'wuta', 'nepa', 'meter', 'token', 'kedco', 'aedc', 'ikedc', 'phcn'],
    response: "Biya kudin wutar lantarki na gaggawa! ⚡ Muna goyon bayan AEDC, KEDCO, IKEDC da sauransu. Samun Meter Token cikin dakika biyu.",
    action: { label: "Pay Electricity / Biya Wuta", route: "/bills" }
  },
  {
    keywords: ['cable', 'tv', 'dstv', 'gotv', 'startimes', 'kallo'],
    response: "Biya kallo na DSTV, GOtv, da StarTimes nan take! 📺 Samun kallo ba tare da tsayawa ba.",
    action: { label: "Pay Cable TV", route: "/bills" }
  },
  {
    keywords: ['help', 'support', 'taimako', 'admin', 'human', 'magana'],
    response: "Zan iya taimaka muku wajen:\n• 💳 **Wallet Funding (Sa Kudi)**\n• 📶 **Data/Airtime (Kati & Data)**\n• 📄 **Receipts (Shaida)**\n• 🎓 **WAEC/NECO Pins**\n• 🆔 **NIN & BVN**\n\nKuna son buɗe Support Ticket don magana da Admin kai tsaye? 👩‍💻",
    action: { label: "Open Ticket / Bude Ticket", route: "/(app)/tickets" }
  }
];

const QUICK_PROMPTS = [
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
  "🚀 Social Boost",
  "🆔 NIN / BVN", 
  "👨‍💻 Support Ticket"
];

export default function CotexAIChat() {
  const router = useRouter(); 
  const navigation = useNavigation(); 
  const [userData, setUserData] = useState({ name: 'User', balance: '0.00' });

  const [messages, setMessages] = useState<any[]>([
    { 
      id: '1', 
      text: "Barka da zuwa! I am Cotex AI, your Customer Support Assistant for Abu Mafhal Sub. Zan iya taimaka maka wajen **Siyan Data**, **Sa Kudi (Funding)**, ko **Samun Shaida (Receipts)**.", 
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

  const processResponseText = (text: string) => {
    return text.replace(/{{name}}/g, userData.name).replace(/{{balance}}/g, userData.balance);
  };

  const generateResponse = (text: string) => {
    const lowerText = text.toLowerCase();
    let bestMatch: any = null;
    let maxScore = 0;

    KNOWLEDGE_BASE.forEach(item => {
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

    return {
      text: `Na fahimci tambayarka game da "${text}". Don samun cikakken taimako na musamman, zaka iya danna maɓallin da ke ƙasa domin buɗe Support Ticket ga wakilanmu na Live Support!`,
      action: { label: "Open Support Ticket", route: "/(app)/tickets" }
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
    }, 700);
  };

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
                <Text style={s.onlineText}>Smart Assistant • Live</Text>
              </View>
            </View>
          </View>

          <View style={s.headerRightBox}>
            <View style={s.walletPill}>
              <Ionicons name="wallet-outline" size={11} color="#f5a623" style={{ marginRight: 3 }} />
              <Text style={s.walletPillText}>{userData.balance}</Text>
            </View>
            <TouchableOpacity onPress={handleClearChat} style={s.trashBtn} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
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
                <Text style={s.typingText}>Cotex AI is thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* QUICK PROMPTS CAROUSEL */}
        <View style={s.quickPromptsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickPromptsContent}>
            {QUICK_PROMPTS.map((prompt, i) => (
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
              placeholder="Ask Cotex AI in Hausa or English..."
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
                colors={inputText.trim() ? ['#f5a623', '#d97706'] : ['#334155', '#1e293b']} 
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
    gap: 8,
  },
  walletPill: {
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletPillText: {
    color: '#f5a623',
    fontWeight: '800',
    fontSize: 11,
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
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
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
