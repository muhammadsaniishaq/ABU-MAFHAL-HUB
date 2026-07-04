import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, FlatList, Switch, StyleSheet, LayoutAnimation } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../../services/api';
import { supabase } from '../../../services/supabase';
import SecurityModal from '../../../components/SecurityModal';
import TransactionConfirmationModal from '../../../components/TransactionConfirmationModal';

// Network Assets & Data
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    glo: require('../../assets/images/glo.png'),
    airtel: require('../../assets/images/airtel.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
};

const NETWORKS_DATA = [
    { id: 'mtn', name: 'MTN', color: '#FFCC00', cashback: '2% Off', discountRate: 0.02, prefixes: ['0803', '0806', '0703', '0903', '0810', '0813', '0814', '0816', '0906', '0706', '0913', '0916'] },
    { id: 'glo', name: 'Glo', color: '#0F6A37', cashback: '3% Off', discountRate: 0.03, prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'] },
    { id: 'airtel', name: 'Airtel', color: '#FF0000', cashback: '2% Off', discountRate: 0.02, prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912'] },
    { id: '9mobile', name: '9mobile', color: '#006B3E', cashback: '3% Off', discountRate: 0.03, prefixes: ['0809', '0818', '0817', '0909', '0908'] },
];

export default function AirtimeScreen() {
    const [network, setNetwork] = useState('');
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
    
    const router = useRouter();

    const presets = [100, 200, 500, 1000, 2000, 5000];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Fetch Beneficiaries
            const { data: bens } = await supabase.from('beneficiaries').select('*').eq('user_id', user.id);
            if (bens) setBeneficiaries(bens);

            // Fetch Balance & Profile Info
            const { data: profile } = await supabase.from('profiles').select('balance, phone').eq('id', user.id).single();
            if (profile) {
                setBalance(profile.balance);
                if (profile.phone) setUserPhone(profile.phone);
            }

            // Fetch Recents (Success Airtime Txns)
            const { data: txns } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .eq('type', 'airtime')
                .eq('status', 'success')
                .order('created_at', { ascending: false })
                .limit(20);

            if (txns) {
                const uniqueRecents: any[] = [];
                const seenPhones = new Set();
                
                txns.forEach((t: any) => {
                    // Desc format: "Airtime Purchase: MTN 080..."
                    const match = t.description?.match(/:\s*(\w+)\s+([\d+]+)/);
                    if (match) {
                        const net = match[1].toLowerCase(); // 'mtn'
                        const pho = match[2];
                        if (!seenPhones.has(pho)) {
                            seenPhones.add(pho);
                            uniqueRecents.push({ id: t.id, network: net, phone: pho });
                        }
                    }
                });
                setRecents(uniqueRecents.slice(0, 5)); // Keep top 5
            }
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

        if (balance !== null && Number(amount) > balance) {
            Alert.alert("Insufficient Funds", `Your wallet balance (₦${balance.toLocaleString()}) is insufficient for this transaction.`);
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
            
            // Save Beneficiary if selected
            if (saveBeneficiary) {
                // Check if already exists to avoid dupes? (Primitive check)
                const exists = beneficiaries.find(b => b.account_number === phoneNumber);
                if (!exists) {
                    await supabase.from('beneficiaries').insert({
                        user_id: user.id,
                        name: `My ${network.toUpperCase()} Line`, // Default Name
                        bank_name: network.toUpperCase(), // Treat Network as Bank Name
                        account_number: phoneNumber
                    });
                }
            }

            const result = await api.airtime.purchase(user.id, {
                network,
                phone: phoneNumber,
                amount: Number(amount)
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${Number(amount).toLocaleString()}`,
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

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-gray-50"
            style={isWeb && { backgroundColor: '#f4f6fb' }}
        >
            <Stack.Screen options={{ title: 'Buy Airtime', headerTintColor: '#0d1b3e', headerStyle: { backgroundColor: '#fff' }, headerShadowVisible: false }} />
            <StatusBar style="dark" />

            <ScrollView 
                style={isWeb ? { alignSelf: 'center', width: '100%', maxWidth: 450 } : { flex: 1 }}
                contentContainerStyle={[
                    { padding: 24, paddingBottom: 40, paddingTop: 100 },
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
                            <Text style={s.balanceAmount}>₦{balance.toLocaleString()}</Text>
                            
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

                {/* Promotions Carousel */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8 -mx-2">
                    {[
                        { id: 1, title: '2% Cashback', sub: 'On all MTN Airtime', color: '#FFCC00', text: '#000' },
                        { id: 2, title: 'Zero Fees', sub: 'Instant top-up', color: '#10B981', text: '#fff' },
                        { id: 3, title: 'N500 Bonus', sub: 'Refer a friend', color: '#8B5CF6', text: '#fff' }
                    ].map((promo, idx) => (
                        <View key={promo.id} className={`w-36 h-20 rounded-2xl p-3 justify-center mx-2 shadow-sm`} style={{ backgroundColor: promo.color }}>
                            <Text className="font-bold text-lg" style={{ color: promo.text }}>{promo.title}</Text>
                            <Text className="text-xs opacity-80" style={{ color: promo.text }}>{promo.sub}</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Recent Top-ups */}
                {recents.length > 0 && (
                    <View className="mb-6">
                        <Text className="text-gray-500 font-medium mb-3 text-sm ml-1">Recent Top-ups</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {recents.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => {
                                        setPhoneNumber(item.phone);
                                        detectNetwork(item.phone); // Auto-set network
                                    }}
                                    className="bg-white border border-gray-100 rounded-2xl p-3 mr-3 shadow-sm flex-row items-center space-x-2"
                                >
                                    <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center border border-gray-200 overflow-hidden">
                                        {NETWORK_LOGOS[item.network] ? (
                                            <Image source={NETWORK_LOGOS[item.network]} className="w-full h-full" resizeMode="cover" />
                                        ) : (
                                            <Ionicons name="person" size={14} color="#9CA3AF" />
                                        )}
                                    </View>
                                    <View>
                                        <Text className="text-gray-800 font-bold text-xs">{item.phone}</Text>
                                        <Text className="text-gray-400 text-[10px] capitalize">{item.network}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Network Section */}
                <Text className="text-gray-800 font-bold text-lg mb-4">Select Network</Text>
                <View style={s.networksContainer}>
                    {NETWORKS_DATA.map((net) => (
                        <TouchableOpacity
                            key={net.id}
                            style={[
                                s.networkCard,
                                network === net.id && s.networkCardSelected,
                                network === net.id && { borderColor: net.color }
                            ]}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setNetwork(net.id);
                            }}
                            activeOpacity={0.7}
                        >
                            <Image 
                                source={NETWORK_LOGOS[net.id]} 
                                style={s.networkLogo as any} 
                                resizeMode="contain" 
                            />
                            {network === net.id && (
                                <View style={[s.checkmarkBubble, { backgroundColor: net.color }]}>
                                    <Ionicons name="checkmark" size={9} color="white" />
                                </View>
                            )}
                            <Text style={[s.networkName, network === net.id && s.networkNameSelected, network === net.id && { color: net.color }]}>
                                {net.name}
                            </Text>
                            <View style={[s.cashbackBadge, { backgroundColor: net.color + '15' }]}>
                                <Text style={[s.cashbackText, { color: net.color }]}>{net.cashback}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Top-up Mode (Direct vs PIN) */}
                <View style={s.modeSelectorContainer}>
                    <TouchableOpacity 
                        style={[s.modeButton, topupMode === 'direct' && s.modeButtonActive]}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
                        {network ? (
                            <Image source={NETWORK_LOGOS[network]} style={s.inputNetworkLogo as any} resizeMode="cover" />
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
                {/* Only show if phone is valid and NOT already in beneficiaries (simple check) */}
                {phoneNumber.length >= 10 && !beneficiaries.find(b => b.account_number === phoneNumber) && (
                    <View className="flex-row items-center justify-between mb-8 bg-gray-50 border border-gray-100 p-4 rounded-xl">
                        <View className="flex-row items-center">
                            <View className="bg-green-100 p-2 rounded-full mr-3">
                                <Ionicons name="save-outline" size={18} color="#166534" />
                            </View>
                            <View>
                                <Text className="font-semibold text-gray-700">Save Contact</Text>
                                <Text className="text-xs text-gray-500">Save for next time</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#E2E8F0", true: "#BBF7D0" }}
                            thumbColor={saveBeneficiary ? "#22C55E" : "#f4f3f4"}
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
                            <Text style={s.estimatorValue}>₦{Number(amount).toLocaleString()}</Text>
                        </View>
                        <View style={s.estimatorRow}>
                            <Text style={s.estimatorLabel}>Cashback Discount ({NETWORKS_DATA.find(n => n.id === network)?.cashback}):</Text>
                            <Text style={[s.estimatorValue, { color: '#16a34a' }]}>-₦{(Number(amount) * (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02)).toLocaleString()}</Text>
                        </View>
                        <View style={s.estimatorRow}>
                            <Text style={s.estimatorLabelTotal}>You Pay:</Text>
                            <Text style={s.estimatorValueTotal}>₦{(Number(amount) * (1 - (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02))).toLocaleString()}</Text>
                        </View>
                        <View style={[s.estimatorBadge, { backgroundColor: '#fef3c7' }]}>
                            <Text style={s.estimatorBadgeText}>🎉 Saved ₦{(Number(amount) * (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02)).toLocaleString()} with {NETWORKS_DATA.find(n => n.id === network)?.name} Smart Top-up!</Text>
                        </View>
                    </View>
                )}

                {/* Auto-Refill Schedule Planner */}
                <View style={s.scheduleContainer}>
                    <TouchableOpacity 
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

            <BeneficiaryModal />
            
            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                title="Confirm Airtime Purchase"
                network={network}
                details={[
                    { label: 'Transaction Type', value: 'Airtime Top-up' },
                    { label: 'Recharge Type', value: topupMode === 'direct' ? 'Direct Recharge (Pinless)' : 'PIN Voucher (Recharge Code)' },
                    { label: 'Network', value: NETWORKS_DATA.find(n => n.id === network)?.name || network },
                    { label: 'Phone Number', value: phoneNumber },
                    { label: 'Original Amount', value: `₦${Number(amount).toLocaleString()}`, isAmount: true },
                    { label: `Discount (${((NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02) * 100).toFixed(0)}%)`, value: `-₦${(Number(amount) * (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02)).toLocaleString()}`, isDiscount: true },
                    { label: 'Total To Pay', value: `₦${(Number(amount) * (1 - (NETWORKS_DATA.find(n => n.id === network)?.discountRate || 0.02))).toLocaleString()}`, isTotal: true },
                ]}
            />
            
            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                   processTransaction();
                }}
                title="Authorize Purchase"
                description={`Confirm ${network.toUpperCase()} Airtime\nTop-up of ₦${Number(amount).toLocaleString()}`}
                requiredFor="purchase"
            />
        </KeyboardAvoidingView>
    );

    function BeneficiaryModal() {
        const filteredBens = beneficiaries.filter(b => 
            (b.name || '').toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
            (b.account_number || '').includes(beneficiarySearch)
        );
        const [searchFocused, setSearchFocused] = useState(false);

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
                                searchFocused && { borderColor: '#0d1b3e' }
                            ]}
                            placeholder="Search beneficiary..."
                            placeholderTextColor="#94a3b8"
                            value={beneficiarySearch}
                            onChangeText={setBeneficiarySearch}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
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
    }
}

const s = StyleSheet.create({
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
