import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Modal, Alert, StyleSheet, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { sendTicketCreatedEmail } from '../../../services/ticketEmail';

const { width: W } = Dimensions.get('window');

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  description?: string;
};

const CATEGORIES = [
  { label: "💳 Wallet & Funding", value: "Wallet Funding Issue", icon: "wallet-outline", hint: "Deposit delay, Monnify, Payvessel" },
  { label: "📶 Data & Airtime", value: "Data or Airtime Delay", icon: "wifi-outline", hint: "MTN, Glo, Airtel, 9mobile VTU" },
  { label: "⚡ NEPA & Bills", value: "Bill Payment Issue", icon: "flash-outline", hint: "Meter token, Disco, Cable TV" },
  { label: "📜 CAC & Business", value: "CAC Registration Inquiry", icon: "briefcase-outline", hint: "Business name, RC, status" },
  { label: "🪙 Crypto Trading", value: "Crypto Trading Issue", icon: "logo-bitcoin", hint: "USDT, Bitcoin, Deriv" },
  { label: "🆔 NIN & Identity", value: "NIN/BVN Inquiry", icon: "finger-print-outline", hint: "Verification, slip reprint" },
  { label: "💳 Virtual Cards", value: "Dollar Card Issue", icon: "card-outline", hint: "Funding, decline, freeze" },
  { label: "👨‍💻 Other Support", value: "General Inquiry", icon: "help-buoy-outline", hint: "Account, app, feedback" },
];

const PRIORITIES = [
  { key: 'normal', label: 'Standard', color: '#10b981' },
  { key: 'high', label: 'Urgent', color: '#f5a623' },
  { key: 'critical', label: 'Critical / Blocked', color: '#ef4444' },
];

export default function UserTicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
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
        .limit(40);

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

  const openCount = tickets.filter(t => t.status === 'open').length;
  const activeCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  const filteredTickets = tickets
    .filter(t => {
      if (filter === 'all') return true;
      return t.status === filter;
    })
    .filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ 
        title: 'Support Desk',
        headerShown: true,
        headerStyle: { backgroundColor: '#060d21' },
        headerTintColor: '#f5a623',
        headerTitleStyle: { fontWeight: '900', fontSize: 16 },
        headerRight: () => (
          <TouchableOpacity 
            onPress={() => setShowCreateModal(true)} 
            style={s.headerNewBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#060d21" />
            <Text style={s.headerNewBtnText}>New Ticket</Text>
          </TouchableOpacity>
        )
      }} />

      {/* QUICK STATS CARDS */}
      <View style={s.statsRow}>
        <View style={[s.statCard, { borderColor: 'rgba(245, 166, 35, 0.3)' }]}>
          <Text style={s.statNum}>{tickets.length}</Text>
          <Text style={s.statLabel}>Total Tickets</Text>
        </View>
        <View style={[s.statCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
          <Text style={[s.statNum, { color: '#ef4444' }]}>{openCount}</Text>
          <Text style={s.statLabel}>🔴 Open</Text>
        </View>
        <View style={[s.statCard, { borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
          <Text style={[s.statNum, { color: '#3b82f6' }]}>{activeCount}</Text>
          <Text style={s.statLabel}>🔵 Active</Text>
        </View>
        <View style={[s.statCard, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
          <Text style={[s.statNum, { color: '#10b981' }]}>{resolvedCount}</Text>
          <Text style={s.statLabel}>🟢 Closed</Text>
        </View>
      </View>

      {/* SEARCH BAR & FILTER TABS */}
      <View style={s.searchFilterWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={15} color="#f5a623" />
          <TextInput
            style={s.searchInput}
            placeholder="Search tickets by ID or topic..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            selectionColor="#f5a623"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.tabsRow}>
          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: `Open (${openCount})` },
            { key: 'in_progress', label: `Active (${activeCount})` },
            { key: 'resolved', label: `Closed (${resolvedCount})` },
          ].map(tab => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key as any)}
                style={[s.tabPill, isActive && s.tabPillActive]}
                activeOpacity={0.75}
              >
                <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={s.loadingText}>Loading your support tickets...</Text>
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
                <Ionicons name="headset-outline" size={32} color="#f5a623" />
              </View>
              <Text style={s.emptyTitle}>
                {searchQuery ? 'No Matching Tickets Found' : 'No Support Tickets'}
              </Text>
              <Text style={s.emptyDesc}>
                {searchQuery ? 'Try clearing your search query.' : 'Need help with a transaction or service? Create a support ticket to chat live with our support agents.'}
              </Text>
              <TouchableOpacity 
                onPress={() => setShowCreateModal(true)}
                style={s.emptyCreateBtn}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#f5a623', '#d97706']} style={s.emptyCreateBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="chatbubbles" size={16} color="#060d21" style={{ marginRight: 6 }} />
                  <Text style={s.emptyCreateBtnText}>Open New Ticket</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const isOpen = item.status === 'open';
            const isActive = item.status === 'in_progress';
            const statusColor = isOpen ? '#ef4444' : isActive ? '#3b82f6' : '#10b981';
            const statusBg = isOpen ? 'rgba(239, 68, 68, 0.12)' : isActive ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)';
            const statusBorder = isOpen ? 'rgba(239, 68, 68, 0.3)' : isActive ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)';
            const statusLabel = isOpen ? '🔴 OPEN' : isActive ? '🔵 ACTIVE AGENT' : '🟢 RESOLVED';

            return (
              <TouchableOpacity
                onPress={() => router.push(`/tickets/${item.id}`)}
                style={s.ticketCard}
                activeOpacity={0.8}
              >
                <View style={s.ticketCardTop}>
                  <View style={s.ticketSubjectBox}>
                    <View style={s.ticketIconBadge}>
                      <Ionicons name="chatbubbles" size={13} color="#f5a623" />
                    </View>
                    <Text style={s.ticketSubjectText} numberOfLines={1}>
                      {item.subject}
                    </Text>
                  </View>
                  <Text style={s.ticketDateText}>
                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>

                {/* VISUAL STATUS STEPPER */}
                <View style={s.stepperRow}>
                  <View style={s.stepperStep}>
                    <View style={[s.stepperDot, { backgroundColor: '#f5a623' }]} />
                    <Text style={s.stepperText}>Submitted</Text>
                  </View>
                  <View style={[s.stepperLine, { backgroundColor: isActive || !isOpen ? '#3b82f6' : '#1e293b' }]} />
                  <View style={s.stepperStep}>
                    <View style={[s.stepperDot, { backgroundColor: isActive || !isOpen ? '#3b82f6' : '#1e293b' }]} />
                    <Text style={[s.stepperText, (isActive || !isOpen) && { color: '#93c5fd' }]}>Assigned</Text>
                  </View>
                  <View style={[s.stepperLine, { backgroundColor: item.status === 'resolved' ? '#10b981' : '#1e293b' }]} />
                  <View style={s.stepperStep}>
                    <View style={[s.stepperDot, { backgroundColor: item.status === 'resolved' ? '#10b981' : '#1e293b' }]} />
                    <Text style={[s.stepperText, item.status === 'resolved' && { color: '#86efac' }]}>Resolved</Text>
                  </View>
                </View>

                <View style={s.ticketCardDivider} />

                <View style={s.ticketCardBottom}>
                  <View style={[s.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                    <Text style={[s.statusBadgeText, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>

                  <View style={s.ticketIdBox}>
                    <Ionicons name="ticket-outline" size={13} color="#94a3b8" />
                    <Text style={s.ticketIdText}>#{item.id.split('-')[0].toUpperCase()}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#f5a623" style={{ marginLeft: 4 }} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* NEW TICKET MODAL */}
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
                  <Ionicons name="headset" size={16} color="#f5a623" />
                </View>
                <Text style={s.modalTitle}>Open Support Ticket</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Department / Category</Text>
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
                    <Ionicons name={cat.icon as any} size={12} color={isCatActive ? '#f5a623' : '#94a3b8'} style={{ marginRight: 4 }} />
                    <Text style={[s.categoryChipText, isCatActive && s.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.inputLabel}>Urgency Priority</Text>
            <View style={s.priorityRow}>
              {PRIORITIES.map(p => {
                const isSelected = selectedPriority === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setSelectedPriority(p.key)}
                    style={[s.priorityChip, isSelected && { backgroundColor: `${p.color}25`, borderColor: p.color }]}
                    activeOpacity={0.75}
                  >
                    <View style={[s.priorityDot, { backgroundColor: p.color }]} />
                    <Text style={[s.priorityText, isSelected && { color: p.color }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.inputLabel}>Transaction Ref / Details (Optional)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. TXN-998234 or brief details..."
              placeholderTextColor="#64748b"
              value={txnRef}
              onChangeText={setTxnRef}
              selectionColor="#f5a623"
            />

            <Text style={s.inputLabel}>Subject / Description</Text>
            <TextInput
              style={[s.modalInput, { height: 48 }]}
              placeholder="Describe what you need help with..."
              placeholderTextColor="#64748b"
              value={subject}
              onChangeText={setSubject}
              selectionColor="#f5a623"
            />

            <TouchableOpacity
              onPress={handleCreateTicket}
              disabled={isCreating}
              style={s.submitTicketBtn}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#f5a623', '#d97706']}
                style={s.submitTicketBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isCreating ? (
                  <ActivityIndicator color="#060d21" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="#060d21" style={{ marginRight: 8 }} />
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
    backgroundColor: '#040814',
  },
  headerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5a623',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 6,
  },
  headerNewBtnText: {
    color: '#060d21',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 3,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#060d21',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#09132e',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNum: {
    color: '#f5a623',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 2,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  searchFilterWrap: {
    backgroundColor: '#060d21',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1633',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  tabPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0c1633',
  },
  tabPillActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderColor: '#f5a623',
  },
  tabPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabPillTextActive: {
    color: '#f5a623',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingBottom: 60,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 45,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0c1633',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyCreateBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  emptyCreateBtnText: {
    color: '#060d21',
    fontWeight: '900',
    fontSize: 13,
  },
  ticketCard: {
    backgroundColor: '#09132e',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  ticketCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ticketSubjectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  ticketIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ticketSubjectText: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 13.5,
    flex: 1,
  },
  ticketDateText: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1633',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 4,
  },
  stepperStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepperText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '700',
  },
  stepperLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 1,
  },
  ticketCardDivider: {
    height: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    marginVertical: 10,
  },
  ticketCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  ticketIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketIdText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#060d21',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15.5,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0c1633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#0c1633',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.18)',
    borderColor: '#f5a623',
  },
  categoryChipText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#f5a623',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0c1633',
    gap: 5,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#0c1633',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 12,
  },
  submitTicketBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitTicketBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  submitTicketBtnText: {
    color: '#060d21',
    fontWeight: '900',
    fontSize: 13.5,
  },
});
