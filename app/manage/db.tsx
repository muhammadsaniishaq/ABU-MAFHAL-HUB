import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const tables = [
    { name: 'profiles', icon: 'people' },
    { name: 'transactions', icon: 'receipt' },
    { name: 'audit_logs', icon: 'list' },
    { name: 'kyc_requests', icon: 'scan' },
    { name: 'loans', icon: 'cash' },
    { name: 'tickets', icon: 'chatbubbles' },
];

export default function DatabaseManager() {
    const [selectedTable, setSelectedTable] = useState('profiles');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sqlMode, setSqlMode] = useState(false);
    const [query, setQuery] = useState('SELECT * FROM profiles LIMIT 10;');

    useEffect(() => {
        fetchTableData();
    }, [selectedTable]);

    const fetchTableData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(selectedTable)
                .select('*')
                .limit(20)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRows(data || []);
        } catch (error: any) {
            Alert.alert('Data Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

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
                                    key={table.name}
                                    onPress={() => setSelectedTable(table.name)}
                                    className={`px-4 py-3 flex-row items-center gap-2 ${selectedTable === table.name ? 'bg-slate-800 border-l-2 border-emerald-500' : ''}`}
                                >
                                    <Ionicons name={table.icon as any} size={14} color={selectedTable === table.name ? '#10B981' : '#64748B'} />
                                    <Text className={`text-xs font-mono ${selectedTable === table.name ? 'text-white font-bold' : 'text-slate-500'}`}>{table.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Content */}
                    <View className="flex-1 bg-slate-950 p-4">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-white font-bold text-lg font-mono capitalize">{selectedTable}</Text>
                            <View className="flex-row gap-2">
                                <TouchableOpacity onPress={fetchTableData} className="bg-slate-800 p-2 rounded-lg">
                                    <Ionicons name="refresh" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {loading ? (
                            <View className="flex-1 items-center justify-center">
                                <ActivityIndicator color="#10B981" />
                            </View>
                        ) : (
                            <ScrollView horizontal>
                                <View>
                                    {/* Header Row */}
                                    <View className="flex-row border-b border-slate-800 pb-2 mb-2">
                                        {columns.map(col => (
                                            <Text key={col} className="w-40 text-slate-500 font-bold text-xs uppercase px-2">{col}</Text>
                                        ))}
                                    </View>
                                    {/* Data Rows */}
                                    {rows.map((row, i) => (
                                        <View key={i} className="flex-row py-3 border-b border-slate-900">
                                            {columns.map(col => (
                                                <Text key={col} className="w-40 text-slate-300 text-[10px] font-mono px-2" numberOfLines={1}>
                                                    {String(row[col])}
                                                </Text>
                                            ))}
                                        </View>
                                    ))}
                                    {rows.length === 0 && (
                                        <Text className="text-slate-600 italic mt-10">No data in this table</Text>
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}
