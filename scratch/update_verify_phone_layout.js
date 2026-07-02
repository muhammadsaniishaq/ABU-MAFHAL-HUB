const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-phone.tsx');

const content = `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
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
        const data = result.data || result.rawData || {};
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Stack.Screen options={{ title: 'Verification Result' }} />
                {result.isValid ? <IDCardMockup data={data} /> : (
                    <View style={styles.errorBox}>
                        <Ionicons name="close-circle" size={36} color="#DC2626" />
                        <Text style={styles.errorText}>Failed to find record</Text>
                    </View>
                )}
                <TouchableOpacity onPress={() => setResult(null)} style={styles.button} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>Search Another</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Verify by Phone', headerStyle: { backgroundColor: '#1e3a8a' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View style={styles.formContainer}>
                <Text style={styles.label}>Enter the phone number linked to the NIN.</Text>
                <TextInput
                    placeholder="e.g. 08012345678"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    keyboardType="phone-pad" 
                    maxLength={15} 
                    value={phone} 
                    onChangeText={setPhone} 
                    editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} style={styles.button} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Lookup Phone</Text>}
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
    errorBox: {
        backgroundColor: '#fef2f2',
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    errorText: {
        color: '#991b1b',
        fontWeight: '700',
        marginTop: 8,
    },
    button: {
        backgroundColor: '#1e3a8a',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
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
    label: {
        color: '#64748b',
        fontSize: 13,
        marginBottom: 16,
        fontWeight: '500',
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
});
`;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated verify-phone.tsx layout to use StyleSheet!');
