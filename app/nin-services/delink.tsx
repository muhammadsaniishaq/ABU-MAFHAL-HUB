import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { StatusResult } from '../../components/StatusResult';
import { Ionicons } from '@expo/vector-icons';

export default function DelinkScreen() {
    const [delinkNIN, setDelinkNIN] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (delinkNIN.length !== 11) return Alert.alert('Error', 'Enter 11-digit NIN');
        setLoading(true);
        try {
            const res = await api.identity.delinkAndRetrieve(delinkNIN);
            setResult(res);
        } catch (e: any) {
            Alert.alert('Request Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
                <Stack.Screen options={{ title: 'Delink Result' }} />
                <StatusResult result={result} title="Delink Request Status" />
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Delink Phone', headerStyle: { backgroundColor: '#DC2626' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <View className="bg-red-50 border border-red-100 p-5 rounded-3xl mb-6 items-center">
                    <Ionicons name="cut" size={32} color="#EF4444" />
                    <Text className="text-red-900 font-bold mt-2">Delink Phone from NIN</Text>
                    <Text className="text-red-700 text-xs text-center mt-1">Submit a request to safely detach a phone number from a NIN record.</Text>
                </View>
                <TextInput
                    placeholder="Enter NIN to Delink"
                    className="bg-white border border-slate-200 rounded-2xl px-4 h-16 mb-4 text-slate-800 font-bold"
                    keyboardType="number-pad" maxLength={11} value={delinkNIN} onChangeText={setDelinkNIN} editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-red-600 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Submit Delink Request</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
