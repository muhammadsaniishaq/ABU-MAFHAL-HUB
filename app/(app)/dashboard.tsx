import { View, Text, TouchableOpacity, ScrollView, Platform, Image, Dimensions, StyleSheet, RefreshControl, FlatList, Linking, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../../hooks/useAppSettings';
import GlobalAnnouncementModal from '../../components/GlobalAnnouncementModal';

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
  const bannerRef = useRef<FlatList>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const partnerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activePartners.length > 0) {
      const totalWidth = activePartners.length * 100;
      Animated.loop(
        Animated.timing(partnerAnim, {
          toValue: -totalWidth,
          duration: Math.max(10000, activePartners.length * 5000),
          useNativeDriver: true,
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
    return () => { supabase.removeChannel(channel); };
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
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['app_logo', 'hidden_features', 'company_name']);
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

  const featureMap: Record<string, string> = {
    '/transfer': 'feature_transfer', '/airtime': 'feature_airtime', '/data': 'feature_data',
    '/education': 'feature_education', '/bills': 'feature_bills', '/virtual-cards': 'feature_cards',
    '/savings': 'feature_savings', '/loans': 'feature_loans', '/crypto': 'feature_crypto',
    '/analytics': 'feature_analytics', '/rewards': 'feature_rewards', '/qr-pay': 'feature_qr',
    '/investments': 'feature_invest', '/insurance': 'feature_insurance', '/bvn-services': 'feature_bvn',
    '/nin-services': 'feature_nin', '/cac-services': 'feature_cac', '/smile': 'feature_smile',
    '/social-boost': 'feature_social', '/bulk-sms': 'feature_bulk_sms'
  };

  const handleActionPress = (action: any) => {
    const featureKey = featureMap[action.route];
    if (featureKey) {
      const flag = featureFlags[featureKey];
      if (flag && !flag.is_enabled) { alert(flag.maintenance_message || 'This feature is currently under maintenance.'); return; }
    }
    if (action.route) router.push(action.route as any);
  };

  const allActions = [
    { icon: 'phone-portrait-outline', label: 'Airtime',      color: '#f97316', route: '/airtime' },
    { icon: 'key-outline',            label: 'Recharge PIN', color: '#10b981', route: '/recharge-pin' },
    { icon: 'cash-outline',           label: 'Airtime ➔ Cash', color: '#16a34a', route: '/airtime-to-cash' },
    { icon: 'wifi-outline',           label: 'Data',         color: '#22c55e', route: '/data' },
    { icon: 'chevron-forward',        label: 'Transfer',     color: '#2563eb', route: '/transfer' },
    { icon: 'receipt-outline',        label: 'Bills',        color: '#eab308', route: '/bills' },
    { icon: 'person-add-outline',     label: 'NIN',          color: '#10b981', route: '/nin-services' },
    { icon: 'ticket-outline',         label: 'Tickets',      color: '#e11d48', route: '/(app)/tickets' },
    { icon: 'chatbubbles-outline',    label: 'Bulk SMS',     color: '#3B82F6', route: '/bulk-sms' },
    { icon: 'tv-outline',             label: 'Cable TV',     color: '#8b5cf6', route: '/bills' },
    { icon: 'flash-outline',          label: 'PHCN',         color: '#f5a623', route: '/bills' },
    { icon: 'globe-outline',          label: 'Smile',        color: '#ec4899', route: '/smile' },
    { icon: 'school-outline',         label: 'Education',    color: '#06b6d4', route: '/education' },
    { icon: 'briefcase-outline',      label: 'CAC Reg',      color: '#8b5cf6', route: '/cac-services' },
    { icon: 'rocket-outline',         label: 'Social',       color: '#ec4899', route: '/social-boost' },
    { icon: 'star-outline',           label: 'Reviews',      color: '#f5a623', route: '/reviews' },
    { icon: 'card-outline',           label: 'Cards',        color: '#8B5CF6', route: '/virtual-cards' },
    { icon: 'wallet-outline',         label: 'Savings',      color: '#107C10', route: '/savings' },
    { icon: 'cash-outline',           label: 'Loans',        color: '#EA580C', route: '/loans' },
    { icon: 'logo-bitcoin',           label: 'Crypto',       color: '#F7931A', route: '/crypto' },
    { icon: 'pie-chart-outline',      label: 'Insights',     color: '#DB2777', route: '/analytics' },
    { icon: 'gift-outline',           label: 'Rewards',      color: '#9333EA', route: '/rewards' },
    { icon: 'qr-code-outline',        label: 'QR Pay',       color: '#10B981', route: '/qr-pay' },
    { icon: 'trending-up-outline',    label: 'Invest',       color: '#3B82F6', route: '/investments' },
    { icon: 'shield-checkmark-outline', label: 'Insurance',  color: '#107C10', route: '/insurance' },
    { icon: 'finger-print-outline',   label: 'BVN',          color: '#0056D2', route: '/bvn-services' },
  ];

  const filteredActions = allActions.filter(action => {
    const featureKey = featureMap[action.route];
    if (featureKey && hiddenFeatures.includes(featureKey)) return false;
    return true;
  });

  const displayedActions = showAllActions 
    ? [...filteredActions, { icon: 'chevron-up-outline', label: 'Less', color: '#64748b', route: 'less' }]
    : [...filteredActions.slice(0, 9), { icon: 'grid-outline', label: 'More', color: '#64748b', route: 'more' }];

  const isVerified = userData?.kyc_tier && userData.kyc_tier > 1;
  const companyName = settings?.company_name || 'MAFHAL SUB';
  const words = companyName.split(' ');
  const firstPart = words[0];
  const rest = words.slice(1).join(' ');

  return (
    <View style={s.container}>
      <StatusBar style="light" />

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
                onPress={() => handleActionPress({ route: '/(app)/wallet', label: 'Top Up' })}
                style={s.fundBtn} activeOpacity={0.85}
              >
                <LinearGradient colors={[T.gold, T.goldDk]} style={s.fundBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="add-circle" size={14} color={T.navy} />
                  <Text style={s.fundBtnTxt}>Fund Wallet</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/history')} style={s.historyBtn} activeOpacity={0.85}>
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

        {/* ─── Quick Actions ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity activeOpacity={0.7} style={s.editBtn}>
              <Text style={s.editBtnTxt}>Edit</Text>
              <Ionicons name="pencil-sharp" size={10} color={T.indigo} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>

          <View style={s.actionsGrid}>
            {displayedActions.map((act, index) => {
              return (
                <TouchableOpacity
                  key={index}
                  style={s.actionItem}
                  onPress={() => {
                    if (act.route === 'more') setShowAllActions(true);
                    else if (act.route === 'less') setShowAllActions(false);
                    else handleActionPress(act);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[s.actionIconBox, { backgroundColor: act.color + '14' }]}>
                    <Ionicons name={act.icon as any} size={18} color={act.color} />
                  </View>
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

  // Actions grid (5-column)
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionItem: { width: (W - 32 - 28 - 40) / 5, alignItems: 'center', marginBottom: 4 },
  actionIconBox: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginBottom: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionLabel: { fontSize: 8, fontWeight: '600', color: T.textSub, textAlign: 'center' },

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
