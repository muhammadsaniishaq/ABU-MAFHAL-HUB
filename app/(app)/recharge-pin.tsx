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

// Brand Colors
const T = {
    navy: '#0d1b3e',
    navyMid: '#142258',
    gold: '#f5a623',
    goldDk: '#d4890e',
    goldLight: '#fffdf5',
    white: '#ffffff',
    text: '#0d1b3e',
    textSub: '#5a6890',
    border: '#cbd5e1'
};

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

    const [quantity, setQuantity] = useState(2); // Default 2 pins like reference image
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

            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`;

            const cardsHtml = pins.map((p: any, idx: number) => `
                <div style="border: 1.5px solid #000; border-radius: 8px; padding: 10px; background: #fff; page-break-inside: avoid; font-family: monospace;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: bold; font-family: sans-serif; word-break: break-all;">${(tx.nameOnCard || tx.businessName || 'ABU MAFHAL VTU').toLowerCase()}</span>
                        <span style="border: 1px solid #ccc; border-radius: 4px; padding: 1px 4px; font-size: 10px;">📋</span>
                    </div>
                    <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 10px; line-height: 1.4;">
                            <div><strong>REF:</strong> ${tx.transactionId || 'RCP' + Date.now()}</div>
                            <div style="font-size: 12px; font-weight: bold; margin: 2px 0;"><strong>PIN:</strong> ${p.pin}</div>
                            <div><strong>S/N:</strong> ${p.serial || (idx + 1)}</div>
                            <div><strong>Date:</strong> ${formattedDate}</div>
                        </div>
                        <div style="width: 38px; height: 38px; background: #ffcc00; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; margin-left: 8px;">
                            ${(tx.network || 'MTN').toUpperCase()}
                        </div>
                    </div>
                    <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
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
            const pinsList = successModal.txData.pins;
            const textToShare = pinsList.map((p: any, idx: number) => 
                `Card #${idx + 1} (${successModal.txData.denomination})\nPIN: ${p.pin}\nSerial: ${p.serial || (idx + 1)}\nDial: ${p.load_code || successModal.txData.loadCode}`
            ).join('\n\n');

            Share.share({ message: textToShare }).catch(() => {});
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f4f6fb', paddingTop: insets.top }}>
            
            {/* Top Navigation - BRAND NAVY & GOLD */}
            <View style={s.topNav}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={18} color="#f5a623" />
                </TouchableOpacity>
                <Text style={s.topNavTitle}>Recharge Pin Printing</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* 1. SELECT NETWORK SECTION (4-GRID COLUMN) */}
                <View style={s.cardSection}>
                    <Text style={s.sectionHeader}>Select Network</Text>
                    
                    <View style={s.network4GridRow}>
                        {NETWORKS.map(net => {
                            const isSelected = selectedNetwork === net.id;
                            const logoSource = NETWORK_LOGOS[net.id];

                            return (
                                <TouchableOpacity
                                    key={net.id}
                                    onPress={() => handleSelectNetwork(net.id)}
                                    activeOpacity={0.85}
                                    style={[
                                        s.net4CardItem,
                                        isSelected && s.netCardItemSelected
                                    ]}
                                >
                                    <View style={s.netLogoBoxCompact}>
                                        <Image source={logoSource} style={s.netLogoImgCompact} resizeMode="contain" />
                                    </View>
                                    <Text style={[s.netNameTxtCompact, isSelected && { color: T.goldDk }]}>{net.name}</Text>
                                    <Text style={s.stockTxtCompact}>{net.stockDefault} available</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 2. DENOMINATIONS SECTION (2x2 GRID MATCHING USER IMAGE 5) */}
                <View style={s.cardSection}>
                    <Text style={s.sectionHeader}>{selectedNetwork.toUpperCase()} Pin Denominations</Text>

                    {loadingPlans ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={T.navy} />
                            <Text style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>Fetching {selectedNetwork.toUpperCase()} pin denominations...</Text>
                        </View>
                    ) : (
                        <View style={s.denom2x2GridRow}>
                            {networkPlans.map((plan: any) => {
                                const isSelected = selectedPlan?.id === plan.id;
                                const sizeVal = parseFloat(plan.size || '100');
                                const unitPriceVal = plan.price || (sizeVal === 100 ? 98.9 : sizeVal === 1000 ? 989 : sizeVal === 200 ? 197.8 : 494.5);
                                const stockCount = sizeVal === 100 ? 200 : sizeVal === 1000 ? 25 : sizeVal === 200 ? 200 : 50;

                                return (
                                    <TouchableOpacity
                                        key={plan.id}
                                        onPress={() => setSelectedPlan(plan)}
                                        activeOpacity={0.85}
                                        style={[
                                            s.denom2x2Card,
                                            isSelected && s.denom2x2CardSelected
                                        ]}
                                    >
                                        <Text style={[s.denom2x2Val, isSelected && { color: T.navy }]}>
                                            {plan.denomination || `₦${plan.size}`}
                                        </Text>
                                        <Text style={s.denom2x2UnitPrice}>₦{unitPriceVal} each</Text>
                                        <Text style={s.denom2x2Stock}>{stockCount} available</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

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
                    <Text style={[s.orderDetailLabel, { marginTop: 12, marginBottom: 6 }]}>Quantity</Text>
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
                    <Text style={[s.orderDetailLabel, { marginTop: 12, marginBottom: 4 }]}>Name on Card (optional)</Text>
                    <TextInput
                        style={s.nameInput}
                        value={nameOnCard}
                        onChangeText={setNameOnCard}
                        placeholder="muhammadsaniisyaku3@gmail.com"
                        placeholderTextColor="#94a3b8"
                    />

                    {/* Total Cost Display Box - BRAND NAVY & GOLD */}
                    <View style={s.totalBox}>
                        <Text style={s.totalBoxLabel}>Total</Text>
                        <Text style={s.totalBoxAmount}>₦{totalCost.toFixed(1)}</Text>
                    </View>

                    {/* Wallet Balance Display Box */}
                    <View style={s.walletBox}>
                        <Text style={s.walletBoxLabel}>Wallet Balance:</Text>
                        <Text style={s.walletBoxAmount}>₦{userBalance.toFixed(2)}</Text>
                    </View>

                    {/* Purchase Button - BRAND GOLD */}
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
                            <ActivityIndicator size="small" color={T.navy} />
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
                        
                        {/* Top Buttons: Print Cards (Gold) & Buy More (White) */}
                        <View style={s.resultTopBtnRow}>
                            <TouchableOpacity onPress={handlePrintCards} style={s.printCardsBtn} activeOpacity={0.85}>
                                <Ionicons name="print-outline" size={16} color={T.navy} style={{ marginRight: 6 }} />
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
                        <ScrollView contentContainerStyle={s.voucherCardsGrid} style={{ maxHeight: 420 }}>
                            {successModal.txData?.pins?.map((pinObj: any, idx: number) => (
                                <View key={idx} style={s.printedVoucherCard}>
                                    
                                    {/* Header Row: Name on Card + Copy Icon */}
                                    <View style={s.vHeaderRow}>
                                        <Text style={s.vNameTxt} numberOfLines={1}>
                                            {successModal.txData?.nameOnCard || userEmail || 'ABU MAFHAL VTU'}
                                        </Text>
                                        <TouchableOpacity onPress={() => copyPinToClipboard(pinObj.pin)} style={s.vCopyIconBtn}>
                                            <Ionicons name="copy-outline" size={12} color="#334155" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={s.vDashedLine} />

                                    {/* Body Row: Details on Left, Network Logo in Yellow Container on Right */}
                                    <View style={s.vBodyRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>REF:</Text> {successModal.txData?.transactionId || 'RCP' + Date.now()}</Text>
                                            <Text style={s.vPinTxt}><Text style={{ fontWeight: 'normal', fontSize: 10, color: '#000' }}>PIN: </Text>{pinObj.pin}</Text>
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
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: T.navy,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245,166,35,0.3)'
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    topNavTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: T.white
    },
    cardSection: {
        backgroundColor: T.white,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '800',
        color: T.navy,
        marginBottom: 10
    },
    // 4-GRID COLUMN NETWORK ROW
    network4GridRow: {
        flexDirection: 'row',
        gap: 6
    },
    net4CardItem: {
        flex: 1,
        backgroundColor: T.white,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    netCardItemSelected: {
        borderColor: T.gold,
        borderWidth: 2.5,
        backgroundColor: T.goldLight
    },
    netLogoBoxCompact: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4
    },
    netLogoImgCompact: {
        width: 28,
        height: 28
    },
    netNameTxtCompact: {
        fontSize: 12,
        fontWeight: '800',
        color: T.navy
    },
    stockTxtCompact: {
        fontSize: 9,
        fontWeight: '700',
        color: '#16a34a',
        marginTop: 2
    },

    // 2x2 GRID DENOMINATIONS MATCHING USER IMAGE 5
    denom2x2GridRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    denom2x2Card: {
        width: (W - 24 - 24 - 10) / 2,
        backgroundColor: T.white,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    denom2x2CardSelected: {
        borderColor: T.gold,
        borderWidth: 2.5,
        backgroundColor: T.goldLight
    },
    denom2x2Val: {
        fontSize: 20,
        fontWeight: '900',
        color: T.navy
    },
    denom2x2UnitPrice: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 2
    },
    denom2x2Stock: {
        fontSize: 10,
        fontWeight: '700',
        color: '#16a34a',
        marginTop: 2
    },

    orderDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    orderDetailLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500'
    },
    orderDetailVal: {
        fontSize: 13,
        fontWeight: '800',
        color: T.navy
    },
    qtyPillRow: {
        flexDirection: 'row',
        gap: 6
    },
    qtyPillBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        backgroundColor: T.white,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    qtyPillBtnSelected: {
        borderColor: T.gold,
        borderWidth: 2.5,
        backgroundColor: T.goldLight
    },
    qtyPillTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155'
    },
    qtyPillTxtSelected: {
        color: T.goldDk,
        fontWeight: '800'
    },
    nameInput: {
        height: 38,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: '600',
        color: T.navy
    },
    totalBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: T.navy,
        borderWidth: 1,
        borderColor: T.gold,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginTop: 12
    },
    totalBoxLabel: {
        fontSize: 15,
        color: T.white,
        fontWeight: '600'
    },
    totalBoxAmount: {
        fontSize: 22,
        fontWeight: '900',
        color: T.gold
    },
    walletBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: T.goldLight,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(245,166,35,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 6
    },
    walletBoxLabel: {
        fontSize: 11,
        color: T.navy
    },
    walletBoxAmount: {
        fontSize: 12,
        fontWeight: '800',
        color: T.goldDk
    },
    purchaseBtn: {
        height: 46,
        backgroundColor: T.gold,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14
    },
    purchaseBtnTxt: {
        fontSize: 15,
        fontWeight: '900',
        color: T.navy
    },
    resultModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 27, 62, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12
    },
    resultModalCard: {
        width: '100%',
        maxWidth: 560,
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12
    },
    resultTopBtnRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12
    },
    printCardsBtn: {
        flex: 1.5,
        height: 40,
        backgroundColor: T.gold,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    printCardsBtnTxt: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 14
    },
    buyMoreBtn: {
        flex: 1,
        height: 40,
        backgroundColor: T.white,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buyMoreBtnTxt: {
        color: T.navy,
        fontWeight: '800',
        fontSize: 13
    },
    voucherCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    printedVoucherCard: {
        width: (W > 480 ? 250 : (W - 24 - 24)),
        backgroundColor: T.white,
        borderRadius: 8,
        padding: 8,
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
        fontSize: 10,
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
        backgroundColor: T.white
    },
    vDashedLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#000000',
        borderStyle: 'dashed',
        marginVertical: 4
    },
    vBodyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    vMetaTxt: {
        fontSize: 9,
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 13
    },
    vPinTxt: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginVertical: 2
    },
    vLogoBox: {
        width: 32,
        height: 32,
        backgroundColor: '#ffcc00',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4
    },
    vLogoImg: {
        width: 26,
        height: 26
    },
    vFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    vDialTxt: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    vDenomTxt: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    }
});
