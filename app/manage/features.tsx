import {
  View, Text, ScrollView, TouchableOpacity, Switch, Alert,
  ActivityIndicator, StyleSheet, Platform, TextInput, Modal,
  Animated, Dimensions,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  navy:    '#0F172A',
  navyMid: '#1E293B',
  gold:    '#D97706',
  goldL:   '#FEF3C7',
  goldB:   '#FCD34D',
  white:   '#FFFFFF',
  bg:      '#F5F3EE',
  border:  '#E2E8F2',
  sub:     '#475569',
  muted:   '#94A3B8',
  red:     '#DC2626',
  redL:    '#FEF2F2',
  green:   '#16A34A',
  greenL:  '#F0FDF4',
};

// ─── All dashboard quick-action services ─────────────────────────────────────
const DASHBOARD_SERVICES = [
  { id: 'airtime',      defaultIcon: 'phone-portrait-outline', defaultLabel: 'Airtime',         defaultColor: '#f97316', route: '/airtime' },
  { id: 'data',         defaultIcon: 'wifi-outline',           defaultLabel: 'Data',            defaultColor: '#22c55e', route: '/data' },
  { id: 'transfer',     defaultIcon: 'swap-horizontal-outline',defaultLabel: 'Transfer',        defaultColor: '#2563eb', route: '/transfer' },
  { id: 'recharge_pin', defaultIcon: 'key-outline',            defaultLabel: 'Recharge PIN',    defaultColor: '#10b981', route: '/recharge-pin' },
  { id: 'airtime_cash', defaultIcon: 'cash-outline',           defaultLabel: 'Airtime ➔ Cash', defaultColor: '#16a34a', route: '/airtime-to-cash' },
  { id: 'bills',        defaultIcon: 'receipt-outline',        defaultLabel: 'Bills',           defaultColor: '#eab308', route: '/bills' },
  { id: 'nin',          defaultIcon: 'person-add-outline',     defaultLabel: 'NIN',             defaultColor: '#10b981', route: '/nin-services' },
  { id: 'tickets',      defaultIcon: 'ticket-outline',         defaultLabel: 'Tickets',         defaultColor: '#e11d48', route: '/(app)/tickets' },
  { id: 'bulk_sms',     defaultIcon: 'chatbubbles-outline',    defaultLabel: 'Bulk SMS',        defaultColor: '#3B82F6', route: '/bulk-sms' },
  { id: 'cable',        defaultIcon: 'tv-outline',             defaultLabel: 'Cable TV',        defaultColor: '#8b5cf6', route: '/bills' },
  { id: 'electricity',  defaultIcon: 'flash-outline',          defaultLabel: 'PHCN',            defaultColor: '#f5a623', route: '/bills' },
  { id: 'smile',        defaultIcon: 'globe-outline',          defaultLabel: 'Smile',           defaultColor: '#ec4899', route: '/smile' },
  { id: 'education',    defaultIcon: 'school-outline',         defaultLabel: 'Education',       defaultColor: '#06b6d4', route: '/education' },
  { id: 'cac',          defaultIcon: 'briefcase-outline',      defaultLabel: 'CAC Reg',         defaultColor: '#8b5cf6', route: '/cac-services' },
  { id: 'social',       defaultIcon: 'rocket-outline',         defaultLabel: 'Social',          defaultColor: '#ec4899', route: '/social-boost' },
  { id: 'reviews',      defaultIcon: 'star-outline',           defaultLabel: 'Reviews',         defaultColor: '#f5a623', route: '/reviews' },
  { id: 'cards',        defaultIcon: 'card-outline',           defaultLabel: 'Cards',           defaultColor: '#8B5CF6', route: '/virtual-cards' },
  { id: 'savings',      defaultIcon: 'wallet-outline',         defaultLabel: 'Savings',         defaultColor: '#107C10', route: '/savings' },
  { id: 'loans',        defaultIcon: 'cash-outline',           defaultLabel: 'Loans',           defaultColor: '#EA580C', route: '/loans' },
  { id: 'crypto',       defaultIcon: 'logo-bitcoin',           defaultLabel: 'Crypto',          defaultColor: '#F7931A', route: '/crypto' },
  { id: 'analytics',   defaultIcon: 'pie-chart-outline',      defaultLabel: 'Insights',        defaultColor: '#DB2777', route: '/analytics' },
  { id: 'rewards',      defaultIcon: 'gift-outline',           defaultLabel: 'Rewards',         defaultColor: '#9333EA', route: '/rewards' },
  { id: 'qr',           defaultIcon: 'qr-code-outline',        defaultLabel: 'QR Pay',          defaultColor: '#10B981', route: '/qr-pay' },
  { id: 'investments',  defaultIcon: 'trending-up-outline',    defaultLabel: 'Invest',          defaultColor: '#3B82F6', route: '/investments' },
  { id: 'insurance',    defaultIcon: 'shield-checkmark-outline',defaultLabel: 'Insurance',      defaultColor: '#107C10', route: '/insurance' },
  { id: 'bvn',          defaultIcon: 'finger-print-outline',   defaultLabel: 'BVN',             defaultColor: '#0056D2', route: '/bvn-services' },
];

// Badge presets
const BADGE_PRESETS = [
  { label: 'None',    value: null,     emoji: '—' },
  { label: 'NEW',     value: 'NEW',    emoji: '🆕' },
  { label: 'HOT',     value: 'HOT',    emoji: '🔥' },
  { label: 'POPULAR', value: 'POPULAR',emoji: '⭐' },
  { label: 'SALE',    value: 'SALE',   emoji: '💥' },
  { label: 'BOOST',   value: 'BOOST',  emoji: '🚀' },
  { label: 'WEB3',    value: 'WEB3',   emoji: '🌐' },
  { label: '🔥',      value: '🔥',     emoji: '🔥' },
  { label: '⭐',      value: '⭐',     emoji: '⭐' },
  { label: '💎',      value: '💎',     emoji: '💎' },
  { label: '🎁',      value: '🎁',     emoji: '🎁' },
  { label: '🚀',      value: '🚀',     emoji: '🚀' },
];

// Color palette
const COLOR_PALETTE = [
  '#f97316','#22c55e','#2563eb','#10b981','#8b5cf6','#e11d48',
  '#eab308','#06b6d4','#ec4899','#F7931A','#0F172A','#D97706',
  '#3B82F6','#16a34a','#DB2777','#9333EA','#0056D2','#107C10',
];

// Known admin-lockable modules
const ADMIN_LOCKABLE_MODULES = [
  { key: 'users',         label: 'Users Management',             icon: 'people-outline',          cat: 'Operations' },
  { key: 'transactions',  label: 'Transactions & Receipts',      icon: 'receipt-outline',         cat: 'Operations' },
  { key: 'kyc',           label: 'KYC Queue & Upgrades',         icon: 'scan-outline',            cat: 'Operations' },
  { key: 'nin_pricing',   label: 'NIN & Services Pricing',       icon: 'pricetag-outline',        cat: 'Operations' },
  { key: 'smm_pricing',   label: 'SMM Services Pricing',         icon: 'thumbs-up-outline',       cat: 'Operations' },
  { key: 'bills_pricing', label: 'Bills & Utilities Pricing',    icon: 'flash-outline',           cat: 'Operations' },
  { key: 'cac',           label: 'CAC Business Management',      icon: 'briefcase-outline',       cat: 'Operations' },
  { key: 'tickets',       label: 'Help Desk & Support Tickets',  icon: 'chatbubbles-outline',     cat: 'Operations' },
  { key: 'cms',           label: 'Content & CMS',                icon: 'images-outline',          cat: 'Operations' },
  { key: 'data_plans',    label: 'Data Bundles & Plans',         icon: 'wifi-outline',            cat: 'Operations' },
  { key: 'airtime',       label: 'Airtime Top-up',               icon: 'call-outline',            cat: 'Operations' },
  { key: 'localization',  label: 'Localization & Languages',     icon: 'language-outline',        cat: 'Operations' },
  { key: 'bulk_sms',      label: 'Bulk SMS Messaging',           icon: 'chatbubbles-outline',     cat: 'Operations' },
  { key: 'reviews',       label: 'Customer Reviews Control',     icon: 'star-outline',            cat: 'Operations' },
  { key: 'cards',         label: 'Virtual Cards Management',     icon: 'card-outline',            cat: 'Banking' },
  { key: 'lending',       label: 'Loans & Lending',              icon: 'cash-outline',            cat: 'Banking' },
  { key: 'wealth',        label: 'Wealth & Investments',         icon: 'briefcase-outline',       cat: 'Banking' },
  { key: 'liquidity',     label: 'Liquidity Vault',              icon: 'water-outline',           cat: 'Banking' },
  { key: 'rates',         label: 'Exchange Rates',               icon: 'trending-up-outline',     cat: 'Banking' },
  { key: 'risk',          label: 'Risk Assessment',              icon: 'alert-circle-outline',    cat: 'Finance' },
  { key: 'reports',       label: 'Analytics & Reports',          icon: 'bar-chart-outline',       cat: 'Finance' },
  { key: 'communications',label: 'Broadcast Communications',     icon: 'megaphone-outline',       cat: 'Finance' },
  { key: 'ai',            label: 'Cortex AI Console',            icon: 'sparkles-outline',        cat: 'Finance' },
  { key: 'crypto',        label: 'Crypto Assets Management',     icon: 'logo-bitcoin',            cat: 'Finance' },
  { key: 'infrastructure',label: 'Server Infrastructure',        icon: 'server-outline',          cat: 'Technical' },
  { key: 'db',            label: 'Database Console',             icon: 'server',                  cat: 'Technical' },
  { key: 'api',           label: 'API Integrations & Keys',      icon: 'code-working-outline',    cat: 'Technical' },
  { key: 'cinema',        label: 'Media & Cinema Stream',        icon: 'videocam-outline',        cat: 'Technical' },
  { key: 'terminal',      label: 'CLI System Terminal',          icon: 'terminal-outline',        cat: 'Technical' },
  { key: 'features',      label: 'System Feature Flags',         icon: 'toggle-outline',          cat: 'Technical' },
  { key: 'stores',        label: 'App Store Deployments',        icon: 'logo-apple',              cat: 'Technical' },
  { key: 'files',         label: 'Files & Cloud Storage',        icon: 'folder-open-outline',     cat: 'Technical' },
  { key: 'staff',         label: 'Staff HR & Team Roles',        icon: 'briefcase-outline',       cat: 'Internal' },
  { key: 'voice',         label: 'Voice OS Assistant',           icon: 'mic-outline',             cat: 'Internal' },
  { key: 'legal',         label: 'Legal & Compliance',           icon: 'document-text-outline',   cat: 'Internal' },
  { key: 'team',          label: 'Team Internal Chat',           icon: 'people-circle-outline',   cat: 'Internal' },
  { key: 'academy',       label: 'Academy & Training',           icon: 'school-outline',          cat: 'Internal' },
  { key: 'appearance',    label: 'Theme & Appearance',           icon: 'color-palette-outline',   cat: 'Internal' },
  { key: 'automation',    label: 'Workflow Automation',          icon: 'flash-outline',           cat: 'Internal' },
  { key: 'kanban',        label: 'Kanban Task Board',            icon: 'grid-outline',            cat: 'Internal' },
  { key: 'security',      label: 'Security & 2FA Hub',           icon: 'shield-checkmark-outline',cat: 'RedZone' },
  { key: 'forensics',     label: 'Digital Forensics',            icon: 'finger-print-outline',    cat: 'RedZone' },
  { key: 'secrets',       label: 'API Secrets Vault',            icon: 'key-outline',             cat: 'RedZone' },
  { key: 'logs',          label: 'System Audit Logs',            icon: 'list-outline',            cat: 'RedZone' },
  { key: 'map',           label: 'User Geography Map',           icon: 'earth-outline',           cat: 'RedZone' },
  { key: 'settings',      label: 'App System Settings',          icon: 'settings-outline',        cat: 'RedZone' },
  { key: 'panic',         label: 'PANIC ROOM Emergency',         icon: 'warning-outline',         cat: 'RedZone' },
];

const KNOWN_FEATURES = [
  { key: 'feature_wallet_funding', label: 'Wallet Funding',        icon: 'wallet' },
  { key: 'feature_transfer',       label: 'Fund Transfers',         icon: 'swap-horizontal' },
  { key: 'feature_airtime',        label: 'Airtime Top-up',         icon: 'phone-portrait' },
  { key: 'feature_data',           label: 'Data Bundles',           icon: 'wifi' },
  { key: 'feature_smile',          label: 'Smile Data',             icon: 'globe' },
  { key: 'feature_bills',          label: 'Cable TV & Bills',       icon: 'tv' },
  { key: 'feature_education',      label: 'Education',              icon: 'school' },
  { key: 'feature_cards',          label: 'Virtual Cards',          icon: 'card' },
  { key: 'feature_savings',        label: 'Savings',                icon: 'leaf' },
  { key: 'feature_invest',         label: 'Investments',            icon: 'trending-up' },
  { key: 'feature_loans',          label: 'Loans',                  icon: 'cash' },
  { key: 'feature_crypto',         label: 'Crypto Trading',         icon: 'logo-bitcoin' },
  { key: 'feature_insurance',      label: 'Insurance',              icon: 'shield-checkmark' },
  { key: 'feature_bvn',            label: 'BVN Verification',       icon: 'finger-print' },
  { key: 'feature_nin',            label: 'NIN Registration',       icon: 'person-add' },
  { key: 'feature_cac',            label: 'CAC Registration',       icon: 'briefcase' },
  { key: 'feature_kyc',            label: 'KYC Upgrades',           icon: 'id-card' },
  { key: 'feature_social',         label: 'Social Boost',           icon: 'rocket' },
  { key: 'feature_analytics',      label: 'Analytics',              icon: 'pie-chart' },
  { key: 'feature_rewards',        label: 'Rewards',                icon: 'gift' },
  { key: 'feature_referral',       label: 'Referrals Program',      icon: 'people' },
  { key: 'feature_support',        label: 'Customer Support',       icon: 'headset' },
  { key: 'feature_qr',             label: 'QR Pay',                 icon: 'qr-code' },
  { key: 'feature_bulk_sms',       label: 'Bulk SMS',               icon: 'chatbubbles' },
];

interface FeatureFlag {
  feature_key: string;
  label: string;
  is_enabled: boolean;
  maintenance_message: string;
}

interface ServiceCustom {
  service_id:    string;
  custom_label:  string | null;
  custom_color:  string | null;
  custom_badge:  string | null;
  is_visible:    boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageFeaturesScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'services' | 'app_features' | 'admin_locks'>('services');
  const [userRole, setUserRole]   = useState('admin');
  const [loading, setLoading]     = useState(true);

  // TAB 1 — Dashboard Services
  const [serviceCustoms, setServiceCustoms] = useState<Record<string, ServiceCustom>>({});
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editLabel, setEditLabel]           = useState('');
  const [editColor, setEditColor]           = useState('');
  const [editBadge, setEditBadge]           = useState<string | null>(null);
  const [savingSvc, setSavingSvc]           = useState(false);
  const fireAnim = useRef(new Animated.Value(1)).current;

  // TAB 2 — App Feature Flags
  const [features, setFeatures]   = useState<FeatureFlag[]>([]);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [editMsg, setEditMsg]     = useState<string | null>(null);
  const [msgInput, setMsgInput]   = useState('');

  // TAB 3 — Admin Locks
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(fireAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
      Animated.timing(fireAnim, { toValue: 0.85, duration: 600, useNativeDriver: true }),
    ])).start();
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (p?.role) setUserRole(p.role);
      }
      await Promise.all([loadServiceCustoms(), loadFeatureFlags(), loadHiddenModules()]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Service Customs ─────────────────────────────────────────────────────────
  const loadServiceCustoms = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dashboard_service_customizations')
      .single();
    if (data?.value) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (typeof parsed === 'object') setServiceCustoms(parsed);
      } catch {}
    }
  };

  const saveServiceCustoms = async (updated: Record<string, ServiceCustom>) => {
    setServiceCustoms(updated);
    await supabase.from('app_settings').upsert(
      { key: 'dashboard_service_customizations', value: JSON.stringify(updated) },
      { onConflict: 'key' }
    );
  };

  const getServiceCustom = (id: string): ServiceCustom => {
    return serviceCustoms[id] || { service_id: id, custom_label: null, custom_color: null, custom_badge: null, is_visible: true };
  };

  const openEditService = (id: string) => {
    const svc  = DASHBOARD_SERVICES.find(s => s.id === id)!;
    const cust = getServiceCustom(id);
    setEditingService(id);
    setEditLabel(cust.custom_label ?? svc.defaultLabel);
    setEditColor(cust.custom_color ?? svc.defaultColor);
    setEditBadge(cust.custom_badge ?? null);
  };

  const saveServiceEdit = async () => {
    if (!editingService) return;
    setSavingSvc(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const svc = DASHBOARD_SERVICES.find(s => s.id === editingService)!;
    const updated = {
      ...serviceCustoms,
      [editingService]: {
        service_id:   editingService,
        custom_label: editLabel !== svc.defaultLabel  ? editLabel : null,
        custom_color: editColor !== svc.defaultColor  ? editColor : null,
        custom_badge: editBadge ?? null,
        is_visible:   getServiceCustom(editingService).is_visible,
      },
    };
    await saveServiceCustoms(updated);
    setSavingSvc(false);
    setEditingService(null);
  };

  const toggleServiceVisible = async (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cur  = getServiceCustom(id);
    const updated = {
      ...serviceCustoms,
      [id]: { ...cur, service_id: id, is_visible: !cur.is_visible },
    };
    await saveServiceCustoms(updated);
  };

  // ── Feature Flags ───────────────────────────────────────────────────────────
  const loadFeatureFlags = async () => {
    const { data, error } = await supabase.from('feature_flags').select('*').order('label');
    if (error || !data) return;
    const existingKeys = data.map(f => f.feature_key);
    const missing = KNOWN_FEATURES.filter(f => !existingKeys.includes(f.key));
    if (missing.length > 0) {
      await supabase.from('feature_flags').insert(missing.map(f => ({
        feature_key: f.key, label: f.label, is_enabled: true,
        maintenance_message: 'This feature is currently under maintenance.',
      })));
      const { data: updated } = await supabase.from('feature_flags').select('*').order('label');
      if (updated) setFeatures(updated);
    } else {
      setFeatures(data);
    }
  };

  const toggleFeature = async (feature: FeatureFlag) => {
    setUpdating(feature.feature_key);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nv = !feature.is_enabled;
    const { error } = await supabase.from('feature_flags').update({ is_enabled: nv }).eq('feature_key', feature.feature_key);
    if (!error) setFeatures(features.map(f => f.feature_key === feature.feature_key ? { ...f, is_enabled: nv } : f));
    setUpdating(null);
  };

  const saveMsg = async (key: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase.from('feature_flags').update({ maintenance_message: msgInput }).eq('feature_key', key);
    if (!error) {
      setFeatures(features.map(f => f.feature_key === key ? { ...f, maintenance_message: msgInput } : f));
      setEditMsg(null);
    }
  };

  // ── Admin Locks ──────────────────────────────────────────────────────────────
  const loadHiddenModules = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'hidden_admin_modules').single();
    if (data?.value) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (Array.isArray(parsed)) setHiddenModules(parsed);
      } catch {}
    }
  };

  const toggleHideModule = async (key: string) => {
    if (userRole !== 'super_admin') {
      return Alert.alert('Access Restricted 🔒', 'Only Super Admin can hide or show admin modules.');
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = hiddenModules.includes(key) ? hiddenModules.filter(k => k !== key) : [...hiddenModules, key];
    setHiddenModules(updated);
    await supabase.from('app_settings').upsert({ key: 'hidden_admin_modules', value: JSON.stringify(updated) }, { onConflict: 'key' });
  };

  const getIconForFeature = (key: string) => KNOWN_FEATURES.find(f => f.key === key)?.icon || 'construct-outline';

  // ─── Render Edit Modal ────────────────────────────────────────────────────
  const renderEditModal = () => {
    if (!editingService) return null;
    const svc  = DASHBOARD_SERVICES.find(s => s.id === editingService)!;
    const badge = BADGE_PRESETS.find(b => b.value === editBadge);

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setEditingService(null)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            {/* Header */}
            <View style={m.sheetHead}>
              <View style={m.sheetHeadLeft}>
                <View style={[m.previewIcon, { backgroundColor: `${editColor}22` }]}>
                  <Ionicons name={svc.defaultIcon as any} size={22} color={editColor} />
                </View>
                <View>
                  <Text style={m.sheetTitle}>Edit Service</Text>
                  <Text style={m.sheetSub}>{svc.id.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditingService(null)} style={m.closeBtn}>
                <Ionicons name="close" size={18} color={C.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {/* Label */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>📝 Service Name</Text>
                <TextInput
                  style={m.input}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder={svc.defaultLabel}
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                />
                <TouchableOpacity onPress={() => setEditLabel(svc.defaultLabel)} style={m.resetBtn}>
                  <Text style={m.resetBtnText}>Reset to default</Text>
                </TouchableOpacity>
              </View>

              {/* Color */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>🎨 Icon Color</Text>
                <View style={m.colorGrid}>
                  {COLOR_PALETTE.map(col => (
                    <TouchableOpacity
                      key={col}
                      style={[m.colorDot, { backgroundColor: col }, editColor === col && m.colorDotSel]}
                      onPress={() => setEditColor(col)}
                      activeOpacity={0.8}
                    >
                      {editColor === col && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Badge */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>🏷️ Badge Tag</Text>
                <View style={m.badgeGrid}>
                  {BADGE_PRESETS.map(bp => (
                    <TouchableOpacity
                      key={String(bp.value)}
                      style={[m.badgeChip, editBadge === bp.value && m.badgeChipSel]}
                      onPress={() => setEditBadge(bp.value)}
                      activeOpacity={0.75}
                    >
                      {bp.value === '🔥' ? (
                        <Animated.Text style={[m.badgeChipText, { transform: [{ scale: fireAnim }] }]}>
                          {bp.emoji} {bp.label}
                        </Animated.Text>
                      ) : (
                        <Text style={[m.badgeChipText, editBadge === bp.value && m.badgeChipTextSel]}>
                          {bp.emoji} {bp.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Live Preview */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>👁️ Live Preview</Text>
                <View style={m.previewCard}>
                  <View style={[m.previewIconLg, { backgroundColor: `${editColor}18` }]}>
                    <Ionicons name={svc.defaultIcon as any} size={26} color={editColor} />
                  </View>
                  <Text style={m.previewLabel} numberOfLines={1}>{editLabel || svc.defaultLabel}</Text>
                  {editBadge ? (
                    <View style={[m.previewBadge, { backgroundColor: `${editColor}22`, borderColor: `${editColor}55` }]}>
                      {editBadge === '🔥' ? (
                        <Animated.Text style={[m.previewBadgeText, { color: editColor, transform: [{ scale: fireAnim }] }]}>
                          {editBadge}
                        </Animated.Text>
                      ) : (
                        <Text style={[m.previewBadgeText, { color: editColor }]}>{editBadge}</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            {/* Save */}
            <TouchableOpacity style={m.saveBtn} onPress={saveServiceEdit} activeOpacity={0.85} disabled={savingSvc}>
              <LinearGradient colors={[C.navy, C.navyMid]} style={m.saveBtnGrad}>
                {savingSvc
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <>
                      <Ionicons name="checkmark-circle" size={16} color={C.gold} />
                      <Text style={m.saveBtnText}>Save Changes</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient colors={[C.navy, C.navyMid]} style={s.header}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.headerTitle}>Features & Services</Text>
              <Text style={s.headerSub}>Dashboard Customization Hub</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Gold trim */}
          <View style={s.goldTrim} />

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
            {([
              { id: 'services',    label: '🛠 Services',   icon: 'grid-outline' },
              { id: 'app_features',label: '⚙️ App Flags',  icon: 'toggle-outline' },
              { id: 'admin_locks', label: '👑 Admin Locks',icon: 'eye-off-outline' },
            ] as const).map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[s.tabPill, activeTab === tab.id && s.tabPillSel]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.tabText, activeTab === tab.id && s.tabTextSel]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={{ color: C.sub, marginTop: 10, fontWeight: '600' }}>Loading...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

          {/* ════════════════════════════════════
              TAB 1 — DASHBOARD SERVICE EDITOR
          ════════════════════════════════════ */}
          {activeTab === 'services' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              {/* Info banner */}
              <LinearGradient colors={[C.goldL, '#FFFBEB']} style={s.infoBanner}>
                <View style={s.infoBannerRow}>
                  <Ionicons name="color-wand" size={18} color={C.gold} />
                  <Text style={s.infoBannerTitle}>User Dashboard Service Editor</Text>
                </View>
                <Text style={s.infoBannerDesc}>
                  Customize each service icon's name, color, and badge tag that users see on their dashboard.
                  Changes take effect immediately. Toggle the eye to hide a service from users.
                </Text>
              </LinearGradient>

              {/* Service grid */}
              <View style={s.svcGrid}>
                {DASHBOARD_SERVICES.map(svc => {
                  const cust    = getServiceCustom(svc.id);
                  const label   = cust.custom_label  || svc.defaultLabel;
                  const color   = cust.custom_color  || svc.defaultColor;
                  const badge   = cust.custom_badge;
                  const visible = cust.is_visible;

                  return (
                    <View key={svc.id} style={[s.svcCard, !visible && s.svcCardHidden]}>
                      {/* Color accent top */}
                      <View style={[s.svcAccentBar, { backgroundColor: color }]} />

                      <View style={s.svcCardInner}>
                        {/* Top: icon + visible toggle */}
                        <View style={s.svcCardTop}>
                          <View style={[s.svcIconBox, { backgroundColor: `${color}18` }]}>
                            <Ionicons name={svc.defaultIcon as any} size={18} color={visible ? color : C.muted} />
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleServiceVisible(svc.id)}
                            style={[s.eyeBtn, !visible && s.eyeBtnOff]}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={visible ? 'eye' : 'eye-off'} size={12} color={visible ? C.green : C.muted} />
                          </TouchableOpacity>
                        </View>

                        {/* Label + badge */}
                        <Text style={[s.svcLabel, !visible && { color: C.muted }]} numberOfLines={1}>{label}</Text>
                        <View style={s.svcFooter}>
                          {badge ? (
                            badge === '🔥' ? (
                              <Animated.Text style={[s.svcBadge, { transform: [{ scale: fireAnim }] }]}>{badge}</Animated.Text>
                            ) : (
                              <View style={[s.svcBadgeChip, { backgroundColor: `${color}18`, borderColor: `${color}50` }]}>
                                <Text style={[s.svcBadgeText, { color }]}>{badge}</Text>
                              </View>
                            )
                          ) : (
                            <Text style={s.svcDefault}>Default</Text>
                          )}
                        </View>

                        {/* Edit button */}
                        <TouchableOpacity
                          style={[s.editBtn, { borderColor: `${color}50` }]}
                          onPress={() => openEditService(svc.id)}
                          activeOpacity={0.78}
                        >
                          <Ionicons name="pencil" size={11} color={color} />
                          <Text style={[s.editBtnText, { color }]}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ════════════════════════════════════
              TAB 2 — APP FEATURE FLAGS
          ════════════════════════════════════ */}
          {activeTab === 'app_features' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[s.infoBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <View style={s.infoBannerRow}>
                  <Ionicons name="construct" size={18} color="#2563EB" />
                  <Text style={[s.infoBannerTitle, { color: '#2563EB' }]}>User App Feature Flags</Text>
                </View>
                <Text style={s.infoBannerDesc}>
                  Toggle features ON/OFF for app users. When a feature is OFF, users see a maintenance message.
                </Text>
              </View>

              <View style={s.svcGrid}>
                {features.map(feature => (
                  <View key={feature.feature_key} style={[s.svcCard, !feature.is_enabled && { borderColor: '#FECACA' }]}>
                    <View style={[s.svcAccentBar, { backgroundColor: feature.is_enabled ? C.green : C.red }]} />
                    <View style={s.svcCardInner}>
                      <View style={s.svcCardTop}>
                        <View style={[s.svcIconBox, { backgroundColor: feature.is_enabled ? C.greenL : C.redL }]}>
                          <Ionicons name={getIconForFeature(feature.feature_key) as any} size={16} color={feature.is_enabled ? C.green : C.red} />
                        </View>
                        {updating === feature.feature_key
                          ? <ActivityIndicator size="small" color={C.gold} />
                          : <Switch
                              value={feature.is_enabled}
                              onValueChange={() => toggleFeature(feature)}
                              trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                              thumbColor={C.white}
                              style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                            />
                        }
                      </View>
                      <Text style={s.svcLabel} numberOfLines={1}>{feature.label}</Text>
                      <Text style={[s.svcDefault, { fontSize: 8.5 }]} numberOfLines={1}>{feature.feature_key}</Text>

                      {!feature.is_enabled && (
                        <View style={{ marginTop: 6 }}>
                          {editMsg === feature.feature_key ? (
                            <View>
                              <TextInput
                                style={s.msgInput}
                                value={msgInput}
                                onChangeText={setMsgInput}
                                multiline
                                selectionColor={C.gold}
                                placeholderTextColor={C.muted}
                                placeholder="Maintenance message..."
                              />
                              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                <TouchableOpacity onPress={() => setEditMsg(null)} style={s.cancelBtn}>
                                  <Text style={s.cancelBtnTxt}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => saveMsg(feature.feature_key)} style={s.saveSmBtn}>
                                  <Text style={s.saveSmBtnTxt}>Save</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[s.editBtn, { borderColor: '#FECACA' }]}
                              onPress={() => { setEditMsg(feature.feature_key); setMsgInput(feature.maintenance_message || ''); }}
                              activeOpacity={0.75}
                            >
                              <Ionicons name="pencil" size={11} color={C.red} />
                              <Text style={[s.editBtnText, { color: C.red }]}>Edit Message</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ════════════════════════════════════
              TAB 3 — ADMIN LOCKS
          ════════════════════════════════════ */}
          {activeTab === 'admin_locks' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[s.infoBanner, { backgroundColor: C.goldL, borderColor: C.goldB }]}>
                <View style={s.infoBannerRow}>
                  <Ionicons name="eye-off-outline" size={18} color={C.gold} />
                  <Text style={[s.infoBannerTitle, { color: C.gold }]}>Super Admin Module Locks</Text>
                </View>
                <Text style={s.infoBannerDesc}>
                  Hide or show specific admin modules from normal Staff Admins. Super Admin always has full access.
                </Text>
              </View>

              <View style={s.svcGrid}>
                {ADMIN_LOCKABLE_MODULES.map(mod => {
                  const isHidden = hiddenModules.includes(mod.key);
                  return (
                    <View key={mod.key} style={[s.svcCard, isHidden && { borderColor: '#FECACA', backgroundColor: C.redL }]}>
                      <View style={[s.svcAccentBar, { backgroundColor: isHidden ? C.red : C.green }]} />
                      <View style={s.svcCardInner}>
                        <View style={s.svcCardTop}>
                          <View style={[s.svcIconBox, { backgroundColor: isHidden ? C.redL : C.greenL }]}>
                            <Ionicons name={mod.icon as any} size={16} color={isHidden ? C.red : C.green} />
                          </View>
                          <Switch
                            value={isHidden}
                            onValueChange={() => toggleHideModule(mod.key)}
                            trackColor={{ false: '#86EFAC', true: '#FCA5A5' }}
                            thumbColor={C.white}
                            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                          />
                        </View>
                        <Text style={s.svcLabel} numberOfLines={1}>{mod.label}</Text>
                        <Text style={[s.svcDefault, { color: isHidden ? C.red : C.green, fontWeight: '700' }]}>
                          {isHidden ? '🙈 Hidden' : '👁️ Visible'}
                        </Text>
                        <View style={[s.catChip, { marginTop: 4 }]}>
                          <Text style={s.catChipText}>{mod.cat}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {renderEditModal()}
    </View>
  );
}

// ─── Edit Modal Styles ────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: C.navy },
  sheetSub: { fontSize: 10, color: C.muted, fontWeight: '700', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '900', color: C.navy, marginBottom: 10 },
  input: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: C.navy,
    borderWidth: 1,
    borderColor: C.border,
  },
  resetBtn: { alignSelf: 'flex-end', marginTop: 6 },
  resetBtnText: { fontSize: 11, color: C.muted, fontWeight: '600' },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSel: {
    borderWidth: 3, borderColor: C.navy,
    transform: [{ scale: 1.15 }],
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  badgeChipSel: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  badgeChipText: { fontSize: 12, fontWeight: '700', color: C.sub },
  badgeChipTextSel: { color: C.gold },
  // Live preview card
  previewCard: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  previewIconLg: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  previewLabel: { fontSize: 13, fontWeight: '800', color: C.navy, marginBottom: 6 },
  previewBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  previewBadgeText: { fontSize: 11, fontWeight: '900' },
  // Save button
  saveBtn: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  saveBtnText: { color: C.gold, fontSize: 15, fontWeight: '900' },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────
const SVC_W = (W - 32 - 10) / 2;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: C.white, letterSpacing: 0.3 },
  headerSub: { fontSize: 10, color: 'rgba(245,158,11,0.85)', fontWeight: '700', marginTop: 1 },
  goldTrim: { height: 2, backgroundColor: C.gold, marginTop: 12, marginHorizontal: 0 },
  tabsRow: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  tabPillSel: { backgroundColor: C.gold, borderColor: C.gold },
  tabText: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  tabTextSel: { color: C.navy },

  // Info banner
  infoBanner: {
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.goldB,
    marginBottom: 16,
  },
  infoBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoBannerTitle: { fontSize: 12, fontWeight: '900', color: C.gold },
  infoBannerDesc: { fontSize: 11, color: C.sub, lineHeight: 16 },

  // Service card grid
  svcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  svcCard: {
    width: SVC_W,
    backgroundColor: C.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  svcCardHidden: { opacity: 0.55 },
  svcAccentBar: { height: 3, width: '100%' },
  svcCardInner: { padding: 10 },
  svcCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  svcIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  eyeBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.greenL,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#86EFAC',
  },
  eyeBtnOff: { backgroundColor: C.bg, borderColor: C.border },
  svcLabel: { fontSize: 11, fontWeight: '800', color: C.navy, marginBottom: 3 },
  svcFooter: { marginBottom: 8, minHeight: 16 },
  svcBadge: { fontSize: 14 },
  svcBadgeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 5, borderWidth: 0.5,
  },
  svcBadgeText: { fontSize: 8, fontWeight: '900' },
  svcDefault: { fontSize: 9, color: C.muted, fontWeight: '500' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: C.bg,
  },
  editBtnText: { fontSize: 10, fontWeight: '800' },

  // Category chip
  catChip: {
    alignSelf: 'flex-start',
    backgroundColor: C.goldL,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5,
  },
  catChipText: { fontSize: 8, fontWeight: '800', color: C.gold },

  // Maintenance message input
  msgInput: {
    backgroundColor: C.bg, borderRadius: 8,
    padding: 8, fontSize: 11,
    borderWidth: 1, borderColor: C.border,
    color: C.navy, minHeight: 50,
    textAlignVertical: 'top',
  },
  cancelBtn: { flex: 1, paddingVertical: 5, alignItems: 'center', borderRadius: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  cancelBtnTxt: { fontSize: 10, fontWeight: '700', color: C.sub },
  saveSmBtn: { flex: 1, paddingVertical: 5, alignItems: 'center', borderRadius: 6, backgroundColor: C.navy },
  saveSmBtnTxt: { fontSize: 10, fontWeight: '800', color: C.gold },
});
