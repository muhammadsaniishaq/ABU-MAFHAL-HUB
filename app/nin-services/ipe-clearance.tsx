import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { StatusResult } from '../../components/StatusResult';

export default function IPEClearanceScreen() {
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (!nin) return Alert.alert('Error', 'Enter NIN or Tracking ID');
        setLoading(true);
        try {
            const res = await api.identity.runIPEClearance(nin);
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
                <Stack.Screen options={{ title: 'IPE Result' }} />
                <StatusResult result={result} title="IPE Status" />
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'IPE Clearance', headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <Text className="text-slate-500 text-sm mb-6">Submit Tracking ID or NIN for Instant Pre-Employment Clearance.</Text>
                <TextInput
                    placeholder="Enter Tracking ID or NIN"
                    className="bg-white border border-slate-200 rounded-2xl px-4 h-16 mb-6 text-slate-800 font-bold"
                    value={nin} onChangeText={setNin} editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-indigo-600 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Submit Clearance</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
