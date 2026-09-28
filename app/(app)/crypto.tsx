import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Image, 
    ActivityIndicator, Alert, Modal, TextInput, Platform, 
    StyleSheet, RefreshControl, Share, KeyboardAvoidingView,
    Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// ─── Theme Tokens (Executive Luxury Fintech) ───────────────────────────────────
const C = {
    navyDark: '#040814',
    navyBg: '#070D1E',
    navyCard: '#0C152E',
    navyElevated: '#111D3E',
    navyBorder: 'rgba(245, 166, 35, 0.28)',
    borderSubtle: '#1A2647',
    gold: '#F5A623',
    goldLight: '#FEF3C7',
    goldDark: '#D97706',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.14)',
    emeraldBorder: 'rgba(16, 185, 129, 0.35)',
    rose: '#EF4444',
    roseBg: 'rgba(239, 68, 68, 0.14)',
    roseBorder: 'rgba(239, 68, 68, 0.35)',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    cyan: '#06B6D4',
    pink: '#EC4899',
    white: '#FFFFFF',
    slate100: '#F1F5F9',
    slate300: '#CBD5E1',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate700: '#334155',
    slate800: '#1E293B',
    slate900: '#0F172A',
};

// ─── Supported Assets & NOWPayments Network Mappings ───────────────────────────
interface AssetConfig {
    symbol: string;
    name: string;
    icon: string;
    color: string;
    defaultRateUsd: number;
    sparkline: number[];
    networks: { label: string; network: string; currency: string; minDeposit: string; explorer: string }[];
}

const SUPPORTED_ASSETS: AssetConfig[] = [
    {
        symbol: 'USDT',
        name: 'Tether USD',
        icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        color: '#10B981',
        defaultRateUsd: 1.00,
        sparkline: [1.00, 1.001, 0.999, 1.00, 1.002, 1.00],
        networks: [
            { label: 'TRON (TRC20)', network: 'TRC20', currency: 'usdttrc20', minDeposit: '5 USDT', explorer: 'https://tronscan.org/#/transaction/' },
            { label: 'BNB Smart Chain (BEP20)', network: 'BEP20', currency: 'usdtbsc', minDeposit: '5 USDT', explorer: 'https://bscscan.com/tx/' },
            { label: 'Ethereum (ERC20)', network: 'ERC20', currency: 'usdterc20', minDeposit: '20 USDT', explorer: 'https://etherscan.io/tx/' },
            { label: 'Polygon (POL)', network: 'POLYGON', currency: 'usdtmatic', minDeposit: '5 USDT', explorer: 'https://polygonscan.com/tx/' },
            { label: 'Solana (SOL)', network: 'SOL', currency: 'usdtsol', minDeposit: '5 USDT', explorer: 'https://solscan.io/tx/' },
        ]
    },
    {
        symbol: 'BTC',
        name: 'Bitcoin',
        icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        color: '#F5A623',
        defaultRateUsd: 87500,
        sparkline: [84200, 85300, 86100, 85800, 86900, 87500],
        networks: [
            { label: 'Bitcoin Mainnet', network: 'BTC', currency: 'btc', minDeposit: '0.0002 BTC', explorer: 'https://mempool.space/tx/' }
        ]
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        color: '#627EEA',
        defaultRateUsd: 3100,
        sparkline: [2980, 3020, 3050, 3040, 3090, 3100],
        networks: [
            { label: 'Ethereum Mainnet (ERC20)', network: 'ERC20', currency: 'eth', minDeposit: '0.005 ETH', explorer: 'https://etherscan.io/tx/' },
            { label: 'Arbitrum One', network: 'ARBITRUM', currency: 'etharb', minDeposit: '0.002 ETH', explorer: 'https://arbiscan.io/tx/' },
            { label: 'Base Network', network: 'BASE', currency: 'ethbase', minDeposit: '0.002 ETH', explorer: 'https://basescan.org/tx/' },
        ]
    },
    {
        symbol: 'SOL',
        name: 'Solana',
        icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        color: '#14F195',
        defaultRateUsd: 185,
        sparkline: [172, 175, 178, 180, 183, 185],
        networks: [
            { label: 'Solana Mainnet', network: 'SOL', currency: 'sol', minDeposit: '0.05 SOL', explorer: 'https://solscan.io/tx/' }
        ]
    },
    {
        symbol: 'TRX',
        name: 'Tron',
        icon: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
        color: '#EF0027',
        defaultRateUsd: 0.22,
        sparkline: [0.20, 0.21, 0.215, 0.218, 0.22, 0.222],
        networks: [
            { label: 'TRON (TRC20)', network: 'TRX', currency: 'trx', minDeposit: '20 TRX', explorer: 'https://tronscan.org/#/transaction/' }
        ]
    },
    {
        symbol: 'BNB',
        name: 'BNB Chain',
        icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        color: '#F3BA2F',
        defaultRateUsd: 620,
        sparkline: [595, 605, 610, 612, 618, 620],
        networks: [
            { label: 'BNB Smart Chain (BEP20)', network: 'BEP20', currency: 'bnbbsc', minDeposit: '0.01 BNB', explorer: 'https://bscscan.com/tx/' }
        ]
    },
    {
        symbol: 'TON',
        name: 'Toncoin',
        icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png',
        color: '#0088CC',
        defaultRateUsd: 5.40,
        sparkline: [5.10, 5.15, 5.25, 5.30, 5.35, 5.40],
        networks: [
            { label: 'The Open Network (TON)', network: 'TON', currency: 'ton', minDeposit: '1 TON', explorer: 'https://tonviewer.com/transaction/' }
        ]
    },
    {
        symbol: 'DOGE',
        name: 'Dogecoin',
        icon: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
        color: '#C2A633',
        defaultRateUsd: 0.16,
        sparkline: [0.145, 0.15, 0.152, 0.155, 0.158, 0.16],
        networks: [
            { label: 'Dogecoin Network', network: 'DOGE', currency: 'doge', minDeposit: '15 DOGE', explorer: 'https://dogechain.info/tx/' }
        ]
    }
];

// Gas Station Configs
const GAS_STATION_CONFIGS = [
    {
        id: 'TRX',
        name: 'TRON (TRX)',
        purpose: 'Required for USDT TRC20 transfers',
        network: 'TRC20',
        minNgn: 2500,
        presets: [
            { label: '15 TRX (Basic)', gas: 15, ngn: 3500, usdt: 2.3 },
            { label: '32 TRX (Standard)', gas: 32, ngn: 7500, usdt: 5.0 },
            { label: '65 TRX (Power)', gas: 65, ngn: 15000, usdt: 10.0 },
        ]
    },
    {
        id: 'BNB',
        name: 'BNB Smart Chain',
        purpose: 'Required for BEP20 tokens & DEX trades',
        network: 'BEP20',
        minNgn: 3000,
        presets: [
            { label: '0.005 BNB (Starter)', gas: 0.005, ngn: 4500, usdt: 3.1 },
            { label: '0.010 BNB (Standard)', gas: 0.010, ngn: 9000, usdt: 6.2 },
            { label: '0.025 BNB (Bulk)', gas: 0.025, ngn: 22500, usdt: 15.5 },
        ]
    },
    {
        id: 'MATIC',
        name: 'Polygon (POL)',
        purpose: 'Ultra-low cost gas for Polygon network',
        network: 'POLYGON',
        minNgn: 1500,
        presets: [
            { label: '3 POL (Quick)', gas: 3, ngn: 2500, usdt: 1.7 },
            { label: '8 POL (Standard)', gas: 8, ngn: 6500, usdt: 4.4 },
            { label: '20 POL (Heavy)', gas: 20, ngn: 16000, usdt: 11.0 },
        ]
    },
    {
        id: 'ETH',
        name: 'Ethereum L2 (Base / Arbitrum)',
        purpose: 'Low-cost gas for Arbitrum/Base transfers',
        network: 'ARBITRUM',
        minNgn: 3000,
        presets: [
            { label: '0.001 ETH (Mini)', gas: 0.001, ngn: 4600, usdt: 3.1 },
            { label: '0.003 ETH (Standard)', gas: 0.003, ngn: 13800, usdt: 9.3 },
            { label: '0.006 ETH (Pro)', gas: 0.006, ngn: 27600, usdt: 18.6 },
        ]
    }
];

// Live Blockchain Network Radar Data
const NETWORK_RADAR_DATA = [
    { network: 'TRON (TRC20)', costUsd: '$1.80 - $2.40', speed: '~1 min', status: 'Optimal', statusColor: '#10B981', icon: 'flash' },
    { network: 'BNB Chain (BEP20)', costUsd: '$0.15 - $0.35', speed: '~3 sec', status: 'Ultra Fast', statusColor: '#10B981', icon: 'rocket' },
    { network: 'Polygon (POL)', costUsd: '$0.02 - $0.05', speed: '~2 sec', status: 'Lowest Gas', statusColor: '#06B6D4', icon: 'diamond' },
    { network: 'Solana (SOL)', costUsd: '< $0.01', speed: '~400 ms', status: 'Instant', statusColor: '#10B981', icon: 'flash-outline' },
    { network: 'Arbitrum One', costUsd: '$0.12 - $0.25', speed: '~1 sec', status: 'L2 Scaled', statusColor: '#3B82F6', icon: 'layers' },
    { network: 'Ethereum (ERC20)', costUsd: '$3.50 - $8.00', speed: '~15 sec', status: 'Congested', statusColor: '#F5A623', icon: 'warning' },
];

// Storage Keys
const SAVED_WALLETS_KEY = '@crypto_saved_wallets_v2';
const PRICE_ALERTS_KEY = '@crypto_price_alerts_v2';
const FAVORITES_KEY = '@crypto_favorites_v2';

// ─── Dual QR Code Component ────────────────────────────────────────────────────
function SafeQRCode({ value, size = 160 }: { value: string; size?: number }) {
    const [hasError, setHasError] = useState(false);
    const encoded = encodeURIComponent(value || 'https://nowpayments.io');
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encoded}&margin=2&color=040814`;

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
                    color="#040814"
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

// ─── Mini Sparkline Trendline ──────────────────────────────────────────────────
function MiniSparkline({ points, isPositive }: { points: number[]; isPositive: boolean }) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    return (
        <View style={s.sparklineContainer}>
            {points.map((pt, i) => {
                const heightPct = Math.max(15, Math.min(100, ((pt - min) / range) * 100));
                return (
                    <View
                        key={i}
                        style={[
                            s.sparklineBar,
                            { 
                                height: `${heightPct}%`,
                                backgroundColor: isPositive ? C.emerald : C.rose
                            }
                        ]}
                    />
                );
            })}
        </View>
    );
}

export default function CryptoScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // ─── Navigation & Views ────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'portfolio' | 'trade' | 'gas' | 'markets' | 'history'>('portfolio');
    const [tradeSubTab, setTradeSubTab] = useState<'swap' | 'converter' | 'dca'>('swap');
    const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'NGN'>('USD');
    const [assetsRates, setAssetsRates] = useState<CryptoRate[]>([]);
    const [loadingRates, setLoadingRates] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // User Balances & Data
    const [userId, setUserId] = useState<string | null>(null);
    const [currentUserPhone, setCurrentUserPhone] = useState<string>('');
    const [nairaBalance, setNairaBalance] = useState<number>(0);
    const [cryptoBalances, setCryptoBalances] = useState<Record<string, number>>({});
    const [hideBalance, setHideBalance] = useState<boolean>(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingTxns, setLoadingTxns] = useState(false);

    // Modals
    const [activeModal, setActiveModal] = useState<
        'deposit' | 'withdraw' | 'transfer' | 'buy' | 'sell' | 'gas' | 
        'addressBook' | 'addressPicker' | 'priceAlert' | 'txReceipt' | null
    >(null);
    const [addressPickerTarget, setAddressPickerTarget] = useState<'withdraw' | 'gas'>('withdraw');
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [securityAction, setSecurityAction] = useState<(() => void) | null>(null);
    const [securityDescription, setSecurityDescription] = useState<string>('');

    // Deposit State (NOWPayments Integration)
    const [depositAsset, setDepositAsset] = useState<string>('USDT');
    const [depositNetworkIdx, setDepositNetworkIdx] = useState<number>(0);
    const [depositAddress, setDepositAddress] = useState<string>('');
    const [depositLoading, setDepositLoading] = useState<boolean>(false);
    const [depositCopied, setDepositCopied] = useState<boolean>(false);

    // Withdraw State (NOWPayments Payout Integration)
    const [withdrawAsset, setWithdrawAsset] = useState<string>('USDT');
    const [withdrawNetworkIdx, setWithdrawNetworkIdx] = useState<number>(0);
    const [withdrawAddress, setWithdrawAddress] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [withdrawing, setWithdrawing] = useState<boolean>(false);

    // Instant P2P Internal Transfer (0 Gas Fee)
    const [transferRecipientInput, setTransferRecipientInput] = useState<string>('');
    const [transferResolvedRecipient, setTransferResolvedRecipient] = useState<{ id: string; full_name?: string; phone?: string; username?: string } | null>(null);
    const [transferResolving, setTransferResolving] = useState<boolean>(false);
    const [transferAsset, setTransferAsset] = useState<string>('USDT');
    const [transferAmount, setTransferAmount] = useState<string>('');
    const [transferring, setTransferring] = useState<boolean>(false);

    // Buy State (Naira to Crypto)
    const [buyAsset, setBuyAsset] = useState<string>('USDT');
    const [buyNgnAmount, setBuyNgnAmount] = useState<string>('10000');
    const [buying, setBuying] = useState<boolean>(false);

    // Sell State (Crypto to Naira)
    const [sellAsset, setSellAsset] = useState<string>('USDT');
    const [sellCryptoAmount, setSellCryptoAmount] = useState<string>('10');
    const [selling, setSelling] = useState<boolean>(false);

    // DEX Swap State
    const [swapFrom, setSwapFrom] = useState<string>('USDT');
    const [swapTo, setSwapTo] = useState<string>('BTC');
    const [swapAmount, setSwapAmount] = useState<string>('100');
    const [swapping, setSwapping] = useState<boolean>(false);

    // Live Converter Calculator State
    const [calcBaseMode, setCalcBaseMode] = useState<'CRYPTO' | 'USD' | 'NGN'>('CRYPTO');
    const [calcCryptoAsset, setCalcCryptoAsset] = useState<string>('BTC');
    const [calcInputValue, setCalcInputValue] = useState<string>('1');

    // DCA Planner State
    const [dcaAsset, setDcaAsset] = useState<string>('BTC');
    const [dcaAmountNgn, setDcaAmountNgn] = useState<string>('10000');
    const [dcaFrequency, setDcaFrequency] = useState<'weekly' | 'monthly'>('weekly');
    const [dcaDurationMonths, setDcaDurationMonths] = useState<number>(12);

    // Gas Station State
    const [selectedGasId, setSelectedGasId] = useState<string>('TRX');
    const [gasWalletAddress, setGasWalletAddress] = useState<string>('');
    const [gasPaymentMethod, setGasPaymentMethod] = useState<'NGN' | 'USDT'>('NGN');
    const [selectedGasPresetIdx, setSelectedGasPresetIdx] = useState<number>(1);
    const [buyingGas, setBuyingGas] = useState<boolean>(false);

    // Saved Wallets (Address Book)
    const [savedWallets, setSavedWallets] = useState<{ id: string; nickname: string; asset: string; network: string; address: string }[]>([]);
    const [newWalletNickname, setNewWalletNickname] = useState('');
    const [newWalletAddress, setNewWalletAddress] = useState('');
    const [newWalletAsset, setNewWalletAsset] = useState('USDT');
    const [newWalletNetwork, setNewWalletNetwork] = useState('TRC20');

    // Price Alerts
    const [priceAlerts, setPriceAlerts] = useState<{ id: string; asset: string; targetPrice: number; condition: 'above' | 'below'; active: boolean }[]>([]);
    const [alertAsset, setAlertAsset] = useState('BTC');
    const [alertTargetPrice, setAlertTargetPrice] = useState('90000');
    const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');

    // Favorites / Watchlist
    const [favorites, setFavorites] = useState<string[]>(['BTC', 'ETH', 'USDT', 'SOL']);
    const [marketTabFilter, setMarketTabFilter] = useState<'all' | 'favorites' | 'gainers'>('all');

    // Selected Transaction for Blockchain Receipt Modal
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    // Markets & History Filters
    const [marketSearch, setMarketSearch] = useState<string>('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');
    const [historySearch, setHistorySearch] = useState<string>('');

    // ─── Lifecycle & Data Fetching ─────────────────────────────────────────────
    useEffect(() => {
        initUserData();
        loadSavedWallets();
        loadPriceAlerts();
        loadFavorites();
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
            const { data: prof } = await supabase.from('profiles').select('balance, phone').eq('id', uid).maybeSingle();
            if (prof) {
                if (prof.balance !== undefined) setNairaBalance(Number(prof.balance) || 0);
                if (prof.phone) setCurrentUserPhone(prof.phone);
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
                .limit(50);

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
                'the-open-network', 'polkadot', 'chainlink', 'matic-network'
            ]);
            if (rates && Array.isArray(rates) && rates.length > 0) {
                setAssetsRates(rates);
                checkTriggeredAlerts(rates);
            }
        } catch (e) {
            console.warn('fetchRates error:', e);
        } finally {
            setLoadingRates(false);
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

    // ─── Price & Calculation Lookups ───────────────────────────────────────────
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

    // ─── Portfolio Allocations Breakdown ───────────────────────────────────────
    const portfolioAllocations = useMemo(() => {
        if (totalPortfolioUsd <= 0) return [];
        return SUPPORTED_ASSETS.map(asset => {
            const bal = cryptoBalances[asset.symbol] || 0;
            const valUsd = bal * getAssetPriceUsd(asset.symbol);
            const percentage = (valUsd / totalPortfolioUsd) * 100;
            return {
                ...asset,
                balance: bal,
                valUsd,
                percentage: percentage < 0.1 ? 0 : percentage
            };
        }).filter(a => a.percentage > 0).sort((a, b) => b.percentage - a.percentage);
    }, [totalPortfolioUsd, cryptoBalances, getAssetPriceUsd]);

    // ─── Saved Wallets (Address Book) Logic ────────────────────────────────────
    const loadSavedWallets = async () => {
        try {
            const raw = await AsyncStorage.getItem(SAVED_WALLETS_KEY);
            if (raw) setSavedWallets(JSON.parse(raw));
        } catch {}
    };

    const handleSaveNewWallet = async () => {
        if (!newWalletNickname.trim() || !newWalletAddress.trim()) {
            Alert.alert("Required Fields", "Please enter a nickname and wallet address.");
            return;
        }
        const updated = [
            ...savedWallets,
            {
                id: Date.now().toString(),
                nickname: newWalletNickname.trim(),
                asset: newWalletAsset,
                network: newWalletNetwork,
                address: newWalletAddress.trim()
            }
        ];
        setSavedWallets(updated);
        await AsyncStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(updated));
        setNewWalletNickname('');
        setNewWalletAddress('');
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert("Wallet Whitelisted 🔒", "Address saved to your secure address book.");
    };

    const handleDeleteSavedWallet = async (id: string) => {
        const filtered = savedWallets.filter(w => w.id !== id);
        setSavedWallets(filtered);
        await AsyncStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(filtered));
    };

    // ─── Favorites / Watchlist Logic ───────────────────────────────────────────
    const loadFavorites = async () => {
        try {
            const raw = await AsyncStorage.getItem(FAVORITES_KEY);
            if (raw) setFavorites(JSON.parse(raw));
        } catch {}
    };

    const toggleFavorite = async (symbol: string) => {
        const upper = symbol.toUpperCase();
        let next: string[];
        if (favorites.includes(upper)) {
            next = favorites.filter(f => f !== upper);
        } else {
            next = [...favorites, upper];
        }
        setFavorites(next);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    // ─── Price Alerts Engine ───────────────────────────────────────────────────
    const loadPriceAlerts = async () => {
        try {
            const raw = await AsyncStorage.getItem(PRICE_ALERTS_KEY);
            if (raw) setPriceAlerts(JSON.parse(raw));
        } catch {}
    };

    const handleCreateAlert = async () => {
        const target = parseFloat(alertTargetPrice.trim());
        if (isNaN(target) || target <= 0) {
            Alert.alert("Invalid Price", "Please enter a valid target price in USD.");
            return;
        }
        const newAlert = {
            id: Date.now().toString(),
            asset: alertAsset,
            targetPrice: target,
            condition: alertCondition,
            active: true
        };
        const updated = [...priceAlerts, newAlert];
        setPriceAlerts(updated);
        await AsyncStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(updated));
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert("Price Alert Set 🔔", `We will alert you when ${alertAsset} goes ${alertCondition} $${target.toLocaleString()}.`);
        setActiveModal(null);
    };

    const checkTriggeredAlerts = (rates: CryptoRate[]) => {
        priceAlerts.forEach(alert => {
            if (!alert.active) return;
            const coin = rates.find(r => r.symbol?.toUpperCase() === alert.asset.toUpperCase());
            if (!coin) return;
            const currentPrice = coin.price_usd;

            const isTriggered = alert.condition === 'above' 
                ? currentPrice >= alert.targetPrice 
                : currentPrice <= alert.targetPrice;

            if (isTriggered && userId) {
                createAppNotification(
                    userId,
                    `🚨 Crypto Price Alert: ${alert.asset}`,
                    `${alert.asset} has reached your target of $${alert.targetPrice.toLocaleString()} (Current: $${currentPrice.toLocaleString()})!`,
                    "crypto",
                    "high"
                );
            }
        });
    };

    // ─── Export / Share Portfolio Summary ──────────────────────────────────────
    const handleSharePortfolio = async () => {
        try {
            const lines: string[] = [
                `💎 ABU MAFHAL SUB — CRYPTO PORTFOLIO SUMMARY`,
                `📅 Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                `💰 Total Valuation: $${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (≈ ₦${totalPortfolioNgn.toLocaleString()} NGN)`,
                `----------------------------------------`,
                `ASSET ALLOCATION:`
            ];

            SUPPORTED_ASSETS.forEach(a => {
                const bal = cryptoBalances[a.symbol] || 0;
                if (bal > 0) {
                    const price = getAssetPriceUsd(a.symbol);
                    lines.push(`• ${a.symbol}: ${bal.toLocaleString(undefined, { maximumFractionDigits: 6 })} (≈ $${(bal * price).toFixed(2)})`);
                }
            });

            lines.push(`----------------------------------------`);
            lines.push(`⚡ Powered by NOWPayments & Abu Mafhal Crypto Hub`);

            if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            await Share.share({
                message: lines.join('\n'),
                title: 'Crypto Portfolio Statement'
            });
        } catch {}
    };

    // ─── NOWPAYMENTS: Live Deposit Address ─────────────────────────────────────
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

    // ─── NOWPAYMENTS: Real Withdrawal Submission ───────────────────────────────
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
                    `Successfully dispatched payout of ${amountNum} ${withdrawAsset} to ${destAddr.slice(0, 10)}... Processing via NOWPayments blockchain gateway.`
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

    // ─── INSTANT P2P INTERNAL TRANSFER (0 Gas Fee) ─────────────────────────────
    const resolveInternalRecipient = async (query: string) => {
        const clean = query.trim();
        if (clean.length < 3) {
            setTransferResolvedRecipient(null);
            return;
        }
        setTransferResolving(true);
        try {
            // A. Search by ID if valid UUID
            if (clean.length === 36) {
                const { data } = await supabase.from('profiles').select('id, full_name, phone, username').eq('id', clean).maybeSingle();
                if (data && data.id !== userId) {
                    setTransferResolvedRecipient(data);
                    return;
                }
            }
            // B. Search by Phone (last 8 digits)
            const cleanPhone = clean.replace(/\D/g, '');
            if (cleanPhone.length >= 8) {
                const last8 = cleanPhone.slice(-8);
                const { data } = await supabase.from('profiles').select('id, full_name, phone, username').ilike('phone', `%${last8}%`).limit(1).maybeSingle();
                if (data && data.id !== userId) {
                    setTransferResolvedRecipient(data);
                    return;
                }
            }
            // C. Search by Username
            const { data: userProf } = await supabase.from('profiles').select('id, full_name, phone, username').ilike('username', clean).maybeSingle();
            if (userProf && userProf.id !== userId) {
                setTransferResolvedRecipient(userProf);
                return;
            }
            setTransferResolvedRecipient(null);
        } catch (e) {
            console.warn("Recipient lookup error:", e);
        } finally {
            setTransferResolving(false);
        }
    };

    const initiateInternalTransfer = () => {
        const amt = parseFloat(transferAmount.trim());
        if (!transferResolvedRecipient || !transferResolvedRecipient.id) {
            Alert.alert("Recipient Required", "Please enter a valid Abu Mafhal user phone number or username.");
            return;
        }
        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount to transfer.");
            return;
        }
        const senderBal = cryptoBalances[transferAsset] || 0;
        if (amt > senderBal) {
            Alert.alert("Insufficient Balance", `You only have ${senderBal.toFixed(4)} ${transferAsset} available.`);
            return;
        }

        setSecurityDescription(`Transfer ${amt} ${transferAsset} to ${transferResolvedRecipient.full_name || transferResolvedRecipient.phone || 'Abu Mafhal User'} with 0 gas fees`);
        setSecurityAction(() => () => executeInternalTransfer(transferResolvedRecipient.id, amt));
        setShowSecurityModal(true);
    };

    const executeInternalTransfer = async (targetUserId: string, amt: number) => {
        if (!userId) return;
        setTransferring(true);
        try {
            // 1. Deduct sender
            const { data: deductData, error: deductErr } = await supabase.rpc('deduct_crypto_balance', {
                user_id: userId,
                asset: transferAsset.toLowerCase(),
                amount: amt
            });
            if (deductErr || !deductData?.success) {
                throw new Error(deductErr?.message || deductData?.error || "Failed to deduct sender crypto balance.");
            }

            // 2. Credit recipient
            const { data: creditData, error: creditErr } = await supabase.rpc('credit_crypto_balance', {
                user_id: targetUserId,
                asset: transferAsset.toLowerCase(),
                amount: amt
            });
            if (creditErr || !creditData?.success) {
                // Rollback sender
                await supabase.rpc('credit_crypto_balance', {
                    user_id: userId,
                    asset: transferAsset.toLowerCase(),
                    amount: amt
                });
                throw new Error(creditErr?.message || creditData?.error || "Failed to credit recipient balance.");
            }

            // 3. Insert audit transactions
            const assetPriceUsd = getAssetPriceUsd(transferAsset);
            const ngnEquivalent = Math.floor(amt * assetPriceUsd * getUsdtToNgnRate('sell'));

            await Promise.all([
                supabase.from('transactions').insert({
                    user_id: userId,
                    type: 'crypto_transfer_out',
                    amount: ngnEquivalent,
                    status: 'success',
                    description: `Internal P2P Sent: ${amt} ${transferAsset} to ${transferResolvedRecipient?.full_name || transferResolvedRecipient?.phone}`
                }),
                supabase.from('transactions').insert({
                    user_id: targetUserId,
                    type: 'crypto_transfer_in',
                    amount: ngnEquivalent,
                    status: 'success',
                    description: `Internal P2P Received: ${amt} ${transferAsset} from ${currentUserPhone || 'Abu Mafhal User'}`
                })
            ]);

            // 4. Notifications
            createAppNotification(
                userId,
                "Crypto Transfer Sent 🚀",
                `Transferred ${amt} ${transferAsset} to ${transferResolvedRecipient?.full_name || 'recipient'} with 0 fees!`,
                "crypto",
                "normal"
            );
            createAppNotification(
                targetUserId,
                "Crypto Received Instantly 💎",
                `You received ${amt} ${transferAsset} from an Abu Mafhal user!`,
                "crypto",
                "high"
            );

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Transfer Complete 🎉", `Successfully transferred ${amt} ${transferAsset} with ZERO gas fees!`);
            setActiveModal(null);
            setTransferRecipientInput('');
            setTransferResolvedRecipient(null);
            setTransferAmount('');
            fetchUserBalances(userId);
            fetchCryptoTransactions(userId);
        } catch (err: any) {
            Alert.alert("Transfer Failed", err.message || "Could not complete internal transfer.");
        } finally {
            setTransferring(false);
        }
    };

    // ─── BUY CRYPTO (Naira -> Crypto) ──────────────────────────────────────────
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

    // ─── SELL CRYPTO (Crypto -> Naira Cashout) ─────────────────────────────────
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

    // ─── DEX SWAP (Live Rate Cross-Asset Swap) ──────────────────────────────────
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
                Alert.alert("DEX Swap Completed 🔄", `Swapped ${inAmt} ${swapFrom} for ${outAmt} ${swapTo} at live market rates!`);
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

    // ─── CRYPTO GAS REFUEL (Buy Gas Station) ───────────────────────────────────
    const handleBuyGasSubmit = async () => {
        if (!gasWalletAddress.trim()) {
            Alert.alert("Destination Required", "Please enter your external wallet address to receive gas.");
            return;
        }
        const gasConfig = GAS_STATION_CONFIGS.find(g => g.id === selectedGasId) || GAS_STATION_CONFIGS[0];
        const preset = gasConfig.presets[selectedGasPresetIdx] || gasConfig.presets[0];

        const cost = gasPaymentMethod === 'NGN' ? preset.ngn : preset.usdt;
        const availableBal = gasPaymentMethod === 'NGN' ? nairaBalance : (cryptoBalances['USDT'] || 0);

        if (cost > availableBal) {
            Alert.alert("Insufficient Balance", `You need ${cost} ${gasPaymentMethod} to buy this gas package.`);
            return;
        }

        setBuyingGas(true);
        try {
            const res = await api.crypto.buyGas({
                gasType: selectedGasId,
                walletAddress: gasWalletAddress.trim(),
                paymentMethod: gasPaymentMethod,
                amountPayment: cost,
                amountGas: preset.gas
            });

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Gas Refueled ⛽", `Dispatched ${preset.gas} ${selectedGasId} to ${gasWalletAddress.slice(0, 10)}... via NOWPayments!`);
            setActiveModal(null);
            setGasWalletAddress('');
            if (userId) {
                fetchUserBalances(userId);
                fetchCryptoTransactions(userId);
            }
        } catch (err: any) {
            Alert.alert("Gas Purchase Failed", err.message || "Could not complete gas dispatch.");
        } finally {
            setBuyingGas(false);
        }
    };

    // ─── Live Converter Calculations ───────────────────────────────────────────
    const converterResults = useMemo(() => {
        const val = parseFloat(calcInputValue.trim()) || 0;
        const usdtRate = getUsdtToNgnRate('sell');
        const assetPrice = getAssetPriceUsd(calcCryptoAsset);

        if (calcBaseMode === 'CRYPTO') {
            const usd = val * assetPrice;
            const ngn = usd * usdtRate;
            return { crypto: val, usd, ngn };
        } else if (calcBaseMode === 'USD') {
            const crypto = assetPrice > 0 ? val / assetPrice : 0;
            const ngn = val * usdtRate;
            return { crypto, usd: val, ngn };
        } else {
            // NGN Base
            const usd = usdtRate > 0 ? val / usdtRate : 0;
            const crypto = assetPrice > 0 ? usd / assetPrice : 0;
            return { crypto, usd, ngn: val };
        }
    }, [calcInputValue, calcBaseMode, calcCryptoAsset, getAssetPriceUsd, getUsdtToNgnRate]);

    // ─── DCA Calculations ──────────────────────────────────────────────────────
    const dcaProjection = useMemo(() => {
        const amtNgn = parseFloat(dcaAmountNgn.trim()) || 0;
        const totalPeriods = dcaFrequency === 'weekly' ? dcaDurationMonths * 4 : dcaDurationMonths;
        const totalInvestedNgn = amtNgn * totalPeriods;
        const usdtRate = getUsdtToNgnRate('buy');
        const totalInvestedUsd = totalInvestedNgn / usdtRate;
        const assetPrice = getAssetPriceUsd(dcaAsset);
        const estAccumulatedCrypto = assetPrice > 0 ? totalInvestedUsd / assetPrice : 0;

        // Conservative projected 25% annual return model
        const estGrowthMultiplier = 1 + (0.25 * (dcaDurationMonths / 12));
        const estFutureValNgn = totalInvestedNgn * estGrowthMultiplier;

        return {
            totalPeriods,
            totalInvestedNgn,
            totalInvestedUsd,
            estAccumulatedCrypto,
            estFutureValNgn
        };
    }, [dcaAmountNgn, dcaFrequency, dcaDurationMonths, dcaAsset, getAssetPriceUsd, getUsdtToNgnRate]);

    // ─── Top Gainer / Market Leader ────────────────────────────────────────────
    const topGainer = useMemo<Partial<CryptoRate>>(() => {
        if (assetsRates.length === 0) return { symbol: 'BTC', name: 'Bitcoin', price_usd: 87500, percent_change_24h: 3.2 };
        return assetsRates.reduce((prev, curr) => (curr.percent_change_24h > prev.percent_change_24h) ? curr : prev);
    }, [assetsRates]);

    // Filtered Transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const typeMatch = historyTypeFilter === 'ALL' || 
                (historyTypeFilter === 'DEPOSIT' && tx.type === 'crypto_deposit') ||
                (historyTypeFilter === 'WITHDRAW' && tx.type === 'crypto_withdrawal') ||
                (historyTypeFilter === 'TRANSFER' && (tx.type === 'crypto_transfer_in' || tx.type === 'crypto_transfer_out')) ||
                (historyTypeFilter === 'BUY' && tx.type === 'crypto_buy') ||
                (historyTypeFilter === 'SELL' && tx.type === 'crypto_sell') ||
                (historyTypeFilter === 'GAS' && tx.type === 'crypto_gas');

            const query = historySearch.toLowerCase();
            const searchMatch = !query || 
                (tx.reference?.toLowerCase().includes(query)) ||
                (tx.description?.toLowerCase().includes(query)) ||
                (tx.type?.toLowerCase().includes(query));

            return typeMatch && searchMatch;
        });
    }, [transactions, historyTypeFilter, historySearch]);

    const isWeb = Platform.OS === 'web';

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* CURVED LUXURY HEADER */}
            <LinearGradient
                colors={['#040814', '#070D1E', '#0C152E']}
                style={[s.headerContainer, { paddingTop: Math.max(insets.top, 24) + 8 }, isWeb && s.webContainer]}
            >
                <View style={s.headerTopRow}>
                    <TouchableOpacity onPress={() => router.replace('/dashboard')} style={s.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    
                    <View style={s.headerTitleWrap}>
                        <Text style={s.headerTitle}>Crypto Hub & DEX</Text>
                        <View style={s.nowPaymentsBadge}>
                            <View style={s.greenLivePulse} />
                            <Text style={s.nowPaymentsBadgeText}>NOWPayments Engine ⚡</Text>
                        </View>
                    </View>

                    <View style={s.headerActionsRight}>
                        <TouchableOpacity onPress={handleSharePortfolio} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="share-social-outline" size={17} color={C.gold} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveModal('priceAlert')} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="notifications-outline" size={17} color={C.gold} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onRefresh} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="reload" size={16} color={C.gold} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* HORIZONTAL LIVE TICKER RIBBON */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tickerRibbon}>
                    {SUPPORTED_ASSETS.slice(0, 6).map(asset => {
                        const price = getAssetPriceUsd(asset.symbol);
                        const data = assetsRates.find(r => r.symbol?.toUpperCase() === asset.symbol);
                        const chg = data?.percent_change_24h ?? 0;
                        const isPos = chg >= 0;
                        return (
                            <View key={asset.symbol} style={s.tickerPill}>
                                <Text style={s.tickerSymbol}>{asset.symbol}</Text>
                                <Text style={s.tickerPrice}>${price.toLocaleString()}</Text>
                                <Text style={[s.tickerChg, { color: isPos ? C.emerald : C.rose }]}>
                                    {isPos ? '+' : ''}{chg.toFixed(1)}%
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>

                {/* EXECUTIVE PORTFOLIO SUMMARY CARD */}
                <View style={s.heroCard}>
                    <View style={s.heroTop}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.heroSub}>Total Crypto Portfolio</Text>
                                {/* Currency Toggle ($ vs ₦) */}
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
                            <Ionicons name={hideBalance ? "eye-off" : "eye"} size={16} color={C.gold} />
                        </TouchableOpacity>
                    </View>

                    {/* NEW: MULTI-COLOR ASSET ALLOCATION BAR */}
                    {portfolioAllocations.length > 0 && !hideBalance && (
                        <View style={s.allocationBarContainer}>
                            <View style={s.allocationProgressBar}>
                                {portfolioAllocations.map(item => (
                                    <View 
                                        key={item.symbol} 
                                        style={[
                                            s.allocationProgressSegment, 
                                            { width: `${Math.max(item.percentage, 3)}%`, backgroundColor: item.color }
                                        ]} 
                                    />
                                ))}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.allocationLegendRow}>
                                {portfolioAllocations.map(item => (
                                    <View key={item.symbol} style={s.allocationLegendItem}>
                                        <View style={[s.allocationLegendDot, { backgroundColor: item.color }]} />
                                        <Text style={s.allocationLegendSymbol}>{item.symbol}</Text>
                                        <Text style={s.allocationLegendPercent}>{item.percentage.toFixed(0)}%</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Quick Vault & Whitelist Links */}
                    <View style={s.heroVaultRow}>
                        <View style={s.fiatVaultPill}>
                            <Ionicons name="wallet" size={12} color={C.gold} style={{ marginRight: 4 }} />
                            <Text style={s.fiatVaultText}>
                                Naira Vault: <Text style={{ color: C.white, fontWeight: '800' }}>₦{nairaBalance.toLocaleString()}</Text>
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('addressBook')}
                            style={s.addressBookPill}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="book-outline" size={11} color={C.slate300} style={{ marginRight: 3 }} />
                            <Text style={s.addressBookPillText}>Address Book ({savedWallets.length})</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 6 PRIMARY FINTECH ACTION BUTTONS */}
                    <View style={s.quickActionsRow}>
                        <TouchableOpacity 
                            onPress={() => setActiveModal('deposit')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#10B981', '#059669']} style={s.actionIconWrap}>
                                <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={s.actionText}>Deposit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('withdraw')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#F5A623', '#D97706']} style={s.actionIconWrap}>
                                <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={s.actionText}>Withdraw</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('transfer')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#06B6D4', '#0891B2']} style={s.actionIconWrap}>
                                <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={s.actionText}>Transfer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('buy')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={s.actionIconWrap}>
                                <Ionicons name="card" size={16} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={s.actionText}>Buy</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('sell')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={s.actionIconWrap}>
                                <Ionicons name="cash" size={16} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={s.actionText}>Sell</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveModal('gas')}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#EC4899', '#BE185D']} style={s.actionIconWrap}>
                                <Ionicons name="flame" size={16} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={s.actionText}>Gas Refuel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            {/* TAB SELECTOR DOCK */}
            <View style={[s.tabBarContainer, isWeb && s.webContainer]}>
                {[
                    { id: 'portfolio', label: 'Portfolio' },
                    { id: 'trade', label: 'Trade & Tools' },
                    { id: 'gas', label: 'Gas & Radar' },
                    { id: 'markets', label: 'Markets' },
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

            {/* MAIN CONTENT AREA */}
            <ScrollView
                style={[s.mainScroll, isWeb && s.webContainer]}
                contentContainerStyle={s.mainScrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
                showsVerticalScrollIndicator={false}
            >
                <DynamicBanners placement="crypto" />

                {/* ─── TAB 1: PORTFOLIO / WALLETS ──────────────────────────────── */}
                {activeTab === 'portfolio' && (
                    <View>
                        {/* 24h Top Gainer Banner */}
                        {topGainer ? (
                            <View style={s.marketLeaderCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={s.marketLeaderIconWrap}>
                                        <Ionicons name="flame" size={16} color={C.gold} />
                                    </View>
                                    <View>
                                        <Text style={s.marketLeaderSub}>24h Market Leader</Text>
                                        <Text style={s.marketLeaderTitle}>{topGainer.name} ({topGainer.symbol?.toUpperCase()})</Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={s.marketLeaderPrice}>${topGainer.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                                    <View style={s.marketLeaderBadge}>
                                        <Ionicons name="trending-up" size={10} color={C.emerald} style={{ marginRight: 2 }} />
                                        <Text style={s.marketLeaderChange}>+{topGainer.percent_change_24h?.toFixed(2)}%</Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}

                        {/* Assets Breakdown List */}
                        <View style={s.sectionHeaderRow}>
                            <Text style={s.sectionTitle}>Your Crypto Assets</Text>
                            <Text style={s.sectionSub}>Live Balance, Trendlines & Valuation</Text>
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
                                        <View style={s.assetCardTop}>
                                            <View style={s.assetIdentity}>
                                                <Image source={{ uri: asset.icon }} style={s.assetLogo} />
                                                <View>
                                                    <Text style={s.assetSymbol}>{asset.symbol}</Text>
                                                    <Text style={s.assetName}>{asset.name}</Text>
                                                </View>
                                            </View>

                                            {/* Mini Sparkline Chart */}
                                            <MiniSparkline points={asset.sparkline} isPositive={isPos} />

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={s.assetBalanceText}>
                                                    {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                                </Text>
                                                <Text style={s.assetValuationText}>
                                                    ≈ ${valUsd.toFixed(2)} USD
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={s.assetCardDivider} />

                                        <View style={s.assetCardBottom}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={s.assetPriceText}>${livePrice.toLocaleString()}</Text>
                                                <View style={[s.percentPill, isPos ? s.percentPillPositive : s.percentPillNegative]}>
                                                    <Ionicons 
                                                        name={isPos ? "arrow-up" : "arrow-down"} 
                                                        size={8} 
                                                        color={isPos ? C.emerald : C.rose} 
                                                    />
                                                    <Text style={[s.percentText, { color: isPos ? C.emerald : C.rose }]}>
                                                        {Math.abs(change24h).toFixed(2)}%
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={s.quickDepositLink}>
                                                <Text style={s.quickDepositLinkText}>Deposit / Send →</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ─── TAB 2: TRADE & ADVANCED TOOLS ───────────────────────────── */}
                {activeTab === 'trade' && (
                    <View style={s.swapContainer}>
                        {/* Sub-Segment Dock */}
                        <View style={s.tradeSubDock}>
                            {[
                                { id: 'swap', label: 'DEX Swap 🔄' },
                                { id: 'converter', label: 'Live Converter 💱' },
                                { id: 'dca', label: 'DCA Planner 📈' },
                            ].map(sub => (
                                <TouchableOpacity
                                    key={sub.id}
                                    onPress={() => setTradeSubTab(sub.id as any)}
                                    style={[s.tradeSubPill, tradeSubTab === sub.id && s.tradeSubPillActive]}
                                >
                                    <Text style={[s.tradeSubPillText, tradeSubTab === sub.id && s.tradeSubPillTextActive]}>
                                        {sub.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* VIEW 1: DEX SWAP */}
                        {tradeSubTab === 'swap' && (
                            <View style={s.swapCard}>
                                <View style={s.swapHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={s.swapIndicatorDot} />
                                        <Text style={s.swapTitle}>Instant Crypto DEX Swap</Text>
                                    </View>
                                    <View style={s.zeroFeeBadge}>
                                        <Text style={s.zeroFeeBadgeText}>0% Platform Fee</Text>
                                    </View>
                                </View>

                                <Text style={s.swapSubtitle}>
                                    Swap between any supported cryptocurrencies instantly at real-time market rates.
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
                                            placeholderTextColor={C.slate500}
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
                                        <Ionicons name="swap-vertical" size={16} color={C.gold} />
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

                                {/* Slippage & Guarantee Notice */}
                                <View style={s.swapGuarantees}>
                                    <View style={s.guaranteeRow}>
                                        <Text style={s.guaranteeLabel}>Slippage Tolerance</Text>
                                        <Text style={s.guaranteeValue}>0.5% Guaranteed</Text>
                                    </View>
                                    <View style={s.guaranteeRow}>
                                        <Text style={s.guaranteeLabel}>Execution Time</Text>
                                        <Text style={s.guaranteeValue}>Instant Liquidity Pool</Text>
                                    </View>
                                </View>

                                {/* EXECUTE SWAP BUTTON */}
                                <TouchableOpacity
                                    onPress={handleSwapSubmit}
                                    disabled={swapping}
                                    style={s.swapSubmitButton}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#F5A623', '#D97706']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={s.swapSubmitGradient}
                                    >
                                        {swapping ? (
                                            <ActivityIndicator color="#040814" size="small" />
                                        ) : (
                                            <>
                                                <Ionicons name="flash" size={16} color="#040814" style={{ marginRight: 6 }} />
                                                <Text style={s.swapSubmitText}>Execute Instant Swap</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* VIEW 2: LIVE 3-WAY CONVERTER */}
                        {tradeSubTab === 'converter' && (
                            <View style={s.swapCard}>
                                <View style={s.swapHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="calculator" size={18} color={C.gold} />
                                        <Text style={s.swapTitle}>Live Crypto ↔ USD ↔ NGN Converter</Text>
                                    </View>
                                </View>
                                <Text style={s.swapSubtitle}>
                                    Calculate real-time conversions between Crypto, USD, and Nigerian Naira.
                                </Text>

                                {/* Base Mode Switcher */}
                                <View style={s.converterBaseSwitchRow}>
                                    {(['CRYPTO', 'USD', 'NGN'] as const).map(mode => (
                                        <TouchableOpacity
                                            key={mode}
                                            onPress={() => setCalcBaseMode(mode)}
                                            style={[s.converterBasePill, calcBaseMode === mode && s.converterBasePillActive]}
                                        >
                                            <Text style={[s.converterBasePillText, calcBaseMode === mode && s.converterBasePillTextActive]}>
                                                Input in {mode}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Asset Selector for Crypto */}
                                <Text style={s.fieldLabel}>CHOOSE TOKEN:</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                                    {SUPPORTED_ASSETS.map(a => (
                                        <TouchableOpacity
                                            key={a.symbol}
                                            onPress={() => setCalcCryptoAsset(a.symbol)}
                                            style={[s.modalAssetChip, calcCryptoAsset === a.symbol && s.modalAssetChipActive]}
                                        >
                                            <Text style={[s.modalAssetText, calcCryptoAsset === a.symbol && s.modalAssetTextActive]}>
                                                {a.symbol}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text style={s.fieldLabel}>ENTER AMOUNT ({calcBaseMode}):</Text>
                                <View style={s.modalInputWrap}>
                                    <TextInput
                                        value={calcInputValue}
                                        onChangeText={setCalcInputValue}
                                        keyboardType="numeric"
                                        placeholder="1.0"
                                        placeholderTextColor={C.slate500}
                                        style={s.modalTextInput}
                                    />
                                    <Text style={s.inputCurrencySuffix}>
                                        {calcBaseMode === 'CRYPTO' ? calcCryptoAsset : calcBaseMode}
                                    </Text>
                                </View>

                                {/* 3-Way Results Box */}
                                <View style={s.converterResultsBox}>
                                    <View style={s.converterResultRow}>
                                        <Text style={s.converterResultLabel}>{calcCryptoAsset} Valuation</Text>
                                        <Text style={[s.converterResultVal, { color: C.gold }]}>
                                            {converterResults.crypto.toLocaleString(undefined, { maximumFractionDigits: 6 })} {calcCryptoAsset}
                                        </Text>
                                    </View>
                                    <View style={s.converterResultRow}>
                                        <Text style={s.converterResultLabel}>US Dollar Value ($)</Text>
                                        <Text style={s.converterResultVal}>
                                            ${converterResults.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                        </Text>
                                    </View>
                                    <View style={s.converterResultRow}>
                                        <Text style={s.converterResultLabel}>Naira Equivalent (₦)</Text>
                                        <Text style={[s.converterResultVal, { color: C.emerald, fontSize: 13 }]}>
                                            ₦{Math.floor(converterResults.ngn).toLocaleString()} NGN
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* VIEW 3: DCA WEALTH PLANNER */}
                        {tradeSubTab === 'dca' && (
                            <View style={s.swapCard}>
                                <View style={s.swapHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="trending-up" size={18} color={C.emerald} />
                                        <Text style={s.swapTitle}>Dollar Cost Averaging (DCA) Planner</Text>
                                    </View>
                                </View>
                                <Text style={s.swapSubtitle}>
                                    Model wealth building by investing a small amount into crypto systematically.
                                </Text>

                                <Text style={s.fieldLabel}>SELECT ASSET TO ACCUMULATE:</Text>
                                <View style={s.networkOptionsRow}>
                                    {['BTC', 'ETH', 'SOL', 'USDT'].map(sym => (
                                        <TouchableOpacity
                                            key={sym}
                                            onPress={() => setDcaAsset(sym)}
                                            style={[s.networkChip, dcaAsset === sym && s.networkChipActive]}
                                        >
                                            <Text style={[s.networkChipText, dcaAsset === sym && s.networkChipTextActive]}>
                                                {sym}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={s.fieldLabel}>INVESTMENT PER PERIOD (₦):</Text>
                                <View style={s.modalInputWrap}>
                                    <Text style={s.nairaPrefix}>₦</Text>
                                    <TextInput
                                        value={dcaAmountNgn}
                                        onChangeText={setDcaAmountNgn}
                                        keyboardType="numeric"
                                        placeholder="10,000"
                                        placeholderTextColor={C.slate500}
                                        style={s.modalTextInput}
                                    />
                                </View>

                                <View style={s.networkOptionsRow}>
                                    <TouchableOpacity
                                        onPress={() => setDcaFrequency('weekly')}
                                        style={[s.networkChip, dcaFrequency === 'weekly' && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, dcaFrequency === 'weekly' && s.networkChipTextActive]}>
                                            Weekly DCA
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setDcaFrequency('monthly')}
                                        style={[s.networkChip, dcaFrequency === 'monthly' && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, dcaFrequency === 'monthly' && s.networkChipTextActive]}>
                                            Monthly DCA
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Projected Return Box */}
                                <View style={s.converterResultsBox}>
                                    <View style={s.converterResultRow}>
                                        <Text style={s.converterResultLabel}>Total Capital Invested (12 mos)</Text>
                                        <Text style={s.converterResultVal}>₦{dcaProjection.totalInvestedNgn.toLocaleString()} NGN</Text>
                                    </View>
                                    <View style={s.converterResultRow}>
                                        <Text style={s.converterResultLabel}>Est. Accumulated {dcaAsset}</Text>
                                        <Text style={[s.converterResultVal, { color: C.gold }]}>
                                            {dcaProjection.estAccumulatedCrypto.toFixed(6)} {dcaAsset}
                                        </Text>
                                    </View>
                                    <View style={s.converterResultRow}>
                                        <Text style={s.converterResultLabel}>Projected Value (25% Model)</Text>
                                        <Text style={[s.converterResultVal, { color: C.emerald, fontSize: 13 }]}>
                                            ≈ ₦{Math.floor(dcaProjection.estFutureValNgn).toLocaleString()} NGN
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* ─── TAB 3: GAS STATION & BLOCKCHAIN RADAR ───────────────────── */}
                {activeTab === 'gas' && (
                    <View style={s.gasContainer}>
                        <View style={s.gasBannerCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={s.gasIconWrapper}>
                                    <Ionicons name="flame" size={20} color="#FFFFFF" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.gasBannerTitle}>Crypto Gas Station ⛽</Text>
                                    <Text style={s.gasBannerSub}>
                                        Never get stuck without gas! Buy tiny amounts of TRX, BNB, or POL directly to your external wallet.
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Gas Asset Selector */}
                        <Text style={s.fieldLabel}>1. SELECT GAS TOKEN:</Text>
                        <View style={s.gasAssetOptions}>
                            {GAS_STATION_CONFIGS.map(g => (
                                <TouchableOpacity
                                    key={g.id}
                                    onPress={() => {
                                        setSelectedGasId(g.id);
                                        setSelectedGasPresetIdx(0);
                                    }}
                                    style={[s.gasAssetCard, selectedGasId === g.id && s.gasAssetCardActive]}
                                >
                                    <Text style={[s.gasAssetId, selectedGasId === g.id && s.gasAssetIdActive]}>{g.id}</Text>
                                    <Text style={s.gasAssetName}>{g.name}</Text>
                                    <Text style={s.gasAssetPurpose} numberOfLines={1}>{g.purpose}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Recipient Address */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.fieldLabel}>2. RECEIVING WALLET ADDRESS:</Text>
                            <TouchableOpacity 
                                onPress={() => {
                                    setAddressPickerTarget('gas');
                                    setActiveModal('addressPicker');
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}
                            >
                                <Ionicons name="book-outline" size={11} color={C.gold} />
                                <Text style={{ color: C.gold, fontSize: 9.5, fontWeight: '800' }}>Pick from Whitelist</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.modalInputWrap}>
                            <TextInput
                                value={gasWalletAddress}
                                onChangeText={setGasWalletAddress}
                                placeholder="Paste your destination wallet address..."
                                placeholderTextColor={C.slate500}
                                style={s.modalTextInput}
                            />
                            <TouchableOpacity 
                                onPress={async () => {
                                    const clip = await Clipboard.getStringAsync();
                                    if (clip) setGasWalletAddress(clip.trim());
                                }}
                                style={s.pastePill}
                            >
                                <Text style={s.pastePillText}>Paste</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Gas Presets */}
                        <Text style={s.fieldLabel}>3. SELECT GAS AMOUNT:</Text>
                        <View style={s.gasPresetsList}>
                            {GAS_STATION_CONFIGS.find(g => g.id === selectedGasId)?.presets.map((preset, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => setSelectedGasPresetIdx(idx)}
                                    style={[s.gasPresetItem, selectedGasPresetIdx === idx && s.gasPresetItemActive]}
                                >
                                    <View>
                                        <Text style={s.gasPresetTitle}>{preset.label}</Text>
                                        <Text style={s.gasPresetSub}>{preset.gas} {selectedGasId}</Text>
                                    </View>
                                    <Text style={s.gasPresetCost}>
                                        {gasPaymentMethod === 'NGN' ? `₦${preset.ngn.toLocaleString()}` : `${preset.usdt} USDT`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Payment Method Switch */}
                        <Text style={s.fieldLabel}>4. PAY WITH:</Text>
                        <View style={s.gasPayMethodRow}>
                            <TouchableOpacity
                                onPress={() => setGasPaymentMethod('NGN')}
                                style={[s.gasPayMethodPill, gasPaymentMethod === 'NGN' && s.gasPayMethodPillActive]}
                            >
                                <Text style={[s.gasPayMethodText, gasPaymentMethod === 'NGN' && s.gasPayMethodTextActive]}>
                                    Naira Vault (₦{nairaBalance.toLocaleString()})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setGasPaymentMethod('USDT')}
                                style={[s.gasPayMethodPill, gasPaymentMethod === 'USDT' && s.gasPayMethodPillActive]}
                            >
                                <Text style={[s.gasPayMethodText, gasPaymentMethod === 'USDT' && s.gasPayMethodTextActive]}>
                                    USDT Vault ({(cryptoBalances['USDT'] || 0).toFixed(2)} USDT)
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Purchase Gas Button */}
                        <TouchableOpacity
                            onPress={handleBuyGasSubmit}
                            disabled={buyingGas}
                            style={s.swapSubmitButton}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#EC4899', '#BE185D']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={s.swapSubmitGradient}
                            >
                                {buyingGas ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="flame" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={[s.swapSubmitText, { color: '#FFFFFF' }]}>Refuel Gas to Wallet Instantly</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* NEW: LIVE BLOCKCHAIN NETWORK RADAR */}
                        <View style={[s.sectionHeaderRow, { marginTop: 14 }]}>
                            <Text style={s.sectionTitle}>Blockchain Network Gas Radar 📡</Text>
                            <Text style={s.sectionSub}>Live confirmation speeds and estimated gas costs</Text>
                        </View>

                        <View style={s.marketsTableCard}>
                            {NETWORK_RADAR_DATA.map((net, idx) => (
                                <View key={net.network} style={[s.radarRow, idx !== NETWORK_RADAR_DATA.length - 1 && s.marketRowBorder]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={s.radarIconWrap}>
                                            <Ionicons name={net.icon as any} size={16} color={C.gold} />
                                        </View>
                                        <View>
                                            <Text style={s.radarNetName}>{net.network}</Text>
                                            <Text style={s.radarSpeedText}>Avg Block Time: {net.speed}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={s.radarCostText}>{net.costUsd}</Text>
                                        <View style={[s.radarStatusPill, { backgroundColor: `${net.statusColor}22` }]}>
                                            <Text style={[s.radarStatusText, { color: net.statusColor }]}>{net.status}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ─── TAB 4: MARKETS ─────────────────────────────────────────── */}
                {activeTab === 'markets' && (
                    <View>
                        {/* Search & Watchlist Filter Bar */}
                        <View style={s.searchBar}>
                            <Ionicons name="search" size={16} color={C.gold} />
                            <TextInput
                                value={marketSearch}
                                onChangeText={setMarketSearch}
                                placeholder="Search 20+ Crypto Assets (BTC, USDT, SOL)..."
                                placeholderTextColor={C.slate500}
                                style={s.searchInput}
                            />
                            {marketSearch ? (
                                <TouchableOpacity onPress={() => setMarketSearch('')}>
                                    <Ionicons name="close-circle" size={16} color={C.slate400} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Filter Chips */}
                        <View style={s.marketFiltersRow}>
                            <TouchableOpacity
                                onPress={() => setMarketTabFilter('all')}
                                style={[s.marketFilterChip, marketTabFilter === 'all' && s.marketFilterChipActive]}
                            >
                                <Text style={[s.marketFilterChipText, marketTabFilter === 'all' && s.marketFilterChipTextActive]}>
                                    All Coins ({assetsRates.length})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMarketTabFilter('favorites')}
                                style={[s.marketFilterChip, marketTabFilter === 'favorites' && s.marketFilterChipActive]}
                            >
                                <Text style={[s.marketFilterChipText, marketTabFilter === 'favorites' && s.marketFilterChipTextActive]}>
                                    ⭐ Watchlist ({favorites.length})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMarketTabFilter('gainers')}
                                style={[s.marketFilterChip, marketTabFilter === 'gainers' && s.marketFilterChipActive]}
                            >
                                <Text style={[s.marketFilterChipText, marketTabFilter === 'gainers' && s.marketFilterChipTextActive]}>
                                    🚀 Top Gainers
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Markets Table */}
                        <View style={s.marketsTableCard}>
                            {loadingRates ? (
                                <ActivityIndicator color={C.gold} size="large" style={{ padding: 32 }} />
                            ) : (
                                assetsRates
                                    .filter(item => {
                                        const matchesSearch = item.name?.toLowerCase().includes(marketSearch.toLowerCase()) ||
                                            item.symbol?.toLowerCase().includes(marketSearch.toLowerCase());
                                        if (marketTabFilter === 'favorites') {
                                            return matchesSearch && favorites.includes(item.symbol?.toUpperCase() || '');
                                        }
                                        if (marketTabFilter === 'gainers') {
                                            return matchesSearch && (item.percent_change_24h || 0) > 0;
                                        }
                                        return matchesSearch;
                                    })
                                    .map((coin, index, arr) => {
                                        const isLast = index === arr.length - 1;
                                        const isPos = (coin.percent_change_24h || 0) >= 0;
                                        const isFav = favorites.includes(coin.symbol?.toUpperCase() || '');

                                        return (
                                            <TouchableOpacity 
                                                key={coin.id || index} 
                                                style={[s.marketRow, !isLast && s.marketRowBorder]}
                                                onPress={() => {
                                                    setAlertAsset(coin.symbol?.toUpperCase() || 'BTC');
                                                    setAlertTargetPrice((coin.price_usd || 1000).toString());
                                                    setActiveModal('priceAlert');
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={s.marketRowLeft}>
                                                    <TouchableOpacity 
                                                        onPress={() => toggleFavorite(coin.symbol || '')}
                                                        style={{ paddingRight: 6 }}
                                                    >
                                                        <Ionicons 
                                                            name={isFav ? "star" : "star-outline"} 
                                                            size={16} 
                                                            color={isFav ? C.gold : C.slate500} 
                                                        />
                                                    </TouchableOpacity>

                                                    {coin.image ? (
                                                        <Image source={{ uri: coin.image }} style={s.marketCoinIcon} />
                                                    ) : (
                                                        <View style={s.marketCoinFallback}>
                                                            <Text style={s.marketCoinFallbackText}>{coin.symbol?.[0]?.toUpperCase()}</Text>
                                                        </View>
                                                    )}
                                                    <View>
                                                        <Text style={s.marketCoinName}>{coin.name}</Text>
                                                        <Text style={s.marketCoinSymbol}>{coin.symbol?.toUpperCase()}</Text>
                                                    </View>
                                                </View>

                                                <View style={s.marketRowRight}>
                                                    <Text style={s.marketPriceText}>
                                                        ${coin.price_usd?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                    </Text>
                                                    <View style={[s.marketPercentPill, isPos ? s.percentPillPositive : s.percentPillNegative]}>
                                                        <Ionicons 
                                                            name={isPos ? "arrow-up" : "arrow-down"} 
                                                            size={8} 
                                                            color={isPos ? C.emerald : C.rose} 
                                                        />
                                                        <Text style={{ color: isPos ? C.emerald : C.rose, fontSize: 10, fontWeight: '800' }}>
                                                            {isPos ? '+' : ''}{(coin.percent_change_24h || 0).toFixed(2)}%
                                                        </Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                            )}
                        </View>
                    </View>
                )}

                {/* ─── TAB 5: TRANSACTION HISTORY ─────────────────────────────── */}
                {activeTab === 'history' && (
                    <View>
                        <View style={s.sectionHeaderRow}>
                            <Text style={s.sectionTitle}>Blockchain & Trade Records</Text>
                            <Text style={s.sectionSub}>Tap any transaction to view official blockchain receipt & hash</Text>
                        </View>

                        {/* Search and Filter Chips */}
                        <View style={s.searchBar}>
                            <Ionicons name="search" size={15} color={C.gold} />
                            <TextInput
                                value={historySearch}
                                onChangeText={setHistorySearch}
                                placeholder="Search by Tx ID, reference or token..."
                                placeholderTextColor={C.slate500}
                                style={s.searchInput}
                            />
                            {historySearch ? (
                                <TouchableOpacity onPress={() => setHistorySearch('')}>
                                    <Ionicons name="close-circle" size={15} color={C.slate400} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.historyFiltersRow}>
                            {['ALL', 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'BUY', 'SELL', 'GAS'].map(type => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setHistoryTypeFilter(type)}
                                    style={[s.historyFilterPill, historyTypeFilter === type && s.historyFilterPillActive]}
                                >
                                    <Text style={[s.historyFilterPillText, historyTypeFilter === type && s.historyFilterPillTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {loadingTxns ? (
                            <ActivityIndicator color={C.gold} size="small" style={{ padding: 24 }} />
                        ) : filteredTransactions.length === 0 ? (
                            <View style={s.emptyHistoryCard}>
                                <Ionicons name="receipt-outline" size={36} color={C.slate500} />
                                <Text style={s.emptyHistoryTitle}>No Matching Transactions</Text>
                                <Text style={s.emptyHistorySub}>
                                    Your deposits, payouts, swaps, and buys will appear here with live blockchain verification.
                                </Text>
                            </View>
                        ) : (
                            <View style={s.historyListCard}>
                                {filteredTransactions.map((tx, idx) => {
                                    const isLast = idx === filteredTransactions.length - 1;
                                    const isSuccess = tx.status === 'success' || tx.status === 'finished' || tx.status === 'confirmed';
                                    const isPending = tx.status === 'pending' || tx.status === 'waiting';

                                    let iconName = 'swap-horizontal';
                                    let iconColor = C.gold;
                                    if (tx.type === 'crypto_deposit') {
                                        iconName = 'arrow-down-circle';
                                        iconColor = C.emerald;
                                    } else if (tx.type === 'crypto_withdrawal') {
                                        iconName = 'arrow-up-circle';
                                        iconColor = C.gold;
                                    } else if (tx.type === 'crypto_transfer_in' || tx.type === 'crypto_transfer_out') {
                                        iconName = 'paper-plane';
                                        iconColor = C.cyan;
                                    } else if (tx.type === 'crypto_buy') {
                                        iconName = 'card';
                                        iconColor = '#3B82F6';
                                    } else if (tx.type === 'crypto_sell') {
                                        iconName = 'cash';
                                        iconColor = '#8B5CF6';
                                    } else if (tx.type === 'crypto_gas') {
                                        iconName = 'flame';
                                        iconColor = '#EC4899';
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
                                                    {tx.type ? tx.type.replace('_', ' ').toUpperCase() : 'CRYPTO TRANSACTION'}
                                                </Text>
                                                <Text style={s.historyDesc} numberOfLines={1}>
                                                    {tx.description || tx.reference || 'Blockchain Transfer'}
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: C.emerald }]} />
                                <Text style={s.modalTitle}>Deposit Crypto (NOWPayments)</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Asset Selection Carousel */}
                            <Text style={s.fieldLabel}>SELECT ASSET:</Text>
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
                            <Text style={s.fieldLabel}>BLOCKCHAIN NETWORK:</Text>
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
                                        <ActivityIndicator size="large" color={C.gold} />
                                        <Text style={s.qrLoadingText}>Requesting live address from NOWPayments...</Text>
                                    </View>
                                ) : (
                                    <View style={s.qrInner}>
                                        <SafeQRCode value={depositAddress} size={150} />
                                        <Text style={s.qrScanPrompt}>Scan QR to Pay with any Crypto Wallet</Text>
                                    </View>
                                )}
                            </View>

                            {/* DEPOSIT ADDRESS BOX */}
                            <Text style={s.fieldLabel}>DEPOSIT ADDRESS ({depositAsset}):</Text>
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
                                        color={depositCopied ? C.emerald : C.white} 
                                    />
                                    <Text style={[s.copyMiniButtonText, depositCopied && { color: C.emerald }]}>
                                        {depositCopied ? 'Copied' : 'Copy'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Security Notice */}
                            <View style={s.depositWarning}>
                                <Ionicons name="information-circle" size={14} color={C.gold} style={{ marginRight: 6 }} />
                                <Text style={s.depositWarningText}>
                                    Send only {depositAsset} via {SUPPORTED_ASSETS.find(a => a.symbol === depositAsset)?.networks[depositNetworkIdx]?.label}. 
                                    Minimum: {SUPPORTED_ASSETS.find(a => a.symbol === depositAsset)?.networks[depositNetworkIdx]?.minDeposit}. 
                                    Credits automatically after 1 blockchain confirmation via NOWPayments IPN.
                                </Text>
                            </View>

                            {/* Action Buttons */}
                            <View style={s.modalButtonsRow}>
                                <TouchableOpacity 
                                    onPress={handleShareAddress} 
                                    style={s.shareAddressBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="share-social-outline" size={16} color={C.white} style={{ marginRight: 6 }} />
                                    <Text style={s.shareAddressBtnText}>Share Address</Text>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: C.gold }]} />
                                <Text style={s.modalTitle}>Withdraw Crypto (Payout)</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Asset Selection */}
                            <Text style={s.fieldLabel}>WITHDRAW ASSET:</Text>
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
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={s.fieldLabel}>RECIPIENT ADDRESS:</Text>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setAddressPickerTarget('withdraw');
                                        setActiveModal('addressPicker');
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}
                                >
                                    <Ionicons name="book-outline" size={12} color={C.gold} />
                                    <Text style={{ color: C.gold, fontSize: 9.5, fontWeight: '800' }}>Pick from Whitelist</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={withdrawAddress}
                                    onChangeText={setWithdrawAddress}
                                    placeholder="Paste destination wallet address..."
                                    placeholderTextColor={C.slate500}
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
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>{withdrawAsset}</Text>
                            </View>

                            {/* Valuation breakdown */}
                            <View style={s.withdrawEstimateBox}>
                                <View style={s.withdrawEstimateRow}>
                                    <Text style={s.withdrawEstimateLabel}>USD Value</Text>
                                    <Text style={s.withdrawEstimateValue}>
                                        ≈ ${(parseFloat(withdrawAmount || '0') * getAssetPriceUsd(withdrawAsset)).toFixed(2)} USD
                                    </Text>
                                </View>
                                <View style={s.withdrawEstimateRow}>
                                    <Text style={s.withdrawEstimateLabel}>NOWPayments Payout Gateway</Text>
                                    <Text style={[s.withdrawEstimateValue, { color: C.emerald }]}>Automated API</Text>
                                </View>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={initiateWithdrawal}
                                disabled={withdrawing}
                                style={s.primaryModalSubmit}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#F5A623', '#D97706']}
                                    style={s.primaryModalGradient}
                                >
                                    {withdrawing ? (
                                        <ActivityIndicator color="#040814" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="lock-closed" size={15} color="#040814" style={{ marginRight: 6 }} />
                                            <Text style={s.primaryModalText}>Authorize & Dispatch Payout</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 3: INSTANT P2P INTERNAL TRANSFER (0 GAS FEE)
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'transfer'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: C.cyan }]} />
                                <Text style={s.modalTitle}>Internal P2P Transfer (0 Fees)</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Zero Fee Ribbon */}
                            <View style={s.zeroFeeTransferRibbon}>
                                <Ionicons name="shield-checkmark" size={14} color={C.cyan} />
                                <Text style={s.zeroFeeTransferRibbonText}>0.00 Gas Fee • Instant Abu Mafhal Off-Chain Network</Text>
                            </View>

                            <Text style={s.fieldLabel}>1. SELECT CRYPTO TO SEND:</Text>
                            <View style={s.networkOptionsRow}>
                                {['USDT', 'BTC', 'ETH', 'SOL'].map(sym => (
                                    <TouchableOpacity
                                        key={sym}
                                        onPress={() => setTransferAsset(sym)}
                                        style={[s.networkChip, transferAsset === sym && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, transferAsset === sym && s.networkChipTextActive]}>
                                            {sym}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={s.fieldLabel}>2. RECIPIENT PHONE / USERNAME / ID:</Text>
                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={transferRecipientInput}
                                    onChangeText={(val) => {
                                        setTransferRecipientInput(val);
                                        resolveInternalRecipient(val);
                                    }}
                                    placeholder="Enter recipient's phone number or username..."
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                                {transferResolving && (
                                    <ActivityIndicator size="small" color={C.gold} style={{ marginRight: 6 }} />
                                )}
                            </View>

                            {/* Recipient Verification Card */}
                            {transferResolvedRecipient && (
                                <View style={s.recipientVerifiedCard}>
                                    <Ionicons name="checkmark-circle" size={18} color={C.emerald} />
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={s.recipientVerifiedName}>
                                            {transferResolvedRecipient.full_name || 'Verified Abu Mafhal User'}
                                        </Text>
                                        <Text style={s.recipientVerifiedPhone}>
                                            {transferResolvedRecipient.phone || transferResolvedRecipient.username || transferResolvedRecipient.id.slice(0, 12)}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Amount */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                                <Text style={s.fieldLabel}>3. AMOUNT ({transferAsset}):</Text>
                                <TouchableOpacity 
                                    onPress={() => setTransferAmount((cryptoBalances[transferAsset] || 0).toString())}
                                    style={s.maxPill}
                                >
                                    <Text style={s.maxPillText}>MAX: {(cryptoBalances[transferAsset] || 0).toFixed(4)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={transferAmount}
                                    onChangeText={setTransferAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>{transferAsset}</Text>
                            </View>

                            <View style={s.tradeSummaryBox}>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Network Fee</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.emerald }]}>FREE (₦0.00)</Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Estimated USD Value</Text>
                                    <Text style={s.tradeSummaryValue}>
                                        ≈ ${(parseFloat(transferAmount || '0') * getAssetPriceUsd(transferAsset)).toFixed(2)} USD
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={initiateInternalTransfer}
                                disabled={transferring || !transferResolvedRecipient}
                                style={s.primaryModalSubmit}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={['#06B6D4', '#0891B2']} style={s.primaryModalGradient}>
                                    {transferring ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="paper-plane" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={[s.primaryModalText, { color: '#FFFFFF' }]}>Confirm Instant Transfer</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 4: BUY CRYPTO WITH NAIRA WALLET
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'buy'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: '#3B82F6' }]} />
                                <Text style={s.modalTitle}>Buy Crypto with Naira Wallet</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={s.fiatBalanceCard}>
                                <Text style={s.fiatBalanceLabel}>Available Naira Balance:</Text>
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

                            <Text style={s.fieldLabel}>NAIRA AMOUNT TO SPEND (₦):</Text>
                            <View style={s.modalInputWrap}>
                                <Text style={s.nairaPrefix}>₦</Text>
                                <TextInput
                                    value={buyNgnAmount}
                                    onChangeText={setBuyNgnAmount}
                                    keyboardType="numeric"
                                    placeholder="10,000"
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                            </View>

                            <View style={s.presetButtonsRow}>
                                {['5000', '10000', '25000', '50000', '100000'].map(amt => (
                                    <TouchableOpacity
                                        key={amt}
                                        onPress={() => setBuyNgnAmount(amt)}
                                        style={[s.presetPill, buyNgnAmount === amt && s.presetPillActive]}
                                    >
                                        <Text style={[s.presetPillText, buyNgnAmount === amt && s.presetPillTextActive]}>
                                            ₦{(Number(amt) / 1000).toFixed(0)}k
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={s.tradeSummaryBox}>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Live Buy Rate</Text>
                                    <Text style={s.tradeSummaryValue}>1 USDT ≈ ₦{getUsdtToNgnRate('buy')}</Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>You Will Receive</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.emerald, fontWeight: '900', fontSize: 13 }]}>
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
                                <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={s.primaryModalGradient}>
                                    {buying ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={[s.primaryModalText, { color: '#FFFFFF' }]}>Confirm & Buy Crypto</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 5: SELL CRYPTO TO NAIRA WALLET
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'sell'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: '#8B5CF6' }]} />
                                <Text style={s.modalTitle}>Sell Crypto for Instant Naira</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
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
                                <Text style={s.fieldLabel}>AMOUNT OF {sellAsset} TO SELL:</Text>
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
                                    placeholderTextColor={C.slate500}
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
                                    <Text style={s.tradeSummaryLabel}>Naira Credited Instantly</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.emerald, fontWeight: '900', fontSize: 14 }]}>
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
                                <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={s.primaryModalGradient}>
                                    {selling ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="cash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={[s.primaryModalText, { color: '#FFFFFF' }]}>Confirm & Sell to Naira</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 6: ADDRESS BOOK (WHITELISTED WALLETS)
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'addressBook'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: C.gold }]} />
                                <Text style={s.modalTitle}>Whitelisted Address Book</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Add New Address Form */}
                            <Text style={s.fieldLabel}>ADD NEW WALLET TO WHITELIST:</Text>
                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={newWalletNickname}
                                    onChangeText={setNewWalletNickname}
                                    placeholder="Nickname (e.g. Binance USDT TRC20)..."
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={newWalletAddress}
                                    onChangeText={setNewWalletAddress}
                                    placeholder="Paste destination wallet address..."
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                            </View>

                            <TouchableOpacity 
                                onPress={handleSaveNewWallet}
                                style={s.addAddressBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add-circle" size={16} color={C.navyDark} style={{ marginRight: 4 }} />
                                <Text style={s.addAddressBtnText}>Save Address to Book</Text>
                            </TouchableOpacity>

                            {/* Saved List */}
                            <Text style={[s.fieldLabel, { marginTop: 14 }]}>SAVED WHITELISTED WALLETS:</Text>
                            {savedWallets.length === 0 ? (
                                <Text style={{ color: C.slate500, fontSize: 11, fontStyle: 'italic', marginVertical: 8 }}>
                                    No saved addresses yet. Save addresses above for 1-tap withdrawals.
                                </Text>
                            ) : (
                                savedWallets.map(w => (
                                    <View key={w.id} style={s.savedWalletRow}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <Text style={s.savedWalletNickname}>{w.nickname}</Text>
                                            <Text style={s.savedWalletAddress} numberOfLines={1}>{w.address}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    setWithdrawAddress(w.address);
                                                    setActiveModal('withdraw');
                                                }}
                                                style={s.useWalletBtn}
                                            >
                                                <Text style={s.useWalletBtnText}>Use</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => handleDeleteSavedWallet(w.id)}
                                                style={s.deleteWalletBtn}
                                            >
                                                <Ionicons name="trash-outline" size={14} color={C.rose} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 7: QUICK ADDRESS PICKER FOR WITHDRAW / GAS
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'addressPicker'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="bookmarks" size={16} color={C.gold} />
                                <Text style={s.modalTitle}>Select from Whitelist</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {savedWallets.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: C.slate400, fontSize: 11, textAlign: 'center' }}>
                                        No addresses saved in your whitelist yet.
                                    </Text>
                                    <TouchableOpacity 
                                        onPress={() => setActiveModal('addressBook')}
                                        style={[s.useWalletBtn, { marginTop: 10 }]}
                                    >
                                        <Text style={s.useWalletBtnText}>Open Address Book</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                savedWallets.map(w => (
                                    <TouchableOpacity
                                        key={w.id}
                                        style={s.pickerRow}
                                        onPress={() => {
                                            if (addressPickerTarget === 'withdraw') {
                                                setWithdrawAddress(w.address);
                                                setActiveModal('withdraw');
                                            } else {
                                                setGasWalletAddress(w.address);
                                                setActiveModal(null);
                                            }
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.savedWalletNickname}>{w.nickname}</Text>
                                            <Text style={s.savedWalletAddress} numberOfLines={1}>{w.address}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={C.gold} />
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 8: SET PRICE ALERT
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'priceAlert'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: C.gold }]} />
                                <Text style={s.modalTitle}>Set Custom Price Alert 🔔</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={s.fieldLabel}>SELECT CRYPTO ASSET:</Text>
                            <View style={s.networkOptionsRow}>
                                {['BTC', 'ETH', 'SOL', 'USDT'].map(sym => (
                                    <TouchableOpacity
                                        key={sym}
                                        onPress={() => setAlertAsset(sym)}
                                        style={[s.networkChip, alertAsset === sym && s.networkChipActive]}
                                    >
                                        <Text style={[s.networkChipText, alertAsset === sym && s.networkChipTextActive]}>
                                            {sym}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={s.fieldLabel}>CONDITION:</Text>
                            <View style={s.networkOptionsRow}>
                                <TouchableOpacity
                                    onPress={() => setAlertCondition('above')}
                                    style={[s.networkChip, alertCondition === 'above' && s.networkChipActive]}
                                >
                                    <Text style={[s.networkChipText, alertCondition === 'above' && s.networkChipTextActive]}>
                                        Rises Above (≥)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setAlertCondition('below')}
                                    style={[s.networkChip, alertCondition === 'below' && s.networkChipActive]}
                                >
                                    <Text style={[s.networkChipText, alertCondition === 'below' && s.networkChipTextActive]}>
                                        Drops Below (≤)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={s.fieldLabel}>TARGET PRICE (USD $):</Text>
                            <View style={s.modalInputWrap}>
                                <Text style={s.nairaPrefix}>$</Text>
                                <TextInput
                                    value={alertTargetPrice}
                                    onChangeText={setAlertTargetPrice}
                                    keyboardType="numeric"
                                    placeholder="85,000"
                                    placeholderTextColor={C.slate500}
                                    style={s.modalTextInput}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleCreateAlert}
                                style={s.primaryModalSubmit}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={['#F5A623', '#D97706']} style={s.primaryModalGradient}>
                                    <Ionicons name="notifications" size={16} color="#040814" style={{ marginRight: 6 }} />
                                    <Text style={s.primaryModalText}>Activate Price Alert</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 9: OFFICIAL BLOCKCHAIN TRANSACTION RECEIPT
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'txReceipt'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[s.modalDot, { backgroundColor: C.emerald }]} />
                                <Text style={s.modalTitle}>Official Transaction Receipt</Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={16} color={C.slate400} />
                            </TouchableOpacity>
                        </View>

                        {selectedTx ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={s.receiptHeaderBadge}>
                                    <Ionicons name="shield-checkmark" size={28} color={C.emerald} />
                                    <Text style={s.receiptStatusLabel}>{selectedTx.status?.toUpperCase() || 'SUCCESS'}</Text>
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
                                        <Text style={s.receiptRowLabel}>Timestamp</Text>
                                        <Text style={s.receiptRowVal}>{selectedTx.created_at ? new Date(selectedTx.created_at).toLocaleString() : '-'}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptRowLabel}>Payment Gateway</Text>
                                        <Text style={[s.receiptRowVal, { color: C.gold }]}>NOWPayments Blockchain Engine</Text>
                                    </View>
                                </View>

                                <View style={s.modalButtonsRow}>
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            try {
                                                await Share.share({
                                                    message: `ABU MAFHAL SUB Transaction Receipt:\nType: ${selectedTx.type}\nAmount: ₦${selectedTx.amount}\nStatus: ${selectedTx.status}\nRef: ${selectedTx.reference || selectedTx.id}`
                                                });
                                            } catch {}
                                        }} 
                                        style={s.shareAddressBtn}
                                    >
                                        <Ionicons name="share-social-outline" size={15} color={C.white} style={{ marginRight: 4 }} />
                                        <Text style={s.shareAddressBtnText}>Share Receipt</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => setActiveModal(null)} 
                                        style={s.doneBtn}
                                    >
                                        <Text style={s.doneBtnText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
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

// ─── 100% Native StyleSheet (Guaranteed Zero CSS Failure on Play Store) ─────────
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.navyBg,
    },
    webContainer: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 720,
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        borderBottomWidth: 1,
        borderColor: C.borderSubtle,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleWrap: {
        alignItems: 'center',
    },
    headerTitle: {
        color: C.white,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    nowPaymentsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 2,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    greenLivePulse: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.emerald,
        marginRight: 4,
    },
    nowPaymentsBadgeText: {
        color: C.gold,
        fontSize: 8.5,
        fontWeight: '800',
    },
    headerActionsRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tickerRibbon: {
        gap: 8,
        paddingVertical: 8,
    },
    tickerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    tickerSymbol: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
    },
    tickerPrice: {
        color: C.white,
        fontSize: 10,
        fontWeight: '700',
    },
    tickerChg: {
        fontSize: 9,
        fontWeight: '800',
    },
    heroCard: {
        backgroundColor: C.navyCard,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1.5,
        borderColor: C.navyBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    heroSub: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    currencyTogglePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
        gap: 3,
    },
    currencyToggleText: {
        color: C.gold,
        fontSize: 9,
        fontWeight: '900',
    },
    heroMainBalance: {
        color: C.white,
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 2,
    },
    heroNgnValue: {
        color: C.gold,
        fontSize: 12,
        fontWeight: '800',
        marginTop: 1,
    },
    eyeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    allocationBarContainer: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    allocationProgressBar: {
        height: 6,
        borderRadius: 3,
        flexDirection: 'row',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    allocationProgressSegment: {
        height: '100%',
    },
    allocationLegendRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    allocationLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    allocationLegendDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    allocationLegendSymbol: {
        color: C.slate300,
        fontSize: 9,
        fontWeight: '700',
    },
    allocationLegendPercent: {
        color: C.slate400,
        fontSize: 8.5,
        fontWeight: '600',
    },
    heroVaultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    fiatVaultPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.08)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)',
    },
    fiatVaultText: {
        color: C.slate300,
        fontSize: 10,
        fontWeight: '600',
    },
    addressBookPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    addressBookPillText: {
        color: C.slate300,
        fontSize: 9.5,
        fontWeight: '700',
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        gap: 4,
    },
    actionButton: {
        flex: 1,
        alignItems: 'center',
    },
    actionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    actionText: {
        color: C.white,
        fontSize: 8.5,
        fontWeight: '800',
    },
    tabBarContainer: {
        flexDirection: 'row',
        backgroundColor: C.navyCard,
        marginHorizontal: 14,
        marginTop: 10,
        marginBottom: 8,
        borderRadius: 14,
        padding: 3,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        borderRadius: 11,
    },
    tabItemActive: {
        backgroundColor: C.gold,
    },
    tabItemText: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '700',
    },
    tabItemTextActive: {
        color: C.navyDark,
        fontWeight: '900',
    },
    mainScroll: {
        flex: 1,
    },
    mainScrollContent: {
        paddingHorizontal: 14,
        paddingBottom: 40,
    },
    marketLeaderCard: {
        backgroundColor: C.navyCard,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.navyBorder,
    },
    marketLeaderIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    marketLeaderSub: {
        color: C.slate400,
        fontSize: 8.5,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    marketLeaderTitle: {
        color: C.white,
        fontSize: 12,
        fontWeight: '900',
    },
    marketLeaderPrice: {
        color: C.white,
        fontSize: 13,
        fontWeight: '900',
    },
    marketLeaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    marketLeaderChange: {
        color: C.emerald,
        fontSize: 9.5,
        fontWeight: '800',
    },
    sectionHeaderRow: {
        marginBottom: 8,
    },
    sectionTitle: {
        color: C.white,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    sectionSub: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '500',
    },
    assetCardsGrid: {
        gap: 8,
    },
    assetCard: {
        backgroundColor: C.navyCard,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    assetCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    assetIdentity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    assetLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.slate800,
    },
    assetSymbol: {
        color: C.white,
        fontSize: 13,
        fontWeight: '900',
    },
    assetName: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '600',
    },
    sparklineContainer: {
        width: 50,
        height: 24,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
    },
    sparklineBar: {
        width: 5,
        borderRadius: 2.5,
    },
    assetBalanceText: {
        color: C.white,
        fontSize: 13,
        fontWeight: '900',
    },
    assetValuationText: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '700',
        marginTop: 1,
    },
    assetCardDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        marginVertical: 8,
    },
    assetCardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    assetPriceText: {
        color: C.slate300,
        fontSize: 11,
        fontWeight: '800',
        marginRight: 6,
    },
    percentPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        gap: 2,
    },
    percentPillPositive: {
        backgroundColor: C.emeraldBg,
    },
    percentPillNegative: {
        backgroundColor: C.roseBg,
    },
    percentText: {
        fontSize: 9,
        fontWeight: '800',
    },
    quickDepositLink: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    quickDepositLinkText: {
        color: C.gold,
        fontSize: 9.5,
        fontWeight: '800',
    },
    // Sub-segment Dock for Trade Tab
    tradeSubDock: {
        flexDirection: 'row',
        backgroundColor: C.navyElevated,
        borderRadius: 12,
        padding: 3,
        marginBottom: 10,
        gap: 4,
    },
    tradeSubPill: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 9,
    },
    tradeSubPillActive: {
        backgroundColor: C.navyCard,
        borderWidth: 1,
        borderColor: C.gold,
    },
    tradeSubPillText: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '700',
    },
    tradeSubPillTextActive: {
        color: C.gold,
        fontWeight: '900',
    },
    swapContainer: {
        marginTop: 4,
    },
    swapCard: {
        backgroundColor: C.navyCard,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: C.navyBorder,
    },
    swapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    swapIndicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: C.gold,
    },
    swapTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: '900',
    },
    zeroFeeBadge: {
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
    },
    zeroFeeBadgeText: {
        color: C.emerald,
        fontSize: 9.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    swapSubtitle: {
        color: C.slate400,
        fontSize: 10,
        marginBottom: 14,
    },
    swapInputBox: {
        backgroundColor: C.navyElevated,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    swapBoxHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    swapBoxLabel: {
        color: C.slate400,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    maxPill: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    maxPillText: {
        color: C.gold,
        fontSize: 9,
        fontWeight: '800',
    },
    swapInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    swapAmountInput: {
        flex: 1,
        color: C.white,
        fontSize: 18,
        fontWeight: '900',
        marginRight: 10,
    },
    swapCalculatedOutput: {
        flex: 1,
        color: C.gold,
        fontSize: 18,
        fontWeight: '900',
        marginRight: 10,
    },
    liveRateQuoteText: {
        color: C.slate400,
        fontSize: 9,
        fontWeight: '700',
    },
    assetSelectorRow: {
        flexDirection: 'row',
        gap: 4,
    },
    assetChip: {
        backgroundColor: C.navyDark,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    assetChipActive: {
        backgroundColor: C.gold,
        borderColor: C.gold,
    },
    assetChipText: {
        color: C.slate300,
        fontSize: 9.5,
        fontWeight: '800',
    },
    assetChipTextActive: {
        color: C.navyDark,
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
        backgroundColor: C.navyDark,
        borderWidth: 2,
        borderColor: C.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swapGuarantees: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        padding: 10,
        marginTop: 12,
        marginBottom: 14,
        gap: 6,
    },
    guaranteeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    guaranteeLabel: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '600',
    },
    guaranteeValue: {
        color: C.white,
        fontSize: 10,
        fontWeight: '800',
    },
    swapSubmitButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    swapSubmitGradient: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    swapSubmitText: {
        color: '#040814',
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    // Converter Styles
    converterBaseSwitchRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    converterBasePill: {
        flex: 1,
        backgroundColor: C.navyElevated,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    converterBasePillActive: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        borderColor: C.gold,
    },
    converterBasePillText: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '700',
    },
    converterBasePillTextActive: {
        color: C.gold,
        fontWeight: '900',
    },
    converterResultsBox: {
        backgroundColor: C.navyElevated,
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        gap: 8,
    },
    converterResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    converterResultLabel: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '600',
    },
    converterResultVal: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: '800',
    },
    // Gas Station & Radar
    gasContainer: {
        gap: 12,
    },
    gasBannerCard: {
        backgroundColor: C.navyCard,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#EC4899',
    },
    gasIconWrapper: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#EC4899',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gasBannerTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: '900',
    },
    gasBannerSub: {
        color: C.slate400,
        fontSize: 10,
        marginTop: 2,
        lineHeight: 14,
    },
    gasAssetOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    gasAssetCard: {
        width: '48%',
        backgroundColor: C.navyCard,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    gasAssetCardActive: {
        borderColor: '#EC4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
    },
    gasAssetId: {
        color: C.white,
        fontSize: 13,
        fontWeight: '900',
    },
    gasAssetIdActive: {
        color: '#EC4899',
    },
    gasAssetName: {
        color: C.slate300,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    gasAssetPurpose: {
        color: C.slate500,
        fontSize: 8.5,
        marginTop: 3,
    },
    gasPresetsList: {
        gap: 6,
    },
    gasPresetItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.navyCard,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    gasPresetItemActive: {
        borderColor: '#EC4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
    },
    gasPresetTitle: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: '800',
    },
    gasPresetSub: {
        color: C.slate400,
        fontSize: 9.5,
        marginTop: 1,
    },
    gasPresetCost: {
        color: C.gold,
        fontSize: 12.5,
        fontWeight: '900',
    },
    gasPayMethodRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    gasPayMethodPill: {
        flex: 1,
        backgroundColor: C.navyCard,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        alignItems: 'center',
    },
    gasPayMethodPillActive: {
        borderColor: C.gold,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
    },
    gasPayMethodText: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '700',
        textAlign: 'center',
    },
    gasPayMethodTextActive: {
        color: C.gold,
        fontWeight: '900',
    },
    // Radar Styles
    radarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    radarIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radarNetName: {
        color: C.white,
        fontSize: 12,
        fontWeight: '800',
    },
    radarSpeedText: {
        color: C.slate400,
        fontSize: 9,
        marginTop: 1,
    },
    radarCostText: {
        color: C.gold,
        fontSize: 12,
        fontWeight: '900',
    },
    radarStatusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        marginTop: 2,
    },
    radarStatusText: {
        fontSize: 8.5,
        fontWeight: '800',
    },
    // Markets Styles
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.navyCard,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        color: C.white,
        fontSize: 12,
        marginLeft: 8,
        fontWeight: '600',
    },
    marketFiltersRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    marketFilterChip: {
        backgroundColor: C.navyElevated,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    marketFilterChipActive: {
        backgroundColor: 'rgba(245, 166, 35, 0.18)',
        borderColor: C.gold,
    },
    marketFilterChipText: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '700',
    },
    marketFilterChipTextActive: {
        color: C.gold,
        fontWeight: '900',
    },
    marketsTableCard: {
        backgroundColor: C.navyCard,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        overflow: 'hidden',
    },
    marketRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    marketRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    marketRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    marketCoinIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.slate800,
    },
    marketCoinFallback: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.slate800,
        alignItems: 'center',
        justifyContent: 'center',
    },
    marketCoinFallbackText: {
        color: C.gold,
        fontWeight: '900',
        fontSize: 12,
    },
    marketCoinName: {
        color: C.white,
        fontSize: 12.5,
        fontWeight: '800',
    },
    marketCoinSymbol: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '700',
    },
    marketRowRight: {
        alignItems: 'flex-end',
    },
    marketPriceText: {
        color: C.white,
        fontSize: 12.5,
        fontWeight: '800',
    },
    marketPercentPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
        gap: 2,
    },
    // History Styles
    historyFiltersRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    historyFilterPill: {
        backgroundColor: C.navyElevated,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    historyFilterPillActive: {
        backgroundColor: C.gold,
        borderColor: C.gold,
    },
    historyFilterPillText: {
        color: C.slate400,
        fontSize: 9.5,
        fontWeight: '800',
    },
    historyFilterPillTextActive: {
        color: C.navyDark,
        fontWeight: '900',
    },
    emptyHistoryCard: {
        backgroundColor: C.navyCard,
        borderRadius: 18,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    emptyHistoryTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: '800',
        marginTop: 10,
    },
    emptyHistorySub: {
        color: C.slate400,
        fontSize: 10.5,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 15,
    },
    historyListCard: {
        backgroundColor: C.navyCard,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.borderSubtle,
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
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    historyIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyTypeTitle: {
        color: C.white,
        fontSize: 11,
        fontWeight: '800',
    },
    historyDesc: {
        color: C.slate400,
        fontSize: 9.5,
        marginTop: 1,
    },
    historyDate: {
        color: C.slate500,
        fontSize: 8.5,
        marginTop: 2,
    },
    historyAmountText: {
        color: C.white,
        fontSize: 12,
        fontWeight: '900',
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 3,
    },
    statusPillSuccess: {
        backgroundColor: C.emeraldBg,
    },
    statusPillPending: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
    },
    statusPillFailed: {
        backgroundColor: C.roseBg,
    },
    statusPillText: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(4, 8, 20, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        backgroundColor: C.navyCard,
        borderRadius: 22,
        padding: 18,
        width: '100%',
        maxWidth: 390,
        borderWidth: 1.5,
        borderColor: C.navyBorder,
        maxHeight: '90%',
    },
    webModalCard: {
        maxWidth: 430,
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
    modalDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    modalTitle: {
        color: C.white,
        fontSize: 13.5,
        fontWeight: '900',
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldLabel: {
        color: C.slate400,
        fontSize: 9,
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
        backgroundColor: C.navyElevated,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        gap: 6,
    },
    modalAssetChipActive: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        borderColor: C.gold,
    },
    modalAssetIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    modalAssetText: {
        color: C.slate300,
        fontSize: 10.5,
        fontWeight: '800',
    },
    modalAssetTextActive: {
        color: C.gold,
    },
    networkOptionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    networkChip: {
        backgroundColor: C.navyElevated,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    networkChipActive: {
        backgroundColor: C.gold,
        borderColor: C.gold,
    },
    networkChipText: {
        color: C.slate300,
        fontSize: 9.5,
        fontWeight: '700',
    },
    networkChipTextActive: {
        color: C.navyDark,
        fontWeight: '900',
    },
    qrBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    qrLoadingBox: {
        width: 160,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    qrLoadingText: {
        color: C.navyDark,
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
    },
    qrInner: {
        alignItems: 'center',
    },
    qrScanPrompt: {
        color: '#040814',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    addressCopyBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.navyElevated,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 10,
    },
    addressText: {
        color: C.white,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 10,
        flex: 1,
        marginRight: 8,
        fontWeight: '600',
    },
    copyMiniButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    copyMiniButtonActive: {
        backgroundColor: C.emeraldBg,
    },
    copyMiniButtonText: {
        color: C.white,
        fontSize: 9.5,
        fontWeight: '800',
    },
    depositWarning: {
        flexDirection: 'row',
        backgroundColor: 'rgba(245, 166, 35, 0.08)',
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)',
        marginBottom: 14,
    },
    depositWarningText: {
        color: C.goldLight,
        fontSize: 9,
        lineHeight: 13,
        flex: 1,
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
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        height: 42,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    shareAddressBtnText: {
        color: C.white,
        fontSize: 11,
        fontWeight: '800',
    },
    doneBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.gold,
        borderRadius: 12,
        height: 42,
    },
    doneBtnText: {
        color: C.navyDark,
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    modalInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.navyElevated,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 8,
    },
    modalTextInput: {
        flex: 1,
        color: C.white,
        fontSize: 12,
        fontWeight: '700',
    },
    pastePill: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    pastePillText: {
        color: C.gold,
        fontSize: 9.5,
        fontWeight: '800',
    },
    inputCurrencySuffix: {
        color: C.gold,
        fontSize: 11,
        fontWeight: '900',
    },
    withdrawEstimateBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 10,
        padding: 10,
        marginTop: 6,
        marginBottom: 14,
        gap: 4,
    },
    withdrawEstimateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    withdrawEstimateLabel: {
        color: C.slate400,
        fontSize: 9.5,
    },
    withdrawEstimateValue: {
        color: C.white,
        fontSize: 9.5,
        fontWeight: '800',
    },
    primaryModalSubmit: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    primaryModalGradient: {
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryModalText: {
        color: C.navyDark,
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    fiatBalanceCard: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.25)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fiatBalanceLabel: {
        color: C.slate300,
        fontSize: 10,
        fontWeight: '700',
    },
    fiatBalanceAmount: {
        color: C.white,
        fontSize: 14,
        fontWeight: '900',
    },
    nairaPrefix: {
        color: C.gold,
        fontSize: 14,
        fontWeight: '900',
        marginRight: 6,
    },
    presetButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    presetPill: {
        backgroundColor: C.navyElevated,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    presetPillActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3B82F6',
    },
    presetPillText: {
        color: C.slate300,
        fontSize: 9.5,
        fontWeight: '800',
    },
    presetPillTextActive: {
        color: '#60A5FA',
    },
    tradeSummaryBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 14,
        gap: 6,
    },
    tradeSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tradeSummaryLabel: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '600',
    },
    tradeSummaryValue: {
        color: C.white,
        fontSize: 10.5,
        fontWeight: '800',
    },
    // Transfer Modal
    zeroFeeTransferRibbon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.3)',
        borderRadius: 10,
        padding: 8,
        gap: 6,
        marginBottom: 12,
    },
    zeroFeeTransferRibbonText: {
        color: C.cyan,
        fontSize: 9.5,
        fontWeight: '800',
        flex: 1,
    },
    recipientVerifiedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        borderRadius: 10,
        padding: 8,
        marginBottom: 10,
    },
    recipientVerifiedName: {
        color: C.white,
        fontSize: 11,
        fontWeight: '800',
    },
    recipientVerifiedPhone: {
        color: C.emerald,
        fontSize: 9.5,
        fontWeight: '700',
    },
    // Address Book Styles
    addAddressBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.gold,
        borderRadius: 10,
        height: 38,
        marginTop: 4,
    },
    addAddressBtnText: {
        color: C.navyDark,
        fontSize: 11,
        fontWeight: '900',
    },
    savedWalletRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.navyElevated,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 6,
    },
    savedWalletNickname: {
        color: C.white,
        fontSize: 11,
        fontWeight: '800',
    },
    savedWalletAddress: {
        color: C.slate400,
        fontSize: 9,
        marginTop: 2,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    useWalletBtn: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    useWalletBtnText: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
    },
    deleteWalletBtn: {
        backgroundColor: C.roseBg,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
    },
    pickerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.navyElevated,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 8,
    },
    // Receipt Modal Styles
    receiptHeaderBadge: {
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        marginBottom: 14,
    },
    receiptStatusLabel: {
        color: C.emerald,
        fontSize: 11,
        fontWeight: '900',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    receiptMainAmount: {
        color: C.white,
        fontSize: 22,
        fontWeight: '900',
        marginTop: 4,
    },
    receiptType: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
        marginTop: 2,
    },
    receiptDetailsTable: {
        backgroundColor: C.navyElevated,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 14,
        gap: 8,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    receiptRowLabel: {
        color: C.slate400,
        fontSize: 10,
        fontWeight: '600',
    },
    receiptRowVal: {
        color: C.white,
        fontSize: 10.5,
        fontWeight: '800',
        textAlign: 'right',
        flexShrink: 1,
        marginLeft: 10,
    },
});
