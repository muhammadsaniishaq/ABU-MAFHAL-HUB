import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TextInput, ScrollView, TouchableOpacity, Image,
    ActivityIndicator, Alert, StyleSheet, Platform, Switch, RefreshControl, Modal
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
    waBubbleIn: '#FFFFFF',
    waBubbleOut: '#DCF8C6',
    gold: '#F5A623',
    white: '#FFFFFF',
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate300: '#CBD5E1',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate700: '#334155',
    slate800: '#1E293B',
    rose: '#EF4444',
    emerald: '#10B981',
};

interface CustomerChatThread {
    phone_number: string;
    clean_phone: string;
    profile?: any;
    user_id?: string;
    current_step?: string;
    last_interaction?: string;
    message_count: number;
    last_message?: string;
    messages: any[];
}

export default function WhatsAppBotAdmin() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [broadcasting, setBroadcasting] = useState(false);

    // Tab: 'overview' | 'chats' | 'broadcast' | 'logs' | 'tester'
    const [activeTab, setActiveTab] = useState<'overview' | 'chats' | 'broadcast' | 'logs' | 'tester'>('overview');

    // Bot Config State
    const [botEnabled, setBotEnabled] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [botPhone, setBotPhone] = useState('09065645747');
    const [adminCallPhone, setAdminCallPhone] = useState('08145853539');
    const [defaultLang, setDefaultLang] = useState<'en' | 'ha'>('en');

    // Group & Channel Links
    const [groupLink, setGroupLink] = useState('https://chat.whatsapp.com/G5yAbuMafhalSub');
    const [channelLink, setChannelLink] = useState('https://whatsapp.com/channel/0029VAbuMafhal');
    const [playStoreUrl, setPlayStoreUrl] = useState('https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub');
    const [webBaseUrl, setWebBaseUrl] = useState('https://abumafhal.com.ng');

    // Meta Diag Info
    const [metaDiag, setMetaDiag] = useState<any>(null);
    const [webhookUrl] = useState('https://uagcxrtdqttayulvgpwg.supabase.co/functions/v1/whatsapp-bot');
    const [verifyToken] = useState('abumafhal_wa_verify_2026');

    // Logs & Sessions & Customer Threads
    const [logs, setLogs] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
    const [phoneToProfileMap, setPhoneToProfileMap] = useState<Record<string, any>>({});
    const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
    const [showProfileDossier, setShowProfileDossier] = useState(false);
    const [logFilter, setLogFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
    const [chatSearch, setChatSearch] = useState('');

    // Selected Customer Conversation Modal
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerChatThread | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    // Broadcast Messenger Tool: 'all_registered' | 'bot_chatters' | 'active_7d' | 'custom'
    const [broadcastAudience, setBroadcastAudience] = useState<'all_registered' | 'bot_chatters' | 'active_7d' | 'custom'>('all_registered');
    const [customBroadcastPhones, setCustomBroadcastPhones] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('🌟 Sanarwa ta Musamman daga Abu Mafhal Sub!\n\nKuna iya samun sauƙin siyan Data, Airtime, NIN, BVN, da CAC a take a WhatsApp ko shafinmu na gizo.');
    const [broadcastResult, setBroadcastResult] = useState<any>(null);

    // Quick Test Sender Tool
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
                .in('key', [
                    'whatsapp_bot_enabled',
                    'maintenance_mode',
                    'whatsapp_bot_number',
                    'WHATSAPP_BOT_NUMBER',
                    'whatsapp_admin_call_phone',
                    'WHATSAPP_ADMIN_CALL_PHONE',
                    'whatsapp_group_link',
                    'whatsapp_channel_link',
                    'play_store_url',
                    'site_url',
                    'app_url',
                    'website_url'
                ]);

            if (settingsData) {
                const map: Record<string, string> = {};
                settingsData.forEach(s => { map[s.key] = s.value; });
                if (map['whatsapp_bot_enabled'] !== undefined) setBotEnabled(map['whatsapp_bot_enabled'] === 'true');
                if (map['maintenance_mode'] !== undefined) setMaintenanceMode(map['maintenance_mode'] === 'true');
                if (map['whatsapp_bot_number'] || map['WHATSAPP_BOT_NUMBER']) setBotPhone(map['whatsapp_bot_number'] || map['WHATSAPP_BOT_NUMBER']);
                if (map['whatsapp_admin_call_phone'] || map['WHATSAPP_ADMIN_CALL_PHONE']) setAdminCallPhone(map['whatsapp_admin_call_phone'] || map['WHATSAPP_ADMIN_CALL_PHONE']);
                if (map['whatsapp_group_link']) setGroupLink(map['whatsapp_group_link']);
                if (map['whatsapp_channel_link']) setChannelLink(map['whatsapp_channel_link']);
                if (map['play_store_url']) setPlayStoreUrl(map['play_store_url']);
                if (map['site_url'] || map['website_url'] || map['app_url']) setWebBaseUrl(map['site_url'] || map['website_url'] || map['app_url']);
            }

            // 2. Fetch Meta Live Diag
            try {
                const res = await fetch(`${webhookUrl}?diag=1`);
                if (res.ok) {
                    const diagData = await res.json();
                    setMetaDiag(diagData);
                }
            } catch (_) {}

            // 3. Fetch recent WhatsApp bot logs (last 300)
            const { data: logRows } = await supabase
                .from('whatsapp_bot_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(300);
            if (logRows) setLogs(logRows);

            // 4. Fetch WhatsApp Bot sessions
            const { data: sessionRows } = await supabase
                .from('whatsapp_bot_sessions')
                .select('*')
                .order('last_interaction', { ascending: false })
                .limit(100);
            if (sessionRows) setSessions(sessionRows);

            // 5. Fetch ALL registered customers with phone numbers from profiles
            const { data: allProfs } = await supabase
                .from('profiles')
                .select('id, full_name, email, phone, username, custom_id, referral_code, avatar_url, kyc_tier, balance, created_at, role')
                .not('phone', 'is', null)
                .order('created_at', { ascending: false });

            if (allProfs && allProfs.length > 0) {
                setRegisteredUsers(allProfs);
                const pMap: Record<string, any> = {};
                const phoneMap: Record<string, any> = {};

                allProfs.forEach(p => {
                    pMap[p.id] = p;
                    if (p.phone) {
                        let clean = p.phone.replace(/\D/g, '');
                        if (clean.startsWith('0') && clean.length === 11) clean = '234' + clean.slice(1);
                        else if (clean.length === 10) clean = '234' + clean;

                        phoneMap[clean] = p;
                        if (clean.startsWith('234') && clean.length === 13) {
                            phoneMap['0' + clean.slice(3)] = p;
                            phoneMap[clean.slice(3)] = p;
                        }
                    }
                });
                setProfilesMap(pMap);
                setPhoneToProfileMap(phoneMap);
            }

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
                { key: 'whatsapp_group_link', value: groupLink.trim() },
                { key: 'whatsapp_channel_link', value: channelLink.trim() },
            ];

            const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });
            if (error) throw error;

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('✅ Saved', 'WhatsApp Bot settings and official Group/Channel links updated successfully.');
        } catch (err: any) {
            Alert.alert('❌ Error', err.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    // Grouping all chats by Customer Phone Number
    const customerThreads: CustomerChatThread[] = useMemo(() => {
        const map: Record<string, CustomerChatThread> = {};

        // 1. Register from sessions
        sessions.forEach(sess => {
            const rawPhone = sess.phone_number || '';
            const clean = rawPhone.replace(/\D/g, '');
            if (!clean) return;

            const matched = sess.user_id ? profilesMap[sess.user_id] : (phoneToProfileMap[clean] || null);
            map[clean] = {
                phone_number: rawPhone,
                clean_phone: clean,
                user_id: sess.user_id || matched?.id,
                profile: matched,
                current_step: sess.step || 'IDLE',
                last_interaction: sess.last_interaction || sess.created_at,
                message_count: 0,
                last_message: '',
                messages: []
            };
        });

        // 2. Aggregate from logs
        logs.forEach(log => {
            const rawPhone = log.phone_number || '';
            const clean = rawPhone.replace(/\D/g, '');
            if (!clean) return;

            if (!map[clean]) {
                const matched = phoneToProfileMap[clean] || null;
                map[clean] = {
                    phone_number: rawPhone,
                    clean_phone: clean,
                    user_id: matched?.id,
                    profile: matched,
                    current_step: 'IDLE',
                    last_interaction: log.created_at,
                    message_count: 0,
                    last_message: '',
                    messages: []
                };
            }

            map[clean].messages.push(log);
            map[clean].message_count++;

            // Track latest message
            if (!map[clean].last_message && log.content) {
                map[clean].last_message = log.content;
            }
        });

        // Sort each customer thread's messages chronologically (oldest to newest)
        Object.values(map).forEach(th => {
            th.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

        // Sort threads by most recent interaction first
        return Object.values(map).sort((a, b) => {
            const timeA = new Date(a.last_interaction || 0).getTime();
            const timeB = new Date(b.last_interaction || 0).getTime();
            return timeB - timeA;
        });
    }, [sessions, logs, profilesMap, phoneToProfileMap]);

    // Filtered customer threads by search
    const filteredCustomerThreads = useMemo(() => {
        if (!chatSearch.trim()) return customerThreads;
        const q = chatSearch.toLowerCase().trim();
        return customerThreads.filter(c => {
            const name = (c.profile?.full_name || '').toLowerCase();
            const phone = c.clean_phone.toLowerCase();
            const lastMsg = (c.last_message || '').toLowerCase();
            return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
        });
    }, [customerThreads, chatSearch]);

    // Send Direct Reply to Selected Customer
    const handleSendDirectReply = async () => {
        if (!selectedCustomer || !replyText.trim()) return;

        setSendingReply(true);
        try {
            const cleanTarget = selectedCustomer.clean_phone;
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'admin_send',
                    to: cleanTarget,
                    message: replyText.trim()
                })
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data?.status === 'completed' && data?.success_count > 0) {
                // Add message to local conversation
                const newMsg = {
                    id: `local_${Date.now()}`,
                    phone_number: cleanTarget,
                    direction: 'outgoing',
                    content: replyText.trim(),
                    created_at: new Date().toISOString()
                };

                setSelectedCustomer(prev => prev ? ({
                    ...prev,
                    messages: [...prev.messages, newMsg],
                    last_message: replyText.trim(),
                    message_count: prev.message_count + 1
                }) : null);

                setReplyText('');
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert('✅ Message Sent', `Delivered directly to +${cleanTarget} via WhatsApp.`);
                loadAll();
            } else {
                Alert.alert('⚠️ Send Notice', data?.error || 'Unable to deliver message to this number. Check Meta Cloud API status.');
            }
        } catch (err: any) {
            Alert.alert('❌ Error', err.message || 'Network error');
        } finally {
            setSendingReply(false);
        }
    };

    // Send Bulk Broadcast
    const handleSendBroadcast = async () => {
        if (!broadcastMessage.trim()) {
            Alert.alert('Required', 'Please enter a message to broadcast.');
            return;
        }

        let recipients: string[] = [];

        if (broadcastAudience === 'all_registered') {
            recipients = registeredUsers
                .map(u => {
                    let c = (u.phone || '').replace(/\D/g, '');
                    if (c.startsWith('0') && c.length === 11) c = '234' + c.slice(1);
                    else if (c.length === 10) c = '234' + c;
                    return c;
                })
                .filter(c => c.length >= 10);
        } else if (broadcastAudience === 'bot_chatters') {
            recipients = customerThreads.map(c => c.clean_phone).filter(Boolean);
        } else if (broadcastAudience === 'active_7d') {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            recipients = customerThreads
                .filter(c => new Date(c.last_interaction || 0).getTime() >= sevenDaysAgo)
                .map(c => c.clean_phone)
                .filter(Boolean);
        } else if (broadcastAudience === 'custom') {
            recipients = customBroadcastPhones
                .split(/[\n,;]+/)
                .map(p => p.trim().replace(/\D/g, ''))
                .filter(p => p.length >= 10);
        }

        recipients = Array.from(new Set(recipients));

        if (recipients.length === 0) {
            Alert.alert('No Recipients', 'No valid recipient phone numbers found for this audience.');
            return;
        }

        Alert.alert(
            'Confirm Broadcast',
            `Are you sure you want to broadcast this WhatsApp message to ${recipients.length} customer(s)?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: `Send to ${recipients.length} Users`,
                    style: 'default',
                    onPress: async () => {
                        setBroadcasting(true);
                        setBroadcastResult(null);

                        try {
                            const res = await fetch(webhookUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'admin_broadcast',
                                    recipients,
                                    message: broadcastMessage.trim()
                                })
                            });

                            const data = await res.json();
                            setBroadcastResult(data);

                            if (res.ok && data?.status === 'completed') {
                                Alert.alert('🎉 Broadcast Complete', `Successfully sent to ${data.success_count} user(s). Failed: ${data.fail_count}`);
                                loadAll();
                            } else {
                                Alert.alert('⚠️ Broadcast Notice', data?.error || 'Broadcast completed with notices.');
                            }
                        } catch (err: any) {
                            Alert.alert('❌ Broadcast Failed', err.message || 'Network error');
                        } finally {
                            setBroadcasting(false);
                        }
                    }
                }
            ]
        );
    };

    // Quick Send Test Message
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
                            <Text style={s.headerTitle}>WhatsApp 24/7 Bot Hub</Text>
                        </View>
                        <Text style={s.headerSub}>Customer Chats, Group Invites & Broadcast Center</Text>
                    </View>
                    <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
                        <Ionicons name="refresh" size={18} color={C.white} />
                    </TouchableOpacity>
                </View>

                {/* Status Bar */}
                <View style={s.statusBar}>
                    <View style={s.statusPill}>
                        <View style={[s.statusDot, { backgroundColor: isConnected ? C.waGreen : C.rose }]} />
                        <Text style={s.statusText}>{isConnected ? 'Meta Cloud API Live' : 'Checking API Status'}</Text>
                    </View>
                    <View style={s.statusPill}>
                        <Ionicons name={botEnabled ? "checkmark-circle" : "pause-circle"} size={13} color={botEnabled ? C.emerald : C.gold} />
                        <Text style={s.statusText}>{botEnabled ? '24/7 Bot Active' : 'Bot Paused'}</Text>
                    </View>
                    <View style={s.statusPill}>
                        <Ionicons name="people-outline" size={13} color={C.white} />
                        <Text style={s.statusText}>{customerThreads.length} Customers</Text>
                    </View>
                </View>

                {/* Navigation Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabScrollContent}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('overview')}
                        style={[s.tabItem, activeTab === 'overview' && s.tabItemActive]}
                    >
                        <Ionicons name="speedometer-outline" size={15} color={activeTab === 'overview' ? C.navyDark : C.slate400} />
                        <Text style={[s.tabItemText, activeTab === 'overview' && s.tabItemTextActive]}>Overview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('chats')}
                        style={[s.tabItem, activeTab === 'chats' && s.tabItemActive]}
                    >
                        <Ionicons name="chatbubbles" size={15} color={activeTab === 'chats' ? C.navyDark : C.waGreen} />
                        <Text style={[s.tabItemText, activeTab === 'chats' && s.tabItemTextActive]}>
                            Customer Chats ({customerThreads.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('broadcast')}
                        style={[s.tabItem, activeTab === 'broadcast' && s.tabItemActive]}
                    >
                        <Ionicons name="megaphone-outline" size={15} color={activeTab === 'broadcast' ? C.navyDark : C.gold} />
                        <Text style={[s.tabItemText, activeTab === 'broadcast' && s.tabItemTextActive]}>Broadcast</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('logs')}
                        style={[s.tabItem, activeTab === 'logs' && s.tabItemActive]}
                    >
                        <Ionicons name="list-outline" size={15} color={activeTab === 'logs' ? C.navyDark : C.slate400} />
                        <Text style={[s.tabItemText, activeTab === 'logs' && s.tabItemTextActive]}>Live Logs ({logs.length})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('tester')}
                        style={[s.tabItem, activeTab === 'tester' && s.tabItemActive]}
                    >
                        <Ionicons name="paper-plane-outline" size={15} color={activeTab === 'tester' ? C.navyDark : C.slate400} />
                        <Text style={[s.tabItemText, activeTab === 'tester' && s.tabItemTextActive]}>Tester</Text>
                    </TouchableOpacity>
                </ScrollView>
            </LinearGradient>

            {loading ? (
                <View style={s.loaderBox}>
                    <ActivityIndicator size="large" color={C.navy} />
                    <Text style={s.loaderText}>Connecting to WhatsApp 24/7 Bot Hub...</Text>
                </View>
            ) : (
                <ScrollView
                    style={s.body}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ paddingBottom: 60 }}
                >
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <View style={s.tabContent}>
                            {/* Meta Business Info Card */}
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#E8F5E9' }]}>
                                        <Ionicons name="logo-whatsapp" size={18} color={C.waDarkGreen} />
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

                            {/* Official Group & Channel Settings */}
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
                                        <Ionicons name="people" size={18} color="#D97706" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.cardTitle}>Official Group & Channel Invites</Text>
                                        <Text style={s.cardSub}>Links sent by Bot and in Broadcasts</Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 10 }}>
                                    <Text style={s.inputLabel}>Official WhatsApp Group Invite Link:</Text>
                                    <TextInput
                                        value={groupLink}
                                        onChangeText={setGroupLink}
                                        placeholder="https://chat.whatsapp.com/G5yAbuMafhalSub"
                                        style={s.input}
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.inputLabel}>Official WhatsApp Channel Link:</Text>
                                    <TextInput
                                        value={channelLink}
                                        onChangeText={setChannelLink}
                                        placeholder="https://whatsapp.com/channel/0029VAbuMafhal"
                                        style={s.input}
                                        autoCapitalize="none"
                                    />
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
                                        <Text style={s.cardSub}>24/7 Availability & Maintenance Mode</Text>
                                    </View>
                                </View>

                                {/* Toggle Bot */}
                                <View style={s.toggleRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.toggleLabel}>WhatsApp Bot 24/7 Active</Text>
                                        <Text style={s.toggleDesc}>When active, bot answers customer requests instantly around the clock</Text>
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
                                    <Text style={s.inputLabel}>WhatsApp Bot Display Phone (09065645747):</Text>
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
                                            <Text style={s.saveBtnText}>Save WhatsApp Bot & Links Settings</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* TAB 2: CUSTOMER CHATS (GROUPED USER CONVERSATIONS) */}
                    {activeTab === 'chats' && (
                        <View style={s.tabContent}>
                            {/* Search bar */}
                            <View style={s.searchBox}>
                                <Ionicons name="search" size={18} color={C.slate400} />
                                <TextInput
                                    value={chatSearch}
                                    onChangeText={setChatSearch}
                                    placeholder="Search customer by name or phone..."
                                    style={s.searchInput}
                                />
                                {chatSearch ? (
                                    <TouchableOpacity onPress={() => setChatSearch('')}>
                                        <Ionicons name="close-circle" size={18} color={C.slate400} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {filteredCustomerThreads.length === 0 ? (
                                <View style={s.emptyState}>
                                    <Ionicons name="chatbubbles-outline" size={48} color={C.slate300} />
                                    <Text style={s.emptyTitle}>No Customer Chats Found</Text>
                                    <Text style={s.emptySub}>Chats from WhatsApp users will appear here automatically grouped by user.</Text>
                                </View>
                            ) : (
                                filteredCustomerThreads.map((thread) => {
                                    const prof = thread.profile;
                                    const name = prof?.full_name || 'WhatsApp Customer';
                                    const isLinked = Boolean(thread.user_id);
                                    const timeStr = thread.last_interaction ? new Date(thread.last_interaction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    const dateStr = thread.last_interaction ? new Date(thread.last_interaction).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

                                    return (
                                        <TouchableOpacity
                                            key={thread.clean_phone}
                                            style={s.chatThreadCard}
                                            onPress={() => setSelectedCustomer(thread)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={s.avatarCircle}>
                                                {prof?.avatar_url && typeof prof.avatar_url === 'string' && prof.avatar_url.trim().length > 5 ? (
                                                    <Image source={{ uri: prof.avatar_url }} style={s.avatarImg} />
                                                ) : (
                                                    <Text style={s.avatarText}>
                                                        {name ? name.slice(0, 2).toUpperCase() : 'WA'}
                                                    </Text>
                                                )}
                                            </View>

                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                        <Text style={s.customerName} numberOfLines={1}>{name}</Text>
                                                        {isLinked && (
                                                            <View style={s.linkedBadge}>
                                                                <Ionicons name="shield-checkmark" size={11} color={C.emerald} />
                                                                <Text style={s.linkedText}>Linked</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={s.timeText}>{dateStr} {timeStr}</Text>
                                                </View>

                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Ionicons name="call-outline" size={12} color={C.slate400} style={{ marginRight: 4 }} />
                                                    <Text style={s.customerPhone}>+{thread.clean_phone}</Text>
                                                    {prof?.balance !== undefined && (
                                                        <Text style={s.balancePill}>₦{Number(prof.balance).toLocaleString()}</Text>
                                                    )}
                                                </View>

                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                                    <Text style={s.lastMsgPreview} numberOfLines={1}>
                                                        {thread.last_message || 'No messages yet'}
                                                    </Text>
                                                    <View style={s.msgBadge}>
                                                        <Text style={s.msgBadgeText}>{thread.message_count}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {/* TAB 3: BROADCAST & BULK MESSENGER */}
                    {activeTab === 'broadcast' && (
                        <View style={s.tabContent}>
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
                                        <Ionicons name="megaphone" size={18} color="#D97706" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.cardTitle}>WhatsApp Broadcast Messenger</Text>
                                        <Text style={s.cardSub}>Send announcements to all WhatsApp customers</Text>
                                    </View>
                                </View>

                                {/* Audience Selector */}
                                <Text style={s.inputLabel}>Target Audience:</Text>
                                <View style={s.audienceRow}>
                                    <TouchableOpacity
                                        onPress={() => setBroadcastAudience('all_registered')}
                                        style={[s.audienceBtn, broadcastAudience === 'all_registered' && s.audienceBtnActive]}
                                    >
                                        <Text style={[s.audienceBtnText, broadcastAudience === 'all_registered' && s.audienceBtnTextActive]}>
                                            👥 All Registered ({registeredUsers.length})
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setBroadcastAudience('bot_chatters')}
                                        style={[s.audienceBtn, broadcastAudience === 'bot_chatters' && s.audienceBtnActive]}
                                    >
                                        <Text style={[s.audienceBtnText, broadcastAudience === 'bot_chatters' && s.audienceBtnTextActive]}>
                                            💬 Bot Users ({customerThreads.length})
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setBroadcastAudience('active_7d')}
                                        style={[s.audienceBtn, broadcastAudience === 'active_7d' && s.audienceBtnActive]}
                                    >
                                        <Text style={[s.audienceBtnText, broadcastAudience === 'active_7d' && s.audienceBtnTextActive]}>
                                            ⚡ Active (7d)
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setBroadcastAudience('custom')}
                                        style={[s.audienceBtn, broadcastAudience === 'custom' && s.audienceBtnActive]}
                                    >
                                        <Text style={[s.audienceBtnText, broadcastAudience === 'custom' && s.audienceBtnTextActive]}>
                                            📝 Custom
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {broadcastAudience === 'custom' && (
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={s.inputLabel}>Enter Phone Numbers (Comma or line separated):</Text>
                                        <TextInput
                                            value={customBroadcastPhones}
                                            onChangeText={setCustomBroadcastPhones}
                                            placeholder="08012345678, 09065645747, 08145853539"
                                            style={[s.input, { height: 70 }]}
                                            multiline
                                        />
                                    </View>
                                )}

                                {/* Message Composer */}
                                <View style={{ marginTop: 14 }}>
                                    <Text style={s.inputLabel}>Broadcast Message Body:</Text>
                                    <TextInput
                                        value={broadcastMessage}
                                        onChangeText={setBroadcastMessage}
                                        placeholder="Write your announcement or promo here..."
                                        style={[s.input, { height: 110, textAlignVertical: 'top' }]}
                                        multiline
                                    />
                                </View>

                                {/* Quick Insert Buttons */}
                                <Text style={[s.inputLabel, { marginTop: 10 }]}>Quick Insert Links:</Text>
                                <View style={s.quickChipsRow}>
                                    <TouchableOpacity
                                        onPress={() => setBroadcastMessage(prev => prev + `\n\n💬 Official WhatsApp Group: ${groupLink}`)}
                                        style={s.chip}
                                    >
                                        <Ionicons name="people" size={13} color={C.waDarkGreen} style={{ marginRight: 4 }} />
                                        <Text style={s.chipText}>+ Group Link</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setBroadcastMessage(prev => prev + `\n\n📢 Official WhatsApp Channel: ${channelLink}`)}
                                        style={s.chip}
                                    >
                                        <Ionicons name="megaphone" size={13} color="#D97706" style={{ marginRight: 4 }} />
                                        <Text style={s.chipText}>+ Channel Link</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setBroadcastMessage(prev => prev + `\n\n📱 Android App: ${playStoreUrl}`)}
                                        style={s.chip}
                                    >
                                        <Ionicons name="logo-google-playstore" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                                        <Text style={s.chipText}>+ Play Store</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setBroadcastMessage(prev => prev + `\n\n🌐 Web: ${webBaseUrl}`)}
                                        style={s.chip}
                                    >
                                        <Ionicons name="globe-outline" size={13} color={C.slate700} style={{ marginRight: 4 }} />
                                        <Text style={s.chipText}>+ Website</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* WhatsApp Preview Box */}
                                <Text style={[s.inputLabel, { marginTop: 14 }]}>WhatsApp Message Preview:</Text>
                                <View style={s.previewCard}>
                                    <View style={s.previewBubble}>
                                        <Text style={s.previewText}>{broadcastMessage}</Text>
                                        <View style={s.previewTimeRow}>
                                            <Text style={s.previewTime}>12:00 PM</Text>
                                            <Ionicons name="checkmark-done" size={13} color="#34B7F1" style={{ marginLeft: 3 }} />
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={handleSendBroadcast}
                                    disabled={broadcasting}
                                    style={[s.saveBtn, { backgroundColor: C.waDarkGreen, marginTop: 16 }]}
                                >
                                    {broadcasting ? (
                                        <ActivityIndicator color={C.white} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={16} color={C.white} style={{ marginRight: 6 }} />
                                            <Text style={s.saveBtnText}>Send WhatsApp Broadcast Now</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {broadcastResult && (
                                    <View style={[s.diagResultBox, { marginTop: 12 }]}>
                                        <Text style={s.diagResultTitle}>Broadcast Summary:</Text>
                                        <Text style={s.metaValCode}>{JSON.stringify(broadcastResult, null, 2)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* TAB 4: LIVE LOGS */}
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

                            {logs.length === 0 ? (
                                <View style={s.emptyState}>
                                    <Ionicons name="document-text-outline" size={40} color={C.slate300} />
                                    <Text style={s.emptyTitle}>No Activity Logs Yet</Text>
                                    <Text style={s.emptySub}>Incoming messages and bot responses will display here in real time.</Text>
                                </View>
                            ) : (
                                logs.map((l, idx) => (
                                    <View key={l.id || idx} style={s.logItem}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons
                                                    name={l.direction === 'incoming' ? "arrow-down-circle" : "arrow-up-circle"}
                                                    size={16}
                                                    color={l.direction === 'incoming' ? C.emerald : C.waDarkGreen}
                                                    style={{ marginRight: 6 }}
                                                />
                                                <Text style={s.logPhone}>+{l.phone_number}</Text>
                                            </View>
                                            <Text style={s.logTime}>
                                                {new Date(l.created_at).toLocaleTimeString()}
                                            </Text>
                                        </View>
                                        <Text style={s.logContent}>{l.content}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* TAB 5: TESTER */}
                    {activeTab === 'tester' && (
                        <View style={s.tabContent}>
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
                                        <Ionicons name="paper-plane" size={18} color="#2563EB" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.cardTitle}>Live WhatsApp Message Tester</Text>
                                        <Text style={s.cardSub}>Send direct test message to verify Meta Cloud API</Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 10 }}>
                                    <Text style={s.inputLabel}>Recipient Phone Number:</Text>
                                    <TextInput
                                        value={testPhone}
                                        onChangeText={setTestPhone}
                                        placeholder="08012345678 or 2349065645747"
                                        style={s.input}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.inputLabel}>Message Content:</Text>
                                    <TextInput
                                        value={testMessage}
                                        onChangeText={setTestMessage}
                                        placeholder="Message text..."
                                        style={[s.input, { height: 80 }]}
                                        multiline
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleSendTestMessage}
                                    disabled={testing}
                                    style={[s.saveBtn, { backgroundColor: C.navy, marginTop: 16 }]}
                                >
                                    {testing ? (
                                        <ActivityIndicator color={C.white} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={16} color={C.white} style={{ marginRight: 6 }} />
                                            <Text style={s.saveBtnText}>Send Test Message Via Cloud API</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {testResult && (
                                    <View style={[s.diagResultBox, { marginTop: 14 }]}>
                                        <Text style={s.diagResultTitle}>Meta API Diagnostic Result:</Text>
                                        <Text style={s.metaValCode}>{JSON.stringify(testResult, null, 2)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* CUSTOMER DETAIL & CHAT MODAL */}
            <Modal
                visible={Boolean(selectedCustomer)}
                animationType="slide"
                onRequestClose={() => setSelectedCustomer(null)}
            >
                <SafeAreaView style={s.modalSafe} edges={['top']}>
                    {selectedCustomer && (
                        <View style={{ flex: 1, backgroundColor: '#EFEAE2' }}>
                            {/* Modal Header */}
                            <View style={s.modalHeader}>
                                <TouchableOpacity onPress={() => setSelectedCustomer(null)} style={s.modalBackBtn}>
                                    <Ionicons name="arrow-back" size={22} color={C.white} />
                                </TouchableOpacity>

                                <View style={s.modalAvatarCircle}>
                                    {selectedCustomer.profile?.avatar_url && typeof selectedCustomer.profile.avatar_url === 'string' && selectedCustomer.profile.avatar_url.trim().length > 5 ? (
                                        <Image source={{ uri: selectedCustomer.profile.avatar_url }} style={s.modalAvatarImg} />
                                    ) : (
                                        <Text style={s.modalAvatarText}>
                                            {(selectedCustomer.profile?.full_name || 'WA').slice(0, 2).toUpperCase()}
                                        </Text>
                                    )}
                                </View>

                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={s.modalCustomerName} numberOfLines={1}>
                                        {selectedCustomer.profile?.full_name || 'WhatsApp Customer'}
                                    </Text>
                                    <Text style={s.modalCustomerPhone}>
                                        +{selectedCustomer.clean_phone} • {selectedCustomer.current_step}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setShowProfileDossier(prev => !prev)}
                                    style={s.infoToggleBtn}
                                >
                                    <Ionicons name={showProfileDossier ? "close-circle" : "person-circle"} size={22} color={C.gold} />
                                </TouchableOpacity>

                                {selectedCustomer.profile?.balance !== undefined && (
                                    <View style={[s.modalBalanceBadge, { marginLeft: 8 }]}>
                                        <Text style={s.modalBalanceText}>
                                            ₦{Number(selectedCustomer.profile.balance).toLocaleString()}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Customer Complete Profile Dossier Card */}
                            {selectedCustomer.profile && (
                                <View style={s.dossierCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {selectedCustomer.profile.avatar_url ? (
                                            <Image source={{ uri: selectedCustomer.profile.avatar_url }} style={s.dossierAvatar} />
                                        ) : (
                                            <View style={[s.dossierAvatar, { backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center' }]}>
                                                <Ionicons name="person" size={24} color={C.white} />
                                            </View>
                                        )}
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={s.dossierName}>{selectedCustomer.profile.full_name || 'Customer'}</Text>
                                            <Text style={s.dossierSub}>
                                                {selectedCustomer.profile.email || 'No email registered'}
                                                {selectedCustomer.profile.username ? ` • @${selectedCustomer.profile.username}` : ''}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                                                <View style={s.dossierTag}>
                                                    <Text style={s.dossierTagText}>KYC: {selectedCustomer.profile.kyc_tier || 'Tier 1'}</Text>
                                                </View>
                                                <View style={[s.dossierTag, { backgroundColor: '#EFF6FF' }]}>
                                                    <Text style={[s.dossierTagText, { color: '#2563EB' }]}>Role: {(selectedCustomer.profile.role || 'User').toUpperCase()}</Text>
                                                </View>
                                                <View style={[s.dossierTag, { backgroundColor: '#FEF3C7' }]}>
                                                    <Text style={[s.dossierTagText, { color: '#B45309' }]}>Bal: ₦{Number(selectedCustomer.profile.balance || 0).toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={s.dossierDivider} />
                                    <View style={s.dossierRow}>
                                        <Text style={s.dossierMeta}>ID: {selectedCustomer.profile.custom_id || selectedCustomer.profile.referral_code || selectedCustomer.profile.id?.slice(0, 8)}</Text>
                                        <Text style={s.dossierMeta}>Joined: {new Date(selectedCustomer.profile.created_at || Date.now()).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Conversation Scroll */}
                            <ScrollView
                                style={{ flex: 1, padding: 12 }}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            >
                                <View style={s.chatDateDivider}>
                                    <Text style={s.chatDateText}>Complete WhatsApp Activity & Messages</Text>
                                </View>

                                {selectedCustomer.messages.map((msg, i) => {
                                    const isOut = msg.direction === 'outgoing';
                                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <View
                                            key={msg.id || i}
                                            style={[
                                                s.bubbleRow,
                                                isOut ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }
                                            ]}
                                        >
                                            <View style={[s.bubble, isOut ? s.bubbleOut : s.bubbleIn]}>
                                                <Text style={[s.bubbleText, isOut && { color: '#111827' }]}>
                                                    {msg.content}
                                                </Text>
                                                <View style={s.bubbleMetaRow}>
                                                    <Text style={s.bubbleTime}>{time}</Text>
                                                    {isOut && (
                                                        <Ionicons name="checkmark-done" size={13} color="#34B7F1" style={{ marginLeft: 3 }} />
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* Direct WhatsApp Reply Box */}
                            <View style={s.replyBoxContainer}>
                                <TextInput
                                    value={replyText}
                                    onChangeText={setReplyText}
                                    placeholder="Type a WhatsApp reply to this customer..."
                                    style={s.replyInput}
                                    multiline
                                />
                                <TouchableOpacity
                                    onPress={handleSendDirectReply}
                                    disabled={sendingReply || !replyText.trim()}
                                    style={[s.sendBtn, (!replyText.trim() || sendingReply) && { opacity: 0.5 }]}
                                >
                                    {sendingReply ? (
                                        <ActivityIndicator color={C.white} size="small" />
                                    ) : (
                                        <Ionicons name="send" size={18} color={C.white} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </SafeAreaView>
            </Modal>
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
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: C.white,
    },
    headerSub: {
        fontSize: 12,
        color: C.slate400,
        marginTop: 2,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
        flexWrap: 'wrap',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 5,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        color: C.white,
        fontWeight: '600',
    },
    tabScroll: {
        marginTop: 14,
    },
    tabScrollContent: {
        gap: 8,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        gap: 6,
    },
    tabItemActive: {
        backgroundColor: C.white,
    },
    tabItemText: {
        fontSize: 12,
        color: C.slate300,
        fontWeight: '600',
    },
    tabItemTextActive: {
        color: C.navyDark,
        fontWeight: '700',
    },
    body: {
        flex: 1,
        backgroundColor: C.slate50,
    },
    loaderBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: C.slate50,
    },
    loaderText: {
        marginTop: 12,
        fontSize: 13,
        color: C.slate500,
        fontWeight: '500',
    },
    tabContent: {
        padding: 16,
    },
    card: {
        backgroundColor: C.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.slate200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: C.slate800,
    },
    cardSub: {
        fontSize: 11,
        color: C.slate500,
        marginTop: 1,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    metaItem: {
        width: '48%',
        backgroundColor: C.slate50,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    metaLabel: {
        fontSize: 10,
        color: C.slate400,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    metaVal: {
        fontSize: 13,
        color: C.slate800,
        fontWeight: '700',
        marginTop: 2,
    },
    metaValCode: {
        fontSize: 11,
        color: C.navyLight,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 2,
    },
    webhookBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.slate50,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.slate200,
        marginTop: 12,
    },
    webhookLabel: {
        fontSize: 10,
        color: C.slate500,
        fontWeight: '600',
    },
    webhookUrl: {
        fontSize: 11,
        color: C.navy,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 2,
    },
    copyBtn: {
        padding: 8,
        backgroundColor: C.slate200,
        borderRadius: 8,
        marginLeft: 8,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: C.slate800,
    },
    toggleDesc: {
        fontSize: 11,
        color: C.slate500,
        marginTop: 2,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: C.slate700,
        marginBottom: 6,
    },
    input: {
        backgroundColor: C.slate50,
        borderWidth: 1,
        borderColor: C.slate300,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: C.slate800,
    },
    langRow: {
        flexDirection: 'row',
        gap: 10,
    },
    langPill: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.slate300,
        backgroundColor: C.slate50,
    },
    langPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    langPillText: {
        fontSize: 12,
        color: C.slate700,
        fontWeight: '600',
    },
    langPillTextActive: {
        color: C.white,
        fontWeight: '700',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.navy,
        paddingVertical: 13,
        borderRadius: 12,
        marginTop: 18,
    },
    saveBtnText: {
        color: C.white,
        fontWeight: '700',
        fontSize: 13,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.slate200,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: C.slate800,
    },
    chatThreadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: C.navy,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: C.white,
        fontSize: 14,
        fontWeight: '700',
    },
    customerName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.slate800,
    },
    customerPhone: {
        fontSize: 11,
        color: C.slate500,
    },
    linkedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 6,
        gap: 3,
    },
    linkedText: {
        fontSize: 9,
        fontWeight: '700',
        color: C.emerald,
    },
    balancePill: {
        fontSize: 11,
        fontWeight: '700',
        color: C.navyMid,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        marginLeft: 8,
    },
    timeText: {
        fontSize: 10,
        color: C.slate400,
    },
    lastMsgPreview: {
        fontSize: 12,
        color: C.slate500,
        flex: 1,
        marginRight: 8,
    },
    msgBadge: {
        backgroundColor: C.waDarkGreen,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    msgBadgeText: {
        color: C.white,
        fontSize: 10,
        fontWeight: '700',
    },
    audienceRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    audienceBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.slate200,
        backgroundColor: C.slate50,
    },
    audienceBtnActive: {
        backgroundColor: C.waDarkGreen,
        borderColor: C.waDarkGreen,
    },
    audienceBtnText: {
        fontSize: 11,
        color: C.slate700,
        fontWeight: '600',
    },
    audienceBtnTextActive: {
        color: C.white,
        fontWeight: '700',
    },
    quickChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.slate100,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    chipText: {
        fontSize: 11,
        color: C.slate700,
        fontWeight: '600',
    },
    previewCard: {
        backgroundColor: '#E5DDD5',
        borderRadius: 12,
        padding: 12,
        marginTop: 6,
    },
    previewBubble: {
        backgroundColor: C.waBubbleOut,
        borderRadius: 8,
        padding: 10,
        alignSelf: 'flex-end',
        maxWidth: '90%',
    },
    previewText: {
        fontSize: 13,
        color: '#111827',
        lineHeight: 18,
    },
    previewTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    previewTime: {
        fontSize: 9,
        color: '#6B7280',
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    filterPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: C.slate600,
    },
    filterPillTextActive: {
        color: C.white,
        fontWeight: '700',
    },
    logItem: {
        backgroundColor: C.white,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.slate200,
    },
    logPhone: {
        fontSize: 12,
        fontWeight: '700',
        color: C.slate800,
    },
    logTime: {
        fontSize: 10,
        color: C.slate400,
    },
    logContent: {
        fontSize: 12,
        color: C.slate600,
        marginTop: 4,
    },
    diagResultBox: {
        backgroundColor: C.slate100,
        borderRadius: 10,
        padding: 12,
    },
    diagResultTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: C.slate700,
        marginBottom: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: C.slate700,
        marginTop: 10,
    },
    emptySub: {
        fontSize: 12,
        color: C.slate400,
        textAlign: 'center',
        marginTop: 4,
    },
    modalSafe: {
        flex: 1,
        backgroundColor: C.navyDark,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.navyDark,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    modalBackBtn: {
        padding: 6,
    },
    modalAvatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: C.waDarkGreen,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    modalAvatarText: {
        color: C.white,
        fontSize: 13,
        fontWeight: '700',
    },
    modalCustomerName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.white,
    },
    modalCustomerPhone: {
        fontSize: 11,
        color: C.slate300,
    },
    modalBalanceBadge: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    modalBalanceText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.gold,
    },
    chatDateDivider: {
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.06)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 12,
    },
    chatDateText: {
        fontSize: 10,
        color: C.slate600,
        fontWeight: '600',
    },
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    bubble: {
        maxWidth: '82%',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 1,
        elevation: 1,
    },
    bubbleIn: {
        backgroundColor: C.waBubbleIn,
        borderTopLeftRadius: 2,
    },
    bubbleOut: {
        backgroundColor: C.waBubbleOut,
        borderTopRightRadius: 2,
    },
    bubbleText: {
        fontSize: 13,
        color: '#1F2937',
        lineHeight: 18,
    },
    bubbleMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    bubbleTime: {
        fontSize: 9,
        color: '#6B7280',
    },
    replyBoxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: C.slate200,
    },
    replyInput: {
        flex: 1,
        backgroundColor: C.slate100,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 13,
        color: C.slate800,
        maxHeight: 90,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: C.waDarkGreen,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    avatarImg: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    modalAvatarImg: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    infoToggleBtn: {
        padding: 4,
        marginLeft: 6,
    },
    dossierCard: {
        backgroundColor: C.white,
        padding: 12,
        marginHorizontal: 10,
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.slate200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    dossierAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    dossierName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.slate800,
    },
    dossierSub: {
        fontSize: 11,
        color: C.slate500,
        marginTop: 1,
    },
    dossierTag: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dossierTagText: {
        fontSize: 9,
        fontWeight: '700',
        color: C.emerald,
    },
    dossierDivider: {
        height: 1,
        backgroundColor: C.slate100,
        marginVertical: 8,
    },
    dossierRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dossierMeta: {
        fontSize: 10,
        color: C.slate400,
        fontWeight: '500',
    },
});
