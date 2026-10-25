import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Platform, StyleSheet, RefreshControl, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import { KetawancyService, KetawancySimPlan } from '../../services/ketawancy';
import SecurityModal from '../../components/SecurityModal';
import BrandAlertModal, { AlertType, BrandAlertState } from '../../components/BrandAlertModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const T = {
    navy: '#0d1b3e',
    navyMid: '#1e293b',
    gold: '#f5a623',
    goldDk: '#d4890e',
    white: '#ffffff',
    bg: '#f8fafc',
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
        features: ['Instant API Line Assignment', 'Voice & Unlimited Data']
    },
    kirani: {
        logo: require('../../assets/images/kirani.png'),
        color: '#2563EB',
        lightBg: '#EFF6FF',
        tag: 'Fast 4G Broadband',
        speed: 'Multi-band 4G',
        features: ['Nationwide Coverage', 'HD Voice & Bundles']
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
        features: ['Dedicated SIM', 'Instant Provisioning']
    },
    vitel: {
        logo: require('../../assets/images/vitel.png'),
        color: '#6366F1',
        lightBg: '#EEF2FF',
        tag: 'Special Carrier',
        speed: '4G LTE Voice',
        features: ['Corporate Ready', 'Multi-device Compatible']
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

    // Flow states
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [purchasedSim, setPurchasedSim] = useState<any>(null);
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [maintenanceMsg, setMaintenanceMsg] = useState('SIM Card activation service is temporarily undergoing scheduled maintenance.');

    // Executive In-App Alert State
    const [brandAlert, setBrandAlert] = useState<BrandAlertState>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttonText: 'OK',
    });

    const showAlert = (
        title: string,
        message: string,
        type: AlertType = 'info',
        buttonText: string = 'OK',
        onConfirm?: () => void,
        showCancel: boolean = false,
        cancelText: string = 'Cancel',
        onCancel?: () => void
    ) => {
        try {
            if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_) {}

        setBrandAlert({
            visible: true,
            title,
            message,
            type,
            buttonText,
            onConfirm,
            showCancel,
            cancelText,
            onCancel
        });
    };

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
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('balance, phone, full_name, email')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (profile) {
                    setBalance(Number(profile.balance || 0));
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
            showAlert("Maintenance Notice", maintenanceMsg, "warning");
            return;
        }

        if (!selectedPlan) {
            showAlert("Selection Required", "Please select a SIM card type to continue.", "info");
            return;
        }

        if (balance !== null && balance < selectedPlan.price) {
            showAlert(
                "Insufficient Wallet Balance",
                `Your wallet balance (₦${balance.toLocaleString()}) cannot cover this SIM purchase (₦${selectedPlan.price.toLocaleString()}). Please fund your wallet.`,
                "warning",
                "Fund Wallet",
                () => router.push('/wallet'),
                true,
                "Cancel"
            );
            return;
        }

        setShowSecurityModal(true);
    };

    const handleConfirmPurchase = async () => {
        setShowSecurityModal(false);
        if (!user || !selectedPlan) return;

        setProcessing(true);
        try {
            // Purchase SIM: debits wallet balance only if API call succeeds
            const result = await KetawancyService.purchaseSim({
                userId: user.id,
                planId: selectedPlan._id,
                planName: selectedPlan.name,
                price: selectedPlan.price
            });

            if (result.success) {
                try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}

                setBalance(result.newBalance);
                const assignedSim = {
                    ...result.simCard,
                    refNo: result.refNo,
                    planName: selectedPlan.name,
                    price: selectedPlan.price,
                    date: new Date().toLocaleDateString()
                };
                setPurchasedSim(assignedSim);

                const assignedPhone = result.simCard?.number || 'Assigned by Provider';
                showAlert(
                    "SIM Activated Successfully! 🎉",
                    `Your ${selectedPlan.name} is now active!\n\nReference: ${result.refNo}\nLine/SIM Number: ${assignedPhone}\nAmount Paid: ₦${selectedPlan.price.toLocaleString()}`,
                    "success",
                    "View SIM Details",
                    () => {}
                );
            }
        } catch (err: any) {
            const errorMsg = err?.message || "Failed to purchase SIM. Your wallet balance was not debited.";
            showAlert("Purchase Failed", errorMsg, "error");
        } finally {
            setProcessing(false);
        }
    };

    const activeMeta = selectedPlan ? getPlanMeta(selectedPlan) : SIM_NETWORKS_META.ratel;

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Header */}
            <LinearGradient 
                colors={['#060d21', '#0d1b3e']} 
                style={[s.headerContainer, { paddingTop: insets.top + 10 }]}
            >
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={s.headerTitle}>SIM Cards & eSIM</Text>
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
                            <Text style={s.maintenanceTitle}>Service Under Maintenance</Text>
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
                                {purchasedSim?.number ? purchasedSim.number : 'ONLINE INSTANT LINE'}
                            </Text>
                            <Text style={s.previewSubInfo}>
                                Digital Activation • Assigned directly via API
                            </Text>
                        </View>

                        <View style={s.previewBottom}>
                            <View>
                                <Text style={s.previewSubLabel}>NETWORK</Text>
                                <Text style={s.previewSubVal}>{activeMeta.tag}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={s.previewSubLabel}>ACTIVATION FEE</Text>
                                <Text style={s.previewPrice}>₦{selectedPlan.price.toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                )}

                {/* Success Order Box */}
                {purchasedSim && (
                    <View style={s.successBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
                            <View style={{ marginLeft: 10 }}>
                                <Text style={s.successTitle}>SIM Purchased Successfully!</Text>
                                <Text style={s.successSubtitle}>Reference: {purchasedSim.refNo}</Text>
                            </View>
                        </View>

                        <View style={s.assignedNumberBox}>
                            <Text style={s.assignedLabel}>Assigned Line Number:</Text>
                            <View style={s.assignedRow}>
                                <Text style={s.assignedValue}>{purchasedSim.number || 'Provisioned'}</Text>
                                {purchasedSim.number && (
                                    <TouchableOpacity 
                                        onPress={() => {
                                            Clipboard.setStringAsync(purchasedSim.number || '');
                                            Alert.alert("Copied", "SIM line number copied to clipboard");
                                        }}
                                        style={s.copyBtn}
                                    >
                                        <Ionicons name="copy-outline" size={16} color="#2563eb" />
                                        <Text style={s.copyBtnTxt}>Copy</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity 
                            onPress={() => setPurchasedSim(null)}
                            style={s.dismissSuccessBtn}
                        >
                            <Text style={s.dismissSuccessText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 1. Select SIM Type / Network Provider */}
                <View style={s.sectionHeader}>
                    <Ionicons name="cellular-outline" size={15} color="#0d1b3e" style={{ marginRight: 6 }} />
                    <Text style={s.sectionTitle}>Select SIM Provider</Text>
                </View>

                {loadingPlans ? (
                    <View style={s.loadingWrap}>
                        <ActivityIndicator size="small" color={T.navy} />
                        <Text style={s.loadingTxt}>Loading available SIM plans...</Text>
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
                                <Text style={s.triggerPlaceholder}>Tap to choose a Network SIM</Text>
                            </View>
                        )}
                        <View style={s.dropdownIconBox}>
                            <Ionicons name="chevron-down" size={18} color="#64748b" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* 2. Order Summary Card */}
                {selectedPlan && (
                    <View style={s.summaryCard}>
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>Plan Selected</Text>
                            <Text style={s.summaryVal}>{selectedPlan.name}</Text>
                        </View>
                        <View style={s.divider} />
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>Activation Type</Text>
                            <Text style={s.summaryVal}>Online Instant API Activation</Text>
                        </View>
                        <View style={s.divider} />
                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>Payment Method</Text>
                            <Text style={s.summaryVal}>Wallet Balance</Text>
                        </View>
                        <View style={s.divider} />
                        <View style={s.summaryRow}>
                            <Text style={[s.summaryLabel, { fontWeight: '800', color: '#0f172a' }]}>Total Cost</Text>
                            <Text style={s.summaryTotal}>₦{selectedPlan.price.toLocaleString()}</Text>
                        </View>
                    </View>
                )}

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
                                    <Ionicons name="flash" size={18} color="#0d1b3e" />
                                    <Text style={s.checkoutTxt}>
                                        Pay & Activate • ₦{selectedPlan.price.toLocaleString()}
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
                            <Text style={s.modalTitle}>Select Network Provider</Text>
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
                title="Verify Security PIN"
            />

            {/* In-App Executive Brand Alert Modal */}
            <BrandAlertModal
                visible={brandAlert.visible}
                title={brandAlert.title}
                message={brandAlert.message}
                type={brandAlert.type}
                buttonText={brandAlert.buttonText || 'OK'}
                onClose={() => {
                    const cb = brandAlert.onConfirm;
                    setBrandAlert(prev => ({ ...prev, visible: false }));
                    if (cb) cb();
                }}
                showCancel={brandAlert.showCancel}
                cancelText={brandAlert.cancelText}
                onCancel={() => {
                    const cb = brandAlert.onCancel;
                    setBrandAlert(prev => ({ ...prev, visible: false }));
                    if (cb) cb();
                }}
            />

            {/* Success SIM Assigned Modal */}
            {purchasedSim && (
                <Modal visible={Boolean(purchasedSim)} transparent animationType="fade">
                    <View style={s.modalOverlay}>
                        <View style={[s.modalContent, { maxWidth: 440, padding: 22 }]}>
                            <View style={{ alignItems: 'center', marginBottom: 14 }}>
                                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                    <Ionicons name="checkmark-done" size={32} color="#16A34A" />
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: T.navy }}>SIM Purchased Successfully</Text>
                                <Text style={{ fontSize: 12, color: T.sub, textAlign: 'center', marginTop: 4 }}>
                                    Your line is assigned and activated on the telecom provider gateway.
                                </Text>
                            </View>

                            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 12, color: T.sub }}>SIM Network</Text>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: T.navy }}>{purchasedSim.planName}</Text>
                                </View>
                                <View style={{ height: 1, backgroundColor: '#E2E8F0' }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: T.sub }}>Assigned Number</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#2563EB' }}>
                                            {purchasedSim.number || 'Provisioned Online'}
                                        </Text>
                                        {purchasedSim.number && (
                                            <TouchableOpacity onPress={() => Clipboard.setStringAsync(purchasedSim.number)}>
                                                <Ionicons name="copy-outline" size={14} color="#2563EB" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                <View style={{ height: 1, backgroundColor: '#E2E8F0' }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 12, color: T.sub }}>Reference ID</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: T.navy }}>{purchasedSim.refNo}</Text>
                                </View>
                                <View style={{ height: 1, backgroundColor: '#E2E8F0' }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 12, color: T.sub }}>Amount Debited</Text>
                                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#16A34A' }}>₦{Number(purchasedSim.price || 0).toLocaleString()}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => setPurchasedSim(null)}
                                style={{ backgroundColor: T.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 }}
                                activeOpacity={0.85}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
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
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
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
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1.5,
        marginTop: 4,
    },
    previewSubInfo: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 3,
        fontWeight: '500',
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
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#16a34a',
    },
    successSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    assignedNumberBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    assignedLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    assignedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    assignedValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0284c7',
        letterSpacing: 0.5,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    copyBtnTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#2563eb',
    },
    dismissSuccessBtn: {
        backgroundColor: '#16a34a',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 12,
    },
    dismissSuccessText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 12,
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
        marginBottom: 16,
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
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
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    summaryLabel: {
        fontSize: 12.5,
        color: '#64748b',
        fontWeight: '600',
    },
    summaryVal: {
        fontSize: 12.5,
        color: '#0f172a',
        fontWeight: '700',
    },
    summaryTotal: {
        fontSize: 16,
        fontWeight: '900',
        color: '#f5a623',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 4,
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
