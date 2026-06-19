import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

export default function AppDesigner() {
    const [primaryColor, setPrimaryColor] = useState('#4F46E5');
    const [darkMode, setDarkMode] = useState(false);

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Theme Engine' }} />

            <View className="flex-1 flex-row">
                {/* Editor Sidebar */}
                <View className="w-1/3 bg-white border-r border-gray-100 p-4">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Color Palette</Text>
                    <View className="flex-row flex-wrap gap-3 mb-8">
                        {['#4F46E5', '#EF4444', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'].map(c => (
                            <TouchableOpacity
                                key={c}
                                onPress={() => setPrimaryColor(c)}
                                className={`w-8 h-8 rounded-full ${primaryColor === c ? 'border-2 border-slate-800' : ''}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </View>

                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Mode</Text>
                    <View className="bg-gray-100 p-1 rounded-lg flex-row mb-8">
                        <TouchableOpacity
                            onPress={() => setDarkMode(false)}
                            className={`flex-1 py-2 items-center rounded ${!darkMode ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Ionicons name="sunny" size={16} color={!darkMode ? '#F59E0B' : '#94A3B8'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setDarkMode(true)}
                            className={`flex-1 py-2 items-center rounded ${darkMode ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Ionicons name="moon" size={16} color={darkMode ? '#4F46E5' : '#94A3B8'} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity className="bg-slate-900 py-3 rounded-xl items-center mt-auto">
                        <Text className="text-white font-bold text-xs">Publish Changes</Text>
                    </TouchableOpacity>
                </View>

                {/* Live Preview */}
                <View className="flex-1 items-center justify-center bg-gray-200 p-8">
                    {/* Phone Mockup */}
                    <View className={`w-[200px] h-[400px] rounded-[30px] border-4 border-slate-800 overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        {/* Mock App Header */}
                        <View style={{ backgroundColor: primaryColor }} className="h-16 w-full items-center justify-end pb-2">
                            <Text className="text-white font-bold text-xs">Abu Mafhal Hub</Text>
                        </View>
                        {/* Mock Content */}
                        <View className="p-4 gap-2">
                            <View className={`h-24 w-full rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`} />
                            <View className="flex-row gap-2">
                                <View className={`h-24 flex-1 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`} />
                                <View className={`h-24 flex-1 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`} />
                            </View>
                            <View style={{ backgroundColor: primaryColor }} className="h-10 w-full rounded-lg items-center justify-center mt-4">
                                <Text className="text-white font-bold text-[10px]">Primary Button</Text>
                            </View>
                        </View>
                    </View>
                    <Text className="text-slate-400 font-bold text-xs mt-4">Live Preview</Text>
                </View>
            </View>
        </View>
    );
}
