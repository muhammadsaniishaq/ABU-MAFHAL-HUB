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
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Executive Royal Navy & Imperial Gold Theme
const T = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardBorderGold: 'rgba(217, 119, 6, 0.3)',
    navyPrimary: '#070D1E',
    navyDeep: '#0A1128',
    navyMid: '#0F172A',
    navyCard: '#1E293B',
    navyLight: '#334155',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldDark: '#B45309',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    border: '#CBD5E1',
    inputBg: '#F8FAFC',
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
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

    // New Log Entry Modal (Super Admin Note)
    const [showNewLogModal, setShowNewLogModal] = useState(false);
    const [newLogAction, setNewLogAction] = useState('');
    const [newLogResource, setNewLogResource] = useState('');
    const [newLogDetails, setNewLogDetails] = useState('');
    const [submittingLog, setSubmittingLog] = useState(false);

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
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*, profiles:admin_id(full_name, email, avatar_url, role)')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error fetching audit logs:', error);
            } else if (data) {
                setLogs(data);
            }
        } catch (e) {
            console.error('Audit log error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
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
        if (lower.includes('freeze') || lower.includes('killswitch') || lower.includes('block') || lower.includes('failed') || lower.includes('delete') || lower.includes('quarantine')) {
            return 'critical';
        }
        if (lower.includes('update') || lower.includes('policy') || lower.includes('rate') || lower.includes('limit') || lower.includes('reverse') || lower.includes('refund')) {
            return 'warning';
        }
        if (lower.includes('auth') || lower.includes('login') || lower.includes('pin') || lower.includes('kyc') || lower.includes('bvn') || lower.includes('nin')) {
            return 'security';
        }
        return 'info';
    };

    // Classify Category
    const getCategory = (log: AuditLogItem): 'security' | 'gateways' | 'finance' | 'policies' | 'kyc' | 'other' => {
        const action = (log.action || '').toLowerCase();
        const res = (log.target_resource || '').toLowerCase();

        if (action.includes('payvessel') || action.includes('bigi') || action.includes('bilal') || action.includes('clubkonnect') || action.includes('nowpayments') || action.includes('termii') || action.includes('nineboost') || action.includes('gateway') || action.includes('api')) {
            return 'gateways';
        }
        if (action.includes('refund') || action.includes('transfer') || action.includes('wallet') || action.includes('balance') || action.includes('credit') || action.includes('debit') || action.includes('payout')) {
            return 'finance';
        }
        if (action.includes('policy') || action.includes('limit') || action.includes('killswitch') || action.includes('freeze') || action.includes('rule') || action.includes('blacklist')) {
            return 'policies';
        }
        if (action.includes('kyc') || action.includes('nin') || action.includes('bvn') || action.includes('tier') || action.includes('identity')) {
            return 'kyc';
        }
        if (action.includes('auth') || action.includes('login') || action.includes('pin') || action.includes('password') || action.includes('security')) {
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
                const logDate = new Date(log.created_at).getTime();
                const now = Date.now();
                if (timeFilter === '24h' && (now - logDate) > 24 * 60 * 60 * 1000) return false;
                if (timeFilter === '7d' && (now - logDate) > 7 * 24 * 60 * 60 * 1000) return false;
            }

            return true;
        });
    }, [logs, search, categoryFilter, severityFilter, timeFilter]);

    // Aggregate Metric Stats
    const stats = useMemo(() => {
        let critical = 0;
        let gateways = 0;
        let policiesCount = 0;
        let finance = 0;

        logs.forEach(l => {
            const sev = getSeverity(l.action);
            const cat = getCategory(l);
            if (sev === 'critical') critical++;
            if (cat === 'gateways') gateways++;
            if (cat === 'policies') policiesCount++;
            if (cat === 'finance') finance++;
        });

        return { total: logs.length, critical, gateways, policiesCount, finance };
    }, [logs]);

    // Submit Custom Security Log Entry
    const handleCreateLogEntry = async () => {
        if (!newLogAction.trim()) {
            Alert.alert('Required', 'Please enter an action title for this audit entry.');
            return;
        }

        setSubmittingLog(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            let parsedDetails: any = newLogDetails.trim();
            try {
                if (newLogDetails.trim().startsWith('{') || newLogDetails.trim().startsWith('[')) {
                    parsedDetails = JSON.parse(newLogDetails.trim());
                }
            } catch (e) { }

            const { error } = await supabase.from('audit_logs').insert({
                admin_id: userData?.user?.id || null,
                action: newLogAction.trim(),
                target_resource: newLogResource.trim() || 'System',
                details: parsedDetails || { note: 'Manual Audit Entry by Super Admin' },
            });

            if (error) throw error;

            setShowNewLogModal(false);
            setNewLogAction('');
            setNewLogResource('');
            setNewLogDetails('');
            Alert.alert('Audit Logged ✅', 'Security incident record committed to audit stream.');
            fetchAuditLogs();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmittingLog(false);
        }
    };

    // Export Audit Report
    const handleExportAuditReport = async () => {
        const textReport = `=== ABUMAFHAL PLATFORM AUDIT & SECURITY REPORT ===
Timestamp: ${new Date().toISOString()}
Total Logs Captured: ${logs.length}
Critical Incidents: ${stats.critical}
Gateway Operations: ${stats.gateways}
Policy & Rule Enforcements: ${stats.policiesCount}

Top Recent Security Events:
${logs.slice(0, 15).map((l, i) => `${i + 1}. [${new Date(l.created_at).toLocaleString()}] ${l.action.toUpperCase()} | Res: ${l.target_resource || 'System'} | Admin: ${l.profiles?.full_name || 'System'}`).join('\n')}`;

        if (Platform.OS === 'web') {
            await Clipboard.setStringAsync(textReport);
            Alert.alert('Report Copied 📋', 'Full system audit logs copied to clipboard.');
        } else {
            await Share.share({ message: textReport, title: 'ABUMAFHAL Audit Logs' });
        }
    };

    const formatTimestamp = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (isToday) return timeStr;
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`;
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'System Audit Logs',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setShowNewLogModal(true)} style={styles.headerGoldBtn}>
                                <Ionicons name="add" size={18} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleExportAuditReport} style={styles.headerGoldBtn}>
                                <Ionicons name="share-outline" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={styles.headerGoldBtn}>
                                <Ionicons name="refresh" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Top Metric Telemetry Bar */}
            <LinearGradient
                colors={[T.navyPrimary, T.navyDeep, T.navyMid]}
                style={styles.heroSummaryBar}
            >
                <View style={styles.liveIndicatorRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.liveIndicatorText}>LIVE SYSTEM AUDIT STREAM</Text>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{stats.total}</Text>
                        <Text style={styles.summaryLabel}>Total Events</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.danger }]}>{stats.critical}</Text>
                        <Text style={styles.summaryLabel}>Critical</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.goldBright }]}>{stats.gateways}</Text>
                        <Text style={styles.summaryLabel}>Gateways</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.info }]}>{stats.policiesCount}</Text>
                        <Text style={styles.summaryLabel}>Policies</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Sub-Navigation Filter Ribbon */}
            <View style={styles.filterRibbon}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {[
                        { key: 'all', label: 'All Logs' },
                        { key: 'security', label: 'Security & Auth' },
                        { key: 'gateways', label: 'Gateways (Payvessel/Bigi/Bilal)' },
                        { key: 'finance', label: 'Finance & Refunds' },
                        { key: 'policies', label: 'Policy Rules' },
                        { key: 'kyc', label: 'KYC & Biometrics' },
                    ].map(cat => (
                        <TouchableOpacity
                            key={cat.key}
                            onPress={() => setCategoryFilter(cat.key as any)}
                            style={[styles.filterPill, categoryFilter === cat.key && styles.filterPillActive]}
                        >
                            <Text style={[styles.filterPillText, categoryFilter === cat.key && styles.filterPillTextActive]}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Search and Time Range Bar */}
            <View style={styles.searchBarRow}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={15} color={T.textMuted} style={{ marginRight: 6 }} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search logs by action, admin, resource, IP..."
                        placeholderTextColor={T.textMuted}
                        style={styles.searchInput}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={16} color={T.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Time Range Selector */}
                <View style={styles.timeRangeWrap}>
                    {(['all', '24h', '7d'] as const).map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setTimeFilter(t)}
                            style={[styles.timeBtn, timeFilter === t && styles.timeBtnActive]}
                        >
                            <Text style={[styles.timeBtnText, timeFilter === t && styles.timeBtnTextActive]}>
                                {t.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Main Logs List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={styles.loadingText}>Fetching Live Audit Log Trail...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredLogs}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="shield-checkmark" size={42} color={T.success} />
                            <Text style={styles.emptyStateTitle}>Zero Incidents Found</Text>
                            <Text style={styles.emptyStateSub}>No audit logs matching current filter parameters.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const sev = getSeverity(item.action);
                        return (
                            <TouchableOpacity
                                onPress={() => setSelectedLog(item)}
                                style={styles.logCard}
                                activeOpacity={0.75}
                            >
                                <View style={styles.logHeader}>
                                    <View style={styles.logActionWrap}>
                                        <View style={[
                                            styles.sevDot,
                                            sev === 'critical' ? styles.sevDotCritical :
                                            sev === 'warning' ? styles.sevDotWarning :
                                            sev === 'security' ? styles.sevDotSecurity : styles.sevDotInfo
                                        ]} />
                                        <Text style={styles.logActionText} numberOfLines={1}>
                                            {item.action}
                                        </Text>
                                    </View>
                                    <Text style={styles.logTimestamp}>{formatTimestamp(item.created_at)}</Text>
                                </View>

                                {item.details && (
                                    <Text style={styles.logDetailsText} numberOfLines={2}>
                                        {typeof item.details === 'string'
                                            ? item.details
                                            : item.details.note || item.details.reason || item.details.message || JSON.stringify(item.details)}
                                    </Text>
                                )}

                                <View style={styles.logFooter}>
                                    <View style={styles.adminBadge}>
                                        <Ionicons name="person-circle-outline" size={14} color={T.gold} />
                                        <Text style={styles.adminBadgeText} numberOfLines={1}>
                                            {item.profiles?.full_name || item.profiles?.email || 'System'}
                                        </Text>
                                    </View>

                                    <View style={styles.resourceTag}>
                                        <Text style={styles.resourceTagText} numberOfLines={1}>
                                            RES: {item.target_resource || 'Core Engine'}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL 1: AUDIT LOG EVENT INSPECTOR                                        */}
            {/* ========================================================================= */}
            <Modal
                visible={!!selectedLog}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedLog(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="shield-checkmark" size={18} color={T.gold} />
                                <Text style={styles.modalTitle}>Audit Event Details</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedLog(null)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalActionHero}>
                                    <Text style={styles.modalActionLabel}>ACTION EXECUTED</Text>
                                    <Text style={styles.modalActionValue}>{selectedLog.action}</Text>
                                    <Text style={styles.modalTimeValue}>{new Date(selectedLog.created_at).toUTCString()}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Initiating Actor</Text>
                                    <Text style={styles.infoValue}>{selectedLog.profiles?.full_name || selectedLog.profiles?.email || 'Automated Core Process'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Admin Role</Text>
                                    <Text style={[styles.infoValue, { color: T.gold }]}>{selectedLog.profiles?.role?.toUpperCase() || 'SYSTEM'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Target Resource</Text>
                                    <Text style={styles.infoValue}>{selectedLog.target_resource || 'System Global'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Event Reference Hash</Text>
                                    <Text style={[styles.infoValue, { fontSize: 10 }]}>{selectedLog.id}</Text>
                                </View>

                                <Text style={styles.payloadHeading}>Event Payload & Metadata:</Text>
                                <View style={styles.jsonPayloadBox}>
                                    <Text style={styles.jsonPayloadText}>
                                        {JSON.stringify(selectedLog.details || {}, null, 2)}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={async () => {
                                        await Clipboard.setStringAsync(JSON.stringify(selectedLog, null, 2));
                                        Alert.alert('Copied 📋', 'Full JSON event copied to clipboard.');
                                    }}
                                    style={styles.modalCopyBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                                    <Text style={styles.modalCopyBtnText}>Copy Event JSON</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: DISPATCH MANUAL AUDIT ENTRY                                      */}
            {/* ========================================================================= */}
            <Modal
                visible={showNewLogModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowNewLogModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Dispatch Security Audit Entry</Text>
                            <TouchableOpacity onPress={() => setShowNewLogModal(false)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Action / Incident Title</Text>
                        <TextInput
                            value={newLogAction}
                            onChangeText={setNewLogAction}
                            placeholder="e.g. Manual Liquidity Vault Reconciliation"
                            placeholderTextColor={T.textMuted}
                            style={styles.modalInput}
                        />

                        <Text style={styles.inputLabel}>Target Resource</Text>
                        <TextInput
                            value={newLogResource}
                            onChangeText={setNewLogResource}
                            placeholder="e.g. Payvessel / Paystack Reserves"
                            placeholderTextColor={T.textMuted}
                            style={styles.modalInput}
                        />

                        <Text style={styles.inputLabel}>Audit Note / JSON Details</Text>
                        <TextInput
                            value={newLogDetails}
                            onChangeText={setNewLogDetails}
                            placeholder="e.g. Audited float balances with 0 discrepancy."
                            placeholderTextColor={T.textMuted}
                            multiline
                            numberOfLines={3}
                            style={[styles.modalInput, { height: 75, textAlignVertical: 'top' }]}
                        />

                        <TouchableOpacity
                            onPress={handleCreateLogEntry}
                            disabled={submittingLog}
                            style={styles.modalSaveBtn}
                            activeOpacity={0.85}
                        >
                            {submittingLog ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={17} color={T.goldBright} />
                                    <Text style={styles.modalSaveBtnText}>Commit to Audit Trail</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
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
        backgroundColor: T.navyDeep,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroSummaryBar: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.cardBorderGold,
    },
    liveIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    pulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.success,
    },
    liveIndicatorText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 1,
    },
    summaryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 6, 0.2)',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    summaryLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 1,
    },
    summaryDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    filterRibbon: {
        backgroundColor: T.navyPrimary,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 119, 6, 0.2)',
        paddingVertical: 6,
    },
    filterScroll: {
        paddingHorizontal: 10,
        gap: 6,
    },
    filterPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: T.navyDeep,
    },
    filterPillActive: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: T.cardBorder,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 11.5,
        color: T.textMain,
        fontWeight: '600',
    },
    timeRangeWrap: {
        flexDirection: 'row',
        backgroundColor: T.inputBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        padding: 2,
        gap: 2,
    },
    timeBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    timeBtnActive: {
        backgroundColor: T.navyPrimary,
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
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginTop: 10,
    },
    emptyStateTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: T.textMain,
        marginTop: 8,
        marginBottom: 2,
    },
    emptyStateSub: {
        fontSize: 11,
        color: T.textMuted,
        textAlign: 'center',
    },
    logCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
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
        backgroundColor: T.gold,
    },
    sevDotSecurity: {
        backgroundColor: T.purple,
    },
    sevDotInfo: {
        backgroundColor: T.info,
    },
    logActionText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    logTimestamp: {
        fontSize: 10,
        color: T.textMuted,
        fontWeight: '600',
    },
    logDetailsText: {
        fontSize: 11,
        color: T.textSub,
        lineHeight: 15,
        marginBottom: 8,
    },
    logFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 6,
    },
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    adminBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: T.textMain,
    },
    resourceTag: {
        backgroundColor: T.goldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    resourceTagText: {
        fontSize: 9,
        fontWeight: '800',
        color: T.goldDark,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 13, 30, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    modalActionHero: {
        backgroundColor: T.navyPrimary,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    modalActionLabel: {
        color: T.goldBright,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 2,
    },
    modalActionValue: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        marginBottom: 2,
        textAlign: 'center',
    },
    modalTimeValue: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        fontSize: 11.5,
        color: T.textSub,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.textMain,
    },
    payloadHeading: {
        fontSize: 11.5,
        fontWeight: '900',
        color: T.navyPrimary,
        marginTop: 10,
        marginBottom: 4,
    },
    jsonPayloadBox: {
        backgroundColor: T.navyDeep,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginBottom: 14,
    },
    jsonPayloadText: {
        color: '#38BDF8',
        fontSize: 10.5,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    modalCopyBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginBottom: 16,
    },
    modalCopyBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 12.5,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.textMain,
        marginTop: 8,
        marginBottom: 4,
    },
    modalInput: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 8,
        fontWeight: '600',
    },
    modalSaveBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 10,
        marginBottom: 16,
    },
    modalSaveBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 12.5,
    },
});
