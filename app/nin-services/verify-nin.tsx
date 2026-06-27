import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import BouncyCheckbox from "react-native-bouncy-checkbox";
import { StatusBar } from 'expo-status-bar';

// Simulated API Call
const API_URL = "https://idpro.ng/api/v1/nin";
const API_TOKEN = "lv_PhNuAXoBZhcsmsj5nLgh3r0WC6Raph6x"; // We should use secure storage usually

const SLIP_LAYOUTS = [
    { id: 'premium', name: 'Premium', price: 200, type: 'prem' },
    { id: 'standard', name: 'Standard', price: 200, type: 'nonprem' },
    { id: 'regular', name: 'Regular', price: 180, type: 'nonprem' },
    { id: 'info', name: 'Information', price: 200, type: 'nonprem' },
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
            // Making real request to API
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: nin,
                    type: layoutConfig.type
                })
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

    if (result) {
        // Result Screen 
        return (
            <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
                <Stack.Screen options={{ title: 'Verification Result', headerStyle: { backgroundColor: '#050B14' }, headerTintColor: '#fff' }} />
                <View className="bg-emerald-50 p-6 rounded-3xl mb-6 items-center">
                    <Ionicons name="checkmark-circle" size={48} color="#059669" />
                    <Text className="text-emerald-800 font-bold text-lg mt-2">ID Verified Successfully</Text>
                    <Text className="text-emerald-700 text-sm">{result.data.firstname} {result.data.surname}</Text>
                </View>
                
                {/* Note: IDCardMockup needs to be updated or we can just display data here */}
                <View className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <Text className="font-bold text-slate-800 mb-4 text-lg">Details</Text>
                    <Text className="text-slate-600 mb-2">Name: <Text className="font-bold text-slate-800">{result.data.firstname} {result.data.middlename} {result.data.surname}</Text></Text>
                    <Text className="text-slate-600 mb-2">DOB: <Text className="font-bold text-slate-800">{result.data.birthdate}</Text></Text>
                    <Text className="text-slate-600 mb-2">Gender: <Text className="font-bold text-slate-800">{result.data.gender}</Text></Text>
                    <Text className="text-slate-600 mb-2">State: <Text className="font-bold text-slate-800">{result.data.residence_state}</Text></Text>
                </View>

                <TouchableOpacity onPress={() => setResult(null)} className="bg-[#050B14] h-14 rounded-xl items-center justify-center">
                    <Text className="text-white font-bold">Verify Another</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Stack.Screen options={{ title: 'NIN Verification', headerStyle: { backgroundColor: '#050B14' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />

            <View className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <Text className="text-slate-500 mb-6 text-sm">Pick a search type and slip layout, then supply the details</Text>
                
                {/* 1. SEARCH TYPE */}
                <View className="flex-row items-center mb-3">
                    <View className="bg-[#0284c7] w-6 h-6 rounded flex-row items-center justify-center mr-2">
                        <Text className="text-white font-bold text-xs">1</Text>
                    </View>
                    <Text className="text-slate-500 font-bold text-xs tracking-wider">SEARCH TYPE</Text>
                </View>
                <View className="flex-row justify-between mb-8">
                    {/* NIN Number */}
                    <TouchableOpacity 
                        onPress={() => setSearchType('nin')}
                        className={`flex-1 rounded-xl p-3 items-center justify-center border ${searchType === 'nin' ? 'border-[#0284c7] bg-[#f0f9ff]' : 'border-slate-200 bg-white'}`}
                    >
                        <Ionicons name="id-card-outline" size={24} color={searchType === 'nin' ? '#0284c7' : '#64748b'} className="mb-1" />
                        <Text className={`text-[10px] font-bold ${searchType === 'nin' ? 'text-[#0284c7]' : 'text-slate-500'}`}>NIN Number</Text>
                    </TouchableOpacity>
                    <View className="w-2" />
                    {/* Phone Number */}
                    <TouchableOpacity 
                        onPress={() => setSearchType('phone')}
                        className={`flex-1 rounded-xl p-3 items-center justify-center border ${searchType === 'phone' ? 'border-[#0284c7] bg-[#f0f9ff]' : 'border-slate-200 bg-white'}`}
                    >
                        <Ionicons name="phone-portrait-outline" size={24} color={searchType === 'phone' ? '#0284c7' : '#64748b'} className="mb-1" />
                        <Text className={`text-[10px] font-bold ${searchType === 'phone' ? 'text-[#0284c7]' : 'text-slate-500'}`}>Phone Number</Text>
                    </TouchableOpacity>
                    <View className="w-2" />
                    {/* Demographic */}
                    <TouchableOpacity 
                        onPress={() => setSearchType('demo')}
                        className={`flex-1 rounded-xl p-3 items-center justify-center border ${searchType === 'demo' ? 'border-[#0284c7] bg-[#f0f9ff]' : 'border-slate-200 bg-white'}`}
                    >
                        <Ionicons name="search-outline" size={24} color={searchType === 'demo' ? '#0284c7' : '#64748b'} className="mb-1" />
                        <Text className={`text-[10px] font-bold text-center ${searchType === 'demo' ? 'text-[#0284c7]' : 'text-slate-500'}`}>Demographic Search</Text>
                    </TouchableOpacity>
                </View>

                {/* 2. SLIP LAYOUT */}
                <View className="flex-row items-center mb-3">
                    <View className="bg-[#0284c7] w-6 h-6 rounded flex-row items-center justify-center mr-2">
                        <Text className="text-white font-bold text-xs">2</Text>
                    </View>
                    <Text className="text-slate-500 font-bold text-xs tracking-wider">SLIP LAYOUT</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                    {SLIP_LAYOUTS.map((layout) => (
                        <TouchableOpacity
                            key={layout.id}
                            onPress={() => setSelectedLayout(layout.id)}
                            className={`rounded-xl p-3 mr-3 items-center justify-center border ${selectedLayout === layout.id ? 'border-[#0284c7] bg-[#f0f9ff]' : 'border-slate-200 bg-white'}`}
                            style={{ width: 100 }}
                        >
                            <Text className="text-slate-800 font-black text-xs mb-2">₦{layout.price.toFixed(2)}</Text>
                            <View className="w-16 h-10 bg-slate-200 rounded mb-2 border border-slate-300 items-center justify-center">
                                {/* Dummy placeholder for slip image */}
                                <Ionicons name="document-text" size={16} color="#94a3b8" />
                            </View>
                            <Text className={`text-[10px] font-medium ${selectedLayout === layout.id ? 'text-[#0284c7]' : 'text-slate-500'}`}>{layout.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* 3. SUPPLY ID NUMBER */}
                <View className="flex-row items-center mb-3">
                    <View className="bg-[#0284c7] w-6 h-6 rounded flex-row items-center justify-center mr-2">
                        <Text className="text-white font-bold text-xs">3</Text>
                    </View>
                    <Text className="text-slate-500 font-bold text-xs tracking-wider">SUPPLY ID NUMBER</Text>
                </View>
                
                <View className="mb-6">
                    <Text className="text-slate-400 font-bold text-xs mb-2">NIN NUMBER</Text>
                    <TextInput
                        placeholder="###########"
                        className="border border-slate-200 rounded-xl px-4 h-14 text-slate-800 font-bold text-lg tracking-widest bg-slate-50 mb-2"
                        keyboardType="number-pad" 
                        maxLength={11} 
                        value={nin} 
                        onChangeText={setNin} 
                        editable={!loading}
                        style={{ fontFamily: 'monospace' }}
                    />
                    <Text className="text-slate-400 text-[10px]">We'll never share your details with anyone else.</Text>
                </View>

                {/* Consent Checkbox */}
                <View className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex-row items-center">
                    <BouncyCheckbox
                        size={20}
                        fillColor="#0284c7"
                        unFillColor="#FFFFFF"
                        iconStyle={{ borderColor: "#cbd5e1" }}
                        innerIconStyle={{ borderWidth: 2 }}
                        onPress={(isChecked: boolean) => { setConsent(isChecked) }}
                    />
                    <Text className="text-slate-500 text-[10px] flex-1 ml-2 leading-4">
                        By checking this box, you agree that the owner of the ID has granted you consent to verify his/her identity.
                    </Text>
                </View>

                {/* Verify Button */}
                <TouchableOpacity 
                    onPress={handleVerify} 
                    disabled={loading || nin.length !== 11} 
                    className={`h-14 rounded-xl items-center justify-center flex-row shadow-sm ${(loading || nin.length !== 11) ? 'bg-[#0284c7]/50' : 'bg-[#0284c7]'}`}
                >
                    {loading ? <ActivityIndicator color="white" /> : (
                        <>
                            <Ionicons name="finger-print" size={20} color="white" className="mr-2" />
                            <Text className="font-bold text-white text-base ml-2">Verify</Text>
                        </>
                    )}
                </TouchableOpacity>

            </View>
        </ScrollView>
    );
}
