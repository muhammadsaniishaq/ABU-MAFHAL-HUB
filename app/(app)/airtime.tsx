import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, FlatList, Switch, StyleSheet, LayoutAnimation } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Network Assets & Data
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    glo: require('../../assets/images/glo.png'),
    airtel: require('../../assets/images/airtel.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
    vitel: require('../../assets/images/vitel.png'),
};

const NETWORKS_DATA = [
    { id: 'mtn', name: 'MTN', color: '#FFCC00', cashback: '2% Off', discountRate: 0.02, prefixes: ['0803', '0806', '0703', '0903', '0810', '0813', '0814', '0816', '0906', '0706', '0913', '0916'] },
    { id: 'glo', name: 'Glo', color: '#0F6A37', cashback: '3% Off', discountRate: 0.03, prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'] },
    { id: 'airtel', name: 'Airtel', color: '#FF0000', cashback: '2% Off', discountRate: 0.02, prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912'] },
    { id: '9mobile', name: '9mobile', color: '#006B3E', cashback: '3% Off', discountRate: 0.03, prefixes: ['0809', '0818', '0817', '0909', '0908'] },
    { id: 'vitel', name: 'VITEL', color: '#6366F1', cashback: '2% Off', discountRate: 0.02, prefixes: ['070', '091'] },
];

const getNetworkStyles = (netId: string, isSelected: boolean) => {
    if (!isSelected) {
        return {
            bg: '#ffffff',
            border: '#e2e8f0',
            text: '#334155',
            badgeBg: '#f1f5f9',
            badgeText: '#64748b',
            accent: '#64748b',
        };
    }
    switch (netId) {
        case 'mtn':
            return {
                bg: '#fffbeb',
                border: '#eab308',
                text: '#854d0e',
                badgeBg: '#fef3c7',
                badgeText: '#b45309',
                accent: '#eab308',
            };
        case 'airtel':
            return {
                bg: '#fef2f2',
                border: '#ef4444',
                text: '#991b1b',
                badgeBg: '#fee2e2',
                badgeText: '#b91c1c',
                accent: '#ef4444',
            };
        case 'glo':
            return {
                bg: '#f0fdf4',
                border: '#16a34a',
                text: '#166534',
                badgeBg: '#dcfce7',
                badgeText: '#15803d',
                accent: '#16a34a',
            };
        case '9mobile':
            return {
                bg: '#ecfdf5',
                border: '#059669',
                text: '#065f46',
                badgeBg: '#d1fae5',
                badgeText: '#047857',
                accent: '#059669',
            };
        case 'vitel':
            return {
                bg: '#eef2ff',
                border: '#6366f1',
                text: '#3730a3',
                badgeBg: '#e0e7ff',
                badgeText: '#4338ca',
                accent: '#6366f1',
            };
        default:
            return {
                bg: '#f1f5f9',
                border: '#475569',
                text: '#1e293b',
                badgeBg: '#e2e8f0',
                badgeText: '#334155',
                accent: '#475569',
            };
    }
};

const safeLayoutAnimation = () => {
    try {
        if (Platform.OS !== 'web') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
    } catch {
        // Safe animation fallback
    }
};

export default function AirtimeScreen() {
    const insets = useSafeAreaInsets();
    const headerTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 32 : 20) + 12;
    const [network, setNetwork] = useState('mtn');
    const [amount, setAmount] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [recents, setRecents] = useState<any[]>([]);
    
    // Modern Feature State
    const [userPhone, setUserPhone] = useState<string | null>(null);
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [savingBen, setSavingBen] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Advanced Fintech features states
    const [topupMode, setTopupMode] = useState<'direct' | 'pin'>('direct');
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [showUssdGuide, setShowUssdGuide] = useState(false);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');
    const [phoneFocused, setPhoneFocused] = useState(false);
    const [amountFocused, setAmountFocused] = useState(false);
    const [benSearchFocused, setBenSearchFocused] = useState(false);
    
    const router = useRouter();

    const presets = [100, 200, 500, 1000, 2000, 5000];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await Promise.allSettled([
                supabase.from('beneficiaries').select('*').eq('user_id', user.id).then(({ data: bens }) => {
                    if (bens) setBeneficiaries(bens);
                }),
                supabase.from('profiles').select('balance, phone').eq('id', user.id).single().then(({ data: profile }) => {
                    if (profile) {
                        setBalance(profile.balance);
                        if (profile.phone) setUserPhone(profile.phone);
                    }
                }),
                supabase.from('transactions').select('*').eq('user_id', user.id).eq('type', 'airtime').eq('status', 'success').order('created_at', { ascending: false }).limit(20).then(({ data: txns }) => {
                    if (txns) {
                        const uniqueRecents: any[] = [];
                        const seenPhones = new Set();
                        txns.forEach((t: any) => {
                            const match = t.description?.match(/:\s*(\w+)\s+([\d+]+)/);
                            if (match) {
                                const net = match[1].toLowerCase();
                                const pho = match[2];
                                if (!seenPhones.has(pho)) {
                                    seenPhones.add(pho);
                                    uniqueRecents.push({ id: t.id, network: net, phone: pho });
                                }
                            }
                        });
                        setRecents(uniqueRecents.slice(0, 5));
                    }
                })
            ]);
        }
    };

    // Auto-detect Network
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
        setPhoneNumber(text);
        detectNetwork(text);
    };

    // Helper to format amount
    const handleAmountChange = (text: string) => {
        // Remove non-numeric chars
        const clean = text.replace(/[^0-9]/g, '');
        setAmount(clean);
    };

    const handlePurchase = async () => {
        if (!network || !amount || phoneNumber.length < 10) return;

        if (balance !== null && Number(amount || 0) > Number(balance || 0)) {
            Alert.alert("Insufficient Funds", `Your wallet balance (₦${Number(balance || 0).toLocaleString()}) is insufficient for this transaction.`);
            return;
        }

        // Open Confirmation Modal instead of Security Modal directly
        setShowConfirmation(true);
    };

    const processTransaction = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");
            
            const activeNetwork = network || 'mtn';

            // Save Beneficiary if selected
            if (saveBeneficiary) {
                // Check if already exists to avoid dupes? (Primitive check)
                const exists = beneficiaries.find(b => b.account_number === phoneNumber);
                if (!exists) {
                    await supabase.from('beneficiaries').insert({
                        user_id: user.id,
                        name: `My ${activeNetwork.toUpperCase()} Line`, // Default Name
                        bank_name: activeNetwork.toUpperCase(), // Treat Network as Bank Name
                        account_number: phoneNumber
                    });
                }
            }

            const result = await api.airtime.purchase(user.id, {
                network: activeNetwork,
                phone: phoneNumber,
                amount: Number(amount || 0)
            });

            if (result.success) {
                // Send Notification
                await createAppNotification(
                    user.id,
                    "Airtime Purchase Successful",
                    `You have successfully purchased ₦${amount} airtime for ${phoneNumber} (${activeNetwork.toUpperCase()}).`,
                    "airtime",
                    "normal",
                    { route: "/(app)/history" }
                );

                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${Number(amount || 0).toLocaleString()}`,
                        type: 'Airtime Purchase',
                        reference: result.reference
                    }
                });
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Something went wrong");
        } finally {
            setLoading(false);
            setShowSecurityModal(false);
        }
    };

    const isWeb = Platform.OS === 'web';

    const renderBeneficiaryModal = () => {
        const filteredBens = beneficiaries.filter(b => 
            (b.name || '').toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
            (b.account_number || '').includes(beneficiarySearch)
        );

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showBeneficiaryModal}
                onRequestClose={() => {
                    setBeneficiarySearch('');
                    setShowBeneficiaryModal(false);
                }}
            >
                <View style={s.modalOverlay}>
                    <View 
                        style={[
                            s.modalContentContainer,
                            isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450 }
                        ]}
                    >
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Select Beneficiary</Text>
                            <TouchableOpacity onPress={() => {
                                setBeneficiarySearch('');
                                setShowBeneficiaryModal(false);
                            }}>
                                <Ionicons name="close-circle" size={26} color="#9ca3af" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[
                                s.modalSearchInput,
                                benSearchFocused && { borderColor: '#0d1b3e' }
                            ]}
                            placeholder="Search beneficiary..."
                            placeholderTextColor="#94a3b8"
                            value={beneficiarySearch}
                            onChangeText={setBeneficiarySearch}
                            onFocus={() => setBenSearchFocused(true)}
                            onBlur={() => setBenSearchFocused(false)}
                        />
                        
                        <FlatList
                            data={filteredBens}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={s.beneficiaryItem}
                                    onPress={() => {
                                        setPhoneNumber(item.account_number); // Using account_number as phone
                                        detectNetwork(item.account_number);
                                        setBeneficiarySearch('');
                                        setShowBeneficiaryModal(false);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.beneficiaryAvatar}>
                                        <Text style={s.beneficiaryAvatarText}>{item.name ? item.name[0].toUpperCase() : 'B'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.beneficiaryName}>{item.name}</Text>
                                        <Text style={s.beneficiarySubtext}>{item.bank_name} - {item.account_number}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={s.modalEmptyState}>
                                    <Text style={s.modalEmptyStateText}>No beneficiaries found</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f4f6fb' }}>
            <StatusBar style="light" />
            
            {/* Premium Curved Header */}
            <LinearGradient 
                colors={['#060d21', '#0d1b3e']} 
                style={[
                    s.headerContainer,
                    { paddingTop: headerTopPadding },
                    isWeb && s.webPageContainer
                ]}
            >
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={s.headerTitle}>Buy Airtime</Text>
                        {balance !== null && (
                            <View style={s.balanceBadge}>
                                <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                <Text style={s.headerBalance}>
                                    ₦{Number(balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={{ width: 36 }} />
                </View>
            </LinearGradient>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 bg-gray-50"
                style={isWeb && { backgroundColor: '#f4f6fb' }}
            >
                <ScrollView 
                    style={isWeb ? { alignSelf: 'center', width: '100%', maxWidth: 450 } : { flex: 1 }}
                    contentContainerStyle={[
                        { padding: 16, paddingBottom: 130, paddingTop: 14 },
                        isWeb && { backgroundColor: '#ffffff', minHeight: '100%', shadowColor: '#0a1633', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }
                    ]}
                >
                
                {/* Balance Display - Modern Gradient */}
                {balance !== null && (
                    <LinearGradient
                        colors={['#0d1b3e', '#142258']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.balanceCardGradient}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={s.balanceLabel}>Total Balance</Text>
                            <Text style={s.balanceAmount}>₦{Number(balance || 0).toLocaleString()}</Text>
                            
                            {/* Cashback Savings Badge Decoration */}
                            <View style={s.savingsBadge}>
                                <Ionicons name="sparkles" size={10} color="#f5a623" style={{ marginRight: 4 }} />
                                <Text style={s.savingsBadgeText}>Earn up to 3% cashback instantly!</Text>
                            </View>
                        </View>
                        <View style={s.balanceIconContainer}>
                            <Ionicons name="wallet-outline" size={20} color="#f5a623" />
                        </View>
                    </LinearGradient>
                )}

                {/* Dynamic Banners */}
                <DynamicBanners placement="airtime" />

                {/* Recent Top-ups */}
                {recents.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>Recent Top-ups</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                            {recents.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => {
                                        setPhoneNumber(item.phone);
                                        detectNetwork(item.phone);
                                    }}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderWidth: 1,
                                        borderColor: '#e2e8f0',
                                        borderRadius: 14,
                                        paddingHorizontal: 10,
                                        paddingVertical: 7,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.04,
                                        shadowRadius: 3,
                                        elevation: 1,
                                    }}
                                    activeOpacity={0.75}
                                >
                                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
                                        {NETWORK_LOGOS[item.network] ? (
                                            <Image source={NETWORK_LOGOS[item.network]} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                        ) : (
                                            <Ionicons name="person" size={14} color="#94a3b8" />
                                        )}
                                    </View>
                                    <View>
                                        <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 11.5 }}>{item.phone}</Text>
                                        <Text style={{ color: '#64748b', fontSize: 9.5, fontWeight: '600', textTransform: 'capitalize' }}>{item.network}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Network Section */}
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d1b3e', marginBottom: 10, marginLeft: 4 }}>Select Network</Text>
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 4, marginBottom: 16 }}>
                    {NETWORKS_DATA.map((net) => {
                        const isSelected = network === net.id;
                        const nStyles = getNetworkStyles(net.id, isSelected);
                        return (
                            <TouchableOpacity
                                key={net.id}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    paddingHorizontal: 2,
                                    borderRadius: 14,
                                    backgroundColor: nStyles.bg,
                                    borderWidth: 1.5,
                                    borderColor: nStyles.border,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: isSelected ? 0.08 : 0.02,
                                    shadowRadius: 4,
                                    elevation: isSelected ? 3 : 1,
                                    position: 'relative'
                                }}
                                onPress={() => {
                                    safeLayoutAnimation();
                                    setNetwork(net.id);
                                }}
                                activeOpacity={0.8}
                            >
                                <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', marginBottom: 4 }}>
                                    <Image 
                                        source={NETWORK_LOGOS[net.id] || NETWORK_LOGOS.mtn} 
                                        style={{ width: '100%', height: '100%' }} 
                                        resizeMode="contain" 
                                    />
                                </View>
                                <Text style={{ fontSize: 10, fontWeight: isSelected ? '800' : '600', color: nStyles.text, textAlign: 'center' }} numberOfLines={1}>
                                    {net.name}
                                </Text>
                                <View style={{ backgroundColor: nStyles.badgeBg, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, marginTop: 3 }}>
                                    <Text style={{ fontSize: 7.5, fontWeight: '800', color: nStyles.badgeText }}>{net.cashback}</Text>
                                </View>
                                {isSelected && (
                                    <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: nStyles.accent, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                                        <Ionicons name="checkmark" size={8} color="white" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Top-up Mode (Direct vs PIN) */}
                <View style={s.modeSelectorContainer}>
                    <TouchableOpacity 
                        style={[s.modeButton, topupMode === 'direct' && s.modeButtonActive]}
                        onPress={() => {
                            safeLayoutAnimation();
                            setTopupMode('direct');
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="flash-outline" size={14} color={topupMode === 'direct' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                        <Text style={[s.modeButtonText, topupMode === 'direct' && s.modeButtonTextActive]}>Direct Recharge</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[s.modeButton, topupMode === 'pin' && s.modeButtonActive]}
                        onPress={() => {
                            safeLayoutAnimation();
                            setTopupMode('pin');
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="card-outline" size={14} color={topupMode === 'pin' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                        <Text style={[s.modeButtonText, topupMode === 'pin' && s.modeButtonTextActive]}>Buy PIN / Voucher</Text>
                    </TouchableOpacity>
                </View>

                {/* Phone Input */}
                <Text style={s.inputLabel}>Phone Number</Text>
                <View style={[
                    s.inputContainer,
                    phoneFocused && s.inputContainerFocused,
                    phoneNumber.length >= 10 && s.inputContainerSuccess
                ]}>
                    <View style={s.inputIconWrapper}>
                        {network && NETWORK_LOGOS[network] ? (
                            <Image source={NETWORK_LOGOS[network]} style={s.inputNetworkLogo as any} resizeMode="contain" />
                        ) : (
                             <Ionicons name="call" size={18} color="#64748b" />
                        )}
                    </View>
                    <TextInput
                        style={s.phoneTextInput}
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={handlePhoneChange}
                        placeholder="08012345678"
                        placeholderTextColor="#94a3b8"
                        maxLength={11}
                        editable={!loading}
                        onFocus={() => setPhoneFocused(true)}
                        onBlur={() => setPhoneFocused(false)}
                    />
                    {userPhone && phoneNumber !== userPhone && (
                        <TouchableOpacity 
                            onPress={() => {
                                handlePhoneChange(userPhone);
                            }}
                            style={s.meButton}
                        >
                            <Text style={s.meButtonText}>ME</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                        onPress={() => setShowBeneficiaryModal(true)}
                        style={s.beneficiarySelectButton}
                    >
                        <Ionicons name="people" size={20} color="#0d1b3e" />
                    </TouchableOpacity>
                </View>

                {/* Save Beneficiary Toggle */}
                {phoneNumber.length >= 10 && !beneficiaries.find(b => b.account_number === phoneNumber) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Ionicons name="save-outline" size={16} color="#16a34a" />
                            </View>
                            <View>
                                <Text style={{ fontWeight: '800', color: '#0f172a', fontSize: 12 }}>Save Contact</Text>
                                <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '500' }}>Save for faster top-ups next time</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
                            thumbColor={saveBeneficiary ? "#16A34A" : "#FFFFFF"}
                            onValueChange={setSaveBeneficiary}
                            value={saveBeneficiary}
                        />
                    </View>
                )}

                {/* Amount Input */}
                <Text style={s.inputLabel}>Amount</Text>
                <View style={[
                    s.inputContainer,
                    amountFocused && s.inputContainerFocused,
                    Number(amount) > 0 && s.inputContainerSuccess
                ]}>
                    <Text style={s.currencySymbol}>₦</Text>
                    <TextInput
                        style={s.amountTextInput}
                        keyboardType="number-pad"
                        value={amount}
                        onChangeText={handleAmountChange}
                        placeholder="0.00"
                        placeholderTextColor="#cbd5e1"
                        editable={!loading}
                        onFocus={() => setAmountFocused(true)}
                        onBlur={() => setAmountFocused(false)}
                    />
                </View>

                {/* Features: Amount Presets Grid */}
                <Text style={s.presetsLabel}>Quick Select Amount</Text>
                <View style={s.presetsGrid}>
                    {presets.map((val) => {
                        const isSelected = amount === val.toString();
                        return (
                            <TouchableOpacity
                                key={val}
                                onPress={() => setAmount(val.toString())}
                                style={[
                                    s.presetCard,
                                    isSelected && s.presetCardActive
                                ]}
                                activeOpacity={0.75}
                            >
                                <Text style={[
                                    s.presetText,
                                    isSelected && s.presetTextActive
                                ]}>₦{val}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Real-time Savings Estimator Card */}
                {network && amount && Number(amount) > 0 && (
                    <View style={s.estimatorContainer}>
                        <View style={s.estimatorHeader}>
                            <Ionicons name="sparkles" size={15} color="#d97706" style={{ marginRight: 6 }} />
                            <Text style={s.estimatorTitle}>Real-Time Savings Estimator</Text>
                        </View>
                        <View style={s.estimatorDivider} />
                        <View style={s.estimatorRow}>
                            <Text style={s.estimatorLabel}>Original Price:</Text>
                            <Text style={s.estimatorValue}>₦{Number(amount || 0).toLocaleString()}</Text>
                        </View>
                        <View style={s.estimatorRow}>
                            <Text style={s.estimatorLabel}>Cashback Discount ({NETWORKS_DATA.find(n => n.id === network)?.cashback || '2% Off'}):</Text>
                            <Text style={[s.estimatorValue, { color: '#16a34a' }]}>-₦{(Number(amount || 0) * (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02)).toLocaleString()}</Text>
                        </View>
                        <View style={s.estimatorRow}>
                            <Text style={s.estimatorLabelTotal}>You Pay:</Text>
                            <Text style={s.estimatorValueTotal}>₦{(Number(amount || 0) * (1 - (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02))).toLocaleString()}</Text>
                        </View>
                        <View style={[s.estimatorBadge, { backgroundColor: '#fef3c7' }]}>
                            <Text style={s.estimatorBadgeText}>🎉 Saved ₦{(Number(amount || 0) * (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02)).toLocaleString()} with {NETWORKS_DATA.find(n => n.id === network)?.name || (network || 'MTN').toUpperCase()} Smart Top-up!</Text>
                        </View>
                    </View>
                )}

                {/* Auto-Refill Schedule Planner */}
                <View style={s.scheduleContainer}>
                    <TouchableOpacity 
                        onPress={() => {
                            safeLayoutAnimation();
                            setScheduleEnabled(!scheduleEnabled);
                        }}
                        style={s.scheduleHeader}
                        activeOpacity={0.8}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="time-outline" size={18} color="#2563eb" style={{ marginRight: 8 }} />
                            <View>
                                <Text style={s.scheduleHeaderTitle}>Auto-Refill Schedule Planner 🕒</Text>
                                <Text style={s.scheduleHeaderSub}>{scheduleEnabled ? 'Enabled - Recurrence active' : 'Disabled - Top-up once'}</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#E2E8F0", true: "#bfdbfe" }}
                            thumbColor={scheduleEnabled ? "#2563eb" : "#f4f3f4"}
                            onValueChange={(val) => {
                                safeLayoutAnimation();
                                setScheduleEnabled(val);
                            }}
                            value={scheduleEnabled}
                        />
                    </TouchableOpacity>

                    {scheduleEnabled && (
                        <View style={s.scheduleContent}>
                            <Text style={s.scheduleLabel}>Select Recurrence Frequency:</Text>
                            <View style={s.freqButtons}>
                                {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                                    <TouchableOpacity
                                        key={freq}
                                        onPress={() => setScheduleFrequency(freq)}
                                        style={[s.freqButton, scheduleFrequency === freq && s.freqButtonActive]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.freqButtonText, scheduleFrequency === freq && s.freqButtonTextActive]}>
                                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={s.scheduleHint}>
                                {scheduleFrequency === 'daily' && '🚀 We will recharge this line every day at 8:00 AM.'}
                                {scheduleFrequency === 'weekly' && '📅 We will recharge this line every Monday morning at 8:00 AM.'}
                                {scheduleFrequency === 'monthly' && '📆 We will recharge this line on the 1st of every month at 8:00 AM.'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* USSD shortcut codes collapsible guide */}
                <View style={s.ussdContainer}>
                    <TouchableOpacity 
                        onPress={() => {
                            safeLayoutAnimation();
                            setShowUssdGuide(!showUssdGuide);
                        }}
                        style={s.ussdHeader}
                        activeOpacity={0.8}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="information-circle-outline" size={18} color="#0d9488" style={{ marginRight: 8 }} />
                            <Text style={s.ussdHeaderTitle}>Airtime USSD & Quick Guide 📲</Text>
                        </View>
                        <Ionicons 
                            name={showUssdGuide ? "chevron-up" : "chevron-down"} 
                            size={16} 
                            color="#64748b" 
                        />
                    </TouchableOpacity>

                    {showUssdGuide && (
                        <View style={s.ussdContent}>
                            <Text style={s.ussdText}>
                                Quickly check your balance and perform other operations using these official network codes:
                            </Text>
                            <View style={s.ussdGrid}>
                                <View style={s.ussdRow}>
                                    <Text style={s.ussdNetwork}>MTN</Text>
                                    <Text style={s.ussdCode}>*310# (Check Balance)</Text>
                                </View>
                                <View style={s.ussdRow}>
                                    <Text style={s.ussdNetwork}>Airtel</Text>
                                    <Text style={s.ussdCode}>*310# (Check Balance)</Text>
                                </View>
                                <View style={s.ussdRow}>
                                    <Text style={s.ussdNetwork}>Glo</Text>
                                    <Text style={s.ussdCode}>*310# (Check Balance)</Text>
                                </View>
                                <View style={s.ussdRow}>
                                    <Text style={s.ussdNetwork}>9mobile</Text>
                                    <Text style={s.ussdCode}>*232# (Check Balance)</Text>
                                </View>
                            </View>
                            <Text style={[s.ussdText, { fontStyle: 'italic', marginTop: 8, color: '#0d9488' }]}>
                                Dial the code directly on your mobile dialer to query.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Purchase Button - Modern Gradient */}
                <TouchableOpacity
                    onPress={handlePurchase}
                    disabled={!network || !amount || phoneNumber.length < 10 || loading}
                    activeOpacity={0.8}
                    style={s.purchaseButtonWrapper}
                >
                    <LinearGradient
                        colors={ (!network || !amount || phoneNumber.length < 10 || loading) 
                             ? ['#e2e8f0', '#cbd5e1'] // Disabled Gray
                             : ['#0d1b3e', '#142258', '#f5a623'] // Premium Brand Gradient
                        }
                        style={s.purchaseButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                             <>
                                <Text style={[
                                    s.purchaseButtonText,
                                    (!network || !amount || phoneNumber.length < 10) && s.purchaseButtonTextDisabled
                                ]}>
                                    Pay securely
                                </Text>
                                <Ionicons 
                                    name="lock-closed" 
                                    size={18} 
                                    color={(!network || !amount || phoneNumber.length < 10) ? '#94a3b8' : 'white'} 
                                />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={s.securityFooter}>
                    <Ionicons name="shield-checkmark" size={14} color="#9ca3af" style={{ marginRight: 4 }} />
                    <Text style={s.securityFooterText}>Secured by Flutterwave & Paystack</Text>
                </View>

            </ScrollView>

            {renderBeneficiaryModal()}
            
            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                title="Confirm Airtime Purchase"
                network={network || 'mtn'}
                details={[
                    { label: 'Transaction Type', value: 'Airtime Top-up' },
                    { label: 'Recharge Type', value: topupMode === 'direct' ? 'Direct Recharge (Pinless)' : 'PIN Voucher (Recharge Code)' },
                    { label: 'Network', value: NETWORKS_DATA.find(n => n.id === network)?.name || (network || 'MTN').toUpperCase() },
                    { label: 'Phone Number', value: phoneNumber },
                    { label: 'Original Amount', value: `₦${Number(amount || 0).toLocaleString()}`, isAmount: true },
                    { label: `Discount (${((NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02) * 100).toFixed(0)}%)`, value: `-₦${(Number(amount || 0) * (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02)).toLocaleString()}`, isDiscount: true },
                    { label: 'Total To Pay', value: `₦${(Number(amount || 0) * (1 - (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02))).toLocaleString()}`, isTotal: true },
                ]}
            />
            
            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                   processTransaction();
                }}
                title="Authorize Purchase"
                description={`Confirm ${(network || 'MTN').toUpperCase()} Airtime\nTop-up of ₦${Number(amount || 0).toLocaleString()}`}
                requiredFor="purchase"
            />
        </KeyboardAvoidingView>
    </View>
    );
}

const s = StyleSheet.create({
  headerContainer: {
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 16,
    width: '100%',
  },
  webPageContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 450,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  headerBalance: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  networksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    width: '100%',
  },
  networkCard: {
    width: '22.5%',
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  networkCardSelected: {
    backgroundColor: 'rgba(13, 27, 62, 0.04)',
    borderColor: '#0d1b3e',
  },
  networkLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
  },
  networkName: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
  },
  networkNameSelected: {
    color: '#0d1b3e',
  },
  cashbackBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 4,
  },
  cashbackText: {
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  checkmarkBubble: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mode Selector (Segmented Control)
  modeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
    width: '100%',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#0d1b3e',
  },
  modeButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  // Estimator Card
  estimatorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    width: '100%',
  },
  estimatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  estimatorTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  estimatorDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  estimatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  estimatorLabel: {
    fontSize: 10.5,
    color: '#64748b',
  },
  estimatorValue: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0d1b3e',
  },
  estimatorLabelTotal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  estimatorValueTotal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0d1b3e',
  },
  estimatorBadge: {
    marginTop: 8,
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  estimatorBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b45309',
  },
  // Auto-Refill Card
  scheduleContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    overflow: 'hidden',
    width: '100%',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  scheduleHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  scheduleHeaderSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  scheduleContent: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fafbfc',
  },
  scheduleLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  freqButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  freqButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  freqButtonActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderColor: '#0d1b3e',
  },
  freqButtonText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  freqButtonTextActive: {
    color: '#0d1b3e',
  },
  scheduleHint: {
    fontSize: 9.5,
    color: '#0d1b3e',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // USSD Card
  ussdContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    overflow: 'hidden',
    width: '100%',
  },
  ussdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f0fdfa',
  },
  ussdHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f766e',
  },
  ussdContent: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ccfbf1',
  },
  ussdText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 13,
  },
  ussdGrid: {
    marginTop: 6,
  },
  ussdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  ussdNetwork: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  ussdCode: {
    fontSize: 10,
    color: '#475569',
  },
  // Beneficiary Modal Search
  modalSearchInput: {
    height: 38,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  // New Modern Styles
  balanceCardGradient: {
    marginBottom: 20,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  balanceLabel: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  balanceAmount: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  balanceIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d1b3e',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: '#ffffff',
    marginBottom: 18,
  },
  inputContainerFocused: {
    borderColor: '#0d1b3e',
  },
  inputContainerSuccess: {
    borderColor: '#16a34a',
  },
  inputIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  inputNetworkLogo: {
    width: '100%',
    height: '100%',
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0d1b3e',
  },
  meButton: {
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(13, 27, 62, 0.08)',
    borderRadius: 6,
  },
  meButtonText: {
    color: '#0d1b3e',
    fontWeight: '700',
    fontSize: 10.5,
  },
  beneficiarySelectButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 17,
  },
  currencySymbol: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  amountTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    marginLeft: 4,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  presetCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    width: '31%',
    paddingVertical: 8,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  presetCardActive: {
    backgroundColor: '#0d1b3e',
    borderColor: '#0d1b3e',
  },
  presetText: {
    color: '#0d1b3e',
    fontWeight: '700',
    fontSize: 13,
  },
  presetTextActive: {
    color: '#ffffff',
  },
  purchaseButtonWrapper: {
    width: '100%',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  purchaseButtonGradient: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  purchaseButtonText: {
    fontWeight: '700',
    fontSize: 15,
    color: '#ffffff',
    marginRight: 6,
  },
  purchaseButtonTextDisabled: {
    color: '#94a3b8',
  },
  securityFooter: {
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  securityFooterText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  savingsBadgeText: {
    color: '#f5a623',
    fontSize: 9,
    fontWeight: '700',
  },
  // Modal Enhancements
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  beneficiaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  beneficiaryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(13, 27, 62, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  beneficiaryAvatarText: {
    color: '#0d1b3e',
    fontWeight: '800',
    fontSize: 14,
  },
  beneficiaryName: {
    fontWeight: '700',
    fontSize: 14,
    color: '#0d1b3e',
  },
  beneficiarySubtext: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  modalEmptyStateText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
