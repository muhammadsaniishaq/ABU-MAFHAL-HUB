import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, RefreshControl, LayoutAnimation, UIManager, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

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
    profiles?: { full_name: string };
};

type TicketMessage = {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
};

export default function SupportTickets() {
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
    
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchTickets();
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
                .select('*, profiles(full_name)')
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
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
        if (data) setMessages(data);
    };

    const sendMessage = async () => {
        if (!reply.trim() || !selectedTicket) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: selectedTicket.id,
                sender_id: user.id,
                message: reply.trim()
            });

        if (!error) {
            setReply('');
            fetchMessages(selectedTicket.id);

            // Trigger Push Notification
            await supabase.from('notifications').insert({
                user_id: selectedTicket.user_id,
                title: 'New Reply from Support',
                body: reply.trim().startsWith('[IMAGE]') ? 'Admin sent an image' : reply.trim(),
                data: { route: `/ai-chat?ticketId=${selectedTicket.id}` },
                read: false
            });
        }
    };

    const resolveTicket = async () => {
        if (!selectedTicket) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const { error } = await supabase
            .from('tickets')
            .update({ status: 'resolved' })
            .eq('id', selectedTicket.id);
        if (!error) {
            setSelectedTicket(null);
            fetchTickets();
        }
    };

    const resolveSelectedTickets = async () => {
        if (selectedIds.length === 0) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const { error } = await supabase
            .from('tickets')
            .update({ status: 'resolved' })
            .in('id', selectedIds);
            
        if (!error) {
            setSelectMode(false);
            setSelectedIds([]);
            fetchTickets();
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
        <View className="flex-1 bg-[#f8fafc]">
            {/* Navy & Gold Gradient Dashboard */}
            <View className="relative shadow-lg shadow-[#0d1b3e]/20 z-10">
                <LinearGradient 
                    colors={['#020617', '#0f172a', '#1e293b']} 
                    locations={[0, 0.6, 1]}
                    start={{x: 0.5, y: 0}} end={{x: 0.5, y: 1}}
                    className="px-4 pt-12 pb-6 rounded-b-[32px] overflow-hidden relative"
                >
                    {/* Glowing Decorative Orbs */}
                    <View className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-indigo-500 opacity-20" style={{ transform: [{ scale: 1.5 }] }} />
                    <View className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-emerald-500 opacity-10" style={{ transform: [{ scale: 1.5 }] }} />

                <View className="flex-row justify-between items-center mb-4">
                    <View>
                        <Text className="text-lg font-extrabold text-white">Tickets Manager</Text>
                        <Text className="text-[#d4af37] text-xs font-bold uppercase tracking-widest mt-1">Admin Portal</Text>
                    </View>
                    <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/20">
                        <Ionicons name="stats-chart" size={18} color="#d4af37" />
                    </View>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-white/10 rounded-xl px-3 py-1.5 mb-4 border border-white/15">
                    <Ionicons name="search" size={16} color="#d4af37" />
                    <TextInput 
                        placeholder="Search tickets, names, IDs..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        className="flex-1 ml-2 text-white font-medium text-[12px]"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
                
                {/* Glassmorphic Metric Cards */}
                <View className="flex-row justify-between gap-2">
                    <BlurView intensity={20} tint="light" className="flex-1 overflow-hidden rounded-xl border border-white/20 p-2 items-center">
                        <View className="w-5 h-5 rounded-full bg-[#d4af37]/20 items-center justify-center mb-1">
                            <Ionicons name="documents" size={10} color="#d4af37" />
                        </View>
                        <Text className="text-xl font-black text-white">{totalCount}</Text>
                        <Text className="text-[9px] font-bold text-white/70 mt-0.5 uppercase tracking-wider">Total</Text>
                    </BlurView>
                    
                    <BlurView intensity={20} tint="light" className="flex-1 overflow-hidden rounded-xl border border-white/20 p-2 items-center">
                        <View className="w-5 h-5 rounded-full bg-rose-500/20 items-center justify-center mb-1">
                            <Ionicons name="alert-circle" size={10} color="#f43f5e" />
                        </View>
                        <Text className="text-xl font-black text-white">{openCount}</Text>
                        <Text className="text-[9px] font-bold text-white/70 mt-0.5 uppercase tracking-wider">Open</Text>
                    </BlurView>

                    <BlurView intensity={20} tint="light" className="flex-1 overflow-hidden rounded-xl border border-white/20 p-2 items-center">
                        <View className="w-5 h-5 rounded-full bg-emerald-500/20 items-center justify-center mb-1">
                            <Ionicons name="checkmark-circle" size={10} color="#10b981" />
                        </View>
                        <Text className="text-xl font-black text-white">{resolvedCount}</Text>
                        <Text className="text-[9px] font-bold text-white/70 mt-0.5 uppercase tracking-wider">Resolved</Text>
                    </BlurView>
                </View>

                {/* Filters */}
                <View className="mt-4">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                        {['All', 'Open', 'In Progress', 'Resolved'].map((filter) => {
                            const isActive = activeFilter === filter;
                            return (
                                <TouchableOpacity 
                                    key={filter} 
                                    onPress={() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setActiveFilter(filter);
                                    }}
                                    className={`px-3 py-1.5 rounded-full border mr-2 ${isActive ? 'bg-[#d4af37] border-[#d4af37]' : 'bg-white/5 border-white/10'}`}
                                >
                                    <Text className={`font-bold text-[10px] ${isActive ? 'text-[#0d1b3e]' : 'text-white/80'}`}>{filter}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mt-2">
                        {['All Time', 'Today', 'This Week'].map((time) => {
                            const isActive = timeFilter === time;
                            return (
                                <TouchableOpacity 
                                    key={time} 
                                    onPress={() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setTimeFilter(time);
                                    }}
                                    className={`px-3 py-1.2 rounded-full border mr-2 ${isActive ? 'bg-indigo-500/20 border-indigo-400/50' : 'bg-transparent border-transparent'}`}
                                >
                                    <Text className={`font-bold text-[9px] uppercase tracking-wider ${isActive ? 'text-indigo-200' : 'text-white/40'}`}>{time}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
                </LinearGradient>

                {/* Gold Bottom Strip */}
                <View className="absolute bottom-0 w-full h-1 bg-[#d4af37] rounded-b-[32px] shadow-sm shadow-[#d4af37]" />
            </View>

            {selectMode && (
                <View className="bg-indigo-600 px-4 py-3 flex-row justify-between items-center z-20">
                    <Text className="text-white font-bold">{selectedIds.length} Selected</Text>
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds([]); }} className="px-3 py-1.5 bg-white/20 rounded-full">
                            <Text className="text-white text-xs font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={resolveSelectedTickets} className="px-3 py-1.5 bg-emerald-500 rounded-full">
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">Resolve</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {loading ? (
                <View className="flex-1 justify-center items-center pt-20">
                    <ActivityIndicator size="large" color="#0d1b3e" />
                </View>
            ) : (
                <FlatList
                    data={filteredTickets}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={() => fetchTickets(true)} 
                            tintColor="#0d1b3e" 
                            colors={['#0d1b3e']} 
                        />
                    }
                    ListEmptyComponent={() => (
                        <View className="items-center justify-center mt-20">
                            <View className="w-20 h-20 bg-slate-200/40 rounded-full items-center justify-center mb-3">
                                <Ionicons name="file-tray-outline" size={36} color="#94a3b8" />
                            </View>
                            <Text className="text-base font-bold text-slate-700">No Tickets Found</Text>
                            <Text className="text-slate-400 mt-1 text-[12px] text-center px-10">
                                {searchQuery ? 'No tickets match your search.' : 'There are no tickets matching your current filter.'}
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
                                if (selectMode) {
                                    toggleSelection(item.id);
                                } else {
                                    setSelectedTicket(item);
                                }
                            }}
                            className={`bg-white px-3 py-3 rounded-2xl mb-2.5 border ${isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100'} shadow-sm shadow-slate-200/20`}
                        >
                            <View className="flex-row justify-between items-start mb-2">
                                <View className="flex-row items-center gap-2">
                                    {selectMode ? (
                                        <View className={`w-7 h-7 rounded-full items-center justify-center border ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                                            {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                                        </View>
                                    ) : (
                                        <View className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 items-center justify-center">
                                            <Text className="font-bold text-slate-400 text-[9px]">{getInitials(item.profiles?.full_name || 'Anonym')}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text className="font-bold text-slate-700 text-[13px]">{item.profiles?.full_name || 'Anonymous'}</Text>
                                        <Text className="text-[9px] font-medium text-slate-400">{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                </View>
                                <View className={`px-2 py-0.5 rounded-full ${
                                    item.priority === 'high' ? 'bg-rose-100' :
                                    item.priority === 'medium' ? 'bg-amber-100' : 'bg-emerald-100'
                                }`}>
                                    <Text className={`text-[8px] uppercase font-black tracking-widest ${
                                        item.priority === 'high' ? 'text-rose-600' :
                                        item.priority === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                                    }`}>{item.priority}</Text>
                                </View>
                            </View>
                            
                            <Text className="text-slate-600 font-medium text-[13px] mb-2.5 leading-4">{item.subject}</Text>

                            <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
                                <View className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
                                    item.status === 'open' ? 'bg-rose-50' :
                                    item.status === 'in_progress' ? 'bg-blue-50' : 'bg-emerald-50'
                                }`}>
                                    <View className={`w-2 h-2 rounded-full ${
                                        item.status === 'open' ? 'bg-rose-500' :
                                        item.status === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500'
                                    }`} />
                                    <Text className={`text-[11px] font-bold ${
                                        item.status === 'open' ? 'text-rose-600' :
                                        item.status === 'in_progress' ? 'text-blue-600' : 'text-emerald-600'
                                    }`}>{item.status.toUpperCase()}</Text>
                                </View>
                            <Text className="text-[10px] text-slate-300 font-mono font-bold tracking-wider">#{item.id.split('-')[0]}</Text>
                            </View>

                            {/* Progress Bar Decoration */}
                            <View className="mt-2.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <View className={`h-full rounded-full ${
                                    item.status === 'open' ? 'w-[10%] bg-rose-500' :
                                    item.status === 'in_progress' ? 'w-[50%] bg-blue-500' : 'w-full bg-emerald-500'
                                }`} />
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
            <View className="bg-white pt-14 pb-4 px-4 border-b border-slate-200/60 flex-row items-center justify-between shadow-sm z-10">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => setSelectedTicket(null)} className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200">
                        <Ionicons name="chevron-back" size={24} color="#0d1b3e" />
                    </TouchableOpacity>
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-[#0d1b3e] items-center justify-center border border-[#d4af37]">
                            <Text className="font-bold text-[#d4af37] text-xs">{getInitials(selectedTicket?.profiles?.full_name || 'A')}</Text>
                        </View>
                        <View>
                            <Text className="font-extrabold text-[#0d1b3e] text-[16px]">{selectedTicket?.profiles?.full_name || 'Anonymous'}</Text>
                            <TouchableOpacity onPress={() => copyTicketId(selectedTicket?.id || '')}>
                                <Text className="text-slate-500 text-[11px] font-medium">#{selectedTicket?.id?.split('-')[0]}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
                    messages.map((m) => {
                        const isAdmin = m.sender_id !== selectedTicket.user_id;
                        return (
                            <View key={m.id} className={`mb-3 w-full flex-row ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                <View className={`px-4 py-3 max-w-[82%] shadow-sm shadow-slate-200/40 ${
                                    m.message.startsWith('[IMAGE]') ? 'bg-transparent p-0 shadow-none' :
                                    (isAdmin ? 'bg-[#0d1b3e] rounded-3xl rounded-br-md border border-[#d4af37]/30' : 'bg-white rounded-3xl rounded-bl-md border border-slate-100/50')
                                }`}>
                                    {m.message.startsWith('[IMAGE]') ? (
                                        <Image 
                                            source={{ uri: m.message.replace('[IMAGE] ', '').trim() }} 
                                            className="w-56 h-72 rounded-3xl bg-slate-200"
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text className={`${isAdmin ? 'text-[#d4af37]' : 'text-slate-800'} text-[16px] leading-[22px]`}>
                                            {m.message}
                                        </Text>
                                    )}
                                    <Text className={`text-[10px] mt-1 ${isAdmin ? (m.message.startsWith('[IMAGE]') ? 'text-gray-500 text-right' : 'text-[#d4af37]/70 text-right') : 'text-slate-400'}`}>
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
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
                    
                    {/* Floating Action Button (Resolve) */}
                    <View className="absolute -top-14 right-4 z-20">
                        <TouchableOpacity 
                            onPress={resolveTicket}
                            className="bg-emerald-500 flex-row items-center gap-1.5 px-4 py-2.5 rounded-full shadow-lg shadow-emerald-500/40"
                        >
                            <Ionicons name="checkmark-done" size={16} color="white" />
                            <Text className="text-white text-xs font-black uppercase tracking-widest">Resolve</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="px-4 pb-10 pt-3">
                        <View className="flex-row items-end gap-2 bg-white px-2 py-2 rounded-full border border-slate-200 shadow-sm shadow-slate-100">
                            <TextInput 
                                className="flex-1 py-3 px-4 text-slate-800 text-[16px] max-h-28 leading-5 font-medium"
                                placeholder="Type a reply..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                value={reply}
                                onChangeText={setReply}
                            />
                            
                            {reply.trim().length > 0 && (
                                <TouchableOpacity 
                                    onPress={() => sendMessage()}
                                    className="m-0.5 rounded-full overflow-hidden active:scale-95 shadow-md shadow-[#0d1b3e]/30"
                                >
                                    <LinearGradient 
                                        colors={['#0d1b3e', '#1e3a8a']} 
                                        start={{ x: 0, y: 0 }} 
                                        end={{ x: 1, y: 1 }} 
                                        className="h-[38px] w-[38px] items-center justify-center border border-[#d4af37]/50"
                                    >
                                        <Ionicons name="arrow-up" size={20} color="#d4af37" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    );

    return (
        <View className="flex-1 bg-[#f8fafc]">
            <Stack.Screen options={{ headerShown: false }} />
            {selectedTicket ? renderChatInterface() : renderTicketList()}
        </View>
    );
}
