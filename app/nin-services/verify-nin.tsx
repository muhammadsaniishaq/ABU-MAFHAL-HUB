import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clipboard } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import BouncyCheckbox from "react-native-bouncy-checkbox";
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Slip Components
import { IDCardMockup } from '../../components/IDCardMockup';
import { StandardSlip } from '../../components/StandardSlip';
import { RegularSlip } from '../../components/RegularSlip';
import { InformationSlip } from '../../components/InformationSlip';

// Simulated API Call
const API_URL = "https://idpro.ng/api/v1/nin";
const API_TOKEN = "lv_PhNuAXoBZhcsmsj5nLgh3r0WC6Raph6x"; 

const DEFAULT_LAYOUTS = [
    { id: 'premium', db_id: 'nin_premium', name: 'Premium Card', price: 200, type: 'prem', image: require('../../assets/images/premium.png'), badge: 'Digital ID' },
    { id: 'standard', db_id: 'nin_standard', name: 'Standard Card', price: 200, type: 'nonprem', image: require('../../assets/images/standard.png'), badge: 'Color Card' },
    { id: 'regular', db_id: 'nin_regular', name: 'Regular Slip', price: 180, type: 'nonprem', image: require('../../assets/images/regular.png'), badge: 'B&W Slip' },
    { id: 'info', db_id: 'nin_info', name: 'Information', price: 200, type: 'nonprem', image: require('../../assets/images/info.png'), badge: 'Full Sheet' },
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
    return raw.toUpperCase();
};

export default function VerifyNINScreen() {
    const insets = useSafeAreaInsets();
    const { reprintId } = useLocalSearchParams();
    const [selectedLayout, setSelectedLayout] = useState('premium');
    const [nin, setNin] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const viewShotRef = useRef<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Additional Premium States
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    const faqs = [
        { q: 'Yaya wannan tsarin yake aiki?', a: 'Zaɓi katin da kake buƙata (Premium, Standard, Regular ko Info), rubuta lambar NIN ɗinka guda 11, sannan ka danna Verify. Katinka zai fito nan take cikin tsari na zamani don saukewa ko bugawa.' },
        { q: 'Nawa ne kuɗin tantancewa?', a: 'Kuɗin kowane tsari yana nan a rubuce a ƙasan kowane kati. Za a cire kuɗin ne kawai idan an samu nasarar tantance lambar.' },
        { q: 'Zan iya sake sauke katin da na riga na biya?', a: 'Haka ne! Dukan katunan da ka fitar a baya suna nan a ajiye a cikin rukunin "Recent Prints" (Tarihi). Zaka iya sake duba su ko sauke su (PDF ko PNG) kyauta ba tare da an sake cire ko sisi ba.' }
    ];

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
            const clean = text.replace(/\D/g, '').slice(0, 11);
            setNin(clean);
            showAlert('Pasted Successfully', 'NIN copied from your clipboard has been pasted.', 'success');
        } catch (e) {
            console.warn('Failed to paste from clipboard', e);
        }
    };
    
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
                nin: verifiedData.nin || nin || 'N/A',
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

    const handleDownloadPng = async () => {
        if (!viewShotRef.current) return;
        setIsSaving(true);
        try {
            const uri = await viewShotRef.current.capture();
            if (Platform.OS === 'web') {
                const link = document.createElement('a');
                link.href = uri;
                link.download = `nin_slip_${nin || 'verify'}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
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
            let html = '';

            const rawPhoto = result.data.photo || result.data.image || result.data.picture || '';
            const photoUrl = rawPhoto.startsWith('data:') || rawPhoto.startsWith('http')
                ? rawPhoto
                : rawPhoto ? `data:image/jpeg;base64,${rawPhoto}` : 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL363G0d9u3u5YQ&s';
            
            const rawDob = result.data.birthdate || result.data.dob || result.data.dateOfBirth || '';
            const dob = formatDob(rawDob);
            const rawGender = result.data.gender || result.data.sex || 'F';
            const gender = rawGender.trim().toUpperCase().startsWith('M') ? 'MALE' : 'FEMALE';
            const rawNin = result.data.nin || result.data.number || '';
            const cleanNin = rawNin.replace(/\D/g, '');
            const fmtNin = cleanNin.length === 11
                ? `${cleanNin.slice(0,4)}  ${cleanNin.slice(4,7)}  ${cleanNin.slice(7)}`
                : cleanNin;
            const displayNin = cleanNin.length === 11
                ? `${cleanNin.slice(0,4)} ${cleanNin.slice(4,7)} ${cleanNin.slice(7)}`
                : cleanNin;
            const watermarkText = cleanNin.length === 11 ? `${cleanNin.slice(0, 4)} ${cleanNin.slice(4)}` : cleanNin;
            const photoWatermark = cleanNin.length === 11 ? cleanNin.slice(4) : '';
            const surname = result.data.surname || result.data.last_name || 'RESIDENT';
            const first = result.data.firstname || result.data.first_name || '';
            const middle = result.data.middlename || result.data.middle_name || '';
            const givenNames = [first, middle].filter(Boolean).join(' ');
            const rawIssue = result.data.issueDate || result.data.issue_date || '';
            const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';
            const trackingId = result.data.tracking_id || result.data.trackingId || '';
            const phone = result.data.telephoneno || result.data.phoneNumber || result.data.phone || '';
            const residenceState = result.data.residence_state || result.data.residenceState || result.data.state || 'YOBE';
            const residenceLga = result.data.residence_lga || result.data.residenceLga || result.data.lga || '';
            const birthState = result.data.birthstate || result.data.birthState || 'YOBE';
            const birthLga = result.data.birthlga || result.data.birthLga || '';
            const address = result.data.residence_address || result.data.address || '';

            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NIN-${cleanNin}-${surname.replace(/\s+/g, '-')}-${first.replace(/\s+/g, '-')}&color=000000`;

            if (selectedLayout === 'premium') {
                html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Digital NIN Slip Print Page</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            background-color: #ffffff;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        .print-instructions {
                            text-align: center;
                            margin-bottom: 40px;
                            font-size: 16px;
                            color: #111;
                            line-height: 1.5;
                        }

                        .card-container {
                            width: 535px;
                            border: 1px solid #d1d5db;
                            border-radius: 2px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            overflow: hidden;
                            background-color: white;
                        }

                        .card-front {
                            width: 535px;
                            height: 330px;
                            padding: 14px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            overflow: hidden;
                            position: relative;
                            border-bottom: 1px dashed #9ca3af;
                            
                            background-color: #ffffff;
                            background-image: 
                                radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.9) 0%, rgba(246, 253, 249, 0.7) 50%, #d5f2de 100%),
                                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='535' height='330' viewBox='0 0 535 330'%3E%3Cdefs%3E%3Cg id='rosette-left'%3E%3Ccircle cx='40' cy='290' r='30' fill='none' stroke='rgba(0, 135, 81, 0.07)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='50' fill='none' stroke='rgba(0, 135, 81, 0.06)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='70' fill='none' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='90' fill='none' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='110' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='130' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3C/g%3E%3Cg id='rosette-right'%3E%3Ccircle cx='480' cy='60' r='40' fill='none' stroke='rgba(0, 135, 81, 0.06)' stroke-width='0.75'/%3E%3Ccircle cx='480' cy='60' r='65' fill='none' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Ccircle cx='480' cy='60' r='90' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3Ccircle cx='480' cy='60' r='115' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3C/g%3E%3C/defs%3E%3Cpath d='M267,165 L0,0 M267,165 L60,0 M267,165 L120,0 M267,165 L180,0 M267,165 L240,0 M267,165 L300,0 M267,165 L360,0 M267,165 L420,0 M267,165 L480,0 M267,165 L535,0 M267,165 L535,55 M267,165 L535,110 M267,165 L535,165 M267,165 L535,220 M267,165 L535,275 M267,165 L535,330 M267,165 L480,330 M267,165 L420,330 M267,165 L360,330 M267,165 L300,330 M267,165 L240,330 M267,165 L180,330 M267,165 L120,330 M267,165 L60,330 M267,165 L0,330 M267,165 L0,275 M267,165 L0,220 M267,165 L0,165 M267,165 L0,110 M267,165 L0,55' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Cuse href='%23rosette-left'/%3E%3Cuse href='%23rosette-right'/%3E%3C/svg%3E");
                        }

                        .card-back {
                            width: 535px;
                            height: 330px;
                            background-color: white;
                            padding: 24px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            text-align: center;
                            transform: rotate(180deg);
                            position: relative;
                        }

                        .card-back-border {
                            position: absolute;
                            top: 16px;
                            bottom: 16px;
                            left: 16px;
                            right: 16px;
                            border: 1px solid #d1d5db;
                            border-radius: 1px;
                            pointer-events: none;
                        }

                        .coat-watermark {
                            position: absolute;
                            top: 22px;
                            bottom: 22px;
                            left: 0;
                            right: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            opacity: 0.14;
                            pointer-events: none;
                            z-index: 0;
                        }

                        .coat-watermark img {
                            width: 200px;
                            height: 200px;
                            object-fit: contain;
                            mix-blend-mode: multiply;
                        }

                        .slant-watermark-container {
                            position: absolute;
                            inset: 0;
                            pointer-events: none;
                            z-index: 0;
                            overflow: hidden;
                            opacity: 0.18;
                        }

                        .slant-watermark {
                            position: absolute;
                            font-size: 10.5px;
                            font-weight: bold;
                            color: #166534;
                            transform: rotate(-28deg);
                            white-space: nowrap;
                            letter-spacing: 0.05em;
                        }

                        .header-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            z-index: 10;
                            position: relative;
                        }

                        .header-title {
                            color: #008751;
                            font-weight: 900;
                            font-size: 18px;
                            letter-spacing: 0.01em;
                            margin: 0;
                            line-height: 1.1;
                        }

                        .header-subtitle {
                            color: #000000;
                            font-weight: 800;
                            font-size: 13px;
                            letter-spacing: -0.02em;
                            margin: 2px 0 0 0;
                            line-height: 1.1;
                        }

                        .details-grid {
                            display: flex;
                            align-items: center;
                            margin: auto 0;
                            z-index: 10;
                            position: relative;
                        }

                        .photo-col {
                            width: 86px;
                            margin-right: 12px;
                        }

                        .photo-box {
                            width: 86px;
                            height: 112px;
                            border: 1px solid #166534;
                            background-color: #f3f4f6;
                            overflow: hidden;
                            position: relative;
                            border-radius: 1px;
                        }

                        .photo-box img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }

                        .photo-watermark {
                            position: absolute;
                            bottom: 2px;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 6px;
                            font-weight: bold;
                            color: #166534;
                            opacity: 0.4;
                            transform: rotate(-15deg);
                            pointer-events: none;
                        }

                        .info-col {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }

                        .info-label {
                            font-size: 6.5px;
                            font-weight: 700;
                            color: #4b5563;
                            display: block;
                            line-height: 1;
                            margin-bottom: 2px;
                            text-transform: uppercase;
                        }

                        .info-value {
                            font-size: 11px;
                            font-weight: 800;
                            color: #000000;
                            display: block;
                            line-height: 1;
                        }

                        .dob-sex-row {
                            display: flex;
                            gap: 16px;
                        }

                        .right-col {
                            width: 78px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            margin-left: 8px;
                        }

                        .qr-box {
                            width: 78px;
                            height: 78px;
                            padding: 3px;
                            background-color: white;
                            border: 1px solid #000000;
                            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                        }

                        .qr-box img {
                            width: 72px;
                            height: 72px;
                            display: block;
                        }

                        .nga-container {
                            width: 78px;
                            text-align: center;
                            margin-top: 4px;
                        }

                        .nga-text {
                            font-size: 18px;
                            font-weight: 900;
                            color: #000000;
                            display: block;
                            line-height: 1;
                        }

                        .issue-lbl {
                            font-size: 7.5px;
                            font-weight: 800;
                            color: #6b7280;
                            display: block;
                            line-height: 1;
                            margin-top: 3px;
                            text-transform: uppercase;
                        }

                        .issue-val {
                            font-size: 9.5px;
                            font-weight: 800;
                            color: #000000;
                            font-family: monospace;
                            display: block;
                            line-height: 1;
                            margin-top: 2px;
                        }

                        .bottom-row {
                            text-align: center;
                            z-index: 10;
                            position: relative;
                            margin-top: auto;
                            padding-bottom: 2px;
                        }

                        .nin-title {
                            font-size: 10px;
                            font-weight: 700;
                            color: #000000;
                            line-height: 1;
                            margin: 0 0 4px 0;
                        }

                        .nin-value {
                            font-size: 27px;
                            font-weight: 900;
                            font-family: monospace;
                            color: #000000;
                            line-height: 1;
                            word-spacing: 0.38em;
                            letter-spacing: 0.03em;
                        }

                        .bottom-line {
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            height: 3px;
                            background: linear-gradient(to right, #166534, #059669, #166534);
                            opacity: 0.4;
                        }

                        /* Disclaimer styles */
                        .disclaimer-container {
                            max-width: 430px;
                            padding: 0 8px;
                            z-index: 10;
                        }

                        .disclaimer-title {
                            font-size: 16px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #000000;
                            margin: 0;
                            line-height: 1;
                        }

                        .disclaimer-sub {
                            font-size: 10px;
                            font-style: italic;
                            font-family: Georgia, serif;
                            color: #4b5563;
                            margin: 4px 0 0 0;
                        }

                        .disclaimer-p {
                            font-size: 10px;
                            line-height: 1.5;
                            color: #000000;
                            font-weight: 600;
                            margin: 12px 0;
                        }

                        .caution-title {
                            font-size: 12.5px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #000000;
                            margin: 12px 0 0 0;
                            line-height: 1;
                        }

                        .caution-p {
                            font-size: 9px;
                            line-height: 1.4;
                            color: #1f2937;
                            font-weight: 500;
                            margin: 8px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-instructions">
                        <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                        <p style="margin: 4px 0 0 0; font-size: 14px; color: #555;">You may cut it out of the paper, fold and laminate as desired.</p>
                    </div>

                    <div class="card-container">
                        <!-- FRONT SIDE -->
                        <div class="card-front">
                            <div class="coat-watermark">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTIKo551M65-TWEyZQ7BolTDwvb-VN6b5XQ4WEsmhRyEQ&s=10" alt="Nigeria Coat of Arms">
                            </div>

                            <div class="slant-watermark-container">
                                <div class="slant-watermark" style="bottom: 15%; left: -25px;">${watermarkText}</div>
                                <div class="slant-watermark" style="top: 30%; right: -15px;">${watermarkText}</div>
                            </div>

                            <div class="header-row">
                                <div>
                                    <h1 class="header-title">FEDERAL REPUBLIC OF NIGERIA</h1>
                                    <h2 class="header-subtitle">DIGITAL NIN SLIP</h2>
                                </div>
                            </div>

                            <div class="details-grid">
                                <div class="photo-col">
                                    <div class="photo-box">
                                        <img src="${photoUrl}" alt="Holder Portrait">
                                        <div class="photo-watermark">${photoWatermark}</div>
                                    </div>
                                </div>

                                <div class="info-col">
                                    <div>
                                        <span class="info-label">SURNAME/NOM</span>
                                        <span class="info-value">${surname.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <span class="info-label">GIVEN NAMES/PRÉNOMS</span>
                                        <span class="info-value">${givenNames.toUpperCase()}</span>
                                    </div>
                                    <div class="dob-sex-row">
                                        <div>
                                            <span class="info-label">DATE OF BIRTH</span>
                                            <span class="info-value" style="font-size:12.5px;">${dob}</span>
                                        </div>
                                        <div>
                                            <span class="info-label">SEX/SEXE</span>
                                            <span class="info-value" style="font-size:12.5px;">${gender}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="right-col">
                                    <div class="qr-box">
                                        <img src="${qrCodeUrl}" alt="Security Barcode Matrix">
                                    </div>
                                    <div class="nga-container">
                                        <span class="nga-text">NGA</span>
                                        <span class="issue-lbl">ISSUE DATE</span>
                                        <span class="issue-val">${issueDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="bottom-row">
                                <h3 class="nin-title">National Identification Number (NIN)</h3>
                                <div class="nin-value">${displayNin}</div>
                            </div>

                            <div class="bottom-line"></div>
                        </div>

                        <!-- BACK SIDE -->
                        <div class="card-back">
                            <div class="card-back-border"></div>
                            
                            <div class="disclaimer-container">
                                <h2 class="disclaimer-title">DISCLAIMER</h2>
                                <p class="disclaimer-sub">Trust, but verify</p>
                                
                                <p class="disclaimer-p">
                                    Kindly ensure each time this ID is presented, that you verify the credentials using a Government-APPROVED verification resource.<br>
                                    The details on the front of this NIN Slip must EXACTLY match the verification result.
                                </p>

                                <h3 class="caution-title">CAUTION!</h3>

                                <p class="caution-p">
                                    If this NIN was not issued to the person on the front of this document, please DO NOT attempt to scan, photocopy or replicate the personal data contained herein.<br>
                                    You are only permitted to scan the barcode for the purpose of identity verification.<br>
                                    The <span style="font-weight: bold;">FEDERAL GOVERNMENT OF NIGERIA</span> assumes no responsibility if you accept any variance in the scan result or do not scan the 2D barcode overleaf.
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                `;
            } else if (selectedLayout === 'standard') {
                html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>NIN Card New Edition - Square Photo & QR Fixed</title>
                  <style>
                    body {
                      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                      background-color: #ffffff;
                      margin: 0;
                      padding: 0;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      box-sizing: border-box;
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }

                    .print-instructions {
                        text-align: center;
                        margin-bottom: 40px;
                        font-size: 16px;
                        color: #111;
                        line-height: 1.5;
                    }

                    .card-container {
                      width: 535px;
                      height: 330px;
                      border: 1px solid #d1d5db;
                      border-radius: 8px;
                      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                      padding: 16px;
                      display: flex;
                      flex-direction: column;
                      justify-content: space-between;
                      overflow: hidden;
                      position: relative;
                      background-color: white;
                      box-sizing: border-box;
                    }

                    .faint-wm {
                      position: absolute;
                      inset: 0;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      opacity: 0.04;
                      pointer-events: none;
                      z-index: 0;
                    }

                    .faint-wm img {
                      width: 340px;
                      height: 340px;
                      object-fit: contain;
                    }

                    .secure-wm-container {
                      position: absolute;
                      inset: 0;
                      pointer-events: none;
                      z-index: 0;
                      overflow: hidden;
                      opacity: 0.25;
                    }

                    .secure-watermark-left {
                      position: absolute;
                      font-size: 15px;
                      font-weight: bold;
                      color: #9ca3af;
                      transform: rotate(-40deg);
                      white-space: nowrap;
                      letter-spacing: 0.1em;
                    }

                    .secure-watermark-right {
                      position: absolute;
                      font-size: 15px;
                      font-weight: bold;
                      color: #9ca3af;
                      transform: rotate(-35deg);
                      white-space: nowrap;
                      letter-spacing: 0.1em;
                    }

                    .top-coat {
                      position: absolute;
                      top: 10px;
                      left: 0;
                      right: 0;
                      display: flex;
                      justify-content: center;
                      z-index: 10;
                    }

                    .top-coat img {
                      width: 62px;
                      height: 62px;
                      object-fit: contain;
                    }

                    .grid-12 {
                      display: grid;
                      grid-template-columns: repeat(12, 1fr);
                      gap: 4px;
                      align-items: end;
                      z-index: 10;
                      position: relative;
                      margin-top: auto;
                      margin-bottom: auto;
                    }

                    .col-4 {
                      grid-column: span 4;
                      display: flex;
                      align-items: center;
                      justify-content: start;
                      padding-bottom: 8px;
                    }

                    .photo-box {
                      width: 108px;
                      height: 132px;
                      background-color: #929497;
                      border: 1px solid #9ca3af;
                      border-radius: 2px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      position: relative;
                      overflow: hidden;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }

                    .photo-box img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                    }

                    .col-5 {
                      grid-column: span 5;
                      padding-left: 4px;
                      display: flex;
                      flex-direction: column;
                      gap: 12px;
                      padding-bottom: 4px;
                    }

                    .info-lbl {
                      font-size: 11px;
                      font-weight: 800;
                      color: #6b7280;
                      text-transform: uppercase;
                      margin: 0;
                      line-height: 1;
                    }

                    .info-val {
                      font-size: 15px;
                      font-weight: 700;
                      color: black;
                      margin: 3px 0 0 0;
                      line-height: 1.2;
                    }

                    .col-3 {
                      grid-column: span 3;
                      display: flex;
                      flex-direction: column;
                      align-items: end;
                      justify-content: center;
                      text-align: center;
                    }

                    .nga-box {
                      width: 88px;
                      text-align: center;
                      margin-bottom: 4px;
                    }

                    .nga-txt {
                      font-size: 25px;
                      font-weight: 800;
                      color: black;
                      display: block;
                      line-height: 1;
                    }

                    .nga-sub {
                      font-size: 12px;
                      font-weight: 700;
                      color: #cbd5e1;
                      display: block;
                      line-height: 1;
                      margin-top: 4px;
                      letter-spacing: 0.05em;
                    }

                    .qr-box {
                      padding: 2px;
                      background-color: white;
                      border: 1px solid black;
                      margin-bottom: 8px;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    }

                    .qr-box img {
                      width: 78px;
                      height: 78px;
                      display: block;
                    }

                    .issue-box {
                      width: 88px;
                      text-align: center;
                    }

                    .issue-lbl {
                      font-size: 10.5px;
                      font-weight: 900;
                      color: black;
                      display: block;
                      line-height: 1;
                    }

                    .issue-val {
                      font-size: 11.5px;
                      font-weight: 700;
                      color: black;
                      display: block;
                      line-height: 1;
                      margin-top: 4px;
                    }

                    .bottom-row {
                      text-align: center;
                      z-index: 10;
                      position: relative;
                      padding-bottom: 6px;
                    }

                    .bottom-row h3 {
                      font-size: 14px;
                      font-weight: 800;
                      color: black;
                      margin: 0 0 8px 0;
                      line-height: 1;
                    }

                    .nin-val {
                      font-size: 34px;
                      font-weight: 600;
                      font-family: monospace;
                      color: black;
                      line-height: 1;
                      word-spacing: 0.4em;
                      letter-spacing: 0.04em;
                    }
                  </style>
                </head>
                <body>
                  <div class="print-instructions">
                      <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                      <p style="margin: 4px 0 0 0; font-size: 14px; color: #555;">You may cut it out of the paper, fold and laminate as desired.</p>
                  </div>

                  <div class="card-container">
                    <div class="faint-wm">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png" alt="Faint Watermark">
                    </div>

                    <div class="secure-wm-container">
                      <div class="secure-watermark-left" style="bottom: 68px; left: -35px;">${cleanNin.length === 11 ? cleanNin.slice(4, 7) : '000'}</div>
                      <div class="secure-watermark-left" style="bottom: 28px; left: -25px;">${cleanNin}</div>
                      
                      <div class="secure-watermark-right" style="top: 44px; right: 25px;">${cleanNin}</div>
                      
                      <div class="secure-watermark-right" style="bottom: 25px; right: -20px;">${cleanNin}</div>
                    </div>

                    <div class="top-coat">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png" alt="Official Coat of Arms">
                    </div>

                    <div class="grid-12">
                      <div class="col-4">
                        <div class="photo-box">
                          <img src="${photoUrl}" alt="Holder Portrait">
                        </div>
                      </div>

                      <div class="col-5">
                        <div>
                          <span class="info-lbl">Surname/Nom</span>
                          <span class="info-val">${surname.toUpperCase()}</span>
                        </div>
                        
                        <div>
                          <span class="info-lbl">Given Names/Prénoms</span>
                          <span class="info-val">${givenNames.toUpperCase()}</span>
                        </div>
                        
                        <div>
                          <span class="info-lbl">Date of Birth</span>
                          <span class="info-val">${dob}</span>
                        </div>
                      </div>

                      <div class="col-3">
                        <div class="nga-box">
                          <span class="nga-txt">NGA</span>
                          <span class="nga-sub">${cleanNin}</span>
                        </div>

                        <div class="qr-box">
                          <img src="${qrCodeUrl}&margin=1" alt="QR Code">
                        </div>
                        
                        <div class="issue-box">
                          <span class="issue-lbl">ISSUE DATE</span>
                          <span class="issue-val">${issueDate}</span>
                        </div>
                      </div>
                    </div>

                    <div class="bottom-row">
                      <h3>National Identification Number (NIN)</h3>
                      <div class="nin-val">${fmtNin}</div>
                    </div>
                  </div>
                </body>
                </html>
                `;
            } else if (selectedLayout === 'regular') {
                const addrParts = address.split('\n');
                const addr1 = addrParts[0] || '';
                const addr2 = addrParts[1] || '';
                const addr3 = addrParts[2] || '';
                html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>National Identity Management System - NIN Slip</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            background-color: #ffffff;
                            margin: 0;
                            padding: 20px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .print-instructions {
                            text-align: center;
                            margin-bottom: 25px;
                            font-size: 15px;
                            color: #333;
                            font-weight: bold;
                        }
                        .nin-slip-container {
                            width: 100%;
                            max-width: 820px;
                            background-color: #f5f5ee;
                            border: 1px solid #9ca3af;
                            padding: 16px;
                            box-sizing: border-box;
                            position: relative;
                        }
                        .header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            border-bottom: 2px solid black;
                            padding-bottom: 12px;
                        }
                        .header-logo {
                            width: 75px;
                            height: 75px;
                            object-fit: contain;
                        }
                        .header-nimc {
                            width: 95px;
                            height: 75px;
                            object-fit: contain;
                        }
                        .header-center {
                            text-align: center;
                            flex: 1;
                            padding: 0 10px;
                        }
                        .header-center h1 {
                            font-size: 22px;
                            font-weight: bold;
                            color: #111827;
                            margin: 0;
                            letter-spacing: 0.02em;
                        }
                        .header-center p {
                            margin: 2px 0 0 0;
                            font-weight: 500;
                            color: #1f2937;
                        }
                        .grid-layout {
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                            border-bottom: 2px solid black;
                        }
                        .col-left {
                            grid-column: span 3;
                            border-right: 1px solid black;
                            display: flex;
                            flex-direction: column;
                        }
                        .col-mid {
                            grid-column: span 5;
                            border-right: 1px solid black;
                            display: flex;
                            flex-direction: column;
                        }
                        .col-right {
                            grid-column: span 4;
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                        }
                        .cell-row {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            border-bottom: 1px solid black;
                            height: 44px;
                            align-items: center;
                        }
                        .cell-row-last {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            height: 44px;
                            align-items: center;
                        }
                        .cell-lbl {
                            padding-left: 8px;
                            font-weight: bold;
                            color: #111827;
                            font-size: 13px;
                            border-right: 1px solid black;
                            height: 100%;
                            display: flex;
                            align-items: center;
                        }
                        .cell-val {
                            grid-column: span 2;
                            padding-left: 12px;
                            color: #1f2937;
                            font-size: 13px;
                            font-family: monospace;
                            letter-spacing: 0.05em;
                        }
                        .cell-val-bold {
                            grid-column: span 2;
                            padding-left: 12px;
                            color: #1f2937;
                            font-size: 13px;
                            font-weight: bold;
                        }
                        .cell-val-nin {
                            grid-column: span 2;
                            padding-left: 12px;
                            color: #111827;
                            font-size: 15px;
                            font-weight: bold;
                            letter-spacing: 0.1em;
                            font-family: monospace;
                        }
                        .address-block {
                            grid-column: span 7;
                            padding: 12px;
                            font-size: 12px;
                            line-height: 1.5;
                            color: #111827;
                        }
                        .address-title {
                            font-weight: bold;
                            font-size: 13px;
                            margin-bottom: 4px;
                        }
                        .photo-block {
                            grid-column: span 5;
                            border-left: 1px solid black;
                            background-color: #e5e7eb;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 176px;
                            overflow: hidden;
                        }
                        .photo-block img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }
                        .note-row {
                            padding: 10px 8px;
                            border-bottom: 1px solid black;
                            font-size: 12px;
                            color: #111827;
                            font-weight: 500;
                        }
                        .footer {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            border-top: 1px solid black;
                            text-align: center;
                            margin-top: 4px;
                        }
                        .footer-col {
                            padding: 12px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            border-right: 1px solid black;
                        }
                        .footer-col:last-child {
                            border-right: none;
                        }
                        .footer-icon {
                            width: 20px;
                            height: 20px;
                            margin-bottom: 4px;
                            color: #4b5563;
                        }
                        .footer-col span {
                            font-size: 12px;
                            font-weight: 600;
                            color: #1f2937;
                        }
                        .footer-col-right {
                            padding: 12px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .footer-col-right .title {
                            font-size: 12px;
                            font-weight: bold;
                            color: #111827;
                        }
                        .footer-col-right .sub {
                            font-size: 9px;
                            color: #374151;
                            margin-top: 2px;
                            font-weight: 500;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-instructions">
                        <p style="margin: 0;">Please find below your new High Resolution NIN Slip</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; font-weight: normal;">You may cut it out of the paper, fold and laminate as desired.</p>
                    </div>

                    <div class="nin-slip-container" id="nin-slip">
                        <div class="header">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png" alt="Coat of Arms of Nigeria" class="header-logo">
                            <div class="header-center">
                                <h1>National Identity Management System</h1>
                                <p style="font-size: 16px;">Federal Republic of Nigeria</p>
                                <p style="font-size: 14px; color: #374151;">National Identification Number Slip (NINS)</p>
                            </div>
                            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" alt="NIMC Logo" class="header-nimc">
                        </div>

                        <div class="grid-layout">
                            <div class="col-left">
                                <div class="cell-row">
                                    <div class="cell-lbl">Tracking ID</div>
                                    <div class="cell-val">${trackingId}</div>
                                </div>
                                <div class="cell-row">
                                    <div class="cell-lbl">NIN</div>
                                    <div class="cell-val-nin">${cleanNin}</div>
                                </div>
                                <div class="cell-row-last">
                                    <div class="cell-lbl">Issue Date</div>
                                    <div class="cell-val">${issueDate}</div>
                                </div>
                            </div>

                            <div class="col-mid">
                                <div class="cell-row">
                                    <div class="cell-lbl">Surname</div>
                                    <div class="cell-val-bold">${surname.toUpperCase()}</div>
                                </div>
                                <div class="cell-row">
                                    <div class="cell-lbl">First Name</div>
                                    <div class="cell-val-bold">${first.toUpperCase()}</div>
                                </div>
                                <div class="cell-row">
                                    <div class="cell-lbl">Middle Name</div>
                                    <div class="cell-val-bold">${middle.toUpperCase()}</div>
                                </div>
                                <div class="cell-row-last">
                                    <div class="cell-lbl">Gender</div>
                                    <div class="cell-val-bold">${gender === 'MALE' ? 'M' : 'F'}</div>
                                </div>
                            </div>

                            <div class="col-right">
                                <div class="address-block">
                                    <div class="address-title">Address:</div>
                                    <div>${addr1.toUpperCase()}</div>
                                    <div style="margin-top: 18px;">${addr2.toUpperCase()}</div>
                                    <div style="margin-top: 14px;">${addr3.toUpperCase()}</div>
                                </div>
                                <div class="photo-block">
                                    <img src="${photoUrl}" alt="Passport">
                                </div>
                            </div>
                        </div>

                        <div class="note-row">
                            <span style="font-weight: bold;">Note:</span> This transaction slip does not confer the right to the <span style="font-weight: bold;">General Multipurpose Card</span> (For any enquiry please contact)
                        </div>

                        <div class="footer">
                            <div class="footer-col">
                                <svg class="footer-icon" fill="currentColor" viewBox="0 0 20 20" style="width:18px; height:18px; color:#4b5563;"><path d="M5.5 14a3.5 3.5 0 010-7 3.5 3.5 0 015.96-2.54 2.5 2.5 0 013.3 3.53A4 4 0 0113.5 14h-8z"></path></svg>
                                <span>helpdesk@nimc.gov.ng</span>
                            </div>
                            <div class="footer-col">
                                <svg class="footer-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:18px; height:18px; color:#2563eb;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                                <span>www.nimc.gov.ng</span>
                            </div>
                            <div class="footer-col">
                                <svg class="footer-icon" fill="currentColor" viewBox="0 0 20 20" style="width:18px; height:18px; color:#16a34a;"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 004.587 4.587l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                                <span>07040144452, 07040144453</span>
                            </div>
                            <div class="footer-col-right">
                                <span class="title">National Identity Management Commission</span>
                                <span class="sub">11 Sokode Crescent, Off Dalaba Street Zone 5, Wuse Abuja Nigeria</span>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                `;
            } else if (selectedLayout === 'info') {
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
                        .logo-nimc img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }
                        .logo-nimc {
                            width: 120px;
                            height: 75px;
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
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png" alt="Coat of Arms of Nigeria">
                                </div>
                                <div class="header-center">
                                    <h1>Federal Republic of Nigeria</h1>
                                    <h2>Verified NIN Details</h2>
                                </div>
                                <div class="logo-nimc">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" alt="NIMC Logo">
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
                                        <div class="detail-val" style="padding-left: 16px;">${phone}</div>
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
                await Print.printAsync({ html });
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

    useEffect(() => {
        if (reprintId) {
            const loadReprint = async () => {
                try {
                    const stored = await AsyncStorage.getItem('recent_nin_verifications');
                    if (stored) {
                        const list = JSON.parse(stored);
                        const item = list.find((x: any) => x.id === reprintId);
                        if (item) {
                            setSelectedLayout(item.layout);
                            setNin(item.nin);
                            setResult({ status: 'success', data: item.data });
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load reprint', e);
                }
            };
            loadReprint();
        }
    }, [reprintId]);

    const handleVerify = async () => {
        if (nin.length !== 11) {
            return showAlert('NIN Invalid', 'Please enter a valid 11-digit NIN number.', 'warning');
        }
        if (!consent) {
            return showAlert('Consent Required', 'You must tick the consent checkbox before verifying.', 'warning');
        }
        const layoutItem = layouts.find(l => l.id === selectedLayout);
        const totalPrice = layoutItem ? layoutItem.price : 0;
        if ((userBalance || 0) < totalPrice) {
            return showAlert('Insufficient Balance', `Your wallet balance (₦${(userBalance || 0).toLocaleString()}) is less than the required amount (₦${totalPrice.toLocaleString()}). Please fund your wallet.`, 'error');
        }

        setLoading(true);
        try {
            const response = await api.identity.validateNIN(nin);
            
            if (response.isValid && response.data) {
                // Flatten nested data if needed (IDPro returns { data: { firstname, ... } } sometimes)
                let personData = response.data?.data ?? response.data;

                // Normalize photo: IDPro returns raw base64 (no prefix). Keep as-is;
                // IDCardMockup.resolvePhoto() handles the prefix automatically.
                // Log for debugging:
                console.log('[NIN Verify] Person data keys:', Object.keys(personData || {}));
                console.log('[NIN Verify] Photo field:', personData?.photo ? `base64 (${String(personData.photo).length} chars)` : 'none');

                setResult({ status: 'success', data: personData });
                await saveHistoryItem(personData);

            } else {
                const msg = response.message || 'Unable to verify this NIN. Please check the number and try again.';
                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance') || lowerMsg.includes('wallet')) {
                    showAlert('Service Unavailable', 'This verification service is temporarily unavailable. Please try again later.', 'warning');
                } else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('auth')) {
                    showAlert('Session Expired', 'Please log out and log in again, then retry.', 'error');
                } else if (lowerMsg.includes('not found') || lowerMsg.includes('no record') || lowerMsg.includes('does not exist') || lowerMsg.includes('not exist') || lowerMsg.includes('invalid or not found')) {
                    showAlert('No Record Found', 'The NIN you entered does not exist or has no record. Please check the number and try again.', 'error');
                } else {
                    showAlert('Verification Failed', msg, 'error');
                }
            }
        } catch (e: any) {
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist') || errM.toLowerCase().includes('not exist') || errM.toLowerCase().includes('invalid or not found')) {
                showAlert('No Record Found', 'The NIN you entered does not exist or has no record. Please check the number and try again.', 'error');
            } else {
                showAlert('Network Error', errM || 'A network error occurred. Please check your connection and try again.', 'error');
            }
        } finally {
            setLoading(false);
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

    if (result) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <Stack.Screen options={{ title: 'Verification Details', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
                
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
                        
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%' }}>
                            {renderSlip()}
                        </ViewShot>
                    </View>

                    {/* Direct Download Buttons (Mobile First, No Modal needed) */}
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
                                {result.data.firstname} {result.data.middlename ? `${result.data.middlename} ` : ''}{result.data.surname}
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

                    {/* Verify Another ID */}
                    <TouchableOpacity 
                        onPress={() => setResult(null)} 
                        style={{ borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
                    >
                        <Ionicons name="arrow-back" size={16} color="#475569" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>Verify Another ID</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

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

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
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
                <Text style={styles.headerTitle}>Verify Identity</Text>
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
                {/* 1. SLIP LAYOUT */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>Slip Layout</Text>
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
                                    activeOpacity={0.8}
                                >
                                    <View style={[
                                        styles.badgeContainer,
                                        isSelected ? styles.badgeSelected : styles.badgeUnselected
                                    ]}>
                                        <Text style={[
                                            styles.badgeText,
                                            isSelected ? styles.badgeTextSelected : styles.badgeTextUnselected
                                        ]}>
                                            {(layout as any).badge}
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

                {/* 2. SUPPLY ID & VERIFY */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>Enter Details</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="keypad" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="Enter 11-Digit NIN"
                                placeholderTextColor="#94a3b8"
                                style={styles.input}
                                keyboardType="number-pad" 
                                maxLength={11} 
                                value={nin} 
                                onChangeText={setNin} 
                                editable={!loading}
                            />
                            {nin.length > 0 && (
                                <Text style={[
                                    styles.lenIndicator,
                                    nin.length === 11 ? styles.lenIndicatorSuccess : styles.lenIndicatorWarning
                                ]}>
                                    {nin.length}/11
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

                    {/* Custom Checkbox area */}
                    <TouchableOpacity 
                        onPress={() => setConsent(!consent)} 
                        activeOpacity={0.8}
                        style={styles.consentContainer}
                    >
                        <View style={[
                            styles.checkboxBox, 
                            consent ? styles.checkboxBoxSelected : styles.checkboxBoxUnselected
                        ]}>
                            {consent && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                        <Text style={styles.consentText}>
                            I confirm that I have obtained consent to verify this identity.
                        </Text>
                    </TouchableOpacity>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || nin.length !== 11 || !consent} 
                        style={[
                            styles.verifyButton,
                            (loading || nin.length !== 11 || !consent) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <>
                                <Text style={styles.verifyButtonText}>VERIFY NIN</Text>
                                {!consent && <Text style={styles.verifyButtonSubtext}>(tick consent first)</Text>}
                            </>
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

                {/* ID Analytics / Verification Stats Widget */}
                {historyList.length > 0 && (
                    <View style={styles.statsCard}>
                        <View style={styles.statsHeader}>
                            <Ionicons name="analytics" size={16} color="#f5a623" />
                            <Text style={styles.statsTitle}>Verification Stats</Text>
                        </View>
                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>{historyList.length}</Text>
                                <Text style={styles.statLabel}>Total Prints</Text>
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
                            placeholder="Search past prints (Name or NIN)..."
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

                {/* 3. RECENT VERIFICATIONS */}
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
                                            setSelectedLayout(item.layout);
                                            setNin(item.nin);
                                            setResult({ status: 'success', data: item.data });
                                        }}
                                        style={styles.historyItemLeft}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.historyIconContainer}>
                                            <Ionicons name="document-text" size={16} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.name}</Text>
                                            <Text style={styles.historyMeta}>NIN: {item.nin} • {item.layout.toUpperCase()}</Text>
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
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
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
    input: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 1.5,
    },
    consentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
        marginTop: 8,
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
    verifyButton: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
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
    verifyButtonSubtext: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9,
        marginLeft: 6,
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
});
