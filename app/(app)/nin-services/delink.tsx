import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../../services/api';
import { StatusResult } from '../../../components/StatusResult';
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
                <Stack.Screen options={{ title: 'Delink Result' }} />
                <StatusResult result={result} title="Delink Request Status" />
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Delink Phone', headerStyle: { backgroundColor: '#DC2626' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View style={styles.formContainer}>
                <View style={styles.infoBox}>
                    <Ionicons name="cut" size={32} color="#EF4444" />
                    <Text style={styles.infoTitle}>Delink Phone from NIN</Text>
                    <Text style={styles.infoDesc}>Submit a request to safely detach a phone number from a NIN record.</Text>
                </View>
                <TextInput
                    placeholder="Enter NIN to Delink"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    keyboardType="number-pad" 
                    maxLength={11} 
                    value={delinkNIN} 
                    onChangeText={setDelinkNIN} 
                    editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} style={styles.button} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Submit Delink Request</Text>}
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
    formContainer: {
        padding: 20,
        paddingTop: 24,
        flex: 1,
    },
    infoBox: {
        backgroundColor: '#fef2f2',
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    infoTitle: {
        color: '#991b1b',
        fontWeight: '700',
        marginTop: 8,
        fontSize: 15,
    },
    infoDesc: {
        color: '#b91c1c',
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
        backgroundColor: '#dc2626',
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
});
