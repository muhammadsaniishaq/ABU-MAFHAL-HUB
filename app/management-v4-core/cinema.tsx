import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useEffect, useState } from 'react';

type AuditLog = {
    id: string;
    admin_id: string;
    action: string;
    target_resource: string;
    details: any;
    created_at: string;
};

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setLogs(data);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-950">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-950">
            <Stack.Screen options={{
                title: 'Audit Logs',
                headerStyle: { backgroundColor: '#020617' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-white text-2xl font-black">System Audit</Text>
                        <Text className="text-slate-400">Real-time administrator actions</Text>
                    </View>
                    <TouchableOpacity onPress={fetchLogs} className="p-2 bg-slate-900 rounded-full">
                        <Ionicons name="refresh" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {logs.length > 0 ? (
                        logs.map((log) => (
                            <View key={log.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 mb-4">
                                <View className="flex-row justify-between mb-3">
                                    <View className="flex-row items-center gap-2">
                                        <View className={`w-2 h-2 rounded-full ${log.action.toLowerCase().includes('delete') ? 'bg-red-500' : 'bg-green-500'}`} />
                                        <Text className="text-white font-bold">{log.action}</Text>
                                    </View>
                                    <Text className="text-slate-500 text-[10px] font-mono">
                                        {new Date(log.created_at).toLocaleString()}
                                    </Text>
                                </View>

                                <View className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                                    <Text className="text-slate-400 text-xs mb-1">Target Resource</Text>
                                    <Text className="text-blue-400 font-mono text-xs">{log.target_resource}</Text>
                                </View>

                                {log.details && (
                                    <View className="mt-3">
                                        <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter mb-2">Payload Details</Text>
                                        <Text className="text-slate-400 text-xs italic">
                                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))
                    ) : (
                        <View className="items-center justify-center pt-20">
                            <Ionicons name="list" size={48} color="#1E293B" />
                            <Text className="text-slate-500 mt-4 text-center">No audit logs found in the system</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </View>
    );
}
