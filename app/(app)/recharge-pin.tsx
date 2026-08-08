import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Modal,
    Share,
    Alert,
    Platform,
    StyleSheet,
    Image,
    Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

// Official Network Logos
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    glo: require('../../assets/images/glo.png'),
    airtel: require('../../assets/images/airtel.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
    vitel: require('../../assets/images/vitel.png'),
};

const NETWORKS = [
    { id: 'mtn', name: 'MTN', color: '#eab308', bg: '#fffbeb', border: '#eab308', status: '5G Ready' },
    { id: 'glo', name: 'GLO', color: '#16a34a', bg: '#f0fdf4', border: '#16a34a', status: '4G LTE' },
    { id: 'airtel', name: 'Airtel', color: '#dc2626', bg: '#fef2f2', border: '#ef4444', status: '5G Ready' },
    { id: '9mobile', name: '9Mobile', color: '#0d9488', bg: '#f0fdfa', border: '#14b8a6', status: '4G Active' },
    { id: 'vitel', name: 'VITEL', color: '#6366f1', bg: '#eef2ff', border: '#6366f1', status: 'Special' }
];

export default function RechargePinScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [allPlans, setAllPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

    const [quantity, setQuantity] = useState('1');
    const [businessName, setBusinessName] = useState('ABU MAFHAL VTU');

    const [userBalance, setUserBalance] = useState<number>(0);
    const [purchasing, setPurchasing] = useState(false);

    // Success Modal State
    const [successModal, setSuccessModal] = useState<{
        visible: boolean;
        txData: any | null;
    }>({
        visible: false,
        txData: null
    });

    useEffect(() => {
        fetchUserData();
        loadRechargePlans();
    }, []);

    const fetchUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('balance, full_name').eq('id', user.id).single();
            if (profile) {
                setUserBalance(parseFloat(profile.balance || 0));
            }
        } catch (_) {}
    };

    const loadRechargePlans = async () => {
        setLoadingPlans(true);
        try {
            const plans = await api.rechargePin.getPlans();
            setAllPlans(plans || []);
            const mtnPlans = (plans || []).filter((p: any) => p.networkName === 'mtn');
            if (mtnPlans.length > 0) {
                setSelectedPlan(mtnPlans[0]);
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to load recharge pin plans');
        } finally {
            setLoadingPlans(false);
        }
    };

    // Filter plans for selected network
    const networkPlans = allPlans.filter((p: any) => p.networkName === selectedNetwork);

    const handleSelectNetwork = (netId: string) => {
        setSelectedNetwork(netId);
        const filtered = allPlans.filter((p: any) => p.networkName === netId);
        if (filtered.length > 0) {
            setSelectedPlan(filtered[0]);
        } else {
            setSelectedPlan(null);
        }
    };

    const qtyNumber = Math.max(1, parseInt(quantity || '1', 10));
    const unitPrice = selectedPlan ? selectedPlan.price : 0;
    const totalCost = unitPrice * qtyNumber;

    const handleQuantityChange = (val: string) => {
        const cleaned = val.replace(/[^0-9]/g, '');
        setQuantity(cleaned);
    };

    const adjustQuantity = (delta: number) => {
        const current = parseInt(quantity || '1', 10);
        const updated = Math.max(1, current + delta);
        setQuantity(updated.toString());
    };

    const handlePurchase = async () => {
        if (!selectedPlan) {
            Alert.alert('Selection Required', 'Please select a recharge card denomination.');
            return;
        }

        if (totalCost > userBalance) {
            Alert.alert(
                'Insufficient Wallet Balance',
                `Your wallet balance (₦${userBalance.toLocaleString()}) is insufficient for this purchase (₦${totalCost.toLocaleString()}). Please fund your wallet.`
            );
            return;
        }

        setPurchasing(true);
        try {
            const res = await api.rechargePin.purchase({
                planId: selectedPlan.id,
                quantity: qtyNumber,
                businessName: businessName.trim() || 'ABU MAFHAL VTU'
            });

            setUserBalance(prev => Math.max(0, prev - totalCost));
            setSuccessModal({
                visible: true,
                txData: res
            });
        } catch (e: any) {
            Alert.alert('Purchase Failed ⚠️', e.message || 'Could not complete recharge pin purchase');
        } finally {
            setPurchasing(false);
        }
    };

    const copyPinToClipboard = async (pinText: string) => {
        await Clipboard.setStringAsync(pinText);
        Alert.alert('Copied ✅', 'Recharge PIN copied to clipboard!');
    };

    const copyAllPins = async () => {
        if (!successModal.txData || !successModal.txData.pins) return;
        const pinsList = successModal.txData.pins;
        const formatted = pinsList.map((p: any, index: number) => 
            `[${index + 1}] PIN: ${p.pin} | Serial: ${p.serial || 'N/A'} | Dial: ${p.load_code || successModal.txData.loadCode}`
        ).join('\n');
        
        await Clipboard.setStringAsync(formatted);
        Alert.alert('All PINs Copied ✅', 'All generated PINs copied to clipboard!');
    };

    const sharePins = async () => {
        if (!successModal.txData || !successModal.txData.pins) return;
        const pinsList = successModal.txData.pins;
        const textToShare = `=================================\n   ${(successModal.txData.businessName || 'ABU MAFHAL VTU').toUpperCase()}\n   RECHARGE CARD VOUCHERS (${successModal.txData.network})\n=================================\n` +
            pinsList.map((p: any, idx: number) => 
                `Card #${idx + 1} (${successModal.txData.denomination})\nPIN: ${p.pin}\nSerial: ${p.serial || 'N/A'}\nDial: ${p.load_code || successModal.txData.loadCode}`
            ).join('\n---------------------------------\n') +
            `\n=================================\nGenerated via ABU MAFHAL HUB`;

        try {
            await Share.share({ message: textToShare });
        } catch (_) {}
    };

    const currentNetInfo = NETWORKS.find(n => n.id === selectedNetwork) || NETWORKS[0];

    return (
        <View style={{ flex: 1, backgroundColor: '#f1f5f9', paddingTop: insets.top }}>
            {/* HERO GRADIENT HEADER */}
            <LinearGradient
                colors={['#0d1b3e', '#1e293b', '#0f172a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.heroHeader}
            >
                <View style={s.navRow}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={22} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={s.headerTitleCol}>
                        <Text style={s.heroTitle}>Recharge PIN Printing</Text>
                        <Text style={s.heroSub}>Generate & Print Branded Airtime Card PINs</Text>
                    </View>
                </View>

                {/* Floating Wallet Badge */}
                <View style={s.walletCard}>
                    <View style={s.walletLeft}>
                        <View style={s.walletIconBox}>
                            <Ionicons name="wallet-outline" size={20} color="#f5a623" />
                        </View>
                        <View>
                            <Text style={s.walletLabel}>Available Balance</Text>
                            <Text style={s.walletAmount}>₦{userBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push('/(app)/wallet')}
                        style={s.topUpBtn}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add-circle" size={16} color="#0d1b3e" style={{ marginRight: 4 }} />
                        <Text style={s.topUpTxt}>Top Up</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

                {/* STEP 1: NETWORK LOGOS SELECTION */}
                <View style={s.stepHeader}>
                    <View style={[s.stepBadge, { backgroundColor: '#0d1b3e' }]}>
                        <Text style={s.stepBadgeTxt}>STEP 1</Text>
                    </View>
                    <Text style={s.stepTitle}>Select Telecom Network</Text>
                </View>

                <View style={s.networkGrid}>
                    {NETWORKS.map(net => {
                        const isSelected = selectedNetwork === net.id;
                        const logoSource = NETWORK_LOGOS[net.id];

                        return (
                            <TouchableOpacity
                                key={net.id}
                                onPress={() => handleSelectNetwork(net.id)}
                                activeOpacity={0.85}
                                style={[
                                    s.netLogoCard,
                                    isSelected && {
                                        borderColor: net.color,
                                        borderWidth: 3,
                                        backgroundColor: net.bg,
                                        transform: [{ scale: 1.03 }]
                                    }
                                ]}
                            >
                                <View style={s.logoWrapper}>
                                    {logoSource ? (
                                        <Image source={logoSource} style={s.netLogoImage} resizeMode="contain" />
                                    ) : (
                                        <Ionicons name="cellular" size={28} color={net.color} />
                                    )}
                                </View>
                                <Text style={[s.netLogoName, isSelected && { color: net.color, fontWeight: '800' }]}>
                                    {net.name}
                                </Text>

                                {isSelected && (
                                    <View style={[s.activeCheckPill, { backgroundColor: net.color }]}>
                                        <Ionicons name="checkmark" size={10} color="#ffffff" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* STEP 2: DENOMINATION SELECTION */}
                <View style={s.stepHeader}>
                    <View style={[s.stepBadge, { backgroundColor: currentNetInfo.color }]}>
                        <Text style={s.stepBadgeTxt}>STEP 2</Text>
                    </View>
                    <Text style={s.stepTitle}>Select Card Value (Denomination)</Text>
                </View>

                {loadingPlans ? (
                    <View style={s.loadingContainer}>
                        <ActivityIndicator size="large" color="#0d1b3e" />
                        <Text style={s.loadingTxt}>Fetching live {selectedNetwork.toUpperCase()} recharge card values...</Text>
                    </View>
                ) : networkPlans.length === 0 ? (
                    <View style={s.emptyBox}>
                        <Ionicons name="alert-circle-outline" size={36} color="#94a3b8" />
                        <Text style={s.emptyTitle}>No Recharge PINs Available</Text>
                        <Text style={s.emptySub}>
                            {selectedNetwork.toUpperCase()} recharge card PINs are currently out of stock or being updated by vendor. Please check another network.
                        </Text>
                    </View>
                ) : (
                    <View style={s.denomGrid}>
                        {networkPlans.map((plan: any) => {
                            const isSelected = selectedPlan?.id === plan.id;
                            const sizeVal = parseFloat(plan.size || '100');
                            const discountAmount = plan.price < sizeVal ? (sizeVal - plan.price).toFixed(1) : null;

                            return (
                                <TouchableOpacity
                                    key={plan.id}
                                    onPress={() => setSelectedPlan(plan)}
                                    activeOpacity={0.85}
                                    style={[
                                        s.denomCard,
                                        isSelected && [s.denomCardSelected, { borderColor: currentNetInfo.color }]
                                    ]}
                                >
                                    <View style={s.denomHeaderRow}>
                                        <Text style={s.denomVal}>{plan.denomination}</Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={22} color={currentNetInfo.color} />
                                        )}
                                    </View>

                                    <View style={s.denomPriceRow}>
                                        <Text style={s.denomPriceLabel}>Price:</Text>
                                        <Text style={s.denomPriceVal}>₦{plan.price.toLocaleString()}</Text>
                                    </View>

                                    {discountAmount && (
                                        <View style={s.discountTag}>
                                            <Ionicons name="pricetag" size={10} color="#d97706" style={{ marginRight: 3 }} />
                                            <Text style={s.discountTagTxt}>Save ₦{discountAmount} per card</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* STEP 3: QUANTITY & BRANDING */}
                <View style={s.stepHeader}>
                    <View style={[s.stepBadge, { backgroundColor: '#0d1b3e' }]}>
                        <Text style={s.stepBadgeTxt}>STEP 3</Text>
                    </View>
                    <Text style={s.stepTitle}>Quantity & Card Customization</Text>
                </View>

                <View style={s.customBox}>
                    {/* Quantity Controller */}
                    <Text style={s.fieldLabel}>How Many Cards Do You Want To Print?</Text>
                    <View style={s.bigQtyRow}>
                        <TouchableOpacity onPress={() => adjustQuantity(-1)} style={s.bigQtyBtn} activeOpacity={0.7}>
                            <Ionicons name="remove" size={24} color="#0d1b3e" />
                        </TouchableOpacity>

                        <TextInput
                            style={s.bigQtyInput}
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={handleQuantityChange}
                        />

                        <TouchableOpacity onPress={() => adjustQuantity(1)} style={s.bigQtyBtn} activeOpacity={0.7}>
                            <Ionicons name="add" size={24} color="#0d1b3e" />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Quantity Shortcuts */}
                    <View style={s.shortcutRow}>
                        {['1', '5', '10', '20', '50'].map(val => (
                            <TouchableOpacity
                                key={val}
                                onPress={() => setQuantity(val)}
                                style={[
                                    s.shortcutBtn,
                                    quantity === val && { backgroundColor: '#0d1b3e', borderColor: '#0d1b3e' }
                                ]}
                            >
                                <Text style={[
                                    s.shortcutBtnTxt,
                                    quantity === val && { color: '#ffffff', fontWeight: '800' }
                                ]}>
                                    {val}x
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Business Branding Title Input */}
                    <View style={{ marginTop: 16 }}>
                        <Text style={s.fieldLabel}>Business / Store Name (Printed On Voucher)</Text>
                        <View style={s.textInputWrapper}>
                            <Ionicons name="business-outline" size={20} color="#64748b" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.brandInput}
                                placeholder="e.g. ABU MAFHAL VTU SERVICES"
                                placeholderTextColor="#94a3b8"
                                value={businessName}
                                onChangeText={setBusinessName}
                            />
                        </View>
                    </View>
                </View>

                {/* VOUCHER PREVIEW TICKET CARD */}
                <Text style={s.sectionHeaderTitle}>Voucher Card Live Preview</Text>
                <View style={s.voucherPreviewCard}>
                    <View style={s.voucherHeader}>
                        <Image source={NETWORK_LOGOS[selectedNetwork] || NETWORK_LOGOS.mtn} style={s.previewLogo} resizeMode="contain" />
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={s.previewBrand} numberOfLines={1}>{(businessName || 'ABU MAFHAL VTU').toUpperCase()}</Text>
                            <Text style={s.previewDenom}>{selectedPlan ? selectedPlan.denomination : '₦100'}</Text>
                        </View>
                    </View>

                    <View style={s.voucherDottedLine} />

                    <View style={s.previewPinBox}>
                        <Text style={s.previewPinLabel}>SAMPLE PIN CODE:</Text>
                        <Text style={s.previewPinValue}>5829 - 4910 - 2841 - 0942</Text>
                        <Text style={s.previewDial}>Dial: *311*5829491028410942# to load</Text>
                    </View>
                </View>

                {/* ORDER SUMMARY & BIG ACTION BUTTON */}
                <View style={s.orderSummaryCard}>
                    <Text style={s.orderTitle}>Order & Payment Details</Text>

                    <View style={s.orderRow}>
                        <Text style={s.orderLabel}>Network:</Text>
                        <Text style={s.orderVal}>{selectedNetwork.toUpperCase()}</Text>
                    </View>

                    <View style={s.orderRow}>
                        <Text style={s.orderLabel}>Denomination:</Text>
                        <Text style={s.orderVal}>{selectedPlan ? selectedPlan.denomination : 'N/A'}</Text>
                    </View>

                    <View style={s.orderRow}>
                        <Text style={s.orderLabel}>Quantity:</Text>
                        <Text style={s.orderVal}>{qtyNumber} Card(s)</Text>
                    </View>

                    <View style={s.orderRow}>
                        <Text style={s.orderLabel}>Unit Price:</Text>
                        <Text style={s.orderVal}>₦{unitPrice.toLocaleString()}</Text>
                    </View>

                    <View style={s.summaryDivider} />

                    <View style={s.orderTotalRow}>
                        <Text style={s.orderTotalLabel}>Total Price:</Text>
                        <Text style={s.orderTotalVal}>₦{totalCost.toLocaleString()}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={handlePurchase}
                        disabled={purchasing || !selectedPlan}
                        activeOpacity={0.85}
                        style={[
                            s.mainActionBtn,
                            (purchasing || !selectedPlan) && { opacity: 0.6 }
                        ]}
                    >
                        {purchasing ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="print" size={22} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={s.mainActionBtnTxt}>Generate {qtyNumber} Recharge PIN(s)</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* HIGH END PRINTED RECHARGE PINS MODAL */}
            <Modal
                visible={successModal.visible}
                transparent
                animationType="slide"
                onRequestClose={() => setSuccessModal({ visible: false, txData: null })}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContainer}>

                        {/* Success Header */}
                        <View style={s.modalBanner}>
                            <View style={s.modalCheckIcon}>
                                <Ionicons name="checkmark-circle" size={36} color="#16a34a" />
                            </View>
                            <Text style={s.modalBannerTitle}>Recharge PINs Ready! 🎉</Text>
                            <Text style={s.modalBannerSub}>
                                Generated {successModal.txData?.quantity}x {successModal.txData?.network} {successModal.txData?.denomination} Recharge Cards
                            </Text>
                        </View>

                        {/* PIN List */}
                        <ScrollView style={{ maxHeight: 360, paddingHorizontal: 16, marginVertical: 10 }}>
                            {successModal.txData?.pins?.map((pinObj: any, idx: number) => (
                                <View key={idx} style={s.voucherCardItem}>
                                    <View style={s.voucherItemTop}>
                                        <Image
                                            source={NETWORK_LOGOS[selectedNetwork] || NETWORK_LOGOS.mtn}
                                            style={{ width: 28, height: 28 }}
                                            resizeMode="contain"
                                        />
                                        <Text style={s.voucherItemBrand}>
                                            {(successModal.txData?.businessName || 'ABU MAFHAL VTU').toUpperCase()}
                                        </Text>
                                        <Text style={s.voucherItemDenom}>
                                            {successModal.txData?.denomination}
                                        </Text>
                                    </View>

                                    <View style={s.voucherItemPinBox}>
                                        <Text style={s.voucherPinTag}>RECHARGE PIN #{idx + 1}:</Text>
                                        <Text style={s.voucherPinCode}>{pinObj.pin}</Text>
                                        <Text style={s.voucherPinDial}>
                                            Dial: {pinObj.load_code || successModal.txData?.loadCode || '*311*PIN#'}
                                        </Text>
                                        {pinObj.serial && <Text style={s.voucherPinSerial}>S/N: {pinObj.serial}</Text>}
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => copyPinToClipboard(pinObj.pin)}
                                        style={s.itemCopyBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="copy" size={14} color="#0d1b3e" style={{ marginRight: 4 }} />
                                        <Text style={s.itemCopyBtnTxt}>Copy PIN</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        {/* Modal Actions */}
                        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                <TouchableOpacity onPress={copyAllPins} style={s.modalPrimaryBtn} activeOpacity={0.85}>
                                    <Ionicons name="copy" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={s.modalPrimaryBtnTxt}>Copy All PINs</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={sharePins} style={[s.modalPrimaryBtn, { backgroundColor: '#16a34a' }]} activeOpacity={0.85}>
                                    <Ionicons name="share-social" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={s.modalPrimaryBtnTxt}>Share / Print</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={() => setSuccessModal({ visible: false, txData: null })}
                                style={s.modalDoneBtn}
                            >
                                <Text style={s.modalDoneBtnTxt}>Done / Back to Screen</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    heroHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    headerTitleCol: {
        flex: 1
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#ffffff'
    },
    heroSub: {
        fontSize: 12,
        color: '#cbd5e1',
        marginTop: 2
    },
    walletCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        padding: 14
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    walletIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(245,166,35,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    walletLabel: {
        fontSize: 11,
        color: '#94a3b8'
    },
    walletAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: '#ffffff'
    },
    topUpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5a623',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20
    },
    topUpTxt: {
        color: '#0d1b3e',
        fontWeight: '800',
        fontSize: 12
    },
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 12
    },
    stepBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8
    },
    stepBadgeTxt: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 10
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    networkGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    netLogoCard: {
        width: (W - 32 - 12) / 2,
        height: 100,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        position: 'relative'
    },
    logoWrapper: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    netLogoImage: {
        width: 44,
        height: 44
    },
    netLogoName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155'
    },
    activeCheckPill: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center'
    },
    denomGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    denomCard: {
        width: (W - 32 - 12) / 2,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1
    },
    denomCardSelected: {
        backgroundColor: '#ffffff',
        borderWidth: 3,
        shadowOpacity: 0.1,
        shadowRadius: 8
    },
    denomHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    denomVal: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0d1b3e'
    },
    denomPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6
    },
    denomPriceLabel: {
        fontSize: 12,
        color: '#64748b',
        marginRight: 4
    },
    denomPriceVal: {
        fontSize: 15,
        fontWeight: '800',
        color: '#16a34a'
    },
    discountTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start'
    },
    discountTagTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#b45309'
    },
    customBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8
    },
    bigQtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    bigQtyBtn: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    bigQtyInput: {
        flex: 1,
        height: 52,
        backgroundColor: '#f8fafc',
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        marginHorizontal: 12,
        textAlign: 'center',
        fontWeight: '900',
        fontSize: 22,
        color: '#0d1b3e'
    },
    shortcutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12
    },
    shortcutBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 3
    },
    shortcutBtnTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569'
    },
    textInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48
    },
    brandInput: {
        flex: 1,
        height: 48,
        fontSize: 15,
        fontWeight: '700',
        color: '#0d1b3e'
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0d1b3e',
        marginTop: 22,
        marginBottom: 10
    },
    voucherPreviewCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: '#0d1b3e',
        borderStyle: 'dashed'
    },
    voucherHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    previewLogo: {
        width: 38,
        height: 38
    },
    previewBrand: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0d1b3e'
    },
    previewDenom: {
        fontSize: 18,
        fontWeight: '900',
        color: '#16a34a',
        marginTop: 2
    },
    voucherDottedLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        marginVertical: 12
    },
    previewPinBox: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 12,
        alignItems: 'center'
    },
    previewPinLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b'
    },
    previewPinValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
        letterSpacing: 2,
        marginVertical: 4
    },
    previewDial: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600'
    },
    orderSummaryCard: {
        backgroundColor: '#0d1b3e',
        borderRadius: 20,
        padding: 20,
        marginTop: 24
    },
    orderTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#ffffff',
        marginBottom: 14
    },
    orderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    orderLabel: {
        fontSize: 14,
        color: '#94a3b8'
    },
    orderVal: {
        fontSize: 14,
        fontWeight: '800',
        color: '#ffffff'
    },
    summaryDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginVertical: 12
    },
    orderTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff'
    },
    orderTotalVal: {
        fontSize: 22,
        fontWeight: '900',
        color: '#4ade80'
    },
    mainActionBtn: {
        backgroundColor: '#22c55e',
        borderRadius: 14,
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18
    },
    mainActionBtnTxt: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 16
    },
    loadingContainer: {
        padding: 30,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    loadingTxt: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600'
    },
    emptyBox: {
        padding: 24,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0d1b3e',
        marginTop: 8
    },
    emptySub: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 27, 62, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    modalContainer: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        overflow: 'hidden'
    },
    modalBanner: {
        backgroundColor: '#f0fdf4',
        padding: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#bbf7d0'
    },
    modalCheckIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    modalBannerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#15803d'
    },
    modalBannerSub: {
        fontSize: 13,
        color: '#166534',
        marginTop: 2
    },
    voucherCardItem: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    voucherItemTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    voucherItemBrand: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0d1b3e'
    },
    voucherItemDenom: {
        fontSize: 16,
        fontWeight: '900',
        color: '#16a34a'
    },
    voucherItemPinBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        marginBottom: 10
    },
    voucherPinTag: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748b'
    },
    voucherPinCode: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
        letterSpacing: 2,
        marginVertical: 4
    },
    voucherPinDial: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155'
    },
    voucherPinSerial: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2
    },
    itemCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    itemCopyBtnTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    modalPrimaryBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 46,
        backgroundColor: '#0d1b3e',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalPrimaryBtnTxt: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 14
    },
    modalDoneBtn: {
        paddingVertical: 10,
        alignItems: 'center'
    },
    modalDoneBtnTxt: {
        color: '#64748b',
        fontWeight: '800',
        fontSize: 14
    }
});
