import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import SecurityModal from '../../components/SecurityModal';
import DynamicBanners from '../../components/DynamicBanners';
import { createAppNotification } from '../../services/notificationsHelper';

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

// Generate Official Bank E-Receipt HTML for PDF
const generateReceiptHtml = (tx: {
    amount: number;
    fee?: number;
    totalDebit?: number;
    recipient: string;
    bankName?: string;
    accountNumber?: string;
    type: 'p2p' | 'bank';
    reference: string;
    sessionId?: string;
    status?: string;
    date: string;
    newBalance: number;
    narration?: string;
}) => {
    const isSuccess = !tx.status || tx.status.toUpperCase() === 'SUCCESSFUL' || tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'COMPLETED';
    const feeDisplay = tx.type === 'p2p' ? '₦0.00 (FREE)' : `₦${(tx.fee ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const totalDebitDisplay = `₦${(tx.totalDebit ?? tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const amountDisplay = `₦${tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const newBalDisplay = `₦${tx.newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const channelDisplay = tx.type === 'p2p' ? 'Abu Mafhal Wallet (P2P Transfer)' : 'Direct Bank Settlement (NIBSS Network)';
    const statusText = isSuccess ? 'TRANSACTION SUCCESSFUL' : 'TRANSACTION PROCESSING / PENDING';
    const statusColor = isSuccess ? '#059669' : '#D97706';
    const statusBg = isSuccess ? '#D1FAE5' : '#FEF3C7';
    const statusBorder = isSuccess ? '#A7F3D0' : '#FDE68A';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Receipt - ${tx.reference}</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #F1F5F9; color: #0F172A; padding: 24px; }
            .receipt-card { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1.5px solid #E2E8F0; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
            .header-banner { background: #0F172A; padding: 22px 20px; text-align: center; border-bottom: 3px solid #D97706; }
            .brand-name { color: #F59E0B; font-size: 20px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
            .brand-sub { color: #94A3B8; font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; margin-top: 4px; text-transform: uppercase; }
            .amount-box { padding: 22px 20px; text-align: center; background: #FFFBEB; border-bottom: 1px dashed #FDE68A; }
            .amount-label { color: #B45309; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
            .amount-val { color: #0F172A; font-size: 30px; font-weight: 900; margin: 6px 0; }
            .status-badge { display: inline-block; background: ${statusBg}; color: ${statusColor}; padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid ${statusBorder}; }
            .details-list { padding: 18px 22px; }
            .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #F1F5F9; font-size: 11.5px; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { color: #64748B; font-weight: 600; }
            .detail-val { color: #0F172A; font-weight: 800; text-align: right; max-width: 60%; word-break: break-word; }
            .highlight-gold { color: #D97706; }
            .highlight-green { color: #059669; }
            .barcode-box { background: #0F172A; padding: 18px 20px; text-align: center; border-top: 1px dashed #334155; }
            .seal-text { color: #F59E0B; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
            .disclaimer { color: #94A3B8; font-size: 8.5px; margin-top: 6px; line-height: 14px; }
            @media print {
                body { background: #FFFFFF; padding: 0; }
                .receipt-card { box-shadow: none; border: 1px solid #CBD5E1; }
            }
        </style>
    </head>
    <body>
        <div class="receipt-card">
            <div class="header-banner">
                <div class="brand-name">ABU MAFHAL HUB</div>
                <div class="brand-sub">Official Electronic Transaction Receipt</div>
            </div>
            <div class="amount-box">
                <div class="amount-label">Transfer Amount</div>
                <div class="amount-val">${amountDisplay}</div>
                <div class="status-badge">${statusText}</div>
            </div>
            <div class="details-list">
                <div class="detail-row">
                    <span class="detail-label">Beneficiary Name</span>
                    <span class="detail-val">${tx.recipient}</span>
                </div>
                ${tx.bankName ? `
                <div class="detail-row">
                    <span class="detail-label">Destination Bank</span>
                    <span class="detail-val">${tx.bankName}</span>
                </div>` : ''}
                ${tx.accountNumber ? `
                <div class="detail-row">
                    <span class="detail-label">Account Number</span>
                    <span class="detail-val">${tx.accountNumber}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">Transfer Fee</span>
                    <span class="detail-val">${feeDisplay}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Amount Debited</span>
                    <span class="detail-val highlight-gold">${totalDebitDisplay}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction Status</span>
                    <span class="detail-val" style="color: ${statusColor};">${tx.status || (isSuccess ? 'SUCCESSFUL' : 'PENDING')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Channel</span>
                    <span class="detail-val">${channelDisplay}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction Reference</span>
                    <span class="detail-val" style="font-family: monospace; font-size: 10.5px;">${tx.reference}</span>
                </div>
                ${tx.sessionId ? `
                <div class="detail-row">
                    <span class="detail-label">Session ID / NIP Ref</span>
                    <span class="detail-val" style="font-family: monospace; font-size: 10px;">${tx.sessionId}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">Date & Time</span>
                    <span class="detail-val">${tx.date}</span>
                </div>
                ${tx.narration ? `
                <div class="detail-row">
                    <span class="detail-label">Narration / Remark</span>
                    <span class="detail-val">${tx.narration}</span>
                </div>` : ''}
            </div>
            <div class="barcode-box">
                <div class="seal-text">&#128274; Authentic Electronic Receipt</div>
                <div class="disclaimer">This receipt confirms a transaction processed via Abu Mafhal Hub Core Financial Network. Valid for audit and verification purposes. Support: help@abumafhal.com</div>
            </div>
        </div>
    </body>
    </html>
    `;
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

export default function TransferScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();
    const viewShotRef = useRef<any>(null);

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
    const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSavingGallery, setIsSavingGallery] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);
    const [copiedRef, setCopiedRef] = useState(false);

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

    // Fee calculation
    const feeThreshold = parseFloat(settings?.transfer_fee_threshold || '10000');
    const feeBelow10k = parseFloat(settings?.transfer_fee_below_10k || '22');
    const feeAbove10k = parseFloat(settings?.transfer_fee_above_10k || '62');

    const numAmount = parseFloat(amount) || 0;
    const transferFee = activeTab === 'p2p' ? 0 : (numAmount <= 0 ? 0 : (numAmount < feeThreshold ? feeBelow10k : feeAbove10k));
    const totalDebit = numAmount + transferFee;

    // Error Notice Modal state
    const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);

    // Load recent beneficiaries and history
    useEffect(() => {
        loadRecentBeneficiaries();
    }, []);

    const loadRecentBeneficiaries = async () => {
        try {
            const stored = await AsyncStorage.getItem('@recent_bank_beneficiaries');
            if (stored) {
                setRecentBeneficiaries(JSON.parse(stored));
            }
        } catch (_) {}
    };

    const saveRecentBeneficiary = async (accNum: string, accName: string, bCode: string, bName: string) => {
        try {
            const stored = await AsyncStorage.getItem('@recent_bank_beneficiaries');
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
            await AsyncStorage.setItem('@recent_bank_beneficiaries', JSON.stringify(list));
            setRecentBeneficiaries(list);
        } catch (_) {}
    };

    // Fetch User Balance & Transfer History
    const fetchUserData = async () => {
        setLoadingBalance(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data } = await supabase
                    .from('profiles')
                    .select('balance, full_name')
                    .eq('id', user.id)
                    .single();
                if (data) {
                    setUserBalance(Number(data.balance) || 0);
                    if (data.full_name) setCurrentUserName(data.full_name);
                }
                fetchTransferHistory(user.id);
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

    // Load Banks List on Mount
    useEffect(() => {
        fetchUserData();

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

    // Form Validity
    const isFormValid = useMemo(() => {
        if (numAmount < MIN_TRANSFER_AMOUNT) return false;
        if (userBalance > 0 && totalDebit > userBalance) return false;
        if (activeTab === 'p2p') {
            return !!matchedUser;
        } else {
            return !!selectedBank && accountNumber.trim().length === 10 && !!accountName.trim();
        }
    }, [activeTab, matchedUser, selectedBank, accountNumber, accountName, numAmount, totalDebit, userBalance]);

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
                const errorMsg = data?.message || "Ba a gano wannan asusun ba. Da fatan a sake duba lambar asusun da bankin da aka zaba.";
                setResolveError(errorMsg);
                setAccountName('');
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else if (data?.account_name) {
                setAccountName(data.account_name);
                setResolveError(null);
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err: any) {
            setResolveError('Matsalar sadarwa wajen gano asusun banki. Da fatan a sake gwadawa.');
            setAccountName('');
        } finally {
            setIsResolvingAccount(false);
        }
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
        if (numAmount <= 0) {
            setErrorModalMessage('Da fatan za a shigar da adadin kuɗin da za a tura (Please enter transfer amount).');
            return;
        }
        if (numAmount < MIN_TRANSFER_AMOUNT) {
            setErrorModalMessage(`Mafi ƙarancin transfer shine ₦${MIN_TRANSFER_AMOUNT.toLocaleString('en-NG', { minimumFractionDigits: 2 })} (Minimum transfer amount is ₦100.00).`);
            return;
        }

        if (!isFormValid) {
            if (activeTab === 'bank') {
                if (!selectedBank) {
                    setErrorModalMessage('Da fatan za a zaɓi bankin da za a tura kuɗin (Please select destination bank).');
                } else if (accountNumber.trim().length !== 10) {
                    setErrorModalMessage('Lambar asusu dole ne ta kasance lamba 10 cif (Enter a valid 10-digit account number).');
                } else if (!accountName) {
                    setErrorModalMessage('Ana kan tantance sunan mai asusu, da fatan a dakata kaɗan (Please wait for account name verification).');
                } else if (totalDebit > userBalance) {
                    setErrorModalMessage(`Kuɗin aljihunka bai isa ba (Insufficient Balance). Ana buƙatar ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })} (ciki har da kuɗin sabis ₦${transferFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}), amma kuna da ₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`);
                }
            } else {
                if (!matchedUser) {
                    setErrorModalMessage('Da fatan za a shigar da lambar waya, imel ko sunan memba (Enter recipient phone, email or username).');
                } else if (totalDebit > userBalance) {
                    setErrorModalMessage(`Kuɗin aljihunka bai isa ba (Insufficient Balance). Ana buƙatar ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}, amma kuna da ₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`);
                }
            }
            return;
        }

        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmModalVisible(true);
    };

    // Execute Confirmed Transfer via Edge Function
    const handleExecuteConfirmedTransfer = async () => {
        setIsSubmitting(true);
        setTransferError(null);

        try {
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
                });

                if (p2pResult.error) {
                    p2pResult = await supabase.rpc('execute_p2p_transfer', {
                        target_id: matchedUser!.id,
                        amount: currentAmount,
                        note: currentNarration || 'Wallet transfer via Abu Mafhal Hub',
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
            const errMsg = err.message || 'Unable to complete transfer. Your wallet balance was NOT charged.';
            setTransferError(errMsg);
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
                setErrorModalMessage(errMsg);
            }, 150);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 1. WhatsApp Direct Sharing (Guaranteed & Instant)
    const handleShareWhatsApp = async () => {
        if (!lastTxDetails) return;
        try {
            const text = formatReceiptSummaryText(lastTxDetails);
            const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
            const canOpen = await Linking.canOpenURL(url).catch(() => false);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                await Share.share({
                    message: text,
                    title: 'Abu Mafhal Transfer Receipt',
                });
            }
        } catch (_) {
            const text = formatReceiptSummaryText(lastTxDetails);
            await Share.share({ message: text, title: 'Abu Mafhal Transfer Receipt' });
        }
    };

    // 2. Share Receipt as Image (PNG)
    const handleShareImageReceipt = async () => {
        if (!lastTxDetails) return;
        setIsGeneratingReceipt(true);
        try {
            let uri: string | null = null;
            if (viewShotRef.current) {
                uri = viewShotRef.current.capture
                    ? await viewShotRef.current.capture()
                    : await captureRef(viewShotRef, { format: 'png', quality: 1.0 });
            }
            if (uri) {
                const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
                if (isAvailable) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Share Transfer Receipt Image (PNG)',
                    });
                    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setIsGeneratingReceipt(false);
                    return;
                }
            }
        } catch (captureErr) {
            console.warn('View capture notice:', captureErr);
        }

        // Universal Fallback: Native Share Sheet with formatted text
        try {
            const text = formatReceiptSummaryText(lastTxDetails);
            await Share.share({
                message: text,
                title: 'Abu Mafhal Transfer Receipt',
            });
        } catch (e) {
            console.warn('Fallback share error:', e);
        } finally {
            setIsGeneratingReceipt(false);
        }
    };

    // 2b. Save Receipt Directly to Phone Gallery
    const handleSaveImageToGallery = async () => {
        if (!lastTxDetails) return;
        setIsSavingGallery(true);
        try {
            let uri: string | null = null;
            if (viewShotRef.current) {
                uri = viewShotRef.current.capture
                    ? await viewShotRef.current.capture()
                    : await captureRef(viewShotRef, { format: 'png', quality: 1.0 });
            }

            if (!uri) {
                Alert.alert('Notice', 'Unable to capture receipt image right now. Please try again.');
                return;
            }

            const permission = await MediaLibrary.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Please allow storage / photo permission to save receipts to your phone gallery.'
                );
                return;
            }

            await MediaLibrary.saveToLibraryAsync(uri);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'An Ajiye a Gallery! 📸',
                'An yi nasarar ajiye hoton official receipt din a cikin Photos/Gallery na wayarka.'
            );
        } catch (err: any) {
            console.warn('Save to gallery error:', err);
            Alert.alert('Save Failed', err.message || 'Could not save receipt image to gallery.');
        } finally {
            setIsSavingGallery(false);
        }
    };

    // 3. Share Receipt as PDF Document
    const handleSharePdfReceipt = async () => {
        if (!lastTxDetails) return;
        setIsGeneratingPdf(true);
        try {
            const html = generateReceiptHtml({
                ...lastTxDetails,
                narration: lastTxDetails.narration || (lastTxDetails.type === 'p2p' ? 'Wallet Transfer' : 'Direct Bank Settlement'),
            });
            const { uri } = await Print.printToFileAsync({ html });
            const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
            if (isAvailable) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Share Official Transfer Receipt (PDF)',
                });
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                await Print.printAsync({ html });
            }
        } catch (pdfErr: any) {
            console.warn('PDF generation error, trying print fallback:', pdfErr);
            try {
                const html = generateReceiptHtml({
                    ...lastTxDetails,
                    narration: lastTxDetails.narration || (lastTxDetails.type === 'p2p' ? 'Wallet Transfer' : 'Direct Bank Settlement'),
                });
                await Print.printAsync({ html });
            } catch (_) {
                const text = formatReceiptSummaryText(lastTxDetails);
                await Share.share({ message: text, title: 'Abu Mafhal Transfer Receipt' });
            }
        } finally {
            setIsGeneratingPdf(false);
        }
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
                                    <Text style={s.promptSelectBankTitle}>Zaɓi Bankin da Asusun yake</Text>
                                    <Text style={s.promptSelectBankSub}>Danna nan don zaɓar banki don gano sunan mai asusun</Text>
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
                                        <Text style={s.resolvingStatusTitle}>Tantance Sunan Mai Asusu...</Text>
                                        <View style={s.pulsingAmberDot} />
                                    </View>
                                    <Text style={s.resolvingStatusSub}>Ana binciko cikakken sunan asusun ta hanyar NIBSS...</Text>
                                </View>
                            </View>
                        )}

                        {resolveError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={s.errorAlertTitle}>Ba a Gano Asusun Ba</Text>
                                    <Text style={s.errorAlertText}>{resolveError}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleVerifyBeneficiary}
                                    style={s.retryVerifyBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="refresh" size={13} color="#DC2626" style={{ marginRight: 3 }} />
                                    <Text style={s.retryVerifyBtnText}>Sake Gwada</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {accountName ? (
                            <View style={s.resolvedAccountCard}>
                                <View style={s.verifiedAvatarWrap}>
                                    <BankLogoBadge bank={selectedBank!} size={42} />
                                    <View style={s.verifiedCheckBadge}>
                                        <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
                                    </View>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <View style={s.verifiedPillRow}>
                                        <View style={s.verifiedTag}>
                                            <Ionicons name="shield-checkmark" size={11} color="#059669" style={{ marginRight: 3 }} />
                                            <Text style={s.verifiedTagText}>ASUSUN DA AKA TANTANCE</Text>
                                        </View>
                                        <View style={s.liveGreenDot} />
                                    </View>
                                    <Text style={s.resolvedName} numberOfLines={2}>
                                        {accountName}
                                    </Text>
                                    <View style={s.accountMetaRow}>
                                        <Text style={s.resolvedBankSub}>
                                            {selectedBank?.name}
                                        </Text>
                                        <Text style={s.accountNumberTag}>
                                            {accountNumber}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setAccountNumber('');
                                        setAccountName('');
                                    }}
                                    style={s.editAccountBtn}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="create-outline" size={16} color="#059669" />
                                </TouchableOpacity>
                            </View>
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
                                    Mafi karancin transfer shine ₦{MIN_TRANSFER_AMOUNT}.00 (Minimum transfer is ₦100)
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
                                    <Text style={s.insufficientTitle}>Kuɗin Aljihunka Bai Isa Ba</Text>
                                    <Text style={s.insufficientText}>
                                        Kuna da <Text style={{ fontWeight: '800' }}>₦{userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>, amma ana buƙatar <Text style={{ fontWeight: '800', color: '#DC2626' }}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text> (ciki har da kuɗin sabis ₦{transferFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}).
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={s.topupSmallBtn}
                                    onPress={() => router.push('/(app)/wallet')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add-circle" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                                    <Text style={s.topupSmallBtnText}>Sanya Kuɗi</Text>
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
                            onPress={handleInitiateTransfer}
                            style={[
                                s.submitBtn,
                                !isFormValid ? s.submitBtnDisabled : s.submitBtnActive,
                            ]}
                            disabled={!isFormValid || isSubmitting}
                            activeOpacity={0.85}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons
                                        name="arrow-up-circle"
                                        size={18}
                                        color={!isFormValid ? '#64748B' : '#F59E0B'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[s.submitBtnText, !isFormValid && s.submitBtnTextDisabled]}>
                                        {numAmount > 0 && numAmount < MIN_TRANSFER_AMOUNT
                                            ? `MINIMUM TRANSFER IS ₦${MIN_TRANSFER_AMOUNT}`
                                            : isFormValid
                                            ? `TRANSFER ₦${numAmount.toLocaleString()} NOW`
                                            : 'ENTER TRANSFER DETAILS'}
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
                            <View style={s.resolvedAccountCard}>
                                <View style={s.verifiedAvatarWrap}>
                                    <View style={s.p2pAvatarCircle}>
                                        <Text style={s.p2pAvatarText}>
                                            {(matchedUser.full_name || 'U').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={s.verifiedCheckBadge}>
                                        <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
                                    </View>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <View style={s.verifiedPillRow}>
                                        <View style={s.verifiedTag}>
                                            <Ionicons name="person-circle" size={11} color="#059669" style={{ marginRight: 3 }} />
                                            <Text style={s.verifiedTagText}>ASUSUN DA AKA TANTANCE</Text>
                                        </View>
                                        <View style={s.liveGreenDot} />
                                    </View>
                                    <Text style={s.resolvedName} numberOfLines={2}>
                                        {matchedUser.full_name}
                                    </Text>
                                    <View style={s.accountMetaRow}>
                                        <Text style={s.resolvedBankSub}>
                                            {matchedUser.phone || matchedUser.email}
                                        </Text>
                                        {matchedUser.username ? (
                                            <Text style={s.accountNumberTag}>@{matchedUser.username}</Text>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
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
                                    Mafi karancin transfer shine ₦{MIN_TRANSFER_AMOUNT}.00 (Minimum transfer is ₦100)
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
                                    <Text style={s.insufficientTitle}>Kuɗin Aljihunka Bai Isa Ba</Text>
                                    <Text style={s.insufficientText}>
                                        Kuna da <Text style={{ fontWeight: '800' }}>₦{userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>, amma ana buƙatar <Text style={{ fontWeight: '800', color: '#DC2626' }}>₦{totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={s.topupSmallBtn}
                                    onPress={() => router.push('/(app)/wallet')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add-circle" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                                    <Text style={s.topupSmallBtnText}>Sanya Kuɗi</Text>
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
                            onPress={handleInitiateTransfer}
                            style={[
                                s.submitBtn,
                                !isFormValid ? s.submitBtnDisabled : s.submitBtnActive,
                            ]}
                            disabled={!isFormValid || isSubmitting}
                            activeOpacity={0.85}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons
                                        name="paper-plane"
                                        size={17}
                                        color={!isFormValid ? '#64748B' : '#F59E0B'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[s.submitBtnText, !isFormValid && s.submitBtnTextDisabled]}>
                                        {numAmount > 0 && numAmount < MIN_TRANSFER_AMOUNT
                                            ? `MINIMUM TRANSFER IS ₦${MIN_TRANSFER_AMOUNT}`
                                            : isFormValid
                                            ? `SEND ₦${numAmount.toLocaleString()} TO MEMBER`
                                            : 'ENTER MEMBER DETAILS'}
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
                onSuccess={() => {
                    setSecurityModalVisible(false);
                    setTimeout(() => {
                        handleExecuteConfirmedTransfer();
                    }, 300);
                }}
                title="Security PIN"
                description={`Enter transaction PIN to authorize debit of ₦${totalDebit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
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
                        <View style={[
                            s.errorModalIconCircle,
                            (errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
                        ]}>
                            <Ionicons
                                name={(errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) ? "wallet-outline" : "alert-circle"}
                                size={28}
                                color="#DC2626"
                            />
                        </View>
                        <Text style={s.errorModalTitle}>
                            {(errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) ? 'Kuɗin Aljihu Bai Isa Ba' : 'Sanarwar Canja Wuri'}
                        </Text>
                        <Text style={s.errorModalMessage}>{errorModalMessage}</Text>
                        
                        <View style={{ width: '100%', gap: 8 }}>
                            {(errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setErrorModalMessage(null);
                                        router.push('/(app)/wallet');
                                    }}
                                    style={[s.errorModalBtn, { backgroundColor: '#059669' }]}
                                    activeOpacity={0.85}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="card" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={s.errorModalBtnText}>SANYA KUƊI (ADD MONEY)</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => setErrorModalMessage(null)}
                                style={[
                                    s.errorModalBtn,
                                    (errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1 }
                                ]}
                                activeOpacity={0.85}
                            >
                                <Text style={[
                                    s.errorModalBtnText,
                                    (errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) && { color: '#475569' }
                                ]}>
                                    {(errorModalMessage?.toLowerCase().includes('insufficient') || errorModalMessage?.toLowerCase().includes('bai isa ba')) ? 'RUFE (CLOSE)' : 'TO, NA FAHIMTA'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── HIGH DEFINITION MODERNIZED RECEIPT MODAL ───────── */}
            <Modal
                visible={successModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.successCard}>
                        {/* Printable / Capturable Receipt Area via ViewShot */}
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={s.receiptSheet}>
                            {/* Navy Header Banner with Gold Shield */}
                            <View style={s.receiptHeaderBanner}>
                                <View style={s.receiptLogoCircle}>
                                    <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={s.receiptBrandTitle}>ABU MAFHAL HUB</Text>
                                    <Text style={s.receiptBrandSub}>OFFICIAL TRANSACTION RECEIPT</Text>
                                </View>
                                {(!lastTxDetails?.status || lastTxDetails.status === 'SUCCESSFUL' || lastTxDetails.status === 'SUCCESS') ? (
                                    <View style={s.receiptSuccessMiniPill}>
                                        <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                                        <Text style={s.receiptSuccessMiniText}>SUCCESS</Text>
                                    </View>
                                ) : (
                                    <View style={[s.receiptSuccessMiniPill, { backgroundColor: '#78350F', borderColor: '#F59E0B' }]}>
                                        <Ionicons name="time" size={11} color="#FBBF24" />
                                        <Text style={[s.receiptSuccessMiniText, { color: '#FDE68A' }]}>PROCESSING</Text>
                                    </View>
                                )}
                            </View>

                            {/* Amount Box */}
                            <View style={s.receiptAmountBox}>
                                <Text style={s.receiptAmountLabel}>TRANSFER AMOUNT</Text>
                                <Text style={s.receiptAmount}>
                                    ₦{lastTxDetails ? lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
                                </Text>
                                {(!lastTxDetails?.status || lastTxDetails.status === 'SUCCESSFUL' || lastTxDetails.status === 'SUCCESS') ? (
                                    <View style={s.receiptStatusBadge}>
                                        <Ionicons name="checkmark-circle" size={11} color="#059669" />
                                        <Text style={s.receiptStatusText}>TRANSACTION COMPLETED</Text>
                                    </View>
                                ) : (
                                    <View style={[s.receiptStatusBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                                        <Ionicons name="time" size={11} color="#D97706" />
                                        <Text style={[s.receiptStatusText, { color: '#B45309' }]}>PROCESSING / PENDING</Text>
                                    </View>
                                )}
                            </View>

                            {/* Details Table */}
                            <View style={s.receiptDetailsTable}>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Beneficiary:</Text>
                                    <Text style={[s.receiptVal, { fontWeight: '900', color: '#0F172A' }]} numberOfLines={1}>
                                        {lastTxDetails?.recipient}
                                    </Text>
                                </View>
                                {lastTxDetails?.bankName && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Destination Bank:</Text>
                                        <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails.bankName}</Text>
                                    </View>
                                )}
                                {lastTxDetails?.accountNumber && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Account Number:</Text>
                                        <Text style={[s.receiptVal, { letterSpacing: 0.5 }]}>{lastTxDetails.accountNumber}</Text>
                                    </View>
                                )}
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Transfer Fee:</Text>
                                    <Text style={s.receiptVal}>
                                        {lastTxDetails?.type === 'p2p' ? '₦0.00 (FREE)' : `₦${(lastTxDetails?.fee ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
                                    </Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Total Debited:</Text>
                                    <Text style={[s.receiptVal, { color: '#D97706', fontWeight: '900' }]}>
                                        ₦{(lastTxDetails?.totalDebit ?? lastTxDetails?.amount ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Status:</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (!lastTxDetails?.status || lastTxDetails.status === 'SUCCESSFUL' || lastTxDetails.status === 'SUCCESS') ? '#10B981' : '#F59E0B' }} />
                                        <Text style={[s.receiptVal, { color: (!lastTxDetails?.status || lastTxDetails.status === 'SUCCESSFUL' || lastTxDetails.status === 'SUCCESS') ? '#059669' : '#D97706', fontWeight: '900' }]}>
                                            {lastTxDetails?.status || 'SUCCESSFUL'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Payment Channel:</Text>
                                    <Text style={s.receiptVal}>
                                        {lastTxDetails?.type === 'p2p' ? 'Abu Mafhal Wallet (P2P)' : 'Direct Bank Settlement (NIBSS)'}
                                    </Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Reference:</Text>
                                    <TouchableOpacity
                                        onPress={() => lastTxDetails && handleCopyReference(lastTxDetails.reference)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.receiptVal, { color: '#D97706', fontSize: 9.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                                            {lastTxDetails?.reference}
                                        </Text>
                                        <Ionicons name={copiedRef ? "checkmark-done" : "copy-outline"} size={12} color="#D97706" />
                                    </TouchableOpacity>
                                </View>
                                {lastTxDetails?.sessionId ? (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Session ID / NIP:</Text>
                                        <TouchableOpacity
                                            onPress={() => lastTxDetails.sessionId && handleCopyReference(lastTxDetails.sessionId)}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[s.receiptVal, { color: '#64748B', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]} numberOfLines={1}>
                                                {lastTxDetails.sessionId}
                                            </Text>
                                            <Ionicons name="copy-outline" size={11} color="#64748B" />
                                        </TouchableOpacity>
                                    </View>
                                ) : null}
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Date & Time:</Text>
                                    <Text style={s.receiptVal}>{lastTxDetails?.date}</Text>
                                </View>
                                {lastTxDetails?.narration ? (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Narration:</Text>
                                        <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails.narration}</Text>
                                    </View>
                                ) : null}
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Verification:</Text>
                                    <Text style={[s.receiptVal, { color: '#059669', fontWeight: '800' }]}>
                                        Secured via NIBSS Network ✓
                                    </Text>
                                </View>
                            </View>

                            {/* Security Barcode Simulation Footer */}
                            <View style={s.receiptSecurityFooter}>
                                <View style={s.receiptBarcodeSim}>
                                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                                        {[14, 20, 12, 24, 16, 22, 10, 24, 18, 14, 22, 12, 24, 16, 20, 12, 24, 18, 14, 20, 16, 22, 12].map((h, i) => (
                                            <View key={i} style={{ width: (i % 3 === 0) ? 2.5 : 1.2, height: h, backgroundColor: '#94A3B8' }} />
                                        ))}
                                    </View>
                                    <Text style={s.receiptBarcodeText}>{lastTxDetails?.sessionId || lastTxDetails?.reference || 'ABU-MAFHAL-PAY'}</Text>
                                </View>
                                <Text style={s.receiptDisclaimer}>
                                    Authentic electronic transaction receipt generated by Abu Mafhal Hub.
                                </Text>
                            </View>
                        </ViewShot>

                        {/* Modernized Sharing Action Buttons */}
                        <View style={s.receiptActionsBox}>
                            {/* Primary Row: WhatsApp & Save to Gallery */}
                            <View style={s.shareButtonsRow}>
                                <TouchableOpacity
                                    onPress={handleShareWhatsApp}
                                    style={s.shareWhatsAppBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                    <Text style={s.shareWhatsAppBtnText}>WhatsApp 💬</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSaveImageToGallery}
                                    style={s.saveGalleryBtn}
                                    activeOpacity={0.8}
                                    disabled={isSavingGallery || isGeneratingReceipt || isGeneratingPdf}
                                >
                                    {isSavingGallery ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="download-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                            <Text style={s.saveGalleryBtnText}>Save Gallery 📸</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Secondary Row: Share PNG & PDF */}
                            <View style={s.shareButtonsRow}>
                                <TouchableOpacity
                                    onPress={handleShareImageReceipt}
                                    style={s.shareImageBtn}
                                    activeOpacity={0.8}
                                    disabled={isSavingGallery || isGeneratingReceipt || isGeneratingPdf}
                                >
                                    {isGeneratingReceipt ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="image-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                            <Text style={s.shareImageBtnText}>Share PNG 🖼️</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSharePdfReceipt}
                                    style={s.sharePdfBtn}
                                    activeOpacity={0.8}
                                    disabled={isSavingGallery || isGeneratingReceipt || isGeneratingPdf}
                                >
                                    {isGeneratingPdf ? (
                                        <ActivityIndicator size="small" color="#0F172A" />
                                    ) : (
                                        <>
                                            <Ionicons name="document-text-outline" size={14} color="#0F172A" style={{ marginRight: 4 }} />
                                            <Text style={s.sharePdfBtnText}>Print / PDF 📄</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Tertiary Row: Done Button */}
                            <TouchableOpacity
                                onPress={() => {
                                    setSuccessModalVisible(false);
                                    fetchUserData();
                                }}
                                style={s.closeReceiptBtn}
                                activeOpacity={0.8}
                            >
                                <Text style={s.closeReceiptBtnText}>CLOSE / KAMMALA ✕</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#10B981',
        borderRadius: 14,
        padding: 12,
        marginTop: 8,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    verifiedAvatarWrap: {
        position: 'relative',
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifiedCheckBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#059669',
        width: 17,
        height: 17,
        borderRadius: 8.5,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    p2pAvatarCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
    },
    p2pAvatarText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
    },
    verifiedPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    verifiedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    verifiedTagText: {
        color: '#059669',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    liveGreenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    resolvedName: {
        color: '#064E3B',
        fontSize: 15.5,
        fontWeight: '900',
        lineHeight: 20,
        letterSpacing: 0.2,
        marginTop: 2,
    },
    accountMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    resolvedBankSub: {
        color: '#047857',
        fontSize: 11,
        fontWeight: '700',
    },
    accountNumberTag: {
        color: '#334155',
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        letterSpacing: 0.5,
    },
    editAccountBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        marginLeft: 8,
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
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorModalIconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    errorModalTitle: {
        color: '#991B1B',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 4,
    },
    errorModalMessage: {
        color: '#475569',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 14,
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
    successCard: {
        width: '100%',
        maxWidth: 370,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    receiptSheet: {
        backgroundColor: '#FFFFFF',
    },
    receiptHeaderBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderColor: '#D97706',
    },
    receiptLogoCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptBrandTitle: {
        color: '#F59E0B',
        fontSize: 12.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    receiptBrandSub: {
        color: '#94A3B8',
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1,
    },
    receiptSuccessMiniPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#064E3B',
        borderWidth: 1,
        borderColor: '#10B981',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    receiptSuccessMiniText: {
        color: '#A7F3D0',
        fontSize: 8,
        fontWeight: '900',
    },
    receiptAmountBox: {
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
        borderStyle: 'dashed',
    },
    receiptAmountLabel: {
        color: '#B45309',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    receiptAmount: {
        color: '#0F172A',
        fontSize: 22,
        fontWeight: '900',
        marginVertical: 2,
    },
    receiptStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    receiptStatusText: {
        color: '#065F46',
        fontSize: 8.5,
        fontWeight: '900',
    },
    receiptDetailsTable: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4.5,
        borderBottomWidth: 1,
        borderColor: '#F8FAFC',
    },
    receiptLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
    },
    receiptVal: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '800',
        maxWidth: '65%',
        textAlign: 'right',
    },
    receiptSecurityFooter: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: '#334155',
        borderStyle: 'dashed',
    },
    receiptBarcodeSim: {
        alignItems: 'center',
        gap: 2,
    },
    receiptBarcodeText: {
        color: '#F59E0B',
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 1.2,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    receiptDisclaimer: {
        color: '#94A3B8',
        fontSize: 7.5,
        textAlign: 'center',
        marginTop: 3,
    },
    receiptActionsBox: {
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    shareButtonsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    shareWhatsAppBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        height: 38,
        borderRadius: 10,
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 2,
    },
    shareWhatsAppBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    saveGalleryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#059669',
        height: 38,
        borderRadius: 10,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 2,
    },
    saveGalleryBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    shareImageBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0284C7',
        height: 38,
        borderRadius: 10,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    shareImageBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    sharePdfBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        height: 36,
        borderRadius: 10,
    },
    sharePdfBtnText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
    },
    closeReceiptBtn: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeReceiptBtnText: {
        color: '#F59E0B',
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});
