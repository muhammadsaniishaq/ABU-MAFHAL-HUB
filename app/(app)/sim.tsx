import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import { KetawancyService, KetawancySimPlan } from '../../services/ketawancy';
import SecurityModal from '../../components/SecurityModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SIM_NETWORKS_META: Record<string, {
    logo: any;
    color: string;
    lightBg: string;
    tag: string;
    speed: string;
    features: string[];
}> = {
    ratel: {
        logo: require('../../assets/images/ratel_alat.png'),
        color: '#D97706',
        lightBg: '#FEF3C7',
        tag: 'Instant 4G/LTE',
        speed: 'High Speed LTE',
        features: ['Instant Activation', 'Voice & Unlimited Data', 'Nigeria Roaming Ready']
    },
    kirani: {
        logo: require('../../assets/images/kirani.png'),
        color: '#2563EB',
        lightBg: '#EFF6FF',
        tag: 'Fast 4G Broadband',
        speed: 'Multi-band 4G',
        features: ['Nationwide Coverage', 'HD Voice & Minute Bundles', 'Pre-activated eSIM/SIM']
    },
    alpha: {
        logo: require('../../assets/images/alpha_logo.png'),
        color: '#DC2626',
        lightBg: '#FEF2F2',
        tag: 'Unlimited Telecom',
        speed: 'Ultra Fast Data',
        features: ['Zero Buffering', 'Unlimited Bundles', 'Direct Top-Up Supported']
    },
    smile: {
        logo: require('../../assets/images/smile_logo.png'),
        color: '#DB2777',
        lightBg: '#FDF2F8',
        tag: 'SuperFast 4G LTE',
        speed: '4G LTE Broadband',
        features: ['Broadband & Router Ready', 'SmileVoice Compatible', 'National Roaming']
    },
    sahal: {
        logo: require('../../assets/images/pin_service.png'),
        color: '#0D9488',
        lightBg: '#F0FDFA',
        tag: 'Dedicated Cellular',
        speed: '4G Network',
        features: ['Physical SIM Package', 'Instant Provisioning', 'Secure PIN Enabled']
    },
    vitel: {
        logo: require('../../assets/images/vitel.png'),
        color: '#4F46E5',
        lightBg: '#EEF2FF',
        tag: 'Special Carrier',
        speed: '4G LTE Voice',
        features: ['Express Delivery', 'Corporate Ready', 'Multi-device Compatible']
    }
};

export default function SimCardScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [user, setUser] = useState<any>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [simPlans, setSimPlans] = useState<KetawancySimPlan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<KetawancySimPlan | null>(null);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Form inputs
    const [phoneNumber, setPhoneNumber] = useState('');
    const [emailAddress, setEmailAddress] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [simFormat, setSimFormat] = useState<'standard' | 'esim'>('standard');

    // Flow states
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [purchasedSim, setPurchasedSim] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                setUser(authUser);
                setEmailAddress(authUser.email || '');
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('balance, phone, full_name, address')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (profile) {
                    setBalance(Number(profile.balance || 0));
                    if (profile.phone) setPhoneNumber(profile.phone);
                    if (profile.address) setDeliveryAddress(profile.address);
                }
            }

            const plans = await KetawancyService.getSimPlans();
            setSimPlans(plans);
            if (plans.length > 0) {
                setSelectedPlan(plans[0]);
            }
        } catch (e) {
            console.error('[SIM Screen] Load error:', e);
        } finally {
            setLoadingPlans(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const getPlanMeta = (plan: KetawancySimPlan) => {
        const key = (plan.network || plan.name || '').toLowerCase();
        if (key.includes('ratel')) return SIM_NETWORKS_META.ratel;
        if (key.includes('kirani')) return SIM_NETWORKS_META.kirani;
        if (key.includes('alpha')) return SIM_NETWORKS_META.alpha;
        if (key.includes('smile')) return SIM_NETWORKS_META.smile;
        if (key.includes('sahal')) return SIM_NETWORKS_META.sahal;
        if (key.includes('vitel')) return SIM_NETWORKS_META.vitel;
        return SIM_NETWORKS_META.kirani;
    };

    const handleInitiatePurchase = () => {
        if (!selectedPlan) {
            Alert.alert("Plan Required", "Please select a SIM card type to continue.");
            return;
        }

        if (balance !== null && balance < selectedPlan.price) {
            Alert.alert(
                "Insufficient Balance",
                `Your wallet balance (₦${balance.toLocaleString()}) cannot cover this purchase (₦${selectedPlan.price.toLocaleString()}). Please fund your wallet.`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Fund Wallet", onPress: () => router.push('/wallet') }
                ]
            );
            return;
        }

        if (!phoneNumber || phoneNumber.trim().length < 10) {
            Alert.alert("Phone Required", "Please enter a valid contact phone number.");
            return;
        }

        setShowSecurityModal(true);
    };

    const handleConfirmPurchase = async () => {
        setShowSecurityModal(false);
        if (!user || !selectedPlan) return;

        setProcessing(true);
        try {
            const result = await KetawancyService.purchaseSim({
                userId: user.id,
                planId: selectedPlan._id,
                planName: selectedPlan.name,
                price: selectedPlan.price,
                phone: phoneNumber.trim(),
                email: emailAddress.trim()
            });

            if (result.success) {
                try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}

                setBalance(result.newBalance);
                setPurchasedSim({
                    ...result.simCard,
                    refNo: result.refNo,
                    planName: selectedPlan.name,
                    price: selectedPlan.price,
                    date: new Date().toLocaleDateString()
                });
            }
        } catch (err: any) {
            Alert.alert("SIM Purchase Failed", err.message || "Failed to purchase SIM. Your wallet was not debited.");
        } finally {
            setProcessing(false);
        }
    };

    const activeMeta = selectedPlan ? getPlanMeta(selectedPlan) : SIM_NETWORKS_META.ratel;

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1, backgroundColor: '#0A1128' }}
        >
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Premium Header */}
            <LinearGradient
                colors={['#070E22', '#0A1432', '#0F1E4A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.header, { paddingTop: insets.top + 8 }]}
            >
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.headerTitle}>SIM CARDS & ACTIVATION</Text>
                        <Text style={s.headerSubtitle}>Order genuine physical & pre-registered SIMs</Text>
                    </View>
                    <View style={s.balancePill}>
                        <Ionicons name="wallet-outline" size={13} color="#D4AF37" />
                        <Text style={s.balanceText}>
                            ₦{balance !== null ? balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '••••'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={s.scroll}
                contentContainerStyle={[s.scrollContent, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
            >
                {/* Modern Interactive Visual SIM Showcase Card */}
                {selectedPlan && (
                    <LinearGradient
                        colors={[activeMeta.color, '#0F172A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.simVisualCard}
                    >
                        {/* Chip Graphic */}
                        <View style={s.simCardHeader}>
                            <View style={s.simChip}>
                                <View style={s.simChipInner} />
                                <Ionicons name="hardware-chip-outline" size={22} color="#D4AF37" />
                            </View>
                            <View style={s.simBrandBadge}>
                                <Image 
                                    source={activeMeta.logo} 
                                    style={s.simBrandLogo} 
                                    resizeMode="contain" 
                                />
                            </View>
                        </View>

                        <View style={s.simCardBody}>
                            <Text style={s.simCardType}>{selectedPlan.name.toUpperCase()}</Text>
                            <Text style={s.simCardNumber}>
                                {phoneNumber ? phoneNumber.replace(/(\d{4})(\d{3})(\d{4})/, '$1  $2  $3') : '••••  ••••  ••••'}
                            </Text>
                        </View>

                        <View style={s.simCardFooter}>
                            <View>
                                <Text style={s.simCardSubLabel}>SPEED PROFILE</Text>
                                <Text style={s.simCardSubVal}>{activeMeta.speed}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={s.simCardSubLabel}>ACTIVATION FEE</Text>
                                <Text style={s.simCardPrice}>₦{selectedPlan.price.toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                )}

                {/* Success Card if SIM was just purchased */}
                {purchasedSim && (
                    <View style={s.successCard}>
                        <View style={s.successHeader}>
                            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.successTitle}>SIM Order Confirmed! 🎉</Text>
                                <Text style={s.successSubtitle}>Reference: {purchasedSim.refNo}</Text>
                            </View>
                        </View>
                        <View style={s.successDivider} />
                        <View style={s.successRow}>
                            <Text style={s.successLabel}>Selected SIM Package:</Text>
                            <Text style={s.successValue}>{purchasedSim.planName}</Text>
                        </View>
                        <View style={s.successRow}>
                            <Text style={s.successLabel}>Assigned Mobile Line:</Text>
                            <TouchableOpacity 
                                onPress={() => {
                                    Clipboard.setStringAsync(purchasedSim.number || '');
                                    Alert.alert("Copied", "Line number copied to clipboard");
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                <Text style={[s.successValue, { color: '#0284C7', fontWeight: '900' }]}>{purchasedSim.number || 'Active on Delivery'}</Text>
                                <Ionicons name="copy-outline" size={13} color="#0284C7" />
                            </TouchableOpacity>
                        </View>
                        <View style={s.successRow}>
                            <Text style={s.successLabel}>Total Paid:</Text>
                            <Text style={s.successValue}>₦{purchasedSim.price?.toLocaleString()}</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => setPurchasedSim(null)}
                            style={s.successCloseBtn}
                        >
                            <Text style={s.successCloseText}>Order Another SIM Card</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 1. Choose SIM Type */}
                <View style={s.sectionHeaderRow}>
                    <Ionicons name="radio-outline" size={15} color="#D4AF37" />
                    <Text style={s.sectionHeader}>1. SELECT NETWORK SIM</Text>
                </View>

                {loadingPlans ? (
                    <View style={s.loadingBox}>
                        <ActivityIndicator size="large" color="#D4AF37" />
                        <Text style={s.loadingText}>Fetching available SIM inventory...</Text>
                    </View>
                ) : (
                    <View style={s.planList}>
                        {simPlans.map((plan) => {
                            const isSelected = selectedPlan?._id === plan._id;
                            const meta = getPlanMeta(plan);

                            return (
                                <TouchableOpacity
                                    key={plan._id}
                                    onPress={() => setSelectedPlan(plan)}
                                    activeOpacity={0.85}
                                    style={[
                                        s.planCard, 
                                        isSelected && { borderColor: meta.color, backgroundColor: '#FFFFFF' }
                                    ]}
                                >
                                    {/* Left Network Logo Pill */}
                                    <View style={[s.planLogoContainer, { backgroundColor: '#F8FAFC', borderColor: isSelected ? meta.color : '#E2E8F0' }]}>
                                        <Image 
                                            source={meta.logo} 
                                            style={s.planLogoImg} 
                                            resizeMode="contain" 
                                        />
                                    </View>

                                    {/* Middle Details */}
                                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.planName}>{plan.name}</Text>
                                            <View style={[s.tagBadge, { backgroundColor: meta.lightBg }]}>
                                                <Text style={[s.tagBadgeText, { color: meta.color }]}>{meta.tag}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.planDesc} numberOfLines={1}>
                                            {meta.features.join(' • ')}
                                        </Text>
                                        <Text style={[s.planPrice, { color: meta.color }]}>₦{plan.price.toLocaleString()}</Text>
                                    </View>

                                    {/* Right Select Radio */}
                                    <View style={[
                                        s.selectRadio, 
                                        isSelected && { backgroundColor: meta.color, borderColor: meta.color }
                                    ]}>
                                        {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* 2. Format Selection (Physical SIM vs eSIM) */}
                <View style={s.sectionHeaderRow}>
                    <Ionicons name="hardware-chip-outline" size={15} color="#D4AF37" />
                    <Text style={s.sectionHeader}>2. CHOOSE SIM FORMAT</Text>
                </View>
                <View style={s.formatRow}>
                    <TouchableOpacity
                        onPress={() => setSimFormat('standard')}
                        activeOpacity={0.8}
                        style={[s.formatCard, simFormat === 'standard' && s.formatCardActive]}
                    >
                        <MaterialCommunityIcons 
                            name="sim" 
                            size={22} 
                            color={simFormat === 'standard' ? '#D4AF37' : '#64748B'} 
                        />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={[s.formatTitle, simFormat === 'standard' && s.formatTitleActive]}>Physical SIM</Text>
                            <Text style={s.formatSub}>Standard / Micro / Nano</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setSimFormat('esim')}
                        activeOpacity={0.8}
                        style={[s.formatCard, simFormat === 'esim' && s.formatCardActive]}
                    >
                        <Ionicons 
                            name="qr-code-outline" 
                            size={22} 
                            color={simFormat === 'esim' ? '#D4AF37' : '#64748B'} 
                        />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={[s.formatTitle, simFormat === 'esim' && s.formatTitleActive]}>eSIM QR Code</Text>
                            <Text style={s.formatSub}>Digital Instant Activation</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 3. Registration Details */}
                <View style={s.sectionHeaderRow}>
                    <Ionicons name="location-outline" size={15} color="#D4AF37" />
                    <Text style={s.sectionHeader}>3. REGISTRATION & DELIVERY DESTINATION</Text>
                </View>
                <View style={s.formCard}>
                    <View style={s.inputGroup}>
                        <Text style={s.inputLabel}>Receiver Phone Number *</Text>
                        <View style={s.inputWrap}>
                            <Ionicons name="call-outline" size={16} color="#64748B" />
                            <TextInput
                                placeholder="e.g. 08123456789"
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                style={s.textInput}
                            />
                        </View>
                    </View>

                    <View style={s.inputGroup}>
                        <Text style={s.inputLabel}>Email Address (For activation receipt / eSIM QR)</Text>
                        <View style={s.inputWrap}>
                            <Ionicons name="mail-outline" size={16} color="#64748B" />
                            <TextInput
                                placeholder="customer@example.com"
                                placeholderTextColor="#94A3B8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={emailAddress}
                                onChangeText={setEmailAddress}
                                style={s.textInput}
                            />
                        </View>
                    </View>

                    <View style={s.inputGroup}>
                        <Text style={s.inputLabel}>Delivery Address / Pickup Station</Text>
                        <View style={s.inputWrap}>
                            <Ionicons name="navigate-outline" size={16} color="#64748B" />
                            <TextInput
                                placeholder="State, City, Local Address"
                                placeholderTextColor="#94A3B8"
                                value={deliveryAddress}
                                onChangeText={setDeliveryAddress}
                                style={s.textInput}
                            />
                        </View>
                    </View>
                </View>

                {/* 4. Checkout Summary */}
                {selectedPlan && (
                    <View style={s.checkoutBox}>
                        <View style={s.checkoutRow}>
                            <Text style={s.checkoutLabel}>SIM Network</Text>
                            <Text style={s.checkoutVal}>{selectedPlan.name}</Text>
                        </View>
                        <View style={s.checkoutRow}>
                            <Text style={s.checkoutLabel}>Format</Text>
                            <Text style={s.checkoutVal}>{simFormat === 'standard' ? 'Physical Multi-Cut SIM' : 'Digital eSIM Profile'}</Text>
                        </View>
                        <View style={s.checkoutDivider} />
                        <View style={s.checkoutRow}>
                            <Text style={s.checkoutTotalLabel}>Total Amount Due</Text>
                            <Text style={s.checkoutTotalVal}>₦{selectedPlan.price.toLocaleString()}</Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleInitiatePurchase}
                            disabled={processing}
                            style={[s.purchaseBtn, processing && { opacity: 0.6 }]}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#F59E0B', '#D4AF37', '#B8952B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.purchaseGradient}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#0A1128" />
                                ) : (
                                    <>
                                        <Ionicons name="card" size={18} color="#0A1128" />
                                        <Text style={s.purchaseBtnText}>Pay ₦{selectedPlan.price.toLocaleString()} & Order SIM</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* PIN Security Modal */}
            <SecurityModal
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={handleConfirmPurchase}
                title="Verify Transaction PIN"
            />
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    header: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.3)',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        color: '#D4AF37',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 2,
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderWidth: 1,
        borderColor: '#D4AF37',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    balanceText: {
        color: '#FCD34D',
        fontSize: 12,
        fontWeight: '900',
    },
    scroll: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: 16,
    },
    simVisualCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    simCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    simChip: {
        width: 44,
        height: 34,
        borderRadius: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
    simChipInner: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)',
        margin: 3,
        borderRadius: 3,
    },
    simBrandBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    simBrandLogo: {
        width: '100%',
        height: '100%',
    },
    simCardBody: {
        marginBottom: 20,
    },
    simCardType: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4,
    },
    simCardNumber: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '900',
        letterSpacing: 2,
    },
    simCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.15)',
        paddingTop: 12,
    },
    simCardSubLabel: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    simCardSubVal: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 2,
    },
    simCardPrice: {
        color: '#FCD34D',
        fontSize: 18,
        fontWeight: '900',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        marginTop: 6,
    },
    sectionHeader: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    loadingBox: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
    },
    planList: {
        gap: 10,
        marginBottom: 20,
    },
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    planLogoContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        padding: 4,
        overflow: 'hidden',
    },
    planLogoImg: {
        width: '90%',
        height: '90%',
    },
    planName: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0F172A',
    },
    tagBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tagBadgeText: {
        fontSize: 8.5,
        fontWeight: '800',
    },
    planDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 15,
        fontWeight: '900',
    },
    selectRadio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    formatRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    formatCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    formatCardActive: {
        borderColor: '#D4AF37',
        backgroundColor: '#FFFDF5',
    },
    formatTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#334155',
    },
    formatTitleActive: {
        color: '#0F172A',
    },
    formatSub: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 1,
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 6,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
        gap: 8,
    },
    textInput: {
        flex: 1,
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '600',
    },
    checkoutBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    checkoutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    checkoutLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '700',
    },
    checkoutVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    checkoutDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 8,
    },
    checkoutTotalLabel: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
    },
    checkoutTotalVal: {
        fontSize: 19,
        fontWeight: '900',
        color: '#D4AF37',
    },
    purchaseBtn: {
        marginTop: 14,
        borderRadius: 12,
        overflow: 'hidden',
    },
    purchaseGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    purchaseBtnText: {
        color: '#0A1128',
        fontSize: 14,
        fontWeight: '900',
    },
    successCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        marginBottom: 20,
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#15803D',
    },
    successSubtitle: {
        fontSize: 11,
        color: '#166534',
        marginTop: 2,
    },
    successDivider: {
        height: 1,
        backgroundColor: '#BBF7D0',
        marginVertical: 12,
    },
    successRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    successLabel: {
        fontSize: 12,
        color: '#166534',
        fontWeight: '700',
    },
    successValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#15803D',
    },
    successCloseBtn: {
        marginTop: 12,
        backgroundColor: '#15803D',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    successCloseText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
});
