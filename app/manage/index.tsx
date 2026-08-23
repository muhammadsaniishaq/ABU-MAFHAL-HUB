import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  StyleSheet,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');

// ─── Crisp Light Theme Design Tokens ──────────────────────────────────────────
const T = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#0F172A',
  textSub: '#64748B',
  gold: '#D97706',
  goldLight: '#FEF3C7',
  goldBorder: '#FCD34D',
  border: '#E2E8F0',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  emerald: '#10B981',
  emeraldLight: '#ECFDF5',
  purple: '#8B5CF6',
  purpleLight: '#F5F3FF',
  rose: '#E11D48',
  roseLight: '#FEF2F2',
};

// ALL MODULE CONFIGURATIONS
const modules = {
  operations: [
    { title: 'Users Control', icon: 'people-outline', route: '/manage/users', color: '#2563EB', bg: '#EFF6FF', badgeText: 'Core' },
    { title: 'Mail Center', icon: 'mail-unread-outline', route: '/manage/mail-center', color: '#D97706', bg: '#FFFBEB' },
    { title: 'KYC Requests', icon: 'id-card-outline', route: '/manage/kyc', color: '#10B981', bg: '#ECFDF5', badge: 0 },
    { title: 'NIN Pricing', icon: 'pricetag-outline', route: '/manage/nin-pricing', color: '#059669', bg: '#ECFDF5' },
    { title: 'SMM Pricing', icon: 'thumbs-up-outline', route: '/manage/smm-pricing', color: '#8B5CF6', bg: '#F5F3FF' },
    { title: 'Bills Pricing', icon: 'flash-outline', route: '/manage/bills-pricing', color: '#D97706', bg: '#FFFBEB' },
    { title: 'CAC Management', icon: 'briefcase-outline', route: '/manage/cac', color: '#10B981', bg: '#ECFDF5' },
    { title: 'Help Desk', icon: 'chatbubbles-outline', route: '/manage/tickets', color: '#DB2777', bg: '#FDF2F8', badge: 0 },
    { title: 'Content CMS', icon: 'images-outline', route: '/manage/cms', color: '#4F46E5', bg: '#EEF2FF' },
    { title: 'Data Plans', icon: 'wifi-outline', route: '/manage/data-plans', color: '#0284C7', bg: '#F0F9FF', badgeText: 'API' },
    { title: 'Airtime', icon: 'call-outline', route: '/manage/airtime', color: '#10B981', bg: '#ECFDF5' },
    { title: 'Localization', icon: 'language-outline', route: '/manage/localization', color: '#8B5CF6', bg: '#F5F3FF' },
    { title: 'Bulk SMS', icon: 'chatbubbles-outline', route: '/manage/bulk-sms', color: '#2563EB', bg: '#EFF6FF' },
    { title: 'Reviews Control', icon: 'star-outline', route: '/manage/reviews', color: '#D97706', bg: '#FFFBEB' },
  ],
  banking: [
    { title: 'API Liquidity', icon: 'wallet-outline', route: '/manage/liquidity', color: '#10B981', bg: '#ECFDF5', badgeText: 'Live' },
    { title: 'Cards', icon: 'card-outline', route: '/manage/cards', color: '#DB2777', bg: '#FDF2F8' },
    { title: 'Lending', icon: 'cash-outline', route: '/manage/lending', color: '#10B981', bg: '#ECFDF5', badge: 0 },
    { title: 'Wealth', icon: 'briefcase-outline', route: '/manage/wealth', color: '#8B5CF6', bg: '#F5F3FF' },
    { title: 'Rates', icon: 'trending-up-outline', route: '/manage/rates', color: '#D97706', bg: '#FFFBEB', stat: 'Live' },
  ],
  finance: [
    { title: 'Risk Control', icon: 'alert-circle-outline', route: '/manage/risk', color: '#E11D48', bg: '#FEF2F2' },
    { title: 'Analytics', icon: 'bar-chart-outline', route: '/manage/reports', color: '#D97706', bg: '#FFFBEB' },
    { title: 'Comms Center', icon: 'megaphone-outline', route: '/manage/communications', color: '#DB2777', bg: '#FDF2F8' },
    { title: 'Cortex AI', icon: 'sparkles-outline', route: '/manage/ai', color: '#6366F1', bg: '#EEF2FF' },
    { title: 'Crypto Mgmt', icon: 'logo-bitcoin', route: '/manage/crypto', color: '#D97706', bg: '#FFFBEB' },
  ],
  technical: [
    { title: 'Infra Status', icon: 'server-outline', route: '/manage/infrastructure', color: '#475569', bg: '#F1F5F9' },
    { title: 'Database', icon: 'server', route: '/manage/db', color: '#10B981', bg: '#ECFDF5' },
    { title: 'API Vault', icon: 'code-working-outline', route: '/manage/api', color: '#4F46E5', bg: '#EEF2FF' },
    { title: 'Cinema', icon: 'videocam-outline', route: '/manage/cinema', color: '#E11D48', bg: '#FEF2F2' },
    { title: 'Terminal', icon: 'terminal-outline', route: '/manage/terminal', color: '#16A34A', bg: '#F0FDF4' },
    { title: 'Features', icon: 'toggle-outline', route: '/manage/features', color: '#EA580C', bg: '#FFF7ED' },
    { title: 'App Store', icon: 'logo-apple', route: '/manage/stores', color: '#0F172A', bg: '#F8FAFC', badge: 1 },
    { title: 'Files', icon: 'folder-open-outline', route: '/manage/files', color: '#0284C7', bg: '#F0F9FF' },
  ],
  internal: [
    { title: 'Staff HR', icon: 'briefcase-outline', route: '/manage/staff', color: '#475569', bg: '#F1F5F9' },
    { title: 'Voice OS', icon: 'mic-outline', route: '/manage/voice', color: '#8B5CF6', bg: '#F5F3FF' },
    { title: 'Legal', icon: 'document-text-outline', route: '/manage/legal', color: '#475569', bg: '#F1F5F9' },
    { title: 'Team Chat', icon: 'people-circle-outline', route: '/manage/team', color: '#E11D48', bg: '#FEF2F2', badge: 0 },
    { title: 'Academy', icon: 'school-outline', route: '/manage/academy', color: '#D97706', bg: '#FFFBEB' },
    { title: 'Theme & UX', icon: 'color-palette-outline', route: '/manage/appearance', color: '#DB2777', bg: '#FDF2F8' },
    { title: 'Automation', icon: 'flash-outline', route: '/manage/automation', color: '#4F46E5', bg: '#EEF2FF' },
    { title: 'Kanban Board', icon: 'grid-outline', route: '/manage/kanban', color: '#EA580C', bg: '#FFF7ED' },
  ],
  redZone: [
    { title: 'Security Hub', icon: 'shield-checkmark-outline', route: '/manage/security', color: '#2563EB', bg: '#EFF6FF' },
    { title: 'Forensics', icon: 'finger-print-outline', route: '/manage/forensics', color: '#8B5CF6', bg: '#F5F3FF' },
    { title: 'API Vault Keys', icon: 'key-outline', route: '/manage/api', color: '#D97706', bg: '#FFFBEB' },
    { title: 'System Logs', icon: 'list-outline', route: '/manage/logs', color: '#475569', bg: '#F1F5F9' },
    { title: 'Live Geo Map', icon: 'earth-outline', route: '/manage/map', color: '#0891B2', bg: '#ECFEFF' },
    { title: 'Settings', icon: 'settings-outline', route: '/manage/settings', color: '#475569', bg: '#F1F5F9' },
    { title: 'PANIC ROOM', icon: 'warning-outline', route: '/manage/panic', color: '#DC2626', bg: '#FEF2F2' },
  ]
};

const QUICK_ACTIONS = [
  { id: 'master', label: 'Master Hub', icon: 'ribbon-outline', color: '#D97706', bg: '#FFFBEB', route: '/manage/super-admin', superOnly: true },
  { id: 'user', label: 'Users Control', icon: 'people-outline', color: '#2563EB', bg: '#EFF6FF', route: '/manage/users' },
  { id: 'money', label: 'API Liquidity', icon: 'wallet-outline', color: '#10B981', bg: '#ECFDF5', route: '/manage/liquidity' },
  { id: 'data', label: 'Data Plans', icon: 'wifi-outline', color: '#0284C7', bg: '#F0F9FF', route: '/manage/data-plans' },
  { id: 'tickets', label: 'Tickets Desk', icon: 'chatbubbles-outline', color: '#DB2777', bg: '#FDF2F8', route: '/manage/tickets' },
  { id: 'broadcast', label: 'Broadcast', icon: 'megaphone-outline', color: '#9333EA', bg: '#F3E8FF', route: '/manage/communications' },
  { id: 'panic', label: 'Panic Room', icon: 'warning-outline', color: '#DC2626', bg: '#FEF2F2', route: '/manage/panic', superOnly: true },
];

const dockItems = [
  { icon: 'grid-outline', route: '/manage', label: 'Overview' },
  { icon: 'people-outline', route: '/manage/users', label: 'Users' },
  { icon: 'wallet-outline', route: '/manage/liquidity', label: 'Liquidity' },
  { icon: 'chatbubbles-outline', route: '/manage/tickets', label: 'Support' },
  { icon: 'settings-outline', route: '/manage/settings', label: 'Settings' },
];

const categoryMeta = {
  operations: { title: 'Operations & Core Services', icon: 'options-outline', color: '#D97706', bg: '#FFFBEB' },
  banking: { title: 'Banking, Liquidity & Assets', icon: 'wallet-outline', color: '#10B981', bg: '#ECFDF5' },
  finance: { title: 'Markets, Crypto & Analytics', icon: 'stats-chart-outline', color: '#2563EB', bg: '#EFF6FF' },
  technical: { title: 'Technical Infra & Database', icon: 'terminal-outline', color: '#4F46E5', bg: '#EEF2FF' },
  internal: { title: 'Internal Affairs & Staff', icon: 'business-outline', color: '#8B5CF6', bg: '#F5F3FF' },
  redZone: { title: 'Security, Forensics & RedZone', icon: 'shield-checkmark-outline', color: '#DC2626', bg: '#FEF2F2' }
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
      <View key={key} style={s.categoryContainer}>
        {/* Category Header */}
        <View style={s.categoryHeader}>
          <View style={s.categoryHeaderLeft}>
            <View style={[s.categoryIconBg, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon as any} size={18} color={meta.color} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.categoryTitle}>{meta.title}</Text>
              <Text style={s.categorySubtitle}>{items.length} active module{items.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          
          {items.reduce((sum, item) => sum + ((item as any).badge || 0), 0) > 0 && (
            <View style={s.actionBadge}>
              <Text style={s.actionBadgeText}>
                {items.reduce((sum, item) => sum + ((item as any).badge || 0), 0)} PENDING
              </Text>
            </View>
          )}
        </View>

        {/* Clean 2-Column Grid */}
        <View style={s.moduleGrid}>
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
                style={[s.moduleCard, isLockedForAdmin && { opacity: 0.55 }]}
                activeOpacity={0.7}
              >
                <View style={s.moduleCardTop}>
                  <View style={[s.moduleIconBox, { backgroundColor: (item as any).bg || '#F1F5F9' }]}>
                    <Ionicons name={isLockedForAdmin ? "lock-closed" : (item.icon as any)} size={18} color={isLockedForAdmin ? "#E11D48" : (item.color || "#0F172A")} />
                  </View>
                  {(item as any).badge > 0 && (
                    <View style={s.badgePill}>
                      <Text style={s.badgePillText}>{(item as any).badge}</Text>
                    </View>
                  )}
                  {(item as any).badgeText && (
                    <View style={s.tagPill}>
                      <Text style={s.tagPillText}>{(item as any).badgeText}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.moduleCardTitle} numberOfLines={1}>{item.title}</Text>
                {(item as any).stat ? (
                  <Text style={s.moduleStatText}>{(item as any).stat}</Text>
                ) : (
                  <Text style={s.moduleCardSub}>Tap to configure</Text>
                )}
              </TouchableOpacity>
            );
          })}
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Sleek Royal Navy Header with Gold Accent Trim */}
        <View style={s.headerWrapper}>
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.headerGradient}
          >
            {/* Top Bar Row */}
            <View style={s.topBarRow}>
              <View style={s.brandGroup}>
                <View style={s.brandIconBox}>
                  <Image 
                    source={logoIconUrl ? { uri: logoIconUrl } : require('../../assets/images/logo-icon.png')} 
                    style={s.brandLogo as any}
                    resizeMode="contain"
                  />
                </View>
                <View>
                  <Text style={s.brandTitle}>ABU MAFHAL</Text>
                  <Text style={s.brandSub}>ADMIN COMMAND CENTRE</Text>
                </View>
              </View>

              <View style={s.headerRightActions}>
                <TouchableOpacity 
                  onPress={() => router.replace('/(app)/dashboard')}
                  style={s.appSwitchBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color="#D97706" />
                  <Text style={s.appSwitchText}>User App</Text>
                </TouchableOpacity>
                
                {/* User Avatar */}
                <TouchableOpacity 
                  activeOpacity={0.85}
                  onPress={() => router.push('/manage/profile')}
                  style={s.avatarContainer}
                >
                  <View style={s.avatarCircle}>
                    {adminProfile?.avatar_url ? (
                      <Image source={{ uri: adminProfile.avatar_url }} style={s.avatarImage} />
                    ) : (
                      <Text style={s.avatarInitial}>{adminProfile?.full_name?.[0]?.toUpperCase() || 'A'}</Text>
                    )}
                  </View>
                  <View style={s.onlineDot} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Greeting & Role Tag */}
            <View style={s.greetingRow}>
              <View style={{ flex: 1 }}>
                <View style={s.greetingBadgeGroup}>
                  <Text style={s.greetingText}>Welcome back, {adminProfile?.full_name?.split(' ')[0] || 'Admin'} 👋</Text>
                  <View style={[s.roleTag, adminProfile?.role === 'super_admin' && s.roleTagSuper]}>
                    <Text style={[s.roleTagText, adminProfile?.role === 'super_admin' && s.roleTagTextSuper]}>
                      {adminProfile?.role === 'super_admin' ? '👑 MASTER KEY' : '🛡️ STAFF ADMIN'}
                    </Text>
                  </View>
                </View>
                <View style={s.systemStatusRow}>
                  <View style={s.statusIndicator} />
                  <Text style={s.systemStatusText}>Core Services Online • 99.9% Uptime</Text>
                </View>
              </View>
            </View>

            {/* Crisp Light Search Bar */}
            <View style={s.searchContainer}>
              <Ionicons name="search" size={16} color="#64748B" />
              <TextInput 
                placeholder="Search 50+ admin modules, users, liquidity..." 
                placeholderTextColor="#94A3B8"
                style={s.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={T.gold}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#64748B" />
                </TouchableOpacity>
              ) : (
                <View style={s.searchHint}>
                  <Text style={s.searchHintText}>Search</Text>
                </View>
              )}
            </View>
          </LinearGradient>
          <View style={s.headerGoldStrip} />
        </View>

        {/* Clean Light Stats Overview Cards */}
        <View style={s.statsSection}>
          <View style={s.statsGrid}>
            <TouchableOpacity style={s.statCard} activeOpacity={0.8} onPress={() => router.push('/manage/users')}>
              <View style={[s.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people" size={16} color="#2563EB" />
              </View>
              <View style={s.statContent}>
                <Text style={s.statValue}>{loading ? '...' : counts.users.toLocaleString()}</Text>
                <Text style={s.statTitle}>Total Users</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.statCard} activeOpacity={0.8} onPress={() => router.push('/manage/kyc')}>
              <View style={[s.statIconBox, { backgroundColor: counts.kyc > 0 ? '#FEF2F2' : '#ECFDF5' }]}>
                <Ionicons name="scan" size={16} color={counts.kyc > 0 ? '#E11D48' : '#10B981'} />
              </View>
              <View style={s.statContent}>
                <Text style={[s.statValue, counts.kyc > 0 && { color: '#E11D48' }]}>{loading ? '...' : counts.kyc}</Text>
                <Text style={s.statTitle}>Pending KYC</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.statCard} activeOpacity={0.8} onPress={() => router.push('/manage/tickets')}>
              <View style={[s.statIconBox, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="chatbubbles" size={16} color="#D97706" />
              </View>
              <View style={s.statContent}>
                <Text style={s.statValue}>{loading ? '...' : counts.tickets}</Text>
                <Text style={s.statTitle}>Open Tickets</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.statCard} activeOpacity={0.8} onPress={() => router.push('/manage/liquidity')}>
              <View style={[s.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="wallet" size={16} color="#10B981" />
              </View>
              <View style={s.statContent}>
                <Text style={[s.statValue, { color: '#10B981' }]}>Live Bal</Text>
                <Text style={s.statTitle}>API Liquidity</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Master Quick Actions Bar */}
        <View style={s.quickActionsContainer}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>⚡ Quick Admin Actions</Text>
            <View style={s.sectionTag}>
              <Text style={s.sectionTagText}>SHORTCUTS</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickActionsScroll}>
            {QUICK_ACTIONS.filter(act => !act.superOnly || adminProfile?.role === 'super_admin').map((act, i) => (
              <TouchableOpacity 
                key={i} 
                style={s.actionButton}
                onPress={() => router.push(act.route as any)}
                activeOpacity={0.75}
              >
                <View style={[s.actionIconBox, { backgroundColor: act.bg }]}>
                  <Ionicons name={act.icon as any} size={20} color={act.color} />
                </View>
                <Text style={s.actionLabel}>{act.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Enterprise Category Segment Tabs */}
        <View style={s.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filteredCategoryTabs.map(tab => {
              const isSelected = activeCategoryTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveCategoryTab(tab.id)}
                  style={[s.tabPill, isSelected && s.tabPillSelected]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={tab.icon as any} size={14} color={isSelected ? '#FFFFFF' : '#64748B'} />
                  <Text style={[s.tabPillText, isSelected && s.tabPillTextSelected]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Module Bento Panels */}
        <View style={s.modulesSection}>
          {(activeCategoryTab === 'all' || activeCategoryTab === 'operations') && renderSectionPanel('operations')}
          {(activeCategoryTab === 'all' || activeCategoryTab === 'banking') && renderSectionPanel('banking')}
          {(activeCategoryTab === 'all' || activeCategoryTab === 'finance') && renderSectionPanel('finance')}
          {adminProfile?.role === 'super_admin' && (activeCategoryTab === 'all' || activeCategoryTab === 'technical') && renderSectionPanel('technical')}
          {(activeCategoryTab === 'all' || activeCategoryTab === 'internal') && renderSectionPanel('internal')}
          {adminProfile?.role === 'super_admin' && (activeCategoryTab === 'all' || activeCategoryTab === 'redZone') && renderSectionPanel('redZone')}
        </View>

      </ScrollView>

      {/* Crisp White Floating Command Dock */}
      <View style={s.dockContainer}>
        {dockItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => router.push(item.route as any)}
            style={s.dockItem}
            activeOpacity={0.8}
          >
            <Ionicons name={item.icon as any} size={20} color="#D97706" />
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGoldStrip: {
    height: 3,
    backgroundColor: '#D97706',
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSub: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  appSwitchText: {
    color: '#FEF3C7',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    borderWidth: 1.5,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  greetingRow: {
    marginBottom: 14,
  },
  greetingBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  greetingText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  roleTagSuper: {
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
    borderColor: '#D97706',
  },
  roleTagText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '800',
  },
  roleTagTextSuper: {
    color: '#FEF3C7',
    fontWeight: '900',
  },
  systemStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  systemStatusText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  searchHint: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  searchHintText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },

  // Core Stats
  statsSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    width: (W - 32 - 10) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // Quick Actions Bar
  quickActionsContainer: {
    marginTop: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  sectionTagText: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: '900',
  },
  quickActionsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    width: 90,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },

  // Category Segment Tabs
  tabsContainer: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabPillSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  tabPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabPillTextSelected: {
    color: '#FFFFFF',
  },

  // Module Bento Category Panels
  modulesSection: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 16,
  },
  categoryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  categorySubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  actionBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeText: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '900',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    width: (W - 32 - 28 - 10) / 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 76,
    justifyContent: 'space-between',
  },
  moduleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  moduleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    backgroundColor: '#E11D48',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  tagPill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tagPillText: {
    color: '#059669',
    fontSize: 8,
    fontWeight: '800',
  },
  moduleCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  moduleStatText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 2,
  },
  moduleCardSub: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 1,
  },

  // Floating Command Dock
  dockContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dockLabel: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: '800',
  },
});
