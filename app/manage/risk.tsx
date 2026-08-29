import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Switch,
    RefreshControl,
    StyleSheet,
    Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Executive Color Theme
const T = {
    navyDark: '#0A1128',
    navyMid: '#111D3B',
    navyCard: '#1E293B',
    gold: '#D4AF37',
    goldDark: '#B8952B',
    goldLight: '#F5E8D0',
    goldBg: 'rgba(212, 175, 55, 0.12)',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    textMain: '#0F172A',
    textSub: '#64748B',
    border: '#CBD5E1',
    success: '#10B981',
    successBg: '#ECFDF5',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    purple: '#9333EA',
    purpleBg: '#F3E8FF',
};

interface RiskPolicySettings {
    risk_max_single_tx: number;
    risk_daily_account_limit: number;
    risk_velocity_max_hourly_tx: number;
    risk_auto_quarantine_above: number;
    risk_require_kyc2_outflows: boolean;
    risk_global_freeze: boolean;
    risk_offhours_alerts: boolean;
    risk_auto_lock_failed_auth: boolean;
}

interface UserProfile {
    id: string;
    full_name?: string;
    username?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
    balance?: number;
    credit_balance?: number;
    kyc_tier?: number;
    kyc_verified?: boolean;
    transfer_limit?: number;
    single_tx_limit?: number;
    created_at?: string;
}

interface TransactionItem {
    id: string;
    user_id: string;
    type: string;
    amount: number | string;
    status: string;
    description?: string;
    reference?: string;
    created_at: string;
    user?: UserProfile;
}

interface AuditAnomaly {
    id: string;
    type: 'negative_balance' | 'unverified_whale' | 'velocity_burst' | 'failed_spike';
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium';
    entityId: string;
    entityName: string;
    amount?: number;
    resolved?: boolean;
}

export default function RiskControlCenter() {
    const router = useRouter();

    // Active Navigation Tab
    const [activeTab, setActiveTab] = useState<'overview' | 'policies' | 'queue' | 'watchlist' | 'ai_audit'>('overview');

    // Loading & Refreshing States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingPolicies, setSavingPolicies] = useState(false);

    // Live Metrics Data
    const [totalFloatLiability, setTotalFloatLiability] = useState(0);
    const [totalUserCount, setTotalUserCount] = useState(0);
    const [outflow24h, setOutflow24h] = useState(0);
    const [inflow24h, setInflow24h] = useState(0);
    const [failedTx24h, setFailedTx24h] = useState(0);
    const [highRiskUsersCount, setHighRiskUsersCount] = useState(0);
    const [pendingFlagsCount, setPendingFlagsCount] = useState(0);
    const [riskIndexScore, setRiskIndexScore] = useState(18); // 0-100

    // Policies State (Persistent in app_settings)
    const [policies, setPolicies] = useState<RiskPolicySettings>({
        risk_max_single_tx: 250000,
        risk_daily_account_limit: 1000000,
        risk_velocity_max_hourly_tx: 6,
        risk_auto_quarantine_above: 100000,
        risk_require_kyc2_outflows: true,
        risk_global_freeze: false,
        risk_offhours_alerts: true,
        risk_auto_lock_failed_auth: true,
    });

    // Transaction Queue & Filters
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [filteredTx, setFilteredTx] = useState<TransactionItem[]>([]);
    const [txFilter, setTxFilter] = useState<'all' | 'high_value' | 'failed' | 'flagged'>('all');
    const [txSearch, setTxSearch] = useState('');

    // Watchlist State
    const [watchlistUsers, setWatchlistUsers] = useState<UserProfile[]>([]);
    const [userSearch, setUserSearch] = useState('');

    // AI Audit Anomaly State
    const [auditAnomalies, setAuditAnomalies] = useState<AuditAnomaly[]>([]);
    const [scanningAudit, setScanningAudit] = useState(false);

    // Selected Item Modals
    const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Form inputs for policy adjustments
    const [inputMaxSingle, setInputMaxSingle] = useState('250000');
    const [inputDailyLimit, setInputDailyLimit] = useState('1000000');
    const [inputVelocity, setInputVelocity] = useState('6');
    const [inputQuarantine, setInputQuarantine] = useState('100000');

    // Load initial data
    useEffect(() => {
        loadAllRiskData();
    }, []);

    const loadAllRiskData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                fetchPolicies(),
                fetchLiveMetrics(),
                fetchTransactionsQueue(),
                fetchWatchlistUsers(),
            ]);
            // Run quick AI audit in background
            runRiskIntegrityAudit();
        } catch (error) {
            console.error('Error loading risk data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAllRiskData();
    }, []);

    // 1. Fetch Policies from app_settings
    const fetchPolicies = async () => {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('key, value');

            if (data && data.length > 0) {
                const settingsMap: Record<string, any> = {};
                data.forEach(item => {
                    settingsMap[item.key] = item.value;
                });

                const loaded: RiskPolicySettings = {
                    risk_max_single_tx: Number(settingsMap['risk_max_single_tx']) || 250000,
                    risk_daily_account_limit: Number(settingsMap['risk_daily_account_limit']) || 1000000,
                    risk_velocity_max_hourly_tx: Number(settingsMap['risk_velocity_max_hourly_tx']) || 6,
                    risk_auto_quarantine_above: Number(settingsMap['risk_auto_quarantine_above']) || 100000,
                    risk_require_kyc2_outflows: settingsMap['risk_require_kyc2_outflows'] === true || settingsMap['risk_require_kyc2_outflows'] === 'true',
                    risk_global_freeze: settingsMap['risk_global_freeze'] === true || settingsMap['risk_global_freeze'] === 'true',
                    risk_offhours_alerts: settingsMap['risk_offhours_alerts'] === true || settingsMap['risk_offhours_alerts'] === 'true',
                    risk_auto_lock_failed_auth: settingsMap['risk_auto_lock_failed_auth'] === true || settingsMap['risk_auto_lock_failed_auth'] === 'true',
                };

                setPolicies(loaded);
                setInputMaxSingle(loaded.risk_max_single_tx.toString());
                setInputDailyLimit(loaded.risk_daily_account_limit.toString());
                setInputVelocity(loaded.risk_velocity_max_hourly_tx.toString());
                setInputQuarantine(loaded.risk_auto_quarantine_above.toString());
            }
        } catch (e) {
            console.error('Fetch policies error:', e);
        }
    };

    // 2. Fetch Live Metrics & Aggregates
    const fetchLiveMetrics = async () => {
        try {
            // Aggregate user balances
            const { data: profiles, error: pErr } = await supabase
                .from('profiles')
                .select('id, balance, credit_balance, status');

            if (profiles) {
                setTotalUserCount(profiles.length);
                const totalFloat = profiles.reduce((acc, p) => acc + (Number(p.balance) || 0) + (Number(p.credit_balance) || 0), 0);
                setTotalFloatLiability(totalFloat);

                const highRisk = profiles.filter(p => p.status === 'suspended' || p.status === 'blocked' || p.status === 'flagged');
                setHighRiskUsersCount(highRisk.length);
            }

            // Aggregate 24h transactions
            const past24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: tx24h } = await supabase
                .from('transactions')
                .select('amount, type, status, created_at')
                .gte('created_at', past24hIso);

            if (tx24h) {
                let outSum = 0;
                let inSum = 0;
                let failedCount = 0;

                tx24h.forEach(tx => {
                    const amt = Number(tx.amount) || 0;
                    if (tx.status === 'failed') {
                        failedCount++;
                    }
                    if (['transfer', 'withdrawal', 'crypto_buy', 'bill_payment'].includes(tx.type)) {
                        outSum += amt;
                    } else if (['deposit', 'credit', 'refund'].includes(tx.type)) {
                        inSum += amt;
                    }
                });

                setOutflow24h(outSum);
                setInflow24h(inSum);
                setFailedTx24h(failedCount);

                // Compute dynamic risk score (0 to 100)
                let score = 15; // base nominal
                if (failedCount > 5) score += Math.min(25, failedCount * 3);
                if (outSum > inSum * 2 && inSum > 0) score += 20;
                if (highRiskUsersCount > 3) score += Math.min(20, highRiskUsersCount * 4);
                if (policies.risk_global_freeze) score = 95;
                setRiskIndexScore(Math.min(100, Math.max(5, score)));
            }
        } catch (e) {
            console.error('Fetch live metrics error:', e);
        }
    };

    // 3. Fetch Transactions Queue (Recent 80)
    const fetchTransactionsQueue = async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(80);

            if (data) {
                // Fetch profiles for users in these transactions to have rich context
                const userIds = Array.from(new Set(data.map(t => t.user_id).filter(Boolean)));
                let profileMap: Record<string, UserProfile> = {};

                if (userIds.length > 0) {
                    const { data: userProfiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, username, email, phone, status, kyc_tier, balance')
                        .in('id', userIds);

                    if (userProfiles) {
                        userProfiles.forEach(u => {
                            profileMap[u.id] = u;
                        });
                    }
                }

                const enrichedTx: TransactionItem[] = data.map(tx => ({
                    ...tx,
                    amount: Number(tx.amount) || 0,
                    user: profileMap[tx.user_id],
                }));

                setTransactions(enrichedTx);
                applyTxFilter(enrichedTx, txFilter, txSearch);

                // Count pending / high-risk flags
                const flags = enrichedTx.filter(t => 
                    Number(t.amount) >= (policies.risk_auto_quarantine_above || 100000) || 
                    t.status === 'failed' || 
                    t.status === 'flagged'
                );
                setPendingFlagsCount(flags.length);
            }
        } catch (e) {
            console.error('Fetch tx queue error:', e);
        }
    };

    // 4. Fetch Watchlist Users
    const fetchWatchlistUsers = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, username, email, phone, role, status, balance, credit_balance, kyc_tier, kyc_verified, transfer_limit, created_at')
                .or('status.eq.suspended,status.eq.blocked,status.eq.flagged,balance.gt.500000')
                .order('balance', { ascending: false })
                .limit(50);

            if (data) {
                setWatchlistUsers(data);
            }
        } catch (e) {
            console.error('Fetch watchlist error:', e);
        }
    };

    // 5. Run AI Risk & Integrity Scanner
    const runRiskIntegrityAudit = async () => {
        setScanningAudit(true);
        const anomalies: AuditAnomaly[] = [];
        try {
            // Check 1: Negative Wallet Balances
            const { data: negProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, username, email, balance')
                .lt('balance', 0);

            if (negProfiles && negProfiles.length > 0) {
                negProfiles.forEach(p => {
                    anomalies.push({
                        id: `neg_${p.id}`,
                        type: 'negative_balance',
                        title: 'Negative Balance Anomaly',
                        description: `Account has a negative wallet balance of ₦${Math.abs(Number(p.balance)).toLocaleString()}. Potential race condition or unverified overdraft.`,
                        severity: 'critical',
                        entityId: p.id,
                        entityName: p.full_name || p.username || p.email || p.id,
                        amount: Number(p.balance),
                    });
                });
            }

            // Check 2: High-Balance Unverified Accounts (Whales without KYC Tier 2)
            const { data: whaleProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, username, email, balance, kyc_tier')
                .gt('balance', 250000);

            if (whaleProfiles) {
                whaleProfiles.filter(p => (Number(p.kyc_tier) || 0) < 2).forEach(p => {
                    anomalies.push({
                        id: `whale_${p.id}`,
                        type: 'unverified_whale',
                        title: 'Unverified High-Exposure Account',
                        description: `Account holds ₦${Number(p.balance).toLocaleString()} but has low verification (Tier ${p.kyc_tier || 1}). High regulatory and float exposure.`,
                        severity: 'high',
                        entityId: p.id,
                        entityName: p.full_name || p.username || p.email || p.id,
                        amount: Number(p.balance),
                    });
                });
            }

            // Check 3: High Failed Transaction Spikes in last 24h
            const past24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: failedTxs } = await supabase
                .from('transactions')
                .select('id, user_id, amount, description, status')
                .eq('status', 'failed')
                .gte('created_at', past24hIso)
                .limit(10);

            if (failedTxs && failedTxs.length >= 3) {
                anomalies.push({
                    id: `failed_spike_24h`,
                    type: 'failed_spike',
                    title: 'Repeated Transaction Failure Spike',
                    description: `Detected ${failedTxs.length} failed transactions in the last 24h. Recommend reviewing gateway connectivity and partner APIs.`,
                    severity: 'medium',
                    entityId: 'gateway_system',
                    entityName: 'Payment Gateway Channel',
                });
            }

            setAuditAnomalies(anomalies);
        } catch (e) {
            console.error('AI audit error:', e);
        } finally {
            setScanningAudit(false);
        }
    };

    // Filter Helper
    const applyTxFilter = (list: TransactionItem[], filter: string, search: string) => {
        let result = [...list];

        if (filter === 'high_value') {
            result = result.filter(t => Number(t.amount) >= (policies.risk_auto_quarantine_above || 50000));
        } else if (filter === 'failed') {
            result = result.filter(t => t.status === 'failed');
        } else if (filter === 'flagged') {
            result = result.filter(t => t.status === 'flagged' || Number(t.amount) >= 100000);
        }

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            result = result.filter(t =>
                t.description?.toLowerCase().includes(q) ||
                t.reference?.toLowerCase().includes(q) ||
                t.user?.email?.toLowerCase().includes(q) ||
                t.user?.full_name?.toLowerCase().includes(q) ||
                t.user?.username?.toLowerCase().includes(q) ||
                String(t.amount).includes(q)
            );
        }

        setFilteredTx(result);
    };

    // Handle Filter Tab Change
    const handleFilterChange = (filter: 'all' | 'high_value' | 'failed' | 'flagged') => {
        setTxFilter(filter);
        applyTxFilter(transactions, filter, txSearch);
    };

    // Handle Search Change
    const handleSearchChange = (text: string) => {
        setTxSearch(text);
        applyTxFilter(transactions, txFilter, text);
    };

    // Save Policy Rules to Supabase
    const handleSavePolicies = async () => {
        setSavingPolicies(true);
        try {
            const updatedPolicies: RiskPolicySettings = {
                risk_max_single_tx: Number(inputMaxSingle) || 250000,
                risk_daily_account_limit: Number(inputDailyLimit) || 1000000,
                risk_velocity_max_hourly_tx: Number(inputVelocity) || 6,
                risk_auto_quarantine_above: Number(inputQuarantine) || 100000,
                risk_require_kyc2_outflows: policies.risk_require_kyc2_outflows,
                risk_global_freeze: policies.risk_global_freeze,
                risk_offhours_alerts: policies.risk_offhours_alerts,
                risk_auto_lock_failed_auth: policies.risk_auto_lock_failed_auth,
            };

            const payload = Object.entries(updatedPolicies).map(([key, value]) => ({
                key,
                value: typeof value === 'boolean' ? value.toString() : value,
            }));

            const { error } = await supabase
                .from('app_settings')
                .upsert(payload, { onConflict: 'key' });

            if (error) throw error;

            setPolicies(updatedPolicies);
            Alert.alert('Success ✅', 'Risk Control Policies and Limits have been saved and applied across the system.');
        } catch (e: any) {
            Alert.alert('Save Error', e.message || 'Failed to save risk control policies.');
        } finally {
            setSavingPolicies(false);
        }
    };

    // Toggle Global Emergency Freeze
    const handleToggleGlobalFreeze = async (newVal: boolean) => {
        if (newVal) {
            Alert.alert(
                '🚨 ACTIVATE GLOBAL OUTFLOW FREEZE',
                'This will INSTANTLY halt and reject all outgoing bank transfers, airtime/data purchases, and crypto withdrawals across the entire platform. Are you sure?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'YES, FREEZE SYSTEM',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await supabase
                                    .from('app_settings')
                                    .upsert({ key: 'risk_global_freeze', value: 'true' }, { onConflict: 'key' });
                                setPolicies(p => ({ ...p, risk_global_freeze: true }));
                                setRiskIndexScore(95);
                                Alert.alert('LOCKDOWN ACTIVE ❄️', 'All system outgoing debit transfers are now locked.');
                            } catch (err: any) {
                                Alert.alert('Error', err.message);
                            }
                        }
                    }
                ]
            );
        } else {
            Alert.alert(
                '🔓 LIFT GLOBAL FREEZE',
                'Are you sure you want to resume normal transaction processing and outgoing payouts?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Resume Operations',
                        onPress: async () => {
                            try {
                                await supabase
                                    .from('app_settings')
                                    .upsert({ key: 'risk_global_freeze', value: 'false' }, { onConflict: 'key' });
                                setPolicies(p => ({ ...p, risk_global_freeze: false }));
                                setRiskIndexScore(20);
                                Alert.alert('Operations Resumed ✅', 'System is now processing transactions normally.');
                            } catch (err: any) {
                                Alert.alert('Error', err.message);
                            }
                        }
                    }
                ]
            );
        }
    };

    // 1-Click Action: Freeze / Unfreeze Specific User Account
    const handleToggleUserFreeze = async (user: UserProfile) => {
        const isSuspended = user.status === 'suspended' || user.status === 'blocked';
        const targetStatus = isSuspended ? 'active' : 'suspended';

        Alert.alert(
            isSuspended ? 'Unfreeze User Account' : 'Freeze User Account',
            `Are you sure you want to ${isSuspended ? 'reactivate' : 'freeze'} account for ${user.full_name || user.email}? ${isSuspended ? '' : 'The user will be immediately blocked from making transfers or logins.'}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isSuspended ? 'Reactivate' : 'Freeze Account',
                    style: isSuspended ? 'default' : 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const { error } = await supabase
                                .from('profiles')
                                .update({ status: targetStatus })
                                .eq('id', user.id);

                            if (error) throw error;

                            // Send in-app notification to user
                            await supabase.from('notifications').insert({
                                user_id: user.id,
                                title: isSuspended ? 'Account Reactivated ✅' : 'Security Alert: Account Frozen ❄️',
                                message: isSuspended 
                                    ? 'Your account security review has passed and access has been restored.'
                                    : 'Your account has been temporarily frozen by Compliance Risk Management for security audit. Please contact support.',
                                type: 'security',
                            });

                            // Refresh local lists
                            setWatchlistUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: targetStatus } : u));
                            if (selectedUser?.id === user.id) {
                                setSelectedUser({ ...selectedUser, status: targetStatus });
                            }
                            if (selectedTx?.user?.id === user.id) {
                                setSelectedTx({ ...selectedTx, user: { ...selectedTx.user, status: targetStatus } });
                            }

                            Alert.alert('Status Updated', `User account is now ${targetStatus}.`);
                            fetchLiveMetrics();
                        } catch (err: any) {
                            Alert.alert('Action Error', err.message || 'Failed to update user status.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // 1-Click Action: Approve & Clear Transaction Flag
    const handleApproveTxFlag = async (tx: TransactionItem) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('transactions')
                .update({ status: 'success' })
                .eq('id', tx.id);

            if (error) throw error;

            setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'success' } : t));
            applyTxFilter(transactions.map(t => t.id === tx.id ? { ...t, status: 'success' } : t), txFilter, txSearch);
            setSelectedTx(null);
            Alert.alert('Approved ✅', 'Transaction has been verified and cleared.');
        } catch (err: any) {
            Alert.alert('Approval Error', err.message || 'Failed to approve transaction.');
        } finally {
            setActionLoading(false);
        }
    };

    // 1-Click Action: Reverse / Refund Transaction to User Wallet
    const handleReverseTransaction = async (tx: TransactionItem) => {
        Alert.alert(
            'Reverse & Refund Transaction',
            `Are you sure you want to reverse Transaction #${tx.reference || tx.id.slice(0, 8)} of ₦${Number(tx.amount).toLocaleString()} and credit it back to the user's wallet?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Execute Refund',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            // 1. Get current balance
                            const { data: userProfile, error: pErr } = await supabase
                                .from('profiles')
                                .select('balance')
                                .eq('id', tx.user_id)
                                .single();

                            if (pErr) throw pErr;

                            const refundAmount = Number(tx.amount) || 0;
                            const newBalance = (Number(userProfile.balance) || 0) + refundAmount;

                            // 2. Update user balance
                            const { error: uErr } = await supabase
                                .from('profiles')
                                .update({ balance: newBalance })
                                .eq('id', tx.user_id);

                            if (uErr) throw uErr;

                            // 3. Mark original transaction as reversed
                            await supabase
                                .from('transactions')
                                .update({ status: 'reversed' })
                                .eq('id', tx.id);

                            // 4. Log refund transaction record
                            await supabase.from('transactions').insert({
                                user_id: tx.user_id,
                                type: 'refund',
                                amount: refundAmount,
                                status: 'success',
                                description: `Risk Control Refund for Tx #${tx.reference || tx.id.slice(0, 8)}`,
                                reference: `REF-${Date.now().toString().slice(-6)}`,
                            });

                            // 5. Send notification
                            await supabase.from('notifications').insert({
                                user_id: tx.user_id,
                                title: 'Wallet Refund Received 💰',
                                message: `₦${refundAmount.toLocaleString()} has been refunded to your wallet following risk resolution.`,
                                type: 'credit',
                            });

                            setSelectedTx(null);
                            Alert.alert('Refund Complete ✅', `Successfully refunded ₦${refundAmount.toLocaleString()} to user wallet.`);
                            loadAllRiskData();
                        } catch (err: any) {
                            Alert.alert('Refund Error', err.message || 'Failed to process refund.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // 1-Click Action: Auto-Resolve AI Audit Anomaly
    const handleResolveAnomaly = async (anomaly: AuditAnomaly) => {
        if (anomaly.type === 'negative_balance') {
            Alert.alert(
                'Zero Out Negative Balance',
                `Do you want to reset ${anomaly.entityName}'s negative balance of ₦${anomaly.amount} to ₦0?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Reset to ₦0',
                        onPress: async () => {
                            try {
                                await supabase
                                    .from('profiles')
                                    .update({ balance: 0 })
                                    .eq('id', anomaly.entityId);

                                setAuditAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
                                Alert.alert('Resolved ✅', 'Negative balance corrected.');
                                loadAllRiskData();
                            } catch (e: any) {
                                Alert.alert('Error', e.message);
                            }
                        }
                    }
                ]
            );
        } else if (anomaly.type === 'unverified_whale') {
            Alert.alert(
                'Force KYC Upgrade Notice',
                `Send urgent Tier 2 KYC verification request to ${anomaly.entityName}?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Send Verification Demand',
                        onPress: async () => {
                            try {
                                await supabase.from('notifications').insert({
                                    user_id: anomaly.entityId,
                                    title: 'Action Required: Upgrade KYC 📋',
                                    message: 'Due to your high account volume, regulatory compliance requires completing Tier 2 verification to maintain active withdrawal access.',
                                    type: 'kyc',
                                });
                                Alert.alert('Notice Dispatched 📨', 'Verification demand sent to user.');
                            } catch (e: any) {
                                Alert.alert('Error', e.message);
                            }
                        }
                    }
                ]
            );
        } else {
            setAuditAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
            Alert.alert('Audit Flag Acknowledged', 'Anomaly marked as reviewed.');
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Risk Control & Compliance',
                    headerStyle: { backgroundColor: T.navyDark },
                    headerTintColor: '#FFFFFF',
                    headerRight: () => (
                        <TouchableOpacity onPress={onRefresh} style={{ marginRight: 12 }}>
                            <Ionicons name="refresh" size={20} color={T.gold} />
                        </TouchableOpacity>
                    ),
                }}
            />

            {/* Global Freeze Banner when active */}
            {policies.risk_global_freeze && (
                <View style={styles.emergencyBanner}>
                    <Ionicons name="warning" size={18} color="#FFFFFF" />
                    <Text style={styles.emergencyBannerText}>
                        EMERGENCY OUTFLOW FREEZE ACTIVE - All Debits Blocked
                    </Text>
                </View>
            )}

            {/* Sub-Navigation Tab Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    onPress={() => setActiveTab('overview')}
                    style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
                >
                    <Ionicons name="pulse" size={16} color={activeTab === 'overview' ? T.gold : T.textSub} />
                    <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                        Overview
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('policies')}
                    style={[styles.tabItem, activeTab === 'policies' && styles.tabItemActive]}
                >
                    <Ionicons name="shield-checkmark" size={16} color={activeTab === 'policies' ? T.gold : T.textSub} />
                    <Text style={[styles.tabText, activeTab === 'policies' && styles.tabTextActive]}>
                        Policies
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('queue')}
                    style={[styles.tabItem, activeTab === 'queue' && styles.tabItemActive]}
                >
                    <Ionicons name="alert-circle" size={16} color={activeTab === 'queue' ? T.gold : T.textSub} />
                    <Text style={[styles.tabText, activeTab === 'queue' && styles.tabTextActive]}>
                        Queue ({pendingFlagsCount})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('watchlist')}
                    style={[styles.tabItem, activeTab === 'watchlist' && styles.tabItemActive]}
                >
                    <Ionicons name="people" size={16} color={activeTab === 'watchlist' ? T.gold : T.textSub} />
                    <Text style={[styles.tabText, activeTab === 'watchlist' && styles.tabTextActive]}>
                        Watchlist
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        setActiveTab('ai_audit');
                        runRiskIntegrityAudit();
                    }}
                    style={[styles.tabItem, activeTab === 'ai_audit' && styles.tabItemActive]}
                >
                    <Ionicons name="hardware-chip" size={16} color={activeTab === 'ai_audit' ? T.gold : T.textSub} />
                    <Text style={[styles.tabText, activeTab === 'ai_audit' && styles.tabTextActive]}>
                        AI Audit
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={T.gold} />
                    <Text style={styles.loadingText}>Loading Live Risk Telemetry...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                >
                    {/* ========================================================================= */}
                    {/* TAB 1: OVERVIEW & REAL-TIME EXPOSURE                                      */}
                    {/* ========================================================================= */}
                    {activeTab === 'overview' && (
                        <View>
                            {/* Exposure Gauge & Risk Index Header */}
                            <LinearGradient
                                colors={[T.navyDark, T.navyMid]}
                                style={styles.heroCard}
                            >
                                <View style={styles.heroHeader}>
                                    <View>
                                        <Text style={styles.heroSub}>SYSTEM LIABILITY & FLOAT</Text>
                                        <Text style={styles.heroTitle}>
                                            ₦ {totalFloatLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.riskBadge,
                                        riskIndexScore > 75 ? styles.riskBadgeCritical :
                                        riskIndexScore > 40 ? styles.riskBadgeWarn : styles.riskBadgeSafe
                                    ]}>
                                        <Text style={[
                                            styles.riskBadgeText,
                                            riskIndexScore > 75 ? styles.riskBadgeTextCritical :
                                            riskIndexScore > 40 ? styles.riskBadgeTextWarn : styles.riskBadgeTextSafe
                                        ]}>
                                            {riskIndexScore > 75 ? 'HIGH RISK' : riskIndexScore > 40 ? 'MODERATE' : 'HEALTHY'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Dynamic Risk Gauge Bar */}
                                <View style={styles.gaugeContainer}>
                                    <View style={styles.gaugeTrack}>
                                        <View style={[
                                            styles.gaugeFill,
                                            {
                                                width: `${riskIndexScore}%`,
                                                backgroundColor: riskIndexScore > 75 ? T.danger : riskIndexScore > 40 ? T.warning : T.success
                                            }
                                        ]} />
                                    </View>
                                    <View style={styles.gaugeMeta}>
                                        <Text style={styles.gaugeMetaText}>Risk Index: {riskIndexScore}/100</Text>
                                        <Text style={styles.gaugeMetaText}>{totalUserCount} Active Profiles</Text>
                                    </View>
                                </View>
                            </LinearGradient>

                            {/* 24-Hour Velocity & Flow Metrics */}
                            <View style={styles.metricGrid}>
                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <Ionicons name="arrow-down-circle" size={18} color={T.success} />
                                        <Text style={styles.metricLabel}>24h Inflow</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.success }]}>
                                        +₦{outflow24h > 0 ? (inflow24h / 1000).toFixed(1) : '0'}k
                                    </Text>
                                    <Text style={styles.metricSub}>Deposits & Credits</Text>
                                </View>

                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <Ionicons name="arrow-up-circle" size={18} color={T.danger} />
                                        <Text style={styles.metricLabel}>24h Outflow</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.danger }]}>
                                        -₦{outflow24h > 0 ? (outflow24h / 1000).toFixed(1) : '0'}k
                                    </Text>
                                    <Text style={styles.metricSub}>Transfers & Bills</Text>
                                </View>

                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <Ionicons name="alert-circle" size={18} color={T.warning} />
                                        <Text style={styles.metricLabel}>24h Failures</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.warning }]}>
                                        {failedTx24h} Tx
                                    </Text>
                                    <Text style={styles.metricSub}>Declined / Gateway</Text>
                                </View>

                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <Ionicons name="shield" size={18} color={T.purple} />
                                        <Text style={styles.metricLabel}>Watchlist</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.purple }]}>
                                        {highRiskUsersCount} Accounts
                                    </Text>
                                    <Text style={styles.metricSub}>Frozen / Flagged</Text>
                                </View>
                            </View>

                            {/* Quick Action Matrix */}
                            <Text style={styles.sectionHeading}>Emergency & Fast Response Actions</Text>
                            <View style={styles.quickActionRow}>
                                <TouchableOpacity
                                    onPress={() => handleToggleGlobalFreeze(!policies.risk_global_freeze)}
                                    style={[styles.actionBtn, policies.risk_global_freeze ? styles.actionBtnActiveRed : styles.actionBtnRed]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name={policies.risk_global_freeze ? "lock-open" : "snow"} size={20} color="#FFFFFF" />
                                    <Text style={styles.actionBtnText}>
                                        {policies.risk_global_freeze ? 'Lift Lockdown' : 'Emergency Freeze'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setActiveTab('ai_audit');
                                        runRiskIntegrityAudit();
                                    }}
                                    style={styles.actionBtnBlue}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="hardware-chip-outline" size={20} color="#FFFFFF" />
                                    <Text style={styles.actionBtnText}>Run AI Audit</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setActiveTab('policies')}
                                    style={styles.actionBtnGold}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="options-outline" size={20} color="#0A1128" />
                                    <Text style={[styles.actionBtnText, { color: '#0A1128' }]}>Edit Limits</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Gateway & Partner Integrity Status */}
                            <Text style={styles.sectionHeading}>Counterparty & Channel Health</Text>
                            <View style={styles.gatewayCard}>
                                <View style={styles.gatewayRow}>
                                    <View style={styles.gatewayLeft}>
                                        <View style={styles.statusDotGreen} />
                                        <Text style={styles.gatewayName}>Monnify Reserved Accounts</Text>
                                    </View>
                                    <Text style={styles.gatewayStatusText}>Operational 99.8%</Text>
                                </View>

                                <View style={styles.gatewayRow}>
                                    <View style={styles.gatewayLeft}>
                                        <View style={styles.statusDotGreen} />
                                        <Text style={styles.gatewayName}>Payvessel Virtual Cards & Rails</Text>
                                    </View>
                                    <Text style={styles.gatewayStatusText}>Active & Synced</Text>
                                </View>

                                <View style={styles.gatewayRow}>
                                    <View style={styles.gatewayLeft}>
                                        <View style={styles.statusDotGreen} />
                                        <Text style={styles.gatewayName}>VTPass / Bilk Bills & Airtime</Text>
                                    </View>
                                    <Text style={styles.gatewayStatusText}>Low Latency (140ms)</Text>
                                </View>

                                <View style={[styles.gatewayRow, { borderBottomWidth: 0 }]}>
                                    <View style={styles.gatewayLeft}>
                                        <View style={styles.statusDotGreen} />
                                        <Text style={styles.gatewayName}>Crypto Liquidity & Gas Pool</Text>
                                    </View>
                                    <Text style={styles.gatewayStatusText}>Adequate Float</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: RISK POLICIES & LIMITS CONFIGURATION                               */}
                    {/* ========================================================================= */}
                    {activeTab === 'policies' && (
                        <View>
                            <View style={styles.cardHeaderBox}>
                                <Ionicons name="shield-half" size={24} color={T.gold} />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={styles.cardHeaderTitle}>Risk Rules & Policy Matrix</Text>
                                    <Text style={styles.cardHeaderSub}>Live limits applied automatically on transactions</Text>
                                </View>
                            </View>

                            {/* Form Inputs for Numeric Limits */}
                            <View style={styles.policyCard}>
                                <Text style={styles.inputLabel}>Maximum Single Debit Limit (₦)</Text>
                                <Text style={styles.inputHelper}>Any single debit above this amount will be blocked or quarantined.</Text>
                                <TextInput
                                    value={inputMaxSingle}
                                    onChangeText={setInputMaxSingle}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholder="250000"
                                />

                                <Text style={styles.inputLabel}>Standard Daily Debit Cap (₦)</Text>
                                <Text style={styles.inputHelper}>Maximum cumulative outflow permitted per user in a 24-hour window.</Text>
                                <TextInput
                                    value={inputDailyLimit}
                                    onChangeText={setInputDailyLimit}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholder="1000000"
                                />

                                <Text style={styles.inputLabel}>Velocity Throttle (Max Tx / Hour)</Text>
                                <Text style={styles.inputHelper}>Maximum allowed successful transactions per user within 60 minutes.</Text>
                                <TextInput
                                    value={inputVelocity}
                                    onChangeText={setInputVelocity}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholder="6"
                                />

                                <Text style={styles.inputLabel}>Large Transfer Quarantine Threshold (₦)</Text>
                                <Text style={styles.inputHelper}>Transactions above this amount trigger an automated manager review flag.</Text>
                                <TextInput
                                    value={inputQuarantine}
                                    onChangeText={setInputQuarantine}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholder="100000"
                                />
                            </View>

                            {/* Boolean Toggles */}
                            <Text style={styles.sectionHeading}>Security Enforcement Toggles</Text>
                            <View style={styles.policyCard}>
                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.toggleTitle}>Require KYC Tier 2 for Outflows</Text>
                                        <Text style={styles.toggleSub}>Restricts bank transfers and crypto withdrawals to verified accounts.</Text>
                                    </View>
                                    <Switch
                                        value={policies.risk_require_kyc2_outflows}
                                        onValueChange={(val) => setPolicies(p => ({ ...p, risk_require_kyc2_outflows: val }))}
                                        trackColor={{ false: '#CBD5E1', true: T.gold }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.toggleTitle}>Night-Time High-Value Alerts</Text>
                                        <Text style={styles.toggleSub}>Trigger priority notifications for large transfers between 11 PM and 5 AM.</Text>
                                    </View>
                                    <Switch
                                        value={policies.risk_offhours_alerts}
                                        onValueChange={(val) => setPolicies(p => ({ ...p, risk_offhours_alerts: val }))}
                                        trackColor={{ false: '#CBD5E1', true: T.gold }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.toggleTitle}>Auto-Lock on Failed PIN Attempts</Text>
                                        <Text style={styles.toggleSub}>Lock account automatically after 5 consecutive incorrect transaction PINs.</Text>
                                    </View>
                                    <Switch
                                        value={policies.risk_auto_lock_failed_auth}
                                        onValueChange={(val) => setPolicies(p => ({ ...p, risk_auto_lock_failed_auth: val }))}
                                        trackColor={{ false: '#CBD5E1', true: T.gold }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>
                            </View>

                            {/* Save Policies Button */}
                            <TouchableOpacity
                                onPress={handleSavePolicies}
                                disabled={savingPolicies}
                                style={styles.savePoliciesBtn}
                                activeOpacity={0.85}
                            >
                                {savingPolicies ? (
                                    <ActivityIndicator color="#0A1128" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={18} color="#0A1128" />
                                        <Text style={styles.savePoliciesBtnText}>Save & Deploy Risk Policies</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: FLAGGED TRANSACTIONS QUEUE                                         */}
                    {/* ========================================================================= */}
                    {activeTab === 'queue' && (
                        <View>
                            {/* Filter Bar & Search */}
                            <View style={styles.filterRow}>
                                <TouchableOpacity
                                    onPress={() => handleFilterChange('all')}
                                    style={[styles.filterPill, txFilter === 'all' && styles.filterPillActive]}
                                >
                                    <Text style={[styles.filterPillText, txFilter === 'all' && styles.filterPillTextActive]}>
                                        All ({transactions.length})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleFilterChange('high_value')}
                                    style={[styles.filterPill, txFilter === 'high_value' && styles.filterPillActive]}
                                >
                                    <Text style={[styles.filterPillText, txFilter === 'high_value' && styles.filterPillTextActive]}>
                                        High Value
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleFilterChange('failed')}
                                    style={[styles.filterPill, txFilter === 'failed' && styles.filterPillActive]}
                                >
                                    <Text style={[styles.filterPillText, txFilter === 'failed' && styles.filterPillTextActive]}>
                                        Failed
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleFilterChange('flagged')}
                                    style={[styles.filterPill, txFilter === 'flagged' && styles.filterPillActive]}
                                >
                                    <Text style={[styles.filterPillText, txFilter === 'flagged' && styles.filterPillTextActive]}>
                                        Flagged
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={18} color={T.textSub} style={{ marginRight: 8 }} />
                                <TextInput
                                    value={txSearch}
                                    onChangeText={handleSearchChange}
                                    placeholder="Search by amount, ref, email, description..."
                                    placeholderTextColor={T.textSub}
                                    style={styles.searchInput}
                                />
                            </View>

                            {/* Transaction List */}
                            {filteredTx.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="shield-checkmark" size={48} color={T.success} />
                                    <Text style={styles.emptyStateTitle}>Queue is Clean</Text>
                                    <Text style={styles.emptyStateSub}>No transactions match the selected filter criteria.</Text>
                                </View>
                            ) : (
                                filteredTx.map((item) => {
                                    const isHigh = Number(item.amount) >= (policies.risk_auto_quarantine_above || 100000);
                                    const isFailed = item.status === 'failed';

                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            onPress={() => setSelectedTx(item)}
                                            style={styles.txCard}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.txCardLeft}>
                                                <View style={[
                                                    styles.txIconBox,
                                                    isFailed ? styles.txIconFailed : isHigh ? styles.txIconHigh : styles.txIconNormal
                                                ]}>
                                                    <Ionicons
                                                        name={isFailed ? "close-circle" : isHigh ? "alert" : "swap-horizontal"}
                                                        size={18}
                                                        color={isFailed ? T.danger : isHigh ? T.warning : T.info}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.txDescription} numberOfLines={1}>
                                                        {item.description || `Transaction ${item.type}`}
                                                    </Text>
                                                    <Text style={styles.txMeta}>
                                                        {item.user?.full_name || item.user?.email || item.user_id?.slice(0, 8)} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.txAmount}>
                                                    ₦{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </Text>
                                                <View style={[
                                                    styles.statusPill,
                                                    item.status === 'success' ? styles.statusPillSuccess :
                                                    item.status === 'failed' ? styles.statusPillFailed : styles.statusPillWarn
                                                ]}>
                                                    <Text style={[
                                                        styles.statusPillText,
                                                        item.status === 'success' ? styles.statusPillTextSuccess :
                                                        item.status === 'failed' ? styles.statusPillTextFailed : styles.statusPillTextWarn
                                                    ]}>
                                                        {item.status?.toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 4: WATCHLIST & MONITORED USERS                                        */}
                    {/* ========================================================================= */}
                    {activeTab === 'watchlist' && (
                        <View>
                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={18} color={T.textSub} style={{ marginRight: 8 }} />
                                <TextInput
                                    value={userSearch}
                                    onChangeText={setUserSearch}
                                    placeholder="Search watchlist by name, phone, email..."
                                    placeholderTextColor={T.textSub}
                                    style={styles.searchInput}
                                />
                            </View>

                            {watchlistUsers
                                .filter(u => !userSearch.trim() || (
                                    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                                    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
                                    u.phone?.includes(userSearch)
                                ))
                                .map((user) => {
                                    const isSuspended = user.status === 'suspended' || user.status === 'blocked';
                                    return (
                                        <TouchableOpacity
                                            key={user.id}
                                            onPress={() => setSelectedUser(user)}
                                            style={styles.userCard}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.userCardHeader}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={[styles.avatarBox, isSuspended ? styles.avatarBoxFrozen : styles.avatarBoxActive]}>
                                                        <Text style={[styles.avatarText, isSuspended ? { color: T.danger } : { color: T.navyDark }]}>
                                                            {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                                                        </Text>
                                                    </View>
                                                    <View style={{ marginLeft: 10 }}>
                                                        <Text style={styles.userName}>{user.full_name || 'User'}</Text>
                                                        <Text style={styles.userSub}>{user.email || user.phone || user.id.slice(0, 10)}</Text>
                                                    </View>
                                                </View>

                                                <View style={[
                                                    styles.statusPill,
                                                    isSuspended ? styles.statusPillFailed : styles.statusPillSuccess
                                                ]}>
                                                    <Text style={[
                                                        styles.statusPillText,
                                                        isSuspended ? styles.statusPillTextFailed : styles.statusPillTextSuccess
                                                    ]}>
                                                        {isSuspended ? 'FROZEN' : 'ACTIVE'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.userCardFooter}>
                                                <View>
                                                    <Text style={styles.userMetaLabel}>Wallet Balance</Text>
                                                    <Text style={styles.userBalance}>
                                                        ₦{Number(user.balance || 0).toLocaleString()}
                                                    </Text>
                                                </View>

                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.userMetaLabel}>Verification</Text>
                                                    <Text style={styles.userKycTier}>Tier {user.kyc_tier || 1}</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            }
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 5: AI RISK SCANNER & AUDIT LOGS                                       */}
                    {/* ========================================================================= */}
                    {activeTab === 'ai_audit' && (
                        <View>
                            <View style={styles.aiHeaderCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="hardware-chip" size={24} color={T.gold} />
                                    <Text style={styles.aiHeaderTitle}>Cortex AI Risk Scanner</Text>
                                </View>
                                <Text style={styles.aiHeaderSub}>
                                    Automated ledger audit analyzing negative balances, anomalous outflow velocity, and unverified high-float profiles.
                                </Text>
                                <TouchableOpacity
                                    onPress={runRiskIntegrityAudit}
                                    disabled={scanningAudit}
                                    style={styles.rescanBtn}
                                    activeOpacity={0.8}
                                >
                                    {scanningAudit ? (
                                        <ActivityIndicator color="#0A1128" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="search" size={16} color="#0A1128" />
                                            <Text style={styles.rescanBtnText}>Run Deep Scan Now</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionHeading}>Audit Findings ({auditAnomalies.length})</Text>

                            {auditAnomalies.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="checkmark-done-circle" size={54} color={T.success} />
                                    <Text style={styles.emptyStateTitle}>Zero Critical Vulnerabilities</Text>
                                    <Text style={styles.emptyStateSub}>Database ledger is balanced. No negative balances or extreme velocity spikes found.</Text>
                                </View>
                            ) : (
                                auditAnomalies.map((item) => (
                                    <View key={item.id} style={styles.anomalyCard}>
                                        <View style={styles.anomalyHeader}>
                                            <View style={[
                                                styles.severityBadge,
                                                item.severity === 'critical' ? styles.severityBadgeCritical :
                                                item.severity === 'high' ? styles.severityBadgeHigh : styles.severityBadgeMedium
                                            ]}>
                                                <Text style={[
                                                    styles.severityBadgeText,
                                                    item.severity === 'critical' ? styles.severityBadgeTextCritical :
                                                    item.severity === 'high' ? styles.severityBadgeTextHigh : styles.severityBadgeTextMedium
                                                ]}>
                                                    {item.severity.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={styles.anomalyTitle}>{item.title}</Text>
                                        </View>

                                        <Text style={styles.anomalyDesc}>{item.description}</Text>

                                        <View style={styles.anomalyFooter}>
                                            <Text style={styles.anomalyEntity}>Target: {item.entityName}</Text>
                                            <TouchableOpacity
                                                onPress={() => handleResolveAnomaly(item)}
                                                style={styles.resolveBtn}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.resolveBtnText}>1-Tap Fix ⚡</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* ========================================================================= */}
            {/* MODAL 1: TRANSACTION INVESTIGATION SHEET                                   */}
            {/* ========================================================================= */}
            <Modal
                visible={!!selectedTx}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedTx(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Transaction Details</Text>
                            <TouchableOpacity onPress={() => setSelectedTx(null)}>
                                <Ionicons name="close-circle" size={24} color={T.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedTx && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalAmountBox}>
                                    <Text style={styles.modalAmountLabel}>TRANSACTION AMOUNT</Text>
                                    <Text style={styles.modalAmountValue}>
                                        ₦{Number(selectedTx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                    <Text style={styles.modalRefText}>Ref: {selectedTx.reference || selectedTx.id}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Type</Text>
                                    <Text style={styles.infoValue}>{selectedTx.type?.toUpperCase()}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Status</Text>
                                    <Text style={[styles.infoValue, { color: selectedTx.status === 'success' ? T.success : T.danger }]}>
                                        {selectedTx.status?.toUpperCase()}
                                    </Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Timestamp</Text>
                                    <Text style={styles.infoValue}>{new Date(selectedTx.created_at).toLocaleString()}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>User Name</Text>
                                    <Text style={styles.infoValue}>{selectedTx.user?.full_name || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>User Email</Text>
                                    <Text style={styles.infoValue}>{selectedTx.user?.email || selectedTx.user_id}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>User Status</Text>
                                    <Text style={[styles.infoValue, { color: selectedTx.user?.status === 'suspended' ? T.danger : T.success }]}>
                                        {selectedTx.user?.status?.toUpperCase() || 'ACTIVE'}
                                    </Text>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.modalBtnContainer}>
                                    {selectedTx.status !== 'success' && (
                                        <TouchableOpacity
                                            onPress={() => handleApproveTxFlag(selectedTx)}
                                            disabled={actionLoading}
                                            style={styles.btnApprove}
                                        >
                                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                                            <Text style={styles.btnApproveText}>Approve & Clear Flag</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => handleReverseTransaction(selectedTx)}
                                        disabled={actionLoading}
                                        style={styles.btnRefund}
                                    >
                                        <Ionicons name="arrow-undo" size={18} color="#FFFFFF" />
                                        <Text style={styles.btnRefundText}>Reverse & Refund Wallet</Text>
                                    </TouchableOpacity>

                                    {selectedTx.user && (
                                        <TouchableOpacity
                                            onPress={() => handleToggleUserFreeze(selectedTx.user!)}
                                            disabled={actionLoading}
                                            style={styles.btnFreeze}
                                        >
                                            <Ionicons name="snow" size={18} color="#FFFFFF" />
                                            <Text style={styles.btnFreezeText}>
                                                {selectedTx.user.status === 'suspended' ? 'Unfreeze User' : 'Freeze User Account'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: USER PROFILE RISK INSPECTOR SHEET                                */}
            {/* ========================================================================= */}
            <Modal
                visible={!!selectedUser}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedUser(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>User Risk Inspection</Text>
                            <TouchableOpacity onPress={() => setSelectedUser(null)}>
                                <Ionicons name="close-circle" size={24} color={T.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedUser && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalAmountBox}>
                                    <Text style={styles.modalAmountLabel}>ACTIVE WALLET BALANCE</Text>
                                    <Text style={styles.modalAmountValue}>
                                        ₦{Number(selectedUser.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                    <Text style={styles.modalRefText}>ID: {selectedUser.id}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Full Name</Text>
                                    <Text style={styles.infoValue}>{selectedUser.full_name || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Email</Text>
                                    <Text style={styles.infoValue}>{selectedUser.email || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Phone</Text>
                                    <Text style={styles.infoValue}>{selectedUser.phone || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>KYC Verification</Text>
                                    <Text style={styles.infoValue}>Tier {selectedUser.kyc_tier || 1}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Account Status</Text>
                                    <Text style={[styles.infoValue, { color: selectedUser.status === 'suspended' ? T.danger : T.success }]}>
                                        {selectedUser.status?.toUpperCase() || 'ACTIVE'}
                                    </Text>
                                </View>

                                <View style={styles.modalBtnContainer}>
                                    <TouchableOpacity
                                        onPress={() => handleToggleUserFreeze(selectedUser)}
                                        disabled={actionLoading}
                                        style={[styles.btnFreeze, { backgroundColor: selectedUser.status === 'suspended' ? T.success : T.danger }]}
                                    >
                                        <Ionicons name={selectedUser.status === 'suspended' ? "lock-open" : "snow"} size={18} color="#FFFFFF" />
                                        <Text style={styles.btnFreezeText}>
                                            {selectedUser.status === 'suspended' ? 'Reactivate Account' : 'Freeze Account Instantly'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={async () => {
                                            try {
                                                await supabase.from('notifications').insert({
                                                    user_id: selectedUser.id,
                                                    title: 'Security Notice from Management 🛡️',
                                                    message: 'Your account is under periodic risk compliance review. If you notice any suspicious activity, please notify support immediately.',
                                                    type: 'security',
                                                });
                                                Alert.alert('Sent', 'Security advisory delivered to user notification feed.');
                                            } catch (e: any) {
                                                Alert.alert('Error', e.message);
                                            }
                                        }}
                                        style={styles.btnApprove}
                                    >
                                        <Ionicons name="notifications" size={18} color="#FFFFFF" />
                                        <Text style={styles.btnApproveText}>Dispatch Security Advisory</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        fontWeight: '700',
        color: T.textSub,
    },
    emergencyBanner: {
        backgroundColor: T.danger,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        gap: 8,
    },
    emergencyBannerText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 11.5,
        letterSpacing: 0.5,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: T.navyDark,
        paddingHorizontal: 8,
        paddingBottom: 8,
        justifyContent: 'space-around',
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    tabItemActive: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.textSub,
    },
    tabTextActive: {
        color: T.gold,
        fontWeight: '800',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    heroCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    heroSub: {
        fontSize: 10,
        fontWeight: '900',
        color: T.gold,
        letterSpacing: 1,
        marginBottom: 4,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    riskBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    riskBadgeSafe: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    riskBadgeWarn: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    riskBadgeCritical: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    riskBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    riskBadgeTextSafe: {
        color: T.success,
    },
    riskBadgeTextWarn: {
        color: T.warning,
    },
    riskBadgeTextCritical: {
        color: T.danger,
    },
    gaugeContainer: {
        marginTop: 4,
    },
    gaugeTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    gaugeFill: {
        height: '100%',
        borderRadius: 3,
    },
    gaugeMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    gaugeMetaText: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '700',
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    metricCard: {
        flex: 1,
        minWidth: '47%',
        backgroundColor: T.card,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    metricCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    metricLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textSub,
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 2,
    },
    metricSub: {
        fontSize: 10,
        color: T.textSub,
        fontWeight: '600',
    },
    sectionHeading: {
        fontSize: 13,
        fontWeight: '800',
        color: T.textMain,
        marginTop: 8,
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    quickActionRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
    },
    actionBtnRed: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
        backgroundColor: T.danger,
    },
    actionBtnActiveRed: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
        backgroundColor: '#991B1B',
    },
    actionBtnBlue: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
        backgroundColor: T.navyDark,
    },
    actionBtnGold: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
        backgroundColor: T.gold,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 11,
    },
    gatewayCard: {
        backgroundColor: T.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 16,
    },
    gatewayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    gatewayLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusDotGreen: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.success,
    },
    gatewayName: {
        fontSize: 12,
        fontWeight: '700',
        color: T.textMain,
    },
    gatewayStatusText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.success,
    },
    cardHeaderBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.navyDark,
        padding: 14,
        borderRadius: 16,
        marginBottom: 14,
    },
    cardHeaderTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    cardHeaderSub: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
    },
    policyCard: {
        backgroundColor: T.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textMain,
        marginTop: 8,
        marginBottom: 2,
    },
    inputHelper: {
        fontSize: 10,
        color: T.textSub,
        marginBottom: 6,
    },
    numericInput: {
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        fontWeight: '800',
        color: T.textMain,
        marginBottom: 12,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    toggleTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: T.textMain,
        marginBottom: 2,
    },
    toggleSub: {
        fontSize: 10.5,
        color: T.textSub,
    },
    savePoliciesBtn: {
        backgroundColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
        marginBottom: 20,
    },
    savePoliciesBtnText: {
        color: '#0A1128',
        fontWeight: '900',
        fontSize: 13,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.border,
    },
    filterPillActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textSub,
    },
    filterPillTextActive: {
        color: T.gold,
        fontWeight: '800',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.cardBorder,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: T.textMain,
        fontWeight: '600',
    },
    emptyState: {
        backgroundColor: T.card,
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginTop: 10,
    },
    emptyStateTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: T.textMain,
        marginTop: 10,
        marginBottom: 4,
    },
    emptyStateSub: {
        fontSize: 11,
        color: T.textSub,
        textAlign: 'center',
    },
    txCard: {
        backgroundColor: T.card,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    txCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        marginRight: 10,
    },
    txIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txIconNormal: {
        backgroundColor: T.infoBg,
    },
    txIconHigh: {
        backgroundColor: T.warningBg,
    },
    txIconFailed: {
        backgroundColor: T.dangerBg,
    },
    txDescription: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textMain,
    },
    txMeta: {
        fontSize: 10,
        color: T.textSub,
        marginTop: 2,
    },
    txAmount: {
        fontSize: 13,
        fontWeight: '900',
        color: T.textMain,
        marginBottom: 2,
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusPillSuccess: {
        backgroundColor: T.successBg,
    },
    statusPillWarn: {
        backgroundColor: T.warningBg,
    },
    statusPillFailed: {
        backgroundColor: T.dangerBg,
    },
    statusPillText: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    statusPillTextSuccess: {
        color: T.success,
    },
    statusPillTextWarn: {
        color: T.warning,
    },
    statusPillTextFailed: {
        color: T.danger,
    },
    userCard: {
        backgroundColor: T.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
    },
    userCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarBoxActive: {
        backgroundColor: T.goldBg,
    },
    avatarBoxFrozen: {
        backgroundColor: T.dangerBg,
    },
    avatarText: {
        fontSize: 15,
        fontWeight: '900',
    },
    userName: {
        fontSize: 13,
        fontWeight: '800',
        color: T.textMain,
    },
    userSub: {
        fontSize: 10.5,
        color: T.textSub,
    },
    userCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8,
    },
    userMetaLabel: {
        fontSize: 9.5,
        color: T.textSub,
        fontWeight: '700',
    },
    userBalance: {
        fontSize: 13,
        fontWeight: '900',
        color: T.textMain,
    },
    userKycTier: {
        fontSize: 12,
        fontWeight: '800',
        color: T.goldDark,
    },
    aiHeaderCard: {
        backgroundColor: T.navyDark,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    aiHeaderTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        marginLeft: 8,
    },
    aiHeaderSub: {
        color: '#94A3B8',
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 12,
    },
    rescanBtn: {
        backgroundColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    rescanBtnText: {
        color: '#0A1128',
        fontWeight: '900',
        fontSize: 12,
    },
    anomalyCard: {
        backgroundColor: T.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
    },
    anomalyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    severityBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    severityBadgeCritical: {
        backgroundColor: T.dangerBg,
    },
    severityBadgeHigh: {
        backgroundColor: T.warningBg,
    },
    severityBadgeMedium: {
        backgroundColor: T.infoBg,
    },
    severityBadgeText: {
        fontSize: 9,
        fontWeight: '900',
    },
    severityBadgeTextCritical: {
        color: T.danger,
    },
    severityBadgeTextHigh: {
        color: T.warning,
    },
    severityBadgeTextMedium: {
        color: T.info,
    },
    anomalyTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: T.textMain,
        flex: 1,
    },
    anomalyDesc: {
        fontSize: 11,
        color: T.textSub,
        lineHeight: 16,
        marginBottom: 10,
    },
    anomalyFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8,
    },
    anomalyEntity: {
        fontSize: 10.5,
        fontWeight: '700',
        color: T.textMain,
        flex: 1,
    },
    resolveBtn: {
        backgroundColor: T.navyDark,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    resolveBtnText: {
        color: T.gold,
        fontSize: 11,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: T.textMain,
    },
    modalAmountBox: {
        backgroundColor: T.navyDark,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    modalAmountLabel: {
        color: T.gold,
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    modalAmountValue: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 4,
    },
    modalRefText: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        fontSize: 12,
        color: T.textSub,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textMain,
    },
    modalBtnContainer: {
        marginTop: 20,
        gap: 8,
        paddingBottom: 20,
    },
    btnApprove: {
        backgroundColor: T.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    btnApproveText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12.5,
    },
    btnRefund: {
        backgroundColor: T.warning,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    btnRefundText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12.5,
    },
    btnFreeze: {
        backgroundColor: T.danger,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    btnFreezeText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12.5,
    },
});
