import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal, StyleSheet, Linking } from 'react-native';
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
    { code: '620', label: 'Change of Name', fee: 5900 },
    { code: '621', label: 'Change of Date of Birth', fee: 5900 },
    { code: '622', label: 'Change of Phone Number', fee: 5900 },
    { code: '623', label: 'Change of Name & Phone', fee: 9000 },
    { code: '624', label: 'Change of DOB & Phone', fee: 9000 },
    { code: '625', label: 'Full Data Modification', fee: 12000 },
    { code: '626', label: 'Change of Name & DOB', fee: 9000 },
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

        if (isPhoneRequired && !newPhone.trim()) {
            showAlert("Required Fields", "Please enter New Phone Number.");
            return;
        }

        const clientRef = `REF-MOD-${Date.now()}`;
        setLoading(true);

        try {
            const payload: any = {
                service_code: serviceCode,
                bank_code: bankCode,
                reference: clientRef,
                nin: cleanNin,
                bvn: cleanBvn,
                old_first_name: oldFirstName.trim(),
                old_surname: oldSurname.trim(),
                old_middle_name: oldMiddleName.trim() || undefined,
            };

            if (isNameRequired) {
                payload.new_first_name = newFirstName.trim();
                payload.new_surname = newSurname.trim();
                if (newMiddleName.trim()) payload.new_middle_name = newMiddleName.trim();
            }

            if (isDobRequired) {
                payload.old_dob = oldDob.trim();
                payload.new_dob = newDob.trim();
            }

            if (isPhoneRequired) {
                if (oldPhone.trim()) payload.old_phone_number = oldPhone.trim().replace(/\D/g, '');
                payload.new_phone_number = newPhone.trim().replace(/\D/g, '');
            }

            const res = await api.identity.requestBVNModification(payload, 'bvn_modification');

            if (res && res.isValid) {
                const reqId = res.data?.request_id || res.data?.data?.request_id || clientRef;
                showAlert("Modification Submitted", "Your BVN Modification request has been queued for NIBSS processing. You can track progress in the Track Status tab.", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'modification',
                    search_number: cleanBvn,
                    holder_name: `${oldFirstName.trim()} ${oldSurname.trim()}`,
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
                showAlert("Submission Failed", res?.message || "Unable to submit modification request. Please verify your details.");
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
            showAlert("Query Required", "Please enter a Request ID or Reference to check status.");
            return;
        }

        setTrackingLoading(true);
        setStatusResult(null);

        try {
            const res = await api.identity.checkBVNModificationStatus(cleanQuery);
            if (res && res.isValid && res.data) {
                setStatusResult(res.data);
            } else {
                showAlert("Record Not Found", res?.message || "No modification record found for the provided ID.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while tracking status.");
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
                        <Ionicons name="alert-circle-outline" size={14} color="#f43f5e" style={{ marginRight: 4 }} />
                        <Text style={styles.termsBadgeText}>Modification Terms</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>BVN Data Modification</Text>
                <Text style={styles.subText}>Request manual updates to your BVN records via authorized channels</Text>

                {/* Tab Controls */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                    >
                        <Ionicons name="create-outline" size={15} color={activeTab === 'submit' ? '#e11d48' : '#94a3b8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Submit Request</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'status' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('status')}
                    >
                        <Ionicons name="pulse-outline" size={15} color={activeTab === 'status' ? '#e11d48' : '#94a3b8'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'status' && styles.tabButtonTextActive]}>Track Status</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {activeTab === 'submit' ? (
                    <>
                        <View style={styles.formCard}>
                            {/* Bank Picker */}
                            <Text style={styles.inputLabel}>SELECT ENROLLING BANK</Text>
                            <TouchableOpacity 
                                style={styles.dropdownButton}
                                onPress={() => setShowBankPicker(!showBankPicker)}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="business" size={16} color="#64748b" style={{ marginRight: 8 }} />
                                    <Text style={styles.dropdownButtonText}>{selectedBank.name} ({selectedBank.code})</Text>
                                </View>
                                <Ionicons name={showBankPicker ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
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
                                                <Ionicons name="checkmark-circle" size={16} color="#e11d48" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Modification Type Selector */}
                            <Text style={[styles.inputLabel, { marginTop: 18 }]}>WHAT WOULD YOU LIKE TO MODIFY?</Text>
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
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={14} color="#e11d48" style={{ marginTop: 4 }} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Primary Identifiers */}
                            <Text style={[styles.sectionHeader, { marginTop: 22 }]}>PRIMARY IDENTIFIERS</Text>
                            <View style={styles.grid2}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>NIN (11 Digits)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="11-digit NIN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={nin} onChangeText={setNin} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>BVN (11 Digits)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="11-digit BVN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={bvn} onChangeText={setBvn} />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.grid2, { marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Old First Name (As on BVN)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="Old First Name" placeholderTextColor="#94a3b8" value={oldFirstName} onChangeText={setOldFirstName} />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Old Surname (As on BVN)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="Old Surname" placeholderTextColor="#94a3b8" value={oldSurname} onChangeText={setOldSurname} />
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Old Middle Name (Optional)</Text>
                            <View style={styles.inputRow}>
                                <TextInput style={styles.input} placeholder="Old Middle Name" placeholderTextColor="#94a3b8" value={oldMiddleName} onChangeText={setOldMiddleName} />
                            </View>

                            {/* Modification Data */}
                            <Text style={[styles.sectionHeader, { marginTop: 22 }]}>MODIFICATION DATA</Text>
                            
                            {/* Name Fields */}
                            {isNameRequired && (
                                <>
                                    <View style={styles.grid2}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>New First Name</Text>
                                            <View style={styles.inputRow}>
                                                <TextInput style={styles.input} placeholder="New First Name" placeholderTextColor="#94a3b8" value={newFirstName} onChangeText={setNewFirstName} />
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>New Surname</Text>
                                            <View style={styles.inputRow}>
                                                <TextInput style={styles.input} placeholder="New Surname" placeholderTextColor="#94a3b8" value={newSurname} onChangeText={setNewSurname} />
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>New Middle Name (Optional)</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput style={styles.input} placeholder="New Middle Name" placeholderTextColor="#94a3b8" value={newMiddleName} onChangeText={setNewMiddleName} />
                                    </View>
                                </>
                            )}

                            {/* DOB Fields */}
                            {isDobRequired && (
                                <View style={[styles.grid2, isNameRequired && { marginTop: 12 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Old Date of Birth</Text>
                                        <View style={styles.inputRow}>
                                            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={oldDob} onChangeText={setOldDob} />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>New Date of Birth</Text>
                                        <View style={styles.inputRow}>
                                            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={newDob} onChangeText={setNewDob} />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Phone Fields */}
                            {isPhoneRequired && (
                                <View style={[styles.grid2, (isNameRequired || isDobRequired) && { marginTop: 12 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Old Phone Number</Text>
                                        <View style={styles.inputRow}>
                                            <TextInput style={styles.input} placeholder="Old Phone (Optional)" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={oldPhone} onChangeText={setOldPhone} />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>New Phone Number</Text>
                                        <View style={styles.inputRow}>
                                            <TextInput style={styles.input} placeholder="New Phone Number" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={newPhone} onChangeText={setNewPhone} />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Fee row */}
                            <View style={styles.costRow}>
                                <Text style={styles.costLabel}>Total Modification Fee:</Text>
                                <Text style={styles.costVal}>₦{(MODIFICATION_TYPES.find(t => t.code === serviceCode)?.fee || 5900).toLocaleString()}.00</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.btn, loading && { opacity: 0.7 }]}
                                onPress={handleSubmitModification}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                        <Text style={styles.btnText}>Submit Modification</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Reminders Card */}
                        <View style={styles.remindersCard}>
                            <View style={styles.remindersHeader}>
                                <Ionicons name="information-circle" size={18} color="#e11d48" />
                                <Text style={styles.remindersHeaderText}>Important Reminders</Text>
                            </View>
                            <Text style={styles.reminderItem}>• If your request fails due to invalid submission or rule violation, YOUR APPLICATION WILL BE FAILED.</Text>
                            <Text style={styles.reminderItem}>• A ₦4,000 provider surcharge is automatically applied if correcting an age difference greater than 5 years.</Text>
                            <Text style={styles.reminderItem}>• Modifications are processed manually by NIBSS admin teams within 24-48 business hours.</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Status Tracker */}
                        <View style={styles.formCard}>
                            <Text style={styles.inputLabel}>REQUEST ID OR REFERENCE</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. cmkz3qr3e000445y04dcrpsgm or REF-MOD-..."
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
                                <Text style={styles.statusMessage}>{statusResult.message || statusResult.data?.message || 'Your modification request is being processed by NIBSS.'}</Text>
                                
                                {statusResult.data?.slip_url && (
                                    <TouchableOpacity 
                                        style={styles.slipButton}
                                        onPress={() => Linking.openURL(statusResult.data.slip_url)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="document-text-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                        <Text style={styles.slipButtonText}>Download Modification Slip</Text>
                                    </TouchableOpacity>
                                )}

                                {statusResult.last_updated && (
                                    <Text style={styles.statusDate}>Last updated: {new Date(statusResult.last_updated).toLocaleString()}</Text>
                                )}
                            </View>
                        )}
                    </>
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
                        <View style={styles.modalIconBox}>
                            <Ionicons name="warning-outline" size={28} color="#e11d48" />
                        </View>
                        <Text style={styles.modalTitle}>Modification Terms</Text>
                        <Text style={styles.modalSub}>Strict rules apply. Read carefully.</Text>

                        <ScrollView style={{ maxHeight: 300, width: '100%', marginVertical: 12 }}>
                            <Text style={styles.ruleBullet}><Text style={{ fontWeight: 'bold' }}>1. Valid Banks Only:</Text> Make sure it is an Agency Enrollment or one of our listed authorized banks.</Text>
                            <Text style={styles.ruleBullet}><Text style={{ fontWeight: 'bold' }}>2. Reflect on VNIN:</Text> If you did a NIN modification first, ensure it is fully reflecting on your VNIN slip. NIBSS does not process double modifications.</Text>
                            <Text style={styles.ruleBullet}><Text style={{ fontWeight: 'bold' }}>3. One-Time Rule:</Text> You can only modify your BVN details once.</Text>

                            <View style={styles.noRefundBox}>
                                <Text style={styles.noRefundTitle}>NO REFUND IF:</Text>
                                <Text style={styles.noRefundItem}>• It's a bank enrollment not on our listed banks.</Text>
                                <Text style={styles.noRefundItem}>• You submit your Old NIN details.</Text>
                                <Text style={styles.noRefundItem}>• You have previously done similar modifications.</Text>
                                <Text style={styles.noRefundItem}>• It is a Complete Change of Name.</Text>
                            </View>

                            <View style={styles.rejectionBox}>
                                <Text style={styles.rejectionTitle}>REJECTION IF:</Text>
                                <Text style={styles.rejectionItem}>You submit invalid details or submit duplicate requests as one.</Text>
                            </View>
                        </ScrollView>

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
    termsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#f43f5e' },
    termsBadgeText: { color: '#fda4af', fontSize: 11, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 14 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 3 },
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 9 },
    tabButtonActive: { backgroundColor: '#ffffff' },
    tabButtonText: { fontSize: 12, fontWeight: '700', color: '#cbd5e1' },
    tabButtonTextActive: { color: '#0f172a' },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    sectionHeader: { fontSize: 12, fontWeight: '900', color: '#e11d48', marginBottom: 12, letterSpacing: 0.5 },
    dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 46, backgroundColor: '#f8fafc' },
    dropdownButtonText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    bankPickerList: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#ffffff', marginTop: 6, overflow: 'hidden' },
    bankPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    bankPickerItemActive: { backgroundColor: '#fff1f2' },
    bankPickerText: { fontSize: 12, fontWeight: '600', color: '#334155' },
    bankPickerTextActive: { color: '#e11d48', fontWeight: '800' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    typeCard: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', alignItems: 'center', minWidth: '47%', flex: 1 },
    typeCardActive: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
    typeText: { fontSize: 11, fontWeight: '700', color: '#475569', textAlign: 'center' },
    typeTextActive: { color: '#e11d48', fontWeight: '800' },
    grid2: { flexDirection: 'row', gap: 10 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6 },
    inputRow: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 46, justifyContent: 'center' },
    input: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 16, fontWeight: '900', color: '#e11d48' },
    btn: { backgroundColor: '#e11d48', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    remindersCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#ffe4e6' },
    remindersHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    remindersHeaderText: { fontSize: 13, fontWeight: '800', color: '#e11d48', marginLeft: 6 },
    reminderItem: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 4 },
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
    slipButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0284c7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 10 },
    slipButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
    modalIconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    modalSub: { fontSize: 12, color: '#64748b', marginBottom: 4 },
    ruleBullet: { fontSize: 12, color: '#334155', lineHeight: 18, marginBottom: 8 },
    noRefundBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 8, padding: 10, marginVertical: 8 },
    noRefundTitle: { fontSize: 11, fontWeight: '900', color: '#b91c1c', marginBottom: 4 },
    noRefundItem: { fontSize: 11, color: '#991b1b', lineHeight: 16 },
    rejectionBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fef3c7', borderRadius: 8, padding: 10, marginBottom: 8 },
    rejectionTitle: { fontSize: 11, fontWeight: '900', color: '#b45309', marginBottom: 4 },
    rejectionItem: { fontSize: 11, color: '#92400e', lineHeight: 16 },
    modalBtn: { backgroundColor: '#e11d48', width: '100%', height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    modalBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
