import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Alert,
    Image,
    StyleSheet,
    TextInput,
    Platform,
    Modal,
    ActivityIndicator,
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

export default function WalletScreen() {
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [virtualAccounts, setVirtualAccounts] = useState<any[]>([]);
    const [userBvn, setUserBvn] = useState<string | null>(null);
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    
    // Dynamic Fee Thresholds
    const [feeThreshold, setFeeThreshold] = useState(5000);
    const [feeUnder, setFeeUnder] = useState(50);
    const [feeAbove, setFeeAbove] = useState(1);

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
    const [currentUserId, setCurrentUserId] = useState('');
    const [verifyingPayment, setVerifyingPayment] = useState(false);
    const [verifyStatusText, setVerifyStatusText] = useState('Tabbatar da biya...');

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
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setCurrentUserId(user.id);

            const [profileRes, vAccountsRes, statsRes, recentRes, settingsRes] = await Promise.all([
                supabase.from('profiles').select('balance, bvn, kyc_tier').eq('id', user.id).single(),
                supabase.from('virtual_accounts').select('id, bank_name, account_number, account_name, created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
                supabase.from('transactions').select('amount, type').eq('user_id', user.id).eq('status', 'success').order('created_at', { ascending: false }).limit(200),
                supabase.from('transactions').select('id, amount, type, status, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
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
                setUserBvn(profileRes.data.bvn || null);
            }

            const accounts = vAccountsRes.data || [];
            setVirtualAccounts(accounts);
            setVirtualAccount(accounts[0] || null);

            // Auto-trigger creation if user has no virtual account
            if (accounts.length === 0) {
                supabase.functions.invoke('create-virtual-account', { body: { userId: user.id } })
                    .then(async (res) => {
                        if (res.data?.accounts && res.data.accounts.length > 0) {
                            setVirtualAccounts(res.data.accounts);
                            setVirtualAccount(res.data.accounts[0]);
                        } else {
                            const { data: refreshed } = await supabase.from('virtual_accounts').select('id, bank_name, account_number, account_name, created_at').eq('user_id', user.id).order('created_at', { ascending: true });
                            if (refreshed && refreshed.length > 0) {
                                setVirtualAccounts(refreshed);
                                setVirtualAccount(refreshed[0]);
                            }
                        }
                    })
                    .catch(console.error);
            } else if (accounts.length === 1 && profileRes.data?.bvn) {
                // If user has BVN and only 1 account, trigger 2nd account generation
                supabase.functions.invoke('create-virtual-account', { body: { userId: user.id, bvn: profileRes.data.bvn, forceSecondAccount: true } })
                    .then(async (res) => {
                        if (res.data?.accounts && res.data.accounts.length > 1) {
                            setVirtualAccounts(res.data.accounts);
                        }
                    })
                    .catch(console.error);
            }

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
        } catch (error) {
            console.error("Error fetching wallet data:", error);
        } finally {
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
        if (Platform.OS === 'web') alert('Account Number Copied!');
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

    const handlePaystackSuccess = async (response: any) => {
        try {
            setPaystackVisible(false);
            setVerifyingPayment(true);
            setVerifyStatusText('Muna tabbatar da kudi tare da Paystack...');

            const reference = response?.reference || response?.trxref || response?.transaction;
            console.log('[Paystack] Payment client success callback, reference:', reference);

            if (!reference) {
                Alert.alert("Sanarwa", "An kammala biya. Da fatan za a duba wallet bayan 'yan dakiku.");
                await fetchWalletData();
                return;
            }

            // Call edge function verify_paystack directly for immediate crediting
            const { data, error } = await supabase.functions.invoke('payment-webhook', {
                body: {
                    action: 'verify_paystack',
                    reference: reference,
                    userId: currentUserId,
                    amount: Number(fundAmount) || 0,
                }
            });

            console.log('[Paystack] Verification invoke result:', data, error);

            if (error) {
                console.error('[Paystack] Verification invoke error:', error);
                Alert.alert(
                    "Ana Kan Aiki",
                    "An karɓi biyan ku daga banki. Tsarin zai saka kudin a wallet dinku ta atomatik ta webhook.",
                    [{ text: "To", onPress: () => fetchWalletData() }]
                );
                return;
            }

            if (data?.success) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                const creditedAmount = data.amount !== undefined ? data.amount : fundAmount;
                const newBalMsg = data.new_balance !== undefined ? `\nSabon Balance: ₦${Number(data.new_balance).toLocaleString()}` : '';
                Alert.alert(
                    "An Saka Kuɗi A Wallet! 🎉",
                    `An yi nasarar tabbatarwa tare da saka ₦${Number(creditedAmount).toLocaleString()} a cikin wallet ɗinku.${newBalMsg}`,
                    [{ text: "Madalla", onPress: () => fetchWalletData() }]
                );
                setFundAmount('');
                await fetchWalletData();
            } else {
                Alert.alert(
                    "Sanarwa",
                    data?.message || "Ba a kammala tabbatarwa ba tukuna. Idan an cire kudin a banki, za a zuba shi ta atomatik.",
                    [{ text: "To", onPress: () => fetchWalletData() }]
                );
            }
        } catch (err: any) {
            console.error('[Paystack] Verification catch error:', err);
            Alert.alert(
                "Sanarwa",
                "Kudin ku ya fita. Tsarin zai saka shi a wallet ta atomatik cikin kankanin lokaci.",
                [{ text: "To", onPress: () => fetchWalletData() }]
            );
            await fetchWalletData();
        } finally {
            setVerifyingPayment(false);
        }
    };

    const [balanceWhole, balanceDecimal] = formatCurrency(balance);

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Decorative Gold Top Accent Line */}
            <View style={s.topGoldLine} />

            {/* Header Banner */}
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
                            <Text style={s.brandSub}>HUB 👑</Text>
                        </View>
                    </View>

                    <View style={s.headerIconsRow}>
                        <TouchableOpacity onPress={() => router.push('/notifications')} style={s.iconBadgeBtn} activeOpacity={0.75}>
                            <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
                            <View style={s.badgeDot} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/profile')} style={s.iconBadgeBtn} activeOpacity={0.75}>
                            <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={s.screenTitle}>My Wallet</Text>
            </LinearGradient>

            {/* Decorated Floating Balance Card */}
            <View style={s.balanceCardWrapper}>
                <LinearGradient
                    colors={['#0B132B', '#1C2541', '#0F172A']}
                    style={s.balanceCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Decorative Ambient Radial Glow Circle */}
                    <View style={s.ambientGlowCircle} />

                    <View style={s.cardTopRow}>
                        <View style={s.balanceTitleRow}>
                            <View style={s.goldCoinBadge}>
                                <Text style={s.goldCoinBadgeText}>₦</Text>
                            </View>
                            <Text style={s.balanceTitleText}>AVAILABLE BALANCE</Text>
                            <TouchableOpacity onPress={() => setShowBalance(!showBalance)} activeOpacity={0.7} style={s.eyeBtn}>
                                <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={14} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>

                        <View style={s.statusPill}>
                            <View style={s.statusDot} />
                            <Text style={s.statusPillText}>Active</Text>
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
                            <Ionicons name="add-circle" size={16} color="#020617" />
                            <Text style={s.fundWalletBtnText}>Add Funds</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/transfer')}
                            style={s.withdrawBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-up-circle" size={16} color="#F59E0B" />
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
                {/* Dynamic Banners */}
                <DynamicBanners placement="wallet" />

                {/* Automated Dedicated Bank Accounts (Dual / Multi Bank Support) */}
                <View style={s.sectionBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={s.sectionHeaderTitle}>
                            Automated Dedicated Bank Account{virtualAccounts.length > 1 ? 's' : ''}
                        </Text>
                        {virtualAccounts.length > 1 && (
                            <View style={[s.instantDepositTag, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                <Text style={[s.instantDepositText, { color: '#047857' }]}>{virtualAccounts.length} Active Accounts</Text>
                            </View>
                        )}
                    </View>

                    {virtualAccounts.length > 0 ? (
                        <View style={{ gap: 10 }}>
                            {virtualAccounts.map((va, idx) => (
                                <View key={va.id || idx} style={s.virtualBankCard}>
                                    <View style={s.vCardTopRow}>
                                        <View style={s.bankNamePill}>
                                            <Ionicons name="business-outline" size={11} color="#F59E0B" style={{ marginRight: 4 }} />
                                            <Text style={s.bankNameText}>
                                                {va.bank_name} {idx === 0 ? '(Account 1)' : idx === 1 ? '(Account 2)' : ''}
                                            </Text>
                                        </View>

                                        <View style={s.instantDepositTag}>
                                            <View style={s.greenLiveDot} />
                                            <Text style={s.instantDepositText}>Instant Auto-Credit</Text>
                                        </View>
                                    </View>

                                    <View style={s.acctNumRowCompact}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.acctNumLabel}>ACCOUNT NUMBER</Text>
                                            <Text style={s.acctNumTextCompact}>
                                                {va.account_number ? va.account_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : '•••• •••• ••'}
                                            </Text>
                                            <Text style={s.acctHolderNameSub} numberOfLines={1}>
                                                Holder: {va.account_name || 'ABU MAFHAL SUB'}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => copyToClipboard(va.account_number)}
                                            style={s.copyPillBtn}
                                            activeOpacity={0.75}
                                        >
                                            <Ionicons name="copy-outline" size={12} color="#F59E0B" style={{ marginRight: 3 }} />
                                            <Text style={s.copyPillBtnText}>Copy</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            {/* Prompt to unlock 2nd account if user only has 1 account and no BVN yet */}
                            {virtualAccounts.length === 1 && !userBvn && (
                                <TouchableOpacity
                                    onPress={() => router.push('/kyc')}
                                    style={s.bvnUnlockCard}
                                    activeOpacity={0.85}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={s.bvnIconBadge}>
                                            <Ionicons name="sparkles" size={14} color="#D97706" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.bvnUnlockTitle}>Unlock 2nd Bank Account (PalmPay / 9PSB)</Text>
                                            <Text style={s.bvnUnlockSub}>
                                                Verify your BVN in KYC to instantly generate your 2nd dedicated account number!
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#D97706" />
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <View style={s.noVirtualAcctCard}>
                            <View style={s.noAcctIconBox}>
                                <Ionicons name="shield-checkmark" size={20} color="#64748B" />
                            </View>
                            <Text style={s.noAcctTitle}>Generating Dedicated Virtual Account...</Text>
                            <Text style={s.noAcctSubtitle}>
                                Your dedicated automated funding bank account is being provisioned. Tap below to verify KYC or refresh.
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

                    {/* Deposit Fee Structure Callout */}
                    <View style={s.depositFeeBox}>
                        <Ionicons name="information-circle" size={16} color="#D97706" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={s.feeBoxHeader}>Automated Deposit Fee Rule:</Text>
                            <Text style={s.feeBoxText}>
                                • Under <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()}</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>₦{feeUnder} fee</Text> | <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()}+</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>{feeAbove}% fee</Text>
                            </Text>
                        </View>
                    </View>
                </View>


                {/* Compact Financial KPI Summary */}
                <View style={s.kpiGridRow}>
                    <View style={[s.kpiCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                        <View style={[s.kpiIconCircle, { backgroundColor: '#10B981' }]}>
                            <Ionicons name="arrow-down" size={14} color="#FFFFFF" />
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
                            <Ionicons name="arrow-up" size={14} color="#FFFFFF" />
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
                            <Text style={s.seeAllLinkText}>See All ›</Text>
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
                                                <Ionicons name={iconConfig.name as any} size={15} color={iconConfig.color} />
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
                            <Ionicons name="receipt-outline" size={24} color="#94A3B8" />
                            <Text style={s.emptyTxTitle}>No Recent Transactions</Text>
                            <Text style={s.emptyTxSub}>Your recent transactions will appear here.</Text>
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
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Method Selector Tabs */}
                        <View style={s.modalMethodTabs}>
                            <TouchableOpacity
                                onPress={() => setFundMethod('transfer')}
                                style={[s.modalMethodTab, fundMethod === 'transfer' && s.modalMethodTabActive]}
                            >
                                <Ionicons name="business" size={14} color={fundMethod === 'transfer' ? '#0F172A' : '#64748B'} />
                                <Text style={[s.modalMethodTabText, fundMethod === 'transfer' && s.modalMethodTabTextActive]}>Bank Transfer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setFundMethod('card')}
                                style={[s.modalMethodTab, fundMethod === 'card' && s.modalMethodTabActive]}
                            >
                                <Ionicons name="card" size={14} color={fundMethod === 'card' ? '#0F172A' : '#64748B'} />
                                <Text style={[s.modalMethodTabText, fundMethod === 'card' && s.modalMethodTabTextActive]}>Card / Paystack</Text>
                            </TouchableOpacity>
                        </View>

                        {fundMethod === 'transfer' ? (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <Text style={s.modalInstructionText}>
                                    Transfer directly to any of your dedicated automated accounts below. Wallet credits instantly!
                                </Text>

                                {virtualAccounts.length > 0 ? (
                                    <View style={{ gap: 12, marginBottom: 12 }}>
                                        {virtualAccounts.map((va, idx) => (
                                            <View key={va.id || idx} style={s.modalBankCard}>
                                                <View style={s.mBankPill}>
                                                    <Text style={s.mBankPillText}>
                                                        {va.bank_name} {idx === 0 ? '(Account 1)' : idx === 1 ? '(Account 2)' : ''}
                                                    </Text>
                                                </View>

                                                <View style={{ marginBottom: 10 }}>
                                                    <Text style={s.mLabelText}>ACCOUNT NUMBER</Text>
                                                    <View style={s.mNumRow}>
                                                        <Text style={s.mNumText}>
                                                            {va.account_number ? va.account_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : '•••• •••• ••'}
                                                        </Text>
                                                        <TouchableOpacity onPress={() => copyToClipboard(va.account_number)} style={s.mCopyBtn}>
                                                            <Ionicons name="copy-outline" size={15} color="#F59E0B" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                <View>
                                                    <Text style={s.mLabelText}>ACCOUNT NAME</Text>
                                                    <Text style={s.mNameText}>{va.account_name || 'ABU MAFHAL SUB'}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ) : virtualAccount ? (
                                    <View style={s.modalBankCard}>
                                        <View style={s.mBankPill}>
                                            <Text style={s.mBankPillText}>{virtualAccount.bank_name}</Text>
                                        </View>

                                        <View style={{ marginBottom: 10 }}>
                                            <Text style={s.mLabelText}>ACCOUNT NUMBER</Text>
                                            <View style={s.mNumRow}>
                                                <Text style={s.mNumText}>
                                                    {virtualAccount.account_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                                                </Text>
                                                <TouchableOpacity onPress={() => copyToClipboard(virtualAccount.account_number)} style={s.mCopyBtn}>
                                                    <Ionicons name="copy-outline" size={15} color="#F59E0B" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View>
                                            <Text style={s.mLabelText}>ACCOUNT NAME</Text>
                                            <Text style={s.mNameText}>{virtualAccount.account_name}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={s.modalNoAcctBox}>
                                        <Text style={s.modalNoAcctTitle}>Generating Dedicated Account...</Text>
                                        <Text style={s.modalNoAcctSub}>Please complete your identity verification to generate a bank account.</Text>
                                    </View>
                                )}

                                <View style={s.depositFeeBox}>
                                    <Ionicons name="information-circle" size={16} color="#D97706" style={{ marginTop: 1 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.feeBoxHeader}>Automated Deposit Fee Rule:</Text>
                                        <Text style={s.feeBoxText}>
                                            • Under <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()}</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>₦{feeUnder} fee</Text> | <Text style={{ fontWeight: 'bold' }}>₦{feeThreshold.toLocaleString()}+</Text>: <Text style={{ fontWeight: 'bold', color: '#B45309' }}>{feeAbove}% fee</Text>
                                        </Text>
                                    </View>
                                </View>

                            </ScrollView>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <Text style={s.modalInstructionText}>
                                    Fund your wallet instantly using Debit Card or USSD via Paystack.
                                </Text>

                                <View style={s.amountInputContainer}>
                                    <Text style={s.amountInputHeader}>FUNDING AMOUNT</Text>
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
                                            <Text style={{ color: '#EF4444', fontSize: 10.5, fontWeight: '700' }}>
                                                -₦{(parseFloat(fundAmount) < feeThreshold ? feeUnder : parseFloat(fundAmount) * (feeAbove / 100)).toLocaleString()}
                                            </Text>
                                        </View>

                                        <View style={s.liveCalcDivider} />

                                        <View style={[s.liveCalcRow, { marginTop: 2 }]}>
                                            <Text style={s.liveCalcNetLabel}>Net Credit:</Text>
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
                    userId={currentUserId}
                    publicKey={paystackKey}
                    onSuccess={handlePaystackSuccess}
                    onCancel={() => Alert.alert("An Soke Biya", "An fasa biyan kudin.")}
                    onClose={() => setPaystackVisible(false)}
                />
            )}

            {/* Payment Verifying Loading Modal */}
            <Modal
                visible={verifyingPayment}
                transparent={true}
                animationType="fade"
            >
                <View style={s.verifyModalBackdrop}>
                    <View style={s.verifyModalCard}>
                        <View style={s.verifyIconCircle}>
                            <ActivityIndicator size="large" color="#F59E0B" />
                        </View>
                        <Text style={s.verifyTitle}>Tabbatar Da Biya...</Text>
                        <Text style={s.verifySub}>
                            {verifyStatusText || 'Muna tabbatar da biyan ku daga Paystack tare da zuba kudin a wallet dinku nan take...'}
                        </Text>
                        <View style={s.verifyWarningBadge}>
                            <Ionicons name="shield-checkmark" size={15} color="#10B981" />
                            <Text style={s.verifyWarningText}>Kada ku rufe app din har sai an gama</Text>
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
    topGoldLine: {
        height: 2.5,
        backgroundColor: '#F59E0B',
    },
    headerContainer: {
        paddingTop: Platform.OS === 'android' ? 32 : 42,
        paddingBottom: 24,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
        borderBottomWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    headerNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    brandCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerLogo: {
        width: 24,
        height: 24,
    },
    brandTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    brandSub: {
        color: '#F59E0B',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    headerIconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconBadgeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    badgeDot: {
        position: 'absolute',
        top: 5,
        right: 5,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F59E0B',
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    balanceCardWrapper: {
        paddingHorizontal: 16,
        marginTop: -18,
        marginBottom: 12,
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        zIndex: 30,
    },
    balanceCard: {
        borderRadius: 18,
        padding: 14,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        borderWidth: 1.2,
        position: 'relative',
        overflow: 'hidden',
    },
    ambientGlowCircle: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    balanceTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    goldCoinBadge: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    goldCoinBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900',
    },
    balanceTitleText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    eyeBtn: {
        padding: 2,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
    },
    statusPillText: {
        color: '#10B981',
        fontSize: 8.5,
        fontWeight: '800',
    },
    balanceAmountRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    currencySymbol: {
        color: '#F59E0B',
        fontSize: 18,
        fontWeight: '900',
        marginRight: 3,
    },
    balanceValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    balanceMainText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.4,
    },
    balanceDecText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 15,
        fontWeight: '800',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    fundWalletBtn: {
        flex: 1,
        height: 38,
        borderRadius: 11,
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    fundWalletBtnText: {
        color: '#020617',
        fontSize: 11.5,
        fontWeight: '900',
    },
    withdrawBtn: {
        flex: 1,
        height: 38,
        borderRadius: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    withdrawBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
    },
    scrollBody: {
        flex: 1,
    },
    scrollContentPadding: {
        paddingHorizontal: 16,
        paddingBottom: 90,
    },
    sectionBox: {
        marginBottom: 12,
    },
    sectionHeaderTitle: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '900',
        marginBottom: 8,
        letterSpacing: -0.2,
    },
    virtualBankCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    vCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    bankNamePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    bankNameText: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    instantDepositTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    greenLiveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
    },
    instantDepositText: {
        color: '#10B981',
        fontSize: 8.5,
        fontWeight: '800',
    },
    acctNumRowCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    acctNumLabel: {
        color: '#94A3B8',
        fontSize: 8,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 1,
    },
    acctNumTextCompact: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.8,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    acctHolderNameSub: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '700',
        marginTop: 2,
    },
    copyPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    copyPillBtnText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '900',
    },

    bvnUnlockCard: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
    },
    bvnIconBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bvnUnlockTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#B45309',
    },
    bvnUnlockSub: {
        fontSize: 10,
        color: '#92400E',
        marginTop: 1,
        lineHeight: 14,
    },

    noVirtualAcctCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    noAcctIconBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    noAcctTitle: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '800',
        marginBottom: 2,
    },
    noAcctSubtitle: {
        color: '#64748B',
        fontSize: 10.5,
        textAlign: 'center',
        marginBottom: 10,
        lineHeight: 15,
    },
    verifyKycBtn: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    verifyKycBtnText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },
    depositFeeBox: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    feeBoxHeader: {
        color: '#B45309',
        fontSize: 10.5,
        fontWeight: '800',
        marginBottom: 1,
    },
    feeBoxText: {
        color: '#92400E',
        fontSize: 10.5,
        lineHeight: 15,
    },
    kpiGridRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    kpiCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 14,
        borderWidth: 1,
    },
    kpiIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiLabel: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    kpiValue: {
        fontSize: 12,
        fontWeight: '900',
        marginTop: 0.5,
    },
    recentHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    seeAllLinkText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '800',
    },
    txListCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    txItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    txLeftCol: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    txIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txTitleText: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '800',
    },
    txDateText: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 1,
    },
    txRightCol: {
        alignItems: 'flex-end',
    },
    txAmountText: {
        fontSize: 11.5,
        fontWeight: '900',
    },
    txStatusPill: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        marginTop: 1.5,
    },
    txStatusPillText: {
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyTxBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyTxTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 4,
    },
    emptyTxSub: {
        color: '#94A3B8',
        fontSize: 10.5,
        marginTop: 1,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'flex-end',
    },
    modalSheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        borderTopWidth: 2.5,
        borderColor: '#F59E0B',
        maxHeight: '80%',
    },
    modalDragBar: {
        width: 36,
        height: 4,
        backgroundColor: '#CBD5E1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitleText: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '900',
    },
    modalCloseIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalMethodTabs: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 3,
        borderRadius: 12,
        marginBottom: 12,
        gap: 4,
    },
    modalMethodTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 9,
    },
    modalMethodTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    modalMethodTabText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    modalMethodTabTextActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    modalInstructionText: {
        color: '#64748B',
        fontSize: 10.5,
        lineHeight: 15,
        marginBottom: 12,
        textAlign: 'center',
    },
    modalBankCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    mBankPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        marginBottom: 8,
    },
    mBankPillText: {
        color: '#F59E0B',
        fontSize: 8.5,
        fontWeight: '900',
    },
    mLabelText: {
        color: '#94A3B8',
        fontSize: 8,
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
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    mCopyBtn: {
        padding: 3,
    },
    mNameText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    modalNoAcctBox: {
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    modalNoAcctTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    modalNoAcctSub: {
        color: '#64748B',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },
    amountInputContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    amountInputHeader: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    amountInputFlexRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencyPrefix: {
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '900',
        marginRight: 3,
    },
    amountInputField: {
        flex: 1,
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '900',
    },
    liveCalcCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    liveCalcRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    liveCalcLabel: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
    },
    liveCalcVal: {
        color: '#0F172A',
        fontSize: 10.5,
        fontWeight: '700',
    },
    liveCalcDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 3,
    },
    liveCalcNetLabel: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
    },
    liveCalcNetVal: {
        color: '#10B981',
        fontSize: 11,
        fontWeight: '900',
    },
    submitPayBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#F59E0B',
        borderWidth: 1.2,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitPayBtnText: {
        color: '#F59E0B',
        fontSize: 11.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    verifyModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.78)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    verifyModalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#0F172A',
        borderRadius: 22,
        padding: 26,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    verifyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    verifyTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 8,
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    verifySub: {
        color: '#94A3B8',
        fontSize: 12.5,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18,
    },
    verifyWarningBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    verifyWarningText: {
        color: '#10B981',
        fontSize: 11,
        fontWeight: '700',
    },
});
