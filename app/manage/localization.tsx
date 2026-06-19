import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const languages = [
    { code: 'en', name: 'English', progress: 100 },
    { code: 'ha', name: 'Hausa', progress: 85 },
    { code: 'fr', name: 'French', progress: 40 },
    { code: 'yo', name: 'Yoruba', progress: 10 },
];

const strings = [
    { key: 'welcome_message', en: 'Welcome back, User', ha: 'Barka da dawowa' },
    { key: 'balance_label', en: 'Your Balance', ha: 'Kudin ku' },
    { key: 'send_money_btn', en: 'Send Money', ha: 'Aika Kudi' },
    { key: 'settings_title', en: 'Settings', ha: 'Saituna' },
];

export default function LocalizationManager() {
    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Global Logic' }} />

            <View className="p-6">
                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Supported Languages</Text>
                <View className="flex-row gap-4 mb-8">
                    {languages.map(lang => (
                        <View key={lang.code} className="items-center">
                            <View className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 items-center justify-center mb-2 relative">
                                <Text className="font-bold text-slate-800 uppercase">{lang.code}</Text>
                                <View className="absolute bottom-0 w-full h-1 bg-gray-200 rounded-b-full overflow-hidden">
                                    <View style={{ width: `${lang.progress}%` }} className="h-full bg-indigo-500" />
                                </View>
                            </View>
                            <Text className="text-xs font-medium text-slate-500">{lang.name}</Text>
                        </View>
                    ))}
                    <TouchableOpacity className="items-center">
                        <View className="w-14 h-14 rounded-full bg-slate-900 items-center justify-center mb-2">
                            <Ionicons name="add" size={24} color="white" />
                        </View>
                        <Text className="text-xs font-medium text-slate-500">Add New</Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-xl font-black text-slate-800">Translation Grid</Text>
                    <View className="bg-gray-100 px-3 py-1 rounded-lg flex-row items-center gap-2">
                        <Ionicons name="search" size={14} color="#94A3B8" />
                        <Text className="text-slate-400 text-xs font-bold">Search Keys</Text>
                    </View>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {strings.map((str, i) => (
                        <View key={i} className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <Text className="text-slate-400 font-mono text-[10px] mb-2">{str.key}</Text>

                            <View className="flex-row gap-4 mb-2">
                                <View className="w-8 items-center justify-center bg-gray-200 rounded">
                                    <Text className="text-[10px] font-bold text-gray-500">EN</Text>
                                </View>
                                <Text className="font-medium text-slate-800">{str.en}</Text>
                            </View>

                            <View className="flex-row gap-4 items-center">
                                <View className="w-8 items-center justify-center bg-indigo-100 rounded">
                                    <Text className="text-[10px] font-bold text-indigo-500">HA</Text>
                                </View>
                                <TextInput
                                    value={str.ha}
                                    className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-slate-800 text-sm"
                                />
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}
