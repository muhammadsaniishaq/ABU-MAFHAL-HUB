import { View, Text, ScrollView, TouchableOpacity, Dimensions, TextInput, ActivityIndicator, StyleSheet, Platform, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        { title: 'Users Control', icon: 'people-outline', route: '/manage/users', color: '#3B82F6' },
        { title: 'Mail Center', icon: 'mail-unread-outline', route: '/manage/mail-center', color: '#F59E0B' },
        { title: 'KYC Requests', icon: 'id-card-outline', route: '/manage/kyc', color: '#10B981', badge: 0 },
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
        { title: 'Bulk SMS', icon: 'chatbubbles-outline', route: '/manage/bulk-sms', color: '#3B82F6' },
        { title: 'Reviews Control', icon: 'star-outline', route: '/manage/reviews', color: '#F59E0B' },
    ],
    banking: [
        { title: 'API Wallets & Liquidity', icon: 'wallet-outline', route: '/manage/liquidity', color: '#10B981', badge: 'Live Balances' },
        { title: 'Cards', icon: 'card-outline', route: '/manage/cards', color: '#EC4899' },
        { title: 'Lending', icon: 'cash-outline', route: '/manage/lending', color: '#10B981', badge: 0 },
        { title: 'Wealth', icon: 'briefcase-outline', route: '/manage/wealth', color: '#8B5CF6' },
        { title: 'Rates', icon: 'trending-up-outline', route: '/manage/rates', color: '#F59E0B', stat: 'Live' },
    ],
    finance: [
        { title: 'Risk', icon: 'alert-circle-outline', route: '/manage/risk', color: '#EF4444' },
        { title: 'Analytics', icon: 'bar-chart-outline', route: '/manage/reports', color: '#F59E0B' },
        { title: 'Comms Center', icon: 'megaphone-outline', route: '/manage/communications', color: '#F472B6' },
        { title: 'Cortex AI', icon: 'sparkles-outline', route: '/manage/ai', color: '#818CF8', dark: true },
        { title: 'Crypto Mgmt', icon: 'logo-bitcoin', route: '/manage/crypto', color: '#F7931A' },
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
        { title: 'API Vault', icon: 'key-outline', route: '/manage/api', color: '#F59E0B', dark: true },
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
    const [adminProfile, setAdminProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [logoIconUrl, setLogoIconUrl] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        operations: true,
        banking: false,
        finance: false,
        technical: false,
        internal: false,
        redZone: false,
    });

    const [hiddenAdminModules, setHiddenAdminModules] = useState<string[]>([]);

    useEffect(() => {
        // Restore cached profile instantly on mount to avoid blink/empty state on page refresh
        AsyncStorage.getItem('@cached_admin_profile').then(cachedStr => {
            if (cachedStr) {
                try {
                    const parsed = JSON.parse(cachedStr);
                    if (parsed) setAdminProfile(parsed);
                } catch (e) {}
            }
        });

        fetchCounts();
        fetchLogoIcon();
        fetchHiddenAdminModules();
    }, []);

    const fetchHiddenAdminModules = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: customData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', `admin_hidden_modules_${user.id}`)
                    .single();

                if (customData?.value) {
                    const parsedCustom = typeof customData.value === 'string' ? JSON.parse(customData.value) : customData.value;
                    if (Array.isArray(parsedCustom)) {
                        setHiddenAdminModules(parsedCustom);
                        return;
                    }
                }
            }

            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'hidden_admin_modules')
                .single();

            if (data?.value) {
                const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                if (Array.isArray(parsed)) setHiddenAdminModules(parsed);
            }
        } catch (e) {
            console.error('Error fetching hidden admin modules:', e);
        }
    };

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
            const { data: { session } } = await supabase.auth.getSession();
            let user = session?.user;
            if (!user) {
                const { data: { user: fetchedUser } } = await supabase.auth.getUser();
                user = fetchedUser || undefined;
            }

            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                const profToSet = profile || {
                    id: user.id,
                    full_name: user.user_metadata?.full_name || 'Super Admin',
                    email: user.email,
                    role: user.user_metadata?.role || 'admin',
                    avatar_url: user.user_metadata?.avatar_url || null
                };
                setAdminProfile(profToSet);
                AsyncStorage.setItem('@cached_admin_profile', JSON.stringify(profToSet)).catch(() => {});
            }

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
    modules.operations[7].badge = counts.tickets;
    modules.banking[1].badge = counts.loans;
    modules.internal[3].badge = counts.chats;

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isModuleHiddenForStaff = (itemRoute: string) => {
        // By default, if loading or if user is any admin/owner, SHOW ALL MODULES
        if (!adminProfile || ['admin', 'super_admin'].includes(adminProfile?.role)) return false;
        
        const userEmail = adminProfile?.email?.toLowerCase() || '';
        if (userEmail.includes('admin') || userEmail.includes('abumafhal') || userEmail === 'sale.abumafhal@gmail.com' || userEmail === 'abumafhal@gmail.com') {
            return false;
        }

        const routeParts = itemRoute.split('/');
        const rawKey = routeParts[routeParts.length - 1]?.replace(/-/g, '_');

        const customRouteMap: Record<string, string> = {
            '/manage/nin-pricing': 'nin_pricing',
            '/manage/smm-pricing': 'smm_pricing',
            '/manage/bills-pricing': 'bills_pricing',
            '/manage/data-plans': 'data_plans',
            '/manage/bulk-sms': 'bulk_sms',
        };

        const moduleKey = customRouteMap[itemRoute] || rawKey;
        return !!(moduleKey && hiddenAdminModules.includes(moduleKey));
    };

    const renderSectionAccordion = (key: keyof typeof modules) => {
        const meta = categoryMeta[key];
        const allItems = modules[key];

        const isOwnerOrAdmin = !adminProfile || ['admin', 'super_admin'].includes(adminProfile?.role) || adminProfile?.email?.toLowerCase().includes('abumafhal') || adminProfile?.email?.toLowerCase().includes('admin');
        const items = isOwnerOrAdmin ? allItems : allItems.filter(item => !isModuleHiddenForStaff(item.route));

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
                            {items.map((item, i) => {
                                const isRedZoneModule = key === 'redZone' || item.route === '/manage/staff' || item.route === '/manage/features';
                                const isLockedForAdmin = isRedZoneModule && adminProfile?.role !== 'super_admin';

                                return (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => {
                                            if (isLockedForAdmin) {
                                                Alert.alert(
                                                    'Access Restricted 🔒',
                                                    'Only Super Admin (Master Key) has permission to access Security RedZone, Panic Room, or Staff HR.'
                                                );
                                                return;
                                            }
                                            router.push(item.route as any);
                                        }}
                                        style={[s.gridCard, isLockedForAdmin && { opacity: 0.6 }]}
                                        activeOpacity={0.7}
                                    >
                                        <View style={s.gridCardHeader}>
                                            <View style={[s.iconBg, { backgroundColor: isLockedForAdmin ? '#ef444415' : item.color + '12' }]}>
                                                <Ionicons name={isLockedForAdmin ? "lock-closed" : (item.icon as any)} size={14} color={isLockedForAdmin ? "#ef4444" : item.color} />
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
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={s.container}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
                
                {/* Futuristic Admin Header */}
                <View style={s.headerWrapper}>
                    <LinearGradient
                        colors={['#020617', '#0F172A', '#1E293B']}
                        locations={[0, 0.6, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={s.headerGradient}
                    >
                        {/* Glowing Decorative Orbs */}
                        <View style={s.orbRight} />
                        <View style={s.orbLeft} />

                        {/* Top Bar Brand & User Row */}
                        <View style={s.topBarBrandRow}>
                            <View style={s.brandRow}>
                                <View style={{ padding: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)' }}>
                                    <Image 
                                        source={logoIconUrl ? { uri: logoIconUrl } : require('../../assets/images/logo-icon.png')} 
                                        style={s.brandLogo as any}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View style={s.brandTextContainer}>
                                    <Text style={s.brandTxtTitle}>ABU MAFHAL</Text>
                                    <Text style={s.brandTxtSub}>ADMIN COMMAND CENTRE</Text>
                                </View>
                            </View>

                            <View style={s.headerActionRow}>
                                <TouchableOpacity 
                                    onPress={() => router.replace('/(app)/dashboard')}
                                    style={s.logoutBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="apps-outline" size={12} color="#FFD700" />
                                    <Text style={s.logoutBtnText}>User App</Text>
                                </TouchableOpacity>
                                
                                {/* Double Gold Ring Avatar */}
                                <TouchableOpacity 
                                    style={{ position: 'relative' }}
                                    activeOpacity={0.85}
                                    onPress={() => router.push('/manage/profile')}
                                >
                                    <View style={s.avatarDoubleRing}>
                                        <View style={s.avatarMiddleRing}>
                                            <View style={s.avatarInnerCircle}>
                                                {adminProfile?.avatar_url ? (
                                                    <Image 
                                                        source={{ uri: adminProfile.avatar_url }} 
                                                        style={{ width: '100%', height: '100%', borderRadius: 999 }}
                                                    />
                                                ) : (
                                                    <Text style={s.avatarLetters}>{adminProfile?.full_name?.[0]?.toUpperCase() || 'A'}</Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                    <View style={s.avatarActiveDot} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Welcome & Status Bar Row (No Collision Layout) */}
                        <View style={s.welcomeStatusRow}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3 }}>
                                    <Text style={s.welcomeText}>Welcome back, {adminProfile?.full_name?.split(' ')[0] || 'Admin'} 👋</Text>
                                    <View style={[s.adminBadgePill, adminProfile?.role === 'super_admin' && { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700' }]}>
                                        <Text style={[s.adminBadgeText, adminProfile?.role === 'super_admin' && { color: '#FFD700', fontWeight: '900' }]}>
                                            {adminProfile?.role === 'super_admin' ? '👑 MASTER KEY' : 'STAFF ADMIN'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={s.liveRow}>
                                    <View style={s.statusDot} />
                                    <Text style={s.liveText}>Core System Online & Secured</Text>
                                </View>
                            </View>
                        </View>

                        {/* Global Search Bar */}
                        <View style={s.searchBarContainer}>
                            <Ionicons name="search-outline" size={15} color="#FFD700" />
                            <TextInput 
                                placeholder="Search users, transactions, logs..." 
                                placeholderTextColor="#94A3B8"
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
                            <Ionicons name="people-outline" size={14} color={T.gold} />
                            <Text style={s.statNum}>{loading ? '...' : counts.users.toLocaleString()}</Text>
                            <Text style={s.statLabel}>Users</Text>
                        </View>
                        <View style={s.verticalDivider} />
                        <View style={s.statCol}>
                            <Ionicons name="scan-outline" size={14} color={counts.kyc > 0 ? '#EF4444' : T.gold} />
                            <Text style={[s.statNum, counts.kyc > 0 && { color: '#EF4444' }]}>{loading ? '...' : counts.kyc}</Text>
                            <Text style={s.statLabel}>Pending KYC</Text>
                        </View>
                        <View style={s.verticalDivider} />
                        <View style={s.statCol}>
                            <Ionicons name="chatbubbles-outline" size={14} color={T.gold} />
                            <Text style={s.statNum}>{loading ? '...' : counts.tickets}</Text>
                            <Text style={s.statLabel}>Tickets</Text>
                        </View>
                        <View style={s.verticalDivider} />
                        <View style={s.statCol}>
                            <Ionicons name="server-outline" size={14} color="#10B981" />
                            <Text style={[s.statNum, { color: '#10B981' }]}>99.9%</Text>
                            <Text style={s.statLabel}>Server</Text>
                        </View>
                    </View>
                </View>

                {/* Dynamic Quick Actions / Master Control Panel */}
                {adminProfile?.role === 'super_admin' ? (
                    <View style={s.quickActionsSection}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={s.sectionHeader}>👑 Super Admin Master Controls</Text>
                            <View style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                <Text style={{ color: T.gold, fontSize: 12, fontWeight: 'bold' }}>ROOT PERMISSIONS</Text>
                            </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickActionsScroll}>
                            <TouchableOpacity 
                                style={s.superControlCard}
                                onPress={() => router.push('/manage/super-admin' as any)}
                                activeOpacity={0.8}
                            >
                                <View style={[s.superIconBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                    <Ionicons name="ribbon" size={22} color="#d97706" />
                                </View>
                                <Text style={s.superCardLabel}>Master Hub</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={s.superControlCard}
                                onPress={() => router.push('/manage/staff')}
                                activeOpacity={0.8}
                            >
                                <View style={[s.superIconBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                                    <Ionicons name="people" size={22} color="#2563eb" />
                                </View>
                                <Text style={s.superCardLabel}>Staff & Roles</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={s.superControlCard}
                                onPress={() => router.push('/manage/features')}
                                activeOpacity={0.8}
                            >
                                <View style={[s.superIconBox, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
                                    <Ionicons name="toggle" size={22} color="#ea580c" />
                                </View>
                                <Text style={s.superCardLabel}>Feature Flags</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={s.superControlCard}
                                onPress={() => router.push('/manage/security')}
                                activeOpacity={0.8}
                            >
                                <View style={[s.superIconBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                                    <Ionicons name="shield-checkmark" size={22} color="#16a34a" />
                                </View>
                                <Text style={s.superCardLabel}>Security Hub</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={s.superControlCard}
                                onPress={() => router.push('/manage/panic')}
                                activeOpacity={0.8}
                            >
                                <View style={[s.superIconBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                                    <Ionicons name="warning" size={22} color="#dc2626" />
                                </View>
                                <Text style={s.superCardLabel}>Panic Room</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                ) : (
                    <View style={s.quickActionsSection}>
                        <Text style={s.sectionHeader}>Staff Operational Actions</Text>
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
                )}

                {/* Bento Categories Accordion Grid (Filtered for Staff Admins) */}
                <View style={s.bentoGridSection}>
                    {renderSectionAccordion('operations')}
                    {renderSectionAccordion('banking')}
                    {renderSectionAccordion('finance')}
                    {adminProfile?.role === 'super_admin' && renderSectionAccordion('technical')}
                    {renderSectionAccordion('internal')}
                    {adminProfile?.role === 'super_admin' && renderSectionAccordion('redZone')}
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
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    headerGradient: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 52 : 32,
        paddingBottom: 38,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
        position: 'relative',
    },
    orbRight: {
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#4F46E5',
        opacity: 0.15,
    },
    orbLeft: {
        position: 'absolute',
        bottom: -50,
        left: -100,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#10B981',
        opacity: 0.1,
    },
    goldBottomStrip: {
        height: 3,
        backgroundColor: '#FFD700',
        width: '100%',
        position: 'absolute',
        bottom: 0,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
    },
    topBarBrandRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandLogo: {
        width: 26,
        height: 26,
    },
    brandTextContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    brandTxtTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
        lineHeight: 16,
    },
    brandTxtSub: {
        color: T.gold,
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1,
        lineHeight: 10,
    },
    headerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.35)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 10,
        gap: 4,
        height: 28,
    },
    logoutBtnText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '800',
    },
    welcomeStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    welcomeText: {
        color: '#F8FAFC',
        fontSize: 11,
        fontWeight: '700',
    },
    adminBadgePill: {
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.4)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    adminBadgeText: {
        color: T.gold,
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    liveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 5,
    },
    liveText: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '900',
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
        fontSize: 12,
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
        width: 34,
        height: 34,
        borderRadius: 17,
        padding: 1.5,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarMiddleRing: {
        width: 30,
        height: 30,
        borderRadius: 15,
        padding: 1,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInnerCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLetters: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 11,
        letterSpacing: 0.5,
    },
    avatarActiveDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
        borderWidth: 1.5,
        borderColor: '#0F172A',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#060B19',
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 36,
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.35)',
    },
    searchInput: {
        flex: 1,
        marginLeft: 6,
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '500',
    },
    cmdBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    cmdText: {
        color: '#CBD5E1',
        fontSize: 9,
        fontWeight: '800',
    },
    floatingCardContainer: {
        paddingHorizontal: 12,
        marginTop: -18,
        zIndex: 20,
    },
    floatingCard: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 8,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: T.goldDk,
        elevation: 6,
    },
    statCol: {
        alignItems: 'center',
        flex: 1,
    },
    statNum: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
        marginBottom: 1,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    verticalDivider: {
        width: 1,
        height: 22,
        backgroundColor: 'rgba(218, 165, 32, 0.3)',
    },
    quickActionsSection: {
        marginTop: 20,
        paddingLeft: 16,
    },
    quickActionsScroll: {
        paddingRight: 16,
        gap: 10,
        marginTop: 8,
    },
    superControlCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.2)',
        shadowColor: T.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    superIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: 6,
    },
    superCardLabel: {
        color: T.navy,
        fontSize: 12,
        fontWeight: '800',
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
        fontSize: 12,
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
        fontSize: 12,
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
        fontSize: 12,
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
        fontSize: 12,
        fontWeight: '800',
    },
    gridCardFooter: {
        alignItems: 'flex-start',
    },
    statText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 1,
    },
    gridCardTitle: {
        fontWeight: '700',
        fontSize: 12,
        color: T.navy,
    },
    sectionHeader: {
        fontSize: 12,
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
