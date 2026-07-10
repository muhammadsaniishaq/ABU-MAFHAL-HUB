import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, TextInput, Clipboard, Alert } from 'react-native';
import { StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';

const COLORS = {
  navy: '#0E1A2E',
  gold: '#D9A73A',
  bg: '#FAFCFF',
  white: '#FFFFFF',
  textMain: '#1e293b',
  textSub: '#64748b',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export default function CACHistory() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Stats and Filters
  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    processing: requests.filter(r => r.status === 'processing').length,
    queried: requests.filter(r => r.status === 'queried').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };
  
  const TABS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'processing', label: 'In Progress' },
    { id: 'queried', label: 'Returned' },
    { id: 'completed', label: 'Completed' },
    { id: 'rejected', label: 'Rejected' },
  ];

  const filteredRequests = requests.filter(r => {
    const matchesFilter = activeFilter === 'all' || r.status === activeFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = r.registration_type?.toLowerCase().includes(searchLower) || 
                          r.proposed_names?.name1?.toLowerCase().includes(searchLower) ||
                          r.id.toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('cac_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (data) setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return COLORS.success;
      case 'queried': return COLORS.error;
      case 'processing': return COLORS.info;
      case 'rejected': return COLORS.error;
      default: return COLORS.warning;
    }
  };

  const openUrl = (url: string) => {
    if (url) Linking.openURL(url);
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Reference ID copied to clipboard.');
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={s.headerTitleArea}>
          <Text style={s.headerTitle}>CAC History</Text>
        </View>
        <TouchableOpacity onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} style={s.sortBtn}>
          <Ionicons name={sortOrder === 'desc' ? 'filter-circle' : 'filter-circle-outline'} size={24} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={s.content} 
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        {/* Search Bar */}
        {!loading && requests.length > 0 && (
          <View style={s.searchContainer}>
            <Ionicons name="search" size={18} color={COLORS.textSub} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by business name or type..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={s.clearBtn}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Filter Tabs */}
        {!loading && requests.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={s.tabsContainer}
            contentContainerStyle={s.tabsContent}
          >
            {TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              const count = counts[tab.id as keyof typeof counts] || 0;
              return (
                <TouchableOpacity 
                  key={tab.id} 
                  style={[s.tabPill, isActive && s.tabPillActive]}
                  onPress={() => setActiveFilter(tab.id)}
                >
                  <Text style={[s.tabPillTxt, isActive && s.tabPillTxtActive]}>{tab.label}</Text>
                  <View style={[s.tabCount, isActive && s.tabCountActive]}>
                    <Text style={[s.tabCountTxt, isActive && s.tabCountTxtActive]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={COLORS.navy} style={{ marginTop: 40 }} />
        ) : requests.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconBox}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.navy} />
            </View>
            <Text style={s.emptyTitle}>No CAC requests found</Text>
            <Text style={s.emptyTxt}>You haven't applied for any CAC registration yet.</Text>
            <TouchableOpacity style={s.newBtn} onPress={() => router.push('/cac-services')}>
               <Ionicons name="add" size={18} color={COLORS.white} />
               <Text style={s.newBtnTxt}>Start New Registration</Text>
            </TouchableOpacity>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="search-outline" size={48} color={COLORS.border} />
            <Text style={s.emptyTxt}>No requests match your search or filter.</Text>
          </View>
        ) : (
          filteredRequests.map((req) => (
            <View key={req.id} style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.cardIconBox}>
                  <Ionicons name="business" size={20} color={COLORS.gold} />
                </View>
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={s.regType} numberOfLines={1}>{req.registration_type}</Text>
                  <TouchableOpacity onPress={() => copyToClipboard(req.id)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={s.dateTxt}>{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}  •  REF: {req.id.substring(0,8).toUpperCase()}</Text>
                    <Ionicons name="copy-outline" size={12} color={COLORS.textSub} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
                <View style={[s.badge, { backgroundColor: getStatusColor(req.status) + '15' }]}>
                  <Text style={[s.badgeTxt, { color: getStatusColor(req.status) }]}>{req.status.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={s.divider} />
              
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Proposed Name 1</Text>
                <Text style={s.infoValue}>{req.proposed_names?.name1}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Amount Paid</Text>
                <Text style={s.infoValue}>₦{Number(req.cost_charged).toLocaleString()}</Text>
              </View>

              {req.status === 'queried' && req.admin_query && (
                <View style={s.queryBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.queryTitle}>Action Required</Text>
                    <Text style={s.queryTxt}>{req.admin_query}</Text>
                  </View>
                </View>
              )}

              {req.status === 'completed' && (
                <View style={s.downloadActions}>
                  {req.certificate_url && (
                    <TouchableOpacity style={s.downloadBtn} onPress={() => openUrl(req.certificate_url)}>
                      <Ionicons name="download-outline" size={14} color={COLORS.white} />
                      <Text style={s.downloadBtnTxt}>Certificate</Text>
                    </TouchableOpacity>
                  )}
                  {req.status_document_url && (
                    <TouchableOpacity style={[s.downloadBtn, { backgroundColor: COLORS.info }]} onPress={() => openUrl(req.status_document_url)}>
                      <Ionicons name="document-text-outline" size={14} color={COLORS.white} />
                      <Text style={s.downloadBtnTxt}>Status Report</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB - Floating Action Button */}
      {!loading && requests.length > 0 && (
        <TouchableOpacity style={s.fab} onPress={() => router.push('/cac-services')}>
          <Ionicons name="add" size={26} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: Platform.OS === 'ios' ? 50 : 40,
    backgroundColor: COLORS.white, borderBottomWidth: 2, borderBottomColor: COLORS.gold, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  backBtn: { marginRight: 12, padding: 4, backgroundColor: '#f1f5f9', borderRadius: 8 },
  headerTitleArea: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy, letterSpacing: -0.2 },
  sortBtn: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  content: { flex: 1 },
  
  tabsContainer: { marginBottom: 16 },
  tabsContent: { gap: 8, paddingVertical: 4 },
  tabPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  tabPillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.gold, borderWidth: 1.5 },
  tabPillTxt: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  tabPillTxtActive: { color: COLORS.gold },
  tabCount: { backgroundColor: COLORS.white, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabCountActive: { backgroundColor: COLORS.gold },
  tabCountTxt: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  tabCountTxtActive: { color: COLORS.navy },
  
  emptyState: { alignItems: 'center', marginTop: 80, padding: 20 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.navy },
  emptyTxt: { fontSize: 13, color: COLORS.textSub, marginTop: 8, fontWeight: '500', textAlign: 'center' },
  newBtn: { marginTop: 24, backgroundColor: COLORS.navy, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, gap: 8, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  newBtnTxt: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 13, color: COLORS.textMain },
  clearBtn: { padding: 4 },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#f1f5f9', borderLeftWidth: 4, borderLeftColor: COLORS.gold, shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.gold },
  regType: { fontSize: 14, fontWeight: '800', color: COLORS.navy, marginBottom: 2 },
  dateTxt: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12, marginHorizontal: -16 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },
  infoValue: { fontSize: 12, color: COLORS.navy, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 16 },
  
  queryBox: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 10, flexDirection: 'row', gap: 10, marginTop: 12, borderWidth: 1, borderColor: '#fecaca' },
  queryTitle: { fontSize: 11, fontWeight: '800', color: '#991b1b', marginBottom: 3 },
  queryTxt: { fontSize: 12, color: '#991b1b', fontWeight: '500', lineHeight: 18 },
  
  downloadActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  downloadBtn: { flex: 1, backgroundColor: COLORS.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, gap: 6 },
  downloadBtnTxt: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  fab: { position: 'absolute', bottom: 90, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
});
