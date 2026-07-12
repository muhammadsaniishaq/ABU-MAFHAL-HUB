import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform, Image } from 'react-native';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { decode } from 'base64-arraybuffer';

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

export default function ManageCAC() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'pricing'
  const [loading, setLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  
  // Requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [queryText, setQueryText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pricing state
  const [pricings, setPricings] = useState<any[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  // Computed Stats
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'processing' || r.status === 'queried').length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;

  const filteredRequests = requests.filter(r => 
    r.proposed_names?.name1?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'requests') {
        const { data } = await supabase.from('cac_requests').select('*, profiles(full_name, email)').order('created_at', { ascending: false });
        if (data) setRequests(data);
      } else {
        const { data } = await supabase.from('cac_pricing').select('*').order('price', { ascending: true });
        if (data) setPricings(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
    if (url) {
      setViewerUrl(url);
    }
  };

  const downloadAndShare = async (url: string) => {
    try {
      const rawFilename = url.split('/').pop() || 'document.jpg';
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
      
      // Fallback for non-images, denied permission, or MediaLibrary crash
      if (!savedToGallery) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Download / Save Document' });
      }
    } catch (e: any) {
      console.log("Download Error:", e);
      Alert.alert('Download Error', e.message || 'Could not download the file.');
    }
  };

  const updateRequestStatus = async (status: string, additionalUpdate: any = {}) => {
    if (!selectedReq) return;
    try {
      let updateData = { status, ...additionalUpdate };
      const req = selectedReq;
      
      // Refunds if rejected
      if (status === 'rejected') {
        const { error: refErr } = await supabase.rpc('refund_transaction', {
          p_user_id: req.user_id,
          p_amount: req.cost_charged,
          p_reference: `cac_refund_${req.id}`
        });
        if (refErr) throw refErr;
      }
      
      const { error } = await supabase.from('cac_requests').update(updateData).eq('id', req.id);
      if (error) throw error;

      // Handle Notifications for Completion
      if (status === 'completed') {
        const userId = req.user_id;
        const userEmail = req.profiles?.email;
        const title = `CAC Registration Completed! 🎉`;
        
        // Push notification
        if (userId) {
          const bodyMsg = `Great news! Your CAC registration (${req.registration_type}) for "${req.proposed_names?.name1}" has been completed.`;
          await supabase.from('notifications').insert([{
              user_id: userId,
              title: title,
              body: bodyMsg,
              data: { priority: 'high', route: '/cac-services' },
              created_at: new Date().toISOString()
          }]);
        }
        
        // Email
        if (userEmail) {
          const emailBody = `
            <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">Hi ${req.profiles?.full_name || 'Customer'},</p>
            <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">We are thrilled to inform you that your CAC Registration has been successfully completed!</p>
            
            <p style="margin:0 0 8px 0; color:#334155; font-size:15px;"><strong>Registration Type:</strong> ${req.registration_type}</p>
            <p style="margin:0 0 16px 0; color:#334155; font-size:15px;"><strong>Approved Name:</strong> ${req.proposed_names?.name1}</p>
            
            <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">You can now log in to your dashboard or services page to download your official Certificate and Status Document.</p>
            
            <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">Thanks for choosing Abu Mafhal Sub. We look forward to helping you!</p>
            
            <p style="margin:0 0 4px 0; color:#334155; font-size:15px;">Best,</p>
            <p style="margin:0; color:#334155; font-size:15px; font-weight:600;">The Abu Mafhal Sub Team</p>
          `;
          
          const payload = {
              type: 'email',
              recipient_mode: 'single',
              recipient: userEmail,
              subject: title,
              body: emailBody,
              priority: 'high'
          };
          
          supabase.functions.invoke('send-communication', { body: payload }).catch(e => console.log('Email send failed:', e));
        }
      }
      
      Alert.alert('Success', `Status updated to ${status}`);
      setSelectedReq(null);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleQuery = async () => {
    if (!queryText) return Alert.alert('Error', 'Enter query message');
    
    const req = selectedReq;
    if (!req) return;

    // Send In-App Notification (Broadcast style)
    const userId = req.user_id;
    const title = `CAC Registration Query`;
    const bodyMsg = `Your CAC application (${req.registration_type}) requires attention: ${queryText}`;
    
    if (userId) {
      await supabase.from('notifications').insert([{
          user_id: userId,
          title: title,
          body: bodyMsg,
          data: { priority: 'high', route: '/cac-services' },
          created_at: new Date().toISOString()
      }]);

      await supabase.from('communication_logs').insert([{
          channel: 'push',
          recipient: userId,
          subject: title,
          content: bodyMsg,
          status: 'sent',
          metadata: { priority: true, cac_query: true }
      }]);
    }

    // Send actual Email via Edge Function (Broadcast style)
    const userEmail = req.profiles?.email;
    if (userEmail) {
      const emailBody = `
        <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">Hi ${req.profiles?.full_name || 'Customer'},</p>
        <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">We have a query regarding your CAC Registration application that requires your attention.</p>
        
        <p style="margin:0 0 8px 0; color:#334155; font-size:15px; font-weight:bold;">Query Details:</p>
        <p style="margin:0 0 16px 0; color:#334155; font-size:15px; background-color:#f8fafc; padding:12px; border-left:3px solid #f5a623;">
          ${queryText.replace(/\n/g, '<br/>')}
        </p>
        
        <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">Please log in to your app and navigate to your CAC History to provide the requested information or documents so we can proceed with your registration.</p>
        
        <p style="margin:0 0 16px 0; color:#334155; font-size:15px;">If you have any questions, feel free to reply to this email.</p>
        
        <p style="margin:0 0 4px 0; color:#334155; font-size:15px;">Best,</p>
        <p style="margin:0; color:#334155; font-size:15px; font-weight:600;">The Abu Mafhal Sub Team</p>
      `;
      
      const payload = {
          type: 'email',
          recipient_mode: 'single',
          recipient: userEmail,
          subject: title,
          body: emailBody,
          priority: 'high'
      };
      
      supabase.functions.invoke('send-communication', { body: payload }).catch(e => console.log('Email send failed:', e));
      
      await supabase.from('communication_logs').insert([{
          channel: 'email',
          recipient: userEmail,
          subject: title,
          content: queryText,
          status: 'sent',
          metadata: { priority: true, cac_query: true }
      }]);
    }
    
    updateRequestStatus('queried', { admin_query: queryText });
  };

  const copyAllDetails = async () => {
    if (!selectedReq) return;
    
    let details = `CAC REGISTRATION DETAILS\n`;
    details += `------------------------\n`;
    details += `Type: ${selectedReq.registration_type}\n`;
    details += `Choice 1: ${selectedReq.proposed_names?.name1}\n`;
    details += `Choice 2: ${selectedReq.proposed_names?.name2}\n`;
    if (selectedReq.proposed_names?.name3) details += `Choice 3: ${selectedReq.proposed_names?.name3}\n`;
    
    details += `\nBUSINESS INFO\n`;
    details += `------------------------\n`;
    details += `Email: ${selectedReq.business_info?.email || 'N/A'}\n`;
    details += `Phone: ${selectedReq.business_info?.phone || 'N/A'}\n`;
    details += `Nature of Biz: ${selectedReq.business_info?.natureOfBusiness || 'N/A'}\n`;
    details += `Office: ${selectedReq.business_info?.officeNumber}, ${selectedReq.business_info?.officeAddress}\n`;
    details += `Location: ${selectedReq.business_info?.lga}, ${selectedReq.business_info?.state}\n`;
    if (selectedReq.business_info?.tenure) details += `Tenure: ${selectedReq.business_info?.tenure} years\n`;
    if (selectedReq.aims_and_objectives) details += `Aims: ${selectedReq.aims_and_objectives}\n`;

    const addPersons = (data: any, title: string) => {
        if (!data) return;
        details += `\n${title}\n`;
        details += `------------------------\n`;
        const props = Array.isArray(data) ? data : [data];
        props.forEach((p, i) => {
            details += `${i+1}. ${p.fullName} (${p.gender})\n`;
            details += `   DOB: ${p.dob} | Phone: ${p.phone} | Email: ${p.email} | NIN: ${p.nin}\n`;
            details += `   Address: ${p.houseNumber}, ${p.address}, ${p.lga}, ${p.state}\n`;
        });
    };

    addPersons(selectedReq.proprietors, 'PROPRIETORS');
    addPersons(selectedReq.chairman, 'CHAIRMAN');
    addPersons(selectedReq.secretary, 'SECRETARY');
    addPersons(selectedReq.trustees, 'TRUSTEES');

    await Clipboard.setStringAsync(details);
    Alert.alert('Success', 'All details copied to clipboard!');
  };

  const uploadDocument = async (type: 'certificate' | 'status_document' | 'memorandum') => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      
      const file = res.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
      const filename = `cac_results/${selectedReq.id}_${type}_${Date.now()}`;
      
      const { error } = await supabase.storage.from('cac_documents').upload(filename, decode(base64), { contentType: file.mimeType || 'application/pdf' });
      if (error) throw error;
      
      const { data: publicData } = supabase.storage.from('cac_documents').getPublicUrl(filename);
      
      let updateData: any = {};
      if (type === 'certificate') updateData.certificate_url = publicData.publicUrl;
      else if (type === 'status_document') updateData.status_document_url = publicData.publicUrl;
      else if (type === 'memorandum') updateData.memorandum_url = publicData.publicUrl;
        
      const { error: dbErr } = await supabase.from('cac_requests').update(updateData).eq('id', selectedReq.id);
      if (dbErr) throw dbErr;
      
      Alert.alert('Success', 'Document uploaded successfully!');
      
      setSelectedReq({ ...selectedReq, ...updateData });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const renderPersons = (data: any, title: string) => {
    if (!data) return null;
    const items = Array.isArray(data) ? data : [data];
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {items.map((p, i) => (
          <View key={i} style={s.personBox}>
            <View style={s.personHeader}>
              <Text style={s.pName}>{p.fullName}</Text>
              <View style={s.genderBadge}>
                <Text style={s.genderText}>{p.gender}</Text>
              </View>
            </View>
            
            <View style={s.pDetailsGrid}>
              <View style={s.pDetailItem}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.textSub} />
                <Text style={s.pText}>{p.dob}</Text>
              </View>
              <View style={s.pDetailItem}>
                <Ionicons name="call-outline" size={14} color={COLORS.textSub} />
                <Text style={s.pText}>{p.phone}</Text>
              </View>
              <View style={s.pDetailItem}>
                <Ionicons name="mail-outline" size={14} color={COLORS.textSub} />
                <Text style={s.pText}>{p.email}</Text>
              </View>
              <View style={s.pDetailItem}>
                <Ionicons name="card-outline" size={14} color={COLORS.textSub} />
                <Text style={s.pText}>{p.nin}</Text>
              </View>
            </View>

            <View style={s.pDetailRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSub} />
              <Text style={s.pTextAddr}>{p.houseNumber}, {p.address}, {p.lga}, {p.state}</Text>
            </View>

            <View style={s.docButtonsRow}>
              <TouchableOpacity 
                style={[s.dlBtn, !p.passportUrl && { opacity: 0.5, backgroundColor: '#f8fafc' }]} 
                onPress={() => p.passportUrl ? openUrl(p.passportUrl) : Alert.alert('Not Found', 'No passport uploaded for this person.')}
              >
                <Ionicons name="person-circle-outline" size={16} color={p.passportUrl ? COLORS.navy : COLORS.textSub} />
                <Text style={[s.dlBtnTxt, !p.passportUrl && { color: COLORS.textSub }]}>{p.passportUrl ? 'Passport' : 'No Passport'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[s.dlBtn, !p.signatureUrl && { opacity: 0.5, backgroundColor: '#f8fafc' }]} 
                onPress={() => p.signatureUrl ? openUrl(p.signatureUrl) : Alert.alert('Not Found', 'No signature uploaded for this person.')}
              >
                <Ionicons name="create-outline" size={16} color={p.signatureUrl ? COLORS.navy : COLORS.textSub} />
                <Text style={[s.dlBtnTxt, !p.signatureUrl && { color: COLORS.textSub }]}>{p.signatureUrl ? 'Signature' : 'No Signature'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const savePrice = async (id: string) => {
    const draft = priceDrafts[id];
    if (!draft) return;
    const p = parseFloat(draft);
    if (isNaN(p)) return Alert.alert('Error', 'Invalid price format');
    
    try {
      setLoading(true);
      const { error } = await supabase.from('cac_pricing').update({ price: p }).eq('id', id);
      if (error) throw error;
      Alert.alert('Success', 'Price updated successfully');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>CAC Management</Text>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, activeTab === 'requests' && s.activeTab]} onPress={() => setActiveTab('requests')}>
          <Text style={[s.tabTxt, activeTab === 'requests' && s.activeTabTxt]}>Registrations</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'pricing' && s.activeTab]} onPress={() => setActiveTab('pricing')}>
          <Text style={[s.tabTxt, activeTab === 'pricing' && s.activeTabTxt]}>Pricing setup</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator size="large" color={COLORS.navy} /> : null}

        {!loading && activeTab === 'requests' && (
          <>
            {/* Stats Row */}
            <View style={s.statsRow}>
              <View style={[s.statCard, { borderLeftColor: COLORS.info }]}>
                <Text style={s.statLabel}>Total</Text>
                <Text style={s.statValue}>{totalRequests}</Text>
              </View>
              <View style={[s.statCard, { borderLeftColor: COLORS.warning }]}>
                <Text style={s.statLabel}>Pending</Text>
                <Text style={s.statValue}>{pendingRequests}</Text>
              </View>
              <View style={[s.statCard, { borderLeftColor: COLORS.success }]}>
                <Text style={s.statLabel}>Done</Text>
                <Text style={s.statValue}>{completedRequests}</Text>
              </View>
            </View>

            {/* Search Bar */}
            <View style={s.searchContainer}>
              <Ionicons name="search-outline" size={18} color={COLORS.textSub} style={s.searchIcon} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name or user..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={COLORS.textSub}
              />
            </View>

            {filteredRequests.length === 0 && (
              <View style={s.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color={COLORS.border} />
                <Text style={s.emptyStateText}>No requests found</Text>
              </View>
            )}

            {filteredRequests.map((req) => (
              <TouchableOpacity key={req.id} style={s.reqCard} onPress={() => setSelectedReq(req)}>
                <View style={s.reqHeaderRow}>
              <Text style={s.reqName}>{req.proposed_names?.name1}</Text>
              <View style={[s.badge, { backgroundColor: getStatusColor(req.status) + '15' }]}>
                <Text style={[s.badgeTxt, { color: getStatusColor(req.status) }]}>{req.status.toUpperCase()}</Text>
              </View>
            </View>
            <View style={s.reqDetailsRow}>
              <Ionicons name="business-outline" size={14} color={COLORS.textSub} />
              <Text style={s.reqSub}>{req.registration_type}</Text>
            </View>
            <View style={s.reqDetailsRow}>
              <Ionicons name="person-outline" size={14} color={COLORS.textSub} />
              <Text style={s.reqSub}>{req.profiles?.full_name}</Text>
            </View>
            <View style={s.reqFooterRow}>
              <Text style={s.reqDate}>{new Date(req.created_at).toLocaleString()}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSub} />
            </View>
          </TouchableOpacity>
        ))}
        </>
        )}

        {!loading && activeTab === 'pricing' && (
          <View>
            <View style={s.infoBanner}>
              <Ionicons name="pricetag" size={20} color={COLORS.navy} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.infoBannerTitle}>Pricing Management</Text>
                <Text style={s.infoBannerText}>Set the costs for your CAC services. Enter the new amount and tap Save.</Text>
              </View>
            </View>

            {pricings.map((p) => (
              <View key={p.id} style={s.priceCard}>
                <Text style={s.priceName}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: COLORS.textSub, fontWeight: '600' }}>₦</Text>
                  <TextInput 
                    style={s.priceInput} 
                    defaultValue={p.price.toString()} 
                    keyboardType="numeric"
                    onChangeText={(val) => setPriceDrafts(prev => ({ ...prev, [p.id]: val }))}
                  />
                  <TouchableOpacity style={s.savePriceBtn} onPress={() => savePrice(p.id)}>
                    <Text style={s.savePriceBtnTxt}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Details Modal */}
      <Modal visible={!!selectedReq} animationType="slide" presentationStyle="pageSheet">
        {selectedReq && (
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Request Details</Text>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={copyAllDetails} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Ionicons name="copy-outline" size={16} color={COLORS.navy} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.navy }}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedReq(null)}><Ionicons name="close" size={24} color={COLORS.navy} /></TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={s.modalContent} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
              
              <Text style={s.sectionTitle}>BASIC INFO</Text>
              <View style={s.infoBlock}>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Type</Text>
                  <Text style={s.infoValue}>{selectedReq.registration_type}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Choice 1</Text>
                  <Text style={s.infoValue}>{selectedReq.proposed_names?.name1}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Choice 2</Text>
                  <Text style={s.infoValue}>{selectedReq.proposed_names?.name2}</Text>
                </View>
                {selectedReq.proposed_names?.name3 && (
                  <>
                    <View style={s.infoDivider} />
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Choice 3</Text>
                      <Text style={s.infoValue}>{selectedReq.proposed_names?.name3}</Text>
                    </View>
                  </>
                )}
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Amount Paid</Text>
                  <Text style={[s.infoValue, { color: COLORS.success, fontWeight: 'bold' }]}>₦{selectedReq.cost_charged?.toLocaleString()}</Text>
                </View>
              </View>

              <Text style={s.sectionTitle}>BUSINESS DETAILS</Text>
              <View style={s.infoBlock}>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Email</Text>
                  <Text style={s.infoValue}>{selectedReq.business_info?.email || 'N/A'}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Phone</Text>
                  <Text style={s.infoValue}>{selectedReq.business_info?.phone || 'N/A'}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Nature of Biz</Text>
                  <Text style={s.infoValue}>{selectedReq.business_info?.natureOfBusiness || 'N/A'}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Office</Text>
                  <Text style={s.infoValue}>{selectedReq.business_info?.officeNumber}, {selectedReq.business_info?.officeAddress}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Location</Text>
                  <Text style={s.infoValue}>{selectedReq.business_info?.lga}, {selectedReq.business_info?.state}</Text>
                </View>
                
                {selectedReq.business_info?.tenure && (
                  <>
                    <View style={s.infoDivider} />
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Tenure</Text>
                      <Text style={s.infoValue}>{selectedReq.business_info?.tenure} years</Text>
                    </View>
                  </>
                )}
                {selectedReq.aims_and_objectives && (
                   <>
                     <View style={s.infoDivider} />
                     <View style={s.infoRowCol}>
                       <Text style={s.infoLabel}>Aims & Objectives</Text>
                       <Text style={[s.infoValue, { marginTop: 4 }]}>{selectedReq.aims_and_objectives}</Text>
                     </View>
                   </>
                )}
              </View>

              {renderPersons(selectedReq.proprietors, 'PROPRIETOR(S)')}
              {renderPersons(selectedReq.chairman, 'CHAIRMAN')}
              {renderPersons(selectedReq.secretary, 'SECRETARY')}
              {renderPersons(selectedReq.trustees, 'TRUSTEE(S)')}

              <Text style={s.sectionTitle}>ADMIN ACTIONS</Text>
              <View style={s.actionBlock}>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.info }]} onPress={() => updateRequestStatus('processing')}>
                    <Text style={s.actionBtnTxt}>Mark Processing</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => updateRequestStatus('completed')}>
                    <Text style={s.actionBtnTxt}>Mark Complete</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.navy, opacity: selectedReq.status_document_url ? 0.7 : 1 }]} onPress={() => uploadDocument('status_document')}>
                    <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
                    <Text style={s.actionBtnTxt}>Status Doc</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.navy, opacity: selectedReq.certificate_url ? 0.7 : 1 }]} onPress={() => uploadDocument('certificate')}>
                    <Ionicons name="ribbon-outline" size={16} color={COLORS.white} />
                    <Text style={s.actionBtnTxt}>Certificate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.navy, opacity: selectedReq.memorandum_url ? 0.7 : 1 }]} onPress={() => uploadDocument('memorandum')}>
                    <Ionicons name="book-outline" size={16} color={COLORS.white} />
                    <Text style={s.actionBtnTxt}>MEMART</Text>
                  </TouchableOpacity>
                </View>
                
                {selectedReq.status_document_url && (
                  <TouchableOpacity onPress={() => openUrl(selectedReq.status_document_url)}>
                    <Text style={[s.uploadSuccessMsg, { color: COLORS.info, textDecorationLine: 'underline' }]}>✓ Status Document uploaded (Tap to view)</Text>
                  </TouchableOpacity>
                )}
                {selectedReq.certificate_url && (
                  <TouchableOpacity onPress={() => openUrl(selectedReq.certificate_url)}>
                    <Text style={[s.uploadSuccessMsg, { color: COLORS.info, textDecorationLine: 'underline' }]}>✓ Certificate uploaded (Tap to view)</Text>
                  </TouchableOpacity>
                )}
                {selectedReq.memorandum_url && (
                  <TouchableOpacity onPress={() => openUrl(selectedReq.memorandum_url)}>
                    <Text style={[s.uploadSuccessMsg, { color: COLORS.info, textDecorationLine: 'underline' }]}>✓ Memorandum uploaded (Tap to view)</Text>
                  </TouchableOpacity>
                )}

                <Text style={[s.pText, { fontWeight: 'bold', marginBottom: 4, marginTop: 16 }]}>Query Message</Text>
                <TextInput 
                  style={s.queryInput} 
                  placeholder="Enter reason for query to email user..." 
                  multiline 
                  value={queryText}
                  onChangeText={setQueryText} 
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.warning, flex: 1 }]} onPress={handleQuery}>
                    <Ionicons name="mail-outline" size={16} color={COLORS.navy} />
                    <Text style={[s.actionBtnTxt, { color: COLORS.navy }]}>Email Query</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.error, flex: 1 }]} onPress={() => {
                    Alert.alert('Confirm Reject', 'This will reject the application and refund the user automatically. Proceed?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reject & Refund', onPress: () => updateRequestStatus('rejected'), style: 'destructive' }
                    ]);
                  }}>
                    <Text style={s.actionBtnTxt}>Reject & Refund</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* In-App Image Viewer */}
      <Modal visible={!!viewerUrl} transparent={true} animationType="fade">
        <View style={s.viewerOverlay}>
          <View style={s.viewerHeader}>
            <TouchableOpacity onPress={() => setViewerUrl(null)} style={s.viewerClose}>
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => viewerUrl && downloadAndShare(viewerUrl)} style={s.viewerDownload}>
              <Ionicons name="download-outline" size={24} color={COLORS.white} />
              <Text style={s.viewerDownloadTxt}>Download</Text>
            </TouchableOpacity>
          </View>
          {viewerUrl && (
            <Image source={{ uri: viewerUrl }} style={s.viewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 50 : 30, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy, letterSpacing: -0.3 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabTxt: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  activeTabTxt: { color: COLORS.navy, fontWeight: '700' },
  content: { flex: 1 },
  
  reqCard: { backgroundColor: COLORS.white, padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  reqHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  reqName: { fontSize: 14, fontWeight: '700', color: COLORS.navy, flex: 1, marginRight: 8 },
  reqDetailsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  reqSub: { fontSize: 12, color: COLORS.textSub, marginLeft: 6, fontWeight: '500' },
  reqFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  reqDate: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  
  priceCard: { backgroundColor: COLORS.white, padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  priceName: { fontSize: 13, fontWeight: '600', color: COLORS.navy, flex: 1 },
  priceInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, width: 90, textAlign: 'right', fontSize: 13, fontWeight: '600', backgroundColor: '#f8fafc', color: COLORS.navy },
  
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 50 : 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  modalContent: { flex: 1 },
  
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.gold, marginBottom: 8, marginTop: 18, letterSpacing: 1 },
  
  infoBlock: { backgroundColor: COLORS.white, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoRowCol: { flexDirection: 'column' },
  infoLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '500', width: '40%' },
  infoValue: { fontSize: 12, color: COLORS.navy, fontWeight: '600', flex: 1, textAlign: 'right' },
  infoDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  
  personBox: { backgroundColor: COLORS.white, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  personHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pName: { fontSize: 14, fontWeight: '700', color: COLORS.navy, flex: 1 },
  genderBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  genderText: { fontSize: 9, color: COLORS.textSub, fontWeight: '700', textTransform: 'uppercase' },
  pDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  pDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '45%' },
  pDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6 },
  pText: { fontSize: 11, color: COLORS.textMain, fontWeight: '500' },
  pTextAddr: { fontSize: 11, color: COLORS.textMain, fontWeight: '500', flex: 1, lineHeight: 16 },
  docButtonsRow: { flexDirection: 'row', gap: 8 },
  dlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  dlBtnTxt: { fontSize: 11, color: COLORS.navy, fontWeight: '700' },
  
  actionBlock: { backgroundColor: COLORS.white, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  actionBtn: { flex: 1, height: 34, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, justifyContent: 'center' },
  actionBtnTxt: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  uploadSuccessMsg: { color: COLORS.success, fontSize: 11, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  queryInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, height: 70, textAlignVertical: 'top', marginBottom: 12, backgroundColor: '#f8fafc', fontSize: 12, color: COLORS.navy },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, gap: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.white, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3 },
  statLabel: { fontSize: 10, color: COLORS.textSub, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 16, color: COLORS.navy, fontWeight: '800' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, marginBottom: 14, height: 38 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontSize: 13, color: COLORS.navy, fontWeight: '500' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { marginTop: 12, fontSize: 14, color: COLORS.textSub, fontWeight: '500' },

  infoBanner: { flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 12, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#c7d2fe', alignItems: 'center' },
  infoBannerTitle: { fontSize: 12, fontWeight: '700', color: COLORS.navy, marginBottom: 2 },
  infoBannerText: { fontSize: 10, color: COLORS.textSub, lineHeight: 14 },
  savePriceBtn: { backgroundColor: COLORS.navy, paddingHorizontal: 12, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  savePriceBtnTxt: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  viewerHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  viewerClose: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  viewerDownload: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  viewerDownloadTxt: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  viewerImage: { width: '100%', height: '80%' },
});
