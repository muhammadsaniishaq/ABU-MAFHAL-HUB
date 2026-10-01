import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, FlatList, Switch, StyleSheet, LayoutAnimation, Linking } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { createAppNotification } from '../../services/notificationsHelper';
import SecurityModal from '../../components/SecurityModal';
import TransactionConfirmationModal from '../../components/TransactionConfirmationModal';
import DynamicBanners from '../../components/DynamicBanners';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { validateNigerianPhone } from '../../utils/securityUtils';

// Network Assets & Data
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    glo: require('../../assets/images/glo.png'),
    airtel: require('../../assets/images/airtel.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
    vitel: require('../../assets/images/vitel.png'),
};

interface NetworkItem {
    id: string;
    name: string;
    code: string;
    color: string;
    defaultDiscount: number; // e.g. 0.01 for 1%
    prefixes: string[];
    ussdBalance: string;
    ussdData: string;
    ussdBorrow: string;
}

const NETWORKS_DATA: NetworkItem[] = [
    { 
        id: 'mtn', 
        name: 'MTN', 
        code: '01', 
        color: '#FFCC00', 
        defaultDiscount: 0, // Face value by default (guarantees zero margin loss)
        prefixes: ['0803', '0806', '0703', '0903', '0810', '0813', '0814', '0816', '0906', '0706', '0913', '0916'],
        ussdBalance: '*310#',
        ussdData: '*323#',
        ussdBorrow: '*303#'
    },
    { 
        id: 'glo', 
        name: 'Glo', 
        code: '02', 
        color: '#0F6A37', 
        defaultDiscount: 0, // Face value by default (guarantees zero margin loss)
        prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'],
        ussdBalance: '*310#',
        ussdData: '*323#',
        ussdBorrow: '*303#'
    },
    { 
        id: 'airtel', 
        name: 'Airtel', 
        code: '04', 
        color: '#FF0000', 
        defaultDiscount: 0, // Face value by default (guarantees zero margin loss)
        prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912'],
        ussdBalance: '*310#',
        ussdData: '*323#',
        ussdBorrow: '*303#'
    },
    { 
        id: '9mobile', 
        name: '9mobile', 
        code: '03', 
        color: '#006B3E', 
        defaultDiscount: 0, // Face value by default (guarantees zero margin loss)
        prefixes: ['0809', '0818', '0817', '0909', '0908'],
        ussdBalance: '*310#',
        ussdData: '*323#',
        ussdBorrow: '*303#'
    },
    { 
        id: 'vitel', 
        name: 'VITEL', 
        code: '05', 
        color: '#6366F1', 
        defaultDiscount: 0,
        prefixes: ['070', '091'],
        ussdBalance: '*310#',
        ussdData: '*323#',
        ussdBorrow: '*303#'
    },
];

const PRESETS = [100, 200, 500, 1000, 2000, 5000];

const formatCurrency = (val: number | string | null | undefined): string => {
    const num = Number(val || 0);
    if (isNaN(num)) return '0.00';
    try {
        return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
        return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
};

const cleanNigerianPhone = (raw: string): string => {
    let p = (raw || '').replace(/\D/g, '');
    if (p.startsWith('2340') && p.length === 14) {
        p = '0' + p.slice(4);
    } else if (p.startsWith('234') && p.length === 13) {
        p = '0' + p.slice(3);
    } else if (p.length === 10 && !p.startsWith('0')) {
        p = '0' + p;
    }
    if (p.length > 11 && p.startsWith('0')) {
        p = p.slice(0, 11);
    }
    return p;
};

const safeLayoutAnimation = () => {
    try {
        if (Platform.OS !== 'web' && LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
    } catch {}
};

function AirtimeScreenContent() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [network, setNetwork] = useState('mtn');
    const [amount, setAmount] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [userPhone, setUserPhone] = useState<string | null>(null);
    const [recents, setRecents] = useState<any[]>([]);
    
    // Dynamic Pricing / Profit-Safe Discounts
    const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});
    
    // Beneficiary & Device Contacts states
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactModalTab, setContactModalTab] = useState<'phonebook' | 'beneficiaries'>('phonebook');
    const [deviceContacts, setDeviceContacts] = useState<any[]>([]);
    const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactsPermissionGranted, setContactsPermissionGranted] = useState<boolean | null>(null);
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);

    // Auto-Renewal states
    const [autoRenewalEnabled, setAutoRenewalEnabled] = useState(false);
    const [renewalFrequency, setRenewalFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    
    // Quick USSD Guide Modal
    const [showUssdModal, setShowUssdModal] = useState(false);

    // Modals
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    // Focus states
    const [phoneFocused, setPhoneFocused] = useState(false);
    const [amountFocused, setAmountFocused] = useState(false);

    useEffect(() => {
        fetchData();
        fetchDynamicRates();
    }, []);

    const fetchData = async () => {
        try {
            const { data, error: userError } = await supabase.auth.getUser();
            const user = data?.user;
            if (userError || !user) return;

            await Promise.allSettled([
                supabase.from('beneficiaries').select('*').eq('user_id', user.id).then(({ data: bens }) => {
                    if (bens && Array.isArray(bens)) setBeneficiaries(bens);
                }),
                supabase.from('profiles').select('balance, phone').eq('id', user.id).maybeSingle().then(({ data: profile }) => {
                    if (profile) {
                        if (profile.balance !== undefined && profile.balance !== null) {
                            setBalance(Number(profile.balance));
                        }
                        if (profile.phone && typeof profile.phone === 'string' && profile.phone.trim().length > 0) {
                            setUserPhone(profile.phone.trim());
                        }
                    }
                }),
                supabase.from('transactions').select('*').eq('user_id', user.id).eq('type', 'airtime').eq('status', 'success').order('created_at', { ascending: false }).limit(15).then(({ data: txns }) => {
                    if (txns && Array.isArray(txns)) {
                        const uniqueRecents: any[] = [];
                        const seenPhones = new Set();
                        txns.forEach((t: any) => {
                            if (!t?.description) return;
                            const match = t.description.match(/:\s*(\w+)\s+([\d+]+)/);
                            if (match) {
                                const net = String(match[1] || 'mtn').toLowerCase();
                                const pho = String(match[2] || '');
                                if (pho && !seenPhones.has(pho)) {
                                    seenPhones.add(pho);
                                    uniqueRecents.push({ id: t.id || `${net}-${pho}`, network: net, phone: pho });
                                }
                            }
                        });
                        setRecents(uniqueRecents.slice(0, 5));
                    }
                })
            ]);
        } catch (err) {
            console.warn('Airtime fetchData error:', err);
        }
    };

    // Fetch dynamic rates configured by Admin to protect profit
    const fetchDynamicRates = async () => {
        try {
            const { data: settings } = await supabase.from('app_settings').select('key, value');
            if (settings && Array.isArray(settings)) {
                const discounts: Record<string, number> = {};
                settings.forEach(s => {
                    if (s.key && s.key.startsWith('AIRTIME_DISCOUNT_')) {
                        const netKey = s.key.replace('AIRTIME_DISCOUNT_', '').toLowerCase();
                        const val = parseFloat(s.value);
                        if (!isNaN(val) && val >= 0 && val <= 5) {
                            discounts[netKey] = val / 100;
                        }
                    }
                });
                if (Object.keys(discounts).length > 0) {
                    setCustomDiscounts(discounts);
                }
            }
        } catch (e) {
            console.warn("Dynamic rate check note:", e);
        }
    };

    // Auto-detect Network by prefix
    const detectNetwork = useCallback((phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 4) {
            const prefix = cleanPhone.substring(0, 4);
            const found = NETWORKS_DATA.find(n => n.prefixes.includes(prefix));
            if (found && found.id !== network) {
                setNetwork(found.id);
            }
        }
    }, [network]);

    const handlePhoneChange = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        setPhoneNumber(cleaned);
        detectNetwork(cleaned);
    };

    const handleAmountChange = (text: string) => {
        const clean = text.replace(/[^0-9]/g, '');
        setAmount(clean);
    };

    const handleSelectPreset = (val: number) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
        setAmount(val.toString());
    };

    const handleSelectNetwork = (netId: string) => {
        try {
            Haptics.selectionAsync();
        } catch {}
        safeLayoutAnimation();
        setNetwork(netId);
    };

    // Load device contacts from phonebook
    const loadDeviceContacts = async (forceRequest = false) => {
        setLoadingDeviceContacts(true);
        try {
            let status = 'undetermined';
            if (forceRequest) {
                const req = await Contacts.requestPermissionsAsync();
                status = req.status;
            } else {
                const check = await Contacts.getPermissionsAsync();
                status = check.status;
                if (status !== 'granted') {
                    const req = await Contacts.requestPermissionsAsync();
                    status = req.status;
                }
            }

            setContactsPermissionGranted(status === 'granted');

            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                    pageSize: 600,
                });
                if (data && Array.isArray(data)) {
                    const validList: any[] = [];
                    const seenPhones = new Set<string>();
                    data.forEach(c => {
                        if (c.phoneNumbers && Array.isArray(c.phoneNumbers)) {
                            c.phoneNumbers.forEach((pn: any) => {
                                const cleaned = cleanNigerianPhone(pn.number || '');
                                if (cleaned && cleaned.length === 11 && !seenPhones.has(cleaned)) {
                                    seenPhones.add(cleaned);
                                    validList.push({
                                        id: `${c.id || Math.random()}-${cleaned}`,
                                        name: c.name || pn.label || 'Contact',
                                        phone: cleaned
                                    });
                                }
                            });
                        }
                    });
                    validList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    setDeviceContacts(validList);
                }
            }
        } catch (e) {
            console.warn("Device contacts loading note:", e);
        } finally {
            setLoadingDeviceContacts(false);
        }
    };

    // Open Contact Modal and immediately fetch contacts
    const handleOpenContactModal = () => {
        setShowContactModal(true);
        loadDeviceContacts(false);
    };

    // Direct Native Contact Picker Launch
    const handleLaunchNativeContactPicker = async () => {
        try {
            if (Platform.OS === 'web') {
                setShowContactModal(true);
                return;
            }

            const { status } = await Contacts.requestPermissionsAsync();
            setContactsPermissionGranted(status === 'granted');

            if (status !== 'granted') {
                Alert.alert(
                    "Contacts Permission Needed",
                    "Please allow contacts access in settings to select numbers directly from your address book.",
                    [
                        { text: "View In-App List", onPress: () => setShowContactModal(true) },
                        { text: "Cancel", style: "cancel" }
                    ]
                );
                return;
            }

            const contact = await Contacts.presentContactPickerAsync();
            if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                const rawPhone = contact.phoneNumbers[0].number || '';
                const cleaned = cleanNigerianPhone(rawPhone);
                if (cleaned) {
                    setPhoneNumber(cleaned);
                    detectNetwork(cleaned);
                    setShowContactModal(false);
                    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                }
            } else if (contact) {
                Alert.alert("No Phone Number", "The contact you selected does not have a valid mobile number.");
            }
        } catch (err: any) {
            console.warn("Native picker fallback:", err);
            setShowContactModal(true);
            loadDeviceContacts(true);
        }
    };

    // Active network object
    const activeNetworkObj = useMemo(() => {
        return NETWORKS_DATA.find(n => n.id === network) || NETWORKS_DATA[0];
    }, [network]);

    // Financial calculations (Profit-Preserving)
    const numAmount = Number(amount || 0);
    const discountRate = customDiscounts[network] !== undefined 
        ? customDiscounts[network] 
        : activeNetworkObj.defaultDiscount;
    const discountPercentage = Math.round(discountRate * 100);
    const discountSavings = Math.round(numAmount * discountRate);
    const netPayable = Math.max(0, numAmount - discountSavings);
    const isSufficientBalance = balance !== null && balance >= netPayable;
    const isPhoneComplete = phoneNumber.length === 11;
    const canSubmit = isPhoneComplete && numAmount >= 50 && numAmount <= 50000 && isSufficientBalance && !loading;

    const handleInitiatePurchase = () => {
        if (!network) {
            Alert.alert("Network Required", "Please choose a mobile network to continue.");
            return;
        }
        if (!numAmount || numAmount < 50) {
            Alert.alert("Invalid Amount", "Minimum airtime purchase is ₦50. Please enter an amount of ₦50 or higher.");
            return;
        }
        if (numAmount > 50000) {
            Alert.alert("Maximum Limit Exceeded", "Maximum airtime purchase per transaction is ₦50,000. Please enter ₦50,000 or less.");
            return;
        }
        if (phoneNumber.length !== 11) {
            Alert.alert("Incomplete Number", `Phone number has ${phoneNumber.length}/11 digits. Please enter a full 11-digit phone number.`);
            return;
        }

        const phoneValidation = validateNigerianPhone(phoneNumber);
        if (!phoneValidation.isValid) {
            Alert.alert("Invalid Phone Number", phoneValidation.error || "Please enter a valid 11-digit Nigerian mobile number.");
            return;
        }

        if (balance !== null && netPayable > balance) {
            Alert.alert(
                "Insufficient Wallet Balance",
                `Your current balance (₦${formatCurrency(balance)}) cannot cover this purchase of ₦${formatCurrency(netPayable)}. Please fund your wallet.`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Fund Wallet", onPress: () => router.push('/(app)/wallet') }
                ]
            );
            return;
        }

        setShowConfirmation(true);
    };

    const processTransaction = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User session expired. Please sign in again.");
            
            const activeNetwork = network || 'mtn';

            // Save Beneficiary if selected
            if (saveBeneficiary) {
                const exists = beneficiaries.find(b => b.account_number === phoneNumber);
                if (!exists) {
                    try {
                        await supabase.from('beneficiaries').insert({
                            user_id: user.id,
                            name: `${activeNetwork.toUpperCase()} - ${phoneNumber}`,
                            bank_name: activeNetwork.toUpperCase(),
                            account_number: phoneNumber
                        });
                    } catch {}
                }
            }

            // Save Auto-Renewal schedule if enabled
            if (autoRenewalEnabled) {
                try {
                    await supabase.from('auto_renewals').insert({
                        user_id: user.id,
                        service_type: 'airtime',
                        network: activeNetwork,
                        phone: phoneNumber,
                        amount: numAmount,
                        frequency: renewalFrequency,
                        status: 'active'
                    });
                } catch (schedErr) {
                    console.warn("Auto renewal registration note:", schedErr);
                }
            }

            const result = await api.airtime.purchase(user.id, {
                network: activeNetwork,
                phone: phoneNumber,
                amount: numAmount
            });

            if (result?.success) {
                try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}

                await createAppNotification(
                    user.id,
                    "Airtime Recharge Successful",
                    `Successfully delivered ₦${formatCurrency(numAmount)} airtime to ${phoneNumber} (${activeNetwork.toUpperCase()}).${autoRenewalEnabled ? ` (Auto-Renewal: ${renewalFrequency.toUpperCase()})` : ''}`,
                    "airtime",
                    "normal",
                    { route: "/(app)/history" }
                ).catch(() => null);

                // Refresh wallet balance
                fetchData();

                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${formatCurrency(netPayable)}`,
                        type: 'Airtime Recharge',
                        reference: result.reference
                    }
                });
            } else {
                throw new Error("Airtime delivery failed at carrier network.");
            }
        } catch (error: any) {
            console.error('[Airtime Process Error]:', error);
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } catch {}

            // Crucial: Refresh balance so user sees their money was never touched
            fetchData();

            const errMsg = error?.message || "Carrier failed to deliver airtime.";
            Alert.alert(
                "Transaction Unsuccessful",
                `${errMsg}\n\n🛡️ ZERO-DEDUCTION GUARANTEE: Your wallet balance has NOT been debited.`
            );
        } finally {
            setLoading(false);
            setShowSecurityModal(false);
        }
    };

    const handleDialUssd = (code: string) => {
        try {
            Linking.openURL(`tel:${encodeURIComponent(code)}`);
        } catch {
            Clipboard.setStringAsync(code);
            Alert.alert("Code Copied", `Copied ${code} to clipboard.`);
        }
    };

    const isWeb = Platform.OS === 'web';
    const headerTopPadding = Math.max(insets?.top || 0, Platform.OS === 'android' ? 36 : 22) + 10;

    return (
        <View style={{ flex: 1, backgroundColor: '#070D1E' }}>
            <StatusBar style="light" />
            
            {/* Ultra-Modern Header with Glass Pill Balance */}
            <LinearGradient 
                colors={['#050B1A', '#0D1B3E', '#162A5A']} 
                style={[
                    styles.headerContainer,
                    { paddingTop: headerTopPadding },
                    isWeb && styles.webContainer
                ]}
            >
                {/* Ambient Decorative Light */}
                <View style={styles.ambientGlow} />

                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={styles.backButton} 
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.headerTitle}>Airtime Top-Up</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Ionicons name="flash" size={11} color="#F59E0B" />
                            <Text style={styles.headerSubtitle}>Instant Delivery • Automated</Text>
                        </View>
                    </View>

                    {/* Interactive Balance Pill */}
                    <TouchableOpacity 
                        onPress={() => router.push('/(app)/wallet')}
                        style={styles.balancePill}
                        activeOpacity={0.8}
                    >
                        <View style={styles.balanceIconWrap}>
                            <Ionicons name="wallet-outline" size={13} color="#F59E0B" />
                        </View>
                        <View>
                            <Text style={styles.balancePillLabel}>Balance</Text>
                            <Text style={styles.balancePillText}>
                                ₦{formatCurrency(balance)}
                            </Text>
                        </View>
                        <View style={styles.balancePlusWrap}>
                            <Ionicons name="add" size={12} color="#0D1B3E" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Sub-Header Quick Action Bar */}
                <View style={styles.headerQuickBar}>
                    <TouchableOpacity 
                        onPress={() => router.push('/(app)/history')} 
                        style={styles.headerQuickItem}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="receipt-outline" size={12} color="#F59E0B" />
                        <Text style={styles.headerQuickText}>Recharge History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setShowUssdModal(true)} 
                        style={styles.headerQuickItem}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="keypad-outline" size={12} color="#60A5FA" />
                        <Text style={styles.headerQuickText}>Carrier USSD Codes</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={[{ flex: 1, backgroundColor: '#F8FAFC' }, isWeb && styles.webContainer]}
            >
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={[
                        styles.scrollContent,
                        isWeb && { maxWidth: 640, alignSelf: 'center', width: '100%' }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Banners */}
                    <DynamicBanners placement="airtime" />

                    {/* Zero-Charge Security Assurance Badge */}
                    <LinearGradient
                        colors={['#ECFDF5', '#F0FDF4']}
                        style={styles.guaranteeCard}
                    >
                        <View style={styles.guaranteeIconWrap}>
                            <Ionicons name="shield-checkmark" size={17} color="#059669" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.guaranteeTitle}>Zero-Risk Guarantee</Text>
                                <View style={styles.guaranteePill}>
                                    <Text style={styles.guaranteePillText}>100% PROTECTED</Text>
                                </View>
                            </View>
                            <Text style={styles.guaranteeSubtitle}>
                                Funds are deducted ONLY after airtime is confirmed credited to your phone.
                            </Text>
                        </View>
                    </LinearGradient>

                    {/* Recent Numbers Row */}
                    {Boolean(recents && recents.length > 0) && (
                        <View style={styles.recentsSection}>
                            <View style={styles.labelRow}>
                                <Text style={styles.sectionLabel}>Recent Refills</Text>
                                <Text style={styles.sectionSublabel}>Tap to autofill</Text>
                            </View>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                            >
                                {recents.map((item, idx) => (
                                    <TouchableOpacity
                                        key={item.id || String(idx)}
                                        onPress={() => {
                                            try { Haptics.selectionAsync(); } catch {}
                                            setPhoneNumber(item.phone);
                                            detectNetwork(item.phone);
                                        }}
                                        style={styles.recentItemChip}
                                        activeOpacity={0.75}
                                    >
                                        <View style={styles.recentLogoWrap}>
                                            {item.network && NETWORK_LOGOS[item.network] ? (
                                                <Image source={NETWORK_LOGOS[item.network]} style={{ width: 18, height: 18 }} resizeMode="contain" />
                                            ) : (
                                                <Ionicons name="call" size={12} color="#64748B" />
                                            )}
                                        </View>
                                        <View>
                                            <Text style={styles.recentPhoneText}>{item.phone}</Text>
                                            <Text style={styles.recentNetworkText}>{(item.network || 'MTN').toUpperCase()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* 1. Mobile Network Selector */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.labelRow}>
                            <Text style={styles.sectionLabel}>Select Mobile Network</Text>
                            <View style={styles.networkHealthPill}>
                                <View style={styles.greenPulseDot} />
                                <Text style={styles.networkHealthText}>API Server Live</Text>
                            </View>
                        </View>
                        
                        <View style={styles.networksRow}>
                            {NETWORKS_DATA.map((net) => {
                                const isSelected = network === net.id;
                                const rate = customDiscounts[net.id] !== undefined ? customDiscounts[net.id] : net.defaultDiscount;
                                const discountLabel = rate > 0 ? `${Math.round(rate * 100)}% OFF` : 'Instant VTU';

                                return (
                                    <TouchableOpacity
                                        key={net.id}
                                        onPress={() => handleSelectNetwork(net.id)}
                                        style={[
                                            styles.networkCard,
                                            isSelected && styles.networkCardActive
                                        ]}
                                        activeOpacity={0.8}
                                    >
                                        {/* Top Colored Indicator Bar */}
                                        <View style={[styles.networkTopBar, { backgroundColor: net.color }, isSelected && styles.networkTopBarActive]} />

                                        <View style={[styles.networkLogoContainer, isSelected && styles.networkLogoContainerActive]}>
                                            <Image 
                                                source={NETWORK_LOGOS[net.id]} 
                                                style={styles.networkLogoImage} 
                                                resizeMode="contain" 
                                            />
                                        </View>
                                        <Text style={[styles.networkCardName, isSelected && styles.networkCardNameActive]} numberOfLines={1}>
                                            {net.name}
                                        </Text>
                                        
                                        <View style={[styles.cashbackTag, isSelected && styles.cashbackTagActive, rate === 0 && { backgroundColor: '#F1F5F9' }]}>
                                            <Text style={[styles.cashbackTagText, isSelected && styles.cashbackTagTextActive, rate === 0 && { color: '#475569' }]}>
                                                {discountLabel}
                                            </Text>
                                        </View>
                                        
                                        {isSelected && (
                                            <View style={styles.activeCheckmark}>
                                                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 2. Phone Input Card */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.labelRow}>
                            <Text style={styles.sectionLabel}>Mobile Number</Text>
                            {isPhoneComplete ? (
                                <View style={styles.validBadge}>
                                    <Ionicons name="checkmark-circle" size={13} color="#059669" />
                                    <Text style={styles.validBadgeText}>Verified 11 Digits</Text>
                                </View>
                            ) : (
                                <Text style={styles.digitCounter}>{phoneNumber.length}/11 digits</Text>
                            )}
                        </View>

                        {/* Phone Quick Actions Bar */}
                        <View style={styles.phoneQuickActionsRow}>
                            <TouchableOpacity 
                                onPress={handleLaunchNativeContactPicker}
                                style={styles.phoneQuickBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="people-outline" size={13} color="#0D1B3E" />
                                <Text style={styles.phoneQuickBtnText}>Choose from Contacts</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => {
                                    setContactModalTab('beneficiaries');
                                    setShowContactModal(true);
                                }}
                                style={styles.phoneQuickBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="bookmark-outline" size={13} color="#0D1B3E" />
                                <Text style={styles.phoneQuickBtnText}>Saved ({beneficiaries.length})</Text>
                            </TouchableOpacity>

                            {Boolean(userPhone && phoneNumber !== userPhone) && (
                                <TouchableOpacity 
                                    onPress={() => {
                                        try { Haptics.selectionAsync(); } catch {}
                                        handlePhoneChange(userPhone || '');
                                    }}
                                    style={[styles.phoneQuickBtn, styles.phoneQuickBtnHighlight]}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="person" size={12} color="#0D1B3E" />
                                    <Text style={styles.phoneQuickBtnText}>My Line</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={[
                            styles.inputContainer,
                            phoneFocused && styles.inputContainerFocused,
                            isPhoneComplete && styles.inputContainerSuccess
                        ]}>
                            {/* Selected / Auto-Detected Network Avatar */}
                            <View style={styles.inputLogoWrapper}>
                                {NETWORK_LOGOS[network] ? (
                                    <Image source={NETWORK_LOGOS[network]} style={{ width: 22, height: 22 }} resizeMode="contain" />
                                ) : (
                                    <Ionicons name="call" size={17} color="#64748B" />
                                )}
                            </View>

                            <TextInput
                                style={styles.phoneInput}
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={handlePhoneChange}
                                placeholder="0801 234 5678"
                                placeholderTextColor="#94A3B8"
                                maxLength={11}
                                editable={!loading}
                                onFocus={() => setPhoneFocused(true)}
                                onBlur={() => setPhoneFocused(false)}
                            />

                            {/* "My Line" 1-Tap Shortcut */}
                            {Boolean(userPhone && phoneNumber !== userPhone) && (
                                <TouchableOpacity 
                                    onPress={() => {
                                        try { Haptics.selectionAsync(); } catch {}
                                        handlePhoneChange(userPhone || '');
                                    }}
                                    style={styles.mePill}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="person" size={11} color="#0D1B3E" style={{ marginRight: 3 }} />
                                    <Text style={styles.mePillText}>My Line</Text>
                                </TouchableOpacity>
                            )}

                            {/* Address Book Contact Picker Button */}
                            <TouchableOpacity 
                                onPress={handleOpenContactModal}
                                style={styles.contactBookBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="book-outline" size={18} color="#0D1B3E" />
                            </TouchableOpacity>
                        </View>

                        {/* Save Beneficiary Toggle */}
                        {Boolean(isPhoneComplete && !beneficiaries.find(b => b.account_number === phoneNumber)) && (
                            <View style={styles.saveBeneficiaryRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="bookmark-outline" size={15} color="#059669" />
                                    <Text style={styles.saveBeneficiaryText}>Save this number to my beneficiaries</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#CBD5E1", true: "#A7F3D0" }}
                                    thumbColor={saveBeneficiary ? "#059669" : "#FFFFFF"}
                                    onValueChange={setSaveBeneficiary}
                                    value={saveBeneficiary}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>
                        )}
                    </View>

                    {/* 3. Amount Section & Fast Presets */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.labelRow}>
                            <Text style={styles.sectionLabel}>Top-Up Amount</Text>
                            {discountSavings > 0 && (
                                <View style={styles.discountPill}>
                                    <Ionicons name="sparkles" size={11} color="#059669" />
                                    <Text style={styles.discountPillText}>
                                        Save ₦{formatCurrency(discountSavings)} ({discountPercentage}% OFF)
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={[
                            styles.inputContainer,
                            amountFocused && styles.inputContainerFocused,
                            numAmount >= 50 && styles.inputContainerSuccess
                        ]}>
                            <Text style={styles.nairaSymbol}>₦</Text>
                            <TextInput
                                style={styles.amountInput}
                                keyboardType="number-pad"
                                value={amount}
                                onChangeText={handleAmountChange}
                                placeholder="Min: 50"
                                placeholderTextColor="#CBD5E1"
                                editable={!loading}
                                onFocus={() => setAmountFocused(true)}
                                onBlur={() => setAmountFocused(false)}
                            />
                            {numAmount > 0 && (
                                <TouchableOpacity onPress={() => setAmount('')} style={{ padding: 4 }}>
                                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Fast Presets Grid */}
                        <View style={styles.presetsGrid}>
                            {PRESETS.map((val) => {
                                const isSelected = amount === val.toString();
                                return (
                                    <TouchableOpacity
                                        key={val}
                                        onPress={() => handleSelectPreset(val)}
                                        style={[
                                            styles.presetChip,
                                            isSelected && styles.presetChipActive
                                        ]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.presetChipText,
                                            isSelected && styles.presetChipTextActive
                                        ]}>
                                            ₦{val.toLocaleString()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 4. Auto-Renewal / Scheduled Top-Up Section */}
                    <View style={styles.autoRenewalCard}>
                        <View style={styles.autoRenewalHeader}>
                            <View style={styles.autoRenewalIconWrap}>
                                <Ionicons name="repeat" size={18} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.autoRenewalTitle}>Auto-Renewal Schedule</Text>
                                <Text style={styles.autoRenewalSubtitle}>
                                    {autoRenewalEnabled 
                                        ? `Active: Refill scheduled ${renewalFrequency.toUpperCase()}` 
                                        : 'Automatically refill this line on a recurring cycle'}
                                </Text>
                            </View>
                            <Switch
                                trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
                                thumbColor={autoRenewalEnabled ? "#2563EB" : "#FFFFFF"}
                                onValueChange={(val) => {
                                    safeLayoutAnimation();
                                    setAutoRenewalEnabled(val);
                                }}
                                value={autoRenewalEnabled}
                            />
                        </View>

                        {autoRenewalEnabled && (
                            <View style={styles.frequencyPickerWrap}>
                                <Text style={styles.frequencyLabel}>Select Recurrence Frequency:</Text>
                                <View style={styles.frequencyButtonsRow}>
                                    {(['daily', 'weekly', 'monthly'] as const).map((freq) => {
                                        const isSelected = renewalFrequency === freq;
                                        return (
                                            <TouchableOpacity
                                                key={freq}
                                                onPress={() => {
                                                    try { Haptics.selectionAsync(); } catch {}
                                                    setRenewalFrequency(freq);
                                                }}
                                                style={[
                                                    styles.frequencyBtn,
                                                    isSelected && styles.frequencyBtnActive
                                                ]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[
                                                    styles.frequencyBtnText,
                                                    isSelected && styles.frequencyBtnTextActive
                                                ]}>
                                                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <View style={styles.scheduleInfoNote}>
                                    <Ionicons name="calendar-outline" size={13} color="#2563EB" style={{ marginRight: 6 }} />
                                    <Text style={styles.scheduleInfoText}>
                                        {renewalFrequency === 'daily' && 'Refills automatically every day at 8:00 AM.'}
                                        {renewalFrequency === 'weekly' && 'Refills automatically every Monday morning at 8:00 AM.'}
                                        {renewalFrequency === 'monthly' && 'Refills automatically on the 1st of every month at 8:00 AM.'}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* 5. Live Cost Breakdown Card */}
                    {numAmount > 0 && (
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryHeader}>
                                <Text style={styles.summaryHeaderTitle}>Order Breakdown</Text>
                                <View style={styles.summaryNetworkTag}>
                                    <Text style={styles.summaryNetworkTagText}>{activeNetworkObj.name}</Text>
                                </View>
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Face Value Amount</Text>
                                <Text style={styles.summaryValue}>₦{formatCurrency(numAmount)}</Text>
                            </View>

                            {discountSavings > 0 ? (
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryLabel, { color: '#059669' }]}>
                                        Instant Cashback Discount ({discountPercentage}% OFF)
                                    </Text>
                                    <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '800' }]}>
                                        -₦{formatCurrency(discountSavings)}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Convenience / Service Fee</Text>
                                    <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '700' }]}>
                                        FREE (₦0.00)
                                    </Text>
                                </View>
                            )}

                            {autoRenewalEnabled && (
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryLabel, { color: '#2563EB' }]}>
                                        Auto-Renewal
                                    </Text>
                                    <Text style={[styles.summaryValue, { color: '#2563EB', fontWeight: '700' }]}>
                                        {renewalFrequency.toUpperCase()}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.summaryDivider} />

                            <View style={styles.summaryRow}>
                                <View>
                                    <Text style={styles.totalPayableLabel}>Total Payable</Text>
                                    <Text style={styles.totalPayableSub}>Debited from main wallet</Text>
                                </View>
                                <Text style={styles.totalPayableValue}>₦{formatCurrency(netPayable)}</Text>
                            </View>
                            
                            {/* Live balance sufficiency check */}
                            {balance !== null && (
                                <View style={[
                                    styles.balanceStatusWrap,
                                    !isSufficientBalance && styles.balanceStatusWrapError
                                ]}>
                                    <Ionicons 
                                        name={isSufficientBalance ? "checkmark-circle" : "alert-circle"} 
                                        size={14} 
                                        color={isSufficientBalance ? "#059669" : "#DC2626"} 
                                    />
                                    <Text style={[styles.balanceStatusText, !isSufficientBalance && { color: '#DC2626' }]}>
                                        {isSufficientBalance 
                                            ? `Sufficient balance (Wallet: ₦${formatCurrency(balance)})`
                                            : `Insufficient balance (Wallet: ₦${formatCurrency(balance)}). Please top up.`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Low Balance Quick Top-Up Banner */}
                    {Boolean(balance !== null && numAmount > 0 && !isSufficientBalance) && (
                        <TouchableOpacity
                            onPress={() => router.push('/(app)/wallet')}
                            style={styles.lowBalanceBanner}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="wallet" size={18} color="#D97706" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.lowBalanceTitle}>Wallet Balance Low</Text>
                                <Text style={styles.lowBalanceSub}>You need ₦{formatCurrency(netPayable - (balance || 0))} more. Tap to add funds.</Text>
                            </View>
                            <View style={styles.fundNowBtn}>
                                <Text style={styles.fundNowBtnText}>Fund</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* 6. Primary Action Button */}
                    <TouchableOpacity
                        onPress={handleInitiatePurchase}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                        style={{ marginTop: 8, marginBottom: 16 }}
                    >
                        <LinearGradient
                            colors={!canSubmit ? ['#CBD5E1', '#94A3B8'] : ['#060D21', '#0D1B3E', '#F59E0B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.payButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
                                    <Text style={styles.payButtonText}>
                                        {numAmount > 0 
                                            ? `Pay ₦${formatCurrency(netPayable)} Securely` 
                                            : "Enter Amount to Continue"}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Trust Seal Footer */}
                    <View style={styles.trustFooter}>
                        <Ionicons name="shield-checkmark" size={14} color="#94A3B8" />
                        <Text style={styles.trustFooterText}>Bank-Grade 256-Bit SSL Encryption • Instant VTU Delivery</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Comprehensive Contact & Beneficiary Picker Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showContactModal}
                onRequestClose={() => {
                    setContactSearch('');
                    setShowContactModal(false);
                }}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheet, isWeb && { maxWidth: 520, alignSelf: 'center', width: '100%' }]}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Select Recipient</Text>
                            <TouchableOpacity onPress={() => setShowContactModal(false)}>
                                <Ionicons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Direct Native Picker Action Button */}
                        <TouchableOpacity
                            onPress={handleLaunchNativeContactPicker}
                            style={styles.openSystemContactsBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="phone-portrait-outline" size={18} color="#0D1B3E" />
                            <Text style={styles.openSystemContactsText}>Open Phone Address Book</Text>
                            <Ionicons name="chevron-forward" size={16} color="#64748B" />
                        </TouchableOpacity>

                        {/* Modal Tabs */}
                        <View style={styles.modalTabsRow}>
                            <TouchableOpacity
                                onPress={() => setContactModalTab('phonebook')}
                                style={[
                                    styles.modalTabBtn,
                                    contactModalTab === 'phonebook' && styles.modalTabBtnActive
                                ]}
                            >
                                <Ionicons 
                                    name="book" 
                                    size={14} 
                                    color={contactModalTab === 'phonebook' ? '#0D1B3E' : '#64748B'} 
                                    style={{ marginRight: 6 }} 
                                />
                                <Text style={[
                                    styles.modalTabBtnText,
                                    contactModalTab === 'phonebook' && styles.modalTabBtnTextActive
                                ]}>
                                    Phone Contacts ({deviceContacts.length})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setContactModalTab('beneficiaries')}
                                style={[
                                    styles.modalTabBtn,
                                    contactModalTab === 'beneficiaries' && styles.modalTabBtnActive
                                ]}
                            >
                                <Ionicons 
                                    name="people" 
                                    size={14} 
                                    color={contactModalTab === 'beneficiaries' ? '#0D1B3E' : '#64748B'} 
                                    style={{ marginRight: 6 }} 
                                />
                                <Text style={[
                                    styles.modalTabBtnText,
                                    contactModalTab === 'beneficiaries' && styles.modalTabBtnTextActive
                                ]}>
                                    Saved ({beneficiaries.length})
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search Box */}
                        <View style={styles.modalSearchBox}>
                            <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search by name or phone..."
                                placeholderTextColor="#94A3B8"
                                value={contactSearch}
                                onChangeText={setContactSearch}
                            />
                            {contactSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setContactSearch('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {contactModalTab === 'phonebook' ? (
                            loadingDeviceContacts ? (
                                <View style={{ padding: 32, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color="#0D1B3E" />
                                    <Text style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>Loading device contacts...</Text>
                                </View>
                            ) : contactsPermissionGranted === false ? (
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <Ionicons name="lock-closed-outline" size={32} color="#94A3B8" />
                                    <Text style={{ color: '#0F172A', fontSize: 14, fontWeight: '700', marginTop: 8 }}>
                                        Contacts Access Restricted
                                    </Text>
                                    <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14 }}>
                                        Please enable contacts permission to choose numbers from your address book.
                                    </Text>
                                    <TouchableOpacity 
                                        onPress={() => loadDeviceContacts(true)} 
                                        style={styles.grantPermissionBtn}
                                    >
                                        <Text style={styles.grantPermissionBtnText}>Grant Permission</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <FlatList
                                    data={deviceContacts.filter(c =>
                                        (c.name || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
                                        (c.phone || '').includes(contactSearch)
                                    )}
                                    keyExtractor={(item) => item.id || item.phone}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.beneficiaryListItem}
                                            onPress={() => {
                                                setPhoneNumber(item.phone);
                                                detectNetwork(item.phone);
                                                setShowContactModal(false);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.beneficiaryAvatar, { backgroundColor: '#EFF6FF' }]}>
                                                <Text style={[styles.beneficiaryAvatarText, { color: '#2563EB' }]}>
                                                    {item.name ? item.name[0].toUpperCase() : 'C'}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.beneficiaryItemName}>{item.name}</Text>
                                                <Text style={styles.beneficiaryItemSub}>{item.phone}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        <View style={{ padding: 24, alignItems: 'center' }}>
                                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>No phonebook contacts found</Text>
                                            <TouchableOpacity 
                                                onPress={() => loadDeviceContacts(true)} 
                                                style={{ marginTop: 8 }}
                                            >
                                                <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 12 }}>Reload Contacts</Text>
                                            </TouchableOpacity>
                                        </View>
                                    }
                                />
                            )
                        ) : (
                            <FlatList
                                data={beneficiaries.filter(b => 
                                    (b.name || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
                                    (b.account_number || '').includes(contactSearch)
                                )}
                                keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.beneficiaryListItem}
                                        onPress={() => {
                                            setPhoneNumber(item.account_number);
                                            detectNetwork(item.account_number);
                                            setShowContactModal(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.beneficiaryAvatar}>
                                            <Text style={styles.beneficiaryAvatarText}>
                                                {item.name ? item.name[0].toUpperCase() : 'B'}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.beneficiaryItemName}>{item.name}</Text>
                                            <Text style={styles.beneficiaryItemSub}>{item.account_number}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 13 }}>No saved beneficiaries found</Text>
                                    </View>
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Carrier USSD Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showUssdModal}
                onRequestClose={() => setShowUssdModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheet, isWeb && { maxWidth: 480, alignSelf: 'center', width: '100%' }]}>
                        <View style={styles.modalSheetHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="keypad" size={20} color="#2563EB" />
                                <Text style={styles.modalSheetTitle}>Carrier USSD Codes</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowUssdModal(false)}>
                                <Ionicons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                            Official Nigeria regulatory USSD shortcuts. Tap to dial or copy.
                        </Text>

                        <View style={{ gap: 8 }}>
                            <TouchableOpacity 
                                onPress={() => handleDialUssd(activeNetworkObj.ussdBalance)}
                                style={styles.ussdRowCard}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.ussdActionTitle}>Check Airtime Balance</Text>
                                    <Text style={styles.ussdActionSub}>{activeNetworkObj.name} Universal Code</Text>
                                </View>
                                <View style={styles.ussdCodePill}>
                                    <Text style={styles.ussdCodeText}>{activeNetworkObj.ussdBalance}</Text>
                                    <Ionicons name="call" size={12} color="#2563EB" style={{ marginLeft: 4 }} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => handleDialUssd(activeNetworkObj.ussdData)}
                                style={styles.ussdRowCard}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.ussdActionTitle}>Check Data Balance</Text>
                                    <Text style={styles.ussdActionSub}>{activeNetworkObj.name} Universal Code</Text>
                                </View>
                                <View style={styles.ussdCodePill}>
                                    <Text style={styles.ussdCodeText}>{activeNetworkObj.ussdData}</Text>
                                    <Ionicons name="call" size={12} color="#2563EB" style={{ marginLeft: 4 }} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => handleDialUssd(activeNetworkObj.ussdBorrow)}
                                style={styles.ussdRowCard}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.ussdActionTitle}>Borrow Airtime / Emergency</Text>
                                    <Text style={styles.ussdActionSub}>{activeNetworkObj.name} Emergency Credit</Text>
                                </View>
                                <View style={styles.ussdCodePill}>
                                    <Text style={styles.ussdCodeText}>{activeNetworkObj.ussdBorrow}</Text>
                                    <Ionicons name="call" size={12} color="#2563EB" style={{ marginLeft: 4 }} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Transaction Confirmation Modal */}
            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 300);
                }}
                title="Confirm Airtime Purchase"
                network={network || 'mtn'}
                details={[
                    { label: 'Service', value: 'Instant Airtime Recharge' },
                    { label: 'Carrier Network', value: activeNetworkObj.name },
                    { label: 'Recipient Phone', value: phoneNumber },
                    { label: 'Airtime Value', value: `₦${formatCurrency(numAmount)}`, isAmount: true },
                    { label: `Cashback Discount (${discountPercentage}%)`, value: `-₦${formatCurrency(discountSavings)}`, isDiscount: true },
                    { label: 'Auto-Renewal Schedule', value: autoRenewalEnabled ? `Enabled (${renewalFrequency.toUpperCase()})` : 'Disabled (One-Time)' },
                    { label: 'Net Amount to Pay', value: `₦${formatCurrency(netPayable)}`, isTotal: true },
                ]}
            />

            {/* Security PIN Authorization Modal */}
            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                    processTransaction();
                }}
                title="Authorize Transaction"
                description={`Enter your security PIN to authorize ₦${formatCurrency(netPayable)} airtime top-up for ${phoneNumber}`}
                requiredFor="purchase"
            />
        </View>
    );
}

export default function AirtimeScreen() {
    return (
        <ErrorBoundary 
            fallbackTitle="Unable to Load Airtime" 
            fallbackSubtitle="An unexpected issue occurred while rendering the airtime screen. Please tap below to retry."
        >
            <AirtimeScreenContent />
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        position: 'relative',
        overflow: 'hidden',
    },
    ambientGlow: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    webContainer: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 720,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingLeft: 8,
        paddingRight: 6,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        gap: 6,
    },
    balanceIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    balancePillLabel: {
        color: '#94A3B8',
        fontSize: 8.5,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    balancePillText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    balancePlusWrap: {
        backgroundColor: '#F59E0B',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerQuickBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerQuickItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    headerQuickText: {
        color: '#E2E8F0',
        fontSize: 10.5,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 60,
    },
    guaranteeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        gap: 12,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
    },
    guaranteeIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D1FAE5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    guaranteeTitle: {
        color: '#065F46',
        fontSize: 12,
        fontWeight: '800',
    },
    guaranteePill: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    guaranteePillText: {
        color: '#047857',
        fontSize: 8,
        fontWeight: '900',
    },
    guaranteeSubtitle: {
        color: '#047857',
        fontSize: 10.5,
        marginTop: 2,
        lineHeight: 14,
    },
    recentsSection: {
        marginBottom: 16,
    },
    recentItemChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    recentLogoWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentPhoneText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0F172A',
    },
    recentNetworkText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B',
    },
    sectionContainer: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#1E293B',
    },
    sectionSublabel: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#64748B',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    networkHealthPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 4,
    },
    greenPulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#059669',
    },
    networkHealthText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#059669',
    },
    validBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    validBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#059669',
    },
    digitCounter: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#94A3B8',
    },
    discountPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4,
    },
    discountPillText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#059669',
    },
    networksRow: {
        flexDirection: 'row',
        gap: 6,
    },
    networkCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    networkTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        opacity: 0.4,
    },
    networkTopBarActive: {
        opacity: 1,
        height: 3.5,
    },
    networkCardActive: {
        borderColor: '#0D1B3E',
        backgroundColor: 'rgba(13, 27, 62, 0.03)',
        shadowColor: '#0D1B3E',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    networkLogoContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    networkLogoContainerActive: {
        backgroundColor: '#FFFFFF',
    },
    networkLogoImage: {
        width: 24,
        height: 24,
    },
    networkCardName: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    networkCardNameActive: {
        color: '#0D1B3E',
        fontWeight: '900',
    },
    cashbackTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 4,
        marginTop: 3,
    },
    cashbackTagActive: {
        backgroundColor: '#FEF3C7',
    },
    cashbackTagText: {
        fontSize: 8,
        fontWeight: '800',
        color: '#64748B',
    },
    cashbackTagTextActive: {
        color: '#B45309',
    },
    activeCheckmark: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#0D1B3E',
        width: 14,
        height: 14,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phoneQuickActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    phoneQuickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
    },
    phoneQuickBtnHighlight: {
        backgroundColor: 'rgba(13, 27, 62, 0.06)',
        borderColor: '#CBD5E1',
    },
    phoneQuickBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0D1B3E',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        height: 50,
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    inputContainerFocused: {
        borderColor: '#0D1B3E',
        backgroundColor: '#FFFFFF',
        shadowColor: '#0D1B3E',
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    inputContainerSuccess: {
        borderColor: '#059669',
    },
    inputLogoWrapper: {
        width: 26,
        height: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    phoneInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    mePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(13, 27, 62, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        marginRight: 6,
    },
    mePillText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#0D1B3E',
    },
    contactBookBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    saveBeneficiaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingHorizontal: 4,
    },
    saveBeneficiaryText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
    },
    nairaSymbol: {
        fontSize: 18,
        fontWeight: '900',
        color: '#64748B',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    presetsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    presetChip: {
        width: '31.5%',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
    },
    presetChipActive: {
        backgroundColor: '#0D1B3E',
        borderColor: '#0D1B3E',
    },
    presetChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    presetChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    // Auto-Renewal Section
    autoRenewalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#DBEAFE',
        padding: 14,
        marginBottom: 16,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    autoRenewalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    autoRenewalIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    autoRenewalTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#1E3A8A',
    },
    autoRenewalSubtitle: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 2,
    },
    frequencyPickerWrap: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    frequencyLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
    },
    frequencyButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    frequencyBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    frequencyBtnActive: {
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
    },
    frequencyBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748B',
    },
    frequencyBtnTextActive: {
        color: '#2563EB',
        fontWeight: '800',
    },
    scheduleInfoNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 8,
    },
    scheduleInfoText: {
        fontSize: 10.5,
        color: '#1D4ED8',
        fontWeight: '600',
        flex: 1,
    },
    // Order Summary
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        shadowColor: '#0D1B3E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    summaryHeaderTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0F172A',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryNetworkTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    summaryNetworkTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 11.5,
        color: '#64748B',
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0F172A',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 6,
    },
    totalPayableLabel: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A',
    },
    totalPayableSub: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '500',
        marginTop: 1,
    },
    totalPayableValue: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0D1B3E',
    },
    balanceStatusWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
    },
    balanceStatusWrapError: {
        backgroundColor: '#FEF2F2',
        padding: 6,
        borderRadius: 8,
    },
    balanceStatusText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#059669',
    },
    lowBalanceBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1.5,
        borderColor: '#FDE68A',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        gap: 10,
    },
    lowBalanceTitle: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '800',
    },
    lowBalanceSub: {
        color: '#B45309',
        fontSize: 10.5,
        marginTop: 1,
    },
    fundNowBtn: {
        backgroundColor: '#D97706',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    fundNowBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    payButton: {
        height: 50,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    payButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    trustFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 4,
    },
    trustFooterText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
    },
    // Modals
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        padding: 16,
    },
    modalSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalSheetTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    openSystemContactsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderWidth: 1.5,
        borderColor: '#BFDBFE',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        gap: 8,
    },
    openSystemContactsText: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: '800',
        color: '#1D4ED8',
    },
    modalTabsRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        padding: 3,
        marginBottom: 12,
    },
    modalTabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        borderRadius: 8,
    },
    modalTabBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    modalTabBtnText: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#64748B',
    },
    modalTabBtnTextActive: {
        color: '#0D1B3E',
        fontWeight: '800',
    },
    modalSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        marginBottom: 12,
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0F172A',
    },
    beneficiaryListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 10,
    },
    beneficiaryAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(13, 27, 62, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    beneficiaryAvatarText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0D1B3E',
    },
    beneficiaryItemName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    beneficiaryItemSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    grantPermissionBtn: {
        backgroundColor: '#0D1B3E',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    grantPermissionBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    ussdRowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
    },
    ussdActionTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0F172A',
    },
    ussdActionSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 1,
    },
    ussdCodePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ussdCodeText: {
        color: '#1D4ED8',
        fontSize: 12,
        fontWeight: '800',
    },
});
