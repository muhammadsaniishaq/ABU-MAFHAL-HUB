import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, StyleSheet, Platform, Switch, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

const C = {
    navyDark: '#060B18',
    navy: '#0D1B3E',
    navyMid: '#142258',
    navyLight: '#1E2D60',
    waGreen: '#25D366',
    waDarkGreen: '#128C7E',
    gold: '#F5A623',
    white: '#FFFFFF',
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate700: '#334155',
    slate800: '#1E293B',
    rose: '#EF4444',
    emerald: '#10B981',
};

export default function WhatsAppBotAdmin() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Tab: 'overview' | 'logs' | 'sessions' | 'tester'
    const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'sessions' | 'tester'>('overview');

    // Bot Config State
    const [botEnabled, setBotEnabled] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [botPhone, setBotPhone] = useState('09065645747');
    const [adminCallPhone, setAdminCallPhone] = useState('08145853539');
    const [defaultLang, setDefaultLang] = useState<'en' | 'ha'>('en');

    // Meta Diag Info
    const [metaDiag, setMetaDiag] = useState<any>(null);
    const [webhookUrl] = useState('https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/whatsapp-bot');
    const [verifyToken] = useState('abumafhal_wa_verify_2026');

    // Logs & Sessions
    const [logs, setLogs] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [logFilter, setLogFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');

    // Test Sender Tool
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('Hello! This is a test message from Abu Mafhal Sub WhatsApp Bot Admin.');
    const [testResult, setTestResult] = useState<any>(null);

    // Fetch live status and settings
    const loadAll = useCallback(async () => {
        try {
            // 1. Fetch app_settings
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['whatsapp_bot_enabled', 'maintenance_mode', 'whatsapp_bot_number', 'WHATSAPP_BOT_NUMBER', 'whatsapp_admin_call_phone', 'WHATSAPP_ADMIN_CALL_PHONE']);

            if (settingsData) {
                const map: Record<string, string> = {};
                settingsData.forEach(s => { map[s.key] = s.value; });
                if (map['whatsapp_bot_enabled'] !== undefined) setBotEnabled(map['whatsapp_bot_enabled'] === 'true');
                if (map['maintenance_mode'] !== undefined) setMaintenanceMode(map['maintenance_mode'] === 'true');
                if (map['whatsapp_bot_number'] || map['WHATSAPP_BOT_NUMBER']) setBotPhone(map['whatsapp_bot_number'] || map['WHATSAPP_BOT_NUMBER']);
                if (map['whatsapp_admin_call_phone'] || map['WHATSAPP_ADMIN_CALL_PHONE']) setAdminCallPhone(map['whatsapp_admin_call_phone'] || map['WHATSAPP_ADMIN_CALL_PHONE']);
            }

            // 2. Fetch Meta Live Diag
            try {
                const res = await fetch(`${webhookUrl}?diag=1`);
                if (res.ok) {
                    const diagData = await res.json();
                    setMetaDiag(diagData);
                }
            } catch (_) {}

            // 3. Fetch recent WhatsApp bot logs
            const { data: logRows } = await supabase
                .from('whatsapp_bot_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            if (logRows) setLogs(logRows);

            // 4. Fetch WhatsApp Bot active sessions
            const { data: sessionRows } = await supabase
                .from('whatsapp_bot_sessions')
                .select('id, phone_number, user_id, step, session_data, last_interaction, created_at')
                .order('last_interaction', { ascending: false })
                .limit(30);
            if (sessionRows) setSessions(sessionRows);

        } catch (err: any) {
            console.error('Error loading WhatsApp Bot admin data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [webhookUrl]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAll();
    };

    // Save Bot Config
    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const updates = [
                { key: 'whatsapp_bot_enabled', value: String(botEnabled) },
                { key: 'maintenance_mode', value: String(maintenanceMode) },
                { key: 'whatsapp_bot_number', value: botPhone.trim() },
                { key: 'WHATSAPP_BOT_NUMBER', value: botPhone.trim() },
                { key: 'support_whatsapp', value: botPhone.trim() },
                { key: 'whatsapp_admin_call_phone', value: adminCallPhone.trim() },
                { key: 'WHATSAPP_ADMIN_CALL_PHONE', value: adminCallPhone.trim() },
            ];

            const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });
            if (error) throw error;

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('✅ Saved', 'WhatsApp Bot settings updated successfully in production.');
        } catch (err: any) {
            Alert.alert('❌ Error', err.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    // Send Test Message
    const handleSendTestMessage = async () => {
        if (!testPhone.trim()) {
            Alert.alert('Required', 'Please enter a recipient phone number (e.g. 08012345678)');
            return;
        }

        setTesting(true);
        setTestResult(null);

        let clean = testPhone.replace(/\D/g, '');
        if (clean.startsWith('0') && clean.length === 11) {
            clean = '234' + clean.slice(1);
        } else if (clean.length === 10) {
            clean = '234' + clean;
        }

        try {
            const res = await fetch(`${webhookUrl}?diag=1&test_to=${clean}`);
            const data = await res.json();
            setTestResult(data.test_send_result || data);

            if (data?.test_send_result?.ok) {
                Alert.alert('🎉 Success', `Test message delivered successfully to ${clean}!`);
                loadAll();
            } else {
                Alert.alert('⚠️ Meta Response', `Status: ${data?.test_send_result?.status || 'Error'}`);
            }
        } catch (err: any) {
            setTestResult({ error: err.message });
            Alert.alert('❌ Send Failed', err.message);
        } finally {
            setTesting(false);
        }
    };

    // Reset User Session
    const handleResetSession = async (sessionId: string, phone: string) => {
        try {
            await supabase
                .from('whatsapp_bot_sessions')
                .update({ step: 'IDLE', session_data: { lang: 'en' } })
                .eq('id', sessionId);

            Alert.alert('Session Reset', `Session for ${phone} reset to IDLE.`);
            loadAll();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    // Copy to clipboard helper
    const copyText = (txt: string, label: string) => {
        Clipboard.setStringAsync(txt);
        if (Platform.OS !== 'web') {
            Haptics.selectionAsync();
        }
        Alert.alert('Copied', `${label} copied to clipboard!`);
    };

    const filteredLogs = logs.filter(l => {
        if (logFilter === 'incoming') return l.direction === 'incoming';
        if (logFilter === 'outgoing') return l.direction === 'outgoing';
        return true;
    });

    const isConnected = metaDiag?.meta_check?.status === 200;
    const verifiedName = metaDiag?.meta_check?.body?.verified_name || 'Abu Mafhal Ltd';
    const displayPhone = metaDiag?.meta_check?.body?.display_phone_number || '+234 906 564 5747';
    const qualityRating = metaDiag?.meta_check?.body?.quality_rating || 'GREEN';

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <LinearGradient colors={[C.navyDark, C.navy]} style={s.header}>
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={C.white} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="logo-whatsapp" size={20} color={C.waGreen} style={{ marginRight: 6 }} />
                            <Text style={s.headerTitle}>WhatsApp Bot Manager</Text>
                        </View>
                        <Text style={s.headerSub}>Meta Cloud API & Live Activity Monitor</Text>
                    </View>
                    <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
                        <Ionicons name="refresh" size={18} color={C.white} />
                    </TouchableOpacity>
                </View>

                {/* Status Bar */}
                <View style={s.statusBar}>
                    <View style={s.statusPill}>
                        <View style={[s.statusDot, { backgroundColor: isConnected ? C.waGreen : C.rose }]} />
                        <Text style={s.statusText}>{isConnected ? 'Meta API Connected' : 'Checking Connection...'}</Text>
                    </View>
                    <View style={s.phonePill}>
                        <Text style={s.phonePillText}>📱 {displayPhone}</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={s.tabRow}>
                    {[
                        { key: 'overview', label: 'Overview & Config', icon: 'settings-outline' },
                        { key: 'logs', label: `Live Chats (${logs.length})`, icon: 'chatbubbles-outline' },
                        { key: 'sessions', label: `Sessions (${sessions.length})`, icon: 'people-outline' },
                        { key: 'tester', label: 'Send Test Msg', icon: 'paper-plane-outline' },
                    ].map(t => (
                        <TouchableOpacity
                            key={t.key}
                            onPress={() => {
                                if (Platform.OS !== 'web') Haptics.selectionAsync();
                                setActiveTab(t.key as any);
                            }}
                            style={[s.tabBtn, activeTab === t.key && s.tabBtnActive]}
                        >
                            <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? C.navy : C.slate400} />
                            <Text style={[s.tabBtnText, activeTab === t.key && s.tabBtnTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            {loading ? (
                <View style={s.centerBox}>
                    <ActivityIndicator size="large" color={C.waGreen} />
                    <Text style={s.loadingText}>Loading WhatsApp Bot Status...</Text>
                </View>
            ) : (
                <ScrollView
                    style={s.content}
                    contentContainerStyle={{ paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.waGreen} />}
                >
                    {/* TAB 1: OVERVIEW & CONFIG */}
                    {activeTab === 'overview' && (
                        <View style={s.tabContent}>
                            {/* Meta Health Card */}
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#E8F5E9' }]}>
                                        <Ionicons name="checkmark-circle" size={18} color={C.waDarkGreen} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.cardTitle}>Meta WhatsApp Business Profile</Text>
                                        <Text style={s.cardSub}>Cloud API Phone Number Details</Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: '#E8F5E9' }]}>
                                        <Text style={[s.badgeText, { color: C.waDarkGreen }]}>{qualityRating} QUALITY</Text>
                                    </View>
                                </View>

                                <View style={s.metaGrid}>
                                    <View style={s.metaItem}>
                                        <Text style={s.metaLabel}>Verified Business Name</Text>
                                        <Text style={s.metaVal}>{verifiedName}</Text>
                                    </View>
                                    <View style={s.metaItem}>
                                        <Text style={s.metaLabel}>Display Phone Number</Text>
                                        <Text style={s.metaVal}>{displayPhone}</Text>
                                    </View>
                                    <View style={s.metaItem}>
                                        <Text style={s.metaLabel}>Phone Number ID</Text>
                                        <Text style={s.metaValCode}>{metaDiag?.phone_id_preview || 'Configured in Secrets'}</Text>
                                    </View>
                                    <View style={s.metaItem}>
                                        <Text style={s.metaLabel}>Permanent Token</Text>
                                        <Text style={s.metaValCode}>{metaDiag?.token_preview || 'Active System Token'}</Text>
                                    </View>
                                </View>

                                {/* Webhook Endpoint */}
                                <View style={s.webhookBox}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.webhookLabel}>Meta Webhook Callback URL</Text>
                                        <Text style={s.webhookUrl} numberOfLines={1}>{webhookUrl}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => copyText(webhookUrl, 'Webhook URL')} style={s.copyBtn}>
                                        <Ionicons name="copy-outline" size={16} color={C.navy} />
                                    </TouchableOpacity>
                                </View>
                                <View style={[s.webhookBox, { marginTop: 6 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.webhookLabel}>Verify Token</Text>
                                        <Text style={s.webhookUrl}>{verifyToken}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => copyText(verifyToken, 'Verify Token')} style={s.copyBtn}>
                                        <Ionicons name="copy-outline" size={16} color={C.navy} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Bot Controls Card */}
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
                                        <Ionicons name="toggle" size={18} color="#2563EB" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.cardTitle}>Master Bot Controls</Text>
                                        <Text style={s.cardSub}>Toggle Bot Status & System Maintenance</Text>
                                    </View>
                                </View>

                                {/* Toggle Bot */}
                                <View style={s.toggleRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.toggleLabel}>WhatsApp Bot Active</Text>
                                        <Text style={s.toggleDesc}>When OFF, bot replies with temporary downtime notice</Text>
                                    </View>
                                    <Switch
                                        value={botEnabled}
                                        onValueChange={setBotEnabled}
                                        trackColor={{ false: '#CBD5E1', true: C.waGreen }}
                                        thumbColor={C.white}
                                    />
                                </View>

                                {/* Toggle Maintenance Mode */}
                                <View style={[s.toggleRow, { borderTopWidth: 1, borderTopColor: C.slate100, paddingTop: 12, marginTop: 12 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.toggleLabel}>App & Bot Maintenance Mode</Text>
                                        <Text style={s.toggleDesc}>When ON, bot politely halts transactions with maintenance notice</Text>
                                    </View>
                                    <Switch
                                        value={maintenanceMode}
                                        onValueChange={setMaintenanceMode}
                                        trackColor={{ false: '#CBD5E1', true: C.rose }}
                                        thumbColor={C.white}
                                    />
                                </View>

                                {/* Phone Inputs */}
                                <View style={{ marginTop: 16 }}>
                                    <Text style={s.inputLabel}>WhatsApp Bot Phone (Display & Links):</Text>
                                    <TextInput
                                        value={botPhone}
                                        onChangeText={setBotPhone}
                                        placeholder="09065645747"
                                        style={s.input}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.inputLabel}>Admin Direct Escalation Call Number:</Text>
                                    <TextInput
                                        value={adminCallPhone}
                                        onChangeText={setAdminCallPhone}
                                        placeholder="08145853539"
                                        style={s.input}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.inputLabel}>Default Bot Language:</Text>
                                    <View style={s.langRow}>
                                        <TouchableOpacity
                                            onPress={() => setDefaultLang('en')}
                                            style={[s.langPill, defaultLang === 'en' && s.langPillActive]}
                                        >
                                            <Text style={[s.langPillText, defaultLang === 'en' && s.langPillTextActive]}>English (Default)</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setDefaultLang('ha')}
                                            style={[s.langPill, defaultLang === 'ha' && s.langPillActive]}
                                        >
                                            <Text style={[s.langPillText, defaultLang === 'ha' && s.langPillTextActive]}>Hausa</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity onPress={handleSaveConfig} disabled={saving} style={s.saveBtn}>
                                    {saving ? (
                                        <ActivityIndicator color={C.white} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="save-outline" size={18} color={C.white} style={{ marginRight: 6 }} />
                                            <Text style={s.saveBtnText}>Save WhatsApp Bot Settings</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* TAB 2: LIVE LOGS */}
                    {activeTab === 'logs' && (
                        <View style={s.tabContent}>
                            <View style={s.filterRow}>
                                {['all', 'incoming', 'outgoing'].map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        onPress={() => setLogFilter(f as any)}
                                        style={[s.filterPill, logFilter === f && s.filterPillActive]}
                                    >
                                        <Text style={[s.filterPillText, logFilter === f && s.filterPillTextActive]}>
                                            {f.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {filteredLogs.length === 0 ? (
                                <View style={s.emptyBox}>
                                    <Ionicons name="chatbubbles-outline" size={40} color={C.slate400} />
                                    <Text style={s.emptyText}>No WhatsApp bot logs recorded yet.</Text>
                                </View>
                            ) : (
                                filteredLogs.map(log => {
                                    const isInc = log.direction === 'incoming';
                                    const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const date = new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

                                    return (
                                        <View key={log.id} style={[s.logBubble, isInc ? s.logBubbleInc : s.logBubbleOut]}>
                                            <View style={s.logTop}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons
                                                        name={isInc ? 'arrow-down-circle' : 'arrow-up-circle'}
                                                        size={14}
                                                        color={isInc ? C.waDarkGreen : '#2563EB'}
                                                        style={{ marginRight: 4 }}
                                                    />
                                                    <Text style={s.logPhone}>{log.phone_number}</Text>
                                                </View>
                                                <Text style={s.logTime}>{date} {time}</Text>
                                            </View>
                                            <Text style={s.logText}>{log.content}</Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {/* TAB 3: SESSIONS */}
                    {activeTab === 'sessions' && (
                        <View style={s.tabContent}>
                            <Text style={s.sectionHeader}>Active WhatsApp Conversations & Linked Users</Text>
                            {sessions.length === 0 ? (
                                <View style={s.emptyBox}>
                                    <Ionicons name="people-outline" size={40} color={C.slate400} />
                                    <Text style={s.emptyText}>No active WhatsApp sessions.</Text>
                                </View>
                            ) : (
                                sessions.map(sess => (
                                    <View key={sess.id} style={s.sessionCard}>
                                        <View style={s.sessionTop}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.sessionPhone}>📱 {sess.phone_number}</Text>
                                                <Text style={s.sessionStep}>Current Step: <Text style={{ fontWeight: '700', color: C.navy }}>{sess.step}</Text></Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleResetSession(sess.id, sess.phone_number)}
                                                style={s.resetBtn}
                                            >
                                                <Ionicons name="refresh" size={14} color={C.rose} style={{ marginRight: 4 }} />
                                                <Text style={s.resetBtnText}>Reset</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={s.sessionBottom}>
                                            <Text style={s.sessionMeta}>
                                                User ID: {sess.user_id ? sess.user_id.slice(0, 8) + '...' : 'Guest (Unlinked)'}
                                            </Text>
                                            <Text style={s.sessionMeta}>
                                                Last Active: {new Date(sess.last_interaction || sess.created_at).toLocaleTimeString()}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* TAB 4: TEST MESSAGE SENDER */}
                    {activeTab === 'tester' && (
                        <View style={s.tabContent}>
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
                                        <Ionicons name="paper-plane" size={18} color={C.waDarkGreen} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.cardTitle}>Live Meta WhatsApp Message Tester</Text>
                                        <Text style={s.cardSub}>Send test message directly through Meta Graph API</Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.inputLabel}>Recipient Phone Number:</Text>
                                    <TextInput
                                        value={testPhone}
                                        onChangeText={setTestPhone}
                                        placeholder="08012345678 or 2348012345678"
                                        style={s.input}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.inputLabel}>Message Content:</Text>
                                    <TextInput
                                        value={testMessage}
                                        onChangeText={setTestMessage}
                                        multiline
                                        numberOfLines={4}
                                        style={[s.input, { height: 90, textAlignVertical: 'top' }]}
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleSendTestMessage}
                                    disabled={testing}
                                    style={[s.saveBtn, { backgroundColor: C.waDarkGreen }]}
                                >
                                    {testing ? (
                                        <ActivityIndicator color={C.white} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={16} color={C.white} style={{ marginRight: 6 }} />
                                            <Text style={s.saveBtnText}>Send WhatsApp Test Message</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {testResult && (
                                    <View style={s.resultBox}>
                                        <Text style={s.resultHeader}>Meta Graph API Response:</Text>
                                        <Text style={s.resultCode}>{JSON.stringify(testResult, null, 2)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: C.navyDark,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: C.white,
        fontSize: 17,
        fontWeight: '800',
    },
    headerSub: {
        color: C.slate400,
        fontSize: 12,
        marginTop: 1,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        color: C.white,
        fontSize: 12,
        fontWeight: '600',
    },
    phonePill: {
        backgroundColor: 'rgba(37,211,102,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    phonePillText: {
        color: C.waGreen,
        fontSize: 11,
        fontWeight: '700',
    },
    tabRow: {
        flexDirection: 'row',
        marginTop: 12,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 8,
        padding: 3,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 6,
    },
    tabBtnActive: {
        backgroundColor: C.white,
    },
    tabBtnText: {
        color: C.slate400,
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
    tabBtnTextActive: {
        color: C.navy,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    tabContent: {
        padding: 16,
    },
    centerBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        color: C.slate500,
        fontSize: 13,
        marginTop: 12,
    },
    card: {
        backgroundColor: C.white,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.slate200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconBox: {
        width: 34,
        height: 34,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        color: C.navy,
        fontSize: 15,
        fontWeight: '700',
    },
    cardSub: {
        color: C.slate500,
        fontSize: 12,
        marginTop: 1,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    metaGrid: {
        backgroundColor: C.slate50,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    metaItem: {
        marginBottom: 8,
    },
    metaLabel: {
        color: C.slate500,
        fontSize: 11,
        fontWeight: '600',
    },
    metaVal: {
        color: C.navy,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 1,
    },
    metaValCode: {
        color: '#2563EB',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: '600',
        marginTop: 1,
    },
    webhookBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.slate50,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: C.slate200,
        marginTop: 10,
    },
    webhookLabel: {
        color: C.slate500,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    webhookUrl: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    copyBtn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: C.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleLabel: {
        color: C.navy,
        fontSize: 14,
        fontWeight: '700',
    },
    toggleDesc: {
        color: C.slate500,
        fontSize: 12,
        marginTop: 2,
        paddingRight: 10,
    },
    inputLabel: {
        color: C.slate700,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 5,
    },
    input: {
        backgroundColor: C.slate50,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.slate200,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: C.navy,
    },
    langRow: {
        flexDirection: 'row',
        gap: 10,
    },
    langPill: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: C.slate100,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.slate200,
    },
    langPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    langPillText: {
        color: C.slate700,
        fontSize: 12,
        fontWeight: '600',
    },
    langPillTextActive: {
        color: C.white,
        fontWeight: '700',
    },
    saveBtn: {
        backgroundColor: C.navy,
        borderRadius: 10,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 18,
    },
    saveBtnText: {
        color: C.white,
        fontSize: 13,
        fontWeight: '700',
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: C.slate200,
    },
    filterPillActive: {
        backgroundColor: C.navy,
    },
    filterPillText: {
        color: C.slate700,
        fontSize: 11,
        fontWeight: '700',
    },
    filterPillTextActive: {
        color: C.white,
    },
    logBubble: {
        backgroundColor: C.white,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    logBubbleInc: {
        borderLeftWidth: 4,
        borderLeftColor: C.waDarkGreen,
    },
    logBubbleOut: {
        borderLeftWidth: 4,
        borderLeftColor: '#2563EB',
    },
    logTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    logPhone: {
        color: C.navy,
        fontSize: 12,
        fontWeight: '700',
    },
    logTime: {
        color: C.slate400,
        fontSize: 11,
    },
    logText: {
        color: C.slate800,
        fontSize: 13,
        lineHeight: 18,
    },
    sectionHeader: {
        color: C.navy,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
    },
    sessionCard: {
        backgroundColor: C.white,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    sessionTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sessionPhone: {
        color: C.navy,
        fontSize: 13,
        fontWeight: '700',
    },
    sessionStep: {
        color: C.slate500,
        fontSize: 12,
        marginTop: 2,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    resetBtnText: {
        color: C.rose,
        fontSize: 11,
        fontWeight: '700',
    },
    sessionBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: C.slate100,
        paddingTop: 6,
    },
    sessionMeta: {
        color: C.slate400,
        fontSize: 11,
    },
    resultBox: {
        backgroundColor: '#0F172A',
        borderRadius: 8,
        padding: 12,
        marginTop: 14,
    },
    resultHeader: {
        color: C.gold,
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 6,
    },
    resultCode: {
        color: '#A5F3FC',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    emptyBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: C.slate400,
        fontSize: 13,
        marginTop: 10,
    },
});
