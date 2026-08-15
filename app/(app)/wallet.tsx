import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Alert,
    ActivityIndicator,
    Image,
    StyleSheet,
    TextInput,
    Platform,
    Modal,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useAppSettings } from '../../hooks/useAppSettings';
import DynamicBanners from '../../components/DynamicBanners';
import PaystackPayment from '../../components/PaystackPayment';
import * as Haptics from 'expo-haptics';

const T = {
    navyDark: '#020617',
    navyMid: '#0F172A',
    navyCard: '#1E293B',
    gold: '#F59E0B',
    goldDark: '#D97706',
    goldBg: 'rgba(245, 158, 11, 0.12)',
    white: '#FFFFFF',
    bgLight: '#F8FAFC',
    textDark: '#0F172A',
    textMuted: '#64748B',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.1)',
    rose: '#EF4444',
    roseBg: 'rgba(239, 68, 68, 0.1)',
};

export default function WalletScreen() {
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    
    // Dynamic Fee Thresholds
    const [feeThreshold, setFeeThreshold] = useState(5000);
    const [feeUnder, setFeeUnder] = useState(50);
    const [feeAbove, setFeeAbove] = useState(1);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { settings, loading: settingsLoading } = useAppSettings();
    const [showBalance, setShowBalance] = useState(!settings?.hide_user_balances);
    const [fundModalVisible, setFundModalVisible] = useState(false);
    const [fundMethod, setFundMethod] = useState<'transfer' | 'card'>('transfer');

    // Paystack States
    const [fundAmount, setFundAmount] = useState('');
    const [paystackVisible, setPaystackVisible] = useState(false);
    const [paystackKey, setPaystackKey] = useState('');
    const [userEmail, setUserEmail] = useState('');

    const hasLoadedOnce = useRef(false);

    useEffect(() => {
        if (!settingsLoading) {
            setShowBalance(!settings.hide_user_balances);
        }
    }, [settingsLoading, settings.hide_user_balances]);

    useFocusEffect(
        useCallback(() => {
            fetchWalletData();
        }, [])
    );

    const fetchWalletData = async () => {
        if (!hasLoadedOnce.current) {
            setLoading(true);
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [profileRes, vAccountRes, statsRes, recentRes, settingsRes] = await Promise.all([
                supabase.from('profiles').select('balance').eq('id', user.id).single(),
                supabase.from('virtual_accounts').select('bank_name, account_number, account_name').eq('user_id', user.id).maybeSingle(),
                supabase.from('transactions').select('amount, type').eq('user_id', user.id).eq('status', 'success'),
                supabase.from('transactions').select('id, amount, type, status, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
                supabase.from('app_settings').select('key, value').in('key', ['funding_fee_fixed_threshold', 'funding_fee_under_threshold', 'funding_fee_above_threshold'])
            ]);

            setUserEmail(user.email || '');

            let finalKey = '';
            const { data: paystackDbKey } = await supabase.from('system_secrets').select('value').eq('key', 'PAYSTACK_PUBLIC_KEY').maybeSingle();

            if (paystackDbKey && paystackDbKey.value && paystackDbKey.value.length > 10) {
                finalKey = paystackDbKey.value.trim();
            } else {
                const envKey = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;
                if (envKey && envKey.length > 10 && !envKey.includes('...')) {
                    finalKey = envKey.trim();
                }
            }

            if (finalKey) setPaystackKey(finalKey);

            if (profileRes.data) {
                setBalance(profileRes.data.balance || 0);
            }

            setVirtualAccount(vAccountRes.data);

            const transactions = statsRes.data;
            if (transactions) {
                let income = 0;
                let expenses = 0;
                for (let i = 0; i < transactions.length; i++) {
                    const tx = transactions[i];
                    const amt = parseFloat(tx.amount);
                    if (tx.type === 'deposit') {
                        income += amt;
                    } else {
                        expenses += amt;
                    }
                }
                setTotalIn(income);
                setTotalOut(expenses);
            } else {
                setTotalIn(0);
                setTotalOut(0);
            }

            setRecentTransactions(recentRes.data || []);

            if (settingsRes.data) {
                const tSet = settingsRes.data.find(s => s.key === 'funding_fee_fixed_threshold');
                if (tSet && !isNaN(parseFloat(tSet.value))) setFeeThreshold(parseFloat(tSet.value));

                const uSet = settingsRes.data.find(s => s.key === 'funding_fee_under_threshold');
                if (uSet && !isNaN(parseFloat(uSet.value))) setFeeUnder(parseFloat(uSet.value));

                const aSet = settingsRes.data.find(s => s.key === 'funding_fee_above_threshold');
                if (aSet && !isNaN(parseFloat(aSet.value))) setFeeAbove(parseFloat(aSet.value));
            }

            hasLoadedOnce.current = true;
        } catch (error) {
            console.error("Error fetching wallet data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        fetchWalletData();
    };

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text);
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (Platform.OS === 'web') alert('Account Number Copied to Clipboard!');
        else Alert.alert("Copied!", "Account number copied to clipboard.");
    };

    const formatCurrency = (val?: number | string) => {
        if (val === undefined || val === null) return ['0', '00'];
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return ['0', '00'];
        const formatted = num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return formatted.split('.');
    };

    const formatTxDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 1 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } else if (diffDays <= 2 && date.getDate() === now.getDate() - 1) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'deposit':
                return { name: 'arrow-down-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
            case 'withdrawal':
            case 'transfer':
                return { name: 'arrow-up-circle', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
            default:
                return { name: 'receipt', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
        }
    };

    const getTransactionLabel = (tx: any) => {
        if (tx.description) return tx.description;
        switch (tx.type) {
            case 'deposit':
                return 'Wallet Funding';
            case 'withdrawal':
                return 'Wallet Withdrawal';
            case 'transfer':
                return 'Fund Transfer';
            default:
                return 'Service Purchase';
        }
    };

    const [balanceWhole, balanceDecimal] = formatCurrency(balance);

    if (loading && !refreshing) {
        return (
            <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={s.centerContainer}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={s.loadingText}>Securing Wallet Session...</Text>
            </LinearGradient>
        );
    }

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Executive Royal Navy Header Banner */}
            <LinearGradient colors={['#020617', '#0F172A', '#1E293B']} style={s.headerContainer}>
                <View style={s.headerNavRow}>
                    <View style={s.brandCol}>
                        <Image
                            source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                            style={s.headerLogo}
                            resizeMode="contain"
                        />
                        <View>
                            <Text style={s.brandTitle}>ABU MAFHAL</Text>
                            <Text style={s.brandSub}>FINTECH HUB 👑</Text>
                        </View>
                    </View>

                    <View style={s.headerIconsRow}>
                        <TouchableOpacity onPress={() => router.push('/notifications')} style={s.iconBadgeBtn} activeOpacity={0.75}>
                            <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                            <View style={s.badgeDot} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/profile')} style={s.iconBadgeBtn} activeOpacity={0.75}>
                            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={s.screenTitle}>My Wallet & Funding</Text>
            </LinearGradient>

            {/* 3D Floating Executive Balance Card */}
            <View style={s.balanceCardWrapper}>
                <LinearGradient
                    colors={['#0B132B', '#1C2541', '#0F172A']}
                    style={s.balanceCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Glowing Accent Ring */}
                    <View style={s.cardGlowRing} />

                    <View style={s.cardTopRow}>
                        <View style={s.balanceTitleRow}>
                            <Text style={s.balanceTitleText}>TOTAL AVAILABLE BALANCE</Text>
                            <TouchableOpacity onPress={() => setShowBalance(!showBalance)} activeOpacity={0.7} style={s.eyeBtn}>
                                <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={16} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>

                        <View style={s.statusPill}>
                            <View style={s.statusDot} />
                            <Text style={s.statusPillText}>Active & Secured</Text>
                        </View>
                    </View>

                    {/* Numeric Balance Display */}
                    <View style={s.balanceAmountRow}>
                        <Text style={s.currencySymbol}>₦</Text>
                        {showBalance ? (
                            <View style={s.balanceValueRow}>
                                <Text style={s.balanceMainText}>{balanceWhole}</Text>
                                <Text style={s.balanceDecText}>.{balanceDecimal}</Text>
                            </View>
                        ) : (
                            <Text style={s.balanceMainText}>••••••••</Text>
                        )}
                    </View>

                    {/* Quick Action Buttons */}
                    <View style={s.actionButtonsRow}>
                        <TouchableOpacity
                            onPress={() => setFundModalVisible(true)}
                            style={s.fundWalletBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="add-circle" size={18} color="#020617" />
                            <Text style={s.fundWalletBtnText}>Add Funds</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/transfer')}
                            style={s.withdrawBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-up-circle" size={18} color="#F59E0B" />
                            <Text style={s.withdrawBtnText}>Transfer</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            {/* Scrollable Content Body */}
            <ScrollView
                style={s.scrollBody}
                contentContainerStyle={s.scrollContentPadding}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F59E0B" />
                }
            >
                {/* Dynamic Promotional Banners */}
                <DynamicBanners placement="wallet" />

                {/* Dedicated Virtual Bank Account Card */}
                <View style={s.sectionBox}>
                    <Text style={s.sectionHeaderTitle}>Automated Dedicated Bank Account</Text>

                    {virtualAccount ? (
                        <View style={s.virtualBankCard}>
                            <View style={s.vCardHeader}>
                                <View style={s.bankNamePill}>
                                    <Text style={s.bankNameText}>{virtualAccount.bank_name}</Text>
                                </View>
                                <Ionicons name="card" size={22} color="#F59E0B" />
                            </View>

                            <View style={s.acctNumCol}>
                                <Text style={s.acctNumLabel}>Dedicated Account Number</Text>
                                <View style={s.acctNumDisplayRow}>
                                    <Text style={s.acctNumText}>
                                        {virtualAccount.account_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(virtualAccount.account_number)}
                                        style={s.copyIconBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="copy-outline" size={16} color="#F59E0B" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={s.acctHolderCol}>
                                <Text style={s.acctHolderLabel}>Account Holder Name</Text>
                                <Text style={s.acctHolderName} numberOfLines={1}>
                                    {virtualAccount.account_name}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={s.noVirtualAcctCard}>
                            <View style={s.noAcctIconBox}>
                                <Ionicons name="shield-checkmark" size={26} color="#64748B" />
                            </View>
                            <Text style={s.noAcctTitle}>No Dedicated Virtual Account Yet</Text>
                            <Text style={s.noAcctSubtitle}>
                                Complete your KYC Identity Verification to generate a dedicated automated funding bank account instantly!
                            </Text>
                            <TouchableOpacity
                                onPress={() => router.push('/kyc')}
                                style={s.verifyKycBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.verifyKycBtnText}>Verify Identity (KYC)</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Deposit Fee Structure Information Box */}
                    <View style={s.depositFeeBox}>
                        <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={s.feeBoxHeader}>Automated Deposit Fee Structure:</Text>
                            <Text style={s.feeBoxText}>
                                • Deposits under <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()}</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>₦{feeUnder} fixed fee</Text>
                            </Text>
                            <Text style={[s.feeBoxText, { marginTop: 3 }]}>
                                • Deposits <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()} and above</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>{feeAbove}% fee</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Financial KPI Summary Cards */}
                <View style={s.kpiGridRow}>
                    <View style={[s.kpiCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                        <View style={[s.kpiIconCircle, { backgroundColor: '#10B981' }]}>
                            <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.kpiLabel}>Total Deposits</Text>
                            <Text style={[s.kpiValue, { color: '#047857' }]} numberOfLines={1}>
                                ₦{totalIn.toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                            </Text>
                        </View>
                    </View>

                    <View style={[s.kpiCard, { backgroundColor: '#FEF2F2', borderColor: '#FECDD3' }]}>
                        <View style={[s.kpiIconCircle, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.kpiLabel}>Total Spent</Text>
                            <Text style={[s.kpiValue, { color: '#B91C1C' }]} numberOfLines={1}>
                                ₦{totalOut.toLocaleString('en-NG', { minimumFractionDigits: 0 })}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Recent Transactions Section */}
                <View style={s.sectionBox}>
                    <View style={s.recentHeaderRow}>
                        <Text style={s.sectionHeaderTitle}>Recent Transactions</Text>
                        <TouchableOpacity onPress={() => router.push('/history')} activeOpacity={0.7}>
                            <Text style={s.seeAllLinkText}>See All History ›</Text>
                        </TouchableOpacity>
                    </View>

                    {recentTransactions.length > 0 ? (
                        <View style={s.txListCard}>
                            {recentTransactions.map((tx: any, index: number) => {
                                const isDeposit = tx.type === 'deposit';
                                const iconConfig = getTransactionIcon(tx.type);

                                return (
                                    <View
                                        key={tx.id || index}
                                        style={[
                                            s.txItemRow,
                                            index === recentTransactions.length - 1 && { borderBottomWidth: 0 },
                                        ]}
                                    >
                                        <View style={s.txLeftCol}>
                                            <View style={[s.txIconCircle, { backgroundColor: iconConfig.bg }]}>
                                                <Ionicons name={iconConfig.name as any} size={18} color={iconConfig.color} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.txTitleText} numberOfLines={1}>
                                                    {getTransactionLabel(tx)}
                                                </Text>
                                                <Text style={s.txDateText} numberOfLines={1}>
                                                    {formatTxDate(tx.created_at)}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={s.txRightCol}>
                                            <Text style={[s.txAmountText, { color: isDeposit ? '#10B981' : '#0F172A' }]}>
                                                {isDeposit ? '+' : '-'} ₦{parseFloat(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                            </Text>

                                            <View style={[s.txStatusPill, { backgroundColor: tx.status === 'success' ? '#ECFDF5' : tx.status === 'failed' ? '#FEF2F2' : '#FEF3C7' }]}>
                                                <Text style={[s.txStatusPillText, { color: tx.status === 'success' ? '#047857' : tx.status === 'failed' ? '#B91C1C' : '#B45309' }]}>
                                                    {tx.status}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={s.emptyTxBox}>
                            <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
                            <Text style={s.emptyTxTitle}>No Recent Transactions</Text>
                            <Text style={s.emptyTxSub}>Your recent deposits and purchases will appear here.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* FUND WALLET INTERACTIVE MODAL OVERLAY */}
            <Modal
                visible={fundModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setFundModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setFundModalVisible(false)} activeOpacity={1} />

                    <View style={s.modalSheetContainer}>
                        <View style={s.modalDragBar} />

                        <View style={s.modalHeaderRow}>
                            <Text style={s.modalTitleText}>Fund Wallet</Text>
                            <TouchableOpacity onPress={() => setFundModalVisible(false)} style={s.modalCloseIconBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Method Selector Tabs */}
                        <View style={s.modalMethodTabs}>
                            <TouchableOpacity
                                onPress={() => setFundMethod('transfer')}
                                style={[s.modalMethodTab, fundMethod === 'transfer' && s.modalMethodTabActive]}
                            >
                                <Ionicons name="business" size={16} color={fundMethod === 'transfer' ? '#0F172A' : '#64748B'} />
                                <Text style={[s.modalMethodTabText, fundMethod === 'transfer' && s.modalMethodTabTextActive]}>Bank Transfer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setFundMethod('card')}
                                style={[s.modalMethodTab, fundMethod === 'card' && s.modalMethodTabActive]}
                            >
                                <Ionicons name="card" size={16} color={fundMethod === 'card' ? '#0F172A' : '#64748B'} />
                                <Text style={[s.modalMethodTabText, fundMethod === 'card' && s.modalMethodTabTextActive]}>Debit Card / Paystack</Text>
                            </TouchableOpacity>
                        </View>

                        {fundMethod === 'transfer' ? (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <Text style={s.modalInstructionText}>
                                    Transfer directly to your dedicated automated account below. Your wallet will be credited instantly upon confirmation!
                                </Text>

                                {virtualAccount ? (
                                    <View style={s.modalBankCard}>
                                        <View style={s.mBankPill}>
                                            <Text style={s.mBankPillText}>{virtualAccount.bank_name}</Text>
                                        </View>

                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={s.mLabelText}>Account Number</Text>
                                            <View style={s.mNumRow}>
                                                <Text style={s.mNumText}>
                                                    {virtualAccount.account_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                                                </Text>
                                                <TouchableOpacity onPress={() => copyToClipboard(virtualAccount.account_number)} style={s.mCopyBtn}>
                                                    <Ionicons name="copy-outline" size={16} color="#F59E0B" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View>
                                            <Text style={s.mLabelText}>Account Name</Text>
                                            <Text style={s.mNameText}>{virtualAccount.account_name}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={s.modalNoAcctBox}>
                                        <Text style={s.modalNoAcctTitle}>No Dedicated Virtual Account</Text>
                                        <Text style={s.modalNoAcctSub}>Please complete your identity verification to generate a dedicated bank account.</Text>
                                    </View>
                                )}

                                <View style={s.depositFeeBox}>
                                    <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginTop: 2 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.feeBoxHeader}>Automated Deposit Fee Structure:</Text>
                                        <Text style={s.feeBoxText}>
                                            • Deposits under <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()}</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>₦{feeUnder} fixed fee</Text>
                                        </Text>
                                        <Text style={[s.feeBoxText, { marginTop: 3 }]}>
                                            • Deposits <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()} and above</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>{feeAbove}% fee</Text>
                                        </Text>
                                    </View>
                                </View>
                            </ScrollView>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <Text style={s.modalInstructionText}>
                                    Fund your wallet instantly using your Debit Card or Bank USSD via Paystack.
                                </Text>

                                <View style={s.amountInputContainer}>
                                    <Text style={s.amountInputHeader}>ENTER FUNDING AMOUNT</Text>
                                    <View style={s.amountInputFlexRow}>
                                        <Text style={s.currencyPrefix}>₦</Text>
                                        <TextInput
                                            value={fundAmount}
                                            onChangeText={setFundAmount}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor="#94A3B8"
                                            style={s.amountInputField}
                                        />
                                    </View>
                                </View>

                                {/* Live Calculator Breakdown */}
                                {parseFloat(fundAmount) > 0 && (
                                    <View style={s.liveCalcCard}>
                                        <View style={s.liveCalcRow}>
                                            <Text style={s.liveCalcLabel}>Deposit Amount:</Text>
                                            <Text style={s.liveCalcVal}>₦{parseFloat(fundAmount).toLocaleString()}</Text>
                                        </View>

                                        <View style={s.liveCalcRow}>
                                            <Text style={s.liveCalcLabel}>
                                                Deposit Fee ({parseFloat(fundAmount) < feeThreshold ? `Fixed ₦${feeUnder}` : `${feeAbove}%`}):
                                            </Text>
                                            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>
                                                -₦{(parseFloat(fundAmount) < feeThreshold ? feeUnder : parseFloat(fundAmount) * (feeAbove / 100)).toLocaleString()}
                                            </Text>
                                        </View>

                                        <View style={s.liveCalcDivider} />

                                        <View style={[s.liveCalcRow, { marginTop: 4 }]}>
                                            <Text style={s.liveCalcNetLabel}>Net Wallet Credit:</Text>
                                            <Text style={s.liveCalcNetVal}>
                                                ₦{Math.max(0, parseFloat(fundAmount) - (parseFloat(fundAmount) < feeThreshold ? feeUnder : parseFloat(fundAmount) * (feeAbove / 100))).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={() => {
                                        if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) < 100) {
                                            Alert.alert("Invalid Amount", "Please enter an amount of at least ₦100.");
                                            return;
                                        }
                                        if (!paystackKey) {
                                            Alert.alert("Configuration Error", "Paystack public key is not configured.");
                                            return;
                                        }
                                        setPaystackVisible(true);
                                        setFundModalVisible(false);
                                    }}
                                    style={s.submitPayBtn}
                                    activeOpacity={0.85}
                                >
                                    <Text style={s.submitPayBtnText}>Proceed to Pay ₦{fundAmount || '0.00'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Paystack Modal Handler */}
            {paystackVisible && paystackKey && (
                <PaystackPayment
                    visible={paystackVisible}
                    amount={Number(fundAmount)}
                    email={userEmail || 'user@example.com'}
                    publicKey={paystackKey}
                    onSuccess={() => {
                        Alert.alert("Payment Successful", "Your wallet will be credited shortly.");
                        setFundAmount('');
                        setTimeout(() => fetchWalletData(), 3000);
                    }}
                    onCancel={() => Alert.alert("Payment Cancelled", "Transaction was cancelled.")}
                    onClose={() => setPaystackVisible(false)}
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#F59E0B',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 12,
    },
    headerContainer: {
        paddingTop: Platform.OS === 'android' ? 44 : 54,
        paddingBottom: 36,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        borderBottomWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    brandCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerLogo: {
        width: 28,
        height: 28,
    },
    brandTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    brandSub: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1,
    },
    headerIconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconBadgeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    badgeDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F59E0B',
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.4,
    },
    balanceCardWrapper: {
        paddingHorizontal: 20,
        marginTop: -26,
        marginBottom: 16,
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
        zIndex: 30,
    },
    balanceCard: {
        borderRadius: 24,
        padding: 20,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        borderWidth: 1.5,
        position: 'relative',
        overflow: 'hidden',
    },
    cardGlowRing: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    balanceTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    balanceTitleText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    eyeBtn: {
        padding: 2,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    statusPillText: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '800',
    },
    balanceAmountRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    currencySymbol: {
        color: '#F59E0B',
        fontSize: 22,
        fontWeight: '900',
        marginRight: 4,
    },
    balanceValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    balanceMainText: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    balanceDecText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 18,
        fontWeight: '800',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    fundWalletBtn: {
        flex: 1,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    fundWalletBtnText: {
        color: '#020617',
        fontSize: 12.5,
        fontWeight: '900',
    },
    withdrawBtn: {
        flex: 1,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    withdrawBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '800',
    },
    scrollBody: {
        flex: 1,
    },
    scrollContentPadding: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    sectionBox: {
        marginBottom: 16,
    },
    sectionHeaderTitle: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 10,
        letterSpacing: -0.2,
    },
    virtualBankCard: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
    },
    vCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    bankNamePill: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    bankNameText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    acctNumCol: {
        marginBottom: 12,
    },
    acctNumLabel: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    acctNumDisplayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    acctNumText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    copyIconBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 6,
        borderRadius: 8,
    },
    acctHolderCol: {},
    acctHolderLabel: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    acctHolderName: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    noVirtualAcctCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    noAcctIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    noAcctTitle: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 4,
    },
    noAcctSubtitle: {
        color: '#64748B',
        fontSize: 11.5,
        textAlign: 'center',
        marginBottom: 14,
        lineHeight: 16,
    },
    verifyKycBtn: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    verifyKycBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    depositFeeBox: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    feeBoxHeader: {
        color: '#B45309',
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 2,
    },
    feeBoxText: {
        color: '#92400E',
        fontSize: 11,
        lineHeight: 16,
    },
    kpiGridRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    kpiCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    kpiIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiLabel: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    kpiValue: {
        fontSize: 13,
        fontWeight: '900',
        marginTop: 1,
    },
    recentHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    seeAllLinkText: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '800',
    },
    txListCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    txItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    txLeftCol: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    txIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txTitleText: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '800',
    },
    txDateText: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    txRightCol: {
        alignItems: 'flex-end',
    },
    txAmountText: {
        fontSize: 12.5,
        fontWeight: '900',
    },
    txStatusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    txStatusPillText: {
        fontSize: 8.5,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyTxBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyTxTitle: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 6,
    },
    emptyTxSub: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'flex-end',
    },
    modalSheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        borderTopWidth: 3,
        borderColor: '#F59E0B',
        maxHeight: '80%',
    },
    modalDragBar: {
        width: 42,
        height: 5,
        backgroundColor: '#CBD5E1',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 14,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    modalTitleText: {
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '900',
    },
    modalCloseIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalMethodTabs: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 4,
        borderRadius: 14,
        marginBottom: 16,
        gap: 6,
    },
    modalMethodTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    modalMethodTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    modalMethodTabText: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '700',
    },
    modalMethodTabTextActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    modalInstructionText: {
        color: '#64748B',
        fontSize: 11.5,
        lineHeight: 16,
        marginBottom: 14,
        textAlign: 'center',
    },
    modalBankCard: {
        backgroundColor: '#0F172A',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    mBankPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 12,
    },
    mBankPillText: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '900',
    },
    mLabelText: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    mNumRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mNumText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
    mCopyBtn: {
        padding: 4,
    },
    mNameText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    modalNoAcctBox: {
        padding: 20,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 14,
    },
    modalNoAcctTitle: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
    },
    modalNoAcctSub: {
        color: '#64748B',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 2,
    },
    amountInputContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    amountInputHeader: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 6,
    },
    amountInputFlexRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencyPrefix: {
        color: '#0F172A',
        fontSize: 22,
        fontWeight: '900',
        marginRight: 4,
    },
    amountInputField: {
        flex: 1,
        color: '#0F172A',
        fontSize: 22,
        fontWeight: '900',
    },
    liveCalcCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    liveCalcRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    liveCalcLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
    },
    liveCalcVal: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '700',
    },
    liveCalcDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 4,
    },
    liveCalcNetLabel: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    liveCalcNetVal: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '900',
    },
    submitPayBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitPayBtnText: {
        color: '#F59E0B',
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
});
