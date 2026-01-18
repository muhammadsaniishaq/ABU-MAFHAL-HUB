import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

const endpoints = [
    { method: 'GET', path: '/api/v1/users', desc: 'List all users' },
    { method: 'POST', path: '/api/v1/users', desc: 'Create user' },
    { method: 'GET', path: '/api/v1/transactions', desc: 'Get tx history' },
    { method: 'POST', path: '/api/v1/payouts', desc: 'Initiate payout' },
    { method: 'GET', path: '/api/v1/stats', desc: 'System stats' },
];

export default function APISandbox() {
    const [selectedEp, setSelectedEp] = useState(endpoints[0]);
    const [response, setResponse] = useState<string | null>(null);

    const handleTest = () => {
        setResponse(JSON.stringify({
            status: "success",
            data: {
                count: 1240,
                results: [
                    { id: 1, name: "User A", balance: 5000 },
                    { id: 2, name: "User B", balance: 1200 }
                ]
            },
            timestamp: new Date().toISOString()
        }, null, 2));
    };

    return (
        <View className="flex-1 bg-slate-900 flex-row">
            <Stack.Screen options={{
                title: 'API Sandbox',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            {/* Endpoint List */}
            <View className="w-1/3 bg-slate-900 border-r border-slate-800 pt-4">
                <Text className="text-slate-500 font-bold uppercase text-[10px] mb-4 px-4">Available Routes</Text>
                <ScrollView>
                    {endpoints.map((ep, i) => (
                        <TouchableOpacity
                            key={i}
                            onPress={() => { setSelectedEp(ep); setResponse(null); }}
                            className={`px-4 py-3 border-b border-slate-800 ${selectedEp === ep ? 'bg-slate-800' : ''}`}
                        >
                            <View className="flex-row items-center gap-2 mb-1">
                                <View className={`px-1.5 py-0.5 rounded ${ep.method === 'GET' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                                    <Text className={`text-[10px] font-bold ${ep.method === 'GET' ? 'text-blue-400' : 'text-green-400'}`}>{ep.method}</Text>
                                </View>
                                <Text className="text-slate-300 font-mono text-xs">{ep.path}</Text>
                            </View>
                            <Text className="text-slate-500 text-[10px]">{ep.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Test Area */}
            <View className="flex-1 bg-slate-950 p-6">
                <View className="flex-row items-center gap-3 mb-6">
                    <View className={`px-3 py-1.5 rounded-lg ${selectedEp.method === 'GET' ? 'bg-blue-600' : 'bg-green-600'}`}>
                        <Text className="text-white font-bold">{selectedEp.method}</Text>
                    </View>
                    <Text className="text-white font-mono text-lg flex-1">https://api.abumafhal.com{selectedEp.path}</Text>
                    <TouchableOpacity
                        onPress={handleTest}
                        className="bg-indigo-600 px-6 py-2 rounded-lg flex-row items-center gap-2"
                    >
                        <Ionicons name="play" size={16} color="white" />
                        <Text className="text-white font-bold">Send Request</Text>
                    </TouchableOpacity>
                </View>

                {/* Headers / Body Tabs Placeholder */}
                <View className="flex-row gap-6 mb-4 border-b border-slate-800 pb-2">
                    <Text className="text-indigo-400 font-bold border-b-2 border-indigo-500 pb-2">Response</Text>
                    <Text className="text-slate-500 font-bold pb-2">Headers</Text>
                    <Text className="text-slate-500 font-bold pb-2">Body</Text>
                </View>

                <View className="bg-slate-900 flex-1 rounded-xl p-4 border border-slate-800">
                    {response ? (
                        <Text className="text-emerald-400 font-mono text-xs leading-5">{response}</Text>
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <Text className="text-slate-600 text-xs">Hit "Send Request" to see API output.</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
