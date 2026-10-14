import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, Modal, ScrollView, Image, StyleSheet,
  Platform, Dimensions, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  navy:    '#0F172A',
  navyMid: '#1E293B',
  gold:    '#D97706',
  goldL:   '#FEF3C7',
  goldB:   '#FCD34D',
  white:   '#FFFFFF',
  bg:      '#F5F3EE',
  text:    '#0F172A',
  textSub: '#475569',
  border:  '#E2E8F0',
  green:   '#16A34A',
  greenL:  '#F0FDF4',
  red:     '#DC2626',
  redL:    '#FEF2F2',
  orange:  '#EA580C',
  orangeL: '#FFF7ED',
  indigo:  '#4F46E5',
  indigoL: '#EEF2FF',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
};

type Transaction = {
  id: string;
  type: string;
  amount: string | number;
  status: string;
  description: string | null;
  reference: string | null;
  created_at: string;
  user_id: string;
  profile?: Profile | null;
};

type StatsType = {
  total: number;
  volume: number;
  success: number;
  pending: number;
  failed: number;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  success:   { color: T.green,  bg: T.greenL,  icon: 'checkmark-circle' },
  pending:   { color: T.orange, bg: T.orangeL, icon: 'time' },
  failed:    { color: T.red,    bg: T.redL,    icon: 'close-circle' },
  cancelled: { color: T.textSub,bg: '#F1F5F9', icon: 'ban' },
};

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  deposit:    { color: T.green,  bg: T.greenL,  icon: 'arrow-down',   label: 'Deposit' },
  withdrawal: { color: T.red,    bg: T.redL,    icon: 'arrow-up',     label: 'Withdrawal' },
  transfer:   { color: T.indigo, bg: T.indigoL, icon: 'swap-horizontal', label: 'Transfer' },
  data:       { color: T.gold,   bg: T.goldL,   icon: 'cellular',     label: 'Data' },
  airtime:    { color: '#7C3AED',bg: '#F5F3FF', icon: 'call',         label: 'Airtime' },
  bills:      { color: T.navy,   bg: '#F1F5F9', icon: 'receipt',      label: 'Bills' },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type?.toLowerCase()] ?? { color: T.textSub, bg: '#F1F5F9', icon: 'card', label: type || 'Transaction' };
}
function getStatusConfig(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? { color: T.textSub, bg: '#F1F5F9', icon: 'ellipse' };
}

function avatarText(name: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name[0].toUpperCase();
}

// ─── Avatar component ─────────────────────────────────────────────────────────
function UserAvatar({ profile, size = 40 }: { profile?: Profile | null; size?: number }) {
  const initials = avatarText(profile?.full_name ?? null);
  if (profile?.avatar_url) {
    return (
      <Image
        source={{ uri: profile.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E2E8F0' }}
      />
    );
  }
  return (
    <LinearGradient
      colors={[T.navy, T.navyMid]}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: T.goldB, fontWeight: '900', fontSize: size * 0.38 }}>{initials}</Text>
    </LinearGradient>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, iconName, iconColor, iconBg }: {
  label: string; value: string; sub?: string;
  iconName: string; iconColor: string; iconBg: string;
}) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={16} color={iconColor} />
      </View>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const tc = getTypeConfig(tx.type);
  const sc = getStatusConfig(tx.status);
  const amount = parseFloat(String(tx.amount || 0));
  const isCredit = tx.type === 'deposit';
  return (
    <TouchableOpacity style={s.txRow} onPress={onPress} activeOpacity={0.75}>
      {/* Left: type icon */}
      <View style={[s.txIconBox, { backgroundColor: tc.bg }]}>
        <Ionicons name={tc.icon as any} size={18} color={tc.color} />
      </View>

      {/* Middle: user + description */}
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <UserAvatar profile={tx.profile} size={22} />
          <Text style={s.txUser} numberOfLines={1}>
            {tx.profile?.full_name || 'Unknown User'}
          </Text>
        </View>
        <Text style={s.txDesc} numberOfLines={1}>{tx.description || tc.label}</Text>
        <Text style={s.txRef} numberOfLines={1}>
          {tx.reference || tx.id.substring(0, 12)} · {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Right: amount + status */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.txAmount, { color: isCredit ? T.green : T.navy }]}>
          {isCredit ? '+' : '-'}₦{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </Text>
        <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon as any} size={9} color={sc.color} />
          <Text style={[s.statusTxt, { color: sc.color }]}>{tx.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────
function UserTxModal({ userId, profile, visible, onClose }: {
  userId: string; profile?: Profile | null; visible: boolean; onClose: () => void;
}) {
  const [txList, setTxList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({ total: 0, volume: 0, success: 0 });

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setTxList(data);
          const vol = data.reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
          const suc = data.filter(t => t.status === 'success').length;
          setUserStats({ total: data.length, volume: vol, success: suc });
        }
        setLoading(false);
      });
  }, [visible, userId]);

  const name = profile?.full_name || 'Unknown User';
  const email = profile?.email || '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        {/* Modal Header */}
        <LinearGradient colors={[T.navy, T.navyMid]} style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.modalClose}>
            <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <UserAvatar profile={profile} size={60} />
            <Text style={s.modalName}>{name}</Text>
            {email ? <Text style={s.modalEmail}>{email}</Text> : null}
            {profile?.phone ? <Text style={s.modalEmail}>{profile.phone}</Text> : null}
          </View>
          {/* Mini stats */}
          <View style={s.modalStats}>
            <View style={s.modalStatItem}>
              <Text style={s.modalStatVal}>{userStats.total}</Text>
              <Text style={s.modalStatLbl}>Transactions</Text>
            </View>
            <View style={[s.modalStatItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]}>
              <Text style={s.modalStatVal}>₦{(userStats.volume / 1000).toFixed(1)}k</Text>
              <Text style={s.modalStatLbl}>Volume</Text>
            </View>
            <View style={s.modalStatItem}>
              <Text style={s.modalStatVal}>{userStats.total > 0 ? ((userStats.success / userStats.total) * 100).toFixed(0) : 0}%</Text>
              <Text style={s.modalStatLbl}>Success Rate</Text>
            </View>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={T.gold} size="large" />
            <Text style={{ color: T.textSub, marginTop: 12, fontWeight: '700' }}>Loading transactions…</Text>
          </View>
        ) : txList.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="receipt-outline" size={48} color={T.border} />
            <Text style={{ color: T.textSub, marginTop: 12, fontWeight: '700' }}>No transactions found</Text>
          </View>
        ) : (
          <FlatList
            data={txList}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const tc = getTypeConfig(item.type);
              const sc = getStatusConfig(item.status);
              const amount = parseFloat(String(item.amount || 0));
              const isCredit = item.type === 'deposit';
              return (
                <View style={s.modalTxCard}>
                  <View style={[s.txIconBox, { backgroundColor: tc.bg }]}>
                    <Ionicons name={tc.icon as any} size={16} color={tc.color} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={s.txDesc}>{item.description || tc.label}</Text>
                    <Text style={s.txRef}>
                      {item.reference || item.id.substring(0, 12)} · {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.txAmount, { color: isCredit ? T.green : T.navy }]}>
                      {isCredit ? '+' : '-'}₦{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                    <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                      <Ionicons name={sc.icon as any} size={9} color={sc.color} />
                      <Text style={[s.statusTxt, { color: sc.color }]}>{item.status}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function TransactionHistory() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<StatsType>({ total: 0, volume: 0, success: 0, pending: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  // Modal state
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalProfile, setModalProfile] = useState<Profile | null>(null);

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const from = isRefresh ? 0 : page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, type, amount, status, description, reference, created_at, user_id,
          profiles:user_id ( id, full_name, avatar_url, email, phone )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mapped: Transaction[] = (data || []).map((d: any) => ({
        ...d,
        profile: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles,
      }));

      if (isRefresh || page === 0) {
        setTransactions(mapped);
      } else {
        setTransactions(prev => [...prev, ...mapped]);
      }

      if (isRefresh || page === 0) {
        // Calculate stats from current page (approximate)
        const vol = mapped.reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
        const suc = mapped.filter(t => t.status === 'success').length;
        const pen = mapped.filter(t => t.status === 'pending').length;
        const fai = mapped.filter(t => t.status === 'failed').length;
        setStats({ total: mapped.length, volume: vol, success: suc, pending: pen, failed: fai });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => { fetchTransactions(); }, []);

  // Filter logic
  useEffect(() => {
    let list = transactions;
    if (activeFilter !== 'all') list = list.filter(t => t.status === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.profile?.full_name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.reference?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [transactions, activeFilter, search]);

  const FILTER_TABS: { key: typeof activeFilter; label: string; color: string }[] = [
    { key: 'all',     label: 'All',     color: T.navy  },
    { key: 'success', label: 'Success', color: T.green  },
    { key: 'pending', label: 'Pending', color: T.orange },
    { key: 'failed',  label: 'Failed',  color: T.red    },
  ];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <LinearGradient colors={[T.navy, T.navyMid]} style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>Transaction History</Text>
            <Text style={s.headerSub}>All Platform Transactions</Text>
          </View>
          <TouchableOpacity onPress={() => fetchTransactions(true)} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Ionicons name="search" size={15} color={T.textSub} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, type, reference…"
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={T.textSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <View style={s.filterBar}>
          {FILTER_TABS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={[s.filterTab, activeFilter === f.key && { backgroundColor: f.color }]}
            >
              <Text style={[s.filterTabTxt, activeFilter === f.key && { color: '#FFFFFF' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── Stats strip ── */}
      <View style={s.statsStrip}>
        <StatCard label="Transactions" value={String(stats.total)} iconName="receipt" iconColor={T.navy} iconBg="#F1F5F9" />
        <StatCard label="Volume" value={`₦${(stats.volume / 1000).toFixed(1)}k`} iconName="trending-up" iconColor={T.green} iconBg={T.greenL} />
        <StatCard label="Success" value={String(stats.success)} iconName="checkmark-circle" iconColor={T.green} iconBg={T.greenL} />
        <StatCard label="Pending" value={String(stats.pending)} iconName="time" iconColor={T.orange} iconBg={T.orangeL} />
        <StatCard label="Failed" value={String(stats.failed)} iconName="close-circle" iconColor={T.red} iconBg={T.redL} />
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.gold} size="large" />
          <Text style={{ color: T.textSub, marginTop: 12, fontWeight: '700' }}>Loading transactions…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 50 }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchTransactions(true)} tintColor={T.gold} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="receipt-outline" size={52} color={T.border} />
              <Text style={{ color: T.textSub, fontWeight: '700', marginTop: 12 }}>No transactions found</Text>
              {search.length > 0 && (
                <Text style={{ color: T.textSub, fontSize: 12, marginTop: 4 }}>Try a different search term</Text>
              )}
            </View>
          )}
          renderItem={({ item }) => (
            <TxRow
              tx={item}
              onPress={() => {
                setModalUserId(item.user_id);
                setModalProfile(item.profile ?? null);
              }}
            />
          )}
          onEndReached={() => {
            // Load more
            if (filtered.length >= PAGE_SIZE) {
              setPage(p => p + 1);
            }
          }}
          onEndReachedThreshold={0.4}
        />
      )}

      {/* ── User Transactions Modal ── */}
      {modalUserId && (
        <UserTxModal
          visible={!!modalUserId}
          userId={modalUserId}
          profile={modalProfile}
          onClose={() => {
            setModalUserId(null);
            setModalProfile(null);
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  // Header
  header: {
    paddingTop: Platform.OS === 'android' ? 28 : 14,
    paddingBottom: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 10, color: T.goldB, fontWeight: '700', marginTop: 1 },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: T.text,
    padding: 0,
  },

  // Filter tabs
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 6,
    paddingBottom: 4,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterTabTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  statVal: { fontSize: 11, fontWeight: '900', color: T.navy },
  statLbl: { fontSize: 8, fontWeight: '700', color: T.textSub, marginTop: 1, textAlign: 'center' },
  statSub: { fontSize: 7.5, color: T.green, fontWeight: '700' },

  // Transaction row
  txRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconBox: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  txUser: { fontSize: 11.5, fontWeight: '800', color: T.navy, flex: 1 },
  txDesc: { fontSize: 11, color: T.textSub, fontWeight: '600', marginTop: 2 },
  txRef: { fontSize: 9.5, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '900' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 20, gap: 3, marginTop: 4,
  },
  statusTxt: { fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase' },

  // Modal
  modalHeader: {
    paddingTop: Platform.OS === 'android' ? 28 : 50,
    paddingBottom: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  modalClose: {
    alignSelf: 'center',
    width: 44, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  modalName: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 10 },
  modalEmail: { fontSize: 11, color: T.goldB, fontWeight: '700', marginTop: 2 },
  modalStats: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  modalStatVal: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  modalStatLbl: { fontSize: 9, fontWeight: '700', color: T.goldB, marginTop: 2 },

  modalTxCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
  },
});
