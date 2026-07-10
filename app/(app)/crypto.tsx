import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput, Linking, Clipboard, StyleSheet, Vibration, FlatList, Dimensions, Animated, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../../services/api';
import { CryptoRate } from '../../services/partners';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as ExpoClipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

// NativeWind cssInterop for LinearGradient is removed because it causes React Navigation crashes
// on some Android/iOS configurations. We will use inline styles for LinearGradient exclusively.

const { width } = Dimensions.get('window');

// --- TYPES ---
type Tab = 'home' | 'markets' | 'swap' | 'portfolio' | 'settings';

export default function CryptoScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [assets, setAssets] = useState<CryptoRate[]>([]);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    // Permission for Camera
    const [permission, requestPermission] = useCameraPermissions();

    // Data Fetching
    useEffect(() => {
        fetchInitialData();
        const interval = setInterval(fetchRates, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchInitialData = async () => {
        try {
            const rates = await api.crypto.getRates(['bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 'ripple', 'cardano', 'dogecoin', 'tron', 'litecoin', 'the-open-network']);
            setAssets(rates);
        } catch (e) {
            console.log("Error fetching stats");
        } finally {
            setLoading(false);
        }
    };

    const fetchRates = async () => {
        try {
            const rates = await api.crypto.getRates(['bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 'ripple', 'cardano', 'dogecoin', 'tron', 'litecoin', 'the-open-network']);
            setAssets(rates);
        } catch (error) {
            console.log("Crypto Refresh Skipped");
        }
    };

    return (
        <LinearGradient
            colors={['#F0F4F8', '#E2E8F0']}
            style={{ flex: 1, paddingTop: insets.top }}
        >
            <StatusBar style="dark" />

            {/* TAB CONTENT */}
            <View className="flex-1 pb-20">
                {activeTab === 'home' && (
                    <HomeView
                        assets={assets}
                        loading={loading}
                        permission={permission}
                        requestPermission={requestPermission}
                        setActiveTab={setActiveTab}
                    />
                )}
                {activeTab === 'markets' && <MarketsView assets={assets} />}
                {activeTab === 'swap' && <SwapView assets={assets} />}
                {activeTab === 'portfolio' && <PortfolioView assets={assets} />}
                {activeTab === 'settings' && <SettingsView />}
            </View>

            {/* NAVIGATION BAR WITH BLUR */}
            <CustomTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        </LinearGradient>
    );
}

// --- SHARED COMPONENTS ---

const CustomTabBar = ({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) => (
    <View className="absolute bottom-4 left-4 right-4 rounded-2xl shadow-lg overflow-hidden border border-white/40">
        <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
        <View className="p-1.5 flex-row justify-between items-center bg-white/40">
            {[
                { id: 'home', icon: 'home', label: 'Home' },
                { id: 'markets', icon: 'bar-chart', label: 'Markets' },
                { id: 'swap', icon: 'swap-horizontal', label: 'Swap', special: true },
                { id: 'portfolio', icon: 'pie-chart', label: 'Portfolio' },
                { id: 'settings', icon: 'settings', label: 'Settings' },
            ].map((tab) => {
                const isActive = activeTab === tab.id;

                if (tab.special) {
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => { Vibration.vibrate(40); setActiveTab(tab.id as Tab); }}
                            className="w-12 h-12 rounded-full items-center justify-center -mt-6 shadow-lg shadow-blue-600/50 border-4 border-[#F8FAFC]"
                        >
                            <LinearGradient
                                colors={['#0E1A2E', '#1e335e']}
                                style={{ width: '100%', height: '100%', borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name={tab.icon as any} size={20} color="#D9A73A" />
                            </LinearGradient>
                        </TouchableOpacity>
                    );
                }

                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => { Vibration.vibrate(30); setActiveTab(tab.id as Tab); }}
                        className="flex-1 items-center justify-center py-1"
                    >
                        <Animated.View style={{ transform: [{ scale: isActive ? 1.1 : 1 }] }}>
                            <Ionicons
                                name={tab.icon as any}
                                size={18}
                                color={isActive ? '#0E1A2E' : '#94a3b8'}
                            />
                        </Animated.View>
                        <Text className={`text-[9px] font-bold mt-1 tracking-wider ${isActive ? 'text-[#0E1A2E]' : 'text-slate-400'}`}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
);

// --- SUB-VIEWS ---

function HomeView({ assets, loading, permission, requestPermission, setActiveTab }: { assets: CryptoRate[], loading: boolean, permission: any, requestPermission: any, setActiveTab: any }) {
    const router = useRouter();
    const [walletBalance, setWalletBalance] = useState(0);
    const [walletBalanceUsd, setWalletBalanceUsd] = useState(0);
    const [cryptoWalletBalanceUsdt, setCryptoWalletBalanceUsdt] = useState(0);
    const [monthlyProfit, setMonthlyProfit] = useState(0);
    const [rewardPoints, setRewardPoints] = useState(0);
    const [hideBalance, setHideBalance] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannedData, setScannedData] = useState('');

    // Action Modals State
    const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'buy' | 'sell' | 'deposit' | 'withdraw' | 'gas' | 'pay' | null>(null);

    const [receiveNetwork, setReceiveNetwork] = useState('TRC20');
    const [receiveAddresses, setReceiveAddresses] = useState<Record<string, string>>({});
    const [loadingAddress, setLoadingAddress] = useState(false);

    // Send State
    const [sendNetwork, setSendNetwork] = useState('TRC20');
    const [sendAddress, setSendAddress] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Dynamic Network Fee Calculation
    const getNetworkFee = (net: string) => {
        switch (net) {
            case 'TRC20': return 1.50; // TRON standard + margin
            case 'BEP20': return 0.50; // BSC standard + margin
            case 'ERC20': return 6.00; // ETH standard (high) + margin
            case 'SOL': return 0.20;   // SOL standard + margin
            default: return 1.50;
        }
    };
    const networkFee = getNetworkFee(sendNetwork);

    // Buy State
    const [buyAmountNgn, setBuyAmountNgn] = useState('');
    const [buyAddress, setBuyAddress] = useState('');
    const [buyNetwork, setBuyNetwork] = useState('TRC20');
    const [isBuying, setIsBuying] = useState(false);
    const BUY_RATE = 1600; // 1 USDT = 1600 NGN (Include our margin)
    const buyAmountCrypto = Number(buyAmountNgn) ? (Number(buyAmountNgn) / BUY_RATE).toFixed(2) : '0.00';

    // Sell State
    const [sellAmountCrypto, setSellAmountCrypto] = useState('');
    const [sellNetwork, setSellNetwork] = useState('TRC20');
    const [isSelling, setIsSelling] = useState(false);
    const SELL_RATE = 1450; // We buy from them at 1450 NGN/USDT to make margin
    const expectedNgn = Number(sellAmountCrypto) ? (Number(sellAmountCrypto) * SELL_RATE).toFixed(2) : '0.00';

    useEffect(() => {
        if (!receiveAddresses[receiveNetwork] && activeModal === 'receive') {
            loadAddress(receiveNetwork);
        }
    }, [receiveNetwork, activeModal]);

    useEffect(() => {
        if (!receiveAddresses[sellNetwork] && activeModal === 'sell') {
            loadAddress(sellNetwork);
        }
    }, [sellNetwork, activeModal]);

    const loadAddress = async (network: string) => {
        try {
            setLoadingAddress(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Map network to NowPayments currency code for USDT or native coin
            const currencyMap: Record<string, string> = {
                'TRC20': 'usdttrc20',
                'BEP20': 'usdtbsc',
                'ERC20': 'usdterc20',
                'SOL': 'sol'
            };
            const curr = currencyMap[network] || 'usdttrc20';

            const data = await api.crypto.generateDepositAddress(user.id, network, curr);
            setReceiveAddresses(prev => ({ ...prev, [network]: data.address }));
        } catch (error) {
            console.error(error);
            // Fallback for UI testing if backend is not set up
            Alert.alert("Address Error", "Failed to generate live deposit address.");
        } finally {
            setLoadingAddress(false);
        }
    };

    // Fetch Balance
    const getBal = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Fetch NGN Balance, Profit and Rewards
            const { data, error } = await supabase.from('profiles').select('balance, monthly_profit, reward_points').eq('id', user.id).single();
            if (error) {
                // Fallback if migration hasn't run yet
                const { data: fallbackData } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (fallbackData) {
                    setWalletBalance(fallbackData.balance || 0);
                    setWalletBalanceUsd((fallbackData.balance || 0) / 1500); 
                }
            } else if (data) {
                setWalletBalance(data.balance || 0);
                setWalletBalanceUsd((data.balance || 0) / 1500); 
                setMonthlyProfit(data.monthly_profit || 0);
                setRewardPoints(data.reward_points || 0);
            }

            // Fetch Crypto Balance (USDT)
            const { data: cbData } = await supabase
                .from('crypto_balances')
                .select('balance')
                .eq('user_id', user.id)
                .eq('asset', 'USDT')
                .maybeSingle();
            if (cbData) {
                setCryptoWalletBalanceUsdt(cbData.balance);
            }
        }
    };

    useEffect(() => {
        getBal();
    }, []);

    const topGainer = useMemo<Partial<CryptoRate>>(() => {
        if (assets.length === 0) return { symbol: '---', percent_change_24h: 0, image: '' };
        return assets.reduce((prev, current) => (prev.percent_change_24h > current.percent_change_24h) ? prev : current);
    }, [assets]);

    const handleScan = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert("Permission Required", "Camera access is needed to scan QR codes.");
                return;
            }
        }
        setScannerVisible(true);
    };

    const QuickActionButton = ({ icon, label, action, color = "#0E1A2E", badge }: { icon: string, label: string, action: () => void, color?: string, badge?: string }) => (
        <View className="items-center mb-4 w-[20%] relative">
            <TouchableOpacity
                onPress={() => { Vibration.vibrate(30); action(); }}
                className="w-11 h-11 bg-white border border-slate-50 shadow-md shadow-slate-200/60 rounded-2xl items-center justify-center mb-1.5"
                activeOpacity={0.7}
            >
                <Ionicons name={icon as any} size={20} color={color} />
            </TouchableOpacity>
            <Text className="text-[#0E1A2E] text-[8px] font-black uppercase tracking-wider text-center">{label}</Text>
            {badge && (
                <View className="absolute top-[-6] right-[2] bg-[#D9A73A] px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                    <Text className="text-[#0E1A2E] font-black text-[6px] tracking-widest">{badge}</Text>
                </View>
            )}
        </View>
    );

    return (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            {/* HEADER */}
            <View className="px-4 pt-1 pb-3">
                <View className="flex-row justify-between items-center mb-5">
                    {/* Left: Profile Avatar & Greeting */}
                    <View className="flex-row items-center gap-2.5">
                        <TouchableOpacity onPress={() => router.replace('/dashboard')} className="relative">
                            <Image source={{ uri: 'https://i.pravatar.cc/100?img=11' }} className="w-9 h-9 rounded-full border border-slate-200 bg-slate-200" />
                            <View className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-[1.5px] border-white" />
                        </TouchableOpacity>
                        <View>
                            <View className="flex-row items-center gap-1.5 mb-0.5">
                                <Text className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">Welcome Back</Text>
                                <View className="bg-blue-50 px-1 py-0.5 rounded border border-blue-100">
                                    <Text className="text-blue-600 font-black text-[7px] uppercase">Pro</Text>
                                </View>
                            </View>
                            <Text className="text-[#0E1A2E] font-black text-sm">Muhammad 👋</Text>
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity className="bg-white w-8 h-8 rounded-full items-center justify-center shadow-sm border border-slate-100">
                            <Ionicons name="search" size={14} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity className="bg-white w-8 h-8 rounded-full items-center justify-center shadow-sm border border-slate-100 relative">
                            <Ionicons name="notifications-outline" size={14} color="#64748b" />
                            <View className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleScan} className="bg-[#0E1A2E] w-8 h-8 rounded-full items-center justify-center shadow-md">
                            <Ionicons name="scan" size={14} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* EXECUTIVE PREMIUM BALANCE CARD */}
                <LinearGradient
                    colors={['#0A1128', '#1e293b']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                        padding: 20, borderRadius: 24, position: 'relative', overflow: 'hidden',
                        elevation: 8, shadowColor: '#0E1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12
                    }}
                >
                    {/* Sleek Geometric Background */}
                    <View className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-12" />
                    <View className="absolute bottom-0 right-0 w-32 h-32 bg-[#D9A73A]/5 rounded-full translate-y-12 translate-x-8" />

                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <View className="flex-row items-center gap-1.5 mb-1.5">
                                <Ionicons name="wallet-outline" size={14} color="#94a3b8" />
                                <Text className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Crypto Wallet (USDT)</Text>
                            </View>
                            <Text className="text-white text-[34px] font-black tracking-tight leading-none mb-1">
                                {hideBalance ? '****' : `${cryptoWalletBalanceUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </Text>
                            <Text className="text-[#D9A73A] font-bold text-xs tracking-wider">
                                {hideBalance ? '₦ ****' : `Naira Wallet: ₦${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </Text>
                        </View>

                        <TouchableOpacity onPress={() => { Vibration.vibrate(30); setHideBalance(!hideBalance); }} className="w-8 h-8 bg-white/10 items-center justify-center rounded-full">
                            <Ionicons name={hideBalance ? "eye-off" : "eye"} size={14} color="#cbd5e1" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row items-center justify-between pt-4 border-t border-white/10">
                        <View className="flex-row items-center gap-4">
                            <View>
                                <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-0.5">Monthly Profit</Text>
                                <Text className="text-emerald-400 font-black text-xs">+{monthlyProfit > 0 ? '₦' : ''}{monthlyProfit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                            </View>
                            <View className="w-[1px] h-6 bg-white/10" />
                            <View>
                                <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-0.5">Reward Points</Text>
                                <View className="flex-row items-center gap-1">
                                    <Ionicons name="star" size={10} color="#D9A73A" />
                                    <Text className="text-white font-black text-xs">{rewardPoints.toLocaleString()}</Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity onPress={() => router.push('/analytics')} className="flex-row items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <Text className="text-slate-300 font-bold text-[10px]">Analytics</Text>
                            <Ionicons name="chevron-forward" size={12} color="#cbd5e1" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            {/* QUICK ACTIONS GRID */}
            <View className="px-4 mb-8">
                <View className="bg-slate-50/80 p-5 pb-1 rounded-[32px] border border-white relative overflow-hidden shadow-xl shadow-slate-200/50">
                    {/* Modern Card Decorations */}
                    <View className="absolute top-0 right-0 w-40 h-40 bg-[#D9A73A]/10 rounded-full blur-3xl translate-x-10 -translate-y-10" />
                    <View className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-x-10 translate-y-10" />

                    <View className="flex-row items-center justify-between mb-4 relative z-10 px-1 border-b border-slate-200/50 pb-2">
                        <Text className="text-[#0E1A2E] font-black uppercase tracking-widest text-[9px]">App Services</Text>
                        <View className="flex-row gap-1">
                            <View className="w-1 h-1 rounded-full bg-[#D9A73A]" />
                            <View className="w-1 h-1 rounded-full bg-[#D9A73A]" />
                            <View className="w-1 h-1 rounded-full bg-[#D9A73A]" />
                        </View>
                    </View>

                    <View className="flex-row flex-wrap justify-between relative z-10">
                        {/* Row 1 */}
                        <QuickActionButton icon="arrow-down" label="Receive" color="#10b981" action={() => setActiveModal('receive')} />
                        <QuickActionButton icon="paper-plane" label="Send" color="#3b82f6" action={() => setActiveModal('send')} />
                        <QuickActionButton icon="cart" label="Buy" color="#0E1A2E" action={() => setActiveModal('buy')} badge="0%" />
                        <QuickActionButton icon="cash" label="Sell" color="#ef4444" action={() => setActiveModal('sell')} />
                        <QuickActionButton icon="swap-horizontal" label="Swap" color="#f59e0b" action={() => setActiveTab('swap')} />

                        {/* Row 2 */}
                        <QuickActionButton icon="diamond" label="Earn" color="#8b5cf6" action={() => { }} badge="NEW" />
                        <QuickActionButton icon="card" label="Cards" color="#06b6d4" action={() => { }} />
                        <QuickActionButton icon="leaf" label="Stake" color="#22c55e" action={() => { }} />
                        <QuickActionButton icon="wallet" label="Loan" color="#6366f1" action={() => { }} />
                        <QuickActionButton icon="gift" label="Gift" color="#ec4899" action={() => { }} />

                        {/* Row 3 */}
                        <QuickActionButton icon="flame" label="Gas" color="#d946ef" action={() => setActiveModal('gas')} />
                        <QuickActionButton icon="qr-code" label="QR Pay" color="#14b8a6" action={() => setActiveModal('pay')} />
                        <QuickActionButton icon="time" label="History" color="#64748b" action={() => { }} />
                        <QuickActionButton icon="chatbubbles" label="Support" color="#3b82f6" action={() => { }} />
                        <QuickActionButton icon="apps" label="More" color="#0E1A2E" action={() => setActiveTab('portfolio')} />
                    </View>
                </View>
            </View>

            {/* AI INSIGHTS WIDGET */}
            <View className="px-4 mb-6">
                <LinearGradient
                    colors={['#eff6ff', '#eef2ff']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                        padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#dbeafe',
                        elevation: 2, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
                    }}
                >
                    <View className="flex-row justify-between items-center mb-1.5">
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center shadow-sm">
                                <Ionicons name="sparkles" size={12} color="#fff" />
                            </View>
                            <Text className="text-blue-900 font-black text-xs">AI Market Insight</Text>
                        </View>
                        <View className="bg-emerald-500 px-1.5 py-0.5 rounded shadow-sm">
                            <Text className="text-white font-bold text-[8px] uppercase">Bullish</Text>
                        </View>
                    </View>
                    <Text className="text-blue-800/80 font-medium text-xs leading-4">Bitcoin is showing strong momentum today with a <Text className="font-bold text-emerald-600">65% buy probability</Text>.</Text>
                </LinearGradient>
            </View>

            {/* MARKET OVERVIEW */}
            <View className="px-4 mb-6">
                <View className="flex-row justify-between items-end mb-4">
                    <Text className="text-slate-900 font-black text-xl">Trending Assets</Text>
                    <TouchableOpacity onPress={() => setActiveTab('markets')} className="bg-slate-100 px-3 py-1.5 rounded-full flex-row items-center gap-1">
                        <Text className="text-slate-700 font-black text-[10px]">See All</Text>
                        <Ionicons name="chevron-forward" size={10} color="#334155" />
                    </TouchableOpacity>
                </View>

                {/* Top Gainer Widget */}
                {assets.length > 0 && (
                    <TouchableOpacity onPress={() => setActiveTab('markets')} className="bg-[#0E1A2E] p-4 rounded-2xl shadow-md mb-3 flex-row items-center justify-between border border-[#1e335e]">
                        <View className="flex-row items-center gap-3">
                            <View className="relative">
                                {topGainer.image ? (
                                    <Image source={{ uri: topGainer.image }} className="w-10 h-10 rounded-full border border-white/10" />
                                ) : (
                                    <View className="w-10 h-10 rounded-full bg-slate-800" />
                                )}
                                <View className="absolute -bottom-1 -right-1 bg-rose-500 rounded-full p-1 shadow-sm border border-[#0E1A2E]">
                                    <Ionicons name="flame" size={8} color="white" />
                                </View>
                            </View>
                            <View>
                                <Text className="text-blue-200 font-bold text-[8px] uppercase tracking-widest mb-0.5">Top Gainer</Text>
                                <Text className="text-white font-black text-sm">{topGainer.name}</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className="text-white font-black text-sm">${topGainer.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                            <View className="bg-emerald-500/20 px-2 py-0.5 rounded mt-1 border border-emerald-500/30">
                                <Text className="text-emerald-400 font-black text-[10px]">+{topGainer.percent_change_24h?.toFixed(2)}%</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Popular Coins List */}
                <View className="bg-white rounded-2xl border border-white shadow-sm overflow-hidden">
                    {assets.slice(0, 3).map((item, index) => (
                        <TouchableOpacity key={item.id} className={`flex-row items-center justify-between p-3 ${index !== 2 ? 'border-b border-slate-100' : ''}`}>
                            <View className="flex-row items-center gap-3">
                                <Image source={{ uri: item.image }} className="w-8 h-8 rounded-full shadow-sm" />
                                <View>
                                    <Text className="text-slate-900 font-black text-xs mb-0.5">{item.name}</Text>
                                    <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">{item.symbol}</Text>
                                </View>
                            </View>
                            <View className="flex-row items-end gap-0.5 h-4">
                                {[0.4, 0.6, 0.3, 0.8, 0.5, 0.9, 0.7].map((h, i) => (
                                    <View key={i} className={`w-0.5 rounded-t-full ${(item.percent_change_24h || 0) >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ height: h * 16 }} />
                                ))}
                            </View>
                            <View className="items-end">
                                <Text className="text-slate-900 font-black text-xs">${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                <Text className={`font-black text-[10px] mt-0.5 ${(item.percent_change_24h || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {(item.percent_change_24h || 0) >= 0 ? '+' : ''}{(item.percent_change_24h || 0).toFixed(2)}%
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* WEB3 EARN / STAKING */}
            <View className="px-4 mb-6">
                <Text className="text-slate-900 font-black text-xl mb-3">Earn & Web3</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
                    {[
                        { title: 'DeFi Staking', desc: 'Up to 12% APY', icon: 'leaf', color: '#10b981', bg: 'bg-emerald-50' },
                        { title: 'P2P Market', desc: 'Zero Fees', icon: 'people', color: '#3b82f6', bg: 'bg-blue-50' },
                        { title: 'NFT Gallery', desc: 'Collectibles', icon: 'images', color: '#8b5cf6', bg: 'bg-purple-50' },
                    ].map((mod, i) => (
                        <TouchableOpacity key={i} className={`p-3 rounded-2xl border border-white shadow-sm mr-3 w-28 relative ${mod.bg}`}>
                            <View className="w-8 h-8 rounded-xl bg-white items-center justify-center mb-2 shadow-sm">
                                <Ionicons name={mod.icon as any} size={16} color={mod.color} />
                            </View>
                            <Text className="text-slate-900 font-black mb-0.5 text-xs">{mod.title}</Text>
                            <Text className={`font-bold text-[9px]`} style={{ color: mod.color }}>{mod.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* MARKET NEWS */}
            <View className="px-4 mb-6">
                <View className="flex-row justify-between items-end mb-3">
                    <Text className="text-slate-900 font-black text-xl">Market News</Text>
                    <Text className="text-blue-500 font-bold text-[10px]">View All</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
                    {[
                        { title: 'Bitcoin surges past resistance levels.', time: '2h ago', source: 'CoinDesk', img: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' },
                        { title: 'Ethereum Foundation announces upgrade.', time: '5h ago', source: 'Decrypt', img: 'https://images.unsplash.com/photo-1622630998477-20b41cd74c15?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' },
                    ].map((news, i) => (
                        <TouchableOpacity key={i} className="bg-white p-3 rounded-2xl w-52 mr-3 border border-slate-100 shadow-sm flex-row gap-2">
                            <Image source={{ uri: news.img }} className="w-12 h-12 rounded-xl bg-slate-200" />
                            <View className="flex-1 justify-center">
                                <Text className="text-slate-800 font-black text-[10px] mb-1" numberOfLines={2}>{news.title}</Text>
                                <View className="flex-row justify-between items-center mt-1">
                                    <Text className="text-blue-500 font-bold text-[8px]">{news.source}</Text>
                                    <Text className="text-slate-400 font-bold text-[8px]">{news.time}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* TOP TRADERS */}
            <View className="px-4 mb-6">
                <Text className="text-slate-900 font-black text-xl mb-3">Top Traders</Text>
                <View className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center border border-blue-200">
                                <Text className="font-black text-blue-600 text-[10px]">@AL</Text>
                            </View>
                            <View>
                                <Text className="font-black text-slate-800 text-xs">AlexTrading</Text>
                                <Text className="text-[10px] font-bold text-slate-400">Master Trader</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className="text-emerald-500 font-black text-sm">+340%</Text>
                            <Text className="text-slate-400 font-bold text-[8px] uppercase">30D ROI</Text>
                        </View>
                    </View>
                    <TouchableOpacity className="bg-slate-50 border border-slate-200 w-full py-2 rounded-xl items-center">
                        <Text className="text-blue-600 font-black text-xs">Copy Strategy</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* --- MODALS FOR ACTIONS --- */}

            <Modal visible={activeModal === 'receive'} animationType="slide" transparent>
                <View className="flex-1 justify-end">
                    {/* Dark Backdrop */}
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setActiveModal(null)}
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    />

                    {/* Compact Modern White Modal with Brand Accents */}
                    <View className="bg-white rounded-t-[32px] shadow-2xl pt-2 pb-5 px-5 border-t-4 border-[#0E1A2E]">

                        {/* Drag Handle */}
                        <View className="w-10 h-1 bg-slate-200 rounded-full self-center mb-4 mt-1" />

                        {/* Header */}
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-lg font-black text-[#0E1A2E] tracking-tight">Receive Crypto</Text>
                                <Text className="text-slate-500 font-medium text-[10px] mt-0.5">Scan or copy your deposit address</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={16} color="#0E1A2E" />
                            </TouchableOpacity>
                        </View>

                        {/* Network Selector - 4 Column Grid */}
                        <Text className="text-slate-400 font-black uppercase tracking-widest text-[10px] ml-1 mb-2.5">Select Network</Text>
                        <View className="flex-row justify-between w-full mb-5">
                            {['TRC20', 'BEP20', 'ERC20', 'SOL'].map((net, i) => {
                                const isSelected = receiveNetwork === net;

                                // Reliable Coingecko Logos
                                let logoUri = '';
                                if (net === 'TRC20') logoUri = 'https://assets.coingecko.com/coins/images/1094/standard/tron-logo.png';
                                if (net === 'BEP20') logoUri = 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png';
                                if (net === 'ERC20') logoUri = 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png';
                                if (net === 'SOL') logoUri = 'https://assets.coingecko.com/coins/images/4128/standard/solana.png';

                                return (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => setReceiveNetwork(net)}
                                        activeOpacity={0.7}
                                        style={{
                                            shadowColor: isSelected ? '#D9A73A' : '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: isSelected ? 0.4 : 0.05,
                                            shadowRadius: 8,
                                            elevation: isSelected ? 8 : 2
                                        }}
                                        className={`flex-1 items-center justify-center py-2.5 mx-1 rounded-2xl border-2 ${isSelected ? 'bg-[#0E1A2E] border-[#D9A73A]' : 'bg-white border-slate-100'}`}
                                    >
                                        <View className={`w-7 h-7 mb-1.5 rounded-full items-center justify-center ${isSelected ? 'bg-white' : 'bg-slate-50'}`}>
                                            <Image source={{ uri: logoUri }} style={{ width: 16, height: 16 }} resizeMode="contain" />
                                        </View>
                                        <Text className={`font-black text-[9px] tracking-wider ${isSelected ? 'text-[#D9A73A]' : 'text-slate-500'}`}>{net}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* QR Code Area - Ultra Modern Scanner UI */}
                        <View className="items-center mt-2 mb-4">
                            {/* Premium QR Frame */}
                            <View className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-xl shadow-slate-200/60 mb-5 relative">
                                {/* Frame corners for scanning effect */}
                                <View className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#0E1A2E] rounded-tl-[28px]" />
                                <View className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#0E1A2E] rounded-tr-[28px]" />
                                <View className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#0E1A2E] rounded-bl-[28px]" />
                                <View className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#0E1A2E] rounded-br-[28px]" />

                                {loadingAddress ? (
                                    <View className="w-[150px] h-[150px] items-center justify-center bg-slate-50/50 rounded-2xl">
                                        <ActivityIndicator size="small" color="#0E1A2E" />
                                        <Text className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest">Generating</Text>
                                    </View>
                                ) : (
                                    <QRCode
                                        value={receiveAddresses[receiveNetwork] || 'Pending...'}
                                        size={150}
                                        color="#0E1A2E"
                                        backgroundColor="white"
                                    />
                                )}
                            </View>

                            {/* Premium Decorated Address Copy Area */}
                            <TouchableOpacity
                                onPress={async () => {
                                    if (receiveAddresses[receiveNetwork]) {
                                        await ExpoClipboard.setStringAsync(receiveAddresses[receiveNetwork]);
                                        Alert.alert('Copied', 'Address copied to clipboard');
                                        Vibration.vibrate(50);
                                    }
                                }}
                                activeOpacity={0.7}
                                className="w-full bg-[#f8fafc] flex-row items-center justify-between p-1.5 pl-4 rounded-2xl border border-dashed border-slate-300 mb-3"
                            >
                                <View className="flex-1 mr-3">
                                    <View className="flex-row items-center gap-1.5 mb-1">
                                        <View className="w-1.5 h-1.5 rounded-full bg-[#D9A73A]" />
                                        <Text className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Deposit Address</Text>
                                    </View>
                                    <Text className="text-[#0E1A2E] font-mono text-[11px] font-bold tracking-widest" numberOfLines={1} ellipsizeMode="middle">
                                        {loadingAddress ? 'Generating...' : (receiveAddresses[receiveNetwork] || 'Failed')}
                                    </Text>
                                </View>
                                <LinearGradient
                                    colors={['#0E1A2E', '#1e293b']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <Ionicons name="copy" size={12} color="#D9A73A" />
                                    <Text className="text-[#D9A73A] font-black text-[9px] uppercase tracking-wider">Copy</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Minimalist Warning */}
                            <View className="flex-row items-center gap-1.5 bg-amber-50/50 px-3 py-1.5 rounded-full border border-amber-100">
                                <Ionicons name="shield-checkmark" size={12} color="#d97706" />
                                <Text className="text-amber-700 font-medium text-[9px]">
                                    Only send <Text className="font-black">{receiveNetwork}</Text> to this address
                                </Text>
                            </View>
                        </View>

                        {/* Premium Decorated Share Button - Compact */}
                        <TouchableOpacity
                            onPress={async () => {
                                if (loadingAddress || !receiveAddresses[receiveNetwork]) return;
                                try {
                                    await Share.share({
                                        message: `My Crypto Deposit Address (${receiveNetwork}):\n${receiveAddresses[receiveNetwork]}`,
                                    });
                                } catch (error) { }
                            }}
                            activeOpacity={0.8}
                            className="shadow-sm shadow-[#0E1A2E]/20 rounded-lg overflow-hidden border border-[#0E1A2E]/10"
                        >
                            <LinearGradient
                                colors={['#0E1A2E', '#1e293b']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ width: '100%', paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, position: 'relative' }}
                            >
                                <View className="absolute top-0 left-0 w-full h-[50%] bg-white/5 rounded-b-[100px]" />

                                <View className="bg-white/10 w-6 h-6 rounded-full items-center justify-center">
                                    <Ionicons name="share-social" size={12} color="#D9A73A" />
                                </View>
                                <Text className="text-[#D9A73A] font-black text-xs uppercase tracking-wide">Share Address</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={activeModal === 'send'} animationType="slide" transparent>
                <View className="flex-1 justify-end">
                    {/* Dark Backdrop */}
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setActiveModal(null)}
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    />

                    {/* Premium Send Modal */}
                    <View className="bg-white rounded-t-[32px] shadow-2xl pt-2 pb-6 px-5 border-t-4 border-[#3b82f6]">
                        {/* Drag Handle */}
                        <View className="w-10 h-1 bg-slate-200 rounded-full self-center mb-4 mt-1" />

                        {/* Header */}
                        <View className="flex-row justify-between items-center mb-5">
                            <View>
                                <Text className="text-lg font-black text-[#0E1A2E] tracking-tight">Send Crypto</Text>
                                <Text className="text-slate-500 font-medium text-[10px] mt-0.5">Transfer funds to an external wallet</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={16} color="#0E1A2E" />
                            </TouchableOpacity>
                        </View>

                        {/* Network Selector */}
                        <Text className="text-slate-400 font-black uppercase tracking-widest text-[10px] ml-1 mb-2.5">Select Network</Text>
                        <View className="flex-row justify-between w-full mb-4">
                            {['TRC20', 'BEP20', 'ERC20', 'SOL'].map((net, i) => {
                                const isSelected = sendNetwork === net;

                                let logoUri = '';
                                if (net === 'TRC20') logoUri = 'https://assets.coingecko.com/coins/images/1094/standard/tron-logo.png';
                                if (net === 'BEP20') logoUri = 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png';
                                if (net === 'ERC20') logoUri = 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png';
                                if (net === 'SOL') logoUri = 'https://assets.coingecko.com/coins/images/4128/standard/solana.png';

                                return (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => setSendNetwork(net)}
                                        activeOpacity={0.7}
                                        style={{
                                            shadowColor: isSelected ? '#3b82f6' : '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: isSelected ? 0.3 : 0.05,
                                            shadowRadius: 8,
                                            elevation: isSelected ? 8 : 2
                                        }}
                                        className={`flex-1 items-center justify-center py-2 mx-1 rounded-xl border-2 ${isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-100'}`}
                                    >
                                        <Image source={{ uri: logoUri }} className="w-4 h-4 mb-1 rounded-full bg-slate-100" />
                                        <Text className={`font-black text-[8px] tracking-wider ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{net}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Destination Address */}
                        <Text className="text-slate-400 font-black uppercase tracking-widest text-[10px] ml-1 mb-2.5">Destination Address</Text>
                        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl p-2 mb-4">
                            <View className="w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm border border-slate-100 mr-2">
                                <Ionicons name="wallet-outline" size={14} color="#64748b" />
                            </View>
                            <TextInput
                                className="flex-1 font-mono text-xs font-bold text-[#0E1A2E] p-0"
                                placeholder="Paste or enter address..."
                                placeholderTextColor="#cbd5e1"
                                value={sendAddress}
                                onChangeText={setSendAddress}
                            />
                            <TouchableOpacity
                                onPress={async () => {
                                    const text = await ExpoClipboard.getStringAsync();
                                    if (text) setSendAddress(text);
                                }}
                                className="bg-[#0E1A2E] px-3 py-1.5 rounded-lg ml-2 shadow-sm"
                            >
                                <Text className="text-[#D9A73A] font-black text-[9px] uppercase tracking-wider">Paste</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Amount */}
                        <Text className="text-slate-400 font-black uppercase tracking-widest text-[10px] ml-1 mb-2.5">Amount (USDT)</Text>
                        <View className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 mb-5 shadow-sm">
                            <View className="flex-row justify-between items-center bg-white rounded-xl border border-slate-100 p-2 shadow-sm mb-2">
                                <View className="w-8 h-8 rounded-full bg-emerald-50/50 items-center justify-center mr-2">
                                    <Image source={{ uri: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' }} className="w-5 h-5 rounded-full" />
                                </View>
                                <TextInput
                                    className="text-xl font-black text-[#0E1A2E] flex-1 p-0 h-8"
                                    placeholder="0.00"
                                    placeholderTextColor="#cbd5e1"
                                    keyboardType="numeric"
                                    value={sendAmount}
                                    onChangeText={setSendAmount}
                                />
                                <View className="flex-row items-center bg-[#0E1A2E] px-2 py-1.5 rounded-lg ml-2">
                                    <Text className="text-[#D9A73A] font-black text-[9px] uppercase tracking-widest">USDT</Text>
                                </View>
                            </View>
                            <View className="flex-row justify-between items-center px-1">
                                <Text className="text-slate-500 font-medium text-[10px]">Available: <Text className="font-black text-[#0E1A2E]">{cryptoWalletBalanceUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</Text></Text>
                                <TouchableOpacity
                                    onPress={() => setSendAmount(cryptoWalletBalanceUsdt.toFixed(2))}
                                    className="bg-blue-100/50 px-2 py-1 rounded border border-blue-200/50"
                                >
                                    <Text className="text-blue-600 font-black text-[9px] uppercase tracking-widest">Use Max</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Fee Summary */}
                        <View className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-6">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-slate-500 font-bold text-[10px]">Network Fee</Text>
                                <Text className="text-slate-800 font-black text-[10px]">{networkFee.toFixed(2)} USDT</Text>
                            </View>
                            <View className="flex-row justify-between border-t border-slate-200 pt-2 mt-1">
                                <Text className="text-slate-500 font-bold text-[10px]">Total Deduction</Text>
                                <Text className="text-rose-500 font-black text-xs">{((Number(sendAmount) || 0) + networkFee).toFixed(2)} USDT</Text>
                            </View>
                        </View>

                        {/* Action Button */}
                        <TouchableOpacity
                            onPress={() => {
                                if (isSending) return;
                                if (!sendAddress) return Alert.alert("Error", "Please enter a destination address");
                                if (!sendAmount || Number(sendAmount) <= 0) return Alert.alert("Error", "Please enter a valid amount");
                                if (Number(sendAmount) + networkFee > cryptoWalletBalanceUsdt) return Alert.alert("Error", "Insufficient balance to cover amount + network fee");

                                Alert.alert("Confirm Send", `Are you sure you want to send ${sendAmount} USDT to ${sendAddress}?\n\nA total of ${(Number(sendAmount) + networkFee).toFixed(2)} USDT will be deducted.`, [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Send Now", onPress: async () => {
                                            try {
                                                setIsSending(true);
                                                await api.crypto.withdraw(sendNetwork, sendAddress, Number(sendAmount) + networkFee); // Amount + Fee
                                                Alert.alert("Success", "Transaction submitted successfully!");
                                                setSendAddress('');
                                                setSendAmount('');
                                                setActiveModal(null);
                                                // Refresh balance locally for instant feedback
                                                setCryptoWalletBalanceUsdt(prev => prev - (Number(sendAmount) + networkFee));
                                            } catch (error: any) {
                                                Alert.alert("Failed", error.message || "Failed to send crypto");
                                            } finally {
                                                setIsSending(false);
                                            }
                                        }
                                    }
                                ])
                            }}
                            activeOpacity={0.8}
                            className="shadow-xl shadow-blue-500/30 rounded-2xl overflow-hidden"
                            disabled={isSending}
                        >
                            <LinearGradient
                                colors={['#3b82f6', '#2563eb']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ width: '100%', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, position: 'relative' }}
                            >
                                <View className="absolute top-0 left-0 w-full h-[50%] bg-white/10 rounded-b-[100px]" />
                                {isSending ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-black text-sm uppercase tracking-widest">Preview Send</Text>
                                        <Ionicons name="arrow-forward" size={16} color="white" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={activeModal === 'buy'} animationType="slide" transparent>
                <View className="flex-1 justify-end">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setActiveModal(null)}
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    />

                    <View className="bg-white rounded-t-[32px] shadow-2xl pt-2 pb-6 px-5 border-t-4 border-emerald-500">
                        <View className="w-10 h-1 bg-slate-200 rounded-full self-center mb-4 mt-1" />

                        <View className="flex-row justify-between items-center mb-5">
                            <View>
                                <Text className="text-lg font-black text-[#0E1A2E] tracking-tight">Buy Crypto</Text>
                                <Text className="text-slate-500 font-medium text-[10px] mt-0.5">Purchase USDT with Naira Wallet</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={16} color="#0E1A2E" />
                            </TouchableOpacity>
                        </View>

                        {/* Live Rate Ticker */}
                        <View className="flex-row items-center justify-center bg-indigo-50/50 py-1.5 px-3 rounded-full self-center mb-5 border border-indigo-100">
                            <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 shadow-sm shadow-emerald-500" />
                            <Text className="text-indigo-900 font-bold text-[9px] uppercase tracking-widest">Live Rate: ₦{BUY_RATE} = 1 USDT</Text>
                        </View>

                        {/* Ultra Compact Buy Input */}
                        <View className="bg-slate-50/80 rounded-2xl border border-indigo-100/40 p-2.5 mb-4 overflow-hidden relative">
                            <View className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-10 translate-x-10" />

                            <View className="flex-row justify-between items-center px-1 mb-2">
                                <Text className="text-[#0E1A2E] font-black uppercase tracking-widest text-[9px]">Purchase Amount</Text>
                                <View className="bg-white px-2 py-0.5 rounded-full border border-slate-100 shadow-sm flex-row items-center gap-1">
                                    <Ionicons name="shield-checkmark" size={10} color="#10b981" />
                                    <Text className="text-emerald-500 font-bold text-[8px]">Zero Fee</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center bg-white rounded-xl border border-slate-100 shadow-sm p-1.5">
                                <View className="w-8 h-8 bg-indigo-50 rounded-lg items-center justify-center mr-2">
                                    <Text className="text-indigo-600 font-black text-sm">₦</Text>
                                </View>
                                <TextInput
                                    className="text-xl font-black text-[#0E1A2E] flex-1 p-0 h-8"
                                    placeholder="0"
                                    placeholderTextColor="#cbd5e1"
                                    keyboardType="numeric"
                                    value={buyAmountNgn}
                                    onChangeText={setBuyAmountNgn}
                                />
                                <TouchableOpacity
                                    onPress={() => setBuyAmountNgn(walletBalance.toString())}
                                    className="bg-slate-800 px-3 py-2 rounded-lg ml-2 shadow-sm"
                                >
                                    <Text className="text-white font-black text-[9px] uppercase tracking-wider">MAX</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row justify-between items-center px-1 mt-2">
                                <View className="flex-row items-center gap-1">
                                    <Ionicons name="wallet-outline" size={10} color="#94a3b8" />
                                    <Text className="text-slate-400 font-medium text-[9px]">Bal: <Text className="font-bold text-[#0E1A2E]">₦{walletBalance.toLocaleString()}</Text></Text>
                                </View>
                                <View className="flex-row gap-1">
                                    {[10000, 50000, 100000].map(amt => (
                                        <TouchableOpacity
                                            key={amt}
                                            onPress={() => setBuyAmountNgn(amt.toString())}
                                            className="bg-indigo-50/50 px-2 py-1 rounded"
                                        >
                                            <Text className="text-indigo-600 font-bold text-[8px]">₦{(amt / 1000).toFixed(0)}k</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Order Summary Receipt */}
                        <View className="bg-[#0b132b] rounded-[20px] mb-6 shadow-sm overflow-hidden p-4 relative">
                            <View className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl translate-x-10 -translate-y-10" />

                            <Text className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-3">Transaction Details</Text>

                            <View className="flex-row justify-between items-end mb-4">
                                <View>
                                    <Text className="text-slate-400 font-medium text-[10px] mb-1">You will receive</Text>
                                    <View className="flex-row items-center gap-1.5">
                                        <Text className="text-white font-black text-xl">{buyAmountCrypto || '0.00'}</Text>
                                        <Text className="text-emerald-400 font-bold text-xs mt-1">USDT</Text>
                                    </View>
                                </View>
                                <View className="bg-white/10 rounded-full p-1.5">
                                    <Image source={{ uri: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' }} className="w-5 h-5 rounded-full" />
                                </View>
                            </View>

                            <View className="h-[1px] w-full bg-slate-700/50 my-3" />

                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-slate-400 font-medium text-[10px]">Exchange Rate</Text>
                                <Text className="text-slate-200 font-bold text-[10px]">₦{BUY_RATE} / USDT</Text>
                            </View>
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-slate-400 font-medium text-[10px]">Network</Text>
                                <View className="bg-indigo-500/20 px-1.5 py-0.5 rounded">
                                    <Text className="text-indigo-300 font-bold text-[8px]">Internal</Text>
                                </View>
                            </View>
                            <View className="flex-row justify-between items-center">
                                <Text className="text-slate-400 font-medium text-[10px]">Processing</Text>
                                <View className="flex-row items-center gap-1">
                                    <Ionicons name="flash" size={10} color="#10b981" />
                                    <Text className="text-emerald-400 font-bold text-[10px]">Instant</Text>
                                </View>
                            </View>
                        </View>

                        {/* Action Button */}
                        <TouchableOpacity
                            onPress={() => {
                                if (isBuying) return;
                                if (!buyAmountNgn || Number(buyAmountNgn) < 5000) return Alert.alert("Error", "Minimum buy amount is ₦5,000");
                                if (Number(buyAmountNgn) > walletBalance) return Alert.alert("Insufficient Funds", "You do not have enough Naira balance.");

                                Alert.alert("Confirm Purchase", `Buy ${buyAmountCrypto} USDT for ₦${Number(buyAmountNgn).toLocaleString()}?\n\nIt will be instantly credited to your internal Crypto Wallet.`, [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Confirm Buy", onPress: async () => {
                                            try {
                                                setIsBuying(true);
                                                await api.crypto.buy({
                                                    asset: 'USDT',
                                                    amountNgn: Number(buyAmountNgn),
                                                    amountCrypto: Number(buyAmountCrypto)
                                                });
                                                Alert.alert("Success", "Crypto purchased successfully and added to your wallet.");
                                                setBuyAmountNgn('');
                                                setActiveModal(null);
                                                getBal(); // Refresh balances
                                            } catch (error: any) {
                                                Alert.alert("Failed", error.message || "Failed to buy crypto");
                                            } finally {
                                                setIsBuying(false);
                                            }
                                        }
                                    }
                                ])
                            }}
                            activeOpacity={0.8}
                            className="shadow-xl shadow-indigo-500/30 rounded-2xl overflow-hidden mt-6"
                            disabled={isBuying}
                        >
                            <LinearGradient
                                colors={['#6366f1', '#4f46e5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ width: '100%', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, position: 'relative' }}
                            >
                                <View className="absolute top-0 left-0 w-full h-[50%] bg-white/10 rounded-b-[100px]" />
                                {isBuying ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-black text-sm uppercase tracking-widest">Buy Crypto Instantly</Text>
                                        <Ionicons name="flash" size={16} color="white" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* SELL MODAL */}
            <Modal visible={activeModal === 'sell'} animationType="slide" transparent>
                <View className="flex-1 justify-end">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setActiveModal(null)}
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    />

                    <View className="bg-white rounded-t-[32px] shadow-2xl pt-2 pb-6 px-5 border-t-4 border-rose-500">
                        <View className="w-10 h-1 bg-slate-200 rounded-full self-center mb-4 mt-1" />

                        <View className="flex-row justify-between items-center mb-5">
                            <View>
                                <Text className="text-lg font-black text-[#0E1A2E] tracking-tight">Sell Crypto</Text>
                                <Text className="text-slate-500 font-medium text-[10px] mt-0.5">Sell USDT to get Naira Instantly</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={16} color="#0E1A2E" />
                            </TouchableOpacity>
                        </View>

                        {/* Live Rate Ticker */}
                        <View className="flex-row items-center justify-center bg-rose-50/50 py-1.5 px-3 rounded-full self-center mb-5 border border-rose-100">
                            <View className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-2 shadow-sm shadow-rose-500" />
                            <Text className="text-rose-900 font-bold text-[9px] uppercase tracking-widest">Live Rate: 1 USDT = ₦{SELL_RATE}</Text>
                        </View>

                        {/* Ultra Compact Sell Input */}
                        <View className="bg-slate-50/80 rounded-2xl border border-rose-100/40 p-2.5 mb-4 overflow-hidden relative">
                            <View className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl -translate-y-10 translate-x-10" />

                            <View className="flex-row justify-between items-center px-1 mb-2">
                                <Text className="text-[#0E1A2E] font-black uppercase tracking-widest text-[9px]">Sell Amount</Text>
                                <View className="bg-white px-2 py-0.5 rounded-full border border-slate-100 shadow-sm flex-row items-center gap-1">
                                    <Ionicons name="shield-checkmark" size={10} color="#10b981" />
                                    <Text className="text-emerald-500 font-bold text-[8px]">Zero Fee</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center bg-white rounded-xl border border-slate-100 shadow-sm p-1.5">
                                <View className="w-8 h-8 bg-rose-50 rounded-lg items-center justify-center mr-2">
                                    <Image source={{ uri: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png' }} className="w-4 h-4 rounded-full" />
                                </View>
                                <TextInput
                                    className="text-xl font-black text-[#0E1A2E] flex-1 p-0 h-8"
                                    placeholder="0.00"
                                    placeholderTextColor="#cbd5e1"
                                    keyboardType="numeric"
                                    value={sellAmountCrypto}
                                    onChangeText={setSellAmountCrypto}
                                />
                                <TouchableOpacity
                                    onPress={() => setSellAmountCrypto(cryptoWalletBalanceUsdt.toString())}
                                    className="bg-slate-800 px-3 py-2 rounded-lg ml-2 shadow-sm"
                                >
                                    <Text className="text-white font-black text-[9px] uppercase tracking-wider">MAX</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row justify-between items-center px-1 mt-2">
                                <View className="flex-row items-center gap-1">
                                    <Ionicons name="wallet-outline" size={10} color="#94a3b8" />
                                    <Text className="text-slate-400 font-medium text-[9px]">Bal: <Text className="font-bold text-[#0E1A2E]">{cryptoWalletBalanceUsdt.toFixed(2)} USDT</Text></Text>
                                </View>
                                <View className="flex-row gap-1">
                                    {[25, 50, 75].map(percent => (
                                        <TouchableOpacity
                                            key={percent}
                                            onPress={() => setSellAmountCrypto((cryptoWalletBalanceUsdt * (percent / 100)).toFixed(2).toString())}
                                            className="bg-rose-50/50 px-2 py-1 rounded"
                                        >
                                            <Text className="text-rose-600 font-bold text-[8px]">{percent}%</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Order Summary Receipt */}
                        <View className="bg-[#0b132b] rounded-[20px] mb-6 shadow-sm overflow-hidden p-4 relative">
                            <View className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl translate-x-10 -translate-y-10" />

                            <Text className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-3">Transaction Details</Text>

                            <View className="flex-row justify-between items-end mb-4">
                                <View>
                                    <Text className="text-slate-400 font-medium text-[10px] mb-1">Naira to receive</Text>
                                    <View className="flex-row items-center gap-1.5">
                                        <Text className="text-white font-black text-xl">₦{Number(expectedNgn || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                                <View className="bg-white/10 rounded-full p-1.5">
                                    <Ionicons name="wallet" size={20} color="#f43f5e" />
                                </View>
                            </View>

                            <View className="h-[1px] w-full bg-slate-700/50 my-3" />

                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-slate-400 font-medium text-[10px]">Exchange Rate</Text>
                                <Text className="text-slate-200 font-bold text-[10px]">1 USDT = ₦{SELL_RATE}</Text>
                            </View>
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-slate-400 font-medium text-[10px]">Network</Text>
                                <View className="bg-rose-500/20 px-1.5 py-0.5 rounded">
                                    <Text className="text-rose-300 font-bold text-[8px]">Internal</Text>
                                </View>
                            </View>
                            <View className="flex-row justify-between items-center">
                                <Text className="text-slate-400 font-medium text-[10px]">Processing</Text>
                                <View className="flex-row items-center gap-1">
                                    <Ionicons name="flash" size={10} color="#f43f5e" />
                                    <Text className="text-rose-400 font-bold text-[10px]">Instant</Text>
                                </View>
                            </View>
                        </View>

                        {/* Action Button */}
                        <TouchableOpacity
                            onPress={() => {
                                if (isSelling) return;
                                if (!sellAmountCrypto || Number(sellAmountCrypto) <= 0) return Alert.alert("Error", "Please enter a valid amount");
                                if (Number(sellAmountCrypto) > cryptoWalletBalanceUsdt) return Alert.alert("Insufficient Balance", "You do not have enough USDT in your internal wallet.");

                                Alert.alert("Confirm Sale", `Are you sure you want to sell ${sellAmountCrypto} USDT?\n\nYour Naira wallet will instantly receive ₦${Number(expectedNgn).toLocaleString()}`, [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Yes, Sell Now", onPress: async () => {
                                            try {
                                                setIsSelling(true);
                                                await api.crypto.sell({
                                                    asset: 'USDT',
                                                    amountCrypto: Number(sellAmountCrypto),
                                                    expectedNgn: Number(expectedNgn)
                                                });
                                                Alert.alert("Success", "USDT sold successfully. Your Naira wallet has been credited.");
                                                setSellAmountCrypto('');
                                                setActiveModal(null);
                                                getBal(); // Refresh balances
                                            } catch (error: any) {
                                                Alert.alert("Failed", error.message || "Failed to submit sell request");
                                            } finally {
                                                setIsSelling(false);
                                            }
                                        }
                                    }
                                ])
                            }}
                            activeOpacity={0.8}
                            className="shadow-xl shadow-rose-500/30 rounded-2xl overflow-hidden"
                            disabled={isSelling}
                        >
                            <LinearGradient
                                colors={['#f43f5e', '#e11d48']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ width: '100%', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, position: 'relative' }}
                            >
                                <View className="absolute top-0 left-0 w-full h-[50%] bg-white/10 rounded-b-[100px]" />
                                {isSelling ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-white font-black text-sm uppercase tracking-widest">Convert Instantly</Text>
                                        <Ionicons name="flash" size={16} color="white" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

function MarketsView({ assets }: { assets: CryptoRate[] }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'Trending' | 'Gainers' | 'Watchlist'>('Trending');

    const filteredAssets = assets.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.symbol.toLowerCase().includes(search.toLowerCase());
        if (filter === 'Gainers') return matchesSearch && (a.percent_change_24h || 0) > 0;
        return matchesSearch;
    }).sort((a, b) => {
        if (filter === 'Gainers') return (b.percent_change_24h || 0) - (a.percent_change_24h || 0);
        return 0;
    });

    return (
        <View className="flex-1">
            <View className="px-4 pt-4 pb-2">
                <Text className="text-2xl font-black text-[#0E1A2E] mb-4 tracking-tight">Markets</Text>

                <View className="flex-row bg-slate-200/60 p-1 rounded-xl mb-4">
                    {['Trending', 'Gainers', 'Watchlist'].map(f => {
                        const isActive = filter === f;
                        return (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setFilter(f as any)}
                                className={`flex-1 py-2 items-center rounded-lg ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                            >
                                <Text className={`font-black text-xs ${isActive ? 'text-[#0E1A2E]' : 'text-slate-500'}`}>{f}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-4 py-1.5 mb-3 shadow-sm">
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                        placeholder="Search coins..."
                        className="flex-1 p-2 text-sm font-black text-slate-800"
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#cbd5e1"
                    />
                </View>
            </View>

            <View className="flex-row justify-between px-6 py-1 mb-1">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</Text>
                <View className="flex-row gap-12">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</Text>
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">24H</Text>
                </View>
            </View>

            <FlatList
                data={filteredAssets}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <TouchableOpacity className="flex-row items-center justify-between bg-white p-4 rounded-2xl mb-3 border border-slate-100 shadow-sm">
                        <View className="flex-row items-center gap-3">
                            <Image source={{ uri: item.image }} className="w-10 h-10 rounded-full border border-slate-100" />
                            <View>
                                <Text className="text-slate-900 font-black text-sm mb-0.5">{item.name}</Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded self-start">{item.symbol}</Text>
                            </View>
                        </View>
                        <View className="flex-row items-center gap-6">
                            <View className="items-end">
                                <Text className="text-slate-900 font-black text-sm mb-0.5">${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '0.00'}</Text>
                                <Text className="text-slate-400 text-[9px] font-bold">Vol: $1.2B</Text>
                            </View>
                            <View className={`px-2 py-1.5 rounded-lg min-w-[60px] items-center ${(item.percent_change_24h || 0) >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                                <Text className={`text-xs font-black ${(item.percent_change_24h || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {(item.percent_change_24h || 0) >= 0 ? '+' : ''}{(item.percent_change_24h || 0).toFixed(2)}%
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    )
}

function SwapView({ assets }: { assets: CryptoRate[] }) {
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState('0.5');
    const [txSpeed, setTxSpeed] = useState<'standard' | 'fast' | 'lightning'>('fast');

    // Dynamic asset selection
    const [fromAssetId, setFromAssetId] = useState('tether');
    const [toAssetId, setToAssetId] = useState('bitcoin');

    const [fromBalance, setFromBalance] = useState(0);
    const [isSwapping, setIsSwapping] = useState(false);

    // Modal for coin selection
    const [selectorVisible, setSelectorVisible] = useState(false);
    const [selectingSide, setSelectingSide] = useState<'from' | 'to'>('from');

    const fromAsset = assets.find(a => a.id === fromAssetId) || assets[0];
    const toAsset = assets.find(a => a.id === toAssetId) || assets[1];

    // Exchange rate logic (e.g. 1 FROM = X TO)
    const rate = (fromAsset?.price_usd || 1) / (toAsset?.price_usd || 1);
    const expectedOut = amount ? (Number(amount) * rate) : 0;

    // Faux price impact calculation based on amount
    const priceImpact = amount ? Math.min((Number(amount) / 10000) * 0.1, 2.5) : 0;
    const impactColor = priceImpact > 1 ? 'text-rose-500' : (priceImpact > 0.5 ? 'text-orange-500' : 'text-emerald-500');

    useEffect(() => {
        if (fromAsset) {
            fetchBalance(fromAsset.symbol.toLowerCase());
        }
    }, [fromAssetId]);

    const fetchBalance = async (symbol: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('crypto_balances')
                .select('balance')
                .eq('user_id', user.id)
                .eq('asset', symbol)
                .maybeSingle();
            setFromBalance(data?.balance || 0);
        }
    };

    // Animations
    const spinValue = useRef(new Animated.Value(0)).current;
    const pulseValue = useRef(new Animated.Value(1)).current;
    const timerValue = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, { toValue: 1.05, duration: 2500, useNativeDriver: true }),
                Animated.timing(pulseValue, { toValue: 1, duration: 2500, useNativeDriver: true })
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(timerValue, { toValue: 0, duration: 15000, useNativeDriver: false }),
                Animated.timing(timerValue, { toValue: 1, duration: 0, useNativeDriver: false })
            ])
        ).start();
    }, []);

    const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
    const handleSwapClick = () => {
        Vibration.vibrate(50);
        Animated.timing(spinValue, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => spinValue.setValue(0));

        // Flip assets
        const temp = fromAssetId;
        setFromAssetId(toAssetId);
        setToAssetId(temp);
        setAmount('');
    };

    const handleExecuteSwap = () => {
        if (isSwapping) return;
        if (!amount || Number(amount) <= 0) return Alert.alert("Error", "Please enter a valid amount");
        if (Number(amount) > fromBalance) return Alert.alert("Insufficient Balance", `You do not have enough ${fromAsset.symbol} to perform this swap.`);

        Alert.alert("Confirm Swap", `Are you sure you want to swap ${amount} ${fromAsset.symbol} for approximately ${expectedOut.toFixed(6)} ${toAsset.symbol}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Confirm", onPress: async () => {
                    try {
                        setIsSwapping(true);
                        await api.crypto.swap({
                            fromAsset: fromAsset.symbol.toLowerCase(),
                            toAsset: toAsset.symbol.toLowerCase(),
                            amountIn: Number(amount),
                            expectedAmountOut: expectedOut
                        });
                        Alert.alert("Swap Successful", `You successfully swapped ${amount} ${fromAsset.symbol} for ${expectedOut.toFixed(6)} ${toAsset.symbol}!`);
                        setAmount('');
                        fetchBalance(fromAsset.symbol.toLowerCase()); // Refresh balance
                    } catch (error: any) {
                        Alert.alert("Swap Failed", error.message || "Failed to process swap");
                    } finally {
                        setIsSwapping(false);
                    }
                }
            }
        ]);
    };

    const openSelector = (side: 'from' | 'to') => {
        setSelectingSide(side);
        setSelectorVisible(true);
    };

    const selectAsset = (id: string) => {
        if (selectingSide === 'from') {
            if (id === toAssetId) setToAssetId(fromAssetId); // Prevent same asset
            setFromAssetId(id);
        } else {
            if (id === fromAssetId) setFromAssetId(toAssetId);
            setToAssetId(id);
        }
        setSelectorVisible(false);
    };

    if (!fromAsset || !toAsset) return null;

    return (
        <ScrollView className="flex-1 bg-[#FAFCFF]" contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
            {/* Background Decorative Particles */}
            <View className="absolute top-20 right-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
            <View className="absolute top-80 left-10 w-40 h-40 bg-[#D9A73A]/10 rounded-full blur-3xl pointer-events-none" />
            <View className="absolute top-40 right-2 w-4 h-4 rounded-full border border-blue-200/50 pointer-events-none" />
            <View className="absolute top-10 left-10 w-6 h-6 rounded-full border border-[#D9A73A]/20 pointer-events-none" />

            {/* Header Area */}
            <View className="flex-row justify-between items-center mb-4 pt-1">
                <View>
                    <Text className="text-2xl font-black text-[#0E1A2E] tracking-tight mb-1">Swap Crypto</Text>
                    <View className="flex-row items-center gap-2">
                        <View className="bg-emerald-100 px-2 py-1 rounded-full flex-row items-center gap-1.5 border border-emerald-200/50 shadow-sm">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <Text className="text-emerald-700 font-black text-[9px] uppercase tracking-widest">Market Open</Text>
                        </View>
                        {/* Refresh Timer */}
                        <View className="flex-row items-center gap-1">
                            <Ionicons name="time-outline" size={10} color="#94a3b8" />
                            <View className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden flex-row">
                                <Animated.View style={{ width: timerValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', backgroundColor: '#3b82f6', borderRadius: 9999 }} />
                            </View>
                        </View>
                    </View>
                </View>
                <TouchableOpacity className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-row items-center justify-center" style={{ elevation: 2 }}>
                    <Ionicons name="pie-chart" size={16} color="#0E1A2E" />
                </TouchableOpacity>
            </View>

            {/* Main Swap Card - Glassmorphism */}
            <View className="relative">
                {/* Enhanced Decorative backgrounds */}
                <Animated.View style={{ transform: [{ scale: pulseValue }], position: 'absolute', top: -30, right: -30, width: 140, height: 140, backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: 9999 }} />
                <Animated.View style={{ transform: [{ scale: pulseValue }], position: 'absolute', bottom: -30, left: -30, width: 140, height: 140, backgroundColor: 'rgba(217, 167, 58, 0.15)', borderRadius: 9999 }} />

                {/* Pay Section */}
                <View className="bg-white/95 backdrop-blur-3xl p-4 rounded-[24px] shadow-xl shadow-[#0E1A2E]/5 border border-slate-100 mb-1.5 z-10" style={{ elevation: 12 }}>
                    <View className="absolute top-0 left-0 w-full h-full rounded-[24px] overflow-hidden opacity-[0.03] pointer-events-none">
                        <View className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                    </View>

                    <View className="flex-row justify-between mb-3 items-center relative z-20">
                        <View className="flex-row items-center gap-1.5">
                            <Ionicons name="arrow-up-circle" size={12} color="#f43f5e" />
                            <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest">You Pay</Text>
                        </View>
                        <View className="bg-slate-50/90 px-2 py-1 rounded-lg border border-slate-200 flex-row items-center gap-1.5 shadow-sm">
                            <Ionicons name="wallet" size={10} color="#64748b" />
                            <Text className="text-slate-700 font-black text-[9px]">{fromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</Text>
                            <TouchableOpacity onPress={() => setAmount(fromBalance.toString())} className="bg-blue-500/10 px-1.5 py-0.5 rounded ml-1 border border-blue-500/20">
                                <Text className="text-blue-600 font-black text-[8px] uppercase tracking-widest">Max</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="flex-row justify-between items-center relative z-20">
                        <TextInput
                            className="text-3xl font-black text-[#0E1A2E] flex-1 p-0 h-10"
                            placeholder="0"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholderTextColor="#cbd5e1"
                            selectionColor="#D9A73A"
                        />
                        <TouchableOpacity onPress={() => openSelector('from')} className="bg-white px-2 py-1.5 rounded-lg flex-row items-center gap-1.5 border border-slate-200 shadow-sm ml-2" style={{ elevation: 4 }}>
                            <Image source={{ uri: fromAsset.image }} className="w-5 h-5 rounded-full bg-slate-50 border border-slate-100" />
                            <Text className="font-black text-slate-800 text-xs ml-0.5">{fromAsset.symbol}</Text>
                            <Ionicons name="chevron-down" size={12} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row justify-between items-center mt-2 relative z-20">
                        <Text className="text-slate-400 font-bold text-[10px]">≈ ${(Number(amount || 0) * fromAsset.price_usd).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                        <View className="flex-row items-center gap-1 opacity-70">
                            {/* Decorative mini-chart lines */}
                            <View className="w-1 h-2 rounded-full bg-slate-300" />
                            <View className="w-1 h-3 rounded-full bg-slate-400" />
                            <View className="w-1 h-2.5 rounded-full bg-emerald-400" />
                            <View className="w-1 h-4 rounded-full bg-emerald-500" />
                        </View>
                    </View>
                </View>

                {/* Swap Button (Floating) */}
                <View className="items-center -my-5 z-20 relative">
                    <View className="absolute w-12 h-12 bg-white/40 backdrop-blur-md rounded-full border border-slate-100/50" />
                    <TouchableOpacity onPress={handleSwapClick} activeOpacity={0.7} className="p-1 rounded-full shadow-lg shadow-[#0E1A2E]/30 border-[4px] border-[#FAFCFF] bg-white">
                        <LinearGradient colors={['#0E1A2E', '#1e335e']} style={{ padding: 10, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}>
                            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                                <Ionicons name="swap-vertical" size={16} color="#D9A73A" />
                            </Animated.View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Receive Section */}
                <View className="bg-white/95 backdrop-blur-3xl p-4 rounded-[24px] shadow-xl shadow-[#0E1A2E]/5 border border-slate-100 mt-1.5 z-10 mb-5" style={{ elevation: 12 }}>
                    <View className="flex-row justify-between mb-2 items-center">
                        <View className="flex-row items-center gap-1.5">
                            <Ionicons name="arrow-down-circle" size={12} color="#10b981" />
                            <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest">You Receive</Text>
                        </View>
                    </View>
                    <View className="flex-row justify-between items-center">
                        <Text className="text-3xl font-black text-[#0E1A2E] flex-1 py-1 h-10" numberOfLines={1} adjustsFontSizeToFit>
                            {amount ? expectedOut.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
                        </Text>
                        <TouchableOpacity onPress={() => openSelector('to')} className="bg-[#0E1A2E] px-2 py-1.5 rounded-lg flex-row items-center gap-1.5 shadow-sm ml-2" style={{ elevation: 4 }}>
                            <Image source={{ uri: toAsset.image }} className="w-5 h-5 rounded-full bg-white border border-[#D9A73A]/50" />
                            <Text className="font-black text-white text-xs ml-0.5">{toAsset.symbol}</Text>
                            <Ionicons name="chevron-down" size={12} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between items-center mt-2">
                        <Text className="text-slate-400 font-bold text-[10px]">≈ ${(Number(expectedOut || 0) * toAsset.price_usd).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                    </View>
                </View>
            </View>

            {/* Settings Row */}
            <View className="mb-4 flex-row gap-2">
                {/* Transaction Speed Selector */}
                <View className="flex-1 bg-white p-2.5 rounded-[16px] border border-slate-100 shadow-sm">
                    <Text className="text-slate-400 font-black text-[8px] uppercase tracking-widest mb-1.5">Tx Speed</Text>
                    <View className="flex-row bg-slate-50 rounded-md p-1 border border-slate-100">
                        {['standard', 'fast', 'lightning'].map((speed) => (
                            <TouchableOpacity
                                key={speed}
                                onPress={() => setTxSpeed(speed as any)}
                                className={["flex-1 py-1 rounded items-center justify-center", txSpeed === speed ? "bg-white shadow-sm border border-slate-200" : ""].filter(Boolean).join(" ")}
                            >
                                <Ionicons
                                    name={speed === 'standard' ? 'bicycle' : speed === 'fast' ? 'car' : 'flash'}
                                    size={10}
                                    color={txSpeed === speed ? (speed === 'lightning' ? '#D9A73A' : '#0E1A2E') : '#94a3b8'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Slippage Selector */}
                <View className="flex-1 bg-white p-2.5 rounded-[16px] border border-slate-100 shadow-sm">
                    <View className="flex-row justify-between items-center mb-1.5">
                        <Text className="text-slate-400 font-black text-[8px] uppercase tracking-widest">Slippage</Text>
                        {slippage === 'Auto' && <Text className="text-[#D9A73A] font-black text-[7px] uppercase bg-[#D9A73A]/10 px-1 rounded">Active</Text>}
                    </View>
                    <View className="flex-row bg-slate-50 rounded-md p-1 border border-slate-100 gap-1">
                        {['0.5', '1.0', 'Auto'].map(slip => (
                            <TouchableOpacity
                                key={slip}
                                onPress={() => setSlippage(slip)}
                                className={["flex-1 py-1 rounded items-center justify-center", slippage === slip ? "bg-white shadow-sm border border-slate-200" : ""].filter(Boolean).join(" ")}
                            >
                                <Text className={["font-black text-[8px]", slippage === slip ? "text-[#0E1A2E]" : "text-slate-400"].filter(Boolean).join(" ")}>{slip}{slip !== 'Auto' ? '%' : ''}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Advanced Quote Details - Sleek Card */}
            <View className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-lg shadow-blue-900/5 mb-5 relative overflow-hidden" style={{ elevation: 3 }}>
                <View className="absolute top-0 right-0 w-24 h-24 bg-[#D9A73A]/5 rounded-full -translate-y-12 translate-x-12" />

                <View className="flex-row justify-between mb-3 items-center">
                    <View className="flex-row items-center gap-2">
                        <View className="w-4 h-4 rounded-full bg-blue-50 items-center justify-center"><Ionicons name="git-compare" size={8} color="#3b82f6" /></View>
                        <Text className="text-slate-600 font-black text-[9px] uppercase tracking-widest">Rate</Text>
                    </View>
                    <Text className="text-[#0E1A2E] font-black text-[10px]">1 {fromAsset.symbol} = {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toAsset.symbol}</Text>
                </View>

                <View className="flex-row justify-between mb-3 items-center">
                    <View className="flex-row items-center gap-2">
                        <View className="w-5 h-5 rounded-full bg-slate-50 border border-slate-100 items-center justify-center"><Ionicons name="pie-chart" size={10} color="#64748b" /></View>
                        <Text className="text-slate-600 font-black text-[10px] uppercase tracking-widest">Price Impact</Text>
                    </View>
                    <Text className="text-emerald-500 font-black text-[10px]">{'<0.01%'}</Text>
                </View>

                <View className="flex-row justify-between mb-3 items-center">
                    <View className="flex-row items-center gap-2">
                        <View className="w-5 h-5 rounded-full bg-blue-50 border border-blue-100 items-center justify-center"><Ionicons name="shield-checkmark" size={10} color="#3b82f6" /></View>
                        <Text className="text-slate-600 font-black text-[10px] uppercase tracking-widest">Minimum Received</Text>
                    </View>
                    <Text className="text-[#0E1A2E] font-black text-[10px]">{(expectedOut * (1 - (slippage === 'Auto' ? 0.005 : Number(slippage) / 100))).toLocaleString(undefined, { maximumFractionDigits: 6 })} {toAsset.symbol}</Text>
                </View>

                <View className="flex-row justify-between mb-3 items-center">
                    <View className="flex-row items-center gap-2">
                        <View className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 items-center justify-center"><Ionicons name="flash" size={10} color="#10b981" /></View>
                        <Text className="text-slate-600 font-black text-[10px] uppercase tracking-widest">Network Fee</Text>
                    </View>
                    <Text className="text-[#0E1A2E] font-black text-[10px]">Free (AbuMafhal Route)</Text>
                </View>

                {/* Feature: Save to Contacts / History shortcut */}
                <View className="border-t border-slate-100 pt-3 mt-1 flex-row justify-between items-center">
                    <Text className="text-slate-400 font-bold text-[9px]">Swap instantly across ABU-MAFHAL</Text>
                    <TouchableOpacity className="bg-slate-50 px-2 py-1 rounded flex-row items-center gap-1 border border-slate-100">
                        <Ionicons name="time" size={8} color="#64748b" />
                        <Text className="text-slate-500 font-bold text-[8px] uppercase">History</Text>
                    </TouchableOpacity>
                </View>
                {/* Routing Visualization */}
                <View className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Smart Route</Text>
                        <Ionicons name="analytics" size={12} color="#D9A73A" />
                    </View>
                    <View className="flex-row items-center justify-between">
                        <Image source={{ uri: fromAsset.image }} className="w-6 h-6 rounded-full bg-white border border-slate-200" />
                        <View className="flex-1 h-[1px] bg-slate-300 mx-2" />
                        <View className="bg-white px-2 py-1 rounded-full border border-slate-200 shadow-sm flex-row items-center gap-1">
                            <Ionicons name="shield-checkmark" size={10} color="#10b981" />
                            <Text className="text-slate-700 font-black text-[8px] uppercase tracking-widest">AbuMafhal Route</Text>
                        </View>
                        <View className="flex-1 h-[1px] bg-slate-300 mx-2" />
                        <Image source={{ uri: toAsset.image }} className="w-6 h-6 rounded-full bg-white border border-slate-200" />
                    </View>
                </View>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSwapping}
                onPress={handleExecuteSwap}
                className="w-full rounded-[16px] overflow-hidden shadow-lg shadow-[#0E1A2E]/30 mb-8"
            >
                <LinearGradient
                    colors={['#0E1A2E', '#1e335e']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ width: '100%', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                    <View className="absolute top-0 left-0 w-full h-[50%] bg-white/10 rounded-b-[100px]" />
                    {isSwapping ? (
                        <ActivityIndicator color="#D9A73A" size="small" />
                    ) : (
                        <>
                            <Ionicons name="lock-closed" size={12} color="#D9A73A" />
                            <Text className="text-[#D9A73A] font-black text-xs uppercase tracking-widest">Confirm Swap</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Coin Selector Modal */}
            <Modal visible={selectorVisible} animationType="slide" transparent={true} onRequestClose={() => setSelectorVisible(false)}>
                <View className="flex-1 justify-end bg-black/60">
                    <View className="bg-white rounded-t-[24px] h-[75%] overflow-hidden shadow-2xl relative">
                        <View className="p-4 border-b border-slate-100 flex-row justify-between items-center bg-white">
                            <Text className="text-[#0E1A2E] font-black text-lg">Select Asset</Text>
                            <TouchableOpacity onPress={() => setSelectorVisible(false)} className="bg-slate-50 p-2 rounded-full border border-slate-100">
                                <Ionicons name="close" size={18} color="#0E1A2E" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={assets}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ padding: 12 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => selectAsset(item.id)}
                                    className="flex-row items-center justify-between bg-white p-3 rounded-[16px] mb-2 border border-slate-100 shadow-sm"
                                    style={{ elevation: 1 }}
                                >
                                    <View className="flex-row items-center gap-2.5">
                                        <Image source={{ uri: item.image }} className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50" />
                                        <View>
                                            <Text className="text-slate-900 font-black text-xs mb-0.5">{item.name}</Text>
                                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded self-start">{item.symbol}</Text>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-slate-900 font-black text-xs">${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                        <Text className={`text-[9px] font-black ${item.percent_change_24h && item.percent_change_24h > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {item.percent_change_24h && item.percent_change_24h > 0 ? '+' : ''}{item.percent_change_24h?.toFixed(2)}%
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

function PortfolioView({ assets }: { assets: CryptoRate[] }) {
    const [filter, setFilter] = useState<'Overview' | 'History'>('Overview');

    return (
        <View className="flex-1">
            <View className="px-4 pt-4 pb-2 mb-2">
                <Text className="text-2xl font-black text-[#0E1A2E] mb-4 tracking-tight">Portfolio</Text>
                <View className="flex-row bg-slate-200/60 p-1 rounded-xl">
                    {['Overview', 'History'].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f as any)}
                            className={`flex-1 py-2 items-center rounded-lg ${filter === f ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                        >
                            <Text className={`font-black text-xs ${filter === f ? 'text-[#0E1A2E]' : 'text-slate-500'}`}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {filter === 'Overview' ? (
                    <>
                        <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-md items-center mb-6 relative overflow-hidden">
                            <View className="relative items-center justify-center w-40 h-40 mb-4">
                                <View className="absolute w-40 h-40 rounded-full border-[14px] border-emerald-500/10" />
                                <View className="absolute w-40 h-40 rounded-full border-[14px] border-t-emerald-500 border-r-blue-500 border-b-amber-500 border-l-transparent rotate-45" />
                                <View className="items-center">
                                    <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-0.5">Total Assets</Text>
                                    <Text className="text-[#0E1A2E] font-black text-2xl">$1,500.00</Text>
                                    <View className="bg-emerald-50 px-1.5 py-0.5 rounded mt-1 border border-emerald-100">
                                        <Text className="text-emerald-500 font-bold text-[9px]">+2.4% Today</Text>
                                    </View>
                                </View>
                            </View>
                            <View className="flex-row justify-center gap-4 w-full bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <View className="flex-row items-center gap-1.5"><View className="w-3 h-3 rounded-full bg-emerald-500" /><Text className="text-xs font-black text-slate-700">USDT</Text></View>
                                <View className="flex-row items-center gap-1.5"><View className="w-3 h-3 rounded-full bg-blue-500" /><Text className="text-xs font-black text-slate-700">BTC</Text></View>
                                <View className="flex-row items-center gap-1.5"><View className="w-3 h-3 rounded-full bg-amber-500" /><Text className="text-xs font-black text-slate-700">SOL</Text></View>
                            </View>
                        </View>

                        <Text className="text-lg font-black text-slate-800 mb-3 px-1">Your Assets</Text>
                        {['USDT', 'BTC', 'SOL'].map((coin, i) => (
                            <View key={i} className="flex-row justify-between items-center bg-white p-4 rounded-2xl mb-3 border border-slate-100 shadow-sm">
                                <View className="flex-row items-center gap-3">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${i === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                        <Text className={`font-black text-sm ${i === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{coin[0]}</Text>
                                    </View>
                                    <View>
                                        <Text className="font-black text-slate-900 text-sm mb-0.5">{coin}</Text>
                                        <Text className="text-[10px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded self-start">{i === 0 ? '1,000.00' : '0.015'} {coin}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className="font-black text-slate-900 text-base mb-0.5">${i === 0 ? '1,000.00' : '1,440.00'}</Text>
                                    <Text className="text-[10px] font-bold text-emerald-500">+1.2%</Text>
                                </View>
                            </View>
                        ))}
                    </>
                ) : (
                    <>
                        <View className="flex-row gap-2 mb-4">
                            {['All', 'Buy', 'Sell', 'Swap'].map((t, i) => (
                                <TouchableOpacity key={i} className={`px-4 py-2 rounded-xl ${i === 0 ? 'bg-[#0E1A2E]' : 'bg-white border border-slate-200'}`}>
                                    <Text className={`font-black text-xs ${i === 0 ? 'text-white' : 'text-slate-600'}`}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <View key={i} className={`flex-row justify-between items-center p-4 ${i !== 4 ? 'border-b border-slate-50' : ''}`}>
                                    <View className="flex-row items-center gap-3">
                                        <View className={`w-10 h-10 rounded-full items-center justify-center ${i % 2 === 0 ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                                            <Ionicons name={i % 2 === 0 ? 'swap-horizontal' : 'arrow-down'} size={16} color={i % 2 === 0 ? "#3b82f6" : "#10b981"} />
                                        </View>
                                        <View>
                                            <Text className="font-black text-slate-900 text-xs mb-0.5">{i % 2 === 0 ? 'Swap USDT for BTC' : 'Received USDT'}</Text>
                                            <Text className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Oct 12, 14:30</Text>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Text className={`font-black text-sm mb-1 ${i % 2 === 0 ? 'text-slate-900' : 'text-emerald-500'}`}>
                                            {i % 2 === 0 ? '-100 USDT' : '+50 USDT'}
                                        </Text>
                                        <View className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                            <Text className="text-[8px] text-emerald-600 font-black uppercase tracking-wider">Completed</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    )
}

function SettingsView() {
    const SettingRow = ({ icon, title, value, color = "#0E1A2E", toggle = false }: any) => (
        <TouchableOpacity className="flex-row items-center justify-between py-4 border-b border-slate-50">
            <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl items-center justify-center bg-slate-50 border border-slate-100 shadow-sm">
                    <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text className="font-black text-slate-900 text-sm">{title}</Text>
            </View>
            <View className="flex-row items-center gap-3">
                {value && <Text className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{value}</Text>}
                {toggle ? (
                    <View className="w-10 h-6 bg-emerald-500 rounded-full items-end justify-center px-1 shadow-inner">
                        <View className="w-4 h-4 bg-white rounded-full shadow-sm" />
                    </View>
                ) : (
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <Text className="text-2xl font-black text-[#0E1A2E] mb-6 pt-2 tracking-tight">Settings</Text>

            <View className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm mb-6">
                <SettingRow icon="shield-checkmark" title="Security" value="Strong" color="#10b981" />
                <SettingRow icon="finger-print" title="Biometric Login" toggle={true} color="#3b82f6" />
                <SettingRow icon="notifications" title="Price Alerts" value="On" color="#f59e0b" />
            </View>

            <Text className="text-xs font-black text-slate-400 mb-3 px-3 uppercase tracking-widest">Preferences</Text>
            <View className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm mb-6">
                <SettingRow icon="cash" title="Default Currency" value="NGN (₦)" color="#0E1A2E" />
                <SettingRow icon="globe" title="Default Network" value="TRC20" color="#8b5cf6" />
                <SettingRow icon="language" title="Language" value="EN" color="#0ea5e9" />
            </View>

            <Text className="text-xs font-black text-slate-400 mb-3 px-3 uppercase tracking-widest">Rewards & Info</Text>
            <View className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm mb-6">
                <SettingRow icon="gift" title="Refer & Earn" value="Active" color="#f59e0b" />
                <SettingRow icon="star" title="Cashback History" color="#f43f5e" />
                <SettingRow icon="help-buoy" title="Help & Support" color="#0E1A2E" />
            </View>

        </ScrollView>
    )
}
