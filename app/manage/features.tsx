import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, StyleSheet, Platform, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Known features map
const KNOWN_FEATURES = [
    { key: 'feature_wallet_funding', label: 'Wallet Funding', icon: 'wallet' },
    { key: 'feature_transfer', label: 'Fund Transfers', icon: 'swap-horizontal' },
    { key: 'feature_airtime', label: 'Airtime Top-up', icon: 'phone-portrait' },
    { key: 'feature_data', label: 'Data Bundles', icon: 'wifi' },
    { key: 'feature_smile', label: 'Smile Data', icon: 'globe' },
    { key: 'feature_bills', label: 'Cable TV & Bills', icon: 'tv' },
    { key: 'feature_education', label: 'Education (WAEC/NECO)', icon: 'school' },
    { key: 'feature_cards', label: 'Virtual Cards', icon: 'card' },
    { key: 'feature_savings', label: 'Savings', icon: 'leaf' },
    { key: 'feature_invest', label: 'Investments', icon: 'trending-up' },
    { key: 'feature_loans', label: 'Loans', icon: 'cash' },
    { key: 'feature_crypto', label: 'Crypto Trading', icon: 'logo-bitcoin' },
    { key: 'feature_insurance', label: 'Insurance', icon: 'shield-checkmark' },
    { key: 'feature_bvn', label: 'BVN Verification', icon: 'finger-print' },
    { key: 'feature_nin', label: 'NIN Registration', icon: 'person-add' },
    { key: 'feature_cac', label: 'CAC Registration', icon: 'briefcase' },
    { key: 'feature_kyc', label: 'KYC Upgrades', icon: 'id-card' },
    { key: 'feature_social', label: 'Social Boost', icon: 'rocket' },
    { key: 'feature_analytics', label: 'Analytics', icon: 'pie-chart' },
    { key: 'feature_rewards', label: 'Rewards', icon: 'gift' },
    { key: 'feature_referral', label: 'Referrals Program', icon: 'people' },
    { key: 'feature_support', label: 'Customer Support', icon: 'headset' },
    { key: 'feature_qr', label: 'QR Pay', icon: 'qr-code' },
    { key: 'feature_api', label: 'API Services', icon: 'code-slash' },
    { key: 'feature_biometrics', label: 'Biometrics', icon: 'finger-print' },
    { key: 'feature_forensics', label: 'Forensics', icon: 'search' },
    { key: 'feature_wealth', label: 'Wealth', icon: 'briefcase' },
    { key: 'feature_automation', label: 'Automation', icon: 'cog' },
    { key: 'feature_bulk_sms', label: 'Bulk SMS', icon: 'chatbubbles' }
];

interface FeatureFlag {
    feature_key: string;
    label: string;
    is_enabled: boolean;
    maintenance_message: string;
}

const ADMIN_LOCKABLE_MODULES = [
    // Operations & Core
    { key: 'users', label: 'Users Management', icon: 'people-outline', cat: 'Operations' },
    { key: 'transactions', label: 'Transactions & Receipts', icon: 'receipt-outline', cat: 'Operations' },
    { key: 'kyc', label: 'KYC Queue & Upgrades', icon: 'scan-outline', cat: 'Operations' },
    { key: 'nin_pricing', label: 'NIN & Services Pricing', icon: 'pricetag-outline', cat: 'Operations' },
    { key: 'smm_pricing', label: 'SMM Services Pricing', icon: 'thumbs-up-outline', cat: 'Operations' },
    { key: 'bills_pricing', label: 'Bills & Utilities Pricing', icon: 'flash-outline', cat: 'Operations' },
    { key: 'cac', label: 'CAC Business Management', icon: 'briefcase-outline', cat: 'Operations' },
    { key: 'tickets', label: 'Help Desk & Support Tickets', icon: 'chatbubbles-outline', cat: 'Operations' },
    { key: 'cms', label: 'Content & CMS', icon: 'images-outline', cat: 'Operations' },
    { key: 'data_plans', label: 'Data Bundles & Plans', icon: 'wifi-outline', cat: 'Operations' },
    { key: 'airtime', label: 'Airtime Top-up', icon: 'call-outline', cat: 'Operations' },
    { key: 'localization', label: 'Localization & Languages', icon: 'language-outline', cat: 'Operations' },
    { key: 'bulk_sms', label: 'Bulk SMS Messaging', icon: 'chatbubbles-outline', cat: 'Operations' },
    { key: 'reviews', label: 'Customer Reviews Control', icon: 'star-outline', cat: 'Operations' },

    // Banking & Assets
    { key: 'cards', label: 'Virtual Cards Management', icon: 'card-outline', cat: 'Banking' },
    { key: 'lending', label: 'Loans & Lending', icon: 'cash-outline', cat: 'Banking' },
    { key: 'wealth', label: 'Wealth & Investments', icon: 'briefcase-outline', cat: 'Banking' },
    { key: 'liquidity', label: 'Liquidity Vault', icon: 'water-outline', cat: 'Banking' },
    { key: 'rates', label: 'Exchange Rates', icon: 'trending-up-outline', cat: 'Banking' },

    // Markets & Analytics
    { key: 'risk', label: 'Risk Assessment', icon: 'alert-circle-outline', cat: 'Finance' },
    { key: 'reports', label: 'Analytics & Financial Reports', icon: 'bar-chart-outline', cat: 'Finance' },
    { key: 'communications', label: 'Broadcast Communications', icon: 'megaphone-outline', cat: 'Finance' },
    { key: 'ai', label: 'Cortex AI Console', icon: 'sparkles-outline', cat: 'Finance' },
    { key: 'crypto', label: 'Crypto Assets Management', icon: 'logo-bitcoin', cat: 'Finance' },

    // Technical Infrastructure
    { key: 'infrastructure', label: 'Server Infrastructure', icon: 'server-outline', cat: 'Technical' },
    { key: 'db', label: 'Database Console', icon: 'server', cat: 'Technical' },
    { key: 'api', label: 'API Integrations & Keys', icon: 'code-working-outline', cat: 'Technical' },
    { key: 'cinema', label: 'Media & Cinema Stream', icon: 'videocam-outline', cat: 'Technical' },
    { key: 'terminal', label: 'CLI System Terminal', icon: 'terminal-outline', cat: 'Technical' },
    { key: 'features', label: 'System Feature Flags', icon: 'toggle-outline', cat: 'Technical' },
    { key: 'stores', label: 'App Store Deployments', icon: 'logo-apple', cat: 'Technical' },
    { key: 'files', label: 'Files & Cloud Storage', icon: 'folder-open-outline', cat: 'Technical' },

    // Internal Affairs
    { key: 'staff', label: 'Staff HR & Team Roles', icon: 'briefcase-outline', cat: 'Internal' },
    { key: 'voice', label: 'Voice OS Assistant', icon: 'mic-outline', cat: 'Internal' },
    { key: 'legal', label: 'Legal & Compliance', icon: 'document-text-outline', cat: 'Internal' },
    { key: 'team', label: 'Team Internal Chat', icon: 'people-circle-outline', cat: 'Internal' },
    { key: 'academy', label: 'Academy & Training', icon: 'school-outline', cat: 'Internal' },
    { key: 'appearance', label: 'Theme & Appearance', icon: 'color-palette-outline', cat: 'Internal' },
    { key: 'automation', label: 'Workflow Automation', icon: 'flash-outline', cat: 'Internal' },
    { key: 'kanban', label: 'Kanban Task Board', icon: 'grid-outline', cat: 'Internal' },

    // Security & RedZone
    { key: 'security', label: 'Security & 2FA Hub', icon: 'shield-checkmark-outline', cat: 'RedZone' },
    { key: 'forensics', label: 'Digital Forensics', icon: 'finger-print-outline', cat: 'RedZone' },
    { key: 'secrets', label: 'API Secrets Vault', icon: 'key-outline', cat: 'RedZone' },
    { key: 'logs', label: 'System Audit Logs', icon: 'list-outline', cat: 'RedZone' },
    { key: 'map', label: 'User Geography Map', icon: 'earth-outline', cat: 'RedZone' },
    { key: 'settings', label: 'App System Settings', icon: 'settings-outline', cat: 'RedZone' },
    { key: 'panic', label: 'PANIC ROOM Emergency Lock', icon: 'warning-outline', cat: 'RedZone' },
];

export default function ManageFeaturesScreen() {
    const [features, setFeatures] = useState<FeatureFlag[]>([]);
    const [hiddenModules, setHiddenModules] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>('admin');
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [editMessage, setEditMessage] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [activeTab, setActiveTab] = useState<'app_features' | 'admin_locks'>('admin_locks');
    const router = useRouter();

    useEffect(() => {
        fetchFeatures();
        fetchHiddenAdminModules();
    }, []);

    const fetchHiddenAdminModules = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (profile?.role) setUserRole(profile.role);
            }

            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'hidden_admin_modules')
                .single();

            if (data?.value) {
                const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                if (Array.isArray(parsed)) setHiddenModules(parsed);
            }
        } catch (e) {
            console.log('Error fetching hidden modules:', e);
        }
    };

    const toggleHideModule = async (moduleKey: string) => {
        if (userRole !== 'super_admin') {
            return Alert.alert('Access Restricted 🔒', 'Only Super Admin can hide or show feature modules for staff admins.');
        }

        try {
            let updatedList: string[];
            if (hiddenModules.includes(moduleKey)) {
                updatedList = hiddenModules.filter(k => k !== moduleKey);
            } else {
                updatedList = [...hiddenModules, moduleKey];
            }

            setHiddenModules(updatedList);

            await supabase.from('app_settings').upsert({
                key: 'hidden_admin_modules',
                value: JSON.stringify(updatedList)
            }, { onConflict: 'key' });

            const actionLabel = updatedList.includes(moduleKey) ? 'HIDDEN from Staff Admins 🙈' : 'MADE VISIBLE to Staff Admins 👁️';
            Alert.alert('Module Access Updated 👑', `Module "${moduleKey.toUpperCase()}" is now ${actionLabel}`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const fetchFeatures = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('feature_flags')
            .select('*')
            .order('label');

        if (error) {
            Alert.alert('Error', 'Failed to load feature flags');
            console.error(error);
            setLoading(false);
            return;
        }

        // Auto-initialize missing features
        const existingKeys = data ? data.map(f => f.feature_key) : [];
        const missingFeatures = KNOWN_FEATURES.filter(f => !existingKeys.includes(f.key));

        if (missingFeatures.length > 0) {
            const newInserts = missingFeatures.map(f => ({
                feature_key: f.key,
                label: f.label,
                is_enabled: true,
                maintenance_message: 'This feature is currently under maintenance.'
            }));
            
            await supabase.from('feature_flags').insert(newInserts);
            
            // Re-fetch after inserting
            const { data: updatedData } = await supabase.from('feature_flags').select('*').order('label');
            if (updatedData) setFeatures(updatedData);
        } else {
            setFeatures(data || []);
        }

        setLoading(false);
    };

    const toggleFeature = async (feature: FeatureFlag) => {
        setUpdating(feature.feature_key);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const newValue = !feature.is_enabled;

        const { error } = await supabase
            .from('feature_flags')
            .update({ is_enabled: newValue })
            .eq('feature_key', feature.feature_key);

        if (error) {
            Alert.alert('Error', 'Failed to update feature status');
        } else {
            setFeatures(features.map(f => 
                f.feature_key === feature.feature_key ? { ...f, is_enabled: newValue } : f
            ));
        }
        setUpdating(null);
    };

    const saveMessage = async (feature_key: string) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const { error } = await supabase
            .from('feature_flags')
            .update({ maintenance_message: messageInput })
            .eq('feature_key', feature_key);

        if (error) {
            Alert.alert('Error', 'Failed to save message');
        } else {
            setFeatures(features.map(f => 
                f.feature_key === feature_key ? { ...f, maintenance_message: messageInput } : f
            ));
            setEditMessage(null);
        }
    };

    const getIconForFeature = (key: string) => {
        const found = KNOWN_FEATURES.find(f => f.key === key);
        return found ? found.icon : 'construct-outline';
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Premium Header */}
            <LinearGradient colors={['#060d21', '#121F42']} style={s.header}>
                <SafeAreaView edges={['top']}>
                    <View style={s.headerContent}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={s.headerScreenTitle}>Maintenance</Text>
                            <Text style={s.headerScreenSubtitle}>Manage System Features</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>
            
            <ScrollView style={s.scrollView} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Tab Selector */}
                <View style={{ flexDirection: 'row', backgroundColor: '#ffffff', padding: 4, borderRadius: 16, marginBottom: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('admin_locks')}
                        style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'admin_locks' ? '#fffbeb' : 'transparent', borderWidth: activeTab === 'admin_locks' ? 1 : 0, borderColor: '#fde68a' }}
                    >
                        <Text style={{ fontWeight: '900', fontSize: 12, color: activeTab === 'admin_locks' ? '#d97706' : '#64748b' }}>👑 ADMIN MODULE LOCKS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setActiveTab('app_features')}
                        style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'app_features' ? '#eff6ff' : 'transparent', borderWidth: activeTab === 'app_features' ? 1 : 0, borderColor: '#bfdbfe' }}
                    >
                        <Text style={{ fontWeight: '900', fontSize: 12, color: activeTab === 'app_features' ? '#2563eb' : '#64748b' }}>⚙️ USER APP FEATURES</Text>
                    </TouchableOpacity>
                </View>

                {/* 👑 TAB 1: ADMIN MODULE HIDING MATRIX */}
                {activeTab === 'admin_locks' && (
                    <View style={{ marginBottom: 20 }}>
                        <View style={{ backgroundColor: '#fffbeb', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#fde68a', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Ionicons name="eye-off-outline" size={18} color="#d97706" />
                                <Text style={{ fontWeight: '900', fontSize: 12, color: '#d97706' }}>SUPER ADMIN MODULE HIDING CONTROL</Text>
                            </View>
                            <Text style={{ color: '#475569', fontSize: 12, lineHeight: 16 }}>
                                Toggle switches below to HIDE or SHOW specific modules from normal Staff Admins. When a module is HIDDEN, normal staff admins will NOT see or have access to it on their dashboard. Super Admin always retains master key access.
                            </Text>
                        </View>

                        <View style={s.listContainer}>
                            {ADMIN_LOCKABLE_MODULES.map((mod) => {
                                const isHidden = hiddenModules.includes(mod.key);
                                return (
                                    <View key={mod.key} style={[s.card, isHidden && { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                                        <View style={s.cardHeader}>
                                            <View style={s.cardHeaderTop}>
                                                <View style={[s.cardIconBox, isHidden && { backgroundColor: '#fee2e2' }]}>
                                                    <Ionicons name={mod.icon as any} size={16} color={isHidden ? '#ef4444' : '#0d1b3e'} />
                                                </View>
                                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                    <Text style={[s.cardTitle, isHidden && { color: '#ef4444' }]}>{mod.label}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: isHidden ? '#ef4444' : '#10b981', marginTop: 2 }}>
                                                        {isHidden ? 'HIDDEN FROM STAFF ADMINS 🙈' : 'VISIBLE TO STAFF ADMINS 👁️'}
                                                    </Text>
                                                </View>
                                                <Switch
                                                    trackColor={{ false: "#22c55e", true: "#ef4444" }}
                                                    thumbColor="#fff"
                                                    ios_backgroundColor="#22c55e"
                                                    style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                                                    onValueChange={() => toggleHideModule(mod.key)}
                                                    value={isHidden}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* TAB 2: USER APP SYSTEM FEATURES */}
                {activeTab === 'app_features' && (
                    <>
                        <View style={s.introBanner}>
                            <Ionicons name="construct" size={24} color="#0d1b3e" style={{ marginBottom: 4 }} />
                            <Text style={s.introTitle}>User App Feature Flags</Text>
                            <Text style={s.introDesc}>
                                Toggle features ON/OFF to restrict mobile app users. When a feature is OFF, users will see the maintenance message.
                            </Text>
                        </View>

                        {loading ? (
                            <View style={{ marginTop: 40 }}>
                                <ActivityIndicator size="large" color="#0d1b3e" />
                            </View>
                        ) : (
                            <View style={s.listContainer}>
                                {features.map((feature) => (
                            <View key={feature.feature_key} style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={s.cardHeaderTop}>
                                        <View style={s.cardIconBox}>
                                            <Ionicons name={getIconForFeature(feature.feature_key) as any} size={14} color="#0d1b3e" />
                                        </View>
                                        <View style={s.cardAction}>
                                            {updating === feature.feature_key ? (
                                                <ActivityIndicator color="#0d1b3e" size="small" />
                                            ) : (
                                                <Switch
                                                    trackColor={{ false: "#e2e8f0", true: "#22c55e" }}
                                                    thumbColor="#fff"
                                                    ios_backgroundColor="#e2e8f0"
                                                    style={{ transform: [{ scaleX: 0.65 }, { scaleY: 0.65 }] }}
                                                    onValueChange={() => toggleFeature(feature)}
                                                    value={feature.is_enabled}
                                                />
                                            )}
                                        </View>
                                    </View>
                                    <View style={s.cardInfo}>
                                        <Text style={s.cardTitle} numberOfLines={1}>{feature.label}</Text>
                                        <Text style={s.cardSubtitle} numberOfLines={1}>{feature.feature_key}</Text>
                                    </View>
                                </View>

                                {/* Maintenance Message Section */}
                                {!feature.is_enabled && (
                                    <View style={s.messageBox}>
                                        <View style={s.messageHeader}>
                                            <Ionicons name="information-circle" size={16} color="#ef4444" />
                                            <Text style={s.messageLabel}>Maintenance Message</Text>
                                            {editMessage !== feature.feature_key && (
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setEditMessage(feature.feature_key);
                                                        setMessageInput(feature.maintenance_message || '');
                                                    }}
                                                    style={s.editBtn}
                                                >
                                                    <Text style={s.editBtnTxt}>Edit</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        
                                        {editMessage === feature.feature_key ? (
                                            <View style={s.editContainer}>
                                                <TextInput
                                                    style={s.input}
                                                    value={messageInput}
                                                    onChangeText={setMessageInput}
                                                    multiline
                                                />
                                                <View style={s.editActions}>
                                                    <TouchableOpacity onPress={() => setEditMessage(null)} style={s.cancelBtn}>
                                                        <Text style={s.cancelBtnTxt}>Cancel</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => saveMessage(feature.feature_key)} style={s.saveBtn}>
                                                        <Text style={s.saveBtnTxt}>Save</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <Text style={s.messageText}>
                                                {feature.maintenance_message || 'This feature is currently under maintenance.'}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </>
        )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollView: { flex: 1 },
    header: {
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
    },
    backBtn: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)'
    },
    headerScreenTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
    headerScreenSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    
    introBanner: {
        padding: 20,
        backgroundColor: '#e0e7ff',
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    introTitle: { fontSize: 18, fontWeight: '800', color: '#0d1b3e', marginBottom: 4 },
    introDesc: { fontSize: 13, color: '#312e81', lineHeight: 18 },
    
    listContainer: { paddingHorizontal: 16, marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        width: '48%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    cardHeader: { flexDirection: 'column' },
    cardHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardIconBox: {
        width: 28, height: 28,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center', justifyContent: 'center'
    },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
    cardSubtitle: { fontSize: 12, color: '#64748b' },
    cardAction: { marginRight: -6 },
    
    messageBox: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    messageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    messageLabel: { fontSize: 12, fontWeight: '600', color: '#ef4444', marginLeft: 6, flex: 1 },
    editBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 4 },
    editBtnTxt: { fontSize: 12, fontWeight: '600', color: '#0d1b3e' },
    messageText: { fontSize: 12, color: '#475569', lineHeight: 18, backgroundColor: '#fef2f2', padding: 8, borderRadius: 6 },
    
    editContainer: { marginTop: 4 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#0f172a',
        minHeight: 80,
        textAlignVertical: 'top'
    },
    editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
    cancelBtnTxt: { color: '#64748b', fontWeight: '600' },
    saveBtn: { backgroundColor: '#0d1b3e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    saveBtnTxt: { color: '#fff', fontWeight: '600' }
});
