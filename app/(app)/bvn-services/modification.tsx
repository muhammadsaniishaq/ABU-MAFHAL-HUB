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

const MOD_OPTIONS = [
    { code: '620', label: 'Date of Birth (DOB)', price: 5000 },
    { code: '621', label: 'Full Name', price: 5000 },
    { code: '625', label: 'Phone Number', price: 5000 },
    { code: '622', label: 'Name & Phone', price: 7000 },
    { code: '623', label: 'Name & DOB', price: 7000 },
    { code: '624', label: 'DOB & Phone', price: 7000 },
    { code: '626', label: 'Phone, DOB & Name', price: 9000 },
];

export default function BVNModificationScreen() {
    const insets = useSafeAreaInsets();
    const [selectedCode, setSelectedCode] = useState('620');
    const [bvn, setBvn] = useState('');
    const [nin, setNin] = useState('');
    const [phone, setPhone] = useState('');
    const [dob, setDob] = useState('');
    const [oldFirstName, setOldFirstName] = useState('');
    const [oldLastName, setOldLastName] = useState('');
    const [oldMiddleName, setOldMiddleName] = useState('');
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newMiddleName, setNewMiddleName] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [result, setResult] = useState<any>(null);

    const currentOption = MOD_OPTIONS.find(o => o.code === selectedCode) || MOD_OPTIONS[0];

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

    const handleSubmitModification = async () => {
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        const cleanNin = nin.trim().replace(/\D/g, '');

        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Invalid BVN", "Please enter a valid 11-digit BVN number.");
            return;
        }

        if (userBalance !== null && userBalance < currentOption.price) {
            showAlert("Insufficient Balance", `Your account balance is insufficient (₦${currentOption.price.toLocaleString()} required) for this modification.`);
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const payload: any = {
                number: cleanBvn,
                service_code: selectedCode,
                bank_code: '706',
                nin: cleanNin,
                bvn: cleanBvn,
                phone_number: phone.trim(),
                phone: phone.trim(),
                dob: dob.trim(),
                old_first_name: oldFirstName.trim(),
                old_surname: oldLastName.trim(),
                old_middle_name: oldMiddleName.trim(),
                firstname: newFirstName.trim(),
                lastname: newLastName.trim(),
                middlename: newMiddleName.trim(),
                new_first_name: newFirstName.trim(),
                new_surname: newLastName.trim(),
                new_middle_name: newMiddleName.trim(),
            };

            const res = await api.identity.requestBVNModification(payload, 'bvn_modification');

            if (res && res.isValid) {
                setResult(res.data || { status: 'SUBMITTED' });
                showAlert("Submission Successful", "Your BVN modification request has been submitted to NIBSS successfully!", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: `bvn_modification_${selectedCode}`,
                    search_number: cleanBvn,
                    holder_name: `${newFirstName} ${newLastName}`.trim() || 'BVN Modification',
                    details: res.data || payload,
                });
                fetchWalletBalance();
            } else {
                showAlert("Submission Failed", res?.message || "Unable to submit modification request.");
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
                        <Text style={styles.badgeText}>MODIFICATION</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>BVN Modification</Text>
                <Text style={styles.subText}>Official correction of Date of Birth, Name, and Phone Number</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Code Selector */}
                <Text style={styles.sectionHeader}>SELECT MODIFICATION TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {MOD_OPTIONS.map((opt) => (
                        <TouchableOpacity
                            key={opt.code}
                            style={[styles.optChip, selectedCode === opt.code && styles.activeOptChip]}
                            onPress={() => setSelectedCode(opt.code)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.optChipText, selectedCode === opt.code && styles.activeOptChipText]}>
                                {opt.label} ({opt.code})
                            </Text>
                            <Text style={[styles.optChipPrice, selectedCode === opt.code && styles.activeOptChipPrice]}>
                                ₦{opt.price.toLocaleString()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Form Card */}
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>ENTER BVN NUMBER (11 Digits)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="finger-print-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 11-digit BVN"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={setBvn}
                        />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>NIN NUMBER (Optional)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="card-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 11-digit NIN"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={nin}
                            onChangeText={setNin}
                        />
                    </View>

                    {(selectedCode === '620' || selectedCode === '623' || selectedCode === '624' || selectedCode === '626') && (
                        <>
                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW DATE OF BIRTH (DD-MM-YYYY)</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="calendar-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Example: 15-08-1995"
                                    placeholderTextColor="#94a3b8"
                                    value={dob}
                                    onChangeText={setDob}
                                />
                            </View>
                        </>
                    )}

                    {(selectedCode === '625' || selectedCode === '622' || selectedCode === '624' || selectedCode === '626') && (
                        <>
                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW PHONE NUMBER (11 Digits)</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="call-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Example: 08012345678"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    maxLength={11}
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>
                        </>
                    )}

                    {(selectedCode === '621' || selectedCode === '622' || selectedCode === '623' || selectedCode === '626') && (
                        <>
                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>OLD FULL NAME</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Old First Name"
                                    placeholderTextColor="#94a3b8"
                                    value={oldFirstName}
                                    onChangeText={setOldFirstName}
                                />
                            </View>
                            <View style={[styles.inputRow, { marginTop: 8 }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Old Surname"
                                    placeholderTextColor="#94a3b8"
                                    value={oldLastName}
                                    onChangeText={setOldLastName}
                                />
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW FULL NAME</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="New First Name"
                                    placeholderTextColor="#94a3b8"
                                    value={newFirstName}
                                    onChangeText={setNewFirstName}
                                />
                            </View>
                            <View style={[styles.inputRow, { marginTop: 8 }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="New Surname"
                                    placeholderTextColor="#94a3b8"
                                    value={newLastName}
                                    onChangeText={setNewLastName}
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Modification Fee ({currentOption.label}):</Text>
                        <Text style={styles.costVal}>₦{currentOption.price.toLocaleString()}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.7 }]}
                        onPress={handleSubmitModification}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="create" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.btnText}>Submit Modification Request</Text>
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
    badge: { backgroundColor: 'rgba(217,119,6,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#d97706' },
    badgeText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    sectionHeader: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8 },
    optChip: { backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    activeOptChip: { backgroundColor: '#d97706', borderColor: '#d97706' },
    optChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    activeOptChipText: { color: '#ffffff' },
    optChipPrice: { fontSize: 10, fontWeight: '800', color: '#64748b', marginTop: 2 },
    activeOptChipPrice: { color: '#fef3c7' },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 46 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 15, fontWeight: '800', color: '#d97706' },
    btn: { backgroundColor: '#d97706', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
