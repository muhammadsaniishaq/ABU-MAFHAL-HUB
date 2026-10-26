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
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { sendInstantNotification } from '../../hooks/usePushNotifications';

const { width } = Dimensions.get('window');

const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    navy: '#0F172A',
    navyLight: '#1E293B',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    green: '#10B981',
    greenLight: '#ECFDF5',
    greenBorder: '#A7F3D0',
    red: '#EF4444',
    redLight: '#FEF2F2',
    redBorder: '#FECACA',
    blue: '#2563EB',
    blueLight: '#EFF6FF',
    blueBorder: '#BFDBFE',
    purple: '#7C3AED',
    purpleLight: '#F5F3FF',
    purpleBorder: '#DDD6FE',
    cyan: '#0891B2',
    cyanLight: '#ECFEFF',
    cyanBorder: '#A5F3FC',
};

export interface AdminNotificationItem {
    id: string;
    user_id?: string | null;
    title: string;
    body: string;
    type?: string; // 'support_track' | 'staff_meeting' | 'liquidity_low' | 'system_alert' | 'broadcast' | 'kyc_alert'
    category?: string;
    priority?: 'high' | 'normal' | 'urgent';
    data?: any;
    is_read: boolean;
    created_at: string;
    profiles?: {
        full_name?: string;
        email?: string;
        phone?: string;
        role?: string;
    };
}

export default function AdminPushNotificationsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Mode tabs: 'inbox' (Admin Alert Center) vs 'broadcasts' (Permanent Broadcast Archive) vs 'compose' (Send New Push)
    const [activeTab, setActiveTab] = useState<'inbox' | 'broadcasts' | 'compose'>((params.tab as any) === 'compose' ? 'compose' : (params.tab as any) === 'broadcasts' ? 'broadcasts' : 'inbox');
    
    // Notifications Feed State
    const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'support_track' | 'staff_meeting' | 'liquidity_low' | 'system'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modal State
    const [selectedItem, setSelectedItem] = useState<AdminNotificationItem | null>(null);

    // Ringtone Manager Modal State & Sound Player
    const [showRingtoneModal, setShowRingtoneModal] = useState(false);
    const [adminRingtone, setAdminRingtone] = useState<'executive_bell' | 'siren_alert' | 'cash_register' | 'subtle_chime' | 'military_horn' | 'radar_ping'>('executive_bell');
    const [playingRingtone, setPlayingRingtone] = useState<string | null>(null);
    const soundInstanceRef = React.useRef<Audio.Sound | null>(null);

    // Compose State
    const [dispatchType, setDispatchType] = useState<'support_track' | 'staff_meeting' | 'liquidity_low' | 'system_alert' | 'broadcast'>('broadcast');
    const [targetAudience, setTargetAudience] = useState<'all' | 'admins' | 'staff' | 'single'>('all');
    const [singleTargetQuery, setSingleTargetQuery] = useState('');
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');
    const [meetingTime, setMeetingTime] = useState('Today at 4:00 PM');
    const [meetingLink, setMeetingLink] = useState('https://meet.google.com/abu-mafhal-team');
    const [lowFloatProvider, setLowFloatProvider] = useState('BilalSadaSub Telecom');
    const [lowFloatBalance, setLowFloatBalance] = useState('₦3,450.00');
    const [isUrgent, setIsUrgent] = useState(false);
    const [isPermanent, setIsPermanent] = useState(true); // Permanent broadcast that cannot be deleted
    const [selectedRingtoneForPush, setSelectedRingtoneForPush] = useState<string>('executive_bell');
    const [sending, setSending] = useState(false);

    // Ringtone Catalog for Admins and Recipients
    const RINGTONE_CATALOG = [
        {
            id: 'executive_bell',
            name: 'Executive Crystal Bell',
            hausa: 'Sautin Kararrawa ta Alfarma',
            icon: 'notifications',
            color: C.gold,
            uri: 'https://cdn.freesound.org/previews/264/264981_4486188-lq.mp3',
            desc: 'Sleek executive chime for important briefings and notices.'
        },
        {
            id: 'siren_alert',
            name: 'Emergency Siren Alarm',
            hausa: 'Sautin Faɗakarwa ta Gaggawa',
            icon: 'alert-circle',
            color: C.red,
            uri: 'https://cdn.freesound.org/previews/456/456544_5121236-lq.mp3',
            desc: 'High-urgency alert for critical float depletion & incidents.'
        },
        {
            id: 'cash_register',
            name: 'Money & Wealth Chime',
            hausa: 'Sautin Kudin Shiga da Asusun Kudi',
            icon: 'cash',
            color: C.green,
            uri: 'https://cdn.freesound.org/previews/333/333404_4684427-lq.mp3',
            desc: 'Crisp cash top-up sound for wallet credits and payouts.'
        },
        {
            id: 'military_horn',
            name: 'Staff Summoning Horn',
            hausa: 'Sautin Taron Ma’aikata na Gaggawa',
            icon: 'people',
            color: C.purple,
            uri: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
            desc: 'Attention-grabbing bugle horn for emergency staff calls.'
        },
        {
            id: 'radar_ping',
            name: 'Sonar Radar Ping',
            hausa: 'Sautin Radar na Binciken Tikitin User',
            icon: 'radio',
            color: C.blue,
            uri: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
            desc: 'Futuristic sonar ping for user tracking and new tickets.'
        },
        {
            id: 'subtle_chime',
            name: 'Subtle Modern Pop',
            hausa: 'Sauƙin Sauti Mai Taushi',
            icon: 'sparkles',
            color: C.cyan,
            uri: 'https://cdn.freesound.org/previews/352/352661_4019029-lq.mp3',
            desc: 'Soft pleasant bubble pop for routine platform updates.'
        }
    ];

    useEffect(() => {
        loadSavedAdminRingtone();
        fetchAdminNotifications();
        subscribeToRealtimeNotifications();

        return () => {
            if (soundInstanceRef.current) {
                soundInstanceRef.current.unloadAsync().catch(() => {});
            }
        };
    }, []);

    const fetchAdminNotifications = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('*, profiles:user_id(full_name, email, phone, role)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && data) {
                setNotifications(data);
            }
        } catch (e) {
            console.error('Error fetching admin notifications:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadSavedAdminRingtone = async () => {
        try {
            const saved = await AsyncStorage.getItem('admin_preferred_ringtone');
            if (saved) {
                setAdminRingtone(saved as any);
                setSelectedRingtoneForPush(saved);
            }
        } catch (e) {
            console.log('Error loading saved ringtone:', e);
        }
    };

    const handleSaveAdminRingtone = async (toneId: any) => {
        try {
            setAdminRingtone(toneId);
            await AsyncStorage.setItem('admin_preferred_ringtone', toneId);
            playPreviewSound(toneId);
            Alert.alert(
                'Ringtone Updated 🔔',
                `An saita sautin "${RINGTONE_CATALOG.find(r => r.id === toneId)?.name}" a matsayin sautin faɗakarwa na Admin!`
            );
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const playPreviewSound = async (toneId: string) => {
        try {
            const tone = RINGTONE_CATALOG.find(t => t.id === toneId);
            if (!tone) return;

            if (soundInstanceRef.current) {
                await soundInstanceRef.current.unloadAsync().catch(() => {});
                soundInstanceRef.current = null;
            }

            if (playingRingtone === toneId) {
                setPlayingRingtone(null);
                return;
            }

            setPlayingRingtone(toneId);
            const { sound } = await Audio.Sound.createAsync(
                { uri: tone.uri },
                { shouldPlay: true, volume: 1.0 }
            );
            soundInstanceRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
                    setPlayingRingtone(null);
                }
            });
        } catch (e) {
            console.log('Error playing audio preview:', e);
            setPlayingRingtone(null);
        }
    };

    const subscribeToRealtimeNotifications = () => {
        const channel = supabase
            .channel('admin-notifs-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                async (payload) => {
                    const newNotif = payload.new as AdminNotificationItem;
                    setNotifications(prev => [newNotif, ...prev]);

                    // Play configured Admin Ringtone on incoming alert
                    try {
                        const targetToneId = newNotif.data?.ringtone || adminRingtone || 'executive_bell';
                        const tone = RINGTONE_CATALOG.find(t => t.id === targetToneId) || RINGTONE_CATALOG[0];
                        if (tone?.uri) {
                            const { sound } = await Audio.Sound.createAsync(
                                { uri: tone.uri },
                                { shouldPlay: true, volume: 1.0 }
                            );
                            soundInstanceRef.current = sound;
                        }
                    } catch (soundErr) {
                        console.log('Realtime sound playback error:', soundErr);
                    }

                    // Instant in-app heads-up trigger
                    sendInstantNotification(
                        newNotif.title || 'New Admin Notification',
                        newNotif.body || 'You have an important platform alert.',
                        newNotif.data || {},
                        newNotif.priority === 'urgent' ? 'security' : 'transactions'
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAdminNotifications();
    }, []);

    const markAsRead = async (item: AdminNotificationItem) => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', item.id);

            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
            if (selectedItem?.id === item.id) {
                setSelectedItem(prev => prev ? { ...prev, is_read: true } : null);
            }
        } catch (e) {}
    };

    const markAllAsRead = async () => {
        try {
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length === 0) return;

            await supabase
                .from('notifications')
                .update({ is_read: true })
                .in('id', unreadIds);

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            Alert.alert('Done', 'All notifications marked as read.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    // Quick Templates Handler for Compose
    const applyComposePreset = (type: 'support_track' | 'staff_meeting' | 'liquidity_low' | 'system_alert' | 'broadcast') => {
        setDispatchType(type);
        if (type === 'staff_meeting') {
            setTargetAudience('staff');
            setPushTitle('🚨 Emergency Staff Meeting Notice');
            setPushBody(`All management staff are required to join the strategy briefing today at ${meetingTime}. Agenda: Operations, float reserves, and customer support tracking.`);
            setIsUrgent(true);
        } else if (type === 'liquidity_low') {
            setTargetAudience('admins');
            setPushTitle('⚠️ Critical: Low Liquidity Float Alert');
            setPushBody(`URGENT: ${lowFloatProvider} balance is critically low at ${lowFloatBalance} (below threshold). Please top up provider immediately to prevent failed transactions.`);
            setIsUrgent(true);
        } else if (type === 'support_track') {
            setTargetAudience('admins');
            setPushTitle('🎫 User Support Ticket Track Notice');
            setPushBody('A priority transaction issue was flagged by a customer requiring urgent administrative resolution. Tap to review ticket dossier.');
            setIsUrgent(false);
        } else if (type === 'system_alert') {
            setTargetAudience('all');
            setPushTitle('🛡️ System Security & Maintenance Notice');
            setPushBody('Routine core banking system upgrade scheduled. All operations will continue normally without downtime.');
            setIsUrgent(false);
        } else {
            setPushTitle('📢 Important Announcement from Management');
            setPushBody('Exclusive data bonus and new features are now live on Abu Mafhal Sub. Thank you for your continued partnership.');
            setIsUrgent(false);
        }
    };

    // Dispatch Push Notification
    const handleDispatchNotification = async () => {
        if (!pushTitle.trim() || !pushBody.trim()) {
            return Alert.alert('Fields Required', 'Please enter both Title and Body for the notification.');
        }

        setSending(true);
        try {
            let targetUsers: { id?: string; expo_push_token?: string }[] = [];

            if (targetAudience === 'all') {
                const { data } = await supabase.from('profiles').select('id, expo_push_token').limit(200);
                targetUsers = data || [];
            } else if (targetAudience === 'admins' || targetAudience === 'staff') {
                const { data } = await supabase.from('profiles').select('id, expo_push_token').in('role', ['admin', 'super_admin']);
                targetUsers = data || [];
            } else if (targetAudience === 'single' && singleTargetQuery.trim()) {
                const q = singleTargetQuery.trim();
                let col = 'email';
                if (/^\d+$/.test(q) || q.startsWith('+')) col = 'phone';
                else if (q.length === 36) col = 'id';

                const { data } = await supabase.from('profiles').select('id, expo_push_token').eq(col, q).maybeSingle();
                if (data) targetUsers = [data];
            }

            // 1. Insert into notifications table (Marked as permanent broadcast with customized ringtone)
            const insertRows: any[] = targetUsers.map(u => ({
                user_id: u.id || null,
                title: pushTitle.trim(),
                body: pushBody.trim(),
                type: dispatchType,
                category: dispatchType === 'liquidity_low' ? 'liquidity' : dispatchType === 'staff_meeting' ? 'staff' : 'system',
                priority: isUrgent ? 'urgent' : 'normal',
                is_read: false,
                is_permanent: isPermanent,
                data: {
                    type: dispatchType,
                    is_permanent: isPermanent,
                    ringtone: selectedRingtoneForPush,
                    ringtone_name: RINGTONE_CATALOG.find(r => r.id === selectedRingtoneForPush)?.name,
                    target_audience: targetAudience,
                    sent_by_admin: true,
                    meeting_link: dispatchType === 'staff_meeting' ? meetingLink : undefined,
                    provider: dispatchType === 'liquidity_low' ? lowFloatProvider : undefined,
                    route: dispatchType === 'liquidity_low' ? '/manage/liquidity' : dispatchType === 'support_track' ? '/manage/tickets' : '/manage/notifications'
                },
                created_at: new Date().toISOString()
            }));

            // Fallback: If no target user specified, create a global system alert row
            if (insertRows.length === 0) {
                insertRows.push({
                    user_id: null,
                    title: pushTitle.trim(),
                    body: pushBody.trim(),
                    type: dispatchType,
                    category: 'system',
                    priority: isUrgent ? 'urgent' : 'normal',
                    is_read: false,
                    is_permanent: isPermanent,
                    data: { 
                        type: dispatchType,
                        is_permanent: isPermanent,
                        ringtone: selectedRingtoneForPush,
                        ringtone_name: RINGTONE_CATALOG.find(r => r.id === selectedRingtoneForPush)?.name,
                        target_audience: targetAudience,
                        sent_by_admin: true,
                        meeting_link: dispatchType === 'staff_meeting' ? meetingLink : undefined,
                        provider: dispatchType === 'liquidity_low' ? lowFloatProvider : undefined,
                        route: dispatchType === 'liquidity_low' ? '/manage/liquidity' : dispatchType === 'support_track' ? '/manage/tickets' : '/manage/notifications'
                    },
                    created_at: new Date().toISOString()
                });
            }

            const { error: insErr } = await supabase.from('notifications').insert(insertRows);
            if (insErr) throw insErr;

            // 2. Dispatch via Expo Push API for users with valid tokens
            const tokens = targetUsers.map(u => u.expo_push_token).filter((t): t is string => Boolean(t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))));
            if (tokens.length > 0) {
                const messages = tokens.map(token => ({
                    to: token,
                    sound: 'default',
                    title: pushTitle.trim(),
                    body: pushBody.trim(),
                    channelId: isUrgent ? 'security' : 'transactions',
                    priority: isUrgent ? 'high' : 'default',
                    data: {
                        route: dispatchType === 'liquidity_low' ? '/manage/liquidity' : dispatchType === 'support_track' ? '/manage/tickets' : '/manage/communications'
                    }
                }));

                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(messages)
                }).catch(() => {});
            }

            Alert.alert('Push Dispatched 🚀', `Notification successfully dispatched to ${targetUsers.length > 0 ? targetUsers.length : 1} recipient(s).`);
            setPushTitle('');
            setPushBody('');
            setActiveTab('inbox');
            fetchAdminNotifications();
        } catch (e: any) {
            Alert.alert('Dispatch Failed', e.message || 'Could not send notification');
        } finally {
            setSending(false);
        }
    };

    // Filtered Feed Items
    const filteredNotifications = useMemo(() => {
        return notifications.filter(item => {
            const matchesCategory = categoryFilter === 'all' || 
                (categoryFilter === 'support_track' && (item.type?.includes('support') || item.type?.includes('ticket') || item.category === 'support')) ||
                (categoryFilter === 'staff_meeting' && (item.type?.includes('staff') || item.type?.includes('meeting') || item.title?.toLowerCase().includes('meeting'))) ||
                (categoryFilter === 'liquidity_low' && (item.type?.includes('liquidity') || item.type?.includes('sms_alert') || item.title?.toLowerCase().includes('float') || item.title?.toLowerCase().includes('liquidity'))) ||
                (categoryFilter === 'system' && (item.type === 'broadcast' || item.type === 'system_alert' || !item.type));

            const matchesSearch = !searchQuery.trim() ||
                (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.body || '').toLowerCase().includes(searchQuery.toLowerCase());

            return matchesCategory && matchesSearch;
        });
    }, [notifications, categoryFilter, searchQuery]);

    // Permanent Broadcasts Archive (Duk wani sako da aka tura wanda ba ya goguwa)
    const broadcastArchive = useMemo(() => {
        return notifications.filter(item => {
            const isBroadcast = item.type === 'broadcast' || 
                item.type === 'system_alert' || 
                item.type === 'admin_push' || 
                item.type === 'staff_meeting' ||
                item.data?.sent_by_admin === true ||
                item.data?.is_permanent === true;
            
            if (!isBroadcast) return false;
            if (!searchQuery.trim()) return true;

            return (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                   (item.body || '').toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [notifications, searchQuery]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIconForType = (type?: string, title?: string) => {
        const t = (type || '').toLowerCase();
        const str = (title || '').toLowerCase();

        if (t.includes('liquidity') || str.includes('float') || str.includes('liquidity')) {
            return { name: 'wallet', color: C.red, bg: C.redLight, label: 'Float Low' };
        }
        if (t.includes('staff') || str.includes('meeting')) {
            return { name: 'people', color: C.purple, bg: C.purpleLight, label: 'Staff Meeting' };
        }
        if (t.includes('support') || t.includes('ticket') || str.includes('track')) {
            return { name: 'headset', color: C.blue, bg: C.blueLight, label: 'User Track' };
        }
        if (str.includes('kyc') || t.includes('kyc')) {
            return { name: 'shield-checkmark', color: C.green, bg: C.greenLight, label: 'KYC Alert' };
        }
        return { name: 'notifications', color: C.gold, bg: C.goldLight, label: 'Platform Alert' };
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Clean Light Executive Header */}
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={20} color={C.textMain} />
                </TouchableOpacity>

                <View style={s.brandWrap}>
                    <View style={s.logoCircle}>
                        <Ionicons name="notifications" size={18} color={C.gold} />
                    </View>
                    <View>
                        <Text style={s.pageTitle}>Admin Push Center</Text>
                        <Text style={s.pageSub}>User Tracking, Staff Meetings & Alerts</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                        onPress={() => setShowRingtoneModal(true)}
                        style={s.ringtoneHeaderBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="musical-notes" size={15} color={C.gold} />
                        <Text style={s.ringtoneHeaderBtnText}>Ringtone</Text>
                    </TouchableOpacity>

                    {activeTab === 'inbox' && unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllAsRead} style={s.markReadBtn} activeOpacity={0.8}>
                            <Ionicons name="checkmark-done" size={14} color={C.blue} />
                            <Text style={s.markReadText}>Read All</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={s.tabSwitcherBar}>
                <TouchableOpacity
                    onPress={() => setActiveTab('inbox')}
                    style={[s.tabSwitchBtn, activeTab === 'inbox' && s.tabSwitchBtnActive]}
                >
                    <Ionicons name="notifications-outline" size={15} color={activeTab === 'inbox' ? '#FFFFFF' : C.textSub} />
                    <Text style={[s.tabSwitchText, activeTab === 'inbox' && s.tabSwitchTextActive]}>
                        Alerts
                    </Text>
                    {unreadCount > 0 && (
                        <View style={s.tabBadge}>
                            <Text style={s.tabBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('broadcasts')}
                    style={[s.tabSwitchBtn, activeTab === 'broadcasts' && s.tabSwitchBtnActive]}
                >
                    <Ionicons name="archive-outline" size={15} color={activeTab === 'broadcasts' ? '#FFFFFF' : C.textSub} />
                    <Text style={[s.tabSwitchText, activeTab === 'broadcasts' && s.tabSwitchTextActive]}>
                        Broadcasts ({broadcastArchive.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        setActiveTab('compose');
                        if (!pushTitle) applyComposePreset('broadcast');
                    }}
                    style={[s.tabSwitchBtn, activeTab === 'compose' && s.tabSwitchBtnActive]}
                >
                    <Ionicons name="paper-plane-outline" size={15} color={activeTab === 'compose' ? '#FFFFFF' : C.textSub} />
                    <Text style={[s.tabSwitchText, activeTab === 'compose' && s.tabSwitchTextActive]}>
                        Send Push
                    </Text>
                </TouchableOpacity>
            </View>

            {/* TAB 1: INBOX FEED (Dedicated Notifications Hub) */}
            {activeTab === 'inbox' ? (
                <View style={{ flex: 1 }}>
                    {/* Category Quick Filter Chips */}
                    <View style={s.filterContainer}>
                        <View style={s.searchBox}>
                            <Ionicons name="search-outline" size={16} color={C.textMuted} />
                            <TextInput
                                style={s.searchInput}
                                placeholder="Search notifications by title or keyword..."
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color={C.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                {[
                                    { key: 'all', label: `All Alerts (${notifications.length})` },
                                    { key: 'support_track', label: '🎧 User Tracking' },
                                    { key: 'staff_meeting', label: '👥 Staff Meetings' },
                                    { key: 'liquidity_low', label: '🚨 Liquidity Low' },
                                    { key: 'system', label: '⚙️ System & Broadcasts' },
                                ].map(c => {
                                    const isActive = categoryFilter === c.key;
                                    return (
                                        <TouchableOpacity
                                            key={c.key}
                                            onPress={() => setCategoryFilter(c.key as any)}
                                            style={[s.filterChip, isActive && s.filterChipActive]}
                                        >
                                            <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
                                                {c.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Feed List */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={s.feedScrollContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
                    >
                        {loading ? (
                            <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={C.gold} />
                                <Text style={{ marginTop: 10, fontSize: 13, color: C.textSub, fontWeight: '700' }}>
                                    Connecting Realtime Alert Stream...
                                </Text>
                            </View>
                        ) : filteredNotifications.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Ionicons name="notifications-off-outline" size={42} color="#CBD5E1" />
                                <Text style={s.emptyTitle}>No Notifications Found</Text>
                                <Text style={s.emptySub}>
                                    All customer tracks, staff meetings, and provider float alerts will display here in realtime.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setActiveTab('compose');
                                        applyComposePreset('staff_meeting');
                                    }}
                                    style={s.emptyActionBtn}
                                >
                                    <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                                    <Text style={s.emptyActionBtnText}>Send New Push Notification</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            filteredNotifications.map(item => {
                                const iconMeta = getIconForType(item.type, item.title);
                                const isUnread = !item.is_read;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => {
                                            setSelectedItem(item);
                                            if (isUnread) markAsRead(item);
                                        }}
                                        style={[s.notifCard, isUnread && s.notifCardUnread]}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[s.notifIconCircle, { backgroundColor: iconMeta.bg }]}>
                                            <Ionicons name={iconMeta.name as any} size={18} color={iconMeta.color} />
                                        </View>

                                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingRight: 6 }}>
                                                    <Text style={[s.notifTitle, isUnread && { fontWeight: '900', color: C.textMain }]} numberOfLines={1}>
                                                        {item.title}
                                                    </Text>
                                                    {isUnread && <View style={s.unreadDot} />}
                                                </View>
                                                <Text style={s.notifTime}>
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>

                                            <Text style={s.notifBody} numberOfLines={2}>
                                                {item.body}
                                            </Text>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                                <View style={[s.tagBadge, { backgroundColor: iconMeta.bg }]}>
                                                    <Text style={[s.tagBadgeText, { color: iconMeta.color }]}>
                                                        {iconMeta.label}
                                                    </Text>
                                                </View>
                                                {item.profiles?.full_name && (
                                                    <Text style={s.userBadgeText}>
                                                        From: {item.profiles.full_name}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>

                                        <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            ) : activeTab === 'broadcasts' ? (
                /* TAB 2: PERMANENT BROADCAST ARCHIVE (Ba ya goguwa) */
                <View style={{ flex: 1 }}>
                    {/* Header banner explaining permanent retention */}
                    <View style={s.permanentNoticeBanner}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="shield-checkmark" size={16} color={C.gold} />
                            <Text style={s.permanentNoticeTitle}>Permanent Broadcast Vault</Text>
                        </View>
                        <Text style={s.permanentNoticeSub}>
                            Duk wani sakon Broadcast da sanarwar gaggawa da ka tura yana nan a ajiye ba ya goguwa domin ya zama cikakken tarihin bayanai (Audit Trail).
                        </Text>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={s.feedScrollContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
                    >
                        {loading ? (
                            <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={C.gold} />
                                <Text style={{ marginTop: 10, fontSize: 13, color: C.textSub, fontWeight: '700' }}>
                                    Loading Broadcast History...
                                </Text>
                            </View>
                        ) : broadcastArchive.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Ionicons name="megaphone-outline" size={42} color="#CBD5E1" />
                                <Text style={s.emptyTitle}>No Broadcasts Sent Yet</Text>
                                <Text style={s.emptySub}>
                                    Whenever you dispatch a system alert, staff meeting, or platform announcement, it will be permanently preserved here.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setActiveTab('compose');
                                        applyComposePreset('broadcast');
                                    }}
                                    style={s.emptyActionBtn}
                                >
                                    <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                                    <Text style={s.emptyActionBtnText}>Send First Broadcast</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            broadcastArchive.map((item, idx) => {
                                const iconMeta = getIconForType(item.type, item.title);
                                return (
                                    <TouchableOpacity
                                        key={item.id || `bcast-${idx}`}
                                        onPress={() => {
                                            setSelectedItem(item);
                                        }}
                                        style={s.broadcastArchiveCard}
                                        activeOpacity={0.75}
                                    >
                                        <View style={[s.notifIconCircle, { backgroundColor: iconMeta.bg }]}>
                                            <Ionicons name={iconMeta.name as any} size={18} color={iconMeta.color} />
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <Text style={[s.notifTitle, { flex: 1, paddingRight: 6 }]} numberOfLines={1}>
                                                    {item.title}
                                                </Text>
                                                <View style={s.permanentTag}>
                                                    <Ionicons name="lock-closed" size={10} color="#D97706" />
                                                    <Text style={s.permanentTagText}>Permanent</Text>
                                                </View>
                                            </View>

                                            <Text style={s.notifBody} numberOfLines={2}>
                                                {item.body}
                                            </Text>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                                <View style={[s.tagBadge, { backgroundColor: iconMeta.bg }]}>
                                                    <Text style={[s.tagBadgeText, { color: iconMeta.color }]}>
                                                        {iconMeta.label}
                                                    </Text>
                                                </View>
                                                <Text style={s.notifTime}>
                                                    {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            ) : (
                /* TAB 3: COMPOSE PUSH NOTIFICATION STUDIO */
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={s.composeScrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 1. Quick Presets Bar */}
                    <Text style={s.sectionHeader}>1. SELECT NOTIFICATION SCENARIO</Text>
                    <View style={s.scenarioGrid}>
                        <TouchableOpacity
                            onPress={() => applyComposePreset('staff_meeting')}
                            style={[s.scenarioTile, dispatchType === 'staff_meeting' && s.scenarioTileActive]}
                        >
                            <Ionicons name="people" size={18} color={dispatchType === 'staff_meeting' ? C.purple : C.textSub} />
                            <Text style={[s.scenarioTitle, dispatchType === 'staff_meeting' && { color: C.purple }]}>Staff Meeting</Text>
                            <Text style={s.scenarioSub}>Summon team to urgent briefing</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => applyComposePreset('liquidity_low')}
                            style={[s.scenarioTile, dispatchType === 'liquidity_low' && s.scenarioTileActive]}
                        >
                            <Ionicons name="wallet" size={18} color={dispatchType === 'liquidity_low' ? C.red : C.textSub} />
                            <Text style={[s.scenarioTitle, dispatchType === 'liquidity_low' && { color: C.red }]}>Liquidity Low</Text>
                            <Text style={s.scenarioSub}>Alert admins on low API float</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => applyComposePreset('support_track')}
                            style={[s.scenarioTile, dispatchType === 'support_track' && s.scenarioTileActive]}
                        >
                            <Ionicons name="headset" size={18} color={dispatchType === 'support_track' ? C.blue : C.textSub} />
                            <Text style={[s.scenarioTitle, dispatchType === 'support_track' && { color: C.blue }]}>User Tracking</Text>
                            <Text style={s.scenarioSub}>Ticket & customer follow-up</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => applyComposePreset('broadcast')}
                            style={[s.scenarioTile, dispatchType === 'broadcast' && s.scenarioTileActive]}
                        >
                            <Ionicons name="megaphone" size={18} color={dispatchType === 'broadcast' ? C.gold : C.textSub} />
                            <Text style={[s.scenarioTitle, dispatchType === 'broadcast' && { color: C.gold }]}>Broadcast</Text>
                            <Text style={s.scenarioSub}>General platform announcement</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 2. Target Audience */}
                    <Text style={s.sectionHeader}>2. TARGET AUDIENCE</Text>
                    <View style={s.audienceRow}>
                        {[
                            { key: 'admins', label: 'Admins Only' },
                            { key: 'staff', label: 'All Staff' },
                            { key: 'all', label: 'All Users (App)' },
                            { key: 'single', label: 'Single User' },
                        ].map(a => {
                            const isSelected = targetAudience === a.key;
                            return (
                                <TouchableOpacity
                                    key={a.key}
                                    onPress={() => setTargetAudience(a.key as any)}
                                    style={[s.audienceBtn, isSelected && s.audienceBtnActive]}
                                >
                                    <Text style={[s.audienceBtnText, isSelected && s.audienceBtnTextActive]}>
                                        {a.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {targetAudience === 'single' && (
                        <View style={s.formGroup}>
                            <Text style={s.formLabel}>User Email / Phone / ID</Text>
                            <TextInput
                                style={s.formInput}
                                placeholder="Enter user's email or phone number..."
                                placeholderTextColor="#94A3B8"
                                value={singleTargetQuery}
                                onChangeText={setSingleTargetQuery}
                            />
                        </View>
                    )}

                    {/* 3. Dynamic Fields based on preset */}
                    {dispatchType === 'staff_meeting' && (
                        <View style={s.specialConfigCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Ionicons name="calendar-outline" size={16} color={C.purple} />
                                <Text style={s.specialConfigTitle}>Meeting Details</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.formSubLabel}>Time & Date</Text>
                                    <TextInput
                                        style={s.formInput}
                                        value={meetingTime}
                                        onChangeText={t => {
                                            setMeetingTime(t);
                                            setPushBody(`All management staff are required to join the strategy briefing today at ${t}. Agenda: Operations, float reserves, and customer support tracking.`);
                                        }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.formSubLabel}>Meeting Link</Text>
                                    <TextInput
                                        style={s.formInput}
                                        value={meetingLink}
                                        onChangeText={setMeetingLink}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {dispatchType === 'liquidity_low' && (
                        <View style={s.specialConfigCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Ionicons name="warning-outline" size={16} color={C.red} />
                                <Text style={[s.specialConfigTitle, { color: C.red }]}>Liquidity Threshold Configuration</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.formSubLabel}>Provider Name</Text>
                                    <TextInput
                                        style={s.formInput}
                                        value={lowFloatProvider}
                                        onChangeText={p => {
                                            setLowFloatProvider(p);
                                            setPushBody(`URGENT: ${p} balance is critically low at ${lowFloatBalance} (below threshold). Please top up provider immediately to prevent failed transactions.`);
                                        }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.formSubLabel}>Current Float Balance</Text>
                                    <TextInput
                                        style={s.formInput}
                                        value={lowFloatBalance}
                                        onChangeText={b => {
                                            setLowFloatBalance(b);
                                            setPushBody(`URGENT: ${lowFloatProvider} balance is critically low at ${b} (below threshold). Please top up provider immediately to prevent failed transactions.`);
                                        }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* 4. Notification Message Content */}
                    <Text style={s.sectionHeader}>3. NOTIFICATION MESSAGE</Text>
                    <View style={s.messageCard}>
                        <View style={s.formGroup}>
                            <Text style={s.formLabel}>Notification Title</Text>
                            <TextInput
                                style={s.formInput}
                                placeholder="e.g. 🚨 Urgent Staff Briefing"
                                placeholderTextColor="#94A3B8"
                                value={pushTitle}
                                onChangeText={setPushTitle}
                            />
                        </View>

                        <View style={s.formGroup}>
                            <Text style={s.formLabel}>Notification Body</Text>
                            <TextInput
                                style={[s.formInput, { height: 90, textAlignVertical: 'top' }]}
                                placeholder="Enter detailed message text for push banner..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={pushBody}
                                onChangeText={setPushBody}
                            />
                        </View>

                        <View style={s.switchRow}>
                            <View>
                                <Text style={s.switchTitle}>Urgent / High Priority Sound</Text>
                                <Text style={s.switchSub}>Bypasses DND and sounds high-urgency siren chime</Text>
                            </View>
                            <Switch
                                value={isUrgent}
                                onValueChange={setIsUrgent}
                                trackColor={{ false: '#CBD5E1', true: C.red }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        <View style={[s.switchRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 10, paddingTop: 10 }]}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="lock-closed" size={14} color={C.gold} />
                                    <Text style={[s.switchTitle, { color: C.textMain }]}>Permanent Broadcast (Ba ya goguwa)</Text>
                                </View>
                                <Text style={s.switchSub}>Preserves this broadcast permanently in the archive so it can never be deleted</Text>
                            </View>
                            <Switch
                                value={isPermanent}
                                onValueChange={setIsPermanent}
                                trackColor={{ false: '#CBD5E1', true: C.gold }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {/* 4. Notification Ringtone / Chime Selection */}
                    <Text style={s.sectionHeader}>4. SELECT ALERT RINGTONE (SAUTIN FAƊAKARWA)</Text>
                    <View style={s.ringtoneSelectorBox}>
                        <Text style={s.ringtoneSelectorDesc}>
                            Zaɓi ainihin sautin ringtone ɗin da zai yi ƙara a wayar Admin da mai karɓa idan an tura wannan sanarwar:
                        </Text>
                        <View style={s.ringtoneListGrid}>
                            {RINGTONE_CATALOG.map((tone) => {
                                const isSelected = selectedRingtoneForPush === tone.id;
                                const isPlaying = playingRingtone === tone.id;
                                return (
                                    <TouchableOpacity
                                        key={tone.id}
                                        onPress={() => setSelectedRingtoneForPush(tone.id)}
                                        style={[s.ringtoneCardItem, isSelected && s.ringtoneCardItemActive]}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[s.ringtoneIconCircle, { backgroundColor: isSelected ? tone.color : '#F1F5F9' }]}>
                                            <Ionicons name={tone.icon as any} size={16} color={isSelected ? '#FFFFFF' : tone.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.ringtoneCardTitle, isSelected && { color: C.navy, fontWeight: '900' }]}>
                                                {tone.name}
                                            </Text>
                                            <Text style={s.ringtoneCardHausa}>{tone.hausa}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                playPreviewSound(tone.id);
                                            }}
                                            style={[s.previewSoundBtn, isPlaying && s.previewSoundBtnActive]}
                                        >
                                            <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={isPlaying ? '#FFFFFF' : tone.color} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Dispatch Action Button */}
                    <TouchableOpacity
                        onPress={handleDispatchNotification}
                        disabled={sending}
                        style={s.dispatchSubmitBtn}
                        activeOpacity={0.85}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                                <Text style={s.dispatchSubmitBtnText}>Dispatch Push Notification Now</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* Notification Detail Modal */}
            <Modal visible={Boolean(selectedItem)} animationType="slide" transparent>
                <View style={s.modalBackdrop}>
                    <View style={s.detailSheet}>
                        <View style={s.detailSheetHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.notifIconCircle, { width: 34, height: 34 }]}>
                                    <Ionicons name="notifications" size={18} color={C.gold} />
                                </View>
                                <Text style={s.detailSheetTitle}>Notification Dossier</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedItem(null)} style={s.detailCloseBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        {selectedItem && (
                            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <View style={[s.tagBadge, { backgroundColor: C.goldLight }]}>
                                        <Text style={[s.tagBadgeText, { color: C.gold }]}>
                                            {selectedItem.type?.toUpperCase() || 'ALERT'}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: '700' }}>
                                        {new Date(selectedItem.created_at).toLocaleString()}
                                    </Text>
                                </View>

                                <Text style={s.detailItemTitle}>{selectedItem.title}</Text>
                                <Text style={s.detailItemBody}>{selectedItem.body}</Text>

                                {selectedItem.data && (
                                    <View style={s.metadataBox}>
                                        <Text style={s.metadataBoxTitle}>EXTENDED TELEMETRY DATA</Text>
                                        <Text style={s.metadataBoxText}>
                                            {JSON.stringify(selectedItem.data, null, 2)}
                                        </Text>
                                    </View>
                                )}

                                {selectedItem.data?.route && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            const r = selectedItem.data.route;
                                            setSelectedItem(null);
                                            router.push(r);
                                        }}
                                        style={s.takeActionBtn}
                                    >
                                        <Ionicons name="arrow-forward-circle" size={16} color="#FFFFFF" />
                                        <Text style={s.takeActionBtnText}>Go to Linked Module ({selectedItem.data.route})</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Admin Ringtone Manager Modal */}
            <Modal visible={showRingtoneModal} animationType="slide" transparent>
                <View style={s.modalBackdrop}>
                    <View style={s.detailSheet}>
                        <View style={s.detailSheetHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.notifIconCircle, { width: 34, height: 34, backgroundColor: C.goldLight }]}>
                                    <Ionicons name="musical-notes" size={18} color={C.gold} />
                                </View>
                                <View>
                                    <Text style={s.detailSheetTitle}>Ringtone Manager</Text>
                                    <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600' }}>Saitin Sautin Faɗakarwa na Admin</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setShowRingtoneModal(false)} style={s.detailCloseBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                            <View style={s.ringtoneModalNotice}>
                                <Ionicons name="information-circle" size={16} color={C.blue} />
                                <Text style={s.ringtoneModalNoticeText}>
                                    Zaɓi sautin ringtone ɗin da Admin zai riƙa ji a wayarsa idan sabon notification ko broadcast ya shigo. Hakanan zaka iya danna maɓallin play domin sauraron kowane sauti.
                                </Text>
                            </View>

                            <View style={{ gap: 10, marginTop: 12, marginBottom: 20 }}>
                                {RINGTONE_CATALOG.map((tone) => {
                                    const isCurrent = adminRingtone === tone.id;
                                    const isPlaying = playingRingtone === tone.id;
                                    return (
                                        <View key={tone.id} style={[s.ringtoneManagerItem, isCurrent && s.ringtoneManagerItemActive]}>
                                            <View style={[s.ringtoneIconCircle, { backgroundColor: isCurrent ? tone.color : '#F1F5F9' }]}>
                                                <Ionicons name={tone.icon as any} size={18} color={isCurrent ? '#FFFFFF' : tone.color} />
                                            </View>

                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[s.ringtoneCardTitle, isCurrent && { color: C.navy, fontWeight: '900' }]}>
                                                        {tone.name}
                                                    </Text>
                                                    {isCurrent && (
                                                        <View style={s.activeRingtoneBadge}>
                                                            <Text style={s.activeRingtoneBadgeText}>ACTIVE</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={s.ringtoneCardHausa}>{tone.hausa}</Text>
                                                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tone.desc}</Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <TouchableOpacity
                                                    onPress={() => playPreviewSound(tone.id)}
                                                    style={[s.previewSoundBtn, isPlaying && s.previewSoundBtnActive]}
                                                >
                                                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={isPlaying ? '#FFFFFF' : tone.color} />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    onPress={() => handleSaveAdminRingtone(tone.id)}
                                                    style={[s.selectToneBtn, isCurrent && s.selectToneBtnActive]}
                                                >
                                                    <Text style={[s.selectToneBtnText, isCurrent && { color: '#FFFFFF' }]}>
                                                        {isCurrent ? 'Selected' : 'Use'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
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
        backgroundColor: '#F8FAFC',
    },
    topBar: {
        paddingTop: Platform.OS === 'ios' ? 48 : 36,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    brandWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        marginLeft: 10,
    },
    logoCircle: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    pageTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
    },
    pageSub: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '700',
    },
    markReadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    markReadText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2563EB',
    },
    tabSwitcherBar: {
        flexDirection: 'row',
        padding: 6,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 14,
        marginTop: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    tabSwitchBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
    },
    tabSwitchBtnActive: {
        backgroundColor: '#0F172A',
    },
    tabSwitchText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
    },
    tabSwitchTextActive: {
        color: '#FFFFFF',
    },
    tabBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
    },
    tabBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
    },
    filterContainer: {
        paddingHorizontal: 14,
        marginTop: 10,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 6,
        fontSize: 12,
        color: '#0F172A',
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    feedScrollContent: {
        padding: 14,
        paddingBottom: 50,
    },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    notifCardUnread: {
        backgroundColor: '#FFFDF7',
        borderColor: '#FDE68A',
        borderLeftWidth: 3.5,
        borderLeftColor: '#D97706',
    },
    notifIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notifTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    notifTime: {
        fontSize: 10.5,
        color: '#94A3B8',
        fontWeight: '700',
    },
    unreadDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D97706',
    },
    notifBody: {
        fontSize: 11.5,
        color: '#64748B',
        lineHeight: 16,
    },
    tagBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tagBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
    },
    userBadgeText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
    },
    emptyBox: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 12,
    },
    emptySub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    emptyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0F172A',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 16,
    },
    emptyActionBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    composeScrollContent: {
        padding: 14,
        paddingBottom: 60,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 6,
    },
    scenarioGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    scenarioTile: {
        width: (width - 36) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    scenarioTileActive: {
        borderColor: '#0F172A',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
    },
    scenarioTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 6,
    },
    scenarioSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 2,
    },
    audienceRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    audienceBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    audienceBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    audienceBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
    },
    audienceBtnTextActive: {
        color: '#FFFFFF',
    },
    specialConfigCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    specialConfigTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#7C3AED',
    },
    formGroup: {
        marginBottom: 10,
    },
    formLabel: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 4,
    },
    formSubLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 4,
    },
    formInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 12.5,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    messageCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    switchTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
    },
    switchSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 1,
    },
    dispatchSubmitBtn: {
        backgroundColor: '#0F172A',
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    dispatchSubmitBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    detailSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 24,
    },
    detailSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    detailSheetTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
    },
    detailCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailItemTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
    },
    detailItemBody: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 20,
        marginBottom: 14,
    },
    metadataBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    metadataBoxTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        marginBottom: 4,
    },
    metadataBoxText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 10.5,
        color: '#334155',
    },
    takeActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#2563EB',
        borderRadius: 10,
        paddingVertical: 12,
    },
    takeActionBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '800',
    },
    permanentNoticeBanner: {
        backgroundColor: '#FFFBEB',
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 4,
    },
    permanentNoticeTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#92400E',
    },
    permanentNoticeSub: {
        fontSize: 11.5,
        color: '#B45309',
        lineHeight: 16,
        fontWeight: '500',
    },
    broadcastArchiveCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    permanentTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    permanentTagText: {
        color: '#B45309',
        fontSize: 9.5,
        fontWeight: '800',
    },
    ringtoneHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    ringtoneHeaderBtnText: {
        color: '#B45309',
        fontSize: 12,
        fontWeight: '800',
    },
    ringtoneSelectorBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    ringtoneSelectorDesc: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
        marginBottom: 12,
        fontWeight: '500',
    },
    ringtoneListGrid: {
        gap: 8,
    },
    ringtoneCardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 10,
    },
    ringtoneCardItemActive: {
        backgroundColor: '#FFFBEB',
        borderColor: '#F59E0B',
    },
    ringtoneIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringtoneCardTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
    },
    ringtoneCardHausa: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    previewSoundBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewSoundBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    ringtoneModalNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    ringtoneModalNoticeText: {
        flex: 1,
        fontSize: 11.5,
        color: '#1E40AF',
        lineHeight: 17,
        fontWeight: '500',
    },
    ringtoneManagerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 10,
    },
    ringtoneManagerItemActive: {
        backgroundColor: '#FFFBEB',
        borderColor: '#F59E0B',
    },
    activeRingtoneBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    activeRingtoneBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    selectToneBtn: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    selectToneBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    selectToneBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
    },
});
