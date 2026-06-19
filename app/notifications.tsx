import { View, Text, SectionList, ActivityIndicator, TouchableOpacity, Alert, TextInput, Dimensions, Animated as RNAnimated } from 'react-native';
import { Stack } from 'expo-router';
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
        <View className="bg-white/80 p-4 rounded-xl mb-3 shadow-sm border border-white/50 flex-row">
            <View className="w-10 h-10 rounded-full bg-gray-200/50 mr-4" />
            <View className="flex-1">
                <View className="flex-row justify-between mb-2">
                    <View className="h-4 w-24 bg-gray-200/50 rounded" />
                    <View className="h-3 w-12 bg-gray-200/50 rounded" />
                </View>
                <View className="h-3 w-full bg-gray-200/50 rounded mb-1" />
                <View className="h-3 w-3/4 bg-gray-200/50 rounded" />
            </View>
        </View>
    );
};

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Undo State
    const [deletedItem, setDeletedItem] = useState<{ item: any, index: number } | null>(null);
    const [showUndo, setShowUndo] = useState(false);
    const undoTimeout = useRef<NodeJS.Timeout | null>(null);

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
        <TouchableOpacity onPress={() => setFilter(value)} className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${filter === value ? 'bg-indigo-600 shadow-xl' : 'bg-white/80 border border-white/50'}`}>
            <Text className={`font-bold mr-1 ${filter === value ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
            {count > 0 && (
                <View className={`rounded-full px-1.5 py-0.5 ${filter === value ? 'bg-white/30' : 'bg-slate-200/50'}`}>
                    <Text className={`text-[10px] font-bold ${filter === value ? 'text-white' : 'text-slate-500'}`}>{count}</Text>
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
                <TouchableOpacity onPress={() => confirmDelete(item.id, item)} className="bg-rose-500 justify-center items-center w-20 h-full rounded-2xl my-1 ml-2 shadow-sm">
                    <RNAnimated.View style={{ transform: [{ scale }] }}>
                        <Ionicons name="trash" size={24} color="white" />
                    </RNAnimated.View>
                </TouchableOpacity>
            );
        };

        const isHigh = item.data?.priority === 'high';

        return (
            <Animated.View entering={FadeInUp} layout={Layout.springify()}>
                <Swipeable renderRightActions={renderRightActions}>
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => markAsRead(item, !item.is_read)}
                        className={`p-4 rounded-3xl mb-3 shadow-sm border border-white/60 relative overflow-hidden ${!item.is_read ? 'bg-white/95' : 'bg-white/60'}`}
                    >
                        {/* Status Indicator Line */}
                        {!item.is_read && <View className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500" />}
                        
                        <View className="flex-row items-start">
                             {/* Icon with Soft Background */}
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isHigh ? 'bg-rose-500/10' : 'bg-indigo-500/10'}`}>
                                <Ionicons name={isHigh ? 'warning' : 'notifications'} size={24} color={isHigh ? '#F43F5E' : '#6366F1'} />
                            </View>
                            
                            <View className="flex-1">
                                <View className="flex-row justify-between items-start mb-1">
                                    <Text className={`text-[16px] flex-1 mr-2 ${!item.is_read ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                                        {item.title}
                                    </Text>
                                    <View className="bg-slate-200/50 px-2 py-1 rounded-lg">
                                        <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            {new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </Text>
                                    </View>
                                </View>
                                <Text className={`leading-5 text-[14px] ${!item.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{item.body}</Text>
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

            {/* 🔥 Ultra-Modern Background Blobs (Premium Feel) */}
            <View className="absolute inset-0 overflow-hidden pointer-events-none">
                <LinearGradient
                    colors={['rgba(99, 102, 241, 0.08)', 'rgba(168, 85, 247, 0.08)']}
                    className="absolute -top-[10%] -left-[20%] w-[120%] h-[50%] rounded-full transform -rotate-12"
                />
                <LinearGradient
                    colors={['rgba(236, 72, 153, 0.08)', 'transparent']}
                    className="absolute top-[40%] -right-[30%] w-[100%] h-[60%] rounded-full"
                />
                 <LinearGradient
                    colors={['rgba(59, 130, 246, 0.05)', 'transparent']}
                    className="absolute bottom-[-10%] left-[-10%] w-[100%] h-[40%] rounded-full"
                />
            </View>

            <Stack.Screen options={{ 
                title: 'Notifications', 
                headerTintColor: '#1E293B',
                headerTransparent: true,
                headerBlurEffect: 'regular',
                headerBackground: () => <BlurView intensity={80} tint="light" className="flex-1 bg-white/70" />,
                headerRight: () => (
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity onPress={markAllAsRead}>
                            <Ionicons name="checkmark-done-circle" size={24} color="#4F46E5" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={clearAll}>
                            <Ionicons name="trash-bin-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )
            }} />

            {/* Using inline style to ensure padding applies correctly. 160 roughly accounts for transparent header + safe area */}
            <View style={{ paddingTop: 160 }} className="flex-1">
                {/* Search & Filter Header */}
                <View className="px-5 pb-4 z-10">
                    <View className="flex-row items-center bg-white/90 p-2 rounded-[20px] shadow-sm border border-white/60 mb-5">
                        <View className="p-2 ml-1">
                            <Ionicons name="search" size={20} color="#94A3B8" />
                        </View>
                        <TextInput 
                            placeholder="Search alerts..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="flex-1 font-semibold text-slate-700 text-base"
                            placeholderTextColor="#94A3B8"
                        />
                         {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-2">
                                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="flex-row">
                        <FilterTab label="All" value="all" count={counts.all} />
                        <FilterTab label="Unread" value="unread" count={counts.unread} />
                        <FilterTab label="Urgent" value="high" count={counts.high} />
                    </View>
                </View>

                {loading ? (
                    <View className="px-4 pt-4">
                        <NotificationSkeleton />
                        <NotificationSkeleton />
                        <NotificationSkeleton />
                    </View>
                ) : (
                    <SectionList
                        sections={getFilteredAndGrouped()}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        renderSectionHeader={({ section: { title } }) => (
                            <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2 mt-4 ml-1">{title}</Text>
                        )}
                        renderItem={renderSwipeableItem}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20 opacity-50">
                                <View className="bg-gray-100 w-20 h-20 rounded-full items-center justify-center mb-4">
                                    <Ionicons name="notifications-off-outline" size={40} color="#94A3B8" />
                                </View>
                                <Text className="text-gray-500 font-bold text-lg">All caught up!</Text>
                                <Text className="text-gray-400 text-center px-10 mt-1">No notifications found matching your filter.</Text>
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
