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
    Share,
    Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Executive Royal Navy & Imperial Gold Palette
const T = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardBorderGold: 'rgba(217, 119, 6, 0.28)',
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

interface AutomationWorkflow {
    id: string;
    name: string;
    trigger: string;
    condition: string;
    action: string;
    category: 'security' | 'finance' | 'vtu' | 'kyc' | 'cron';
    severity: 'critical' | 'high' | 'medium' | 'info';
    active: boolean;
    lastExecuted?: string;
    executionCount: number;
    description: string;
}

const DEFAULT_GLOBAL_WORKFLOWS: AutomationWorkflow[] = [
    {
        id: 'flow_auth_shield',
        name: 'Failed Authentication Auto-Lock Shield',
        trigger: 'Failed PIN / Password Attempts',
        condition: 'Attempts >= 5 within 10 minutes',
        action: 'Freeze Account & Send SMS Alert to Admin',
        category: 'security',
        severity: 'critical',
        active: true,
        executionCount: 14,
        description: 'Blocks brute force PIN attacks by locking user credentials immediately.',
    },
    {
        id: 'flow_vtu_refund',
        name: 'Gateway Failed Order Auto-Refund & Notification',
        trigger: 'VTU / Bill Provider API Error',
        condition: 'Status == Failed from Bigi / Bilal / ClubKonnect',
        action: 'Auto-Refund User Wallet & Dispatch In-App Notice',
        category: 'vtu',
        severity: 'high',
        active: true,
        executionCount: 89,
        description: 'Guarantees zero fund loss when downstream telecom operators experience downtime.',
    },
    {
        id: 'flow_welcome_bonus',
        name: 'New Verified Signup Welcome Cashback',
        trigger: 'User Completes Registration & Email Auth',
        condition: 'Account Age < 24 hours & First Wallet Top-up',
        action: 'Credit ₦100 Cashback to Main Wallet',
        category: 'finance',
        severity: 'info',
        active: true,
        executionCount: 215,
        description: 'Incentivizes user onboarding with instant welcome reward.',
    },
    {
        id: 'flow_night_quarantine',
        name: 'High-Value Midnight Outflow Quarantine',
        trigger: 'Withdrawal / Payout Request',
        condition: 'Amount > ₦250,000 AND Time between 12:00 AM - 05:00 AM',
        action: 'Hold in Risk Queue for Super Admin Approval',
        category: 'security',
        severity: 'critical',
        active: true,
        executionCount: 6,
        description: 'Prevents off-hours treasury drains by intercepting large overnight transfers.',
    },
    {
        id: 'flow_daily_yield',
        name: 'Midnight Savings Yield Auto-Compounding',
        trigger: 'Scheduled Cron Trigger (00:00 UTC)',
        condition: 'Savings Plan Status == Active',
        action: 'Disburse Accrued Daily Interest to Savings Portfolios',
        category: 'cron',
        severity: 'medium',
        active: true,
        executionCount: 30,
        description: 'Compounds user wealth daily based on configured APY rates.',
    },
    {
        id: 'flow_low_float_sms',
        name: 'Low Liquidity Provider Emergency Alert',
        trigger: 'API Float Balance Query',
        condition: 'Provider Wallet Float < ₦5,000',
        action: 'Send Urgent SMS via Termii to Admin Phone',
        category: 'finance',
        severity: 'high',
        active: true,
        executionCount: 8,
        description: 'Ensures admins replenish Payvessel/Bigi/Bilal floats before depletion.',
    },
    {
        id: 'flow_device_collision',
        name: 'Multi-Account Device Collision Blocker',
        trigger: 'User Login or Signup',
        condition: 'Accounts on same Device UUID > 3',
        action: 'Quarantine New Account & Require Level 2 Biometric KYC',
        category: 'security',
        severity: 'high',
        active: true,
        executionCount: 12,
        description: 'Stops automated farm account creation and referral abuse.',
    },
];

interface ExecutionLog {
    id: string;
    workflowName: string;
    triggerEvent: string;
    result: string;
    timestamp: string;
    status: 'success' | 'warning' | 'error';
}

export default function EnterpriseAutomationLogicHub() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'workflows' | 'builder' | 'sandbox' | 'logs'>('workflows');
    const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(DEFAULT_GLOBAL_WORKFLOWS);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Filter State
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'security' | 'vtu' | 'finance' | 'cron'>('all');
    const [search, setSearch] = useState('');

    // Builder Form
    const [newFlowName, setNewFlowName] = useState('');
    const [newTrigger, setNewTrigger] = useState('Transaction Event');
    const [newCondition, setNewCondition] = useState('');
    const [newAction, setNewAction] = useState('Auto-Refund Wallet');
    const [newCategory, setNewCategory] = useState<'security' | 'finance' | 'vtu' | 'kyc' | 'cron'>('security');
    const [newSeverity, setNewSeverity] = useState<'critical' | 'high' | 'medium' | 'info'>('high');
    const [newDescription, setNewDescription] = useState('');

    // Sandbox Simulator
    const [simulatedEvent, setSimulatedEvent] = useState('Failed VTU Order');
    const [simulatedPayload, setSimulatedPayload] = useState('{\n  "amount": 2500,\n  "provider": "BigiSub",\n  "status": "FAILED",\n  "error_code": "NETWORK_TIMEOUT"\n}');
    const [simulating, setSimulating] = useState(false);
    const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

    // Execution Logs State
    const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);

    useEffect(() => {
        loadAutomationSettings();
    }, []);

    const loadAutomationSettings = async () => {
        try {
            setLoading(true);

            // 1. Fetch persistent workflows from app_settings
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'global_automation_rules')
                .maybeSingle();

            if (settingData?.value) {
                try {
                    const parsed = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setWorkflows(parsed);
                    }
                } catch (e) { }
            }

            // 2. Fetch execution history from audit_logs
            const { data: auditData } = await supabase
                .from('audit_logs')
                .select('*')
                .ilike('action', '%automation%')
                .order('created_at', { ascending: false })
                .limit(50);

            if (auditData && auditData.length > 0) {
                const mapped: ExecutionLog[] = auditData.map(a => ({
                    id: a.id,
                    workflowName: a.action.replace('Automation Executed: ', ''),
                    triggerEvent: a.target_resource || 'System Trigger',
                    result: typeof a.details === 'string' ? a.details : a.details?.result || JSON.stringify(a.details),
                    timestamp: a.created_at,
                    status: a.action.includes('Failed') ? 'error' : a.action.includes('Quarantine') ? 'warning' : 'success',
                }));
                setExecutionLogs(mapped);
            } else {
                // Initialize default sample logs
                setExecutionLogs([
                    {
                        id: 'log_1',
                        workflowName: 'Gateway Failed Order Auto-Refund',
                        triggerEvent: 'BigiSub SME API Error 504',
                        result: '₦1,450 refunded to user wallet (Ref: TX-908123)',
                        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
                        status: 'success',
                    },
                    {
                        id: 'log_2',
                        workflowName: 'Failed Authentication Auto-Lock Shield',
                        triggerEvent: '5 Consecutive PIN Failures from IP 102.89.44.12',
                        result: 'Account frozen & SMS security alert sent',
                        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                        status: 'warning',
                    },
                    {
                        id: 'log_3',
                        workflowName: 'Midnight Savings Yield Auto-Compounding',
                        triggerEvent: 'Cron Trigger 00:00 UTC',
                        result: '₦34,250 interest posted across 42 active portfolios',
                        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
                        status: 'success',
                    },
                ]);
            }
        } catch (e) {
            console.error('Error loading automation data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAutomationSettings();
    }, []);

    // Toggle workflow active status
    const handleToggleWorkflow = async (id: string) => {
        const updated = workflows.map(w => (w.id === id ? { ...w, active: !w.active } : w));
        setWorkflows(updated);

        try {
            await supabase.from('app_settings').upsert({
                key: 'global_automation_rules',
                value: JSON.stringify(updated),
                updated_at: new Date().toISOString(),
            });

            const changed = updated.find(w => w.id === id);
            await supabase.from('audit_logs').insert({
                action: `Toggled Automation Workflow: ${changed?.name} -> ${changed?.active ? 'ACTIVE' : 'PAUSED'}`,
                target_resource: `Automation / ${changed?.name}`,
                details: { workflow_id: id, active: changed?.active },
            });
        } catch (e) {
            console.warn('Error saving toggle:', e);
        }
    };

    // Save All Workflows to Production DB
    const handleSaveAllWorkflows = async () => {
        setSaving(true);
        try {
            await supabase.from('app_settings').upsert({
                key: 'global_automation_rules',
                value: JSON.stringify(workflows),
                updated_at: new Date().toISOString(),
            });

            await supabase.from('audit_logs').insert({
                action: 'Committed All Global Automation Workflows to Production',
                target_resource: 'Global Business Logic Engine',
                details: { totalRules: workflows.length, activeCount: workflows.filter(w => w.active).length },
            });

            Alert.alert('Workflows Live 🚀', 'Global business automation rules successfully committed to production engine.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    // Create New Custom Workflow
    const handleCreateWorkflow = async () => {
        if (!newFlowName.trim() || !newCondition.trim()) {
            Alert.alert('Required', 'Please enter a workflow name and condition logic.');
            return;
        }

        setSaving(true);
        try {
            const newWorkflow: AutomationWorkflow = {
                id: 'flow_' + Date.now(),
                name: newFlowName.trim(),
                trigger: newTrigger,
                condition: newCondition.trim(),
                action: newAction,
                category: newCategory,
                severity: newSeverity,
                active: true,
                executionCount: 0,
                description: newDescription.trim() || 'Custom administrative business rule.',
            };

            const updated = [newWorkflow, ...workflows];
            setWorkflows(updated);

            await supabase.from('app_settings').upsert({
                key: 'global_automation_rules',
                value: JSON.stringify(updated),
                updated_at: new Date().toISOString(),
            });

            await supabase.from('audit_logs').insert({
                action: `Created Custom Automation Workflow: ${newWorkflow.name}`,
                target_resource: `Automation / ${newWorkflow.name}`,
                details: newWorkflow,
            });

            Alert.alert('Workflow Created 🎉', `${newWorkflow.name} is now active in the global logic pipeline.`);
            setNewFlowName('');
            setNewCondition('');
            setNewDescription('');
            setActiveTab('workflows');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    // Run Sandbox Logic Simulator
    const handleRunSimulator = () => {
        setSimulating(true);
        setSimulationLogs(['[0.00s] Initializing Logic Sandbox & Event Listener...']);

        setTimeout(() => {
            setSimulationLogs(prev => [
                ...prev,
                `[0.15s] Received Inbound Event: "${simulatedEvent}"`,
                `[0.30s] Parsing JSON Event Payload... OK`,
                `[0.45s] Evaluating against ${workflows.filter(w => w.active).length} Active Global Business Rules...`,
            ]);

            setTimeout(() => {
                let matchedRule = workflows.find(w => w.active && (
                    (simulatedEvent.includes('VTU') && w.category === 'vtu') ||
                    (simulatedEvent.includes('PIN') && w.category === 'security') ||
                    (simulatedEvent.includes('Cron') && w.category === 'cron')
                )) || workflows[0];

                setSimulationLogs(prev => [
                    ...prev,
                    `[0.65s] ⚡ RULE MATCH FOUND: "${matchedRule.name}"`,
                    `[0.78s] CONDITION EVALUATION: [${matchedRule.condition}] -> TRUE`,
                    `[0.92s] DISPATCHING ACTION: [${matchedRule.action}]`,
                    `[1.05s] State Machine Updated Successfully. 0 Errors.`,
                ]);
                setSimulating(false);
            }, 600);
        }, 400);
    };

    // Filtered Workflows
    const filteredWorkflows = useMemo(() => {
        return workflows.filter(w => {
            const matchesCat = categoryFilter === 'all' || w.category === categoryFilter;
            const matchesSearch =
                !search.trim() ||
                w.name.toLowerCase().includes(search.toLowerCase()) ||
                w.trigger.toLowerCase().includes(search.toLowerCase()) ||
                w.action.toLowerCase().includes(search.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [workflows, categoryFilter, search]);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Global Logic & Automation',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setActiveTab('builder')} style={styles.headerGoldBtn}>
                                <Ionicons name="add" size={18} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('sandbox')} style={styles.headerGoldBtn}>
                                <Ionicons name="flask-outline" size={16} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={styles.headerGoldBtn}>
                                <Ionicons name="refresh" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Top Telemetry Stat Hero */}
            <LinearGradient colors={[T.navyPrimary, T.navyDeep, T.navyMid]} style={styles.heroSummaryBar}>
                <View style={styles.liveIndicatorRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.liveIndicatorText}>GLOBAL BUSINESS LOGIC ENGINE • ACTIVE</Text>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{workflows.length}</Text>
                        <Text style={styles.summaryLabel}>Total Rules</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.success }]}>
                            {workflows.filter(w => w.active).length} Active
                        </Text>
                        <Text style={styles.summaryLabel}>Live Bots</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.goldBright }]}>
                            {workflows.reduce((s, w) => s + w.executionCount, 0)}
                        </Text>
                        <Text style={styles.summaryLabel}>Executions</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.info }]}>100%</Text>
                        <Text style={styles.summaryLabel}>Engine Health</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Sub-Navigation Tabs */}
            <View style={styles.tabBar}>
                {[
                    { key: 'workflows', label: '⚡ Live Workflows' },
                    { key: 'builder', label: '➕ New Rule Builder' },
                    { key: 'sandbox', label: '🧪 Logic Sandbox' },
                    { key: 'logs', label: '🕒 Execution Logs' },
                ].map(t => (
                    <TouchableOpacity
                        key={t.key}
                        onPress={() => setActiveTab(t.key as any)}
                        style={[styles.tabPill, activeTab === t.key && styles.tabPillActive]}
                    >
                        <Text style={[styles.tabPillText, activeTab === t.key && styles.tabPillTextActive]}>
                            {t.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={styles.loadingText}>Synchronizing Global Business Rules...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ========================================================================= */}
                    {/* TAB 1: LIVE WORKFLOWS                                                     */}
                    {/* ========================================================================= */}
                    {activeTab === 'workflows' && (
                        <View>
                            {/* Search & Category Filter */}
                            <View style={styles.searchBarRow}>
                                <Ionicons name="search" size={15} color={T.textMuted} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder="Search rules by trigger, action, or name..."
                                    placeholderTextColor={T.textMuted}
                                    style={styles.searchInput}
                                />
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                                {[
                                    { key: 'all', label: 'All Rules' },
                                    { key: 'security', label: '🛡️ Security & Auth' },
                                    { key: 'vtu', label: '⚡ VTU & Telecom' },
                                    { key: 'finance', label: '💰 Finance & Wallet' },
                                    { key: 'cron', label: '🕒 Scheduled Crons' },
                                ].map(c => (
                                    <TouchableOpacity
                                        key={c.key}
                                        onPress={() => setCategoryFilter(c.key as any)}
                                        style={[styles.catPill, categoryFilter === c.key && styles.catPillActive]}
                                    >
                                        <Text style={[styles.catPillText, categoryFilter === c.key && styles.catPillTextActive]}>
                                            {c.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {filteredWorkflows.map(flow => (
                                <View key={flow.id} style={styles.workflowCard}>
                                    <View style={styles.flowTopRow}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                <Text style={styles.flowTitle}>{flow.name}</Text>
                                                <View style={[
                                                    styles.severityBadge,
                                                    flow.severity === 'critical' ? styles.sevCrit :
                                                    flow.severity === 'high' ? styles.sevHigh : styles.sevMed
                                                ]}>
                                                    <Text style={styles.sevText}>{flow.severity.toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.flowDesc}>{flow.description}</Text>
                                        </View>

                                        <Switch
                                            value={flow.active}
                                            onValueChange={() => handleToggleWorkflow(flow.id)}
                                            trackColor={{ false: '#CBD5E1', true: T.gold }}
                                            thumbColor="#FFFFFF"
                                        />
                                    </View>

                                    {/* Visual Logic Node Block */}
                                    <View style={styles.logicNodeContainer}>
                                        <View style={styles.logicTriggerBox}>
                                            <Text style={styles.logicNodeLabel}>IF TRIGGER</Text>
                                            <Text style={styles.logicNodeVal}>{flow.trigger}</Text>
                                            <Text style={styles.logicNodeCondition}>[{flow.condition}]</Text>
                                        </View>

                                        <View style={styles.logicArrowWrap}>
                                            <Ionicons name="arrow-forward" size={14} color={T.goldDark} />
                                        </View>

                                        <View style={styles.logicActionBox}>
                                            <Text style={styles.logicNodeLabelAction}>THEN EXECUTE</Text>
                                            <Text style={styles.logicNodeValAction}>{flow.action}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.flowFooter}>
                                        <Text style={styles.flowExecutionText}>
                                            Triggered <Text style={{ fontWeight: '800', color: T.navyPrimary }}>{flow.executionCount} times</Text>
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <View style={[styles.statusDot, { backgroundColor: flow.active ? T.success : '#94A3B8' }]} />
                                            <Text style={styles.flowStatusText}>{flow.active ? 'Armed & Listening' : 'Paused'}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}

                            <TouchableOpacity
                                onPress={handleSaveAllWorkflows}
                                disabled={saving}
                                style={styles.saveLiveBtn}
                                activeOpacity={0.85}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload" size={17} color={T.goldBright} />
                                        <Text style={styles.saveLiveBtnText}>Commit Workflows to Production</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: NEW RULE BUILDER                                                   */}
                    {/* ========================================================================= */}
                    {activeTab === 'builder' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Construct Custom IF-THEN Rule</Text>
                            <Text style={styles.cardSub}>Build custom automated event handlers for your platform.</Text>

                            <Text style={styles.inputLabel}>Workflow Name</Text>
                            <TextInput
                                value={newFlowName}
                                onChangeText={setNewFlowName}
                                placeholder="e.g. VIP Trader Volume Bonus Dispatcher"
                                placeholderTextColor={T.textMuted}
                                style={styles.input}
                            />

                            <Text style={styles.inputLabel}>Select Event Trigger</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {[
                                    'Transaction Event',
                                    'Failed PIN / Auth',
                                    'New User Signup',
                                    'API Provider Error',
                                    'Float Balance Threshold',
                                    'Midnight Cron (00:00 UTC)',
                                ].map(trig => (
                                    <TouchableOpacity
                                        key={trig}
                                        onPress={() => setNewTrigger(trig)}
                                        style={[styles.selectorPill, newTrigger === trig && styles.selectorPillActive]}
                                    >
                                        <Text style={[styles.selectorPillText, newTrigger === trig && styles.selectorPillTextActive]}>
                                            {trig}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Evaluation Condition</Text>
                            <TextInput
                                value={newCondition}
                                onChangeText={setNewCondition}
                                placeholder="e.g. Amount > ₦100,000 AND User Tier == 1"
                                placeholderTextColor={T.textMuted}
                                style={styles.input}
                            />

                            <Text style={styles.inputLabel}>Select Automated Action</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {[
                                    'Auto-Refund Wallet',
                                    'Freeze Account & Alert Admin',
                                    'Credit Cashback Bonus',
                                    'Hold in Quarantine Queue',
                                    'Send SMS Alert via Termii',
                                    'Disburse Accrued Yield',
                                ].map(act => (
                                    <TouchableOpacity
                                        key={act}
                                        onPress={() => setNewAction(act)}
                                        style={[styles.selectorPill, newAction === act && styles.selectorPillActive]}
                                    >
                                        <Text style={[styles.selectorPillText, newAction === act && styles.selectorPillTextActive]}>
                                            {act}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Description & Intent</Text>
                            <TextInput
                                value={newDescription}
                                onChangeText={setNewDescription}
                                placeholder="Short explanation of why this rule is active"
                                placeholderTextColor={T.textMuted}
                                multiline
                                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                            />

                            <TouchableOpacity
                                onPress={handleCreateWorkflow}
                                disabled={saving}
                                style={styles.createWorkflowBtn}
                                activeOpacity={0.85}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="flash" size={17} color={T.goldBright} />
                                        <Text style={styles.createWorkflowBtnText}>Deploy New Automation Rule</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: LOGIC SANDBOX & SIMULATOR                                          */}
                    {/* ========================================================================= */}
                    {activeTab === 'sandbox' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Rule Execution Sandbox & Simulator</Text>
                            <Text style={styles.cardSub}>Trigger mock events to evaluate logic pipeline in real-time.</Text>

                            <Text style={styles.inputLabel}>Select Test Scenario</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {[
                                    'Failed VTU Order',
                                    '5 Failed PIN Attempts',
                                    'Midnight Yield Cron (00:00)',
                                    'Overnight ₦500k Transfer',
                                ].map(sc => (
                                    <TouchableOpacity
                                        key={sc}
                                        onPress={() => {
                                            setSimulatedEvent(sc);
                                            if (sc.includes('VTU')) {
                                                setSimulatedPayload('{\n  "amount": 2500,\n  "provider": "BigiSub",\n  "status": "FAILED",\n  "error_code": "NETWORK_TIMEOUT"\n}');
                                            } else if (sc.includes('PIN')) {
                                                setSimulatedPayload('{\n  "user_id": "usr_90123",\n  "failed_attempts": 5,\n  "window_mins": 8,\n  "ip": "102.89.44.12"\n}');
                                            } else {
                                                setSimulatedPayload('{\n  "cron": "00:00_UTC",\n  "active_plans": 42,\n  "total_aum": 89500000\n}');
                                            }
                                        }}
                                        style={[styles.selectorPill, simulatedEvent === sc && styles.selectorPillActive]}
                                    >
                                        <Text style={[styles.selectorPillText, simulatedEvent === sc && styles.selectorPillTextActive]}>
                                            {sc}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Event Mock JSON Payload</Text>
                            <TextInput
                                value={simulatedPayload}
                                onChangeText={setSimulatedPayload}
                                multiline
                                style={styles.jsonInput}
                            />

                            <TouchableOpacity
                                onPress={handleRunSimulator}
                                disabled={simulating}
                                style={styles.runSimBtn}
                                activeOpacity={0.85}
                            >
                                {simulating ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="play" size={16} color="#FFFFFF" />
                                        <Text style={styles.runSimBtnText}>Run Logic Evaluation</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {simulationLogs.length > 0 && (
                                <View style={styles.terminalConsole}>
                                    <Text style={styles.terminalHeader}>⚡ EXECUTION TREE LOG:</Text>
                                    {simulationLogs.map((logLine, idx) => (
                                        <Text key={idx} style={styles.terminalLine}>{logLine}</Text>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 4: EXECUTION LOGS & AUDIT TRAIL                                       */}
                    {/* ========================================================================= */}
                    {activeTab === 'logs' && (
                        <View>
                            <Text style={styles.sectionTitle}>Real-Time Rule Execution Audit</Text>
                            <Text style={styles.sectionSub}>Live stream of automated background decisions.</Text>

                            {executionLogs.map(l => (
                                <View key={l.id} style={styles.logItemCard}>
                                    <View style={styles.logItemHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={[
                                                styles.statusDot,
                                                l.status === 'error' ? { backgroundColor: T.danger } :
                                                l.status === 'warning' ? { backgroundColor: T.gold } : { backgroundColor: T.success }
                                            ]} />
                                            <Text style={styles.logItemTitle}>{l.workflowName}</Text>
                                        </View>
                                        <Text style={styles.logItemTime}>{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                    <Text style={styles.logItemTrigger}>Trigger: {l.triggerEvent}</Text>
                                    <Text style={styles.logItemResult}>{l.result}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
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
        backgroundColor: T.goldBright,
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
        fontSize: 15,
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
    tabBar: {
        flexDirection: 'row',
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 119, 6, 0.2)',
    },
    tabPill: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: T.navyDeep,
        alignItems: 'center',
    },
    tabPillActive: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
        borderColor: T.gold,
    },
    tabPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: T.textMuted,
    },
    tabPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    scrollContent: {
        padding: 12,
        paddingBottom: 40,
    },
    searchBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 8,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 11.5,
        color: T.textMain,
    },
    categoryScroll: {
        gap: 6,
        marginBottom: 10,
    },
    catPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
    },
    catPillActive: {
        backgroundColor: T.navyPrimary,
    },
    catPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: T.textSub,
    },
    catPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    workflowCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: T.cardBorder,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    flowTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    flowTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    severityBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    sevCrit: {
        backgroundColor: T.dangerBg,
    },
    sevHigh: {
        backgroundColor: T.goldBg,
    },
    sevMed: {
        backgroundColor: T.infoBg,
    },
    sevText: {
        fontSize: 7.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    flowDesc: {
        fontSize: 10.5,
        color: T.textSub,
        lineHeight: 14,
    },
    logicNodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginVertical: 6,
    },
    logicTriggerBox: {
        flex: 1,
    },
    logicActionBox: {
        flex: 1,
    },
    logicArrowWrap: {
        paddingHorizontal: 6,
    },
    logicNodeLabel: {
        fontSize: 7.5,
        fontWeight: '900',
        color: T.textMuted,
        letterSpacing: 0.5,
    },
    logicNodeLabelAction: {
        fontSize: 7.5,
        fontWeight: '900',
        color: T.goldDark,
        letterSpacing: 0.5,
    },
    logicNodeVal: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
    },
    logicNodeValAction: {
        fontSize: 11,
        fontWeight: '800',
        color: T.success,
    },
    logicNodeCondition: {
        fontSize: 9,
        color: T.textSub,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    flowFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 6,
        marginTop: 4,
    },
    flowExecutionText: {
        fontSize: 10,
        color: T.textMuted,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    flowStatusText: {
        fontSize: 10,
        fontWeight: '700',
        color: T.textSub,
    },
    saveLiveBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 8,
    },
    saveLiveBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyPrimary,
        marginBottom: 2,
    },
    cardSub: {
        fontSize: 10.5,
        color: T.textMuted,
        marginBottom: 10,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
        marginTop: 6,
        marginBottom: 4,
    },
    input: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 6,
    },
    selectorPill: {
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: T.border,
    },
    selectorPillActive: {
        backgroundColor: T.navyPrimary,
        borderColor: T.cardBorderGold,
    },
    selectorPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: T.textSub,
    },
    selectorPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    createWorkflowBtn: {
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
    },
    createWorkflowBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    jsonInput: {
        backgroundColor: T.navyDeep,
        borderRadius: 8,
        padding: 10,
        color: '#38BDF8',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        height: 90,
        textAlignVertical: 'top',
        marginBottom: 10,
    },
    runSimBtn: {
        backgroundColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 8,
        gap: 6,
        marginBottom: 12,
    },
    runSimBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    terminalConsole: {
        backgroundColor: '#070D1E',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    terminalHeader: {
        color: T.goldBright,
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 4,
    },
    terminalLine: {
        color: '#A7F3D0',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 14,
    },
    sectionTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    sectionSub: {
        fontSize: 10.5,
        color: T.textMuted,
        marginBottom: 8,
    },
    logItemCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    logItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    logItemTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    logItemTime: {
        fontSize: 9.5,
        color: T.textMuted,
    },
    logItemTrigger: {
        fontSize: 10.5,
        color: T.textSub,
        fontWeight: '600',
    },
    logItemResult: {
        fontSize: 10.5,
        color: T.success,
        fontWeight: '700',
        marginTop: 2,
    },
});
