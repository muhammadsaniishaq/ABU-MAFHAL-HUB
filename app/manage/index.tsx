import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Platform,
  Image, Alert, StatusBar, Animated, useWindowDimensions, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle, Line, Path, Text as SvgText, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Official Design Tokens
const T = {
  navyDark: '#070f26',
  navy: '#0d1b3e',
  navyMid: '#1e293b',
  gold: '#f5a623',
  goldDk: '#d97706',
  goldLight: '#fef3c7',
  white: '#ffffff',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#0f172a',
  subText: '#64748b',
  border: '#f1f5f9',
  borderDark: '#e2e8f0',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#d97706',
  warningBg: '#fef3c7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  info: '#2563eb',
  infoBg: '#eff6ff',
};

// All System Modules (Accessible via Drawer & More)
const ALL_MODULES = [
  { t: 'API Liquidity', i: 'wallet', r: '/manage/liquidity', c: '#f5a623', tag: 'Core' },
  { t: 'API Vault Keys', i: 'key', r: '/manage/secrets', c: '#0d1b3e', tag: 'Vault' },
  { t: 'Users Control', i: 'people', r: '/manage/users', c: '#2563eb', tag: 'Core' },
  { t: 'Transactions', i: 'receipt', r: '/manage/transactions', c: '#7c3aed', tag: 'Live' },
  { t: 'KYC Verification', i: 'shield-checkmark', r: '/manage/kyc', c: '#16a34a', tag: 'KYC' },
  { t: 'NIN Tasks', i: 'card', r: '/manage/nin-tasks', c: '#0d1b3e', tag: 'Identity' },
  { t: 'BVN Tasks', i: 'finger-print', r: '/manage/bvn-tasks', c: '#f5a623', tag: 'Identity' },
  { t: 'Data Plans', i: 'wifi', r: '/manage/data-plans', c: '#2563eb', tag: 'Telecom' },
  { t: 'Airtime VTU', i: 'call', r: '/manage/airtime', c: '#0d1b3e', tag: 'VTU' },
  { t: 'Manage Rates', i: 'stats-chart', r: '/manage/rates', c: '#f5a623', tag: 'Live' },
  { t: 'CAC Management', i: 'briefcase', r: '/manage/cac', c: '#0d1b3e' },
  { t: 'CAC Pricing', i: 'pricetag', r: '/manage/cac-pricing', c: '#f5a623' },
  { t: 'NIN Pricing', i: 'pricetag', r: '/manage/nin-pricing', c: '#0d1b3e' },
  { t: 'BVN Pricing', i: 'pricetags', r: '/manage/bvn-pricing', c: '#f5a623' },
  { t: 'SMM Services', i: 'logo-bitcoin', r: '/manage/smm-pricing', c: '#ea580c' },
  { t: 'Broadcast & SMS', i: 'megaphone', r: '/manage/communications', c: '#7c3aed' },
  { t: 'Mail Center', i: 'mail-unread', r: '/manage/mail-center', c: '#2563eb' },
  { t: 'Audit Logs', i: 'document-text', r: '/manage/logs', c: '#0d1b3e', tag: 'Security' },
  { t: 'Infrastructure', i: 'server', r: '/manage/infrastructure', c: '#0d1b3e' },
  { t: 'Database Hub', i: 'server', r: '/manage/db', c: '#16a34a' },
  { t: 'Cortex AI Engine', i: 'sparkles', r: '/manage/ai', c: '#f5a623', tag: 'AI' },
  { t: 'Accounting & Profit', i: 'calculator', r: '/manage/accounting', c: '#f5a623' },
  { t: 'App Updates', i: 'cloud-download', r: '/manage/app-update', c: '#2563eb' },
  { t: 'Security & Forensics', i: 'finger-print', r: '/manage/forensics', c: '#dc2626' },
  { t: 'Settings', i: 'settings', r: '/manage/settings', c: '#64748b' },
  { t: 'PANIC ROOM', i: 'warning', r: '/manage/panic', c: '#dc2626', tag: 'Emergency' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState<'Last 7 Days' | 'Last 14 Days' | 'Last 30 Days'>('Last 7 Days');
  const [showTimeframeModal, setShowTimeframeModal] = useState(false);

  // Live Clock & Date State
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Live Metrics
  const [counts, setCounts] = useState({
    users: 12480,
    liquidity: 8450000,
    transactions: 24382,
    kyc: 320
  });

  // Recent Transactions
  const [recentTxns, setRecentTxns] = useState<any[]>([
    { id: '1', name: 'Sani Usman', service: 'Data (1GB)', amount: 500, time: '2 mins ago', status: 'Success', avatar: require('../../assets/images/ceo.jpg') },
    { id: '2', name: 'Aisha Muhammad', service: 'Airtime (₦1,000)', amount: 1000, time: '5 mins ago', status: 'Success', avatar: require('../../assets/images/ceo.jpg') },
    { id: '3', name: 'Ibrahim Musa', service: 'BVN Verification', amount: 200, time: '12 mins ago', status: 'Success', avatar: require('../../assets/images/ceo.jpg') },
    { id: '4', name: 'Zainab Ali', service: 'Crypto Deposit', amount: 10000, time: '18 mins ago', status: 'Pending', avatar: require('../../assets/images/ceo.jpg') },
    { id: '5', name: 'Yusuf Bello', service: 'NIN Verification', amount: 250, time: '25 mins ago', status: 'Failed', avatar: require('../../assets/images/ceo.jpg') },
  ]);

  // Notifications
  const alertsList = [
    { id: '1', title: 'Low liquidity alert', sub: 'Data Provider balance below threshold.', time: '10 mins ago', type: 'danger', icon: 'arrow-down-circle' as const },
    { id: '2', title: 'High API failure rate', sub: 'Identity Verify API (12%).', time: '28 mins ago', type: 'warning', icon: 'warning' as const },
    { id: '3', title: 'New provider connected', sub: 'Crypto Gateway connected.', time: '1 hour ago', type: 'info', icon: 'information-circle' as const },
    { id: '4', title: 'Reconciliation completed', sub: 'Balances updated successfully.', time: '2 hours ago', type: 'success', icon: 'checkmark-circle' as const },
  ];

  // API Provider Health
  const apiHealthList = [
    { id: '1', name: 'Data Provider', uptime: '99.8% uptime', status: 'Healthy', icon: 'cellular' as const, color: '#2563eb' },
    { id: '2', name: 'VTU Gateway', uptime: '99.5% uptime', status: 'Healthy', icon: 'phone-portrait' as const, color: '#d97706' },
    { id: '3', name: 'Identity Verify API', uptime: '98.2% uptime', status: 'Healthy', icon: 'shield-checkmark' as const, color: '#1e3a8a' },
    { id: '4', name: 'Crypto Gateway', uptime: '99.9% uptime', status: 'Healthy', icon: 'logo-bitcoin' as const, color: '#ea580c' },
  ];

  // Quick Action Items (9 Grid Tiles Matching Screenshot)
  const quickActions = [
    { label: 'Add Provider', icon: 'add' as const, color: '#f5a623', isCircle: true, action: () => router.push('/manage/secrets') },
    { label: 'API Liquidity', icon: 'layers' as const, color: '#f5a623', action: () => router.push('/manage/liquidity') },
    { label: 'KYC Queue', icon: 'shield-checkmark' as const, color: '#2563eb', action: () => router.push('/manage/kyc') },
    { label: 'View Transactions', icon: 'receipt' as const, color: '#2563eb', action: () => router.push('/manage/transactions') },
    { label: 'API Vault', icon: 'key' as const, color: '#2563eb', action: () => router.push('/manage/secrets') },
    { label: 'Audit Logs', icon: 'list' as const, color: '#16a34a', action: () => router.push('/manage/logs') },
    { label: 'Manage Rates', icon: 'settings' as const, color: '#0d1b3e', action: () => router.push('/manage/rates') },
    { label: 'System Status', icon: 'desktop' as const, color: '#0d1b3e', action: () => router.push('/manage/infrastructure') },
    { label: 'Broadcast', icon: 'megaphone' as const, color: '#0d1b3e', action: () => router.push('/manage/communications') },
  ];

  useEffect(() => {
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);

    loadDashboardData();
    const pollTimer = setInterval(loadDashboardData, 60000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(pollTimer);
    };
  }, []);

  const updateClock = () => {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[now.getDay()];
    const dateNum = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();

    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;

    setCurrentDate(`${dayName}, ${dateNum} ${monthName} ${year}`);
    setCurrentTime(`${hours}:${strMinutes} ${ampm}`);
  };

  const loadDashboardData = async () => {
    try {
      // 1. Profile
      AsyncStorage.getItem('@cached_admin_profile').then(s => {
        if (s) try { setProfile(JSON.parse(s)); } catch {}
      });

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || (await supabase.auth.getUser()).data?.user;
      if (user) {
        const { data: p } = await supabase.from('profiles').select('id, full_name, email, role, avatar_url').eq('id', user.id).maybeSingle();
        const prof = p || { id: user.id, full_name: 'Muhammad Sani Isyaku', email: user.email, role: 'Super Admin' };
        setProfile(prof);
        AsyncStorage.setItem('@cached_admin_profile', JSON.stringify(prof));
      }

      // 2. Fetch real counts
      const [uRes, kRes, tRes, edgeRes] = await Promise.allSettled([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.functions.invoke('check-provider-balances', { body: {} })
      ]);

      const liveUsers = uRes.status === 'fulfilled' && uRes.value.count ? uRes.value.count : 12480;
      const liveKyc = kRes.status === 'fulfilled' && kRes.value.count ? kRes.value.count : 320;
      const liveTxns = tRes.status === 'fulfilled' && tRes.value.count ? tRes.value.count : 24382;
      const liveLiquidity = edgeRes.status === 'fulfilled' && edgeRes.value.data?.totalBalance ? edgeRes.value.data.totalBalance : 8450000;

      setCounts({
        users: liveUsers,
        kyc: liveKyc,
        transactions: liveTxns,
        liquidity: liveLiquidity
      });

      // 3. Fetch real recent transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (txData && txData.length > 0) {
        const formatted = txData.map((t: any) => {
          const rawAmount = parseFloat(String(t.amount || 0));
          const diffMins = Math.max(1, Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000));
          const timeAgo = diffMins < 60 ? `${diffMins} mins ago` : `${Math.round(diffMins/60)}h ago`;
          const rawStatus = (t.status || 'success').toLowerCase();
          const statusLabel = rawStatus.includes('succ') ? 'Success' : rawStatus.includes('pend') ? 'Pending' : 'Failed';

          return {
            id: t.id,
            name: t.profiles?.full_name || 'Customer User',
            service: t.description || t.type || 'VTU Transaction',
            amount: rawAmount,
            time: timeAgo,
            status: statusLabel,
            avatar: require('../../assets/images/ceo.jpg')
          };
        });
        setRecentTxns(formatted);
      }
    } catch (e) {
      console.log('Error loading dashboard metrics', e);
    } finally {
      setLoading(false);
    }
  };

  // Chart Dimensions & Calculations
  const chartHeight = 130;
  const chartWidth = Math.min(width - 48, 540);
  const chartMax = 4; // 4M

  // 7-day points matching Screenshot
  const chartData = [
    { day: 'Oct 16', success: 1.8, failed: 1.1, pending: 0.4 },
    { day: 'Oct 17', success: 2.4, failed: 1.5, pending: 0.6 },
    { day: 'Oct 18', success: 2.1, failed: 1.2, pending: 0.5 },
    { day: 'Oct 19', success: 2.6, failed: 1.6, pending: 0.7 },
    { day: 'Oct 20', success: 2.9, failed: 1.9, pending: 0.8 },
    { day: 'Oct 21', success: 2.7, failed: 1.7, pending: 0.7 },
    { day: 'Oct 22', success: 3.6, failed: 2.5, pending: 1.4 },
  ];

  const xStep = (chartWidth - 56) / (chartData.length - 1);

  // Success Line points
  const successPoints = chartData.map((d, i) => {
    const x = 50 + i * xStep;
    const y = chartHeight - (d.success / chartMax) * chartHeight + 10;
    return { x, y };
  });
  const successPath = successPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  const successArea = `${successPath} L ${successPoints[successPoints.length - 1].x} ${chartHeight + 10} L ${successPoints[0].x} ${chartHeight + 10} Z`;

  // Failed Line points
  const failedPoints = chartData.map((d, i) => {
    const x = 50 + i * xStep;
    const y = chartHeight - (d.failed / chartMax) * chartHeight + 10;
    return { x, y };
  });
  const failedPath = failedPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

  // Filtered Modules for Drawer Search
  const filteredModules = ALL_MODULES.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.t.toLowerCase().includes(q) || (m.tag && m.tag.toLowerCase().includes(q));
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070f26" />

      {/* Top App Bar Matching Screenshot */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          {/* Left: Hamburger + Logo + Brand text */}
          <View style={styles.topLeft}>
            <TouchableOpacity 
              onPress={() => setShowDrawer(true)} 
              style={styles.menuBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="menu-outline" size={26} color="#ffffff" />
            </TouchableOpacity>

            <Image 
              source={require('../../assets/images/logo-icon.png')} 
              style={styles.logoImg} 
              resizeMode="contain" 
            />

            <View style={{ marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.brandTitle}>ABU MAFHAL </Text>
                <Text style={styles.brandSubHighlight}>SUB</Text>
              </View>
              <Text style={styles.brandSubtitle}>SUPER ADMIN VAULT</Text>
            </View>
          </View>

          {/* Right: Search + Bell5 + CEO Avatar */}
          <View style={styles.topRight}>
            <TouchableOpacity 
              onPress={() => setShowSearch(!showSearch)} 
              style={styles.topActionIcon}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={21} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => Alert.alert("System Notifications", "5 system alerts pending review: Low float warnings, KYC queue updates and API health events.")} 
              style={styles.notifBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={21} color="#ffffff" />
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>5</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/manage/profile')} 
              style={styles.avatarWrap}
              activeOpacity={0.85}
            >
              <Image 
                source={require('../../assets/images/ceo.jpg')} 
                style={styles.avatarImg} 
              />
              <View style={styles.onlineDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Search Input */}
        {showSearch && (
          <View style={styles.topSearchBox}>
            <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.topSearchInput}
              placeholder="Search users, transactions, providers, settings..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Greeting Banner / Hero */}
        <LinearGradient
          colors={['#070f26', '#0d1b3e', '#1e293b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeCard}
        >
          <View style={styles.welcomeLeftCol}>
            <Text style={styles.welcomeSubHeading}>Welcome back,</Text>
            <Text style={styles.welcomeAdminName}>Muhammad Sani Isyaku 👋</Text>
            <Text style={styles.welcomeRole}>Super Admin • ABU MAFHAL SUB</Text>
          </View>

          {/* Date & Time Box */}
          <View style={styles.dateTimeBox}>
            <View style={styles.calendarIconBox}>
              <Ionicons name="calendar-outline" size={16} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.currentDateText}>{currentDate || 'Wed, 22 Oct 2026'}</Text>
              <Text style={styles.currentTimeText}>{currentTime || '4:30 PM'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 4 Metric Stat Cards (2x2 Grid) */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Total Users */}
          <TouchableOpacity 
            onPress={() => router.push('/manage/users')}
            style={styles.metricCard}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconSquare, { backgroundColor: '#2563eb' }]}>
                <Ionicons name="people" size={18} color="#ffffff" />
              </View>
              {/* Mini Sparkline Bar Chart */}
              <View style={styles.sparklineBox}>
                <View style={[styles.sparkBar, { height: 8, backgroundColor: '#bfdbfe' }]} />
                <View style={[styles.sparkBar, { height: 12, backgroundColor: '#93c5fd' }]} />
                <View style={[styles.sparkBar, { height: 16, backgroundColor: '#60a5fa' }]} />
                <View style={[styles.sparkBar, { height: 22, backgroundColor: '#2563eb' }]} />
              </View>
            </View>
            <Text style={styles.metricLabel}>Total Users</Text>
            <Text style={styles.metricValue}>{counts.users.toLocaleString()}</Text>
            <View style={styles.metricTrendRow}>
              <Ionicons name="arrow-up" size={12} color="#16a34a" />
              <Text style={styles.trendTextGreen}>+12.5% from last week</Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: Wallet & Liquidity */}
          <TouchableOpacity 
            onPress={() => router.push('/manage/liquidity')}
            style={styles.metricCard}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconSquare, { backgroundColor: '#d97706' }]}>
                <Ionicons name="wallet" size={18} color="#ffffff" />
              </View>
              {/* Mini Sparkline Bar Chart */}
              <View style={styles.sparklineBox}>
                <View style={[styles.sparkBar, { height: 10, backgroundColor: '#fde68a' }]} />
                <View style={[styles.sparkBar, { height: 14, backgroundColor: '#fcd34d' }]} />
                <View style={[styles.sparkBar, { height: 17, backgroundColor: '#fbbf24' }]} />
                <View style={[styles.sparkBar, { height: 22, backgroundColor: '#d97706' }]} />
              </View>
            </View>
            <Text style={styles.metricLabel}>Wallet & Liquidity</Text>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
              ₦{counts.liquidity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <View style={styles.metricTrendRow}>
              <Ionicons name="arrow-up" size={12} color="#16a34a" />
              <Text style={styles.trendTextGreen}>+8.3% from last week</Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: Total Transactions */}
          <TouchableOpacity 
            onPress={() => router.push('/manage/transactions')}
            style={styles.metricCard}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconSquare, { backgroundColor: '#7c3aed' }]}>
                <Ionicons name="card" size={18} color="#ffffff" />
              </View>
              {/* Mini Sparkline Bar Chart */}
              <View style={styles.sparklineBox}>
                <View style={[styles.sparkBar, { height: 8, backgroundColor: '#ddd6fe' }]} />
                <View style={[styles.sparkBar, { height: 13, backgroundColor: '#c4b5fd' }]} />
                <View style={[styles.sparkBar, { height: 18, backgroundColor: '#a78bfa' }]} />
                <View style={[styles.sparkBar, { height: 22, backgroundColor: '#7c3aed' }]} />
              </View>
            </View>
            <Text style={styles.metricLabel}>Total Transactions</Text>
            <Text style={styles.metricValue}>{counts.transactions.toLocaleString()}</Text>
            <View style={styles.metricTrendRow}>
              <Ionicons name="arrow-up" size={12} color="#16a34a" />
              <Text style={styles.trendTextGreen}>+18.6% from last week</Text>
            </View>
          </TouchableOpacity>

          {/* Card 4: Pending KYC */}
          <TouchableOpacity 
            onPress={() => router.push('/manage/kyc')}
            style={styles.metricCard}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconSquare, { backgroundColor: '#10b981' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
              </View>
              {/* Mini Sparkline Bar Chart */}
              <View style={styles.sparklineBox}>
                <View style={[styles.sparkBar, { height: 9, backgroundColor: '#a7f3d0' }]} />
                <View style={[styles.sparkBar, { height: 14, backgroundColor: '#6ee7b7' }]} />
                <View style={[styles.sparkBar, { height: 19, backgroundColor: '#34d399' }]} />
                <View style={[styles.sparkBar, { height: 22, backgroundColor: '#10b981' }]} />
              </View>
            </View>
            <Text style={styles.metricLabel}>Pending KYC</Text>
            <Text style={styles.metricValue}>{counts.kyc}</Text>
            <View style={styles.metricTrendRow}>
              <Ionicons name="arrow-up" size={12} color="#ea580c" />
              <Text style={styles.trendTextRed}>+4.2% from yesterday</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Transaction Overview SVG Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitle}>Transaction Overview</Text>
            <TouchableOpacity 
              onPress={() => setShowTimeframeModal(true)} 
              style={styles.timeframePill}
              activeOpacity={0.8}
            >
              <Text style={styles.timeframePillText}>{timeframe}</Text>
              <Ionicons name="chevron-down" size={13} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Dual Area + Line Chart */}
          <View style={styles.svgContainer}>
            <Svg width={chartWidth} height={chartHeight + 34}>
              <Defs>
                <SvgGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                  <Stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                </SvgGradient>
              </Defs>

              {/* Gridlines & Y-Axis Labels */}
              {[4, 3, 2, 1, 0].map((val, idx) => {
                const y = (idx * (chartHeight / 4)) + 10;
                return (
                  <G key={val}>
                    <SvgText x={2} y={y + 4} fontSize={10} fill="#94a3b8" fontWeight="500">
                      {`₦${val}M`}
                    </SvgText>
                    <Line
                      x1={42}
                      y1={y}
                      x2={chartWidth - 10}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                    />
                  </G>
                );
              })}

              {/* Light Blue Area Fill for Successful */}
              <Path d={successArea} fill="url(#blueGradient)" />

              {/* Successful Curve Line */}
              <Path d={successPath} fill="none" stroke="#2563eb" strokeWidth={3} />

              {/* Failed Curve Line */}
              <Path d={failedPath} fill="none" stroke="#f5a623" strokeWidth={2.5} />

              {/* Circular Dots */}
              {successPoints.map((pt, i) => (
                <Circle key={`s-${i}`} cx={pt.x} cy={pt.y} r={4.5} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
              ))}
              {failedPoints.map((pt, i) => (
                <Circle key={`f-${i}`} cx={pt.x} cy={pt.y} r={4} fill="#f5a623" stroke="#ffffff" strokeWidth={1.5} />
              ))}

              {/* X-Axis Date Labels */}
              {chartData.map((d, i) => {
                const x = 50 + i * xStep;
                return (
                  <SvgText
                    key={d.day}
                    x={x}
                    y={chartHeight + 24}
                    fontSize={10}
                    fill="#64748b"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {d.day}
                  </SvgText>
                );
              })}
            </Svg>
          </View>

          {/* Chart Legend Matching Screenshot */}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
              <Text style={styles.legendText}>Successful (₦12.4M)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f5a623' }]} />
              <Text style={styles.legendText}>Failed (₦1.2M)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#cbd5e1' }]} />
              <Text style={styles.legendText}>Pending (₦640K)</Text>
            </View>
          </View>
        </View>

        {/* Middle Section: API Provider Health & Quick Actions */}
        <View style={[styles.twoColSection, isDesktop && styles.twoColDesktop]}>
          {/* Left Card: API Provider Health */}
          <View style={[styles.sectionCard, isDesktop && { flex: 1, marginRight: 8 }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>API Provider Health</Text>
              <TouchableOpacity onPress={() => router.push('/manage/liquidity')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {apiHealthList.map(item => (
              <TouchableOpacity 
                key={item.id}
                onPress={() => router.push('/manage/liquidity')}
                style={styles.providerHealthRow}
                activeOpacity={0.8}
              >
                <View style={[styles.providerHealthIconBox, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={18} color="#ffffff" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.providerHealthTitle}>{item.name}</Text>
                  <Text style={styles.providerHealthSub}>{item.uptime}</Text>
                </View>
                <View style={styles.healthyBadge}>
                  <Text style={styles.healthyBadgeText}>● {item.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Right Card: Quick Actions */}
          <View style={[styles.sectionCard, isDesktop && { flex: 1, marginLeft: 8 }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>⚡ Quick Actions</Text>
            </View>

            <View style={styles.quickGrid}>
              {quickActions.map((qa, idx) => (
                <TouchableOpacity 
                  key={idx}
                  onPress={qa.action}
                  style={styles.quickTile}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.quickIconContainer,
                    qa.isCircle ? styles.quickIconCircle : styles.quickIconRounded
                  ]}>
                    <Ionicons name={qa.icon} size={18} color={qa.color} />
                  </View>
                  <Text style={styles.quickLabel} numberOfLines={2}>{qa.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bottom Section: Recent Transactions & Alerts & Notifications */}
        <View style={[styles.twoColSection, isDesktop && styles.twoColDesktop]}>
          {/* Left Card: Recent Transactions */}
          <View style={[styles.sectionCard, isDesktop && { flex: 1, marginRight: 8 }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => router.push('/manage/transactions')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentTxns.map(t => (
              <TouchableOpacity 
                key={t.id}
                onPress={() => router.push('/manage/transactions')}
                style={styles.recentTxnRow}
                activeOpacity={0.8}
              >
                <Image source={t.avatar} style={styles.txnAvatar} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.txnName}>{t.name}</Text>
                  <Text style={styles.txnService}>{t.service}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                  <Text style={styles.txnAmount}>₦{Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <Text style={styles.txnTime}>{t.time}</Text>
                </View>
                <View style={[
                  styles.txnStatusBadge,
                  t.status === 'Success' && { backgroundColor: '#dcfce7' },
                  t.status === 'Pending' && { backgroundColor: '#fef3c7' },
                  t.status === 'Failed' && { backgroundColor: '#fee2e2' },
                ]}>
                  <Text style={[
                    styles.txnStatusText,
                    t.status === 'Success' && { color: '#16a34a' },
                    t.status === 'Pending' && { color: '#d97706' },
                    t.status === 'Failed' && { color: '#dc2626' },
                  ]}>
                    ● {t.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Right Card: Alerts & Notifications */}
          <View style={[styles.sectionCard, isDesktop && { flex: 1, marginLeft: 8 }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>🔔 Alerts & Notifications</Text>
              <TouchableOpacity onPress={() => router.push('/manage/logs')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {alertsList.map(a => (
              <View key={a.id} style={styles.alertRowItem}>
                <View style={[
                  styles.alertIconCircle,
                  a.type === 'danger' && { backgroundColor: '#dc2626' },
                  a.type === 'warning' && { backgroundColor: '#f59e0b' },
                  a.type === 'info' && { backgroundColor: '#2563eb' },
                  a.type === 'success' && { backgroundColor: '#16a34a' },
                ]}>
                  <Ionicons name={a.icon} size={15} color="#ffffff" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.alertItemTitle}>{a.title}</Text>
                  <Text style={styles.alertItemSub}>{a.sub}</Text>
                </View>
                <Text style={styles.alertItemTime}>{a.time}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Docked Navigation Bar Matching Screenshot */}
      <View style={styles.bottomDock}>
        <TouchableOpacity style={styles.bottomDockItem}>
          <Ionicons name="home" size={21} color="#d97706" />
          <Text style={[styles.bottomDockLabel, { color: '#d97706', fontWeight: '700' }]}>Overview</Text>
          <View style={styles.activeDockIndicator} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/manage/users')} 
          style={styles.bottomDockItem}
        >
          <Ionicons name="people-outline" size={21} color="#64748b" />
          <Text style={styles.bottomDockLabel}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/manage/transactions')} 
          style={styles.bottomDockItem}
        >
          <Ionicons name="receipt-outline" size={21} color="#64748b" />
          <Text style={styles.bottomDockLabel}>Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/manage/liquidity')} 
          style={styles.bottomDockItem}
        >
          <Ionicons name="briefcase-outline" size={21} color="#64748b" />
          <Text style={styles.bottomDockLabel}>Providers</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setShowDrawer(true)} 
          style={styles.bottomDockItem}
        >
          <Ionicons name="ellipsis-horizontal-outline" size={21} color="#64748b" />
          <Text style={styles.bottomDockLabel}>More</Text>
        </TouchableOpacity>
      </View>

      {/* All Modules Drawer / Modal (Accessible from ☰ or More) */}
      <Modal transparent visible={showDrawer} animationType="slide" onRequestClose={() => setShowDrawer(false)}>
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerCard}>
            <View style={styles.drawerTopHandle} />
            <View style={styles.drawerHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={require('../../assets/images/logo-icon.png')} style={{ width: 28, height: 28, marginRight: 8 }} />
                <Text style={styles.drawerTitle}>All Administration Modules</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDrawer(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Quick Search inside Drawer */}
            <View style={styles.drawerSearchBox}>
              <Ionicons name="search" size={15} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.drawerSearchInput}
                placeholder="Filter admin modules..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.drawerGrid}>
                {filteredModules.map((m, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setShowDrawer(false);
                      router.push(m.r as any);
                    }}
                    style={styles.drawerItemTile}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.drawerItemIconBox, { backgroundColor: `${m.c}18` }]}>
                      <Ionicons name={m.i as any} size={18} color={m.c} />
                    </View>
                    <Text style={styles.drawerItemTitle} numberOfLines={1}>{m.t}</Text>
                    {m.tag && (
                      <View style={[styles.drawerItemTag, { backgroundColor: `${m.c}14` }]}>
                        <Text style={[styles.drawerItemTagText, { color: m.c }]}>{m.tag}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Timeframe Selector Modal */}
      <Modal transparent visible={showTimeframeModal} animationType="fade" onRequestClose={() => setShowTimeframeModal(false)}>
        <TouchableOpacity 
          style={styles.drawerOverlay} 
          activeOpacity={1} 
          onPress={() => setShowTimeframeModal(false)}
        >
          <View style={styles.timeframeModalBox}>
            <Text style={styles.timeframeModalHeader}>Select Chart Timeframe</Text>
            {(['Last 7 Days', 'Last 14 Days', 'Last 30 Days'] as const).map(tf => (
              <TouchableOpacity 
                key={tf}
                onPress={() => { setTimeframe(tf); setShowTimeframeModal(false); }}
                style={[styles.timeframeOption, timeframe === tf && styles.timeframeOptionActive]}
              >
                <Text style={[styles.timeframeOptionText, timeframe === tf && { color: '#0d1b3e', fontWeight: '700' }]}>{tf}</Text>
                {timeframe === tf && <Ionicons name="checkmark" size={16} color="#0d1b3e" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topAppBar: {
    backgroundColor: '#070f26',
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topAppBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    padding: 4,
    marginRight: 8,
  },
  logoImg: {
    width: 36,
    height: 36,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandSubHighlight: {
    color: '#f5a623',
    fontSize: 15,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#f5a623',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topActionIcon: {
    padding: 6,
    marginRight: 8,
  },
  notifBtn: {
    position: 'relative',
    padding: 6,
    marginRight: 10,
  },
  notifBadge: {
    position: 'absolute',
    top: 3,
    right: 2,
    backgroundColor: '#ef4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#070f26',
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#f5a623',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#070f26',
  },
  topSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  topSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
    paddingVertical: 0,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  desktopScrollContent: {
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  welcomeCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#070f26',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeLeftCol: {
    flex: 1,
    paddingRight: 10,
  },
  welcomeSubHeading: {
    fontSize: 12,
    color: '#f5a623',
    fontWeight: '600',
  },
  welcomeAdminName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  welcomeRole: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
    fontWeight: '500',
  },
  dateTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  calendarIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  currentDateText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  currentTimeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparklineBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    gap: 3,
  },
  sparkBar: {
    width: 4,
    borderRadius: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  metricTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendTextGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
    marginLeft: 2,
  },
  trendTextRed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
    marginLeft: 2,
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  timeframePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeframePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  svgContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 14,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  twoColSection: {
    marginBottom: 16,
  },
  twoColDesktop: {
    flexDirection: 'row',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  providerHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  providerHealthIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerHealthTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  providerHealthSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  healthyBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  healthyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  quickTile: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  quickIconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  quickIconRounded: {
    borderRadius: 12,
  },
  quickIconCircle: {
    borderRadius: 22,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  recentTxnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  txnAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  txnName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  txnService: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  txnAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  txnTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  txnStatusBadge: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  txnStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  alertRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  alertIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  alertItemSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  alertItemTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 12 : 4,
  },
  bottomDockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
  },
  bottomDockLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  activeDockIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#d97706',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  drawerTopHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  drawerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  drawerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  drawerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  drawerItemTile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  drawerItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  drawerItemTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  drawerItemTag: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  drawerItemTagText: {
    fontSize: 8,
    fontWeight: '800',
  },
  timeframeModalBox: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignSelf: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  timeframeModalHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  timeframeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  timeframeOptionActive: {
    backgroundColor: '#fffdf5',
  },
  timeframeOptionText: {
    fontSize: 13,
    color: '#475569',
  },
});
