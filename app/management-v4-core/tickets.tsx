import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

// Mock Ticket Data
const initialTickets = Array.from({ length: 8 }).map((_, i) => ({
    id: `TKT-${4500 + i}`,
    user: ['Aminu Kano', 'Fatima Zahra', 'John Doe', 'Sarah Smith'][i % 4],
    subject: ['Transaction Failed', 'Account Locked', 'KYC Issue', 'Feature Request'][i % 4],
    status: i % 3 === 0 ? 'Open' : i % 3 === 1 ? 'In Progress' : 'Resolved',
    lastMessage: 'I have been waiting for 2 hours now...',
    time: `${i * 15 + 5}m ago`,
    unread: i % 2 === 0
}));

export default function SupportTickets() {
    const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
    const [tickets, setTickets] = useState(initialTickets);

    const renderTicketList = () => (
        <View className="flex-1 bg-slate-50">
            <View className="p-4 bg-white border-b border-gray-100">
                <View className="flex-row gap-3 overflow-scroll">
                    {['All', 'Open', 'In Progress', 'Resolved'].map((filter, i) => (
                        <TouchableOpacity key={filter} className={`px-4 py-2 rounded-full border ${i === 0 ? 'bg-slate-900 border-slate-900' : 'bg-white border-gray-200'}`}>
                            <Text className={`font-bold text-xs ${i === 0 ? 'text-white' : 'text-slate-600'}`}>{filter}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <FlatList
                data={tickets}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => setSelectedTicket(item.id)}
                        className={`bg-white p-4 rounded-2xl mb-3 border shadow-sm ${item.unread ? 'border-blue-200' : 'border-gray-100'}`}
                    >
                        <View className="flex-row justify-between mb-2">
                            <View className="flex-row items-center gap-2">
                                {item.unread && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                                <Text className="font-bold text-slate-800 text-base">{item.user}</Text>
                            </View>
                            <Text className="text-xs text-gray-400">{item.time}</Text>
                        </View>
                        <Text className="text-slate-600 font-bold text-sm mb-1">{item.subject}</Text>
                        <Text className="text-gray-400 text-xs mb-3" numberOfLines={1}>{item.lastMessage}</Text>

                        <View className="flex-row items-center justify-between">
                            <View className={`px-2 py-1 rounded text-[10px] ${item.status === 'Open' ? 'bg-red-100' :
                                    item.status === 'In Progress' ? 'bg-blue-100' : 'bg-green-100'
                                }`}>
                                <Text className={`text-[10px] font-bold ${item.status === 'Open' ? 'text-red-700' :
                                        item.status === 'In Progress' ? 'text-blue-700' : 'text-green-700'
                                    }`}>{item.status.toUpperCase()}</Text>
                            </View>
                            <Text className="text-[10px] text-gray-300 font-mono">{item.id}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );

    const renderChatInterface = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-50">
            <View className="bg-white p-4 border-b border-gray-100 flex-row items-center justify-between shadow-sm z-10">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => setSelectedTicket(null)} className="mr-3">
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View>
                        <Text className="font-bold text-slate-800 text-lg">Support Chat</Text>
                        <Text className="text-xs text-gray-400 font-mono">{selectedTicket}</Text>
                    </View>
                </View>
                <TouchableOpacity className="bg-green-500 px-3 py-1.5 rounded-lg">
                    <Text className="text-white text-xs font-bold">Mark Resolved</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Mock Chat Bubbles */}
                <View className="items-start mb-4 w-[80%]">
                    <View className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                        <Text className="text-slate-700 mb-1">Hello, I cannot access my account after the password reset.</Text>
                        <Text className="text-[10px] text-gray-300">10:30 AM</Text>
                    </View>
                </View>

                <View className="items-end mb-4 w-full">
                    <View className="bg-blue-600 p-3 rounded-2xl rounded-tr-none shadow-sm w-[80%]">
                        <Text className="text-white mb-1">Hi there! I can help with that. Could you verify your email address?</Text>
                        <Text className="text-[10px] text-blue-200">10:32 AM • Admin</Text>
                    </View>
                </View>

                <View className="items-center my-4">
                    <Text className="text-xs text-gray-300 font-bold uppercase">Today</Text>
                </View>

                <View className="items-start mb-4 w-[80%]">
                    <View className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                        <Text className="text-slate-700 mb-1">Sure, it's user@example.com. I'm getting error 403.</Text>
                        <Text className="text-[10px] text-gray-300">10:35 AM</Text>
                    </View>
                </View>
            </ScrollView>

            <View className="p-4 bg-white border-t border-gray-100">
                <View className="flex-row items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
                    <TouchableOpacity className="mr-2">
                        <Ionicons name="attach" size={24} color="#94A3B8" />
                    </TouchableOpacity>
                    <TextInput
                        placeholder="Type your reply..."
                        placeholderTextColor="#94A3B8"
                        className="flex-1 h-10 font-medium text-slate-800"
                    />
                    <TouchableOpacity className="bg-slate-900 w-8 h-8 rounded-full items-center justify-center ml-2">
                        <Ionicons name="send" size={16} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            {selectedTicket ? renderChatInterface() : (
                <>
                    <Stack.Screen options={{ title: 'Help Desk', headerShown: true }} />
                    {renderTicketList()}
                </>
            )}
        </View>
    );
}
