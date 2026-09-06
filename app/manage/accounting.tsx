import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Platform,
    RefreshControl,
    Dimensions
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ErrorBoundary from '../../components/ErrorBoundary';
import {
    checkProfitAccessClearance,
    calculateAccountingMetrics,
    fetchExpenses,
    recordExpense,
    deleteExpense,
    generateProfitLossPDF,
    formatNaira,
    formatAccountingDate,
    AccountingMetrics,
    ExpenseRecord,
    EXPENSE_CATEGORIES,
    PAYMENT_METHODS
} from '../../services/accounting';

const { width } = Dimensions.get('window');

// Brand Colors
const C = {
    navyDark: '#060B18',
    navy: '#0F172A',
    navyMid: '#1E293B',
    navyLight: '#334155',
    gold: '#D97706',
    goldLight: '#F59E0B',
    goldBg: 'rgba(245, 158, 11, 0.12)',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.12)',
    coral: '#EF4444',
    coralBg: 'rgba(239, 68, 68, 0.12)',
    blue: '#3B82F6',
    blueBg: 'rgba(59, 130, 246, 0.12)',
    white: '#FFFFFF',
    textMuted: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    cardBg: '#0F172A',
};

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export default function AccountingScreen() {
    return (
        <ErrorBoundary fallbackTitle="Accounting Hub Notice" fallbackSubtitle="An unexpected issue occurred while calculating financial records.">
            <AccountingContent />
        </ErrorBoundary>
    );
}

function AccountingContent() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Clearance & Access States
    const [authLoading, setAuthLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    // Dashboard Data & Filters
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('month');
    const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'breakdown'>('overview');

    // Financial Metrics
    const [metrics, setMetrics] = useState<AccountingMetrics | null>(null);

    // Add Expense Modal
    const [addExpenseVisible, setAddExpenseVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newCategory, setNewCategory] = useState(EXPENSE_CATEGORIES[0].id);
    const [newPaymentMethod, setNewPaymentMethod] = useState(PAYMENT_METHODS[0].id);
    const [newNotes, setNewNotes] = useState('');
    const [savingExpense, setSavingExpense] = useState(false);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

    // 1. Verify Super Admin Access Clearance
    useEffect(() => {
        let isMounted = true;
        const verifyClearance = async () => {
            setAuthLoading(true);
            const clearance = await checkProfitAccessClearance();
            if (isMounted) {
                setIsSuperAdmin(clearance.authorized);
                setUserEmail(clearance.email);
                setAuthLoading(false);
            }
        };
        verifyClearance();
        return () => { isMounted = false; };
    }, []);

    // 2. Compute date boundaries for selected TimeRange
    const getDateRange = (range: TimeRange): { start?: Date; end?: Date; label: string } => {
        const now = new Date();
        if (range === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            return { start, label: 'Today (Yau)' };
        } else if (range === 'yesterday') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
            return { start, end, label: 'Yesterday (Jiya)' };
        } else if (range === 'week') {
            const dayOfWeek = now.getDay();
            const distance = (dayOfWeek + 6) % 7; // Monday start
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distance, 0, 0, 0);
            return { start, label: 'This Week (Wannan Satin)' };
        } else if (range === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            return { start, label: 'This Month (Wannan Watan)' };
        }
        return { label: 'All Time (Gaba Daya)' };
    };

    // 3. Load accounting data from Supabase
    const loadAccountingData = useCallback(async () => {
        try {
            const { start, end } = getDateRange(timeRange);
            const data = await calculateAccountingMetrics(start, end);
            setMetrics(data);
        } catch (err) {
            console.error('[Accounting UI] Error loading metrics:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [timeRange]);

    useEffect(() => {
        if (isSuperAdmin) {
            setLoading(true);
            loadAccountingData();
        }
    }, [isSuperAdmin, timeRange, loadAccountingData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAccountingData();
    };

    // 4. Handle Expense Creation
    const handleSaveExpense = async () => {
        if (!newTitle.trim()) {
            Alert.alert('Required', 'Please enter a description for this expense.');
            return;
        }
        const amt = parseFloat(newAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid expense amount in Naira.');
            return;
        }

        setSavingExpense(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const res = await recordExpense({
            title: newTitle,
            amount: amt,
            category: newCategory,
            payment_method: newPaymentMethod,
            notes: newNotes,
        });

        setSavingExpense(false);

        if (res.success) {
            Alert.alert('Recorded', `Expense of ${formatNaira(amt)} has been recorded.`);
            setAddExpenseVisible(false);
            setNewTitle('');
            setNewAmount('');
            setNewNotes('');
            loadAccountingData();
        } else {
            Alert.alert('Save Error', res.error || 'Could not record expense.');
        }
    };

    // 5. Handle Expense Deletion
    const handleDeleteExpense = (expense: ExpenseRecord) => {
        Alert.alert(
            'Delete Expense',
            `Are you sure you want to delete "${expense.title}" (${formatNaira(expense.amount)})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const res = await deleteExpense(expense.id);
                        if (res.success) {
                            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            loadAccountingData();
                        } else {
                            Alert.alert('Error', res.error || 'Failed to delete expense.');
                        }
                    }
                }
            ]
        );
    };

    // 6. Handle Export Report
    const handleExport = async () => {
        if (!metrics) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { label } = getDateRange(timeRange);
        await generateProfitLossPDF(metrics, label);
    };

    // --- ACCESS DENIED SCREEN FOR NON-SUPER-ADMIN ---
    if (authLoading) {
        return (
            <View style={[styles.centerBox, { backgroundColor: C.navyDark }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={C.gold} />
                <Text style={styles.verifyingText}>VERIFYING SUPER ADMIN CLEARANCE...</Text>
            </View>
        );
    }

    if (!isSuperAdmin) {
        return (
            <View style={[styles.deniedContainer, { paddingTop: Math.max(insets.top, 40) }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.deniedCard}>
                    <View style={styles.deniedIconCircle}>
                        <Ionicons name="shield-outline" size={48} color={C.coral} />
                    </View>
                    <Text style={styles.deniedTitle}>SUPER ADMIN CLEARANCE REQUIRED</Text>
                    <Text style={styles.deniedSub}>
                        Baka da cikakken izinin shiga wannan sashen. Lissafin Riba da Kashe-kashe (Profits & Expenses Ledger) an ware shi ne don babban Super Admin kawai.
                    </Text>
                    <View style={styles.deniedAccountBadge}>
                        <Ionicons name="person-outline" size={13} color={C.textMuted} />
                        <Text style={styles.deniedAccountEmail}>{userEmail || 'Unauthorized Account'}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.replace('/manage')}
                        style={styles.deniedReturnBtn}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={[C.gold, '#B45309']} style={styles.deniedReturnGrad}>
                            <Ionicons name="arrow-back" size={16} color={C.navyDark} />
                            <Text style={styles.deniedReturnText}>Return to Management</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const isNetProfitable = (metrics?.netProfit || 0) >= 0;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* EXECUTIVE APP BAR */}
            <LinearGradient
                colors={[C.navyDark, C.navy]}
                style={[styles.headerBar, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 38 : 20) + 6 }]}
            >
                <View style={styles.headerTopRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={18} color={C.white} />
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="calculator" size={16} color={C.gold} />
                            <Text style={styles.headerTitle}>Riba & Kashe-kashe</Text>
                        </View>
                        <Text style={styles.headerSub}>EXECUTIVE PROFIT & EXPENSE HUB</Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleExport}
                        style={styles.exportBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="share-outline" size={18} color={C.gold} />
                    </TouchableOpacity>
                </View>

                {/* TIMEFRAME SELECTOR PILLS */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timeFilterContainer}
                >
                    {(['today', 'yesterday', 'week', 'month', 'all'] as TimeRange[]).map((r) => {
                        const labels: Record<TimeRange, string> = {
                            today: 'Yau (Today)',
                            yesterday: 'Jiya',
                            week: 'Satin Nan',
                            month: 'Watan Nan',
                            all: 'Gaba Daya'
                        };
                        const active = timeRange === r;
                        return (
                            <TouchableOpacity
                                key={r}
                                onPress={() => {
                                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                                    setTimeRange(r);
                                }}
                                style={[styles.timePill, active && styles.timePillActive]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.timePillText, active && styles.timePillTextActive]}>
                                    {labels[r]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* VIEW TABS SWITCHER */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('overview')}
                        style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
                    >
                        <Ionicons name="stats-chart" size={12} color={activeTab === 'overview' ? C.gold : C.textMuted} />
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('expenses')}
                        style={[styles.tabItem, activeTab === 'expenses' && styles.tabItemActive]}
                    >
                        <Ionicons name="wallet" size={12} color={activeTab === 'expenses' ? C.coral : C.textMuted} />
                        <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
                            Kashe-kashe ({metrics?.expensesCount || 0})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('breakdown')}
                        style={[styles.tabItem, activeTab === 'breakdown' && styles.tabItemActive]}
                    >
                        <Ionicons name="pie-chart" size={12} color={activeTab === 'breakdown' ? C.blue : C.textMuted} />
                        <Text style={[styles.tabText, activeTab === 'breakdown' && styles.tabTextActive]}>Services</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* MAIN DASHBOARD CONTENT */}
            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={C.gold} />
                    <Text style={styles.loadingDataText}>Lissafa Riba da Kashe-kashe...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
                >
                    {/* 1. MASTER NET PROFIT HERO CARD */}
                    <LinearGradient
                        colors={isNetProfitable ? ['#052E16', '#022C22', '#064E3B'] : ['#450A0A', '#2C0A0A', '#370A0A']}
                        style={[styles.netProfitCard, { borderColor: isNetProfitable ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)' }]}
                    >
                        <View style={styles.netProfitTopRow}>
                            <View style={[styles.badgePill, { backgroundColor: isNetProfitable ? C.emeraldBg : C.coralBg }]}>
                                <Ionicons name={isNetProfitable ? "trending-up" : "trending-down"} size={12} color={isNetProfitable ? C.emerald : C.coral} />
                                <Text style={[styles.badgeText, { color: isNetProfitable ? C.emerald : C.coral }]}>
                                    {isNetProfitable ? 'NET PROFITABLE' : 'NET DEFICIT'}
                                </Text>
                            </View>
                            <View style={[styles.badgePill, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                <Ionicons name="pie-chart" size={11} color={C.gold} />
                                <Text style={[styles.badgeText, { color: C.gold }]}>
                                    {metrics?.profitMargin ? metrics.profitMargin.toFixed(1) : '0.0'}% MARGIN
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.netProfitLabel}>RIBA TA ASALI (NET PROFIT)</Text>
                        <Text style={[styles.netProfitValue, { color: isNetProfitable ? '#34D399' : '#F87171' }]}>
                            {formatNaira(metrics?.netProfit || 0)}
                        </Text>
                        <Text style={styles.netProfitSub}>
                            Gross Profit ({formatNaira(metrics?.grossProfit || 0)}) − Total Expenses ({formatNaira(metrics?.totalExpenses || 0)})
                        </Text>
                    </LinearGradient>

                    {/* 2. 4 SECONDARY METRIC CARDS */}
                    <View style={styles.metricsGrid}>
                        {/* Gross Revenue */}
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconWrap, { backgroundColor: C.blueBg }]}>
                                <Ionicons name="cart" size={14} color={C.blue} />
                            </View>
                            <Text style={styles.metricLabel}>Jimillar Ciniki</Text>
                            <Text style={styles.metricValue}>{formatNaira(metrics?.totalRevenue || 0)}</Text>
                            <Text style={styles.metricHint}>{metrics?.successfulTransactionsCount || 0} Successful Sales</Text>
                        </View>

                        {/* Cost of Sales (API Costs) */}
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(148, 163, 184, 0.12)' }]}>
                                <Ionicons name="cube" size={14} color={C.textMuted} />
                            </View>
                            <Text style={styles.metricLabel}>Kudin Kaya (API)</Text>
                            <Text style={[styles.metricValue, { color: C.textMuted }]}>{formatNaira(metrics?.totalCost || 0)}</Text>
                            <Text style={styles.metricHint}>Paid to Providers</Text>
                        </View>

                        {/* Gross Profit */}
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconWrap, { backgroundColor: C.emeraldBg }]}>
                                <Ionicons name="sparkles" size={14} color={C.emerald} />
                            </View>
                            <Text style={styles.metricLabel}>Jimillar Riba</Text>
                            <Text style={[styles.metricValue, { color: C.emerald }]}>{formatNaira(metrics?.grossProfit || 0)}</Text>
                            <Text style={styles.metricHint}>Before Expenses</Text>
                        </View>

                        {/* Total Expenses */}
                        <View style={styles.metricCard}>
                            <View style={[styles.metricIconWrap, { backgroundColor: C.coralBg }]}>
                                <Ionicons name="arrow-down-circle" size={14} color={C.coral} />
                            </View>
                            <Text style={styles.metricLabel}>Kashe-kashe</Text>
                            <Text style={[styles.metricValue, { color: C.coral }]}>{formatNaira(metrics?.totalExpenses || 0)}</Text>
                            <Text style={styles.metricHint}>{metrics?.expensesCount || 0} Expenditures</Text>
                        </View>
                    </View>

                    {/* 3. TAB SPECIFIC SECTIONS */}
                    {activeTab === 'overview' && (
                        <View style={styles.sectionContainer}>
                            {/* Top Service Earners */}
                            <View style={styles.sectionHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="trophy" size={14} color={C.gold} />
                                    <Text style={styles.sectionTitle}>Kowanne Fanni & Ribarsa</Text>
                                </View>
                                <Text style={styles.sectionSubTitle}>Top Profit Earners</Text>
                            </View>

                            {metrics?.serviceBreakdown && Object.values(metrics.serviceBreakdown)
                                .filter(s => s.revenue > 0 || s.profit > 0)
                                .sort((a, b) => b.profit - a.profit)
                                .map((serv, idx) => (
                                    <View key={serv.type || idx} style={styles.serviceRow}>
                                        <View style={styles.serviceIconCircle}>
                                            <Ionicons
                                                name={serv.type === 'data' ? 'wifi' : serv.type === 'airtime' ? 'call' : serv.type === 'electricity' ? 'flash' : serv.type === 'tv' ? 'tv' : 'receipt'}
                                                size={16}
                                                color={C.gold}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                                            <Text style={styles.serviceName}>{serv.serviceName}</Text>
                                            <Text style={styles.serviceMeta}>
                                                {serv.transactionCount} sales • Turn over: {formatNaira(serv.revenue)}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.serviceProfit}>{formatNaira(serv.profit)}</Text>
                                            <View style={styles.serviceMarginBadge}>
                                                <Text style={styles.serviceMarginText}>{serv.marginPercent.toFixed(1)}% Riba</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}

                            {/* Quick Action to Record Expense */}
                            <TouchableOpacity
                                onPress={() => setAddExpenseVisible(true)}
                                style={styles.quickAddExpenseBanner}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={[C.navyMid, C.navyDark]} style={styles.quickAddExpenseGrad}>
                                    <View style={styles.quickAddIconCircle}>
                                        <Ionicons name="add" size={20} color={C.gold} />
                                    </View>
                                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                                        <Text style={styles.quickAddTitle}>Shigar da Sabon Kashe-Kudi</Text>
                                        <Text style={styles.quickAddSub}>Record hosting, API top-up, salaries, or marketing</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={C.gold} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeTab === 'expenses' && (
                        <View style={styles.sectionContainer}>
                            {/* Expense Action Header */}
                            <View style={styles.expenseActionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>Tattara Kashe-kashe (Expenses)</Text>
                                    <Text style={styles.sectionSubTitle}>Jimilla: {formatNaira(metrics?.totalExpenses || 0)}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setAddExpenseVisible(true)}
                                    style={styles.addExpenseBtn}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={[C.coral, '#B91C1C']} style={styles.addExpenseGrad}>
                                        <Ionicons name="add-circle" size={14} color={C.white} />
                                        <Text style={styles.addExpenseBtnText}>+ Add Expense</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* Expense Category Filters */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expFilterBar}>
                                <TouchableOpacity
                                    onPress={() => setSelectedCategoryFilter('all')}
                                    style={[styles.expFilterPill, selectedCategoryFilter === 'all' && styles.expFilterPillActive]}
                                >
                                    <Text style={[styles.expFilterText, selectedCategoryFilter === 'all' && styles.expFilterTextActive]}>All</Text>
                                </TouchableOpacity>
                                {EXPENSE_CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        onPress={() => setSelectedCategoryFilter(cat.id)}
                                        style={[styles.expFilterPill, selectedCategoryFilter === cat.id && styles.expFilterPillActive]}
                                    >
                                        <Text style={[styles.expFilterText, selectedCategoryFilter === cat.id && styles.expFilterTextActive]}>{cat.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Expenses List */}
                            {metrics?.recentExpenses && metrics.recentExpenses.length > 0 ? (
                                metrics.recentExpenses
                                    .filter(e => selectedCategoryFilter === 'all' || e.category === selectedCategoryFilter)
                                    .map((exp) => {
                                        const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category) || EXPENSE_CATEGORIES[7];
                                        return (
                                            <View key={exp.id} style={styles.expenseItemRow}>
                                                <View style={[styles.expenseIconCircle, { backgroundColor: catObj.color + '22' }]}>
                                                    <Ionicons name={catObj.icon as any} size={16} color={catObj.color} />
                                                </View>
                                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                    <Text style={styles.expenseTitle}>{exp.title}</Text>
                                                    <Text style={styles.expenseMeta}>
                                                        {catObj.label} • {formatAccountingDate(exp.expense_date)} • {exp.payment_method.replace('_', ' ')}
                                                    </Text>
                                                    {exp.notes ? <Text style={styles.expenseNotes}>{exp.notes}</Text> : null}
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.expenseAmount}>-{formatNaira(exp.amount)}</Text>
                                                    <TouchableOpacity
                                                        onPress={() => handleDeleteExpense(exp)}
                                                        style={styles.deleteExpenseBtn}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Ionicons name="trash-outline" size={13} color={C.coral} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })
                            ) : (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="wallet-outline" size={32} color={C.textMuted} />
                                    <Text style={styles.emptyTitle}>Babu Kashe-kudi a Wannan Lokacin</Text>
                                    <Text style={styles.emptySub}>Danna maballin "+ Add Expense" a sama don shigar da sabon kashe kudi.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'breakdown' && (
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Cikakken Rahoton Riba na Kowacce Sana'a</Text>
                                <Text style={styles.sectionSubTitle}>Detailed Breakdown</Text>
                            </View>

                            {metrics?.serviceBreakdown && Object.values(metrics.serviceBreakdown).map((serv) => (
                                <View key={serv.type} style={styles.breakdownCard}>
                                    <View style={styles.breakdownCardHeader}>
                                        <Text style={styles.breakdownServiceName}>{serv.serviceName}</Text>
                                        <View style={styles.breakdownTag}>
                                            <Text style={styles.breakdownTagText}>{serv.transactionCount} Sales</Text>
                                        </View>
                                    </View>

                                    <View style={styles.breakdownGrid}>
                                        <View style={styles.breakdownCol}>
                                            <Text style={styles.breakdownColLabel}>Revenue (Ciniki)</Text>
                                            <Text style={styles.breakdownColVal}>{formatNaira(serv.revenue)}</Text>
                                        </View>
                                        <View style={styles.breakdownCol}>
                                            <Text style={styles.breakdownColLabel}>Cost (Kudin API)</Text>
                                            <Text style={[styles.breakdownColVal, { color: C.textMuted }]}>{formatNaira(serv.cost)}</Text>
                                        </View>
                                        <View style={styles.breakdownCol}>
                                            <Text style={styles.breakdownColLabel}>Profit (Riba)</Text>
                                            <Text style={[styles.breakdownColVal, { color: C.emerald }]}>{formatNaira(serv.profit)}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* MODAL: RECORD NEW EXPENSE */}
            <Modal
                visible={addExpenseVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setAddExpenseVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.modalIconWrap}>
                                    <Ionicons name="receipt" size={16} color={C.gold} />
                                </View>
                                <Text style={styles.modalTitle}>Shigar da Kashe-Kudi</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAddExpenseVisible(false)}>
                                <Ionicons name="close" size={20} color={C.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                            {/* Title */}
                            <Text style={styles.inputLabel}>Bayani / Sunan Abin da aka biya *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Misali: Top-up a BilalSadaSub API"
                                placeholderTextColor={C.textMuted}
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            {/* Amount */}
                            <Text style={styles.inputLabel}>Adadin Kudi (₦) *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="0.00"
                                placeholderTextColor={C.textMuted}
                                keyboardType="numeric"
                                value={newAmount}
                                onChangeText={setNewAmount}
                            />

                            {/* Category Selector */}
                            <Text style={styles.inputLabel}>Bangaren Kashe Kudi *</Text>
                            <View style={styles.catGrid}>
                                {EXPENSE_CATEGORIES.map((cat) => {
                                    const isSelected = newCategory === cat.id;
                                    return (
                                        <TouchableOpacity
                                            key={cat.id}
                                            onPress={() => setNewCategory(cat.id)}
                                            style={[styles.catOption, isSelected && styles.catOptionSelected]}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={cat.icon as any} size={12} color={isSelected ? C.gold : C.textMuted} />
                                            <Text style={[styles.catOptionText, isSelected && styles.catOptionTextSelected]}>
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Payment Method */}
                            <Text style={styles.inputLabel}>Hanyar Biya</Text>
                            <View style={styles.paymentMethodRow}>
                                {PAYMENT_METHODS.map((method) => {
                                    const isSelected = newPaymentMethod === method.id;
                                    return (
                                        <TouchableOpacity
                                            key={method.id}
                                            onPress={() => setNewPaymentMethod(method.id)}
                                            style={[styles.payMethodPill, isSelected && styles.payMethodPillActive]}
                                        >
                                            <Text style={[styles.payMethodText, isSelected && styles.payMethodTextActive]}>
                                                {method.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Notes */}
                            <Text style={styles.inputLabel}>Karin Bayani (Na Zabi)</Text>
                            <TextInput
                                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                                placeholder="Karin bayani kan wannan biyan..."
                                placeholderTextColor={C.textMuted}
                                multiline
                                value={newNotes}
                                onChangeText={setNewNotes}
                            />
                        </ScrollView>

                        {/* Submit Button */}
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity
                                onPress={() => setAddExpenseVisible(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSaveExpense}
                                style={styles.modalSaveBtn}
                                disabled={savingExpense}
                            >
                                <LinearGradient colors={[C.gold, '#B45309']} style={styles.modalSaveGrad}>
                                    {savingExpense ? (
                                        <ActivityIndicator size="small" color={C.navyDark} />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={16} color={C.navyDark} />
                                            <Text style={styles.modalSaveText}>Record Expense</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.navyDark,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    verifyingText: {
        color: C.gold,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
        marginTop: 14,
    },
    loadingDataText: {
        color: C.textMuted,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 10,
    },

    // Access Denied Screen
    deniedContainer: {
        flex: 1,
        backgroundColor: C.navyDark,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    deniedCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: C.cardBg,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    deniedIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: C.coralBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    deniedTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
        textAlign: 'center',
        marginBottom: 8,
    },
    deniedSub: {
        color: C.textMuted,
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 16,
    },
    deniedAccountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 20,
    },
    deniedAccountEmail: {
        color: C.textMuted,
        fontSize: 11,
        fontWeight: '600',
    },
    deniedReturnBtn: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
    },
    deniedReturnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    deniedReturnText: {
        color: C.navyDark,
        fontSize: 13,
        fontWeight: '900',
    },

    // Header Bar
    headerBar: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderBottomWidth: 1,
        borderColor: C.border,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    headerTitle: {
        color: C.white,
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    headerSub: {
        color: C.gold,
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginTop: 1,
    },
    exportBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },

    // Time filter pills
    timeFilterContainer: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 6,
    },
    timePill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: C.border,
    },
    timePillActive: {
        backgroundColor: C.goldBg,
        borderColor: C.gold,
    },
    timePillText: {
        color: C.textMuted,
        fontSize: 11,
        fontWeight: '700',
    },
    timePillTextActive: {
        color: C.gold,
        fontWeight: '900',
    },

    // Tabs
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        borderRadius: 12,
        padding: 3,
        marginTop: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        borderRadius: 9,
        gap: 5,
    },
    tabItemActive: {
        backgroundColor: C.cardBg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    tabText: {
        color: C.textMuted,
        fontSize: 11,
        fontWeight: '700',
    },
    tabTextActive: {
        color: C.white,
        fontWeight: '900',
    },

    // Scroll content
    scrollContent: {
        padding: 16,
    },

    // Master Net Profit Hero Card
    netProfitCard: {
        borderRadius: 20,
        padding: 18,
        borderWidth: 1.5,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    netProfitTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    netProfitLabel: {
        color: C.textMuted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    netProfitValue: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginVertical: 4,
    },
    netProfitSub: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 10,
        fontWeight: '600',
    },

    // 4 Metrics Grid
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    metricCard: {
        width: (width - 42) / 2,
        backgroundColor: C.cardBg,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    metricIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    metricLabel: {
        color: C.textMuted,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    metricValue: {
        color: C.white,
        fontSize: 15,
        fontWeight: '900',
        marginVertical: 2,
    },
    metricHint: {
        color: C.textMuted,
        fontSize: 9,
        fontWeight: '600',
    },

    // Section styling
    sectionContainer: {
        backgroundColor: C.cardBg,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
        marginBottom: 10,
    },
    sectionTitle: {
        color: C.white,
        fontSize: 12.5,
        fontWeight: '900',
    },
    sectionSubTitle: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
    },

    // Service Row
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    },
    serviceIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceName: {
        color: C.white,
        fontSize: 12,
        fontWeight: '800',
    },
    serviceMeta: {
        color: C.textMuted,
        fontSize: 9.5,
        marginTop: 2,
    },
    serviceProfit: {
        color: C.emerald,
        fontSize: 13,
        fontWeight: '900',
    },
    serviceMarginBadge: {
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
        marginTop: 2,
    },
    serviceMarginText: {
        color: C.emerald,
        fontSize: 8.5,
        fontWeight: '800',
    },

    // Quick Add Expense Banner
    quickAddExpenseBanner: {
        marginTop: 14,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    quickAddExpenseGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    quickAddIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickAddTitle: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: '800',
    },
    quickAddSub: {
        color: C.textMuted,
        fontSize: 9,
        marginTop: 2,
    },

    // Expenses Tab Styles
    expenseActionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    addExpenseBtn: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    addExpenseGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 5,
    },
    addExpenseBtnText: {
        color: C.white,
        fontSize: 11,
        fontWeight: '800',
    },
    expFilterBar: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 8,
    },
    expFilterPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: C.border,
    },
    expFilterPillActive: {
        backgroundColor: C.coralBg,
        borderColor: C.coral,
    },
    expFilterText: {
        color: C.textMuted,
        fontSize: 10,
        fontWeight: '700',
    },
    expFilterTextActive: {
        color: C.coral,
        fontWeight: '900',
    },
    expenseItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    expenseIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expenseTitle: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: '800',
    },
    expenseMeta: {
        color: C.textMuted,
        fontSize: 9,
        marginTop: 2,
    },
    expenseNotes: {
        color: C.gold,
        fontSize: 9,
        marginTop: 2,
        fontStyle: 'italic',
    },
    expenseAmount: {
        color: C.coral,
        fontSize: 12.5,
        fontWeight: '900',
    },
    deleteExpenseBtn: {
        marginTop: 4,
        padding: 2,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
    },
    emptyTitle: {
        color: C.white,
        fontSize: 12,
        fontWeight: '800',
        marginTop: 8,
    },
    emptySub: {
        color: C.textMuted,
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 20,
    },

    // Breakdown Cards
    breakdownCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    breakdownCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    breakdownServiceName: {
        color: C.white,
        fontSize: 12,
        fontWeight: '800',
    },
    breakdownTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    breakdownTagText: {
        color: C.gold,
        fontSize: 9,
        fontWeight: '800',
    },
    breakdownGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    breakdownCol: {
        flex: 1,
    },
    breakdownColLabel: {
        color: C.textMuted,
        fontSize: 9,
        fontWeight: '700',
    },
    breakdownColVal: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: '900',
        marginTop: 2,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: C.cardBg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 14,
    },
    modalIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: '900',
    },
    inputLabel: {
        color: C.textMuted,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 10,
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: C.white,
        fontSize: 13,
        fontWeight: '600',
    },
    catGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    catOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: C.border,
    },
    catOptionSelected: {
        backgroundColor: C.goldBg,
        borderColor: C.gold,
    },
    catOptionText: {
        color: C.textMuted,
        fontSize: 9.5,
        fontWeight: '700',
    },
    catOptionTextSelected: {
        color: C.gold,
        fontWeight: '900',
    },
    paymentMethodRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    payMethodPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: C.border,
    },
    payMethodPillActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: C.blue,
    },
    payMethodText: {
        color: C.textMuted,
        fontSize: 10,
        fontWeight: '700',
    },
    payMethodTextActive: {
        color: C.blue,
        fontWeight: '900',
    },
    modalBtnRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelText: {
        color: C.textMuted,
        fontSize: 12,
        fontWeight: '700',
    },
    modalSaveBtn: {
        flex: 2,
        borderRadius: 12,
        overflow: 'hidden',
    },
    modalSaveGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    modalSaveText: {
        color: C.navyDark,
        fontSize: 12.5,
        fontWeight: '900',
    },
});
