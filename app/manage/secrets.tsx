import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

// Navy & Gold Theme Tokens
const C = {
    bg: '#060B19',
    card: '#0F172A',
    cardBorder: 'rgba(218, 165, 32, 0.35)',
    cardLight: '#162447',
    gold: '#FFD700',
    goldDk: '#DAA520',
    goldAmber: '#F59E0B',
    goldLight: '#FBE6A2',
    white: '#FFFFFF',
    textMuted: '#94A3B8',
    textDim: '#64748B',
    inputBg: '#0A1128',
    inputBorder: '#1E293B',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.15)',
    emeraldBorder: 'rgba(16, 185, 129, 0.4)',
};

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
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            Clipboard.setString(text);
        }
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
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Ultra Navy & Gold Header */}
                <LinearGradient 
                    colors={['#0B132B', '#1C2541', '#0A1128']} 
                    style={{ paddingTop: insets.top + 10, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderColor: 'rgba(218, 165, 32, 0.4)' }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: '#1C2852', borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.4)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={20} color={C.gold} />
                        </TouchableOpacity>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity onPress={toggleAllVisibility} style={{ backgroundColor: '#101935', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.3)' }}>
                                <Ionicons name={REQUIRED_SECRETS.every(s => visibleKeys[s.key]) ? "eye-off" : "eye"} size={14} color={C.gold} />
                                <Text style={{ color: C.goldLight, fontWeight: 'bold', fontSize: 12 }}>Toggle All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/manage/api')} style={{ backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: C.gold, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="key" size={14} color={C.gold} />
                                <Text style={{ color: C.gold, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>Active API Vault →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text style={{ color: C.gold, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>SYSTEM SECRETS & KEYS</Text>
                    <Text style={{ color: '#CBD5E1', fontSize: 12, marginBottom: 16 }}>Encrypted system credentials and third-party API integration keys.</Text>
                    
                    {/* Search Bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.3)' }}>
                        <Ionicons name="search" size={18} color={C.gold} />
                        <TextInput
                            style={{ flex: 1, marginLeft: 12, color: C.white, fontWeight: '500', fontSize: 12 }}
                            placeholder="Search secrets or descriptions..."
                            placeholderTextColor={C.textDim}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color={C.textDim} />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>

                {/* Direct Active Provider Vault Banner */}
                <TouchableOpacity
                    onPress={() => router.push('/manage/api')}
                    style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#0F172A', padding: 14, borderRadius: 16, borderWidth: 2, borderColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: 'rgba(255, 215, 0, 0.2)', borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="flash-sharp" size={16} color={C.gold} />
                        </View>
                        <View>
                            <Text style={{ color: C.gold, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>✨ Manage Active API Providers & Failovers</Text>
                            <Text style={{ color: '#CBD5E1', fontSize: 10 }}>BilalSadaSub, Paystack, AgentHub, PayVessel, Bigi, Monnify</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.gold} />
                </TouchableOpacity>

                {/* Providers Filter */}
                <View style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderColor: '#1E293B', paddingBottom: 4, marginTop: 8 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 10, paddingHorizontal: 16 }} contentContainerStyle={{ gap: 8 }}>
                        {providers.map(provider => (
                            <TouchableOpacity 
                                key={provider} 
                                onPress={() => setSelectedProvider(provider)}
                                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: selectedProvider === provider ? C.gold : C.card, borderColor: selectedProvider === provider ? C.gold : '#1E293B' }}
                            >
                                <Text style={{ color: selectedProvider === provider ? C.bg : C.white, fontWeight: 'bold', fontSize: 12 }}>
                                    {provider}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Content */}
                <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
                    {loading ? (
                        <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 40 }} />
                    ) : filteredSecrets.length === 0 ? (
                        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 48, backgroundColor: C.card, borderRadius: 24, paddingVertical: 40, borderWidth: 1, borderColor: C.cardBorder }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' }}>
                                <Ionicons name="search-outline" size={28} color={C.gold} />
                            </View>
                            <Text style={{ color: C.textMuted, fontWeight: '600', fontSize: 12 }}>No secret keys found matching query.</Text>
                        </View>
                    ) : (
                        filteredSecrets.map((item) => {
                            const isSaved = !!originalSecrets[item.key];
                            const modified = isModified(item.key);
                            
                            return (
                                <View key={item.key} style={{ backgroundColor: C.card, padding: 16, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: C.cardBorder, position: 'relative', overflow: 'hidden' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <View style={{ flex: 1, marginRight: 12 }}>
                                            <Text style={{ color: C.white, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>{item.key}</Text>
                                            <Text style={{ color: '#CBD5E1', fontSize: 11, marginTop: 4, lineHeight: 16 }}>{item.desc}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                                            <View style={{ backgroundColor: '#1C2852', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.4)' }}>
                                                <Text style={{ color: C.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{item.provider}</Text>
                                            </View>
                                            {isSaved && !modified && (
                                                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: C.emeraldBorder }}>
                                                    <Text style={{ color: C.emerald, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>Configured</Text>
                                                </View>
                                            )}
                                            {modified && (
                                                <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                                                    <Text style={{ color: C.goldAmber, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>Unsaved</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 16, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 12, height: 48, marginBottom: 12 }}>
                                        <Ionicons name="key-outline" size={16} color={C.gold} />
                                        <TextInput
                                            style={{ flex: 1, marginLeft: 8, color: C.white, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12, height: '100%' }}
                                            placeholder="Enter secret key..."
                                            placeholderTextColor="#475569"
                                            secureTextEntry={!visibleKeys[item.key]}
                                            value={secrets[item.key] || ''}
                                            onChangeText={(val) => setSecrets({ ...secrets, [item.key]: val })}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <View style={{ flexDirection: 'row', gap: 6, borderLeftWidth: 1, borderColor: '#1E293B', paddingLeft: 8, marginLeft: 8 }}>
                                            <TouchableOpacity onPress={() => copyToClipboard(secrets[item.key])} style={{ width: 32, height: 32, backgroundColor: '#16224F', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.3)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name="copy-outline" size={14} color={C.gold} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => toggleVisibility(item.key)} style={{ width: 32, height: 32, backgroundColor: '#16224F', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.3)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name={visibleKeys[item.key] ? "eye-off" : "eye"} size={14} color={C.gold} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={() => handleSave(item.key, secrets[item.key] || '', item.desc)}
                                        disabled={saving === item.key || (!modified && isSaved)}
                                        style={{ height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: saving === item.key ? C.inputBg : (!modified && isSaved ? C.bg : C.gold), borderWidth: !modified && isSaved ? 1 : 0, borderColor: '#1E293B' }}
                                    >
                                        {saving === item.key ? (
                                            <ActivityIndicator size="small" color={C.gold} />
                                        ) : (
                                            <>
                                                <Ionicons name={!modified && isSaved ? "checkmark-circle" : "lock-closed"} size={16} color={!modified && isSaved ? C.emerald : C.bg} />
                                                <Text style={{ color: !modified && isSaved ? C.emerald : C.bg, fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
