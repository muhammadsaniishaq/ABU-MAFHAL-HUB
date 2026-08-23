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

const { width: W, height: H } = Dimensions.get('window');

// ─── Premium Design Tokens ─────────────────────────────────────────────────────
const C = {
  navy:    '#050D1A',
  navyMid: '#0A1628',
  navyUp:  '#0F1E38',
  gold:    '#F59E0B',
  goldSoft:'#FCD34D',
  goldGlow:'rgba(245,158,11,0.18)',
  white:   '#FFFFFF',
  slate:   '#94A3B8',
  slate2:  '#64748B',
  border:  'rgba(245,158,11,0.2)',
  card:    'rgba(255,255,255,0.04)',
  cardAlt: 'rgba(255,255,255,0.07)',
  // Accent palette
  blue:    '#3B82F6',
  teal:    '#14B8A6',
  emerald: '#10B981',
  purple:  '#8B5CF6',
  rose:    '#F43F5E',
  orange:  '#F97316',
  cyan:    '#06B6D4',
  amber:   '#F59E0B',
};

// ─── Module Config ─────────────────────────────────────────────────────────────
const modules = {
  operations: [
    { title: 'Users Control',   icon: 'people',             route: '/manage/users',         color: C.blue,    glow: 'rgba(59,130,246,0.25)',   badge: 0, tag: 'Core' },
    { title: 'Mail Center',     icon: 'mail-unread',        route: '/manage/mail-center',   color: C.amber,   glow: 'rgba(245,158,11,0.25)' },
    { title: 'KYC Requests',    icon: 'id-card',            route: '/manage/kyc',           color: C.emerald, glow: 'rgba(16,185,129,0.25)',   badge: 0 },
    { title: 'NIN Pricing',     icon: 'pricetag',           route: '/manage/nin-pricing',   color: C.teal,    glow: 'rgba(20,184,166,0.25)' },
    { title: 'SMM Pricing',     icon: 'thumbs-up',          route: '/manage/smm-pricing',   color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Bills Pricing',   icon: 'flash',              route: '/manage/bills-pricing', color: C.amber,   glow: 'rgba(245,158,11,0.25)' },
    { title: 'CAC Management',  icon: 'briefcase',          route: '/manage/cac',           color: C.emerald, glow: 'rgba(16,185,129,0.25)' },
    { title: 'Help Desk',       icon: 'chatbubbles',        route: '/manage/tickets',       color: C.rose,    glow: 'rgba(244,63,94,0.25)',    badge: 0 },
    { title: 'Content CMS',     icon: 'images',             route: '/manage/cms',           color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Data Plans',      icon: 'wifi',               route: '/manage/data-plans',    color: C.cyan,    glow: 'rgba(6,182,212,0.25)',    tag: 'API' },
    { title: 'Airtime',         icon: 'call',               route: '/manage/airtime',       color: C.emerald, glow: 'rgba(16,185,129,0.25)' },
    { title: 'Localization',    icon: 'language',           route: '/manage/localization',  color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Bulk SMS',        icon: 'chatbubbles',        route: '/manage/bulk-sms',      color: C.blue,    glow: 'rgba(59,130,246,0.25)' },
    { title: 'Reviews',         icon: 'star',               route: '/manage/reviews',       color: C.amber,   glow: 'rgba(245,158,11,0.25)' },
  ],
  banking: [
    { title: 'API Liquidity',   icon: 'wallet',             route: '/manage/liquidity',     color: C.emerald, glow: 'rgba(16,185,129,0.25)',   tag: 'Live' },
    { title: 'Cards',           icon: 'card',               route: '/manage/cards',         color: C.rose,    glow: 'rgba(244,63,94,0.25)' },
    { title: 'Lending',         icon: 'cash',               route: '/manage/lending',       color: C.teal,    glow: 'rgba(20,184,166,0.25)',   badge: 0 },
    { title: 'Wealth',          icon: 'trending-up',        route: '/manage/wealth',        color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Rates',           icon: 'stats-chart',        route: '/manage/rates',         color: C.amber,   glow: 'rgba(245,158,11,0.25)',   tag: 'Live' },
  ],
  finance: [
    { title: 'Risk Control',    icon: 'alert-circle',       route: '/manage/risk',          color: C.rose,    glow: 'rgba(244,63,94,0.25)' },
    { title: 'Analytics',       icon: 'bar-chart',          route: '/manage/reports',       color: C.amber,   glow: 'rgba(245,158,11,0.25)' },
    { title: 'Comms Center',    icon: 'megaphone',          route: '/manage/communications',color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Cortex AI',       icon: 'sparkles',           route: '/manage/ai',            color: C.cyan,    glow: 'rgba(6,182,212,0.25)',    tag: 'AI' },
    { title: 'Crypto Mgmt',     icon: 'logo-bitcoin',       route: '/manage/crypto',        color: C.orange,  glow: 'rgba(249,115,22,0.25)' },
  ],
  technical: [
    { title: 'Infra',           icon: 'server',             route: '/manage/infrastructure',color: C.slate2,  glow: 'rgba(100,116,139,0.25)' },
    { title: 'Database',        icon: 'server',             route: '/manage/db',            color: C.emerald, glow: 'rgba(16,185,129,0.25)' },
    { title: 'API Vault',       icon: 'code-working',       route: '/manage/api',           color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Cinema',          icon: 'videocam',           route: '/manage/cinema',        color: C.rose,    glow: 'rgba(244,63,94,0.25)' },
    { title: 'Terminal',        icon: 'terminal',           route: '/manage/terminal',      color: C.emerald, glow: 'rgba(16,185,129,0.25)' },
    { title: 'Feature Flags',   icon: 'toggle',             route: '/manage/features',      color: C.orange,  glow: 'rgba(249,115,22,0.25)' },
    { title: 'App Store',       icon: 'logo-apple',         route: '/manage/stores',        color: C.white,   glow: 'rgba(255,255,255,0.1)',   badge: 1 },
    { title: 'Files',           icon: 'folder-open',        route: '/manage/files',         color: C.cyan,    glow: 'rgba(6,182,212,0.25)' },
  ],
  internal: [
    { title: 'Staff HR',        icon: 'briefcase',          route: '/manage/staff',         color: C.slate2,  glow: 'rgba(100,116,139,0.25)' },
    { title: 'Voice OS',        icon: 'mic',                route: '/manage/voice',         color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Legal',           icon: 'document-text',      route: '/manage/legal',         color: C.slate2,  glow: 'rgba(100,116,139,0.25)' },
    { title: 'Team Chat',       icon: 'people-circle',      route: '/manage/team',          color: C.rose,    glow: 'rgba(244,63,94,0.25)',    badge: 0 },
    { title: 'Academy',         icon: 'school',             route: '/manage/academy',       color: C.amber,   glow: 'rgba(245,158,11,0.25)' },
    { title: 'Theme & UX',      icon: 'color-palette',      route: '/manage/appearance',    color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'Automation',      icon: 'flash',              route: '/manage/automation',    color: C.blue,    glow: 'rgba(59,130,246,0.25)' },
    { title: 'Kanban',          icon: 'grid',               route: '/manage/kanban',        color: C.orange,  glow: 'rgba(249,115,22,0.25)' },
  ],
  redZone: [
    { title: 'Security Hub',    icon: 'shield-checkmark',   route: '/manage/security',      color: C.blue,    glow: 'rgba(59,130,246,0.25)' },
    { title: 'Forensics',       icon: 'finger-print',       route: '/manage/forensics',     color: C.purple,  glow: 'rgba(139,92,246,0.25)' },
    { title: 'API Keys',        icon: 'key',                route: '/manage/api',           color: C.amber,   glow: 'rgba(245,158,11,0.25)' },
    { title: 'System Logs',     icon: 'list',               route: '/manage/logs',          color: C.slate2,  glow: 'rgba(100,116,139,0.25)' },
    { title: 'Geo Map',         icon: 'earth',              route: '/manage/map',           color: C.cyan,    glow: 'rgba(6,182,212,0.25)' },
    { title: 'Settings',        icon: 'settings',           route: '/manage/settings',      color: C.slate2,  glow: 'rgba(100,116,139,0.25)' },
    { title: 'PANIC ROOM',      icon: 'warning',            route: '/manage/panic',         color: C.rose,    glow: 'rgba(244,63,94,0.35)' },
  ]
};

const quickActions = [
  { label: 'Master Hub',    icon: 'ribbon',             route: '/manage/super-admin',    color: C.amber,   glow: 'rgba(245,158,11,0.3)',    superOnly: true },
  { label: 'Users',         icon: 'people',             route: '/manage/users',          color: C.blue,    glow: 'rgba(59,130,246,0.3)' },
  { label: 'Liquidity',     icon: 'wallet',             route: '/manage/liquidity',      color: C.emerald, glow: 'rgba(16,185,129,0.3)' },
  { label: 'Data Plans',    icon: 'wifi',               route: '/manage/data-plans',     color: C.cyan,    glow: 'rgba(6,182,212,0.3)' },
  { label: 'Help Desk',     icon: 'chatbubbles',        route: '/manage/tickets',        color: C.rose,    glow: 'rgba(244,63,94,0.3)' },
  { label: 'Broadcast',     icon: 'megaphone',          route: '/manage/communications', color: C.purple,  glow: 'rgba(139,92,246,0.3)' },
  { label: 'KYC Queue',     icon: 'scan',               route: '/manage/kyc',            color: C.teal,    glow: 'rgba(20,184,166,0.3)' },
  { label: 'Panic Room',    icon: 'warning',            route: '/manage/panic',          color: C.rose,    glow: 'rgba(244,63,94,0.3)',     superOnly: true },
];

const dockItems = [
  { icon: 'grid',           route: '/manage',            label: 'Home' },
  { icon: 'people',         route: '/manage/users',      label: 'Users' },
  { icon: 'wallet',         route: '/manage/liquidity',  label: 'Funds' },
  { icon: 'chatbubbles',    route: '/manage/tickets',    label: 'Support' },
  { icon: 'settings',       route: '/manage/settings',   label: 'Settings' },
];

const categoryMeta: Record<string, { title: string; icon: string; accent: string }> = {
  operations: { title: 'Operations & Core',      icon: 'options',          accent: C.amber },
  banking:    { title: 'Banking & Assets',        icon: 'wallet',           accent: C.emerald },
  finance:    { title: 'Finance & Markets',       icon: 'stats-chart',      accent: C.blue },
  technical:  { title: 'Technical Infrastructure',icon: 'terminal',         accent: C.purple },
  internal:   { title: 'Internal Affairs',        icon: 'business',         accent: C.teal },
  redZone:    { title: 'Security & RedZone',      icon: 'shield-checkmark', accent: C.rose },
};

const tabs = [
  { id: 'all',        label: 'All',          icon: 'grid-outline' },
  { id: 'operations', label: 'Operations',   icon: 'options-outline' },
  { id: 'banking',    label: 'Banking',      icon: 'wallet-outline' },
  { id: 'finance',    label: 'Finance',      icon: 'stats-chart-outline' },
  { id: 'technical',  label: 'Technical',    icon: 'terminal-outline',         superOnly: true },
  { id: 'internal',   label: 'Internal',     icon: 'business-outline' },
  { id: 'redZone',    label: 'Security',     icon: 'shield-checkmark-outline', superOnly: true },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router  = useRouter();
  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  const [profile, setProfile]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [logoUrl, setLogoUrl]       = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState('all');
  const [hidden, setHidden]         = useState<string[]>([]);
  const [query, setQuery]           = useState('');
  const [counts, setCounts]         = useState({ users: 0, kyc: 0, tickets: 0, loans: 0, chats: 0 });

  // Pulsing animation for live dot
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
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

      const [logo, hid, uc, kc, tc, lc, cc] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key','app_logo_icon').single(),
        supabase.from('app_settings').select('value').eq('key','hidden_admin_modules').single(),
        supabase.from('profiles').select('*',{count:'exact',head:true}),
        supabase.from('kyc_requests').select('*',{count:'exact',head:true}).eq('status','pending'),
        supabase.from('tickets').select('*',{count:'exact',head:true}).eq('status','open'),
        supabase.from('loans').select('*',{count:'exact',head:true}).eq('status','pending'),
        supabase.from('ticket_messages').select('*',{count:'exact',head:true}),
      ]);

      if (logo.data?.value?.url) setLogoUrl(logo.data.value.url);
      if (hid.data?.value) {
        const arr = typeof hid.data.value === 'string' ? JSON.parse(hid.data.value) : hid.data.value;
        if (Array.isArray(arr)) setHidden(arr);
      }
      setCounts({ users: uc.count||0, kyc: kc.count||0, tickets: tc.count||0, loans: lc.count||0, chats: cc.count||0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  modules.operations[2].badge = counts.kyc;
  modules.operations[7].badge = counts.tickets;
  modules.banking[2].badge    = counts.loans;
  modules.internal[3].badge   = counts.chats;

  const isSuper = profile?.role === 'super_admin';
  const isAdmin = isSuper || ['admin'].includes(profile?.role);

  const visibleTabs = tabs.filter(t => !t.superOnly || isSuper);

  const getModuleItems = (key: keyof typeof modules) => {
    let items = modules[key] as any[];
    if (!isAdmin) items = items.filter(it => !hidden.includes(it.route.split('/').pop()?.replace(/-/g,'_') || ''));
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(it => it.title.toLowerCase().includes(q));
    }
    return items;
  };

  const renderModuleGrid = (key: keyof typeof modules) => {
    const meta  = categoryMeta[key];
    const items = getModuleItems(key);
    if (!items.length) return null;

    const totalBadge = items.reduce((s, it) => s + (it.badge || 0), 0);

    return (
      <View key={key} style={s.section}>
        {/* Section header */}
        <View style={s.sectionHeader}>
          <View style={s.sectionHeaderLeft}>
            <LinearGradient
              colors={[`${meta.accent}33`, `${meta.accent}11`]}
              style={s.sectionIconGrad}
            >
              <Ionicons name={meta.icon as any} size={17} color={meta.accent} />
            </LinearGradient>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.sectionTitle}>{meta.title}</Text>
              <Text style={s.sectionSub}>{items.length} modules</Text>
            </View>
          </View>
          {totalBadge > 0 && (
            <View style={[s.sectionBadge, { backgroundColor: `${C.rose}22`, borderColor: `${C.rose}55` }]}>
              <Text style={[s.sectionBadgeText, { color: C.rose }]}>{totalBadge} PENDING</Text>
            </View>
          )}
        </View>

        {/* Grid */}
        <View style={s.moduleGrid}>
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
                {/* Accent top bar */}
                <View style={[s.moduleAccentBar, { backgroundColor: item.color }]} />

                <View style={s.moduleCardInner}>
                  {/* Icon with glow */}
                  <View style={[s.moduleIconWrap, { backgroundColor: item.glow }]}>
                    <Ionicons
                      name={locked ? 'lock-closed' : (item.icon as any)}
                      size={22}
                      color={locked ? C.rose : item.color}
                    />
                  </View>

                  {/* Badges */}
                  <View style={s.moduleBadgeRow}>
                    {item.badge > 0 && (
                      <View style={s.redBadge}>
                        <Text style={s.redBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                    {item.tag && (
                      <View style={[s.tagChip, { backgroundColor: `${item.color}22`, borderColor: `${item.color}44` }]}>
                        <Text style={[s.tagChipText, { color: item.color }]}>{item.tag}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={s.moduleTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.moduleSub} numberOfLines={1}>Tap to open</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const statCards = [
    { label: 'Total Users',  value: loading ? '—' : counts.users.toLocaleString(), icon: 'people',       color: C.blue,    glow: 'rgba(59,130,246,0.2)',   route: '/manage/users' },
    { label: 'Pending KYC',  value: loading ? '—' : String(counts.kyc),            icon: 'scan',         color: counts.kyc > 0 ? C.rose : C.emerald, glow: counts.kyc > 0 ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)', route: '/manage/kyc' },
    { label: 'Open Tickets', value: loading ? '—' : String(counts.tickets),        icon: 'chatbubbles',  color: C.amber,   glow: 'rgba(245,158,11,0.2)',   route: '/manage/tickets' },
    { label: 'Server',       value: '99.9%',                                        icon: 'server',       color: C.emerald, glow: 'rgba(16,185,129,0.2)',   route: '/manage/infrastructure' },
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
        {/* ══════════════════════════════════════
            HEADER  
        ══════════════════════════════════════ */}
        <LinearGradient
          colors={[C.navy, C.navyMid, C.navyUp]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          {/* Decorative orbs */}
          <View style={s.orb1} />
          <View style={s.orb2} />
          <View style={s.orb3} />

          {/* Top row */}
          <View style={s.topRow}>
            {/* Brand */}
            <View style={s.brand}>
              <View style={s.logoBox}>
                <Image
                  source={logoUrl ? { uri: logoUrl } : require('../../assets/images/logo-icon.png')}
                  style={s.logoImg as any}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={s.brandName}>ABU MAFHAL</Text>
                <View style={s.brandTagRow}>
                  <View style={s.liveChip}>
                    <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
                    <Text style={s.liveChipText}>LIVE ADMIN</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right actions */}
            <View style={s.topRightRow}>
              <TouchableOpacity
                style={s.switchBtn}
                onPress={() => router.replace('/(app)/dashboard')}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal" size={14} color={C.gold} />
                <Text style={s.switchBtnText}>App</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.avatarWrap}
                onPress={() => router.push('/manage/profile')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[C.gold, '#D97706']}
                  style={s.avatarRing}
                >
                  <View style={s.avatarInner}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
                    ) : (
                      <Text style={s.avatarInitial}>
                        {profile?.full_name?.[0]?.toUpperCase() || 'A'}
                      </Text>
                    )}
                  </View>
                </LinearGradient>
                <View style={s.onlineDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting */}
          <View style={s.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greetText}>
                Good Day, {profile?.full_name?.split(' ')[0] || 'Admin'} 👋
              </Text>
              <View style={s.rolePillRow}>
                <LinearGradient
                  colors={isSuper ? ['rgba(245,158,11,0.3)','rgba(245,158,11,0.1)'] : ['rgba(255,255,255,0.12)','rgba(255,255,255,0.05)']}
                  style={s.rolePill}
                >
                  <Text style={[s.rolePillText, isSuper && { color: C.gold }]}>
                    {isSuper ? '👑 MASTER KEY — SUPER ADMIN' : '🛡️ STAFF ADMIN'}
                  </Text>
                </LinearGradient>
              </View>
              <Text style={s.sysStatus}>⬤  Core Systems Online · Encrypted · Secure</Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={C.gold} />
            <TextInput
              placeholder="Search 50+ admin modules..."
              placeholderTextColor="rgba(148,163,184,0.7)"
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              selectionColor={C.gold}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(148,163,184,0.6)" />
              </TouchableOpacity>
            ) : (
              <View style={s.kbdHint}>
                <Text style={s.kbdHintText}>⌘K</Text>
              </View>
            )}
          </View>

          {/* Bottom gold accent line */}
          <View style={s.headerAccentLine} />
        </LinearGradient>

        {/* ══════════════════════════════════════
            STAT CARDS  
        ══════════════════════════════════════ */}
        <View style={s.statsRow}>
          {statCards.map((sc, i) => (
            <TouchableOpacity
              key={i}
              style={s.statCard}
              activeOpacity={0.78}
              onPress={() => router.push(sc.route as any)}
            >
              <LinearGradient
                colors={[sc.glow, 'rgba(255,255,255,0)']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[s.statIcon, { backgroundColor: `${sc.color}22` }]}>
                <Ionicons name={sc.icon as any} size={16} color={sc.color} />
              </View>
              <Text style={[s.statValue, { color: sc.color }]}>{sc.value}</Text>
              <Text style={s.statLabel}>{sc.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════
            QUICK ACTIONS
        ══════════════════════════════════════ */}
        <View style={s.qaSection}>
          <View style={s.rowBetween}>
            <Text style={s.blockTitle}>⚡ Quick Actions</Text>
            <View style={s.superBadge}>
              <Text style={s.superBadgeText}>SHORTCUTS</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.qaScroll}
          >
            {quickActions
              .filter(a => !a.superOnly || isSuper)
              .map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.qaCard}
                  activeOpacity={0.76}
                  onPress={() => router.push(a.route as any)}
                >
                  <LinearGradient
                    colors={[a.glow, 'rgba(255,255,255,0)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={[s.qaIcon, { backgroundColor: `${a.color}22` }]}>
                    <Ionicons name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={s.qaLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════
            CATEGORY TABS  
        ══════════════════════════════════════ */}
        <View style={s.tabsSection}>
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
                  {sel ? (
                    <LinearGradient
                      colors={['rgba(245,158,11,0.25)', 'rgba(245,158,11,0.08)']}
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : null}
                  <Ionicons name={tab.icon as any} size={13} color={sel ? C.gold : C.slate} />
                  <Text style={[s.tabText, sel && s.tabTextSel]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════
            MODULE GRIDS  
        ══════════════════════════════════════ */}
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {(activeTab === 'all' || activeTab === 'operations') && renderModuleGrid('operations')}
          {(activeTab === 'all' || activeTab === 'banking')    && renderModuleGrid('banking')}
          {(activeTab === 'all' || activeTab === 'finance')    && renderModuleGrid('finance')}
          {isSuper && (activeTab === 'all' || activeTab === 'technical')  && renderModuleGrid('technical')}
          {(activeTab === 'all' || activeTab === 'internal')   && renderModuleGrid('internal')}
          {isSuper && (activeTab === 'all' || activeTab === 'redZone')    && renderModuleGrid('redZone')}
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════
          FLOATING DOCK  
      ══════════════════════════════════════ */}
      <View style={s.dock}>
        <LinearGradient
          colors={[C.navyMid, C.navy]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <View style={s.dockGoldBorder} />
        {dockItems.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={s.dockItem}
            onPress={() => router.push(d.route as any)}
            activeOpacity={0.75}
          >
            <Ionicons name={d.icon as any} size={22} color={C.gold} />
            <Text style={s.dockLabel}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const CARD_W = (W - 32 - 10) / 2;
const MOD_W  = (W - 32 - 20 - 10) / 2;  // inside section padding

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#090E1A',
  },

  // ── Header ─────────────────────────────
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingHorizontal: 18,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  orb1: {
    position: 'absolute', top: -80, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  orb2: {
    position: 'absolute', bottom: -40, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  orb3: {
    position: 'absolute', top: 60, left: W * 0.35,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  headerAccentLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(245,158,11,0.4)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 38, height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  logoImg: { width: '100%', height: '100%' },
  brandName: {
    color: C.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandTagRow: { flexDirection: 'row', marginTop: 2 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: C.emerald,
  },
  liveChipText: {
    color: C.emerald,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topRightRow: {
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
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  switchBtnText: { color: C.gold, fontSize: 11, fontWeight: '800' },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 40, height: 40,
    borderRadius: 20,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%', height: '100%',
    borderRadius: 18,
    backgroundColor: C.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { color: C.gold, fontSize: 15, fontWeight: '900' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.emerald,
    borderWidth: 1.5,
    borderColor: C.navy,
  },
  greetRow: { marginBottom: 16 },
  greetText: { color: C.white, fontSize: 19, fontWeight: '800', marginBottom: 6 },
  rolePillRow: { flexDirection: 'row', marginBottom: 6 },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rolePillText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800' },
  sysStatus: { color: 'rgba(16,185,129,0.8)', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  searchInput: { flex: 1, color: C.white, fontSize: 13, fontWeight: '600' },
  kbdHint: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5,
  },
  kbdHintText: { color: C.slate, fontSize: 10, fontWeight: '700' },

  // ── Stat Cards ─────────────────────────
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  statCard: {
    width: CARD_W,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  statLabel: { color: C.slate, fontSize: 11, fontWeight: '600' },

  // ── Quick Actions ──────────────────────
  qaSection: { marginTop: 24, paddingLeft: 16 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 12,
  },
  blockTitle: { color: C.white, fontSize: 14, fontWeight: '900' },
  superBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
    borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6,
  },
  superBadgeText: { color: C.gold, fontSize: 9, fontWeight: '900' },
  qaScroll: { gap: 12, paddingRight: 16 },
  qaCard: {
    width: 88,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  qaIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  qaLabel: { color: C.white, fontSize: 10, fontWeight: '800', textAlign: 'center' },

  // ── Tabs ───────────────────────────────
  tabsSection: { marginTop: 22, paddingLeft: 16 },
  tabsScroll: { gap: 8, paddingRight: 16 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  tabPillSel: {
    borderColor: 'rgba(245,158,11,0.5)',
  },
  tabText: { color: C.slate, fontSize: 11, fontWeight: '700' },
  tabTextSel: { color: C.gold, fontWeight: '900' },

  // ── Module Section ─────────────────────
  section: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionIconGrad: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { color: C.white, fontSize: 13, fontWeight: '900' },
  sectionSub: { color: C.slate, fontSize: 10, fontWeight: '600' },
  sectionBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  sectionBadgeText: { fontSize: 9, fontWeight: '900' },

  // ── Module Cards ───────────────────────
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    width: MOD_W,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minHeight: 100,
  },
  moduleAccentBar: {
    height: 3,
    width: '100%',
  },
  moduleCardInner: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  moduleIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  moduleBadgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
    alignItems: 'center',
  },
  redBadge: {
    backgroundColor: C.rose,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 5,
  },
  redBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  tagChip: {
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 5, borderWidth: 0.5,
  },
  tagChipText: { fontSize: 8, fontWeight: '900' },
  moduleTitle: { color: C.white, fontSize: 12, fontWeight: '800', marginBottom: 2 },
  moduleSub: { color: C.slate, fontSize: 9, fontWeight: '500' },

  // ── Dock ───────────────────────────────
  dock: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    elevation: 12,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  dockGoldBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(245,158,11,0.5)',
  },
  dockItem: { alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1 },
  dockLabel: { color: C.gold, fontSize: 9, fontWeight: '800' },
});
