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

const DEFAULT_BANKS: BankItem[] = [
    { id: '171', code: '999992', name: 'OPay Digital Services Limited (OPay)', slug: 'paycom', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/paycom.png', color: '#00B050' },
    { id: '169', code: '999991', name: 'PalmPay', slug: 'palmpay', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/palmpay.png', color: '#662D91' },
    { id: '688', code: '50515', name: 'Moniepoint MFB', slug: 'moniepoint-mfb-ng', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/moniepoint-mfb-ng.png', color: '#0056D2' },
    { id: '168', code: '50211', name: 'Kuda Bank', slug: 'kuda-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/kuda-bank.png', color: '#40196D' },
    { id: '9', code: '058', name: 'Guaranty Trust Bank (GTBank)', slug: 'guaranty-trust-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/guaranty-trust-bank.png', color: '#E03C31' },
    { id: '21', code: '057', name: 'Zenith Bank', slug: 'zenith-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/zenith-bank.png', color: '#D42E12' },
    { id: '1', code: '044', name: 'Access Bank', slug: 'access-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/access-bank.png', color: '#0033A1' },
    { id: '7', code: '011', name: 'First Bank of Nigeria', slug: 'first-bank-of-nigeria', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/first-bank-of-nigeria.png', color: '#003B70' },
    { id: '20', code: '033', name: 'United Bank for Africa (UBA)', slug: 'united-bank-for-africa', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/united-bank-for-africa.png', color: '#C8102E' },
    { id: '17', code: '232', name: 'Sterling Bank', slug: 'sterling-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/sterling-bank.png', color: '#E31B23' },
    { id: '19', code: '035', name: 'Wema Bank (ALAT)', slug: 'wema-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/wema-bank.png', color: '#781848' },
    { id: '6', code: '070', name: 'Fidelity Bank', slug: 'fidelity-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/fidelity-bank.png', color: '#1B365D' },
    { id: '8', code: '214', name: 'First City Monument Bank (FCMB)', slug: 'first-city-monument-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/first-city-monument-bank.png', color: '#5B2C82' },
    { id: '18', code: '032', name: 'Union Bank of Nigeria', slug: 'union-bank-of-nigeria', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/union-bank-of-nigeria.png', color: '#009FE3' },
    { id: '16', code: '221', name: 'Stanbic IBTC Bank', slug: 'stanbic-ibtc-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/stanbic-ibtc-bank.png', color: '#0033A0' },
    { id: '14', code: '076', name: 'Polaris Bank', slug: 'polaris-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/polaris-bank.png', color: '#5C2D91' },
    { id: '10', code: '301', name: 'Jaiz Bank', slug: 'jaiz-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/jaiz-bank.png', color: '#008751' },
    { id: '166', code: '302', name: 'TAJ Bank', slug: 'taj-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/taj-bank.png', color: '#C41230' },
    { id: '5', code: '050', name: 'Ecobank Nigeria', slug: 'ecobank-nigeria', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/ecobank-nigeria.png', color: '#005C8A' },
    { id: '11', code: '082', name: 'Keystone Bank', slug: 'keystone-bank', logo: 'https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/keystone-bank.png', color: '#002B49' },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

// Safe Bank Logo Component with automatic image fallback
function BankLogoBadge({ bank, size = 34 }: { bank: BankItem; size?: number }) {
    const [imgFailed, setImgFailed] = useState(false);
    const logoUri = bank.logo || (bank.slug ? `https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/${bank.slug}.png` : undefined);

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
                    borderColor: '#E2E8F0',
                }}
            >
                <Text style={{ color: '#FFFFFF', fontSize: size * 0.42, fontWeight: '900' }}>{initial}</Text>
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
                borderWidth: 1.2,
                borderColor: '#E2E8F0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
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
        // Instant render from cache
        try {
            const cached = await AsyncStorage.getItem('@cached_nigerian_banks_v2');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setBanksList(parsed);
                }
            }
        } catch (_) {}

        // Fetch live bank list from Paystack
        try {
            setLoadingBanks(true);
            const { data, error } = await supabase.functions.invoke('payment-webhook', {
                body: { action: 'get_banks' }
            });

            if (!error && data?.success && Array.isArray(data?.banks) && data.banks.length > 0) {
                setBanksList(data.banks);
                await AsyncStorage.setItem('@cached_nigerian_banks_v2', JSON.stringify(data.banks));
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
        }, 500);

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
        }, 450);

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
                    date: new Date().toLocaleString(),
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

                if (edgeErr || !edgeData?.success) {
                    throw new Error(edgeData?.message || edgeErr?.message || 'Unable to complete bank transfer.');
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
                    date: new Date().toLocaleString(),
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

    const handleShareReceipt = async () => {
        if (!lastTxDetails) return;
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
            <StatusBar style="dark" />

            {/* Top Accent Line */}
            <View style={s.goldTopLine} />

            {/* Clean Modern Light Header */}
            <View style={[s.headerContainer, { paddingTop: Math.max(insets.top + 8, 38) }]}>
                <View style={s.headerNavRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.backBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color="#0F172A" />
                    </TouchableOpacity>

                    <View style={s.headerTitleCol}>
                        <Text style={s.headerTitle}>Transfer Funds</Text>
                        <View style={s.paystackPoweredRow}>
                            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
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
                            size={18}
                            color="#0F172A"
                            style={loadingBalance ? { transform: [{ rotate: '45deg' }] } : undefined}
                        />
                    </TouchableOpacity>
                </View>

                {/* Light Available Balance Card */}
                <View style={s.balanceCard}>
                    <View style={s.balanceLeft}>
                        <View style={s.walletIconCircle}>
                            <Ionicons name="wallet-outline" size={18} color="#0F172A" />
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
                            size={18}
                            color="#64748B"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modern Light Tabs */}
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
                        size={17}
                        color={activeTab === 'bank' ? '#0F172A' : '#64748B'}
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
                        size={17}
                        color={activeTab === 'p2p' ? '#0F172A' : '#64748B'}
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
                {/* Dynamic Banners */}
                <DynamicBanners placement="transfer" />

                {activeTab === 'bank' ? (
                    // ── MODE 1: NIGERIAN BANK TRANSFER (PAYSTACK) ─────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={[s.cardIconCircle, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                <Ionicons name="business" size={18} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Send Money to Bank Account</Text>
                                <Text style={s.cardSub}>
                                    Instant automated settlement to all Nigerian banks via Paystack
                                </Text>
                            </View>
                        </View>

                        {/* Step 1: Bank Selector Trigger */}
                        <Text style={s.fieldLabel}>1. Select Destination Bank</Text>
                        <TouchableOpacity
                            onPress={() => setBankModalVisible(true)}
                            style={[s.bankSelectTrigger, selectedBank && s.bankSelectTriggerFilled]}
                            activeOpacity={0.8}
                        >
                            {selectedBank ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                    <BankLogoBadge bank={selectedBank} size={36} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.selectedBankName} numberOfLines={1}>{selectedBank.name}</Text>
                                        <Text style={s.selectedBankCode}>NUBAN Code: {selectedBank.code}</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                    <View style={s.emptyBankCircle}>
                                        <Ionicons name="business-outline" size={17} color="#94A3B8" />
                                    </View>
                                    <Text style={s.bankPlaceholder}>Tap to choose destination bank...</Text>
                                </View>
                            )}
                            <View style={s.bankChevron}>
                                <Ionicons name="chevron-forward" size={18} color="#64748B" />
                            </View>
                        </TouchableOpacity>

                        {/* Popular Banks Fast Shortcuts */}
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
                                            <BankLogoBadge bank={pb} size={22} />
                                            <Text style={s.popularBankText} numberOfLines={1}>
                                                {pb.name.split(' ')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Step 2: Account Number Input */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
                            <Text style={s.fieldLabel}>2. Bank Account Number (10 Digits)</Text>
                            <Text style={[s.counterText, accountNumber.length === 10 && s.counterTextSuccess]}>
                                {accountNumber.length}/10
                            </Text>
                        </View>
                        <View style={[s.inputBox, accountNumber.length === 10 && s.inputBoxActive]}>
                            <Ionicons name="card-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
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
                                <ActivityIndicator size="small" color="#059669" style={{ marginLeft: 6 }} />
                            )}
                            {!isResolvingAccount && accountName ? (
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            ) : null}
                        </View>

                        {/* Paystack Auto-Resolution Feedback */}
                        {isResolvingAccount && (
                            <View style={s.resolvingStatusBox}>
                                <ActivityIndicator size="small" color="#0284C7" />
                                <Text style={s.resolvingStatusText}>
                                    Verifying account name with Paystack NUBAN...
                                </Text>
                            </View>
                        )}

                        {resolveError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.errorAlertTitle}>Account Not Found</Text>
                                    <Text style={s.errorAlertText}>{resolveError}</Text>
                                </View>
                            </View>
                        )}

                        {accountName ? (
                            <View style={s.resolvedAccountCard}>
                                <View style={s.verifiedIconPill}>
                                    <Ionicons name="shield-checkmark" size={18} color="#059669" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.resolvedLabel}>VERIFIED ACCOUNT NAME (NUBAN):</Text>
                                    <Text style={s.resolvedName}>{accountName}</Text>
                                    <View style={s.resolvedBankRow}>
                                        <Ionicons name="checkmark-circle" size={13} color="#059669" />
                                        <Text style={s.resolvedBankText}>
                                            {selectedBank?.name} • {accountNumber}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}

                        {/* Step 3: Amount */}
                        <Text style={[s.fieldLabel, { marginTop: 16 }]}>3. Amount (NGN)</Text>
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

                        {/* Step 4: Optional Narration */}
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Payment Narration (Optional)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Project fee or Support"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Summary Box */}
                        <View style={s.summaryBox}>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Destination Bank:</Text>
                                <Text style={s.summaryVal} numberOfLines={1}>{selectedBank ? selectedBank.name : '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Account Number:</Text>
                                <Text style={s.summaryVal}>{accountNumber || '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Account Name:</Text>
                                <Text style={[s.summaryVal, accountName ? { color: '#059669', fontWeight: '900' } : undefined]}>
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

                        {/* Submit Button */}
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
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="arrow-up-circle" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>PROCEED TO TRANSFER</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    // ── MODE 2: P2P TRANSFER (WALLET TO WALLET) ───────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={[s.cardIconCircle, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                                <Ionicons name="people" size={18} color="#D97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Send Money to Mafhal Member</Text>
                                <Text style={s.cardSub}>
                                    Instant zero-fee transfer to any member on Abu Mafhal Hub
                                </Text>
                            </View>
                        </View>

                        {/* Recipient Input */}
                        <Text style={s.fieldLabel}>Recipient Phone, Email, or Username</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
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
                                <ActivityIndicator size="small" color="#D97706" style={{ marginLeft: 6 }} />
                            )}
                        </View>

                        {/* Search Error State */}
                        {userSearchError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" />
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
                                        <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                                    </View>
                                    <Text style={s.recipientMeta}>
                                        {matchedUser.phone ? `📱 ${matchedUser.phone}` : ''} {matchedUser.email ? `• 📧 ${matchedUser.email}` : ''}
                                    </Text>
                                    <Text style={s.verifiedTag}>● Verified Platform Member</Text>
                                </View>
                            </View>
                        )}

                        {/* Amount Input */}
                        <Text style={[s.fieldLabel, { marginTop: 16 }]}>Amount (NGN)</Text>
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

                        {/* Quick Amount Chips */}
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
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Payment Note (Optional)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Data payment or Project fee"
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
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>SEND TO MEMBER NOW</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* ── BANK SELECTION MODAL (LIGHT THEME) ─────────── */}
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
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Live Search Input */}
                        <View style={s.bankSearchBox}>
                            <Ionicons name="search" size={17} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.bankSearchInput}
                                placeholder="Search by bank name or code (e.g. OPay, GTBank)..."
                                placeholderTextColor="#94A3B8"
                                value={bankSearchText}
                                onChangeText={setBankSearchText}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {bankSearchText ? (
                                <TouchableOpacity onPress={() => setBankSearchText('')}>
                                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Banks FlatList */}
                        <FlatList
                            data={filteredBanks}
                            keyExtractor={(item) => item.code + '_' + item.id}
                            style={{ maxHeight: 420 }}
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
                                        <BankLogoBadge bank={item} size={36} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[s.bankItemName, isSelected && s.bankItemNameActive]} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            <Text style={s.bankItemCode}>Code: {item.code}</Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <View style={s.emptyBankState}>
                                    <Ionicons name="search-outline" size={32} color="#94A3B8" />
                                    <Text style={s.emptyBankTitle}>No Bank Found</Text>
                                    <Text style={s.emptyBankSub}>Please check the spelling or search by bank code.</Text>
                                </View>
                            )}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── TRANSFER CONFIRMATION MODAL (LIGHT THEME) ───── */}
            <Modal
                visible={confirmModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.confirmCard}>
                        <View style={s.confirmIconCircle}>
                            <Ionicons name="shield-checkmark" size={28} color="#059669" />
                        </View>
                        <Text style={s.confirmTitle}>Confirm Transfer</Text>
                        <Text style={s.confirmSub}>
                            Please review the transaction details carefully before authorizing with your PIN
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
                                <Text style={s.confirmValue}>
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
                title="Security Verification"
                description={`Enter your 4-digit transaction PIN to authorize transfer of ₦${parseFloat(amount || '0').toLocaleString()}`}
            />

            {/* ── CELEBRATION SUCCESS MODAL (LIGHT THEME) ─────── */}
            <Modal
                visible={successModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.successCard}>
                        <View style={s.successCheckCircle}>
                            <Ionicons name="checkmark-done" size={38} color="#059669" />
                        </View>
                        <Text style={s.successTitle}>Transfer Successful! 🎉</Text>
                        <Text style={s.successSub}>
                            Your funds have been dispatched and transferred successfully.
                        </Text>

                        {lastTxDetails && (
                            <View style={s.successReceiptBox}>
                                <Text style={s.receiptAmount}>₦{lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Recipient:</Text>
                                    <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails.recipient}</Text>
                                </View>
                                {lastTxDetails.bankName && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Destination Bank:</Text>
                                        <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails.bankName}</Text>
                                    </View>
                                )}
                                {lastTxDetails.accountNumber && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Account Number:</Text>
                                        <Text style={s.receiptVal}>{lastTxDetails.accountNumber}</Text>
                                    </View>
                                )}
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Channel:</Text>
                                    <Text style={s.receiptVal}>{lastTxDetails.type === 'p2p' ? 'Abu Mafhal Wallet' : 'Paystack Bank Settlement'}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Reference:</Text>
                                    <Text style={[s.receiptVal, { fontSize: 10, color: '#D97706' }]}>{lastTxDetails.reference}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>New Balance:</Text>
                                    <Text style={[s.receiptVal, { color: '#059669', fontWeight: '900' }]}>
                                        ₦{lastTxDetails.newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <View style={s.successBtnRow}>
                            <TouchableOpacity
                                onPress={handleShareReceipt}
                                style={s.shareReceiptBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="share-social-outline" size={17} color="#0F172A" style={{ marginRight: 6 }} />
                                <Text style={s.shareReceiptText}>Share Receipt</Text>
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
        backgroundColor: '#F8FAFC',
    },
    goldTopLine: {
        height: 3,
        backgroundColor: '#10B981',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
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
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    paystackPoweredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    headerSubtitle: {
        color: '#059669',
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    refreshBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
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
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
    },
    balanceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    walletIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 1,
    },
    eyeToggleBtn: {
        padding: 6,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: 14,
        gap: 10,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#0F172A',
        borderWidth: 2,
    },
    tabButtonText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
    },
    tabButtonTextActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    liveBadge: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    liveBadgeActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    liveBadgeText: {
        color: '#2563EB',
        fontSize: 9,
        fontWeight: '900',
    },
    liveBadgeTextActive: {
        color: '#FFFFFF',
    },
    freeTag: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    freeTagActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    freeTagText: {
        color: '#047857',
        fontSize: 9,
        fontWeight: '900',
    },
    freeTagTextActive: {
        color: '#FFFFFF',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '900',
    },
    cardSub: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    fieldLabel: {
        color: '#1E293B',
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 6,
    },
    counterText: {
        fontSize: 11.5,
        color: '#94A3B8',
        fontWeight: '700',
    },
    counterTextSuccess: {
        color: '#059669',
        fontWeight: '900',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: '#CBD5E1',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 50,
    },
    inputBoxActive: {
        borderColor: '#059669',
        backgroundColor: '#F0FDF4',
    },
    textInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '600',
    },
    bankSelectTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: '#CBD5E1',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 56,
    },
    bankSelectTriggerFilled: {
        borderColor: '#059669',
        backgroundColor: '#F0FDF4',
    },
    emptyBankCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankPlaceholder: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
    },
    selectedBankName: {
        color: '#0F172A',
        fontSize: 13.5,
        fontWeight: '800',
    },
    selectedBankCode: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
    },
    bankChevron: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    popularBanksContainer: {
        marginTop: 10,
    },
    popularBanksLabel: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '700',
        marginBottom: 6,
    },
    popularBanksRow: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 4,
    },
    popularBankChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    popularBankText: {
        color: '#334155',
        fontSize: 11,
        fontWeight: '700',
        maxWidth: 80,
    },
    resolvingStatusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
    },
    resolvingStatusText: {
        color: '#0369A1',
        fontSize: 12,
        fontWeight: '700',
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
    },
    errorAlertTitle: {
        color: '#991B1B',
        fontSize: 12.5,
        fontWeight: '900',
    },
    errorAlertText: {
        color: '#B91C1C',
        fontSize: 11.5,
        fontWeight: '600',
        marginTop: 2,
    },
    resolvedAccountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        borderRadius: 16,
        padding: 14,
        marginTop: 10,
    },
    verifiedIconPill: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#86EFAC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resolvedLabel: {
        color: '#059669',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    resolvedName: {
        color: '#064E3B',
        fontSize: 14.5,
        fontWeight: '900',
        marginTop: 1,
    },
    resolvedBankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    resolvedBankText: {
        color: '#047857',
        fontSize: 11,
        fontWeight: '700',
    },
    amountInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 54,
    },
    currencyPrefix: {
        color: '#0F172A',
        fontSize: 20,
        fontWeight: '900',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 20,
        fontWeight: '900',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    chipBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    chipBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    chipText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '800',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    summaryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    summaryLabel: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '600',
    },
    summaryVal: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
        maxWidth: 200,
        textAlign: 'right',
    },
    summaryValFree: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '900',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 8,
    },
    summaryTotalLabel: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '900',
    },
    summaryTotalVal: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '900',
    },
    submitBtn: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    submitBtnDisabled: {
        backgroundColor: '#CBD5E1',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },

    // P2P Specific Styles
    recipientBadgeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F0FDF4',
        borderWidth: 1.2,
        borderColor: '#86EFAC',
        borderRadius: 16,
        padding: 12,
        marginTop: 10,
    },
    recipientAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipientAvatarText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
    },
    recipientName: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
    },
    recipientMeta: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 2,
    },
    verifiedTag: {
        color: '#059669',
        fontSize: 10,
        fontWeight: '800',
        marginTop: 2,
    },

    // Modal Styles (Light Theme)
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    bankModalCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '900',
    },
    modalSubtitle: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    modalCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    bankSearchInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '600',
    },
    bankRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        borderRadius: 10,
    },
    bankRowItemActive: {
        backgroundColor: '#F0FDF4',
    },
    bankItemName: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '700',
    },
    bankItemNameActive: {
        color: '#065F46',
        fontWeight: '900',
    },
    bankItemCode: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
    },
    emptyBankState: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBankTitle: {
        color: '#334155',
        fontSize: 13.5,
        fontWeight: '800',
        marginTop: 8,
    },
    emptyBankSub: {
        color: '#94A3B8',
        fontSize: 11.5,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
    },

    // Confirm Card (Light Theme)
    confirmCard: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    confirmIconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#ECFDF5',
        borderWidth: 1.5,
        borderColor: '#A7F3D0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    confirmTitle: {
        color: '#0F172A',
        fontSize: 17,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    confirmSub: {
        color: '#64748B',
        fontSize: 11.5,
        textAlign: 'center',
        marginBottom: 16,
    },
    confirmDetailsBox: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 14,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    confirmLabel: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '600',
    },
    confirmValue: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
        maxWidth: 180,
        textAlign: 'right',
    },
    confirmValueGold: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '900',
    },
    confirmValueFree: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '900',
    },
    confirmActionRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: '#475569',
        fontSize: 12.5,
        fontWeight: '800',
    },
    proceedBtn: {
        flex: 1.5,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },

    // Success Card (Light Theme)
    successCard: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    successCheckCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ECFDF5',
        borderWidth: 1.5,
        borderColor: '#A7F3D0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    successTitle: {
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    successSub: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },
    successReceiptBox: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    receiptAmount: {
        color: '#059669',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 8,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginVertical: 4,
    },
    receiptLabel: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '600',
    },
    receiptVal: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '700',
        maxWidth: 180,
        textAlign: 'right',
    },
    successBtnRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    shareReceiptBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareReceiptText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    doneBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
});
