import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Switch, Image, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyProfile() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        email: '',
    });

    // Real Stats
    const [stats, setStats] = useState({ users: 0, kyc: 0, tickets: 0 });

    // Admin Toggles (Persisted Locally for Real-time feel)
    const [twoFA, setTwoFA] = useState(true);
    const [pushNotifs, setPushNotifs] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState(true);

    // Advanced Admin Features
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);

    // Password Change State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        fetchMyData();
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const stored = await AsyncStorage.getItem('admin_prefs');
            if (stored) {
                const prefs = JSON.parse(stored);
                setTwoFA(prefs.twoFA ?? true);
                setPushNotifs(prefs.pushNotifs ?? true);
                setEmailAlerts(prefs.emailAlerts ?? true);
            }

            // Fetch live maintenance state
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single();
            if (data && data.value === 'true') {
                setMaintenanceMode(true);
            }
        } catch (e) {}
    };

    const toggleMaintenanceMode = async (value: boolean) => {
        setMaintenanceMode(value);
        try {
            await supabase.from('app_settings').upsert({ key: 'maintenance_mode', value: value ? 'true' : 'false' });
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('audit_logs').insert({
                    admin_id: user.id,
                    action: 'System Status Changed',
                    target_resource: 'App Settings',
                    details: value ? 'Enabled Maintenance Mode' : 'Disabled Maintenance Mode'
                });
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to change system mode.');
        }
    };

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            // Keep auth token, clear everything else
            const keys = await AsyncStorage.getAllKeys();
            const authKeys = keys.filter(k => k.includes('supabase.auth.token'));
            const keysToRemove = keys.filter(k => !authKeys.includes(k));
            await AsyncStorage.multiRemove(keysToRemove);
            
            Alert.alert('Success', 'System cache cleared. UI will feel faster.');
        } catch (e) {
            Alert.alert('Error', 'Could not clear cache.');
        } finally {
            setClearingCache(false);
        }
    };

    const updatePreference = async (key: string, value: boolean) => {
        try {
            if (key === 'twoFA') setTwoFA(value);
            if (key === 'pushNotifs') setPushNotifs(value);
            if (key === 'emailAlerts') setEmailAlerts(value);

            const prefs = { twoFA, pushNotifs, emailAlerts, [key]: value };
            await AsyncStorage.setItem('admin_prefs', JSON.stringify(prefs));
            
            // Optionally log this preference change in Audit Logs
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('audit_logs').insert({
                    admin_id: user.id,
                    action: 'Preference Updated',
                    details: `Set ${key} to ${value}`
                });
            }
        } catch (e) {}
    };

    const fetchMyData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            setProfile(profileData || { full_name: 'Admin', role: 'admin', status: 'active', email: user.email });
            setEditForm({
                full_name: profileData?.full_name || '',
                phone: profileData?.phone || '',
                email: profileData?.email || user.email || '',
            });

            // Fetch Live Stats (Real Data)
            const [
                { count: userCount },
                { count: kycCount },
                { count: ticketCount }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
                supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved')
            ]);

            setStats({
                users: userCount || 0,
                kyc: kycCount || 0,
                tickets: ticketCount || 0
            });

        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!editForm.full_name.trim()) return Alert.alert('Error', 'Name cannot be empty.');
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const { error } = await supabase
                .from('profiles')
                .update({ full_name: editForm.full_name, phone: editForm.phone, email: editForm.email })
                .eq('id', user.id);

            if (error) throw error;
            await fetchMyData();
            setIsEditing(false);
            Alert.alert('Success', 'Profile updated successfully.');
        } catch (error: any) {
            Alert.alert('Update Failed', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');
        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (error) throw error;
            
            Alert.alert('Success', 'Password updated successfully. You will be logged out to apply changes.');
            setShowPasswordModal(false);
            setNewPassword('');
            
            // Log them out for safety
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to log out securely?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Sign Out', 
                    style: 'destructive',
                    onPress: async () => {
                        await supabase.auth.signOut();
                        router.replace('/(auth)/login');
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#F8FAFC] justify-center items-center">
                <Stack.Screen options={{ title: 'My Profile', headerStyle: { backgroundColor: '#F8FAFC' }, headerTintColor: '#334155' }} />
                <ActivityIndicator size="small" color="#64748B" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#F8FAFC]">
            <Stack.Screen 
                options={{ 
                    title: 'My Profile', 
                    headerStyle: { backgroundColor: '#F8FAFC' }, 
                    headerTintColor: '#334155',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity 
                            onPress={() => setIsEditing(!isEditing)}
                            className="bg-slate-200 px-3 py-1 rounded border border-slate-300"
                        >
                            <Text className="text-slate-700 font-medium text-[11px]">{isEditing ? 'Cancel' : 'Edit'}</Text>
                        </TouchableOpacity>
                    )
                }} 
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* COMPACT HEADER */}
                <View className="bg-white px-5 pt-4 pb-6 border-b border-slate-200 mb-4 items-center">
                    <View className="relative mb-3">
                        {profile?.avatar_url ? (
                            <Image 
                                source={{ uri: profile.avatar_url }} 
                                className="w-16 h-16 rounded-full border border-slate-300"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center border border-slate-300">
                                <Text className="text-xl font-bold text-slate-700">
                                    {profile?.full_name?.[0]?.toUpperCase() || 'A'}
                                </Text>
                            </View>
                        )}
                        <View className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                    </View>
                    
                    <Text className="text-slate-800 font-bold text-base">{profile?.full_name || 'System Admin'}</Text>
                    <Text className="text-slate-500 text-[11px] font-medium mt-0.5">{profile?.email || 'admin@mafhal.com'}</Text>
                    
                    <View className="flex-row gap-2 mt-3">
                        <View className="bg-slate-100 px-2 py-1 rounded flex-row items-center gap-1 border border-slate-200">
                            <Ionicons name="shield-checkmark" size={10} color="#475569" />
                            <Text className="text-slate-600 font-medium text-[9px] uppercase tracking-wider">{profile?.role?.replace('_', ' ')}</Text>
                        </View>
                    </View>
                </View>

                <View className="px-4">
                    {/* EDIT FORM */}
                    {isEditing ? (
                        <View className="bg-white p-4 rounded-xl border border-slate-200 mb-4">
                            <Text className="text-slate-800 font-bold text-sm mb-4">Personal Information</Text>
                            
                            <View className="mb-3">
                                <Text className="text-slate-500 text-[10px] font-medium uppercase mb-1 ml-0.5">Full Name</Text>
                                <TextInput
                                    value={editForm.full_name}
                                    onChangeText={(t) => setEditForm(prev => ({...prev, full_name: t}))}
                                    className="bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 text-xs"
                                />
                            </View>

                            <View className="mb-3">
                                <Text className="text-slate-500 text-[10px] font-medium uppercase mb-1 ml-0.5">Email Address</Text>
                                <TextInput
                                    value={editForm.email}
                                    onChangeText={(t) => setEditForm(prev => ({...prev, email: t}))}
                                    className="bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 text-xs"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-slate-500 text-[10px] font-medium uppercase mb-1 ml-0.5">Phone Number</Text>
                                <TextInput
                                    value={editForm.phone}
                                    onChangeText={(t) => setEditForm(prev => ({...prev, phone: t}))}
                                    className="bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 text-xs"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <TouchableOpacity 
                                onPress={handleSaveProfile}
                                disabled={saving}
                                className={`bg-slate-800 py-2.5 rounded-lg items-center ${saving ? 'opacity-70' : ''}`}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-medium text-xs">Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* LIVE SYSTEM STATS */}
                            <Text className="text-slate-500 font-medium text-[10px] uppercase tracking-wider mb-2 ml-1">Live System Metrics</Text>
                            <View className="flex-row gap-2 mb-5">
                                <View className="flex-1 bg-white p-3 rounded-xl border border-slate-200 items-center">
                                    <Text className="text-lg font-bold text-slate-800">{stats.users.toLocaleString()}</Text>
                                    <Text className="text-slate-500 text-[9px] uppercase">Total Users</Text>
                                </View>
                                <View className="flex-1 bg-white p-3 rounded-xl border border-slate-200 items-center">
                                    <Text className="text-lg font-bold text-slate-800">{stats.kyc.toLocaleString()}</Text>
                                    <Text className="text-slate-500 text-[9px] uppercase">Approved KYC</Text>
                                </View>
                                <View className="flex-1 bg-white p-3 rounded-xl border border-slate-200 items-center">
                                    <Text className="text-lg font-bold text-slate-800">{stats.tickets.toLocaleString()}</Text>
                                    <Text className="text-slate-500 text-[9px] uppercase">Resolved Tickets</Text>
                                </View>
                            </View>

                            {/* PREFERENCES & SECURITY */}
                            <Text className="text-slate-500 font-medium text-[10px] uppercase tracking-wider mb-2 ml-1">Security & Notifications</Text>
                            <View className="bg-white rounded-xl border border-slate-200 mb-5">
                                <View className="flex-row justify-between items-center p-3 border-b border-slate-100">
                                    <View>
                                        <Text className="text-slate-700 font-medium text-xs">Two-Factor Auth</Text>
                                        <Text className="text-slate-400 text-[9px]">Require OTP on login</Text>
                                    </View>
                                    <Switch 
                                        value={twoFA} 
                                        onValueChange={(val) => updatePreference('twoFA', val)} 
                                        trackColor={{ false: '#e2e8f0', true: '#0F172A' }} 
                                        style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} 
                                    />
                                </View>
                                
                                <View className="flex-row justify-between items-center p-3 border-b border-slate-100">
                                    <View>
                                        <Text className="text-slate-700 font-medium text-xs">Push Alerts</Text>
                                        <Text className="text-slate-400 text-[9px]">Live notification on actions</Text>
                                    </View>
                                    <Switch 
                                        value={pushNotifs} 
                                        onValueChange={(val) => updatePreference('pushNotifs', val)} 
                                        trackColor={{ false: '#e2e8f0', true: '#0F172A' }} 
                                        style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} 
                                    />
                                </View>

                                <View className="flex-row justify-between items-center p-3">
                                    <View>
                                        <Text className="text-slate-700 font-medium text-xs">Email Digest</Text>
                                        <Text className="text-slate-400 text-[9px]">Daily summary reports</Text>
                                    </View>
                                    <Switch 
                                        value={emailAlerts} 
                                        onValueChange={(val) => updatePreference('emailAlerts', val)} 
                                        trackColor={{ false: '#e2e8f0', true: '#0F172A' }} 
                                        style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} 
                                    />
                                </View>
                            </View>

                            {/* DANGER ZONE - ADVANCED CONTROLS */}
                            <Text className="text-red-500 font-medium text-[10px] uppercase tracking-wider mb-2 ml-1 mt-2">Critical Operations</Text>
                            <View className="bg-red-50 rounded-xl border border-red-100 mb-6 overflow-hidden">
                                <View className="flex-row justify-between items-center p-3 border-b border-red-100/50">
                                    <View>
                                        <Text className="text-red-700 font-bold text-xs">Maintenance Mode</Text>
                                        <Text className="text-red-500/80 text-[9px]">Blocks all users from logging in</Text>
                                    </View>
                                    <Switch 
                                        value={maintenanceMode} 
                                        onValueChange={toggleMaintenanceMode} 
                                        trackColor={{ false: '#fca5a5', true: '#dc2626' }} 
                                        style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} 
                                    />
                                </View>

                                <TouchableOpacity 
                                    className="flex-row items-center justify-between p-3"
                                    onPress={handleClearCache}
                                    disabled={clearingCache}
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="trash-bin-outline" size={14} color="#ef4444" />
                                        <Text className="text-red-700 font-medium text-xs">{clearingCache ? 'Clearing...' : 'Clear System Cache'}</Text>
                                    </View>
                                    {clearingCache ? <ActivityIndicator size="small" color="#ef4444" /> : <Ionicons name="chevron-forward" size={12} color="#fca5a5" />}
                                </TouchableOpacity>
                            </View>

                            {/* ADVANCED ADMIN SHORTCUTS */}
                            <Text className="text-slate-500 font-medium text-[10px] uppercase tracking-wider mb-2 ml-1">Quick Commands</Text>
                            <View className="bg-white rounded-xl border border-slate-200 mb-6">
                                <TouchableOpacity 
                                    className="flex-row items-center justify-between p-3 border-b border-slate-100"
                                    onPress={() => setShowPasswordModal(true)}
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="key-outline" size={14} color="#64748b" />
                                        <Text className="text-slate-700 font-medium text-xs">Change Password</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={12} color="#cbd5e1" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    className="flex-row items-center justify-between p-3 border-b border-slate-100" 
                                    onPress={() => router.push('/manage/logs')}
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="list-outline" size={14} color="#64748b" />
                                        <Text className="text-slate-700 font-medium text-xs">View System Logs</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={12} color="#cbd5e1" />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    className="flex-row justify-between items-center p-3" 
                                    onPress={handleSignOut}
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="log-out-outline" size={14} color="#ef4444" />
                                        <Text className="text-red-500 font-medium text-xs">Sign Out Securely</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Change Password Modal */}
                <Modal visible={showPasswordModal} animationType="slide" transparent>
                    <View className="flex-1 bg-black/50 justify-center px-4">
                        <View className="bg-white p-5 rounded-xl border border-slate-200">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="font-bold text-slate-800 text-sm">Update Password</Text>
                                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                                    <Ionicons name="close" size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>

                            <Text className="text-slate-500 text-[10px] mb-2 uppercase font-medium">New Password</Text>
                            <TextInput
                                value={newPassword}
                                onChangeText={setNewPassword}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs mb-4"
                                secureTextEntry
                                placeholder="Enter new password"
                            />

                            <TouchableOpacity 
                                onPress={handleChangePassword}
                                disabled={changingPassword || newPassword.length < 6}
                                className={`bg-slate-800 py-3 rounded-lg items-center ${changingPassword || newPassword.length < 6 ? 'opacity-50' : ''}`}
                            >
                                {changingPassword ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-medium text-xs">Update & Relogin</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
