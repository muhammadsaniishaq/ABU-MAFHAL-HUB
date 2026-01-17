import { View, Text, TouchableOpacity, ScrollView, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

export default function TeamChat() {
    return (
        <View className="flex-1 bg-white flex-row">
            <Stack.Screen options={{ title: 'Team Comms' }} />

            {/* Sidebar Channels */}
            <View className="w-1/4 bg-slate-50 border-r border-gray-100 pt-4">
                <View className="mb-6 px-4">
                    <Text className="font-black text-slate-800 text-lg">Nexus</Text>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase">Online: 4</Text>
                </View>

                <View className="gap-1">
                    {['# general', '# alerts', '# engineering', '# sales', '# random'].map((c, i) => (
                        <TouchableOpacity key={c} className={`px-4 py-2 ${i === 0 ? 'bg-white border-l-4 border-blue-500 shadow-sm' : ''}`}>
                            <Text className={`font-bold text-xs ${i === 0 ? 'text-slate-800' : 'text-slate-400'}`}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="mt-auto p-4 border-t border-gray-100">
                    <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 rounded-full bg-green-500" />
                        <Text className="text-slate-600 text-xs font-bold">You (Admin)</Text>
                    </View>
                </View>
            </View>

            {/* Chat Area */}
            <View className="flex-1 bg-white flex-col">
                <View className="h-12 border-b border-gray-100 flex-row items-center justify-between px-4">
                    <Text className="font-bold text-slate-800"># general</Text>
                    <Ionicons name="information-circle" size={20} color="#94A3B8" />
                </View>

                <ScrollView className="flex-1 p-4">
                    {/* Mock Messages */}
                    <View className="flex-row gap-3 mb-4">
                        <View className="w-8 h-8 rounded bg-orange-100 items-center justify-center">
                            <Text className="text-orange-600 font-bold text-xs">JD</Text>
                        </View>
                        <View>
                            <View className="flex-row items-baseline gap-2">
                                <Text className="font-bold text-slate-800 text-xs">John Doe</Text>
                                <Text className="text-gray-300 text-[10px]">10:42 AM</Text>
                            </View>
                            <Text className="text-slate-600 text-sm">Deployment to production is complete. Check the logs.</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-3 mb-4">
                        <View className="w-8 h-8 rounded bg-blue-100 items-center justify-center">
                            <Text className="text-blue-600 font-bold text-xs">AD</Text>
                        </View>
                        <View>
                            <View className="flex-row items-baseline gap-2">
                                <Text className="font-bold text-slate-800 text-xs">Admin (You)</Text>
                                <Text className="text-gray-300 text-[10px]">10:45 AM</Text>
                            </View>
                            <Text className="text-slate-600 text-sm">Great work! I'm noticing a spike in traffic on the dashboard.</Text>
                        </View>
                    </View>
                </ScrollView>

                <View className="p-4 border-t border-gray-100">
                    <View className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 flex-row items-center">
                        <TextInput
                            placeholder="Message #general"
                            className="flex-1 font-medium text-slate-700"
                        />
                        <Ionicons name="send" size={16} color="#94A3B8" />
                    </View>
                </View>
            </View>
        </View>
    );
}
