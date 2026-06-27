import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import BouncyCheckbox from "react-native-bouncy-checkbox";
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

// Slip Components
import { IDCardMockup } from '../../components/IDCardMockup';
import { StandardSlip } from '../../components/StandardSlip';
import { RegularSlip } from '../../components/RegularSlip';
import { InformationSlip } from '../../components/InformationSlip';

// Simulated API Call
const API_URL = "https://idpro.ng/api/v1/nin";
const API_TOKEN = "lv_PhNuAXoBZhcsmsj5nLgh3r0WC6Raph6x"; 

const SLIP_LAYOUTS = [
    { id: 'premium', name: 'Premium', price: 200, type: 'prem', color: 'bg-emerald-500', icon: 'card' },
    { id: 'standard', name: 'Standard', price: 200, type: 'nonprem', color: 'bg-slate-700', icon: 'finger-print' },
    { id: 'regular', name: 'Regular', price: 180, type: 'nonprem', color: 'bg-indigo-500', icon: 'document-text' },
    { id: 'info', name: 'Information', price: 200, type: 'nonprem', color: 'bg-blue-500', icon: 'list' },
];

export default function VerifyNINScreen() {
    const [searchType, setSearchType] = useState('nin');
    const [selectedLayout, setSelectedLayout] = useState('premium');
    const [nin, setNin] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (nin.length !== 11) {
            return Alert.alert('Error', 'Please enter a valid 11-digit NIN');
        }
        if (!consent) {
            return Alert.alert('Consent Required', 'You must agree that the owner of the ID has granted you consent.');
        }

        const layoutConfig = SLIP_LAYOUTS.find(l => l.id === selectedLayout) || SLIP_LAYOUTS[0];

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
                <LinearGradient colors={['#060d21', '#0B163A']} className="pt-6 pb-12 px-6 rounded-b-[40px] shadow-sm items-center">
                    <View className="w-20 h-20 bg-emerald-500/20 rounded-full items-center justify-center mb-4">
                        <Ionicons name="checkmark-done" size={40} color="#34d399" />
                    </View>
                    <Text className="text-white font-black text-2xl mb-1 tracking-tight">Verified Successfully</Text>
                    <Text className="text-slate-300 text-sm font-medium">{result.data.firstname} {result.data.surname}</Text>
                </LinearGradient>

                <ScrollView className="flex-1 px-4 -mt-6" contentContainerStyle={{ paddingBottom: 100 }}>
                    <View className="mb-6 items-center w-full bg-white rounded-3xl p-4 shadow-xl shadow-slate-200/50">
                        <View className="bg-slate-100 rounded-full px-4 py-1.5 mb-4">
                            <Text className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">{selectedLayout} Slip Generated</Text>
                        </View>
                        {renderSlip()}
                    </View>

                    <TouchableOpacity onPress={() => setResult(null)} className="bg-[#060d21] h-14 rounded-2xl items-center justify-center shadow-lg shadow-[#060d21]/30 flex-row">
                        <Ionicons name="refresh" size={20} color="white" className="mr-2" />
                        <Text className="text-white font-bold text-lg ml-2">Verify Another ID</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
            <StatusBar style="light" />

            <LinearGradient colors={['#060d21', '#0B163A']} className="pt-4 pb-16 px-6">
                <Text className="text-white text-2xl font-black tracking-tight mb-1">Verify Identity</Text>
                <Text className="text-slate-400 text-xs font-medium">Select a search type and layout to begin.</Text>
            </LinearGradient>

            <ScrollView className="flex-1 px-4 -mt-10" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* 1. SEARCH TYPE */}
                <View className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 mb-4 border border-slate-100/50">
                    <View className="flex-row items-center mb-4">
                        <View className="bg-[#f5a623] w-7 h-7 rounded-full flex-row items-center justify-center mr-3">
                            <Text className="text-[#060d21] font-black text-xs">1</Text>
                        </View>
                        <Text className="text-slate-800 font-bold text-sm tracking-wider">Search Method</Text>
                    </View>
                    <View className="flex-row justify-between">
                        {['nin', 'phone', 'demo'].map((type) => {
                            const isSelected = searchType === type;
                            const labels: Record<string, string> = { nin: 'NIN Number', phone: 'Phone No.', demo: 'Demographic' };
                            const icons: Record<string, any> = { nin: 'id-card', phone: 'phone-portrait', demo: 'search' };
                            return (
                                <TouchableOpacity 
                                    key={type}
                                    onPress={() => setSearchType(type)}
                                    className={`flex-1 rounded-2xl p-3 items-center justify-center border-2 mx-1 ${isSelected ? 'border-[#060d21] bg-slate-50' : 'border-slate-100 bg-white'}`}
                                >
                                    <Ionicons name={icons[type]} size={22} color={isSelected ? '#060d21' : '#94a3b8'} className="mb-2" />
                                    <Text className={`text-[10px] font-bold text-center ${isSelected ? 'text-[#060d21]' : 'text-slate-400'}`}>{labels[type]}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 2. SLIP LAYOUT */}
                <View className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 mb-4 border border-slate-100/50">
                    <View className="flex-row items-center mb-4">
                        <View className="bg-[#f5a623] w-7 h-7 rounded-full flex-row items-center justify-center mr-3">
                            <Text className="text-[#060d21] font-black text-xs">2</Text>
                        </View>
                        <Text className="text-slate-800 font-bold text-sm tracking-wider">Slip Layout</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2">
                        {SLIP_LAYOUTS.map((layout) => {
                            const isSelected = selectedLayout === layout.id;
                            return (
                                <TouchableOpacity
                                    key={layout.id}
                                    onPress={() => setSelectedLayout(layout.id)}
                                    className={`rounded-2xl p-4 mr-3 items-center justify-center w-28 overflow-hidden ${isSelected ? 'bg-[#060d21] shadow-md shadow-[#060d21]/30' : 'bg-slate-50 border border-slate-100'}`}
                                >
                                    <View className={`w-10 h-10 rounded-full items-center justify-center mb-3 ${isSelected ? 'bg-white/10' : 'bg-slate-200'}`}>
                                        <Ionicons name={layout.icon as any} size={18} color={isSelected ? '#f5a623' : '#64748b'} />
                                    </View>
                                    <Text className={`text-[11px] font-black tracking-wider mb-1 ${isSelected ? 'text-white' : 'text-slate-600'}`}>{layout.name}</Text>
                                    <Text className={`text-[10px] font-bold ${isSelected ? 'text-[#f5a623]' : 'text-slate-400'}`}>₦{layout.price}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>
                </View>

                {/* 3. SUPPLY ID & VERIFY */}
                <View className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100/50">
                    <View className="flex-row items-center mb-5">
                        <View className="bg-[#f5a623] w-7 h-7 rounded-full flex-row items-center justify-center mr-3">
                            <Text className="text-[#060d21] font-black text-xs">3</Text>
                        </View>
                        <Text className="text-slate-800 font-bold text-sm tracking-wider">Enter Details</Text>
                    </View>
                    
                    <View className="mb-5">
                        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 h-16">
                            <Ionicons name="keypad" size={20} color="#94a3b8" />
                            <TextInput
                                placeholder="Enter 11-Digit NIN"
                                placeholderTextColor="#94a3b8"
                                className="flex-1 ml-3 text-slate-800 font-bold text-lg tracking-widest"
                                keyboardType="number-pad" 
                                maxLength={11} 
                                value={nin} 
                                onChangeText={setNin} 
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Consent Checkbox */}
                    <View className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 mb-6 flex-row items-center">
                        <BouncyCheckbox
                            size={22}
                            fillColor="#059669"
                            unFillColor="#FFFFFF"
                            iconStyle={{ borderColor: "#10b981", borderRadius: 6 }}
                            innerIconStyle={{ borderWidth: 2, borderRadius: 6 }}
                            onPress={(isChecked: boolean) => { setConsent(isChecked) }}
                        />
                        <Text className="text-slate-600 text-[10px] flex-1 ml-2 leading-4 font-medium">
                            I confirm that the owner of this identity has granted consent for this verification.
                        </Text>
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || nin.length !== 11} 
                        className={`h-16 rounded-2xl items-center justify-center flex-row shadow-lg ${(loading || nin.length !== 11) ? 'bg-[#060d21]/50 shadow-none' : 'bg-[#060d21] shadow-[#060d21]/30'}`}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" /> : (
                            <>
                                <Text className="font-black text-white text-lg tracking-wide mr-2">VERIFY IDENTITY</Text>
                                <Ionicons name="arrow-forward-circle" size={24} color="#f5a623" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}
