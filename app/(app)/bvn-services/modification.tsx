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

const BANK_CODES = [
    { code: '701', name: 'Agency Banking' },
    { code: '702', name: 'Heritage Bank' },
    { code: '703', name: 'Bank of Agriculture' },
    { code: '704', name: 'NIBSS MFB' },
    { code: '705', name: 'Enterprise Bank' },
    { code: '706', name: 'First Bank' },
    { code: '707', name: 'Keystone Bank' },
    { code: '708', name: 'FCMB' },
];

const MODIFICATION_TYPES = [
    { code: '620', label: 'Change of Name' },
    { code: '621', label: 'Change of Date of Birth' },
    { code: '622', label: 'Change of Phone Number' },
    { code: '623', label: 'Name & Phone' },
    { code: '624', label: 'DOB & Phone' },
    { code: '625', label: 'Full Modification' },
    { code: '626', label: 'Name & DOB' },
];

export default function BVNModificationScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'submit' | 'status'>('submit');

    // Selected Bank and Modification Type
    const [bankCode, setBankCode] = useState('706'); // First Bank by default
    const [serviceCode, setServiceCode] = useState('620'); // Name Change by default
    const [showBankPicker, setShowBankPicker] = useState(false);

    // Primary Identifiers
    const [nin, setNin] = useState('');
    const [bvn, setBvn] = useState('');
    const [oldFirstName, setOldFirstName] = useState('');
    const [oldSurname, setOldSurname] = useState('');
    const [oldMiddleName, setOldMiddleName] = useState('');

    // Modification Data Fields
    const [newFirstName, setNewFirstName] = useState('');
    const [newSurname, setNewSurname] = useState('');
    const [newMiddleName, setNewMiddleName] = useState('');

    const [oldDob, setOldDob] = useState('');
    const [newDob, setNewDob] = useState('');

    const [oldPhone, setOldPhone] = useState('');
    const [newPhone, setNewPhone] = useState('');

    // Status Tracking
    const [trackingQuery, setTrackingQuery] = useState('');
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [statusResult, setStatusResult] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const isNameRequired = ['620', '623', '625', '626'].includes(serviceCode);
    const isDobRequired = ['621', '624', '625', '626'].includes(serviceCode);
    const isPhoneRequired = ['622', '623', '624', '625'].includes(serviceCode);

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

    const handleSubmitModification = async () => {
        const cleanNin = nin.trim().replace(/\D/g, '');
        const cleanBvn = bvn.trim().replace(/\D/g, '');

        if (cleanNin.length !== 11) {
            showAlert("Invalid NIN", "NIN must be exactly 11 digits.");
            return;
        }
        if (cleanBvn.length !== 11) {
            showAlert("Invalid BVN", "BVN must be exactly 11 digits.");
            return;
        }
        if (!oldFirstName.trim() || !oldSurname.trim()) {
            showAlert("Required Fields", "Please enter current Old First Name and Old Surname as on BVN.");
            return;
        }

        if (isNameRequired && (!newFirstName.trim() || !newSurname.trim())) {
            showAlert("Required Fields", "Please enter New First Name and New Surname.");
            return;
        }

        if (isDobRequired && (!oldDob.trim() || !newDob.trim())) {
            showAlert("Required Fields", "Please provide both Old Date of Birth and New Date of Birth (YYYY-MM-DD).");
            return;
        }

        if (isPhoneRequired && (!newPhone.trim() || newPhone.replace(/\D/g, '').length < 10)) {
            showAlert("Required Fields", "Please provide a valid 11-digit New Phone Number.");
            return;
        }

        if (userBalance !== null && userBalance < 100) {
            showAlert("Insufficient Balance", "Your account balance is low. Please fund your wallet to proceed.");
            return;
        }

        setLoading(true);

        try {
            const ref = `REF-MOD-${Date.now()}`;
            const payload: any = {
                service_code: serviceCode,
                bank_code: bankCode,
                reference: ref,
                nin: cleanNin,
                bvn: cleanBvn,
                old_first_name: oldFirstName.trim(),
                old_surname: oldSurname.trim(),
                old_middle_name: oldMiddleName.trim() || '',
            };

            if (isNameRequired) {
                payload.new_first_name = newFirstName.trim();
                payload.new_surname = newSurname.trim();
                payload.new_middle_name = newMiddleName.trim() || '';
            }

            if (isDobRequired) {
                payload.old_dob = oldDob.trim();
                payload.new_dob = newDob.trim();
            }

            if (isPhoneRequired) {
                payload.old_phone = oldPhone.trim().replace(/\D/g, '');
                payload.new_phone_number = newPhone.trim().replace(/\D/g, '');
            }

            const res = await api.identity.requestBVNModification(payload, 'bvn_modification');

            if (res && (res.isValid || res.data)) {
                const data = res.data?.data || res.data || {};
                const requestId = data.request_id || data.requestId || ref;

                showAlert("Submitted", "BVN Modification request submitted successfully.", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'bvn_modification',
                    search_number: cleanBvn,
                    holder_name: `${newFirstName || oldFirstName} ${newSurname || oldSurname}`.trim(),
                    details: {
                        ...payload,
                        ...data,
                        request_id: requestId,
                        status: data.status || 'PROCESSING'
                    },
                });

                fetchWalletBalance();
                setTrackingQuery(requestId);
                setActiveTab('status');
            } else {
                showAlert("Submission Failed", res?.message || "Could not submit modification request.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while connecting to the server.");
        } finally {
            setLoading(false);
        }
    };

    const handleTrackStatus = async () => {
        const q = trackingQuery.trim();
        if (!q) {
            showAlert("Required", "Please enter a Request ID or Reference to check status.");
            return;
        }

        setTrackingLoading(true);
        setStatusResult(null);

        try {
            const res = await api.identity.checkBVNModificationStatus(q);
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

    const selectedBank = BANK_CODES.find(b => b.code === bankCode) || BANK_CODES[5];

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
                <Text style={styles.titleText}>BVN Modification</Text>
                <Text style={styles.subText}>Correct or update details on BVN records</Text>

                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Submit</Text>
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
                        {/* Bank Picker */}
                        <Text style={styles.inputLabel}>ENROLLING BANK</Text>
                        <TouchableOpacity 
                            style={styles.dropdownButton}
                            onPress={() => setShowBankPicker(!showBankPicker)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.dropdownButtonText}>{selectedBank.name} ({selectedBank.code})</Text>
                            <Ionicons name={showBankPicker ? "chevron-up" : "chevron-down"} size={16} color="#0B192C" />
                        </TouchableOpacity>

                        {showBankPicker && (
                            <View style={styles.bankPickerList}>
                                {BANK_CODES.map((bank) => (
                                    <TouchableOpacity
                                        key={bank.code}
                                        style={[styles.bankPickerItem, bankCode === bank.code && styles.bankPickerItemActive]}
                                        onPress={() => {
                                            setBankCode(bank.code);
                                            setShowBankPicker(false);
                                        }}
                                    >
                                        <Text style={[styles.bankPickerText, bankCode === bank.code && styles.bankPickerTextActive]}>
                                            {bank.name} ({bank.code})
                                        </Text>
                                        {bankCode === bank.code && (
                                            <Ionicons name="checkmark-circle" size={14} color="#D4AF37" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Modification Type Selector */}
                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>MODIFICATION TYPE</Text>
                        <View style={styles.typeGrid}>
                            {MODIFICATION_TYPES.map((type) => {
                                const isSelected = serviceCode === type.code;
                                return (
                                    <TouchableOpacity
                                        key={type.code}
                                        style={[styles.typeCard, isSelected && styles.typeCardActive]}
                                        onPress={() => setServiceCode(type.code)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Primary Identifiers */}
                        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>PRIMARY IDENTIFIERS</Text>
                        <View style={styles.grid2}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>NIN (11 Digits)</Text>
                                <TextInput style={styles.input} placeholder="NIN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={nin} onChangeText={setNin} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>BVN (11 Digits)</Text>
                                <TextInput style={styles.input} placeholder="BVN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={bvn} onChangeText={setBvn} />
                            </View>
                        </View>

                        <View style={[styles.grid2, { marginTop: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Old First Name</Text>
                                <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#94a3b8" value={oldFirstName} onChangeText={setOldFirstName} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Old Surname</Text>
                                <TextInput style={styles.input} placeholder="Surname" placeholderTextColor="#94a3b8" value={oldSurname} onChangeText={setOldSurname} />
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Old Middle Name (Optional)</Text>
                        <TextInput style={styles.input} placeholder="Middle Name" placeholderTextColor="#94a3b8" value={oldMiddleName} onChangeText={setOldMiddleName} />

                        {/* Modification Fields */}
                        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>NEW DETAILS</Text>

                        {isNameRequired && (
                            <>
                                <View style={styles.grid2}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>New First Name</Text>
                                        <TextInput style={styles.input} placeholder="New First" placeholderTextColor="#94a3b8" value={newFirstName} onChangeText={setNewFirstName} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>New Surname</Text>
                                        <TextInput style={styles.input} placeholder="New Surname" placeholderTextColor="#94a3b8" value={newSurname} onChangeText={setNewSurname} />
                                    </View>
                                </View>
                                <Text style={[styles.inputLabel, { marginTop: 10 }]}>New Middle Name (Optional)</Text>
                                <TextInput style={styles.input} placeholder="New Middle" placeholderTextColor="#94a3b8" value={newMiddleName} onChangeText={setNewMiddleName} />
                            </>
                        )}

                        {isDobRequired && (
                            <View style={[styles.grid2, { marginTop: 8 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Old DOB (YYYY-MM-DD)</Text>
                                    <TextInput style={styles.input} placeholder="1990-01-01" placeholderTextColor="#94a3b8" value={oldDob} onChangeText={setOldDob} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>New DOB (YYYY-MM-DD)</Text>
                                    <TextInput style={styles.input} placeholder="1992-05-15" placeholderTextColor="#94a3b8" value={newDob} onChangeText={setNewDob} />
                                </View>
                            </View>
                        )}

                        {isPhoneRequired && (
                            <View style={[styles.grid2, { marginTop: 8 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Old Phone (Optional)</Text>
                                    <TextInput style={styles.input} placeholder="Old Phone" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={oldPhone} onChangeText={setOldPhone} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>New Phone Number</Text>
                                    <TextInput style={styles.input} placeholder="New Phone" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={newPhone} onChangeText={setNewPhone} />
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitModification}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#0B192C" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Modification</Text>
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
                                <Text style={styles.statusResultTitle}>Status Result</Text>
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
                        <Ionicons name="shield-checkmark" size={24} color="#D4AF37" style={{ marginBottom: 6 }} />
                        <Text style={styles.modalTitle}>Modification Rules</Text>
                        <Text style={styles.modalBody}>
                            Ensure all entered details strictly match official government supporting documents.
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
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1, marginBottom: 10 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 },
    tabButton: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
    tabButtonActive: { backgroundColor: '#D4AF37' },
    tabButtonText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
    tabButtonTextActive: { color: '#0B192C', fontWeight: '800' },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 4, letterSpacing: 0.2 },
    dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, height: 42, backgroundColor: '#ffffff', marginBottom: 6 },
    dropdownButtonText: { fontSize: 13, fontWeight: '700', color: '#0B192C' },
    bankPickerList: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, overflow: 'hidden' },
    bankPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    bankPickerItemActive: { backgroundColor: '#FEF9E7' },
    bankPickerText: { fontSize: 12, color: '#334155', fontWeight: '600' },
    bankPickerTextActive: { color: '#0B192C', fontWeight: '800' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    typeCard: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    typeCardActive: { backgroundColor: '#FEF9E7', borderColor: '#D4AF37' },
    typeText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    typeTextActive: { color: '#0B192C', fontWeight: '800' },
    sectionHeader: { fontSize: 11, fontWeight: '900', color: '#B45309', marginBottom: 8, letterSpacing: 0.5 },
    grid2: { flexDirection: 'row', gap: 8 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, height: 42, fontSize: 13, color: '#0B192C', backgroundColor: '#ffffff' },
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
