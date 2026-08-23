import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, Image, StyleSheet, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';

const { width: W } = Dimensions.get('window');

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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={s.container}
    >
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ 
        title: ticketDetails?.subject || 'Live Support Chat',
        headerShown: true,
        headerStyle: { backgroundColor: '#060d21' },
        headerTintColor: '#f5a623',
        headerTitleStyle: { fontWeight: '900', fontSize: 15 },
        headerRight: () => (
          <View style={s.headerLiveBadge}>
            <View style={s.liveGreenDot} />
            <Text style={s.liveGreenText}>Live Agent</Text>
          </View>
        )
      }} />

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={s.loadingText}>Loading conversation...</Text>
        </View>
      ) : (
        <>
          {/* TICKET DETAILS HEADER BANNER */}
          <View style={s.ticketBanner}>
            <View style={s.ticketBannerLeft}>
              <View style={s.ticketIconCircle}>
                <Ionicons name="headset" size={13} color="#f5a623" />
              </View>
              <Text style={s.ticketBannerTitle} numberOfLines={1}>
                #{id ? (id as string).split('-')[0].toUpperCase() : ''} • {ticketDetails?.subject || 'Live Ticket'}
              </Text>
            </View>
            <TouchableOpacity onPress={fetchMessages} style={s.refreshBtn}>
              <Ionicons name="refresh-outline" size={15} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* MESSAGES LIST */}
          <ScrollView 
            ref={scrollViewRef}
            style={s.messagesScroll} 
            contentContainerStyle={s.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length > 0 ? (
              messages.map((m) => {
                const isUser = m.sender_id === userId;
                const isImage = m.message.startsWith('[IMAGE]');
                const imageUrl = isImage ? m.message.replace('[IMAGE]', '').trim() : null;

                return (
                  <View key={m.id} style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAgent]}>
                    {!isUser && (
                      <View style={s.agentAvatarCircle}>
                        <Ionicons name="shield-checkmark" size={12} color="#f5a623" />
                      </View>
                    )}

                    <View style={[s.msgBubble, isUser ? s.msgBubbleUser : s.msgBubbleAgent]}>
                      {!isUser && (
                        <View style={s.agentHeaderLine}>
                          <Ionicons name="headset" size={11} color="#f5a623" style={{ marginRight: 4 }} />
                          <Text style={s.agentLabel}>Customer Support Agent</Text>
                        </View>
                      )}

                      <TouchableOpacity onLongPress={() => handleCopy(m.message)} activeOpacity={0.9}>
                        {isImage && imageUrl ? (
                          <Image 
                            source={{ uri: imageUrl }} 
                            style={s.msgImage}
                            resizeMode="cover" 
                          />
                        ) : (
                          <Text style={[s.msgText, isUser ? s.msgTextUser : s.msgTextAgent]}>
                            {m.message}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <View style={s.msgFooter}>
                        <Text style={s.msgTimeText}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isUser && (
                          <Ionicons name="checkmark-done" size={13} color="#60a5fa" style={{ marginLeft: 4 }} />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={s.emptyChatBox}>
                <View style={s.emptyChatIconCircle}>
                  <Ionicons name="chatbubbles-outline" size={30} color="#f5a623" />
                </View>
                <Text style={s.emptyChatTitle}>Support Chat Ready</Text>
                <Text style={s.emptyChatDesc}>
                  Type your message below. A customer support agent will reply to your ticket in real-time.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* COMPACT INPUT BAR */}
          <View style={s.inputContainer}>
            <View style={s.inputWrapper}>
              <TouchableOpacity 
                onPress={pickImage} 
                style={s.attachBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="attach" size={18} color="#f5a623" />
              </TouchableOpacity>

              <TextInput
                placeholder="Type your message..."
                placeholderTextColor="#64748b"
                style={s.textInput}
                value={reply}
                onChangeText={setReply}
                multiline
                selectionColor="#f5a623"
              />

              <TouchableOpacity
                onPress={() => sendMessage()}
                disabled={sending || !reply.trim()}
                style={s.sendBtn}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={sending || !reply.trim() ? ['#334155', '#1e293b'] : ['#f5a623', '#d97706']}
                  style={s.sendBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {sending ? (
                    <ActivityIndicator color="#060d21" size="small" />
                  ) : (
                    <Ionicons name="paper-plane" size={15} color={!reply.trim() ? '#94a3b8' : '#060d21'} style={{ marginLeft: 2 }} />
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

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040814',
  },
  headerLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  liveGreenText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 10.5,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  ticketBanner: {
    backgroundColor: '#060d21',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  ticketIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ticketBannerTitle: {
    color: '#f8fafc',
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    paddingBottom: 24,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 14,
    width: '100%',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAgent: {
    justifyContent: 'flex-start',
  },
  agentAvatarCircle: {
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
  msgBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  msgBubbleUser: {
    backgroundColor: '#1d4ed8',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  msgBubbleAgent: {
    backgroundColor: '#09132e',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  agentHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.6)',
  },
  agentLabel: {
    color: '#f5a623',
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  msgText: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  msgTextUser: {
    color: '#ffffff',
  },
  msgTextAgent: {
    color: '#f1f5f9',
  },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#1e293b',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  msgTimeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyChatIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0c1633',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyChatTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 6,
  },
  emptyChatDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
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
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#09132e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxHeight: 90,
    fontWeight: '500',
  },
  sendBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendBtnGrad: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
