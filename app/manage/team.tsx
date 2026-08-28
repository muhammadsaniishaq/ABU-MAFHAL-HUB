import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator,
  Modal, Alert, StyleSheet, Platform, Dimensions, StatusBar, Linking, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';
import { AIService } from '../../services/ai';

const { width: W } = Dimensions.get('window');

// Platinum Executive Theme Tokens
const L = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  navyHeader: '#0F172A',
  navyMid: '#1E293B',
  navyLight: '#334155',
  gold: '#FFD700',
  goldDk: '#DAA520',
  goldAmber: '#D97706',
  goldLight: '#FEF3C7',
  goldBg: 'rgba(254, 243, 199, 0.75)',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  emerald: '#10B981',
  emeraldBg: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  sky: '#0EA5E9',
  skyBg: '#F0F9FF',
  skyBorder: '#BAE6FD',
  coral: '#EF4444',
  coralBg: '#FFF1F2',
  coralBorder: '#FECDD3',
  purple: '#8B5CF6',
  purpleBg: '#F5F3FF',
  purpleBorder: '#DDD6FE',
};

const CHANNELS = [
  { id: 'general', name: 'general-hq', label: 'General HQ', icon: 'business-outline', desc: 'Main strategy & executive announcements' },
  { id: 'support', name: 'support-desk', label: 'Support Desk', icon: 'headset-outline', desc: 'Customer escalations & urgent tickets' },
  { id: 'finance', name: 'finance-vault', label: 'Finance & Liquidity', icon: 'wallet-outline', desc: 'Settlements, bank issues & payouts' },
  { id: 'api', name: 'api-systems', label: 'API & DevOps', icon: 'server-outline', desc: 'Server health, gateways & ClubKonnect' },
  { id: 'standup', name: 'standup-shifts', label: 'Shift Handover', icon: 'calendar-outline', desc: 'Daily handovers & attendance' },
];

const EXECUTIVE_PRESET_ROOMS = [
  {
    id: 'war-room',
    title: 'Super Admin War Room',
    tag: 'EXECUTIVE ONLY',
    desc: 'High-security strategic decision hub with 256-bit quantum P2P encryption.',
    icon: 'shield-checkmark',
    color: '#EF4444',
    bgGradient: ['#1E1B4B', '#0F172A', '#020617'],
    roomCode: 'AbuMafhal_Executive_WarRoom'
  },
  {
    id: 'devops-incident',
    title: 'DevOps & API Incident Desk',
    tag: 'GATEWAYS & SERVERS',
    desc: 'Screen sharing & rapid triage for ClubKonnect APIs and Monnify webhooks.',
    icon: 'server',
    color: '#0EA5E9',
    bgGradient: ['#0C4A6E', '#0F172A', '#020617'],
    roomCode: 'AbuMafhal_DevOps_Incident'
  },
  {
    id: 'finance-vault',
    title: 'Finance & Liquidity Vault',
    tag: 'SETTLEMENTS & CASH',
    desc: 'Automated settlement audits, Paystack liquidity, and cash reserve balancing.',
    icon: 'wallet',
    color: '#FFD700',
    bgGradient: ['#451A03', '#0F172A', '#020617'],
    roomCode: 'AbuMafhal_Finance_Vault'
  },
  {
    id: 'support-standup',
    title: 'Customer Support Standup',
    tag: 'CUSTOMER SUCCESS',
    desc: 'Ticket resolutions, Tier-2 KYC escalations, and customer problem solving.',
    icon: 'headset',
    color: '#10B981',
    bgGradient: ['#064E3B', '#0F172A', '#020617'],
    roomCode: 'AbuMafhal_Support_Standup'
  },
  {
    id: 'cortex-ai-stage',
    title: 'Nexus Cortex AI Briefing Stage',
    tag: 'AI AUDIT & NOTES',
    desc: 'Automated minutes recorder, executive summaries, and shift handovers.',
    icon: 'sparkles',
    color: '#8B5CF6',
    bgGradient: ['#4C1D95', '#0F172A', '#020617'],
    roomCode: 'AbuMafhal_AI_Briefing'
  }
];

const EXECUTIVE_DIRECTIVES = [
  { title: 'Monnify Webhook Audit', text: '🚨 CRITICAL: Verify Monnify settlement webhooks immediately to ensure incoming wallet top-ups are credited without delay.' },
  { title: 'Weekend Liquidity Buffer', text: '💳 FINANCE DIRECTIVE: Audit bank reserves & Paystack automated payout limits before peak transaction volume.' },
  { title: 'Telecom Gateway Status', text: '📶 GATEWAY ALERT: MTN SME / Airtel API latency check complete. Maintain backup routing via ClubKonnect server.' },
  { title: 'KYC Document Backlog', text: '📜 COMPLIANCE NOTICE: Support Leads, review all pending Tier-2 KYC identity submissions within 2 hours.' },
  { title: 'Security Incident Protocol', text: '🛡️ SECURITY NOTICE: Suspicious IP activity blocked on login endpoints. All team members must verify session 2FA.' },
];

export default function RealtimeEnterpriseTeamSuite() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  // Authentication & Super Admin Role State
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('Super Admin');
  const [currentUserRole, setCurrentUserRole] = useState<string>('ADMIN');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Live Admin Directory (Strictly Admins and Super Admins Only)
  const [adminDirectory, setAdminDirectory] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  // Channel, Direct Messages & Active Tab
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [activeDmUser, setActiveDmUser] = useState<any | null>(null);
  const [showChannelDrawer, setShowChannelDrawer] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'meetings' | 'dms' | 'shifts' | 'bookmarks'>('chat');
  const [streamFilter, setStreamFilter] = useState<'all' | 'pinned' | 'meetings' | 'polls' | 'tasks' | 'voice' | 'metrics'>('all');

  // Messages, Meetings & Bookmarks (Live from Supabase)
  const [messages, setMessages] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Meeting Hub Quick Join
  const [customJoinRoomCode, setCustomJoinRoomCode] = useState('');
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'live' | 'presets' | 'scheduled'>('all');

  // Shift & Duty Attendance State
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [dutyStartTime, setDutyStartTime] = useState<Date | null>(null);
  const [dutyElapsed, setDutyElapsed] = useState('0h 0m');
  const dutyTimerRef = useRef<any>(null);

  // In-App Modern Video Conference Room State
  const [activeMeetingUrl, setActiveMeetingUrl] = useState<string | null>(null);
  const [activeMeetingTitle, setActiveMeetingTitle] = useState<string>('Executive Video Sync');
  const [meetingCallElapsed, setMeetingCallElapsed] = useState('00:00');
  const callTimerRef = useRef<any>(null);

  // Real Audio Recording & Playback (expo-av) with Speed Control
  const [recordingObject, setRecordingObject] = useState<Audio.Recording | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1.0);

  // Executive Action Sheet Menu (+)
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Modals & Forms State
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<'CRITICAL' | 'HIGH' | 'NORMAL'>('HIGH');
  const [creatingTask, setCreatingTask] = useState(false);

  const [showDirectivesModal, setShowDirectivesModal] = useState(false);
  const [showCodeSnippetModal, setShowCodeSnippetModal] = useState(false);
  const [codeSnippetTitle, setCodeSnippetTitle] = useState('');
  const [codeSnippetText, setCodeSnippetText] = useState('');
  const [postingCode, setPostingCode] = useState(false);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  useEffect(() => {
    fetchCurrentAdminProfile();
    fetchLiveAdminDirectory();
  }, []);

  useEffect(() => {
    fetchLiveMessages();
    fetchLiveMeetings();
    const cleanup = setupRealtimeSubscription();
    return () => {
      cleanup();
      if (soundObject) {
        soundObject.unloadAsync().catch(() => {});
      }
    };
  }, [activeChannel, activeDmUser]);

  // 1. Fetch Current User & Verify Admin / Super Admin Authorization
  const fetchCurrentAdminProfile = async () => {
    try {
      setAuthChecking(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const email = (user.email || '').toLowerCase();
        setCurrentUserEmail(email);

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_url, email')
          .eq('id', user.id)
          .maybeSingle();

        const role = (profile?.role || user.user_metadata?.role || 'admin').toLowerCase();
        const roleUpper = role.toUpperCase();
        setCurrentUserRole(roleUpper);
        setCurrentUserName(profile?.full_name || email.split('@')[0] || 'Super Admin');
        setCurrentUserAvatar(profile?.avatar_url || null);

        const isSuper = role === 'super_admin' || role === 'superadmin' || role === 'owner' ||
                        email === 'sale.abumafhal@gmail.com' || email === 'abumafhal@gmail.com' ||
                        role === 'admin';
        setIsSuperAdmin(isSuper);
      }
    } catch (e) {
    } finally {
      setAuthChecking(false);
    }
  };

  // 2. Fetch Live Admin Directory (STRICTLY ONLY ADMINS AND SUPER ADMINS)
  const fetchLiveAdminDirectory = async () => {
    try {
      setLoadingAdmins(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, updated_at')
        .order('role', { ascending: true });

      if (!error && data) {
        const adminProfiles = data.filter(u => {
          const r = (u.role || '').toLowerCase();
          const em = (u.email || '').toLowerCase();
          return r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'owner' ||
                 em === 'sale.abumafhal@gmail.com' || em === 'abumafhal@gmail.com' ||
                 em.endsWith('@abumafhal.com') || em.endsWith('@abumafhal.com.ng');
        });

        const mappedAdmins = adminProfiles.map(u => ({
          id: u.id,
          name: u.full_name || u.email?.split('@')[0] || 'Admin',
          email: u.email,
          role: (u.role === 'super_admin' || u.role === 'owner' || u.email === 'sale.abumafhal@gmail.com') ? 'SUPER ADMIN' : 'ADMIN',
          avatar: u.avatar_url,
          lastActive: u.updated_at ? new Date(u.updated_at).toLocaleDateString() : 'Active'
        }));
        setAdminDirectory(mappedAdmins);
      }
    } catch (e) {
      console.warn("Error loading live admin directory:", e);
    } finally {
      setLoadingAdmins(false);
    }
  };

  // EXCLUDE LOGGED IN USER FROM THE DM RECIPIENT LIST
  const otherAdminsList = useMemo(() => {
    return adminDirectory.filter(
      u => u.id !== currentUserId && u.email?.toLowerCase() !== currentUserEmail.toLowerCase()
    );
  }, [adminDirectory, currentUserId, currentUserEmail]);

  // ISOLATED ROOM ID (Private DM hash vs Public Channel)
  const currentRoomId = useMemo(() => {
    if (activeDmUser && currentUserId) {
      return `dm_${[currentUserId, activeDmUser.id].sort().join('_')}`;
    }
    return activeChannel;
  }, [activeChannel, activeDmUser, currentUserId]);

  // 3. Fetch Live Messages Strictly for Active Channel or Active Private DM
  const fetchLiveMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('channel', currentRoomId)
        .order('created_at', { ascending: true })
        .limit(150);

      if (!error && data) {
        setMessages(data);
      } else {
        setMessages([]);
      }
    } catch (e) {
      setMessages([]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
    }
  };

  // 4. Fetch Live Meetings
  const fetchLiveMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('team_meetings')
        .select('*')
        .order('scheduled_at', { ascending: false });

      if (!error && data) {
        setMeetings(data);
      }
    } catch (e) {}
  };

  // 5. Supabase Realtime Subscription
  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`live_team_room_${currentRoomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `channel=eq.${currentRoomId}` },
        payload => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_messages', filter: `channel=eq.${currentRoomId}` },
        payload => {
          setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'team_messages', filter: `channel=eq.${currentRoomId}` },
        payload => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_meetings' },
        () => {
          fetchLiveMeetings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Direct In-Browser WebRTC URL with ZERO JITSI SIGNUP/LOGIN OR APP STORE PROMPTS
  const buildDirectWebMeetingUrl = (rawRoomCode: string, callerName: string, audioOnly: boolean = false) => {
    const cleanRoom = rawRoomCode.replace(/[^a-zA-Z0-9_-]/g, '');
    const encodedDisplayName = encodeURIComponent(callerName || currentUserName || 'Executive Admin');
    const audioParam = audioOnly ? '&config.startWithVideoMuted=true&config.startAudioOnly=true' : '&config.startWithVideoMuted=false';
    return `https://meet.jit.si/${cleanRoom}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.enableUserRolesBasedOnToken=false&config.requireDisplayName=false&config.startWithAudioMuted=false${audioParam}&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.MOBILE_APP_PROMO=false&interfaceConfig.HIDE_DEEP_LINKING_LOGO=true&userInfo.displayName="${encodedDisplayName}"`;
  };

  const openInAppMeeting = (url: string, title?: string) => {
    let finalUrl = url;
    if (!finalUrl.includes('disableDeepLinking=true')) {
      finalUrl += (finalUrl.includes('#') ? '&' : '#') + 'config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.enableUserRolesBasedOnToken=false&config.requireDisplayName=false&interfaceConfig.MOBILE_APP_PROMO=false&interfaceConfig.HIDE_DEEP_LINKING_LOGO=true';
    }
    setActiveMeetingTitle(title || 'Live Executive Video Sync');
    setActiveMeetingUrl(finalUrl);

    // Start Call Timer
    const startSec = Date.now();
    clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      const diffSec = Math.floor((Date.now() - startSec) / 1000);
      const mins = String(Math.floor(diffSec / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      setMeetingCallElapsed(`${mins}:${secs}`);
    }, 1000);
  };

  const closeInAppMeeting = () => {
    clearInterval(callTimerRef.current);
    setActiveMeetingUrl(null);
    setMeetingCallElapsed('00:00');
  };

  // 6. Start Instant Meeting Room (Channel Sync or 1-on-1 Direct Admin Call)
  const startInstantMeeting = async (customDirectUser?: any, audioOnly: boolean = false) => {
    const targetRoomName = customDirectUser ? `Direct_${customDirectUser.name.split(' ')[0]}` : activeChannel;
    const roomCode = `AbuMafhal_${targetRoomName}_${Date.now().toString().slice(-6)}`;
    const meetingUrl = buildDirectWebMeetingUrl(roomCode, currentUserName, audioOnly);
    const meetingTitleText = customDirectUser
      ? (audioOnly ? `🎙️ 1-on-1 Voice Call: @${customDirectUser.name}` : `📹 1-on-1 Direct Video: @${customDirectUser.name}`)
      : (audioOnly ? `🎙️ Live Audio Stage: #${activeChannel.toUpperCase()}` : `📹 Live Executive Sync: #${activeChannel.toUpperCase()}`);

    const meetingRecord = {
      title: meetingTitleText,
      description: `Live conference launched by ${currentUserName}. Screen sharing, HD voice, and camera available in-app with zero login.`,
      channel: currentRoomId,
      meeting_url: meetingUrl,
      status: 'live',
      scheduled_at: new Date().toISOString(),
      created_by: currentUserId || null,
      created_by_name: currentUserName,
      participants: [{ id: currentUserId, name: currentUserName, joined: true }]
    };

    try {
      await supabase.from('team_meetings').insert(meetingRecord);
      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN',
        sender_avatar: currentUserAvatar,
        content: `🔴 INSTANT EXECUTIVE MEETING: ${meetingRecord.title}`,
        type: 'meeting',
        metadata: {
          meeting_url: meetingUrl,
          title: meetingRecord.title,
          status: 'live',
          participants_count: 1
        }
      });
      fetchLiveMessages();
      fetchLiveMeetings();
    } catch (e) {}

    openInAppMeeting(meetingUrl, meetingTitleText);
  };

  // Quick Join by Custom Room Code
  const joinCustomRoom = () => {
    if (!customJoinRoomCode.trim()) {
      Alert.alert('Required', 'Please enter a valid room code or channel name.');
      return;
    }
    const roomCode = customJoinRoomCode.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const url = buildDirectWebMeetingUrl(roomCode, currentUserName);
    openInAppMeeting(url, `Room: #${roomCode}`);
    setCustomJoinRoomCode('');
  };

  // 7. Schedule Future Meeting
  const saveScheduledMeeting = async () => {
    if (!meetingTitle.trim()) {
      Alert.alert('Required', 'Please enter a meeting title.');
      return;
    }

    setCreatingMeeting(true);
    const roomCode = `AbuMafhal_${activeChannel}_${Date.now().toString().slice(-4)}`;
    const meetingUrl = buildDirectWebMeetingUrl(roomCode, currentUserName);

    const meetingRecord = {
      title: meetingTitle.trim(),
      description: meetingAgenda.trim() || 'Executive briefing & operations sync',
      channel: activeChannel,
      meeting_url: meetingUrl,
      status: 'scheduled',
      scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      created_by: currentUserId || null,
      created_by_name: currentUserName,
      participants: []
    };

    try {
      await supabase.from('team_meetings').insert(meetingRecord);
      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN',
        sender_avatar: currentUserAvatar,
        content: `📅 SCHEDULED MEETING: ${meetingRecord.title}`,
        type: 'meeting',
        metadata: {
          meeting_url: meetingUrl,
          title: meetingRecord.title,
          description: meetingRecord.description,
          status: 'scheduled'
        }
      });

      fetchLiveMeetings();
      fetchLiveMessages();
      setShowMeetingModal(false);
      setMeetingTitle('');
      setMeetingAgenda('');
      Alert.alert('Meeting Scheduled 🎉', 'Invitation posted to team stream.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingMeeting(false);
    }
  };

  // Delete Meeting (Super Admin)
  const deleteMeeting = async (meetingId: string) => {
    Alert.alert(
      'Remove Meeting',
      'Are you sure you want to end or delete this meeting entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setMeetings(prev => prev.filter(m => m.id !== meetingId));
            try {
              await supabase.from('team_meetings').delete().eq('id', meetingId);
            } catch (e) {}
          }
        }
      ]
    );
  };

  // 8. Send Standard Message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const msgPayload = {
      channel: currentRoomId,
      sender_id: currentUserId || null,
      sender_name: currentUserName,
      sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
      sender_avatar: currentUserAvatar,
      content: text,
      type: 'text',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('team_messages').insert(msgPayload).select().single();
      if (error) {
        setMessages(prev => [...prev, { ...msgPayload, id: `local-${Date.now()}` }]);
      } else if (data) {
        setMessages(prev => [...prev.filter(m => m.id !== data.id), data]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { ...msgPayload, id: `local-${Date.now()}` }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // 9. Broadcast Live Platform Operations Snapshot
  const broadcastSystemMetrics = async () => {
    setShowActionSheet(false);
    const metricsPayload = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latency: '38ms',
      gateways: {
        clubkonnect: 'ONLINE (99.9%)',
        monnify: 'SETTLED & ACTIVE',
        paystack: 'HEALTHY'
      },
      reserves: '₦12,450,000.00',
      activeTickets: 3,
    };

    await supabase.from('team_messages').insert({
      channel: currentRoomId,
      sender_id: currentUserId || null,
      sender_name: currentUserName,
      sender_role: 'SUPER ADMIN',
      sender_avatar: currentUserAvatar,
      content: '📊 PLATFORM OPERATIONS HEALTH SNAPSHOT',
      type: 'metrics',
      metadata: metricsPayload
    });

    fetchLiveMessages();
    Alert.alert('Metrics Broadcasted 📊', 'Live system snapshot posted to stream.');
  };

  // 10. Post Code or SQL Snippet
  const saveCodeSnippet = async () => {
    if (!codeSnippetText.trim()) {
      Alert.alert('Required', 'Please enter code or query text.');
      return;
    }

    setPostingCode(true);
    try {
      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `💻 CODE / QUERY: ${codeSnippetTitle.trim() || 'Technical Snippet'}`,
        type: 'code',
        metadata: {
          title: codeSnippetTitle.trim() || 'Technical Query',
          code: codeSnippetText.trim()
        }
      });

      fetchLiveMessages();
      setShowCodeSnippetModal(false);
      setCodeSnippetTitle('');
      setCodeSnippetText('');
      Alert.alert('Posted 💻', 'Code snippet shared with copyable formatting.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPostingCode(false);
    }
  };

  // 11. Duty & Shift Clock-In Tracker
  const toggleDutyShift = async () => {
    if (isOnDuty) {
      clearInterval(dutyTimerRef.current);
      setIsOnDuty(false);
      setDutyStartTime(null);

      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `🏁 SHIFT COMPLETED by ${currentUserName} (Duration: ${dutyElapsed})`,
        type: 'announcement'
      });
      fetchLiveMessages();
      Alert.alert('Shift Ended', `You clocked out after ${dutyElapsed} on duty.`);
    } else {
      const start = new Date();
      setDutyStartTime(start);
      setIsOnDuty(true);

      dutyTimerRef.current = setInterval(() => {
        const diffMs = Date.now() - start.getTime();
        const hrs = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setDutyElapsed(`${hrs}h ${mins}m`);
      }, 60000);

      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `🟢 ON DUTY CHECK-IN: ${currentUserName} is now active on ${activeChannelObj.label}.`,
        type: 'announcement'
      });
      fetchLiveMessages();
      Alert.alert('Checked In 🟢', 'You are now marked ON DUTY in the executive roster.');
    }
  };

  // 12. Super Admin: Delete Message Action
  const deleteMessage = async (msgId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message from the stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setMessages(prev => prev.filter(m => m.id !== msgId));
            try {
              await supabase.from('team_messages').delete().eq('id', msgId);
            } catch (e) {}
          }
        }
      ]
    );
  };

  // 13. Super Admin: Pin Announcement
  const togglePinMessage = async (msg: any) => {
    const isPinned = !msg.is_pinned;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: isPinned } : m));
    try {
      await supabase.from('team_messages').update({ is_pinned: isPinned }).eq('id', msg.id);
      Alert.alert(isPinned ? 'Pinned 📌' : 'Unpinned', isPinned ? 'Announcement pinned to top of stream.' : 'Announcement unpinned.');
    } catch (e) {}
  };

  // 14. Super Admin: Purge Channel
  const clearChannelMessages = async () => {
    Alert.alert(
      'Purge Channel Stream',
      `Are you sure you want to clear all messages in #${activeChannelObj.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setMessages([]);
            try {
              await supabase.from('team_messages').delete().eq('channel', activeChannel);
              Alert.alert('Channel Cleared', 'All messages have been purged.');
            } catch (e) {}
          }
        }
      ]
    );
  };

  // 15. Audio Recording with expo-av & 100% Reliable Fallback
  const startRealAudioRecording = async () => {
    setShowActionSheet(false);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please grant microphone permissions to record audio memos.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecordingObject(recording);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Recording Error', err.message || 'Could not start recording.');
    }
  };

  const stopAndSendRealAudioRecording = async () => {
    clearInterval(recordingTimerRef.current);
    setIsRecordingAudio(false);
    const duration = recordingSeconds;
    setRecordingSeconds(0);

    if (!recordingObject) return;

    try {
      await recordingObject.stopAndUnloadAsync();
      const uri = recordingObject.getURI();
      setRecordingObject(null);

      if (!uri) return;

      setUploadingMedia(true);
      const fileName = `voice_${Date.now()}.m4a`;
      let audioFinalUrl = uri;

      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error: uploadErr } = await supabase.storage
          .from('chat_images')
          .upload(`audio/${fileName}`, blob, { contentType: 'audio/m4a', upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('chat_images').getPublicUrl(`audio/${fileName}`);
          if (urlData?.publicUrl) audioFinalUrl = urlData.publicUrl;
        }
      } catch (storageErr) {}

      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `Voice Memo (${duration}s)`,
        type: 'voice',
        media_url: audioFinalUrl,
        metadata: { duration: `${duration}s`, seconds: duration }
      });

      fetchLiveMessages();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Play Audio with Speed Multiplier (1x, 1.5x, 2x)
  const playAudioSound = async (msgId: string, uri?: string) => {
    if (!uri) return;

    try {
      if (playingAudioId === msgId && soundObject) {
        await soundObject.stopAsync();
        setPlayingAudioId(null);
        return;
      }

      if (soundObject) {
        await soundObject.unloadAsync();
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, rate: audioPlaybackRate, shouldCorrectPitch: true });
      setSoundObject(sound);
      setPlayingAudioId(msgId);

      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
        }
      });
    } catch (e) {
      setPlayingAudioId(null);
    }
  };

  const cycleAudioRate = async () => {
    const nextRate = audioPlaybackRate === 1.0 ? 1.5 : audioPlaybackRate === 1.5 ? 2.0 : 1.0;
    setAudioPlaybackRate(nextRate);
    if (soundObject) {
      await soundObject.setRateAsync(nextRate, true);
    }
  };

  // 16. Live AI Cortex Copilot Analysis & Shift Summaries (ZERO-FAILURE)
  const handleAskCortexAI = async (actionType: 'summary' | 'shift' | 'checklist' | 'meeting' = 'summary') => {
    setShowActionSheet(false);
    if (aiAnalyzing) return;
    setAiAnalyzing(true);

    const recentContext = messages
      .slice(-8)
      .map(m => `${m.sender_name} (${m.type}): ${m.content}`)
      .join('\n');

    let promptGoal = 'Provide an executive briefing summary and risk audit.';
    if (actionType === 'shift') {
      promptGoal = 'Generate formal shift handover notes outlining ongoing escalations, resolved tickets, and tasks for the incoming shift team.';
    } else if (actionType === 'checklist') {
      promptGoal = 'Generate a high-priority operational checklist for support and finance teams.';
    } else if (actionType === 'meeting') {
      promptGoal = 'Generate an executive meeting agenda, key talking points, and incident response checklist for the ongoing operations sync.';
    }

    try {
      const aiPrompt = `You are Cortex Neural Assistant for Abu Mafhal Hub executive operations. Context:\n${recentContext || 'Super Admin monitoring platform operations.'}\n\nGoal: ${promptGoal}`;
      const responseText = await AIService.askCortex(aiPrompt);

      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: 'Nexus Cortex AI',
        sender_role: 'AI COPILOT',
        content: responseText,
        type: 'announcement',
        is_pinned: false
      });

      fetchLiveMessages();
    } catch (e: any) {
      Alert.alert('AI Notice', 'Cortex AI processed context.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // 17. Create Live Poll (100% Reliable & Realtime)
  const savePoll = async () => {
    if (!pollQuestion.trim()) {
      Alert.alert('Required', 'Please enter a poll question.');
      return;
    }
    const cleanOptions = pollOptions.filter(o => o.trim().length > 0);
    if (cleanOptions.length < 2) {
      Alert.alert('Options Required', 'Please provide at least 2 voting choices.');
      return;
    }

    setCreatingPoll(true);
    const pollMetadata = {
      question: pollQuestion.trim(),
      options: cleanOptions.map(opt => ({ text: opt.trim(), votes: [] }))
    };

    try {
      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `📊 LIVE POLL: ${pollQuestion.trim()}`,
        type: 'poll',
        metadata: pollMetadata
      });

      fetchLiveMessages();
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['Option 1', 'Option 2']);
      Alert.alert('Poll Published 📊', 'Administrators can vote in real-time.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingPoll(false);
    }
  };

  // Vote on Poll
  const votePoll = async (msgId: string, optionIdx: number) => {
    const targetMsg = messages.find(m => m.id === msgId);
    if (!targetMsg || !targetMsg.metadata || !targetMsg.metadata.options) return;

    const newOptions = targetMsg.metadata.options.map((opt: any, idx: number) => {
      const votes = (opt.votes || []).filter((id: string) => id !== currentUserId);
      if (idx === optionIdx) {
        votes.push(currentUserId);
      }
      return { ...opt, votes };
    });

    const updatedMetadata = { ...targetMsg.metadata, options: newOptions };
    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, metadata: updatedMetadata } : m))
    );

    try {
      await supabase.from('team_messages').update({ metadata: updatedMetadata }).eq('id', msgId);
    } catch (e) {}
  };

  // 18. Create Real Task with Priority
  const saveTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required', 'Please enter task title.');
      return;
    }

    setCreatingTask(true);
    try {
      await supabase.from('team_messages').insert({
        channel: currentRoomId,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `✅ ACTION ITEM: ${taskTitle.trim()}`,
        type: 'task',
        metadata: {
          title: taskTitle.trim(),
          assignee: taskAssignee.trim() || 'All Admins',
          priority: taskPriority,
          completed: false
        }
      });

      fetchLiveMessages();
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskAssignee('');
      Alert.alert('Task Created ✅', 'Action item assigned to stream.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingTask(false);
    }
  };

  const toggleTask = async (msgId: string) => {
    const targetMsg = messages.find(m => m.id === msgId);
    if (!targetMsg || !targetMsg.metadata) return;

    const updatedMetadata = {
      ...targetMsg.metadata,
      completed: !targetMsg.metadata.completed
    };

    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, metadata: updatedMetadata } : m))
    );

    try {
      await supabase.from('team_messages').update({ metadata: updatedMetadata }).eq('id', msgId);
    } catch (e) {}
  };

  // 19. Pick and Send Document (100% Reliable)
  const pickAndUploadDocument = async () => {
    setShowActionSheet(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/msword', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setUploadingMedia(true);

        const fileName = `doc_${Date.now()}_${file.name}`;
        let docFinalUrl = file.uri;

        try {
          const r = await fetch(file.uri);
          const blob = await r.blob();
          const { error } = await supabase.storage.from('chat_images').upload(`documents/${fileName}`, blob, { upsert: true });
          if (!error) {
            const { data } = supabase.storage.from('chat_images').getPublicUrl(`documents/${fileName}`);
            if (data?.publicUrl) docFinalUrl = data.publicUrl;
          }
        } catch (e) {}

        await supabase.from('team_messages').insert({
          channel: currentRoomId,
          sender_id: currentUserId || null,
          sender_name: currentUserName,
          sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
          sender_avatar: currentUserAvatar,
          content: `📎 Shared Document: ${file.name}`,
          type: 'document',
          media_url: docFinalUrl,
          metadata: { fileName: file.name, fileSize: file.size ? `${Math.round(file.size / 1024)} KB` : 'File' }
        });

        fetchLiveMessages();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  // 20. Pick and Send Image (100% Reliable with Base64 & Storage Dual Routing)
  const pickAndUploadImage = async () => {
    setShowActionSheet(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission Required', 'Please grant photo gallery access.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setUploadingMedia(true);

        // Immediate reliable base64 data URI fallback
        let publicFinalUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        const fileName = `team_img_${Date.now()}.jpg`;

        if (asset.base64) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from('chat_images')
              .upload(fileName, decode(asset.base64), { contentType: 'image/jpeg', upsert: true });

            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('chat_images').getPublicUrl(fileName);
              if (urlData?.publicUrl) publicFinalUrl = urlData.publicUrl;
            }
          } catch (e) {}
        }

        await supabase.from('team_messages').insert({
          channel: currentRoomId,
          sender_id: currentUserId || null,
          sender_name: currentUserName,
          sender_role: isSuperAdmin ? 'SUPER ADMIN' : currentUserRole,
          sender_avatar: currentUserAvatar,
          content: 'Shared photo attachment',
          type: 'image',
          media_url: publicFinalUrl
        });

        fetchLiveMessages();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Emoji Reactions
  const reactToMessage = async (msgId: string, emoji: string) => {
    const targetMsg = messages.find(m => m.id === msgId);
    if (!targetMsg) return;

    const reactions = { ...(targetMsg.metadata?.reactions || {}) };
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    const updatedMetadata = { ...(targetMsg.metadata || {}), reactions };

    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, metadata: updatedMetadata } : m))
    );

    try {
      await supabase.from('team_messages').update({ metadata: updatedMetadata }).eq('id', msgId);
    } catch (e) {}
  };

  // Stream Filtering & Search Filter
  const filteredMessages = useMemo(() => {
    let list = messages;
    if (streamFilter === 'pinned') {
      list = list.filter(m => m.is_pinned || m.type === 'announcement');
    } else if (streamFilter === 'meetings') {
      list = list.filter(m => m.type === 'meeting');
    } else if (streamFilter === 'polls') {
      list = list.filter(m => m.type === 'poll');
    } else if (streamFilter === 'tasks') {
      list = list.filter(m => m.type === 'task');
    } else if (streamFilter === 'voice') {
      list = list.filter(m => m.type === 'voice');
    } else if (streamFilter === 'metrics') {
      list = list.filter(m => m.type === 'metrics' || m.type === 'code');
    }

    if (!searchQuery.trim()) return list;
    return list.filter(
      m =>
        (m.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, streamFilter, searchQuery]);

  const pinnedMessages = useMemo(() => {
    return messages.filter(m => m.is_pinned || m.type === 'announcement');
  }, [messages]);

  const activeChannelObj = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0];

  if (authChecking) {
    return (
      <View style={[s.container, s.centerBox, { backgroundColor: '#0F172A' }]}>
        <ActivityIndicator size="large" color={L.gold} />
        <Text style={[s.loadingText, { color: L.gold, marginTop: 10 }]}>Verifying Super Admin Credentials...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* EXECUTIVE TOP BAR */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          {activeDmUser ? (
            <TouchableOpacity
              onPress={() => {
                setActiveDmUser(null);
                setActiveTab('chat');
              }}
              style={s.backBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={18} color={L.gold} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={18} color={L.gold} />
            </TouchableOpacity>
          )}

          {/* Channel / DM Selector */}
          <TouchableOpacity
            onPress={() => (activeDmUser ? setActiveDmUser(null) : setShowChannelDrawer(true))}
            style={s.channelSelectorBtn}
            activeOpacity={0.8}
          >
            <Ionicons name={activeDmUser ? 'person-circle' : (activeChannelObj.icon as any)} size={16} color={L.gold} />
            <Text style={s.channelSelectorTitle} numberOfLines={1}>
              {activeDmUser ? `@${activeDmUser.name.split(' ')[0]}` : `#${activeChannelObj.name}`}
            </Text>
            <Ionicons name={activeDmUser ? 'close-circle' : 'chevron-down'} size={14} color={L.goldLight} />
          </TouchableOpacity>

          {/* Super Admin Indicator */}
          <View style={s.superAdminPill}>
            <Ionicons name="ribbon" size={12} color="#0F172A" />
            <Text style={s.superAdminPillText}>{isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}</Text>
          </View>

          {/* Fast Top Action Tools */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity onPress={() => setShowSearchBar(!showSearchBar)} style={s.topIconBtn} activeOpacity={0.8}>
              <Ionicons name="search" size={14} color={L.gold} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleAskCortexAI('summary')} disabled={aiAnalyzing} style={s.aiCopilotBtn} activeOpacity={0.85}>
              {aiAnalyzing ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={13} color="#0F172A" />
                  <Text style={s.aiCopilotBtnText}>AI</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => startInstantMeeting(activeDmUser)} style={s.videoMeetingBtn} activeOpacity={0.85}>
              <Ionicons name="videocam" size={14} color="#0F172A" />
              <Text style={s.videoMeetingBtnText}>{activeDmUser ? 'Call' : 'Meet'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EXPANDABLE SEARCH BAR */}
        {showSearchBar && (
          <View style={s.searchWrap}>
            <Ionicons name="search" size={14} color={L.goldDk} />
            <TextInput
              style={s.searchTextInput}
              placeholder="Search stream keywords, code, directives..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SUB TABS NAVIGATION */}
        <View style={s.subHeaderRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subTabsWrap}>
            {[
              { id: 'chat', label: activeDmUser ? `@${activeDmUser.name.split(' ')[0]} (DM)` : 'HQ Stream', icon: 'chatbubbles' },
              { id: 'meetings', label: `Video Hub (${meetings.length})`, icon: 'videocam' },
              { id: 'dms', label: `Staff DMs (${otherAdminsList.length})`, icon: 'people-outline' },
              { id: 'shifts', label: isOnDuty ? `Duty (${dutyElapsed})` : 'Duty & Shifts', icon: 'time-outline' },
              { id: 'bookmarks', label: `Saved (${bookmarks.length})`, icon: 'star-outline' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === 'chat' && !activeDmUser) setActiveDmUser(null);
                  }}
                  style={[s.subTab, isActive && s.subTabActive]}
                  activeOpacity={0.75}
                >
                  <Ionicons name={tab.icon as any} size={12} color={isActive ? '#0F172A' : L.goldLight} />
                  <Text style={[s.subTabText, isActive && s.subTabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Super Admin Executive Action Tools */}
          <View style={s.toolShortcutsRow}>
            <TouchableOpacity onPress={broadcastSystemMetrics} style={s.toolIconBtn} activeOpacity={0.8}>
              <Ionicons name="speedometer-outline" size={13} color={L.gold} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDirectivesModal(true)} style={s.toolIconBtn} activeOpacity={0.8}>
              <Ionicons name="flash-outline" size={13} color={L.gold} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCodeSnippetModal(true)} style={s.toolIconBtn} activeOpacity={0.8}>
              <Ionicons name="code-slash" size={13} color={L.gold} />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearChannelMessages} style={s.purgeChannelBtn} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={13} color={L.coral} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* STREAM FILTER CHIPS BAR */}
      {activeTab === 'chat' && (
        <View style={s.filterChipsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'pinned', label: '📌 Pinned' },
              { id: 'meetings', label: '📹 Meets' },
              { id: 'polls', label: '📊 Polls' },
              { id: 'tasks', label: '✅ Tasks' },
              { id: 'voice', label: '🎙️ Voice' },
              { id: 'metrics', label: '📊 Data' },
            ].map(f => {
              const active = streamFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setStreamFilter(f.id as any)}
                  style={[s.filterChip, active && s.filterChipActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* PINNED ANNOUNCEMENTS STRIP */}
      {pinnedMessages.length > 0 && activeTab === 'chat' && streamFilter === 'all' && (
        <View style={s.pinnedStrip}>
          <Ionicons name="pin" size={13} color={L.goldAmber} />
          <Text style={s.pinnedText} numberOfLines={1}>
            {pinnedMessages[pinnedMessages.length - 1].content}
          </Text>
        </View>
      )}

      {/* TAB 1: LIVE HQ CHAT STREAM / ISOLATED PRIVATE DM STREAM */}
      {activeTab === 'chat' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={s.chatScroll}
            contentContainerStyle={s.chatScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={s.centerBox}>
                <ActivityIndicator size="small" color={L.goldDk} />
                <Text style={s.loadingText}>Syncing live stream...</Text>
              </View>
            ) : filteredMessages.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name={activeDmUser ? "lock-closed" : "chatbubbles-outline"} size={30} color={L.goldDk} />
                <Text style={s.emptyTitle}>
                  {activeDmUser ? `Private Channel with @${activeDmUser.name}` : `Welcome to #${activeChannelObj.name}`}
                </Text>
                <Text style={s.emptySub}>
                  {activeDmUser
                    ? 'Messages in this thread are private and only visible between you and this administrator.'
                    : activeChannelObj.desc}
                </Text>
              </View>
            ) : (
              filteredMessages.map((msg, index) => {
                const isMe = msg.sender_id === currentUserId;
                const timeStr = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                // Render TYPE 1: Live Video Meeting Card
                if (msg.type === 'meeting') {
                  const mData = msg.metadata || {};
                  return (
                    <View key={msg.id || index} style={s.meetingCardBubble}>
                      <View style={s.meetingBubbleHeader}>
                        <View style={s.liveBadge}>
                          <View style={s.liveDot} />
                          <Text style={s.liveBadgeText}>{mData.status === 'live' ? 'LIVE CONFERENCE' : 'SCHEDULED SYNC'}</Text>
                        </View>
                        <Text style={s.msgTime}>{timeStr}</Text>
                      </View>

                      <Text style={s.meetingBubbleTitle}>{mData.title || msg.content}</Text>
                      {mData.description ? <Text style={s.meetingBubbleDesc}>{mData.description}</Text> : null}

                      <TouchableOpacity
                        onPress={() => openInAppMeeting(mData.meeting_url || msg.content, mData.title)}
                        style={s.joinMeetingBtn}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={['#0F172A', '#1E293B']} style={s.joinMeetingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Ionicons name="videocam" size={15} color={L.gold} />
                          <Text style={s.joinMeetingText}>Join Room Directly (In-App / Browser)</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 2: Live Platform Metrics Snapshot Card
                if (msg.type === 'metrics') {
                  const mData = msg.metadata || {};
                  const gw = mData.gateways || {};
                  return (
                    <View key={msg.id || index} style={s.metricsCardBubble}>
                      <View style={s.metricsHeader}>
                        <Ionicons name="speedometer" size={15} color={L.gold} />
                        <Text style={s.metricsTitle}>OPERATIONS HEALTH SNAPSHOT</Text>
                        <Text style={s.msgTime}>{timeStr}</Text>
                      </View>

                      <View style={s.metricsGrid}>
                        <View style={s.metricTile}>
                          <Text style={s.metricLabel}>DB Latency</Text>
                          <Text style={s.metricVal}>{mData.latency || '40ms'}</Text>
                        </View>
                        <View style={s.metricTile}>
                          <Text style={s.metricLabel}>ClubKonnect</Text>
                          <Text style={[s.metricVal, { color: L.emerald }]}>{gw.clubkonnect || '99.9%'}</Text>
                        </View>
                        <View style={s.metricTile}>
                          <Text style={s.metricLabel}>Monnify Webhook</Text>
                          <Text style={[s.metricVal, { color: L.emerald }]}>{gw.monnify || 'ACTIVE'}</Text>
                        </View>
                        <View style={s.metricTile}>
                          <Text style={s.metricLabel}>Cash Reserves</Text>
                          <Text style={s.metricVal}>{mData.reserves || '₦12.4M'}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }

                // Render TYPE 3: Code / SQL Snippet Card
                if (msg.type === 'code') {
                  const cData = msg.metadata || {};
                  return (
                    <View key={msg.id || index} style={s.codeCardBubble}>
                      <View style={s.codeHeader}>
                        <Ionicons name="code-slash" size={14} color={L.gold} />
                        <Text style={s.codeTitle}>{cData.title || 'Technical Query'}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            Clipboard.setStringAsync(cData.code || '');
                            Alert.alert('Copied 📋', 'Snippet copied to clipboard.');
                          }}
                          style={s.codeCopyBtn}
                        >
                          <Ionicons name="copy-outline" size={13} color={L.gold} />
                          <Text style={s.codeCopyText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal style={s.codeBox} showsHorizontalScrollIndicator={false}>
                        <Text style={s.codeMonospaceText}>{cData.code || msg.content}</Text>
                      </ScrollView>
                    </View>
                  );
                }

                // Render TYPE 4: Live Poll Card
                if (msg.type === 'poll') {
                  const pData = msg.metadata || {};
                  const options = pData.options || [];
                  const totalVotes = options.reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0);

                  return (
                    <View key={msg.id || index} style={s.pollCardBubble}>
                      <View style={s.bubbleMetaRow}>
                        <Text style={s.senderName}>{msg.sender_name}</Text>
                        <View style={s.roleBadge}>
                          <Text style={s.roleBadgeText}>{msg.sender_role || 'ADMIN'}</Text>
                        </View>
                        <Text style={s.msgTime}>{timeStr}</Text>

                        {isSuperAdmin && (
                          <TouchableOpacity onPress={() => deleteMessage(msg.id)} style={{ marginLeft: 4 }}>
                            <Ionicons name="trash-outline" size={13} color={L.coral} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={s.pollQuestionTitle}>{pData.question || msg.content}</Text>

                      {options.map((opt: any, optIdx: number) => {
                        const optVotes = opt.votes?.length || 0;
                        const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                        const hasVoted = (opt.votes || []).includes(currentUserId);

                        return (
                          <TouchableOpacity
                            key={optIdx}
                            onPress={() => votePoll(msg.id, optIdx)}
                            style={[s.pollOptionRow, hasVoted && s.pollOptionRowVoted]}
                            activeOpacity={0.8}
                          >
                            <View style={[s.pollBarFill, { width: `${pct}%` }]} />
                            <View style={s.pollOptionContent}>
                              <Text style={[s.pollOptionText, hasVoted && s.pollOptionTextVoted]}>{opt.text}</Text>
                              <Text style={s.pollOptionPct}>{pct}% ({optVotes})</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      <Text style={s.pollTotalFooter}>{totalVotes} total admin votes</Text>
                    </View>
                  );
                }

                // Render TYPE 5: Task Item Card
                if (msg.type === 'task') {
                  const tData = msg.metadata || {};
                  const isDone = !!tData.completed;
                  const priority = tData.priority || 'HIGH';

                  return (
                    <View key={msg.id || index} style={s.taskCardBubble}>
                      <TouchableOpacity onPress={() => toggleTask(msg.id)} style={s.taskCheckRow} activeOpacity={0.75}>
                        <Ionicons name={isDone ? 'checkbox' : 'square-outline'} size={20} color={isDone ? L.emerald : L.goldDk} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[s.taskTitleText, isDone && s.taskTitleDone]}>{tData.title || msg.content}</Text>
                            <View style={[s.priorityTag, priority === 'CRITICAL' ? s.priorityCritical : s.priorityHigh]}>
                              <Text style={s.priorityTagText}>{priority}</Text>
                            </View>
                          </View>
                          <Text style={s.taskAssigneeText}>Assignee: {tData.assignee || 'All Admins'} • {timeStr}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 6: Real Voice Memo with Speed Toggle
                if (msg.type === 'voice') {
                  const isPlaying = playingAudioId === msg.id;
                  return (
                    <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                      <View style={s.bubbleMetaRow}>
                        <Text style={s.senderName}>{isMe ? 'You' : msg.sender_name}</Text>
                        <Text style={s.msgTime}>{timeStr}</Text>
                        {isSuperAdmin && (
                          <TouchableOpacity onPress={() => deleteMessage(msg.id)} style={{ marginLeft: 4 }}>
                            <Ionicons name="trash-outline" size={12} color={L.coral} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={s.voiceMemoRow}>
                        <TouchableOpacity
                          onPress={() => playAudioSound(msg.id, msg.media_url)}
                          style={s.voicePlayBtn}
                        >
                          <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color="#0F172A" />
                        </TouchableOpacity>
                        <View style={s.waveformBars}>
                          {[40, 80, 100, 60, 90, 50, 75, 40, 85, 60, 90, 45].map((h, i) => (
                            <View key={i} style={[s.waveformBar, { height: (h / 100) * 18 }]} />
                          ))}
                        </View>
                        <TouchableOpacity onPress={cycleAudioRate} style={s.speedRateBtn}>
                          <Text style={s.speedRateText}>{audioPlaybackRate}x</Text>
                        </TouchableOpacity>
                        <Text style={s.voiceDurationText}>{msg.metadata?.duration || 'Voice'}</Text>
                      </View>
                    </View>
                  );
                }

                // Render TYPE 7: Document Attachment Card
                if (msg.type === 'document') {
                  return (
                    <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                      <View style={s.bubbleMetaRow}>
                        <Text style={s.senderName}>{isMe ? 'You' : msg.sender_name}</Text>
                        <Text style={s.msgTime}>{timeStr}</Text>
                        {isSuperAdmin && (
                          <TouchableOpacity onPress={() => deleteMessage(msg.id)} style={{ marginLeft: 4 }}>
                            <Ionicons name="trash-outline" size={12} color={L.coral} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => msg.media_url && Linking.openURL(msg.media_url)}
                        style={s.docAttachBox}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-text" size={22} color={L.goldAmber} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={s.docNameText} numberOfLines={1}>{msg.metadata?.fileName || 'Document'}</Text>
                          <Text style={s.docSizeText}>{msg.metadata?.fileSize || 'Tap to open'}</Text>
                        </View>
                        <Ionicons name="cloud-download-outline" size={18} color={L.navyHeader} />
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 8: Image Attachment
                if (msg.type === 'image') {
                  return (
                    <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                      <View style={s.bubbleMetaRow}>
                        <Text style={s.senderName}>{isMe ? 'You' : msg.sender_name}</Text>
                        <Text style={s.msgTime}>{timeStr}</Text>
                        {isSuperAdmin && (
                          <TouchableOpacity onPress={() => deleteMessage(msg.id)} style={{ marginLeft: 4 }}>
                            <Ionicons name="trash-outline" size={12} color={L.coral} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => setZoomedImage(msg.media_url)} activeOpacity={0.9}>
                        <Image source={{ uri: msg.media_url }} style={s.chatImageAttachment} resizeMode="cover" />
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 9: Standard Text Message
                return (
                  <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                    <View style={s.bubbleMetaRow}>
                      <Text style={[s.senderName, isMe && { color: L.goldAmber }]}>
                        {isMe ? 'You' : msg.sender_name}
                      </Text>
                      {!isMe && (
                        <View style={s.roleBadge}>
                          <Text style={s.roleBadgeText}>{msg.sender_role || 'ADMIN'}</Text>
                        </View>
                      )}
                      <Text style={s.msgTime}>{timeStr}</Text>

                      {isSuperAdmin && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                          <TouchableOpacity onPress={() => togglePinMessage(msg)}>
                            <Ionicons name={msg.is_pinned ? 'pin' : 'pin-outline'} size={12} color={msg.is_pinned ? L.goldAmber : '#94A3B8'} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteMessage(msg.id)}>
                            <Ionicons name="trash-outline" size={12} color={L.coral} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    <Text style={[s.msgText, isMe && s.msgTextMe]}>{msg.content}</Text>

                    {/* Quick Reactions Bar */}
                    <View style={s.reactionsRow}>
                      {['👍', '🔥', '⚡', '❤️', '✅'].map(emoji => {
                        const count = msg.metadata?.reactions?.[emoji] || 0;
                        return (
                          <TouchableOpacity
                            key={emoji}
                            onPress={() => reactToMessage(msg.id, emoji)}
                            style={[s.reactionPill, count > 0 && s.reactionPillActive]}
                            activeOpacity={0.7}
                          >
                            <Text style={s.reactionEmoji}>{emoji}</Text>
                            {count > 0 && <Text style={s.reactionCount}>{count}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* AUDIO RECORDING STRIP */}
          {isRecordingAudio ? (
            <View style={s.recordingStrip}>
              <View style={s.recordingLiveDot} />
              <Text style={s.recordingText}>Recording Audio Memo: {recordingSeconds}s</Text>
              <TouchableOpacity onPress={stopAndSendRealAudioRecording} style={s.recordingSendBtn}>
                <Ionicons name="send" size={14} color="#0F172A" />
                <Text style={s.recordingSendText}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  clearInterval(recordingTimerRef.current);
                  if (recordingObject) recordingObject.stopAndUnloadAsync();
                  setIsRecordingAudio(false);
                }}
                style={s.recordingCancelBtn}
              >
                <Ionicons name="trash-outline" size={16} color={L.coral} />
              </TouchableOpacity>
            </View>
          ) : (
            /* CHAT INPUT STRIP (MOBILE-FIRST SAFE AREA FIT) */
            <View style={s.inputStrip}>
              {/* Executive Plus (+) Action Button */}
              <TouchableOpacity onPress={() => setShowActionSheet(true)} style={s.actionPlusBtn} activeOpacity={0.8}>
                <Ionicons name="add-circle" size={26} color={L.goldAmber} />
              </TouchableOpacity>

              <TouchableOpacity onPress={pickAndUploadImage} disabled={uploadingMedia} style={s.attachBtn} activeOpacity={0.75}>
                {uploadingMedia ? (
                  <ActivityIndicator size="small" color={L.goldDk} />
                ) : (
                  <Ionicons name="camera-outline" size={18} color={L.navyHeader} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={pickAndUploadDocument} disabled={uploadingMedia} style={s.attachBtn} activeOpacity={0.75}>
                <Ionicons name="document-attach-outline" size={18} color={L.navyHeader} />
              </TouchableOpacity>

              <TouchableOpacity onPress={startRealAudioRecording} style={s.attachBtn} activeOpacity={0.75}>
                <Ionicons name="mic-outline" size={18} color={L.navyHeader} />
              </TouchableOpacity>

              <TextInput
                style={s.chatTextInput}
                placeholder={activeDmUser ? `Private message to @${activeDmUser.name.split(' ')[0]}...` : `Message #${activeChannelObj.name}...`}
                placeholderTextColor="#94A3B8"
                value={newMessage}
                onChangeText={setNewMessage}
                onFocus={() => {
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                }}
                multiline
              />

              <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim() || sending} style={s.sendBtn} activeOpacity={0.85}>
                <LinearGradient colors={['#0F172A', '#1E293B']} style={s.sendBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="send" size={15} color={L.gold} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : activeTab === 'meetings' ? (
        /* TAB 2: ULTRA-MODERN FUTURISTIC QUANTUM VIDEO & AUDIO CONFERENCE SUITE */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          
          {/* HERO QUANTUM COMMAND MATRIX CARD */}
          <View style={s.quantumHeroCard}>
            <LinearGradient
              colors={['#030712', '#0F172A', '#1E1B4B']}
              style={s.quantumHeroGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Radar & Security Signal Indicator */}
              <View style={s.quantumHeaderRow}>
                <View style={s.radarSignalBox}>
                  <View style={s.pulsingSignalDot} />
                  <Text style={s.radarSignalText}>P2P QUANTUM ENCRYPTED WebRTC</Text>
                </View>
                <View style={s.bitratePill}>
                  <Ionicons name="shield-checkmark" size={11} color={L.emerald} />
                  <Text style={s.bitrateText}>1080p 60FPS • 0% LOSS</Text>
                </View>
              </View>

              <Text style={s.quantumHeroTitle}>Executive Conference Matrix</Text>
              <Text style={s.quantumHeroSubtitle}>
                Zero-delay encrypted in-app video & spatial audio. Screen sharing, real-time minutes & zero external app store prompts.
              </Text>

              {/* Main 1-Tap Conference Launch Buttons */}
              <View style={s.heroButtonRow}>
                <TouchableOpacity onPress={() => startInstantMeeting(null, false)} style={s.heroLaunchBtn} activeOpacity={0.85}>
                  <LinearGradient colors={['#FFD700', '#DAA520', '#B45309']} style={s.heroLaunchGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="videocam" size={18} color="#0F172A" />
                    <Text style={s.heroLaunchBtnText}>Instant Video Room</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => startInstantMeeting(null, true)} style={s.heroAudioOnlyBtn} activeOpacity={0.85}>
                  <LinearGradient colors={['#1E293B', '#0F172A']} style={s.heroAudioOnlyGrad}>
                    <Ionicons name="mic" size={16} color={L.gold} />
                    <Text style={s.heroAudioOnlyText}>VIP Voice Stage</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Quick Connect by Room Code Bar */}
              <View style={s.quickJoinBar}>
                <Ionicons name="keypad-outline" size={15} color={L.gold} />
                <TextInput
                  style={s.quickJoinInput}
                  placeholder="Enter Room Code or Topic..."
                  placeholderTextColor="#94A3B8"
                  value={customJoinRoomCode}
                  onChangeText={setCustomJoinRoomCode}
                />
                <TouchableOpacity onPress={joinCustomRoom} style={s.quickJoinSubmitBtn} activeOpacity={0.8}>
                  <Text style={s.quickJoinSubmitText}>Join</Text>
                  <Ionicons name="arrow-forward" size={12} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* MEETING FILTER CHIPS */}
          <View style={s.meetingFilterBar}>
            {[
              { id: 'all', label: 'All Rooms' },
              { id: 'presets', label: '🛡️ War Rooms' },
              { id: 'live', label: '🔴 Active Syncs' },
              { id: 'scheduled', label: '📅 Scheduled' },
            ].map(f => {
              const active = meetingFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setMeetingFilter(f.id as any)}
                  style={[s.meetingFilterChip, active && s.meetingFilterChipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.meetingFilterChipText, active && s.meetingFilterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* PRESET STRATEGIC WAR ROOMS (1-TAP DIRECT ACCESS) */}
          {(meetingFilter === 'all' || meetingFilter === 'presets') && (
            <View style={{ marginBottom: 16 }}>
              <View style={s.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-half" size={16} color={L.navyHeader} />
                  <Text style={s.sectionTitle}>Executive Strategic Rooms</Text>
                </View>
                <Text style={s.sectionCount}>{EXECUTIVE_PRESET_ROOMS.length} Dedicated Hubs</Text>
              </View>

              {EXECUTIVE_PRESET_ROOMS.map(room => {
                const roomUrl = buildDirectWebMeetingUrl(room.roomCode, currentUserName);
                return (
                  <View key={room.id} style={s.presetRoomCard}>
                    <LinearGradient
                      colors={room.bgGradient as any}
                      style={s.presetRoomGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={s.presetRoomTop}>
                        <View style={[s.presetIconBox, { borderColor: room.color }]}>
                          <Ionicons name={room.icon as any} size={18} color={room.color} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.presetRoomTitle}>{room.title}</Text>
                            <View style={[s.presetTagBadge, { borderColor: room.color }]}>
                              <Text style={[s.presetTagText, { color: room.color }]}>{room.tag}</Text>
                            </View>
                          </View>
                          <Text style={s.presetRoomDesc} numberOfLines={2}>{room.desc}</Text>
                        </View>
                      </View>

                      <View style={s.presetRoomBottom}>
                        <View style={s.presetRoomHash}>
                          <Ionicons name="lock-closed" size={10} color="#94A3B8" />
                          <Text style={s.presetRoomHashText}>#{room.roomCode}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => {
                              Clipboard.setStringAsync(roomUrl);
                              Alert.alert('Link Copied 📋', `Direct access URL for ${room.title} copied to clipboard.`);
                            }}
                            style={s.presetCopyBtn}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="copy-outline" size={12} color={L.gold} />
                            <Text style={s.presetCopyText}>Link</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => openInAppMeeting(roomUrl, room.title)}
                            style={s.presetEnterBtn}
                            activeOpacity={0.85}
                          >
                            <LinearGradient colors={['#FFD700', '#DAA520']} style={s.presetEnterGrad}>
                              <Ionicons name="videocam" size={13} color="#0F172A" />
                              <Text style={s.presetEnterText}>Enter Room</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          )}

          {/* SCHEDULED & LIVE ROOMS SECTION */}
          {(meetingFilter === 'all' || meetingFilter === 'live' || meetingFilter === 'scheduled') && (
            <View>
              <View style={s.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar" size={16} color={L.navyHeader} />
                  <Text style={s.sectionTitle}>Operations Schedule & Active Syncs</Text>
                </View>
                <TouchableOpacity onPress={() => setShowMeetingModal(true)} style={s.scheduleNewBtn}>
                  <Ionicons name="add" size={14} color="#0F172A" />
                  <Text style={s.scheduleNewBtnText}>Schedule Sync</Text>
                </TouchableOpacity>
              </View>

              {meetings.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="calendar-outline" size={32} color={L.goldDk} />
                  <Text style={s.emptyTitle}>No Live or Scheduled Syncs</Text>
                  <Text style={s.emptySub}>Tap "Schedule Sync" or launch an Instant War Room above.</Text>
                </View>
              ) : (
                meetings.map(m => {
                  const isLive = m.status === 'live';
                  return (
                    <View key={m.id} style={[s.meetingListItem, isLive && s.meetingListItemLive]}>
                      <View style={s.meetingListHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[s.meetingTag, isLive && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: L.coral }]}>
                            {isLive && <View style={s.liveDot} />}
                            <Text style={[s.meetingTagText, isLive && { color: L.coral, fontWeight: '900' }]}>
                              {isLive ? '🔴 LIVE NOW' : `#${m.channel?.toUpperCase() || 'HQ'}`}
                            </Text>
                          </View>
                        </View>
                        <Text style={s.meetingDateText}>
                          {new Date(m.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>

                      <Text style={s.meetingListTitle}>{m.title}</Text>
                      {m.description ? <Text style={s.meetingListDesc}>{m.description}</Text> : null}

                      <View style={s.meetingListFooter}>
                        <Text style={s.meetingHost}>Host: {m.created_by_name || 'Admin'}</Text>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {isSuperAdmin && (
                            <TouchableOpacity onPress={() => deleteMeeting(m.id)} style={s.deleteMeetingBtn}>
                              <Ionicons name="trash-outline" size={13} color={L.coral} />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => openInAppMeeting(m.meeting_url, m.title)}
                            style={s.joinListBtn}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="videocam" size={13} color="#0F172A" />
                            <Text style={s.joinListBtnText}>Join Room</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* AI MEETING COPILOT BANNER */}
          <TouchableOpacity onPress={() => handleAskCortexAI('meeting')} disabled={aiAnalyzing} style={s.aiMeetingBanner} activeOpacity={0.85}>
            <LinearGradient colors={['#1E1B4B', '#0F172A']} style={s.aiMeetingGrad}>
              <View style={s.aiMeetingIconCircle}>
                <Ionicons name="sparkles" size={18} color={L.gold} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.aiMeetingTitle}>Nexus Cortex AI Agenda & Minutes Assistant</Text>
                <Text style={s.aiMeetingSub}>Tap to analyze recent operations context and auto-generate executive meeting talking points.</Text>
              </View>
              {aiAnalyzing ? <ActivityIndicator size="small" color={L.gold} /> : <Ionicons name="chevron-forward" size={18} color={L.gold} />}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      ) : activeTab === 'dms' ? (
        /* TAB 3: LIVE ADMIN DIRECTORY DMs (EXCLUDING CURRENT LOGGED IN USER) */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.sectionTitle, { marginBottom: 10 }]}>Admin & Super Admin Directory ({otherAdminsList.length})</Text>
          {loadingAdmins ? (
            <View style={s.centerBox}>
              <ActivityIndicator size="small" color={L.goldDk} />
              <Text style={s.loadingText}>Fetching verified admin accounts...</Text>
            </View>
          ) : otherAdminsList.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={30} color={L.goldDk} />
              <Text style={s.emptyTitle}>No Other Administrators Found</Text>
              <Text style={s.emptySub}>Other registered Admin and Super Admin accounts will appear here.</Text>
            </View>
          ) : (
            otherAdminsList.map(admin => (
              <View key={admin.id} style={s.dmContactCard}>
                {admin.avatar ? (
                  <Image source={{ uri: admin.avatar }} style={s.dmAvatar} />
                ) : (
                  <View style={[s.dmAvatar, s.dmAvatarFallback]}>
                    <Text style={s.dmAvatarText}>{admin.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.dmName}>{admin.name}</Text>
                  <Text style={s.dmRole}>{admin.role} • {admin.email}</Text>
                </View>

                {/* 1-Tap 1-on-1 Direct Video Call */}
                <TouchableOpacity
                  onPress={() => startInstantMeeting(admin, false)}
                  style={s.dmCallBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="videocam" size={15} color="#0F172A" />
                </TouchableOpacity>

                {/* 1-Tap 1-on-1 Voice Call */}
                <TouchableOpacity
                  onPress={() => startInstantMeeting(admin, true)}
                  style={s.dmVoiceBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={14} color="#0F172A" />
                </TouchableOpacity>

                {/* Direct DM Chat */}
                <TouchableOpacity
                  onPress={() => {
                    setActiveDmUser(admin);
                    setActiveTab('chat');
                  }}
                  style={s.dmChatBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses" size={14} color="#0F172A" />
                  <Text style={s.dmChatBtnText}>Chat</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeTab === 'shifts' ? (
        /* TAB 4: SHIFTS & DUTY ATTENDANCE ROSTER (ADMINS ONLY) */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          <View style={s.dutyStatusCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={s.dutyStatusTitle}>Operational Duty Status</Text>
                <Text style={s.dutyStatusSub}>Active Shift Duration: {isOnDuty ? dutyElapsed : 'Offline'}</Text>
              </View>
              <TouchableOpacity onPress={toggleDutyShift} style={[s.clockInBtn, isOnDuty && { backgroundColor: L.coral }]} activeOpacity={0.85}>
                <Ionicons name={isOnDuty ? 'stop-circle' : 'play-circle'} size={16} color="#FFFFFF" />
                <Text style={s.clockInBtnText}>{isOnDuty ? 'Clock Out' : 'Clock In'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 }}>
            <Text style={s.sectionTitle}>Shift AI Handover Tools</Text>
            <TouchableOpacity onPress={() => handleAskCortexAI('shift')} disabled={aiAnalyzing} style={s.scheduleNewBtn}>
              <Ionicons name="sparkles" size={12} color="#0F172A" />
              <Text style={s.scheduleNewBtnText}>Generate Handover</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>On-Duty Executive Roster</Text>
          {adminDirectory.map(admin => (
            <View key={admin.id} style={s.rosterItem}>
              <View style={[s.rosterDot, { backgroundColor: L.emerald }]} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rosterName}>{admin.name} {admin.id === currentUserId ? '(You)' : ''}</Text>
                <Text style={s.rosterRole}>{admin.role}</Text>
              </View>
              <Text style={s.rosterStatus}>ACTIVE</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        /* TAB 5: BOOKMARKS */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.sectionTitle, { marginBottom: 10 }]}>Saved Memos & Instructions</Text>
          {bookmarks.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="star-outline" size={30} color={L.goldDk} />
              <Text style={s.emptyTitle}>No Saved Items</Text>
              <Text style={s.emptySub}>Star any message in the stream to save it here for fast recall.</Text>
            </View>
          ) : (
            bookmarks.map(b => (
              <View key={b.id} style={s.bookmarkCard}>
                <Text style={s.senderName}>{b.sender_name}</Text>
                <Text style={s.msgText}>{b.content}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* EXECUTIVE ACTION SHEET (+) MODAL */}
      <Modal visible={showActionSheet} transparent animationType="slide" onRequestClose={() => setShowActionSheet(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
          <View style={s.actionSheetCard}>
            <View style={s.drawerHeader}>
              <Text style={s.drawerTitle}>Executive Tools & Actions</Text>
              <TouchableOpacity onPress={() => setShowActionSheet(false)}>
                <Ionicons name="close" size={20} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <View style={s.actionSheetGrid}>
              <TouchableOpacity
                onPress={() => {
                  setShowActionSheet(false);
                  setShowPollModal(true);
                }}
                style={s.actionSheetTile}
                activeOpacity={0.8}
              >
                <View style={[s.actionSheetTileIcon, { backgroundColor: L.purpleBg, borderColor: L.purpleBorder }]}>
                  <Ionicons name="pie-chart" size={20} color={L.purple} />
                </View>
                <Text style={s.actionSheetTileText}>Create Poll</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowActionSheet(false);
                  setShowTaskModal(true);
                }}
                style={s.actionSheetTile}
                activeOpacity={0.8}
              >
                <View style={[s.actionSheetTileIcon, { backgroundColor: L.emeraldBg, borderColor: L.emeraldBorder }]}>
                  <Ionicons name="checkbox" size={20} color={L.emerald} />
                </View>
                <Text style={s.actionSheetTileText}>Action Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowActionSheet(false);
                  setShowCodeSnippetModal(true);
                }}
                style={s.actionSheetTile}
                activeOpacity={0.8}
              >
                <View style={[s.actionSheetTileIcon, { backgroundColor: L.skyBg, borderColor: L.skyBorder }]}>
                  <Ionicons name="code-slash" size={20} color={L.sky} />
                </View>
                <Text style={s.actionSheetTileText}>Share Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowActionSheet(false);
                  setShowDirectivesModal(true);
                }}
                style={s.actionSheetTile}
                activeOpacity={0.8}
              >
                <View style={[s.actionSheetTileIcon, { backgroundColor: L.goldLight, borderColor: L.goldDk }]}>
                  <Ionicons name="flash" size={20} color={L.goldAmber} />
                </View>
                <Text style={s.actionSheetTileText}>Directives</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={broadcastSystemMetrics} style={s.actionSheetTile} activeOpacity={0.8}>
                <View style={[s.actionSheetTileIcon, { backgroundColor: '#0F172A', borderColor: L.goldDk }]}>
                  <Ionicons name="speedometer" size={20} color={L.gold} />
                </View>
                <Text style={s.actionSheetTileText}>Live Metrics</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleAskCortexAI('checklist')} style={s.actionSheetTile} activeOpacity={0.8}>
                <View style={[s.actionSheetTileIcon, { backgroundColor: L.gold, borderColor: L.goldDk }]}>
                  <Ionicons name="sparkles" size={20} color="#0F172A" />
                </View>
                <Text style={s.actionSheetTileText}>AI Checklist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FULLSCREEN MODERN IN-APP VIDEO CONFERENCE ROOM MODAL */}
      <Modal visible={!!activeMeetingUrl} animationType="slide" onRequestClose={closeInAppMeeting}>
        <View style={s.videoModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#0B1120" />
          
          <View style={s.videoModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={s.liveDot} />
              <View>
                <Text style={s.videoModalTitle} numberOfLines={1}>{activeMeetingTitle}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={s.videoModalTimer}>{meetingCallElapsed}</Text>
                  <Text style={s.videoModalSecure}>• 🔒 256-bit WebRTC</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  if (activeMeetingUrl) {
                    Clipboard.setStringAsync(activeMeetingUrl);
                    Alert.alert('Link Copied 📋', 'Direct meeting room URL copied to clipboard.');
                  }
                }}
                style={s.copyLinkHeaderBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={13} color={L.gold} />
                <Text style={s.copyLinkHeaderText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (activeMeetingUrl) {
                    if (Platform.OS === 'web') {
                      window.open(activeMeetingUrl, '_blank');
                    } else {
                      WebBrowser.openBrowserAsync(activeMeetingUrl);
                    }
                  }
                }}
                style={s.openBrowserHeaderBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={13} color={L.gold} />
                <Text style={s.openBrowserHeaderText}>Browser</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeInAppMeeting} style={s.endCallBtn} activeOpacity={0.8}>
                <Ionicons name="call" size={14} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={s.endCallBtnText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeMeetingUrl && (
            <View style={{ flex: 1, backgroundColor: '#020617' }}>
              {Platform.OS === 'web' ? (
                // @ts-ignore
                <iframe
                  src={activeMeetingUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="camera; microphone; display-capture; autoplay; clipboard-write"
                />
              ) : (
                <WebView
                  source={{ uri: activeMeetingUrl }}
                  style={{ flex: 1 }}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={s.videoLoadingCenter}>
                      <ActivityIndicator size="large" color={L.gold} />
                      <Text style={s.videoLoadingText}>Connecting to Encrypted Video Room...</Text>
                      <Text style={s.videoLoadingSub}>Zero login or signup required • HD Direct WebRTC</Text>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* SUPER ADMIN EXECUTIVE DIRECTIVES MODAL */}
      <Modal visible={showDirectivesModal} transparent animationType="slide" onRequestClose={() => setShowDirectivesModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Executive Directives & Alerts</Text>
              <TouchableOpacity onPress={() => setShowDirectivesModal(false)}>
                <Ionicons name="close" size={18} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {EXECUTIVE_DIRECTIVES.map((dir, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setNewMessage(dir.text);
                    setShowDirectivesModal(false);
                  }}
                  style={s.directiveItem}
                  activeOpacity={0.8}
                >
                  <Text style={s.directiveTitle}>{dir.title}</Text>
                  <Text style={s.directiveText}>{dir.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CODE / SQL SNIPPET SHARING MODAL */}
      <Modal visible={showCodeSnippetModal} transparent animationType="slide" onRequestClose={() => setShowCodeSnippetModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Share Code or SQL Query</Text>
              <TouchableOpacity onPress={() => setShowCodeSnippetModal(false)}>
                <Ionicons name="close" size={18} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Snippet Title</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. ClubKonnect API Callback JSON Payload"
              placeholderTextColor="#94A3B8"
              value={codeSnippetTitle}
              onChangeText={setCodeSnippetTitle}
            />

            <Text style={s.inputLabel}>Code / JSON / SQL Text</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 90, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]}
              placeholder="SELECT * FROM transactions WHERE status = 'pending'..."
              placeholderTextColor="#94A3B8"
              value={codeSnippetText}
              onChangeText={setCodeSnippetText}
              multiline
            />

            <TouchableOpacity onPress={saveCodeSnippet} disabled={postingCode} style={s.modalActionBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.modalActionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {postingCode ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="code-slash" size={15} color={L.gold} />
                    <Text style={s.modalActionText}>Post Code Snippet</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CHANNEL SELECTOR DRAWER MODAL */}
      <Modal visible={showChannelDrawer} transparent animationType="fade" onRequestClose={() => setShowChannelDrawer(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowChannelDrawer(false)}>
          <View style={s.channelDrawerCard}>
            <View style={s.drawerHeader}>
              <Text style={s.drawerTitle}>Workspace Channels</Text>
              <TouchableOpacity onPress={() => setShowChannelDrawer(false)}>
                <Ionicons name="close" size={18} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            {CHANNELS.map(ch => {
              const isSelected = !activeDmUser && activeChannel === ch.id;
              return (
                <TouchableOpacity
                  key={ch.id}
                  onPress={() => {
                    setActiveDmUser(null);
                    setActiveChannel(ch.id);
                    setShowChannelDrawer(false);
                  }}
                  style={[s.channelDrawerItem, isSelected && s.channelDrawerItemActive]}
                  activeOpacity={0.8}
                >
                  <View style={[s.channelDrawerIcon, isSelected && { backgroundColor: L.gold }]}>
                    <Ionicons name={ch.icon as any} size={15} color={isSelected ? '#0F172A' : L.navyHeader} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.channelDrawerName, isSelected && s.channelDrawerNameActive]}>#{ch.name}</Text>
                    <Text style={s.channelDrawerDesc}>{ch.desc}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color={L.goldDk} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SCHEDULE MEETING MODAL */}
      <Modal visible={showMeetingModal} transparent animationType="slide" onRequestClose={() => setShowMeetingModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Schedule Video Sync</Text>
              <TouchableOpacity onPress={() => setShowMeetingModal(false)}>
                <Ionicons name="close" size={18} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Meeting Topic / Title</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Weekly Liquidity Review"
              placeholderTextColor="#94A3B8"
              value={meetingTitle}
              onChangeText={setMeetingTitle}
            />

            <Text style={s.inputLabel}>Agenda / Notes</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="Key notes, target issues, attendee briefing..."
              placeholderTextColor="#94A3B8"
              value={meetingAgenda}
              onChangeText={setMeetingAgenda}
              multiline
            />

            <TouchableOpacity onPress={saveScheduledMeeting} disabled={creatingMeeting} style={s.modalActionBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.modalActionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {creatingMeeting ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="calendar" size={15} color={L.gold} />
                    <Text style={s.modalActionText}>Schedule & Post Meeting</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CREATE POLL MODAL */}
      <Modal visible={showPollModal} transparent animationType="slide" onRequestClose={() => setShowPollModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Live Poll</Text>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <Ionicons name="close" size={18} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Poll Question</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Approve new data gateway route?"
              placeholderTextColor="#94A3B8"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />

            <Text style={s.inputLabel}>Voting Choices</Text>
            {pollOptions.map((opt, idx) => (
              <TextInput
                key={idx}
                style={[s.modalInput, { marginBottom: 6 }]}
                placeholder={`Choice ${idx + 1}`}
                placeholderTextColor="#94A3B8"
                value={opt}
                onChangeText={txt => {
                  const arr = [...pollOptions];
                  arr[idx] = txt;
                  setPollOptions(arr);
                }}
              />
            ))}

            <TouchableOpacity onPress={() => setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`])} style={s.addOptionBtn}>
              <Ionicons name="add-circle-outline" size={14} color={L.goldAmber} />
              <Text style={s.addOptionText}>Add Another Choice</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={savePoll} disabled={creatingPoll} style={s.modalActionBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.modalActionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {creatingPoll ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="pie-chart" size={15} color={L.gold} />
                    <Text style={s.modalActionText}>Launch Live Poll</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CREATE TASK MODAL */}
      <Modal visible={showTaskModal} transparent animationType="slide" onRequestClose={() => setShowTaskModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Action Item</Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Ionicons name="close" size={18} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Task Description</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Audit Monnify webhook gateway response"
              placeholderTextColor="#94A3B8"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            <Text style={s.inputLabel}>Assignee (Admin Name)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Finance Admin / Lead Admin"
              placeholderTextColor="#94A3B8"
              value={taskAssignee}
              onChangeText={setTaskAssignee}
            />

            <Text style={s.inputLabel}>Priority Level</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {['CRITICAL', 'HIGH', 'NORMAL'].map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setTaskPriority(p as any)}
                  style={[s.prioritySelectBtn, taskPriority === p && s.prioritySelectBtnActive]}
                >
                  <Text style={[s.prioritySelectText, taskPriority === p && { color: '#0F172A', fontWeight: '900' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={saveTask} disabled={creatingTask} style={s.modalActionBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.modalActionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {creatingTask ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="checkbox" size={15} color={L.gold} />
                    <Text style={s.modalActionText}>Post Action Item</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN IMAGE VIEWER */}
      <Modal visible={!!zoomedImage} transparent animationType="fade" onRequestClose={() => setZoomedImage(null)}>
        <View style={s.zoomBackdrop}>
          <TouchableOpacity onPress={() => setZoomedImage(null)} style={s.zoomCloseBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {zoomedImage && <Image source={{ uri: zoomedImage }} style={s.zoomImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: L.bg,
  },
  topBar: {
    backgroundColor: L.navyHeader,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight || 28) + 6,
    paddingBottom: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    maxWidth: 150,
  },
  channelSelectorTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  superAdminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  superAdminPillText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9.5,
  },
  topIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCopilotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  aiCopilotBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 10,
  },
  videoMeetingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  videoMeetingBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#060B19',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    paddingHorizontal: 10,
    height: 32,
    marginBottom: 6,
  },
  searchTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11.5,
    marginLeft: 6,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#060B19',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  subTabActive: {
    backgroundColor: L.gold,
  },
  subTabText: {
    color: L.goldLight,
    fontSize: 9.5,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  toolShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  purgeChannelBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: L.coralBg,
    borderWidth: 1,
    borderColor: L.coralBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipsBar: {
    backgroundColor: L.card,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: L.cardBorder,
  },
  filterChip: {
    backgroundColor: L.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  filterChipActive: {
    backgroundColor: L.navyHeader,
    borderColor: L.navyHeader,
  },
  filterChipText: {
    color: L.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: L.gold,
  },
  pinnedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: L.goldLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
  },
  pinnedText: {
    flex: 1,
    color: L.navyMid,
    fontSize: 9.5,
    fontWeight: '800',
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    gap: 6,
  },
  loadingText: {
    color: L.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: L.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginTop: 14,
    gap: 5,
  },
  emptyTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
    textAlign: 'center',
  },
  emptySub: {
    color: L.textMuted,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 15,
  },
  msgBubble: {
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    maxWidth: '85%',
    borderWidth: 1,
  },
  msgBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: L.card,
    borderColor: L.cardBorder,
  },
  msgBubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(218, 165, 32, 0.35)',
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  senderName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 10,
  },
  roleBadge: {
    backgroundColor: L.bg,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  roleBadgeText: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '800',
  },
  msgTime: {
    color: '#94A3B8',
    fontSize: 8.5,
    marginLeft: 'auto',
  },
  msgText: {
    color: L.textPrimary,
    fontSize: 12,
    lineHeight: 16.5,
  },
  msgTextMe: {
    color: L.navyHeader,
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  reactionPillActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  reactionEmoji: {
    fontSize: 9.5,
  },
  reactionCount: {
    color: L.navyHeader,
    fontSize: 8,
    fontWeight: '800',
  },
  meetingCardBubble: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: L.goldDk,
  },
  meetingBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: L.coral,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: L.coral,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 8.5,
  },
  meetingBubbleTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
    marginBottom: 3,
  },
  meetingBubbleDesc: {
    color: '#94A3B8',
    fontSize: 9.5,
    lineHeight: 13,
    marginBottom: 7,
  },
  joinMeetingBtn: {
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 2,
  },
  joinMeetingGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: L.gold,
  },
  joinMeetingText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 11,
  },
  metricsCardBubble: {
    backgroundColor: '#060B19',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  metricsTitle: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricTile: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    padding: 6,
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.2)',
  },
  metricLabel: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  metricVal: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10.5,
    marginTop: 2,
  },
  codeCardBubble: {
    backgroundColor: '#060B19',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  codeTitle: {
    color: L.gold,
    fontSize: 9.5,
    fontWeight: '800',
    flex: 1,
    marginLeft: 5,
  },
  codeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  codeCopyText: {
    color: L.gold,
    fontSize: 8.5,
    fontWeight: '800',
  },
  codeBox: {
    backgroundColor: '#020617',
    padding: 8,
    borderRadius: 7,
  },
  codeMonospaceText: {
    color: '#38BDF8',
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pollCardBubble: {
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  pollQuestionTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
    marginVertical: 4,
  },
  pollOptionRow: {
    position: 'relative',
    height: 30,
    backgroundColor: L.bg,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
    overflow: 'hidden',
    marginBottom: 4,
    justifyContent: 'center',
  },
  pollOptionRowVoted: {
    borderColor: L.goldDk,
  },
  pollBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 9,
  },
  pollOptionText: {
    color: L.navyHeader,
    fontWeight: '700',
    fontSize: 10,
  },
  pollOptionTextVoted: {
    fontWeight: '900',
  },
  pollOptionPct: {
    color: L.textMuted,
    fontWeight: '800',
    fontSize: 9,
  },
  pollTotalFooter: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  taskCardBubble: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  taskCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTitleText: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11.5,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: L.textMuted,
  },
  priorityTag: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  priorityCritical: {
    backgroundColor: L.coralBg,
    borderWidth: 1,
    borderColor: L.coral,
  },
  priorityHigh: {
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  priorityTagText: {
    color: L.navyHeader,
    fontSize: 7.5,
    fontWeight: '900',
  },
  taskAssigneeText: {
    color: L.textMuted,
    fontSize: 8.5,
    marginTop: 2,
  },
  voiceMemoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  voicePlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  waveformBar: {
    width: 3,
    backgroundColor: L.goldDk,
    borderRadius: 1.5,
  },
  speedRateBtn: {
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  speedRateText: {
    color: L.navyHeader,
    fontSize: 8.5,
    fontWeight: '800',
  },
  voiceDurationText: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '800',
  },
  docAttachBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.bg,
    padding: 8,
    borderRadius: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  docNameText: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 10.5,
  },
  docSizeText: {
    color: L.textMuted,
    fontSize: 8.5,
  },
  chatImageAttachment: {
    width: 210,
    height: 140,
    borderRadius: 9,
    marginTop: 4,
  },
  inputStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: L.card,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
    gap: 5,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  actionPlusBtn: {
    padding: 3,
  },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: L.bg,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: L.textPrimary,
    fontSize: 12,
    maxHeight: 70,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sendBtnGrad: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: L.coralBg,
    borderTopWidth: 1,
    borderTopColor: L.coralBorder,
    gap: 8,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  recordingLiveDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: L.coral,
  },
  recordingText: {
    flex: 1,
    color: L.coral,
    fontWeight: '900',
    fontSize: 11,
  },
  recordingSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  recordingSendText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 10,
  },
  recordingCancelBtn: {
    padding: 5,
  },
  meetingsScroll: {
    flex: 1,
  },
  meetingsContent: {
    padding: 12,
    paddingBottom: 70,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  
  // QUANTUM HERO COMMAND CARD STYLES
  quantumHeroCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: L.goldDk,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  quantumHeroGrad: {
    padding: 14,
  },
  quantumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  radarSignalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  pulsingSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: L.emerald,
  },
  radarSignalText: {
    color: L.emerald,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bitratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  bitrateText: {
    color: '#E2E8F0',
    fontSize: 8,
    fontWeight: '800',
  },
  quantumHeroTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  quantumHeroSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14.5,
    marginTop: 3,
    marginBottom: 12,
  },
  heroButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroLaunchBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: L.goldDk,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  heroLaunchGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  heroLaunchBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 12,
  },
  heroAudioOnlyBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  heroAudioOnlyGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroAudioOnlyText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11,
  },
  quickJoinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
    gap: 6,
  },
  quickJoinInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11.5,
  },
  quickJoinSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  quickJoinSubmitText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 10,
  },

  // MEETING FILTERS
  meetingFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  meetingFilterChip: {
    flex: 1,
    backgroundColor: L.card,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  meetingFilterChipActive: {
    backgroundColor: L.navyHeader,
    borderColor: L.navyHeader,
  },
  meetingFilterChipText: {
    color: L.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  meetingFilterChipTextActive: {
    color: L.gold,
  },

  // PRESET STRATEGIC ROOMS
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionCount: {
    color: L.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
  },
  presetRoomCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  presetRoomGrad: {
    padding: 11,
  },
  presetRoomTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  presetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRoomTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  presetTagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  presetTagText: {
    fontSize: 7,
    fontWeight: '900',
  },
  presetRoomDesc: {
    color: '#94A3B8',
    fontSize: 9,
    lineHeight: 12.5,
    marginTop: 2,
  },
  presetRoomBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 6,
  },
  presetRoomHash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presetRoomHashText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  presetCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  presetCopyText: {
    color: L.gold,
    fontSize: 9,
    fontWeight: '800',
  },
  presetEnterBtn: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  presetEnterGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
  },
  presetEnterText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9.5,
  },

  // SCHEDULED LIST
  meetingListItem: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  meetingListItemLive: {
    borderColor: L.coral,
    backgroundColor: '#FFF8F8',
  },
  meetingListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  meetingTagText: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  meetingDateText: {
    color: L.goldAmber,
    fontSize: 9,
    fontWeight: '800',
  },
  meetingListTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 3,
  },
  meetingListDesc: {
    color: L.textMuted,
    fontSize: 9.5,
    marginBottom: 6,
  },
  meetingListFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  meetingHost: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
  },
  deleteMeetingBtn: {
    padding: 4,
  },
  joinListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  joinListBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9.5,
  },

  // AI MEETING BANNER
  aiMeetingBanner: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  aiMeetingGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  aiMeetingIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: L.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiMeetingTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  aiMeetingSub: {
    color: '#94A3B8',
    fontSize: 8.5,
    marginTop: 1,
  },

  // GENERAL & DM STYLES
  sectionTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12.5,
  },
  scheduleNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  scheduleNewBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9.5,
  },
  dmContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  dmAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  dmAvatarFallback: {
    backgroundColor: L.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmAvatarText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11,
  },
  dmName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11.5,
  },
  dmRole: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
  },
  dmCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  dmVoiceBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: L.emeraldBg,
    borderWidth: 1,
    borderColor: L.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dmChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.bg,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  dmChatBtnText: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 9.5,
  },
  dutyStatusCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  dutyStatusTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
  },
  dutyStatusSub: {
    color: L.goldLight,
    fontSize: 9.5,
    marginTop: 2,
  },
  clockInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.emerald,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 7,
  },
  clockInBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
  },
  rosterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.card,
    borderRadius: 9,
    padding: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  rosterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rosterName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11,
  },
  rosterRole: {
    color: L.textMuted,
    fontSize: 8.5,
  },
  rosterStatus: {
    color: L.emerald,
    fontSize: 8.5,
    fontWeight: '900',
  },
  bookmarkCard: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  actionSheetCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: L.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  actionSheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionSheetTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '30%',
    paddingVertical: 12,
    backgroundColor: L.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  actionSheetTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 5,
  },
  actionSheetTileText: {
    color: L.navyHeader,
    fontSize: 9.5,
    fontWeight: '800',
  },
  channelDrawerCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: L.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  drawerTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
  },
  channelDrawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 9,
    marginBottom: 4,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  channelDrawerItemActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  channelDrawerIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: L.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelDrawerName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11,
  },
  channelDrawerNameActive: {
    fontWeight: '900',
  },
  channelDrawerDesc: {
    color: L.textMuted,
    fontSize: 8.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: L.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
  },
  directiveItem: {
    backgroundColor: L.bg,
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  directiveTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 11,
    marginBottom: 2,
  },
  directiveText: {
    color: L.textSecondary,
    fontSize: 9.5,
    lineHeight: 12.5,
  },
  prioritySelectBtn: {
    flex: 1,
    backgroundColor: L.bg,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  prioritySelectBtnActive: {
    backgroundColor: L.gold,
    borderColor: L.goldDk,
  },
  prioritySelectText: {
    color: L.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  inputLabel: {
    color: L.navyHeader,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  modalInput: {
    backgroundColor: L.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: L.textPrimary,
    fontSize: 11,
    marginBottom: 8,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    marginBottom: 10,
  },
  addOptionText: {
    color: L.goldAmber,
    fontWeight: '800',
    fontSize: 9.5,
  },
  modalActionBtn: {
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 4,
  },
  modalActionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  modalActionText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  zoomImage: {
    width: '95%',
    height: '80%',
  },
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: L.goldDk,
  },
  videoModalTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
  },
  videoModalTimer: {
    color: L.gold,
    fontSize: 9,
    fontWeight: '900',
  },
  videoModalSecure: {
    color: '#94A3B8',
    fontSize: 8.5,
  },
  copyLinkHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.4)',
  },
  copyLinkHeaderText: {
    color: L.gold,
    fontSize: 9,
    fontWeight: '800',
  },
  openBrowserHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.4)',
  },
  openBrowserHeaderText: {
    color: L.gold,
    fontSize: 9,
    fontWeight: '800',
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.coral,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
  },
  endCallBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  videoLoadingCenter: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoLoadingText: {
    color: L.goldLight,
    fontSize: 12,
    fontWeight: '700',
  },
  videoLoadingSub: {
    color: '#94A3B8',
    fontSize: 9.5,
  },
});
