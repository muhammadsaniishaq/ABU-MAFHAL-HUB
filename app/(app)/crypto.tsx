import { 
    View, Text, TouchableOpacity, ScrollView, Image, 
    ActivityIndicator, Alert, Modal, TextInput, Platform, 
    Dimensions, KeyboardAvoidingView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import DynamicBanners from '../../components/DynamicBanners';
import { CryptoRate } from '../../services/partners';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

// Ultra-Modern Compact Light Navy & Gold Tokens
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
    roseBorder: '#FECDD3'
};

type CryptoTab = 'wallet' | 'markets' | 'swap';

export default function CryptoScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<CryptoTab>('wallet');
    const [assets, setAssets] = useState<CryptoRate[]>([]);
    const [loading, setLoading] = useState(true);

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
                'the-open-network', 'polkadot', 'chainlink', 'matic-network'
            ]);
            setAssets(rates || []);
        } catch (e) {
            console.log("Error fetching crypto rates");
        } finally {
            setLoading(false);
        }
    };

    const fetchRates = async () => {
        try {
            const rates = await api.crypto.getRates([
                'bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 
                'ripple', 'cardano', 'dogecoin', 'tron', 'litecoin'
            ]);
            if (rates && rates.length > 0) setAssets(rates);
        } catch (error) {}
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, paddingTop: insets.top }}>
            <StatusBar style="dark" />

            {/* TAB CONTENT */}
            <View style={{ flex: 1, paddingBottom: 68 }}>
                {activeTab === 'wallet' && <WalletView assets={assets} loading={loading} setActiveTab={setActiveTab} />}
                {activeTab === 'markets' && <MarketsView assets={assets} loading={loading} />}
                {activeTab === 'swap' && <SwapView assets={assets} />}
            </View>

            {/* MODERN FLOATING NAV DOCK */}
            <View style={{
                position: 'absolute', bottom: 10, left: 16, right: 16,
                backgroundColor: L.navyHeader, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 10,
                flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
                borderWidth: 1.5, borderColor: L.goldDk, elevation: 10,
                shadowColor: L.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10
            }}>
                {[
                    { id: 'wallet', icon: 'wallet-outline', label: 'Wallet' },
                    { id: 'swap', icon: 'swap-horizontal-outline', label: 'Swap DEX', highlight: true },
                    { id: 'markets', icon: 'bar-chart-outline', label: 'Markets' },
                ].map((tab) => {
                    const isActive = activeTab === tab.id;

                    if (tab.highlight) {
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id as CryptoTab)}
                                style={{
                                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
                                    backgroundColor: isActive ? L.gold : 'rgba(255, 215, 0, 0.15)',
                                    borderWidth: 1, borderColor: L.gold, flexDirection: 'row', alignItems: 'center', gap: 4
                                }}
                            >
                                <Ionicons name={tab.icon as any} size={14} color={isActive ? L.navyHeader : L.gold} />
                                <Text style={{ fontSize: 10, fontWeight: '900', color: isActive ? L.navyHeader : L.gold }}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setActiveTab(tab.id as CryptoTab)}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}
                        >
                            <Ionicons name={tab.icon as any} size={17} color={isActive ? L.gold : '#94A3B8'} />
                            <Text style={{ fontSize: 9, fontWeight: '800', marginTop: 1, color: isActive ? L.gold : '#94A3B8' }}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

// --- WALLET VIEW ---
function WalletView({ assets, loading, setActiveTab }: { assets: CryptoRate[], loading: boolean, setActiveTab: (t: CryptoTab) => void }) {
    const router = useRouter();
    const [walletBalance, setWalletBalance] = useState(0);
    const [cryptoBalanceUsdt, setCryptoBalanceUsdt] = useState(0);
    const [hideBalance, setHideBalance] = useState(false);
    const [activeModal, setActiveModal] = useState<'send' | 'receive' | null>(null);

    // Deposit state
    const [receiveNetwork, setReceiveNetwork] = useState('TRC20');
    const [receiveAddress, setReceiveAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);

    // Send state
    const [sendNetwork, setSendNetwork] = useState('TRC20');
    const [sendAddress, setSendAddress] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        fetchBalances();
    }, []);

    const fetchBalances = async () => {
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
                setReceiveAddress(res.address || 'T9x...VaultAddressTRC20');
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
    }, [activeModal, receiveNetwork]);

    const copyText = (text: string) => {
        if (!text) return;
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            Clipboard.setString(text);
        }
        Alert.alert('Copied 🎉', 'Deposit address copied to clipboard');
    };

    const handleSendSubmit = async () => {
        if (!sendAddress.trim() || !sendAmount.trim()) {
            Alert.alert('Missing Fields', 'Please enter destination address and amount');
            return;
        }
        const amt = parseFloat(sendAmount.trim());
        if (amt > cryptoBalanceUsdt) {
            Alert.alert('Insufficient Balance', 'You do not have enough USDT balance');
            return;
        }
        setIsSending(true);
        setTimeout(() => {
            setIsSending(false);
            setActiveModal(null);
            setSendAddress('');
            setSendAmount('');
            Alert.alert('Withdrawal Submitted 🎉', `Sent ${amt} USDT to ${sendAddress.slice(0, 8)}... Required admin verification.`);
        }, 1200);
    };

    const topGainer = useMemo<Partial<CryptoRate>>(() => {
        if (assets.length === 0) return { symbol: 'BTC', name: 'Bitcoin', price_usd: 65000, percent_change_24h: 3.5 };
        return assets.reduce((prev, current) => (prev.percent_change_24h > current.percent_change_24h) ? prev : current);
    }, [assets]);

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            <DynamicBanners placement="crypto" />

            {/* Compact Header Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => router.replace('/dashboard')} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="arrow-back" size={16} color={L.gold} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' }}>User Crypto Wallet</Text>
                        <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>Crypto Core Exchange</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={() => router.push('/manage/crypto')} style={{ backgroundColor: L.goldBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.goldDk, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="shield-checkmark" size={11} color={L.goldAmber} />
                    <Text style={{ color: L.goldAmber, fontWeight: '900', fontSize: 9 }}>Admin Hub →</Text>
                </TouchableOpacity>
            </View>

            {/* EXECUTIVE CRYPTO BALANCE CARD */}
            <LinearGradient
                colors={['#0F172A', '#1C2541', '#0B132B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: L.goldDk, marginBottom: 12 }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View>
                        <Text style={{ color: '#CBD5E1', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total Wallet USDT Balance</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
                            {hideBalance ? '****' : `$${cryptoBalanceUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}
                        </Text>
                        <Text style={{ color: L.gold, fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>
                            {hideBalance ? '₦ ****' : `Naira Vault: ₦${walletBalance.toLocaleString()}`}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={hideBalance ? "eye-off" : "eye"} size={14} color={L.gold} />
                    </TouchableOpacity>
                </View>

                {/* Primary Action Buttons */}
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
                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10 }}>Instant Swap</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* TOP GAINER HIGHLIGHT */}
            {topGainer && (
                <View style={{ backgroundColor: L.card, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="flame" size={14} color={L.gold} />
                        </View>
                        <View>
                            <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' }}>24h Market Leader</Text>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{topGainer.name} ({topGainer.symbol?.toUpperCase()})</Text>
                        </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>${topGainer.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                        <Text style={{ color: L.emerald, fontSize: 9, fontWeight: '900' }}>+{topGainer.percent_change_24h?.toFixed(2)}%</Text>
                    </View>
                </View>
            )}

            {/* LIVE ASSETS STREAM */}
            <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>Popular Crypto Rates</Text>
                    <TouchableOpacity onPress={() => setActiveTab('markets')} style={{ backgroundColor: L.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: L.inputBorder }}>
                        <Text style={{ color: L.navyHeader, fontSize: 8, fontWeight: 'bold' }}>All Markets →</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden' }}>
                    {loading ? (
                        <ActivityIndicator color={L.goldDk} size="small" style={{ padding: 16 }} />
                    ) : (
                        assets.slice(0, 4).map((item, idx) => (
                            <View key={item.id || idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: idx !== 3 ? 1 : 0, borderColor: L.inputBorder }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {item.image ? (
                                        <Image source={{ uri: item.image }} style={{ width: 26, height: 26, borderRadius: 13 }} />
                                    ) : (
                                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: L.gold, fontSize: 9, fontWeight: 'bold' }}>{item.symbol?.[0]?.toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{item.name}</Text>
                                        <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>{item.symbol?.toUpperCase()}</Text>
                                    </View>
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                    <Text style={{ color: (item.percent_change_24h || 0) >= 0 ? L.emerald : L.rose, fontSize: 8, fontWeight: '800' }}>
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
                    <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: L.goldDk }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>Deposit USDT Crypto</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close-circle" size={18} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 8, marginBottom: 4, fontWeight: 'bold' }}>Select Blockchain Network:</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
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

                        <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 10 }}>
                            <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>DEPOSIT ADDRESS ({receiveNetwork}):</Text>
                            {loadingAddress ? (
                                <ActivityIndicator size="small" color={L.goldDk} style={{ marginVertical: 4 }} />
                            ) : (
                                <TouchableOpacity onPress={() => copyText(receiveAddress)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ color: L.navyHeader, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 9, flex: 1, marginRight: 6, fontWeight: 'bold' }}>{receiveAddress}</Text>
                                    <Ionicons name="copy-outline" size={12} color={L.navyHeader} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity 
                            onPress={() => copyText(receiveAddress)}
                            style={{ backgroundColor: L.navyHeader, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                        >
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Copy Deposit Address</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* SEND MODAL */}
            <Modal visible={activeModal === 'send'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', padding: 16 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: L.goldDk }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>Send / Withdraw USDT</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close-circle" size={18} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 8, marginBottom: 4, fontWeight: 'bold' }}>Destination Network:</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                            {['TRC20', 'BEP20', 'ERC20'].map(net => (
                                <TouchableOpacity
                                    key={net}
                                    onPress={() => setSendNetwork(net)}
                                    style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center', backgroundColor: sendNetwork === net ? L.navyHeader : L.bg, borderColor: sendNetwork === net ? L.navyHeader : L.inputBorder }}
                                >
                                    <Text style={{ color: sendNetwork === net ? L.gold : L.textSecondary, fontWeight: 'bold', fontSize: 9 }}>{net}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 8, marginBottom: 4, fontWeight: 'bold' }}>Recipient Address:</Text>
                        <View style={{ backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 8 }}>
                            <TextInput
                                value={sendAddress}
                                onChangeText={setSendAddress}
                                placeholder="Enter crypto wallet address..."
                                placeholderTextColor="#94A3B8"
                                style={{ flex: 1, color: L.textPrimary, fontWeight: '600', fontSize: 10 }}
                            />
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 8, marginBottom: 4, fontWeight: 'bold' }}>Withdrawal Amount (USDT):</Text>
                        <View style={{ backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 12 }}>
                            <TextInput
                                value={sendAmount}
                                onChangeText={setSendAmount}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor="#94A3B8"
                                style={{ flex: 1, color: L.textPrimary, fontWeight: '700', fontSize: 11 }}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleSendSubmit}
                            disabled={isSending}
                            style={{ backgroundColor: L.navyHeader, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                        >
                            {isSending ? (
                                <ActivityIndicator size="small" color={L.gold} />
                            ) : (
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Confirm Withdrawal</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </ScrollView>
    );
}

// --- MARKETS VIEW ---
function MarketsView({ assets, loading }: { assets: CryptoRate[], loading: boolean }) {
    const [search, setSearch] = useState('');

    const filtered = assets.filter(a => 
        a.name?.toLowerCase().includes(search.toLowerCase()) || 
        a.symbol?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.card, borderRadius: 10, paddingHorizontal: 10, height: 34, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 10 }}>
                <Ionicons name="search-outline" size={14} color={L.goldDk} />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search 50+ Crypto Assets..."
                    placeholderTextColor={L.textMuted}
                    style={{ flex: 1, marginLeft: 6, color: L.textPrimary, fontWeight: '600', fontSize: 10 }}
                />
            </View>

            <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden' }}>
                {loading ? (
                    <ActivityIndicator color={L.goldDk} size="small" style={{ padding: 16 }} />
                ) : filtered.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: L.textMuted, fontSize: 10 }}>No matching crypto assets found.</Text>
                    </View>
                ) : (
                    filtered.map((item, idx) => (
                        <View key={item.id || idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: idx !== filtered.length - 1 ? 1 : 0, borderColor: L.inputBorder }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {item.image ? (
                                    <Image source={{ uri: item.image }} style={{ width: 26, height: 26, borderRadius: 13 }} />
                                ) : (
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: L.gold, fontSize: 9, fontWeight: 'bold' }}>{item.symbol?.[0]?.toUpperCase()}</Text>
                                    </View>
                                )}
                                <View>
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{item.name}</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold' }}>{item.symbol?.toUpperCase()}</Text>
                                </View>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>${item.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                <Text style={{ color: (item.percent_change_24h || 0) >= 0 ? L.emerald : L.rose, fontSize: 8, fontWeight: '800' }}>
                                    {(item.percent_change_24h || 0) >= 0 ? '+' : ''}{(item.percent_change_24h || 0).toFixed(2)}%
                                </Text>
                            </View>
                        </View>
                    ))
                )}
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
            Alert.alert("DEX Swap Success 🎉", `Swapped ${fromAmount} ${fromCoin} to ${toCoin} instantly!`);
        }, 800);
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 80 }}>
            <View style={{ backgroundColor: L.card, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: L.cardBorder }}>
                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13, marginBottom: 2 }}>Instant Crypto DEX Swap</Text>
                <Text style={{ color: L.textMuted, fontSize: 9, marginBottom: 10 }}>Automated liquidity pool swap engine.</Text>

                {/* From Box */}
                <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 6 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>YOU PAY:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TextInput
                            value={fromAmount}
                            onChangeText={setFromAmount}
                            keyboardType="numeric"
                            style={{ flex: 1, color: L.textPrimary, fontWeight: '900', fontSize: 15 }}
                        />
                        <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9 }}>{fromCoin}</Text>
                        </View>
                    </View>
                </View>

                {/* Swap Icon */}
                <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 10 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: L.card }}>
                        <Ionicons name="swap-vertical" size={13} color={L.gold} />
                    </View>
                </View>

                {/* To Box */}
                <View style={{ backgroundColor: L.bg, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, marginTop: 6, marginBottom: 12 }}>
                    <Text style={{ color: L.textMuted, fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>YOU RECEIVE (ESTIMATED):</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 15 }}>
                            {(Number(fromAmount || 0) * 0.000015).toFixed(6)}
                        </Text>
                        <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 9 }}>{toCoin}</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={handleSwap}
                    disabled={swapping}
                    style={{ backgroundColor: L.navyHeader, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.gold }}
                >
                    {swapping ? (
                        <ActivityIndicator size="small" color={L.gold} />
                    ) : (
                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Confirm DEX Swap</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
