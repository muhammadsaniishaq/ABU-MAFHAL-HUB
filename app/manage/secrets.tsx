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
    { key: 'CRYPTO_EXCHANGE_KEY', desc: 'CoinGecko API Key', provider: 'Crypto' },
    { key: 'DERIV_API_TOKEN', desc: 'Deriv Trading API Token', provider: 'Trading' },
    { key: 'APIFY_API_TOKEN', desc: 'Apify API Token', provider: 'Automation' },
    { key: 'ALCHEMY_API_KEY', desc: 'Alchemy Node RPC API Key', provider: 'Crypto' },
    { key: 'NINE_BOOST_API_KEY', desc: '9Boost API Key for Social Media Panel', provider: '9Boost' },
    { key: 'NOWPAYMENTS_API_KEY', desc: 'NowPayments API Key for Crypto Receive', provider: 'NowPayments' },
    { key: 'NOWPAYMENTS_IPN_SECRET', desc: 'NowPayments IPN Secret for Webhook', provider: 'NowPayments' },
    { key: 'BIGI_API_TOKEN', desc: 'Bigi API Token for VTU Services', provider: 'Bigi' },
    { key: 'BIGI_API_PIN', desc: 'Bigi 4-digit Transaction PIN', provider: 'Bigi' }
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
        <View className="flex-1 bg-[#f4f6fb]">
            <Stack.Screen options={{ headerShown: false }} />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                {/* Premium Header */}
                <LinearGradient 
                    colors={['#0d1b3e', '#142258']} 
                    style={{ paddingTop: insets.top + 10, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View className="flex-row items-center justify-between mb-4">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                            <Ionicons name="arrow-back" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        
                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity onPress={toggleAllVisibility} className="bg-white/10 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border border-white/5">
                                <Ionicons name={REQUIRED_SECRETS.every(s => visibleKeys[s.key]) ? "eye-off" : "eye"} size={14} color="#ffffff" />
                                <Text className="text-white font-semibold text-xs tracking-wide">Toggle All</Text>
                            </TouchableOpacity>
                            <View className="bg-rose-500/20 px-3 py-1.5 rounded-full border border-rose-500/30 flex-row items-center gap-1.5">
                                <Ionicons name="shield-checkmark" size={14} color="#f43f5e" />
                                <Text className="text-rose-400 font-bold text-xs uppercase tracking-widest">Vault</Text>
                            </View>
                        </View>
                    </View>
                    
                    <Text className="text-white text-2xl font-black tracking-tight mb-2">API Security</Text>
                    <Text className="text-indigo-200 text-xs mb-4">Manage your provider keys and application secrets securely.</Text>
                    
                    {/* Search Bar */}
                    <View className="flex-row items-center bg-white/10 rounded-xl px-4 h-12 border border-white/5">
                        <Ionicons name="search" size={18} color="#94a3b8" />
                        <TextInput
                            className="flex-1 ml-3 text-white font-medium text-sm"
                            placeholder="Search keys or descriptions..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>

                {/* Providers Filter */}
                <View className="bg-white border-b border-slate-200 shadow-sm z-10 pb-1">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-3 px-5" contentContainerStyle={{ gap: 8, paddingRight: 40 }}>
                        {providers.map(provider => (
                            <TouchableOpacity 
                                key={provider} 
                                onPress={() => setSelectedProvider(provider)}
                                className={`px-4 py-2 rounded-full border ${selectedProvider === provider ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <Text className={`${selectedProvider === provider ? 'text-white font-bold' : 'text-slate-600 font-medium'} text-xs tracking-wide`}>
                                    {provider}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Content */}
                <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#4F46E5" className="mt-10" />
                    ) : filteredSecrets.length === 0 ? (
                        <View className="items-center justify-center mt-12 bg-white rounded-3xl py-10 border border-slate-100 shadow-sm">
                            <View className="w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3">
                                <Ionicons name="search-outline" size={28} color="#94a3b8" />
                            </View>
                            <Text className="text-slate-500 font-semibold text-sm">No API keys found.</Text>
                        </View>
                    ) : (
                        filteredSecrets.map((item, index) => {
                            const isSaved = !!originalSecrets[item.key];
                            const modified = isModified(item.key);
                            
                            return (
                                <View key={item.key} className="bg-white p-4 rounded-2xl mb-4 border border-slate-100 shadow-sm shadow-slate-200/50 relative overflow-hidden">
                                    {/* Decorative Blob */}
                                    <View className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl" />
                                    
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-1 mr-3">
                                            <Text className="text-slate-800 font-bold text-sm tracking-wide">{item.key}</Text>
                                            <Text className="text-slate-500 text-xs mt-1 leading-5">{item.desc}</Text>
                                        </View>
                                        <View className="flex-col gap-1.5 items-end">
                                            <View className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                                <Text className="text-slate-600 text-[9px] font-bold uppercase tracking-wider">{item.provider}</Text>
                                            </View>
                                            {isSaved && !modified && (
                                                <View className="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                                    <Text className="text-emerald-600 text-[9px] font-bold uppercase tracking-wider">Configured</Text>
                                                </View>
                                            )}
                                            {modified && (
                                                <View className="bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                                                    <Text className="text-amber-600 text-[9px] font-bold uppercase tracking-wider">Unsaved</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View className="flex-row items-center bg-[#f8fafc] rounded-xl border border-slate-200 px-3 h-12 mb-4 relative z-10">
                                        <Ionicons name="key-outline" size={16} color="#94a3b8" />
                                        <TextInput
                                            className="flex-1 ml-2 text-slate-900 font-mono text-sm h-full"
                                            placeholder="Enter secure key..."
                                            placeholderTextColor="#cbd5e1"
                                            secureTextEntry={!visibleKeys[item.key]}
                                            value={secrets[item.key] || ''}
                                            onChangeText={(val) => setSecrets({ ...secrets, [item.key]: val })}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <View className="flex-row gap-1 border-l border-slate-200 pl-2 ml-2">
                                            <TouchableOpacity onPress={() => copyToClipboard(secrets[item.key])} className="w-8 h-8 bg-white rounded-lg border border-slate-200 items-center justify-center shadow-sm">
                                                <Ionicons name="copy-outline" size={14} color="#64748b" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => toggleVisibility(item.key)} className="w-8 h-8 bg-white rounded-lg border border-slate-200 items-center justify-center shadow-sm">
                                                <Ionicons name={visibleKeys[item.key] ? "eye-off" : "eye"} size={14} color="#64748b" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={() => handleSave(item.key, secrets[item.key] || '', item.desc)}
                                        disabled={saving === item.key || (!modified && isSaved)}
                                        className={`h-12 rounded-xl items-center justify-center flex-row gap-2 ${saving === item.key ? 'bg-indigo-400' : (!modified && isSaved ? 'bg-slate-100 border border-slate-200' : 'bg-indigo-600 shadow-sm shadow-indigo-600/30')}`}
                                    >
                                        {saving === item.key ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name={!modified && isSaved ? "checkmark-circle" : "lock-closed"} size={16} color={!modified && isSaved ? "#64748b" : "white"} />
                                                <Text className={`${!modified && isSaved ? "text-slate-500" : "text-white"} font-bold text-sm tracking-wide`}>
                                                    {!modified && isSaved ? 'Saved & Secure' : 'Save Secure Key'}
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
