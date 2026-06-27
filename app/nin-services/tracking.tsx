import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { StatusResult } from '../../components/StatusResult';
import { Ionicons } from '@expo/vector-icons';

export default function TrackingScreen() {
    const [trackingID, setTrackingID] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (!trackingID) return Alert.alert('Error', 'Enter Tracking ID');
        setLoading(true);
        try {
            const res = await api.identity.getPersonalization(trackingID);
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
                <Stack.Screen options={{ title: 'Tracking Result' }} />
                <StatusResult result={result} title="Personalization Status" />
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Card Tracking', headerStyle: { backgroundColor: '#EA580C' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View className="p-6 pt-8 flex-1">
                <View className="bg-orange-100 p-5 rounded-3xl mb-6 items-center">
                    <Ionicons name="card" size={32} color="#EA580C" />
                    <Text className="text-orange-900 font-bold mt-2">Personalization Tracking</Text>
                    <Text className="text-orange-700 text-xs text-center mt-1">Check the status of your NIMC Card personalization.</Text>
                </View>
                <TextInput
                    placeholder="Enter Tracking ID or NIN"
                    className="bg-white border border-slate-200 rounded-2xl px-4 h-16 mb-6 text-slate-800 font-bold"
                    value={trackingID} onChangeText={setTrackingID} editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} className="h-16 rounded-2xl items-center justify-center bg-orange-600 shadow-md">
                    {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Track Status</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
