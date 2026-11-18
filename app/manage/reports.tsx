import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TextInput,
    Platform,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';
import {
    calculateAccountingMetrics,
    generateProfitLossPDF,
    exportFinancialCSV,
    getFinancialHealthAdvisory,
    formatNaira,
    formatAccountingDate,
    AccountingMetrics,
    ServiceProfitSummary,
    FinancialHealthAdvisory
} from '../../services/accounting';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DateRangeKey = 'today' | '7d' | '30d' | '90d' | 'month' | 'all';
type ViewTabKey = 'overview' | 'services' | 'customers' | 'export';

export default function ModernAdminReportsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [range, setRange] = useState<DateRangeKey>('7d');
    const [activeTab, setActiveTab] = useState<ViewTabKey>('overview');
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

    // Core Metrics State
    const [metrics, setMetrics] = useState<AccountingMetrics | null>(null);
    const [advisory, setAdvisory] = useState<FinancialHealthAdvisory | null>(null);
    const [failedCount, setFailedCount] = useState<number>(0);
    const [pendingCount, setPendingCount] = useState<number>(0);

    // Ledger Search State
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Calculate dates based on selected range
    const getDateBounds = useCallback((rangeKey: DateRangeKey): { startDate?: Date; endDate?: Date; label: string } => {
        const now = new Date();
        const end = new Date(now);

        switch (rangeKey) {
            case 'today': {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                return { startDate: start, endDate: end, label: 'Today (24h)' };
            }
            case '7d': {
                const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return { startDate: start, endDate: end, label: 'Last 7 Days' };
            }
            case '30d': {
                const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return { startDate: start, endDate: end, label: 'Last 30 Days' };
            }
            case '90d': {
                const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                return { startDate: start, endDate: end, label: 'Last 90 Days' };
            }
            case 'month': {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                return { startDate: start, endDate: end, label: 'This Month' };
            }
            case 'all':
            default:
                return { startDate: undefined, endDate: undefined, label: 'All-Time Inception' };
        }
    }, []);

    const fetchAnalysisData = async () => {
        try {
            const { startDate, endDate, label } = getDateBounds(range);

            // 1. Calculate accounting & revenue metrics
            const data = await calculateAccountingMetrics(startDate, endDate);
            setMetrics(data);

            // 2. Financial health advisory
            const health = getFinancialHealthAdvisory(data);
            setAdvisory(health);

            // 3. Query non-successful counts for true success-rate calculation
            let nonSuccessQuery = supabase.from('transactions').select('status', { count: 'exact', head: false });
            if (startDate) nonSuccessQuery = nonSuccessQuery.gte('created_at', startDate.toISOString());
            if (endDate) nonSuccessQuery = nonSuccessQuery.lte('created_at', endDate.toISOString());

            const { data: nonSuccessData } = await nonSuccessQuery.in('status', ['failed', 'reversed', 'error', 'pending', 'processing']);
            if (nonSuccessData) {
                let fails = 0;
                let pendings = 0;
                nonSuccessData.forEach((tx: any) => {
                    const st = (tx.status || '').toLowerCase();
                    if (st === 'pending' || st === 'processing') pendings++;
                    else fails++;
                });
                setFailedCount(fails);
                setPendingCount(pendings);
            }
        } catch (err: any) {
            console.error('[AdminReports] Fetch error:', err);
            Alert.alert('Analysis Notice', err?.message || 'Could not compile live metrics.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchAnalysisData();
    }, [range]);

    const onRefresh = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setRefreshing(true);
        fetchAnalysisData();
    };

    // Export Handlers
    const handleExportPDF = async () => {
        if (!metrics) return;
        setExporting('pdf');
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        try {
            const { label } = getDateBounds(range);
            await generateProfitLossPDF(metrics, label);
        } catch (e: any) {
            Alert.alert('Export Error', e?.message || 'Failed to generate PDF');
        } finally {
            setExporting(null);
        }
    };

    const handleExportCSV = async () => {
        if (!metrics) return;
        setExporting('csv');
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        try {
            const { label } = getDateBounds(range);
            await exportFinancialCSV(metrics, label);
        } catch (e: any) {
            Alert.alert('Export Error', e?.message || 'Failed to generate CSV');
        } finally {
            setExporting(null);
        }
    };

    // Calculate overall success rate
    const successCount = metrics?.successfulTransactionsCount || 0;
    const totalAttempts = successCount + failedCount + pendingCount;
    const successPercentage = totalAttempts > 0 ? ((successCount / totalAttempts) * 100).toFixed(1) : '100.0';

    // Service Breakdown Sorted by Volume
    const sortedServices = useMemo(() => {
        if (!metrics?.serviceBreakdown) return [];
        return Object.values(metrics.serviceBreakdown)
            .filter((s: ServiceProfitSummary) => s.transactionCount > 0 || s.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue);
    }, [metrics]);

    // Filtered Recent Transactions
    const filteredRecentTransactions = useMemo(() => {
        if (!metrics?.recentTransactions) return [];
        if (!searchQuery.trim()) return metrics.recentTransactions.slice(0, 30);
        const q = searchQuery.toLowerCase();
        return metrics.recentTransactions.filter((tx: any) =>
            (tx.reference || '').toLowerCase().includes(q) ||
            (tx.serviceName || '').toLowerCase().includes(q) ||
            (tx.customerName || '').toLowerCase().includes(q) ||
            (tx.customerEmail || '').toLowerCase().includes(q) ||
            String(tx.revenue || tx.amount || '').includes(q)
        ).slice(0, 50);
    }, [metrics, searchQuery]);

    // Service Icon & Color Mapper
    const getServiceTheme = (serviceType: string) => {
        const type = (serviceType || '').toLowerCase();
        if (type.includes('data')) return { icon: 'wifi', color: '#3B82F6', bg: '#EFF6FF' };
        if (type.includes('airtime')) return { icon: 'call', color: '#10B981', bg: '#ECFDF5' };
        if (type.includes('electric') || type.includes('power')) return { icon: 'flash', color: '#F59E0B', bg: '#FFFBEB' };
        if (type.includes('cable') || type.includes('tv')) return { icon: 'tv', color: '#8B5CF6', bg: '#F5F3FF' };
        if (type.includes('fund') || type.includes('deposit') || type.includes('wallet')) return { icon: 'wallet', color: '#059669', bg: '#ECFDF5' };
        if (type.includes('crypto')) return { icon: 'logo-bitcoin', color: '#F97316', bg: '#FFF7ED' };
        if (type.includes('bvn') || type.includes('nin') || type.includes('cac') || type.includes('identity')) return { icon: 'shield-checkmark', color: '#0EA5E9', bg: '#F0F9FF' };
        if (type.includes('social') || type.includes('smm')) return { icon: 'trending-up', color: '#EC4899', bg: '#FDF2F8' };
        return { icon: 'receipt', color: '#64748B', bg: '#F8FAFC' };
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Top Royal Navy Header with Gold Accents */}
            <LinearGradient colors={['#071435', '#0F265C', '#071435']} style={[s.headerGradient, { paddingTop: insets.top + 6 }]}>
                <View style={s.headerTopRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.backBtn}
                        accessibilityLabel="Go Back"
                    >
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={s.headerTitleCol}>
                        <View style={s.badgeLive}>
                            <View style={s.badgeLiveDot} />
                            <Text style={s.badgeLiveText}>LIVE FINANCIAL INTELLIGENCE</Text>
                        </View>
                        <Text style={s.headerMainTitle}>Admin Analytics & Reports</Text>
                    </View>

                    <TouchableOpacity
                        onPress={onRefresh}
                        style={s.refreshBtn}
                        accessibilityLabel="Refresh Metrics"
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color="#F59E0B" />
                        ) : (
                            <Ionicons name="refresh" size={18} color="#F59E0B" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Date Range Selector Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rangeScroll} contentContainerStyle={s.rangeScrollContent}>
                    {[
                        { key: 'today', label: '24h' },
                        { key: '7d', label: '7 Days' },
                        { key: '30d', label: '30 Days' },
                        { key: '90d', label: '90 Days' },
                        { key: 'month', label: 'This Month' },
                        { key: 'all', label: 'All Time' }
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => {
                                setRange(tab.key as DateRangeKey);
                                if (Platform.OS !== 'web') Haptics.selectionAsync();
                            }}
                            style={[s.rangePill, range === tab.key && s.rangePillActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.rangePillText, range === tab.key && s.rangePillTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </LinearGradient>

            {/* Navigation Segment Tabs */}
            <View style={s.segmentBar}>
                {[
                    { id: 'overview', label: 'Overview', icon: 'pie-chart' },
                    { id: 'services', label: 'Services', icon: 'layers' },
                    { id: 'customers', label: 'Users', icon: 'people' },
                    { id: 'export', label: 'Export', icon: 'cloud-download' }
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => {
                                setActiveTab(tab.id as ViewTabKey);
                                if (Platform.OS !== 'web') Haptics.selectionAsync();
                            }}
                            style={[s.segmentTab, isActive && s.segmentTabActive]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={tab.icon as any} size={15} color={isActive ? '#071435' : '#64748B'} />
                            <Text style={[s.segmentTabText, isActive && s.segmentTabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Main Scrollable Content */}
            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0056D2" colors={['#0056D2']} />
                }
            >
                {loading && !refreshing ? (
                    <View style={s.loadingContainer}>
                        <ActivityIndicator size="large" color="#0056D2" />
                        <Text style={s.loadingText}>Compiling Realtime Financial Metrics...</Text>
                        <Text style={s.loadingSubtext}>Querying transactions, service margins & customer liabilities</Text>
                    </View>
                ) : (
                    <>
                        {/* ================= TAB 1: OVERVIEW & PERFORMANCE ================= */}
                        {activeTab === 'overview' && (
                            <View style={s.tabWrapper}>
                                {/* Executive Advisory Banner */}
                                {advisory && (
                                    <View style={s.advisoryCard}>
                                        <View style={s.advisoryHeaderRow}>
                                            <View style={s.advisoryRatingBadge}>
                                                <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
                                                <Text style={s.advisoryRatingText}>HEALTH: {advisory.rating}</Text>
                                            </View>
                                            <Text style={s.advisoryLiquidityBadge}>
                                                Float: {advisory.liquidityStatus}
                                            </Text>
                                        </View>
                                        <Text style={s.advisoryTitle}>{advisory.headline}</Text>
                                        <Text style={s.advisorySummary}>{advisory.summary}</Text>
                                        <View style={s.advisoryMetricsRow}>
                                            <View style={s.advisoryMetricItem}>
                                                <Text style={s.advisoryMetricLabel}>Top Revenue Driver</Text>
                                                <Text style={s.advisoryMetricVal}>{advisory.topDriverName} ({advisory.topDriverShare.toFixed(0)}%)</Text>
                                            </View>
                                            <View style={s.advisoryMetricDivider} />
                                            <View style={s.advisoryMetricItem}>
                                                <Text style={s.advisoryMetricLabel}>Projected 30-Day Net</Text>
                                                <Text style={s.advisoryMetricValGreen}>{formatNaira(metrics?.projectedMonthlyProfit || 0)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Hero 4 KPI Cards in 2x2 Grid */}
                                <View style={s.kpiGrid}>
                                    {/* Gross Transaction Volume (GMV) */}
                                    <View style={s.kpiCard}>
                                        <View style={s.kpiHeaderRow}>
                                            <View style={[s.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                                                <Ionicons name="cash-outline" size={18} color="#2563EB" />
                                            </View>
                                            <Text style={s.kpiBadge}>GMV</Text>
                                        </View>
                                        <Text style={s.kpiLabel}>Gross Volume (GMV)</Text>
                                        <Text style={s.kpiValue}>{formatNaira(metrics?.totalRevenue || 0)}</Text>
                                        <Text style={s.kpiSub}>Total order value processed</Text>
                                    </View>

                                    {/* Net Profit Margin */}
                                    <View style={s.kpiCard}>
                                        <View style={s.kpiHeaderRow}>
                                            <View style={[s.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
                                                <Ionicons name="trending-up" size={18} color="#059669" />
                                            </View>
                                            <Text style={[s.kpiBadge, { backgroundColor: '#D1FAE5', color: '#047857' }]}>
                                                {metrics?.profitMargin ? `${metrics.profitMargin.toFixed(1)}% Margin` : 'Net'}
                                            </Text>
                                        </View>
                                        <Text style={s.kpiLabel}>Net Trading Margin</Text>
                                        <Text style={[s.kpiValue, { color: '#059669' }]}>{formatNaira(metrics?.netProfit || 0)}</Text>
                                        <Text style={s.kpiSub}>Gross profit minus costs</Text>
                                    </View>

                                    {/* Completed Orders Count */}
                                    <View style={s.kpiCard}>
                                        <View style={s.kpiHeaderRow}>
                                            <View style={[s.kpiIconWrap, { backgroundColor: '#F5F3FF' }]}>
                                                <Ionicons name="checkmark-circle-outline" size={18} color="#7C3AED" />
                                            </View>
                                            <Text style={[s.kpiBadge, { backgroundColor: '#EDE9FE', color: '#6D28D9' }]}>
                                                {successPercentage}% Pass
                                            </Text>
                                        </View>
                                        <Text style={s.kpiLabel}>Completed Orders</Text>
                                        <Text style={s.kpiValue}>{successCount.toLocaleString()}</Text>
                                        <Text style={s.kpiSub}>{failedCount > 0 ? `${failedCount} failed / reversed` : 'Zero failed orders'}</Text>
                                    </View>

                                    {/* Total Customer Wallet Liabilities */}
                                    <View style={s.kpiCard}>
                                        <View style={s.kpiHeaderRow}>
                                            <View style={[s.kpiIconWrap, { backgroundColor: '#FFFBEB' }]}>
                                                <Ionicons name="wallet-outline" size={18} color="#D97706" />
                                            </View>
                                            <Text style={[s.kpiBadge, { backgroundColor: '#FEF3C7', color: '#B45309' }]}>Liabilities</Text>
                                        </View>
                                        <Text style={s.kpiLabel}>Customer Wallet Float</Text>
                                        <Text style={[s.kpiValue, { color: '#D97706' }]}>{formatNaira(metrics?.userLiquidity?.totalUserBalances || 0)}</Text>
                                        <Text style={s.kpiSub}>{metrics?.userLiquidity?.fundedUserCount || 0} active funded accounts</Text>
                                    </View>
                                </View>

                                {/* Platform System Health & Success Gauge */}
                                <View style={s.healthCard}>
                                    <View style={s.healthCardHeader}>
                                        <View>
                                            <Text style={s.healthCardTitle}>Order Execution Rate</Text>
                                            <Text style={s.healthCardSub}>Automated vendor API fulfillment status</Text>
                                        </View>
                                        <Text style={s.healthCardRateText}>{successPercentage}%</Text>
                                    </View>

                                    <View style={s.progressBarTrack}>
                                        <View style={[s.progressBarFill, { width: `${Math.min(100, Math.max(10, parseFloat(successPercentage)))}%` }]} />
                                    </View>

                                    <View style={s.healthMetricsRow}>
                                        <View style={s.healthMetricCol}>
                                            <Text style={s.healthMetricNumber}>{successCount}</Text>
                                            <Text style={s.healthMetricName}>Successful</Text>
                                        </View>
                                        <View style={s.healthMetricDivider} />
                                        <View style={s.healthMetricCol}>
                                            <Text style={[s.healthMetricNumber, { color: '#EF4444' }]}>{failedCount}</Text>
                                            <Text style={s.healthMetricName}>Failed</Text>
                                        </View>
                                        <View style={s.healthMetricDivider} />
                                        <View style={s.healthMetricCol}>
                                            <Text style={[s.healthMetricNumber, { color: '#F59E0B' }]}>{pendingCount}</Text>
                                            <Text style={s.healthMetricName}>Pending</Text>
                                        </View>
                                        <View style={s.healthMetricDivider} />
                                        <View style={s.healthMetricCol}>
                                            <Text style={s.healthMetricNumber}>
                                                {successCount > 0 ? formatNaira((metrics?.totalRevenue || 0) / successCount) : '₦0.00'}
                                            </Text>
                                            <Text style={s.healthMetricName}>Avg Ticket</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* 7-Day Revenue Trend Bar Chart */}
                                {metrics?.dailyTrends && metrics.dailyTrends.length > 0 && (
                                    <View style={s.chartCard}>
                                        <View style={s.chartHeaderRow}>
                                            <View>
                                                <Text style={s.chartTitle}>Daily Revenue Trajectory</Text>
                                                <Text style={s.chartSub}>Recent trading volume by calendar day</Text>
                                            </View>
                                            <Text style={s.chartRunRateBadge}>
                                                Run-Rate: {formatNaira(metrics.dailyRunRate)}/day
                                            </Text>
                                        </View>

                                        <View style={s.barsContainer}>
                                            {metrics.dailyTrends.map((pt, idx) => {
                                                const maxRev = Math.max(...metrics.dailyTrends.map(t => t.revenue), 100);
                                                const barHeightPct = Math.min(100, Math.max(12, (pt.revenue / maxRev) * 100));
                                                return (
                                                    <View key={idx} style={s.barCol}>
                                                        <Text style={s.barValueText}>
                                                            {pt.revenue >= 1000 ? `${(pt.revenue / 1000).toFixed(0)}k` : `${pt.revenue.toFixed(0)}`}
                                                        </Text>
                                                        <View style={s.barTrack}>
                                                            <LinearGradient
                                                                colors={['#2563EB', '#1D4ED8']}
                                                                style={[s.barFill, { height: `${barHeightPct}%` }]}
                                                            />
                                                        </View>
                                                        <Text style={s.barDayText}>{pt.dayName.slice(0, 3)}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ================= TAB 2: SERVICE DISTRIBUTION ================= */}
                        {activeTab === 'services' && (
                            <View style={s.tabWrapper}>
                                <View style={s.sectionHeader}>
                                    <View>
                                        <Text style={s.sectionTitle}>Product & Service Matrix</Text>
                                        <Text style={s.sectionSub}>Breakdown of volume, wholesale costs and net margins</Text>
                                    </View>
                                    <View style={s.sectionBadge}>
                                        <Text style={s.sectionBadgeText}>{sortedServices.length} Products</Text>
                                    </View>
                                </View>

                                {sortedServices.length === 0 ? (
                                    <View style={s.emptyBox}>
                                        <Ionicons name="cube-outline" size={40} color="#94A3B8" />
                                        <Text style={s.emptyTitle}>No Service Transactions in Range</Text>
                                        <Text style={s.emptySub}>Select a wider time range like '30 Days' or 'All Time'</Text>
                                    </View>
                                ) : (
                                    sortedServices.map((service, index) => {
                                        const theme = getServiceTheme(service.type);
                                        const totalRev = metrics?.totalRevenue || 1;
                                        const sharePct = ((service.revenue / totalRev) * 100).toFixed(1);

                                        return (
                                            <View key={index} style={s.serviceCard}>
                                                <View style={s.serviceCardHeader}>
                                                    <View style={[s.serviceIconWrap, { backgroundColor: theme.bg }]}>
                                                        <Ionicons name={theme.icon as any} size={20} color={theme.color} />
                                                    </View>
                                                    <View style={s.serviceTitleCol}>
                                                        <Text style={s.serviceName}>{service.serviceName}</Text>
                                                        <Text style={s.serviceMetaText}>
                                                            {service.transactionCount.toLocaleString()} Orders • {sharePct}% Market Share
                                                        </Text>
                                                    </View>
                                                    <View style={s.serviceRevenueCol}>
                                                        <Text style={s.serviceRevenueText}>{formatNaira(service.revenue)}</Text>
                                                        <Text style={s.serviceProfitText}>
                                                            +{formatNaira(service.profit)} ({service.marginPercent.toFixed(1)}%)
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Proportional Volume Bar */}
                                                <View style={s.serviceBarTrack}>
                                                    <View
                                                        style={[
                                                            s.serviceBarFill,
                                                            {
                                                                width: `${Math.min(100, Math.max(4, parseFloat(sharePct)))}%`,
                                                                backgroundColor: theme.color
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}

                        {/* ================= TAB 3: CUSTOMER INTELLIGENCE ================= */}
                        {activeTab === 'customers' && (
                            <View style={s.tabWrapper}>
                                <View style={s.sectionHeader}>
                                    <View>
                                        <Text style={s.sectionTitle}>Customer & Wallet Intelligence</Text>
                                        <Text style={s.sectionSub}>Holdings distribution, KYC adoption & VIP holders</Text>
                                    </View>
                                </View>

                                {/* User Stats Cards Grid */}
                                <View style={s.kpiGrid}>
                                    <View style={s.kpiCard}>
                                        <Text style={s.kpiLabel}>Total Registered Users</Text>
                                        <Text style={s.kpiValue}>{metrics?.userLiquidity?.totalUserCount || 0}</Text>
                                        <Text style={s.kpiSub}>Profiles in database</Text>
                                    </View>
                                    <View style={s.kpiCard}>
                                        <Text style={s.kpiLabel}>Funded Accounts</Text>
                                        <Text style={[s.kpiValue, { color: '#059669' }]}>{metrics?.userLiquidity?.fundedUserCount || 0}</Text>
                                        <Text style={s.kpiSub}>Active wallets holding balances</Text>
                                    </View>
                                    <View style={s.kpiCard}>
                                        <Text style={s.kpiLabel}>Average User Balance</Text>
                                        <Text style={s.kpiValue}>{formatNaira(metrics?.userLiquidity?.averageUserBalance || 0)}</Text>
                                        <Text style={s.kpiSub}>Per funded customer wallet</Text>
                                    </View>
                                    <View style={s.kpiCard}>
                                        <Text style={s.kpiLabel}>Total Liabilities</Text>
                                        <Text style={[s.kpiValue, { color: '#D97706' }]}>{formatNaira(metrics?.userLiquidity?.totalUserBalances || 0)}</Text>
                                        <Text style={s.kpiSub}>Total held user funds</Text>
                                    </View>
                                </View>

                                {/* VIP Top Customer Balance Holders */}
                                <View style={s.topHoldersCard}>
                                    <View style={s.topHoldersHeader}>
                                        <Ionicons name="ribbon" size={18} color="#D97706" />
                                        <Text style={s.topHoldersTitle}>Highest Balance Holders (VIP Wallets)</Text>
                                    </View>

                                    {metrics?.userLiquidity?.topHolders && metrics.userLiquidity.topHolders.length > 0 ? (
                                        metrics.userLiquidity.topHolders.map((holder, idx) => (
                                            <View key={holder.id || idx} style={s.holderRow}>
                                                <View style={s.holderRankBadge}>
                                                    <Text style={s.holderRankText}>#{idx + 1}</Text>
                                                </View>
                                                <View style={s.holderInfoCol}>
                                                    <Text style={s.holderName} numberOfLines={1}>{holder.name || 'Valued Customer'}</Text>
                                                    <Text style={s.holderEmail} numberOfLines={1}>{holder.email || 'customer@abumafhal.com.ng'}</Text>
                                                </View>
                                                <Text style={s.holderBalanceText}>{formatNaira(holder.balance)}</Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={s.emptyHoldersText}>No funded user balances recorded.</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ================= TAB 4: EXPORT & REPORTS ================= */}
                        {activeTab === 'export' && (
                            <View style={s.tabWrapper}>
                                <View style={s.sectionHeader}>
                                    <View>
                                        <Text style={s.sectionTitle}>Institutional Report Generator</Text>
                                        <Text style={s.sectionSub}>Generate compliant executive PDF & CSV spreadsheets</Text>
                                    </View>
                                </View>

                                {/* Export Cards Container */}
                                <View style={s.exportOptionsCard}>
                                    <View style={s.exportSummaryBox}>
                                        <Text style={s.exportSummaryTitle}>Reporting Scope</Text>
                                        <View style={s.exportSummaryRow}>
                                            <Text style={s.exportSummaryLabel}>Time Range:</Text>
                                            <Text style={s.exportSummaryVal}>{getDateBounds(range).label}</Text>
                                        </View>
                                        <View style={s.exportSummaryRow}>
                                            <Text style={s.exportSummaryLabel}>Completed Transactions:</Text>
                                            <Text style={s.exportSummaryVal}>{successCount.toLocaleString()}</Text>
                                        </View>
                                        <View style={s.exportSummaryRow}>
                                            <Text style={s.exportSummaryLabel}>Gross Volume Covered:</Text>
                                            <Text style={s.exportSummaryVal}>{formatNaira(metrics?.totalRevenue || 0)}</Text>
                                        </View>
                                        <View style={s.exportSummaryRow}>
                                            <Text style={s.exportSummaryLabel}>Net Trading Margin:</Text>
                                            <Text style={s.exportSummaryVal}>{formatNaira(metrics?.netProfit || 0)}</Text>
                                        </View>
                                    </View>

                                    {/* Action 1: Executive PDF Generator */}
                                    <TouchableOpacity
                                        onPress={handleExportPDF}
                                        disabled={!!exporting}
                                        style={[s.exportActionBtn, s.exportPdfBtn]}
                                        activeOpacity={0.85}
                                    >
                                        {exporting === 'pdf' ? (
                                            <ActivityIndicator color="#FFFFFF" size="small" />
                                        ) : (
                                            <>
                                                <View style={s.exportActionIconWrap}>
                                                    <Ionicons name="document-text" size={20} color="#DC2626" />
                                                </View>
                                                <View style={s.exportActionCol}>
                                                    <Text style={s.exportActionTitle}>Generate Executive PDF Statement</Text>
                                                    <Text style={s.exportActionSub}>Official formatted A4 summary statement with tables & branding</Text>
                                                </View>
                                                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {/* Action 2: Excel / CSV Spreadsheet Generator */}
                                    <TouchableOpacity
                                        onPress={handleExportCSV}
                                        disabled={!!exporting}
                                        style={[s.exportActionBtn, s.exportCsvBtn]}
                                        activeOpacity={0.85}
                                    >
                                        {exporting === 'csv' ? (
                                            <ActivityIndicator color="#071435" size="small" />
                                        ) : (
                                            <>
                                                <View style={[s.exportActionIconWrap, { backgroundColor: '#DCFCE7' }]}>
                                                    <Ionicons name="grid" size={20} color="#16A34A" />
                                                </View>
                                                <View style={s.exportActionCol}>
                                                    <Text style={[s.exportActionTitle, { color: '#071435' }]}>Export Excel / CSV Spreadsheet</Text>
                                                    <Text style={[s.exportActionSub, { color: '#64748B' }]}>Complete raw transactions ledger with reference IDs & costs</Text>
                                                </View>
                                                <Ionicons name="share-outline" size={20} color="#071435" />
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ================= RECENT LIVE TRANSACTION AUDIT TRAIL ================= */}
                        <View style={s.ledgerSection}>
                            <View style={s.ledgerHeaderRow}>
                                <View>
                                    <Text style={s.ledgerTitle}>Recent Sales Audit Trail</Text>
                                    <Text style={s.ledgerSub}>Live transaction stream for selected period</Text>
                                </View>
                                <Text style={s.ledgerCountBadge}>{filteredRecentTransactions.length} records</Text>
                            </View>

                            {/* Search Filter Bar */}
                            <View style={s.searchBar}>
                                <Ionicons name="search" size={16} color="#94A3B8" />
                                <TextInput
                                    style={s.searchInput}
                                    placeholder="Filter by Ref, customer name, email, or service..."
                                    placeholderTextColor="#94A3B8"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Transactions List */}
                            {filteredRecentTransactions.length === 0 ? (
                                <View style={s.emptyBox}>
                                    <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                                    <Text style={s.emptySub}>No transactions matching your filter</Text>
                                </View>
                            ) : (
                                filteredRecentTransactions.map((tx: any, idx: number) => {
                                    const theme = getServiceTheme(tx.serviceName || tx.type);
                                    const ref = tx.reference || tx.id || `TX_${idx}`;
                                    const amountVal = tx.revenue !== undefined ? tx.revenue : (parseFloat(tx.amount) || 0);

                                    return (
                                        <View key={tx.id || idx} style={s.txCard}>
                                            <View style={[s.txIconWrap, { backgroundColor: theme.bg }]}>
                                                <Ionicons name={theme.icon as any} size={18} color={theme.color} />
                                            </View>
                                            <View style={s.txInfoCol}>
                                                <Text style={s.txTitle} numberOfLines={1}>
                                                    {tx.serviceName || tx.description || 'Order Fulfilled'}
                                                </Text>
                                                <Text style={s.txRefText} numberOfLines={1}>
                                                    Ref: {ref} • {tx.customerEmail || tx.customerName || 'Customer'}
                                                </Text>
                                                <Text style={s.txDateText}>
                                                    {formatAccountingDate(tx.created_at, true)}
                                                </Text>
                                            </View>
                                            <View style={s.txAmountCol}>
                                                <Text style={s.txAmountText}>{formatNaira(amountVal)}</Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Clipboard.setStringAsync(ref);
                                                        Alert.alert('Copied', `Transaction reference ${ref} copied to clipboard.`);
                                                    }}
                                                    style={s.txCopyPill}
                                                >
                                                    <Text style={s.txCopyText}>Copy Ref</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleCol: {
        flex: 1,
        marginLeft: 12,
    },
    badgeLive: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2,
    },
    badgeLiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    badgeLiveText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#F59E0B',
        letterSpacing: 0.6,
    },
    headerMainTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rangeScroll: {
        marginTop: 4,
    },
    rangeScrollContent: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 16,
    },
    rangePill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    rangePillActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    rangePillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#E2E8F0',
    },
    rangePillTextActive: {
        color: '#071435',
        fontWeight: '800',
    },
    segmentBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    segmentTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 8,
    },
    segmentTabActive: {
        backgroundColor: '#F1F5F9',
    },
    segmentTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    segmentTabTextActive: {
        color: '#071435',
        fontWeight: '800',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    loadingContainer: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    loadingSubtext: {
        marginTop: 6,
        fontSize: 12,
        color: '#64748B',
    },
    tabWrapper: {
        marginBottom: 16,
    },
    advisoryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    advisoryHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    advisoryRatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#059669',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    advisoryRatingText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.4,
    },
    advisoryLiquidityBadge: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    advisoryTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    advisorySummary: {
        fontSize: 12,
        lineHeight: 18,
        color: '#475569',
        marginBottom: 12,
    },
    advisoryMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 10,
    },
    advisoryMetricItem: {
        flex: 1,
    },
    advisoryMetricDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 10,
    },
    advisoryMetricLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 2,
    },
    advisoryMetricVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    advisoryMetricValGreen: {
        fontSize: 12,
        fontWeight: '800',
        color: '#059669',
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    kpiCard: {
        width: (SCREEN_WIDTH - 44) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    kpiHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    kpiIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiBadge: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#EFF6FF',
        color: '#1D4ED8',
    },
    kpiLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 4,
    },
    kpiValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    kpiSub: {
        fontSize: 10,
        color: '#94A3B8',
    },
    healthCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    healthCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    healthCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    healthCardSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    healthCardRateText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#059669',
    },
    progressBarTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        marginBottom: 14,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: 4,
    },
    healthMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    healthMetricCol: {
        flex: 1,
        alignItems: 'center',
    },
    healthMetricNumber: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    healthMetricName: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
    healthMetricDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#E2E8F0',
    },
    chartCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    chartSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    chartRunRateBadge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2563EB',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 120,
        paddingTop: 10,
    },
    barCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    barValueText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 4,
    },
    barTrack: {
        width: 14,
        height: 80,
        backgroundColor: '#F1F5F9',
        borderRadius: 7,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    barFill: {
        width: '100%',
        borderRadius: 7,
    },
    barDayText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 6,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    sectionSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    sectionBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    sectionBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#2563EB',
    },
    serviceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    serviceCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    serviceTitleCol: {
        flex: 1,
    },
    serviceName: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    serviceMetaText: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    serviceRevenueCol: {
        alignItems: 'flex-end',
    },
    serviceRevenueText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    serviceProfitText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#059669',
        marginTop: 2,
    },
    serviceBarTrack: {
        height: 5,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    serviceBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    topHoldersCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    topHoldersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    topHoldersTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    holderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    holderRankBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    holderRankText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#B45309',
    },
    holderInfoCol: {
        flex: 1,
    },
    holderName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    holderEmail: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    holderBalanceText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#059669',
    },
    emptyHoldersText: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 12,
        paddingVertical: 16,
    },
    exportOptionsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    exportSummaryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    exportSummaryTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#071435',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    exportSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    exportSummaryLabel: {
        fontSize: 12,
        color: '#64748B',
    },
    exportSummaryVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    exportActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
    },
    exportPdfBtn: {
        backgroundColor: '#071435',
    },
    exportCsvBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    exportActionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    exportActionCol: {
        flex: 1,
        marginRight: 8,
    },
    exportActionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    exportActionSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2,
    },
    ledgerSection: {
        marginTop: 8,
    },
    ledgerHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    ledgerTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    ledgerSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    ledgerCountBadge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
        gap: 8,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: '#0F172A',
    },
    txCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    txIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    txInfoCol: {
        flex: 1,
        marginRight: 8,
    },
    txTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
    },
    txRefText: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 2,
    },
    txDateText: {
        fontSize: 9,
        color: '#94A3B8',
        marginTop: 2,
    },
    txAmountCol: {
        alignItems: 'flex-end',
    },
    txAmountText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    txCopyPill: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#F1F5F9',
    },
    txCopyText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#2563EB',
    },
    emptyBox: {
        paddingVertical: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
        marginTop: 8,
    },
    emptySub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 3,
    },
});
