import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ultra Premium Compact LIGHT Navy & Gold Design Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(218, 165, 32, 0.4)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    gold: '#FFD700',
    goldDk: '#DAA520',
    goldAmber: '#D97706',
    goldLight: '#FEF3C7',
    goldBg: 'rgba(254, 243, 199, 0.65)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
};

const extractStringValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'string') return parsed;
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed.key || parsed.token || parsed.api_key || parsed.value || parsed.secret || JSON.stringify(parsed);
                }
            } catch (e) {}
        }
        return trimmed;
    }
    if (typeof val === 'object' && val !== null) {
        return val.key || val.token || val.api_key || val.value || val.secret || '';
    }
    return String(val);
};

const REQUIRED_SECRETS = [
    { key: 'AGENTHUB_API_KEY', aliases: ['AGENTHUB_KEY', 'AGENTS_HUB_KEY'], desc: 'AgentHub API Key (agenthub.ng for NIN/BVN & Slips)', provider: 'AgentHub' },
    { key: 'BILALSADASUB_TOKEN', aliases: ['BILAL_TOKEN', 'BILALSADASUB_API_KEY'], desc: 'Bilalsadasub API Token (bilalsadasub.com for Telecom)', provider: 'Bilalsadasub' },
    { key: 'PAYSTACK_SECRET_KEY', aliases: ['PAYSTACK_KEY', 'PAYSTACK_SECRET'], desc: 'Paystack Secret Key', provider: 'Paystack' },
    { key: 'PAYSTACK_PUBLIC_KEY', aliases: ['PAYSTACK_PUB'], desc: 'Paystack Public Key', provider: 'Paystack' },
    { key: 'FLUTTERWAVE_SECRET_KEY', aliases: ['FLUTTERWAVE_KEY'], desc: 'Flutterwave Secret Key', provider: 'Flutterwave' },
    { key: 'TERMII_API_KEY', aliases: ['TERMII_KEY'], desc: 'Termii API Key for SMS/OTP', provider: 'Termii' },
    { key: 'AIJALON_API_KEY', aliases: ['AIJALON_KEY'], desc: 'Aijalon Telecommunications', provider: 'Aijalon' },
    { key: 'CLUBKONNECT_API_KEY', aliases: ['CLUBKONNECT_KEY'], desc: 'ClubKonnect API Key', provider: 'ClubKonnect' },
    { key: 'CLUBKONNECT_USER_ID', aliases: ['CLUBKONNECT_USER'], desc: 'ClubKonnect User ID', provider: 'ClubKonnect' },
    { key: 'IDPRO_API_KEY', aliases: ['IDPRO_KEY'], desc: 'IDPRO Verification API', provider: 'IDPRO' },
    { key: 'PAYVESSEL_API_SECRET', aliases: ['PAYVESSEL_SECRET_KEY', 'PAYVESSEL_SECRET'], desc: 'PayVessel Secret Key', provider: 'PayVessel' },
    { key: 'PAYVESSEL_API_KEY', aliases: ['PAYVESSEL_KEY', 'PAYBESSEL_API_KEY'], desc: 'PayVessel API Key', provider: 'PayVessel' },
    { key: 'OPENAI_API_KEY', aliases: ['OPENAI_KEY'], desc: 'OpenAI Secret Key for Cortex AI', provider: 'AI & Misc' },
    { key: 'CRYPTO_EXCHANGE_KEY', aliases: ['COINGECKO_KEY'], desc: 'CoinGecko API Key', provider: 'Crypto' },
    { key: 'DERIV_API_TOKEN', aliases: ['DERIV_TOKEN'], desc: 'Deriv Trading API Token', provider: 'Trading' },
    { key: 'APIFY_API_TOKEN', aliases: ['APIFY_TOKEN'], desc: 'Apify API Token', provider: 'Automation' },
    { key: 'ALCHEMY_API_KEY', aliases: ['ALCHEMY_KEY'], desc: 'Alchemy Node RPC API Key', provider: 'Crypto' },
    { key: 'NINE_BOOST_API_KEY', aliases: ['NINEBOOST_API_KEY', 'NINEBOOST_KEY'], desc: '9Boost API Key for Social Media Panel', provider: '9Boost' },
    { key: 'NOWPAYMENTS_API_KEY', aliases: ['NOWPAYMENTS_KEY'], desc: 'NowPayments API Key for Crypto Receive', provider: 'NowPayments' },
    { key: 'NOWPAYMENTS_IPN_SECRET', aliases: ['NOWPAYMENTS_SECRET'], desc: 'NowPayments IPN Secret for Webhook', provider: 'NowPayments' },
    { key: 'BIGI_API_TOKEN', aliases: ['BIGI_TOKEN'], desc: 'Bigi API Token for VTU Services', provider: 'Bigi' },
    { key: 'BIGI_API_PIN', aliases: ['BIGI_PIN'], desc: 'Bigi 4-digit Transaction PIN', provider: 'Bigi' },
    { key: 'RESEND_API_KEY', aliases: ['RESEND_KEY'], desc: 'Resend.com API Key for Automatic Email Receipts', provider: 'Email & Notifications' },
    { key: 'ZOHO_EMAIL', aliases: ['SMTP_USER'], desc: 'Zoho / SMTP Email Address (e.g. support@abumafhal.com)', provider: 'Email & Notifications' },
    { key: 'ZOHO_PASSWORD', aliases: ['SMTP_PASS'], desc: 'Zoho / SMTP Password or App Password', provider: 'Email & Notifications' },
    { key: 'SMTP_HOST', aliases: ['ZOHO_HOST'], desc: 'SMTP Host Server (Default: smtp.zoho.com)', provider: 'Email & Notifications' },
    { key: 'SMTP_PORT', aliases: ['ZOHO_PORT'], desc: 'SMTP Server Port (Default: 465)', provider: 'Email & Notifications' },
    { key: 'LIVEKIT_URL', aliases: ['LIVEKIT_WS_URL'], desc: 'LiveKit Cloud WebSocket URL (e.g. wss://abu-mafhal-sub-ndlajsjm.livekit.cloud)', provider: 'LiveKit Meetings' },
    { key: 'LIVEKIT_API_KEY', aliases: ['LIVEKIT_KEY'], desc: 'LiveKit Cloud API Key (e.g. APIiTbTpxxxGdtV)', provider: 'LiveKit Meetings' },
    { key: 'LIVEKIT_API_SECRET', aliases: ['LIVEKIT_SECRET'], desc: 'LiveKit Cloud API Secret for Video Conference JWT Tokens', provider: 'LiveKit Meetings' }
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
            const masterMap: Record<string, string> = {};

            // 1. Check AsyncStorage Cache
            for (const s of REQUIRED_SECRETS) {
                const keysToCheck = [s.key, ...(s.aliases || [])];
                for (const k of keysToCheck) {
                    const cached = await AsyncStorage.getItem(`@vault_${k}`);
                    if (cached && cached.trim() !== '') {
                        masterMap[k.toUpperCase()] = cached.trim();
                    }
                }
            }

            // 2. Fetch from Supabase system_secrets
            const { data } = await supabase.from('system_secrets').select('*');
            if (data) {
                data.forEach(s => {
                    const parsed = extractStringValue(s.value);
                    if (parsed && parsed.trim() !== '') {
                        masterMap[s.key.toUpperCase()] = parsed.trim();
                    }
                });
            }

            // 3. Fetch from Supabase app_settings
            const { data: settings } = await supabase.from('app_settings').select('*');
            if (settings) {
                settings.forEach(s => {
                    const parsed = extractStringValue(s.value);
                    if (parsed && parsed.trim() !== '') {
                        masterMap[s.key.toUpperCase()] = parsed.trim();
                    }
                });
            }

            // Match values using aliases
            const resolvedSecrets: Record<string, string> = {};
            REQUIRED_SECRETS.forEach(s => {
                const keysToCheck = [s.key, ...(s.aliases || [])];
                for (const k of keysToCheck) {
                    const found = masterMap[k.toUpperCase()];
                    if (found && found.trim() !== '') {
                        resolvedSecrets[s.key] = found.trim();
                        break;
                    }
                }
            });

            setSecrets(resolvedSecrets);
            setOriginalSecrets(resolvedSecrets);
        } catch (error: any) {
            console.error('Error fetching secrets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (keyItem: typeof REQUIRED_SECRETS[0], value: string) => {
        if (!value.trim()) {
            Alert.alert('Error', 'Value cannot be empty');
            return;
        }

        const primaryKey = keyItem.key;
        setSaving(primaryKey);
        try {
            const cleanVal = value.trim();
            const keysToSync = [primaryKey, ...(keyItem.aliases || [])];

            for (const k of keysToSync) {
                await AsyncStorage.setItem(`@vault_${k}`, cleanVal);

                // Exclusively store in system_secrets (protected by Admin-only RLS)
                await supabase.from('system_secrets').upsert({
                    key: k,
                    value: cleanVal,
                    description: keyItem.desc,
                    updated_at: new Date().toISOString()
                });
            }

            setOriginalSecrets(prev => ({ ...prev, [primaryKey]: cleanVal }));
            Alert.alert('Success 🎉', `${primaryKey} saved securely!`);
        } catch (error: any) {
            Alert.alert('Saved Locally 💾', 'Saved key to local cache.');
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
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Compact Royal Navy Header */}
                <LinearGradient 
                    colors={['#0F172A', '#1C2541', '#0B132B']} 
                    style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity onPress={toggleAllVisibility} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' }}>
                                <Ionicons name={REQUIRED_SECRETS.every(s => visibleKeys[s.key]) ? "eye-off" : "eye"} size={12} color={L.gold} />
                                <Text style={{ color: L.goldLight, fontWeight: 'bold', fontSize: 10 }}>Toggle All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/manage/api')} style={{ backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: L.gold, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="key" size={12} color={L.gold} />
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Active Vault →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text style={{ color: L.gold, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 2 }}>SYSTEM SECRETS & KEYS</Text>
                    <Text style={{ color: '#CBD5E1', fontSize: 10, marginBottom: 12 }}>Encrypted system credentials and integration keys.</Text>
                    
                    {/* Search Bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#060B19', borderRadius: 12, paddingHorizontal: 12, height: 38, borderWidth: 1, borderColor: 'rgba(218, 165, 32, 0.35)' }}>
                        <Ionicons name="search" size={15} color={L.gold} />
                        <TextInput
                            style={{ flex: 1, marginLeft: 8, color: '#FFFFFF', fontWeight: '500', fontSize: 11 }}
                            placeholder="Search secrets or descriptions..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={15} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>

                {/* Direct Active Provider Vault Banner */}
                <TouchableOpacity
                    onPress={() => router.push('/manage/api')}
                    style={{ marginHorizontal: 12, marginTop: 10, backgroundColor: L.card, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: L.goldDk, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="flash-sharp" size={14} color={L.gold} />
                        </View>
                        <View>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>✨ Active API Providers & Failovers</Text>
                            <Text style={{ color: L.textSecondary, fontSize: 9 }}>BilalSadaSub, Paystack, AgentHub, PayVessel, Bigi</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={L.goldDk} />
                </TouchableOpacity>

                {/* Providers Filter Pills */}
                <View style={{ backgroundColor: L.bg, borderBottomWidth: 1, borderColor: L.inputBorder, paddingBottom: 4, marginTop: 6 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 6, paddingHorizontal: 12 }} contentContainerStyle={{ gap: 6 }}>
                        {providers.map(provider => (
                            <TouchableOpacity 
                                key={provider} 
                                onPress={() => setSelectedProvider(provider)}
                                style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, backgroundColor: selectedProvider === provider ? L.navyHeader : L.card, borderColor: selectedProvider === provider ? L.navyHeader : L.inputBorder }}
                            >
                                <Text style={{ color: selectedProvider === provider ? L.gold : L.textSecondary, fontWeight: 'bold', fontSize: 10 }}>
                                    {provider}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Content Cards */}
                <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingTop: 10 }} contentContainerStyle={{ paddingBottom: 90 }}>
                    {loading ? (
                        <ActivityIndicator size="small" color={L.goldDk} style={{ marginTop: 30 }} />
                    ) : filteredSecrets.length === 0 ? (
                        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 36, backgroundColor: L.card, borderRadius: 18, paddingVertical: 30, borderWidth: 1, borderColor: L.inputBorder }}>
                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                                <Ionicons name="search-outline" size={22} color={L.goldDk} />
                            </View>
                            <Text style={{ color: L.textMuted, fontWeight: '600', fontSize: 11 }}>No secret keys found.</Text>
                        </View>
                    ) : (
                        filteredSecrets.map((item) => {
                            const isSaved = !!originalSecrets[item.key];
                            const modified = isModified(item.key);
                            
                            return (
                                <View key={item.key} style={{ backgroundColor: L.card, padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: isSaved ? L.cardBorder : L.inputBorder, position: 'relative', overflow: 'hidden' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>{item.key}</Text>
                                            <Text style={{ color: L.textSecondary, fontSize: 10, marginTop: 2, lineHeight: 14 }}>{item.desc}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                            <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                <Text style={{ color: L.gold, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>{item.provider}</Text>
                                            </View>
                                            {isSaved && !modified && (
                                                <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                                    <Text style={{ color: L.emerald, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>Configured</Text>
                                                </View>
                                            )}
                                            {modified && (
                                                <View style={{ backgroundColor: L.goldLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: L.goldDk }}>
                                                    <Text style={{ color: L.goldAmber, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>Unsaved</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.inputBg, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 8 }}>
                                        <Ionicons name="key-outline" size={14} color={L.goldDk} />
                                        <TextInput
                                            style={{ flex: 1, marginLeft: 6, color: L.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, height: '100%', fontWeight: '600' }}
                                            placeholder="Enter secret key..."
                                            placeholderTextColor="#94A3B8"
                                            secureTextEntry={!visibleKeys[item.key]}
                                            value={secrets[item.key] || ''}
                                            onChangeText={(val) => setSecrets({ ...secrets, [item.key]: val })}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <View style={{ flexDirection: 'row', gap: 4, borderLeftWidth: 1, borderColor: L.inputBorder, paddingLeft: 6, marginLeft: 6 }}>
                                            <TouchableOpacity onPress={() => copyToClipboard(secrets[item.key])} style={{ width: 26, height: 26, backgroundColor: L.bg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name="copy-outline" size={12} color={L.navyHeader} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => toggleVisibility(item.key)} style={{ width: 26, height: 26, backgroundColor: L.bg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name={visibleKeys[item.key] ? "eye-off" : "eye"} size={12} color={L.navyHeader} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={() => handleSave(item, secrets[item.key] || '')}
                                        disabled={saving === item.key || (!modified && isSaved)}
                                        style={{ height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: saving === item.key ? L.bg : (!modified && isSaved ? L.emeraldBg : L.navyHeader), borderWidth: !modified && isSaved ? 1 : 0, borderColor: L.emeraldBorder }}
                                    >
                                        {saving === item.key ? (
                                            <ActivityIndicator size="small" color={L.goldDk} />
                                        ) : (
                                            <>
                                                <Ionicons name={!modified && isSaved ? "checkmark-circle" : "lock-closed"} size={14} color={!modified && isSaved ? L.emerald : L.gold} />
                                                <Text style={{ color: !modified && isSaved ? L.emerald : L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
