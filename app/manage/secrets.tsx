import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Clipboard, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface SystemSecret {
    key: string;
    value: string;
    description: string;
    provider: string; 
}

const REQUIRED_SECRETS = [
    { key: 'AGENTHUB_API_KEY', desc: 'AgentHub API Key (agenthub.ng for NIN/BVN & Slips)', provider: 'AgentHub' },
    { key: 'BILALSADASUB_TOKEN', desc: 'Bilalsadasub API Token (bilalsadasub.com for Telecom)', provider: 'Bilalsadasub' },
    { key: 'PAYSTACK_SECRET_KEY', desc: 'Paystack Secret Key', provider: 'Paystack' },
    { key: 'PAYSTACK_PUBLIC_KEY', desc: 'Paystack Public Key', provider: 'Paystack' },
    { key: 'FLUTTERWAVE_SECRET_KEY', desc: 'Flutterwave Secret Key', provider: 'Flutterwave' },
    { key: 'TERMII_API_KEY', desc: 'Termii API Key for SMS/OTP', provider: 'Termii' },
    { key: 'AIJALON_API_KEY', desc: 'Aijalon Telecommunications', provider: 'Aijalon' },
    { key: 'CLUBKONNECT_API_KEY', desc: 'ClubKonnect API Key', provider: 'ClubKonnect' },
    { key: 'CLUBKONNECT_USER_ID', desc: 'ClubKonnect User ID', provider: 'ClubKonnect' },
    { key: 'IDPRO_API_KEY', desc: 'IDPRO Verification API', provider: 'IDPRO' },
    { key: 'PAYVESSEL_API_SECRET', desc: 'PayVessel Secret Key', provider: 'PayVessel' },
    { key: 'PAYVESSEL_API_KEY', desc: 'PayVessel API Key', provider: 'PayVessel' },
    { key: 'OPENAI_API_KEY', desc: 'OpenAI Secret Key for Cortex AI', provider: 'AI & Misc' },
    { key: 'CRYPTO_EXCHANGE_KEY', desc: 'CoinGecko API Key', provider: 'Crypto' },
    { key: 'DERIV_API_TOKEN', desc: 'Deriv Trading API Token', provider: 'Trading' },
    { key: 'APIFY_API_TOKEN', desc: 'Apify API Token', provider: 'Automation' },
    { key: 'ALCHEMY_API_KEY', desc: 'Alchemy Node RPC API Key', provider: 'Crypto' },
    { key: 'NINE_BOOST_API_KEY', desc: '9Boost API Key for Social Media Panel', provider: '9Boost' },
    { key: 'NOWPAYMENTS_API_KEY', desc: 'NowPayments API Key for Crypto Receive', provider: 'NowPayments' },
    { key: 'NOWPAYMENTS_IPN_SECRET', desc: 'NowPayments IPN Secret for Webhook', provider: 'NowPayments' },
    { key: 'BIGI_API_TOKEN', desc: 'Bigi API Token for VTU Services', provider: 'Bigi' },
    { key: 'BIGI_API_PIN', desc: 'Bigi 4-digit Transaction PIN', provider: 'Bigi' },
    { key: 'RESEND_API_KEY', desc: 'Resend.com API Key for Automatic Email Receipts', provider: 'Email & Notifications' },
    { key: 'ZOHO_EMAIL', desc: 'Zoho / SMTP Email Address (e.g. support@abumafhal.com)', provider: 'Email & Notifications' },
    { key: 'ZOHO_PASSWORD', desc: 'Zoho / SMTP Password or App Password', provider: 'Email & Notifications' },
    { key: 'SMTP_HOST', desc: 'SMTP Host Server (Default: smtp.zoho.com)', provider: 'Email & Notifications' },
    { key: 'SMTP_PORT', desc: 'SMTP Server Port (Default: 465)', provider: 'Email & Notifications' }
];

export default function SecretsManager() {
    const [secrets, setSecrets] = useState<Record<string, string>>({});
    const [originalSecrets, setOriginalSecrets] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<string>('All');
    const insets = useSafeAreaInsets();
    
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
        <View className="flex-1 bg-[#060B19]">
            <Stack.Screen options={{ headerShown: false }} />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                {/* Ultra Navy & Gold Header */}
                <LinearGradient 
                    colors={['#0B132B', '#1C2541', '#0A1128']} 
                    style={{ paddingTop: insets.top + 10, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderColor: 'rgba(218, 165, 32, 0.4)' }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View className="flex-row items-center justify-between mb-4">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-2xl bg-[#1C2852] border border-[#DAA520]/40 items-center justify-center">
                            <Ionicons name="arrow-back" size={20} color="#FFD700" />
                        </TouchableOpacity>
                        
                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity onPress={toggleAllVisibility} className="bg-[#101935] px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 border border-[#DAA520]/30">
                                <Ionicons name={REQUIRED_SECRETS.every(s => visibleKeys[s.key]) ? "eye-off" : "eye"} size={14} color="#FFD700" />
                                <Text className="text-[#FBE6A2] font-bold text-xs tracking-wide">Toggle All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/manage/api')} className="bg-[#FFD700]/20 px-3 py-1.5 rounded-xl border border-[#FFD700] flex-row items-center gap-1.5">
                                <Ionicons name="key" size={14} color="#FFD700" />
                                <Text className="text-[#FFD700] font-black text-xs uppercase tracking-wider">Active API Vault →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text className="text-[#FFD700] text-2xl font-black tracking-tight mb-1">SYSTEM SECRETS & KEYS</Text>
                    <Text className="text-slate-300 text-xs mb-4">Encrypted system credentials and third-party API integration keys.</Text>
                    
                    {/* Search Bar */}
                    <View className="flex-row items-center bg-[#060B19] rounded-2xl px-4 h-12 border border-[#DAA520]/30">
                        <Ionicons name="search" size={18} color="#FFD700" />
                        <TextInput
                            className="flex-1 ml-3 text-white font-medium text-xs"
                            placeholder="Search secrets or descriptions..."
                            placeholderTextColor="#64748B"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color="#64748B" />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>

                {/* Direct Active Provider Vault Banner */}
                <TouchableOpacity
                    onPress={() => router.push('/manage/api')}
                    className="mx-4 mt-3 bg-gradient-to-r from-[#1C2852] to-[#0F172A] p-3.5 rounded-2xl border-2 border-[#FFD700] flex-row items-center justify-between shadow-lg"
                >
                    <View className="flex-row items-center gap-2.5">
                        <View className="w-8 h-8 rounded-xl bg-[#FFD700]/20 border border-[#FFD700] items-center justify-center">
                            <Ionicons name="flash-sharp" size={16} color="#FFD700" />
                        </View>
                        <View>
                            <Text className="text-[#FFD700] font-black text-xs uppercase">✨ Manage Active API Providers & Failovers</Text>
                            <Text className="text-slate-300 text-[10px]">BilalSadaSub, Paystack, AgentHub, PayVessel, Bigi, Monnify</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#FFD700" />
                </TouchableOpacity>

                {/* Providers Filter */}
                <View className="bg-[#060B19] border-b border-slate-800 z-10 pb-1 mt-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2.5 px-4" contentContainerStyle={{ gap: 8 }}>
                        {providers.map(provider => (
                            <TouchableOpacity 
                                key={provider} 
                                onPress={() => setSelectedProvider(provider)}
                                className={`px-4 py-2 rounded-xl border ${selectedProvider === provider ? 'bg-[#FFD700] border-[#FFD700]' : 'bg-[#0F172A] border-slate-800'}`}
                            >
                                <Text className={`${selectedProvider === provider ? 'text-[#060B19] font-black' : 'text-slate-300 font-bold'} text-xs tracking-wide`}>
                                    {provider}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Content */}
                <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#FFD700" className="mt-10" />
                    ) : filteredSecrets.length === 0 ? (
                        <View className="items-center justify-center mt-12 bg-[#0F172A] rounded-3xl py-10 border border-[#DAA520]/30 shadow-sm">
                            <View className="w-16 h-16 rounded-full bg-[#060B19] items-center justify-center mb-3 border border-slate-800">
                                <Ionicons name="search-outline" size={28} color="#FFD700" />
                            </View>
                            <Text className="text-slate-400 font-semibold text-xs">No secret keys found matching query.</Text>
                        </View>
                    ) : (
                        filteredSecrets.map((item) => {
                            const isSaved = !!originalSecrets[item.key];
                            const modified = isModified(item.key);
                            
                            return (
                                <View key={item.key} className="bg-[#0F172A] p-4 rounded-3xl mb-4 border border-[#DAA520]/30 shadow-lg relative overflow-hidden">
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-1 mr-3">
                                            <Text className="text-white font-black text-xs tracking-wide">{item.key}</Text>
                                            <Text className="text-slate-400 text-[11px] mt-1 leading-4">{item.desc}</Text>
                                        </View>
                                        <View className="flex-col gap-1.5 items-end">
                                            <View className="bg-[#1C2852] px-2 py-0.5 rounded-lg border border-[#DAA520]/40">
                                                <Text className="text-[#FFD700] text-[10px] font-extrabold uppercase tracking-wider">{item.provider}</Text>
                                            </View>
                                            {isSaved && !modified && (
                                                <View className="bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/50">
                                                    <Text className="text-emerald-400 text-[9px] font-black uppercase">Configured</Text>
                                                </View>
                                            )}
                                            {modified && (
                                                <View className="bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/50">
                                                    <Text className="text-amber-400 text-[9px] font-black uppercase">Unsaved</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View className="flex-row items-center bg-[#060B19] rounded-2xl border border-slate-800 px-3 h-12 mb-3">
                                        <Ionicons name="key-outline" size={16} color="#FFD700" />
                                        <TextInput
                                            className="flex-1 ml-2 text-white font-mono text-xs h-full"
                                            placeholder="Enter secret key..."
                                            placeholderTextColor="#475569"
                                            secureTextEntry={!visibleKeys[item.key]}
                                            value={secrets[item.key] || ''}
                                            onChangeText={(val) => setSecrets({ ...secrets, [item.key]: val })}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <View className="flex-row gap-1.5 border-l border-slate-800 pl-2 ml-2">
                                            <TouchableOpacity onPress={() => copyToClipboard(secrets[item.key])} className="w-8 h-8 bg-[#16224F] rounded-xl border border-[#DAA520]/30 items-center justify-center">
                                                <Ionicons name="copy-outline" size={14} color="#FFD700" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => toggleVisibility(item.key)} className="w-8 h-8 bg-[#16224F] rounded-xl border border-[#DAA520]/30 items-center justify-center">
                                                <Ionicons name={visibleKeys[item.key] ? "eye-off" : "eye"} size={14} color="#FFD700" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={() => handleSave(item.key, secrets[item.key] || '', item.desc)}
                                        disabled={saving === item.key || (!modified && isSaved)}
                                        className={`h-11 rounded-2xl items-center justify-center flex-row gap-2 ${saving === item.key ? 'bg-slate-800' : (!modified && isSaved ? 'bg-[#060B19] border border-slate-800' : 'bg-gradient-to-r from-amber-500 to-yellow-400')}`}
                                    >
                                        {saving === item.key ? (
                                            <ActivityIndicator size="small" color="#FFD700" />
                                        ) : (
                                            <>
                                                <Ionicons name={!modified && isSaved ? "checkmark-circle" : "lock-closed"} size={16} color={!modified && isSaved ? "#34d399" : "#060B19"} />
                                                <Text className={`${!modified && isSaved ? "text-emerald-400 font-bold" : "text-[#060B19] font-black"} text-xs uppercase tracking-wider`}>
                                                    {!modified && isSaved ? 'Saved & Encrypted' : 'Save Secret Key'}
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
        </View>
    );
}
