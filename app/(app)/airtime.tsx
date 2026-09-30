import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, FlatList, Switch, StyleSheet, LayoutAnimation } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { createAppNotification } from '../../services/notificationsHelper';
import * as Haptics from 'expo-haptics';
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
    color: string;
    cashback: string;
    discountRate: number;
    prefixes: string[];
}

const NETWORKS_DATA: NetworkItem[] = [
    { id: 'mtn', name: 'MTN', color: '#FFCC00', cashback: '2% Off', discountRate: 0.02, prefixes: ['0803', '0806', '0703', '0903', '0810', '0813', '0814', '0816', '0906', '0706', '0913', '0916'] },
    { id: 'glo', name: 'Glo', color: '#0F6A37', cashback: '3% Off', discountRate: 0.03, prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'] },
    { id: 'airtel', name: 'Airtel', color: '#FF0000', cashback: '2% Off', discountRate: 0.02, prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912'] },
    { id: '9mobile', name: '9mobile', color: '#006B3E', cashback: '3% Off', discountRate: 0.03, prefixes: ['0809', '0818', '0817', '0909', '0908'] },
    { id: 'vitel', name: 'VITEL', color: '#6366F1', cashback: '2% Off', discountRate: 0.02, prefixes: ['070', '091'] },
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

const safeLayoutAnimation = () => {
    try {
        if (Platform.OS !== 'web' && LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
    } catch {
        // Safe animation fallback
    }
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
    
    // Beneficiary states
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);
    
    // Modals
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    // Focus states for dynamic borders
    const [phoneFocused, setPhoneFocused] = useState(false);
    const [amountFocused, setAmountFocused] = useState(false);

    useEffect(() => {
        fetchData();
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

    // Current network meta
    const activeNetworkObj = useMemo(() => {
        return NETWORKS_DATA.find(n => n.id === network) || NETWORKS_DATA[0];
    }, [network]);

    // Financial calculations
    const numAmount = Number(amount || 0);
    const discountRate = activeNetworkObj.discountRate || 0.02;
    const discountSavings = Math.round(numAmount * discountRate);
    const netPayable = Math.max(0, numAmount - discountSavings);
    const isSufficientBalance = balance !== null && balance >= netPayable;
    const isPhoneComplete = phoneNumber.length === 11;
    const canSubmit = isPhoneComplete && numAmount >= 50 && isSufficientBalance && !loading;

    const handleInitiatePurchase = () => {
        if (!network) {
            Alert.alert("Zaɓi Layi", "Da fatan za a zaɓi layin da za a tura wa katin (Select a mobile network).");
            return;
        }
        if (!numAmount || numAmount < 50) {
            Alert.alert("Kudi Ba Su Isa Ba", "Mafi ƙarancin kudin da za a iya siya shi ne ₦50 (Minimum purchase is ₦50).");
            return;
        }
        if (phoneNumber.length !== 11) {
            Alert.alert("Lambar Waya Bata Cika Ba", `Lambar wayar tana da digit ${phoneNumber.length}/11. Da fatan za a shigar da dukkan lambobin 11.`);
            return;
        }

        const phoneValidation = validateNigerianPhone(phoneNumber);
        if (!phoneValidation.isValid) {
            Alert.alert("Lamba Ba Daidai Ba", phoneValidation.error || "Da fatan za a tabbatar da lambar wayar 11 ce mai aiki a Najeriya.");
            return;
        }

        if (balance !== null && netPayable > balance) {
            Alert.alert(
                "Kudin Asusunka Ba Su Isa Ba",
                `Kudin asusunka (₦${formatCurrency(balance)}) ba zai iya biyan ₦${formatCurrency(netPayable)} ba. Da fatan za a fara zuba kudi a wallet.`,
                [
                    { text: "Koma Baya", style: "cancel" },
                    { text: "Zuba Kudi (Fund)", onPress: () => router.push('/(app)/wallet') }
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
            if (!user) throw new Error("Ba a tabbatar da mai asusu ba (User not authenticated)");
            
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
                    "Airtime Purchase Successful",
                    `An yi nasarar tura katin ₦${formatCurrency(numAmount)} zuwa ${phoneNumber} (${activeNetwork.toUpperCase()}).`,
                    "airtime",
                    "normal",
                    { route: "/(app)/history" }
                ).catch(() => null);

                // Refresh local balance
                fetchData();

                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${formatCurrency(netPayable)}`,
                        type: 'Airtime Purchase',
                        reference: result.reference
                    }
                });
            } else {
                throw new Error("Katin bai shiga ba.");
            }
        } catch (error: any) {
            console.error('[Airtime Process Error]:', error);
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } catch {}

            // Crucial: Refresh balance so user sees their money was never touched
            fetchData();

            const errMsg = error?.message || "An samu matsala wajen tura katin.";
            Alert.alert(
                "An Samu Tsaiko (Delivery Failed)",
                `${errMsg}\n\n🛡️ KUDINKA NA NAN LAFIYA: Ba a cire ko sisi a cikin wallet dinka ba (Your wallet balance has NOT been debited).`
            );
        } finally {
            setLoading(false);
            setShowSecurityModal(false);
        }
    };

    const isWeb = Platform.OS === 'web';
    const headerTopPadding = Math.max(insets?.top || 0, Platform.OS === 'android' ? 36 : 22) + 8;

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <StatusBar style="light" />
            
            {/* Mobile-First Header */}
            <LinearGradient 
                colors={['#060d21', '#0d1b3e']} 
                style={[
                    styles.headerContainer,
                    { paddingTop: headerTopPadding },
                    isWeb && styles.webContainer
                ]}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={styles.backButton} 
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color="#ffffff" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.headerTitle}>Buy Airtime</Text>
                        <Text style={styles.headerSubtitle}>Fast delivery with instant cashback</Text>
                    </View>

                    {/* Balance Capsule */}
                    <TouchableOpacity 
                        onPress={() => router.push('/(app)/wallet')}
                        style={styles.balancePill}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="wallet-outline" size={13} color="#f5a623" />
                        <Text style={styles.balancePillText}>
                            ₦{formatCurrency(balance)}
                        </Text>
                        <View style={styles.balancePlusWrap}>
                            <Ionicons name="add" size={12} color="#0d1b3e" />
                        </View>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={[{ flex: 1 }, isWeb && styles.webContainer]}
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
                    <View style={styles.guaranteeCard}>
                        <View style={styles.guaranteeIconWrap}>
                            <Ionicons name="shield-checkmark" size={16} color="#16a34a" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.guaranteeTitle}>Garkuwar Kudi 100% (Zero-Risk Delivery)</Text>
                            <Text style={styles.guaranteeSubtitle}>
                                Ba za a cire kudin wallet dinka ba har sai katin ya tabbata ya shiga lambar ka.
                            </Text>
                        </View>
                    </View>

                    {/* Recent Numbers Carousel */}
                    {Boolean(recents && recents.length > 0) && (
                        <View style={styles.recentsSection}>
                            <Text style={styles.sectionLabel}>Lambar Kusa (Recent)</Text>
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
                                                <Ionicons name="call" size={12} color="#64748b" />
                                            )}
                                        </View>
                                        <Text style={styles.recentPhoneText}>{item.phone}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* 1. Network Selector */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionLabel}>Zaɓi Layin Sadarwa (Select Network)</Text>
                        <View style={styles.networksRow}>
                            {NETWORKS_DATA.map((net) => {
                                const isSelected = network === net.id;
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
                                        <View style={[styles.cashbackBadge, isSelected && styles.cashbackBadgeActive]}>
                                            <Text style={[styles.cashbackBadgeText, isSelected && styles.cashbackBadgeTextActive]}>
                                                {net.cashback}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <View style={styles.activeCheckmark}>
                                                <Ionicons name="checkmark" size={9} color="#ffffff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 2. Phone Input */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.labelRow}>
                            <Text style={styles.sectionLabel}>Lambar Waya (Phone Number)</Text>
                            {isPhoneComplete && (
                                <View style={styles.validBadge}>
                                    <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                                    <Text style={styles.validBadgeText}>Lamba Mai Kyau</Text>
                                </View>
                            )}
                        </View>

                        <View style={[
                            styles.inputContainer,
                            phoneFocused && styles.inputContainerFocused,
                            isPhoneComplete && styles.inputContainerSuccess
                        ]}>
                            {/* Selected Network Avatar on Left */}
                            <View style={styles.inputLogoWrapper}>
                                {NETWORK_LOGOS[network] ? (
                                    <Image source={NETWORK_LOGOS[network]} style={{ width: 22, height: 22 }} resizeMode="contain" />
                                ) : (
                                    <Ionicons name="call" size={18} color="#64748b" />
                                )}
                            </View>

                            <TextInput
                                style={styles.phoneInput}
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={handlePhoneChange}
                                placeholder="Misali: 08012345678"
                                placeholderTextColor="#94a3b8"
                                maxLength={11}
                                editable={!loading}
                                onFocus={() => setPhoneFocused(true)}
                                onBlur={() => setPhoneFocused(false)}
                            />

                            {/* "My Phone" 1-Tap shortcut */}
                            {Boolean(userPhone && phoneNumber !== userPhone) && (
                                <TouchableOpacity 
                                    onPress={() => {
                                        try { Haptics.selectionAsync(); } catch {}
                                        handlePhoneChange(userPhone || '');
                                    }}
                                    style={styles.mePill}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.mePillText}>Lamba Ta</Text>
                                </TouchableOpacity>
                            )}

                            {/* Beneficiary / Contacts picker */}
                            <TouchableOpacity 
                                onPress={() => setShowBeneficiaryModal(true)}
                                style={styles.contactBookBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="person-outline" size={17} color="#0d1b3e" />
                            </TouchableOpacity>
                        </View>

                        {/* Save Beneficiary Toggle */}
                        {Boolean(isPhoneComplete && !beneficiaries.find(b => b.account_number === phoneNumber)) && (
                            <View style={styles.saveBeneficiaryRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="bookmark-outline" size={15} color="#16a34a" />
                                    <Text style={styles.saveBeneficiaryText}>Ajiye wannan lambar a cikin Beneficiary</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                                    thumbColor={saveBeneficiary ? "#16a34a" : "#ffffff"}
                                    onValueChange={setSaveBeneficiary}
                                    value={saveBeneficiary}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>
                        )}
                    </View>

                    {/* 3. Amount & Presets */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.labelRow}>
                            <Text style={styles.sectionLabel}>Adadin Kudi (Amount)</Text>
                            {numAmount > 0 && (
                                <Text style={styles.cashbackHighlight}>
                                    Ragi: -₦{formatCurrency(discountSavings)} ({activeNetworkObj.cashback})
                                </Text>
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
                                placeholder="0.00"
                                placeholderTextColor="#cbd5e1"
                                editable={!loading}
                                onFocus={() => setAmountFocused(true)}
                                onBlur={() => setAmountFocused(false)}
                            />
                            {numAmount > 0 && (
                                <TouchableOpacity onPress={() => setAmount('')} style={{ padding: 4 }}>
                                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
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

                    {/* 4. Live Summary Card */}
                    {numAmount > 0 && (
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Katin da za a tura (Face Value):</Text>
                                <Text style={styles.summaryValue}>₦{formatCurrency(numAmount)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>
                                    Cashback Discount ({activeNetworkObj.cashback}):
                                </Text>
                                <Text style={[styles.summaryValue, { color: '#16a34a', fontWeight: '800' }]}>
                                    -₦{formatCurrency(discountSavings)}
                                </Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.totalPayableLabel}>Abin da zaka biya (Net To Pay):</Text>
                                <Text style={styles.totalPayableValue}>₦{formatCurrency(netPayable)}</Text>
                            </View>
                            
                            {/* Balance check prompt */}
                            {balance !== null && (
                                <View style={styles.balanceStatusWrap}>
                                    <Ionicons 
                                        name={isSufficientBalance ? "checkmark-circle" : "alert-circle"} 
                                        size={14} 
                                        color={isSufficientBalance ? "#16a34a" : "#dc2626"} 
                                    />
                                    <Text style={[styles.balanceStatusText, !isSufficientBalance && { color: '#dc2626' }]}>
                                        {isSufficientBalance 
                                            ? `Kudin asusunka ya isa (Balance: ₦${formatCurrency(balance)})`
                                            : `Kudin asusunka bai isa ba (Balance: ₦${formatCurrency(balance)})`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* 5. Main Action Button */}
                    <TouchableOpacity
                        onPress={handleInitiatePurchase}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                        style={{ marginTop: 10, marginBottom: 20 }}
                    >
                        <LinearGradient
                            colors={!canSubmit ? ['#cbd5e1', '#94a3b8'] : ['#060d21', '#0d1b3e', '#f5a623']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.payButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="lock-closed" size={17} color="#ffffff" />
                                    <Text style={styles.payButtonText}>
                                        {numAmount > 0 
                                            ? `Biya ₦${formatCurrency(netPayable)} Yanzu` 
                                            : "Shigar da Kudi domin Biya"}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Trust footer */}
                    <View style={styles.trustFooter}>
                        <Ionicons name="shield-checkmark" size={13} color="#94a3b8" />
                        <Text style={styles.trustFooterText}>Tabbatar da Tsaron Kudi & Bayanai ta Supabase da BigiSub</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Beneficiary Bottom Sheet Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showBeneficiaryModal}
                onRequestClose={() => {
                    setBeneficiarySearch('');
                    setShowBeneficiaryModal(false);
                }}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheet, isWeb && { maxWidth: 500, alignSelf: 'center', width: '100%' }]}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Zaɓi Lambar da aka Ajiye</Text>
                            <TouchableOpacity onPress={() => setShowBeneficiaryModal(false)}>
                                <Ionicons name="close" size={22} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalSearchBox}>
                            <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Bincika suna ko lamba..."
                                placeholderTextColor="#94a3b8"
                                value={beneficiarySearch}
                                onChangeText={setBeneficiarySearch}
                            />
                        </View>

                        <FlatList
                            data={beneficiaries.filter(b => 
                                (b.name || '').toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
                                (b.account_number || '').includes(beneficiarySearch)
                            )}
                            keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.beneficiaryListItem}
                                    onPress={() => {
                                        setPhoneNumber(item.account_number);
                                        detectNetwork(item.account_number);
                                        setShowBeneficiaryModal(false);
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
                                    <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>Babu lambar da aka ajiye tukuna</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Confirmation Modal */}
            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 300);
                }}
                title="Tabbatar da Sayen Kati"
                network={network || 'mtn'}
                details={[
                    { label: 'Aiki', value: 'Siyan Katin Waya (Airtime)' },
                    { label: 'Layin Sadarwa', value: activeNetworkObj.name },
                    { label: 'Lambar Waya', value: phoneNumber },
                    { label: 'Kudin Kati (Face Value)', value: `₦${formatCurrency(numAmount)}`, isAmount: true },
                    { label: `Ragi / Cashback (${(discountRate * 100).toFixed(0)}%)`, value: `-₦${formatCurrency(discountSavings)}`, isDiscount: true },
                    { label: 'Kudin da za a Cire a Wallet', value: `₦${formatCurrency(netPayable)}`, isTotal: true },
                ]}
            />

            {/* Security PIN Authorization Modal */}
            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                    processTransaction();
                }}
                title="Shigar da PIN na Tsaro"
                description={`Tabbatar da biyan ₦${formatCurrency(netPayable)} domin katin ${activeNetworkObj.name} na ${phoneNumber}`}
                requiredFor="purchase"
            />
        </View>
    );
}

export default function AirtimeScreen() {
    return (
        <ErrorBoundary 
            fallbackTitle="Airtime - Kuskure Wajen Budewa" 
            fallbackSubtitle="An samu dan tsaiko wajen nuna wannan shafin. Da fatan za a danna maballin da ke kasa domin sake gwadawa."
        >
            <AirtimeScreenContent />
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
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
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    headerSubtitle: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 1,
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingLeft: 10,
        paddingRight: 6,
        paddingVertical: 5,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        gap: 6,
    },
    balancePillText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    balancePlusWrap: {
        backgroundColor: '#f5a623',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 60,
    },
    guaranteeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 14,
        padding: 10,
        marginBottom: 16,
        gap: 10,
    },
    guaranteeIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#dcfce7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    guaranteeTitle: {
        color: '#15803d',
        fontSize: 11.5,
        fontWeight: '800',
    },
    guaranteeSubtitle: {
        color: '#166534',
        fontSize: 10,
        marginTop: 1,
        lineHeight: 14,
    },
    recentsSection: {
        marginBottom: 16,
    },
    recentItemChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    recentLogoWrap: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentPhoneText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    sectionContainer: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 8,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    validBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    validBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#16a34a',
    },
    cashbackHighlight: {
        fontSize: 11,
        fontWeight: '800',
        color: '#16a34a',
    },
    networksRow: {
        flexDirection: 'row',
        gap: 6,
    },
    networkCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    networkCardActive: {
        borderColor: '#0d1b3e',
        backgroundColor: 'rgba(13, 27, 62, 0.03)',
    },
    networkLogoContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    networkLogoContainerActive: {
        backgroundColor: '#ffffff',
    },
    networkLogoImage: {
        width: 24,
        height: 24,
    },
    networkCardName: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    networkCardNameActive: {
        color: '#0d1b3e',
        fontWeight: '900',
    },
    cashbackBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 4,
        marginTop: 3,
    },
    cashbackBadgeActive: {
        backgroundColor: '#fef3c7',
    },
    cashbackBadgeText: {
        fontSize: 8,
        fontWeight: '800',
        color: '#64748b',
    },
    cashbackBadgeTextActive: {
        color: '#b45309',
    },
    activeCheckmark: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#0d1b3e',
        width: 15,
        height: 15,
        borderRadius: 7.5,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        height: 48,
        paddingHorizontal: 12,
    },
    inputContainerFocused: {
        borderColor: '#0d1b3e',
    },
    inputContainerSuccess: {
        borderColor: '#16a34a',
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
        color: '#0f172a',
    },
    mePill: {
        backgroundColor: 'rgba(13, 27, 62, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 6,
    },
    mePillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    contactBookBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
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
        color: '#64748b',
        fontWeight: '600',
    },
    nairaSymbol: {
        fontSize: 18,
        fontWeight: '900',
        color: '#64748b',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    presetsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    presetChip: {
        width: '31.5%',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetChipActive: {
        backgroundColor: '#0d1b3e',
        borderColor: '#0d1b3e',
    },
    presetChipText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
    },
    presetChipTextActive: {
        color: '#ffffff',
        fontWeight: '900',
    },
    summaryCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 6,
    },
    totalPayableLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f172a',
    },
    totalPayableValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    balanceStatusWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    balanceStatusText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#16a34a',
    },
    payButton: {
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    payButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
    },
    trustFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    trustFooterText: {
        fontSize: 10,
        color: '#94a3b8',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        maxHeight: '65%',
        padding: 16,
    },
    modalSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalSheetTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        marginBottom: 12,
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
    },
    beneficiaryListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 10,
    },
    beneficiaryAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(13, 27, 62, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    beneficiaryAvatarText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    beneficiaryItemName: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    beneficiaryItemSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
});
