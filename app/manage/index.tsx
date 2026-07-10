import { View, Text, ScrollView, TouchableOpacity, Dimensions, TextInput, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
  border:  '#e2e8f0',
};

// MODULE CONFIGURATION
const modules = {
    operations: [
        { title: 'Users', icon: 'people-outline', route: '/manage/users', color: '#3B82F6' },
        { title: 'Transactions', icon: 'receipt-outline', route: '/manage/transactions', color: '#10B981' },
        { title: 'KYC Queue', icon: 'scan-outline', route: '/manage/kyc', color: '#8B5CF6', badge: 0 },
        { title: 'NIN Pricing', icon: 'pricetag-outline', route: '/manage/nin-pricing', color: '#059669' },
        { title: 'SMM Pricing', icon: 'thumbs-up-outline', route: '/manage/smm-pricing', color: '#8B5CF6' },
        { title: 'Bills Pricing', icon: 'flash-outline', route: '/manage/bills-pricing', color: '#f5a623' },
        { title: 'CAC Management', icon: 'briefcase-outline', route: '/manage/cac', color: '#10B981' },
        { title: 'Help Desk', icon: 'chatbubbles-outline', route: '/manage/tickets', color: '#EC4899', badge: 0 },
        { title: 'Content', icon: 'images-outline', route: '/manage/cms', color: '#6366F1' },
        { title: 'Data Plans', icon: 'wifi-outline', route: '/manage/data-plans', color: '#0EA5E9' },
        { title: 'Airtime', icon: 'call-outline', route: '/manage/airtime', color: '#10B981' },
        { title: 'Localization', icon: 'language-outline', route: '/manage/localization', color: '#8B5CF6' },
    ],
    banking: [
        { title: 'Cards', icon: 'card-outline', route: '/manage/cards', color: '#EC4899' },
        { title: 'Lending', icon: 'cash-outline', route: '/manage/lending', color: '#10B981', badge: 0 },
        { title: 'Wealth', icon: 'briefcase-outline', route: '/manage/wealth', color: '#8B5CF6' },
        { title: 'Liquidity', icon: 'water-outline', route: '/manage/liquidity', color: '#10B981' },
        { title: 'Rates', icon: 'trending-up-outline', route: '/manage/rates', color: '#F59E0B', stat: 'Live' },
    ],
    finance: [
        { title: 'Risk', icon: 'alert-circle-outline', route: '/manage/risk', color: '#EF4444' },
        { title: 'Analytics', icon: 'bar-chart-outline', route: '/manage/reports', color: '#F59E0B' },
        { title: 'Comms Center', icon: 'megaphone-outline', route: '/manage/communications', color: '#F472B6' },
        { title: 'Cortex AI', icon: 'sparkles-outline', route: '/manage/ai', color: '#818CF8', dark: true },
    ],
    technical: [
        { title: 'Infra', icon: 'server-outline', route: '/manage/infrastructure', color: '#475569' },
        { title: 'Database', icon: 'server', route: '/manage/db', color: '#10B981', dark: true },
        { title: 'API', icon: 'code-working-outline', route: '/manage/api', color: '#6366F1' },
        { title: 'Cinema', icon: 'videocam-outline', route: '/manage/cinema', color: '#EF4444', dark: true },
        { title: 'Terminal', icon: 'terminal-outline', route: '/manage/terminal', color: '#22C55E' },
        { title: 'Features', icon: 'toggle-outline', route: '/manage/features', color: '#F97316' },
        { title: 'App Store', icon: 'logo-apple', route: '/manage/stores', color: '#000000', badge: 1 },
        { title: 'Files', icon: 'folder-open-outline', route: '/manage/files', color: '#0EA5E9' },
    ],
    internal: [
        { title: 'Staff', icon: 'briefcase-outline', route: '/manage/staff', color: '#64748B' },
        { title: 'Voice OS', icon: 'mic-outline', route: '/manage/voice', color: '#8B5CF6', dark: true },
        { title: 'Legal', icon: 'document-text-outline', route: '/manage/legal', color: '#64748B' },
        { title: 'Team Chat', icon: 'people-circle-outline', route: '/manage/team', color: '#EF4444', badge: 0 },
        { title: 'Academy', icon: 'school-outline', route: '/manage/academy', color: '#F59E0B' },
        { title: 'Theme', icon: 'color-palette-outline', route: '/manage/appearance', color: '#EC4899' },
        { title: 'Automation', icon: 'flash-outline', route: '/manage/automation', color: '#6366F1' },
        { title: 'Kanban', icon: 'grid-outline', route: '/manage/kanban', color: '#F97316' },
    ],
    redZone: [
        { title: 'Security', icon: 'shield-checkmark-outline', route: '/manage/security', color: '#3B82F6' },
        { title: 'Forensics', icon: 'finger-print-outline', route: '/manage/forensics', color: '#8B5CF6' },
        { title: 'API Vault', icon: 'key-outline', route: '/manage/secrets', color: '#EF4444', dark: true },
        { title: 'Logs', icon: 'list-outline', route: '/manage/logs', color: '#64748B' },
        { title: 'Map', icon: 'earth-outline', route: '/manage/map', color: '#06B6D4' },
        { title: 'Settings', icon: 'settings-outline', route: '/manage/settings', color: '#475569' },
        { title: 'PANIC ROOM', icon: 'warning-outline', route: '/manage/panic', color: '#EF4444', dark: true },
    ]
};

const QUICK_ACTIONS = [
    { id: 'user', label: 'Add User', icon: 'person-add-outline', color: '#3B82F6', route: '/manage/users' },
    { id: 'money', label: 'Send Cash', icon: 'cash-outline', color: '#10B981', route: '/manage/transactions' },
    { id: 'broadcast', label: 'Broadcast', icon: 'megaphone-outline', color: '#F59E0B', route: '/manage/communications' },
    { id: 'logs', label: 'View Logs', icon: 'list-outline', color: '#6366F1', route: '/manage/logs' },
];

const dockItems = [
    { icon: 'stats-chart-outline', route: '/manage/reports', color: '#3B82F6' },
    { icon: 'people-outline', route: '/manage/users', color: '#10B981' },
    { icon: 'chatbubbles-outline', route: '/manage/tickets', color: '#F59E0B' },
    { icon: 'terminal-outline', route: '/manage/terminal', color: '#22C55E' },
];

const categoryMeta = {
    operations: { title: 'Operations & Core', icon: 'options-outline', color: '#f5a623' },
    banking: { title: 'Banking & Assets', icon: 'wallet-outline', color: '#f5a623' },
    finance: { title: 'Markets & Analytics', icon: 'stats-chart-outline', color: '#f5a623' },
    technical: { title: 'Technical Infra', icon: 'terminal-outline', color: '#f5a623' },
    internal: { title: 'Internal Affairs', icon: 'business-outline', color: '#f5a623' },
    redZone: { title: 'Security & Forensics', icon: 'shield-checkmark-outline', color: '#ef4444' }
};

export default function AdminBento() {
    const router = useRouter();
    const [counts, setCounts] = useState({
        users: 0,
        kyc: 0,
        loans: 0,
        tickets: 0,
        chats: 0
    });
    const [loading, setLoading] = useState(true);
    const [logoIconUrl, setLogoIconUrl] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        operations: true,
        banking: false,
        finance: false,
        technical: false,
        internal: false,
        redZone: false,
    });

    useEffect(() => {
        fetchCounts();
        fetchLogoIcon();
    }, []);

    const fetchLogoIcon = async () => {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'app_logo_icon')
                .single();
            if (data?.value?.url) {
                setLogoIconUrl(data.value.url);
            }
        } catch (e) {
            console.error('Error fetching admin logo icon:', e);
        }
    };

    const fetchCounts = async () => {
        try {
            const [
                { count: userCount },
                { count: kycCount },
                { count: loanCount },
                { count: ticketCount },
                { count: chatCount }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
                supabase.from('ticket_messages').select('*', { count: 'exact', head: true })
            ]);

            setCounts({
                users: userCount || 0,
                kyc: kycCount || 0,
                loans: loanCount || 0,
                tickets: ticketCount || 0,
                chats: chatCount || 0
            });
        } catch (error) {
            console.error('Error fetching admin counts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Update modules with dynamic badges
    modules.operations[2].badge = counts.kyc;
    modules.operations[3].badge = counts.tickets;
    modules.banking[1].badge = counts.loans;
    modules.internal[3].badge = counts.chats;

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const renderSectionAccordion = (key: keyof typeof modules) => {
        const meta = categoryMeta[key];
        const items = modules[key];
        const isExpanded = expandedSections[key];
        
        return (
            <View key={key} style={s.accordionCard}>
                <TouchableOpacity
                    onPress={() => toggleSection(key)}
                    style={[
                        s.accordionHeader,
                        isExpanded && s.accordionHeaderExpanded
                    ]}
                    activeOpacity={0.85}
                >
                    <View style={s.accordionHeaderLeft}>
                        <View style={[
                            s.accordionIconBg,
                            { backgroundColor: key === 'redZone' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 166, 35, 0.1)' }
                        ]}>
                            <Ionicons 
                                name={meta.icon as any} 
                                size={18} 
                                color={meta.color} 
                            />
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={s.accordionTitle}>{meta.title}</Text>
                            <Text style={s.accordionSubtitle}>
                                {items.length} module{items.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={s.accordionHeaderRight}>
                        {items.reduce((sum, item) => sum + ((item as any).badge || 0), 0) > 0 && (
                            <View style={s.sectionBadgeContainer}>
                                <Text style={s.sectionBadgeText}>
                                    {items.reduce((sum, item) => sum + ((item as any).badge || 0), 0)}
                                </Text>
                            </View>
                        )}
                        <Ionicons 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={18} 
                            color={T.gold} 
                        />
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={s.accordionBody}>
                        <View style={s.gridContainer}>
                            {items.map((item, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => router.push(item.route as any)}
                                    style={s.gridCard}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.gridCardHeader}>
                                        <View style={[s.iconBg, { backgroundColor: item.color + '12' }]}>
                                            <Ionicons name={item.icon as any} size={14} color={item.color} />
                                        </View>
                                        {(item as any).badge > 0 && (
                                            <View style={s.badgeContainer}>
                                                <Text style={s.badgeText}>{(item as any).badge}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={s.gridCardFooter}>
                                        {(item as any).stat && <Text style={s.statText}>{(item as any).stat}</Text>}
                                        <Text style={s.gridCardTitle} numberOfLines={1}>{item.title}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={s.container}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
                
                {/* Header Gradient */}
                <View style={s.headerWrapper}>
                    <LinearGradient
                        colors={['#060d21', '#0d1b3e']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={s.headerGradient}
                    >
                        {/* Glowing Decorative Orbs */}
                        <View style={s.orbRight} />
                        <View style={s.orbLeft} />

                        {/* Top Bar Brand & User Row */}
                        <View style={s.topBarBrandRow}>
                            <View style={s.brandRow}>
                                <Image 
                                    source={logoIconUrl ? { uri: logoIconUrl } : require('../../assets/images/logo-icon.png')} 
                                    style={s.brandLogo as any}
                                    resizeMode="contain"
                                />
                                <View style={s.brandTextContainer}>
                                    <Text style={s.brandTxtTitle}>MAFHAL</Text>
                                    <Text style={s.brandTxtSub}>ADMIN CENTRE</Text>
                                </View>
                            </View>

                            <View style={s.headerActionRow}>
                                <TouchableOpacity 
                                    onPress={() => router.replace('/(app)/dashboard')}
                                    style={s.logoutBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="log-out-outline" size={12} color="#cbd5e1" />
                                    <Text style={s.logoutBtnText}>User App</Text>
                                </TouchableOpacity>
                                
                                {/* Double Gold Ring Avatar */}
                                <View style={{ position: 'relative' }}>
                                    <View style={s.avatarDoubleRing}>
                                        <View style={s.avatarMiddleRing}>
                                            <View style={s.avatarInnerCircle}>
                                                <Text style={s.avatarLetters}>AD</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={s.avatarActiveDot} />
                                </View>
                            </View>
                        </View>

                        {/* Welcome & Status Bar Row */}
                        <View style={s.welcomeStatusRow}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={s.welcomeText}>Good Evening, Sani 👋</Text>
                                    <View style={s.adminBadgePill}>
                                        <Text style={s.adminBadgeText}>Super Admin</Text>
                                    </View>
                                </View>
                                <View style={s.liveRow}>
                                    <View style={s.statusDot} />
                                    <Text style={s.liveText}>Core System Online</Text>
                                </View>
                            </View>
                            <View style={s.statusPillGroup}>
                                <View style={s.datePill}>
                                    <Text style={s.dateText}>
                                        {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </Text>
                                </View>
                                <TouchableOpacity style={s.bellActionBtn}>
                                    <Ionicons name="notifications" size={14} color="#ffffff" />
                                    <View style={s.notifBadge} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Global Search Bar */}
                        <View style={s.searchBarContainer}>
                            <Ionicons name="search-outline" size={18} color={T.gold} />
                            <TextInput 
                                placeholder="Search users, transactions, logs..." 
                                placeholderTextColor="#94a3b8"
                                style={s.searchInput}
                                selectionColor={T.gold}
                            />
                            <View style={s.cmdBadge}>
                                <Text style={s.cmdText}>⌘K</Text>
                            </View>
                        </View>
                    </LinearGradient>
                    <View style={s.goldBottomStrip} />
                </View>

                {/* Floating Core Stats Card */}
                <View style={s.floatingCardContainer}>
                    <View style={s.floatingCard}>
                        <View style={s.statCol}>
                            <Ionicons name="people-outline" size={16} color={T.gold} />
                            <Text style={s.statNum}>{loading ? '...' : counts.users.toLocaleString()}</Text>
                            <Text style={s.statLabel}>Total Users</Text>
                        </View>
                        <View style={s.verticalDivider} />
                        <View style={s.statCol}>
                            <Ionicons name="scan-outline" size={16} color={counts.kyc > 0 ? '#ef4444' : T.gold} />
                            <Text style={[s.statNum, counts.kyc > 0 && { color: '#ef4444' }]}>{loading ? '...' : counts.kyc}</Text>
                            <Text style={s.statLabel}>Pending KYC</Text>
                        </View>
                        <View style={s.verticalDivider} />
                        <View style={s.statCol}>
                            <Ionicons name="chatbubbles-outline" size={16} color={T.gold} />
                            <Text style={s.statNum}>{loading ? '...' : counts.tickets}</Text>
                            <Text style={s.statLabel}>Tickets</Text>
                        </View>
                        <View style={s.verticalDivider} />
                        <View style={s.statCol}>
                            <Ionicons name="server-outline" size={16} color="#10b981" />
                            <Text style={[s.statNum, { color: '#10b981' }]}>99.9%</Text>
                            <Text style={s.statLabel}>Server</Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions Panel */}
                <View style={s.quickActionsSection}>
                    <Text style={s.sectionHeader}>Quick Actions</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickActionsScroll}>
                        {QUICK_ACTIONS.map((action, i) => (
                            <TouchableOpacity 
                                key={i} 
                                style={s.quickActionBtn}
                                onPress={() => router.push(action.route as any)}
                                activeOpacity={0.8}
                            >
                                <View style={s.quickActionIconCircle}>
                                    <Ionicons name={action.icon as any} size={22} color={T.navy} />
                                </View>
                                <Text style={s.quickActionLabel}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Bento Categories Collapsible Accordion Grid */}
                <View style={s.bentoGridSection}>
                    {renderSectionAccordion('operations')}
                    {renderSectionAccordion('banking')}
                    {renderSectionAccordion('finance')}
                    {renderSectionAccordion('technical')}
                    {renderSectionAccordion('internal')}
                    {renderSectionAccordion('redZone')}
                </View>

            </ScrollView>

            {/* Premium Floating Navigation Dock */}
            <View style={s.dockContainer}>
                {dockItems.map((item, i) => (
                    <TouchableOpacity
                        key={i}
                        onPress={() => router.push(item.route as any)}
                        style={s.dockItem}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={item.icon as any} size={22} color={T.gold} />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    headerWrapper: {
        position: 'relative',
        shadowColor: T.navy,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
    },
    headerGradient: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 56 : 36,
        paddingBottom: 48,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        overflow: 'hidden',
        position: 'relative',
    },
    orbRight: {
        position: 'absolute',
        top: -64,
        right: -64,
        width: 192,
        height: 192,
        borderRadius: 96,
        backgroundColor: 'rgba(245, 166, 35, 0.08)',
    },
    orbLeft: {
        position: 'absolute',
        bottom: -48,
        left: -48,
        width: 144,
        height: 144,
        borderRadius: 72,
        backgroundColor: 'rgba(245, 166, 35, 0.04)',
    },
    goldBottomStrip: {
        height: 4,
        backgroundColor: T.gold,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        shadowColor: T.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
    topBarBrandRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    brandLogo: {
        width: 32,
        height: 32,
    },
    brandTextContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    brandTxtTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
        lineHeight: 18,
        textShadowColor: 'rgba(245, 166, 35, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    brandTxtSub: {
        color: T.gold,
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1.5,
        lineHeight: 10,
    },
    headerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 5,
    },
    logoutBtnText: {
        color: '#cbd5e1',
        fontSize: 10,
        fontWeight: '700',
    },
    welcomeStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 18,
    },
    welcomeText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '600',
    },
    liveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
        marginRight: 6,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    liveText: {
        color: '#10b981',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusPillGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    datePill: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    dateText: {
        color: '#cbd5e1',
        fontSize: 9,
        fontWeight: '700',
    },
    bellActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    notifBadge: {
        position: 'absolute',
        top: 9,
        right: 9,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    avatarDoubleRing: {
        width: 40,
        height: 40,
        borderRadius: 20,
        padding: 2,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
    },
    avatarMiddleRing: {
        width: 34,
        height: 34,
        borderRadius: 17,
        padding: 1.5,
        backgroundColor: '#0d1b3e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInnerCircle: {
        width: 29,
        height: 29,
        borderRadius: 14.5,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLetters: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 10,
        letterSpacing: 0.5,
    },
    avatarActiveDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#0d1b3e',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
    },
    adminBadgePill: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.4)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 8,
    },
    adminBadgeText: {
        color: T.gold,
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(13, 27, 62, 0.6)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        borderWidth: 1.5,
        borderColor: 'rgba(245, 166, 35, 0.3)',
        shadowColor: T.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '500',
    },
    cmdBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    cmdText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: '700',
    },
    floatingCardContainer: {
        paddingHorizontal: 16,
        marginTop: -26,
        zIndex: 20,
    },
    floatingCard: {
        backgroundColor: '#0d1b3e',
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 10,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowColor: T.gold,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 1.5,
        borderColor: T.gold,
    },
    statCol: {
        alignItems: 'center',
        flex: 1,
    },
    statNum: {
        fontSize: 15,
        fontWeight: '900',
        color: '#ffffff',
        marginTop: 4,
        marginBottom: 1,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#cbd5e1',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    verticalDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(245, 166, 35, 0.25)',
    },
    quickActionsSection: {
        marginTop: 20,
        paddingLeft: 16,
    },
    quickActionsScroll: {
        paddingRight: 16,
        gap: 12,
        marginTop: 8,
    },
    quickActionBtn: {
        alignItems: 'center',
        marginRight: 6,
    },
    quickActionIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(245, 166, 35, 0.25)',
        backgroundColor: '#ffffff',
        shadowColor: T.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    quickActionLabel: {
        color: T.text,
        fontSize: 10,
        fontWeight: '700',
        marginTop: 6,
    },
    bentoGridSection: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    accordionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)',
        overflow: 'hidden',
        shadowColor: T.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    accordionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
    },
    accordionHeaderExpanded: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245, 166, 35, 0.15)',
        backgroundColor: 'rgba(13, 27, 62, 0.01)',
    },
    accordionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accordionIconBg: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    accordionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: T.navy,
    },
    accordionSubtitle: {
        fontSize: 10,
        color: T.textSub,
        fontWeight: '500',
        marginTop: 1,
    },
    accordionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionBadgeContainer: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionBadgeText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
    },
    accordionBody: {
        padding: 12,
        backgroundColor: '#fcfdfe',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
    },
    gridCard: {
        width: '31%',
        height: 78,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 8,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.15)',
        shadowColor: T.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    gridCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconBg: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeContainer: {
        backgroundColor: '#ef4444',
        borderRadius: 8,
        minWidth: 14,
        height: 14,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ffffff',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '800',
    },
    gridCardFooter: {
        alignItems: 'flex-start',
    },
    statText: {
        color: '#10b981',
        fontSize: 8,
        fontWeight: '700',
        marginBottom: 1,
    },
    gridCardTitle: {
        fontWeight: '700',
        fontSize: 10,
        color: T.navy,
    },
    sectionHeader: {
        fontSize: 10,
        fontWeight: '800',
        color: T.textSub,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 10,
        paddingLeft: 4,
    },
    dockContainer: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(13, 27, 62, 0.96)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 24,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f5a62380',
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    dockItem: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)',
    },
});
