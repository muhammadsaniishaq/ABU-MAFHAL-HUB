import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Share,
    Modal,
    Switch,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

// Royal Executive Design Tokens (Light Theme)
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    navy: '#0F172A',
    navyDark: '#070F26',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    green: '#10B981',
    greenBg: '#ECFDF5',
    greenBorder: '#A7F3D0',
    red: '#EF4444',
    redBg: '#FEF2F2',
    redBorder: '#FECACA',
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
};

interface Campaign {
    id: string;
    title: string;
    channel: 'PUSH' | 'BANNER' | 'EMAIL' | 'SMS';
    target_audience: 'ALL_USERS' | 'AGENTS_ONLY' | 'INACTIVE_30D' | 'VIP_TIER3';
    status: 'ACTIVE' | 'PAUSED' | 'SCHEDULED' | 'ENDED';
    impressions: number;
    clicks: number;
    conversions: number;
    budget: string;
    description: string;
    cta_link?: string;
    banner_url?: string;
    created_at: string;
}

const DEFAULT_CAMPAIGNS: Campaign[] = [
    {
        id: 'camp_01',
        title: 'Ramadan Data Bonanza 2026',
        channel: 'PUSH',
        target_audience: 'ALL_USERS',
        status: 'ACTIVE',
        impressions: 48920,
        clicks: 14210,
        conversions: 8940,
        budget: '₦150,000 Promo Subsidy',
        description: 'Instant 5% discount on all MTN and Airtel SME 1GB/2GB packages throughout the season.',
        cta_link: '/(app)/dashboard',
        created_at: '2026-03-01',
    },
    {
        id: 'camp_02',
        title: 'Zero Virtual Funding Fee Weekend',
        channel: 'BANNER',
        target_audience: 'ALL_USERS',
        status: 'ACTIVE',
        impressions: 32400,
        clicks: 8120,
        conversions: 6200,
        budget: '₦80,000 Gateway Absorbed',
        description: 'Fund wallet via Moniepoint or Wema Bank dedicated account with 0% gateway charges.',
        cta_link: '/(app)/fund-wallet',
        created_at: '2026-03-10',
    },
    {
        id: 'camp_03',
        title: 'Referral Agent Tier 2 Upgrade Blast',
        channel: 'SMS',
        target_audience: 'AGENTS_ONLY',
        status: 'PAUSED',
        impressions: 4500,
        clicks: 1200,
        conversions: 890,
        budget: '₦45,000 Bulk SMS',
        description: 'Invite 10 active traders and receive ₦5,000 instant wallet bonus + VIP wholesale pricing.',
        cta_link: '/manage/referral-settings',
        created_at: '2026-02-20',
    },
    {
        id: 'camp_04',
        title: 'Inactive User Re-engagement Offer',
        channel: 'EMAIL',
        target_audience: 'INACTIVE_30D',
        status: 'SCHEDULED',
        impressions: 1250,
        clicks: 340,
        conversions: 180,
        budget: '₦20,000 Email Quota',
        description: 'We miss you! Log in today and enjoy ₦200 free airtime voucher credited automatically.',
        cta_link: '/(app)/dashboard',
        created_at: '2026-03-12',
    },
];

export default function MarketingStudio() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [campaigns, setCampaigns] = useState<Campaign[]>(DEFAULT_CAMPAIGNS);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'PUSH' | 'BANNER'>('ALL');

    // New Campaign Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newChannel, setNewChannel] = useState<Campaign['channel']>('PUSH');
    const [newAudience, setNewAudience] = useState<Campaign['target_audience']>('ALL_USERS');
    const [newBudget, setNewBudget] = useState('₦50,000');
    const [newDesc, setNewDesc] = useState('');
    const [newCta, setNewCta] = useState('/(app)/dashboard');

    useEffect(() => {
        loadCampaignsFromDb();
    }, []);

    const loadCampaignsFromDb = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .eq('key', 'marketing_campaigns_list')
                .maybeSingle();

            if (!error && data && data.value) {
                const parsed = Array.isArray(data.value) ? data.value : JSON.parse(data.value);
                if (parsed.length > 0) {
                    setCampaigns(parsed);
                }
            }
        } catch (e) {
            console.warn('Marketing campaign loading:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCampaign = async () => {
        if (!newTitle.trim() || !newDesc.trim()) {
            Alert.alert('Required Fields', 'Please enter a campaign title and promo description.');
            return;
        }

        try {
            setSaving(true);
            const newCampaign: Campaign = {
                id: `camp_${Date.now()}`,
                title: newTitle.trim(),
                channel: newChannel,
                target_audience: newAudience,
                status: 'ACTIVE',
                impressions: 1,
                clicks: 0,
                conversions: 0,
                budget: newBudget.trim() || '₦0',
                description: newDesc.trim(),
                cta_link: newCta.trim(),
                created_at: new Date().toISOString().split('T')[0],
            };

            const updatedList = [newCampaign, ...campaigns];
            setCampaigns(updatedList);

            // Persist to app_settings
            await supabase.from('app_settings').upsert({
                key: 'marketing_campaigns_list',
                value: updatedList,
                description: 'Marketing Campaigns and promo broadcasts',
                updated_at: new Date().toISOString(),
            });

            // If it's a push campaign, broadcast to notifications table
            if (newChannel === 'PUSH') {
                try {
                    await supabase.from('notifications').insert({
                        title: `[PROMO] ${newTitle.trim()}`,
                        message: newDesc.trim(),
                        type: 'promo',
                    });
                } catch (notifErr) {
                    console.warn('Push notif dispatch warning:', notifErr);
                }
            }

            setModalVisible(false);
            setNewTitle('');
            setNewDesc('');
            Alert.alert('Campaign Launched!', `Campaign "${newTitle}" is now live and targeted at ${newAudience.replace('_', ' ')}.`);
        } catch (err: any) {
            Alert.alert('Error Launching', err.message || 'Could not save campaign.');
        } finally {
            setSaving(false);
        }
    };

    const toggleCampaignStatus = async (id: string) => {
        const updated = campaigns.map(c => {
            if (c.id === id) {
                const nextStatus: Campaign['status'] = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
                return { ...c, status: nextStatus };
            }
            return c;
        });

        setCampaigns(updated);

        try {
            await supabase.from('app_settings').upsert({
                key: 'marketing_campaigns_list',
                value: updated,
                description: 'Marketing Campaigns and promo broadcasts',
                updated_at: new Date().toISOString(),
            });
        } catch (e) {
            console.warn('Toggle save warning:', e);
        }
    };

    const handleDeleteCampaign = (id: string, title: string) => {
        Alert.alert(
            'Delete Campaign',
            `Are you sure you want to delete campaign "${title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = campaigns.filter(c => c.id !== id);
                        setCampaigns(updated);
                        await supabase.from('app_settings').upsert({
                            key: 'marketing_campaigns_list',
                            value: updated,
                            updated_at: new Date().toISOString(),
                        });
                    },
                },
            ]
        );
    };

    // Calculate Global KPIs
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
    const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';

    const filtered = campaigns.filter(c => {
        if (activeFilter === 'ACTIVE') return c.status === 'ACTIVE';
        if (activeFilter === 'PUSH') return c.channel === 'PUSH';
        if (activeFilter === 'BANNER') return c.channel === 'BANNER';
        return true;
    });

    return (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.iconBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={20} color={C.navy} />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={styles.headerTitle}>Marketing Campaigns</Text>
                        <Text style={styles.headerSubtitle}>Promotions, Banners & Push Broadcasts</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.replace('/(app)/dashboard')}
                        style={styles.appSwitchBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="home" size={16} color={C.gold} />
                        <Text style={styles.appSwitchText}>App</Text>
                    </TouchableOpacity>
                </View>

                {/* Filter Pills */}
                <View style={styles.filterRow}>
                    {(['ALL', 'ACTIVE', 'PUSH', 'BANNER'] as const).map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setActiveFilter(f)}
                            style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
                        >
                            <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>
                                {f}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.newCampaignBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                        <Text style={styles.newCampaignBtnText}>New Campaign</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Executive Performance Metric Cards */}
                <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: C.blueBg, borderColor: C.blueBorder }]}>
                            <Ionicons name="eye" size={18} color={C.blue} />
                        </View>
                        <Text style={styles.kpiLabel}>Impressions</Text>
                        <Text style={styles.kpiValue}>{totalImpressions.toLocaleString()}</Text>
                        <Text style={styles.kpiSub}>Audience Reach</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}>
                            <Ionicons name="finger-print" size={18} color={C.gold} />
                        </View>
                        <Text style={styles.kpiLabel}>Total Clicks</Text>
                        <Text style={styles.kpiValue}>{totalClicks.toLocaleString()}</Text>
                        <Text style={styles.kpiSub}>{avgCTR}% CTR Ratio</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <View style={[styles.kpiIconBox, { backgroundColor: C.greenBg, borderColor: C.greenBorder }]}>
                            <Ionicons name="bag-check" size={18} color={C.green} />
                        </View>
                        <Text style={styles.kpiLabel}>Conversions</Text>
                        <Text style={styles.kpiValue}>{totalConversions.toLocaleString()}</Text>
                        <Text style={styles.kpiSub}>Completed Txns</Text>
                    </View>
                </View>

                {/* Section Header */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Campaign Initiatives ({filtered.length})</Text>
                    <TouchableOpacity onPress={loadCampaignsFromDb} style={styles.refreshBtn}>
                        <Ionicons name="refresh" size={14} color={C.blue} />
                        <Text style={styles.refreshText}>Sync</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.centerLoading}>
                        <ActivityIndicator size="small" color={C.gold} />
                        <Text style={styles.loadingText}>Loading Marketing Engines...</Text>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="megaphone-outline" size={36} color={C.textMuted} />
                        <Text style={styles.emptyTitle}>No campaigns found</Text>
                        <Text style={styles.emptySub}>Tap "New Campaign" to launch promo discounts or push broadcasts.</Text>
                    </View>
                ) : (
                    filtered.map((item) => {
                        const isActive = item.status === 'ACTIVE';
                        return (
                            <View key={item.id} style={styles.campaignCard}>
                                <View style={styles.campaignHeaderRow}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.badgeRow}>
                                            <View style={[styles.channelBadge, {
                                                backgroundColor: item.channel === 'PUSH' ? C.purpleBg : item.channel === 'BANNER' ? C.goldBg : item.channel === 'SMS' ? C.greenBg : C.blueBg,
                                                borderColor: item.channel === 'PUSH' ? C.purpleBorder : item.channel === 'BANNER' ? C.goldBorder : item.channel === 'SMS' ? C.greenBorder : C.blueBorder,
                                            }]}>
                                                <Text style={[styles.channelBadgeText, {
                                                    color: item.channel === 'PUSH' ? C.purple : item.channel === 'BANNER' ? C.gold : item.channel === 'SMS' ? C.green : C.blue,
                                                }]}>
                                                    {item.channel}
                                                </Text>
                                            </View>

                                            <View style={styles.audienceBadge}>
                                                <Text style={styles.audienceBadgeText}>
                                                    {item.target_audience.replace('_', ' ')}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={styles.campaignTitle}>{item.title}</Text>
                                    </View>

                                    {/* Status Switch */}
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Switch
                                            value={isActive}
                                            onValueChange={() => toggleCampaignStatus(item.id)}
                                            trackColor={{ false: '#CBD5E1', true: C.goldBright }}
                                            thumbColor="#FFFFFF"
                                        />
                                        <Text style={[styles.statusToggleText, { color: isActive ? C.green : C.textMuted }]}>
                                            {isActive ? 'RUNNING' : 'PAUSED'}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.campaignDesc}>{item.description}</Text>

                                {/* Performance Bar Metrics */}
                                <View style={styles.metricsBox}>
                                    <View style={styles.metricCol}>
                                        <Text style={styles.metricNum}>{item.impressions.toLocaleString()}</Text>
                                        <Text style={styles.metricName}>Views</Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricCol}>
                                        <Text style={styles.metricNum}>{item.clicks.toLocaleString()}</Text>
                                        <Text style={styles.metricName}>Clicks</Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricCol}>
                                        <Text style={styles.metricNum}>{item.conversions.toLocaleString()}</Text>
                                        <Text style={styles.metricName}>Sales</Text>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    <View style={styles.metricCol}>
                                        <Text style={styles.metricNum}>{item.budget.split(' ')[0]}</Text>
                                        <Text style={styles.metricName}>Budget</Text>
                                    </View>
                                </View>

                                <View style={styles.campaignFooterRow}>
                                    <Text style={styles.campaignMeta}>Created: {item.created_at} • Destination: {item.cta_link || 'App Home'}</Text>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteCampaign(item.id, item.title)}
                                        style={styles.deleteBtn}
                                    >
                                        <Ionicons name="trash-outline" size={14} color={C.red} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* NEW CAMPAIGN CREATION MODAL */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSub}>GROWTH ENGINE</Text>
                                <Text style={styles.modalTitle}>Launch Marketing Campaign</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={styles.modalCloseBtn}
                            >
                                <Ionicons name="close" size={20} color={C.navy} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1, marginVertical: 14 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Channel:</Text>
                            <View style={styles.channelSelectRow}>
                                {(['PUSH', 'BANNER', 'SMS', 'EMAIL'] as const).map(ch => (
                                    <TouchableOpacity
                                        key={ch}
                                        onPress={() => setNewChannel(ch)}
                                        style={[styles.channelSelectBtn, newChannel === ch && styles.channelSelectBtnActive]}
                                    >
                                        <Text style={[styles.channelSelectBtnText, newChannel === ch && styles.channelSelectBtnTextActive]}>
                                            {ch}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Campaign Headline / Title:</Text>
                            <TextInput
                                style={styles.input}
                                value={newTitle}
                                onChangeText={setNewTitle}
                                placeholder="E.g. 50% Off Data Weekend Flash"
                                placeholderTextColor={C.textMuted}
                            />

                            <Text style={styles.inputLabel}>Target Audience Segment:</Text>
                            <View style={styles.audienceSelectRow}>
                                {([
                                    { key: 'ALL_USERS', label: 'All Users (12k+)' },
                                    { key: 'AGENTS_ONLY', label: 'Agents & Merchants' },
                                    { key: 'INACTIVE_30D', label: 'Inactive > 30 Days' },
                                    { key: 'VIP_TIER3', label: 'Tier 3 Corporate' },
                                ] as const).map(aud => (
                                    <TouchableOpacity
                                        key={aud.key}
                                        onPress={() => setNewAudience(aud.key)}
                                        style={[styles.audiencePill, newAudience === aud.key && styles.audiencePillActive]}
                                    >
                                        <Text style={[styles.audiencePillText, newAudience === aud.key && styles.audiencePillTextActive]}>
                                            {aud.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Budget / Promo Subsidy Value:</Text>
                            <TextInput
                                style={styles.input}
                                value={newBudget}
                                onChangeText={setNewBudget}
                                placeholder="E.g. ₦50,000"
                                placeholderTextColor={C.textMuted}
                            />

                            <Text style={styles.inputLabel}>Promo Details & Copywriting Content:</Text>
                            <TextInput
                                style={[styles.input, { height: 100 }]}
                                value={newDesc}
                                onChangeText={setNewDesc}
                                placeholder="Detailed promotional message for notification or banner..."
                                placeholderTextColor={C.textMuted}
                                multiline
                                textAlignVertical="top"
                            />

                            <Text style={styles.inputLabel}>Call To Action In-App Link:</Text>
                            <TextInput
                                style={styles.input}
                                value={newCta}
                                onChangeText={setNewCta}
                                placeholder="/(app)/dashboard or /(app)/fund-wallet"
                                placeholderTextColor={C.textMuted}
                            />
                        </ScrollView>

                        <TouchableOpacity
                            onPress={handleCreateCampaign}
                            disabled={saving}
                            style={[styles.launchBtn, saving && { opacity: 0.7 }]}
                            activeOpacity={0.8}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                                    <Text style={styles.launchBtnText}>Deploy Campaign to Platform</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
    },
    appSwitchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: C.goldBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.goldBorder,
    },
    appSwitchText: {
        fontSize: 13,
        fontWeight: '800',
        color: C.gold,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
    },
    filterPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSub,
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },
    newCampaignBtn: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.gold,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    newCampaignBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    contentContainer: {
        padding: 16,
    },
    kpiGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    kpiIconBox: {
        width: 34,
        height: 34,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    kpiLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.textMuted,
        textTransform: 'uppercase',
    },
    kpiValue: {
        fontSize: 16,
        fontWeight: '900',
        color: C.navy,
        marginVertical: 2,
    },
    kpiSub: {
        fontSize: 10,
        color: C.green,
        fontWeight: '700',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
        letterSpacing: -0.2,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.blueBg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    refreshText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.blue,
    },
    centerLoading: {
        padding: 40,
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '600',
    },
    emptyCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        gap: 6,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
    },
    emptySub: {
        fontSize: 12,
        color: C.textMuted,
        textAlign: 'center',
    },
    campaignCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 12,
    },
    campaignHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    channelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    channelBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    audienceBadge: {
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    audienceBadgeText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: C.textSub,
    },
    campaignTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.navy,
    },
    statusToggleText: {
        fontSize: 9.5,
        fontWeight: '800',
        marginTop: 2,
    },
    campaignDesc: {
        fontSize: 12.5,
        color: C.textSub,
        lineHeight: 18,
        marginBottom: 12,
    },
    metricsBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 6,
        marginBottom: 10,
    },
    metricCol: {
        flex: 1,
        alignItems: 'center',
    },
    metricNum: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 1,
    },
    metricName: {
        fontSize: 9.5,
        color: C.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    metricDivider: {
        width: 1,
        height: 20,
        backgroundColor: C.border,
    },
    campaignFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: C.borderLight,
        paddingTop: 10,
    },
    campaignMeta: {
        fontSize: 10.5,
        color: C.textMuted,
    },
    deleteBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: C.redBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingHorizontal: 20,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingBottom: 12,
    },
    modalSub: {
        fontSize: 11,
        fontWeight: '800',
        color: C.gold,
        marginBottom: 2,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: C.navy,
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: C.navy,
        marginBottom: 6,
        marginTop: 6,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: C.navy,
        marginBottom: 10,
    },
    channelSelectRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    channelSelectBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
    },
    channelSelectBtnActive: {
        backgroundColor: C.goldBg,
        borderColor: C.gold,
    },
    channelSelectBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSub,
    },
    channelSelectBtnTextActive: {
        color: C.gold,
        fontWeight: '900',
    },
    audienceSelectRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    audiencePill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
    },
    audiencePillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    audiencePillText: {
        fontSize: 11,
        fontWeight: '600',
        color: C.textSub,
    },
    audiencePillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    launchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.navy,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 8,
    },
    launchBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
