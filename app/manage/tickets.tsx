import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Image, ActivityIndicator, RefreshControl,
  LayoutAnimation, UIManager, Alert, Modal, Linking, Switch, StyleSheet, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';
import { sendAdminReplyEmail } from '../../services/ticketEmail';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  coralBorder: '#FECDD3',
};

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url?: string; email?: string; phone?: string };
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: { role?: string; avatar_url?: string; full_name?: string };
};

const CANNED_REPLIES = [
  { label: "✅ Wallet Credited", text: "Your wallet has been verified and credited successfully. Please check your balance." },
  { label: "📄 Request Proof", text: "Kindly attach a clear screenshot or receipt of your bank debit for quick verification." },
  { label: "⚡ Data / Airtime Sent", text: "Your order has been reprocessed and delivered successfully. Thank you for your patience." },
  { label: "🔍 Checking Provider", text: "We are currently liaising with the gateway service provider regarding your request." },
  { label: "🎉 Issue Resolved", text: "This issue has been fully resolved. Thank you for choosing Abu Mafhal Hub!" },
];

export default function ManagerSupportDesk() {
  const router = useRouter();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [sending, setSending] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchTickets();

    // Realtime subscription for incoming user tickets
    const ticketSub = supabase
      .channel('admin_tickets_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketSub);
    };
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);

      const msgSub = supabase
        .channel(`admin_chat:${selectedTicket.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ticket_messages', 
          filter: `ticket_id=eq.${selectedTicket.id}` 
        }, (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as TicketMessage];
          });
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(msgSub);
      };
    }
  }, [selectedTicket?.id]);

  const fetchTickets = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, profiles(full_name, avatar_url, email, phone)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data && !error) setTickets(data as any);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*, profiles:sender_id(role, avatar_url, full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages(data);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 60);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert("Permission Required", "Please grant photo library access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64;
        const mimeType = asset.mimeType || 'image/jpeg';

        if (!base64Data) return;

        if (selectedTicket?.id) {
          setSending(true);
          const filePath = `tickets/${selectedTicket.id}/admin_${Date.now()}.jpg`;
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
          } catch (e) {
            console.warn("Storage upload fallback:", e);
          }
        }

        // Guaranteed fallback to Data URI
        const base64Str = `data:${mimeType};base64,${base64Data}`;
        await sendMessage(`[IMAGE] ${base64Str}`);
      }
    } catch (err: any) {
      Alert.alert("Image Error", err.message || "Failed to select image.");
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || reply.trim();
    if (!textToSend || !selectedTicket) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSending(true);
    if (!textOverride) setReply('');

    const formattedMessage = isInternalNote ? `[INTERNAL NOTE] ${textToSend}` : textToSend;

    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: formattedMessage
        });

      if (error) {
        Alert.alert('Error Sending', error.message);
      } else {
        if (selectedTicket.status === 'open' && !isInternalNote) {
          await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', selectedTicket.id);
          setSelectedTicket(prev => prev ? { ...prev, status: 'in_progress' } : null);
        }

        fetchMessages(selectedTicket.id);
        fetchTickets();

        // Push notification if not internal note
        if (!isInternalNote) {
          supabase.from('notifications').insert({
            user_id: selectedTicket.user_id,
            title: 'Support Agent Response',
            body: textToSend.startsWith('[IMAGE]') ? 'Agent sent an attachment' : textToSend,
            data: { route: `/tickets/${selectedTicket.id}` },
            read: false
          }).then();

          // Dispatch automatic email
          if (selectedTicket.profiles?.email) {
            sendAdminReplyEmail(
              selectedTicket.id,
              selectedTicket.subject,
              textToSend,
              selectedTicket.profiles.email,
              selectedTicket.profiles.full_name
            );
          }
        }
      }
    } finally {
      setSending(false);
    }
  };

  const changeTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedTicket({ ...selectedTicket, status });

    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', selectedTicket.id);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('ticket_messages').insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: `[SYSTEM] Support status updated to ${status.toUpperCase()}`
        });
      }
      fetchTickets();
      fetchMessages(selectedTicket.id);
    }
  };

  const changePriority = async (priority: string) => {
    if (!selectedTicket) return;
    setSelectedTicket({ ...selectedTicket, priority });
    await supabase.from('tickets').update({ priority }).eq('id', selectedTicket.id);
    fetchTickets();
  };

  const openUserModal = async (userId: string) => {
    setShowUserModal(true);
    setLoadingUser(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) setUserDetails(data);
    } finally {
      setLoadingUser(false);
    }
  };

  const toggleUserStatus = async () => {
    if (!userDetails) return;
    const newStatus = userDetails.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userDetails.id);
    if (!error) {
      setUserDetails({ ...userDetails, status: newStatus });
      Alert.alert('Success', `User account status changed to: ${newStatus.toUpperCase()}`);
    }
  };

  const resolveSelectedTickets = async () => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'resolved' })
      .in('id', selectedIds);

    if (!error) {
      Alert.alert('Success', `${selectedIds.length} tickets resolved.`);
      setSelectMode(false);
      setSelectedIds([]);
      fetchTickets();
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      const newIds = selectedIds.filter(i => i !== id);
      setSelectedIds(newIds);
      if (newIds.length === 0) setSelectMode(false);
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const copyTicketId = async (id: string) => {
    await Clipboard.setStringAsync(id);
    Alert.alert('Copied 📋', `Ticket ID #${id.split('-')[0].toUpperCase()} copied!`);
  };

  const openWhatsAppWithUser = (phone?: string) => {
    if (!phone) {
      Alert.alert("Notice", "User has not registered a phone number.");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formatted = cleanPhone.startsWith('0') ? `234${cleanPhone.slice(1)}` : cleanPhone;
    const text = `Hello ${selectedTicket?.profiles?.full_name || 'Customer'}, I am contacting you from Abu Mafhal Hub Support regarding your ticket #${selectedTicket?.id?.split('-')[0].toUpperCase()}.`;
    Linking.openURL(`whatsapp://send?phone=${formatted}&text=${encodeURIComponent(text)}`).catch(() => {});
  };

  // Metrics
  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
  const totalCount = tickets.length;

  // Filtered ticket queue
  const filteredTickets = tickets.filter(t => {
    const matchesFilter =
      activeFilter === 'all' ? true :
      activeFilter === 'open' ? t.status === 'open' :
      activeFilter === 'in_progress' ? t.status === 'in_progress' :
      t.status === 'resolved';

    const matchesCategory =
      categoryFilter === 'All' ? true :
      t.subject?.toLowerCase().includes(categoryFilter.toLowerCase());

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      t.subject?.toLowerCase().includes(searchLower) ||
      t.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      t.profiles?.email?.toLowerCase().includes(searchLower) ||
      t.id.toLowerCase().includes(searchLower);

    return matchesFilter && matchesCategory && matchesSearch;
  });

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // ============================================================================
  // RENDER: TICKET QUEUE INBOX
  // ============================================================================
  const renderTicketList = () => (
    <View style={s.inboxContainer}>
      {/* EXECUTIVE TOP BAR */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={16} color={L.gold} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={s.topBarTitle}>Support Desk Manager</Text>
            <View style={s.topBarSubRow}>
              <View style={s.pulseGreenDot} />
              <Text style={s.topBarSubText}>{openCount} Tickets Need Attention</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => fetchTickets(true)} style={s.refreshBtn} activeOpacity={0.8}>
            <Ionicons name="refresh" size={15} color={L.gold} />
          </TouchableOpacity>
        </View>

        {/* METRICS ROW */}
        <View style={s.metricsRow}>
          <TouchableOpacity onPress={() => setActiveFilter('all')} style={[s.metricBox, activeFilter === 'all' && s.metricBoxActive]}>
            <Text style={s.metricNum}>{totalCount}</Text>
            <Text style={s.metricLabel}>Total</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveFilter('open')} style={[s.metricBox, activeFilter === 'open' && s.metricBoxActive]}>
            <Text style={[s.metricNum, { color: L.coral }]}>{openCount}</Text>
            <Text style={s.metricLabel}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveFilter('in_progress')} style={[s.metricBox, activeFilter === 'in_progress' && s.metricBoxActive]}>
            <Text style={[s.metricNum, { color: L.sky }]}>{inProgressCount}</Text>
            <Text style={s.metricLabel}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveFilter('resolved')} style={[s.metricBox, activeFilter === 'resolved' && s.metricBoxActive]}>
            <Text style={[s.metricNum, { color: L.emerald }]}>{resolvedCount}</Text>
            <Text style={s.metricLabel}>Closed</Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={14} color={L.goldDk} />
          <TextInput
            placeholder="Search by ticket ID, user name, or issue..."
            placeholderTextColor="#94A3B8"
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            selectionColor={L.goldDk}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catChipsRow}>
          {['All', 'Wallet', 'Data', 'Airtime', 'Bills', 'CAC', 'Crypto', 'NIN', 'Card'].map((cat) => {
            const isCatSelected = categoryFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategoryFilter(cat)}
                style={[s.catChip, isCatSelected && s.catChipActive]}
                activeOpacity={0.75}
              >
                <Text style={[s.catChipText, isCatSelected && s.catChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* BULK ACTION BAR */}
      {selectMode && (
        <View style={s.bulkBar}>
          <Text style={s.bulkText}>{selectedIds.length} Selected</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds([]); }} style={s.bulkCancelBtn}>
              <Text style={s.bulkCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resolveSelectedTickets} style={s.bulkResolveBtn}>
              <Text style={s.bulkResolveText}>Resolve All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TICKETS LIST */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="small" color={L.goldDk} />
          <Text style={s.loadingText}>Loading support queue...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchTickets(true)} tintColor={L.goldDk} />
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <View style={s.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={24} color={L.goldDk} />
              </View>
              <Text style={s.emptyTitle}>No Support Tickets Found</Text>
              <Text style={s.emptySub}>
                {searchQuery ? 'No tickets match your query.' : 'There are no active tickets matching the current filter.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            const isOpen = item.status === 'open';
            const isActive = item.status === 'in_progress';
            const statusColor = isOpen ? L.coral : isActive ? L.sky : L.emerald;
            const statusBg = isOpen ? L.coralBg : isActive ? L.skyBg : L.emeraldBg;
            const statusBorder = isOpen ? L.coralBorder : isActive ? '#BAE6FD' : L.emeraldBorder;
            const shortId = item.id.split('-')[0].toUpperCase();

            return (
              <TouchableOpacity
                onLongPress={() => {
                  setSelectMode(true);
                  toggleSelection(item.id);
                }}
                onPress={() => {
                  if (selectMode) toggleSelection(item.id);
                  else setSelectedTicket(item);
                }}
                style={[s.ticketCard, isSelected && s.ticketCardSelected]}
                activeOpacity={0.8}
              >
                <View style={s.ticketCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {selectMode ? (
                      <View style={[s.selectCircle, isSelected && s.selectCircleActive]}>
                        {isSelected && <Ionicons name="checkmark" size={11} color="#0F172A" />}
                      </View>
                    ) : item.profiles?.avatar_url ? (
                      <Image source={{ uri: item.profiles.avatar_url }} style={s.userAvatar} />
                    ) : (
                      <View style={s.userAvatarFallback}>
                        <Text style={s.userAvatarText}>{getInitials(item.profiles?.full_name || 'U')}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 7 }}>
                      <Text style={s.userNameText} numberOfLines={1}>{item.profiles?.full_name || 'Customer'}</Text>
                      <Text style={s.userMetaText}>#{shortId} • {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                    </View>
                  </View>

                  {/* Priority Tag */}
                  <View style={[s.priorityBadge, {
                    backgroundColor: item.priority === 'critical' ? L.coralBg : item.priority === 'high' ? L.goldLight : L.bg,
                    borderColor: item.priority === 'critical' ? L.coral : item.priority === 'high' ? L.goldAmber : L.cardBorder,
                  }]}>
                    <Text style={[s.priorityBadgeText, {
                      color: item.priority === 'critical' ? L.coral : item.priority === 'high' ? L.goldAmber : L.textMuted
                    }]}>{(item.priority || 'Normal').toUpperCase()}</Text>
                  </View>
                </View>

                {/* Subject */}
                <Text style={s.ticketSubject} numberOfLines={2}>{item.subject}</Text>

                {/* Footer Controls */}
                <View style={s.ticketCardFooter}>
                  <View style={[s.statusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                    <Text style={[s.statusPillText, { color: statusColor }]}>
                      {isOpen ? '🔴 OPEN' : isActive ? '🔵 IN PROGRESS' : '🟢 RESOLVED'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    <TouchableOpacity onPress={() => copyTicketId(item.id)} style={s.actionPill} activeOpacity={0.7}>
                      <Ionicons name="copy-outline" size={10} color={L.textMuted} />
                      <Text style={s.actionPillText}>ID</Text>
                    </TouchableOpacity>

                    {item.status !== 'resolved' && (
                      <TouchableOpacity 
                        onPress={async () => {
                          await supabase.from('tickets').update({ status: 'resolved' }).eq('id', item.id);
                          fetchTickets();
                        }}
                        style={s.resolvePill}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="checkmark" size={10} color={L.emerald} />
                        <Text style={s.resolvePillText}>Close</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={() => setSelectedTicket(item)} style={s.replyBtn} activeOpacity={0.75}>
                      <Ionicons name="chatbubble-ellipses" size={10} color={L.gold} />
                      <Text style={s.replyBtnText}>Open Chat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  // ============================================================================
  // RENDER: LIVE CHAT & CRM INSPECTOR
  // ============================================================================
  const renderChatInterface = () => {
    const isResolved = selectedTicket?.status === 'resolved';
    const shortId = selectedTicket?.id?.split('-')[0].toUpperCase();

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.chatContainer}>
        {/* CHAT HEADER BAR */}
        <View style={s.chatHeader}>
          <View style={s.chatHeaderTopRow}>
            <TouchableOpacity onPress={() => setSelectedTicket(null)} style={s.backBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={16} color={L.gold} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => openUserModal(selectedTicket?.user_id || '')} style={s.chatUserInfo} activeOpacity={0.8}>
              {selectedTicket?.profiles?.avatar_url ? (
                <Image source={{ uri: selectedTicket.profiles.avatar_url }} style={s.chatUserAvatar} />
              ) : (
                <View style={s.chatUserAvatarFallback}>
                  <Text style={s.chatUserAvatarText}>{getInitials(selectedTicket?.profiles?.full_name || 'U')}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.chatUserName} numberOfLines={1}>{selectedTicket?.profiles?.full_name || 'Customer'}</Text>
                <Text style={s.chatUserSub}>Ticket #{shortId} • Tap to view profile details</Text>
              </View>
            </TouchableOpacity>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 5 }}>
              <TouchableOpacity onPress={() => openWhatsAppWithUser(selectedTicket?.profiles?.phone)} style={s.waHeaderBtn} activeOpacity={0.75}>
                <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openUserModal(selectedTicket?.user_id || '')} style={s.profileHeaderBtn} activeOpacity={0.75}>
                <Ionicons name="person-outline" size={14} color={L.gold} />
              </TouchableOpacity>
            </View>
          </View>

          {/* STATUS SELECTOR PILLS */}
          <View style={s.statusControlRow}>
            <TouchableOpacity onPress={() => changeTicketStatus('open')} style={[s.statusSelectPill, selectedTicket?.status === 'open' && s.statusSelectPillActive]}>
              <Text style={[s.statusSelectText, selectedTicket?.status === 'open' && { color: L.coral, fontWeight: '900' }]}>🔴 Open</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeTicketStatus('in_progress')} style={[s.statusSelectPill, selectedTicket?.status === 'in_progress' && s.statusSelectPillActive]}>
              <Text style={[s.statusSelectText, selectedTicket?.status === 'in_progress' && { color: L.sky, fontWeight: '900' }]}>🔵 In Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeTicketStatus('resolved')} style={[s.statusSelectPill, selectedTicket?.status === 'resolved' && s.statusSelectPillActive]}>
              <Text style={[s.statusSelectText, selectedTicket?.status === 'resolved' && { color: L.emerald, fontWeight: '900' }]}>🟢 Resolved</Text>
            </TouchableOpacity>
          </View>
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
              const isMe = m.profiles?.role === 'admin' || m.profiles?.role === 'super_admin';
              const isSystem = m.message.startsWith('[SYSTEM]');
              const isInternal = m.message.startsWith('[INTERNAL NOTE]');
              const isImage = m.message.startsWith('[IMAGE]');
              const cleanMsg = m.message.replace('[SYSTEM]', '').replace('[INTERNAL NOTE]', '').replace('[IMAGE]', '').trim();

              if (isSystem) {
                return (
                  <View key={m.id} style={s.systemMsgWrap}>
                    <Ionicons name="information-circle-outline" size={11} color={L.textMuted} />
                    <Text style={s.systemMsgText}>{cleanMsg}</Text>
                  </View>
                );
              }

              if (isInternal) {
                return (
                  <View key={m.id} style={s.internalNoteWrap}>
                    <View style={s.internalNoteHeader}>
                      <Ionicons name="lock-closed" size={10} color={L.goldAmber} />
                      <Text style={s.internalNoteHeaderText}>INTERNAL MANAGER NOTE</Text>
                    </View>
                    <Text style={s.internalNoteBody}>{cleanMsg}</Text>
                  </View>
                );
              }

              return (
                <View key={m.id} style={[s.msgRow, isMe ? s.msgRowAdmin : s.msgRowUser]}>
                  {!isMe && (
                    <View style={s.userMsgAvatar}>
                      <Text style={s.userMsgAvatarText}>{getInitials(m.profiles?.full_name || 'U')}</Text>
                    </View>
                  )}

                  <View style={[s.msgBubble, isMe ? s.msgBubbleAdmin : s.msgBubbleUser]}>
                    {isImage ? (
                      <TouchableOpacity onPress={() => setPreviewImage(cleanMsg)} activeOpacity={0.9}>
                        <Image source={{ uri: cleanMsg }} style={s.msgImage} resizeMode="cover" />
                        <View style={s.zoomTag}>
                          <Ionicons name="scan-outline" size={10} color="#FFFFFF" />
                          <Text style={s.zoomTagText}>Zoom</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[s.msgText, isMe ? s.msgTextAdmin : s.msgTextUser]}>{m.message}</Text>
                    )}

                    <View style={s.msgFooter}>
                      <Text style={[s.msgTime, isMe && { color: 'rgba(255, 215, 0, 0.7)' }]}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {isMe && <Ionicons name="checkmark-done" size={10} color={L.gold} style={{ marginLeft: 3 }} />}
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={s.emptyChatBox}>
              <Ionicons name="chatbubbles-outline" size={24} color={L.goldDk} />
              <Text style={s.emptyChatText}>No messages yet in this ticket conversation.</Text>
            </View>
          )}
        </ScrollView>

        {/* CANNED REPLIES CAROUSEL */}
        {!isResolved && (
          <View style={s.cannedRepliesBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cannedRepliesScroll}>
              {CANNED_REPLIES.map((cr, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => sendMessage(cr.text)}
                  style={s.cannedPill}
                  activeOpacity={0.75}
                >
                  <Text style={s.cannedPillText}>{cr.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* INPUT COMPOSER BAR */}
        {!isResolved && (
          <View style={s.inputBarContainer}>
            {/* Toolbar (AI Draft, Internal Note Toggle) */}
            <View style={s.toolbarRow}>
              <TouchableOpacity
                onPress={() => {
                  const draft = `Hello ${selectedTicket?.profiles?.full_name || 'Customer'}, thank you for contacting Abu Mafhal Support regarding "${selectedTicket?.subject || 'your request'}". We have checked the records and your transaction is processed. Please verify your account.`;
                  setReply(draft);
                }}
                style={s.aiDraftBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="sparkles" size={11} color={L.goldAmber} />
                <Text style={s.aiDraftBtnText}>AI Draft Response</Text>
              </TouchableOpacity>

              <View style={s.internalNoteToggle}>
                <Text style={[s.internalNoteLabel, isInternalNote && { color: L.goldAmber }]}>Internal Note</Text>
                <Switch
                  value={isInternalNote}
                  onValueChange={setIsInternalNote}
                  trackColor={{ false: '#CBD5E1', true: L.goldAmber }}
                  thumbColor="#FFFFFF"
                  style={{ transform: [{ scale: 0.65 }] }}
                />
              </View>
            </View>

            {/* Input Row */}
            <View style={[s.inputRow, isInternalNote && s.inputRowInternal]}>
              <TouchableOpacity onPress={pickImage} style={s.attachBtn} activeOpacity={0.75}>
                <Ionicons name="attach" size={16} color={L.navyHeader} />
              </TouchableOpacity>

              <TextInput
                placeholder={isInternalNote ? "Write an internal team note..." : "Type reply to user..."}
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
                    <ActivityIndicator size="small" color={L.gold} />
                  ) : (
                    <Ionicons name="paper-plane" size={12} color={!reply.trim() ? '#E2E8F0' : L.gold} style={{ marginLeft: 1 }} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* FULLSCREEN IMAGE PREVIEW */}
        <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={s.imageModalOverlay}>
            <TouchableOpacity onPress={() => setPreviewImage(null)} style={s.imageModalClose}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {previewImage && <Image source={{ uri: previewImage }} style={s.imageModalImg} resizeMode="contain" />}
          </View>
        </Modal>

        {/* USER PROFILE MODAL */}
        <Modal visible={showUserModal} transparent animationType="slide" onRequestClose={() => setShowUserModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.userModalCard}>
              <View style={s.userModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.userModalIcon}>
                    <Ionicons name="person" size={14} color={L.gold} />
                  </View>
                  <Text style={s.userModalTitle}>Customer Profile Inspector</Text>
                </View>
                <TouchableOpacity onPress={() => setShowUserModal(false)} style={s.modalCloseBtn}>
                  <Ionicons name="close" size={16} color={L.navyHeader} />
                </TouchableOpacity>
              </View>

              {loadingUser ? (
                <ActivityIndicator size="small" color={L.goldDk} style={{ marginVertical: 20 }} />
              ) : userDetails ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Summary Bar */}
                  <View style={s.userSummaryRow}>
                    <View style={s.userSummaryBox}>
                      <Text style={s.userSummaryLabel}>Balance</Text>
                      <Text style={s.userBalanceText}>₦{Number(userDetails.balance || 0).toLocaleString()}</Text>
                    </View>
                    <View style={s.userSummaryBox}>
                      <Text style={s.userSummaryLabel}>KYC Level</Text>
                      <Text style={s.userKycText}>Tier {userDetails.kyc_tier || 1}</Text>
                    </View>
                    <View style={s.userSummaryBox}>
                      <Text style={s.userSummaryLabel}>Status</Text>
                      <Text style={[s.userStatusText, { color: userDetails.status === 'active' ? L.emerald : L.coral }]}>
                        {(userDetails.status || 'Active').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Information Rows */}
                  <View style={s.userInfoCard}>
                    {[
                      { label: 'Full Name', value: userDetails.full_name || 'N/A', icon: 'person-outline' },
                      { label: 'Email', value: userDetails.email || 'N/A', icon: 'mail-outline' },
                      { label: 'Phone', value: userDetails.phone || 'N/A', icon: 'call-outline' },
                      { label: 'Username', value: userDetails.username || 'N/A', icon: 'at-outline' },
                      { label: 'Role', value: (userDetails.role || 'user').toUpperCase(), icon: 'shield-outline' },
                      { label: 'Referral Code', value: userDetails.referral_code || 'N/A', icon: 'gift-outline' },
                    ].map((row, idx) => (
                      <View key={idx} style={[s.infoRow, idx !== 5 && s.infoRowBorder]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={row.icon as any} size={12} color={L.textMuted} />
                          <Text style={s.infoRowLabel}>{row.label}</Text>
                        </View>
                        <Text style={s.infoRowValue}>{row.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={s.userActionButtonsRow}>
                    <TouchableOpacity onPress={() => openWhatsAppWithUser(userDetails.phone)} style={s.userActionBtn}>
                      <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                      <Text style={s.userActionText}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (userDetails.phone) Linking.openURL(`tel:${userDetails.phone}`);
                      }}
                      style={s.userActionBtn}
                    >
                      <Ionicons name="call-outline" size={13} color={L.sky} />
                      <Text style={s.userActionText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleUserStatus} style={[s.userActionBtn, { borderColor: userDetails.status === 'active' ? L.coral : L.emerald }]}>
                      <Ionicons name={userDetails.status === 'active' ? "ban-outline" : "checkmark-circle-outline"} size={13} color={userDetails.status === 'active' ? L.coral : L.emerald} />
                      <Text style={[s.userActionText, { color: userDetails.status === 'active' ? L.coral : L.emerald }]}>
                        {userDetails.status === 'active' ? 'Suspend' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ headerShown: false }} />
      {selectedTicket ? renderChatInterface() : renderTicketList()}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: L.bg,
  },
  inboxContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: L.bg,
  },
  topBar: {
    backgroundColor: L.navyHeader,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  topBarSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  pulseGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: L.emerald,
  },
  topBarSubText: {
    color: L.goldLight,
    fontSize: 9,
    fontWeight: '700',
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#060B19',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  metricBoxActive: {
    backgroundColor: '#1E293B',
    borderColor: L.gold,
  },
  metricNum: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 13,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#060B19',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
    paddingHorizontal: 8,
    height: 32,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '500',
  },
  catChipsRow: {
    gap: 4,
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#060B19',
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  catChipActive: {
    backgroundColor: L.gold,
    borderColor: L.gold,
  },
  catChipText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '700',
  },
  catChipTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  bulkBar: {
    backgroundColor: L.navyHeader,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: L.goldDk,
  },
  bulkText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10.5,
  },
  bulkCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bulkCancelText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  bulkResolveBtn: {
    backgroundColor: L.emerald,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bulkResolveText: {
    color: '#0F172A',
    fontSize: 9.5,
    fontWeight: '900',
  },
  listContent: {
    padding: 10,
    paddingBottom: 60,
  },
  centerBox: {
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
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: L.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginTop: 10,
  },
  emptyIconCircle: {
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
  emptyTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
  },
  emptySub: {
    color: L.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  ticketCard: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketCardSelected: {
    borderColor: L.goldDk,
    backgroundColor: L.goldLight,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: L.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: L.gold,
    borderColor: L.goldDk,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.cardBorder,
  },
  userAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.navyHeader,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 9,
  },
  userNameText: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11,
  },
  userMetaText: {
    color: L.textMuted,
    fontSize: 8.5,
  },
  priorityBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  ticketSubject: {
    color: L.textSecondary,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 31,
  },
  ticketCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginLeft: 31,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '900',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  actionPillText: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
  },
  resolvePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: L.emeraldBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.emeraldBorder,
  },
  resolvePillText: {
    color: L.emerald,
    fontSize: 8.5,
    fontWeight: '900',
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.navyHeader,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  replyBtnText: {
    color: L.gold,
    fontSize: 8.5,
    fontWeight: '900',
  },
  chatContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: L.bg,
  },
  chatHeader: {
    backgroundColor: L.navyHeader,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: 8,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  chatHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chatUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  chatUserAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: L.gold,
  },
  chatUserAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#060B19',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: L.gold,
  },
  chatUserAvatarText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 10,
  },
  chatUserName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  chatUserSub: {
    color: L.goldLight,
    fontSize: 8.5,
  },
  waHeaderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    borderWidth: 1,
    borderColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeaderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusControlRow: {
    flexDirection: 'row',
    backgroundColor: '#060B19',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  statusSelectPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusSelectPillActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: L.gold,
  },
  statusSelectText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '700',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  systemMsgWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.cardBorder,
    alignSelf: 'center',
    marginVertical: 4,
  },
  systemMsgText: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '600',
  },
  internalNoteWrap: {
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    borderRadius: 8,
    padding: 6,
    marginVertical: 4,
  },
  internalNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  internalNoteHeaderText: {
    color: L.goldAmber,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  internalNoteBody: {
    color: L.textPrimary,
    fontSize: 10,
    fontWeight: '600',
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 8,
    width: '100%',
  },
  msgRowAdmin: {
    justifyContent: 'flex-end',
  },
  msgRowUser: {
    justifyContent: 'flex-start',
  },
  userMsgAvatar: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: L.navyHeader,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
    marginTop: 2,
  },
  userMsgAvatarText: {
    color: L.gold,
    fontSize: 8,
    fontWeight: '900',
  },
  msgBubble: {
    maxWidth: '82%',
    borderRadius: 10,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  msgBubbleAdmin: {
    backgroundColor: L.navyHeader,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: L.navyMid,
  },
  msgBubbleUser: {
    backgroundColor: L.card,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  msgText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  msgTextAdmin: {
    color: '#FFFFFF',
  },
  msgTextUser: {
    color: L.textPrimary,
  },
  msgImage: {
    width: 170,
    height: 170,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  zoomTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  zoomTagText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '600',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  msgTime: {
    fontSize: 8,
    fontWeight: '600',
    color: L.textMuted,
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 6,
  },
  emptyChatText: {
    color: L.textMuted,
    fontSize: 10.5,
    fontWeight: '500',
  },
  cannedRepliesBar: {
    backgroundColor: L.card,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
  },
  cannedRepliesScroll: {
    paddingHorizontal: 8,
    gap: 5,
  },
  cannedPill: {
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  cannedPillText: {
    color: L.navyHeader,
    fontSize: 9,
    fontWeight: '700',
  },
  inputBarContainer: {
    backgroundColor: L.card,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  aiDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiDraftBtnText: {
    color: L.goldAmber,
    fontSize: 8,
    fontWeight: '900',
  },
  internalNoteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  internalNoteLabel: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  inputRowInternal: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  attachBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: L.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  textInput: {
    flex: 1,
    color: L.textPrimary,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxHeight: 60,
    fontWeight: '500',
  },
  sendBtn: {
    borderRadius: 13,
    overflow: 'hidden',
  },
  sendBtnGrad: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalImg: {
    width: Math.min(W * 0.9, 450),
    height: Math.min(W * 0.9, 450),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  userModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: L.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: L.cardBorder,
    padding: 14,
    maxHeight: '85%',
  },
  userModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: L.cardBorder,
  },
  userModalIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.navyHeader,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userModalTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12.5,
  },
  modalCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSummaryRow: {
    flexDirection: 'row',
    backgroundColor: L.bg,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginBottom: 8,
  },
  userSummaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  userSummaryLabel: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  userBalanceText: {
    color: L.emerald,
    fontWeight: '900',
    fontSize: 11.5,
  },
  userKycText: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 11.5,
  },
  userStatusText: {
    fontWeight: '900',
    fontSize: 10.5,
  },
  userInfoCard: {
    backgroundColor: L.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoRowLabel: {
    color: L.textMuted,
    fontSize: 9.5,
    fontWeight: '600',
  },
  infoRowValue: {
    color: L.navyHeader,
    fontSize: 9.5,
    fontWeight: '800',
  },
  userActionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  userActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  userActionText: {
    color: L.navyHeader,
    fontSize: 9.5,
    fontWeight: '800',
  },
});
