import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Image, 
    ActivityIndicator, Alert, Modal, TextInput, Platform, 
    StyleSheet, RefreshControl, Share, KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';

import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { CryptoRate } from '../../services/partners';
import { useAppSettings } from '../../hooks/useAppSettings';
import DynamicBanners from '../../components/DynamicBanners';
import SecurityModal from '../../components/SecurityModal';
import { createAppNotification } from '../../services/notificationsHelper';

// ─── Theme Tokens (Clean, Calm Light Theme - Zero Noise) ────────────────────────
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    navyDark: '#0D1B3E',
    navyMid: '#142258',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
    gold: '#D97706',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#DC2626',
    roseBg: '#FEF2F2',
    roseBorder: '#FECACA',
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    white: '#FFFFFF',
    inputBg: '#F1F5F9',
};

// ─── Supported Assets & NOWPayments Network Mappings ───────────────────────────
interface AssetConfig {
    symbol: string;
    name: string;
    icon: string;
    defaultRateUsd: number;
    networks: { label: string; network: string; currency: string; minDeposit: string }[];
}

const SUPPORTED_ASSETS: AssetConfig[] = [
    {
        symbol: 'USDT',
        name: 'Tether USD',
        icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        defaultRateUsd: 1.00,
        networks: [
            { label: 'TRON (TRC20)', network: 'TRC20', currency: 'usdttrc20', minDeposit: '5 USDT' },
            { label: 'BNB Smart Chain (BEP20)', network: 'BEP20', currency: 'usdtbsc', minDeposit: '5 USDT' },
            { label: 'Ethereum (ERC20)', network: 'ERC20', currency: 'usdterc20', minDeposit: '20 USDT' },
            { label: 'Polygon (POL)', network: 'POLYGON', currency: 'usdtmatic', minDeposit: '5 USDT' },
            { label: 'Solana (SOL)', network: 'SOL', currency: 'usdtsol', minDeposit: '5 USDT' },
        ]
    },
    {
        symbol: 'BTC',
        name: 'Bitcoin',
        icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        defaultRateUsd: 87500,
        networks: [
            { label: 'Bitcoin Mainnet', network: 'BTC', currency: 'btc', minDeposit: '0.0002 BTC' }
        ]
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        defaultRateUsd: 3100,
        networks: [
            { label: 'Ethereum Mainnet (ERC20)', network: 'ERC20', currency: 'eth', minDeposit: '0.005 ETH' },
            { label: 'Arbitrum One', network: 'ARBITRUM', currency: 'etharb', minDeposit: '0.002 ETH' },
            { label: 'Base Network', network: 'BASE', currency: 'ethbase', minDeposit: '0.002 ETH' },
        ]
    },
    {
        symbol: 'SOL',
        name: 'Solana',
        icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        defaultRateUsd: 185,
        networks: [
            { label: 'Solana Mainnet', network: 'SOL', currency: 'sol', minDeposit: '0.05 SOL' }
        ]
    },
    {
        symbol: 'TRX',
        name: 'Tron',
        icon: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
        defaultRateUsd: 0.22,
        networks: [
            { label: 'TRON (TRC20)', network: 'TRX', currency: 'trx', minDeposit: '20 TRX' }
        ]
    },
    {
        symbol: 'BNB',
        name: 'BNB Chain',
        icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        defaultRateUsd: 620,
        networks: [
            { label: 'BNB Smart Chain (BEP20)', network: 'BEP20', currency: 'bnbbsc', minDeposit: '0.01 BNB' }
        ]
    },
    {
        symbol: 'TON',
        name: 'Toncoin',
        icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png',
        defaultRateUsd: 5.40,
        networks: [
            { label: 'The Open Network (TON)', network: 'TON', currency: 'ton', minDeposit: '1 TON' }
        ]
    },
    {
        symbol: 'DOGE',
        name: 'Dogecoin',
        icon: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
        defaultRateUsd: 0.16,
        networks: [
            { label: 'Dogecoin Network', network: 'DOGE', currency: 'doge', minDeposit: '15 DOGE' }
        ]
    }
];

// ─── Dual QR Code Component ────────────────────────────────────────────────────
function SafeQRCode({ value, size = 160 }: { value: string; size?: number }) {
    const [hasError, setHasError] = useState(false);
    const encoded = encodeURIComponent(value || 'https://nowpayments.io');
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encoded}&margin=2&color=0D1B3E`;

    if (hasError || Platform.OS === 'web') {
        return (
            <Image
                source={{ uri: fallbackUrl }}
                style={{ width: size, height: size, borderRadius: 12 }}
                resizeMode="contain"
            />
        );
    }

    try {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <QRCode
                    value={value || 'https://nowpayments.io'}
                    size={size}
                    color="#0D1B3E"
                    backgroundColor="#FFFFFF"
                    onError={() => setHasError(true)}
                />
            </View>
        );
    } catch {
        return (
            <Image
                source={{ uri: fallbackUrl }}
                style={{ width: size, height: size, borderRadius: 12 }}
                resizeMode="contain"
            />
        );
    }
}

export default function CryptoScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // ─── State ─────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'assets' | 'trade' | 'history'>('assets');
    const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'NGN'>('USD');
    const [assetsRates, setAssetsRates] = useState<CryptoRate[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // User Data & Balances
    const [userId, setUserId] = useState<string | null>(null);
    const [nairaBalance, setNairaBalance] = useState<number>(0);
    const [cryptoBalances, setCryptoBalances] = useState<Record<string, number>>({});
    const [hideBalance, setHideBalance] = useState<boolean>(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingTxns, setLoadingTxns] = useState(false);

    // Modals
    const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'buy' | 'sell' | 'txReceipt' | null>(null);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [securityAction, setSecurityAction] = useState<(() => void) | null>(null);
    const [securityDescription, setSecurityDescription] = useState<string>('');

    // Deposit State (Real NOWPayments API)
    const [depositAsset, setDepositAsset] = useState<string>('USDT');
    const [depositNetworkIdx, setDepositNetworkIdx] = useState<number>(0);
    const [depositAddress, setDepositAddress] = useState<string>('');
    const [depositLoading, setDepositLoading] = useState<boolean>(false);
    const [depositCopied, setDepositCopied] = useState<boolean>(false);

    // Withdraw State (Real NOWPayments Payout API)
    const [withdrawAsset, setWithdrawAsset] = useState<string>('USDT');
    const [withdrawNetworkIdx, setWithdrawNetworkIdx] = useState<number>(0);
    const [withdrawAddress, setWithdrawAddress] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [withdrawing, setWithdrawing] = useState<boolean>(false);

    // Buy State (Naira ➡️ Crypto via Edge Function)
    const [buyAsset, setBuyAsset] = useState<string>('USDT');
    const [buyNgnAmount, setBuyNgnAmount] = useState<string>('10000');
    const [buying, setBuying] = useState<boolean>(false);

    // Sell State (Crypto ➡️ Naira Cashout via Edge Function)
    const [sellAsset, setSellAsset] = useState<string>('USDT');
    const [sellCryptoAmount, setSellCryptoAmount] = useState<string>('10');
    const [selling, setSelling] = useState<boolean>(false);

    // DEX Swap State (Cross-Asset via Edge Function)
    const [swapFrom, setSwapFrom] = useState<string>('USDT');
    const [swapTo, setSwapTo] = useState<string>('BTC');
    const [swapAmount, setSwapAmount] = useState<string>('100');
    const [swapping, setSwapping] = useState<boolean>(false);

    // Selected Transaction for Receipt Modal
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    // ─── Lifecycle & Data Fetching ─────────────────────────────────────────────
    useEffect(() => {
        initUserData();
        fetchRates();
        const interval = setInterval(fetchRates, 30000);
        return () => clearInterval(interval);
    }, []);

    const initUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);

            await Promise.all([
                fetchUserBalances(user.id),
                fetchCryptoTransactions(user.id)
            ]);
        } catch (e) {
            console.warn('initUserData error:', e);
        }
    };

    const fetchUserBalances = async (uid: string) => {
        try {
            const { data: prof } = await supabase.from('profiles').select('balance').eq('id', uid).maybeSingle();
            if (prof && prof.balance !== undefined) {
                setNairaBalance(Number(prof.balance) || 0);
            }

            const { data: cBals } = await supabase.from('crypto_balances').select('asset, balance').eq('user_id', uid);
            if (cBals && Array.isArray(cBals)) {
                const map: Record<string, number> = {};
                cBals.forEach(b => {
                    if (b.asset) {
                        map[b.asset.toUpperCase()] = Number(b.balance) || 0;
                    }
                });
                setCryptoBalances(map);
            }
        } catch (e) {
            console.warn('fetchUserBalances error:', e);
        }
    };

    const fetchCryptoTransactions = async (uid: string) => {
        setLoadingTxns(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', uid)
                .like('type', 'crypto_%')
                .order('created_at', { ascending: false })
                .limit(30);

            if (!error && data) {
                setTransactions(data);
            }
        } catch (e) {
            console.warn('fetchCryptoTransactions error:', e);
        } finally {
            setLoadingTxns(false);
        }
    };

    const fetchRates = async () => {
        try {
            const rates = await api.crypto.getRates([
                'bitcoin', 'ethereum', 'tether', 'solana', 'binancecoin', 
                'ripple', 'cardano', 'dogecoin', 'tron', 'litecoin', 
                'the-open-network', 'matic-network'
            ]);
            if (rates && Array.isArray(rates) && rates.length > 0) {
                setAssetsRates(rates);
            }
        } catch (e) {
            console.warn('fetchRates error:', e);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (Platform.OS !== 'web') {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
        }
        if (userId) {
            await Promise.all([
                fetchUserBalances(userId),
                fetchCryptoTransactions(userId),
                fetchRates()
            ]);
        }
        setRefreshing(false);
    }, [userId]);

    // ─── Price Calculations ────────────────────────────────────────────────────
    const getAssetPriceUsd = useCallback((symbol: string): number => {
        const found = assetsRates.find(r => r.symbol?.toUpperCase() === symbol.toUpperCase());
        if (found && found.price_usd > 0) return found.price_usd;
        const config = SUPPORTED_ASSETS.find(a => a.symbol === symbol.toUpperCase());
        return config ? config.defaultRateUsd : 1.00;
    }, [assetsRates]);

    const getUsdtToNgnRate = useCallback((type: 'buy' | 'sell'): number => {
        if (type === 'buy') {
            return Number(settings?.crypto_rate_usdt_buy) || 1480;
        }
        return Number(settings?.crypto_rate_usdt_sell) || 1460;
    }, [settings]);

    const totalPortfolioUsd = useMemo(() => {
        let total = 0;
        SUPPORTED_ASSETS.forEach(asset => {
            const bal = cryptoBalances[asset.symbol] || 0;
            const price = getAssetPriceUsd(asset.symbol);
            total += bal * price;
        });
        return total;
    }, [cryptoBalances, getAssetPriceUsd]);

    const totalPortfolioNgn = useMemo(() => {
        return totalPortfolioUsd * getUsdtToNgnRate('sell');
    }, [totalPortfolioUsd, getUsdtToNgnRate]);

    // ─── Real NOWPayments Deposit Address Generation ───────────────────────────
    const loadNowPaymentsAddress = async (assetSym: string, netIndex: number) => {
        if (!userId) return;
        const assetObj = SUPPORTED_ASSETS.find(a => a.symbol === assetSym);
        if (!assetObj) return;
        const netObj = assetObj.networks[netIndex] || assetObj.networks[0];

        setDepositLoading(true);
        setDepositCopied(false);
        try {
            const res = await api.crypto.generateDepositAddress(userId, netObj.network, netObj.currency);
            if (res && res.address) {
                setDepositAddress(res.address);
            } else {
                throw new Error("No address returned by NOWPayments gateway");
            }
        } catch (err: any) {
            console.error("Deposit address error:", err);
            Alert.alert(
                "NOWPayments Gateway Notice", 
                err.message || "Failed to generate deposit address. Please verify network connectivity."
            );
        } finally {
            setDepositLoading(false);
        }
    };

    useEffect(() => {
        if (activeModal === 'deposit') {
            loadNowPaymentsAddress(depositAsset, depositNetworkIdx);
        }
    }, [activeModal, depositAsset, depositNetworkIdx]);

    const handleCopyAddress = async () => {
        if (!depositAddress) return;
        try {
            await Clipboard.setStringAsync(depositAddress);
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setDepositCopied(true);
            setTimeout(() => setDepositCopied(false), 2500);
        } catch {}
    };

    const handleShareAddress = async () => {
        if (!depositAddress) return;
        try {
            await Share.share({
                message: `My ${depositAsset} (${SUPPORTED_ASSETS.find(a => a.symbol === depositAsset)?.networks[depositNetworkIdx]?.label}) Address on ABU MAFHAL SUB:\n${depositAddress}`,
                title: `${depositAsset} Deposit Address`
            });
        } catch {}
    };

    // ─── Real NOWPayments Withdrawal Execution ─────────────────────────────────
    const initiateWithdrawal = () => {
        const amt = parseFloat(withdrawAmount.trim());
        if (!withdrawAddress.trim() || isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Input", "Please provide a valid recipient address and amount.");
            return;
        }

        const currentBal = cryptoBalances[withdrawAsset] || 0;
        if (amt > currentBal) {
            Alert.alert("Insufficient Balance", `You only have ${currentBal.toFixed(4)} ${withdrawAsset} available.`);
            return;
        }

        const assetObj = SUPPORTED_ASSETS.find(a => a.symbol === withdrawAsset);
        const netObj = assetObj?.networks[withdrawNetworkIdx] || assetObj?.networks[0];

        setSecurityDescription(`Authorize withdrawal of ${amt} ${withdrawAsset} to ${withdrawAddress.slice(0, 8)}... (${netObj?.label}) via NOWPayments`);
        setSecurityAction(() => () => executeWithdrawal(netObj?.network || 'TRC20', withdrawAddress.trim(), amt));
        setShowSecurityModal(true);
    };

    const executeWithdrawal = async (networkName: string, destAddr: string, amountNum: number) => {
        setWithdrawing(true);
        try {
            const res = await api.crypto.withdraw(networkName, destAddr, amountNum);
            if (res && res.success) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert(
                    "Withdrawal Dispatched 🚀", 
                    `Successfully dispatched payout of ${amountNum} ${withdrawAsset} to ${destAddr.slice(0, 10)}... Processing via NOWPayments gateway.`
                );
                setActiveModal(null);
                setWithdrawAddress('');
                setWithdrawAmount('');
                if (userId) {
                    await createAppNotification(
                        userId,
                        "Crypto Withdrawal Dispatched",
                        `Your withdrawal of ${amountNum} ${withdrawAsset} has been submitted to the blockchain via NOWPayments.`,
                        "crypto",
                        "high"
                    );
                    fetchUserBalances(userId);
                    fetchCryptoTransactions(userId);
                }
            } else {
                throw new Error(res?.message || "Withdrawal failed to process");
            }
        } catch (err: any) {
            Alert.alert("Withdrawal Failed", err.message || "Failed to execute payout. Please try again.");
        } finally {
            setWithdrawing(false);
        }
    };

    // ─── Real Buy Crypto (Naira ➡️ Crypto) ──────────────────────────────────────
    const handleBuySubmit = async () => {
        const costNgn = parseFloat(buyNgnAmount.trim());
        if (isNaN(costNgn) || costNgn < 1000) {
            Alert.alert("Minimum Purchase", "Minimum crypto purchase is ₦1,000.");
            return;
        }
        if (costNgn > nairaBalance) {
            Alert.alert("Insufficient Naira Balance", `Your Naira balance (₦${nairaBalance.toLocaleString()}) is insufficient.`);
            return;
        }

        const usdtRate = getUsdtToNgnRate('buy');
        const assetPriceUsd = getAssetPriceUsd(buyAsset);
        const amountUsdt = costNgn / usdtRate;
        const amountCrypto = amountUsdt / assetPriceUsd;

        setBuying(true);
        try {
            const res = await api.crypto.buy({
                asset: buyAsset,
                amountNgn: costNgn,
                amountCrypto: Number(amountCrypto.toFixed(8))
            });

            if (res && res.success) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert("Crypto Purchase Complete 🎉", `You bought ${amountCrypto.toFixed(6)} ${buyAsset} for ₦${costNgn.toLocaleString()}!`);
                setActiveModal(null);
                setBuyNgnAmount('10000');
                if (userId) {
                    await createAppNotification(
                        userId,
                        "Crypto Purchased Successfully",
                        `You have purchased ${amountCrypto.toFixed(6)} ${buyAsset} for ₦${costNgn.toLocaleString()}.`,
                        "crypto",
                        "normal"
                    );
                    fetchUserBalances(userId);
                    fetchCryptoTransactions(userId);
                }
            } else {
                throw new Error("Buy transaction failed");
            }
        } catch (err: any) {
            Alert.alert("Purchase Failed", err.message || "Could not complete crypto purchase");
        } finally {
            setBuying(false);
        }
    };

    // ─── Real Sell Crypto (Crypto ➡️ Naira Cashout) ─────────────────────────────
    const handleSellSubmit = async () => {
        const cryptoAmt = parseFloat(sellCryptoAmount.trim());
        const userBal = cryptoBalances[sellAsset] || 0;

        if (isNaN(cryptoAmt) || cryptoAmt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid crypto amount to sell.");
            return;
        }
        if (cryptoAmt > userBal) {
            Alert.alert("Insufficient Balance", `You only have ${userBal.toFixed(6)} ${sellAsset} available.`);
            return;
        }

        const usdtRate = getUsdtToNgnRate('sell');
        const assetPriceUsd = getAssetPriceUsd(sellAsset);
        const totalUsd = cryptoAmt * assetPriceUsd;
        const expectedNgn = Math.floor(totalUsd * usdtRate);

        setSelling(true);
        try {
            const res = await api.crypto.sell({
                asset: sellAsset,
                amountCrypto: cryptoAmt,
                expectedNgn: expectedNgn
            });

            if (res && res.success) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert("Crypto Sold Successfully 💰", `Sold ${cryptoAmt} ${sellAsset} for ₦${expectedNgn.toLocaleString()} credited to your Naira wallet!`);
                setActiveModal(null);
                setSellCryptoAmount('10');
                if (userId) {
                    await createAppNotification(
                        userId,
                        "Crypto Sold Instantly",
                        `Sold ${cryptoAmt} ${sellAsset} for ₦${expectedNgn.toLocaleString()} into your wallet.`,
                        "crypto",
                        "normal"
                    );
                    fetchUserBalances(userId);
                    fetchCryptoTransactions(userId);
                }
            } else {
                throw new Error("Sell transaction failed");
            }
        } catch (err: any) {
            Alert.alert("Sell Failed", err.message || "Could not complete sale");
        } finally {
            setSelling(false);
        }
    };

    // ─── Real DEX Swap ─────────────────────────────────────────────────────────
    const handleSwapSubmit = async () => {
        const inAmt = parseFloat(swapAmount.trim());
        const fromBal = cryptoBalances[swapFrom] || 0;

        if (isNaN(inAmt) || inAmt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid swap amount.");
            return;
        }
        if (inAmt > fromBal) {
            Alert.alert("Insufficient Balance", `Your balance of ${swapFrom} is only ${fromBal.toFixed(4)}.`);
            return;
        }
        if (swapFrom === swapTo) {
            Alert.alert("Same Asset", "Please choose two different crypto assets to swap.");
            return;
        }

        const fromPrice = getAssetPriceUsd(swapFrom);
        const toPrice = getAssetPriceUsd(swapTo);
        const outAmt = Number(((inAmt * fromPrice) / toPrice).toFixed(8));

        setSwapping(true);
        try {
            const res = await api.crypto.swap({
                fromAsset: swapFrom,
                toAsset: swapTo,
                amountIn: inAmt,
                expectedAmountOut: outAmt
            });

            if (res && res.success) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert("Swap Completed 🔄", `Swapped ${inAmt} ${swapFrom} for ${outAmt} ${swapTo} at live market rates!`);
                setSwapAmount('100');
                if (userId) {
                    fetchUserBalances(userId);
                    fetchCryptoTransactions(userId);
                }
            } else {
                throw new Error(res?.message || "Swap failed");
            }
        } catch (err: any) {
            Alert.alert("Swap Error", err.message || "Failed to execute swap.");
        } finally {
            setSwapping(false);
        }
    };

    const isWeb = Platform.OS === 'web';

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* CURVED ROYAL NAVY TOP HEADER */}
            <LinearGradient
                colors={[C.navyDark, C.navyMid]}
                style={[s.headerContainer, { paddingTop: Math.max(insets.top, 24) + 8 }, isWeb && s.webContainer]}
            >
                <View style={s.headerTopRow}>
                    <TouchableOpacity onPress={() => router.replace('/dashboard')} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color={C.white} />
                    </TouchableOpacity>
                    
                    <View style={s.headerTitleWrap}>
                        <Text style={s.headerTitle}>Crypto Hub</Text>
                        <View style={s.nowPaymentsBadge}>
                            <View style={s.greenLivePulse} />
                            <Text style={s.nowPaymentsBadgeText}>NOWPayments Live ⚡</Text>
                        </View>
                    </View>

                    <TouchableOpacity onPress={onRefresh} style={s.headerIconBtn} activeOpacity={0.7}>
                        <Ionicons name="reload" size={17} color={C.white} />
                    </TouchableOpacity>
                </View>

                {/* CLEAN TOTAL PORTFOLIO BALANCE CARD */}
                <View style={s.heroCard}>
                    <View style={s.heroTop}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.heroSub}>Total Crypto Valuation</Text>
                                {/* Currency Switch */}
                                <TouchableOpacity 
                                    onPress={() => setCurrencyDisplay(currencyDisplay === 'USD' ? 'NGN' : 'USD')}
                                    style={s.currencyTogglePill}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.currencyToggleText}>{currencyDisplay}</Text>
                                    <Ionicons name="swap-horizontal" size={10} color={C.gold} />
                                </TouchableOpacity>
                            </View>

                            <Text style={s.heroMainBalance}>
                                {hideBalance 
                                    ? '••••••••' 
                                    : currencyDisplay === 'USD' 
                                        ? `$${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                        : `₦${totalPortfolioNgn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                            </Text>

                            <Text style={s.heroNgnValue}>
                                {hideBalance 
                                    ? '≈ ••••••••' 
                                    : currencyDisplay === 'USD'
                                        ? `≈ ₦${totalPortfolioNgn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} NGN`
                                        : `≈ $${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={() => setHideBalance(!hideBalance)} 
                            style={s.eyeButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={hideBalance ? "eye-off" : "eye"} size={17} color={C.textSub} />
                        </TouchableOpacity>
                    </View>

                    <View style={s.fiatVaultRow}>
                        <Ionicons name="wallet-outline" size={13} color={C.gold} style={{ marginRight: 5 }} />
                        <Text style={s.fiatVaultText}>
                            Naira Wallet: <Text style={{ color: C.textMain, fontWeight: '800' }}>₦{nairaBalance.toLocaleString()}</Text>
                        </Text>
                    </View>

                    {/* 5 CLEAN CORE FINTECH ACTIONS */}
                    <View style={s.quickActionsRow}>
                        <TouchableOpacity 
                            onPress={() => setActiveModal('deposit')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}>
                                <Ionicons name="arrow-down" size={18} color={C.emerald} />
                            </View>
                            <Text style={s.actionText}>Deposit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('withdraw')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.goldBg, borderColor: '#FDE68A' }]}>
                                <Ionicons name="arrow-up" size={18} color={C.gold} />
                            </View>
                            <Text style={s.actionText}>Withdraw</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('buy')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.blueBg, borderColor: '#BFDBFE' }]}>
                                <Ionicons name="card-outline" size={18} color={C.blue} />
                            </View>
                            <Text style={s.actionText}>Buy</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('sell')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.purpleBg, borderColor: '#DDD6FE' }]}>
                                <Ionicons name="cash-outline" size={18} color={C.purple} />
                            </View>
                            <Text style={s.actionText}>Sell</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveTab('trade')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                                <Ionicons name="swap-horizontal" size={18} color={C.textMain} />
                            </View>
                            <Text style={s.actionText}>Swap</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            {/* CLEAN 3 TABS (Zero Clutter) */}
            <View style={[s.tabBarContainer, isWeb && s.webContainer]}>
                {[
                    { id: 'assets', label: 'Crypto Assets' },
                    { id: 'trade', label: 'Instant Swap' },
                    { id: 'history', label: 'History' },
                ].map(t => {
                    const isActive = activeTab === t.id;
                    return (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => {
                                if (Platform.OS !== 'web') {
                                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                                }
                                setActiveTab(t.id as any);
                            }}
                            style={[s.tabItem, isActive && s.tabItemActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.tabItemText, isActive && s.tabItemTextActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* MAIN CLEAN CONTENT AREA */}
            <ScrollView
                style={[s.mainScroll, isWeb && s.webContainer]}
                contentContainerStyle={s.mainScrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navyDark} />}
                showsVerticalScrollIndicator={false}
            >
                <DynamicBanners placement="crypto" />

                {/* ─── TAB 1: ASSETS LIST ──────────────────────────────────────── */}
                {activeTab === 'assets' && (
                    <View>
                        <View style={s.sectionHeaderRow}>
                            <Text style={s.sectionTitle}>Supported Coins</Text>
                            <Text style={s.sectionSub}>Tap any coin to deposit or send</Text>
                        </View>

                        <View style={s.assetCardsGrid}>
                            {SUPPORTED_ASSETS.map((asset) => {
                                const bal = cryptoBalances[asset.symbol] || 0;
                                const livePrice = getAssetPriceUsd(asset.symbol);
                                const valUsd = bal * livePrice;
                                const marketData = assetsRates.find(r => r.symbol?.toUpperCase() === asset.symbol);
                                const change24h = marketData?.percent_change_24h ?? 0;
                                const isPos = change24h >= 0;

                                return (
                                    <TouchableOpacity
                                        key={asset.symbol}
                                        style={s.assetCard}
                                        onPress={() => {
                                            setDepositAsset(asset.symbol);
                                            setDepositNetworkIdx(0);
                                            setActiveModal('deposit');
                                        }}
                                        activeOpacity={0.75}
                                    >
                                        <View style={s.assetCardLeft}>
                                            <Image source={{ uri: asset.icon }} style={s.assetLogo} />
                                            <View>
                                                <Text style={s.assetSymbol}>{asset.symbol}</Text>
                                                <Text style={s.assetName}>{asset.name}</Text>
                                            </View>
                                        </View>

                                        <View style={s.assetCardRight}>
                                            <Text style={s.assetBalanceText}>
                                                {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                            </Text>
                                            <View style={s.priceChangeRow}>
                                                <Text style={s.assetPriceText}>${livePrice.toLocaleString()}</Text>
                                                <View style={[s.percentPill, isPos ? s.percentPillPositive : s.percentPillNegative]}>
                                                    <Text style={[s.percentText, { color: isPos ? C.emerald : C.rose }]}>
                                                        {isPos ? '+' : ''}{change24h.toFixed(1)}%
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ─── TAB 2: INSTANT DEX SWAP ─────────────────────────────────── */}
                {activeTab === 'trade' && (
                    <View style={s.swapContainer}>
                        <View style={s.swapCard}>
                            <View style={s.swapHeader}>
                                <Text style={s.swapTitle}>Instant Crypto Swap</Text>
                                <View style={s.zeroFeeBadge}>
                                    <Text style={s.zeroFeeBadgeText}>0% Fee</Text>
                                </View>
                            </View>

                            <Text style={s.swapSubtitle}>
                                Swap directly between any supported crypto assets at live market prices.
                            </Text>

                            {/* "YOU PAY" BOX */}
                            <View style={s.swapInputBox}>
                                <View style={s.swapBoxHeader}>
                                    <Text style={s.swapBoxLabel}>YOU PAY</Text>
                                    <TouchableOpacity 
                                        onPress={() => setSwapAmount((cryptoBalances[swapFrom] || 0).toString())}
                                        style={s.maxPill}
                                    >
                                        <Text style={s.maxPillText}>
                                            MAX: {(cryptoBalances[swapFrom] || 0).toFixed(4)}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={s.swapInputRow}>
                                    <TextInput
                                        value={swapAmount}
                                        onChangeText={setSwapAmount}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                        placeholderTextColor={C.textMuted}
                                        style={s.swapAmountInput}
                                    />
                                    
                                    <View style={s.assetSelectorRow}>
                                        {['USDT', 'BTC', 'ETH', 'SOL'].map(sym => (
                                            <TouchableOpacity
                                                key={sym}
                                                onPress={() => setSwapFrom(sym)}
                                                style={[s.assetChip, swapFrom === sym && s.assetChipActive]}
                                            >
                                                <Text style={[s.assetChipText, swapFrom === sym && s.assetChipTextActive]}>
                                                    {sym}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* FLIP PAIR BUTTON */}
                            <View style={s.flipRow}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        const prevFrom = swapFrom;
                                        setSwapFrom(swapTo);
                                        setSwapTo(prevFrom);
                                    }}
                                    style={s.flipButton}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="swap-vertical" size={16} color={C.navyDark} />
                                </TouchableOpacity>
                            </View>

                            {/* "YOU RECEIVE" BOX */}
                            <View style={s.swapInputBox}>
                                <View style={s.swapBoxHeader}>
                                    <Text style={s.swapBoxLabel}>YOU RECEIVE (ESTIMATED)</Text>
                                    <Text style={s.liveRateQuoteText}>
                                        1 {swapFrom} ≈ {((getAssetPriceUsd(swapFrom) / getAssetPriceUsd(swapTo))).toFixed(6)} {swapTo}
                                    </Text>
                                </View>

                                <View style={s.swapInputRow}>
                                    <Text style={s.swapCalculatedOutput}>
                                        {((parseFloat(swapAmount || '0') * getAssetPriceUsd(swapFrom)) / getAssetPriceUsd(swapTo)).toFixed(6)}
                                    </Text>
                                    
                                    <View style={s.assetSelectorRow}>
                                        {['BTC', 'ETH', 'USDT', 'SOL'].map(sym => (
                                            <TouchableOpacity
                                                key={sym}
                                                onPress={() => setSwapTo(sym)}
                                                style={[s.assetChip, swapTo === sym && s.assetChipActive]}
                                            >
                                                <Text style={[s.assetChipText, swapTo === sym && s.assetChipTextActive]}>
                                                    {sym}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* EXECUTE SWAP BUTTON */}
                            <TouchableOpacity
                                onPress={handleSwapSubmit}
                                disabled={swapping}
                                style={s.swapSubmitButton}
                                activeOpacity={0.85}
                            >
                                {swapping ? (
                                    <ActivityIndicator color={C.white} size="small" />
                                ) : (
                                    <Text style={s.swapSubmitText}>Execute Swap</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ─── TAB 3: TRANSACTION HISTORY ─────────────────────────────── */}
                {activeTab === 'history' && (
                    <View>
                        <View style={s.sectionHeaderRow}>
                            <Text style={s.sectionTitle}>Transactions</Text>
                            <Text style={s.sectionSub}>Tap to view official blockchain receipt</Text>
                        </View>

                        {loadingTxns ? (
                            <ActivityIndicator color={C.navyDark} size="small" style={{ padding: 24 }} />
                        ) : transactions.length === 0 ? (
                            <View style={s.emptyHistoryCard}>
                                <Ionicons name="receipt-outline" size={36} color={C.textMuted} />
                                <Text style={s.emptyHistoryTitle}>No Crypto Transactions Yet</Text>
                                <Text style={s.emptyHistorySub}>
                                    Your deposits, withdrawals, swaps, and buys will appear here with live blockchain verification.
                                </Text>
                            </View>
                        ) : (
                            <View style={s.historyListCard}>
                                {transactions.map((tx, idx) => {
                                    const isLast = idx === transactions.length - 1;
                                    const isSuccess = tx.status === 'success' || tx.status === 'finished' || tx.status === 'confirmed';
                                    const isPending = tx.status === 'pending' || tx.status === 'waiting';

                                    let iconName = 'swap-horizontal';
                                    let iconColor = C.navyDark;
                                    if (tx.type === 'crypto_deposit') {
                                        iconName = 'arrow-down-circle';
                                        iconColor = C.emerald;
                                    } else if (tx.type === 'crypto_withdrawal') {
                                        iconName = 'arrow-up-circle';
                                        iconColor = C.gold;
                                    } else if (tx.type === 'crypto_buy') {
                                        iconName = 'card';
                                        iconColor = C.blue;
                                    } else if (tx.type === 'crypto_sell') {
                                        iconName = 'cash';
                                        iconColor = C.purple;
                                    }

                                    return (
                                        <TouchableOpacity 
                                            key={tx.id || idx} 
                                            style={[s.historyRow, !isLast && s.historyRowBorder]}
                                            onPress={() => {
                                                setSelectedTx(tx);
                                                setActiveModal('txReceipt');
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={s.historyIconWrapper}>
                                                <Ionicons name={iconName as any} size={18} color={iconColor} />
                                            </View>
                                            <View style={{ flex: 1, paddingHorizontal: 10 }}>
                                                <Text style={s.historyTypeTitle}>
                                                    {tx.type ? tx.type.replace('_', ' ').toUpperCase() : 'TRANSACTION'}
                                                </Text>
                                                <Text style={s.historyDate}>
                                                    {tx.created_at ? new Date(tx.created_at).toLocaleString() : ''}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={s.historyAmountText}>
                                                    ₦{Number(tx.amount || 0).toLocaleString()}
                                                </Text>
                                                <View style={[
                                                    s.statusPill, 
                                                    isSuccess && s.statusPillSuccess,
                                                    isPending && s.statusPillPending,
                                                    !isSuccess && !isPending && s.statusPillFailed
                                                ]}>
                                                    <Text style={[
                                                        s.statusPillText,
                                                        isSuccess && { color: C.emerald },
                                                        isPending && { color: C.gold },
                                                        !isSuccess && !isPending && { color: C.rose }
                                                    ]}>
                                                        {tx.status?.toUpperCase() || 'SUCCESS'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 1: DEPOSIT / RECEIVE VIA NOWPAYMENTS
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'deposit'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Deposit Crypto</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Asset Selection */}
                            <Text style={s.fieldLabel}>SELECT COIN:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.assetSelectorScroll}>
                                {SUPPORTED_ASSETS.map(asset => (
                                    <TouchableOpacity
                                        key={asset.symbol}
                                        onPress={() => {
                                            setDepositAsset(asset.symbol);
                                            setDepositNetworkIdx(0);
                                        }}
                                        style={[s.modalAssetChip, depositAsset === asset.symbol && s.modalAssetChipActive]}
                                    >
                                        <Image source={{ uri: asset.icon }} style={s.modalAssetIcon} />
                                        <Text style={[s.modalAssetText, depositAsset === asset.symbol && s.modalAssetTextActive]}>
                                            {asset.symbol}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Network Selection */}
                            <Text style={s.fieldLabel}>NETWORK:</Text>
                            <View style={s.networkOptionsRow}>
                                {SUPPORTED_ASSETS.find(a => a.symbol === depositAsset)?.networks.map((net, i) => (
                                    <TouchableOpacity
                                        key={net.network}
                                        onPress={() => setDepositNetworkIdx(i)}
                                        style={[s.networkChip, depositNetworkIdx === i && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, depositNetworkIdx === i && s.networkChipTextActive]}>
                                            {net.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* QR CODE CONTAINER */}
                            <View style={s.qrBox}>
                                {depositLoading ? (
                                    <View style={s.qrLoadingBox}>
                                        <ActivityIndicator size="large" color={C.navyDark} />
                                        <Text style={s.qrLoadingText}>Generating address from NOWPayments...</Text>
                                    </View>
                                ) : (
                                    <View style={s.qrInner}>
                                        <SafeQRCode value={depositAddress} size={150} />
                                        <Text style={s.qrScanPrompt}>Scan to send {depositAsset}</Text>
                                    </View>
                                )}
                            </View>

                            {/* DEPOSIT ADDRESS BOX */}
                            <Text style={s.fieldLabel}>WALLET ADDRESS:</Text>
                            <TouchableOpacity 
                                onPress={handleCopyAddress} 
                                style={s.addressCopyBox}
                                activeOpacity={0.8}
                            >
                                <Text style={s.addressText} numberOfLines={2}>
                                    {depositAddress || 'Generating...'}
                                </Text>
                                <View style={[s.copyMiniButton, depositCopied && s.copyMiniButtonActive]}>
                                    <Ionicons 
                                        name={depositCopied ? "checkmark-circle" : "copy-outline"} 
                                        size={14} 
                                        color={depositCopied ? C.emerald : C.navyDark} 
                                    />
                                    <Text style={[s.copyMiniButtonText, depositCopied && { color: C.emerald }]}>
                                        {depositCopied ? 'Copied' : 'Copy'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={s.depositWarning}>
                                <Text style={s.depositWarningText}>
                                    Send only {depositAsset} via {SUPPORTED_ASSETS.find(a => a.symbol === depositAsset)?.networks[depositNetworkIdx]?.label}. 
                                    Credits automatically after 1 blockchain confirmation via NOWPayments IPN.
                                </Text>
                            </View>

                            <View style={s.modalButtonsRow}>
                                <TouchableOpacity 
                                    onPress={handleShareAddress} 
                                    style={s.shareAddressBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="share-social-outline" size={16} color={C.textMain} style={{ marginRight: 6 }} />
                                    <Text style={s.shareAddressBtnText}>Share</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setActiveModal(null)} 
                                    style={s.doneBtn}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.doneBtnText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 2: WITHDRAW / SEND VIA NOWPAYMENTS PAYOUT
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'withdraw'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Withdraw Crypto</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Asset Selection */}
                            <Text style={s.fieldLabel}>SELECT COIN:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.assetSelectorScroll}>
                                {SUPPORTED_ASSETS.map(asset => (
                                    <TouchableOpacity
                                        key={asset.symbol}
                                        onPress={() => {
                                            setWithdrawAsset(asset.symbol);
                                            setWithdrawNetworkIdx(0);
                                        }}
                                        style={[s.modalAssetChip, withdrawAsset === asset.symbol && s.modalAssetChipActive]}
                                    >
                                        <Image source={{ uri: asset.icon }} style={s.modalAssetIcon} />
                                        <Text style={[s.modalAssetText, withdrawAsset === asset.symbol && s.modalAssetTextActive]}>
                                            {asset.symbol}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Network Selection */}
                            <Text style={s.fieldLabel}>DESTINATION NETWORK:</Text>
                            <View style={s.networkOptionsRow}>
                                {SUPPORTED_ASSETS.find(a => a.symbol === withdrawAsset)?.networks.map((net, i) => (
                                    <TouchableOpacity
                                        key={net.network}
                                        onPress={() => setWithdrawNetworkIdx(i)}
                                        style={[s.networkChip, withdrawNetworkIdx === i && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, withdrawNetworkIdx === i && s.networkChipTextActive]}>
                                            {net.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Recipient Address */}
                            <Text style={s.fieldLabel}>RECIPIENT ADDRESS:</Text>
                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={withdrawAddress}
                                    onChangeText={setWithdrawAddress}
                                    placeholder="Paste destination wallet address..."
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <TouchableOpacity 
                                    onPress={async () => {
                                        const clip = await Clipboard.getStringAsync();
                                        if (clip) setWithdrawAddress(clip.trim());
                                    }}
                                    style={s.pastePill}
                                >
                                    <Text style={s.pastePillText}>Paste</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Amount Input */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                                <Text style={s.fieldLabel}>AMOUNT ({withdrawAsset}):</Text>
                                <TouchableOpacity 
                                    onPress={() => setWithdrawAmount((cryptoBalances[withdrawAsset] || 0).toString())}
                                    style={s.maxPill}
                                >
                                    <Text style={s.maxPillText}>MAX: {(cryptoBalances[withdrawAsset] || 0).toFixed(4)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={withdrawAmount}
                                    onChangeText={setWithdrawAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>{withdrawAsset}</Text>
                            </View>

                            {/* Valuation breakdown */}
                            <View style={s.withdrawEstimateBox}>
                                <View style={s.withdrawEstimateRow}>
                                    <Text style={s.withdrawEstimateLabel}>Estimated USD Value</Text>
                                    <Text style={s.withdrawEstimateValue}>
                                        ≈ ${(parseFloat(withdrawAmount || '0') * getAssetPriceUsd(withdrawAsset)).toFixed(2)} USD
                                    </Text>
                                </View>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={initiateWithdrawal}
                                disabled={withdrawing}
                                style={s.primaryModalSubmit}
                                activeOpacity={0.85}
                            >
                                {withdrawing ? (
                                    <ActivityIndicator color={C.white} size="small" />
                                ) : (
                                    <Text style={s.primaryModalText}>Confirm & Send</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 3: BUY CRYPTO WITH NAIRA WALLET
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'buy'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Buy Crypto with Naira</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={s.fiatBalanceCard}>
                                <Text style={s.fiatBalanceLabel}>Naira Wallet Balance:</Text>
                                <Text style={s.fiatBalanceAmount}>₦{nairaBalance.toLocaleString()}</Text>
                            </View>

                            <Text style={s.fieldLabel}>CHOOSE CRYPTO TO BUY:</Text>
                            <View style={s.networkOptionsRow}>
                                {['USDT', 'BTC', 'ETH', 'SOL'].map(sym => (
                                    <TouchableOpacity
                                        key={sym}
                                        onPress={() => setBuyAsset(sym)}
                                        style={[s.networkChip, buyAsset === sym && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, buyAsset === sym && s.networkChipTextActive]}>
                                            {sym}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={s.fieldLabel}>AMOUNT (₦):</Text>
                            <View style={s.modalInputWrap}>
                                <Text style={s.nairaPrefix}>₦</Text>
                                <TextInput
                                    value={buyNgnAmount}
                                    onChangeText={setBuyNgnAmount}
                                    keyboardType="numeric"
                                    placeholder="10,000"
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                            </View>

                            <View style={s.tradeSummaryBox}>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Live Rate</Text>
                                    <Text style={s.tradeSummaryValue}>1 USDT ≈ ₦{getUsdtToNgnRate('buy')}</Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>You Receive</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.emerald, fontWeight: '800' }]}>
                                        {((parseFloat(buyNgnAmount || '0') / getUsdtToNgnRate('buy')) / getAssetPriceUsd(buyAsset)).toFixed(6)} {buyAsset}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleBuySubmit}
                                disabled={buying}
                                style={s.primaryModalSubmit}
                                activeOpacity={0.85}
                            >
                                {buying ? (
                                    <ActivityIndicator color={C.white} size="small" />
                                ) : (
                                    <Text style={s.primaryModalText}>Confirm Purchase</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 4: SELL CRYPTO TO NAIRA WALLET
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'sell'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Sell Crypto to Naira</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={s.fieldLabel}>CHOOSE CRYPTO TO SELL:</Text>
                            <View style={s.networkOptionsRow}>
                                {['USDT', 'BTC', 'ETH', 'SOL'].map(sym => (
                                    <TouchableOpacity
                                        key={sym}
                                        onPress={() => setSellAsset(sym)}
                                        style={[s.networkChip, sellAsset === sym && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, sellAsset === sym && s.networkChipTextActive]}>
                                            {sym}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                                <Text style={s.fieldLabel}>AMOUNT OF {sellAsset}:</Text>
                                <TouchableOpacity 
                                    onPress={() => setSellCryptoAmount((cryptoBalances[sellAsset] || 0).toString())}
                                    style={s.maxPill}
                                >
                                    <Text style={s.maxPillText}>MAX: {(cryptoBalances[sellAsset] || 0).toFixed(4)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={sellCryptoAmount}
                                    onChangeText={setSellCryptoAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>{sellAsset}</Text>
                            </View>

                            <View style={s.tradeSummaryBox}>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Live Cashout Rate</Text>
                                    <Text style={s.tradeSummaryValue}>1 USDT ≈ ₦{getUsdtToNgnRate('sell')}</Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Credited to Naira Wallet</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.emerald, fontWeight: '800' }]}>
                                        ₦{Math.floor((parseFloat(sellCryptoAmount || '0') * getAssetPriceUsd(sellAsset)) * getUsdtToNgnRate('sell')).toLocaleString()} NGN
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleSellSubmit}
                                disabled={selling}
                                style={s.primaryModalSubmit}
                                activeOpacity={0.85}
                            >
                                {selling ? (
                                    <ActivityIndicator color={C.white} size="small" />
                                ) : (
                                    <Text style={s.primaryModalText}>Confirm & Sell</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 5: OFFICIAL RECEIPT
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'txReceipt'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Transaction Receipt</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        {selectedTx ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={s.receiptHeaderBadge}>
                                    <Ionicons name="checkmark-circle" size={32} color={C.emerald} />
                                    <Text style={s.receiptMainAmount}>₦{Number(selectedTx.amount || 0).toLocaleString()}</Text>
                                    <Text style={s.receiptType}>{selectedTx.type?.replace('_', ' ').toUpperCase()}</Text>
                                </View>

                                <View style={s.receiptDetailsTable}>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptRowLabel}>Reference ID</Text>
                                        <Text style={s.receiptRowVal} numberOfLines={1}>{selectedTx.reference || selectedTx.id}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptRowLabel}>Description</Text>
                                        <Text style={s.receiptRowVal} numberOfLines={2}>{selectedTx.description || 'Crypto Transaction'}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptRowLabel}>Date</Text>
                                        <Text style={s.receiptRowVal}>{selectedTx.created_at ? new Date(selectedTx.created_at).toLocaleString() : '-'}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptRowLabel}>Status</Text>
                                        <Text style={[s.receiptRowVal, { color: C.emerald }]}>{selectedTx.status?.toUpperCase() || 'SUCCESS'}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    onPress={() => setActiveModal(null)} 
                                    style={s.primaryModalSubmit}
                                >
                                    <Text style={s.primaryModalText}>Close</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* SECURITY CONFIRMATION MODAL */}
            <SecurityModal
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                    setShowSecurityModal(false);
                    if (securityAction) securityAction();
                }}
                title="Authorize Crypto Payout"
                description={securityDescription}
                requiredFor="crypto"
            />
        </View>
    );
}

// ─── 100% Native Clean Light Theme StyleSheet (Zero CSS Failure on Play Store) ─
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    webContainer: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 720,
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
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
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleWrap: {
        alignItems: 'center',
    },
    headerTitle: {
        color: C.white,
        fontSize: 17,
        fontWeight: '800',
    },
    nowPaymentsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 2,
    },
    greenLivePulse: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#34D399',
        marginRight: 4,
    },
    nowPaymentsBadgeText: {
        color: C.white,
        fontSize: 8.5,
        fontWeight: '700',
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        backgroundColor: C.card,
        borderRadius: 20,
        padding: 16,
        marginTop: 4,
        borderWidth: 1,
        borderColor: C.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    heroSub: {
        color: C.textSub,
        fontSize: 10.5,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    currencyTogglePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.goldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    currencyToggleText: {
        color: C.gold,
        fontSize: 9,
        fontWeight: '800',
    },
    heroMainBalance: {
        color: C.textMain,
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 3,
    },
    heroNgnValue: {
        color: C.textSub,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 1,
    },
    eyeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fiatVaultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.inputBg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        marginTop: 12,
    },
    fiatVaultText: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '600',
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: C.borderSubtle,
    },
    actionButton: {
        flex: 1,
        alignItems: 'center',
    },
    actionIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
        borderWidth: 1,
    },
    actionText: {
        color: C.textMain,
        fontSize: 10,
        fontWeight: '700',
    },
    tabBarContainer: {
        flexDirection: 'row',
        backgroundColor: C.card,
        marginHorizontal: 14,
        marginTop: 12,
        marginBottom: 8,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
    },
    tabItemActive: {
        backgroundColor: C.navyDark,
    },
    tabItemText: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '700',
    },
    tabItemTextActive: {
        color: C.white,
        fontWeight: '800',
    },
    mainScroll: {
        flex: 1,
    },
    mainScrollContent: {
        paddingHorizontal: 14,
        paddingBottom: 40,
    },
    sectionHeaderRow: {
        marginVertical: 10,
    },
    sectionTitle: {
        color: C.textMain,
        fontSize: 14,
        fontWeight: '800',
    },
    sectionSub: {
        color: C.textSub,
        fontSize: 11,
        marginTop: 1,
    },
    assetCardsGrid: {
        gap: 8,
    },
    assetCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    assetCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    assetLogo: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    assetSymbol: {
        color: C.textMain,
        fontSize: 14,
        fontWeight: '800',
    },
    assetName: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '500',
    },
    assetCardRight: {
        alignItems: 'flex-end',
    },
    assetBalanceText: {
        color: C.textMain,
        fontSize: 14,
        fontWeight: '800',
    },
    priceChangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    assetPriceText: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '600',
    },
    percentPill: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    percentPillPositive: {
        backgroundColor: C.emeraldBg,
    },
    percentPillNegative: {
        backgroundColor: C.roseBg,
    },
    percentText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    // Swap Tab Styles
    swapContainer: {
        marginTop: 6,
    },
    swapCard: {
        backgroundColor: C.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    swapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    swapTitle: {
        color: C.textMain,
        fontSize: 15,
        fontWeight: '800',
    },
    zeroFeeBadge: {
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    zeroFeeBadgeText: {
        color: C.emerald,
        fontSize: 10,
        fontWeight: '800',
    },
    swapSubtitle: {
        color: C.textSub,
        fontSize: 11,
        marginBottom: 14,
    },
    swapInputBox: {
        backgroundColor: C.inputBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    swapBoxHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    swapBoxLabel: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    maxPill: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
    },
    maxPillText: {
        color: C.textMain,
        fontSize: 9.5,
        fontWeight: '700',
    },
    swapInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    swapAmountInput: {
        flex: 1,
        color: C.textMain,
        fontSize: 18,
        fontWeight: '800',
        marginRight: 10,
    },
    swapCalculatedOutput: {
        flex: 1,
        color: C.textMain,
        fontSize: 18,
        fontWeight: '800',
        marginRight: 10,
    },
    liveRateQuoteText: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '600',
    },
    assetSelectorRow: {
        flexDirection: 'row',
        gap: 4,
    },
    assetChip: {
        backgroundColor: C.white,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    assetChipActive: {
        backgroundColor: C.navyDark,
        borderColor: C.navyDark,
    },
    assetChipText: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
    },
    assetChipTextActive: {
        color: C.white,
    },
    flipRow: {
        alignItems: 'center',
        marginVertical: -8,
        zIndex: 10,
    },
    flipButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.white,
        borderWidth: 1.5,
        borderColor: C.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    swapSubmitButton: {
        backgroundColor: C.navyDark,
        borderRadius: 12,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
    },
    swapSubmitText: {
        color: C.white,
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    // History Styles
    emptyHistoryCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    emptyHistoryTitle: {
        color: C.textMain,
        fontSize: 14,
        fontWeight: '800',
        marginTop: 8,
    },
    emptyHistorySub: {
        color: C.textSub,
        fontSize: 11,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
    },
    historyListCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.cardBorder,
        overflow: 'hidden',
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    historyRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.borderSubtle,
    },
    historyIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyTypeTitle: {
        color: C.textMain,
        fontSize: 11.5,
        fontWeight: '700',
    },
    historyDate: {
        color: C.textMuted,
        fontSize: 9,
        marginTop: 2,
    },
    historyAmountText: {
        color: C.textMain,
        fontSize: 12.5,
        fontWeight: '800',
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        marginTop: 2,
    },
    statusPillSuccess: {
        backgroundColor: C.emeraldBg,
    },
    statusPillPending: {
        backgroundColor: C.goldBg,
    },
    statusPillFailed: {
        backgroundColor: C.roseBg,
    },
    statusPillText: {
        fontSize: 8.5,
        fontWeight: '800',
    },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        backgroundColor: C.card,
        borderRadius: 20,
        padding: 18,
        width: '100%',
        maxWidth: 390,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    webModalCard: {
        maxWidth: 420,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.borderSubtle,
        marginBottom: 12,
    },
    modalTitle: {
        color: C.textMain,
        fontSize: 15,
        fontWeight: '800',
    },
    modalCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldLabel: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    assetSelectorScroll: {
        gap: 6,
        marginBottom: 12,
    },
    modalAssetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.inputBg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.cardBorder,
        gap: 6,
    },
    modalAssetChipActive: {
        backgroundColor: C.navyDark,
        borderColor: C.navyDark,
    },
    modalAssetIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    modalAssetText: {
        color: C.textSub,
        fontSize: 10.5,
        fontWeight: '700',
    },
    modalAssetTextActive: {
        color: C.white,
    },
    networkOptionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    networkChip: {
        backgroundColor: C.inputBg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    networkChipActive: {
        backgroundColor: C.navyDark,
        borderColor: C.navyDark,
    },
    networkChipText: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
    },
    networkChipTextActive: {
        color: C.white,
    },
    qrBox: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    qrLoadingBox: {
        width: 150,
        height: 150,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    qrLoadingText: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 8,
    },
    qrInner: {
        alignItems: 'center',
    },
    qrScanPrompt: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 8,
    },
    addressCopyBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.inputBg,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 10,
    },
    addressText: {
        color: C.textMain,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 10.5,
        flex: 1,
        marginRight: 8,
        fontWeight: '600',
    },
    copyMiniButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    copyMiniButtonActive: {
        backgroundColor: C.emeraldBg,
    },
    copyMiniButtonText: {
        color: C.textMain,
        fontSize: 9.5,
        fontWeight: '700',
    },
    depositWarning: {
        backgroundColor: C.goldBg,
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 14,
    },
    depositWarningText: {
        color: C.gold,
        fontSize: 9.5,
        lineHeight: 14,
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    shareAddressBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.inputBg,
        borderRadius: 10,
        height: 42,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    shareAddressBtnText: {
        color: C.textMain,
        fontSize: 11.5,
        fontWeight: '700',
    },
    doneBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.navyDark,
        borderRadius: 10,
        height: 42,
    },
    doneBtnText: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.inputBg,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 8,
    },
    modalTextInput: {
        flex: 1,
        color: C.textMain,
        fontSize: 13,
        fontWeight: '700',
    },
    pastePill: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    pastePillText: {
        color: C.textMain,
        fontSize: 10,
        fontWeight: '700',
    },
    inputCurrencySuffix: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '800',
    },
    withdrawEstimateBox: {
        backgroundColor: C.inputBg,
        borderRadius: 8,
        padding: 8,
        marginTop: 4,
        marginBottom: 12,
    },
    withdrawEstimateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    withdrawEstimateLabel: {
        color: C.textSub,
        fontSize: 10,
    },
    withdrawEstimateValue: {
        color: C.textMain,
        fontSize: 10,
        fontWeight: '700',
    },
    primaryModalSubmit: {
        backgroundColor: C.navyDark,
        borderRadius: 10,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    primaryModalText: {
        color: C.white,
        fontSize: 12.5,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    fiatBalanceCard: {
        backgroundColor: C.blueBg,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fiatBalanceLabel: {
        color: C.blue,
        fontSize: 11,
        fontWeight: '600',
    },
    fiatBalanceAmount: {
        color: C.navyDark,
        fontSize: 14,
        fontWeight: '800',
    },
    nairaPrefix: {
        color: C.textSub,
        fontSize: 14,
        fontWeight: '800',
        marginRight: 6,
    },
    tradeSummaryBox: {
        backgroundColor: C.inputBg,
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        gap: 6,
    },
    tradeSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tradeSummaryLabel: {
        color: C.textSub,
        fontSize: 10.5,
    },
    tradeSummaryValue: {
        color: C.textMain,
        fontSize: 11,
        fontWeight: '700',
    },
    // Receipt Modal Styles
    receiptHeaderBadge: {
        alignItems: 'center',
        backgroundColor: C.emeraldBg,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        marginBottom: 14,
    },
    receiptMainAmount: {
        color: C.textMain,
        fontSize: 22,
        fontWeight: '800',
        marginTop: 4,
    },
    receiptType: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    receiptDetailsTable: {
        backgroundColor: C.inputBg,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 14,
        gap: 8,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    receiptRowLabel: {
        color: C.textSub,
        fontSize: 10.5,
    },
    receiptRowVal: {
        color: C.textMain,
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'right',
        flexShrink: 1,
        marginLeft: 10,
    },
});
