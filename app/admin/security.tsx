import { View, Text, FlatList, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

// Mock Sessions
const initialSessions = [
    { id: '1', device: 'iPhone 14 Pro', ip: '102.12.98.2', loc: 'Lagos, NG', current: true, lastActive: 'Now' },
    { id: '2', device: 'MacBook Pro M2', ip: '197.210.45.1', loc: 'Abuja, NG', current: false, lastActive: '2h ago' },
    { id: '3', device: 'Chrome (Win 11)', ip: '45.23.11.90', loc: 'Kano, NG', current: false, lastActive: '1d ago' },
];

export default function SecurityHub() {
    const [sessions, setSessions] = useState(initialSessions);
    const [twoFactor, setTwoFactor] = useState(true);
    const [biometric, setBiometric] = useState(false);

    const revokeSession = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    return (
        <ScrollView className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Security Command',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row items-center mb-6">
                    <View className="w-16 h-16 bg-blue-500/10 rounded-full items-center justify-center mr-4 border border-blue-500/30">
                        <Ionicons name="shield-checkmark" size={32} color="#3B82F6" />
                    </View>
                    <View>
                        <Text className="text-white text-2xl font-black">Security Hub</Text>
                        <Text className="text-slate-400 font-medium">System Integrity & Access</Text>
                    </View>
                </View>

                {/* Authentication Controls */}
                <View className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4 mb-8">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4 tracking-wider">Authentication Policy</Text>

                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center gap-3">
                            <View className="bg-orange-500/20 p-2 rounded-lg">
                                <Ionicons name="key" size={18} color="#F97316" />
                            </View>
                            <View>
                                <Text className="text-white font-bold">Require 2FA</Text>
                                <Text className="text-slate-500 text-xs">For all admin actions</Text>
                            </View>
                        </View>
                        <Switch
                            value={twoFactor}
                            onValueChange={setTwoFactor}
                            trackColor={{ false: '#334155', true: '#F97316' }}
                            thumbColor="white"
                        />
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                            <View className="bg-purple-500/20 p-2 rounded-lg">
                                <Ionicons name="finger-print" size={18} color="#A855F7" />
                            </View>
                            <View>
                                <Text className="text-white font-bold">Biometric Login</Text>
                                <Text className="text-slate-500 text-xs">FaceID / TouchID access</Text>
                            </View>
                        </View>
                        <Switch
                            value={biometric}
                            onValueChange={setBiometric}
                            trackColor={{ false: '#334155', true: '#A855F7' }}
                            thumbColor="white"
                        />
                    </View>
                </View>

                {/* Active Sessions */}
                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-3 ml-1 tracking-wider">Active Sessions</Text>
                {sessions.map(session => (
                    <View key={session.id} className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <Ionicons
                                name={session.device.includes('iPhone') || session.device.includes('Android') ? 'phone-portrait' : 'laptop'}
                                size={20}
                                color="#64748B"
                            />
                            <View>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-slate-200 font-bold">{session.device}</Text>
                                    {session.current && (
                                        <View className="bg-green-500/20 px-1.5 py-0.5 rounded">
                                            <Text className="text-green-500 text-[8px] font-bold uppercase">Current</Text>
                                        </View>
                                    )}
                                </View>
                                <Text className="text-slate-500 text-xs">{session.ip} • {session.loc}</Text>
                            </View>
                        </View>

                        {!session.current && (
                            <TouchableOpacity onPress={() => revokeSession(session.id)} className="bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                                <Text className="text-red-400 text-xs font-bold">Revoke</Text>
                            </TouchableOpacity>
                        )}
                        {session.current && (
                            <Text className="text-green-500 text-xs font-bold">Online</Text>
                        )}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}
