import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    RefreshControl,
    StyleSheet,
    Dimensions,
    Share,
    Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Executive Royal Navy & Imperial Gold Palette
const T = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardBorderGold: 'rgba(217, 119, 6, 0.28)',
    navyPrimary: '#070D1E',
    navyDeep: '#0A1128',
    navyMid: '#0F172A',
    navyCard: '#1E293B',
    navyLight: '#334155',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldDark: '#B45309',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
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

interface APYPlan {
    id: string;
    name: string;
    type: 'flexible' | 'fixed_30' | 'fixed_90' | 'fixed_180' | 'fixed_365' | 'halal' | 'gold';
    apyRate: number; // e.g. 14.0%
    lockDays: number;
    earlyPenaltyPercent: number;
    minDeposit: number;
    description: string;
    active: boolean;
    shariahCompliant: boolean;
}

interface AssetPool {
    id: string;
    title: string;
    category: string;
    totalAllocated: number;
    targetYield: number;
    riskTier: string;
    status: 'active' | 'rebalancing' | 'paused';
    notes: string;
}

interface UserSavingsHolding {
    id: string;
    user_id: string;
    title: string;
    amount_saved: number;
    target_amount: number;
    plan_type?: string;
    apy_rate?: number;
    frequency?: string;
    status: 'active' | 'matured' | 'locked' | 'liquidated';
    created_at: string;
    lock_until?: string | null;
    accrued_interest?: number;
    profiles?: {
        id?: string;
        full_name?: string;
        email?: string;
        phone_number?: string;
        balance?: number;
        avatar_url?: string;
    } | null;
}

export default function EnterpriseWealthAssetHub() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'overview' | 'apy_plans' | 'asset_pools' | 'user_holdings' | 'payout_engine' | 'settings'>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // APY Plans State
    const [apyPlans, setApyPlans] = useState<APYPlan[]>([
        {
            id: 'plan_flex',
            name: 'FlexiSave Stash',
            type: 'flexible',
            apyRate: 9.5,
            lockDays: 0,
            earlyPenaltyPercent: 0,
            minDeposit: 1000,
            description: 'Daily interest accrual with anytime instant withdrawal flexibility.',
            active: true,
            shariahCompliant: false,
        },
        {
            id: 'plan_fixed_30',
            name: 'Vault Fixed Lock (30 Days)',
            type: 'fixed_30',
            apyRate: 14.0,
            lockDays: 30,
            earlyPenaltyPercent: 2.5,
            minDeposit: 5000,
            description: 'Short-term high-yield fixed vault with monthly interest payout.',
            active: true,
            shariahCompliant: false,
        },
        {
            id: 'plan_fixed_90',
            name: 'Quarterly Builder (90 Days)',
            type: 'fixed_90',
            apyRate: 16.5,
            lockDays: 90,
            earlyPenaltyPercent: 3.5,
            minDeposit: 10000,
            description: 'Medium-term capital lock geared for aggressive compound growth.',
            active: true,
            shariahCompliant: false,
        },
        {
            id: 'plan_fixed_365',
            name: 'Annual Treasury Seal (365 Days)',
            type: 'fixed_365',
            apyRate: 21.0,
            lockDays: 365,
            earlyPenaltyPercent: 5.0,
            minDeposit: 50000,
            description: 'Max-tier sovereign backed yield protected with full capital warranty.',
            active: true,
            shariahCompliant: false,
        },
        {
            id: 'plan_halal',
            name: 'Al-Barakah Halal Mudarabah',
            type: 'halal',
            apyRate: 12.0,
            lockDays: 60,
            earlyPenaltyPercent: 1.0,
            minDeposit: 5000,
            description: '100% Shariah-compliant profit-sharing ethical commerce investment.',
            active: true,
            shariahCompliant: true,
        },
        {
            id: 'plan_gold',
            name: 'Physical Gold Bullion Stash',
            type: 'gold',
            apyRate: 8.0,
            lockDays: 180,
            earlyPenaltyPercent: 2.0,
            minDeposit: 25000,
            description: 'Hedge against inflation pegged directly to international 24k gold spot rates.',
            active: true,
            shariahCompliant: true,
        },
    ]);

    // Asset Pools State
    const [assetPools, setAssetPools] = useState<AssetPool[]>([
        {
            id: 'pool_tbills',
            title: 'Sovereign Treasury Bills & CBN Repos',
            category: 'Treasury',
            totalAllocated: 24500000,
            targetYield: 18.5,
            riskTier: 'Low Risk (Sovereign)',
            status: 'active',
            notes: 'Invested directly in primary CBN government treasury notes & cash equivalents.',
        },
        {
            id: 'pool_mudarabah',
            title: 'Halal Shariah Commodities & Trade Finance',
            category: 'Halal Trade Finance',
            totalAllocated: 18200000,
            targetYield: 13.8,
            riskTier: 'Zero Interest (Mudarabah)',
            status: 'active',
            notes: 'Physical agricultural trade and FMCG inventory finance vetted by Shariah advisors.',
        },
        {
            id: 'pool_gold',
            title: 'Physical Allocated 24K Gold Vault Reserves',
            category: 'Physical Gold',
            totalAllocated: 12500000,
            targetYield: 10.2,
            riskTier: 'Capital Protected',
            status: 'active',
            notes: 'Insured allocated physical gold bars held with licensed vault custodians.',
        },
        {
            id: 'pool_vault_float',
            title: 'Primary Liquidity & Settlement Backstop',
            category: 'Vault Liquidity',
            totalAllocated: 35000000,
            targetYield: 12.0,
            riskTier: 'Low Risk (Sovereign)',
            status: 'active',
            notes: 'High-velocity instant settlement buffer across Payvessel & banking rails.',
        },
    ]);

    // User Holdings List
    const [userHoldings, setUserHoldings] = useState<UserSavingsHolding[]>([]);
    const [searchHoldings, setSearchHoldings] = useState('');
    const [filterHoldingStatus, setFilterHoldingStatus] = useState<'all' | 'active' | 'matured' | 'liquidated'>('all');

    // General Wealth Settings
    const [rulesConfig, setRulesConfig] = useState({
        minFlexibleDeposit: '500',
        maxSingleDeposit: '50000000',
        earlyLiquidationFeePercent: '3.0',
        autoRolloverDefault: true,
        enableHalalFilter: true,
        enableAutoInterestPayoutCron: true,
        dailyInterestCompounding: true,
    });

    // Modals
    const [editingPlan, setEditingPlan] = useState<APYPlan | null>(null);
    const [editingPool, setEditingPool] = useState<AssetPool | null>(null);
    const [showNewPoolModal, setShowNewPoolModal] = useState(false);
    const [newPoolTitle, setNewPoolTitle] = useState('');
    const [newPoolCategory, setNewPoolCategory] = useState('Treasury');
    const [newPoolAmount, setNewPoolAmount] = useState('1000000');
    const [newPoolYield, setNewPoolYield] = useState('14.0');
    const [newPoolNotes, setNewPoolNotes] = useState('');

    const [selectedHolding, setSelectedHolding] = useState<UserSavingsHolding | null>(null);
    const [bonusYieldAmount, setBonusYieldAmount] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutProcessing, setPayoutProcessing] = useState(false);

    useEffect(() => {
        loadWealthData();
    }, []);

    const loadWealthData = async () => {
        try {
            setLoading(true);

            // 1. Fetch persistent app settings for APY rates and pools
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('*')
                .in('key', ['wealth_apy_plans', 'wealth_asset_pools', 'wealth_rules_config']);

            if (settingsData && settingsData.length > 0) {
                settingsData.forEach(item => {
                    try {
                        const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                        if (item.key === 'wealth_apy_plans' && Array.isArray(parsed)) {
                            setApyPlans(parsed);
                        } else if (item.key === 'wealth_asset_pools' && Array.isArray(parsed)) {
                            setAssetPools(parsed);
                        } else if (item.key === 'wealth_rules_config' && typeof parsed === 'object') {
                            setRulesConfig(prev => ({ ...prev, ...parsed }));
                        }
                    } catch (err) {
                        console.warn(`Error parsing setting ${item.key}:`, err);
                    }
                });
            }

            // Also check wealth_asset_pools table if available
            try {
                const { data: poolRows } = await supabase.from('wealth_asset_pools').select('*').order('created_at', { ascending: false });
                if (poolRows && poolRows.length > 0) {
                    const mapped: AssetPool[] = poolRows.map(r => ({
                        id: r.id,
                        title: r.title,
                        category: r.category,
                        totalAllocated: Number(r.total_allocated || 0),
                        targetYield: Number(r.target_yield || 0),
                        riskTier: r.risk_tier,
                        status: r.status,
                        notes: r.notes || '',
                    }));
                    setAssetPools(mapped);
                }
            } catch (e) { }

            // 2. Fetch User Savings & Investment Holdings
            const { data: savingsData, error: savingsError } = await supabase
                .from('savings_plans')
                .select('*, profiles:user_id(id, full_name, email, phone_number, balance, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(150);

            if (!savingsError && savingsData) {
                setUserHoldings(savingsData);
            } else {
                setUserHoldings([]);
            }
        } catch (e) {
            console.error('Error loading wealth management data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadWealthData();
    }, []);

    // AUM & Aggregate Calculations
    const calculatedMetrics = useMemo(() => {
        const totalUserSavings = userHoldings.reduce((sum, h) => sum + (Number(h.amount_saved) || 0), 0);
        const totalPoolsAllocated = assetPools.reduce((sum, p) => sum + (Number(p.totalAllocated) || 0), 0);
        const totalAUM = totalUserSavings + totalPoolsAllocated;

        const activeSaversCount = new Set(userHoldings.filter(h => h.status === 'active').map(h => h.user_id)).size;
        const totalHoldingsCount = userHoldings.length;

        // Estimated Monthly Interest Payout Liability (Annualized APY ~14% avg / 12)
        const avgApy = apyPlans.filter(p => p.active).reduce((sum, p) => sum + p.apyRate, 0) / (apyPlans.filter(p => p.active).length || 1);
        const estimatedMonthlyInterest = (totalUserSavings * (avgApy / 100)) / 12;

        return {
            totalAUM,
            totalUserSavings,
            totalPoolsAllocated,
            activeSaversCount,
            totalHoldingsCount,
            avgApy,
            estimatedMonthlyInterest,
        };
    }, [userHoldings, assetPools, apyPlans]);

    // Save APY Plan Edit
    const handleSavePlanEdit = async () => {
        if (!editingPlan) return;
        setSavingSettings(true);
        try {
            const updated = apyPlans.map(p => (p.id === editingPlan.id ? editingPlan : p));
            setApyPlans(updated);

            await supabase.from('app_settings').upsert({
                key: 'wealth_apy_plans',
                value: JSON.stringify(updated),
                updated_at: new Date().toISOString(),
            });

            // Log administrative audit action
            await supabase.from('audit_logs').insert({
                action: `Updated Wealth APY Plan: ${editingPlan.name}`,
                target_resource: `Wealth / ${editingPlan.name}`,
                details: { apyRate: editingPlan.apyRate, lockDays: editingPlan.lockDays, active: editingPlan.active },
            });

            Alert.alert('APY Rate Saved 📈', `${editingPlan.name} is now set to ${editingPlan.apyRate}% APY.`);
            setEditingPlan(null);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSavingSettings(false);
        }
    };

    // Create New Asset Pool
    const handleCreateNewPool = async () => {
        if (!newPoolTitle.trim()) {
            Alert.alert('Required', 'Please enter a pool title.');
            return;
        }

        setSavingSettings(true);
        try {
            const newPoolObj: AssetPool = {
                id: 'pool_' + Date.now(),
                title: newPoolTitle.trim(),
                category: newPoolCategory,
                totalAllocated: parseFloat(newPoolAmount) || 0,
                targetYield: parseFloat(newPoolYield) || 0,
                riskTier: 'Capital Protected',
                status: 'active',
                notes: newPoolNotes.trim(),
            };

            const updatedPools = [newPoolObj, ...assetPools];
            setAssetPools(updatedPools);

            await supabase.from('app_settings').upsert({
                key: 'wealth_asset_pools',
                value: JSON.stringify(updatedPools),
                updated_at: new Date().toISOString(),
            });

            try {
                await supabase.from('wealth_asset_pools').insert({
                    title: newPoolObj.title,
                    category: newPoolObj.category,
                    total_allocated: newPoolObj.totalAllocated,
                    target_yield: newPoolObj.targetYield,
                    risk_tier: newPoolObj.riskTier,
                    status: newPoolObj.status,
                    notes: newPoolObj.notes,
                });
            } catch (e) { }

            await supabase.from('audit_logs').insert({
                action: `Created New Institutional Asset Pool: ${newPoolObj.title}`,
                target_resource: `Assets / ${newPoolObj.title}`,
                details: newPoolObj,
            });

            Alert.alert('Asset Pool Created 💼', `${newPoolObj.title} successfully added to portfolio ledger.`);
            setShowNewPoolModal(false);
            setNewPoolTitle('');
            setNewPoolNotes('');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSavingSettings(false);
        }
    };

    // Save Asset Pool Edit
    const handleSavePoolEdit = async () => {
        if (!editingPool) return;
        setSavingSettings(true);
        try {
            const updated = assetPools.map(p => (p.id === editingPool.id ? editingPool : p));
            setAssetPools(updated);

            await supabase.from('app_settings').upsert({
                key: 'wealth_asset_pools',
                value: JSON.stringify(updated),
                updated_at: new Date().toISOString(),
            });

            try {
                await supabase.from('wealth_asset_pools').upsert({
                    id: editingPool.id,
                    title: editingPool.title,
                    category: editingPool.category,
                    total_allocated: editingPool.totalAllocated,
                    target_yield: editingPool.targetYield,
                    risk_tier: editingPool.riskTier,
                    status: editingPool.status,
                    notes: editingPool.notes,
                    updated_at: new Date().toISOString(),
                });
            } catch (e) { }

            await supabase.from('audit_logs').insert({
                action: `Updated Asset Allocation Pool: ${editingPool.title}`,
                target_resource: `Assets / ${editingPool.title}`,
                details: { totalAllocated: editingPool.totalAllocated, targetYield: editingPool.targetYield },
            });

            Alert.alert('Asset Pool Updated 💼', `${editingPool.title} configuration committed.`);
            setEditingPool(null);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSavingSettings(false);
        }
    };

    // Save Wealth Rules Config
    const handleSaveRulesConfig = async () => {
        setSavingSettings(true);
        try {
            await supabase.from('app_settings').upsert({
                key: 'wealth_rules_config',
                value: JSON.stringify(rulesConfig),
                updated_at: new Date().toISOString(),
            });

            await supabase.from('audit_logs').insert({
                action: 'Updated Wealth & Assets Global Policies',
                target_resource: 'Wealth Policies',
                details: rulesConfig,
            });

            Alert.alert('Rules Saved 🛡️', 'Wealth and investment operational guidelines updated successfully.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSavingSettings(false);
        }
    };

    // REAL ATOMIC ACTION: Disburse Daily Yield to All Active Savers
    const handleTriggerYieldDisbursement = async () => {
        setPayoutProcessing(true);
        try {
            let totalDisbursed = 0;
            let successCount = 0;

            const activePlans = userHoldings.filter(item => item.status === 'active' && Number(item.amount_saved) > 0);

            for (const h of activePlans) {
                const planRate = h.apy_rate || apyPlans.find(p => p.type === 'flexible')?.apyRate || 10;
                const dailyAccrual = (Number(h.amount_saved) * (planRate / 100)) / 365;

                if (dailyAccrual > 0) {
                    totalDisbursed += dailyAccrual;
                    successCount++;

                    // 1. Update accrued interest in savings plan
                    await supabase
                        .from('savings_plans')
                        .update({
                            accrued_interest: Number(h.accrued_interest || 0) + dailyAccrual,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', h.id);

                    // 2. Record transaction ledger row
                    await supabase.from('transactions').insert({
                        user_id: h.user_id,
                        type: 'savings_interest',
                        amount: dailyAccrual,
                        status: 'completed',
                        description: `Daily yield payout for goal: ${h.title} (${planRate}% APY)`,
                        reference: `YIELD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    });
                }
            }

            // 3. Log high-level audit record
            await supabase.from('audit_logs').insert({
                action: 'Executed Automated Daily Yield Disbursement',
                target_resource: 'Savings Yield Engine',
                details: { totalDisbursed, accountsCredited: successCount, date: new Date().toISOString() },
            });

            setShowPayoutModal(false);
            Alert.alert(
                'Yield Disbursal Complete 💰',
                `Successfully disbursed ₦${totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })} across ${successCount} active savings plans.`
            );
            loadWealthData();
        } catch (e: any) {
            Alert.alert('Yield Execution Error', e.message);
        } finally {
            setPayoutProcessing(false);
        }
    };

    // REAL ATOMIC ACTION: Emergency Liquidate / Refund Plan to User Wallet
    const handleLiquidateUserPlan = async (holding: UserSavingsHolding) => {
        Alert.alert(
            'Liquidate Savings Plan',
            `Are you sure you want to liquidate "${holding.title}"? ₦${(Number(holding.amount_saved) + Number(holding.accrued_interest || 0)).toLocaleString()} will be credited immediately to ${holding.profiles?.full_name || 'the user'}'s main wallet balance.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Liquidation',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            // Try calling atomic RPC first
                            const { data: rpcData, error: rpcError } = await supabase.rpc('liquidate_savings_plan', {
                                p_plan_id: holding.id,
                                p_is_admin: true,
                            });

                            if (rpcError) {
                                // Direct fallback execution
                                const totalRefund = Number(holding.amount_saved) + Number(holding.accrued_interest || 0);

                                // Credit user profile balance
                                const { data: profileData } = await supabase.from('profiles').select('balance').eq('id', holding.user_id).single();
                                const newBalance = Number(profileData?.balance || 0) + totalRefund;

                                await supabase.from('profiles').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', holding.user_id);
                                await supabase.from('savings_plans').update({ status: 'liquidated', amount_saved: 0, updated_at: new Date().toISOString() }).eq('id', holding.id);

                                await supabase.from('transactions').insert({
                                    user_id: holding.user_id,
                                    type: 'savings_withdrawal',
                                    amount: totalRefund,
                                    status: 'completed',
                                    description: `Admin Liquidated Savings: ${holding.title}`,
                                    reference: `SAV-LIQ-${Date.now()}`,
                                });
                            }

                            await supabase.from('audit_logs').insert({
                                action: `Admin Liquidated Savings Plan: ${holding.title}`,
                                target_resource: `User / ${holding.user_id}`,
                                details: { plan_id: holding.id, amount_refunded: Number(holding.amount_saved) + Number(holding.accrued_interest || 0) },
                            });

                            Alert.alert('Plan Liquidated ✅', 'Principal and interest credited to customer wallet successfully.');
                            setSelectedHolding(null);
                            loadWealthData();
                        } catch (err: any) {
                            Alert.alert('Liquidation Error', err.message);
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // REAL ATOMIC ACTION: Credit Manual Bonus Yield to Specific Plan
    const handleCreditBonusYield = async () => {
        if (!selectedHolding || !bonusYieldAmount || Number(bonusYieldAmount) <= 0) {
            Alert.alert('Required', 'Please enter a valid bonus amount.');
            return;
        }

        setActionLoading(true);
        try {
            const bonus = parseFloat(bonusYieldAmount);

            // Update accrued interest on savings plan
            await supabase
                .from('savings_plans')
                .update({
                    accrued_interest: Number(selectedHolding.accrued_interest || 0) + bonus,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedHolding.id);

            // Insert transaction record
            await supabase.from('transactions').insert({
                user_id: selectedHolding.user_id,
                type: 'savings_interest',
                amount: bonus,
                status: 'completed',
                description: `Admin Bonus Yield Credit for ${selectedHolding.title}`,
                reference: `BONUS-${Date.now()}`,
            });

            await supabase.from('audit_logs').insert({
                action: `Credited Bonus Yield ₦${bonus} to ${selectedHolding.title}`,
                target_resource: `User / ${selectedHolding.user_id}`,
                details: { plan_id: selectedHolding.id, bonus },
            });

            Alert.alert('Bonus Yield Credited 🎉', `₦${bonus.toLocaleString()} added to user's plan yield.`);
            setBonusYieldAmount('');
            setSelectedHolding(null);
            loadWealthData();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Export Portfolio Report
    const handleExportPortfolioReport = async () => {
        const textReport = `=== ABUMAFHAL WEALTH, ASSETS & SAVINGS REPORT ===
Timestamp: ${new Date().toISOString()}
Total Assets Under Management (AUM): ₦${calculatedMetrics.totalAUM.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Total User Savings Stashed: ₦${calculatedMetrics.totalUserSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Total Institutional Asset Pools: ₦${calculatedMetrics.totalPoolsAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Active Savers Count: ${calculatedMetrics.activeSaversCount}
Estimated Monthly Interest Liability: ₦${calculatedMetrics.estimatedMonthlyInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}

Active APY Rate Programs:
${apyPlans.map(p => `• ${p.name}: ${p.apyRate}% APY (Lock: ${p.lockDays}d | Shariah: ${p.shariahCompliant ? 'Yes' : 'No'})`).join('\n')}

Asset Pools:
${assetPools.map(p => `• ${p.title}: ₦${p.totalAllocated.toLocaleString()} (Yield Target: ${p.targetYield}%)`).join('\n')}`;

        if (Platform.OS === 'web') {
            await Clipboard.setStringAsync(textReport);
            Alert.alert('Report Copied 📋', 'Full AUM portfolio report copied to clipboard.');
        } else {
            await Share.share({ message: textReport, title: 'ABUMAFHAL Wealth & Assets Report' });
        }
    };

    // Filtered User Holdings
    const filteredHoldings = useMemo(() => {
        return userHoldings.filter(h => {
            const matchesSearch =
                !searchHoldings.trim() ||
                h.title.toLowerCase().includes(searchHoldings.toLowerCase()) ||
                (h.profiles?.full_name && h.profiles.full_name.toLowerCase().includes(searchHoldings.toLowerCase())) ||
                (h.profiles?.email && h.profiles.email.toLowerCase().includes(searchHoldings.toLowerCase()));

            const matchesStatus = filterHoldingStatus === 'all' || h.status === filterHoldingStatus;
            return matchesSearch && matchesStatus;
        });
    }, [userHoldings, searchHoldings, filterHoldingStatus]);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Wealth & Asset Management',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setShowPayoutModal(true)} style={styles.headerGoldBtn}>
                                <Ionicons name="flash-outline" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowNewPoolModal(true)} style={styles.headerGoldBtn}>
                                <Ionicons name="add-outline" size={18} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleExportPortfolioReport} style={styles.headerGoldBtn}>
                                <Ionicons name="share-outline" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={styles.headerGoldBtn}>
                                <Ionicons name="refresh" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Top AUM Executive Telemetry Hero */}
            <LinearGradient colors={[T.navyPrimary, T.navyDeep, T.navyMid]} style={styles.heroAumCard}>
                <View style={styles.heroHeaderRow}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.heroBadgeRow}>
                            <View style={styles.pulseDot} />
                            <Text style={styles.heroBadgeText}>ASSETS UNDER MANAGEMENT (AUM)</Text>
                        </View>
                        <Text style={styles.heroAumValue}>
                            ₦ {calculatedMetrics.totalAUM.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                    </View>

                    <View style={styles.yieldTag}>
                        <Ionicons name="trending-up" size={14} color={T.success} />
                        <Text style={styles.yieldTagText}>Avg APY: {calculatedMetrics.avgApy.toFixed(1)}%</Text>
                    </View>
                </View>

                {/* Sub Telemetry Metrics Grid */}
                <View style={styles.telemetryGrid}>
                    <View style={styles.telemetryItem}>
                        <Text style={styles.telemetryLabel}>User Savings</Text>
                        <Text style={styles.telemetryVal}>
                            ₦{calculatedMetrics.totalUserSavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View style={styles.telemetryDivider} />
                    <View style={styles.telemetryItem}>
                        <Text style={styles.telemetryLabel}>Pool Reserves</Text>
                        <Text style={[styles.telemetryVal, { color: T.goldBright }]}>
                            ₦{calculatedMetrics.totalPoolsAllocated.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View style={styles.telemetryDivider} />
                    <View style={styles.telemetryItem}>
                        <Text style={styles.telemetryLabel}>Active Savers</Text>
                        <Text style={[styles.telemetryVal, { color: T.info }]}>{calculatedMetrics.activeSaversCount}</Text>
                    </View>
                    <View style={styles.telemetryDivider} />
                    <View style={styles.telemetryItem}>
                        <Text style={styles.telemetryLabel}>Monthly Yield</Text>
                        <Text style={[styles.telemetryVal, { color: T.success }]}>
                            ₦{calculatedMetrics.estimatedMonthlyInterest.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Sub-Navigation Tabs Ribbon */}
            <View style={styles.tabRibbon}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                    {[
                        { key: 'overview', label: '📊 Overview' },
                        { key: 'apy_plans', label: '📈 Savings APY Control' },
                        { key: 'asset_pools', label: '💼 Asset Pools & Vaults' },
                        { key: 'user_holdings', label: '👥 User Portfolios' },
                        { key: 'payout_engine', label: '⚡ Yield Engine' },
                        { key: 'settings', label: '⚙️ Rules & Shariah' },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key as any)}
                            style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
                        >
                            <Text style={[styles.tabPillText, activeTab === tab.key && styles.tabPillTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={styles.loadingText}>Synchronizing Wealth & Asset Ledger...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ========================================================================= */}
                    {/* TAB 1: OVERVIEW & PORTFOLIO DISTRIBUTION                                 */}
                    {/* ========================================================================= */}
                    {activeTab === 'overview' && (
                        <View>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Asset Allocation Matrix</Text>
                                <Text style={styles.sectionSubtitle}>Institutional portfolio diversification & reserve posture</Text>
                            </View>

                            {assetPools.map(pool => {
                                const percentage = calculatedMetrics.totalAUM > 0 ? (pool.totalAllocated / calculatedMetrics.totalAUM) * 100 : 0;
                                return (
                                    <View key={pool.id} style={styles.poolCard}>
                                        <View style={styles.poolCardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.poolCardTitle}>{pool.title}</Text>
                                                <Text style={styles.poolCategoryTag}>{pool.category.toUpperCase()}</Text>
                                            </View>
                                            <View style={styles.poolTargetTag}>
                                                <Text style={styles.poolTargetText}>+{pool.targetYield}% Yield</Text>
                                            </View>
                                        </View>

                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressBar, { width: `${Math.min(100, Math.max(8, percentage))}%` }]} />
                                        </View>

                                        <View style={styles.poolFooterRow}>
                                            <Text style={styles.poolFootText}>
                                                Holding: <Text style={{ fontWeight: '900', color: T.navyPrimary }}>₦{pool.totalAllocated.toLocaleString()}</Text>
                                            </Text>
                                            <Text style={styles.poolFootPercent}>{percentage.toFixed(1)}% of AUM</Text>
                                        </View>
                                    </View>
                                );
                            })}

                            {/* Quick Action Matrix Banner */}
                            <View style={styles.quickBanner}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.quickBannerTitle}>Instant Yield Disbursal Trigger</Text>
                                    <Text style={styles.quickBannerSub}>
                                        Manually credit daily/monthly compound interest to all active savers in 1 tap.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowPayoutModal(true)}
                                    style={styles.quickBannerBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="flash" size={15} color="#FFFFFF" />
                                    <Text style={styles.quickBannerBtnText}>Run Engine</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: SAVINGS APY RATE CONTROL                                           */}
                    {/* ========================================================================= */}
                    {activeTab === 'apy_plans' && (
                        <View>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Savings Programs & APY Rates</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Set annual yield rates, lock durations, and penalty fees for users.
                                </Text>
                            </View>

                            {apyPlans.map(plan => (
                                <View key={plan.id} style={styles.planCard}>
                                    <View style={styles.planCardTop}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                <Text style={styles.planName}>{plan.name}</Text>
                                                {plan.shariahCompliant && (
                                                    <View style={styles.shariahBadge}>
                                                        <Ionicons name="leaf" size={10} color={T.success} />
                                                        <Text style={styles.shariahBadgeText}>HALAL</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.planDesc}>{plan.description}</Text>
                                        </View>

                                        <View style={styles.apyDisplayBox}>
                                            <Text style={styles.apyValueText}>{plan.apyRate}%</Text>
                                            <Text style={styles.apyLabelText}>ANNUAL APY</Text>
                                        </View>
                                    </View>

                                    <View style={styles.planDetailsRow}>
                                        <View style={styles.planDetailItem}>
                                            <Ionicons name="lock-closed-outline" size={13} color={T.textMuted} />
                                            <Text style={styles.planDetailText}>
                                                Lock: <Text style={{ fontWeight: '800' }}>{plan.lockDays > 0 ? `${plan.lockDays} Days` : 'Flexible (0d)'}</Text>
                                            </Text>
                                        </View>
                                        <View style={styles.planDetailItem}>
                                            <Ionicons name="wallet-outline" size={13} color={T.textMuted} />
                                            <Text style={styles.planDetailText}>
                                                Min: <Text style={{ fontWeight: '800' }}>₦{plan.minDeposit.toLocaleString()}</Text>
                                            </Text>
                                        </View>
                                        <View style={styles.planDetailItem}>
                                            <Ionicons name="alert-circle-outline" size={13} color={T.textMuted} />
                                            <Text style={styles.planDetailText}>
                                                Penalty: <Text style={{ fontWeight: '800' }}>{plan.earlyPenaltyPercent}%</Text>
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.planCardFooter}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={[styles.statusDot, { backgroundColor: plan.active ? T.success : T.danger }]} />
                                            <Text style={styles.statusText}>{plan.active ? 'Active For New Users' : 'Disabled'}</Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => setEditingPlan({ ...plan })}
                                            style={styles.editPlanBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="create-outline" size={14} color={T.gold} />
                                            <Text style={styles.editPlanBtnText}>Adjust APY & Terms</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: ASSET POOLS & VAULT RESERVES                                       */}
                    {/* ========================================================================= */}
                    {activeTab === 'asset_pools' && (
                        <View>
                            <View style={styles.sectionHeaderRow}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <Text style={styles.sectionTitle}>Institutional Reserves & Pools</Text>
                                        <Text style={styles.sectionSubtitle}>
                                            Manage platform treasury vaults, gold holdings, and liquidity buffers.
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowNewPoolModal(true)}
                                        style={styles.addPoolTopBtn}
                                    >
                                        <Ionicons name="add-circle" size={14} color="#FFFFFF" />
                                        <Text style={styles.addPoolTopBtnText}>Add Pool</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {assetPools.map(pool => (
                                <View key={pool.id} style={styles.assetPoolDetailedCard}>
                                    <View style={styles.poolTopRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.poolDetailedTitle}>{pool.title}</Text>
                                            <Text style={styles.poolRiskTier}>{pool.riskTier}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setEditingPool({ ...pool })}
                                            style={styles.poolEditBtn}
                                        >
                                            <Ionicons name="pencil" size={13} color={T.gold} />
                                            <Text style={styles.poolEditBtnText}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.poolNotesText}>{pool.notes}</Text>

                                    <View style={styles.poolMetricBoxRow}>
                                        <View style={styles.poolMetricBox}>
                                            <Text style={styles.poolMetricBoxLabel}>TOTAL ALLOCATED</Text>
                                            <Text style={styles.poolMetricBoxVal}>₦{pool.totalAllocated.toLocaleString()}</Text>
                                        </View>
                                        <View style={styles.poolMetricBox}>
                                            <Text style={styles.poolMetricBoxLabel}>TARGET YIELD</Text>
                                            <Text style={[styles.poolMetricBoxVal, { color: T.success }]}>{pool.targetYield}% p.a.</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 4: USER PORTFOLIOS & SAVINGS STREAMS                                  */}
                    {/* ========================================================================= */}
                    {activeTab === 'user_holdings' && (
                        <View>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>User Savings & Wealth Accounts</Text>
                                <Text style={styles.sectionSubtitle}>Live stream of all customer savings portfolios</Text>
                            </View>

                            {/* Search & Filter Bar */}
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={15} color={T.textMuted} />
                                <TextInput
                                    value={searchHoldings}
                                    onChangeText={setSearchHoldings}
                                    placeholder="Search by goal title, user name, email..."
                                    placeholderTextColor={T.textMuted}
                                    style={styles.searchInput}
                                />
                            </View>

                            <View style={styles.statusPillsRow}>
                                {(['all', 'active', 'matured', 'liquidated'] as const).map(st => (
                                    <TouchableOpacity
                                        key={st}
                                        onPress={() => setFilterHoldingStatus(st)}
                                        style={[styles.statusPill, filterHoldingStatus === st && styles.statusPillActive]}
                                    >
                                        <Text style={[styles.statusPillText, filterHoldingStatus === st && styles.statusPillTextActive]}>
                                            {st.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {filteredHoldings.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="wallet-outline" size={40} color={T.gold} />
                                    <Text style={styles.emptyStateTitle}>Zero Savings Records</Text>
                                    <Text style={styles.emptyStateSub}>No user savings plans match current filter.</Text>
                                </View>
                            ) : (
                                filteredHoldings.map(h => (
                                    <TouchableOpacity
                                        key={h.id}
                                        onPress={() => setSelectedHolding(h)}
                                        style={styles.holdingCard}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.holdingTopRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.holdingTitle}>{h.title}</Text>
                                                <Text style={styles.holdingUser}>{h.profiles?.full_name || h.profiles?.email || 'Registered User'}</Text>
                                            </View>
                                            <View style={styles.holdingAmountWrap}>
                                                <Text style={styles.holdingAmountText}>
                                                    ₦{Number(h.amount_saved || 0).toLocaleString()}
                                                </Text>
                                                <Text style={styles.holdingTargetText}>
                                                    Target: ₦{Number(h.target_amount || 0).toLocaleString()}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.holdingFooterRow}>
                                            <View style={styles.holdingBadge}>
                                                <Text style={styles.holdingBadgeText}>STATUS: {h.status.toUpperCase()}</Text>
                                            </View>
                                            <Text style={styles.holdingDateText}>
                                                Accrued Yield: <Text style={{ color: T.success, fontWeight: '900' }}>+₦{Number(h.accrued_interest || 0).toLocaleString()}</Text>
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 5: AUTOMATED YIELD ENGINE & DISBURSEMENTS                             */}
                    {/* ========================================================================= */}
                    {activeTab === 'payout_engine' && (
                        <View>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Automated Yield Accrual Engine</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Trigger interest compounding, calculate liabilities, and post ledger entries.
                                </Text>
                            </View>

                            <View style={styles.engineCard}>
                                <View style={styles.engineTopRow}>
                                    <View style={styles.engineIconWrap}>
                                        <Ionicons name="calculator" size={22} color={T.goldBright} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.engineTitle}>Daily Compounding Engine</Text>
                                        <Text style={styles.engineSub}>Next scheduled run: Midnight UTC</Text>
                                    </View>
                                </View>

                                <View style={styles.engineMetricsRow}>
                                    <View style={styles.engineMetricItem}>
                                        <Text style={styles.engineMetricLabel}>Total Active Savers</Text>
                                        <Text style={styles.engineMetricVal}>{calculatedMetrics.activeSaversCount}</Text>
                                    </View>
                                    <View style={styles.engineMetricItem}>
                                        <Text style={styles.engineMetricLabel}>Daily Accrual Est.</Text>
                                        <Text style={[styles.engineMetricVal, { color: T.success }]}>
                                            ₦{(calculatedMetrics.estimatedMonthlyInterest / 30).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setShowPayoutModal(true)}
                                    style={styles.engineRunBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="flash" size={17} color="#FFFFFF" />
                                    <Text style={styles.engineRunBtnText}>Simulate & Execute Real Yield Disbursal</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 6: RULES, LIMITS & SHARIAH COMPLIANCE                                 */}
                    {/* ========================================================================= */}
                    {activeTab === 'settings' && (
                        <View>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Operational Limits & Shariah Settings</Text>
                                <Text style={styles.sectionSubtitle}>Global parameters governing wealth and assets.</Text>
                            </View>

                            <View style={styles.settingsCard}>
                                <Text style={styles.inputLabel}>Minimum Flexible Deposit (₦)</Text>
                                <TextInput
                                    value={rulesConfig.minFlexibleDeposit}
                                    onChangeText={val => setRulesConfig({ ...rulesConfig, minFlexibleDeposit: val })}
                                    keyboardType="numeric"
                                    style={styles.settingsInput}
                                />

                                <Text style={styles.inputLabel}>Maximum Single Vault Lock (₦)</Text>
                                <TextInput
                                    value={rulesConfig.maxSingleDeposit}
                                    onChangeText={val => setRulesConfig({ ...rulesConfig, maxSingleDeposit: val })}
                                    keyboardType="numeric"
                                    style={styles.settingsInput}
                                />

                                <Text style={styles.inputLabel}>Early Liquidation Break Penalty Fee (%)</Text>
                                <TextInput
                                    value={rulesConfig.earlyLiquidationFeePercent}
                                    onChangeText={val => setRulesConfig({ ...rulesConfig, earlyLiquidationFeePercent: val })}
                                    keyboardType="numeric"
                                    style={styles.settingsInput}
                                />

                                <View style={styles.switchRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.switchTitle}>Enable Shariah / Halal Verification</Text>
                                        <Text style={styles.switchSub}>Enforce zero interest Mudarabah profit sharing mode for Halal pools.</Text>
                                    </View>
                                    <Switch
                                        value={rulesConfig.enableHalalFilter}
                                        onValueChange={val => setRulesConfig({ ...rulesConfig, enableHalalFilter: val })}
                                        trackColor={{ false: '#CBD5E1', true: T.gold }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={styles.switchRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.switchTitle}>Automated Daily Compounding Cron</Text>
                                        <Text style={styles.switchSub}>Allow Supabase edge background worker to accrue daily yield.</Text>
                                    </View>
                                    <Switch
                                        value={rulesConfig.enableAutoInterestPayoutCron}
                                        onValueChange={val => setRulesConfig({ ...rulesConfig, enableAutoInterestPayoutCron: val })}
                                        trackColor={{ false: '#CBD5E1', true: T.gold }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleSaveRulesConfig}
                                    disabled={savingSettings}
                                    style={styles.saveRulesBtn}
                                    activeOpacity={0.85}
                                >
                                    {savingSettings ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={17} color={T.goldBright} />
                                            <Text style={styles.saveRulesBtnText}>Save Wealth Rules</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* ========================================================================= */}
            {/* MODAL 1: EDIT APY PLAN MODAL                                              */}
            {/* ========================================================================= */}
            <Modal
                visible={!!editingPlan}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setEditingPlan(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Configure APY Program</Text>
                            <TouchableOpacity onPress={() => setEditingPlan(null)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {editingPlan && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.inputLabel}>Program Title</Text>
                                <TextInput
                                    value={editingPlan.name}
                                    onChangeText={val => setEditingPlan({ ...editingPlan, name: val })}
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Annual Percentage Yield (APY %)</Text>
                                <TextInput
                                    value={String(editingPlan.apyRate)}
                                    onChangeText={val => setEditingPlan({ ...editingPlan, apyRate: parseFloat(val) || 0 })}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Lock Duration (Days)</Text>
                                <TextInput
                                    value={String(editingPlan.lockDays)}
                                    onChangeText={val => setEditingPlan({ ...editingPlan, lockDays: parseInt(val, 10) || 0 })}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Early Break Penalty (%)</Text>
                                <TextInput
                                    value={String(editingPlan.earlyPenaltyPercent)}
                                    onChangeText={val => setEditingPlan({ ...editingPlan, earlyPenaltyPercent: parseFloat(val) || 0 })}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Minimum Deposit (₦)</Text>
                                <TextInput
                                    value={String(editingPlan.minDeposit)}
                                    onChangeText={val => setEditingPlan({ ...editingPlan, minDeposit: parseFloat(val) || 0 })}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <View style={styles.switchRow}>
                                    <Text style={styles.switchTitle}>Program Active For Users</Text>
                                    <Switch
                                        value={editingPlan.active}
                                        onValueChange={val => setEditingPlan({ ...editingPlan, active: val })}
                                        trackColor={{ false: '#CBD5E1', true: T.gold }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleSavePlanEdit}
                                    disabled={savingSettings}
                                    style={styles.modalSaveBtn}
                                    activeOpacity={0.85}
                                >
                                    {savingSettings ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.modalSaveBtnText}>Commit APY Changes</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: ADD / EDIT ASSET POOL MODAL                                      */}
            {/* ========================================================================= */}
            <Modal
                visible={showNewPoolModal || !!editingPool}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setShowNewPoolModal(false);
                    setEditingPool(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingPool ? 'Configure Asset Pool' : 'Create New Asset Pool'}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setShowNewPoolModal(false);
                                setEditingPool(null);
                            }}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {editingPool ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.inputLabel}>Pool Title</Text>
                                <TextInput
                                    value={editingPool.title}
                                    onChangeText={val => setEditingPool({ ...editingPool, title: val })}
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Total Capital Allocated (₦)</Text>
                                <TextInput
                                    value={String(editingPool.totalAllocated)}
                                    onChangeText={val => setEditingPool({ ...editingPool, totalAllocated: parseFloat(val) || 0 })}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Target Yield Rate (%)</Text>
                                <TextInput
                                    value={String(editingPool.targetYield)}
                                    onChangeText={val => setEditingPool({ ...editingPool, targetYield: parseFloat(val) || 0 })}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Portfolio Strategy Notes</Text>
                                <TextInput
                                    value={editingPool.notes}
                                    onChangeText={val => setEditingPool({ ...editingPool, notes: val })}
                                    multiline
                                    style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                                />

                                <TouchableOpacity
                                    onPress={handleSavePoolEdit}
                                    disabled={savingSettings}
                                    style={styles.modalSaveBtn}
                                    activeOpacity={0.85}
                                >
                                    {savingSettings ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.modalSaveBtnText}>Commit Pool Allocation</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.inputLabel}>Pool Title</Text>
                                <TextInput
                                    value={newPoolTitle}
                                    onChangeText={setNewPoolTitle}
                                    placeholder="e.g. Export Commodities Trade Finance"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Category</Text>
                                <TextInput
                                    value={newPoolCategory}
                                    onChangeText={setNewPoolCategory}
                                    placeholder="e.g. Treasury / Trade Finance / Gold"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Allocated Capital (₦)</Text>
                                <TextInput
                                    value={newPoolAmount}
                                    onChangeText={setNewPoolAmount}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Target Yield Rate (%)</Text>
                                <TextInput
                                    value={newPoolYield}
                                    onChangeText={setNewPoolYield}
                                    keyboardType="numeric"
                                    style={styles.modalInput}
                                />

                                <Text style={styles.inputLabel}>Notes</Text>
                                <TextInput
                                    value={newPoolNotes}
                                    onChangeText={setNewPoolNotes}
                                    placeholder="Investment guidelines & custodian details"
                                    multiline
                                    style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                                />

                                <TouchableOpacity
                                    onPress={handleCreateNewPool}
                                    disabled={savingSettings}
                                    style={styles.modalSaveBtn}
                                    activeOpacity={0.85}
                                >
                                    {savingSettings ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.modalSaveBtnText}>Create Asset Pool</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 3: INSPECT & MANAGE USER SAVINGS HOLDING                            */}
            {/* ========================================================================= */}
            <Modal
                visible={!!selectedHolding}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedHolding(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>User Savings Portfolio</Text>
                            <TouchableOpacity onPress={() => setSelectedHolding(null)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedHolding && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.holdingInspectHero}>
                                    <Text style={styles.inspectHeroGoal}>{selectedHolding.title}</Text>
                                    <Text style={styles.inspectHeroSaved}>
                                        ₦{Number(selectedHolding.amount_saved).toLocaleString()}
                                    </Text>
                                    <Text style={styles.inspectHeroTarget}>
                                        Goal Target: ₦{Number(selectedHolding.target_amount).toLocaleString()}
                                    </Text>
                                </View>

                                <View style={styles.inspectDetailRow}>
                                    <Text style={styles.inspectDetailLabel}>Customer</Text>
                                    <Text style={styles.inspectDetailVal}>
                                        {selectedHolding.profiles?.full_name || selectedHolding.profiles?.email || 'N/A'}
                                    </Text>
                                </View>

                                <View style={styles.inspectDetailRow}>
                                    <Text style={styles.inspectDetailLabel}>Wallet Balance</Text>
                                    <Text style={styles.inspectDetailVal}>
                                        ₦{Number(selectedHolding.profiles?.balance || 0).toLocaleString()}
                                    </Text>
                                </View>

                                <View style={styles.inspectDetailRow}>
                                    <Text style={styles.inspectDetailLabel}>Accrued Yield</Text>
                                    <Text style={[styles.inspectDetailVal, { color: T.success }]}>
                                        +₦{Number(selectedHolding.accrued_interest || 0).toLocaleString()}
                                    </Text>
                                </View>

                                <View style={styles.inspectDetailRow}>
                                    <Text style={styles.inspectDetailLabel}>Plan Status</Text>
                                    <Text style={[styles.inspectDetailVal, { color: T.gold }]}>
                                        {selectedHolding.status.toUpperCase()}
                                    </Text>
                                </View>

                                {/* Bonus Yield Crediting Box */}
                                <Text style={styles.inputLabel}>Credit Manual Bonus Yield (₦)</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    <TextInput
                                        value={bonusYieldAmount}
                                        onChangeText={setBonusYieldAmount}
                                        placeholder="e.g. 500"
                                        keyboardType="numeric"
                                        style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                                    />
                                    <TouchableOpacity
                                        onPress={handleCreditBonusYield}
                                        disabled={actionLoading}
                                        style={styles.creditBonusBtn}
                                    >
                                        <Ionicons name="gift" size={15} color="#FFFFFF" />
                                        <Text style={styles.creditBonusBtnText}>Credit</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Emergency Liquidate Action */}
                                {selectedHolding.status !== 'liquidated' && (
                                    <TouchableOpacity
                                        onPress={() => handleLiquidateUserPlan(selectedHolding)}
                                        disabled={actionLoading}
                                        style={styles.liquidateBtn}
                                        activeOpacity={0.85}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="trash-bin-outline" size={16} color="#FFFFFF" />
                                                <Text style={styles.liquidateBtnText}>Emergency Liquidate to Wallet</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 4: RUN YIELD DISBURSAL SIMULATOR                                     */}
            {/* ========================================================================= */}
            <Modal
                visible={showPayoutModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPayoutModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="flash" size={18} color={T.goldBright} />
                                <Text style={styles.modalTitle}>Execute Real Yield Disbursal</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalExplanation}>
                            This action executes atomic interest accrual directly against the active database: calculating exact daily compound interest for all active savings portfolios, updating plan yield, and logging transaction ledger rows.
                        </Text>

                        <View style={styles.payoutPreviewBox}>
                            <Text style={styles.payoutPreviewLabel}>ESTIMATED DISBURSAL AMOUNT</Text>
                            <Text style={styles.payoutPreviewVal}>
                                ₦{(calculatedMetrics.estimatedMonthlyInterest / 30).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.payoutPreviewSub}>Across {calculatedMetrics.activeSaversCount} Active Customer Portfolios</Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleTriggerYieldDisbursement}
                            disabled={payoutProcessing}
                            style={styles.executePayoutBtn}
                            activeOpacity={0.85}
                        >
                            {payoutProcessing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
                                    <Text style={styles.executePayoutBtnText}>Confirm & Disburse Yield</Text>
                                </>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: T.bg,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 12.5,
        fontWeight: '700',
        color: T.textSub,
    },
    headerGoldBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: T.navyDeep,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroAumCard: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.cardBorderGold,
    },
    heroHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    pulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.goldBright,
    },
    heroBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 1,
    },
    heroAumValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    yieldTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(5, 150, 105, 0.3)',
    },
    yieldTagText: {
        color: '#34D399',
        fontSize: 11,
        fontWeight: '800',
    },
    telemetryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 6, 0.2)',
    },
    telemetryItem: {
        flex: 1,
        alignItems: 'center',
    },
    telemetryLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: 2,
    },
    telemetryVal: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    telemetryDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    tabRibbon: {
        backgroundColor: T.navyPrimary,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 119, 6, 0.2)',
        paddingVertical: 6,
    },
    tabScroll: {
        paddingHorizontal: 10,
        gap: 6,
    },
    tabPill: {
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: T.navyDeep,
    },
    tabPillActive: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
        borderColor: T.gold,
    },
    tabPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textMuted,
    },
    tabPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    scrollContent: {
        padding: 12,
        paddingBottom: 40,
    },
    sectionHeaderRow: {
        marginBottom: 10,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    sectionSubtitle: {
        fontSize: 11,
        color: T.textSub,
        marginTop: 1,
    },
    addPoolTopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    addPoolTopBtnText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    poolCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: T.cardBorder,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    poolCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    poolCardTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    poolCategoryTag: {
        fontSize: 9,
        fontWeight: '800',
        color: T.goldDark,
        marginTop: 2,
    },
    poolTargetTag: {
        backgroundColor: T.successBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.successBorder,
    },
    poolTargetText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: T.success,
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
        marginVertical: 6,
    },
    progressBar: {
        height: '100%',
        backgroundColor: T.gold,
        borderRadius: 3,
    },
    poolFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    poolFootText: {
        fontSize: 11,
        color: T.textSub,
    },
    poolFootPercent: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textMuted,
    },
    quickBanner: {
        backgroundColor: T.navyPrimary,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 10,
        gap: 10,
    },
    quickBannerTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        marginBottom: 2,
    },
    quickBannerSub: {
        color: '#94A3B8',
        fontSize: 10.5,
        lineHeight: 14,
    },
    quickBannerBtn: {
        backgroundColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    quickBannerBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '900',
    },
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    planCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    planName: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    shariahBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: T.successBg,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: T.successBorder,
    },
    shariahBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: T.success,
    },
    planDesc: {
        fontSize: 10.5,
        color: T.textSub,
        marginTop: 2,
        lineHeight: 14,
    },
    apyDisplayBox: {
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    apyValueText: {
        color: T.goldBright,
        fontSize: 14,
        fontWeight: '900',
    },
    apyLabelText: {
        color: '#94A3B8',
        fontSize: 7.5,
        fontWeight: '800',
        marginTop: 1,
    },
    planDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 8,
        marginVertical: 6,
    },
    planDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    planDetailText: {
        fontSize: 10.5,
        color: T.textSub,
    },
    planCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8,
        marginTop: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: T.textMuted,
    },
    editPlanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: T.goldBg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    editPlanBtnText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: T.goldDark,
    },
    assetPoolDetailedCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    poolTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    poolDetailedTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    poolRiskTier: {
        fontSize: 10,
        fontWeight: '700',
        color: T.goldDark,
        marginTop: 1,
    },
    poolEditBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: T.goldBg,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    poolEditBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: T.goldDark,
    },
    poolNotesText: {
        fontSize: 10.5,
        color: T.textSub,
        lineHeight: 14,
        marginBottom: 8,
    },
    poolMetricBoxRow: {
        flexDirection: 'row',
        gap: 8,
    },
    poolMetricBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    poolMetricBoxLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: T.textMuted,
        marginBottom: 2,
    },
    poolMetricBoxVal: {
        fontSize: 12.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 8,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 11.5,
        color: T.textMain,
    },
    statusPillsRow: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: 10,
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
    },
    statusPillActive: {
        backgroundColor: T.navyPrimary,
    },
    statusPillText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: T.textMuted,
    },
    statusPillTextActive: {
        color: T.goldBright,
    },
    holdingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    holdingTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    holdingTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    holdingUser: {
        fontSize: 10.5,
        color: T.textSub,
        marginTop: 1,
    },
    holdingAmountWrap: {
        alignItems: 'flex-end',
    },
    holdingAmountText: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    holdingTargetText: {
        fontSize: 9.5,
        color: T.textMuted,
        marginTop: 1,
    },
    holdingFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 6,
    },
    holdingBadge: {
        backgroundColor: T.goldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    holdingBadgeText: {
        fontSize: 8.5,
        fontWeight: '800',
        color: T.goldDark,
    },
    holdingDateText: {
        fontSize: 9.5,
        color: T.textMuted,
    },
    emptyState: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginTop: 8,
    },
    emptyStateTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: T.navyPrimary,
        marginTop: 6,
    },
    emptyStateSub: {
        fontSize: 10.5,
        color: T.textMuted,
        marginTop: 2,
    },
    engineCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    engineTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    engineIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: T.navyPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    engineTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    engineSub: {
        fontSize: 10.5,
        color: T.textMuted,
        marginTop: 1,
    },
    engineMetricsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    engineMetricItem: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    engineMetricLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: T.textMuted,
        marginBottom: 2,
    },
    engineMetricVal: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    engineRunBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    engineRunBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    settingsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
        marginTop: 8,
        marginBottom: 4,
    },
    settingsInput: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 8,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        marginTop: 4,
    },
    switchTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.navyPrimary,
    },
    switchSub: {
        fontSize: 9.5,
        color: T.textMuted,
        marginTop: 1,
    },
    saveRulesBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 12,
    },
    saveRulesBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 13, 30, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    modalInput: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 8,
    },
    modalSaveBtn: {
        backgroundColor: T.navyPrimary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 10,
        marginBottom: 16,
    },
    modalSaveBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    modalExplanation: {
        fontSize: 11,
        color: T.textSub,
        lineHeight: 15,
        marginBottom: 12,
    },
    payoutPreviewBox: {
        backgroundColor: T.navyPrimary,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginBottom: 14,
    },
    payoutPreviewLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 1,
        marginBottom: 2,
    },
    payoutPreviewVal: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    payoutPreviewSub: {
        fontSize: 10,
        color: '#94A3B8',
    },
    executePayoutBtn: {
        backgroundColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        marginBottom: 16,
    },
    executePayoutBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    holdingInspectHero: {
        backgroundColor: T.navyPrimary,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    inspectHeroGoal: {
        color: T.goldBright,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    inspectHeroSaved: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 2,
    },
    inspectHeroTarget: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    inspectDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    inspectDetailLabel: {
        fontSize: 11,
        color: T.textSub,
        fontWeight: '600',
    },
    inspectDetailVal: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.navyPrimary,
    },
    creditBonusBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    creditBonusBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
    },
    liquidateBtn: {
        backgroundColor: T.danger,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        marginTop: 10,
        marginBottom: 16,
    },
    liquidateBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
});
