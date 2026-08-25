import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory } from '../../../services/verificationHistory';

export default function BVNRetrievalScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'crm' | 'phone' | 'track'>('crm');
    
    // Method 1: By Phone (Code: 630)
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fullName, setFullName] = useState('');

    // Method 2: By CRM (Code: 631)
    const [agentCode, setAgentCode] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [bmsTicket, setBmsTicket] = useState('');
    const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
    const [screenshotUri, setScreenshotUri] = useState<string | null>(null);

    // Track Status Tab
    const [trackQuery, setTrackQuery] = useState('');
    const [trackLoading, setTrackLoading] = useState(false);
    const [trackResult, setTrackResult] = useState<any>(null);

    // Submission states
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [submittedData, setSubmittedData] = useState<any>(null);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [copiedBvn, setCopiedBvn] = useState(false);
    const [copiedRequestId, setCopiedRequestId] = useState(false);

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) setUserBalance(Number(data.balance));
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
    }, []);

    const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
        if (Platform.OS === 'web') alert(`${title}\n\n${message}`);
        else Alert.alert(title, message);
    };

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission Denied', 'Camera roll permissions are required to upload screenshot.');
                return;
            }

            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
                base64: true,
            });

            if (!res.canceled && res.assets && res.assets.length > 0) {
                const asset = res.assets[0];
                setScreenshotUri(asset.uri);
                if (asset.base64) {
                    setScreenshotBase64(`data:image/jpeg;base64,${asset.base64}`);
                } else {
                    setScreenshotBase64(asset.uri);
                }
            }
        } catch (e: any) {
            showAlert('Error', e.message || 'Failed to select image');
        }
    };

    const handleSubmitRetrieval = async () => {
        if (userBalance !== null && userBalance < 100) {
            showAlert("Insufficient Balance", "Your wallet balance is low. Please fund your wallet to continue.");
            return;
        }

        const ref = `REF-RET-${Date.now()}`;

        if (activeTab === 'crm') {
            if (!agentCode.trim()) {
                showAlert("Agent Code Required", "Please enter your Agent Code.");
                return;
            }
            if (!ticketId.trim()) {
                showAlert("Ticket ID Required", "Please enter the CRM Support Ticket ID.");
                return;
            }
            if (!screenshotBase64 && !screenshotUri) {
                showAlert("Screenshot Required", "Please upload a clear screenshot of the CRM dashboard.");
                return;
            }
        } else {
            const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
            if (!cleanPhone || cleanPhone.length < 10) {
                showAlert("Invalid Phone Number", "Please enter a valid 11-digit registered phone number.");
                return;
            }
            if (!fullName.trim()) {
                showAlert("Full Name Required", "Please enter the owner's full name.");
                return;
            }
        }

        setLoading(true);
        setSubmittedData(null);

        try {
            let extraData: any = {};
            let identifier = '';

            if (activeTab === 'crm') {
                identifier = ticketId.trim();
                extraData = {
                    service_code: '631',
                    reference: ref,
                    agent_code: agentCode.trim(),
                    ticket_id: ticketId.trim(),
                    bms_ticket: bmsTicket.trim() || '',
                    screenshot: screenshotBase64 || screenshotUri,
                };
            } else {
                identifier = phoneNumber.trim().replace(/\D/g, '');
                extraData = {
                    service_code: '630',
                    reference: ref,
                    phone_number: identifier,
                    full_name: fullName.trim(),
                };
            }

            const res = await api.identity.retrieveBVN(identifier, 'bvn_retrieval', extraData);

            if (res && (res.isValid || res.data)) {
                const data = res.data?.data || res.data || {};
                const reqId = data.request_id || data.requestId || ref;
                
                setSubmittedData({
                    requestId: reqId,
                    reference: data.reference || ref,
                    status: data.status || 'PROCESSING',
                    service: data.service || (activeTab === 'crm' ? 'BVN Retrieval: CRM' : 'BVN Retrieval: Phone'),
                });

                showAlert("Submitted", "BVN Retrieval request submitted for processing.", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: activeTab === 'crm' ? 'bvn_retrieval_crm' : 'bvn_retrieval_phone',
                    search_number: activeTab === 'crm' ? ticketId.trim() : identifier,
                    holder_name: fullName.trim() || `Agent ${agentCode.trim()}`,
                    details: {
                        ...data,
                        request_id: reqId,
                        reference: ref,
                        method: activeTab,
                        status: 'PROCESSING'
                    },
                });

                fetchWalletBalance();
            } else {
                showAlert("Submission Failed", res?.message || "Could not submit retrieval request.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while connecting to the server.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        const query = trackQuery.trim();
        if (!query) {
            showAlert("Required", "Please enter a Request ID or Reference.");
            return;
        }

        setTrackLoading(true);
        setTrackResult(null);

        try {
            const res = await api.identity.checkBVNRetrievalStatus(query);
            if (res && res.data) {
                const raw = res.data?.data || res.data;
                setTrackResult({
                    status: res.data.current_status || res.data.status || 'PROCESSING',
                    message: res.data.message || 'Status retrieved',
                    bvn: raw.bvn || raw.BVN || null,
                    searchedPhone: raw.searched_phone || raw.searchedPhone || null,
                    searchedName: raw.searched_name || raw.searchedName || null,
                    lastUpdated: res.data.last_updated || new Date().toISOString()
                });
            } else {
                showAlert("Status", res?.message || "No record found.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "Failed to check status.");
        } finally {
            setTrackLoading(false);
        }
    };

    const copyToClipboard = async (text: string, type: 'bvn' | 'requestId') => {
        await Clipboard.setStringAsync(text);
        if (type === 'bvn') {
            setCopiedBvn(true);
            setTimeout(() => setCopiedBvn(false), 2000);
        } else {
            setCopiedRequestId(true);
            setTimeout(() => setCopiedRequestId(false), 2000);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 22 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.noticeBadge}
                        onPress={() => setShowTermsModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={13} color="#D4AF37" style={{ marginRight: 3 }} />
                        <Text style={styles.noticeBadgeText}>Guidelines</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>BVN Retrieval</Text>
                <Text style={styles.subText}>Recover lost or forgotten BVN via Phone or CRM</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Method Selector */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'crm' && styles.tabItemActive]}
                        onPress={() => setActiveTab('crm')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabItemText, activeTab === 'crm' && styles.tabItemTextActive]}>By CRM</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'phone' && styles.tabItemActive]}
                        onPress={() => setActiveTab('phone')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabItemText, activeTab === 'phone' && styles.tabItemTextActive]}>By Phone</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'track' && styles.tabItemActive]}
                        onPress={() => setActiveTab('track')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="time-outline" size={12} color={activeTab === 'track' ? '#0B192C' : '#64748b'} style={{ marginRight: 3 }} />
                        <Text style={[styles.tabItemText, activeTab === 'track' && styles.tabItemTextActive]}>Track Status</Text>
                    </TouchableOpacity>
                </View>

                {/* TAB 1: BY CRM (Code: 631) */}
                {activeTab === 'crm' && (
                    <View style={styles.formCard}>
                        <View style={styles.rowTwo}>
                            <View style={{ flex: 1, marginRight: 6 }}>
                                <Text style={styles.inputLabel}>Agent Code</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Agent ID"
                                    placeholderTextColor="#94a3b8"
                                    value={agentCode}
                                    onChangeText={setAgentCode}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 6 }}>
                                <Text style={styles.inputLabel}>Ticket ID</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ticket ID"
                                    placeholderTextColor="#94a3b8"
                                    value={ticketId}
                                    onChangeText={setTicketId}
                                />
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>BMS Ticket Reference (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="BMS Ticket Number"
                            placeholderTextColor="#94a3b8"
                            value={bmsTicket}
                            onChangeText={setBmsTicket}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Screenshot Proof</Text>
                        {screenshotUri ? (
                            <View style={styles.uploadPreviewContainer}>
                                <Image source={{ uri: screenshotUri }} style={styles.uploadPreviewImage} />
                                <TouchableOpacity 
                                    style={styles.removeImageBtn}
                                    onPress={() => { setScreenshotUri(null); setScreenshotBase64(null); }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="trash" size={14} color="#ef4444" />
                                    <Text style={styles.removeImageText}>Remove Image</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.uploadBox}
                                onPress={handlePickImage}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="cloud-upload-outline" size={22} color="#D4AF37" />
                                <Text style={styles.uploadText}>Upload Proof (Max 5MB)</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitRetrieval}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#0B192C" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Request</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* TAB 2: BY PHONE (Code: 630) */}
                {activeTab === 'phone' && (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>Registered Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="08012345678"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={phoneNumber}
                            onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, ''))}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Full Name (As on record)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="First Last"
                            placeholderTextColor="#94a3b8"
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitRetrieval}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#0B192C" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Request</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* TAB 3: TRACK STATUS */}
                {activeTab === 'track' && (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>Request ID or Reference</Text>
                        <View style={styles.trackInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 8 }]}
                                placeholder="e.g. cml0k3xrd... or REF-..."
                                placeholderTextColor="#94a3b8"
                                value={trackQuery}
                                onChangeText={setTrackQuery}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.trackBtn}
                                onPress={handleCheckStatus}
                                disabled={trackLoading}
                                activeOpacity={0.8}
                            >
                                {trackLoading ? (
                                    <ActivityIndicator size="small" color="#0B192C" />
                                ) : (
                                    <Text style={styles.trackBtnText}>Check</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Track Result */}
                        {trackResult && (
                            <View style={styles.trackResultCard}>
                                <View style={styles.trackStatusHeader}>
                                    <Text style={styles.trackStatusLabel}>Status:</Text>
                                    <View style={[
                                        styles.statusPill,
                                        trackResult.status === 'COMPLETED' ? styles.statusPillSuccess :
                                        trackResult.status === 'FAILED' ? styles.statusPillFailed : styles.statusPillProcessing
                                    ]}>
                                        <Text style={[
                                            styles.statusPillText,
                                            trackResult.status === 'COMPLETED' ? styles.statusPillTextSuccess :
                                            trackResult.status === 'FAILED' ? styles.statusPillTextFailed : styles.statusPillTextProcessing
                                        ]}>
                                            {trackResult.status}
                                        </Text>
                                    </View>
                                </View>

                                {trackResult.bvn ? (
                                    <View style={styles.bvnFoundBox}>
                                        <Text style={styles.bvnFoundLabel}>RETRIEVED BVN</Text>
                                        <Text style={styles.bvnFoundValue}>{trackResult.bvn}</Text>
                                        <TouchableOpacity
                                            style={styles.copyPill}
                                            onPress={() => copyToClipboard(trackResult.bvn, 'bvn')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={copiedBvn ? "checkmark" : "copy-outline"} size={12} color="#0B192C" />
                                            <Text style={styles.copyPillText}>{copiedBvn ? "Copied!" : "Copy BVN"}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Text style={styles.trackPendingText}>
                                        {trackResult.status === 'PROCESSING' 
                                            ? "Your retrieval request is being processed. Please check back shortly."
                                            : trackResult.message}
                                    </Text>
                                )}

                                {trackResult.searchedName && (
                                    <Text style={styles.trackMetaText}>Name: {trackResult.searchedName}</Text>
                                )}
                                {trackResult.searchedPhone && (
                                    <Text style={styles.trackMetaText}>Phone: {trackResult.searchedPhone}</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Successful Submission Card */}
                {submittedData && (
                    <View style={styles.successSubmitCard}>
                        <View style={styles.successHeader}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.successHeaderText}>Request Submitted</Text>
                        </View>
                        <Text style={styles.successDesc}>Your request is queued for processing.</Text>

                        <View style={styles.successDetailBox}>
                            <View style={styles.successRow}>
                                <Text style={styles.successRowLabel}>Request ID:</Text>
                                <Text style={styles.successRowVal}>{submittedData.requestId}</Text>
                            </View>
                            <View style={styles.successRow}>
                                <Text style={styles.successRowLabel}>Status:</Text>
                                <Text style={[styles.successRowVal, { color: '#B45309' }]}>{submittedData.status}</Text>
                            </View>
                        </View>

                        <View style={styles.successActions}>
                            <TouchableOpacity
                                style={styles.copyReqBtn}
                                onPress={() => copyToClipboard(submittedData.requestId, 'requestId')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={copiedRequestId ? "checkmark" : "copy-outline"} size={12} color="#0B192C" />
                                <Text style={styles.copyReqBtnText}>{copiedRequestId ? "Copied ID" : "Copy ID"}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.trackNowBtn}
                                onPress={() => {
                                    setTrackQuery(submittedData.requestId);
                                    setActiveTab('track');
                                    handleCheckStatus();
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.trackNowBtnText}>Track Status</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Helper Cards in Navy & Gold */}
                <View style={styles.sideCard}>
                    <View style={styles.sideCardHeader}>
                        <View style={styles.sideIconBox}>
                            <Ionicons name="server-outline" size={16} color="#D4AF37" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.sideTitle}>Admin Processing</Text>
                            <Text style={styles.sideDesc}>Retrievals are processed by admin. Check history log once completed.</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.historyBtn}
                        onPress={() => router.push('/(app)/bvn-services/history')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.historyBtnText}>View History</Text>
                        <Ionicons name="arrow-forward" size={13} color="#0B192C" />
                    </TouchableOpacity>
                </View>

                <View style={styles.rulesCard}>
                    <View style={styles.rulesHeader}>
                        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                        <Text style={styles.rulesHeaderText}>Important Guidelines</Text>
                    </View>
                    <Text style={styles.ruleItem}>• CRM requests require a valid screenshot proof.</Text>
                    <Text style={styles.ruleItem}>• Unsuccessful retrievals are automatically refunded to your wallet.</Text>
                </View>
            </ScrollView>

            {/* Retrieval Terms Modal */}
            <Modal
                visible={showTermsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTermsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="warning-outline" size={22} color="#D4AF37" />
                        </View>
                        <Text style={styles.modalTitle}>Retrieval Guidelines</Text>
                        <Text style={styles.modalBody}>
                            You are submitting a request to manually retrieve a BVN record from the database.
                        </Text>

                        <View style={styles.modalCallout}>
                            <Text style={styles.modalCalloutHeader}>CRM REQUIREMENT</Text>
                            <Text style={styles.modalCalloutText}>
                                For CRM retrievals, upload a clear screenshot as proof.
                            </Text>
                        </View>

                        <Text style={[styles.modalBody, { marginTop: 6 }]}>
                            Requests are processed by admins. You can check the final retrieved BVN in your history log.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setShowTermsModal(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalBtnText}>I Understand</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    noticeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    noticeBadgeText: { color: '#D4AF37', fontSize: 10, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    tabBar: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 12 },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
    tabItemActive: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#D4AF37' },
    tabItemText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
    tabItemTextActive: { color: '#0B192C', fontWeight: '800' },
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    rowTwo: { flexDirection: 'row', alignItems: 'center' },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 5 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, height: 42, fontSize: 13, color: '#0B192C', backgroundColor: '#ffffff' },
    uploadBox: { borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderStyle: 'dashed', borderRadius: 10, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF9E7', marginVertical: 6 },
    uploadText: { fontSize: 11, fontWeight: '700', color: '#B45309', marginTop: 4 },
    uploadPreviewContainer: { marginVertical: 6, alignItems: 'center' },
    uploadPreviewImage: { width: '100%', height: 130, borderRadius: 8, resizeMode: 'cover' },
    removeImageBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 2 },
    removeImageText: { fontSize: 11, color: '#ef4444', fontWeight: '700', marginLeft: 4 },
    submitBtn: { backgroundColor: '#D4AF37', height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    submitBtnText: { color: '#0B192C', fontSize: 13, fontWeight: '800' },
    trackInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    trackBtn: { backgroundColor: '#D4AF37', height: 42, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    trackBtnText: { color: '#0B192C', fontSize: 11, fontWeight: '800' },
    trackResultCard: { backgroundColor: '#FEF9E7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    trackStatusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    trackStatusLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
    statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusPillProcessing: { backgroundColor: '#fef3c7' },
    statusPillSuccess: { backgroundColor: '#dcfce7' },
    statusPillFailed: { backgroundColor: '#fee2e2' },
    statusPillText: { fontSize: 9, fontWeight: '800' },
    statusPillTextProcessing: { color: '#d97706' },
    statusPillTextSuccess: { color: '#15803d' },
    statusPillTextFailed: { color: '#b91c1c' },
    bvnFoundBox: { backgroundColor: '#ffffff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginVertical: 6 },
    bvnFoundLabel: { fontSize: 9, fontWeight: '800', color: '#B45309', letterSpacing: 0.5 },
    bvnFoundValue: { fontSize: 18, fontWeight: '900', color: '#0B192C', letterSpacing: 2, marginVertical: 2 },
    copyPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9E7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    copyPillText: { fontSize: 10, fontWeight: '700', color: '#0B192C', marginLeft: 3 },
    trackPendingText: { fontSize: 11, color: '#64748b', lineHeight: 16, marginVertical: 2 },
    trackMetaText: { fontSize: 10, color: '#B45309', marginTop: 2 },
    successSubmitCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginBottom: 12 },
    successHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    successHeaderText: { fontSize: 13, fontWeight: '800', color: '#10B981', marginLeft: 6 },
    successDesc: { fontSize: 11, color: '#64748b', marginBottom: 8 },
    successDetailBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
    successRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 1 },
    successRowLabel: { fontSize: 10, color: '#64748b' },
    successRowVal: { fontSize: 10, fontWeight: '700', color: '#0B192C' },
    successActions: { flexDirection: 'row', justifyContent: 'space-between' },
    copyReqBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF9E7', paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginRight: 4 },
    copyReqBtnText: { fontSize: 11, fontWeight: '700', color: '#0B192C', marginLeft: 3 },
    trackNowBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B192C', paddingVertical: 8, borderRadius: 6, marginLeft: 4 },
    trackNowBtnText: { fontSize: 11, fontWeight: '800', color: '#D4AF37' },
    sideCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    sideCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    sideIconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FEF9E7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    sideTitle: { fontSize: 12, fontWeight: '800', color: '#0B192C' },
    sideDesc: { fontSize: 10, color: '#64748b', lineHeight: 14, marginTop: 1 },
    historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF9E7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    historyBtnText: { fontSize: 11, fontWeight: '700', color: '#0B192C' },
    rulesCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    rulesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    rulesHeaderText: { fontSize: 11, fontWeight: '800', color: '#475569', marginLeft: 4 },
    ruleItem: { fontSize: 10, color: '#64748b', lineHeight: 15, marginBottom: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, alignItems: 'center' },
    modalIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF9E7', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#0B192C', marginBottom: 4 },
    modalBody: { fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 16 },
    modalCallout: { backgroundColor: '#FEF9E7', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, padding: 8, marginVertical: 8, width: '100%' },
    modalCalloutHeader: { fontSize: 10, fontWeight: '900', color: '#B45309', marginBottom: 1 },
    modalCalloutText: { fontSize: 10, color: '#78350f', lineHeight: 14 },
    modalBtn: { backgroundColor: '#0B192C', width: '100%', height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    modalBtnText: { color: '#D4AF37', fontSize: 12, fontWeight: '800' },
});
