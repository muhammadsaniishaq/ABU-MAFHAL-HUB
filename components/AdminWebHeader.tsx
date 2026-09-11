import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Platform,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { supabase } from '../services/supabase';

interface AdminWebHeaderProps {
  onToggleSidebar?: () => void;
  showToggle?: boolean;
}

const ALL_ADMIN_MODULES = [
  { name: 'Dashboard Overview', route: '/manage', icon: 'speedometer-outline', category: 'Dashboard' },
  { name: 'Master Console', route: '/manage/super-admin', icon: 'ribbon-outline', category: 'Super Admin' },
  { name: 'User Control', route: '/manage/users', icon: 'people-outline', category: 'Core' },
  { name: 'KYC Verifications', route: '/manage/kyc', icon: 'id-card-outline', category: 'Compliance' },
  { name: 'BVN Tasks', route: '/manage/bvn-tasks', icon: 'finger-print-outline', category: 'Identity' },
  { name: 'NIN Tasks', route: '/manage/nin-tasks', icon: 'card-outline', category: 'Identity' },
  { name: 'CAC Registration', route: '/manage/cac', icon: 'briefcase-outline', category: 'Business' },
  { name: 'Help Desk Tickets', route: '/manage/tickets', icon: 'chatbubbles-outline', category: 'Support' },
  { name: 'Content CMS', route: '/manage/cms', icon: 'images-outline', category: 'Content' },
  { name: 'Data Plans & APIs', route: '/manage/data-plans', icon: 'wifi-outline', category: 'Pricing' },
  { name: 'Airtime Portal', route: '/manage/airtime', icon: 'call-outline', category: 'Pricing' },
  { name: 'NIN Pricing', route: '/manage/nin-pricing', icon: 'pricetag-outline', category: 'Pricing' },
  { name: 'BVN Pricing', route: '/manage/bvn-pricing', icon: 'pricetags-outline', category: 'Pricing' },
  { name: 'Bills Pricing', route: '/manage/bills-pricing', icon: 'flash-outline', category: 'Pricing' },
  { name: 'SMM Pricing', route: '/manage/smm-pricing', icon: 'thumbs-up-outline', category: 'Pricing' },
  { name: 'API Liquidity', route: '/manage/liquidity', icon: 'wallet-outline', category: 'Banking' },
  { name: 'Market Maker Rates', route: '/manage/rates', icon: 'stats-chart-outline', category: 'FX' },
  { name: 'Ledger & Accounting', route: '/manage/accounting', icon: 'calculator-outline', category: 'Finance' },
  { name: 'Risk Control', route: '/manage/risk', icon: 'alert-circle-outline', category: 'Security' },
  { name: 'System Transactions', route: '/manage/transactions', icon: 'receipt-outline', category: 'Finance' },
  { name: 'Analytics Reports', route: '/manage/reports', icon: 'bar-chart-outline', category: 'Reports' },
  { name: 'Broadcasting & Mail', route: '/manage/communications', icon: 'megaphone-outline', category: 'Comms' },
  { name: 'Cortex AI Engine', route: '/manage/ai', icon: 'sparkles-outline', category: 'AI' },
  { name: 'Crypto Liquidity', route: '/manage/crypto', icon: 'logo-bitcoin', category: 'Crypto' },
  { name: 'App Update & OTA', route: '/manage/app-update', icon: 'cloud-download-outline', category: 'Technical' },
  { name: 'API Vault & Secrets', route: '/manage/api', icon: 'key-outline', category: 'Security' },
  { name: 'Audit Trail Logs', route: '/manage/logs', icon: 'shield-checkmark-outline', category: 'Security' },
  { name: 'Security Vault', route: '/manage/security', icon: 'shield-outline', category: 'Security' },
  { name: 'Global Settings', route: '/manage/settings', icon: 'settings-outline', category: 'System' },
  { name: 'Emergency Panic Room', route: '/manage/panic', icon: 'warning-outline', category: 'Emergency' },
];

export default function AdminWebHeader({
  onToggleSidebar,
  showToggle = false,
}: AdminWebHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const [adminUser, setAdminUser] = useState<{
    full_name?: string;
    email?: string;
    avatar_url?: string;
    role?: string;
  } | null>(null);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

    // Global keyboard listener for Command+K / Ctrl+K
    const handleKeyDown = (e: any) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setSearchModalOpen(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      isMounted = false;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, []);

  const getModuleTitle = () => {
    if (pathname === '/manage' || pathname === '/manage/') return 'Dashboard Overview';
    if (pathname.includes('/users')) return 'User Governance & Accounts';
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

  const filteredModules = ALL_ADMIN_MODULES.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || m.route.includes(q);
  });

  const handleSelectModule = (route: string) => {
    setSearchModalOpen(false);
    setSearchQuery('');
    router.push(route as any);
  };

  const isDesktop = width >= 1200;
  const isLaptop = width >= 1024 && width < 1200;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

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

      {/* ── Center: Quick Search Command Bar ── */}
      {!isMobile && (
        <TouchableOpacity
          onPress={() => setSearchModalOpen(true)}
          style={[styles.searchPill, isTablet && { width: 180 }]}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={15} color="#94A3B8" />
          <Text style={styles.searchPillText} numberOfLines={1}>
            {isTablet ? 'Search modules...' : 'Search admin modules...'}
          </Text>
          <View style={styles.kbdHint}>
            <Text style={styles.kbdHintText}>⌘K</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Right side: Status Engine + Switch App + Profile ── */}
      <View style={styles.rightSection}>
        {isMobile && (
          <TouchableOpacity
            onPress={() => setSearchModalOpen(true)}
            style={styles.mobileSearchBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={18} color="#0F172A" />
          </TouchableOpacity>
        )}

        {/* System Health Badge (Only on wide screens) */}
        {isDesktop && (
          <View style={styles.healthBadge}>
            <View style={styles.healthDot} />
            <Text style={styles.healthText}>
              All Systems Active · Zero Latency
            </Text>
          </View>
        )}

        {/* Switch to User App */}
        <TouchableOpacity
          onPress={() => router.replace('/(app)/dashboard')}
          style={styles.switchAppBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="phone-portrait-outline" size={14} color="#0F172A" />
          {!isTablet && !isMobile && <Text style={styles.switchAppTxt}>User App</Text>}
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
          {!isMobile && (
            <View style={styles.avatarDetails}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {adminUser?.full_name || 'Administrator'}
              </Text>
              <Text style={styles.avatarRole} numberOfLines={1}>
                {adminUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Search Command Palette Modal ── */}
      <Modal
        visible={searchModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSearchModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.searchModalCard}
            activeOpacity={1}
            onPress={e => e.stopPropagation?.()}
          >
            {/* Search Input Box */}
            <View style={styles.modalSearchInputBox}>
              <Ionicons name="search" size={18} color="#D97706" />
              <TextInput
                placeholder="Type module name or keyword (e.g. Users, KYC, Rates)..."
                placeholderTextColor="#94A3B8"
                style={styles.modalTextInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Results List */}
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {filteredModules.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Ionicons name="search-outline" size={32} color="#CBD5E1" />
                  <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 13, marginTop: 8 }}>
                    No matching admin module found
                  </Text>
                </View>
              ) : (
                filteredModules.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSelectModule(item.route)}
                    style={styles.searchResultItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchResultIcon}>
                      <Ionicons name={item.icon as any} size={18} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.searchResultTitle}>{item.name}</Text>
                      <Text style={styles.searchResultCategory}>{item.category} • {item.route}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.modalFooterText}>
                Tip: Press <Text style={{ fontWeight: '800' }}>ESC</Text> to close or tap any module to navigate.
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: 260,
    marginHorizontal: 16,
    gap: 8,
  },
  searchPillText: {
    flex: 1,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  kbdHint: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  kbdHintText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  mobileSearchBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  searchModalCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalSearchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    outlineStyle: 'none' as any,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchResultCategory: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalFooterText: {
    fontSize: 10.5,
    color: '#64748B',
  },
});
