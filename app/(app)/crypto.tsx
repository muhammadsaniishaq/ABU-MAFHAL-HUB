import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Image, 
    ActivityIndicator, Alert, Modal, TextInput, Platform, 
    StyleSheet, RefreshControl, Share, KeyboardAvoidingView,
    Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { shareCryptoReceiptPdf, saveCryptoReceiptPdf } from '../../services/receiptGenerator';

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
    cyan: '#0891B2',
    cyanBg: '#ECFEFF',
    white: '#FFFFFF',
    inputBg: '#F1F5F9',
};

// Storage Keys
const SAVED_WALLETS_KEY = '@crypto_saved_wallets_v3';
const PRICE_ALERTS_KEY = '@crypto_price_alerts_v3';
const FAVORITES_KEY = '@crypto_favorites_v3';

export interface PriceAlertItem {
    id: string;
    asset: string;
    targetPrice: number;
    condition: 'above' | 'below';
    createdAt: string;
}

// ─── Supported Assets & NOWPayments Network Mappings ───────────────────────────
interface AssetConfig {
    symbol: string;
    name: string;
    icon: string;
    defaultRateUsd: number;
    networks: { label: string; network: string; currency: string; minDeposit: string; explorer: string }[];
}

const SUPPORTED_ASSETS: AssetConfig[] = [
    {
        symbol: 'USDT',
        name: 'Tether USD',
        icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        defaultRateUsd: 1.00,
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
        defaultRateUsd: 87500,
        networks: [
            { label: 'Bitcoin Mainnet', network: 'BTC', currency: 'btc', minDeposit: '0.0002 BTC', explorer: 'https://mempool.space/tx/' }
        ]
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        defaultRateUsd: 3100,
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
        defaultRateUsd: 185,
        networks: [
            { label: 'Solana Mainnet', network: 'SOL', currency: 'sol', minDeposit: '0.05 SOL', explorer: 'https://solscan.io/tx/' }
        ]
    },
    {
        symbol: 'TRX',
        name: 'Tron',
        icon: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
        defaultRateUsd: 0.22,
        networks: [
            { label: 'TRON (TRC20)', network: 'TRX', currency: 'trx', minDeposit: '20 TRX', explorer: 'https://tronscan.org/#/transaction/' }
        ]
    },
    {
        symbol: 'BNB',
        name: 'BNB Chain',
        icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        defaultRateUsd: 620,
        networks: [
            { label: 'BNB Smart Chain (BEP20)', network: 'BEP20', currency: 'bnbbsc', minDeposit: '0.01 BNB', explorer: 'https://bscscan.com/tx/' }
        ]
    },
    {
        symbol: 'TON',
        name: 'Toncoin',
        icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png',
        defaultRateUsd: 5.40,
        networks: [
            { label: 'The Open Network (TON)', network: 'TON', currency: 'ton', minDeposit: '1 TON', explorer: 'https://tonviewer.com/transaction/' }
        ]
    },
    {
        symbol: 'DOGE',
        name: 'Dogecoin',
        icon: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
        defaultRateUsd: 0.16,
        networks: [
            { label: 'Dogecoin Network', network: 'DOGE', currency: 'doge', minDeposit: '15 DOGE', explorer: 'https://dogechain.info/tx/' }
        ]
    }
];

// ─── Supported Gas Networks & Live Radar Configuration ───────────────────────────
export interface GasNetworkOption {
    id: string;
    name: string;
    symbol: string;
    networkName: string;
    icon: string;
    currency: string;
    recommendedSingle: number;
    recommendedMedium: number;
    recommendedPro: number;
    speed: string;
    trafficStatus: 'optimal' | 'moderate' | 'congested';
    explorerTx: string;
    explorerAddress: string;
    placeholderAddress: string;
    prefixValidate: (addr: string) => boolean;
}

export const GAS_NETWORKS: GasNetworkOption[] = [
    {
        id: 'trx',
        name: 'TRON Energy & Bandwidth',
        symbol: 'TRX',
        networkName: 'TRON (TRC20)',
        icon: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
        currency: 'trx',
        recommendedSingle: 15,
        recommendedMedium: 45,
        recommendedPro: 100,
        speed: '~3 sec',
        trafficStatus: 'optimal',
        explorerTx: 'https://tronscan.org/#/transaction/',
        explorerAddress: 'https://tronscan.org/#/address/',
        placeholderAddress: 'T...',
        prefixValidate: (a) => a.startsWith('T') && a.length === 34,
    },
    {
        id: 'bnb',
        name: 'BNB Smart Chain Gas',
        symbol: 'BNB',
        networkName: 'BNB Chain (BEP20)',
        icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
        currency: 'bnbbsc',
        recommendedSingle: 0.005,
        recommendedMedium: 0.02,
        recommendedPro: 0.05,
        speed: '~3 sec',
        trafficStatus: 'optimal',
        explorerTx: 'https://bscscan.com/tx/',
        explorerAddress: 'https://bscscan.com/address/',
        placeholderAddress: '0x...',
        prefixValidate: (a) => a.startsWith('0x') && a.length === 42,
    },
    {
        id: 'sol',
        name: 'Solana Network Gas',
        symbol: 'SOL',
        networkName: 'Solana (SPL)',
        icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        currency: 'sol',
        recommendedSingle: 0.02,
        recommendedMedium: 0.08,
        recommendedPro: 0.20,
        speed: '< 1 sec',
        trafficStatus: 'optimal',
        explorerTx: 'https://solscan.io/tx/',
        explorerAddress: 'https://solscan.io/account/',
        placeholderAddress: 'Solana wallet address...',
        prefixValidate: (a) => a.length >= 32 && a.length <= 44,
    },
    {
        id: 'eth',
        name: 'Ethereum Mainnet Gas',
        symbol: 'ETH',
        networkName: 'Ethereum (ERC20)',
        icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        currency: 'eth',
        recommendedSingle: 0.003,
        recommendedMedium: 0.01,
        recommendedPro: 0.025,
        speed: '~12 sec',
        trafficStatus: 'moderate',
        explorerTx: 'https://etherscan.io/tx/',
        explorerAddress: 'https://etherscan.io/address/',
        placeholderAddress: '0x...',
        prefixValidate: (a) => a.startsWith('0x') && a.length === 42,
    },
    {
        id: 'pol',
        name: 'Polygon Network Gas',
        symbol: 'POL',
        networkName: 'Polygon (POS)',
        icon: 'https://assets.coingecko.com/coins/images/4713/large/polygon.png',
        currency: 'matic',
        recommendedSingle: 5,
        recommendedMedium: 20,
        recommendedPro: 50,
        speed: '~2 sec',
        trafficStatus: 'optimal',
        explorerTx: 'https://polygonscan.com/tx/',
        explorerAddress: 'https://polygonscan.com/address/',
        placeholderAddress: '0x...',
        prefixValidate: (a) => a.startsWith('0x') && a.length === 42,
    },
    {
        id: 'ton',
        name: 'The Open Network Gas',
        symbol: 'TON',
        networkName: 'TON Network',
        icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png',
        currency: 'ton',
        recommendedSingle: 0.5,
        recommendedMedium: 1.5,
        recommendedPro: 4,
        speed: '~5 sec',
        trafficStatus: 'optimal',
        explorerTx: 'https://tonviewer.com/transaction/',
        explorerAddress: 'https://tonviewer.com/',
        placeholderAddress: 'EQ... or UQ...',
        prefixValidate: (a) => a.length >= 24,
    },
    {
        id: 'doge',
        name: 'Dogecoin Network Gas',
        symbol: 'DOGE',
        networkName: 'Dogecoin Network',
        icon: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
        currency: 'doge',
        recommendedSingle: 10,
        recommendedMedium: 25,
        recommendedPro: 60,
        speed: '~60 sec',
        trafficStatus: 'optimal',
        explorerTx: 'https://dogechain.info/tx/',
        explorerAddress: 'https://dogechain.info/address/',
        placeholderAddress: 'D...',
        prefixValidate: (a) => a.startsWith('D') && a.length === 34,
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
    const { tab } = useLocalSearchParams<{ tab?: string }>();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // ─── State ─────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'assets' | 'gas' | 'trade' | 'history'>('assets');
    const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'NGN'>('USD');
    const [assetsRates, setAssetsRates] = useState<CryptoRate[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (tab === 'gas') setActiveTab('gas');
        else if (tab === 'trade') setActiveTab('trade');
        else if (tab === 'history') setActiveTab('history');
    }, [tab]);

    // Gas Station State (100% Real NOWPayments Payout API)
    const [selectedGasNetwork, setSelectedGasNetwork] = useState<GasNetworkOption>(GAS_NETWORKS[0]);
    const [gasWalletAddress, setGasWalletAddress] = useState<string>('');
    const [gasAmount, setGasAmount] = useState<string>(GAS_NETWORKS[0].recommendedSingle.toString());
    const [gasPaymentMethod, setGasPaymentMethod] = useState<'NGN' | 'USDT'>('NGN');
    const [gasOrdering, setGasOrdering] = useState<boolean>(false);
    const [gasRecentOrders, setGasRecentOrders] = useState<any[]>([]);
    const [gasResultDialog, setGasResultDialog] = useState<{
        visible: boolean;
        type: 'success' | 'error' | 'loading';
        title: string;
        message: string;
        txRef?: string;
        amount?: string;
        network?: string;
        destAddress?: string;
    }>({
        visible: false,
        type: 'success',
        title: '',
        message: '',
    });

    // User Data & Balances
    const [userId, setUserId] = useState<string | null>(null);
    const [currentUserPhone, setCurrentUserPhone] = useState<string>('');
    const [nairaBalance, setNairaBalance] = useState<number>(0);
    const [cryptoBalances, setCryptoBalances] = useState<Record<string, number>>({});
    const [hideBalance, setHideBalance] = useState<boolean>(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingTxns, setLoadingTxns] = useState(false);

    // Search and Asset Filters
    const [coinSearchQuery, setCoinSearchQuery] = useState<string>('');
    const [coinCategoryFilter, setCoinCategoryFilter] = useState<'all' | 'watchlist' | 'myAssets' | 'gainers'>('all');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'BUY' | 'SELL'>('ALL');
    const [favorites, setFavorites] = useState<string[]>(['BTC', 'USDT']);

    // Modals
    const [activeModal, setActiveModal] = useState<
        'deposit' | 'withdraw' | 'buy' | 'sell' | 'assetDetail' | 'addressBook' | 'priceAlert' | 'txReceipt' | 'converter' | null
    >(null);
    const [selectedCoinDetail, setSelectedCoinDetail] = useState<AssetConfig | null>(null);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [securityAction, setSecurityAction] = useState<(() => void) | null>(null);
    const pendingSecurityActionRef = useRef<((pin?: string) => Promise<void> | void) | null>(null);
    const [securityDescription, setSecurityDescription] = useState<string>('');

    // Quick Currency Converter / Calculator State
    const [calcCoin, setCalcCoin] = useState<string>('BTC');
    const [calcAmount, setCalcAmount] = useState<string>('1');
    const [calcMode, setCalcMode] = useState<'crypto' | 'ngn' | 'usd'>('crypto');

    // Deposit State (Real NOWPayments API)
    const [depositAsset, setDepositAsset] = useState<string>('USDT');
    const [depositNetworkIdx, setDepositNetworkIdx] = useState<number>(0);
    const [depositAddress, setDepositAddress] = useState<string>('');
    const [depositPaymentId, setDepositPaymentId] = useState<string | null>(null);
    const [depositLoading, setDepositLoading] = useState<boolean>(false);
    const [depositCopied, setDepositCopied] = useState<boolean>(false);
    const [verifyingDeposit, setVerifyingDeposit] = useState<boolean>(false);
    const [depositSuccessNotice, setDepositSuccessNotice] = useState<string | null>(null);

    // Withdraw / Send State (Dual Mode: External Blockchain OR Internal Abu Mafhal 0 Gas)
    const [sendMode, setSendMode] = useState<'external' | 'internal'>('external');
    const [withdrawAsset, setWithdrawAsset] = useState<string>('USDT');
    const [withdrawNetworkIdx, setWithdrawNetworkIdx] = useState<number>(0);
    const [withdrawAddress, setWithdrawAddress] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [withdrawing, setWithdrawing] = useState<boolean>(false);

    // Internal Transfer Sub-State
    const [transferRecipientInput, setTransferRecipientInput] = useState<string>('');
    const [transferResolvedRecipient, setTransferResolvedRecipient] = useState<{ id: string; full_name?: string; phone?: string; username?: string } | null>(null);
    const [transferResolving, setTransferResolving] = useState<boolean>(false);

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

    // Saved Wallets (Address Book)
    const [savedWallets, setSavedWallets] = useState<{ id: string; nickname: string; asset: string; address: string }[]>([]);
    const [newWalletNickname, setNewWalletNickname] = useState('');
    const [newWalletAddress, setNewWalletAddress] = useState('');

    // Price Alerts
    const [priceAlerts, setPriceAlerts] = useState<PriceAlertItem[]>([]);
    const [alertCoin, setAlertCoin] = useState<string>('BTC');
    const [alertTargetPrice, setAlertTargetPrice] = useState('');
    const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');

    // Selected Transaction for Receipt Modal
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    // ─── Lifecycle & Data Fetching ─────────────────────────────────────────────
    useEffect(() => {
        initUserData();
        loadSavedWallets();
        loadFavorites();
        loadPriceAlerts();
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
                fetchCryptoTransactions(user.id),
                fetchGasOrders(user.id)
            ]);
        } catch (e) {
            console.warn('initUserData error:', e);
        }
    };

    // ─── Realtime Subscriptions for Instant Deposit Detection ──────────────────
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`realtime-crypto-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crypto_balances', filter: `user_id=eq.${userId}` }, () => {
                fetchUserBalances(userId);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, (payload: any) => {
                fetchCryptoTransactions(userId);
                if (payload?.new && payload.new.type === 'crypto_deposit') {
                    if (Platform.OS !== 'web') {
                        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                    }
                    Alert.alert("Deposit Credited! 💰", `${payload.new.description || 'Your crypto deposit has arrived!'}`);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const formatReceiptDate = (d: Date | string) => {
        try {
            const dateObj = typeof d === 'string' ? new Date(d) : d;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[dateObj.getMonth()];
            const day = dateObj.getDate();
            const suffix = (day === 1 || day === 21 || day === 31) ? 'st' : (day === 2 || day === 22) ? 'nd' : (day === 3 || day === 23) ? 'rd' : 'th';
            let hours = dateObj.getHours();
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${month} ${day}${suffix}, ${hours}:${minutes} ${ampm}`;
        } catch {
            return 'Recently';
        }
    };

    const formatFullReceiptDate = (d: Date | string) => {
        try {
            const dateObj = typeof d === 'string' ? new Date(d) : d;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[dateObj.getMonth()];
            const day = dateObj.getDate();
            const suffix = (day === 1 || day === 21 || day === 31) ? 'st' : (day === 2 || day === 22) ? 'nd' : (day === 3 || day === 23) ? 'rd' : 'th';
            const year = dateObj.getFullYear();
            let hours = dateObj.getHours();
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${month} ${day}${suffix}, ${year} ${hours}:${minutes} ${ampm}`;
        } catch {
            return 'Recently';
        }
    };

    const openReceiptForGasOrder = (ord: any) => {
        const gasNet = GAS_NETWORKS.find(g => g.currency.toLowerCase() === ord.gas_type?.toLowerCase() || g.symbol.toLowerCase() === ord.gas_type?.toLowerCase()) || GAS_NETWORKS[0];
        const hash = ord.tx_hash || ord.reference || '';
        const txId = ord.provider_tx_id || ord.reference || ord.id || '';
        const recipient = (ord.wallet_address || '').trim();

        // Guaranteed valid on-chain link (Full Addresses never 404 on blockchain explorers)
        let explorerUrl = '';
        if (gasNet.symbol === 'TON') {
            explorerUrl = hash && hash.length > 20 && !hash.startsWith('0x') && !hash.includes('-')
                ? `https://tonviewer.com/transaction/${hash}`
                : `https://tonviewer.com/${recipient}`;
        } else if (recipient && gasNet.explorerAddress) {
            explorerUrl = `${gasNet.explorerAddress}${recipient}`;
        } else if (hash && gasNet.explorerTx) {
            explorerUrl = `${gasNet.explorerTx}${hash}`;
        } else {
            explorerUrl = `https://tonviewer.com/${recipient}`;
        }

        const feeLabels: Record<string, string> = {
            'TON': '~0.005 TON (Network Fee Included)',
            'TRX': '~1.5 TRX (Energy Included)',
            'BNB': '~0.0005 BNB (Gas Included)',
            'SOL': '~0.00005 SOL (Gas Included)',
            'POL': '~0.01 POL (Gas Included)',
        };
        const networkFeeLabel = feeLabels[gasNet.symbol] || 'Included in Total (₦0 Extra)';

        setSelectedTx({
            type: 'Gas Refill',
            symbol: gasNet.symbol,
            icon: gasNet.icon,
            networkName: gasNet.networkName,
            status: ord.status === 'completed' || ord.status === 'successful' || !ord.status ? 'Successful' : ord.status,
            date: ord.created_at ? new Date(ord.created_at) : new Date(),
            recipient: recipient,
            amountSent: `${ord.amount_gas} ${gasNet.symbol}`,
            amountPaid: ord.payment_method === 'USDT' ? `$${Number(ord.amount_fiat || 0).toFixed(4)} USDT` : `₦${Number(ord.amount_fiat || 0).toLocaleString()}`,
            paidFrom: 'Abu Mafhal Hub wallet',
            networkFee: networkFeeLabel,
            txHash: hash || (txId ? `Ref: ${txId}` : 'Processing on blockchain'),
            explorerUrl: explorerUrl,
            txId: txId,
        });
        setActiveModal('txReceipt');
    };

    const openReceiptForTransaction = (tx: any) => {
        const isGas = tx.type === 'crypto_gas';
        let symbol = 'USDT';
        let netName = 'TRON (TRC20)';
        let explorerBase = 'https://tronscan.org/#/address/';
        let iconUrl = 'https://assets.coingecko.com/coins/images/325/large/Tether.png';

        const desc = tx.description || '';
        const foundGas = GAS_NETWORKS.find(g => desc.toLowerCase().includes(g.symbol.toLowerCase()) || desc.toLowerCase().includes(g.currency.toLowerCase()));
        if (foundGas) {
            symbol = foundGas.symbol;
            netName = foundGas.networkName;
            explorerBase = foundGas.explorerAddress || foundGas.explorerTx;
            iconUrl = foundGas.icon;
        }

        // Match both 'to' and '→' including dashes and underscores for TON and EVM
        const recipientMatch = desc.match(/(?:to|→)\s*([A-Za-z0-9_-]+)/i);
        const recipient = recipientMatch ? recipientMatch[1] : (tx.recipient || '');
        const hashMatch = desc.match(/Hash:\s*([0-9a-zA-Zx_-]+)/i);
        const txHash = hashMatch ? hashMatch[1] : (tx.tx_hash || tx.reference || '');
        const txId = tx.reference || tx.id || '';

        let explorerUrl = '';
        if (symbol === 'TON') {
            explorerUrl = recipient ? `https://tonviewer.com/${recipient}` : (foundGas?.explorerAddress || 'https://tonviewer.com/');
        } else if (recipient && foundGas?.explorerAddress) {
            explorerUrl = `${foundGas.explorerAddress}${recipient}`;
        } else if (txHash && foundGas?.explorerTx) {
            explorerUrl = `${foundGas.explorerTx}${txHash}`;
        } else {
            explorerUrl = `https://tonviewer.com/${recipient}`;
        }

        const feeLabels: Record<string, string> = {
            'TON': '~0.005 TON (Network Fee Included)',
            'TRX': '~1.5 TRX (Energy Included)',
            'BNB': '~0.0005 BNB (Gas Included)',
            'SOL': '~0.00005 SOL (Gas Included)',
            'POL': '~0.01 POL (Gas Included)',
        };
        const networkFeeLabel = feeLabels[symbol] || 'Included in Total (₦0 Extra)';

        const gasAmountMatch = desc.match(/(?:Gas Refill:|Purchased)\s*([0-9.]+)\s*([A-Za-z0-9]+)/i);
        const displayedAmount = isGas && gasAmountMatch 
            ? `${gasAmountMatch[1]} ${gasAmountMatch[2].toUpperCase()}`
            : (isGas ? `0.05 ${symbol}` : `₦${Number(tx.amount || 0).toLocaleString()}`);

        setSelectedTx({
            type: isGas ? 'Gas Refill' : (tx.type ? tx.type.replace(/_/g, ' ') : 'Crypto Transfer'),
            symbol: symbol,
            icon: iconUrl,
            networkName: netName,
            status: tx.status === 'completed' || tx.status === 'successful' || !tx.status ? 'Successful' : tx.status,
            date: tx.created_at ? new Date(tx.created_at) : new Date(),
            recipient: recipient,
            amountSent: displayedAmount,
            amountPaid: `₦${Number(tx.amount || 0).toLocaleString()}`,
            paidFrom: 'Abu Mafhal Hub wallet',
            networkFee: networkFeeLabel,
            txHash: txHash || (txId ? `Ref: ${txId}` : 'Processing on blockchain'),
            explorerUrl: explorerUrl,
            txId: txId,
        });
        setActiveModal('txReceipt');
    };

    const fetchGasOrders = async (uid: string) => {
        try {
            const { data } = await supabase
                .from('crypto_gas_orders')
                .select('*')
                .eq('user_id', uid)
                .order('created_at', { ascending: false })
                .limit(15);
            if (data && Array.isArray(data) && data.length > 0) {
                setGasRecentOrders(data);
            } else {
                const { data: txGas } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', uid)
                    .eq('type', 'crypto_gas')
                    .order('created_at', { ascending: false })
                    .limit(15);
                if (txGas && Array.isArray(txGas) && txGas.length > 0) {
                    const mapped = txGas.map(t => {
                        const desc = t.description || '';
                        const gasTypeMatch = desc.match(/(?:Purchased|Gas Refill:)\s*([0-9.]+)\s*([A-Za-z0-9]+)/i);
                        const walletMatch = desc.match(/(?:to|→)\s*([A-Za-z0-9_-]+)/i);
                        return {
                            id: t.id,
                            user_id: t.user_id,
                            gas_type: gasTypeMatch ? gasTypeMatch[2].toLowerCase() : 'ton',
                            amount_gas: gasTypeMatch ? parseFloat(gasTypeMatch[1]) : 0.05,
                            wallet_address: walletMatch ? walletMatch[1] : (t.reference || 'Wallet'),
                            amount_fiat: t.amount,
                            status: t.status || 'completed',
                            created_at: t.created_at,
                            reference: t.reference,
                        };
                    });
                    setGasRecentOrders(mapped);
                }
            }
        } catch (_) {}
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
                        let norm = b.asset.toUpperCase().trim();
                        if (norm.startsWith('USDT')) norm = 'USDT';
                        else if (norm.startsWith('USDC')) norm = 'USDC';
                        else if (norm.startsWith('ETH')) norm = 'ETH';
                        else if (norm.startsWith('BNB')) norm = 'BNB';
                        else if (norm.startsWith('SOL')) norm = 'SOL';
                        else if (norm.startsWith('TRX')) norm = 'TRX';
                        else if (norm.startsWith('TON')) norm = 'TON';
                        else if (norm.startsWith('BTC')) norm = 'BTC';

                        const val = Number(b.balance) || 0;
                        map[norm] = (map[norm] || 0) + val;
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
                .limit(40);

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
                fetchGasOrders(userId),
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

    const getCoinToNgnRate = useCallback((symbol: string, type: 'buy' | 'sell'): number => {
        const sym = (symbol || 'USDT').toLowerCase().trim();
        // 1. Direct admin configured rate from settings (e.g. crypto_rate_btc_buy, crypto_rate_usdt_buy)
        const customRateKey = `crypto_rate_${sym}_${type}`;
        if (settings && settings[customRateKey]) {
            const parsed = Number(settings[customRateKey]);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }

        // 2. Base USDT rate
        const usdtNgnRate = getUsdtToNgnRate(type);
        if (sym === 'usdt' || sym === 'usdc') {
            return usdtNgnRate;
        }

        // 3. Dynamic market price with admin profit spread
        const coinUsdPrice = getAssetPriceUsd(symbol);
        const marginFactor = type === 'buy' ? 1.015 : 0.985;
        return Math.round(coinUsdPrice * usdtNgnRate * marginFactor);
    }, [settings, getUsdtToNgnRate, getAssetPriceUsd]);

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

    // ─── Filtered Assets ───────────────────────────────────────────────────────
    const filteredAssets = useMemo(() => {
        return SUPPORTED_ASSETS.filter(asset => {
            const query = coinSearchQuery.trim().toLowerCase();
            const matchesQuery = !query || 
                asset.name.toLowerCase().includes(query) || 
                asset.symbol.toLowerCase().includes(query);

            if (!matchesQuery) return false;

            if (coinCategoryFilter === 'watchlist') {
                return favorites.includes(asset.symbol);
            }
            if (coinCategoryFilter === 'myAssets') {
                return (cryptoBalances[asset.symbol] || 0) > 0;
            }
            if (coinCategoryFilter === 'gainers') {
                const coin = assetsRates.find(r => r.symbol?.toUpperCase() === asset.symbol);
                return (coin?.percent_change_24h || 0) > 0;
            }
            return true;
        });
    }, [coinSearchQuery, coinCategoryFilter, favorites, cryptoBalances, assetsRates]);

    // ─── Favorites (Watchlist) Logic ───────────────────────────────────────────
    const loadFavorites = async () => {
        try {
            const raw = await AsyncStorage.getItem(FAVORITES_KEY);
            if (raw) setFavorites(JSON.parse(raw));
        } catch {}
    };

    const toggleFavorite = async (sym: string) => {
        const exists = favorites.includes(sym);
        const updated = exists ? favorites.filter(f => f !== sym) : [...favorites, sym];
        setFavorites(updated);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        if (Platform.OS !== 'web') {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
        }
    };

    // ─── Price Alerts Logic ────────────────────────────────────────────────────
    const loadPriceAlerts = async () => {
        try {
            const raw = await AsyncStorage.getItem(PRICE_ALERTS_KEY);
            if (raw) setPriceAlerts(JSON.parse(raw));
        } catch {}
    };

    const handleAddPriceAlert = async () => {
        const price = parseFloat(alertTargetPrice.trim());
        if (isNaN(price) || price <= 0) {
            Alert.alert("Invalid Price", "Please enter a valid target price in USD.");
            return;
        }
        const newAlert: PriceAlertItem = {
            id: Date.now().toString(),
            asset: alertCoin,
            targetPrice: price,
            condition: alertCondition,
            createdAt: new Date().toISOString()
        };
        const updated = [...priceAlerts, newAlert];
        setPriceAlerts(updated);
        await AsyncStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(updated));
        setAlertTargetPrice('');
        if (Platform.OS !== 'web') {
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        }
        Alert.alert("Price Alert Set 🔔", `We'll monitor when ${alertCoin} moves ${alertCondition} $${price.toLocaleString()}.`);
    };

    const handleDeletePriceAlert = async (id: string) => {
        const filtered = priceAlerts.filter(a => a.id !== id);
        setPriceAlerts(filtered);
        await AsyncStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(filtered));
    };

    // ─── Live Currency Converter Calculations ──────────────────────────────────
    const converterValues = useMemo(() => {
        const coinPriceUsd = getAssetPriceUsd(calcCoin);
        const usdtRate = getUsdtToNgnRate('buy');
        const amt = parseFloat(calcAmount.trim()) || 0;

        let convertedCrypto = 0;
        let convertedUsd = 0;
        let convertedNgn = 0;

        if (calcMode === 'crypto') {
            convertedCrypto = amt;
            convertedUsd = amt * coinPriceUsd;
            convertedNgn = convertedUsd * usdtRate;
        } else if (calcMode === 'ngn') {
            convertedNgn = amt;
            convertedUsd = usdtRate > 0 ? amt / usdtRate : 0;
            convertedCrypto = coinPriceUsd > 0 ? convertedUsd / coinPriceUsd : 0;
        } else {
            // 'usd'
            convertedUsd = amt;
            convertedNgn = amt * usdtRate;
            convertedCrypto = coinPriceUsd > 0 ? convertedUsd / coinPriceUsd : 0;
        }

        return {
            coinPriceUsd,
            usdtRate,
            convertedCrypto,
            convertedUsd,
            convertedNgn
        };
    }, [calcCoin, calcAmount, calcMode, getAssetPriceUsd, getUsdtToNgnRate]);

    // ─── Filtered Transactions ─────────────────────────────────────────────────
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (historyTypeFilter === 'ALL') return true;
            if (historyTypeFilter === 'DEPOSIT') return tx.type === 'crypto_deposit';
            if (historyTypeFilter === 'WITHDRAW') return tx.type === 'crypto_withdrawal';
            if (historyTypeFilter === 'TRANSFER') return tx.type === 'crypto_transfer_in' || tx.type === 'crypto_transfer_out';
            if (historyTypeFilter === 'BUY') return tx.type === 'crypto_buy';
            if (historyTypeFilter === 'SELL') return tx.type === 'crypto_sell';
            return true;
        });
    }, [transactions, historyTypeFilter]);

    // ─── Export Transaction Statement ──────────────────────────────────────────
    const handleExportStatement = async () => {
        if (transactions.length === 0) {
            Alert.alert("No Records", "No transaction records found to export.");
            return;
        }
        const lines = [
            `📊 ABU MAFHAL CRYPTO HUB — TRANSACTION STATEMENT`,
            `Generated: ${new Date().toLocaleString()}`,
            `Total Filtered Records: ${filteredTransactions.length}`,
            `----------------------------------------------------`
        ];
        filteredTransactions.slice(0, 30).forEach((tx, idx) => {
            lines.push(
                `${idx + 1}. [${tx.type?.toUpperCase()}] ₦${Number(tx.amount || 0).toLocaleString()} | ${tx.status?.toUpperCase() || 'SUCCESS'}\n   Ref: ${tx.reference || tx.id}\n   Date: ${tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'}`
            );
        });
        lines.push(`----------------------------------------------------`);
        lines.push(`⚡ Abu Mafhal Crypto Hub — Powered by NOWPayments`);
        try {
            await Share.share({
                message: lines.join('\n'),
                title: 'Abu Mafhal Crypto Statement'
            });
        } catch {}
    };

    // ─── Address Book Logic ────────────────────────────────────────────────────
    const loadSavedWallets = async () => {
        try {
            const raw = await AsyncStorage.getItem(SAVED_WALLETS_KEY);
            if (raw) setSavedWallets(JSON.parse(raw));
        } catch {}
    };

    const handleSaveWallet = async () => {
        if (!newWalletNickname.trim() || !newWalletAddress.trim()) {
            Alert.alert("Required", "Please provide a nickname and address.");
            return;
        }
        const updated = [
            ...savedWallets,
            {
                id: Date.now().toString(),
                nickname: newWalletNickname.trim(),
                asset: withdrawAsset,
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
        Alert.alert("Saved 🔒", "Wallet address whitelisted to your address book.");
    };

    const handleDeleteSavedWallet = async (id: string) => {
        const filtered = savedWallets.filter(w => w.id !== id);
        setSavedWallets(filtered);
        await AsyncStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(filtered));
    };

    // ─── Share Portfolio Statement ─────────────────────────────────────────────
    const handleSharePortfolio = async () => {
        try {
            const lines: string[] = [
                `💎 ABU MAFHAL CRYPTO HUB — SUMMARY`,
                `📅 Date: ${new Date().toLocaleDateString()}`,
                `💰 Portfolio Value: $${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (≈ ₦${totalPortfolioNgn.toLocaleString()} NGN)`,
                `----------------------------------------`
            ];
            SUPPORTED_ASSETS.forEach(a => {
                const bal = cryptoBalances[a.symbol] || 0;
                if (bal > 0) {
                    lines.push(`• ${a.symbol}: ${bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}`);
                }
            });
            lines.push(`----------------------------------------`);
            lines.push(`⚡ Powered by NOWPayments Gateway`);

            if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            await Share.share({
                message: lines.join('\n'),
                title: 'Crypto Portfolio Statement'
            });
        } catch {}
    };

    // ─── Real NOWPayments Deposit Address Generation & On-Demand Verification ────
    const loadNowPaymentsAddress = async (assetSym: string, netIndex: number, regenerate = false) => {
        if (!userId) return;
        const assetObj = SUPPORTED_ASSETS.find(a => a.symbol === assetSym);
        if (!assetObj) return;
        const netObj = assetObj.networks[netIndex] || assetObj.networks[0];

        setDepositLoading(true);
        setDepositCopied(false);
        setDepositSuccessNotice(null);
        try {
            const res = await api.crypto.generateDepositAddress(userId, netObj.network, netObj.currency, regenerate);
            if (res && res.address) {
                setDepositAddress(res.address);
                if (res.payment_id) setDepositPaymentId(String(res.payment_id));
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

    const handleVerifyDeposit = async () => {
        if (!userId) return;
        setVerifyingDeposit(true);
        try {
            const assetObj = SUPPORTED_ASSETS.find(a => a.symbol === depositAsset);
            const netObj = assetObj?.networks[depositNetworkIdx] || assetObj?.networks[0];

            const res = await api.crypto.verifyDeposit({
                payment_id: depositPaymentId || undefined,
                address: depositAddress || undefined,
                currency: netObj?.currency
            });

            if (res?.success && (res.credited > 0 || res.newBalance !== undefined)) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                const msg = `Deposit of +${res.credited || ''} ${res.asset ? res.asset.toUpperCase() : depositAsset} confirmed and credited!`;
                setDepositSuccessNotice(msg);
                Alert.alert("Deposit Confirmed! 🎉", msg);
                await fetchUserBalances(userId);
                await fetchCryptoTransactions(userId);
            } else if (res?.alreadyCredited) {
                Alert.alert("Already Credited", res.message || "This deposit is already credited in your wallet balance.");
                await fetchUserBalances(userId);
            } else if (res?.pending) {
                Alert.alert("Pending on Blockchain", res.message || "Your deposit was detected and is confirming on the blockchain. It will credit automatically upon final confirmation.");
            } else {
                Alert.alert("Deposit Status", res?.message || "No incoming confirmed transaction found yet. If you just sent the funds, please allow 1-3 minutes for blockchain nodes to broadcast it.");
            }
        } catch (err: any) {
            Alert.alert("Verification Error", err.message || "Could not check deposit status right now.");
        } finally {
            setVerifyingDeposit(false);
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

    // ─── Dual Send / Withdrawal Flow ───────────────────────────────────────────
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

    const getNetworkWithdrawFee = (netName: string, assetSym: string): number => {
        const profitMargin = Number(settings?.crypto_withdraw_profit_margin) || 0.5;
        let baseFee = 1.0;
        if (netName === 'TRC20') baseFee = Number(settings?.crypto_fee_trc20_usdt) || 1.5;
        else if (netName === 'BEP20') baseFee = Number(settings?.crypto_fee_bep20_usdt) || 1.0;
        else if (netName === 'ERC20') baseFee = Number(settings?.crypto_fee_erc20_usdt) || 12.0;
        else if (netName === 'POLYGON') baseFee = 0.8;
        else if (netName === 'SOL') baseFee = 0.8;
        else if (netName === 'BTC') return Number((Number(settings?.crypto_fee_btc) || 0.0004).toFixed(6));
        else if (netName === 'ETH') return Number((Number(settings?.crypto_fee_eth) || 0.002).toFixed(6));
        else if (netName === 'TRX') baseFee = 1.5;
        else if (netName === 'TON') baseFee = 0.05;
        return Number((baseFee + profitMargin).toFixed(4));
    };

    const handleInitiateSend = () => {
        const amt = parseFloat(withdrawAmount.trim());
        const currentBal = cryptoBalances[withdrawAsset] || 0;

        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount to send.");
            return;
        }

        if (sendMode === 'external') {
            if (!withdrawAddress.trim()) {
                Alert.alert("Recipient Required", "Please provide a valid recipient wallet address.");
                return;
            }
            const assetObj = SUPPORTED_ASSETS.find(a => a.symbol === withdrawAsset);
            const netObj = assetObj?.networks[withdrawNetworkIdx] || assetObj?.networks[0];
            const targetNetwork = netObj?.network || 'TRC20';
            const fee = getNetworkWithdrawFee(targetNetwork, withdrawAsset);
            const totalRequired = amt + fee;

            if (totalRequired > currentBal) {
                Alert.alert(
                    "Insufficient Balance", 
                    `Total required: ${totalRequired.toFixed(4)} ${withdrawAsset} (Amount: ${amt} + Network Fee: ${fee} ${withdrawAsset}). You only have ${currentBal.toFixed(4)} available.`
                );
                return;
            }

            setSecurityDescription(`Authorize payout of ${amt} ${withdrawAsset} (+ ${fee} fee) to ${withdrawAddress.slice(0, 8)}... (${netObj?.label}) via NOWPayments`);
            const targetAddr = withdrawAddress.trim();
            pendingSecurityActionRef.current = () => executeExternalWithdrawal(targetNetwork, targetAddr, amt, fee);
            setSecurityAction(() => () => executeExternalWithdrawal(targetNetwork, targetAddr, amt, fee));
            setShowSecurityModal(true);
        } else {
            // Internal Transfer (0 Fee)
            if (amt > currentBal) {
                Alert.alert("Insufficient Balance", `You only have ${currentBal.toFixed(4)} ${withdrawAsset} available.`);
                return;
            }
            if (!transferResolvedRecipient || !transferResolvedRecipient.id) {
                Alert.alert("Recipient Required", "Please enter an Abu Mafhal user phone number or username.");
                return;
            }
            setSecurityDescription(`Transfer ${amt} ${withdrawAsset} to ${transferResolvedRecipient.full_name || transferResolvedRecipient.phone || 'Abu Mafhal User'} (0 Gas Fee)`);
            const targetRecipientId = transferResolvedRecipient.id;
            pendingSecurityActionRef.current = () => executeInternalTransfer(targetRecipientId, amt);
            setSecurityAction(() => () => executeInternalTransfer(targetRecipientId, amt));
            setShowSecurityModal(true);
        }
    };

    const executeExternalWithdrawal = async (networkName: string, destAddr: string, amountNum: number, feeNum = 1.5) => {
        setWithdrawing(true);
        try {
            const res = await api.crypto.withdraw(networkName, destAddr, amountNum, withdrawAsset.toLowerCase(), feeNum);
            if (res && (res.success || res.payoutId)) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert(
                    "Withdrawal Dispatched 🚀", 
                    `Successfully dispatched payout of ${amountNum} ${withdrawAsset} to ${destAddr.slice(0, 10)}... (Fee: ${feeNum} ${withdrawAsset}). Processing via NOWPayments gateway.`
                );
                setActiveModal(null);
                setWithdrawAddress('');
                setWithdrawAmount('');
                if (userId) {
                    fetchUserBalances(userId);
                    fetchCryptoTransactions(userId);
                }
            } else {
                throw new Error(res?.error || res?.message || "Withdrawal failed to process");
            }
        } catch (err: any) {
            Alert.alert("Withdrawal Failed", err.message || "Failed to execute payout. Your funds remain safe.");
            if (userId) fetchUserBalances(userId);
        } finally {
            setWithdrawing(false);
        }
    };

    const executeInternalTransfer = async (targetUserId: string, amt: number) => {
        if (!userId) return;
        setWithdrawing(true);
        try {
            // 1. Deduct sender
            const { data: deductData, error: deductErr } = await supabase.rpc('deduct_crypto_balance', {
                user_id: userId,
                asset: withdrawAsset.toLowerCase(),
                amount: amt
            });
            if (deductErr || !deductData?.success) {
                throw new Error(deductErr?.message || deductData?.error || "Failed to deduct crypto balance.");
            }

            // 2. Credit recipient
            const { data: creditData, error: creditErr } = await supabase.rpc('credit_crypto_balance', {
                user_id: targetUserId,
                asset: withdrawAsset.toLowerCase(),
                amount: amt
            });
            if (creditErr || !creditData?.success) {
                // Rollback
                await supabase.rpc('credit_crypto_balance', {
                    user_id: userId,
                    asset: withdrawAsset.toLowerCase(),
                    amount: amt
                });
                throw new Error(creditErr?.message || creditData?.error || "Failed to credit recipient balance.");
            }

            // 3. Transactions
            const assetPriceUsd = getAssetPriceUsd(withdrawAsset);
            const ngnVal = Math.floor(amt * assetPriceUsd * getUsdtToNgnRate('sell'));

            await Promise.all([
                supabase.from('transactions').insert({
                    user_id: userId,
                    type: 'crypto_transfer_out',
                    amount: ngnVal,
                    status: 'success',
                    description: `Sent: ${amt} ${withdrawAsset} to ${transferResolvedRecipient?.full_name || transferResolvedRecipient?.phone}`
                }),
                supabase.from('transactions').insert({
                    user_id: targetUserId,
                    type: 'crypto_transfer_in',
                    amount: ngnVal,
                    status: 'success',
                    description: `Received: ${amt} ${withdrawAsset} from ${currentUserPhone || 'Abu Mafhal User'}`
                })
            ]);

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Transfer Complete 🎉", `Successfully sent ${amt} ${withdrawAsset} with ZERO gas fees!`);
            setActiveModal(null);
            setWithdrawAmount('');
            setTransferRecipientInput('');
            setTransferResolvedRecipient(null);
            fetchUserBalances(userId);
            fetchCryptoTransactions(userId);
        } catch (err: any) {
            Alert.alert("Transfer Failed", err.message || "Could not complete internal transfer.");
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

        const coinBuyRate = getCoinToNgnRate(buyAsset, 'buy');
        const amountCrypto = costNgn / (coinBuyRate || 1);

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
                Alert.alert("Purchase Complete 🎉", `You bought ${amountCrypto.toFixed(6)} ${buyAsset} for ₦${costNgn.toLocaleString()}! (Rate: ₦${coinBuyRate.toLocaleString()})`);
                setActiveModal(null);
                setBuyNgnAmount('10000');
                if (userId) {
                    await createAppNotification(
                        userId,
                        "Crypto Purchased",
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

        const coinSellRate = getCoinToNgnRate(sellAsset, 'sell');
        const expectedNgn = Math.floor(cryptoAmt * (coinSellRate || 1));

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
                Alert.alert("Sold Successfully 💰", `Sold ${cryptoAmt} ${sellAsset} for ₦${expectedNgn.toLocaleString()} credited to your Naira wallet! (Rate: ₦${coinSellRate.toLocaleString()})`);
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

    // ─── Instant Gas Station Handlers (100% Real NOWPayments Payout) ───────────
    const handleBuyGas = () => {
        const amtGasNum = parseFloat(gasAmount.trim());
        if (isNaN(amtGasNum) || amtGasNum <= 0) {
            setGasResultDialog({
                visible: true,
                type: 'error',
                title: 'Invalid Amount',
                message: 'Please enter a valid amount of network gas.',
            });
            Alert.alert("Invalid Amount", "Please enter a valid amount of network gas.");
            return;
        }

        const addr = gasWalletAddress.trim();
        if (!addr) {
            setGasResultDialog({
                visible: true,
                type: 'error',
                title: 'Recipient Address Required',
                message: `Please enter or paste your ${selectedGasNetwork.networkName} destination wallet address.`,
            });
            Alert.alert("Recipient Address Required", `Please enter or paste your ${selectedGasNetwork.networkName} destination wallet address.`);
            return;
        }
        if (!selectedGasNetwork.prefixValidate(addr)) {
            setGasResultDialog({
                visible: true,
                type: 'error',
                title: 'Invalid Wallet Address',
                message: `Please verify the address format for ${selectedGasNetwork.networkName} (Expected: ${selectedGasNetwork.placeholderAddress}).`,
            });
            Alert.alert("Invalid Wallet Address", `Please verify the address format for ${selectedGasNetwork.networkName} (Expected: ${selectedGasNetwork.placeholderAddress}).`);
            return;
        }

        const coinPriceUsd = getAssetPriceUsd(selectedGasNetwork.symbol);
        const totalGasUsd = amtGasNum * coinPriceUsd;
        const usdtBuyRate = getUsdtToNgnRate('buy');
        const costNgn = Math.ceil(totalGasUsd * usdtBuyRate);
        const costUsdt = Number(totalGasUsd.toFixed(4));

        if (gasPaymentMethod === 'NGN') {
            if (costNgn > nairaBalance) {
                setGasResultDialog({
                    visible: true,
                    type: 'error',
                    title: 'Insufficient Naira Balance',
                    message: `Total cost is ₦${costNgn.toLocaleString()}, but your Naira balance is ₦${nairaBalance.toLocaleString()}. Please fund your wallet.`,
                });
                Alert.alert("Insufficient Naira Balance", `Total cost is ₦${costNgn.toLocaleString()}, but your Naira balance is ₦${nairaBalance.toLocaleString()}.`);
                return;
            }
            setSecurityDescription(`Authorize instant payout of ${amtGasNum} ${selectedGasNetwork.symbol} to ${addr.slice(0, 8)}... (${selectedGasNetwork.networkName}) for ₦${costNgn.toLocaleString()} NGN via NOWPayments`);
        } else {
            const currentUsdt = cryptoBalances['USDT'] || 0;
            if (costUsdt > currentUsdt) {
                setGasResultDialog({
                    visible: true,
                    type: 'error',
                    title: 'Insufficient USDT Balance',
                    message: `Total cost is $${costUsdt} USDT, but your USDT balance is ${currentUsdt.toFixed(2)} USDT. Please deposit USDT.`,
                });
                Alert.alert("Insufficient USDT Balance", `Total cost is $${costUsdt} USDT, but your USDT balance is ${currentUsdt.toFixed(2)} USDT.`);
                return;
            }
            setSecurityDescription(`Authorize instant payout of ${amtGasNum} ${selectedGasNetwork.symbol} to ${addr.slice(0, 8)}... (${selectedGasNetwork.networkName}) for $${costUsdt} USDT via NOWPayments`);
        }

        const targetAddr = addr;
        const targetNetwork = selectedGasNetwork;
        const targetMethod = gasPaymentMethod;

        const runPayout = (pin?: string) => executeBuyGasPayout(
            amtGasNum, costNgn, costUsdt, targetAddr, targetNetwork, targetMethod
        );

        pendingSecurityActionRef.current = runPayout;
        setSecurityAction(() => runPayout);
        setShowSecurityModal(true);
    };

    const executeBuyGasPayout = async (
        amtGas: number, 
        amtNgn: number, 
        amtUsdt: number,
        destAddress: string,
        network: GasNetworkOption,
        method: 'NGN' | 'USDT'
    ) => {
        setGasOrdering(true);
        setGasResultDialog({
            visible: true,
            type: 'loading',
            title: 'Processing Gas Refill ⛽',
            message: `Authorizing NOWPayments network to dispatch ${amtGas} ${network.symbol} to ${destAddress.slice(0, 10)}...`,
            amount: `${amtGas} ${network.symbol}`,
            network: network.networkName,
            destAddress: destAddress,
        });

        try {
            const res = await api.crypto.buyGas({
                gasType: network.currency,
                walletAddress: destAddress.trim(),
                paymentMethod: method,
                amountPayment: method === 'NGN' ? amtNgn : amtUsdt,
                amountGas: amtGas
            });

            if (res && res.success) {
                if (Platform.OS !== 'web') {
                    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                }
                setGasWalletAddress('');

                // Use real provider txId and txHash — never generate fake on-chain hashes
                const finalTxId = res.txId || ('gas_' + Math.random().toString(36).substring(2, 9));
                const realTxHash = res.txHash || null;

                // Explorer URL logic:
                // - If we have a real on-chain hash → use blockchain explorer
                // - If pending/no hash yet → use NowPayments withdrawal page
                //   (never generate random hash — it will 404 on explorers)
                let explorerUrl: string;
                if (realTxHash && realTxHash.length > 10) {
                    explorerUrl = `${network.explorerTx}${realTxHash}`;
                } else {
                    // Use address explorer so user can verify receiving wallet
                    explorerUrl = `${network.explorerAddress}${destAddress}`;
                }

                const receiptPayload = {
                    type: 'Gas fee',
                    symbol: network.symbol,
                    icon: network.icon,
                    networkName: network.networkName,
                    status: res.status === 'submitted' || res.status === 'created' ? 'Dispatched ⚡' : 'Successful',
                    date: new Date(),
                    recipient: destAddress,
                    amountSent: `${amtGas} ${network.symbol}`,
                    amountPaid: method === 'NGN' ? `₦${amtNgn.toLocaleString()}` : `$${amtUsdt} USDT`,
                    paidFrom: 'Abu Mafhal Hub wallet',
                    networkFee: 'Included',
                    txHash: realTxHash || 'Pending — check back in 2-3 minutes',
                    explorerUrl,
                    txId: finalTxId,
                };
                setSelectedTx(receiptPayload);

                setGasResultDialog({
                    visible: true,
                    type: 'success',
                    title: 'Gas Dispatched! ⛽🚀',
                    message: res.message || `${amtGas} ${network.symbol} has been sent to your wallet via NowPayments. Allow 2-5 minutes for confirmation.`,
                    txRef: finalTxId,
                    amount: `${amtGas} ${network.symbol}`,
                    network: network.networkName,
                    destAddress: destAddress,
                });

                if (Platform.OS !== 'web') {
                    try {
                        Alert.alert(
                            "Gas Dispatched ⛽🚀",
                            `${amtGas} ${network.symbol} sent to ${destAddress.slice(0, 10)}... via NowPayments!\n\nRef: ${finalTxId}\n\nPlease allow 2-5 minutes for blockchain confirmation.`
                        );
                    } catch {}
                }

                if (userId) {
                    try {
                        await createAppNotification(
                            userId,
                            "Crypto Gas Dispatched ⛽",
                            `Your gas order of ${amtGas} ${network.symbol} was sent to ${destAddress.slice(0, 8)}... via NowPayments (Ref: ${finalTxId}).`,
                            "crypto",
                            "high"
                        );
                    } catch {}
                    fetchUserBalances(userId);
                    fetchGasOrders(userId);
                    fetchCryptoTransactions(userId);
                }

            } else {
                throw new Error(res?.message || "Failed to dispatch gas payout.");
            }
        } catch (err: any) {
            console.error("Gas purchase execution error:", err);
            const errMsg = err?.message || "Could not complete gas purchase. Please check your balance or wallet address.";
            setGasResultDialog({
                visible: true,
                type: 'error',
                title: 'Gas Refill Notice ⚠️',
                message: errMsg,
                amount: `${amtGas} ${network.symbol}`,
                network: network.networkName,
                destAddress: destAddress,
            });
            if (Platform.OS !== 'web') {
                try {
                    Alert.alert("Gas Purchase Notice", errMsg);
                } catch {}
            }
        } finally {
            setGasOrdering(false);
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

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity onPress={() => setActiveModal('converter')} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="calculator-outline" size={16} color={C.white} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveModal('priceAlert')} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="notifications-outline" size={16} color={C.white} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSharePortfolio} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="share-social-outline" size={16} color={C.white} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onRefresh} style={s.headerIconBtn} activeOpacity={0.7}>
                            <Ionicons name="reload" size={16} color={C.white} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* CLEAN TOTAL PORTFOLIO BALANCE CARD WITH INNER CRYPTO DECORATIONS */}
                <View style={s.heroCard}>
                    {/* Subtle Inner Crypto Watermark Background */}
                    <View style={s.heroWatermarkWrap} pointerEvents="none">
                        <Ionicons name="logo-bitcoin" size={130} color="rgba(217, 119, 6, 0.04)" style={{ position: 'absolute', right: -20, top: -25 }} />
                        <Ionicons name="shield-checkmark" size={70} color="rgba(5, 150, 105, 0.03)" style={{ position: 'absolute', right: 90, bottom: -15 }} />
                    </View>

                    {/* Live Network & Escrow Status Strip */}
                    <View style={s.heroLiveTickerRow}>
                        <View style={s.greenLivePulse} />
                        <Text style={s.heroLiveTickerText}>Multi-Chain Live Escrow &bull; 0.4s Fast Settlement</Text>
                        <View style={{ flex: 1 }} />
                        <View style={s.heroNetworkCountBadge}>
                            <Ionicons name="flash" size={10} color={C.gold} />
                            <Text style={s.heroNetworkCountText}>12 Networks</Text>
                        </View>
                    </View>

                    <View style={s.heroTop}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.heroSub}>Total Crypto Portfolio</Text>
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
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={() => router.push('/fund-wallet' as any)} activeOpacity={0.7}>
                            <Text style={{ color: C.blue, fontSize: 10.5, fontWeight: '700' }}>Fund +</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 4 CLEAN PRIMARY FINTECH ACTIONS (Zero Clutter, Zero Duplication) */}
                    <View style={s.quickActionsRow}>
                        <TouchableOpacity 
                            onPress={() => {
                                setDepositAsset('USDT');
                                setDepositNetworkIdx(0);
                                setActiveModal('deposit');
                            }}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}>
                                <Ionicons name="arrow-down" size={18} color={C.emerald} />
                            </View>
                            <Text style={s.actionText}>Deposit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                setWithdrawAsset('USDT');
                                setWithdrawNetworkIdx(0);
                                setActiveModal('withdraw');
                            }}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.goldBg, borderColor: '#FDE68A' }]}>
                                <Ionicons name="arrow-up" size={18} color={C.gold} />
                            </View>
                            <Text style={s.actionText}>Send</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                setBuyAsset('USDT');
                                setActiveModal('buy');
                            }}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.blueBg, borderColor: '#BFDBFE' }]}>
                                <Ionicons name="card-outline" size={18} color={C.blue} />
                            </View>
                            <Text style={s.actionText}>Buy</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                setSellAsset('USDT');
                                setActiveModal('sell');
                            }}
                            style={s.actionButton}
                            activeOpacity={0.8}
                        >
                            <View style={[s.actionIconWrap, { backgroundColor: C.purpleBg, borderColor: '#DDD6FE' }]}>
                                <Ionicons name="cash-outline" size={18} color={C.purple} />
                            </View>
                            <Text style={s.actionText}>Sell</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            {/* LIVE MARKET TICKER TAPE (Crypto Marquee Ribbon) */}
            <View style={[s.tickerTapeContainer, isWeb && s.webContainer]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tickerTapeScroll}>
                    {['BTC', 'ETH', 'SOL', 'TON', 'TRX', 'BNB', 'USDT'].map((sym) => {
                        const rate = assetsRates.find(r => r.symbol?.toUpperCase() === sym);
                        const price = getAssetPriceUsd(sym);
                        const chg = rate?.percent_change_24h ?? 0;
                        const isUp = chg >= 0;
                        return (
                            <TouchableOpacity
                                key={sym}
                                onPress={() => {
                                    const asset = SUPPORTED_ASSETS.find(a => a.symbol === sym);
                                    if (asset) {
                                        setSelectedCoinDetail(asset);
                                        setActiveModal('assetDetail');
                                    }
                                }}
                                style={s.tickerTapePill}
                                activeOpacity={0.7}
                            >
                                <Text style={s.tickerTapeSym}>{sym}</Text>
                                <Text style={s.tickerTapePrice}>${price >= 1 ? price.toLocaleString() : price.toFixed(4)}</Text>
                                <Text style={[s.tickerTapeChange, { color: isUp ? C.emerald : C.rose }]}>
                                    {isUp ? '▲' : '▼'}{Math.abs(chg).toFixed(1)}%
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* CLEAN 4 TABS */}
            <View style={[s.tabBarContainer, isWeb && s.webContainer]}>
                {[
                    { id: 'assets', label: 'Assets' },
                    { id: 'gas', label: 'Gas Station ⛽' },
                    { id: 'trade', label: 'Swap' },
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

                {/* ─── TAB 1: ASSETS LIST (With Search & Filter) ───────────────── */}
                {activeTab === 'assets' && (
                    <View>


                        {/* Search Bar */}
                        <View style={s.searchBar}>
                            <Ionicons name="search" size={16} color={C.textMuted} />
                            <TextInput
                                value={coinSearchQuery}
                                onChangeText={setCoinSearchQuery}
                                placeholder="Search coins (BTC, USDT, SOL)..."
                                placeholderTextColor={C.textMuted}
                                style={s.searchInput}
                            />
                            {coinSearchQuery ? (
                                <TouchableOpacity onPress={() => setCoinSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color={C.textMuted} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Quick Filter Chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                            {[
                                { id: 'all', label: 'All Coins' },
                                { id: 'watchlist', label: `⭐ Watchlist (${favorites.length})` },
                                { id: 'myAssets', label: 'My Balance > 0' },
                                { id: 'gainers', label: '🚀 24h Gainers' },
                            ].map(chip => (
                                <TouchableOpacity
                                    key={chip.id}
                                    onPress={() => setCoinCategoryFilter(chip.id as any)}
                                    style={[s.filterChip, coinCategoryFilter === chip.id && s.filterChipActive]}
                                >
                                    <Text style={[s.filterChipText, coinCategoryFilter === chip.id && s.filterChipTextActive]}>
                                        {chip.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={s.assetCardsGrid}>
                            {filteredAssets.map((asset) => {
                                const bal = cryptoBalances[asset.symbol] || 0;
                                const livePrice = getAssetPriceUsd(asset.symbol);
                                const valNgn = Math.floor(livePrice * getUsdtToNgnRate('sell'));
                                const marketData = assetsRates.find(r => r.symbol?.toUpperCase() === asset.symbol);
                                const change24h = marketData?.percent_change_24h ?? 0;
                                const isPos = change24h >= 0;
                                const topNetwork = asset.networks[0]?.network || 'CHAIN';

                                return (
                                    <TouchableOpacity
                                        key={asset.symbol}
                                        style={s.assetCard}
                                        onPress={() => {
                                            setSelectedCoinDetail(asset);
                                            setActiveModal('assetDetail');
                                        }}
                                        activeOpacity={0.75}
                                    >
                                        <View style={s.assetCardLeft}>
                                            <TouchableOpacity
                                                onPress={() => toggleFavorite(asset.symbol)}
                                                style={s.favStarBtn}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons
                                                    name={favorites.includes(asset.symbol) ? "star" : "star-outline"}
                                                    size={16}
                                                    color={favorites.includes(asset.symbol) ? C.gold : C.textMuted}
                                                />
                                            </TouchableOpacity>
                                            <Image source={{ uri: asset.icon }} style={s.assetLogo} />
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                    <Text style={s.assetSymbol}>{asset.symbol}</Text>
                                                    <View style={s.assetNetworkBadge}>
                                                        <Text style={s.assetNetworkBadgeText}>{topNetwork}</Text>
                                                    </View>
                                                </View>
                                                <Text style={s.assetName}>{asset.name}</Text>
                                            </View>
                                        </View>

                                        <View style={s.assetCardRight}>
                                            <Text style={s.assetBalanceText}>
                                                {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                            </Text>
                                            <View style={s.priceChangeRow}>
                                                <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                                                    <Text style={s.assetPriceText}>${livePrice >= 1 ? livePrice.toLocaleString() : livePrice.toFixed(4)}</Text>
                                                    <Text style={s.assetPriceNgnText}>≈ ₦{valNgn.toLocaleString()}</Text>
                                                </View>
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

                {/* ─── TAB: GAS STATION ⛽ (100% Real NOWPayments Instant Payout) ─── */}
                {activeTab === 'gas' && (
                    <View style={s.gasStationContainer}>
                        {/* Hero Card with Gas Pump & Status */}
                        <View style={s.gasHeroCard}>
                            <View style={s.gasHeroTop}>
                                <View style={s.gasHeroIconBox}>
                                    <Ionicons name="speedometer" size={24} color={C.emerald} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={s.gasHeroTitle}>Instant Crypto Gas Station ⛽</Text>
                                    <Text style={s.gasHeroSub}>
                                        Refill network gas for TRON, BSC, Solana, ETH, Polygon directly to any wallet.
                                    </Text>
                                </View>
                            </View>

                            <View style={s.gasGatewayBadge}>
                                <View style={s.greenLivePulse} />
                                <Text style={s.gasGatewayBadgeText}>NOWPayments Automated Payout Active ⚡</Text>
                            </View>
                        </View>

                        {/* Live Network Radar / Gas Condition Card */}
                        <View style={s.gasRadarCard}>
                            <View style={s.gasRadarHeader}>
                                <Text style={s.gasSectionTitle}>Live Network Radar</Text>
                                <View style={s.radarPill}>
                                    <Text style={s.radarPillText}>Live Conditions</Text>
                                </View>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gasRadarScroll}>
                                {GAS_NETWORKS.map(net => {
                                    const price = getAssetPriceUsd(net.symbol);
                                    const singleCostUsd = net.recommendedSingle * price;
                                    return (
                                        <TouchableOpacity
                                            key={net.id}
                                            onPress={() => {
                                                setSelectedGasNetwork(net);
                                                setGasAmount(net.recommendedSingle.toString());
                                            }}
                                            style={[s.gasRadarItem, selectedGasNetwork.id === net.id && s.gasRadarItemActive]}
                                            activeOpacity={0.8}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Image source={{ uri: net.icon }} style={{ width: 18, height: 18, borderRadius: 9 }} />
                                                <Text style={s.gasRadarSymbol}>{net.symbol}</Text>
                                            </View>
                                            <Text style={s.gasRadarEstTime}>⚡ {net.speed}</Text>
                                            <Text style={s.gasRadarSingleCost}>≈ ${singleCostUsd.toFixed(2)}/tx</Text>
                                            <View style={[s.gasStatusIndicator, { backgroundColor: net.trafficStatus === 'optimal' ? C.emeraldBg : C.goldBg }]}>
                                                <Text style={[s.gasStatusIndicatorText, { color: net.trafficStatus === 'optimal' ? C.emerald : C.gold }]}>
                                                    {net.trafficStatus === 'optimal' ? 'Optimal' : 'Normal'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Gas Refill Configuration Form Card */}
                        <View style={s.gasFormCard}>
                            {/* Step 1: Select Gas Network */}
                            <Text style={s.fieldLabel}>1. SELECT NETWORK GAS TO REFILL:</Text>
                            <View style={s.gasNetworkGrid}>
                                {GAS_NETWORKS.map(net => {
                                    const isSelected = selectedGasNetwork.id === net.id;
                                    return (
                                        <TouchableOpacity
                                            key={net.id}
                                            onPress={() => {
                                                setSelectedGasNetwork(net);
                                                setGasAmount(net.recommendedSingle.toString());
                                            }}
                                            style={[s.gasNetworkCard, isSelected && s.gasNetworkCardActive]}
                                            activeOpacity={0.8}
                                        >
                                            <Image source={{ uri: net.icon }} style={s.gasNetworkIcon} />
                                            <View style={{ flex: 1, marginLeft: 8 }}>
                                                <Text style={[s.gasNetworkSymbol, isSelected && { color: C.navyDark, fontWeight: '800' }]}>{net.symbol}</Text>
                                                <Text style={s.gasNetworkLabel} numberOfLines={1}>{net.networkName}</Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={16} color={C.emerald} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Step 2: Choose Preset or Custom Amount */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
                                <Text style={s.fieldLabel}>2. REFILL AMOUNT ({selectedGasNetwork.symbol}):</Text>
                                <Text style={{ color: C.emerald, fontSize: 11, fontWeight: '700' }}>
                                    1 {selectedGasNetwork.symbol} ≈ ${getAssetPriceUsd(selectedGasNetwork.symbol).toLocaleString()}
                                </Text>
                            </View>

                            {/* 1-Tap Preset Chips */}
                            <View style={s.gasPresetRow}>
                                {[
                                    { label: `⛽ 1 Transfer (${selectedGasNetwork.recommendedSingle})`, val: selectedGasNetwork.recommendedSingle.toString() },
                                    { label: `⚡ 5 Transfers (${selectedGasNetwork.recommendedMedium})`, val: selectedGasNetwork.recommendedMedium.toString() },
                                    { label: `🚀 Pro (${selectedGasNetwork.recommendedPro})`, val: selectedGasNetwork.recommendedPro.toString() },
                                ].map(p => (
                                    <TouchableOpacity
                                        key={p.val}
                                        onPress={() => setGasAmount(p.val)}
                                        style={[s.gasPresetChip, gasAmount === p.val && s.gasPresetChipActive]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[s.gasPresetText, gasAmount === p.val && s.gasPresetTextActive]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Exact Amount Input */}
                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={gasAmount}
                                    onChangeText={setGasAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>{selectedGasNetwork.symbol}</Text>
                            </View>

                            {/* Step 3: Destination Wallet Address */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                                <Text style={s.fieldLabel}>3. DESTINATION WALLET ADDRESS:</Text>
                                <TouchableOpacity 
                                    onPress={() => setActiveModal('addressBook')}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                                >
                                    <Ionicons name="bookmarks-outline" size={12} color={C.navyDark} />
                                    <Text style={{ color: C.navyDark, fontSize: 10, fontWeight: '700' }}>Saved Addresses</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={gasWalletAddress}
                                    onChangeText={setGasWalletAddress}
                                    placeholder={`Paste ${selectedGasNetwork.placeholderAddress}`}
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <TouchableOpacity 
                                    onPress={async () => {
                                        const clip = await Clipboard.getStringAsync();
                                        if (clip) {
                                            setGasWalletAddress(clip.trim());
                                            if (Platform.OS !== 'web') {
                                                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                                            }
                                        }
                                    }}
                                    style={s.pastePill}
                                >
                                    <Text style={s.pastePillText}>Paste</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Address format validity indicator */}
                            {gasWalletAddress.trim().length > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                                    <Ionicons 
                                        name={selectedGasNetwork.prefixValidate(gasWalletAddress.trim()) ? "checkmark-circle" : "alert-circle"} 
                                        size={12} 
                                        color={selectedGasNetwork.prefixValidate(gasWalletAddress.trim()) ? C.emerald : C.rose} 
                                    />
                                    <Text style={{ fontSize: 10, color: selectedGasNetwork.prefixValidate(gasWalletAddress.trim()) ? C.emerald : C.rose, fontWeight: '600' }}>
                                        {selectedGasNetwork.prefixValidate(gasWalletAddress.trim()) 
                                            ? `Valid ${selectedGasNetwork.networkName} format` 
                                            : `Check address: ${selectedGasNetwork.placeholderAddress}`}
                                    </Text>
                                </View>
                            )}

                            {/* Step 4: Payment Method Toggle */}
                            <Text style={[s.fieldLabel, { marginTop: 6 }]}>4. PAY WITH:</Text>
                            <View style={s.sendModeToggle}>
                                <TouchableOpacity
                                    onPress={() => setGasPaymentMethod('NGN')}
                                    style={[s.sendModePill, gasPaymentMethod === 'NGN' && s.sendModePillActive]}
                                >
                                    <Text style={[s.sendModePillText, gasPaymentMethod === 'NGN' && s.sendModePillTextActive]}>
                                        ₦ Naira (₦{nairaBalance.toLocaleString()})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setGasPaymentMethod('USDT')}
                                    style={[s.sendModePill, gasPaymentMethod === 'USDT' && s.sendModePillActive]}
                                >
                                    <Text style={[s.sendModePillText, gasPaymentMethod === 'USDT' && s.sendModePillTextActive]}>
                                        $ USDT ({(cryptoBalances['USDT'] || 0).toFixed(2)} USDT)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Live Cost & Delivery Breakdown Card */}
                            <View style={s.tradeSummaryBox}>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Gas Order</Text>
                                    <Text style={s.tradeSummaryValue}>{gasAmount || '0'} {selectedGasNetwork.symbol}</Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>USD Valuation</Text>
                                    <Text style={s.tradeSummaryValue}>
                                        ≈ ${( (parseFloat(gasAmount || '0') * getAssetPriceUsd(selectedGasNetwork.symbol)) ).toFixed(2)} USD
                                    </Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Total Deduction</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.emerald, fontWeight: '800' }]}>
                                        {gasPaymentMethod === 'NGN' 
                                            ? `₦${Math.ceil((parseFloat(gasAmount || '0') * getAssetPriceUsd(selectedGasNetwork.symbol)) * getUsdtToNgnRate('buy')).toLocaleString()} NGN`
                                            : `${((parseFloat(gasAmount || '0') * getAssetPriceUsd(selectedGasNetwork.symbol))).toFixed(4)} USDT`}
                                    </Text>
                                </View>
                                <View style={s.tradeSummaryRow}>
                                    <Text style={s.tradeSummaryLabel}>Delivery Speed</Text>
                                    <Text style={[s.tradeSummaryValue, { color: C.blue, fontWeight: '700' }]}>
                                        Instant ({selectedGasNetwork.speed} via NOWPayments)
                                    </Text>
                                </View>
                            </View>

                            {/* Instant Refill Action Button */}
                            <TouchableOpacity
                                onPress={handleBuyGas}
                                disabled={gasOrdering}
                                style={[s.primaryModalSubmit, { marginTop: 14 }]}
                                activeOpacity={0.85}
                            >
                                {gasOrdering ? (
                                    <ActivityIndicator color={C.white} size="small" />
                                ) : (
                                    <Text style={s.primaryModalText}>
                                        Refill Gas Now ⛽
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Recent Gas Orders History */}
                        {gasRecentOrders.length > 0 && (
                            <View style={[s.historyListCard, { marginTop: 16 }]}>
                                <Text style={[s.fieldLabel, { marginBottom: 10, paddingHorizontal: 12, paddingTop: 10 }]}>
                                    RECENT GAS ORDERS:
                                </Text>
                                {gasRecentOrders.map((ord, idx) => (
                                    <TouchableOpacity 
                                        key={ord.id || idx} 
                                        style={[s.historyRow, idx !== gasRecentOrders.length - 1 && s.historyRowBorder]}
                                        onPress={() => openReceiptForGasOrder(ord)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                            <View style={[s.actionIconWrap, { width: 32, height: 32, borderRadius: 16, backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}>
                                                <Ionicons name="speedometer" size={16} color={C.emerald} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.historyTypeTitle}>{ord.amount_gas} {ord.gas_type?.toUpperCase()} Gas</Text>
                                                <Text style={s.historyDate} numberOfLines={1}>To: {ord.wallet_address}</Text>
                                                <Text style={[s.historyDate, { fontSize: 10 }]}>{ord.created_at ? new Date(ord.created_at).toLocaleString() : '-'}</Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={s.historyAmountText}>₦{Number(ord.amount_fiat || 0).toLocaleString()}</Text>
                                            <View style={[s.statusPill, s.statusPillSuccess]}>
                                                <Text style={[s.statusPillText, { color: C.emerald }]}>
                                                    {ord.status?.toUpperCase() || 'SUCCESSFUL'}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* ─── TAB 3: INSTANT DEX SWAP ─────────────────────────────────── */}
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
                        {/* Type Filters and Export Button */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterChipsRow, { marginBottom: 0, flex: 1 }]}>
                                {['ALL', 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'BUY', 'SELL'].map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => setHistoryTypeFilter(t as any)}
                                        style={[s.filterChip, historyTypeFilter === t && s.filterChipActive]}
                                    >
                                        <Text style={[s.filterChipText, historyTypeFilter === t && s.filterChipTextActive]}>
                                            {t}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity onPress={handleExportStatement} style={s.exportStatementBtn} activeOpacity={0.8}>
                                <Ionicons name="share-outline" size={13} color={C.navyDark} />
                                <Text style={s.exportStatementBtnText}>Export</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingTxns ? (
                            <ActivityIndicator color={C.navyDark} size="small" style={{ padding: 24 }} />
                        ) : filteredTransactions.length === 0 ? (
                            <View style={s.emptyHistoryCard}>
                                <Ionicons name="receipt-outline" size={36} color={C.textMuted} />
                                <Text style={s.emptyHistoryTitle}>No Crypto Transactions</Text>
                                <Text style={s.emptyHistorySub}>
                                    Your deposits, withdrawals, swaps, and buys will appear here with live blockchain verification.
                                </Text>
                            </View>
                        ) : (
                            <View style={s.historyListCard}>
                                {filteredTransactions.map((tx, idx) => {
                                    const isLast = idx === filteredTransactions.length - 1;
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
                                    } else if (tx.type === 'crypto_transfer_in' || tx.type === 'crypto_transfer_out') {
                                        iconName = 'paper-plane';
                                        iconColor = C.cyan;
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
                                                openReceiptForTransaction(tx);
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
                MODAL 1: ASSET ACTION SHEET (Tapped on a Coin Card)
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'assetDetail'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        {selectedCoinDetail ? (
                            <View>
                                <View style={s.modalHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Image source={{ uri: selectedCoinDetail.icon }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                                        <View>
                                            <Text style={s.modalTitle}>{selectedCoinDetail.name} ({selectedCoinDetail.symbol})</Text>
                                            <Text style={{ color: C.textSub, fontSize: 11 }}>
                                                Price: ${getAssetPriceUsd(selectedCoinDetail.symbol).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                        <Ionicons name="close" size={18} color={C.textSub} />
                                    </TouchableOpacity>
                                </View>

                                {/* User Balance Card for this Coin */}
                                <View style={s.coinBalanceCard}>
                                    <Text style={{ color: C.textSub, fontSize: 10.5, fontWeight: '700' }}>YOUR BALANCE</Text>
                                    <Text style={s.coinBalanceText}>
                                        {(cryptoBalances[selectedCoinDetail.symbol] || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedCoinDetail.symbol}
                                    </Text>
                                    <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800', marginTop: 2 }}>
                                        ≈ ${( (cryptoBalances[selectedCoinDetail.symbol] || 0) * getAssetPriceUsd(selectedCoinDetail.symbol) ).toFixed(2)} USD
                                    </Text>
                                </View>

                                {/* 3 Direct Action Buttons */}
                                <View style={{ gap: 8, marginTop: 14 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setDepositAsset(selectedCoinDetail.symbol);
                                            setDepositNetworkIdx(0);
                                            setActiveModal('deposit');
                                        }}
                                        style={[s.coinActionBtn, { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}
                                    >
                                        <Ionicons name="arrow-down-circle" size={18} color={C.emerald} />
                                        <Text style={[s.coinActionBtnText, { color: C.emerald }]}>Deposit {selectedCoinDetail.symbol}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setWithdrawAsset(selectedCoinDetail.symbol);
                                            setWithdrawNetworkIdx(0);
                                            setActiveModal('withdraw');
                                        }}
                                        style={[s.coinActionBtn, { backgroundColor: C.goldBg, borderColor: '#FDE68A' }]}
                                    >
                                        <Ionicons name="arrow-up-circle" size={18} color={C.gold} />
                                        <Text style={[s.coinActionBtnText, { color: C.gold }]}>Send {selectedCoinDetail.symbol}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setBuyAsset(selectedCoinDetail.symbol);
                                            setActiveModal('buy');
                                        }}
                                        style={[s.coinActionBtn, { backgroundColor: C.blueBg, borderColor: '#BFDBFE' }]}
                                    >
                                        <Ionicons name="card-outline" size={18} color={C.blue} />
                                        <Text style={[s.coinActionBtnText, { color: C.blue }]}>Buy {selectedCoinDetail.symbol} with Naira</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setAlertCoin(selectedCoinDetail.symbol);
                                            setAlertTargetPrice(getAssetPriceUsd(selectedCoinDetail.symbol).toString());
                                            setActiveModal('priceAlert');
                                        }}
                                        style={[s.coinActionBtn, { backgroundColor: C.inputBg, borderColor: C.cardBorder }]}
                                    >
                                        <Ionicons name="notifications-outline" size={18} color={C.navyDark} />
                                        <Text style={[s.coinActionBtnText, { color: C.navyDark }]}>Set Price Alert 🔔</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setCalcCoin(selectedCoinDetail.symbol);
                                            setActiveModal('converter');
                                        }}
                                        style={[s.coinActionBtn, { backgroundColor: C.inputBg, borderColor: C.cardBorder }]}
                                    >
                                        <Ionicons name="calculator-outline" size={18} color={C.navyDark} />
                                        <Text style={[s.coinActionBtnText, { color: C.navyDark }]}>Live Converter & Calculator 🧮</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 2: DEPOSIT / RECEIVE VIA NOWPAYMENTS
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

                            {/* DEPOSIT SUCCESS OR ACTIVE NOTICE */}
                            {depositSuccessNotice ? (
                                <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 10, padding: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="checkmark-circle" size={20} color={C.emerald} />
                                    <Text style={{ color: '#065F46', fontSize: 12, fontWeight: '700', flex: 1 }}>{depositSuccessNotice}</Text>
                                </View>
                            ) : null}

                            {/* ON-DEMAND VERIFY BUTTON */}
                            <TouchableOpacity 
                                onPress={handleVerifyDeposit}
                                disabled={verifyingDeposit || depositLoading || !depositAddress}
                                style={[s.primaryModalSubmit, { backgroundColor: C.emerald, marginTop: 12, marginBottom: 4 }]}
                                activeOpacity={0.85}
                            >
                                {verifyingDeposit ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={s.primaryModalText}>Checking Blockchain & Gateway...</Text>
                                    </View>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <Ionicons name="refresh-circle-outline" size={18} color="#FFFFFF" />
                                        <Text style={s.primaryModalText}>I Have Sent Deposit &bull; Check Status ⚡</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => loadNowPaymentsAddress(depositAsset, depositNetworkIdx, true)}
                                disabled={depositLoading || verifyingDeposit}
                                style={{ alignItems: 'center', paddingVertical: 6, marginBottom: 8 }}
                            >
                                <Text style={{ fontSize: 11, color: C.navyDark, fontWeight: '600' }}>🔄 Generate Fresh Address / Invoice</Text>
                            </TouchableOpacity>

                            <View style={s.depositWarning}>
                                <Text style={s.depositWarningText}>
                                    Send only {depositAsset} via {SUPPORTED_ASSETS.find(a => a.symbol === depositAsset)?.networks[depositNetworkIdx]?.label}. 
                                    Deposit Fee: 0% (FREE). Credits automatically upon blockchain confirmation or via 'Check Status'.
                                </Text>
                            </View>

                            <View style={s.modalButtonsRow}>
                                <TouchableOpacity 
                                    onPress={async () => {
                                        if (!depositAddress) return;
                                        try {
                                            await Share.share({
                                                message: `My ${depositAsset} address on Abu Mafhal Hub:\n${depositAddress}`
                                            });
                                        } catch {}
                                    }} 
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
                MODAL 3: SEND CRYPTO (Dual Mode: External vs Internal 0 Gas)
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'withdraw'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Send Crypto</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        {/* Send Mode Toggle: External Blockchain vs Internal 0 Gas */}
                        <View style={s.sendModeToggle}>
                            <TouchableOpacity
                                onPress={() => setSendMode('external')}
                                style={[s.sendModePill, sendMode === 'external' && s.sendModePillActive]}
                            >
                                <Text style={[s.sendModePillText, sendMode === 'external' && s.sendModePillTextActive]}>
                                    External Blockchain
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSendMode('internal')}
                                style={[s.sendModePill, sendMode === 'internal' && s.sendModePillActive]}
                            >
                                <Text style={[s.sendModePillText, sendMode === 'internal' && s.sendModePillTextActive]}>
                                    Internal User (0 Gas) ⚡
                                </Text>
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

                            {/* Mode Specific Inputs */}
                            {sendMode === 'external' ? (
                                <>
                                    {/* Destination Network */}
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

                                    {/* Recipient Address with Whitelist Picker Button */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={s.fieldLabel}>RECIPIENT ADDRESS:</Text>
                                        <TouchableOpacity 
                                            onPress={() => setActiveModal('addressBook')}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}
                                        >
                                            <Ionicons name="bookmarks-outline" size={12} color={C.navyDark} />
                                            <Text style={{ color: C.navyDark, fontSize: 10, fontWeight: '700' }}>Address Book</Text>
                                        </TouchableOpacity>
                                    </View>

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
                                </>
                            ) : (
                                <>
                                    {/* Internal User Lookup */}
                                    <Text style={s.fieldLabel}>RECIPIENT PHONE / USERNAME:</Text>
                                    <View style={s.modalInputWrap}>
                                        <TextInput
                                            value={transferRecipientInput}
                                            onChangeText={(val) => {
                                                setTransferRecipientInput(val);
                                                resolveInternalRecipient(val);
                                            }}
                                            placeholder="Phone number or username..."
                                            placeholderTextColor={C.textMuted}
                                            style={s.modalTextInput}
                                        />
                                        {transferResolving && (
                                            <ActivityIndicator size="small" color={C.navyDark} />
                                        )}
                                    </View>

                                    {transferResolvedRecipient && (
                                        <View style={s.verifiedRecipientCard}>
                                            <Ionicons name="checkmark-circle" size={18} color={C.emerald} />
                                            <View style={{ marginLeft: 8 }}>
                                                <Text style={s.verifiedRecipientName}>
                                                    {transferResolvedRecipient.full_name || 'Abu Mafhal User'}
                                                </Text>
                                                <Text style={{ color: C.emerald, fontSize: 10, fontWeight: '600' }}>
                                                    {transferResolvedRecipient.phone || transferResolvedRecipient.username}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </>
                            )}

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

                            {(() => {
                                const selectedNetObj = SUPPORTED_ASSETS.find(a => a.symbol === withdrawAsset)?.networks[withdrawNetworkIdx];
                                const netKey = selectedNetObj?.network || 'TRC20';
                                const activeFee = sendMode === 'internal' ? 0 : getNetworkWithdrawFee(netKey, withdrawAsset);
                                const numAmt = parseFloat(withdrawAmount || '0') || 0;
                                const totalAmt = numAmt > 0 ? (numAmt + activeFee) : 0;

                                return (
                                    <View style={s.withdrawEstimateBox}>
                                        <View style={s.withdrawEstimateRow}>
                                            <Text style={s.withdrawEstimateLabel}>Amount to Send</Text>
                                            <Text style={s.withdrawEstimateValue}>
                                                {numAmt} {withdrawAsset} (≈ ${(numAmt * getAssetPriceUsd(withdrawAsset)).toFixed(2)})
                                            </Text>
                                        </View>
                                        <View style={s.withdrawEstimateRow}>
                                            <Text style={s.withdrawEstimateLabel}>Network / Gas Fee</Text>
                                            <Text style={[s.withdrawEstimateValue, { color: activeFee === 0 ? C.emerald : C.navyDark, fontWeight: '700' }]}>
                                                {activeFee === 0 ? 'FREE (₦0.00)' : `${activeFee} ${withdrawAsset}`}
                                            </Text>
                                        </View>
                                        <View style={[s.withdrawEstimateRow, { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 6, marginTop: 4 }]}>
                                            <Text style={[s.withdrawEstimateLabel, { fontWeight: '700', color: C.navyDark }]}>Total Deducted</Text>
                                            <Text style={[s.withdrawEstimateValue, { fontWeight: '800', color: C.navyDark, fontSize: 13 }]}>
                                                {totalAmt.toFixed(4)} {withdrawAsset}
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>
                                            🛡️ 100% automated refund rollback if network or gateway fails.
                                        </Text>
                                    </View>
                                );
                            })()}

                            <TouchableOpacity
                                onPress={handleInitiateSend}
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
                MODAL 4: BUY CRYPTO WITH NAIRA WALLET
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
                MODAL 5: SELL CRYPTO TO NAIRA WALLET
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
                MODAL 6: ADDRESS BOOK (WHITELISTED WALLETS)
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'addressBook'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <View style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Address Book</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Add New */}
                            <Text style={s.fieldLabel}>ADD NEW WALLET:</Text>
                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={newWalletNickname}
                                    onChangeText={setNewWalletNickname}
                                    placeholder="Nickname (e.g. Binance USDT)..."
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                            </View>
                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={newWalletAddress}
                                    onChangeText={setNewWalletAddress}
                                    placeholder="Wallet address..."
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                            </View>
                            <TouchableOpacity onPress={handleSaveWallet} style={s.primaryModalSubmit}>
                                <Text style={s.primaryModalText}>Save to Address Book</Text>
                            </TouchableOpacity>

                            {/* Saved List */}
                            <Text style={[s.fieldLabel, { marginTop: 16 }]}>SAVED ADDRESSES:</Text>
                            {savedWallets.length === 0 ? (
                                <Text style={{ color: C.textMuted, fontSize: 11, fontStyle: 'italic', marginVertical: 8 }}>
                                    No saved addresses yet.
                                </Text>
                            ) : (
                                savedWallets.map(w => (
                                    <View key={w.id} style={s.savedWalletRow}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <Text style={{ color: C.textMain, fontSize: 12, fontWeight: '700' }}>{w.nickname}</Text>
                                            <Text style={{ color: C.textSub, fontSize: 9.5 }} numberOfLines={1}>{w.address}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    setWithdrawAddress(w.address);
                                                    setActiveModal('withdraw');
                                                }}
                                                style={s.useBtn}
                                            >
                                                <Text style={s.useBtnText}>Use</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDeleteSavedWallet(w.id)} style={s.deleteBtn}>
                                                <Ionicons name="trash-outline" size={13} color={C.rose} />
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
                MODAL 7: COMPACT MODERN LIGHT-THEME RECEIPT (REAL PDF EXPORT & SHARE)
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={activeModal === 'txReceipt'}
                transparent
                animationType="fade"
                onRequestClose={() => setActiveModal(null)}
            >
                <View style={s.receiptModalBackdrop}>
                    <View style={s.receiptModalCard}>
                        {/* Header Row */}
                        <View style={s.receiptModalHeader}>
                            <View style={s.receiptOfficialBadge}>
                                <View style={s.receiptOfficialDot} />
                                <Text style={s.receiptOfficialBadgeText}>OFFICIAL RECEIPT</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setActiveModal(null)}
                                style={s.receiptCloseCircleBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {selectedTx ? (
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 4 }}
                                style={{ maxHeight: '84%' }}
                            >
                                {/* Hero Card Section */}
                                <View style={s.receiptHeroBox}>
                                    <View style={s.receiptIconCircleWrap}>
                                        <Image
                                            source={{ uri: selectedTx.icon || 'https://assets.coingecko.com/coins/images/325/large/Tether.png' }}
                                            style={s.receiptCoinMainIcon}
                                        />
                                        <View style={s.receiptNetworkSubBadge}>
                                            <Ionicons name="flash" size={9} color="#FFFFFF" />
                                        </View>
                                    </View>
                                    <Text style={s.receiptHeroSub}>{selectedTx.symbol || 'USDT'} Refill / Transfer</Text>
                                    <Text style={s.receiptHeroAmount}>- {selectedTx.amountSent || `${selectedTx.amount} USDT`}</Text>
                                    
                                    <View style={s.receiptStatusPillRow}>
                                        <View style={s.receiptStatusPill}>
                                            <Ionicons name="checkmark-circle" size={13} color="#059669" />
                                            <Text style={s.receiptStatusPillText}>{selectedTx.status || 'Successful'}</Text>
                                        </View>
                                        <Text style={s.receiptDateInline}>
                                            {formatReceiptDate(selectedTx.date || selectedTx.created_at || new Date())}
                                        </Text>
                                    </View>
                                </View>

                                {/* Dashed Divider */}
                                <View style={s.receiptDashedLine} />

                                {/* Compact Details Table */}
                                <View style={s.receiptDetailsTable}>
                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Transaction Type</Text>
                                        <Text style={s.receiptValueText}>{selectedTx.type || 'Gas fee'}</Text>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Network</Text>
                                        <Text style={s.receiptValueText}>{selectedTx.networkName || 'TRON (TRC20)'}</Text>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Recipient Address</Text>
                                        <TouchableOpacity
                                            style={s.receiptCopyRow}
                                            onPress={async () => {
                                                if (selectedTx.recipient) {
                                                    await Clipboard.setStringAsync(selectedTx.recipient);
                                                    Alert.alert("Copied", "Recipient address copied to clipboard");
                                                }
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={s.receiptValueMono}>
                                                {selectedTx.recipient && selectedTx.recipient.length > 16
                                                    ? `${selectedTx.recipient.slice(0, 7)}...${selectedTx.recipient.slice(-6)}`
                                                    : (selectedTx.recipient || '-')}
                                            </Text>
                                            <Ionicons name="copy-outline" size={13} color="#0284C7" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Amount Paid (Fiat)</Text>
                                        <Text style={[s.receiptValueText, { color: '#0F172A', fontWeight: '800' }]}>
                                            {selectedTx.amountPaid || `₦${Number(selectedTx.amount || 0).toLocaleString()}`}
                                        </Text>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Paid From</Text>
                                        <Text style={s.receiptValueText}>{selectedTx.paidFrom || 'Abu Mafhal Hub wallet'}</Text>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Network Fee</Text>
                                        <Text style={s.receiptValueText}>{selectedTx.networkFee || '0.15 USDT ≈ $0.15'}</Text>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Reference / ID</Text>
                                        <TouchableOpacity
                                            style={s.receiptCopyRow}
                                            onPress={async () => {
                                                const tid = selectedTx.txId || selectedTx.reference || selectedTx.id || '';
                                                if (tid) {
                                                    await Clipboard.setStringAsync(tid);
                                                    Alert.alert("Copied", "Transaction ID copied to clipboard");
                                                }
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={s.receiptValueMono}>
                                                {(selectedTx.txId || selectedTx.reference || 'qu8y1mOe').slice(0, 14)}
                                            </Text>
                                            <Ionicons name="copy-outline" size={13} color="#0284C7" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={s.receiptTableRow}>
                                        <Text style={s.receiptLabelText}>Explorer Status</Text>
                                        <TouchableOpacity
                                            style={s.receiptLinkRow}
                                            onPress={() => {
                                                const url = selectedTx.explorerUrl || `https://tronscan.org/#/address/${selectedTx.recipient || ''}`;
                                                Linking.openURL(url);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={s.receiptLinkText}>View on Chain</Text>
                                            <Ionicons name="open-outline" size={13} color="#0284C7" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[s.receiptTableRow, { borderBottomWidth: 0 }]}>
                                        <Text style={s.receiptLabelText}>Date</Text>
                                        <Text style={[s.receiptValueText, { fontSize: 11 }]}>
                                            {formatFullReceiptDate(selectedTx.date || selectedTx.created_at || new Date())}
                                        </Text>
                                    </View>
                                </View>

                                {/* Action Buttons: Share PDF & Save PDF */}
                                <View style={s.receiptActionButtonsRow}>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            try {
                                                await shareCryptoReceiptPdf({
                                                    type: selectedTx.type || 'Gas fee',
                                                    symbol: selectedTx.symbol || 'USDT',
                                                    networkName: selectedTx.networkName || 'TRON (TRC20)',
                                                    status: selectedTx.status || 'Successful',
                                                    date: selectedTx.date || new Date(),
                                                    recipient: selectedTx.recipient || '',
                                                    amountSent: selectedTx.amountSent || `${selectedTx.amount} USDT`,
                                                    amountPaid: selectedTx.amountPaid || `₦${Number(selectedTx.amount || 0).toLocaleString()}`,
                                                    paidFrom: selectedTx.paidFrom || 'Abu Mafhal Hub wallet',
                                                    networkFee: selectedTx.networkFee || '0.15 USDT ≈ $0.15',
                                                    txId: selectedTx.txId || selectedTx.reference || '',
                                                    txHash: selectedTx.txHash || '',
                                                    explorerUrl: selectedTx.explorerUrl,
                                                    reference: selectedTx.txId || selectedTx.reference,
                                                });
                                            } catch (err: any) {
                                                Alert.alert("Share Failed", err?.message || "Could not generate PDF receipt.");
                                            }
                                        }}
                                        style={s.receiptShareBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="share-social-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={s.receiptShareBtnText}>Share PDF</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={async () => {
                                            try {
                                                const uri = await saveCryptoReceiptPdf({
                                                    type: selectedTx.type || 'Gas fee',
                                                    symbol: selectedTx.symbol || 'USDT',
                                                    networkName: selectedTx.networkName || 'TRON (TRC20)',
                                                    status: selectedTx.status || 'Successful',
                                                    date: selectedTx.date || new Date(),
                                                    recipient: selectedTx.recipient || '',
                                                    amountSent: selectedTx.amountSent || `${selectedTx.amount} USDT`,
                                                    amountPaid: selectedTx.amountPaid || `₦${Number(selectedTx.amount || 0).toLocaleString()}`,
                                                    paidFrom: selectedTx.paidFrom || 'Abu Mafhal Hub wallet',
                                                    networkFee: selectedTx.networkFee || '0.15 USDT ≈ $0.15',
                                                    txId: selectedTx.txId || selectedTx.reference || '',
                                                    txHash: selectedTx.txHash || '',
                                                    explorerUrl: selectedTx.explorerUrl,
                                                    reference: selectedTx.txId || selectedTx.reference,
                                                });
                                                if (uri && Platform.OS !== 'web') {
                                                    Alert.alert("Receipt Saved", "PDF receipt generated and downloaded successfully.");
                                                }
                                            } catch (err: any) {
                                                Alert.alert("Save Failed", err?.message || "Could not save PDF receipt.");
                                            }
                                        }}
                                        style={s.receiptSaveBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="download-outline" size={17} color="#0F172A" style={{ marginRight: 6 }} />
                                        <Text style={s.receiptSaveBtnText}>Save PDF</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* WhatsApp Support Touchpoint */}
                                <TouchableOpacity
                                    onPress={() => {
                                        const wa = settings?.support_whatsapp || '2348144444444';
                                        const ref = selectedTx.txId || selectedTx.reference || selectedTx.id || '';
                                        const msg = `Hello Abu Mafhal Support, I need assistance regarding my crypto transaction (ID: ${ref}).`;
                                        Linking.openURL(`https://wa.me/${wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`);
                                    }}
                                    style={s.receiptSupportCard}
                                    activeOpacity={0.8}
                                >
                                    <View style={s.receiptSupportIconWrap}>
                                        <Ionicons name="logo-whatsapp" size={18} color="#059669" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.receiptSupportCardTitle}>Need Assistance?</Text>
                                        <Text style={s.receiptSupportCardSub}>Chat with our support team on WhatsApp.</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 8: LIVE CONVERTER & CALCULATOR
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'converter'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.actionIconWrap, { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldBg, borderColor: '#FDE68A' }]}>
                                    <Ionicons name="calculator" size={16} color={C.gold} />
                                </View>
                                <View>
                                    <Text style={s.modalTitle}>Crypto Converter</Text>
                                    <Text style={{ color: C.textSub, fontSize: 10.5 }}>Real-time live rate calculator</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Coin Selector */}
                            <Text style={s.fieldLabel}>SELECT COIN:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.assetSelectorScroll}>
                                {SUPPORTED_ASSETS.map(asset => (
                                    <TouchableOpacity
                                        key={asset.symbol}
                                        onPress={() => setCalcCoin(asset.symbol)}
                                        style={[s.modalAssetChip, calcCoin === asset.symbol && s.modalAssetChipActive]}
                                    >
                                        <Image source={{ uri: asset.icon }} style={s.modalAssetIcon} />
                                        <Text style={[s.modalAssetText, calcCoin === asset.symbol && s.modalAssetTextActive]}>
                                            {asset.symbol}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Amount Input with Unit Toggle */}
                            <Text style={s.fieldLabel}>ENTER AMOUNT IN:</Text>
                            <View style={s.calcUnitToggleRow}>
                                {[
                                    { id: 'crypto', label: calcCoin },
                                    { id: 'ngn', label: 'Naira (₦)' },
                                    { id: 'usd', label: 'USD ($)' },
                                ].map(u => (
                                    <TouchableOpacity
                                        key={u.id}
                                        onPress={() => setCalcMode(u.id as any)}
                                        style={[s.calcUnitChip, calcMode === u.id && s.calcUnitChipActive]}
                                    >
                                        <Text style={[s.calcUnitChipText, calcMode === u.id && s.calcUnitChipTextActive]}>
                                            {u.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={s.modalInputWrap}>
                                <TextInput
                                    value={calcAmount}
                                    onChangeText={setCalcAmount}
                                    keyboardType="numeric"
                                    placeholder="1.00"
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>
                                    {calcMode === 'crypto' ? calcCoin : calcMode === 'ngn' ? 'NGN' : 'USD'}
                                </Text>
                            </View>

                            {/* Conversion Results Box */}
                            <View style={s.calcResultsBox}>
                                <View style={s.calcResultRow}>
                                    <Text style={s.calcResultLabel}>{calcCoin} Quantity</Text>
                                    <Text style={s.calcResultValue}>
                                        {converterValues.convertedCrypto.toLocaleString(undefined, { maximumFractionDigits: 6 })} {calcCoin}
                                    </Text>
                                </View>
                                <View style={s.calcResultRow}>
                                    <Text style={s.calcResultLabel}>USD Equivalent</Text>
                                    <Text style={[s.calcResultValue, { color: C.blue }]}>
                                        ${converterValues.convertedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                    </Text>
                                </View>
                                <View style={s.calcResultRow}>
                                    <Text style={s.calcResultLabel}>Naira Valuation</Text>
                                    <Text style={[s.calcResultValue, { color: C.emerald, fontWeight: '800' }]}>
                                        ₦{Math.floor(converterValues.convertedNgn).toLocaleString()} NGN
                                    </Text>
                                </View>
                                <View style={[s.calcResultRow, { borderBottomWidth: 0, paddingTop: 6 }]}>
                                    <Text style={{ color: C.textMuted, fontSize: 10 }}>Live Market Reference:</Text>
                                    <Text style={{ color: C.textSub, fontSize: 10, fontWeight: '600' }}>
                                        1 {calcCoin} ≈ ${converterValues.coinPriceUsd.toLocaleString()} (₦{Math.floor(converterValues.coinPriceUsd * converterValues.usdtRate).toLocaleString()})
                                    </Text>
                                </View>
                            </View>

                            {/* Action Shortcuts */}
                            <View style={{ gap: 8, marginTop: 12 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setBuyAsset(calcCoin);
                                        setBuyNgnAmount(Math.floor(converterValues.convertedNgn || 10000).toString());
                                        setActiveModal('buy');
                                    }}
                                    style={[s.primaryModalSubmit, { backgroundColor: C.blueBg, borderWidth: 1, borderColor: '#BFDBFE' }]}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="card-outline" size={16} color={C.blue} style={{ marginRight: 6 }} />
                                    <Text style={[s.primaryModalText, { color: C.blue }]}>Buy {calcCoin} with Naira</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setSwapTo(calcCoin);
                                        setActiveModal(null);
                                        setActiveTab('trade');
                                    }}
                                    style={[s.primaryModalSubmit, { backgroundColor: C.purpleBg, borderWidth: 1, borderColor: '#DDD6FE' }]}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="swap-horizontal" size={16} color={C.purple} style={{ marginRight: 6 }} />
                                    <Text style={[s.primaryModalText, { color: C.purple }]}>Instant Swap to {calcCoin}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL 9: TARGET PRICE ALERTS
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal visible={activeModal === 'priceAlert'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={[s.modalCard, isWeb && s.webModalCard]}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.actionIconWrap, { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldBg, borderColor: '#FDE68A' }]}>
                                    <Ionicons name="notifications" size={16} color={C.gold} />
                                </View>
                                <View>
                                    <Text style={s.modalTitle}>Price Alerts 🔔</Text>
                                    <Text style={{ color: C.textSub, fontSize: 10.5 }}>Target Price Notifications</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={C.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={s.fieldLabel}>CHOOSE COIN:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.assetSelectorScroll}>
                                {SUPPORTED_ASSETS.map(asset => (
                                    <TouchableOpacity
                                        key={asset.symbol}
                                        onPress={() => setAlertCoin(asset.symbol)}
                                        style={[s.modalAssetChip, alertCoin === asset.symbol && s.modalAssetChipActive]}
                                    >
                                        <Image source={{ uri: asset.icon }} style={s.modalAssetIcon} />
                                        <Text style={[s.modalAssetText, alertCoin === asset.symbol && s.modalAssetTextActive]}>
                                            {asset.symbol}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Condition: Above vs Below */}
                            <Text style={s.fieldLabel}>NOTIFY WHEN PRICE GOES:</Text>
                            <View style={s.sendModeToggle}>
                                <TouchableOpacity
                                    onPress={() => setAlertCondition('above')}
                                    style={[s.sendModePill, alertCondition === 'above' && s.sendModePillActive]}
                                >
                                    <Text style={[s.sendModePillText, alertCondition === 'above' && s.sendModePillTextActive]}>
                                        📈 Above Target (≥)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setAlertCondition('below')}
                                    style={[s.sendModePill, alertCondition === 'below' && s.sendModePillActive]}
                                >
                                    <Text style={[s.sendModePillText, alertCondition === 'below' && s.sendModePillTextActive]}>
                                        📉 Below Target (≤)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Target Price in USD */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                                <Text style={s.fieldLabel}>TARGET PRICE (USD):</Text>
                                <Text style={{ color: C.textSub, fontSize: 11 }}>
                                    Current: ${getAssetPriceUsd(alertCoin).toLocaleString()}
                                </Text>
                            </View>

                            <View style={s.modalInputWrap}>
                                <Text style={{ color: C.textMuted, fontSize: 16, fontWeight: '700', marginRight: 4 }}>$</Text>
                                <TextInput
                                    value={alertTargetPrice}
                                    onChangeText={setAlertTargetPrice}
                                    keyboardType="numeric"
                                    placeholder={getAssetPriceUsd(alertCoin).toString()}
                                    placeholderTextColor={C.textMuted}
                                    style={s.modalTextInput}
                                />
                                <Text style={s.inputCurrencySuffix}>USD</Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleAddPriceAlert}
                                style={[s.primaryModalSubmit, { marginTop: 12 }]}
                                activeOpacity={0.85}
                            >
                                <Text style={s.primaryModalText}>Set Price Alert</Text>
                            </TouchableOpacity>

                            {/* Active Alerts List */}
                            <Text style={[s.fieldLabel, { marginTop: 18 }]}>ACTIVE ALERTS ({priceAlerts.length}):</Text>
                            {priceAlerts.length === 0 ? (
                                <Text style={{ color: C.textMuted, fontSize: 11, fontStyle: 'italic', marginVertical: 8 }}>
                                    No active price alerts set yet.
                                </Text>
                            ) : (
                                priceAlerts.map(a => (
                                    <View key={a.id} style={s.savedWalletRow}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <Text style={{ color: C.textMain, fontSize: 12, fontWeight: '700' }}>
                                                {a.asset} {a.condition === 'above' ? '≥' : '≤'} ${a.targetPrice.toLocaleString()}
                                            </Text>
                                            <Text style={{ color: C.textSub, fontSize: 9.5 }}>
                                                Current: ${getAssetPriceUsd(a.asset).toLocaleString()}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeletePriceAlert(a.id)} style={s.deleteBtn}>
                                            <Ionicons name="trash-outline" size={13} color={C.rose} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* SECURITY CONFIRMATION MODAL */}
            <SecurityModal
                visible={showSecurityModal}
                onClose={() => {
                    setShowSecurityModal(false);
                    pendingSecurityActionRef.current = null;
                    setSecurityAction(null);
                }}
                onSuccess={(pin) => {
                    setShowSecurityModal(false);
                    const actionToRun = pendingSecurityActionRef.current || securityAction;
                    pendingSecurityActionRef.current = null;
                    setSecurityAction(null);
                    if (actionToRun) {
                        setTimeout(() => {
                            try {
                                const res = actionToRun(pin);
                                if (typeof res === 'function') {
                                    (res as any)(pin);
                                }
                            } catch (e: any) {
                                console.error("Error executing security action:", e);
                            }
                        }, 300);
                    }
                }}
                title="Authorize Crypto Payout"
                description={securityDescription}
                requiredFor="crypto"
            />

            {/* IN-APP GAS RESULT & STATUS MODAL (Guarantees visible feedback on Mobile & Web) */}
            <Modal
                visible={gasResultDialog.visible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (gasResultDialog.type !== 'loading') {
                        setGasResultDialog(prev => ({ ...prev, visible: false }));
                    }
                }}
            >
                <View style={s.resultModalBackdrop}>
                    <View style={s.resultModalCard}>
                        {gasResultDialog.type === 'loading' ? (
                            <View style={s.resultModalIconWrapLoading}>
                                <ActivityIndicator size="large" color={C.blue} />
                            </View>
                        ) : gasResultDialog.type === 'success' ? (
                            <View style={s.resultModalIconWrapSuccess}>
                                <Ionicons name="checkmark-circle" size={48} color={C.emerald} />
                            </View>
                        ) : (
                            <View style={s.resultModalIconWrapError}>
                                <Ionicons name="alert-circle" size={48} color={C.rose} />
                            </View>
                        )}

                        <Text style={s.resultModalTitle}>{gasResultDialog.title}</Text>
                        <Text style={s.resultModalMessage}>{gasResultDialog.message}</Text>

                        {gasResultDialog.amount && (
                            <View style={s.resultModalDetailsBox}>
                                <View style={s.resultModalRow}>
                                    <Text style={s.resultModalLabel}>Amount</Text>
                                    <Text style={s.resultModalValueBold}>{gasResultDialog.amount}</Text>
                                </View>
                                {gasResultDialog.network && (
                                    <View style={s.resultModalRow}>
                                        <Text style={s.resultModalLabel}>Network</Text>
                                        <Text style={s.resultModalValue}>{gasResultDialog.network}</Text>
                                    </View>
                                )}
                                {gasResultDialog.txRef && (
                                    <View style={s.resultModalRow}>
                                        <Text style={s.resultModalLabel}>Reference</Text>
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                            onPress={async () => {
                                                if (gasResultDialog.txRef) {
                                                    await Clipboard.setStringAsync(gasResultDialog.txRef);
                                                    Alert.alert("Copied", "Reference copied to clipboard");
                                                }
                                            }}
                                        >
                                            <Text style={[s.resultModalValue, { color: C.blue, fontWeight: '700' }]}>
                                                {gasResultDialog.txRef.length > 16 
                                                    ? `${gasResultDialog.txRef.slice(0, 8)}...${gasResultDialog.txRef.slice(-6)}` 
                                                    : gasResultDialog.txRef}
                                            </Text>
                                            <Ionicons name="copy-outline" size={13} color={C.blue} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {gasResultDialog.type !== 'loading' && (
                            <View style={{ width: '100%', gap: 10 }}>
                                {gasResultDialog.type === 'success' && selectedTx && (
                                    <TouchableOpacity
                                        style={[s.resultModalActionBtn, { backgroundColor: '#0284C7' }]}
                                        onPress={() => {
                                            setGasResultDialog(prev => ({ ...prev, visible: false }));
                                            setTimeout(() => setActiveModal('txReceipt'), 150);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="receipt-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={s.resultModalActionBtnText}>
                                                View Official Receipt 🧾
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[
                                        s.resultModalActionBtn,
                                        gasResultDialog.type === 'error' && { backgroundColor: C.navyDark }
                                    ]}
                                    onPress={() => setGasResultDialog(prev => ({ ...prev, visible: false }))}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.resultModalActionBtnText}>
                                        {gasResultDialog.type === 'success' ? 'Done' : 'Close & Retry'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
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
        overflow: 'hidden',
        position: 'relative',
    },
    heroWatermarkWrap: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
    },
    heroLiveTickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    heroLiveTickerText: {
        color: C.textSub,
        fontSize: 9.5,
        fontWeight: '700',
        marginLeft: 4,
    },
    heroNetworkCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 6,
    },
    heroNetworkCountText: {
        color: C.gold,
        fontSize: 8.5,
        fontWeight: '800',
    },
    tickerTapeContainer: {
        backgroundColor: C.card,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tickerTapeScroll: {
        paddingHorizontal: 12,
        gap: 8,
    },
    tickerTapePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 5,
    },
    tickerTapeSym: {
        color: C.navyDark,
        fontSize: 10,
        fontWeight: '900',
    },
    tickerTapePrice: {
        color: C.textMain,
        fontSize: 10,
        fontWeight: '700',
    },
    tickerTapeChange: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    featuresHubSection: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2,
    },
    featuresHubHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    featuresHubTitle: {
        color: C.navyDark,
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    featuresHubStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        gap: 4,
    },
    featuresHubStatusText: {
        color: C.emerald,
        fontSize: 9,
        fontWeight: '800',
    },
    featuresHubGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    featureHubCard: {
        width: '48.5%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 9,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    featureHubIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    featureHubCardTitle: {
        color: C.textMain,
        fontSize: 11,
        fontWeight: '800',
    },
    featureHubCardDesc: {
        color: C.textMuted,
        fontSize: 8.5,
        fontWeight: '500',
        marginTop: 1,
    },
    featureMiniBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    featureMiniBadgeText: {
        fontSize: 7.5,
        fontWeight: '900',
    },
    assetNetworkBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    assetNetworkBadgeText: {
        color: C.textSub,
        fontSize: 8,
        fontWeight: '800',
    },
    assetPriceNgnText: {
        color: C.textMuted,
        fontSize: 9,
        fontWeight: '600',
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginVertical: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: C.textMain,
        fontSize: 12,
        fontWeight: '600',
    },
    filterChipsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    filterChip: {
        backgroundColor: C.card,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    filterChipActive: {
        backgroundColor: C.navyDark,
        borderColor: C.navyDark,
    },
    filterChipText: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: C.white,
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
    // Coin Action Sheet Modal Styles
    coinBalanceCard: {
        backgroundColor: C.inputBg,
        borderRadius: 12,
        padding: 14,
        marginTop: 6,
        alignItems: 'center',
    },
    coinBalanceText: {
        color: C.textMain,
        fontSize: 22,
        fontWeight: '900',
        marginTop: 4,
    },
    coinActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    coinActionBtnText: {
        fontSize: 13,
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
    // Send Mode Switcher
    sendModeToggle: {
        flexDirection: 'row',
        backgroundColor: C.inputBg,
        borderRadius: 10,
        padding: 3,
        marginBottom: 12,
        gap: 4,
    },
    sendModePill: {
        flex: 1,
        paddingVertical: 7,
        alignItems: 'center',
        borderRadius: 8,
    },
    sendModePillActive: {
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    sendModePillText: {
        color: C.textSub,
        fontSize: 10.5,
        fontWeight: '700',
    },
    sendModePillTextActive: {
        color: C.textMain,
        fontWeight: '800',
    },
    verifiedRecipientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.emeraldBg,
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        marginBottom: 10,
    },
    verifiedRecipientName: {
        color: C.textMain,
        fontSize: 11.5,
        fontWeight: '800',
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
        gap: 4,
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
    // Address Book in Modal
    savedWalletRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.inputBg,
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    useBtn: {
        backgroundColor: C.navyDark,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 5,
    },
    useBtnText: {
        color: C.white,
        fontSize: 10,
        fontWeight: '700',
    },
    deleteBtn: {
        backgroundColor: C.roseBg,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 5,
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
    favStarBtn: {
        paddingRight: 6,
        paddingVertical: 4,
    },
    exportStatementBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.inputBg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginLeft: 8,
    },
    exportStatementBtnText: {
        color: C.navyDark,
        fontSize: 10.5,
        fontWeight: '700',
    },
    calcUnitToggleRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    calcUnitChip: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: C.inputBg,
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    calcUnitChipActive: {
        backgroundColor: C.goldBg,
        borderColor: '#FDE68A',
    },
    calcUnitChipText: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '700',
    },
    calcUnitChipTextActive: {
        color: C.gold,
        fontWeight: '800',
    },
    calcResultsBox: {
        backgroundColor: C.inputBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginTop: 6,
        gap: 6,
    },
    calcResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    calcResultLabel: {
        color: C.textSub,
        fontSize: 11,
        fontWeight: '600',
    },
    calcResultValue: {
        color: C.textMain,
        fontSize: 12,
        fontWeight: '800',
    },
    // ─── Gas Station Styles ──────────────────────────────────────────
    gasStationContainer: {
        marginBottom: 20,
    },
    gasHeroCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    gasHeroTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    gasHeroIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: C.emeraldBg,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gasHeroTitle: {
        color: C.navyDark,
        fontSize: 15,
        fontWeight: '800',
    },
    gasHeroSub: {
        color: C.textSub,
        fontSize: 11.5,
        marginTop: 2,
        lineHeight: 16,
    },
    gasGatewayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.emeraldBg,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.emeraldBorder,
        marginTop: 12,
        gap: 6,
    },
    gasGatewayBadgeText: {
        color: C.emerald,
        fontSize: 10.5,
        fontWeight: '700',
    },
    gasRadarCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 12,
    },
    gasRadarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    gasSectionTitle: {
        color: C.navyDark,
        fontSize: 12.5,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    radarPill: {
        backgroundColor: C.blueBg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    radarPillText: {
        color: C.blue,
        fontSize: 10,
        fontWeight: '700',
    },
    gasRadarScroll: {
        gap: 8,
        paddingRight: 10,
    },
    gasRadarItem: {
        backgroundColor: C.inputBg,
        borderRadius: 12,
        padding: 10,
        width: 105,
        borderWidth: 1,
        borderColor: C.cardBorder,
        alignItems: 'flex-start',
    },
    gasRadarItemActive: {
        borderColor: C.emerald,
        backgroundColor: C.emeraldBg,
    },
    gasRadarSymbol: {
        color: C.navyDark,
        fontSize: 12,
        fontWeight: '800',
    },
    gasRadarEstTime: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
    gasRadarSingleCost: {
        color: C.textMain,
        fontSize: 10.5,
        fontWeight: '700',
        marginTop: 2,
    },
    gasStatusIndicator: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 6,
    },
    gasStatusIndicatorText: {
        fontSize: 9,
        fontWeight: '800',
    },
    gasFormCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    gasNetworkGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 6,
    },
    gasNetworkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.inputBg,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        width: '48.5%',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    gasNetworkCardActive: {
        borderColor: C.emerald,
        backgroundColor: C.emeraldBg,
    },
    gasNetworkIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
    },
    gasNetworkSymbol: {
        color: C.textMain,
        fontSize: 12,
        fontWeight: '700',
    },
    gasNetworkLabel: {
        color: C.textSub,
        fontSize: 9.5,
    },
    gasPresetRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    gasPresetChip: {
        flex: 1,
        backgroundColor: C.inputBg,
        borderRadius: 8,
        paddingVertical: 7,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.cardBorder,
    },
    gasPresetChipActive: {
        backgroundColor: C.emeraldBg,
        borderColor: C.emeraldBorder,
    },
    gasPresetText: {
        color: C.textSub,
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    gasPresetTextActive: {
        color: C.emerald,
        fontWeight: '800',
    },
    // ─── Result Modal Styles (Guaranteed In-App Feedback) ─────────────
    resultModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    resultModalCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: C.white,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    resultModalIconWrapLoading: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: C.blueBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    resultModalIconWrapSuccess: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: C.emeraldBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    resultModalIconWrapError: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: C.roseBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    resultModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: C.navyDark,
        textAlign: 'center',
        marginBottom: 8,
    },
    resultModalMessage: {
        fontSize: 13,
        color: C.textSub,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    resultModalDetailsBox: {
        width: '100%',
        backgroundColor: C.inputBg,
        borderRadius: 14,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: C.cardBorder,
        gap: 8,
    },
    resultModalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    resultModalLabel: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '600',
    },
    resultModalValue: {
        fontSize: 12,
        color: C.textMain,
        fontWeight: '600',
    },
    resultModalValueBold: {
        fontSize: 13,
        color: C.navyDark,
        fontWeight: '800',
    },
    resultModalActionBtn: {
        width: '100%',
        backgroundColor: C.emerald,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultModalActionBtnText: {
        color: C.white,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    // ─── Compact Light Theme Receipt Styles (Modern, Decorated, Zero Dark) ──
    receiptModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    receiptModalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
    receiptModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    receiptOfficialBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 6,
    },
    receiptOfficialDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#059669',
    },
    receiptOfficialBadgeText: {
        color: '#059669',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    receiptCloseCircleBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptHeroBox: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    receiptIconCircleWrap: {
        position: 'relative',
        marginBottom: 8,
    },
    receiptCoinMainIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    receiptNetworkSubBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#059669',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    receiptHeroSub: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    receiptHeroAmount: {
        color: '#0F172A',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    receiptStatusPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    receiptStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        gap: 4,
    },
    receiptStatusPillText: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '800',
    },
    receiptDateInline: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    receiptDashedLine: {
        height: 1,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        borderStyle: 'dashed',
        marginVertical: 12,
    },
    receiptTableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2.5,
    },
    receiptLabelText: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '600',
    },
    receiptValueText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'right',
    },
    receiptCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    receiptValueMono: {
        color: '#1E293B',
        fontSize: 11.5,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    receiptLinkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    receiptLinkText: {
        color: '#0284C7',
        fontSize: 11.5,
        fontWeight: '800',
    },
    receiptActionButtonsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    receiptShareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#059669',
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    receiptShareBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    receiptSaveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        paddingVertical: 12,
        borderRadius: 12,
    },
    receiptSaveBtnText: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
    },
    receiptSupportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    receiptSupportIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    receiptSupportCardTitle: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '700',
    },
    receiptSupportCardSub: {
        color: '#64748B',
        fontSize: 10,
    },
});
