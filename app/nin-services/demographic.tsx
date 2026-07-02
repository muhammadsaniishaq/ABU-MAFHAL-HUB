import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { IDCardMockup } from '../../components/IDCardMockup';

export default function DemographicScreen() {
    const router = useRouter();
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState<'m' | 'f'>('m');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (!firstname || !lastname || !dob) return Alert.alert('Error', 'Fill all fields');
        setLoading(true);
        try {
            const res = await api.identity.verifyDemographic({ firstname, lastname, gender, dob });
            setResult(res);
        } catch (e: any) {
            Alert.alert('Request Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        const data = result.data || result.rawData || {};
        return (
            <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
                <Stack.Screen options={{ title: 'Demographic Result' }} />
                {result.isValid ? <IDCardMockup data={data} /> : (
                    <View className="bg-red-50 p-6 rounded-3xl mb-6 items-center">
                        <Ionicons name="close-circle" size={36} color="#DC2626" />
                        <Text className="text-red-800 font-bold">Failed to find record</Text>
                    </View>
                )}
                <TouchableOpacity onPress={() => setResult(null)} className="bg-purple-700 h-16 rounded-2xl items-center justify-center mt-4">
                    <Text className="text-white font-bold">Search Another</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ 
                title: 'Demographic Search', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#fff',
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history?tab=nin')} style={{ marginRight: 8 }}>
                        <Ionicons name="time-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )
            }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <TextInput placeholder="First Name" className="bg-white border border-slate-200 rounded-xl px-4 h-14 mb-3" value={firstname} onChangeText={setFirstname} />
                <TextInput placeholder="Last Name" className="bg-white border border-slate-200 rounded-xl px-4 h-14 mb-3" value={lastname} onChangeText={setLastname} />
                <TextInput placeholder="DOB (DD-MM-YYYY)" className="bg-white border border-slate-200 rounded-xl px-4 h-14 mb-3" value={dob} onChangeText={setDob} />
                <View className="flex-row gap-3 mb-6">
                    <TouchableOpacity onPress={() => setGender('m')} className={`flex-1 h-14 rounded-xl items-center justify-center border ${gender === 'm' ? 'bg-purple-900 border-purple-900' : 'bg-white'}`}><Text className={gender === 'm' ? 'text-white' : 'text-slate-400'}>MALE</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setGender('f')} className={`flex-1 h-14 rounded-xl items-center justify-center border ${gender === 'f' ? 'bg-purple-900 border-purple-900' : 'bg-white'}`}><Text className={gender === 'f' ? 'text-white' : 'text-slate-400'}>FEMALE</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-purple-700 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Search Demographics</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
