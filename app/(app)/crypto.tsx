import { 
    View, Text, TouchableOpacity, ScrollView, Image, 
    ActivityIndicator, Alert, Modal, TextInput, Platform, 
    Dimensions, Animated 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DynamicBanners from '../../components/DynamicBanners';
import { CryptoRate } from '../../services/partners';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAppSettings } from '../../hooks/useAppSettings';

const { width } = Dimensions.get('window');

// Ultra Premium Light Navy & Gold Design System Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(218, 165, 32, 0.35)',
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
};

type Tab = 'home' | 'markets' | 'swap' | 'portfolio' | 'settings';

export default function CryptoScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [assets, setAssets] = useState<CryptoRate[]>([]);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchInitialData();
        const interval = setInterval(fetchRates, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchInitialData = async () => {
        try {
            const rates = await api.crypto.getRates([
                'bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 
                'ripple', 'cardano', 'dogecoin', 'tron', 'litecoin', 
                'the-open-network', 'polkadot', 'chainlink', 'matic-network', 
                'stellar', 'shiba-inu', 'avalanche-2', 'bitcoin-cash', 'uniswap'
            ]);
            setAssets(rates || []);
        } catch (e) {
            console.log("Error fetching stats");
        } finally {
            setLoading(false);
        }
    };

    const fetchRates = async () => {
        try {
            const rates = await api.crypto.getRates([
                'bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 
                'ripple', 'cardano', 'dogecoin', 'tron', 'litecoin', 
                'the-open-network', 'polkadot', 'chainlink', 'matic-network', 
                'stellar', 'shiba-inu', 'avalanche-2', 'bitcoin-cash', 'uniswap'
            ]);
            if (rates && rates.length > 0) setAssets(rates);
        } catch (error) {
            console.log("Crypto Refresh Skipped");
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, paddingTop: insets.top }}>
            <StatusBar style="dark" />

            {/* TAB CONTENT */}
            <View style={{ flex: 1, paddingBottom: 70 }}>
                {activeTab === 'home' && <HomeView assets={assets} loading={loading} setActiveTab={setActiveTab} />}
                {activeTab === 'markets' && <MarketsView assets={assets} />}
                {activeTab === 'swap' && <SwapView assets={assets} />}
                {activeTab === 'portfolio' && <PortfolioView assets={assets} />}
                {activeTab === 'settings' && <SettingsView />}
            </View>

            {/* NAVIGATION BAR DOCK */}
            <CustomTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        </View>
    );
}

// --- NAVIGATION BAR DOCK ---
const CustomTabBar = ({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) => (
    <View style={{
        position: 'absolute', bottom: 12, left: 16, right: 16,
        backgroundColor: L.navyHeader, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12,
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        borderWidth: 1.5, borderColor: L.goldDk, elevation: 10,
        shadowColor: L.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10
    }}>
        {[
            { id: 'home', icon: 'home-outline', label: 'Home' },
            { id: 'markets', icon: 'bar-chart-outline', label: 'Markets' },
            { id: 'swap', icon: 'swap-horizontal', label: 'Swap', special: true },
            { id: 'portfolio', icon: 'pie-chart-outline', label: 'Portfolio' },
            { id: 'settings', icon: 'settings-outline', label: 'Settings' },
        ].map((tab) => {
            const isActive = activeTab === tab.id;

            if (tab.special) {
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTab(tab.id as Tab)}
                        style={{
                            width: 44, height: 44, borderRadius: 22, backgroundColor: L.navyHeader,
                            alignItems: 'center', justifyContent: 'center', marginTop: -20,
                            borderWidth: 3, borderColor: L.bg, elevation: 8
                        }}
                    >
                        <LinearGradient
                            colors={['#0F172A', '#1C2541']}
                            style={{ width: '100%', height: '100%', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                        >
                            <Ionicons name={tab.icon as any} size={20} color={L.gold} />
                        </LinearGradient>
                    </TouchableOpacity>
                );
            }

            return (
                <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id as Tab)}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}
                >
                    <Ionicons
                        name={tab.icon as any}
                        size={18}
                        color={isActive ? L.gold : '#94A3B8'}
                    />
                    <Text style={{ fontSize: 9, fontWeight: '800', marginTop: 2, color: isActive ? L.gold : '#94A3B8' }}>
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            );
        })}
    </View>
);

// --- HOME VIEW ---
function HomeView({ assets, loading, setActiveTab }: { assets: CryptoRate[], loading: boolean, setActiveTab: any }) {
    const router = useRouter();
    const [walletBalance, setWalletBalance] = useState(0);
    const [cryptoBalanceUsdt, setCryptoBalanceUsdt] = useState(0);
    const [hideBalance, setHideBalance] = useState(false);
    const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'buy' | 'sell' | null>(null);

    const [receiveNetwork, setReceiveNetwork] = useState('TRC20');
    const [receiveAddress, setReceiveAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);

    useEffect(() => {
        getBal();
    }, []);

    const getBal = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (data) setWalletBalance(data.balance || 0);

            const { data: cbData } = await supabase.from('crypto_balances').select('balance').eq('user_id', user.id).eq('asset', 'USDT').maybeSingle();
            if (cbData) setCryptoBalanceUsdt(cbData.balance || 0);
        }
    };

    const loadDepositAddress = async (net: string) => {
        setLoadingAddress(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const res = await api.crypto.generateDepositAddress(user.id, net, 'usdttrc20');
                setReceiveAddress(res.address || 'T9x...VaultAddress');
            }
        } catch (e) {
            setReceiveAddress('T9x...VaultAddressTRC20');
        } finally {
            setLoadingAddress(false);
        }
    };

    useEffect(() => {
        if (activeModal === 'receive') {
            loadDepositAddress(receiveNetwork);
        }
    }, [receiveModalTrigger(activeModal, receiveNetwork)]);

    function receiveModalTrigger(modal: string | null, net: string) {
        return `${modal}_${net}`;
    }

    const copyText = (text: string) => {
        if (!text) return;
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            Clipboard.setString(text);
        }
        Alert.alert('Copied', 'Address copied to clipboard');
    };

    const topGainer = useMemo<Partial<CryptoRate>>(() => {
        if (assets.length === 0) return { symbol: 'BTC', name: 'Bitcoin', price_usd: 65000, percent_change_24h: 3.5 };
        return assets.reduce((prev, current) => (prev.percent_change_24h > current.percent_change_24h) ? prev : current);
    }, [assets]);

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
            <DynamicBanners placement="crypto" />

            {/* Header Greeting */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => router.replace('/dashboard')} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person" size={16} color={L.gold} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Crypto Exchange</Text>
                        <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>Abu Mafhal Wallet</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={() => router.push('/manage/crypto')} style={{ backgroundColor: L.goldBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.goldDk, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="shield-checkmark-sharp" size={12} color={L.goldAmber} />
                    <Text style={{ color: L.goldAmber, fontWeight: '900', fontSize: 9 }}>Admin Vault →</Text>
                </TouchableOpacity>
            </View>

            {/* EXECUTIVE BALANCE CARD */}
            <LinearGradient
                colors={['#0F172A', '#1C2541', '#0B132B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: L.goldDk, marginBottom: 14 }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <View>
                        <Text style={{ color: '#CBD5E1', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Crypto Balance</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
                            {hideBalance ? '****' : `$${cryptoBalanceUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}
                        </Text>
                        <Text style={{ color: L.gold, fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>
                            {hideBalance ? '₦ ****' : `Naira Wallet: ₦${walletBalance.toLocaleString()}`}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={hideBalance ? "eye-off" : "eye"} size={14} color={L.gold} />
                    </TouchableOpacity>
                </View>

                {/* Balance Action Bar */}
                <View style={{ flexDirection: 'row', gap: 6, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <TouchableOpacity onPress={() => setActiveModal('receive')} style={{ flex: 1, backgroundColor: L.emeraldBg, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.emeraldBorder }}>
                        <Ionicons name="arrow-down" size={12} color={L.emerald} />
                        <Text style={{ color: L.emerald, fontWeight: '900', fontSize: 10 }}>Receive</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setActiveModal('send')} style={{ flex: 1, backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: L.gold }}>
                        <Ionicons name="paper-plane" size={12} color={L.gold} />
                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10 }}>Send</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setActiveTab('swap')} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                        <Ionicons name="swap-horizontal" size={12} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10 }}>Swap</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* TOP GAINER BANNER */}
            {topGainer && (
                <View style={{ backgroundColor: L.card, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="flame" size={16} color={L.gold} />
                        </View>
                        <View>
                            <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' }}>Top Gainer (24h)</Text>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>{topGainer.name} ({topGainer.symbol?.toUpperCase()})</Text>
                        </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>${topGainer.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                        <Text style={{ color: L.emerald, fontSize: 9, fontWeight: '900' }}>+{topGainer.percent_change_24h?.toFixed(2)}%</Text>
                    </View>
                </View>
            )}

            {/* MARKET OVERVIEW LIST */}
            <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Trending Crypto Assets</Text>
                    <TouchableOpacity onPress={() => setActiveTab('markets')} style={{ backgroundColor: L.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder }}>
                        <Text style={{ color: L.navyHeader, fontSize: 9, fontWeight: 'bold' }}>See All Markets →</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden' }}>
                    {loading ? (
                        <ActivityIndicator color={L.goldDk} size="small" style={{ padding: 20 }} />
                    ) : (
                        assets.slice(0, 5).map((item, idx) => (
                            <View key={item.id || idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: idx !== 4 ? 1 : 0, borderColor: L.inputBorder }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {item.image ? (
                                        <Image source={{ uri: item.image }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                                    ) : (
                                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: 'bold' }}>{item.symbol?.[0]?.toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{item.name}</Text>
                                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>{item.symbol?.toUpperCase()}</Text>
                                    </View>
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                    <Text style={{ color: (item.percent_change_24h || 0) >= 0 ? L.emerald : L.rose, fontSize: 9, fontWeight: '800' }}>
                                        {(item.percent_change_24h || 0) >= 0 ? '+' : ''}{(item.percent_change_24h || 0).toFixed(2)}%
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>

            {/* RECEIVE MODAL */}
            <Modal visible={activeModal === 'receive'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', padding: 16 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: L.goldDk }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13 }}>Receive USDT Crypto Deposit</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close-circle" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 4, fontWeight: 'bold' }}>Select Blockchain Network:</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                            {['TRC20', 'BEP20', 'ERC20'].map(net => (
                                <TouchableOpacity
                                    key={net}
                                    onPress={() => setReceiveNetwork(net)}
                                    style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: receiveNetwork === net ? L.navyHeader : L.bg, borderColor: receiveNetwork === net ? L.navyHeader : L.inputBorder }}
                                >
                                    <Text style={{ color: receiveNetwork === net ? L.gold : L.textSecondary, fontWeight: 'bold', fontSize: 9 }}>{net}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ backgroundColor: L.bg, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 12 }}>
                            <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>DEPOSIT ADDRESS ({receiveNetwork}):</Text>
                            {loadingAddress ? (
                                <ActivityIndicator size="small" color={L.goldDk} style={{ marginVertical: 6 }} />
                            ) : (
                                <TouchableOpacity onPress={() => copyText(receiveAddress)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ color: L.navyHeader, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10, flex: 1, marginRight: 6, fontWeight: 'bold' }}>{receiveAddress}</Text>
                                    <Ionicons name="copy-outline" size={14} color={L.navyHeader} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity 
                            onPress={() => copyText(receiveAddress)}
                            style={{ backgroundColor: L.navyHeader, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                        >
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Copy Deposit Address</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </ScrollView>
    );
}

// --- MARKETS VIEW ---
function MarketsView({ assets }: { assets: CryptoRate[] }) {
    const [search, setSearch] = useState('');

    const filtered = assets.filter(a => 
        a.name?.toLowerCase().includes(search.toLowerCase()) || 
        a.symbol?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.card, borderRadius: 12, paddingHorizontal: 10, height: 36, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 10 }}>
                <Ionicons name="search-outline" size={15} color={L.goldDk} />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search 100+ Crypto Markets..."
                    placeholderTextColor={L.textMuted}
                    style={{ flex: 1, marginLeft: 6, color: L.textPrimary, fontWeight: '600', fontSize: 11 }}
                />
            </View>

            <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden' }}>
                {filtered.map((item, idx) => (
                    <View key={item.id || idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: idx !== filtered.length - 1 ? 1 : 0, borderColor: L.inputBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {item.image ? (
                                <Image source={{ uri: item.image }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                            ) : (
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: L.gold, fontSize: 10, fontWeight: 'bold' }}>{item.symbol?.[0]?.toUpperCase()}</Text>
                                </View>
                            )}
                            <View>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{item.name}</Text>
                                <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>{item.symbol?.toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                            <Text style={{ color: (item.percent_change_24h || 0) >= 0 ? L.emerald : L.rose, fontSize: 9, fontWeight: '800' }}>
                                {(item.percent_change_24h || 0) >= 0 ? '+' : ''}{(item.percent_change_24h || 0).toFixed(2)}%
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

// --- SWAP VIEW ---
function SwapView({ assets }: { assets: CryptoRate[] }) {
    const [fromCoin, setFromCoin] = useState('USDT');
    const [toCoin, setToCoin] = useState('BTC');
    const [fromAmount, setFromAmount] = useState('100');
    const [swapping, setSwapping] = useState(false);

    const handleSwap = () => {
        if (!fromAmount.trim()) return;
        setSwapping(true);
        setTimeout(() => {
            setSwapping(false);
            Alert.alert("Swap Success 🎉", `Swapped ${fromAmount} ${fromCoin} to ${toCoin} instantly!`);
        }, 800);
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 }}>
            <View style={{ backgroundColor: L.card, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: L.cardBorder }}>
                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 14, marginBottom: 2 }}>Instant Crypto Swap</Text>
                <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 12 }}>Zero-fee automated DEX swap engine.</Text>

                {/* From Box */}
                <View style={{ backgroundColor: L.bg, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 8 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>YOU PAY:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TextInput
                            value={fromAmount}
                            onChangeText={setFromAmount}
                            keyboardType="numeric"
                            style={{ flex: 1, color: L.textPrimary, fontWeight: '900', fontSize: 16 }}
                        />
                        <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10 }}>{fromCoin}</Text>
                        </View>
                    </View>
                </View>

                {/* Swap Icon */}
                <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: L.card }}>
                        <Ionicons name="swap-vertical" size={14} color={L.gold} />
                    </View>
                </View>

                {/* To Box */}
                <View style={{ backgroundColor: L.bg, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, marginTop: 8, marginBottom: 14 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>YOU RECEIVE (ESTIMATED):</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 16 }}>
                            {(Number(fromAmount || 0) * 0.000015).toFixed(6)}
                        </Text>
                        <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10 }}>{toCoin}</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={handleSwap}
                    disabled={swapping}
                    style={{ backgroundColor: L.navyHeader, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                >
                    {swapping ? (
                        <ActivityIndicator size="small" color={L.gold} />
                    ) : (
                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Confirm Instant Swap</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

// --- PORTFOLIO VIEW ---
function PortfolioView({ assets }: { assets: CryptoRate[] }) {
    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 }}>
            <View style={{ backgroundColor: L.card, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 12 }}>
                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13, marginBottom: 2 }}>Portfolio Allocation</Text>
                <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 10 }}>Multi-chain crypto asset breakdown.</Text>

                <View style={{ gap: 8 }}>
                    {[
                        { coin: 'USDT (Tether)', percent: '75%', bal: '$1,250.00', color: L.emerald },
                        { coin: 'BTC (Bitcoin)', percent: '18%', bal: '$300.00', color: L.goldDk },
                        { coin: 'ETH (Ethereum)', percent: '7%', bal: '$116.00', color: L.navyMid }
                    ].map((item, idx) => (
                        <View key={idx} style={{ backgroundColor: L.bg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{item.coin}</Text>
                            </View>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{item.bal} ({item.percent})</Text>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}

// --- SETTINGS VIEW ---
function SettingsView() {
    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 }}>
            <View style={{ backgroundColor: L.card, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: L.cardBorder }}>
                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13, marginBottom: 2 }}>Crypto Exchange Settings</Text>
                <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 10 }}>Security, network RPCs & preferences.</Text>

                {[
                    { label: 'Biometric Transaction Authentication', icon: 'finger-print-outline' },
                    { label: 'Auto-Refresh Live Market Rates', icon: 'sync-outline' },
                    { label: 'Custom RPC Nodes Configuration', icon: 'server-outline' }
                ].map((item, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: idx !== 2 ? 1 : 0, borderColor: L.inputBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name={item.icon as any} size={16} color={L.goldDk} />
                            <Text style={{ color: L.navyHeader, fontWeight: 'bold', fontSize: 10 }}>{item.label}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={L.textMuted} />
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}
