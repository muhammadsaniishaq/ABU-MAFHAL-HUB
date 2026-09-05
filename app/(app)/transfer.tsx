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

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import { createAppNotification } from '../../services/notificationsHelper';
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

const POPULAR_BANK_CODES = ['999992', '999991', '50515', '50211', '058', '057', '044', '011', '033'];

const VERIFIED_BANK_LOGOS: Record<string, string> = {
    '999992': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/paycom.png',
    '999991': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/palmpay.png',
    '50515': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/moniepoint-mfb-ng.png',
    '50211': 'https://raw.githubusercontent.com/ichtrojan/nigerian-banks/master/logos/kuda-bank.png',
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
    { id: '171', code: '999992', name: 'OPay Digital Services Limited (OPay)', logo: VERIFIED_BANK_LOGOS['999992'], color: '#00B050' },
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

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

// Safe Bank Logo Component with Verified Logos and Fallback Monogram
function BankLogoBadge({ bank, size = 26 }: { bank: BankItem; size?: number }) {
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
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [bankSearchText, setBankSearchText] = useState('');

    // Bank Account & Auto-Resolution
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isResolvingAccount, setIsResolvingAccount] = useState(false);
    const [resolveError, setResolveError] = useState<string | null>(null);

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

    // Success Receipt Modal
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<{
        reference: string;
        amount: number;
        recipient: string;
        bankName?: string;
        accountNumber?: string;
        type: 'p2p' | 'bank';
        newBalance: number;
        date: string;
    } | null>(null);

    // ── INITIAL DATA LOADING ─────────────────────────────────────────
    useEffect(() => {
        fetchUserBalance();
        loadBanksFromCacheAndNetwork();
    }, []);

    const fetchUserBalance = async () => {
        setLoadingBalance(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            const { data } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', user.id)
                .maybeSingle();

            if (data && data.balance !== null && data.balance !== undefined) {
                setUserBalance(parseFloat(String(data.balance)) || 0);
            }
        } catch (err) {
            console.warn('Error fetching balance:', err);
        } finally {
            setLoadingBalance(false);
        }
    };

    const loadBanksFromCacheAndNetwork = async () => {
        try {
            const cached = await AsyncStorage.getItem('@cached_nigerian_banks_v3');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setBanksList(parsed);
                }
            }
        } catch (_) {}

        try {
            setLoadingBanks(true);
            const { data, error } = await supabase.functions.invoke('payment-webhook', {
                body: { action: 'get_banks' }
            });

            if (!error && data?.success && Array.isArray(data?.banks) && data.banks.length > 0) {
                const mappedBanks = data.banks.map((b: any) => ({
                    ...b,
                    logo: VERIFIED_BANK_LOGOS[b.code] || b.logo
                }));
                setBanksList(mappedBanks);
                await AsyncStorage.setItem('@cached_nigerian_banks_v3', JSON.stringify(mappedBanks));
            }
        } catch (e) {
            console.warn('Network bank fetch notice (using cache/defaults):', e);
        } finally {
            setLoadingBanks(false);
        }
    };

    // ── REAL-TIME PAYSTACK ACCOUNT NAME RESOLUTION ───────────────────
    useEffect(() => {
        const cleanAcc = accountNumber.trim().replace(/[^0-9]/g, '');

        if (!selectedBank || cleanAcc.length !== 10) {
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
                    }
                });

                if (!isMounted) return;

                if (error || !data?.success) {
                    const errorMsg = data?.message || "Could not find this bank account. Please verify the account number and selected bank.";
                    setResolveError(errorMsg);
                    setAccountName('');
                    if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                } else if (data?.account_name) {
                    setAccountName(data.account_name);
                    setResolveError(null);
                    if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    setResolveError('Error resolving bank account. Please check your network connection.');
                    setAccountName('');
                }
            } finally {
                if (isMounted) setIsResolvingAccount(false);
            }
        }, 450);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [accountNumber, selectedBank]);

    // ── DEBOUNCED SEARCH FOR P2P RECIPIENT ───────────────────────────
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

                if (error) {
                    setUserSearchError('User not found.');
                    setMatchedUser(null);
                    return;
                }

                if (!data) {
                    setUserSearchError('No user found with the provided details.');
                    setMatchedUser(null);
                } else if (data.id === currentUserId) {
                    setUserSearchError('You cannot transfer funds to your own account.');
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
                    if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }
            } catch (err: any) {
                setUserSearchError('Error searching for user account.');
            } finally {
                setIsSearchingUser(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [recipientQuery, currentUserId]);

    // ── VALIDATION & PROCEED TO CONFIRMATION ─────────────────────────
    const handleInitiateTransfer = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
            return;
        }

        if (numAmount > userBalance) {
            Alert.alert(
                'Insufficient Balance',
                `Your available wallet balance (₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}) is insufficient for this transfer of ₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`
            );
            return;
        }

        const minWithdrawal = parseFloat(settings?.min_withdrawal || '100');
        if (numAmount < minWithdrawal) {
            Alert.alert('Minimum Transfer', `The minimum transfer amount is ₦${minWithdrawal.toLocaleString()}`);
            return;
        }

        if (activeTab === 'p2p') {
            if (!matchedUser) {
                Alert.alert('Recipient Required', 'Please select a verified recipient before proceeding.');
                return;
            }
        } else {
            if (!selectedBank) {
                Alert.alert('Bank Required', 'Please select a destination bank.');
                return;
            }
            if (accountNumber.trim().length !== 10) {
                Alert.alert('Invalid Account Number', 'The bank account number must be exactly 10 digits.');
                return;
            }
            if (!accountName.trim()) {
                Alert.alert('Unverified Account', 'Please wait for Paystack to verify the account name before proceeding.');
                return;
            }
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setConfirmModalVisible(true);
    };

    // ── EXECUTE CONFIRMED TRANSFER (AFTER PIN) ───────────────────────
    const handleExecuteConfirmedTransfer = async () => {
        setSecurityModalVisible(false);
        setIsSubmitting(true);

        const numAmount = parseFloat(amount);
        const refCode = `TRF_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You are currently signed out. Please log in again.');

            // 1. Live Balance Verification
            const { data: profile } = await supabase
                .from('profiles')
                .select('balance, full_name')
                .eq('id', user.id)
                .single();

            const liveBal = profile && profile.balance !== null ? parseFloat(String(profile.balance)) : userBalance;
            if (liveBal < numAmount) {
                throw new Error(`Insufficient wallet balance. You have ₦${liveBal.toLocaleString('en-NG', { minimumFractionDigits: 2 })} available.`);
            }

            if (activeTab === 'p2p') {
                // Execute Member-to-Member Transfer
                const recipientId = matchedUser!.id;
                const recipientName = matchedUser!.full_name;

                const { data: rpcData, error: rpcError } = await supabase.rpc('execute_wallet_transfer', {
                    sender_id: user.id,
                    target_id: recipientId,
                    amount: numAmount,
                    note: note.trim() || 'Wallet Transfer',
                });

                if (rpcError) {
                    throw new Error(rpcError.message || 'Error processing wallet transfer.');
                }

                const finalNewBal = rpcData?.new_balance !== undefined
                    ? parseFloat(String(rpcData.new_balance))
                    : Math.max(0, liveBal - numAmount);

                const finalRef = rpcData?.reference || refCode;

                // Send In-App Notifications
                try {
                    await createAppNotification(
                        user.id,
                        'Transfer Successful!',
                        `Successfully sent ₦${numAmount.toLocaleString()} to ${recipientName}.`,
                        'transfer',
                        'normal',
                        { route: '/(app)/history' }
                    );

                    await createAppNotification(
                        recipientId,
                        'Funds Received!',
                        `You received a transfer of ₦${numAmount.toLocaleString()} from ${profile?.full_name || 'a member'}.`,
                        'deposit',
                        'normal',
                        { route: '/(app)/wallet' }
                    );
                } catch (notifErr) {
                    console.warn('Notification notice:', notifErr);
                }

                setUserBalance(finalNewBal);
                setLastTxDetails({
                    reference: finalRef,
                    amount: numAmount,
                    recipient: recipientName,
                    type: 'p2p',
                    newBalance: finalNewBal,
                    date: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                });
            } else {
                // Execute Bank Transfer via Paystack Live Settlement
                const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('payment-webhook', {
                    body: {
                        action: 'execute_bank_transfer',
                        userId: user.id,
                        amount: numAmount,
                        bankCode: selectedBank!.code,
                        bankName: selectedBank!.name,
                        accountNumber: accountNumber.trim(),
                        accountName: accountName.trim(),
                        narration: note.trim() || 'Abu Mafhal Hub Bank Settlement',
                    }
                });

                if (edgeErr || !edgeData?.success || !edgeData?.dispatched) {
                    const failMsg = edgeData?.message || edgeErr?.message || 'Unable to complete bank transfer. Your wallet was NOT charged.';
                    throw new Error(failMsg);
                }

                const finalNewBal = edgeData?.new_balance !== undefined
                    ? parseFloat(String(edgeData.new_balance))
                    : Math.max(0, liveBal - numAmount);

                const finalRef = edgeData?.reference || refCode;

                // Send In-App Notification
                try {
                    await createAppNotification(
                        user.id,
                        'Bank Transfer Dispatched',
                        `Successfully sent ₦${numAmount.toLocaleString()} to ${selectedBank!.name} (${accountNumber.trim()} - ${accountName.trim()}).`,
                        'transfer',
                        'normal',
                        { route: '/(app)/history' }
                    );
                } catch (notifErr) {
                    console.warn('Notification send notice:', notifErr);
                }

                setUserBalance(finalNewBal);
                setLastTxDetails({
                    reference: finalRef,
                    amount: numAmount,
                    recipient: accountName.trim(),
                    bankName: selectedBank!.name,
                    accountNumber: accountNumber.trim(),
                    type: 'bank',
                    newBalance: finalNewBal,
                    date: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                });
            }

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // Clear inputs and display receipt
            setAmount('');
            setNote('');
            setRecipientQuery('');
            setMatchedUser(null);
            setAccountNumber('');
            setAccountName('');
            setSuccessModalVisible(true);
        } catch (err: any) {
            console.error('Transfer execution error:', err);
            Alert.alert('Transfer Failed', err.message || 'Unable to complete transfer. Please check your network or wallet balance.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── HIGH RESOLUTION IMAGE RECEIPT GENERATION & SHARING ────────────
    const handleShareReceipt = async () => {
        if (!lastTxDetails) return;
        setIsGeneratingReceipt(true);
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Share Transfer Receipt',
                        UTI: 'public.png',
                    });
                    setIsGeneratingReceipt(false);
                    return;
                }
            }
        } catch (captureErr) {
            console.warn('ViewShot receipt capture notice:', captureErr);
        }

        // Universal text fallback
        try {
            const detailsMsg = lastTxDetails.type === 'p2p'
                ? `🧾 ABU MAFHAL HUB - WALLET TRANSFER RECEIPT\n\nAmount: ₦${lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nTo: ${lastTxDetails.recipient}\nMethod: Abu Mafhal Wallet (Free ₦0 Fee)\nReference: ${lastTxDetails.reference}\nDate: ${lastTxDetails.date}\n\nThank you for choosing Abu Mafhal Hub!`
                : `🧾 ABU MAFHAL HUB - BANK SETTLEMENT RECEIPT\n\nAmount: ₦${lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nRecipient: ${lastTxDetails.recipient}\nDestination Bank: ${lastTxDetails.bankName}\nAccount Number: ${lastTxDetails.accountNumber}\nReference: ${lastTxDetails.reference}\nDate: ${lastTxDetails.date}\n\nDispatched instantly via Paystack on Abu Mafhal Hub!`;

            await Share.share({
                title: 'Abu Mafhal Hub - Transfer Receipt',
                message: detailsMsg,
            });
        } catch (e) {
            console.warn('Share error:', e);
        } finally {
            setIsGeneratingReceipt(false);
        }
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
            <StatusBar style="light" />

            {/* Top Gold Accent Line */}
            <View style={s.goldTopLine} />

            {/* Compact Luxury Navy & Gold Header */}
            <LinearGradient
                colors={['#081225', '#0F1E36', '#172A4D']}
                style={[s.headerContainer, { paddingTop: Math.max(insets.top + 4, 30) }]}
            >
                <View style={s.headerNavRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.backBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={17} color="#F59E0B" />
                    </TouchableOpacity>

                    <View style={s.headerTitleCol}>
                        <Text style={s.headerTitle}>Transfer Funds</Text>
                        <View style={s.paystackPoweredRow}>
                            <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                            <Text style={s.headerSubtitle}>Paystack Instant Settlement</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={fetchUserBalance}
                        style={s.refreshBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="sync-outline"
                            size={16}
                            color="#F59E0B"
                            style={loadingBalance ? { transform: [{ rotate: '45deg' }] } : undefined}
                        />
                    </TouchableOpacity>
                </View>

                {/* Compact Navy & Gold Balance Card */}
                <View style={s.balanceCard}>
                    <View style={s.balanceLeft}>
                        <View style={s.walletIconCircle}>
                            <Ionicons name="wallet-outline" size={15} color="#F59E0B" />
                        </View>
                        <View>
                            <Text style={s.balanceLabel}>AVAILABLE WALLET BALANCE</Text>
                            <Text style={s.balanceAmount}>
                                {showBalance ? `₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '₦ ••••••••'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowBalance(!showBalance)}
                        style={s.eyeToggleBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                            size={16}
                            color="#FDE68A"
                        />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Compact Navy & Gold Tabs */}
            <View style={s.tabsContainer}>
                <TouchableOpacity
                    onPress={() => {
                        setActiveTab('bank');
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.tabButton, activeTab === 'bank' && s.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="business"
                        size={15}
                        color={activeTab === 'bank' ? '#F59E0B' : '#94A3B8'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'bank' && s.tabButtonTextActive]}>
                        To Bank Account
                    </Text>
                    <View style={[s.liveBadge, activeTab === 'bank' && s.liveBadgeActive]}>
                        <Text style={[s.liveBadgeText, activeTab === 'bank' && s.liveBadgeTextActive]}>Paystack</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        setActiveTab('p2p');
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.tabButton, activeTab === 'p2p' && s.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="people"
                        size={15}
                        color={activeTab === 'p2p' ? '#F59E0B' : '#94A3B8'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'p2p' && s.tabButtonTextActive]}>
                        To Mafhal Member
                    </Text>
                    <View style={[s.freeTag, activeTab === 'p2p' && s.freeTagActive]}>
                        <Text style={[s.freeTagText, activeTab === 'p2p' && s.freeTagTextActive]}>₦0 Fee</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Main Form Body */}
            <ScrollView
                style={s.scrollArea}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <DynamicBanners placement="transfer" />

                {activeTab === 'bank' ? (
                    // ── MODE 1: NIGERIAN BANK TRANSFER (PAYSTACK) ─────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={s.cardIconCircle}>
                                <Ionicons name="business" size={16} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Send Money to Bank Account</Text>
                                <Text style={s.cardSub}>
                                    Automated settlement to all Nigerian banks via Paystack
                                </Text>
                            </View>
                        </View>

                        {/* Step 1: Bank Selector Trigger */}
                        <Text style={s.fieldLabel}>1. Destination Bank</Text>
                        <TouchableOpacity
                            onPress={() => setBankModalVisible(true)}
                            style={[s.bankSelectTrigger, selectedBank && s.bankSelectTriggerFilled]}
                            activeOpacity={0.8}
                        >
                            {selectedBank ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                    <BankLogoBadge bank={selectedBank} size={26} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.selectedBankName} numberOfLines={1}>{selectedBank.name}</Text>
                                        <Text style={s.selectedBankCode}>Code: {selectedBank.code}</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                    <View style={s.emptyBankCircle}>
                                        <Ionicons name="business-outline" size={15} color="#F59E0B" />
                                    </View>
                                    <Text style={s.bankPlaceholder}>Tap to choose destination bank...</Text>
                                </View>
                            )}
                            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
                        </TouchableOpacity>

                        {/* Compact Popular Banks Row */}
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
                                            <BankLogoBadge bank={pb} size={18} />
                                            <Text style={s.popularBankText} numberOfLines={1}>
                                                {pb.name.split(' ')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Step 2: Account Number Input */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
                            <Text style={s.fieldLabel}>2. Bank Account Number (10 Digits)</Text>
                            <Text style={[s.counterText, accountNumber.length === 10 && s.counterTextSuccess]}>
                                {accountNumber.length}/10
                            </Text>
                        </View>
                        <View style={[s.inputBox, accountNumber.length === 10 && s.inputBoxActive]}>
                            <Ionicons name="card-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
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
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            ) : null}
                        </View>

                        {/* Paystack Auto-Resolution Feedback */}
                        {isResolvingAccount && (
                            <View style={s.resolvingStatusBox}>
                                <ActivityIndicator size="small" color="#0369A1" />
                                <Text style={s.resolvingStatusText}>
                                    Verifying account name with Paystack NUBAN...
                                </Text>
                            </View>
                        )}

                        {resolveError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.errorAlertTitle}>Account Not Found</Text>
                                    <Text style={s.errorAlertText}>{resolveError}</Text>
                                </View>
                            </View>
                        )}

                        {accountName ? (
                            <View style={s.resolvedAccountCard}>
                                <View style={s.verifiedIconPill}>
                                    <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.resolvedLabel}>VERIFIED ACCOUNT NAME (NUBAN):</Text>
                                    <Text style={s.resolvedName}>{accountName}</Text>
                                    <View style={s.resolvedBankRow}>
                                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                        <Text style={s.resolvedBankText}>
                                            {selectedBank?.name} • {accountNumber}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}

                        {/* Step 3: Amount */}
                        <Text style={[s.fieldLabel, { marginTop: 12 }]}>3. Amount (NGN)</Text>
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

                        {/* Compact Quick Chips */}
                        <View style={s.chipRow}>
                            {QUICK_AMOUNTS.map((amt) => (
                                <TouchableOpacity
                                    key={amt}
                                    onPress={() => {
                                        setAmount(String(amt));
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[
                                        s.chipBtn,
                                        amount === String(amt) && s.chipBtnActive,
                                    ]}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.chipText, amount === String(amt) && s.chipTextActive]}>
                                        ₦{amt.toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Step 4: Optional Narration */}
                        <Text style={[s.fieldLabel, { marginTop: 10 }]}>Payment Narration (Optional)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Support or Business"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Compact Summary Box */}
                        <View style={s.summaryBox}>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Bank:</Text>
                                <Text style={s.summaryVal} numberOfLines={1}>{selectedBank ? selectedBank.name : '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Account:</Text>
                                <Text style={s.summaryVal}>{accountNumber || '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Recipient:</Text>
                                <Text style={[s.summaryVal, accountName ? { color: '#F59E0B', fontWeight: '800' } : undefined]} numberOfLines={1}>
                                    {accountName || '— (Awaiting verification)'}
                                </Text>
                            </View>
                            <View style={s.summaryDivider} />
                            <View style={s.summaryRow}>
                                <Text style={s.summaryTotalLabel}>Total Debit Amount:</Text>
                                <Text style={s.summaryTotalVal}>
                                    ₦{amount && !isNaN(parseFloat(amount)) ? parseFloat(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
                                </Text>
                            </View>
                        </View>

                        {/* Compact Submit Button */}
                        <TouchableOpacity
                            onPress={handleInitiateTransfer}
                            style={[
                                s.submitBtn,
                                (!selectedBank || accountNumber.length !== 10 || !accountName || !amount || parseFloat(amount) <= 0) && s.submitBtnDisabled,
                            ]}
                            disabled={!selectedBank || accountNumber.length !== 10 || !accountName || !amount || parseFloat(amount) <= 0 || isSubmitting}
                            activeOpacity={0.85}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#0F172A" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="arrow-up-circle" size={17} color="#0F172A" style={{ marginRight: 6 }} />
                                    <Text style={s.submitBtnText}>PROCEED TO TRANSFER</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    // ── MODE 2: P2P TRANSFER (WALLET TO WALLET) ───────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={s.cardIconCircle}>
                                <Ionicons name="people" size={16} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Send Money to Mafhal Member</Text>
                                <Text style={s.cardSub}>
                                    Instant zero-fee transfer to any platform member
                                </Text>
                            </View>
                        </View>

                        {/* Recipient Input */}
                        <Text style={s.fieldLabel}>Recipient Phone, Email, or Username</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. 08145853539 or member@abumafhal.com"
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

                        {/* Search Error State */}
                        {userSearchError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={15} color="#DC2626" />
                                <Text style={s.errorAlertText}>{userSearchError}</Text>
                            </View>
                        )}

                        {/* Matched Recipient Card */}
                        {matchedUser && (
                            <View style={s.recipientBadgeCard}>
                                <View style={s.recipientAvatar}>
                                    <Text style={s.recipientAvatarText}>
                                        {matchedUser.full_name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={s.recipientName}>{matchedUser.full_name}</Text>
                                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                    </View>
                                    <Text style={s.recipientMeta}>
                                        {matchedUser.phone ? `📱 ${matchedUser.phone}` : ''} {matchedUser.email ? `• 📧 ${matchedUser.email}` : ''}
                                    </Text>
                                    <Text style={s.verifiedTag}>● Verified Platform Member</Text>
                                </View>
                            </View>
                        )}

                        {/* Amount Input */}
                        <Text style={[s.fieldLabel, { marginTop: 12 }]}>Amount (NGN)</Text>
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
                                    style={[
                                        s.chipBtn,
                                        amount === String(amt) && s.chipBtnActive,
                                    ]}
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
                            <Ionicons name="chatbox-ellipses-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Support or Data Payment"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Fee Summary */}
                        <View style={s.summaryBox}>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Transfer Fee:</Text>
                                <Text style={s.summaryValFree}>₦0.00 (FREE)</Text>
                            </View>
                            <View style={s.summaryDivider} />
                            <View style={s.summaryRow}>
                                <Text style={s.summaryTotalLabel}>Total Debit Amount:</Text>
                                <Text style={s.summaryTotalVal}>
                                    ₦{amount && !isNaN(parseFloat(amount)) ? parseFloat(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
                                </Text>
                            </View>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={handleInitiateTransfer}
                            style={[
                                s.submitBtn,
                                (!matchedUser || !amount || parseFloat(amount) <= 0) && s.submitBtnDisabled,
                            ]}
                            disabled={!matchedUser || !amount || parseFloat(amount) <= 0 || isSubmitting}
                            activeOpacity={0.85}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#0F172A" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={17} color="#0F172A" style={{ marginRight: 6 }} />
                                    <Text style={s.submitBtnText}>SEND TO MEMBER NOW</Text>
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
                        {/* Modal Header */}
                        <View style={s.modalHeaderRow}>
                            <View>
                                <Text style={s.modalTitle}>Select Destination Bank</Text>
                                <Text style={s.modalSubtitle}>{banksList.length} Nigerian Banks Connected</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setBankModalVisible(false)}
                                style={s.modalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>

                        {/* Live Search Input */}
                        <View style={s.bankSearchBox}>
                            <Ionicons name="search" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
                            <TextInput
                                style={s.bankSearchInput}
                                placeholder="Search bank name or code (e.g. OPay, GTBank)..."
                                placeholderTextColor="#94A3B8"
                                value={bankSearchText}
                                onChangeText={setBankSearchText}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {bankSearchText ? (
                                <TouchableOpacity onPress={() => setBankSearchText('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Banks FlatList */}
                        <FlatList
                            data={filteredBanks}
                            keyExtractor={(item) => item.code + '_' + item.id}
                            style={{ maxHeight: 380 }}
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
                                        style={[
                                            s.bankRowItem,
                                            isSelected && s.bankRowItemActive,
                                        ]}
                                        activeOpacity={0.7}
                                    >
                                        <BankLogoBadge bank={item} size={28} />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[s.bankItemName, isSelected && s.bankItemNameActive]} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            <Text style={s.bankItemCode}>Code: {item.code}</Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color="#F59E0B" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <View style={s.emptyBankState}>
                                    <Ionicons name="search-outline" size={28} color="#94A3B8" />
                                    <Text style={s.emptyBankTitle}>No Bank Found</Text>
                                    <Text style={s.emptyBankSub}>Please check the spelling or search by bank code.</Text>
                                </View>
                            )}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── COMPACT TRANSFER CONFIRMATION MODAL ─────────── */}
            <Modal
                visible={confirmModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.confirmCard}>
                        <View style={s.confirmIconCircle}>
                            <Ionicons name="shield-checkmark" size={24} color="#F59E0B" />
                        </View>
                        <Text style={s.confirmTitle}>Confirm Transfer</Text>
                        <Text style={s.confirmSub}>
                            Please review the transaction details carefully before entering your PIN
                        </Text>

                        <View style={s.confirmDetailsBox}>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Transfer Amount:</Text>
                                <Text style={s.confirmValueGold}>₦{parseFloat(amount || '0').toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                            </View>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Recipient Name:</Text>
                                <Text style={s.confirmValue} numberOfLines={1}>
                                    {activeTab === 'p2p' ? matchedUser?.full_name : accountName}
                                </Text>
                            </View>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Destination:</Text>
                                <Text style={s.confirmValue} numberOfLines={1}>
                                    {activeTab === 'p2p' ? 'Abu Mafhal Wallet' : selectedBank?.name}
                                </Text>
                            </View>
                            {activeTab === 'bank' && (
                                <View style={s.confirmRow}>
                                    <Text style={s.confirmLabel}>Account Number:</Text>
                                    <Text style={s.confirmValue}>{accountNumber}</Text>
                                </View>
                            )}
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Transfer Fee:</Text>
                                <Text style={s.confirmValueFree}>₦0.00 (FREE)</Text>
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
                                    setSecurityModalVisible(true);
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

            {/* ── SECURITY TRANSACTION PIN MODAL ─────────────── */}
            <SecurityModal
                visible={securityModalVisible}
                onClose={() => setSecurityModalVisible(false)}
                onSuccess={handleExecuteConfirmedTransfer}
                title="Security PIN"
                description={`Enter your 4-digit transaction PIN to authorize transfer of ₦${parseFloat(amount || '0').toLocaleString()}`}
            />

            {/* ── HIGH DEFINITION RECEIPT CAPTURE MODAL ───────── */}
            <Modal
                visible={successModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.successCard}>
                        {/* Printable / Capturable Receipt Area */}
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.98 }} style={s.viewShotWrapper}>
                            <View style={s.receiptSheet}>
                                {/* Header Brand */}
                                <View style={s.receiptHeaderRow}>
                                    <View style={s.receiptLogoCircle}>
                                        <Ionicons name="receipt" size={16} color="#F59E0B" />
                                    </View>
                                    <View>
                                        <Text style={s.receiptBrandTitle}>ABU MAFHAL HUB</Text>
                                        <Text style={s.receiptBrandSub}>OFFICIAL TRANSACTION RECEIPT</Text>
                                    </View>
                                </View>

                                <View style={s.receiptDivider} />

                                {/* Amount Display */}
                                <Text style={s.receiptAmountLabel}>TRANSFER AMOUNT</Text>
                                <Text style={s.receiptAmount}>
                                    ₦{lastTxDetails ? lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
                                </Text>

                                {/* Receipt Details */}
                                <View style={s.receiptDetailsTable}>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Status:</Text>
                                        <View style={s.receiptStatusBadge}>
                                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                            <Text style={s.receiptStatusText}>SUCCESSFUL</Text>
                                        </View>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Recipient:</Text>
                                        <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails?.recipient}</Text>
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
                                            <Text style={s.receiptVal}>{lastTxDetails.accountNumber}</Text>
                                        </View>
                                    )}
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Channel:</Text>
                                        <Text style={s.receiptVal}>{lastTxDetails?.type === 'p2p' ? 'Abu Mafhal Wallet' : 'Paystack Settlement'}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Reference:</Text>
                                        <Text style={[s.receiptVal, { color: '#D97706', fontSize: 10 }]}>{lastTxDetails?.reference}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Date & Time:</Text>
                                        <Text style={s.receiptVal}>{lastTxDetails?.date}</Text>
                                    </View>
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>New Wallet Bal:</Text>
                                        <Text style={[s.receiptVal, { color: '#059669', fontWeight: '900' }]}>
                                            ₦{lastTxDetails ? lastTxDetails.newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </ViewShot>

                        {/* Action Buttons */}
                        <View style={s.successBtnRow}>
                            <TouchableOpacity
                                onPress={handleShareReceipt}
                                style={s.shareReceiptBtn}
                                activeOpacity={0.8}
                                disabled={isGeneratingReceipt}
                            >
                                {isGeneratingReceipt ? (
                                    <ActivityIndicator size="small" color="#F59E0B" />
                                ) : (
                                    <>
                                        <Ionicons name="download-outline" size={15} color="#0F172A" style={{ marginRight: 5 }} />
                                        <Text style={s.shareReceiptText}>Share Receipt</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setSuccessModalVisible(false);
                                    router.replace('/(app)/wallet');
                                }}
                                style={s.doneBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.doneBtnText}>Back to Wallet</Text>
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
        backgroundColor: '#07101E',
    },
    goldTopLine: {
        height: 2,
        backgroundColor: '#F59E0B',
    },
    headerContainer: {
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
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
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleCol: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
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
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(15, 30, 54, 0.85)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
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
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: {
        color: '#94A3B8',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
    },
    eyeToggleBtn: {
        padding: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        marginTop: 10,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F1E36',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 5,
    },
    tabButtonActive: {
        backgroundColor: '#1E293B',
        borderColor: '#F59E0B',
        borderWidth: 1.2,
    },
    tabButtonText: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '700',
    },
    tabButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    liveBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 0.8,
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    liveBadgeActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
    },
    liveBadgeText: {
        color: '#60A5FA',
        fontSize: 8,
        fontWeight: '900',
    },
    liveBadgeTextActive: {
        color: '#0F172A',
    },
    freeTag: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        borderWidth: 0.8,
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    freeTagActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
    },
    freeTagText: {
        color: '#34D399',
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
        paddingBottom: 28,
    },
    card: {
        backgroundColor: '#0D1B2E',
        borderRadius: 16,
        padding: 13,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    cardIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
    },
    cardSub: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '500',
        marginTop: 1,
    },
    fieldLabel: {
        color: '#FDE68A',
        fontSize: 10.5,
        fontWeight: '800',
        marginBottom: 4,
    },
    counterText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
    },
    counterTextSuccess: {
        color: '#10B981',
        fontWeight: '900',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#091322',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
    },
    inputBoxActive: {
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
    },
    textInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '600',
    },
    bankSelectTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#091322',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
    },
    bankSelectTriggerFilled: {
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
    },
    emptyBankCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankPlaceholder: {
        color: '#94A3B8',
        fontSize: 11.5,
        fontWeight: '600',
    },
    selectedBankName: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    selectedBankCode: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '600',
    },
    popularBanksContainer: {
        marginTop: 8,
    },
    popularBanksLabel: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '700',
        marginBottom: 4,
    },
    popularBanksRow: {
        flexDirection: 'row',
        gap: 6,
        paddingBottom: 2,
    },
    popularBankChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#091322',
        borderWidth: 0.8,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderRadius: 16,
        paddingHorizontal: 7,
        paddingVertical: 3.5,
        gap: 4,
    },
    popularBankText: {
        color: '#FDE68A',
        fontSize: 9.5,
        fontWeight: '700',
        maxWidth: 75,
    },
    resolvingStatusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(3, 105, 161, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(3, 105, 161, 0.35)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginTop: 6,
    },
    resolvingStatusText: {
        color: '#38BDF8',
        fontSize: 10.5,
        fontWeight: '700',
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(220, 38, 38, 0.15)',
        borderColor: 'rgba(220, 38, 38, 0.35)',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginTop: 6,
    },
    errorAlertTitle: {
        color: '#FCA5A5',
        fontSize: 11,
        fontWeight: '900',
    },
    errorAlertText: {
        color: '#FECACA',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    resolvedAccountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        borderRadius: 10,
        padding: 9,
        marginTop: 7,
    },
    verifiedIconPill: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        borderColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resolvedLabel: {
        color: '#34D399',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    resolvedName: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
        marginTop: 1,
    },
    resolvedBankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    resolvedBankText: {
        color: '#FDE68A',
        fontSize: 10,
        fontWeight: '700',
    },
    amountInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#091322',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 42,
    },
    currencyPrefix: {
        color: '#F59E0B',
        fontSize: 16,
        fontWeight: '900',
        marginRight: 4,
    },
    amountInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        marginTop: 7,
    },
    chipBtn: {
        backgroundColor: '#091322',
        borderWidth: 0.8,
        borderColor: '#1E293B',
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 8,
    },
    chipBtnActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    chipText: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '800',
    },
    chipTextActive: {
        color: '#F59E0B',
    },
    summaryBox: {
        backgroundColor: '#091322',
        borderRadius: 10,
        padding: 9,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 2,
    },
    summaryLabel: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
    },
    summaryVal: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
        maxWidth: 180,
        textAlign: 'right',
    },
    summaryValFree: {
        color: '#10B981',
        fontSize: 10.5,
        fontWeight: '900',
    },
    summaryDivider: {
        height: 0.8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 5,
    },
    summaryTotalLabel: {
        color: '#FDE68A',
        fontSize: 11,
        fontWeight: '900',
    },
    summaryTotalVal: {
        color: '#F59E0B',
        fontSize: 13,
        fontWeight: '900',
    },
    submitBtn: {
        backgroundColor: '#F59E0B',
        borderRadius: 10,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    submitBtnDisabled: {
        backgroundColor: '#334155',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitBtnText: {
        color: '#0A192F',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.4,
    },

    // P2P Styles
    recipientBadgeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        borderRadius: 10,
        padding: 9,
        marginTop: 7,
    },
    recipientAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipientAvatarText: {
        color: '#0A192F',
        fontSize: 14,
        fontWeight: '900',
    },
    recipientName: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    recipientMeta: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 1,
    },
    verifiedTag: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '800',
        marginTop: 1,
    },

    // Compact Modal Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
    },
    bankModalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#0D1B2E',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    modalSubtitle: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#091322',
        borderRadius: 10,
        paddingHorizontal: 8,
        height: 36,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    bankSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '600',
    },
    bankRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
    },
    bankRowItemActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    bankItemName: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '700',
    },
    bankItemNameActive: {
        color: '#F59E0B',
        fontWeight: '900',
    },
    bankItemCode: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '600',
    },
    emptyBankState: {
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBankTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 6,
    },
    emptyBankSub: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
    },

    // Confirm Card
    confirmCard: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#0D1B2E',
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    confirmIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1.2,
        borderColor: 'rgba(245, 158, 11, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    confirmTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 3,
        textAlign: 'center',
    },
    confirmSub: {
        color: '#94A3B8',
        fontSize: 10,
        textAlign: 'center',
        marginBottom: 12,
    },
    confirmDetailsBox: {
        width: '100%',
        backgroundColor: '#091322',
        borderRadius: 12,
        padding: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 3,
    },
    confirmLabel: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
    },
    confirmValue: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
        maxWidth: 160,
        textAlign: 'right',
    },
    confirmValueGold: {
        color: '#F59E0B',
        fontSize: 13.5,
        fontWeight: '900',
    },
    confirmValueFree: {
        color: '#10B981',
        fontSize: 10.5,
        fontWeight: '900',
    },
    confirmActionRow: {
        flexDirection: 'row',
        gap: 8,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '800',
    },
    proceedBtn: {
        flex: 1.4,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedBtnText: {
        color: '#0A192F',
        fontSize: 11,
        fontWeight: '900',
    },

    // Success & Receipt Card
    successCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#0D1B2E',
        borderRadius: 18,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    viewShotWrapper: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
    },
    receiptSheet: {
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
    },
    receiptHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    receiptLogoCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptBrandTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    receiptBrandSub: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '700',
    },
    receiptDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 10,
    },
    receiptAmountLabel: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '800',
        textAlign: 'center',
    },
    receiptAmount: {
        color: '#059669',
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 2,
        marginBottom: 10,
    },
    receiptDetailsTable: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 3,
    },
    receiptLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
    },
    receiptVal: {
        color: '#0F172A',
        fontSize: 10.5,
        fontWeight: '700',
        maxWidth: 160,
        textAlign: 'right',
    },
    receiptStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#DCFCE7',
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
    },
    receiptStatusText: {
        color: '#047857',
        fontSize: 8.5,
        fontWeight: '900',
    },
    successBtnRow: {
        flexDirection: 'row',
        gap: 8,
        width: '100%',
        marginTop: 12,
    },
    shareReceiptBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareReceiptText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '800',
    },
    doneBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        color: '#0A192F',
        fontSize: 11,
        fontWeight: '900',
    },
});
