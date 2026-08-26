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

export default function BVNEnrollmentScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'submit' | 'status'>('submit');

    // Personal Details
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [bvn, setBvn] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Location Details
    const [homeAddress, setHomeAddress] = useState('');
    const [agentLocation, setAgentLocation] = useState('');
    const [stateOfRes, setStateOfRes] = useState('');
    const [lga, setLga] = useState('');
    const [senatorialDistrict, setSenatorialDistrict] = useState('');

    // Financial Details
    const [parkwayWalletId, setParkwayWalletId] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');

    // Status Tracking
    const [trackingQuery, setTrackingQuery] = useState('');
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [statusResult, setStatusResult] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [showRulesModal, setShowRulesModal] = useState(false);
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

    useEffect(() => {
        fetchWalletBalance();
    }, []);

    const showAlert = (title: string, message: string, type: AlertType = 'error') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const handleSubmitEnrollment = async () => {
        if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !bvn.trim() || !bankName.trim() || !accountNumber.trim()) {
            showAlert("Required Fields", "Please complete all required demographic, contact, and account details.");
            return;
        }

        const cleanBvn = bvn.trim().replace(/\D/g, '');
        const cleanPhone = phone.trim().replace(/\D/g, '');
        const cleanAccount = accountNumber.trim().replace(/\D/g, '');

        if (cleanBvn.length !== 11) {
            showAlert("Invalid BVN", "Your BVN must be exactly 11 digits.");
            return;
        }
        if (cleanPhone.length < 10) {
            showAlert("Invalid Phone Number", "Please provide a valid phone number.");
            return;
        }
        if (cleanAccount.length !== 10) {
            showAlert("Invalid Account Number", "Bank Account Number must be exactly 10 digits.");
            return;
        }

        const clientRef = `BVN-ENR-${Date.now()}`;
        setLoading(true);

        try {
            const payload = {
                reference: clientRef,
                parkway_wallet_id: parkwayWalletId.trim() || `WALLET-${cleanPhone}`,
                bvn: cleanBvn,
                agent_location: agentLocation.trim() || `${lga.trim()}, ${stateOfRes.trim()}`,
                bank_name: bankName.trim(),
                account_number: cleanAccount,
                account_name: accountName.trim() || `${firstName.trim()} ${lastName.trim()}`,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim().toLowerCase(),
                phone_number: cleanPhone,
                home_address: homeAddress.trim(),
                state_of_residence: stateOfRes.trim(),
                local_government: lga.trim(),
                senatorial_district: senatorialDistrict.trim() || 'Central',
                date_of_birth: dob.trim(),
            };

            const res = await api.identity.submitBVNEnrollment(payload, 'bvn_enrollment');

            if (res && (res.isValid || res.data)) {
                const data = res.data?.data || res.data || {};
                const reqId = data.request_id || data.requestId || clientRef;

                showAlert("Submitted", "BVN User Enrollment application submitted successfully.", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'bvn_enrollment',
                    search_number: cleanBvn,
                    holder_name: `${firstName.trim()} ${lastName.trim()}`,
                    details: {
                        ...payload,
                        ...data,
                        request_id: reqId,
                        status: data.status || 'PROCESSING'
                    },
                });

                fetchWalletBalance();
                setTrackingQuery(reqId);
                setActiveTab('status');
            } else {
                showAlert("Submission Failed", res?.message || "Could not submit enrollment details.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred during submission.");
        } finally {
            setLoading(false);
        }
    };

    const handleTrackStatus = async () => {
        const q = trackingQuery.trim();
        if (!q) {
            showAlert("Required", "Please enter a Request ID or Reference.");
            return;
        }

        setTrackingLoading(true);
        setStatusResult(null);

        try {
            const res = await api.identity.checkBVNEnrollmentStatus(q);
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
                        onPress={() => setShowRulesModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={13} color="#D4AF37" style={{ marginRight: 3 }} />
                        <Text style={styles.noticeBadgeText}>Guidelines</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>BVN User Enrollment</Text>
                <Text style={styles.subText}>Demographic onboarding for new BVN holders</Text>

                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Enroll</Text>
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
                    <View style={styles.formCard}>
                        {/* Personal Details */}
                        <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>
                        <View style={styles.grid2}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>First Name</Text>
                                <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#94a3b8" value={firstName} onChangeText={setFirstName} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Last Name</Text>
                                <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor="#94a3b8" value={lastName} onChangeText={setLastName} />
                            </View>
                        </View>

                        <View style={[styles.grid2, { marginTop: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Date of Birth</Text>
                                <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={dob} onChangeText={setDob} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>BVN (11 Digits)</Text>
                                <TextInput style={styles.input} placeholder="BVN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={bvn} onChangeText={setBvn} />
                            </View>
                        </View>

                        <View style={[styles.grid2, { marginTop: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Email Address</Text>
                                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Phone Number</Text>
                                <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={phone} onChangeText={setPhone} />
                            </View>
                        </View>

                        {/* Location Details */}
                        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>LOCATION DETAILS</Text>
                        <Text style={styles.inputLabel}>Home Address</Text>
                        <TextInput style={styles.input} placeholder="Street Address" placeholderTextColor="#94a3b8" value={homeAddress} onChangeText={setHomeAddress} />

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Agent Location</Text>
                        <TextInput style={styles.input} placeholder="Operating Location" placeholderTextColor="#94a3b8" value={agentLocation} onChangeText={setAgentLocation} />

                        <View style={[styles.grid2, { marginTop: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>State of Residence</Text>
                                <TextInput style={styles.input} placeholder="State" placeholderTextColor="#94a3b8" value={stateOfRes} onChangeText={setStateOfRes} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>LGA</Text>
                                <TextInput style={styles.input} placeholder="LGA" placeholderTextColor="#94a3b8" value={lga} onChangeText={setLga} />
                            </View>
                        </View>

                        {/* Financial Details */}
                        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>FINANCIAL DETAILS</Text>
                        <View style={styles.grid2}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Bank Name</Text>
                                <TextInput style={styles.input} placeholder="e.g. Access Bank" placeholderTextColor="#94a3b8" value={bankName} onChangeText={setBankName} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Account Number</Text>
                                <TextInput style={styles.input} placeholder="10 Digits" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={10} value={accountNumber} onChangeText={setAccountNumber} />
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Account Name</Text>
                        <TextInput style={styles.input} placeholder="Account Name" placeholderTextColor="#94a3b8" value={accountName} onChangeText={setAccountName} />

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitEnrollment}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#0B192C" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Application</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.inputLabel}>Request ID or Reference</Text>
                        <View style={styles.trackInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 8 }]}
                                placeholder="Request ID or Reference"
                                placeholderTextColor="#94a3b8"
                                value={trackingQuery}
                                onChangeText={setTrackingQuery}
                            />
                            <TouchableOpacity 
                                style={styles.trackBtn} 
                                onPress={handleTrackStatus} 
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
                                <Text style={styles.statusResultTitle}>Application Status</Text>
                                <Text style={styles.statusResultVal}>Status: {statusResult.current_status || statusResult.status || 'PROCESSING'}</Text>
                                {statusResult.message && (
                                    <Text style={styles.statusResultMsg}>{statusResult.message}</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Rules Modal */}
            <Modal
                visible={showRulesModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowRulesModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Ionicons name="person-add" size={24} color="#D4AF37" style={{ marginBottom: 6 }} />
                        <Text style={styles.modalTitle}>Enrollment Notice</Text>
                        <Text style={styles.modalBody}>
                            Credentials and onboarding confirmation are issued directly by NIBSS processing upon verification.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setShowRulesModal(false)}
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
    sectionHeader: { fontSize: 11, fontWeight: '900', color: '#B45309', marginBottom: 8, letterSpacing: 0.5 },
    grid2: { flexDirection: 'row', gap: 8 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 4, letterSpacing: 0.2 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, height: 42, fontSize: 13, color: '#0B192C', backgroundColor: '#ffffff', marginBottom: 4 },
    submitBtn: { backgroundColor: '#D4AF37', height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    submitBtnText: { color: '#0B192C', fontSize: 13, fontWeight: '800' },
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
