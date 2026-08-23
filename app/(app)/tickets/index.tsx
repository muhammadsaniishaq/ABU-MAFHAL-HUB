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
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

const CATEGORIES = [
  { label: "💳 Wallet Funding", value: "Wallet Funding Issue" },
  { label: "📶 Data / Airtime", value: "Data or Airtime Delay" },
  { label: "📜 CAC Registration", value: "CAC Registration Inquiry" },
  { label: "🪙 Crypto & Deriv", value: "Crypto Trading Issue" },
  { label: "⚡ Electricity / Cable", value: "Bill Payment Issue" },
  { label: "🆔 NIN / BVN Services", value: "NIN/BVN Inquiry" },
  { label: "👨‍💻 General Support", value: "General Inquiry" },
];

export default function UserTicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].value);

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
        .limit(30);

      if (data) setTickets(data as any);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    const ticketSubject = subject.trim() || selectedCategory;
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          subject: ticketSubject,
          status: 'open',
          priority: 'high'
        })
        .select()
        .single();

      if (data && !error) {
        setShowCreateModal(false);
        setSubject('');
        
        // Automatic Email Notification
        sendTicketCreatedEmail(data.id, ticketSubject, user.email, user.user_metadata?.full_name);

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

  const filteredTickets = tickets.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
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

      {/* FILTER TABS */}
      <View style={s.tabsContainer}>
        <View style={s.tabsRow}>
          {[
            { key: 'all', label: 'All Tickets' },
            { key: 'open', label: '🔴 Open' },
            { key: 'in_progress', label: '🔵 Active' },
            { key: 'resolved', label: '🟢 Closed' },
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
                <Ionicons name="headset-outline" size={32} color="#f5a623" />
              </View>
              <Text style={s.emptyTitle}>No Support Tickets</Text>
              <Text style={s.emptyDesc}>
                Need help with a transaction, service, or account? Create a ticket to chat directly with our live support team.
              </Text>
              <TouchableOpacity 
                onPress={() => setShowCreateModal(true)}
                style={s.emptyCreateBtn}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#f5a623', '#d97706']} style={s.emptyCreateBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="chatbubbles" size={16} color="#060d21" style={{ marginRight: 6 }} />
                  <Text style={s.emptyCreateBtnText}>Create Support Ticket</Text>
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
            const statusLabel = isOpen ? '🔴 OPEN' : isActive ? '🔵 ACTIVE' : '🟢 CLOSED';

            return (
              <TouchableOpacity
                onPress={() => router.push(`/tickets/${item.id}`)}
                style={s.ticketCard}
                activeOpacity={0.8}
              >
                <View style={s.ticketCardTop}>
                  <View style={s.ticketSubjectBox}>
                    <Ionicons name="chatbubble-ellipses" size={15} color="#f5a623" style={{ marginRight: 8 }} />
                    <Text style={s.ticketSubjectText} numberOfLines={1}>
                      {item.subject}
                    </Text>
                  </View>
                  <Text style={s.ticketDateText}>
                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
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

            <Text style={s.inputLabel}>Select Category / Topic</Text>
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
                    <Text style={[s.categoryChipText, isCatActive && s.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.inputLabel}>Brief Details / Subject</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Describe your request or issue..."
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
                    <Text style={s.submitTicketBtnText}>Start Live Chat</Text>
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
  tabsContainer: {
    backgroundColor: '#060d21',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0c1633',
  },
  tabPillActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderColor: '#f5a623',
  },
  tabPillText: {
    fontSize: 11,
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
    padding: 14,
    paddingBottom: 60,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0c1633',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
  },
  emptyCreateBtn: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCreateBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyCreateBtnText: {
    color: '#060d21',
    fontWeight: '900',
    fontSize: 13.5,
  },
  ticketCard: {
    backgroundColor: '#09132e',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  ticketCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketSubjectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
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
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#060d21',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
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
    fontSize: 16,
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
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
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
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#f5a623',
  },
  modalInput: {
    backgroundColor: '#0c1633',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
  },
  submitTicketBtn: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  submitTicketBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  submitTicketBtnText: {
    color: '#060d21',
    fontWeight: '900',
    fontSize: 14,
  },
});
