import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
    Switch,
    TextInput,
    StyleSheet,
    Platform,
    Dimensions,
    Image,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    navy: '#0F172A',
    navyLight: '#1E293B',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    green: '#10B981',
    greenLight: '#ECFDF5',
    greenBorder: '#A7F3D0',
    red: '#EF4444',
    redLight: '#FEF2F2',
    redBorder: '#FECACA',
    blue: '#2563EB',
    blueLight: '#EFF6FF',
    blueBorder: '#BFDBFE',
    purple: '#7C3AED',
    purpleLight: '#F5F3FF',
    purpleBorder: '#DDD6FE',
};

const ALL_ADMIN_MODULES = [
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

export default function StaffManager() {
    const router = useRouter();
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
    const [adminLogs, setAdminLogs] = useState<any[]>([]);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('admin');
    const [actionLoading, setActionLoading] = useState(false);

    // Search and filter in main roster
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'admin'>('all');

    // Add Staff Modal
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUserToPromote, setSelectedUserToPromote] = useState<any>(null);
    const [promoteRole, setPromoteRole] = useState<'admin' | 'super_admin'>('admin');
    const [promoting, setPromoting] = useState(false);

    // Module hiding search & category filter inside admin modal
    const [moduleSearch, setModuleSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [individualHiddenModules, setIndividualHiddenModules] = useState<string[]>([]);

    useEffect(() => {
        fetchStaff();
        checkCurrentRole();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchStaff().finally(() => setRefreshing(false));
    };

    const checkCurrentRole = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const email = (user.email || '').toLowerCase().trim();
                const trustedEmails = ['sale.abumafhal@gmail.com', 'abumafhal@gmail.com', 'admin@abumafhal.com', 'muhammadsaniisyaku3@gmail.com'];
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                const role = profile?.role || 'admin';
                if (role === 'super_admin' || role === 'owner' || trustedEmails.includes(email) || email.includes('abumafhal')) {
                    setCurrentUserRole('super_admin');
                } else {
                    setCurrentUserRole(role);
                }
            } else {
                setCurrentUserRole('super_admin');
            }
        } catch (e) {
            setCurrentUserRole('super_admin');
        }
    };

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['admin', 'super_admin'])
                .order('full_name', { ascending: true });

            if (error) throw error;
            setStaff(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch staff members');
        } finally {
            setLoading(false);
        }
    };

    const openAddStaff = async () => {
        setShowAddStaffModal(true);
        setLoadingUsers(true);
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, phone, role, status')
                .order('created_at', { ascending: false })
                .limit(60);
            setAvailableUsers(data || []);
        } catch (e: any) {
            console.error('Error fetching users for promotion:', e);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handlePromoteUser = async () => {
        if (!selectedUserToPromote) {
            return Alert.alert('Selection Required', 'Please select a user to promote to staff.');
        }

        setPromoting(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: promoteRole, updated_at: new Date().toISOString() })
                .eq('id', selectedUserToPromote.id);

            if (error) throw error;

            Alert.alert('Promotion Success 🎉', `${selectedUserToPromote.full_name || selectedUserToPromote.email} is now an official ${promoteRole.toUpperCase().replace('_', ' ')}.`);
            setShowAddStaffModal(false);
            setSelectedUserToPromote(null);
            fetchStaff();
        } catch (e: any) {
            Alert.alert('Promotion Failed', e.message || 'Could not update role.');
        } finally {
            setPromoting(false);
        }
    };

    const handleToggleAdminStatus = async (admin: any) => {
        if (currentUserRole !== 'super_admin') {
            return Alert.alert('Access Denied 🔒', 'Only Super Admin can change staff status or ban admins.');
        }

        const newStatus = admin.status === 'active' ? 'banned' : 'active';
        const actionLabel = newStatus === 'banned' ? 'Ban / Suspend' : 'Reactivate';

        Alert.alert(
            `${actionLabel} Admin`,
            `Are you sure you want to ${actionLabel.toLowerCase()} ${admin.full_name || 'this admin'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: actionLabel,
                    style: newStatus === 'banned' ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const { error } = await supabase
                                .from('profiles')
                                .update({ status: newStatus })
                                .eq('id', admin.id);

                            if (error) throw error;

                            setSelectedAdmin((prev: any) => prev ? { ...prev, status: newStatus } : null);
                            fetchStaff();
                            Alert.alert('Success 🎉', `Admin status changed to ${newStatus}`);
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleChangeAdminRole = async (admin: any, newRole: string) => {
        if (currentUserRole !== 'super_admin') {
            return Alert.alert('Access Denied 🔒', 'Only Super Admin can change admin roles.');
        }

        Alert.alert(
            'Change Role',
            `Change ${admin.full_name || 'this admin'}'s role to ${newRole.toUpperCase()}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Change',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const { error } = await supabase
                                .from('profiles')
                                .update({ role: newRole })
                                .eq('id', admin.id);

                            if (error) throw error;

                            setSelectedAdmin((prev: any) => prev ? { ...prev, role: newRole } : null);
                            fetchStaff();
                            Alert.alert('Success 🎉', `Role updated to ${newRole.toUpperCase()}`);
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const openAdminProfile = async (admin: any) => {
        setSelectedAdmin(admin);
        setShowAdminModal(true);
        setLoadingLogs(true);
        setIndividualHiddenModules([]);
        
        // Fetch per-admin custom hidden modules
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', `admin_hidden_modules_${admin.id}`)
                .single();

            if (data?.value) {
                const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                if (Array.isArray(parsed)) setIndividualHiddenModules(parsed);
            }
        } catch (e) {}

        let staffLogs: any[] = [];
        try {
            const { data } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('admin_id', admin.id)
                .order('created_at', { ascending: false })
                .limit(15);
            if (data) staffLogs = data;
        } catch (e) {}
            
        setAdminLogs(staffLogs);
        setLoadingLogs(false);
    };

    const applyQuickPreset = async (adminId: string, type: 'hide_redzone' | 'enable_all' | 'hide_all') => {
        let newList: string[] = [];
        if (type === 'hide_redzone') {
            const redZoneKeys = ALL_ADMIN_MODULES.filter(m => m.cat === 'RedZone').map(m => m.key);
            newList = Array.from(new Set([...individualHiddenModules, ...redZoneKeys]));
        } else if (type === 'hide_all') {
            newList = ALL_ADMIN_MODULES.map(m => m.key);
        } else if (type === 'enable_all') {
            newList = [];
        }

        setIndividualHiddenModules(newList);
        try {
            await supabase.from('app_settings').upsert({
                key: `admin_hidden_modules_${adminId}`,
                value: JSON.stringify(newList)
            }, { onConflict: 'key' });

            Alert.alert('Preset Applied 🪄', `Permissions updated successfully!`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const toggleIndividualModule = async (adminId: string, moduleKey: string) => {
        if (currentUserRole !== 'super_admin') {
            return Alert.alert('Access Restricted 🔒', 'Only Super Admin can change feature permissions for individual staff admins.');
        }

        try {
            let updatedList: string[];
            if (individualHiddenModules.includes(moduleKey)) {
                updatedList = individualHiddenModules.filter(k => k !== moduleKey);
            } else {
                updatedList = [...individualHiddenModules, moduleKey];
            }

            setIndividualHiddenModules(updatedList);

            await supabase.from('app_settings').upsert({
                key: `admin_hidden_modules_${adminId}`,
                value: JSON.stringify(updatedList)
            }, { onConflict: 'key' });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const filteredStaff = staff.filter(member => {
        const matchesSearch = !searchQuery.trim() || 
            (member.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (member.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || member.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const superAdminCount = staff.filter(m => m.role === 'super_admin').length;
    const adminCount = staff.filter(m => m.role === 'admin').length;

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Top Light Executive Header Bar */}
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={20} color={C.textMain} />
                </TouchableOpacity>

                <View style={s.brandWrap}>
                    <View style={s.logoCircle}>
                        <Ionicons name="people" size={18} color={C.gold} />
                    </View>
                    <View>
                        <Text style={s.pageTitle}>Access & Roles</Text>
                        <Text style={s.pageSub}>Staff Permissions & Hierarchy</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={openAddStaff}
                    style={s.inviteBtn}
                    activeOpacity={0.85}
                >
                    <Ionicons name="person-add" size={14} color="#FFFFFF" />
                    <Text style={s.inviteBtnText}>Add Staff</Text>
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={s.scrollContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
            >
                {/* 1. Overview Summary Stats */}
                <View style={s.statsGrid}>
                    <View style={s.statCard}>
                        <View style={[s.statIconBox, { backgroundColor: C.goldLight }]}>
                            <Ionicons name="shield-checkmark" size={17} color={C.gold} />
                        </View>
                        <View>
                            <Text style={s.statNumber}>{superAdminCount}</Text>
                            <Text style={s.statLabel}>Super Admins</Text>
                        </View>
                    </View>

                    <View style={s.statCard}>
                        <View style={[s.statIconBox, { backgroundColor: C.blueLight }]}>
                            <Ionicons name="person" size={17} color={C.blue} />
                        </View>
                        <View>
                            <Text style={s.statNumber}>{adminCount}</Text>
                            <Text style={s.statLabel}>Staff Admins</Text>
                        </View>
                    </View>

                    <View style={s.statCard}>
                        <View style={[s.statIconBox, { backgroundColor: C.greenLight }]}>
                            <Ionicons name="checkmark-done-circle" size={17} color={C.green} />
                        </View>
                        <View>
                            <Text style={s.statNumber}>{staff.length}</Text>
                            <Text style={s.statLabel}>Total Staff</Text>
                        </View>
                    </View>
                </View>

                {/* 2. Search & Role Filters */}
                <View style={s.filterRow}>
                    <View style={s.searchBox}>
                        <Ionicons name="search-outline" size={16} color={C.textMuted} />
                        <TextInput
                            style={s.searchInput}
                            placeholder="Search staff by name or email..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color={C.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={s.chipRow}>
                        <TouchableOpacity
                            onPress={() => setRoleFilter('all')}
                            style={[s.filterChip, roleFilter === 'all' && s.filterChipActive]}
                        >
                            <Text style={[s.filterChipText, roleFilter === 'all' && s.filterChipTextActive]}>All ({staff.length})</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setRoleFilter('super_admin')}
                            style={[s.filterChip, roleFilter === 'super_admin' && s.filterChipActive]}
                        >
                            <Text style={[s.filterChipText, roleFilter === 'super_admin' && s.filterChipTextActive]}>Super Admin</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setRoleFilter('admin')}
                            style={[s.filterChip, roleFilter === 'admin' && s.filterChipActive]}
                        >
                            <Text style={[s.filterChipText, roleFilter === 'admin' && s.filterChipTextActive]}>Staff Admin</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 3. Staff Roster List */}
                <View style={s.rosterCard}>
                    <View style={s.rosterCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="key-outline" size={16} color={C.gold} />
                            <Text style={s.rosterCardTitle}>Team Staff & Permissions</Text>
                        </View>
                        <Text style={s.rosterCardCount}>{filteredStaff.length} Members</Text>
                    </View>

                    {loading ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={C.gold} />
                            <Text style={{ marginTop: 10, fontSize: 13, color: C.textSub, fontWeight: '700' }}>Loading Team Roles...</Text>
                        </View>
                    ) : filteredStaff.length === 0 ? (
                        <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={38} color="#CBD5E1" />
                            <Text style={{ marginTop: 8, fontSize: 13, color: C.textMuted, fontWeight: '700' }}>No staff found matching criteria.</Text>
                        </View>
                    ) : (
                        filteredStaff.map((member, index) => {
                            const isSuper = member.role === 'super_admin';
                            const isActive = member.status === 'active';
                            return (
                                <TouchableOpacity 
                                    key={member.id} 
                                    onPress={() => openAdminProfile(member)}
                                    style={[s.staffItemRow, index === filteredStaff.length - 1 && { borderBottomWidth: 0 }]}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.staffItemLeft}>
                                        <View style={[s.staffAvatar, { backgroundColor: isSuper ? C.goldLight : C.blueLight }]}>
                                            <Text style={[s.staffAvatarText, { color: isSuper ? C.gold : C.blue }]}>
                                                {member.full_name?.[0]?.toUpperCase() || 'A'}
                                            </Text>
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.staffItemName}>{member.full_name || 'Admin User'}</Text>
                                                {isSuper && (
                                                    <View style={s.superCrownPill}>
                                                        <Ionicons name="ribbon" size={10} color={C.gold} />
                                                        <Text style={s.superCrownText}>SUPER</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <Text style={s.staffItemEmail}>{member.email || 'No email'}</Text>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <View style={[s.roleBadge, { backgroundColor: isSuper ? C.goldBg : C.blueLight, borderColor: isSuper ? C.goldBorder : C.blueBorder }]}>
                                                    <Text style={[s.roleBadgeText, { color: isSuper ? C.gold : C.blue }]}>
                                                        {isSuper ? 'Super Admin' : 'Staff Admin'}
                                                    </Text>
                                                </View>

                                                <View style={[s.statusBadge, { backgroundColor: isActive ? C.greenLight : C.redLight, borderColor: isActive ? C.greenBorder : C.redBorder }]}>
                                                    <View style={[s.statusDot, { backgroundColor: isActive ? C.green : C.red }]} />
                                                    <Text style={[s.statusBadgeText, { color: isActive ? C.green : C.red }]}>
                                                        {isActive ? 'Active' : 'Suspended'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={s.staffItemRight}>
                                        <View style={s.manageRoleBtn}>
                                            <Text style={s.manageRoleBtnText}>Manage</Text>
                                            <Ionicons name="chevron-forward" size={13} color={C.blue} />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* 4. Hierarchy & Role Policies Information Card */}
                <View style={s.policyCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Ionicons name="information-circle-outline" size={20} color={C.gold} />
                        <Text style={s.policyTitle}>Access Control Policies</Text>
                    </View>
                    <Text style={s.policyText}>
                        • <Text style={{ fontWeight: '800', color: C.textMain }}>Super Admin:</Text> Complete root governance over all 48+ modules, user vaults, rates, system switches, and staff role allocations.
                    </Text>
                    <Text style={s.policyText}>
                        • <Text style={{ fontWeight: '800', color: C.textMain }}>Staff Admin:</Text> Access limited to assigned modules. Super Admin can selectively hide or enable individual operational modules at any time.
                    </Text>
                </View>
            </ScrollView>

            {/* Modal 1: Admin Permissions Studio & Role Editor */}
            <Modal visible={showAdminModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdminModal(false)}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    {selectedAdmin && (
                        <>
                            {/* Modal Header Bar */}
                            <View style={s.modalTopBar}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={[s.staffAvatar, { backgroundColor: selectedAdmin.role === 'super_admin' ? C.goldLight : C.blueLight }]}>
                                        <Text style={[s.staffAvatarText, { color: selectedAdmin.role === 'super_admin' ? C.gold : C.blue }]}>
                                            {selectedAdmin.full_name?.[0]?.toUpperCase() || 'A'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={s.modalStaffName}>{selectedAdmin.full_name || 'Admin Member'}</Text>
                                        <Text style={s.modalStaffEmail}>{selectedAdmin.email}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity onPress={() => setShowAdminModal(false)} style={s.modalCloseBtn}>
                                    <Ionicons name="close" size={20} color="#0F172A" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
                                {/* Role Control & Actions Card */}
                                <View style={s.modalRoleCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={s.modalSectionTitle}>Role & Status</Text>
                                        <View style={[s.roleBadge, { backgroundColor: selectedAdmin.role === 'super_admin' ? C.goldBg : C.blueLight, borderColor: selectedAdmin.role === 'super_admin' ? C.goldBorder : C.blueBorder }]}>
                                            <Text style={[s.roleBadgeText, { color: selectedAdmin.role === 'super_admin' ? C.gold : C.blue }]}>
                                                {selectedAdmin.role === 'super_admin' ? 'Super Admin' : 'Staff Admin'}
                                            </Text>
                                        </View>
                                    </View>

                                    {currentUserRole === 'super_admin' && (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {selectedAdmin.role !== 'super_admin' ? (
                                                <TouchableOpacity 
                                                    onPress={() => handleChangeAdminRole(selectedAdmin, 'super_admin')}
                                                    style={[s.roleActionBtn, { backgroundColor: C.goldLight, borderColor: C.goldBorder }]}
                                                    disabled={actionLoading}
                                                >
                                                    <Ionicons name="ribbon" size={14} color={C.gold} />
                                                    <Text style={[s.roleActionBtnText, { color: C.gold }]}>Make Super Admin</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity 
                                                    onPress={() => handleChangeAdminRole(selectedAdmin, 'admin')}
                                                    style={[s.roleActionBtn, { backgroundColor: C.blueLight, borderColor: C.blueBorder }]}
                                                    disabled={actionLoading}
                                                >
                                                    <Ionicons name="person" size={14} color={C.blue} />
                                                    <Text style={[s.roleActionBtnText, { color: C.blue }]}>Set as Staff Admin</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity 
                                                onPress={() => handleToggleAdminStatus(selectedAdmin)}
                                                style={[s.roleActionBtn, { backgroundColor: selectedAdmin.status === 'active' ? C.redLight : C.greenLight, borderColor: selectedAdmin.status === 'active' ? C.redBorder : C.greenBorder }]}
                                                disabled={actionLoading}
                                            >
                                                <Ionicons name={selectedAdmin.status === 'active' ? 'ban' : 'checkmark-circle'} size={14} color={selectedAdmin.status === 'active' ? C.red : C.green} />
                                                <Text style={[s.roleActionBtnText, { color: selectedAdmin.status === 'active' ? C.red : C.green }]}>
                                                    {selectedAdmin.status === 'active' ? 'Suspend Admin' : 'Reactivate Admin'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                onPress={() => handleChangeAdminRole(selectedAdmin, 'user')}
                                                style={[s.roleActionBtn, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}
                                                disabled={actionLoading}
                                            >
                                                <Ionicons name="arrow-down-circle" size={14} color="#64748B" />
                                                <Text style={[s.roleActionBtnText, { color: '#64748B' }]}>Demote to User</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* Module Access Permissions Studio */}
                                {currentUserRole === 'super_admin' && (
                                    <View style={s.permissionStudioCard}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ionicons name="shield-checkmark" size={18} color={C.gold} />
                                                <Text style={s.permissionStudioTitle}>Module Access Permissions</Text>
                                            </View>
                                            <View style={s.counterPill}>
                                                <Text style={s.counterPillText}>
                                                    {ALL_ADMIN_MODULES.length - individualHiddenModules.length}/{ALL_ADMIN_MODULES.length} ENABLED
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={s.permissionStudioSub}>
                                            Turn off modules to hide them completely from this staff member's navigation console.
                                        </Text>

                                        {/* Search Input */}
                                        <View style={s.studioSearchBox}>
                                            <Ionicons name="search-outline" size={15} color={C.textMuted} />
                                            <TextInput
                                                style={s.studioSearchInput}
                                                placeholder="Filter modules by name..."
                                                placeholderTextColor="#94A3B8"
                                                value={moduleSearch}
                                                onChangeText={setModuleSearch}
                                            />
                                            {moduleSearch.length > 0 && (
                                                <TouchableOpacity onPress={() => setModuleSearch('')}>
                                                    <Ionicons name="close-circle" size={15} color={C.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Category Filter Chips */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                {['All', 'Operations', 'Banking', 'Finance', 'Technical', 'Internal', 'RedZone'].map(cat => {
                                                    const isActive = activeCategory === cat;
                                                    return (
                                                        <TouchableOpacity
                                                            key={cat}
                                                            onPress={() => setActiveCategory(cat)}
                                                            style={[s.categoryChip, isActive && s.categoryChipActive]}
                                                        >
                                                            <Text style={[s.categoryChipText, isActive && s.categoryChipTextActive]}>
                                                                {cat === 'RedZone' ? '🚨 RedZone' : cat}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </ScrollView>

                                        {/* 1-Tap Quick Presets */}
                                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                                            <TouchableOpacity
                                                onPress={() => applyQuickPreset(selectedAdmin.id, 'hide_redzone')}
                                                style={[s.presetBtn, { backgroundColor: C.redLight, borderColor: C.redBorder }]}
                                            >
                                                <Text style={[s.presetBtnText, { color: C.red }]}>🚨 Hide RedZone</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => applyQuickPreset(selectedAdmin.id, 'enable_all')}
                                                style={[s.presetBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}
                                            >
                                                <Text style={[s.presetBtnText, { color: C.green }]}>👁️ Enable All</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => applyQuickPreset(selectedAdmin.id, 'hide_all')}
                                                style={[s.presetBtn, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                                            >
                                                <Text style={[s.presetBtnText, { color: C.textSub }]}>🔒 Lock All</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Modules List with Toggle */}
                                        {ALL_ADMIN_MODULES
                                            .filter(m => (activeCategory === 'All' || m.cat === activeCategory) && m.label.toLowerCase().includes(moduleSearch.toLowerCase()))
                                            .map(mod => {
                                                const isHidden = individualHiddenModules.includes(mod.key);
                                                return (
                                                    <View
                                                        key={mod.key}
                                                        style={[s.moduleRow, isHidden ? s.moduleRowHidden : s.moduleRowActive]}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                                            <View style={[s.moduleIconBox, { backgroundColor: isHidden ? C.redLight : C.goldLight }]}>
                                                                <Ionicons name={mod.icon as any} size={16} color={isHidden ? C.red : C.gold} />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[s.moduleTitle, { color: isHidden ? C.red : C.textMain }]}>{mod.label}</Text>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                                    <View style={[s.statusBadgeMini, { backgroundColor: isHidden ? C.redLight : C.greenLight, borderColor: isHidden ? C.redBorder : C.greenBorder }]}>
                                                                        <Text style={[s.statusBadgeMiniText, { color: isHidden ? C.red : C.green }]}>
                                                                            {isHidden ? 'HIDDEN' : 'ENABLED'}
                                                                        </Text>
                                                                    </View>
                                                                    <Text style={s.moduleCatText}>• {mod.cat}</Text>
                                                                </View>
                                                            </View>
                                                        </View>
                                                        <Switch
                                                            trackColor={{ false: '#22C55E', true: '#EF4444' }}
                                                            thumbColor="#FFFFFF"
                                                            style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                                                            onValueChange={() => toggleIndividualModule(selectedAdmin.id, mod.key)}
                                                            value={isHidden}
                                                        />
                                                    </View>
                                                );
                                            })}
                                    </View>
                                )}

                                {/* Activity Logs Card */}
                                <View style={s.activityCard}>
                                    <Text style={s.modalSectionTitle}>Recent Activity Logs</Text>
                                    {loadingLogs ? (
                                        <ActivityIndicator size="small" color={C.gold} style={{ marginVertical: 14 }} />
                                    ) : adminLogs.length === 0 ? (
                                        <Text style={s.noLogsText}>No recent actions recorded for this staff member.</Text>
                                    ) : (
                                        adminLogs.map(log => (
                                            <View key={log.id} style={s.logItemRow}>
                                                <View style={s.logDot} />
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={s.logActionText}>{log.action}</Text>
                                                        <Text style={s.logTimeText}>
                                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                    <Text style={s.logDetailsText}>
                                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </>
                    )}
                </View>
            </Modal>

            {/* Modal 2: Add / Promote Staff Member */}
            <Modal visible={showAddStaffModal} animationType="slide" transparent>
                <View style={s.addModalBackdrop}>
                    <View style={s.addModalSheet}>
                        <View style={s.modalTopBar}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.statIconBox, { backgroundColor: C.goldLight, width: 32, height: 32 }]}>
                                    <Ionicons name="person-add" size={16} color={C.gold} />
                                </View>
                                <Text style={s.modalStaffName}>Promote User to Staff</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAddStaffModal(false)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        {/* Search existing users */}
                        <View style={[s.searchBox, { marginHorizontal: 16, marginBottom: 12 }]}>
                            <Ionicons name="search-outline" size={16} color={C.textMuted} />
                            <TextInput
                                style={s.searchInput}
                                placeholder="Search user by name, email, or phone..."
                                placeholderTextColor="#94A3B8"
                                value={userSearch}
                                onChangeText={setUserSearch}
                            />
                        </View>

                        <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSub, marginHorizontal: 16, marginBottom: 6 }}>
                            SELECT USER:
                        </Text>

                        {loadingUsers ? (
                            <ActivityIndicator size="small" color={C.gold} style={{ padding: 20 }} />
                        ) : (
                            <ScrollView style={{ maxHeight: 200, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
                                {availableUsers
                                    .filter(u => !userSearch.trim() || (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || (u.phone || '').includes(userSearch))
                                    .slice(0, 20)
                                    .map(user => {
                                        const isSelected = selectedUserToPromote?.id === user.id;
                                        return (
                                            <TouchableOpacity
                                                key={user.id}
                                                onPress={() => setSelectedUserToPromote(user)}
                                                style={[s.userSelectRow, isSelected && s.userSelectRowActive]}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.userSelectName}>{user.full_name || 'User'}</Text>
                                                    <Text style={s.userSelectEmail}>{user.email || user.phone || 'No contact'}</Text>
                                                </View>
                                                <View style={[s.roleBadgeMini, { backgroundColor: isSelected ? C.blueLight : '#F1F5F9' }]}>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? C.blue : C.textSub }}>
                                                        {isSelected ? 'SELECTED ✓' : user.role || 'user'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </ScrollView>
                        )}

                        {/* Assign Role selector */}
                        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSub, marginBottom: 8 }}>
                                ASSIGN ROLE:
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => setPromoteRole('admin')}
                                    style={[s.roleOptionBox, promoteRole === 'admin' && s.roleOptionBoxActive]}
                                >
                                    <Ionicons name="person-outline" size={18} color={promoteRole === 'admin' ? C.blue : C.textSub} />
                                    <View>
                                        <Text style={[s.roleOptionTitle, promoteRole === 'admin' && { color: C.blue }]}>Staff Admin</Text>
                                        <Text style={s.roleOptionSub}>Controlled module access</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setPromoteRole('super_admin')}
                                    style={[s.roleOptionBox, promoteRole === 'super_admin' && s.roleOptionBoxActive]}
                                >
                                    <Ionicons name="ribbon-outline" size={18} color={promoteRole === 'super_admin' ? C.gold : C.textSub} />
                                    <View>
                                        <Text style={[s.roleOptionTitle, promoteRole === 'super_admin' && { color: C.gold }]}>Super Admin</Text>
                                        <Text style={s.roleOptionSub}>Master governance key</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Modal Action Buttons */}
                        <View style={s.modalActionBtnRow}>
                            <TouchableOpacity
                                onPress={() => setShowAddStaffModal(false)}
                                style={s.cancelModalBtn}
                            >
                                <Text style={s.cancelModalBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handlePromoteUser}
                                disabled={promoting || !selectedUserToPromote}
                                style={[s.confirmPromoteBtn, (!selectedUserToPromote || promoting) && { opacity: 0.6 }]}
                            >
                                {promoting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={s.confirmPromoteBtnText}>Promote to Staff</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topBar: {
        paddingTop: Platform.OS === 'ios' ? 48 : 36,
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    brandWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        marginLeft: 10,
    },
    logoCircle: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    pageTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
    },
    pageSub: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '700',
    },
    inviteBtn: {
        backgroundColor: '#0F172A',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    inviteBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
    },
    scrollContainer: {
        padding: 14,
        paddingBottom: 60,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statNumber: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    filterRow: {
        marginBottom: 12,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 12.5,
        color: '#0F172A',
    },
    chipRow: {
        flexDirection: 'row',
        gap: 6,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    rosterCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        marginBottom: 14,
    },
    rosterCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FAFBFD',
    },
    rosterCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    rosterCardCount: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
    },
    staffItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    staffItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    staffAvatar: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    staffAvatarText: {
        fontSize: 16,
        fontWeight: '900',
    },
    staffItemName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A',
    },
    superCrownPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    superCrownText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#D97706',
    },
    staffItemEmail: {
        fontSize: 11.5,
        color: '#64748B',
        marginTop: 1,
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    staffItemRight: {
        marginLeft: 8,
    },
    manageRoleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    manageRoleBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2563EB',
    },
    policyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    policyTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A',
    },
    policyText: {
        fontSize: 11.5,
        color: '#64748B',
        lineHeight: 18,
        marginBottom: 6,
    },
    modalTopBar: {
        paddingTop: Platform.OS === 'ios' ? 48 : 24,
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    modalStaffName: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0F172A',
    },
    modalStaffEmail: {
        fontSize: 11,
        color: '#64748B',
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalRoleCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    modalSectionTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
    },
    roleActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
    },
    roleActionBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
    },
    permissionStudioCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    permissionStudioTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
    },
    counterPill: {
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    counterPillText: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#D97706',
    },
    permissionStudioSub: {
        fontSize: 11.5,
        color: '#64748B',
        marginBottom: 10,
        lineHeight: 16,
    },
    studioSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 36,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
    },
    studioSearchInput: {
        flex: 1,
        marginLeft: 6,
        fontSize: 11.5,
        color: '#0F172A',
    },
    categoryChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
    },
    categoryChipActive: {
        backgroundColor: '#0F172A',
    },
    categoryChipText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
    },
    presetBtn: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
    },
    presetBtnText: {
        fontSize: 11,
        fontWeight: '800',
    },
    moduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 9,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 6,
    },
    moduleRowActive: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
    },
    moduleRowHidden: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    moduleIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moduleTitle: {
        fontSize: 12,
        fontWeight: '800',
    },
    statusBadgeMini: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
    },
    statusBadgeMiniText: {
        fontSize: 9,
        fontWeight: '900',
    },
    moduleCatText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
    },
    activityCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 30,
    },
    noLogsText: {
        fontSize: 11.5,
        color: '#94A3B8',
        marginVertical: 10,
    },
    logItemRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    logDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#2563EB',
        marginTop: 5,
    },
    logActionText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
    },
    logTimeText: {
        fontSize: 10.5,
        color: '#94A3B8',
        fontWeight: '700',
    },
    logDetailsText: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    addModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    addModalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        paddingBottom: 24,
    },
    userSelectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 6,
    },
    userSelectRowActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
    },
    userSelectName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A',
    },
    userSelectEmail: {
        fontSize: 11,
        color: '#64748B',
    },
    roleBadgeMini: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    roleOptionBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    roleOptionBoxActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#D97706',
    },
    roleOptionTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0F172A',
    },
    roleOptionSub: {
        fontSize: 9.5,
        color: '#64748B',
    },
    modalActionBtnRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 18,
    },
    cancelModalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    cancelModalBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
    },
    confirmPromoteBtn: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#0F172A',
        alignItems: 'center',
    },
    confirmPromoteBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
