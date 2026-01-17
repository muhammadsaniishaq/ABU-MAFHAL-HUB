import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const staff = [
    { name: 'Admin User', role: 'Super Admin', status: 'Online', avatar: 'AD' },
    { name: 'Support Agent 1', role: 'Moderator', status: 'In Call', avatar: 'S1' },
    { name: 'Dev Lead', role: 'Developer', status: 'Offline', avatar: 'DL' },
    { name: 'Finance Mgr', role: 'Accountant', status: 'Online', avatar: 'FM' },
];

export default function StaffManager() {
    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Staff & HR' }} />

            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-black text-slate-800">Team Roster</Text>
                    <TouchableOpacity className="bg-slate-900 px-4 py-2 rounded-lg flex-row items-center gap-2">
                        <Ionicons name="person-add" size={16} color="white" />
                        <Text className="text-white font-bold text-xs">Invite Member</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="mb-8">
                    {staff.map((member, i) => (
                        <View key={i} className="flex-row items-center justify-between py-4 border-b border-gray-100">
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
                                    <Text className="font-bold text-slate-600">{member.avatar}</Text>
                                </View>
                                <View>
                                    <Text className="font-bold text-slate-800 text-base">{member.name}</Text>
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-slate-500 text-xs">{member.role}</Text>
                                        <View className={`px-1.5 py-0.5 rounded ${member.status === 'Online' ? 'bg-green-100' : member.status === 'Offline' ? 'bg-gray-100' : 'bg-orange-100'}`}>
                                            <Text className={`text-[10px] font-bold ${member.status === 'Online' ? 'text-green-600' : member.status === 'Offline' ? 'text-gray-500' : 'text-orange-600'}`}>{member.status}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity>
                                <Ionicons name="settings-outline" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Shift Schedule (Today)</Text>
                <View className="flex-row gap-4">
                    <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <Text className="text-blue-800 font-bold mb-1">Morning Shift</Text>
                        <Text className="text-blue-500 text-xs">08:00 - 16:00</Text>
                        <View className="flex-row mt-3">
                            <View className="w-6 h-6 rounded-full bg-blue-200 border-2 border-white" />
                            <View className="w-6 h-6 rounded-full bg-blue-300 border-2 border-white -ml-2" />
                        </View>
                    </View>
                    <View className="flex-1 bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <Text className="text-purple-800 font-bold mb-1">Evening Shift</Text>
                        <Text className="text-purple-500 text-xs">16:00 - 00:00</Text>
                        <View className="flex-row mt-3">
                            <View className="w-6 h-6 rounded-full bg-purple-200 border-2 border-white" />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
