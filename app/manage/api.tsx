import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function APIVaultScreen() {
    const [vtuVendor, setVtuVendor] = useState('bilalsadasub,bigi,clubkonnect');
    const [agentHubApiKey, setAgentHubApiKey] = useState('');
    const [bilalToken, setBilalToken] = useState('');
    const [bigiToken, setBigiToken] = useState('');
    const [bigiPin, setBigiPin] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchApiVaultData();
    }, []);

    const fetchApiVaultData = async () => {
        try {
            // Fetch vtu_vendor setting
            const { data: settings } = await supabase.from('app_settings').select('*').eq('key', 'vtu_vendor').single();
            if (settings) {
                setVtuVendor(settings.value || 'bilalsadasub,bigi,clubkonnect');
            }

            // Fetch secrets
            const { data: secrets } = await supabase.from('system_secrets').select('*');
            if (secrets) {
                secrets.forEach((s) => {
                    if (s.key === 'AGENTHUB_API_KEY') setAgentHubApiKey(s.value);
                    if (s.key === 'BILALSADASUB_TOKEN') setBilalToken(s.value);
                    if (s.key === 'BIGI_API_TOKEN') setBigiToken(s.value);
                    if (s.key === 'BIGI_API_PIN') setBigiPin(s.value);
                });
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const isVendorSelected = (vendorKey: string) => {
        if (!vtuVendor) return vendorKey === 'clubkonnect';
        if (vtuVendor === 'auto') return true;
        return vtuVendor.split(',').map(v => v.trim()).includes(vendorKey);
    };

    const toggleVendorSelect = (vendorKey: string) => {
        let list = vtuVendor ? vtuVendor.split(',').map(v => v.trim()) : ['bilalsadasub', 'bigi', 'clubkonnect'];
        if (list.includes(vendorKey)) {
            if (list.length > 1) {
                list = list.filter(v => v !== vendorKey);
            } else {
                Alert.alert("Notice", "You must keep at least 1 API provider active.");
                return;
            }
        } else {
            list.push(vendorKey);
        }
        setVtuVendor(list.join(','));
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

            // Save secrets
            const secretsToSave = [
                { key: 'AGENTHUB_API_KEY', value: agentHubApiKey, description: 'AgentHub API Key (agenthub.ng for NIN/BVN & Slips)' },
                { key: 'BILALSADASUB_TOKEN', value: bilalToken, description: 'Bilalsadasub API Token (bilalsadasub.com for Telecom)' },
                { key: 'BIGI_API_TOKEN', value: bigiToken, description: 'Bigi API Token for VTU Services' },
                { key: 'BIGI_API_PIN', value: bigiPin, description: 'Bigi 4-digit Transaction PIN' }
            ];

            for (const sec of secretsToSave) {
                if (sec.value && sec.value.trim() !== '') {
                    await supabase.from('system_secrets').upsert({
                        key: sec.key,
                        value: sec.value.trim(),
                        description: sec.description,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            Alert.alert("Success", "API Vault credentials & Multi-API settings saved successfully!");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save API Vault settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator color="#3b82f6" size="large" />
                <Text className="text-slate-400 mt-3 text-xs">Loading API Vault...</Text>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-slate-950 p-4">
            <Stack.Screen options={{
                title: 'API Vault & Multi-Routing',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            {/* Title Banner */}
            <View className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-6">
                <View className="flex-row items-center gap-2 mb-1">
                    <Ionicons name="key" size={20} color="#3b82f6" />
                    <Text className="text-white font-extrabold text-base">API Vault & Provider Routing</Text>
                </View>
                <Text className="text-slate-400 text-xs leading-5">
                    Manage AgentHub, Bilalsadasub, Bigi, and ClubKonnect API credentials. Select multiple active APIs for automatic failover.
                </Text>
            </View>

            {/* 1. Multi-API Vendor Selection */}
            <View className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-6">
                <Text className="text-blue-400 font-extrabold text-sm mb-1">⚡ Multi-API Provider Selection (Zabi API Biyu ko Ukku)</Text>
                <Text className="text-slate-400 text-xs mb-4">
                    Check all APIs you want active. Your system will automatically route and failover between checked APIs for 99.9% uptime!
                </Text>

                <View className="gap-3">
                    {[
                        { id: 'bilalsadasub', name: 'Bilalsadasub API (bilalsadasub.com)', desc: 'Data, Airtime, Cable, Bills & Telecom' },
                        { id: 'bigi', name: 'Bigi API (bigisub.ng)', desc: 'SME & Gifting Data Provider' },
                        { id: 'clubkonnect', name: 'ClubKonnect API (nellobytesystems.com)', desc: 'Fallback VTU & Bill Payments' }
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

            {/* 2. Identity Verification API (AgentHub) */}
            <View className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                    <Ionicons name="finger-print" size={18} color="#10b981" />
                    <Text className="text-emerald-400 font-extrabold text-sm">🆔 AgentHub Identity API (agenthub.ng)</Text>
                </View>
                <Text className="text-slate-400 text-xs mb-3">
                    Used for NIN Verification, BVN Lookup, and VNIN Slip Generation.
                </Text>
                
                <Text className="text-slate-300 font-bold text-xs mb-1">AgentHub API Key (Bearer Token)</Text>
                <TextInput
                    value={agentHubApiKey}
                    onChangeText={setAgentHubApiKey}
                    placeholder="Enter AgentHub API Key..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-2"
                />
            </View>

            {/* 3. Bilalsadasub Telecom API */}
            <View className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                    <Ionicons name="phone-portrait" size={18} color="#f59e0b" />
                    <Text className="text-amber-400 font-extrabold text-sm">📶 Bilalsadasub Telecom API (bilalsadasub.com)</Text>
                </View>
                <Text className="text-slate-400 text-xs mb-3">
                    Used for automated Airtime, Data, and VTU recharges.
                </Text>

                <Text className="text-slate-300 font-bold text-xs mb-1">Bilalsadasub API Token</Text>
                <TextInput
                    value={bilalToken}
                    onChangeText={setBilalToken}
                    placeholder="Enter Bilalsadasub API Token..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-2"
                />
            </View>

            {/* 4. Bigi API Credentials */}
            <View className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                    <Ionicons name="flash" size={18} color="#ec4899" />
                    <Text className="text-pink-400 font-extrabold text-sm">⚡ Bigi API Credentials (bigisub.ng)</Text>
                </View>

                <Text className="text-slate-300 font-bold text-xs mb-1">Bigi API Token</Text>
                <TextInput
                    value={bigiToken}
                    onChangeText={setBigiToken}
                    placeholder="Enter Bigi Token..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono mb-3"
                />

                <Text className="text-slate-300 font-bold text-xs mb-1">Bigi Transaction PIN</Text>
                <TextInput
                    value={bigiPin}
                    onChangeText={setBigiPin}
                    placeholder="Enter 4-digit PIN..."
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    keyboardType="number-pad"
                    className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-mono"
                />
            </View>

            {/* Save Button */}
            <TouchableOpacity
                onPress={handleSaveVault}
                disabled={saving}
                className="bg-blue-600 p-4 rounded-xl items-center justify-center flex-row gap-2 mb-10"
                activeOpacity={0.8}
            >
                {saving ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <>
                        <Ionicons name="checkmark-circle" size={20} color="white" />
                        <Text className="text-white font-extrabold text-sm">Save All API Vault Settings</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}
