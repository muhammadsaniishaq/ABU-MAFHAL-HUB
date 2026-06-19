import { View, Text, ImageBackground, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Mock Map Pings
const pings = [
    { x: 120, y: 200, label: 'Lagos' },
    { x: 160, y: 150, label: 'Kano' },
    { x: 140, y: 280, label: 'Abuja' },
    { x: 200, y: 350, label: 'PH' },
];

export default function GeoMap() {
    return (
        <View className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Live Activity Map',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            {/* World Map Placeholder (Using a dark gradient for abstract feel) */}
            <LinearGradient colors={['#0F172A', '#1E293B', '#020617']} className="absolute inset-0 z-0">
                {/* Grid Lines for style */}
                <View className="absolute inset-0 opacity-10">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <View key={`h-${i}`} style={{ top: i * 80, height: 1, width: '100%', backgroundColor: '#38BDF8' }} className="absolute" />
                    ))}
                    {Array.from({ length: 6 }).map((_, i) => (
                        <View key={`v-${i}`} style={{ left: i * 80, width: 1, height: '100%', backgroundColor: '#38BDF8' }} className="absolute" />
                    ))}
                </View>
            </LinearGradient>

            <View className="flex-1 items-center justify-center relative">
                {/* Nigeria Shape Mock with Pings */}
                <View className="w-[300px] h-[400px] border-2 border-slate-700 rounded-[50px] relative bg-slate-800/30 backdrop-blur-sm">
                    {pings.map((p, i) => (
                        <View key={i} className="absolute items-center" style={{ top: p.y, left: p.x }}>
                            <View className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_15px_#22D3EE] z-10" />
                            <View className="w-8 h-8 bg-cyan-500/20 rounded-full animate-ping absolute" />
                            <Text className="text-cyan-200 text-[10px] font-bold mt-1 bg-black/40 px-1 rounded">{p.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View className="absolute bottom-10 left-6 right-6 p-4 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700">
                <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Real-time Feed</Text>
                <View className="gap-2">
                    <View className="flex-row justify-between">
                        <Text className="text-white text-xs">New user registration in <Text className="text-cyan-400 font-bold">Kano</Text></Text>
                        <Text className="text-slate-500 text-[10px]">2s ago</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-white text-xs">₦50,000 transfer in <Text className="text-cyan-400 font-bold">Lagos</Text></Text>
                        <Text className="text-slate-500 text-[10px]">5s ago</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
