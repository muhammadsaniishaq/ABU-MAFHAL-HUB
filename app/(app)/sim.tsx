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
        color: '#DB2777',
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
        color: '#4F46E5',
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
    const [maintenanceMsg, setMaintenanceMsg] = useState('SIM Card service is undergoing scheduled maintenance.');

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
            
            // Sync with custom pricing and status configured in Admin SIM Pricing
            try {
                const { data: dbPlans } = await supabase.from('sim_plans').select('*');
                if (dbPlans && dbPlans.length > 0) {
                    const dbMap = new Map<string, any>();
                    dbPlans.forEach(p => {
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
            Alert.alert("Plan Required", "Zaɓi katin SIM don ci gaba.");
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
            Alert.alert("SIM Purchase Failed", err.message || "An samu matsala wajen siyan SIM. Ba a cire kudi a wallet dinka ba.");
        } finally {
            setProcessing(false);
        }
    };

    const activeMeta = selectedPlan ? getPlanMeta(selectedPlan) : SIM_NETWORKS_META.ratel;

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1, backgroundColor: '#070D1E' }}
        >
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Ultra Modern Smooth Header */}
            <View style={[s.header, { paddingTop: insets.top + 6 }]}>
                <TouchableOpacity 
                    onPress={() => router.back()} 
                    style={s.backBtn} 
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={s.headerTitle}>SIM Cards</Text>
                    <Text style={s.headerSubtitle}>Order & Instant Activation</Text>
                </View>

                <TouchableOpacity 
                    onPress={() => router.push('/wallet')} 
                    style={s.balancePill}
                    activeOpacity={0.8}
                >
                    <Ionicons name="wallet" size={14} color="#F5A623" />
                    <Text style={s.balanceText}>
                        ₦{balance !== null ? balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '••••'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={s.scroll}
                contentContainerStyle={[s.scrollContent, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A623" />}
            >
                {/* Maintenance Alert */}
                {isMaintenance && (
                    <View style={s.maintenanceBox}>
                        <Ionicons name="alert-circle" size={20} color="#D97706" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.maintenanceTitle}>Sabis ɗin SIM na Gyara</Text>
                            <Text style={s.maintenanceDesc}>{maintenanceMsg}</Text>
                        </View>
                    </View>
                )}

                {/* Modern Glossy Virtual SIM Card Preview */}
                {selectedPlan && (
                    <LinearGradient
                        colors={[activeMeta.color, '#0B132B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.simCardPreview}
                    >
                        {/* Top Row: Chip + Brand */}
                        <View style={s.previewTop}>
                            <View style={s.chipGraphic}>
                                <View style={s.chipLineHoriz} />
                                <View style={s.chipLineVert} />
                                <Ionicons name="hardware-chip" size={18} color="#EAB308" />
                            </View>
                            <View style={s.networkLogoWrap}>
                                <Image source={activeMeta.logo} style={s.previewLogo} resizeMode="contain" />
                            </View>
                        </View>

                        {/* Mid Row: SIM Name & Format */}
                        <View style={s.previewMid}>
                            <Text style={s.previewPlanName}>{selectedPlan.name.toUpperCase()}</Text>
                            <Text style={s.previewPhoneNum}>
                                {phoneNumber ? phoneNumber.replace(/(\d{4})(\d{3})(\d{4})/, '$1  $2  $3') : '+234  ••••  ••••'}
                            </Text>
                        </View>

                        {/* Bottom Row: Speed & Price */}
                        <View style={s.previewBottom}>
                            <View>
                                <Text style={s.previewSubLabel}>NETWORK</Text>
                                <Text style={s.previewSubVal}>{activeMeta.tag}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={s.previewSubLabel}>PRICE</Text>
                                <Text style={s.previewPrice}>₦{selectedPlan.price.toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                )}

                {/* Success Banner if purchased */}
                {purchasedSim && (
                    <View style={s.successBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                            <Text style={s.successTitle}>An Yi Nasarar Siyan SIM!</Text>
                        </View>
                        <Text style={s.successSubtitle}>Ref: {purchasedSim.refNo}</Text>
                        {purchasedSim.number && (
                            <TouchableOpacity 
                                onPress={() => {
                                    Clipboard.setStringAsync(purchasedSim.number || '');
                                    Alert.alert("An Kwafa", "An kwafi lambar SIM");
                                }}
                                style={s.copyNumberPill}
                            >
                                <Text style={s.copyNumberText}>Lamba: {purchasedSim.number}</Text>
                                <Ionicons name="copy-outline" size={14} color="#0284C7" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            onPress={() => setPurchasedSim(null)}
                            style={s.dismissSuccessBtn}
                        >
                            <Text style={s.dismissSuccessText}>Yayi Kyau</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 1. Horizontal SIM Selection Bubbles / Cards */}
                <Text style={s.sectionTitle}>Zaɓi Network SIM</Text>
                {loadingPlans ? (
                    <View style={s.loadingWrap}>
                        <ActivityIndicator size="small" color="#F5A623" />
                        <Text style={s.loadingTxt}>Ana loda jerin SIM...</Text>
                    </View>
                ) : (
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        contentContainerStyle={s.hList}
                    >
                        {simPlans.map(plan => {
                            const isSel = selectedPlan?._id === plan._id;
                            const meta = getPlanMeta(plan);
                            return (
                                <TouchableOpacity
                                    key={plan._id}
                                    onPress={() => {
                                        setSelectedPlan(plan);
                                        try { Haptics.selectionAsync(); } catch {}
                                    }}
                                    activeOpacity={0.8}
                                    style={[
                                        s.hCard,
                                        isSel && { borderColor: meta.color, backgroundColor: '#131F3F' }
                                    ]}
                                >
                                    <View style={[s.hCardLogo, { borderColor: meta.color + '44' }]}>
                                        <Image source={meta.logo} style={s.hLogoImg} resizeMode="contain" />
                                    </View>
                                    <Text style={[s.hCardName, isSel && { color: '#FFFFFF' }]} numberOfLines={1}>
                                        {plan.name.replace(' SIM Card', '')}
                                    </Text>
                                    <Text style={[s.hCardPrice, { color: isSel ? '#F5A623' : '#94A3B8' }]}>
                                        ₦{plan.price.toLocaleString()}
                                    </Text>
                                    {isSel && (
                                        <View style={[s.hActiveDot, { backgroundColor: meta.color }]} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* 2. Format Selector: Physical SIM or eSIM */}
                <Text style={s.sectionTitle}>Nau'in SIM (Format)</Text>
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
                            size={18} 
                            color={simFormat === 'standard' ? '#070D1E' : '#94A3B8'} 
                        />
                        <Text style={[s.formatPillTxt, simFormat === 'standard' && s.formatPillTxtActive]}>
                            Physical SIM Card
                        </Text>
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
                            name="qr-code" 
                            size={16} 
                            color={simFormat === 'esim' ? '#070D1E' : '#94A3B8'} 
                        />
                        <Text style={[s.formatPillTxt, simFormat === 'esim' && s.formatPillTxtActive]}>
                            eSIM Profile (QR)
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* 3. Streamlined Clean Form */}
                <Text style={s.sectionTitle}>Bayanai & Isarwa</Text>
                <View style={s.formBox}>
                    <View style={s.field}>
                        <Text style={s.fieldLabel}>Lambar Waya (Contact Phone) *</Text>
                        <View style={s.fieldInputWrap}>
                            <Ionicons name="call-outline" size={17} color="#94A3B8" />
                            <TextInput
                                placeholder="e.g. 08012345678"
                                placeholderTextColor="#64748B"
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                style={s.inputTxt}
                            />
                        </View>
                    </View>

                    <View style={s.field}>
                        <Text style={s.fieldLabel}>Email (Don samun eSIM / Rasit)</Text>
                        <View style={s.fieldInputWrap}>
                            <Ionicons name="mail-outline" size={17} color="#94A3B8" />
                            <TextInput
                                placeholder="name@example.com"
                                placeholderTextColor="#64748B"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={emailAddress}
                                onChangeText={setEmailAddress}
                                style={s.inputTxt}
                            />
                        </View>
                    </View>

                    {simFormat === 'standard' && (
                        <View style={s.field}>
                            <Text style={s.fieldLabel}>Adireshin Karɓa (Address / Station)</Text>
                            <View style={s.fieldInputWrap}>
                                <Ionicons name="location-outline" size={17} color="#94A3B8" />
                                <TextInput
                                    placeholder="Jiha, Gari, ko Unguwa"
                                    placeholderTextColor="#64748B"
                                    value={deliveryAddress}
                                    onChangeText={setDeliveryAddress}
                                    style={s.inputTxt}
                                />
                            </View>
                        </View>
                    )}
                </View>

                {/* 4. Pay Button Bottom Action */}
                {selectedPlan && (
                    <View style={s.actionWrap}>
                        <TouchableOpacity
                            onPress={handleInitiatePurchase}
                            disabled={processing}
                            style={[s.checkoutBtn, processing && { opacity: 0.6 }]}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#F5A623', '#D97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.checkoutGradient}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#070D1E" />
                                ) : (
                                    <>
                                        <Ionicons name="shield-checkmark" size={18} color="#070D1E" />
                                        <Text style={s.checkoutTxt}>
                                            Biya ₦{selectedPlan.price.toLocaleString()} & Yi Oda
                                        </Text>
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
                title="Tabbatar da PIN"
            />
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#070D1E',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    balanceText: {
        color: '#F5A623',
        fontSize: 12,
        fontWeight: '900',
    },
    scroll: {
        flex: 1,
        backgroundColor: '#070D1E',
    },
    scrollContent: {
        padding: 16,
    },
    maintenanceBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 14,
        padding: 14,
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
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
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
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        borderWidth: 1.5,
        borderColor: '#EAB308',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    chipLineHoriz: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(234, 179, 8, 0.4)',
    },
    chipLineVert: {
        position: 'absolute',
        height: '100%',
        width: 1,
        backgroundColor: 'rgba(234, 179, 8, 0.4)',
    },
    networkLogoWrap: {
        width: 42,
        height: 42,
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
        color: 'rgba(255,255,255,0.7)',
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
        color: '#F5A623',
    },
    successBox: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#10B981',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#10B981',
        marginLeft: 8,
    },
    successSubtitle: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
    },
    copyNumberPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#070D1E',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginTop: 10,
    },
    copyNumberText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#38BDF8',
    },
    dismissSuccessBtn: {
        backgroundColor: '#10B981',
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
    sectionTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    loadingWrap: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingTxt: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 6,
    },
    hList: {
        gap: 10,
        paddingRight: 10,
        marginBottom: 22,
    },
    hCard: {
        width: 105,
        backgroundColor: '#0F1833',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        position: 'relative',
    },
    hCardLogo: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        borderWidth: 1,
        marginBottom: 8,
    },
    hLogoImg: {
        width: '100%',
        height: '100%',
    },
    hCardName: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#CBD5E1',
        textAlign: 'center',
    },
    hCardPrice: {
        fontSize: 12,
        fontWeight: '900',
        marginTop: 3,
    },
    hActiveDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    formatRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 22,
    },
    formatPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0F1833',
        borderRadius: 14,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    formatPillActive: {
        backgroundColor: '#F5A623',
        borderColor: '#F5A623',
    },
    formatPillTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
    },
    formatPillTxtActive: {
        color: '#070D1E',
    },
    formBox: {
        backgroundColor: '#0F1833',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 20,
    },
    field: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: 6,
    },
    fieldInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#070D1E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 12,
        height: 46,
        gap: 10,
    },
    inputTxt: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '600',
    },
    actionWrap: {
        marginTop: 4,
    },
    checkoutBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#F5A623',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
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
        color: '#070D1E',
    },
});
