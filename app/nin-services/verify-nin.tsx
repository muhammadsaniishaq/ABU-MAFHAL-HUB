import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { IDCardMockup } from '../../components/IDCardMockup';

export default function VerifyNINScreen() {
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (nin.length !== 11) return Alert.alert('Error', 'Enter 11-digit NIN');
        setLoading(true);
        try {
            const res = await api.identity.validateNIN(nin);
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
                        <Text className="text-red-800 font-bold">Failed to verify NIN</Text>
                    </View>
                )}
                <TouchableOpacity onPress={() => setResult(null)} className="bg-emerald-700 h-16 rounded-2xl items-center justify-center mt-4">
                    <Text className="text-white font-bold">Verify Another</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#064e3b' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <Text className="text-slate-500 text-sm mb-6">Enter the 11-digit National Identity Number below.</Text>
                <TextInput
                    placeholder="e.g. 12345678901"
                    className="bg-white border border-slate-200 rounded-2xl px-4 h-16 mb-6 text-slate-800 font-bold"
                    keyboardType="number-pad" maxLength={11} value={nin} onChangeText={setNin} editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-emerald-700 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Search Record</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
