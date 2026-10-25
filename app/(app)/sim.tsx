import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, RefreshControl, Modal } from 'react-native';
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

const T = {
    navy: '#0d1b3e',
    navyMid: '#142258',
    gold: '#f5a623',
    goldDk: '#d4890e',
    white: '#ffffff',
    bg: '#f4f6fb',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    sub: '#64748b',
    text: '#0f172a',
    red: '#dc2626',
    green: '#16a34a',
    blue: '#2563eb',
};

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
        color: '#B45309',
        lightBg: '#FEF3C7',
        tag: 'Instant 4G/LTE',
        speed: 'High Speed LTE',
        features: ['Instant Activation', 'Voice & Unlimited Data']
    },
    kirani: {
        logo: require('../../assets/images/kirani.png'),
        color: '#2563EB',
        lightBg: '#EFF6FF',
        tag: 'Fast 4G Broadband',
        speed: 'Multi-band 4G',
        features: ['Nationwide Coverage', 'HD Voice & Minute Bundles']
    },
    alpha: {
        logo: require('../../assets/images/alpha_logo.png'),
        color: '#DC2626',
        lightBg: '#FEF2F2',
        tag: 'Unlimited Telecom',
        speed: 'Ultra Fast Data',
        features: ['Zero Buffering', 'Unlimited Bundles']
    },
    smile: {
        logo: require('../../assets/images/smile_logo.png'),
        color: '#EC4899',
        lightBg: '#FDF2F8',
        tag: 'SuperFast 4G LTE',
        speed: '4G LTE Broadband',
        features: ['Broadband & Router Ready', 'SmileVoice Compatible']
    },
    sahal: {
        logo: require('../../assets/images/sahal.png'),
        color: '#E11D48',
        lightBg: '#FFF1F2',
        tag: 'Sahal Telecom 4G',
        speed: '4G LTE Cellular',
        features: ['Sahal Dedicated SIM', 'Instant Provisioning']
    },
    vitel: {
        logo: require('../../assets/images/vitel.png'),
        color: '#6366F1',
        lightBg: '#EEF2FF',
        tag: 'Special Carrier',
        speed: '4G LTE Voice',
        features: ['Express Delivery', 'Corporate Ready']
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
    const [showNetworkModal, setShowNetworkModal] = useState(false);

    // Form inputs
    const [phoneNumber, setPhoneNumber] = useState('');
    const [emailAddress, setEmailAddress] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [simFormat, setSimFormat] = useState<'standard' | 'esim'>('standard');

    // Flow states
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [purchasedSim, setPurchasedSim] = useState<any>(null);
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [maintenanceMsg, setMaintenanceMsg] = useState('SIM Card service is temporarily undergoing scheduled maintenance.');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Check feature maintenance status
            const { data: flagData } = await supabase
                .from('feature_flags')
                .select('is_enabled, maintenance_message')
                .eq('feature_key', 'feature_sim')
                .maybeSingle();

            if (flagData && flagData.is_enabled === false) {
                setIsMaintenance(true);
                if (flagData.maintenance_message) setMaintenanceMsg(flagData.maintenance_message);
            }

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
            
            // Sync with custom pricing and status stored in app_settings (key: sim_plans_custom)
            try {
                const { data: settingData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'sim_plans_custom')
                    .maybeSingle();

                if (settingData && settingData.value) {
                    let dbPlans = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
                    if (Array.isArray(dbPlans) && dbPlans.length > 0) {
                        const dbMap = new Map<string, any>();
                        dbPlans.forEach((p: any) => {
                            if (p.id) dbMap.set(p.id, p);
                            if (p.network) dbMap.set(p.network.toLowerCase(), p);
                        });

                        const merged = plans.map(p => {
                            const netKey = (p.network || p.name || '').toLowerCase();
                            const found = dbMap.get(p._id) || dbMap.get(netKey);
                            if (found) {
                                return {
                                    ...p,
                                    name: found.name || p.name,
                                    price: typeof found.price === 'number' ? found.price : p.price,
                                    description: found.description || p.description,
                                    status: found.status || p.status,
                                };
                            }
                            return p;
                        }).filter(p => p.status !== 'off'); // Hide SIMs that are turned off in Admin

                        setSimPlans(merged);
                        if (merged.length > 0) {
                            setSelectedPlan(merged[0]);
                        }
                        return;
                    }
                }
            } catch (mergeErr) {
                console.warn('[SIM Screen] Merge sim_plans warning:', mergeErr);
            }

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
        if (isMaintenance) {
            Alert.alert("Maintenance", maintenanceMsg);
            return;
        }

        if (!selectedPlan) {
            Alert.alert("Zaɓi SIM", "Da fatan za a zaɓi katin SIM don ci gaba.");
            return;
        }

        if (balance !== null && balance < selectedPlan.price) {
            Alert.alert(
                "Kuɗin Ka Bai Isa Ba",
                `Kuɗin wallet ɗinka (₦${balance.toLocaleString()}) bai isa siyan wannan SIM ɗin ba (₦${selectedPlan.price.toLocaleString()}).`,
                [
                    { text: "A'a", style: "cancel" },
                    { text: "Sanya Kuɗi", onPress: () => router.push('/wallet') }
                ]
            );
            return;
        }

        if (!phoneNumber || phoneNumber.trim().length < 10) {
            Alert.alert("Lambar Waya", "Da fatan za a shigar da lambar waya mai aiki.");
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
            Alert.alert("SIM Purchase Failed", err.message || "An samu matsala wajen siyan SIM. Ba a cire kuɗi a wallet ɗinka ba.");
        } finally {
            setProcessing(false);
        }
    };

    const activeMeta = selectedPlan ? getPlanMeta(selectedPlan) : SIM_NETWORKS_META.ratel;

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={{ flex: 1 }}
            >
                {/* Premium Curved Header (Light/Navy Theme matching Data/Airtime) */}
                <LinearGradient 
                    colors={['#060d21', '#0d1b3e']} 
                    style={[s.headerContainer, { paddingTop: insets.top + 10 }]}
                >
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
                            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>SIM Cards & Activation</Text>
                            {balance !== null && (
                                <TouchableOpacity 
                                    onPress={() => router.push('/wallet')} 
                                    style={s.balanceBadge} 
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                    <Text style={s.headerBalance}>
                                        ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => router.push('/wallet')} style={s.topWalletBtn}>
                            <Ionicons name="add-circle" size={22} color="#f5a623" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
                >
                    {/* Maintenance Alert */}
                    {isMaintenance && (
                        <View style={s.maintenanceBox}>
                            <Ionicons name="warning" size={22} color="#D97706" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.maintenanceTitle}>Sabis ɗin SIM na Gyara</Text>
                                <Text style={s.maintenanceDesc}>{maintenanceMsg}</Text>
                            </View>
                        </View>
                    )}

                    {/* Modern Interactive Visual SIM Showcase Card */}
                    {selectedPlan && (
                        <LinearGradient
                            colors={[activeMeta.color, '#0d1b3e']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.simCardPreview}
                        >
                            <View style={s.previewTop}>
                                <View style={s.chipGraphic}>
                                    <View style={s.chipLineHoriz} />
                                    <View style={s.chipLineVert} />
                                    <Ionicons name="hardware-chip" size={18} color="#D4AF37" />
                                </View>
                                <View style={s.networkLogoWrap}>
                                    <Image source={activeMeta.logo} style={s.previewLogo} resizeMode="contain" />
                                </View>
                            </View>

                            <View style={s.previewMid}>
                                <Text style={s.previewPlanName}>{selectedPlan.name.toUpperCase()}</Text>
                                <Text style={s.previewPhoneNum}>
                                    {phoneNumber ? phoneNumber.replace(/(\d{4})(\d{3})(\d{4})/, '$1  $2  $3') : '+234  ••••  ••••'}
                                </Text>
                            </View>

                            <View style={s.previewBottom}>
                                <View>
                                    <Text style={s.previewSubLabel}>SPEED PROFILE</Text>
                                    <Text style={s.previewSubVal}>{activeMeta.speed}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={s.previewSubLabel}>FARASHIN SIM</Text>
                                    <Text style={s.previewPrice}>₦{selectedPlan.price.toLocaleString()}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    )}

                    {/* Success Order Banner if purchased */}
                    {purchasedSim && (
                        <View style={s.successBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                                <Text style={s.successTitle}>An Yi Nasarar Siyan SIM!</Text>
                            </View>
                            <Text style={s.successSubtitle}>Reference: {purchasedSim.refNo}</Text>
                            {purchasedSim.number && (
                                <TouchableOpacity 
                                    onPress={() => {
                                        Clipboard.setStringAsync(purchasedSim.number || '');
                                        Alert.alert("An Kwafa", "An kwafi lambar SIM");
                                    }}
                                    style={s.copyNumberPill}
                                >
                                    <Text style={s.copyNumberText}>Lamba: {purchasedSim.number}</Text>
                                    <Ionicons name="copy-outline" size={14} color="#2563eb" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                onPress={() => setPurchasedSim(null)}
                                style={s.dismissSuccessBtn}
                            >
                                <Text style={s.dismissSuccessText}>Yi Wata Odar</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* 1. Network Selection Dropdown Trigger Card */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="cellular-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>1. Zaɓi Network SIM</Text>
                    </View>

                    {loadingPlans ? (
                        <View style={s.loadingWrap}>
                            <ActivityIndicator size="small" color={T.navy} />
                            <Text style={s.loadingTxt}>Ana loda jerin SIM da farashi...</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowNetworkModal(true)}
                            activeOpacity={0.85}
                            style={s.networkDropdownTrigger}
                        >
                            {selectedPlan ? (
                                <>
                                    <View style={s.triggerLogoWrap}>
                                        <Image source={activeMeta.logo} style={s.triggerLogo} resizeMode="contain" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.triggerName}>{selectedPlan.name}</Text>
                                            <View style={[s.triggerTag, { backgroundColor: activeMeta.lightBg }]}>
                                                <Text style={[s.triggerTagTxt, { color: activeMeta.color }]}>{activeMeta.tag}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.triggerPrice}>₦{selectedPlan.price.toLocaleString()}</Text>
                                    </View>
                                </>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <Text style={s.triggerPlaceholder}>Danna nan don zaɓar Network SIM</Text>
                                </View>
                            )}
                            <View style={s.dropdownIconBox}>
                                <Ionicons name="chevron-down" size={18} color="#64748b" />
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* 2. Format Selector: Physical SIM or eSIM */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="hardware-chip-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>2. Nau'in SIM (Format)</Text>
                    </View>
                    <View style={s.formatRow}>
                        <TouchableOpacity
                            onPress={() => {
                                setSimFormat('standard');
                                try { Haptics.selectionAsync(); } catch {}
                            }}
                            activeOpacity={0.8}
                            style={[s.formatPill, simFormat === 'standard' && s.formatPillActive]}
                        >
                            <MaterialCommunityIcons 
                                name="sim" 
                                size={20} 
                                color={simFormat === 'standard' ? '#0d1b3e' : '#64748b'} 
                            />
                            <View style={{ marginLeft: 8 }}>
                                <Text style={[s.formatPillTitle, simFormat === 'standard' && { color: '#0d1b3e' }]}>
                                    Physical SIM Card
                                </Text>
                                <Text style={s.formatPillSub}>Standard / Nano</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setSimFormat('esim');
                                try { Haptics.selectionAsync(); } catch {}
                            }}
                            activeOpacity={0.8}
                            style={[s.formatPill, simFormat === 'esim' && s.formatPillActive]}
                        >
                            <Ionicons 
                                name="qr-code-outline" 
                                size={19} 
                                color={simFormat === 'esim' ? '#0d1b3e' : '#64748b'} 
                            />
                            <View style={{ marginLeft: 8 }}>
                                <Text style={[s.formatPillTitle, simFormat === 'esim' && { color: '#0d1b3e' }]}>
                                    eSIM Profile (QR)
                                </Text>
                                <Text style={s.formatPillSub}>Digital Activation</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* 3. Delivery / Contact Form */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="person-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>3. Bayanan Mai Karɓa</Text>
                    </View>
                    <View style={s.formCard}>
                        <View style={s.field}>
                            <Text style={s.fieldLabel}>Lambar Waya (Contact Phone) *</Text>
                            <View style={s.inputWrap}>
                                <Ionicons name="call-outline" size={17} color="#64748b" />
                                <TextInput
                                    placeholder="e.g. 08012345678"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="phone-pad"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    style={s.textInput}
                                />
                            </View>
                        </View>

                        <View style={s.field}>
                            <Text style={s.fieldLabel}>Email Address (Don rasit ko eSIM QR)</Text>
                            <View style={s.inputWrap}>
                                <Ionicons name="mail-outline" size={17} color="#64748b" />
                                <TextInput
                                    placeholder="name@example.com"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={emailAddress}
                                    onChangeText={setEmailAddress}
                                    style={s.textInput}
                                />
                            </View>
                        </View>

                        {simFormat === 'standard' && (
                            <View style={s.field}>
                                <Text style={s.fieldLabel}>Adireshin Isarwa (Delivery Address)</Text>
                                <View style={s.inputWrap}>
                                    <Ionicons name="location-outline" size={17} color="#64748b" />
                                    <TextInput
                                        placeholder="Jiha, Gari, ko Unguwa"
                                        placeholderTextColor="#94a3b8"
                                        value={deliveryAddress}
                                        onChangeText={setDeliveryAddress}
                                        style={s.textInput}
                                    />
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Checkout Button */}
                    {selectedPlan && (
                        <TouchableOpacity
                            onPress={handleInitiatePurchase}
                            disabled={processing}
                            style={[s.checkoutBtn, processing && { opacity: 0.6 }]}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[T.gold, T.goldDk]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.checkoutGradient}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#0d1b3e" />
                                ) : (
                                    <>
                                        <Ionicons name="shield-checkmark" size={18} color="#0d1b3e" />
                                        <Text style={s.checkoutTxt}>
                                            Biya ₦{selectedPlan.price.toLocaleString()} & Tabbatar da SIM
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                {/* Network Selection Bottom Sheet Modal */}
                <Modal
                    visible={showNetworkModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowNetworkModal(false)}
                >
                    <View style={s.modalOverlay}>
                        <View style={s.modalContent}>
                            <View style={s.modalHeader}>
                                <Text style={s.modalTitle}>Zaɓi Network SIM Card</Text>
                                <TouchableOpacity onPress={() => setShowNetworkModal(false)} style={s.modalCloseBtn}>
                                    <Ionicons name="close" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                                {simPlans.map(plan => {
                                    const meta = getPlanMeta(plan);
                                    const isSel = selectedPlan?._id === plan._id;
                                    return (
                                        <TouchableOpacity
                                            key={plan._id}
                                            onPress={() => {
                                                setSelectedPlan(plan);
                                                setShowNetworkModal(false);
                                                try { Haptics.selectionAsync(); } catch {}
                                            }}
                                            activeOpacity={0.75}
                                            style={[
                                                s.modalOptionCard,
                                                isSel && { borderColor: meta.color, backgroundColor: meta.lightBg }
                                            ]}
                                        >
                                            <View style={s.modalLogoWrap}>
                                                <Image source={meta.logo} style={s.modalLogo} resizeMode="contain" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={s.modalOptionName}>{plan.name}</Text>
                                                    <View style={[s.triggerTag, { backgroundColor: meta.lightBg }]}>
                                                        <Text style={[s.triggerTagTxt, { color: meta.color }]}>{meta.tag}</Text>
                                                    </View>
                                                </View>
                                                <Text style={s.modalOptionDesc} numberOfLines={1}>{meta.features.join(' • ')}</Text>
                                            </View>
                                            <Text style={[s.modalOptionPrice, { color: meta.color }]}>₦{plan.price.toLocaleString()}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* PIN Security Modal */}
                <SecurityModal
                    visible={showSecurityModal}
                    onClose={() => setShowSecurityModal(false)}
                    onSuccess={handleConfirmPurchase}
                    title="Tabbatar da PIN"
                />
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    pageWrapper: {
        flex: 1,
        backgroundColor: T.bg,
    },
    headerContainer: {
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topWalletBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    headerBalance: {
        fontSize: 12,
        fontWeight: '800',
        color: '#f5a623',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    maintenanceBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F59E0B',
        marginBottom: 16,
    },
    maintenanceTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#B45309',
    },
    maintenanceDesc: {
        fontSize: 11,
        color: '#92400E',
        marginTop: 2,
    },
    simCardPreview: {
        borderRadius: 22,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#0A1128',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    previewTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chipGraphic: {
        width: 38,
        height: 30,
        borderRadius: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    chipLineHoriz: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.4)',
    },
    chipLineVert: {
        position: 'absolute',
        height: '100%',
        width: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.4)',
    },
    networkLogoWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
    },
    previewLogo: {
        width: '100%',
        height: '100%',
    },
    previewMid: {
        marginVertical: 18,
    },
    previewPlanName: {
        fontSize: 11,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 1,
    },
    previewPhoneNum: {
        fontSize: 19,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1.5,
        marginTop: 4,
    },
    previewBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.14)',
        paddingTop: 12,
    },
    previewSubLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 0.5,
    },
    previewSubVal: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 2,
    },
    previewPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: '#f5a623',
    },
    successBox: {
        backgroundColor: '#F0FDF4',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#16a34a',
        marginLeft: 8,
    },
    successSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
    },
    copyNumberPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        marginTop: 10,
    },
    copyNumberText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0284c7',
    },
    dismissSuccessBtn: {
        backgroundColor: '#16a34a',
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: 'center',
        marginTop: 12,
    },
    dismissSuccessText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0d1b3e',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    loadingWrap: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingTxt: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 6,
    },
    networkDropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 18,
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2,
    },
    triggerLogoWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        marginRight: 12,
    },
    triggerLogo: {
        width: '80%',
        height: '80%',
    },
    triggerName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    triggerTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    triggerTagTxt: {
        fontSize: 9,
        fontWeight: '800',
    },
    triggerPrice: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#f5a623',
        marginTop: 2,
    },
    triggerPlaceholder: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    dropdownIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    formatRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
    },
    formatPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    formatPillActive: {
        borderColor: '#f5a623',
        backgroundColor: '#FFFBEB',
    },
    formatPillTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#334155',
    },
    formatPillSub: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 1,
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2,
    },
    field: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        height: 46,
        gap: 10,
    },
    textInput: {
        flex: 1,
        color: '#0f172a',
        fontSize: 13.5,
        fontWeight: '600',
    },
    checkoutBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
        marginBottom: 20,
    },
    checkoutGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
    },
    checkoutTxt: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 17, 40, 0.65)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    modalLogoWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 12,
        overflow: 'hidden',
    },
    modalLogo: {
        width: '80%',
        height: '80%',
    },
    modalOptionName: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalOptionDesc: {
        fontSize: 10.5,
        color: '#64748b',
        marginTop: 2,
    },
    modalOptionPrice: {
        fontSize: 14.5,
        fontWeight: '900',
    },
});
