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

// Brand Colors (Navy & Gold)
const T = {
    navy: '#0d1b3e',
    navyMid: '#142258',
    navyDark: '#09122c',
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
    { id: 'mtn', name: 'MTN' },
    { id: 'glo', name: 'GLO' },
    { id: 'airtel', name: 'Airtel' },
    { id: '9mobile', name: '9Mobile' }
];

// Default Fallback Denominations
const DEFAULT_DENOMS = [
    { id: 101, size: '100', denomination: '₦100', price: 98.9 },
    { id: 103, size: '200', denomination: '₦200', price: 197.8 },
    { id: 104, size: '500', denomination: '₦500', price: 494.5 },
    { id: 102, size: '1000', denomination: '₦1,000', price: 989 }
];

export default function RechargePinScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [activeTab, setActiveTab] = useState<'buy' | 'history'>('buy');

    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [allPlans, setAllPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<any | null>(DEFAULT_DENOMS[0]);

    const [quantity, setQuantity] = useState(2);
    const [nameOnCard, setNameOnCard] = useState('');
    const [userEmail, setUserEmail] = useState('');

    const [userBalance, setUserBalance] = useState<number>(474.00);
    const [purchasing, setPurchasing] = useState(false);

    // History State
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Interactive Alert Popup Modal State
    const [alertModal, setAlertModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning';
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'warning'
    });

    // Success Result Voucher Modal State
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
        loadHistory();
    }, []);

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'warning') => {
        setAlertModal({ visible: true, title, message, type });
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try { window.alert(`${title}\n\n${message}`); } catch (_) {}
        } else {
            Alert.alert(title, message);
        }
    };

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

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const history = await api.rechargePin.getHistory();
            setHistoryList(history || []);
        } catch (_) {
        } finally {
            setLoadingHistory(false);
        }
    };

    const isPlanMatchNetwork = (plan: any, netId: string) => {
        const netLower = netId.toLowerCase();
        const planNetName = (plan.networkName || plan.network_name || '').toLowerCase();
        if (planNetName === netLower) return true;
        if (netLower === 'mtn' && (plan.network === 1 || plan.network === '1')) return true;
        if (netLower === 'glo' && (plan.network === 2 || plan.network === '2')) return true;
        if (netLower === 'airtel' && (plan.network === 3 || plan.network === '3')) return true;
        if (netLower === '9mobile' && (plan.network === 4 || plan.network === '4')) return true;
        return false;
    };

    const loadRechargePlans = async () => {
        setLoadingPlans(true);
        try {
            const plans = await api.rechargePin.getPlans();
            setAllPlans(plans || []);
            const mtnPlans = (plans || []).filter((p: any) => isPlanMatchNetwork(p, 'mtn'));
            if (mtnPlans.length > 0) {
                setSelectedPlan(mtnPlans[0]);
            } else {
                setSelectedPlan(DEFAULT_DENOMS[0]);
            }
        } catch (e: any) {
            console.error('Failed to load recharge pin plans', e);
        } finally {
            setLoadingPlans(false);
        }
    };

    const matchedPlans = allPlans.filter((p: any) => isPlanMatchNetwork(p, selectedNetwork));
    const activePlansToDisplay = matchedPlans.length > 0 ? matchedPlans : DEFAULT_DENOMS;

    const handleSelectNetwork = (netId: string) => {
        setSelectedNetwork(netId);
        const filtered = allPlans.filter((p: any) => isPlanMatchNetwork(p, netId));
        if (filtered.length > 0) {
            setSelectedPlan(filtered[0]);
        } else {
            setSelectedPlan(DEFAULT_DENOMS[0]);
        }
    };

    const qtyNumber = Math.max(1, quantity);
    const unitPrice = selectedPlan ? (selectedPlan.price || selectedPlan.regularPrice || 98.9) : 98.9;
    const totalCost = Math.round(unitPrice * qtyNumber * 10) / 10;

    const handlePurchase = async () => {
        if (!selectedPlan) {
            showAlert('Selection Required ⚠️', 'Please select a recharge card denomination.', 'warning');
            return;
        }

        if (totalCost > userBalance) {
            showAlert(
                'Insufficient Wallet Balance ⚠️',
                `Your wallet balance (₦${userBalance.toFixed(2)}) is insufficient for this purchase (₦${totalCost.toFixed(2)}). Please top up your wallet.`,
                'warning'
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
            loadHistory();
        } catch (e: any) {
            showAlert('Purchase Failed ⚠️', e.message || 'Could not complete recharge pin purchase. Please try again.', 'error');
        } finally {
            setPurchasing(false);
        }
    };

    const copyPinToClipboard = async (pinText: string) => {
        await Clipboard.setStringAsync(pinText);
        showAlert('Copied ✅', 'Recharge PIN copied to clipboard!', 'success');
    };

    // 1. AUTO DIRECT DOWNLOAD (PDF / HTML File)
    const handleAutoDownloadPDF = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx || !tx.pins) return;
        const pins = tx.pins || [];

        const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`;

        const cardsHtml = pins.map((p: any, idx: number) => `
            <div style="border: 1.5px solid #000; border-radius: 8px; padding: 10px; background: #fff; page-break-inside: avoid; font-family: monospace; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; font-weight: bold; font-family: sans-serif;">${(tx.nameOnCard || tx.business_name || tx.businessName || 'ABU MAFHAL VTU').toLowerCase()}</span>
                    <span style="border: 1px solid #ccc; border-radius: 4px; padding: 1px 4px; font-size: 10px;">📋</span>
                </div>
                <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 10px; line-height: 1.4;">
                        <div><strong>REF:</strong> ${tx.transaction_id || tx.transactionId || 'RCP' + Date.now()}</div>
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
                    <span>${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}</span>
                    <span>${tx.denomination || '₦100'}</span>
                </div>
            </div>
        `).join('');

        const fullHtml = `<!DOCTYPE html><html><head><title>Recharge_Cards_${tx.transaction_id || tx.transactionId || 'RCP'}</title><style>@page{size:A4 portrait;margin:10mm;}body{margin:0;padding:10px;background:#fff;font-family:monospace;}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}</style></head><body><div class="grid">${cardsHtml}</div></body></html>`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Recharge_Cards_${tx.transaction_id || tx.transactionId || 'RCP'}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showAlert('Downloaded ✅', 'Recharge cards voucher file downloaded to your device!', 'success');
        } else {
            const pinsList = tx.pins;
            const textToShare = pinsList.map((p: any, idx: number) => 
                `Card #${idx + 1} (${tx.denomination})\nPIN: ${p.pin}\nSerial: ${p.serial || (idx + 1)}\nDial: ${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}`
            ).join('\n\n');
            Share.share({ message: textToShare }).catch(() => {});
        }
    };

    // 2. DIRECT BROWSER PRINT WINDOW
    const handleDirectPrint = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx || !tx.pins) return;
        const pins = tx.pins || [];

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                showAlert('Popup Blocked ⚠️', 'Please allow popups in your browser to print cards.', 'warning');
                return;
            }

            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`;

            const cardsHtml = pins.map((p: any, idx: number) => `
                <div style="border: 1.5px solid #000; border-radius: 8px; padding: 10px; background: #fff; page-break-inside: avoid; font-family: monospace;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: bold; font-family: sans-serif;">${(tx.nameOnCard || tx.business_name || tx.businessName || 'ABU MAFHAL VTU').toLowerCase()}</span>
                        <span style="border: 1px solid #ccc; border-radius: 4px; padding: 1px 4px; font-size: 10px;">📋</span>
                    </div>
                    <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 10px; line-height: 1.4;">
                            <div><strong>REF:</strong> ${tx.transaction_id || tx.transactionId || 'RCP' + Date.now()}</div>
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
                        <span>${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}</span>
                        <span>${tx.denomination || '₦100'}</span>
                    </div>
                </div>
            `).join('');

            const htmlDoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Recharge_Cards_${tx.transaction_id || tx.transactionId || 'RCP'}</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm; }
                        body { margin: 0; padding: 10px; background: #fff; font-family: monospace; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body onload="window.print();">
                    <div class="grid">
                        ${cardsHtml}
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(htmlDoc);
            printWindow.document.close();
        } else {
            handleAutoDownloadPDF(customTxData);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f4f6fb', paddingTop: insets.top }}>
            
            {/* Top Navigation Bar */}
            <View style={s.topNav}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={16} color="#f5a623" />
                </TouchableOpacity>
                
                <View style={{ flex: 1 }}>
                    <Text style={s.topNavTitle}>Recharge Pin Printing</Text>
                    <Text style={s.topNavSubTitle}>Print instant airtime vouchers</Text>
                </View>

                <View style={s.liveBadge}>
                    <View style={s.greenDot} />
                    <Text style={s.liveBadgeTxt}>Live Online</Text>
                </View>
            </View>

            {/* TAB SWITCHER: BUY PINS vs HISTORY */}
            <View style={s.tabBarContainer}>
                <TouchableOpacity
                    onPress={() => setActiveTab('buy')}
                    style={[s.tabBarBtn, activeTab === 'buy' && s.tabBarBtnActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="card-outline" size={14} color={activeTab === 'buy' ? T.navy : '#64748b'} style={{ marginRight: 4 }} />
                    <Text style={[s.tabBarTxt, activeTab === 'buy' && s.tabBarTxtActive]}>Buy Pins</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => { setActiveTab('history'); loadHistory(); }}
                    style={[s.tabBarBtn, activeTab === 'history' && s.tabBarBtnActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="time-outline" size={14} color={activeTab === 'history' ? T.navy : '#64748b'} style={{ marginRight: 4 }} />
                    <Text style={[s.tabBarTxt, activeTab === 'history' && s.tabBarTxtActive]}>History</Text>
                    {historyList.length > 0 && (
                        <View style={s.historyBadge}>
                            <Text style={s.historyBadgeTxt}>{historyList.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 10, paddingBottom: 140, alignItems: 'center' }} showsVerticalScrollIndicator={false}>

                <View style={{ width: '100%', maxWidth: 560 }}>

                    {activeTab === 'buy' ? (
                        <>
                            {/* 1. SELECT NETWORK SECTION */}
                            <View style={s.cardSection}>
                                <View style={s.stepHeaderRow}>
                                    <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>STEP 1</Text></View>
                                    <Text style={s.sectionHeader}>Select Network</Text>
                                </View>
                                
                                <View style={s.grid4Row}>
                                    {NETWORKS.map(net => {
                                        const isSelected = selectedNetwork === net.id;
                                        const logoSource = NETWORK_LOGOS[net.id];

                                        return (
                                            <TouchableOpacity
                                                key={net.id}
                                                onPress={() => handleSelectNetwork(net.id)}
                                                activeOpacity={0.85}
                                                style={[
                                                    s.grid4CardItem,
                                                    isSelected && s.grid4CardItemSelected
                                                ]}
                                            >
                                                {isSelected && (
                                                    <View style={s.checkCornerBadge}>
                                                        <Ionicons name="checkmark-sharp" size={8} color={T.navy} />
                                                    </View>
                                                )}

                                                <View style={s.netLogoBoxCompact}>
                                                    <Image source={logoSource} style={s.netLogoImgCompact} resizeMode="contain" />
                                                </View>
                                                <Text style={[s.netNameTxtCompact, isSelected && { color: T.navy, fontWeight: '900' }]}>{net.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* 2. DENOMINATIONS SECTION */}
                            <View style={s.cardSection}>
                                <View style={s.stepHeaderRow}>
                                    <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>STEP 2</Text></View>
                                    <Text style={s.sectionHeader}>{selectedNetwork.toUpperCase()} Pin Denominations</Text>
                                </View>

                                <View style={s.grid4Row}>
                                    {activePlansToDisplay.map((plan: any) => {
                                        const isSelected = selectedPlan?.id === plan.id || selectedPlan?.size === plan.size;
                                        const sizeVal = parseFloat(plan.size || '100');
                                        const unitPriceVal = plan.price || plan.regularPrice || (sizeVal === 100 ? 98.9 : sizeVal === 1000 ? 989 : sizeVal === 200 ? 197.8 : 494.5);

                                        return (
                                            <TouchableOpacity
                                                key={plan.id || plan.size}
                                                onPress={() => setSelectedPlan(plan)}
                                                activeOpacity={0.85}
                                                style={[
                                                    s.grid4CardItem,
                                                    isSelected && s.grid4CardItemSelected
                                                ]}
                                            >
                                                {isSelected && (
                                                    <View style={s.checkCornerBadge}>
                                                        <Ionicons name="checkmark-sharp" size={8} color={T.navy} />
                                                    </View>
                                                )}

                                                <Text style={[s.denom4ValTxt, isSelected && { color: T.navy }]}>
                                                    {plan.denomination || `₦${plan.size}`}
                                                </Text>
                                                <Text style={s.denom4UnitPriceTxt}>₦{unitPriceVal} each</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* 3. ORDER DETAILS SECTION */}
                            <View style={s.cardSection}>
                                <View style={s.stepHeaderRow}>
                                    <View style={s.stepBadge}><Text style={s.stepBadgeTxt}>STEP 3</Text></View>
                                    <Text style={s.sectionHeader}>Order Details</Text>
                                </View>

                                <View style={s.orderDetailRow}>
                                    <Text style={s.orderDetailLabel}>Network</Text>
                                    <Text style={s.orderDetailVal}>{selectedNetwork.toUpperCase()}</Text>
                                </View>

                                <View style={s.orderDetailRow}>
                                    <Text style={s.orderDetailLabel}>Pin Value</Text>
                                    <Text style={s.orderDetailVal}>{selectedPlan ? selectedPlan.denomination || `₦${selectedPlan.size}` : '₦100'}</Text>
                                </View>

                                {/* Quantity Pills */}
                                <Text style={[s.orderDetailLabel, { marginTop: 10, marginBottom: 5 }]}>Quantity</Text>
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
                                <Text style={[s.orderDetailLabel, { marginTop: 10, marginBottom: 4 }]}>Name on Card (optional)</Text>
                                <TextInput
                                    style={s.nameInput}
                                    value={nameOnCard}
                                    onChangeText={setNameOnCard}
                                    placeholder="muhammadsaniisyaku3@gmail.com"
                                    placeholderTextColor="#94a3b8"
                                />

                                {/* Total Cost Display Box */}
                                <View style={s.totalBox}>
                                    <View>
                                        <Text style={s.totalBoxLabel}>Total Amount</Text>
                                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{qtyNumber} x {selectedPlan?.denomination || '₦100'}</Text>
                                    </View>
                                    <Text style={s.totalBoxAmount}>₦{totalCost.toFixed(1)}</Text>
                                </View>

                                {/* Wallet Balance Display Box */}
                                <View style={s.walletBox}>
                                    <Text style={s.walletBoxLabel}>Wallet Balance:</Text>
                                    <Text style={s.walletBoxAmount}>₦{userBalance.toFixed(2)}</Text>
                                </View>

                                {/* Purchase Button */}
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="print-outline" size={15} color={T.navy} style={{ marginRight: 6 }} />
                                            <Text style={s.purchaseBtnTxt}>Purchase {qtyNumber} {qtyNumber === 1 ? 'Pin' : 'Pins'}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        /* HISTORY TAB CONTENT */
                        <View style={s.cardSection}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={s.sectionHeader}>Purchase History</Text>
                                <TouchableOpacity onPress={loadHistory} activeOpacity={0.7}>
                                    <Ionicons name="refresh-outline" size={16} color={T.navy} />
                                </TouchableOpacity>
                            </View>

                            {loadingHistory ? (
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={T.navy} />
                                    <Text style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Loading pin purchase history...</Text>
                                </View>
                            ) : historyList.length === 0 ? (
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <Ionicons name="receipt-outline" size={32} color="#cbd5e1" />
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.navy, marginTop: 8 }}>No History Found</Text>
                                    <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4 }}>You have not made any recharge pin purchases yet.</Text>
                                </View>
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {historyList.map((item: any) => {
                                        const netKey = (item.network || 'mtn').toLowerCase();
                                        const logoSrc = NETWORK_LOGOS[netKey] || NETWORK_LOGOS.mtn;
                                        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';

                                        return (
                                            <View key={item.id || item.transaction_id} style={s.historyCardItem}>
                                                <View style={s.historyLogoBox}>
                                                    <Image source={logoSrc} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                                </View>

                                                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '800', color: T.navy }}>
                                                        {item.network || 'MTN'} {item.denomination} ({item.quantity}x)
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                                        REF: {item.transaction_id} • {dateStr}
                                                    </Text>
                                                </View>

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSuccessModal({
                                                            visible: true,
                                                            txData: item
                                                        });
                                                    }}
                                                    style={s.historyPrintBtn}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="print-outline" size={12} color={T.navy} style={{ marginRight: 3 }} />
                                                    <Text style={s.historyPrintBtnTxt}>View</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                </View>

            </ScrollView>

            {/* INTERACTIVE ALERT POPUP MODAL (FOR WEB & MOBILE) */}
            <Modal
                transparent
                visible={alertModal.visible}
                animationType="fade"
                onRequestClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
            >
                <View style={s.alertModalOverlay}>
                    <View style={[
                        s.alertModalCard,
                        { borderColor: alertModal.type === 'success' ? '#22c55e' : alertModal.type === 'error' ? '#ef4444' : T.gold }
                    ]}>
                        <View style={[
                            s.alertIconBox,
                            { backgroundColor: alertModal.type === 'success' ? '#dcfce7' : alertModal.type === 'error' ? '#fee2e2' : '#fef3c7' }
                        ]}>
                            <Text style={{ fontSize: 24 }}>
                                {alertModal.type === 'success' ? '✅' : alertModal.type === 'error' ? '❌' : '⚠️'}
                            </Text>
                        </View>

                        <Text style={[
                            s.alertTitleTxt,
                            { color: alertModal.type === 'success' ? '#15803d' : alertModal.type === 'error' ? '#b91c1c' : T.navy }
                        ]}>
                            {alertModal.title}
                        </Text>

                        <Text style={s.alertMsgTxt}>{alertModal.message}</Text>

                        <TouchableOpacity
                            onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                            style={[
                                s.alertCloseBtn,
                                { backgroundColor: alertModal.type === 'success' ? '#16a34a' : alertModal.type === 'error' ? '#dc2626' : T.navy }
                            ]}
                            activeOpacity={0.85}
                        >
                            <Text style={s.alertCloseBtnTxt}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* GENERATED RECHARGE CARD RESULTS MODAL WITH AUTO DOWNLOAD OPTIONS */}
            <Modal
                visible={successModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setSuccessModal({ visible: false, txData: null })}
            >
                <View style={s.resultModalOverlay}>
                    <View style={s.resultModalCard}>
                        
                        {/* Top Action Options: AUTO DOWNLOAD PDF / DIRECT PRINT / CLOSE */}
                        <View style={s.resultTopBtnRow}>
                            <TouchableOpacity onPress={() => handleAutoDownloadPDF()} style={s.downloadPdfBtn} activeOpacity={0.85}>
                                <Ionicons name="document-text-outline" size={14} color={T.navy} style={{ marginRight: 4 }} />
                                <Text style={s.downloadPdfBtnTxt}>Save PDF / File</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleDirectPrint()} style={s.printCardsBtn} activeOpacity={0.85}>
                                <Ionicons name="print-outline" size={14} color={T.navy} style={{ marginRight: 4 }} />
                                <Text style={s.printCardsBtnTxt}>Print</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSuccessModal({ visible: false, txData: null })}
                                style={s.buyMoreBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.buyMoreBtnTxt}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Generated Voucher Cards Container */}
                        <ScrollView contentContainerStyle={s.voucherCardsGrid} style={{ maxHeight: 420 }}>
                            {successModal.txData?.pins?.map((pinObj: any, idx: number) => (
                                <View key={idx} style={s.printedVoucherCard}>
                                    
                                    {/* Header Row */}
                                    <View style={s.vHeaderRow}>
                                        <Text style={s.vNameTxt} numberOfLines={1}>
                                            {successModal.txData?.nameOnCard || successModal.txData?.business_name || successModal.txData?.businessName || userEmail || 'ABU MAFHAL VTU'}
                                        </Text>
                                        <TouchableOpacity onPress={() => copyPinToClipboard(pinObj.pin)} style={s.vCopyIconBtn}>
                                            <Ionicons name="copy-outline" size={11} color="#334155" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={s.vDashedLine} />

                                    {/* Body Row */}
                                    <View style={s.vBodyRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>REF:</Text> {successModal.txData?.transaction_id || successModal.txData?.transactionId || 'RCP' + Date.now()}</Text>
                                            <Text style={s.vPinTxt}><Text style={{ fontWeight: 'normal', fontSize: 9, color: '#000' }}>PIN: </Text>{pinObj.pin}</Text>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>S/N:</Text> {pinObj.serial || (idx + 1)}</Text>
                                            <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>Date:</Text> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                                        </View>

                                        <View style={s.vLogoBox}>
                                            <Image source={NETWORK_LOGOS[(successModal.txData?.network || selectedNetwork || 'mtn').toLowerCase()] || NETWORK_LOGOS.mtn} style={s.vLogoImg} resizeMode="contain" />
                                        </View>
                                    </View>

                                    <View style={s.vDashedLine} />

                                    {/* Footer Row */}
                                    <View style={s.vFooterRow}>
                                        <Text style={s.vDialTxt}>{pinObj.load_code || successModal.txData?.load_code || successModal.txData?.loadCode || '*311*PIN#'}</Text>
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
        paddingVertical: 10,
        backgroundColor: T.navy,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245,166,35,0.3)'
    },
    backBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    topNavTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: T.white
    },
    topNavSubTitle: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)'
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34,197,94,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.3)'
    },
    greenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
        marginRight: 5
    },
    liveBadgeTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4ade80'
    },
    tabBarContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        marginHorizontal: 10,
        marginTop: 10,
        borderRadius: 10,
        padding: 3,
        maxWidth: 560,
        alignSelf: 'center',
        width: '95%'
    },
    tabBarBtn: {
        flex: 1,
        height: 32,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    tabBarBtnActive: {
        backgroundColor: T.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    tabBarTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b'
    },
    tabBarTxtActive: {
        color: T.navy,
        fontWeight: '800'
    },
    historyBadge: {
        backgroundColor: T.gold,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 8,
        marginLeft: 5
    },
    historyBadgeTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: T.navy
    },
    cardSection: {
        backgroundColor: T.white,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    stepHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    stepBadge: {
        backgroundColor: T.navy,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8
    },
    stepBadgeTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: T.gold
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '800',
        color: T.navy
    },

    // 4-GRID COLUMN ROW
    grid4Row: {
        flexDirection: 'row',
        gap: 6
    },
    grid4CardItem: {
        flex: 1,
        backgroundColor: T.white,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        position: 'relative'
    },
    grid4CardItemSelected: {
        borderColor: T.gold,
        borderWidth: 2,
        backgroundColor: T.goldLight
    },
    checkCornerBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center'
    },
    netLogoBoxCompact: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3
    },
    netLogoImgCompact: {
        width: 24,
        height: 24
    },
    netNameTxtCompact: {
        fontSize: 11,
        fontWeight: '700',
        color: T.navy
    },

    denom4ValTxt: {
        fontSize: 15,
        fontWeight: '900',
        color: T.navy
    },
    denom4UnitPriceTxt: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
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
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500'
    },
    orderDetailVal: {
        fontSize: 12,
        fontWeight: '800',
        color: T.navy
    },
    qtyPillRow: {
        flexDirection: 'row',
        gap: 6
    },
    qtyPillBtn: {
        flex: 1,
        height: 34,
        borderRadius: 8,
        backgroundColor: T.white,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    qtyPillBtnSelected: {
        borderColor: T.gold,
        borderWidth: 2,
        backgroundColor: T.goldLight
    },
    qtyPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155'
    },
    qtyPillTxtSelected: {
        color: T.goldDk,
        fontWeight: '800'
    },
    nameInput: {
        height: 36,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 11,
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
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 10
    },
    totalBoxLabel: {
        fontSize: 12,
        color: T.white,
        fontWeight: '700'
    },
    totalBoxAmount: {
        fontSize: 18,
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
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 6
    },
    walletBoxLabel: {
        fontSize: 10,
        color: T.navy
    },
    walletBoxAmount: {
        fontSize: 11,
        fontWeight: '800',
        color: T.goldDk
    },
    purchaseBtn: {
        height: 40,
        backgroundColor: T.gold,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12
    },
    purchaseBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navy
    },

    // HISTORY CARD ITEM STYLES
    historyCardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    historyLogoBox: {
        width: 34,
        height: 34,
        borderRadius: 6,
        backgroundColor: T.white,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    historyPrintBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.gold,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6
    },
    historyPrintBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navy
    },

    // INTERACTIVE ALERT MODAL STYLES
    alertModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 27, 62, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    alertModalCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        alignItems: 'center'
    },
    alertIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    alertTitleTxt: {
        fontSize: 16,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8
    },
    alertMsgTxt: {
        fontSize: 12,
        color: '#334155',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18
    },
    alertCloseBtn: {
        width: '100%',
        height: 38,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    alertCloseBtnTxt: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13
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
        borderRadius: 14,
        padding: 12
    },
    resultTopBtnRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10
    },
    downloadPdfBtn: {
        flex: 1.5,
        height: 36,
        backgroundColor: T.gold,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    downloadPdfBtnTxt: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 12
    },
    printCardsBtn: {
        flex: 1,
        height: 36,
        backgroundColor: T.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.navy,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    printCardsBtnTxt: {
        color: T.navy,
        fontWeight: '800',
        fontSize: 12
    },
    buyMoreBtn: {
        flex: 0.8,
        height: 36,
        backgroundColor: T.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buyMoreBtnTxt: {
        color: T.navy,
        fontWeight: '800',
        fontSize: 12
    },
    voucherCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    printedVoucherCard: {
        width: (W > 480 ? 240 : (W - 24 - 24)),
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
        fontSize: 8,
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 12
    },
    vPinTxt: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginVertical: 1
    },
    vLogoBox: {
        width: 30,
        height: 30,
        backgroundColor: '#ffcc00',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4
    },
    vLogoImg: {
        width: 24,
        height: 24
    },
    vFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    vDialTxt: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    vDenomTxt: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    }
});
