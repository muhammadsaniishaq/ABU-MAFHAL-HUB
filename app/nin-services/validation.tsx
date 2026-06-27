import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { StatusResult } from '../../components/StatusResult';

export default function ValidationScreen() {
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (nin.length !== 11) return Alert.alert('Error', 'Enter 11-digit NIN');
        setLoading(true);
        try {
            const res = await api.identity.validateIdentity(nin, 'nin');
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
                <Stack.Screen options={{ title: 'Validation Result' }} />
                <StatusResult result={result} title="Validation Status" />
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'General Validation', headerStyle: { backgroundColor: '#0891B2' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <Text className="text-slate-500 text-sm mb-6">Submit NIN for general validation checks.</Text>
                <TextInput
                    placeholder="Enter 11-digit NIN"
                    className="bg-white border border-slate-200 rounded-2xl px-4 h-16 mb-6 text-slate-800 font-bold"
                    keyboardType="number-pad" maxLength={11} value={nin} onChangeText={setNin} editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-cyan-600 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Submit Validation</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
