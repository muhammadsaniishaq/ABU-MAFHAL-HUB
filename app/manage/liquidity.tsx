import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator, 
    Alert, Modal, TextInput, StyleSheet, useWindowDimensions, Clipboard, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const latency = Date.now() - startTime;
        clearTimeout(id);
        return { response, latency };
    } catch (error: any) {
        clearTimeout(id);
        const latency = Date.now() - startTime;
        throw { error, latency };
    }
}

export default function LiquidityVaultScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [providers, setProviders] = useState<ProviderWallet[]>([]);
    const [activeFilter, setActiveFilter] = useState<string>('All');

    // Modal States
    const [selectedDepositProvider, setSelectedDepositProvider] = useState<ProviderWallet | null>(null);
    const [selectedWithdrawProvider, setSelectedWithdrawProvider] = useState<ProviderWallet | null>(null);
    const [selectedTokenProvider, setSelectedTokenProvider] = useState<ProviderWallet | null>(null);

    // Vault Token Edit Form
    const [tokenKeyName, setTokenKeyName] = useState('');
    const [tokenValue, setTokenValue] = useState('');
    const [tokenSaving, setTokenSaving] = useState(false);

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
            // 1. Try invoking Edge Function first (uses SERVICE_ROLE_KEY to bypass RLS)
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('check-provider-balances', {
                body: {}
            });

            if (!edgeError && edgeData?.success && edgeData?.providers && edgeData.providers.length > 0) {
                setTotalBalance(edgeData.totalBalance || 0);
                setProviders(edgeData.providers);
                return;
            }

            // 2. Direct DB fallback if Edge Function is un-deployed
            const secrets: Record<string, string> = {};

            const { data: settingsData } = await supabase.from('app_settings').select('*');
            if (settingsData) {
                settingsData.forEach(s => {
                    if (s.value && s.key) secrets[s.key.toUpperCase()] = s.value.trim();
                });
            }

            const { data: secretsData } = await supabase.from('system_secrets').select('*');
            if (secretsData) {
                secretsData.forEach(s => {
                    if (s.value && s.key) secrets[s.key.toUpperCase()] = s.value.trim();
                });
            }

            const agentHubKey = secrets['AGENTHUB_API_KEY'] || secrets['AGENTHUB_KEY'] || '';
            const bilalToken = secrets['BILALSADASUB_TOKEN'] || secrets['BILAL_TOKEN'] || '';
            const paystackSecret = secrets['PAYSTACK_SECRET_KEY'] || secrets['PAYSTACK_KEY'] || '';
            const clubkonnectKey = secrets['CLUBKONNECT_API_KEY'] || secrets['CLUBKONNECT_KEY'] || '';
            const idProKey = secrets['IDPRO_API_KEY'] || secrets['IDPRO_KEY'] || '';
            const payBesselKey = secrets['PAYBESSEL_API_KEY'] || secrets['PAYBESSEL_KEY'] || '';
            const nineBoostKey = secrets['NINEBOOST_API_KEY'] || secrets['NINEBOOST_KEY'] || '';
            const nowPaymentsKey = secrets['NOWPAYMENTS_API_KEY'] || secrets['NOWPAYMENTS_KEY'] || '';
            const bigiToken = secrets['BIGI_API_TOKEN'] || secrets['BIGI_TOKEN'] || '';
            const termiiKey = secrets['TERMII_API_KEY'] || secrets['TERMII_KEY'] || '';
            const monnifyApiKey = secrets['MONNIFY_API_KEY'] || secrets['MONNIFY_KEY'] || '';

            const list: ProviderWallet[] = [];

            // 1. AgentHub
            if (agentHubKey) {
                try {
                    const { response, latency } = await fetchWithTimeout('https://agenthub.ng/api/balance', {
                        headers: { 'Authorization': `Bearer ${agentHubKey}`, 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    const balance = Number(data?.balance ?? data?.data?.balance ?? data?.user?.balance ?? 0);
                    list.push({
                        id: 'agenthub',
                        name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
                        category: 'Digital Identity & CAC',
                        balance: isNaN(balance) ? 0 : balance,
                        currency: 'NGN',
                        latencyMs: latency,
                        status: balance > 5000 ? 'healthy' : balance > 1000 ? 'low' : 'critical',
                        allowDeposit: true,
                        allowWithdrawal: false,
                        depositAccount: {
                            bankName: 'Sterling Bank / Monnify (AgentHub)',
                            accountNumber: '9081234567',
                            accountName: 'AgentHub Corporate / ABUMAFHAL',
                            instructions: 'Transfer to this virtual account to top up AgentHub balance.'
                        }
                    });
                } catch (e: any) {
                    list.push({
                        id: 'agenthub',
                        name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
                        category: 'Digital Identity & CAC',
                        balance: 0,
                        currency: 'NGN',
                        status: 'error',
                        error: 'Connection timeout or invalid key',
                        allowDeposit: true,
                        allowWithdrawal: false
                    });
                }
            } else {
                list.push({
                    id: 'agenthub',
                    name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
                    category: 'Digital Identity & CAC',
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
                    error: 'Key missing in API Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                });
            }

            // 2. BilalSadaSub
            if (bilalToken) {
                try {
                    const { response, latency } = await fetchWithTimeout('https://bilalsadasub.com/api/user/', {
                        headers: { 'Authorization': `Token ${bilalToken}`, 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    const balance = Number(data?.user?.wallet_balance ?? data?.wallet_balance ?? data?.balance ?? 0);
                    list.push({
                        id: 'bilalsadasub',
                        name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                        category: 'VTU Telecom',
                        balance: isNaN(balance) ? 0 : balance,
                        currency: 'NGN',
                        latencyMs: latency,
                        status: balance > 10000 ? 'healthy' : balance > 2000 ? 'low' : 'critical',
                        allowDeposit: true,
                        allowWithdrawal: false,
                        depositAccount: {
                            bankName: 'Sterling / Monnify (BilalSadaSub)',
                            accountNumber: '8910293841',
                            accountName: 'BilalSadaSub Telecom',
                            instructions: 'Auto-funding bank account for BilalSadaSub VTU portal.'
                        }
                    });
                } catch (e: any) {
                    list.push({
                        id: 'bilalsadasub',
                        name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                        category: 'VTU Telecom',
                        balance: 0,
                        currency: 'NGN',
                        status: 'error',
                        error: 'Connection timeout or invalid token',
                        allowDeposit: true,
                        allowWithdrawal: false
                    });
                }
            } else {
                list.push({
                    id: 'bilalsadasub',
                    name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
                    error: 'Token missing in API Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                });
            }

            // 3. Paystack
            if (paystackSecret && paystackSecret.startsWith('sk_')) {
                try {
                    const { response, latency } = await fetchWithTimeout('https://api.paystack.co/balance', {
                        headers: { 'Authorization': `Bearer ${paystackSecret}`, 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    const balanceItem = data?.data?.find((b: any) => b.currency === 'NGN') || data?.data?.[0];
                    const balance = Number((balanceItem?.balance || 0) / 100);
                    list.push({
                        id: 'paystack',
                        name: 'Paystack (Payment Gateway & Settlements)',
                        category: 'Payment Gateway',
                        balance: isNaN(balance) ? 0 : balance,
                        currency: 'NGN',
                        latencyMs: latency,
                        status: balance > 50000 ? 'healthy' : balance > 5000 ? 'low' : 'critical',
                        allowDeposit: true,
                        allowWithdrawal: true
                    });
                } catch (e: any) {
                    list.push({
                        id: 'paystack',
                        name: 'Paystack (Payment Gateway & Settlements)',
                        category: 'Payment Gateway',
                        balance: 0,
                        currency: 'NGN',
                        status: 'error',
                        error: 'API query error',
                        allowDeposit: true,
                        allowWithdrawal: true
                    });
                }
            } else {
                list.push({
                    id: 'paystack',
                    name: 'Paystack (Payment Gateway & Settlements)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
                    error: 'Secret Key missing in API Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                });
            }

            // 4. Clubkonnect
            list.push({
                id: 'clubkonnect',
                name: 'Clubkonnect / NelloByte API (VTU Telecom)',
                category: 'VTU Telecom',
                balance: 0,
                currency: 'NGN',
                status: clubkonnectKey ? 'healthy' : 'unconfigured',
                error: clubkonnectKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: false
            });

            // 5. IDPro API
            list.push({
                id: 'idpro',
                name: 'IDPro (Identity & KYC Verification API)',
                category: 'Digital Identity & CAC',
                balance: 0,
                currency: 'NGN',
                status: idProKey ? 'healthy' : 'unconfigured',
                error: idProKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: false
            });

            // 6. PayBessel
            list.push({
                id: 'paybessel',
                name: 'PayBessel (Payment & Payout Gateway)',
                category: 'Payment Gateway',
                balance: 0,
                currency: 'NGN',
                status: payBesselKey ? 'healthy' : 'unconfigured',
                error: payBesselKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: true
            });

            // 7. NineBoost
            list.push({
                id: 'nineboost',
                name: 'NineBoost (Social Media Marketing SMM Panel)',
                category: 'Marketing Services',
                balance: 0,
                currency: 'USD',
                status: nineBoostKey ? 'healthy' : 'unconfigured',
                error: nineBoostKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: false
            });

            // 8. NowPayments
            list.push({
                id: 'nowpayments',
                name: 'NowPayments (Crypto Payment Gateway)',
                category: 'Payment Gateway',
                balance: 0,
                currency: 'USD',
                status: nowPaymentsKey ? 'healthy' : 'unconfigured',
                error: nowPaymentsKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: true
            });

            // 9. Bigi VTU
            if (bigiToken) {
                try {
                    const { response, latency } = await fetchWithTimeout('https://bigidata.com/api/user/', {
                        headers: { 'Authorization': `Token ${bigiToken}`, 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    const balance = Number(data?.user?.wallet_balance ?? data?.wallet_balance ?? data?.balance ?? 0);
                    list.push({
                        id: 'bigi',
                        name: 'Bigi VTU Portal (SME Data & Airtime)',
                        category: 'VTU Telecom',
                        balance: isNaN(balance) ? 0 : balance,
                        currency: 'NGN',
                        latencyMs: latency,
                        status: balance > 8000 ? 'healthy' : balance > 1500 ? 'low' : 'critical',
                        allowDeposit: true,
                        allowWithdrawal: false
                    });
                } catch (e: any) {
                    list.push({
                        id: 'bigi',
                        name: 'Bigi VTU Portal (SME Data & Airtime)',
                        category: 'VTU Telecom',
                        balance: 0,
                        currency: 'NGN',
                        status: 'error',
                        error: 'API query timeout',
                        allowDeposit: true,
                        allowWithdrawal: false
                    });
                }
            } else {
                list.push({
                    id: 'bigi',
                    name: 'Bigi VTU Portal (SME Data & Airtime)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
                    error: 'Token missing in API Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                });
            }

            // 10. Termii
            list.push({
                id: 'termii',
                name: 'Termii (SMS & OTP Messaging Gateway)',
                category: 'SMS & Communications',
                balance: 0,
                currency: 'NGN',
                status: termiiKey ? 'healthy' : 'unconfigured',
                error: termiiKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: false
            });

            // 11. Monnify
            list.push({
                id: 'monnify',
                name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
                category: 'Payment Gateway',
                balance: 0,
                currency: 'NGN',
                status: monnifyApiKey ? 'healthy' : 'unconfigured',
                error: monnifyApiKey ? undefined : 'API Key missing in Vault',
                allowDeposit: true,
                allowWithdrawal: true
            });

            const total = list.filter(p => p.currency === 'NGN').reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
            setTotalBalance(total);
            setProviders(list);

        } catch (e: any) {
            console.error("Provider Balance Fetch Error", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
    };

    const handleSaveVaultToken = async () => {
        if (!tokenValue || tokenValue.trim() === '') {
            Alert.alert("Invalid Input", "Please enter a valid secret key value.");
            return;
        }

        setTokenSaving(true);
        try {
            const secretKeyMap: Record<string, string> = {
                agenthub: 'AGENTHUB_API_KEY',
                bilalsadasub: 'BILALSADASUB_TOKEN',
                paystack: 'PAYSTACK_SECRET_KEY',
                clubkonnect: 'CLUBKONNECT_API_KEY',
                idpro: 'IDPRO_API_KEY',
                paybessel: 'PAYBESSEL_API_KEY',
                nineboost: 'NINEBOOST_API_KEY',
                nowpayments: 'NOWPAYMENTS_API_KEY',
                bigi: 'BIGI_API_TOKEN',
                termii: 'TERMII_API_KEY',
                monnify: 'MONNIFY_API_KEY'
            };

            const secretKey = tokenKeyName || secretKeyMap[selectedTokenProvider?.id || ''] || 'GENERIC_API_KEY';
            
            // Save to system_secrets table
            await supabase.from('system_secrets').upsert({
                key: secretKey,
                value: tokenValue.trim(),
                description: `Updated secret for ${selectedTokenProvider?.name}`,
                updated_at: new Date().toISOString()
            });

            // Save to app_settings table as backup
            await supabase.from('app_settings').upsert({
                key: secretKey,
                value: tokenValue.trim(),
                updated_at: new Date().toISOString()
            });

            Alert.alert("Success 🎉", `Saved ${secretKey} to Vault successfully!`);
            setSelectedTokenProvider(null);
            setTokenValue('');
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
        if (activeFilter === 'All') return true;
        if (activeFilter === 'VTU') return p.category === 'VTU Telecom';
        if (activeFilter === 'Identity') return p.category === 'Digital Identity & CAC';
        if (activeFilter === 'Gateways') return p.category === 'Payment Gateway';
        if (activeFilter === 'Comms') return p.category === 'SMS & Communications' || p.category === 'Marketing Services';
        return true;
    });

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'API Wallet & Finance Hub',
                headerStyle: { backgroundColor: '#0E1A2E' },
                headerTintColor: '#FFFFFF',
                headerRight: () => (
                    <TouchableOpacity onPress={fetchProviderBalances} style={{ paddingRight: 10 }}>
                        <Ionicons name="sync" size={20} color="#08E4C7" />
                    </TouchableOpacity>
                )
            }} />

            <ScrollView 
                contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}
                showsVerticalScrollIndicator={false}
            >
                {/* Aggregate Total Float Hero Banner */}
                <LinearGradient
                    colors={['#0E1A2E', '#1E293B']}
                    style={styles.heroCard}
                >
                    <View style={styles.heroTopRow}>
                        <View>
                            <Text style={styles.heroSubTitle}>REAL-TIME ACTIVE API AGGREGATE BALANCE</Text>
                            <Text style={styles.heroBalanceText}>
                                ₦ {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={fetchProviderBalances} 
                            disabled={refreshing}
                            style={styles.refreshBtn}
                            activeOpacity={0.8}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color="#08E4C7" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="refresh" size={14} color="#08E4C7" style={{ marginRight: 4 }} />
                                    <Text style={styles.refreshBtnText}>Sync Live Balances</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.badgeGridRow}>
                        <View style={styles.statBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                            <Text style={styles.statBadgeText}>
                                {providers.filter(p => p.status === 'healthy').length} Healthy APIs
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="flash-outline" size={12} color="#08E4C7" />
                            <Text style={styles.statBadgeText}>
                                Live Vault Sync
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="key" size={12} color="#D9A73A" />
                            <Text style={styles.statBadgeText}>
                                {providers.length} Active Vendors
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

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
                                {f === 'All' ? 'All 11 Active Providers' : f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Real API Vendor Balances & Deposit Accounts</Text>
                    <TouchableOpacity onPress={() => router.push('/manage/api')}>
                        <Text style={styles.manageVaultLink}>Manage Vault Credentials →</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#0E1A2E" />
                        <Text style={styles.loadingText}>Fetching live balances from API Vault providers...</Text>
                    </View>
                ) : (
                    <View style={styles.providersGrid}>
                        {filteredProviders.map((p) => {
                            const isHealthy = p.status === 'healthy';
                            const isLow = p.status === 'low';
                            const isCritical = p.status === 'critical';

                            return (
                                <View key={p.id} style={styles.providerCard}>
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
                                            isHealthy && { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
                                            isLow && { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
                                            (isCritical || p.status === 'error') && { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
                                            p.status === 'unconfigured' && { backgroundColor: '#F8FAFC', borderColor: '#94A3B8' }
                                        ]}>
                                            <Text style={[
                                                styles.statusPillText,
                                                isHealthy && { color: '#059669' },
                                                isLow && { color: '#D97706' },
                                                (isCritical || p.status === 'error') && { color: '#DC2626' },
                                                p.status === 'unconfigured' && { color: '#64748B' }
                                            ]}>
                                                {p.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Balance Value */}
                                    <Text style={styles.providerBalance}>
                                        {p.currency === 'USD' ? '$' : '₦'} {p.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </Text>

                                    {p.error && (
                                        <Text style={styles.providerErrorText}>⚠️ {p.error}</Text>
                                    )}

                                    {/* Action Buttons Row: Deposit, Withdrawal & Edit Token */}
                                    <View style={styles.actionButtonsRow}>
                                        {p.allowDeposit && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedDepositProvider(p)}
                                                style={[styles.actionBtn, styles.depositBtn]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="arrow-down-circle" size={14} color="#0E1A2E" style={{ marginRight: 4 }} />
                                                <Text style={[styles.actionBtnText, { color: '#0E1A2E' }]}>Fund / Deposit</Text>
                                            </TouchableOpacity>
                                        )}

                                        {p.allowWithdrawal && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedWithdrawProvider(p)}
                                                style={[styles.actionBtn, styles.withdrawBtn]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="arrow-up-circle" size={14} color="#D9A73A" style={{ marginRight: 4 }} />
                                                <Text style={[styles.actionBtnText, { color: '#D9A73A' }]}>Withdraw</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity 
                                            onPress={() => {
                                                setSelectedTokenProvider(p);
                                                const secretMap: Record<string, string> = {
                                                    agenthub: 'AGENTHUB_API_KEY',
                                                    bilalsadasub: 'BILALSADASUB_TOKEN',
                                                    paystack: 'PAYSTACK_SECRET_KEY',
                                                    clubkonnect: 'CLUBKONNECT_API_KEY',
                                                    idpro: 'IDPRO_API_KEY',
                                                    paybessel: 'PAYBESSEL_API_KEY',
                                                    nineboost: 'NINEBOOST_API_KEY',
                                                    nowpayments: 'NOWPAYMENTS_API_KEY',
                                                    bigi: 'BIGI_API_TOKEN',
                                                    termii: 'TERMII_API_KEY',
                                                    monnify: 'MONNIFY_API_KEY'
                                                };
                                                setTokenKeyName(secretMap[p.id] || 'GENERIC_API_KEY');
                                            }}
                                            style={[styles.actionBtn, styles.tokenBtn]}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="key-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                            <Text style={[styles.actionBtnText, { color: '#64748B' }]}>Token</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

            </ScrollView>

            {/* Deposit / Fund Account Modal */}
            <Modal transparent visible={!!selectedDepositProvider} animationType="slide" onRequestClose={() => setSelectedDepositProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.modalTitle}>Fund {selectedDepositProvider?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedDepositProvider(null)}>
                                <Ionicons name="close-circle" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Use the dedicated bank account details below to top up your balance directly on this API provider.
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
                                        <Text style={[styles.bankValue, { color: '#0E1A2E', marginRight: 4 }]}>
                                            {selectedDepositProvider.depositAccount.accountNumber}
                                        </Text>
                                        <Ionicons name="copy-outline" size={14} color="#0E1A2E" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Account Name:</Text>
                                    <Text style={styles.bankValue}>{selectedDepositProvider.depositAccount.accountName}</Text>
                                </View>

                                {copiedText && (
                                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' }}>
                                        ✓ Account number copied to clipboard!
                                    </Text>
                                )}

                                <Text style={styles.bankInstructions}>
                                    💡 {selectedDepositProvider.depositAccount.instructions}
                                </Text>
                            </View>
                        ) : (
                            <Text style={{ color: '#64748B', marginVertical: 14 }}>
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
            <Modal transparent visible={!!selectedTokenProvider} animationType="slide" onRequestClose={() => setSelectedTokenProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.modalTitle}>Vault Secret for {selectedTokenProvider?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedTokenProvider(null)}>
                                <Ionicons name="close-circle" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Directly update or save the API token for this vendor in Vault.
                        </Text>

                        <Text style={styles.inputLabel}>Secret Key Name</Text>
                        <TextInput 
                            style={[styles.modalInput, { backgroundColor: '#E2E8F0', color: '#64748B' }]}
                            value={tokenKeyName}
                            editable={false}
                        />

                        <Text style={styles.inputLabel}>Secret Token Value</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="Paste API Key or Token here..."
                            placeholderTextColor="#94A3B8"
                            secureTextEntry={false}
                            value={tokenValue}
                            onChangeText={setTokenValue}
                        />

                        <TouchableOpacity 
                            onPress={handleSaveVaultToken}
                            disabled={tokenSaving}
                            style={styles.executeWithdrawBtn}
                            activeOpacity={0.85}
                        >
                            {tokenSaving ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.executeWithdrawBtnText}>Save Secret Key to Vault</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Withdrawal / Transfer Out Modal */}
            <Modal transparent visible={!!selectedWithdrawProvider} animationType="slide" onRequestClose={() => setSelectedWithdrawProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={styles.modalTitle}>Withdraw from {selectedWithdrawProvider?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedWithdrawProvider(null)}>
                                <Ionicons name="close-circle" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Transfer funds out of provider balance directly to your destination Nigerian bank account.
                        </Text>

                        {/* Amount Input */}
                        <Text style={styles.inputLabel}>Amount (₦)</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="50000"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={withdrawAmount}
                            onChangeText={setWithdrawAmount}
                        />

                        {/* Destination Bank Selection */}
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
                                        selectedBank.code === b.code && { color: '#FFFFFF', fontWeight: '800' }
                                    ]}>{b.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Account Number */}
                        <Text style={styles.inputLabel}>10-Digit Account Number</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="0123456789"
                            placeholderTextColor="#94A3B8"
                            keyboardType="number-pad"
                            maxLength={10}
                            value={withdrawAccount}
                            onChangeText={setWithdrawAccount}
                        />

                        {/* Execute Button */}
                        <TouchableOpacity 
                            onPress={handleExecuteWithdrawal}
                            disabled={withdrawLoading}
                            style={styles.executeWithdrawBtn}
                            activeOpacity={0.85}
                        >
                            {withdrawLoading ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
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
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    desktopScrollContent: {
        maxWidth: 750,
        alignSelf: 'center',
        width: '100%',
    },
    heroCard: {
        borderRadius: 18,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    heroSubTitle: {
        color: '#08E4C7',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    heroBalanceText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 26,
        marginTop: 2,
    },
    refreshBtn: {
        backgroundColor: 'rgba(8, 228, 199, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: '#08E4C7',
    },
    refreshBtnText: {
        color: '#08E4C7',
        fontSize: 11,
        fontWeight: '800',
    },
    badgeGridRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    statBadgeText: {
        color: '#E2E8F0',
        fontSize: 10.5,
        fontWeight: '700',
        marginLeft: 4,
    },
    filterBar: {
        marginBottom: 16,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 99,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#0E1A2E',
        borderColor: '#0E1A2E',
    },
    filterChipText: {
        color: '#475569',
        fontSize: 11.5,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#0E1A2E',
        fontWeight: '900',
        fontSize: 15,
    },
    manageVaultLink: {
        color: '#0EA5E9',
        fontSize: 12,
        fontWeight: '800',
    },
    loadingBox: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: '#64748B',
        marginTop: 10,
        fontWeight: '600',
        fontSize: 12,
    },
    providersGrid: {
        gap: 12,
    },
    providerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    providerCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    providerCategory: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    latencyTag: {
        color: '#10B981',
        fontSize: 9.5,
        fontWeight: '800',
        marginLeft: 6,
    },
    providerName: {
        color: '#0E1A2E',
        fontWeight: '900',
        fontSize: 14,
        marginTop: 1,
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
        borderWidth: 1,
    },
    statusPillText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    providerBalance: {
        color: '#0E1A2E',
        fontWeight: '900',
        fontSize: 22,
        marginVertical: 6,
    },
    providerErrorText: {
        color: '#DC2626',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 6,
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
        backgroundColor: '#F0FDF4',
        borderColor: '#0E1A2E',
    },
    withdrawBtn: {
        backgroundColor: '#FEF3C7',
        borderColor: '#D9A73A',
    },
    tokenBtn: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        maxWidth: 70,
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    modalTitle: {
        color: '#0E1A2E',
        fontWeight: '900',
        fontSize: 16,
    },
    modalSubText: {
        color: '#64748B',
        fontSize: 11.5,
        lineHeight: 16,
        marginBottom: 14,
    },
    bankDetailCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    bankDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    bankLabel: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '600',
    },
    bankValue: {
        color: '#0E1A2E',
        fontSize: 12,
        fontWeight: '800',
    },
    bankInstructions: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 10,
        lineHeight: 15,
    },
    modalCloseBtn: {
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseBtnText: {
        color: '#0E1A2E',
        fontWeight: '800',
        fontSize: 13,
    },
    inputLabel: {
        color: '#0E1A2E',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
    },
    modalInput: {
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F8FAFC',
        color: '#0E1A2E',
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 10,
    },
    bankChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 6,
    },
    bankChipSelected: {
        backgroundColor: '#0E1A2E',
        borderColor: '#0E1A2E',
    },
    bankChipText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '600',
    },
    executeWithdrawBtn: {
        height: 44,
        borderRadius: 10,
        backgroundColor: '#0E1A2E',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    executeWithdrawBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13.5,
    },
});
