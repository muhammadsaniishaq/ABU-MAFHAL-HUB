import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Modal, Alert, StyleSheet, Dimensions, StatusBar, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { sendTicketCreatedEmail } from '../../../services/ticketEmail';

const { width: W } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Light Luxury Executive Design Tokens
const L = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardBorderGold: 'rgba(218, 165, 32, 0.4)',
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
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  description?: string;
};

const CATEGORIES = [
  { label: "Wallet & Funding", value: "Wallet Funding Issue", icon: "wallet-outline" },
  { label: "Data & Airtime", value: "Data or Airtime Delay", icon: "wifi-outline" },
  { label: "NEPA & Utility", value: "Bill Payment Issue", icon: "flash-outline" },
  { label: "CAC & Business", value: "CAC Registration Inquiry", icon: "briefcase-outline" },
  { label: "Crypto Trading", value: "Crypto Trading Issue", icon: "logo-bitcoin" },
  { label: "NIN / BVN Slip", value: "NIN/BVN Inquiry", icon: "finger-print-outline" },
  { label: "Dollar Cards", value: "Dollar Card Issue", icon: "card-outline" },
  { label: "General Support", value: "General Inquiry", icon: "help-buoy-outline" },
];

const PRIORITIES = [
  { key: 'normal', label: 'Standard', color: '#10B981', bg: '#ECFDF5' },
  { key: 'high', label: 'Urgent', color: '#D97706', bg: '#FEF3C7' },
  { key: 'critical', label: 'Critical', color: '#EF4444', bg: '#FFF1F2' },
];

export default function UserTicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].value);
  const [selectedPriority, setSelectedPriority] = useState('high');

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setTickets(data as any);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    const mainTitle = subject.trim() || selectedCategory;
    const finalSubject = txnRef.trim() ? `${mainTitle} (Ref: ${txnRef.trim()})` : mainTitle;
    
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          subject: finalSubject,
          status: 'open',
          priority: selectedPriority
        })
        .select()
        .single();

      if (data && !error) {
        setShowCreateModal(false);
        setSubject('');
        setTxnRef('');
        
        // Automatic Email Notification
        sendTicketCreatedEmail(data.id, finalSubject, user.email, user.user_metadata?.full_name);

        router.push(`/tickets/${data.id}`);
      } else if (error) {
        Alert.alert("Error", error.message);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const copyTicketId = async (id: string) => {
    const shortId = id.split('-')[0].toUpperCase();
    await Clipboard.setStringAsync(id);
    Alert.alert("Copied 📋", `Ticket ID #${shortId} copied to clipboard!`);
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const activeCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  const filteredTickets = tickets
    .filter(t => {
      if (filter === 'all') return true;
      return t.status === filter;
    })
    .filter(t => {
      if (selectedCategoryFilter === 'All') return true;
      return t.subject.toLowerCase().includes(selectedCategoryFilter.toLowerCase());
    })
    .filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ 
        title: 'Support Tickets Desk',
        headerShown: true,
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: L.gold,
        headerTitleStyle: { fontWeight: '900', fontSize: 14.5 },
        headerRight: () => (
          <TouchableOpacity 
            onPress={() => setShowCreateModal(true)} 
            style={s.headerNewBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={14} color="#0F172A" />
            <Text style={s.headerNewBtnText}>New Ticket</Text>
          </TouchableOpacity>
        )
      }} />

      <View style={isWeb ? s.webCenterContainer : { flex: 1 }}>
        {/* COMPACT STATS ROW */}
        <View style={s.statsRow}>
          <TouchableOpacity onPress={() => setFilter('all')} style={[s.statCard, filter === 'all' && s.statCardActive]}>
            <Text style={s.statNum}>{tickets.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('open')} style={[s.statCard, filter === 'open' && s.statCardActive]}>
            <Text style={[s.statNum, { color: L.coral }]}>{openCount}</Text>
            <Text style={s.statLabel}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('in_progress')} style={[s.statCard, filter === 'in_progress' && s.statCardActive]}>
            <Text style={[s.statNum, { color: L.sky }]}>{activeCount}</Text>
            <Text style={s.statLabel}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('resolved')} style={[s.statCard, filter === 'resolved' && s.statCardActive]}>
            <Text style={[s.statNum, { color: L.emerald }]}>{resolvedCount}</Text>
            <Text style={s.statLabel}>Closed</Text>
          </TouchableOpacity>
        </View>

        {/* RESPONSE TIME BANNER */}
        <View style={s.responseBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="flash" size={13} color={L.goldAmber} />
            <Text style={s.responseBannerText}>Average Live Agent Response Time: ~3-5 mins</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/ai-chat')}>
            <Text style={s.aiLinkText}>Use AI Assistant →</Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR & FILTER TABS */}
        <View style={s.searchFilterWrap}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={14} color={L.goldDk} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by Ticket ID, service, or issue..."
              placeholderTextColor="#94A3B8"
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

          {/* CATEGORY FILTER CHIPS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>
            {['All', 'Wallet', 'Data', 'Airtime', 'Bills', 'CAC', 'Crypto', 'NIN', 'Card'].map((cat) => {
              const isSelected = selectedCategoryFilter === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategoryFilter(cat)}
                  style={[s.catFilterPill, isSelected && s.catFilterPillActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.catFilterText, isSelected && s.catFilterTextActive]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="small" color={L.goldDk} />
            <Text style={s.loadingText}>Loading support tickets...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTickets}
            keyExtractor={item => item.id}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="chatbubbles-outline" size={26} color={L.goldDk} />
                </View>
                <Text style={s.emptyTitle}>
                  {searchQuery ? 'No Matching Tickets Found' : 'No Support Tickets Yet'}
                </Text>
                <Text style={s.emptyDesc}>
                  {searchQuery ? 'Try modifying your search or filter keywords.' : 'Encountering any delay or need assistance? Open a support ticket to chat live with our dedicated support agents.'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setShowCreateModal(true)}
                  style={s.emptyCreateBtn}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#0F172A', '#1E293B']} style={s.emptyCreateBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="chatbubbles" size={14} color={L.gold} style={{ marginRight: 6 }} />
                    <Text style={s.emptyCreateBtnText}>Open New Support Ticket</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => {
              const isOpen = item.status === 'open';
              const isActive = item.status === 'in_progress';
              const statusColor = isOpen ? L.coral : isActive ? L.sky : L.emerald;
              const statusBg = isOpen ? L.coralBg : isActive ? L.skyBg : L.emeraldBg;
              const statusBorder = isOpen ? L.coralBorder : isActive ? '#BAE6FD' : L.emeraldBorder;
              const statusLabel = isOpen ? '🔴 OPEN' : isActive ? '🔵 AGENT ACTIVE' : '🟢 RESOLVED';
              const shortId = item.id.split('-')[0].toUpperCase();

              return (
                <TouchableOpacity
                  onPress={() => router.push(`/tickets/${item.id}`)}
                  style={s.ticketCard}
                  activeOpacity={0.8}
                >
                  <View style={s.ticketCardTop}>
                    <View style={s.ticketSubjectBox}>
                      <View style={s.ticketIconBadge}>
                        <Ionicons name="chatbubble-ellipses" size={12} color={L.navyHeader} />
                      </View>
                      <Text style={s.ticketSubjectText} numberOfLines={1}>
                        {item.subject}
                      </Text>
                    </View>
                    <Text style={s.ticketDateText}>
                      {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  {/* COMPACT PROGRESS STEPPER */}
                  <View style={s.stepperRow}>
                    <View style={s.stepperStep}>
                      <View style={[s.stepperDot, { backgroundColor: L.goldAmber }]} />
                      <Text style={s.stepperText}>Submitted</Text>
                    </View>
                    <View style={[s.stepperLine, { backgroundColor: isActive || !isOpen ? L.sky : '#E2E8F0' }]} />
                    <View style={s.stepperStep}>
                      <View style={[s.stepperDot, { backgroundColor: isActive || !isOpen ? L.sky : '#CBD5E1' }]} />
                      <Text style={[s.stepperText, (isActive || !isOpen) && { color: L.sky }]}>Assigned</Text>
                    </View>
                    <View style={[s.stepperLine, { backgroundColor: item.status === 'resolved' ? L.emerald : '#E2E8F0' }]} />
                    <View style={s.stepperStep}>
                      <View style={[s.stepperDot, { backgroundColor: item.status === 'resolved' ? L.emerald : '#CBD5E1' }]} />
                      <Text style={[s.stepperText, item.status === 'resolved' && { color: L.emerald }]}>Resolved</Text>
                    </View>
                  </View>

                  <View style={s.ticketCardDivider} />

                  <View style={s.ticketCardBottom}>
                    <View style={[s.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                      <Text style={[s.statusBadgeText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity onPress={() => copyTicketId(item.id)} style={s.copyIdBtn} activeOpacity={0.7}>
                        <Text style={s.ticketIdText}>#{shortId}</Text>
                        <Ionicons name="copy-outline" size={11} color={L.textMuted} />
                      </TouchableOpacity>
                      <Ionicons name="chevron-forward" size={13} color={L.goldDk} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* COMPACT CREATE TICKET MODAL */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft}>
                <View style={s.modalIconCircle}>
                  <Ionicons name="headset" size={14} color={L.gold} />
                </View>
                <Text style={s.modalTitle}>Open Support Ticket</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Select Service Category</Text>
            <View style={s.categoriesWrap}>
              {CATEGORIES.map((cat, idx) => {
                const isCatActive = selectedCategory === cat.value;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedCategory(cat.value)}
                    style={[s.categoryChip, isCatActive && s.categoryChipActive]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={cat.icon as any} size={11} color={isCatActive ? L.goldAmber : L.textMuted} style={{ marginRight: 3 }} />
                    <Text style={[s.categoryChipText, isCatActive && s.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.inputLabel}>Priority Level</Text>
            <View style={s.priorityRow}>
              {PRIORITIES.map(p => {
                const isSelected = selectedPriority === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setSelectedPriority(p.key)}
                    style={[s.priorityChip, isSelected && { backgroundColor: p.bg, borderColor: p.color }]}
                    activeOpacity={0.75}
                  >
                    <View style={[s.priorityDot, { backgroundColor: p.color }]} />
                    <Text style={[s.priorityText, isSelected && { color: p.color, fontWeight: '800' }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.inputLabel}>Transaction Ref / Order ID (Optional)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. TXN-1728392 or PV_10283"
              placeholderTextColor="#94A3B8"
              value={txnRef}
              onChangeText={setTxnRef}
              selectionColor={L.goldDk}
            />

            <Text style={s.inputLabel}>Subject / Issue Description</Text>
            <TextInput
              style={[s.modalInput, { height: 42 }]}
              placeholder="Briefly describe what you need help with..."
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
              selectionColor={L.goldDk}
            />

            <TouchableOpacity
              onPress={handleCreateTicket}
              disabled={isCreating}
              style={s.submitTicketBtn}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={s.submitTicketBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isCreating ? (
                  <ActivityIndicator color={L.gold} size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={14} color={L.gold} style={{ marginRight: 6 }} />
                    <Text style={s.submitTicketBtnText}>Connect to Live Support</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  headerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 6,
    gap: 3,
  },
  headerNewBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: L.card,
    borderBottomWidth: 1,
    borderBottomColor: L.cardBorder,
  },
  statCard: {
    flex: 1,
    backgroundColor: L.bg,
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  statCardActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  statNum: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 1,
  },
  statLabel: {
    color: L.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  responseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: L.goldLight,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 165, 32, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  responseBannerText: {
    color: L.goldAmber,
    fontSize: 9,
    fontWeight: '800',
  },
  aiLinkText: {
    color: L.navyHeader,
    fontSize: 9,
    fontWeight: '900',
  },
  searchFilterWrap: {
    backgroundColor: L.card,
    borderBottomWidth: 1,
    borderBottomColor: L.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    height: 34,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    color: L.textPrimary,
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '500',
  },
  categoryScroll: {
    gap: 5,
    paddingVertical: 2,
  },
  catFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
    backgroundColor: L.bg,
  },
  catFilterPillActive: {
    backgroundColor: L.navyHeader,
    borderColor: L.navyHeader,
  },
  catFilterText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: L.textSecondary,
  },
  catFilterTextActive: {
    color: L.gold,
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
  listContent: {
    padding: 12,
    paddingBottom: 60,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    paddingHorizontal: 20,
    backgroundColor: L.card,
    borderRadius: 16,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginTop: 6,
  },
  emptyIconCircle: {
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
  emptyTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyDesc: {
    color: L.textMuted,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 16,
  },
  emptyCreateBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  emptyCreateBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  emptyCreateBtnText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11,
  },
  ticketCard: {
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ticketSubjectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  ticketIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  ticketSubjectText: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11.5,
    flex: 1,
  },
  ticketDateText: {
    color: L.textMuted,
    fontSize: 9.5,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: L.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginVertical: 3,
  },
  stepperStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stepperDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stepperText: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
  },
  stepperLine: {
    flex: 1,
    height: 1.5,
    marginHorizontal: 6,
    borderRadius: 1,
  },
  ticketCardDivider: {
    height: 1,
    backgroundColor: L.cardBorder,
    marginVertical: 6,
  },
  ticketCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  copyIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  ticketIdText: {
    color: L.textSecondary,
    fontSize: 9.5,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: L.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: L.cardBorderGold,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: L.cardBorder,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: L.navyHeader,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13.5,
  },
  modalCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: L.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    color: L.navyHeader,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  categoryChipActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  categoryChipText: {
    color: L.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: L.goldAmber,
    fontWeight: '900',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    backgroundColor: L.bg,
    gap: 4,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  priorityText: {
    color: L.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: L.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: L.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  submitTicketBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitTicketBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  submitTicketBtnText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
});

