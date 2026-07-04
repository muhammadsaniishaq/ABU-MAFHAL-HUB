import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Image, Platform, ImageBackground } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to safely load external images on Web for canvas rendering
const getSafeImageUrl = (url: string) => {
    if (Platform.OS === 'web' && url.startsWith('http')) {
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    }
    return url;
};

const DEFAULT_PRICES = {
    bvn_num_basic: 200,
    bvn_num_advanced: 250,
    bvn_phone_basic: 250,
    bvn_phone_advanced: 300,
    bvn_card: 250
};

export default function BVNVerificationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const viewShotRef = useRef<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Step 1: SEARCH TYPE - 'number' (BVN Number Verification) | 'phone' (Phone Number) | 'card' (BVN Card Verification)
    const [searchType, setSearchType] = useState<'number' | 'phone' | 'card'>('number');
    
    // Step 2: DETAILS NEEDED - 'basic' | 'advanced'
    const [detailsNeeded, setDetailsNeeded] = useState<'basic' | 'advanced'>('advanced');
    
    // Step 3: SUPPLY INPUT NUMBER
    const [inputValue, setInputValue] = useState('');
    const [isAgreed, setIsAgreed] = useState(false);
    
    // Common States
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);

    // Dynamic Prices
    const [prices, setPrices] = useState(DEFAULT_PRICES);

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

    const [historyList, setHistoryList] = useState<any[]>([]);

    const loadHistory = async () => {
        try {
            const stored = await AsyncStorage.getItem('recent_bvn_requests');
            setHistoryList(stored ? JSON.parse(stored).slice(0, 500) : []);
        } catch (e) {
            console.warn('Failed to load history', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [])
    );

    const deleteHistoryItem = async (itemId: string) => {
        Alert.alert(
            'Confirm Delete',
            'Remove this record from recent searches?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const stored = await AsyncStorage.getItem('recent_bvn_requests');
                            const allRecords = stored ? JSON.parse(stored) : [];
                            const updatedAll = allRecords.filter((item: any) => item.id !== itemId);
                            await AsyncStorage.setItem('recent_bvn_requests', JSON.stringify(updatedAll));
                            setHistoryList(updatedAll.slice(0, 500));
                        } catch (e) {
                            console.warn('Failed to delete history', e);
                        }
                    }
                }
            ]
        );
    };

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setCustomAlert({
            visible: true,
            title,
            message,
            type
        });
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

    const fetchPrices = async () => {
        try {
            const { data, error } = await supabase.from('service_pricing').select('*').eq('service_category', 'bvn');
            if (error || !data) return;
            
            const newPrices = { ...DEFAULT_PRICES };
            data.forEach(item => {
                if (item.id in newPrices) {
                    newPrices[item.id as keyof typeof DEFAULT_PRICES] = Number(item.cost_price) + Number(item.markup_price);
                }
            });
            setPrices(newPrices);
        } catch (e) {
            console.warn('Failed to fetch dynamic prices', e);
        }
    };

    const getSelectedPrice = () => {
        if (searchType === 'card') {
            return prices.bvn_card;
        }
        if (searchType === 'phone') {
            return detailsNeeded === 'basic' ? prices.bvn_phone_basic : prices.bvn_phone_advanced;
        }
        return detailsNeeded === 'basic' ? prices.bvn_num_basic : prices.bvn_num_advanced;
    };

    const getSelectedPriceId = () => {
        if (searchType === 'card') return 'bvn_card';
        if (searchType === 'phone') {
            return detailsNeeded === 'basic' ? 'bvn_phone_basic' : 'bvn_phone_advanced';
        }
        return detailsNeeded === 'basic' ? 'bvn_num_basic' : 'bvn_num_advanced';
    };

    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const amount = getSelectedPrice();
            
            // Remove huge base64 images so AsyncStorage never crashes/clears
            const dataToSave = { ...verifiedData };
            delete dataToSave.base64Image;
            delete dataToSave.image;
            delete dataToSave.photo;

            const newItem = {
                id: Date.now().toString(),
                target: inputValue.trim(),
                status: 'Completed',
                slip: searchType === 'card' 
                    ? 'BVN Card Verification' 
                    : searchType === 'phone'
                        ? `Phone BVN ${detailsNeeded === 'basic' ? 'Basic' : 'Advanced'} Verification`
                        : `BVN ${detailsNeeded === 'basic' ? 'Basic' : 'Advanced'} Verification`,
                amount,
                date: (() => {
                    const d = new Date();
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                })(),
                data: dataToSave
            };
            
            const stored = await AsyncStorage.getItem('recent_bvn_requests');
            const historyList = stored ? JSON.parse(stored) : [];
            const updated = [newItem, ...historyList.filter((item: any) => item.target !== newItem.target)].slice(0, 5000);
            await AsyncStorage.setItem('recent_bvn_requests', JSON.stringify(updated));
            setHistoryList(updated);
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };

    useEffect(() => {
        fetchPrices();
        fetchWalletBalance();
    }, [searchType, detailsNeeded]);

    const handleVerify = async () => {
        const cleanVal = inputValue.trim();
        if (cleanVal.length !== 11) {
            return showAlert('Invalid Input', 'Please enter a valid 11-digit BVN or Phone Number.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before running verification.', 'warning');
        }

        const totalPrice = getSelectedPrice();
        if ((userBalance || 0) < totalPrice) {
            return showAlert('Insufficient Balance', `Your wallet balance (₦${(userBalance || 0).toLocaleString()}) is less than the required amount (₦${totalPrice.toLocaleString()}). Please fund your wallet.`, 'error');
        }

        setLoading(true);
        try {
            let res: any;
            if (searchType === 'phone') {
                res = await api.identity.retrieveBVN(cleanVal);
            } else if (searchType === 'card') {
                res = await api.identity.getBVNCard(cleanVal);
            } else {
                res = await api.identity.validateBVN(cleanVal);
            }

            if (res.isValid || res.status === 'success') {
                const finalData = res.data || res.rawData || res;
                
                // Deduct Wallet Balance
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    const userId = authData.user.id;
                    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
                    if (profile && profile.balance >= totalPrice) {
                        const newBal = profile.balance - totalPrice;
                        await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                        
                        // Record Transaction
                        await supabase.from('transactions').insert({
                            user_id: userId,
                            type: 'bvn_verification',
                            amount: totalPrice,
                            status: 'success',
                            description: `BVN Search: ${cleanVal}`,
                            reference: `BVN_${Date.now()}`
                        });
                    }
                }

                setResult(finalData);
                await saveHistoryItem(finalData);
                await fetchWalletBalance();
            } else {
                const msg = res.message || 'Could not verify BVN details.';
                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance') || lowerMsg.includes('wallet')) {
                    showAlert('Service Unavailable', 'The BVN verification service is temporarily unavailable. Please try again later.', 'warning');
                } else {
                    showAlert('Verification Failed', msg, 'error');
                }
            }
        } catch (e: any) {
            console.warn('API Error:', e.response?.data || e.message);
            const errM = e.response?.data?.message || e.response?.data?.error || e.message || '';
            const lowerMsg = errM.toLowerCase();
            
            if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance') || lowerMsg.includes('wallet') || lowerMsg.includes('funds')) {
                // If this is thrown after we verified the user's balance, it means the API provider's balance is exhausted.
                showAlert('Service Unavailable', 'The BVN verification service is temporarily down for maintenance. Please try again later.', 'warning');
            } else {
                showAlert('Verification Failed', errM || 'An error occurred during verification. Please check your details.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPng = async () => {
        try {
            setIsSaving(true);
            if (Platform.OS === 'web') {
                await new Promise<void>((resolve) => {
                    const node = document.getElementById('slip-preview-container');
                    if (!node) return resolve();
                    
                    const generatePng = () => {
                        // @ts-ignore
                        window.html2canvas(node, { useCORS: true, scale: 5 }).then((canvas) => {
                            const link = document.createElement('a');
                            link.download = `bvn_slip_${inputValue || 'verify'}.png`;
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
                        dialogTitle: 'Download BVN Card (PNG)'
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

    const getPhotoUrl = (data: any) => {
        const rawPhoto = data?.base64Image || data?.photo || data?.image || '';
        if (!rawPhoto) {
            return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL363G0d9u3u5YQ&s';
        }
        return rawPhoto.startsWith('data:') || rawPhoto.startsWith('http')
            ? rawPhoto
            : `data:image/jpeg;base64,${rawPhoto}`;
    };

    const getFingerprintUrl = (data: any) => {
        const rawFp = data?.fingerprint || data?.base64Fingerprint || '';
        if (!rawFp) return null;
        return rawFp.startsWith('data:') || rawFp.startsWith('http')
            ? rawFp
            : `data:image/png;base64,${rawFp}`;
    };

    const handleDownloadPdf = async () => {
        if (!result) return;
        try {
            setIsSaving(true);
            const photoUrl = getPhotoUrl(result);
            const fingerprintUrl = getFingerprintUrl(result);
            const surName = result.lastName || result.last_name || '—';
            const otherNames = [result.firstName || result.first_name, result.middleName || result.middle_name].filter(Boolean).join(' ') || '—';
            const bvnDob = result.dateOfBirth || result.dob || '—';
            const bvnGender = result.gender || '—';
            const bvnNum = result.number || result.bvn || inputValue || '—';

            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @media print {
            body { margin: 0; padding: 40px; }
        }
        body { 
            background-color: #e5e7eb; 
            margin: 0; 
            padding: 40px; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 32px; 
            font-family: sans-serif; 
            box-sizing: border-box;
        }
        .card {
            background-color: #ffffff;
            width: 520px;
            height: 320px;
            border: 1px solid #d1d5db;
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
            page-break-inside: avoid;
        }
        .flex-between { display: flex; justify-content: space-between; align-items: flex-start; }
        .flex-center { display: flex; align-items: center; }
        .flex-col-center { display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .gap-2 { gap: 8px; }
        .gap-4 { gap: 16px; }
        .gap-6 { gap: 24px; }
        .gap-8 { gap: 32px; }
        .logo-img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .logo-img-lg { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
        .title-box { border-left: 2px solid #1e3a8a; padding-left: 8px; }
        .title-text { color: #1e3a8a; font-weight: bold; font-size: 13px; line-height: 1.1; margin: 0; }
        .title-text-lg { color: #1e3a8a; font-weight: bold; font-size: 20px; line-height: 1.1; margin: 0; }
        .icon-box { color: #1e40af; width: 40px; }
        .icon-box-lg { color: #000; width: 48px; }
        
        .profile-section { display: flex; margin-top: 16px; gap: 16px; }
        .photo-wrapper { position: relative; }
        .photo-img { width: 80px; height: 96px; border: 1px solid #9ca3af; object-fit: cover; }
        .print-badge { position: absolute; bottom: -8px; left: -8px; width: 40px; height: 40px; background-color: #e5e7eb; border-radius: 50%; border: 1px solid #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #374151; font-weight: bold; }
        
        .details-section { flex: 1; font-size: 8px; color: #4b5563; font-weight: bold; text-transform: uppercase; display: flex; flex-direction: column; gap: 8px; }
        .detail-val { color: #000000; font-size: 10px; display: block; margin-top: 2px; }
        .flex-row { display: flex; }
        
        .bvn-section { margin-top: 12px; }
        .bvn-label { font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0; }
        .bvn-val { font-size: 24px; font-weight: 900; color: #172554; letter-spacing: 0.2em; margin: 0; }
        
        .watermark { position: absolute; top: 40px; right: 16px; width: 80px; height: 96px; display: flex; align-items: center; justify-content: center; }
        .watermark-back { width: 96px; height: 112px; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>

    <!-- FRONT CARD -->
    <div class="card">
        <div class="flex-between">
            <div class="flex-center gap-2">
                <img src="${getSafeImageUrl('https://pbs.twimg.com/profile_images/486516606571278336/2ML1Sse5_400x400.jpeg')}" class="logo-img">
                <div class="title-box">
                    <h1 class="title-text">Bank<br>Verification<br>Number</h1>
                </div>
            </div>
            <div class="icon-box"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg></div>
        </div>

        <div class="profile-section">
            <div class="photo-wrapper">
                <img src="${photoUrl}" class="photo-img">
                <div class="print-badge">Print</div>
            </div>
            <div class="details-section">
                <div>SURNAME<span class="detail-val">${surName}</span></div>
                <div>FIRST NAME/OTHER NAME<span class="detail-val">${otherNames}</span></div>
                <div class="flex-row gap-8">
                    <div>DATE OF BIRTH<span class="detail-val">${bvnDob}</span></div>
                    <div>GENDER<span class="detail-val">${bvnGender}</span></div>
                </div>
            </div>
        </div>

        <div class="bvn-section">
            <p class="bvn-label">Bank Verification Number (BVN)</p>
            <p class="bvn-val">${bvnNum}</p>
        </div>
        <div class="watermark">
            ${fingerprintUrl 
                ? `<img src="${fingerprintUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: invert(1) sepia(1) saturate(5) hue-rotate(175deg); mix-blend-mode: screen; opacity: 0.5;" />`
                : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 100%; height: 100%; color: #3b82f6; opacity: 0.5;">
                     <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.89-1.24-2.01-2.2-3.35-2.89-2.8-1.43-6.36-1.43-9.16.01-1.35.69-2.48 1.66-3.36 2.9-.13.18-.32.22-.51.22zm2.09 9.36c-.1 0-.21-.03-.31-.08-.26-.14-.35-.46-.21-.71.55-1.02 1.58-1.6 2.68-1.6 1.13 0 2.19.59 2.72 1.61.14.26.05.58-.21.72-.26.14-.58.05-.72-.21-.34-.65-.96-1.12-1.79-1.12s-1.43.46-1.77 1.11c-.13.26-.41.36-.66.21zm-2.04 2.8c-.28 0-.5-.22-.5-.5v-4.14c0-2.88 2.34-5.22 5.22-5.22s5.22 2.34 5.22 5.22v.11c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.11c0-2.33-1.89-4.22-4.22-4.22s-4.22 1.89-4.22 4.22v4.14c0 .28-.22.5-.5.5zm11.75-8.49c-.1 0-.21-.03-.31-.08-1.47-.79-3.21-1.2-5-1.2s-3.53.41-5 1.2c-.25.13-.56.04-.69-.21-.13-.25-.04-.56.21-.69 1.63-.88 3.54-1.3 5.48-1.3s3.85.42 5.48 1.3c.25.13.34.44.21.69-.09.18-.26.29-.44.29zm3.56 6.8c-.14 0-.29-.06-.39-.18l-.51-.61c-1.06-1.27-2.61-2-4.25-2-1.12 0-2.22.36-3.13 1.05-.22.17-.54.12-.71-.1-.17-.22-.12-.54.1-.71 1.05-.78 2.3-1.24 3.74-1.24 1.89 0 3.65.85 4.88 2.32l.51.61c.18.21.15.53-.06.71-.11.11-.25.15-.38.15z"/>
                   </svg>`
            }
        </div>
    </div>

    <!-- BACK CARD -->
    <div class="card flex-col-center" style="margin-top: 16px;">
        <div class="flex-center gap-4" style="margin-bottom: 24px;">
            <img src="${getSafeImageUrl('https://pbs.twimg.com/profile_images/486516606571278336/2ML1Sse5_400x400.jpeg')}" class="logo-img-lg">
            <h1 class="title-text-lg">Bank<br>Verification<br>Number</h1>
        </div>
        <div class="flex-center gap-6">
            <div class="icon-box-lg"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg></div>
            <div class="watermark-back">
                ${fingerprintUrl 
                    ? `<img src="${fingerprintUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: invert(1) sepia(1) saturate(5) hue-rotate(175deg); mix-blend-mode: screen; opacity: 0.5;" />`
                    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 100%; height: 100%; color: #3b82f6; opacity: 0.5;">
                         <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.89-1.24-2.01-2.2-3.35-2.89-2.8-1.43-6.36-1.43-9.16.01-1.35.69-2.48 1.66-3.36 2.9-.13.18-.32.22-.51.22zm2.09 9.36c-.1 0-.21-.03-.31-.08-.26-.14-.35-.46-.21-.71.55-1.02 1.58-1.6 2.68-1.6 1.13 0 2.19.59 2.72 1.61.14.26.05.58-.21.72-.26.14-.58.05-.72-.21-.34-.65-.96-1.12-1.79-1.12s-1.43.46-1.77 1.11c-.13.26-.41.36-.66.21zm-2.04 2.8c-.28 0-.5-.22-.5-.5v-4.14c0-2.88 2.34-5.22 5.22-5.22s5.22 2.34 5.22 5.22v.11c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.11c0-2.33-1.89-4.22-4.22-4.22s-4.22 1.89-4.22 4.22v4.14c0 .28-.22.5-.5.5zm11.75-8.49c-.1 0-.21-.03-.31-.08-1.47-.79-3.21-1.2-5-1.2s-3.53.41-5 1.2c-.25.13-.56.04-.69-.21-.13-.25-.04-.56.21-.69 1.63-.88 3.54-1.3 5.48-1.3s3.85.42 5.48 1.3c.25.13.34.44.21.69-.09.18-.26.29-.44.29zm3.56 6.8c-.14 0-.29-.06-.39-.18l-.51-.61c-1.06-1.27-2.61-2-4.25-2-1.12 0-2.22.36-3.13 1.05-.22.17-.54.12-.71-.1-.17-.22-.12-.54.1-.71 1.05-.78 2.3-1.24 3.74-1.24 1.89 0 3.65.85 4.88 2.32l.51.61c.18.21.15.53-.06.71-.11.11-.25.15-.38.15z"/>
                    </svg>`
                }
            </div>
        </div>
    </div>

</body>
</html>
            `;

            const basicHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');

        :root {
            --bg: #f8fafc;
            --card-white: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --accent-green: #16a34a;
            --border: #e2e8f0;
        }

        @media print {
            body { margin: 0; padding: 40px; }
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .card {
            background: var(--card-white);
            width: 840px;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 1px solid var(--border);
        }

        /* Header */
        .header { text-align: center; margin-bottom: 40px; }
        .emblem { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .title { font-size: 20px; font-weight: 600; color: var(--text-main); }

        /* Grid Layout */
        .container { display: grid; grid-template-columns: 1fr 200px 1fr; gap: 30px; }

        /* Columns */
        .col-header { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 15px; }
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .field { margin-bottom: 10px; }
        .label { font-size: 12px; color: var(--text-muted); }
        .value { font-size: 14px; color: var(--text-main); font-weight: 400; margin-top: 2px; }

        .center-col { text-align: center; border-left: 1px solid var(--border); border-right: 1px solid var(--border); padding: 0 20px; }
        .avatar { width: 100px; height: 100px; background: #cbd5e1; border-radius: 50%; margin: 0 auto 15px; overflow: hidden; }
        .id-num { font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 20px; }
        .qr-box { width: 80px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }

        .right-col { padding-left: 10px; }
        .badge { display: flex; align-items: center; gap: 8px; color: var(--accent-green); font-weight: 600; margin-bottom: 20px; }
        .notes { font-size: 12px; color: var(--text-muted); line-height: 1.5; padding-left: 15px; }
        .notes li { margin-bottom: 8px; }
    </style>
</head>
<body>

<div class="card">
    <header class="header">
        <div class="emblem"><img src="${getSafeImageUrl('https://pbs.twimg.com/profile_images/486516606571278336/2ML1Sse5_400x400.jpeg')}" style="width:100%;height:100%;object-fit:cover;" /></div>
        <div class="title">BVN Verification Details</div>
    </header>

    <div class="container">
        <div class="left-col">
            <div class="data-grid">
                <div class="field"><div class="label">First Name</div><div class="value">${result.firstName || result.first_name || '—'}</div></div>
                <div class="field"><div class="label">Middle Name</div><div class="value">${result.middleName || result.middle_name || '—'}</div></div>
                <div class="field"><div class="label">Last Name</div><div class="value">${surName}</div></div>
                <div class="field"><div class="label">DOB</div><div class="value">${bvnDob}</div></div>
                <div class="field"><div class="label">Gender</div><div class="value">${bvnGender}</div></div>
                <div class="field"><div class="label">Marital Status</div><div class="value">${result.maritalStatus || result.marital_status || '—'}</div></div>
                <div class="field"><div class="label">Phone</div><div class="value">${result.phone || result.phoneNumber || '—'}</div></div>
                <div class="field"><div class="label">Email</div><div class="value">${result.email || '—'}</div></div>
            </div>
        </div>

        <div class="center-col">
            <div class="avatar"><img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" /></div>
            <div class="label">BVN Number</div>
            <div class="id-num">${bvnNum}</div>
            <div class="qr-box">
                ${fingerprintUrl 
                ? `<img src="${fingerprintUrl}" style="width: 100%; height: 100%; object-fit: contain; filter: invert(1) sepia(1) saturate(5) hue-rotate(175deg); mix-blend-mode: multiply; opacity: 0.6;" />`
                : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 100%; height: 100%; color: #3b82f6; opacity: 0.8;">
                     <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.89-1.24-2.01-2.2-3.35-2.89-2.8-1.43-6.36-1.43-9.16.01-1.35.69-2.48 1.66-3.36 2.9-.13.18-.32.22-.51.22zm2.09 9.36c-.1 0-.21-.03-.31-.08-.26-.14-.35-.46-.21-.71.55-1.02 1.58-1.6 2.68-1.6 1.13 0 2.19.59 2.72 1.61.14.26.05.58-.21.72-.26.14-.58.05-.72-.21-.34-.65-.96-1.12-1.79-1.12s-1.43.46-1.77 1.11c-.13.26-.41.36-.66.21zm-2.04 2.8c-.28 0-.5-.22-.5-.5v-4.14c0-2.88 2.34-5.22 5.22-5.22s5.22 2.34 5.22 5.22v.11c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.11c0-2.33-1.89-4.22-4.22-4.22s-4.22 1.89-4.22 4.22v4.14c0 .28-.22.5-.5.5zm11.75-8.49c-.1 0-.21-.03-.31-.08-1.47-.79-3.21-1.2-5-1.2s-3.53.41-5 1.2c-.25.13-.56.04-.69-.21-.13-.25-.04-.56.21-.69 1.63-.88 3.54-1.3 5.48-1.3s3.85.42 5.48 1.3c.25.13.34.44.21.69-.09.18-.26.29-.44.29zm3.56 6.8c-.14 0-.29-.06-.39-.18l-.51-.61c-1.06-1.27-2.61-2-4.25-2-1.12 0-2.22.36-3.13 1.05-.22.17-.54.12-.71-.1-.17-.22-.12-.54.1-.71 1.05-.78 2.3-1.24 3.74-1.24 1.89 0 3.65.85 4.88 2.32l.51.61c.18.21.15.53-.06.71-.11.11-.25.15-.38.15z"/>
                   </svg>`
                }
            </div>
        </div>

        <div class="right-col">
            <div class="badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                Verified
            </div>
            <ul class="notes">
                <li>Information is valid as of the date issued.</li>
                <li>Verify via the official portal only.</li>
                <li>Do not share this document with unauthorized parties.</li>
                <li>Status subject to periodic government updates.</li>
            </ul>
        </div>
    </div>
</div>

</body>
</body>
</html>
            `;

            const advancedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BVN Verification Details</title>
    <style>
        @media print {
            body { margin: 0; padding: 20px; background-color: #fff; }
            .container { box-shadow: none; border: none; max-width: 100%; margin: 0; }
        }
        body { background-color: #f3f4f6; padding: 32px; font-family: sans-serif; }
        .container { max-width: 896px; margin: 0 auto; background-color: #ffffff; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #d1d5db; }
        .header { display: flex; align-items: center; border: 2px solid #000; margin-bottom: 24px; }
        .header-left { background-color: #1e3a8a; padding: 8px; display: flex; align-items: center; gap: 8px; width: 256px; }
        .logo { width: 32px; height: 32px; border-radius: 50%; }
        .header-text-box { color: #ffffff; font-size: 12px; font-weight: bold; line-height: 1.25; }
        .header-title { flex-grow: 1; text-align: center; font-weight: bold; font-size: 14px; }
        .date-text { text-align: right; font-size: 14px; margin-bottom: 8px; }
        .content { display: flex; flex-direction: row; gap: 24px; }
        .col-left { width: 33.333%; }
        .profile-img { width: 100%; height: auto; border: 1px solid #9ca3af; object-fit: cover; }
        .col-right { width: 66.666%; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 14px; }
        th { background-color: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; color: #4b5563; border-bottom: 1px solid #9ca3af; }
        td { padding: 8px 12px; border-bottom: 1px solid #d1d5db; }
        .td-label { font-weight: bold; border-right: 1px solid #d1d5db; width: 33.333%; }
        .note { margin-top: 16px; font-size: 14px; }
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <div class="header-left">
                <img src="${getSafeImageUrl('https://pbs.twimg.com/profile_images/486516606571278336/2ML1Sse5_400x400.jpeg')}" alt="Logo" class="logo">
                <div class="header-text-box">
                    <div>Bank</div>
                    <div>Verification</div>
                    <div>Number</div>
                </div>
            </div>
            <div class="header-title">
                The Bank Verification Number has successfully been verified.
            </div>
        </div>

        <div class="date-text">
            Date: ${new Date().toISOString()}
        </div>

        <div class="content">
            <div class="col-left">
                <img src="${photoUrl}" alt="User Profile" class="profile-img">
            </div>

            <div class="col-right">
                <table>
                    <thead>
                        <tr>
                            <th colspan="2">Personal Information</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td class="td-label">BVN</td><td>${bvnNum}</td></tr>
                        <tr><td class="td-label">NIN</td><td>${result.nin || '—'}</td></tr>
                        <tr><td class="td-label">First Name</td><td>${result.firstName || result.first_name || '—'}</td></tr>
                        <tr><td class="td-label">Last Name</td><td>${surName}</td></tr>
                        <tr><td class="td-label">Middle Name</td><td>${result.middleName || result.middle_name || '—'}</td></tr>
                        <tr><td class="td-label">Phone</td><td>${result.phone || result.phoneNumber || '—'}</td></tr>
                        <tr><td class="td-label">Email</td><td>${result.email || '—'}</td></tr>
                        <tr><td class="td-label">Date of birth</td><td>${bvnDob}</td></tr>
                        <tr><td class="td-label">Gender</td><td>${bvnGender}</td></tr>
                        <tr><td class="td-label">Enrollment Bank</td><td>${result.enrollmentBank || result.enrollment_bank || '—'}</td></tr>
                        <tr><td class="td-label">Enrollment Branch</td><td>${result.enrollmentBranch || result.enrollment_branch || '—'}</td></tr>
                        <tr><td class="td-label">Registration Date</td><td>${result.registrationDate || result.registration_date || '—'}</td></tr>
                        <tr><td class="td-label">Address</td><td>${result.residentialAddress || result.address || '—'}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="note">
            NOTE: This is a verified electronic document.
        </div>
    </div>

</body>
</html>
            `;
            
            let finalHtml = html;
            let printWidth = 595;
            let printHeight = 842;
            
            if (searchType === 'card') {
                finalHtml = html;
                printWidth = 595;
                printHeight = 842;
            } else if (detailsNeeded === 'advanced') {
                finalHtml = advancedHtml;
                printWidth = 842;
                printHeight = 595;
            } else {
                finalHtml = basicHtml;
                printWidth = 842;
                printHeight = 595;
            }

            if (Platform.OS === 'web') {
                await new Promise<void>((resolve) => {
                    const generatePdf = () => {
                        const container = document.createElement('div');
                        container.innerHTML = finalHtml;
                        container.style.position = 'absolute';
                        container.style.top = '-9999px';
                        document.body.appendChild(container);
                        
                        // @ts-ignore
                        window.html2pdf().set({
                            margin: 0,
                            filename: `bvn_slip.pdf`,
                            image: { type: 'jpeg', quality: 1.0 },
                            html2canvas: { scale: 5, useCORS: true },
                            jsPDF: { unit: 'px', format: [printWidth, printHeight], orientation: printWidth > printHeight ? 'landscape' : 'portrait' }
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
                const { uri: pdfUri } = await Print.printToFileAsync({ html: finalHtml, width: printWidth, height: printHeight });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(pdfUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Download BVN Card (PDF)',
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


    if (result) {
        const photoUrl = getPhotoUrl(result);
        const fingerprintUrl = getFingerprintUrl(result);
        const fullName = [result.firstName || result.first_name, result.middleName || result.middle_name, result.lastName || result.last_name].filter(Boolean).join(' ') || 'RECORD HOLDER';
        
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                
                {/* Result header */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: 16, paddingHorizontal: 16, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setResult(null)} style={{ position: 'absolute', top: Math.max(insets.top, 24) + 16, left: 16, padding: 8, zIndex: 10 }}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={16} color="#f5a623" />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>BVN RECORD FOUND</Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Securely Verified</Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 40 }} contentContainerStyle={{ paddingBottom: 80 }}>
                    {/* Gorgeous ID card preview wrapped in ViewShot for sharing/download */}
                    <View nativeID="slip-preview-container" style={{ width: '100%', overflow: 'hidden' }}>
                        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
                            <View style={{ backgroundColor: '#ffffff', width: '100%', aspectRatio: 520/320, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db', padding: 16, overflow: 'hidden', position: 'relative', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width:0, height:4}, shadowRadius: 10 }}>
                                {/* Header */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Image source={{ uri: getSafeImageUrl('https://pbs.twimg.com/profile_images/486516606571278336/2ML1Sse5_400x400.jpeg') }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                        <View style={{ borderLeftWidth: 2, borderLeftColor: '#1e3a8a', paddingLeft: 6, marginLeft: 8 }}>
                                            <Text style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: 10, lineHeight: 11 }}>Bank{'\n'}Verification{'\n'}Number</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="finger-print" size={24} color="#1e40af" />
                                </View>

                                {/* Profile Info */}
                                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                                    <View style={{ position: 'relative' }}>
                                        <Image source={{ uri: photoUrl }} style={{ width: 60, height: 74, borderWidth: 1, borderColor: '#9ca3af', objectFit: 'cover' }} />
                                        <View style={{ position: 'absolute', bottom: -6, left: -6, width: 28, height: 28, backgroundColor: '#e5e7eb', borderRadius: 14, borderWidth: 1, borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#374151' }}>Print</Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12, justifyContent: 'space-between' }}>
                                        <View>
                                            <Text style={{ fontSize: 6, color: '#4b5563', fontWeight: 'bold' }}>SURNAME</Text>
                                            <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{result.lastName || result.last_name || '—'}</Text>
                                        </View>
                                        <View style={{ marginTop: 4 }}>
                                            <Text style={{ fontSize: 6, color: '#4b5563', fontWeight: 'bold' }}>FIRST NAME/OTHER NAME</Text>
                                            <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{[result.firstName || result.first_name, result.middleName || result.middle_name].filter(Boolean).join(' ') || '—'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                            <View style={{ marginRight: 24 }}>
                                                <Text style={{ fontSize: 6, color: '#4b5563', fontWeight: 'bold' }}>DATE OF BIRTH</Text>
                                                <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{result.dateOfBirth || result.dob || '—'}</Text>
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 6, color: '#4b5563', fontWeight: 'bold' }}>GENDER</Text>
                                                <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>{result.gender || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* BVN Number */}
                                <View style={{ marginTop: 12 }}>
                                    <Text style={{ fontSize: 6, color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>Bank Verification Number (BVN)</Text>
                                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#172554', letterSpacing: 3 }}>{result.number || result.bvn || inputValue}</Text>
                                </View>

                                {/* Watermark Fingerprint */}
                                <View style={{ position: 'absolute', top: 32, right: 12, width: 64, height: 76, opacity: fingerprintUrl ? 0.15 : 0.15, alignItems: 'center', justifyContent: 'center' }}>
                                    {fingerprintUrl ? (
                                        <Image source={{ uri: fingerprintUrl }} style={{ width: '100%', height: '100%', opacity: 0.15, resizeMode: 'contain', tintColor: '#3b82f6' }} />
                                    ) : (
                                        <Ionicons name="finger-print" size={64} color="#3b82f6" style={{ opacity: 0.8 }} />
                                    )}
                                </View>
                            </View>
                        </ViewShot>
                    </View>

                    {/* Full details table */}
                    <View style={styles.detailsCard}>
                        <Text style={styles.detailsSectionTitle}>VERIFICATION SCHEDULING DETAILS</Text>
                        
                        {[
                            { label: 'FIRST NAME', value: result.firstName || result.first_name || '—' },
                            { label: 'MIDDLE NAME', value: result.middleName || result.middle_name || '—' },
                            { label: 'LAST NAME', value: result.lastName || result.last_name || '—' },
                            { label: 'NIN LINKED', value: result.nin || result.NIN || '—' },
                            { label: 'PRIMARY PHONE', value: result.phoneNumber1 || result.phone || '—' },
                            { label: 'ENROLLMENT BANK', value: result.enrollmentBank || result.bank || '—' },
                            { label: 'ENROLLMENT BRANCH', value: result.enrollmentBranch || '—' },
                            { label: 'STATE OF ORIGIN', value: result.stateOfOrigin || '—' },
                            { label: 'STATE OF RESIDENCE', value: result.stateOfResidence || '—' },
                            { label: 'LGA OF ORIGIN', value: result.lgaOfOrigin || '—' },
                            { label: 'MARITAL STATUS', value: result.maritalStatus || '—' },
                            { label: 'RESIDENTIAL ADDRESS', value: result.residentialAddress || '—' }
                        ].map((row, idx) => (
                            <View key={idx} style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>{row.label}</Text>
                                <Text style={styles.detailsValue}>{row.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Download Buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <TouchableOpacity 
                            onPress={handleDownloadPdf}
                            style={[styles.actionBtn, { flex: 1, marginRight: 8, backgroundColor: '#060d21' }]}
                            activeOpacity={0.8}
                            disabled={isSaving}
                        >
                            <Ionicons name="document-text" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.actionBtnText}>{isSaving ? 'Processing...' : 'Download PDF'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleDownloadPng}
                            style={[styles.actionBtn, { flex: 1, marginLeft: 8, backgroundColor: '#10b981' }]}
                            activeOpacity={0.8}
                            disabled={isSaving}
                        >
                            <Ionicons name="image" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.actionBtnText}>{isSaving ? 'Processing...' : 'Download Image'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Back Button */}
                    <TouchableOpacity 
                        onPress={() => setResult(null)} 
                        style={[styles.actionBtn, { backgroundColor: '#f1f5f9', shadowOpacity: 0 }]}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.actionBtnText, { color: '#64748b' }]}>RUN ANOTHER SEARCH</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            
            {/* Premium Modern Header */}
            <LinearGradient 
                colors={['#060d21', '#121F42']} 
                style={{ 
                    paddingTop: Math.max(insets.top, 24) + 12, 
                    paddingBottom: 20, 
                    paddingHorizontal: 20, 
                    borderBottomLeftRadius: 28,
                    borderBottomRightRadius: 28,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                    elevation: 10,
                    marginBottom: 16,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#f5a623" />
                    </TouchableOpacity>
                    
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>BVN Verification</Text>
                        <Text style={{ color: '#f5a623', fontSize: 11, fontWeight: '600', marginTop: 2 }}>Secure Identity Check</Text>
                    </View>
                    
                    <TouchableOpacity onPress={() => router.push('/bvn-history')} style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }} activeOpacity={0.7}>
                        <Ionicons name="time" size={20} color="#10B981" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Premium Loader Modal */}
            {loading && (
                <Modal transparent visible={loading} animationType="fade">
                    <View style={styles.loaderOverlay}>
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text style={styles.loaderTitle}>Processing Verification</Text>
                            <Text style={styles.loaderSub}>Connecting to NIBSS Security Registry...</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Custom Alert Modal */}
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

            <ScrollView style={{ flex: 1, paddingHorizontal: 12 }} contentContainerStyle={[styles.scrollContent, { paddingTop: 20 }]}>
                
                {/* Wallet Balance widget */}
                <View style={[styles.walletBar, { marginTop: 4 }]}>
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

                {/* 1. SEARCH TYPE */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>SEARCH TYPE</Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                        <TouchableOpacity 
                            onPress={() => setSearchType('number')}
                            style={[
                                styles.choiceCellHorizontal,
                                searchType === 'number' ? styles.choiceSelected : styles.choiceUnselected
                            ]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="finger-print" size={16} color={searchType === 'number' ? '#060d21' : '#64748b'} />
                            <Text style={[styles.choiceLabelHorizontal, searchType === 'number' ? styles.textSelected : styles.textUnselected]}>
                                BVN Number Verification
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setSearchType('phone')}
                            style={[
                                styles.choiceCellHorizontal,
                                searchType === 'phone' ? styles.choiceSelected : styles.choiceUnselected
                            ]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="call-outline" size={16} color={searchType === 'phone' ? '#060d21' : '#64748b'} />
                            <Text style={[styles.choiceLabelHorizontal, searchType === 'phone' ? styles.textSelected : styles.textUnselected]}>
                                Phone Number
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setSearchType('card')}
                            style={[
                                styles.choiceCellHorizontal,
                                searchType === 'card' ? styles.choiceSelected : styles.choiceUnselected
                            ]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="card-outline" size={16} color={searchType === 'card' ? '#060d21' : '#64748b'} />
                            <Text style={[styles.choiceLabelHorizontal, searchType === 'card' ? styles.textSelected : styles.textUnselected]}>
                                BVN Card Verification
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* 2. DETAILS NEEDED / SLIP LAYOUT */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>{searchType === 'card' ? 'SLIP LAYOUT' : 'DETAILS NEEDED'}</Text>
                    </View>

                    {searchType === 'card' ? (
                        <View style={[styles.choiceGrid, { justifyContent: 'center' }]}>
                            <TouchableOpacity 
                                style={[styles.choiceCell, styles.choiceSelected, { width: '50%', minHeight: 130 }]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.choicePrice, styles.textSelected]}>
                                    ₦{prices.bvn_card.toFixed(2)}
                                </Text>
                                <View style={styles.slipImageBox}>
                                    <Image source={require('../../assets/images/sample_image.jpg')} style={styles.slipPreviewImage as any} resizeMode="contain" />
                                </View>
                                <Text style={[styles.choiceLabel, styles.textSelected]}>
                                    BVN Card
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.choiceGrid}>
                            <TouchableOpacity 
                                onPress={() => setDetailsNeeded('basic')}
                                style={[
                                    styles.choiceCell,
                                    detailsNeeded === 'basic' ? styles.choiceSelected : styles.choiceUnselected
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.choicePrice, detailsNeeded === 'basic' ? styles.textSelected : styles.textUnselected]}>
                                    ₦{(searchType === 'phone' ? prices.bvn_phone_basic : prices.bvn_num_basic).toFixed(2)}
                                </Text>
                                <Text style={[styles.choiceLabel, detailsNeeded === 'basic' ? styles.textSelected : styles.textUnselected]}>
                                    Basic Details
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setDetailsNeeded('advanced')}
                                style={[
                                    styles.choiceCell,
                                    detailsNeeded === 'advanced' ? styles.choiceSelected : styles.choiceUnselected
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.choicePrice, detailsNeeded === 'advanced' ? styles.textSelected : styles.textUnselected]}>
                                    ₦{(searchType === 'phone' ? prices.bvn_phone_advanced : prices.bvn_num_advanced).toFixed(2)}
                                </Text>
                                <Text style={[styles.choiceLabel, detailsNeeded === 'advanced' ? styles.textSelected : styles.textUnselected]}>
                                    Advanced Details
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* 3. SUPPLY INPUT NUMBER */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>3</Text>
                        </View>
                        <Text style={styles.cardTitle}>
                            {searchType === 'phone' ? 'SUPPLY PHONE NUMBER' : 'SUPPLY BVN NUMBER'}
                        </Text>
                    </View>

                    {/* Blue Info Dial Box (Only for BVN verification) */}
                    {searchType !== 'phone' && (
                        <View style={styles.infoDialBox}>
                            <Ionicons name="information-circle" size={16} color="#0284c7" style={{ marginRight: 8, marginTop: 1 }} />
                            <Text style={styles.infoDialText}>
                                Dial <Text style={{ fontWeight: '800' }}>*565*0#</Text> from your registered phone number to get your BVN.
                            </Text>
                        </View>
                    )}

                    <View style={{ marginBottom: 12, marginTop: searchType === 'phone' ? 0 : 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons 
                                name={searchType === 'phone' ? 'call-outline' : 'finger-print-outline'} 
                                size={14} 
                                color="#64748b" 
                                style={{ marginRight: 6 }} 
                            />
                            <Text style={styles.labelHeader}>
                                {searchType === 'phone' ? 'Phone Number' : 'BVN Number'}
                            </Text>
                        </View>
                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder={searchType === 'phone' ? '08012345678' : '22000000000'}
                                placeholderTextColor="#cbd5e1"
                                style={styles.inputStyleCentered}
                                value={inputValue} 
                                onChangeText={setInputValue} 
                                keyboardType="number-pad"
                                maxLength={11}
                                editable={!loading}
                            />
                        </View>
                        <Text style={styles.inputHelperText}>
                            {searchType === 'phone' 
                                ? 'Enter the 11-digit phone number linked to the BVN.'
                                : "We'll never share your details with anyone else."}
                        </Text>
                    </View>

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
                            By checking this box, you agree that the owner of the ID has granted you consent to verify his/her identity.
                        </Text>
                    </TouchableOpacity>

                    {/* Submit Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || inputValue.trim().length !== 11 || !isAgreed} 
                        style={[
                            styles.verifyButton,
                            (loading || inputValue.trim().length !== 11 || !isAgreed) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="finger-print" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.verifyButtonText}>Verify</Text>
                    </TouchableOpacity>
                </View>

                {/* 4. RECENT VERIFICATIONS */}
                <View style={{ marginTop: 40, marginBottom: 40, marginHorizontal: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e293b' }}>HISTORY</Text>
                        <TouchableOpacity onPress={() => router.push('/bvn-history')}>
                            <Text style={{ color: '#d97706', fontSize: 13, fontWeight: '700' }}>View all &gt;</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: '100%', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
                            {/* Table Header */}
                            <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                                <Text style={[styles.tableHeader, { width: 70 }]}>ACTION</Text>
                                <Text style={[styles.tableHeader, { width: 70 }]}>AVATAR</Text>
                                <Text style={[styles.tableHeader, { flex: 2, minWidth: 120 }]}>NAME</Text>
                                <Text style={[styles.tableHeader, { flex: 1.5, minWidth: 100 }]}>NUMBER</Text>
                                <Text style={[styles.tableHeader, { flex: 1, minWidth: 80 }]}>STATUS</Text>
                                <Text style={[styles.tableHeader, { flex: 1, minWidth: 70 }]}>TYPE</Text>
                                <Text style={[styles.tableHeader, { flex: 1.5, minWidth: 90 }]}>DATE</Text>
                                <Text style={[styles.tableHeader, { width: 60, textAlign: 'center' }]}>DELETE</Text>
                            </View>

                            {/* Table Body */}
                            {historyList.length === 0 ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '500' }}>No recent records yet.</Text>
                                </View>
                            ) : (
                                <View>
                                    {historyList.map((item, idx) => {
                                        const recordName = [item.data?.firstName || item.data?.first_name, item.data?.lastName || item.data?.last_name].filter(Boolean).join(' ') || item.data?.name || 'RECORD';
                                        const recordTarget = item.target || '—';
                                        const photoUrl = getPhotoUrl(item.data);
                                        return (
                                            <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: idx === historyList.length - 1 ? 0 : 1, borderColor: '#f1f5f9', alignItems: 'center' }}>
                                                <View style={{ width: 70 }}>
                                                    <TouchableOpacity onPress={() => setResult(item.data)} style={{ backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                        <Text style={{ color: '#0284c7', fontSize: 10, fontWeight: '800' }}>VIEW</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={{ width: 70 }}>
                                                    <Image source={{ uri: photoUrl }} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#cbd5e1' }} />
                                                </View>
                                                <Text style={{ flex: 2, minWidth: 120, fontSize: 12, fontWeight: '700', color: '#1e293b' }} numberOfLines={1}>{recordName}</Text>
                                                <Text style={{ flex: 1.5, minWidth: 100, fontSize: 12, color: '#475569', fontWeight: '600' }}>{recordTarget}</Text>
                                                <View style={{ flex: 1, minWidth: 80 }}>
                                                    <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                        <Text style={{ color: '#10b981', fontSize: 9, fontWeight: '800' }}>DONE</Text>
                                                    </View>
                                                </View>
                                                <Text style={{ flex: 1, minWidth: 70, fontSize: 11, color: '#64748b', fontWeight: '700' }}>{(item.slip || 'BASIC').toUpperCase()}</Text>
                                                <Text style={{ flex: 1.5, minWidth: 90, fontSize: 11, color: '#64748b' }}>{new Date(item.date).toLocaleDateString()}</Text>
                                                <View style={{ width: 60, alignItems: 'center' }}>
                                                    <TouchableOpacity onPress={() => deleteHistoryItem(item.id)} style={{ padding: 4 }}>
                                                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6fb',
    },
    scrollContent: {
        paddingBottom: 80,
    },
    walletBar: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 10,
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
        borderColor: '#e2e8f0',
        marginHorizontal: 4,
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletLabel: {
        fontSize: 8.5,
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    walletVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#060d21',
        marginTop: 1,
    },
    fundBtn: {
        backgroundColor: '#060d21',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fundBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 10.5,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginHorizontal: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepBadge: {
        backgroundColor: '#060d21',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    stepBadgeText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 10,
    },
    cardTitle: {
        color: '#334155',
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    choiceGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    choiceCellHorizontal: {
        borderRadius: 12,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        flexDirection: 'row',
        paddingHorizontal: 10,
        width: '32.5%',
    },
    choiceCell: {
        borderRadius: 16,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '48.5%',
        minHeight: 72,
    },
    choiceSelected: {
        backgroundColor: '#ffffff',
        borderColor: '#060d21',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    choiceUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    choicePrice: {
        fontSize: 11,
        fontWeight: '900',
        marginBottom: 4,
    },
    choiceLabelHorizontal: {
        fontSize: 8,
        fontWeight: '800',
        marginLeft: 4,
        textAlign: 'center',
    },
    choiceLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        textAlign: 'center',
    },
    textSelected: {
        color: '#060d21',
    },
    textUnselected: {
        color: '#64748b',
    },
    slipImageBox: {
        width: '95%',
        height: 56,
        marginBottom: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slipPreviewImage: {
        width: '100%',
        height: '100%',
    },
    infoDialBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 12,
        padding: 10,
    },
    infoDialText: {
        color: '#0284c7',
        fontSize: 10.5,
        fontWeight: '600',
        flex: 1,
        lineHeight: 16,
    },
    labelHeader: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '800',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 48,
        marginBottom: 8,
    },
    inputStyleCentered: {
        flex: 1,
        color: '#0d1b3e',
        fontWeight: '700',
        fontSize: 16,
        textAlign: 'center',
        letterSpacing: 2,
    },
    inputHelperText: {
        color: '#94a3b8',
        fontSize: 10.5,
        marginTop: 4,
        fontWeight: '600',
    },
    consentContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        marginBottom: 16,
        paddingHorizontal: 4,
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    consentText: {
        color: '#475569',
        fontSize: 10,
        flex: 1,
        fontWeight: '600',
        lineHeight: 16,
    },
    checkboxBox: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        marginTop: 1,
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
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    verifyButtonActive: {
        backgroundColor: '#060d21',
    },
    verifyButtonDisabled: {
        backgroundColor: '#cbd5e1',
        shadowOpacity: 0,
        elevation: 0,
    },
    verifyButtonText: {
        fontWeight: '900',
        color: '#ffffff',
        fontSize: 14,
        letterSpacing: 0.5,
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
    idPreviewCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 5,
    },
    cardWatermarkGrid: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.05,
        borderWidth: 1,
        borderColor: '#ffffff',
    },
    cardLogoText: {
        color: '#f5a623',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    cardPortraitBox: {
        width: 80,
        height: 96,
        borderRadius: 12,
        backgroundColor: '#334155',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#475569',
    },
    cardPortrait: {
        width: '100%',
        height: '100%',
    },
    cardFieldLabel: {
        fontSize: 8,
        color: '#64748b',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardFieldVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#ffffff',
        marginTop: 1,
        letterSpacing: 0.2,
    },
    cardBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#334155',
        paddingTop: 12,
    },
    detailsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    detailsSectionTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#060d21',
        marginBottom: 16,
        letterSpacing: 0.8,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    detailsLabel: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '800',
        width: '40%',
    },
    detailsValue: {
        fontSize: 11,
        color: '#0f172a',
        fontWeight: '700',
        textAlign: 'right',
        width: '58%',
    },
    actionBtn: {
        backgroundColor: '#060d21',
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 12,
    },
    actionBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 13.5,
        letterSpacing: 0.5,
    },
    tableHeader: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
    },
});
