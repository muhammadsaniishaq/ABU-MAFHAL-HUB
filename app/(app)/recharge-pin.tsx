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
    StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';

// Networks Config
const NETWORKS = [
    { id: 'mtn', name: 'MTN', color: '#eab308', bg: '#fef9c3', border: '#fde047', icon: 'cellular' },
    { id: 'glo', name: 'GLO', color: '#16a34a', bg: '#dcfce7', border: '#86efac', icon: 'cellular' },
    { id: 'airtel', name: 'Airtel', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: 'cellular' },
    { id: '9mobile', name: '9Mobile', color: '#0d9488', bg: '#ccfbf1', border: '#5eead4', icon: 'cellular' }
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
            // Auto select first MTN plan
            const mtnPlans = plans.filter((p: any) => p.networkName === 'mtn');
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
                `Your wallet balance (₦${userBalance.toLocaleString()}) is not enough for this purchase (₦${totalCost.toLocaleString()}). Please fund your wallet.`
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
        const textToShare = `--- RECHARGE PINS (${successModal.txData.network}) ---\nBusiness: ${successModal.txData.businessName}\nAmount: ${successModal.txData.denomination}\n` +
            pinsList.map((p: any) => `PIN: ${p.pin}\nDial: ${p.load_code || successModal.txData.loadCode}`).join('\n\n') +
            `\n\nGenerated via ABU MAFHAL VTU`;

        try {
            await Share.share({ message: textToShare });
        } catch (_) {}
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0d1b3e" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>Recharge PIN Printing</Text>
                    <Text style={s.headerSub}>Print & Sell Airtime Recharge Card PINs</Text>
                </View>
                <View style={s.balancePill}>
                    <Ionicons name="wallet" size={14} color="#f5a623" />
                    <Text style={s.balanceTxt}>₦{userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                
                {/* 1. SELECT NETWORK */}
                <Text style={s.sectionTitle}>1. Select Telecom Network</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {NETWORKS.map(net => {
                        const isSelected = selectedNetwork === net.id;
                        return (
                            <TouchableOpacity
                                key={net.id}
                                onPress={() => handleSelectNetwork(net.id)}
                                activeOpacity={0.8}
                                style={[
                                    s.netCard,
                                    isSelected && { borderColor: net.color, backgroundColor: net.bg, borderWidth: 2 }
                                ]}
                            >
                                <View style={[s.netIconBox, { backgroundColor: net.color }]}>
                                    <Ionicons name="cellular" size={16} color="#ffffff" />
                                </View>
                                <Text style={[s.netName, isSelected && { color: net.color, fontWeight: '800' }]}>{net.name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 2. SELECT DENOMINATION */}
                <Text style={s.sectionTitle}>2. Select Recharge Card Value</Text>
                
                {loadingPlans ? (
                    <View style={{ padding: 30, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0d1b3e" />
                        <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Fetching live recharge pin denominations...</Text>
                    </View>
                ) : networkPlans.length === 0 ? (
                    <View style={s.emptyBox}>
                        <Ionicons name="alert-circle-outline" size={28} color="#94a3b8" />
                        <Text style={s.emptyTxt}>No recharge card PINs available for {selectedNetwork.toUpperCase()} currently.</Text>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                        {networkPlans.map((plan: any) => {
                            const isSelected = selectedPlan?.id === plan.id;
                            const discount = plan.regularPrice < parseFloat(plan.size) 
                                ? (parseFloat(plan.size) - plan.regularPrice).toFixed(1)
                                : null;

                            return (
                                <TouchableOpacity
                                    key={plan.id}
                                    onPress={() => setSelectedPlan(plan)}
                                    activeOpacity={0.8}
                                    style={[
                                        s.planCard,
                                        isSelected && s.planCardSelected
                                    ]}
                                >
                                    <Text style={[s.planSize, isSelected && { color: '#0d1b3e' }]}>{plan.denomination}</Text>
                                    <Text style={s.planPrice}>Price: ₦{plan.price.toLocaleString()}</Text>
                                    {discount && (
                                        <View style={s.discountBadge}>
                                            <Text style={s.discountTxt}>Save ₦{discount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* 3. QUANTITY & BUSINESS NAME */}
                <Text style={s.sectionTitle}>3. Quantity & Custom Card Title</Text>
                <View style={s.cardContainer}>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={s.inputLabel}>Number of Recharge Cards (Quantity)</Text>
                        <View style={s.qtyRow}>
                            <TouchableOpacity onPress={() => adjustQuantity(-1)} style={s.qtyBtn}>
                                <Ionicons name="remove" size={18} color="#0d1b3e" />
                            </TouchableOpacity>
                            <TextInput
                                style={s.qtyInput}
                                keyboardType="numeric"
                                value={quantity}
                                onChangeText={handleQuantityChange}
                            />
                            <TouchableOpacity onPress={() => adjustQuantity(1)} style={s.qtyBtn}>
                                <Ionicons name="add" size={18} color="#0d1b3e" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View>
                        <Text style={s.inputLabel}>Business Name on Printed Card (Optional)</Text>
                        <TextInput
                            style={s.textInput}
                            placeholder="e.g. ABU MAFHAL VTU"
                            value={businessName}
                            onChangeText={setBusinessName}
                        />
                    </View>
                </View>

                {/* SUMMARY & ORDER CARD */}
                <View style={s.summaryCard}>
                    <Text style={s.summaryTitle}>Order Summary</Text>
                    
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Selected Network:</Text>
                        <Text style={s.summaryVal}>{selectedNetwork.toUpperCase()}</Text>
                    </View>

                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Denomination:</Text>
                        <Text style={s.summaryVal}>{selectedPlan ? selectedPlan.denomination : 'None'}</Text>
                    </View>

                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Quantity:</Text>
                        <Text style={s.summaryVal}>{qtyNumber} Card(s)</Text>
                    </View>

                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Unit Price:</Text>
                        <Text style={s.summaryVal}>₦{unitPrice.toLocaleString()}</Text>
                    </View>

                    <View style={s.divider} />

                    <View style={s.summaryRow}>
                        <Text style={s.totalLabel}>Total Payment Amount:</Text>
                        <Text style={s.totalVal}>₦{totalCost.toLocaleString()}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={handlePurchase}
                        disabled={purchasing || !selectedPlan}
                        style={[
                            s.buyBtn,
                            (purchasing || !selectedPlan) && { opacity: 0.6 }
                        ]}
                    >
                        {purchasing ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="key" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={s.buyBtnTxt}>Generate {qtyNumber} Recharge PIN(s)</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* SUCCESS MODAL FOR DISPLAYING GENERATED PINS */}
            <Modal
                visible={successModal.visible}
                transparent
                animationType="slide"
                onRequestClose={() => setSuccessModal({ visible: false, txData: null })}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <View style={s.successIconBox}>
                                <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
                            </View>
                            <Text style={s.modalTitle}>Recharge PINs Generated! 🎉</Text>
                            <Text style={s.modalSub}>
                                {successModal.txData?.quantity}x {successModal.txData?.network} {successModal.txData?.denomination} Recharge Card(s)
                            </Text>
                        </View>

                        <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
                            {successModal.txData?.pins?.map((pinObj: any, index: number) => (
                                <View key={index} style={s.pinItemCard}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.pinLabel}>PIN CODE #{index + 1}:</Text>
                                        <Text style={s.pinCodeTxt}>{pinObj.pin}</Text>
                                        <Text style={s.pinMetaTxt}>Dial: {pinObj.load_code || successModal.txData?.loadCode || '*311*PIN#'}</Text>
                                        {pinObj.serial && <Text style={s.pinMetaTxt}>Serial: {pinObj.serial}</Text>}
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => copyPinToClipboard(pinObj.pin)}
                                        style={s.copyBtn}
                                    >
                                        <Ionicons name="copy-outline" size={16} color="#0d1b3e" />
                                        <Text style={s.copyBtnTxt}>Copy</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                            <TouchableOpacity onPress={copyAllPins} style={s.actionModalBtn}>
                                <Ionicons name="copy" size={16} color="#ffffff" />
                                <Text style={s.actionModalBtnTxt}>Copy All</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={sharePins} style={[s.actionModalBtn, { backgroundColor: '#16a34a' }]}>
                                <Ionicons name="share-social" size={16} color="#ffffff" />
                                <Text style={s.actionModalBtnTxt}>Share / Print</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => setSuccessModal({ visible: false, txData: null })}
                            style={s.closeModalBtn}
                        >
                            <Text style={s.closeModalBtnTxt}>Done / Back to Dashboard</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    headerSub: {
        fontSize: 11,
        color: '#64748b'
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d1b3e',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20
    },
    balanceTxt: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 4
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0d1b3e',
        marginBottom: 10
    },
    netCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    netIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    netName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569'
    },
    planCard: {
        width: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        marginBottom: 8
    },
    planCardSelected: {
        borderColor: '#0d1b3e',
        borderWidth: 2,
        backgroundColor: '#f0f4ff'
    },
    planSize: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    planPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#16a34a',
        marginTop: 2
    },
    discountBadge: {
        marginTop: 6,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start'
    },
    discountTxt: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#d97706'
    },
    emptyBox: {
        padding: 20,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20
    },
    emptyTxt: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 6
    },
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    qtyBtn: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    qtyInput: {
        flex: 1,
        height: 40,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        marginHorizontal: 10,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 16,
        color: '#0d1b3e'
    },
    textInput: {
        height: 42,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#0d1b3e'
    },
    summaryCard: {
        backgroundColor: '#0d1b3e',
        borderRadius: 16,
        padding: 20
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 14
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    summaryLabel: {
        fontSize: 13,
        color: '#94a3b8'
    },
    summaryVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff'
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginVertical: 10
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffffff'
    },
    totalVal: {
        fontSize: 18,
        fontWeight: '800',
        color: '#4ade80'
    },
    buyBtn: {
        backgroundColor: '#22c55e',
        borderRadius: 12,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16
    },
    buyBtnTxt: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 15
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 27, 62, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 10
    },
    successIconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#16a34a'
    },
    modalSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    pinItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    pinLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b'
    },
    pinCodeTxt: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0d1b3e',
        letterSpacing: 1
    },
    pinMetaTxt: {
        fontSize: 11,
        color: '#475569',
        marginTop: 2
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    copyBtnTxt: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0d1b3e',
        marginLeft: 4
    },
    actionModalBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 42,
        backgroundColor: '#0d1b3e',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionModalBtnTxt: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13,
        marginLeft: 6
    },
    closeModalBtn: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center'
    },
    closeModalBtnTxt: {
        color: '#64748b',
        fontWeight: 'bold',
        fontSize: 14
    }
});
