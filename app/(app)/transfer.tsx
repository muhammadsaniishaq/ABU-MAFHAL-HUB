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
function BankLogoBadge({ bank, size = 32 }: { bank: BankItem; size?: number }) {
    const [imgFailed, setImgFailed] = useState(false);
    const logoUri = bank.logo || (bank.slug ? `https://cdn.jsdelivr.net/gh/steveoni/nigeria-banks-logo@master/${bank.slug}.png` : undefined);

    if (!logoUri || imgFailed) {
        const initial = (bank.name || 'B').charAt(0).toUpperCase();
        const bg = bank.color || '#1E293B';
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
                    borderColor: 'rgba(255,255,255,0.15)',
                }}
            >
                <Text style={{ color: '#FFFFFF', fontSize: size * 0.44, fontWeight: '900' }}>{initial}</Text>
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

    // Active Mode Tab: 'p2p' = User-to-User | 'bank' = Live Nigerian Bank Settlement
    const [activeTab, setActiveTab] = useState<'p2p' | 'bank'>('bank');

    // Current User Profile & Balance
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [userBalance, setUserBalance] = useState<number>(0);
    const [showBalance, setShowBalance] = useState(true);
    const [loadingBalance, setLoadingBalance] = useState(false);

    // Paystack Nigerian Banks State
    const [banksList, setBanksList] = useState<BankItem[]>(DEFAULT_BANKS);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [bankSearchText, setBankSearchText] = useState('');

    // Bank Account Number & Auto-Resolution States
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isResolvingAccount, setIsResolvingAccount] = useState(false);
    const [resolveError, setResolveError] = useState<string | null>(null);

    // P2P Transfer States
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

    // Shared Form States
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
        // 1. Try local storage cache for instant rendering
        try {
            const cached = await AsyncStorage.getItem('@cached_nigerian_banks_v2');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setBanksList(parsed);
                }
            }
        } catch (_) {}

        // 2. Fetch fresh live list from Paystack via Edge Function
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
            console.warn('Network bank fetch notice (using cached/default):', e);
        } finally {
            setLoadingBanks(false);
        }
    };

    // ── PAYSTACK AUTO ACCOUNT NAME RESOLUTION ────────────────────────
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
                    const errorMsg = data?.message || "Ba a sami wannan asusun banki ba. Tabbatar lambar asusun da bankin da ka zaɓa daidai ne.";
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
                    setResolveError('Kuskure wajen duba asusun banki. Da fatan a sake gwadawa.');
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
                    setUserSearchError('Ba a sami wannan mai amfani ba.');
                    setMatchedUser(null);
                    return;
                }

                if (!data) {
                    setUserSearchError('Ba a sami mai amfani da wannan bayanin ba.');
                    setMatchedUser(null);
                } else if (data.id === currentUserId) {
                    setUserSearchError('Ba za ka iya tura kuɗi zuwa asusunka ba!');
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
                setUserSearchError('Kuskure wajen neman asusu.');
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
            Alert.alert('Adadin Kuɗi', 'Da fatan za a shigar da adadin kuɗi mai ma’ana.');
            return;
        }

        if (numAmount > userBalance) {
            Alert.alert(
                'Kuɗin Ka Bai Isa Ba',
                `Adadin kuɗin da ke cikin wallet ɗinka (₦${userBalance.toLocaleString()}) bai kai ₦${numAmount.toLocaleString()} ba.`
            );
            return;
        }

        const minWithdrawal = parseFloat(settings?.min_withdrawal || '100');
        if (numAmount < minWithdrawal) {
            Alert.alert('Ƙaramin Adadi', `Mafi ƙarancin kuɗin da za a iya turawa shi ne ₦${minWithdrawal.toLocaleString()}`);
            return;
        }

        if (activeTab === 'p2p') {
            if (!matchedUser) {
                Alert.alert('Zaɓi Asusu', 'Da fatan za a tabbatar da mai karɓa kafin a ci gaba.');
                return;
            }
        } else {
            if (!selectedBank) {
                Alert.alert('Zaɓi Banki', 'Da fatan za a zaɓi bankin da za a tura kuɗin.');
                return;
            }
            if (accountNumber.trim().length !== 10) {
                Alert.alert('Lambar Asusu', 'Lambar asusun banki dole ne ta kasance lamba 10 cif.');
                return;
            }
            if (!accountName.trim()) {
                Alert.alert('Tabbatar Da Asusu', 'Da fatan za a jira Paystack ta tabbatar da sunan mai asusu.');
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
            if (!user) throw new Error('Ba ku cikin asusun ku.');

            // 1. Double check live balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', user.id)
                .single();

            const liveBal = profile && profile.balance !== null ? parseFloat(String(profile.balance)) : userBalance;
            if (liveBal < numAmount) {
                throw new Error(`Kuɗin ka bai isa ba. Kana da ₦${liveBal.toLocaleString()} a wallet.`);
            }

            if (activeTab === 'p2p') {
                // Execute P2P Wallet Transfer via secure atomic RPC
                const recipientId = matchedUser!.id;
                const recipientName = matchedUser!.full_name;

                const { data: rpcData, error: rpcError } = await supabase.rpc('execute_wallet_transfer', {
                    sender_id: user.id,
                    target_id: recipientId,
                    amount: numAmount,
                    note: note.trim() || 'Wallet Transfer',
                });

                if (rpcError) {
                    throw new Error(rpcError.message || 'Kuskure wajen tura kudi tsakanin asusu.');
                }

                const finalNewBal = rpcData?.new_balance !== undefined
                    ? parseFloat(String(rpcData.new_balance))
                    : Math.max(0, liveBal - numAmount);

                const finalRef = rpcData?.reference || refCode;

                // Send In-App Notifications
                try {
                    await createAppNotification(
                        user.id,
                        'An Tura Kuɗi!',
                        `An yi nasarar tura ₦${numAmount.toLocaleString()} zuwa ga ${recipientName}.`,
                        'transfer',
                        'normal',
                        { route: '/(app)/history' }
                    );

                    await createAppNotification(
                        recipientId,
                        'An Saka Kuɗi A Wallet!',
                        `Kun sami tura kuɗi na ₦${numAmount.toLocaleString()} daga ${profile?.full_name || 'wata aboki'}.`,
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
                // Execute Live Bank Transfer via Paystack Transfers API + Atomic DB Debit
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
                    throw new Error(edgeData?.message || edgeErr?.message || 'Ba a iya tura kudi zuwa banki ba.');
                }

                const finalNewBal = edgeData?.new_balance !== undefined
                    ? parseFloat(String(edgeData.new_balance))
                    : Math.max(0, liveBal - numAmount);

                const finalRef = edgeData?.reference || refCode;

                // Send In-App Notification
                try {
                    await createAppNotification(
                        user.id,
                        'An Tura Kuɗi Zuwa Banki',
                        `An yi nasarar cire ₦${numAmount.toLocaleString()} zuwa ${selectedBank!.name} (${accountNumber.trim()} - ${accountName.trim()}).`,
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
            Alert.alert('Kuskure Wajen Tura Kuɗi', err.message || 'Ba a iya kammala tura kudin ba. Da fatan a duba intanet ko kuɗin wallet.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShareReceipt = async () => {
        if (!lastTxDetails) return;
        try {
            const detailsMsg = lastTxDetails.type === 'p2p'
                ? `🧾 ABU MAFHAL HUB - P2P WALLET RECEIPT\n\nAdadi: ₦${lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nGa: ${lastTxDetails.recipient}\nHanya: Abu Mafhal Wallet (₦0 Fee)\nLamba (Ref): ${lastTxDetails.reference}\nKwanan Wata: ${lastTxDetails.date}\n\nNa gode da amfani da Abu Mafhal Hub!`
                : `🧾 ABU MAFHAL HUB - BANK TRANSFER RECEIPT\n\nAdadi: ₦${lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nGa: ${lastTxDetails.recipient}\nBanki: ${lastTxDetails.bankName}\nLambar Asusu: ${lastTxDetails.accountNumber}\nLamba (Ref): ${lastTxDetails.reference}\nKwanan Wata: ${lastTxDetails.date}\n\nSettled instantly via Abu Mafhal Hub!`;

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
            <StatusBar style="light" />

            {/* Top Accent Line */}
            <View style={s.goldTopLine} />

            {/* Luxury Header */}
            <LinearGradient
                colors={['#020617', '#0B1528', '#13213C']}
                style={[s.headerContainer, { paddingTop: Math.max(insets.top + 8, 36) }]}
            >
                <View style={s.headerNavRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.backBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
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
                            color="#F59E0B"
                            style={loadingBalance ? { transform: [{ rotate: '45deg' }] } : undefined}
                        />
                    </TouchableOpacity>
                </View>

                {/* Available Wallet Balance Card */}
                <View style={s.balancePillWrapper}>
                    <LinearGradient
                        colors={['#0F1E36', '#1A2B4C']}
                        style={s.balancePill}
                    >
                        <View style={s.balanceLeft}>
                            <View style={s.walletIconCircle}>
                                <Ionicons name="wallet" size={15} color="#F59E0B" />
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
                                color="#94A3B8"
                            />
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            </LinearGradient>

            {/* Mode Switcher Tabs */}
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
                        color={activeTab === 'bank' ? '#020617' : '#64748B'}
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
                        color={activeTab === 'p2p' ? '#020617' : '#64748B'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'p2p' && s.tabButtonTextActive]}>
                        To Mafhal User
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
                            <View style={[s.cardIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                                <Ionicons name="business" size={18} color="#10B981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Tura Kuɗi Zuwa Banki (All Nigeria Banks)</Text>
                                <Text style={s.cardSub}>
                                    Ana tura kuɗi take zuwa kowane banki ta Paystack da sunan asusunka
                                </Text>
                            </View>
                        </View>

                        {/* Step 1: Bank Selector Trigger */}
                        <Text style={s.fieldLabel}>1. Zaɓi Banki (Select Destination Bank)</Text>
                        <TouchableOpacity
                            onPress={() => setBankModalVisible(true)}
                            style={[s.bankSelectTrigger, selectedBank && s.bankSelectTriggerFilled]}
                            activeOpacity={0.8}
                        >
                            {selectedBank ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                    <BankLogoBadge bank={selectedBank} size={34} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.selectedBankName} numberOfLines={1}>{selectedBank.name}</Text>
                                        <Text style={s.selectedBankCode}>Code: {selectedBank.code}</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                    <View style={s.emptyBankCircle}>
                                        <Ionicons name="business-outline" size={16} color="#94A3B8" />
                                    </View>
                                    <Text style={s.bankPlaceholder}>Danna nan domin zaɓar banki...</Text>
                                </View>
                            )}
                            <View style={s.bankChevron}>
                                <Ionicons name="chevron-forward" size={18} color="#64748B" />
                            </View>
                        </TouchableOpacity>

                        {/* Popular Banks Fast Shortcuts */}
                        {!selectedBank && (
                            <View style={s.popularBanksContainer}>
                                <Text style={s.popularBanksLabel}>Shahararrun Bankuna:</Text>
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
                            <Text style={s.fieldLabel}>2. Lambar Asusun Banki (10 Digits)</Text>
                            <Text style={[s.counterText, accountNumber.length === 10 && s.counterTextSuccess]}>
                                {accountNumber.length}/10
                            </Text>
                        </View>
                        <View style={[s.inputBox, accountNumber.length === 10 && s.inputBoxActive]}>
                            <Ionicons name="card-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="Misali: 8145853539 ko 0123456789"
                                placeholderTextColor="#94A3B8"
                                value={accountNumber}
                                onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
                                keyboardType="number-pad"
                                maxLength={10}
                            />
                            {isResolvingAccount && (
                                <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 6 }} />
                            )}
                            {!isResolvingAccount && accountName ? (
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            ) : null}
                        </View>

                        {/* Paystack Auto-Resolution Status & Feedback */}
                        {isResolvingAccount && (
                            <View style={s.resolvingStatusBox}>
                                <ActivityIndicator size="small" color="#0284C7" />
                                <Text style={s.resolvingStatusText}>
                                    Ana duba sunan asusun a Paystack NUBAN...
                                </Text>
                            </View>
                        )}

                        {resolveError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.errorAlertTitle}>Ba a sami asusu ba</Text>
                                    <Text style={s.errorAlertText}>{resolveError}</Text>
                                </View>
                            </View>
                        )}

                        {accountName ? (
                            <View style={s.resolvedAccountCard}>
                                <View style={s.verifiedIconPill}>
                                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.resolvedLabel}>SUNAN MAI ASUSU (VERIFIED NUBAN):</Text>
                                    <Text style={s.resolvedName}>{accountName}</Text>
                                    <View style={s.resolvedBankRow}>
                                        <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                                        <Text style={s.resolvedBankText}>
                                            {selectedBank?.name} • {accountNumber}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}

                        {/* Step 3: Amount */}
                        <Text style={[s.fieldLabel, { marginTop: 16 }]}>3. Adadin Kuɗi (Amount)</Text>
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
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Bayanin Biyan Kuɗi (Narration - Na Zaɓi ne)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="Misali: Tallafi ko Kasuwanci"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Summary Box */}
                        <View style={s.summaryBox}>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Bankin Da Za A Tura:</Text>
                                <Text style={s.summaryVal} numberOfLines={1}>{selectedBank ? selectedBank.name : '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Lambar Asusu:</Text>
                                <Text style={s.summaryVal}>{accountNumber || '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Sunan Mai Asusu:</Text>
                                <Text style={[s.summaryVal, accountName ? { color: '#10B981', fontWeight: '900' } : undefined]}>
                                    {accountName || '— (A jira tabbatarwa)'}
                                </Text>
                            </View>
                            <View style={s.summaryDivider} />
                            <View style={s.summaryRow}>
                                <Text style={s.summaryTotalLabel}>Jimillar Da Za A Cire:</Text>
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
                                <ActivityIndicator color="#020617" />
                            ) : (
                                <>
                                    <Ionicons name="arrow-up-circle" size={19} color="#020617" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>TURA ZUWA BANKI YANZU</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    // ── MODE 2: P2P TRANSFER (WALLET TO WALLET) ───────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={s.cardIconCircle}>
                                <Ionicons name="send" size={16} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Tura Kuɗi Ga Wani Mai Asusu</Text>
                                <Text style={s.cardSub}>
                                    Tura kudi kyauta cikin sakan guda ba tare da kudin caji ba (₦0 Fee)
                                </Text>
                            </View>
                        </View>

                        {/* Recipient Input */}
                        <Text style={s.fieldLabel}>Lambar Waya, Email, ko Username</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="Misali: 08145853539 ko sale@abumafhal.com"
                                placeholderTextColor="#94A3B8"
                                value={recipientQuery}
                                onChangeText={setRecipientQuery}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            {isSearchingUser && (
                                <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 6 }} />
                            )}
                        </View>

                        {/* Search Error State */}
                        {userSearchError && (
                            <View style={s.errorAlert}>
                                <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
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
                                    <Text style={s.verifiedTag}>● Tabbataccen Mai Asusu (Verified Member)</Text>
                                </View>
                            </View>
                        )}

                        {/* Amount Input */}
                        <Text style={[s.fieldLabel, { marginTop: 16 }]}>Adadin Kuɗi (Amount)</Text>
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
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Bayanin Biyan Kuɗi (Note - Na Zabi ne)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="Misali: Kudin Data ko Tallafi"
                                placeholderTextColor="#94A3B8"
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>

                        {/* Fee Summary */}
                        <View style={s.summaryBox}>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Kudin Caji (Fee):</Text>
                                <Text style={s.summaryValFree}>₦0.00 (KYAUTA)</Text>
                            </View>
                            <View style={s.summaryDivider} />
                            <View style={s.summaryRow}>
                                <Text style={s.summaryTotalLabel}>Jimillar Da Za A Cire:</Text>
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
                                <ActivityIndicator color="#020617" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={18} color="#020617" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>TURA KUƊI YANZU</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* ── BANK SELECTION MODAL (PAYSTACK 282+ BANKS) ──── */}
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
                                <Text style={s.modalTitle}>Zaɓi Banki (Select Bank)</Text>
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
                            <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.bankSearchInput}
                                placeholder="Bincika banki (misali: OPay, Kuda, GTBank)..."
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
                                            <Text style={s.bankItemCode}>NUBAN Code: {item.code}</Text>
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
                                    <Text style={s.emptyBankTitle}>Ba a sami bankin ba</Text>
                                    <Text style={s.emptyBankSub}>Duba rubutun sunan bankin ko lambar code ɗinsa.</Text>
                                </View>
                            )}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── TRANSFER CONFIRMATION MODAL ────────────────── */}
            <Modal
                visible={confirmModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.confirmCard}>
                        <View style={s.confirmIconCircle}>
                            <Ionicons name="shield-checkmark" size={28} color="#F59E0B" />
                        </View>
                        <Text style={s.confirmTitle}>Tabbatar Da Tura Kuɗi</Text>
                        <Text style={s.confirmSub}>
                            Da fatan za a duba bayanan nan a hankali kafin a tura PIN
                        </Text>

                        <View style={s.confirmDetailsBox}>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Adadin Kuɗi:</Text>
                                <Text style={s.confirmValueGold}>₦{parseFloat(amount || '0').toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                            </View>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Mai Karɓa:</Text>
                                <Text style={s.confirmValue} numberOfLines={1}>
                                    {activeTab === 'p2p' ? matchedUser?.full_name : accountName}
                                </Text>
                            </View>
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Hanya:</Text>
                                <Text style={s.confirmValue}>
                                    {activeTab === 'p2p' ? 'Abu Mafhal Wallet' : selectedBank?.name}
                                </Text>
                            </View>
                            {activeTab === 'bank' && (
                                <View style={s.confirmRow}>
                                    <Text style={s.confirmLabel}>Lambar Asusu:</Text>
                                    <Text style={s.confirmValue}>{accountNumber}</Text>
                                </View>
                            )}
                            <View style={s.confirmRow}>
                                <Text style={s.confirmLabel}>Kudin Caji (Fee):</Text>
                                <Text style={s.confirmValueFree}>₦0.00 (KYAUTA)</Text>
                            </View>
                        </View>

                        <View style={s.confirmActionRow}>
                            <TouchableOpacity
                                onPress={() => setConfirmModalVisible(false)}
                                style={s.cancelBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={s.cancelBtnText}>FASA</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setConfirmModalVisible(false);
                                    setSecurityModalVisible(true);
                                }}
                                style={s.proceedBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.proceedBtnText}>CI GABA DA PIN</Text>
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
                title="Tabbatar Da PIN"
                description={`Shigar da lambar sirri (PIN) domin tura ₦${parseFloat(amount || '0').toLocaleString()}`}
            />

            {/* ── CELEBRATION SUCCESS MODAL ──────────────────── */}
            <Modal
                visible={successModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.successCard}>
                        <View style={s.successCheckCircle}>
                            <Ionicons name="checkmark-done" size={38} color="#10B981" />
                        </View>
                        <Text style={s.successTitle}>An Yi Nasarar Tura Kuɗi! 🎉</Text>
                        <Text style={s.successSub}>
                            An fitar da kuɗin tare da turawa ga mai asusun nan take
                        </Text>

                        {lastTxDetails && (
                            <View style={s.successReceiptBox}>
                                <Text style={s.receiptAmount}>₦{lastTxDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Mai Karɓa:</Text>
                                    <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails.recipient}</Text>
                                </View>
                                {lastTxDetails.bankName && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Banki:</Text>
                                        <Text style={s.receiptVal} numberOfLines={1}>{lastTxDetails.bankName}</Text>
                                    </View>
                                )}
                                {lastTxDetails.accountNumber && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptLabel}>Lambar Asusu:</Text>
                                        <Text style={s.receiptVal}>{lastTxDetails.accountNumber}</Text>
                                    </View>
                                )}
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Hanya:</Text>
                                    <Text style={s.receiptVal}>{lastTxDetails.type === 'p2p' ? 'Abu Mafhal Wallet' : 'Paystack Bank Settlement'}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Lamba (Ref):</Text>
                                    <Text style={[s.receiptVal, { fontSize: 10, color: '#F59E0B' }]}>{lastTxDetails.reference}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Sabon Balance:</Text>
                                    <Text style={[s.receiptVal, { color: '#10B981', fontWeight: '900' }]}>
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
                                <Ionicons name="share-social-outline" size={17} color="#F59E0B" style={{ marginRight: 6 }} />
                                <Text style={s.shareReceiptText}>Tura Receipt</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setSuccessModalVisible(false);
                                    router.replace('/(app)/wallet');
                                }}
                                style={s.doneBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.doneBtnText}>KOMA WALLET</Text>
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
        height: 2.5,
        backgroundColor: '#F59E0B',
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderBottomWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleCol: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 17,
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
        color: '#10B981',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    refreshBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balancePillWrapper: {
        marginTop: 4,
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    balanceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    walletIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        marginTop: 1,
    },
    eyeToggleBtn: {
        padding: 6,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: 12,
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
    },
    tabButtonActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
    },
    tabButtonText: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '800',
    },
    tabButtonTextActive: {
        color: '#020617',
    },
    liveBadge: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
    },
    liveBadgeActive: {
        backgroundColor: '#020617',
        borderColor: '#020617',
    },
    liveBadgeText: {
        color: '#2563EB',
        fontSize: 8.5,
        fontWeight: '900',
    },
    liveBadgeTextActive: {
        color: '#10B981',
    },
    freeTag: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
    },
    freeTagActive: {
        backgroundColor: '#020617',
        borderColor: '#020617',
    },
    freeTagText: {
        color: '#047857',
        fontSize: 8.5,
        fontWeight: '900',
    },
    freeTagTextActive: {
        color: '#F59E0B',
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
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
    },
    cardSub: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '500',
        marginTop: 1,
    },
    fieldLabel: {
        color: '#334155',
        fontSize: 11.5,
        fontWeight: '800',
        marginBottom: 6,
    },
    counterText: {
        fontSize: 11,
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
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: '#CBD5E1',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
    },
    inputBoxActive: {
        borderColor: '#10B981',
        backgroundColor: '#F0FDF4',
    },
    textInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 13.5,
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
        height: 54,
    },
    bankSelectTriggerFilled: {
        borderColor: '#10B981',
        backgroundColor: '#F0FDF4',
    },
    emptyBankCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankPlaceholder: {
        color: '#94A3B8',
        fontSize: 12.5,
        fontWeight: '600',
    },
    selectedBankName: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
    },
    selectedBankCode: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    bankChevron: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    popularBanksContainer: {
        marginTop: 10,
    },
    popularBanksLabel: {
        color: '#64748B',
        fontSize: 10,
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
        paddingHorizontal: 8,
        paddingVertical: 5,
        gap: 6,
    },
    popularBankText: {
        color: '#334155',
        fontSize: 10.5,
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
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 8,
    },
    resolvingStatusText: {
        color: '#0369A1',
        fontSize: 11.5,
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
        fontSize: 12,
        fontWeight: '900',
    },
    errorAlertText: {
        color: '#B91C1C',
        fontSize: 11,
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
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
    },
    verifiedIconPill: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        fontSize: 14,
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
        color: '#047857',
        fontSize: 10.5,
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
        height: 52,
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
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    chipBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#F59E0B',
    },
    chipText: {
        color: '#475569',
        fontSize: 10.5,
        fontWeight: '800',
    },
    chipTextActive: {
        color: '#F59E0B',
    },
    summaryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 3,
    },
    summaryLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
    },
    summaryVal: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '800',
        maxWidth: 200,
        textAlign: 'right',
    },
    summaryValFree: {
        color: '#10B981',
        fontSize: 11.5,
        fontWeight: '900',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 6,
    },
    summaryTotalLabel: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
    },
    summaryTotalVal: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
    },
    submitBtn: {
        backgroundColor: '#F59E0B',
        borderRadius: 14,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    submitBtnDisabled: {
        backgroundColor: '#CBD5E1',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitBtnText: {
        color: '#020617',
        fontSize: 13,
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
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
    },
    recipientAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipientAvatarText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },
    recipientName: {
        color: '#0F172A',
        fontSize: 13.5,
        fontWeight: '900',
    },
    recipientMeta: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    verifiedTag: {
        color: '#059669',
        fontSize: 9.5,
        fontWeight: '800',
        marginTop: 2,
    },

    // Bank Selection Modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
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
        shadowOpacity: 0.25,
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
        fontSize: 15.5,
        fontWeight: '900',
    },
    modalSubtitle: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    bankSearchInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '600',
    },
    bankRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
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
        fontSize: 12.5,
        fontWeight: '700',
    },
    bankItemNameActive: {
        color: '#065F46',
        fontWeight: '900',
    },
    bankItemCode: {
        color: '#94A3B8',
        fontSize: 10,
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
        fontSize: 13,
        fontWeight: '800',
        marginTop: 8,
    },
    emptyBankSub: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
    },

    // Confirm Card
    confirmCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#0F172A',
        borderRadius: 22,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    confirmIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    confirmTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    confirmSub: {
        color: '#94A3B8',
        fontSize: 11,
        textAlign: 'center',
        marginBottom: 16,
    },
    confirmDetailsBox: {
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: 14,
        padding: 12,
        marginBottom: 18,
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    confirmLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    confirmValue: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
        maxWidth: 180,
        textAlign: 'right',
    },
    confirmValueGold: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '900',
    },
    confirmValueFree: {
        color: '#10B981',
        fontSize: 11.5,
        fontWeight: '900',
    },
    confirmActionRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '800',
    },
    proceedBtn: {
        flex: 1.5,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedBtnText: {
        color: '#020617',
        fontSize: 12,
        fontWeight: '900',
    },

    // Success Card
    successCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#0F172A',
        borderRadius: 22,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    successCheckCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1.5,
        borderColor: 'rgba(16, 185, 129, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    successTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    successSub: {
        color: '#94A3B8',
        fontSize: 11.5,
        textAlign: 'center',
        marginBottom: 16,
    },
    successReceiptBox: {
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        marginBottom: 18,
    },
    receiptAmount: {
        color: '#10B981',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 8,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginVertical: 3,
    },
    receiptLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    receiptVal: {
        color: '#FFFFFF',
        fontSize: 11,
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
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.4)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareReceiptText: {
        color: '#F59E0B',
        fontSize: 11.5,
        fontWeight: '800',
    },
    doneBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        color: '#020617',
        fontSize: 12,
        fontWeight: '900',
    },
});
