import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function AuditCinema() {
    return (
        <View className="flex-1 bg-black">
            <Stack.Screen options={{
                title: 'Session Replay',
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff'
            }} />

            {/* Video Player Mock */}
            <View className="h-[400px] bg-slate-900 justify-center items-center relative border-b border-slate-800">
                <Text className="text-slate-600 font-bold uppercase tracking-widest mb-4">Replay: User #8821</Text>

                {/* Mock Screen Content */}
                <View className="w-[200px] h-[350px] bg-white rounded-2xl overflow-hidden opacity-80 border-4 border-slate-700">
                    <View className="bg-indigo-600 h-12 w-full" />
                    <View className="p-4 gap-2">
                        <View className="h-20 bg-gray-100 rounded-lg" />
                        <View className="h-8 bg-gray-100 rounded-lg w-1/2" />

                        {/* Cursor tracking mock */}
                        <View className="absolute top-24 left-12 w-6 h-6 rounded-full bg-orange-500/50 border-2 border-orange-500 z-10" />
                    </View>
                </View>

                {/* Controls */}
                <View className="absolute bottom-6 flex-row gap-8 items-center bg-black/50 px-6 py-3 rounded-full backdrop-blur-md">
                    <Ionicons name="play-skip-back" size={24} color="white" />
                    <Ionicons name="play-circle" size={48} color="white" />
                    <Ionicons name="play-skip-forward" size={24} color="white" />
                </View>
            </View>

            {/* Timeline Events */}
            <View className="flex-1 bg-slate-950 p-6">
                <Text className="text-slate-500 font-bold uppercase text-[10px] mb-4">Session Timeline</Text>
                <ScrollView>
                    {[
                        { time: '00:02', action: 'App Launch', icon: 'power', color: '#10B981' },
                        { time: '00:15', action: 'Navigate: Wallet', icon: 'wallet', color: '#3B82F6' },
                        { time: '00:42', action: 'Click: "Withdraw" Button', icon: 'finger-print', color: '#F59E0B' },
                        { time: '00:45', action: 'Error: "Insufficient Funds"', icon: 'alert-circle', color: '#EF4444' },
                        { time: '01:10', action: 'App Backgrounded', icon: 'eye-off', color: '#64748B' },
                    ].map((event, i) => (
                        <View key={i} className="flex-row items-center mb-6">
                            <Text className="text-slate-500 font-mono text-xs w-12">{event.time}</Text>
                            <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-slate-900 border border-slate-800">
                                <Ionicons name={event.icon as any} size={14} color={event.color} />
                            </View>
                            <Text className="text-slate-300 font-bold text-sm">{event.action}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}
