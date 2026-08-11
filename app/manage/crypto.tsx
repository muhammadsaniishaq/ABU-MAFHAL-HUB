import { 
    View, Text, TouchableOpacity, ScrollView, Platform, 
    ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCryptoManager } from '../../hooks/useCryptoManager';
import * as Clipboard from 'expo-clipboard';

// Ultra Premium Compact LIGHT Navy & Gold Design Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(218, 165, 32, 0.4)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#FFD700',
    goldDk: '#DAA520',
    goldAmber: '#D97706',
    goldLight: '#FEF3C7',
    goldBg: 'rgba(254, 243, 199, 0.65)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
};

export default function CryptoManagerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { 
        settings, 
        stats, 
        loading, 
        updateSetting,
        fetchTradeHistory,
        fetchUserWallets,
        fetchPendingWithdrawalsList,
        approveWithdrawal,
        updateUserBalance,
        livePrices,
        p2pOrders,
        resolveP2pDispute
    } = useCryptoManager();
    
    const [activeTab, setActiveTab] = useState('overview');
    const [tradeHistory, setTradeHistory] = useState<any[]>([]);
    const [userWallets, setUserWallets] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [isFetchingData, setIsFetchingData] = useState(false);

    // Fee settings local state
    const [feeTrc20, setFeeTrc20] = useState('');
    const [feeBtc, setFeeBtc] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Fund user modal state
    const [selectedUserForFund, setSelectedUserForFund] = useState<any | null>(null);
    const [fundCoin, setFundCoin] = useState('USDT');
    const [fundAmount, setFundAmount] = useState('');
    const [fundingUser, setFundingUser] = useState(false);

    useEffect(() => {
        if (activeTab === 'history') loadHistory();
        if (activeTab === 'users') loadWallets();
        if (activeTab === 'withdrawals') loadWithdrawals();
    }, [activeTab]);

    useEffect(() => {
        setFeeTrc20(settings.crypto_fee_trc20_usdt || '1.5');
        setFeeBtc(settings.crypto_fee_btc || '0.0005');
    }, [settings.crypto_fee_trc20_usdt, settings.crypto_fee_btc]);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3000);
    };

    const loadHistory = async () => { 
        setIsFetchingData(true); 
        const h = await fetchTradeHistory();
        setTradeHistory(h || []); 
        setIsFetchingData(false); 
    };

    const loadWallets = async () => { 
        setIsFetchingData(true); 
        const w = await fetchUserWallets();
        setUserWallets(w || []); 
        setIsFetchingData(false); 
    };

    const loadWithdrawals = async () => { 
        setIsFetchingData(true); 
        const list = await fetchPendingWithdrawalsList();
        setWithdrawals(list || []); 
        setIsFetchingData(false); 
    };

    const handleApproveWithdrawal = async (id: string) => {
        await approveWithdrawal(id);
        showToast("Withdrawal approved successfully! ⚡");
        loadWithdrawals();
    };

    const handleFundUserSubmit = async () => {
        if (!selectedUserForFund || !fundAmount.trim()) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }
        setFundingUser(true);
        try {
            const amt = parseFloat(fundAmount.trim());
            await updateUserBalance(selectedUserForFund.user_id, fundCoin.toLowerCase(), amt);
            Alert.alert('Success 🎉', `Updated ${fundCoin} balance for ${selectedUserForFund.user?.email || 'user'}`);
            setSelectedUserForFund(null);
            setFundAmount('');
            loadWallets();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not update user balance');
        } finally {
            setFundingUser(false);
        }
    };

    const handleSaveFees = () => {
        updateSetting('crypto_fee_trc20_usdt', feeTrc20);
        updateSetting('crypto_fee_btc', feeBtc);
        Alert.alert('Success 🎉', 'Crypto Transaction Fees Updated!');
        showToast("Fees Updated! ⚡");
    };

    const copyText = (text: string, label: string) => {
        if (!text) return;
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            Clipboard.setString(text);
        }
        showToast(`Copied ${label}! ✨`);
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: 'pie-chart-outline' },
        { id: 'users', label: 'Wallets', icon: 'people-outline' },
        { id: 'history', label: 'Trades', icon: 'swap-horizontal-outline' },
        { id: 'withdrawals', label: `Pending (${stats.pendingWithdrawals || 0})`, icon: 'time-outline', badge: stats.pendingWithdrawals },
        { id: 'rates', label: 'Fees & Rates', icon: 'options-outline' },
        { id: 'p2p', label: 'P2P Escrow', icon: 'shield-checkmark-outline' },
        { id: 'networks', label: 'Nodes RPC', icon: 'server-outline' }
    ];

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: L.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={L.goldDk} size="small" />
                <Text style={{ color: L.navyHeader, marginTop: 10, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' }}>Loading Crypto Command...</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                
                {/* Toast Notification */}
                {toastMsg && (
                    <View style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 60, backgroundColor: L.navyHeader, borderColor: L.gold, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 8 }}>
                        <Ionicons name="sparkles" size={14} color={L.gold} />
                        <Text style={{ color: L.goldLight, fontWeight: 'bold', fontSize: 10, flex: 1 }}>{toastMsg}</Text>
                    </View>
                )}

                {/* Compact Royal Navy Header */}
                <LinearGradient 
                    colors={['#0F172A', '#1C2541', '#0B132B']} 
                    style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: L.goldDk, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="logo-bitcoin" size={12} color={L.gold} />
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Crypto Core</Text>
                            </View>
                            <TouchableOpacity onPress={() => router.push('/manage/api')} style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: L.gold, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="key" size={12} color={L.gold} />
                                <Text style={{ color: L.gold, fontWeight: 'bold', fontSize: 9 }}>API Keys →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={{ color: L.gold, fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginBottom: 1 }}>CRYPTO ASSETS & TRADING CONTROL</Text>
                    <Text style={{ color: '#CBD5E1', fontSize: 10 }}>Live exchange rates, multi-chain wallets, pending withdrawals & P2P escrow.</Text>
                </LinearGradient>

                {/* Compact Horizontal Category Tab Navigation */}
                <View style={{ backgroundColor: L.bg, borderBottomWidth: 1, borderColor: L.inputBorder, paddingVertical: 6 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12 }} contentContainerStyle={{ gap: 6 }}>
                        {tabs.map((tab) => {
                            const isSelected = activeTab === tab.id;
                            return (
                                <TouchableOpacity 
                                    key={tab.id}
                                    onPress={() => setActiveTab(tab.id)}
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        backgroundColor: isSelected ? L.navyHeader : L.card,
                                        borderColor: isSelected ? L.navyHeader : L.inputBorder
                                    }}
                                >
                                    <Ionicons name={tab.icon as any} size={12} color={isSelected ? L.gold : L.textSecondary} />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: isSelected ? L.gold : L.textSecondary }}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Tab Content Body */}
                <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingTop: 10 }} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <View style={{ gap: 10 }}>
                            {/* Stats Summary Grid */}
                            <View style={{ backgroundColor: L.card, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: L.cardBorder, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Text style={{ color: L.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>24h Trading Vol</Text>
                                    <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900', marginTop: 2 }}>₦{stats.totalVolume24h.toLocaleString()}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.emeraldBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 3 }}>
                                        <Ionicons name="caret-up" size={8} color={L.emerald} />
                                        <Text style={{ color: L.emerald, fontSize: 8, fontWeight: 'bold', marginLeft: 2 }}>Live</Text>
                                    </View>
                                </View>
                                <View style={{ width: 1, height: 26, backgroundColor: L.inputBorder }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Text style={{ color: L.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>Total Liquidity</Text>
                                    <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900', marginTop: 2 }}>${stats.totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.emeraldBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 3 }}>
                                        <Ionicons name="checkmark-circle" size={8} color={L.emerald} />
                                        <Text style={{ color: L.emerald, fontSize: 8, fontWeight: 'bold', marginLeft: 2 }}>Synced</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Revenue Card */}
                            <View style={{ backgroundColor: L.card, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>PLATFORM CRYPTO REVENUE (7D)</Text>
                                    <Ionicons name="bar-chart-outline" size={14} color={L.goldDk} />
                                </View>
                                <Text style={{ color: L.goldAmber, fontSize: 20, fontWeight: '900' }}>₦{stats.totalRevenue7d.toLocaleString()}</Text>
                                <Text style={{ color: L.textMuted, fontSize: 9, marginTop: 1 }}>Accumulated fees from user trades, swaps & withdrawals.</Text>
                            </View>

                            {/* Pending Alert Banner */}
                            {stats.pendingWithdrawals > 0 && (
                                <TouchableOpacity 
                                    onPress={() => setActiveTab('withdrawals')}
                                    style={{ backgroundColor: L.roseBg, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: L.roseBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.rose, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="warning" size={14} color="#FFFFFF" />
                                        </View>
                                        <View>
                                            <Text style={{ color: L.rose, fontWeight: '900', fontSize: 11 }}>{stats.pendingWithdrawals} Pending Withdrawals</Text>
                                            <Text style={{ color: L.textSecondary, fontSize: 9 }}>Requires manual admin review & approval</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={15} color={L.rose} />
                                </TouchableOpacity>
                            )}

                            {/* Quick Action Navigation Buttons */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity 
                                    onPress={() => setActiveTab('users')}
                                    style={{ flex: 1, backgroundColor: L.card, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                >
                                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="wallet-outline" size={14} color={L.gold} />
                                    </View>
                                    <View>
                                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10 }}>User Wallets</Text>
                                        <Text style={{ color: L.textMuted, fontSize: 8 }}>Manage balances</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setActiveTab('p2p')}
                                    style={{ flex: 1, backgroundColor: L.card, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                >
                                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="shield-checkmark-outline" size={14} color={L.gold} />
                                    </View>
                                    <View>
                                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10 }}>P2P Escrow</Text>
                                        <Text style={{ color: L.textMuted, fontSize: 8 }}>{stats.p2pDisputed || 0} Disputes</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* USER WALLETS TAB */}
                    {activeTab === 'users' && (
                        <View style={{ gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>User Crypto Wallets</Text>
                                <TouchableOpacity onPress={loadWallets} style={{ backgroundColor: L.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: 'bold' }}>Refresh</Text>
                                </TouchableOpacity>
                            </View>

                            {isFetchingData ? (
                                <ActivityIndicator size="small" color={L.goldDk} style={{ marginTop: 20 }} />
                            ) : userWallets.length === 0 ? (
                                <View style={{ backgroundColor: L.card, padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Text style={{ color: L.textMuted, fontSize: 10 }}>No user wallets loaded.</Text>
                                </View>
                            ) : (
                                userWallets.map((wallet: any, idx: number) => {
                                    const usdt = Number(wallet.usdt_balance) || 0;
                                    const btc = Number(wallet.btc_balance) || 0;
                                    const eth = Number(wallet.eth_balance) || 0;
                                    const fiat = Number(wallet.fiat_balance) || 0;
                                    const estVal = (usdt + (btc * (livePrices.btc || 65000)) + (eth * (livePrices.eth || 3500)) + (fiat / 1600)).toFixed(2);

                                    return (
                                        <View key={wallet.user_id || idx} style={{ backgroundColor: L.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{wallet.user?.email || 'Unknown User'}</Text>
                                                    <Text style={{ color: L.goldAmber, fontWeight: '800', fontSize: 9, marginTop: 1 }}>Est. Value: ~${estVal}</Text>
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={() => setSelectedUserForFund(wallet)}
                                                    style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.gold, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                                                >
                                                    <Ionicons name="cash-outline" size={10} color={L.gold} />
                                                    <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9 }}>Update Balance</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Balances Grid */}
                                            <View style={{ flexDirection: 'row', backgroundColor: L.bg, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, justifyContent: 'space-around' }}>
                                                <View style={{ alignItems: 'center' }}>
                                                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>USDT</Text>
                                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', marginTop: 1 }}>{usdt.toFixed(2)}</Text>
                                                </View>
                                                <View style={{ width: 1, height: 18, backgroundColor: L.inputBorder }} />
                                                <View style={{ alignItems: 'center' }}>
                                                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>BTC</Text>
                                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', marginTop: 1 }}>{btc.toFixed(4)}</Text>
                                                </View>
                                                <View style={{ width: 1, height: 18, backgroundColor: L.inputBorder }} />
                                                <View style={{ alignItems: 'center' }}>
                                                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>ETH</Text>
                                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', marginTop: 1 }}>{eth.toFixed(4)}</Text>
                                                </View>
                                                <View style={{ width: 1, height: 18, backgroundColor: L.inputBorder }} />
                                                <View style={{ alignItems: 'center' }}>
                                                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>FIAT (NGN)</Text>
                                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', marginTop: 1 }}>₦{fiat.toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {/* TRADE HISTORY TAB */}
                    {activeTab === 'history' && (
                        <View style={{ gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Recent Trades & Swaps</Text>
                                <TouchableOpacity onPress={loadHistory} style={{ backgroundColor: L.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: 'bold' }}>Refresh</Text>
                                </TouchableOpacity>
                            </View>

                            {isFetchingData ? (
                                <ActivityIndicator size="small" color={L.goldDk} style={{ marginTop: 20 }} />
                            ) : tradeHistory.length === 0 ? (
                                <View style={{ backgroundColor: L.card, padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Text style={{ color: L.textMuted, fontSize: 10 }}>No trade history found.</Text>
                                </View>
                            ) : (
                                tradeHistory.map((trade: any, idx: number) => (
                                    <View key={trade.id || idx} style={{ backgroundColor: L.card, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: trade.trade_type === 'buy' ? L.emeraldBg : L.roseBg, alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name={trade.trade_type === 'buy' ? "arrow-down" : "arrow-up"} size={14} color={trade.trade_type === 'buy' ? L.emerald : L.rose} />
                                            </View>
                                            <View>
                                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10 }}>{trade.trade_type?.toUpperCase()} {trade.coin}</Text>
                                                <Text style={{ color: L.textMuted, fontSize: 8 }}>{trade.user?.email || 'User'}</Text>
                                            </View>
                                        </View>

                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10 }}>₦{trade.fiat_value?.toLocaleString()}</Text>
                                            <View style={{ backgroundColor: trade.status === 'completed' ? L.emeraldBg : L.goldLight, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 2 }}>
                                                <Text style={{ color: trade.status === 'completed' ? L.emerald : L.goldAmber, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' }}>{trade.status}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* PENDING WITHDRAWALS TAB */}
                    {activeTab === 'withdrawals' && (
                        <View style={{ gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Pending Crypto Withdrawals</Text>
                                <TouchableOpacity onPress={loadWithdrawals} style={{ backgroundColor: L.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: 'bold' }}>Refresh</Text>
                                </TouchableOpacity>
                            </View>

                            {isFetchingData ? (
                                <ActivityIndicator size="small" color={L.goldDk} style={{ marginTop: 20 }} />
                            ) : withdrawals.length === 0 ? (
                                <View style={{ backgroundColor: L.card, padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Ionicons name="checkmark-circle-outline" size={24} color={L.emerald} />
                                    <Text style={{ color: L.emerald, fontWeight: 'bold', fontSize: 10, marginTop: 4 }}>No pending withdrawal approvals!</Text>
                                </View>
                            ) : (
                                withdrawals.map((w: any, idx: number) => (
                                    <View key={w.id || idx} style={{ backgroundColor: L.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: L.roseBorder }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <View>
                                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{w.amount} {w.coin?.toUpperCase()}</Text>
                                                <Text style={{ color: L.textMuted, fontSize: 9 }}>User: {w.user?.email || w.user_id}</Text>
                                            </View>
                                            <View style={{ backgroundColor: L.roseBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: L.roseBorder }}>
                                                <Text style={{ color: L.rose, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>PENDING REVIEW</Text>
                                            </View>
                                        </View>

                                        <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 8 }}>
                                            <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>DESTINATION ADDRESS ({w.network || 'TRC20'}):</Text>
                                            <TouchableOpacity onPress={() => copyText(w.destination_address, 'Address')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                                                <Text style={{ color: L.navyHeader, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 9, flex: 1, marginRight: 6 }}>{w.destination_address}</Text>
                                                <Ionicons name="copy-outline" size={12} color={L.navyHeader} />
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity 
                                            onPress={() => handleApproveWithdrawal(w.id)}
                                            style={{ backgroundColor: L.navyHeader, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                                        >
                                            <Ionicons name="checkmark-circle-sharp" size={12} color={L.gold} />
                                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Approve & Dispatch</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* RATES & FEES TAB */}
                    {activeTab === 'rates' && (
                        <View style={{ gap: 10 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Crypto Exchange Fees & Profit Margins</Text>

                            <View style={{ backgroundColor: L.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, marginBottom: 2 }}>USDT TRC20 Transaction Fee</Text>
                                <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 6 }}>Fixed network fee deducted on USDT payouts.</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 10 }}>
                                    <TextInput
                                        value={feeTrc20}
                                        onChangeText={setFeeTrc20}
                                        keyboardType="numeric"
                                        style={{ flex: 1, color: L.textPrimary, fontWeight: '700', fontSize: 11 }}
                                    />
                                    <Text style={{ color: L.textMuted, fontSize: 9, fontWeight: 'bold' }}>USDT</Text>
                                </View>

                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, marginBottom: 2 }}>Bitcoin (BTC) Transaction Fee</Text>
                                <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 6 }}>Network miner fee for BTC transfers.</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 12 }}>
                                    <TextInput
                                        value={feeBtc}
                                        onChangeText={setFeeBtc}
                                        keyboardType="numeric"
                                        style={{ flex: 1, color: L.textPrimary, fontWeight: '700', fontSize: 11 }}
                                    />
                                    <Text style={{ color: L.textMuted, fontSize: 9, fontWeight: 'bold' }}>BTC</Text>
                                </View>

                                <TouchableOpacity 
                                    onPress={handleSaveFees}
                                    style={{ backgroundColor: L.navyHeader, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                                >
                                    <Ionicons name="save-outline" size={14} color={L.gold} />
                                    <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Save Fee Settings</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* P2P ESCROW TAB */}
                    {activeTab === 'p2p' && (
                        <View style={{ gap: 10 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>P2P Escrow Orders & Disputes</Text>

                            {p2pOrders.length === 0 ? (
                                <View style={{ backgroundColor: L.card, padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}>
                                    <Text style={{ color: L.textMuted, fontSize: 10 }}>No active P2P escrow disputes.</Text>
                                </View>
                            ) : (
                                p2pOrders.map((order: any, idx: number) => (
                                    <View key={order.id || idx} style={{ backgroundColor: L.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>Order #{order.id?.slice(0, 8)}</Text>
                                            <View style={{ backgroundColor: order.status === 'disputed' ? L.roseBg : L.goldLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                                <Text style={{ color: order.status === 'disputed' ? L.rose : L.goldAmber, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' }}>{order.status}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: L.textSecondary, fontSize: 10 }}>Amount: {order.amount} {order.coin} (₦{order.fiat_amount?.toLocaleString()})</Text>

                                        {order.status === 'disputed' && (
                                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                                                <TouchableOpacity onPress={() => resolveP2pDispute(order.id, 'buyer')} style={{ flex: 1, backgroundColor: L.emeraldBg, paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: L.emeraldBorder }}>
                                                    <Text style={{ color: L.emerald, fontWeight: 'bold', fontSize: 9 }}>Release Buyer</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => resolveP2pDispute(order.id, 'seller')} style={{ flex: 1, backgroundColor: L.roseBg, paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: L.roseBorder }}>
                                                    <Text style={{ color: L.rose, fontWeight: 'bold', fontSize: 9 }}>Refund Seller</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* BLOCKCHAIN NODES RPC TAB */}
                    {activeTab === 'networks' && (
                        <View style={{ gap: 10 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Blockchain RPC Nodes Status</Text>

                            {[
                                { name: 'TRON TRC20 Node', rpc: 'https://api.trongrid.io', status: 'Healthy' },
                                { name: 'Ethereum ERC20 Node (Alchemy)', rpc: 'https://eth-mainnet.g.alchemy.com/v2/...', status: 'Healthy' },
                                { name: 'Bitcoin Network RPC', rpc: 'https://btc.blockbook.api', status: 'Healthy' },
                                { name: 'Binance Smart Chain (BEP20)', rpc: 'https://bsc-dataseed.binance.org', status: 'Healthy' }
                            ].map((node, idx) => (
                                <View key={idx} style={{ backgroundColor: L.card, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="server-outline" size={16} color={L.goldDk} />
                                        <View>
                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10 }}>{node.name}</Text>
                                            <Text style={{ color: L.textMuted, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{node.rpc}</Text>
                                        </View>
                                    </View>
                                    <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: L.emeraldBorder }}>
                                        <Text style={{ color: L.emerald, fontSize: 8, fontWeight: '900' }}>{node.status}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>

            {/* FUND USER BALANCE MODAL */}
            <Modal visible={selectedUserForFund !== null} transparent animationType="fade" onRequestClose={() => setSelectedUserForFund(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', padding: 16 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: L.goldDk }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13 }}>Adjust User Balance</Text>
                            <TouchableOpacity onPress={() => setSelectedUserForFund(null)}>
                                <Ionicons name="close-circle" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 2 }}>Target User:</Text>
                        <Text style={{ color: L.navyHeader, fontWeight: 'bold', fontSize: 11, marginBottom: 10 }}>{selectedUserForFund?.user?.email || selectedUserForFund?.user_id}</Text>

                        {/* Select Coin Pill */}
                        <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 4, fontWeight: 'bold' }}>Select Asset:</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                            {['USDT', 'BTC', 'ETH', 'FIAT'].map(coin => (
                                <TouchableOpacity 
                                    key={coin} 
                                    onPress={() => setFundCoin(coin)}
                                    style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: fundCoin === coin ? L.navyHeader : L.bg, borderColor: fundCoin === coin ? L.navyHeader : L.inputBorder }}
                                >
                                    <Text style={{ color: fundCoin === coin ? L.gold : L.textSecondary, fontWeight: 'bold', fontSize: 9 }}>{coin}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 4, fontWeight: 'bold' }}>New Balance Amount:</Text>
                        <View style={{ backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 12 }}>
                            <TextInput
                                value={fundAmount}
                                onChangeText={setFundAmount}
                                keyboardType="numeric"
                                placeholder="Enter amount..."
                                placeholderTextColor="#94A3B8"
                                style={{ flex: 1, color: L.textPrimary, fontWeight: '700', fontSize: 11 }}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleFundUserSubmit}
                            disabled={fundingUser}
                            style={{ backgroundColor: L.navyHeader, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                        >
                            {fundingUser ? (
                                <ActivityIndicator size="small" color={L.gold} />
                            ) : (
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Confirm Balance Update</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
