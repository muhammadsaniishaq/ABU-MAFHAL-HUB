import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { supabase } from '../services/supabase';

interface AdminWebHeaderProps {
  onToggleSidebar?: () => void;
  showToggle?: boolean;
}

export default function AdminWebHeader({
  onToggleSidebar,
  showToggle = false,
}: AdminWebHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [adminUser, setAdminUser] = useState<{
    full_name?: string;
    email?: string;
    avatar_url?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        supabase
          .from('profiles')
          .select('full_name, email, avatar_url, role')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (isMounted && data) {
              setAdminUser(data);
            }
          });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const getModuleTitle = () => {
    if (pathname === '/manage' || pathname === '/manage/') return 'Dashboard Overview';
    if (pathname.includes('/users')) return 'User Management & Accounts';
    if (pathname.includes('/kyc')) return 'KYC Document Verification';
    if (pathname.includes('/bvn-tasks')) return 'BVN Processing Queue';
    if (pathname.includes('/nin-tasks')) return 'NIN Clearance & Operations';
    if (pathname.includes('/cac')) return 'CAC Business Registrations';
    if (pathname.includes('/tickets')) return 'Customer Help Desk & Tickets';
    if (pathname.includes('/cms')) return 'Media & Content CMS';
    if (pathname.includes('/data-plans')) return 'Data Plans & API Endpoints';
    if (pathname.includes('/airtime')) return 'Airtime Automation & Inventory';
    if (pathname.includes('/nin-pricing')) return 'NIN Rates & Pricing Structure';
    if (pathname.includes('/bvn-pricing')) return 'BVN Rates & Pricing Structure';
    if (pathname.includes('/bills-pricing')) return 'Electricity & Cable Pricing';
    if (pathname.includes('/smm-pricing')) return 'Social Boost & SMM Rates';
    if (pathname.includes('/liquidity')) return 'API Provider Liquidity & Balances';
    if (pathname.includes('/rates')) return 'Market Maker & FX Rates';
    if (pathname.includes('/accounting')) return 'Profit & Expense Ledger';
    if (pathname.includes('/risk')) return 'Risk Intelligence & Blacklist';
    if (pathname.includes('/transactions')) return 'Central Transaction Ledger';
    if (pathname.includes('/reports')) return 'Performance & Analytics Reports';
    if (pathname.includes('/communications')) return 'Broadcast Center & Email';
    if (pathname.includes('/ai')) return 'Cortex Neural AI Engine';
    if (pathname.includes('/crypto')) return 'Cryptocurrency Reserves';
    if (pathname.includes('/app-update')) return 'App Releases & OTA Updates';
    if (pathname.includes('/api')) return 'API Vault & Master Credentials';
    if (pathname.includes('/logs')) return 'Audit Trail & Event Logs';
    if (pathname.includes('/security')) return 'Security Vault & Threat Radar';
    if (pathname.includes('/settings')) return 'Global Platform Configuration';
    if (pathname.includes('/super-admin')) return 'Super Admin Master Console';
    if (pathname.includes('/panic')) return 'Emergency Panic Room';
    return 'Admin Management';
  };

  return (
    <View style={styles.headerBar}>
      {/* ── Left side: Toggle button + Breadcrumb Title ── */}
      <View style={styles.leftSection}>
        {showToggle && (
          <TouchableOpacity
            onPress={onToggleSidebar}
            style={styles.toggleBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={20} color="#0F172A" />
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <View style={styles.breadcrumbRow}>
            <Text style={styles.breadcrumbRoot}>ADMIN VAULT</Text>
            <Ionicons name="chevron-forward" size={10} color="#94A3B8" />
            <Text style={styles.breadcrumbCurrent}>{getModuleTitle()}</Text>
          </View>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {getModuleTitle()}
          </Text>
        </View>
      </View>

      {/* ── Right side: Status Engine + Switch App + Profile ── */}
      <View style={styles.rightSection}>
        {/* System Health Badge */}
        <View style={styles.healthBadge}>
          <View style={styles.healthDot} />
          <Text style={styles.healthText}>
            99.98% Systems Active · Zero Latency
          </Text>
        </View>

        {/* Switch to User App */}
        <TouchableOpacity
          onPress={() => router.replace('/(app)/dashboard')}
          style={styles.switchAppBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="phone-portrait-outline" size={14} color="#0F172A" />
          <Text style={styles.switchAppTxt}>User App</Text>
        </TouchableOpacity>

        {/* Admin Avatar Badge */}
        <TouchableOpacity
          onPress={() => router.push('/manage/profile')}
          style={styles.adminAvatarBtn}
          activeOpacity={0.8}
        >
          <View style={styles.avatarImgBox}>
            {adminUser?.avatar_url ? (
              <Image source={{ uri: adminUser.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInit}>
                {adminUser?.full_name ? adminUser.full_name[0].toUpperCase() : 'A'}
              </Text>
            )}
          </View>
          <View style={styles.avatarDetails}>
            <Text style={styles.avatarName} numberOfLines={1}>
              {adminUser?.full_name || 'Administrator'}
            </Text>
            <Text style={styles.avatarRole} numberOfLines={1}>
              {adminUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 90,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    justifyContent: 'center',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  breadcrumbRoot: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  breadcrumbCurrent: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#D97706',
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  healthText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },
  switchAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  switchAppTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  adminAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingRight: 10,
    paddingLeft: 3,
    paddingVertical: 3,
    gap: 8,
  },
  avatarImgBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInit: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
  },
  avatarDetails: {
    justifyContent: 'center',
  },
  avatarName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 13,
  },
  avatarRole: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 11,
  },
});
