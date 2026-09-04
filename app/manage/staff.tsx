import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, FlatList, Switch, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

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

export default function StaffManager() {
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
    const [adminLogs, setAdminLogs] = useState<any[]>([]);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('admin');
    const [actionLoading, setActionLoading] = useState(false);

    // Module hiding search & category filter state
    const [moduleSearch, setModuleSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

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

    useEffect(() => {
        fetchStaff();
        checkCurrentRole();
    }, []);

    const checkCurrentRole = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (profile?.role) setCurrentUserRole(profile.role);
            }
        } catch (e) {}
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
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
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
                            // Disable lockdown trigger temporarily if needed, then update
                            const { error } = await supabase
                                .from('profiles')
                                .update({ role: newRole })
                                .eq('id', admin.id);

                            if (error) throw error;

                            // Also sync auth metadata
                            await supabase.from('auth.users' as any).update({
                                raw_app_meta_data: { role: newRole }
                            }).eq('id', admin.id).then(() => {}, () => {});

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

    const [individualHiddenModules, setIndividualHiddenModules] = useState<string[]>([]);

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
            const { data: edgeRes } = await supabase.functions.invoke('admin-audit-logs', {
                body: { action: 'list', limit: 100 }
            });
            if (edgeRes?.logs && Array.isArray(edgeRes.logs)) {
                staffLogs = edgeRes.logs.filter((l: any) => l.admin_id === admin.id);
            }
        } catch (e) {}

        if (staffLogs.length === 0) {
            const { data } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('admin_id', admin.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) staffLogs = data;
        }
            
        setAdminLogs(staffLogs);
        setLoadingLogs(false);
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

            const statusLabel = updatedList.includes(moduleKey) ? 'HIDDEN 🙈' : 'ENABLED 👁️';
            Alert.alert('Individual Permission Updated 🔒', `Feature "${moduleKey.toUpperCase()}" is now ${statusLabel} for ${selectedAdmin?.full_name || 'this admin'}`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Staff & HR' }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-slate-800">Team Roster</Text>
                    <TouchableOpacity className="bg-slate-900 px-4 py-2 rounded-lg flex-row items-center gap-2">
                        <Ionicons name="person-add" size={16} color="white" />
                        <Text className="text-white font-bold text-xs">Invite Member</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0F172A" />
                ) : (
                    <ScrollView className="mb-8">
                        {staff.map((member, i) => (
                            <TouchableOpacity 
                                key={member.id} 
                                onPress={() => openAdminProfile(member)}
                                className="flex-row items-center justify-between py-4 border-b border-gray-100 active:bg-slate-50 px-2 rounded-xl"
                            >
                                <View className="flex-row items-center gap-4">
                                    <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
                                        <Text className="font-bold text-slate-600">
                                            {member.full_name?.[0] || 'A'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text className="font-bold text-slate-800 text-base">{member.full_name || 'Admin'}</Text>
                                        <View className="flex-row items-center gap-2 mt-0.5">
                                            <Text className="text-slate-500 text-xs uppercase font-bold tracking-wider">{member.role}</Text>
                                            <View className={`px-1.5 py-0.5 rounded ${member.status === 'active' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                                <Text className={`text-xs font-bold uppercase tracking-widest ${member.status === 'active' ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                    {member.status === 'active' ? 'Online' : 'Offline'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                                <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center">
                                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <Text className="text-slate-400 font-bold uppercase text-xs mb-4">Shift Schedule (Today)</Text>
                <View className="flex-row gap-4">
                    <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <Text className="text-blue-800 font-bold mb-1">Morning Shift</Text>
                        <Text className="text-blue-500 text-xs">08:00 - 16:00</Text>
                        <View className="flex-row mt-3">
                            <View className="w-6 h-6 rounded-full bg-blue-200 border-2 border-white" />
                            <View className="w-6 h-6 rounded-full bg-blue-300 border-2 border-white -ml-2" />
                        </View>
                    </View>
                    <View className="flex-1 bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <Text className="text-purple-800 font-bold mb-1">Evening Shift</Text>
                        <Text className="text-purple-500 text-xs">16:00 - 00:00</Text>
                        <View className="flex-row mt-3">
                            <View className="w-6 h-6 rounded-full bg-purple-200 border-2 border-white" />
                        </View>
                    </View>
                    </View>
                </View>

            {/* Admin Profile Modal */}
            <Modal visible={showAdminModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdminModal(false)}>
                <View className="flex-1 bg-[#f8fafc]">
                    {selectedAdmin && (
                        <>
                            {/* Header */}
                            <View className="bg-slate-900 pt-16 pb-6 px-6 rounded-b-3xl items-center relative">
                                <TouchableOpacity 
                                    className="absolute top-12 right-6 w-8 h-8 bg-white/20 rounded-full items-center justify-center"
                                    onPress={() => setShowAdminModal(false)}
                                >
                                    <Ionicons name="close" size={20} color="white" />
                                </TouchableOpacity>
                                
                                <View className="w-20 h-20 bg-slate-800 rounded-full items-center justify-center border-2 border-[#d4af37] mb-3">
                                    <Text className="text-3xl font-black text-[#d4af37]">{selectedAdmin.full_name?.[0] || 'A'}</Text>
                                </View>
                                <Text className="text-white font-black text-xl mb-1">{selectedAdmin.full_name || 'Unknown Admin'}</Text>
                                <Text className="text-slate-400 text-xs mb-3">{selectedAdmin.email}</Text>
                                
                                <View className="flex-row gap-2 mb-3">
                                    <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                                        <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">{selectedAdmin.role}</Text>
                                    </View>
                                    <View className={`px-3 py-1 rounded-full border ${selectedAdmin.status === 'active' ? 'bg-blue-500/20 border-blue-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                                        <Text className={`${selectedAdmin.status === 'active' ? 'text-blue-400' : 'text-red-400'} font-bold text-xs uppercase tracking-wider`}>{selectedAdmin.status}</Text>
                                    </View>
                                </View>

                                {/* 👑 Super Admin Master Action Controls */}
                                {currentUserRole === 'super_admin' && (
                                    <View className="w-full mt-2 pt-3 border-t border-white/10 flex-row flex-wrap justify-center gap-2">
                                        <TouchableOpacity 
                                            onPress={() => handleToggleAdminStatus(selectedAdmin)}
                                            style={{ backgroundColor: selectedAdmin.status === 'active' ? '#ef4444' : '#10b981' }}
                                            className="px-3 py-1.5 rounded-lg flex-row items-center gap-1 shadow-sm"
                                        >
                                            <Ionicons name={selectedAdmin.status === 'active' ? "ban-outline" : "checkmark-circle-outline"} size={14} color="white" />
                                            <Text className="text-white font-bold text-xs">{selectedAdmin.status === 'active' ? 'Ban Admin' : 'Activate Admin'}</Text>
                                        </TouchableOpacity>

                                        {selectedAdmin.role !== 'super_admin' && (
                                            <TouchableOpacity 
                                                onPress={() => handleChangeAdminRole(selectedAdmin, 'super_admin')}
                                                className="bg-amber-500 px-3 py-1.5 rounded-lg flex-row items-center gap-1 shadow-sm"
                                            >
                                                <Ionicons name="ribbon-outline" size={14} color="white" />
                                                <Text className="text-white font-bold text-xs">Make Super Admin</Text>
                                            </TouchableOpacity>
                                        )}

                                        {selectedAdmin.role !== 'admin' && (
                                            <TouchableOpacity 
                                                onPress={() => handleChangeAdminRole(selectedAdmin, 'admin')}
                                                className="bg-blue-600 px-3 py-1.5 rounded-lg flex-row items-center gap-1 shadow-sm"
                                            >
                                                <Ionicons name="person-outline" size={14} color="white" />
                                                <Text className="text-white font-bold text-xs">Make Staff Admin</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity 
                                            onPress={() => handleChangeAdminRole(selectedAdmin, 'user')}
                                            className="bg-slate-700 px-3 py-1.5 rounded-lg flex-row items-center gap-1 shadow-sm"
                                        >
                                            <Ionicons name="arrow-down-circle-outline" size={14} color="white" />
                                            <Text className="text-white font-bold text-xs">Demote User</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                                {/* 👑 Super Admin Per-Admin Custom Feature Hiding Studio */}
                                {currentUserRole === 'super_admin' && (
                                    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Ionicons name="shield-checkmark" size={16} color="#d97706" />
                                                </View>
                                                <Text style={{ fontWeight: '900', fontSize: 13, color: '#0f172a' }}>PER-ADMIN MODULE PERMISSIONS</Text>
                                            </View>
                                            <View style={{ backgroundColor: '#fffbeb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' }}>
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#d97706' }}>
                                                    {ALL_ADMIN_MODULES.length - individualHiddenModules.length}/{ALL_ADMIN_MODULES.length} ENABLED
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 12, lineHeight: 15 }}>
                                            Custom permissions for <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{selectedAdmin.full_name || 'this admin'}</Text>. Disabled modules will be hidden completely from their admin dashboard.
                                        </Text>

                                        {/* Search Input */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, height: 38 }}>
                                            <Ionicons name="search-outline" size={16} color="#94a3b8" />
                                            <TextInput
                                                style={{ flex: 1, marginLeft: 8, fontSize: 12, color: '#0f172a' }}
                                                placeholder="Search 48+ modules by name..."
                                                placeholderTextColor="#94a3b8"
                                                value={moduleSearch}
                                                onChangeText={setModuleSearch}
                                            />
                                            {moduleSearch.length > 0 && (
                                                <TouchableOpacity onPress={() => setModuleSearch('')}>
                                                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Category Chips */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                {['All', 'Operations', 'Banking', 'Finance', 'Technical', 'Internal', 'RedZone'].map(cat => {
                                                    const isActive = activeCategory === cat;
                                                    return (
                                                        <TouchableOpacity
                                                            key={cat}
                                                            onPress={() => setActiveCategory(cat)}
                                                            style={{
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderRadius: 20,
                                                                backgroundColor: isActive ? (cat === 'RedZone' ? '#ef4444' : '#0f172a') : '#f1f5f9',
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? '#ffffff' : '#64748b' }}>
                                                                {cat === 'RedZone' ? '🚨 RedZone' : cat}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </ScrollView>

                                        {/* 1-Tap Presets Bar */}
                                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                                            <TouchableOpacity
                                                onPress={() => applyQuickPreset(selectedAdmin.id, 'hide_redzone')}
                                                style={{ flex: 1, backgroundColor: '#fef2f2', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#ef4444' }}>🚨 Hide RedZone</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => applyQuickPreset(selectedAdmin.id, 'enable_all')}
                                                style={{ flex: 1, backgroundColor: '#ecfdf5', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#a7f3d0' }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#10b981' }}>👁️ Enable All</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => applyQuickPreset(selectedAdmin.id, 'hide_all')}
                                                style={{ flex: 1, backgroundColor: '#f8fafc', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b' }}>🙈 Lock All</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Module Cards List */}
                                        {ALL_ADMIN_MODULES
                                            .filter(m => (activeCategory === 'All' || m.cat === activeCategory) && m.label.toLowerCase().includes(moduleSearch.toLowerCase()))
                                            .map(mod => {
                                                const isHidden = individualHiddenModules.includes(mod.key);
                                                return (
                                                    <View
                                                        key={mod.key}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: 10,
                                                            borderRadius: 14,
                                                            backgroundColor: isHidden ? '#fef2f2' : '#f8fafc',
                                                            borderWidth: 1,
                                                            borderColor: isHidden ? '#fecaca' : '#e2e8f0',
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                                            <View style={{
                                                                width: 32, height: 32, borderRadius: 10,
                                                                backgroundColor: isHidden ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 166, 35, 0.15)',
                                                                alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                <Ionicons name={mod.icon as any} size={16} color={isHidden ? '#ef4444' : '#d97706'} />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontWeight: 'bold', fontSize: 12, color: isHidden ? '#ef4444' : '#0f172a' }}>{mod.label}</Text>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                                    <View style={{
                                                                        paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
                                                                        backgroundColor: isHidden ? '#fef2f2' : '#ecfdf5',
                                                                        borderWidth: 1, borderColor: isHidden ? '#fecaca' : '#a7f3d0'
                                                                    }}>
                                                                        <Text style={{ fontSize: 12, fontWeight: '800', color: isHidden ? '#ef4444' : '#10b981' }}>
                                                                            {isHidden ? 'HIDDEN 🙈' : 'ENABLED 👁️'}
                                                                        </Text>
                                                                    </View>
                                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#94a3b8' }}>• {mod.cat}</Text>
                                                                </View>
                                                            </View>
                                                        </View>
                                                        <Switch
                                                            trackColor={{ false: "#22c55e", true: "#ef4444" }}
                                                            thumbColor="#fff"
                                                            style={{ transform: [{ scaleX: 0.65 }, { scaleY: 0.65 }] }}
                                                            onValueChange={() => toggleIndividualModule(selectedAdmin.id, mod.key)}
                                                            value={isHidden}
                                                        />
                                                    </View>
                                                );
                                            })}
                                    </View>
                                )}

                                {/* Activity Timeline */}
                                <Text className="text-slate-800 font-black text-sm uppercase tracking-wider mb-4">Activity Timeline (Logs)</Text>
                                
                                {loadingLogs ? (
                                    <ActivityIndicator size="large" color="#0F172A" className="mt-10" />
                                ) : adminLogs.length === 0 ? (
                                    <View className="items-center justify-center my-6">
                                        <Ionicons name="document-text-outline" size={32} color="#cbd5e1" />
                                        <Text className="text-slate-400 mt-2 font-medium text-xs">No recent actions recorded</Text>
                                    </View>
                                ) : (
                                    adminLogs.map(item => (
                                        <View key={item.id} className="flex-row mb-4">
                                            <View className="items-center mr-3">
                                                <View className="w-2 h-2 rounded-full bg-blue-500 z-10" />
                                                <View className="w-0.5 flex-1 bg-slate-200 -my-1" />
                                            </View>
                                            <View className="flex-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm shadow-slate-100">
                                                <View className="flex-row justify-between items-center mb-1">
                                                    <Text className="font-bold text-slate-800 text-[13px]">{item.action}</Text>
                                                    <Text className="text-xs font-bold text-slate-400">
                                                        {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </Text>
                                                </View>
                                                <Text className="text-slate-500 text-xs leading-4">
                                                    {typeof item.details === 'string' ? item.details : JSON.stringify(item.details)}
                                                </Text>
                                                {item.target_resource && (
                                                    <View className="mt-2 self-start bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                                        <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.target_resource}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </>
                    )}
                </View>
            </Modal>
        </View>
    );
}
