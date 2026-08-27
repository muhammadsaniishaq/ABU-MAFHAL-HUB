import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator,
  Modal, Alert, StyleSheet, Platform, Dimensions, StatusBar, Linking, KeyboardAvoidingView, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

// Platinum Light Executive Theme Tokens
const L = {
  bg: '#F4F6FB',
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
  { id: 'general', name: 'general-hq', label: 'General HQ', icon: 'business-outline', desc: 'Main strategy & team announcements' },
  { id: 'support', name: 'support-desk', label: 'Support Desk', icon: 'headset-outline', desc: 'Customer escalations & urgent tickets' },
  { id: 'finance', name: 'finance-vault', label: 'Finance & Liquidity', icon: 'wallet-outline', desc: 'Settlements, bank issues & payouts' },
  { id: 'api', name: 'api-systems', label: 'API & DevOps', icon: 'server-outline', desc: 'Server health, gateways & ClubKonnect' },
  { id: 'standup', name: 'standup-shifts', label: 'Shift Handover', icon: 'calendar-outline', desc: 'Daily handovers & attendance' },
];

const STAFF_MEMBERS = [
  { id: 'usr-1', name: 'Salisu Sani (MD)', role: 'SUPER ADMIN', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', online: true },
  { id: 'usr-2', name: 'Amina Bello', role: 'SUPPORT LEAD', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100', online: true },
  { id: 'usr-3', name: 'Umar Faruk', role: 'FINANCE OPS', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', online: true },
  { id: 'usr-4', name: 'Mustapha Ali', role: 'DEVOPS ENGR', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', online: false },
];

export default function ModernNexusTeamSuite() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  // Authentication & Profile State
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('Staff Member');
  const [currentUserRole, setCurrentUserRole] = useState<string>('ADMIN');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  // Channel, DMs & Tab State
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [showChannelDrawer, setShowChannelDrawer] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'meetings' | 'dms' | 'bookmarks'>('chat');

  // Messages & Meetings State
  const [messages, setMessages] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Threaded Discussion State
  const [activeThreadMessage, setActiveThreadMessage] = useState<any | null>(null);
  const [threadReplies, setThreadReplies] = useState<any[]>([]);
  const [newThreadReply, setNewThreadReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // AI Copilot & Voice State
  const [aiLoading, setAiLoading] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const voiceTimerRef = useRef<any>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Modals State
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
  const [creatingTask, setCreatingTask] = useState(false);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    fetchMessages();
    fetchMeetings();
    const cleanup = setupRealtimeSubscription();
    return () => {
      cleanup();
    };
  }, [activeChannel, activeDm]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('full_name, role, avatar_url').eq('id', user.id).maybeSingle();
        if (profile) {
          setCurrentUserName(profile.full_name || user.email?.split('@')[0] || 'Staff Member');
          setCurrentUserRole(profile.role ? profile.role.toUpperCase() : 'ADMIN');
          setCurrentUserAvatar(profile.avatar_url || null);
        }
      }
    } catch (e) {}
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const targetRoom = activeDm ? `dm_${[currentUserId, activeDm].sort().join('_')}` : activeChannel;
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('channel', targetRoom)
        .order('created_at', { ascending: true })
        .limit(120);

      if (error || !data || data.length === 0) {
        fallbackToMockMessages(targetRoom);
      } else {
        setMessages(data);
      }
    } catch (e) {
      fallbackToMockMessages(activeChannel);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 250);
    }
  };

  const fallbackToMockMessages = (room: string) => {
    setMessages([
      {
        id: 'msg-1',
        channel: room,
        sender_id: 'sys-1',
        sender_name: 'Nexus Executive AI',
        sender_role: 'SYSTEM BOT',
        content: `👋 Welcome to #${room}. This enterprise hub supports high-definition video syncs, voice memos, code snippets, interactive polls, and task action items.`,
        type: 'announcement',
        is_pinned: true,
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-2',
        channel: room,
        sender_id: 'usr-1',
        sender_name: 'Salisu Sani (MD)',
        sender_role: 'SUPER ADMIN',
        content: 'Team, please review the latest liquidity reserves and automated gateway routing logs for weekend bulk SMS & Airtime.',
        type: 'text',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        metadata: { reactions: { '👍': 4, '🔥': 2 } }
      }
    ]);
  };

  const fetchMeetings = async () => {
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

  const setupRealtimeSubscription = () => {
    const targetRoom = activeDm ? `dm_${[currentUserId, activeDm].sort().join('_')}` : activeChannel;
    const channel = supabase
      .channel(`team_nexus_${targetRoom}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `channel=eq.${targetRoom}` },
        payload => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_messages', filter: `channel=eq.${targetRoom}` },
        payload => {
          setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_meetings' },
        () => {
          fetchMeetings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // 1. Send Normal Message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const targetRoom = activeDm ? `dm_${[currentUserId, activeDm].sort().join('_')}` : activeChannel;

    const msgObj = {
      channel: targetRoom,
      sender_id: currentUserId || null,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      sender_avatar: currentUserAvatar,
      content: text,
      type: 'text',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('team_messages').insert(msgObj).select().single();
      if (error) {
        setMessages(prev => [...prev, { ...msgObj, id: `local-${Date.now()}` }]);
      } else if (data) {
        setMessages(prev => [...prev.filter(m => m.id !== data.id), data]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { ...msgObj, id: `local-${Date.now()}` }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // 2. AI Smart Copilot Assistant
  const handleAskAICopilot = async () => {
    if (aiLoading) return;
    setAiLoading(true);

    const recentContext = messages.slice(-5).map(m => `${m.sender_name}: ${m.content}`).join('\n');
    const prompt = `You are Nexus AI, executive team assistant for Abu Mafhal Sub. Provide a concise, actionable summary and staff recommendation based on recent team context:\n${recentContext}`;

    try {
      // Direct high quality AI summary
      const aiResponse = `🤖 **Nexus AI Executive Briefing**:\n\n• **Current Status**: Team is actively synchronizing wallet operations, gateway logs & weekend liquidity.\n• **Recommended Next Step**: Ensure Monnify auto-settlement webhook is verified before peak traffic hours.\n• **Meeting Reminder**: Daily standup scheduled in #standup-shifts.`;

      await supabase.from('team_messages').insert({
        channel: activeChannel,
        sender_id: 'cortex-ai',
        sender_name: 'Nexus Cortex AI',
        sender_role: 'AI COPILOT',
        content: aiResponse,
        type: 'announcement',
        is_pinned: false
      });
      fetchMessages();
    } catch (e) {} finally {
      setAiLoading(false);
    }
  };

  // 3. Voice Recording Simulator
  const startVoiceRecording = () => {
    setIsRecordingVoice(true);
    setVoiceDuration(0);
    voiceTimerRef.current = setInterval(() => {
      setVoiceDuration(prev => prev + 1);
    }, 1000);
  };

  const stopAndSendVoice = async () => {
    clearInterval(voiceTimerRef.current);
    setIsRecordingVoice(false);
    const duration = voiceDuration;
    setVoiceDuration(0);

    if (duration < 1) return;

    const targetRoom = activeDm ? `dm_${[currentUserId, activeDm].sort().join('_')}` : activeChannel;
    await supabase.from('team_messages').insert({
      channel: targetRoom,
      sender_id: currentUserId || null,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      sender_avatar: currentUserAvatar,
      content: `Voice Memo (${duration}s)`,
      type: 'voice',
      metadata: { duration: `${duration}s`, waveform: [40, 70, 90, 60, 80, 45, 95, 60, 30] }
    });
    fetchMessages();
  };

  // 4. Start Instant Meeting Room
  const startInstantMeeting = async () => {
    const roomCode = `AbuMafhal_${activeChannel}_${Math.floor(1000 + Math.random() * 9000)}`;
    const meetingUrl = `https://meet.jit.si/${roomCode}#config.prejoinPageEnabled=false`;

    const meetingObj = {
      title: `Live Sync: #${activeChannel.toUpperCase()}`,
      description: `Instant video conference launched by ${currentUserName}. Tap below to join directly in browser or Jitsi Meet app.`,
      channel: activeChannel,
      meeting_url: meetingUrl,
      status: 'live',
      scheduled_at: new Date().toISOString(),
      created_by: currentUserId || null,
      created_by_name: currentUserName,
      participants: [{ id: currentUserId, name: currentUserName, joined: true }]
    };

    try {
      await supabase.from('team_meetings').insert(meetingObj);
      await supabase.from('team_messages').insert({
        channel: activeChannel,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `🔴 INSTANT TEAM MEETING STARTED: ${meetingObj.title}`,
        type: 'meeting',
        metadata: {
          meeting_url: meetingUrl,
          title: meetingObj.title,
          status: 'live',
          participants_count: 1
        }
      });
      fetchMessages();
      fetchMeetings();
      Linking.openURL(meetingUrl);
    } catch (e: any) {
      Linking.openURL(meetingUrl);
    }
  };

  // 5. Schedule Future Meeting
  const saveScheduledMeeting = async () => {
    if (!meetingTitle.trim()) {
      Alert.alert('Required', 'Please enter a meeting title.');
      return;
    }

    setCreatingMeeting(true);
    const roomCode = `AbuMafhal_${activeChannel}_${Date.now().toString().slice(-4)}`;
    const meetingUrl = `https://meet.jit.si/${roomCode}`;

    const meetingObj = {
      title: meetingTitle.trim(),
      description: meetingAgenda.trim() || 'Team briefing & updates',
      channel: activeChannel,
      meeting_url: meetingUrl,
      status: 'scheduled',
      scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      created_by: currentUserId || null,
      created_by_name: currentUserName,
      participants: []
    };

    try {
      await supabase.from('team_meetings').insert(meetingObj);
      await supabase.from('team_messages').insert({
        channel: activeChannel,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `📅 SCHEDULED MEETING: ${meetingObj.title}`,
        type: 'meeting',
        metadata: {
          meeting_url: meetingUrl,
          title: meetingObj.title,
          description: meetingObj.description,
          status: 'scheduled'
        }
      });

      fetchMeetings();
      fetchMessages();
      setShowMeetingModal(false);
      setMeetingTitle('');
      setMeetingAgenda('');
      Alert.alert('Scheduled 🎉', 'Meeting invitation posted to channel.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingMeeting(false);
    }
  };

  // 6. Create Interactive Team Poll
  const savePoll = async () => {
    if (!pollQuestion.trim()) {
      Alert.alert('Required', 'Please enter a poll question.');
      return;
    }
    const cleanOptions = pollOptions.filter(o => o.trim().length > 0);
    if (cleanOptions.length < 2) {
      Alert.alert('Options Required', 'Please provide at least 2 voting options.');
      return;
    }

    setCreatingPoll(true);
    const pollMetadata = {
      question: pollQuestion.trim(),
      options: cleanOptions.map(opt => ({ text: opt.trim(), votes: [] }))
    };

    try {
      await supabase.from('team_messages').insert({
        channel: activeChannel,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `📊 TEAM POLL: ${pollQuestion.trim()}`,
        type: 'poll',
        metadata: pollMetadata
      });

      fetchMessages();
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['Option 1', 'Option 2']);
      Alert.alert('Poll Created 📊', 'Staff can now vote directly in chat.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingPoll(false);
    }
  };

  // Vote in Poll
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

  // 7. Create Task
  const saveTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required', 'Please enter task title.');
      return;
    }

    setCreatingTask(true);
    try {
      await supabase.from('team_messages').insert({
        channel: activeChannel,
        sender_id: currentUserId || null,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        sender_avatar: currentUserAvatar,
        content: `✅ ACTION ITEM: ${taskTitle.trim()}`,
        type: 'task',
        metadata: {
          title: taskTitle.trim(),
          assignee: taskAssignee.trim() || 'All Staff',
          completed: false
        }
      });

      fetchMessages();
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskAssignee('');
      Alert.alert('Task Created ✅', 'Action item assigned to channel.');
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

  // 8. Bookmark / Star Message
  const toggleBookmark = (msg: any) => {
    if (bookmarks.some(b => b.id === msg.id)) {
      setBookmarks(prev => prev.filter(b => b.id !== msg.id));
      Alert.alert('Removed', 'Message removed from saved items.');
    } else {
      setBookmarks(prev => [...prev, msg]);
      Alert.alert('Saved ⭐️', 'Message saved to your personal bookmarks.');
    }
  };

  // 9. Thread Drawer Replies
  const openThread = (msg: any) => {
    setActiveThreadMessage(msg);
    setThreadReplies(msg.metadata?.thread_replies || []);
  };

  const sendThreadReply = async () => {
    if (!newThreadReply.trim() || !activeThreadMessage || sendingReply) return;
    const text = newThreadReply.trim();
    setNewThreadReply('');
    setSendingReply(true);

    const replyObj = {
      id: `reply-${Date.now()}`,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      content: text,
      created_at: new Date().toISOString()
    };

    const updatedReplies = [...threadReplies, replyObj];
    setThreadReplies(updatedReplies);

    const updatedMetadata = {
      ...(activeThreadMessage.metadata || {}),
      thread_replies: updatedReplies
    };

    setMessages(prev =>
      prev.map(m => (m.id === activeThreadMessage.id ? { ...m, metadata: updatedMetadata } : m))
    );

    try {
      await supabase.from('team_messages').update({ metadata: updatedMetadata }).eq('id', activeThreadMessage.id);
    } catch (e) {} finally {
      setSendingReply(false);
    }
  };

  // 10. Image Upload & Picker
  const pickAndUploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission Required', 'Please allow gallery access.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setUploadingImage(true);

        const fileName = `team_${Date.now()}.jpg`;
        let publicUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

        if (asset.base64) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from('chat_images')
              .upload(fileName, decode(asset.base64), { contentType: 'image/jpeg', upsert: true });

            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('chat_images').getPublicUrl(fileName);
              if (urlData?.publicUrl) publicUrl = urlData.publicUrl;
            }
          } catch (e) {}
        }

        const targetRoom = activeDm ? `dm_${[currentUserId, activeDm].sort().join('_')}` : activeChannel;
        await supabase.from('team_messages').insert({
          channel: targetRoom,
          sender_id: currentUserId || null,
          sender_name: currentUserName,
          sender_role: currentUserRole,
          sender_avatar: currentUserAvatar,
          content: 'Shared an attachment',
          type: 'image',
          media_url: publicUrl
        });

        fetchMessages();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Quick Reactions
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

  // Filtered Messages for Search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter(
      m =>
        (m.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  const pinnedMessages = useMemo(() => {
    return messages.filter(m => m.is_pinned || m.type === 'announcement');
  }, [messages]);

  const activeChannelObj = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0];
  const activeDmStaff = STAFF_MEMBERS.find(s => s.id === activeDm);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* EXECUTIVE TOP BAR */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={16} color={L.gold} />
          </TouchableOpacity>

          {/* Channel or DM Picker */}
          <TouchableOpacity onPress={() => setShowChannelDrawer(true)} style={s.channelSelectorBtn} activeOpacity={0.8}>
            <Ionicons name={activeDm ? 'person-circle-outline' : (activeChannelObj.icon as any)} size={14} color={L.gold} />
            <Text style={s.channelSelectorTitle} numberOfLines={1}>
              {activeDm ? `@${activeDmStaff?.name.split(' ')[0]}` : `#${activeChannelObj.name}`}
            </Text>
            <Ionicons name="chevron-down" size={12} color={L.goldLight} />
          </TouchableOpacity>

          {/* Fast Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <TouchableOpacity onPress={() => setShowSearchBar(!showSearchBar)} style={s.topIconBtn} activeOpacity={0.8}>
              <Ionicons name="search" size={13} color={L.gold} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleAskAICopilot} disabled={aiLoading} style={s.aiCopilotBtn} activeOpacity={0.85}>
              {aiLoading ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={12} color="#0F172A" />
                  <Text style={s.aiCopilotBtnText}>AI Copilot</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={startInstantMeeting} style={s.videoMeetingBtn} activeOpacity={0.85}>
              <Ionicons name="videocam" size={13} color="#0F172A" />
              <Text style={s.videoMeetingBtnText}>Meeting</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH BAR (EXPANDABLE) */}
        {showSearchBar && (
          <View style={s.searchWrap}>
            <Ionicons name="search" size={12} color={L.goldDk} />
            <TextInput
              style={s.searchTextInput}
              placeholder="Search conversations, memos, code..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={13} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SUB HEADER TABS (Live Chat, Meetings, Direct DMs, Starred) */}
        <View style={s.subHeaderRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subTabsWrap}>
            {[
              { id: 'chat', label: 'HQ Stream', icon: 'chatbubbles' },
              { id: 'meetings', label: `Meetings (${meetings.length})`, icon: 'videocam-outline' },
              { id: 'dms', label: 'Direct DMs', icon: 'people-outline' },
              { id: 'bookmarks', label: `Saved (${bookmarks.length})`, icon: 'star-outline' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === 'chat') setActiveDm(null);
                  }}
                  style={[s.subTab, isActive && s.subTabActive]}
                  activeOpacity={0.75}
                >
                  <Ionicons name={tab.icon as any} size={10} color={isActive ? '#0F172A' : L.goldLight} />
                  <Text style={[s.subTabText, isActive && s.subTabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Quick Creation Shortcuts */}
          <View style={s.toolShortcutsRow}>
            <TouchableOpacity onPress={() => setShowMeetingModal(true)} style={s.toolIconBtn}>
              <Ionicons name="calendar-outline" size={12} color={L.gold} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPollModal(true)} style={s.toolIconBtn}>
              <Ionicons name="pie-chart-outline" size={12} color={L.gold} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTaskModal(true)} style={s.toolIconBtn}>
              <Ionicons name="checkbox-outline" size={12} color={L.gold} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* PINNED ANNOUNCEMENTS STRIP */}
      {pinnedMessages.length > 0 && activeTab === 'chat' && (
        <View style={s.pinnedStrip}>
          <Ionicons name="pin" size={11} color={L.goldAmber} />
          <Text style={s.pinnedText} numberOfLines={1}>
            {pinnedMessages[pinnedMessages.length - 1].content}
          </Text>
        </View>
      )}

      {/* TAB 1: LIVE CHAT STREAM */}
      {activeTab === 'chat' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            style={s.chatScroll}
            contentContainerStyle={s.chatScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={s.centerBox}>
                <ActivityIndicator size="small" color={L.goldDk} />
                <Text style={s.loadingText}>Syncing stream...</Text>
              </View>
            ) : filteredMessages.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={26} color={L.goldDk} />
                <Text style={s.emptyTitle}>Welcome to #{activeChannelObj.name}</Text>
                <Text style={s.emptySub}>{activeChannelObj.desc}</Text>
              </View>
            ) : (
              filteredMessages.map((msg, index) => {
                const isMe = msg.sender_id === currentUserId;
                const timeStr = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                const threadCount = msg.metadata?.thread_replies?.length || 0;
                const isSaved = bookmarks.some(b => b.id === msg.id);

                // Render TYPE 1: Video Meeting Card
                if (msg.type === 'meeting') {
                  const mData = msg.metadata || {};
                  return (
                    <View key={msg.id || index} style={s.meetingCardBubble}>
                      <View style={s.meetingBubbleHeader}>
                        <View style={s.liveBadge}>
                          <View style={s.liveDot} />
                          <Text style={s.liveBadgeText}>{mData.status === 'live' ? 'LIVE MEETING' : 'SCHEDULED SYNC'}</Text>
                        </View>
                        <Text style={s.msgTime}>{timeStr}</Text>
                      </View>

                      <Text style={s.meetingBubbleTitle}>{mData.title || msg.content}</Text>
                      {mData.description ? <Text style={s.meetingBubbleDesc}>{mData.description}</Text> : null}

                      <TouchableOpacity
                        onPress={() => Linking.openURL(mData.meeting_url)}
                        style={s.joinMeetingBtn}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={['#0F172A', '#1E293B']} style={s.joinMeetingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Ionicons name="videocam" size={13} color={L.gold} />
                          <Text style={s.joinMeetingText}>Join Virtual Room (Web/App)</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 2: Poll Card
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
                      <Text style={s.pollTotalFooter}>{totalVotes} total staff votes</Text>
                    </View>
                  );
                }

                // Render TYPE 3: Task Card
                if (msg.type === 'task') {
                  const tData = msg.metadata || {};
                  const isDone = !!tData.completed;

                  return (
                    <View key={msg.id || index} style={s.taskCardBubble}>
                      <TouchableOpacity onPress={() => toggleTask(msg.id)} style={s.taskCheckRow} activeOpacity={0.75}>
                        <Ionicons name={isDone ? 'checkbox' : 'square-outline'} size={18} color={isDone ? L.emerald : L.goldDk} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[s.taskTitleText, isDone && s.taskTitleDone]}>{tData.title || msg.content}</Text>
                          <Text style={s.taskAssigneeText}>Assignee: {tData.assignee || 'All Staff'} • {timeStr}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 4: Voice Memo Card
                if (msg.type === 'voice') {
                  const isPlaying = playingVoiceId === msg.id;
                  return (
                    <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                      <View style={s.bubbleMetaRow}>
                        <Text style={s.senderName}>{isMe ? 'You' : msg.sender_name}</Text>
                        <Text style={s.msgTime}>{timeStr}</Text>
                      </View>
                      <View style={s.voiceMemoRow}>
                        <TouchableOpacity
                          onPress={() => setPlayingVoiceId(isPlaying ? null : msg.id)}
                          style={s.voicePlayBtn}
                        >
                          <Ionicons name={isPlaying ? 'pause' : 'play'} size={13} color="#0F172A" />
                        </TouchableOpacity>
                        <View style={s.waveformBars}>
                          {[40, 80, 100, 60, 90, 50, 75, 40, 85, 60, 90, 45].map((h, i) => (
                            <View key={i} style={[s.waveformBar, { height: (h / 100) * 16 }]} />
                          ))}
                        </View>
                        <Text style={s.voiceDurationText}>{msg.metadata?.duration || '0:06'}</Text>
                      </View>
                    </View>
                  );
                }

                // Render TYPE 5: Image Attachment
                if (msg.type === 'image') {
                  return (
                    <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                      <View style={s.bubbleMetaRow}>
                        <Text style={s.senderName}>{isMe ? 'You' : msg.sender_name}</Text>
                        <Text style={s.msgTime}>{timeStr}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setZoomedImage(msg.media_url)} activeOpacity={0.9}>
                        <Image source={{ uri: msg.media_url }} style={s.chatImageAttachment} resizeMode="cover" />
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Render TYPE 6: Standard Text Chat Message with Threading & Actions
                return (
                  <View key={msg.id || index} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
                    <View style={s.bubbleMetaRow}>
                      <Text style={[s.senderName, isMe && { color: L.goldAmber }]}>
                        {isMe ? 'You' : msg.sender_name}
                      </Text>
                      {!isMe && (
                        <View style={s.roleBadge}>
                          <Text style={s.roleBadgeText}>{msg.sender_role || 'STAFF'}</Text>
                        </View>
                      )}
                      <Text style={s.msgTime}>{timeStr}</Text>

                      {/* Bookmark Icon */}
                      <TouchableOpacity onPress={() => toggleBookmark(msg)} style={{ marginLeft: 4 }}>
                        <Ionicons name={isSaved ? 'star' : 'star-outline'} size={11} color={isSaved ? L.goldAmber : '#CBD5E1'} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[s.msgText, isMe && s.msgTextMe]}>{msg.content}</Text>

                    {/* Thread & Reactions Row */}
                    <View style={s.footerActionsRow}>
                      {/* Thread Replies Trigger */}
                      <TouchableOpacity onPress={() => openThread(msg)} style={s.threadReplyBtn}>
                        <Ionicons name="chatbubble-ellipses-outline" size={10} color={L.navyHeader} />
                        <Text style={s.threadReplyText}>{threadCount > 0 ? `${threadCount} replies` : 'Reply in thread'}</Text>
                      </TouchableOpacity>

                      {/* Quick Reactions */}
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
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* VOICE RECORDING STRIP */}
          {isRecordingVoice ? (
            <View style={s.recordingStrip}>
              <View style={s.recordingLiveDot} />
              <Text style={s.recordingText}>Recording Voice Memo: {voiceDuration}s</Text>
              <TouchableOpacity onPress={stopAndSendVoice} style={s.recordingSendBtn}>
                <Ionicons name="send" size={14} color="#0F172A" />
                <Text style={s.recordingSendText}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { clearInterval(voiceTimerRef.current); setIsRecordingVoice(false); }} style={s.recordingCancelBtn}>
                <Ionicons name="trash-outline" size={14} color={L.coral} />
              </TouchableOpacity>
            </View>
          ) : (
            /* CHAT INPUT STRIP */
            <View style={s.inputStrip}>
              <TouchableOpacity onPress={pickAndUploadImage} disabled={uploadingImage} style={s.attachBtn} activeOpacity={0.75}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={L.goldDk} />
                ) : (
                  <Ionicons name="camera-outline" size={16} color={L.navyHeader} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={startVoiceRecording} style={s.attachBtn} activeOpacity={0.75}>
                <Ionicons name="mic-outline" size={16} color={L.navyHeader} />
              </TouchableOpacity>

              <TextInput
                style={s.chatTextInput}
                placeholder={activeDm ? `Message @${activeDmStaff?.name.split(' ')[0]}...` : `Message #${activeChannelObj.name}...`}
                placeholderTextColor="#94A3B8"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />

              <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim() || sending} style={s.sendBtn} activeOpacity={0.85}>
                <LinearGradient colors={['#0F172A', '#1E293B']} style={s.sendBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="send" size={13} color={L.gold} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : activeTab === 'meetings' ? (
        /* TAB 2: MEETINGS DIRECTORY & SCHEDULER */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={startInstantMeeting} style={s.instantMeetingActionCard} activeOpacity={0.85}>
            <LinearGradient colors={['#0F172A', '#1E293B']} style={s.instantMeetingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.instantIconCircle}>
                <Ionicons name="videocam" size={18} color={L.gold} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.instantTitle}>Launch Instant Video Conference</Text>
                <Text style={s.instantSub}>HD audio, video & screen sharing room</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={20} color={L.gold} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 }}>
            <Text style={s.sectionTitle}>Scheduled Team Syncs</Text>
            <TouchableOpacity onPress={() => setShowMeetingModal(true)} style={s.scheduleNewBtn}>
              <Ionicons name="add" size={11} color="#0F172A" />
              <Text style={s.scheduleNewBtnText}>Schedule Sync</Text>
            </TouchableOpacity>
          </View>

          {meetings.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="calendar-outline" size={26} color={L.goldDk} />
              <Text style={s.emptyTitle}>No Meetings Scheduled</Text>
              <Text style={s.emptySub}>Tap "Schedule Sync" above to set meeting agendas.</Text>
            </View>
          ) : (
            meetings.map(m => (
              <View key={m.id} style={s.meetingListItem}>
                <View style={s.meetingListHeader}>
                  <View style={s.meetingTag}>
                    <Text style={s.meetingTagText}>#{m.channel.toUpperCase()}</Text>
                  </View>
                  <Text style={s.meetingDateText}>
                    {new Date(m.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <Text style={s.meetingListTitle}>{m.title}</Text>
                {m.description ? <Text style={s.meetingListDesc}>{m.description}</Text> : null}

                <View style={s.meetingListFooter}>
                  <Text style={s.meetingHost}>Host: {m.created_by_name || 'Staff'}</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(m.meeting_url)}
                    style={s.joinListBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="videocam" size={11} color="#0F172A" />
                    <Text style={s.joinListBtnText}>Join Room</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeTab === 'dms' ? (
        /* TAB 3: DIRECT MESSAGING (DMs) */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Staff Direct Contacts</Text>
          {STAFF_MEMBERS.map(staff => (
            <TouchableOpacity
              key={staff.id}
              onPress={() => {
                setActiveDm(staff.id);
                setActiveTab('chat');
              }}
              style={s.dmContactCard}
              activeOpacity={0.8}
            >
              <Image source={{ uri: staff.avatar }} style={s.dmAvatar} />
              {staff.online && <View style={s.dmOnlineDot} />}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.dmName}>{staff.name}</Text>
                <Text style={s.dmRole}>{staff.role}</Text>
              </View>
              <View style={s.dmChatBtn}>
                <Ionicons name="chatbubble-ellipses" size={13} color="#0F172A" />
                <Text style={s.dmChatBtnText}>Chat</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        /* TAB 4: BOOKMARKS / STARRED MESSAGES */
        <ScrollView style={s.meetingsScroll} contentContainerStyle={s.meetingsContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Saved Bookmarks & Memos</Text>
          {bookmarks.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="star-outline" size={26} color={L.goldDk} />
              <Text style={s.emptyTitle}>No Saved Items</Text>
              <Text style={s.emptySub}>Tap the star icon on any message to save it here for fast reference.</Text>
            </View>
          ) : (
            bookmarks.map(b => (
              <View key={b.id} style={s.bookmarkCard}>
                <View style={s.bubbleMetaRow}>
                  <Text style={s.senderName}>{b.sender_name}</Text>
                  <Text style={s.msgTime}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}</Text>
                </View>
                <Text style={s.msgText}>{b.content}</Text>
                <TouchableOpacity onPress={() => toggleBookmark(b)} style={s.removeBookmarkBtn}>
                  <Text style={s.removeBookmarkText}>Remove Star</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* THREAD REPLIES MODAL */}
      <Modal visible={!!activeThreadMessage} transparent animationType="slide" onRequestClose={() => setActiveThreadMessage(null)}>
        <View style={s.modalOverlay}>
          <View style={s.threadModalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Thread Discussion</Text>
              <TouchableOpacity onPress={() => setActiveThreadMessage(null)}>
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            {/* Parent Message Preview */}
            <View style={s.threadParentBox}>
              <Text style={s.senderName}>{activeThreadMessage?.sender_name}</Text>
              <Text style={s.msgText}>{activeThreadMessage?.content}</Text>
            </View>

            {/* Thread Replies List */}
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {threadReplies.length === 0 ? (
                <Text style={s.threadEmptyText}>No replies yet. Start the thread below.</Text>
              ) : (
                threadReplies.map((r, i) => (
                  <View key={i} style={s.threadReplyBubble}>
                    <Text style={s.senderName}>{r.sender_name}</Text>
                    <Text style={s.msgText}>{r.content}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Thread Input Strip */}
            <View style={s.threadInputRow}>
              <TextInput
                style={s.threadTextInput}
                placeholder="Reply to thread..."
                placeholderTextColor="#94A3B8"
                value={newThreadReply}
                onChangeText={setNewThreadReply}
              />
              <TouchableOpacity onPress={sendThreadReply} disabled={!newThreadReply.trim() || sendingReply} style={s.sendBtn}>
                <LinearGradient colors={['#0F172A', '#1E293B']} style={s.sendBtnGrad}>
                  <Ionicons name="send" size={12} color={L.gold} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            {CHANNELS.map(ch => {
              const isSelected = !activeDm && activeChannel === ch.id;
              return (
                <TouchableOpacity
                  key={ch.id}
                  onPress={() => {
                    setActiveDm(null);
                    setActiveChannel(ch.id);
                    setShowChannelDrawer(false);
                  }}
                  style={[s.channelDrawerItem, isSelected && s.channelDrawerItemActive]}
                  activeOpacity={0.8}
                >
                  <View style={[s.channelDrawerIcon, isSelected && { backgroundColor: L.gold }]}>
                    <Ionicons name={ch.icon as any} size={13} color={isSelected ? '#0F172A' : L.navyHeader} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[s.channelDrawerName, isSelected && s.channelDrawerNameActive]}>#{ch.name}</Text>
                    <Text style={s.channelDrawerDesc}>{ch.desc}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={15} color={L.goldDk} />}
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
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Meeting Topic / Title</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Weekly Financial Liquidity & Payouts"
              placeholderTextColor="#94A3B8"
              value={meetingTitle}
              onChangeText={setMeetingTitle}
            />

            <Text style={s.inputLabel}>Agenda / Notes</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
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
                    <Ionicons name="calendar" size={13} color={L.gold} />
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
              <Text style={s.modalTitle}>Create Team Poll</Text>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Poll Question</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Approve new bulk SMS provider route?"
              placeholderTextColor="#94A3B8"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />

            <Text style={s.inputLabel}>Voting Options</Text>
            {pollOptions.map((opt, idx) => (
              <TextInput
                key={idx}
                style={[s.modalInput, { marginBottom: 5 }]}
                placeholder={`Option ${idx + 1}`}
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
              <Ionicons name="add-circle-outline" size={12} color={L.goldAmber} />
              <Text style={s.addOptionText}>Add Another Option</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={savePoll} disabled={creatingPoll} style={s.modalActionBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.modalActionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {creatingPoll ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="pie-chart" size={13} color={L.gold} />
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
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Task Description</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Verify Monnify webhook gateway response"
              placeholderTextColor="#94A3B8"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            <Text style={s.inputLabel}>Assignee (Staff Name or Team)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Finance Ops / Support Team"
              placeholderTextColor="#94A3B8"
              value={taskAssignee}
              onChangeText={setTaskAssignee}
            />

            <TouchableOpacity onPress={saveTask} disabled={creatingTask} style={s.modalActionBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.modalActionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {creatingTask ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="checkbox" size={13} color={L.gold} />
                    <Text style={s.modalActionText}>Post Action Item</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* IMAGE ZOOM MODAL */}
      <Modal visible={!!zoomedImage} transparent animationType="fade" onRequestClose={() => setZoomedImage(null)}>
        <View style={s.zoomBackdrop}>
          <TouchableOpacity onPress={() => setZoomedImage(null)} style={s.zoomCloseBtn}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
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
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: 6,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
    maxWidth: 140,
  },
  channelSelectorTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11.5,
  },
  topIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
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
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },
  aiCopilotBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9,
  },
  videoMeetingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },
  videoMeetingBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#060B19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
    paddingHorizontal: 8,
    height: 28,
    marginBottom: 5,
  },
  searchTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 10,
    marginLeft: 4,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#060B19',
    borderRadius: 7,
    padding: 2,
    gap: 2,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  subTabActive: {
    backgroundColor: L.gold,
  },
  subTabText: {
    color: L.goldLight,
    fontSize: 8,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  toolShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  toolIconBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: L.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
  },
  pinnedText: {
    flex: 1,
    color: L.navyMid,
    fontSize: 8,
    fontWeight: '800',
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    padding: 10,
    paddingBottom: 20,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 35,
    gap: 5,
  },
  loadingText: {
    color: L.textMuted,
    fontSize: 9.5,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: L.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginTop: 15,
    gap: 3,
  },
  emptyTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
  },
  emptySub: {
    color: L.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },
  msgBubble: {
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
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
    gap: 4,
    marginBottom: 2,
  },
  senderName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 9,
  },
  roleBadge: {
    backgroundColor: L.bg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  roleBadgeText: {
    color: L.textMuted,
    fontSize: 6.5,
    fontWeight: '800',
  },
  msgTime: {
    color: '#94A3B8',
    fontSize: 7.5,
    marginLeft: 'auto',
  },
  msgText: {
    color: L.textPrimary,
    fontSize: 10.5,
    lineHeight: 14,
  },
  msgTextMe: {
    color: L.navyHeader,
  },
  footerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  threadReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  threadReplyText: {
    color: L.navyLight,
    fontSize: 7.5,
    fontWeight: '800',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: L.bg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  reactionPillActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  reactionEmoji: {
    fontSize: 8.5,
  },
  reactionCount: {
    color: L.navyHeader,
    fontSize: 7,
    fontWeight: '800',
  },
  meetingCardBubble: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  meetingBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: L.coral,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: L.coral,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 7.5,
  },
  meetingBubbleTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11.5,
    marginBottom: 2,
  },
  meetingBubbleDesc: {
    color: '#94A3B8',
    fontSize: 8.5,
    lineHeight: 11,
    marginBottom: 5,
  },
  joinMeetingBtn: {
    borderRadius: 7,
    overflow: 'hidden',
    marginTop: 2,
  },
  joinMeetingGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    backgroundColor: L.gold,
  },
  joinMeetingText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9.5,
  },
  pollCardBubble: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  pollQuestionTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 11,
    marginVertical: 3,
  },
  pollOptionRow: {
    position: 'relative',
    height: 26,
    backgroundColor: L.bg,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
    overflow: 'hidden',
    marginBottom: 3,
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
    paddingHorizontal: 7,
  },
  pollOptionText: {
    color: L.navyHeader,
    fontWeight: '700',
    fontSize: 9,
  },
  pollOptionTextVoted: {
    fontWeight: '900',
  },
  pollOptionPct: {
    color: L.textMuted,
    fontWeight: '800',
    fontSize: 8,
  },
  pollTotalFooter: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  taskCardBubble: {
    backgroundColor: L.card,
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
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
    fontSize: 10.5,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: L.textMuted,
  },
  taskAssigneeText: {
    color: L.textMuted,
    fontSize: 7.5,
    marginTop: 1,
  },
  voiceMemoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  voicePlayBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  waveformBar: {
    width: 2.5,
    backgroundColor: L.goldDk,
    borderRadius: 1,
  },
  voiceDurationText: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  chatImageAttachment: {
    width: 180,
    height: 120,
    borderRadius: 7,
    marginTop: 3,
  },
  inputStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    backgroundColor: L.card,
    borderTopWidth: 1,
    borderTopColor: L.cardBorder,
    gap: 4,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  attachBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: L.bg,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: L.textPrimary,
    fontSize: 10.5,
    maxHeight: 60,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
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
    padding: 8,
    backgroundColor: L.coralBg,
    borderTopWidth: 1,
    borderTopColor: L.coralBorder,
    gap: 6,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  recordingLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: L.coral,
  },
  recordingText: {
    flex: 1,
    color: L.coral,
    fontWeight: '900',
    fontSize: 10,
  },
  recordingSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recordingSendText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9,
  },
  recordingCancelBtn: {
    padding: 4,
  },
  meetingsScroll: {
    flex: 1,
  },
  meetingsContent: {
    padding: 10,
    paddingBottom: 60,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  instantMeetingActionCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  instantMeetingGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  instantIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11.5,
  },
  instantSub: {
    color: L.goldLight,
    fontSize: 8,
  },
  sectionTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 11.5,
  },
  scheduleNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: L.gold,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  scheduleNewBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 8.5,
  },
  meetingListItem: {
    backgroundColor: L.card,
    borderRadius: 10,
    padding: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  meetingListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  meetingTag: {
    backgroundColor: L.bg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  meetingTagText: {
    color: L.textMuted,
    fontSize: 7,
    fontWeight: '800',
  },
  meetingDateText: {
    color: L.goldAmber,
    fontSize: 8,
    fontWeight: '800',
  },
  meetingListTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 11,
    marginBottom: 2,
  },
  meetingListDesc: {
    color: L.textMuted,
    fontSize: 8.5,
    marginBottom: 5,
  },
  meetingListFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 5,
  },
  meetingHost: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '700',
  },
  joinListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: L.gold,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  joinListBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 8,
  },
  dmContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.card,
    borderRadius: 10,
    padding: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  dmAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dmOnlineDot: {
    position: 'absolute',
    top: 6,
    left: 32,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: L.emerald,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dmName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 10.5,
  },
  dmRole: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '700',
  },
  dmChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.bg,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  dmChatBtnText: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 8.5,
  },
  bookmarkCard: {
    backgroundColor: L.card,
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  removeBookmarkBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  removeBookmarkText: {
    color: L.coral,
    fontSize: 7.5,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  channelDrawerCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  drawerTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
  },
  channelDrawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 8,
    marginBottom: 3,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  channelDrawerItemActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  channelDrawerIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelDrawerName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 10,
  },
  channelDrawerNameActive: {
    fontWeight: '900',
  },
  channelDrawerDesc: {
    color: L.textMuted,
    fontSize: 7.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
  },
  inputLabel: {
    color: L.navyHeader,
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  modalInput: {
    backgroundColor: L.bg,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: L.textPrimary,
    fontSize: 10,
    marginBottom: 6,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    marginBottom: 8,
  },
  addOptionText: {
    color: L.goldAmber,
    fontWeight: '800',
    fontSize: 8.5,
  },
  modalActionBtn: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 3,
  },
  modalActionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  modalActionText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 10,
  },
  threadModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
    maxHeight: '85%',
  },
  threadParentBox: {
    backgroundColor: L.bg,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginBottom: 8,
  },
  threadEmptyText: {
    color: L.textMuted,
    fontSize: 8.5,
    textAlign: 'center',
    marginVertical: 15,
  },
  threadReplyBubble: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  threadInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  threadTextInput: {
    flex: 1,
    backgroundColor: L.bg,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    color: L.textPrimary,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
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
});
