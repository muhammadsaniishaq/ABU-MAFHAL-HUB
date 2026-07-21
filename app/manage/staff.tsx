import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function StaffManager() {
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
    const [adminLogs, setAdminLogs] = useState<any[]>([]);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        fetchStaff();
    }, []);

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

    const openAdminProfile = async (admin: any) => {
        setSelectedAdmin(admin);
        setShowAdminModal(true);
        setLoadingLogs(true);
        
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('admin_id', admin.id)
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (!error) setAdminLogs(data || []);
        setLoadingLogs(false);
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
                                
                                <View className="flex-row gap-2">
                                    <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                                        <Text className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider">{selectedAdmin.role}</Text>
                                    </View>
                                    <View className="bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                                        <Text className="text-blue-400 font-bold text-[10px] uppercase tracking-wider">{selectedAdmin.status}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Activity Timeline */}
                            <View className="flex-1 px-6 pt-6">
                                <Text className="text-slate-800 font-black text-sm uppercase tracking-wider mb-4">Activity Timeline (Logs)</Text>
                                
                                {loadingLogs ? (
                                    <ActivityIndicator size="large" color="#0F172A" className="mt-10" />
                                ) : adminLogs.length === 0 ? (
                                    <View className="items-center justify-center mt-10">
                                        <Ionicons name="document-text-outline" size={40} color="#cbd5e1" />
                                        <Text className="text-slate-400 mt-2 font-medium">No recent actions recorded</Text>
                                    </View>
                                ) : (
                                    <FlatList 
                                        data={adminLogs}
                                        keyExtractor={item => item.id}
                                        showsVerticalScrollIndicator={false}
                                        renderItem={({ item }) => (
                                            <View className="flex-row mb-4">
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
                                        )}
                                    />
                                )}
                            </View>
                        </>
                    )}
                </View>
            </Modal>
        </View>
    );
}
