import {
  View, Text, ScrollView, TouchableOpacity, Switch, Alert,
  ActivityIndicator, StyleSheet, Platform, TextInput, Modal,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

// ─── Brand Colors: Navy (#0F172A) + Gold (#D97706) ───────────────────────────
const C = {
  navy:        '#0F172A',
  navyMid:     '#1E293B',
  navyLight:   '#334155',
  gold:        '#D97706',
  goldL:       '#FEF3C7',
  goldBorder:  '#FCD34D',
  white:       '#FFFFFF',
  bg:          '#F5F3EE',
  border:      '#E2E8F0',
  sub:         '#475569',
  muted:       '#94A3B8',
  red:         '#DC2626',
  redL:        '#FEF2F2',
  green:       '#16A34A',
  greenL:      '#F0FDF4',
};

// ─── Curated Service Icons for Selection ─────────────────────────────────────
const AVAILABLE_ICONS = [
  'phone-portrait-outline', 'wifi-outline', 'swap-horizontal-outline', 'key-outline',
  'cash-outline', 'receipt-outline', 'person-add-outline', 'ticket-outline',
  'chatbubbles-outline', 'tv-outline', 'flash-outline', 'globe-outline',
  'school-outline', 'briefcase-outline', 'rocket-outline', 'star-outline',
  'card-outline', 'wallet-outline', 'logo-bitcoin', 'pie-chart-outline',
  'gift-outline', 'qr-code-outline', 'trending-up-outline', 'shield-checkmark-outline',
  'finger-print-outline', 'sparkles-outline', 'cart-outline', 'airplane-outline'
];

// ─── Background Styles ────────────────────────────────────────────────────────
const BG_STYLES = [
  { id: 'tint',  label: 'Pastel Tint', desc: 'Soft matching tint' },
  { id: 'white', label: 'Pure White',  desc: 'Clean white background' },
  { id: 'gold',  label: 'Royal Gold',  desc: 'Gold luxury accent' },
  { id: 'navy',  label: 'Deep Navy',   desc: 'Dark premium theme' },
];

// ─── Default Dashboard Services Catalog ──────────────────────────────────────
const DASHBOARD_SERVICES = [
  { id: 'airtime',      defaultIcon: 'phone-portrait-outline', defaultLabel: 'Airtime',         defaultColor: '#f97316', defaultBadge: null, route: '/airtime' },
  { id: 'data',         defaultIcon: 'wifi-outline',           defaultLabel: 'Data Bundles',    defaultColor: '#22c55e', defaultBadge: null, route: '/data' },
  { id: 'transfer',     defaultIcon: 'swap-horizontal-outline',defaultLabel: 'Transfer',        defaultColor: '#2563eb', defaultBadge: null, route: '/transfer' },
  { id: 'recharge_pin', defaultIcon: 'key-outline',            defaultLabel: 'Recharge PIN',    defaultColor: '#10b981', defaultBadge: 'HOT', route: '/recharge-pin' },
  { id: 'airtime_cash', defaultIcon: 'cash-outline',           defaultLabel: 'Airtime to Cash', defaultColor: '#16a34a', defaultBadge: 'NEW', route: '/airtime-to-cash' },
  { id: 'bills',        defaultIcon: 'receipt-outline',        defaultLabel: 'Bills Payment',   defaultColor: '#eab308', defaultBadge: null, route: '/bills' },
  { id: 'nin',          defaultIcon: 'person-add-outline',     defaultLabel: 'NIN Services',    defaultColor: '#10b981', defaultBadge: null, route: '/nin-services' },
  { id: 'tickets',      defaultIcon: 'ticket-outline',         defaultLabel: 'Help Tickets',    defaultColor: '#e11d48', defaultBadge: null, route: '/(app)/tickets' },
  { id: 'bulk_sms',     defaultIcon: 'chatbubbles-outline',    defaultLabel: 'Bulk SMS',        defaultColor: '#3B82F6', defaultBadge: null, route: '/bulk-sms' },
  { id: 'cable',        defaultIcon: 'tv-outline',             defaultLabel: 'Cable TV',        defaultColor: '#8b5cf6', defaultBadge: null, route: '/bills' },
  { id: 'electricity',  defaultIcon: 'flash-outline',          defaultLabel: 'Electricity',     defaultColor: '#f5a623', defaultBadge: null, route: '/bills' },
  { id: 'smile',        defaultIcon: 'globe-outline',          defaultLabel: 'Smile Data',      defaultColor: '#ec4899', defaultBadge: null, route: '/smile' },
  { id: 'education',    defaultIcon: 'school-outline',         defaultLabel: 'Education',       defaultColor: '#06b6d4', defaultBadge: null, route: '/education' },
  { id: 'cac',          defaultIcon: 'briefcase-outline',      defaultLabel: 'CAC Reg',         defaultColor: '#8b5cf6', defaultBadge: 'POPULAR', route: '/cac-services' },
  { id: 'social',       defaultIcon: 'rocket-outline',         defaultLabel: 'Social Boost',    defaultColor: '#ec4899', defaultBadge: 'BOOST', route: '/social-boost' },
  { id: 'reviews',      defaultIcon: 'star-outline',           defaultLabel: 'Reviews',         defaultColor: '#f5a623', defaultBadge: null, route: '/reviews' },
  { id: 'cards',        defaultIcon: 'card-outline',           defaultLabel: 'Virtual Cards',   defaultColor: '#8B5CF6', defaultBadge: null, route: '/virtual-cards' },
  { id: 'savings',      defaultIcon: 'wallet-outline',         defaultLabel: 'Savings',         defaultColor: '#107C10', defaultBadge: null, route: '/savings' },
  { id: 'loans',        defaultIcon: 'cash-outline',           defaultLabel: 'Quick Loans',     defaultColor: '#EA580C', defaultBadge: null, route: '/loans' },
  { id: 'crypto',       defaultIcon: 'logo-bitcoin',           defaultLabel: 'Crypto Trading',  defaultColor: '#F7931A', defaultBadge: 'WEB3', route: '/crypto' },
  { id: 'analytics',   defaultIcon: 'pie-chart-outline',      defaultLabel: 'Insights',        defaultColor: '#DB2777', defaultBadge: null, route: '/analytics' },
  { id: 'rewards',      defaultIcon: 'gift-outline',           defaultLabel: 'Reward Points',   defaultColor: '#9333EA', defaultBadge: null, route: '/rewards' },
  { id: 'qr',           defaultIcon: 'qr-code-outline',        defaultLabel: 'QR Pay',          defaultColor: '#10B981', defaultBadge: null, route: '/qr-pay' },
  { id: 'investments',  defaultIcon: 'trending-up-outline',    defaultLabel: 'Investments',     defaultColor: '#3B82F6', defaultBadge: null, route: '/investments' },
  { id: 'insurance',    defaultIcon: 'shield-checkmark-outline',defaultLabel: 'Insurance',      defaultColor: '#107C10', defaultBadge: null, route: '/insurance' },
  { id: 'bvn',          defaultIcon: 'finger-print-outline',   defaultLabel: 'BVN Services',    defaultColor: '#0056D2', defaultBadge: null, route: '/bvn-services' },
];

// Clean Badge presets
const BADGE_PRESETS = [
  'NONE', 'BOOST', 'HOT', 'POPULAR', 'NEW', 'WEB3', 'PROMO', 'SALE', 'PRO', 'CASHBACK', '24/7', 'FAST'
];

// 18 Curated Theme Colors
const COLOR_PALETTE = [
  '#f97316', '#22c55e', '#2563eb', '#10b981', '#8b5cf6', '#e11d48',
  '#eab308', '#06b6d4', '#ec4899', '#F7931A', '#0F172A', '#D97706',
  '#3B82F6', '#16a34a', '#DB2777', '#9333EA', '#0056D2', '#107C10',
];

// Admin Lockable Modules
const ADMIN_LOCKABLE_MODULES = [
  { key: 'users',          label: 'Users Management',            icon: 'people-outline',          cat: 'Operations' },
  { key: 'transactions',   label: 'Transactions & Receipts',     icon: 'receipt-outline',         cat: 'Operations' },
  { key: 'kyc',            label: 'KYC Queue & Upgrades',        icon: 'scan-outline',            cat: 'Operations' },
  { key: 'nin_pricing',    label: 'NIN & Services Pricing',      icon: 'pricetag-outline',        cat: 'Operations' },
  { key: 'smm_pricing',    label: 'SMM Services Pricing',        icon: 'thumbs-up-outline',       cat: 'Operations' },
  { key: 'bills_pricing',  label: 'Bills & Utilities Pricing',   icon: 'flash-outline',           cat: 'Operations' },
  { key: 'cac',            label: 'CAC Business Management',     icon: 'briefcase-outline',       cat: 'Operations' },
  { key: 'tickets',        label: 'Help Desk & Support',         icon: 'chatbubbles-outline',     cat: 'Operations' },
  { key: 'cms',            label: 'Content & CMS',               icon: 'images-outline',          cat: 'Operations' },
  { key: 'data_plans',     label: 'Data Bundles & Plans',        icon: 'wifi-outline',            cat: 'Operations' },
  { key: 'airtime',        label: 'Airtime Top-up',              icon: 'call-outline',            cat: 'Operations' },
  { key: 'localization',   label: 'Localization & Languages',    icon: 'language-outline',        cat: 'Operations' },
  { key: 'bulk_sms',       label: 'Bulk SMS Messaging',          icon: 'chatbubbles-outline',     cat: 'Operations' },
  { key: 'reviews',        label: 'Customer Reviews Control',    icon: 'star-outline',            cat: 'Operations' },
  { key: 'cards',          label: 'Virtual Cards Management',    icon: 'card-outline',            cat: 'Banking' },
  { key: 'lending',        label: 'Loans & Lending',             icon: 'cash-outline',            cat: 'Banking' },
  { key: 'wealth',         label: 'Wealth & Investments',        icon: 'briefcase-outline',       cat: 'Banking' },
  { key: 'liquidity',      label: 'Liquidity Vault',             icon: 'water-outline',           cat: 'Banking' },
  { key: 'rates',          label: 'Exchange Rates',              icon: 'trending-up-outline',     cat: 'Banking' },
  { key: 'risk',           label: 'Risk Assessment',             icon: 'alert-circle-outline',    cat: 'Finance' },
  { key: 'reports',        label: 'Analytics & Reports',         icon: 'bar-chart-outline',       cat: 'Finance' },
  { key: 'communications', label: 'Broadcast Communications',    icon: 'megaphone-outline',       cat: 'Finance' },
  { key: 'ai',             label: 'Cortex AI Console',           icon: 'sparkles-outline',        cat: 'Finance' },
  { key: 'crypto',         label: 'Crypto Assets Management',    icon: 'logo-bitcoin',            cat: 'Finance' },
  { key: 'infrastructure', label: 'Server Infrastructure',       icon: 'server-outline',          cat: 'Technical' },
  { key: 'db',             label: 'Database Console',            icon: 'server',                  cat: 'Technical' },
  { key: 'api',            label: 'API Integrations & Keys',     icon: 'code-working-outline',    cat: 'Technical' },
  { key: 'cinema',         label: 'Media & Cinema Stream',       icon: 'videocam-outline',        cat: 'Technical' },
  { key: 'terminal',       label: 'CLI System Terminal',         icon: 'terminal-outline',        cat: 'Technical' },
  { key: 'features',       label: 'System Feature Flags',        icon: 'toggle-outline',          cat: 'Technical' },
  { key: 'stores',         label: 'App Store Deployments',       icon: 'logo-apple',              cat: 'Technical' },
  { key: 'files',          label: 'Files & Cloud Storage',       icon: 'folder-open-outline',     cat: 'Technical' },
  { key: 'staff',          label: 'Staff HR & Team Roles',       icon: 'briefcase-outline',       cat: 'Internal' },
  { key: 'voice',          label: 'Voice OS Assistant',          icon: 'mic-outline',             cat: 'Internal' },
  { key: 'legal',          label: 'Legal & Compliance',          icon: 'document-text-outline',   cat: 'Internal' },
  { key: 'team',           label: 'Team Internal Chat',          icon: 'people-circle-outline',   cat: 'Internal' },
  { key: 'academy',        label: 'Academy & Training',          icon: 'school-outline',          cat: 'Internal' },
  { key: 'appearance',     label: 'Theme & Appearance',          icon: 'color-palette-outline',   cat: 'Internal' },
  { key: 'automation',     label: 'Workflow Automation',         icon: 'flash-outline',           cat: 'Internal' },
  { key: 'kanban',         label: 'Kanban Task Board',           icon: 'grid-outline',            cat: 'Internal' },
  { key: 'security',       label: 'Security & 2FA Hub',          icon: 'shield-checkmark-outline',cat: 'RedZone' },
  { key: 'forensics',      label: 'Digital Forensics',           icon: 'finger-print-outline',    cat: 'RedZone' },
  { key: 'secrets',        label: 'API Secrets Vault',           icon: 'key-outline',             cat: 'RedZone' },
  { key: 'logs',           label: 'System Audit Logs',           icon: 'list-outline',            cat: 'RedZone' },
  { key: 'map',            label: 'User Geography Map',          icon: 'earth-outline',           cat: 'RedZone' },
  { key: 'settings',       label: 'App System Settings',         icon: 'settings-outline',        cat: 'RedZone' },
  { key: 'panic',          label: 'Panic Room Emergency',        icon: 'warning-outline',         cat: 'RedZone' },
];

const KNOWN_FEATURES = [
  { key: 'feature_wallet_funding', label: 'Wallet Funding',       icon: 'wallet' },
  { key: 'feature_transfer',       label: 'Fund Transfers',        icon: 'swap-horizontal' },
  { key: 'feature_airtime',        label: 'Airtime Top-up',        icon: 'phone-portrait' },
  { key: 'feature_data',           label: 'Data Bundles',          icon: 'wifi' },
  { key: 'feature_smile',          label: 'Smile Data',            icon: 'globe' },
  { key: 'feature_bills',          label: 'Cable TV & Bills',      icon: 'tv' },
  { key: 'feature_education',      label: 'Education',             icon: 'school' },
  { key: 'feature_cards',          label: 'Virtual Cards',         icon: 'card' },
  { key: 'feature_savings',        label: 'Savings',               icon: 'leaf' },
  { key: 'feature_invest',         label: 'Investments',           icon: 'trending-up' },
  { key: 'feature_loans',          label: 'Loans',                 icon: 'cash' },
  { key: 'feature_crypto',         label: 'Crypto Trading',        icon: 'logo-bitcoin' },
  { key: 'feature_insurance',      label: 'Insurance',             icon: 'shield-checkmark' },
  { key: 'feature_bvn',            label: 'BVN Verification',      icon: 'finger-print' },
  { key: 'feature_nin',            label: 'NIN Registration',      icon: 'person-add' },
  { key: 'feature_cac',            label: 'CAC Registration',      icon: 'briefcase' },
  { key: 'feature_kyc',            label: 'KYC Upgrades',          icon: 'id-card' },
  { key: 'feature_social',         label: 'Social Boost',          icon: 'rocket' },
  { key: 'feature_analytics',      label: 'Analytics',             icon: 'pie-chart' },
  { key: 'feature_rewards',        label: 'Rewards',               icon: 'gift' },
  { key: 'feature_referral',       label: 'Referrals Program',     icon: 'people' },
  { key: 'feature_support',        label: 'Customer Support',      icon: 'headset' },
  { key: 'feature_qr',             label: 'QR Pay',                icon: 'qr-code' },
  { key: 'feature_bulk_sms',       label: 'Bulk SMS',              icon: 'chatbubbles' },
];

interface FeatureFlag {
  feature_key: string;
  label: string;
  is_enabled: boolean;
  maintenance_message: string;
}

interface ServiceCustom {
  service_id:       string;
  custom_label:     string | null;
  custom_icon:      string | null;
  custom_color:     string | null;
  custom_badge:     string | null;
  custom_bg_style?: 'tint' | 'white' | 'gold' | 'navy';
  is_visible:       boolean;
}

export default function ManageFeaturesScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'services' | 'app_features' | 'admin_locks'>('services');
  const [userRole, setUserRole]   = useState('admin');
  const [loading, setLoading]     = useState(true);

  // TAB 1 — Dashboard Services
  const [serviceCustoms, setServiceCustoms] = useState<Record<string, ServiceCustom>>({});
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editLabel, setEditLabel]           = useState('');
  const [editIcon, setEditIcon]             = useState('');
  const [editColor, setEditColor]           = useState('');
  const [editBadge, setEditBadge]           = useState<string | null>(null);
  const [editBgStyle, setEditBgStyle]       = useState<'tint' | 'white' | 'gold' | 'navy'>('tint');
  const [savingSvc, setSavingSvc]           = useState(false);

  // TAB 2 — App Feature Flags
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editMsg, setEditMsg]   = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');

  // TAB 3 — Admin Locks
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);

  useEffect(() => {
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
    } catch (e) {
      console.error('Features loading error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Service Customizations ──────────────────────────────────────────────────
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
    return serviceCustoms[id] || {
      service_id: id,
      custom_label: null,
      custom_icon: null,
      custom_color: null,
      custom_badge: null,
      custom_bg_style: 'tint',
      is_visible: true,
    };
  };

  const openEditService = (id: string) => {
    const svc  = DASHBOARD_SERVICES.find(s => s.id === id)!;
    const cust = getServiceCustom(id);
    setEditingService(id);
    setEditLabel(cust.custom_label ?? svc.defaultLabel);
    setEditIcon(cust.custom_icon ?? svc.defaultIcon);
    setEditColor(cust.custom_color ?? svc.defaultColor);
    setEditBadge(cust.custom_badge !== undefined ? cust.custom_badge : (svc.defaultBadge ?? null));
    setEditBgStyle(cust.custom_bg_style ?? 'white');
  };

  const saveServiceEdit = async () => {
    if (!editingService) return;
    setSavingSvc(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const svc = DASHBOARD_SERVICES.find(s => s.id === editingService)!;
    const updated = {
      ...serviceCustoms,
      [editingService]: {
        service_id:      editingService,
        custom_label:    editLabel.trim() !== svc.defaultLabel ? editLabel.trim() : null,
        custom_icon:     editIcon !== svc.defaultIcon ? editIcon : null,
        custom_color:    editColor !== svc.defaultColor ? editColor : null,
        custom_badge:    editBadge ? editBadge.trim() : null,
        custom_bg_style: editBgStyle,
        is_visible:      getServiceCustom(editingService).is_visible,
      },
    };
    await saveServiceCustoms(updated);
    setSavingSvc(false);
    setEditingService(null);
  };

  const toggleServiceVisible = async (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cur = getServiceCustom(id);
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
        maintenance_message: 'This service is currently undergoing routine maintenance.',
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
    if (!error) {
      setFeatures(features.map(f => f.feature_key === feature.feature_key ? { ...f, is_enabled: nv } : f));
    }
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
      return Alert.alert('Access Restricted', 'Only Super Admin can hide or show admin modules.');
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = hiddenModules.includes(key) ? hiddenModules.filter(k => k !== key) : [...hiddenModules, key];
    setHiddenModules(updated);
    await supabase.from('app_settings').upsert({ key: 'hidden_admin_modules', value: JSON.stringify(updated) }, { onConflict: 'key' });
  };

  const getIconForFeature = (key: string) => KNOWN_FEATURES.find(f => f.key === key)?.icon || 'construct-outline';

  // ── Render Service Edit Modal ───────────────────────────────────────────────
  const renderEditModal = () => {
    if (!editingService) return null;
    const svc = DASHBOARD_SERVICES.find(s => s.id === editingService)!;

    // Computed preview style
    let previewBoxBg = editColor + '15';
    let previewBoxBorder = editColor + '30';
    let previewIconColor = editColor;

    if (editBgStyle === 'white') {
      previewBoxBg = '#FFFFFF';
      previewBoxBorder = '#E2E8F0';
    } else if (editBgStyle === 'gold') {
      previewBoxBg = C.goldL;
      previewBoxBorder = C.goldBorder;
    } else if (editBgStyle === 'navy') {
      previewBoxBg = C.navy;
      previewBoxBorder = C.navyMid;
      previewIconColor = C.gold;
    }

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setEditingService(null)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            {/* Modal Header */}
            <View style={m.sheetHead}>
              <View style={m.sheetHeadLeft}>
                <View style={[m.previewIcon, { backgroundColor: previewBoxBg, borderColor: previewBoxBorder }]}>
                  <Ionicons name={editIcon as any} size={22} color={previewIconColor} />
                </View>
                <View>
                  <Text style={m.sheetTitle}>Customize Service</Text>
                  <Text style={m.sheetSub}>{svc.id.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditingService(null)} style={m.closeBtn}>
                <Ionicons name="close" size={18} color={C.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
              
              {/* 1. Live Interactive Preview */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>Dashboard Appearance Preview</Text>
                <View style={m.previewCard}>
                  <View style={[m.previewIconBox, { backgroundColor: '#FFFFFF', borderColor: editColor + '45' }]}>
                    <Ionicons name={editIcon as any} size={26} color={editColor} />
                    {editBadge ? (
                      <View style={[m.previewBadge, { backgroundColor: editColor }]}>
                        <Text style={m.previewBadgeText}>{editBadge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={m.previewLabel} numberOfLines={1}>{editLabel || svc.defaultLabel}</Text>
                </View>
              </View>

              {/* 2. Service Name Input */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>Service Name</Text>
                <TextInput
                  style={m.input}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder={svc.defaultLabel}
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                />
                <TouchableOpacity onPress={() => setEditLabel(svc.defaultLabel)} style={m.resetBtn}>
                  <Text style={m.resetBtnText}>Reset to default name</Text>
                </TouchableOpacity>
              </View>

              {/* 3. Icon Selection */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>Choose Icon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.iconRow}>
                  {AVAILABLE_ICONS.map(ic => {
                    const isSelected = editIcon === ic;
                    return (
                      <TouchableOpacity
                        key={ic}
                        style={[m.iconSelectBtn, isSelected && m.iconSelectBtnSel]}
                        onPress={() => setEditIcon(ic)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={ic as any} size={18} color={isSelected ? C.navy : C.sub} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 4. Icon Theme Color */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>Theme Color</Text>
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

              {/* 5. Background Style Tint */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>Icon Card Background</Text>
                <View style={m.bgStyleGrid}>
                  {BG_STYLES.map(bs => {
                    const isSel = editBgStyle === bs.id;
                    return (
                      <TouchableOpacity
                        key={bs.id}
                        style={[m.bgStyleCard, isSel && m.bgStyleCardSel]}
                        onPress={() => setEditBgStyle(bs.id as any)}
                        activeOpacity={0.75}
                      >
                        <Text style={[m.bgStyleTitle, isSel && m.bgStyleTitleSel]}>{bs.label}</Text>
                        <Text style={m.bgStyleDesc}>{bs.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 6. Badge Tag */}
              <View style={m.field}>
                <Text style={m.fieldLabel}>Tag Badge (e.g. HOT, NEW, PRO)</Text>
                <TextInput
                  style={[m.input, { marginBottom: 8 }]}
                  value={editBadge || ''}
                  onChangeText={(txt) => setEditBadge(txt.toUpperCase().slice(0, 10))}
                  placeholder="Custom Badge (or pick below)..."
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                  autoCapitalize="characters"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.badgeRow}>
                  {BADGE_PRESETS.map(bp => {
                    const isSelected = bp === 'NONE' ? !editBadge : editBadge === bp;
                    return (
                      <TouchableOpacity
                        key={bp}
                        style={[m.badgeChip, isSelected && m.badgeChipSel]}
                        onPress={() => setEditBadge(bp === 'NONE' ? null : bp)}
                        activeOpacity={0.75}
                      >
                        <Text style={[m.badgeChipText, isSelected && m.badgeChipTextSel]}>{bp}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity style={m.saveBtn} onPress={saveServiceEdit} activeOpacity={0.85} disabled={savingSvc}>
              <LinearGradient colors={[C.navy, C.navyMid]} style={m.saveBtnGrad}>
                {savingSvc ? (
                  <ActivityIndicator color={C.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color={C.gold} />
                    <Text style={m.saveBtnText}>Apply & Save Changes</Text>
                  </>
                )}
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
              <Text style={s.headerSub}>Dashboard Control Center</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Gold Trim Line */}
          <View style={s.goldTrim} />

          {/* Clean Segment Tabs */}
          <View style={s.tabsRow}>
            {([
              { id: 'services',    label: 'Dashboard Services', icon: 'grid-outline' },
              { id: 'app_features',label: 'Feature Flags',      icon: 'toggle-outline' },
              { id: 'admin_locks', label: 'Admin Security',     icon: 'shield-outline' },
            ] as const).map(tab => {
              const isSel = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[s.tabPill, isSel && s.tabPillSel]}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={tab.icon as any} size={13} color={isSel ? C.navy : 'rgba(255,255,255,0.7)'} style={{ marginRight: 4 }} />
                  <Text style={[s.tabText, isSel && s.tabTextSel]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={{ color: C.sub, marginTop: 10, fontWeight: '700', fontSize: 12 }}>Loading Settings...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 1: USER DASHBOARD SERVICE CUSTOMIZER
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'services' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              {/* Clean Notice */}
              <View style={s.infoBanner}>
                <View style={s.infoBannerRow}>
                  <Ionicons name="color-wand-outline" size={16} color={C.gold} />
                  <Text style={s.infoBannerTitle}>User Dashboard Services</Text>
                </View>
                <Text style={s.infoBannerDesc}>
                  Customize the name, icon, color, background theme, and badge tags for each service.
                  Tap the eye icon to hide or show a service on user screens.
                </Text>
              </View>

              {/* Grid of All Services */}
              <View style={s.svcGrid}>
                {DASHBOARD_SERVICES.map(svc => {
                  const cust    = getServiceCustom(svc.id);
                  const label   = cust.custom_label  || svc.defaultLabel;
                  const icon    = cust.custom_icon   || svc.defaultIcon;
                  const color   = cust.custom_color  || svc.defaultColor;
                  const badge   = cust.custom_badge;
                  const bgStyle = cust.custom_bg_style || 'tint';
                  const visible = cust.is_visible;

                  // Compute card box style
                  let boxBg = color + '15';
                  let boxBorder = color + '30';
                  let iconColor = color;

                  if (bgStyle === 'white') {
                    boxBg = '#FFFFFF';
                    boxBorder = '#E2E8F0';
                  } else if (bgStyle === 'gold') {
                    boxBg = C.goldL;
                    boxBorder = C.goldBorder;
                  } else if (bgStyle === 'navy') {
                    boxBg = C.navy;
                    boxBorder = C.navyMid;
                    iconColor = C.gold;
                  }

                  return (
                    <View key={svc.id} style={[s.svcCard, !visible && s.svcCardHidden]}>
                      <View style={[s.svcAccentBar, { backgroundColor: visible ? color : C.muted }]} />

                      <View style={s.svcCardInner}>
                        {/* Header: Icon + Visibility */}
                        <View style={s.svcCardTop}>
                          <View style={[s.svcIconBox, { backgroundColor: boxBg, borderColor: boxBorder }]}>
                            <Ionicons name={icon as any} size={18} color={visible ? iconColor : C.muted} />
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleServiceVisible(svc.id)}
                            style={[s.eyeBtn, !visible && s.eyeBtnOff]}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={13} color={visible ? C.green : C.muted} />
                          </TouchableOpacity>
                        </View>

                        {/* Title & Tag */}
                        <Text style={[s.svcLabel, !visible && { color: C.muted }]} numberOfLines={1}>{label}</Text>
                        <View style={s.svcFooter}>
                          {badge ? (
                            <View style={[s.svcBadgeChip, { backgroundColor: color }]}>
                              <Text style={s.svcBadgeText}>{badge}</Text>
                            </View>
                          ) : (
                            <Text style={s.svcDefault}>Standard</Text>
                          )}
                        </View>

                        {/* Edit Button */}
                        <TouchableOpacity
                          style={[s.editBtn, { borderColor: color + '50' }]}
                          onPress={() => openEditService(svc.id)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="create-outline" size={12} color={color} />
                          <Text style={[s.editBtnText, { color }]}>Customize</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 2: APP FEATURE FLAGS (SYSTEM TOGGLES)
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'app_features' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[s.infoBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <View style={s.infoBannerRow}>
                  <Ionicons name="options-outline" size={16} color="#2563EB" />
                  <Text style={[s.infoBannerTitle, { color: '#2563EB' }]}>System Feature Locks</Text>
                </View>
                <Text style={s.infoBannerDesc}>
                  Turn system services ON or OFF. When turned off, users attempting to access the service receive the custom maintenance notice.
                </Text>
              </View>

              <View style={s.svcGrid}>
                {features.map(feature => (
                  <View key={feature.feature_key} style={[s.svcCard, !feature.is_enabled && { borderColor: '#FECACA' }]}>
                    <View style={[s.svcAccentBar, { backgroundColor: feature.is_enabled ? C.green : C.red }]} />
                    <View style={s.svcCardInner}>
                      <View style={s.svcCardTop}>
                        <View style={[s.svcIconBox, { backgroundColor: feature.is_enabled ? C.greenL : C.redL, borderColor: feature.is_enabled ? '#86EFAC' : '#FECACA' }]}>
                          <Ionicons name={getIconForFeature(feature.feature_key) as any} size={16} color={feature.is_enabled ? C.green : C.red} />
                        </View>
                        {updating === feature.feature_key ? (
                          <ActivityIndicator size="small" color={C.gold} />
                        ) : (
                          <Switch
                            value={feature.is_enabled}
                            onValueChange={() => toggleFeature(feature)}
                            trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                            thumbColor={C.white}
                            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                          />
                        )}
                      </View>
                      <Text style={s.svcLabel} numberOfLines={1}>{feature.label}</Text>
                      <Text style={s.svcKey} numberOfLines={1}>{feature.feature_key}</Text>

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
                                placeholder="Maintenance notice..."
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
                              <Ionicons name="create-outline" size={11} color={C.red} />
                              <Text style={[s.editBtnText, { color: C.red }]}>Notice</Text>
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

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 3: ADMIN SECURITY & MODULE ACCESS
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'admin_locks' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[s.infoBanner, { backgroundColor: C.goldL, borderColor: C.goldBorder }]}>
                <View style={s.infoBannerRow}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.gold} />
                  <Text style={[s.infoBannerTitle, { color: C.gold }]}>Admin Module Access</Text>
                </View>
                <Text style={s.infoBannerDesc}>
                  Hide or show specific management modules from staff admins. Super Admin always maintains master access.
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
                          <View style={[s.svcIconBox, { backgroundColor: isHidden ? C.redL : C.greenL, borderColor: isHidden ? '#FECACA' : '#86EFAC' }]}>
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
                        <Text style={[s.svcKey, { color: isHidden ? C.red : C.green, fontWeight: '700' }]}>
                          {isHidden ? 'Hidden from Staff' : 'Active'}
                        </Text>
                        <View style={s.catChip}>
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

// ─── Modal Sheet Styles ───────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sheetHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewIcon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 15, fontWeight: '900', color: C.navy },
  sheetSub: { fontSize: 9.5, color: C.muted, fontWeight: '700', marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: C.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
    color: C.navy,
    borderWidth: 1,
    borderColor: C.border,
  },
  resetBtn: { alignSelf: 'flex-end', marginTop: 4 },
  resetBtnText: { fontSize: 10, color: C.muted, fontWeight: '600' },

  // Live preview card
  previewCard: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  previewIconBox: {
    width: 52, height: 52, borderRadius: 16,
    borderWidth: 1.2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6, position: 'relative',
  },
  previewBadge: {
    position: 'absolute', top: -5, right: -6, borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1.5,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  previewBadgeText: { fontSize: 6.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' },
  previewLabel: { fontSize: 12, fontWeight: '800', color: C.navy },

  // Icon selector
  iconRow: { gap: 8, paddingVertical: 4 },
  iconSelectBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconSelectBtnSel: {
    backgroundColor: C.goldL, borderColor: C.goldBorder,
    transform: [{ scale: 1.08 }],
  },

  // Color grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotSel: { borderWidth: 2.5, borderColor: C.navy, transform: [{ scale: 1.15 }] },

  // Background style grid
  bgStyleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bgStyleCard: {
    width: (W - 40 - 8) / 2,
    padding: 10, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  bgStyleCardSel: { backgroundColor: C.goldL, borderColor: C.goldBorder },
  bgStyleTitle: { fontSize: 11, fontWeight: '800', color: C.navy },
  bgStyleTitleSel: { color: C.gold },
  bgStyleDesc: { fontSize: 9, color: C.sub, marginTop: 2 },

  // Badge presets
  badgeRow: { gap: 6, paddingVertical: 2 },
  badgeChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
  },
  badgeChipSel: { backgroundColor: C.navy, borderColor: C.navy },
  badgeChipText: { fontSize: 10, fontWeight: '800', color: C.sub },
  badgeChipTextSel: { color: C.gold },

  // Save button
  saveBtn: { marginTop: 10, borderRadius: 14, overflow: 'hidden' },
  saveBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  saveBtnText: { color: C.gold, fontSize: 14, fontWeight: '900' },
});

// ─── Main Screen Styles ───────────────────────────────────────────────────────
const SVC_W = (W - 32 - 10) / 2;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingBottom: 12,
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
  headerTitle: { fontSize: 15, fontWeight: '900', color: C.white, letterSpacing: 0.3 },
  headerSub: { fontSize: 9.5, color: 'rgba(245,158,11,0.85)', fontWeight: '700', marginTop: 1 },
  goldTrim: { height: 2, backgroundColor: C.gold, marginTop: 10 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  tabPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  tabPillSel: { backgroundColor: C.gold, borderColor: C.gold },
  tabText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  tabTextSel: { color: C.navy },

  // Notice Banner
  infoBanner: {
    borderRadius: 14, padding: 12,
    backgroundColor: C.goldL,
    borderWidth: 1, borderColor: C.goldBorder,
    marginBottom: 14,
  },
  infoBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoBannerTitle: { fontSize: 11.5, fontWeight: '900', color: C.gold },
  infoBannerDesc: { fontSize: 10, color: C.sub, lineHeight: 14 },

  // Grid
  svcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  svcCard: {
    width: SVC_W,
    backgroundColor: C.white,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  svcCardHidden: { opacity: 0.5 },
  svcAccentBar: { height: 3, width: '100%' },
  svcCardInner: { padding: 10 },
  svcCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  svcIconBox: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  eyeBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.greenL,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#86EFAC',
  },
  eyeBtnOff: { backgroundColor: C.bg, borderColor: C.border },
  svcLabel: { fontSize: 11, fontWeight: '800', color: C.navy, marginBottom: 2 },
  svcKey: { fontSize: 8.5, color: C.muted, fontWeight: '500', marginBottom: 4 },
  svcFooter: { marginBottom: 8, minHeight: 16 },
  svcBadgeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
  },
  svcBadgeText: { fontSize: 7.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' },
  svcDefault: { fontSize: 8.5, color: C.muted, fontWeight: '500' },
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
  editBtnText: { fontSize: 9.5, fontWeight: '800' },

  catChip: {
    alignSelf: 'flex-start',
    backgroundColor: C.goldL,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginTop: 4,
  },
  catChipText: { fontSize: 7.5, fontWeight: '800', color: C.gold },

  msgInput: {
    backgroundColor: C.bg, borderRadius: 8,
    padding: 8, fontSize: 10.5,
    borderWidth: 1, borderColor: C.border,
    color: C.navy, minHeight: 48,
    textAlignVertical: 'top',
  },
  cancelBtn: { flex: 1, paddingVertical: 5, alignItems: 'center', borderRadius: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  cancelBtnTxt: { fontSize: 9.5, fontWeight: '700', color: C.sub },
  saveSmBtn: { flex: 1, paddingVertical: 5, alignItems: 'center', borderRadius: 6, backgroundColor: C.navy },
  saveSmBtnTxt: { fontSize: 9.5, fontWeight: '800', color: C.gold },
});
