import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { IDCardMockup } from '../../components/IDCardMockup';

export default function VerifyPhoneScreen() {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (phone.length < 10) return Alert.alert('Error', 'Enter a valid phone number');
        setLoading(true);
        try {
            const res = await api.identity.verifyNINWithPhone(phone);
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
                <Stack.Screen options={{ title: 'Verification Result' }} />
                {result.isValid ? <IDCardMockup data={data} /> : (
                    <View className="bg-red-50 p-6 rounded-3xl mb-6 items-center">
                        <Ionicons name="close-circle" size={36} color="#DC2626" />
                        <Text className="text-red-800 font-bold">Failed to find record</Text>
                    </View>
                )}
                <TouchableOpacity onPress={() => setResult(null)} className="bg-blue-700 h-16 rounded-2xl items-center justify-center mt-4">
                    <Text className="text-white font-bold">Search Another</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Verify by Phone', headerStyle: { backgroundColor: '#1e3a8a' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <Text className="text-slate-500 text-sm mb-6">Enter the phone number linked to the NIN.</Text>
                <TextInput
                    placeholder="e.g. 08012345678"
                    className="bg-white border border-slate-200 rounded-2xl px-4 h-16 mb-6 text-slate-800 font-bold"
                    keyboardType="phone-pad" maxLength={15} value={phone} onChangeText={setPhone} editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-blue-700 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Lookup Phone</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
