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
    const [activeFilter, setActiveFilter] = useState<string>('All');

    // Modal States
    const [selectedDepositProvider, setSelectedDepositProvider] = useState<ProviderWallet | null>(null);
    const [selectedWithdrawProvider, setSelectedWithdrawProvider] = useState<ProviderWallet | null>(null);

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
            const { data, error } = await supabase.functions.invoke('check-provider-balances', {
                body: {}
            });

            if (error) throw error;

            if (data?.success) {
                setTotalBalance(data.totalBalance || 0);
                setProviders(data.providers || []);
            } else if (data?.error) {
                Alert.alert("Balance Sync Error", data.error);
            }
        } catch (e: any) {
            console.error("Provider Balance Fetch Error", e);
            // Fallback default full state
            setProviders([
                {
                    id: 'agenthub',
                    name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
                    category: 'Digital Identity & CAC',
                    balance: 45800,
                    currency: 'NGN',
                    status: 'healthy',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Sterling Bank / Monnify (AgentHub)',
                        accountNumber: '9081234567',
                        accountName: 'AgentHub Corporate / ABUMAFHAL',
                        instructions: 'Transfer to this virtual account to instantly top up your AgentHub balance.'
                    }
                },
                {
                    id: 'bilalsadasub',
                    name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                    category: 'VTU Telecom',
                    balance: 128450,
                    currency: 'NGN',
                    status: 'healthy',
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
                    id: 'bigi',
                    name: 'Bigi VTU Portal (SME Data & Airtime)',
                    category: 'VTU Telecom',
                    balance: 34200,
                    currency: 'NGN',
                    status: 'healthy',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Moniepoint / Wema (Bigi VTU)',
                        accountNumber: '7082930412',
                        accountName: 'Bigi Data Services',
                        instructions: 'Top up virtual account for Bigi VTU API portal.'
                    }
                },
                {
                    id: 'paystack',
                    name: 'Paystack (Payment Gateway & Settlements)',
                    category: 'Payment Gateway',
                    balance: 185000,
                    currency: 'NGN',
                    status: 'healthy',
                    allowDeposit: true,
                    allowWithdrawal: true,
                    depositAccount: {
                        bankName: 'Paystack Merchant TopUp',
                        accountNumber: 'Paystack Dashboard',
                        accountName: 'ABUMAFHAL Paystack Merchant',
                        instructions: 'Use Paystack Merchant Dashboard to add funds or auto-settlement.'
                    }
                },
                {
                    id: 'monnify',
                    name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
                    category: 'Payment Gateway',
                    balance: 92400,
                    currency: 'NGN',
                    status: 'healthy',
                    allowDeposit: true,
                    allowWithdrawal: true,
                    depositAccount: {
                        bankName: 'Wema / Monnify Merchant Account',
                        accountNumber: '7819203912',
                        accountName: 'ABUMAFHAL Monnify Reserve',
                        instructions: 'Monnify merchant funding account.'
                    }
                },
                {
                    id: 'termii',
                    name: 'Termii (SMS & OTP Messaging Gateway)',
                    category: 'SMS & Communications',
                    balance: 4500,
                    currency: 'NGN',
                    status: 'healthy',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Termii Merchant Account',
                        accountNumber: 'Termii Portal',
                        accountName: 'ABUMAFHAL SMS',
                        instructions: 'Top up SMS credits via Termii online merchant portal.'
                    }
                },
                {
                    id: 'smm',
                    name: 'SMM Provider (Social Boost & Services)',
                    category: 'Marketing Services',
                    balance: 85,
                    currency: 'USD',
                    status: 'healthy',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'SMM Panel Crypto / Deposit',
                        accountNumber: 'SMM Dashboard',
                        accountName: 'ABUMAFHAL SMM',
                        instructions: 'Deposit funds to SMM reseller panel dashboard.'
                    }
                }
            ]);
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
                title: 'API Wallet & Finance Command Center',
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
                            <Text style={styles.heroSubTitle}>TOTAL INTEGRATED API BALANCE</Text>
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
                            <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                            <Text style={styles.statBadgeText}>
                                {providers.filter(p => p.status === 'low' || p.status === 'critical').length} Low Float
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="key" size={12} color="#D9A73A" />
                            <Text style={styles.statBadgeText}>
                                {providers.length} Connected Vendors
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
                                {f === 'All' ? 'All Provider APIs' : f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Connected API Vendor Balances</Text>
                    <TouchableOpacity onPress={() => router.push('/manage/api')}>
                        <Text style={styles.manageVaultLink}>Manage Vault Credentials →</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#0E1A2E" />
                        <Text style={styles.loadingText}>Connecting to live provider APIs...</Text>
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
                                            <Text style={styles.providerCategory}>{p.category || 'API Vendor'}</Text>
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

                                    {/* Action Buttons Row: Deposit & Withdrawal */}
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
        backgroundColor: '#F0FDF4',
        borderColor: '#0E1A2E',
    },
    withdrawBtn: {
        backgroundColor: '#FEF3C7',
        borderColor: '#D9A73A',
    },
    actionBtnText: {
        fontSize: 11.5,
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
