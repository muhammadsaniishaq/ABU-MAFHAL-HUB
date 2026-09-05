import React, { useState, useEffect, useRef } from 'react';
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

interface BankItem {
    id: string;
    code: string;
    name: string;
    color: string;
}

const NIGERIAN_BANKS: BankItem[] = [
    { id: 'opay', code: '999992', name: 'OPay', color: '#00B050' },
    { id: 'palmpay', code: '999991', name: 'PalmPay', color: '#662D91' },
    { id: 'moniepoint', code: '50515', name: 'Moniepoint', color: '#0056D2' },
    { id: 'kuda', code: '50211', name: 'Kuda Bank', color: '#40196D' },
    { id: 'gtb', code: '058', name: 'Guaranty Trust Bank (GTBank)', color: '#E03C31' },
    { id: 'zenith', code: '057', name: 'Zenith Bank', color: '#D42E12' },
    { id: 'access', code: '044', name: 'Access Bank', color: '#0033A1' },
    { id: 'firstbank', code: '011', name: 'First Bank of Nigeria', color: '#003B70' },
    { id: 'uba', code: '033', name: 'United Bank for Africa (UBA)', color: '#C8102E' },
    { id: 'sterling', code: '232', name: 'Sterling Bank', color: '#E31B23' },
    { id: 'wema', code: '035', name: 'Wema Bank (ALAT)', color: '#781848' },
    { id: 'fidelity', code: '070', name: 'Fidelity Bank', color: '#1B365D' },
    { id: 'fcmb', code: '214', name: 'First City Monument Bank (FCMB)', color: '#5B2C82' },
    { id: 'union', code: '032', name: 'Union Bank of Nigeria', color: '#009FE3' },
    { id: 'stanbic', code: '221', name: 'Stanbic IBTC Bank', color: '#0033A0' },
    { id: 'polaris', code: '076', name: 'Polaris Bank', color: '#5C2D91' },
    { id: 'jaiz', code: '301', name: 'Jaiz Bank', color: '#008751' },
    { id: 'taj', code: '302', name: 'TAJ Bank', color: '#C41230' },
    { id: 'ecobank', code: '050', name: 'Ecobank Nigeria', color: '#005C8A' },
    { id: 'keystone', code: '082', name: 'Keystone Bank', color: '#002B49' },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export default function TransferScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // Mode: 'p2p' = User to User | 'bank' = To Nigerian Bank
    const [activeTab, setActiveTab] = useState<'p2p' | 'bank'>('p2p');

    // Current User Profile
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [userBalance, setUserBalance] = useState<number>(0);
    const [showBalance, setShowBalance] = useState(true);
    const [loadingBalance, setLoadingBalance] = useState(false);

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

    // Bank Transfer States
    const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [bankSearchText, setBankSearchText] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');

    // Shared Form States
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [securityModalVisible, setSecurityModalVisible] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Success Modal States
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<{
        reference: string;
        amount: number;
        recipient: string;
        type: 'p2p' | 'bank';
        newBalance: number;
    } | null>(null);

    // Load Balance on Mount
    useEffect(() => {
        fetchUserBalance();
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

    // Debounced search for P2P Recipient
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

                // Query by email, phone, or username
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
                    console.warn('User lookup warning:', error.message);
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
                console.warn('Error finding user:', err);
                setUserSearchError('Kuskure wajen neman asusu.');
            } finally {
                setIsSearchingUser(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [recipientQuery, currentUserId]);

    // Validation & Trigger Confirmation
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
                Alert.alert('Sunan Mai Asusu', 'Da fatan za a shigar da sunan mai asusun banki.');
                return;
            }
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setConfirmModalVisible(true);
    };

    // Called when user confirms details and enters PIN
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
                // Execute P2P Wallet Transfer
                const recipientId = matchedUser!.id;
                const recipientName = matchedUser!.full_name;

                // Try RPC first for atomic integrity
                let rpcSucceeded = false;
                try {
                    const { data: rpcData, error: rpcError } = await supabase.rpc('execute_wallet_transfer', {
                        sender_id: user.id,
                        target_id: recipientId,
                        amount: numAmount,
                        note: note.trim() || 'Wallet Transfer',
                    });

                    if (!rpcError) {
                        rpcSucceeded = true;
                    }
                } catch (rpcEx) {
                    console.warn('execute_wallet_transfer RPC exception:', rpcEx);
                }

                // Fallback atomic balance updates if RPC is not deployed or failed
                if (!rpcSucceeded) {
                    const newSenderBal = Math.max(0, liveBal - numAmount);
                    const { error: debitErr } = await supabase
                        .from('profiles')
                        .update({ balance: newSenderBal })
                        .eq('id', user.id);
                    if (debitErr) throw debitErr;

                    // Credit recipient
                    const { data: recProfile } = await supabase
                        .from('profiles')
                        .select('balance')
                        .eq('id', recipientId)
                        .single();
                    const recBal = recProfile && recProfile.balance !== null ? parseFloat(String(recProfile.balance)) : 0;
                    await supabase
                        .from('profiles')
                        .update({ balance: recBal + numAmount })
                        .eq('id', recipientId);

                    // Insert Sender Transaction
                    await supabase.from('transactions').insert({
                        user_id: user.id,
                        type: 'transfer',
                        amount: numAmount,
                        status: 'success',
                        description: `Transfer to ${recipientName} (${matchedUser?.email || matchedUser?.phone || 'Wallet'})`,
                        reference: refCode,
                    });

                    // Insert Recipient Transaction
                    await supabase.from('transactions').insert({
                        user_id: recipientId,
                        type: 'deposit',
                        amount: numAmount,
                        status: 'success',
                        description: `Transfer received from Abu Mafhal Member`,
                        reference: `${refCode}_IN`,
                    });
                }

                // Send In-App Notifications
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
                    `Kun sami tura kuɗi na ₦${numAmount.toLocaleString()} a cikin wallet ɗinku.`,
                    'deposit',
                    'normal',
                    { route: '/(app)/wallet' }
                );

                const finalNewBal = Math.max(0, liveBal - numAmount);
                setUserBalance(finalNewBal);
                setLastTxDetails({
                    reference: refCode,
                    amount: numAmount,
                    recipient: recipientName,
                    type: 'p2p',
                    newBalance: finalNewBal,
                });
            } else {
                // Execute Bank Transfer (Withdrawal)
                const newSenderBal = Math.max(0, liveBal - numAmount);

                const { error: debitErr } = await supabase
                    .from('profiles')
                    .update({ balance: newSenderBal })
                    .eq('id', user.id);

                if (debitErr) throw debitErr;

                // Log withdrawal transaction
                await supabase.from('transactions').insert({
                    user_id: user.id,
                    type: 'withdrawal',
                    amount: numAmount,
                    status: 'success',
                    description: `Transfer to ${accountName.trim()} - ${selectedBank!.name} (${accountNumber.trim()})`,
                    reference: refCode,
                });

                // Send notification
                await createAppNotification(
                    user.id,
                    'An Tura Kuɗi Zuwa Banki',
                    `An yi nasarar cire ₦${numAmount.toLocaleString()} zuwa ${selectedBank!.name} (${accountNumber.trim()}).`,
                    'transfer',
                    'normal',
                    { route: '/(app)/history' }
                );

                setUserBalance(newSenderBal);
                setLastTxDetails({
                    reference: refCode,
                    amount: numAmount,
                    recipient: `${accountName.trim()} (${selectedBank!.name})`,
                    type: 'bank',
                    newBalance: newSenderBal,
                });
            }

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // Clear inputs and show success celebration
            setAmount('');
            setNote('');
            setRecipientQuery('');
            setMatchedUser(null);
            setAccountNumber('');
            setAccountName('');
            setSuccessModalVisible(true);
        } catch (err: any) {
            console.error('Transfer execution error:', err);
            Alert.alert('An Samu Kuskure', err.message || 'Ba a iya kammala tura kudin ba.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShareReceipt = async () => {
        if (!lastTxDetails) return;
        try {
            await Share.share({
                title: 'Abu Mafhal Hub - Transfer Receipt',
                message: `🧾 ABU MAFHAL HUB TRANSFER RECEIPT\n\nAdadi: ₦${lastTxDetails.amount.toLocaleString()}\nGa: ${lastTxDetails.recipient}\nHanya: ${lastTxDetails.type === 'p2p' ? 'Abu Mafhal Wallet (₦0 Fee)' : 'Nigerian Bank Transfer'}\nLamba (Ref): ${lastTxDetails.reference}\nKwanan Wata: ${new Date().toLocaleString()}\n\nNa gode da amfani da Abu Mafhal Hub!`,
            });
        } catch (e) {
            console.warn('Share error:', e);
        }
    };

    const filteredBanks = NIGERIAN_BANKS.filter(
        (b) =>
            b.name.toLowerCase().includes(bankSearchText.toLowerCase()) ||
            b.code.includes(bankSearchText)
    );

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* Top Accent Line */}
            <View style={s.goldTopLine} />

            {/* Luxury Header */}
            <LinearGradient
                colors={['#020617', '#0F172A', '#1E293B']}
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
                        <Text style={s.headerSubtitle}>Instant Wallet & Bank Settlement</Text>
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

                {/* Balance Badge */}
                <View style={s.balancePillWrapper}>
                    <LinearGradient
                        colors={['#0F172A', '#1C2541']}
                        style={s.balancePill}
                    >
                        <View style={s.balanceLeft}>
                            <Ionicons name="wallet-outline" size={15} color="#F59E0B" />
                            <Text style={s.balanceLabel}>AVAILABLE WALLET:</Text>
                            <Text style={s.balanceAmount}>
                                {showBalance ? `₦${userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '₦ ••••••••'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowBalance(!showBalance)}
                            style={s.eyeToggleBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                                size={14}
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
                        setActiveTab('p2p');
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.tabButton, activeTab === 'p2p' && s.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="people"
                        size={16}
                        color={activeTab === 'p2p' ? '#020617' : '#64748B'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'p2p' && s.tabButtonTextActive]}>
                        To Mafhal User
                    </Text>
                    <View style={[s.freeTag, activeTab === 'p2p' && s.freeTagActive]}>
                        <Text style={[s.freeTagText, activeTab === 'p2p' && s.freeTagTextActive]}>₦0 Fee</Text>
                    </View>
                </TouchableOpacity>

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
                        size={16}
                        color={activeTab === 'bank' ? '#020617' : '#64748B'}
                    />
                    <Text style={[s.tabButtonText, activeTab === 'bank' && s.tabButtonTextActive]}>
                        To Bank Account
                    </Text>
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

                {activeTab === 'p2p' ? (
                    // ── MODE 1: P2P TRANSFER ─────────────────────────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={s.cardIconCircle}>
                                <Ionicons name="send" size={16} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Tura Kuɗi Ga Wani Mai Asusu</Text>
                                <Text style={s.cardSub}>
                                    Tura kudi kyauta cikin sakan guda ba tare da kudin caji ba
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
                ) : (
                    // ── MODE 2: BANK TRANSFER ─────────────────────────
                    <View style={s.card}>
                        <View style={s.cardHeaderRow}>
                            <View style={[s.cardIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                                <Ionicons name="business" size={16} color="#3B82F6" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>Tura Kuɗi Zuwa Asusu Banki</Text>
                                <Text style={s.cardSub}>
                                    Cire kuɗi daga wallet ɗinka zuwa kowane banki a Najeriya
                                </Text>
                            </View>
                        </View>

                        {/* Bank Selector */}
                        <Text style={s.fieldLabel}>Zaɓi Banki</Text>
                        <TouchableOpacity
                            onPress={() => setBankModalVisible(true)}
                            style={s.bankSelectTrigger}
                            activeOpacity={0.8}
                        >
                            {selectedBank ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <View style={[s.bankMiniIcon, { backgroundColor: selectedBank.color }]}>
                                        <Text style={s.bankMiniIconText}>{selectedBank.name.charAt(0)}</Text>
                                    </View>
                                    <Text style={s.selectedBankName} numberOfLines={1}>{selectedBank.name}</Text>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="business-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                                    <Text style={s.bankPlaceholder}>Danna nan don zaɓar banki...</Text>
                                </View>
                            )}
                            <Ionicons name="chevron-down" size={18} color="#64748B" />
                        </TouchableOpacity>

                        {/* Account Number */}
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Lambar Asusun Banki (Account Number)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="card-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="0123456789 (Lamba 10)"
                                placeholderTextColor="#94A3B8"
                                value={accountNumber}
                                onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
                                keyboardType="number-pad"
                                maxLength={10}
                            />
                            {accountNumber.length === 10 && (
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            )}
                        </View>

                        {/* Account Name */}
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Sunan Mai Asusu (Account Name)</Text>
                        <View style={s.inputBox}>
                            <Ionicons name="person-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.textInput}
                                placeholder="Shigar da cikakken sunan mai asusun"
                                placeholderTextColor="#94A3B8"
                                value={accountName}
                                onChangeText={setAccountName}
                                autoCapitalize="characters"
                            />
                        </View>

                        {/* Amount */}
                        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Adadin Kuɗi (Amount)</Text>
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

                        {/* Settlement Summary */}
                        <View style={s.summaryBox}>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Bankin Da Za A Tura:</Text>
                                <Text style={s.summaryVal}>{selectedBank ? selectedBank.name : '—'}</Text>
                            </View>
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>Lambar Asusu:</Text>
                                <Text style={s.summaryVal}>{accountNumber || '—'}</Text>
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
                                    <Ionicons name="arrow-up-circle" size={18} color="#020617" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>TURA ZUWA BANKI</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* ── BANK SELECTION MODAL ───────────────────────── */}
            <Modal
                visible={bankModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setBankModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeaderRow}>
                            <Text style={s.modalTitle}>Zaɓi Banki (Select Bank)</Text>
                            <TouchableOpacity
                                onPress={() => setBankModalVisible(false)}
                                style={s.modalCloseBtn}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={s.bankSearchBox}>
                            <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.bankSearchInput}
                                placeholder="Bincika banki (e.g. OPay, GTBank)..."
                                placeholderTextColor="#94A3B8"
                                value={bankSearchText}
                                onChangeText={setBankSearchText}
                            />
                        </View>

                        {/* Banks List */}
                        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                            {filteredBanks.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => {
                                        setSelectedBank(item);
                                        setBankModalVisible(false);
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[
                                        s.bankRowItem,
                                        selectedBank?.id === item.id && s.bankRowItemActive,
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <View style={[s.bankItemIcon, { backgroundColor: item.color }]}>
                                        <Text style={s.bankItemIconText}>{item.name.charAt(0)}</Text>
                                    </View>
                                    <Text style={s.bankItemName}>{item.name}</Text>
                                    {selectedBank?.id === item.id && (
                                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
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
                                <Text style={s.confirmValue}>
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
                            <Ionicons name="checkmark-done" size={36} color="#10B981" />
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
                                    <Text style={s.receiptVal}>{lastTxDetails.recipient}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Lamba (Ref):</Text>
                                    <Text style={s.receiptVal}>{lastTxDetails.reference}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptLabel}>Sabon Balance:</Text>
                                    <Text style={[s.receiptVal, { color: '#10B981', fontWeight: '800' }]}>
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
                                <Ionicons name="share-social-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
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
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
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
        width: 36,
        height: 36,
        borderRadius: 18,
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
    headerSubtitle: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.4,
        marginTop: 2,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    balanceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    balanceLabel: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
    },
    eyeToggleBtn: {
        padding: 4,
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
        borderRadius: 20,
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
        width: 36,
        height: 36,
        borderRadius: 18,
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
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 6,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
    },
    textInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '600',
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 6,
    },
    errorAlertText: {
        color: '#B91C1C',
        fontSize: 11,
        fontWeight: '600',
    },
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
    bankSelectTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    bankMiniIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    bankMiniIconText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    selectedBankName: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '800',
    },
    bankPlaceholder: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    summaryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
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
        height: 48,
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

    // Modal Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 20,
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
        fontSize: 15,
        fontWeight: '900',
    },
    modalCloseBtn: {
        padding: 4,
    },
    bankSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 12,
    },
    bankSearchInput: {
        flex: 1,
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '600',
    },
    bankRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        borderRadius: 8,
    },
    bankRowItemActive: {
        backgroundColor: '#F8FAFC',
    },
    bankItemIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    bankItemIconText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
    },
    bankItemName: {
        flex: 1,
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '700',
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
        height: 42,
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
        height: 42,
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
    },
    successBtnRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    shareReceiptBtn: {
        flex: 1,
        height: 42,
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
        height: 42,
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
