const fs = require('fs');
const path = require('path');

// Helper to write file
const updateFile = (filePath, content) => {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)} successfully!`);
};

// 1. validation.tsx
const validationPath = path.join(__dirname, '../app/nin-services/validation.tsx');
updateFile(validationPath, `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
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
                <Stack.Screen options={{ title: 'Validation Result' }} />
                <StatusResult result={result} title="Validation Status" />
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'General Validation', headerStyle: { backgroundColor: '#0891B2' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View style={styles.formContainer}>
                <Text style={styles.label}>Submit NIN for general validation checks.</Text>
                <TextInput
                    placeholder="Enter 11-digit NIN"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    keyboardType="number-pad" 
                    maxLength={11} 
                    value={nin} 
                    onChangeText={setNin} 
                    editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} style={styles.button} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Submit Validation</Text>}
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
    button: {
        backgroundColor: '#0891b2',
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
`);

// 2. delink.tsx
const delinkPath = path.join(__dirname, '../app/nin-services/delink.tsx');
updateFile(delinkPath, `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
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
`);

// 3. ipe-clearance.tsx
const ipePath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');
updateFile(ipePath, `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
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
                <Stack.Screen options={{ title: 'IPE Result' }} />
                <StatusResult result={result} title="IPE Status" />
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'IPE Clearance', headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View style={styles.formContainer}>
                <Text style={styles.label}>Submit Tracking ID or NIN for Instant Pre-Employment Clearance.</Text>
                <TextInput
                    placeholder="Enter Tracking ID or NIN"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    value={nin} 
                    onChangeText={setNin} 
                    editable={!loading}
                />
                <TouchableOpacity onPress={handleVerify} disabled={loading} style={styles.button} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Submit Clearance</Text>}
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
    button: {
        backgroundColor: '#4f46e5',
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
`);

// 4. demographic.tsx
const demoPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
updateFile(demoPath, `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../../services/api';
import { IDCardMockup } from '../../components/IDCardMockup';

export default function DemographicScreen() {
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
                <Stack.Screen options={{ title: 'Demographic Result' }} />
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
            <Stack.Screen options={{ title: 'Demographic Search', headerStyle: { backgroundColor: '#581c87' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />
            <View style={styles.formContainer}>
                <TextInput placeholder="First Name" placeholderTextColor="#94a3b8" style={styles.input} value={firstname} onChangeText={setFirstname} />
                <TextInput placeholder="Last Name" placeholderTextColor="#94a3b8" style={styles.input} value={lastname} onChangeText={setLastname} />
                <TextInput placeholder="DOB (DD-MM-YYYY)" placeholderTextColor="#94a3b8" style={styles.input} value={dob} onChangeText={setDob} />
                
                <View style={styles.genderRow}>
                    <TouchableOpacity 
                        onPress={() => setGender('m')} 
                        style={[
                            styles.genderButton,
                            gender === 'm' ? styles.genderButtonActive : styles.genderButtonInactive
                        ]}
                        activeOpacity={0.8}
                    >
                        <Text style={gender === 'm' ? styles.genderTextActive : styles.genderTextInactive}>MALE</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={() => setGender('f')} 
                        style={[
                            styles.genderButton,
                            gender === 'f' ? styles.genderButtonActive : styles.genderButtonInactive
                        ]}
                        activeOpacity={0.8}
                    >
                        <Text style={gender === 'f' ? styles.genderTextActive : styles.genderTextInactive}>FEMALE</Text>
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={handleVerify} disabled={loading} style={styles.button} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Search Demographics</Text>}
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
        backgroundColor: '#581c87',
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
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 50,
        marginBottom: 12,
        color: '#1e293b',
        fontWeight: '600',
        fontSize: 14,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    genderButton: {
        flex: 1,
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    genderButtonActive: {
        backgroundColor: '#581c87',
        borderColor: '#581c87',
    },
    genderButtonInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
    },
    genderTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '700',
    },
});
`);
