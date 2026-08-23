import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');

// ─── Premium Design Tokens (Light Edition) ─────────────────────────────────────
const C = {
  bg:        '#F0F4F8',
  white:     '#FFFFFF',
  card:      '#FFFFFF',
  navy:      '#0F172A',
  navyMid:   '#1E293B',
  navySoft:  '#334155',
  gold:      '#D97706',
  goldLight: '#FEF3C7',
  goldMid:   '#F59E0B',
  goldBorder:'#FCD34D',
  border:    '#E2E8F0',
  borderSoft:'#F1F5F9',
  textPrimary:'#0F172A',
  textSub:   '#64748B',
  textMuted: '#94A3B8',
  blue:      '#2563EB',
  blueLight: '#EFF6FF',
  teal:      '#0D9488',
  tealLight: '#F0FDFA',
  emerald:   '#059669',
  emeraldLight:'#ECFDF5',
  purple:    '#7C3AED',
  purpleLight:'#F5F3FF',
  rose:      '#DC2626',
  roseLight: '#FEF2F2',
  orange:    '#EA580C',
  orangeLight:'#FFF7ED',
  cyan:      '#0891B2',
  cyanLight: '#ECFEFF',
};

// ─── Module Config ─────────────────────────────────────────────────────────────
const modules = {
  operations: [
    { title: 'Users Control',  icon: 'people',         route: '/manage/users',          color: C.blue,    bg: C.blueLight,    badge: 0,  tag: 'Core' },
    { title: 'Mail Center',    icon: 'mail-unread',    route: '/manage/mail-center',    color: C.gold,    bg: C.goldLight },
    { title: 'KYC Requests',   icon: 'id-card',        route: '/manage/kyc',            color: C.emerald, bg: C.emeraldLight, badge: 0 },
    { title: 'NIN Pricing',    icon: 'pricetag',       route: '/manage/nin-pricing',    color: C.teal,    bg: C.tealLight },
    { title: 'SMM Pricing',    icon: 'thumbs-up',      route: '/manage/smm-pricing',    color: C.purple,  bg: C.purpleLight },
    { title: 'Bills Pricing',  icon: 'flash',          route: '/manage/bills-pricing',  color: C.orange,  bg: C.orangeLight },
    { title: 'CAC Management', icon: 'briefcase',      route: '/manage/cac',            color: C.emerald, bg: C.emeraldLight },
    { title: 'Help Desk',      icon: 'chatbubbles',    route: '/manage/tickets',        color: C.rose,    bg: C.roseLight,    badge: 0 },
    { title: 'Content CMS',    icon: 'images',         route: '/manage/cms',            color: C.purple,  bg: C.purpleLight },
    { title: 'Data Plans',     icon: 'wifi',           route: '/manage/data-plans',     color: C.cyan,    bg: C.cyanLight,    tag: 'API' },
    { title: 'Airtime',        icon: 'call',           route: '/manage/airtime',        color: C.emerald, bg: C.emeraldLight },
    { title: 'Localization',   icon: 'language',       route: '/manage/localization',   color: C.purple,  bg: C.purpleLight },
    { title: 'Bulk SMS',       icon: 'chatbubbles',    route: '/manage/bulk-sms',       color: C.blue,    bg: C.blueLight },
    { title: 'Reviews',        icon: 'star',           route: '/manage/reviews',        color: C.gold,    bg: C.goldLight },
  ],
  banking: [
    { title: 'API Liquidity',  icon: 'wallet',         route: '/manage/liquidity',      color: C.emerald, bg: C.emeraldLight, tag: 'Live' },
    { title: 'Cards',          icon: 'card',           route: '/manage/cards',          color: C.rose,    bg: C.roseLight },
    { title: 'Lending',        icon: 'cash',           route: '/manage/lending',        color: C.teal,    bg: C.tealLight,    badge: 0 },
    { title: 'Wealth',         icon: 'trending-up',    route: '/manage/wealth',         color: C.purple,  bg: C.purpleLight },
    { title: 'Rates',          icon: 'stats-chart',    route: '/manage/rates',          color: C.gold,    bg: C.goldLight,    tag: 'Live' },
  ],
  finance: [
    { title: 'Risk Control',   icon: 'alert-circle',   route: '/manage/risk',           color: C.rose,    bg: C.roseLight },
    { title: 'Analytics',      icon: 'bar-chart',      route: '/manage/reports',        color: C.gold,    bg: C.goldLight },
    { title: 'Comms Center',   icon: 'megaphone',      route: '/manage/communications', color: C.purple,  bg: C.purpleLight },
    { title: 'Cortex AI',      icon: 'sparkles',       route: '/manage/ai',             color: C.cyan,    bg: C.cyanLight,    tag: 'AI' },
    { title: 'Crypto Mgmt',    icon: 'logo-bitcoin',   route: '/manage/crypto',         color: C.orange,  bg: C.orangeLight },
  ],
  technical: [
    { title: 'Infrastructure', icon: 'server',         route: '/manage/infrastructure', color: C.navySoft,bg: C.borderSoft },
    { title: 'Database',       icon: 'server',         route: '/manage/db',             color: C.emerald, bg: C.emeraldLight },
    { title: 'API Vault',      icon: 'code-working',   route: '/manage/api',            color: C.purple,  bg: C.purpleLight },
    { title: 'Cinema',         icon: 'videocam',       route: '/manage/cinema',         color: C.rose,    bg: C.roseLight },
    { title: 'Terminal',       icon: 'terminal',       route: '/manage/terminal',       color: C.emerald, bg: C.emeraldLight },
    { title: 'Feature Flags',  icon: 'toggle',         route: '/manage/features',       color: C.orange,  bg: C.orangeLight },
    { title: 'App Store',      icon: 'logo-apple',     route: '/manage/stores',         color: C.navy,    bg: C.borderSoft,   badge: 1 },
    { title: 'Files',          icon: 'folder-open',    route: '/manage/files',          color: C.cyan,    bg: C.cyanLight },
  ],
  internal: [
    { title: 'Staff HR',       icon: 'briefcase',      route: '/manage/staff',          color: C.navySoft,bg: C.borderSoft },
    { title: 'Voice OS',       icon: 'mic',            route: '/manage/voice',          color: C.purple,  bg: C.purpleLight },
    { title: 'Legal',          icon: 'document-text',  route: '/manage/legal',          color: C.navySoft,bg: C.borderSoft },
    { title: 'Team Chat',      icon: 'people-circle',  route: '/manage/team',           color: C.rose,    bg: C.roseLight,    badge: 0 },
    { title: 'Academy',        icon: 'school',         route: '/manage/academy',        color: C.gold,    bg: C.goldLight },
    { title: 'Theme & UX',     icon: 'color-palette',  route: '/manage/appearance',     color: C.purple,  bg: C.purpleLight },
    { title: 'Automation',     icon: 'flash',          route: '/manage/automation',     color: C.blue,    bg: C.blueLight },
    { title: 'Kanban',         icon: 'grid',           route: '/manage/kanban',         color: C.orange,  bg: C.orangeLight },
  ],
  redZone: [
    { title: 'Security Hub',   icon: 'shield-checkmark',route: '/manage/security',      color: C.blue,    bg: C.blueLight },
    { title: 'Forensics',      icon: 'finger-print',   route: '/manage/forensics',      color: C.purple,  bg: C.purpleLight },
    { title: 'API Keys',       icon: 'key',            route: '/manage/api',            color: C.gold,    bg: C.goldLight },
    { title: 'System Logs',    icon: 'list',           route: '/manage/logs',           color: C.navySoft,bg: C.borderSoft },
    { title: 'Geo Map',        icon: 'earth',          route: '/manage/map',            color: C.cyan,    bg: C.cyanLight },
    { title: 'Settings',       icon: 'settings',       route: '/manage/settings',       color: C.navySoft,bg: C.borderSoft },
    { title: 'PANIC ROOM',     icon: 'warning',        route: '/manage/panic',          color: C.rose,    bg: C.roseLight },
  ],
};

const quickActions = [
  { label: 'Master Hub',  icon: 'ribbon',        route: '/manage/super-admin',    color: C.gold,    bg: C.goldLight,    superOnly: true },
  { label: 'Users',       icon: 'people',        route: '/manage/users',          color: C.blue,    bg: C.blueLight },
  { label: 'Liquidity',   icon: 'wallet',        route: '/manage/liquidity',      color: C.emerald, bg: C.emeraldLight },
  { label: 'Data Plans',  icon: 'wifi',          route: '/manage/data-plans',     color: C.cyan,    bg: C.cyanLight },
  { label: 'Help Desk',   icon: 'chatbubbles',   route: '/manage/tickets',        color: C.rose,    bg: C.roseLight },
  { label: 'Broadcast',   icon: 'megaphone',     route: '/manage/communications', color: C.purple,  bg: C.purpleLight },
  { label: 'KYC Queue',   icon: 'scan',          route: '/manage/kyc',            color: C.teal,    bg: C.tealLight },
  { label: 'Panic Room',  icon: 'warning',       route: '/manage/panic',          color: C.rose,    bg: C.roseLight,    superOnly: true },
];

const dockItems = [
  { icon: 'grid',         route: '/manage',             label: 'Home' },
  { icon: 'people',       route: '/manage/users',       label: 'Users' },
  { icon: 'wallet',       route: '/manage/liquidity',   label: 'Funds' },
  { icon: 'chatbubbles',  route: '/manage/tickets',     label: 'Support' },
  { icon: 'settings',     route: '/manage/settings',    label: 'Settings' },
];

const categoryMeta: Record<string, { title: string; icon: string; color: string; bg: string }> = {
  operations: { title: 'Operations & Core Services', icon: 'options',          color: C.gold,    bg: C.goldLight },
  banking:    { title: 'Banking, Liquidity & Assets', icon: 'wallet',          color: C.emerald, bg: C.emeraldLight },
  finance:    { title: 'Finance, Crypto & Analytics', icon: 'stats-chart',     color: C.blue,    bg: C.blueLight },
  technical:  { title: 'Technical Infrastructure',    icon: 'terminal',        color: C.purple,  bg: C.purpleLight },
  internal:   { title: 'Internal Affairs & HR',       icon: 'business',        color: C.teal,    bg: C.tealLight },
  redZone:    { title: 'Security, Forensics & RedZone',icon: 'shield-checkmark',color: C.rose,   bg: C.roseLight },
};

const tabs = [
  { id: 'all',        label: 'All',        icon: 'grid-outline' },
  { id: 'operations', label: 'Operations', icon: 'options-outline' },
  { id: 'banking',    label: 'Banking',    icon: 'wallet-outline' },
  { id: 'finance',    label: 'Finance',    icon: 'stats-chart-outline' },
  { id: 'technical',  label: 'Technical',  icon: 'terminal-outline',         superOnly: true },
  { id: 'internal',   label: 'Internal',   icon: 'business-outline' },
  { id: 'redZone',    label: 'Security',   icon: 'shield-checkmark-outline', superOnly: true },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [profile, setProfile]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [logoUrl, setLogoUrl]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [hidden, setHidden]       = useState<string[]>([]);
  const [query, setQuery]         = useState('');
  const [counts, setCounts]       = useState({ users: 0, kyc: 0, tickets: 0, loans: 0, chats: 0 });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@cached_admin_profile').then(s => {
      if (s) { try { setProfile(JSON.parse(s)); } catch {} }
    });
    load();
  }, []);

  const load = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || (await supabase.auth.getUser()).data.user;

      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        const prof = p || { id: user.id, full_name: user.user_metadata?.full_name || 'Admin', email: user.email, role: 'admin', avatar_url: user.user_metadata?.avatar_url };
        setProfile(prof);
        AsyncStorage.setItem('@cached_admin_profile', JSON.stringify(prof));
      }

      const [logo, hid, uc, kc, tc, lc] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'app_logo_icon').single(),
        supabase.from('app_settings').select('value').eq('key', 'hidden_admin_modules').single(),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      if (logo.data?.value?.url) setLogoUrl(logo.data.value.url);
      if (hid.data?.value) {
        const arr = typeof hid.data.value === 'string' ? JSON.parse(hid.data.value) : hid.data.value;
        if (Array.isArray(arr)) setHidden(arr);
      }
      setCounts({ users: uc.count || 0, kyc: kc.count || 0, tickets: tc.count || 0, loans: lc.count || 0, chats: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  modules.operations[2].badge = counts.kyc;
  modules.operations[7].badge = counts.tickets;
  modules.banking[2].badge    = counts.loans;

  const isSuper = profile?.role === 'super_admin';
  const isAdmin = isSuper || profile?.role === 'admin';

  const visibleTabs = tabs.filter(t => !t.superOnly || isSuper);

  const getItems = (key: keyof typeof modules) => {
    let items = modules[key] as any[];
    if (!isAdmin) items = items.filter(it => !hidden.includes(it.route.split('/').pop()?.replace(/-/g, '_') || ''));
    if (query.trim()) items = items.filter(it => it.title.toLowerCase().includes(query.toLowerCase()));
    return items;
  };

  const renderSection = (key: keyof typeof modules) => {
    const meta  = categoryMeta[key];
    const items = getItems(key);
    if (!items.length) return null;
    const totalBadge = items.reduce((s, it) => s + (it.badge || 0), 0);

    return (
      <View key={key} style={s.section}>
        {/* Section Header */}
        <View style={s.sectionHead}>
          <View style={s.sectionHeadLeft}>
            <View style={[s.sectionIconBox, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon as any} size={18} color={meta.color} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.sectionTitle}>{meta.title}</Text>
              <Text style={s.sectionSub}>{items.length} modules available</Text>
            </View>
          </View>
          {totalBadge > 0 && (
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeText}>{totalBadge} PENDING</Text>
            </View>
          )}
        </View>

        {/* 2-Column Grid */}
        <View style={s.grid}>
          {items.map((item: any, i: number) => {
            const locked = (key === 'redZone' || item.route === '/manage/staff' || item.route === '/manage/features') && !isSuper;
            return (
              <TouchableOpacity
                key={i}
                style={[s.moduleCard, locked && { opacity: 0.5 }]}
                activeOpacity={0.72}
                onPress={() => {
                  if (locked) {
                    Alert.alert('Access Restricted 🔒', 'Only Super Admin can access this section.');
                    return;
                  }
                  router.push(item.route);
                }}
              >
                {/* Color accent top strip */}
                <View style={[s.cardTopStrip, { backgroundColor: item.color }]} />

                <View style={s.cardBody}>
                  {/* Icon + badges row */}
                  <View style={s.cardTopRow}>
                    <View style={[s.cardIconBox, { backgroundColor: item.bg }]}>
                      <Ionicons
                        name={locked ? 'lock-closed' : (item.icon as any)}
                        size={20}
                        color={locked ? C.rose : item.color}
                      />
                    </View>
                    <View style={s.cardBadgeCol}>
                      {item.badge > 0 && (
                        <View style={s.numBadge}>
                          <Text style={s.numBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                      {item.tag && (
                        <View style={[s.tagChip, { backgroundColor: `${item.color}18`, borderColor: `${item.color}55` }]}>
                          <Text style={[s.tagChipText, { color: item.color }]}>{item.tag}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Title + sub */}
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={s.cardFooter}>
                    <Text style={s.cardSubtext}>Manage</Text>
                    <Ionicons name="chevron-forward" size={11} color={C.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const statCards = [
    { label: 'Total Users',  value: loading ? '—' : counts.users.toLocaleString(), icon: 'people',      color: C.blue,    bg: C.blueLight,    route: '/manage/users' },
    { label: 'Pending KYC',  value: loading ? '—' : String(counts.kyc),            icon: 'scan',        color: counts.kyc > 0 ? C.rose : C.emerald, bg: counts.kyc > 0 ? C.roseLight : C.emeraldLight, route: '/manage/kyc' },
    { label: 'Open Tickets', value: loading ? '—' : String(counts.tickets),        icon: 'chatbubbles', color: C.gold,    bg: C.goldLight,    route: '/manage/tickets' },
    { label: 'Server',       value: '99.9%',                                        icon: 'server',      color: C.emerald, bg: C.emeraldLight, route: '/manage/infrastructure' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
      >
        {/* ── HEADER ─────────────────────────────── */}
        <LinearGradient
          colors={[C.navy, C.navyMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          {/* Subtle decorative shapes */}
          <View style={s.headerCircle1} />
          <View style={s.headerCircle2} />

          {/* Top Row */}
          <View style={s.topRow}>
            <View style={s.brandGroup}>
              <View style={s.logoBox}>
                <Image
                  source={logoUrl ? { uri: logoUrl } : require('../../assets/images/logo-icon.png')}
                  style={s.logoImg as any}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={s.brandName}>ABU MAFHAL</Text>
                <Text style={s.brandSub}>ADMIN COMMAND CENTRE</Text>
              </View>
            </View>

            <View style={s.topActions}>
              <TouchableOpacity
                style={s.switchBtn}
                onPress={() => router.replace('/(app)/dashboard')}
                activeOpacity={0.8}
              >
                <Ionicons name="apps-outline" size={13} color={C.gold} />
                <Text style={s.switchBtnText}>User App</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/manage/profile')}
                activeOpacity={0.85}
                style={s.avatarWrap}
              >
                <View style={s.avatarRing}>
                  <View style={s.avatarCircle}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
                    ) : (
                      <Text style={s.avatarInit}>{profile?.full_name?.[0]?.toUpperCase() || 'A'}</Text>
                    )}
                  </View>
                </View>
                <Animated.View style={[s.onlineDot, { opacity: pulseAnim }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting Row */}
          <View style={s.greetBlock}>
            <Text style={s.greetName}>Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'} 👋</Text>
            <View style={s.greetRow2}>
              <View style={[s.roleBadge, isSuper && s.roleBadgeSuper]}>
                <Text style={[s.roleBadgeText, isSuper && s.roleBadgeTextSuper]}>
                  {isSuper ? '👑 MASTER KEY — SUPER ADMIN' : '🛡️ STAFF ADMIN'}
                </Text>
              </View>
            </View>
            <View style={s.statusRow}>
              <Animated.View style={[s.statusDot, { opacity: pulseAnim }]} />
              <Text style={s.statusText}>All Systems Online · Encrypted · Secured</Text>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={C.gold} />
            <TextInput
              placeholder="Search modules, users, reports..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              selectionColor={C.gold}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            ) : (
              <View style={s.kbdTag}>
                <Text style={s.kbdTagText}>Search</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── STATS ──────────────────────────────── */}
        <View style={s.statsSection}>
          <View style={s.statsGrid}>
            {statCards.map((sc, i) => (
              <TouchableOpacity
                key={i}
                style={s.statCard}
                activeOpacity={0.78}
                onPress={() => router.push(sc.route as any)}
              >
                <View style={[s.statIconBox, { backgroundColor: sc.bg }]}>
                  <Ionicons name={sc.icon as any} size={18} color={sc.color} />
                </View>
                <Text style={[s.statValue, { color: sc.color }]}>{sc.value}</Text>
                <Text style={s.statLabel}>{sc.label}</Text>
                <View style={[s.statBar, { backgroundColor: `${sc.color}22` }]}>
                  <View style={[s.statBarFill, { backgroundColor: sc.color, width: '75%' }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── QUICK ACTIONS ──────────────────────── */}
        <View style={s.qaSec}>
          <View style={s.rowBetween}>
            <Text style={s.blockLabel}>⚡ Quick Actions</Text>
            <View style={s.goldPill}>
              <Text style={s.goldPillText}>SHORTCUTS</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qaScroll}>
            {quickActions
              .filter(a => !a.superOnly || isSuper)
              .map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.qaCard}
                  activeOpacity={0.75}
                  onPress={() => router.push(a.route as any)}
                >
                  <View style={[s.qaIconBox, { backgroundColor: a.bg }]}>
                    <Ionicons name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={s.qaLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>

        {/* ── CATEGORY TABS ──────────────────────── */}
        <View style={s.tabsSec}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
            {visibleTabs.map(tab => {
              const sel = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                  style={[s.tabPill, sel && s.tabPillSel]}
                >
                  <Ionicons name={tab.icon as any} size={13} color={sel ? C.white : C.textSub} />
                  <Text style={[s.tabText, sel && s.tabTextSel]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── MODULE GRIDS ───────────────────────── */}
        <View style={s.sectionsWrap}>
          {(activeTab === 'all' || activeTab === 'operations') && renderSection('operations')}
          {(activeTab === 'all' || activeTab === 'banking')    && renderSection('banking')}
          {(activeTab === 'all' || activeTab === 'finance')    && renderSection('finance')}
          {isSuper && (activeTab === 'all' || activeTab === 'technical')  && renderSection('technical')}
          {(activeTab === 'all' || activeTab === 'internal')   && renderSection('internal')}
          {isSuper && (activeTab === 'all' || activeTab === 'redZone')    && renderSection('redZone')}
        </View>
      </ScrollView>

      {/* ── FLOATING DOCK ──────────────────────── */}
      <View style={s.dock}>
        {dockItems.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={s.dockItem}
            onPress={() => router.push(d.route as any)}
            activeOpacity={0.75}
          >
            <View style={s.dockIconBox}>
              <Ionicons name={d.icon as any} size={20} color={C.navy} />
            </View>
            <Text style={s.dockLabel}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const STAT_W = (W - 32 - 10) / 2;
const MOD_W  = (W - 32 - 28 - 10) / 2;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ────────────────────────────
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 18,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  headerCircle1: {
    position: 'absolute', top: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  headerCircle2: {
    position: 'absolute', bottom: -40, left: -60,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: '100%', height: '100%' },
  brandName: {
    color: C.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSub: {
    color: 'rgba(245,158,11,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  switchBtnText: { color: C.gold, fontSize: 11, fontWeight: '800' },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: C.gold,
    padding: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: '100%', height: '100%',
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: C.navyMid,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInit: { color: C.gold, fontSize: 15, fontWeight: '900' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5, borderColor: C.navy,
  },
  greetBlock: { marginBottom: 18 },
  greetName: {
    color: C.white,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },
  greetRow2: { marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  roleBadgeSuper: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  roleBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
  },
  roleBadgeTextSuper: { color: C.gold },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  statusText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  searchInput: {
    flex: 1,
    color: C.white,
    fontSize: 13,
    fontWeight: '500',
  },
  kbdTag: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  kbdTagText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' },

  // ── Stats Section ─────────────────────
  statsSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: STAT_W,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel: { color: C.textSub, fontSize: 11, fontWeight: '600', marginBottom: 10 },
  statBar: {
    height: 4, borderRadius: 2, overflow: 'hidden',
  },
  statBarFill: { height: '100%', borderRadius: 2 },

  // ── Quick Actions ─────────────────────
  qaSec: { marginTop: 24 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  blockLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: C.textPrimary,
  },
  goldPill: {
    backgroundColor: C.goldLight,
    borderWidth: 1,
    borderColor: C.goldBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goldPillText: { color: C.gold, fontSize: 9, fontWeight: '900' },
  qaScroll: { paddingHorizontal: 16, gap: 12 },
  qaCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    width: 86,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  qaIconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  qaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textPrimary,
    textAlign: 'center',
  },

  // ── Category Tabs ─────────────────────
  tabsSec: { marginTop: 22, paddingLeft: 16 },
  tabsScroll: { gap: 8, paddingRight: 16 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabPillSel: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  tabText: { fontSize: 11, fontWeight: '700', color: C.textSub },
  tabTextSel: { color: C.white },

  // ── Modules ───────────────────────────
  sectionsWrap: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 16,
  },
  section: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '900' },
  sectionSub: { color: C.textSub, fontSize: 10, fontWeight: '600' },
  pendingBadge: {
    backgroundColor: C.roseLight,
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pendingBadgeText: { color: C.rose, fontSize: 9, fontWeight: '900' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    width: MOD_W,
    backgroundColor: C.bg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 96,
  },
  cardTopStrip: { height: 4, width: '100%' },
  cardBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBadgeCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
  },
  numBadge: {
    backgroundColor: C.rose,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  numBadgeText: { color: C.white, fontSize: 8, fontWeight: '900' },
  tagChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  tagChipText: { fontSize: 8, fontWeight: '900' },
  cardTitle: {
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardSubtext: { color: C.textMuted, fontSize: 9, fontWeight: '500' },

  // ── Dock ──────────────────────────────
  dock: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: C.white,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 3,
  },
  dockIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dockLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.navy,
  },
});
