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
    Dimensions,
    useWindowDimensions,
    Switch
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import ErrorBoundary from '../../components/ErrorBoundary';
import {
    checkProfitAccessClearance,
    getAdminsWithProfitClearance,
    toggleAdminProfitClearance,
    calculateAccountingMetrics,
    fetchExpenses,
    recordExpense,
    deleteExpense,
    generateProfitLossPDF,
    exportFinancialCSV,
    getFinancialHealthAdvisory,
    formatNaira,
    formatAccountingDate,
    AccountingMetrics,
    ExpenseRecord,
    AdminClearanceInfo,
    FinancialHealthAdvisory,
    EXPENSE_CATEGORIES,
    PAYMENT_METHODS
} from '../../services/accounting';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Executive Navy & Gold Theme (Light Background)
const C = {
    bg: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    navyDark: '#0A1128',
    navy: '#0F172A',
    navyMid: '#1E293B',
    navyLight: '#334155',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldLight: '#FFFBEB',
    goldBg: 'rgba(245, 158, 11, 0.12)',
    goldBorder: '#FDE68A',
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    coral: '#DC2626',
    coralBg: '#FEF2F2',
    coralBorder: '#FECACA',
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    white: '#FFFFFF',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
};

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'year' | 'all';
type TabType = 'overview' | 'services' | 'expenses' | 'transactions';

const getServiceMeta = (type: string) => {
    switch (type) {
        case 'social_boost':
            return { icon: 'rocket', color: '#EC4899', bg: '#FDF2F8', label: 'Social Boost & SMM' };
        case 'cac':
            return { icon: 'business', color: '#6366F1', bg: '#EEF2FF', label: 'CAC Registration' };
        case 'nin':
            return { icon: 'finger-print', color: '#059669', bg: '#ECFDF5', label: 'NIN Verification' };
        case 'bvn':
            return { icon: 'shield-checkmark', color: '#2563EB', bg: '#EFF6FF', label: 'BVN Validation' };
        case 'virtual_cards':
            return { icon: 'card', color: '#8B5CF6', bg: '#F5F3FF', label: 'Virtual Cards' };
        case 'airtime_to_cash':
            return { icon: 'swap-horizontal', color: '#D97706', bg: '#FFFBEB', label: 'Airtime to Cash' };
        case 'crypto':
            return { icon: 'logo-bitcoin', color: '#F59E0B', bg: '#FFFBEB', label: 'Crypto Assets' };
        case 'bulk_sms':
            return { icon: 'chatbubbles', color: '#0891B2', bg: '#ECFEFF', label: 'Bulk SMS' };
        case 'smile':
            return { icon: 'wifi', color: '#7C3AED', bg: '#F5F3FF', label: 'Smile 4G' };
        case 'recharge_pin':
            return { icon: 'barcode', color: '#0D9488', bg: '#F0FDFA', label: 'Card Printing' };
        case 'data':
            return { icon: 'cellular', color: '#3B82F6', bg: '#EFF6FF', label: 'Data Bundles' };
        case 'airtime':
            return { icon: 'call', color: '#F59E0B', bg: '#FFFBEB', label: 'Airtime VTU' };
        case 'electricity':
            return { icon: 'flash', color: '#EAB308', bg: '#FEFCE8', label: 'Electricity Bills' };
        case 'tv':
            return { icon: 'tv', color: '#9333EA', bg: '#FAF5FF', label: 'Cable TV' };
        case 'education':
            return { icon: 'school', color: '#2563EB', bg: '#EFF6FF', label: 'Exam PINs' };
        case 'transfer':
            return { icon: 'send', color: '#059669', bg: '#ECFDF5', label: 'Transfers' };
        case 'funding_fee':
            return { icon: 'wallet', color: '#D97706', bg: '#FFFBEB', label: 'Gateway Fees' };
        default:
            return { icon: 'receipt', color: '#64748B', bg: '#F8FAFC', label: 'Other' };
    }
};

export default function AccountingScreen() {
    return (
        <ErrorBoundary fallbackTitle="Financial Ledger Notice" fallbackSubtitle="An unexpected issue occurred while calculating financial records.">
            <AccountingContent />
        </ErrorBoundary>
    );
}

function AccountingContent() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktopWeb = isWeb && width >= 1024;
    const isTabletWeb = isWeb && width >= 768 && width < 1024;

    const metricCardWidth = isDesktopWeb ? '23.8%' : isTabletWeb ? '48.5%' : (width - 42) / 2;

    // Clearance & Access States
    const [authLoading, setAuthLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    // Dashboard Data & Filters
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('month');
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    // Search query for services tab
    const [serviceSearch, setServiceSearch] = useState('');

    // Financial Metrics
    const [metrics, setMetrics] = useState<AccountingMetrics | null>(null);

    // Inspector Modal
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    // Add Expense Modal
    const [addExpenseVisible, setAddExpenseVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newCategory, setNewCategory] = useState(EXPENSE_CATEGORIES[0].id);
    const [newPaymentMethod, setNewPaymentMethod] = useState(PAYMENT_METHODS[0].id);
    const [newNotes, setNewNotes] = useState('');
    const [savingExpense, setSavingExpense] = useState(false);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

    // Service Sorting Mode & Category Filter
    const [serviceSortMode, setServiceSortMode] = useState<'default' | 'profit' | 'margin'>('default');
    const [serviceCategoryFilter, setServiceCategoryFilter] = useState<'all' | 'telecom' | 'identity' | 'finance' | 'utilities'>('all');

    // Super Admin Clearance Vault
    const [clearanceModalVisible, setClearanceModalVisible] = useState(false);
    const [adminList, setAdminList] = useState<AdminClearanceInfo[]>([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);
    const [togglingAdminEmail, setTogglingAdminEmail] = useState<string | null>(null);

    // Whale Inspector Modal
    const [selectedWhale, setSelectedWhale] = useState<{ id: string; name: string; email: string; balance: number } | null>(null);

    // Exporting CSV State
    const [exportingCSV, setExportingCSV] = useState(false);

    // Exporting PDF State
    const [exportingPDF, setExportingPDF] = useState(false);

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
            return { start, label: 'Today' };
        } else if (range === 'yesterday') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
            return { start, end, label: 'Yesterday' };
        } else if (range === 'week') {
            const dayOfWeek = now.getDay();
            const distance = (dayOfWeek + 6) % 7; // Monday start
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distance, 0, 0, 0);
            return { start, label: 'This Week' };
        } else if (range === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            return { start, label: 'This Month' };
        } else if (range === 'last30') {
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { start, label: 'Last 30 Days' };
        } else if (range === 'year') {
            const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
            return { start, label: 'This Year' };
        }
        return { label: 'All Time' };
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

    // 4. Handle Save New Expense
    const handleSaveExpense = async () => {
        const parsedAmount = parseFloat(newAmount);
        if (!newTitle.trim()) {
            Alert.alert('Required Field', 'Please enter a title or description for the expense.');
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid expense amount in Naira.');
            return;
        }

        setSavingExpense(true);
        const res = await recordExpense({
            title: newTitle.trim(),
            category: newCategory,
            amount: parsedAmount,
            payment_method: newPaymentMethod,
            notes: newNotes.trim() || undefined,
            expense_date: new Date().toISOString().split('T')[0]
        });
        setSavingExpense(false);

        if (res.success) {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Recorded', `Expense of ${formatNaira(parsedAmount)} has been logged successfully.`);
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

    // 6. Handle Export PDF Report (Direct Auto-Download to Phone Storage)
    const handleExport = async () => {
        if (!metrics) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setExportingPDF(true);
        try {
            const { label } = getDateRange(timeRange);
            const targetUri = await generateProfitLossPDF(metrics, label);
            if (targetUri) {
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    'Statement Saved',
                    `Executive Financial Statement has been generated with official branding and saved to your device for (${label}).`
                );
            }
        } catch (err: any) {
            console.error('[Export PDF] UI error:', err);
            Alert.alert('Notice', 'Unable to complete statement download.');
        } finally {
            setExportingPDF(false);
        }
    };

    // 7. Handle Export CSV Spreadsheet (Direct Auto-Download)
    const handleExportCSV = async () => {
        if (!metrics) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setExportingCSV(true);
        try {
            const { label } = getDateRange(timeRange);
            const success = await exportFinancialCSV(metrics, label);
            if (success) {
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    'Spreadsheet Downloaded',
                    `Financial spreadsheet (CSV) has been exported and saved to your device for (${label}).`
                );
            }
        } catch (err: any) {
            console.error('[Export CSV] UI error:', err);
            Alert.alert('Notice', 'Unable to complete spreadsheet export.');
        } finally {
            setExportingCSV(false);
        }
    };

    // 8. Copy Executive Financial Brief (Instant 1-Tap Copy for WhatsApp / Management)
    const handleCopyBrief = () => {
        if (!metrics) return;
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const { label } = getDateRange(timeRange);
        const isSurplus = metrics.netProfit >= 0;
        const advisory = getFinancialHealthAdvisory(metrics);
        const briefText = 
`📊 *ABU MAFHAL HUB - EXECUTIVE FINANCIAL BRIEF*
📅 *Period*: ${label}
🕒 *Generated*: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}

══════════════════════════
💰 *Gross Revenue*: ${formatNaira(metrics.totalRevenue)}
📦 *Cost of Sales*: ${formatNaira(metrics.totalCost)}
📈 *Gross Trading Margin*: ${formatNaira(metrics.grossProfit)} (${metrics.profitMargin.toFixed(1)}%)
📉 *Operating Expenses*: ${formatNaira(metrics.totalExpenses)}
══════════════════════════
💵 *NET ${isSurplus ? 'PROFIT SURPLUS' : 'DEFICIT'}*: ${formatNaira(metrics.netProfit)}
⚡ *Orders Completed*: ${metrics.successfulTransactionsCount.toLocaleString()}
🛡️ *Customer Balances*: ${formatNaira(metrics.userLiquidity.totalUserBalances)} (100% Backed)
🏥 *Commercial Rating*: ${advisory.rating} (${advisory.headline})
══════════════════════════
_Certified by Abu Mafhal Enterprise Cloud Accounting Ledger_`;

        Clipboard.setStringAsync(briefText);
        Alert.alert(
            'Executive Brief Copied',
            `The financial summary for (${label}) has been copied to your clipboard. Ready to paste directly into WhatsApp or Telegram.`
        );
    };

    // 8. Super Admin Clearance Vault Management
    const openClearanceVault = async () => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setClearanceModalVisible(true);
        setLoadingAdmins(true);
        const list = await getAdminsWithProfitClearance();
        setAdminList(list);
        setLoadingAdmins(false);
    };

    const handleToggleClearance = async (admin: AdminClearanceInfo) => {
        if (admin.isMasterAdmin) {
            Alert.alert('Protected Authority', 'Master Super Administrator clearance is foundational and cannot be revoked.');
            return;
        }

        const newStatus = !admin.hasClearance;
        setTogglingAdminEmail(admin.email);
        const res = await toggleAdminProfitClearance(admin.email, newStatus);
        setTogglingAdminEmail(null);

        if (res.success) {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setAdminList(prev => prev.map(a => a.email === admin.email ? { ...a, hasClearance: newStatus } : a));
            Alert.alert(
                'Clearance Updated',
                newStatus 
                    ? `Granted profit and accounting ledger clearance to ${admin.fullName} (${admin.email}).`
                    : `Revoked profit and accounting clearance from ${admin.fullName} (${admin.email}).`
            );
        } else {
            Alert.alert('Security Error', res.error || 'Failed to update clearance setting.');
        }
    };

    const copyReference = (ref: string) => {
        Clipboard.setStringAsync(ref);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Copied', 'Reference ID copied to clipboard.');
    };

    // --- ACCESS DENIED SCREEN ---
    if (authLoading) {
        return (
            <View style={[styles.centerBox, { backgroundColor: C.bg }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={C.goldBright} />
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
                        <Ionicons name="shield-outline" size={44} color={C.coral} />
                    </View>
                    <Text style={styles.deniedTitle}>SUPER ADMIN CLEARANCE REQUIRED</Text>
                    <Text style={styles.deniedSub}>
                        You do not have administrative clearance to access the Executive Profit & Loss Ledger. This portal is strictly restricted to authorized Super Administrators.
                    </Text>
                    <View style={styles.deniedAccountBadge}>
                        <Ionicons name="person-outline" size={13} color={C.textSub} />
                        <Text style={styles.deniedAccountEmail}>{userEmail || 'Unauthorized Account'}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.replace('/manage')}
                        style={styles.deniedReturnBtn}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={[C.navyDark, C.navy]} style={styles.deniedReturnGrad}>
                            <Ionicons name="arrow-back" size={16} color={C.goldBright} />
                            <Text style={styles.deniedReturnText}>Return to Management</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const isNetProfitable = (metrics?.netProfit || 0) >= 0;

    // Filter & sort services list based on category filter, search and sort mode
    const filteredServices = Object.values(metrics?.serviceBreakdown || {})
        .filter(serv => {
            // Category Grouping
            if (serviceCategoryFilter === 'telecom') {
                if (!['data', 'airtime', 'smile', 'bulk_sms', 'recharge_pin'].includes(serv.type)) return false;
            } else if (serviceCategoryFilter === 'identity') {
                if (!['cac', 'nin', 'bvn'].includes(serv.type)) return false;
            } else if (serviceCategoryFilter === 'finance') {
                if (!['virtual_cards', 'airtime_to_cash', 'crypto', 'transfer', 'funding_fee'].includes(serv.type)) return false;
            } else if (serviceCategoryFilter === 'utilities') {
                if (!['electricity', 'tv', 'education', 'social_boost'].includes(serv.type)) return false;
            }

            if (!serviceSearch.trim()) return true;
            const q = serviceSearch.toLowerCase().trim();
            return serv.serviceName.toLowerCase().includes(q) || serv.type.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            if (serviceSortMode === 'profit') {
                return b.profit - a.profit;
            } else if (serviceSortMode === 'margin') {
                return b.marginPercent - a.marginPercent;
            }
            return 0;
        });

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* EXECUTIVE APP BAR (DEEP NAVY & GOLD ACCENTS) */}
            <LinearGradient
                colors={[C.navyDark, C.navy]}
                style={[styles.headerBar, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 38 : 20) + 6 }]}
            >
                {/* TIER 1: TOP NAVIGATION & SECURITY TITLE */}
                <View style={styles.headerTopRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={18} color={C.white} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="calculator" size={15} color={C.goldBright} />
                            <Text style={styles.headerTitle} numberOfLines={1}>Profit & Accounting</Text>
                        </View>
                        <Text style={styles.headerSub} numberOfLines={1}>ABU MAFHAL ENTERPRISE</Text>
                    </View>

                    <View style={styles.headerAdminBadge}>
                        <Ionicons name="shield-checkmark" size={11} color={C.goldBright} />
                        <Text style={styles.headerAdminBadgeText}>SUPER ADMIN</Text>
                    </View>
                </View>

                {/* TIER 2: EXECUTIVE ACTIONS TOOLBAR (100% VISIBLE & SPACIOUS) */}
                <View style={styles.execToolbar}>
                    {/* 1. Clearance Vault */}
                    <TouchableOpacity
                        onPress={openClearanceVault}
                        style={styles.execToolBtn}
                        activeOpacity={0.8}
                    >
                        <View style={styles.execToolIconWrap}>
                            <Ionicons name="key" size={14} color={C.goldBright} />
                        </View>
                        <View style={styles.execToolTextWrap}>
                            <Text style={styles.execToolBtnTitle} numberOfLines={1}>Access Vault</Text>
                            <Text style={styles.execToolBtnSub} numberOfLines={1}>Admin Rights</Text>
                        </View>
                    </TouchableOpacity>

                    {/* 2. CSV / Excel Export */}
                    <TouchableOpacity
                        onPress={handleExportCSV}
                        style={styles.execToolBtn}
                        activeOpacity={0.8}
                        disabled={exportingCSV}
                    >
                        <View style={styles.execToolIconWrap}>
                            {exportingCSV ? (
                                <ActivityIndicator size="small" color={C.goldBright} />
                            ) : (
                                <Ionicons name="grid" size={14} color={C.goldBright} />
                            )}
                        </View>
                        <View style={styles.execToolTextWrap}>
                            <Text style={styles.execToolBtnTitle} numberOfLines={1}>Spreadsheet</Text>
                            <Text style={styles.execToolBtnSub} numberOfLines={1}>{exportingCSV ? 'Exporting...' : 'Excel / CSV'}</Text>
                        </View>
                    </TouchableOpacity>

                    {/* 3. Statement PDF Auto-Download */}
                    <TouchableOpacity
                        onPress={handleExport}
                        style={[styles.execToolBtn, styles.execToolBtnPrimary]}
                        activeOpacity={0.8}
                        disabled={exportingPDF}
                    >
                        <View style={[styles.execToolIconWrap, styles.execToolIconWrapPrimary]}>
                            {exportingPDF ? (
                                <ActivityIndicator size="small" color={C.navyDark} />
                            ) : (
                                <Ionicons name="download" size={14} color={C.navyDark} />
                            )}
                        </View>
                        <View style={styles.execToolTextWrap}>
                            <Text style={[styles.execToolBtnTitle, { color: C.white }]} numberOfLines={1}>Statement</Text>
                            <Text style={[styles.execToolBtnSub, { color: C.goldBright }]} numberOfLines={1}>{exportingPDF ? 'Downloading...' : 'PDF Download'}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* TIMEFRAME SELECTOR PILLS */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timeFilterContainer}
                >
                    {(['today', 'yesterday', 'week', 'month', 'last30', 'year', 'all'] as TimeRange[]).map((r) => {
                        const labels: Record<TimeRange, string> = {
                            today: 'Today',
                            yesterday: 'Yesterday',
                            week: 'This Week',
                            month: 'This Month',
                            last30: 'Last 30 Days',
                            year: 'This Year',
                            all: 'All Time'
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

                {/* 4 VIEW TABS SWITCHER */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('overview')}
                        style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
                    >
                        <Ionicons name="stats-chart" size={12} color={activeTab === 'overview' ? C.navy : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('services')}
                        style={[styles.tabItem, activeTab === 'services' && styles.tabItemActive]}
                    >
                        <Ionicons name="apps" size={12} color={activeTab === 'services' ? C.navy : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>Services</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('expenses')}
                        style={[styles.tabItem, activeTab === 'expenses' && styles.tabItemActive]}
                    >
                        <Ionicons name="wallet" size={12} color={activeTab === 'expenses' ? C.navy : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
                            Costs ({metrics?.expensesCount || 0})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('transactions')}
                        style={[styles.tabItem, activeTab === 'transactions' && styles.tabItemActive]}
                    >
                        <Ionicons name="list" size={12} color={activeTab === 'transactions' ? C.navy : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>Sales</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* MAIN DASHBOARD CONTENT (LIGHT BACKGROUND) */}
            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={C.goldBright} />
                    <Text style={styles.loadingDataText}>Calculating Real-time Financial Metrics...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, isWeb && { maxWidth: 1400, width: '100%', alignSelf: 'center' }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.goldBright} />}
                >
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <>
                            {/* 1. MASTER NET PROFIT HERO CARD */}
                            <LinearGradient
                                colors={isNetProfitable ? ['#0A1128', '#0F172A', '#132A3E'] : ['#2C0B0E', '#1F080A', '#130506']}
                                style={[styles.netProfitCard, { borderColor: isNetProfitable ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)' }]}
                            >
                                <View style={styles.netProfitTopRow}>
                                    <View style={[styles.badgePill, { backgroundColor: isNetProfitable ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)' }]}>
                                        <Ionicons name={isNetProfitable ? "trending-up" : "trending-down"} size={12} color={isNetProfitable ? '#34D399' : '#F87171'} />
                                        <Text style={[styles.badgeText, { color: isNetProfitable ? '#34D399' : '#F87171' }]}>
                                            {isNetProfitable ? 'NET PROFITABLE' : 'NET DEFICIT'}
                                        </Text>
                                    </View>
                                    <View style={[styles.badgePill, { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
                                        <Ionicons name="pie-chart" size={11} color={C.goldBright} />
                                        <Text style={[styles.badgeText, { color: C.goldBright }]}>
                                            {metrics?.profitMargin ? metrics.profitMargin.toFixed(1) : '0.0'}% MARGIN
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.netProfitLabel}>NET OPERATING PROFIT</Text>
                                <Text style={[styles.netProfitValue, { color: isNetProfitable ? '#34D399' : '#F87171' }]}>
                                    {formatNaira(metrics?.netProfit || 0)}
                                </Text>
                                <Text style={styles.netProfitSub}>
                                    Gross Profit ({formatNaira(metrics?.grossProfit || 0)}) − Total Expenses ({formatNaira(metrics?.totalExpenses || 0)})
                                </Text>
                            </LinearGradient>

                            {/* EXECUTIVE DISPATCH & WHATSAPP BRIEF BAR */}
                            <View style={styles.briefBar}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Ionicons name="document-text" size={13} color={C.navy} />
                                        <Text style={styles.briefBarTitle}>Management Financial Brief</Text>
                                    </View>
                                    <Text style={styles.briefBarSub}>Instant WhatsApp & executive summary</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleCopyBrief}
                                    style={styles.briefCopyBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="copy-outline" size={13} color={C.goldBright} />
                                    <Text style={styles.briefCopyBtnText}>Copy Brief</Text>
                                </TouchableOpacity>
                            </View>

                            {/* 2. 4 SECONDARY METRIC CARDS */}
                            <View style={styles.metricsGrid}>
                                <View style={[styles.metricCard, { width: metricCardWidth }]}>
                                    <View style={[styles.metricIconWrap, { backgroundColor: C.blueBg }]}>
                                        <Ionicons name="cart" size={15} color={C.blue} />
                                    </View>
                                    <Text style={styles.metricLabel}>Gross Revenue</Text>
                                    <Text style={styles.metricValue}>{formatNaira(metrics?.totalRevenue || 0)}</Text>
                                    <Text style={styles.metricHint}>{metrics?.successfulTransactionsCount || 0} Successful Sales</Text>
                                </View>

                                <View style={[styles.metricCard, { width: metricCardWidth }]}>
                                    <View style={[styles.metricIconWrap, { backgroundColor: '#F1F5F9' }]}>
                                        <Ionicons name="cube" size={15} color={C.textSub} />
                                    </View>
                                    <Text style={styles.metricLabel}>Cost of Sales</Text>
                                    <Text style={[styles.metricValue, { color: C.textSub }]}>{formatNaira(metrics?.totalCost || 0)}</Text>
                                    <Text style={styles.metricHint}>Provider Settlements</Text>
                                </View>

                                <View style={[styles.metricCard, { width: metricCardWidth }]}>
                                    <View style={[styles.metricIconWrap, { backgroundColor: C.emeraldBg }]}>
                                        <Ionicons name="sparkles" size={15} color={C.emerald} />
                                    </View>
                                    <Text style={styles.metricLabel}>Gross Profit</Text>
                                    <Text style={[styles.metricValue, { color: C.emerald }]}>{formatNaira(metrics?.grossProfit || 0)}</Text>
                                    <Text style={styles.metricHint}>Before Operating Costs</Text>
                                </View>

                                <View style={[styles.metricCard, { width: metricCardWidth }]}>
                                    <View style={[styles.metricIconWrap, { backgroundColor: C.coralBg }]}>
                                        <Ionicons name="arrow-down-circle" size={15} color={C.coral} />
                                    </View>
                                    <Text style={styles.metricLabel}>Operating Expenses</Text>
                                    <Text style={[styles.metricValue, { color: C.coral }]}>{formatNaira(metrics?.totalExpenses || 0)}</Text>
                                    <Text style={styles.metricHint}>{metrics?.expensesCount || 0} Recorded Costs</Text>
                                </View>
                            </View>

                            {/* 3. SMART EXECUTIVE FINANCIAL HEALTH & ADVISORY */}
                            {metrics && (() => {
                                const adv = getFinancialHealthAdvisory(metrics);
                                const isGood = adv.rating === 'AAA' || adv.rating === 'AA' || adv.rating === 'A';
                                return (
                                    <View style={[styles.advisoryCard, { borderColor: isGood ? 'rgba(217, 119, 6, 0.3)' : 'rgba(220, 38, 38, 0.3)' }]}>
                                        <View style={styles.advisoryTopRow}>
                                            <View style={[styles.ratingBadge, { backgroundColor: isGood ? C.goldBg : C.coralBg }]}>
                                                <Ionicons name="shield-checkmark" size={12} color={isGood ? C.gold : C.coral} />
                                                <Text style={[styles.ratingText, { color: isGood ? C.gold : C.coral }]}>
                                                    {adv.rating} HEALTH RATING
                                                </Text>
                                            </View>
                                            <View style={styles.solvencyPill}>
                                                <Text style={styles.solvencyPillText}>Liquidity: {adv.liquidityStatus}</Text>
                                            </View>
                                        </View>

                                        <Text style={styles.advisoryHeadline}>{adv.headline}</Text>
                                        <Text style={styles.advisorySummary}>{adv.summary}</Text>

                                        <View style={styles.advisoryMetricsRow}>
                                            <View style={styles.advisoryMetricCol}>
                                                <Text style={styles.advisoryMetricLbl}>Top Profit Driver</Text>
                                                <Text style={styles.advisoryMetricVal} numberOfLines={1}>{adv.topDriverName}</Text>
                                                <Text style={styles.advisoryMetricSub}>{adv.topDriverShare.toFixed(1)}% of profit</Text>
                                            </View>
                                            <View style={styles.advisoryDivider} />
                                            <View style={styles.advisoryMetricCol}>
                                                <Text style={styles.advisoryMetricLbl}>Expense Burn Ratio</Text>
                                                <Text style={[styles.advisoryMetricVal, { color: adv.burnRate > 50 ? C.coral : C.textMain }]}>
                                                    {adv.burnRate.toFixed(1)}%
                                                </Text>
                                                <Text style={styles.advisoryMetricSub}>of trading gross</Text>
                                            </View>
                                            <View style={styles.advisoryDivider} />
                                            <View style={styles.advisoryMetricCol}>
                                                <Text style={styles.advisoryMetricLbl}>Whale Liability Ratio</Text>
                                                <Text style={[styles.advisoryMetricVal, { color: C.emerald }]}>100%</Text>
                                                <Text style={styles.advisoryMetricSub}>fully backed</Text>
                                            </View>
                                        </View>

                                        <View style={styles.advisoryRecommendationBox}>
                                            <Ionicons name="bulb-outline" size={15} color={C.gold} />
                                            <Text style={styles.advisoryRecommendationText}>{adv.recommendation}</Text>
                                        </View>
                                    </View>
                                );
                            })()}

                            {/* 4. MONTHLY PROFIT TARGET MILESTONE */}
                            <View style={styles.targetProgressCard}>
                                <View style={styles.targetProgressTop}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="flag" size={14} color={C.blue} />
                                        <Text style={styles.targetProgressTitle}>Monthly Net Profit Milestone</Text>
                                    </View>
                                    <Text style={styles.targetProgressGoal}>Goal: ₦1,000,000</Text>
                                </View>
                                <View style={styles.targetProgressBarTrack}>
                                    <View
                                        style={[
                                            styles.targetProgressBarFill,
                                            { width: `${Math.min(100, Math.max(2, Math.round(((metrics?.netProfit || 0) / 1000000) * 100)))}%` }
                                        ]}
                                    />
                                </View>
                                <View style={styles.targetProgressBottomRow}>
                                    <Text style={styles.targetProgressEarned}>
                                        Current: {formatNaira(metrics?.netProfit || 0)}
                                    </Text>
                                    <Text style={styles.targetProgressPct}>
                                        {Math.max(0, ((metrics?.netProfit || 0) / 1000000 * 100)).toFixed(1)}% Completed
                                    </Text>
                                </View>
                            </View>

                            {/* 5. 7-DAY PERFORMANCE PROGRESSION BARS */}
                            {metrics?.dailyTrends && metrics.dailyTrends.length > 0 && (
                                <View style={styles.trendChartCard}>
                                    <View style={styles.trendChartHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="bar-chart" size={15} color={C.goldBright} />
                                            <Text style={styles.trendChartTitle}>7-Day Profit Progression</Text>
                                        </View>
                                        <View style={styles.trendBadge}>
                                            <Text style={styles.trendBadgeText}>DAILY TRENDS</Text>
                                        </View>
                                    </View>

                                    <View style={styles.trendBarsRow}>
                                        {(() => {
                                            const maxProfit = Math.max(...metrics.dailyTrends.map(t => Math.max(t.profit, 1)));
                                            return metrics.dailyTrends.map((point, pIdx) => {
                                                const heightPct = Math.max(12, Math.min(100, Math.round((Math.max(0, point.profit) / maxProfit) * 90)));
                                                const isPeak = point.profit > 0 && point.profit === Math.max(...metrics.dailyTrends.map(t => t.profit));
                                                return (
                                                    <View key={point.date || pIdx} style={styles.trendBarCol}>
                                                        <Text style={styles.trendBarValueText} numberOfLines={1}>
                                                            {point.profit > 0 ? `+₦${(point.profit / 1000).toFixed(point.profit >= 10000 ? 0 : 1)}k` : '₦0'}
                                                        </Text>
                                                        <View style={styles.trendBarTrack}>
                                                            <View
                                                                style={[
                                                                    styles.trendBarFill,
                                                                    {
                                                                        height: `${heightPct}%`,
                                                                        backgroundColor: isPeak ? C.goldBright : (point.profit > 0 ? C.emerald : '#CBD5E1')
                                                                    }
                                                                ]}
                                                            />
                                                        </View>
                                                        <Text style={[styles.trendBarDayLabel, isPeak && { color: C.gold, fontWeight: '800' }]}>
                                                            {point.dayName}
                                                        </Text>
                                                        <Text style={styles.trendBarOrdersCount}>
                                                            {point.salesCount} tx
                                                        </Text>
                                                    </View>
                                                );
                                            });
                                        })()}
                                    </View>
                                </View>
                            )}

                            {/* 6. TOTAL USER WALLET BALANCES & LIABILITIES */}
                            <View style={styles.userBalanceHeroCard}>
                                <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.userBalanceHeroGrad}>
                                    <View style={styles.userBalanceTopRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={styles.userBalanceIconCircle}>
                                                <Ionicons name="people" size={16} color={C.goldBright} />
                                            </View>
                                            <View>
                                                <Text style={styles.userBalanceTitle}>TOTAL USER WALLET BALANCES</Text>
                                                <Text style={styles.userBalanceSub}>Platform Customer Liabilities</Text>
                                            </View>
                                        </View>
                                        <View style={styles.solvencyBadge}>
                                            <Ionicons name="shield-checkmark" size={11} color="#34D399" />
                                            <Text style={styles.solvencyBadgeText}>100% BACKED</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.userBalanceAmount}>
                                        {formatNaira(metrics?.userLiquidity?.totalUserBalances || 0)}
                                    </Text>
                                    <Text style={styles.userBalanceHint}>
                                        Total funds currently deposited and held across all user accounts in the platform database.
                                    </Text>

                                    <View style={styles.userBalanceStatsRow}>
                                        <View style={styles.userBalanceStatItem}>
                                            <Text style={styles.userBalanceStatVal}>{metrics?.userLiquidity?.totalUserCount || 0}</Text>
                                            <Text style={styles.userBalanceStatLbl}>Total Accounts</Text>
                                        </View>
                                        <View style={styles.userBalanceStatDivider} />
                                        <View style={styles.userBalanceStatItem}>
                                            <Text style={styles.userBalanceStatVal}>{metrics?.userLiquidity?.fundedUserCount || 0}</Text>
                                            <Text style={styles.userBalanceStatLbl}>Funded Wallets</Text>
                                        </View>
                                        <View style={styles.userBalanceStatDivider} />
                                        <View style={styles.userBalanceStatItem}>
                                            <Text style={styles.userBalanceStatVal}>
                                                {formatNaira(metrics?.userLiquidity?.averageUserBalance || 0)}
                                            </Text>
                                            <Text style={styles.userBalanceStatLbl}>Average Balance</Text>
                                        </View>
                                    </View>
                                </LinearGradient>

                                {/* Whale Accounts / Top Balance Holders */}
                                {metrics?.userLiquidity?.topHolders && metrics.userLiquidity.topHolders.length > 0 && (
                                    <View style={styles.topHoldersSection}>
                                        <View style={styles.topHoldersHeader}>
                                            <Text style={styles.topHoldersTitle}>Highest Balance Holders (Whales)</Text>
                                            <Text style={styles.topHoldersSub}>Tap to inspect customer profile</Text>
                                        </View>
                                        {metrics.userLiquidity.topHolders.map((holder, idx) => (
                                            <TouchableOpacity
                                                key={holder.id || idx}
                                                style={styles.holderRow}
                                                activeOpacity={0.7}
                                                onPress={() => {
                                                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    setSelectedWhale(holder);
                                                }}
                                            >
                                                <View style={styles.holderRankCircle}>
                                                    <Text style={styles.holderRankText}>#{idx + 1}</Text>
                                                </View>
                                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                    <Text style={styles.holderName} numberOfLines={1}>{holder.name}</Text>
                                                    <Text style={styles.holderEmail} numberOfLines={1}>{holder.email}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.holderBalance}>{formatNaira(holder.balance)}</Text>
                                                    <Text style={styles.holderInspectHint}>Tap to view →</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* 4. PERFORMANCE RUN-RATE & MONTHLY FORECAST */}
                            <View style={styles.projectionCard}>
                                <View style={styles.projectionHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="trending-up" size={15} color={C.emerald} />
                                        <Text style={styles.projectionTitle}>Profit Run-Rate & Projections</Text>
                                    </View>
                                    <View style={styles.projectionTag}>
                                        <Text style={styles.projectionTagText}>FORECAST</Text>
                                    </View>
                                </View>
                                <View style={styles.projectionGrid}>
                                    <View style={styles.projectionCol}>
                                        <Text style={styles.projectionColLbl}>Daily Average Net</Text>
                                        <Text style={styles.projectionColVal}>{formatNaira(metrics?.dailyRunRate || 0)}</Text>
                                        <Text style={styles.projectionColSub}>per 24 hour pace</Text>
                                    </View>
                                    <View style={styles.projectionColDivider} />
                                    <View style={styles.projectionCol}>
                                        <Text style={styles.projectionColLbl}>30-Day Projected Net</Text>
                                        <Text style={[styles.projectionColVal, { color: C.emerald }]}>
                                            {formatNaira(metrics?.projectedMonthlyProfit || 0)}
                                        </Text>
                                        <Text style={styles.projectionColSub}>estimated monthly profit</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 5. TOP SERVICE PERFORMERS (QUICK VIEW) */}
                            <View style={styles.sectionContainer}>
                                <View style={styles.sectionHeaderRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="trophy" size={15} color={C.gold} />
                                        <Text style={styles.sectionTitle}>Top Revenue Driving Services</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setActiveTab('services')}>
                                        <Text style={styles.sectionSubTitle}>View All Services →</Text>
                                    </TouchableOpacity>
                                </View>

                                {Object.values(metrics?.serviceBreakdown || {})
                                    .filter(s => s.revenue > 0 || s.profit > 0)
                                    .sort((a, b) => b.profit - a.profit)
                                    .slice(0, 5)
                                    .map((serv, idx) => {
                                        const meta = getServiceMeta(serv.type);
                                        return (
                                            <View key={serv.type || idx} style={styles.serviceRow}>
                                                <View style={[styles.serviceIconCircle, { backgroundColor: meta.bg }]}>
                                                    <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                                                </View>
                                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                    <Text style={styles.serviceName}>{serv.serviceName}</Text>
                                                    <Text style={styles.serviceMeta}>
                                                        {serv.transactionCount} completed • Volume: {formatNaira(serv.revenue)}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.serviceProfit}>{formatNaira(serv.profit)}</Text>
                                                    <View style={styles.serviceMarginBadge}>
                                                        <Text style={styles.serviceMarginText}>{serv.marginPercent.toFixed(1)}% Margin</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                            </View>

                            {/* 6. QUICK ACTION: RECORD EXPENSE BANNER */}
                            <TouchableOpacity
                                onPress={() => setAddExpenseVisible(true)}
                                style={styles.quickAddExpenseBanner}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={[C.navyDark, C.navy]} style={styles.quickAddExpenseGrad}>
                                    <View style={styles.quickAddIconCircle}>
                                        <Ionicons name="add" size={20} color={C.goldBright} />
                                    </View>
                                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                                        <Text style={styles.quickAddTitle}>Record Operating Expense</Text>
                                        <Text style={styles.quickAddSub}>Log server infrastructure, API top-up, staff salaries, or marketing</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={C.goldBright} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* TAB 2: ALL SERVICES BREAKDOWN */}
                    {activeTab === 'services' && (
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>All Products & Services Matrix</Text>
                                <Text style={styles.sectionSubTitle}>{filteredServices.length} Products Tracked</Text>
                            </View>

                            {/* Search Filter Box */}
                            <View style={styles.serviceSearchWrap}>
                                <Ionicons name="search" size={14} color={C.textMuted} />
                                <TextInput
                                    style={styles.serviceSearchInput}
                                    placeholder="Filter by service name (e.g. CAC, Social, NIN, Data)..."
                                    placeholderTextColor={C.textMuted}
                                    value={serviceSearch}
                                    onChangeText={setServiceSearch}
                                />
                                {serviceSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setServiceSearch('')}>
                                        <Ionicons name="close-circle" size={16} color={C.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Category Filter Chips */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {[
                                        { id: 'all', label: 'All Services (18)' },
                                        { id: 'telecom', label: 'Telecom & Data (5)' },
                                        { id: 'identity', label: 'Identity & Slips (3)' },
                                        { id: 'finance', label: 'Finance & Cards (5)' },
                                        { id: 'utilities', label: 'Utilities & Bills (4)' },
                                    ].map((cat) => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            onPress={() => {
                                                if (Platform.OS !== 'web') Haptics.selectionAsync();
                                                setServiceCategoryFilter(cat.id as any);
                                            }}
                                            style={[styles.serviceCatChip, serviceCategoryFilter === cat.id && styles.serviceCatChipActive]}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.serviceCatChipText, serviceCategoryFilter === cat.id && styles.serviceCatChipTextActive]}>
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Sorting Mode Selector */}
                            <View style={styles.sortPillsRow}>
                                <Text style={styles.sortPillsLabel}>Sort Mode:</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                                        setServiceSortMode('default');
                                    }}
                                    style={[styles.sortPill, serviceSortMode === 'default' && styles.sortPillActive]}
                                >
                                    <Text style={[styles.sortPillText, serviceSortMode === 'default' && styles.sortPillTextActive]}>
                                        All Products
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                                        setServiceSortMode('profit');
                                    }}
                                    style={[styles.sortPill, serviceSortMode === 'profit' && styles.sortPillActive]}
                                >
                                    <Ionicons name="trophy" size={11} color={serviceSortMode === 'profit' ? C.goldBright : C.textSub} />
                                    <Text style={[styles.sortPillText, serviceSortMode === 'profit' && styles.sortPillTextActive]}>
                                        Top Profit
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                                        setServiceSortMode('margin');
                                    }}
                                    style={[styles.sortPill, serviceSortMode === 'margin' && styles.sortPillActive]}
                                >
                                    <Ionicons name="pie-chart" size={11} color={serviceSortMode === 'margin' ? C.goldBright : C.textSub} />
                                    <Text style={[styles.sortPillText, serviceSortMode === 'margin' && styles.sortPillTextActive]}>
                                        Margin %
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {filteredServices.map((serv) => {
                                const meta = getServiceMeta(serv.type);
                                return (
                                    <View key={serv.type} style={styles.breakdownCard}>
                                        <View style={styles.breakdownCardHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                <View style={[styles.breakdownIconWrap, { backgroundColor: meta.bg }]}>
                                                    <Ionicons name={meta.icon as any} size={15} color={meta.color} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.breakdownServiceName}>{serv.serviceName}</Text>
                                                    <Text style={styles.breakdownServiceType}>{meta.label}</Text>
                                                </View>
                                            </View>
                                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                <View style={styles.breakdownTag}>
                                                    <Text style={styles.breakdownTagText}>{serv.transactionCount} Orders</Text>
                                                </View>
                                                {metrics?.grossProfit && metrics.grossProfit > 0 && serv.profit > 0 ? (
                                                    <View style={styles.profitShareBadge}>
                                                        <Ionicons name="sparkles" size={9} color={C.gold} />
                                                        <Text style={styles.profitShareText}>
                                                            {((serv.profit / metrics.grossProfit) * 100).toFixed(1)}% of profit
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>

                                        <View style={styles.breakdownGrid}>
                                            <View style={styles.breakdownCol}>
                                                <Text style={styles.breakdownColLabel}>Revenue</Text>
                                                <Text style={styles.breakdownColVal}>{formatNaira(serv.revenue)}</Text>
                                            </View>
                                            <View style={styles.breakdownCol}>
                                                <Text style={styles.breakdownColLabel}>Cost of Sales</Text>
                                                <Text style={[styles.breakdownColVal, { color: C.textSub }]}>{formatNaira(serv.cost)}</Text>
                                            </View>
                                            <View style={styles.breakdownCol}>
                                                <Text style={styles.breakdownColLabel}>Net Profit</Text>
                                                <Text style={[styles.breakdownColVal, { color: C.emerald }]}>{formatNaira(serv.profit)}</Text>
                                            </View>
                                            <View style={[styles.breakdownCol, { alignItems: 'flex-end' }]}>
                                                <Text style={styles.breakdownColLabel}>Margin</Text>
                                                <Text style={[styles.breakdownColVal, { color: C.gold }]}>{serv.marginPercent.toFixed(1)}%</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* TAB 3: OPERATING EXPENSES */}
                    {activeTab === 'expenses' && (
                        <View style={styles.sectionContainer}>
                            <View style={styles.expenseActionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>Operating Expenses Ledger</Text>
                                    <Text style={styles.sectionSubTitle}>Total Costs: {formatNaira(metrics?.totalExpenses || 0)}</Text>
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

                            {/* Category Filter Pills */}
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
                                                <View style={[styles.expenseIconCircle, { backgroundColor: catObj.color + '18' }]}>
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
                                                        <Ionicons name="trash-outline" size={14} color={C.coral} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })
                            ) : (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="wallet-outline" size={36} color={C.textMuted} />
                                    <Text style={styles.emptyTitle}>No Expenses Recorded in This Period</Text>
                                    <Text style={styles.emptySub}>Tap "+ Add Expense" above to log a new operating expenditure.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* TAB 4: LIVE SALES & TRANSACTION MARGIN INSPECTOR */}
                    {activeTab === 'transactions' && (
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Real-time Sales Margin Inspector</Text>
                                <Text style={styles.sectionSubTitle}>Tap any sale to inspect details</Text>
                            </View>

                            {metrics?.recentTransactions && metrics.recentTransactions.length > 0 ? (
                                metrics.recentTransactions.map((tx) => {
                                    const meta = getServiceMeta(tx.serviceCategory);
                                    return (
                                        <TouchableOpacity
                                            key={tx.id}
                                            style={styles.txRow}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setSelectedTx(tx);
                                            }}
                                        >
                                            <View style={[styles.txIconCircle, { backgroundColor: meta.bg }]}>
                                                <Ionicons name={meta.icon as any} size={15} color={meta.color} />
                                            </View>
                                            <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                <Text style={styles.txCustomerName} numberOfLines={1}>{tx.customerName}</Text>
                                                <Text style={styles.txServiceLabel}>
                                                    {tx.serviceName} • {formatAccountingDate(tx.created_at, true)}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.txRevenue}>{formatNaira(tx.revenue)}</Text>
                                                <View style={styles.txProfitPill}>
                                                    <Ionicons name="arrow-up" size={9} color={C.emerald} />
                                                    <Text style={styles.txProfitText}>+{formatNaira(tx.profit)}</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="receipt-outline" size={36} color={C.textMuted} />
                                    <Text style={styles.emptyTitle}>No Sales Recorded in This Period</Text>
                                    <Text style={styles.emptySub}>Transactions will appear here automatically as customers purchase services.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* MODAL 1: TRANSACTION MARGIN INSPECTOR */}
            <Modal
                visible={!!selectedTx}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedTx(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.inspectorCard}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.modalIconWrap}>
                                    <Ionicons name="information-circle" size={18} color={C.gold} />
                                </View>
                                <Text style={styles.modalTitle}>Transaction Margin Breakdown</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedTx(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedTx && (
                            <View style={{ marginTop: 6 }}>
                                <View style={styles.inspectorHeroBox}>
                                    <Text style={styles.inspectorHeroLabel}>NET PROFIT EARNED</Text>
                                    <Text style={styles.inspectorHeroVal}>+{formatNaira(selectedTx.profit)}</Text>
                                    <Text style={styles.inspectorHeroMargin}>{selectedTx.marginPercent.toFixed(1)}% Margin</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Customer</Text>
                                    <Text style={styles.inspectorFieldVal}>{selectedTx.customerName}</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Email</Text>
                                    <Text style={styles.inspectorFieldVal}>{selectedTx.customerEmail || 'Not specified'}</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Service</Text>
                                    <Text style={styles.inspectorFieldVal}>{selectedTx.serviceName}</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Customer Paid (Revenue)</Text>
                                    <Text style={[styles.inspectorFieldVal, { color: C.navy, fontWeight: '900' }]}>{formatNaira(selectedTx.revenue)}</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Provider Cost (API Settlement)</Text>
                                    <Text style={[styles.inspectorFieldVal, { color: C.textSub }]}>{formatNaira(selectedTx.cost)}</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Date & Time</Text>
                                    <Text style={styles.inspectorFieldVal}>{formatAccountingDate(selectedTx.created_at, true)}</Text>
                                </View>

                                <View style={[styles.inspectorFieldRow, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.inspectorFieldLbl}>Reference ID</Text>
                                    <TouchableOpacity
                                        onPress={() => copyReference(selectedTx.reference || selectedTx.id)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Text style={[styles.inspectorFieldVal, { color: C.blue }]} numberOfLines={1}>
                                            {(selectedTx.reference || selectedTx.id).substring(0, 18)}...
                                        </Text>
                                        <Ionicons name="copy-outline" size={13} color={C.blue} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setSelectedTx(null)}
                                    style={styles.inspectorCloseBtn}
                                >
                                    <Text style={styles.inspectorCloseBtnText}>Close Inspector</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: RECORD NEW EXPENSE */}
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
                                <Text style={styles.modalTitle}>Record Operating Expense</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAddExpenseVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                            <Text style={styles.inputLabel}>Quick Presets (One-Tap Autofill)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {[
                                        { label: '🌐 Server Hosting', title: 'Cloud Server Hosting & Infrastructure', cat: 'server_costs' },
                                        { label: '📶 Telecom Float', title: 'VTU & Airtime Top-up Float', cat: 'wholesale_float' },
                                        { label: '🏢 Office & Power', title: 'Office Internet & Power Supply', cat: 'office_supplies' },
                                        { label: '📢 Marketing & Ads', title: 'Social Media & Marketing Campaign', cat: 'marketing' },
                                        { label: '💳 Bank / Gateway', title: 'Payment Gateway Settlement Fees', cat: 'gateway_charges' },
                                        { label: '⚖️ Legal & CAC', title: 'Regulatory Compliance & Filing Fee', cat: 'legal_licensing' },
                                    ].map((preset, pIdx) => (
                                        <TouchableOpacity
                                            key={pIdx}
                                            onPress={() => {
                                                if (Platform.OS !== 'web') Haptics.selectionAsync();
                                                setNewTitle(preset.title);
                                                setNewCategory(preset.cat);
                                            }}
                                            style={styles.presetChip}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.presetChipText}>{preset.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>

                            <Text style={styles.inputLabel}>Expense Title / Description *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g., API Wallet Top-up (BilalSadaSub)"
                                placeholderTextColor={C.textMuted}
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            <Text style={styles.inputLabel}>Amount (₦) *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="0.00"
                                placeholderTextColor={C.textMuted}
                                keyboardType="numeric"
                                value={newAmount}
                                onChangeText={setNewAmount}
                            />

                            <Text style={styles.inputLabel}>Expense Category *</Text>
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
                                            <Ionicons name={cat.icon as any} size={12} color={isSelected ? C.gold : C.textSub} />
                                            <Text style={[styles.catOptionText, isSelected && styles.catOptionTextSelected]}>
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Payment Method</Text>
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

                            <Text style={styles.inputLabel}>Notes / Remarks (Optional)</Text>
                            <TextInput
                                style={[styles.textInput, { height: 64, textAlignVertical: 'top' }]}
                                placeholder="Provide any vendor details, reference code, or comments..."
                                placeholderTextColor={C.textMuted}
                                multiline
                                value={newNotes}
                                onChangeText={setNewNotes}
                            />
                        </ScrollView>

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
                                <LinearGradient colors={[C.navyDark, C.navy]} style={styles.modalSaveGrad}>
                                    {savingExpense ? (
                                        <ActivityIndicator size="small" color={C.goldBright} />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={16} color={C.goldBright} />
                                            <Text style={styles.modalSaveText}>Record Expense</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL 3: SUPER ADMIN CLEARANCE VAULT */}
            <Modal
                visible={clearanceModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setClearanceModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <View style={[styles.modalIconWrap, { backgroundColor: C.goldBg }]}>
                                    <Ionicons name="key" size={16} color={C.gold} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>Clearance Access Vault</Text>
                                    <Text style={styles.clearanceModalSub}>Grant or revoke accounting access</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setClearanceModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.clearanceExplainerBox}>
                            <Ionicons name="information-circle-outline" size={16} color={C.navyMid} />
                            <Text style={styles.clearanceExplainerText}>
                                Authorized administrators gain live visibility into profit margins across all 18 services, customer wallet liabilities, and expense management.
                            </Text>
                        </View>

                        {loadingAdmins ? (
                            <View style={{ padding: 30, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={C.goldBright} />
                                <Text style={styles.adminLoadingText}>Loading Staff Accounts...</Text>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360, marginTop: 8 }}>
                                {adminList.map((admin) => {
                                    const isToggling = togglingAdminEmail === admin.email;
                                    return (
                                        <View key={admin.id} style={styles.adminClearanceRow}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                    <Text style={styles.adminNameText} numberOfLines={1}>{admin.fullName}</Text>
                                                    <View style={[styles.adminRoleBadge, { backgroundColor: admin.isMasterAdmin ? C.goldBg : '#F1F5F9' }]}>
                                                        <Text style={[styles.adminRoleText, { color: admin.isMasterAdmin ? C.gold : C.textSub }]}>
                                                            {admin.role.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.adminEmailText} numberOfLines={1}>{admin.email}</Text>
                                                {admin.isMasterAdmin ? (
                                                    <Text style={styles.adminMasterNotice}>Master Authority (Permanent)</Text>
                                                ) : null}
                                            </View>

                                            {admin.isMasterAdmin ? (
                                                <View style={styles.masterLockBadge}>
                                                    <Ionicons name="lock-closed" size={14} color={C.gold} />
                                                </View>
                                            ) : (
                                                <View style={{ alignItems: 'center' }}>
                                                    {isToggling ? (
                                                        <ActivityIndicator size="small" color={C.goldBright} />
                                                    ) : (
                                                        <Switch
                                                            value={admin.hasClearance}
                                                            onValueChange={() => handleToggleClearance(admin)}
                                                            trackColor={{ false: '#CBD5E1', true: '#FDE68A' }}
                                                            thumbColor={admin.hasClearance ? C.gold : '#94A3B8'}
                                                        />
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            onPress={() => setClearanceModalVisible(false)}
                            style={[styles.modalCancelBtn, { marginTop: 14, width: '100%', alignItems: 'center' }]}
                        >
                            <Text style={styles.modalCancelText}>Close Vault</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 4: WHALE ACCOUNT DETAILS INSPECTOR */}
            <Modal
                visible={!!selectedWhale}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedWhale(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.inspectorCard}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.modalIconWrap, { backgroundColor: C.emeraldBg }]}>
                                    <Ionicons name="wallet" size={18} color={C.emerald} />
                                </View>
                                <Text style={styles.modalTitle}>Customer Deposit Details</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedWhale(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedWhale && (
                            <View style={{ marginTop: 6 }}>
                                <View style={[styles.inspectorHeroBox, { borderColor: C.emeraldBorder, backgroundColor: C.emeraldBg }]}>
                                    <Text style={[styles.inspectorHeroLabel, { color: C.emerald }]}>WALLET LIQUIDITY HELD</Text>
                                    <Text style={[styles.inspectorHeroVal, { color: C.emerald }]}>
                                        {formatNaira(selectedWhale.balance)}
                                    </Text>
                                    <Text style={[styles.inspectorHeroMargin, { color: C.emerald }]}>100% Guaranteed Reserve</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Customer Name</Text>
                                    <Text style={styles.inspectorFieldVal}>{selectedWhale.name}</Text>
                                </View>

                                <View style={styles.inspectorFieldRow}>
                                    <Text style={styles.inspectorFieldLbl}>Email Address</Text>
                                    <TouchableOpacity
                                        onPress={() => copyReference(selectedWhale.email)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Text style={[styles.inspectorFieldVal, { color: C.blue }]}>{selectedWhale.email}</Text>
                                        <Ionicons name="copy-outline" size={13} color={C.blue} />
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.inspectorFieldRow, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.inspectorFieldLbl}>Database User ID</Text>
                                    <TouchableOpacity
                                        onPress={() => copyReference(selectedWhale.id)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Text style={[styles.inspectorFieldVal, { color: C.blue }]} numberOfLines={1}>
                                            {selectedWhale.id.substring(0, 16)}...
                                        </Text>
                                        <Ionicons name="copy-outline" size={13} color={C.blue} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setSelectedWhale(null)}
                                    style={styles.inspectorCloseBtn}
                                >
                                    <Text style={styles.inspectorCloseBtnText}>Close Customer Details</Text>
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: C.bg,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    verifyingText: {
        color: C.navy,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
        marginTop: 14,
    },
    loadingDataText: {
        color: C.textSub,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 10,
    },

    // Access Denied Screen
    deniedContainer: {
        flex: 1,
        backgroundColor: C.bg,
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
        borderWidth: 1,
        borderColor: C.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    deniedIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: C.coralBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.coralBorder,
    },
    deniedTitle: {
        color: C.navy,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
        textAlign: 'center',
        marginBottom: 8,
    },
    deniedSub: {
        color: C.textSub,
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 16,
    },
    deniedAccountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 20,
    },
    deniedAccountEmail: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '700',
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
        color: C.white,
        fontSize: 13,
        fontWeight: '900',
    },

    // Header Bar
    headerBar: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderBottomWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
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
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    headerTitle: {
        color: C.white,
        fontSize: 14.5,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    headerSub: {
        color: C.goldBright,
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginTop: 2,
    },
    headerAdminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.goldBg,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    headerAdminBadgeText: {
        color: C.goldBright,
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },

    // Executive Actions Toolbar (Spacious & Responsive)
    execToolbar: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    execToolBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingVertical: 7,
        paddingHorizontal: 7,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        gap: 6,
    },
    execToolBtnPrimary: {
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        borderColor: C.goldBright,
    },
    execToolIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    execToolIconWrapPrimary: {
        backgroundColor: C.goldBright,
    },
    execToolTextWrap: {
        flex: 1,
    },
    execToolBtnTitle: {
        color: C.white,
        fontSize: 10,
        fontWeight: '800',
    },
    execToolBtnSub: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 7.5,
        fontWeight: '700',
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
        borderColor: 'rgba(245, 158, 11, 0.4)',
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
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    timePillActive: {
        backgroundColor: C.goldBg,
        borderColor: C.goldBright,
    },
    timePillText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
        fontWeight: '700',
    },
    timePillTextActive: {
        color: C.goldBright,
        fontWeight: '900',
    },

    // Tabs
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.28)',
        borderRadius: 14,
        padding: 3,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        borderRadius: 11,
        gap: 5,
    },
    tabItemActive: {
        backgroundColor: C.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
        fontWeight: '700',
    },
    tabTextActive: {
        color: C.navy,
        fontWeight: '900',
    },

    scrollContent: {
        padding: 16,
    },

    // Master Net Profit Hero Card
    netProfitCard: {
        borderRadius: 22,
        padding: 18,
        borderWidth: 1.5,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
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
        paddingVertical: 3.5,
        borderRadius: 10,
        gap: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    netProfitLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
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
        marginBottom: 14,
    },
    metricCard: {
        width: (width - 42) / 2,
        backgroundColor: C.cardBg,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: C.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    metricIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    metricLabel: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    metricValue: {
        color: C.navy,
        fontSize: 15,
        fontWeight: '900',
        marginVertical: 3,
    },
    metricHint: {
        color: C.textMuted,
        fontSize: 9.5,
        fontWeight: '600',
    },

    // User Balance & Liabilities Card
    userBalanceHeroCard: {
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: C.cardBg,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    userBalanceHeroGrad: {
        padding: 16,
    },
    userBalanceTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    userBalanceIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.goldBorder,
    },
    userBalanceTitle: {
        color: C.white,
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    userBalanceSub: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 8.5,
        fontWeight: '600',
    },
    solvencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: 'rgba(5, 150, 105, 0.25)',
        borderWidth: 0.5,
        borderColor: '#059669',
    },
    solvencyBadgeText: {
        color: '#34D399',
        fontSize: 8.5,
        fontWeight: '900',
    },
    userBalanceAmount: {
        color: C.goldBright,
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    userBalanceHint: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        lineHeight: 14,
        marginBottom: 14,
    },
    userBalanceStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    userBalanceStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    userBalanceStatVal: {
        color: C.white,
        fontSize: 12,
        fontWeight: '900',
    },
    userBalanceStatLbl: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 8.5,
        fontWeight: '700',
        marginTop: 1,
    },
    userBalanceStatDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    topHoldersSection: {
        padding: 14,
        backgroundColor: C.cardBg,
    },
    topHoldersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 6,
    },
    topHoldersTitle: {
        color: C.navy,
        fontSize: 11.5,
        fontWeight: '800',
    },
    topHoldersSub: {
        color: C.gold,
        fontSize: 9.5,
        fontWeight: '700',
    },
    holderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    holderRankCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    holderRankText: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '900',
    },
    holderName: {
        color: C.navy,
        fontSize: 11.5,
        fontWeight: '800',
    },
    holderEmail: {
        color: C.textMuted,
        fontSize: 9.5,
    },
    holderBalance: {
        color: C.emerald,
        fontSize: 12,
        fontWeight: '900',
    },

    // Projections Card
    projectionCard: {
        backgroundColor: C.cardBg,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    projectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 10,
    },
    projectionTitle: {
        color: C.navy,
        fontSize: 12.5,
        fontWeight: '900',
    },
    projectionTag: {
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    projectionTagText: {
        color: C.emerald,
        fontSize: 8.5,
        fontWeight: '900',
    },
    projectionGrid: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    projectionCol: {
        flex: 1,
        alignItems: 'center',
    },
    projectionColDivider: {
        width: 1,
        height: 36,
        backgroundColor: '#F1F5F9',
    },
    projectionColLbl: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '700',
    },
    projectionColVal: {
        color: C.navy,
        fontSize: 14,
        fontWeight: '900',
        marginVertical: 2,
    },
    projectionColSub: {
        color: C.textMuted,
        fontSize: 8.5,
        fontWeight: '600',
    },

    // Section styling
    sectionContainer: {
        backgroundColor: C.cardBg,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 10,
    },
    sectionTitle: {
        color: C.navy,
        fontSize: 13,
        fontWeight: '900',
    },
    sectionSubTitle: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
    },

    // Service Search Box
    serviceSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    serviceSearchInput: {
        flex: 1,
        color: C.navy,
        fontSize: 12,
        fontWeight: '600',
        padding: 0,
    },

    // Service Row
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    serviceIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceName: {
        color: C.navy,
        fontSize: 12.5,
        fontWeight: '800',
    },
    serviceMeta: {
        color: C.textSub,
        fontSize: 10,
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
        borderWidth: 0.5,
        borderColor: C.emeraldBorder,
    },
    serviceMarginText: {
        color: C.emerald,
        fontSize: 8.5,
        fontWeight: '800',
    },

    // Quick Add Expense Banner
    quickAddExpenseBanner: {
        marginTop: 4,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    quickAddExpenseGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    quickAddIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.goldBorder,
    },
    quickAddTitle: {
        color: C.white,
        fontSize: 12,
        fontWeight: '800',
    },
    quickAddSub: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 9.5,
        marginTop: 2,
    },

    // Breakdown Cards
    breakdownCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    breakdownCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    breakdownIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    breakdownServiceName: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '800',
    },
    breakdownServiceType: {
        color: C.textSub,
        fontSize: 9.5,
    },
    breakdownTag: {
        backgroundColor: C.goldBg,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: C.goldBorder,
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
        color: C.textSub,
        fontSize: 9,
        fontWeight: '700',
    },
    breakdownColVal: {
        color: C.navy,
        fontSize: 11.5,
        fontWeight: '900',
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
        paddingHorizontal: 12,
        paddingVertical: 7,
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
        paddingVertical: 5,
        borderRadius: 9,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    expFilterPillActive: {
        backgroundColor: C.coralBg,
        borderColor: C.coralBorder,
    },
    expFilterText: {
        color: C.textSub,
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
        borderBottomColor: '#F1F5F9',
    },
    expenseIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expenseTitle: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '800',
    },
    expenseMeta: {
        color: C.textSub,
        fontSize: 9.5,
        marginTop: 2,
    },
    expenseNotes: {
        color: C.gold,
        fontSize: 9.5,
        marginTop: 2,
        fontStyle: 'italic',
    },
    expenseAmount: {
        color: C.coral,
        fontSize: 13,
        fontWeight: '900',
    },
    deleteExpenseBtn: {
        marginTop: 4,
        padding: 4,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    emptyTitle: {
        color: C.navy,
        fontSize: 12.5,
        fontWeight: '800',
        marginTop: 8,
    },
    emptySub: {
        color: C.textSub,
        fontSize: 10.5,
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 20,
    },

    // Transaction Sales Rows
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    txIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txCustomerName: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '800',
    },
    txServiceLabel: {
        color: C.textSub,
        fontSize: 9.5,
        marginTop: 2,
    },
    txRevenue: {
        color: C.navy,
        fontSize: 12.5,
        fontWeight: '900',
    },
    txProfitPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        marginTop: 2,
    },
    txProfitText: {
        color: C.emerald,
        fontSize: 9,
        fontWeight: '900',
    },

    // Inspector Modal
    inspectorCard: {
        backgroundColor: C.cardBg,
        borderRadius: 22,
        padding: 20,
        marginHorizontal: 16,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 6,
    },
    inspectorHeroBox: {
        alignItems: 'center',
        backgroundColor: C.emeraldBg,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        marginBottom: 12,
    },
    inspectorHeroLabel: {
        color: C.emerald,
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    inspectorHeroVal: {
        color: '#065F46',
        fontSize: 24,
        fontWeight: '900',
        marginVertical: 2,
    },
    inspectorHeroMargin: {
        color: C.emerald,
        fontSize: 11,
        fontWeight: '800',
    },
    inspectorFieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    inspectorFieldLbl: {
        color: C.textSub,
        fontSize: 10.5,
        fontWeight: '700',
    },
    inspectorFieldVal: {
        color: C.navy,
        fontSize: 11,
        fontWeight: '800',
    },
    inspectorCloseBtn: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 14,
    },
    inspectorCloseBtnText: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '800',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: isWeb ? 'center' : 'flex-end',
        alignItems: isWeb ? 'center' : 'stretch',
        padding: isWeb ? 20 : 0,
    },
    modalCard: {
        backgroundColor: C.cardBg,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderBottomLeftRadius: isWeb ? 26 : 0,
        borderBottomRightRadius: isWeb ? 26 : 0,
        maxWidth: isWeb ? 640 : '100%',
        width: '100%',
        padding: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 14,
    },
    modalIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.goldBorder,
    },
    modalTitle: {
        color: C.navy,
        fontSize: 14.5,
        fontWeight: '900',
    },
    inputLabel: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 10,
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: C.navy,
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
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    catOptionSelected: {
        backgroundColor: C.goldBg,
        borderColor: C.goldBright,
    },
    catOptionText: {
        color: C.textSub,
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
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    payMethodPillActive: {
        backgroundColor: C.blueBg,
        borderColor: C.blue,
    },
    payMethodText: {
        color: C.textSub,
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
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    modalCancelText: {
        color: C.textSub,
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
        color: C.white,
        fontSize: 12.5,
        fontWeight: '900',
    },

    // --- SMART FINANCIAL HEALTH & ADVISORY ---
    advisoryCard: {
        backgroundColor: C.cardBg,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    advisoryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    solvencyPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
    },
    solvencyPillText: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
    },
    advisoryHeadline: {
        color: C.navy,
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 4,
    },
    advisorySummary: {
        color: C.textSub,
        fontSize: 11.5,
        lineHeight: 16,
        marginBottom: 12,
    },
    advisoryMetricsRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    advisoryMetricCol: {
        flex: 1,
        alignItems: 'center',
    },
    advisoryMetricLbl: {
        color: C.textMuted,
        fontSize: 9.5,
        fontWeight: '700',
        marginBottom: 2,
    },
    advisoryMetricVal: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '900',
    },
    advisoryMetricSub: {
        color: C.textSub,
        fontSize: 9,
        marginTop: 1,
    },
    advisoryDivider: {
        width: 1,
        height: 24,
        backgroundColor: C.cardBorder,
    },
    advisoryRecommendationBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.goldLight,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.goldBorder,
    },
    advisoryRecommendationText: {
        flex: 1,
        color: '#92400E',
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 15,
    },

    // --- MONTHLY NET PROFIT TARGET MILESTONE ---
    targetProgressCard: {
        backgroundColor: C.cardBg,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    targetProgressTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    targetProgressTitle: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '800',
    },
    targetProgressGoal: {
        color: C.blue,
        fontSize: 11,
        fontWeight: '900',
    },
    targetProgressBarTrack: {
        height: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    targetProgressBarFill: {
        height: '100%',
        backgroundColor: C.blue,
        borderRadius: 4,
    },
    targetProgressBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    targetProgressEarned: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '700',
    },
    targetProgressPct: {
        color: C.navy,
        fontSize: 11,
        fontWeight: '900',
    },

    // --- 7-DAY PERFORMANCE TREND BARS ---
    trendChartCard: {
        backgroundColor: C.cardBg,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    trendChartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    trendChartTitle: {
        color: C.navy,
        fontSize: 13,
        fontWeight: '900',
    },
    trendBadge: {
        backgroundColor: C.goldBg,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    trendBadgeText: {
        color: C.gold,
        fontSize: 9.5,
        fontWeight: '900',
    },
    trendBarsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 110,
        paddingTop: 10,
    },
    trendBarCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    trendBarValueText: {
        color: C.textSub,
        fontSize: 8.5,
        fontWeight: '700',
        marginBottom: 4,
    },
    trendBarTrack: {
        width: 14,
        height: 60,
        backgroundColor: '#F1F5F9',
        borderRadius: 7,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        marginBottom: 6,
    },
    trendBarFill: {
        width: '100%',
        borderRadius: 7,
    },
    trendBarDayLabel: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 1,
    },
    trendBarOrdersCount: {
        color: C.textMuted,
        fontSize: 8,
        fontWeight: '600',
    },

    // --- HOLDER INSPECT HINT ---
    holderInspectHint: {
        color: C.blue,
        fontSize: 9,
        fontWeight: '700',
        marginTop: 2,
    },

    // --- SORTING PILLS & PROFIT SHARE ---
    sortPillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    sortPillsLabel: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '700',
        marginRight: 2,
    },
    sortPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    sortPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    sortPillText: {
        color: C.textSub,
        fontSize: 10.5,
        fontWeight: '700',
    },
    sortPillTextActive: {
        color: C.goldBright,
        fontWeight: '900',
    },
    profitShareBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.goldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: C.goldBorder,
    },
    profitShareText: {
        color: C.gold,
        fontSize: 9,
        fontWeight: '800',
    },

    // --- SUPER ADMIN CLEARANCE VAULT MODAL ---
    clearanceModalSub: {
        color: C.textSub,
        fontSize: 10.5,
        marginTop: 1,
    },
    clearanceExplainerBox: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#F1F5F9',
        padding: 10,
        borderRadius: 10,
        marginTop: 10,
        alignItems: 'flex-start',
    },
    clearanceExplainerText: {
        flex: 1,
        color: C.navyMid,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: '500',
    },
    adminLoadingText: {
        color: C.textSub,
        fontSize: 11,
        marginTop: 8,
        fontWeight: '600',
    },
    adminClearanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 8,
    },
    adminNameText: {
        color: C.navy,
        fontSize: 12.5,
        fontWeight: '800',
    },
    adminRoleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    adminRoleText: {
        fontSize: 9,
        fontWeight: '900',
    },
    adminEmailText: {
        color: C.textSub,
        fontSize: 11,
    },
    adminMasterNotice: {
        color: C.gold,
        fontSize: 9.5,
        fontWeight: '700',
        marginTop: 2,
    },
    masterLockBadge: {
        padding: 6,
        backgroundColor: C.goldBg,
        borderRadius: 8,
    },

    // Executive Management Brief Bar
    briefBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.35)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    briefBarTitle: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '900',
    },
    briefBarSub: {
        color: C.textSub,
        fontSize: 9.5,
        marginTop: 2,
    },
    briefCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: C.navy,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.goldBright,
    },
    briefCopyBtnText: {
        color: C.goldBright,
        fontSize: 10.5,
        fontWeight: '900',
    },

    // Services Category Chips
    serviceCatChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    serviceCatChipActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    serviceCatChipText: {
        color: C.textSub,
        fontSize: 10.5,
        fontWeight: '700',
    },
    serviceCatChipTextActive: {
        color: C.goldBright,
        fontWeight: '900',
    },

    // Expense Preset Chips
    presetChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    presetChipText: {
        color: C.navy,
        fontSize: 10.5,
        fontWeight: '700',
    },
});
