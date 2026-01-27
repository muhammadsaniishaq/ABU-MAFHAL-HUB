import { View, Text, TouchableOpacity, ScrollView, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Simulated Login Data
const MOCK_LOGINS = [
    { id: 1, ip: '197.210.45.22', location: 'Lagos, NG', device: 'iPhone 14 Pro', status: 'success', time: 'Just now' },
    { id: 2, ip: '102.12.33.19', location: 'Abuja, NG', device: 'Samsung S23', status: 'success', time: '2m ago' },
    { id: 3, ip: '45.22.11.90', location: 'Kaduna, NG', device: 'Chrome / Win', status: 'failed', time: '5m ago' },
    { id: 4, ip: '197.210.22.11', location: 'Kano, NG', device: 'Tecno Spark', status: 'success', time: '12m ago' },
    { id: 5, ip: '105.11.22.33', location: 'Port Harcourt, NG', device: 'Infinix Hot', status: 'success', time: '15m ago' },
];

export default function ForensicsScreen() {
    const router = useRouter();
    const [systemHealth, setSystemHealth] = useState(98);
    const [activeThreats, setActiveThreats] = useState(0);
    const [isFrozen, setIsFrozen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleFreeze = async () => {
        if (isFrozen) {
            Alert.alert("Lift Freeze?", "Are you sure you want to resume all transaction processing?", [
                { text: "Cancel", style: "cancel" },
                { text: "Resume Operations", onPress: () => setIsFrozen(false) }
            ]);
        } else {
            Alert.alert("EMERGENCY FREEZE", "This will instantly BLOCK all withdrawals and transfers system-wide. Are you sure?", [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "FREEZE SYSTEM", 
                    style: "destructive",
                    onPress: () => {
                        setIsFrozen(true);
                        // In real app, this would call an Edge Function to set a global flag in Redis/DB
                    }
                }
            ]);
        }
    };

    return (
        <View className="flex-1 bg-slate-950">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Cyber Header */}
            <LinearGradient colors={['#0F172A', '#020617']} className="pt-14 pb-6 px-6 border-b border-slate-800">
                <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <Ionicons name="arrow-back" size={24} color="#94A3B8" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-red-500 text-xs font-bold tracking-[4px] uppercase animate-pulse">Classified</Text>
                        <Text className="text-white text-xl font-black">Forensics</Text>
                    </View>
                    <View className="w-10" />
                </View>
                
                {/* System Status Ticker */}
                <View className="flex-row items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                     <View className="flex-row items-center">
                        <View className={`w-2 h-2 rounded-full mr-2 ${isFrozen ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <Text className="text-slate-400 text-xs font-bold uppercase">System Status</Text>
                     </View>
                     <Text className={`font-bold ${isFrozen ? 'text-red-500' : 'text-emerald-500'}`}>
                        {isFrozen ? 'LOCKDOWN ACTIVE' : 'OPERATIONAL'}
                     </Text>
                </View>
            </LinearGradient>

            <ScrollView className="flex-1 p-6">
                
                {/* Visual Map Placeholder */}
                <View className="h-64 bg-slate-900 rounded-2xl border border-slate-800 mb-6 overflow-hidden relative">
                    {/* Grid Lines */}
                    <View className="absolute inset-0 opacity-20">
                         {Array.from({ length: 10 }).map((_, i) => (
                             <View key={`h-${i}`} className="absolute w-full h-[1px] bg-indigo-500" style={{ top: `${i * 10}%` }} />
                         ))}
                         {Array.from({ length: 10 }).map((_, i) => (
                             <View key={`v-${i}`} className="absolute h-full w-[1px] bg-indigo-500" style={{ left: `${i * 10}%` }} />
                         ))}
                    </View>
                    
                    {/* Radar Sweep Animation (Simulated with View for simplicity) */}
                    <View className="absolute top-1/2 left-1/2 w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_20px_10px_rgba(99,102,241,0.5)] animate-ping" />
                    
                    {/* Map Dots */}
                    {MOCK_LOGINS.map((login, i) => (
                        <View 
                            key={i} 
                            className={`absolute w-2 h-2 rounded-full ${login.status === 'success' ? 'bg-emerald-400' : 'bg-red-500'}`}
                            style={{ top: `${20 + i * 15}%`, left: `${30 + i * 12}%` }}
                        />
                    ))}

                    <View className="absolute bottom-4 left-4">
                        <Text className="text-indigo-400 text-[10px] uppercase font-bold tracking-widest">Live Traffic Map</Text>
                    </View>
                </View>

                {/* KPI Grid */}
                <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
                    <View className="w-[48%] bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Health Score</Text>
                        <Text className="text-emerald-400 text-3xl font-black">{systemHealth}%</Text>
                    </View>
                    <View className="w-[48%] bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Active Sessions</Text>
                        <Text className="text-blue-400 text-3xl font-black">1.2k</Text>
                    </View>
                    <View className="w-[48%] bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Failed Auth</Text>
                        <Text className="text-amber-500 text-3xl font-black">23</Text>
                    </View>
                    <View className="w-[48%] bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Threat Level</Text>
                        <Text className="text-slate-200 text-3xl font-black">LOW</Text>
                    </View>
                </View>

                {/* Login Feed */}
                <Text className="text-white font-bold text-lg mb-4">Live Login Feed</Text>
                <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-8">
                    {MOCK_LOGINS.map((login, i) => (
                        <View key={i} className={`p-4 border-b border-slate-800 flex-row items-center justify-between ${i === MOCK_LOGINS.length - 1 ? 'border-b-0' : ''}`}>
                            <View className="flex-row items-center">
                                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${login.status === 'success' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                    <Ionicons name={login.status === 'success' ? 'checkmark' : 'close'} size={14} color={login.status === 'success' ? '#10B981' : '#EF4444'} />
                                </View>
                                <View>
                                    <Text className="text-slate-200 font-bold text-sm">{login.ip}</Text>
                                    <Text className="text-slate-500 text-xs">{login.location} • {login.device}</Text>
                                </View>
                            </View>
                            <Text className="text-slate-600 text-[10px] font-bold">{login.time}</Text>
                        </View>
                    ))}
                </View>

                {/* Emergency Controls */}
                <Text className="text-red-500 font-bold text-lg mb-4">Danger Zone</Text>
                <TouchableOpacity 
                    onPress={handleFreeze}
                    className={`p-6 rounded-2xl border-2 items-center flex-row justify-center ${isFrozen ? 'bg-red-500 border-red-400' : 'bg-red-500/10 border-red-500/50'}`}
                >
                    <Ionicons name="hand-left" size={24} color={isFrozen ? "white" : "#EF4444"} className="mr-3" />
                    <View>
                        <Text className={`text-lg font-black ${isFrozen ? 'text-white' : 'text-red-500'}`}>
                            {isFrozen ? 'SYSTEM FROZEN' : 'EMERGENCY FREEZE'}
                        </Text>
                        <Text className={`text-xs font-medium ${isFrozen ? 'text-white/80' : 'text-red-500/60'}`}>
                            {isFrozen ? 'Tap to lift lockdown' : 'Tap to halt all transactions'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
