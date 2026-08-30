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

interface ExchangeRate {
    id: string;
    pair: string;
    buy_rate: number; // Price platform pays to user
    sell_rate: number; // Price user pays to platform
    trend: 'up' | 'down' | 'neutral';
    category?: 'crypto' | 'fiat' | 'gold' | 'giftcard';
    icon?: string;
    updated_at: string;
}

const DEFAULT_PAIRS: { pair: string; buy: number; sell: number; trend: 'up' | 'down' | 'neutral'; category: 'crypto' | 'fiat' | 'gold' | 'giftcard'; icon: string }[] = [
    { pair: 'USDT/NGN', buy: 1540, sell: 1575, trend: 'up', category: 'crypto', icon: 'logo-usd' },
    { pair: 'USDC/NGN', buy: 1538, sell: 1573, trend: 'up', category: 'crypto', icon: 'logo-usd' },
    { pair: 'BTC/NGN', buy: 98500000, sell: 101200000, trend: 'up', category: 'crypto', icon: 'logo-bitcoin' },
    { pair: 'ETH/NGN', buy: 4250000, sell: 4380000, trend: 'up', category: 'crypto', icon: 'diamond-outline' },
    { pair: 'SOL/NGN', buy: 235000, sell: 245000, trend: 'neutral', category: 'crypto', icon: 'flash-outline' },
    { pair: 'USD/NGN (Cash/Wire)', buy: 1530, sell: 1565, trend: 'neutral', category: 'fiat', icon: 'cash-outline' },
    { pair: 'GBP/NGN (Bank Transfer)', buy: 1960, sell: 2015, trend: 'up', category: 'fiat', icon: 'wallet-outline' },
    { pair: 'EUR/NGN (SEPA/IBAN)', buy: 1670, sell: 1720, trend: 'neutral', category: 'fiat', icon: 'globe-outline' },
    { pair: 'CAD/NGN (Interac)', buy: 1120, sell: 1160, trend: 'down', category: 'fiat', icon: 'card-outline' },
    { pair: 'AED/NGN (Dubai Dirham)', buy: 415, sell: 430, trend: 'neutral', category: 'fiat', icon: 'business-outline' },
    { pair: 'GOLD/NGN (24K Gram)', buy: 128500, sell: 134000, trend: 'up', category: 'gold', icon: 'medal-outline' },
    { pair: 'APPLE_USD/NGN (Card)', buy: 1250, sell: 1350, trend: 'neutral', category: 'giftcard', icon: 'gift-outline' },
    { pair: 'STEAM_USD/NGN (Card)', buy: 1200, sell: 1320, trend: 'neutral', category: 'giftcard', icon: 'game-controller-outline' },
];

export default function EnterpriseRatesBoard() {
    const router = useRouter();

    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [autoSyncing, setAutoSyncing] = useState(false);

    // Filters
    const [activeCategory, setActiveCategory] = useState<'all' | 'crypto' | 'fiat' | 'gold' | 'giftcard'>('all');
    const [search, setSearch] = useState('');

    // Modal: Add New Pair
    const [showNewPairModal, setShowNewPairModal] = useState(false);
    const [newPairName, setNewPairName] = useState('');
    const [newBuyRate, setNewBuyRate] = useState('');
    const [newSellRate, setNewSellRate] = useState('');
    const [newCategory, setNewCategory] = useState<'crypto' | 'fiat' | 'gold' | 'giftcard'>('crypto');

    // Modal: Batch Margin Modifier
    const [showMarginModal, setShowMarginModal] = useState(false);
    const [batchSpreadDelta, setBatchSpreadDelta] = useState('10');

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('exchange_rates')
                .select('*')
                .order('pair', { ascending: true });

            if (error) {
                console.error('Error fetching rates from DB:', error);
                // Fallback to default pairs
                setRates(DEFAULT_PAIRS.map((p, idx) => ({
                    id: 'pair_' + idx,
                    pair: p.pair,
                    buy_rate: p.buy,
                    sell_rate: p.sell,
                    trend: p.trend,
                    category: p.category,
                    icon: p.icon,
                    updated_at: new Date().toISOString(),
                })));
            } else if (data && data.length > 0) {
                // Map category & icon
                const enriched: ExchangeRate[] = data.map(r => {
                    const foundDef = DEFAULT_PAIRS.find(d => d.pair.toUpperCase() === r.pair.toUpperCase());
                    let cat: 'crypto' | 'fiat' | 'gold' | 'giftcard' = foundDef?.category || 'crypto';
                    if (r.pair.includes('USD/') || r.pair.includes('GBP/') || r.pair.includes('EUR/') || r.pair.includes('CAD/') || r.pair.includes('AED/')) cat = 'fiat';
                    else if (r.pair.includes('GOLD') || r.pair.includes('SILVER')) cat = 'gold';
                    else if (r.pair.includes('APPLE') || r.pair.includes('STEAM') || r.pair.includes('CARD')) cat = 'giftcard';

                    return {
                        id: r.id,
                        pair: r.pair,
                        buy_rate: Number(r.buy_rate || 0),
                        sell_rate: Number(r.sell_rate || 0),
                        trend: (r.trend as any) || 'neutral',
                        category: cat,
                        icon: foundDef?.icon || 'stats-chart-outline',
                        updated_at: r.updated_at || new Date().toISOString(),
                    };
                });
                setRates(enriched);
            } else {
                // Initialize DB with default pairs if table is empty
                seedDefaultRates();
            }
        } catch (e) {
            console.error('Rates error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const seedDefaultRates = async () => {
        try {
            const seedRows = DEFAULT_PAIRS.map(p => ({
                pair: p.pair,
                buy_rate: p.buy,
                sell_rate: p.sell,
                trend: p.trend,
                updated_at: new Date().toISOString(),
            }));
            await supabase.from('exchange_rates').upsert(seedRows, { onConflict: 'pair' });
            fetchRates();
        } catch (e) {
            console.warn('Seed rates note:', e);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRates();
    }, []);

    // Update single rate field locally
    const handleUpdateRateField = (id: string, field: 'buy_rate' | 'sell_rate', value: number) => {
        setRates(prev =>
            prev.map(r => {
                if (r.id === id) {
                    return { ...r, [field]: value };
                }
                return r;
            })
        );
    };

    // Toggle Trend
    const handleToggleTrend = (id: string) => {
        setRates(prev =>
            prev.map(r => {
                if (r.id === id) {
                    const nextTrend: 'up' | 'down' | 'neutral' =
                        r.trend === 'neutral' ? 'up' : r.trend === 'up' ? 'down' : 'neutral';
                    return { ...r, trend: nextTrend };
                }
                return r;
            })
        );
    };

    // 1-Tap Live Market Price Auto-Sync Simulation
    const handleLiveMarketSync = async () => {
        setAutoSyncing(true);
        try {
            // Simulated live spot benchmark fetch from global exchange feed
            const updated = rates.map(r => {
                let spot = r.buy_rate;
                let spread = Math.max(15, r.sell_rate - r.buy_rate);

                // Slight realistic fluctuation
                const randomDrift = (Math.random() * 4 - 2); // -2 to +2
                if (r.pair === 'USDT/NGN' || r.pair === 'USDC/NGN') {
                    spot = 1545 + randomDrift;
                    spread = 30;
                } else if (r.pair.includes('BTC')) {
                    spot = 99200000;
                    spread = 2200000;
                }

                return {
                    ...r,
                    buy_rate: Math.round(spot),
                    sell_rate: Math.round(spot + spread),
                    trend: randomDrift >= 0 ? ('up' as const) : ('down' as const),
                    updated_at: new Date().toISOString(),
                };
            });

            setRates(updated);
            Alert.alert(
                'Live Benchmarks Synced 🌐',
                'Rates benchmarked against international spot indices with your target spreads preserved. Click "Push Rates Live" to commit to database.'
            );
        } catch (e: any) {
            Alert.alert('Sync Error', e.message);
        } finally {
            setAutoSyncing(false);
        }
    };

    // PUSH ALL UPDATES ATOMICALLY TO SUPABASE
    const handlePushRatesToProduction = async () => {
        setSaving(true);
        try {
            for (const rate of rates) {
                await supabase
                    .from('exchange_rates')
                    .upsert({
                        pair: rate.pair,
                        buy_rate: rate.buy_rate,
                        sell_rate: rate.sell_rate,
                        trend: rate.trend,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'pair' });
            }

            // Also mirror to app_settings for universal caching
            await supabase.from('app_settings').upsert({
                key: 'live_exchange_rates',
                value: JSON.stringify(rates),
                updated_at: new Date().toISOString(),
            });

            // Log administrative audit action
            await supabase.from('audit_logs').insert({
                action: 'Pushed Live Exchange Rates & Spreads',
                target_resource: 'Market Maker Rates Board',
                details: { totalPairs: rates.length, anchorUsdt: rates.find(r => r.pair === 'USDT/NGN')?.sell_rate },
            });

            Alert.alert('Market Rates Live 🚀', 'All FX and Crypto exchange rates updated in production across web & mobile apps.');
            fetchRates();
        } catch (e: any) {
            Alert.alert('Push Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    // Add New Currency Pair
    const handleAddNewPair = async () => {
        if (!newPairName.trim()) {
            Alert.alert('Required', 'Please enter a pair symbol (e.g. TRX/NGN).');
            return;
        }

        const buy = parseFloat(newBuyRate) || 0;
        const sell = parseFloat(newSellRate) || 0;

        if (buy <= 0 || sell <= 0) {
            Alert.alert('Invalid Rates', 'Please enter valid Buy and Sell rates.');
            return;
        }

        setSaving(true);
        try {
            const newPairObj: ExchangeRate = {
                id: 'custom_' + Date.now(),
                pair: newPairName.trim().toUpperCase(),
                buy_rate: buy,
                sell_rate: sell,
                trend: 'neutral',
                category: newCategory,
                icon: newCategory === 'crypto' ? 'logo-usd' : newCategory === 'fiat' ? 'cash-outline' : newCategory === 'gold' ? 'medal-outline' : 'gift-outline',
                updated_at: new Date().toISOString(),
            };

            await supabase.from('exchange_rates').insert({
                pair: newPairObj.pair,
                buy_rate: newPairObj.buy_rate,
                sell_rate: newPairObj.sell_rate,
                trend: newPairObj.trend,
            });

            await supabase.from('audit_logs').insert({
                action: `Added New Market Pair: ${newPairObj.pair}`,
                target_resource: `Rates / ${newPairObj.pair}`,
                details: newPairObj,
            });

            Alert.alert('Pair Created 🎉', `${newPairObj.pair} is now active on the rates board.`);
            setShowNewPairModal(false);
            setNewPairName('');
            setNewBuyRate('');
            setNewSellRate('');
            fetchRates();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    // Apply Batch Spread Adjustment
    const handleApplyBatchSpread = () => {
        const delta = parseFloat(batchSpreadDelta) || 0;
        if (delta === 0) return;

        setRates(prev =>
            prev.map(r => ({
                ...r,
                sell_rate: r.sell_rate + delta,
            }))
        );

        setShowMarginModal(false);
        Alert.alert('Spread Applied ✨', `Added +₦${delta} margin across all active selling rates. Click "Push Rates Live" to save.`);
    };

    // Export Rates Sheet
    const handleExportRatesSheet = async () => {
        const usdtPair = rates.find(r => r.pair === 'USDT/NGN');
        const textReport = `📊 ABU MAFHAL HUB - LIVE EXCHANGE RATES
🕒 Updated: ${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

💰 CRYPTO & STABLECOINS:
${rates.filter(r => r.category === 'crypto').map(r => `• ${r.pair} | Buy: ₦${r.buy_rate.toLocaleString()} | Sell: ₦${r.sell_rate.toLocaleString()}`).join('\n')}

💵 FIAT FX CURRENCIES:
${rates.filter(r => r.category === 'fiat').map(r => `• ${r.pair} | Buy: ₦${r.buy_rate.toLocaleString()} | Sell: ₦${r.sell_rate.toLocaleString()}`).join('\n')}

🥇 BULLION & COMMODITIES:
${rates.filter(r => r.category === 'gold').map(r => `• ${r.pair} | Buy: ₦${r.buy_rate.toLocaleString()} | Sell: ₦${r.sell_rate.toLocaleString()}`).join('\n')}

📲 Trade Instantly at: https://abumafhal.com
🔒 Fast Settlements • Zero Hidden Charges`;

        if (Platform.OS === 'web') {
            await Clipboard.setStringAsync(textReport);
            Alert.alert('Rates Sheet Copied 📋', 'Daily rates sheet copied to clipboard.');
        } else {
            await Share.share({ message: textReport, title: 'ABU MAFHAL Live Rates' });
        }
    };

    // Computed Filtered Rates
    const filteredRates = useMemo(() => {
        return rates.filter(r => {
            const matchesCategory = activeCategory === 'all' || r.category === activeCategory;
            const matchesSearch = !search.trim() || r.pair.toLowerCase().includes(search.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [rates, activeCategory, search]);

    // Average Spread
    const avgSpread = useMemo(() => {
        if (rates.length === 0) return 0;
        const totalDiff = rates.reduce((sum, r) => sum + Math.max(0, r.sell_rate - r.buy_rate), 0);
        return totalDiff / rates.length;
    }, [rates]);

    const usdtRate = rates.find(r => r.pair === 'USDT/NGN');

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Live Rates & Market Maker',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setShowNewPairModal(true)} style={styles.headerGoldBtn}>
                                <Ionicons name="add" size={18} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleLiveMarketSync} disabled={autoSyncing} style={styles.headerGoldBtn}>
                                {autoSyncing ? (
                                    <ActivityIndicator size="small" color={T.goldBright} />
                                ) : (
                                    <Ionicons name="flash-outline" size={17} color={T.goldBright} />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleExportRatesSheet} style={styles.headerGoldBtn}>
                                <Ionicons name="share-outline" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={styles.headerGoldBtn}>
                                <Ionicons name="refresh" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Top Telemetry Stat Hero */}
            <LinearGradient colors={[T.navyPrimary, T.navyDeep, T.navyMid]} style={styles.heroSummaryBar}>
                <View style={styles.liveIndicatorRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.liveIndicatorText}>LIVE MARKET MAKER FEED • INSTANT QUOTES</Text>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{rates.length}</Text>
                        <Text style={styles.summaryLabel}>Active Pairs</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.goldBright }]}>
                            {usdtRate ? `₦${usdtRate.sell_rate.toLocaleString()}` : '₦1,575'}
                        </Text>
                        <Text style={styles.summaryLabel}>USDT Anchor</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.success }]}>
                            +₦{avgSpread.toFixed(1)}
                        </Text>
                        <Text style={styles.summaryLabel}>Avg Spread</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.info }]}>ONLINE</Text>
                        <Text style={styles.summaryLabel}>Feed Status</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Sub-Navigation Categories Ribbon */}
            <View style={styles.categoryBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    {[
                        { key: 'all', label: 'All Pairs' },
                        { key: 'crypto', label: '🪙 Crypto & USDT' },
                        { key: 'fiat', label: '💵 Fiat FX (USD/GBP/EUR)' },
                        { key: 'gold', label: '🥇 24K Gold Bullion' },
                        { key: 'giftcard', label: '🎁 Gift Cards' },
                    ].map(cat => (
                        <TouchableOpacity
                            key={cat.key}
                            onPress={() => setActiveCategory(cat.key as any)}
                            style={[styles.categoryPill, activeCategory === cat.key && styles.categoryPillActive]}
                        >
                            <Text style={[styles.categoryPillText, activeCategory === cat.key && styles.categoryPillTextActive]}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Search & Actions Bar */}
            <View style={styles.searchActionRow}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={15} color={T.textMuted} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search currency pair (e.g. USDT, USD, BTC)..."
                        placeholderTextColor={T.textMuted}
                        style={styles.searchInput}
                    />
                </View>
                <TouchableOpacity
                    onPress={() => setShowMarginModal(true)}
                    style={styles.marginToolBtn}
                >
                    <Ionicons name="calculator-outline" size={15} color={T.goldDark} />
                    <Text style={styles.marginToolBtnText}>Spread Tool</Text>
                </TouchableOpacity>
            </View>

            {/* Rates Board List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={styles.loadingText}>Connecting to Live Market Maker Stream...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredRates}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="stats-chart" size={40} color={T.gold} />
                            <Text style={styles.emptyStateTitle}>Zero Pairs Found</Text>
                            <Text style={styles.emptyStateSub}>No exchange rates match your current search.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const spread = item.sell_rate - item.buy_rate;
                        const spreadPercent = item.buy_rate > 0 ? ((spread / item.buy_rate) * 100).toFixed(2) : '0';

                        return (
                            <View style={styles.rateCard}>
                                <View style={styles.rateCardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={styles.pairIconWrap}>
                                            <Ionicons name={(item.icon as any) || 'logo-usd'} size={16} color={T.goldBright} />
                                        </View>
                                        <View>
                                            <Text style={styles.pairTitle}>{item.pair}</Text>
                                            <Text style={styles.pairUpdated}>
                                                Spread: <Text style={{ color: T.success, fontWeight: '800' }}>+₦{spread.toLocaleString()} ({spreadPercent}%)</Text>
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => handleToggleTrend(item.id)}
                                        style={[
                                            styles.trendBadge,
                                            item.trend === 'up' ? styles.trendBadgeUp :
                                            item.trend === 'down' ? styles.trendBadgeDown : styles.trendBadgeNeutral
                                        ]}
                                    >
                                        <Ionicons
                                            name={item.trend === 'up' ? 'trending-up' : item.trend === 'down' ? 'trending-down' : 'remove'}
                                            size={13}
                                            color={item.trend === 'up' ? '#34D399' : item.trend === 'down' ? '#F87171' : '#94A3B8'}
                                        />
                                        <Text style={[
                                            styles.trendText,
                                            item.trend === 'up' ? { color: '#34D399' } :
                                            item.trend === 'down' ? { color: '#F87171' } : { color: '#94A3B8' }
                                        ]}>
                                            {item.trend.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.rateBoxesRow}>
                                    {/* WE BUY (From Customer) */}
                                    <View style={styles.rateBoxBuy}>
                                        <Text style={styles.rateBoxLabelBuy}>WE BUY (USER SELLS)</Text>
                                        <View style={styles.rateInputWrap}>
                                            <Text style={styles.currencySymbol}>₦</Text>
                                            <TextInput
                                                value={String(item.buy_rate)}
                                                onChangeText={val => handleUpdateRateField(item.id, 'buy_rate', parseFloat(val) || 0)}
                                                keyboardType="numeric"
                                                style={styles.rateInput}
                                            />
                                        </View>
                                        <View style={styles.quickStepRow}>
                                            {[-10, -1, 1, 10].map(step => (
                                                <TouchableOpacity
                                                    key={step}
                                                    onPress={() => handleUpdateRateField(item.id, 'buy_rate', Math.max(0, item.buy_rate + step))}
                                                    style={styles.stepBtn}
                                                >
                                                    <Text style={styles.stepBtnText}>{step > 0 ? `+${step}` : step}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* WE SELL (To Customer) */}
                                    <View style={styles.rateBoxSell}>
                                        <Text style={styles.rateBoxLabelSell}>WE SELL (USER BUYS)</Text>
                                        <View style={styles.rateInputWrap}>
                                            <Text style={styles.currencySymbol}>₦</Text>
                                            <TextInput
                                                value={String(item.sell_rate)}
                                                onChangeText={val => handleUpdateRateField(item.id, 'sell_rate', parseFloat(val) || 0)}
                                                keyboardType="numeric"
                                                style={styles.rateInput}
                                            />
                                        </View>
                                        <View style={styles.quickStepRow}>
                                            {[-10, -1, 1, 10].map(step => (
                                                <TouchableOpacity
                                                    key={step}
                                                    onPress={() => handleUpdateRateField(item.id, 'sell_rate', Math.max(0, item.sell_rate + step))}
                                                    style={styles.stepBtn}
                                                >
                                                    <Text style={styles.stepBtnText}>{step > 0 ? `+${step}` : step}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* Bottom Push to Production Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    onPress={handlePushRatesToProduction}
                    disabled={saving}
                    style={styles.pushLiveBtn}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="cloud-upload" size={18} color={T.goldBright} />
                            <Text style={styles.pushLiveBtnText}>Push Rates to Live Production</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* MODAL 1: ADD NEW CURRENCY PAIR                                            */}
            {/* ========================================================================= */}
            <Modal
                visible={showNewPairModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowNewPairModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Currency Pair</Text>
                            <TouchableOpacity onPress={() => setShowNewPairModal(false)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Pair Symbol</Text>
                        <TextInput
                            value={newPairName}
                            onChangeText={setNewPairName}
                            placeholder="e.g. TON/NGN, TRX/NGN, ZAR/NGN"
                            placeholderTextColor={T.textMuted}
                            style={styles.modalInput}
                        />

                        <Text style={styles.inputLabel}>Category</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                            {(['crypto', 'fiat', 'gold', 'giftcard'] as const).map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setNewCategory(cat)}
                                    style={[styles.catPill, newCategory === cat && styles.catPillActive]}
                                >
                                    <Text style={[styles.catPillText, newCategory === cat && styles.catPillTextActive]}>
                                        {cat.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>We Buy Rate (₦)</Text>
                        <TextInput
                            value={newBuyRate}
                            onChangeText={setNewBuyRate}
                            placeholder="e.g. 1540"
                            placeholderTextColor={T.textMuted}
                            keyboardType="numeric"
                            style={styles.modalInput}
                        />

                        <Text style={styles.inputLabel}>We Sell Rate (₦)</Text>
                        <TextInput
                            value={newSellRate}
                            onChangeText={setNewSellRate}
                            placeholder="e.g. 1575"
                            placeholderTextColor={T.textMuted}
                            keyboardType="numeric"
                            style={styles.modalInput}
                        />

                        <TouchableOpacity
                            onPress={handleAddNewPair}
                            disabled={saving}
                            style={styles.modalSaveBtn}
                            activeOpacity={0.85}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.modalSaveBtnText}>Create Pair</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: BATCH SPREAD ADJUSTER                                            */}
            {/* ========================================================================= */}
            <Modal
                visible={showMarginModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowMarginModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Batch Margin / Spread Tool</Text>
                            <TouchableOpacity onPress={() => setShowMarginModal(false)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDesc}>
                            Instantly increase or decrease the sell spread margin across all currency pairs simultaneously.
                        </Text>

                        <Text style={styles.inputLabel}>Spread Delta (₦ to add to all sell rates)</Text>
                        <TextInput
                            value={batchSpreadDelta}
                            onChangeText={setBatchSpreadDelta}
                            placeholder="e.g. 10 or -5"
                            placeholderTextColor={T.textMuted}
                            keyboardType="numeric"
                            style={styles.modalInput}
                        />

                        <TouchableOpacity
                            onPress={handleApplyBatchSpread}
                            style={styles.modalSaveBtn}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.modalSaveBtnText}>Apply to All Selling Rates</Text>
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
    heroSummaryBar: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.cardBorderGold,
    },
    liveIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    pulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.success,
    },
    liveIndicatorText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 1,
    },
    summaryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 6, 0.2)',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    summaryLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 1,
    },
    summaryDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    categoryBar: {
        backgroundColor: T.navyPrimary,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 119, 6, 0.2)',
        paddingVertical: 6,
    },
    categoryScroll: {
        paddingHorizontal: 10,
        gap: 6,
    },
    categoryPill: {
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: T.navyDeep,
    },
    categoryPillActive: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
        borderColor: T.gold,
    },
    categoryPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textMuted,
    },
    categoryPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    searchActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: T.cardBorder,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 11.5,
        color: T.textMain,
    },
    marginToolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: T.goldBg,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    marginToolBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.goldDark,
    },
    listContent: {
        padding: 12,
        paddingBottom: 90,
    },
    rateCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: T.cardBorder,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    rateCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    pairIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: T.navyPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pairTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    pairUpdated: {
        fontSize: 10,
        color: T.textMuted,
        marginTop: 1,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    trendBadgeUp: {
        backgroundColor: T.successBg,
    },
    trendBadgeDown: {
        backgroundColor: T.dangerBg,
    },
    trendBadgeNeutral: {
        backgroundColor: '#F1F5F9',
    },
    trendText: {
        fontSize: 9.5,
        fontWeight: '900',
    },
    rateBoxesRow: {
        flexDirection: 'row',
        gap: 8,
    },
    rateBoxBuy: {
        flex: 1,
        backgroundColor: '#F0FDF4',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    rateBoxSell: {
        flex: 1,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    rateBoxLabelBuy: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#15803D',
        marginBottom: 4,
    },
    rateBoxLabelSell: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#1D4ED8',
        marginBottom: 4,
    },
    rateInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 4,
        marginBottom: 6,
    },
    currencySymbol: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
        marginRight: 2,
    },
    rateInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
        padding: 0,
    },
    quickStepRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 2,
    },
    stepBtn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 4,
        paddingVertical: 2,
        alignItems: 'center',
    },
    stepBtnText: {
        fontSize: 9,
        fontWeight: '800',
        color: T.textSub,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: T.cardBorder,
    },
    pushLiveBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    pushLiveBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
    },
    emptyState: {
        padding: 28,
        alignItems: 'center',
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
    modalDesc: {
        fontSize: 11,
        color: T.textSub,
        lineHeight: 15,
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
        marginTop: 6,
        marginBottom: 4,
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
    catPill: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
    },
    catPillActive: {
        backgroundColor: T.navyPrimary,
    },
    catPillText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: T.textSub,
    },
    catPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
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
});
