import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

const initialBots = [
    { id: '1', name: 'Auto-Ban High Risk IPs', trigger: 'Security Alert', action: 'Block User', active: true },
    { id: '2', name: 'Welcome Bonus Crediter', trigger: 'New Signup', action: 'Credit Wallet', active: true },
    { id: '3', name: 'Failed Tx Notifier', trigger: 'Tx Failure', action: 'Email Admin', active: false },
];

export default function AutomationBuilder() {
    const [bots, setBots] = useState(initialBots);

    const toggleBot = (id: string) => {
        setBots(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
    };

    return (
        <View className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Workflow Automation',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            <View className="p-4">
                <View className="bg-indigo-600 rounded-2xl p-6 mb-6">
                    <Text className="text-white text-3xl font-black mb-1">Active Bots</Text>
                    <Text className="text-indigo-200 font-medium">System is running {bots.filter(b => b.active).length} automated workflows.</Text>
                </View>

                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-slate-400 font-bold uppercase text-[10px]">Your Workflows</Text>
                    <TouchableOpacity className="bg-indigo-600 px-3 py-1.5 rounded-lg flex-row items-center">
                        <Ionicons name="add" size={16} color="white" />
                        <Text className="text-white text-xs font-bold ml-1">New Flow</Text>
                    </TouchableOpacity>
                </View>

                {bots.map(bot => (
                    <View key={bot.id} className="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700">
                        <View className="flex-row justify-between items-start mb-4">
                            <View className="flex-row items-center gap-3">
                                <View className={`w-10 h-10 rounded-lg items-center justify-center ${bot.active ? 'bg-indigo-500/20' : 'bg-slate-700'}`}>
                                    <Ionicons name="flash" size={20} color={bot.active ? '#818CF8' : '#94A3B8'} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-base">{bot.name}</Text>
                                    <Text className="text-slate-500 text-xs">ID: {bot.id}</Text>
                                </View>
                            </View>
                            <Switch
                                value={bot.active}
                                onValueChange={() => toggleBot(bot.id)}
                                trackColor={{ false: '#334155', true: '#6366F1' }}
                                thumbColor="white"
                            />
                        </View>

                        {/* Visual Node Mock */}
                        <View className="flex-row items-center gap-2 px-2">
                            <View className="bg-slate-900 px-3 py-1.5 rounded border border-slate-600">
                                <Text className="text-slate-300 text-[10px] font-mono">IF: {bot.trigger}</Text>
                            </View>
                            <View className="h-[1px] w-4 bg-slate-600" />
                            <Ionicons name="arrow-forward" size={12} color="#475569" />
                            <View className="h-[1px] w-4 bg-slate-600" />
                            <View className="bg-slate-900 px-3 py-1.5 rounded border border-slate-600">
                                <Text className="text-emerald-400 text-[10px] font-mono">THEN: {bot.action}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
