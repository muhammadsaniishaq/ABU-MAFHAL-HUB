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
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import SecurityModal from '../../components/SecurityModal';
import DynamicBanners from '../../components/DynamicBanners';

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

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const NARRATION_PRESETS = ['Support', 'Payment', 'Bill', 'Business', 'Family', 'Gift'];

// Safe Bank Logo Component with Verified Logos and Fallback Monogram
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
    date: string;
    newBalance: number;
    narration?: string;
}) => {
    const feeDisplay = tx.type === 'p2p' ? '₦0.00 (FREE)' : `₦${(tx.fee ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const totalDebitDisplay = `₦${(tx.totalDebit ?? tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const amountDisplay = `₦${tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const newBalDisplay = `₦${tx.newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const channelDisplay = tx.type === 'p2p' ? 'Abu Mafhal Wallet (P2P)' : 'Direct Bank Settlement (NIBSS Network)';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Transaction Receipt - ${tx.reference}</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #F8FAFC; color: #0F172A; padding: 24px; }
            .receipt-card { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 18px; border: 1.5px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
            .header-banner { background: #0F172A; padding: 22px 20px; text-align: center; border-bottom: 3px solid #D97706; }
            .brand-name { color: #F59E0B; font-size: 19px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
            .brand-sub { color: #94A3B8; font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; margin-top: 4px; text-transform: uppercase; }
            .amount-box { padding: 20px; text-align: center; background: #FFFBEB; border-bottom: 1px dashed #FDE68A; }
            .amount-label { color: #B45309; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
            .amount-val { color: #0F172A; font-size: 28px; font-weight: 900; margin: 5px 0; }
            .status-badge { display: inline-block; background: #D1FAE5; color: #065F46; padding: 4px 14px; border-radius: 20px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid #A7F3D0; }
            .details-list { padding: 16px 20px; }
            .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 11.5px; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { color: #64748B; font-weight: 600; }
            .detail-val { color: #0F172A; font-weight: 800; text-align: right; max-width: 60%; word-break: break-word; }
            .highlight-gold { color: #D97706; }
            .highlight-green { color: #059669; }
            .barcode-box { background: #0F172A; padding: 16px 20px; text-align: center; border-top: 1px dashed #334155; }
            .seal-text { color: #F59E0B; font-size: 9.5px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
            .disclaimer { color: #94A3B8; font-size: 8.5px; margin-top: 5px; line-height: 13px; }
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
                <div class="status-badge">&#10003; TRANSACTION SUCCESSFUL</div>
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
                    <span class="detail-label">Payment Channel</span>
                    <span class="detail-val">${channelDisplay}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction Reference</span>
                    <span class="detail-val" style="font-family: monospace; font-size: 10.5px;">${tx.reference}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date & Time</span>
                    <span class="detail-val">${tx.date}</span>
                </div>
                ${tx.narration ? `
                <div class="detail-row">
                    <span class="detail-label">Narration / Remark</span>
                    <span class="detail-val">${tx.narration}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">New Wallet Balance</span>
                    <span class="detail-val highlight-green">${newBalDisplay}</span>
                </div>
            </div>
            <div class="barcode-box">
                <div class="seal-text">&#128274; Authentic Electronic Receipt</div>
                <div class="disclaimer">This receipt confirms a successfully completed transaction processed via Abu Mafhal Hub Core Financial Network. For inquiries, email help@abumafhal.com</div>
            </div>
        </div>
    </body>
    </html>
    `;
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
    const [transferError, setTransferError] = useState<string | null>(null);
    const [copiedRef, setCopiedRef] = useState(false);

    // Success Receipt Modal
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<{
        reference: string;
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

    // Load recent beneficiaries from AsyncStorage
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
            list = list.slice(0, 8); // Store top 8
            await AsyncStorage.setItem('@recent_bank_beneficiaries', JSON.stringify(list));
            setRecentBeneficiaries(list);
        } catch (_) {}
    };

    // Form Validity
    const isFormValid = useMemo(() => {
        if (numAmount <= 0) return false;
        if (userBalance > 0 && totalDebit > userBalance) return false;
        if (activeTab === 'p2p') {
            return !!matchedUser;
        } else {
            return !!selectedBank && accountNumber.trim().length === 10 && !!accountName.trim();
        }
    }, [activeTab, matchedUser, selectedBank, accountNumber, accountName, numAmount, totalDebit, userBalance]);

    // Fetch User Balance
    const fetchUserBalance = async () => {
        setLoadingBalance(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', user.id)
                    .single();
                if (!error && data) {
                    setUserBalance(Number(data.balance) || 0);
                }
            }
        } catch (err) {
            console.warn('Balance fetch error:', err);
        } finally {
            setLoadingBalance(false);
        }
    };

    // Load Banks List
    useEffect(() => {
        fetchUserBalance();

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

    // Debounced Account Name Verification
    useEffect(() => {
        const cleanAcc = accountNumber.trim();
        if (cleanAcc.length !== 10 || !selectedBank) {
            setAccountName('');
            setResolveError(null);
            setIsResolvingAccount(false);
            return;
        }

        let isMounted = true;
        setIsResolvingAccount(true);
        setResolveError(null);
        setAccountName('');

        const timer = setTimeout(async () => {
            try {
                const { data, error } = await supabase.functions.invoke('payment-webhook', {
                    body: {
                        action: 'resolve_bank_account',
                        account_number: cleanAcc,
                        bank_code: selectedBank.code,
                        provider: settings?.transfer_provider || 'flutterwave',
                    },
                });

                if (!isMounted) return;

                if (error || !data?.success) {
                    const errorMsg = data?.message || "Could not verify this bank account. Please check the account number and selected bank.";
                    setResolveError(errorMsg);
                    setAccountName('');
                    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } else if (data?.account_name) {
                    setAccountName(data.account_name);
                    setResolveError(null);
                    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } catch (err: any) {
                if (isMounted) {
                    setResolveError('Connection error resolving bank account. Please check your network.');
                    setAccountName('');
                }
            } finally {
                if (isMounted) setIsResolvingAccount(false);
            }
        }, 400);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
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

    // Initiate Transfer (Opens confirmation)
    const handleInitiateTransfer = () => {
        if (!isFormValid) {
            if (activeTab === 'bank') {
                if (!selectedBank) Alert.alert('Bank Required', 'Please choose destination bank.');
                else if (accountNumber.trim().length !== 10) Alert.alert('Invalid Account', 'Enter 10-digit account number.');
                else if (!accountName) Alert.alert('Account Unverified', 'Please wait for account name verification.');
                else if (numAmount <= 0) Alert.alert('Amount Required', 'Please enter a valid transfer amount.');
                else if (totalDebit > userBalance) Alert.alert('Insufficient Balance', `You need ₦${totalDebit.toLocaleString()} (including ₦${transferFee} fee).`);
            } else {
                if (!matchedUser) Alert.alert('Recipient Required', 'Enter member phone, email, or username.');
                else if (numAmount <= 0) Alert.alert('Amount Required', 'Please enter a valid transfer amount.');
                else if (totalDebit > userBalance) Alert.alert('Insufficient Balance', `You have ₦${userBalance.toLocaleString()} available.`);
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

            if (activeTab === 'p2p') {
                const { data, error } = await supabase.rpc('execute_p2p_transfer', {
                    target_id: matchedUser!.id,
                    amount: currentAmount,
                    note: currentNarration || 'Wallet transfer via Abu Mafhal Hub',
                });

                if (error) throw new Error(error.message || 'P2P transfer failed.');
                if (data && data.success === false) throw new Error(data.message || 'P2P transfer failed.');

                const newBal = data?.new_balance ?? Math.max(0, userBalance - currentAmount);
                setUserBalance(newBal);

                setLastTxDetails({
                    reference: data?.reference || `TRF-P2P-${Date.now()}`,
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
                        action: 'disburse_bank_transfer',
                        bank_code: selectedBank!.code,
                        bank_name: selectedBank!.name,
                        account_number: accountNumber.trim(),
                        account_name: accountName.trim(),
                        amount: currentAmount,
                        fee: transferFee,
                        narration: currentNarration || `Transfer to ${accountName.trim()}`,
                        provider: settings?.transfer_provider || 'flutterwave',
                    },
                });

                if (error) throw new Error(error.message || 'Bank settlement request failed.');
                if (data && data.success === false) throw new Error(data.message || 'Bank settlement rejected.');

                const finalNewBal = data?.new_balance ?? Math.max(0, userBalance - currentTotalDebit);
                setUserBalance(finalNewBal);

                // Save to recent beneficiaries
                await saveRecentBeneficiary(accountNumber.trim(), accountName.trim(), selectedBank!.code, selectedBank!.name);

                setLastTxDetails({
                    reference: data?.reference || `WTH-${Date.now()}`,
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
            const errMsg = err.message || 'Unable to complete transfer. Please check your network or wallet balance.';
            setTransferError(errMsg);
            setIsSubmitting(false);

            setTimeout(() => {
                setErrorModalMessage(errMsg);
            }, 150);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Share Receipt as Image (PNG) directly to WhatsApp and other apps
    const handleShareImageReceipt = async () => {
        if (!lastTxDetails) return;
        setIsGeneratingReceipt(true);
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Share Receipt to WhatsApp / Social Media',
                        UTI: 'public.png',
                    });
                    setIsGeneratingReceipt(false);
                    return;
                }
            }
        } catch (captureErr) {
            console.warn('ViewShot receipt capture notice:', captureErr);
        }

        // Fallback: Generate PDF receipt
        try {
            await handleSharePdfReceipt();
        } catch (_) {
            setIsGeneratingReceipt(false);
        }
    };

    // Share Receipt as PDF Document directly to WhatsApp / Social Media
    const handleSharePdfReceipt = async () => {
        if (!lastTxDetails) return;
        setIsGeneratingPdf(true);
        try {
            const html = generateReceiptHtml({
                ...lastTxDetails,
                narration: lastTxDetails.narration || (lastTxDetails.type === 'p2p' ? 'Wallet Transfer' : 'Direct Bank Settlement'),
            });
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Share Official PDF Receipt',
                    UTI: 'com.adobe.pdf',
                });
            } else {
                Alert.alert('PDF Saved', `Receipt saved: ${uri}`);
            }
        } catch (pdfErr: any) {
            console.warn('PDF generation error:', pdfErr);
            Alert.alert('Notice', 'Could not compile PDF. Please use Share Image.');
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
                            <Ionicons name="shield-checkmark" size={11} color="#D97706" />
                            <Text style={s.headerSubtitle}>Direct Bank Settlement</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={fetchUserBalance}
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

                {/* Compact Navy & Gold Balance Card */}
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

            {/* Main Form Body */}
            <ScrollView
                style={s.scrollArea}
                contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom + 36, 48) }]}
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

                        {/* Modernized Auto-Resolution Feedback Card */}
                        {isResolvingAccount && (
                            <View style={s.resolvingStatusBox}>
                                <ActivityIndicator size="small" color="#D97706" />
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={s.resolvingStatusTitle}>Verifying Beneficiary Account...</Text>
                                    <Text style={s.resolvingStatusSub}>Validating account name with NIBSS network</Text>
                                </View>
                            </View>
                        )}

                        {resolveError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                                <View style={{ flex: 1, marginLeft: 6 }}>
                                    <Text style={s.errorAlertTitle}>Account Not Found</Text>
                                    <Text style={s.errorAlertText}>{resolveError}</Text>
                                </View>
                            </View>
                        )}

                        {accountName ? (
                            <View style={s.resolvedAccountCard}>
                                <View style={s.verifiedIconPill}>
                                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={s.resolvedLabel}>VERIFIED BENEFICIARY</Text>
                                        <View style={s.activeDot} />
                                    </View>
                                    <Text style={s.resolvedName} numberOfLines={1}>{accountName}</Text>
                                    <Text style={s.resolvedBankSub}>
                                        {selectedBank?.name} • Ready for transfer
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setAccountNumber('');
                                        setAccountName('');
                                    }}
                                    style={s.editAccountBtn}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="pencil-outline" size={14} color="#64748B" />
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

                        {/* Clean In-Form Submit Button */}
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
                                        {isFormValid ? `TRANSFER ₦${numAmount.toLocaleString()}` : 'ENTER TRANSFER DETAILS'}
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
                                <View style={s.verifiedIconPill}>
                                    <Ionicons name="person" size={15} color="#10B981" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={s.resolvedLabel}>VERIFIED MEMBER</Text>
                                        <View style={s.activeDot} />
                                    </View>
                                    <Text style={s.resolvedName} numberOfLines={1}>{matchedUser.full_name}</Text>
                                    <Text style={s.resolvedBankSub}>
                                        {matchedUser.phone || matchedUser.email}
                                    </Text>
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
                                        {isFormValid ? `SEND ₦${numAmount.toLocaleString()} TO MEMBER` : 'ENTER MEMBER DETAILS'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
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
                            Please review the transaction details carefully before entering your PIN
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
                        <View style={s.errorModalIconCircle}>
                            <Ionicons name="alert-circle" size={28} color="#DC2626" />
                        </View>
                        <Text style={s.errorModalTitle}>Transfer Notice</Text>
                        <Text style={s.errorModalMessage}>{errorModalMessage}</Text>
                        <TouchableOpacity
                            onPress={() => setErrorModalMessage(null)}
                            style={s.errorModalBtn}
                            activeOpacity={0.85}
                        >
                            <Text style={s.errorModalBtnText}>OK, UNDERSTOOD</Text>
                        </TouchableOpacity>
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
                        {/* Printable / Capturable Receipt Area */}
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={s.viewShotWrapper}>
                            <View style={s.receiptSheet}>
                                {/* Navy Header Banner with Gold Shield */}
                                <View style={s.receiptHeaderBanner}>
                                    <View style={s.receiptLogoCircle}>
                                        <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={s.receiptBrandTitle}>ABU MAFHAL HUB</Text>
                                        <Text style={s.receiptBrandSub}>OFFICIAL TRANSACTION RECEIPT</Text>
                                    </View>
                                    <View style={s.receiptSuccessMiniPill}>
                                        <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                                        <Text style={s.receiptSuccessMiniText}>SUCCESS</Text>
                                    </View>
                                </View>

                                {/* Amount Box */}
                                <View style={s.receiptAmountBox}>
                                    <Text style={s.receiptAmountLabel}>TRANSFER AMOUNT</Text>
                                    <Text style={s.receiptAmount}>
                                        ₦{lastTxDetails ? lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
                                    </Text>
                                    <View style={s.receiptStatusBadge}>
                                        <Ionicons name="checkmark-circle" size={11} color="#059669" />
                                        <Text style={s.receiptStatusText}>TRANSACTION COMPLETED</Text>
                                    </View>
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
                                        <Text style={s.receiptLabel}>Payment Method:</Text>
                                        <Text style={s.receiptVal}>
                                            {lastTxDetails?.type === 'p2p' ? 'Abu Mafhal Wallet (P2P)' : 'Direct Bank Settlement'}
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
                                        <Text style={s.receiptLabel}>New Balance:</Text>
                                        <Text style={[s.receiptVal, { color: '#059669', fontWeight: '900' }]}>
                                            ₦{lastTxDetails ? lastTxDetails.newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
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
                                        <Text style={s.receiptBarcodeText}>{lastTxDetails?.reference || 'ABU-MAFHAL-PAY'}</Text>
                                    </View>
                                    <Text style={s.receiptDisclaimer}>
                                        Authentic electronic transaction receipt generated by Abu Mafhal Hub.
                                    </Text>
                                </View>
                            </View>
                        </ViewShot>

                        {/* Modernized Sharing Action Buttons */}
                        <View style={s.receiptActionsBox}>
                            <View style={s.shareButtonsRow}>
                                <TouchableOpacity
                                    onPress={handleShareImageReceipt}
                                    style={s.shareImageBtn}
                                    activeOpacity={0.8}
                                    disabled={isGeneratingReceipt || isGeneratingPdf}
                                >
                                    {isGeneratingReceipt ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="image-outline" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                                            <Text style={s.shareImageBtnText}>Share Image 🖼️</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSharePdfReceipt}
                                    style={s.sharePdfBtn}
                                    activeOpacity={0.8}
                                    disabled={isGeneratingReceipt || isGeneratingPdf}
                                >
                                    {isGeneratingPdf ? (
                                        <ActivityIndicator size="small" color="#0F172A" />
                                    ) : (
                                        <>
                                            <Ionicons name="document-text-outline" size={15} color="#0F172A" style={{ marginRight: 5 }} />
                                            <Text style={s.sharePdfBtnText}>Share PDF 📄</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    setSuccessModalVisible(false);
                                    fetchUserBalance();
                                }}
                                style={s.closeReceiptBtn}
                                activeOpacity={0.8}
                            >
                                <Text style={s.closeReceiptBtnText}>DONE / NEW TRANSFER</Text>
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
        color: '#D97706',
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
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginTop: 5,
    },
    resolvingStatusTitle: {
        color: '#92400E',
        fontSize: 10.5,
        fontWeight: '800',
    },
    resolvingStatusSub: {
        color: '#B45309',
        fontSize: 9,
        fontWeight: '500',
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginTop: 5,
    },
    errorAlertTitle: {
        color: '#DC2626',
        fontSize: 10.5,
        fontWeight: '900',
    },
    errorAlertText: {
        color: '#B91C1C',
        fontSize: 9.5,
        fontWeight: '600',
    },
    resolvedAccountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 10,
        padding: 8,
        marginTop: 6,
    },
    verifiedIconPill: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    resolvedLabel: {
        color: '#059669',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    resolvedName: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '900',
        marginTop: 1,
    },
    resolvedBankSub: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 1,
    },
    editAccountBtn: {
        padding: 4,
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
    viewShotWrapper: {
        backgroundColor: '#FFFFFF',
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
    shareImageBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16A34A',
        height: 38,
        borderRadius: 10,
        shadowColor: '#16A34A',
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
        height: 38,
        borderRadius: 10,
    },
    sharePdfBtnText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
    },
    closeReceiptBtn: {
        width: '100%',
        height: 34,
        borderRadius: 8,
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
