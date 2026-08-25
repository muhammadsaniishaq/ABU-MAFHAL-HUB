import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory } from '../../../services/verificationHistory';

export default function VNINToNIBSSScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'submit' | 'status'>('submit');
    const [ticketId, setTicketId] = useState('');
    const [fullName, setFullName] = useState('');
    const [nin, setNin] = useState('');
    const [bvn, setBvn] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [result, setResult] = useState<any>(null);

    // Status tracking states
    const [trackingRef, setTrackingRef] = useState('');
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [statusResult, setStatusResult] = useState<any>(null);

    // Terms of Service modal
    const [showTermsModal, setShowTermsModal] = useState(false);

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

    const handleSubmit = async () => {
        const cleanNin = nin.trim().replace(/\D/g, '');
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        const cleanTicket = ticketId.trim();

        if (!cleanTicket) {
            showAlert("Ticket ID na Buƙata", "Da fatan a shigar da ingantaccen Ticket ID.");
            return;
        }
        if (!fullName.trim()) {
            showAlert("Suna na Buƙata", "Da fatan a shigar da cikakken sunan mai NIN/BVN.");
            return;
        }
        if (!cleanNin || cleanNin.length !== 11) {
            showAlert("Lambar NIN Ba Daidai Ba", "Lambar NIN dole ta kasance lamba 11 cif.");
            return;
        }
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Lambar BVN Ba Daidai Ba", "Lambar BVN dole ta kasance lamba 11 cif.");
            return;
        }

        if (userBalance !== null && userBalance < 3000) {
            showAlert("Kuɗi Bai Isa Ba", "Asusunka ba shi da isassun kuɗi (₦3,000) don aikin VNIN to NIBSS.");
            return;
        }

        setLoading(true);
        setResult(null);

        const customReference = `REF-VNIN-${Date.now()}`;

        try {
            const res = await api.identity.linkVNINToNIBSS(cleanNin, cleanBvn, 'bvn_vnin_nibss', {
                reference: customReference,
                ticket_id: cleanTicket,
                full_name: fullName.trim(),
                nin: cleanNin,
                bvn: cleanBvn
            });

            if (res && res.isValid) {
                const responseData = res.data || { status: 'COMPLETED', reference: customReference };
                setResult(responseData);
                showAlert("Nasarar Tura Buƙata", "An tura buƙatar haɗa VNIN zuwa NIBSS (Nora) cikin nasara!", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'vnin_to_nibss',
                    search_number: cleanTicket || customReference,
                    holder_name: fullName.trim(),
                    details: {
                        reference: customReference,
                        ticket_id: cleanTicket,
                        nin: cleanNin,
                        bvn: cleanBvn,
                        fullName: fullName.trim(),
                        status: 'PROCESSING',
                        submittedAt: new Date().toISOString()
                    }
                });
                fetchWalletBalance();
            } else {
                showAlert("Aiki Ya Faskara", res?.message || "Ba a samu nasarar tura buƙatar ba.");
            }
        } catch (e: any) {
            showAlert("Kuskure", e.message || "An samu matsala wajen haɗawa da uwar garke.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        const cleanRef = trackingRef.trim();
        if (!cleanRef) {
            showAlert("Reference / Request ID", "Da fatan a shigar da Reference ko Ticket ID don duba matsayin aikin.");
            return;
        }

        setTrackingLoading(true);
        setStatusResult(null);

        try {
            const res = await api.identity.checkVNINStatus(cleanRef);
            if (res && res.isValid && res.data) {
                setStatusResult(res.data);
            } else {
                showAlert("Ba a Samu Bayani Ba", res?.message || "Ba a samu bayanan wannan reference ɗin ba tukuna.");
            }
        } catch (e: any) {
            showAlert("Kuskure", e.message || "An samu matsala wajen duba matsayin aiki.");
        } finally {
            setTrackingLoading(false);
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
                        style={styles.termsBadge}
                        onPress={() => setShowTermsModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                        <Text style={styles.termsBadgeText}>Terms & Rules</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>VNIN to NIBSS</Text>
                <Text style={styles.subText}>Submit your VNIN slip directly to NIBSS (Nora) for BVN synchronization</Text>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                    >
                        <Ionicons name="send-outline" size={16} color={activeTab === 'submit' ? '#0284c7' : '#94a3b8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Submit to NIBSS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'status' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('status')}
                    >
                        <Ionicons name="pulse-outline" size={16} color={activeTab === 'status' ? '#0284c7' : '#94a3b8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'status' && styles.tabButtonTextActive]}>Track Status</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {activeTab === 'submit' ? (
                    <>
                        <View style={styles.formCard}>
                            <Text style={styles.inputLabel}>TICKET ID</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="ticket-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="ENTER YOUR TICKET ID"
                                    placeholderTextColor="#94a3b8"
                                    value={ticketId}
                                    onChangeText={setTicketId}
                                    autoCapitalize="characters"
                                />
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>FULL NAME (Exact on NIN/BVN)</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="person-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter Exact Full Name on NIN/BVN"
                                    placeholderTextColor="#94a3b8"
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                            </View>

                            <View style={styles.grid2}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>NIN (11 Digits)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="00000000000"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            maxLength={11}
                                            value={nin}
                                            onChangeText={setNin}
                                        />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>BVN (11 Digits)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="00000000000"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            maxLength={11}
                                            value={bvn}
                                            onChangeText={setBvn}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.costRow}>
                                <Text style={styles.costLabel}>Processing Fee:</Text>
                                <Text style={styles.costVal}>₦3,000.00</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.btn, loading && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                        <Text style={styles.btnText}>Submit to NIBSS</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Important Rules Card */}
                        <View style={styles.rulesCard}>
                            <View style={styles.rulesHeader}>
                                <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                                <Text style={styles.rulesHeaderText}>Important Rules</Text>
                            </View>
                            <Text style={styles.ruleItem}>• Our work is solely to forward your request to NIBSS. We do not modify the data.</Text>
                            <Text style={styles.ruleItem}>• There is absolutely NO refund for this service if a wrong ticket ID is submitted.</Text>
                            <Text style={styles.ruleItem}>• Processing requires 24-48 hours before NIBSS confirms receipt.</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Track Status View */}
                        <View style={styles.formCard}>
                            <Text style={styles.inputLabel}>REFERENCE OR TICKET ID</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. REF-VNIN-001 or TICKET-ID"
                                    placeholderTextColor="#94a3b8"
                                    value={trackingRef}
                                    onChangeText={setTrackingRef}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.btn, { marginTop: 16 }, trackingLoading && { opacity: 0.7 }]}
                                onPress={handleCheckStatus}
                                disabled={trackingLoading}
                                activeOpacity={0.8}
                            >
                                {trackingLoading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Ionicons name="refresh" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                        <Text style={styles.btnText}>Check Status</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {statusResult && (
                            <View style={styles.statusResultCard}>
                                <View style={styles.statusResultHeader}>
                                    <Text style={styles.statusResultLabel}>Current Status:</Text>
                                    <View style={[
                                        styles.statusPill, 
                                        statusResult.current_status === 'COMPLETED' ? styles.statusPillSuccess :
                                        statusResult.current_status === 'FAILED' ? styles.statusPillFailed :
                                        styles.statusPillProcessing
                                    ]}>
                                        <Text style={[
                                            styles.statusPillText,
                                            statusResult.current_status === 'COMPLETED' ? styles.statusTextSuccess :
                                            statusResult.current_status === 'FAILED' ? styles.statusTextFailed :
                                            styles.statusTextProcessing
                                        ]}>
                                            {statusResult.current_status || 'PROCESSING'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.statusMessage}>{statusResult.message || statusResult.data?.message || 'Request is currently being processed by NIBSS.'}</Text>
                                {statusResult.last_updated && (
                                    <Text style={styles.statusDate}>Last updated: {new Date(statusResult.last_updated).toLocaleString()}</Text>
                                )}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Terms of Service Modal */}
            <Modal
                visible={showTermsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTermsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="warning-outline" size={28} color="#0284c7" />
                        </View>
                        <Text style={styles.modalTitle}>Terms of Service</Text>
                        <Text style={styles.modalBody}>
                            Kindly note that our work is <Text style={{ fontWeight: 'bold' }}>only to send your VNIN slip to NIBSS</Text>. Please make sure all details provided are 100% correct.
                        </Text>
                        <Text style={[styles.modalBody, { marginTop: 10 }]}>
                            This service will be processed within <Text style={{ fontWeight: 'bold' }}>24-48 hours</Text>. We will communicate with Nora (NIBSS) and provide confirmation once your VNIN is received by NIBSS.
                        </Text>
                        <View style={styles.noRefundBox}>
                            <Text style={styles.noRefundTitle}>STRICT NO REFUND POLICY</Text>
                            <Text style={styles.noRefundText}>There is absolutely no refund for this service if you submit a wrong ticket ID.</Text>
                        </View>
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
    termsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
    termsBadgeText: { color: '#38bdf8', fontSize: 11, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 14 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 3 },
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 9 },
    tabButtonActive: { backgroundColor: '#ffffff' },
    tabButtonText: { fontSize: 12, fontWeight: '700', color: '#cbd5e1' },
    tabButtonTextActive: { color: '#0f172a' },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a' },
    grid2: { flexDirection: 'row', gap: 10 },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 15, fontWeight: '900', color: '#0284c7' },
    btn: { backgroundColor: '#0284c7', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    rulesCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#fee2e2' },
    rulesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    rulesHeaderText: { fontSize: 13, fontWeight: '800', color: '#dc2626', marginLeft: 6 },
    ruleItem: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 4 },
    statusResultCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8 },
    statusResultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    statusResultLabel: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusPillSuccess: { backgroundColor: '#ecfdf5' },
    statusPillProcessing: { backgroundColor: '#fffbeb' },
    statusPillFailed: { backgroundColor: '#fef2f2' },
    statusPillText: { fontSize: 11, fontWeight: '800' },
    statusTextSuccess: { color: '#059669' },
    statusTextProcessing: { color: '#d97706' },
    statusTextFailed: { color: '#dc2626' },
    statusMessage: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 4 },
    statusDate: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 20, padding: 24, alignItems: 'center' },
    modalIconBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
    modalBody: { fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 18 },
    noRefundBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginTop: 14, marginBottom: 18 },
    noRefundTitle: { fontSize: 10, fontWeight: '900', color: '#dc2626', textAlign: 'center', marginBottom: 2 },
    noRefundText: { fontSize: 11, color: '#b91c1c', textAlign: 'center' },
    modalBtn: { backgroundColor: '#0284c7', width: '100%', height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
