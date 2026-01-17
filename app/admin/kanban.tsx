import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

const initialTasks = [
    { id: '1', title: 'Fix API Latency', tag: 'Backend', col: 'todo' },
    { id: '2', title: 'Update Privacy Policy', tag: 'Legal', col: 'todo' },
    { id: '3', title: 'Design Winter Banner', tag: 'Design', col: 'progress' },
    { id: '4', title: 'Integrate Paystack', tag: 'Dev', col: 'done' },
    { id: '5', title: 'User Audit Q3', tag: 'Admin', col: 'progress' },
];

export default function KanbanBoard() {
    const [tasks, setTasks] = useState(initialTasks);

    const moveTask = (id: string) => {
        setTasks(prev => prev.map(t => {
            if (t.id !== id) return t;
            const nextCol = t.col === 'todo' ? 'progress' : t.col === 'progress' ? 'done' : 'todo';
            return { ...t, col: nextCol };
        }));
    };

    const TaskCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => moveTask(item.id)}
            className="bg-white p-3 rounded-xl mb-3 border border-slate-100 shadow-sm active:opacity-70"
        >
            <View className="flex-row justify-between items-start mb-2">
                <View className={`px-2 py-1 rounded-md ${item.tag === 'Backend' ? 'bg-red-100' :
                        item.tag === 'Design' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                    <Text className={`text-[8px] font-bold uppercase ${item.tag === 'Backend' ? 'text-red-700' :
                            item.tag === 'Design' ? 'text-purple-700' : 'text-blue-700'
                        }`}>{item.tag}</Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={14} color="#CBD5E1" />
            </View>
            <Text className="text-slate-700 font-bold text-xs">{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Project Board' }} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
                {/* TODO Column */}
                <View className="w-64 mr-4">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-slate-400" />
                            <Text className="font-black text-slate-700 uppercase text-xs">To Do</Text>
                        </View>
                        <View className="bg-slate-200 px-2 rounded-full">
                            <Text className="text-slate-500 font-bold text-[10px]">{tasks.filter(t => t.col === 'todo').length}</Text>
                        </View>
                    </View>
                    <View className="bg-slate-100/50 p-2 rounded-2xl flex-1 min-h-[500px]">
                        {tasks.filter(t => t.col === 'todo').map(t => <TaskCard key={t.id} item={t} />)}
                        <TouchableOpacity className="items-center py-3 border border-dashed border-slate-300 rounded-xl mt-1">
                            <Text className="text-slate-400 font-bold text-xs">+ Add Task</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* IN PROGRESS Column */}
                <View className="w-64 mr-4">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-orange-400" />
                            <Text className="font-black text-slate-700 uppercase text-xs">In Progress</Text>
                        </View>
                        <View className="bg-orange-100 px-2 rounded-full">
                            <Text className="text-orange-600 font-bold text-[10px]">{tasks.filter(t => t.col === 'progress').length}</Text>
                        </View>
                    </View>
                    <View className="bg-orange-50/50 p-2 rounded-2xl flex-1 min-h-[500px]">
                        {tasks.filter(t => t.col === 'progress').map(t => <TaskCard key={t.id} item={t} />)}
                    </View>
                </View>

                {/* DONE Column */}
                <View className="w-64">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-green-500" />
                            <Text className="font-black text-slate-700 uppercase text-xs">Completed</Text>
                        </View>
                        <View className="bg-green-100 px-2 rounded-full">
                            <Text className="text-green-600 font-bold text-[10px]">{tasks.filter(t => t.col === 'done').length}</Text>
                        </View>
                    </View>
                    <View className="bg-green-50/50 p-2 rounded-2xl flex-1 min-h-[500px]">
                        {tasks.filter(t => t.col === 'done').map(t => <TaskCard key={t.id} item={t} />)}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
