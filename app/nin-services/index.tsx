import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const SERVICES = [
    { id: 'nin', title: 'Verify by NIN', desc: 'Find details using 11-digit NIN', icon: 'finger-print', color: 'bg-emerald-100', iconColor: '#059669', route: '/nin-services/verify-nin' },
    { id: 'phone', title: 'Verify by Phone', desc: 'Find NIN via linked phone', icon: 'call', color: 'bg-blue-100', iconColor: '#2563EB', route: '/nin-services/verify-phone' },
    { id: 'demo', title: 'Demographic', desc: 'Find NIN using name & DOB', icon: 'people', color: 'bg-purple-100', iconColor: '#9333EA', route: '/nin-services/demographic' },
    { id: 'val', title: 'General Validation', desc: 'Validate NIN details', icon: 'checkmark-circle', color: 'bg-cyan-100', iconColor: '#0891B2', route: '/nin-services/validation' },
    { id: 'ipe', title: 'IPE Clearance', desc: 'Pre-Employment Clearance', icon: 'briefcase', color: 'bg-indigo-100', iconColor: '#4F46E5', route: '/nin-services/ipe-clearance' },
    { id: 'track', title: 'Card Tracking', desc: 'Check Personalization status', icon: 'card', color: 'bg-orange-100', iconColor: '#EA580C', route: '/nin-services/tracking' },
    { id: 'delink', title: 'Delink Phone', desc: 'Remove phone from NIN', icon: 'cut', color: 'bg-red-100', iconColor: '#DC2626', route: '/nin-services/delink' },
];

export default function NINServicesDashboard() {
    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen
                options={{
                    title: 'NIN Services',
                    headerStyle: { backgroundColor: '#064e3b' },
                    headerTintColor: '#C5A059',
                    headerTitleStyle: { fontWeight: 'black', fontSize: 18 },
                    headerShadowVisible: false
                }}
            />
            <StatusBar style="light" />
            
            <View className="bg-[#064e3b] px-6 pt-2 pb-8 rounded-b-[40px] shadow-sm">
                <Text className="text-white text-2xl font-black mb-1">NIN Services</Text>
                <Text className="text-emerald-200/80 text-sm">Select a service to proceed</Text>
            </View>

            <ScrollView className="flex-1 px-4 -mt-4" contentContainerStyle={{ paddingBottom: 50 }}>
                <View className="flex-row flex-wrap justify-between">
                    {SERVICES.map((service, index) => (
                        <TouchableOpacity 
                            key={service.id}
                            onPress={() => router.push(service.route as any)}
                            className="bg-white w-[48%] rounded-3xl p-5 mb-4 shadow-sm border border-slate-100 items-start"
                        >
                            <View className={`w-12 h-12 rounded-2xl ${service.color} items-center justify-center mb-4`}>
                                <Ionicons name={service.icon as any} size={24} color={service.iconColor} />
                            </View>
                            <Text className="text-slate-800 font-extrabold text-sm mb-1">{service.title}</Text>
                            <Text className="text-slate-500 text-[10px] font-medium leading-4">{service.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
