import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { sendTicketCreatedEmail } from '../../../services/ticketEmail';

type Ticket = {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
};

const CATEGORIES = [
    { label: "💳 Wallet Funding", value: "Wallet Funding Issue" },
    { label: "📶 Data / Airtime", value: "Data or Airtime Delay" },
    { label: "📜 CAC Registration", value: "CAC Registration Inquiry" },
    { label: "🪙 Crypto & Deriv", value: "Crypto Trading Issue" },
    { label: "⚡ Electricity / Cable", value: "Bill Payment Issue" },
    { label: "🆔 NIN / BVN Services", value: "NIN/BVN Inquiry" },
    { label: "👨‍💻 General Support", value: "General Inquiry" },
];

export default function UserTicketsScreen() {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [subject, setSubject] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].value);

    useEffect(() => {
        fetchTickets();

        const channel = supabase
            .channel('public:tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                fetchTickets();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(30);

            if (data) setTickets(data as any);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async () => {
        const ticketSubject = subject.trim() || selectedCategory;
        setIsCreating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('tickets')
                .insert({
                    user_id: user.id,
                    subject: ticketSubject,
                    status: 'open',
                    priority: 'high'
                })
                .select()
                .single();

            if (data && !error) {
                setShowCreateModal(false);
                setSubject('');
                
                // 📧 AUTOMATIC EMAIL NOTIFICATION
                sendTicketCreatedEmail(data.id, ticketSubject, user.email, user.user_metadata?.full_name);

                router.push(`/tickets/${data.id}`);
            } else if (error) {
                Alert.alert("Error", error.message);
            }
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setIsCreating(false);
        }
    };

    const filteredTickets = tickets.filter(t => {
        if (filter === 'all') return true;
        return t.status === filter;
    });

    return (
        <View className="flex-1 bg-[#040814]">
            <Stack.Screen options={{ 
                title: 'My Support Desk',
                headerShown: true,
                headerStyle: { backgroundColor: '#060d21' },
                headerTintColor: '#f5a623',
                headerTitleStyle: { fontWeight: '800', fontSize: 15 },
                headerRight: () => (
                    <TouchableOpacity 
                        onPress={() => setShowCreateModal(true)} 
                        className="flex-row items-center gap-1 bg-[#f5a623] px-2.5 py-1 rounded-full active:opacity-80 mr-1 shadow-sm"
                    >
                        <Ionicons name="add" size={14} color="#060d21" />
                        <Text className="text-[#060d21] font-bold text-[11px]">New</Text>
                    </TouchableOpacity>
                )
            }} />

            {/* FILTER TABS */}
            <View className="bg-slate-900/90 border-b border-slate-800/80 px-2.5 py-1.5">
                <View className="flex-row gap-1.5">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'open', label: '🔴 Open' },
                        { key: 'in_progress', label: '🔵 Active' },
                        { key: 'resolved', label: '🟢 Closed' },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setFilter(tab.key as any)}
                            className={`px-2.5 py-1 rounded-full border ${
                                filter === tab.key 
                                    ? 'bg-[#f5a623]/20 border-[#f5a623]' 
                                    : 'bg-slate-900 border-slate-800'
                            }`}
                        >
                            <Text className={`text-[10px] font-bold ${
                                filter === tab.key ? 'text-[#f5a623]' : 'text-slate-400'
                            }`}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" color="#f5a623" />
                </View>
            ) : (
                <FlatList
                    data={filteredTickets}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center pt-16 px-6">
                            <View className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 items-center justify-center mb-2">
                                <Ionicons name="headset-outline" size={24} color="#f5a623" />
                            </View>
                            <Text className="text-white font-extrabold text-[13.5px] text-center">No Support Tickets</Text>
                            <Text className="text-slate-400 mt-1 text-center font-medium text-[11px] leading-4">
                                Need help? Create a support ticket to chat with live admin agents.
                            </Text>
                            <TouchableOpacity 
                                onPress={() => setShowCreateModal(true)}
                                className="mt-4 bg-[#f5a623] px-4 py-2 rounded-full flex-row items-center shadow-md"
                            >
                                <Ionicons name="chatbubbles" size={14} color="#060d21" className="mr-1.5" />
                                <Text className="text-[#060d21] font-bold text-[12px]">Create Ticket</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => router.push(`/tickets/${item.id}`)}
                            className="bg-slate-900/90 p-2.5 rounded-xl mb-2 border border-slate-800/80 active:scale-[0.99]"
                        >
                            <View className="flex-row justify-between mb-1 items-center">
                                <Text className="text-slate-100 font-bold text-[12px] flex-1 mr-2" numberOfLines={1}>
                                    {item.subject}
                                </Text>
                                <Text className="text-[9px] text-slate-400 font-semibold">
                                    {new Date(item.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                </Text>
                            </View>

                            <View className="flex-row items-center justify-between pt-1 border-t border-slate-800/50">
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
                                <View className="flex-row items-center gap-1">
                                    <Ionicons name="ticket-outline" size={10} color="#64748b" />
                                    <Text className="text-[9.5px] text-slate-400 font-medium">#{item.id.split('-')[0]}</Text>
                                    <Ionicons name="chevron-forward" size={12} color="#f5a623" />
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* NEW TICKET MODAL */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View className="flex-1 bg-black/60 items-center justify-center p-4">
                    <View className="w-full max-w-sm bg-[#060d21] border border-slate-800 rounded-2xl p-4 shadow-2xl">
                        <View className="flex-row items-center justify-between mb-3 border-b border-slate-800 pb-2">
                            <View className="flex-row items-center gap-1.5">
                                <View className="w-6 h-6 rounded-full bg-[#f5a623]/20 items-center justify-center border border-[#f5a623]/40">
                                    <Ionicons name="headset" size={13} color="#f5a623" />
                                </View>
                                <Text className="text-white font-extrabold text-[14px]">New Ticket</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)} className="p-0.5 rounded-full bg-slate-900 border border-slate-800">
                                <Ionicons name="close" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-slate-400 text-[10.5px] font-semibold mb-1.5 uppercase tracking-wider">Topic Category:</Text>
                        <View className="flex-row flex-wrap gap-1.5 mb-3">
                            {CATEGORIES.map((cat, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => setSelectedCategory(cat.value)}
                                    className={`px-2.5 py-1 rounded-full border ${
                                        selectedCategory === cat.value
                                            ? 'bg-[#f5a623]/20 border-[#f5a623]'
                                            : 'bg-slate-900 border-slate-800'
                                    }`}
                                >
                                    <Text className={`text-[10.5px] font-bold ${selectedCategory === cat.value ? 'text-[#f5a623]' : 'text-slate-300'}`}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text className="text-slate-400 text-[10.5px] font-semibold mb-1 uppercase tracking-wider">Details / Subject:</Text>
                        <TextInput
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-[12px] mb-4 font-medium"
                            placeholder="Briefly describe your issue..."
                            placeholderTextColor="#64748b"
                            value={subject}
                            onChangeText={setSubject}
                        />

                        <TouchableOpacity
                            onPress={handleCreateTicket}
                            disabled={isCreating}
                            className="rounded-full overflow-hidden active:scale-95 shadow-md"
                        >
                            <LinearGradient
                                colors={['#f5a623', '#d97706']}
                                className="py-2.5 items-center justify-center flex-row gap-1.5"
                            >
                                {isCreating ? (
                                    <ActivityIndicator color="#060d21" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="paper-plane" size={14} color="#060d21" />
                                        <Text className="text-[#060d21] font-extrabold text-[12.5px]">Start Live Ticket Chat</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
