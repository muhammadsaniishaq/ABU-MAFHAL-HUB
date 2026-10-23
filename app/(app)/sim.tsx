import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, RefreshControl, Dimensions } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const T = {
    navyDark: '#0A1128',
    navyMid: '#111D3B',
    gold: '#D4AF37',
    goldDark: '#B8952B',
    goldLight: '#F5E8D0',
    goldBg: 'rgba(212, 175, 55, 0.12)',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    textMain: '#0F172A',
    textSub: '#64748B',
    success: '#10B981',
    successBg: '#ECFDF5',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
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

    const getSimIcon = (name: string) => {
        const lower = (name || '').toLowerCase();
        if (lower.includes('kirani')) {
            return require('../../assets/images/kirani.png');
        } else if (lower.includes('smile')) {
            return require('../../assets/images/smile_logo.png');
        } else if (lower.includes('alpha')) {
            return require('../../assets/images/alpha_logo.png');
        } else if (lower.includes('ratel')) {
            return require('../../assets/images/ratel_alat.jpg');
        }
        return require('../../assets/images/pin_service.png');
    };

    return (
        <View style={s.container}>
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <LinearGradient
                colors={['#050B18', '#0A1226', '#0F1B3B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.header, { paddingTop: insets.top + 8 }]}
            >
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.headerTitle}>SIM CARDS & ACTIVATION</Text>
                        <Text style={s.headerSubtitle}>Kirani, Smile, Alpha & Ratel SIMs</Text>
                    </View>
                    <View style={s.balancePill}>
                        <Ionicons name="wallet-outline" size={12} color="#D4AF37" />
                        <Text style={s.balanceText}>
                            ₦{balance !== null ? balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '••••'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={s.scroll}
                contentContainerStyle={[s.scrollContent, { paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
            >
                {/* Hero Feature Banner */}
                <View style={s.heroBanner}>
                    <Image source={require('../../assets/images/telecom_hub.jpg')} style={s.heroBannerImage} resizeMode="cover" />
                    <LinearGradient
                        colors={['rgba(10, 17, 40, 0.4)', 'rgba(10, 17, 40, 0.95)']}
                        style={s.heroBannerGradient}
                    >
                        <View style={s.heroTag}>
                            <Ionicons name="flash" size={11} color="#0A1128" />
                            <Text style={s.heroTagText}>INSTANT SIM DISCOVERY</Text>
                        </View>
                        <Text style={s.heroTitle}>Purchase & Activate Dedicated SIMs</Text>
                        <Text style={s.heroDesc}>
                            Get genuine Kirani 4G, Smile, Alpha and Ratel SIM cards provisioned directly via Ketawancy multi-carrier API.
                        </Text>
                    </LinearGradient>
                </View>

                {/* Success Card if SIM was just purchased */}
                {purchasedSim && (
                    <View style={s.successCard}>
                        <View style={s.successHeader}>
                            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.successTitle}>SIM Card Purchased Successfully! 🎉</Text>
                                <Text style={s.successSubtitle}>Reference: {purchasedSim.refNo}</Text>
                            </View>
                        </View>
                        <View style={s.successDivider} />
                        <View style={s.successRow}>
                            <Text style={s.successLabel}>SIM Package:</Text>
                            <Text style={s.successValue}>{purchasedSim.planName}</Text>
                        </View>
                        <View style={s.successRow}>
                            <Text style={s.successLabel}>Assigned Number:</Text>
                            <TouchableOpacity 
                                onPress={() => {
                                    Clipboard.setStringAsync(purchasedSim.number || '');
                                    Alert.alert("Copied", "SIM Number copied to clipboard");
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                <Text style={[s.successValue, { color: '#0284C7', fontWeight: '900' }]}>{purchasedSim.number || 'Active on Delivery'}</Text>
                                <Ionicons name="copy-outline" size={13} color="#0284C7" />
                            </TouchableOpacity>
                        </View>
                        <View style={s.successRow}>
                            <Text style={s.successLabel}>Amount Paid:</Text>
                            <Text style={s.successValue}>₦{purchasedSim.price?.toLocaleString()}</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => setPurchasedSim(null)}
                            style={s.successCloseBtn}
                        >
                            <Text style={s.successCloseText}>Purchase Another SIM</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 1. Choose SIM Type */}
                <Text style={s.sectionHeader}>1. SELECT SIM TYPE</Text>
                {loadingPlans ? (
                    <View style={s.loadingBox}>
                        <ActivityIndicator size="large" color={T.gold} />
                        <Text style={s.loadingText}>Loading available SIM cards from Ketawancy...</Text>
                    </View>
                ) : (
                    <View style={s.planGrid}>
                        {simPlans.map((plan) => {
                            const isSelected = selectedPlan?._id === plan._id;
                            const iconSource = getSimIcon(plan.name);

                            return (
                                <TouchableOpacity
                                    key={plan._id}
                                    onPress={() => setSelectedPlan(plan)}
                                    activeOpacity={0.8}
                                    style={[s.planCard, isSelected && s.planCardSelected]}
                                >
                                    <View style={s.planIconWrap}>
                                        <Image source={iconSource} style={s.planIconImg} resizeMode="contain" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={s.planName} numberOfLines={1}>{plan.name}</Text>
                                            <View style={[s.statusBadge, plan.status === 'on' ? s.statusOn : s.statusOff]}>
                                                <Text style={s.statusBadgeText}>{plan.status === 'on' ? 'In Stock' : 'Pre-Order'}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.planDesc} numberOfLines={2}>
                                            {plan.description || 'High-speed data & voice SIM with auto activation.'}
                                        </Text>
                                        <Text style={s.planPrice}>₦{plan.price.toLocaleString()}</Text>
                                    </View>
                                    <View style={[s.checkCircle, isSelected && s.checkCircleSelected]}>
                                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* 2. Registration & Delivery Details */}
                <Text style={s.sectionHeader}>2. REGISTRATION & DELIVERY DETAILS</Text>
                <View style={s.formCard}>
                    <View style={s.inputGroup}>
                        <Text style={s.inputLabel}>Contact Phone Number *</Text>
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
                        <Text style={s.inputLabel}>Email Address (For activation receipt)</Text>
                        <View style={s.inputWrap}>
                            <Ionicons name="mail-outline" size={16} color="#64748B" />
                            <TextInput
                                placeholder="e.g. customer@example.com"
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
                        <Text style={s.inputLabel}>Delivery Address / Station</Text>
                        <View style={s.inputWrap}>
                            <Ionicons name="location-outline" size={16} color="#64748B" />
                            <TextInput
                                placeholder="Your city or delivery location"
                                placeholderTextColor="#94A3B8"
                                value={deliveryAddress}
                                onChangeText={setDeliveryAddress}
                                style={s.textInput}
                            />
                        </View>
                    </View>
                </View>

                {/* Order Summary & Submit */}
                {selectedPlan && (
                    <View style={s.summaryCard}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>Selected SIM Card:</Text>
                            <Text style={s.summaryVal}>{selectedPlan.name}</Text>
                        </View>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>Total Payable:</Text>
                            <Text style={s.summaryTotal}>₦{selectedPlan.price.toLocaleString()}</Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleInitiatePurchase}
                            disabled={processing}
                            style={[s.buyBtn, processing && { opacity: 0.6 }]}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#F59E0B', '#D4AF37', '#B8952B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.buyBtnGradient}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#0A1128" />
                                ) : (
                                    <>
                                        <Ionicons name="card" size={16} color="#0A1128" />
                                        <Text style={s.buyBtnText}>Confirm & Purchase SIM</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Security PIN verification modal */}
            <SecurityModal
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={handleConfirmPurchase}
                title="Verify Transaction PIN"
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1.5,
        borderBottomColor: '#D4AF37',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
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
        fontSize: 10,
        fontWeight: '700',
        marginTop: 1,
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
    },
    scrollContent: {
        padding: 16,
    },
    heroBanner: {
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 18,
        position: 'relative',
        borderWidth: 1,
        borderColor: '#D4AF37',
    },
    heroBannerImage: {
        width: '100%',
        height: '100%',
    },
    heroBannerGradient: {
        ...StyleSheet.absoluteFillObject,
        padding: 14,
        justifyContent: 'flex-end',
    },
    heroTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D4AF37',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    heroTagText: {
        color: '#0A1128',
        fontSize: 9.5,
        fontWeight: '900',
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 4,
    },
    heroDesc: {
        color: '#E2E8F0',
        fontSize: 11,
        lineHeight: 16,
    },
    sectionHeader: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 10,
        marginTop: 6,
    },
    loadingBox: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
    },
    planGrid: {
        gap: 10,
        marginBottom: 18,
    },
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    planCardSelected: {
        borderColor: '#D4AF37',
        backgroundColor: '#FFFDF5',
    },
    planIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    planIconImg: {
        width: 38,
        height: 38,
    },
    planName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusOn: {
        backgroundColor: '#ECFDF5',
    },
    statusOff: {
        backgroundColor: '#FFFBEB',
    },
    statusBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#059669',
    },
    planDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 3,
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 15,
        fontWeight: '900',
        color: '#B45309',
    },
    checkCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    checkCircleSelected: {
        backgroundColor: '#D4AF37',
        borderColor: '#D4AF37',
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 18,
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
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.2,
        borderColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '700',
    },
    summaryVal: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
    },
    summaryTotal: {
        fontSize: 18,
        fontWeight: '900',
        color: '#B45309',
    },
    buyBtn: {
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    buyBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
    },
    buyBtnText: {
        color: '#0A1128',
        fontSize: 14,
        fontWeight: '900',
    },
    successCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        marginBottom: 18,
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 14,
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
        marginTop: 10,
        backgroundColor: '#15803D',
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    successCloseText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
});
