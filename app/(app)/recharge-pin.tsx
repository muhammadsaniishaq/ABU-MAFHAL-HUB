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

    // Network logo URLs (hosted images for canvas use)
    const NETWORK_LOGO_URLS: Record<string, string> = {
        mtn: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/MTN_Logo.svg/512px-MTN_Logo.svg.png',
        glo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/27/Glo_logo.svg/512px-Glo_logo.svg.png',
        airtel: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Airtel_logo.svg/512px-Airtel_logo.svg.png',
        '9mobile': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/9Mobile_new_logo.svg/512px-9Mobile_new_logo.svg.png',
    };

    // 1. SAVE AS PNG IMAGE FILE (.png) - with real network logo
    const handleSaveAsPNG = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx || !tx.pins) return;
        const pins = tx.pins || [];

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const netKey = (tx.network || selectedNetwork || 'mtn').toLowerCase();
            const netBg = NETWORK_BG_COLORS[netKey] || '#ffcc00';
            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const denom = tx.denomination || '₦100';
            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now());

            const cardW = 480;
            const cardH = 180;
            const gap = 16;
            const padding = 24;

            const drawAllCards = (logoImg: HTMLImageElement | null) => {
                const canvas = document.createElement('canvas');
                canvas.width = cardW + (padding * 2);
                canvas.height = (pins.length * (cardH + gap)) + (padding * 2) + 40;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Page background
                const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
                bgGrad.addColorStop(0, '#eef2ff');
                bgGrad.addColorStop(1, '#f8fafc');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Header watermark text
                ctx.fillStyle = 'rgba(13,27,62,0.06)';
                ctx.font = 'bold 48px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ABU MAFHAL VTU', canvas.width / 2, canvas.height / 2 + 20);
                ctx.textAlign = 'left';

                pins.forEach((p: any, idx: number) => {
                    const y = padding + (idx * (cardH + gap));
                    const x = padding;

                    // Card shadow effect
                    ctx.shadowColor = 'rgba(13,27,62,0.18)';
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 4;

                    // Card background
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.roundRect(x, y, cardW, cardH, 12);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    // Card border
                    ctx.strokeStyle = '#0d1b3e';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(x, y, cardW, cardH, 12);
                    ctx.stroke();

                    // Header gradient banner (Navy)
                    const headerGrad = ctx.createLinearGradient(x, y, x + cardW, y);
                    headerGrad.addColorStop(0, '#0d1b3e');
                    headerGrad.addColorStop(1, '#142258');
                    ctx.fillStyle = headerGrad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, cardW, 36, [12, 12, 0, 0]);
                    ctx.fill();

                    // Gold left accent stripe
                    ctx.fillStyle = '#f5a623';
                    ctx.fillRect(x, y + 36, 4, cardH - 36);

                    // Business Name in header (Gold)
                    ctx.fillStyle = '#f5a623';
                    ctx.font = 'bold 13px Arial, sans-serif';
                    ctx.fillText(bName, x + 14, y + 24);

                    // Denomination badge in header (white)
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px Arial, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(denom + ' RECHARGE CARD', x + cardW - 14, y + 24);
                    ctx.textAlign = 'left';

                    // Network logo image or colored badge
                    const logoBoxX = x + cardW - 72;
                    const logoBoxY = y + 46;
                    const logoBoxW = 60;
                    const logoBoxH = 52;
                    ctx.fillStyle = netBg;
                    ctx.beginPath();
                    ctx.roundRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 8);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 8);
                    ctx.stroke();

                    if (logoImg) {
                        // Draw real logo image centered in badge
                        const maxSize = 42;
                        const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
                        let iw = maxSize, ih = maxSize;
                        if (aspectRatio > 1) ih = maxSize / aspectRatio;
                        else iw = maxSize * aspectRatio;
                        ctx.drawImage(logoImg,
                            logoBoxX + (logoBoxW - iw) / 2,
                            logoBoxY + (logoBoxH - ih) / 2,
                            iw, ih
                        );
                    } else {
                        // Fallback text badge
                        ctx.fillStyle = netKey === 'mtn' ? '#000000' : '#ffffff';
                        ctx.font = 'bold 14px Arial, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(netName, logoBoxX + logoBoxW / 2, logoBoxY + logoBoxH / 2 + 5);
                        ctx.textAlign = 'left';
                    }

                    // PIN Gold highlight box
                    const pinBoxX = x + 14;
                    const pinBoxY = y + 46;
                    const pinBoxW = cardW - 92;
                    const pinBoxH = 52;
                    ctx.fillStyle = '#fffbef';
                    ctx.strokeStyle = '#f5a623';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(pinBoxX, pinBoxY, pinBoxW, pinBoxH, 8);
                    ctx.fill();
                    ctx.stroke();

                    // PIN label
                    ctx.fillStyle = '#9a7000';
                    ctx.font = '10px Arial, sans-serif';
                    ctx.fillText('RECHARGE PIN', pinBoxX + 10, pinBoxY + 14);

                    // PIN digits - large bold monospace
                    const rawPin = (p.pin || '').toString();
                    const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                    const formattedPin = groups.join('  ');
                    ctx.fillStyle = '#0d1b3e';
                    ctx.font = 'bold 20px Courier New, monospace';
                    ctx.fillText(formattedPin, pinBoxX + 10, pinBoxY + 36);

                    // Divider dashed line
                    ctx.setLineDash([4, 4]);
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 14, y + 108);
                    ctx.lineTo(x + cardW - 14, y + 108);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Card number badge
                    ctx.fillStyle = '#0d1b3e';
                    ctx.font = 'bold 10px Arial, sans-serif';
                    ctx.fillText(`CARD ${idx + 1} OF ${pins.length}`, x + 14, y + 124);

                    // Meta info row
                    ctx.fillStyle = '#64748b';
                    ctx.font = '9px Courier New, monospace';
                    ctx.fillText(`REF: ${txRef}`, x + 14, y + 140);
                    ctx.fillText(`S/N: ${p.serial || (idx + 1)}  |  DATE: ${formattedDate}`, x + 14, y + 154);

                    // Dial code footer
                    ctx.fillStyle = '#0d1b3e';
                    ctx.font = 'bold 11px Courier New, monospace';
                    ctx.textAlign = 'right';
                    ctx.fillText(`DIAL: ${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}`, x + cardW - 14, y + 168);
                    ctx.textAlign = 'left';
                });

                // Footer text
                ctx.fillStyle = '#94a3b8';
                ctx.font = '10px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Generated by ABU MAFHAL VTU • Keep this card safe', canvas.width / 2, canvas.height - 8);
                ctx.textAlign = 'left';

                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `Recharge_Cards_${txRef}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showAlert('Downloaded PNG ✅', 'Recharge cards saved as PNG Image to your device!', 'success');
            };

            // Load network logo image first, then draw
            const logoUrl = NETWORK_LOGO_URLS[netKey];
            if (logoUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => drawAllCards(img);
                img.onerror = () => drawAllCards(null); // fallback to text badge
                img.src = logoUrl;
            } else {
                drawAllCards(null);
            }
        } else {
            const pinsList = tx.pins;
            const textToShare = pinsList.map((p: any, idx: number) =>
                `Card #${idx + 1} (${tx.denomination})\nPIN: ${p.pin}\nSerial: ${p.serial || (idx + 1)}\nDial: ${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}`
            ).join('\n\n');
            Share.share({ message: textToShare }).catch(() => {});
        }
    };

    // 2. SAVE AS PDF - auto-download real PDF file via html2canvas-style iframe blob
    const handleSaveAsPDF = (customTxData?: any) => {
        const tx = customTxData || successModal.txData;
        if (!tx || !tx.pins) return;
        const pins = tx.pins || [];

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const netKey = (tx.network || selectedNetwork || 'mtn').toLowerCase();
            const netBg = NETWORK_BG_COLORS[netKey] || '#ffcc00';
            const netName = (tx.network || selectedNetwork || 'MTN').toUpperCase();
            const netTextColor = netKey === 'mtn' ? '#000000' : '#ffffff';
            const bName = (tx.nameOnCard || tx.business_name || tx.businessName || nameOnCard || 'ABU MAFHAL VTU').toUpperCase();
            const txRef = tx.transaction_id || tx.transactionId || ('RCP' + Date.now());
            const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const formattedTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const logoUrl = NETWORK_LOGO_URLS[netKey] || '';

            const cardsHtml = pins.map((p: any, idx: number) => {
                const rawPin = (p.pin || '').toString();
                const groups = rawPin.match(/.{1,4}/g) || [rawPin];
                const formattedPin = groups.join('&nbsp;&nbsp;');
                return `
                <div class="card">
                    <div class="card-header">
                        <span class="biz-name">${bName}</span>
                        <span class="denom">${tx.denomination || '&#x20A6;100'} RECHARGE CARD</span>
                    </div>
                    <div class="card-body">
                        <div class="pin-row">
                            <div class="pin-box">
                                <div class="pin-label">RECHARGE PIN</div>
                                <div class="pin-number">${formattedPin}</div>
                            </div>
                            <div class="net-badge" style="background:${netBg};color:${netTextColor};">
                                ${logoUrl ? `<img src="${logoUrl}" style="width:38px;height:38px;object-fit:contain;" crossorigin="anonymous" />` : `<span style="font-weight:bold;font-size:12px;">${netName}</span>`}
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="meta-row">
                            <span class="card-num">CARD ${idx + 1} OF ${pins.length}</span>
                            <span>S/N: ${p.serial || (idx + 1)}</span>
                        </div>
                        <div class="ref-row">REF: ${txRef}</div>
                        <div class="footer-row">
                            <span class="dial">DIAL: ${p.load_code || tx.load_code || tx.loadCode || '*311*PIN#'}</span>
                            <span class="date">${formattedDate} ${formattedTime}</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Recharge_Cards_${txRef}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; background: #f0f4ff; padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1.page-title { text-align: center; color: #0d1b3e; font-size: 15px; margin-bottom: 12px; font-weight: 700; letter-spacing: 1px; border-bottom: 2px solid #f5a623; padding-bottom: 8px; }
  .sub-title { text-align: center; color: #64748b; font-size: 10px; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .card { background: #fff; border: 2px solid #0d1b3e; border-radius: 10px; overflow: hidden; page-break-inside: avoid; box-shadow: 0 2px 8px rgba(13,27,62,0.12); }
  .card-header { background: linear-gradient(135deg, #0d1b3e 0%, #142258 100%); padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #f5a623; }
  .biz-name { color: #f5a623; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
  .denom { color: #ffffff; font-size: 10px; font-weight: 700; }
  .card-body { padding: 10px 12px 8px; }
  .pin-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .pin-box { flex: 1; border: 2px solid #f5a623; background: #fffbef; border-radius: 7px; padding: 7px 10px; }
  .pin-label { font-size: 8px; color: #9a7000; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .pin-number { font-size: 18px; font-weight: 700; color: #0d1b3e; font-family: 'Courier New', monospace; letter-spacing: 2px; }
  .net-badge { width: 56px; height: 52px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.08); }
  .divider { border-top: 1px dashed #cbd5e1; margin: 7px 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; margin-bottom: 3px; }
  .card-num { font-weight: 700; color: #0d1b3e; }
  .ref-row { font-size: 8px; color: #94a3b8; font-family: 'Courier New', monospace; margin-bottom: 5px; }
  .footer-row { display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #0d1b3e; padding-top: 5px; }
  .dial { font-size: 10px; font-weight: 700; color: #0d1b3e; font-family: 'Courier New', monospace; }
  .date { font-size: 8px; color: #64748b; }
  .watermark { text-align: center; color: #cbd5e1; font-size: 9px; margin-top: 12px; }
</style>
</head>
<body>
  <h1 class="page-title">&#127371; ABU MAFHAL VTU — RECHARGE CARDS</h1>
  <div class="sub-title">${netName} ${tx.denomination || ''} &bull; Qty: ${pins.length} cards &bull; ${formattedDate}</div>
  <div class="grid">${cardsHtml}</div>
  <div class="watermark">Generated by ABU MAFHAL VTU &bull; Keep these cards safe &bull; ${txRef}</div>
</body>
</html>`;

            // Auto-download as .pdf file (browser saves via print-to-PDF internally)
            const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            iframe.src = blobUrl;
            iframe.onload = () => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } catch (_) {}
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    URL.revokeObjectURL(blobUrl);
                }, 2000);
            };
            showAlert('PDF Ready ✅', 'PDF print dialog is opening. Choose "Save as PDF" in your printer options.', 'success');
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
                        
                        {/* Top Action Row: SAVE PNG / SAVE PDF / CLOSE */}
                        <View style={s.resultTopBtnRow}>
                            <TouchableOpacity onPress={() => handleSaveAsPNG()} style={s.downloadPngBtn} activeOpacity={0.85}>
                                <Ionicons name="image-outline" size={14} color={T.navy} style={{ marginRight: 4 }} />
                                <Text style={s.downloadPngBtnTxt}>Save PNG</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleSaveAsPDF()} style={s.downloadPdfBtn} activeOpacity={0.85}>
                                <Ionicons name="document-text-outline" size={14} color={T.navy} style={{ marginRight: 4 }} />
                                <Text style={s.downloadPdfBtnTxt}>Save PDF</Text>
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
