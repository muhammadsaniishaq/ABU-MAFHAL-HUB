import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Platform,
    StyleSheet,
    Modal,
    Share,
    KeyboardAvoidingView,
    Image,
    FlatList,
    Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import SecurityModal from '../../components/SecurityModal';
import Device2FAModal from '../../components/Device2FAModal';
import DynamicBanners from '../../components/DynamicBanners';
import { createAppNotification } from '../../services/notificationsHelper';
import { ReceiptData, shareReceiptFile } from '../../services/receiptGenerator';
import ReceiptExportModal from '../../components/ReceiptExportModal';
import ViewShot from 'react-native-view-shot';
import { ABU_MAFHAL_LOGO_B64 } from '../../assets/images/logoB64';

export interface BankItem {
    id: string;
    code: string;
    name: string;
    slug?: string;
    logo?: string;
    color?: string;
}

export interface RecentBeneficiary {
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
    lastUsed: number;
}

const POPULAR_BANK_CODES = ['999992', '999991', '50515', '50211', '058', '057', '044', '011', '033'];

const VERIFIED_BANK_LOGOS: Record<string, string> = {
    '999992': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/paycom.png',
    '100004': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/paycom.png',
    '999991': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/palmpay.png',
    '100033': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/palmpay.png',
    '50515': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/moniepoint-mfb-ng.png',
    '090405': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/moniepoint-mfb-ng.png',
    '50211': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/kuda-bank.png',
    '090267': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/kuda-bank.png',
    '058': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/guaranty-trust-bank.png',
    '057': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/zenith-bank.png',
    '044': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/access-bank.png',
    '063': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/access-bank-diamond.png',
    '011': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/first-bank-of-nigeria.png',
    '033': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/united-bank-for-africa.png',
    '232': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/sterling-bank.png',
    '035': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/wema-bank.png',
    '035A': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/alat-by-wema.png',
    '070': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/fidelity-bank.png',
    '214': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/first-city-monument-bank.png',
    '032': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/union-bank-of-nigeria.png',
    '221': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/stanbic-ibtc-bank.png',
    '076': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/polaris-bank.png',
    '302': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/taj-bank.png',
    '050': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/ecobank-nigeria.png',
    '082': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/keystone-bank.png',
    '303': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/lotus-bank.png',
    '00103': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/globus-bank.png',
    '327': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/paga.png',
    '401': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/asosavings.png',
};

const DEFAULT_BANKS: BankItem[] = [
    { id: '171', code: '999992', name: 'OPay Digital Services (OPay)', logo: VERIFIED_BANK_LOGOS['999992'], color: '#00B050' },
    { id: '169', code: '999991', name: 'PalmPay', logo: VERIFIED_BANK_LOGOS['999991'], color: '#662D91' },
    { id: '688', code: '50515', name: 'Moniepoint MFB', logo: VERIFIED_BANK_LOGOS['50515'], color: '#0056D2' },
    { id: '168', code: '50211', name: 'Kuda Bank', logo: VERIFIED_BANK_LOGOS['50211'], color: '#40196D' },
    { id: '9', code: '058', name: 'Guaranty Trust Bank (GTBank)', logo: VERIFIED_BANK_LOGOS['058'], color: '#E03C31' },
    { id: '21', code: '057', name: 'Zenith Bank', logo: VERIFIED_BANK_LOGOS['057'], color: '#D42E12' },
    { id: '1', code: '044', name: 'Access Bank', logo: VERIFIED_BANK_LOGOS['044'], color: '#0033A1' },
    { id: '7', code: '011', name: 'First Bank of Nigeria', logo: VERIFIED_BANK_LOGOS['011'], color: '#003B70' },
    { id: '20', code: '033', name: 'United Bank for Africa (UBA)', logo: VERIFIED_BANK_LOGOS['033'], color: '#C8102E' },
    { id: '17', code: '232', name: 'Sterling Bank', logo: VERIFIED_BANK_LOGOS['232'], color: '#E31B23' },
    { id: '19', code: '035', name: 'Wema Bank (ALAT)', logo: VERIFIED_BANK_LOGOS['035'], color: '#781848' },
    { id: '6', code: '070', name: 'Fidelity Bank', logo: VERIFIED_BANK_LOGOS['070'], color: '#1B365D' },
    { id: '8', code: '214', name: 'First City Monument Bank (FCMB)', logo: VERIFIED_BANK_LOGOS['214'], color: '#5B2C82' },
    { id: '18', code: '032', name: 'Union Bank of Nigeria', logo: VERIFIED_BANK_LOGOS['032'], color: '#009FE3' },
    { id: '16', code: '221', name: 'Stanbic IBTC Bank', logo: VERIFIED_BANK_LOGOS['221'], color: '#0033A0' },
    { id: '14', code: '076', name: 'Polaris Bank', logo: VERIFIED_BANK_LOGOS['076'], color: '#5C2D91' },
    { id: '166', code: '302', name: 'TAJ Bank', logo: VERIFIED_BANK_LOGOS['302'], color: '#C41230' },
    { id: '5', code: '050', name: 'Ecobank Nigeria', logo: VERIFIED_BANK_LOGOS['050'], color: '#005C8A' },
    { id: '11', code: '082', name: 'Keystone Bank', logo: VERIFIED_BANK_LOGOS['082'], color: '#002B49' },
    { id: '303', code: '303', name: 'Lotus Bank', logo: VERIFIED_BANK_LOGOS['303'], color: '#0A3B32' },
];

export const MIN_TRANSFER_AMOUNT = 100;
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const NARRATION_PRESETS = ['Support', 'Payment', 'Bill', 'Business', 'Family', 'Gift'];

// Safe Bank Logo Component
function BankLogoBadge({ bank, size = 24 }: { bank: BankItem; size?: number }) {
    const [imgFailed, setImgFailed] = useState(false);
    const logoUri = VERIFIED_BANK_LOGOS[bank.code] || bank.logo;

    if (!logoUri || imgFailed) {
        const initial = (bank.name || 'B').charAt(0).toUpperCase();
        const bg = bank.color || '#0F172A';
        return (
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                }}
            >
                <Text style={{ color: '#FFFFFF', fontSize: size * 0.45, fontWeight: '900' }}>{initial}</Text>
            </View>
        );
    }

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#E2E8F0',
            }}
        >
            <Image
                source={{ uri: logoUri }}
                style={{ width: size * 0.85, height: size * 0.85, resizeMode: 'contain' }}
                onError={() => setImgFailed(true)}
            />
        </View>
    );
}

// Convert Transfer details to official ReceiptData for PDF & PNG download
const buildExportReceiptData = (tx: any, senderName?: string): ReceiptData => {
    const isP2P = tx.type === 'p2p';
    const amountVal = Number(tx.amount || 0);
    const feeVal = Number(tx.fee || 0);
    const totalDebitVal = Number(tx.totalDebit || (amountVal + feeVal));
    return {
        reference: tx.reference || `TXN-${Date.now()}`,
        type: isP2P ? 'P2P Wallet Transfer' : 'Bank Account Settlement',
        description: tx.narration || `Transfer to ${tx.recipient} (${tx.bankName || 'Abu Mafhal Wallet'})`,
        amount: totalDebitVal || amountVal,
        transferAmount: amountVal,
        fee: feeVal,
        totalDebit: totalDebitVal,
        recipientName: tx.recipient,
        bankName: tx.bankName,
        accountNumber: tx.accountNumber,
        sessionId: tx.sessionId,
        status: tx.status || 'SUCCESSFUL',
        date: tx.date || new Date().toLocaleString(),
        beneficiary: `${tx.recipient}${tx.accountNumber ? ' • ' + tx.accountNumber : ''} (${tx.bankName || (isP2P ? 'Member' : 'Bank')})`,
        senderName: senderName || 'Abu Mafhal User',
        paymentMethod: isP2P ? 'Abu Mafhal Wallet (P2P)' : 'Direct Bank Settlement (NIBSS Network)',
        notes: tx.narration || undefined,
    };
};

// Formatted Receipt Plaintext (Guaranteed WhatsApp and System Share fallback)
const formatReceiptSummaryText = (tx: any) => {
    if (!tx) return '';
    const isSuccess = !tx.status || tx.status.toUpperCase() === 'SUCCESSFUL' || tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'COMPLETED';
    return `🧾 *ABU MAFHAL HUB - TRANSACTION RECEIPT*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 *Status:* ${isSuccess ? '✅ SUCCESSFUL' : '⏳ PROCESSING / PENDING'}\n` +
        `💰 *Amount:* ₦${Number(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
        `👤 *Beneficiary:* ${tx.recipient || 'Customer'}\n` +
        (tx.bankName ? `🏦 *Bank:* ${tx.bankName}\n` : '') +
        (tx.accountNumber ? `🔢 *Account:* ${tx.accountNumber}\n` : '') +
        `🏷️ *Fee:* ₦${Number(tx.fee || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
        `💳 *Total Debited:* ₦${Number(tx.totalDebit || tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
        `🔒 *Channel:* ${tx.type === 'p2p' ? 'Abu Mafhal Wallet (P2P)' : 'Direct Bank Settlement (NIBSS Network)'}\n` +
        `📋 *Reference:* ${tx.reference}\n` +
        (tx.sessionId ? `🆔 *Session ID:* ${tx.sessionId}\n` : '') +
        `📅 *Date:* ${tx.date}\n` +
        (tx.narration ? `📝 *Narration:* ${tx.narration}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔒 *Verified Electronic Receipt by Abu Mafhal Hub*\n` +
        `Support: help@abumafhal.com`;
};

// Formats dates to Moniepoint format: "Monday, January 20th | 7:53 PM"
export function formatMoniepointDate(rawDate?: any): string {
    if (!rawDate) return 'Today';
    let d = new Date(rawDate);
    if (isNaN(d.getTime())) {
        d = new Date();
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayName = days[d.getDay()];
    const monthName = months[d.getMonth()];
    const dateNum = d.getDate();

    const suffix = (n: number) => {
        if (n >= 11 && n <= 13) return `${n}th`;
        switch (n % 10) {
            case 1: return `${n}st`;
            case 2: return `${n}nd`;
            case 3: return `${n}rd`;
            default: return `${n}th`;
        }
    };

    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;

    return `${dayName}, ${monthName} ${suffix(dateNum)} | ${hours}:${minStr} ${ampm}`;
}

// User-Facing Error Sanitizer: Protects admin privacy, hides provider balances, and guarantees professional banking tone
function formatUserFacingTransferError(
    rawMsg: string,
    totalDebit?: number,
    userBalance?: number
): { title: string; message: string; isUserBalance: boolean } {
    const lower = String(rawMsg || '').toLowerCase();

    // 1. NEVER leak provider names, API secrets, merchant balances, or dashboard setup instructions
    if (
        lower.includes('flutterwave') ||
        lower.includes('paystack') ||
        lower.includes('payout balance') ||
        lower.includes('merchant payout') ||
        lower.includes('merchant balance') ||
        lower.includes('dashboard') ||
        lower.includes('whitelisting') ||
        lower.includes('whitelist') ||
        lower.includes('secret key') ||
        lower.includes('api key') ||
        lower.includes('settlement_channel_maintenance')
    ) {
        return {
            title: 'Interbank Network Notice',
            message: 'Interbank settlement service is temporarily undergoing routine channel maintenance. Please try again in a few moments. Your wallet was NOT charged.',
            isUserBalance: false,
        };
    }

    // 2. Genuine User Insufficient Balance (ONLY when it is the user's personal wallet)
    if (
        (lower.includes('insufficient') && (lower.includes('wallet') || lower.includes('you have') || lower.includes('you need'))) ||
        lower.includes('insufficient balance. available balance is ngn') ||
        lower.includes('insufficient wallet balance')
    ) {
        const debitStr = totalDebit !== undefined ? `₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : 'the required amount';
        const balStr = userBalance !== undefined ? `₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : 'your current balance';
        return {
            title: 'Insufficient Wallet Balance',
            message: `You need ${debitStr}, but you currently have ${balStr} in your wallet. Please top up your wallet to proceed with this transfer.`,
            isUserBalance: true,
        };
    }

    // 3. Minimum transfer amount
    if (lower.includes('minimum transfer amount') || lower.includes('minimum transfer')) {
        return {
            title: 'Transfer Limit Notice',
            message: rawMsg,
            isUserBalance: false,
        };
    }

    // 4. Account validation
    if (lower.includes('account') && (lower.includes('invalid') || lower.includes('not found') || lower.includes('validation') || lower.includes('validated') || lower.includes('recipient'))) {
        return {
            title: 'Account Verification Notice',
            message: 'Destination account could not be validated by recipient bank. Please check the account number and destination bank, then try again.',
            isUserBalance: false,
        };
    }

    // 5. Default safe professional message
    return {
        title: 'Interbank Transfer Notice',
        message: rawMsg.length > 5 && !lower.includes('error') && !lower.includes('failed') && !lower.includes('rpc')
            ? rawMsg
            : 'Interbank settlement service is temporarily busy due to high network traffic. Please try again shortly. Your wallet was NOT charged.',
        isUserBalance: false,
    };
}

export default function TransferScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // Mode: 'bank' = Bank Account Settlement | 'p2p' = Member-to-Member
    const [activeTab, setActiveTab] = useState<'bank' | 'p2p'>('bank');

    // Balance States
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [userBalance, setUserBalance] = useState<number>(0);
    const [showBalance, setShowBalance] = useState(true);
    const [loadingBalance, setLoadingBalance] = useState(false);

    // Nigerian Banks State
    const [banksList, setBanksList] = useState<BankItem[]>(DEFAULT_BANKS);
    const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [bankSearchText, setBankSearchText] = useState('');

    // Bank Account & Auto-Resolution
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isResolvingAccount, setIsResolvingAccount] = useState(false);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [copiedAcc, setCopiedAcc] = useState(false);
    const [isSavedFavorite, setIsSavedFavorite] = useState(false);

    // Recent Beneficiaries
    const [recentBeneficiaries, setRecentBeneficiaries] = useState<RecentBeneficiary[]>([]);

    // Transfer History (Secure Audited Records)
    const [transferHistory, setTransferHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // P2P Recipient States
    const [recipientQuery, setRecipientQuery] = useState('');
    const [isSearchingUser, setIsSearchingUser] = useState(false);
    const [matchedUser, setMatchedUser] = useState<{
        id: string;
        full_name: string;
        email: string;
        phone?: string;
        username?: string;
    } | null>(null);
    const [userSearchError, setUserSearchError] = useState<string | null>(null);

    // Shared Form
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [securityModalVisible, setSecurityModalVisible] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);
    const [copiedRef, setCopiedRef] = useState(false);

    // KYC Tier & Account Status States
    // ✅ null = loading (unknown), number = confirmed from DB
    // Prevents false "locked" flash before user data arrives
    const [userKycTier, setUserKycTier] = useState<number | null>(null);
    const [userStatus, setUserStatus] = useState<string>('active');

    // Derived KYC States
    const isKycLoading = userKycTier === null;
    const isKycLocked = userKycTier !== null && userKycTier < 2;

    // Device 2FA Authorization States (New Device Guard)
    const [isDeviceVerified, setIsDeviceVerified] = useState<boolean | null>(null);
    const [showDevice2FAModal, setShowDevice2FAModal] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

    // Success Receipt Modal
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<{
        reference: string;
        sessionId?: string;
        status: string;
        amount: number;
        fee?: number;
        totalDebit?: number;
        recipient: string;
        bankName?: string;
        accountNumber?: string;
        type: 'p2p' | 'bank';
        newBalance: number;
        date: string;
        narration?: string;
    } | null>(null);

    // Dual-Format Receipt Export Modal States (PDF / PNG - Identical to History)
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [exportReceiptData, setExportReceiptData] = useState<ReceiptData | null>(null);
    const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
    const receiptViewShotRef = useRef<any>(null);

    // Fee calculation
    const feeThreshold = parseFloat(settings?.transfer_fee_threshold || '10000');
    const feeBelow10k = parseFloat(settings?.transfer_fee_below_10k || '22');
    const feeAbove10k = parseFloat(settings?.transfer_fee_above_10k || '62');

    const numAmount = parseFloat(amount) || 0;
    const transferFee = activeTab === 'p2p' ? 0 : (numAmount <= 0 ? 0 : (numAmount < feeThreshold ? feeBelow10k : feeAbove10k));
    const totalDebit = numAmount + transferFee;

    // Error Notice Modal state
    const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);
    const [errorModalTitle, setErrorModalTitle] = useState<string>('Transfer Notice');
    const [isUserInsufficientBalance, setIsUserInsufficientBalance] = useState<boolean>(false);

    const showTransferNotice = (title: string, message: string, isUserBal: boolean = false) => {
        setErrorModalTitle(title);
        setErrorModalMessage(message);
        setIsUserInsufficientBalance(isUserBal);
    };

    // Load recent beneficiaries — scoped to current user ID
    useEffect(() => {
        if (currentUserId) {
            loadRecentBeneficiaries(currentUserId);
        } else {
            setRecentBeneficiaries([]);
        }
    }, [currentUserId]);

    const getBeneficiaryKey = (userId: string) => `@recent_beneficiaries_${userId}`;

    const loadRecentBeneficiaries = async (userId: string) => {
        if (!userId) return;
        try {
            // Clean up legacy unscoped key if present
            AsyncStorage.removeItem('@recent_bank_beneficiaries').catch(() => {});
            // ✅ Key is scoped per user — no cross-account leakage
            const stored = await AsyncStorage.getItem(getBeneficiaryKey(userId));
            if (stored) {
                setRecentBeneficiaries(JSON.parse(stored));
            } else {
                setRecentBeneficiaries([]);  // ✅ Clear if no data for this user
            }
        } catch (_) {}
    };

    const saveRecentBeneficiary = async (accNum: string, accName: string, bCode: string, bName: string) => {
        if (!currentUserId) return;
        try {
            const key = getBeneficiaryKey(currentUserId);
            const stored = await AsyncStorage.getItem(key);
            let list: RecentBeneficiary[] = stored ? JSON.parse(stored) : [];
            list = list.filter((b) => !(b.accountNumber === accNum && b.bankCode === bCode));
            list.unshift({
                accountNumber: accNum,
                accountName: accName,
                bankCode: bCode,
                bankName: bName,
                lastUsed: Date.now(),
            });
            list = list.slice(0, 8);
            await AsyncStorage.setItem(key, JSON.stringify(list));
            setRecentBeneficiaries(list);
        } catch (_) {}
    };

    const checkDeviceVerification = async (userId: string) => {
        if (!userId) return;
        try {
            const key = `@device_transfer_verified_${userId}`;
            const verified = await AsyncStorage.getItem(key);
            if (verified === 'true') {
                setIsDeviceVerified(true);
                setShowDevice2FAModal(false);
            } else {
                setIsDeviceVerified(false);
                setShowDevice2FAModal(true);
            }
        } catch (_) {
            setIsDeviceVerified(false);
            setShowDevice2FAModal(true);
        }
    };

    // Fetch User Balance & Transfer History
    const fetchUserData = async () => {
        setLoadingBalance(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                if (user.email) setCurrentUserEmail(user.email);
                checkDeviceVerification(user.id);
                const { data } = await supabase
                    .from('profiles')
                    .select('balance, full_name, kyc_tier, status')
                    .eq('id', user.id)
                    .single();
                if (data) {
                    setUserBalance(Number(data.balance) || 0);
                    if (data.full_name) setCurrentUserName(data.full_name);
                    // ✅ Set confirmed tier from DB — clears the null loading state
                    setUserKycTier(Number(data.kyc_tier) || 1);
                    setUserStatus(data.status || 'active');
                } else {
                    // DB returned nothing — safe default
                    setUserKycTier(1);
                }
                fetchTransferHistory(user.id);
            } else {
                setCurrentUserId('');
                setCurrentUserEmail('');
                setIsDeviceVerified(null);
                setShowDevice2FAModal(false);
                setUserKycTier(null);
                setUserBalance(0);
                setRecentBeneficiaries([]);
                setTransferHistory([]);
            }
        } catch (err) {
            console.warn('Balance fetch error:', err);
        } finally {
            setLoadingBalance(false);
        }
    };

    const fetchTransferHistory = async (userId: string) => {
        if (!userId) return;
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .in('type', ['withdrawal', 'transfer'])
                .order('created_at', { ascending: false })
                .limit(8);
            if (!error && data) {
                setTransferHistory(data);
            }
        } catch (_) {}
        finally {
            setLoadingHistory(false);
        }
    };

    // Refresh user balance and verification status every time Transfer screen is focused (e.g. after KYC verification)
    useFocusEffect(
        useCallback(() => {
            fetchUserData();
        }, [])
    );

    // Load Banks List on Mount
    useEffect(() => {

        let isMounted = true;
        const fetchBanks = async () => {
            try {
                const { data, error } = await supabase.functions.invoke('payment-webhook', {
                    body: { action: 'get_banks' },
                });
                if (!error && data?.banks && Array.isArray(data.banks) && data.banks.length > 0) {
                    if (isMounted) setBanksList(data.banks);
                }
            } catch (_) {}
        };
        fetchBanks();

        return () => { isMounted = false; };
    }, []);

    // Form Validity (Enforces Tier 2+ KYC Requirement & Device 2FA)
    const isFormValid = useMemo(() => {
        if (isDeviceVerified === false) return false;
        if (isKycLoading || isKycLocked) return false;
        if (numAmount < MIN_TRANSFER_AMOUNT) return false;
        if (userBalance > 0 && totalDebit > userBalance) return false;
        if (activeTab === 'p2p') {
            return !!matchedUser;
        } else {
            return !!selectedBank && accountNumber.trim().length === 10 && !!accountName.trim();
        }
    }, [isDeviceVerified, isKycLoading, isKycLocked, activeTab, matchedUser, selectedBank, accountNumber, accountName, numAmount, totalDebit, userBalance]);

    // Function to verify bank account details
    const handleVerifyBeneficiary = async () => {
        const cleanAcc = accountNumber.trim();
        if (cleanAcc.length !== 10) return;
        if (!selectedBank) {
            setBankModalVisible(true);
            return;
        }

        setIsResolvingAccount(true);
        setResolveError(null);
        setAccountName('');

        try {
            const { data, error } = await supabase.functions.invoke('payment-webhook', {
                body: {
                    action: 'resolve_bank_account',
                    account_number: cleanAcc,
                    bank_code: selectedBank.code,
                    provider: settings?.transfer_provider || 'flutterwave',
                },
            });

            if (error || !data?.success) {
                const errorMsg = data?.message || "Could not find this bank account. Please check the 10-digit account number and selected bank.";
                setResolveError(errorMsg);
                setAccountName('');
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else if (data?.account_name) {
                setAccountName(data.account_name);
                setResolveError(null);
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err: any) {
            setResolveError('Connection error resolving bank account. Please tap Retry.');
            setAccountName('');
        } finally {
            setIsResolvingAccount(false);
        }
    };

    const handleCopyAccountNumber = async (acc: string) => {
        if (!acc) return;
        await Clipboard.setStringAsync(acc);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCopiedAcc(true);
        setTimeout(() => setCopiedAcc(false), 2000);
    };

    const handleToggleFavoriteBeneficiary = async () => {
        if (!accountNumber || !selectedBank) return;
        const next = !isSavedFavorite;
        setIsSavedFavorite(next);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (next) {
            await saveRecentBeneficiary(accountNumber.trim(), accountName.trim(), selectedBank.code, selectedBank.name);
        }
    };

    const handleShareBeneficiaryDetails = async (acc: string, bank: string, name: string) => {
        try {
            const text = `🏦 *Beneficiary Account Details*\n• Name: ${name}\n• Bank: ${bank}\n• Account Number: ${acc}\n• Network: NIBSS Instant Settlement\n• Via: Abu Mafhal Sub`;
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await Share.share({ message: text, title: 'Beneficiary Account Details' });
        } catch (_) {}
    };

    const handleQuickAmountSelect = (val: number | 'max') => {
        if (val === 'max') {
            const available = Math.max(0, userBalance - (activeTab === 'p2p' ? 0 : (userBalance < feeThreshold ? feeBelow10k : feeAbove10k)));
            setAmount(available > 0 ? String(Math.floor(available)) : '0');
        } else {
            setAmount(String(val));
        }
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Debounced Account Name Verification
    useEffect(() => {
        const cleanAcc = accountNumber.trim();
        if (cleanAcc.length !== 10 || !selectedBank) {
            setAccountName('');
            setResolveError(null);
            setIsResolvingAccount(false);
            return;
        }

        const timer = setTimeout(() => {
            handleVerifyBeneficiary();
        }, 350);

        return () => clearTimeout(timer);
    }, [accountNumber, selectedBank]);

    // Debounced Search for P2P Recipient
    useEffect(() => {
        const query = recipientQuery.trim();
        if (query.length < 3) {
            setMatchedUser(null);
            setUserSearchError(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingUser(true);
            setUserSearchError(null);
            try {
                const cleanQuery = query.toLowerCase();
                const cleanPhone = query.replace(/[^0-9]/g, '');

                let filter = `email.ilike.${cleanQuery}`;
                if (cleanPhone.length >= 7) {
                    const last7 = cleanPhone.slice(-7);
                    filter += `,phone.ilike.%${last7}%`;
                }
                filter += `,username.ilike.${cleanQuery}`;

                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, phone, username')
                    .or(filter)
                    .limit(1)
                    .maybeSingle();

                if (error || !data) {
                    setUserSearchError('No user found with the provided details.');
                    setMatchedUser(null);
                } else if (data.id === currentUserId) {
                    setUserSearchError('You cannot transfer funds to yourself.');
                    setMatchedUser(null);
                } else {
                    setMatchedUser({
                        id: data.id,
                        full_name: data.full_name || 'Mafhal Member',
                        email: data.email || '',
                        phone: data.phone || '',
                        username: data.username || '',
                    });
                    setUserSearchError(null);
                    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } catch (_) {
                setUserSearchError('Error searching member.');
                setMatchedUser(null);
            } finally {
                setIsSearchingUser(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [recipientQuery, currentUserId]);

    // Handle Quick Beneficiary Tap
    const handleSelectRecentBeneficiary = (b: RecentBeneficiary) => {
        const bankMatch = banksList.find((item) => item.code === b.bankCode) || {
            id: b.bankCode,
            code: b.bankCode,
            name: b.bankName,
            logo: VERIFIED_BANK_LOGOS[b.bankCode],
        };
        setSelectedBank(bankMatch);
        setAccountNumber(b.accountNumber);
        setAccountName(b.accountName);
        setResolveError(null);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Open Past Receipt from History
    const handleOpenHistoryReceipt = (tx: any) => {
        const isP2P = tx.type === 'transfer';
        const isSuccessful = tx.status === 'success' || tx.status === 'successful' || tx.status === 'completed';
        const statusStr = isSuccessful ? 'SUCCESSFUL' : (tx.status ? String(tx.status).toUpperCase() : 'PENDING');
        const txAmount = Number(tx.amount || 0);
        const txFee = Number(tx.fee || 0);
        const txTotalDebit = txAmount + txFee;

        setLastTxDetails({
            reference: tx.reference || `TXN-${tx.id}`,
            sessionId: tx.metadata?.session_id || tx.session_id || tx.reference,
            status: statusStr,
            amount: txAmount,
            fee: txFee,
            totalDebit: txTotalDebit,
            recipient: tx.description?.replace(/^(Transfer to|Transfer received from|Bank Transfer to)\s*/i, '') || 'Beneficiary',
            bankName: isP2P ? 'Abu Mafhal Member' : (tx.bank_name || 'Nigerian Bank'),
            accountNumber: tx.account_number || ('••••' + (tx.reference ? tx.reference.slice(-4) : '0000')),
            type: isP2P ? 'p2p' : 'bank',
            newBalance: userBalance,
            date: new Date(tx.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
            narration: tx.description || 'Transfer',
        });
        setSuccessModalVisible(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Initiate Transfer (Opens confirmation)
    const handleInitiateTransfer = () => {
        if (isDeviceVerified === false) {
            setShowDevice2FAModal(true);
            return;
        }

        if (isKycLoading) {
            showTransferNotice(
                'Checking Account Status ⏳',
                'Please wait a moment while your account verification status is being loaded.',
                false
            );
            return;
        }

        if (isKycLocked) {
            showTransferNotice(
                'Tier 2 Verification Required 🔒',
                'Transfer Feature Locked: In compliance with financial security regulations, you must upgrade your account to Tier 2 (verify your BVN or NIN) before you can transfer funds. Tap Upgrade below to verify now.',
                false
            );
            return;
        }

        if (userStatus && userStatus !== 'active') {
            showTransferNotice(
                'Account Restricted ⚠️',
                'Your account is currently restricted. Transfers are disabled. Please contact customer support.',
                false
            );
            return;
        }

        if (numAmount <= 0) {
            showTransferNotice('Amount Required', 'Please enter a valid transfer amount.', false);
            return;
        }
        if (numAmount < MIN_TRANSFER_AMOUNT) {
            showTransferNotice('Transfer Limit', `Minimum transfer amount is ₦${MIN_TRANSFER_AMOUNT.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`, false);
            return;
        }

        if (!isFormValid) {
            if (activeTab === 'bank') {
                if (!selectedBank) {
                    showTransferNotice('Select Bank', 'Please select destination bank.', false);
                } else if (accountNumber.trim().length !== 10) {
                    showTransferNotice('Account Number', 'Please enter a valid 10-digit account number.', false);
                } else if (!accountName) {
                    showTransferNotice('Verifying Account', 'Please wait for account name verification to complete.', false);
                } else if (totalDebit > userBalance) {
                    showTransferNotice(
                        'Insufficient Wallet Balance',
                        `Insufficient wallet balance. You need ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })} (Transfer: ₦${numAmount.toLocaleString()} + Fee: ₦${transferFee.toLocaleString()}), but you have ₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })} available.`,
                        true
                    );
                }
            } else {
                if (!matchedUser) {
                    showTransferNotice('Recipient Required', 'Please enter recipient phone number, email or username.', false);
                } else if (totalDebit > userBalance) {
                    showTransferNotice(
                        'Insufficient Wallet Balance',
                        `Insufficient wallet balance. You need ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}, but you have ₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })} available.`,
                        true
                    );
                }
            }
            return;
        }

        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmModalVisible(true);
    };

    // Execute Confirmed Transfer via Edge Function
    const handleExecuteConfirmedTransfer = async (authPin?: string) => {
        setIsSubmitting(true);
        setTransferError(null);

        try {
            if (isKycLocked || isKycLoading) {
                throw new Error("Transfer Feature Locked: In compliance with financial security regulations, you must upgrade your account to Tier 2 (verify your BVN or NIN) before you can transfer funds.");
            }

            if (userStatus && userStatus !== 'active') {
                throw new Error("Your account is currently restricted. Transfers are disabled. Please contact customer support.");
            }

            const currentTotalDebit = totalDebit;
            const currentAmount = numAmount;
            const currentNarration = note.trim();

            if (currentAmount < MIN_TRANSFER_AMOUNT) {
                throw new Error(`Minimum transfer amount is ₦${MIN_TRANSFER_AMOUNT.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`);
            }

            if (activeTab === 'p2p') {
                let p2pResult = await supabase.rpc('execute_wallet_transfer', {
                    sender_id: currentUserId,
                    target_id: matchedUser!.id,
                    amount: currentAmount,
                    note: currentNarration || 'Wallet transfer via Abu Mafhal Hub',
                    p_pin: authPin || '',
                });

                if (p2pResult.error) {
                    p2pResult = await supabase.rpc('execute_p2p_transfer', {
                        target_id: matchedUser!.id,
                        amount: currentAmount,
                        note: currentNarration || 'Wallet transfer via Abu Mafhal Hub',
                        p_pin: authPin || '',
                    });
                }

                const { data, error } = p2pResult;
                if (error) throw new Error(error.message || 'P2P transfer failed.');
                if (data && data.success === false) throw new Error(data.message || 'P2P transfer failed.');

                const newBal = data?.new_balance ?? Math.max(0, userBalance - currentAmount);
                setUserBalance(newBal);

                const p2pRef = data?.reference || `TRF-P2P-${Date.now()}`;

                // Instant Push Notification for Sender (Debit Alert)
                createAppNotification(
                    currentUserId,
                    `Debit Alert: ₦${currentAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
                    `₦${currentAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} transferred to ${matchedUser!.full_name}. Ref: ${p2pRef}`,
                    'transfer',
                    'high',
                    { type: 'p2p_debit', amount: currentAmount, recipient: matchedUser!.full_name, reference: p2pRef }
                );

                // Instant Notification for Recipient (Credit Alert)
                if (matchedUser?.id) {
                    createAppNotification(
                        matchedUser.id,
                        `Credit Alert: ₦${currentAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
                        `You received ₦${currentAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} from ${currentUserName || 'Abu Mafhal Hub User'}.`,
                        'transfer',
                        'high',
                        { type: 'p2p_credit', amount: currentAmount, sender: currentUserName, reference: p2pRef }
                    );
                }

                // Immediately sync balance with database
                try {
                    const { data: prof } = await supabase.from('profiles').select('balance').eq('id', currentUserId).maybeSingle();
                    if (prof && prof.balance !== undefined && prof.balance !== null) {
                        setUserBalance(Number(prof.balance));
                    }
                } catch (_) {}

                setLastTxDetails({
                    reference: p2pRef,
                    sessionId: data?.reference,
                    status: 'SUCCESSFUL',
                    amount: currentAmount,
                    fee: 0,
                    totalDebit: currentAmount,
                    recipient: matchedUser!.full_name,
                    type: 'p2p',
                    newBalance: newBal,
                    date: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                    narration: currentNarration,
                });
            } else {
                const { data, error } = await supabase.functions.invoke('payment-webhook', {
                    body: {
                        action: 'execute_bank_transfer',
                        userId: currentUserId,
                        user_id: currentUserId,
                        bankCode: selectedBank!.code,
                        bank_code: selectedBank!.code,
                        bankName: selectedBank!.name,
                        bank_name: selectedBank!.name,
                        accountNumber: accountNumber.trim(),
                        account_number: accountNumber.trim(),
                        accountName: accountName.trim(),
                        account_name: accountName.trim(),
                        amount: currentAmount,
                        fee: transferFee,
                        totalDebit: currentTotalDebit,
                        total_debit: currentTotalDebit,
                        narration: currentNarration || `Transfer to ${accountName.trim()}`,
                        provider: settings?.transfer_provider || 'flutterwave',
                        pin: authPin || '',
                    },
                });

                if (error) {
                    throw new Error(error.message || 'Bank settlement connection failed. No funds were debited from your wallet.');
                }
                if (!data || data.success !== true || !data.dispatched) {
                    throw new Error(data?.message || 'Bank transfer was not accepted by the payment gateway. Your wallet was NOT charged.');
                }
                if (String(data.status || '').toUpperCase() === 'FAILED' || String(data.status || '').toUpperCase() === 'REJECTED') {
                    throw new Error(data?.message || 'Bank gateway rejected the transfer. Your wallet was NOT charged.');
                }

                const finalNewBal = data?.new_balance ?? Math.max(0, userBalance - currentTotalDebit);
                setUserBalance(finalNewBal);

                const bankTxRef = data?.reference || `WTH-${Date.now()}`;

                // Instant Push Notification for Sender (Debit Alert with Sound & Drop-Down Banner)
                createAppNotification(
                    currentUserId,
                    `Debit Alert: ₦${currentAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
                    `₦${currentAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} sent to ${accountName.trim()} (${selectedBank!.name}). Ref: ${bankTxRef}`,
                    'transfer',
                    'high',
                    {
                        type: 'bank_debit',
                        amount: currentAmount,
                        fee: transferFee,
                        totalDebit: currentTotalDebit,
                        recipient: accountName.trim(),
                        bank: selectedBank!.name,
                        accountNumber: accountNumber.trim(),
                        reference: bankTxRef
                    }
                );

                // Immediately sync balance with database
                try {
                    const { data: prof } = await supabase.from('profiles').select('balance').eq('id', currentUserId).maybeSingle();
                    if (prof && prof.balance !== undefined && prof.balance !== null) {
                        setUserBalance(Number(prof.balance));
                    }
                } catch (_) {}

                // Save to recent beneficiaries
                await saveRecentBeneficiary(accountNumber.trim(), accountName.trim(), selectedBank!.code, selectedBank!.name);

                const txStatus = (data?.status || 'SUCCESSFUL').toUpperCase();
                const txSessionId = data?.session_id || data?.reference || undefined;

                setLastTxDetails({
                    reference: bankTxRef,
                    sessionId: txSessionId,
                    status: txStatus,
                    amount: currentAmount,
                    fee: transferFee,
                    totalDebit: currentTotalDebit,
                    recipient: accountName.trim(),
                    bankName: selectedBank!.name,
                    accountNumber: accountNumber.trim(),
                    type: 'bank',
                    newBalance: finalNewBal,
                    date: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                    narration: currentNarration,
                });
            }

            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Refresh history
            if (currentUserId) fetchTransferHistory(currentUserId);

            // Reset inputs
            setAmount('');
            setNote('');
            setRecipientQuery('');
            setMatchedUser(null);
            setAccountNumber('');
            setAccountName('');
            setTransferError(null);
            setIsSubmitting(false);

            setTimeout(() => {
                setSuccessModalVisible(true);
            }, 250);
        } catch (err: any) {
            console.error('Transfer execution error:', err);
            const rawMsg = err.message || 'Unable to complete transfer. Your wallet balance was NOT charged.';
            const notice = formatUserFacingTransferError(rawMsg, totalDebit, userBalance);
            setTransferError(notice.message);
            setIsSubmitting(false);

            // Immediately re-sync user balance from DB to verify untouched funds
            if (currentUserId) {
                try {
                    const { data: prof } = await supabase.from('profiles').select('balance').eq('id', currentUserId).maybeSingle();
                    if (prof && prof.balance !== undefined && prof.balance !== null) {
                        setUserBalance(Number(prof.balance));
                    }
                } catch (_) {}
            }

            setTimeout(() => {
                showTransferNotice(notice.title, notice.message, notice.isUserBalance);
            }, 150);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 1. WhatsApp Direct File Sharing (PDF Document or PNG Image - NEVER Plaintext!)
    const handleShareWhatsApp = async () => {
        if (!lastTxDetails) return;
        const exportData = buildExportReceiptData(lastTxDetails, currentUserName);

        Alert.alert(
            'Share Receipt on WhatsApp',
            'Select your preferred receipt file format to send directly to WhatsApp:',
            [
                {
                    text: '📄 PDF Document (Official Bank Proof)',
                    onPress: async () => {
                        try {
                            setIsSharingWhatsApp(true);
                            if (Platform.OS !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            await shareReceiptFile(exportData, 'pdf');
                        } catch (e: any) {
                            Alert.alert('Share Error', 'Could not prepare PDF receipt for WhatsApp.');
                        } finally {
                            setIsSharingWhatsApp(false);
                        }
                    },
                },
                {
                    text: '🖼️ PNG Image (Photo Receipt)',
                    onPress: async () => {
                        try {
                            setIsSharingWhatsApp(true);
                            if (Platform.OS !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            let capturedUri: string | undefined = undefined;
                            if (receiptViewShotRef.current?.capture) {
                                capturedUri = await receiptViewShotRef.current.capture();
                            }
                            await shareReceiptFile(exportData, 'png', capturedUri);
                        } catch (e: any) {
                            Alert.alert('Share Error', 'Could not prepare image receipt for WhatsApp.');
                        } finally {
                            setIsSharingWhatsApp(false);
                        }
                    },
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    // 2. Open Official Dual-Format Receipt Export Modal (PDF / PNG) - Identical to History
    const handleOpenExportModal = () => {
        if (!lastTxDetails) return;
        const exportData = buildExportReceiptData(lastTxDetails, currentUserName);
        setExportReceiptData(exportData);
        setExportModalVisible(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Copy Reference Code
    const handleCopyReference = async (ref: string) => {
        await Clipboard.setStringAsync(ref);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    const filteredBanks = useMemo(() => {
        const q = bankSearchText.trim().toLowerCase();
        if (!q) return banksList;
        return banksList.filter(
            (b) =>
                b.name.toLowerCase().includes(q) ||
                b.code.includes(q) ||
                (b.slug && b.slug.toLowerCase().includes(q))
        );
    }, [banksList, bankSearchText]);

    const popularBanks = useMemo(() => {
        return banksList.filter((b) => POPULAR_BANK_CODES.includes(b.code)).slice(0, 8);
    }, [banksList]);

    return (
        <View style={s.container}>
            <StatusBar style="dark" />

            {/* Top Gold Accent Line */}
            <View style={s.goldTopLine} />

            {/* Compact Header */}
            <View style={[s.headerContainer, { paddingTop: Math.max(insets.top + 4, 28) }]}>
                <View style={s.headerNavRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.backBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={17} color="#0F172A" />
                    </TouchableOpacity>

                    <View style={s.headerTitleCol}>
                        <Text style={s.headerTitle}>Transfer Funds</Text>
                        <View style={s.paystackPoweredRow}>
                            <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                            <Text style={s.headerSubtitle}>256-Bit Encrypted Bank Network</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={fetchUserData}
                        style={s.refreshBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="sync-outline"
                            size={15}
                            color="#0F172A"
                            style={loadingBalance ? { transform: [{ rotate: '45deg' }] } : undefined}
                        />
                    </TouchableOpacity>
                </View>

                {/* Compact Balance Card */}
                <View style={s.balanceCard}>
                    <View style={s.balanceLeft}>
                        <View style={s.walletIconCircle}>
                            <Ionicons name="wallet" size={14} color="#F59E0B" />
                        </View>
                        <View>
                            <Text style={s.balanceLabel}>WALLET BALANCE</Text>
                            <Text style={s.balanceAmount}>
                                {showBalance ? `₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '₦ ••••••••'}
                            </Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {userBalance > 0 && (
                            <TouchableOpacity
                                onPress={() => {
                                    const maxTransfer = Math.max(0, userBalance - (activeTab === 'p2p' ? 0 : feeThreshold <= userBalance ? feeAbove10k : feeBelow10k));
                                    if (maxTransfer > 0) {
                                        setAmount(String(Math.floor(maxTransfer)));
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }
                                }}
                                style={s.useMaxChip}
                                activeOpacity={0.7}
                            >
                                <Text style={s.useMaxChipText}>MAX</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={() => setShowBalance(!showBalance)}
                            style={s.eyeToggleBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                                size={15}
                                color="#D97706"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Clean Segmented Tabs */}
            <View style={s.tabsContainer}>
                <TouchableOpacity
                    onPress={() => {
                        setActiveTab('bank');
                        setTransferError(null);
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.tabButton, activeTab === 'bank' && s.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="business"
                        size={14}
                        color={activeTab === 'bank' ? '#F59E0B' : '#64748B'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'bank' && s.tabButtonTextActive]}>
                        To Bank Account
                    </Text>
                    <View style={[s.liveBadge, activeTab === 'bank' && s.liveBadgeActive]}>
                        <Text style={[s.liveBadgeText, activeTab === 'bank' && s.liveBadgeTextActive]}>Direct</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        setActiveTab('p2p');
                        setTransferError(null);
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.tabButton, activeTab === 'p2p' && s.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="people"
                        size={14}
                        color={activeTab === 'p2p' ? '#F59E0B' : '#64748B'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'p2p' && s.tabButtonTextActive]}>
                        To Member
                    </Text>
                    <View style={[s.freeTag, activeTab === 'p2p' && s.freeTagActive]}>
                        <Text style={[s.freeTagText, activeTab === 'p2p' && s.freeTagTextActive]}>₦0 Fee</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Main Form Body with comfortable clearance above bottom tab bar */}
            <ScrollView
                style={s.scrollArea}
                contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom + 95, 115) }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <DynamicBanners placement="transfer" />

                {activeTab === 'bank' ? (
                    // ── MODE 1: NIGERIAN BANK TRANSFER ─────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={s.cardIconCircle}>
                                <Ionicons name="business" size={15} color="#D97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Send to Bank Account</Text>
                                <Text style={s.cardSub}>
                                    Instant settlement to all Nigerian Commercial Banks & MFBs
                                </Text>
                            </View>
                        </View>

                        {/* Tier 1 Strict Lock Warning Card */}
                        {isKycLocked && (
                            <View style={s.tierLockCard}>
                                <View style={s.tierLockHeaderRow}>
                                    <View style={s.tierLockIconBox}>
                                        <Ionicons name="lock-closed" size={18} color="#EF4444" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.tierLockTitle}>Transfer Feature Locked</Text>
                                            <View style={s.tier1Badge}>
                                                <Text style={s.tier1BadgeText}>TIER 1</Text>
                                            </View>
                                        </View>
                                        <Text style={s.tierLockSubtitle}>
                                            In compliance with security policies, transfers require Tier 2 identity verification (BVN / NIN).
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => router.push('/kyc')}
                                    style={s.tierUpgradeBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="shield-checkmark" size={14} color="#020617" />
                                    <Text style={s.tierUpgradeBtnText}>UPGRADE TO TIER 2 TO UNLOCK</Text>
                                    <Ionicons name="arrow-forward" size={13} color="#020617" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Inline Error Alert */}
                        {transferError ? (
                            <View style={s.transferErrorBanner}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.transferErrorTitle}>Notice</Text>
                                    <Text style={s.transferErrorText}>{transferError}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setTransferError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={15} color="#991B1B" />
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Recent Beneficiaries Horizontal Scroll (Quick Send) */}
                        {recentBeneficiaries.length > 0 && (
                            <View style={s.recentSection}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={s.recentSectionTitle}>Recent Beneficiaries:</Text>
                                    <Text style={{ fontSize: 9.5, color: '#D97706', fontWeight: '700' }}>Quick Send</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentRow}>
                                    {recentBeneficiaries.map((b, idx) => (
                                        <TouchableOpacity
                                            key={`${b.accountNumber}_${idx}`}
                                            onPress={() => handleSelectRecentBeneficiary(b)}
                                            style={s.recentChip}
                                            activeOpacity={0.7}
                                        >
                                            <BankLogoBadge bank={{ id: b.bankCode, code: b.bankCode, name: b.bankName }} size={22} />
                                            <View style={{ marginLeft: 6 }}>
                                                <Text style={s.recentName} numberOfLines={1}>
                                                    {b.accountName.split(' ')[0]}
                                                </Text>
                                                <Text style={s.recentBank} numberOfLines={1}>
                                                    {b.bankName.split(' ')[0]}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Step 1: Bank Selector Trigger */}
                        <Text style={s.fieldLabel}>1. Destination Bank</Text>
                        <TouchableOpacity
                            onPress={() => setBankModalVisible(true)}
                            style={[s.bankSelectTrigger, selectedBank && s.bankSelectTriggerFilled]}
                            activeOpacity={0.8}
                        >
                            {selectedBank ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                    <BankLogoBadge bank={selectedBank} size={24} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.selectedBankName} numberOfLines={1}>{selectedBank.name}</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                    <View style={s.emptyBankCircle}>
                                        <Ionicons name="business-outline" size={14} color="#F59E0B" />
                                    </View>
                                    <Text style={s.bankPlaceholder}>Tap to choose bank...</Text>
                                </View>
                            )}
                            <Ionicons name="chevron-forward" size={15} color="#D97706" />
                        </TouchableOpacity>

                        {/* Popular Banks Row */}
                        {!selectedBank && (
                            <View style={s.popularBanksContainer}>
                                <Text style={s.popularBanksLabel}>Popular Banks:</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularBanksRow}>
                                    {popularBanks.map((pb) => (
                                        <TouchableOpacity
                                            key={pb.id}
                                            onPress={() => {
                                                setSelectedBank(pb);
                                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            style={s.popularBankChip}
                                            activeOpacity={0.7}
                                        >
                                            <BankLogoBadge bank={pb} size={16} />
                                            <Text style={s.popularBankText} numberOfLines={1}>
                                                {pb.name.split(' ')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Step 2: Account Number Input */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 3 }}>
                            <Text style={s.fieldLabel}>2. Bank Account Number (10 Digits)</Text>
                            <Text style={[s.counterText, accountNumber.length === 10 && s.counterTextSuccess]}>
                                {accountNumber.length}/10
                            </Text>
                        </View>
                        <View style={[s.inputBox, accountNumber.length === 10 && s.inputBoxActive]}>
                            <Ionicons name="card-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. 0123456789"
                                placeholderTextColor="#94A3B8"
                                value={accountNumber}
                                onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
                                keyboardType="number-pad"
                                maxLength={10}
                            />
                            {isResolvingAccount && (
                                <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 4 }} />
                            )}
                            {!isResolvingAccount && accountName ? (
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            ) : null}
                        </View>

                        {/* Prompt to select bank if 10 digits entered without bank */}
                        {!selectedBank && accountNumber.trim().length === 10 && (
                            <TouchableOpacity
                                onPress={() => setBankModalVisible(true)}
                                style={s.promptSelectBankCard}
                                activeOpacity={0.8}
                            >
                                <View style={s.spinnerCircle}>
                                    <Ionicons name="business" size={18} color="#D97706" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={s.promptSelectBankTitle}>Select Destination Bank</Text>
                                    <Text style={s.promptSelectBankSub}>Tap to choose bank and verify account holder</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D97706" />
                            </TouchableOpacity>
                        )}

                        {/* Modernized Auto-Resolution Feedback Card */}
                        {isResolvingAccount && (
                            <View style={s.resolvingStatusBox}>
                                <View style={s.spinnerCircle}>
                                    <ActivityIndicator size="small" color="#D97706" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.resolvingStatusTitle}>Verifying Account Holder...</Text>
                                        <View style={s.pulsingAmberDot} />
                                    </View>
                                    <Text style={s.resolvingStatusSub}>Resolving official beneficiary name via NIBSS network...</Text>
                                </View>
                            </View>
                        )}

                        {resolveError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={s.errorAlertTitle}>Account Verification Failed</Text>
                                    <Text style={s.errorAlertText}>{resolveError}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleVerifyBeneficiary}
                                    style={s.retryVerifyBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="refresh" size={12} color="#DC2626" style={{ marginRight: 3 }} />
                                    <Text style={s.retryVerifyBtnText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {accountName ? (
                            <LinearGradient
                                colors={['#090D16', '#111827', '#0F172A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.resolvedAccountCard}
                            >
                                {/* Multi-Color Metallic Accent Hairline */}
                                <LinearGradient
                                    colors={['#D97706', '#F59E0B', '#38BDF8', '#10B981', '#F59E0B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.verifiedAccentBar}
                                />

                                {/* Micro-Header Security & Routing Status */}
                                <View style={s.verifiedHeaderBar}>
                                    <View style={s.verifiedHeaderLeft}>
                                        <View style={s.liveGreenDot} />
                                        <Ionicons name="shield-checkmark" size={10} color="#38BDF8" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedHeaderTitle}>NIBSS & CBN DIRECT VERIFIED</Text>
                                    </View>
                                    <View style={s.verifiedHeaderRight}>
                                        <Ionicons name="flash" size={8.5} color="#F59E0B" style={{ marginRight: 2 }} />
                                        <Text style={s.verifiedHeaderSub}>INSTANT ROUTING</Text>
                                    </View>
                                </View>

                                {/* Identity & Beneficiary Details */}
                                <View style={s.verifiedIdentityRow}>
                                    {/* Bank Logo in Gold Bezel */}
                                    <View style={s.verifiedAvatarWrap}>
                                        <BankLogoBadge bank={selectedBank!} size={36} />
                                        <View style={s.verifiedCheckBadge}>
                                            <Ionicons name="checkmark-sharp" size={8} color="#FFFFFF" />
                                        </View>
                                    </View>

                                    {/* Name, Bank & Monospaced Copyable Account Number */}
                                    <View style={s.verifiedIdentityTextWrap}>
                                        <Text style={s.resolvedName} numberOfLines={1}>
                                            {accountName}
                                        </Text>

                                        <Text style={s.resolvedBankSub} numberOfLines={1}>
                                            {selectedBank?.name}
                                        </Text>

                                        <View style={s.accountNumberRow}>
                                            <TouchableOpacity
                                                onPress={() => handleCopyAccountNumber(accountNumber)}
                                                style={[s.accountNumberChip, copiedAcc && s.accountNumberChipCopied]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[s.accountNumberChipText, copiedAcc && { color: '#10B981' }]}>
                                                    {accountNumber}
                                                </Text>
                                                <Ionicons
                                                    name={copiedAcc ? "checkmark-circle" : "copy-outline"}
                                                    size={10}
                                                    color={copiedAcc ? "#10B981" : "#38BDF8"}
                                                />
                                                <Text style={[s.accountNumberCopyLabel, copiedAcc && { color: '#10B981' }]}>
                                                    {copiedAcc ? 'Copied' : 'Copy'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Quick Action Toolbelt */}
                                    <View style={s.cardActionGroup}>
                                        <TouchableOpacity
                                            onPress={handleToggleFavoriteBeneficiary}
                                            style={[s.cardFeatureBtn, isSavedFavorite && s.cardFeatureBtnActive]}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name={isSavedFavorite ? "star" : "star-outline"} size={12} color={isSavedFavorite ? "#F59E0B" : "#94A3B8"} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleShareBeneficiaryDetails(accountNumber, selectedBank?.name || 'Bank', accountName)}
                                            style={s.cardFeatureBtn}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="share-social-outline" size={12} color="#94A3B8" />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => {
                                                setAccountNumber('');
                                                setAccountName('');
                                                setResolveError(null);
                                            }}
                                            style={[s.cardFeatureBtn, s.cardFeatureBtnClose]}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="close" size={13} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Micro-Specs Guarantee Strip (Speed / Fee / Risk) */}
                                <View style={s.verifiedSpecsStrip}>
                                    <View style={s.verifiedSpecItem}>
                                        <Ionicons name="speedometer-outline" size={10} color="#38BDF8" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedSpecLabel}>Speed: </Text>
                                        <Text style={s.verifiedSpecValue}>Instant (&lt;15s)</Text>
                                    </View>
                                    <View style={s.verifiedSpecDivider} />
                                    <View style={s.verifiedSpecItem}>
                                        <Ionicons name="pricetag-outline" size={10} color="#F59E0B" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedSpecLabel}>Fee: </Text>
                                        <Text style={s.verifiedSpecValue}>₦{transferFee.toFixed(2)}</Text>
                                    </View>
                                    <View style={s.verifiedSpecDivider} />
                                    <View style={s.verifiedSpecItem}>
                                        <Ionicons name="shield-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedSpecLabel}>Safety: </Text>
                                        <Text style={s.verifiedSpecValue}>100% Insured</Text>
                                    </View>
                                </View>

                                {/* Decorative Subtle Divider Line */}
                                <View style={s.verifiedCardDivider} />

                                {/* Quick Amount Shortcuts Row with Active Highlight */}
                                <View style={s.quickAmountRow}>
                                    <View style={s.quickAmountHeader}>
                                        <Ionicons name="flash" size={10} color="#F59E0B" />
                                        <Text style={s.quickAmountLabel}>Quick Amount:</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickAmountChipsScroll}>
                                        {[1000, 2000, 5000, 10000, 20000, 50000].map((amtVal) => {
                                            const isSelected = numAmount === amtVal;
                                            return (
                                                <TouchableOpacity
                                                    key={amtVal}
                                                    onPress={() => handleQuickAmountSelect(amtVal)}
                                                    style={[s.quickAmountChip, isSelected && s.quickAmountChipActive]}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[s.quickAmountChipText, isSelected && s.quickAmountChipTextActive]}>
                                                        ₦{amtVal.toLocaleString()}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        <TouchableOpacity
                                            onPress={() => handleQuickAmountSelect('max')}
                                            style={[s.quickAmountChip, s.quickAmountChipMax]}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={s.quickAmountChipMaxText}>MAX</Text>
                                        </TouchableOpacity>
                                    </ScrollView>
                                </View>

                                {/* Live Calculation & Balance Preview inside card */}
                                {numAmount > 0 && (
                                    <View style={s.verifiedLiveCalcRow}>
                                        <Text style={s.verifiedLiveCalcText}>
                                            Debit: <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>₦{numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                            {` + ₦${transferFee.toFixed(2)} Fee`}
                                            {' = '}
                                            <Text style={{ color: '#FFD700', fontWeight: '900' }}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                        </Text>
                                        {totalDebit <= userBalance ? (
                                            <View style={s.verifiedBalanceOkBadge}>
                                                <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                                                <Text style={s.verifiedBalanceOkText}>Balance OK</Text>
                                            </View>
                                        ) : (
                                            <View style={s.verifiedBalanceLowBadge}>
                                                <Ionicons name="alert-circle" size={10} color="#EF4444" />
                                                <Text style={s.verifiedBalanceLowText}>Low Balance</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </LinearGradient>
                        ) : null}

                        {/* Step 3: Transfer Amount */}
                        <Text style={[s.fieldLabel, { marginTop: 10 }]}>3. Transfer Amount (NGN)</Text>
                        <View style={s.amountInputBox}>
                            <Text style={s.currencyPrefix}>₦</Text>
                            <TextInput
                                style={s.amountInput}
                                placeholder="0.00"
                                placeholderTextColor="#94A3B8"
                                value={amount}
                                onChangeText={(t) => {
                                    setAmount(t.replace(/[^0-9.]/g, ''));
                                    setTransferError(null);
                                }}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        {numAmount > 0 && numAmount < MIN_TRANSFER_AMOUNT && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                <Ionicons name="alert-circle" size={13} color="#DC2626" />
                                <Text style={{ fontSize: 11.5, color: '#DC2626', fontWeight: '700' }}>
                                    Minimum transfer amount is ₦{MIN_TRANSFER_AMOUNT}.00
                                </Text>
                            </View>
                        )}

                        {/* Smooth Insufficient Balance Warning Card */}
                        {numAmount > 0 && totalDebit > userBalance && (
                            <View style={s.insufficientBalanceCard}>
                                <View style={s.insufficientIconWrap}>
                                    <Ionicons name="wallet-outline" size={17} color="#DC2626" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={s.insufficientTitle}>Insufficient Wallet Balance</Text>
                                    <Text style={s.insufficientText}>
                                        Available: <Text style={{ fontWeight: '800' }}>₦{userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>, Required: <Text style={{ fontWeight: '800', color: '#DC2626' }}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text> (Transfer: ₦{numAmount.toLocaleString()} + Fee: ₦{transferFee.toLocaleString()}).
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={s.topupSmallBtn}
                                    onPress={() => router.push('/(app)/wallet')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add-circle" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                                    <Text style={s.topupSmallBtnText}>Add Money</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Quick Amount Chips */}
                        <View style={s.chipRow}>
                            {QUICK_AMOUNTS.map((amt) => (
                                <TouchableOpacity
                                    key={amt}
                                    onPress={() => {
                                        setAmount(String(amt));
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[s.chipBtn, amount === String(amt) && s.chipBtnActive]}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.chipText, amount === String(amt) && s.chipTextActive]}>
                                        ₦{amt.toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Step 4: Narration with Presets */}
                        <Text style={[s.fieldLabel, { marginTop: 10 }]}>Payment Narration (Optional)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Support, Bill or Goods"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Narration Preset Chips */}
                        <View style={s.presetRow}>
                            {NARRATION_PRESETS.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    onPress={() => {
                                        setNote(p);
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[s.presetChip, note === p && s.presetChipActive]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.presetChipText, note === p && s.presetChipTextActive]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Dynamic Live Fee & Total Debit Breakdown */}
                        {numAmount > 0 && (
                            <View style={s.feeBreakdownCard}>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>Transfer Amount:</Text>
                                    <Text style={s.breakdownVal}>₦{numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                </View>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>Transfer Fee:</Text>
                                    <Text style={[s.breakdownVal, { color: '#D97706', fontWeight: '800' }]}>
                                        ₦{transferFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                                <View style={s.breakdownDivider} />
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownTotalLabel}>Total Wallet Debit:</Text>
                                    <Text style={s.breakdownTotalVal}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                </View>
                            </View>
                        )}

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={isKycLocked ? () => router.push('/kyc') : handleInitiateTransfer}
                            style={[
                                s.submitBtn,
                                (!isFormValid && !isKycLocked) ? s.submitBtnDisabled : s.submitBtnActive,
                                isKycLocked && { backgroundColor: '#B45309' }
                            ]}
                            disabled={isSubmitting || isKycLoading}
                            activeOpacity={0.85}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : isKycLoading ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                    <Text style={s.submitBtnText}>CHECKING ACCOUNT...</Text>
                                </View>
                            ) : (
                                <>
                                    <Ionicons
                                        name={isKycLocked ? "lock-closed" : "arrow-up-circle"}
                                        size={18}
                                        color={isKycLocked ? "#FFFFFF" : (!isFormValid ? '#64748B' : '#F59E0B')}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[s.submitBtnText, (!isFormValid && !isKycLocked) && s.submitBtnTextDisabled]}>
                                        {isKycLocked
                                            ? '🔒 UPGRADE TO TIER 2 TO TRANSFER'
                                            : (numAmount > 0 && numAmount < MIN_TRANSFER_AMOUNT
                                                ? `MINIMUM TRANSFER IS ₦${MIN_TRANSFER_AMOUNT}`
                                                : isFormValid
                                                ? `PROCEED WITH ₦${numAmount.toLocaleString('en-NG')}`
                                                : 'ENTER TRANSFER DETAILS')
                                        }
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    // ── MODE 2: P2P MEMBER TRANSFER ─────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={s.cardIconCircle}>
                                <Ionicons name="people" size={15} color="#D97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Send to Mafhal Member</Text>
                                <Text style={s.cardSub}>
                                    Instant zero-fee transfer to any registered member
                                </Text>
                            </View>
                        </View>

                        {/* Tier 1 Strict Lock Warning Card */}
                        {isKycLocked && (
                            <View style={s.tierLockCard}>
                                <View style={s.tierLockHeaderRow}>
                                    <View style={s.tierLockIconBox}>
                                        <Ionicons name="lock-closed" size={18} color="#EF4444" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.tierLockTitle}>Transfer Feature Locked</Text>
                                            <View style={s.tier1Badge}>
                                                <Text style={s.tier1BadgeText}>TIER 1</Text>
                                            </View>
                                        </View>
                                        <Text style={s.tierLockSubtitle}>
                                            In compliance with security policies, transfers require Tier 2 identity verification (BVN / NIN).
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => router.push('/kyc')}
                                    style={s.tierUpgradeBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="shield-checkmark" size={14} color="#020617" />
                                    <Text style={s.tierUpgradeBtnText}>UPGRADE TO TIER 2 TO UNLOCK</Text>
                                    <Ionicons name="arrow-forward" size={13} color="#020617" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Inline Error Alert */}
                        {transferError ? (
                            <View style={s.transferErrorBanner}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.transferErrorTitle}>Notice</Text>
                                    <Text style={s.transferErrorText}>{transferError}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setTransferError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={15} color="#991B1B" />
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Recipient Input */}
                        <Text style={s.fieldLabel}>Recipient Phone, Email, or Username</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="search-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. 08145853539 or email@domain.com"
                                placeholderTextColor="#94A3B8"
                                value={recipientQuery}
                                onChangeText={setRecipientQuery}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            {isSearchingUser && (
                                <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 4 }} />
                            )}
                        </View>

                        {userSearchError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={15} color="#DC2626" />
                                <Text style={s.errorAlertText}>{userSearchError}</Text>
                            </View>
                        )}

                        {matchedUser && (
                            <LinearGradient
                                colors={['#090D16', '#111827', '#0F172A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.resolvedAccountCard}
                            >
                                {/* Multi-Color Metallic Accent Hairline */}
                                <LinearGradient
                                    colors={['#38BDF8', '#818CF8', '#C084FC', '#38BDF8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.verifiedAccentBar}
                                />

                                {/* Micro-Header Security & Status */}
                                <View style={s.verifiedHeaderBar}>
                                    <View style={s.verifiedHeaderLeft}>
                                        <View style={s.liveGreenDot} />
                                        <Ionicons name="person-circle" size={10} color="#38BDF8" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedHeaderTitle}>ABU MAFHAL P2P VERIFIED</Text>
                                    </View>
                                    <View style={s.verifiedHeaderRight}>
                                        <Ionicons name="flash" size={8.5} color="#10B981" style={{ marginRight: 2 }} />
                                        <Text style={[s.verifiedHeaderSub, { color: '#10B981' }]}>0% FEE • INSTANT</Text>
                                    </View>
                                </View>

                                {/* Identity & Beneficiary Details */}
                                <View style={s.verifiedIdentityRow}>
                                    {/* Avatar in Metallic Frame */}
                                    <View style={s.verifiedAvatarWrap}>
                                        <View style={s.p2pAvatarCircle}>
                                            <Text style={s.p2pAvatarText}>
                                                {(matchedUser.full_name || 'U').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={[s.verifiedCheckBadge, { backgroundColor: '#38BDF8' }]}>
                                            <Ionicons name="checkmark-sharp" size={8} color="#090D16" />
                                        </View>
                                    </View>

                                    {/* Name, Handle & Copyable Contact */}
                                    <View style={s.verifiedIdentityTextWrap}>
                                        <Text style={s.resolvedName} numberOfLines={1}>
                                            {matchedUser.full_name}
                                        </Text>

                                        {matchedUser.username ? (
                                            <Text style={s.resolvedBankSub} numberOfLines={1}>
                                                @{matchedUser.username} • Abu Mafhal Member
                                            </Text>
                                        ) : (
                                            <Text style={s.resolvedBankSub} numberOfLines={1}>
                                                Abu Mafhal Wallet Member
                                            </Text>
                                        )}

                                        <View style={s.accountNumberRow}>
                                            <TouchableOpacity
                                                onPress={() => handleCopyAccountNumber(matchedUser.phone || matchedUser.email)}
                                                style={[s.accountNumberChip, copiedAcc && s.accountNumberChipCopied]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[s.accountNumberChipText, copiedAcc && { color: '#10B981' }]}>
                                                    {matchedUser.phone || matchedUser.email}
                                                </Text>
                                                <Ionicons
                                                    name={copiedAcc ? "checkmark-circle" : "copy-outline"}
                                                    size={10}
                                                    color={copiedAcc ? "#10B981" : "#38BDF8"}
                                                />
                                                <Text style={[s.accountNumberCopyLabel, copiedAcc && { color: '#10B981' }]}>
                                                    {copiedAcc ? 'Copied' : 'Copy'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Quick Action Toolbelt */}
                                    <View style={s.cardActionGroup}>
                                        <TouchableOpacity
                                            onPress={() => handleShareBeneficiaryDetails(matchedUser.phone || matchedUser.email, 'Abu Mafhal Wallet', matchedUser.full_name)}
                                            style={s.cardFeatureBtn}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="share-social-outline" size={12} color="#94A3B8" />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => {
                                                setMatchedUser(null);
                                                setRecipientQuery('');
                                                setUserSearchError(null);
                                            }}
                                            style={[s.cardFeatureBtn, s.cardFeatureBtnClose]}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="close" size={13} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Micro-Specs Guarantee Strip (Speed / Fee / Routing) */}
                                <View style={s.verifiedSpecsStrip}>
                                    <View style={s.verifiedSpecItem}>
                                        <Ionicons name="speedometer-outline" size={10} color="#38BDF8" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedSpecLabel}>Speed: </Text>
                                        <Text style={s.verifiedSpecValue}>Real-Time 0s</Text>
                                    </View>
                                    <View style={s.verifiedSpecDivider} />
                                    <View style={s.verifiedSpecItem}>
                                        <Ionicons name="sparkles-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedSpecLabel}>Fee: </Text>
                                        <Text style={[s.verifiedSpecValue, { color: '#10B981' }]}>FREE ₦0.00</Text>
                                    </View>
                                    <View style={s.verifiedSpecDivider} />
                                    <View style={s.verifiedSpecItem}>
                                        <Ionicons name="lock-closed-outline" size={10} color="#818CF8" style={{ marginRight: 3 }} />
                                        <Text style={s.verifiedSpecLabel}>Transfer: </Text>
                                        <Text style={s.verifiedSpecValue}>Direct Wallet</Text>
                                    </View>
                                </View>

                                {/* Decorative Subtle Divider Line */}
                                <View style={s.verifiedCardDivider} />

                                {/* Quick Amount Shortcuts Row with Active Highlight */}
                                <View style={s.quickAmountRow}>
                                    <View style={s.quickAmountHeader}>
                                        <Ionicons name="flash" size={10} color="#F59E0B" />
                                        <Text style={s.quickAmountLabel}>Quick Amount:</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickAmountChipsScroll}>
                                        {[500, 1000, 2000, 5000, 10000, 20000].map((amtVal) => {
                                            const isSelected = numAmount === amtVal;
                                            return (
                                                <TouchableOpacity
                                                    key={amtVal}
                                                    onPress={() => handleQuickAmountSelect(amtVal)}
                                                    style={[s.quickAmountChip, isSelected && s.quickAmountChipActive]}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[s.quickAmountChipText, isSelected && s.quickAmountChipTextActive]}>
                                                        ₦{amtVal.toLocaleString()}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        <TouchableOpacity
                                            onPress={() => handleQuickAmountSelect('max')}
                                            style={[s.quickAmountChip, s.quickAmountChipMax]}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={s.quickAmountChipMaxText}>MAX</Text>
                                        </TouchableOpacity>
                                    </ScrollView>
                                </View>

                                {/* Live Calculation & Balance Preview inside card */}
                                {numAmount > 0 && (
                                    <View style={s.verifiedLiveCalcRow}>
                                        <Text style={s.verifiedLiveCalcText}>
                                            Debit: <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>₦{numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                            {' (0 Fee) = '}
                                            <Text style={{ color: '#FFD700', fontWeight: '900' }}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                        </Text>
                                        {totalDebit <= userBalance ? (
                                            <View style={s.verifiedBalanceOkBadge}>
                                                <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                                                <Text style={s.verifiedBalanceOkText}>Balance OK</Text>
                                            </View>
                                        ) : (
                                            <View style={s.verifiedBalanceLowBadge}>
                                                <Ionicons name="alert-circle" size={10} color="#EF4444" />
                                                <Text style={s.verifiedBalanceLowText}>Low Balance</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </LinearGradient>
                        )}

                        {/* Amount Input */}
                        <Text style={[s.fieldLabel, { marginTop: 10 }]}>Amount (NGN)</Text>
                        <View style={s.amountInputBox}>
                            <Text style={s.currencyPrefix}>₦</Text>
                            <TextInput
                                style={s.amountInput}
                                placeholder="0.00"
                                placeholderTextColor="#94A3B8"
                                value={amount}
                                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        {numAmount > 0 && numAmount < MIN_TRANSFER_AMOUNT && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                <Ionicons name="alert-circle" size={13} color="#DC2626" />
                                <Text style={{ fontSize: 11.5, color: '#DC2626', fontWeight: '700' }}>
                                    Minimum transfer amount is ₦{MIN_TRANSFER_AMOUNT}.00
                                </Text>
                            </View>
                        )}

                        {/* Smooth Insufficient Balance Warning Card */}
                        {numAmount > 0 && totalDebit > userBalance && (
                            <View style={s.insufficientBalanceCard}>
                                <View style={s.insufficientIconWrap}>
                                    <Ionicons name="wallet-outline" size={17} color="#DC2626" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={s.insufficientTitle}>Insufficient Wallet Balance</Text>
                                    <Text style={s.insufficientText}>
                                        Available: <Text style={{ fontWeight: '800' }}>₦{userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>, Required: <Text style={{ fontWeight: '800', color: '#DC2626' }}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={s.topupSmallBtn}
                                    onPress={() => router.push('/(app)/wallet')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add-circle" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                                    <Text style={s.topupSmallBtnText}>Add Money</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Quick Chips */}
                        <View style={s.chipRow}>
                            {QUICK_AMOUNTS.map((amt) => (
                                <TouchableOpacity
                                    key={amt}
                                    onPress={() => {
                                        setAmount(String(amt));
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[s.chipBtn, amount === String(amt) && s.chipBtnActive]}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.chipText, amount === String(amt) && s.chipTextActive]}>
                                        ₦{amt.toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Optional Note */}
                        <Text style={[s.fieldLabel, { marginTop: 10 }]}>Payment Note (Optional)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Support or Gift"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Narration Preset Chips */}
                        <View style={s.presetRow}>
                            {NARRATION_PRESETS.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    onPress={() => {
                                        setNote(p);
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[s.presetChip, note === p && s.presetChipActive]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.presetChipText, note === p && s.presetChipTextActive]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Live Total Breakdown */}
                        {numAmount > 0 && (
                            <View style={s.feeBreakdownCard}>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>Transfer Fee:</Text>
                                    <Text style={[s.breakdownVal, { color: '#10B981', fontWeight: '800' }]}>₦0.00 (FREE)</Text>
                                </View>
                                <View style={s.breakdownDivider} />
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownTotalLabel}>Total Wallet Debit:</Text>
                                    <Text style={s.breakdownTotalVal}>₦{numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                </View>
                            </View>
                        )}

                        {/* P2P Submit Button */}
                        <TouchableOpacity
                            onPress={isKycLocked ? () => router.push('/kyc') : handleInitiateTransfer}
                            style={[
                                s.submitBtn,
                                (!isFormValid && !isKycLocked) ? s.submitBtnDisabled : s.submitBtnActive,
                                isKycLocked && { backgroundColor: '#B45309' }
                            ]}
                            disabled={isSubmitting || isKycLoading}
                            activeOpacity={0.85}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : isKycLoading ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                    <Text style={s.submitBtnText}>CHECKING ACCOUNT...</Text>
                                </View>
                            ) : (
                                <>
                                    <Ionicons
                                        name={isKycLocked ? "lock-closed" : "paper-plane"}
                                        size={17}
                                        color={isKycLocked ? "#FFFFFF" : (!isFormValid ? '#64748B' : '#F59E0B')}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[s.submitBtnText, (!isFormValid && !isKycLocked) && s.submitBtnTextDisabled]}>
                                        {isKycLocked
                                            ? '🔒 UPGRADE TO TIER 2 TO TRANSFER'
                                            : (numAmount > 0 && numAmount < MIN_TRANSFER_AMOUNT
                                                ? `MINIMUM TRANSFER IS ₦${MIN_TRANSFER_AMOUNT}`
                                                : isFormValid
                                                ? `SEND ₦${numAmount.toLocaleString()} TO MEMBER`
                                                : 'ENTER MEMBER DETAILS')
                                        }
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── RECENT TRANSFER HISTORY (SECURE & AUDITED) ───── */}
                <View style={[s.card, { marginTop: 14 }]}>
                    <View style={s.cardHeaderRow}>
                        <View style={[s.cardIconCircle, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Ionicons name="shield-checkmark" size={15} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle}>Recent Transfer History</Text>
                            <Text style={s.cardSub}>
                                End-to-End Encrypted Financial Records • Bank-Grade Security
                            </Text>
                        </View>
                        {loadingHistory && <ActivityIndicator size="small" color="#10B981" />}
                    </View>

                    {transferHistory.length === 0 ? (
                        <View style={s.emptyHistoryState}>
                            <Ionicons name="receipt-outline" size={28} color="#94A3B8" />
                            <Text style={s.emptyHistoryTitle}>No Recent Transfers</Text>
                            <Text style={s.emptyHistorySub}>Your successful transfer receipts will appear here securely.</Text>
                        </View>
                    ) : (
                        transferHistory.map((tx, idx) => {
                            const isSuccessful = tx.status === 'success';
                            const dateStr = new Date(tx.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            return (
                                <TouchableOpacity
                                    key={tx.id || idx}
                                    onPress={() => handleOpenHistoryReceipt(tx)}
                                    style={s.historyRowItem}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.historyIconPill}>
                                        <Ionicons
                                            name={tx.type === 'transfer' ? 'swap-horizontal' : 'arrow-up-circle'}
                                            size={16}
                                            color="#D97706"
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={s.historyDesc} numberOfLines={1}>
                                            {tx.description || (tx.type === 'transfer' ? 'Member Transfer' : 'Bank Settlement')}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                            <Text style={s.historyDate}>{dateStr}</Text>
                                            <View style={[s.historyStatusBadge, { backgroundColor: isSuccessful ? '#DCFCE7' : '#FEF2F2' }]}>
                                                <Text style={[s.historyStatusText, { color: isSuccessful ? '#15803D' : '#DC2626' }]}>
                                                    {isSuccessful ? 'SUCCESS' : (tx.status || 'PENDING').toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={s.historyAmount}>-₦{Number(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                            <Ionicons name="receipt-outline" size={11} color="#D97706" />
                                            <Text style={{ fontSize: 9.5, color: '#D97706', fontWeight: '800' }}>Receipt</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* ── COMPACT BANK SELECTION MODAL ────────────────── */}
            <Modal
                visible={bankModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setBankModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={s.modalBackdrop}
                >
                    <View style={s.bankModalCard}>
                        <View style={s.modalHeaderRow}>
                            <View>
                                <Text style={s.modalTitle}>Select Destination Bank</Text>
                                <Text style={s.modalSubtitle}>{banksList.length} Connected Banks</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setBankModalVisible(false)}
                                style={s.modalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={s.bankSearchBox}>
                            <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.bankSearchInput}
                                placeholder="Search bank name (e.g. OPay, GTBank)..."
                                placeholderTextColor="#94A3B8"
                                value={bankSearchText}
                                onChangeText={setBankSearchText}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {bankSearchText ? (
                                <TouchableOpacity onPress={() => setBankSearchText('')}>
                                    <Ionicons name="close-circle" size={15} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Banks FlatList */}
                        <FlatList
                            data={filteredBanks}
                            keyExtractor={(item) => item.code + '_' + item.id}
                            style={{ maxHeight: 360 }}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const isSelected = selectedBank?.code === item.code;
                                return (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSelectedBank(item);
                                            setBankModalVisible(false);
                                            setBankSearchText('');
                                            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        style={[s.bankRowItem, isSelected && s.bankRowItemActive]}
                                        activeOpacity={0.7}
                                    >
                                        <BankLogoBadge bank={item} size={24} />
                                        <View style={{ flex: 1, marginLeft: 9 }}>
                                            <Text style={[s.bankItemName, isSelected && s.bankItemNameActive]} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <View style={s.emptyBankState}>
                                    <Ionicons name="search-outline" size={24} color="#94A3B8" />
                                    <Text style={s.emptyBankTitle}>No Bank Found</Text>
                                    <Text style={s.emptyBankSub}>Check your search spelling.</Text>
                                </View>
                            )}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── TRANSFER CONFIRMATION MODAL ─────────── */}
            <Modal
                visible={confirmModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.confirmCard}>
                        <View style={s.confirmIconCircle}>
                            <Ionicons name="shield-checkmark" size={22} color="#F59E0B" />
                        </View>
                        <Text style={s.confirmTitle}>Confirm Transfer</Text>
                        <Text style={s.confirmSub}>
                            Review details carefully before entering your authorization PIN
                        </Text>

                        <View style={s.confirmDetailsBox}>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Transfer Amount:</Text>
                                <Text style={s.confirmValue}>₦{numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                            </View>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Recipient:</Text>
                                <Text style={[s.confirmValue, { color: '#0F172A', fontWeight: '800' }]} numberOfLines={1}>
                                    {activeTab === 'bank' ? accountName : matchedUser?.full_name}
                                </Text>
                            </View>
                            {activeTab === 'bank' && selectedBank && (
                                <View style={s.confirmRow}>
                                    <Text style={s.confirmLabel}>Bank:</Text>
                                    <Text style={s.confirmValue} numberOfLines={1}>{selectedBank.name}</Text>
                                </View>
                            )}
                            {activeTab === 'bank' && accountNumber && (
                                <View style={s.confirmRow}>
                                    <Text style={s.confirmLabel}>Account Number:</Text>
                                    <Text style={s.confirmValue}>{accountNumber}</Text>
                                </View>
                            )}
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Transfer Fee:</Text>
                                <Text style={[s.confirmValue, { color: '#D97706', fontWeight: '700' }]}>
                                    {activeTab === 'p2p' ? '₦0.00 (FREE)' : `₦${transferFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
                                </Text>
                            </View>
                            <View style={[s.summaryDivider, { marginVertical: 6 }]} />
                            <View style={s.confirmRow}>
                                <Text style={[s.confirmLabel, { fontWeight: '800', color: '#0F172A' }]}>Total Wallet Debit:</Text>
                                <Text style={[s.confirmValueGold, { fontSize: 13.5, fontWeight: '900' }]}>
                                    ₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        </View>

                        <View style={s.confirmActionRow}>
                            <TouchableOpacity
                                onPress={() => setConfirmModalVisible(false)}
                                style={s.cancelBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={s.cancelBtnText}>CANCEL</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setConfirmModalVisible(false);
                                    setTimeout(() => {
                                        setSecurityModalVisible(true);
                                    }, 250);
                                }}
                                style={s.proceedBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.proceedBtnText}>ENTER PIN</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── SECURITY PIN MODAL ─────────────── */}
            <SecurityModal
                visible={securityModalVisible}
                onClose={() => setSecurityModalVisible(false)}
                skipMfa={true}
                onSuccess={(pin) => {
                    setSecurityModalVisible(false);
                    setTimeout(() => {
                        handleExecuteConfirmedTransfer(pin);
                    }, 300);
                }}
                title="Security PIN"
                description={`Enter transaction PIN to authorize debit of ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
            />

            {/* ── NEW DEVICE 2FA VERIFICATION MODAL ── */}
            <Device2FAModal
                visible={showDevice2FAModal && isDeviceVerified === false && !!currentUserId}
                userId={currentUserId}
                userEmail={currentUserEmail}
                onVerified={() => {
                    setIsDeviceVerified(true);
                    setShowDevice2FAModal(false);
                }}
                onCancel={() => {
                    setShowDevice2FAModal(false);
                    router.replace('/(app)/dashboard');
                }}
            />

            {/* ── FULL SCREEN PROCESSING MODAL ────────────────── */}
            <Modal visible={isSubmitting} transparent animationType="fade">
                <View style={s.loadingModalBackdrop}>
                    <View style={s.loadingModalCard}>
                        <ActivityIndicator size="large" color="#D97706" />
                        <Text style={s.loadingModalTitle}>Processing Settlement</Text>
                        <Text style={s.loadingModalSub}>
                            Connecting to banking network. Please wait while your transfer completes...
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* ── IN-APP ERROR / NOTICE MODAL ──────── */}
            <Modal
                visible={!!errorModalMessage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setErrorModalMessage(null)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.errorModalCard}>
                        {/* Status Icon Circle */}
                        <View style={[
                            s.errorModalIconCircle,
                            isUserInsufficientBalance
                                ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
                                : { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                        ]}>
                            <Ionicons
                                name={isUserInsufficientBalance ? "wallet-outline" : "shield-outline"}
                                size={28}
                                color={isUserInsufficientBalance ? "#DC2626" : "#D97706"}
                            />
                        </View>

                        {/* Title */}
                        <Text style={[
                            s.errorModalTitle,
                            !isUserInsufficientBalance && { color: '#0F172A' }
                        ]}>
                            {errorModalTitle}
                        </Text>

                        {/* Message */}
                        <Text style={s.errorModalMessage}>{errorModalMessage}</Text>

                        {/* Safe Funds Guarantee Strip for Network Notices */}
                        {!isUserInsufficientBalance && (
                            <View style={s.safeGuaranteePill}>
                                <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                                <Text style={s.safeGuaranteeText}>
                                    Your wallet was NOT charged • Funds are 100% safe
                                </Text>
                            </View>
                        )}
                        
                        <View style={{ width: '100%', gap: 8 }}>
                            {isUserInsufficientBalance ? (
                                <>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setErrorModalMessage(null);
                                            router.push('/(app)/wallet');
                                        }}
                                        style={[s.errorModalBtn, { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#D97706' }]}
                                        activeOpacity={0.85}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="card" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
                                            <Text style={s.errorModalBtnText}>TOP UP / ADD MONEY</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setErrorModalMessage(null)}
                                        style={[
                                            s.errorModalBtn,
                                            { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1 }
                                        ]}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={[s.errorModalBtnText, { color: '#475569' }]}>
                                            CLOSE
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setErrorModalMessage(null)}
                                    style={[s.errorModalBtn, { backgroundColor: '#0F172A' }]}
                                    activeOpacity={0.85}
                                >
                                    <Text style={s.errorModalBtnText}>
                                        OK, UNDERSTOOD
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── TRANSACTION RECEIPT MODAL (IDENTICAL TO HISTORY) ───────── */}
            <Modal
                visible={successModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setSuccessModalVisible(false);
                    fetchUserData();
                }}
            >
                <TouchableOpacity
                    style={s.receiptModalBackdrop}
                    activeOpacity={1}
                    onPress={() => {
                        setSuccessModalVisible(false);
                        fetchUserData();
                    }}
                >
                    <View style={s.receiptModalSheet} onStartShouldSetResponder={() => true}>
                        {/* Drag Bar */}
                        <View style={s.receiptModalDragBar} />

                        {/* Header */}
                        <View style={s.receiptModalHeader}>
                            <Text style={s.receiptModalHeaderTitle}>Transaction Receipt</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setSuccessModalVisible(false);
                                    fetchUserData();
                                }}
                                style={s.receiptModalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        {lastTxDetails && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                                <ViewShot
                                    ref={receiptViewShotRef}
                                    options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
                                    style={s.receiptCaptureWrap}
                                >
                                    {/* Abu Mafhal Brand Header */}
                                    <View style={s.receiptHeaderBrand}>
                                        <View style={s.receiptBrandLeft}>
                                            <Image source={{ uri: ABU_MAFHAL_LOGO_B64 }} style={s.receiptLogoImg} />
                                            <View>
                                                <Text style={s.receiptBrandTitle}>ABU MAFHAL HUB</Text>
                                                <Text style={s.receiptBrandSub}>PREMIUM DIGITAL INFRASTRUCTURE</Text>
                                            </View>
                                        </View>
                                        <View style={s.receiptVerifiedSeal}>
                                            <View style={s.sealGreenDot} />
                                            <Text style={s.receiptVerifiedSealText}>VERIFIED</Text>
                                        </View>
                                    </View>

                                    {/* Abu Mafhal Midnight Obsidian Amount Card */}
                                    <View style={s.detailAmountCard}>
                                        <View style={s.amountCardTopRow}>
                                            <View style={s.debitPillTag}>
                                                <Text style={s.debitPillText}>DEBIT</Text>
                                            </View>
                                            <View style={s.statusSuccessTag}>
                                                <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                                                <Text style={s.statusSuccessText}>SUCCESSFUL</Text>
                                            </View>
                                        </View>

                                        {/* Amount Hero */}
                                        <Text style={s.detailAmountText}>
                                            ₦{Number(lastTxDetails.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Text>

                                        {lastTxDetails.fee !== undefined ? (
                                            <Text style={s.detailAmountSubBreakdown}>
                                                Transfer: ₦{Number(lastTxDetails.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })} • Fee: ₦{Number(lastTxDetails.fee || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                            </Text>
                                        ) : null}
                                    </View>

                                    {/* Details Information Card (Label on top, Bold Value directly beneath) */}
                                    <View style={s.detailInfoCard}>
                                        {/* 1. Transaction Type */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Transaction Type</Text>
                                            <View style={s.typeTagPill}>
                                                <Text style={s.typeTagText}>
                                                    {lastTxDetails.type === 'p2p' ? 'Wallet Transfer' : 'Direct Bank Settlement (NIBSS)'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* 2. Sender Name */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Sender Name</Text>
                                            <Text style={s.receiptFieldValue}>{currentUserName || 'Abu Mafhal User'}</Text>
                                        </View>

                                        {/* 3. Source Institution */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Source Institution</Text>
                                            <Text style={s.receiptFieldValue}>Abu Mafhal Hub Wallet</Text>
                                        </View>

                                        {/* 4. Beneficiary */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Beneficiary</Text>
                                            <Text style={[s.receiptFieldValue, { textTransform: 'uppercase' }]}>
                                                {lastTxDetails.recipient}
                                            </Text>
                                        </View>

                                        {/* 5. Beneficiary Institution */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Beneficiary Institution</Text>
                                            <Text style={s.receiptFieldValue}>{lastTxDetails.bankName || 'Abu Mafhal Wallet Member'}</Text>
                                        </View>

                                        {/* 6. Transaction Date */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Transaction Date</Text>
                                            <Text style={s.receiptFieldValue}>{formatMoniepointDate(lastTxDetails.date)}</Text>
                                        </View>

                                        {/* 7. Transaction Reference */}
                                        <View style={s.receiptFieldBlock}>
                                            <Text style={s.receiptFieldLabel}>Transaction Reference</Text>
                                            <TouchableOpacity
                                                onPress={() => handleCopyReference(lastTxDetails.reference)}
                                                style={s.refCopyRow}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={s.refText} numberOfLines={1}>
                                                    {lastTxDetails.sessionId
                                                        ? `TRF|${lastTxDetails.reference}|${lastTxDetails.sessionId}`
                                                        : `TRF|${lastTxDetails.reference}`}
                                                </Text>
                                                <Ionicons name={copiedRef ? "checkmark-circle" : "copy-outline"} size={13} color="#D97706" />
                                            </TouchableOpacity>
                                        </View>

                                        {/* 8. Business Name / Narration */}
                                        <View style={[s.receiptFieldBlock, { marginBottom: 0 }]}>
                                            <Text style={s.receiptFieldLabel}>Business Name / Narration</Text>
                                            <Text style={s.receiptFieldValue}>
                                                {lastTxDetails.narration || currentUserName || 'Abu Mafhal Instant Settlement'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Security Notice Row */}
                                    <View style={s.securityNoticeRow}>
                                        <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                                        <Text style={s.securityNoticeText}>
                                            Audited Proof of Payment • ABU MAFHAL LTD (RC-8979939)
                                        </Text>
                                    </View>
                                </ViewShot>

                                {/* Action Buttons Column */}
                                <View style={s.modalActionsCol}>
                                    <TouchableOpacity
                                        onPress={handleOpenExportModal}
                                        style={s.pdfReceiptBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="download-outline" size={16} color="#0F172A" />
                                        <Text style={s.pdfReceiptBtnText}>Download Official Receipt (PDF / PNG)</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={handleShareWhatsApp}
                                        style={s.whatsappSupportBtn}
                                        activeOpacity={0.85}
                                        disabled={isSharingWhatsApp}
                                    >
                                        {isSharingWhatsApp ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                                                <Text style={s.whatsappSupportBtnText}>Share on WhatsApp (PDF / PNG File)</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleCopyReference(lastTxDetails.reference)}
                                        style={s.copyRefBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name={copiedRef ? "checkmark-circle" : "copy-outline"} size={15} color="#0F172A" />
                                        <Text style={s.copyRefBtnText}>{copiedRef ? 'Reference Copied!' : 'Copy Transaction Reference'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setSuccessModalVisible(false);
                                            fetchUserData();
                                        }}
                                        style={s.closeSheetBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={s.closeSheetBtnText}>Close Receipt</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── DUAL-FORMAT RECEIPT EXPORT MODAL (PDF / PNG) ─── */}
            <ReceiptExportModal
                visible={exportModalVisible}
                onClose={() => setExportModalVisible(false)}
                receiptData={exportReceiptData}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    goldTopLine: {
        height: 2,
        backgroundColor: '#D97706',
    },
    headerContainer: {
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleCol: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    paystackPoweredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 1,
    },
    headerSubtitle: {
        color: '#10B981',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    refreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1.2,
        borderColor: '#FDE68A',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
    },
    balanceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    walletIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
    },
    useMaxChip: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D97706',
    },
    useMaxChipText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900',
    },
    eyeToggleBtn: {
        padding: 3,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginTop: 8,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 5,
    },
    tabButtonActive: {
        backgroundColor: '#0F172A',
        borderColor: '#D97706',
        borderWidth: 1.5,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    tabButtonText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    tabButtonTextActive: {
        color: '#FBBF24',
        fontWeight: '900',
    },
    liveBadge: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 0.8,
        borderRadius: 5,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    liveBadgeActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
    },
    liveBadgeText: {
        color: '#B45309',
        fontSize: 8,
        fontWeight: '900',
    },
    liveBadgeTextActive: {
        color: '#0F172A',
    },
    freeTag: {
        backgroundColor: '#DCFCE7',
        borderColor: '#BBF7D0',
        borderWidth: 0.8,
        borderRadius: 5,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    freeTagActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
    },
    freeTagText: {
        color: '#15803D',
        fontSize: 8,
        fontWeight: '900',
    },
    freeTagTextActive: {
        color: '#0F172A',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '900',
    },
    cardSub: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '500',
        marginTop: 1,
    },
    transferErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
    },
    transferErrorTitle: {
        color: '#991B1B',
        fontSize: 11,
        fontWeight: '900',
    },
    transferErrorText: {
        color: '#B91C1C',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    recentSection: {
        marginBottom: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 8,
    },
    recentSectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    recentRow: {
        flexDirection: 'row',
        gap: 6,
    },
    recentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    recentName: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0F172A',
        maxWidth: 75,
    },
    recentBank: {
        fontSize: 8.5,
        color: '#64748B',
        maxWidth: 75,
    },
    fieldLabel: {
        color: '#1E293B',
        fontSize: 10.5,
        fontWeight: '800',
        marginBottom: 3,
    },
    counterText: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '700',
    },
    counterTextSuccess: {
        color: '#10B981',
        fontWeight: '900',
    },
    bankSelectTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        height: 44,
        paddingHorizontal: 10,
    },
    bankSelectTriggerFilled: {
        backgroundColor: '#FFFFFF',
        borderColor: '#F59E0B',
        borderWidth: 1.2,
    },
    emptyBankCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankPlaceholder: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
    },
    selectedBankName: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    popularBanksContainer: {
        marginTop: 6,
    },
    popularBanksLabel: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '700',
        marginBottom: 3,
    },
    popularBanksRow: {
        flexDirection: 'row',
        gap: 5,
        paddingBottom: 2,
    },
    popularBankChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 7,
        paddingVertical: 3,
        gap: 4,
    },
    popularBankText: {
        color: '#334155',
        fontSize: 9.5,
        fontWeight: '700',
        maxWidth: 75,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        height: 44,
        paddingHorizontal: 10,
    },
    inputBoxActive: {
        borderColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
    },
    textInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '600',
    },
    resolvingStatusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1.5,
        borderColor: '#FDE68A',
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
    },
    spinnerCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resolvingStatusTitle: {
        color: '#92400E',
        fontSize: 11.5,
        fontWeight: '800',
    },
    resolvingStatusSub: {
        color: '#B45309',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    pulsingAmberDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D97706',
    },
    promptSelectBankCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1.5,
        borderColor: '#FDE68A',
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
    },
    promptSelectBankTitle: {
        color: '#B45309',
        fontSize: 12,
        fontWeight: '800',
    },
    promptSelectBankSub: {
        color: '#92400E',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1.5,
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
    },
    errorAlertTitle: {
        color: '#DC2626',
        fontSize: 11.5,
        fontWeight: '900',
    },
    errorAlertText: {
        color: '#B91C1C',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    retryVerifyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        marginLeft: 6,
    },
    retryVerifyBtnText: {
        color: '#DC2626',
        fontSize: 10.5,
        fontWeight: '800',
    },
    resolvedAccountCard: {
        flexDirection: 'column',
        borderRadius: 15,
        paddingTop: 10,
        paddingBottom: 11,
        paddingHorizontal: 12,
        marginTop: 8,
        borderWidth: 1.2,
        borderColor: 'rgba(217, 119, 6, 0.45)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
        overflow: 'hidden',
    },
    verifiedAccentBar: {
        height: 2.5,
        marginHorizontal: -12,
        marginTop: -10,
        marginBottom: 8,
    },
    verifiedHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 0.8,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    verifiedHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    liveGreenDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
        marginRight: 2,
    },
    verifiedHeaderTitle: {
        color: '#38BDF8',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    verifiedHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 0.6,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    verifiedHeaderSub: {
        color: '#F59E0B',
        fontSize: 7.5,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    verifiedIdentityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    verifiedAvatarWrap: {
        position: 'relative',
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1.5,
        borderColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
    },
    verifiedCheckBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#0284C7',
        width: 13,
        height: 13,
        borderRadius: 6.5,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#090D16',
    },
    p2pAvatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#38BDF8',
    },
    p2pAvatarText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    verifiedIdentityTextWrap: {
        flex: 1,
        marginLeft: 9,
        marginRight: 6,
    },
    resolvedName: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
        lineHeight: 16,
    },
    resolvedBankSub: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 1,
    },
    accountNumberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    accountNumberChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 0.8,
        borderColor: 'rgba(56, 189, 248, 0.3)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        gap: 4,
    },
    accountNumberChipCopied: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10B981',
    },
    accountNumberChipText: {
        color: '#38BDF8',
        fontSize: 10,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 0.6,
    },
    accountNumberCopyLabel: {
        color: '#38BDF8',
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    cardActionGroup: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
    },
    cardFeatureBtn: {
        width: 26,
        height: 26,
        borderRadius: 7,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.8,
        borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    cardFeatureBtnActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
        borderColor: '#F59E0B',
    },
    cardFeatureBtnClose: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    verifiedSpecsStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 7,
        paddingVertical: 4.5,
        paddingHorizontal: 8,
        marginTop: 8,
        borderWidth: 0.6,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    verifiedSpecItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verifiedSpecLabel: {
        color: '#64748B',
        fontSize: 8,
        fontWeight: '700',
    },
    verifiedSpecValue: {
        color: '#E2E8F0',
        fontSize: 8.5,
        fontWeight: '800',
    },
    verifiedSpecDivider: {
        width: 1,
        height: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    verifiedCardDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        width: '100%',
        marginVertical: 7,
    },
    quickAmountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    quickAmountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginRight: 4,
    },
    quickAmountLabel: {
        color: '#94A3B8',
        fontSize: 8.5,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    quickAmountChipsScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    quickAmountChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        paddingHorizontal: 6.5,
        paddingVertical: 2.5,
        borderRadius: 6,
    },
    quickAmountChipActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
        borderColor: '#F59E0B',
    },
    quickAmountChipText: {
        color: '#CBD5E1',
        fontSize: 9,
        fontWeight: '800',
    },
    quickAmountChipTextActive: {
        color: '#FFD700',
    },
    quickAmountChipMax: {
        backgroundColor: 'rgba(217, 119, 6, 0.25)',
        borderColor: '#D97706',
    },
    quickAmountChipMaxText: {
        color: '#F59E0B',
    },
    verifiedLiveCalcRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3.5,
        marginTop: 6,
        borderWidth: 0.8,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    verifiedLiveCalcText: {
        color: '#94A3B8',
        fontSize: 8.5,
        fontWeight: '700',
    },
    verifiedBalanceOkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    verifiedBalanceOkText: {
        color: '#10B981',
        fontSize: 8,
        fontWeight: '800',
    },
    verifiedBalanceLowBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    verifiedBalanceLowText: {
        color: '#EF4444',
        fontSize: 8,
        fontWeight: '800',
    },
    amountInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        height: 48,
        paddingHorizontal: 12,
    },
    currencyPrefix: {
        color: '#D97706',
        fontSize: 18,
        fontWeight: '900',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '900',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        marginTop: 6,
    },
    chipBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    chipBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#D97706',
    },
    chipText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '700',
    },
    chipTextActive: {
        color: '#FBBF24',
        fontWeight: '900',
    },
    presetRow: {
        flexDirection: 'row',
        gap: 5,
        marginTop: 5,
    },
    presetChip: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    presetChipActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    presetChipText: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '600',
    },
    presetChipTextActive: {
        color: '#B45309',
        fontWeight: '800',
    },
    feeBreakdownCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 9,
        marginTop: 10,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    breakdownLabel: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
    },
    breakdownVal: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 4,
    },
    breakdownTotalLabel: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
    },
    breakdownTotalVal: {
        color: '#D97706',
        fontSize: 13,
        fontWeight: '900',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 46,
        borderRadius: 12,
        marginTop: 12,
    },
    submitBtnActive: {
        backgroundColor: '#0F172A',
        borderWidth: 1.5,
        borderColor: '#D97706',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
    },
    submitBtnDisabled: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    submitBtnTextDisabled: {
        color: '#94A3B8',
        fontWeight: '700',
    },
    emptyHistoryState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
    },
    emptyHistoryTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 6,
    },
    emptyHistorySub: {
        color: '#64748B',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },
    historyRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    historyIconPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyDesc: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '800',
    },
    historyDate: {
        color: '#64748B',
        fontSize: 9.5,
    },
    historyStatusBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    historyStatusText: {
        fontSize: 8,
        fontWeight: '900',
    },
    historyAmount: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    bankModalCard: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    modalTitle: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
    },
    modalSubtitle: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '500',
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        height: 38,
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    bankSearchInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '500',
    },
    bankRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    bankRowItemActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
    },
    bankItemName: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '600',
    },
    bankItemNameActive: {
        color: '#0F172A',
        fontWeight: '800',
    },
    emptyBankState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    emptyBankTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 6,
    },
    emptyBankSub: {
        color: '#64748B',
        fontSize: 10,
        marginTop: 2,
    },
    confirmCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    confirmIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    confirmTitle: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '900',
    },
    confirmSub: {
        color: '#64748B',
        fontSize: 10.5,
        textAlign: 'center',
        marginTop: 3,
        marginBottom: 12,
    },
    confirmDetailsBox: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 10,
        marginBottom: 14,
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    confirmLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
    },
    confirmValue: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
        maxWidth: '60%',
        textAlign: 'right',
    },
    confirmValueGold: {
        color: '#D97706',
        fontWeight: '900',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 4,
    },
    confirmActionRow: {
        flexDirection: 'row',
        gap: 8,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '800',
    },
    proceedBtn: {
        flex: 1.5,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#D97706',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedBtnText: {
        color: '#F59E0B',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    loadingModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingModalCard: {
        width: 260,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    loadingModalTitle: {
        color: '#0F172A',
        fontSize: 13.5,
        fontWeight: '900',
        marginTop: 12,
    },
    loadingModalSub: {
        color: '#64748B',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 14,
    },
    errorModalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    errorModalIconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    errorModalTitle: {
        color: '#991B1B',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    errorModalMessage: {
        color: '#475569',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 10,
    },
    safeGuaranteePill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 12,
        gap: 6,
    },
    safeGuaranteeText: {
        color: '#065F46',
        fontSize: 10,
        fontWeight: '700',
    },
    errorModalBtn: {
        width: '100%',
        height: 40,
        borderRadius: 10,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorModalBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '900',
    },
    insufficientBalanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1.2,
        borderColor: '#FECACA',
        borderRadius: 14,
        padding: 12,
        marginTop: 8,
    },
    insufficientIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    insufficientTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#991B1B',
    },
    insufficientText: {
        fontSize: 10.5,
        color: '#7F1D1D',
        marginTop: 2,
        lineHeight: 14,
    },
    topupSmallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DC2626',
        paddingVertical: 7,
        paddingHorizontal: 9,
        borderRadius: 9,
        marginLeft: 6,
    },
    topupSmallBtnText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '900',
    },
    receiptModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'flex-end',
    },
    receiptModalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 14,
        borderTopWidth: 2,
        borderColor: '#D97706',
        maxHeight: '85%',
        maxWidth: 550,
        width: '100%',
        alignSelf: 'center',
    },
    receiptModalDragBar: {
        width: 32,
        height: 3.5,
        backgroundColor: '#CBD5E1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 10,
    },
    receiptModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    receiptModalHeaderTitle: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
    },
    receiptModalCloseBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptCaptureWrap: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
    },
    receiptHeaderBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 10,
    },
    receiptBrandLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    receiptLogoImg: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DAA520',
    },
    receiptBrandTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 0.5,
    },
    receiptBrandSub: {
        fontSize: 8,
        fontWeight: '800',
        color: '#D97706',
        letterSpacing: 0.5,
        marginTop: 1,
    },
    receiptVerifiedSeal: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: '#A7F3D0',
    },
    sealGreenDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
    },
    receiptVerifiedSealText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#059669',
        letterSpacing: 0.5,
    },
    detailAmountCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.45)',
        marginBottom: 10,
    },
    amountCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 6,
    },
    debitPillTag: {
        backgroundColor: 'rgba(217, 119, 6, 0.2)',
        borderWidth: 0.8,
        borderColor: 'rgba(245, 158, 11, 0.5)',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6,
    },
    debitPillText: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    statusSuccessTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 0.8,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 12,
    },
    statusSuccessText: {
        color: '#34D399',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    detailAmountText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        marginBottom: 2,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    detailAmountSubBreakdown: {
        fontSize: 9,
        color: '#CBD5E1',
        fontWeight: '600',
        marginTop: 2,
    },
    detailInfoCard: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    receiptFieldBlock: {
        marginBottom: 10,
    },
    receiptFieldLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 2,
    },
    receiptFieldValue: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '800',
    },
    typeTagPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#FEF3C7',
        borderWidth: 0.5,
        borderColor: '#FDE68A',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 5,
        marginTop: 2,
    },
    typeTagText: {
        color: '#B45309',
        fontSize: 11,
        fontWeight: '800',
    },
    refCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#CBD5E1',
        marginTop: 2,
    },
    refText: {
        color: '#0F172A',
        fontSize: 10.5,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        flex: 1,
        marginRight: 6,
    },
    securityNoticeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        marginTop: 2,
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    securityNoticeText: {
        fontSize: 8.5,
        fontWeight: '700',
        color: '#64748B',
    },
    modalActionsCol: {
        gap: 6,
        marginTop: 4,
        marginBottom: 10,
    },
    pdfReceiptBtn: {
        backgroundColor: '#FFD700',
        height: 40,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#DAA520',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    pdfReceiptBtnText: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    copyRefBtn: {
        backgroundColor: '#F1F5F9',
        height: 38,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    copyRefBtnText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
    },
    whatsappSupportBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#25D366',
        borderWidth: 1,
        height: 38,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    whatsappSupportBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    closeSheetBtn: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeSheetBtnText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '800',
    },
    tierLockCard: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    tierLockHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    tierLockIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tierLockTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#991B1B',
    },
    tier1Badge: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    tier1BadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    tierLockSubtitle: {
        fontSize: 10.5,
        color: '#7F1D1D',
        marginTop: 3,
        lineHeight: 14.5,
    },
    tierUpgradeBtn: {
        backgroundColor: '#F59E0B',
        height: 36,
        borderRadius: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 10,
    },
    tierUpgradeBtnText: {
        color: '#020617',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
});
