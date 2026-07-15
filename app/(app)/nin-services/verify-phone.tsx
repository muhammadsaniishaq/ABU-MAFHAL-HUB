import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet, Clipboard } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';

// Helper to safely load external images on Web for canvas rendering
const getSafeImageUrl = (url: string) => {
    if (Platform.OS === 'web' && url.startsWith('http')) {
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    }
    return url;
};

// Slip Components
import { IDCardMockup } from '../../../components/IDCardMockup';

import { StandardSlip } from '../../../components/StandardSlip';
import { RegularSlip } from '../../../components/RegularSlip';
import { InformationSlip } from '../../../components/InformationSlip';

const DEFAULT_LAYOUTS = [
    { id: 'premium', db_id: 'nin_premium', name: 'Premium Card', price: 200, type: 'prem', image: require('../../../assets/images/premium.png'), badge: 'Digital ID' },
    { id: 'standard', db_id: 'nin_standard', name: 'Standard Card', price: 200, type: 'nonprem', image: require('../../../assets/images/standard.png'), badge: 'Color Card' },
    { id: 'regular', db_id: 'nin_regular', name: 'Regular Slip', price: 180, type: 'nonprem', image: require('../../../assets/images/regular.png'), badge: 'B&W Slip' },
    { id: 'info', db_id: 'nin_info', name: 'Information', price: 200, type: 'nonprem', image: require('../../../assets/images/info.png'), badge: 'Full Sheet' },
];

const formatDob = (raw: string): string => {
    if (!raw || raw === 'N/A') return raw;
    const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    try {
        const parts = raw.split(/[-/]/);
        if (parts.length === 3) {
            let y: string, m: string, d: string;
            if (parts[0].length === 4) { [y, m, d] = parts; } else { [d, m, y] = parts; }
            const idx = parseInt(m, 10) - 1;
            if (idx >= 0 && idx < 12) return `${d.padStart(2,'0')} ${MONTHS[idx]} ${y}`;
        }
    } catch (_) {}
    return raw;
};

export default function VerifyPhoneScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [selectedLayout, setSelectedLayout] = useState('premium');
    const [isAgreed, setIsAgreed] = useState(false);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
    const [isSaving, setIsSaving] = useState(false);
    const viewShotRef = useRef<any>(null);

    // Premium States
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Custom Smooth Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setCustomAlert({
            visible: true,
            title,
            message,
            type
        });
    };

    const loadHistory = async () => {
        try {
            const stored = await AsyncStorage.getItem('recent_nin_verifications');
            if (stored) {
                setHistoryList(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load history', e);
        }
    };

        const saveHistoryItem = async (verifiedData: any) => {
        try {
            const name = `${verifiedData.firstname || ''} ${verifiedData.surname || ''}`.trim() || 'Unknown Name';
            const newItem = {
                id: `verify_${Date.now()}`,
                nin: verifiedData.nin || 'N/A',
                name,
                layout: selectedLayout,
                date: (() => {
                    const d = new Date();
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                })(),
                data: verifiedData
            };
            
            const updated = [newItem, ...historyList.filter(item => item.nin !== newItem.nin)].slice(0, 500);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };

    const deleteHistoryItem = async (itemId: string) => {
        try {
            const updated = historyList.filter(item => item.id !== itemId);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to delete history item', e);
        }
    };

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) {
                    setUserBalance(Number(data.balance));
                }
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getString();
            const clean = text.replace(/\D/g, '').slice(0, 15);
            setPhone(clean);
            showAlert('Pasted Successfully', 'Phone number copied from your clipboard has been pasted.', 'success');
        } catch (e) {
            console.warn('Failed to paste from clipboard', e);
        }
    };

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const { data, error } = await supabase.from('service_pricing').select('*').eq('service_category', 'nin');
                if (error || !data) return;
                
                setLayouts(prev => prev.map(layout => {
                    const dbPrice = data.find(d => d.id === layout.db_id);
                    if (dbPrice) {
                        return { ...layout, price: Number(dbPrice.cost_price) + Number(dbPrice.markup_price) };
                    }
                    return layout;
                }));
            } catch (e) {
                console.warn('Failed to fetch dynamic prices', e);
            }
        };
        fetchPrices();
        loadHistory();
        fetchWalletBalance();
    }, []);

    const handleVerify = async () => {
        const cleanPhone = phone.trim();
        if (cleanPhone.length < 10) {
            return showAlert('Phone Number Invalid', 'Please enter a valid phone number (e.g. 080xxxxxxxx).', 'warning');
        }
        const layoutItem = layouts.find(l => l.id === selectedLayout);
        const totalPrice = layoutItem ? layoutItem.price : 0;
        if ((userBalance || 0) < totalPrice) {
            return showAlert('Insufficient Balance', `Your wallet balance (₦${(userBalance || 0).toLocaleString()}) is less than the required amount (₦${totalPrice.toLocaleString()}). Please fund your wallet.`, 'error');
        }

        setLoading(true);
        try {
            const response = await api.identity.verifyNINWithPhone(cleanPhone);
            
            if (response.isValid && response.data) {
                let personData = response.data?.data ?? response.data;
                setResult({ status: 'success', data: personData });
                await saveHistoryItem(personData);

            // Deduct Wallet Balance
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
                const { error: deductError } = await supabase.rpc('deduct_balance', {
                    user_id: authData.user.id,
                    amount: totalPrice
                });
                if (!deductError) {
                    await supabase.from('transactions').insert({
                        user_id: authData.user.id,
                        type: 'nin_service',
                        amount: totalPrice,
                        status: 'success',
                        description: 'NIN Service Deduction',
                        reference: `NIN-SRV-${Date.now()}`
                    });
                } else {
                    console.error("Wallet deduction failed:", deductError);
                }
            }

            } else {
                const msg = response.message || 'Unable to verify this phone number. Please check and try again.';
                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance') || lowerMsg.includes('wallet')) {
                    showAlert('Service Unavailable', 'This verification service is temporarily unavailable. Please try again later.', 'warning');
                } else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('auth')) {
                    showAlert('Session Expired', 'Please log out and log in again, then retry.', 'error');
                } else if (lowerMsg.includes('not found') || lowerMsg.includes('no record') || lowerMsg.includes('does not exist') || lowerMsg.includes('not exist') || lowerMsg.includes('invalid or not found')) {
                    showAlert('No Record Found', 'The phone number you entered does not exist or has no linked record.', 'error');
                } else {
                    showAlert('Verification Failed', msg, 'error');
                }
            }
        } catch (e: any) {
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist') || errM.toLowerCase().includes('not exist') || errM.toLowerCase().includes('invalid or not found')) {
                showAlert('No Record Found', 'The phone number you entered does not exist or has no linked record.', 'error');
            } else {
                showAlert('Network Error', errM || 'A network error occurred. Please check your connection and try again.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPng = async () => {
        setIsSaving(true);
        try {
            if (Platform.OS === 'web') {
                await new Promise<void>((resolve) => {
                    const node = document.getElementById('slip-preview-container');
                    if (!node) return resolve();
                    
                    const generatePng = () => {
                        // @ts-ignore
                        window.html2canvas(node, { useCORS: true, scale: 5 }).then((canvas) => {
                            const link = document.createElement('a');
                            link.download = `nin_slip_phone_${phone || 'verify'}.png`;
                            link.href = canvas.toDataURL('image/png');
                            link.click();
                            resolve();
                        }).catch(() => resolve());
                    };

                    if ((window as any).html2canvas) {
                        generatePng();
                    } else {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                        script.onload = generatePng;
                        document.head.appendChild(script);
                    }
                });
            } else {
                if (!viewShotRef.current) return;
                const uri = await viewShotRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Download NIN Slip (PNG)',
                        UTI: 'public.png'
                    });
                } else {
                    showAlert("Sharing Unavailable", "Sharing is not available on this device.", "warning");
                }
            }
        } catch (e: any) {
            showAlert("PNG Download Failed", e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!result || !result.data) return;
        setIsSaving(true);
        try {
            const first = result.data.firstname || '';
            const middle = result.data.middlename || '';
            const surname = result.data.surname || '';
            const displayNin = result.data.nin || result.data.number || 'N/A';
            const trackingId = result.data.trackingId || result.data.tracking_id || 'N/A';
            const gender = result.data.gender || result.data.sex || 'N/A';
            const dob = formatDob(result.data.birthdate || result.data.dob || 'N/A');
            const phoneVal = result.data.telephoneno || result.data.phone || 'N/A';
            const residenceState = result.data.residence_state || result.data.state || 'N/A';
            const residenceLga = result.data.residence_lga || result.data.lga || 'N/A';
            const birthState = result.data.birthstate || result.data.birth_state || 'N/A';
            const birthLga = result.data.birthlga || result.data.birth_lga || 'N/A';
            const address = result.data.residence_address || result.data.address || 'N/A';
            const rawPhoto = result.data.photo || result.data.image || '';

            // Handle base64 photo formatting
            let photoUrl = getSafeImageUrl('https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png');
            if (rawPhoto) {
                photoUrl = rawPhoto.startsWith('data:') ? rawPhoto : `data:image/jpeg;base64,${rawPhoto}`;
            }

            const cleanNin = displayNin.replace(/\D/g, '');
            const fmtNin = cleanNin.length === 11 
                ? `${cleanNin.slice(0, 4)} ${cleanNin.slice(4, 7)} ${cleanNin.slice(7)}` 
                : cleanNin;

            let html = '';
            if (selectedLayout === 'info') {
                html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Verified NIN Details</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            color: #000000;
                            background-color: #ffffff;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                            min-height: 100vh;
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .page-container {
                            width: 8.27in;
                            min-height: 11.69in;
                            background-color: #ffffff;
                            padding: 0.5in 0.6in;
                            position: relative;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                        }
                        .header-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            width: 100%;
                            margin-bottom: 8px;
                        }
                        .logo-coat {
                            width: 85px;
                            height: 85px;
                            object-fit: contain;
                        }
                        .logo-coat img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }
                        .logo-nimc {
                            width: 120px;
                            height: 75px;
                            object-fit: contain;
                        }
                        .logo-nimc img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }
                        .header-center {
                            text-align: center;
                            flex: 1;
                            margin: 0 16px;
                        }
                        .header-center h1 {
                            color: #6c7d8a;
                            font-size: 32px;
                            font-weight: bold;
                            margin: 0 0 4px 0;
                            letter-spacing: -0.02em;
                            line-height: 1;
                        }
                        .header-center h2 {
                            color: #72828e;
                            font-size: 34px;
                            font-weight: bold;
                            margin: 0;
                            letter-spacing: -0.02em;
                            line-height: 1;
                        }
                        .grid-main {
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                            gap: 24px;
                            margin-top: 32px;
                        }
                        .col-details {
                            grid-column: span 4;
                            display: flex;
                            flex-direction: column;
                            gap: 14px;
                            font-size: 13px;
                            font-weight: 500;
                            padding-top: 4px;
                        }
                        .detail-item {
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                            align-items: start;
                            line-height: 1.2;
                        }
                        .detail-lbl {
                            grid-column: span 5;
                            color: black;
                            font-weight: bold;
                        }
                        .detail-val {
                            grid-column: span 7;
                            color: black;
                            text-transform: uppercase;
                            font-weight: normal;
                        }
                        .col-photo {
                            grid-column: span 3;
                            display: flex;
                            flex-direction: column;
                            align-items: start;
                            padding-left: 8px;
                        }
                        .photo-box {
                            width: 155px;
                            height: 190px;
                            border: 1px solid #9ca3af;
                            background-color: #e3deda;
                            overflow: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
                        }
                        .photo-box img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }
                        .sig-lbl {
                            font-size: 13px;
                            font-weight: 500;
                            color: black;
                            margin-top: 6px;
                        }
                        .col-status {
                            grid-column: span 5;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            padding-top: 4px;
                            text-align: center;
                        }
                        .verified-title {
                            color: #009639;
                            font-size: 38px;
                            font-weight: bold;
                            letter-spacing: 0.02em;
                            margin: 0 0 4px 0;
                            line-height: 1;
                        }
                        .property-note {
                            color: black;
                            font-size: 11px;
                            line-height: 1.4;
                            font-weight: normal;
                            max-width: 340px;
                            margin: 0 0 16px 0;
                        }
                        .rules-list {
                            color: black;
                            font-size: 12px;
                            line-height: 1.35;
                            text-align: justify;
                            font-weight: normal;
                            list-style: none;
                            padding: 0;
                            margin: 0 0 16px 0;
                        }
                        .rules-list li {
                            margin-bottom: 6px;
                        }
                        .red-bold {
                            color: #dc2626;
                            font-weight: bold;
                        }
                        .stamp-box {
                            width: 115px;
                            height: 115px;
                            margin-top: 8px;
                            transform: rotate(-12deg);
                            opacity: 0.85;
                        }
                        .nin-number-row {
                            width: 100%;
                            margin-top: 16px;
                            display: flex;
                            align-items: baseline;
                        }
                        .nin-lbl {
                            color: black;
                            font-size: 22px;
                            font-weight: bold;
                            margin-right: 12px;
                        }
                        .nin-val-large {
                            color: black;
                            font-size: 34px;
                            font-weight: bold;
                            letter-spacing: 0.18em;
                            font-family: Arial, sans-serif;
                            line-height: 1;
                        }
                        .grid-lower {
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                            gap: 24px;
                            margin-top: 24px;
                            font-size: 13px;
                            font-weight: 500;
                        }
                        .lower-col-1 {
                            grid-column: span 4;
                            display: flex;
                            flex-direction: column;
                            gap: 16px;
                        }
                        .lower-col-2 {
                            grid-column: span 5;
                            display: flex;
                            flex-direction: column;
                            gap: 16px;
                            padding-left: 8px;
                        }
                        .footer-row {
                            width: 100%;
                            display: flex;
                            justify-content: flex-end;
                            padding-right: 175px;
                            padding-bottom: 64px;
                        }
                        .footer-state {
                            color: black;
                            font-size: 12px;
                            font-weight: normal;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div>
                            <!-- Header -->
                            <div class="header-row">
                                <div class="logo-coat">
                                    <img src="${getSafeImageUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png')}" alt="Coat of Arms of Nigeria">
                                </div>
                                <div class="header-center">
                                    <h1>Federal Republic of Nigeria</h1>
                                    <h2>Verified NIN Details</h2>
                                </div>
                                <div class="logo-nimc">
                                    <img src="${getSafeImageUrl('https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png')}" alt="NIMC Logo">
                                </div>
                            </div>

                            <!-- Main Grid -->
                            <div class="grid-main">
                                <!-- Col 1: Details -->
                                <div class="col-details">
                                    <div class="detail-item">
                                        <div class="detail-lbl">First Name:</div>
                                        <div class="detail-val">${first.toUpperCase()}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl">Middle Name:</div>
                                        <div class="detail-val">${middle.toUpperCase()}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl">Last Name:</div>
                                        <div class="detail-val">${surname.toUpperCase()}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl">Date of Birth:</div>
                                        <div class="detail-val" style="white-space: nowrap;">${dob}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl">Gender:</div>
                                        <div class="detail-val">${gender}</div>
                                    </div>
                                </div>

                                <!-- Col 2: Photo -->
                                <div class="col-photo">
                                    <div class="photo-box">
                                        <img src="${photoUrl}" alt="Profile Photo">
                                    </div>
                                    <div class="sig-lbl">Signature:</div>
                                </div>

                                <!-- Col 3: Stamp & Rules -->
                                <div class="col-status">
                                    <h3 class="verified-title">Verified</h3>
                                    <p class="property-note">
                                        This is a property of National Identity Management Commission (NIMC), Nigeria. If found, please return to the nearest NIMC's office.
                                    </p>
                                    <ol class="rules-list">
                                        <li>1. This NIN slip remains the property of the Federal Republic of Nigeria, and must be surrendered on demand;</li>
                                        <li>2. This NIN slip does not imply nor confer the citizenship of the Federal Republic of Nigeria on the individual the document is issued to;</li>
                                        <li>3. This NIN slip is valid for the lifetime of the owner and <span class="red-bold">DOES NOT EXPIRE</span></li>
                                    </ol>

                                    <!-- Circular Stamp -->
                                    <div class="stamp-box">
                                        <svg viewBox="0 0 120 120" style="width:100%; height:100%; fill:currentcolor; color:#429343;">
                                            <circle cx="60" cy="60" r="48" fill="none" stroke="#429343" stroke-width="2.5"/>
                                            <circle cx="60" cy="60" r="42" fill="none" stroke="#429343" stroke-width="0.75"/>
                                            <rect x="15" y="44" width="90" height="32" fill="white" stroke="#429343" stroke-width="2.5" rx="3" />
                                            <text x="60" y="65" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="15" text-anchor="middle" fill="#429343" letter-spacing="0.5">VERIFIED</text>
                                            
                                            <path id="top-arch" d="M 26 50 A 36 36 0 0 1 94 50" fill="none" stroke="none"/>
                                            <text font-size="6.5" font-weight="bold" fill="#429343" letter-spacing="1">
                                                <textPath href="#top-arch" startOffset="50%" text-anchor="middle">VERIFIED</textPath>
                                            </text>
                                            <text font-size="4" font-weight="bold" fill="#429343" x="46" y="32">★ ★ ★</text>

                                            <path id="bottom-arch" d="M 94 70 A 36 36 0 0 1 26 70" fill="none" stroke="none"/>
                                            <text font-size="6.5" font-weight="bold" fill="#429343" letter-spacing="1">
                                                <textPath href="#bottom-arch" startOffset="50%" text-anchor="middle">VERIFIED</textPath>
                                            </text>
                                            <text font-size="4" font-weight="bold" fill="#429343" x="46" y="87">★ ★ ★</text>
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <!-- NIN Row -->
                            <div class="nin-number-row">
                                <span class="nin-lbl">NIN NUMBER:</span>
                                <span class="nin-val-large">${fmtNin}</span>
                            </div>

                            <!-- Lower Grid -->
                            <div class="grid-lower">
                                <div class="lower-col-1">
                                    <div class="detail-item">
                                        <div class="detail-lbl">Tracking ID:</div>
                                        <div class="detail-val" style="font-family: monospace;">${trackingId}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl" style="line-height: 1.1;">Residence State:</div>
                                        <div class="detail-val">${residenceState.toUpperCase()}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl" style="line-height: 1.1;">Birth State:</div>
                                        <div class="detail-val">${birthState.toUpperCase()}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl">Address:</div>
                                        <div class="detail-val">${address}</div>
                                    </div>
                                </div>

                                <div class="lower-col-2">
                                    <div class="detail-item">
                                        <div class="detail-lbl" style="white-space: nowrap;">Phone Number:</div>
                                        <div class="detail-val" style="padding-left: 16px;">${phoneVal}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl" style="line-height: 1.1;">Residence LGA/Town:</div>
                                        <div class="detail-val" style="padding-left: 16px;">${residenceLga.toUpperCase()}</div>
                                    </div>
                                    <div class="detail-item" style="margin-top: 4px;">
                                        <div class="detail-lbl" style="line-height: 1.1;">Birth LGA:</div>
                                        <div class="detail-val" style="padding-left: 16px;">${birthLga.toUpperCase()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer birth state -->
                        <div class="footer-row">
                            <span class="footer-state">${birthState.toUpperCase()}</span>
                        </div>
                    </div>
                </body>
                </html>
                `;
            } else {
                const uri = await viewShotRef.current.capture();
                let dataUri = uri;
                if (Platform.OS !== 'web') {
                    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                    dataUri = `data:image/png;base64,${base64}`;
                }
                html = `
                <html>
                <head>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 0; 
                            background-color: white; 
                            display: flex; 
                            flex-direction: column;
                            align-items: center; 
                            justify-content: center; 
                            height: 100vh; 
                            font-family: Arial, sans-serif;
                            box-sizing: border-box; 
                        }
                        .page-container {
                            width: 100%;
                            max-width: 600px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .header-text {
                            text-align: center;
                            font-size: 13px;
                            color: #333;
                            margin-bottom: 25px;
                            line-height: 1.5;
                        }
                        .card-img {
                            width: 480px;
                            border: 1px dashed #ccc;
                            border-radius: 8px;
                            overflow: hidden;
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="header-text">
                            <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">You may cut it out of the paper, fold and laminate as desired.</p>
                        </div>
                        <div class="card-img">
                            <img src="${dataUri}" style="width: 100%; height: auto; display: block;" />
                        </div>
                    </div>
                </body>
                </html>
                `;
            }

            if (Platform.OS === 'web') {
                await new Promise<void>((resolve) => {
                    const generatePdf = () => {
                        const container = document.createElement('div');
                        container.innerHTML = html;
                        container.style.position = 'absolute';
                        container.style.top = '-9999px';
                        document.body.appendChild(container);
                        
                        // @ts-ignore
                        window.html2pdf().set({
                            margin: 0,
                            filename: `nin_slip_phone.pdf`,
                            image: { type: 'jpeg', quality: 1.0 },
                            html2canvas: { scale: 5, useCORS: true },
                            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                        }).from(container).save().then(() => {
                            document.body.removeChild(container);
                            resolve();
                        }).catch(() => {
                            document.body.removeChild(container);
                            resolve();
                        });
                    };

                    if ((window as any).html2pdf) {
                        generatePdf();
                    } else {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                        script.onload = generatePdf;
                        document.head.appendChild(script);
                    }
                });
            } else {
                const { uri: pdfUri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(pdfUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Download NIN Slip (PDF)',
                        UTI: 'com.adobe.pdf'
                    });
                } else {
                    showAlert("Sharing Unavailable", "Sharing is not available on this device.", "warning");
                }
            }
        } catch (e: any) {
            showAlert("PDF Download Failed", e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const renderSlip = () => {
        if (!result || !result.data) return null;
        switch(selectedLayout) {
            case 'premium': return <IDCardMockup data={result.data} />;
            case 'standard': return <StandardSlip data={result.data} />;
            case 'regular': return <RegularSlip data={result.data} />;
            case 'info': return <InformationSlip data={result.data} />;
            default: return <IDCardMockup data={result.data} />;
        }
    };

    const faqs = [
        { q: 'Yaya tsarin binciken yake aiki?', a: 'Zaɓi siffar katin da kake so (Layout), sanya lambar wayar da ke da alaƙa da NIN, sannan danna Lookup Phone. Tsarin zai zaƙulo bayanan mutumin nan take.' },
        { q: 'Akwai kuɗi a wannan binciken?', a: 'Ee, ana cire kuɗi gwargwadon siffar katin da ka zaɓa. Ana cire kuɗin ne kawai idan an samu nasarar zaƙulo bayanan katin.' },
        { q: 'Zan iya sake sauke katin da na riga na biya?', a: 'Haka ne! Dukan katunan da ka fitar a baya suna nan a ajiye a rukunin "Recent Lookups". Zaka iya sake duba su ko sauke su (PDF ko PNG) kyauta.' }
    ];

    // Filter history based on search
    const filteredHistory = historyList.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (item.name || '').toLowerCase().includes(q) ||
            (item.nin || '').includes(q) ||
            (item.layout || '').toLowerCase().includes(q)
        );
    });

    if (result) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <Stack.Screen options={{ 
                    title: 'Verification Details', 
                    headerStyle: { backgroundColor: '#060d21' }, 
                    headerTintColor: '#fff', 
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                            <Ionicons name="time-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    )
                }} />
                
                {/* Header Banner */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: insets.top > 0 ? insets.top + 12 : 24, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={16} color="#f5a623" />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Verification Details</Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>NIN Slip Generated</Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: -32 }} contentContainerStyle={{ paddingBottom: 80 }}>
                    
                    {/* Generated NIN Slip Preview at the top */}
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 12, alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#f1f5f9', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
                            <Text style={{ fontWeight: '800', color: '#64748b', textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>NIN Slip Preview</Text>
                        </View>
                        
                        <View nativeID="slip-preview-container" style={{ width: '100%' }}>
                            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%' }}>
                                {renderSlip()}
                            </ViewShot>
                        </View>
                    </View>

                    {/* Direct Download Buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                        <TouchableOpacity 
                            onPress={handleDownloadPdf}
                            disabled={isSaving}
                            style={{ flex: 1, backgroundColor: '#0284c7', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 6, elevation: 1 }}
                        >
                            <Ionicons name="document-text-outline" size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Download PDF</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleDownloadPng}
                            disabled={isSaving}
                            style={{ flex: 1, backgroundColor: '#f5a623', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 6, elevation: 1 }}
                        >
                            <Ionicons name="image-outline" size={18} color="#060d21" />
                            <Text style={{ color: '#060d21', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Download PNG</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Compact Details Table */}
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ color: '#94a3b8', fontWeight: '800', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Name</Text>
                            <Text style={{ color: '#1e293b', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>
                                {result.data.firstname} {result.data.middlename ? result.data.middlename + ' ' : ''}{result.data.surname}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ color: '#94a3b8', fontWeight: '800', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>NIN Number</Text>
                            <Text style={{ color: '#1e293b', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>
                                {result.data.nin || result.data.number || 'N/A'}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ color: '#94a3b8', fontWeight: '800', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Slip Type</Text>
                            <Text style={{ color: '#0284c7', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>
                                {selectedLayout}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
                            <Text style={{ color: '#94a3b8', fontWeight: '800', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date & Time</Text>
                            <Text style={{ color: '#1e293b', fontWeight: '700', fontSize: 11 }}>
                                {(() => {
                                    const d = new Date();
                                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                })()}
                            </Text>
                        </View>
                    </View>

                    {/* Back to Lookup Button */}
                    <TouchableOpacity 
                        onPress={() => setResult(null)} 
                        style={{ height: 48, borderRadius: 12, backgroundColor: '#060d21', alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>VERIFY ANOTHER IDENTITY</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                title: 'Verify by Phone', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#fff', 
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                        <Ionicons name="time-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )
            }} />
            <StatusBar style="light" />

            {/* Premium Loader Modal */}
            {loading && (
                <Modal transparent visible={loading} animationType="fade">
                    <View style={styles.loaderOverlay}>
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text style={styles.loaderTitle}>Verifying Identity</Text>
                            <Text style={styles.loaderSub}>Connecting to NIMC Secure Gateway...</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Custom Modern Decorated Alert Modal */}
            <Modal
                transparent
                visible={customAlert.visible}
                animationType="fade"
                onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
            >
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[
                            styles.alertIconBg,
                            customAlert.type === 'success' ? styles.alertSuccessIcon :
                            customAlert.type === 'error' ? styles.alertErrorIcon :
                            customAlert.type === 'warning' ? styles.alertWarningIcon : styles.alertInfoIcon
                        ]}>
                            <Ionicons 
                                name={
                                    customAlert.type === 'success' ? 'checkmark-circle' :
                                    customAlert.type === 'error' ? 'close-circle' :
                                    customAlert.type === 'warning' ? 'warning' : 'information-circle'
                                } 
                                size={36} 
                                color={
                                    customAlert.type === 'success' ? '#10b981' :
                                    customAlert.type === 'error' ? '#ef4444' :
                                    customAlert.type === 'warning' ? '#f5a623' : '#3b82f6'
                                } 
                            />
                        </View>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMessage}>{customAlert.message}</Text>
                        <TouchableOpacity 
                            style={styles.alertButton} 
                            onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.alertButtonText}>Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <LinearGradient colors={['#060d21', '#0B163A']} style={[styles.headerGradient, { paddingTop: insets.top > 0 ? insets.top + 10 : 24 }]}>
                <Text style={styles.headerTitle}>Verify by Phone</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 12 }} contentContainerStyle={styles.scrollContent}>
                
                {/* Wallet Balance widget */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <Ionicons name="wallet-outline" size={20} color="#060d21" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.walletLabel}>Tantancewa Balance</Text>
                            <Text style={styles.walletVal}>
                                {userBalance !== null ? `₦${userBalance.toLocaleString()}` : 'Loading...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.fundBtn}
                        onPress={() => router.push('/(app)/wallet')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={14} color="#ffffff" />
                        <Text style={styles.fundBtnText}>Fund</Text>
                    </TouchableOpacity>
                </View>

                {/* 1. CHOOSE SLIP LAYOUT */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>Choose Slip Layout</Text>
                    </View>
                    
                    <View style={styles.layoutGrid}>
                        {layouts.map((layout) => {
                            const isSelected = selectedLayout === layout.id;
                            return (
                                <TouchableOpacity 
                                    key={layout.id}
                                    onPress={() => setSelectedLayout(layout.id)}
                                    style={[
                                        styles.layoutButton,
                                        isSelected ? styles.layoutButtonSelected : styles.layoutButtonUnselected
                                    ]}
                                    activeOpacity={0.85}
                                >
                                    <View style={[
                                        styles.badgeContainer,
                                        isSelected ? styles.badgeSelected : styles.badgeUnselected
                                    ]}>
                                        <Text style={[
                                            styles.badgeText,
                                            isSelected ? styles.badgeTextSelected : styles.badgeTextUnselected
                                        ]}>
                                            {layout.badge}
                                        </Text>
                                    </View>
                                    <View style={styles.layoutIconBox}>
                                        {(layout as any).image && (
                                            <Image 
                                                source={(layout as any).image} 
                                                style={styles.layoutImage}
                                                resizeMode="contain" 
                                            />
                                        )}
                                    </View>
                                    <Text 
                                        style={[
                                            styles.layoutLabel,
                                            isSelected ? styles.layoutLabelSelected : styles.layoutLabelUnselected
                                        ]} 
                                        numberOfLines={2}
                                    >
                                        {layout.name}
                                    </Text>
                                    <Text 
                                        style={[
                                            styles.layoutPrice,
                                            isSelected ? styles.layoutPriceSelected : styles.layoutPriceUnselected
                                        ]}
                                    >
                                        ₦{layout.price}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 2. SUPPLY PHONE */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>Phone Details</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                        <Text style={styles.label}>Enter the phone number linked to the NIN.</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="call" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="e.g. 08012345678"
                                placeholderTextColor="#94a3b8"
                                style={styles.inputStyle}
                                keyboardType="phone-pad" 
                                maxLength={15} 
                                value={phone} 
                                onChangeText={setPhone} 
                                editable={!loading}
                            />
                            {phone.length > 0 && (
                                <Text style={[
                                    styles.lenIndicator,
                                    phone.length >= 10 ? styles.lenIndicatorSuccess : styles.lenIndicatorWarning
                                ]}>
                                    {phone.length} len
                                </Text>
                            )}
                            <TouchableOpacity 
                                style={styles.pasteBtn} 
                                onPress={handlePaste}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="clipboard-outline" size={14} color="#060d21" />
                                <Text style={styles.pasteBtnText}>Paste</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Consent Checkbox */}
                                        {/* Consent Checkbox */}
                    <TouchableOpacity 
                        onPress={() => setIsAgreed(!isAgreed)} 
                        activeOpacity={0.8}
                        style={styles.consentContainer}
                    >
                        <View style={[
                            styles.checkboxBox, 
                            isAgreed ? styles.checkboxBoxSelected : styles.checkboxBoxUnselected
                        ]}>
                            {isAgreed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                        <Text style={styles.consentText}>
                            I confirm that I have obtained consent to verify this phone number.
                        </Text>
                    </TouchableOpacity>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || phone.length < 10 || !isAgreed} 
                        style={[
                            styles.verifyButton,
                            (loading || phone.length < 10 || !isAgreed) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <Text style={styles.verifyButtonText}>LOOKUP PHONE</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* FAQ / Guidelines Section */}
                <View style={styles.card}>
                    <View style={styles.historyHeader}>
                        <Ionicons name="help-circle" size={16} color="#f5a623" />
                        <Text style={styles.historyTitle}>FAQ & Guidelines</Text>
                    </View>
                    {faqs.map((faq, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                            <View key={idx} style={styles.faqItem}>
                                <TouchableOpacity 
                                    style={styles.faqHeader} 
                                    onPress={() => setExpandedFaq(isExpanded ? null : idx)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                                    <Ionicons 
                                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                                        size={14} 
                                        color="#64748b" 
                                    />
                                </TouchableOpacity>
                                {isExpanded && (
                                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* ID Analytics / Lookup Stats Widget */}
                {historyList.length > 0 && (
                    <View style={styles.statsCard}>
                        <View style={styles.statsHeader}>
                            <Ionicons name="analytics" size={16} color="#f5a623" />
                            <Text style={styles.statsTitle}>Verification Stats</Text>
                        </View>
                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>{historyList.length}</Text>
                                <Text style={styles.statLabel}>Total Lookups</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => item.layout === 'premium').length}
                                </Text>
                                <Text style={styles.statLabel}>Premium</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => item.layout === 'standard').length}
                                </Text>
                                <Text style={styles.statLabel}>Standard</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => ['regular', 'info'].includes(item.layout)).length}
                                </Text>
                                <Text style={styles.statLabel}>Other Slips</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Search Bar for past reprints */}
                {historyList.length > 0 && (
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="Search past lookups (Name or Phone)..."
                            placeholderTextColor="#94a3b8"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* RECENT LOOKUPS */}
                {filteredHistory.length > 0 && (
                    <View style={styles.card}>
                        <View style={styles.historyHeader}>
                            <Ionicons name="time" size={16} color="#f5a623" />
                            <Text style={styles.historyTitle}>Recent Prints (Reprint)</Text>
                        </View>

                        <View style={{ flexDirection: 'column' }}>
                            {filteredHistory.map((item) => (
                                <View key={item.id} style={styles.historyItem}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setSelectedLayout(item.layout || 'premium');
                                            setPhone('');
                                            setResult({ status: 'success', data: item.data });
                                        }}
                                        style={styles.historyItemLeft}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.historyIconContainer}>
                                            <Ionicons name="call" size={16} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.name}</Text>
                                            <Text style={styles.historyMeta}>NIN: {item.nin} • {(item.layout || 'premium').toUpperCase()}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.historyRight}>
                                        <Text style={styles.historyDate}>{item.date.split(',')[0]}</Text>
                                        <TouchableOpacity 
                                            onPress={() => deleteHistoryItem(item.id)}
                                            style={styles.deleteButton}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        padding: 12,
        paddingBottom: 50,
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    errorText: {
        color: '#991b1b',
        fontWeight: '700',
        marginTop: 8,
    },
    loaderOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    loaderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    loaderTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginTop: 16,
        letterSpacing: -0.2,
    },
    loaderSub: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 6,
        fontWeight: '500',
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    alertCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    alertIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertSuccessIcon: {
        backgroundColor: '#ecfdf5',
    },
    alertErrorIcon: {
        backgroundColor: '#fef2f2',
    },
    alertWarningIcon: {
        backgroundColor: '#fff7ed',
    },
    alertInfoIcon: {
        backgroundColor: '#eff6ff',
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    alertMessage: {
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
        fontWeight: '500',
        paddingHorizontal: 8,
    },
    alertButton: {
        backgroundColor: '#0d1b3e',
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    alertButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    headerGradient: {
        paddingTop: 16,
        paddingBottom: 40,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    scrollContent: {
        paddingBottom: 80,
    },
    walletBar: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletLabel: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    walletVal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#060d21',
        marginTop: 1,
    },
    fundBtn: {
        backgroundColor: '#060d21',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fundBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 11,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepBadge: {
        backgroundColor: '#f5a623',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    stepBadgeText: {
        color: '#060d21',
        fontWeight: '900',
        fontSize: 10,
    },
    cardTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    label: {
        color: '#64748b',
        fontSize: 11,
        marginBottom: 8,
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 8,
    },
    inputStyle: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 14,
    },
    lenIndicator: {
        fontSize: 10,
        fontWeight: '800',
        marginRight: 8,
    },
    lenIndicatorSuccess: {
        color: '#10b981',
    },
    lenIndicatorWarning: {
        color: '#f5a623',
    },
    pasteBtn: {
        backgroundColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pasteBtnText: {
        color: '#060d21',
        fontWeight: '800',
        fontSize: 10,
        marginLeft: 3,
    },
    verifyButton: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
        marginTop: 12,
    },
    verifyButtonActive: {
        backgroundColor: '#060d21',
    },
    verifyButtonDisabled: {
        backgroundColor: 'rgba(6, 13, 33, 0.5)',
    },
    verifyButtonText: {
        fontWeight: '800',
        color: '#ffffff',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    faqItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 10,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    faqQuestion: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 11.5,
        flex: 1,
        marginRight: 10,
    },
    faqAnswer: {
        color: '#64748b',
        fontSize: 11,
        marginTop: 6,
        lineHeight: 16,
        fontWeight: '500',
    },
    statsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statsTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginLeft: 6,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    statLabel: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '700',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#f1f5f9',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 0.5,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '600',
        fontSize: 13,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        marginLeft: 6,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    historyItemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    historyIconContainer: {
        backgroundColor: '#f8fafc',
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    historyName: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 12,
    },
    historyMeta: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 10,
        marginTop: 1,
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historyDate: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 9,
        marginRight: 10,
    },
    deleteButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
    layoutGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
    },
    layoutButton: {
        borderRadius: 16,
        padding: 10,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '48.5%',
        minHeight: 110,
        backgroundColor: '#ffffff',
    },
    layoutButtonSelected: {
        backgroundColor: '#060d21',
        borderColor: '#060d21',
    },
    layoutButtonUnselected: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    layoutIconBox: {
        width: '100%',
        height: 48,
        marginBottom: 8,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 0.5,
    },
    layoutImage: {
        width: '90%',
        height: '90%',
    },
    layoutLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        marginBottom: 4,
        textAlign: 'center',
        lineHeight: 13,
    },
    layoutLabelSelected: {
        color: '#ffffff',
    },
    layoutLabelUnselected: {
        color: '#334155',
    },
    layoutPrice: {
        fontSize: 9,
        fontWeight: '900',
        textAlign: 'center',
    },
    layoutPriceSelected: {
        color: '#f5a623',
    },
    layoutPriceUnselected: {
        color: '#64748b',
    },
    consentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    consentText: {
        color: '#475569',
        fontSize: 11,
        flex: 1,
        fontWeight: '600',
        lineHeight: 15,
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    checkboxBoxSelected: {
        backgroundColor: '#060d21',
        borderColor: '#060d21',
    },
    checkboxBoxUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    badgeContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        zIndex: 5,
    },
    badgeSelected: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    badgeUnselected: {
        backgroundColor: '#f1f5f9',
    },
    badgeText: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    badgeTextSelected: {
        color: '#ffffff',
    },
    badgeTextUnselected: {
        color: '#64748b',
    },
});
