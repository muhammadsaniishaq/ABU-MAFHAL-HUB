import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';

export default function BVNPremiumSlipScreen() {
    const insets = useSafeAreaInsets();
    const [bvn, setBvn] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);

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

    const handleGenerateSlip = async () => {
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Error", "Da fatan a shigar da lambar BVN mai lamba 11.");
            return;
        }

        if (userBalance !== null && userBalance < 150) {
            showAlert("Kuɗi Bai Isa Ba", "Asusunka ba shi da isassun kuɗi (₦150) don fitar da BVN Premium Slip.");
            return;
        }

        setLoading(true);
        setGeneratedPdf(null);

        try {
            const res = await api.identity.getBVNCard(cleanBvn, 'bvn_slip');
            if (res && res.isValid && (res.data?.pdf_base64 || res.data?.data?.pdf_base64 || res.data)) {
                const pdfBase64 = res.data?.pdf_base64 || res.data?.data?.pdf_base64;
                if (pdfBase64) {
                    setGeneratedPdf(pdfBase64);
                    showAlert("An Fitar da Slip", "An samu nasarar fitar da BVN Premium Slip!", "success");
                    
                    // Save history
                    await verificationHistory.save({
                        service_category: 'bvn',
                        service_type: 'bvn_premium_slip',
                        search_number: cleanBvn,
                        holder_name: extractFullName(res.data) || 'BVN Holder',
                        details: res.data,
                    });
                    fetchWalletBalance();
                } else {
                    showAlert("Fitar da Slip Ya Faskara", res.message || "Uwar garke ba ta dawo da PDF ba.");
                }
            } else {
                showAlert("Tantancewa Ta Faskara", res.message || "Ba a samu bayanan BVN ba.");
            }
        } catch (e: any) {
            showAlert("Kuskure", e.message || "An samu matsala wajen haɗawa da uwar garke.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!generatedPdf) return;
        try {
            if (Platform.OS === 'web') {
                const byteCharacters = atob(generatedPdf);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `bvn_premium_slip_${bvn || 'official'}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            } else {
                const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                const fileUri = `${docDir}bvn_premium_slip_${bvn || 'official'}.pdf`;
                await FileSystem.writeAsStringAsync(fileUri, generatedPdf, { encoding: ((FileSystem as any).EncodingType?.Base64 || 'base64') as any });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download BVN Premium Slip (PDF)' });
                }
            }
        } catch (e: any) {
            showAlert("Download Error", e.message);
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
                        <Text style={styles.badgeText}>OFFICIAL PDF</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>BVN Premium Slip</Text>
                <Text style={styles.subText}>Generate & download official electronic BVN PDF slip</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>SHIGAR DA LAMBAR BVN (Lamba 11)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="document-text" size={20} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Misali: 22824107008"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={(t) => setBvn(t.replace(/\D/g, ''))}
                        />
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Kudin Sabis:</Text>
                        <Text style={styles.costVal}>₦150</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, (loading || bvn.length !== 11) && { opacity: 0.7 }]}
                        onPress={handleGenerateSlip}
                        disabled={loading || bvn.length !== 11}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="document-attach" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.btnText}>Generate Official PDF Slip</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {generatedPdf && (
                    <View style={styles.successCard}>
                        <Ionicons name="checkmark-circle" size={48} color="#059669" />
                        <Text style={styles.successTitle}>BVN Slip Ready!</Text>
                        <Text style={styles.successDesc}>An yi nasarar fitar da cikakken katin BVN na hukuma.</Text>
                        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPdf} activeOpacity={0.8}>
                            <Ionicons name="download" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.downloadBtnText}>Sauke PDF Slip Yanzu</Text>
                        </TouchableOpacity>
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
    badge: { backgroundColor: 'rgba(5,150,105,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#059669' },
    badgeText: { color: '#34d399', fontSize: 10, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 14, fontWeight: '800', color: '#059669' },
    btn: { backgroundColor: '#059669', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    successCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    successTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 10 },
    successDesc: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, marginBottom: 16 },
    downloadBtn: { backgroundColor: '#0284c7', height: 44, paddingHorizontal: 20, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    downloadBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
