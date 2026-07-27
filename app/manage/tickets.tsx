import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, RefreshControl, LayoutAnimation, UIManager, Alert, Modal, Linking, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { sendAdminReplyEmail } from '../../services/ticketEmail';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Ticket = {
    id: string;
    user_id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    profiles?: { full_name: string; avatar_url?: string; email?: string };
};

type TicketMessage = {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
    profiles?: { role?: string; avatar_url?: string; full_name?: string };
};

export default function SupportTickets() {
    const router = useRouter();
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [reply, setReply] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('All');
    const [timeFilter, setTimeFilter] = useState('All Time');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [userDetails, setUserDetails] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(false);
    
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchTickets();
        supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id || null));
    }, []);

    useEffect(() => {
        if (selectedTicket) {
            fetchMessages(selectedTicket.id);
        }
    }, [selectedTicket]);

    const fetchTickets = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select('*, profiles(full_name, avatar_url, email)')
                .order('created_at', { ascending: false });
            if (data) setTickets(data as any);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchMessages = async (ticketId: string) => {
        const { data } = await supabase
            .from('ticket_messages')
            .select('*, profiles:sender_id(role, avatar_url, full_name)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
        if (data) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMessages(data);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            const base64Str = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
            sendMessage(`[IMAGE] ${base64Str}`);
        }
    };

    const sendMessage = async (text: string = reply) => {
        if (!text.trim() || !selectedTicket) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { error } = await supabase
                .from('ticket_messages')
                .insert({
                    ticket_id: selectedTicket.id,
                    sender_id: user.id,
                    message: text.trim()
                });

            if (error) {
                Alert.alert('Error Sending', error.message);
                console.error("Reply error:", error);
            } else {
                if (text === reply) setReply('');
                fetchMessages(selectedTicket.id);

                // Trigger Push Notification
                supabase.from('notifications').insert({
                    user_id: selectedTicket.user_id,
                    title: 'New Reply from Support',
                    body: text.trim().startsWith('[IMAGE]') ? 'Admin sent an image' : text.trim(),
                    data: { route: `/ai-chat?ticketId=${selectedTicket.id}` },
                    read: false
                }).then();

                // 📧 AUTOMATIC EMAIL NOTIFICATION TO USER
                if (selectedTicket.profiles?.email) {
                    sendAdminReplyEmail(
                        selectedTicket.id,
                        selectedTicket.subject,
                        text.trim(),
                        selectedTicket.profiles.email,
                        selectedTicket.profiles.full_name
                    );
                }
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to send message');
        }
    };

    const changeTicketStatus = async (status: string) => {
        if (!selectedTicket) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        // Optimistic update
        setSelectedTicket({ ...selectedTicket, status });
        
        const { error } = await supabase
            .from('tickets')
            .update({ status })
            .eq('id', selectedTicket.id);
            
        if (error) {
            Alert.alert('Error', 'Failed to update ticket status');
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Log action to messages
                await supabase.from('ticket_messages').insert({
                    ticket_id: selectedTicket.id,
                    sender_id: user.id,
                    message: `[SYSTEM] Changed ticket status to ${status.toUpperCase()}`
                });
            }
            fetchTickets();
            fetchMessages(selectedTicket.id);
        }
    };

    const openUserModal = async (userId: string) => {
        setShowUserModal(true);
        setLoadingUser(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (data) setUserDetails(data);
        setLoadingUser(false);
    };

    const toggleUserStatus = async () => {
        if (!userDetails) return;
        const newStatus = userDetails.status === 'active' ? 'suspended' : 'active';
        const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userDetails.id);
        if (!error) {
            setUserDetails({ ...userDetails, status: newStatus });
            Alert.alert('Success', `User account ${newStatus}`);
        } else {
            Alert.alert('Error', 'Failed to update user status');
        }
    };

    const resolveTicket = async () => {
        await changeTicketStatus('resolved');
    };

    const resolveSelectedTickets = async () => {
        if (selectedIds.length === 0) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const { error } = await supabase
            .from('tickets')
            .update({ status: 'resolved' })
            .in('id', selectedIds);
            
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Log action to messages for all resolved tickets
                const messages = selectedIds.map(id => ({
                    ticket_id: id,
                    sender_id: user.id,
                    message: `[SYSTEM] Changed ticket status to RESOLVED (Bulk Action)`
                }));
                await supabase.from('ticket_messages').insert(messages);
            }
            
            Alert.alert('Success', `${selectedIds.length} tickets resolved`);
            setSelectMode(false);
            setSelectedIds([]);
            fetchTickets();
        } else {
            Alert.alert('Error', 'Failed to resolve tickets');
        }
    };

    const toggleSelection = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (selectedIds.includes(id)) {
            const newIds = selectedIds.filter(i => i !== id);
            setSelectedIds(newIds);
            if (newIds.length === 0) setSelectMode(false);
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const copyTicketId = async (id: string) => {
        await Clipboard.setStringAsync(id);
        Alert.alert('Copied', 'Ticket ID copied to clipboard');
    };

    // Derived State
    const openCount = tickets.filter(t => t.status === 'open').length;
    const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
    const totalCount = tickets.length;

    // Filter & Search Logic
    const filteredTickets = tickets.filter(t => {
        const matchesFilter = 
            activeFilter === 'All' ? true :
            activeFilter === 'Open' ? t.status === 'open' :
            activeFilter === 'In Progress' ? t.status === 'in_progress' :
            t.status === 'resolved';

        let matchesTime = true;
        const ticketDate = new Date(t.created_at);
        const today = new Date();
        if (timeFilter === 'Today') {
            matchesTime = ticketDate.toDateString() === today.toDateString();
        } else if (timeFilter === 'This Week') {
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);
            matchesTime = ticketDate >= weekAgo;
        }

        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            t.subject?.toLowerCase().includes(searchLower) ||
            t.profiles?.full_name?.toLowerCase().includes(searchLower) ||
            t.id.toLowerCase().includes(searchLower);

        return matchesFilter && matchesTime && matchesSearch;
    });

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const renderTicketList = () => (
        <View className="flex-1 bg-[#040814]">
            {/* Ultra-Modern Compact Glass Header */}
            <View className="bg-[#060d21] pt-12 pb-3 px-4 border-b border-slate-800/80 shadow-lg">
                <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center gap-2.5">
                        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-slate-900 rounded-full items-center justify-center border border-slate-800">
                            <Ionicons name="chevron-back" size={18} color="#f5a623" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-lg font-black text-white tracking-tight">Admin Support Desk</Text>
                            <View className="flex-row items-center gap-1.5 mt-0.5">
                                <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{openCount} Needs Action</Text>
                            </View>
                        </View>
                    </View>
                    <View className="flex-row gap-1.5">
                        <TouchableOpacity onPress={() => fetchTickets(true)} className="w-9 h-9 rounded-full bg-slate-900 items-center justify-center border border-slate-800">
                            <Ionicons name="refresh" size={16} color="#f5a623" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* METRICS ROW */}
                <View className="flex-row gap-2 mb-3">
                    <View className="flex-1 bg-slate-900/90 border border-slate-800 p-2 rounded-xl items-center">
                        <Text className="text-slate-400 text-[9px] font-bold uppercase">Total</Text>
                        <Text className="text-white font-extrabold text-[13px]">{totalCount}</Text>
                    </View>
                    <View className="flex-1 bg-rose-500/10 border border-rose-500/30 p-2 rounded-xl items-center">
                        <Text className="text-rose-400 text-[9px] font-bold uppercase">🔴 Open</Text>
                        <Text className="text-rose-400 font-extrabold text-[13px]">{openCount}</Text>
                    </View>
                    <View className="flex-1 bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl items-center">
                        <Text className="text-emerald-400 text-[9px] font-bold uppercase">🟢 Closed</Text>
                        <Text className="text-emerald-400 font-extrabold text-[13px]">{resolvedCount}</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View className="bg-slate-900 border border-slate-800 rounded-full flex-row items-center px-3.5 h-10">
                    <Ionicons name="search" size={16} color="#64748b" />
                    <TextInput 
                        placeholder="Search tickets, names, or IDs..."
                        placeholderTextColor="#64748b"
                        className="flex-1 ml-2 text-white font-bold text-[12.5px] h-full"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5 flex-row">
                    {['All', 'Open', 'In Progress', 'Resolved'].map((filter) => {
                        const isActive = activeFilter === filter;
                        return (
                            <TouchableOpacity 
                                key={filter} 
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setActiveFilter(filter);
                                }}
                                className={`px-3 py-1 rounded-full border mr-1.5 ${
                                    isActive 
                                        ? 'bg-[#f5a623]/20 border-[#f5a623]' 
                                        : 'bg-slate-900 border-slate-800'
                                }`}
                            >
                                <Text className={`font-bold text-[10.5px] uppercase ${isActive ? 'text-[#f5a623]' : 'text-slate-400'}`}>
                                    {filter}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {selectMode && (
                <View className="bg-indigo-900 px-4 py-2 flex-row justify-between items-center z-20 border-b border-indigo-700">
                    <Text className="text-white font-bold text-[12px]">{selectedIds.length} Selected</Text>
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds([]); }} className="px-2.5 py-1 bg-white/20 rounded-full">
                            <Text className="text-white text-[11px] font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={resolveSelectedTickets} className="px-3 py-1 bg-emerald-500 rounded-full">
                            <Text className="text-white text-[11px] font-bold uppercase">Resolve All</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="small" color="#f5a623" />
                </View>
            ) : (
                <FlatList
                    data={filteredTickets}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 10, paddingBottom: 90 }}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={() => fetchTickets(true)} 
                            tintColor="#f5a623" 
                        />
                    }
                    ListEmptyComponent={() => (
                        <View className="items-center justify-center mt-20">
                            <View className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-full items-center justify-center mb-3">
                                <Ionicons name="file-tray-outline" size={28} color="#f5a623" />
                            </View>
                            <Text className="text-base font-bold text-white">No Support Tickets Found</Text>
                            <Text className="text-slate-400 mt-1 text-[11px] text-center px-10">
                                {searchQuery ? 'No tickets match your search query.' : 'There are no active tickets matching your filter.'}
                            </Text>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                        <TouchableOpacity
                            onLongPress={() => {
                                setSelectMode(true);
                                toggleSelection(item.id);
                            }}
                            onPress={() => {
                                if (selectMode) toggleSelection(item.id);
                                else setSelectedTicket(item);
                            }}
                            className={`bg-slate-900/90 p-3 rounded-xl mb-2 border ${
                                isSelected ? 'border-indigo-500 bg-indigo-950/40' : 'border-slate-800/80'
                            } shadow-md active:scale-[0.99]`}
                        >
                            <View className="flex-row justify-between items-start mb-1.5">
                                <View className="flex-row items-center gap-2">
                                    {selectMode ? (
                                        <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${isSelected ? 'bg-[#f5a623] border-[#f5a623]' : 'border-slate-700'}`}>
                                            {isSelected && <Ionicons name="checkmark" size={14} color="#060d21" />}
                                        </View>
                                    ) : item.profiles?.avatar_url ? (
                                        <Image source={{ uri: item.profiles.avatar_url }} className="w-8 h-8 rounded-full border border-slate-700" />
                                    ) : (
                                        <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center border border-slate-700">
                                            <Text className="font-black text-slate-300 text-[10px]">{getInitials(item.profiles?.full_name || 'Anonym')}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text className="font-extrabold text-white text-[13px]">{item.profiles?.full_name || 'Anonymous User'}</Text>
                                        <Text className="text-[9.5px] font-semibold text-slate-400 mt-0.5">#{item.id.split('-')[0]} • {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                                    </View>
                                </View>

                                {/* Priority Badge */}
                                <View className={`px-2 py-0.5 rounded-full border ${
                                    item.priority === 'high' ? 'bg-rose-500/10 border-rose-500/30' :
                                    item.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800 border-slate-700'
                                }`}>
                                    <Text className={`text-[8px] uppercase font-black tracking-wider ${
                                        item.priority === 'high' ? 'text-rose-400' :
                                        item.priority === 'medium' ? 'text-amber-400' : 'text-slate-400'
                                    }`}>{item.priority}</Text>
                                </View>
                            </View>
                            
                            <Text className="text-slate-300 font-medium text-[12px] mb-2 leading-4 pl-[40px]" numberOfLines={2}>{item.subject}</Text>

                            {/* Action Row */}
                            <View className="flex-row items-center justify-between pt-2 border-t border-slate-800/60 ml-[40px]">
                                <View className={`px-2 py-0.5 rounded-full border ${
                                    item.status === 'open' ? 'bg-rose-500/10 border-rose-500/30' :
                                    item.status === 'in_progress' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
                                }`}>
                                    <Text className={`text-[8.5px] font-extrabold ${
                                        item.status === 'open' ? 'text-rose-400' :
                                        item.status === 'in_progress' ? 'text-blue-400' : 'text-emerald-400'
                                    }`}>
                                        {item.status === 'open' ? '🔴 OPEN' : item.status === 'in_progress' ? '🔵 ACTIVE' : '🟢 CLOSED'}
                                    </Text>
                                </View>

                                {/* Direct Actions */}
                                <View className="flex-row gap-1.5">
                                    {item.status !== 'resolved' && (
                                        <TouchableOpacity 
                                            onPress={async () => {
                                                const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', item.id);
                                                if (!error) fetchTickets();
                                            }}
                                            className="bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex-row items-center gap-1"
                                        >
                                            <Ionicons name="checkmark" size={10} color="#34d399" />
                                            <Text className="text-emerald-400 text-[8.5px] font-black uppercase">Resolve</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity 
                                        onPress={() => setSelectedTicket(item)}
                                        className="bg-[#f5a623] px-2.5 py-0.5 rounded-full flex-row items-center gap-1 shadow-sm"
                                    >
                                        <Ionicons name="chatbubbles" size={10} color="#060d21" />
                                        <Text className="text-[#060d21] text-[8.5px] font-black uppercase">Reply</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    );

    const renderChatInterface = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#f1f5f9]">
            {/* Header */}
            <View className="bg-white pt-12 pb-3 px-4 border-b border-slate-200/60 shadow-sm z-10 flex-col">
                <View className="flex-row items-center gap-3 mb-3">
                    <TouchableOpacity onPress={() => setSelectedTicket(null)} className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center active:bg-slate-100">
                        <Ionicons name="chevron-back" size={20} color="#0d1b3e" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => openUserModal(selectedTicket?.user_id || '')} className="flex-1 flex-row items-center gap-3">
                        {selectedTicket?.profiles?.avatar_url ? (
                            <Image source={{ uri: selectedTicket.profiles.avatar_url }} className="w-10 h-10 rounded-full border border-[#d4af37]" />
                        ) : (
                            <View className="w-10 h-10 rounded-full bg-[#0d1b3e] items-center justify-center border border-[#d4af37]">
                                <Text className="font-bold text-[#d4af37] text-xs">{getInitials(selectedTicket?.profiles?.full_name || 'A')}</Text>
                            </View>
                        )}
                        <View className="flex-1">
                            <Text className="font-extrabold text-[#0d1b3e] text-[15px]">{selectedTicket?.profiles?.full_name || 'Anonymous'}</Text>
                            <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                                <Text className="text-slate-500 text-[10px] font-bold">Ticket #{selectedTicket?.id?.split('-')[0]}</Text>
                                <View className={`px-1.5 py-0.5 rounded-sm ${
                                    selectedTicket?.priority === 'high' ? 'bg-rose-100' :
                                    selectedTicket?.priority === 'medium' ? 'bg-orange-100' : 'bg-slate-100'
                                }`}>
                                    <Text className={`text-[8px] font-bold uppercase tracking-wider ${
                                        selectedTicket?.priority === 'high' ? 'text-rose-600' :
                                        selectedTicket?.priority === 'medium' ? 'text-orange-600' : 'text-slate-500'
                                    }`}>
                                        {selectedTicket?.priority || 'normal'}
                                    </Text>
                                </View>
                                <View className="bg-slate-100 px-1.5 py-0.5 rounded-sm"><Text className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">View Profile</Text></View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Status Toggle Buttons */}
                <View className="flex-row justify-around bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <TouchableOpacity onPress={() => changeTicketStatus('open')} className={`flex-1 items-center py-1.5 rounded-md ${selectedTicket?.status === 'open' ? 'bg-white shadow-sm border border-slate-100' : ''}`}>
                        <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedTicket?.status === 'open' ? 'text-rose-600' : 'text-slate-400'}`}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeTicketStatus('in_progress')} className={`flex-1 items-center py-1.5 rounded-md ${selectedTicket?.status === 'in_progress' ? 'bg-white shadow-sm border border-slate-100' : ''}`}>
                        <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedTicket?.status === 'in_progress' ? 'text-blue-600' : 'text-slate-400'}`}>In Progress</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeTicketStatus('resolved')} className={`flex-1 items-center py-1.5 rounded-md ${selectedTicket?.status === 'resolved' ? 'bg-white shadow-sm border border-slate-100' : ''}`}>
                        <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedTicket?.status === 'resolved' ? 'text-emerald-600' : 'text-slate-400'}`}>Resolved</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Area */}
            <ScrollView 
                ref={scrollViewRef} 
                className="flex-1 px-4 py-6" 
                contentContainerStyle={{ paddingBottom: 20 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
                {selectedTicket && messages.length > 0 ? (
                    Object.entries(
                        messages.reduce((acc, msg) => {
                            const dateStr = new Date(msg.created_at).toDateString();
                            if (!acc[dateStr]) acc[dateStr] = [];
                            acc[dateStr].push(msg);
                            return acc;
                        }, {} as Record<string, TicketMessage[]>)
                    ).map(([dateStr, dateMessages]) => {
                        const today = new Date().toDateString();
                        const yesterday = new Date(Date.now() - 86400000).toDateString();
                        let displayDate = dateStr;
                        if (dateStr === today) displayDate = 'Today';
                        else if (dateStr === yesterday) displayDate = 'Yesterday';
                        else {
                            displayDate = new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                        }

                        return (
                            <View key={dateStr}>
                                {/* Date Separator */}
                                <View className="items-center my-5">
                                    <View className="bg-slate-200/50 px-4 py-1.5 rounded-full border border-slate-200">
                                        <Text className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">{displayDate}</Text>
                                    </View>
                                </View>

                                {/* Messages for this Date */}
                                {dateMessages.map((m: any) => {
                                    // Admins (and super_admins) are always on the right side
                                    const isMe = m.profiles?.role === 'admin' || m.profiles?.role === 'super_admin';
                                    
                                    if (m.message.startsWith('[SYSTEM]')) {
                                        return (
                                            <View key={m.id} className="w-full my-2 items-center justify-center">
                                                <View className="bg-slate-200/50 px-4 py-1.5 rounded-full flex-row items-center gap-1.5 border border-slate-200">
                                                    <Ionicons name="information-circle-outline" size={12} color="#64748b" />
                                                    <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                        {m.profiles?.full_name || 'Admin'} {m.message.replace('[SYSTEM]', '').trim()}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    }

                                    return (
                                        <View key={m.id} className={`mb-3 w-full flex-row items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!isMe && (
                                                <TouchableOpacity onPress={() => openUserModal(selectedTicket.user_id)}>
                                                    {m.profiles?.avatar_url ? (
                                                        <Image source={{ uri: m.profiles.avatar_url }} className="w-7 h-7 rounded-full border border-slate-300" />
                                                    ) : (
                                                        <View className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 items-center justify-center">
                                                            <Text className="font-bold text-slate-500 text-[9px]">{getInitials(m.profiles?.full_name || selectedTicket?.profiles?.full_name || 'U')}</Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            <View className={`max-w-[82%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                {isMe && <Text className="text-[10px] text-slate-400 mb-1 pr-2 font-medium">{m.profiles?.full_name || 'Admin'}</Text>}
                                                <TouchableOpacity 
                                                    activeOpacity={0.9}
                                                    onLongPress={async () => {
                                                        if (!m.message.startsWith('[IMAGE]')) {
                                                            await Clipboard.setStringAsync(m.message);
                                                            Alert.alert('Copied', 'Message text copied to clipboard');
                                                        }
                                                    }}
                                                >
                                                    <View className={`px-4 py-3 shadow-sm shadow-slate-200/40 ${
                                                        m.message.startsWith('[IMAGE]') ? 'bg-transparent p-0 shadow-none' :
                                                        (isMe ? 'bg-[#0d1b3e] rounded-3xl rounded-br-md border border-[#d4af37]/30' : 'bg-white rounded-3xl rounded-bl-md border border-slate-100/50')
                                                    }`}>
                                                        {m.message.startsWith('[IMAGE]') ? (
                                                            <Image 
                                                                source={{ uri: m.message.replace('[IMAGE] ', '').trim() }} 
                                                                className="w-56 h-72 rounded-3xl bg-slate-200"
                                                                resizeMode="cover"
                                                            />
                                                        ) : (
                                                            <Text className={`${isMe ? 'text-[#d4af37]' : 'text-slate-800'} text-[16px] leading-[22px]`}>
                                                                {m.message}
                                                            </Text>
                                                        )}
                                                        <View className={`flex-row items-center mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                            <Text className={`text-[9px] font-medium ${isMe ? (m.message.startsWith('[IMAGE]') ? 'text-gray-500' : 'text-[#d4af37]/60') : 'text-slate-400'}`}>
                                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </Text>
                                                            {isMe && <Ionicons name="checkmark-done" size={12} color="#d4af37" className="ml-1 opacity-70" />}
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                            {isMe && (
                                                <TouchableOpacity onPress={() => openUserModal(m.sender_id)}>
                                                    {m.profiles?.avatar_url ? (
                                                        <Image source={{ uri: m.profiles.avatar_url }} className="w-7 h-7 rounded-full border border-[#d4af37]" />
                                                    ) : (
                                                        <View className="w-7 h-7 rounded-full bg-[#0d1b3e] border border-[#d4af37] items-center justify-center">
                                                            <Text className="font-bold text-[#d4af37] text-[9px]">{getInitials(m.profiles?.full_name || 'A')}</Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })
                ) : (
                    <View className="flex-1 items-center justify-center mt-20">
                        <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="chatbubbles-outline" size={32} color="#0d1b3e" />
                        </View>
                        <Text className="text-gray-400 font-medium">No messages yet</Text>
                    </View>
                )}
            </ScrollView>

            {/* Input Area & FAB */}
            {selectedTicket?.status !== 'resolved' && (
                <View className="bg-[#f8fafc] border-t border-slate-200/50">
                    
                    {/* Quick Replies */}
                    <View className="px-3 py-2 border-b border-slate-100/50">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {[
                                "Muna duba wannan yanzu.", 
                                "An gyara matsalar, ka sake gwadawa.", 
                                "Don Allah ka turo mana screenshot.", 
                                "Za mu tuntube ka nan ba da jimawa ba."
                            ].map((qr, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    onPress={() => sendMessage(qr)} 
                                    className="bg-white border border-slate-200 px-3 py-1.5 rounded-full mr-2 shadow-sm shadow-slate-100"
                                >
                                    <Text className="text-[11px] text-[#0d1b3e] font-medium">{qr}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View className="px-4 pb-10 pt-3 flex-row items-end gap-2">
                        {selectedTicket?.profiles?.avatar_url ? (
                            <Image source={{ uri: selectedTicket.profiles.avatar_url }} className="h-12 w-12 rounded-full border border-slate-200 shadow-sm" />
                        ) : (
                            <View className="h-12 w-12 rounded-full bg-[#0d1b3e] items-center justify-center border border-[#d4af37] shadow-sm">
                                <Text className="font-bold text-[#d4af37] text-lg">{getInitials(selectedTicket?.profiles?.full_name || 'U')}</Text>
                            </View>
                        )}
                        <View className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm shadow-slate-100 overflow-hidden">
                            {/* Toolbar (AI, Private Note) */}
                            <View className="flex-row justify-between items-center px-3 py-2 border-b border-slate-100 bg-slate-50">
                                <TouchableOpacity className="flex-row items-center gap-1 bg-[#0d1b3e]/5 px-2 py-1 rounded-full">
                                    <Ionicons name="sparkles" size={12} color="#f5a623" />
                                    <Text className="text-[#f5a623] text-[9px] font-black uppercase tracking-wider">AI Draft</Text>
                                </TouchableOpacity>
                                
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Internal Note</Text>
                                    <Switch trackColor={{false: '#e2e8f0', true: '#f5a623'}} thumbColor="#fff" style={{ transform: [{ scale: 0.6 }] }} />
                                </View>
                            </View>

                            <View className="flex-row items-end gap-1 pl-1 pr-1.5 py-1.5">
                                <TouchableOpacity 
                                    onPress={pickImage}
                                    className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-50 mb-0.5"
                                >
                                    <Ionicons name="image-outline" size={20} color="#64748b" />
                                </TouchableOpacity>
                            <TextInput 
                                className="flex-1 py-3 px-1 text-slate-800 text-[16px] max-h-28 leading-5 font-medium"
                                placeholder="Type a reply..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                value={reply}
                                onChangeText={setReply}
                            />
                            {reply.trim() || reply.startsWith('[IMAGE]') ? (
                                <TouchableOpacity 
                                    onPress={() => sendMessage()}
                                    className="mb-0.5 ml-1 rounded-full overflow-hidden active:scale-95 shadow-md shadow-[#0d1b3e]/30"
                                >
                                    <View className="bg-[#0d1b3e] h-10 w-10 items-center justify-center border border-[#d4af37]/50 rounded-full">
                                        <Ionicons name="arrow-up" size={20} color="#d4af37" />
                                    </View>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </View>
            </View>
        )}
            {/* User Profile Modal */}
            <Modal visible={showUserModal} transparent animationType="slide" onRequestClose={() => setShowUserModal(false)}>
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity className="flex-1" onPress={() => setShowUserModal(false)} />
                    <View className="bg-white rounded-t-3xl min-h-[50%] p-6 shadow-2xl pb-10">
                        
                        <View className="absolute top-4 right-4 z-20">
                            <TouchableOpacity onPress={() => setShowUserModal(false)} className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View className="items-center mb-6">
                            <View className="w-16 h-1.5 bg-slate-200 rounded-full mb-4" />
                            {selectedTicket?.profiles?.avatar_url ? (
                                <Image source={{ uri: selectedTicket.profiles.avatar_url }} className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-sm" />
                            ) : (
                                <View className="w-20 h-20 rounded-full bg-[#0d1b3e] items-center justify-center border-4 border-slate-50 shadow-sm">
                                    <Text className="font-extrabold text-[#d4af37] text-2xl">{getInitials(selectedTicket?.profiles?.full_name || 'A')}</Text>
                                </View>
                            )}
                            <Text className="text-xl font-black text-slate-800 mt-3">{selectedTicket?.profiles?.full_name || 'Anonymous User'}</Text>
                            <Text className="text-slate-500 font-medium text-sm">{userDetails?.email || 'Loading email...'}</Text>
                            
                            {userDetails && (
                                <View className={`mt-2 px-3 py-1 rounded-full ${userDetails.status === 'active' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                    <Text className={`text-[10px] uppercase font-black tracking-widest ${userDetails.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {userDetails.status}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {loadingUser ? (
                            <ActivityIndicator size="large" color="#0d1b3e" className="mt-10" />
                        ) : userDetails ? (
                            <ScrollView showsVerticalScrollIndicator={false} className="w-full">
                                <View className="flex-row justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                    <View className="items-center flex-1 border-r border-slate-200">
                                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Wallet</Text>
                                        <Text className="text-emerald-600 font-black text-sm">₦{userDetails.balance?.toLocaleString() || '0'}</Text>
                                    </View>
                                    <View className="items-center flex-1 border-r border-slate-200">
                                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">KYC Tier</Text>
                                        <Text className="text-[#0d1b3e] font-black text-sm">Tier {userDetails.kyc_tier || 1}</Text>
                                    </View>
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Joined</Text>
                                        <Text className="text-[#0d1b3e] font-black text-xs mt-0.5">{new Date(userDetails.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
                                    </View>
                                </View>

                                <Text className="text-slate-800 font-bold mb-3 px-1 text-[13px] uppercase tracking-wider">Complete User Data</Text>

                                <View className="bg-white border border-slate-100 rounded-2xl p-4 mb-6 shadow-sm shadow-slate-100/50">
                                    {[
                                        { label: 'Role', value: userDetails.role, icon: 'shield-checkmark-outline', color: '#8b5cf6' },
                                        { label: 'Username', value: userDetails.username || 'N/A', icon: 'at-circle-outline', color: '#f59e0b' },
                                        { label: 'Phone', value: userDetails.phone || 'N/A', icon: 'call-outline', color: '#10b981' },
                                        { label: 'Custom ID', value: userDetails.custom_id || 'N/A', icon: 'finger-print-outline', color: '#3b82f6' },
                                        { label: 'BVN', value: userDetails.bvn ? 'Linked' : 'Not Linked', icon: 'card-outline', color: '#64748b' },
                                        { label: 'Reward Points', value: userDetails.reward_points || '0', icon: 'star-outline', color: '#d4af37' },
                                        { label: 'Monthly Profit', value: `₦${userDetails.monthly_profit?.toLocaleString() || '0'}`, icon: 'trending-up-outline', color: '#14b8a6' },
                                        { label: 'Referral Code', value: userDetails.referral_code || 'N/A', icon: 'people-outline', color: '#ec4899' },
                                        { label: 'Referral Balance', value: `₦${userDetails.referral_balance?.toLocaleString() || '0'}`, icon: 'gift-outline', color: '#f43f5e' },
                                    ].map((item, index) => (
                                        <View key={index} className={`flex-row items-center justify-between py-3 ${index !== 8 ? 'border-b border-slate-50' : ''}`}>
                                            <View className="flex-row items-center gap-3">
                                                <Ionicons name={item.icon as any} size={18} color={item.color} />
                                                <Text className="text-slate-500 font-medium text-[13px]">{item.label}</Text>
                                            </View>
                                            <Text className="text-slate-800 font-bold text-[13px]">{item.value}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Text className="text-slate-800 font-bold mb-3 px-1 text-[13px] uppercase tracking-wider mt-4">Quick Actions</Text>
                                
                                <View className="flex-row gap-2 mb-4">
                                    <TouchableOpacity 
                                        onPress={async () => { await Clipboard.setStringAsync(userDetails.email); Alert.alert('Copied', 'Email copied'); }}
                                        className="flex-1 items-center justify-center bg-slate-50 p-3 rounded-xl border border-slate-100 active:bg-slate-100"
                                    >
                                        <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mb-2"><Ionicons name="copy-outline" size={16} color="#3b82f6" /></View>
                                        <Text className="text-slate-600 font-bold text-[10px] uppercase">Copy Email</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (userDetails.phone) Linking.openURL(`tel:${userDetails.phone}`);
                                            else Alert.alert('Error', 'No phone number found');
                                        }}
                                        className="flex-1 items-center justify-center bg-slate-50 p-3 rounded-xl border border-slate-100 active:bg-slate-100"
                                    >
                                        <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center mb-2"><Ionicons name="call-outline" size={16} color="#10b981" /></View>
                                        <Text className="text-slate-600 font-bold text-[10px] uppercase">Call User</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (userDetails.email) {
                                                setShowUserModal(false);
                                                router.push(`/manage/communications?tab=email&recipient=${encodeURIComponent(userDetails.email)}`);
                                            }
                                        }}
                                        className="flex-1 items-center justify-center bg-slate-50 p-3 rounded-xl border border-slate-100 active:bg-slate-100"
                                    >
                                        <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mb-2"><Ionicons name="mail-outline" size={16} color="#6366f1" /></View>
                                        <Text className="text-slate-600 font-bold text-[10px] uppercase">Send Email</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity 
                                    onPress={toggleUserStatus}
                                    className={`flex-row items-center justify-between p-4 rounded-xl mb-10 active:opacity-80 ${userDetails.status === 'active' ? 'bg-rose-50' : 'bg-emerald-50'}`}
                                >
                                    <View className="flex-row items-center gap-3">
                                        <View className={`w-8 h-8 rounded-full items-center justify-center ${userDetails.status === 'active' ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                                            <Ionicons name={userDetails.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'} size={18} color={userDetails.status === 'active' ? '#e11d48' : '#10b981'} />
                                        </View>
                                        <Text className={`font-bold ${userDetails.status === 'active' ? 'text-rose-700' : 'text-emerald-700'}`}>
                                            {userDetails.status === 'active' ? 'Suspend User Account' : 'Reactivate User Account'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );

    return (
        <View className="flex-1 bg-[#f8fafc]">
            <Stack.Screen options={{ headerShown: false }} />
            {selectedTicket ? renderChatInterface() : renderTicketList()}
        </View>
    );
}
