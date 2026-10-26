import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Animated,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

// Official Royal Brand Color System
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    navy: '#0F172A',
    navyDark: '#070F26',
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
};

// Preset System Audio Chimes
const PRESET_AUDIO_CLIPS = [
    {
        id: 'clip_welcome',
        title: 'Executive Welcome Chime',
        category: 'Welcome',
        icon: 'sparkles',
        color: C.gold,
        description: 'Played when administrator logs in or opens the executive hub.',
        uri: 'https://cdn.freesound.org/previews/264/264981_4486188-lq.mp3',
    },
    {
        id: 'clip_success',
        title: 'Transaction Wealth Sound',
        category: 'Success',
        icon: 'cash',
        color: C.green,
        description: 'Played on confirmed transactions, auto-credits, and funding.',
        uri: 'https://cdn.freesound.org/previews/333/333404_4684427-lq.mp3',
    },
    {
        id: 'clip_alert',
        title: 'Emergency Siren Alarm',
        category: 'Alert',
        icon: 'alert-circle',
        color: C.red,
        description: 'High-priority sound for liquidity drop, API failure, or KYC queue.',
        uri: 'https://cdn.freesound.org/previews/456/456544_5121236-lq.mp3',
    },
    {
        id: 'clip_summon',
        title: 'Staff Summoning Horn',
        category: 'Staff',
        icon: 'people',
        color: C.purple,
        description: 'Broadcast alarm for staff meetings and dispatch orders.',
        uri: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
    },
    {
        id: 'clip_bell',
        title: 'Crystal Notification Bell',
        category: 'Direct',
        icon: 'notifications',
        color: C.blue,
        description: 'Default clean chime for ticket replies and message broadcasts.',
        uri: 'https://cdn.freesound.org/previews/264/264981_4486188-lq.mp3',
    },
];

// Quick Voice OS Command Presets
const VOICE_COMMANDS = [
    {
        id: 'cmd_revenue',
        phrase: 'Check today revenue & profit',
        action: 'accounting',
        route: '/manage/accounting',
        reply: 'Opening financial accounting ledger and profit metrics.',
        icon: 'calculator',
        color: C.green,
    },
    {
        id: 'cmd_liquidity',
        phrase: 'Check API provider liquidity',
        action: 'liquidity',
        route: '/manage/liquidity',
        reply: 'Fetching real-time API wallet balances and provider health.',
        icon: 'wallet',
        color: C.gold,
    },
    {
        id: 'cmd_map',
        phrase: 'Open Geo Map and Live Traffic Radar',
        action: 'map',
        route: '/manage/map',
        reply: 'Opening live traffic radar and state geolocation ingress.',
        icon: 'map',
        color: C.blue,
    },
    {
        id: 'cmd_marketing',
        phrase: 'Launch marketing campaign studio',
        action: 'marketing',
        route: '/manage/marketing',
        reply: 'Accessing marketing campaign and promotional broadcast studio.',
        icon: 'megaphone',
        color: C.gold,
    },
    {
        id: 'cmd_legal',
        phrase: 'Open Legal and Policy compliance center',
        action: 'legal',
        route: '/manage/legal',
        reply: 'Accessing Central Bank compliance, policies, and contracts vault.',
        icon: 'document-text',
        color: C.purple,
    },
    {
        id: 'cmd_files',
        phrase: 'Open Cloud File Repository',
        action: 'files',
        route: '/manage/files',
        reply: 'Opening Supabase cloud storage buckets and file repository.',
        icon: 'folder',
        color: C.blue,
    },
    {
        id: 'cmd_infrastructure',
        phrase: 'Check system status and infrastructure',
        action: 'infrastructure',
        route: '/manage/infrastructure',
        reply: 'Opening database ledger probes and live latency health.',
        icon: 'server',
        color: C.green,
    },
    {
        id: 'cmd_kyc',
        phrase: 'Open pending KYC verifications',
        action: 'kyc',
        route: '/manage/kyc',
        reply: 'Opening KYC verification queue for review.',
        icon: 'shield-checkmark',
        color: C.blue,
    },
    {
        id: 'cmd_transactions',
        phrase: 'View recent transactions ledger',
        action: 'transactions',
        route: '/manage/transactions',
        reply: 'Accessing live transaction ledger.',
        icon: 'receipt',
        color: C.purple,
    },
    {
        id: 'cmd_users',
        phrase: 'Open customer user manager',
        action: 'users',
        route: '/manage/users',
        reply: 'Opening user management console.',
        icon: 'people',
        color: C.navyLight,
    },
    {
        id: 'cmd_panic',
        phrase: 'Open Panic & Lockdown Room',
        action: 'panic',
        route: '/manage/panic',
        reply: 'Warning: Opening system emergency panic controls.',
        icon: 'warning',
        color: C.red,
    },
];

export default function AudioVoiceControlHub() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Tab state: 'voice_os' | 'audio_vault' | 'tts_studio'
    const [activeTab, setActiveTab] = useState<'voice_os' | 'audio_vault' | 'tts_studio'>('voice_os');

    // Voice OS State
    const [listening, setListening] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const [aiResponse, setAiResponse] = useState<string>('Voice Assistant is standby. Tap microphone or select a command.');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Audio Vault State
    const [audioCatalog, setAudioCatalog] = useState<any[]>(PRESET_AUDIO_CLIPS);
    const [activeToneId, setActiveToneId] = useState<string>('clip_welcome');
    const [playingClipId, setPlayingClipId] = useState<string | null>(null);
    const [uploadingClip, setUploadingClip] = useState(false);

    // Sound / Audio refs
    const soundInstanceRef = useRef<Audio.Sound | null>(null);
    const webAudioRef = useRef<any>(null);

    // TTS Studio State
    const [ttsText, setTtsText] = useState('Welcome to Abu Mafhal Hub Super Admin. All telecom APIs, wallets, and systems are running normally.');
    const [selectedVoicePitch, setSelectedVoicePitch] = useState(1.0);
    const [selectedVoiceRate, setSelectedVoiceRate] = useState(1.0);
    const [autoSpeakReplies, setAutoSpeakReplies] = useState(true);

    // Pulse animation for listening state
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (listening) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.25,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1.0,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [listening]);

    useEffect(() => {
        loadSavedAudioSettings();
        return () => {
            stopAudio();
            Speech.stop();
        };
    }, []);

    const stopAudio = async () => {
        try {
            if (webAudioRef.current) {
                webAudioRef.current.pause();
                webAudioRef.current = null;
            }
            if (soundInstanceRef.current) {
                await soundInstanceRef.current.stopAsync().catch(() => {});
                await soundInstanceRef.current.unloadAsync().catch(() => {});
                soundInstanceRef.current = null;
            }
        } catch (e) {}
        setPlayingClipId(null);
    };

    const loadSavedAudioSettings = async () => {
        try {
            const savedTone = await AsyncStorage.getItem('global_notification_ringtone');
            if (savedTone) setActiveToneId(savedTone);

            // Fetch custom clips from app_settings
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_custom_ringtones_catalog')
                .maybeSingle();

            if (data?.value) {
                let parsed = data.value;
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                if (Array.isArray(parsed)) {
                    const existingIds = new Set(PRESET_AUDIO_CLIPS.map(c => c.id));
                    const customs = parsed.filter(p => p && p.id && !existingIds.has(p.id));
                    setAudioCatalog([...PRESET_AUDIO_CLIPS, ...customs]);
                }
            }
        } catch (e) {
            console.log('Error loading audio catalog:', e);
        }
    };

    // Playback engine for web & mobile
    const playAudioClip = async (clip: any) => {
        try {
            if (playingClipId === clip.id) {
                await stopAudio();
                return;
            }
            await stopAudio();
            setPlayingClipId(clip.id);

            if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Audio) {
                const audio = new (window as any).Audio(clip.uri);
                audio.volume = 1.0;
                audio.onended = () => {
                    setPlayingClipId(null);
                    webAudioRef.current = null;
                };
                audio.onerror = () => {
                    setPlayingClipId(null);
                    webAudioRef.current = null;
                };
                webAudioRef.current = audio;
                await audio.play().catch(() => setPlayingClipId(null));
                return;
            }

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            }).catch(() => {});

            const { sound } = await Audio.Sound.createAsync(
                { uri: clip.uri },
                { shouldPlay: true, volume: 1.0 }
            );
            soundInstanceRef.current = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
                    setPlayingClipId(null);
                    sound.unloadAsync().catch(() => {});
                }
            });
        } catch (err: any) {
            console.log('Audio playback error:', err);
            setPlayingClipId(null);
        }
    };

    // Set sound as system default
    const setAsGlobalSound = async (clip: any) => {
        try {
            setActiveToneId(clip.id);
            await AsyncStorage.setItem('global_notification_ringtone', clip.id);
            await AsyncStorage.setItem('admin_preferred_ringtone', clip.id);

            await supabase.from('app_settings').upsert({
                key: 'global_notification_ringtone',
                value: { id: clip.id, uri: clip.uri, name: clip.title || clip.name },
                description: 'Global system notification ringtone sound configured from Admin Voice Hub'
            }, { onConflict: 'key' });

            Alert.alert('Sound Activated', `"${clip.title || clip.name}" has been set as the global alert sound for all devices.`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    // Upload custom audio file
    const handleUploadAudio = async () => {
        try {
            await stopAudio();
            const res = await DocumentPicker.getDocumentAsync({
                type: ['audio/*', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/m4a', 'audio/mp3'],
                copyToCacheDirectory: true,
            });

            if (res.canceled || !res.assets || res.assets.length === 0) return;

            const file = res.assets[0];
            setUploadingClip(true);

            let audioUri = file.uri;
            const cleanFileName = `voice_hub_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            try {
                let base64Data = '';
                if (Platform.OS === 'web' && (file as any).file) {
                    const reader = new FileReader();
                    base64Data = await new Promise((resolve, reject) => {
                        reader.onload = () => {
                            const res = reader.result as string;
                            resolve(res.includes(',') ? res.split(',')[1] : res);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL((file as any).file);
                    });
                } else if (file.uri) {
                    base64Data = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
                }

                if (base64Data) {
                    const { data: uploadRes, error: uploadErr } = await supabase.functions.invoke('admin-audit-logs', {
                        body: {
                            action: 'upload-ringtone',
                            fileName: cleanFileName,
                            base64Data: base64Data,
                            contentType: file.mimeType || 'audio/mpeg'
                        }
                    });

                    if (!uploadErr && uploadRes?.publicUrl) {
                        audioUri = uploadRes.publicUrl;
                    }
                }
            } catch (storageErr) {
                console.log('[VoiceHubStorage] Upload fallback:', storageErr);
            }

            const newClip = {
                id: `custom_${Date.now()}`,
                title: file.name.replace(/\.[^/.]+$/, ''),
                category: 'Custom Upload',
                icon: 'musical-notes',
                color: C.purple,
                description: 'Custom uploaded audio for voice alerts and system prompts.',
                uri: audioUri,
                is_custom: true,
            };

            const updated = [...audioCatalog, newClip];
            setAudioCatalog(updated);

            const customs = updated.filter(c => c.is_custom);
            await supabase.from('app_settings').upsert({
                key: 'admin_custom_ringtones_catalog',
                value: customs,
                description: 'Custom ringtones uploaded by Admin'
            }, { onConflict: 'key' });

            await setAsGlobalSound(newClip);
        } catch (err: any) {
            Alert.alert('Upload Error', err.message || 'Could not upload audio.');
        } finally {
            setUploadingClip(false);
        }
    };

    const handleDeleteCustomAudio = (clip: any) => {
        Alert.alert(
            'Delete Audio',
            `Remove "${clip.title || clip.name}" from your custom sound vault?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await stopAudio();
                        const updated = audioCatalog.filter(c => c.id !== clip.id);
                        setAudioCatalog(updated);

                        const customs = updated.filter(c => c.is_custom);
                        await supabase.from('app_settings').upsert({
                            key: 'admin_custom_ringtones_catalog',
                            value: customs,
                            description: 'Custom ringtones uploaded by Admin'
                        }, { onConflict: 'key' });

                        if (activeToneId === clip.id) {
                            await setAsGlobalSound(PRESET_AUDIO_CLIPS[0]);
                        }
                    }
                }
            ]
        );
    };

    // Text to Speech Engine
    const speakText = (text: string) => {
        try {
            Speech.stop();
            setIsSpeaking(true);
            Speech.speak(text, {
                pitch: selectedVoicePitch,
                rate: selectedVoiceRate,
                onDone: () => setIsSpeaking(false),
                onStopped: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        } catch (e) {
            setIsSpeaking(false);
        }
    };

    const stopSpeaking = () => {
        Speech.stop();
        setIsSpeaking(false);
    };

    // Voice OS Command Dispatcher
    const executeCommand = (cmd: typeof VOICE_COMMANDS[0]) => {
        setCommandQuery(cmd.phrase);
        setAiResponse(cmd.reply);
        if (autoSpeakReplies) {
            speakText(cmd.reply);
        }
        setTimeout(() => {
            router.push(cmd.route as any);
        }, 1200);
    };

    const handleCustomVoiceSubmit = () => {
        if (!commandQuery.trim()) return;
        const q = commandQuery.toLowerCase();

        const match = VOICE_COMMANDS.find(c =>
            q.includes(c.action) ||
            q.includes(c.phrase.toLowerCase()) ||
            (c.action === 'accounting' && (q.includes('revenue') || q.includes('profit') || q.includes('finance') || q.includes('money'))) ||
            (c.action === 'liquidity' && (q.includes('balance') || q.includes('provider') || q.includes('wallet') || q.includes('float'))) ||
            (c.action === 'kyc' && (q.includes('verify') || q.includes('nin') || q.includes('bvn') || q.includes('identity'))) ||
            (c.action === 'transactions' && (q.includes('transaction') || q.includes('history') || q.includes('records'))) ||
            (c.action === 'users' && (q.includes('user') || q.includes('customer') || q.includes('profile') || q.includes('account'))) ||
            (c.action === 'panic' && (q.includes('panic') || q.includes('lock') || q.includes('emergency') || q.includes('freeze')))
        );

        if (match) {
            executeCommand(match);
        } else {
            const fallbackReply = `Searching voice command for "${commandQuery}". Redirecting to administration dashboard.`;
            setAiResponse(fallbackReply);
            if (autoSpeakReplies) speakText(fallbackReply);
            setTimeout(() => {
                router.push('/manage');
            }, 1500);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Top Brand Navigation Header */}
            <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerTopRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={20} color={C.navy} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleWrap}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="mic" size={18} color={C.gold} />
                            <Text style={styles.headerTitle}>Audio & Voice Hub</Text>
                        </View>
                        <Text style={styles.headerSubtitle}>AI Voice OS, Audio Prompts & Text-to-Speech</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.replace('/(app)/dashboard')}
                        style={styles.userAppBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="home-outline" size={14} color={C.gold} style={{ marginRight: 4 }} />
                        <Text style={styles.userAppBtnText}>App</Text>
                    </TouchableOpacity>
                </View>

                {/* 3 Segmented Navigation Tabs */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('voice_os')}
                        style={[styles.tabItem, activeTab === 'voice_os' && styles.tabItemActive]}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name="radio"
                            size={16}
                            color={activeTab === 'voice_os' ? C.navyDark : C.textMuted}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'voice_os' && styles.tabTextActive]}>
                            Voice OS
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('audio_vault')}
                        style={[styles.tabItem, activeTab === 'audio_vault' && styles.tabItemActive]}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name="musical-notes"
                            size={16}
                            color={activeTab === 'audio_vault' ? C.navyDark : C.textMuted}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'audio_vault' && styles.tabTextActive]}>
                            Audio Vault
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('tts_studio')}
                        style={[styles.tabItem, activeTab === 'tts_studio' && styles.tabItemActive]}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name="volume-high"
                            size={16}
                            color={activeTab === 'tts_studio' ? C.navyDark : C.textMuted}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'tts_studio' && styles.tabTextActive]}>
                            TTS Studio
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Body */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* TAB 1: VOICE OS CONSOLE */}
                {activeTab === 'voice_os' && (
                    <View>
                        {/* Voice Assistant Interactive Hero Card */}
                        <View style={styles.voiceHeroCard}>
                            <View style={styles.voiceStatusBadge}>
                                <View style={[styles.statusPulseDot, listening && { backgroundColor: C.green }]} />
                                <Text style={styles.voiceStatusText}>
                                    {listening ? 'LISTENING & READY' : 'AI VOICE ASSISTANT ONLINE'}
                                </Text>
                            </View>

                            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginVertical: 20 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        const next = !listening;
                                        setListening(next);
                                        if (next) {
                                            setAiResponse('Listening for your admin command. Try saying or selecting an action below.');
                                            if (autoSpeakReplies) speakText('I am listening, Administrator.');
                                        } else {
                                            stopSpeaking();
                                        }
                                    }}
                                    style={[
                                        styles.bigMicButton,
                                        listening && styles.bigMicButtonActive
                                    ]}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons
                                        name={listening ? 'mic' : 'mic-outline'}
                                        size={46}
                                        color={listening ? '#FFFFFF' : C.gold}
                                    />
                                </TouchableOpacity>
                            </Animated.View>

                            <Text style={styles.heroGreetingTitle}>Welcome, Administrator</Text>
                            <Text style={styles.heroInstructionText}>
                                Speak or type a command to instantly query financials, audit logs, or system controls.
                            </Text>

                            {/* Assistant AI Feedback Display Box */}
                            <View style={styles.responseDisplayBox}>
                                <View style={styles.responseIconRow}>
                                    <Ionicons name="sparkles" size={16} color={C.gold} />
                                    <Text style={styles.responseSpeakerLabel}>CORTEX VOICE RESPONSE</Text>
                                    {isSpeaking && (
                                        <TouchableOpacity onPress={stopSpeaking} style={styles.stopSpeechBtn}>
                                            <Ionicons name="stop-circle" size={16} color={C.red} />
                                            <Text style={styles.stopSpeechText}>Stop Speech</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <Text style={styles.responseDisplayText}>{aiResponse}</Text>
                            </View>

                            {/* Voice Query Input Field */}
                            <View style={styles.voiceInputRow}>
                                <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.textMuted} />
                                <TextInput
                                    style={styles.voiceTextInput}
                                    placeholder="Type voice command (e.g. check revenue, kyc, liquidity)..."
                                    placeholderTextColor={C.textMuted}
                                    value={commandQuery}
                                    onChangeText={setCommandQuery}
                                    onSubmitEditing={handleCustomVoiceSubmit}
                                />
                                {commandQuery.length > 0 && (
                                    <TouchableOpacity onPress={handleCustomVoiceSubmit} style={styles.submitCommandBtn}>
                                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Toggle Audio Speech Feedback */}
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.toggleTitle}>Auto-Speak System Feedback</Text>
                                    <Text style={styles.toggleSub}>Read voice responses out loud using Text-to-Speech</Text>
                                </View>
                                <Switch
                                    value={autoSpeakReplies}
                                    onValueChange={setAutoSpeakReplies}
                                    trackColor={{ false: C.border, true: C.goldBright }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                        </View>

                        {/* Quick Command Direct Dispatch Tiles */}
                        <Text style={styles.sectionHeaderTitle}>⚡ Instant Voice Action Shortcuts</Text>
                        <Text style={styles.sectionHeaderSub}>Tap any shortcut to test voice intent routing immediately.</Text>

                        <View style={styles.commandGrid}>
                            {VOICE_COMMANDS.map((cmd) => (
                                <TouchableOpacity
                                    key={cmd.id}
                                    onPress={() => executeCommand(cmd)}
                                    style={styles.commandCard}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.commandIconBox, { backgroundColor: `${cmd.color}15` }]}>
                                        <Ionicons name={cmd.icon as any} size={22} color={cmd.color} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.commandPhraseText}>"{cmd.phrase}"</Text>
                                        <Text style={styles.commandActionText}>Routes to: {cmd.route}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* TAB 2: AUDIO VAULT & CHIMES */}
                {activeTab === 'audio_vault' && (
                    <View>
                        {/* Audio Upload & Controls Banner */}
                        <View style={styles.bannerCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bannerTitle}>Executive Audio Vault</Text>
                                <Text style={styles.bannerSub}>
                                    Manage chime sounds, push alert tones, and system broadcast jingles.
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleUploadAudio}
                                disabled={uploadingClip}
                                style={styles.uploadBtn}
                                activeOpacity={0.8}
                            >
                                {uploadingClip ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.uploadBtnText}>Upload Audio</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionHeaderTitle}>System Ringtone & Chime Catalog</Text>
                        <Text style={styles.sectionHeaderSub}>
                            Select any chime to preview and configure as global notification audio.
                        </Text>

                        {/* Audio Clips List */}
                        {audioCatalog.map((item) => {
                            const isCurrentGlobal = activeToneId === item.id;
                            const isPlaying = playingClipId === item.id;

                            return (
                                <View key={item.id} style={[styles.audioRowCard, isCurrentGlobal && styles.audioRowCardActive]}>
                                    <TouchableOpacity
                                        onPress={() => playAudioClip(item)}
                                        style={[styles.audioPlayBtn, isPlaying && styles.audioPlayBtnActive]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={isPlaying ? 'pause' : 'play'}
                                            size={20}
                                            color={isPlaying ? '#FFFFFF' : item.color || C.navy}
                                        />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.audioClipTitle}>{item.title || item.name}</Text>
                                            {isCurrentGlobal && (
                                                <View style={styles.activePill}>
                                                    <Text style={styles.activePillText}>DEFAULT ACTIVE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.audioClipCategory}>{item.category || 'System Tone'}</Text>
                                        {item.description && (
                                            <Text style={styles.audioClipDesc} numberOfLines={2}>
                                                {item.description}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => playAudioClip(item)}
                                            style={styles.previewBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={isPlaying ? 'volume-high' : 'volume-medium-outline'} size={16} color={C.navy} />
                                        </TouchableOpacity>

                                        {!isCurrentGlobal && (
                                            <TouchableOpacity
                                                onPress={() => setAsGlobalSound(item)}
                                                style={styles.setAsDefaultBtn}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.setAsDefaultText}>Set Default</Text>
                                            </TouchableOpacity>
                                        )}

                                        {item.is_custom && (
                                            <TouchableOpacity
                                                onPress={() => handleDeleteCustomAudio(item)}
                                                style={[styles.previewBtn, { backgroundColor: C.redLight, borderColor: C.redBorder }]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="trash-outline" size={16} color={C.red} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* TAB 3: TEXT-TO-SPEECH STUDIO */}
                {activeTab === 'tts_studio' && (
                    <View>
                        <View style={styles.ttsCard}>
                            <Text style={styles.ttsCardTitle}>Text-to-Speech Studio</Text>
                            <Text style={styles.ttsCardSub}>
                                Generate realistic spoken voice alerts for broadcast notifications and customer announcements.
                            </Text>

                            <Text style={styles.inputLabel}>ANNOUNCEMENT TEXT</Text>
                            <TextInput
                                style={styles.ttsTextArea}
                                multiline
                                numberOfLines={4}
                                placeholder="Enter text to synthesize into spoken audio..."
                                placeholderTextColor={C.textMuted}
                                value={ttsText}
                                onChangeText={setTtsText}
                            />

                            {/* Pitch and Speed Controls */}
                            <View style={styles.sliderControlRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.sliderLabel}>Speech Speed: {selectedVoiceRate.toFixed(1)}x</Text>
                                    <View style={styles.pillSelectorRow}>
                                        {[0.8, 1.0, 1.2, 1.5].map((rate) => (
                                            <TouchableOpacity
                                                key={rate}
                                                onPress={() => setSelectedVoiceRate(rate)}
                                                style={[styles.ratePill, selectedVoiceRate === rate && styles.ratePillActive]}
                                            >
                                                <Text style={[styles.ratePillText, selectedVoiceRate === rate && styles.ratePillTextActive]}>
                                                    {rate}x
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.sliderLabel}>Voice Pitch: {selectedVoicePitch.toFixed(1)}</Text>
                                    <View style={styles.pillSelectorRow}>
                                        {[0.8, 1.0, 1.2].map((pitch) => (
                                            <TouchableOpacity
                                                key={pitch}
                                                onPress={() => setSelectedVoicePitch(pitch)}
                                                style={[styles.ratePill, selectedVoicePitch === pitch && styles.ratePillActive]}
                                            >
                                                <Text style={[styles.ratePillText, selectedVoicePitch === pitch && styles.ratePillTextActive]}>
                                                    {pitch}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.ttsActionsRow}>
                                <TouchableOpacity
                                    onPress={() => speakText(ttsText)}
                                    style={styles.ttsSpeakBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={styles.ttsSpeakBtnText}>Synthesize & Speak</Text>
                                </TouchableOpacity>

                                {isSpeaking && (
                                    <TouchableOpacity
                                        onPress={stopSpeaking}
                                        style={styles.ttsStopBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="stop" size={18} color={C.red} style={{ marginRight: 4 }} />
                                        <Text style={styles.ttsStopBtnText}>Stop</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Preset Broadcast Samples */}
                        <Text style={styles.sectionHeaderTitle}>Standard Broadcast Voice Templates</Text>
                        <Text style={styles.sectionHeaderSub}>Quickly load approved institutional announcements.</Text>

                        {[
                            {
                                title: 'Daily System Status Summary',
                                sample: 'All services including MTN, Airtel, Glo, and 9mobile data gateways are operating at 99.8% stability.',
                            },
                            {
                                title: 'Scheduled Maintenance Notice',
                                sample: 'Notice: Banking API settlement channels will undergo routine maintenance at midnight for 15 minutes.',
                            },
                            {
                                title: 'Emergency Float Reminder',
                                sample: 'Alert: Secondary VTU provider liquidity is running below threshold. Please review the liquidity console.',
                            },
                        ].map((item, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                    setTtsText(item.sample);
                                    speakText(item.sample);
                                }}
                                style={styles.templateCard}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="chatbubbles" size={20} color={C.gold} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.templateTitle}>{item.title}</Text>
                                    <Text style={styles.templateSampleText} numberOfLines={2}>
                                        "{item.sample}"
                                    </Text>
                                </View>
                                <Ionicons name="play-circle-outline" size={24} color={C.navy} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    headerContainer: {
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: C.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    headerTitleWrap: {
        flex: 1,
        marginHorizontal: 10,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.navy,
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 1,
    },
    userAppBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.goldBg,
        borderWidth: 1,
        borderColor: C.goldBorder,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    userAppBtnText: {
        color: C.gold,
        fontSize: 11,
        fontWeight: '700',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: C.borderLight,
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 9,
    },
    tabItemActive: {
        backgroundColor: C.card,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textMuted,
    },
    tabTextActive: {
        color: C.navy,
        fontWeight: '800',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 60,
    },
    voiceHeroCard: {
        backgroundColor: C.card,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 20,
    },
    voiceStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.goldBg,
        borderWidth: 1,
        borderColor: C.goldBorder,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statusPulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: C.gold,
        marginRight: 6,
    },
    voiceStatusText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.gold,
        letterSpacing: 0.5,
    },
    bigMicButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: C.card,
        borderWidth: 3,
        borderColor: C.gold,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    bigMicButtonActive: {
        backgroundColor: C.gold,
        borderColor: C.goldLight,
    },
    heroGreetingTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: C.navy,
        letterSpacing: -0.2,
    },
    heroInstructionText: {
        fontSize: 12,
        color: C.textSub,
        textAlign: 'center',
        marginTop: 4,
        maxWidth: 320,
        lineHeight: 17,
    },
    responseDisplayBox: {
        width: '100%',
        backgroundColor: C.borderLight,
        borderRadius: 14,
        padding: 14,
        marginTop: 16,
        borderWidth: 1,
        borderColor: C.border,
    },
    responseIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    responseSpeakerLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: C.gold,
        letterSpacing: 0.8,
        marginLeft: 6,
        flex: 1,
    },
    stopSpeechBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.redLight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    stopSpeechText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.red,
    },
    responseDisplayText: {
        fontSize: 13,
        fontWeight: '600',
        color: C.navy,
        lineHeight: 19,
    },
    voiceInputRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
        marginTop: 14,
    },
    voiceTextInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 12,
        color: C.navy,
        fontWeight: '500',
    },
    submitCommandBtn: {
        backgroundColor: C.navy,
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: C.borderLight,
    },
    toggleTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: C.navy,
    },
    toggleSub: {
        fontSize: 10,
        color: C.textMuted,
        marginTop: 1,
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
        letterSpacing: -0.2,
        marginTop: 6,
        marginBottom: 2,
    },
    sectionHeaderSub: {
        fontSize: 11,
        color: C.textMuted,
        marginBottom: 12,
    },
    commandGrid: {
        gap: 10,
    },
    commandCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    commandIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commandPhraseText: {
        fontSize: 13,
        fontWeight: '700',
        color: C.navy,
    },
    commandActionText: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 2,
    },
    bannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 16,
    },
    bannerTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.navy,
    },
    bannerSub: {
        fontSize: 11,
        color: C.textSub,
        marginTop: 2,
        maxWidth: 240,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.gold,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
    },
    uploadBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    audioRowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10,
    },
    audioRowCardActive: {
        borderColor: C.gold,
        backgroundColor: C.goldBg,
    },
    audioPlayBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: C.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioPlayBtnActive: {
        backgroundColor: C.navy,
    },
    audioClipTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: C.navy,
    },
    audioClipCategory: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '600',
        marginTop: 1,
    },
    audioClipDesc: {
        fontSize: 11,
        color: C.textSub,
        marginTop: 2,
    },
    activePill: {
        backgroundColor: C.goldLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    activePillText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.gold,
    },
    previewBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: C.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setAsDefaultBtn: {
        backgroundColor: C.navy,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    setAsDefaultText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    ttsCard: {
        backgroundColor: C.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 20,
    },
    ttsCardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.navy,
    },
    ttsCardSub: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 2,
        marginBottom: 14,
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: C.textMuted,
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    ttsTextArea: {
        backgroundColor: C.borderLight,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 12,
        fontSize: 13,
        color: C.navy,
        textAlignVertical: 'top',
        minHeight: 80,
    },
    sliderControlRow: {
        flexDirection: 'row',
        marginTop: 14,
    },
    sliderLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: C.navy,
        marginBottom: 6,
    },
    pillSelectorRow: {
        flexDirection: 'row',
        gap: 6,
    },
    ratePill: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.borderLight,
        borderWidth: 1,
        borderColor: C.border,
    },
    ratePillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy,
    },
    ratePillText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSub,
    },
    ratePillTextActive: {
        color: '#FFFFFF',
    },
    ttsActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
    },
    ttsSpeakBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.gold,
        paddingVertical: 12,
        borderRadius: 12,
    },
    ttsSpeakBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    ttsStopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.redLight,
        borderWidth: 1,
        borderColor: C.redBorder,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
    },
    ttsStopBtnText: {
        color: C.red,
        fontSize: 12,
        fontWeight: '700',
    },
    templateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10,
    },
    templateTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: C.navy,
    },
    templateSampleText: {
        fontSize: 11,
        color: C.textSub,
        marginTop: 2,
    },
});
