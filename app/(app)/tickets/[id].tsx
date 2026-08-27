import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, Image, StyleSheet, Dimensions, StatusBar,
  Modal, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';

const { width: W } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Light Luxury Executive Design Tokens
const L = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  navyHeader: '#0F172A',
  navyMid: '#1E293B',
  gold: '#FFD700',
  goldDk: '#DAA520',
  goldAmber: '#D97706',
  goldLight: '#FEF3C7',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  emerald: '#10B981',
  emeraldBg: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  sky: '#0EA5E9',
  skyBg: '#F0F9FF',
  coral: '#EF4444',
  coralBg: '#FFF1F2',
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

const QUICK_RESPONSES = [
  "Payment receipt attached 📄",
  "Checking my bank app now ⏳",
  "Verified and working, thank you! 👍",
  "Please re-check the account 🔍",
];

export default function UserTicketChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setupChat();

    // Realtime Subscription for Live Messages & Status Updates
    if (id) {
      const msgChannel = supabase
        .channel(`ticket_chat:${id}`)
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

      const ticketChannel = supabase
        .channel(`ticket_status:${id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${id}`
        }, (payload) => {
          if (payload.new) {
            setTicketDetails(payload.new);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(msgChannel);
        supabase.removeChannel(ticketChannel);
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

  const handleMarkResolved = async () => {
    Alert.alert(
      "Mark Ticket as Resolved",
      "Are you satisfied with the resolution and wish to close this ticket?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Resolve & Rate", 
          onPress: async () => {
            try {
              await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
              await sendMessage("✅ User marked this ticket as Resolved.");
              fetchTicketDetails();
              setShowRatingModal(true);
            } catch (e) {}
          }
        }
      ]
    );
  };

  const submitRating = async () => {
    try {
      await sendMessage(`⭐ Satisfaction Rating: ${rating}/5 Stars. ${feedbackComment.trim() ? `Feedback: "${feedbackComment.trim()}"` : ''}`);
      setShowRatingModal(false);
      Alert.alert("Thank You! 🎉", "Your feedback helps us continuously improve our service.");
    } catch (e) {}
  };

  const pickImage = async () => {
    if (!userId || !id) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert("Permission Required", "Please grant access to your photo library to attach receipts or screenshots.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64;
        const mimeType = asset.mimeType || 'image/jpeg';

        if (!base64Data) {
          Alert.alert("Notice", "Unable to read selected image data.");
          return;
        }

        setSending(true);
        const filePath = `tickets/${id}/${Date.now()}.jpg`;

        // 1. Try Supabase Storage Upload
        try {
          const { error: uploadError } = await supabase.storage
            .from('chat_images')
            .upload(filePath, decode(base64Data), {
              contentType: mimeType,
              upsert: true
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('chat_images').getPublicUrl(filePath);
            await sendMessage(`[IMAGE] ${publicUrl}`);
            return;
          }
        } catch (storageErr) {
          console.warn("Storage upload fallback to Data URI:", storageErr);
        }

        // 2. Guaranteed Reliable Fallback: Direct Data URI
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        await sendMessage(`[IMAGE] ${dataUri}`);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to attach image');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", "Message copied to clipboard!");
  };

  const escalateToWhatsApp = () => {
    const shortId = id ? (id as string).split('-')[0].toUpperCase() : '';
    const text = `Hello Abu Mafhal Support, I am following up on Ticket #${shortId}: ${ticketDetails?.subject || ''}`;
    Linking.openURL(`whatsapp://send?phone=2348145853539&text=${encodeURIComponent(text)}`).catch(() => {});
  };

  const isResolved = ticketDetails?.status === 'resolved';
  const shortId = id ? (id as string).split('-')[0].toUpperCase() : '';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={s.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ 
        title: `#${shortId} Support Chat`,
        headerShown: true,
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: L.gold,
        headerTitleStyle: { fontWeight: '900', fontSize: 13.5 },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity onPress={escalateToWhatsApp} style={s.headerWaBtn} activeOpacity={0.8}>
              <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
            </TouchableOpacity>

            {isResolved ? (
              <View style={s.resolvedHeaderBadge}>
                <Ionicons name="checkmark-circle" size={12} color={L.emerald} />
                <Text style={s.resolvedHeaderText}>Resolved</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleMarkResolved} style={s.resolveBtn} activeOpacity={0.8}>
                <Ionicons name="checkmark-done" size={12} color={L.emerald} />
                <Text style={s.resolveBtnText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      }} />

      <View style={isWeb ? s.webCenterContainer : { flex: 1 }}>
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="small" color={L.goldDk} />
            <Text style={s.loadingText}>Connecting to ticket channel...</Text>
          </View>
        ) : (
          <>
            {/* TICKET DETAILS HEADER BANNER */}
            <View style={s.ticketBanner}>
              <View style={s.ticketBannerLeft}>
                <View style={s.ticketIconCircle}>
                  <Ionicons name="chatbubble-ellipses" size={12} color={L.navyHeader} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ticketBannerTitle} numberOfLines={1}>
                    {ticketDetails?.subject || 'Live Support Chat'}
                  </Text>
                  <Text style={s.ticketBannerSub}>
                    Priority: <Text style={{ color: L.goldAmber, fontWeight: '800' }}>{(ticketDetails?.priority || 'Normal').toUpperCase()}</Text> • Status: <Text style={{ color: isResolved ? L.emerald : L.sky, fontWeight: '800' }}>{(ticketDetails?.status || 'Open').toUpperCase()}</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={fetchMessages} style={s.refreshBtn} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={15} color={L.textMuted} />
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
                          <Ionicons name="shield-checkmark" size={11} color={L.goldAmber} />
                        </View>
                      )}

                      <View style={[s.msgBubble, isUser ? s.msgBubbleUser : s.msgBubbleAgent]}>
                        {!isUser && (
                          <View style={s.agentHeaderLine}>
                            <Ionicons name="headset" size={9.5} color={L.goldAmber} style={{ marginRight: 3 }} />
                            <Text style={s.agentLabel}>Abu Mafhal Support Agent</Text>
                          </View>
                        )}

                        <TouchableOpacity 
                          onLongPress={() => handleCopy(m.message)} 
                          onPress={() => isImage && imageUrl && setPreviewImage(imageUrl)}
                          activeOpacity={0.9}
                        >
                          {isImage && imageUrl ? (
                            <View style={s.imageWrap}>
                              <Image 
                                source={{ uri: imageUrl }} 
                                style={s.msgImage}
                                resizeMode="cover" 
                              />
                              <View style={s.zoomOverlay}>
                                <Ionicons name="scan-outline" size={12} color="#FFFFFF" />
                                <Text style={s.zoomText}>Tap to zoom</Text>
                              </View>
                            </View>
                          ) : (
                            <Text style={[s.msgText, isUser ? s.msgTextUser : s.msgTextAgent]}>
                              {m.message}
                            </Text>
                          )}
                        </TouchableOpacity>

                        <View style={s.msgFooter}>
                          <Text style={[s.msgTimeText, isUser && { color: 'rgba(255, 255, 255, 0.7)' }]}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {isUser && (
                            <Ionicons name="checkmark-done" size={11} color={L.gold} style={{ marginLeft: 3 }} />
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={s.emptyChatBox}>
                  <View style={s.emptyChatIconCircle}>
                    <Ionicons name="chatbubbles-outline" size={24} color={L.goldDk} />
                  </View>
                  <Text style={s.emptyChatTitle}>Chat Session Initialized</Text>
                  <Text style={s.emptyChatDesc}>
                    Type your message or attach transaction screenshots below. Our active support representative will assist you promptly.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* QUICK SMART REPLY CHIPS */}
            {!isResolved && (
              <View style={s.quickResponsesWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickResponsesContent}>
                  {QUICK_RESPONSES.map((chip, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => sendMessage(chip)}
                      style={s.quickChip}
                      activeOpacity={0.75}
                    >
                      <Text style={s.quickChipText}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* COMPACT INPUT BAR */}
            {isResolved ? (
              <View style={s.resolvedNoticeBar}>
                <Ionicons name="checkmark-circle" size={15} color={L.emerald} style={{ marginRight: 6 }} />
                <Text style={s.resolvedNoticeText}>This support ticket is resolved and closed.</Text>
              </View>
            ) : (
              <View style={s.inputContainer}>
                <View style={s.inputWrapper}>
                  <TouchableOpacity 
                    onPress={pickImage} 
                    style={s.attachBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="attach" size={16} color={L.navyHeader} />
                  </TouchableOpacity>

                  <TextInput
                    placeholder="Type message to agent..."
                    placeholderTextColor="#94A3B8"
                    style={s.textInput}
                    value={reply}
                    onChangeText={setReply}
                    multiline
                    selectionColor={L.goldDk}
                  />

                  <TouchableOpacity
                    onPress={() => sendMessage()}
                    disabled={sending || !reply.trim()}
                    style={s.sendBtn}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={sending || !reply.trim() ? ['#94A3B8', '#64748B'] : ['#0F172A', '#1E293B']}
                      style={s.sendBtnGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {sending ? (
                        <ActivityIndicator color={L.gold} size="small" />
                      ) : (
                        <Ionicons name="paper-plane" size={13} color={!reply.trim() ? '#E2E8F0' : L.gold} style={{ marginLeft: 1 }} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* FULLSCREEN IMAGE PREVIEW MODAL */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={s.imageModalOverlay}>
          <TouchableOpacity onPress={() => setPreviewImage(null)} style={s.imageModalCloseBtn}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={s.imageModalImg} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* COMPACT SATISFACTION RATING MODAL */}
      <Modal visible={showRatingModal} transparent animationType="fade" onRequestClose={() => setShowRatingModal(false)}>
        <View style={s.ratingModalOverlay}>
          <View style={s.ratingModalCard}>
            <View style={s.ratingIconCircle}>
              <Ionicons name="star" size={22} color={L.goldAmber} />
            </View>
            <Text style={s.ratingTitle}>Rate Support Experience</Text>
            <Text style={s.ratingSubtitle}>How satisfied are you with our agent's assistance?</Text>

            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.75} style={{ padding: 3 }}>
                  <Ionicons name={star <= rating ? "star" : "star-outline"} size={26} color={L.goldAmber} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.feedbackInput}
              placeholder="Leave an optional comment..."
              placeholderTextColor="#94A3B8"
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              multiline
            />

            <TouchableOpacity onPress={submitRating} style={s.submitRatingBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.submitRatingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.submitRatingText}>Submit Review</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: L.bg,
  },
  webCenterContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: L.bg,
  },
  headerWaBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.emeraldBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: L.emeraldBorder,
  },
  resolvedHeaderText: {
    color: L.emerald,
    fontWeight: '800',
    fontSize: 9.5,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.emeraldBg,
    borderWidth: 1,
    borderColor: L.emeraldBorder,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 3,
  },
  resolveBtnText: {
    color: L.emerald,
    fontWeight: '800',
    fontSize: 10,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 40,
  },
  loadingText: {
    color: L.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  ticketBanner: {
    backgroundColor: L.card,
    borderBottomWidth: 1,
    borderBottomColor: L.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  ticketIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  ticketBannerTitle: {
    color: L.navyHeader,
    fontSize: 11.5,
    fontWeight: '800',
  },
  ticketBannerSub: {
    color: L.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 16,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 8,
    width: '100%',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAgent: {
    justifyContent: 'flex-start',
  },
  agentAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginTop: 2,
  },
  msgBubble: {
    maxWidth: '82%',
    borderRadius: 12,
    padding: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  msgBubbleUser: {
    backgroundColor: L.navyHeader,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: L.navyMid,
  },
  msgBubbleAgent: {
    backgroundColor: L.card,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  agentHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  agentLabel: {
    color: L.goldAmber,
    fontWeight: '900',
    fontSize: 8.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  msgText: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  msgTextUser: {
    color: '#FFFFFF',
  },
  msgTextAgent: {
    color: L.textPrimary,
  },
  imageWrap: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  msgImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  zoomOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  zoomText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '600',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  msgTimeText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: L.textMuted,
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  emptyChatIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyChatTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13.5,
    marginBottom: 4,
  },
  emptyChatDesc: {
    color: L.textMuted,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 15,
  },
  quickResponsesWrap: {
    backgroundColor: L.card,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
  },
  quickResponsesContent: {
    paddingHorizontal: 10,
    gap: 6,
  },
  quickChip: {
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  quickChipText: {
    color: L.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  resolvedNoticeBar: {
    backgroundColor: L.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedNoticeText: {
    color: L.emerald,
    fontWeight: '800',
    fontSize: 11,
  },
  inputContainer: {
    backgroundColor: L.card,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  attachBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: L.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  textInput: {
    flex: 1,
    color: L.textPrimary,
    fontSize: 11.5,
    paddingHorizontal: 8,
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
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imageModalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalImg: {
    width: Math.min(W * 0.9, 450),
    height: Math.min(W * 0.9, 450),
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  ratingModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: L.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: L.cardBorder,
    padding: 16,
    alignItems: 'center',
  },
  ratingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ratingTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 2,
  },
  ratingSubtitle: {
    color: L.textMuted,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  feedbackInput: {
    width: '100%',
    backgroundColor: L.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    padding: 8,
    color: L.textPrimary,
    fontSize: 11,
    minHeight: 48,
    marginBottom: 12,
  },
  submitRatingBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitRatingGrad: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRatingText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11.5,
  },
});

