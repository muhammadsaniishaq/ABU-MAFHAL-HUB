import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal } from 'react-native';
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
    { id: 'premium', db_id: 'nin_premium', name: 'Premium', price: 200, type: 'prem', image: require('../../assets/images/premium.png') },
    { id: 'standard', db_id: 'nin_standard', name: 'Standard', price: 200, type: 'nonprem', image: require('../../assets/images/standard.png') },
    { id: 'regular', db_id: 'nin_regular', name: 'Regular', price: 180, type: 'nonprem', image: require('../../assets/images/regular.png') },
    { id: 'info', db_id: 'nin_info', name: 'Information', price: 200, type: 'nonprem', image: require('../../assets/images/info.png') },
];

export default function VerifyNINScreen() {
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
            
            const updated = [newItem, ...historyList.filter(item => item.nin !== newItem.nin)].slice(0, 50);
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
                    Alert.alert("Error", "Sharing is not available on this device.");
                }
            }
        } catch (e: any) {
            Alert.alert("Error", "Failed to download PNG: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!viewShotRef.current) return;
        setIsSaving(true);
        try {
            const uri = await viewShotRef.current.capture();
            
            let dataUri = uri;
            if (Platform.OS !== 'web') {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                dataUri = `data:image/png;base64,${base64}`;
            }

            const html = `
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
                        .card-front {
                            width: 450px;
                            height: 284px;
                            border: 1px dashed #ccc;
                            border-radius: 8px;
                            overflow: hidden;
                            margin-bottom: 15px;
                        }
                        .card-back {
                            width: 450px;
                            height: 284px;
                            border: 1px dashed #000;
                            border-radius: 8px;
                            padding: 20px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            background-color: white;
                            transform: rotate(180deg);
                        }
                        .disclaimer-title {
                            margin: 0 0 6px 0;
                            font-size: 12px;
                            font-weight: bold;
                            color: #000;
                            text-align: center;
                            letter-spacing: 0.5px;
                        }
                        .disclaimer-text {
                            margin: 0;
                            font-size: 9px;
                            color: #333;
                            line-height: 1.3;
                            text-align: center;
                        }
                        .caution-title {
                            margin: 0 0 6px 0;
                            font-size: 12px;
                            font-weight: bold;
                            color: #d32f2f;
                            text-align: center;
                            letter-spacing: 0.5px;
                        }
                        .caution-text {
                            margin: 0;
                            font-size: 9px;
                            color: #333;
                            line-height: 1.3;
                            text-align: center;
                        }
                        .footer-text {
                            text-align: center;
                            font-style: italic;
                            font-size: 9px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="header-text">
                            <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">You may cut it out of the paper, fold and laminate as desired.</p>
                        </div>
                        
                        <div class="card-front">
                            <img src="${dataUri}" style="width: 100%; height: 100%; object-fit: cover;" />
                        </div>
                        
                        <div class="card-back">
                            <div>
                                <h2 class="disclaimer-title">DISCLAIMER</h2>
                                <p class="disclaimer-text">
                                    Kindly ensure each time this ID is presented, that you verify the credentials using a Government-APPROVED verification resource.<br/>
                                    The details on the front of this NIN Slip must EXACTLY match the verification result.
                                </p>
                            </div>
                            
                            <div>
                                <h2 class="caution-title">CAUTION!</h2>
                                <p class="caution-text">
                                    If this NIN was not issued to the person on the front of this document, please DO NOT attempt to scan, photocopy or replicate the personal data contained herein.<br/>
                                    You are only permitted to scan the barcode for the purpose of identity verification.<br/>
                                    The FEDERAL GOVERNMENT of NIGERIA assumes no responsibility if you accept any variance in the scan result or do not scan the 2D barcode overleaf.
                                </p>
                            </div>
                            
                            <div class="footer-text">
                                Trust, but verify
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

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
                    Alert.alert("Error", "Sharing is not available on this device.");
                }
            }
        } catch (e: any) {
            Alert.alert("Error", "Failed to download PDF: " + e.message);
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
            return Alert.alert('NIN Invalid', 'Please enter a valid 11-digit NIN number.');
        }
        if (!consent) {
            return Alert.alert('Consent Required', 'You must tick the consent checkbox before verifying.');
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
                if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
                    Alert.alert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.');
                } else if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('auth')) {
                    Alert.alert('Session Expired', 'Please log out and log in again, then retry.');
                } else {
                    Alert.alert('Verification Failed', msg);
                }
            }
        } catch (e: any) {
            Alert.alert('Network Error', e.message || 'A network error occurred. Please check your connection and try again.');
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
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: 16, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center' }}>
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

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
            <StatusBar style="light" />

            <LinearGradient colors={['#060d21', '#0B163A']} className="pt-2 pb-10 px-4 rounded-b-[24px]">
                <Text className="text-white text-xl font-black tracking-tight">Verify Identity</Text>
            </LinearGradient>

            <ScrollView className="flex-1 px-3 -mt-6" contentContainerStyle={{ paddingBottom: 80 }}>
                {/* 1. SLIP LAYOUT */}
                <View className="bg-white rounded-2xl p-3 shadow-sm mb-3 border border-slate-100">
                    <View className="flex-row items-center mb-2">
                        <View className="bg-[#f5a623] w-5 h-5 rounded-full items-center justify-center mr-2">
                            <Text className="text-[#060d21] font-black text-[10px]">1</Text>
                        </View>
                        <Text className="text-slate-800 font-bold text-xs tracking-wider">Slip Layout</Text>
                    </View>
                    <View className="flex-row justify-between w-full">
                        {layouts.map((layout) => {
                            const isSelected = selectedLayout === layout.id;
                            
                            return (
                                <TouchableOpacity
                                    key={layout.id}
                                    onPress={() => setSelectedLayout(layout.id)}
                                    className={`rounded-xl p-1 mb-2 items-center justify-center ${isSelected ? 'bg-[#060d21] border-[#060d21]' : 'bg-slate-50 border-slate-200'} border`}
                                    style={{ width: '23%', minHeight: 85 }}
                                >
                                    <View className="w-full h-10 mb-1 bg-white rounded items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                                        {(layout as any).image && (
                                            <Image 
                                                source={(layout as any).image} 
                                                style={{ width: '90%', height: '90%' }}
                                                resizeMode="contain" 
                                            />
                                        )}
                                    </View>
                                    <Text className={`text-[9px] font-extrabold mb-0.5 text-center leading-tight ${isSelected ? 'text-white' : 'text-slate-700'}`} numberOfLines={2}>{layout.name}</Text>
                                    <Text className={`text-[9px] font-black text-center ${isSelected ? 'text-[#f5a623]' : 'text-slate-500'}`}>₦{layout.price}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 2. SUPPLY ID & VERIFY */}
                <View className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                    <View className="flex-row items-center mb-3">
                        <View className="bg-[#f5a623] w-5 h-5 rounded-full items-center justify-center mr-2">
                            <Text className="text-[#060d21] font-black text-[10px]">2</Text>
                        </View>
                        <Text className="text-slate-800 font-bold text-xs tracking-wider">Enter Details</Text>
                    </View>
                    
                    <View className="mb-4">
                        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 h-12">
                            <Ionicons name="keypad" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="Enter 11-Digit NIN"
                                placeholderTextColor="#94a3b8"
                                className="flex-1 ml-2 text-slate-800 font-bold text-sm tracking-widest"
                                keyboardType="number-pad" 
                                maxLength={11} 
                                value={nin} 
                                onChangeText={setNin} 
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Simple Checkbox area */}
                    <View className="flex-row items-center mb-5 px-2 mt-2">
                        <BouncyCheckbox
                            size={18}
                            fillColor="#060d21"
                            unFillColor="#FFFFFF"
                            iconStyle={{ borderColor: "#cbd5e1", borderRadius: 4 }}
                            innerIconStyle={{ borderWidth: 1, borderRadius: 4 }}
                            onPress={(isChecked: boolean) => { setConsent(isChecked) }}
                        />
                        <Text className="text-slate-700 text-[10px] flex-1 font-semibold ml-2 leading-tight">
                            I confirm that I have obtained consent to verify this identity.
                        </Text>
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || nin.length !== 11 || !consent} 
                        className={`h-12 rounded-xl items-center justify-center flex-row ${loading || nin.length !== 11 || !consent ? 'bg-[#060d21]/50' : 'bg-[#060d21]'}`}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <>
                                <Text className="font-bold text-white text-sm tracking-wide">VERIFY NIN</Text>
                                {!consent && <Text className="text-white/50 text-[9px] ml-2">(tick consent first)</Text>}
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* 3. RECENT VERIFICATIONS */}
                {historyList.length > 0 && (
                    <View className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mt-3">
                        <View className="flex-row items-center mb-3">
                            <Ionicons name="time" size={16} color="#f5a623" style={{ marginRight: 6 }} />
                            <Text className="text-slate-800 font-bold text-xs tracking-wider">Recent Prints (Reprint)</Text>
                        </View>

                        <View className="divide-y divide-slate-100">
                            {historyList.map((item) => (
                                <View key={item.id} className="flex-row items-center justify-between py-2.5">
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setSelectedLayout(item.layout);
                                            setNin(item.nin);
                                            setResult({ status: 'success', data: item.data });
                                        }}
                                        className="flex-1 flex-row items-center mr-2"
                                    >
                                        <View className="bg-slate-50 w-8 h-8 rounded-lg items-center justify-center mr-3 border border-slate-100">
                                            <Ionicons name="document-text" size={16} color="#060d21" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-slate-800 font-black text-xs">{item.name}</Text>
                                            <Text className="text-slate-400 font-bold text-[10px]">NIN: {item.nin} • {item.layout.toUpperCase()}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View className="flex-row items-center">
                                        <Text className="text-slate-400 font-bold text-[9px] mr-3">{item.date.split(',')[0]}</Text>
                                        <TouchableOpacity 
                                            onPress={() => deleteHistoryItem(item.id)}
                                            className="p-1.5 rounded-lg bg-red-50"
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
