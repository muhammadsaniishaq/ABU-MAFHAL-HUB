import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory } from '../../../services/verificationHistory';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

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
    { code: '620', label: 'Change of Name', priceId: 'bvn_mod_name' },
    { code: '621', label: 'Change of Date of Birth', priceId: 'bvn_mod_dob' },
    { code: '622', label: 'Change of Phone Number', priceId: 'bvn_mod_phone' },
    { code: '623', label: 'Name & Phone', priceId: 'bvn_mod_name_phone' },
    { code: '624', label: 'DOB & Phone', priceId: 'bvn_mod_dob_phone' },
    { code: '626', label: 'Name & DOB', priceId: 'bvn_mod_name_dob' },
    { code: '625', label: 'Full Modification', priceId: 'bvn_mod_name_dob' },
];

const DEFAULT_PRICES: Record<string, number> = {
    '620': 6000,
    '621': 6000,
    '622': 6000,
    '623': 8500,
    '624': 8500,
    '626': 8500,
    '625': 9000,
};

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
    const [priceMap, setPriceMap] = useState<Record<string, number>>(DEFAULT_PRICES);
    const [servicePrice, setServicePrice] = useState<number>(DEFAULT_PRICES['620']);
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

    const fetchAllServicePrices = async () => {
        try {
            const { data } = await supabase
                .from('service_pricing')
                .select('id, cost_price, markup_price, selling_price')
                .eq('service_category', 'bvn');

            if (data && data.length > 0) {
                const newMap: Record<string, number> = { ...DEFAULT_PRICES };
                
                MODIFICATION_TYPES.forEach(item => {
                    const found = data.find(d => d.id === item.priceId);
                    if (found) {
                        const total = found.selling_price
                            ? Number(found.selling_price)
                            : (Number(found.cost_price || 0) + Number(found.markup_price || 0));
                        if (total > 0) {
                            newMap[item.code] = total;
                        }
                    }
                });

                setPriceMap(newMap);
                setServicePrice(newMap[serviceCode] || DEFAULT_PRICES[serviceCode] || 6000);
            }
        } catch (e) {
            console.warn('Failed to load BVN modification prices', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
        fetchAllServicePrices();
    }, []);

    // Whenever serviceCode changes, update servicePrice immediately
    const handleSelectModificationType = (code: string) => {
        setServiceCode(code);
        setServicePrice(priceMap[code] || DEFAULT_PRICES[code] || 6000);
    };

    const showAlert = (title: string, message: string, type: AlertType = 'error') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
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

        const requiredFee = priceMap[serviceCode] || servicePrice;
        if (userBalance !== null && userBalance < requiredFee) {
            showAlert("Insufficient Balance", `Your balance is ₦${userBalance.toLocaleString()}. Required fee is ₦${requiredFee.toLocaleString()}. Please fund your wallet to proceed.`);
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

            const codeToPriceIdMap: Record<string, string> = {
                '620': 'bvn_mod_name',
                '621': 'bvn_mod_dob',
                '622': 'bvn_mod_phone',
                '623': 'bvn_mod_name_phone',
                '624': 'bvn_mod_dob_phone',
                '626': 'bvn_mod_name_dob',
                '625': 'bvn_mod_name_dob',
            };
            const currentPriceId = codeToPriceIdMap[serviceCode] || 'bvn_modification';

            const res = await api.identity.requestBVNModification(payload, currentPriceId);

            if (res && (res.isValid || res.data)) {
                const data = res.data?.data || res.data || {};
                const requestId = data.request_id || data.requestId || ref;

                showAlert("Submitted", `BVN Modification request submitted successfully (Fee: ₦${requiredFee.toLocaleString()}).`, "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'bvn_modification',
                    search_number: cleanBvn,
                    holder_name: `${newFirstName || oldFirstName} ${newSurname || oldSurname}`.trim(),
                    details: {
                        ...payload,
                        ...data,
                        request_id: requestId,
                        status: data.status || 'PROCESSING',
                        fee: requiredFee,
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
    const currentPriceDisplay = priceMap[serviceCode] || servicePrice;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Header */}
            <LinearGradient
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 16 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowTermsModal(true)}
                        style={styles.noticeBadge}
                        activeOpacity={0.7}
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

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
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

                        {/* Modification Type Selector with Live Prices */}
                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>MODIFICATION TYPE & PRICING</Text>
                        <View style={styles.typeGrid}>
                            {MODIFICATION_TYPES.map((type) => {
                                const isSelected = serviceCode === type.code;
                                const itemFee = priceMap[type.code] || DEFAULT_PRICES[type.code] || 6000;
                                return (
                                    <TouchableOpacity
                                        key={type.code}
                                        style={[styles.typeCard, isSelected && styles.typeCardActive]}
                                        onPress={() => handleSelectModificationType(type.code)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>
                                                {type.label}
                                            </Text>
                                            <Text style={[styles.typePriceTag, isSelected && styles.typePriceTagActive]}>
                                                ₦{itemFee.toLocaleString()}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={16} color="#D4AF37" />
                                        )}
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

                        {/* Price Summary Banner */}
                        <View style={styles.priceSummaryCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.priceSummaryLabel}>TOTAL MODIFICATION FEE</Text>
                                <Text style={styles.priceSummaryAmount}>₦{currentPriceDisplay.toLocaleString()}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.walletBalanceLabel}>Wallet Balance</Text>
                                <Text style={[styles.walletBalanceAmount, (userBalance !== null && userBalance < currentPriceDisplay) ? { color: '#EF4444' } : { color: '#10B981' }]}>
                                    ₦{userBalance !== null ? userBalance.toLocaleString() : '0.00'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitModification}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#0B192C" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Modification (₦{currentPriceDisplay.toLocaleString()})</Text>
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
    tabButton: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
    tabButtonActive: { backgroundColor: '#D4AF37' },
    tabButtonText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
    tabButtonTextActive: { color: '#0B192C', fontWeight: '900' },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    inputLabel: { fontSize: 10.5, fontWeight: '800', color: '#0B192C', marginBottom: 4, textTransform: 'uppercase' },
    sectionHeader: { fontSize: 11, fontWeight: '900', color: '#0B192C', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 4 },
    dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    dropdownButtonText: { fontSize: 12, fontWeight: '700', color: '#0B192C' },
    bankPickerList: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', marginTop: 4, padding: 4 },
    bankPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
    bankPickerItemActive: { backgroundColor: '#FEF9E7' },
    bankPickerText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    bankPickerTextActive: { color: '#B45309', fontWeight: '800' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    typeCard: { width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    typeCardActive: { backgroundColor: '#FEF9E7', borderColor: '#D4AF37' },
    typeText: { fontSize: 10.5, fontWeight: '700', color: '#475569' },
    typeTextActive: { color: '#B45309', fontWeight: '900' },
    typePriceTag: { fontSize: 10, fontWeight: '800', color: '#059669', marginTop: 1 },
    typePriceTagActive: { color: '#B45309', fontWeight: '900' },
    grid2: { flexDirection: 'row', gap: 8 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: '#0B192C' },
    priceSummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0B192C', borderRadius: 10, padding: 12, marginTop: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    priceSummaryLabel: { fontSize: 8.5, fontWeight: '900', color: '#D4AF37', letterSpacing: 0.5 },
    priceSummaryAmount: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 1 },
    walletBalanceLabel: { fontSize: 8.5, fontWeight: '700', color: '#94a3b8' },
    walletBalanceAmount: { fontSize: 13, fontWeight: '900', marginTop: 1 },
    submitBtn: { backgroundColor: '#D4AF37', paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    submitBtnText: { color: '#0B192C', fontSize: 13, fontWeight: '900' },
    trackInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    trackBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    trackBtnText: { color: '#0B192C', fontSize: 12, fontWeight: '800' },
    statusResultCard: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#cbd5e1', marginTop: 6 },
    statusResultTitle: { fontSize: 12, fontWeight: '800', color: '#0B192C', marginBottom: 4 },
    statusResultVal: { fontSize: 11, color: '#10B981', fontWeight: '700' },
    statusResultMsg: { fontSize: 10.5, color: '#475569', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, width: '100%', maxWidth: 360, alignItems: 'center' },
    modalTitle: { fontSize: 14, fontWeight: '800', color: '#0B192C', marginBottom: 6 },
    modalBody: { fontSize: 11.5, color: '#475569', textAlign: 'center', lineHeight: 16, marginBottom: 14 },
    modalBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    modalBtnText: { color: '#0B192C', fontSize: 12, fontWeight: '800' },
});
