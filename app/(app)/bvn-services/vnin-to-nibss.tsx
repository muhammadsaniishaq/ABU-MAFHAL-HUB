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

export default function VNINToNIBSSScreen() {
    const insets = useSafeAreaInsets();
    const [vnin, setVnin] = useState('');
    const [bvn, setBvn] = useState('');
    const [fullName, setFullName] = useState('');
    const [ticketId, setTicketId] = useState('');
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

    const handleLink = async () => {
        const cleanVnin = vnin.trim().replace(/\D/g, '');
        const cleanBvn = bvn.trim().replace(/\D/g, '');

        if (!cleanVnin || cleanVnin.length < 11) {
            showAlert("Error", "Da fatan a shigar da ingantacciyar lambar NIN ko VNIN mai lamba 11 ko 16.");
            return;
        }
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Error", "Da fatan a shigar da ingantacciyar lambar BVN mai lamba 11.");
            return;
        }
        if (!fullName.trim()) {
            showAlert("Error", "Da fatan a shigar da cikakken sunan mai BVN.");
            return;
        }

        if (userBalance !== null && userBalance < 2500) {
            showAlert("Kuɗi Bai Isa Ba", "Asusunka ba shi da isassun kuɗi (₦2,500) don haɗa VNIN da NIBSS.");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.identity.linkVNINToNIBSS(cleanVnin, cleanBvn, 'bvn_vnin_nibss');

            if (res && res.isValid) {
                setResult(res.data || { status: 'SUCCESS' });
                showAlert("Nasarar Haɗawa", "An tura buƙatar haɗa VNIN zuwa NIBSS cikin nasara!", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'vnin_to_nibss',
                    search_number: `${cleanVnin}_${cleanBvn}`,
                    holder_name: fullName.trim(),
                    details: res.data || { vnin: cleanVnin, bvn: cleanBvn, status: 'SUBMITTED' },
                });
                fetchWalletBalance();
            } else {
                showAlert("Haɗawa Ta Faskara", res?.message || "Ba a samu nasarar tura buƙatar ba.");
            }
        } catch (e: any) {
            showAlert("Kuskure", e.message || "An samu matsala wajen haɗawa da uwar garke.");
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
                        <Text style={styles.badgeText}>NIBSS LINKING</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>VNIN to NIBSS</Text>
                <Text style={styles.subText}>Link Virtual NIN and BVN directly to NIBSS database</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>NIN / VNIN NUMBER</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="finger-print-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Lambar NIN (11) ko VNIN (16)"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={vnin}
                            onChangeText={setVnin}
                        />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>BVN NUMBER (Lamba 11)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="card-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Lambar BVN mai lamba 11"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={setBvn}
                        />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>CIKAKKEN SUNA (Full Name)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="person-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Misali: Emmanuel Adebayo"
                            placeholderTextColor="#94a3b8"
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>TICKET ID (ZABI NE)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="ticket-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="TICKET-123456"
                            placeholderTextColor="#94a3b8"
                            value={ticketId}
                            onChangeText={setTicketId}
                        />
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Kudin Sabis:</Text>
                        <Text style={styles.costVal}>₦2,500</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.7 }]}
                        onPress={handleLink}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="link" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.btnText}>Haɗa VNIN da NIBSS Yanzu</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {result && (
                    <View style={styles.resultCard}>
                        <Ionicons name="checkmark-circle" size={40} color="#9333ea" />
                        <Text style={styles.resultTitle}>An Tura Buƙatar Haɗawa!</Text>
                        <Text style={styles.resultDesc}>An karɓi bayanan haɗa VNIN da NIBSS. Ana gudanar da aikin a NIBSS portal.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    badge: { backgroundColor: 'rgba(147,51,234,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#9333ea' },
    badgeText: { color: '#c084fc', fontSize: 10, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 14, fontWeight: '800', color: '#9333ea' },
    btn: { backgroundColor: '#9333ea', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    resultCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    resultTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 10 },
    resultDesc: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 },
});
