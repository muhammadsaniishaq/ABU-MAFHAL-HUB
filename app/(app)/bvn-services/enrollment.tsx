import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory } from '../../../services/verificationHistory';

export default function BVNEnrollmentScreen() {
    const insets = useSafeAreaInsets();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [dob, setDob] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [address, setAddress] = useState('');
    const [stateOfRes, setStateOfRes] = useState('');
    const [lga, setLga] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [result, setResult] = useState<any>(null);

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) setUserBalance(Number(data.balance));
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
    }, []);

    const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
        if (Platform.OS === 'web') alert(`${title}\n\n${message}`);
        else Alert.alert(title, message);
    };

    const handleEnroll = async () => {
        if (!firstName.trim() || !lastName.trim() || !phone.trim() || !bankName.trim() || !accountNumber.trim()) {
            showAlert("Required Fields", "Please fill in all required fields (First Name, Last Name, Phone, Bank, Account Number).");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const payload = {
                reference: `BVN-ENROLL-${Date.now()}`,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone_number: phone.trim(),
                email: email.trim() || `${phone.trim()}@user.ng`,
                date_of_birth: dob.trim(),
                bank_name: bankName.trim(),
                account_number: accountNumber.trim(),
                account_name: accountName.trim() || `${firstName} ${lastName}`.trim(),
                home_address: address.trim(),
                state_of_residence: stateOfRes.trim(),
                local_government: lga.trim(),
            };

            const res = await api.identity.requestBVNModification({
                number: accountNumber.trim(),
                service_code: 'enrollment',
                ...payload
            } as any);

            if (res && res.isValid) {
                setResult(res.data || { status: 'SUBMITTED' });
                showAlert("Enrollment Submitted", "BVN account holder details submitted successfully!", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'enrollment',
                    search_number: phone.trim(),
                    holder_name: `${firstName} ${lastName}`.trim(),
                    details: payload,
                });
                fetchWalletBalance();
            } else {
                showAlert("Enrollment Failed", res?.message || "Unable to submit enrollment details.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while connecting to server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#050B14', '#0B163A']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: 24 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>ENROLLMENT</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>BVN User Enrollment</Text>
                <Text style={styles.subText}>Register and link account holders for direct BVN generation</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>FIRST NAME</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#94a3b8" value={firstName} onChangeText={setFirstName} />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>SURNAME / LAST NAME</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="Surname" placeholderTextColor="#94a3b8" value={lastName} onChangeText={setLastName} />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>PHONE NUMBER</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="08012345678" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={11} value={phone} onChangeText={setPhone} />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>DATE OF BIRTH (DD-MM-YYYY)</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="01-01-1990" placeholderTextColor="#94a3b8" value={dob} onChangeText={setDob} />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>BANK NAME</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="Example: First Bank, GTBank, Access Bank" placeholderTextColor="#94a3b8" value={bankName} onChangeText={setBankName} />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>ACCOUNT NUMBER</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="10-digit Account Number" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={10} value={accountNumber} onChangeText={setAccountNumber} />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>HOME ADDRESS</Text>
                    <View style={styles.inputRow}>
                        <TextInput style={styles.input} placeholder="Residential address" placeholderTextColor="#94a3b8" value={address} onChangeText={setAddress} />
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.7 }]}
                        onPress={handleEnroll}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="person-add" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.btnText}>Submit Enrollment Details</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    badge: { backgroundColor: 'rgba(79,70,229,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#4f46e5' },
    badgeText: { color: '#818cf8', fontSize: 10, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 46 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
    btn: { backgroundColor: '#4f46e5', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
