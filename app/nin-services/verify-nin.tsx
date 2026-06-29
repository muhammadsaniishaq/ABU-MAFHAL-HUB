import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
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
    const [selectedLayout, setSelectedLayout] = useState('premium');
    const [nin, setNin] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const viewShotRef = useRef<any>(null);

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
    }, []);

    const handleVerify = async () => {
        if (nin.length !== 11) {
            return Alert.alert('Error', 'Please enter a valid 11-digit NIN');
        }
        if (!consent) {
            return Alert.alert('Consent Required', 'You must agree that the owner of the ID has granted you consent.');
        }

        setLoading(true);
        try {
            const response = await api.identity.validateNIN(nin);
            
            if (response.isValid && response.data) {
                setResult({ status: 'success', data: response.data });
            } else {
                Alert.alert('Verification Failed', response.message || 'Unable to verify NIN');
            }
        } catch (e: any) {
            Alert.alert('Network Error', e.message || 'An error occurred during verification');
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
            <View className="flex-1 bg-slate-50">
                <Stack.Screen options={{ title: 'Verification Details', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
                
                {/* Header Banner */}
                <LinearGradient colors={['#060d21', '#121F42']} className="pt-6 pb-16 px-4 items-center relative">
                    <View className="flex-row items-center">
                        <Ionicons name="shield-checkmark" size={16} color="#f5a623" />
                        <Text className="text-white font-black text-sm ml-1.5 uppercase tracking-wider">Verification Details</Text>
                    </View>
                    <Text className="text-slate-300 text-[10px] tracking-widest uppercase mt-0.5">VNIN - NIN</Text>
                </LinearGradient>

                <ScrollView className="flex-1 px-4 -mt-10" contentContainerStyle={{ paddingBottom: 100 }}>
                    
                    {/* Profile & Name Card */}
                    <View className="bg-white rounded-2xl p-5 items-center shadow-sm border border-slate-100 mb-4">
                        <View className="relative w-24 h-24 -mt-16 bg-slate-200 border-4 border-white rounded-2xl shadow overflow-hidden items-center justify-center">
                            {result.data.photo || result.data.image ? (
                                <Image source={{ uri: result.data.photo || result.data.image }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Ionicons name="person" size={48} color="#cbd5e1" />
                            )}
                            {/* Small green verified badge on bottom right corner */}
                            <View className="absolute bottom-1 right-1 bg-emerald-500 w-5 h-5 rounded-full items-center justify-center border border-white">
                                <Ionicons name="checkmark" size={10} color="white" />
                            </View>
                        </View>
                        
                        <Text className="text-[#060d21] font-black text-base text-center mt-3 tracking-tight uppercase">
                            {result.data.firstname} {result.data.middlename ? `${result.data.middlename} ` : ''}{result.data.surname}
                        </Text>
                        
                        <View className="bg-emerald-50 border border-emerald-100 rounded-full px-3 py-0.5 mt-2 flex-row items-center">
                            <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                            <Text className="text-[#10b981] font-black text-[9px] uppercase tracking-widest ml-1">Verified</Text>
                        </View>
                    </View>

                    {/* Details Table */}
                    <View className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                        <View className="flex-row justify-between items-center p-3.5 border-b border-slate-100">
                            <Text className="text-slate-400 font-extrabold text-[10px] tracking-wider uppercase">Report ID</Text>
                            <Text className="text-slate-800 font-bold text-xs">
                                {result.data.trackingId || `073043-${Math.random().toString(36).substring(2, 10).toUpperCase()}`}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center p-3.5 border-b border-slate-100">
                            <Text className="text-slate-400 font-extrabold text-[10px] tracking-wider uppercase">NIN Number</Text>
                            <Text className="text-slate-800 font-bold text-xs tracking-wider">
                                {result.data.nin || result.data.number || 'N/A'}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center p-3.5 border-b border-slate-100">
                            <Text className="text-slate-400 font-extrabold text-[10px] tracking-wider uppercase">Report Type</Text>
                            <View className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                <Text className="text-blue-600 font-black text-[9px] uppercase tracking-widest">NIN</Text>
                            </View>
                        </View>

                        <View className="flex-row justify-between items-center p-3.5 border-b border-slate-100">
                            <Text className="text-slate-400 font-extrabold text-[10px] tracking-wider uppercase">Slip</Text>
                            <Text className="text-slate-800 font-black text-xs uppercase">
                                {selectedLayout}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center p-3.5">
                            <Text className="text-slate-400 font-extrabold text-[10px] tracking-wider uppercase">Date & Time</Text>
                            <Text className="text-slate-800 font-bold text-xs">
                                {(() => {
                                    const d = new Date();
                                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                })()}
                            </Text>
                        </View>
                    </View>

                    {/* Generated NIN Slip Preview */}
                    <View className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mb-4 items-center">
                        <View className="bg-slate-100 rounded-full px-3 py-1 mb-3">
                            <Text className="font-bold text-slate-500 uppercase text-[9px] tracking-widest">Generated NIN Slip Preview</Text>
                        </View>
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%' }}>
                            {renderSlip()}
                        </ViewShot>
                    </View>

                    {/* Download Slip Button */}
                    <TouchableOpacity 
                        onPress={() => setIsDownloadModalOpen(true)}
                        disabled={isSaving}
                        className={`w-full h-12 rounded-xl items-center justify-center flex-row mb-4 shadow-sm ${isSaving ? 'bg-[#f5a623]/60' : 'bg-[#f5a623]'}`}
                    >
                        <Ionicons name="download" size={16} color="#060d21" />
                        <Text className="text-[#060d21] font-black text-sm ml-2">
                            {isSaving ? 'Processing...' : 'Download Slip'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setResult(null)} className="border border-slate-200 bg-white h-12 rounded-xl items-center justify-center flex-row">
                        <Ionicons name="arrow-back" size={16} color="#475569" className="mr-2" />
                        <Text className="text-[#475569] font-bold text-sm ml-1">Verify Another ID</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Download Format Picker Modal */}
                <Modal
                    visible={isDownloadModalOpen}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setIsDownloadModalOpen(false)}
                >
                    <View className="flex-1 bg-black/50 items-center justify-center px-4">
                        <View className="bg-white rounded-[24px] p-6 w-full max-w-[300px] items-center shadow-xl">
                            
                            <Text className="text-slate-800 font-black text-base mt-2">Download slip as</Text>
                            <Text className="text-slate-400 font-bold text-xs mt-1 mb-6">Choose a format</Text>

                            <View className="flex-row justify-between w-full px-1">
                                <TouchableOpacity 
                                    onPress={async () => {
                                        setIsDownloadModalOpen(false);
                                        setTimeout(handleDownloadPdf, 400);
                                    }}
                                    className="flex-1 border border-slate-100 rounded-2xl p-4 items-center justify-center bg-slate-50/50 mr-2"
                                    style={{ aspectRatio: 1.1 }}
                                >
                                    <Ionicons name="document-text" size={32} color="#e11d48" />
                                    <Text className="text-slate-600 font-black text-xs mt-2">PDF</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={async () => {
                                        setIsDownloadModalOpen(false);
                                        setTimeout(handleDownloadPng, 400);
                                    }}
                                    className="flex-1 border border-slate-100 rounded-2xl p-4 items-center justify-center bg-slate-50/50 ml-2"
                                    style={{ aspectRatio: 1.1 }}
                                >
                                    <Ionicons name="image" size={32} color="#f5a623" />
                                    <Text className="text-slate-600 font-black text-xs mt-2">Image</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity 
                                onPress={() => setIsDownloadModalOpen(false)} 
                                className="mt-6 py-2"
                            >
                                <Text className="text-slate-400 font-bold text-sm">Cancel</Text>
                            </TouchableOpacity>

                        </View>
                    </View>
                </Modal>
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
                        disabled={loading || nin.length !== 11} 
                        className={`h-12 rounded-xl items-center justify-center flex-row ${loading || nin.length !== 11 ? 'bg-[#060d21]/50' : 'bg-[#060d21]'}`}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <Text className="font-bold text-white text-sm tracking-wide">VERIFY</Text>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}
