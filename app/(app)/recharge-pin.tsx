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
import { NETWORK_LOGOS_B64 } from '../../assets/images/networkLogosB64';

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

    // Bluetooth searching state modal
    const [btSearchingModal, setBtSearchingModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
    }>({
        visible: false,
        title: '',
        message: ''
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'warning') => {
        setAlertModal({ visible: true, title, message, type });
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
            setBtSearchingModal({
                visible: true,
                title: 'Bluetooth Scanner',
                message: 'Auto-detecting active mini printer...'
            });
            const bt = (navigator as any).bluetooth;
            let device: any = null;

            // 1. Try auto-detecting previously granted/paired devices first
            if (typeof bt.getDevices === 'function') {
                try {
                    const pairedDevices = await bt.getDevices();
                    if (pairedDevices && pairedDevices.length > 0) {
                        for (const dev of pairedDevices) {
                            if (dev.gatt) {
                                try {
                                    setBtSearchingModal({
                                        visible: true,
                                        title: 'Connecting Printer',
                                        message: `Connecting to ${dev.name || 'mini printer'}...`
                                    });
                                    if (!dev.gatt.connected) {
                                        await dev.gatt.connect();
                                    }
                                    device = dev;
                                    break;
                                } catch (_) {}
                            }
                        }
                    }
                } catch (_) {}
            }

            // 2. Prompt user to select printer if not auto-connected
            if (!device) {
                setBtSearchingModal({
                    visible: true,
                    title: 'Select Printer',
                    message: 'Please choose your mini Bluetooth printer...'
                });
                device = await bt.requestDevice({
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
            }

            const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
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

            // ESC/POS thermal receipt formatting - compact card format matching History screen UI
            const enc = new TextEncoder();
            const ESC = 0x1B; const GS = 0x1D; const LF = 0x0A;
            const initCmd = new Uint8Array([ESC, 0x40]);
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
            const denom = tx.denomination || '₦100';
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now().toString(36).toUpperCase());
            const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            await characteristic.writeValue(initCmd);
            await characteristic.writeValue(centerCmd);
            await writeLine('================================');
            await characteristic.writeValue(boldOn);
            await characteristic.writeValue(dblHeight);
            await writeLine(bName.length > 18 ? bName.slice(0, 16) + '..' : bName);
            await characteristic.writeValue(normalSize);
            await characteristic.writeValue(boldOff);
            await writeLine(`${netName} ${denom} RECHARGE VOUCHER`);
            await writeLine('================================');
            await characteristic.writeValue(leftCmd);

            for (let i = 0; i < pins.length; i++) {
                const p = pins[i];
                await characteristic.writeValue(centerCmd);
                await writeLine(`-- CARD ${i + 1} OF ${pins.length} --`);
                await characteristic.writeValue(leftCmd);

                const rawPin = (p.pin || '').toString();
                const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                const formattedPin = groups.join(' ');

                await writeLine('REF:  ' + txRef);
                await characteristic.writeValue(boldOn);
                await writeLine('PIN:  ' + formattedPin);
                await characteristic.writeValue(boldOff);

                await writeLine('S/N:  ' + (p.serial || (i + 1)));
                await writeLine('DATE: ' + dateStr);
                await writeLine('DIAL: ' + (p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'));
                await writeLine('DENOM: ' + denom);
                await writeLine('--------------------------------');
            }

            await characteristic.writeValue(centerCmd);
            await writeLine('Generated by ABU MAFHAL VTU');
            await writeLine('Keep receipt safe!');
            await characteristic.writeValue(new Uint8Array([LF, LF, LF]));
            await characteristic.writeValue(cutCmd);

            setBtSearchingModal({ visible: false, title: '', message: '' });
            showAlert('Printed! ✅', `${pins.length} recharge card(s) sent to ${device.name || 'Bluetooth Printer'} successfully!`, 'success');
        } catch (err: any) {
            setBtSearchingModal({ visible: false, title: '', message: '' });
            if (err.name === 'NotFoundError') {
                showAlert('Cancelled', 'No printer was selected.', 'warning');
            } else {
                showAlert('Bluetooth Error ❌', err.message || 'Could not connect to printer. Make sure it is turned on.', 'error');
            }
        }
    };

    // ─── 1. SAVE AS PNG (Compact cards matching History screen UI) ───
    const handleSaveAsPNG = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx) return;
        const pins = safeParsePins(tx);
        if (pins.length === 0) { showAlert('No PINs', 'No PIN data to save.', 'error'); return; }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const netKey = (tx.network || selectedNetwork || 'mtn').toLowerCase();
            const netBg = NETWORK_BG_COLORS[netKey] || '#ffcc00';
            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const denom = tx.denomination || '₦100';
            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now());

            // 3-column compact layout (CW = 320, CH = 180 matching printedVoucherCard)
            const COLS = 3;
            const CW = 320, CH = 180;
            const GAP_X = 16, GAP_Y = 16;
            const PAD_X = 36, HEADER_H = 80, FOOTER_H = 40;
            const rows = Math.ceil(pins.length / COLS);
            const canvasW = COLS * CW + (COLS - 1) * GAP_X + PAD_X * 2;
            const canvasH = HEADER_H + rows * (CH + GAP_Y) + FOOTER_H;

            const drawAllCards = (logoImg: HTMLImageElement | null) => {
                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Canvas Background
                ctx.fillStyle = '#f1f5f9';
                ctx.fillRect(0, 0, canvasW, canvasH);

                // Header Banner
                ctx.fillStyle = '#0d1b3e';
                ctx.fillRect(0, 0, canvasW, 60);

                ctx.fillStyle = '#f5a623';
                ctx.font = 'bold 20px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ABU MAFHAL VTU — RECHARGE VOUCHERS', canvasW / 2, 36);
                ctx.textAlign = 'left';

                pins.forEach((p: any, idx: number) => {
                    const col = idx % COLS;
                    const row = Math.floor(idx / COLS);
                    const X = PAD_X + col * (CW + GAP_X);
                    const Y = HEADER_H + row * (CH + GAP_Y);

                    // ── Card container ──
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.roundRect(X, Y, CW, CH, 8); ctx.fill();

                    ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.roundRect(X, Y, CW, CH, 8); ctx.stroke();

                    // ── Header row ──
                    ctx.fillStyle = '#000000'; ctx.font = 'bold 11px Arial, sans-serif';
                    ctx.fillText(bName.length > 26 ? bName.slice(0, 24) + '..' : bName, X + 10, Y + 18);

                    // Dashed line 1
                    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(X + 8, Y + 26); ctx.lineTo(X + CW - 8, Y + 26); ctx.stroke();
                    ctx.setLineDash([]);

                    // ── Body section ──
                    const rawPin = (p.pin || '').toString();
                    const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                    const formattedPin = groups.join(' ');

                    ctx.fillStyle = '#333333'; ctx.font = '10px Courier New, monospace';
                    ctx.fillText(`REF: ${txRef}`, X + 10, Y + 42);

                    ctx.fillStyle = '#000000'; ctx.font = 'bold 15px Courier New, monospace';
                    ctx.fillText(`PIN: ${formattedPin}`, X + 10, Y + 65);

                    ctx.fillStyle = '#333333'; ctx.font = '10px Courier New, monospace';
                    ctx.fillText(`S/N: ${p.serial || (idx + 1)}`, X + 10, Y + 85);
                    ctx.fillText(`Date: ${formattedDate}`, X + 10, Y + 102);

                    // Logo Box (Right)
                    const LBX = X + CW - 68, LBY = Y + 34, LBW = 58, LBH = 58;
                    ctx.fillStyle = netBg;
                    ctx.beginPath(); ctx.roundRect(LBX, LBY, LBW, LBH, 6); ctx.fill();
                    ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.roundRect(LBX, LBY, LBW, LBH, 6); ctx.stroke();

                    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
                        const mxW = 50, mxH = 50;
                        const ar = logoImg.naturalWidth / Math.max(logoImg.naturalHeight, 1);
                        let iw = mxW, ih = mxW / ar;
                        if (ih > mxH) { ih = mxH; iw = mxH * ar; }
                        ctx.drawImage(logoImg, LBX + (LBW - iw) / 2, LBY + (LBH - ih) / 2, iw, ih);
                    } else {
                        ctx.fillStyle = netKey === 'mtn' ? '#000000' : '#ffffff';
                        ctx.font = 'bold 13px Arial Black, Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(netName, LBX + LBW / 2, LBY + LBH / 2 + 4);
                        ctx.textAlign = 'left';
                    }

                    // Dashed line 2
                    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(X + 8, Y + 120); ctx.lineTo(X + CW - 8, Y + 120); ctx.stroke();
                    ctx.setLineDash([]);

                    // ── Footer row ──
                    ctx.fillStyle = '#000000'; ctx.font = 'bold 11px Courier New, monospace';
                    ctx.fillText(p.load_code || tx.load_code || tx.loadCode || '*311*PIN#', X + 10, Y + 140);

                    ctx.fillStyle = '#000000'; ctx.font = 'bold 14px Arial, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(denom, X + CW - 10, Y + 140);
                    ctx.textAlign = 'left';
                });

                // Footer watermark
                ctx.fillStyle = '#64748b'; ctx.font = '11px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Generated by ABU MAFHAL VTU • Ref: ${txRef}`, canvasW / 2, canvasH - 16);

                const dataUrl = canvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `RechargeCards_${txRef}.png`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                showAlert('Downloaded PNG ✅', `${pins.length} voucher card(s) saved as PNG image!`, 'success');
            };

            const b64Data = NETWORK_LOGOS_B64[netKey] || NETWORK_LOGOS_B64.mtn;
            if (typeof document !== 'undefined') {
                const img = document.createElement('img') as HTMLImageElement;
                img.onload = () => drawAllCards(img);
                img.onerror = () => drawAllCards(null);
                img.src = b64Data;
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

    // ─── 2. SAVE AS PDF (Exact compact voucher card layout matching History screen UI) ───
    const handleSaveAsPDF = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx) return;
        const pins = safeParsePins(tx);
        if (pins.length === 0) { showAlert('No PINs', 'No PIN data to save.', 'error'); return; }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const netKey = (tx.network || selectedNetwork || 'mtn').toLowerCase();
            const netBg = NETWORK_BG_COLORS[netKey] || '#ffcc00';
            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now());
            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const formattedTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            const logoB64 = NETWORK_LOGOS_B64[netKey] || NETWORK_LOGOS_B64.mtn;

            const cardsHtml = pins.map((p: any, idx: number) => {
                const rawPin = (p.pin || '').toString();
                const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                const formattedPin = groups.join('&nbsp;&nbsp;');
                const dialCode = p.load_code || tx.load_code || tx.loadCode || '*311*PIN#';
                return `
<div class="card">
  <div class="v-header">
    <span class="v-name">${bName.length > 24 ? bName.slice(0, 22) + '..' : bName}</span>
    <span>CARD ${idx + 1}/${pins.length}</span>
  </div>
  <div class="v-dashed"></div>
  <div class="v-body">
    <div class="v-meta-left">
      <div><b>REF:</b> ${txRef}</div>
      <div class="v-pin-txt"><b>PIN:</b> ${formattedPin}</div>
      <div><b>S/N:</b> ${p.serial || (idx + 1)}</div>
      <div><b>Date:</b> ${formattedDate}</div>
    </div>
    <div class="v-logo-box" style="background:${netBg};">
      <img src="${logoB64}" />
    </div>
  </div>
  <div class="v-dashed"></div>
  <div class="v-footer">
    <span>${dialCode}</span>
    <span>${tx.denomination || '₦100'}</span>
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
  body { font-family: monospace, Arial, sans-serif; background: #ffffff; padding: 4mm 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page-header { text-align: center; margin-bottom: 4mm; border-bottom: 1.5px solid #000; padding-bottom: 2mm; width: 190mm; margin-left: auto; margin-right: auto; }
  .page-title { font-size: 11pt; font-weight: bold; color: #000; }
  .page-sub { font-size: 7.5pt; color: #444; margin-top: 1mm; }
  .grid { display: grid; grid-template-columns: repeat(3, 60mm); gap: 3mm 4mm; justify-content: center; width: 190mm; margin: 0 auto; }
  .card { width: 60mm; height: 36mm; background: #ffffff; border: 1.2px solid #000; border-radius: 2mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; }
  .v-header { display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; font-weight: bold; color: #000; }
  .v-dashed { border-top: 1px dashed #999; margin: 1mm 0; }
  .v-body { display: flex; justify-content: space-between; align-items: center; gap: 1mm; flex: 1; }
  .v-meta-left { flex: 1; font-size: 5.5pt; line-height: 1.25; color: #000; }
  .v-pin-txt { font-size: 9pt; font-weight: bold; color: #000; font-family: monospace; letter-spacing: 0.5px; margin: 0.5mm 0; }
  .v-logo-box { width: 12mm; height: 12mm; border-radius: 1.5mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #ccc; padding: 1px; }
  .v-logo-box img { max-width: 11mm; max-height: 11mm; object-fit: contain; }
  .v-footer { display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; font-weight: bold; color: #000; }
  .watermark { text-align: center; color: #888; font-size: 7pt; margin-top: 4mm; }
</style>
</head>
<body>
<div class="page-header">
  <div class="page-title">&#127371; ABU MAFHAL VTU &#8212; RECHARGE VOUCHERS SHEET</div>
  <div class="page-sub">${netName} ${tx.denomination || ''} &bull; ${pins.length} Card(s) &bull; ${formattedDate} ${formattedTime} &bull; Ref: ${txRef}</div>
</div>
<div class="grid">${cardsHtml}</div>
<div class="watermark">Generated by ABU MAFHAL VTU &bull; History Screen Voucher Design</div>
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
            showAlert('PDF Ready ✅', 'Print dialog is opening. Choose "Save as PDF" or select your printer.', 'success');
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

            {/* MODERN DECORATED INTERACTIVE ALERT MODAL */}
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
                        <View style={s.alertDecorStripe} />

                        <View style={[
                            s.alertIconBox,
                            { backgroundColor: alertModal.type === 'success' ? '#dcfce7' : alertModal.type === 'error' ? '#fee2e2' : '#fef3c7' }
                        ]}>
                            <Ionicons
                                name={alertModal.type === 'success' ? 'checkmark-circle' : alertModal.type === 'error' ? 'close-circle' : 'alert-circle'}
                                size={36}
                                color={alertModal.type === 'success' ? '#16a34a' : alertModal.type === 'error' ? '#dc2626' : T.goldDk}
                            />
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
                            <Text style={s.alertCloseBtnTxt}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODERN BLUETOOTH SEARCHING / CONNECTING MODAL */}
            <Modal
                transparent
                visible={btSearchingModal.visible}
                animationType="fade"
                onRequestClose={() => setBtSearchingModal(prev => ({ ...prev, visible: false }))}
            >
                <View style={s.alertModalOverlay}>
                    <View style={s.btSearchModalCard}>
                        <View style={s.btRadarCircle}>
                            <Ionicons name="bluetooth" size={32} color="#0284c7" />
                        </View>

                        <Text style={s.btSearchTitle}>{btSearchingModal.title || 'Bluetooth Scanner'}</Text>
                        <Text style={s.btSearchMsg}>{btSearchingModal.message || 'Connecting to printer...'}</Text>

                        <View style={s.btLoadingBarWrap}>
                            <ActivityIndicator size="small" color="#0284c7" />
                        </View>

                        <TouchableOpacity
                            onPress={() => setBtSearchingModal({ visible: false, title: '', message: '' })}
                            style={s.btCancelBtn}
                            activeOpacity={0.8}
                        >
                            <Text style={s.btCancelBtnTxt}>Cancel</Text>
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
        backgroundColor: 'rgba(13, 27, 62, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    alertModalCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        alignItems: 'center',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(13,27,62,0.3)'
    },
    alertDecorStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: T.gold
    },
    alertIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    alertTitleTxt: {
        fontSize: 17,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8
    },
    alertMsgTxt: {
        fontSize: 13,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20
    },
    alertCloseBtn: {
        width: '100%',
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    alertCloseBtnTxt: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14
    },

    // BLUETOOTH SEARCHING MODAL STYLES
    btSearchModalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#0284c7',
        boxShadow: '0 12px 32px rgba(2,132,199,0.25)'
    },
    btRadarCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#e0f2fe',
        borderWidth: 2,
        borderColor: '#38bdf8',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    btSearchTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: T.navy,
        marginBottom: 6
    },
    btSearchMsg: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 16
    },
    btLoadingBarWrap: {
        marginVertical: 8
    },
    btCancelBtn: {
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9'
    },
    btCancelBtnTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b'
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

