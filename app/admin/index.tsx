import { View, Text, ScrollView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// MODULE CONFIGURATION
const modules = {
    operations: [
        { title: 'Users', icon: 'people', route: '/admin/users', color: '#3B82F6' },
        { title: 'Transactions', icon: 'receipt', route: '/admin/transactions', color: '#10B981' },
        { title: 'KYC Queue', icon: 'scan', route: '/admin/kyc', color: '#8B5CF6', badge: 8 },
        { title: 'Help Desk', icon: 'chatbubbles', route: '/admin/tickets', color: '#EC4899', badge: 3 },
        { title: 'Content', icon: 'images', route: '/admin/cms', color: '#6366F1' },
        { title: 'Localization', icon: 'language', route: '/admin/localization', color: '#8B5CF6' },
    ],
    banking: [
        { title: 'Cards', icon: 'card', route: '/admin/cards', color: '#EC4899' },
        { title: 'Lending', icon: 'cash', route: '/admin/lending', color: '#10B981', badge: 5 },
        { title: 'Wealth', icon: 'briefcase', route: '/admin/wealth', color: '#8B5CF6' },
        { title: 'Liquidity', icon: 'water', route: '/admin/liquidity', color: '#10B981' },
        { title: 'Rates', icon: 'trending-up', route: '/admin/rates', color: '#F59E0B', stat: 'Live' },
    ],
    finance: [
        { title: 'Risk', icon: 'alert-circle', route: '/admin/risk', color: '#EF4444' },
        { title: 'Analytics', icon: 'bar-chart', route: '/admin/reports', color: '#F59E0B' },
        { title: 'Marketing', icon: 'megaphone', route: '/admin/marketing', color: '#F472B6' },
        { title: 'Cortex AI', icon: 'sparkles', route: '/admin/ai', color: '#818CF8', dark: true },
    ],
    technical: [
        { title: 'Infra', icon: 'server-outline', route: '/admin/infrastructure', color: '#475569' },
        { title: 'Database', icon: 'server', route: '/admin/db', color: '#10B981', dark: true },
        { title: 'API', icon: 'code-working', route: '/admin/api', color: '#6366F1' },
        { title: 'Cinema', icon: 'videocam', route: '/admin/cinema', color: '#EF4444', dark: true },
        { title: 'Terminal', icon: 'terminal', route: '/admin/terminal', color: '#22C55E' },
        { title: 'App Store', icon: 'logo-apple', route: '/admin/stores', color: '#000000', badge: 1 },
        { title: 'Files', icon: 'folder', route: '/admin/files', color: '#0EA5E9' },
    ],
    internal: [
        { title: 'Staff', icon: 'briefcase', route: '/admin/staff', color: '#64748B' },
        { title: 'Voice OS', icon: 'mic', route: '/admin/voice', color: '#8B5CF6', dark: true },
        { title: 'Legal', icon: 'document-text', route: '/admin/legal', color: '#64748B' },
        { title: 'Team Chat', icon: 'people-circle', route: '/admin/team', color: '#EF4444', badge: 9 },
        { title: 'Academy', icon: 'school', route: '/admin/academy', color: '#F59E0B' },
        { title: 'Theme', icon: 'color-palette', route: '/admin/appearance', color: '#EC4899' },
        { title: 'Automation', icon: 'flash', route: '/admin/automation', color: '#6366F1' },
        { title: 'Kanban', icon: 'grid', route: '/admin/kanban', color: '#F97316' },
    ],
    redZone: [
        { title: 'Security', icon: 'shield-checkmark', route: '/admin/security', color: '#3B82F6' },
        { title: 'Forensics', icon: 'finger-print', route: '/admin/forensics', color: '#8B5CF6' },
        { title: 'Logs', icon: 'list', route: '/admin/logs', color: '#64748B' },
        { title: 'Map', icon: 'earth', route: '/admin/map', color: '#06B6D4' },
        { title: 'Settings', icon: 'settings', route: '/admin/settings', color: '#475569' },
        { title: 'PANIC ROOM', icon: 'warning', route: '/admin/panic', color: '#EF4444', dark: true },
    ]
};

const dockItems = [
    { icon: 'stats-chart', route: '/admin/reports', color: '#3B82F6' },
    { icon: 'people', route: '/admin/users', color: '#10B981' },
    { icon: 'chatbubbles', route: '/admin/tickets', color: '#F59E0B' },
    { icon: 'terminal', route: '/admin/terminal', color: '#22C55E' },
];

export default function AdminBento() {
    const router = useRouter();

    const renderSection = (title: string, items: any[]) => (
        <View className="mb-6">
            <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-3 ml-2">{title}</Text>
            <View className="flex-row flex-wrap justify-between gap-y-3">
                {items.map((item, i) => {
                    const bgClass = item.dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-white';
                    const textColor = item.dark ? 'text-white' : 'text-slate-700';

                    return (
                        <TouchableOpacity
                            key={i}
                            onPress={() => router.push(item.route as any)}
                            className={`w-[31%] h-28 ${bgClass} rounded-2xl p-3 justify-between shadow-sm border active:scale-95 transition-transform`}
                        >
                            <View className="flex-row justify-between items-start">
                                <View className={`w-8 h-8 rounded-full items-center justify-center ${item.dark ? 'bg-slate-800' : ''}`}
                                    style={{ backgroundColor: item.dark ? undefined : item.color + '20' }}
                                >
                                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                                </View>
                                {item.badge && (
                                    <View className="bg-red-500 rounded-full w-4 h-4 items-center justify-center border border-white">
                                        <Text className="text-white text-[8px] font-bold">{item.badge}</Text>
                                    </View>
                                )}
                            </View>
                            <View>
                                {item.stat && <Text className="text-emerald-500 text-[8px] font-bold mb-0.5">{item.stat}</Text>}
                                <Text className={`font-bold text-xs ${textColor}`} numberOfLines={1}>{item.title}</Text>
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
                <LinearGradient
                    colors={['#0F172A', '#1E293B']}
                    className="p-6 pb-8 rounded-b-[40px] shadow-xl mb-6 bg-slate-900"
                >
                    <View className="flex-row justify-between items-center mt-4">
                        <View>
                            <Text className="text-slate-400 font-bold text-xs uppercase tracking-[4px]">Command Center</Text>
                            <Text className="text-3xl font-black text-white">Abu Mafhal</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity
                                onPress={() => router.replace('/(app)/dashboard')}
                                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center border border-slate-700 shadow-sm"
                            >
                                <Ionicons name="log-out-outline" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                            <View className="w-10 h-10 rounded-full bg-slate-700 items-center justify-center border border-slate-600">
                                <Ionicons name="person" size={20} color="white" />
                            </View>
                        </View>
                    </View>

                    {/* Search Bar */}
                    <View className="mt-8 bg-slate-800 p-3 rounded-2xl flex-row items-center border border-slate-700">
                        <Ionicons name="search" size={20} color="#94A3B8" />
                        <TextInput
                            placeholder="Search 30 Apps..."
                            placeholderTextColor="#64748B"
                            className="flex-1 ml-3 text-slate-200 font-medium"
                        />
                        <View className="bg-slate-700 px-2 py-1 rounded">
                            <Text className="text-slate-400 text-[10px] font-bold">⌘ K</Text>
                        </View>
                    </View>
                </LinearGradient>

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
                <View className="w-[1px] h-8 bg-slate-700 mx-1" />
                <TouchableOpacity onPress={() => router.push('/admin/settings')} className="w-12 h-12 items-center justify-center">
                    <Ionicons name="grid" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
