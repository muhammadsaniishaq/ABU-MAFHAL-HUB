import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, FlatList, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const ADMIN_LOCKABLE_MODULES = [
    { key: 'nin_pricing', label: 'NIN & Services Pricing', icon: 'pricetag-outline' },
    { key: 'smm_pricing', label: 'SMM Services Pricing', icon: 'thumbs-up-outline' },
    { key: 'bills_pricing', label: 'Bills & Utilities Pricing', icon: 'flash-outline' },
    { key: 'cac', label: 'CAC Business Management', icon: 'briefcase-outline' },
    { key: 'tickets', label: 'Help Desk & Support Tickets', icon: 'chatbubbles-outline' },
    { key: 'communications', label: 'Broadcast Communications', icon: 'megaphone-outline' },
    { key: 'api', label: 'API Integrations & Keys', icon: 'code-working-outline' },
    { key: 'features', label: 'System Feature Flags', icon: 'toggle-outline' },
    { key: 'cards', label: 'Virtual Cards Management', icon: 'card-outline' },
    { key: 'lending', label: 'Loans & Lending', icon: 'cash-outline' },
    { key: 'reports', label: 'Analytics & Financial Reports', icon: 'bar-chart-outline' },
    { key: 'crypto', label: 'Crypto Assets Management', icon: 'logo-bitcoin' },
    { key: 'security', label: 'Security & 2FA Hub', icon: 'shield-checkmark-outline' },
    { key: 'panic', label: 'Panic Room Lockdown', icon: 'warning-outline' },
    { key: 'staff', label: 'Staff HR & Team Roles', icon: 'people-outline' },
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

        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('admin_id', admin.id)
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (!error) setAdminLogs(data || []);
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
                                            <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{member.role}</Text>
                                            <View className={`px-1.5 py-0.5 rounded ${member.status === 'active' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                                <Text className={`text-[9px] font-bold uppercase tracking-widest ${member.status === 'active' ? 'text-emerald-600' : 'text-gray-500'}`}>
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

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Shift Schedule (Today)</Text>
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
                                        <Text className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider">{selectedAdmin.role}</Text>
                                    </View>
                                    <View className={`px-3 py-1 rounded-full border ${selectedAdmin.status === 'active' ? 'bg-blue-500/20 border-blue-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                                        <Text className={`${selectedAdmin.status === 'active' ? 'text-blue-400' : 'text-red-400'} font-bold text-[10px] uppercase tracking-wider`}>{selectedAdmin.status}</Text>
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
                                {/* 👑 Super Admin Per-Admin Custom Feature Hiding Controls */}
                                {currentUserRole === 'super_admin' && (
                                    <View style={{ backgroundColor: '#fffbeb', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#fde68a', marginBottom: 20 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <Ionicons name="shield-checkmark" size={16} color="#d97706" />
                                            <Text style={{ fontWeight: '900', fontSize: 12, color: '#d97706' }}>PER-ADMIN FEATURE ACCESS PERMISSIONS</Text>
                                        </View>
                                        <Text style={{ color: '#475569', fontSize: 10, marginBottom: 12, lineHeight: 14 }}>
                                            Toggle switches below to HIDE or SHOW specific modules for {selectedAdmin.full_name || 'this admin'} ALONE. Only features enabled here will be visible to this admin.
                                        </Text>

                                        {ADMIN_LOCKABLE_MODULES.map(mod => {
                                            const isHidden = individualHiddenModules.includes(mod.key);
                                            return (
                                                <View key={mod.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(217, 119, 6, 0.1)' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                        <Ionicons name={mod.icon as any} size={16} color={isHidden ? '#ef4444' : '#0f172a'} />
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ fontWeight: 'bold', fontSize: 11, color: isHidden ? '#ef4444' : '#0f172a' }}>{mod.label}</Text>
                                                            <Text style={{ fontSize: 9, fontWeight: '700', color: isHidden ? '#ef4444' : '#10b981' }}>
                                                                {isHidden ? 'HIDDEN FOR THIS ADMIN 🙈' : 'VISIBLE TO THIS ADMIN 👁️'}
                                                            </Text>
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
                                                    <Text className="text-[10px] font-bold text-slate-400">
                                                        {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </Text>
                                                </View>
                                                <Text className="text-slate-500 text-[11px] leading-4">
                                                    {typeof item.details === 'string' ? item.details : JSON.stringify(item.details)}
                                                </Text>
                                                {item.target_resource && (
                                                    <View className="mt-2 self-start bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                                        <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.target_resource}</Text>
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
