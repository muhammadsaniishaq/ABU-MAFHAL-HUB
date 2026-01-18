import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';

// Define Log Interface
interface Log {
    id: string;
    action: string;
    admin_id: string; // Or expand to profile name
    details: any;
    created_at: string;
    target_resource?: string;
}

export default function AuditLogs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching logs:', error);
        } else {
            setLogs(data || []);
        }
        setLoading(false);
    };

    const getSeverity = (action: string) => {
        if (action.includes('Failed') || action.includes('Blocked')) return 'critical';
        if (action.includes('Update') || action.includes('Warning')) return 'warning';
        return 'info';
    };

    const filteredLogs = logs.filter(l =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.target_resource?.toLowerCase().includes(search.toLowerCase())
    );

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'System Audit Logs' }} />

            <View className="p-4 bg-white border-b border-gray-100">
                <View className="flex-row bg-gray-50 rounded-xl px-4 py-3 items-center border border-gray-100">
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        placeholder="Search logs..."
                        placeholderTextColor="#94A3B8"
                        className="flex-1 ml-3 font-medium text-slate-700"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#4F46E5" />
                </View>
            ) : (
                <FlatList
                    data={filteredLogs}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    ListEmptyComponent={<Text className="text-center text-gray-400 mt-10">No logs found</Text>}
                    renderItem={({ item }) => {
                        const severity = getSeverity(item.action);
                        return (
                            <View className="bg-white p-4 items-start rounded-xl mb-3 border border-gray-100 shadow-sm">
                                <View className="flex-row justify-between w-full mb-2">
                                    <View className="flex-row items-center gap-2">
                                        <View className={`w-2 h-2 rounded-full ${severity === 'critical' ? 'bg-red-500' :
                                            severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                                            }`} />
                                        <Text className="font-bold text-slate-700">{item.action}</Text>
                                    </View>
                                    <Text className="text-xs text-gray-400 font-medium">{formatTime(item.created_at)}</Text>
                                </View>
                                <Text className="text-gray-500 text-xs mb-2 leading-5">
                                    {typeof item.details === 'string' ? item.details : JSON.stringify(item.details)}
                                </Text>
                                <View className="flex-row justify-between w-full items-center border-t border-gray-50 pt-2">
                                    <View className="bg-gray-100 px-2 py-1 rounded">
                                        <Text className="text-[10px] text-gray-500 font-bold uppercase" numberOfLines={1}>
                                            {item.id.split('-')[0]}...
                                        </Text>
                                    </View>
                                    <Text className="text-[10px] text-slate-400 font-bold">
                                        ID: {item.admin_id ? item.admin_id.substring(0, 8) : 'SYSTEM'}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}
