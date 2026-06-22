import { View, Text, TouchableOpacity, ScrollView, Platform, Image, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

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
};

export default function Dashboard() {
  const [showBalance, setShowBalance] = useState(true);
  const [userData, setUserData] = useState<{ full_name: string; balance: number; role?: string; avatar_url?: string; kyc_tier?: number; bvn?: string | null } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<boolean>(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, any>>({});
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchFeatureFlags();
      fetchLogo();
    }, [])
  );

  const fetchLogo = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_logo')
        .single();
      if (data?.value?.url) {
        setLogoUrl(data.value.url);
      }
    } catch (e) {
      console.error('Error fetching dynamic logo:', e);
    }
  };

  const fetchFeatureFlags = async () => {
    const { data, error } = await supabase.from('feature_flags').select('feature_key, is_enabled, maintenance_message');
    if (error) console.error('Error fetching flags:', error);
    if (data) {
      const flags = data.reduce((acc: any, curr: any) => {
        acc[curr.feature_key] = curr;
        return acc;
      }, {});
      setFeatureFlags(flags);
    }
  };

  const handleActionPress = (action: any) => {
    const featureMap: Record<string, string> = {
      '/fund-wallet': 'wallet_deposit_card',
      '/transfer': 'feature_transfer',
      '/airtime': 'feature_airtime',
      '/data': 'feature_data',
      '/education': 'feature_education',
      '/bills': 'feature_bills',
      '/virtual-cards': 'feature_cards',
      '/savings': 'feature_savings',
      '/loans': 'feature_loans',
      '/crypto': 'feature_crypto',
      '/analytics': 'feature_analytics',
      '/rewards': 'feature_rewards',
      '/qr-pay': 'feature_qr',
      '/investments': 'feature_invest',
      '/insurance': 'feature_insurance',
      '/bvn-services': 'feature_bvn',
      '/nin-services': 'feature_nin'
    };

    const featureKey = featureMap[action.route];
    if (featureKey) {
      const flag = featureFlags[featureKey];
      if (flag && !flag.is_enabled) {
        alert(flag.maintenance_message || 'This feature is currently under maintenance.');
        return;
      }
    }

    if (action.route) router.push(action.route as any);
  };

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, balance, role, avatar_url, kyc_tier, bvn')
          .eq('id', user.id)
          .single();

        if (data) {
          setUserData(data);
          setDbError(false);
          
          // Auto-generate virtual account if user is eligible and doesn't have one
          const checkAndCreateVA = async () => {
            try {
              const { data: va } = await supabase
                .from('virtual_accounts')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

              if (!va && ((data.kyc_tier && data.kyc_tier >= 2) || data.bvn)) {
                console.log("Eligible user is missing virtual account. Automatically triggering generation...");
                const { data: res, error: invokeErr } = await supabase.functions.invoke('create-virtual-account', {
                    body: { userId: user.id }
                });
                if (invokeErr) {
                  console.error("Auto-generate DVA function error:", invokeErr);
                } else if (res && res.error) {
                  console.warn("Auto-generate DVA soft error:", res.error);
                } else {
                  console.log("Auto-generate DVA success:", res);
                }
              }
            } catch (e) {
              console.error("Auto-generate DVA exception:", e);
            }
          };
          checkAndCreateVA();
        } else if (error) {
          console.error('Dashboard profile fetch error:', error);
          if (error.message?.includes('recursion') || error.code === '42P17') {
            setDbError(true);
          } else if (error.code === 'PGRST116') {
            setDbError(false);
            // Profile missing: try to auto-insert a profile
            try {
              const fallbackName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: user.id,
                  email: user.email || '',
                  full_name: fallbackName,
                  role: 'user',
                  kyc_tier: 1,
                  balance: 0.00
                })
                .select('full_name, balance, role, avatar_url, kyc_tier, bvn')
                .single();

              if (newProfile) {
                setUserData(newProfile);
              } else {
                console.error('Failed to auto-create profile:', insertError);
              }
            } catch (insertErr) {
              console.error('Failed to auto-create profile exception:', insertErr);
            }
          } else {
            setDbError(false);
          }
        }

        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (txData) setTransactions(txData);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Format Balance Helper ──────────────────────────────────────────────────
  const formatBalance = (bal: number) => {
    const formatted = (bal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const parts = formatted.split('.');
    return {
      main: parts[0],
      dec: parts[1] ? `.${parts[1]}` : '.00'
    };
  };

  const balanceParts = formatBalance(userData?.balance || 0);

  // ─── Format Transaction Date Helper ─────────────────────────────────────────
  const formatTxDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      
      const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
      
      // Check if today
      if (date.toDateString() === now.toDateString()) {
        return `Today, ${timeStr}`;
      }
      
      // Check if yesterday
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${timeStr}`;
      }
      
      // Otherwise full date
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + `, ${timeStr}`;
    } catch (e) {
      return '';
    }
  };

  // ─── Quick Actions Data Mapping ─────────────────────────────────────────────
  const allActions = [
    { icon: 'phone-portrait-outline', label: 'Airtime', color: '#f97316', route: '/airtime' },
    { icon: 'wifi-outline', label: 'Data', color: '#22c55e', route: '/data' },
    { icon: 'chevron-forward', label: 'Transfer', color: '#2563eb', route: '/transfer' },
    { icon: 'receipt-outline', label: 'Bills', color: '#eab308', route: '/bills' },
    { icon: 'person-add-outline', label: 'NIN Services', color: '#10b981', route: '/nin-services' },
    { icon: 'tv-outline', label: 'Cable TV', color: '#8b5cf6', route: '/bills' },
    { icon: 'flash-outline', label: 'Electricity', color: '#f5a623', route: '/bills' },
    { icon: 'globe-outline', label: 'Internet', color: '#ec4899', route: '/bills' },
    { icon: 'school-outline', label: 'Education', color: '#06b6d4', route: '/education' },
    // Remaining actions shown when expanded
    { icon: 'card-outline', label: 'Cards', color: '#8B5CF6', route: '/virtual-cards' },
    { icon: 'wallet-outline', label: 'Savings', color: '#107C10', route: '/savings' },
    { icon: 'cash-outline', label: 'Loans', color: '#EA580C', route: '/loans' },
    { icon: 'logo-bitcoin', label: 'Crypto', color: '#F7931A', route: '/crypto' },
    { icon: 'pie-chart-outline', label: 'Insights', color: '#DB2777', route: '/analytics' },
    { icon: 'gift-outline', label: 'Rewards', color: '#9333EA', route: '/rewards' },
    { icon: 'qr-code-outline', label: 'QR Pay', color: '#10B981', route: '/qr-pay' },
    { icon: 'trending-up-outline', label: 'Invest', color: '#3B82F6', route: '/investments' },
    { icon: 'shield-checkmark-outline', label: 'Insurance', color: '#107C10', route: '/insurance' },
    { icon: 'finger-print-outline', label: 'BVN Svcs', color: '#0056D2', route: '/bvn-services' },
  ];

  // Logic: Show first 9 actions + "More" button by default
  const displayedActions = showAllActions 
    ? [...allActions, { icon: 'chevron-up-outline', label: 'Less', color: '#64748b', route: 'less' }]
    : [...allActions.slice(0, 9), { icon: 'grid-outline', label: 'More', color: '#64748b', route: 'more' }];

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      <ScrollView 
        style={s.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Navy Curved Header ─── */}
        <LinearGradient 
          colors={['#060d21', '#0d1b3e']} 
          style={[s.headerContainer, { paddingTop: insets.top + 16 }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          {/* Top brand row */}
          <View style={s.headerTop}>
            <View style={s.brandRow}>
              <Image
                source={logoUrl ? { uri: logoUrl } : require('../../assets/images/logo.png')}
                style={s.headerLogo as any}
                resizeMode="contain"
              />
              <View>
                <Text style={s.brandTxt}>MAFHAL</Text>
                <Text style={s.brandSub}>SUB</Text>
              </View>
            </View>
            
            <TouchableOpacity onPress={() => router.push('/notifications')} style={s.bellBtn} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={22} color={T.white} />
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Welcome profile row */}
          <View style={s.welcomeRow}>
            <View style={s.avatarCol}>
              <Image 
                source={{ uri: userData?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=150&h=150' }} 
                style={s.avatarImage} 
              />
            </View>
            
            <View style={s.welcomeTextCol}>
              <Text style={s.welcomeSub}>Welcome back,</Text>
              <Text style={s.welcomeName} numberOfLines={1}>
                {userData?.full_name || 'Muhammad Sani Isyaku'}
              </Text>
              {(() => {
                const isVerified = userData?.kyc_tier && userData.kyc_tier > 1;
                return (
                  <View style={[
                    s.verifiedPill, 
                    { backgroundColor: isVerified ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 166, 35, 0.12)' }
                  ]}>
                    <View style={[s.verifiedDot, { backgroundColor: isVerified ? '#22c55e' : '#f5a623' }]} />
                    <Text style={[s.verifiedTxt, { color: isVerified ? '#4ade80' : '#fbbf24' }]}>
                      {isVerified ? 'Verified Account' : 'Unverified Account'}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {['admin', 'super_admin'].includes(userData?.role || '') && (
              <TouchableOpacity 
                onPress={() => router.push('/manage')}
                style={s.adminConsoleBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#f5a623', '#d4890e']}
                  style={s.adminConsoleBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="shield-checkmark" size={12} color="#0d1b3e" style={{ marginRight: 4 }} />
                  <Text style={s.adminConsoleBtnTxt}>Admin Console</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* ─── Floating Balance Card ─── */}
        <View style={s.balanceCardContainer}>
          <LinearGradient 
            colors={['#102258', '#0b163a']} 
            style={s.balanceCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Background Logo Watermark */}
            <View style={s.watermarkWrapper}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={s.watermarkImage} 
                resizeMode="contain" 
              />
            </View>

            <View style={s.cardLeft}>
              <View style={s.balanceHeader}>
                <Text style={s.balanceLabel}>Wallet Balance</Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} activeOpacity={0.7} style={{ marginLeft: 6 }}>
                  <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
              
              <View style={s.amountRow}>
                <Text style={s.amountSymbol}>₦</Text>
                {showBalance ? (
                  <>
                    <Text style={s.amountMain}>{balanceParts.main}</Text>
                    <Text style={s.amountDec}>{balanceParts.dec}</Text>
                  </>
                ) : (
                  <Text style={s.amountMain}>••••</Text>
                )}
              </View>
              <Text style={s.availLabel}>Available Balance</Text>
            </View>

            <View style={s.cardRight}>
              <TouchableOpacity 
                onPress={() => handleActionPress({ route: '/fund-wallet', label: 'Top Up' })}
                style={s.fundBtn}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color={T.navy} />
                <Text style={s.fundBtnTxt}>Fund Wallet</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => router.push('/history')}
                style={s.historyBtn}
                activeOpacity={0.85}
              >
                <Ionicons name="time-outline" size={13} color={T.white} style={{ marginRight: 4 }} />
                <Text style={s.historyBtnTxt}>Transaction History</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Database Warning */}
        {dbError && (
          <View style={s.dbErrorBox}>
            <View style={s.dbErrorHeader}>
              <Ionicons name="warning" size={18} color="#EF4444" />
              <Text style={s.dbErrorTitle}>Database Access Limited</Text>
            </View>
            <Text style={s.dbErrorText}>
              Infinite recursion detected in database policies. Please apply the SQL fix to Supabase database.
            </Text>
          </View>
        )}

        {/* ─── Quick Actions 5-Column Grid ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity activeOpacity={0.7} style={s.editBtn}>
              <Text style={s.editBtnTxt}>Edit</Text>
              <Ionicons name="pencil-sharp" size={11} color={T.indigo} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>

          <View style={s.actionsGrid}>
            {displayedActions.map((act, index) => {
              const isToggle = act.route === 'more' || act.route === 'less';
              return (
                <TouchableOpacity
                  key={index}
                  style={s.actionItem}
                  onPress={() => {
                    if (act.route === 'more') {
                      setShowAllActions(true);
                    } else if (act.route === 'less') {
                      setShowAllActions(false);
                    } else {
                      handleActionPress(act);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <View style={s.actionIconBox}>
                    <Ionicons name={act.icon as any} size={20} color={act.color} />
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
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.promoLeft}>
              <Text style={s.promoTitle}>Refer & Earn</Text>
              <Text style={s.promoDesc}>Invite friends and earn exciting rewards</Text>
              <TouchableOpacity 
                onPress={() => router.push('/referrals')}
                style={s.promoBtn}
                activeOpacity={0.8}
              >
                <Text style={s.promoBtnTxt}>Refer Now</Text>
                <Ionicons name="arrow-forward" size={12} color={T.white} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            <View style={s.promoRight}>
              <Image 
                source={require('../../assets/images/referral_gift.png')}
                style={s.promoGiftImage}
                resizeMode="contain" 
              />
            </View>
          </LinearGradient>
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
                  <Ionicons name="receipt-outline" size={20} color={T.textSub} style={{ marginBottom: 6 }} />
                  <Text style={s.txEmptyText}>No recent transactions</Text>
                </View>
              );
            }

            return transactions.slice(0, 3).map((tx, i) => {
              const isDeposit = tx.type === 'deposit' || tx.type === 'referral_withdrawal';
              let iconName: any = 'arrow-up';
              let iconBg = '#107c10'; // Brand green

              if (tx.type === 'payment' || tx.type === 'bill') {
                iconName = 'receipt';
                iconBg = '#0056d2'; // Brand blue
              } else if (tx.type === 'transfer') {
                iconName = 'arrow-up';
                iconBg = '#ef4444'; // Outgoing red
              } else if (isDeposit) {
                iconName = 'arrow-down';
                iconBg = '#107c10'; // Brand green
              }

              // Resolve metadata string safely
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
                    <View style={[s.txIconBox, { backgroundColor: iconBg }]}>
                      <Ionicons name={iconName} size={16} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txTitle} numberOfLines={1}>{tx.description || 'Transaction'}</Text>
                      <Text style={s.txSub} numberOfLines={1}>{metaText}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.txAmount, { color: isDeposit ? '#107c10' : T.navy }]}>
                      {isDeposit ? '+' : '-'} ₦{parseFloat(tx.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.billsScroll}
          >
            {[
              { label: 'PHCN', gradient: ['#fef08a', '#fef9c3'], icon: 'flash', color: '#eab308' },
              { label: 'DStv', gradient: ['#dbeafe', '#eff6ff'], icon: 'tv', color: '#2563eb' },
              { label: 'GOtv', gradient: ['#bbf7d0', '#f0fdf4'], icon: 'play-circle', color: '#16a34a' },
              { label: 'StarTimes', gradient: ['#fed7aa', '#fff7ed'], icon: 'star', color: '#ea580c' },
              { label: 'Spectranet', gradient: ['#f5d0fe', '#fdf4ff'], icon: 'globe', color: '#d946ef' },
              { label: 'More', gradient: ['#e2e8f0', '#f1f5f9'], icon: 'ellipsis-horizontal', color: '#64748b' }
            ].map((op, i) => (
              <TouchableOpacity 
                key={i} 
                onPress={() => router.push('/bills')} 
                style={s.billOpCard}
                activeOpacity={0.8}
              >
                <LinearGradient colors={op.gradient as any} style={s.billOpGlow}>
                  <Ionicons name={op.icon as any} size={22} color={op.color} />
                </LinearGradient>
                <Text style={s.billOpLabel}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Secure Banner ─── */}
        <TouchableOpacity style={s.secureBanner} activeOpacity={0.9}>
          <View style={s.secureLeft}>
            <View style={s.secureShield}>
              <Ionicons name="shield-checkmark" size={20} color={T.goldDk} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={s.secureTitle}>Secure. Fast. Reliable.</Text>
              <Text style={s.secureDesc} numberOfLines={1}>
                Your transactions are protected with top-tier security.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={T.navy} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  scrollView: {
    flex: 1,
  },
  
  // curved header
  headerContainer: {
    backgroundColor: T.navy,
    paddingHorizontal: 24,
    paddingBottom: 48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  brandTxt: {
    fontSize: 12,
    fontWeight: '900',
    color: T.white,
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  brandSub: {
    fontSize: 7.5,
    fontWeight: '700',
    color: T.gold,
    letterSpacing: 1.2,
    lineHeight: 9,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: T.navy,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCol: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: T.gold,
    overflow: 'hidden',
    backgroundColor: T.navyMid,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  welcomeTextCol: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  welcomeSub: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  welcomeName: {
    fontSize: 14,
    fontWeight: '800',
    color: T.white,
    marginTop: 1,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  verifiedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  verifiedTxt: {
    fontSize: 8,
    fontWeight: '700',
    color: T.white,
  },
  consoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  consoleBtnTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: T.white,
  },

  // balance card
  balanceCardContainer: {
    paddingHorizontal: 24,
    marginTop: -30,
    marginBottom: 20,
    shadowColor: T.navy,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  watermarkWrapper: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 140,
    height: 140,
    opacity: 0.06,
  },
  watermarkImage: {
    width: '100%',
    height: '100%',
  },
  cardLeft: {
    flex: 1.2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amountSymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: T.white,
    marginRight: 2,
  },
  amountMain: {
    fontSize: 26,
    fontWeight: '900',
    color: T.white,
    letterSpacing: -0.5,
  },
  amountDec: {
    fontSize: 16,
    fontWeight: '800',
    color: T.white,
  },
  availLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    fontWeight: '500',
  },
  cardRight: {
    flex: 1,
    alignItems: 'stretch',
    gap: 8,
  },
  fundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.gold,
    borderRadius: 12,
    paddingVertical: 10,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  fundBtnTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: T.navy,
    marginLeft: 3,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 9,
  },
  historyBtnTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: T.white,
  },

  // DB error
  dbErrorBox: {
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
    marginHorizontal: 24,
    marginBottom: 20,
  },
  dbErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dbErrorTitle: {
    color: '#991b1b',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
  },
  dbErrorText: {
    color: '#b91c1c',
    fontSize: 9.5,
    lineHeight: 14,
  },

  // sections
  section: {
    backgroundColor: T.white,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 20,
    shadowColor: T.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: T.navy,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editBtnTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: T.indigo,
  },
  seeAllTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: T.indigo,
  },

  // actions grid (5-column layout)
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionItem: {
    width: (W - 48 - 32 - 40) / 5,
    alignItems: 'center',
    marginBottom: 6,
  },
  actionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 8.5,
    fontWeight: '600',
    color: T.textSub,
    textAlign: 'center',
  },

  // Promo Banner
  promoContainer: {
    marginHorizontal: 24,
    marginBottom: 20,
    shadowColor: T.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  promoCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  promoLeft: {
    flex: 1.4,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: T.white,
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 14,
    lineHeight: 14,
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  promoBtnTxt: {
    fontSize: 9.5,
    fontWeight: '700',
    color: T.white,
  },
  promoRight: {
    width: 90,
    height: 80,
    position: 'relative',
  },
  promoGiftImage: {
    width: 100,
    height: 100,
    position: 'absolute',
    right: -10,
    bottom: -10,
  },

  // transactions
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: T.text,
  },
  txSub: {
    fontSize: 9,
    color: T.textSub,
    marginTop: 1.5,
  },
  txAmount: {
    fontSize: 11.5,
    fontWeight: '900',
    textAlign: 'right',
  },
  txStatus: {
    fontSize: 8,
    fontWeight: '700',
    color: T.textSub,
    textAlign: 'right',
    marginTop: 1.5,
    textTransform: 'uppercase',
  },
  txDateText: {
    fontSize: 8.5,
    color: T.textSub,
    textAlign: 'right',
    marginTop: 2.5,
  },
  txEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  txEmptyText: {
    fontSize: 11,
    color: T.textSub,
    fontStyle: 'italic',
    marginTop: 8,
  },

  // pay bills horizontal scroll
  billsScroll: {
    paddingRight: 10,
  },
  billOpCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 54,
  },
  billOpGlow: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  billOpLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: T.textSub,
    textAlign: 'center',
  },

  // secure banner
  secureBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef7ea',
    borderWidth: 1,
    borderColor: '#fdf0d5',
    borderRadius: 20,
    padding: 14,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  secureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  secureShield: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: T.navy,
  },
  secureDesc: {
    fontSize: 9.5,
    color: T.textSub,
    marginTop: 1.5,
  },
  adminConsoleBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  adminConsoleBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminConsoleBtnTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0d1b3e',
  },
});
