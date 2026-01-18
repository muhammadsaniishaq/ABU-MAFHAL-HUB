import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const nodes = Array.from({ length: 12 }).map((_, i) => ({
    id: `node-${i + 1}`,
    region: i < 4 ? 'us-east-1' : i < 8 ? 'eu-west-1' : 'af-south-1',
    status: Math.random() > 0.1 ? 'online' : 'maintenance',
    load: Math.floor(Math.random() * 80) + 10
}));

export default function InfrastructureGrid() {
    return (
        <View className="flex-1 bg-slate-950">
            <Stack.Screen options={{
                title: 'Cloud Grid',
                headerStyle: { backgroundColor: '#020617' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-white">Cluster Status</Text>
                    <View className="flex-row gap-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                            <Text className="text-slate-400 text-xs font-bold">98.9% Uptime</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="flash" size={12} color="#F59E0B" />
                            <Text className="text-slate-400 text-xs font-bold">42ms Latency</Text>
                        </View>
                    </View>
                </View>

                <View className="flex-row flex-wrap justify-between gap-y-4">
                    {nodes.map(node => (
                        <View key={node.id} className="w-[31%] aspect-square bg-slate-900 rounded-xl p-3 border border-slate-800 justify-between">
                            <View className="flex-row justify-between">
                                <Text className="text-slate-500 font-mono text-[10px]">{node.id}</Text>
                                <View className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                            </View>

                            <View>
                                <Text className="text-slate-400 text-[10px] font-bold mb-1">CPU Load</Text>
                                <View className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <View style={{ width: `${node.load}%` }} className={`h-full ${node.load > 70 ? 'bg-orange-500' : 'bg-blue-500'}`} />
                                </View>
                            </View>

                            <Text className="text-slate-600 text-[8px] font-mono">{node.region}</Text>
                        </View>
                    ))}
                </View>

                <View className="mt-8 bg-black p-4 rounded-xl border border-slate-800">
                    <Text className="text-green-500 font-mono text-xs mb-2">$ tail -f /var/log/syslog</Text>
                    <View className="gap-1 opacity-70">
                        <Text className="text-slate-500 font-mono text-[10px]">[INFO] Auto-scaling group trigger: +2 nodes</Text>
                        <Text className="text-slate-500 font-mono text-[10px]">[INFO] Database backup completed (2.4GB)</Text>
                        <Text className="text-slate-500 font-mono text-[10px]">[WARN] High latency detected in eu-west-1</Text>
                        <Text className="text-slate-500 font-mono text-[10px]">[INFO] Cache invalidated for key: users_list</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
