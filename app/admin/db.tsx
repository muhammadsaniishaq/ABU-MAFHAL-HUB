import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

const tables = ['public.users', 'public.transactions', 'public.logs', 'auth.sessions', 'public.products'];

export default function DatabaseManager() {
    const [selectedTable, setSelectedTable] = useState('public.users');
    const [sqlMode, setSqlMode] = useState(false);
    const [query, setQuery] = useState('SELECT * FROM users WHERE active = true LIMIT 10;');

    return (
        <View className="flex-1 bg-slate-950">
            <Stack.Screen options={{
                title: 'Data Forge',
                headerStyle: { backgroundColor: '#020617' },
                headerTintColor: '#fff',
                headerRight: () => (
                    <TouchableOpacity onPress={() => setSqlMode(!sqlMode)} className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                        <Text className="text-slate-300 font-bold text-xs">{sqlMode ? 'View Tables' : 'SQL Editor'}</Text>
                    </TouchableOpacity>
                )
            }} />

            {sqlMode ? (
                <View className="flex-1 p-4">
                    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex-1 mb-4">
                        <View className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex-row items-center justify-between">
                            <Text className="text-slate-400 text-xs font-mono">buffer.sql</Text>
                            <TouchableOpacity>
                                <Ionicons name="play" size={16} color="#10B981" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            multiline
                            className="flex-1 p-4 text-emerald-400 font-mono text-sm leading-6"
                            textAlignVertical="top"
                        />
                    </View>
                    <TouchableOpacity className="bg-emerald-600 h-12 rounded-xl items-center justify-center">
                        <Text className="text-white font-bold font-mono">EXECUTE QUERY</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View className="flex-1 flex-row">
                    {/* Sidebar */}
                    <View className="w-1/3 bg-slate-900 border-r border-slate-800 pt-4">
                        <Text className="text-slate-500 font-bold uppercase text-[10px] mb-4 px-4">Tables</Text>
                        <ScrollView>
                            {tables.map(table => (
                                <TouchableOpacity
                                    key={table}
                                    onPress={() => setSelectedTable(table)}
                                    className={`px-4 py-3 flex-row items-center gap-2 ${selectedTable === table ? 'bg-slate-800 border-l-2 border-emerald-500' : ''}`}
                                >
                                    <Ionicons name="grid" size={14} color={selectedTable === table ? '#10B981' : '#64748B'} />
                                    <Text className={`text-xs font-mono ${selectedTable === table ? 'text-white font-bold' : 'text-slate-500'}`}>{table}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Content */}
                    <View className="flex-1 bg-slate-950 p-4">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-white font-bold text-lg font-mono">{selectedTable}</Text>
                            <View className="flex-row gap-2">
                                <TouchableOpacity className="bg-slate-800 p-2 rounded-lg">
                                    <Ionicons name="add" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                                <TouchableOpacity className="bg-slate-800 p-2 rounded-lg">
                                    <Ionicons name="refresh" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView horizontal>
                            <View>
                                {/* Header Row */}
                                <View className="flex-row border-b border-slate-800 pb-2 mb-2">
                                    {['id', 'created_at', 'status', 'email', 'tier'].map(col => (
                                        <Text key={col} className="w-32 text-slate-500 font-bold text-xs uppercase">{col}</Text>
                                    ))}
                                </View>
                                {/* Data Rows */}
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <View key={i} className="flex-row py-3 border-b border-slate-900 hover:bg-slate-900/50">
                                        <Text className="w-32 text-slate-400 text-xs font-mono">us_{i + 4902}</Text>
                                        <Text className="w-32 text-slate-400 text-xs">2026-01-17</Text>
                                        <Text className={`w-32 text-xs font-bold ${i % 3 === 0 ? 'text-green-500' : 'text-slate-300'}`}>
                                            {i % 3 === 0 ? 'active' : 'idle'}
                                        </Text>
                                        <Text className="w-32 text-slate-400 text-xs truncate">user{i}@ex.com</Text>
                                        <Text className="w-32 text-purple-400 text-xs font-bold">PRO</Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}
        </View>
    );
}
