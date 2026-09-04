import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    ScrollView, 
    ActivityIndicator, 
    KeyboardAvoidingView, 
    Platform, 
    Alert, 
    Share, 
    StyleSheet 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { AIService } from '../../services/ai';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

// Executive Color Palette
const T = {
    bg: '#040817',
    bgCard: '#0b132b',
    bgCardSub: '#111d42',
    bgInput: '#0d1736',
    border: '#1c2c5b',
    borderLight: '#263870',
    gold: '#f5a623',
    goldDark: '#d4890e',
    goldBg: 'rgba(245, 166, 35, 0.12)',
    navyDark: '#0a1128',
    navyMid: '#14224d',
    textMain: '#ffffff',
    textSub: '#94a3b8',
    textMuted: '#64748b',
    emerald: '#10b981',
    emeraldBg: 'rgba(16, 185, 129, 0.12)',
    cyan: '#38bdf8',
    cyanBg: 'rgba(56, 189, 248, 0.12)',
    purple: '#a855f7',
    purpleBg: 'rgba(168, 85, 247, 0.12)',
    rose: '#f43f5e',
    roseBg: 'rgba(244, 63, 94, 0.12)',
};

type AIMode = 'general' | 'finance' | 'risk' | 'sql' | 'copywriter';

interface Message {
    id: string;
    role: 'user' | 'system';
    text: string;
    timestamp: string;
    mode?: AIMode;
}

const AI_MODES: { key: AIMode; label: string; icon: any; color: string; desc: string }[] = [
    { key: 'general', label: 'Cortex Hub', icon: 'sparkles', color: T.gold, desc: 'General Operations & Diagnostics' },
    { key: 'finance', label: 'Financial Auditor', icon: 'cash-outline', color: T.emerald, desc: 'Reconciliation, Gateways & Margins' },
    { key: 'risk', label: 'Risk & Fraud', icon: 'shield-checkmark-outline', color: T.rose, desc: 'KYC, Limits & Anomaly Sentinel' },
    { key: 'sql', label: 'SQL Copilot', icon: 'code-slash-outline', color: T.cyan, desc: 'Schema Analysis & PostgreSQL' },
    { key: 'copywriter', label: 'Broadcast Copy', icon: 'megaphone-outline', color: T.purple, desc: 'Hausa & English Broadcasts' },
];

const QUICK_PROMPTS: Record<AIMode, string[]> = {
    general: [
        "📊 Complete Platform Health Check",
        "👥 User Registration & Growth Overview",
        "🏦 Virtual Account Routing (9PSB & PalmPay)",
        "📋 Generate Evening Shift Handover",
        "⚡ Daily Priority Operational Checklist"
    ],
    finance: [
        "💰 24h Deposit & Gateway Reconciliation",
        "💳 Payvessel DVA vs Monnify Settlement",
        "📈 Telecom Vendor Wallet Balances Check",
        "📉 Profit Margins on MTN & Airtel SME Data",
        "⚠️ Detect Pending Vault Confirmations"
    ],
    risk: [
        "🛡️ Run Real-time Fraud & Risk Audit",
        "🔍 Scan High-Velocity Wallet Transfers",
        "⚠️ List Suspended or Negative Accounts",
        "📜 Pending Tier-2 KYC Verifications",
        "🚨 Verify Admin 2FA & Session Security"
    ],
    sql: [
        "🗄️ SQL: Top 15 Users by Wallet Balance",
        "🗄️ SQL: Users Without Virtual Accounts",
        "🗄️ SQL: 24-Hour Transaction Summary",
        "🗄️ SQL: Unverified KYC Users with Balance",
        "🗄️ SQL: Daily Revenue by Network Provider"
    ],
    copywriter: [
        "📢 Hausa & English: New Data Prices Drop",
        "📢 Hausa Sanarwa: System Update Complete",
        "📢 SMS: Fund Wallet via 9PSB / PalmPay",
        "📢 Email: Complete KYC Level 2 Verification",
        "📢 Push: Instant 24/7 Virtual Card Launch"
    ]
};

export default function AIInsights() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [selectedMode, setSelectedMode] = useState<AIMode>('general');
    const [loading, setLoading] = useState(false);
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init-1',
            role: 'system',
            text: `⚡ **CORTEX NEURAL CORE v5.2 ACTIVE**\n\nWelcome, Administrator. I am connected with live administrative context to your platform database, payment gateways (Payvessel, Monnify, Paystack), and ledger systems.\n\nSelect an **AI Specialization Mode** above or choose a quick diagnostic command below to begin.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: 'general'
        }
    ]);

    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

    const triggerHaptic = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleAskAI = async (customQuery?: string) => {
        const textToAsk = customQuery || query;
        if (!textToAsk.trim() || loading) return;

        triggerHaptic();

        const userMsg: Message = {
            id: `usr-${Date.now()}`,
            role: 'user',
            text: textToAsk.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: selectedMode
        };

        setMessages(prev => [...prev, userMsg]);
        if (!customQuery) setQuery('');
        setLoading(true);

        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            const responseText = await AIService.askCortex(userMsg.text, selectedMode);
            const aiMsg: Message = {
                id: `sys-${Date.now()}`,
                role: 'system',
                text: responseText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                mode: selectedMode
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            const errMsg: Message = {
                id: `err-${Date.now()}`,
                role: 'system',
                text: `⚠️ **Cortex Analysis Error**: ${error?.message || 'Could not communicate with Neural Core. Using local diagnostic protocol.'}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                mode: selectedMode
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setLoading(false);
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 150);
        }
    };

    const handleCopy = async (text: string) => {
        triggerHaptic();
        await Clipboard.setStringAsync(text);
        Alert.alert("Copied 📋", "Response copied to clipboard!");
    };

    const handleSpeak = (id: string, text: string) => {
        triggerHaptic();
        if (speakingId === id) {
            Speech.stop();
            setSpeakingId(null);
        } else {
            Speech.stop();
            // Clean markdown syntax for speech
            const cleanSpeech = text
                .replace(/[*#_`>]/g, '')
                .replace(/━+/g, '')
                .replace(/\[ \]/g, '');
            Speech.speak(cleanSpeech, {
                rate: 1.0,
                pitch: 1.0,
                onStart: () => setSpeakingId(id),
                onDone: () => setSpeakingId(null),
                onError: () => setSpeakingId(null),
            });
        }
    };

    const handleShareConversation = async () => {
        triggerHaptic();
        const fullReport = messages.map(m => `[${m.timestamp}] ${m.role === 'user' ? 'ADMIN' : 'CORTEX AI'}:\n${m.text}\n`).join('\n---\n\n');
        try {
            await Share.share({
                title: 'Cortex AI Executive Briefing',
                message: `Abu Mafhal Sub - Cortex AI Executive Briefing\nDate: ${new Date().toLocaleDateString()}\n\n${fullReport}`
            });
        } catch (e) {
            console.log('Share dismissed');
        }
    };

    const handleClearChat = () => {
        triggerHaptic();
        Alert.alert(
            "Reset Session 🗑️",
            "Are you sure you want to clear this Cortex AI session?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Session",
                    style: "destructive",
                    onPress: () => {
                        Speech.stop();
                        setSpeakingId(null);
                        setMessages([{
                            id: `init-${Date.now()}`,
                            role: 'system',
                            text: `⚡ **Cortex AI Core Reset.**\nSession cleared. Neural engine re-initialized and standing by for administrative commands.`,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            mode: selectedMode
                        }]);
                    }
                }
            ]
        );
    };

    // Render formatted markdown-like blocks
    const renderFormattedContent = (content: string) => {
        const codeBlockRegex = /```(sql|json|bash)?\n([\s\S]*?)```/g;
        const parts: any[] = [];
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', text: content.substring(lastIndex, match.index) });
            }
            parts.push({ type: 'code', lang: match[1] || 'code', code: match[2].trim() });
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            parts.push({ type: 'text', text: content.substring(lastIndex) });
        }

        return (
            <View style={{ gap: 8 }}>
                {parts.map((part, idx) => {
                    if (part.type === 'code') {
                        return (
                            <View key={idx} style={s.codeBox}>
                                <View style={s.codeHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="terminal-outline" size={14} color={T.cyan} />
                                        <Text style={s.codeLang}>{part.lang.toUpperCase()}</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => handleCopy(part.code)}
                                        style={s.codeCopyBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="copy-outline" size={12} color={T.gold} />
                                        <Text style={s.codeCopyText}>Copy</Text>
                                    </TouchableOpacity>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <Text style={s.codeText}>{part.code}</Text>
                                </ScrollView>
                            </View>
                        );
                    }

                    return (
                        <Text key={idx} style={s.systemText}>
                            {part.text}
                        </Text>
                    );
                })}
            </View>
        );
    };

    const currentModeConfig = AI_MODES.find(m => m.key === selectedMode) || AI_MODES[0];

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={s.container}
        >
            <Stack.Screen options={{ headerShown: false }} />

            {/* TOP EXECUTIVE HEADER */}
            <View style={s.header}>
                <View style={s.headerTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity 
                            onPress={() => router.back()} 
                            style={s.backBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={20} color={T.textMain} />
                        </TouchableOpacity>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.headerTitle}>Cortex AI Core</Text>
                                <View style={s.versionBadge}>
                                    <Text style={s.versionBadgeText}>v5.2 PRO</Text>
                                </View>
                            </View>
                            <Text style={s.headerSubTitle}>Executive Governance Intelligence</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity 
                            onPress={handleShareConversation} 
                            style={s.headerActionBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="share-social-outline" size={16} color={T.gold} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={handleClearChat} 
                            style={[s.headerActionBtn, { borderColor: 'rgba(244, 63, 94, 0.4)' }]}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={16} color={T.rose} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* REAL-TIME TELEMETRY KPI STRIP */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={s.telemetryStrip}
                >
                    <View style={s.telemetryChip}>
                        <View style={s.pulseDot} />
                        <Text style={s.telemetryLabel}>Status:</Text>
                        <Text style={[s.telemetryVal, { color: T.emerald }]}>Optimal 100%</Text>
                    </View>
                    <View style={s.telemetryChip}>
                        <Ionicons name="flash" size={11} color={T.gold} />
                        <Text style={s.telemetryLabel}>Latency:</Text>
                        <Text style={s.telemetryVal}>22ms</Text>
                    </View>
                    <View style={s.telemetryChip}>
                        <Ionicons name="card" size={11} color={T.cyan} />
                        <Text style={s.telemetryLabel}>Payvessel:</Text>
                        <Text style={[s.telemetryVal, { color: T.cyan }]}>9PSB / PalmPay Active</Text>
                    </View>
                    <View style={s.telemetryChip}>
                        <Ionicons name="shield-checkmark" size={11} color={T.purple} />
                        <Text style={s.telemetryLabel}>Auth:</Text>
                        <Text style={s.telemetryVal}>Admin 2FA</Text>
                    </View>
                </ScrollView>

                {/* SPECIALIZED AI MODE TABS */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={s.modeTabsRow}
                >
                    {AI_MODES.map((m) => {
                        const isSelected = selectedMode === m.key;
                        return (
                            <TouchableOpacity
                                key={m.key}
                                onPress={() => {
                                    triggerHaptic();
                                    setSelectedMode(m.key);
                                }}
                                style={[
                                    s.modeTab,
                                    isSelected ? { backgroundColor: m.color + '22', borderColor: m.color } : null
                                ]}
                                activeOpacity={0.8}
                            >
                                <Ionicons 
                                    name={m.icon} 
                                    size={14} 
                                    color={isSelected ? m.color : T.textMuted} 
                                />
                                <Text style={[
                                    s.modeTabText,
                                    isSelected ? { color: m.color, fontWeight: '800' } : null
                                ]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* CHAT STREAM */}
            <ScrollView
                ref={scrollRef}
                style={s.chatArea}
                contentContainerStyle={s.chatContent}
                showsVerticalScrollIndicator={false}
            >
                {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                        <View 
                            key={msg.id} 
                            style={[
                                s.msgWrapper,
                                isUser ? s.msgWrapperUser : s.msgWrapperSystem
                            ]}
                        >
                            {!isUser && (
                                <View style={s.cortexAvatar}>
                                    <Ionicons name="sparkles" size={14} color={T.gold} />
                                </View>
                            )}

                            <View style={[
                                s.msgBubble,
                                isUser ? s.msgBubbleUser : s.msgBubbleSystem
                            ]}>
                                {/* Header / Persona Badge */}
                                {!isUser && (
                                    <View style={s.msgHeader}>
                                        <View style={s.msgPersonaBadge}>
                                            <Text style={s.msgPersonaText}>
                                                {currentModeConfig.label.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={s.msgTime}>{msg.timestamp}</Text>
                                    </View>
                                )}

                                {isUser ? (
                                    <Text style={s.userText}>{msg.text}</Text>
                                ) : (
                                    renderFormattedContent(msg.text)
                                )}

                                {/* ACTION TOOLBAR FOR SYSTEM RESPONSES */}
                                {!isUser && (
                                    <View style={s.msgToolbar}>
                                        <TouchableOpacity 
                                            onPress={() => handleSpeak(msg.id, msg.text)}
                                            style={s.toolBtn}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons 
                                                name={speakingId === msg.id ? "volume-high" : "volume-medium-outline"} 
                                                size={14} 
                                                color={speakingId === msg.id ? T.gold : T.textMuted} 
                                            />
                                            <Text style={[s.toolBtnText, speakingId === msg.id ? { color: T.gold } : null]}>
                                                {speakingId === msg.id ? 'Listening...' : 'Listen'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            onPress={() => handleCopy(msg.text)}
                                            style={s.toolBtn}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="copy-outline" size={13} color={T.textMuted} />
                                            <Text style={s.toolBtnText}>Copy</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            onPress={handleShareConversation}
                                            style={s.toolBtn}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="share-outline" size={13} color={T.textMuted} />
                                            <Text style={s.toolBtnText}>Share</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {isUser && (
                                    <Text style={s.userTime}>{msg.timestamp}</Text>
                                )}
                            </View>
                        </View>
                    );
                })}

                {/* LOADING INDICATOR */}
                {loading && (
                    <View style={s.loadingCard}>
                        <ActivityIndicator color={T.gold} size="small" />
                        <View>
                            <Text style={s.loadingTitle}>Cortex Neural Engine Analyzing...</Text>
                            <Text style={s.loadingSubTitle}>Correlating database ledger & executing inference</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* QUICK ACTIONS & PRESETS DRAWER */}
            {!loading && (
                <View style={s.quickActionsArea}>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        contentContainerStyle={s.quickActionsContent}
                    >
                        {QUICK_PROMPTS[selectedMode].map((prompt, pIdx) => (
                            <TouchableOpacity
                                key={pIdx}
                                onPress={() => handleAskAI(prompt)}
                                style={s.quickChip}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="flash-outline" size={12} color={currentModeConfig.color} />
                                <Text style={s.quickChipText}>{prompt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* INPUT DOCK */}
            <View style={s.inputDock}>
                <View style={s.inputWrapper}>
                    <TextInput
                        style={s.textInput}
                        placeholder={`Ask ${currentModeConfig.label} anything...`}
                        placeholderTextColor={T.textMuted}
                        value={query}
                        onChangeText={setQuery}
                        multiline
                        maxLength={1000}
                        onSubmitEditing={() => handleAskAI()}
                    />

                    <TouchableOpacity
                        onPress={() => handleAskAI()}
                        disabled={loading || !query.trim()}
                        style={[
                            s.sendBtn,
                            loading || !query.trim() ? s.sendBtnDisabled : null
                        ]}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={loading || !query.trim() ? [T.border, T.bgCard] : [T.gold, T.goldDark]}
                            style={s.sendBtnGrad}
                        >
                            <Ionicons 
                                name={loading ? "hourglass-outline" : "arrow-up"} 
                                size={18} 
                                color={loading || !query.trim() ? T.textMuted : '#000000'} 
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    header: {
        backgroundColor: T.navyDark,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        paddingTop: Platform.OS === 'ios' ? 52 : 36,
        paddingBottom: 10,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: T.textMain,
        letterSpacing: 0.3,
    },
    headerSubTitle: {
        fontSize: 11,
        color: T.textSub,
        fontWeight: '500',
    },
    versionBadge: {
        backgroundColor: T.goldBg,
        borderColor: T.goldDark,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    versionBadgeText: {
        color: T.gold,
        fontSize: 9,
        fontWeight: '900',
    },
    headerActionBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    telemetryStrip: {
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 8,
    },
    telemetryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.border,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: T.emerald,
    },
    telemetryLabel: {
        fontSize: 10,
        color: T.textMuted,
        fontWeight: '600',
    },
    telemetryVal: {
        fontSize: 10,
        color: T.textMain,
        fontWeight: '800',
    },
    modeTabsRow: {
        paddingHorizontal: 16,
        gap: 8,
        paddingTop: 4,
    },
    modeTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.border,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
    },
    modeTabText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: T.textSub,
    },
    chatArea: {
        flex: 1,
    },
    chatContent: {
        padding: 16,
        gap: 16,
        paddingBottom: 24,
    },
    msgWrapper: {
        flexDirection: 'row',
        gap: 8,
        maxWidth: '100%',
    },
    msgWrapperUser: {
        justifyContent: 'flex-end',
    },
    msgWrapperSystem: {
        justifyContent: 'flex-start',
    },
    cortexAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.navyMid,
        borderWidth: 1,
        borderColor: T.goldDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    msgBubble: {
        borderRadius: 16,
        padding: 14,
        maxWidth: '88%',
    },
    msgBubbleUser: {
        backgroundColor: '#1d2d5a',
        borderWidth: 1,
        borderColor: '#2e4484',
        borderTopRightRadius: 4,
    },
    msgBubbleSystem: {
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.border,
        borderTopLeftRadius: 4,
    },
    msgHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        paddingBottom: 6,
    },
    msgPersonaBadge: {
        backgroundColor: T.goldBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    msgPersonaText: {
        fontSize: 9,
        fontWeight: '900',
        color: T.gold,
    },
    msgTime: {
        fontSize: 9,
        color: T.textMuted,
        fontWeight: '500',
    },
    userText: {
        fontSize: 13.5,
        color: T.textMain,
        fontWeight: '500',
        lineHeight: 20,
    },
    userTime: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.5)',
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    systemText: {
        fontSize: 13.5,
        color: '#e2e8f0',
        lineHeight: 21,
        fontWeight: '400',
    },
    codeBox: {
        backgroundColor: '#020510',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        overflow: 'hidden',
        marginVertical: 4,
    },
    codeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: T.bgCardSub,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    codeLang: {
        fontSize: 10,
        fontWeight: '800',
        color: T.cyan,
    },
    codeCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: T.goldBg,
    },
    codeCopyText: {
        fontSize: 9,
        fontWeight: '800',
        color: T.gold,
    },
    codeText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 12,
        color: '#38bdf8',
        padding: 10,
        lineHeight: 18,
    },
    msgToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: T.border,
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 2,
    },
    toolBtnText: {
        fontSize: 10.5,
        fontWeight: '600',
        color: T.textMuted,
    },
    loadingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.goldDark,
        padding: 12,
        borderRadius: 14,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    loadingTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textMain,
    },
    loadingSubTitle: {
        fontSize: 10,
        color: T.textSub,
    },
    quickActionsArea: {
        borderTopWidth: 1,
        borderTopColor: T.border,
        backgroundColor: T.navyDark,
        paddingVertical: 8,
    },
    quickActionsContent: {
        paddingHorizontal: 14,
        gap: 8,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: T.bgCard,
        borderWidth: 1,
        borderColor: T.border,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    quickChipText: {
        fontSize: 11,
        color: T.textMain,
        fontWeight: '600',
    },
    inputDock: {
        backgroundColor: T.navyDark,
        borderTopWidth: 1,
        borderTopColor: T.border,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 34 : 14,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.bgInput,
        borderWidth: 1,
        borderColor: T.borderLight,
        borderRadius: 24,
        paddingHorizontal: 12,
        paddingVertical: 4,
        gap: 8,
    },
    textInput: {
        flex: 1,
        color: T.textMain,
        fontSize: 13.5,
        fontWeight: '500',
        maxHeight: 90,
        paddingVertical: 6,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
    sendBtnGrad: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
