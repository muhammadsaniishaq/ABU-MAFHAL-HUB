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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
    { id: 'mtn', name: 'MTN', stockDefault: 475 },
    { id: 'glo', name: 'GLO', stockDefault: 323 },
    { id: 'airtel', name: 'Airtel', stockDefault: 211 },
    { id: '9mobile', name: '9Mobile', stockDefault: 18 }
];

export default function RechargePinScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [allPlans, setAllPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

    const [quantity, setQuantity] = useState(2); // Default 2 pins like image
    const [nameOnCard, setNameOnCard] = useState('');
    const [userEmail, setUserEmail] = useState('');

    const [userBalance, setUserBalance] = useState<number>(474.00);
    const [purchasing, setPurchasing] = useState(false);

    // Success Result Modal State
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
            if (user.email) {
                setUserEmail(user.email);
                setNameOnCard(user.email);
            }
            const { data: profile } = await supabase.from('profiles').select('balance, full_name, email').eq('id', user.id).single();
            if (profile) {
                setUserBalance(parseFloat(profile.balance || 0));
                if (profile.email || profile.full_name) {
                    const defaultName = profile.email || profile.full_name || user.email || '';
                    setUserEmail(defaultName);
                    setNameOnCard(defaultName);
                }
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
            console.error('Failed to load recharge pin plans', e);
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

    const qtyNumber = Math.max(1, quantity);
    const unitPrice = selectedPlan ? selectedPlan.price : 98.9;
    const totalCost = Math.round(unitPrice * qtyNumber * 10) / 10;

    const handlePurchase = async () => {
        if (!selectedPlan) {
            Alert.alert('Selection Required', 'Please select a recharge card denomination.');
            return;
        }

        if (totalCost > userBalance) {
            Alert.alert(
                'Insufficient Wallet Balance',
                `Your wallet balance (₦${userBalance.toFixed(2)}) is insufficient for this purchase (₦${totalCost.toFixed(2)}). Please fund your wallet.`
            );
            return;
        }

        setPurchasing(true);
        try {
            const res = await api.rechargePin.purchase({
                planId: selectedPlan.id,
                quantity: qtyNumber,
                businessName: nameOnCard.trim() || userEmail || 'ABU MAFHAL VTU'
            });

            setUserBalance(prev => Math.max(0, prev - totalCost));
            setSuccessModal({
                visible: true,
                txData: {
                    ...res,
                    denomination: selectedPlan.denomination || `₦${selectedPlan.size || '100'}`,
                    network: selectedNetwork.toUpperCase(),
                    nameOnCard: nameOnCard.trim() || userEmail || 'ABU MAFHAL VTU'
                }
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
            `[${index + 1}] PIN: ${p.pin} | Serial: ${p.serial || (index + 1)} | Dial: ${p.load_code || successModal.txData.loadCode}`
        ).join('\n');
        
        await Clipboard.setStringAsync(formatted);
        Alert.alert('All PINs Copied ✅', 'All generated PINs copied to clipboard!');
    };

    const handlePrintCards = () => {
        if (!successModal.txData || !successModal.txData.pins) return;
        const tx = successModal.txData;
        const pins = tx.pins || [];

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Alert.alert('Popup Blocked', 'Please allow popups in your browser to print cards.');
                return;
            }

            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

            const cardsHtml = pins.map((p: any, idx: number) => `
                <div style="border: 1.5px solid #000; border-radius: 8px; padding: 10px; background: #fff; page-break-inside: avoid; font-family: monospace;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; font-weight: bold; font-family: sans-serif; word-break: break-all;">${(tx.nameOnCard || tx.businessName || 'ABU MAFHAL VTU').toLowerCase()}</span>
                        <span style="border: 1px solid #ccc; border-radius: 4px; padding: 1px 4px; font-size: 10px;">📋</span>
                    </div>
                    <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; line-height: 1.5;">
                            <div><strong>REF:</strong> ${tx.transactionId || 'RCP' + Date.now()}</div>
                            <div style="font-size: 13px; font-weight: bold; margin: 2px 0;"><strong>PIN:</strong> ${p.pin}</div>
                            <div><strong>S/N:</strong> ${p.serial || (idx + 1)}</div>
                            <div><strong>Date:</strong> ${formattedDate}</div>
                        </div>
                        <div style="width: 44px; height: 44px; background: #ffcc00; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; margin-left: 8px;">
                            ${(tx.network || 'MTN').toUpperCase()}
                        </div>
                    </div>
                    <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
                        <span>${p.load_code || tx.loadCode || '*311*PIN#'}</span>
                        <span>${tx.denomination || '₦100'}</span>
                    </div>
                </div>
            `).join('');

            const htmlDoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Recharge Cards - ${tx.nameOnCard || 'ABU MAFHAL'}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { margin: 0; padding: 10px; background: #fff; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <div class="grid">
                        ${cardsHtml}
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(htmlDoc);
            printWindow.document.close();
        } else {
            // Share on mobile
            const pinsList = successModal.txData.pins;
            const textToShare = pinsList.map((p: any, idx: number) => 
                `Card #${idx + 1} (${successModal.txData.denomination})\nPIN: ${p.pin}\nSerial: ${p.serial || (idx + 1)}\nDial: ${p.load_code || successModal.txData.loadCode}`
            ).join('\n\n');

            Share.share({ message: textToShare }).catch(() => {});
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
            
            {/* Header */}
            <View style={s.topNav}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color="#0d1b3e" />
                </TouchableOpacity>
                <Text style={s.topNavTitle}>Recharge PIN Printing</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* 1. SELECT NETWORK SECTION */}
                <View style={s.cardSection}>
                    <Text style={s.sectionHeader}>Select Network</Text>
                    
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
                                        s.netCardItem,
                                        isSelected && s.netCardItemSelected
                                    ]}
                                >
                                    <View style={s.netLogoBox}>
                                        <Image source={logoSource} style={s.netLogoImg} resizeMode="contain" />
                                    </View>
                                    <Text style={s.netNameTxt}>{net.name}</Text>
                                    <Text style={s.stockTxt}>{net.stockDefault} available</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 2. DENOMINATION SELECTION */}
                {networkPlans.length > 0 && (
                    <View style={s.cardSection}>
                        <Text style={s.sectionHeader}>Select Pin Value</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {networkPlans.map((plan: any) => {
                                const isSelected = selectedPlan?.id === plan.id;
                                return (
                                    <TouchableOpacity
                                        key={plan.id}
                                        onPress={() => setSelectedPlan(plan)}
                                        activeOpacity={0.85}
                                        style={[
                                            s.denomPill,
                                            isSelected && s.denomPillSelected
                                        ]}
                                    >
                                        <Text style={[s.denomPillTxt, isSelected && s.denomPillTxtSelected]}>
                                            {plan.denomination || `₦${plan.size}`}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: isSelected ? '#f97316' : '#64748b', marginTop: 2 }}>
                                            ₦{plan.price}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* 3. ORDER DETAILS SECTION */}
                <View style={s.cardSection}>
                    <Text style={s.sectionHeader}>Order Details</Text>

                    <View style={s.orderDetailRow}>
                        <Text style={s.orderDetailLabel}>Network</Text>
                        <Text style={s.orderDetailVal}>{selectedNetwork.toUpperCase()}</Text>
                    </View>

                    <View style={s.orderDetailRow}>
                        <Text style={s.orderDetailLabel}>Pin Value</Text>
                        <Text style={s.orderDetailVal}>{selectedPlan ? selectedPlan.denomination || `₦${selectedPlan.size}` : '₦100'}</Text>
                    </View>

                    {/* Quantity Pills */}
                    <Text style={[s.orderDetailLabel, { marginTop: 14, marginBottom: 8 }]}>Quantity</Text>
                    <View style={s.qtyPillRow}>
                        {[1, 2, 5, 10].map(q => {
                            const isSelected = quantity === q;
                            return (
                                <TouchableOpacity
                                    key={q}
                                    onPress={() => setQuantity(q)}
                                    activeOpacity={0.8}
                                    style={[
                                        s.qtyPillBtn,
                                        isSelected && s.qtyPillBtnSelected
                                    ]}
                                >
                                    <Text style={[s.qtyPillTxt, isSelected && s.qtyPillTxtSelected]}>
                                        {q} {q === 1 ? 'Pin' : 'Pins'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Name on Card Input */}
                    <Text style={[s.orderDetailLabel, { marginTop: 14, marginBottom: 6 }]}>Name on Card (optional)</Text>
                    <TextInput
                        style={s.nameInput}
                        value={nameOnCard}
                        onChangeText={setNameOnCard}
                        placeholder="muhammadsaniisyaku3@gmail.com"
                        placeholderTextColor="#94a3b8"
                    />

                    {/* Total Cost Display Box */}
                    <View style={s.totalBox}>
                        <Text style={s.totalBoxLabel}>Total</Text>
                        <Text style={s.totalBoxAmount}>₦{totalCost.toFixed(1)}</Text>
                    </View>

                    {/* Wallet Balance Display Box */}
                    <View style={s.walletBox}>
                        <Text style={s.walletBoxLabel}>Wallet Balance:</Text>
                        <Text style={s.walletBoxAmount}>₦{userBalance.toFixed(2)}</Text>
                    </View>

                    {/* Big Orange Purchase Button */}
                    <TouchableOpacity
                        onPress={handlePurchase}
                        disabled={purchasing || !selectedPlan}
                        activeOpacity={0.85}
                        style={[
                            s.purchaseBtn,
                            (purchasing || !selectedPlan) && { opacity: 0.6 }
                        ]}
                    >
                        {purchasing ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={s.purchaseBtnTxt}>Purchase {qtyNumber} {qtyNumber === 1 ? 'Pin' : 'Pins'}</Text>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* GENERATED RECHARGE CARD RESULTS MODAL */}
            <Modal
                visible={successModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setSuccessModal({ visible: false, txData: null })}
            >
                <View style={s.resultModalOverlay}>
                    <View style={s.resultModalCard}>
                        
                        {/* Top Buttons: Print Cards (Orange) & Buy More (White) */}
                        <View style={s.resultTopBtnRow}>
                            <TouchableOpacity onPress={handlePrintCards} style={s.printCardsBtn} activeOpacity={0.85}>
                                <Ionicons name="print-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={s.printCardsBtnTxt}>Print Cards</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSuccessModal({ visible: false, txData: null })}
                                style={s.buyMoreBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.buyMoreBtnTxt}>Buy More</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Generated Voucher Cards Container */}
                        <ScrollView contentContainerStyle={s.voucherCardsGrid} style={{ maxHeight: 450 }}>
                            {successModal.txData?.pins?.map((pinObj: any, idx: number) => (
                                <View key={idx} style={s.printedVoucherCard}>
                                    
                                    {/* Header Row: Name on Card + Copy Icon */}
                                    <View style={s.vHeaderRow}>
                                        <Text style={s.vNameTxt} numberOfLines={1}>
                                            {successModal.txData?.nameOnCard || userEmail || 'ABU MAFHAL VTU'}
                                        </Text>
                                        <TouchableOpacity onPress={() => copyPinToClipboard(pinObj.pin)} style={s.vCopyIconBtn}>
                                            <Ionicons name="copy-outline" size={14} color="#334155" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={s.vDashedLine} />

                                    {/* Body Row: Details on Left, Network Logo in Yellow Container on Right */}
                                    <View style={s.vBodyRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>REF:</Text> {successModal.txData?.transactionId || 'RCP' + Date.now()}</Text>
                                            <Text style={s.vPinTxt}><Text style={{ fontWeight: 'normal', fontSize: 11, color: '#000' }}>PIN: </Text>{pinObj.pin}</Text>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>S/N:</Text> {pinObj.serial || (idx + 1)}</Text>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>Date:</Text> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}</Text>
                                        </View>

                                        <View style={s.vLogoBox}>
                                            <Image source={NETWORK_LOGOS[selectedNetwork] || NETWORK_LOGOS.mtn} style={s.vLogoImg} resizeMode="contain" />
                                        </View>
                                    </View>

                                    <View style={s.vDashedLine} />

                                    {/* Footer Row: Dial Code on Left, Denomination on Right */}
                                    <View style={s.vFooterRow}>
                                        <Text style={s.vDialTxt}>{pinObj.load_code || successModal.txData?.loadCode || '*311*PIN#'}</Text>
                                        <Text style={s.vDenomTxt}>{successModal.txData?.denomination || '₦100'}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                    </View>
                </View>
            </Modal>

        </View>
    );
}

const s = StyleSheet.create({
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
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
    topNavTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    cardSection: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0d1b3e',
        marginBottom: 14
    },
    networkGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    netCardItem: {
        width: (W - 32 - 32 - 12) / 2,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    netCardItemSelected: {
        borderColor: '#f97316',
        borderWidth: 2,
        backgroundColor: '#ffffff'
    },
    netLogoBox: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    netLogoImg: {
        width: 40,
        height: 40
    },
    netNameTxt: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    stockTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#16a34a',
        marginTop: 4
    },
    denomPill: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center'
    },
    denomPillSelected: {
        backgroundColor: '#fff7ed',
        borderColor: '#f97316',
        borderWidth: 2
    },
    denomPillTxt: {
        fontSize: 15,
        fontWeight: '800',
        color: '#334155'
    },
    denomPillTxtSelected: {
        color: '#ea580c'
    },
    orderDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    orderDetailLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500'
    },
    orderDetailVal: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0d1b3e'
    },
    qtyPillRow: {
        flexDirection: 'row',
        gap: 8
    },
    qtyPillBtn: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    qtyPillBtnSelected: {
        borderColor: '#f97316',
        borderWidth: 2,
        backgroundColor: '#fff7ed'
    },
    qtyPillTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155'
    },
    qtyPillTxtSelected: {
        color: '#ea580c',
        fontWeight: '800'
    },
    nameInput: {
        height: 42,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 13,
        fontWeight: '600',
        color: '#0d1b3e'
    },
    totalBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#ffedd5',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginTop: 16
    },
    totalBoxLabel: {
        fontSize: 15,
        color: '#0d1b3e',
        fontWeight: '600'
    },
    totalBoxAmount: {
        fontSize: 22,
        fontWeight: '900',
        color: '#ea580c'
    },
    walletBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fafaf9',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 8
    },
    walletBoxLabel: {
        fontSize: 12,
        color: '#64748b'
    },
    walletBoxAmount: {
        fontSize: 13,
        fontWeight: '800',
        color: '#16a34a'
    },
    purchaseBtn: {
        height: 48,
        backgroundColor: '#ea580c',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16
    },
    purchaseBtnTxt: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff'
    },
    resultModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    resultModalCard: {
        width: '100%',
        maxWidth: 580,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        padding: 16
    },
    resultTopBtnRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    printCardsBtn: {
        flex: 1.5,
        height: 44,
        backgroundColor: '#ea580c',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    printCardsBtnTxt: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 15
    },
    buyMoreBtn: {
        flex: 1,
        height: 44,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buyMoreBtnTxt: {
        color: '#0d1b3e',
        fontWeight: '800',
        fontSize: 14
    },
    voucherCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    printedVoucherCard: {
        width: (W > 500 ? 260 : (W - 32 - 32)),
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1.5,
        borderColor: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    vHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    vNameTxt: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#000000',
        flex: 1,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    vCopyIconBtn: {
        padding: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff'
    },
    vDashedLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#000000',
        borderStyle: 'dashed',
        marginVertical: 6
    },
    vBodyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    vMetaTxt: {
        fontSize: 10,
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 14
    },
    vPinTxt: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginVertical: 2
    },
    vLogoBox: {
        width: 38,
        height: 38,
        backgroundColor: '#ffcc00',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6
    },
    vLogoImg: {
        width: 32,
        height: 32
    },
    vFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    vDialTxt: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    vDenomTxt: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    }
});
