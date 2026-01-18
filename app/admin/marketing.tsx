import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

export default function MarketingStudio() {
    const [campaignType, setCampaignType] = useState<'email' | 'push'>('push');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Marketing Studio' }} />

            <View className="flex-1 flex-row">
                {/* Campaign Builder */}
                <View className="flex-1 p-6 border-r border-gray-100">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Select Channel</Text>
                    <View className="flex-row gap-4 mb-8">
                        <TouchableOpacity
                            onPress={() => setCampaignType('push')}
                            className={`flex-1 p-4 rounded-xl border-2 flex-row items-center justify-center gap-2 ${campaignType === 'push' ? 'border-pink-500 bg-pink-50' : 'border-gray-100 bg-white'}`}
                        >
                            <Ionicons name="notifications" size={20} color={campaignType === 'push' ? '#EC4899' : '#94A3B8'} />
                            <Text className={`font-bold ${campaignType === 'push' ? 'text-pink-600' : 'text-slate-500'}`}>Push Notification</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setCampaignType('email')}
                            className={`flex-1 p-4 rounded-xl border-2 flex-row items-center justify-center gap-2 ${campaignType === 'email' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'}`}
                        >
                            <Ionicons name="mail" size={20} color={campaignType === 'email' ? '#3B82F6' : '#94A3B8'} />
                            <Text className={`font-bold ${campaignType === 'email' ? 'text-blue-600' : 'text-slate-500'}`}>Email Blast</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-2">Campaign Details</Text>
                    <TextInput
                        placeholder="Campaign Title"
                        value={title}
                        onChangeText={setTitle}
                        className="bg-white border border-gray-200 rounded-xl p-4 mb-4 font-bold text-slate-800"
                    />
                    <TextInput
                        placeholder="Message Content..."
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        textAlignVertical="top"
                        className="bg-white border border-gray-200 rounded-xl p-4 mb-6 font-medium text-slate-600 h-40"
                    />

                    <View className="bg-slate-100 p-4 rounded-xl mb-6">
                        <View className="flex-row justify-between mb-2">
                            <Text className="font-bold text-slate-600">Target Audience</Text>
                            <Text className="font-bold text-indigo-600">All Users (12.5k)</Text>
                        </View>
                        <View className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <View className="h-full w-full bg-indigo-500" />
                        </View>
                    </View>

                    <TouchableOpacity className="bg-slate-900 py-4 rounded-xl items-center flex-row justify-center gap-2 shadow-lg shadow-slate-900/20">
                        <Ionicons name="paper-plane" size={20} color="white" />
                        <Text className="text-white font-bold text-lg">Launch Campaign</Text>
                    </TouchableOpacity>
                </View>

                {/* Device Preview */}
                <View className="w-[350px] bg-gray-100 items-center justify-center p-8">
                    <View className="w-[280px] h-[580px] bg-black rounded-[40px] border-[8px] border-slate-900 overflow-hidden relative shadow-2xl">
                        {/* Dynamic Island */}
                        <View className="absolute top-2 self-center w-24 h-7 bg-black rounded-full z-50" />

                        {/* Content */}
                        <View className="flex-1 bg-white pt-12 px-4">
                            {/* Fake App Header */}
                            <View className="flex-row justify-between items-center mb-6">
                                <Ionicons name="menu" size={24} />
                                <Text className="font-black text-lg">HOME</Text>
                                <Ionicons name="person-circle" size={24} />
                            </View>

                            {/* The Notification Preview */}
                            {campaignType === 'push' && (
                                <View className="absolute top-2 mx-2 bg-gray-200/90 backdrop-blur-md p-3 rounded-2xl w-[94%] self-center shadow-lg z-40 flex-row gap-3">
                                    <View className="w-10 h-10 bg-indigo-600 rounded-xl items-center justify-center">
                                        <Ionicons name="cube" size={20} color="white" />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row justify-between">
                                            <Text className="font-bold text-xs text-slate-900">Abu Mafhal Hub</Text>
                                            <Text className="text-[10px] text-slate-500">now</Text>
                                        </View>
                                        <Text className="font-bold text-sm text-slate-800 leading-tight">{title || 'Campaign Title'}</Text>
                                        <Text className="text-xs text-slate-600 leading-tight">{message || 'Your message will appear here...'}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text className="text-slate-400 font-bold text-xs mt-6 uppercase tracking-widest">Live Preview</Text>
                </View>
            </View>
        </View>
    );
}
