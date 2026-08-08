import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator, 
    Alert, Modal, TextInput, StyleSheet, useWindowDimensions, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

// Official Brand Colors (Navy & Gold)
const T = {
    navy: '#0d1b3e',
    navyMid: '#142258',
    navyDark: '#09122c',
    gold: '#f5a623',
    goldDk: '#d4890e',
    goldLight: '#fffdf5',
    goldBg: 'rgba(245,166,35,0.12)',
    white: '#ffffff',
    text: '#0d1b3e',
    textSub: '#5a6890',
    border: '#cbd5e1',
    bg: '#f4f6fb',
    cardBg: '#ffffff',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#0284c7'
};

interface ProviderWallet {
    id: string;
    name: string;
    category?: string;
    balance: number;
    currency: string;
    latencyMs?: number;
    status: 'healthy' | 'low' | 'critical' | 'error' | 'unconfigured';
    error?: string;
    allowDeposit: boolean;
    allowWithdrawal: boolean;
    depositAccount?: {
        bankName: string;
        accountNumber: string;
        accountName: string;
        instructions: string;
    };
}

const NIGERIAN_BANKS = [
    { name: 'Access Bank', code: '044' },
    { name: 'Guaranty Trust Bank (GTB)', code: '058' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'United Bank for Africa (UBA)', code: '033' },
    { name: 'Zenith Bank', code: '057' },
    { name: 'Kuda Bank', code: '50211' },
    { name: 'OPay', code: '999992' },
    { name: 'Palmpay', code: '999991' },
    { name: 'Moniepoint', code: '50515' },
    { name: 'Sterling Bank', code: '232' },
    { name: 'Wema Bank (ALAT)', code: '035' },
];

export default function LiquidityVaultScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [providers, setProviders] = useState<ProviderWallet[]>([]);
    const [vaultSecrets, setVaultSecrets] = useState<Record<string, string>>({});
    const [activeFilter, setActiveFilter] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal States
    const [selectedDepositProvider, setSelectedDepositProvider] = useState<ProviderWallet | null>(null);
    const [selectedWithdrawProvider, setSelectedWithdrawProvider] = useState<ProviderWallet | null>(null);
    const [selectedTokenProvider, setSelectedTokenProvider] = useState<ProviderWallet | null>(null);

    // Vault Token Edit Form
    const [tokenKeyName, setTokenKeyName] = useState('');
    const [tokenValue, setTokenValue] = useState('');
    const [tokenSaving, setTokenSaving] = useState(false);
    // BilalSadaSub-specific: username + password
    const [bilalUsername, setBilalUsername] = useState('');
    const [bilalPassword, setBilalPassword] = useState('');
    // BigiSub-specific: username + password
    const [bigiUsername, setBigiUsername] = useState('');
    const [bigiPassword, setBigiPassword] = useState('');

    // Withdrawal Form States
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawAccount, setWithdrawAccount] = useState('');
    const [selectedBank, setSelectedBank] = useState(NIGERIAN_BANKS[0]);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [copiedText, setCopiedText] = useState(false);

    useEffect(() => {
        fetchProviderBalances();
    }, []);

    const fetchProviderBalances = async () => {
        setRefreshing(true);
        try {
            // 1. Invoke Edge Function first (uses SERVICE_ROLE_KEY to bypass RLS)
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('check-provider-balances', {
                body: {}
            });

            if (!edgeError && edgeData?.success && edgeData?.providers && edgeData.providers.length > 0) {
                setTotalBalance(edgeData.totalBalance || 0);
                setProviders(edgeData.providers);
                if (edgeData.secrets) {
                    setVaultSecrets(edgeData.secrets);
                }
                return;
            }

            // 2. Direct client DB query fallback
            const secretsMap: Record<string, string> = {};

            const { data: settingsData } = await supabase.from('app_settings').select('*');
            if (settingsData) {
                settingsData.forEach(s => {
                    if (s.value && s.value.trim() !== '') secretsMap[s.key.toUpperCase()] = s.value.trim();
                });
            }

            const { data: secretsData } = await supabase.from('system_secrets').select('*');
            if (secretsData) {
                secretsData.forEach(s => {
                    if (s.value && s.value.trim() !== '') secretsMap[s.key.toUpperCase()] = s.value.trim();
                });
            }

            setVaultSecrets(secretsMap);

            const agentHubKey = secretsMap['AGENTHUB_API_KEY'] || secretsMap['AGENTHUB_KEY'] || '';
            const bilalToken = secretsMap['BILALSADASUB_TOKEN'] || secretsMap['BILAL_TOKEN'] || secretsMap['BILALSADASUB_API_KEY'] || '';
            const paystackSecret = secretsMap['PAYSTACK_SECRET_KEY'] || secretsMap['PAYSTACK_KEY'] || '';
            const clubkonnectKey = secretsMap['CLUBKONNECT_API_KEY'] || secretsMap['CLUBKONNECT_KEY'] || '';
            const idProKey = secretsMap['IDPRO_API_KEY'] || secretsMap['IDPRO_KEY'] || '';
            const payVesselKey = secretsMap['PAYVESSEL_API_KEY'] || secretsMap['PAYVESSEL_KEY'] || secretsMap['PAYVESSEL_SECRET_KEY'] || secretsMap['PAYBESSEL_API_KEY'] || secretsMap['PAYBESSEL_KEY'] || '';
            const nineBoostKey = secretsMap['NINEBOOST_API_KEY'] || secretsMap['NINEBOOST_KEY'] || secretsMap['NINEBOOST_TOKEN'] || '';
            const nowPaymentsKey = secretsMap['NOWPAYMENTS_API_KEY'] || secretsMap['NOWPAYMENTS_KEY'] || '';
            const bigiToken = secretsMap['BIGI_API_TOKEN'] || secretsMap['BIGI_TOKEN'] || '';
            const termiiKey = secretsMap['TERMII_API_KEY'] || secretsMap['TERMII_KEY'] || '';
            const monnifyApiKey = secretsMap['MONNIFY_API_KEY'] || secretsMap['MONNIFY_KEY'] || '';

            const list: ProviderWallet[] = [
                {
                    id: 'agenthub',
                    name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
                    category: 'Digital Identity & CAC',
                    balance: 0,
                    currency: 'NGN',
                    status: agentHubKey ? 'healthy' : 'unconfigured',
                    error: agentHubKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Sterling Bank / Monnify (AgentHub)',
                        accountNumber: '9081234567',
                        accountName: 'AgentHub Corporate / ABUMAFHAL',
                        instructions: 'Transfer to this virtual account to top up AgentHub balance.'
                    }
                },
                {
                    id: 'bilalsadasub',
                    name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: bilalToken ? 'healthy' : 'unconfigured',
                    error: bilalToken ? undefined : 'Token not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Sterling / Monnify (BilalSadaSub)',
                        accountNumber: '8910293841',
                        accountName: 'BilalSadaSub Telecom',
                        instructions: 'Auto-funding bank account for BilalSadaSub VTU portal.'
                    }
                },
                {
                    id: 'paystack',
                    name: 'Paystack (Payment Gateway & Settlements)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: paystackSecret ? 'healthy' : 'unconfigured',
                    error: paystackSecret ? undefined : 'Secret Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'clubkonnect',
                    name: 'Clubkonnect / NelloByte API (VTU Telecom)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: clubkonnectKey ? 'healthy' : 'unconfigured',
                    error: clubkonnectKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'idpro',
                    name: 'IDPro (Identity & KYC Verification API)',
                    category: 'Digital Identity & CAC',
                    balance: 0,
                    currency: 'NGN',
                    status: idProKey ? 'healthy' : 'unconfigured',
                    error: idProKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'payvessel',
                    name: 'PayVessel (Payment & Payout Gateway)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: payVesselKey ? 'healthy' : 'unconfigured',
                    error: payVesselKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'nineboost',
                    name: 'NineBoost (Social Media Marketing SMM Panel)',
                    category: 'Marketing Services',
                    balance: 0,
                    currency: 'USD',
                    status: nineBoostKey ? 'healthy' : 'unconfigured',
                    error: nineBoostKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'nowpayments',
                    name: 'NowPayments (Crypto Payment Gateway)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'USD',
                    status: nowPaymentsKey ? 'healthy' : 'unconfigured',
                    error: nowPaymentsKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'bigi',
                    name: 'Bigi VTU Portal (SME Data & Airtime)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: bigiToken ? 'healthy' : 'unconfigured',
                    error: bigiToken ? undefined : 'Token not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'termii',
                    name: 'Termii (SMS & OTP Messaging Gateway)',
                    category: 'SMS & Communications',
                    balance: 0,
                    currency: 'NGN',
                    status: termiiKey ? 'healthy' : 'unconfigured',
                    error: termiiKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                }
            ];

            setProviders(list);
        } catch (e: any) {
            console.error("Provider Balance Fetch Error", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2000);
        } catch (_) {}
    };

    const handleOpenTokenModal = (p: ProviderWallet) => {
        setSelectedTokenProvider(p);
        const secretMap: Record<string, string> = {
            agenthub: 'AGENTHUB_API_KEY',
            bilalsadasub: 'BILALSADASUB_TOKEN',
            paystack: 'PAYSTACK_SECRET_KEY',
            clubkonnect: 'CLUBKONNECT_API_KEY',
            idpro: 'IDPRO_API_KEY',
            payvessel: 'PAYVESSEL_API_KEY',
            nineboost: 'NINEBOOST_API_KEY',
            nowpayments: 'NOWPAYMENTS_API_KEY',
            bigi: 'BIGI_API_TOKEN',
            termii: 'TERMII_API_KEY'
        };
        const keyName = secretMap[p.id] || 'GENERIC_API_KEY';
        setTokenKeyName(keyName);

        let existingVal = vaultSecrets[keyName] || vaultSecrets[keyName.replace('_API_KEY', '_KEY').replace('_TOKEN', '_KEY')] || '';
        if (p.id === 'payvessel' && !existingVal) {
            existingVal = vaultSecrets['PAYBESSEL_API_KEY'] || vaultSecrets['PAYBESSEL_KEY'] || '';
        }
        setTokenValue(existingVal);

        // Pre-fill BilalSadaSub username & password from vault
        if (p.id === 'bilalsadasub') {
            setBilalUsername(
                vaultSecrets['BILALSADASUB_USERNAME'] || vaultSecrets['BILAL_USERNAME'] || vaultSecrets['BILALSADASUB_USER'] || ''
            );
            setBilalPassword(
                vaultSecrets['BILALSADASUB_PASSWORD'] || vaultSecrets['BILAL_PASSWORD'] || vaultSecrets['BILALSADASUB_PASS'] || ''
            );
        } else {
            setBilalUsername('');
            setBilalPassword('');
        }

        // Pre-fill BigiSub username & password from vault
        if (p.id === 'bigi') {
            setBigiUsername(
                vaultSecrets['BIGISUB_USERNAME'] || vaultSecrets['BIGI_USERNAME'] || vaultSecrets['BIGI_USER'] || ''
            );
            setBigiPassword(
                vaultSecrets['BIGISUB_PASSWORD'] || vaultSecrets['BIGI_PASSWORD'] || vaultSecrets['BIGI_PASS'] || ''
            );
        } else {
            setBigiUsername('');
            setBigiPassword('');
        }
    };

    const handleSaveVaultToken = async () => {
        const isBilal = selectedTokenProvider?.id === 'bilalsadasub';
        const isBigi = selectedTokenProvider?.id === 'bigi';

        // For BilalSadaSub / BigiSub: require username + password (token is optional bonus)
        if (isBilal) {
            if (!bilalUsername.trim() || !bilalPassword.trim()) {
                Alert.alert("Invalid Input", "Please enter both Username and Password for BilalSadaSub.");
                return;
            }
        } else if (isBigi) {
            if (!bigiUsername.trim() || !bigiPassword.trim()) {
                Alert.alert("Invalid Input", "Please enter both Username and Password for BigiSub.");
                return;
            }
        } else {
            if (!tokenValue || tokenValue.trim() === '') {
                Alert.alert("Invalid Input", "Please enter a valid secret key value.");
                return;
            }
        }

        setTokenSaving(true);
        try {
            const secretKeyMap: Record<string, string> = {
                agenthub: 'AGENTHUB_API_KEY',
                bilalsadasub: 'BILALSADASUB_TOKEN',
                paystack: 'PAYSTACK_SECRET_KEY',
                clubkonnect: 'CLUBKONNECT_API_KEY',
                idpro: 'IDPRO_API_KEY',
                payvessel: 'PAYVESSEL_API_KEY',
                nineboost: 'NINEBOOST_API_KEY',
                nowpayments: 'NOWPAYMENTS_API_KEY',
                bigi: 'BIGI_API_TOKEN',
                termii: 'TERMII_API_KEY'
            };

            const secretKey = tokenKeyName || secretKeyMap[selectedTokenProvider?.id || ''] || 'GENERIC_API_KEY';

            if (isBilal) {
                // Save username & password to vault
                const credsToSave = [
                    { key: 'BILALSADASUB_USERNAME', value: bilalUsername.trim() },
                    { key: 'BILALSADASUB_PASSWORD', value: bilalPassword.trim() },
                ];
                if (tokenValue.trim()) {
                    credsToSave.push({ key: 'BILALSADASUB_TOKEN', value: tokenValue.trim() });
                }
                for (const cred of credsToSave) {
                    await supabase.from('system_secrets').upsert({
                        key: cred.key, value: cred.value,
                        description: `BilalSadaSub credential - ${cred.key}`,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    await supabase.from('app_settings').upsert({
                        key: cred.key, value: cred.value,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    setVaultSecrets(prev => ({ ...prev, [cred.key]: cred.value }));
                }
            } else if (isBigi) {
                // Save username & password to vault
                const credsToSave = [
                    { key: 'BIGISUB_USERNAME', value: bigiUsername.trim() },
                    { key: 'BIGISUB_PASSWORD', value: bigiPassword.trim() },
                ];
                if (tokenValue.trim()) {
                    credsToSave.push({ key: 'BIGI_API_TOKEN', value: tokenValue.trim() });
                }
                for (const cred of credsToSave) {
                    await supabase.from('system_secrets').upsert({
                        key: cred.key, value: cred.value,
                        description: `BigiSub credential - ${cred.key}`,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    await supabase.from('app_settings').upsert({
                        key: cred.key, value: cred.value,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    setVaultSecrets(prev => ({ ...prev, [cred.key]: cred.value }));
                }
            } else {
                // Normal save for other providers
                await supabase.from('system_secrets').upsert({
                    key: secretKey,
                    value: tokenValue.trim(),
                    description: `Updated secret for ${selectedTokenProvider?.name}`,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
                await supabase.from('app_settings').upsert({
                    key: secretKey,
                    value: tokenValue.trim(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
                setVaultSecrets(prev => ({ ...prev, [secretKey]: tokenValue.trim() }));
            }

            await supabase.functions.invoke('check-provider-balances', { body: {} });

            Alert.alert("Success 🎉", (isBilal || isBigi)
                ? `${selectedTokenProvider?.name} credentials saved to Vault! Balance will update now.`
                : `Saved ${secretKey} to Vault successfully!`
            );
            setSelectedTokenProvider(null);
            setTokenValue('');
            setBilalUsername('');
            setBilalPassword('');
            setBigiUsername('');
            setBigiPassword('');
            fetchProviderBalances();
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save secret key to Vault.");
        } finally {
            setTokenSaving(false);
        }
    };

    const handleExecuteWithdrawal = async () => {
        if (!withdrawAmount || Number(withdrawAmount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid withdrawal amount.");
            return;
        }

        if (!withdrawAccount || withdrawAccount.length < 10) {
            Alert.alert("Invalid Account", "Please enter a valid 10-digit bank account number.");
            return;
        }

        setWithdrawLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('provider-wallet-action', {
                body: {
                    action: 'withdraw',
                    providerId: selectedWithdrawProvider?.id,
                    amount: Number(withdrawAmount),
                    bankCode: selectedBank.code,
                    accountNumber: withdrawAccount.trim(),
                    reason: withdrawReason || 'Super Admin Wallet Transfer'
                }
            });

            if (error) throw error;

            if (data?.success) {
                Alert.alert("Withdrawal Successful 🎉", data.message || "Funds transferred successfully.");
                setSelectedWithdrawProvider(null);
                setWithdrawAmount('');
                setWithdrawAccount('');
                fetchProviderBalances();
            } else {
                Alert.alert("Withdrawal Error", data?.error || "Failed to process withdrawal.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An error occurred during withdrawal processing.");
        } finally {
            setWithdrawLoading(false);
        }
    };

    // Filter providers
    const filteredProviders = providers.filter(p => {
        const matchesCategory = activeFilter === 'All'
            || (activeFilter === 'VTU' && p.category === 'VTU Telecom')
            || (activeFilter === 'Identity' && p.category === 'Digital Identity & CAC')
            || (activeFilter === 'Gateways' && p.category === 'Payment Gateway')
            || (activeFilter === 'Comms' && (p.category === 'SMS & Communications' || p.category === 'Marketing Services'));
        
        const matchesSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesCategory && matchesSearch;
    });

    const healthyCount = providers.filter(p => p.status === 'healthy').length;
    const unconfiguredCount = providers.filter(p => p.status === 'unconfigured').length;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'API Wallet & Finance Hub',
                headerStyle: { backgroundColor: T.navyDark },
                headerTintColor: T.white,
                headerRight: () => (
                    <TouchableOpacity onPress={fetchProviderBalances} style={{ paddingRight: 12 }}>
                        <Ionicons name="sync-outline" size={20} color={T.gold} />
                    </TouchableOpacity>
                )
            }} />

            <ScrollView 
                contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}
                showsVerticalScrollIndicator={false}
            >
                {/* Aggregate Total Float Hero Banner */}
                <LinearGradient
                    colors={[T.navyDark, T.navy, T.navyMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    {/* Gold Decorative Accent Stripe */}
                    <View style={styles.heroAccentStripe} />

                    <View style={styles.heroTopRow}>
                        <View>
                            <View style={styles.heroBadgeRow}>
                                <Ionicons name="wallet-outline" size={12} color={T.gold} />
                                <Text style={styles.heroSubTitle}>REAL-TIME API AGGREGATE FLOAT BALANCE</Text>
                            </View>
                            <Text style={styles.heroBalanceText}>
                                ₦ {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={fetchProviderBalances} 
                            disabled={refreshing}
                            style={styles.refreshBtn}
                            activeOpacity={0.85}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color={T.gold} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="sync" size={13} color={T.gold} style={{ marginRight: 5 }} />
                                    <Text style={styles.refreshBtnText}>Sync Balances</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Stat Badges Grid */}
                    <View style={styles.badgeGridRow}>
                        <View style={styles.statBadge}>
                            <Ionicons name="checkmark-circle" size={13} color={T.success} />
                            <Text style={styles.statBadgeText}>
                                {healthyCount} Healthy Vendors
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="alert-circle-outline" size={13} color={unconfiguredCount > 0 ? T.warning : T.gold} />
                            <Text style={styles.statBadgeText}>
                                {unconfiguredCount} Unconfigured
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="key-outline" size={13} color={T.gold} />
                            <Text style={styles.statBadgeText}>
                                {providers.length} Active API Integrations
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Search Bar Input */}
                <View style={styles.searchBarBox}>
                    <Ionicons name="search-outline" size={16} color={T.textSub} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search API vendors by name or category..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={T.textSub} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Category Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                    {['All', 'VTU', 'Identity', 'Gateways', 'Comms'].map(f => (
                        <TouchableOpacity 
                            key={f}
                            onPress={() => setActiveFilter(f)}
                            style={[
                                styles.filterChip,
                                activeFilter === f && styles.filterChipActive
                            ]}
                        >
                            <Text style={[
                                styles.filterChipText,
                                activeFilter === f && styles.filterChipTextActive
                            ]}>
                                {f === 'All' ? `All (${providers.length})` : f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>API Vendor Balances & Deposit Vault</Text>
                    <TouchableOpacity onPress={() => router.push('/manage/api')}>
                        <Text style={styles.manageVaultLink}>Manage Credentials →</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={T.navy} />
                        <Text style={styles.loadingText}>Fetching live balances from API Vault providers...</Text>
                    </View>
                ) : filteredProviders.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="search-outline" size={32} color={T.textSub} />
                        <Text style={styles.emptyTitle}>No API Providers Found</Text>
                        <Text style={styles.emptySub}>No vendor matched your search criteria.</Text>
                    </View>
                ) : (
                    <View style={styles.providersGrid}>
                        {filteredProviders.map((p) => {
                            const isHealthy = p.status === 'healthy';
                            const isLow = p.status === 'low';
                            const isCritical = p.status === 'critical';
                            const isUnconfigured = p.status === 'unconfigured';

                            return (
                                <View key={p.id} style={styles.providerCard}>
                                    {/* Left Accent Bar */}
                                    <View style={[
                                        styles.providerCardLeftBar,
                                        { backgroundColor: isHealthy ? T.success : isUnconfigured ? T.warning : T.danger }
                                    ]} />

                                    <View style={styles.providerCardHeader}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.providerCategory}>{p.category || 'API Vendor'}</Text>
                                                {p.latencyMs && (
                                                    <Text style={styles.latencyTag}>⚡ {p.latencyMs}ms</Text>
                                                )}
                                            </View>
                                            <Text style={styles.providerName}>{p.name}</Text>
                                        </View>

                                        {/* Status Badge */}
                                        <View style={[
                                            styles.statusPill,
                                            isHealthy && { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
                                            isLow && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
                                            isCritical && { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
                                            isUnconfigured && { backgroundColor: '#fff7ed', borderColor: '#f97316' }
                                        ]}>
                                            <Text style={[
                                                styles.statusPillText,
                                                isHealthy && { color: '#15803d' },
                                                isLow && { color: '#b45309' },
                                                isCritical && { color: '#b91c1c' },
                                                isUnconfigured && { color: '#c2410c' }
                                            ]}>
                                                {isUnconfigured ? 'UNCONFIGURED' : 'HEALTHY'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Balance Value */}
                                    <View style={styles.balanceContainer}>
                                        <Text style={styles.currencySymbol}>{p.currency === 'USD' ? '$' : '₦'}</Text>
                                        <Text style={styles.providerBalance}>
                                            {p.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </Text>
                                    </View>

                                    {p.error && (
                                        <Text style={styles.providerErrorText}>
                                            💡 {p.error}
                                        </Text>
                                    )}

                                    {/* Action Buttons Row */}
                                    <View style={styles.actionButtonsRow}>
                                        {p.allowDeposit && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedDepositProvider(p)}
                                                style={[styles.actionBtn, styles.depositBtn]}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="wallet-outline" size={13} color={T.navy} style={{ marginRight: 4 }} />
                                                <Text style={[styles.actionBtnText, { color: T.navy }]}>Fund Wallet</Text>
                                            </TouchableOpacity>
                                        )}

                                        {p.allowWithdrawal && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedWithdrawProvider(p)}
                                                style={[styles.actionBtn, styles.withdrawBtn]}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="arrow-up-circle-outline" size={13} color={T.goldDk} style={{ marginRight: 4 }} />
                                                <Text style={[styles.actionBtnText, { color: T.goldDk }]}>Withdraw</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity 
                                            onPress={() => handleOpenTokenModal(p)}
                                            style={[styles.actionBtn, styles.tokenBtn, isUnconfigured && styles.tokenBtnHighlight]}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="key-outline" size={13} color={isUnconfigured ? T.white : T.navy} style={{ marginRight: 4 }} />
                                            <Text style={[styles.actionBtnText, { color: isUnconfigured ? T.white : T.navy }]}>
                                                {isUnconfigured ? 'Set Token' : 'Vault Key'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

            </ScrollView>

            {/* Deposit / Fund Account Modal */}
            <Modal transparent visible={!!selectedDepositProvider} animationType="fade" onRequestClose={() => setSelectedDepositProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.modalTitle}>Fund {selectedDepositProvider?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedDepositProvider(null)}>
                                <Ionicons name="close-circle" size={24} color={T.textSub} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Transfer funds to the dedicated bank account details below to instantly top up your API vendor balance.
                        </Text>

                        {selectedDepositProvider?.depositAccount ? (
                            <View style={styles.bankDetailCard}>
                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Bank Name:</Text>
                                    <Text style={styles.bankValue}>{selectedDepositProvider.depositAccount.bankName}</Text>
                                </View>

                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Account Number:</Text>
                                    <TouchableOpacity 
                                        onPress={() => copyToClipboard(selectedDepositProvider.depositAccount!.accountNumber)}
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        <Text style={[styles.bankValue, { color: T.navy, marginRight: 6 }]}>
                                            {selectedDepositProvider.depositAccount.accountNumber}
                                        </Text>
                                        <Ionicons name="copy-outline" size={14} color={T.goldDk} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Account Name:</Text>
                                    <Text style={styles.bankValue}>{selectedDepositProvider.depositAccount.accountName}</Text>
                                </View>

                                {copiedText && (
                                    <Text style={styles.copySuccessToast}>
                                        ✓ Account number copied to clipboard!
                                    </Text>
                                )}

                                <Text style={styles.bankInstructions}>
                                    💡 {selectedDepositProvider.depositAccount.instructions}
                                </Text>
                            </View>
                        ) : (
                            <Text style={{ color: T.textSub, marginVertical: 14, textAlign: 'center', fontSize: 12 }}>
                                Direct bank funding accounts are managed via the provider merchant portal.
                            </Text>
                        )}

                        <TouchableOpacity onPress={() => setSelectedDepositProvider(null)} style={styles.modalCloseBtn}>
                            <Text style={styles.modalCloseBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Vault Token Edit Modal */}
            <Modal transparent visible={!!selectedTokenProvider} animationType="fade" onRequestClose={() => setSelectedTokenProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.modalTitle}>Vault Key — {selectedTokenProvider?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedTokenProvider(null)}>
                                <Ionicons name="close-circle" size={24} color={T.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedTokenProvider?.id === 'bilalsadasub' || selectedTokenProvider?.id === 'bigi' ? (
                            // BilalSadaSub & BigiSub: need Username + Password (Basic Auth / JWT)
                            <>
                                <View style={{
                                    backgroundColor: '#fffbeb', borderRadius: 10, padding: 10,
                                    borderLeftWidth: 3, borderLeftColor: T.gold, marginBottom: 14
                                }}>
                                    <Text style={{ color: '#92400e', fontSize: 11.5, fontWeight: '700' }}>
                                        🔐 {selectedTokenProvider?.name} uses Username + Password authentication.
                                        Enter your login credentials below — they are saved securely in Vault.
                                    </Text>
                                </View>

                                <Text style={styles.inputLabel}>Username (Login)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder={`Enter your ${selectedTokenProvider?.name} username`}
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={selectedTokenProvider?.id === 'bigi' ? bigiUsername : bilalUsername}
                                    onChangeText={selectedTokenProvider?.id === 'bigi' ? setBigiUsername : setBilalUsername}
                                />

                                <Text style={styles.inputLabel}>Password</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder={`Enter your ${selectedTokenProvider?.name} password`}
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={true}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={selectedTokenProvider?.id === 'bigi' ? bigiPassword : bilalPassword}
                                    onChangeText={selectedTokenProvider?.id === 'bigi' ? setBigiPassword : setBilalPassword}
                                />

                                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Access Token (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Paste token if you have one (optional)"
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="none"
                                    value={tokenValue}
                                    onChangeText={setTokenValue}
                                />
                            </>
                        ) : (
                            // All other providers: just show Secret Key Name + Token Value
                            <>
                                <Text style={styles.modalSubText}>
                                    View or update the secret API key for this vendor stored in Vault.
                                </Text>

                                <Text style={styles.inputLabel}>Secret Key Name</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: '#e2e8f0', color: T.textSub }]}
                                    value={tokenKeyName}
                                    editable={false}
                                />

                                <Text style={styles.inputLabel}>Secret Token Value</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Paste API Key or Token here..."
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={false}
                                    value={tokenValue}
                                    onChangeText={setTokenValue}
                                />
                            </>
                        )}

                        <TouchableOpacity
                            onPress={handleSaveVaultToken}
                            disabled={tokenSaving}
                            style={styles.executeWithdrawBtn}
                            activeOpacity={0.85}
                        >
                            {tokenSaving ? (
                                <ActivityIndicator color={T.navy} size="small" />
                            ) : (
                                <Text style={styles.executeWithdrawBtnText}>
                                    {selectedTokenProvider?.id === 'bilalsadasub' ? 'Save Credentials to Vault' : 'Save Secret Key to Vault'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Withdrawal / Transfer Out Modal */}
            <Modal transparent visible={!!selectedWithdrawProvider} animationType="fade" onRequestClose={() => setSelectedWithdrawProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.modalTitle}>Withdraw from {selectedWithdrawProvider?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedWithdrawProvider(null)}>
                                <Ionicons name="close-circle" size={24} color={T.textSub} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Transfer funds out of provider balance directly to your destination Nigerian bank account.
                        </Text>

                        <Text style={styles.inputLabel}>Amount (₦)</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="50000"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={withdrawAmount}
                            onChangeText={setWithdrawAmount}
                        />

                        <Text style={styles.inputLabel}>Select Destination Bank</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                            {NIGERIAN_BANKS.map((b) => (
                                <TouchableOpacity 
                                    key={b.code}
                                    onPress={() => setSelectedBank(b)}
                                    style={[
                                        styles.bankChip,
                                        selectedBank.code === b.code && styles.bankChipSelected
                                    ]}
                                >
                                    <Text style={[
                                        styles.bankChipText,
                                        selectedBank.code === b.code && { color: T.navy, fontWeight: '900' }
                                    ]}>{b.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.inputLabel}>10-Digit Account Number</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="0123456789"
                            placeholderTextColor="#94a3b8"
                            keyboardType="number-pad"
                            maxLength={10}
                            value={withdrawAccount}
                            onChangeText={setWithdrawAccount}
                        />

                        <TouchableOpacity 
                            onPress={handleExecuteWithdrawal}
                            disabled={withdrawLoading}
                            style={styles.executeWithdrawBtn}
                            activeOpacity={0.85}
                        >
                            {withdrawLoading ? (
                                <ActivityIndicator color={T.navy} size="small" />
                            ) : (
                                <Text style={styles.executeWithdrawBtnText}>Execute Live Withdrawal Transfer</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    desktopScrollContent: {
        maxWidth: 780,
        alignSelf: 'center',
        width: '100%',
    },
    heroCard: {
        borderRadius: 20,
        padding: 22,
        marginBottom: 16,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: T.navyDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    heroAccentStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        backgroundColor: T.gold,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
    },
    heroSubTitle: {
        color: T.gold,
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    heroBalanceText: {
        color: T.white,
        fontWeight: '900',
        fontSize: 28,
        letterSpacing: 0.5,
    },
    refreshBtn: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: T.gold,
    },
    refreshBtnText: {
        color: T.gold,
        fontSize: 11,
        fontWeight: '900',
    },
    badgeGridRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    statBadgeText: {
        color: '#e2e8f0',
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 5,
    },
    searchBarBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.cardBg,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: T.navy,
        fontWeight: '600',
    },
    filterBar: {
        marginBottom: 16,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 99,
        backgroundColor: T.cardBg,
        borderWidth: 1,
        borderColor: T.border,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: T.navy,
        borderColor: T.navy,
    },
    filterChipText: {
        color: T.textSub,
        fontSize: 12,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: T.gold,
        fontWeight: '900',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 15,
    },
    manageVaultLink: {
        color: T.goldDk,
        fontSize: 12,
        fontWeight: '800',
    },
    loadingBox: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: T.textSub,
        marginTop: 10,
        fontWeight: '600',
        fontSize: 12,
    },
    emptyBox: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: T.cardBg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.border,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: T.navy,
        marginTop: 8,
    },
    emptySub: {
        fontSize: 12,
        color: T.textSub,
        marginTop: 4,
    },
    providersGrid: {
        gap: 12,
    },
    providerCard: {
        backgroundColor: T.cardBg,
        borderRadius: 16,
        padding: 16,
        paddingLeft: 20,
        borderWidth: 1,
        borderColor: T.border,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    providerCardLeftBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 5,
    },
    providerCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    providerCategory: {
        color: T.textSub,
        fontSize: 9.5,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    latencyTag: {
        color: T.success,
        fontSize: 9.5,
        fontWeight: '800',
        marginLeft: 6,
    },
    providerName: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 14.5,
        marginTop: 2,
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 99,
        borderWidth: 1,
    },
    statusPillText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 6,
    },
    currencySymbol: {
        fontSize: 16,
        fontWeight: '900',
        color: T.goldDk,
        marginRight: 3,
    },
    providerBalance: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 22,
    },
    providerErrorText: {
        color: T.warning,
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 8,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    actionBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    depositBtn: {
        backgroundColor: T.gold,
        borderColor: T.goldDk,
    },
    withdrawBtn: {
        backgroundColor: T.navy,
        borderColor: T.navyDark,
    },
    tokenBtn: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
        maxWidth: 90,
    },
    tokenBtnHighlight: {
        backgroundColor: T.warning,
        borderColor: T.warning,
        maxWidth: 100,
    },
    actionBtnText: {
        fontSize: 11.5,
        fontWeight: '900',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 27, 62, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
    },
    modalCard: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: T.white,
        borderRadius: 20,
        padding: 22,
        borderWidth: 2,
        borderColor: T.gold,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: T.navyDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    modalDecorStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        backgroundColor: T.gold,
    },
    modalTitle: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 16.5,
    },
    modalSubText: {
        color: T.textSub,
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 16,
    },
    bankDetailCard: {
        backgroundColor: T.goldBg,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(245,166,35,0.3)',
        marginBottom: 16,
    },
    bankDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    bankLabel: {
        color: T.textSub,
        fontSize: 11.5,
        fontWeight: '700',
    },
    bankValue: {
        color: T.navy,
        fontSize: 12.5,
        fontWeight: '900',
    },
    copySuccessToast: {
        color: T.success,
        fontSize: 11,
        fontWeight: '800',
        marginTop: 8,
        textAlign: 'center',
    },
    bankInstructions: {
        color: T.navy,
        fontSize: 11,
        marginTop: 10,
        lineHeight: 16,
        fontWeight: '600',
    },
    modalCloseBtn: {
        height: 42,
        borderRadius: 10,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseBtnText: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 13,
    },
    inputLabel: {
        color: T.navy,
        fontSize: 11.5,
        fontWeight: '800',
        marginBottom: 5,
    },
    modalInput: {
        height: 42,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: '#f8fafc',
        color: T.navy,
        paddingHorizontal: 12,
        fontSize: 12.5,
        fontWeight: '700',
        marginBottom: 12,
    },
    bankChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: T.border,
        marginRight: 6,
    },
    bankChipSelected: {
        backgroundColor: T.gold,
        borderColor: T.goldDk,
    },
    bankChipText: {
        color: T.navy,
        fontSize: 11.5,
        fontWeight: '700',
    },
    executeWithdrawBtn: {
        height: 44,
        borderRadius: 10,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    executeWithdrawBtnText: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 14,
    },
});

