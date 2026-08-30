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
    RefreshControl,
    StyleSheet,
    Dimensions
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Navy & Gold Brand Colors
const T = {
    navyPrimary: '#070D1E',
    navyDeep: '#0A1128',
    navyMid: '#0F172A',
    navyCard: '#1E293B',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldDark: '#B45309',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    border: '#E2E8F0',
    inputBg: '#F8FAFC',
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    danger: '#DC2626',
    cardBorderGold: 'rgba(217, 119, 6, 0.28)',
};

interface SavingsPlan {
    id: string;
    user_id: string;
    title: string;
    amount_saved: number;
    target_amount: number;
    plan_type: string;
    frequency: string;
    apy_rate: number;
    lock_until?: string | null;
    status: 'active' | 'matured' | 'locked' | 'liquidated';
    accrued_interest: number;
    shariah_compliant: boolean;
    created_at: string;
}

export default function SavingsScreen() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'plans' | 'create'>('plans');
    const [plans, setPlans] = useState<SavingsPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userWalletBalance, setUserWalletBalance] = useState(0);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Create Form
    const [goalTitle, setGoalTitle] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [initialDeposit, setInitialDeposit] = useState('');
    const [selectedPlanType, setSelectedPlanType] = useState<'flexible' | 'fixed_30' | 'halal' | 'gold'>('flexible');
    const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
    const [submitting, setSubmitting] = useState(false);

    // Selected Plan Modal (Deposit / Liquidate)
    const [selectedPlan, setSelectedPlan] = useState<SavingsPlan | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchSavingsData();
    }, []);

    const fetchSavingsData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            // Fetch profile balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                setUserWalletBalance(Number(profile.balance || 0));
            }

            // Fetch user savings plans
            const { data: plansData, error: plansError } = await supabase
                .from('savings_plans')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!plansError && plansData) {
                setPlans(plansData);
            }
        } catch (e) {
            console.error('Error loading savings data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchSavingsData();
    }, []);

    const totalSaved = plans
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + (Number(p.amount_saved) || 0), 0);

    const totalYieldEarned = plans
        .reduce((sum, p) => sum + (Number(p.accrued_interest) || 0), 0);

    // Create New Savings Goal
    const handleCreatePlan = async () => {
        if (!goalTitle.trim()) {
            Alert.alert('Required', 'Please enter a goal title.');
            return;
        }

        const target = parseFloat(targetAmount) || 0;
        const initial = parseFloat(initialDeposit) || 0;

        if (target <= 0) {
            Alert.alert('Invalid Target', 'Please enter a valid target goal amount.');
            return;
        }

        if (initial > 0 && initial > userWalletBalance) {
            Alert.alert('Insufficient Balance', `Your wallet balance is ₦${userWalletBalance.toLocaleString()}. Please fund your wallet first or enter a lower initial deposit.`);
            return;
        }

        setSubmitting(true);
        try {
            const apyRates: Record<string, { apy: number; lockDays: number }> = {
                flexible: { apy: 9.5, lockDays: 0 },
                fixed_30: { apy: 14.0, lockDays: 30 },
                halal: { apy: 12.0, lockDays: 60 },
                gold: { apy: 8.0, lockDays: 180 },
            };

            const selectedConfig = apyRates[selectedPlanType] || { apy: 10.0, lockDays: 0 };

            // Try calling atomic RPC
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_user_savings_plan', {
                p_title: goalTitle.trim(),
                p_target_amount: target,
                p_plan_type: selectedPlanType,
                p_initial_deposit: initial,
                p_frequency: frequency,
                p_apy_rate: selectedConfig.apy,
                p_lock_days: selectedConfig.lockDays,
            });

            if (rpcErr) {
                // Direct fallback
                if (!currentUserId) throw new Error('Not logged in');

                if (initial > 0) {
                    await supabase
                        .from('profiles')
                        .update({ balance: userWalletBalance - initial, updated_at: new Date().toISOString() })
                        .eq('id', currentUserId);

                    await supabase.from('transactions').insert({
                        user_id: currentUserId,
                        type: 'savings_deposit',
                        amount: initial,
                        status: 'completed',
                        description: `Initial funding for ${goalTitle.trim()}`,
                        reference: `SAV-${Date.now()}`,
                    });
                }

                await supabase.from('savings_plans').insert({
                    user_id: currentUserId,
                    title: goalTitle.trim(),
                    target_amount: target,
                    amount_saved: initial,
                    plan_type: selectedPlanType,
                    frequency,
                    apy_rate: selectedConfig.apy,
                    status: 'active',
                    shariah_compliant: selectedPlanType === 'halal' || selectedPlanType === 'gold',
                });
            }

            Alert.alert('Savings Goal Created 🎉', `Your plan "${goalTitle.trim()}" is now active and earning yield!`);
            setGoalTitle('');
            setTargetAmount('');
            setInitialDeposit('');
            setActiveTab('plans');
            fetchSavingsData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Deposit Additional Funds into Selected Plan
    const handleDepositToPlan = async () => {
        if (!selectedPlan) return;
        const amount = parseFloat(depositAmount) || 0;

        if (amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount to save.');
            return;
        }

        if (amount > userWalletBalance) {
            Alert.alert('Insufficient Balance', `Your wallet balance is ₦${userWalletBalance.toLocaleString()}.`);
            return;
        }

        setActionLoading(true);
        try {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('deposit_to_savings', {
                p_plan_id: selectedPlan.id,
                p_amount: amount,
            });

            if (rpcErr) {
                // Direct fallback
                if (!currentUserId) throw new Error('Not logged in');

                await supabase
                    .from('profiles')
                    .update({ balance: userWalletBalance - amount, updated_at: new Date().toISOString() })
                    .eq('id', currentUserId);

                await supabase
                    .from('savings_plans')
                    .update({
                        amount_saved: Number(selectedPlan.amount_saved) + amount,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', selectedPlan.id);

                await supabase.from('transactions').insert({
                    user_id: currentUserId,
                    type: 'savings_deposit',
                    amount: amount,
                    status: 'completed',
                    description: `Deposit to ${selectedPlan.title}`,
                    reference: `SAV-DEP-${Date.now()}`,
                });
            }

            Alert.alert('Funds Saved 💰', `₦${amount.toLocaleString()} added to "${selectedPlan.title}".`);
            setDepositAmount('');
            setSelectedPlan(null);
            fetchSavingsData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Liquidate / Withdraw Plan Back to Wallet Balance
    const handleLiquidatePlan = async () => {
        if (!selectedPlan) return;

        Alert.alert(
            'Withdraw Savings',
            `Are you sure you want to withdraw from "${selectedPlan.title}"? ₦${(Number(selectedPlan.amount_saved) + Number(selectedPlan.accrued_interest || 0)).toLocaleString()} will be credited back to your main wallet balance immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Withdrawal',
                    style: 'default',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const { data: rpcRes, error: rpcErr } = await supabase.rpc('liquidate_savings_plan', {
                                p_plan_id: selectedPlan.id,
                                p_is_admin: false,
                            });

                            if (rpcErr) {
                                if (!currentUserId) throw new Error('Not logged in');
                                const totalRefund = Number(selectedPlan.amount_saved) + Number(selectedPlan.accrued_interest || 0);

                                await supabase
                                    .from('profiles')
                                    .update({ balance: userWalletBalance + totalRefund, updated_at: new Date().toISOString() })
                                    .eq('id', currentUserId);

                                await supabase
                                    .from('savings_plans')
                                    .update({ status: 'liquidated', amount_saved: 0, updated_at: new Date().toISOString() })
                                    .eq('id', selectedPlan.id);

                                await supabase.from('transactions').insert({
                                    user_id: currentUserId,
                                    type: 'savings_withdrawal',
                                    amount: totalRefund,
                                    status: 'completed',
                                    description: `Liquidated savings: ${selectedPlan.title}`,
                                    reference: `SAV-WD-${Date.now()}`,
                                });
                            }

                            Alert.alert('Withdrawal Complete ✅', 'Funds and accrued interest credited to your main wallet.');
                            setSelectedPlan(null);
                            fetchSavingsData();
                        } catch (err: any) {
                            Alert.alert('Error', err.message);
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Target Savings & Vaults',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={onRefresh} style={{ marginRight: 8 }}>
                            <Ionicons name="refresh" size={20} color={T.goldBright} />
                        </TouchableOpacity>
                    ),
                }}
            />
            <StatusBar style="light" />

            {/* Sub Tabs Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    onPress={() => setActiveTab('plans')}
                    style={[styles.tabBtn, activeTab === 'plans' && styles.tabBtnActive]}
                >
                    <Text style={[styles.tabBtnText, activeTab === 'plans' && styles.tabBtnTextActive]}>
                        My Active Plans ({plans.filter(p => p.status === 'active').length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('create')}
                    style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
                >
                    <Text style={[styles.tabBtnText, activeTab === 'create' && styles.tabBtnTextActive]}>
                        + Create New Goal
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={styles.loadingText}>Loading Your Savings Portfolio...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'plans' ? (
                        <View>
                            {/* Total Savings Hero Card */}
                            <LinearGradient colors={[T.navyPrimary, T.navyDeep, T.navyMid]} style={styles.heroCard}>
                                <View style={styles.heroTopRow}>
                                    <View style={styles.heroBadge}>
                                        <Ionicons name="shield-checkmark" size={13} color={T.goldBright} />
                                        <Text style={styles.heroBadgeText}>HIGH-YIELD SAVINGS VAULT</Text>
                                    </View>
                                    <Text style={styles.walletBalanceBadge}>
                                        Wallet: ₦{userWalletBalance.toLocaleString()}
                                    </Text>
                                </View>

                                <Text style={styles.heroTotalSaved}>
                                    ₦ {totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>

                                <View style={styles.heroYieldRow}>
                                    <View style={styles.yieldTag}>
                                        <Ionicons name="trending-up" size={13} color={T.success} />
                                        <Text style={styles.yieldTagText}>
                                            +₦{totalYieldEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })} Accrued Yield
                                        </Text>
                                    </View>
                                    <Text style={styles.heroApyText}>Up to 21% APY</Text>
                                </View>
                            </LinearGradient>

                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Active Savings Goals</Text>
                            </View>

                            {plans.filter(p => p.status === 'active').length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="wallet-outline" size={42} color={T.gold} />
                                    <Text style={styles.emptyStateTitle}>No Active Savings Plans</Text>
                                    <Text style={styles.emptyStateSub}>
                                        Start building your wealth today with high-yield flexible and fixed savings goals.
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setActiveTab('create')}
                                        style={styles.emptyCreateBtn}
                                    >
                                        <Text style={styles.emptyCreateBtnText}>Create Your First Goal</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                plans.filter(p => p.status === 'active').map(plan => {
                                    const progress = plan.target_amount > 0 ? (Number(plan.amount_saved) / Number(plan.target_amount)) : 0;
                                    return (
                                        <TouchableOpacity
                                            key={plan.id}
                                            onPress={() => setSelectedPlan(plan)}
                                            style={styles.planCard}
                                            activeOpacity={0.8}
                                        >
                                            <View style={styles.planHeader}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={styles.planTitle}>{plan.title}</Text>
                                                        {plan.shariah_compliant && (
                                                            <View style={styles.halalBadge}>
                                                                <Text style={styles.halalBadgeText}>HALAL</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={styles.planType}>
                                                        {plan.plan_type.toUpperCase()} • {plan.apy_rate}% APY
                                                    </Text>
                                                </View>
                                                <View style={styles.planSavedWrap}>
                                                    <Text style={styles.planSavedAmount}>
                                                        ₦{Number(plan.amount_saved).toLocaleString()}
                                                    </Text>
                                                    <Text style={styles.planTargetAmount}>
                                                        Goal: ₦{Number(plan.target_amount).toLocaleString()}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.progressTrack}>
                                                <View style={[styles.progressBar, { width: `${Math.min(100, Math.max(3, progress * 100))}%` }]} />
                                            </View>

                                            <View style={styles.planFooter}>
                                                <Text style={styles.planProgressText}>
                                                    {Math.min(100, Math.round(progress * 100))}% Achieved
                                                </Text>
                                                <Text style={styles.planYieldText}>
                                                    Yield: <Text style={{ color: T.success, fontWeight: '800' }}>+₦{Number(plan.accrued_interest || 0).toLocaleString()}</Text>
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    ) : (
                        <View style={styles.createCard}>
                            <Text style={styles.createTitle}>Create a New Savings Goal</Text>
                            <Text style={styles.createSub}>Lock in capital or save flexibly with compounding returns.</Text>

                            <Text style={styles.inputLabel}>Goal Title</Text>
                            <TextInput
                                value={goalTitle}
                                onChangeText={setGoalTitle}
                                placeholder="e.g. New Car, Rent, Tuition, Hajj"
                                placeholderTextColor={T.textMuted}
                                style={styles.input}
                            />

                            <Text style={styles.inputLabel}>Target Amount (₦)</Text>
                            <TextInput
                                value={targetAmount}
                                onChangeText={setTargetAmount}
                                placeholder="e.g. 500,000"
                                placeholderTextColor={T.textMuted}
                                keyboardType="numeric"
                                style={styles.input}
                            />

                            <Text style={styles.inputLabel}>Initial Deposit from Wallet (₦)</Text>
                            <TextInput
                                value={initialDeposit}
                                onChangeText={setInitialDeposit}
                                placeholder={`e.g. 5,000 (Wallet: ₦${userWalletBalance.toLocaleString()})`}
                                placeholderTextColor={T.textMuted}
                                keyboardType="numeric"
                                style={styles.input}
                            />

                            <Text style={styles.inputLabel}>Select Yield Program</Text>
                            <View style={styles.planTypesGrid}>
                                {[
                                    { type: 'flexible', label: 'FlexiSave', apy: '9.5% APY', desc: 'Anytime withdrawal' },
                                    { type: 'fixed_30', label: 'Fixed 30d', apy: '14.0% APY', desc: 'Locked for 30 days' },
                                    { type: 'halal', label: 'Al-Barakah', apy: '12.0% Profit', desc: '100% Shariah Halal' },
                                    { type: 'gold', label: 'Gold Vault', apy: '8.0% + Gold', desc: '24K Gold hedge' },
                                ].map(p => (
                                    <TouchableOpacity
                                        key={p.type}
                                        onPress={() => setSelectedPlanType(p.type as any)}
                                        style={[styles.planTypeItem, selectedPlanType === p.type && styles.planTypeItemActive]}
                                    >
                                        <Text style={[styles.planTypeTitle, selectedPlanType === p.type && styles.planTypeTitleActive]}>
                                            {p.label}
                                        </Text>
                                        <Text style={styles.planTypeApy}>{p.apy}</Text>
                                        <Text style={styles.planTypeDesc}>{p.desc}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={handleCreatePlan}
                                disabled={submitting}
                                style={styles.createBtn}
                                activeOpacity={0.85}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={18} color={T.goldBright} />
                                        <Text style={styles.createBtnText}>Start Savings Goal</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* ========================================================================= */}
            {/* MODAL: MANAGE SELECTED SAVINGS PLAN                                       */}
            {/* ========================================================================= */}
            <Modal
                visible={!!selectedPlan}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedPlan(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Manage Savings Goal</Text>
                            <TouchableOpacity onPress={() => setSelectedPlan(null)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedPlan && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalHero}>
                                    <Text style={styles.modalGoalTitle}>{selectedPlan.title}</Text>
                                    <Text style={styles.modalGoalSaved}>
                                        ₦{Number(selectedPlan.amount_saved).toLocaleString()}
                                    </Text>
                                    <Text style={styles.modalGoalTarget}>
                                        Target: ₦{Number(selectedPlan.target_amount).toLocaleString()} • {selectedPlan.apy_rate}% APY
                                    </Text>
                                </View>

                                <Text style={styles.inputLabel}>Deposit Funds from Wallet (₦)</Text>
                                <Text style={styles.subLabel}>Available Wallet Balance: ₦{userWalletBalance.toLocaleString()}</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    <TextInput
                                        value={depositAmount}
                                        onChangeText={setDepositAmount}
                                        placeholder="e.g. 5000"
                                        placeholderTextColor={T.textMuted}
                                        keyboardType="numeric"
                                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                    />
                                    <TouchableOpacity
                                        onPress={handleDepositToPlan}
                                        disabled={actionLoading}
                                        style={styles.depositBtn}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.depositBtnText}>Deposit</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={handleLiquidatePlan}
                                    disabled={actionLoading}
                                    style={styles.withdrawBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="arrow-down-circle-outline" size={17} color="#FFFFFF" />
                                    <Text style={styles.withdrawBtnText}>Withdraw All to Wallet</Text>
                                </TouchableOpacity>
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
        marginTop: 10,
        fontSize: 12.5,
        fontWeight: '700',
        color: T.textSub,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: T.navyDeep,
    },
    tabBtnActive: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
        borderColor: T.gold,
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.textMuted,
    },
    tabBtnTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    scrollContent: {
        padding: 14,
        paddingBottom: 40,
    },
    heroCard: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroBadgeText: {
        color: T.goldBright,
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 1,
    },
    walletBalanceBadge: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '700',
    },
    heroTotalSaved: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        marginVertical: 4,
    },
    heroYieldRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    yieldTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(5, 150, 105, 0.18)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(5, 150, 105, 0.3)',
    },
    yieldTagText: {
        color: '#34D399',
        fontSize: 11,
        fontWeight: '800',
    },
    heroApyText: {
        color: T.goldBright,
        fontSize: 11,
        fontWeight: '800',
    },
    sectionHeader: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: T.border,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    planTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    halalBadge: {
        backgroundColor: T.successBg,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    halalBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: T.success,
    },
    planType: {
        fontSize: 10,
        color: T.textMuted,
        fontWeight: '700',
        marginTop: 2,
    },
    planSavedWrap: {
        alignItems: 'flex-end',
    },
    planSavedAmount: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    planTargetAmount: {
        fontSize: 9.5,
        color: T.textMuted,
        marginTop: 1,
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
    planFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    planProgressText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: T.textSub,
    },
    planYieldText: {
        fontSize: 10.5,
        color: T.textMuted,
    },
    emptyState: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: T.border,
        marginTop: 10,
    },
    emptyStateTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
        marginTop: 8,
    },
    emptyStateSub: {
        fontSize: 11,
        color: T.textMuted,
        textAlign: 'center',
        marginTop: 2,
        marginBottom: 12,
    },
    emptyCreateBtn: {
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    emptyCreateBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    createCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: T.border,
    },
    createTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: T.navyPrimary,
        marginBottom: 2,
    },
    createSub: {
        fontSize: 11,
        color: T.textMuted,
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.navyPrimary,
        marginTop: 6,
        marginBottom: 4,
    },
    subLabel: {
        fontSize: 10,
        color: T.textMuted,
        marginBottom: 4,
    },
    input: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 8,
    },
    planTypesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 14,
    },
    planTypeItem: {
        width: (width - 64) / 2,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: T.border,
    },
    planTypeItemActive: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
    },
    planTypeTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: T.navyPrimary,
    },
    planTypeTitleActive: {
        color: T.goldDark,
        fontWeight: '900',
    },
    planTypeApy: {
        fontSize: 10,
        fontWeight: '900',
        color: T.success,
        marginTop: 2,
    },
    planTypeDesc: {
        fontSize: 9,
        color: T.textMuted,
        marginTop: 2,
    },
    createBtn: {
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
    createBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
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
        maxHeight: '80%',
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
    modalHero: {
        backgroundColor: T.navyPrimary,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    modalGoalTitle: {
        color: T.goldBright,
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 2,
    },
    modalGoalSaved: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 2,
    },
    modalGoalTarget: {
        color: '#94A3B8',
        fontSize: 11,
    },
    depositBtn: {
        backgroundColor: T.gold,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    depositBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 12,
    },
    withdrawBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 6,
        marginBottom: 16,
    },
    withdrawBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
});
