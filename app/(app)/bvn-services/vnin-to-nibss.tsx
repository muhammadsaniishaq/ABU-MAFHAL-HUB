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
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

export default function VNINToNIBSSScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'submit' | 'status'>('submit');
    const [ticketId, setTicketId] = useState('');
    const [fullName, setFullName] = useState('');
    const [nin, setNin] = useState('');
    const [bvn, setBvn] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [servicePrice, setServicePrice] = useState<number>(700);
    const [result, setResult] = useState<any>(null);

    // Status tracking states
    const [trackingRef, setTrackingRef] = useState('');
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [statusResult, setStatusResult] = useState<any>(null);

    // Terms of Service modal
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

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

    const fetchServicePrice = async () => {
        try {
            const { data } = await supabase
                .from('service_pricing')
                .select('cost_price, markup_price, selling_price')
                .eq('id', 'vnin_to_nibss')
                .maybeSingle();
            if (data) {
                const total = data.selling_price ? Number(data.selling_price) : (Number(data.cost_price || 0) + Number(data.markup_price || 0));
                if (total > 0) setServicePrice(total);
            }
        } catch (e) {
            console.warn('Failed to load VNIN to NIBSS price', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
        fetchServicePrice();
    }, []);

    const showAlert = (title: string, message: string, type: AlertType = 'error') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const handleSubmit = async () => {
        const cleanNin = nin.trim().replace(/\D/g, '');
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        const cleanTicket = ticketId.trim();

        if (!cleanTicket) {
            showAlert("Ticket ID Required", "Please enter a valid Ticket ID.");
            return;
        }
        if (!fullName.trim()) {
            showAlert("Full Name Required", "Please enter the exact full name on the NIN/BVN.");
            return;
        }
        if (!cleanNin || cleanNin.length !== 11) {
            showAlert("Invalid NIN", "NIN must be exactly 11 digits.");
            return;
        }
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Invalid BVN", "BVN must be exactly 11 digits.");
            return;
        }

        if (userBalance !== null && userBalance < servicePrice) {
            showAlert("Insufficient Balance", `Your balance is ₦${userBalance.toLocaleString()}. Required fee is ₦${servicePrice.toLocaleString()}. Please fund your wallet to proceed.`);
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

            if (res && (res.isValid || res.data)) {
                const responseData = res.data || { status: 'COMPLETED', reference: customReference };
                setResult(responseData);
                showAlert("Submitted", "VNIN to NIBSS linking request submitted successfully.", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'vnin_to_nibss',
                    search_number: cleanBvn,
                    holder_name: fullName.trim(),
                    details: {
                        ...responseData,
                        ticket_id: cleanTicket,
                        nin: cleanNin,
                        bvn: cleanBvn,
                        reference: customReference,
                        status: responseData.status || 'PROCESSING'
                    },
                });

                fetchWalletBalance();
                setTrackingRef(customReference);
                setActiveTab('status');
            } else {
                showAlert("Submission Failed", res?.message || "Could not forward request to NIBSS.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred during submission.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        const query = trackingRef.trim();
        if (!query) {
            showAlert("Required", "Please enter a Reference or Ticket ID.");
            return;
        }

        setTrackingLoading(true);
        setStatusResult(null);

        try {
            const res = await api.identity.checkVNINStatus(query);
            if (res && res.data) {
                setStatusResult(res.data?.data || res.data);
            } else {
                showAlert("Status", res?.message || "No status update found.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "Failed to check status.");
        } finally {
            setTrackingLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 20 }]}
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
                <Text style={styles.titleText}>VNIN to NIBSS</Text>
                <Text style={styles.subText}>Link VNIN directly to the NIBSS central repository</Text>

                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Submit Link</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'status' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('status')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'status' && styles.tabButtonTextActive]}>Track Status</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
                {activeTab === 'submit' ? (
                    <>
                        <View style={styles.formCard}>
                            <Text style={styles.inputLabel}>TICKET ID / REFERENCE</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. TICKET-12345"
                                placeholderTextColor="#94a3b8"
                                value={ticketId}
                                onChangeText={setTicketId}
                                autoCapitalize="characters"
                            />

                            <Text style={[styles.inputLabel, { marginTop: 10 }]}>FULL NAME (As on NIN/BVN)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="First Middle Last"
                                placeholderTextColor="#94a3b8"
                                value={fullName}
                                onChangeText={setFullName}
                            />

                            <View style={[styles.grid2, { marginTop: 10 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>NIN (11 Digits)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="11-digit NIN"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        maxLength={11}
                                        value={nin}
                                        onChangeText={setNin}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>BVN (11 Digits)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="11-digit BVN"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        maxLength={11}
                                        value={bvn}
                                        onChangeText={setBvn}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#0B192C" size="small" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Submit to NIBSS (₦{servicePrice.toLocaleString()})</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.rulesCard}>
                            <View style={styles.rulesHeader}>
                                <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                                <Text style={styles.rulesHeaderText}>Important Guidelines</Text>
                            </View>
                            <Text style={styles.ruleItem}>• Ensure ticket ID and demographic details match your record.</Text>
                            <Text style={styles.ruleItem}>• Requests are queued directly for central NIBSS synchronization.</Text>
                        </View>
                    </>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>REFERENCE OR TICKET ID</Text>
                        <View style={styles.trackInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 8 }]}
                                placeholder="Reference or Ticket ID"
                                placeholderTextColor="#94a3b8"
                                value={trackingRef}
                                onChangeText={setTrackingRef}
                            />
                            <TouchableOpacity
                                style={styles.trackBtn}
                                onPress={handleCheckStatus}
                                disabled={trackingLoading}
                                activeOpacity={0.8}
                            >
                                {trackingLoading ? (
                                    <ActivityIndicator size="small" color="#0B192C" />
                                ) : (
                                    <Text style={styles.trackBtnText}>Check</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {statusResult && (
                            <View style={styles.statusResultCard}>
                                <Text style={styles.statusResultTitle}>Linking Status</Text>
                                <Text style={styles.statusResultVal}>Status: {statusResult.current_status || statusResult.status || 'PROCESSING'}</Text>
                                {statusResult.message && (
                                    <Text style={styles.statusResultMsg}>{statusResult.message}</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Terms Modal */}
            <Modal
                visible={showTermsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTermsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Ionicons name="link" size={24} color="#D4AF37" style={{ marginBottom: 6 }} />
                        <Text style={styles.modalTitle}>NIBSS Linking</Text>
                        <Text style={styles.modalBody}>
                            This request transmits verified identity details directly to the NIBSS central repository.
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

            <BrandAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
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
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1, marginBottom: 10 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 },
    tabButton: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
    tabButtonActive: { backgroundColor: '#D4AF37' },
    tabButtonText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
    tabButtonTextActive: { color: '#0B192C', fontWeight: '800' },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 4, letterSpacing: 0.2 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, height: 42, fontSize: 13, color: '#0B192C', backgroundColor: '#ffffff' },
    grid2: { flexDirection: 'row', gap: 8 },
    submitBtn: { backgroundColor: '#D4AF37', height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    submitBtnText: { color: '#0B192C', fontSize: 13, fontWeight: '800' },
    rulesCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    rulesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    rulesHeaderText: { fontSize: 11, fontWeight: '800', color: '#475569', marginLeft: 4 },
    ruleItem: { fontSize: 10, color: '#64748b', lineHeight: 15, marginBottom: 2 },
    trackInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    trackBtn: { backgroundColor: '#D4AF37', height: 42, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    trackBtnText: { color: '#0B192C', fontSize: 11, fontWeight: '800' },
    statusResultCard: { backgroundColor: '#FEF9E7', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginTop: 8 },
    statusResultTitle: { fontSize: 11, fontWeight: '800', color: '#B45309', marginBottom: 4 },
    statusResultVal: { fontSize: 12, fontWeight: '700', color: '#0B192C' },
    statusResultMsg: { fontSize: 11, color: '#64748b', marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 320, backgroundColor: '#ffffff', borderRadius: 14, padding: 16, alignItems: 'center' },
    modalTitle: { fontSize: 15, fontWeight: '900', color: '#0B192C', marginBottom: 4 },
    modalBody: { fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 16, marginBottom: 10 },
    modalBtn: { backgroundColor: '#0B192C', width: '100%', height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { color: '#D4AF37', fontSize: 12, fontWeight: '800' },
});
