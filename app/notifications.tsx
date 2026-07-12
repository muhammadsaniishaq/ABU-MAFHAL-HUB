import { View, Text, SectionList, ActivityIndicator, TouchableOpacity, Alert, TextInput, Dimensions, Animated as RNAnimated, Share, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeOutLeft, Layout, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

// Skeleton Loader Component
const NotificationSkeleton = () => {
    const opacity = useSharedValue(0.3);
    useEffect(() => {
        opacity.value = withSpring(1, { duration: 1000 }); // Simple fade in for now, normally loop
    }, []);
    
    return (
        <View className="bg-white p-3 rounded-2xl mb-2 shadow-sm border border-slate-100 flex-row">
            <View className="w-10 h-10 rounded-full bg-gray-200 mr-3" />
            <View className="flex-1">
                <View className="flex-row justify-between mb-2">
                    <View className="h-3 w-20 bg-gray-200 rounded" />
                    <View className="h-2 w-10 bg-gray-200 rounded" />
                </View>
                <View className="h-2 w-full bg-gray-200 rounded mb-1" />
                <View className="h-2 w-2/3 bg-gray-200 rounded" />
            </View>
        </View>
    );
};

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [sortAsc, setSortAsc] = useState(false); // NEW FEATURE: SORT ORDER
    const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Undo State
    const [deletedItem, setDeletedItem] = useState<{ item: any, index: number } | null>(null);
    const [showUndo, setShowUndo] = useState(false);
    const undoTimeout = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    // Header Blur Effect for Background
    const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

    useEffect(() => {
        fetchNotifications();
        const subscribe = subscribeToNotifications();
        return () => { subscribe(); };
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (data) setNotifications(data);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await fetchNotifications();
        setRefreshing(false);
    };

    const subscribeToNotifications = () => {
        const channel = supabase.channel('notifications-modern').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, 
                (payload) => setNotifications((prev) => [payload.new, ...prev]))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    };

    const markAsRead = async (item: any, status = true) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const updated = notifications.map(n => n.id === item.id ? { ...n, is_read: status } : n);
        setNotifications(updated);
        await supabase.from('notifications').update({ is_read: status }).eq('id', item.id);
    };

    const handlePressNotification = (item: any) => {
        if (!item.is_read) {
            markAsRead(item, true);
        }
        if (item.data?.route) {
            router.push(item.data.route);
        }
    };

    const markAllAsRead = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const updated = notifications.map(n => ({ ...n, is_read: true }));
        setNotifications(updated);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    };

    const confirmDelete = (id: string, item: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Optimistic Delete with Undo
        const prevList = [...notifications];
        const index = notifications.findIndex(n => n.id === id);
        
        setDeletedItem({ item, index });
        const updated = notifications.filter(n => n.id !== id);
        setNotifications(updated);
        setShowUndo(true);

        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        
        undoTimeout.current = setTimeout(async () => {
            setShowUndo(false);
            setDeletedItem(null);
            await supabase.from('notifications').delete().eq('id', id);
        }, 3500);
    };

    const handleUndo = () => {
        if (undoTimeout.current) clearTimeout(undoTimeout.current);
        if (deletedItem) {
            setNotifications(prev => {
                const newArr = [...prev];
                newArr.splice(deletedItem.index, 0, deletedItem.item);
                return newArr.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            });
            setShowUndo(false);
            setDeletedItem(null);
        }
    };

    const clearAll = () => {
        Alert.alert("Clear All", "Delete all notifications?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete All", style: 'destructive', 
                onPress: async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setNotifications([]);
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) await supabase.from('notifications').delete().eq('user_id', user.id);
                }
            }
        ]);
    };

    const shareNotification = async (item: any) => {
        try {
            await Share.share({
                message: `*${item.title}*\n\n${item.body}\n\n- Shared via Abu Mafhal Sub`,
            });
        } catch (error: any) {
            Alert.alert("Share Failed", error.message);
        }
    };

    // Derived State for Badges
    const counts = useMemo(() => ({
        all: notifications.length,
        unread: notifications.filter(n => !n.is_read).length,
        high: notifications.filter(n => n.data?.priority === 'high').length
    }), [notifications]);

    const getFilteredAndGrouped = () => {
        let filtered = notifications;
        if (filter === 'unread') filtered = filtered.filter(n => !n.is_read);
        if (filter === 'high') filtered = filtered.filter(n => n.data?.priority === 'high');
        if (searchQuery) {
            const lowQ = searchQuery.toLowerCase();
            filtered = filtered.filter(n => n.title?.toLowerCase().includes(lowQ) || n.body?.toLowerCase().includes(lowQ));
        }

        const sections: { title: string, data: any[] }[] = [];
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const seenKeys = new Set<string>();
        const groups: {[key: string]: any[]} = {};

        filtered.forEach(item => {
            const d = new Date(item.created_at).toDateString();
            let k = d === today ? "Today" : (d === yesterday ? "Yesterday" : d);
            if (!groups[k]) groups[k] = [];
            groups[k].push(item);
        });

        filtered.forEach(item => {
            const d = new Date(item.created_at).toDateString();
            let k = d === today ? "Today" : (d === yesterday ? "Yesterday" : d);
            if (!seenKeys.has(k)) {
                seenKeys.add(k);
                sections.push({ title: k, data: groups[k] });
            }
        });
        return sections;
    };

    const FilterTab = ({ label, value, count }: { label: string, value: 'all' | 'unread' | 'high', count: number }) => (
        <TouchableOpacity onPress={() => setFilter(value)} className={`px-2 py-1 rounded-full mr-1.5 flex-row items-center ${filter === value ? 'bg-[#f5a623] shadow-sm' : 'bg-transparent border border-[#f5a623]/30'}`}>
            <Text className={`font-bold mr-1 text-[9px] uppercase ${filter === value ? 'text-[#0d1b3e]' : 'text-[#f5a623]'}`}>{label}</Text>
            {count > 0 && (
                <View className={`rounded-full px-1 py-0.5 ${filter === value ? 'bg-[#0d1b3e]' : 'bg-[#f5a623]/20'}`}>
                    <Text className={`text-[8px] font-bold ${filter === value ? 'text-[#f5a623]' : 'text-[#f5a623]'}`}>{count}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
    // Swipeable Item
    const renderSwipeableItem = ({ item }: { item: any }) => {
        const renderRightActions = (_progress: any, dragX: any) => {
            const scale = dragX.interpolate({
                inputRange: [-80, 0],
                outputRange: [1, 0],
                extrapolate: 'clamp',
            });
            return (
                <TouchableOpacity onPress={() => confirmDelete(item.id, item)} className="bg-[#ef4444] justify-center items-center w-20 h-full rounded-2xl my-1 ml-2 shadow-sm">
                    <RNAnimated.View style={{ transform: [{ scale }] }}>
                        <Ionicons name="trash" size={24} color="white" />
                    </RNAnimated.View>
                </TouchableOpacity>
            );
        };

        const renderLeftActions = (_progress: any, dragX: any) => {
            const scale = dragX.interpolate({
                inputRange: [0, 80],
                outputRange: [0, 1],
                extrapolate: 'clamp',
            });
            return (
                <TouchableOpacity onPress={() => markAsRead(item, !item.is_read)} className="bg-[#f5a623] justify-center items-center w-20 h-full rounded-2xl my-1 mr-2 shadow-sm">
                    <RNAnimated.View style={{ transform: [{ scale }] }}>
                        <Ionicons name={item.is_read ? "mail-unread" : "mail-open"} size={24} color="#0d1b3e" />
                    </RNAnimated.View>
                </TouchableOpacity>
            );
        };

        const isHigh = item.data?.priority === 'high';
        const hasAction = !!item.data?.route;

        return (
            <Animated.View entering={FadeInUp} layout={Layout.springify()}>
                <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => handlePressNotification(item)}
                        onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            Alert.alert("Options", "What do you want to do?", [
                                { text: "Cancel", style: "cancel" },
                                { text: "Copy Text", onPress: async () => { await Clipboard.setStringAsync(item.body); Alert.alert("Copied!"); } },
                                { text: item.is_read ? "Mark as Unread" : "Mark as Read", onPress: () => markAsRead(item, !item.is_read) },
                                { text: "Delete", style: "destructive", onPress: () => confirmDelete(item.id, item) }
                            ])
                        }}
                        className={`mb-1.5 mx-2 rounded-2xl overflow-hidden bg-white shadow-sm border ${!item.is_read ? 'border-[#f5a623]/40 shadow-[#f5a623]/20' : 'border-slate-100'}`}
                    >
                        <View className={`p-2.5 flex-row items-start`}>
                        {/* Status Indicator Dot (Modern Light) */}
                        {!item.is_read && <View className="absolute left-2.5 top-1/2 w-1.5 h-1.5 rounded-full bg-[#f5a623]" style={{ transform: [{ translateY: -3 }] }} />}
                        
                        <View className={`flex-row items-start z-10 ${!item.is_read ? 'ml-2.5' : 'ml-0'}`}>
                             {/* Gradient Icon Box */}
                            <LinearGradient 
                                colors={isHigh ? ['#fee2e2', '#fecaca'] : (!item.is_read ? ['#fef3c7', '#fde68a'] : ['#f1f5f9', '#e2e8f0'])}
                                className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                            >
                                <Ionicons name={isHigh ? 'warning' : 'notifications'} size={14} color={isHigh ? '#ef4444' : (!item.is_read ? '#f5a623' : '#94a3b8')} />
                            </LinearGradient>
                            
                            <View className="flex-1">
                                <View className="flex-row justify-between items-center mb-0.5">
                                    <View className="flex-1 mr-1">
                                        <Text className={`text-[12px] ${!item.is_read ? 'font-black text-[#0d1b3e]' : 'font-bold text-slate-600'}`} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                    </View>
                                    <Text className="text-[9px] text-slate-400 font-medium">
                                        {new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </Text>
                                </View>
                                
                                {item.type && item.type !== 'general' && (
                                    <View className="bg-slate-100 self-start px-1.5 py-0.5 rounded flex-row items-center mb-1">
                                        <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-wider">{item.type}</Text>
                                    </View>
                                )}
                                
                                <Text className={`leading-tight text-[11px] ${!item.is_read ? 'text-slate-600' : 'text-slate-500'}`} numberOfLines={2}>{item.body}</Text>
                                
                                <View className="flex-row mt-1.5 gap-1.5">
                                    {hasAction && (
                                        <TouchableOpacity 
                                            onPress={() => {
                                                markAsRead(item, true);
                                                router.push(item.data.route);
                                            }}
                                            className="bg-[#0d1b3e] px-2.5 py-1 rounded-full flex-row items-center shadow-sm"
                                        >
                                            <Text className="text-[#f5a623] font-bold text-[9px] mr-1 uppercase">View</Text>
                                            <Ionicons name="chevron-forward" size={9} color="#f5a623" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity 
                                        onPress={() => shareNotification(item)}
                                        className="bg-slate-50 px-2 py-1 rounded-full flex-row items-center border border-slate-200"
                                    >
                                        <Ionicons name="share-outline" size={10} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                        </View>
                    </TouchableOpacity>
                </Swipeable>
            </Animated.View>
        );
    };

    return (
        <GestureHandlerRootView className="flex-1 bg-slate-50">
            <StatusBar style="dark" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Light Mode Premium Header */}
            <View className="z-20 bg-white border-b border-slate-100 shadow-sm pb-3 pt-12 px-4 rounded-b-3xl">
                    <View className="flex-row items-center justify-between mb-3">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
                            <Ionicons name="arrow-back" size={20} color="#0d1b3e" />
                        </TouchableOpacity>
                        
                        <View className="flex-1 items-center">
                            <Text className="text-[#0d1b3e] font-black text-[17px] tracking-wide">Notifications</Text>
                            {counts.unread > 0 && (
                                <View className="bg-[#f5a623]/10 px-2.5 py-0.5 rounded-full mt-1 border border-[#f5a623]/30">
                                    <Text className="text-[#f5a623] text-[10px] font-bold uppercase">{counts.unread} New Alerts</Text>
                                </View>
                            )}
                        </View>
                        
                        <View className="flex-row gap-2">
                            <TouchableOpacity 
                                onPress={() => { Alert.alert("Settings", "Notification Preferences Coming Soon!"); }} 
                                className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-100"
                            >
                                <Ionicons name="settings-outline" size={18} color="#0d1b3e" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Quick Tools Row (Mute, Sort, Read All) */}
                    <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row gap-2">
                             <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortAsc(!sortAsc); }} className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 flex-row items-center">
                                <Ionicons name="swap-vertical" size={12} color="#64748b" />
                                <Text className="text-[10px] font-bold text-slate-600 ml-1">Sort</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsMuted(!isMuted)} className={`px-3 py-1.5 rounded-full border flex-row items-center ${isMuted ? 'bg-[#fee2e2] border-[#f87171]' : 'bg-slate-50 border-slate-200'}`}>
                                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={12} color={isMuted ? "#ef4444" : "#64748b"} />
                                <Text className={`text-[10px] font-bold ml-1 ${isMuted ? 'text-red-500' : 'text-slate-600'}`}>{isMuted ? 'Muted' : 'Sound'}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View className="flex-row gap-2">
                            <TouchableOpacity onPress={markAllAsRead} className="px-3 py-1.5 rounded-full bg-[#0d1b3e] flex-row items-center shadow-sm">
                                <Ionicons name="checkmark-done" size={12} color="#f5a623" />
                                <Text className="text-[#f5a623] text-[10px] font-bold ml-1">Read All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={clearAll} className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center border border-rose-100">
                                <Ionicons name="trash" size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Modern Search Bar */}
                    <View className="flex-row items-center bg-slate-50 rounded-2xl p-1 shadow-sm border border-slate-100 mb-2">
                        <View className="p-2 ml-1">
                            <Ionicons name="search" size={18} color="#94A3B8" />
                        </View>
                        <TextInput 
                            placeholder="Search in notifications..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="flex-1 font-medium text-[#0d1b3e] text-[13px] h-10"
                            placeholderTextColor="#94A3B8"
                        />
                         {searchQuery.length > 0 ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-2 mr-1">
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={() => Alert.alert("Voice Search", "Coming Soon!")} className="p-2 mr-1">
                                <Ionicons name="mic" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="flex-row px-1">
                        <FilterTab label="All" value="all" count={counts.all} />
                        <FilterTab label="Unread" value="unread" count={counts.unread} />
                        <FilterTab label="Urgent" value="high" count={counts.high} />
                    </View>
            </View>

            <View className="flex-1 z-10 pt-2">

                {loading ? (
                    <View className="px-2 pt-2">
                        <NotificationSkeleton />
                        <NotificationSkeleton />
                    </View>
                ) : (
                    <SectionList
                        sections={sortAsc ? getFilteredAndGrouped().reverse() : getFilteredAndGrouped()}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={true}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5a623" />
                        }
                        renderSectionHeader={({ section: { title } }) => (
                            <View className="py-2 items-center bg-slate-50/90">
                                <View className="px-4 py-1.5 rounded-full overflow-hidden border border-slate-200 bg-white shadow-sm">
                                    <Text className="text-[#0d1b3e] font-bold text-[11px] uppercase tracking-wider">{title}</Text>
                                </View>
                            </View>
                        )}
                        renderItem={renderSwipeableItem}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20 opacity-80">
                                <View className="bg-white border border-slate-100 w-20 h-20 rounded-3xl items-center justify-center mb-4 shadow-sm transform rotate-12">
                                    <Ionicons name="checkmark-circle-outline" size={40} color="#f5a623" />
                                </View>
                                <Text className="text-[#0d1b3e] font-black text-base uppercase tracking-widest">All clear</Text>
                                <Text className="text-slate-400 text-center mt-2 text-[13px] px-8">You have no new notifications right now.</Text>
                            </View>
                        }
                    />
                )}
            </View>
            
            {/* Undo Toast */}
            {showUndo && (
                <Animated.View 
                    entering={SlideInDown} 
                    exiting={SlideOutDown} 
                    className="absolute bottom-8 left-4 right-4 bg-slate-900 rounded-xl p-4 flex-row justify-between items-center shadow-2xl"
                >
                    <Text className="text-white font-bold ml-2">Notification deleted</Text>
                    <TouchableOpacity onPress={handleUndo} className="bg-white/20 px-4 py-1.5 rounded-lg">
                        <Text className="text-yellow-400 font-bold uppercase text-xs tracking-wider">Undo</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </GestureHandlerRootView>
    );
}
