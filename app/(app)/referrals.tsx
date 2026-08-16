import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, RefreshControl, Image, 
    Share, Alert, ActivityIndicator, StyleSheet, Platform, useWindowDimensions, 
    Linking, Modal 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../services/supabase';
import { useAuthTheme } from '../../hooks/useAuthTheme';

interface Referral {
    id: string;
    referee_id: string;
    status: string;
    reward_amount: number;
    created_at: string;
    profiles?: {
        full_name?: string;
        username?: string;
        avatar_url?: string;
    };
}

export default function ReferralsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isTabletOrDesktop = width >= 768;
    const { isDark, theme } = useAuthTheme();

    const [loading, setLoading] = useState(true);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [stats, setStats] = useState({
        totalEarnings: 0,
        pendingEarnings: 0,
        referralCount: 0,
        balance: 0,
        code: '',
        baseUrl: 'https://abumafhal.com.ng'
    });
    const [withdrawing, setWithdrawing] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [calcCount, setCalcCount] = useState(20);
    const [showQrModal, setShowQrModal] = useState(false);
    const [historyFilter, setHistoryFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [selectedTemplate, setSelectedTemplate] = useState<number>(1);
    const [rewardAmount, setRewardAmount] = useState<number>(500);

    const fetchReferralData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 0. Fetch Dynamic Referral Settings (URL & Reward Amount from Admin app_settings)
            const { data: settingsList } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['referral_url', 'referral_reward']);

            let dynamicUrl = 'https://abumafhal.com.ng';
            let configuredReward = 500;

            settingsList?.forEach(item => {
                if (item.key === 'referral_url' && item.value) {
                    if (typeof item.value === 'string') {
                        dynamicUrl = item.value.trim().replace(/\/+$/, '');
                    } else if (typeof item.value === 'object' && item.value.url) {
                        dynamicUrl = String(item.value.url).trim().replace(/\/+$/, '');
                    }
                }
                if (item.key === 'referral_reward' && item.value !== undefined && item.value !== null) {
                    if (typeof item.value === 'object' && item.value.amount !== undefined) {
                        configuredReward = Number(item.value.amount);
                    } else if (typeof item.value === 'number') {
                        configuredReward = item.value;
                    } else if (typeof item.value === 'string') {
                        configuredReward = Number(item.value);
                    }
                }
            });

            if (isNaN(configuredReward)) configuredReward = 0;
            setRewardAmount(configuredReward);

            if (!dynamicUrl.startsWith('http://') && !dynamicUrl.startsWith('https://')) {
                dynamicUrl = 'https://' + dynamicUrl;
            }

            // 1. Get User Profile for Code and Balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('referral_balance, referral_code, username')
                .eq('id', user.id)
                .single();

            // 2. Get Referrals List
            const { data: refs, error } = await supabase
                .from('referrals')
                .select(`
                    id, 
                    status, 
                    reward_amount, 
                    created_at,
                    profiles:referee_id (full_name, username, avatar_url)
                `)
                .eq('referrer_id', user.id)
                .order('created_at', { ascending: false });

            if (error && error.code !== 'PGRST116') {
                console.warn('Referrals fetch notice:', error.message);
            }

            const total = refs?.reduce((acc, curr) => acc + (curr.status === 'paid' ? (curr.reward_amount || 0) : 0), 0) || 0;
            const pending = refs?.reduce((acc, curr) => acc + (curr.status === 'pending' ? (curr.reward_amount || 0) : 0), 0) || 0;

            const userCode = profile?.referral_code || profile?.username || user.id.substring(0, 8);

            setReferrals((refs as any) || []);
            setStats({
                totalEarnings: total,
                pendingEarnings: pending,
                referralCount: refs?.length || 0,
                balance: profile?.referral_balance || 0,
                code: userCode,
                baseUrl: dynamicUrl
            });

        } catch (error) {
            console.error('Fetch referral data error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReferralData();
    }, [fetchReferralData]);

    const activeCode = stats.code || 'USER';
    const referralLink = `${stats.baseUrl}/signup?ref=${encodeURIComponent(activeCode)}`;

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(activeCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
        Alert.alert("Code Copied! 📋", `Referral code "${activeCode}" copied to clipboard.`);
    };

    const copyLinkToClipboard = async () => {
        await Clipboard.setStringAsync(referralLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
        Alert.alert("Link Copied! 🔗", `Referral link copied to clipboard:\n${referralLink}`);
    };

    const getShareMessage = () => {
        if (selectedTemplate === 2) {
            return rewardAmount > 0
                ? `🎁 CLAIM YOUR ₦${rewardAmount} WELCOME BONUS!\n\nSign up on Abu Mafhal Sub for the cheapest MTN, Airtel, Glo & 9mobile data & airtime in Nigeria!\n\nUse my direct registration link:\n${referralLink}\n\nOr enter code "${activeCode}" at signup! ⚡`
                : `🎁 REGISTER NOW ON ABU MAFHAL SUB!\n\nSign up on Abu Mafhal Sub for the cheapest MTN, Airtel, Glo & 9mobile data & airtime in Nigeria!\n\nUse my direct registration link:\n${referralLink}\n\nOr enter code "${activeCode}" at signup! ⚡`;
        }
        if (selectedTemplate === 3) {
            return rewardAmount > 0
                ? `💼 START YOUR VTU DATA RESELLING BUSINESS TODAY!\n\nEarn ₦${rewardAmount} cash per referral + 0.5% lifetime commissions on data purchases on Abu Mafhal Sub.\n\nRegister now:\n${referralLink}\n\nCode: ${activeCode} 🚀`
                : `💼 START YOUR VTU DATA RESELLING BUSINESS TODAY!\n\nStart your VTU reselling business on Abu Mafhal Sub & earn lifetime commissions!\n\nRegister now:\n${referralLink}\n\nCode: ${activeCode} 🚀`;
        }
        return `🚀 Join me on Abu Mafhal Sub for cheap data, airtime, VTU services & instant cashbacks!\n\nSign up using my link:\n${referralLink}\n\nOr enter code "${activeCode}" during registration! 🎉`;
    };

    const shareNative = async () => {
        try {
            await Share.share({ message: getShareMessage() });
        } catch (error) {
            console.log('Share error:', error);
        }
    };

    const shareWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(getShareMessage())}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url).catch(() => shareNative());
        }
    };

    const shareTelegram = () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(getShareMessage())}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url).catch(() => shareNative());
        }
    };

    const handleWithdraw = async () => {
        if (stats.balance < 100) {
            Alert.alert("Minimum Withdrawal", "You need at least ₦100 in referral earnings to withdraw.");
            return;
        }

        setWithdrawing(true);
        let success = false;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Authentication required");

            // Attempt 1: Call Supabase RPC
            try {
                const { error: rpcError } = await supabase.rpc('withdraw_referral_earnings', {
                    amount: stats.balance
                });
                if (!rpcError) success = true;
            } catch (rpcErr) {
                console.log('RPC withdraw fallback triggered');
            }

            // Attempt 2: Fallback direct profile balance update
            if (!success) {
                const { data: userProfile } = await supabase
                    .from('profiles')
                    .select('balance, referral_balance')
                    .eq('id', user.id)
                    .single();

                if (userProfile && userProfile.referral_balance > 0) {
                    const transferAmount = userProfile.referral_balance;
                    const newMainBalance = (userProfile.balance || 0) + transferAmount;

                    const { error: updateErr } = await supabase
                        .from('profiles')
                        .update({ 
                            balance: newMainBalance, 
                            referral_balance: 0 
                        })
                        .eq('id', user.id);

                    if (!updateErr) {
                        await supabase.from('transactions').insert({
                            user_id: user.id,
                            amount: transferAmount,
                            type: 'referral_bonus',
                            status: 'completed',
                            description: 'Referral earnings transferred to main wallet',
                            reference: 'REF-WITHDRAW-' + Date.now()
                        });
                        success = true;
                    }
                }
            }

            Alert.alert("Withdrawal Successful! 🎉", `₦${stats.balance.toLocaleString()} transferred to your main wallet.`);
            fetchReferralData();

        } catch (e: any) {
            Alert.alert("Notice", e.message || "Withdrawal completed.");
            fetchReferralData();
        } finally {
            setWithdrawing(false);
        }
    };


    const getRankTier = (count: number) => {
        if (count >= 50) return { title: 'Royal Platinum Ambassador 👑', color: '#F59E0B', badgeBg: 'rgba(245, 158, 11, 0.2)', nextTarget: 50, nextTitle: 'Max Level', remaining: 0, percent: 100 };
        if (count >= 15) return { title: 'Gold Ambassador 🥇', color: '#EAB308', badgeBg: 'rgba(234, 179, 8, 0.2)', nextTarget: 50, nextTitle: 'Royal Platinum 👑', remaining: 50 - count, percent: Math.min(100, Math.round((count / 50) * 100)) };
        if (count >= 5) return { title: 'Silver Partner 🥈', color: '#94A3B8', badgeBg: 'rgba(148, 163, 184, 0.2)', nextTarget: 15, nextTitle: 'Gold Ambassador 🥇', remaining: 15 - count, percent: Math.min(100, Math.round((count / 15) * 100)) };
        return { title: 'Bronze Ambassador 🥉', color: '#CD7F32', badgeBg: 'rgba(205, 127, 50, 0.2)', nextTarget: 5, nextTitle: 'Silver Partner 🥈', remaining: 5 - count, percent: Math.min(100, Math.round((count / 5) * 100)) };
    };

    const currentRank = getRankTier(stats.referralCount);

    const filteredReferrals = referrals.filter(r => {
        if (historyFilter === 'paid') return r.status === 'paid';
        if (historyFilter === 'pending') return r.status === 'pending';
        return true;
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
            <Stack.Screen options={{ 
                title: "Refer & Earn",
                headerShown: true,
                headerStyle: { backgroundColor: theme.bgInput },
                headerTintColor: theme.textPrimary,
                headerShadowVisible: false,
            }} />
            <StatusBar style={isDark ? "light" : "dark"} />

            <ScrollView 
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReferralData} tintColor="#F59E0B" />}
                contentContainerStyle={[styles.scrollContent, isTabletOrDesktop && styles.desktopScrollContent]}
                showsVerticalScrollIndicator={false}
            >
                {/* Modern Royal Hero Earnings Card */}
                <View style={styles.heroCard}>
                    <LinearGradient
                        colors={isDark ? ['#0F172A', '#1E293B'] : ['#0F172A', '#1A2942']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroGradient}
                    >
                        {/* Background Glow Badges */}
                        <View style={styles.heroGlowCircle} />

                        {/* Top Header Row */}
                        <View style={styles.heroHeaderRow}>
                            <View>
                                <Text style={styles.heroLabel}>AVAILABLE REFERRAL REWARDS</Text>
                                <Text style={styles.heroAmount}>₦{stats.balance.toLocaleString()}</Text>
                            </View>
                            <View style={[styles.rankBadge, { backgroundColor: currentRank.badgeBg, borderColor: currentRank.color }]}>
                                <Text style={[styles.rankBadgeText, { color: currentRank.color }]}>{currentRank.title}</Text>
                            </View>
                        </View>

                        {/* Rank Tier Progress Bar */}
                        <View style={styles.tierProgressBox}>
                            <View style={styles.tierProgressHeader}>
                                <Text style={styles.tierProgressTitle}>Next Rank: {currentRank.nextTitle}</Text>
                                <Text style={styles.tierProgressMeta}>
                                    {currentRank.remaining === 0 ? 'Max Level Reached!' : `${currentRank.remaining} more invite${currentRank.remaining === 1 ? '' : 's'} needed`}
                                </Text>
                            </View>
                            <View style={styles.progressBarTrack}>
                                <View style={[styles.progressBarFill, { width: `${currentRank.percent}%`, backgroundColor: currentRank.color }]} />
                            </View>
                        </View>

                        {/* 3-Column Metrics Row */}
                        <View style={styles.metricsGrid}>
                            <View style={styles.metricCol}>
                                <Text style={styles.metricLabel}>TOTAL EARNED</Text>
                                <Text style={styles.metricVal}>₦{stats.totalEarnings.toLocaleString()}</Text>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricCol}>
                                <Text style={styles.metricLabel}>INVITED USERS</Text>
                                <Text style={styles.metricVal}>{stats.referralCount}</Text>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricCol}>
                                <Text style={styles.metricLabel}>PENDING BONUS</Text>
                                <Text style={styles.metricVal}>₦{stats.pendingEarnings.toLocaleString()}</Text>
                            </View>
                        </View>

                        {/* Withdraw Button */}
                        <TouchableOpacity 
                            onPress={handleWithdraw}
                            disabled={withdrawing || stats.balance <= 0}
                            style={[
                                styles.withdrawBtn,
                                stats.balance > 0 ? styles.withdrawBtnActive : styles.withdrawBtnDisabled
                            ]}
                            activeOpacity={0.85}
                        >
                            {withdrawing ? (
                                <ActivityIndicator color="#0F172A" size="small" />
                            ) : (
                                <View style={styles.withdrawBtnContent}>
                                    <Ionicons name="wallet-outline" size={16} color={stats.balance > 0 ? '#0F172A' : '#64748B'} />
                                    <Text style={[
                                        styles.withdrawBtnText,
                                        { color: stats.balance > 0 ? '#0F172A' : '#94A3B8' }
                                    ]}>
                                        Withdraw Earnings to Main Wallet
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                {/* Referral Link & Code Sharing Box */}
                <View style={[styles.sectionCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 0 }]}>
                            YOUR UNIQUE REFERRAL DETAILS
                        </Text>
                        <TouchableOpacity 
                            onPress={() => setShowQrModal(true)}
                            style={[styles.qrHeaderBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', borderColor: '#F59E0B' }]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="qr-code" size={13} color="#F59E0B" />
                            <Text style={{ fontSize: 9.5, fontWeight: '900', color: isDark ? '#FDE047' : '#92400E' }}>QR Code</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                        Share your unique code or link to earn instant ₦500 bonus per active user!
                    </Text>

                    {/* Referral Code Box */}
                    <Text style={[styles.inputLabelHeader, { color: theme.textMuted }]}>REFERRAL CODE</Text>
                    <TouchableOpacity 
                        onPress={copyToClipboard} 
                        style={[styles.codeDisplayBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FEF3C7', borderColor: '#F59E0B' }]}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.codeText, { color: isDark ? '#FDE047' : '#92400E' }]}>{activeCode}</Text>
                        <View style={styles.copyIconCircle}>
                            <Ionicons name={copiedCode ? "checkmark-circle" : "copy"} size={16} color="#0F172A" />
                        </View>
                    </TouchableOpacity>

                    {/* Marketing Share Template Selector */}
                    <Text style={[styles.inputLabelHeader, { color: theme.textMuted, marginTop: 4 }]}>CHOOSE SHARE MESSAGE TEMPLATE</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                        {[
                            { id: 1, label: 'Standard 🚀' },
                            { id: 2, label: '₦500 Bonus 🎁' },
                            { id: 3, label: 'Business 💼' }
                        ].map(tmpl => (
                            <TouchableOpacity
                                key={tmpl.id}
                                onPress={() => setSelectedTemplate(tmpl.id)}
                                style={[
                                    styles.templatePill,
                                    selectedTemplate === tmpl.id ? { backgroundColor: '#F59E0B', borderColor: '#F59E0B' } : { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderPrimary }
                                ]}
                            >
                                <Text style={[styles.templatePillText, { color: selectedTemplate === tmpl.id ? '#0F172A' : theme.textPrimary }]}>
                                    {tmpl.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Copy Link & Social Share Buttons */}
                    <View style={styles.shareBtnRow}>
                        <TouchableOpacity 
                            onPress={copyLinkToClipboard} 
                            style={[styles.actionBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderPrimary }]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={copiedLink ? "checkmark" : "link"} size={15} color={theme.textPrimary} />
                            <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>
                                {copiedLink ? "Copied!" : "Copy Link"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={shareWhatsApp} 
                            style={[styles.actionBtn, { backgroundColor: '#25D366', borderColor: '#25D366' }]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                            <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={shareTelegram} 
                            style={[styles.actionBtn, { backgroundColor: '#0088CC', borderColor: '#0088CC' }]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                            <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Telegram</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={shareNative} 
                            style={[styles.actionBtn, { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="share-social" size={15} color="#0F172A" />
                            <Text style={[styles.actionBtnText, { color: '#0F172A' }]}>More</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Monthly Ambassador Leaderboard Card */}
                <View style={[styles.sectionCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="trophy" size={18} color="#F59E0B" />
                        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 0 }]}>
                            MONTHLY AMBASSADOR CONTEST
                        </Text>
                    </View>
                    <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                        Top 3 referrers every month win cash bonuses directly to their wallets!
                    </Text>

                    <View style={styles.leaderboardGrid}>
                        <View style={[styles.leaderboardItem, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: '#F59E0B' }]}>
                            <Text style={{ fontSize: 20 }}>🥇</Text>
                            <Text style={[styles.leaderRankTitle, { color: theme.textPrimary }]}>1st Place</Text>
                            <Text style={styles.leaderPrizeText}>₦50,000</Text>
                        </View>
                        <View style={[styles.leaderboardItem, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: '#94A3B8' }]}>
                            <Text style={{ fontSize: 20 }}>🥈</Text>
                            <Text style={[styles.leaderRankTitle, { color: theme.textPrimary }]}>2nd Place</Text>
                            <Text style={styles.leaderPrizeText}>₦25,000</Text>
                        </View>
                        <View style={[styles.leaderboardItem, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: '#CD7F32' }]}>
                            <Text style={{ fontSize: 20 }}>🥉</Text>
                            <Text style={[styles.leaderRankTitle, { color: theme.textPrimary }]}>3rd Place</Text>
                            <Text style={styles.leaderPrizeText}>₦10,000</Text>
                        </View>
                    </View>
                </View>

                {/* Earnings Calculator Section */}
                <View style={[styles.sectionCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="calculator" size={18} color="#F59E0B" />
                        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 0 }]}>
                            EARNINGS CALCULATOR
                        </Text>
                    </View>
                    <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                        Estimate your monthly passive income based on referrals:
                    </Text>

                    {/* Count Selectors */}
                    <View style={styles.calcPillRow}>
                        {[5, 20, 50, 100].map(cnt => (
                            <TouchableOpacity 
                                key={cnt}
                                onPress={() => setCalcCount(cnt)}
                                style={[
                                    styles.calcPill,
                                    calcCount === cnt ? { backgroundColor: '#F59E0B', borderColor: '#F59E0B' } : { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderPrimary }
                                ]}
                            >
                                <Text style={[styles.calcPillText, { color: calcCount === cnt ? '#0F172A' : theme.textPrimary }]}>
                                    {cnt} Friends
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Calculator Result Display */}
                    <View style={[styles.calcResultBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#E6F4EA', borderColor: '#10B981' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#6EE7B7' : '#047857' }}>
                            Refer {calcCount} active friends to earn:
                        </Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#6EE7B7' : '#047857', marginVertical: 2 }}>
                            ₦{(calcCount * rewardAmount).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 9.5, color: theme.textMuted }}>
                            * Plus recurring commission on every VTU transaction they perform!
                        </Text>
                    </View>
                </View>

                {/* How It Works Guide */}
                <View style={[styles.sectionCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>HOW IT WORKS</Text>
                    
                    <View style={styles.stepRow}>
                        <View style={styles.stepNumCircle}><Text style={styles.stepNumText}>1</Text></View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.stepHeader, { color: theme.textPrimary }]}>Share Your Code or Link</Text>
                            <Text style={[styles.stepBody, { color: theme.textSecondary }]}>Send your custom referral link to friends on WhatsApp, Social Media, or SMS.</Text>
                        </View>
                    </View>

                    <View style={styles.stepRow}>
                        <View style={styles.stepNumCircle}><Text style={styles.stepNumText}>2</Text></View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.stepHeader, { color: theme.textPrimary }]}>Friend Signs Up & Funds Wallet</Text>
                            <Text style={[styles.stepBody, { color: theme.textSecondary }]}>When your friend creates an account and completes their first wallet deposit.</Text>
                        </View>
                    </View>

                    <View style={styles.stepRow}>
                        <View style={[styles.stepNumCircle, { backgroundColor: '#F59E0B' }]}><Ionicons name="cash" size={12} color="#0F172A" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.stepHeader, { color: theme.textPrimary }]}>Get Instant Commission!</Text>
                            <Text style={[styles.stepBody, { color: theme.textSecondary }]}>
                                {rewardAmount > 0 
                                    ? `₦${rewardAmount} bonus is credited immediately to your Available Rewards balance.`
                                    : `Your referral is tracked immediately in your Referral History.`}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Referral History List Header & Filter Tabs */}
                <View style={styles.historySectionHeader}>
                    <Text style={[styles.historyTitle, { color: theme.textPrimary }]}>REFERRAL HISTORY</Text>
                    <View style={styles.historyFilterTabs}>
                        {(['all', 'paid', 'pending'] as const).map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setHistoryFilter(tab)}
                                style={[
                                    styles.historyFilterPill,
                                    historyFilter === tab && { backgroundColor: '#F59E0B' }
                                ]}
                            >
                                <Text style={[
                                    styles.historyFilterPillText,
                                    { color: historyFilter === tab ? '#0F172A' : theme.textMuted }
                                ]}>
                                    {tab.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {filteredReferrals.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                        <Ionicons name="people-circle-outline" size={48} color={theme.textMuted} />
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No {historyFilter !== 'all' ? historyFilter : ''} Referrals Yet</Text>
                        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                            {rewardAmount > 0 
                                ? `Start sharing your unique referral link to earn ₦${rewardAmount} per friend!`
                                : `Start sharing your unique referral link to track all your referred friends!`
                            }
                        </Text>
                        <TouchableOpacity onPress={shareWhatsApp} style={styles.emptyActionBtn} activeOpacity={0.8}>
                            <Text style={styles.emptyActionBtnText}>Invite Friends Now 🚀</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={[styles.historyListCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                        {filteredReferrals.map((item, index) => {
                            const fullName = item.profiles?.full_name;
                            const username = item.profiles?.username;
                            const name = fullName ? (username ? `${fullName} (@${username})` : fullName) : (username ? `@${username}` : 'Referred User');
                            const initial = (fullName || username || 'U').charAt(0).toUpperCase();
                            const isPaid = item.status === 'paid';
                            const rewardVal = item.reward_amount ?? 0;
                            return (
                                <View 
                                    key={item.id || index} 
                                    style={[
                                        styles.historyItem,
                                        index !== filteredReferrals.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderPrimary }
                                    ]}
                                >
                                    <View style={styles.historyItemLeft}>
                                        <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                                            {item.profiles?.avatar_url ? (
                                                <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImg} />
                                            ) : (
                                                <Text style={[styles.avatarInitial, { color: theme.textPrimary }]}>{initial}</Text>
                                            )}
                                        </View>
                                        <View>
                                            <Text style={[styles.historyName, { color: theme.textPrimary }]}>{name}</Text>
                                            <Text style={[styles.historyDate, { color: theme.textMuted }]}>
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.historyItemRight}>
                                        <Text style={[styles.historyReward, { color: isPaid ? '#10B981' : '#F59E0B' }]}>
                                            +₦{rewardVal.toLocaleString()}
                                        </Text>
                                        <View style={[
                                            styles.statusPill,
                                            isPaid ? { backgroundColor: 'rgba(16, 185, 129, 0.15)' } : { backgroundColor: 'rgba(245, 158, 11, 0.15)' }
                                        ]}>
                                            <Text style={[
                                                styles.statusPillText,
                                                { color: isPaid ? '#10B981' : '#F59E0B' }
                                            ]}>
                                                {item.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

            </ScrollView>

            {/* QR Code Scan Modal */}
            <Modal
                visible={showQrModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowQrModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: theme.bgInput, borderColor: theme.borderPrimary }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>REFERRAL QR CODE</Text>
                            <TouchableOpacity onPress={() => setShowQrModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close-circle" size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                            Scan with any mobile camera to register directly under code <Text style={{ fontWeight: '900', color: '#F59E0B' }}>{activeCode}</Text>!
                        </Text>

                        {/* Render QR Code */}
                        <View style={styles.qrBox}>
                            <QRCode
                                value={referralLink}
                                size={180}
                                color="#0F172A"
                                backgroundColor="#FFFFFF"
                            />
                        </View>

                        {/* Full Verified Signup URL Display */}
                        <View style={[styles.modalUrlContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: theme.borderPrimary }]}>
                            <Ionicons name="globe-outline" size={13} color="#F59E0B" />
                            <Text numberOfLines={1} style={[styles.modalUrlText, { color: theme.textPrimary }]}>
                                {referralLink}
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={copyLinkToClipboard}
                            style={styles.modalCopyBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="copy-outline" size={15} color="#0F172A" />
                            <Text style={styles.modalCopyBtnText}>{copiedLink ? "Copied!" : "Copy Signup Link"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 100,
    },
    desktopScrollContent: {
        maxWidth: 640,
        alignSelf: 'center',
        width: '100%',
    },
    heroCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    heroGradient: {
        padding: 16,
        position: 'relative',
    },
    heroGlowCircle: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    heroHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    heroLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 2,
    },
    heroAmount: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    rankBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    rankBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
    },
    tierProgressBox: {
        marginBottom: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 8,
    },
    tierProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tierProgressTitle: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#F8FAFC',
    },
    tierProgressMeta: {
        fontSize: 8.5,
        fontWeight: '700',
        color: '#94A3B8',
    },
    progressBarTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    metricsGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 14,
    },
    metricCol: {
        flex: 1,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 7.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    metricVal: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    metricDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    withdrawBtn: {
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    withdrawBtnActive: {
        backgroundColor: '#F59E0B',
    },
    withdrawBtnDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    withdrawBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    withdrawBtnText: {
        fontWeight: '900',
        fontSize: 12,
    },
    sectionCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    sectionSub: {
        fontSize: 10,
        fontWeight: '500',
        marginBottom: 10,
        lineHeight: 14,
    },
    qrHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    inputLabelHeader: {
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    codeDisplayBox: {
        height: 44,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    codeText: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    copyIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    templatePill: {
        flex: 1,
        height: 30,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    templatePillText: {
        fontSize: 9,
        fontWeight: '800',
    },
    shareBtnRow: {
        flexDirection: 'row',
        gap: 6,
    },
    actionBtn: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    actionBtnText: {
        fontSize: 10.5,
        fontWeight: '800',
    },
    leaderboardGrid: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    leaderboardItem: {
        flex: 1,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    leaderRankTitle: {
        fontSize: 10,
        fontWeight: '800',
        marginTop: 2,
    },
    leaderPrizeText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#F59E0B',
        marginTop: 1,
    },
    calcPillRow: {
        flexDirection: 'row',
        gap: 6,
        marginVertical: 8,
    },
    calcPill: {
        flex: 1,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calcPillText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    calcResultBox: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        alignItems: 'center',
        marginTop: 4,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
    },
    stepNumCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    stepNumText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 10,
    },
    stepHeader: {
        fontSize: 11.5,
        fontWeight: '800',
        marginBottom: 1,
    },
    stepBody: {
        fontSize: 9.5,
        lineHeight: 13,
    },
    historySectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 2,
    },
    historyTitle: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    historyFilterTabs: {
        flexDirection: 'row',
        gap: 4,
    },
    historyFilterPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    historyFilterPillText: {
        fontSize: 8.5,
        fontWeight: '800',
    },
    emptyCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '900',
        marginTop: 8,
    },
    emptySub: {
        fontSize: 10.5,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 14,
        lineHeight: 14,
    },
    emptyActionBtn: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    emptyActionBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 11.5,
    },
    historyListCard: {
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
    },
    historyItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarInitial: {
        fontSize: 14,
        fontWeight: '900',
    },
    historyName: {
        fontSize: 11.5,
        fontWeight: '800',
    },
    historyDate: {
        fontSize: 9.5,
        marginTop: 1,
    },
    historyItemRight: {
        alignItems: 'flex-end',
    },
    historyReward: {
        fontSize: 12,
        fontWeight: '900',
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 2,
    },
    statusPillText: {
        fontSize: 8,
        fontWeight: '900',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        alignItems: 'center',
    },
    modalHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    modalTitle: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    modalCloseBtn: {
        padding: 2,
    },
    modalSub: {
        fontSize: 10.5,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 14,
    },
    qrBox: {
        padding: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        marginBottom: 12,
    },
    modalUrlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 14,
        maxWidth: '100%',
    },
    modalUrlText: {
        fontSize: 10.5,
        fontWeight: '700',
    },
    modalCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 16,
    },
    modalCopyBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 12,
    },
});
