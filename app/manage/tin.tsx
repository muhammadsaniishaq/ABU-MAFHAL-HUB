import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '../../services/supabase';
import { verificationHistory } from '../../services/verificationHistory';

const COLORS = {
  navyDark: '#070f26',
  navy: '#0d1b3e',
  navyCard: '#132347',
  gold: '#f5a623',
  goldLight: '#fef3c7',
  white: '#ffffff',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#0f172a',
  subText: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  successBg: '#dcfce7',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  info: '#2563eb',
  infoBg: '#eff6ff',
  emerald: '#059669',
  emeraldLight: '#ecfdf5',
};

export default function ManageTinScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'retrieval' | 'registration'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inspector & Action Modal
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [adminStatus, setAdminStatus] = useState<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'>('PROCESSING');
  const [issuedTin, setIssuedTin] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const allTin = await verificationHistory.getAllForAdmin('tin');
      setTasks(allTin || []);
    } catch (err) {
      console.warn('Failed to load TIN tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTasks();
  }, []);

  // Filtered List
  const filteredTasks = tasks.filter(item => {
    const details = item.details || {};
    const status = (details.status || 'PENDING').toLowerCase();
    const serviceType = item.service_type || '';

    // Status filter
    if (statusFilter !== 'all' && status !== statusFilter) return false;

    // Type filter
    if (typeFilter === 'retrieval' && !serviceType.includes('retrieval')) return false;
    if (typeFilter === 'registration' && !serviceType.includes('registration')) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (item.holder_name || '').toLowerCase();
      const num = (item.search_number || '').toLowerCase();
      const phone = (details.contactPhone || details.phone || item.profiles?.phone_number || '').toLowerCase();
      const tin = (details.generated_tin || details.retrieved_tin || details.taxId || '').toLowerCase();
      return name.includes(q) || num.includes(q) || phone.includes(q) || tin.includes(q);
    }

    return true;
  });

  // Stats calculation
  const totalCount = tasks.length;
  const pendingCount = tasks.filter(t => (t.details?.status || 'PENDING').toUpperCase() === 'PENDING').length;
  const processingCount = tasks.filter(t => (t.details?.status || '').toUpperCase() === 'PROCESSING').length;
  const completedCount = tasks.filter(t => (t.details?.status || '').toUpperCase() === 'COMPLETED').length;

  // Open task for inspection
  const openInspector = (task: any) => {
    setSelectedTask(task);
    const d = task.details || {};
    setAdminStatus((d.status || 'PROCESSING').toUpperCase() as any);
    setIssuedTin(d.generated_tin || d.retrieved_tin || d.taxId || '');
    setCertificateUrl(d.certificate_url || d.file_url || '');
    setAdminNotes(d.admin_notes || d.resolution_message || '');
  };

  // Upload PDF certificate to Supabase Storage
  const handleUploadCertificate = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (doc.canceled || !doc.assets || doc.assets.length === 0) return;

      const file = doc.assets[0];
      setUploadingPdf(true);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const ext = file.name ? file.name.split('.').pop() || 'pdf' : 'pdf';
      const filepath = `tin_certificates/${selectedTask.id}_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('cac_documents')
        .upload(filepath, decode(base64), {
          contentType: file.mimeType || 'application/pdf',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('cac_documents')
        .getPublicUrl(filepath);

      const uploadedUrl = publicUrlData.publicUrl;
      setCertificateUrl(uploadedUrl);
      Alert.alert('Upload Succeeded 🎉', 'Official Tax ID Certificate PDF uploaded successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Failed to upload certificate document.');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Save Resolution & Update Task
  const handleSaveResolution = async () => {
    if (!selectedTask) return;
    setUpdating(true);

    try {
      const updatedDetails = {
        ...(selectedTask.details || {}),
        status: adminStatus,
        generated_tin: issuedTin.trim() || selectedTask.details?.generated_tin,
        retrieved_tin: issuedTin.trim() || selectedTask.details?.retrieved_tin,
        certificate_url: certificateUrl.trim() || selectedTask.details?.certificate_url,
        admin_notes: adminNotes.trim(),
        resolution_message: adminNotes.trim(),
        resolved_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('verification_history')
        .update({
          details: updatedDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      // Create in-app notification for the user
      if (selectedTask.user_id && selectedTask.user_id !== 'guest_user') {
        try {
          await supabase.from('notifications').insert({
            user_id: selectedTask.user_id,
            title: adminStatus === 'COMPLETED' ? 'Tax ID / Certificate Ready! 📄' : 'TIN Request Status Update',
            message: adminStatus === 'COMPLETED'
              ? `Your Tax ID (${issuedTin.trim() || 'Issued'}) and official certificate are ready for download.`
              : `Your TIN request status has been updated to ${adminStatus}. ${adminNotes ? `Note: ${adminNotes}` : ''}`,
            type: 'system',
            priority: 'high',
            is_read: false,
          });
        } catch (_) {}
      }

      Alert.alert('Task Updated 🎉', `TIN request updated to ${adminStatus} successfully.`);
      setSelectedTask(null);
      fetchTasks();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Failed to update TIN task.');
    } finally {
      setUpdating(false);
    }
  };

  // Direct Customer Contact Actions
  const handleContactCustomer = (type: 'whatsapp' | 'call' | 'email') => {
    const details = selectedTask?.details || {};
    const phone = details.contactPhone || details.phone || selectedTask?.profiles?.phone_number;
    const email = details.contactEmail || details.email || selectedTask?.profiles?.email;

    if (type === 'whatsapp' && phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const intl = cleanPhone.startsWith('0') ? `234${cleanPhone.slice(1)}` : cleanPhone;
      Linking.openURL(`https://wa.me/${intl}?text=Hello%20${encodeURIComponent(selectedTask?.holder_name || 'Customer')},%20regarding%20your%20Tax%20ID%20/%20TIN%20request%20on%20Abu%20Mafhal...`);
    } else if (type === 'call' && phone) {
      Linking.openURL(`tel:${phone}`);
    } else if (type === 'email' && email) {
      Linking.openURL(`mailto:${email}?subject=Tax%20ID%20Request%20Update%20-%20Abu%20Mafhal`);
    } else {
      Alert.alert('Contact Missing', `No valid ${type} detail found for this customer.`);
    }
  };

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied 📋', `${label} copied to clipboard.`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.navy} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>TIN & Tax ID Desk Hub</Text>
          <Text style={styles.headerSubtitle}>JRB / JTB & FIRS Operations Control</Text>
        </View>

        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginRight: 6 }]} 
          onPress={() => router.push('/manage/tin-pricing' as any)}
        >
          <Ionicons name="pricetag" size={16} color="#059669" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchTasks}>
          <Ionicons name="refresh" size={18} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      {/* ── STATS CARDS ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.warning, borderLeftWidth: 3 }]}>
          <Text style={[styles.statNumber, { color: COLORS.warning }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.info, borderLeftWidth: 3 }]}>
          <Text style={[styles.statNumber, { color: COLORS.info }]}>{processingCount}</Text>
          <Text style={styles.statLabel}>Processing</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.success, borderLeftWidth: 3 }]}>
          <Text style={[styles.statNumber, { color: COLORS.success }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* ── SEARCH & FILTER ROW ── */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.subText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search applicant, NIN, CAC, TIN..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.subText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.filterPillText, statusFilter === 'all' && styles.filterPillTextActive]}>
              All ({tasks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'pending' && styles.filterPillActive]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text style={[styles.filterPillText, statusFilter === 'pending' && styles.filterPillTextActive]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'processing' && styles.filterPillActive]}
            onPress={() => setStatusFilter('processing')}
          >
            <Text style={[styles.filterPillText, statusFilter === 'processing' && styles.filterPillTextActive]}>
              Processing ({processingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'completed' && styles.filterPillActive]}
            onPress={() => setStatusFilter('completed')}
          >
            <Text style={[styles.filterPillText, statusFilter === 'completed' && styles.filterPillTextActive]}>
              Completed ({completedCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── TASK LIST ── */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.navy} style={{ marginTop: 40 }} />
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={42} color={COLORS.subText} />
            <Text style={styles.emptyTitle}>No matching TIN tasks found</Text>
            <Text style={styles.emptyDesc}>Try adjusting search query or status filter.</Text>
          </View>
        ) : (
          filteredTasks.map(item => {
            const details = item.details || {};
            const status = (details.status || 'PENDING').toUpperCase();
            const issued = details.generated_tin || details.retrieved_tin || details.taxId;
            const cert = details.certificate_url || details.file_url;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.taskCard}
                onPress={() => openInspector(item)}
                activeOpacity={0.85}
              >
                <View style={styles.taskCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskHolderName}>{item.holder_name}</Text>
                    <Text style={styles.taskSubDetail}>
                      {item.service_type === 'tin_certificate_retrieval' ? '📄 Tax ID Certificate Retrieval' : '✍️ New TIN Registration'}
                    </Text>
                  </View>

                  <View style={[
                    styles.statusPill,
                    status === 'COMPLETED' ? styles.statusPillCompleted :
                    status === 'PROCESSING' ? styles.statusPillProcessing :
                    status === 'REJECTED' ? styles.statusPillRejected : styles.statusPillPending
                  ]}>
                    <Text style={[
                      styles.statusPillText,
                      status === 'COMPLETED' ? styles.statusPillCompletedText :
                      status === 'PROCESSING' ? styles.statusPillProcessingText :
                      status === 'REJECTED' ? styles.statusPillRejectedText : styles.statusPillPendingText
                    ]}>
                      {status}
                    </Text>
                  </View>
                </View>

                {/* Key metadata row */}
                <View style={styles.taskMetaGrid}>
                  <View style={styles.taskMetaItem}>
                    <Text style={styles.taskMetaLabel}>Reference:</Text>
                    <Text style={styles.taskMetaVal}>{item.search_number}</Text>
                  </View>
                  <View style={styles.taskMetaItem}>
                    <Text style={styles.taskMetaLabel}>Category:</Text>
                    <Text style={styles.taskMetaVal}>
                      {details.category === 'individual' ? '👤 Individual' : `🏢 Non-Indiv (${details.entityType || 'Corp'})`}
                    </Text>
                  </View>
                </View>

                {issued ? (
                  <View style={styles.issuedTinRow}>
                    <Ionicons name="pricetag" size={14} color={COLORS.emerald} />
                    <Text style={styles.issuedTinText}>Issued TIN: {issued}</Text>
                  </View>
                ) : null}

                {cert ? (
                  <View style={styles.certAttachedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.info} />
                    <Text style={styles.certAttachedText}>Official Certificate Attached</Text>
                  </View>
                ) : null}

                <View style={styles.taskFooter}>
                  <Text style={styles.taskDate}>
                    {new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.actionInspectText}>Manage & Resolve</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.info} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── INSPECTOR & RESOLUTION MODAL ── */}
      <Modal visible={!!selectedTask} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.inspectorCard}>
            <View style={styles.inspectorHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inspectorTitle}>{selectedTask?.holder_name}</Text>
                <Text style={styles.inspectorSubtitle}>
                  {selectedTask?.service_type === 'tin_certificate_retrieval' ? '📄 Tax ID Certificate Retrieval' : '✍️ New TIN Registration'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTask(null)}>
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: '78%' }} showsVerticalScrollIndicator={false}>
              {/* Customer Contact Bar */}
              <View style={styles.contactBar}>
                <TouchableOpacity style={styles.contactIconBtn} onPress={() => handleContactCustomer('whatsapp')}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={styles.contactIconText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.contactIconBtn} onPress={() => handleContactCustomer('call')}>
                  <Ionicons name="call" size={16} color={COLORS.navy} />
                  <Text style={styles.contactIconText}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.contactIconBtn} onPress={() => handleContactCustomer('email')}>
                  <Ionicons name="mail" size={16} color={COLORS.info} />
                  <Text style={styles.contactIconText}>Email</Text>
                </TouchableOpacity>
              </View>

              {/* Submitted Details Box */}
              <View style={styles.detailSectionBox}>
                <Text style={styles.detailSectionHeader}>Application Details</Text>
                
                {selectedTask?.details?.firstName ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>First Name:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.firstName}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.lastName ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Last Name:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.lastName}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.nin ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>NIN:</Text>
                    <TouchableOpacity onPress={() => copyText(selectedTask.details.nin, 'NIN')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.detailVal, { color: COLORS.info, fontWeight: '700' }]}>{selectedTask.details.nin}</Text>
                      <Ionicons name="copy-outline" size={14} color={COLORS.info} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {selectedTask?.details?.dob ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date of Birth:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.dob}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.cacRegNumber ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>CAC Reg Number:</Text>
                    <TouchableOpacity onPress={() => copyText(selectedTask.details.cacRegNumber, 'CAC Number')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.detailVal, { color: COLORS.info, fontWeight: '700' }]}>{selectedTask.details.cacRegNumber}</Text>
                      <Ionicons name="copy-outline" size={14} color={COLORS.info} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {selectedTask?.details?.organizationType ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Org Type:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.organizationType}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.dateOfIncorporation ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Incorp Date:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.dateOfIncorporation}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.registeredName ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registered Name:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.registeredName}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.contactPhone ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.contactPhone}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.contactEmail ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.contactEmail}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.address ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Address:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.address}</Text>
                  </View>
                ) : null}

                {selectedTask?.details?.state ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>State / LGA:</Text>
                    <Text style={styles.detailVal}>{selectedTask.details.state} {selectedTask.details.lga ? `(${selectedTask.details.lga})` : ''}</Text>
                  </View>
                ) : null}
              </View>

              {/* ── ADMIN RESOLUTION PANEL ── */}
              <View style={styles.resolutionPanel}>
                <Text style={styles.resolutionHeader}>Admin Resolution & Delivery</Text>

                {/* Status Segment */}
                <Text style={styles.adminFieldLabel}>Update Request Status</Text>
                <View style={styles.statusSegment}>
                  {(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'] as const).map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusOption, adminStatus === st && styles.statusOptionActive]}
                      onPress={() => setAdminStatus(st)}
                    >
                      <Text style={[styles.statusOptionText, adminStatus === st && styles.statusOptionTextActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Issued TIN */}
                <Text style={styles.adminFieldLabel}>Issued / Retrieved Tax ID (TIN)</Text>
                <TextInput
                  style={styles.adminInput}
                  placeholder="e.g. 12345678-0001 or 2345678910"
                  placeholderTextColor="#94a3b8"
                  value={issuedTin}
                  onChangeText={setIssuedTin}
                />

                {/* Upload Certificate PDF */}
                <Text style={styles.adminFieldLabel}>Official Certificate Document</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handleUploadCertificate}
                    disabled={uploadingPdf}
                  >
                    {uploadingPdf ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="cloud-upload" size={16} color={COLORS.white} />
                        <Text style={styles.uploadBtnText}>Upload PDF / Image</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {certificateUrl ? (
                    <TouchableOpacity
                      style={styles.viewDocBtn}
                      onPress={() => WebBrowser.openBrowserAsync(certificateUrl)}
                    >
                      <Ionicons name="eye" size={16} color={COLORS.navy} />
                      <Text style={styles.viewDocBtnText}>View File</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TextInput
                  style={styles.adminInput}
                  placeholder="Or paste public certificate URL"
                  placeholderTextColor="#94a3b8"
                  value={certificateUrl}
                  onChangeText={setCertificateUrl}
                />

                {/* Admin Feedback / Notes */}
                <Text style={styles.adminFieldLabel}>Customer Feedback / Notes</Text>
                <TextInput
                  style={[styles.adminInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Notes or query message visible to customer..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                />

                {/* Save Resolution Button */}
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveResolution}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  {updating ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Resolution & Deliver to User</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.subText,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.subText,
    marginTop: 2,
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  pillsScroll: {
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  listScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.subText,
    marginTop: 2,
  },
  taskCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskHolderName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
  },
  taskSubDetail: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillPending: { backgroundColor: COLORS.warningBg },
  statusPillPendingText: { color: COLORS.warning, fontSize: 10, fontWeight: '700' },
  statusPillProcessing: { backgroundColor: COLORS.infoBg },
  statusPillProcessingText: { color: COLORS.info, fontSize: 10, fontWeight: '700' },
  statusPillCompleted: { backgroundColor: COLORS.successBg },
  statusPillCompletedText: { color: COLORS.success, fontSize: 10, fontWeight: '700' },
  statusPillRejected: { backgroundColor: COLORS.dangerBg },
  statusPillRejectedText: { color: COLORS.danger, fontSize: 10, fontWeight: '700' },
  taskMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  taskMetaItem: {
    flex: 1,
  },
  taskMetaLabel: {
    fontSize: 11,
    color: COLORS.subText,
  },
  taskMetaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 1,
  },
  issuedTinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.emeraldLight,
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  issuedTinText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  certAttachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.infoBg,
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  certAttachedText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.info,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  taskDate: {
    fontSize: 11,
    color: COLORS.subText,
  },
  actionInspectText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.info,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  inspectorCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  inspectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  inspectorSubtitle: {
    fontSize: 12,
    color: COLORS.subText,
    marginTop: 2,
  },
  contactBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactIconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailSectionBox: {
    paddingVertical: 12,
    gap: 6,
  },
  detailSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.subText,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  resolutionPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    marginBottom: 20,
  },
  resolutionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  adminFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statusSegment: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#e2e8f0',
    padding: 3,
    borderRadius: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  statusOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusOptionText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subText,
  },
  statusOptionTextActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },
  adminInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: COLORS.text,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: COLORS.emerald,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.navy,
    borderRadius: 8,
    height: 40,
  },
  viewDocBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navy,
  },
  saveBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});

