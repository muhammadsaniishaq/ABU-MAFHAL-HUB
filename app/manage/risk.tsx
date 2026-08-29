import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Switch,
    RefreshControl,
    StyleSheet,
    Dimensions,
    Share
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Executive Bright Light Palette (Modern, Crisp & High-Contrast)
const T = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardHover: '#F1F5F9',
    navyDark: '#0A1128',
    navyMid: '#1E293B',
    navyLight: '#334155',
    gold: '#D97706',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    border: '#CBD5E1',
    inputBg: '#F8FAFC',
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
};

interface RiskPolicySettings {
    risk_max_single_tx: number;
    risk_daily_account_limit: number;
    risk_velocity_max_hourly_tx: number;
    risk_auto_quarantine_above: number;
    risk_vtu_velocity_cap: number;
    risk_crypto_single_max: number;
    risk_nineboost_max_order: number;
    risk_agenthub_daily_quota: number;
    risk_require_kyc2_outflows: boolean;
    risk_global_freeze: boolean;
    risk_offhours_alerts: boolean;
    risk_auto_lock_failed_auth: boolean;
    risk_payvessel_killswitch: boolean;
    risk_bigi_killswitch: boolean;
    risk_bilal_killswitch: boolean;
    risk_clubkonnect_killswitch: boolean;
    risk_agenthub_killswitch: boolean;
    risk_nineboost_killswitch: boolean;
    risk_crypto_killswitch: boolean;
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
    fraudScore?: number;
    riskReasons?: string[];
    user?: UserProfile;
}

interface BlacklistItem {
    id: string;
    type: 'account_number' | 'phone' | 'email' | 'bvn' | 'nin' | 'ip';
    value: string;
    reason: string;
    created_at: string;
}

interface ChannelStatus {
    id: string;
    name: string;
    provider: string;
    service: string;
    category: 'VIRTUAL_ACCOUNTS' | 'VTU_DATA' | 'KYC_IDENTITY' | 'SMM_BOOST' | 'CRYPTO' | 'SMS_OTP';
    status: 'operational' | 'degraded' | 'offline';
    latencyMs: number;
    lastPing: string;
    killswitchKey: keyof RiskPolicySettings;
    icon: string;
}

export default function RiskControlCenter() {
    const router = useRouter();

    // Active Navigation Tab
    const [activeTab, setActiveTab] = useState<'overview' | 'policies' | 'queue' | 'channels' | 'blacklist' | 'stress_test'>('overview');

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
    const [riskIndexScore, setRiskIndexScore] = useState(14);

    // Risk Policies State
    const [policies, setPolicies] = useState<RiskPolicySettings>({
        risk_max_single_tx: 250000,
        risk_daily_account_limit: 1000000,
        risk_velocity_max_hourly_tx: 6,
        risk_auto_quarantine_above: 100000,
        risk_vtu_velocity_cap: 25000,
        risk_crypto_single_max: 500000,
        risk_nineboost_max_order: 50000,
        risk_agenthub_daily_quota: 20,
        risk_require_kyc2_outflows: true,
        risk_global_freeze: false,
        risk_offhours_alerts: true,
        risk_auto_lock_failed_auth: true,
        risk_payvessel_killswitch: false,
        risk_bigi_killswitch: false,
        risk_bilal_killswitch: false,
        risk_clubkonnect_killswitch: false,
        risk_agenthub_killswitch: false,
        risk_nineboost_killswitch: false,
        risk_crypto_killswitch: false,
    });

    // Form inputs for numeric policy limits
    const [inputMaxSingle, setInputMaxSingle] = useState('250000');
    const [inputDailyLimit, setInputDailyLimit] = useState('1000000');
    const [inputVelocity, setInputVelocity] = useState('6');
    const [inputQuarantine, setInputQuarantine] = useState('100000');
    const [inputVtuCap, setInputVtuCap] = useState('25000');
    const [inputCryptoMax, setInputCryptoMax] = useState('500000');
    const [inputNineBoostMax, setInputNineBoostMax] = useState('50000');
    const [inputAgentHubQuota, setInputAgentHubQuota] = useState('20');

    // Transactions Queue
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [filteredTx, setFilteredTx] = useState<TransactionItem[]>([]);
    const [txFilter, setTxFilter] = useState<'all' | 'high_risk' | 'failed' | 'high_value'>('all');
    const [txSearch, setTxSearch] = useState('');

    // Blacklist State
    const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
    const [newBlacklistType, setNewBlacklistType] = useState<'account_number' | 'phone' | 'email' | 'bvn' | 'nin' | 'ip'>('account_number');
    const [newBlacklistValue, setNewBlacklistValue] = useState('');
    const [newBlacklistReason, setNewBlacklistReason] = useState('');
    const [showBlacklistModal, setShowBlacklistModal] = useState(false);

    // Exact Platform Providers State (Payvessel, Bigi Sub, BilalSadaSub, ClubKonnect, AgentHub, NineBoost, NOWPayments, Termii)
    const [channels, setChannels] = useState<ChannelStatus[]>([
        { id: 'payvessel', name: 'Payvessel Virtual Accounts & Cards', provider: 'Payvessel Engine', service: 'Reserved Accounts, Outward Rails & USD Cards', category: 'VIRTUAL_ACCOUNTS', status: 'operational', latencyMs: 115, lastPing: 'Live (99.9%)', killswitchKey: 'risk_payvessel_killswitch', icon: 'card' },
        { id: 'bigisub', name: 'Bigi Sub Data & VTU Engine', provider: 'Bigi Sub Platform', service: 'SME Data, Airtime & Direct Subscriptions', category: 'VTU_DATA', status: 'operational', latencyMs: 88, lastPing: 'Live (99.9%)', killswitchKey: 'risk_bigi_killswitch', icon: 'cellular' },
        { id: 'bilalsadasub', name: 'Bilal Sada Sub Telecom Rails', provider: 'BilalSadaSub Gateway', service: 'Airtime, Data Bundles & Utility Routing', category: 'VTU_DATA', status: 'operational', latencyMs: 92, lastPing: 'Live (99.8%)', killswitchKey: 'risk_bilal_killswitch', icon: 'phone-portrait' },
        { id: 'clubkonnect', name: 'ClubKonnect Utility & Bill Hub', provider: 'ClubKonnect API', service: 'Electricity Tokens, Cable TV & Bills', category: 'VTU_DATA', status: 'operational', latencyMs: 105, lastPing: 'Live (99.7%)', killswitchKey: 'risk_clubkonnect_killswitch', icon: 'flash' },
        { id: 'agenthub', name: 'AgentHub Government Identity Engine', provider: 'AgentHub KYC API', service: 'Real-Time NIN, BVN & CAC Verification', category: 'KYC_IDENTITY', status: 'operational', latencyMs: 160, lastPing: 'Live (99.5%)', killswitchKey: 'risk_agenthub_killswitch', icon: 'finger-print' },
        { id: 'nineboost', name: 'NineBoost Social Marketing (SMM)', provider: 'NineBoost Engine', service: 'Followers, Likes, Views & Engagement API', category: 'SMM_BOOST', status: 'operational', latencyMs: 130, lastPing: 'Live (99.9%)', killswitchKey: 'risk_nineboost_killswitch', icon: 'trending-up' },
        { id: 'nowpayments', name: 'NOWPayments Web3 & Crypto Custody', provider: 'NOWPayments Gateways', service: 'USDT, BTC, ETH Deposits & Auto-Payouts', category: 'CRYPTO', status: 'operational', latencyMs: 190, lastPing: 'Live (99.6%)', killswitchKey: 'risk_crypto_killswitch', icon: 'logo-bitcoin' },
        { id: 'termii', name: 'Termii High-Priority Messaging', provider: 'Termii SMS Gateway', service: '2FA OTPs, Security Mailer & Alerts', category: 'SMS_OTP', status: 'operational', latencyMs: 70, lastPing: 'Live (100%)', killswitchKey: 'risk_global_freeze', icon: 'chatbubble-ellipses' },
    ]);

    // Stress Test States
    const [stressTestFloatRun, setStressTestFloatRun] = useState(10);
    const [simulatingStress, setSimulatingStress] = useState(false);
    const [stressResult, setStressResult] = useState<any>(null);

    // Selected Modals
    const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

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
                fetchBlacklist(),
            ]);
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
                const map: Record<string, any> = {};
                data.forEach(item => {
                    map[item.key] = item.value;
                });

                const loaded: RiskPolicySettings = {
                    risk_max_single_tx: Number(map['risk_max_single_tx']) || 250000,
                    risk_daily_account_limit: Number(map['risk_daily_account_limit']) || 1000000,
                    risk_velocity_max_hourly_tx: Number(map['risk_velocity_max_hourly_tx']) || 6,
                    risk_auto_quarantine_above: Number(map['risk_auto_quarantine_above']) || 100000,
                    risk_vtu_velocity_cap: Number(map['risk_vtu_velocity_cap']) || 25000,
                    risk_crypto_single_max: Number(map['risk_crypto_single_max']) || 500000,
                    risk_nineboost_max_order: Number(map['risk_nineboost_max_order']) || 50000,
                    risk_agenthub_daily_quota: Number(map['risk_agenthub_daily_quota']) || 20,
                    risk_require_kyc2_outflows: map['risk_require_kyc2_outflows'] === true || map['risk_require_kyc2_outflows'] === 'true',
                    risk_global_freeze: map['risk_global_freeze'] === true || map['risk_global_freeze'] === 'true',
                    risk_offhours_alerts: map['risk_offhours_alerts'] === true || map['risk_offhours_alerts'] === 'true',
                    risk_auto_lock_failed_auth: map['risk_auto_lock_failed_auth'] === true || map['risk_auto_lock_failed_auth'] === 'true',
                    risk_payvessel_killswitch: map['risk_payvessel_killswitch'] === true || map['risk_payvessel_killswitch'] === 'true',
                    risk_bigi_killswitch: map['risk_bigi_killswitch'] === true || map['risk_bigi_killswitch'] === 'true',
                    risk_bilal_killswitch: map['risk_bilal_killswitch'] === true || map['risk_bilal_killswitch'] === 'true',
                    risk_clubkonnect_killswitch: map['risk_clubkonnect_killswitch'] === true || map['risk_clubkonnect_killswitch'] === 'true',
                    risk_agenthub_killswitch: map['risk_agenthub_killswitch'] === true || map['risk_agenthub_killswitch'] === 'true',
                    risk_nineboost_killswitch: map['risk_nineboost_killswitch'] === true || map['risk_nineboost_killswitch'] === 'true',
                    risk_crypto_killswitch: map['risk_crypto_killswitch'] === true || map['risk_crypto_killswitch'] === 'true',
                };

                setPolicies(loaded);
                setInputMaxSingle(loaded.risk_max_single_tx.toString());
                setInputDailyLimit(loaded.risk_daily_account_limit.toString());
                setInputVelocity(loaded.risk_velocity_max_hourly_tx.toString());
                setInputQuarantine(loaded.risk_auto_quarantine_above.toString());
                setInputVtuCap(loaded.risk_vtu_velocity_cap.toString());
                setInputCryptoMax(loaded.risk_crypto_single_max.toString());
                setInputNineBoostMax(loaded.risk_nineboost_max_order.toString());
                setInputAgentHubQuota(loaded.risk_agenthub_daily_quota.toString());
            }
        } catch (e) {
            console.error('Fetch policies error:', e);
        }
    };

    // 2. Fetch Live Metrics & Aggregates
    const fetchLiveMetrics = async () => {
        try {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, balance, credit_balance, status');

            if (profiles) {
                setTotalUserCount(profiles.length);
                const totalFloat = profiles.reduce((acc, p) => acc + (Number(p.balance) || 0) + (Number(p.credit_balance) || 0), 0);
                setTotalFloatLiability(totalFloat);

                const highRisk = profiles.filter(p => p.status === 'suspended' || p.status === 'blocked' || p.status === 'flagged');
                setHighRiskUsersCount(highRisk.length);
            }

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
                    if (tx.status === 'failed') failedCount++;
                    if (['transfer', 'withdrawal', 'crypto_buy', 'bill_payment', 'smm_order', 'nin_verify', 'bvn_verify'].includes(tx.type)) {
                        outSum += amt;
                    } else if (['deposit', 'credit', 'refund'].includes(tx.type)) {
                        inSum += amt;
                    }
                });

                setOutflow24h(outSum);
                setInflow24h(inSum);
                setFailedTx24h(failedCount);

                let score = 10;
                if (failedCount > 3) score += Math.min(30, failedCount * 4);
                if (outSum > inSum * 1.5 && inSum > 0) score += 18;
                if (highRiskUsersCount > 0) score += Math.min(25, highRiskUsersCount * 5);
                if (policies.risk_global_freeze) score = 98;
                setRiskIndexScore(Math.min(100, Math.max(5, score)));
            }
        } catch (e) {
            console.error('Fetch live metrics error:', e);
        }
    };

    // 3. Fetch Transactions Queue and Compute Real-Time Fraud Scores
    const fetchTransactionsQueue = async () => {
        try {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (data) {
                const userIds = Array.from(new Set(data.map(t => t.user_id).filter(Boolean)));
                let profileMap: Record<string, UserProfile> = {};

                if (userIds.length > 0) {
                    const { data: userProfiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, username, email, phone, status, kyc_tier, balance, created_at')
                        .in('id', userIds);

                    if (userProfiles) {
                        userProfiles.forEach(u => {
                            profileMap[u.id] = u;
                        });
                    }
                }

                const enrichedTx: TransactionItem[] = data.map(tx => {
                    const amt = Number(tx.amount) || 0;
                    const u = profileMap[tx.user_id];
                    let fraudScore = 10;
                    const reasons: string[] = [];

                    // Evaluate Real Risk Factors
                    if (amt >= (policies.risk_auto_quarantine_above || 100000)) {
                        fraudScore += 45;
                        reasons.push(`High Value (≥ ₦${(policies.risk_auto_quarantine_above / 1000).toFixed(0)}k)`);
                    }
                    if (u && (Number(u.kyc_tier) || 1) < 2 && amt >= 50000) {
                        fraudScore += 30;
                        reasons.push('Unverified Tier 1 User Outflow');
                    }
                    if (tx.status === 'failed') {
                        fraudScore += 25;
                        reasons.push('Declined by Gateway Rail');
                    }
                    if (u && (u.status === 'suspended' || u.status === 'blocked')) {
                        fraudScore += 50;
                        reasons.push('Account Already Frozen / Watchlist');
                    }

                    const txHour = new Date(tx.created_at).getHours();
                    if (txHour >= 23 || txHour <= 5) {
                        fraudScore += 15;
                        reasons.push('Off-Hours Night Transaction (11PM - 5AM)');
                    }

                    return {
                        ...tx,
                        amount: amt,
                        fraudScore: Math.min(100, fraudScore),
                        riskReasons: reasons,
                        user: u,
                    };
                });

                setTransactions(enrichedTx);
                applyTxFilter(enrichedTx, txFilter, txSearch);
                setPendingFlagsCount(enrichedTx.filter(t => (t.fraudScore || 0) >= 50).length);
            }
        } catch (e) {
            console.error('Fetch tx queue error:', e);
        }
    };

    // 4. Fetch Blacklist from app_settings
    const fetchBlacklist = async () => {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'risk_global_blacklist')
                .maybeSingle();

            if (data && data.value) {
                let parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                if (Array.isArray(parsed)) {
                    setBlacklist(parsed);
                }
            }
        } catch (e) {
            console.error('Fetch blacklist error:', e);
        }
    };

    // Save Blacklist to Supabase
    const handleSaveBlacklist = async (updatedList: BlacklistItem[]) => {
        try {
            await supabase
                .from('app_settings')
                .upsert({
                    key: 'risk_global_blacklist',
                    value: JSON.stringify(updatedList),
                }, { onConflict: 'key' });
            setBlacklist(updatedList);
        } catch (e) {
            console.error('Save blacklist error:', e);
        }
    };

    const handleAddBlacklistEntry = async () => {
        if (!newBlacklistValue.trim()) {
            Alert.alert('Required', 'Please enter a target account number, phone, email, or IP address.');
            return;
        }

        const newEntry: BlacklistItem = {
            id: `bl_${Date.now()}`,
            type: newBlacklistType,
            value: newBlacklistValue.trim().toLowerCase(),
            reason: newBlacklistReason.trim() || 'Manual Manager Blacklist Flag',
            created_at: new Date().toISOString(),
        };

        const updated = [newEntry, ...blacklist];
        await handleSaveBlacklist(updated);
        setShowBlacklistModal(false);
        setNewBlacklistValue('');
        setNewBlacklistReason('');
        Alert.alert('Blacklist Updated ✅', `${newBlacklistType.toUpperCase()}: ${newEntry.value} has been blocked platform-wide.`);
    };

    const handleRemoveBlacklistEntry = async (id: string) => {
        Alert.alert('Remove Blacklist Rule', 'Are you sure you want to unblock this entry?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unblock',
                style: 'destructive',
                onPress: async () => {
                    const updated = blacklist.filter(b => b.id !== id);
                    await handleSaveBlacklist(updated);
                    Alert.alert('Unblocked', 'Entry removed from blacklist.');
                }
            }
        ]);
    };

    // 1-Click Toggle Channel Killswitch
    const handleToggleChannelKillswitch = async (key: keyof RiskPolicySettings, channelName: string) => {
        const currentVal = !!policies[key];
        const newVal = !currentVal;

        try {
            await supabase
                .from('app_settings')
                .upsert({
                    key: String(key),
                    value: newVal ? 'true' : 'false',
                }, { onConflict: 'key' });

            setPolicies(p => ({ ...p, [key]: newVal }));
            Alert.alert(
                newVal ? 'CHANNEL PAUSED ⛔' : 'CHANNEL RESUMED ✅',
                `${channelName} is now ${newVal ? 'temporarily disabled to protect platform float.' : 'active and processing normally.'}`
            );
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    // Filter Logic
    const applyTxFilter = (list: TransactionItem[], filter: string, search: string) => {
        let result = [...list];

        if (filter === 'high_risk') {
            result = result.filter(t => (t.fraudScore || 0) >= 50);
        } else if (filter === 'failed') {
            result = result.filter(t => t.status === 'failed');
        } else if (filter === 'high_value') {
            result = result.filter(t => Number(t.amount) >= (policies.risk_auto_quarantine_above || 50000));
        }

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            result = result.filter(t =>
                t.description?.toLowerCase().includes(q) ||
                t.reference?.toLowerCase().includes(q) ||
                t.user?.email?.toLowerCase().includes(q) ||
                t.user?.full_name?.toLowerCase().includes(q) ||
                String(t.amount).includes(q)
            );
        }

        setFilteredTx(result);
    };

    const handleFilterChange = (filter: 'all' | 'high_risk' | 'failed' | 'high_value') => {
        setTxFilter(filter);
        applyTxFilter(transactions, filter, txSearch);
    };

    const handleSearchChange = (text: string) => {
        setTxSearch(text);
        applyTxFilter(transactions, txFilter, text);
    };

    // Save Policies
    const handleSavePolicies = async () => {
        setSavingPolicies(true);
        try {
            const updatedPolicies: RiskPolicySettings = {
                risk_max_single_tx: Number(inputMaxSingle) || 250000,
                risk_daily_account_limit: Number(inputDailyLimit) || 1000000,
                risk_velocity_max_hourly_tx: Number(inputVelocity) || 6,
                risk_auto_quarantine_above: Number(inputQuarantine) || 100000,
                risk_vtu_velocity_cap: Number(inputVtuCap) || 25000,
                risk_crypto_single_max: Number(inputCryptoMax) || 500000,
                risk_nineboost_max_order: Number(inputNineBoostMax) || 50000,
                risk_agenthub_daily_quota: Number(inputAgentHubQuota) || 20,
                risk_require_kyc2_outflows: policies.risk_require_kyc2_outflows,
                risk_global_freeze: policies.risk_global_freeze,
                risk_offhours_alerts: policies.risk_offhours_alerts,
                risk_auto_lock_failed_auth: policies.risk_auto_lock_failed_auth,
                risk_payvessel_killswitch: policies.risk_payvessel_killswitch,
                risk_bigi_killswitch: policies.risk_bigi_killswitch,
                risk_bilal_killswitch: policies.risk_bilal_killswitch,
                risk_clubkonnect_killswitch: policies.risk_clubkonnect_killswitch,
                risk_agenthub_killswitch: policies.risk_agenthub_killswitch,
                risk_nineboost_killswitch: policies.risk_nineboost_killswitch,
                risk_crypto_killswitch: policies.risk_crypto_killswitch,
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
            Alert.alert('Deployed ✅', 'Real Risk Control Rules & Channel Limits successfully saved.');
        } catch (e: any) {
            Alert.alert('Save Error', e.message);
        } finally {
            setSavingPolicies(false);
        }
    };

    // 1-Click Action: Freeze/Unfreeze User
    const handleToggleUserFreeze = async (user: UserProfile) => {
        const isSuspended = user.status === 'suspended' || user.status === 'blocked';
        const targetStatus = isSuspended ? 'active' : 'suspended';

        Alert.alert(
            isSuspended ? 'Reactivate User' : 'Emergency Freeze User',
            `Set ${user.full_name || user.email}'s account to ${targetStatus.toUpperCase()}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isSuspended ? 'Reactivate' : 'Freeze Instantly',
                    style: isSuspended ? 'default' : 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await supabase
                                .from('profiles')
                                .update({ status: targetStatus })
                                .eq('id', user.id);

                            await supabase.from('notifications').insert({
                                user_id: user.id,
                                title: isSuspended ? 'Account Reactivated ✅' : 'Security Freeze Alert ❄️',
                                message: isSuspended
                                    ? 'Your account security review has cleared and full access is restored.'
                                    : 'Your account has been temporarily frozen by Compliance Risk Management for safety review.',
                                type: 'security',
                            });

                            if (selectedTx?.user?.id === user.id) {
                                setSelectedTx({ ...selectedTx, user: { ...selectedTx.user, status: targetStatus } });
                            }

                            Alert.alert('Status Updated', `User is now ${targetStatus}.`);
                            loadAllRiskData();
                        } catch (err: any) {
                            Alert.alert('Error', err.message);
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // 1-Click Action: Reverse & Refund Wallet
    const handleReverseTransaction = async (tx: TransactionItem) => {
        Alert.alert(
            'Reverse & Refund Transaction',
            `Refund ₦${Number(tx.amount).toLocaleString()} back to user wallet #${tx.user_id.slice(0, 8)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Execute Refund',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const { data: userProfile, error: pErr } = await supabase
                                .from('profiles')
                                .select('balance')
                                .eq('id', tx.user_id)
                                .single();

                            if (pErr) throw pErr;

                            const refundAmount = Number(tx.amount) || 0;
                            const newBalance = (Number(userProfile.balance) || 0) + refundAmount;

                            await supabase
                                .from('profiles')
                                .update({ balance: newBalance })
                                .eq('id', tx.user_id);

                            await supabase
                                .from('transactions')
                                .update({ status: 'reversed' })
                                .eq('id', tx.id);

                            await supabase.from('transactions').insert({
                                user_id: tx.user_id,
                                type: 'refund',
                                amount: refundAmount,
                                status: 'success',
                                description: `Risk Control Refund for Tx #${tx.reference || tx.id.slice(0, 8)}`,
                                reference: `REF-${Date.now().toString().slice(-6)}`,
                            });

                            await supabase.from('notifications').insert({
                                user_id: tx.user_id,
                                title: 'Wallet Refund Received 💰',
                                message: `₦${refundAmount.toLocaleString()} has been refunded to your wallet following compliance review.`,
                                type: 'credit',
                            });

                            setSelectedTx(null);
                            Alert.alert('Refund Complete ✅', `Successfully credited ₦${refundAmount.toLocaleString()} to user.`);
                            loadAllRiskData();
                        } catch (err: any) {
                            Alert.alert('Refund Error', err.message);
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // 1-Click Action: Run Stress Test Simulation
    const handleRunStressTest = () => {
        setSimulatingStress(true);
        setTimeout(() => {
            const projectedSurgeOutflow = totalFloatLiability * (stressTestFloatRun / 100);
            const remainingBuffer = Math.max(0, totalFloatLiability - projectedSurgeOutflow);
            const isCritical = stressTestFloatRun > 40;

            setStressResult({
                surgePercent: stressTestFloatRun,
                projectedOutflow: projectedSurgeOutflow,
                remainingFloat: remainingBuffer,
                liquidityHealth: isCritical ? 'DEFICIT_RISK' : 'OPTIMAL_COVERAGE',
                recommendation: isCritical 
                    ? 'Recommend deploying Payvessel auto-quarantine limits and capping single withdrawals to ₦100,000 across Bigi Sub, BilalSadaSub & NOWPayments.'
                    : 'System liquidity buffers adequately cover this outflow surge without gateway throttling.',
            });
            setSimulatingStress(false);
        }, 600);
    };

    // Export Compliance Report
    const handleExportAuditReport = async () => {
        const report = `=== ABUMAFHAL ROYAL FINTECH: RISK & COMPLIANCE REPORT ===
Timestamp: ${new Date().toISOString()}
System Float & Liability: ₦${totalFloatLiability.toLocaleString()}
Active User Profiles: ${totalUserCount}
Risk Index: ${riskIndexScore}/100
24h Outflow Volume: ₦${outflow24h.toLocaleString()}
24h Inflow Volume: ₦${inflow24h.toLocaleString()}
Failed Gateway Tx (24h): ${failedTx24h}
Active High-Risk Accounts: ${highRiskUsersCount}
Global Outflow Freeze: ${policies.risk_global_freeze ? 'ACTIVE' : 'INACTIVE'}
Active Blacklist Rules: ${blacklist.length}

Actual Integrated Platform Channels:
1. Payvessel: Reserved Virtual Accounts, Bank Rails & Virtual Dollar Cards
2. Bigi Sub: SME Data & Direct VTU Pipeline
3. Bilal Sada Sub: Data Bundles, Airtime & Telecom Routing
4. ClubKonnect: Utility Bills, Electricity & Cable TV
5. AgentHub: Real-Time NIN, BVN & CAC Government Verification Engine
6. NineBoost: Social Media Growth & SMM Order API
7. NOWPayments: Crypto Web3 Settlements & Automated Payouts
8. Termii: SMS OTP & Critical Infrastructure Alerts`;

        if (Platform.OS === 'web') {
            await Clipboard.setStringAsync(report);
            Alert.alert('Report Copied 📋', 'Full Risk & Compliance Audit report copied to clipboard.');
        } else {
            await Share.share({ message: report, title: 'ABUMAFHAL Risk Audit Report' });
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Risk Control & Compliance',
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTintColor: T.textMain,
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 }}>
                            <TouchableOpacity onPress={handleExportAuditReport} style={styles.headerIconBtn}>
                                <Ionicons name="share-outline" size={20} color={T.textMain} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={styles.headerIconBtn}>
                                <Ionicons name="refresh" size={20} color={T.textMain} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Global Freeze Banner */}
            {policies.risk_global_freeze && (
                <View style={styles.emergencyBanner}>
                    <Ionicons name="warning" size={20} color="#FFFFFF" />
                    <Text style={styles.emergencyBannerText}>
                        EMERGENCY OUTFLOW FREEZE ACTIVE — All Outgoing Transfers Blocked
                    </Text>
                </View>
            )}

            {/* Sub-Navigation Pill Bar */}
            <View style={styles.tabBarWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('overview')}
                        style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
                    >
                        <Ionicons name="pulse" size={16} color={activeTab === 'overview' ? '#FFFFFF' : T.textSub} />
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                            Overview
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('policies')}
                        style={[styles.tabItem, activeTab === 'policies' && styles.tabItemActive]}
                    >
                        <Ionicons name="shield-checkmark" size={16} color={activeTab === 'policies' ? '#FFFFFF' : T.textSub} />
                        <Text style={[styles.tabText, activeTab === 'policies' && styles.tabTextActive]}>
                            Policy Limits
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('queue')}
                        style={[styles.tabItem, activeTab === 'queue' && styles.tabItemActive]}
                    >
                        <Ionicons name="alert-circle" size={16} color={activeTab === 'queue' ? '#FFFFFF' : T.textSub} />
                        <Text style={[styles.tabText, activeTab === 'queue' && styles.tabTextActive]}>
                            Flagged Queue ({pendingFlagsCount})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('channels')}
                        style={[styles.tabItem, activeTab === 'channels' && styles.tabItemActive]}
                    >
                        <Ionicons name="git-network" size={16} color={activeTab === 'channels' ? '#FFFFFF' : T.textSub} />
                        <Text style={[styles.tabText, activeTab === 'channels' && styles.tabTextActive]}>
                            Rails & Gateways
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('blacklist')}
                        style={[styles.tabItem, activeTab === 'blacklist' && styles.tabItemActive]}
                    >
                        <Ionicons name="ban" size={16} color={activeTab === 'blacklist' ? '#FFFFFF' : T.textSub} />
                        <Text style={[styles.tabText, activeTab === 'blacklist' && styles.tabTextActive]}>
                            Blacklist ({blacklist.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('stress_test')}
                        style={[styles.tabItem, activeTab === 'stress_test' && styles.tabItemActive]}
                    >
                        <Ionicons name="speedometer" size={16} color={activeTab === 'stress_test' ? '#FFFFFF' : T.textSub} />
                        <Text style={[styles.tabText, activeTab === 'stress_test' && styles.tabTextActive]}>
                            Stress Test
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={T.navyDark} />
                    <Text style={styles.loadingText}>Connecting to Live Risk Telemetry...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navyDark} />}
                >
                    {/* ========================================================================= */}
                    {/* TAB 1: OVERVIEW & REAL-TIME EXPOSURE                                      */}
                    {/* ========================================================================= */}
                    {activeTab === 'overview' && (
                        <View>
                            {/* Premium Float & Risk Hero Card */}
                            <View style={styles.heroCard}>
                                <View style={styles.heroHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.heroSub}>REALTIME SYSTEM FLOAT LIABILITY</Text>
                                        <Text style={styles.heroTitle}>
                                            ₦ {totalFloatLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.riskBadge,
                                        riskIndexScore > 75 ? styles.riskBadgeCritical :
                                        riskIndexScore > 35 ? styles.riskBadgeWarn : styles.riskBadgeSafe
                                    ]}>
                                        <Text style={[
                                            styles.riskBadgeText,
                                            riskIndexScore > 75 ? styles.riskBadgeTextCritical :
                                            riskIndexScore > 35 ? styles.riskBadgeTextWarn : styles.riskBadgeTextSafe
                                        ]}>
                                            {riskIndexScore > 75 ? 'HIGH RISK' : riskIndexScore > 35 ? 'MODERATE' : 'OPTIMAL'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.gaugeContainer}>
                                    <View style={styles.gaugeTrack}>
                                        <View style={[
                                            styles.gaugeFill,
                                            {
                                                width: `${riskIndexScore}%`,
                                                backgroundColor: riskIndexScore > 75 ? T.danger : riskIndexScore > 35 ? T.warning : T.success
                                            }
                                        ]} />
                                    </View>
                                    <View style={styles.gaugeMeta}>
                                        <Text style={styles.gaugeMetaText}>Risk Score: {riskIndexScore}/100</Text>
                                        <Text style={styles.gaugeMetaText}>{totalUserCount} Active Wallets</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 24-Hour Velocity Grid */}
                            <View style={styles.metricGrid}>
                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <View style={[styles.metricIconWrap, { backgroundColor: T.successBg }]}>
                                            <Ionicons name="arrow-down-circle" size={18} color={T.success} />
                                        </View>
                                        <Text style={styles.metricLabel}>24h Inflow</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.success }]}>
                                        +₦{inflow24h > 0 ? (inflow24h / 1000).toFixed(1) : '0'}k
                                    </Text>
                                    <Text style={styles.metricSub}>Payvessel Deposits</Text>
                                </View>

                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <View style={[styles.metricIconWrap, { backgroundColor: T.dangerBg }]}>
                                            <Ionicons name="arrow-up-circle" size={18} color={T.danger} />
                                        </View>
                                        <Text style={styles.metricLabel}>24h Outflow</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.danger }]}>
                                        -₦{outflow24h > 0 ? (outflow24h / 1000).toFixed(1) : '0'}k
                                    </Text>
                                    <Text style={styles.metricSub}>Bigi / Bilal / Crypto</Text>
                                </View>

                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <View style={[styles.metricIconWrap, { backgroundColor: T.warningBg }]}>
                                            <Ionicons name="alert-circle" size={18} color={T.warning} />
                                        </View>
                                        <Text style={styles.metricLabel}>24h Failures</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.warning }]}>
                                        {failedTx24h} Tx
                                    </Text>
                                    <Text style={styles.metricSub}>Gateway Declines</Text>
                                </View>

                                <View style={styles.metricCard}>
                                    <View style={styles.metricCardHeader}>
                                        <View style={[styles.metricIconWrap, { backgroundColor: T.purpleBg }]}>
                                            <Ionicons name="shield" size={18} color={T.purple} />
                                        </View>
                                        <Text style={styles.metricLabel}>Watchlist</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: T.purple }]}>
                                        {highRiskUsersCount} Accounts
                                    </Text>
                                    <Text style={styles.metricSub}>Frozen / Flagged</Text>
                                </View>
                            </View>

                            {/* Emergency Rails Killswitch Matrix */}
                            <Text style={styles.sectionHeading}>Emergency Rails Killswitch Matrix</Text>
                            <View style={styles.killswitchGrid}>
                                {/* Global Freeze */}
                                <TouchableOpacity
                                    onPress={async () => {
                                        const newVal = !policies.risk_global_freeze;
                                        await supabase.from('app_settings').upsert({ key: 'risk_global_freeze', value: newVal ? 'true' : 'false' }, { onConflict: 'key' });
                                        setPolicies(p => ({ ...p, risk_global_freeze: newVal }));
                                        Alert.alert('System Lockdown', newVal ? 'ALL OUTFLOWS HALTED ❄️' : 'System Resumed ✅');
                                    }}
                                    style={[styles.killswitchCard, policies.risk_global_freeze ? styles.killswitchCardRedActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="snow" size={24} color={policies.risk_global_freeze ? "#FFFFFF" : T.danger} />
                                    <Text style={[styles.killswitchTitle, policies.risk_global_freeze && { color: '#FFFFFF' }]}>
                                        Global Freeze
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_global_freeze && { color: '#FEE2E2' }]}>
                                        {policies.risk_global_freeze ? 'LOCKED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Payvessel Cards */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_payvessel_killswitch', 'Payvessel Accounts & Cards')}
                                    style={[styles.killswitchCard, policies.risk_payvessel_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="card" size={24} color={policies.risk_payvessel_killswitch ? "#FFFFFF" : T.info} />
                                    <Text style={[styles.killswitchTitle, policies.risk_payvessel_killswitch && { color: '#FFFFFF' }]}>
                                        Payvessel Cards
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_payvessel_killswitch && { color: '#FEF3C7' }]}>
                                        {policies.risk_payvessel_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Bigi Sub */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_bigi_killswitch', 'Bigi Sub Data Engine')}
                                    style={[styles.killswitchCard, policies.risk_bigi_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="cellular" size={24} color={policies.risk_bigi_killswitch ? "#FFFFFF" : T.success} />
                                    <Text style={[styles.killswitchTitle, policies.risk_bigi_killswitch && { color: '#FFFFFF' }]}>
                                        Bigi Sub VTU
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_bigi_killswitch && { color: '#DCFCE7' }]}>
                                        {policies.risk_bigi_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Bilal Sada Sub */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_bilal_killswitch', 'Bilal Sada Sub Telecom')}
                                    style={[styles.killswitchCard, policies.risk_bilal_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="phone-portrait" size={24} color={policies.risk_bilal_killswitch ? "#FFFFFF" : T.gold} />
                                    <Text style={[styles.killswitchTitle, policies.risk_bilal_killswitch && { color: '#FFFFFF' }]}>
                                        Bilal Sada Sub
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_bilal_killswitch && { color: '#FEF3C7' }]}>
                                        {policies.risk_bilal_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* ClubKonnect */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_clubkonnect_killswitch', 'ClubKonnect Utility & Bills')}
                                    style={[styles.killswitchCard, policies.risk_clubkonnect_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="flash" size={24} color={policies.risk_clubkonnect_killswitch ? "#FFFFFF" : T.warning} />
                                    <Text style={[styles.killswitchTitle, policies.risk_clubkonnect_killswitch && { color: '#FFFFFF' }]}>
                                        ClubKonnect
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_clubkonnect_killswitch && { color: '#FEF3C7' }]}>
                                        {policies.risk_clubkonnect_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* AgentHub */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_agenthub_killswitch', 'AgentHub KYC (NIN/BVN)')}
                                    style={[styles.killswitchCard, policies.risk_agenthub_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="finger-print" size={24} color={policies.risk_agenthub_killswitch ? "#FFFFFF" : T.purple} />
                                    <Text style={[styles.killswitchTitle, policies.risk_agenthub_killswitch && { color: '#FFFFFF' }]}>
                                        AgentHub KYC
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_agenthub_killswitch && { color: '#F3E8FF' }]}>
                                        {policies.risk_agenthub_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* NineBoost */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_nineboost_killswitch', 'NineBoost SMM Orders')}
                                    style={[styles.killswitchCard, policies.risk_nineboost_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="trending-up" size={24} color={policies.risk_nineboost_killswitch ? "#FFFFFF" : '#DB2777'} />
                                    <Text style={[styles.killswitchTitle, policies.risk_nineboost_killswitch && { color: '#FFFFFF' }]}>
                                        NineBoost SMM
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_nineboost_killswitch && { color: '#FCE7F3' }]}>
                                        {policies.risk_nineboost_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>

                                {/* NOWPayments */}
                                <TouchableOpacity
                                    onPress={() => handleToggleChannelKillswitch('risk_crypto_killswitch', 'NOWPayments Crypto Outflows')}
                                    style={[styles.killswitchCard, policies.risk_crypto_killswitch ? styles.killswitchCardWarnActive : styles.killswitchCardNormal]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="logo-bitcoin" size={24} color={policies.risk_crypto_killswitch ? "#FFFFFF" : T.warning} />
                                    <Text style={[styles.killswitchTitle, policies.risk_crypto_killswitch && { color: '#FFFFFF' }]}>
                                        NOWPayments
                                    </Text>
                                    <Text style={[styles.killswitchSub, policies.risk_crypto_killswitch && { color: '#FEF3C7' }]}>
                                        {policies.risk_crypto_killswitch ? 'PAUSED' : 'Active'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: POLICIES & LIMITS                                                  */}
                    {/* ========================================================================= */}
                    {activeTab === 'policies' && (
                        <View>
                            <View style={styles.cardHeaderBox}>
                                <Ionicons name="shield-half" size={24} color={T.navyDark} />
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Text style={styles.cardHeaderTitle}>Universal Risk Limit Matrix</Text>
                                    <Text style={styles.cardHeaderSub}>Live limits applied across Payvessel, Bigi Sub, Bilal, AgentHub & NineBoost</Text>
                                </View>
                            </View>

                            <View style={styles.policyCard}>
                                <Text style={styles.inputLabel}>Maximum Single Debit Outflow (₦)</Text>
                                <Text style={styles.inputHelper}>Single debits above this limit are rejected instantly.</Text>
                                <TextInput
                                    value={inputMaxSingle}
                                    onChangeText={setInputMaxSingle}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>Daily Cumulative Outflow Cap (₦)</Text>
                                <Text style={styles.inputHelper}>Maximum cumulative outflow permitted per user in a 24-hour window.</Text>
                                <TextInput
                                    value={inputDailyLimit}
                                    onChangeText={setInputDailyLimit}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>Hourly Velocity Throttle (Max Tx/Hour)</Text>
                                <Text style={styles.inputHelper}>Throttles bots and high-frequency automated debit bursts.</Text>
                                <TextInput
                                    value={inputVelocity}
                                    onChangeText={setInputVelocity}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>Large Transfer Quarantine Threshold (₦)</Text>
                                <Text style={styles.inputHelper}>Transfers above this amount trigger an automated manager review flag.</Text>
                                <TextInput
                                    value={inputQuarantine}
                                    onChangeText={setInputQuarantine}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>Bigi Sub & BilalSadaSub VTU Rate Limit (₦ / 10 Mins)</Text>
                                <Text style={styles.inputHelper}>Prevents telecom balance drain attacks.</Text>
                                <TextInput
                                    value={inputVtuCap}
                                    onChangeText={setInputVtuCap}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>NineBoost SMM Single Order Cap (₦)</Text>
                                <Text style={styles.inputHelper}>Maximum single social boost order value.</Text>
                                <TextInput
                                    value={inputNineBoostMax}
                                    onChangeText={setInputNineBoostMax}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>AgentHub Daily Verification Quota / User</Text>
                                <Text style={styles.inputHelper}>Prevents automated identity scraping on NIN/BVN.</Text>
                                <TextInput
                                    value={inputAgentHubQuota}
                                    onChangeText={setInputAgentHubQuota}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />

                                <Text style={styles.inputLabel}>Single Crypto Withdrawal Cap (₦)</Text>
                                <Text style={styles.inputHelper}>Maximum allowed NOWPayments crypto payout per tx.</Text>
                                <TextInput
                                    value={inputCryptoMax}
                                    onChangeText={setInputCryptoMax}
                                    keyboardType="numeric"
                                    style={styles.numericInput}
                                    placeholderTextColor={T.textMuted}
                                />
                            </View>

                            <Text style={styles.sectionHeading}>Security Enforcement Toggles</Text>
                            <View style={styles.policyCard}>
                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        <Text style={styles.toggleTitle}>Strict KYC Tier 2 Requirement</Text>
                                        <Text style={styles.toggleSub}>Block bank payouts & crypto withdrawals for unverified users.</Text>
                                    </View>
                                    <Switch
                                        value={policies.risk_require_kyc2_outflows}
                                        onValueChange={(val) => setPolicies(p => ({ ...p, risk_require_kyc2_outflows: val }))}
                                        trackColor={{ false: '#CBD5E1', true: T.navyDark }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        <Text style={styles.toggleTitle}>Night-Time Priority Alerts (11PM - 5AM)</Text>
                                        <Text style={styles.toggleSub}>Flags large transfers during off-peak sleep hours.</Text>
                                    </View>
                                    <Switch
                                        value={policies.risk_offhours_alerts}
                                        onValueChange={(val) => setPolicies(p => ({ ...p, risk_offhours_alerts: val }))}
                                        trackColor={{ false: '#CBD5E1', true: T.navyDark }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        <Text style={styles.toggleTitle}>Auto-Lock on 5 Failed PINs</Text>
                                        <Text style={styles.toggleSub}>Instantly freezes wallet after brute-force PIN attempts.</Text>
                                    </View>
                                    <Switch
                                        value={policies.risk_auto_lock_failed_auth}
                                        onValueChange={(val) => setPolicies(p => ({ ...p, risk_auto_lock_failed_auth: val }))}
                                        trackColor={{ false: '#CBD5E1', true: T.navyDark }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleSavePolicies}
                                disabled={savingPolicies}
                                style={styles.savePoliciesBtn}
                                activeOpacity={0.85}
                            >
                                {savingPolicies ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                                        <Text style={styles.savePoliciesBtnText}>Save & Deploy Policies</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: FLAGGED QUEUE WITH FRAUD SCORES                                    */}
                    {/* ========================================================================= */}
                    {activeTab === 'queue' && (
                        <View>
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
                                    onPress={() => handleFilterChange('high_risk')}
                                    style={[styles.filterPill, txFilter === 'high_risk' && styles.filterPillActive]}
                                >
                                    <Text style={[styles.filterPillText, txFilter === 'high_risk' && styles.filterPillTextActive]}>
                                        High Risk (≥50%)
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleFilterChange('high_value')}
                                    style={[styles.filterPill, txFilter === 'high_value' && styles.filterPillActive]}
                                >
                                    <Text style={[styles.filterPillText, txFilter === 'high_value' && styles.filterPillTextActive]}>
                                        Large Amount
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
                            </View>

                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={18} color={T.textMuted} style={{ marginRight: 8 }} />
                                <TextInput
                                    value={txSearch}
                                    onChangeText={handleSearchChange}
                                    placeholder="Search by amount, ref, email, description..."
                                    placeholderTextColor={T.textMuted}
                                    style={styles.searchInput}
                                />
                            </View>

                            {filteredTx.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="shield-checkmark" size={52} color={T.success} />
                                    <Text style={styles.emptyStateTitle}>Queue is Clean</Text>
                                    <Text style={styles.emptyStateSub}>No transactions match the selected filter criteria.</Text>
                                </View>
                            ) : (
                                filteredTx.map(item => {
                                    const score = item.fraudScore || 10;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            onPress={() => setSelectedTx(item)}
                                            style={styles.txCard}
                                            activeOpacity={0.75}
                                        >
                                            <View style={styles.txCardLeft}>
                                                <View style={[
                                                    styles.fraudBadge,
                                                    score >= 70 ? styles.fraudBadgeCritical : score >= 40 ? styles.fraudBadgeWarn : styles.fraudBadgeSafe
                                                ]}>
                                                    <Text style={[
                                                        styles.fraudBadgeText,
                                                        score >= 70 ? { color: T.danger } : score >= 40 ? { color: T.warning } : { color: T.success }
                                                    ]}>
                                                        {score}%
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.txDescription} numberOfLines={1}>
                                                        {item.description || item.type?.toUpperCase()}
                                                    </Text>
                                                    <Text style={styles.txMeta}>
                                                        {item.user?.full_name || item.user?.email || item.user_id.slice(0, 8)} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.txAmount}>
                                                    ₦{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </Text>
                                                <View style={[
                                                    styles.statusPill,
                                                    item.status === 'success' ? styles.statusPillSuccess : styles.statusPillDanger
                                                ]}>
                                                    <Text style={[
                                                        styles.statusPillText,
                                                        item.status === 'success' ? styles.statusPillTextSuccess : styles.statusPillTextDanger
                                                    ]}>
                                                        {item.status.toUpperCase()}
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
                    {/* TAB 4: CHANNELS & PROVIDER INTEGRATIONS                                  */}
                    {/* ========================================================================= */}
                    {activeTab === 'channels' && (
                        <View>
                            <Text style={styles.sectionHeading}>Integrated Platform Rails & Gateway Health</Text>
                            {channels.map((ch) => {
                                const isPaused = !!policies[ch.killswitchKey];
                                return (
                                    <View key={ch.id} style={styles.channelCard}>
                                        <View style={styles.channelHeader}>
                                            <View style={[styles.channelIconBox, isPaused ? { backgroundColor: T.dangerBg } : { backgroundColor: T.infoBg }]}>
                                                <Ionicons name={ch.icon as any} size={22} color={isPaused ? T.danger : T.info} />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={styles.channelName}>{ch.name}</Text>
                                                <Text style={styles.channelProvider}>{ch.provider} • {ch.service}</Text>
                                            </View>
                                            <View style={[styles.channelStatusPill, isPaused && { backgroundColor: T.dangerBg }]}>
                                                <View style={[styles.statusDotGreen, isPaused && { backgroundColor: T.danger }]} />
                                                <Text style={[styles.channelStatusText, isPaused && { color: T.danger }]}>
                                                    {isPaused ? 'PAUSED' : 'OPERATIONAL'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.channelFooter}>
                                            <Text style={styles.channelMeta}>Latency: <Text style={{ fontWeight: '800', color: T.textMain }}>{ch.latencyMs}ms</Text></Text>
                                            <Text style={styles.channelMeta}>Uptime: <Text style={{ fontWeight: '800', color: T.textMain }}>{ch.lastPing}</Text></Text>
                                            <TouchableOpacity
                                                onPress={() => handleToggleChannelKillswitch(ch.killswitchKey, ch.name)}
                                                style={[styles.channelToggleBtn, isPaused ? { backgroundColor: T.success } : { backgroundColor: T.danger }]}
                                            >
                                                <Text style={styles.channelToggleBtnText}>
                                                    {isPaused ? 'Resume Rail' : 'Pause Rail'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 5: GLOBAL FRAUD BLACKLIST                                             */}
                    {/* ========================================================================= */}
                    {activeTab === 'blacklist' && (
                        <View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={styles.sectionHeading}>Active Blacklist Rules</Text>
                                <TouchableOpacity
                                    onPress={() => setShowBlacklistModal(true)}
                                    style={styles.addBlacklistBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="add" size={18} color="#FFFFFF" />
                                    <Text style={styles.addBlacklistBtnText}>Add Blacklist Entry</Text>
                                </TouchableOpacity>
                            </View>

                            {blacklist.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="shield-checkmark" size={52} color={T.success} />
                                    <Text style={styles.emptyStateTitle}>Zero Blacklisted Entities</Text>
                                    <Text style={styles.emptyStateSub}>No account numbers, emails, or phone numbers are blocked.</Text>
                                </View>
                            ) : (
                                blacklist.map(item => (
                                    <View key={item.id} style={styles.blacklistCard}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Text style={styles.blacklistTypeBadge}>{item.type.toUpperCase()}</Text>
                                                <Text style={styles.blacklistValue}>{item.value}</Text>
                                            </View>
                                            <Text style={styles.blacklistReason}>Reason: {item.reason}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveBlacklistEntry(item.id)}
                                            style={styles.deleteIconBtn}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={T.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 6: LIQUIDITY STRESS TEST SIMULATOR                                    */}
                    {/* ========================================================================= */}
                    {activeTab === 'stress_test' && (
                        <View>
                            <View style={styles.stressCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="speedometer" size={26} color={T.navyDark} />
                                    <Text style={styles.stressTitle}>Liquidity Surge Stress Simulator</Text>
                                </View>
                                <Text style={styles.stressSub}>
                                    Simulate what happens to platform float if a rapid surge in user withdrawals occurs simultaneously across Payvessel & NOWPayments.
                                </Text>

                                <Text style={styles.stressLabel}>Surge Outflow Shock (% of Total Float): {stressTestFloatRun}%</Text>
                                <View style={styles.stressButtonsRow}>
                                    {[10, 25, 50, 75].map(pct => (
                                        <TouchableOpacity
                                            key={pct}
                                            onPress={() => setStressTestFloatRun(pct)}
                                            style={[styles.stressPill, stressTestFloatRun === pct && styles.stressPillActive]}
                                        >
                                            <Text style={[styles.stressPillText, stressTestFloatRun === pct && styles.stressPillTextActive]}>
                                                {pct}% Surge
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    onPress={handleRunStressTest}
                                    disabled={simulatingStress}
                                    style={styles.runStressBtn}
                                    activeOpacity={0.85}
                                >
                                    {simulatingStress ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="flash" size={18} color="#FFFFFF" />
                                            <Text style={styles.runStressBtnText}>Simulate Liquidity Shock</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {stressResult && (
                                    <View style={styles.stressResultBox}>
                                        <Text style={styles.stressResultTitle}>Simulation Analysis</Text>
                                        <View style={styles.stressResultRow}>
                                            <Text style={styles.stressResultLabel}>Projected Outflow Shock:</Text>
                                            <Text style={[styles.stressResultVal, { color: T.danger }]}>
                                                -₦{Number(stressResult.projectedOutflow).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </Text>
                                        </View>
                                        <View style={styles.stressResultRow}>
                                            <Text style={styles.stressResultLabel}>Remaining Float Buffer:</Text>
                                            <Text style={[styles.stressResultVal, { color: T.success }]}>
                                                ₦{Number(stressResult.remainingFloat).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </Text>
                                        </View>
                                        <Text style={styles.stressRecommendation}>{stressResult.recommendation}</Text>
                                    </View>
                                )}
                            </View>
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
                                <Ionicons name="close-circle" size={26} color={T.textMuted} />
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

                                {selectedTx.riskReasons && selectedTx.riskReasons.length > 0 && (
                                    <View style={styles.riskReasonBox}>
                                        <Text style={styles.riskReasonTitle}>DETECTED RISK SIGNALS</Text>
                                        {selectedTx.riskReasons.map((r, i) => (
                                            <Text key={i} style={styles.riskReasonItem}>• {r}</Text>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>User Name</Text>
                                    <Text style={styles.infoValue}>{selectedTx.user?.full_name || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>User Email</Text>
                                    <Text style={styles.infoValue}>{selectedTx.user?.email || selectedTx.user_id}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>KYC Verification</Text>
                                    <Text style={styles.infoValue}>Tier {selectedTx.user?.kyc_tier || 1}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Status</Text>
                                    <Text style={[styles.infoValue, { color: selectedTx.status === 'success' ? T.success : T.danger }]}>
                                        {selectedTx.status.toUpperCase()}
                                    </Text>
                                </View>

                                <View style={styles.modalBtnContainer}>
                                    <TouchableOpacity
                                        onPress={() => handleReverseTransaction(selectedTx)}
                                        disabled={actionLoading}
                                        style={styles.btnRefund}
                                    >
                                        <Ionicons name="arrow-undo" size={20} color="#FFFFFF" />
                                        <Text style={styles.btnRefundText}>Reverse & Refund Wallet</Text>
                                    </TouchableOpacity>

                                    {selectedTx.user && (
                                        <TouchableOpacity
                                            onPress={() => handleToggleUserFreeze(selectedTx.user!)}
                                            disabled={actionLoading}
                                            style={styles.btnFreeze}
                                        >
                                            <Ionicons name="snow" size={20} color="#FFFFFF" />
                                            <Text style={styles.btnFreezeText}>
                                                {selectedTx.user.status === 'suspended' ? 'Reactivate User' : 'Freeze User Account'}
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
            {/* MODAL 2: ADD TO BLACKLIST SHEET                                           */}
            {/* ========================================================================= */}
            <Modal
                visible={showBlacklistModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowBlacklistModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Entity to Blacklist</Text>
                            <TouchableOpacity onPress={() => setShowBlacklistModal(false)}>
                                <Ionicons name="close-circle" size={26} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Target Entity Type</Text>
                        <View style={styles.blacklistTypeRow}>
                            {(['account_number', 'phone', 'email', 'bvn', 'nin', 'ip'] as const).map(t => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setNewBlacklistType(t)}
                                    style={[styles.typePill, newBlacklistType === t && styles.typePillActive]}
                                >
                                    <Text style={[styles.typePillText, newBlacklistType === t && styles.typePillTextActive]}>
                                        {t.replace('_', ' ').toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Value to Block</Text>
                        <TextInput
                            value={newBlacklistValue}
                            onChangeText={setNewBlacklistValue}
                            placeholder="e.g. 0123456789 or user@example.com"
                            placeholderTextColor={T.textMuted}
                            style={styles.numericInput}
                        />

                        <Text style={styles.inputLabel}>Reason / Audit Note</Text>
                        <TextInput
                            value={newBlacklistReason}
                            onChangeText={setNewBlacklistReason}
                            placeholder="e.g. Fraud chargeback risk or unauthorized account"
                            placeholderTextColor={T.textMuted}
                            style={styles.numericInput}
                        />

                        <TouchableOpacity
                            onPress={handleAddBlacklistEntry}
                            style={styles.savePoliciesBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="ban" size={20} color="#FFFFFF" />
                            <Text style={styles.savePoliciesBtnText}>Block Platform-Wide</Text>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: T.bg,
    },
    loadingText: {
        marginTop: 14,
        fontSize: 14,
        fontWeight: '700',
        color: T.textSub,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emergencyBanner: {
        backgroundColor: T.danger,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 8,
    },
    emergencyBannerText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 12.5,
        letterSpacing: 0.3,
    },
    tabBarWrapper: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: T.cardBorder,
        paddingVertical: 8,
    },
    tabBarScroll: {
        paddingHorizontal: 12,
        gap: 8,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    tabItemActive: {
        backgroundColor: T.navyDark,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.textSub,
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    heroCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    heroSub: {
        fontSize: 11,
        fontWeight: '800',
        color: T.gold,
        letterSpacing: 1,
        marginBottom: 4,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: T.textMain,
    },
    riskBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    riskBadgeSafe: {
        backgroundColor: T.successBg,
    },
    riskBadgeWarn: {
        backgroundColor: T.warningBg,
    },
    riskBadgeCritical: {
        backgroundColor: T.dangerBg,
    },
    riskBadgeText: {
        fontSize: 11,
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
        marginTop: 6,
    },
    gaugeTrack: {
        height: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    gaugeFill: {
        height: '100%',
        borderRadius: 4,
    },
    gaugeMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    gaugeMetaText: {
        color: T.textMuted,
        fontSize: 12,
        fontWeight: '700',
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    metricCard: {
        flex: 1,
        minWidth: '47%',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    metricCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    metricIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textSub,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 2,
    },
    metricSub: {
        fontSize: 11,
        color: T.textMuted,
        fontWeight: '600',
    },
    sectionHeading: {
        fontSize: 15,
        fontWeight: '900',
        color: T.textMain,
        marginTop: 6,
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    killswitchGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    killswitchCard: {
        flex: 1,
        minWidth: '47%',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    killswitchCardNormal: {
        backgroundColor: '#FFFFFF',
        borderColor: T.cardBorder,
    },
    killswitchCardRedActive: {
        backgroundColor: T.danger,
        borderColor: T.danger,
    },
    killswitchCardWarnActive: {
        backgroundColor: T.warning,
        borderColor: T.warning,
    },
    killswitchTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: T.textMain,
        marginTop: 6,
    },
    killswitchSub: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textMuted,
        marginTop: 2,
    },
    cardHeaderBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    cardHeaderTitle: {
        color: T.textMain,
        fontSize: 15,
        fontWeight: '900',
    },
    cardHeaderSub: {
        color: T.textSub,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    policyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 18,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: T.textMain,
        marginTop: 10,
        marginBottom: 4,
    },
    inputHelper: {
        fontSize: 11.5,
        color: T.textMuted,
        marginBottom: 8,
    },
    numericInput: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        fontWeight: '800',
        color: T.textMain,
        marginBottom: 14,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    toggleTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: T.textMain,
        marginBottom: 2,
    },
    toggleSub: {
        fontSize: 11.5,
        color: T.textSub,
    },
    savePoliciesBtn: {
        backgroundColor: T.navyDark,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        marginBottom: 20,
    },
    savePoliciesBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 14,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    filterPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
    },
    filterPillActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    filterPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.textSub,
    },
    filterPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 14,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: T.textMain,
        fontWeight: '600',
    },
    emptyState: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginTop: 10,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: T.textMain,
        marginTop: 12,
        marginBottom: 4,
    },
    emptyStateSub: {
        fontSize: 12,
        color: T.textMuted,
        textAlign: 'center',
    },
    txCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    txCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        marginRight: 10,
    },
    fraudBadge: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fraudBadgeSafe: {
        backgroundColor: T.successBg,
    },
    fraudBadgeWarn: {
        backgroundColor: T.warningBg,
    },
    fraudBadgeCritical: {
        backgroundColor: T.dangerBg,
    },
    fraudBadgeText: {
        fontSize: 12,
        fontWeight: '900',
    },
    txDescription: {
        fontSize: 13,
        fontWeight: '800',
        color: T.textMain,
    },
    txMeta: {
        fontSize: 11,
        color: T.textMuted,
        marginTop: 3,
    },
    txAmount: {
        fontSize: 14,
        fontWeight: '900',
        color: T.textMain,
        marginBottom: 3,
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statusPillSuccess: {
        backgroundColor: T.successBg,
    },
    statusPillDanger: {
        backgroundColor: T.dangerBg,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '900',
    },
    statusPillTextSuccess: {
        color: T.success,
    },
    statusPillTextDanger: {
        color: T.danger,
    },
    channelCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 12,
    },
    channelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    channelIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelName: {
        fontSize: 14,
        fontWeight: '900',
        color: T.textMain,
    },
    channelProvider: {
        fontSize: 11.5,
        color: T.textSub,
        marginTop: 2,
    },
    channelStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: T.successBg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusDotGreen: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.success,
    },
    channelStatusText: {
        fontSize: 10.5,
        fontWeight: '900',
        color: T.success,
    },
    channelFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 10,
    },
    channelMeta: {
        fontSize: 11.5,
        color: T.textSub,
    },
    channelToggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    channelToggleBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    addBlacklistBtn: {
        backgroundColor: T.navyDark,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    addBlacklistBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    blacklistCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    blacklistTypeBadge: {
        backgroundColor: T.dangerBg,
        color: T.danger,
        fontSize: 10,
        fontWeight: '900',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    blacklistValue: {
        color: T.textMain,
        fontSize: 13,
        fontWeight: '800',
    },
    blacklistReason: {
        color: T.textSub,
        fontSize: 11.5,
        marginTop: 2,
    },
    deleteIconBtn: {
        padding: 8,
    },
    stressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    stressTitle: {
        color: T.textMain,
        fontSize: 15.5,
        fontWeight: '900',
        marginLeft: 10,
    },
    stressSub: {
        color: T.textSub,
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 14,
    },
    stressLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: T.navyDark,
        marginBottom: 10,
    },
    stressButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    stressPill: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: T.border,
    },
    stressPillActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    stressPillText: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textSub,
    },
    stressPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    runStressBtn: {
        backgroundColor: T.navyDark,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    runStressBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13.5,
    },
    stressResultBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        marginTop: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    stressResultTitle: {
        color: T.navyDark,
        fontSize: 13,
        fontWeight: '900',
        marginBottom: 8,
    },
    stressResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    stressResultLabel: {
        fontSize: 12,
        color: T.textSub,
    },
    stressResultVal: {
        fontSize: 12,
        fontWeight: '900',
    },
    stressRecommendation: {
        color: T.textSub,
        fontSize: 11.5,
        marginTop: 8,
        lineHeight: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 22,
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
        backgroundColor: '#F8FAFC',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    modalAmountLabel: {
        color: T.gold,
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    modalAmountValue: {
        color: T.textMain,
        fontSize: 26,
        fontWeight: '900',
        marginBottom: 4,
    },
    modalRefText: {
        color: T.textMuted,
        fontSize: 11.5,
        fontWeight: '600',
    },
    riskReasonBox: {
        backgroundColor: T.dangerBg,
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: T.dangerBorder,
    },
    riskReasonTitle: {
        color: T.danger,
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    riskReasonItem: {
        color: T.danger,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        fontSize: 12.5,
        color: T.textSub,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 12.5,
        fontWeight: '800',
        color: T.textMain,
    },
    modalBtnContainer: {
        marginTop: 20,
        gap: 10,
        paddingBottom: 20,
    },
    btnRefund: {
        backgroundColor: T.navyDark,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    btnRefundText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13.5,
    },
    btnFreeze: {
        backgroundColor: T.danger,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    btnFreezeText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13.5,
    },
    blacklistTypeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    typePill: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: T.border,
    },
    typePillActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    typePillText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textSub,
    },
    typePillTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
});
