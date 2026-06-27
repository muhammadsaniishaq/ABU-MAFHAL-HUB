import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SERVICES = [
    { id: 'nin', title: 'Verify by NIN', desc: 'Find details using 11-digit NIN', icon: 'finger-print', color: 'bg-emerald-100', iconColor: '#059669', route: '/nin-services/verify-nin' },
    { id: 'phone', title: 'Verify by Phone', desc: 'Find NIN via linked phone', icon: 'call', color: 'bg-blue-100', iconColor: '#2563EB', route: '/nin-services/verify-phone' },
    { id: 'demo', title: 'Demographic', desc: 'Find NIN using name & DOB', icon: 'people', color: 'bg-purple-100', iconColor: '#9333EA', route: '/nin-services/demographic' },
    { id: 'val', title: 'General Validation', desc: 'Validate NIN details', icon: 'checkmark-circle', color: 'bg-cyan-100', iconColor: '#0891B2', route: '/nin-services/validation' },
    { id: 'ipe', title: 'IPE Clearance', desc: 'Pre-Employment Clearance', icon: 'briefcase', color: 'bg-indigo-100', iconColor: '#4F46E5', route: '/nin-services/ipe-clearance' },
    { id: 'track', title: 'Card Tracking', desc: 'Check Personalization status', icon: 'card', color: 'bg-orange-100', iconColor: '#EA580C', route: '/nin-services/tracking' },
    { id: 'delink', title: 'Delink Phone', desc: 'Remove phone from NIN', icon: 'cut', color: 'bg-red-100', iconColor: '#DC2626', route: '/nin-services/delink' },
];

export default function NINServicesScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            <LinearGradient 
                colors={['#050B14', '#0B163A']} 
                style={{ paddingTop: insets.top + 10, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 10 }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Decorative Elements */}
                <View className="absolute -top-10 -right-8 w-32 h-32 bg-[#f5a623] rounded-full opacity-[0.05]" />
                <View className="absolute top-10 -left-8 w-24 h-24 bg-[#4F46E5] rounded-full opacity-[0.06]" />
                
                <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="bg-white/10 w-9 h-9 rounded-full items-center justify-center border border-white/10">
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View className="bg-white/10 px-2 py-1 rounded-full border border-white/10 flex-row items-center">
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                        <Text className="text-white text-[10px] font-bold tracking-wider">SECURE</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-1">
                    <Ionicons name="shield-checkmark" size={20} color="#f5a623" className="mr-2" />
                    <Text className="text-white text-2xl font-black tracking-tight">NIN Services</Text>
                </View>
                <Text className="text-slate-300 text-xs font-medium opacity-90 mt-0.5">National Identity Management Gateway</Text>
            </LinearGradient>

            <ScrollView className="flex-1 px-4 -mt-4" contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}>
                <View className="flex-row flex-wrap justify-between">
                    {SERVICES.map((service, index) => (
                        <TouchableOpacity 
                            key={service.id}
                            onPress={() => router.push(service.route as any)}
                            className="bg-white w-[48%] rounded-2xl p-4 mb-3 shadow-sm border border-slate-100 items-start"
                        >
                            <View className={`w-10 h-10 rounded-xl ${service.color} items-center justify-center mb-3`}>
                                <Ionicons name={service.icon as any} size={20} color={service.iconColor} />
                            </View>
                            <Text className="text-slate-800 font-extrabold text-xs mb-1">{service.title}</Text>
                            <Text className="text-slate-500 text-[10px] leading-3">{service.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
