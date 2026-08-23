import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy: '#0d1b3e',
  navyMid: '#142258',
  gold: '#f5a623',
  goldDk: '#d4890e',
  white: '#ffffff',
  bg: '#090d16',
  cardBg: '#0f172a',
  text: '#ffffff',
  textSub: '#94a3b8',
  indigo: '#4F46E5',
  border: 'rgba(245, 166, 35, 0.25)',
};

// ALL MODULE CONFIGURATIONS
const modules = {
  operations: [
    { title: 'Users Control', icon: 'people-outline', route: '/manage/users', color: '#3B82F6', badgeText: 'Core' },
    { title: 'Mail Center', icon: 'mail-unread-outline', route: '/manage/mail-center', color: '#F59E0B' },
    { title: 'KYC Requests', icon: 'id-card-outline', route: '/manage/kyc', color: '#10B981', badge: 0 },
    { title: 'NIN Pricing', icon: 'pricetag-outline', route: '/manage/nin-pricing', color: '#059669' },
    { title: 'SMM Pricing', icon: 'thumbs-up-outline', route: '/manage/smm-pricing', color: '#8B5CF6' },
    { title: 'Bills Pricing', icon: 'flash-outline', route: '/manage/bills-pricing', color: '#f5a623' },
    { title: 'CAC Management', icon: 'briefcase-outline', route: '/manage/cac', color: '#10B981' },
    { title: 'Help Desk', icon: 'chatbubbles-outline', route: '/manage/tickets', color: '#EC4899', badge: 0 },
    { title: 'Content CMS', icon: 'images-outline', route: '/manage/cms', color: '#6366F1' },
    { title: 'Data Plans', icon: 'wifi-outline', route: '/manage/data-plans', color: '#0EA5E9', badgeText: 'API' },
    { title: 'Airtime', icon: 'call-outline', route: '/manage/airtime', color: '#10B981' },
    { title: 'Localization', icon: 'language-outline', route: '/manage/localization', color: '#8B5CF6' },
    { title: 'Bulk SMS', icon: 'chatbubbles-outline', route: '/manage/bulk-sms', color: '#3B82F6' },
    { title: 'Reviews Control', icon: 'star-outline', route: '/manage/reviews', color: '#F59E0B' },
  ],
  banking: [
    { title: 'API Liquidity', icon: 'wallet-outline', route: '/manage/liquidity', color: '#10B981', badgeText: 'Live' },
    { title: 'Cards', icon: 'card-outline', route: '/manage/cards', color: '#EC4899' },
    { title: 'Lending', icon: 'cash-outline', route: '/manage/lending', color: '#10B981', badge: 0 },
    { title: 'Wealth', icon: 'briefcase-outline', route: '/manage/wealth', color: '#8B5CF6' },
    { title: 'Rates', icon: 'trending-up-outline', route: '/manage/rates', color: '#F59E0B', stat: 'Live' },
  ],
  finance: [
    { title: 'Risk Control', icon: 'alert-circle-outline', route: '/manage/risk', color: '#EF4444' },
    { title: 'Analytics', icon: 'bar-chart-outline', route: '/manage/reports', color: '#F59E0B' },
    { title: 'Comms Center', icon: 'megaphone-outline', route: '/manage/communications', color: '#F472B6' },
    { title: 'Cortex AI', icon: 'sparkles-outline', route: '/manage/ai', color: '#818CF8', dark: true },
    { title: 'Crypto Mgmt', icon: 'logo-bitcoin', route: '/manage/crypto', color: '#F7931A' },
  ],
  technical: [
    { title: 'Infra Status', icon: 'server-outline', route: '/manage/infrastructure', color: '#475569' },
    { title: 'Database', icon: 'server', route: '/manage/db', color: '#10B981', dark: true },
    { title: 'API Vault', icon: 'code-working-outline', route: '/manage/api', color: '#6366F1' },
    { title: 'Cinema', icon: 'videocam-outline', route: '/manage/cinema', color: '#EF4444', dark: true },
    { title: 'Terminal', icon: 'terminal-outline', route: '/manage/terminal', color: '#22C55E' },
    { title: 'Features', icon: 'toggle-outline', route: '/manage/features', color: '#F97316' },
    { title: 'App Store', icon: 'logo-apple', route: '/manage/stores', color: '#000000', badge: 1 },
    { title: 'Files', icon: 'folder-open-outline', route: '/manage/files', color: '#0EA5E9' },
  ],
  internal: [
    { title: 'Staff HR', icon: 'briefcase-outline', route: '/manage/staff', color: '#64748B' },
    { title: 'Voice OS', icon: 'mic-outline', route: '/manage/voice', color: '#8B5CF6', dark: true },
    { title: 'Legal', icon: 'document-text-outline', route: '/manage/legal', color: '#64748B' },
    { title: 'Team Chat', icon: 'people-circle-outline', route: '/manage/team', color: '#EF4444', badge: 0 },
    { title: 'Academy', icon: 'school-outline', route: '/manage/academy', color: '#F59E0B' },
    { title: 'Theme & UX', icon: 'color-palette-outline', route: '/manage/appearance', color: '#EC4899' },
    { title: 'Automation', icon: 'flash-outline', route: '/manage/automation', color: '#6366F1' },
    { title: 'Kanban Board', icon: 'grid-outline', route: '/manage/kanban', color: '#F97316' },
  ],
  redZone: [
    { title: 'Security Hub', icon: 'shield-checkmark-outline', route: '/manage/security', color: '#3B82F6' },
    { title: 'Forensics', icon: 'finger-print-outline', route: '/manage/forensics', color: '#8B5CF6' },
    { title: 'API Vault Keys', icon: 'key-outline', route: '/manage/api', color: '#F59E0B', dark: true },
    { title: 'System Logs', icon: 'list-outline', route: '/manage/logs', color: '#64748B' },
    { title: 'Live Geo Map', icon: 'earth-outline', route: '/manage/map', color: '#06B6D4' },
    { title: 'Settings', icon: 'settings-outline', route: '/manage/settings', color: '#475569' },
    { title: 'PANIC ROOM', icon: 'warning-outline', route: '/manage/panic', color: '#EF4444', dark: true },
  ]
};

const QUICK_ACTIONS = [
  { id: 'master', label: 'Master Hub', icon: 'ribbon-outline', color: '#F59E0B', route: '/manage/super-admin', superOnly: true },
  { id: 'user', label: 'Users Control', icon: 'people-outline', color: '#3B82F6', route: '/manage/users' },
  { id: 'money', label: 'API Liquidity', icon: 'wallet-outline', color: '#10B981', route: '/manage/liquidity' },
  { id: 'data', label: 'Data Plans', icon: 'wifi-outline', color: '#0EA5E9', route: '/manage/data-plans' },
  { id: 'tickets', label: 'Tickets Desk', icon: 'chatbubbles-outline', color: '#EC4899', route: '/manage/tickets' },
  { id: 'broadcast', label: 'Broadcast', icon: 'megaphone-outline', color: '#F472B6', route: '/manage/communications' },
  { id: 'panic', label: 'Panic Room', icon: 'warning-outline', color: '#EF4444', route: '/manage/panic', superOnly: true },
];

const dockItems = [
  { icon: 'grid-outline', route: '/manage', label: 'Dashboard' },
  { icon: 'people-outline', route: '/manage/users', label: 'Users' },
  { icon: 'wallet-outline', route: '/manage/liquidity', label: 'Liquidity' },
  { icon: 'chatbubbles-outline', route: '/manage/tickets', label: 'Tickets' },
  { icon: 'settings-outline', route: '/manage/settings', label: 'Settings' },
];

const categoryMeta = {
  operations: { title: 'Operations & Core Services', icon: 'options-outline', color: '#F59E0B' },
  banking: { title: 'Banking, Liquidity & Assets', icon: 'wallet-outline', color: '#10B981' },
  finance: { title: 'Markets, Crypto & Analytics', icon: 'stats-chart-outline', color: '#3B82F6' },
  technical: { title: 'Technical Infra & Database', icon: 'terminal-outline', color: '#6366F1' },
  internal: { title: 'Internal Affairs & Staff', icon: 'business-outline', color: '#8B5CF6' },
  redZone: { title: 'Security, Forensics & RedZone', icon: 'shield-checkmark-outline', color: '#EF4444' }
};

export default function AdminDashboard() {
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
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [hiddenAdminModules, setHiddenAdminModules] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
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

  // Dynamic badges
  modules.operations[2].badge = counts.kyc;
  modules.operations[7].badge = counts.tickets;
  modules.banking[1].badge = counts.loans;
  modules.internal[3].badge = counts.chats;

  const isModuleHiddenForStaff = (itemRoute: string) => {
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

  const renderSectionPanel = (key: keyof typeof modules) => {
    const meta = categoryMeta[key];
    const allItems = modules[key];
    const isOwnerOrAdmin = !adminProfile || ['admin', 'super_admin'].includes(adminProfile?.role) || adminProfile?.email?.toLowerCase().includes('abumafhal') || adminProfile?.email?.toLowerCase().includes('admin');
    
    let items = isOwnerOrAdmin ? allItems : allItems.filter(item => !isModuleHiddenForStaff(item.route));

    // Filter by live search query if typed
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item => item.title.toLowerCase().includes(q) || item.route.toLowerCase().includes(q));
    }

    if (items.length === 0) return null;

    return (
      <View key={key} style={s.accordionCard}>
        <View style={s.accordionHeader}>
          <View style={s.accordionHeaderLeft}>
            <View style={[
              s.accordionIconBg,
              { backgroundColor: key === 'redZone' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 166, 35, 0.12)' }
            ]}>
              <Ionicons 
                name={meta.icon as any} 
                size={16} 
                color={key === 'redZone' ? '#EF4444' : '#F59E0B'} 
              />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.accordionTitle}>{meta.title}</Text>
              <Text style={s.accordionSubtitle}>
                {items.length} module{items.length !== 1 ? 's' : ''} available
              </Text>
            </View>
          </View>
          
          <View style={s.accordionHeaderRight}>
            {items.reduce((sum, item) => sum + ((item as any).badge || 0), 0) > 0 && (
              <View style={s.sectionBadgeContainer}>
                <Text style={s.sectionBadgeText}>
                  {items.reduce((sum, item) => sum + ((item as any).badge || 0), 0)} ACTION
                </Text>
              </View>
            )}
          </View>
        </View>

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
                  activeOpacity={0.75}
                >
                  <View style={s.gridCardHeader}>
                    <View style={[s.iconBg, { backgroundColor: isLockedForAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 166, 35, 0.12)' }]}>
                      <Ionicons name={isLockedForAdmin ? "lock-closed" : (item.icon as any)} size={16} color={isLockedForAdmin ? "#EF4444" : (item.color || "#F59E0B")} />
                    </View>
                    {(item as any).badge > 0 && (
                      <View style={s.badgeContainer}>
                        <Text style={s.badgeText}>{(item as any).badge}</Text>
                      </View>
                    )}
                    {(item as any).badgeText && (
                      <View style={[s.badgeContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981', borderWidth: 0.5 }]}>
                        <Text style={[s.badgeText, { color: '#10B981' }]}>{(item as any).badgeText}</Text>
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
      </View>
    );
  };

  const categoryTabs = [
    { id: 'all', label: 'All Modules', icon: 'grid-outline' },
    { id: 'operations', label: 'Operations', icon: 'options-outline' },
    { id: 'banking', label: 'Banking', icon: 'wallet-outline' },
    { id: 'finance', label: 'Finance', icon: 'stats-chart-outline' },
    { id: 'technical', label: 'Technical', icon: 'terminal-outline', superOnly: true },
    { id: 'internal', label: 'Internal', icon: 'business-outline' },
    { id: 'redZone', label: 'Security', icon: 'shield-checkmark-outline', superOnly: true },
  ];

  const filteredCategoryTabs = categoryTabs.filter(t => !t.superOnly || adminProfile?.role === 'super_admin');

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        
        {/* Futuristic Mobile-First Glassmorphic Header */}
        <View style={s.headerWrapper}>
          <LinearGradient
            colors={['#020617', '#0F172A', '#1E293B']}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.headerGradient}
          >
            {/* Glowing Decorative Background Orbs */}
            <View style={s.orbRight} />
            <View style={s.orbLeft} />

            {/* Top Bar Brand & User Profile */}
            <View style={s.topBarBrandRow}>
              <View style={s.brandRow}>
                <View style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,166,35,0.4)' }}>
                  <Image 
                    source={logoIconUrl ? { uri: logoIconUrl } : require('../../assets/images/logo-icon.png')} 
                    style={s.brandLogo as any}
                    resizeMode="contain"
                  />
                </View>
                <View style={s.brandTextContainer}>
                  <Text style={s.brandTxtTitle}>ABU MAFHAL</Text>
                  <Text style={s.brandTxtSub}>SUPER COMMAND CENTRE</Text>
                </View>
              </View>

              <View style={s.headerActionRow}>
                <TouchableOpacity 
                  onPress={() => router.replace('/(app)/dashboard')}
                  style={s.userAppBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="apps-outline" size={13} color="#F59E0B" />
                  <Text style={s.userAppBtnText}>User App</Text>
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

            {/* Welcome Greeting & Security Pill */}
            <View style={s.welcomeStatusRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  <Text style={s.welcomeText}>Welcome back, {adminProfile?.full_name?.split(' ')[0] || 'Super Admin'} 👋</Text>
                  <View style={[s.adminBadgePill, adminProfile?.role === 'super_admin' && { backgroundColor: 'rgba(245, 166, 35, 0.2)', borderColor: '#F59E0B' }]}>
                    <Text style={[s.adminBadgeText, adminProfile?.role === 'super_admin' && { color: '#F59E0B', fontWeight: '900' }]}>
                      {adminProfile?.role === 'super_admin' ? '👑 MASTER KEY' : '🛡️ STAFF ADMIN'}
                    </Text>
                  </View>
                </View>
                <View style={s.liveRow}>
                  <View style={s.statusDot} />
                  <Text style={s.liveText}>Core System Online • Encrypted & Secured</Text>
                </View>
              </View>
            </View>

            {/* Instant Search Bar */}
            <View style={s.searchBarContainer}>
              <Ionicons name="search-outline" size={16} color="#F59E0B" />
              <TextInput 
                placeholder="Search users, liquidity, logs, modules..." 
                placeholderTextColor="#94A3B8"
                style={s.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={T.gold}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : (
                <View style={s.cmdBadge}>
                  <Text style={s.cmdText}>⌘K</Text>
                </View>
              )}
            </View>
          </LinearGradient>
          <View style={s.goldBottomStrip} />
        </View>

        {/* Floating Mobile-First Core Stats Card */}
        <View style={s.floatingCardContainer}>
          <View style={s.floatingCard}>
            <View style={s.statCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people-outline" size={14} color={T.gold} />
                <Text style={s.statNum}>{loading ? '...' : counts.users.toLocaleString()}</Text>
              </View>
              <Text style={s.statLabel}>Total Users</Text>
            </View>
            <View style={s.verticalDivider} />
            <View style={s.statCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="scan-outline" size={14} color={counts.kyc > 0 ? '#EF4444' : T.gold} />
                <Text style={[s.statNum, counts.kyc > 0 && { color: '#EF4444' }]}>{loading ? '...' : counts.kyc}</Text>
              </View>
              <Text style={s.statLabel}>Pending KYC</Text>
            </View>
            <View style={s.verticalDivider} />
            <View style={s.statCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubbles-outline" size={14} color={T.gold} />
                <Text style={s.statNum}>{loading ? '...' : counts.tickets}</Text>
              </View>
              <Text style={s.statLabel}>Tickets</Text>
            </View>
            <View style={s.verticalDivider} />
            <View style={s.statCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="server-outline" size={14} color="#10B981" />
                <Text style={[s.statNum, { color: '#10B981' }]}>99.9%</Text>
              </View>
              <Text style={s.statLabel}>Server</Text>
            </View>
          </View>
        </View>

        {/* Master Controls Section */}
        <View style={s.quickActionsSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 16 }}>
            <Text style={s.sectionHeader}>⚡ Quick Admin Actions</Text>
            <View style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.4)' }}>
              <Text style={{ color: T.gold, fontSize: 9, fontWeight: '900' }}>MASTER CONTROLS</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickActionsScroll}>
            {QUICK_ACTIONS.filter(act => !act.superOnly || adminProfile?.role === 'super_admin').map((act, i) => (
              <TouchableOpacity 
                key={i} 
                style={s.superControlCard}
                onPress={() => router.push(act.route as any)}
                activeOpacity={0.8}
              >
                <View style={[s.superIconBox, { backgroundColor: `${act.color}15`, borderColor: `${act.color}40` }]}>
                  <Ionicons name={act.icon as any} size={18} color={act.color} />
                </View>
                <Text style={s.superCardLabel}>{act.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Enterprise Category Segment Tabs */}
        <View style={{ marginTop: 16, marginBottom: 8, paddingHorizontal: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filteredCategoryTabs.map(tab => {
              const isSelected = activeCategoryTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveCategoryTab(tab.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: isSelected ? '#F59E0B' : '#0F172A',
                    borderColor: isSelected ? '#F59E0B' : 'rgba(245, 166, 35, 0.25)'
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={tab.icon as any} size={14} color={isSelected ? '#020617' : '#F59E0B'} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: isSelected ? '#020617' : '#F59E0B' }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Module Bento Panels */}
        <View style={s.bentoGridSection}>
          {(activeCategoryTab === 'all' || activeCategoryTab === 'operations') && renderSectionPanel('operations')}
          {(activeCategoryTab === 'all' || activeCategoryTab === 'banking') && renderSectionPanel('banking')}
          {(activeCategoryTab === 'all' || activeCategoryTab === 'finance') && renderSectionPanel('finance')}
          {adminProfile?.role === 'super_admin' && (activeCategoryTab === 'all' || activeCategoryTab === 'technical') && renderSectionPanel('technical')}
          {(activeCategoryTab === 'all' || activeCategoryTab === 'internal') && renderSectionPanel('internal')}
          {adminProfile?.role === 'super_admin' && (activeCategoryTab === 'all' || activeCategoryTab === 'redZone') && renderSectionPanel('redZone')}
        </View>

      </ScrollView>

      {/* Floating Bottom Navigation Command Dock */}
      <View style={s.dockContainer}>
        {dockItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => router.push(item.route as any)}
            style={s.dockItem}
            activeOpacity={0.8}
          >
            <Ionicons name={item.icon as any} size={20} color={T.gold} />
            <Text style={s.dockLabel}>{item.label}</Text>
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    opacity: 0.2,
  },
  orbLeft: {
    position: 'absolute',
    bottom: -50,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#10B981',
    opacity: 0.15,
  },
  goldBottomStrip: {
    height: 3,
    backgroundColor: '#F59E0B',
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBarBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 26,
    height: 26,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandTxtTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTxtSub: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
  },
  userAppBtnText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  avatarDoubleRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1.5,
  },
  avatarMiddleRing: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  avatarInnerCircle: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetters: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
  },
  avatarActiveDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  welcomeStatusRow: {
    marginBottom: 16,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  adminBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  adminBadgeText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '800',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cmdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cmdText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },

  // Floating Card Stats
  floatingCardContainer: {
    paddingHorizontal: 16,
    marginTop: -22,
    zIndex: 10,
  },
  floatingCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    elevation: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
  },

  // Quick Actions Section
  quickActionsSection: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  quickActionsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  superControlCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    width: 96,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  superIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  superCardLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Bento Accordion Sections
  bentoGridSection: {
    paddingHorizontal: 16,
    gap: 16,
  },
  accordionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    overflow: 'hidden',
    padding: 14,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  accordionSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  accordionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBadgeContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
  },
  accordionBody: {},
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    width: (W - 32 - 28 - 10) / 2, // 2-Column Mobile First Grid
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-between',
    minHeight: 74,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBg: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  gridCardFooter: {},
  statText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 2,
  },
  gridCardTitle: {
    fontWeight: '800',
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Bottom Floating Command Dock
  dockContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    elevation: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dockLabel: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
  },
});
