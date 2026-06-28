import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import BouncyCheckbox from "react-native-bouncy-checkbox";
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
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
                        body { margin: 0; padding: 20px; background-color: white; display: flex; align-items: center; justify-content: center; height: 100vh; box-sizing: border-box; }
                        img { max-width: 100%; max-height: 100%; object-fit: contain; }
                    </style>
                </head>
                <body>
                    <img src="${dataUri}" />
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

        const layoutConfig = layouts.find(l => l.id === selectedLayout) || layouts[0];

        setLoading(true);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ number: nin, type: layoutConfig.type })
            });

            const json = await response.json();
            
            if (json.status === 'success') {
                setResult(json);
            } else {
                Alert.alert('Verification Failed', json.message || 'Unable to verify NIN');
            }
        } catch (e: any) {
            Alert.alert('Network Error', e.message);
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
                <Stack.Screen options={{ title: 'Verification Result', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
                <LinearGradient colors={['#060d21', '#0B163A']} className="pt-4 pb-8 px-4 rounded-b-[30px] shadow-sm items-center">
                    <View className="w-12 h-12 bg-emerald-500/20 rounded-full items-center justify-center mb-2">
                        <Ionicons name="checkmark-done" size={24} color="#34d399" />
                    </View>
                    <Text className="text-white font-black text-lg mb-0.5 tracking-tight">Verified Successfully</Text>
                    <Text className="text-slate-300 text-xs">{result.data.firstname} {result.data.surname}</Text>
                </LinearGradient>
                <ScrollView className="flex-1 px-3 mt-4" contentContainerStyle={{ paddingBottom: 100 }}>
                    <View className="mb-4 items-center w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                        <View className="bg-slate-100 rounded-full px-3 py-1 mb-3">
                            <Text className="font-bold text-slate-500 uppercase text-[9px] tracking-widest">{selectedLayout} Slip Generated</Text>
                        </View>
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%' }}>
                            {renderSlip()}
                        </ViewShot>
                    </View>

                    {/* PNG & PDF Download Buttons */}
                    <View className="flex-row justify-between mb-4">
                        <TouchableOpacity 
                            onPress={handleDownloadPng}
                            disabled={isSaving}
                            className={`flex-1 h-12 rounded-xl items-center justify-center flex-row mr-2 shadow-sm ${isSaving ? 'bg-sky-600/50' : 'bg-sky-600'}`}
                        >
                            <Ionicons name="image" size={16} color="white" />
                            <Text className="text-white font-bold text-sm ml-2">
                                {isSaving ? 'Downloading...' : 'Download PNG'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleDownloadPdf}
                            disabled={isSaving}
                            className={`flex-1 h-12 rounded-xl items-center justify-center flex-row ml-2 shadow-sm ${isSaving ? 'bg-emerald-600/50' : 'bg-emerald-600'}`}
                        >
                            <Ionicons name="document-text" size={16} color="white" />
                            <Text className="text-white font-bold text-sm ml-2">
                                {isSaving ? 'Downloading...' : 'Download PDF'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => setResult(null)} className="bg-[#060d21] h-12 rounded-xl items-center justify-center flex-row">
                        <Ionicons name="refresh" size={16} color="white" className="mr-2" />
                        <Text className="text-white font-bold text-sm ml-1">Verify Another ID</Text>
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
