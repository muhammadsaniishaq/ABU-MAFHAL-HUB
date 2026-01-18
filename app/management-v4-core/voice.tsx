import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

export default function VoiceOS() {
    const [listening, setListening] = useState(false);

    return (
        <View className="flex-1 bg-black items-center justify-center relative">
            <Stack.Screen options={{
                title: 'Voice OS',
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff'
            }} />

            {/* Ambient Glow */}
            <View className={`absolute w-[300px] h-[300px] rounded-full bg-indigo-600 blur-[100px] opacity-30 ${listening ? 'scale-125' : 'scale-100'}`} />

            <View className="items-center z-10">
                <Text className="text-white font-black text-3xl mb-2">Good Morning, Admin.</Text>
                <Text className="text-slate-400 font-medium mb-12">I'm listening...</Text>

                <TouchableOpacity
                    onPress={() => setListening(!listening)}
                    className={`w-24 h-24 rounded-full items-center justify-center border-4 ${listening ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_50px_#4f46e5]' : 'bg-slate-900 border-slate-800'}`}
                >
                    <Ionicons name="mic" size={40} color="white" />
                </TouchableOpacity>

                {listening && (
                    <View className="mt-12 flex-row gap-1 h-8 items-end">
                        <View className="w-1 bg-white h-4 rounded-full animate-bounce" />
                        <View className="w-1 bg-white h-8 rounded-full animate-bounce" />
                        <View className="w-1 bg-white h-6 rounded-full animate-bounce" />
                        <View className="w-1 bg-white h-3 rounded-full animate-bounce" />
                    </View>
                )}

                <View className="mt-16 bg-slate-900/50 p-6 rounded-2xl border border-white/10 w-[90%]">
                    <Text className="text-slate-500 font-bold uppercase text-[10px] mb-4">Try saying...</Text>
                    <View className="gap-3">
                        <View className="flex-row items-center gap-3">
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#94A3B8" />
                            <Text className="text-white text-sm font-medium">"Show me today's revenue"</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#94A3B8" />
                            <Text className="text-white text-sm font-medium">"Freeze User ID 4410"</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#94A3B8" />
                            <Text className="text-white text-sm font-medium">"Open the Panic Room"</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
