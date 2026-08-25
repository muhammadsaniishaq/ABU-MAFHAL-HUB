import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Platform, Modal, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clipboard } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerifyBVNScreen() {
    const insets = useSafeAreaInsets();
    const { reprintId, bvnNumber } = useLocalSearchParams();
    const [bvn, setBvn] = useState(typeof bvnNumber === 'string' ? bvnNumber : '');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [historyList, setHistoryList] = useState<any[]>([]);

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) {
                    setUserBalance(Number(data.balance));
                }
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    const loadHistory = async () => {
        try {
            const dbList = await verificationHistory.getAll('bvn');
            const stored = await AsyncStorage.getItem('recent_bvn_verifications');
            const localList = stored ? JSON.parse(stored) : [];

            const combinedMap = new Map();
            for (const item of localList) {
                const fullName = extractFullName(item.data || item.details, item.name || item.holder_name);
                const bvnNum = item.bvn || item.search_number || item.id;
                if (bvnNum) {
                    combinedMap.set(bvnNum, {
                        ...item,
                        bvn: bvnNum,
                        name: fullName
                    });
                }
            }

            if (dbList && dbList.length > 0) {
                for (const item of dbList) {
                    const fullName = extractFullName(item.details, item.holder_name);
                    const bvnNum = item.search_number || item.details?.bvn || item.details?.data?.bvn || item.id;
                    combinedMap.set(bvnNum, {
                        id: item.id,
                        bvn: bvnNum,
                        name: fullName,
                        date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
                        data: item.details
                    });
                }
            }

            const finalHistory = Array.from(combinedMap.values());
            setHistoryList(finalHistory);
            await AsyncStorage.setItem('recent_bvn_verifications', JSON.stringify(finalHistory));
        } catch (e) {
            console.warn('Failed to load BVN history', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
        loadHistory();
    }, []);

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getString();
            if (text) {
                const cleaned = text.replace(/\D/g, '').slice(0, 11);
                setBvn(cleaned);
            }
        } catch (e) {
            console.warn('Clipboard error', e);
        }
    };

    const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
        if (Platform.OS === 'web') {
            alert(`${title}\n\n${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleVerify = async () => {
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Error", "Da fatan a shigar da ingantacciyar lambar BVN mai lamba 11.", "error");
            return;
        }

        if (userBalance !== null && userBalance < 150) {
            showAlert("Kuɗi Bai Isa Ba", "Asusunka ba shi da isassun kuɗi (₦150) don tantance BVN. Da fatan ka saka kuɗi a asusunka.", "error");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await api.identity.validateBVN(cleanBvn, 'bvn_verification');
            
            if (response && response.isValid && response.data) {
                const rawData = response.data.data || response.data;
                setResult(rawData);

                // Save to history
                const fullName = extractFullName(rawData, `${rawData.firstName || rawData.first_name || ''} ${rawData.lastName || rawData.surname || ''}`);
                const newItem = {
                    id: `bvn_${Date.now()}`,
                    bvn: cleanBvn,
                    name: fullName,
                    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    data: rawData
                };

                const stored = await AsyncStorage.getItem('recent_bvn_verifications');
                const localList = stored ? JSON.parse(stored) : [];
                const updated = [newItem, ...localList.filter((i: any) => i.bvn !== cleanBvn)].slice(0, 100);
                setHistoryList(updated);
                await AsyncStorage.setItem('recent_bvn_verifications', JSON.stringify(updated));

                await verificationHistory.save({
                    service_category: 'bvn',
                    search_number: cleanBvn,
                    holder_name: fullName,
                    price_paid: 150,
                    details: rawData,
                });

                fetchWalletBalance();
                showAlert("Nasarar Tantancewa", "An yi nasarar samo bayanan BVN!", "success");
            } else {
                const errorMsg = response?.message || response?.error || "Ba a samu bayanan BVN ba. Tabbatar da lambar da ka shigar.";
                showAlert("Tantancewa Ta Faskara", errorMsg, "error");
            }
        } catch (err: any) {
            showAlert("Sabis na Fuskantar Matsala", err.message || "An samu matsala wajen haɗawa da uwar garke.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePrintOrPdf = async () => {
        if (!result) return;
        setIsSaving(true);
        try {
            const fn = result.firstName || result.first_name || '';
            const mn = result.middleName || result.middle_name || '';
            const ln = result.lastName || result.surname || '';
            const fullName = `${fn} ${mn} ${ln}`.trim() || 'BVN HOLDER';
            const bvnNum = result.bvn || bvn || 'N/A';
            const dob = result.dateOfBirth || result.dob || result.birthdate || 'N/A';
            const phone = result.phoneNumber1 || result.phoneNumber || result.phone || 'N/A';
            const gender = result.gender || 'N/A';
            const state = result.stateOfOrigin || result.state || 'N/A';
            const lga = result.lgaOfOrigin || result.lga || 'N/A';
            const photoSrc = result.image || result.photo ? `data:image/jpeg;base64,${result.image || result.photo}` : '';

            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Official BVN Verification Slip - ${bvnNum}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; color: #1e293b; }
                    .card { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: #0f172a; color: white; padding: 20px; text-align: center; }
                    .header h1 { margin: 0 0 4px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
                    .header p { margin: 0; font-size: 11px; opacity: 0.8; }
                    .body { padding: 24px; display: flex; gap: 20px; }
                    .photo-box { width: 120px; height: 140px; background: #e2e8f0; border: 1px solid #94a3b8; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                    .info { flex: 1; }
                    .row { margin-bottom: 12px; }
                    .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 2px; }
                    .val { font-size: 14px; font-weight: bold; color: #0f172a; }
                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .footer { background: #f1f5f9; padding: 12px 24px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
                    .watermark { font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #059669; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h1>Central Bank of Nigeria / NIBSS</h1>
                        <p>OFFICIAL BIOMETRIC VERIFICATION NUMBER (BVN) RECORD</p>
                    </div>
                    <div class="body">
                        <div class="photo-box">
                            ${photoSrc ? `<img src="${photoSrc}" />` : `<div style="font-size:10px;color:#64748b;">PASSPORT</div>`}
                        </div>
                        <div class="info">
                            <div class="row">
                                <div class="label">Full Name</div>
                                <div class="val">${fullName}</div>
                            </div>
                            <div class="row">
                                <div class="label">BVN Number</div>
                                <div class="val watermark">${bvnNum}</div>
                            </div>
                            <div class="grid-2">
                                <div class="row">
                                    <div class="label">Date of Birth</div>
                                    <div class="val">${dob}</div>
                                </div>
                                <div class="row">
                                    <div class="label">Gender</div>
                                    <div class="val">${gender}</div>
                                </div>
                            </div>
                            <div class="grid-2">
                                <div class="row">
                                    <div class="label">Phone Number</div>
                                    <div class="val">${phone}</div>
                                </div>
                                <div class="row">
                                    <div class="label">State / LGA</div>
                                    <div class="val">${state} / ${lga}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        Generated securely via Abu-Mafhal Integrated Hub • NIBSS Verified Record
                    </div>
                </div>
            </body>
            </html>
            `;

            if (Platform.OS === 'web') {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.print();
                }
            } else {
                await Print.printAsync({ html });
            }
        } catch (e: any) {
            showAlert("Print Error", e.message, "error");
        } finally {
            setIsSaving(false);
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
                        <Text style={styles.badgeText}>INSTANT CARD</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>BVN Verification</Text>
                <Text style={styles.subText}>Verify 11-digit BVN & download official verification card</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Dial Helper */}
                <TouchableOpacity 
                    style={styles.dialHelper} 
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL('tel:*565*0%23')}
                >
                    <Ionicons name="phone-portrait" size={18} color="#0284c7" />
                    <Text style={styles.dialHelperText}>Manta da BVN? Danna nan ka danna <Text style={{ fontWeight: 'bold' }}>*565*0#</Text> a layinka</Text>
                </TouchableOpacity>

                {/* Input Card */}
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>SHIGAR DA LAMBAR BVN (Lamba 11)</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="finger-print" size={20} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Misali: 22824107008"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={(t) => setBvn(t.replace(/\D/g, ''))}
                        />
                        <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn}>
                            <Text style={styles.pasteBtnText}>Paste</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Kudin Tantancewa:</Text>
                        <Text style={styles.costVal}>₦150</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.verifyBtn, (loading || bvn.length !== 11) && { opacity: 0.7 }]}
                        onPress={handleVerify}
                        disabled={loading || bvn.length !== 11}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="shield-checkmark" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.verifyBtnText}>Tantance BVN Yanzu</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Result Card */}
                {result && (
                    <View style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                            <Text style={styles.resultHeaderText}>Ingantattun Bayanan BVN</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Cikakken Suna:</Text>
                            <Text style={styles.detailVal}>
                                {`${result.firstName || result.first_name || ''} ${result.middleName || result.middle_name || ''} ${result.lastName || result.surname || ''}`.trim()}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Lambar BVN:</Text>
                            <Text style={[styles.detailVal, { color: '#0284c7', fontWeight: '900' }]}>{result.bvn || bvn}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Ranar Haihuwa:</Text>
                            <Text style={styles.detailVal}>{result.dateOfBirth || result.dob || result.birthdate || 'N/A'}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Lambar Waya:</Text>
                            <Text style={styles.detailVal}>{result.phoneNumber1 || result.phoneNumber || result.phone || 'N/A'}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Jinsi (Gender):</Text>
                            <Text style={styles.detailVal}>{result.gender || 'N/A'}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Jiha / LGA:</Text>
                            <Text style={styles.detailVal}>{`${result.stateOfOrigin || result.state || ''} / ${result.lgaOfOrigin || result.lga || ''}`}</Text>
                        </View>

                        <TouchableOpacity 
                            style={styles.printBtn} 
                            onPress={handlePrintOrPdf}
                            activeOpacity={0.8}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Ionicons name="print" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                    <Text style={styles.printBtnText}>Buga Katin BVN / Sauke PDF</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* History Section */}
                {historyList.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.historyTitle}>Tarihin Tantance BVN na Kusa</Text>
                        {historyList.slice(0, 5).map((item) => (
                            <TouchableOpacity 
                                key={item.id || item.bvn} 
                                style={styles.historyItem}
                                onPress={() => {
                                    setBvn(item.bvn);
                                    if (item.data) setResult(item.data);
                                }}
                            >
                                <View>
                                    <Text style={styles.historyName}>{item.name || 'BVN Holder'}</Text>
                                    <Text style={styles.historyBvn}>{item.bvn}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        ))}
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
    badge: { backgroundColor: 'rgba(2,132,199,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#0284c7' },
    badgeText: { color: '#38bdf8', fontSize: 10, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    dialHelper: { backgroundColor: '#e0f2fe', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#bae6fd' },
    dialHelperText: { fontSize: 12, color: '#0369a1', marginLeft: 8, flex: 1 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
    pasteBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    pasteBtnText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 14, fontWeight: '800', color: '#059669' },
    verifyBtn: { backgroundColor: '#0284c7', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    verifyBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    resultCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultHeaderText: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginLeft: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    detailLabel: { fontSize: 12, color: '#64748b' },
    detailVal: { fontSize: 12, fontWeight: '700', color: '#0f172a', maxWidth: '60%', textAlign: 'right' },
    printBtn: { backgroundColor: '#059669', height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    printBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
    historySection: { marginTop: 8 },
    historyTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 8 },
    historyItem: { backgroundColor: '#ffffff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    historyBvn: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
