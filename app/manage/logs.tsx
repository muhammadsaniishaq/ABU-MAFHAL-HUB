import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    StyleSheet,
    Dimensions,
    Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';

// Executive Deep Midnight & Imperial Gold Theme
const T = {
    bg: '#040817',
    card: '#0b132b',
    cardSub: '#111d42',
    border: '#1c2c5b',
    borderLight: '#263870',
    gold: '#f5a623',
    goldBright: '#fbbf24',
    goldDark: '#d4890e',
    goldBg: 'rgba(245, 166, 35, 0.12)',
    navyPrimary: '#070D1E',
    navyDeep: '#0A1128',
    navyMid: '#0F172A',
    navyCard: '#1E293B',
    textMain: '#FFFFFF',
    textSub: '#94A3B8',
    textMuted: '#64748B',
    inputBg: '#0d1736',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.12)',
    danger: '#F43F5E',
    dangerBg: 'rgba(244, 63, 94, 0.12)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    info: '#38BDF8',
    infoBg: 'rgba(56, 189, 248, 0.12)',
    purple: '#A855F7',
    purpleBg: 'rgba(168, 85, 247, 0.12)',
    emerald: '#10B981',
    cyan: '#06B6D4',
};

interface AuditLogItem {
    id: string;
    admin_id: string | null;
    action: string;
    target_resource?: string | null;
    details?: any;
    created_at: string;
    profiles?: {
        full_name?: string;
        email?: string;
        avatar_url?: string;
        role?: string;
    } | null;
}

export default function EnterpriseAuditLogCenter() {
    const router = useRouter();

    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'security' | 'gateways' | 'finance' | 'policies' | 'kyc'>('all');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
    const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d'>('all');

    // Selected Log Modal
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    // New Log Entry Modal
    const [showNewLogModal, setShowNewLogModal] = useState(false);
    const [newLogAction, setNewLogAction] = useState('');
    const [newLogResource, setNewLogResource] = useState('');
    const [newLogDetails, setNewLogDetails] = useState('');
    const [submittingLog, setSubmittingLog] = useState(false);

    const triggerHaptic = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    useEffect(() => {
        fetchAuditLogs();
        const subscription = setupRealtimeLogs();
        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const fetchAuditLogs = async () => {
        try {
            setLoading(true);
            
            // 1. Authoritative fetch via Edge Function (bypasses RLS restrictions)
            let fetchedLogs: AuditLogItem[] = [];
            try {
                const { data: edgeRes } = await supabase.functions.invoke('admin-audit-logs', {
                    body: { action: 'list', limit: 200 }
                });
                if (edgeRes?.logs && Array.isArray(edgeRes.logs)) {
                    fetchedLogs = edgeRes.logs;
                }
            } catch (edgeErr) {
                console.warn('Edge function audit-logs notice, falling back to direct table:', edgeErr);
            }

            // 2. Direct fallback to Supabase table if edge function returned empty
            if (fetchedLogs.length === 0) {
                const { data: directData, error: directErr } = await supabase
                    .from('audit_logs')
                    .select('*, profiles:admin_id(full_name, email, avatar_url, role)')
                    .order('created_at', { ascending: false })
                    .limit(200);

                if (!directErr && directData) {
                    fetchedLogs = directData;
                }
            }

            setLogs(fetchedLogs);
        } catch (e) {
            console.error('Audit log error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        triggerHaptic();
        fetchAuditLogs();
    }, []);

    // Real-Time Supabase Subscription
    const setupRealtimeLogs = () => {
        const channel = supabase
            .channel('live_audit_logs_feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_logs' },
                async (payload: any) => {
                    let fullLog = payload.new;
                    if (fullLog.admin_id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, email, avatar_url, role')
                            .eq('id', fullLog.admin_id)
                            .maybeSingle();
                        fullLog.profiles = profile;
                    }
                    setLogs(prev => [fullLog, ...prev]);
                }
            )
            .subscribe();

        return channel;
    };

    // Classify Action Severity
    const getSeverity = (action: string): 'critical' | 'warning' | 'security' | 'info' => {
        const lower = (action || '').toLowerCase();
        if (lower.includes('freeze') || lower.includes('killswitch') || lower.includes('block') || lower.includes('failed') || lower.includes('delete') || lower.includes('quarantine') || lower.includes('error')) {
            return 'critical';
        }
        if (lower.includes('update') || lower.includes('policy') || lower.includes('rate') || lower.includes('limit') || lower.includes('reverse') || lower.includes('refund')) {
            return 'warning';
        }
        if (lower.includes('auth') || lower.includes('login') || lower.includes('pin') || lower.includes('kyc') || lower.includes('bvn') || lower.includes('nin') || lower.includes('security')) {
            return 'security';
        }
        return 'info';
    };

    // Classify Category
    const getCategory = (log: AuditLogItem): 'security' | 'gateways' | 'finance' | 'policies' | 'kyc' | 'other' => {
        const action = (log.action || '').toLowerCase();
        const res = (log.target_resource || '').toLowerCase();

        if (action.includes('payvessel') || action.includes('bigi') || action.includes('bilal') || action.includes('clubkonnect') || action.includes('nowpayments') || action.includes('termii') || action.includes('nineboost') || action.includes('gateway') || action.includes('api') || res.includes('gateway')) {
            return 'gateways';
        }
        if (action.includes('refund') || action.includes('transfer') || action.includes('wallet') || action.includes('balance') || action.includes('credit') || action.includes('debit') || action.includes('payout') || action.includes('deposit') || res.includes('vault')) {
            return 'finance';
        }
        if (action.includes('policy') || action.includes('limit') || action.includes('killswitch') || action.includes('freeze') || action.includes('rule') || action.includes('blacklist') || res.includes('policy')) {
            return 'policies';
        }
        if (action.includes('kyc') || action.includes('nin') || action.includes('bvn') || action.includes('tier') || action.includes('identity')) {
            return 'kyc';
        }
        if (action.includes('auth') || action.includes('login') || action.includes('pin') || action.includes('password') || action.includes('security') || res.includes('security')) {
            return 'security';
        }
        return 'other';
    };

    // Computed Filtered Logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const act = (log.action || '').toLowerCase();
            const res = (log.target_resource || '').toLowerCase();
            const adminName = (log.profiles?.full_name || '').toLowerCase();
            const adminEmail = (log.profiles?.email || '').toLowerCase();
            const detailsStr = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
            const query = search.toLowerCase().trim();

            const matchesSearch = !query || act.includes(query) || res.includes(query) || adminName.includes(query) || adminEmail.includes(query) || detailsStr.includes(query);
            if (!matchesSearch) return false;

            if (categoryFilter !== 'all') {
                const cat = getCategory(log);
                if (cat !== categoryFilter) return false;
            }

            if (severityFilter !== 'all') {
                const sev = getSeverity(log.action);
                if (sev !== severityFilter) return false;
            }

            if (timeFilter !== 'all') {
                const logTime = new Date(log.created_at).getTime();
                const now = Date.now();
                const hoursDiff = (now - logTime) / (1000 * 60 * 60);
                if (timeFilter === '24h' && hoursDiff > 24) return false;
                if (timeFilter === '7d' && hoursDiff > 168) return false;
            }

            return true;
        });
    }, [logs, search, categoryFilter, severityFilter, timeFilter]);

    // Dynamic Statistics
    const stats = useMemo(() => {
        return {
            total: logs.length,
            critical: logs.filter(l => getSeverity(l.action) === 'critical').length,
            gateways: logs.filter(l => getCategory(l) === 'gateways').length,
            policiesCount: logs.filter(l => getCategory(l) === 'policies').length,
            securityCount: logs.filter(l => getCategory(l) === 'security').length,
        };
    }, [logs]);

    // Dispatch New Manual Audit Log Entry
    const handleCreateLogEntry = async () => {
        if (!newLogAction.trim()) {
            Alert.alert('Required Field', 'Please enter an action or incident title.');
            return;
        }

        setSubmittingLog(true);
        triggerHaptic();

        try {
            const { data: authUser } = await supabase.auth.getUser();
            let parsedDetails: any = newLogDetails.trim();
            try {
                if (parsedDetails.startsWith('{') && parsedDetails.endsWith('}')) {
                    parsedDetails = JSON.parse(parsedDetails);
                } else {
                    parsedDetails = { note: newLogDetails.trim() || 'Manual executive security entry' };
                }
            } catch (e) {
                parsedDetails = { note: newLogDetails.trim() };
            }

            // Dispatch via edge function for guaranteed persistence
            const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('admin-audit-logs', {
                body: {
                    action: 'create',
                    logData: {
                        action_title: newLogAction.trim(),
                        target_resource: newLogResource.trim() || 'Executive Manual Audit',
                        details: parsedDetails,
                        admin_id: authUser?.user?.id || null
                    }
                }
            });

            if (edgeErr) throw edgeErr;
            if (edgeRes?.error) throw new Error(edgeRes.error);

            Alert.alert('Log Committed 🛡️', 'Security audit event recorded successfully into immutable trail.');
            setShowNewLogModal(false);
            setNewLogAction('');
            setNewLogResource('');
            setNewLogDetails('');
            fetchAuditLogs();
        } catch (err: any) {
            Alert.alert('Commit Failed', err.message || 'Could not record audit log entry.');
        } finally {
            setSubmittingLog(false);
        }
    };

    const handleExportAuditReport = async () => {
        triggerHaptic();
        const textReport = `ABU MAFHAL SUB - SYSTEM AUDIT LOG REPORT
Generated At: ${new Date().toUTCString()}
Total Events Logged: ${logs.length}
Critical Incidents: ${stats.critical}
Gateway Events: ${stats.gateways}

Recent Audit Trail:
${logs.slice(0, 20).map((l, i) => `${i + 1}. [${new Date(l.created_at).toLocaleString()}] ${l.action} | Resource: ${l.target_resource || 'System'} | Admin: ${l.profiles?.full_name || 'System'}`).join('\n')}
`;

        if (Platform.OS === 'web') {
            await Clipboard.setStringAsync(textReport);
            Alert.alert('Report Copied 📋', 'Full system audit report copied to clipboard.');
        } else {
            await Share.share({ message: textReport, title: 'Abu Mafhal Audit Report' });
        }
    };

    const formatTimestamp = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `Today • ${timeStr}`;
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`;
    };

    return (
        <View style={s.container}>
            <Stack.Screen
                options={{
                    title: 'System Audit Logs',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setShowNewLogModal(true)} style={s.headerGoldBtn}>
                                <Ionicons name="add" size={18} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleExportAuditReport} style={s.headerGoldBtn}>
                                <Ionicons name="share-outline" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={s.headerGoldBtn}>
                                <Ionicons name="refresh" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* TOP METRIC TELEMETRY BAR */}
            <LinearGradient
                colors={[T.navyPrimary, T.navyDeep, T.navyMid]}
                style={s.heroSummaryBar}
            >
                <View style={s.liveIndicatorRow}>
                    <View style={s.pulseDot} />
                    <Text style={s.liveIndicatorText}>LIVE PLATFORM AUDIT STREAM</Text>
                    <View style={s.liveBadge}>
                        <Text style={s.liveBadgeText}>IMMUTABLE TRAIL</Text>
                    </View>
                </View>

                <View style={s.summaryGrid}>
                    <View style={s.summaryItem}>
                        <Text style={s.summaryValue}>{stats.total}</Text>
                        <Text style={s.summaryLabel}>Total Events</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryItem}>
                        <Text style={[s.summaryValue, { color: T.danger }]}>{stats.critical}</Text>
                        <Text style={s.summaryLabel}>Critical</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryItem}>
                        <Text style={[s.summaryValue, { color: T.goldBright }]}>{stats.gateways}</Text>
                        <Text style={s.summaryLabel}>Gateways</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryItem}>
                        <Text style={[s.summaryValue, { color: T.info }]}>{stats.securityCount}</Text>
                        <Text style={s.summaryLabel}>Security</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* SUB-NAVIGATION FILTER RIBBON */}
            <View style={s.filterRibbon}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
                    {[
                        { key: 'all', label: 'All Events', icon: 'layers-outline' },
                        { key: 'gateways', label: 'Gateways (9PSB/PalmPay)', icon: 'card-outline' },
                        { key: 'finance', label: 'Finance & Vault', icon: 'wallet-outline' },
                        { key: 'security', label: 'Security & 2FA', icon: 'shield-outline' },
                        { key: 'policies', label: 'Policy Controls', icon: 'lock-closed-outline' },
                        { key: 'kyc', label: 'KYC & Identity', icon: 'finger-print-outline' },
                    ].map(cat => {
                        const active = categoryFilter === cat.key;
                        return (
                            <TouchableOpacity
                                key={cat.key}
                                onPress={() => {
                                    triggerHaptic();
                                    setCategoryFilter(cat.key as any);
                                }}
                                style={[s.filterPill, active && s.filterPillActive]}
                                activeOpacity={0.8}
                            >
                                <Ionicons 
                                    name={cat.icon as any} 
                                    size={12} 
                                    color={active ? T.goldBright : T.textMuted} 
                                />
                                <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* SEARCH AND TIME SELECTOR ROW */}
            <View style={s.searchBarRow}>
                <View style={s.searchBox}>
                    <Ionicons name="search" size={15} color={T.textMuted} style={{ marginRight: 6 }} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search logs by action, admin, resource, IP..."
                        placeholderTextColor={T.textMuted}
                        style={s.searchInput}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={16} color={T.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Time Range Selector */}
                <View style={s.timeRangeWrap}>
                    {(['all', '24h', '7d'] as const).map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => {
                                triggerHaptic();
                                setTimeFilter(t);
                            }}
                            style={[s.timeBtn, timeFilter === t && s.timeBtnActive]}
                        >
                            <Text style={[s.timeBtnText, timeFilter === t && s.timeBtnTextActive]}>
                                {t.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* MAIN LOGS FEED */}
            {loading ? (
                <View style={s.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={s.loadingText}>Loading Live Audit Trail...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredLogs}
                    keyExtractor={item => item.id}
                    contentContainerStyle={s.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Ionicons name="shield-checkmark" size={42} color={T.emerald} />
                            <Text style={s.emptyStateTitle}>Zero Incidents Found</Text>
                            <Text style={s.emptyStateSub}>All systems nominal. No audit logs matching current filter parameters.</Text>
                            <TouchableOpacity onPress={onRefresh} style={s.emptyRefreshBtn}>
                                <Ionicons name="refresh" size={14} color={T.goldBright} />
                                <Text style={s.emptyRefreshText}>Refresh Stream</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const sev = getSeverity(item.action);
                        return (
                            <TouchableOpacity
                                onPress={() => {
                                    triggerHaptic();
                                    setSelectedLog(item);
                                }}
                                style={s.logCard}
                                activeOpacity={0.8}
                            >
                                <View style={s.logHeader}>
                                    <View style={s.logActionWrap}>
                                        <View style={[
                                            s.sevDot,
                                            sev === 'critical' ? s.sevDotCritical :
                                            sev === 'warning' ? s.sevDotWarning :
                                            sev === 'security' ? s.sevDotSecurity : s.sevDotInfo
                                        ]} />
                                        <Text style={s.logActionText} numberOfLines={1}>
                                            {item.action}
                                        </Text>
                                    </View>
                                    <Text style={s.logTimestamp}>{formatTimestamp(item.created_at)}</Text>
                                </View>

                                {item.details && (
                                    <Text style={s.logDetailsText} numberOfLines={2}>
                                        {typeof item.details === 'string'
                                            ? item.details
                                            : item.details.note || item.details.reason || item.details.subject || item.details.status || JSON.stringify(item.details)}
                                    </Text>
                                )}

                                <View style={s.logFooter}>
                                    <View style={s.adminBadge}>
                                        <Ionicons name="person-circle-outline" size={14} color={T.gold} />
                                        <Text style={s.adminBadgeText} numberOfLines={1}>
                                            {item.profiles?.full_name || item.profiles?.email || 'System'}
                                        </Text>
                                    </View>

                                    <View style={s.resourceTag}>
                                        <Text style={s.resourceTagText} numberOfLines={1}>
                                            {item.target_resource || 'System Global'}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* MODAL 1: EVENT DETAILS INSPECTOR */}
            <Modal
                visible={!!selectedLog}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedLog(null)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="shield-checkmark" size={20} color={T.gold} />
                                <Text style={s.modalTitle}>Audit Event Inspection</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedLog(null)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={20} color={T.textMain} />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                                <View style={s.modalActionHero}>
                                    <Text style={s.modalActionLabel}>ACTION EXECUTED</Text>
                                    <Text style={s.modalActionValue}>{selectedLog.action}</Text>
                                    <Text style={s.modalTimeValue}>{new Date(selectedLog.created_at).toUTCString()}</Text>
                                </View>

                                <View style={s.infoRow}>
                                    <Text style={s.infoLabel}>Initiating Actor</Text>
                                    <Text style={s.infoValue}>{selectedLog.profiles?.full_name || selectedLog.profiles?.email || 'Automated Core Process'}</Text>
                                </View>

                                <View style={s.infoRow}>
                                    <Text style={s.infoLabel}>Admin Role</Text>
                                    <Text style={[s.infoValue, { color: T.goldBright }]}>{selectedLog.profiles?.role?.toUpperCase() || 'SYSTEM'}</Text>
                                </View>

                                <View style={s.infoRow}>
                                    <Text style={s.infoLabel}>Target Resource</Text>
                                    <Text style={s.infoValue}>{selectedLog.target_resource || 'System Global'}</Text>
                                </View>

                                <View style={s.infoRow}>
                                    <Text style={s.infoLabel}>Event Reference UUID</Text>
                                    <Text style={[s.infoValue, { fontSize: 10, color: T.cyan }]}>{selectedLog.id}</Text>
                                </View>

                                <Text style={s.payloadHeading}>Payload & Event Metadata:</Text>
                                <View style={s.jsonPayloadBox}>
                                    <Text style={s.jsonPayloadText}>
                                        {JSON.stringify(selectedLog.details || {}, null, 2)}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={async () => {
                                        triggerHaptic();
                                        await Clipboard.setStringAsync(JSON.stringify(selectedLog, null, 2));
                                        Alert.alert('Copied 📋', 'Full JSON event copied to clipboard.');
                                    }}
                                    style={s.modalCopyBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="copy-outline" size={16} color="#000000" />
                                    <Text style={s.modalCopyBtnText}>Copy Event JSON</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: DISPATCH MANUAL AUDIT ENTRY */}
            <Modal
                visible={showNewLogModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowNewLogModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="create-outline" size={20} color={T.gold} />
                                <Text style={s.modalTitle}>Dispatch Security Audit Entry</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowNewLogModal(false)} style={s.modalCloseBtn}>
                                <Ionicons name="close" size={20} color={T.textMain} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                            <Text style={s.inputLabel}>Action / Incident Title</Text>
                            <TextInput
                                value={newLogAction}
                                onChangeText={setNewLogAction}
                                placeholder="e.g. Manual Liquidity Vault Reconciliation"
                                placeholderTextColor={T.textMuted}
                                style={s.modalInput}
                            />

                            <Text style={s.inputLabel}>Target Resource</Text>
                            <TextInput
                                value={newLogResource}
                                onChangeText={setNewLogResource}
                                placeholder="e.g. Payvessel / Paystack Reserves"
                                placeholderTextColor={T.textMuted}
                                style={s.modalInput}
                            />

                            <Text style={s.inputLabel}>Audit Note / JSON Details</Text>
                            <TextInput
                                value={newLogDetails}
                                onChangeText={setNewLogDetails}
                                placeholder="e.g. Audited float balances with zero discrepancy."
                                placeholderTextColor={T.textMuted}
                                multiline
                                numberOfLines={3}
                                style={[s.modalInput, { height: 75, textAlignVertical: 'top' }]}
                            />

                            <TouchableOpacity
                                onPress={handleCreateLogEntry}
                                disabled={submittingLog}
                                style={s.modalSaveBtn}
                                activeOpacity={0.85}
                            >
                                {submittingLog ? (
                                    <ActivityIndicator size="small" color="#000000" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={17} color="#000000" />
                                        <Text style={s.modalSaveBtnText}>Commit to Immutable Audit Trail</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: T.bg,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 12.5,
        fontWeight: '700',
        color: T.textSub,
    },
    headerGoldBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroSummaryBar: {
        paddingHorizontal: 14,
        paddingTop: Platform.OS === 'ios' ? 12 : 8,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    liveIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    pulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.emerald,
    },
    liveIndicatorText: {
        fontSize: 10,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 0.8,
    },
    liveBadge: {
        backgroundColor: T.goldBg,
        borderColor: T.goldDark,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 6,
    },
    liveBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: T.goldBright,
    },
    summaryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: T.card,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: T.border,
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '900',
        color: T.textMain,
    },
    summaryLabel: {
        fontSize: 9.5,
        color: T.textSub,
        fontWeight: '700',
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 20,
        backgroundColor: T.border,
    },
    filterRibbon: {
        backgroundColor: T.navyPrimary,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        paddingVertical: 8,
    },
    filterScroll: {
        paddingHorizontal: 12,
        gap: 8,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.border,
    },
    filterPillActive: {
        backgroundColor: T.cardSub,
        borderColor: T.gold,
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textMuted,
    },
    filterPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    searchBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        backgroundColor: T.navyDeep,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.borderLight,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: T.textMain,
        fontWeight: '500',
    },
    timeRangeWrap: {
        flexDirection: 'row',
        backgroundColor: T.inputBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.borderLight,
        padding: 2,
        gap: 2,
    },
    timeBtn: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
    },
    timeBtnActive: {
        backgroundColor: T.cardSub,
        borderWidth: 1,
        borderColor: T.gold,
    },
    timeBtnText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: T.textMuted,
    },
    timeBtnTextActive: {
        color: T.goldBright,
    },
    listContent: {
        padding: 12,
        paddingBottom: 32,
    },
    emptyState: {
        backgroundColor: T.card,
        borderRadius: 14,
        padding: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.border,
        marginTop: 14,
    },
    emptyStateTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: T.textMain,
        marginTop: 10,
        marginBottom: 4,
    },
    emptyStateSub: {
        fontSize: 11.5,
        color: T.textSub,
        textAlign: 'center',
        lineHeight: 16,
    },
    emptyRefreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: T.goldBg,
        borderColor: T.goldDark,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 14,
    },
    emptyRefreshText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.goldBright,
    },
    logCard: {
        backgroundColor: T.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 8,
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    logActionWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        marginRight: 8,
    },
    sevDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    sevDotCritical: {
        backgroundColor: T.danger,
    },
    sevDotWarning: {
        backgroundColor: T.warning,
    },
    sevDotSecurity: {
        backgroundColor: T.purple,
    },
    sevDotInfo: {
        backgroundColor: T.info,
    },
    logActionText: {
        fontSize: 13,
        fontWeight: '900',
        color: T.textMain,
    },
    logTimestamp: {
        fontSize: 10,
        color: T.textMuted,
        fontWeight: '600',
    },
    logDetailsText: {
        fontSize: 11.5,
        color: T.textSub,
        lineHeight: 16,
        marginBottom: 8,
    },
    logFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: T.border,
        paddingTop: 8,
    },
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    adminBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textMain,
    },
    resourceTag: {
        backgroundColor: T.cardSub,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.borderLight,
    },
    resourceTagText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: T.cyan,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(4, 8, 23, 0.85)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: T.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 18,
        maxHeight: '88%',
        borderWidth: 1,
        borderColor: T.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: T.textMain,
    },
    modalCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: T.cardSub,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalActionHero: {
        backgroundColor: T.cardSub,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: T.borderLight,
    },
    modalActionLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    modalActionValue: {
        fontSize: 14,
        fontWeight: '900',
        color: T.textMain,
        marginBottom: 4,
    },
    modalTimeValue: {
        fontSize: 10.5,
        color: T.textMuted,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    infoLabel: {
        fontSize: 11.5,
        color: T.textSub,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textMain,
    },
    payloadHeading: {
        fontSize: 11,
        fontWeight: '800',
        color: T.goldBright,
        marginTop: 14,
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    jsonPayloadBox: {
        backgroundColor: '#020510',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 14,
    },
    jsonPayloadText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 11,
        color: T.cyan,
        lineHeight: 16,
    },
    modalCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: T.gold,
        paddingVertical: 12,
        borderRadius: 10,
    },
    modalCopyBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#000000',
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: T.textSub,
        marginBottom: 4,
        marginTop: 10,
    },
    modalInput: {
        backgroundColor: T.inputBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.borderLight,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: T.textMain,
        fontSize: 12.5,
    },
    modalSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: T.gold,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 16,
    },
    modalSaveBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#000000',
    },
});
