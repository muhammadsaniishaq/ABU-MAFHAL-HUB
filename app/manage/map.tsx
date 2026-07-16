import { View, Text, Dimensions, ScrollView, Animated, Easing, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import { useAppSettings } from '../../hooks/useAppSettings';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Utility to assign colors based on transaction type
const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('airtime')) return '#10B981'; // Emerald
    if (t.includes('data')) return '#3B82F6';   // Blue
    if (t.includes('nin')) return '#EAB308';    // Yellow
    if (t.includes('bvn')) return '#A855F7';    // Purple
    if (t.includes('crypto')) return '#F7931A'; // Orange/Bitcoin
    if (t.includes('fund')) return '#14B8A6';   // Teal
    return '#22D3EE'; // Default Cyan
};

const getTypeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('airtime')) return 'call';
    if (t.includes('data')) return 'wifi';
    if (t.includes('nin')) return 'finger-print';
    if (t.includes('bvn')) return 'card';
    if (t.includes('crypto')) return 'logo-bitcoin';
    if (t.includes('fund')) return 'wallet';
    return 'swap-horizontal';
};

export default function GeoMap() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [dailyVolume, setDailyVolume] = useState(0);
    const [dailyCount, setDailyCount] = useState(0);
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [pingLatency, setPingLatency] = useState(12);
    
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start Radar Spin Animation
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        fetchInitialData();

        // Simulate network latency variations
        const interval = setInterval(() => setPingLatency(Math.floor(Math.random() * 15) + 10), 3000);

        // Subscribe to real-time inserts on transactions
        const channel = supabase.channel('public:transactions')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
                const newTx = payload.new;
                
                // Add new transaction to top of list
                setTransactions(prev => [newTx, ...prev].slice(0, 15)); // Keep last 15
                
                // Update stats
                setDailyCount(prev => prev + 1);
                if (newTx.amount) {
                    setDailyVolume(prev => prev + Number(newTx.amount));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, []);

    const fetchInitialData = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(15);
                
            if (data) setTransactions(data);

            const { data: statsData } = await supabase
                .from('transactions')
                .select('amount')
                .gte('created_at', today.toISOString());

            if (statsData) {
                setDailyCount(statsData.length);
                const total = statsData.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
                setDailyVolume(total);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <View className="flex-1 bg-slate-950">
            <Stack.Screen options={{
                title: '',
                headerTransparent: true,
                headerTintColor: '#38BDF8',
                headerBackVisible: false,
            }} />

            {/* FULLSCREEN RADAR BACKGROUND (z-0) */}
            <View className="absolute inset-0 items-center justify-center overflow-hidden z-0">
                {/* Grid Overlay */}
                <View className="absolute inset-0 opacity-10">
                    {Array.from({ length: Math.ceil(height / 40) }).map((_, i) => (
                        <View key={`h-${i}`} style={{ top: i * 40, height: 1, width: '100%', backgroundColor: '#38BDF8' }} className="absolute" />
                    ))}
                    {Array.from({ length: Math.ceil(width / 40) }).map((_, i) => (
                        <View key={`v-${i}`} style={{ left: i * 40, width: 1, height: '100%', backgroundColor: '#38BDF8' }} className="absolute" />
                    ))}
                </View>

                {/* Radar Map Visual */}
                <View className="w-[800px] h-[800px] items-center justify-center relative opacity-40">
                    {/* Concentric Circles */}
                    <View className="absolute w-[800px] h-[800px] border border-cyan-900/30 rounded-full" />
                    <View className="absolute w-[600px] h-[600px] border border-cyan-800/40 rounded-full" />
                    <View className="absolute w-[400px] h-[400px] border border-cyan-700/50 rounded-full" />
                    <View className="absolute w-[200px] h-[200px] border border-cyan-600/60 rounded-full" />
                    <View className="absolute w-[80px] h-[80px] border border-cyan-400 rounded-full bg-cyan-900/40" />
                    
                    {/* Crosshairs */}
                    <View className="absolute w-full h-[1px] bg-cyan-800/50" />
                    <View className="absolute h-full w-[1px] bg-cyan-800/50" />

                    {/* Sweeping Radar Arm */}
                    <Animated.View style={{ transform: [{ rotate: spin }], position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                         <LinearGradient 
                            colors={['transparent', 'rgba(34, 211, 238, 0.15)', 'rgba(34, 211, 238, 0.6)']} 
                            style={{ position: 'absolute', top: 0, right: 400, width: 400, height: 400, borderTopLeftRadius: 400 }}
                            start={{x: 1, y: 1}} end={{x: 0, y: 0}}
                         />
                    </Animated.View>

                    {/* Live Pings (Mapped to fullscreen) */}
                    {transactions.map((tx, i) => {
                        const hash = tx.id.charCodeAt(0) * 31 + tx.id.charCodeAt(tx.id.length - 1) * 17 || 0;
                        const radius = 40 + (hash % 340); // larger spread
                        const angle = (hash % 360) * (Math.PI / 180);
                        const x = 400 + radius * Math.cos(angle) - 6; 
                        const y = 400 + radius * Math.sin(angle) - 6;
                        const color = getTypeColor(tx.type);
                        const isNew = i < 4; // Ping newest 4

                        return (
                            <TouchableOpacity 
                                key={tx.id} 
                                className="absolute items-center justify-center" 
                                style={{ top: y, left: x }}
                                onPress={() => setSelectedTx(tx)}
                            >
                                <View style={{ backgroundColor: color }} className="w-3 h-3 rounded-full z-10 border border-slate-900" />
                                {isNew && (
                                    <View style={{ backgroundColor: color, opacity: 0.4 }} className="w-10 h-10 rounded-full absolute animate-ping" />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* FOREGROUND HUD UI (z-10) */}
            <View className="flex-1 z-10 pt-24 px-4 pb-6 justify-between pointer-events-box-none">
                
                {/* Top Header & Status */}
                <View className="pointer-events-auto">
                    <View className="flex-row items-center justify-between mb-4 px-2">
                        <Text className="text-cyan-400 font-black text-xl tracking-widest uppercase">Global Radar</Text>
                        <View className="flex-row items-center bg-emerald-950/50 px-3 py-1.5 rounded-full border border-emerald-800">
                            <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
                            <Text className="text-emerald-400 text-[10px] font-bold tracking-widest">SYS.ONLINE • {pingLatency}ms</Text>
                        </View>
                    </View>

                    {/* HUD Widgets (Glassmorphism) */}
                    <View className="flex-row justify-between gap-3">
                        <View className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 flex-1 items-start shadow-xl">
                            <Ionicons name="pulse" size={18} color="#10B981" className="mb-2" />
                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Live Txns</Text>
                            <Text className="text-white font-black text-2xl">{dailyCount}</Text>
                        </View>
                        <View className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 flex-1 items-start shadow-xl">
                            <Ionicons name="stats-chart" size={18} color="#38BDF8" className="mb-2" />
                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Daily Vol</Text>
                            <Text className="text-white font-black text-xl tracking-tighter">₦{dailyVolume.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>

                {/* Bottom Panel: Live Feed (Glassmorphism) */}
                <View className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-5 h-1/2 mt-4 pointer-events-auto shadow-2xl">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <Ionicons name="list" size={16} color="#94A3B8" className="mr-2" />
                            <Text className="text-slate-300 text-sm font-bold tracking-widest uppercase">Live Intercepts</Text>
                        </View>
                        <Text className="text-slate-500 text-[10px] tracking-widest uppercase">Decrypted</Text>
                    </View>
                    
                    <ScrollView className="gap-2" showsVerticalScrollIndicator={false}>
                        {transactions.map((tx, i) => {
                            const color = getTypeColor(tx.type);
                            const icon = getTypeIcon(tx.type);
                            return (
                                <TouchableOpacity 
                                    key={tx.id} 
                                    onPress={() => setSelectedTx(tx)}
                                    className={`flex-row items-center bg-slate-800/40 p-3 rounded-2xl border border-slate-700/30 ${i === 0 ? 'bg-slate-800/80 border-slate-600/50 shadow-lg' : ''}`}
                                >
                                    <View style={{ backgroundColor: `${color}15` }} className="p-2.5 rounded-xl mr-3 border border-slate-700/50">
                                        <Ionicons name={icon as any} size={16} color={color} />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row justify-between items-center mb-0.5">
                                            <Text className="text-white font-bold text-sm tracking-tight">₦{tx.amount?.toLocaleString()}</Text>
                                            <Text className="text-slate-400 text-[10px] font-bold">{new Date(tx.created_at).toLocaleTimeString()}</Text>
                                        </View>
                                        <View className="flex-row justify-between items-center">
                                            <Text style={{ color }} className="text-[10px] font-bold uppercase tracking-wider">{tx.type}</Text>
                                            <Text className="text-slate-400 text-[10px] uppercase font-bold" numberOfLines={1}>
                                                {tx.status === 'success' || tx.status === 'completed' ? 'SUCCESS' : (tx.status === 'pending' ? 'PENDING' : 'FAILED')}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        {transactions.length === 0 && (
                            <View className="items-center justify-center py-10 opacity-50">
                                <Ionicons name="scan-outline" size={32} color="#94A3B8" />
                                <Text className="text-slate-400 text-xs mt-3 uppercase tracking-widest font-bold">Scanning Sectors...</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* HOLO-MODAL FOR TRANSACTION DETAILS */}
            <Modal visible={!!selectedTx} animationType="fade" transparent={true}>
                <View className="flex-1 bg-slate-950/80 justify-center items-center p-4">
                    <Pressable className="absolute inset-0" onPress={() => setSelectedTx(null)} />
                    
                    {selectedTx && (
                        <View className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
                            <View className="items-center mb-6">
                                <View style={{ backgroundColor: `${getTypeColor(selectedTx.type)}20` }} className="p-4 rounded-2xl mb-3">
                                    <Ionicons name={getTypeIcon(selectedTx.type) as any} size={32} color={getTypeColor(selectedTx.type)} />
                                </View>
                                <Text className="text-white text-2xl font-black tracking-tighter">₦{selectedTx.amount?.toLocaleString()}</Text>
                                <Text style={{ color: getTypeColor(selectedTx.type) }} className="text-xs font-bold uppercase tracking-widest mt-1">{selectedTx.type}</Text>
                            </View>

                            <View className="bg-slate-800/50 rounded-2xl p-4 gap-3 mb-6">
                                <View className="flex-row justify-between">
                                    <Text className="text-slate-400 text-xs uppercase font-bold">Ref ID</Text>
                                    <Text className="text-white text-xs font-mono">{selectedTx.id.split('-')[0] || selectedTx.id}</Text>
                                </View>
                                <View className="h-[1px] bg-slate-700/50" />
                                <View className="flex-row justify-between">
                                    <Text className="text-slate-400 text-xs uppercase font-bold">User ID</Text>
                                    <Text className="text-white text-xs font-mono">{selectedTx.user_id?.split('-')[0] || 'Unknown'}</Text>
                                </View>
                                <View className="h-[1px] bg-slate-700/50" />
                                <View className="flex-row justify-between">
                                    <Text className="text-slate-400 text-xs uppercase font-bold">Status</Text>
                                    <Text className="text-white text-xs uppercase font-bold">{selectedTx.status}</Text>
                                </View>
                                <View className="h-[1px] bg-slate-700/50" />
                                <View className="flex-row justify-between">
                                    <Text className="text-slate-400 text-xs uppercase font-bold">Timestamp</Text>
                                    <Text className="text-white text-xs">{new Date(selectedTx.created_at).toLocaleString()}</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={() => setSelectedTx(null)}
                                className="bg-slate-800 py-4 rounded-xl items-center border border-slate-700"
                            >
                                <Text className="text-white font-bold tracking-widest uppercase">Close HUD</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
}
