import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function APIVaultScreen() {
    const [vtuVendor, setVtuVendor] = useState('bilalsadasub,bigi,clubkonnect');
    
    // 11 Core Active API Provider Credentials
    const [agentHubApiKey, setAgentHubApiKey] = useState('');
    const [bilalToken, setBilalToken] = useState('');
    const [paystackSecret, setPaystackSecret] = useState('');
    const [clubkonnectApiKey, setClubkonnectApiKey] = useState('');
    const [clubkonnectUserId, setClubkonnectUserId] = useState('');
    const [idProApiKey, setIdProApiKey] = useState('');
    const [payVesselApiKey, setPayVesselApiKey] = useState('');
    const [payVesselSecretKey, setPayVesselSecretKey] = useState('');
    const [nineBoostApiKey, setNineBoostApiKey] = useState('');
    const [nowPaymentsApiKey, setNowPaymentsApiKey] = useState('');
    const [bigiToken, setBigiToken] = useState('');
    const [bigiPin, setBigiPin] = useState('');
    const [termiiApiKey, setTermiiApiKey] = useState('');
    const [monnifyApiKey, setMonnifyApiKey] = useState('');
    const [monnifySecretKey, setMonnifySecretKey] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchApiVaultData();
    }, []);

    const fetchApiVaultData = async () => {
        try {
            // 1. Fetch vtu_vendor & settings
            const { data: settings } = await supabase.from('app_settings').select('*');
            if (settings) {
                settings.forEach((s) => {
                    const k = s.key.toUpperCase();
                    if (k === 'VTU_VENDOR') setVtuVendor(s.value);
                    if (k === 'AGENTHUB_API_KEY' || k === 'AGENTHUB_KEY') setAgentHubApiKey(s.value);
                    if (k === 'BILALSADASUB_TOKEN' || k === 'BILAL_TOKEN') setBilalToken(s.value);
                    if (k === 'PAYSTACK_SECRET_KEY' || k === 'PAYSTACK_KEY') setPaystackSecret(s.value);
                    if (k === 'CLUBKONNECT_API_KEY' || k === 'CLUBKONNECT_KEY') setClubkonnectApiKey(s.value);
                    if (k === 'CLUBKONNECT_USER_ID' || k === 'CLUBKONNECT_USER') setClubkonnectUserId(s.value);
                    if (k === 'IDPRO_API_KEY' || k === 'IDPRO_KEY') setIdProApiKey(s.value);
                    if (k === 'PAYVESSEL_API_KEY' || k === 'PAYVESSEL_KEY' || k === 'PAYBESSEL_API_KEY' || k === 'PAYBESSEL_KEY') setPayVesselApiKey(s.value);
                    if (k === 'PAYVESSEL_SECRET_KEY' || k === 'PAYVESSEL_SECRET') setPayVesselSecretKey(s.value);
                    if (k === 'NINEBOOST_API_KEY' || k === 'NINEBOOST_KEY') setNineBoostApiKey(s.value);
                    if (k === 'NOWPAYMENTS_API_KEY' || k === 'NOWPAYMENTS_KEY') setNowPaymentsApiKey(s.value);
                    if (k === 'BIGI_API_TOKEN' || k === 'BIGI_TOKEN') setBigiToken(s.value);
                    if (k === 'BIGI_API_PIN' || k === 'BIGI_PIN') setBigiPin(s.value);
                    if (k === 'TERMII_API_KEY' || k === 'TERMII_KEY') setTermiiApiKey(s.value);
                    if (k === 'MONNIFY_API_KEY' || k === 'MONNIFY_KEY') setMonnifyApiKey(s.value);
                    if (k === 'MONNIFY_SECRET_KEY' || k === 'MONNIFY_SECRET') setMonnifySecretKey(s.value);
                });
            }

            // 2. Fetch system secrets
            const { data: secrets } = await supabase.from('system_secrets').select('*');
            if (secrets) {
                secrets.forEach((s) => {
                    const k = s.key.toUpperCase();
                    if (k === 'AGENTHUB_API_KEY' || k === 'AGENTHUB_KEY') setAgentHubApiKey(s.value);
                    if (k === 'BILALSADASUB_TOKEN' || k === 'BILAL_TOKEN') setBilalToken(s.value);
                    if (k === 'PAYSTACK_SECRET_KEY' || k === 'PAYSTACK_KEY') setPaystackSecret(s.value);
                    if (k === 'CLUBKONNECT_API_KEY' || k === 'CLUBKONNECT_KEY') setClubkonnectApiKey(s.value);
                    if (k === 'CLUBKONNECT_USER_ID' || k === 'CLUBKONNECT_USER') setClubkonnectUserId(s.value);
                    if (k === 'IDPRO_API_KEY' || k === 'IDPRO_KEY') setIdProApiKey(s.value);
                    if (k === 'PAYVESSEL_API_KEY' || k === 'PAYVESSEL_KEY' || k === 'PAYBESSEL_API_KEY' || k === 'PAYBESSEL_KEY') setPayVesselApiKey(s.value);
                    if (k === 'PAYVESSEL_SECRET_KEY' || k === 'PAYVESSEL_SECRET') setPayVesselSecretKey(s.value);
                    if (k === 'NINEBOOST_API_KEY' || k === 'NINEBOOST_KEY') setNineBoostApiKey(s.value);
                    if (k === 'NOWPAYMENTS_API_KEY' || k === 'NOWPAYMENTS_KEY') setNowPaymentsApiKey(s.value);
                    if (k === 'BIGI_API_TOKEN' || k === 'BIGI_TOKEN') setBigiToken(s.value);
                    if (k === 'BIGI_API_PIN' || k === 'BIGI_PIN') setBigiPin(s.value);
                    if (k === 'TERMII_API_KEY' || k === 'TERMII_KEY') setTermiiApiKey(s.value);
                    if (k === 'MONNIFY_API_KEY' || k === 'MONNIFY_KEY') setMonnifyApiKey(s.value);
                    if (k === 'MONNIFY_SECRET_KEY' || k === 'MONNIFY_SECRET') setMonnifySecretKey(s.value);
                });
            }
        } catch (e: any) {
            console.error("API Vault Load Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const isVendorSelected = (vendorKey: string) => {
        return vtuVendor.split(',').map(v => v.trim().toLowerCase()).includes(vendorKey.toLowerCase());
    };

    const toggleVendorSelect = (vendorKey: string) => {
        let current = vtuVendor.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        if (current.includes(vendorKey.toLowerCase())) {
            current = current.filter(v => v !== vendorKey.toLowerCase());
        } else {
            current.push(vendorKey.toLowerCase());
        }
        setVtuVendor(current.join(','));
    };

    const handleSaveVault = async () => {
        setSaving(true);
        try {
            // Save vtu_vendor app setting
            await supabase.from('app_settings').upsert({
                key: 'vtu_vendor',
                value: vtuVendor,
                updated_at: new Date().toISOString()
            });

            // Secrets payload
            const secretsToSave = [
                { key: 'AGENTHUB_API_KEY', value: agentHubApiKey, description: 'AgentHub API Key (agenthub.ng for NIN/BVN & Slips)' },
                { key: 'BILALSADASUB_TOKEN', value: bilalToken, description: 'Bilalsadasub API Token (bilalsadasub.com for Telecom)' },
                { key: 'PAYSTACK_SECRET_KEY', value: paystackSecret, description: 'Paystack Secret Key for Payments & Transfers' },
                { key: 'CLUBKONNECT_API_KEY', value: clubkonnectApiKey, description: 'ClubKonnect API Key for Telecom & Bills' },
                { key: 'CLUBKONNECT_USER_ID', value: clubkonnectUserId, description: 'ClubKonnect Registered User ID / Phone' },
                { key: 'IDPRO_API_KEY', value: idProApiKey, description: 'IDPro API Key for Identity Verification' },
                { key: 'PAYVESSEL_API_KEY', value: payVesselApiKey, description: 'PayVessel API Key for Payment Gateway' },
                { key: 'PAYVESSEL_SECRET_KEY', value: payVesselSecretKey, description: 'PayVessel Secret Key / Signature' },
                { key: 'NINEBOOST_API_KEY', value: nineBoostApiKey, description: 'NineBoost API Key for Social Media Services' },
                { key: 'NOWPAYMENTS_API_KEY', value: nowPaymentsApiKey, description: 'NowPayments API Key for Crypto' },
                { key: 'BIGI_API_TOKEN', value: bigiToken, description: 'Bigi API Token for VTU Services' },
                { key: 'BIGI_API_PIN', value: bigiPin, description: 'Bigi 4-digit Transaction PIN' },
                { key: 'TERMII_API_KEY', value: termiiApiKey, description: 'Termii API Key for SMS Gateway' },
                { key: 'MONNIFY_API_KEY', value: monnifyApiKey, description: 'Monnify API Key for Virtual Accounts' },
                { key: 'MONNIFY_SECRET_KEY', value: monnifySecretKey, description: 'Monnify Secret Key for Wallet Disbursements' }
            ];

            for (const sec of secretsToSave) {
                if (sec.value && sec.value.trim() !== '') {
                    // Save to system_secrets table
                    await supabase.from('system_secrets').upsert({
                        key: sec.key,
                        value: sec.value.trim(),
                        description: sec.description,
                        updated_at: new Date().toISOString()
                    });

                    // Save to app_settings table as backup
                    await supabase.from('app_settings').upsert({
                        key: sec.key,
                        value: sec.value.trim(),
                        updated_at: new Date().toISOString()
                    });
                }
            }

            Alert.alert("Success 🎉", "All Active API Vault credentials saved successfully!");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save API Vault settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator color="#08E4C7" size="large" />
                <Text className="text-slate-400 mt-3 text-xs font-semibold">Loading Active API Vault Credentials...</Text>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-slate-950 p-4">
            <Stack.Screen options={{
                title: 'API Vault & Active Providers Hub',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            {/* Header Banner */}
            <View className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-6">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-white font-black text-lg">🔑 API Vault & Credentials</Text>
                    <TouchableOpacity
                        onPress={() => router.push('/manage/liquidity')}
                        className="bg-emerald-600/20 px-3 py-1.5 rounded-lg border border-emerald-500 flex-row items-center gap-1"
                    >
                        <Ionicons name="wallet-outline" size={14} color="#10b981" />
                        <Text className="text-emerald-400 font-bold text-xs">Live Balances →</Text>
                    </TouchableOpacity>
                </View>
                <Text className="text-slate-400 text-xs leading-5">
                    Manage real API credentials for AgentHub, BilalSadaSub, Paystack, Clubkonnect, IDPro, PayVessel, NineBoost, NowPayments, Bigi, Termii, and Monnify.
                </Text>
            </View>

            {/* Multi-API Failover Selector */}
            <View className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-6">
                <Text className="text-teal-400 font-extrabold text-sm mb-1">⚡ Multi-API Active Failover Selection</Text>
                <Text className="text-slate-400 text-xs mb-4">
                    Check all APIs active for automatic failover and load-balancing:
                </Text>

                <View className="gap-3">
                    {[
                        { id: 'bilalsadasub', name: 'BilalSadaSub API (bilalsadasub.com)', desc: 'Data, Airtime, Cable, Bills & Telecom' },
                        { id: 'bigi', name: 'Bigi VTU API (bigidata.com)', desc: 'SME & Gifting Data Provider' },
                        { id: 'clubkonnect', name: 'Clubkonnect API (nellobytesystems.com)', desc: 'Telecom & Utility Payments' }
                    ].map((item) => {
                        const checked = isVendorSelected(item.id);
                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => toggleVendorSelect(item.id)}
                                className={`flex-row items-center p-3.5 rounded-xl border ${checked ? 'bg-indigo-950/40 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}
                                activeOpacity={0.8}
                            >
                                <View className={`w-5 h-5 rounded border items-center justify-center mr-3 ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-slate-900'}`}>
                                    {checked && <Ionicons name="checkmark" size={14} color="white" />}
                                </View>
                                <View className="flex-1">
                                    <Text className={`font-bold text-xs ${checked ? 'text-indigo-300' : 'text-slate-300'}`}>{item.name}</Text>
                                    <Text className="text-slate-500 text-[10px]">{item.desc}</Text>
                                </View>
                                {checked && (
                                    <View className="bg-indigo-500/20 px-2 py-0.5 rounded">
                                        <Text className="text-indigo-400 font-bold text-[9px]">ACTIVE</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* 1. AgentHub API */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-emerald-400 font-extrabold text-xs mb-1">🆔 AgentHub API Key (agenthub.ng for NIN / BVN / CAC / TAX)</Text>
                <TextInput
                    value={agentHubApiKey}
                    onChangeText={setAgentHubApiKey}
                    placeholder="Enter AgentHub API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 2. BilalSadaSub API */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-amber-400 font-extrabold text-xs mb-1">📶 BilalSadaSub API Token (bilalsadasub.com for Telecom)</Text>
                <TextInput
                    value={bilalToken}
                    onChangeText={setBilalToken}
                    placeholder="Enter BilalSadaSub API Token..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 3. Paystack Secret Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-blue-400 font-extrabold text-xs mb-1">💳 Paystack Secret Key (sk_live_... for Merchant Settlements)</Text>
                <TextInput
                    value={paystackSecret}
                    onChangeText={setPaystackSecret}
                    placeholder="Enter Paystack Secret Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 4. Clubkonnect API Key & User ID */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-indigo-400 font-extrabold text-xs mb-1">🔌 Clubkonnect / NelloByte API Key & User ID</Text>
                <TextInput
                    value={clubkonnectApiKey}
                    onChangeText={setClubkonnectApiKey}
                    placeholder="Enter Clubkonnect API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-2"
                />
                <TextInput
                    value={clubkonnectUserId}
                    onChangeText={setClubkonnectUserId}
                    placeholder="Enter Clubkonnect User ID / Phone..."
                    placeholderTextColor="#64748b"
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 5. IDPro API Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-purple-400 font-extrabold text-xs mb-1">🛡️ IDPro Verification API Key</Text>
                <TextInput
                    value={idProApiKey}
                    onChangeText={setIdProApiKey}
                    placeholder="Enter IDPro API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 6. PayVessel API Key & Secret Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-cyan-400 font-extrabold text-xs mb-1">🏦 PayVessel API Key & Business Secret</Text>
                <TextInput
                    value={payVesselApiKey}
                    onChangeText={setPayVesselApiKey}
                    placeholder="Enter PayVessel API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-2"
                />
                <TextInput
                    value={payVesselSecretKey}
                    onChangeText={setPayVesselSecretKey}
                    placeholder="Enter PayVessel Secret Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 7. NineBoost API Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-pink-400 font-extrabold text-xs mb-1">🚀 NineBoost SMM Panel API Key</Text>
                <TextInput
                    value={nineBoostApiKey}
                    onChangeText={setNineBoostApiKey}
                    placeholder="Enter NineBoost API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 8. NowPayments Crypto API Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-yellow-400 font-extrabold text-xs mb-1">🪙 NowPayments Crypto Gateway Key</Text>
                <TextInput
                    value={nowPaymentsApiKey}
                    onChangeText={setNowPaymentsApiKey}
                    placeholder="Enter NowPayments API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 9. Bigi API */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-pink-400 font-extrabold text-xs mb-1">⚡ Bigi VTU Token & Transaction PIN</Text>
                <TextInput
                    value={bigiToken}
                    onChangeText={setBigiToken}
                    placeholder="Enter Bigi Token..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-2"
                />
                <TextInput
                    value={bigiPin}
                    onChangeText={setBigiPin}
                    placeholder="Enter 4-digit PIN..."
                    placeholderTextColor="#64748b"
                    keyboardType="number-pad"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 10. Termii API Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-teal-400 font-extrabold text-xs mb-1">✉️ Termii SMS Gateway API Key</Text>
                <TextInput
                    value={termiiApiKey}
                    onChangeText={setTermiiApiKey}
                    placeholder="Enter Termii API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* 11. Monnify API Key & Secret Key */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
                <Text className="text-emerald-400 font-extrabold text-xs mb-1">🏦 Monnify API Key & Secret Key</Text>
                <TextInput
                    value={monnifyApiKey}
                    onChangeText={setMonnifyApiKey}
                    placeholder="Enter Monnify API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-2"
                />
                <TextInput
                    value={monnifySecretKey}
                    onChangeText={setMonnifySecretKey}
                    placeholder="Enter Monnify Secret Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* Save Button */}
            <TouchableOpacity
                onPress={saving ? undefined : handleSaveVault}
                disabled={saving}
                className="bg-emerald-600 p-4 rounded-2xl items-center justify-center mb-12"
                activeOpacity={0.85}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <Text className="text-white font-extrabold text-sm">Save All 11 Active API Vault Credentials</Text>
                )}
            </TouchableOpacity>

        </ScrollView>
    );
}
