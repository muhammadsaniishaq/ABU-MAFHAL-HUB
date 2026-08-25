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

    const RETRIEVAL_FEE = 1200;

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
                showAlert('Permission Denied', 'Camera roll permissions are required to upload screenshot proof.');
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
        if (userBalance !== null && userBalance < RETRIEVAL_FEE) {
            showAlert("Insufficient Balance", `Your wallet balance is insufficient (₦${RETRIEVAL_FEE.toLocaleString()} required) for BVN retrieval.`);
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
                showAlert("Screenshot Required", "Please upload a clear screenshot proof of the CRM/Ticket dashboard.");
                return;
            }
        } else {
            const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
            if (!cleanPhone || cleanPhone.length < 10) {
                showAlert("Invalid Phone Number", "Please enter a valid 11-digit registered phone number.");
                return;
            }
            if (!fullName.trim()) {
                showAlert("Full Name Required", "Please enter the owner's full name as on record.");
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
                    amount: data.charged_amount || RETRIEVAL_FEE
                });

                showAlert("Request Submitted", "Your BVN Retrieval request has been submitted for admin processing.", "success");

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
                showAlert("Submission Failed", res?.message || "Failed to submit retrieval request. Please try again.");
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
            showAlert("Required", "Please enter a Request ID or Reference to check status.");
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
                    message: res.data.message || 'Status checked successfully',
                    bvn: raw.bvn || raw.BVN || null,
                    searchedPhone: raw.searched_phone || raw.searchedPhone || null,
                    searchedName: raw.searched_name || raw.searchedName || null,
                    lastUpdated: res.data.last_updated || new Date().toISOString()
                });
            } else {
                showAlert("Status Check", res?.message || "No update found for the provided reference/ID.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "Failed to check retrieval status.");
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
                colors={['#050B14', '#0B163A']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: 24 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.noticeBadge}
                        onPress={() => setShowTermsModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={14} color="#a855f7" style={{ marginRight: 4 }} />
                        <Text style={styles.noticeBadgeText}>Retrieval Terms</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>BVN Retrieval</Text>
                <Text style={styles.subText}>Request manual BVN retrieval using Phone Number or CRM details</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Method Selector */}
                <View style={styles.selectorWrapper}>
                    <Text style={styles.selectorTitle}>How would you like to retrieve?</Text>
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'crm' && styles.tabItemActive]}
                            onPress={() => setActiveTab('crm')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabItemText, activeTab === 'crm' && styles.tabItemTextActive]}>By CRM</Text>
                            {activeTab === 'crm' && <Ionicons name="checkmark-circle" size={16} color="#9333ea" style={{ marginLeft: 6 }} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'phone' && styles.tabItemActive]}
                            onPress={() => setActiveTab('phone')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabItemText, activeTab === 'phone' && styles.tabItemTextActive]}>By Phone</Text>
                            {activeTab === 'phone' && <Ionicons name="checkmark-circle" size={16} color="#9333ea" style={{ marginLeft: 6 }} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'track' && styles.tabItemActive]}
                            onPress={() => setActiveTab('track')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="time-outline" size={14} color={activeTab === 'track' ? '#9333ea' : '#64748b'} style={{ marginRight: 4 }} />
                            <Text style={[styles.tabItemText, activeTab === 'track' && styles.tabItemTextActive]}>Track Status</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* TAB 1: BY CRM (Code: 631) */}
                {activeTab === 'crm' && (
                    <View style={styles.formCard}>
                        <View style={styles.rowTwo}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.inputLabel}>Agent Code</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Agent ID"
                                    placeholderTextColor="#94a3b8"
                                    value={agentCode}
                                    onChangeText={setAgentCode}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
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

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>BMS Ticket Reference</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Optional BMS Ticket Reference"
                            placeholderTextColor="#94a3b8"
                            value={bmsTicket}
                            onChangeText={setBmsTicket}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Upload Screenshot Proof</Text>
                        {screenshotUri ? (
                            <View style={styles.uploadPreviewContainer}>
                                <Image source={{ uri: screenshotUri }} style={styles.uploadPreviewImage} />
                                <TouchableOpacity 
                                    style={styles.removeImageBtn}
                                    onPress={() => { setScreenshotUri(null); setScreenshotBase64(null); }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="trash" size={16} color="#ef4444" />
                                    <Text style={styles.removeImageText}>Remove Image</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.uploadBox}
                                onPress={handlePickImage}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="cloud-upload-outline" size={28} color="#9333ea" />
                                <Text style={styles.uploadText}>Tap to upload image (Max 5MB)</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.feeContainer}>
                            <Text style={styles.feeLabel}>Retrieval Fee</Text>
                            <Text style={styles.feeValue}>₦{RETRIEVAL_FEE.toLocaleString()}.00</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitRetrieval}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Retrieval Request</Text>
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

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Full Name (As on record)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="First Last"
                            placeholderTextColor="#94a3b8"
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />

                        <View style={styles.feeContainer}>
                            <Text style={styles.feeLabel}>Retrieval Fee</Text>
                            <Text style={styles.feeValue}>₦{RETRIEVAL_FEE.toLocaleString()}.00</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitRetrieval}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Retrieval Request</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* TAB 3: TRACK STATUS */}
                {activeTab === 'track' && (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>Request ID or Client Reference</Text>
                        <View style={styles.trackInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 10 }]}
                                placeholder="e.g. cml0k3xrd... or REF-RET-001"
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
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.trackBtnText}>Check Status</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Track Result */}
                        {trackResult && (
                            <View style={styles.trackResultCard}>
                                <View style={styles.trackStatusHeader}>
                                    <Text style={styles.trackStatusLabel}>Current Status:</Text>
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
                                        <Text style={styles.bvnFoundLabel}>RETRIEVED 11-DIGIT BVN</Text>
                                        <Text style={styles.bvnFoundValue}>{trackResult.bvn}</Text>
                                        <TouchableOpacity
                                            style={styles.copyPill}
                                            onPress={() => copyToClipboard(trackResult.bvn, 'bvn')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={copiedBvn ? "checkmark" : "copy-outline"} size={14} color="#9333ea" />
                                            <Text style={styles.copyPillText}>{copiedBvn ? "Copied!" : "Copy BVN"}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Text style={styles.trackPendingText}>
                                        {trackResult.status === 'PROCESSING' 
                                            ? "Your retrieval request is being processed by the Admin. Please check back shortly."
                                            : trackResult.message}
                                    </Text>
                                )}

                                {trackResult.searchedName && (
                                    <Text style={styles.trackMetaText}>Owner Name: {trackResult.searchedName}</Text>
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
                            <Ionicons name="checkmark-circle" size={24} color="#059669" />
                            <Text style={styles.successHeaderText}>Retrieval Request Submitted</Text>
                        </View>
                        <Text style={styles.successDesc}>Your request is now in queue for Admin processing.</Text>

                        <View style={styles.successDetailBox}>
                            <View style={styles.successRow}>
                                <Text style={styles.successRowLabel}>Request ID:</Text>
                                <Text style={styles.successRowVal}>{submittedData.requestId}</Text>
                            </View>
                            <View style={styles.successRow}>
                                <Text style={styles.successRowLabel}>Reference:</Text>
                                <Text style={styles.successRowVal}>{submittedData.reference}</Text>
                            </View>
                            <View style={styles.successRow}>
                                <Text style={styles.successRowLabel}>Status:</Text>
                                <Text style={[styles.successRowVal, { color: '#d97706', fontWeight: 'bold' }]}>{submittedData.status}</Text>
                            </View>
                        </View>

                        <View style={styles.successActions}>
                            <TouchableOpacity
                                style={styles.copyReqBtn}
                                onPress={() => copyToClipboard(submittedData.requestId, 'requestId')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={copiedRequestId ? "checkmark" : "copy-outline"} size={14} color="#9333ea" />
                                <Text style={styles.copyReqBtnText}>{copiedRequestId ? "Copied ID" : "Copy Request ID"}</Text>
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
                                <Text style={styles.trackNowBtnText}>Track Status Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Right Side / Bottom Helper Cards (AgentHub Parity) */}
                <View style={styles.sideCard}>
                    <View style={styles.sideCardHeader}>
                        <View style={styles.sideIconBox}>
                            <Ionicons name="server-outline" size={20} color="#9333ea" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.sideTitle}>Admin Processing</Text>
                            <Text style={styles.sideDesc}>Retrievals are processed by our admin team. Check your history log to view the retrieved BVN once completed.</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.historyBtn}
                        onPress={() => router.push('/(app)/bvn-services/history')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.historyBtnText}>View History</Text>
                        <Ionicons name="arrow-forward" size={16} color="#9333ea" />
                    </TouchableOpacity>
                </View>

                <View style={styles.rulesCard}>
                    <View style={styles.rulesHeader}>
                        <Ionicons name="information-circle-outline" size={18} color="#dc2626" />
                        <Text style={styles.rulesHeaderText}>Important Rules</Text>
                    </View>
                    <Text style={styles.ruleItem}>• CRM requests without a valid and clear screenshot will be instantly rejected.</Text>
                    <Text style={styles.ruleItem}>• If the retrieval fails (e.g. record not found), your wallet will be fully refunded by the admin. You will usually receive an update within 24 Working Hours.</Text>
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
                            <Ionicons name="warning-outline" size={28} color="#9333ea" />
                        </View>
                        <Text style={styles.modalTitle}>Retrieval Terms</Text>
                        <Text style={styles.modalBody}>
                            You are submitting a request to manually retrieve a BVN record from the database.
                        </Text>

                        <View style={styles.modalCallout}>
                            <Text style={styles.modalCalloutHeader}>IMPORTANT</Text>
                            <Text style={styles.modalCalloutText}>
                                For CRM retrievals, you must upload a clear screenshot as proof. Blurry or irrelevant images will be instantly rejected.
                            </Text>
                        </View>

                        <Text style={[styles.modalBody, { marginTop: 8 }]}>
                            Requests are processed manually by our admins. You can check the final result (the retrieved 11-digit BVN) directly from your history log.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setShowTermsModal(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalBtnText}>I Understand & Agree</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    noticeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#a855f7' },
    noticeBadgeText: { color: '#c084fc', fontSize: 11, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    selectorWrapper: { marginBottom: 14 },
    selectorTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
    tabBar: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
    tabItemActive: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#9333ea' },
    tabItemText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    tabItemTextActive: { color: '#9333ea', fontWeight: '800' },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    rowTwo: { flexDirection: 'row', alignItems: 'center' },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 46, fontSize: 14, color: '#0f172a', backgroundColor: '#ffffff' },
    uploadBox: { borderWidth: 1.5, borderColor: '#d8b4fe', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf5ff', marginVertical: 6 },
    uploadText: { fontSize: 12, fontWeight: '700', color: '#9333ea', marginTop: 6 },
    uploadPreviewContainer: { marginVertical: 6, alignItems: 'center' },
    uploadPreviewImage: { width: '100%', height: 160, borderRadius: 10, resizeMode: 'cover' },
    removeImageBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingVertical: 4 },
    removeImageText: { fontSize: 12, color: '#ef4444', fontWeight: '700', marginLeft: 4 },
    feeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdf4ff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#f5d0fe', marginVertical: 14 },
    feeLabel: { fontSize: 12, fontWeight: '700', color: '#701a75' },
    feeValue: { fontSize: 16, fontWeight: '900', color: '#9333ea' },
    submitBtn: { backgroundColor: '#9333ea', height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    trackInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    trackBtn: { backgroundColor: '#9333ea', height: 46, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    trackBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
    trackResultCard: { backgroundColor: '#fdf4ff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f0abfc' },
    trackStatusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    trackStatusLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusPillProcessing: { backgroundColor: '#fef3c7' },
    statusPillSuccess: { backgroundColor: '#dcfce7' },
    statusPillFailed: { backgroundColor: '#fee2e2' },
    statusPillText: { fontSize: 10, fontWeight: '800' },
    statusPillTextProcessing: { color: '#d97706' },
    statusPillTextSuccess: { color: '#15803d' },
    statusPillTextFailed: { color: '#b91c1c' },
    bvnFoundBox: { backgroundColor: '#ffffff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e9d5ff', marginVertical: 8 },
    bvnFoundLabel: { fontSize: 10, fontWeight: '800', color: '#701a75', letterSpacing: 0.5 },
    bvnFoundValue: { fontSize: 22, fontWeight: '900', color: '#9333ea', letterSpacing: 2, marginVertical: 4 },
    copyPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5d0fe', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
    copyPillText: { fontSize: 11, fontWeight: '700', color: '#701a75', marginLeft: 4 },
    trackPendingText: { fontSize: 12, color: '#64748b', lineHeight: 18, marginVertical: 4 },
    trackMetaText: { fontSize: 11, color: '#701a75', marginTop: 2 },
    successSubmitCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 16 },
    successHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    successHeaderText: { fontSize: 14, fontWeight: '800', color: '#059669', marginLeft: 8 },
    successDesc: { fontSize: 12, color: '#64748b', marginBottom: 12 },
    successDetailBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    successRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
    successRowLabel: { fontSize: 11, color: '#64748b' },
    successRowVal: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
    successActions: { flexDirection: 'row', justifyContent: 'space-between' },
    copyReqBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdf4ff', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#f0abfc', marginRight: 6 },
    copyReqBtnText: { fontSize: 12, fontWeight: '700', color: '#9333ea', marginLeft: 4 },
    trackNowBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9333ea', paddingVertical: 10, borderRadius: 8, marginLeft: 6 },
    trackNowBtnText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
    sideCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    sideCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    sideIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#faf5ff', alignItems: 'center', justifyContent: 'center' },
    sideTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    sideDesc: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 2 },
    historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#faf5ff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#f3e8ff' },
    historyBtnText: { fontSize: 12, fontWeight: '700', color: '#9333ea' },
    rulesCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    rulesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    rulesHeaderText: { fontSize: 12, fontWeight: '800', color: '#475569', marginLeft: 6 },
    ruleItem: { fontSize: 11, color: '#64748b', lineHeight: 17, marginBottom: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
    modalIconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#faf5ff', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
    modalBody: { fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 18 },
    modalCallout: { backgroundColor: '#fdf4ff', borderWidth: 1, borderColor: '#f0abfc', borderRadius: 10, padding: 12, marginVertical: 10, width: '100%' },
    modalCalloutHeader: { fontSize: 11, fontWeight: '900', color: '#9333ea', marginBottom: 2 },
    modalCalloutText: { fontSize: 11, color: '#701a75', lineHeight: 16 },
    modalBtn: { backgroundColor: '#9333ea', width: '100%', height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    modalBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
