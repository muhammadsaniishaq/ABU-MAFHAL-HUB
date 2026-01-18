import { View, Text, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

export default function PanicRoom() {
    const [armed, setArmed] = useState(false);

    const handlePanic = (action: string) => {
        if (!armed) {
            Alert.alert("System Locked", "You must ARM the system before executing emergency protocols.");
            return;
        }
        Alert.alert("CONFIRM PROTOCOL", `Are you sure you want to ${action}? This action is irreversible without root access.`, [
            { text: "Cancel", style: "cancel" },
            { text: "EXECUTE", style: "destructive" }
        ]);
    };

    return (
        <View className="flex-1 bg-red-950">
            <Stack.Screen options={{
                title: 'PANIC ROOM',
                headerStyle: { backgroundColor: '#450a0a' },
                headerTintColor: '#fff'
            }} />

            <View className="p-8 items-center">
                <View className="mb-12 items-center">
                    <Ionicons name="warning" size={64} color="#ef4444" />
                    <Text className="text-red-500 font-black text-3xl mt-4 uppercase tracking-widest text-center">Emergency Controls</Text>
                    <Text className="text-red-200/50 text-center text-xs mt-2 px-8">Authorized Personnel Only. All actions are logged and reported to the Board of Directors.</Text>
                </View>

                {/* Arm Switch */}
                <View className="bg-red-900/40 w-full p-4 rounded-xl border border-red-800 flex-row items-center justify-between mb-12">
                    <Text className="text-red-200 font-bold uppercase tracking-widest">Arm System</Text>
                    <Switch
                        value={armed}
                        onValueChange={setArmed}
                        trackColor={{ false: '#7f1d1d', true: '#ef4444' }}
                        thumbColor="white"
                    />
                </View>

                {/* Buttons */}
                <View className="w-full gap-6">
                    <TouchableOpacity
                        onPress={() => handlePanic("FREEZE ALL ASSETS")}
                        className={`w-full py-6 rounded-2xl items-center border-b-8 active:border-b-0 active:translate-y-2 ${armed ? 'bg-red-600 border-red-800' : 'bg-slate-700 border-slate-800 opacity-50'}`}
                    >
                        <Ionicons name="snow" size={32} color="white" className="mb-2" />
                        <Text className="text-white font-black text-xl uppercase">Freeze All Assets</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handlePanic("SEVER API CONNECTIONS")}
                        className={`w-full py-6 rounded-2xl items-center border-b-8 active:border-b-0 active:translate-y-2 ${armed ? 'bg-orange-600 border-orange-800' : 'bg-slate-700 border-slate-800 opacity-50'}`}
                    >
                        <Ionicons name="cut" size={32} color="white" className="mb-2" />
                        <Text className="text-white font-black text-xl uppercase">Sever API Links</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handlePanic("ENTER MAINTENANCE MODE")}
                        className={`w-full py-6 rounded-2xl items-center border-b-8 active:border-b-0 active:translate-y-2 ${armed ? 'bg-slate-800 border-slate-900' : 'bg-slate-700 border-slate-800 opacity-50'}`}
                    >
                        <Ionicons name="construct" size={32} color="white" className="mb-2" />
                        <Text className="text-white font-black text-xl uppercase">Maintenance Mode</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
