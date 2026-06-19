import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

const courses = [
    { title: 'AML Compliance Basics', duration: '45m', status: 'Completed', color: '#10B981' },
    { title: 'Customer Support Protocol', duration: '1h 20m', status: 'In Progress', color: '#F59E0B' },
    { title: 'Security Best Practices', duration: '30m', status: 'Locked', color: '#64748B' },
];

export default function AdminAcademy() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Admin Academy' }} />

            <View className="p-6">
                <View className="bg-indigo-600 p-6 rounded-3xl mb-8 shadow-lg shadow-indigo-200">
                    <View className="flex-row justify-between items-start">
                        <View>
                            <Text className="text-indigo-200 font-bold text-xs uppercase mb-1">Your Progress</Text>
                            <Text className="text-white font-black text-3xl">Level 4 Admin</Text>
                        </View>
                        <Ionicons name="school" size={40} color="white" style={{ opacity: 0.2 }} />
                    </View>
                    <View className="h-2 w-full bg-indigo-900/30 rounded-full mt-6 mb-2">
                        <View className="h-full w-[70%] bg-white rounded-full" />
                    </View>
                    <Text className="text-indigo-100 text-xs font-medium">350 / 500 XP to next level</Text>
                </View>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Mandatory Training</Text>

                {courses.map((course, i) => (
                    <TouchableOpacity key={i} className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 flex-row items-center">
                        <View className="w-12 h-12 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: course.color + '20' }}>
                            <Ionicons name={course.status === 'Locked' ? 'lock-closed' : 'play'} size={20} color={course.color} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-slate-800 text-sm">{course.title}</Text>
                            <Text className="text-slate-400 text-xs">{course.duration} • {course.status}</Text>
                        </View>
                        {course.status === 'Completed' && (
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        )}
                    </TouchableOpacity>
                ))}

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4 mt-4">Certifications</Text>
                <View className="flex-row gap-4">
                    <View className="w-24 h-32 bg-white rounded-xl border border-gray-200 items-center justify-center relative overflow-hidden">
                        <View className="absolute top-0 w-full h-2 bg-yellow-400" />
                        <Ionicons name="ribbon" size={40} color="#F59E0B" className="mb-2" />
                        <Text className="font-bold text-slate-700 text-[10px] text-center px-1">Certified Handler</Text>
                    </View>
                    <View className="w-24 h-32 bg-gray-100 rounded-xl border border-dashed border-gray-300 items-center justify-center">
                        <Ionicons name="lock-closed" size={24} color="#94A3B8" />
                    </View>
                </View>
            </View>
        </View>
    );
}
