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

    const handleSubmitEnrollment = async () => {
        if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !bvn.trim() || !bankName.trim() || !accountNumber.trim()) {
            showAlert("Required Fields", "Please complete all required fields (Name, BVN, Email, Phone, Address, Bank & Account).");
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
            showAlert("Invalid Phone Number", "Please provide a valid 11-digit phone number.");
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
                email: email.trim(),
                phone_number: cleanPhone,
                home_address: homeAddress.trim(),
                state_of_residence: stateOfRes.trim(),
                date_of_birth: dob.trim() || '1990-01-01',
                local_government: lga.trim(),
                senatorial_district: senatorialDistrict.trim() || stateOfRes.trim(),
            };

            const res = await api.identity.submitBVNEnrollment(payload, 'bvn_enrollment');

            if (res && res.isValid) {
                const reqId = res.data?.request_id || res.data?.data?.request_id || clientRef;
                showAlert("Application Submitted", "Your Android BVN Enrollment request has been submitted successfully! You will receive your login credentials via email once approved.", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'enrollment',
                    search_number: reqId,
                    holder_name: `${firstName.trim()} ${lastName.trim()}`,
                    details: {
                        ...payload,
                        request_id: reqId,
                        status: 'PROCESSING',
                        submittedAt: new Date().toISOString()
                    },
                });
                fetchWalletBalance();
                setActiveTab('status');
                setTrackingQuery(reqId);
            } else {
                showAlert("Submission Failed", res?.message || "Unable to submit enrollment application. Please try again.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while communicating with the server.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async () => {
        const cleanQuery = trackingQuery.trim();
        if (!cleanQuery) {
            showAlert("Query Required", "Please enter a Request ID or Reference to check enrollment status.");
            return;
        }

        setTrackingLoading(true);
        setStatusResult(null);

        try {
            const res = await api.identity.checkBVNEnrollmentStatus(cleanQuery);
            if (res && res.isValid && res.data) {
                setStatusResult(res.data);
            } else {
                showAlert("Record Not Found", res?.message || "No enrollment record found for the provided ID.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while tracking status.");
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
                        style={styles.rulesBadge}
                        onPress={() => setShowRulesModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={14} color="#818cf8" style={{ marginRight: 4 }} />
                        <Text style={styles.rulesBadgeText}>Enrollment Rules</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>Android BVN Enrollment</Text>
                <Text style={styles.subText}>Register to get your portal credentials for enrolling BVNs for customers</Text>

                {/* Tab Controls */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                    >
                        <Ionicons name="create-outline" size={15} color={activeTab === 'submit' ? '#4f46e5' : '#94a3b8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Submit Application</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'status' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('status')}
                    >
                        <Ionicons name="pulse-outline" size={15} color={activeTab === 'status' ? '#4f46e5' : '#94a3b8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'status' && styles.tabButtonTextActive]}>Track Status</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {activeTab === 'submit' ? (
                    <>
                        <View style={styles.formCard}>
                            {/* Personal Details */}
                            <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>
                            <View style={styles.grid2}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>First Name</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#94a3b8" value={firstName} onChangeText={setFirstName} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Last Name</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor="#94a3b8" value={lastName} onChangeText={setLastName} />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.grid2, { marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Date of Birth</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={dob} onChangeText={setDob} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Your BVN (11 Digits)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="11 digits" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={bvn} onChangeText={setBvn} />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.grid2, { marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Email (Must be NEW!)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="New Email" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Phone (Must be NEW!)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="08012345678" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={phone} onChangeText={setPhone} />
                                    </View>
                                </View>
                            </View>

                            {/* Location Details */}
                            <Text style={[styles.sectionHeader, { marginTop: 22 }]}>LOCATION DETAILS</Text>
                            <Text style={styles.inputLabel}>Home Address</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={styles.input} placeholder="Full street address" placeholderTextColor="#94a3b8" value={homeAddress} onChangeText={setHomeAddress} />
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Agent Location (Business Address)</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={styles.input} placeholder="Where will you operate?" placeholderTextColor="#94a3b8" value={agentLocation} onChangeText={setAgentLocation} />
                            </View>

                            <View style={[styles.grid2, { marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>State of Residence</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="State" placeholderTextColor="#94a3b8" value={stateOfRes} onChangeText={setStateOfRes} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Local Government Area</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="LGA" placeholderTextColor="#94a3b8" value={lga} onChangeText={setLga} />
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Senatorial District</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={styles.input} placeholder="e.g. Lagos West" placeholderTextColor="#94a3b8" value={senatorialDistrict} onChangeText={setSenatorialDistrict} />
                            </View>

                            {/* Financial Details */}
                            <Text style={[styles.sectionHeader, { marginTop: 22 }]}>FINANCIAL DETAILS</Text>
                            <Text style={styles.inputLabel}>Parkway Wallet ID</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={styles.input} placeholder="Your Parkway Wallet ID" placeholderTextColor="#94a3b8" value={parkwayWalletId} onChangeText={setParkwayWalletId} />
                            </View>

                            <View style={[styles.grid2, { marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Bank Name</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="e.g. Access Bank" placeholderTextColor="#94a3b8" value={bankName} onChangeText={setBankName} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Account Number</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="10 Digits" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={10} value={accountNumber} onChangeText={setAccountNumber} />
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Account Name</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={styles.input} placeholder="Name matching your account" placeholderTextColor="#94a3b8" value={accountName} onChangeText={setAccountName} />
                            </View>

                            {/* Cost Row */}
                            <View style={styles.costRow}>
                                <Text style={styles.costLabel}>Registration Fee:</Text>
                                <Text style={styles.costVal}>₦30,000.00</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.btn, loading && { opacity: 0.7 }]}
                                onPress={handleSubmitEnrollment}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                        <Text style={styles.btnText}>Submit Registration</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Rules card */}
                        <View style={styles.rulesCard}>
                            <View style={styles.rulesHeader}>
                                <Ionicons name="alert-circle-outline" size={18} color="#4f46e5" />
                                <Text style={styles.rulesHeaderText}>Important Rules</Text>
                            </View>
                            <Text style={styles.ruleItem}>• Your Email and Phone number must be completely new. Applications with previously used details will be rejected.</Text>
                            <Text style={styles.ruleItem}>• Processing requires 5 working days before NIBSS generates and issues portal credentials.</Text>
                            <Text style={styles.ruleItem}>• Credentials will be sent directly to your registered email address upon completion.</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Status Check View */}
                        <View style={styles.formCard}>
                            <Text style={styles.inputLabel}>REQUEST ID OR REFERENCE</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. cmkxhhzgj00047qg40h7ub2oj or BVN-ENR-..."
                                    placeholderTextColor="#94a3b8"
                                    value={trackingQuery}
                                    onChangeText={setTrackingQuery}
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
                                <Text style={styles.statusMessage}>{statusResult.message || statusResult.data?.instruction || 'Your enrollment application is being processed by NIBSS admins.'}</Text>
                                {statusResult.last_updated && (
                                    <Text style={styles.statusDate}>Last updated: {new Date(statusResult.last_updated).toLocaleString()}</Text>
                                )}
                            </View>
                        )}
                    </>
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
                        <View style={styles.modalIconBox}>
                            <Ionicons name="shield-checkmark" size={28} color="#4f46e5" />
                        </View>
                        <Text style={styles.modalTitle}>Important Enrollment Rules</Text>
                        <Text style={styles.modalBody}>
                            You are applying for <Text style={{ fontWeight: 'bold' }}>Android BVN Enrollment Portal Access</Text>.
                        </Text>
                        
                        <View style={styles.reqBox}>
                            <Text style={styles.reqTitle}>CRITICAL REQUIREMENT</Text>
                            <Text style={styles.reqText}>
                                Ensure you provide a completely <Text style={{ fontWeight: 'bold' }}>NEW email address and phone number</Text> that have never been used before for any Android BVN Enrollment request.
                            </Text>
                        </View>

                        <Text style={[styles.modalBody, { marginTop: 12 }]}>
                            <Text style={{ fontWeight: 'bold' }}>Processing Time:</Text> You will receive your User Login Details via your Email within <Text style={{ fontWeight: 'bold' }}>5 working days</Text>.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setShowRulesModal(false)}
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
    rulesBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#6366f1' },
    rulesBadgeText: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 14 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 3 },
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 9 },
    tabButtonActive: { backgroundColor: '#ffffff' },
    tabButtonText: { fontSize: 12, fontWeight: '700', color: '#cbd5e1' },
    tabButtonTextActive: { color: '#0f172a' },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    sectionHeader: { fontSize: 12, fontWeight: '900', color: '#4f46e5', marginBottom: 12, letterSpacing: 0.5 },
    grid2: { flexDirection: 'row', gap: 10 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6 },
    inputRow: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 46, justifyContent: 'center' },
    input: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 16, fontWeight: '900', color: '#4f46e5' },
    btn: { backgroundColor: '#4f46e5', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    rulesCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e0e7ff' },
    rulesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    rulesHeaderText: { fontSize: 13, fontWeight: '800', color: '#4f46e5', marginLeft: 6 },
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
    modalIconBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
    modalBody: { fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 18 },
    reqBox: { backgroundColor: '#faf5ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 10 },
    reqTitle: { fontSize: 11, fontWeight: '900', color: '#7e22ce', textAlign: 'center', marginBottom: 4 },
    reqText: { fontSize: 11, color: '#6b21a8', textAlign: 'center', lineHeight: 16 },
    modalBtn: { backgroundColor: '#4f46e5', width: '100%', height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    modalBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
