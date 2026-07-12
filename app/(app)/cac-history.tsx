import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, TextInput, Clipboard, Alert, Modal } from 'react-native';
import { StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

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
  const [detailsReq, setDetailsReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Correction Modal State
  const [correctionReq, setCorrectionReq] = useState<any>(null);
  const [correctionMsg, setCorrectionMsg] = useState('');
  const [correctionDoc, setCorrectionDoc] = useState<any>(null);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

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

  const openUrl = async (url: string) => {
    if (!url) return;
    try {
      const rawFilename = url.split('/').pop() || 'document.pdf';
      const filename = rawFilename.split('?')[0]; // Remove query params like ?t=123
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      
      const isImage = uri.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
      
      let savedToGallery = false;
      if (isImage) {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert('Success', 'Image saved directly to your phone gallery!');
            savedToGallery = true;
          }
        } catch (mediaErr) {
          console.log("MediaLibrary failed, falling back to Sharing:", mediaErr);
        }
      }
      
      if (!savedToGallery) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Download / Save Document' });
      }
    } catch (e: any) {
      console.log("Download Error:", e);
      Alert.alert('Download Error', e.message || 'Could not download the file.');
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Reference ID copied to clipboard.');
  };

  const pickCorrectionDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!res.canceled) setCorrectionDoc(res.assets[0]);
    } catch (e) {}
  };

  const submitCorrection = async () => {
    if (!correctionMsg && !correctionDoc) {
      return Alert.alert('Error', 'Please enter a message or attach a document to submit your correction.');
    }
    
    setSubmittingCorrection(true);
    try {
      let publicUrl = '';
      if (correctionDoc) {
        const response = await fetch(correctionDoc.uri);
        const blob = await response.blob();
        const filename = `cac_corrections/${correctionReq.id}_${Date.now()}`;
        const { error } = await supabase.storage.from('cac_documents').upload(filename, blob);
        if (error) throw error;
        const { data } = supabase.storage.from('cac_documents').getPublicUrl(filename);
        publicUrl = data.publicUrl;
      }
      
      const replyText = `\n\n--- USER CORRECTION ---\nMessage: ${correctionMsg}\n${publicUrl ? 'Attached Doc: ' + publicUrl : ''}`;
      const updatedQuery = (correctionReq.admin_query || '') + replyText;
      
      const { error: dbErr } = await supabase.from('cac_requests').update({
        status: 'pending',
        admin_query: updatedQuery
      }).eq('id', correctionReq.id);
      
      if (dbErr) throw dbErr;
      
      Alert.alert('Success', 'Your correction has been submitted and is under review.');
      setCorrectionReq(null);
      setCorrectionMsg('');
      setCorrectionDoc(null);
      fetchRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingCorrection(false);
    }
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
            <TouchableOpacity key={req.id} style={s.card} onPress={() => setDetailsReq(req)}>
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
                    
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TouchableOpacity 
                        style={{ backgroundColor: COLORS.error, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => { setCorrectionReq(req); setCorrectionMsg(''); setCorrectionDoc(null); }}
                      >
                        <Ionicons name="build" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                        <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 'bold' }}>Quick Message</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={{ backgroundColor: COLORS.gold, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => router.push(`/cac-services?editId=${req.id}`)}
                      >
                        <Ionicons name="create-outline" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                        <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 'bold' }}>Edit Application</Text>
                      </TouchableOpacity>
                    </View>
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
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB - Floating Action Button */}
      {!loading && requests.length > 0 && (
        <TouchableOpacity style={s.fab} onPress={() => router.push('/cac-services')}>
          <Ionicons name="add" size={26} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Details Modal */}
      <Modal visible={!!detailsReq} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { height: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Application Details</Text>
              <TouchableOpacity onPress={() => setDetailsReq(null)}><Ionicons name="close" size={24} color={COLORS.navy} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {detailsReq && (
                <>
                  <Text style={s.sectionTitle}>BASIC INFO</Text>
                  <View style={s.infoBlock}>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Type</Text><Text style={s.infoValue}>{detailsReq.registration_type}</Text></View>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Choice 1</Text><Text style={s.infoValue}>{detailsReq.proposed_names?.name1}</Text></View>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Choice 2</Text><Text style={s.infoValue}>{detailsReq.proposed_names?.name2}</Text></View>
                    {detailsReq.proposed_names?.name3 && <View style={s.infoRow}><Text style={s.infoLabel}>Choice 3</Text><Text style={s.infoValue}>{detailsReq.proposed_names?.name3}</Text></View>}
                  </View>
                  
                  <Text style={s.sectionTitle}>BUSINESS DETAILS</Text>
                  <View style={s.infoBlock}>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Email</Text><Text style={s.infoValue}>{detailsReq.business_info?.email || 'N/A'}</Text></View>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Phone</Text><Text style={s.infoValue}>{detailsReq.business_info?.phone || 'N/A'}</Text></View>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Nature</Text><Text style={s.infoValue}>{detailsReq.business_info?.natureOfBusiness || 'N/A'}</Text></View>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Office</Text><Text style={s.infoValue}>{detailsReq.business_info?.officeNumber}, {detailsReq.business_info?.officeAddress}</Text></View>
                    <View style={s.infoRow}><Text style={s.infoLabel}>Location</Text><Text style={s.infoValue}>{detailsReq.business_info?.lga}, {detailsReq.business_info?.state}</Text></View>
                    {detailsReq.business_info?.tenure && <View style={s.infoRow}><Text style={s.infoLabel}>Tenure</Text><Text style={s.infoValue}>{detailsReq.business_info?.tenure} years</Text></View>}
                    {detailsReq.aims_and_objectives && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={s.infoLabel}>Aims & Objectives</Text>
                        <Text style={[s.infoValue, { textAlign: 'left', marginLeft: 0, marginTop: 4 }]}>{detailsReq.aims_and_objectives}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ height: 40 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Correction Modal */}
      <Modal visible={!!correctionReq} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Submit Correction</Text>
              <TouchableOpacity onPress={() => setCorrectionReq(null)}><Ionicons name="close" size={24} color={COLORS.navy} /></TouchableOpacity>
            </View>
            
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 12 }}>
                Please provide the requested information or upload any required documents to correct your application.
              </Text>
              
              <TextInput 
                style={s.correctionInput}
                placeholder="Type your explanation or correction here..."
                multiline
                value={correctionMsg}
                onChangeText={setCorrectionMsg}
              />
              
              <TouchableOpacity style={s.attachBtn} onPress={pickCorrectionDoc}>
                <Ionicons name="document-attach" size={20} color={COLORS.navy} />
                <Text style={s.attachBtnTxt}>{correctionDoc ? correctionDoc.name : 'Attach Document (Optional)'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={s.submitCorrBtn} onPress={submitCorrection} disabled={submittingCorrection}>
                {submittingCorrection ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.submitCorrBtnTxt}>Submit Correction</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  
  infoBlock: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textSub, marginBottom: 8, letterSpacing: 0.5, marginLeft: 4 },
  
  queryBox: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 10, flexDirection: 'row', gap: 10, marginTop: 12, borderWidth: 1, borderColor: '#fecaca' },
  queryTitle: { fontSize: 11, fontWeight: '800', color: '#991b1b', marginBottom: 3 },
  queryTxt: { fontSize: 12, color: '#991b1b', fontWeight: '500', lineHeight: 18 },
  
  downloadActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  downloadBtn: { flex: 1, backgroundColor: COLORS.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, gap: 6 },
  downloadBtnTxt: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: 350 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  correctionInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', backgroundColor: '#f8fafc', fontSize: 14, color: COLORS.textMain, marginBottom: 12 },
  attachBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, borderStyle: 'dashed', backgroundColor: '#f1f5f9', marginBottom: 20 },
  attachBtnTxt: { marginLeft: 8, fontSize: 13, color: COLORS.navy, fontWeight: '600', flex: 1 },
  submitCorrBtn: { backgroundColor: COLORS.success, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitCorrBtnTxt: { color: COLORS.white, fontSize: 14, fontWeight: '700' }
});
