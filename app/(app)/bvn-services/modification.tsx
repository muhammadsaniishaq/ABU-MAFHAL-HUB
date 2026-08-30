import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    StyleSheet,
    Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory } from '../../../services/verificationHistory';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

const { width } = Dimensions.get('window');

// Clean Bank Directory (Internal codes preserved for AgentHub API, hidden from UI)
const NIGERIAN_BANKS = [
    { code: '706', name: 'First Bank of Nigeria', icon: 'business-outline', isPremium: true },
    { code: '709', name: 'Guaranty Trust Bank (GTBank)', icon: 'business-outline', isPremium: true },
    { code: '710', name: 'Access Bank', icon: 'business-outline', isPremium: false },
    { code: '711', name: 'Zenith Bank', icon: 'business-outline', isPremium: false },
    { code: '712', name: 'United Bank for Africa (UBA)', icon: 'business-outline', isPremium: false },
    { code: '708', name: 'First City Monument Bank (FCMB)', icon: 'business-outline', isPremium: false },
    { code: '713', name: 'Stanbic IBTC Bank', icon: 'business-outline', isPremium: false },
    { code: '714', name: 'Fidelity Bank', icon: 'business-outline', isPremium: false },
    { code: '715', name: 'Union Bank of Nigeria', icon: 'business-outline', isPremium: false },
    { code: '716', name: 'Sterling Bank', icon: 'business-outline', isPremium: false },
    { code: '717', name: 'Wema Bank / ALAT', icon: 'business-outline', isPremium: false },
    { code: '707', name: 'Keystone Bank', icon: 'business-outline', isPremium: false },
    { code: '702', name: 'Heritage Bank', icon: 'business-outline', isPremium: false },
    { code: '718', name: 'Polaris Bank', icon: 'business-outline', isPremium: false },
    { code: '719', name: 'Jaiz Bank (Islamic)', icon: 'business-outline', isPremium: false },
    { code: '720', name: 'Taj Bank', icon: 'business-outline', isPremium: false },
    { code: '721', name: 'Lotus Bank', icon: 'business-outline', isPremium: false },
    { code: '722', name: 'Kuda Microfinance Bank', icon: 'phone-portrait-outline', isPremium: false },
    { code: '723', name: 'OPay Digital Services', icon: 'phone-portrait-outline', isPremium: false },
    { code: '724', name: 'PalmPay Limited', icon: 'phone-portrait-outline', isPremium: false },
    { code: '725', name: 'Moniepoint MFB', icon: 'phone-portrait-outline', isPremium: false },
    { code: '701', name: 'Agency Banking / MFB Agent', icon: 'people-outline', isPremium: false },
    { code: '703', name: 'Bank of Agriculture (BOA)', icon: 'leaf-outline', isPremium: false },
    { code: '704', name: 'NIBSS MFB Portal', icon: 'shield-outline', isPremium: false },
    { code: '705', name: 'Enterprise Bank', icon: 'business-outline', isPremium: false },
];

const MODIFICATION_TYPES = [
    { code: '620', label: 'Change of Name', priceId: 'bvn_mod_name', icon: 'person-outline', desc: 'First, Middle, or Surname update' },
    { code: '621', label: 'Change of Date of Birth', priceId: 'bvn_mod_dob', icon: 'calendar-outline', desc: 'DOB correction on BVN' },
    { code: '622', label: 'Change of Phone Number', priceId: 'bvn_mod_phone', icon: 'call-outline', desc: 'Registered telephone change' },
    { code: '623', label: 'Name & Phone', priceId: 'bvn_mod_name_phone', icon: 'person-add-outline', desc: 'Combined Name & Phone update' },
    { code: '624', label: 'DOB & Phone', priceId: 'bvn_mod_dob_phone', icon: 'today-outline', desc: 'Combined DOB & Phone update' },
    { code: '626', label: 'Name & DOB', priceId: 'bvn_mod_name_dob', icon: 'create-outline', desc: 'Combined Name & DOB correction' },
    { code: '625', label: 'Full Modification', priceId: 'bvn_mod_name_dob', icon: 'layers-outline', desc: 'Comprehensive record overhaul' },
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
    const [bankCode, setBankCode] = useState('706'); // First Bank default
    const [serviceCode, setServiceCode] = useState('620'); // Name Change default
    const [showBankModal, setShowBankModal] = useState(false);
    const [bankSearch, setBankSearch] = useState('');

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

    const selectedBank = useMemo(() => {
        return NIGERIAN_BANKS.find(b => b.code === bankCode) || NIGERIAN_BANKS[0];
    }, [bankCode]);

    const filteredBanks = useMemo(() => {
        if (!bankSearch.trim()) return NIGERIAN_BANKS;
        return NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
    }, [bankSearch]);

    const currentPriceDisplay = priceMap[serviceCode] || servicePrice;

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

        const requiredFee = currentPriceDisplay;
        if (userBalance !== null && userBalance < requiredFee) {
            showAlert("Insufficient Balance", `Your wallet balance is ₦${userBalance.toLocaleString()}. Required fee is ₦${requiredFee.toLocaleString()}. Please top up your wallet.`);
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

                showAlert("Submitted Successfully", `BVN Modification request submitted. (Fee: ₦${requiredFee.toLocaleString()})`, "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'bvn_modification',
                    search_number: cleanBvn,
                    holder_name: `${newFirstName || oldFirstName} ${newSurname || oldSurname}`.trim(),
                    details: {
                        ...payload,
                        ...data,
                        bank_name: selectedBank.name,
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

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Header Hero */}
            <LinearGradient
                colors={['#070D1E', '#0A1128', '#0F172A']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 16 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleWrap}>
                        <Text style={styles.titleText}>BVN Modification</Text>
                        <Text style={styles.subText}>Official Government Identity Correction</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowTermsModal(true)}
                        style={styles.noticeBadge}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="shield-checkmark" size={13} color="#D4AF37" style={{ marginRight: 3 }} />
                        <Text style={styles.noticeBadgeText}>Rules</Text>
                    </TouchableOpacity>
                </View>

                {/* Sub Navigation Segment */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'submit' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('submit')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="create-outline" size={14} color={activeTab === 'submit' ? '#070D1E' : '#94A3B8'} style={{ marginRight: 4 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'submit' && styles.tabButtonTextActive]}>Submit Correction</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'status' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('status')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="time-outline" size={14} color={activeTab === 'status' ? '#070D1E' : '#94A3B8'} style={{ marginRight: 4 }} />
                        <Text style={[styles.tabButtonText, activeTab === 'status' && styles.tabButtonTextActive]}>Track Status</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {activeTab === 'submit' ? (
                    <View>
                        {/* STEP 1: SELECT ENROLLING BANK */}
                        <View style={styles.sectionCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.stepNumberBadge}>
                                    <Text style={styles.stepNumberText}>1</Text>
                                </View>
                                <Text style={styles.sectionCardTitle}>ENROLLING BANK</Text>
                            </View>

                            <TouchableOpacity 
                                style={styles.bankSelectButton}
                                onPress={() => setShowBankModal(true)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.bankIconCircle}>
                                    <Ionicons name={selectedBank.icon as any} size={18} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.bankSelectedName}>{selectedBank.name}</Text>
                                    <Text style={styles.bankSelectedSub}>Tap to change enrolling institution</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {/* STEP 2: SELECT MODIFICATION TYPE */}
                        <View style={styles.sectionCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.stepNumberBadge}>
                                    <Text style={styles.stepNumberText}>2</Text>
                                </View>
                                <Text style={styles.sectionCardTitle}>MODIFICATION TYPE</Text>
                            </View>

                            <View style={styles.modTypeGrid}>
                                {MODIFICATION_TYPES.map((type) => {
                                    const isSelected = serviceCode === type.code;
                                    const itemFee = priceMap[type.code] || DEFAULT_PRICES[type.code] || 6000;
                                    return (
                                        <TouchableOpacity
                                            key={type.code}
                                            style={[styles.modTypeCard, isSelected && styles.modTypeCardActive]}
                                            onPress={() => handleSelectModificationType(type.code)}
                                            activeOpacity={0.85}
                                        >
                                            <View style={styles.modTypeTop}>
                                                <Ionicons name={type.icon as any} size={17} color={isSelected ? '#B45309' : '#070D1E'} />
                                                <View style={[styles.feePill, isSelected && styles.feePillActive]}>
                                                    <Text style={[styles.feePillText, isSelected && styles.feePillTextActive]}>
                                                        ₦{itemFee.toLocaleString()}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.modTypeTitle, isSelected && styles.modTypeTitleActive]}>
                                                {type.label}
                                            </Text>
                                            <Text style={styles.modTypeDesc} numberOfLines={1}>{type.desc}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* STEP 3: CURRENT BVN IDENTIFIERS */}
                        <View style={styles.sectionCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.stepNumberBadge}>
                                    <Text style={styles.stepNumberText}>3</Text>
                                </View>
                                <Text style={styles.sectionCardTitle}>CURRENT BVN INFORMATION</Text>
                            </View>

                            <View style={styles.grid2}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>NIN (11 Digits)</Text>
                                    <TextInput style={styles.input} placeholder="National NIN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={nin} onChangeText={setNin} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>BVN (11 Digits)</Text>
                                    <TextInput style={styles.input} placeholder="Current BVN" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={bvn} onChangeText={setBvn} />
                                </View>
                            </View>

                            <View style={[styles.grid2, { marginTop: 10 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Old First Name</Text>
                                    <TextInput style={styles.input} placeholder="Current First Name" placeholderTextColor="#94a3b8" value={oldFirstName} onChangeText={setOldFirstName} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Old Surname</Text>
                                    <TextInput style={styles.input} placeholder="Current Surname" placeholderTextColor="#94a3b8" value={oldSurname} onChangeText={setOldSurname} />
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Old Middle Name (Optional)</Text>
                            <TextInput style={styles.input} placeholder="Current Middle Name" placeholderTextColor="#94a3b8" value={oldMiddleName} onChangeText={setOldMiddleName} />
                        </View>

                        {/* STEP 4: NEW REQUESTED CHANGES */}
                        <View style={styles.sectionCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.stepNumberBadge}>
                                    <Text style={styles.stepNumberText}>4</Text>
                                </View>
                                <Text style={styles.sectionCardTitle}>NEW REQUESTED DETAILS</Text>
                            </View>

                            {isNameRequired && (
                                <>
                                    <View style={styles.grid2}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>New First Name</Text>
                                            <TextInput style={styles.input} placeholder="New First Name" placeholderTextColor="#94a3b8" value={newFirstName} onChangeText={setNewFirstName} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>New Surname</Text>
                                            <TextInput style={styles.input} placeholder="New Surname" placeholderTextColor="#94a3b8" value={newSurname} onChangeText={setNewSurname} />
                                        </View>
                                    </View>
                                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>New Middle Name (Optional)</Text>
                                    <TextInput style={styles.input} placeholder="New Middle Name" placeholderTextColor="#94a3b8" value={newMiddleName} onChangeText={setNewMiddleName} />
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
                        </View>

                        {/* Price & Balance Executive Card */}
                        <View style={styles.priceExecutiveCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.execPriceLabel}>TOTAL CHARGE</Text>
                                <Text style={styles.execPriceValue}>₦{currentPriceDisplay.toLocaleString()}</Text>
                            </View>
                            <View style={styles.execDivider} />
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={styles.execWalletLabel}>WALLET BALANCE</Text>
                                <Text style={[styles.execWalletValue, (userBalance !== null && userBalance < currentPriceDisplay) ? { color: '#EF4444' } : { color: '#34D399' }]}>
                                    ₦{userBalance !== null ? userBalance.toLocaleString() : '0.00'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitActionBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmitModification}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#070D1E" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-done-circle" size={19} color="#070D1E" />
                                    <Text style={styles.submitActionBtnText}>
                                        Submit Modification (₦{currentPriceDisplay.toLocaleString()})
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionCardTitle}>LIVE STATUS TRACKER</Text>
                        <Text style={styles.trackerSub}>Enter your Request ID or Reference number to verify status in real-time.</Text>
                        
                        <View style={styles.trackInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 8 }]}
                                placeholder="e.g. REF-MOD-171829302..."
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
                                    <ActivityIndicator size="small" color="#070D1E" />
                                ) : (
                                    <Text style={styles.trackBtnText}>Query</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {statusResult && (
                            <View style={styles.statusResultCard}>
                                <View style={styles.statusResultHeader}>
                                    <Ionicons name="shield-checkmark" size={16} color="#059669" />
                                    <Text style={styles.statusResultTitle}>Portal Feedback</Text>
                                </View>
                                <Text style={styles.statusResultVal}>
                                    Current Status: <Text style={{ color: '#059669', fontWeight: '900' }}>{statusResult.current_status || statusResult.status || 'PROCESSING'}</Text>
                                </Text>
                                {statusResult.message && (
                                    <Text style={styles.statusResultMsg}>{statusResult.message}</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ========================================================================= */}
            {/* MODAL: CLEAN BANK PICKER WITH SEARCH (NO CODES SHOWN)                     */}
            {/* ========================================================================= */}
            <Modal
                visible={showBankModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowBankModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Enrolling Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankModal(false)}>
                                <Ionicons name="close-circle" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={styles.modalSearchBox}>
                            <Ionicons name="search" size={16} color="#94A3B8" />
                            <TextInput
                                value={bankSearch}
                                onChangeText={setBankSearch}
                                placeholder="Search bank name (e.g. First Bank, GTBank)..."
                                placeholderTextColor="#94A3B8"
                                style={styles.modalSearchInput}
                            />
                        </View>

                        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                            {filteredBanks.map((bank) => {
                                const isSelected = bankCode === bank.code;
                                return (
                                    <TouchableOpacity
                                        key={bank.code}
                                        style={[styles.bankModalItem, isSelected && styles.bankModalItemActive]}
                                        onPress={() => {
                                            setBankCode(bank.code);
                                            setShowBankModal(false);
                                            setBankSearch('');
                                        }}
                                    >
                                        <View style={[styles.bankModalIconWrap, isSelected && styles.bankModalIconWrapActive]}>
                                            <Ionicons name={bank.icon as any} size={16} color={isSelected ? '#B45309' : '#070D1E'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.bankModalText, isSelected && styles.bankModalTextActive]}>
                                                {bank.name}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Terms Modal */}
            <Modal
                visible={showTermsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTermsModal(false)}
            >
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.modalCardCenter}>
                        <Ionicons name="shield-checkmark" size={26} color="#D4AF37" style={{ marginBottom: 6 }} />
                        <Text style={styles.termsModalTitle}>Official Modification Rules</Text>
                        <Text style={styles.termsModalBody}>
                            1. Ensure all requested modifications strictly match official legal supporting documents (NIN, Court Affidavit, or Newspaper Publication).{'\n\n'}
                            2. Submissions are processed directly through authorized government verification pipelines.
                        </Text>
                        <TouchableOpacity
                            style={styles.termsModalBtn}
                            onPress={() => setShowTermsModal(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.termsModalBtnText}>I Understand</Text>
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerGradient: { paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    headerTitleWrap: { alignItems: 'center' },
    backButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    noticeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    noticeBadgeText: { color: '#D4AF37', fontSize: 10.5, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 10.5, marginTop: 1 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginTop: 4 },
    tabButton: { flex: 1, flexDirection: 'row', paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    tabButtonActive: { backgroundColor: '#D4AF37' },
    tabButtonText: { color: '#94a3b8', fontSize: 11.5, fontWeight: '700' },
    tabButtonTextActive: { color: '#070D1E', fontWeight: '900' },
    content: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
    sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    stepNumberBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#070D1E', alignItems: 'center', justifyContent: 'center' },
    stepNumberText: { color: '#D4AF37', fontSize: 9.5, fontWeight: '900' },
    sectionCardTitle: { fontSize: 11, fontWeight: '900', color: '#070D1E', letterSpacing: 0.5 },
    bankSelectButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, gap: 10 },
    bankIconCircle: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#070D1E', alignItems: 'center', justifyContent: 'center' },
    bankSelectedName: { fontSize: 13, fontWeight: '800', color: '#070D1E' },
    bankSelectedSub: { fontSize: 10, color: '#64748B', marginTop: 1 },
    modTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    modTypeCard: { width: '48.8%', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
    modTypeCardActive: { backgroundColor: '#FEF9E7', borderColor: '#D4AF37' },
    modTypeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    feePill: { backgroundColor: '#ECFDF5', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 },
    feePillActive: { backgroundColor: '#FEF3C7' },
    feePillText: { fontSize: 9.5, fontWeight: '900', color: '#059669' },
    feePillTextActive: { color: '#B45309' },
    modTypeTitle: { fontSize: 11, fontWeight: '800', color: '#070D1E', marginBottom: 1 },
    modTypeTitleActive: { color: '#B45309' },
    modTypeDesc: { fontSize: 9, color: '#64748B' },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#070D1E', marginBottom: 3, textTransform: 'uppercase' },
    grid2: { flexDirection: 'row', gap: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: '#070D1E' },
    priceExecutiveCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#070D1E', borderRadius: 12, padding: 12, marginVertical: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    execPriceLabel: { fontSize: 8.5, fontWeight: '900', color: '#D4AF37', letterSpacing: 0.5 },
    execPriceValue: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', marginTop: 1 },
    execDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },
    execWalletLabel: { fontSize: 8.5, fontWeight: '700', color: '#94A3B8' },
    execWalletValue: { fontSize: 13, fontWeight: '900', marginTop: 1 },
    submitActionBtn: { backgroundColor: '#D4AF37', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, gap: 6 },
    submitActionBtnText: { color: '#070D1E', fontSize: 13, fontWeight: '900' },
    trackerSub: { fontSize: 10.5, color: '#64748B', marginBottom: 10 },
    trackInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    trackBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    trackBtnText: { color: '#070D1E', fontSize: 12, fontWeight: '800' },
    statusResultCard: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#CBD5E1', marginTop: 6 },
    statusResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    statusResultTitle: { fontSize: 12, fontWeight: '800', color: '#070D1E' },
    statusResultVal: { fontSize: 11, color: '#0F172A', fontWeight: '700' },
    statusResultMsg: { fontSize: 10.5, color: '#475569', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(7, 13, 30, 0.65)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 14.5, fontWeight: '900', color: '#070D1E' },
    modalSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 6, marginBottom: 8 },
    modalSearchInput: { flex: 1, fontSize: 11.5, color: '#070D1E' },
    bankModalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, gap: 8, marginBottom: 3 },
    bankModalItemActive: { backgroundColor: '#FEF9E7' },
    bankModalIconWrap: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    bankModalIconWrapActive: { backgroundColor: '#FEF3C7' },
    bankModalText: { fontSize: 12, fontWeight: '700', color: '#070D1E' },
    bankModalTextActive: { color: '#B45309', fontWeight: '900' },
    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCardCenter: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, width: '100%', maxWidth: 360, alignItems: 'center' },
    termsModalTitle: { fontSize: 14, fontWeight: '800', color: '#070D1E', marginBottom: 6 },
    termsModalBody: { fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 16, marginBottom: 14 },
    termsModalBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    termsModalBtnText: { color: '#070D1E', fontSize: 12, fontWeight: '800' },
});
