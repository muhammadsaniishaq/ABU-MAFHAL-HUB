import { View, Text, TouchableOpacity, ScrollView, Platform, Image, Dimensions, StyleSheet, RefreshControl, FlatList, Linking, Animated, Easing, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../../hooks/useAppSettings';
import GlobalAnnouncementModal from '../../components/GlobalAnnouncementModal';
import CelebrationConfetti, { CelebrationSettings, triggerGlobalConfetti } from '../../components/CelebrationConfetti';

const { width: W } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f0f2f8',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
};

const CACHE_KEY = '@dashboard_data_v2';

export default function Dashboard() {
  const [userData, setUserData] = useState<{ full_name: string; balance: number; role?: string; avatar_url?: string; kyc_tier?: number; bvn?: string | null } | null>(null);
  const { settings, loading: settingsLoading } = useAppSettings();
  const [showBalance, setShowBalance] = useState(!settings?.hide_user_balances);

  useEffect(() => {
    if (!settingsLoading) {
      setShowBalance(!settings.hide_user_balances);
    }
  }, [settingsLoading, settings.hide_user_balances]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbError, setDbError] = useState<boolean>(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, any>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBanners, setActiveBanners] = useState<any[]>([]);
  const [activePartners, setActivePartners] = useState<any[]>([]);
  const [serviceCustoms, setServiceCustoms] = useState<Record<string, any>>({});
  const [celebrationSettings, setCelebrationSettings] = useState<CelebrationSettings | null>(null);
  const bannerRef = useRef<FlatList>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const partnerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (activePartners.length > 0) {
      const totalWidth = activePartners.length * 100;
      Animated.loop(
        Animated.timing(partnerAnim, {
          toValue: -totalWidth,
          duration: Math.max(10000, activePartners.length * 5000),
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.linear,
        })
      ).start();
    }
  }, [activePartners.length]);

  useEffect(() => {
    if (activeBanners.length > 1) {
      const interval = setInterval(() => {
        let nextIndex = currentBannerIndex + 1;
        if (nextIndex >= activeBanners.length) nextIndex = 0;
        bannerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setCurrentBannerIndex(nextIndex);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [currentBannerIndex, activeBanners.length]);
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadCachedData().then(() => { loadAllData(); });
    const channel = supabase.channel('dashboard-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, 
        () => setUnreadCount(prev => prev + 1))
      .subscribe();

    const settingsChannel = supabase.channel('dashboard-settings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload: any) => {
        if (payload.new?.key === 'dashboard_service_customizations') {
          try {
            const parsed = typeof payload.new.value === 'string' ? JSON.parse(payload.new.value) : payload.new.value;
            if (parsed && typeof parsed === 'object') {
              setServiceCustoms(parsed);
              saveCache({ serviceCustoms: parsed });
            }
          } catch (e) {}
        }
        if (payload.new?.key === 'hidden_features') {
          try {
            const parsed = typeof payload.new.value === 'string' ? JSON.parse(payload.new.value) : payload.new.value;
            if (parsed) {
              setHiddenFeatures(parsed);
              saveCache({ hiddenFeatures: parsed });
            }
          } catch (e) {}
        }
        if (payload.new?.key === 'celebration_event_settings') {
          try {
            const parsed = typeof payload.new.value === 'string' ? JSON.parse(payload.new.value) : payload.new.value;
            if (parsed) {
              setCelebrationSettings(parsed);
              saveCache({ celebrationSettings: parsed });
            }
          } catch (e) {}
        }
      })
      .subscribe();

    let profileChannel: any = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        profileChannel = supabase.channel(`dashboard-profile-${user.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload: any) => {
            if (payload.new) {
              setUserData(prev => prev ? { ...prev, ...payload.new } : payload.new);
              saveCache({ userData: payload.new });
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, (payload: any) => {
            if (payload.new) {
              setTransactions(prev => [payload.new, ...prev.filter(t => t.id !== payload.new.id).slice(0, 7)]);
            }
          })
          .subscribe();
      }
    });

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(settingsChannel);
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  const loadCachedData = async () => {
    try {
      const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        const cacheAgeMs = Date.now() - (cached.updatedAt || 0);
        const IS_CACHE_STALE = cacheAgeMs > 60 * 60 * 1000;
        if (cached.userData) setUserData(cached.userData);
        if (cached.transactions) setTransactions(cached.transactions);
        if (!IS_CACHE_STALE) {
          if (cached.featureFlags) setFeatureFlags(cached.featureFlags);
          if (cached.logoUrl) setLogoUrl(cached.logoUrl);
          if (cached.unreadCount !== undefined) setUnreadCount(cached.unreadCount);
          if (cached.activePartners) setActivePartners(cached.activePartners);
          if (cached.celebrationSettings) setCelebrationSettings(cached.celebrationSettings);
        } else {
          console.log("Cached feature flags are stale (older than 1 hour). Skipping cache load for flags.");
        }
        setLoading(false);
      }
    } catch (e) {
      console.warn("Cache read error:", e);
    }
  };

  const saveCache = async (data: any) => {
    try {
      const currentCacheStr = await AsyncStorage.getItem(CACHE_KEY);
      const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
      const newCache = { ...currentCache, ...data, updatedAt: Date.now() };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
    } catch (e) {
      console.warn("Cache write error:", e);
    }
  };

  const loadAllData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await Promise.all([
        fetchUserData(user),
        fetchTransactions(user.id),
        fetchFeatureFlags(),
        fetchAppSettings(),
        fetchUnreadCount(user.id),
        fetchActiveBanners(),
        fetchActivePartners()
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadAllData(); }, []);
  const [hiddenFeatures, setHiddenFeatures] = useState<string[]>([]);

  const fetchUnreadCount = async (userId: string) => {
    try {
      const { count } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_read', false);
      if (count !== null) { setUnreadCount(count); saveCache({ unreadCount: count }); }
    } catch (e) { console.warn("Error fetching unread count", e); }
  };

  const fetchActiveBanners = async () => {
    try {
      const { data } = await supabase.from('banners').select('*').eq('is_active', true)
        .or('placement.ilike.*dashboard*,placement.is.null').order('created_at', { ascending: false });
      if (data) setActiveBanners(data);
    } catch (e) { console.warn("Error fetching banners", e); }
  };

  const fetchActivePartners = async () => {
    try {
      const { data } = await supabase.from('partners').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      if (data) { setActivePartners(data); saveCache({ activePartners: data }); }
    } catch (e) { console.warn("Error fetching partners", e); }
  };

  const handleBannerClick = async (banner: any) => {
    supabase.rpc('increment_banner_click', { banner_id: banner.id }).then(({ error }) => {
      if (error) console.log('Banner click track error:', error);
    });
    if (banner.target_url) router.push(banner.target_url);
  };

  const fetchAppSettings = async () => {
    try {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', [
        'app_logo', 'hidden_features', 'company_name', 'dashboard_service_customizations', 'celebration_event_settings'
      ]);
      if (data) {
        data.forEach(setting => {
          if (setting.key === 'app_logo' && setting.value) {
            let url = setting.value;
            try { const parsed = JSON.parse(setting.value); if (parsed.url) url = parsed.url; } catch (e) {}
            setLogoUrl(url); saveCache({ logoUrl: url });
          }
          if (setting.key === 'hidden_features') {
            try { const parsed = JSON.parse(setting.value); setHiddenFeatures(parsed); saveCache({ hiddenFeatures: parsed }); } catch (e) {}
          }
          if (setting.key === 'dashboard_service_customizations') {
            try {
              const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
              if (parsed && typeof parsed === 'object') {
                setServiceCustoms(parsed);
                saveCache({ serviceCustoms: parsed });
              }
            } catch (e) {}
          }
          if (setting.key === 'celebration_event_settings') {
            try {
              const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
              if (parsed && typeof parsed === 'object') {
                setCelebrationSettings(parsed);
                saveCache({ celebrationSettings: parsed });
              }
            } catch (e) {}
          }
        });
      }
    } catch (e) { console.error('Error fetching app settings:', e); }
  };

  const fetchFeatureFlags = async () => {
    try {
      const { data, error } = await supabase.from('feature_flags').select('feature_key, is_enabled, maintenance_message');
      if (error) throw error;
      if (data) {
        const flags = data.reduce((acc: any, curr: any) => { acc[curr.feature_key] = curr; return acc; }, {});
        setFeatureFlags(flags); saveCache({ featureFlags: flags });
      }
    } catch (e) { console.error('Error fetching flags:', e); }
  };

  const fetchTransactions = async (userId: string) => {
    try {
      const { data: txData } = await supabase.from('transactions').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(3);
      if (txData) { setTransactions(txData); saveCache({ transactions: txData }); }
    } catch (e) { console.error('Error fetching transactions:', e); }
  };

  const fetchUserData = async (user: any) => {
    try {
      const { data, error } = await supabase.from('profiles')
        .select('full_name, balance, role, avatar_url, kyc_tier, bvn').eq('id', user.id).single();
      if (data) {
        setUserData(data); saveCache({ userData: data }); setDbError(false);
        setTimeout(async () => {
          if ((data.kyc_tier && data.kyc_tier >= 2) || data.bvn) {
            const { data: va } = await supabase.from('virtual_accounts').select('id').eq('user_id', user.id).maybeSingle();
            if (!va) { supabase.functions.invoke('create-virtual-account', { body: { userId: user.id } }).catch(console.error); }
          }
        }, 3000);
      } else if (error) {
        if (error.message?.includes('recursion') || error.code === '42P17') { setDbError(true); }
        else if (error.code === 'PGRST116') {
          setDbError(false);
          const fallbackName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          const { data: newProfile } = await supabase.from('profiles')
            .insert({ id: user.id, email: user.email || '', full_name: fallbackName, role: 'user', kyc_tier: 1, balance: 0.00 })
            .select('full_name, balance, role, avatar_url, kyc_tier, bvn').single();
          if (newProfile) { setUserData(newProfile); saveCache({ userData: newProfile }); }
        } else { setDbError(false); }
      }
    } catch (e) { console.error('Profile fetch exception:', e); }
  };

  const formatBalance = (bal: any) => {
    const numBal = Number(bal) || 0;
    const formatted = numBal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const parts = formatted.split('.');
    return { main: parts[0], dec: parts[1] ? `.${parts[1]}` : '.00' };
  };

  const balanceParts = formatBalance(userData?.balance || 0);

  const formatTxDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
      if (date.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + `, ${timeStr}`;
    } catch (e) { return ''; }
  };

  const DEFAULT_PINNED_IDS = ['airtime', 'data', 'transfer', 'recharge_pin', 'airtime_cash', 'bills', 'cable', 'electricity', 'nin', 'tickets'];
  const [pinnedActionIds, setPinnedActionIds] = useState<string[]>(DEFAULT_PINNED_IDS);
  const [showEditQuickActionsModal, setShowEditQuickActionsModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@user_custom_quick_actions_v2').then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPinnedActionIds(parsed);
          }
        } catch (_) {}
      }
    });
  }, []);

  const saveQuickActionPreferences = async (newPinned: string[]) => {
    setPinnedActionIds(newPinned);
    try {
      await AsyncStorage.setItem('@user_custom_quick_actions_v2', JSON.stringify(newPinned));
    } catch (_) {}
  };

  const featureMap: Record<string, string> = {
    '/transfer': 'feature_transfer', '/airtime': 'feature_airtime', '/data': 'feature_data',
    '/education': 'feature_education', '/bills': 'feature_bills', '/virtual-cards': 'feature_cards',
    '/savings': 'feature_savings', '/loans': 'feature_loans', '/crypto': 'feature_crypto',
    '/analytics': 'feature_analytics', '/rewards': 'feature_rewards', '/qr-pay': 'feature_qr',
    '/investments': 'feature_invest', '/insurance': 'feature_insurance', '/bvn-services': 'feature_bvn',
    '/nin-services': 'feature_nin', '/cac-services': 'feature_cac', '/smile': 'feature_smile',
    '/social-boost': 'feature_social', '/bulk-sms': 'feature_bulk_sms'
  };

  const handleActionPress = (action: any, e?: any) => {
    if (celebrationSettings?.is_enabled && celebrationSettings?.confetti_on_tap) {
      if (e?.nativeEvent?.pageX && e?.nativeEvent?.pageY) {
        triggerGlobalConfetti(e.nativeEvent.pageX, e.nativeEvent.pageY);
      } else {
        triggerGlobalConfetti();
      }
    }
    const featureKey = featureMap[action.route];
    if (featureKey) {
      const flag = featureFlags[featureKey];
      if (flag && !flag.is_enabled) { alert(flag.maintenance_message || 'This feature is currently under maintenance.'); return; }
    }
    if (action.route) router.push(action.route as any);
  };

  // Base catalog (always the same structure; customizations applied on top)
  const BASE_CATALOG = [
    { id: 'airtime',      icon: 'phone-portrait-outline', label: 'Airtime',         color: '#f97316', route: '/airtime',        badge: null },
    { id: 'data',         icon: 'wifi-outline',           label: 'Data',            color: '#22c55e', route: '/data',           badge: null },
    { id: 'transfer',     icon: 'swap-horizontal-outline',label: 'Transfer',        color: '#2563eb', route: '/transfer',       badge: null },
    { id: 'recharge_pin', icon: 'key-outline',            label: 'Recharge PIN',   color: '#10b981', route: '/recharge-pin',   badge: 'HOT' },
    { id: 'airtime_cash', icon: 'cash-outline',           label: 'Airtime ➤ Cash',color: '#16a34a', route: '/airtime-to-cash',badge: 'NEW' },
    { id: 'bills',        icon: 'receipt-outline',        label: 'Bills',           color: '#eab308', route: '/bills',          badge: null },
    { id: 'nin',          icon: 'person-add-outline',     label: 'NIN',             color: '#10b981', route: '/nin-services',   badge: null },
    { id: 'tickets',      icon: 'ticket-outline',         label: 'Tickets',         color: '#e11d48', route: '/(app)/tickets', badge: null },
    { id: 'bulk_sms',     icon: 'chatbubbles-outline',    label: 'Bulk SMS',        color: '#3B82F6', route: '/bulk-sms',       badge: null },
    { id: 'cable',        icon: 'tv-outline',             label: 'Cable TV',        color: '#8b5cf6', route: '/bills',          badge: null },
    { id: 'electricity',  icon: 'flash-outline',          label: 'PHCN',            color: '#f5a623', route: '/bills',          badge: null },
    { id: 'smile',        icon: 'globe-outline',          label: 'Smile',           color: '#ec4899', route: '/smile',          badge: null },
    { id: 'education',    icon: 'school-outline',         label: 'Education',       color: '#06b6d4', route: '/education',      badge: null },
    { id: 'cac',          icon: 'briefcase-outline',      label: 'CAC Reg',         color: '#8b5cf6', route: '/cac-services',   badge: 'POPULAR' },
    { id: 'social',       icon: 'rocket-outline',         label: 'Social',          color: '#ec4899', route: '/social-boost',   badge: 'BOOST' },
    { id: 'reviews',      icon: 'star-outline',           label: 'Reviews',         color: '#f5a623', route: '/reviews',        badge: null },
    { id: 'cards',        icon: 'card-outline',           label: 'Cards',           color: '#8B5CF6', route: '/virtual-cards',  badge: null },
    { id: 'savings',      icon: 'wallet-outline',         label: 'Savings',         color: '#107C10', route: '/savings',        badge: null },
    { id: 'loans',        icon: 'cash-outline',           label: 'Loans',           color: '#EA580C', route: '/loans',          badge: null },
    { id: 'crypto',       icon: 'logo-bitcoin',           label: 'Crypto',          color: '#F7931A', route: '/crypto',         badge: 'WEB3' },
    { id: 'analytics',   icon: 'pie-chart-outline',      label: 'Insights',        color: '#DB2777', route: '/analytics',      badge: null },
    { id: 'rewards',      icon: 'gift-outline',           label: 'Rewards',         color: '#9333EA', route: '/rewards',        badge: null },
    { id: 'qr',           icon: 'qr-code-outline',        label: 'QR Pay',          color: '#10B981', route: '/qr-pay',         badge: null },
    { id: 'investments',  icon: 'trending-up-outline',    label: 'Invest',          color: '#3B82F6', route: '/investments',    badge: null },
    { id: 'insurance',    icon: 'shield-checkmark-outline',label: 'Insurance',      color: '#107C10', route: '/insurance',      badge: null },
    { id: 'bvn',          icon: 'finger-print-outline',   label: 'BVN',             color: '#0056D2', route: '/bvn-services',   badge: null },
  ];

  // Apply admin customizations on top of base catalog
  const ALL_ACTIONS_CATALOG = useMemo(() => {
    return BASE_CATALOG
      .filter(item => {
        const cust = serviceCustoms[item.id];
        return !cust || cust.is_visible !== false;
      })
      .map(item => {
        const cust = serviceCustoms[item.id];
        if (!cust) return item;
        return {
          ...item,
          icon: cust.custom_icon || item.icon,
          label: cust.custom_label || item.label,
          color: cust.custom_color || item.color,
          badge: cust.custom_badge !== undefined ? cust.custom_badge : item.badge,
          bgStyle: cust.custom_bg_style || 'tint',
        };
      });
  }, [serviceCustoms]);

  const catalogMap = useMemo(() => new Map(ALL_ACTIONS_CATALOG.map(a => [a.id, a])), [ALL_ACTIONS_CATALOG]);

  const pinnedActions = useMemo(() => {
    return pinnedActionIds
      .map(id => catalogMap.get(id))
      .filter((a): a is typeof ALL_ACTIONS_CATALOG[0] => Boolean(a))
      .filter(action => {
        const featureKey = featureMap[action.route];
        return !(featureKey && hiddenFeatures.includes(featureKey));
      });
  }, [pinnedActionIds, catalogMap, hiddenFeatures]);

  const unpinnedActions = useMemo(() => {
    return ALL_ACTIONS_CATALOG
      .filter(a => !pinnedActionIds.includes(a.id))
      .filter(action => {
        const featureKey = featureMap[action.route];
        return !(featureKey && hiddenFeatures.includes(featureKey));
      });
  }, [ALL_ACTIONS_CATALOG, pinnedActionIds, hiddenFeatures]);

  const displayedActions = useMemo(() => {
    return showAllActions 
      ? [...pinnedActions, ...unpinnedActions, { id: 'less', icon: 'chevron-up-outline', label: 'Less', color: '#64748b', route: 'less', badge: null }]
      : [...pinnedActions.slice(0, 7), { id: 'more', icon: 'grid-outline', label: 'More', color: T.indigo, route: 'more', badge: null }];
  }, [showAllActions, pinnedActions, unpinnedActions]);

  const isVerified = userData?.kyc_tier && userData.kyc_tier > 1;
  const companyName = settings?.company_name || 'MAFHAL SUB';
  const words = companyName.split(' ');
  const firstPart = words[0];
  const rest = words.slice(1).join(' ');

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      {/* ── Festive Confetti Engine & Floating Particles ── */}
      <CelebrationConfetti settings={celebrationSettings} />

      <ScrollView 
        style={s.scrollView}
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
      >
        {/* ─── PREMIUM HEADER ─── */}
        <LinearGradient
          colors={['#06112b', '#0d1f4a', '#112660']}
          style={[s.headerContainer, { paddingTop: insets.top + 12 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative circles */}
          <View style={s.decorCircle1} />
          <View style={s.decorCircle2} />

          {/* ── Top bar: Logo + Brand + Admin + Bell ── */}
          <View style={s.headerTop}>
            <View style={s.brandRow}>
              <View style={s.logoWrapper}>
                <Image
                  source={logoUrl ? { uri: logoUrl } : (settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                  style={s.headerLogo as any}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={s.brandTxt}>{firstPart.toUpperCase()}</Text>
                {rest ? <Text style={s.brandSub}>{rest.toUpperCase()}</Text> : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {['admin', 'super_admin'].includes(userData?.role || '') && (
                <TouchableOpacity onPress={() => router.push('/manage')} style={s.adminConsoleBtn} activeOpacity={0.8}>
                  <LinearGradient colors={['#f5a623', '#d4890e']} style={s.adminConsoleBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="shield-checkmark" size={10} color="#0d1b3e" style={{ marginRight: 3 }} />
                    <Text style={s.adminConsoleBtnTxt}>Admin</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => router.push('/notifications')} style={s.bellBtn} activeOpacity={0.8}>
                <Ionicons name="notifications-outline" size={20} color={T.white} />
                {unreadCount > 0 && (
                  <View style={s.bellBadge}>
                    <Text style={s.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Welcome Row ── */}
          <View style={s.welcomeRow}>
            <View style={s.avatarWrapper}>
              <Image
                source={{ uri: userData?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=150&h=150' }}
                style={s.avatarImage}
              />
              <View style={s.avatarOnline} />
            </View>
            <View style={s.welcomeTextCol}>
              <Text style={s.welcomeSub}>Welcome back 👋</Text>
              <Text style={s.welcomeName} numberOfLines={1}>{userData?.full_name || 'Muhammad Sani'}</Text>
              <View style={[s.verifiedPill, { backgroundColor: isVerified ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)', marginTop: 3 }]}>
                <Ionicons name={isVerified ? 'checkmark-circle' : 'alert-circle'} size={10} color={isVerified ? '#4ade80' : '#fbbf24'} style={{ marginRight: 3 }} />
                <Text style={[s.verifiedTxt, { color: isVerified ? '#4ade80' : '#fbbf24' }]}>
                  {isVerified ? 'Verified Account' : 'Unverified Account'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Floating Balance Card ── */}
          <View style={s.balanceCard}>
            <View style={s.watermarkWrapper}>
              <Image
                source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png'))}
                style={s.watermarkImage} resizeMode="contain"
              />
            </View>

            {/* Left: Balance info */}
            <View style={s.cardLeft}>
              <View style={s.balanceHeader}>
                <Ionicons name="wallet-outline" size={11} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
                <Text style={s.balanceLabel}>Wallet Balance</Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} activeOpacity={0.7} style={{ marginLeft: 6 }}>
                  <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={13} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              </View>

              <View style={s.amountRow}>
                {showBalance ? (
                  <Text style={s.amountMain}>
                    <Text style={s.amountSymbol}>₦</Text>
                    {balanceParts.main}
                    <Text style={s.amountDec}>{balanceParts.dec}</Text>
                  </Text>
                ) : (
                  <Text style={s.amountMain}><Text style={s.amountSymbol}>₦</Text>••••••</Text>
                )}
              </View>
              <Text style={s.availLabel}>Available Balance</Text>
            </View>

            {/* Right: Action buttons */}
            <View style={s.cardRight}>
              <TouchableOpacity
                onPress={(e) => handleActionPress({ route: '/(app)/wallet', label: 'Top Up' }, e)}
                style={s.fundBtn} activeOpacity={0.85}
              >
                <LinearGradient colors={[T.gold, T.goldDk]} style={s.fundBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="add-circle" size={14} color={T.navy} />
                  <Text style={s.fundBtnTxt}>Fund Wallet</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={(e) => handleActionPress({ route: '/history', label: 'Tx History' }, e)} style={s.historyBtn} activeOpacity={0.85}>
                <Ionicons name="receipt-outline" size={12} color="rgba(255,255,255,0.75)" style={{ marginRight: 4 }} />
                <Text style={s.historyBtnTxt}>Tx History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ─── SLIM DYNAMIC BANNERS ─── */}
        {activeBanners.length > 0 && (
          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <FlatList
              ref={bannerRef}
              data={activeBanners}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              pagingEnabled
              snapToInterval={W - 32 + 10}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  onPress={() => handleBannerClick(item)}
                  activeOpacity={0.9}
                  style={[s.bannerCard, { marginRight: index < activeBanners.length - 1 ? 10 : 0 }]}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={['#0f172a', '#1e293b']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }} numberOfLines={1}>{item.title}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 10 }}>Tap ➔</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Database Warning */}
        {dbError && (
          <View style={s.dbErrorBox}>
            <View style={s.dbErrorHeader}>
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={s.dbErrorTitle}>Database Access Limited</Text>
            </View>
            <Text style={s.dbErrorText}>Infinite recursion detected in database policies. Please apply the SQL fix to Supabase database.</Text>
          </View>
        )}

        {/* ─── Modernized Quick Actions Section ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.sectionTitle}>Quick Actions</Text>
              <View style={{ backgroundColor: T.navyMid + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: T.navyMid }}>{pinnedActions.length} Pinned</Text>
              </View>
            </View>
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={s.editBtn}
              onPress={() => setShowEditQuickActionsModal(true)}
            >
              <Ionicons name="create-outline" size={11} color={T.indigo} style={{ marginRight: 3 }} />
              <Text style={s.editBtnTxt}>Edit Actions</Text>
            </TouchableOpacity>
          </View>

          <View style={s.actionsGrid}>
            {displayedActions.map((act, index) => {
              const isBadged = Boolean(act.badge);
              return (
                <TouchableOpacity
                  key={act.id || index}
                  style={s.actionItem}
                  onPress={(e) => {
                    if (act.route === 'more') setShowAllActions(true);
                    else if (act.route === 'less') setShowAllActions(false);
                    else handleActionPress(act, e);
                  }}
                  activeOpacity={0.75}
                >
                  <Animated.View
                    style={[
                      s.actionIconBox,
                      { borderColor: act.color + '45' },
                      isBadged && { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <Ionicons name={act.icon as any} size={24} color={act.color} />
                    {act.badge ? (
                      <View style={[s.badgeOverlay, { backgroundColor: act.color }]}>
                        <Text style={s.badgeText}>{act.badge}</Text>
                      </View>
                    ) : null}
                  </Animated.View>
                  <Text style={s.actionLabel} numberOfLines={1}>{act.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── Refer & Earn Banner ─── */}
        <View style={s.promoContainer}>
          <LinearGradient 
            colors={['#071633', '#0e2652']} 
            style={s.promoCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={s.promoLeft}>
              <Text style={s.promoTitle}>Refer & Earn</Text>
              <Text style={s.promoDesc}>Invite friends and earn exciting rewards</Text>
              <TouchableOpacity onPress={() => router.push('/referrals')} style={s.promoBtn} activeOpacity={0.8}>
                <Text style={s.promoBtnTxt}>Refer Now</Text>
                <Ionicons name="arrow-forward" size={10} color={T.white} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
            <View style={s.promoRight}>
              <Image source={require('../../assets/images/referral_gift.jpg')} style={s.promoGiftImage} resizeMode="contain" />
            </View>
          </LinearGradient>
        </View>

        {/* ─── Customer Reviews Banner ─── */}
        <View style={[s.promoContainer, { marginTop: -8 }]}>
          <TouchableOpacity onPress={() => router.push('/reviews')} activeOpacity={0.85}>
            <LinearGradient 
              colors={['#0d1b3e', '#142258']} 
              style={[s.promoCard, { borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)' }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={s.promoLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={[s.promoTitle, { fontSize: 12 }]}>Customer Reviews</Text>
                  <View style={{ flexDirection: 'row', marginLeft: 5, gap: 1 }}>
                    {[1,2,3,4,5].map(st => <Ionicons key={st} name="star" size={9} color="#f5a623" />)}
                  </View>
                </View>
                <Text style={s.promoDesc}>See what 1,400+ satisfied users say or leave your rating!</Text>
                <View style={[s.promoBtn, { backgroundColor: '#f5a623', marginTop: 6 }]}>
                  <Text style={[s.promoBtnTxt, { color: '#0d1b3e', fontWeight: 'bold' }]}>Explore Reviews</Text>
                  <Ionicons name="arrow-forward" size={10} color="#0d1b3e" style={{ marginLeft: 4 }} />
                </View>
              </View>
              <View style={s.promoRight}>
                <Ionicons name="chatbubbles" size={40} color="rgba(245, 166, 35, 0.3)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ─── Recent Transactions ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/history')} activeOpacity={0.7}>
              <Text style={s.seeAllTxt}>See All</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            if (transactions.length === 0) {
              return (
                <View style={s.txEmpty}>
                  <Ionicons name="receipt-outline" size={18} color={T.textSub} style={{ marginBottom: 5 }} />
                  <Text style={s.txEmptyText}>No recent transactions</Text>
                </View>
              );
            }
            return transactions.slice(0, 3).map((tx, i) => {
              const isDeposit = tx.type === 'deposit' || tx.type === 'referral_withdrawal';
              let iconName: any = 'arrow-up';
              let iconBg = '#107c10';
              if (tx.type === 'payment' || tx.type === 'bill') { iconName = 'receipt'; iconBg = '#0056d2'; }
              else if (tx.type === 'transfer') { iconName = 'arrow-up'; iconBg = '#ef4444'; }
              else if (isDeposit) { iconName = 'arrow-down'; iconBg = '#107c10'; }

              let metaText = '';
              if (tx.metadata) {
                const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
                metaText = meta.recipient || meta.biller || meta.bank_name || meta.method || '';
              }
              if (!metaText) {
                if (tx.type === 'deposit') metaText = 'Bank Transfer';
                else if (tx.type === 'transfer') metaText = 'Transfer Out';
                else if (tx.type === 'bill' || tx.type === 'payment') {
                  if (tx.description?.toLowerCase().includes('airtime')) metaText = 'MTN – 0803 123 4567';
                  else if (tx.description?.toLowerCase().includes('electricity')) metaText = 'KEDCO – Prepaid';
                  else metaText = 'Utility Bill';
                }
              }

              return (
                <View key={tx.id || i} style={s.txRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[s.txIconBox, { backgroundColor: iconBg + '18' }]}>
                      <Ionicons name={iconName} size={14} color={iconBg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txTitle} numberOfLines={1}>{tx.description || 'Transaction'}</Text>
                      <Text style={s.txSub} numberOfLines={1}>{metaText}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.txAmount, { color: isDeposit ? '#107c10' : '#ef4444' }]}>
                      {isDeposit ? '+' : '-'}₦{parseFloat(tx.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={s.txDateText}>{formatTxDate(tx.created_at)}</Text>
                  </View>
                </View>
              );
            });
          })()}
        </View>

        {/* ─── Pay Bills Scroll Row ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Pay Bills</Text>
            <TouchableOpacity onPress={() => router.push('/bills')} activeOpacity={0.7}>
              <Text style={s.seeAllTxt}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.billsScroll}>
            {[
              { label: 'PHCN',       gradient: ['#fef08a', '#fef9c3'], icon: 'flash',             color: '#eab308' },
              { label: 'DStv',       gradient: ['#dbeafe', '#eff6ff'], icon: 'tv',                color: '#2563eb' },
              { label: 'GOtv',       gradient: ['#bbf7d0', '#f0fdf4'], icon: 'play-circle',       color: '#16a34a' },
              { label: 'StarTimes',  gradient: ['#fed7aa', '#fff7ed'], icon: 'star',              color: '#ea580c' },
              { label: 'Spectranet', gradient: ['#f5d0fe', '#fdf4ff'], icon: 'globe',             color: '#d946ef' },
              { label: 'More',       gradient: ['#e2e8f0', '#f1f5f9'], icon: 'ellipsis-horizontal', color: '#64748b' }
            ].map((op, i) => (
              <TouchableOpacity key={i} onPress={() => router.push('/bills')} style={s.billOpCard} activeOpacity={0.8}>
                <LinearGradient colors={op.gradient as any} style={s.billOpGlow}>
                  <Ionicons name={op.icon as any} size={20} color={op.color} />
                </LinearGradient>
                <Text style={s.billOpLabel}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Our Partners ─── */}
        {activePartners.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Our Partners</Text>
            </View>
            <View style={{ overflow: 'hidden', height: 52, width: '100%' }}>
              <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: partnerAnim }] }}>
                {[...activePartners, ...activePartners, ...activePartners, ...activePartners].map((partner, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    {partner.logo_url ? (
                      <Image source={{ uri: partner.logo_url }} style={{ width: 24, height: 24, borderRadius: 5, marginRight: 6 }} resizeMode="contain" />
                    ) : (
                      <Ionicons name="business" size={20} color="#CBD5E1" style={{ marginRight: 6 }} />
                    )}
                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>{partner.name}</Text>
                  </View>
                ))}
              </Animated.View>
            </View>
          </View>
        )}

        {/* ─── Secure Banner ─── */}
        <TouchableOpacity style={s.secureBanner} activeOpacity={0.9}>
          <View style={s.secureLeft}>
            <View style={s.secureShield}>
              <Ionicons name="shield-checkmark" size={16} color={T.goldDk} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={s.secureTitle}>Secure. Fast. Reliable.</Text>
              <Text style={s.secureDesc} numberOfLines={1}>Your transactions are protected with top-tier security.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color={T.navy} />
        </TouchableOpacity>

      </ScrollView>

      {/* ─── CUSTOMIZE QUICK ACTIONS MODAL ─── */}
      <Modal
        visible={showEditQuickActionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditQuickActionsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(13, 27, 62, 0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%' }}>
            
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.indigo + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="apps-sharp" size={20} color={T.indigo} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: T.navy }}>Customize Shortcuts</Text>
                  <Text style={{ fontSize: 10, color: T.textSub, fontWeight: '600' }}>Pin & organize services shown on your homepage</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setShowEditQuickActionsModal(false)}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={T.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              
              {/* Pinned Shortcuts Section */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: T.navy, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    📌 Pinned Shortcuts ({pinnedActionIds.length})
                  </Text>
                  <Text style={{ fontSize: 9, color: T.indigo, fontWeight: '700' }}>Tap arrows to reorder</Text>
                </View>

                {pinnedActionIds.length === 0 ? (
                  <View style={{ padding: 14, backgroundColor: T.bg, borderRadius: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: T.textSub, fontStyle: 'italic' }}>No pinned shortcuts. Add services below!</Text>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    {pinnedActionIds.map((id, idx) => {
                      const item = catalogMap.get(id);
                      if (!item) return null;
                      return (
                        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bg, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={item.icon as any} size={16} color={item.color} />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: T.navy }}>{item.label}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {/* Move Up */}
                            <TouchableOpacity
                              disabled={idx === 0}
                              onPress={() => {
                                if (idx > 0) {
                                  const newArr = [...pinnedActionIds];
                                  const temp = newArr[idx];
                                  newArr[idx] = newArr[idx - 1];
                                  newArr[idx - 1] = temp;
                                  setPinnedActionIds(newArr);
                                }
                              }}
                              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: idx === 0 ? '#f1f5f9' : '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Ionicons name="chevron-up" size={14} color={idx === 0 ? '#cbd5e1' : T.navy} />
                            </TouchableOpacity>

                            {/* Move Down */}
                            <TouchableOpacity
                              disabled={idx === pinnedActionIds.length - 1}
                              onPress={() => {
                                if (idx < pinnedActionIds.length - 1) {
                                  const newArr = [...pinnedActionIds];
                                  const temp = newArr[idx];
                                  newArr[idx] = newArr[idx + 1];
                                  newArr[idx + 1] = temp;
                                  setPinnedActionIds(newArr);
                                }
                              }}
                              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: idx === pinnedActionIds.length - 1 ? '#f1f5f9' : '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Ionicons name="chevron-down" size={14} color={idx === pinnedActionIds.length - 1 ? '#cbd5e1' : T.navy} />
                            </TouchableOpacity>

                            {/* Unpin */}
                            <TouchableOpacity
                              onPress={() => {
                                setPinnedActionIds(pinnedActionIds.filter(pid => pid !== id));
                              }}
                              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}
                            >
                              <Ionicons name="close-circle" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Available Services Section */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: T.navy, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  ➕ Available Services
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_ACTIONS_CATALOG.filter(a => !pinnedActionIds.includes(a.id)).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        setPinnedActionIds([...pinnedActionIds, item.id]);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.bg, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}
                    >
                      <Ionicons name={item.icon as any} size={14} color={item.color} />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: T.navy }}>{item.label}</Text>
                      <Ionicons name="add-circle" size={14} color={T.indigo} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
              <TouchableOpacity
                onPress={() => {
                  saveQuickActionPreferences(DEFAULT_PINNED_IDS);
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: T.bg, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: T.textSub }}>Reset 🔄</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  saveQuickActionPreferences(pinnedActionIds);
                  setShowEditQuickActionsModal(false);
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: T.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.gold }}
              >
                <Text style={{ fontSize: 12, fontWeight: '900', color: T.gold, textTransform: 'uppercase' }}>Save Shortcuts 💾</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      <GlobalAnnouncementModal />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1 },

  // ─── Premium Header ───
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(245,166,35,0.06)',
    top: -60, right: -40,
  },
  decorCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(79,70,229,0.08)',
    bottom: 0, left: -30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrapper: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  headerLogo: { width: '100%', height: '100%', borderRadius: 8 },
  brandTxt: { fontSize: 13, fontWeight: '900', color: T.white, letterSpacing: 0.5, lineHeight: 15 },
  brandSub: { fontSize: 8, fontWeight: '700', color: T.gold, letterSpacing: 1.5, lineHeight: 10 },
  bellBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#06112b', paddingHorizontal: 2,
  },
  bellBadgeText: { fontSize: 7.5, fontWeight: '900', color: '#fff' },

  // Welcome row
  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarWrapper: { position: 'relative' },
  avatarImage: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2.5, borderColor: T.gold,
    backgroundColor: T.navyMid,
  },
  avatarOnline: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2, borderColor: '#06112b',
  },
  welcomeTextCol: { flex: 1, marginLeft: 12 },
  welcomeSub: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginBottom: 1 },
  welcomeName: { fontSize: 16, fontWeight: '900', color: T.white, letterSpacing: 0.2 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  verifiedTxt: { fontSize: 9, fontWeight: '700' },

  // ─── Floating Balance Card ───
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  watermarkWrapper: { position: 'absolute', right: -20, top: -20, width: 100, height: 100, opacity: 0.05 },
  watermarkImage: { width: '100%', height: '100%' },
  cardLeft: { flex: 1.2 },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  balanceLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.3 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  amountSymbol: { fontSize: 18, fontWeight: '700', color: T.white, marginRight: 1, lineHeight: 34 },
  amountMain: { fontSize: 30, fontWeight: '900', color: T.white, letterSpacing: -1 },
  amountDec: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  availLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  cardRight: { alignItems: 'stretch', gap: 8, marginLeft: 12 },
  fundBtn: {
    borderRadius: 12, overflow: 'hidden',
    shadowColor: T.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  fundBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  fundBtnTxt: { fontSize: 11, fontWeight: '900', color: T.navy, marginLeft: 4 },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 9,
  },
  historyBtnTxt: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },

  // Banner card
  bannerCard: {
    width: W - 32, height: 56, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  // DB error
  dbErrorBox: {
    backgroundColor: '#fef2f2', padding: 12, borderRadius: 14, borderWidth: 1,
    borderColor: '#fee2e2', marginHorizontal: 16, marginBottom: 12, marginTop: 12,
  },
  dbErrorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dbErrorTitle: { color: '#991b1b', fontWeight: '800', fontSize: 11, marginLeft: 5 },
  dbErrorText: { color: '#b91c1c', fontSize: 9, lineHeight: 13 },

  // Sections
  section: {
    backgroundColor: T.white, borderRadius: 20, padding: 14,
    marginHorizontal: 16, marginBottom: 14, marginTop: 12,
    shadowColor: T.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: T.navy },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(79,70,229,0.07)',
    borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3,
  },
  editBtnTxt: { fontSize: 9.5, fontWeight: '700', color: T.indigo },
  seeAllTxt: { fontSize: 10.5, fontWeight: '700', color: T.indigo },

  // Actions grid — 4-column modernized layout
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  actionItem: {
    width: (W - 32 - 28 - 24) / 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: T.navy,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
  badgeOverlay: {
    position: 'absolute',
    top: -5,
    right: -6,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    fontSize: 6.5,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Promo Banner
  promoContainer: {
    marginHorizontal: 16, marginBottom: 14,
    shadowColor: T.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  promoCard: { borderRadius: 20, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' },
  promoLeft: { flex: 1.4 },
  promoTitle: { fontSize: 14, fontWeight: '900', color: T.white, marginBottom: 3 },
  promoDesc: { fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginBottom: 10, lineHeight: 13 },
  promoBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
  },
  promoBtnTxt: { fontSize: 9, fontWeight: '700', color: T.white },
  promoRight: { width: 80, height: 70, position: 'relative' },
  promoGiftImage: { width: 90, height: 90, position: 'absolute', right: -10, bottom: -10 },

  // Transactions
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9',
  },
  txIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  txTitle: { fontSize: 11, fontWeight: '800', color: T.text },
  txSub: { fontSize: 8.5, color: T.textSub, marginTop: 1 },
  txAmount: { fontSize: 11, fontWeight: '900', textAlign: 'right' },
  txDateText: { fontSize: 8, color: T.textSub, textAlign: 'right', marginTop: 2 },
  txEmpty: { alignItems: 'center', paddingVertical: 20 },
  txEmptyText: { fontSize: 10.5, color: T.textSub, fontStyle: 'italic', marginTop: 6 },
  txStatus: { fontSize: 7.5, fontWeight: '700', color: T.textSub, textAlign: 'right', marginTop: 1, textTransform: 'uppercase' },

  // Pay bills scroll
  billsScroll: { paddingRight: 8 },
  billOpCard: { alignItems: 'center', marginRight: 14, width: 50 },
  billOpGlow: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 5, shadowColor: T.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1,
  },
  billOpLabel: { fontSize: 8, fontWeight: '700', color: T.textSub, textAlign: 'center' },

  // Secure banner
  secureBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fef7ea', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 18, padding: 12, marginHorizontal: 16, marginBottom: 14,
  },
  secureLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  secureShield: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: T.gold + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  secureTitle: { fontSize: 11, fontWeight: '800', color: T.navy },
  secureDesc: { fontSize: 9, color: T.textSub, marginTop: 1 },

  // Admin Console
  adminConsoleBtn: { borderRadius: 8, overflow: 'hidden', shadowColor: '#f5a623', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 2 },
  adminConsoleBtnGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 },
  adminConsoleBtnTxt: { fontSize: 9.5, fontWeight: '800', color: '#0d1b3e' },
});
