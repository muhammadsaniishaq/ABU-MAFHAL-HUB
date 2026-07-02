import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface SystemSecret {
    key: string;
    value: string;
    description: string;
    provider: string; 
}

const REQUIRED_SECRETS = [
    { key: 'PAYSTACK_SECRET_KEY', desc: 'Paystack Secret Key', provider: 'Paystack' },
    { key: 'PAYSTACK_PUBLIC_KEY', desc: 'Paystack Public Key', provider: 'Paystack' },
    { key: 'FLUTTERWAVE_SECRET_KEY', desc: 'Flutterwave Secret Key', provider: 'Flutterwave' },
    { key: 'MONNIFY_API_KEY', desc: 'Monnify API Key', provider: 'Monnify' },
    { key: 'MONNIFY_SECRET', desc: 'Monnify Secret Key', provider: 'Monnify' },
    { key: 'MONNIFY_CONTRACT_CODE', desc: 'Monnify Contract Code', provider: 'Monnify' },
    { key: 'TERMII_API_KEY', desc: 'Termii API Key for SMS/OTP', provider: 'Termii' },
    { key: 'AIJALON_API_KEY', desc: 'Aijalon Telecommunications', provider: 'Aijalon' },
    { key: 'CLUBKONNECT_API_KEY', desc: 'ClubKonnect API Key', provider: 'ClubKonnect' },
    { key: 'CLUBKONNECT_USER_ID', desc: 'ClubKonnect User ID', provider: 'ClubKonnect' },
    { key: 'IDPRO_API_KEY', desc: 'IDPRO Verification API', provider: 'IDPRO' },
    { key: 'PAYVESSEL_API_SECRET', desc: 'PayVessel Secret Key', provider: 'PayVessel' },
    { key: 'PAYVESSEL_API_KEY', desc: 'PayVessel API Key', provider: 'PayVessel' },
    { key: 'OPENAI_API_KEY', desc: 'OpenAI Secret Key for Cortex AI', provider: 'AI & Misc' },
    { key: 'CRYPTO_EXCHANGE_KEY', desc: 'CoinMarketCap API Key', provider: 'AI & Misc' }
];

export default function SecretsManager() {
    const [secrets, setSecrets] = useState<Record<string, string>>({});
    const [originalSecrets, setOriginalSecrets] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<string>('All');
    
    const providers = ['All', ...Array.from(new Set(REQUIRED_SECRETS.map(s => s.provider)))];

    useEffect(() => {
        fetchSecrets();
    }, []);

    const fetchSecrets = async () => {
        try {
            const { data, error } = await supabase.from('system_secrets').select('*');
            if (error) throw error;

            const secretsMap: Record<string, string> = {};
            data?.forEach(s => {
                secretsMap[s.key] = s.value;
            });
            setSecrets(secretsMap);
            setOriginalSecrets(secretsMap);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch secrets. Ensure you have Admin rights.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (key: string, value: string, description: string) => {
        if (!value.trim()) {
            Alert.alert('Error', 'Value cannot be empty');
            return;
        }

        setSaving(key);
        try {
            const { error } = await supabase.from('system_secrets').upsert({
                key,
                value: value.trim(),
                description,
                updated_at: new Date().toISOString()
            });

            if (error) throw error;
            setOriginalSecrets(prev => ({ ...prev, [key]: value.trim() }));
            Alert.alert('Success', `${key} saved securely!`);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save secret.');
        } finally {
            setSaving(null);
        }
    };

    const toggleVisibility = (key: string) => {
        setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const copyToClipboard = (text: string) => {
        if (!text) return;
        Clipboard.setString(text);
        Alert.alert('Copied', 'API Key copied to clipboard');
    };

    const toggleAllVisibility = () => {
        const allVisible = REQUIRED_SECRETS.every(s => visibleKeys[s.key]);
        const nextState: Record<string, boolean> = {};
        REQUIRED_SECRETS.forEach(s => {
            nextState[s.key] = !allVisible;
        });
        setVisibleKeys(nextState);
    };

    const filteredSecrets = REQUIRED_SECRETS.filter(secret => {
        const matchesSearch = secret.key.toLowerCase().includes(searchQuery.toLowerCase()) || secret.desc.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProvider = selectedProvider === 'All' || secret.provider === selectedProvider;
        return matchesSearch && matchesProvider;
    });

    const isModified = (key: string) => {
        return secrets[key] !== originalSecrets[key] && secrets[key] !== undefined;
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-slate-50"
        >
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <LinearGradient colors={['#ffffff', '#f8fafc']} style={{ paddingTop: 40, paddingBottom: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                <View className="flex-row items-center justify-between mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                        <Ionicons name="arrow-back" size={18} color="#475569" />
                    </TouchableOpacity>
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity onPress={toggleAllVisibility} className="bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200 flex-row items-center gap-1">
                            <Ionicons name={REQUIRED_SECRETS.every(s => visibleKeys[s.key]) ? "eye-off" : "eye"} size={14} color="#475569" />
                            <Text className="text-slate-600 font-medium text-[10px] uppercase">Toggle All</Text>
                        </TouchableOpacity>
                        <View className="bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-200 flex-row items-center gap-1">
                            <Ionicons name="shield-checkmark" size={12} color="#e11d48" />
                            <Text className="text-rose-600 font-bold text-[10px] uppercase tracking-wider">Vault</Text>
                        </View>
                    </View>
                </View>
                
                <Text className="text-slate-900 text-xl font-black tracking-tight mb-1">API Security</Text>
                
                {/* Search Bar - Compact */}
                <View className="flex-row items-center bg-white rounded-lg border border-slate-200 px-3 h-9 mt-2 shadow-sm">
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                        className="flex-1 ml-2 text-slate-900 font-medium text-xs"
                        placeholder="Search keys..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            {/* Providers Filter - Compact */}
            <View className="border-b border-slate-200 bg-white">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2 px-4" contentContainerStyle={{ gap: 6, paddingRight: 32 }}>
                    {providers.map(provider => (
                        <TouchableOpacity 
                            key={provider} 
                            onPress={() => setSelectedProvider(provider)}
                            className={`px-3 py-1.5 rounded-full border ${selectedProvider === provider ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}
                        >
                            <Text className={`${selectedProvider === provider ? 'text-indigo-600 font-bold' : 'text-slate-500 font-medium'} text-[11px] tracking-wide`}>
                                {provider}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView className="flex-1 px-3 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" className="mt-10" />
                ) : filteredSecrets.length === 0 ? (
                    <View className="items-center justify-center mt-10">
                        <Ionicons name="search-outline" size={32} color="#94a3b8" />
                        <Text className="text-slate-500 mt-2 text-xs font-medium">No API keys found.</Text>
                    </View>
                ) : (
                    filteredSecrets.map((item, index) => {
                        const isSaved = !!originalSecrets[item.key];
                        const modified = isModified(item.key);
                        
                        return (
                            <View key={item.key} className="bg-white p-3.5 rounded-2xl mb-3 border border-slate-200 shadow-sm relative overflow-hidden">
                                {/* Decorative subtle gradient */}
                                <View className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full" />
                                
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="flex-1">
                                        <Text className="text-slate-800 font-bold text-sm tracking-wide">{item.key}</Text>
                                        <Text className="text-slate-500 text-[10px] mt-0.5">{item.desc}</Text>
                                    </View>
                                    <View className="flex-row gap-1 items-center">
                                        {isSaved && !modified && (
                                            <View className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                <Text className="text-emerald-600 text-[8px] font-bold uppercase">Configured</Text>
                                            </View>
                                        )}
                                        {modified && (
                                            <View className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                <Text className="text-amber-600 text-[8px] font-bold uppercase">Unsaved</Text>
                                            </View>
                                        )}
                                        <View className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 ml-1">
                                            <Text className="text-slate-600 text-[8px] font-bold uppercase">{item.provider}</Text>
                                        </View>
                                    </View>
                                </View>
                                
                                <View className="flex-row items-center bg-slate-50 rounded-xl border border-slate-200 px-3 h-10 mb-3 relative z-10">
                                    <TextInput
                                        className="flex-1 text-slate-900 font-mono text-[11px]"
                                        placeholder="Enter key..."
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={!visibleKeys[item.key]}
                                        value={secrets[item.key] || ''}
                                        onChangeText={(val) => setSecrets({ ...secrets, [item.key]: val })}
                                    />
                                    <View className="flex-row gap-1 border-l border-slate-200 pl-2 ml-2">
                                        <TouchableOpacity onPress={() => copyToClipboard(secrets[item.key])} className="p-1.5 bg-white rounded-md border border-slate-200 shadow-sm">
                                            <Ionicons name="copy-outline" size={14} color="#64748b" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => toggleVisibility(item.key)} className="p-1.5 bg-white rounded-md border border-slate-200 shadow-sm">
                                            <Ionicons name={visibleKeys[item.key] ? "eye-off" : "eye"} size={14} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    onPress={() => handleSave(item.key, secrets[item.key] || '', item.desc)}
                                    disabled={saving === item.key || (!modified && isSaved)}
                                    className={`h-9 rounded-xl items-center justify-center flex-row gap-1.5 ${saving === item.key ? 'bg-indigo-400' : (!modified && isSaved ? 'bg-slate-100 border border-slate-200' : 'bg-indigo-600')}`}
                                >
                                    {saving === item.key ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name={!modified && isSaved ? "checkmark-circle" : "lock-closed"} size={14} color={!modified && isSaved ? "#64748b" : "white"} />
                                            <Text className={`${!modified && isSaved ? "text-slate-500" : "text-white"} font-bold text-xs`}>
                                                {!modified && isSaved ? 'Saved' : 'Save Key'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
