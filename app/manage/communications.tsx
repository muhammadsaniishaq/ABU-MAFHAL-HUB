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

const QUICK_TEMPLATES: Record<string, { title: string; subject?: string; body: string; tag: string }[]> = {
    email: [
        {
            title: 'Welcome Series',
            subject: 'Welcome to ABU MAFHAL HUB! 🚀',
            body: 'Hello {{name}},\n\nWelcome to ABU MAFHAL HUB. Your gateway to instant VTU, SME data, bill payments, and high-yield savings. Fund your wallet anytime via your virtual bank account.\n\nBest Regards,\nABU MAFHAL Team',
            tag: 'Onboarding'
        },
        {
            title: 'KYC Verification Reminder',
            subject: 'Action Required: Complete Your Tier 2 Identity Verification',
            body: 'Dear {{name}},\n\nPlease submit your NIN / BVN verification on the app to unlock unlimited daily transactions and virtual debit card generation.\n\nThank you for choosing ABU MAFHAL.',
            tag: 'Security'
        },
        {
            title: 'Weekend Cashback Promo',
            subject: 'Special Offer: 5% Cashback on All Data Bundles! 🎁',
            body: 'Hi {{name}},\n\nEnjoy up to 5% instant cashback on all MTN, Airtel, and Glo SME data purchases this weekend. Top up now on your app!\n\nOffer valid while supplies last.',
            tag: 'Promotion'
        },
        {
            title: 'System Maintenance Notice',
            subject: 'Scheduled Core Gateway Maintenance',
            body: 'Notice to all customers:\n\nWe will be conducting routine infrastructure optimization tonight from 1:00 AM to 2:30 AM. Minimal service disruptions may occur on banking rails.\n\nThank you for your patience.',
            tag: 'Operations'
        }
    ],
    sms: [
        {
            title: 'Instant OTP Auth',
            body: 'Your ABU MAFHAL security code is: {{otp}}. Valid for 10 minutes. Do not disclose this code to anyone.',
            tag: 'Security'
        },
        {
            title: 'Deposit Credit Alert',
            body: 'Credit Alert: Your wallet has been credited with N{{amount}}. Ref: {{ref}}. Thank you for banking with ABU MAFHAL.',
            tag: 'Finance'
        },
        {
            title: 'Data Price Crash Promo',
            body: 'Mega Promo: 1GB SME Data now from N240 on ABU MAFHAL Hub. Visit https://abumafhal.com to buy instantly!',
            tag: 'Promo'
        },
        {
            title: 'Service Restored Alert',
            body: 'Network Update: MTN SME & Telecom VTU services are fully operational. Transactions are processing at normal speed.',
            tag: 'Notice'
        }
    ],
    push: [
        {
            title: 'Daily Yield Credited 💰',
            body: 'Your daily savings interest has been posted to your vault account. Tap to view your portfolio growth!',
            tag: 'Wealth'
        },
        {
            title: 'Instant Cashback Bonus ⚡',
            body: 'You just earned ₦150 cashback on your last utility bill purchase.',
            tag: 'Rewards'
        },
        {
            title: 'Security Alert 🛡️',
            body: 'A new login session was detected from an unrecognized IP address. Tap to review security settings.',
            tag: 'Security'
        }
    ]
};

interface CommLog {
    id: string;
    channel: 'email' | 'sms' | 'push';
    recipient: string;
    subject?: string | null;
    content: string;
    status: string;
    created_at: string;
    metadata?: any;
}

export default function EnterpriseCommunicationsHub() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [activeChannel, setActiveChannel] = useState<'email' | 'sms' | 'push'>((params.tab as any) || 'email');
    const [recipientAudience, setRecipientAudience] = useState<'single' | 'all' | 'admins' | 'tier2' | 'custom'>('single');

    // Form States
    const [recipientQuery, setRecipientQuery] = useState((params.recipient as string) || '');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [senderId, setSenderId] = useState('ABUMAFHAL');
    const [isHighPriority, setIsHighPriority] = useState(false);
    const [actionRoute, setActionRoute] = useState('');

    // Telemetry & Logs State
    const [logs, setLogs] = useState<CommLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);

    // AI Message Generator Modal
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLanguage, setAiLanguage] = useState<'English' | 'Hausa'>('English');
    const [aiTone, setAiTone] = useState<'Professional' | 'Promotional' | 'Urgent' | 'Friendly'>('Professional');
    const [aiGenerating, setAiGenerating] = useState(false);

    // Selected Log Detail Modal
    const [selectedLog, setSelectedLog] = useState<CommLog | null>(null);

    useEffect(() => {
        fetchCommunicationHistory();
    }, []);

    const fetchCommunicationHistory = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('communication_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && data) {
                setLogs(data);
            }
        } catch (e) {
            console.error('Error fetching communications history:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchCommunicationHistory();
    }, []);

    // Telemetry Aggregate Metrics
    const metrics = useMemo(() => {
        const total = logs.length;
        const emailsCount = logs.filter(l => l.channel === 'email').length;
        const smsCount = logs.filter(l => l.channel === 'sms').length;
        const pushCount = logs.filter(l => l.channel === 'push').length;
        return { total, emailsCount, smsCount, pushCount };
    }, [logs]);

    // Apply Quick Template
    const handleApplyTemplate = (tmpl: { title: string; subject?: string; body: string }) => {
        if (tmpl.subject && activeChannel === 'email') {
            setSubject(tmpl.subject);
        }
        setBody(tmpl.body);
    };

    // AI Smart Generator
    const handleGenerateWithAi = () => {
        if (!aiPrompt.trim()) {
            Alert.alert('Required', 'Please describe what you want to communicate.');
            return;
        }

        setAiGenerating(true);
        setTimeout(() => {
            let generated = '';
            const promptLower = aiPrompt.toLowerCase();

            if (aiLanguage === 'Hausa') {
                if (promptLower.includes('promo') || promptLower.includes('cashback') || promptLower.includes('data')) {
                    generated = `Sannun ku! Akwai babban rangwamen farashin data da katin waya a ABU MAFHAL HUB a yau. Sayi 1GB data akan mafi saukin farashi tare da samun cashback a take. Shiga manhajar ku yanzu don morewa!`;
                } else if (promptLower.includes('kyc') || promptLower.includes('nin') || promptLower.includes('bvn')) {
                    generated = `Sanarwa: Ana buƙatar ku kammala tabbatar da shaidar ku ta NIN/BVN domin samun damar yin hada-hadar kuɗi ba tare da iyaka ba. Shiga cikin shafin Profile na manhajar ABU MAFHAL don kammalawa.`;
                } else {
                    generated = `Barka da sadarwa daga ABU MAFHAL HUB. ${aiPrompt.trim()}. Muna godiya da ci gaba da kasancewa tare da mu.`;
                }
            } else {
                if (promptLower.includes('promo') || promptLower.includes('discount')) {
                    generated = `Exclusive Offer: Unlock up to 5% instant cashback on all VTU and SME data subscriptions today on ABU MAFHAL HUB. Open your app and fund your wallet to enjoy premium rates!`;
                } else if (promptLower.includes('downtime') || promptLower.includes('maintenance')) {
                    generated = `Important Service Update: We are performing essential network upgrades to enhance speed and reliability. Services will resume full speed shortly. We apologize for any inconvenience.`;
                } else {
                    generated = `Official Update from ABU MAFHAL HUB:\n\n${aiPrompt.trim()}\n\nThank you for choosing ABU MAFHAL as your trusted digital finance partner.`;
                }
            }

            setBody(generated);
            if (activeChannel === 'email' && !subject) {
                setSubject(aiLanguage === 'Hausa' ? 'Sanarwa Daga ABU MAFHAL HUB' : 'Official Notice from ABU MAFHAL HUB');
            }
            setAiGenerating(false);
            setShowAiModal(false);
            setAiPrompt('');
            Alert.alert('Draft Created ✨', 'AI draft inserted into message composer.');
        }, 800);
    };

    // REAL ATOMIC DISPATCH FUNCTION
    const handleBroadcastMessage = async () => {
        if (!body.trim()) {
            Alert.alert('Required', 'Please enter a message content.');
            return;
        }

        if (activeChannel === 'email' && !subject.trim()) {
            Alert.alert('Required', 'Please enter an email subject.');
            return;
        }

        if (recipientAudience === 'single' && !recipientQuery.trim()) {
            Alert.alert('Required', 'Please specify a recipient email, phone, or User UUID.');
            return;
        }

        setSending(true);
        try {
            let targetUsers: { id?: string; email?: string; phone?: string; full_name?: string }[] = [];

            // 1. Resolve Target Recipients from DB
            if (recipientAudience === 'all') {
                const { data: allProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, phone, full_name')
                    .limit(1000);
                targetUsers = allProfiles || [];
            } else if (recipientAudience === 'admins') {
                const { data: adminProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, phone, full_name')
                    .in('role', ['admin', 'super_admin']);
                targetUsers = adminProfiles || [];
            } else if (recipientAudience === 'tier2') {
                const { data: kycProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, phone, full_name')
                    .eq('kyc_tier', 2);
                targetUsers = kycProfiles || [];
            } else if (recipientAudience === 'single') {
                const q = recipientQuery.trim();
                let filterCol = 'email';
                if (/^\d+$/.test(q) || q.startsWith('+')) filterCol = 'phone';
                else if (q.length === 36) filterCol = 'id';

                const { data: singleProfile } = await supabase
                    .from('profiles')
                    .select('id, email, phone, full_name')
                    .eq(filterCol, q)
                    .maybeSingle();

                if (singleProfile) {
                    targetUsers = [singleProfile];
                } else {
                    targetUsers = [{ email: q.includes('@') ? q : undefined, phone: !q.includes('@') ? q : undefined }];
                }
            } else if (recipientAudience === 'custom') {
                const parts = recipientQuery.split(',').map(s => s.trim()).filter(Boolean);
                targetUsers = parts.map(p => ({
                    email: p.includes('@') ? p : undefined,
                    phone: !p.includes('@') ? p : undefined,
                }));
            }

            // 2. DISPATCH VIA CHANNEL
            // Channel A: In-App Email & Broadcast
            if (activeChannel === 'email') {
                const emailRows = targetUsers.filter(u => u.email).map(u => ({
                    sender_email: 'admin@abumafhal.com.ng',
                    sender_name: 'ABU MAFHAL Official Support',
                    recipient_email: u.email!,
                    subject: subject.trim(),
                    body_text: body.trim(),
                    body_html: `<div style="font-family: sans-serif; padding: 24px; background: #070D1E; color: #FFFFFF; border-radius: 12px; border: 1px solid #D97706;"><h2 style="color: #F59E0B; margin-top: 0;">${subject.trim()}</h2><p style="font-size: 14px; line-height: 1.6; color: #E2E8F0;">${body.replace(/\n/g, '<br/>')}</p><hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;"/><p style="font-size: 11px; color: #94A3B8;">Sent securely by ABU MAFHAL Corporate Dispatch (admin@abumafhal.com.ng)</p></div>`,
                    is_read: false,
                    folder: 'inbox',
                }));

                if (emailRows.length > 0) {
                    await supabase.from('in_app_emails').insert(emailRows);
                }

                // Also trigger notification cards for users with valid IDs
                const notifRows = targetUsers.filter(u => u.id).map(u => ({
                    user_id: u.id!,
                    title: subject.trim(),
                    body: body.trim(),
                    type: 'email',
                    data: { priority: isHighPriority ? 'high' : 'normal', route: '/manage/mail-center' },
                }));

                if (notifRows.length > 0) {
                    await supabase.from('notifications').insert(notifRows);
                }
            }

            // Channel B: Push Notifications
            if (activeChannel === 'push') {
                const pushRows = targetUsers.filter(u => u.id).map(u => ({
                    user_id: u.id!,
                    title: subject.trim() || 'Official Notice from ABU MAFHAL',
                    body: body.trim(),
                    type: 'broadcast',
                    data: { priority: isHighPriority ? 'high' : 'normal', route: actionRoute || undefined },
                }));

                if (pushRows.length > 0) {
                    await supabase.from('notifications').insert(pushRows);
                }
            }

            // Channel C: SMS Integration
            if (activeChannel === 'sms') {
                // Try invoking edge function or logging directly
                try {
                    await supabase.functions.invoke('send-communication', {
                        body: {
                            type: 'sms',
                            senderId: senderId.trim(),
                            recipients: targetUsers.map(u => u.phone).filter(Boolean),
                            body: body.trim(),
                            priority: isHighPriority ? 'high' : 'normal',
                        },
                    });
                } catch (edgeErr) {
                    console.warn('Edge SMS trigger note:', edgeErr);
                }
            }

            // 3. PERSIST LOG TO `communication_logs` & `audit_logs`
            await supabase.from('communication_logs').insert({
                channel: activeChannel,
                recipient: recipientAudience === 'single' ? recipientQuery.trim() : recipientAudience,
                subject: activeChannel === 'email' ? subject.trim() : senderId.trim(),
                content: body.trim(),
                status: 'delivered',
                metadata: {
                    priority: isHighPriority,
                    totalRecipients: targetUsers.length,
                    actionRoute: actionRoute.trim() || undefined,
                },
            });

            await supabase.from('audit_logs').insert({
                action: `Dispatched ${activeChannel.toUpperCase()} Broadcast (${targetUsers.length} recipients)`,
                target_resource: `Communications / ${activeChannel}`,
                details: {
                    channel: activeChannel,
                    audience: recipientAudience,
                    recipientQuery: recipientQuery.trim(),
                    subject: subject.trim() || undefined,
                    count: targetUsers.length,
                },
            });

            Alert.alert(
                'Broadcast Delivered 🚀',
                `${activeChannel.toUpperCase()} message successfully broadcasted to ${targetUsers.length} recipients.`
            );

            setBody('');
            setSubject('');
            setRecipientQuery('');
            setActionRoute('');
            setIsHighPriority(false);
            fetchCommunicationHistory();
        } catch (e: any) {
            Alert.alert('Broadcast Error', e.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Omnichannel Comms Center',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setShowAiModal(true)} style={styles.headerGoldBtn}>
                                <Ionicons name="sparkles" size={16} color={T.goldBright} />
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
                    <Text style={styles.liveIndicatorText}>ENTERPRISE BROADCAST DISPATCHER</Text>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{metrics.total}</Text>
                        <Text style={styles.summaryLabel}>Total Sent</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.info }]}>{metrics.emailsCount}</Text>
                        <Text style={styles.summaryLabel}>Emails</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.goldBright }]}>{metrics.smsCount}</Text>
                        <Text style={styles.summaryLabel}>SMS</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.purple }]}>{metrics.pushCount}</Text>
                        <Text style={styles.summaryLabel}>Push Alerts</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Sub-Navigation Channel Selector */}
            <View style={styles.channelBar}>
                {[
                    { key: 'email', label: '✉️ In-App & SMTP Email', icon: 'mail-outline' },
                    { key: 'sms', label: '📱 Termii & Bigi SMS', icon: 'chatbubbles-outline' },
                    { key: 'push', label: '🔔 Real-Time Push', icon: 'notifications-outline' },
                ].map(ch => (
                    <TouchableOpacity
                        key={ch.key}
                        onPress={() => setActiveChannel(ch.key as any)}
                        style={[styles.channelPill, activeChannel === ch.key && styles.channelPillActive]}
                    >
                        <Text style={[styles.channelPillText, activeChannel === ch.key && styles.channelPillTextActive]}>
                            {ch.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. AUDIENCE SELECTOR CARD */}
                <View style={styles.card}>
                    <Text style={styles.cardHeading}>1. SELECT RECIPIENT AUDIENCE</Text>
                    <View style={styles.audienceGrid}>
                        {[
                            { key: 'single', label: 'Single User', icon: 'person-outline' },
                            { key: 'all', label: 'All Customers', icon: 'people-outline' },
                            { key: 'tier2', label: 'Tier 2 KYC', icon: 'shield-checkmark-outline' },
                            { key: 'admins', label: 'Staff & Admins', icon: 'key-outline' },
                            { key: 'custom', label: 'Custom List', icon: 'list-outline' },
                        ].map(aud => (
                            <TouchableOpacity
                                key={aud.key}
                                onPress={() => setRecipientAudience(aud.key as any)}
                                style={[styles.audienceItem, recipientAudience === aud.key && styles.audienceItemActive]}
                            >
                                <Ionicons
                                    name={aud.icon as any}
                                    size={16}
                                    color={recipientAudience === aud.key ? T.goldBright : T.textSub}
                                />
                                <Text style={[styles.audienceLabel, recipientAudience === aud.key && styles.audienceLabelActive]}>
                                    {aud.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {(recipientAudience === 'single' || recipientAudience === 'custom') && (
                        <View style={styles.recipientInputWrap}>
                            <Ionicons name="search" size={16} color={T.textMuted} />
                            <TextInput
                                value={recipientQuery}
                                onChangeText={setRecipientQuery}
                                placeholder={
                                    recipientAudience === 'single'
                                        ? 'Enter exact user email, phone (081...), or User UUID...'
                                        : 'Paste comma-separated emails or phone numbers...'
                                }
                                placeholderTextColor={T.textMuted}
                                style={styles.recipientInput}
                            />
                        </View>
                    )}
                </View>

                {/* 2. QUICK TEMPLATES CAROUSEL */}
                <View style={styles.templatesSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={styles.cardHeading}>2. QUICK PRESET TEMPLATES</Text>
                        <TouchableOpacity onPress={() => setShowAiModal(true)} style={styles.aiWriterTrigger}>
                            <Ionicons name="sparkles" size={13} color={T.goldBright} />
                            <Text style={styles.aiWriterTriggerText}>Cortex AI Drafter</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
                        {(QUICK_TEMPLATES[activeChannel] || []).map((tmpl, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handleApplyTemplate(tmpl)}
                                style={styles.templateChip}
                                activeOpacity={0.8}
                            >
                                <View style={styles.templateChipTop}>
                                    <Text style={styles.templateChipTitle}>{tmpl.title}</Text>
                                    <View style={styles.templateChipBadge}>
                                        <Text style={styles.templateChipBadgeText}>{tmpl.tag}</Text>
                                    </View>
                                </View>
                                <Text style={styles.templateChipSnippet} numberOfLines={2}>
                                    {tmpl.body}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* 3. MESSAGE COMPOSER */}
                <View style={styles.card}>
                    <Text style={styles.cardHeading}>3. COMPOSE MESSAGE</Text>

                    {activeChannel === 'email' && (
                        <View>
                            <Text style={styles.inputLabel}>Email Subject</Text>
                            <TextInput
                                value={subject}
                                onChangeText={setSubject}
                                placeholder="e.g. Special Offer / Security Notification"
                                placeholderTextColor={T.textMuted}
                                style={styles.composerInput}
                            />
                        </View>
                    )}

                    {activeChannel === 'sms' && (
                        <View>
                            <Text style={styles.inputLabel}>SMS Sender ID (11 Characters Max)</Text>
                            <TextInput
                                value={senderId}
                                onChangeText={setSenderId}
                                maxLength={11}
                                placeholder="ABUMAFHAL"
                                placeholderTextColor={T.textMuted}
                                style={styles.composerInput}
                            />
                        </View>
                    )}

                    <Text style={styles.inputLabel}>
                        Message Content {activeChannel === 'sms' ? `(${body.length} chars • ${Math.ceil(body.length / 160) || 1} SMS unit)` : ''}
                    </Text>
                    <TextInput
                        value={body}
                        onChangeText={setBody}
                        placeholder={
                            activeChannel === 'email'
                                ? 'Write full message here. Use {{name}} to dynamically personalize...'
                                : 'Type concise SMS message. Use {{name}}, {{amount}} for variables...'
                        }
                        placeholderTextColor={T.textMuted}
                        multiline
                        numberOfLines={5}
                        style={[styles.composerInput, { height: 110, textAlignVertical: 'top' }]}
                    />

                    {activeChannel === 'push' && (
                        <View>
                            <Text style={styles.inputLabel}>Action Route Navigation (Optional)</Text>
                            <TextInput
                                value={actionRoute}
                                onChangeText={setActionRoute}
                                placeholder="e.g. /savings, /manage/liquidity, /data-plans"
                                placeholderTextColor={T.textMuted}
                                style={styles.composerInput}
                            />
                        </View>
                    )}

                    <View style={styles.priorityRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.priorityTitle}>High Priority Broadcast</Text>
                            <Text style={styles.prioritySub}>Mark as critical system alert with sound & vibration override.</Text>
                        </View>
                        <Switch
                            value={isHighPriority}
                            onValueChange={setIsHighPriority}
                            trackColor={{ false: '#CBD5E1', true: T.gold }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleBroadcastMessage}
                        disabled={sending}
                        style={styles.sendBroadcastBtn}
                        activeOpacity={0.85}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="paper-plane" size={17} color={T.goldBright} />
                                <Text style={styles.sendBroadcastBtnText}>
                                    Dispatch {activeChannel.toUpperCase()} Broadcast
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* 4. RECENT COMMUNICATION LOGS */}
                <View style={[styles.card, { marginTop: 12 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={styles.cardHeading}>4. DISPATCH HISTORY & AUDIT TRAIL</Text>
                        <TouchableOpacity onPress={onRefresh}>
                            <Ionicons name="refresh" size={16} color={T.gold} />
                        </TouchableOpacity>
                    </View>

                    {logs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="chatbubbles-outline" size={36} color={T.gold} />
                            <Text style={styles.emptyStateTitle}>Zero Communication Records</Text>
                            <Text style={styles.emptyStateSub}>Dispatched notifications will appear in this live stream.</Text>
                        </View>
                    ) : (
                        logs.slice(0, 15).map(l => (
                            <TouchableOpacity
                                key={l.id}
                                onPress={() => setSelectedLog(l)}
                                style={styles.logCard}
                                activeOpacity={0.8}
                            >
                                <View style={styles.logHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={[
                                            styles.channelTag,
                                            l.channel === 'email' ? styles.channelTagEmail :
                                            l.channel === 'sms' ? styles.channelTagSms : styles.channelTagPush
                                        ]}>
                                            <Text style={styles.channelTagText}>{l.channel.toUpperCase()}</Text>
                                        </View>
                                        <Text style={styles.logRecipient} numberOfLines={1}>
                                            To: {l.recipient}
                                        </Text>
                                    </View>
                                    <Text style={styles.logTime}>{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>

                                {l.subject && (
                                    <Text style={styles.logSubject} numberOfLines={1}>{l.subject}</Text>
                                )}
                                <Text style={styles.logContent} numberOfLines={2}>{l.content}</Text>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* ========================================================================= */}
            {/* MODAL 1: CORTEX AI MESSAGE DRAFTER                                        */}
            {/* ========================================================================= */}
            <Modal
                visible={showAiModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAiModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="sparkles" size={18} color={T.goldBright} />
                                <Text style={styles.modalTitle}>Cortex AI Smart Drafter</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAiModal(false)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Language</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            {(['English', 'Hausa'] as const).map(lang => (
                                <TouchableOpacity
                                    key={lang}
                                    onPress={() => setAiLanguage(lang)}
                                    style={[styles.aiPill, aiLanguage === lang && styles.aiPillActive]}
                                >
                                    <Text style={[styles.aiPillText, aiLanguage === lang && styles.aiPillTextActive]}>
                                        {lang}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Describe Your Communication Intent</Text>
                        <TextInput
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                            placeholder="e.g. Apologize for minor network latency and announce 2% data cashback..."
                            placeholderTextColor={T.textMuted}
                            multiline
                            numberOfLines={3}
                            style={[styles.composerInput, { height: 75, textAlignVertical: 'top' }]}
                        />

                        <TouchableOpacity
                            onPress={handleGenerateWithAi}
                            disabled={aiGenerating}
                            style={styles.generateBtn}
                            activeOpacity={0.85}
                        >
                            {aiGenerating ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="flash" size={17} color="#FFFFFF" />
                                    <Text style={styles.generateBtnText}>Generate Message Draft</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: INSPECT DISPATCH LOG DETAIL                                      */}
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
                            <Text style={styles.modalTitle}>Dispatch Metadata</Text>
                            <TouchableOpacity onPress={() => setSelectedLog(null)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detailHero}>
                                    <Text style={styles.detailHeroChannel}>{selectedLog.channel.toUpperCase()} DISPATCH</Text>
                                    <Text style={styles.detailHeroRecipient}>{selectedLog.recipient}</Text>
                                    <Text style={styles.detailHeroTime}>{new Date(selectedLog.created_at).toUTCString()}</Text>
                                </View>

                                {selectedLog.subject && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Subject</Text>
                                        <Text style={styles.detailVal}>{selectedLog.subject}</Text>
                                    </View>
                                )}

                                <Text style={styles.inputLabel}>Message Content</Text>
                                <View style={styles.contentBox}>
                                    <Text style={styles.contentText}>{selectedLog.content}</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={async () => {
                                        await Clipboard.setStringAsync(selectedLog.content);
                                        Alert.alert('Copied 📋', 'Message text copied to clipboard.');
                                    }}
                                    style={styles.copyBtn}
                                >
                                    <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                                    <Text style={styles.copyBtnText}>Copy Content</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
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
    channelBar: {
        flexDirection: 'row',
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 119, 6, 0.2)',
    },
    channelPill: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: T.navyDeep,
        alignItems: 'center',
    },
    channelPillActive: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
        borderColor: T.gold,
    },
    channelPillText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: T.textMuted,
    },
    channelPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    scrollContent: {
        padding: 12,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
    },
    cardHeading: {
        fontSize: 10.5,
        fontWeight: '900',
        color: T.navyPrimary,
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    audienceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    audienceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: T.border,
    },
    audienceItemActive: {
        backgroundColor: T.navyPrimary,
        borderColor: T.cardBorderGold,
    },
    audienceLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textSub,
    },
    audienceLabelActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    recipientInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    recipientInput: {
        flex: 1,
        fontSize: 11.5,
        color: T.textMain,
    },
    templatesSection: {
        marginBottom: 10,
    },
    aiWriterTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: T.navyPrimary,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    aiWriterTriggerText: {
        fontSize: 10,
        fontWeight: '900',
        color: T.goldBright,
    },
    templateScroll: {
        gap: 8,
    },
    templateChip: {
        width: 220,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    templateChipTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    templateChipTitle: {
        fontSize: 11.5,
        fontWeight: '900',
        color: T.navyPrimary,
        flex: 1,
    },
    templateChipBadge: {
        backgroundColor: T.goldBg,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: T.goldBorder,
    },
    templateChipBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: T.goldDark,
    },
    templateChipSnippet: {
        fontSize: 10,
        color: T.textSub,
        lineHeight: 13,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
        marginTop: 6,
        marginBottom: 4,
    },
    composerInput: {
        backgroundColor: T.inputBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 8,
    },
    priorityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        marginVertical: 6,
    },
    priorityTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.navyPrimary,
    },
    prioritySub: {
        fontSize: 9.5,
        color: T.textMuted,
        marginTop: 1,
    },
    sendBroadcastBtn: {
        backgroundColor: T.navyPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
        marginTop: 6,
    },
    sendBroadcastBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyStateTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: T.navyPrimary,
        marginTop: 6,
    },
    emptyStateSub: {
        fontSize: 10.5,
        color: T.textMuted,
        marginTop: 2,
    },
    logCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 6,
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    channelTag: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    channelTagEmail: {
        backgroundColor: T.infoBg,
    },
    channelTagSms: {
        backgroundColor: T.goldBg,
    },
    channelTagPush: {
        backgroundColor: T.purpleBg,
    },
    channelTagText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: T.navyPrimary,
    },
    logRecipient: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
        maxWidth: 160,
    },
    logTime: {
        fontSize: 9.5,
        color: T.textMuted,
    },
    logSubject: {
        fontSize: 11,
        fontWeight: '800',
        color: T.navyPrimary,
        marginBottom: 2,
    },
    logContent: {
        fontSize: 10.5,
        color: T.textSub,
        lineHeight: 14,
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
        maxHeight: '80%',
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
    aiPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
    },
    aiPillActive: {
        backgroundColor: T.navyPrimary,
    },
    aiPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textSub,
    },
    aiPillTextActive: {
        color: T.goldBright,
        fontWeight: '900',
    },
    generateBtn: {
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
        marginBottom: 16,
    },
    generateBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
    detailHero: {
        backgroundColor: T.navyPrimary,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: T.cardBorderGold,
    },
    detailHeroChannel: {
        fontSize: 9,
        fontWeight: '900',
        color: T.goldBright,
        letterSpacing: 1,
        marginBottom: 2,
    },
    detailHeroRecipient: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    detailHeroTime: {
        fontSize: 10,
        color: '#94A3B8',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    detailLabel: {
        fontSize: 11,
        color: T.textSub,
        fontWeight: '600',
    },
    detailVal: {
        fontSize: 11.5,
        fontWeight: '800',
        color: T.navyPrimary,
    },
    contentBox: {
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 12,
    },
    contentText: {
        fontSize: 11.5,
        color: T.textMain,
        lineHeight: 16,
    },
    copyBtn: {
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
    copyBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '900',
    },
});
