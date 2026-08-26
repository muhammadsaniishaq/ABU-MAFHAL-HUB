import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Image,
    ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
    ScrollView, Platform, StyleSheet, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { verificationHistory } from '../../services/verificationHistory';
import * as Clipboard from 'expo-clipboard';

// Executive Navy & Gold Design Tokens
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: 'rgba(212, 175, 55, 0.25)',
    navy: '#0B192C',
    navyMid: '#1E293B',
    navyLight: '#F1F5F9',
    gold: '#D4AF37',
    goldDk: '#B45309',
    goldLight: '#FEF9E7',
    goldBorder: '#FCD34D',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    purple: '#8B5CF6',
    purpleBg: '#F5F3FF',
};

const SERVICE_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    'nin_standard': { label: 'Standard Slip', icon: 'document-text-outline', color: '#3B82F6', bg: '#EFF6FF' },
    'nin_premium': { label: 'Premium Slip', icon: 'star-outline', color: '#D4AF37', bg: '#FEF9E7' },
    'nin_regular': { label: 'Regular Slip', icon: 'document-outline', color: '#0B192C', bg: '#F1F5F9' },
    'nin_mod_name': { label: 'Name Mod', icon: 'create-outline', color: '#B45309', bg: '#FEF9E7' },
    'nin_mod_phone': { label: 'Phone Mod', icon: 'call-outline', color: '#B45309', bg: '#FEF9E7' },
    'nin_mod_address': { label: 'Address Mod', icon: 'home-outline', color: '#B45309', bg: '#FEF9E7' },
    'nin_mod_dob': { label: 'DOB Mod', icon: 'calendar-outline', color: '#B45309', bg: '#FEF9E7' },
    'ipe_clearance': { label: 'IPE Clearance', icon: 'shield-checkmark-outline', color: '#10B981', bg: '#ECFDF5' },
    'nin_validation': { label: 'NIN Validation', icon: 'checkbox-outline', color: '#8B5CF6', bg: '#F5F3FF' },
    'pers_status': { label: 'Personalization', icon: 'finger-print-outline', color: '#0B192C', bg: '#F1F5F9' },
    'vnin_gen': { label: 'VNIN Generate', icon: 'key-outline', color: '#3B82F6', bg: '#EFF6FF' },
    'vnin_to_nin': { label: 'VNIN to NIN', icon: 'git-compare-outline', color: '#8B5CF6', bg: '#F5F3FF' },
    'nin_phone': { label: 'Phone Search', icon: 'search-outline', color: '#3B82F6', bg: '#EFF6FF' },
};

export default function NINTasksManagerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [backfilling, setBackfilling] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Inspector Modal
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [adminStatus, setAdminStatus] = useState<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'>('PROCESSING');
    const [adminNotes, setAdminNotes] = useState('');
    const [retrievedValue, setRetrievedValue] = useState('');
    const [updating, setUpdating] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const fetchNINTasks = async () => {
        try {
            setLoading(true);
            const combinedTasks = await verificationHistory.getAllForAdmin('nin');
            setTasks(combinedTasks);
        } catch (e) {
            console.warn('Failed to load NIN tasks', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNINTasks();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNINTasks();
    }, []);

    // Sync & Backfill Historical Transactions into permanent verification_history table
    const handleSyncAndBackfill = async () => {
        setBackfilling(true);
        try {
            const count = await verificationHistory.syncAndBackfillAll();
            Alert.alert("Sync Complete", `Successfully indexed ${count} past historical NIN & BVN records into permanent cloud records.`);
            fetchNINTasks();
        } catch (e: any) {
            Alert.alert("Sync Failed", e.message || "Failed to backfill historical tasks.");
        } finally {
            setBackfilling(false);
        }
    };

    // Filtered Tasks
    const filteredTasks = tasks.filter(task => {
        const details = task.details || {};
        const status = (details.status || 'COMPLETED').toUpperCase();

        // Status Filter
        if (statusFilter === 'pending' && status !== 'PENDING') return false;
        if (statusFilter === 'processing' && status !== 'PROCESSING') return false;
        if (statusFilter === 'completed' && status !== 'COMPLETED' && status !== 'SUCCESS') return false;
        if (statusFilter === 'failed' && status !== 'FAILED' && status !== 'REJECTED') return false;

        // Type Filter
        if (typeFilter !== 'all' && !task.service_type?.includes(typeFilter)) return false;

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const holder = (task.holder_name || '').toLowerCase();
            const searchNum = (task.search_number || '').toLowerCase();
            const email = (task.profiles?.email || '').toLowerCase();
            const userName = (task.profiles?.full_name || '').toLowerCase();
            const phone = (task.profiles?.phone_number || details.phone_number || details.current_phone || details.new_phone || '').toLowerCase();
            const ref = (details.reference || details.ref || details.request_id || task.id || '').toLowerCase();

            return holder.includes(q) || searchNum.includes(q) || email.includes(q) || userName.includes(q) || phone.includes(q) || ref.includes(q);
        }

        return true;
    });

    // Statistics
    const totalCount = tasks.length;
    const pendingCount = tasks.filter(t => (t.details?.status || '').toUpperCase() === 'PENDING' || (t.details?.status || '').toUpperCase() === 'PROCESSING').length;
    const completedCount = tasks.filter(t => (t.details?.status || 'COMPLETED').toUpperCase() === 'COMPLETED' || (t.details?.status || '').toUpperCase() === 'SUCCESS').length;
    const rejectedCount = tasks.filter(t => (t.details?.status || '').toUpperCase() === 'REJECTED' || (t.details?.status || '').toUpperCase() === 'FAILED').length;

    const copyText = async (text: string, fieldName: string) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleOpenInspector = (task: any) => {
        setSelectedTask(task);
        const details = task.details || {};
        const currentSt = (details.status || 'PROCESSING').toUpperCase();
        if (['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(currentSt)) {
            setAdminStatus(currentSt as any);
        } else {
            setAdminStatus('PROCESSING');
        }
        setAdminNotes(details.admin_notes || details.resolution_message || '');
        setRetrievedValue(details.retrieved_nin || details.nin || '');
    };

    const handleUpdateTask = async () => {
        if (!selectedTask) return;
        setUpdating(true);

        try {
            const updatedDetails = {
                ...(selectedTask.details || {}),
                status: adminStatus,
                admin_notes: adminNotes.trim(),
                resolution_message: adminNotes.trim(),
                retrieved_nin: retrievedValue.trim() || selectedTask.details?.retrieved_nin,
                resolved_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('verification_history')
                .update({
                    details: updatedDetails,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedTask.id);

            if (error) throw error;

            Alert.alert("Task Updated", `NIN request status updated to ${adminStatus} successfully.`);
            setSelectedTask(null);
            fetchNINTasks();
        } catch (e: any) {
            Alert.alert("Update Failed", e.message || "Failed to update task.");
        } finally {
            setUpdating(false);
        }
    };

    const handleContactUser = (type: 'whatsapp' | 'call' | 'email') => {
        const phone = selectedTask?.profiles?.phone_number || selectedTask?.details?.phone_number || selectedTask?.details?.current_phone || selectedTask?.details?.new_phone;
        const email = selectedTask?.profiles?.email;

        if (type === 'whatsapp' && phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            const intlPhone = cleanPhone.startsWith('0') ? `234${cleanPhone.slice(1)}` : cleanPhone;
            Linking.openURL(`https://wa.me/${intlPhone}?text=Hello%20${encodeURIComponent(selectedTask?.profiles?.full_name || 'Customer')},%20regarding%20your%20NIN%20service%20request%20on%20Abu%20Mafhal...`);
        } else if (type === 'call' && phone) {
            Linking.openURL(`tel:${phone}`);
        } else if (type === 'email' && email) {
            Linking.openURL(`mailto:${email}?subject=Update%20on%20your%20NIN%20Request`);
        } else {
            Alert.alert("Contact Info Missing", "Phone number or email is not available for this user.");
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'NIN Tasks & Applications',
                    headerStyle: { backgroundColor: C.navy },
                    headerTintColor: '#FFFFFF',
                    headerTitleStyle: { fontWeight: '700', fontSize: 16 },
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity onPress={handleSyncAndBackfill} disabled={backfilling} style={{ padding: 4 }}>
                                {backfilling ? (
                                    <ActivityIndicator size="small" color={C.gold} />
                                ) : (
                                    <Ionicons name="cloud-download-outline" size={20} color={C.gold} />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
                                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Top Summary Dashboard */}
            <LinearGradient colors={[C.navy, '#1E293B']} style={styles.topDashboard}>
                <View style={styles.metricsRow}>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricNum}>{totalCount}</Text>
                        <Text style={styles.metricLabel}>Total Tasks</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={[styles.metricNum, { color: C.warning }]}>{pendingCount}</Text>
                        <Text style={styles.metricLabel}>Pending/Proc</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={[styles.metricNum, { color: C.success }]}>{completedCount}</Text>
                        <Text style={styles.metricLabel}>Completed</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={[styles.metricNum, { color: C.danger }]}>{rejectedCount}</Text>
                        <Text style={styles.metricLabel}>Rejected</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search NIN, Tracking ID, Name, Ref, Phone..."
                        placeholderTextColor={C.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={C.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            {/* Filter Tabs */}
            <View style={styles.filterTabsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsList}>
                    {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.statusTabBtn, statusFilter === tab && styles.statusTabBtnActive]}
                            onPress={() => setStatusFilter(tab)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.statusTabText, statusFilter === tab && styles.statusTabTextActive]}>
                                {tab.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Service Type Filter Chips */}
            <View style={styles.typeChipsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChipsList}>
                    <TouchableOpacity
                        style={[styles.typeChip, typeFilter === 'all' && styles.typeChipActive]}
                        onPress={() => setTypeFilter('all')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.typeChipText, typeFilter === 'all' && styles.typeChipTextActive]}>All Services</Text>
                    </TouchableOpacity>
                    {Object.entries(SERVICE_LABELS).map(([key, info]) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.typeChip, typeFilter === key && styles.typeChipActive]}
                            onPress={() => setTypeFilter(key)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={info.icon} size={12} color={typeFilter === key ? '#FFFFFF' : info.color} style={{ marginRight: 4 }} />
                            <Text style={[styles.typeChipText, typeFilter === key && styles.typeChipTextActive]}>
                                {info.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Tasks List */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={C.gold} />
                    <Text style={styles.loadingText}>Loading NIN submissions & history...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredTasks}
                    keyExtractor={(item) => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
                    contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 40 }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="document-text-outline" size={48} color={C.textMuted} />
                            <Text style={styles.emptyTitle}>No NIN Tasks Found</Text>
                            <Text style={styles.emptySub}>Tap the cloud download icon above to backfill all past transaction records.</Text>
                            <TouchableOpacity style={styles.syncEmptyBtn} onPress={handleSyncAndBackfill}>
                                <Ionicons name="cloud-download-outline" size={16} color="#0B192C" style={{ marginRight: 6 }} />
                                <Text style={styles.syncEmptyBtnText}>Sync Historical Transactions</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const details = item.details || {};
                        const sType = item.service_type || 'nin_standard';
                        const sInfo = SERVICE_LABELS[sType] || { label: sType, icon: 'shield-outline', color: C.navy, bg: C.navyLight };
                        const status = (details.status || 'COMPLETED').toUpperCase();

                        const statusStyle =
                            status === 'COMPLETED' || status === 'SUCCESS' ? styles.statusBadgeSuccess :
                            status === 'PROCESSING' ? styles.statusBadgeWarning :
                            status === 'PENDING' ? styles.statusBadgeBlue : styles.statusBadgeDanger;

                        const statusTextColor =
                            status === 'COMPLETED' || status === 'SUCCESS' ? C.success :
                            status === 'PROCESSING' ? C.goldDk :
                            status === 'PENDING' ? C.blue : C.danger;

                        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

                        return (
                            <TouchableOpacity
                                style={styles.taskCard}
                                onPress={() => handleOpenInspector(item)}
                                activeOpacity={0.85}
                            >
                                <View style={styles.cardHeaderRow}>
                                    <View style={[styles.typePill, { backgroundColor: sInfo.bg }]}>
                                        <Ionicons name={sInfo.icon} size={13} color={sInfo.color} style={{ marginRight: 4 }} />
                                        <Text style={[styles.typePillText, { color: sInfo.color }]}>{sInfo.label}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, statusStyle]}>
                                        <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>{status}</Text>
                                    </View>
                                </View>

                                {/* User & Target Data */}
                                <View style={styles.cardBody}>
                                    <View style={styles.userRow}>
                                        <View style={styles.userAvatarBox}>
                                            <Text style={styles.userAvatarInitials}>
                                                {(item.holder_name || item.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.holderNameText} numberOfLines={1}>
                                                {item.holder_name || item.profiles?.full_name || 'NIN Applicant'}
                                            </Text>
                                            <Text style={styles.userMetaText} numberOfLines={1}>
                                                User: {item.profiles?.email || item.profiles?.full_name || 'Direct Client'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Identifiers Row */}
                                    <View style={styles.identifiersRow}>
                                        {item.search_number ? (
                                            <View style={styles.idChip}>
                                                <Text style={styles.idChipLabel}>NIN/Track:</Text>
                                                <Text style={styles.idChipVal}>{item.search_number}</Text>
                                            </View>
                                        ) : null}
                                        {details.phone_number || details.current_phone || details.new_phone ? (
                                            <View style={styles.idChip}>
                                                <Text style={styles.idChipLabel}>Phone:</Text>
                                                <Text style={styles.idChipVal}>{details.phone_number || details.current_phone || details.new_phone}</Text>
                                            </View>
                                        ) : null}
                                        {details.amount ? (
                                            <View style={[styles.idChip, { backgroundColor: '#FEF9E7' }]}>
                                                <Text style={[styles.idChipLabel, { color: C.goldDk }]}>Fee:</Text>
                                                <Text style={[styles.idChipVal, { color: C.goldDk }]}>₦{Number(details.amount).toLocaleString()}</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Modification Summary */}
                                    {details.new_first_name || details.first_name || details.new_address ? (
                                        <View style={styles.modPreviewBox}>
                                            <Text style={styles.modPreviewLabel}>Modification Target:</Text>
                                            <Text style={styles.modPreviewVal}>
                                                {details.new_first_name || details.first_name} {details.last_name || ''} {details.new_address || ''}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Footer */}
                                <View style={styles.cardFooter}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="time-outline" size={12} color={C.textMuted} style={{ marginRight: 4 }} />
                                        <Text style={styles.dateText}>{dateStr}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.inspectActionText}>Inspect & Manage</Text>
                                        <Ionicons name="chevron-forward" size={14} color={C.navy} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* Task Inspector & Resolution Modal */}
            <Modal
                visible={!!selectedTask}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedTask(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { maxHeight: '90%' }]}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Manage NIN Task</Text>
                                <Text style={styles.modalSub}>
                                    Ref: {selectedTask?.details?.reference || selectedTask?.details?.ref || selectedTask?.id}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedTask(null)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color={C.textMain} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 16 }}>
                            {/* Applicant Information */}
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>APPLICANT DETAILS</Text>
                                <View style={styles.infoGrid}>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>Applicant Name</Text>
                                        <Text style={styles.infoValue}>{selectedTask?.holder_name || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>Search / Target NIN</Text>
                                        <TouchableOpacity onPress={() => copyText(selectedTask?.search_number || '', 'nin')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={[styles.infoValue, { color: C.navy, fontWeight: '700' }]}>{selectedTask?.search_number || 'N/A'}</Text>
                                            <Ionicons name={copiedField === 'nin' ? "checkmark-circle" : "copy-outline"} size={13} color={C.goldDk} style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    </View>
                                    {selectedTask?.profiles?.email && (
                                        <View style={styles.infoItem}>
                                            <Text style={styles.infoLabel}>User Account</Text>
                                            <Text style={styles.infoValue}>{selectedTask?.profiles?.email}</Text>
                                        </View>
                                    )}
                                    {(selectedTask?.profiles?.phone_number || selectedTask?.details?.phone_number || selectedTask?.details?.current_phone || selectedTask?.details?.new_phone) && (
                                        <View style={styles.infoItem}>
                                            <Text style={styles.infoLabel}>Phone Number</Text>
                                            <Text style={styles.infoValue}>{selectedTask?.profiles?.phone_number || selectedTask?.details?.phone_number || selectedTask?.details?.current_phone || selectedTask?.details?.new_phone}</Text>
                                        </View>
                                    )}
                                    {selectedTask?.details?.amount && (
                                        <View style={styles.infoItem}>
                                            <Text style={styles.infoLabel}>Transaction Fee</Text>
                                            <Text style={[styles.infoValue, { color: C.goldDk, fontWeight: '700' }]}>₦{Number(selectedTask.details.amount).toLocaleString()}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Direct Communication Buttons */}
                            <View style={styles.contactRow}>
                                <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25D366' }]} onPress={() => handleContactUser('whatsapp')}>
                                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={styles.contactBtnText}>WhatsApp</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.contactBtn, { backgroundColor: C.navy }]} onPress={() => handleContactUser('call')}>
                                    <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={styles.contactBtnText}>Call User</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.contactBtn, { backgroundColor: C.blue }]} onPress={() => handleContactUser('email')}>
                                    <Ionicons name="mail" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={styles.contactBtnText}>Email</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Admin Resolution Panel */}
                            <View style={[styles.sectionCard, { borderColor: C.goldBorder, borderWidth: 1.5, backgroundColor: '#FFFDF9' }]}>
                                <Text style={[styles.sectionTitle, { color: C.goldDk }]}>ADMIN STATUS & RESOLUTION</Text>

                                <Text style={styles.inputLabel}>Update Status</Text>
                                <View style={styles.statusSelectRow}>
                                    {(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'] as const).map(st => (
                                        <TouchableOpacity
                                            key={st}
                                            style={[
                                                styles.statusOptBtn,
                                                adminStatus === st && styles.statusOptBtnActive,
                                                adminStatus === st && st === 'COMPLETED' && { backgroundColor: C.success, borderColor: C.success },
                                                adminStatus === st && st === 'REJECTED' && { backgroundColor: C.danger, borderColor: C.danger },
                                            ]}
                                            onPress={() => setAdminStatus(st)}
                                        >
                                            <Text style={[styles.statusOptText, adminStatus === st && { color: '#FFFFFF', fontWeight: '800' }]}>
                                                {st}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.inputLabel}>Resolved NIN or Result Reference (Optional)</Text>
                                    <TextInput
                                        style={styles.adminInput}
                                        placeholder="Enter NIN or Document Link/Reference"
                                        placeholderTextColor={C.textMuted}
                                        value={retrievedValue}
                                        onChangeText={setRetrievedValue}
                                    />
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.inputLabel}>Resolution Notes / Remarks</Text>
                                    <TextInput
                                        style={[styles.adminInput, { height: 75, textAlignVertical: 'top' }]}
                                        placeholder="Add comments or rejection reason for user..."
                                        placeholderTextColor={C.textMuted}
                                        multiline={true}
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.saveBtn, updating && { opacity: 0.7 }]}
                                    onPress={handleUpdateTask}
                                    disabled={updating}
                                    activeOpacity={0.8}
                                >
                                    {updating ? (
                                        <ActivityIndicator size="small" color="#0B192C" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-done" size={18} color="#0B192C" style={{ marginRight: 6 }} />
                                            <Text style={styles.saveBtnText}>Save & Apply Resolution</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    topDashboard: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 14,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    metricCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    metricNum: {
        fontSize: 17,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: C.textMuted,
        marginTop: 2,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 38,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: C.textMain,
    },
    filterTabsWrapper: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    filterTabsList: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    statusTabBtn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: C.navyLight,
    },
    statusTabBtnActive: {
        backgroundColor: C.navy,
    },
    statusTabText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSub,
    },
    statusTabTextActive: {
        color: '#FFFFFF',
    },
    typeChipsWrapper: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    typeChipsList: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
    },
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: '#FFFFFF',
    },
    typeChipActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    typeChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: C.textSub,
    },
    typeChipTextActive: {
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: C.textSub,
    },
    emptyState: {
        paddingTop: 50,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: C.textMain,
        marginTop: 12,
    },
    emptySub: {
        fontSize: 13,
        color: C.textSub,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    syncEmptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.gold,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        marginTop: 16,
    },
    syncEmptyBtnText: {
        color: '#0B192C',
        fontSize: 12,
        fontWeight: '800',
    },
    taskCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        overflow: 'hidden',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 6,
    },
    typePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    typePillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    statusBadgeSuccess: {
        backgroundColor: C.successBg,
    },
    statusBadgeWarning: {
        backgroundColor: C.warningBg,
    },
    statusBadgeBlue: {
        backgroundColor: C.blueBg,
    },
    statusBadgeDanger: {
        backgroundColor: C.dangerBg,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    cardBody: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    userAvatarBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.navy,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    userAvatarInitials: {
        color: C.gold,
        fontWeight: '800',
        fontSize: 14,
    },
    holderNameText: {
        fontSize: 14,
        fontWeight: '700',
        color: C.textMain,
    },
    userMetaText: {
        fontSize: 11,
        color: C.textMuted,
    },
    identifiersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    idChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.navyLight,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
    },
    idChipLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: C.textMuted,
        marginRight: 4,
    },
    idChipVal: {
        fontSize: 11,
        fontWeight: '700',
        color: C.navy,
    },
    modPreviewBox: {
        marginTop: 6,
        padding: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: C.gold,
    },
    modPreviewLabel: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '600',
    },
    modPreviewVal: {
        fontSize: 12,
        fontWeight: '700',
        color: C.textMain,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#FCFDFF',
    },
    dateText: {
        fontSize: 11,
        color: C.textMuted,
    },
    inspectActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.navy,
        marginRight: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        backgroundColor: C.navyLight,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.navy,
    },
    modalSub: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 6,
    },
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy,
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    infoGrid: {
        gap: 8,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: C.textSub,
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textMain,
    },
    contactRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    contactBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
    },
    contactBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    statusSelectRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    statusOptBtn: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    statusOptBtnActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    statusOptText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.textSub,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSub,
        marginBottom: 4,
    },
    adminInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12,
        color: C.textMain,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.gold,
        borderRadius: 8,
        paddingVertical: 12,
        marginTop: 14,
    },
    saveBtnText: {
        color: '#0B192C',
        fontSize: 14,
        fontWeight: '800',
    },
});
