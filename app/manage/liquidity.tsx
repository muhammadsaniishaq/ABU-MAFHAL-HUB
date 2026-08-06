import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator, 
    Alert, Modal, TextInput, StyleSheet, useWindowDimensions, Clipboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

interface ProviderWallet {
    id: string;
    name: string;
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
            // Fallback default state
            setProviders([
                {
                    id: 'agenthub',
                    name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Monnify / Sterling Bank (AgentHub)',
                        accountNumber: '9081234567',
                        accountName: 'AgentHub Corporate / ABUMAFHAL',
                        instructions: 'Transfer to this virtual account to instantly top up your AgentHub balance.'
                    }
                },
                {
                    id: 'bilalsadasub',
                    name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
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
                    balance: 0,
                    currency: 'NGN',
                    status: 'unconfigured',
                    allowDeposit: true,
                    allowWithdrawal: true
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

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'Finance & API Wallet Command Center',
                headerStyle: { backgroundColor: '#0B132B' },
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
                    colors={['#0B132B', '#1C2541']}
                    style={styles.heroCard}
                >
                    <View style={styles.heroTopRow}>
                        <View>
                            <Text style={styles.heroSubTitle}>TOTAL API FLOATING BALANCE</Text>
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
                                    <Text style={styles.refreshBtnText}>Sync All</Text>
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
                            <Ionicons name="key" size={12} color="#08E4C7" />
                            <Text style={styles.statBadgeText}>
                                {providers.length} Integrated APIs
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Section Title */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>API Provider Balances & Vault Controls</Text>
                    <TouchableOpacity onPress={() => router.push('/manage/api')}>
                        <Text style={styles.manageVaultLink}>Manage API Vault →</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#08E4C7" />
                        <Text style={{ color: '#94A3B8', marginTop: 10, fontWeight: '600' }}>Fetching live balances from provider APIs...</Text>
                    </View>
                ) : (
                    <View style={styles.providersGrid}>
                        {providers.map((p) => {
                            const isHealthy = p.status === 'healthy';
                            const isLow = p.status === 'low';
                            const isCritical = p.status === 'critical';

                            return (
                                <View key={p.id} style={styles.providerCard}>
                                    <View style={styles.providerCardHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.providerName}>{p.name}</Text>
                                        </View>

                                        {/* Status Badge */}
                                        <View style={[
                                            styles.statusPill,
                                            isHealthy && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
                                            isLow && { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' },
                                            (isCritical || p.status === 'error') && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' },
                                            p.status === 'unconfigured' && { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: '#94A3B8' }
                                        ]}>
                                            <Text style={[
                                                styles.statusPillText,
                                                isHealthy && { color: '#10B981' },
                                                isLow && { color: '#F59E0B' },
                                                (isCritical || p.status === 'error') && { color: '#EF4444' },
                                                p.status === 'unconfigured' && { color: '#94A3B8' }
                                            ]}>
                                                {p.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Balance Value */}
                                    <Text style={styles.providerBalance}>
                                        ₦ {p.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                                                <Ionicons name="arrow-down-circle" size={14} color="#08E4C7" style={{ marginRight: 4 }} />
                                                <Text style={[styles.actionBtnText, { color: '#08E4C7' }]}>Fund / Deposit</Text>
                                            </TouchableOpacity>
                                        )}

                                        {p.allowWithdrawal && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedWithdrawProvider(p)}
                                                style={[styles.actionBtn, styles.withdrawBtn]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="arrow-up-circle" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
                                                <Text style={[styles.actionBtnText, { color: '#F59E0B' }]}>Withdraw</Text>
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
                                <Ionicons name="close-circle" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Use the official dedicated virtual bank account details below to top up your balance directly on this API provider.
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
                                        <Text style={[styles.bankValue, { color: '#08E4C7', marginRight: 4 }]}>
                                            {selectedDepositProvider.depositAccount.accountNumber}
                                        </Text>
                                        <Ionicons name="copy-outline" size={14} color="#08E4C7" />
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
                            <Text style={{ color: '#94A3B8', marginVertical: 14 }}>
                                Direct bank funding accounts are managed via the provider merchant dashboard.
                            </Text>
                        )}

                        <TouchableOpacity onPress={() => setSelectedDepositProvider(null)} style={styles.modalCloseBtn}>
                            <Text style={styles.modalCloseBtnText}>Done</Text>
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
                                <Ionicons name="close-circle" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubText}>
                            Transfer funds out of provider balance to your destination Nigerian bank account.
                        </Text>

                        {/* Amount Input */}
                        <Text style={styles.inputLabel}>Amount (₦)</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="50000"
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            value={withdrawAmount}
                            onChangeText={setWithdrawAmount}
                        />

                        {/* Destination Bank Selection */}
                        <Text style={styles.inputLabel}>Select Bank</Text>
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
                                        selectedBank.code === b.code && { color: '#0E1A2E', fontWeight: '800' }
                                    ]}>{b.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Account Number */}
                        <Text style={styles.inputLabel}>10-Digit Account Number</Text>
                        <TextInput 
                            style={styles.modalInput}
                            placeholder="0123456789"
                            placeholderTextColor="#64748B"
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
                                <ActivityIndicator color="#0E1A2E" size="small" />
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
        backgroundColor: '#060D1A',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    desktopScrollContent: {
        maxWidth: 700,
        alignSelf: 'center',
        width: '100%',
    },
    heroCard: {
        borderRadius: 18,
        padding: 20,
        marginBottom: 20,
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
        backgroundColor: 'rgba(8, 228, 199, 0.12)',
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
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
    },
    manageVaultLink: {
        color: '#08E4C7',
        fontSize: 12,
        fontWeight: '700',
    },
    providersGrid: {
        gap: 12,
    },
    providerCard: {
        backgroundColor: '#0E1A2E',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    providerCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    providerName: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13.5,
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
        color: '#08E4C7',
        fontWeight: '900',
        fontSize: 20,
        marginBottom: 8,
    },
    providerErrorText: {
        color: '#EF4444',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    actionBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    depositBtn: {
        backgroundColor: 'rgba(8, 228, 199, 0.1)',
        borderColor: '#08E4C7',
    },
    withdrawBtn: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: '#F59E0B',
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(6, 13, 30, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#0E1A2E',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    modalTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
    },
    modalSubText: {
        color: '#94A3B8',
        fontSize: 11.5,
        lineHeight: 16,
        marginBottom: 14,
    },
    bankDetailCard: {
        backgroundColor: '#0B132B',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
        marginBottom: 14,
    },
    bankDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    bankLabel: {
        color: '#94A3B8',
        fontSize: 11.5,
        fontWeight: '600',
    },
    bankValue: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    bankInstructions: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 10,
        lineHeight: 15,
    },
    modalCloseBtn: {
        height: 38,
        borderRadius: 10,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12.5,
    },
    inputLabel: {
        color: '#E2E8F0',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
    },
    modalInput: {
        height: 38,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#0B132B',
        color: '#FFFFFF',
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 10,
    },
    bankChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#0B132B',
        borderWidth: 1,
        borderColor: '#1E293B',
        marginRight: 6,
    },
    bankChipSelected: {
        backgroundColor: '#08E4C7',
        borderColor: '#08E4C7',
    },
    bankChipText: {
        color: '#E2E8F0',
        fontSize: 11,
        fontWeight: '600',
    },
    executeWithdrawBtn: {
        height: 42,
        borderRadius: 10,
        backgroundColor: '#08E4C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    executeWithdrawBtnText: {
        color: '#0E1A2E',
        fontWeight: '900',
        fontSize: 13,
    },
});
