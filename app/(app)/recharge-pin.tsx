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

// Official Network Logos & Colors
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    glo: require('../../assets/images/glo.png'),
    airtel: require('../../assets/images/airtel.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
    vitel: require('../../assets/images/vitel.png'),
};

const NETWORK_BG_COLORS: Record<string, string> = {
    mtn: '#ffcc00',
    glo: '#008751',
    airtel: '#e60000',
    '9mobile': '#006837'
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
            if (user.email) setUserEmail(user.email);
            const { data: profile } = await supabase.from('profiles').select('balance, full_name, email').eq('id', user.id).single();
            if (profile) {
                setUserBalance(parseFloat(profile.balance || 0));
                // Prefer full_name for display; fallback to email
                const displayName = profile.full_name || profile.email || user.email || '';
                setUserEmail(profile.email || user.email || '');
                setNameOnCard(displayName);
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

    // Inline SVG logos - NO external URLs, NO CORS issues
    const NET_SVG: Record<string, string> = {
        mtn: `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#FFCC00"/><text x="60" y="42" font-family="Arial Black,Arial" font-size="26" font-weight="900" text-anchor="middle" fill="#000000">MTN</text></svg>') : ''}`,
        glo: `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#008751"/><text x="60" y="40" font-family="Arial Black,Arial" font-size="24" font-weight="900" text-anchor="middle" fill="#ffffff">glo</text><circle cx="60" cy="50" r="3" fill="#ffffff" opacity="0.6"/></svg>') : ''}`,
        airtel: `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#E60000"/><text x="60" y="42" font-family="Arial Black,Arial" font-size="18" font-weight="900" text-anchor="middle" fill="#ffffff">airtel</text></svg>') : ''}`,
        '9mobile': `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#006837"/><text x="60" y="38" font-family="Arial Black,Arial" font-size="16" font-weight="900" text-anchor="middle" fill="#ffffff">9mobile</text></svg>') : ''}`,
    };

    // Helper: safely parse pins from history item (may be JSON string from DB)
    const safeParsePins = (item: any): any[] => {
        if (!item) return [];
        const raw = item.pins;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
        }
        return [];
    };

    // ─── 3. BLUETOOTH MINI PRINTER ─────────────────────────────────────
    const handleBluetoothPrint = async (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx) return;
        const pins = safeParsePins(tx);
        if (pins.length === 0) { showAlert('No PINs', 'No PIN data found to print.', 'error'); return; }

        if (Platform.OS !== 'web' || typeof (navigator as any).bluetooth === 'undefined') {
            showAlert('Not Supported ⚠️', 'Bluetooth printing is only available on Chrome/Edge on Android or Desktop with Web Bluetooth enabled.', 'warning');
            return;
        }

        try {
            showAlert('Connecting... 🔵', 'Searching for Bluetooth printer. Please select your mini printer from the list.', 'warning');
            const bt = (navigator as any).bluetooth;
            const device = await bt.requestDevice({
                filters: [
                    { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                    { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
                    { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
                ],
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    '0000ff00-0000-1000-8000-00805f9b34fb',
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                ]
            });

            const server = await device.gatt.connect();
            // Try known service UUIDs for common mini BT printers
            let characteristic: any = null;
            const serviceUUIDs = [
                '000018f0-0000-1000-8000-00805f9b34fb',
                '0000ff00-0000-1000-8000-00805f9b34fb',
                'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            ];
            const charUUIDs = [
                '00002af1-0000-1000-8000-00805f9b34fb',
                '0000ff02-0000-1000-8000-00805f9b34fb',
                'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
                '49535343-8841-43f4-a8d4-ecbe34729bb3',
            ];
            for (const svcId of serviceUUIDs) {
                try {
                    const svc = await server.getPrimaryService(svcId);
                    for (const chId of charUUIDs) {
                        try { characteristic = await svc.getCharacteristic(chId); break; } catch { /* try next */ }
                    }
                    if (!characteristic) {
                        // Try getting all characteristics
                        const chars = await svc.getCharacteristics();
                        for (const ch of chars) {
                            if (ch.properties.write || ch.properties.writeWithoutResponse) {
                                characteristic = ch; break;
                            }
                        }
                    }
                    if (characteristic) break;
                } catch { /* try next service */ }
            }

            if (!characteristic) {
                showAlert('Printer Error ❌', 'Could not find a writable characteristic on this printer. Try a different Bluetooth printer.', 'error');
                return;
            }

            // Build ESC/POS receipt
            const enc = new TextEncoder();
            const ESC = 0x1B; const GS = 0x1D; const LF = 0x0A;
            const initCmd = new Uint8Array([ESC, 0x40]); // Init
            const centerCmd = new Uint8Array([ESC, 0x61, 0x01]);
            const leftCmd = new Uint8Array([ESC, 0x61, 0x00]);
            const boldOn = new Uint8Array([ESC, 0x45, 0x01]);
            const boldOff = new Uint8Array([ESC, 0x45, 0x00]);
            const dblHeight = new Uint8Array([ESC, 0x21, 0x10]);
            const normalSize = new Uint8Array([ESC, 0x21, 0x00]);
            const cutCmd = new Uint8Array([GS, 0x56, 0x41, 0x10]);

            const writeLine = async (text: string, cmd?: Uint8Array) => {
                if (cmd) await characteristic.writeValue(cmd);
                await characteristic.writeValue(enc.encode(text + '\n'));
            };

            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const denom = tx.denomination || '\u20A6100';
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const txRef = tx.transaction_id || tx.transactionId || 'RCP' + Date.now();
            const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            await characteristic.writeValue(initCmd);
            await characteristic.writeValue(centerCmd);
            await writeLine('================================');
            await characteristic.writeValue(boldOn);
            await characteristic.writeValue(dblHeight);
            await writeLine(bName);
            await characteristic.writeValue(normalSize);
            await characteristic.writeValue(boldOff);
            await writeLine(`${netName} ${denom} RECHARGE CARD`);
            await writeLine('================================');
            await characteristic.writeValue(leftCmd);

            for (let i = 0; i < pins.length; i++) {
                const p = pins[i];
                await characteristic.writeValue(centerCmd);
                await writeLine(`--- CARD ${i + 1} OF ${pins.length} ---`);
                await characteristic.writeValue(leftCmd);
                await characteristic.writeValue(boldOn);
                await characteristic.writeValue(dblHeight);
                const rawPin = (p.pin || '').toString();
                const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                await writeLine('PIN: ' + groups.join('-'));
                await characteristic.writeValue(normalSize);
                await characteristic.writeValue(boldOff);
                await writeLine(`S/N: ${p.serial || (i + 1)}`);
                await writeLine(`DIAL: ${p.load_code || tx.load_code || '*311*PIN#'}`);
                await writeLine(`REF: ${txRef}`);
                await writeLine(`DATE: ${dateStr}`);
                await writeLine('--------------------------------');
            }

            await characteristic.writeValue(centerCmd);
            await writeLine('Generated by ABU MAFHAL VTU');
            await writeLine('Keep this receipt safe!');
            await characteristic.writeValue(new Uint8Array([LF, LF, LF]));
            await characteristic.writeValue(cutCmd);

            showAlert('Printed! \u2705', `${pins.length} recharge card(s) sent to ${device.name || 'Bluetooth Printer'} successfully!`, 'success');
        } catch (err: any) {
            if (err.name === 'NotFoundError') {
                showAlert('Cancelled', 'No printer was selected.', 'warning');
            } else {
                showAlert('Bluetooth Error \u274C', err.message || 'Could not connect to printer. Make sure it is on and paired.', 'error');
            }
        }
    };

    // ─── 1. SAVE AS PNG (80x50mm cards @ 200 DPI = 630x394px) ──────────
    const handleSaveAsPNG = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx) return;
        const pins = safeParsePins(tx);
        if (pins.length === 0) { showAlert('No PINs', 'No PIN data to save.', 'error'); return; }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const netKey = (tx.network || selectedNetwork || 'mtn').toLowerCase();
            const netBg = NETWORK_BG_COLORS[netKey] || '#ffcc00';
            const netTextCol = netKey === 'mtn' ? '#000000' : '#ffffff';
            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const denom = tx.denomination || '₦100';
            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now());

            // 80mm x 50mm @ 200 DPI = 630 x 394 px per card
            const CW = 630, CH = 394;
            const COLS = 2, GAP = 20, PAD = 24;
            const rows = Math.ceil(pins.length / COLS);
            const canvasW = COLS * CW + (COLS - 1) * GAP + PAD * 2;
            const canvasH = rows * CH + (rows - 1) * GAP + PAD * 2 + 32;

            const drawAllCards = (logoImg: HTMLImageElement | null) => {
                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Page background gradient
                const bg = ctx.createLinearGradient(0, 0, canvasW, canvasH);
                bg.addColorStop(0, '#dce8ff');
                bg.addColorStop(1, '#f0f4ff');
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, canvasW, canvasH);

                // Watermark
                ctx.save();
                ctx.globalAlpha = 0.04;
                ctx.font = 'bold 52px Arial';
                ctx.fillStyle = '#0d1b3e';
                ctx.textAlign = 'center';
                ctx.fillText('ABU MAFHAL VTU', canvasW / 2, canvasH / 2);
                ctx.restore();

                pins.forEach((p: any, idx: number) => {
                    const col = idx % COLS;
                    const row = Math.floor(idx / COLS);
                    const X = PAD + col * (CW + GAP);
                    const Y = PAD + row * (CH + GAP);

                    // ── Drop shadow ──
                    ctx.shadowColor = 'rgba(13,27,62,0.22)';
                    ctx.shadowBlur = 14;
                    ctx.shadowOffsetY = 6;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.roundRect(X, Y, CW, CH, 14); ctx.fill();
                    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

                    // ── Card border ──
                    ctx.strokeStyle = '#0d1b3e'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.roundRect(X, Y, CW, CH, 14); ctx.stroke();

                    // ── Decorative circle top-right ──
                    ctx.save(); ctx.globalAlpha = 0.08;
                    ctx.fillStyle = netBg;
                    ctx.beginPath(); ctx.arc(X + CW - 30, Y + 30, 60, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(X + CW, Y, 45, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();

                    // ── Header gradient banner ──
                    const hGrad = ctx.createLinearGradient(X, Y, X + CW, Y);
                    hGrad.addColorStop(0, '#0a1730'); hGrad.addColorStop(0.5, '#0d1b3e'); hGrad.addColorStop(1, '#162860');
                    ctx.fillStyle = hGrad;
                    ctx.beginPath(); ctx.roundRect(X, Y, CW, 46, [14, 14, 0, 0]); ctx.fill();

                    // ── Gold accent line ──
                    ctx.fillStyle = '#f5a623';
                    ctx.fillRect(X, Y + 46, CW, 3);

                    // ── Gold left stripe ──
                    ctx.fillStyle = '#f5a623';
                    ctx.fillRect(X, Y + 49, 5, CH - 49);

                    // ── Business name (header, gold) ──
                    ctx.fillStyle = '#f5a623';
                    ctx.font = 'bold 15px Arial, sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillText(bName.length > 28 ? bName.slice(0, 26) + '…' : bName, X + 14, Y + 32);

                    // ── Denomination (header, white right) ──
                    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(denom, X + CW - 14, Y + 32);
                    ctx.textAlign = 'left';

                    // ── Network logo badge (right side) ──
                    const LBX = X + CW - 84, LBY = Y + 58, LBW = 72, LBH = 62;
                    ctx.fillStyle = netBg;
                    ctx.beginPath(); ctx.roundRect(LBX, LBY, LBW, LBH, 10); ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.roundRect(LBX, LBY, LBW, LBH, 10); ctx.stroke();

                    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
                        const mxS = 54;
                        const ar = logoImg.naturalWidth / Math.max(logoImg.naturalHeight, 1);
                        let iw = mxS, ih = mxS / ar;
                        if (ih > mxS) { ih = mxS; iw = mxS * ar; }
                        ctx.drawImage(logoImg, LBX + (LBW - iw) / 2, LBY + (LBH - ih) / 2, iw, ih);
                    } else {
                        ctx.fillStyle = netTextCol; ctx.font = 'bold 16px Arial Black, Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(netName, LBX + LBW / 2, LBY + LBH / 2 + 6);
                        ctx.textAlign = 'left';
                    }

                    // ── PIN box (gold border) ──
                    const PBX = X + 14, PBY = Y + 58, PBW = CW - 110, PBH = 62;
                    ctx.fillStyle = '#fffbef'; ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.roundRect(PBX, PBY, PBW, PBH, 10); ctx.fill(); ctx.stroke();

                    // PIN label
                    ctx.fillStyle = '#9a7000'; ctx.font = '11px Arial, sans-serif';
                    ctx.fillText('RECHARGE PIN', PBX + 12, PBY + 17);

                    // PIN digits (large bold monospace)
                    const rawPin = (p.pin || '').toString();
                    const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                    ctx.fillStyle = '#0d1b3e';
                    ctx.font = 'bold 26px Courier New, monospace';
                    ctx.fillText(groups.join('  '), PBX + 12, PBY + 50);

                    // ── Dashed divider ──
                    ctx.setLineDash([5, 5]); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(X + 12, Y + 132); ctx.lineTo(X + CW - 12, Y + 132); ctx.stroke();
                    ctx.setLineDash([]);

                    // ── Card number ──
                    ctx.fillStyle = T.navy; ctx.font = 'bold 11px Arial, sans-serif';
                    ctx.fillText(`CARD ${idx + 1} / ${pins.length}`, X + 14, Y + 150);

                    // ── Meta row ──
                    ctx.fillStyle = '#64748b'; ctx.font = '10px Courier New, monospace';
                    ctx.fillText(`S/N: ${p.serial || (idx + 1)}`, X + 14, Y + 168);
                    ctx.fillText(`DATE: ${formattedDate}`, X + 180, Y + 168);
                    ctx.fillStyle = '#94a3b8'; ctx.font = '9px Courier New, monospace';
                    ctx.fillText(`REF: ${txRef}`, X + 14, Y + 184);

                    // ── Decorative dot row ──
                    for (let d = 0; d < 6; d++) {
                        ctx.fillStyle = d % 2 === 0 ? '#f5a623' : '#0d1b3e';
                        ctx.beginPath(); ctx.arc(X + 14 + d * 14, Y + 202, 3.5, 0, Math.PI * 2); ctx.fill();
                    }

                    // ── Dial code ──
                    ctx.fillStyle = '#0d1b3e'; ctx.font = 'bold 13px Courier New, monospace';
                    ctx.textAlign = 'right';
                    ctx.fillText(`DIAL: ${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}`, X + CW - 14, Y + 206);
                    ctx.textAlign = 'left';

                    // ── Bottom gold bar ──
                    ctx.fillStyle = '#f5a623';
                    ctx.beginPath(); ctx.roundRect(X, Y + CH - 20, CW, 20, [0, 0, 14, 14]); ctx.fill();
                    ctx.fillStyle = T.navy; ctx.font = 'bold 9px Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('ABU MAFHAL VTU \u2022 RECHARGE VOUCHER', X + CW / 2, Y + CH - 7);
                    ctx.textAlign = 'left';
                });

                // Footer
                ctx.fillStyle = '#94a3b8'; ctx.font = '10px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Generated by ABU MAFHAL VTU \u2022 80mm\xd750mm Card Format', canvasW / 2, canvasH - 8);

                const dataUrl = canvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `RechargeCards_${txRef}.png`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                showAlert('Downloaded PNG \u2705', `${pins.length} card(s) saved as high-quality PNG (80x50mm format)!`, 'success');
            };

            // Load inline SVG logo (no CORS) - use document.createElement to avoid RN type conflict
            const svgLogoUrl = NET_SVG[netKey];
            if (svgLogoUrl && typeof document !== 'undefined') {
                const img = document.createElement('img') as HTMLImageElement;
                img.onload = () => drawAllCards(img);
                img.onerror = () => drawAllCards(null);
                img.src = svgLogoUrl;
            } else {
                drawAllCards(null);
            }
        } else {
            const textToShare = pins.map((p: any, idx: number) =>
                `Card #${idx + 1} (${tx.denomination || '\u20A6100'})\nPIN: ${p.pin}\nSerial: ${p.serial || (idx + 1)}\nDial: ${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}`
            ).join('\n\n');
            Share.share({ message: textToShare }).catch(() => {});
        }
    };

    // ─── 2. SAVE AS PDF (A4, 80x50mm cards, 2-column) ─────────────────
    const handleSaveAsPDF = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx) return;
        const pins = safeParsePins(tx);
        if (pins.length === 0) { showAlert('No PINs', 'No PIN data to save.', 'error'); return; }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const netKey = (tx.network || selectedNetwork || 'mtn').toLowerCase();
            const netBg = NETWORK_BG_COLORS[netKey] || '#ffcc00';
            const netTextColor = netKey === 'mtn' ? '#000000' : '#ffffff';
            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now());
            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const formattedTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            // Use inline SVG logo (no CORS, no external requests)
            const svgLogoSrc = NET_SVG[netKey] || '';
            const logoHtml = svgLogoSrc
                ? `<img src="${svgLogoSrc}" style="width:44px;height:44px;object-fit:contain;" />`
                : `<span style="font-weight:900;font-size:13px;color:${netTextColor};">${netName}</span>`;

            const cardsHtml = pins.map((p: any, idx: number) => {
                const rawPin = (p.pin || '').toString();
                const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                const formattedPin = groups.join('&nbsp;&nbsp;');
                const dialCode = p.load_code || tx.load_code || tx.loadCode || '*311*PIN#';
                return `
<div class="card">
  <div class="card-top">
    <div class="card-top-inner">
      <div class="card-dots"><div class="dot"></div><div class="dot dot2"></div><div class="dot dot3"></div></div>
      <span class="biz-name">${bName.length > 22 ? bName.slice(0,20)+'\u2026' : bName}</span>
      <span class="denom-badge">${tx.denomination || '\u20A6100'}</span>
    </div>
  </div>
  <div class="card-body">
    <div class="pin-section">
      <div class="pin-box">
        <div class="pin-lbl">RECHARGE PIN</div>
        <div class="pin-num">${formattedPin}</div>
      </div>
      <div class="net-wrap" style="background:${netBg};">${logoHtml}</div>
    </div>
    <div class="divider"></div>
    <div class="meta">
      <span class="card-no">CARD ${idx + 1}/${pins.length}</span>
      <span class="sn">S/N: ${p.serial || (idx + 1)}</span>
      <span class="dt">${formattedDate}</span>
    </div>
    <div class="ref">REF: ${txRef}</div>
    <div class="card-footer">
      <span class="dial">${dialCode}</span>
      <div class="dots-row"><div class="sd"></div><div class="sd"></div><div class="sd"></div><div class="sd"></div></div>
    </div>
  </div>
</div>`;
            }).join('');

            const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RechargeCards_${txRef}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #e8eeff; padding: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page-header { text-align: center; margin-bottom: 10px; }
  .page-title { font-size: 14px; font-weight: 900; color: #0d1b3e; letter-spacing: 1px; }
  .page-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
  .grid { display: grid; grid-template-columns: repeat(2, 80mm); gap: 6mm; justify-content: center; }
  .card { width: 80mm; height: 50mm; background: #fff; border: 2px solid #0d1b3e; border-radius: 5mm; overflow: hidden; page-break-inside: avoid; position: relative; }
  .card::before { content:''; position:absolute; top:-15mm; right:-10mm; width:30mm; height:30mm; border-radius:50%; background:${netBg}; opacity:0.08; }
  .card-top { background: linear-gradient(90deg, #09122c 0%, #0d1b3e 60%, #162860 100%); border-left: 3px solid #f5a623; padding: 2.5mm 3mm; }
  .card-top-inner { display: flex; align-items: center; gap: 2mm; }
  .card-dots { display: flex; gap: 1mm; margin-right: 1mm; }
  .dot { width: 2.5mm; height: 2.5mm; border-radius: 50%; background: #f5a623; }
  .dot2 { background: #ffffff; opacity: 0.6; }
  .dot3 { background: #f5a623; opacity: 0.4; }
  .biz-name { flex: 1; font-size: 6.5pt; font-weight: 700; color: #f5a623; letter-spacing: 0.3px; }
  .denom-badge { background: #f5a623; color: #0d1b3e; font-size: 7pt; font-weight: 900; padding: 1mm 2mm; border-radius: 2mm; }
  .card-body { padding: 2mm 3mm; }
  .pin-section { display: flex; align-items: center; gap: 2mm; margin-bottom: 1.5mm; }
  .pin-box { flex: 1; border: 1.5px solid #f5a623; background: #fffbef; border-radius: 2mm; padding: 1.5mm 2mm; }
  .pin-lbl { font-size: 5pt; color: #9a7000; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 0.5mm; }
  .pin-num { font-size: 13pt; font-weight: 900; color: #0d1b3e; font-family: 'Courier New', monospace; letter-spacing: 2px; }
  .net-wrap { width: 14mm; height: 13mm; border-radius: 2mm; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0; }
  .divider { border-top: 1px dashed #cbd5e1; margin: 1mm 0; }
  .meta { display: flex; align-items: center; gap: 2mm; font-size: 6pt; color: #64748b; margin-bottom: 0.8mm; }
  .card-no { font-weight: 800; color: #0d1b3e; }
  .sn { flex: 1; }
  .ref { font-size: 5.5pt; color: #94a3b8; font-family: 'Courier New', monospace; margin-bottom: 1mm; }
  .card-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1.5px solid #0d1b3e; padding-top: 1mm; }
  .dial { font-size: 7pt; font-weight: 900; color: #0d1b3e; font-family: 'Courier New', monospace; }
  .dots-row { display: flex; gap: 1mm; }
  .sd { width: 2mm; height: 2mm; border-radius: 50%; background: #f5a623; }
  .sd:nth-child(2) { background: #0d1b3e; }
  .sd:nth-child(4) { background: #0d1b3e; }
  .watermark { text-align: center; color: #cbd5e1; font-size: 7pt; margin-top: 8px; }
</style>
</head>
<body>
<div class="page-header">
  <div class="page-title">&#127371; ABU MAFHAL VTU &#8212; RECHARGE CARDS</div>
  <div class="page-sub">${netName} ${tx.denomination || ''} &bull; ${pins.length} card(s) &bull; ${formattedDate} ${formattedTime}</div>
</div>
<div class="grid">${cardsHtml}</div>
<div class="watermark">Generated by ABU MAFHAL VTU &bull; Cards are 80mm&times;50mm standard size &bull; ${txRef}</div>
</body>
</html>`;

            const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
            document.body.appendChild(iframe);
            iframe.src = blobUrl;
            iframe.onload = () => {
                try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {}
                setTimeout(() => { try { document.body.removeChild(iframe); } catch(_){} URL.revokeObjectURL(blobUrl); }, 3000);
            };
            showAlert('PDF Ready', 'Print dialog opening. Choose Save as PDF. Cards 80x50mm on A4.', 'success');
        } else {
            handleSaveAsPNG(customTxData);
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
                                    {historyList.map((item: any, hIdx: number) => {
                                        if (!item) return null;
                                        const netKey = ((item.network || 'mtn') + '').toLowerCase();
                                        const logoSrc = NETWORK_LOGOS[netKey] || NETWORK_LOGOS.mtn;
                                        const dateStr = item.created_at
                                            ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : 'Recent';
                                        const parsedPins = safeParsePins(item);
                                        const netBgColor = NETWORK_BG_COLORS[netKey] || '#ffcc00';

                                        return (
                                            <View key={item.id || item.transaction_id || hIdx} style={[s.historyCardItem, { borderLeftWidth: 4, borderLeftColor: netBgColor }]}>
                                                <View style={[s.historyLogoBox, { backgroundColor: netBgColor }]}>
                                                    <Image source={logoSrc} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                                </View>

                                                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '800', color: T.navy }}>
                                                        {(item.network || 'MTN') + ''} {item.denomination || ''} ({(item.quantity || parsedPins.length || 1)}x)
                                                    </Text>
                                                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                                        REF: {(item.transaction_id || 'N/A') + ''} \u2022 {dateStr}
                                                    </Text>
                                                    {parsedPins.length > 0 && (
                                                        <Text style={{ fontSize: 9, color: T.gold, marginTop: 2, fontWeight: '700' }}>
                                                            {parsedPins.length} PIN{parsedPins.length > 1 ? 's' : ''} saved
                                                        </Text>
                                                    )}
                                                </View>

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        try {
                                                            const viewData = { ...item, pins: parsedPins };
                                                            setSuccessModal({ visible: true, txData: viewData });
                                                        } catch (_) {}
                                                    }}
                                                    style={s.historyPrintBtn}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="eye-outline" size={12} color={T.navy} style={{ marginRight: 3 }} />
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

            {/* INTERACTIVE ALERT POPUP MODAL */}
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

            {/* GENERATED RECHARGE CARD RESULTS MODAL WITH REAL PNG & PDF OPTIONS */}
            <Modal
                visible={successModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setSuccessModal({ visible: false, txData: null })}
            >
                <View style={s.resultModalOverlay}>
                    <View style={s.resultModalCard}>
                        
                        {/* Top Action Row: PNG / PDF / BLUETOOTH / CLOSE */}
                        <View style={s.resultTopBtnRow}>
                            <TouchableOpacity onPress={() => handleSaveAsPNG()} style={s.downloadPngBtn} activeOpacity={0.85}>
                                <Ionicons name="image-outline" size={13} color={T.navy} style={{ marginRight: 3 }} />
                                <Text style={s.downloadPngBtnTxt}>PNG</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleSaveAsPDF()} style={s.downloadPdfBtn} activeOpacity={0.85}>
                                <Ionicons name="document-text-outline" size={13} color={T.navy} style={{ marginRight: 3 }} />
                                <Text style={s.downloadPdfBtnTxt}>PDF</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleBluetoothPrint()} style={[s.downloadPdfBtn, { backgroundColor: '#e0f2fe', borderColor: '#0284c7' }]} activeOpacity={0.85}>
                                <Ionicons name="bluetooth-outline" size={13} color="#0284c7" style={{ marginRight: 3 }} />
                                <Text style={[s.downloadPdfBtnTxt, { color: '#0284c7' }]}>BT Print</Text>
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
                            {successModal.txData?.pins?.map((pinObj: any, idx: number) => {
                                const netKey = (successModal.txData?.network || selectedNetwork || 'mtn').toLowerCase();
                                const netLogo = NETWORK_LOGOS[netKey] || NETWORK_LOGOS.mtn;

                                return (
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
                                                <Text style={s.vPinTxt}><Text style={{ fontWeight: 'normal', fontSize: 9, color: '#000' }}>PIN: </Text>{(pinObj.pin || '').replace(/(.{4})/g, '$1 ').trim()}</Text>
                                                <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>S/N:</Text> {pinObj.serial || (idx + 1)}</Text>
                                                <Text style={s.vMetaTxt}><Text style={{ fontWeight: 'bold' }}>Date:</Text> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                                            </View>

                                            <View style={[s.vLogoBox, { backgroundColor: NETWORK_BG_COLORS[netKey] || '#ffcc00' }]}>
                                                <Image source={netLogo} style={s.vLogoImg} resizeMode="contain" />
                                            </View>
                                        </View>

                                        <View style={s.vDashedLine} />

                                        {/* Footer Row */}
                                        <View style={s.vFooterRow}>
                                            <Text style={s.vDialTxt}>{pinObj.load_code || successModal.txData?.load_code || successModal.txData?.loadCode || '*311*PIN#'}</Text>
                                            <Text style={s.vDenomTxt}>{successModal.txData?.denomination || '₦100'}</Text>
                                        </View>
                                    </View>
                                );
                            })}
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
    downloadPngBtn: {
        flex: 1,
        height: 36,
        backgroundColor: T.gold,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    downloadPngBtnTxt: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 12
    },
    downloadPdfBtn: {
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
    downloadPdfBtnTxt: {
        color: T.navy,
        fontWeight: '800',
        fontSize: 12
    },
    buyMoreBtn: {
        flex: 0.7,
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
        width: 34,
        height: 34,
        borderRadius: 6,
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

