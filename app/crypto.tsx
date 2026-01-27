import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput, Linking, Clipboard, StyleSheet, Vibration, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { CryptoRate } from '../services/partners';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- TYPES ---
type Tab = 'home' | 'markets' | 'trade' | 'futures' | 'wallet';

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
            const rates = await api.crypto.getRates(['bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 'ripple', 'cardano', 'dogecoin']);
            setAssets(rates);
        } catch (e) {
            console.log("Error fetching stats");
        } finally {
            setLoading(false);
        }
    };

    const fetchRates = async () => {
        try {
            const rates = await api.crypto.getRates(['bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 'ripple', 'cardano', 'dogecoin']);
            setAssets(rates);
        } catch (error) {
            console.log("Crypto Refresh Skipped");
        }
    };

    return (
        <View className="flex-1 bg-slate-50" style={{ paddingTop: insets.top }}>
            <StatusBar style="dark" />

            {/* TAB CONTENT */}
            <View className="flex-1 pb-24">
                {activeTab === 'home' && (
                    <HomeView 
                        assets={assets} 
                        loading={loading} 
                        permission={permission} 
                        requestPermission={requestPermission}
                    />
                )}
                {activeTab === 'markets' && <MarketsView assets={assets} />}
                {activeTab === 'trade' && <TradeView assets={assets} />}
                {activeTab === 'futures' && <FuturesView assets={assets} />}
                {activeTab === 'wallet' && <WalletView assets={assets} />}
            </View>

            {/* NAVIGATION BAR */}
            <CustomTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        </View>
    );
}

// --- SHARED COMPONENTS ---

const CustomTabBar = ({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) => (
    <View className="absolute bottom-8 left-6 right-6 bg-white rounded-full p-2 flex-row justify-between items-center shadow-2xl shadow-slate-300/50 border border-slate-50">
            {[
                { id: 'home', icon: 'home', label: 'Home' },
                { id: 'markets', icon: 'bar-chart', label: 'Markets' },
                { id: 'trade', icon: 'swap-horizontal', label: 'Trade' },
                { id: 'futures', icon: 'trending-up', label: 'Futures' },
                { id: 'wallet', icon: 'wallet', label: 'Wallet' },
            ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <TouchableOpacity 
                    key={tab.id} 
                    onPress={() => setActiveTab(tab.id as Tab)}
                    className={`flex-row items-center justify-center rounded-full ${isActive ? 'bg-indigo-600 px-4 py-3' : 'w-12 h-12 bg-transparent'}`}
                    >
                        <Ionicons 
                        name={tab.icon as any} 
                        size={20} 
                        color={isActive ? 'white' : '#94a3b8'} 
                        />
                        {isActive && (
                            <Text className="text-white font-bold ml-2 text-xs">{tab.label}</Text>
                        )}
                    </TouchableOpacity>
                );
            })}
    </View>
);

// --- SUB-VIEWS ---

function HomeView({ assets, loading, permission, requestPermission }: { assets: CryptoRate[], loading: boolean, permission: any, requestPermission: any }) {
    const router = useRouter();
    const [walletBalance, setWalletBalance] = useState(0);
    const [hideBalance, setHideBalance] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannedData, setScannedData] = useState('');
    const [modalType, setModalType] = useState<'send' | 'receive' | 'buy' | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<CryptoRate | null>(null);
    const [sentimentIndex, setSentimentIndex] = useState(72);

    // Fetch Balance
    useEffect(() => {
        const getBal = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) setWalletBalance(data.balance);
            }
        };
        getBal();
        
        // Randomize Sentiment slightly for "Live" feel
        setSentimentIndex(prev => Math.floor(Math.random() * (78 - 68 + 1)) + 68);
    }, []);

    // Dynamic Top Gainer
    const topGainer = useMemo<Partial<CryptoRate>>(() => {
        if (assets.length === 0) return { symbol: '---', percent_change_24h: 0 };
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

    const onBarcodeScanned = ({ data }: { data: string }) => {
        setScannerVisible(false);
        setScannedData(data);
        Vibration.vibrate();
        Alert.alert("Scanned", data, [
            { text: "Copy", onPress: () => Clipboard.setString(data) },
            { text: "Send to Address", onPress: () => { setModalType('send'); setSelectedAsset(assets[0]); } }
        ]);
    };

    return (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
             {/* HEADER */}
             <View className="pt-6 px-6 pb-6 bg-white rounded-b-[40px] shadow-sm z-10 mb-6">
                <View className="flex-row justify-between items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center">
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text className="text-slate-800 font-bold text-lg">My Wallet</Text>
                    <TouchableOpacity className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center">
                        <Ionicons name="notifications-outline" size={20} color="#1e293b" />
                    </TouchableOpacity>
                </View>

                {/* BALANCE CARD */}
                <LinearGradient
                    colors={['#2563eb', '#1e40af']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    className="p-6 rounded-3xl shadow-xl shadow-blue-500/30 relative overflow-hidden"
                >
                    <View className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="text-blue-200 font-medium">Total Balance</Text>
                        <View className="flex-row gap-2">
                            <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} className="bg-blue-800/50 p-2 rounded-full">
                                <Ionicons name={hideBalance ? "eye-off" : "eye"} size={16} color="#93c5fd" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleScan} className="bg-blue-800/50 p-2 rounded-full">
                                <Ionicons name="scan" size={16} color="#93c5fd" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text className="text-white text-4xl font-black mb-4">
                        {hideBalance ? '₦ ****' : `₦${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </Text>
                    <View className="flex-row space-x-3">
                         <View className="bg-white/20 px-3 py-1 rounded-lg flex-row items-center border border-white/10">
                             <Ionicons name="trending-up" color="#4ade80" size={16} />
                             <Text className="text-green-300 font-bold ml-1">+2.4%</Text>
                         </View>
                    </View>
                </LinearGradient>

                {/* ACTIONS */}
                <View className="flex-row justify-between mt-8 px-2">
                    {[
                        { label: 'Send', icon: 'paper-plane-outline', action: () => setModalType('send') },
                        { label: 'Receive', icon: 'qr-code-outline', action: () => setModalType('receive') },
                        { label: 'Swap', icon: 'swap-horizontal', action: () => Alert.alert("Use Trade Tab", "Please use the Trade tab below.") },
                        { label: 'Buy', icon: 'cart-outline', action: () => setModalType('buy') },
                    ].map((btn, i) => (
                        <View key={i} className="items-center gap-2">
                            <TouchableOpacity onPress={btn.action} className="w-14 h-14 bg-white border border-slate-100 shadow-sm rounded-2xl items-center justify-center">
                                <Ionicons name={btn.icon as any} size={24} color="#2563eb" />
                            </TouchableOpacity>
                            <Text className="text-slate-600 text-xs font-bold">{btn.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* WIDGETS */}
            <View className="px-6 mb-8">
                 <View className="flex-row gap-4 mb-8">
                    {/* Dynamic Sentiment */}
                    <View className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <Text className="text-slate-500 font-bold text-xs uppercase mb-2">Market Mood</Text>
                        <Text className="text-emerald-500 text-2xl font-black">Greed</Text>
                        <Text className="text-slate-400 text-xs font-bold mb-2">Index: {sentimentIndex}/100</Text>
                        <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <LinearGradient colors={['#ef4444', '#eab308', '#22c55e']} start={{x:0, y:0}} end={{x:1, y:0}} className="flex-1" />
                            <View className="absolute top-0 bottom-0 bg-slate-800 w-1" style={{ left: `${sentimentIndex}%` }} />
                        </View>
                    </View>
                     {/* Dynamic Top Gainer */}
                    <View className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm justify-between">
                         <View className="flex-row justify-between">
                             <Text className="text-slate-500 font-bold text-xs uppercase">Top Gainer</Text>
                             <Ionicons name="flame" color="#f59e0b" size={16} />
                         </View>
                         <View>
                             <Text className="text-slate-800 font-black text-xl">{topGainer.symbol || '---'}</Text>
                             <Text className="text-emerald-500 font-bold">+{topGainer.percent_change_24h?.toFixed(2) || 0}%</Text>
                         </View>
                    </View>
                </View>

                {/* EARN */}
                <View className="mb-8">
                    <Text className="text-slate-800 font-bold text-xl mb-4">Earn Yield</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {[ { coin: 'USDT', apy: '12%', color: '#26A17B' }, { coin: 'AXS', apy: '45%', color: '#0055D5' } ].map((item, i) => (
                             <TouchableOpacity key={i} className="mr-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-36">
                                 <View className="flex-row justify-between items-start mb-2">
                                     <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: item.color + '20' }}>
                                          <Text className="font-bold text-xs" style={{ color: item.color }}>{item.coin}</Text>
                                     </View>
                                     <View className="bg-green-100 px-2 py-1 rounded-lg"><Text className="text-green-700 font-bold text-xs">+{item.apy}</Text></View>
                                 </View>
                                 <Text className="text-slate-800 font-black text-lg">{item.apy} APY</Text>
                             </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* CAMERA MODAL */}
            <Modal visible={scannerVisible} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-black">
                     <View className="absolute top-12 left-6 z-10">
                        <TouchableOpacity onPress={() => setScannerVisible(false)} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                     </View>
                     <CameraView
                        style={{ flex: 1 }}
                        onBarcodeScanned={onBarcodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr"],
                        }}
                     />
                     <View className="absolute bottom-20 self-center bg-black/60 px-6 py-3 rounded-full">
                         <Text className="text-white font-bold">Align QR Code to Scan</Text>
                     </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

function MarketsView({ assets }: { assets: CryptoRate[] }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'Spot' | 'Futures' | 'New'>('Spot');

    const filteredAssets = assets.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.symbol.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'Spot' ? true : filter === 'Futures' ? ['BTC', 'ETH', 'SOL', 'BNB'].includes(a.symbol) : ['DOGE', 'XRP', 'ADA'].includes(a.symbol);
        return matchesSearch && matchesFilter;
    });

    const renderItem = useCallback(({ item }: { item: CryptoRate }) => (
        <TouchableOpacity className="flex-row items-center justify-between bg-white p-4 rounded-2xl mb-3 border border-slate-100">
             <View className="flex-row items-center gap-3">
                 <Image source={{ uri: item.image }} className="w-10 h-10 rounded-full" />
                 <View>
                     <Text className="text-slate-800 font-bold">{item.name}</Text>
                     <Text className="text-slate-400 text-xs font-bold">{item.symbol}</Text>
                 </View>
             </View>
             <View className="items-end">
                 <Text className="text-slate-800 font-bold">${item.price_usd?.toLocaleString() ?? '0.00'}</Text>
                 <Text className={`text-xs font-bold ${(item.percent_change_24h || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                     {(item.percent_change_24h || 0).toFixed(2)}%
                 </Text>
             </View>
        </TouchableOpacity>
    ), []);

    return (
        <View className="flex-1 bg-slate-50 relative">
             <View className="px-6 pt-5 pb-2">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-3xl font-black text-slate-800">Markets</Text>
                    <TouchableOpacity className="bg-slate-100 p-2 rounded-full"><Ionicons name="search" size={20} color="#64748b" /></TouchableOpacity>
                </View>

                {/* SEGMENT CONTROL - FIXED: Removed conditional shadows/layouts */}
                <View className="flex-row bg-slate-200 p-1 rounded-xl mb-6">
                    {['Spot', 'Futures', 'New'].map(f => {
                        const isActive = filter === f;
                        return (
                            <TouchableOpacity 
                                key={f} 
                                onPress={() => setFilter(f as any)} 
                                className={`flex-1 py-2 items-center rounded-lg ${isActive ? 'bg-white' : 'bg-transparent'}`}
                                style={isActive ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {}}
                            >
                                <Text className={`font-bold ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{f}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TextInput 
                    placeholder="Search coins..." 
                    className="bg-white border border-slate-100 p-4 rounded-2xl mb-2 text-base font-medium"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList 
                data={filteredAssets}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                ListEmptyComponent={() => (
                     <View className="items-center py-10">
                         <Text className="text-slate-400 font-bold">No assets found</Text>
                     </View>
                )}
            />
        </View>
    )
}

function TradeView({ assets }: { assets: CryptoRate[] }) {
    const [amount, setAmount] = useState('');
    const btcPrice = assets.find(a => a.symbol === 'BTC')?.price_usd || 96000; // Default to current market approx if loading

    return (
        <ScrollView className="flex-1 px-6 bg-slate-50" contentContainerStyle={{ paddingTop: 20 }}>
             <Text className="text-center font-bold text-slate-800 text-lg mb-8">Swap</Text>
             
             <View className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-100 mb-4">
                 <View className="flex-row justify-between mb-2">
                     <Text className="text-slate-400 font-bold text-xs">You Pay</Text>
                     <Text className="text-slate-800 font-bold text-xs">Balance: 0.0000 BTC</Text>
                 </View>
                 <View className="flex-row justify-between items-center">
                    <TextInput 
                        className="text-3xl font-black text-slate-800 flex-1" 
                        placeholder="0" 
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity className="bg-slate-50 px-3 py-2 rounded-xl flex-row items-center gap-2 border border-slate-100">
                        <View className="w-6 h-6 rounded-full bg-orange-400" />
                        <Text className="font-bold text-slate-700">BTC</Text>
                        <Ionicons name="chevron-down" size={16} color="#64748b" />
                    </TouchableOpacity>
                 </View>
             </View>

             <View className="items-center -my-6 z-10">
                 <View className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                     <Ionicons name="arrow-down" size={24} color="#2563eb" />
                 </View>
             </View>

             <View className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-100 mt-2">
                 <View className="flex-row justify-between mb-2">
                     <Text className="text-slate-400 font-bold text-xs">You Receive</Text>
                 </View>
                 <View className="flex-row justify-between items-center">
                    <Text className="text-3xl font-black text-slate-800">
                        {amount ? (Number(amount) * btcPrice).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                    </Text>
                    <TouchableOpacity className="bg-slate-50 px-3 py-2 rounded-xl flex-row items-center gap-2 border border-slate-100">
                        <View className="w-6 h-6 rounded-full bg-green-500" />
                        <Text className="font-bold text-slate-700">USDT</Text>
                        <Ionicons name="chevron-down" size={16} color="#64748b" />
                    </TouchableOpacity>
                 </View>
             </View>

             <View className="mt-6 flex-row justify-between px-2">
                 <Text className="text-slate-400 font-medium text-xs">Slippage Tolerance</Text>
                 <Text className="text-slate-800 font-bold text-xs">0.5%</Text>
             </View>

             <View className="mt-2 flex-row justify-between px-2">
                 <Text className="text-slate-400 font-medium text-xs">Rate</Text>
                 <Text className="text-slate-800 font-bold text-xs">1 BTC = ${btcPrice.toLocaleString()}</Text>
             </View>

             <TouchableOpacity className="bg-blue-600 w-full py-5 rounded-2xl items-center shadow-xl shadow-blue-500/30 mt-8">
                 <Text className="text-white font-black text-lg">Swap</Text>
             </TouchableOpacity>
        </ScrollView>
    )
}

function FuturesView({ assets }: { assets: CryptoRate[] }) {
    // 1. Core State
    const btcRate = assets.find(a => a.symbol === 'BTC')?.price_usd || 45000;
    const [displayPrice, setDisplayPrice] = useState(btcRate);
    const [limitPrice, setLimitPrice] = useState(btcRate.toFixed(2));
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [leverage, setLeverage] = useState(20);
    const [amount, setAmount] = useState('');
    const [usdtBalance, setUsdtBalance] = useState(10000); 
    const [orderType, setOrderType] = useState<'Limit' | 'Market'>('Market');
    const [marginMode, setMarginMode] = useState<'Cross' | 'Isolated'>('Cross');
    
    // Positions State
    const [positions, setPositions] = useState<any[]>([]);

    // 2. Live Ticker Effect
    useEffect(() => {
        if (Math.abs(displayPrice - btcRate) > 1000) setDisplayPrice(btcRate);

        const interval = setInterval(() => {
            setDisplayPrice(prev => {
                const volatility = prev * 0.0005; 
                const noise = (Math.random() - 0.5) * volatility; 
                return prev + noise;
            });
        }, 1000); 

        return () => clearInterval(interval);
    }, [btcRate]);

    // 3. Trading Logic Helpers
    const calculateMargin = (amtStr: string = amount) => {
        const amt = parseFloat(amtStr);
        if (isNaN(amt) || amt <= 0) return 0;
        const price = orderType === 'Limit' ? parseFloat(limitPrice) : displayPrice;
        return (amt * price) / leverage;
    };

    const calculateLiqPrice = (entry: number, lev: number, type: 'Long' | 'Short') => {
        if (type === 'Long') return entry * (1 - (1 / lev));
        return entry * (1 + (1 / lev));
    };

    const handleSetPercentage = (percent: number) => {
        const price = orderType === 'Limit' ? parseFloat(limitPrice) : displayPrice;
        if (!price) return;
        
        const safeBalance = usdtBalance * 0.99; 
        const maxMargin = safeBalance * percent;
        const potentialSize = (maxMargin * leverage) / price;
        setAmount(potentialSize.toFixed(3));
    };

    const handleOpenPosition = () => {
        const amt = parseFloat(amount);
        const margin = calculateMargin();
        const price = orderType === 'Limit' ? parseFloat(limitPrice) : displayPrice;

        if (isNaN(amt) || amt <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        if (margin > usdtBalance) {
            alert('Insufficient USDT Balance');
            return;
        }

        const newPos = {
            id: Math.random().toString(36).substr(2, 9),
            symbol: 'BTC/USDT',
            side: side === 'buy' ? 'Long' : 'Short',
            entryPrice: price,
            size: amt,
            leverage: leverage,
            margin: margin,
            liqPrice: calculateLiqPrice(price, leverage, side === 'buy' ? 'Long' : 'Short')
        };

        setUsdtBalance(prev => prev - margin);
        setPositions(prev => [newPos, ...prev]);
        setAmount('');
    };

    const handleClosePosition = (id: string) => {
        const pos = positions.find(p => p.id === id);
        if (!pos) return;

        const currentVal = pos.size * displayPrice;
        const entryVal = pos.size * pos.entryPrice;
        const pnl = pos.side === 'Long' ? (currentVal - entryVal) : (entryVal - currentVal);
        
        setUsdtBalance(prev => prev + pos.margin + pnl);
        setPositions(prev => prev.filter(p => p.id !== id));
    };

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}>
             {/* HEADER */}
             <View className="flex-row justify-between items-center px-6 mb-6">
                 <View className="flex-row gap-2 items-center">
                     <Ionicons name="menu" size={24} color="#1e293b" />
                     <View>
                        <Text className="text-xl font-black text-slate-800">BTC/USDT</Text>
                        <View className="flex-row items-center gap-1 bg-slate-100 rounded px-1">
                             <Text className="text-xs font-bold" style={{ color: side === 'buy' ? '#22c55e' : '#ef4444' }}>Perpetual</Text>
                        </View>
                     </View>
                 </View>
                 <View className="items-end">
                     <Text className="text-2xl font-black" style={{ color: displayPrice > btcRate ? '#22c55e' : '#ef4444' }}>
                        ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </Text>
                     <Text className="text-xs text-slate-400 font-bold">Mark Price</Text>
                 </View>
             </View>

             <View className="flex-row px-4 gap-4">
                 {/* ORDER FORM */}
                 <View className="flex-1">
                     {/* Switch Mode Tab */}
                     <View className="flex-row bg-slate-200 rounded-lg p-1 mb-4">
                         <Pressable 
                            onPress={() => setSide('buy')} 
                            className="flex-1 py-1.5 items-center rounded-md"
                            style={{ 
                                backgroundColor: side === 'buy' ? 'white' : 'transparent',
                                shadowColor: side === 'buy' ? '#000' : 'transparent',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: side === 'buy' ? 0.1 : 0,
                                shadowRadius: 1,
                                elevation: side === 'buy' ? 1 : 0
                            }}
                         >
                             <Text className="font-black text-xs" style={{ color: side === 'buy' ? '#16a34a' : '#64748b' }}>Buy</Text>
                         </Pressable>
                         <Pressable 
                            onPress={() => setSide('sell')} 
                            className="flex-1 py-1.5 items-center rounded-md"
                            style={{ 
                                backgroundColor: side === 'sell' ? 'white' : 'transparent',
                                shadowColor: side === 'sell' ? '#000' : 'transparent',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: side === 'sell' ? 0.1 : 0,
                                shadowRadius: 1,
                                elevation: side === 'sell' ? 1 : 0
                            }}
                         >
                             <Text className="font-black text-xs" style={{ color: side === 'sell' ? '#dc2626' : '#64748b' }}>Sell</Text>
                         </Pressable>
                     </View>

                     {/* Margin Mode & Asset Info */}
                     <View className="flex-row gap-2 mb-4">
                        <Pressable className="bg-slate-200 px-3 py-1 rounded text-xs font-bold text-slate-600">
                            <Text className="text-[10px] font-bold text-slate-500">{marginMode} {leverage}x</Text>
                        </Pressable>
                     </View>

                     {/* Order Type Tabs */}
                     <View className="flex-row gap-4 mb-4 border-b border-slate-200 pb-2">
                         <Pressable onPress={() => setOrderType('Limit')}>
                             <Text className={`text-xs font-bold ${orderType === 'Limit' ? 'text-slate-800' : 'text-slate-400'}`}>Limit</Text>
                         </Pressable>
                         <Pressable onPress={() => setOrderType('Market')}>
                             <Text className={`text-xs font-bold ${orderType === 'Market' ? 'text-slate-800' : 'text-slate-400'}`}>Market</Text>
                         </Pressable>
                         <Pressable><Text className="text-xs font-bold text-slate-400">Stop</Text></Pressable>
                     </View>

                     {/* Price Input (For Limit) */}
                     <View className="bg-white p-3 rounded-xl border border-slate-200 mb-2">
                         <Text className="text-[10px] text-slate-400 font-bold uppercase">Price (USDT)</Text>
                         {orderType === 'Limit' ? (
                             <TextInput 
                                className="font-bold text-slate-800 p-0 text-base" 
                                value={limitPrice}
                                onChangeText={setLimitPrice}
                                keyboardType="numeric"
                             />
                         ) : (
                             <Text className="font-bold text-slate-400 p-0 text-base py-1">Market Price</Text>
                         )}
                     </View>

                     {/* Amount Input */}
                     <View className="bg-white p-3 rounded-xl border border-slate-200 mb-2">
                         <Text className="text-[10px] text-slate-400 font-bold uppercase">Amount (BTC)</Text>
                         <TextInput 
                            className="font-bold text-slate-800 p-0 text-base" 
                            placeholder="0.00" 
                            placeholderTextColor="#cbd5e1"
                            keyboardType="numeric" 
                            value={amount}
                            onChangeText={setAmount}
                         />
                     </View>

                     {/* Percentage Buttons */}
                     <View className="flex-row gap-1 mb-4">
                         {[0.25, 0.50, 0.75, 1.0].map((pct, i) => (
                             <Pressable 
                                key={i} 
                                onPress={() => handleSetPercentage(pct)}
                                className="flex-1 bg-slate-100 py-1 items-center rounded border border-slate-200 active:bg-slate-200"
                             >
                                 <Text className="text-[10px] font-bold text-slate-500">{pct * 100}%</Text>
                             </Pressable>
                         ))}
                     </View>

                     {/* Leverage Slider (Chips) */}
                     <View className="mb-4">
                         <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                            {[1, 5, 10, 20, 50, 100, 125].map(l => (
                                <Pressable 
                                    key={l} 
                                    onPress={() => setLeverage(l)}
                                    className="px-3 py-1 rounded-full border"
                                    style={{ 
                                        backgroundColor: leverage === l ? '#1e293b' : 'white', 
                                        borderColor: leverage === l ? '#1e293b' : '#cbd5e1' 
                                    }}
                                >
                                    <Text className="text-xs font-bold" style={{ color: leverage === l ? 'white' : '#64748b' }}>{l}x</Text>
                                </Pressable>
                            ))}
                         </ScrollView>
                     </View>

                     {/* Assets & Cost Info */}
                     <View className="mb-4">
                         <View className="flex-row justify-between mb-1">
                             <Text className="text-xs font-bold text-slate-400">Avail:</Text>
                             <Text className="text-xs font-bold text-slate-800">{usdtBalance.toLocaleString()} USDT</Text>
                         </View>
                         <View className="flex-row justify-between mb-1">
                            <Text className="text-xs font-bold text-slate-400">Max Buy:</Text>
                            <Text className="text-xs font-bold text-slate-800">{((usdtBalance * leverage) / displayPrice).toFixed(4)} BTC</Text>
                         </View>
                         <View className="flex-row justify-between pt-2 border-t border-slate-100">
                             <Text className="text-xs font-bold text-slate-400">Cost:</Text>
                             <Text className="text-xs font-bold text-slate-800">{calculateMargin().toFixed(2)} USDT</Text>
                         </View>
                     </View>

                     <Pressable 
                         onPress={handleOpenPosition}
                         className="py-3.5 rounded-xl items-center shadow-lg shadow-sm"
                         style={{ backgroundColor: side === 'buy' ? '#22c55e' : '#ef4444' }}
                     >
                         <Text className="text-white font-black text-lg">
                             {side === 'buy' ? 'Buy / Long' : 'Sell / Short'}
                         </Text>
                     </Pressable>
                 </View>

                 {/* ORDER BOOK (VISUAL) */}
                 <View className="w-[40%]">
                     <View className="flex-row justify-between mb-2">
                        <View>
                             <Text className="text-[10px] font-bold text-slate-400">Price</Text>
                             <Text className="text-[10px] font-bold text-slate-400">(USDT)</Text>
                        </View>
                        <View className="items-end">
                             <Text className="text-[10px] font-bold text-slate-400">Amount</Text>
                             <Text className="text-[10px] font-bold text-slate-400">(BTC)</Text>
                        </View>
                     </View>
                     
                     {/* Unrolled Sell Orders */}
                     {[...Array(6)].map((_, i) => {
                         const p = displayPrice + (12 + i * 5);
                         const a = (Math.random()).toFixed(3);
                         return (
                            <Pressable key={`sell-${i}`} onPress={() => setLimitPrice(p.toFixed(2))} className="flex-row justify-between mb-1">
                                <Text className="text-red-500 text-xs font-bold">{p.toFixed(1)}</Text>
                                <Text className="text-slate-400 text-xs">{a}</Text>
                            </Pressable>
                         );
                     }).reverse()}
                     
                     <Text className="text-lg font-black my-2 text-center" style={{ color: displayPrice > btcRate ? '#22c55e' : '#ef4444' }}>
                        {displayPrice.toFixed(1)}
                     </Text>
                     
                     {/* Unrolled Buy Orders */}
                     {[...Array(6)].map((_, i) => {
                         const p = displayPrice - (12 + i * 5);
                         const a = (Math.random()).toFixed(3);
                         return (
                            <Pressable key={`buy-${i}`} onPress={() => setLimitPrice(p.toFixed(2))} className="flex-row justify-between mb-1">
                                <Text className="text-green-500 text-xs font-bold">{p.toFixed(1)}</Text>
                                <Text className="text-slate-400 text-xs">{a}</Text>
                            </Pressable>
                         );
                     })}
                 </View>
             </View>

             {/* POSITIONS & ASSETS */}
             <View className="mt-8 px-4">
                 <View className="flex-row gap-4 border-b border-slate-200 pb-2 mb-4">
                     <Text className="text-sm font-bold text-slate-800 border-b-2 border-slate-800 pb-2">Positions ({positions.length})</Text>
                     <Text className="text-sm font-bold text-slate-400">Open Orders (0)</Text>
                 </View>

                 {positions.length === 0 ? (
                     <View className="items-center py-10 bg-white rounded-xl border border-slate-100 border-dashed">
                         <Text className="text-slate-400 font-bold">No open positions</Text>
                     </View>
                 ) : (
                     positions.map(pos => {
                         // Real-time PNL Calculation
                         const currentVal = pos.size * displayPrice;
                         const entryVal = pos.size * pos.entryPrice;
                         const pnl = pos.side === 'Long' ? (currentVal - entryVal) : (entryVal - currentVal);
                         const pnlPercent = (pnl / pos.margin) * 100;
                         const isProfit = pnl >= 0;

                         return (
                             <View key={pos.id} className="bg-white p-4 rounded-xl border border-slate-200 mb-2 shadow-sm">
                                 <View className="flex-row justify-between mb-2">
                                     <View className="flex-row items-center gap-2">
                                         <Text className="font-black text-slate-800 text-lg">{pos.symbol}</Text>
                                         <View className={`px-1.5 py-0.5 rounded ${pos.side === 'Long' ? 'bg-green-100' : 'bg-red-100'}`}>
                                             <Text className={`text-[10px] font-bold ${pos.side === 'Long' ? 'text-green-700' : 'text-red-700'}`}>{pos.side} {pos.leverage}x</Text>
                                         </View>
                                     </View>
                                     <Text className="font-black text-lg" style={{ color: isProfit ? '#16a34a' : '#dc2626' }}>
                                         {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                     </Text>
                                 </View>
                                 
                                 <View className="flex-row justify-between mb-2">
                                     <View>
                                         <Text className="text-[10px] text-slate-400 uppercase font-bold">Size</Text>
                                         <Text className="font-bold text-slate-700 text-xs">{(pos.size * displayPrice).toFixed(2)}</Text>
                                     </View>
                                     <View className="items-end">
                                          <Text className="text-[10px] text-slate-400 uppercase font-bold">Entry Price</Text>
                                          <Text className="font-bold text-slate-700 text-xs">{pos.entryPrice.toFixed(2)}</Text>
                                     </View>
                                 </View>

                                 <View className="flex-row justify-between mb-4">
                                     <View>
                                         <Text className="text-[10px] text-slate-400 uppercase font-bold">Liq. Price</Text>
                                         <Text className="font-bold text-orange-500 text-xs">{pos.liqPrice.toFixed(2)}</Text>
                                     </View>
                                     <View className="items-end">
                                          <Text className="text-[10px] text-slate-400 uppercase font-bold">Margin</Text>
                                          <Text className="font-bold text-slate-700 text-xs">{pos.margin.toFixed(2)}</Text>
                                     </View>
                                 </View>

                                 <View className="flex-row justify-between items-center pt-2 border-t border-slate-50">
                                     <View>
                                          <Text className="text-[10px] text-slate-400 font-bold uppercase">Unrealized PNL</Text>
                                          <Text className="font-bold text-sm" style={{ color: isProfit ? '#16a34a' : '#dc2626' }}>
                                              {isProfit ? '+' : ''}{pnl.toFixed(2)} USDT
                                          </Text>
                                     </View>
                                     <Pressable 
                                        onPress={() => handleClosePosition(pos.id)}
                                        className="bg-slate-100 px-4 py-2 rounded-lg active:bg-slate-200"
                                     >
                                         <Text className="text-xs font-bold text-slate-600">Close Position</Text>
                                     </Pressable>
                                 </View>
                             </View>
                         );
                     })
                 )}
             </View>
        </ScrollView>
    )
}

function WalletView({ assets }: { assets: CryptoRate[] }) {
    const [balance, setBalance] = useState(0);
    const [cryptoHoldings, setCryptoHoldings] = useState<{ symbol: string; amount: number; valueUsd: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'overview' | 'spot' | 'futures' | 'earn'>('overview');
    
    // Actions State
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [actionType, setActionType] = useState<'Deposit' | 'Withdraw' | 'Transfer' | null>(null);

    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    useEffect(() => {
        fetchWalletData();
    }, [assets]); // Re-run when assets (prices) update

    const fetchWalletData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // 1. Fetch Fiat Balance
                const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (profile) setBalance(profile.balance);

                // 2. Fetch All Transactions for Holdings Calculation
                const { data: allTxns } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .in('status', ['success', 'completed']);

                // Calculate Holdings
                if (allTxns) {
                    const holdingsMap: Record<string, number> = {};
                    allTxns.forEach(tx => {
                        // Assuming metadata contains { symbol: 'BTC', amount: 0.5 } for crypto txns
                        // This is a heuristic since we don't know exact metadata structure yet. 
                        // We will check for 'crypto_buy' or 'crypto_sell' and try to parse metadata if available, 
                        // or just use placeholders if schema is strict.
                        // ADJUSTMENT: Since we are making it LIVE, we will focus on what we CAN know. 
                        // If no specific crypto metadata, we will show "USDT" as default for 'crypto_buy' for now to demonstrate logic.
                        
                        // NOTE: For this specific task, we will try to infer.
                        if (tx.type === 'crypto_buy') {
                             const symbol = (tx.metadata?.symbol || 'USDT').toUpperCase();
                             const amount = parseFloat(tx.metadata?.amount || (tx.amount / 1500)); // Rough estimation if no amount
                             holdingsMap[symbol] = (holdingsMap[symbol] || 0) + amount;
                        }
                    });

                    const computedHoldings = Object.entries(holdingsMap).map(([symbol, amount]) => {
                        const rate = assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase())?.price_usd || 0;
                        return { symbol, amount, valueUsd: amount * rate };
                    }).sort((a, b) => b.valueUsd - a.valueUsd);

                    setCryptoHoldings(computedHoldings);
                }

                // 3. Fetch Recent Activity (Limit 5)
                const { data: recent } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                
                if (recent) setRecentActivity(recent);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (type: 'Deposit' | 'Withdraw' | 'Transfer') => {
        setActionType(type);
        setActionModalVisible(true);
    };

    // Helper for Tab Button
    const TabButton = ({ title, section }: { title: string, section: typeof activeSection }) => (
        <Pressable 
            onPress={() => setActiveSection(section)}
            className={`flex-1 py-2 items-center rounded-xl ${activeSection === section ? 'bg-white shadow-sm' : 'bg-transparent'}`}
        >
            <Text className={`font-bold ${activeSection === section ? 'text-slate-900' : 'text-slate-500'}`}>{title}</Text>
        </Pressable>
    );

    // Calculate Percentages for Bar
    const totalPortfolioValue = cryptoHoldings.reduce((sum, h) => sum + h.valueUsd, 0) || 1; // Avoid div by 0
    const top3 = cryptoHoldings.slice(0, 3);
    const otherValue = cryptoHoldings.slice(3).reduce((sum, h) => sum + h.valueUsd, 0);

    return (
        <ScrollView className="flex-1 px-6 bg-slate-50" contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}>
             {/* PREMIUM HEADER - With Gradient */}
             <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="mb-8 mt-2 p-6 rounded-3xl shadow-lg shadow-indigo-500/30"
             >
                 <View className="flex-row justify-between items-center">
                     <View>
                        <Text className="text-indigo-200 font-bold text-xs uppercase tracking-widest mb-1">My Portfolio</Text>
                        <Text className="text-3xl font-black text-white">Wallet</Text>
                     </View>
                     <View className="flex-row gap-2">
                         <Pressable className="bg-white/20 p-2 rounded-full border border-white/20 active:bg-white/30">
                             <Ionicons name="scan" size={24} color="white" />
                         </Pressable>
                         <Pressable className="bg-white/20 p-2 rounded-full border border-white/20 active:bg-white/30">
                             <Ionicons name="notifications-outline" size={24} color="white" />
                         </Pressable>
                     </View>
                 </View>
             </LinearGradient>

             {/* MAIN PORTFOLIO CARD */}
             <LinearGradient
                colors={['#1e1b4b', '#312e81']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-8 rounded-[40px] mb-8 relative overflow-hidden shadow-xl shadow-slate-900/30"
             >
                 {/* Premium Background Effects */}
                 <View className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
                 <View className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl -ml-10 -mb-10" />
                 
                 <View className="flex-row justify-between items-start mb-4">
                     <Text className="text-indigo-200 font-bold text-xs uppercase tracking-widest">Total Asset Value</Text>
                     <View className="bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/5">
                         {/* Placeholder for Profit/Loss until we have historical data */}
                         <Text className="text-emerald-300 text-xs font-bold">Live</Text>
                     </View>
                 </View>
                 
                 <View className="flex-row items-baseline mb-8">
                     <Text className="text-white text-4xl font-black mr-2">
                         ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                     </Text>
                 </View>

                 <View className="flex-row gap-4">
                     <Pressable 
                         onPress={() => handleAction('Deposit')}
                         className="flex-1 bg-white/10 p-4 rounded-3xl items-center border border-white/5 active:bg-white/20"
                     >
                         <View className="w-10 h-10 rounded-full items-center justify-center mb-2 bg-emerald-500/20">
                            <Ionicons name="arrow-down" color="#34d399" size={20} />
                         </View>
                         <Text className="text-white font-bold text-xs">Deposit</Text>
                     </Pressable>

                     <Pressable 
                         onPress={() => handleAction('Withdraw')}
                         className="flex-1 bg-white/10 p-4 rounded-3xl items-center border border-white/5 active:bg-white/20"
                     >
                         <View className="w-10 h-10 rounded-full items-center justify-center mb-2 bg-rose-500/20">
                            <Ionicons name="arrow-up" color="#fb7185" size={20} />
                         </View>
                         <Text className="text-white font-bold text-xs">Withdraw</Text>
                     </Pressable>

                     <Pressable 
                         onPress={() => handleAction('Transfer')}
                         className="flex-1 bg-white/10 p-4 rounded-3xl items-center border border-white/5 active:bg-white/20"
                     >
                         <View className="w-10 h-10 rounded-full items-center justify-center mb-2 bg-blue-500/20">
                            <Ionicons name="swap-horizontal" color="#60a5fa" size={20} />
                         </View>
                         <Text className="text-white font-bold text-xs">Transfer</Text>
                     </Pressable>
                 </View>
             </LinearGradient>

             {/* PORTFOLIO ANALYSIS (Visual Breakdown) - LIVE DATA */}
             {cryptoHoldings.length > 0 && (
                 <View className="mb-8">
                    <Text className="text-lg font-bold text-slate-800 mb-4 px-2">Portfolio Analysis</Text>
                    <View className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        {/* Visual Bar */}
                        <View className="flex-row h-4 w-full rounded-full overflow-hidden mb-4">
                            {top3.map((h, i) => (
                                <View key={h.symbol} style={{ width: `${(h.valueUsd / totalPortfolioValue) * 100}%` }} className={`h-full ${i===0 ? 'bg-yellow-500' : i===1 ? 'bg-blue-500' : 'bg-green-500'}`} />
                            ))}
                            {otherValue > 0 && <View style={{ width: `${(otherValue / totalPortfolioValue) * 100}%` }} className="h-full bg-slate-300" />}
                        </View>
                        
                        {/* Legend */}
                        <View className="flex-row justify-between flex-wrap gap-2">
                            {top3.map((h, i) => (
                                <View key={h.symbol} className="flex-row items-center gap-2">
                                    <View className={`w-2 h-2 rounded-full ${i===0 ? 'bg-yellow-500' : i===1 ? 'bg-blue-500' : 'bg-green-500'}`} />
                                    <Text className="text-xs font-bold text-slate-600">{h.symbol} {((h.valueUsd / totalPortfolioValue) * 100).toFixed(0)}%</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                 </View>
             )}

             {/* RECENT ACTIVITY - LIVE DATA */}
             <View className="mb-8">
                 <View className="flex-row justify-between items-center mb-4 px-2">
                    <Text className="text-lg font-bold text-slate-800">Recent Activity</Text>
                    {recentActivity.length > 0 && <Pressable><Text className="text-indigo-600 font-bold text-xs">See All</Text></Pressable>}
                 </View>
                 
                 {recentActivity.length > 0 ? (
                     <View className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                         {recentActivity.map((tx, i) => (
                             <View key={tx.id} className={`flex-row items-center justify-between p-4 ${i !== recentActivity.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                 <View className="flex-row items-center gap-3">
                                     <View className={`w-10 h-10 rounded-full items-center justify-center ${['deposit', 'crypto_deposit'].includes(tx.type) ? 'bg-green-50' : 'bg-red-50'}`}>
                                         <Ionicons name={['deposit', 'crypto_deposit'].includes(tx.type) ? "arrow-down" : "arrow-up"} size={18} color={['deposit', 'crypto_deposit'].includes(tx.type) ? "#16a34a" : "#dc2626"} />
                                     </View>
                                     <View>
                                         <Text className="font-bold text-slate-800 capitalize">{tx.type.replace('_', ' ')}</Text>
                                         <Text className="text-xs text-slate-400 font-semibold">{new Date(tx.created_at).toLocaleDateString()}</Text>
                                     </View>
                                 </View>
                                 <View className="items-end">
                                     <Text className={`font-bold ${['deposit', 'crypto_deposit'].includes(tx.type) ? 'text-green-600' : 'text-slate-800'}`}>
                                         {['deposit', 'crypto_deposit'].includes(tx.type) ? '+' : '-'}{tx.amount.toLocaleString()}
                                     </Text>
                                     <Text className="text-xs text-slate-400 font-bold capitalize">{tx.status}</Text>
                                 </View>
                             </View>
                         ))}
                     </View>
                 ) : (
                     <View className="bg-white p-8 rounded-3xl items-center border border-slate-100 shadow-sm">
                         <Text className="text-slate-400 font-bold">No recent transactions</Text>
                     </View>
                 )}
             </View>

             {/* ASSETS SECTION TABS */}
             <Text className="text-lg font-bold text-slate-800 mb-4 px-2">Your Assets</Text>
             
             {/* SIMPLIFIED TABS */}
             <View className="flex-row bg-slate-200 p-1 rounded-2xl mb-6 mx-1">
                 <TabButton title="Spot" section="spot" />
                 <TabButton title="Futures" section="futures" />
                 <TabButton title="Earn" section="earn" />
             </View>

             {/* Action Modal */}
             <Modal visible={actionModalVisible} transparent animationType="slide" onRequestClose={() => setActionModalVisible(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[40px] p-8 h-[60%]">
                        <View className="items-center mb-6">
                            <View className="w-16 h-1 bg-slate-200 rounded-full mb-6" />
                            <Text className="text-2xl font-black text-slate-800">{actionType}</Text>
                        </View>
                        
                        {actionType === 'Deposit' && (
                            <View className="items-center justify-center flex-1">
                                <View className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 mb-6">
                                    <Ionicons name="qr-code" size={150} color="#1e293b" />
                                </View>
                                <Text className="text-slate-500 font-bold text-center mb-2">Wallet Address (TRC20)</Text>
                                <View className="bg-slate-100 px-4 py-3 rounded-xl flex-row items-center gap-2">
                                    <Text className="text-slate-800 font-mono text-xs">T9xL...4zKj</Text>
                                    <TouchableOpacity onPress={() => { Clipboard.setString('T9xL...4zKj'); Alert.alert('Copied'); }}>
                                        <Ionicons name="copy-outline" size={16} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {actionType === 'Withdraw' && (
                             <View className="flex-1">
                                <Text className="text-slate-500 font-bold mb-2">Address</Text>
                                <TextInput className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 font-bold" placeholder="Paste address" />
                                <Text className="text-slate-500 font-bold mb-2">Amount</Text>
                                <TextInput className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 font-bold" placeholder="0.00" keyboardType="numeric" />
                                <TouchableOpacity className="bg-rose-500 py-4 rounded-2xl items-center shadow-lg shadow-rose-500/30 mt-auto">
                                    <Text className="text-white font-bold text-lg">Withdraw Funds</Text>
                                </TouchableOpacity>
                             </View>
                        )}

                        {actionType === 'Transfer' && (
                             <View className="flex-1">
                                <Text className="text-slate-500 font-bold mb-2">Recipient Email / ID</Text>
                                <TextInput className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 font-bold" placeholder="user@example.com" />
                                <Text className="text-slate-500 font-bold mb-2">Amount</Text>
                                <TextInput className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 font-bold" placeholder="0.00" keyboardType="numeric" />
                                <TouchableOpacity className="bg-blue-500 py-4 rounded-2xl items-center shadow-lg shadow-blue-500/30 mt-auto">
                                    <Text className="text-white font-bold text-lg">Transfer</Text>
                                </TouchableOpacity>
                             </View>
                        )}

                        <TouchableOpacity onPress={() => setActionModalVisible(false)} className="mt-4 p-4 items-center">
                            <Text className="text-slate-400 font-bold">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
             </Modal>

            {/* CONTENT SECTIONS */}
            {activeSection === 'spot' && (
                <View>
                     <View className="flex-row items-center justify-between bg-white p-5 rounded-3xl mb-3 shadow-sm border border-slate-100">
                         <View className="flex-row items-center gap-4">
                             <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center">
                                 <Text className="font-black text-green-700 text-lg">₦</Text>
                             </View>
                             <View>
                                 <Text className="text-slate-800 font-bold text-lg">Nigerian Naira</Text>
                                 <Text className="text-slate-400 text-xs font-bold">Fiat Currency</Text>
                             </View>
                         </View>
                         <View className="items-end">
                             <Text className="text-slate-800 font-bold text-lg">₦{balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                         </View>
                     </View>

                     {cryptoHoldings.length === 0 && (
                         <View className="items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-3xl mt-2">
                             <Ionicons name="wallet-outline" size={48} color="#cbd5e1" />
                             <Text className="text-slate-400 font-bold mt-2">No Crypto Assets Yet</Text>
                             <TouchableOpacity className="mt-4 bg-indigo-50 px-6 py-2 rounded-full">
                                 <Text className="text-indigo-600 font-bold text-xs">Start Trading</Text>
                             </TouchableOpacity>
                         </View>
                     )}
                </View>
            )}

            {activeSection === 'futures' && (
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <View className="flex-row justify-between mb-6">
                        <Text className="text-slate-800 font-bold">Open Positions</Text>
                        <TouchableOpacity><Text className="text-indigo-600 font-bold text-xs">History</Text></TouchableOpacity>
                    </View>
                    <View className="items-center py-8">
                         <Ionicons name="document-text-outline" size={40} color="#e2e8f0" />
                         <Text className="text-slate-400 font-bold text-xs mt-2">No Active Futures Positions</Text>
                         <Text className="text-slate-300 text-[10px] text-center mt-1 px-8">Open a Long or Short position in the Futures tab.</Text>
                    </View>
                </View>
            )}

            {activeSection === 'earn' && (
                <View>
                    <View className="bg-indigo-600 p-6 rounded-3xl shadow-sm mb-4 overflow-hidden relative">
                        <View className="absolute -right-4 -bottom-4 w-32 h-32 bg-white opacity-10 rounded-full" />
                        <Text className="text-white font-bold text-lg mb-1">Staking Rewards</Text>
                        <Text className="text-indigo-200 text-xs mb-4">Earn up to 12% APY on USDT</Text>
                        <TouchableOpacity className="bg-white py-3 rounded-xl items-center">
                            <Text className="text-indigo-600 font-bold">Start Staking</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>
    )
}
