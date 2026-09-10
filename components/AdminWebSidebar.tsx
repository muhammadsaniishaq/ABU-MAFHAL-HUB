import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, forceSignOut } from '../services/supabase';
import { useAppSettings } from '../hooks/useAppSettings';

interface AdminWebSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  tag?: string;
  isSuperOnly?: boolean;
  color?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function AdminWebSidebar({
  collapsed = false,
  onToggleCollapse,
}: AdminWebSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useAppSettings();

  const [adminProfile, setAdminProfile] = useState<{
    full_name?: string;
    email?: string;
    role?: string;
    avatar_url?: string;
  } | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [counts, setCounts] = useState({ users: 0, kyc: 0, tickets: 0 });

  useEffect(() => {
    let isMounted = true;

    const loadAdminInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data } = await supabase
          .from('profiles')
          .select('full_name, email, role, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();

        if (isMounted && data) {
          setAdminProfile(data);
        }

        const [kc, tc] = await Promise.all([
          supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        ]);

        if (isMounted) {
          setCounts({
            users: 0,
            kyc: kc.count || 0,
            tickets: tc.count || 0,
          });
        }
      } catch (e) {
        console.log('Admin sidebar load error:', e);
      }
    };

    loadAdminInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  const isSuper =
    adminProfile?.role === 'super_admin' ||
    adminProfile?.email === 'sale.abumafhal@gmail.com' ||
    adminProfile?.email === 'abumafhal@gmail.com';

  const NAV_GROUPS: NavGroup[] = [
    {
      title: 'DASHBOARD',
      items: [
        { label: 'Control Overview', route: '/manage', icon: 'speedometer' },
        { label: 'Master Console', route: '/manage/super-admin', icon: 'ribbon', isSuperOnly: true, tag: 'Super' },
      ],
    },
    {
      title: 'CORE OPERATIONS',
      items: [
        { label: 'User Control', route: '/manage/users', icon: 'people' },
        { label: 'KYC Verifications', route: '/manage/kyc', icon: 'id-card', badge: counts.kyc },
        { label: 'BVN Tasks', route: '/manage/bvn-tasks', icon: 'finger-print' },
        { label: 'NIN Tasks', route: '/manage/nin-tasks', icon: 'card' },
        { label: 'CAC Registration', route: '/manage/cac', icon: 'briefcase' },
        { label: 'Help Desk Tickets', route: '/manage/tickets', icon: 'chatbubbles', badge: counts.tickets },
        { label: 'Content CMS', route: '/manage/cms', icon: 'images' },
        { label: 'Bulk SMS Center', route: '/manage/bulk-sms', icon: 'chatbox-ellipses' },
        { label: 'User Reviews', route: '/manage/reviews', icon: 'star' },
      ],
    },
    {
      title: 'PRICING & ASSETS',
      items: [
        { label: 'Data Plans & APIs', route: '/manage/data-plans', icon: 'wifi', tag: 'Live' },
        { label: 'Airtime Portal', route: '/manage/airtime', icon: 'call' },
        { label: 'NIN Service Rates', route: '/manage/nin-pricing', icon: 'pricetag' },
        { label: 'BVN Service Rates', route: '/manage/bvn-pricing', icon: 'pricetags' },
        { label: 'Utility Bills Pricing', route: '/manage/bills-pricing', icon: 'flash' },
        { label: 'SMM Pricing', route: '/manage/smm-pricing', icon: 'thumbs-up' },
        { label: 'API Liquidity', route: '/manage/liquidity', icon: 'wallet', tag: 'Funds' },
        { label: 'Market Maker Rates', route: '/manage/rates', icon: 'stats-chart' },
      ],
    },
    {
      title: 'FINANCE & INTELLIGENCE',
      items: [
        { label: 'Ledger & Accounting', route: '/manage/accounting', icon: 'calculator', isSuperOnly: true, tag: 'Super' },
        { label: 'Risk Control', route: '/manage/risk', icon: 'alert-circle' },
        { label: 'System Transactions', route: '/manage/transactions', icon: 'receipt' },
        { label: 'Analytics Reports', route: '/manage/reports', icon: 'bar-chart' },
        { label: 'Broadcasting & Mail', route: '/manage/communications', icon: 'megaphone' },
        { label: 'Cortex AI Engine', route: '/manage/ai', icon: 'sparkles', tag: 'AI' },
        { label: 'Crypto Liquidity', route: '/manage/crypto', icon: 'logo-bitcoin' },
      ],
    },
    {
      title: 'SYSTEM & SECURITY',
      items: [
        { label: 'App Update & OTA', route: '/manage/app-update', icon: 'cloud-download', tag: 'v1.0.4' },
        { label: 'API Vault & Secret', route: '/manage/api', icon: 'key' },
        { label: 'Audit Logs', route: '/manage/logs', icon: 'shield-checkmark', tag: 'Live' },
        { label: 'Security Center', route: '/manage/security', icon: 'shield' },
        { label: 'Global Settings', route: '/manage/settings', icon: 'settings' },
        { label: 'Panic Room', route: '/manage/panic', icon: 'warning', color: '#EF4444', isSuperOnly: true },
      ],
    },
  ];

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await forceSignOut();
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setLoggingOut(false);
    }
  };

  const getLogoSource = () => {
    if (settings?.app_logo) {
      let logoUrl = '';
      if (typeof settings.app_logo === 'string') {
        const trimmed = settings.app_logo.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
          logoUrl = trimmed;
        }
      } else if (typeof settings.app_logo === 'object') {
        logoUrl = (settings.app_logo as any).url || (settings.app_logo as any).uri || '';
      }
      if (logoUrl) return { uri: logoUrl };
    }
    return require('../assets/images/logo.png');
  };

  return (
    <View style={[styles.container, collapsed ? styles.containerCollapsed : styles.containerExpanded]}>
      {/* ── Brand Header ── */}
      <View style={[styles.brandHeader, collapsed && styles.brandHeaderCollapsed]}>
        <View style={styles.brandLogoBox}>
          <Image source={getLogoSource()} style={styles.brandLogo} resizeMode="contain" />
        </View>

        {!collapsed && (
          <View style={styles.brandTextCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.brandName} numberOfLines={1}>
                ABU MAFHAL
              </Text>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeTxt}>ADMIN</Text>
              </View>
            </View>
            <Text style={styles.brandTagline} numberOfLines={1}>
              {isSuper ? '👑 SUPER ADMIN VAULT' : 'CONTROL CENTER'}
            </Text>
          </View>
        )}

        {onToggleCollapse && (
          <TouchableOpacity
            onPress={onToggleCollapse}
            style={styles.collapseToggleBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={collapsed ? 'chevron-forward' : 'chevron-back'}
              size={14}
              color="#94A3B8"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Admin Info Pill ── */}
      {!collapsed ? (
        <View style={styles.adminProfileCard}>
          <View style={styles.adminAvatarBox}>
            {adminProfile?.avatar_url ? (
              <Image source={{ uri: adminProfile.avatar_url }} style={styles.adminAvatarImg} />
            ) : (
              <Text style={styles.adminAvatarInit}>
                {adminProfile?.full_name ? adminProfile.full_name[0].toUpperCase() : 'A'}
              </Text>
            )}
            <View style={styles.adminOnlineDot} />
          </View>
          <View style={styles.adminProfileTextCol}>
            <Text style={styles.adminName} numberOfLines={1}>
              {adminProfile?.full_name || 'System Admin'}
            </Text>
            <Text style={styles.adminEmail} numberOfLines={1}>
              {adminProfile?.email || 'admin@abumafhal.com'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.adminProfileCardCollapsed}>
          <View style={styles.adminAvatarBoxCollapsed}>
            <Text style={styles.adminAvatarInit}>
              {adminProfile?.full_name ? adminProfile.full_name[0].toUpperCase() : 'A'}
            </Text>
            <View style={styles.adminOnlineDot} />
          </View>
        </View>
      )}

      {/* ── Switch to User App Button ── */}
      <View style={{ paddingHorizontal: collapsed ? 8 : 12, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/dashboard')}
          style={[styles.switchAppBtn, collapsed && { paddingHorizontal: 0, justifyContent: 'center' }]}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={[styles.switchAppGradient, collapsed && { paddingHorizontal: 0, justifyContent: 'center' }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
            {!collapsed && (
              <Text style={styles.switchAppTxt} numberOfLines={1}>
                Switch to User App
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable Navigation Items ── */}
      <ScrollView
        style={styles.navScrollView}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {NAV_GROUPS.map((group, gIdx) => {
          const visibleItems = group.items.filter((it) => !it.isSuperOnly || isSuper);
          if (visibleItems.length === 0) return null;

          return (
            <View key={gIdx} style={styles.groupContainer}>
              {!collapsed && (
                <Text style={styles.groupHeaderTitle}>{group.title}</Text>
              )}

              {visibleItems.map((item, iIdx) => {
                const isExact = pathname === item.route;
                const isNested = pathname.startsWith(item.route + '/') && item.route !== '/manage';
                const isActive = isExact || isNested;

                return (
                  <TouchableOpacity
                    key={iIdx}
                    onPress={() => handleNavigate(item.route)}
                    style={[
                      styles.navItemBtn,
                      collapsed && styles.navItemBtnCollapsed,
                      isActive && styles.navItemBtnActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    {isActive && <View style={styles.activeIndicatorBar} />}

                    <View
                      style={[
                        styles.navIconBox,
                        isActive && styles.navIconBoxActive,
                        item.color ? { backgroundColor: item.color + '15' } : {},
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={17}
                        color={item.color ? item.color : isActive ? '#F59E0B' : '#94A3B8'}
                      />
                    </View>

                    {!collapsed && (
                      <View style={styles.navLabelWrapper}>
                        <Text
                          style={[
                            styles.navLabelText,
                            isActive && styles.navLabelTextActive,
                            item.color ? { color: item.color } : {},
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>

                        {item.badge !== undefined && item.badge > 0 && (
                          <View style={styles.badgePill}>
                            <Text style={styles.badgePillText}>{item.badge}</Text>
                          </View>
                        )}

                        {item.tag && (
                          <View
                            style={[
                              styles.tagPill,
                              item.tag === 'Super' && { backgroundColor: '#F59E0B20', borderColor: '#F59E0B60' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tagPillText,
                                item.tag === 'Super' && { color: '#F59E0B' },
                              ]}
                            >
                              {item.tag}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Sidebar Footer: Logout ── */}
      <View style={styles.sidebarFooter}>
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutBtn, collapsed && styles.logoutBtnCollapsed]}
          activeOpacity={0.7}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={17} color="#EF4444" />
              {!collapsed && <Text style={styles.logoutBtnTxt}>Sign Out Admin</Text>}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  },
  containerExpanded: {
    width: 260,
  },
  containerCollapsed: {
    width: 74,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  brandHeaderCollapsed: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  brandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(245,158,11,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  brandTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  adminBadge: {
    backgroundColor: '#F59E0B25',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: '#F59E0B',
  },
  adminBadgeTxt: {
    color: '#F59E0B',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  collapseToggleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  adminProfileCardCollapsed: {
    alignItems: 'center',
    marginVertical: 10,
  },
  adminAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  adminAvatarBoxCollapsed: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  adminAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  adminAvatarInit: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
  },
  adminOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  adminProfileTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  adminName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  adminEmail: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  switchAppBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  switchAppGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  switchAppTxt: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  navScrollView: {
    flex: 1,
  },
  navScrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  groupContainer: {
    marginBottom: 14,
  },
  groupHeaderTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
    paddingHorizontal: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  navItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
    position: 'relative',
  },
  navItemBtnCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  navItemBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  activeIndicatorBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: '#F59E0B',
  },
  navIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  navLabelWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 9,
  },
  navLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    flex: 1,
  },
  navLabelTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  badgePill: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: 4,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  tagPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 4,
  },
  tagPillText: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
  },
  sidebarFooter: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutBtnCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  logoutBtnTxt: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
