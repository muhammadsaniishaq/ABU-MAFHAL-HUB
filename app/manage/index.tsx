import { View, Text, ScrollView, TouchableOpacity, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// MODULE CONFIGURATION
const modules = {
    operations: [
        { title: 'Users', icon: 'people', route: '/manage/users', color: '#3B82F6' },
        { title: 'Transactions', icon: 'receipt', route: '/manage/transactions', color: '#10B981' },
        { title: 'KYC Queue', icon: 'scan', route: '/manage/kyc', color: '#8B5CF6', badge: 0 }, // Dynamically updated
        { title: 'Help Desk', icon: 'chatbubbles', route: '/manage/tickets', color: '#EC4899', badge: 0 },
        { title: 'Content', icon: 'images', route: '/manage/cms', color: '#6366F1' },
        { title: 'Data Plans', icon: 'wifi', route: '/manage/data-plans', color: '#0EA5E9' },
        { title: 'Airtime', icon: 'call', route: '/manage/airtime', color: '#10B981' },
        { title: 'Localization', icon: 'language', route: '/manage/localization', color: '#8B5CF6' },
    ],
    banking: [
        { title: 'Cards', icon: 'card', route: '/manage/cards', color: '#EC4899' },
        { title: 'Lending', icon: 'cash', route: '/manage/lending', color: '#10B981', badge: 0 },
        { title: 'Wealth', icon: 'briefcase', route: '/manage/wealth', color: '#8B5CF6' },
        { title: 'Liquidity', icon: 'water', route: '/manage/liquidity', color: '#10B981' },
        { title: 'Rates', icon: 'trending-up', route: '/manage/rates', color: '#F59E0B', stat: 'Live' },
    ],
    finance: [
        { title: 'Risk', icon: 'alert-circle', route: '/manage/risk', color: '#EF4444' },
        { title: 'Analytics', icon: 'bar-chart', route: '/manage/reports', color: '#F59E0B' },
        { title: 'Comms Center', icon: 'megaphone', route: '/manage/communications', color: '#F472B6' },
        { title: 'Cortex AI', icon: 'sparkles', route: '/manage/ai', color: '#818CF8', dark: true },
    ],
    technical: [
        { title: 'Infra', icon: 'server-outline', route: '/manage/infrastructure', color: '#475569' },
        { title: 'Database', icon: 'server', route: '/manage/db', color: '#10B981', dark: true },
        { title: 'API', icon: 'code-working', route: '/manage/api', color: '#6366F1' },
        { title: 'Cinema', icon: 'videocam', route: '/manage/cinema', color: '#EF4444', dark: true },
        { title: 'Terminal', icon: 'terminal', route: '/manage/terminal', color: '#22C55E' },
        { title: 'Features', icon: 'toggle', route: '/manage/features', color: '#F97316' }, // Added Feature Flags
        { title: 'App Store', icon: 'logo-apple', route: '/manage/stores', color: '#000000', badge: 1 },
        { title: 'Files', icon: 'folder', route: '/manage/files', color: '#0EA5E9' },
    ],
    internal: [
        { title: 'Staff', icon: 'briefcase', route: '/manage/staff', color: '#64748B' },
        { title: 'Voice OS', icon: 'mic', route: '/manage/voice', color: '#8B5CF6', dark: true },
        { title: 'Legal', icon: 'document-text', route: '/manage/legal', color: '#64748B' },
        { title: 'Team Chat', icon: 'people-circle', route: '/manage/team', color: '#EF4444', badge: 0 },
        { title: 'Academy', icon: 'school', route: '/manage/academy', color: '#F59E0B' },
        { title: 'Theme', icon: 'color-palette', route: '/manage/appearance', color: '#EC4899' },
        { title: 'Automation', icon: 'flash', route: '/manage/automation', color: '#6366F1' },
        { title: 'Kanban', icon: 'grid', route: '/manage/kanban', color: '#F97316' },
    ],
    redZone: [
        { title: 'Security', icon: 'shield-checkmark', route: '/manage/security', color: '#3B82F6' },
        { title: 'Forensics', icon: 'finger-print', route: '/manage/forensics', color: '#8B5CF6' },
        { title: 'Logs', icon: 'list', route: '/manage/logs', color: '#64748B' },
        { title: 'Map', icon: 'earth', route: '/manage/map', color: '#06B6D4' },
        { title: 'Settings', icon: 'settings', route: '/manage/settings', color: '#475569' },
        { title: 'PANIC ROOM', icon: 'warning', route: '/manage/panic', color: '#EF4444', dark: true },
    ]
};

const QUICK_ACTIONS = [
    { id: 'user', label: 'Add User', icon: 'person-add', color: '#3B82F6', route: '/manage/users/add' },
    { id: 'money', label: 'Send Cash', icon: 'cash', color: '#10B981', route: '/manage/transfers/new' },
    { id: 'broadcast', label: 'Broadcast', icon: 'megaphone', color: '#F59E0B', route: '/manage/communications' },
    { id: 'logs', label: 'View Logs', icon: 'list', color: '#6366F1', route: '/manage/logs' },
];

const dockItems = [
    { icon: 'stats-chart', route: '/manage/reports', color: '#3B82F6' },
    { icon: 'people', route: '/manage/users', color: '#10B981' },
    { icon: 'chatbubbles', route: '/manage/tickets', color: '#F59E0B' },
    { icon: 'terminal', route: '/manage/terminal', color: '#22C55E' },
];

export default function AdminBento() {
    const router = useRouter();
    const [counts, setCounts] = useState({
        users: 0,
        kyc: 0,
        loans: 0,
        tickets: 0,
        chats: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCounts();
    }, []);

    const fetchCounts = async () => {
        try {
            const [
                { count: userCount },
                { count: kycCount },
                { count: loanCount },
                { count: ticketCount },
                { count: chatCount }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
                supabase.from('ticket_messages').select('*', { count: 'exact', head: true })
            ]);

            setCounts({
                users: userCount || 0,
                kyc: kycCount || 0,
                loans: loanCount || 0,
                tickets: ticketCount || 0,
                chats: chatCount || 0
            });
        } catch (error) {
            console.error('Error fetching admin counts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Update modules with dynamic badges
    modules.operations[2].badge = counts.kyc;
    modules.operations[3].badge = counts.tickets;
    modules.banking[1].badge = counts.loans;
    modules.internal[3].badge = counts.chats;

    const renderSection = (title: string, items: any[]) => (
        <View className="mb-6">
            <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-3 ml-2">{title}</Text>
            <View className="flex-row flex-wrap justify-between gap-y-3">
                {items.map((item, i) => {
                    // Modern Glass Style
                    const bgClass = 'bg-slate-800/60 border-white/5';  
                    
                    return (
                        <TouchableOpacity
                            key={i}
                            onPress={() => router.push(item.route as any)}
                            className={`w-[31%] h-28 ${bgClass} rounded-2xl p-3 justify-between shadow-sm border active:scale-95 transition-transform overflow-hidden`}
                        >
                            {/* Gradient Glare Effect */}
                            <View className="absolute -top-10 -right-10 w-20 h-20 bg-white/5 rounded-full blur-xl" />
                            
                            <View className="flex-row justify-between items-start">
                                <View className={`w-8 h-8 rounded-full items-center justify-center bg-slate-700/50`}
                                    style={{ backgroundColor: item.color + '15' }}
                                >
                                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                                </View>
                                {item.badge > 0 && (
                                    <View className="bg-red-500 rounded-full min-w-[16px] h-4 px-1 items-center justify-center border border-slate-900">
                                        <Text className="text-white text-[8px] font-bold">{item.badge}</Text>
                                    </View>
                                )}
                            </View>
                            <View>
                                {item.stat && <Text className="text-emerald-400 text-[8px] font-bold mb-0.5">{item.stat}</Text>}
                                <Text className="font-bold text-xs text-slate-100" numberOfLines={1}>{item.title}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Header */}
                {/* Header - Modernized & Decorated */}
                <View className="mb-6 rounded-b-[40px] overflow-hidden shadow-2xl">
                    <LinearGradient
                        colors={['#0F172A', '#1E293B', '#1e1b4b']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="p-6 pb-8"
                    >
                        {/* Decorative Background Elements */}
                        <View className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-32 translate-x-16" />
                        <View className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-24 -translate-x-12" />

                        {/* Top Bar: Brand & Profile */}
                        <View className="flex-row justify-between items-start mt-8 mb-8">
                            <View>
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="flex-row items-center bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 mr-2">
                                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                                        <Text className="text-emerald-400 text-[10px] font-bold tracking-wider uppercase">System Stable</Text>
                                    </View>
                                    <View className="bg-white/10 px-2 py-0.5 rounded-full border border-white/5">
                                        <Text className="text-white text-[10px] font-bold">
                                            {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-slate-200 font-medium text-sm mb-0.5">Good Evening, Admin</Text>
                                <Text className="text-3xl font-black text-white tracking-tight">Abu Mafhal<Text className="text-indigo-400">.</Text></Text>
                            </View>

                            <View className="flex-row items-center gap-3">
                                <TouchableOpacity 
                                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 items-center justify-center active:bg-white/10 relative"
                                >
                                    <Ionicons name="notifications-outline" size={20} color="#fff" />
                                    <View className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border border-slate-900" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => router.replace('/(app)/dashboard')}
                                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 items-center justify-center active:bg-white/10"
                                >
                                    <Ionicons name="log-out-outline" size={20} color="#94A3B8" />
                                </TouchableOpacity>
                                
                                <View className="w-10 h-10 rounded-full bg-indigo-600 items-center justify-center border-2 border-indigo-400 shadow-lg shadow-indigo-500/30">
                                    <Text className="font-bold text-white">AD</Text>
                                </View>
                            </View>
                        </View>

                        {/* Global Search Bar */}
                        <View className="flex-row items-center bg-white/10 rounded-xl px-4 py-3 mb-6 border border-white/5 backdrop-blur-sm">
                            <Ionicons name="search" size={20} color="#CBD5E1" />
                            <TextInput 
                                placeholder="Search users, transactions, logs..." 
                                placeholderTextColor="#94A3B8"
                                className="flex-1 ml-3 text-white font-medium"
                                // Note: Logic would be connected here
                            />
                            <View className="bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                                <Text className="text-white/50 text-[10px] font-bold">⌘K</Text>
                            </View>
                        </View>

                        {/* Quick Stats Ribbon */}
                        <View className="flex-row justify-between border-t border-white/10 pt-6">
                            <View>
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase mb-1">Total Users</Text>
                                <Text className="text-white text-xl font-black">{counts.users.toLocaleString()}</Text>
                            </View>
                            <View>
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase mb-1">Pending KYC</Text>
                                <Text className="text-amber-400 text-xl font-black">{counts.kyc}</Text>
                            </View>
                            <View>
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase mb-1">Tickets</Text>
                                <Text className="text-indigo-300 text-xl font-black">{counts.tickets}</Text>
                            </View>
                            <View>
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase mb-1">Server</Text>
                                <Text className="text-emerald-400 text-xl font-black">99%</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Quick Actions Grid */}
                <View className="px-6 mb-6">
                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3">Quick Actions</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3 overflow-visible">
                        {QUICK_ACTIONS.map((action, i) => (
                            <TouchableOpacity key={i} className="items-center mr-4">
                                <View className="w-14 h-14 rounded-2xl items-center justify-center mb-2 border border-slate-700 bg-slate-800/80 shadow-lg active:bg-slate-700"
                                     style={{ borderColor: action.color }}
                                >
                                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                                </View>
                                <Text className="text-slate-300 text-[10px] font-bold">{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Categories */}
                <View className="px-4">
                    {renderSection('Operations & Core', modules.operations)}
                    {renderSection('Banking & Assets', modules.banking)}
                    {renderSection('Markets & Analytics', modules.finance)}
                    {renderSection('Technical Infrastructure', modules.technical)}
                    {renderSection('Internal Affairs', modules.internal)}
                    {renderSection('Red Zone / Security', modules.redZone)}
                </View>
            </ScrollView>

            {/* Floating Dock */}
            <View className="absolute bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-md p-3 rounded-[24px] flex-row justify-around items-center border border-slate-700 shadow-2xl">
                {dockItems.map((item, i) => (
                    <TouchableOpacity
                        key={i}
                        onPress={() => router.push(item.route as any)}
                        className="w-12 h-12 bg-slate-800 rounded-2xl items-center justify-center border border-slate-700 active:-translate-y-2 transition-transform"
                    >
                        <Ionicons name={item.icon as any} size={24} color={item.color} />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
