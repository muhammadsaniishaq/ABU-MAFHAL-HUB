const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/tracking.tsx');

const content = `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
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
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist') || errM.toLowerCase().includes('not exist') || errM.toLowerCase().includes('invalid or not found')) {
                Alert.alert('No Record Found', 'The record or identity you entered does not exist or has no record. Please check the details and try again.');
            } else {
                Alert.alert('Request Failed', errM || 'An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Stack.Screen options={{ title: 'Tracking Result' }} />
                <StatusResult result={result} title="Personalization Status" />
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Card Tracking', headerStyle: { backgroundColor: '#EA580C' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View style={styles.formContainer}>
                <View style={styles.infoBox}>
                    <Ionicons name="card" size={32} color="#EA580C" />
                    <Text style={styles.infoTitle}>Personalization Tracking</Text>
                    <Text style={styles.infoDesc}>Check the status of your NIMC Card personalization.</Text>
                </View>
                <TextInput
                    placeholder="Enter Tracking ID or NIN"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    value={trackingID} 
                    onChangeText={setTrackingID} 
                    editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} style={styles.button} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Track Status</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        padding: 24,
        paddingBottom: 50,
    },
    infoBox: {
        backgroundColor: '#fff7ed',
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    infoTitle: {
        color: '#7c2d12',
        fontWeight: '700',
        marginTop: 8,
        fontSize: 15,
    },
    infoDesc: {
        color: '#9a3412',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 54,
        marginBottom: 20,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 15,
    },
    button: {
        backgroundColor: '#ea580c',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 15,
    },
    formContainer: {
        padding: 20,
        paddingTop: 24,
        flex: 1,
    },
});
`;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated tracking.tsx layout to use StyleSheet!');
