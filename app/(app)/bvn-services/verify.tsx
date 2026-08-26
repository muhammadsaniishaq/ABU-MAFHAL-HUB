import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet, Linking, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

export default function VerifyBVNScreen() {
    const insets = useSafeAreaInsets();
    const { reprintId, bvnNumber } = useLocalSearchParams();
    const [bvn, setBvn] = useState(typeof bvnNumber === 'string' ? bvnNumber : '');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

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
                        date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently',
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
            const text = await Clipboard.getStringAsync();
            if (text) {
                const cleaned = text.replace(/\D/g, '').slice(0, 11);
                setBvn(cleaned);
            }
        } catch (e) {
            console.warn('Clipboard error', e);
        }
    };

    const showAlert = (title: string, message: string, type: AlertType = 'info') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const handleVerify = async () => {
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Invalid BVN", "Please enter a valid 11-digit BVN number.", "error");
            return;
        }

        if (userBalance !== null && userBalance < 50) {
            showAlert("Insufficient Balance", "Your account balance is insufficient. Please fund your wallet to proceed.", "error");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.identity.validateBVN(cleanBvn, 'bvn_num_advanced');

            if (res && (res.isValid || res.data)) {
                const rawData = res.data?.data || res.data || {};
                setResult(rawData);
                showAlert("Verification Successful", "BVN record verified successfully!", "success");

                const fullName = extractFullName(rawData, rawData.name);
                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'bvn_verification',
                    search_number: cleanBvn,
                    holder_name: fullName || 'BVN Holder',
                    details: rawData,
                });

                fetchWalletBalance();
                loadHistory();
            } else {
                showAlert("Verification Failed", res?.message || "BVN record not found.", "error");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred during verification.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePrintOrPdf = async () => {
        if (!result) return;
        setIsSaving(true);

        try {
            const fullName = `${result.firstName || result.first_name || ''} ${result.middleName || result.middle_name || ''} ${result.lastName || result.surname || ''}`.trim() || result.fullName || result.name || 'BVN Holder';
            const bvnNum = result.idNumber || result.bvn || bvn;
            const dob = result.dateOfBirth || result.dob || result.birthdate || 'N/A';
            const phone = result.mobile || result.phoneNumber1 || result.phoneNumber || result.phone || 'N/A';
            const gender = result.gender || 'N/A';
            const state = result.stateOfOrigin || result.state || 'N/A';
            const lga = result.lgaOfOrigin || result.lga || 'N/A';

            let photoHtml = `<div class="avatar-placeholder">${fullName.charAt(0)}</div>`;
            if (result.image || result.photo) {
                const photoSrc = (result.image || result.photo).startsWith('data:') ? (result.image || result.photo) : `data:image/jpeg;base64,${result.image || result.photo}`;
                photoHtml = `<img src="${photoSrc}" class="avatar-img" />`;
            }

            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; padding: 20px; }
                    .card { max-width: 440px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 2px solid #D4AF37; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                    .header { background: #0B192C; color: #ffffff; padding: 14px; text-align: center; border-bottom: 2px solid #D4AF37; }
                    .header h2 { margin: 0; font-size: 16px; color: #D4AF37; letter-spacing: 0.5px; }
                    .body { padding: 16px; display: flex; gap: 14px; }
                    .photo-box { width: 90px; height: 110px; border-radius: 6px; overflow: hidden; border: 1px solid #D4AF37; }
                    .avatar-img { width: 100%; height: 100%; object-fit: cover; }
                    .avatar-placeholder { width: 100%; height: 100%; background: #FEF9E7; color: #B45309; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; }
                    .details { flex: 1; }
                    .row { margin-bottom: 8px; }
                    .label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
                    .val { font-size: 13px; color: #0B192C; font-weight: bold; }
                    .bvn-val { color: #B45309; font-size: 15px; letter-spacing: 1px; }
                    .footer { background: #f8fafc; padding: 8px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h2>BANK VERIFICATION RECORD</h2>
                    </div>
                    <div class="body">
                        <div class="photo-box">${photoHtml}</div>
                        <div class="details">
                            <div class="row"><div class="label">Full Name</div><div class="val">${fullName}</div></div>
                            <div class="row"><div class="label">BVN Number</div><div class="val bvn-val">${bvnNum}</div></div>
                            <div class="row"><div class="label">Date of Birth / Gender</div><div class="val">${dob} • ${gender}</div></div>
                            <div class="row"><div class="label">Phone</div><div class="val">${phone}</div></div>
                            <div class="row"><div class="label">Origin</div><div class="val">${state} / ${lga}</div></div>
                        </div>
                    </div>
                    <div class="footer">Verified via Abu-Mafhal Gateway • Official Record</div>
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
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 22 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>INSTANT VERIFY</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>BVN Verification</Text>
                <Text style={styles.subText}>Verify 11-digit BVN and generate official record card</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Dial Helper */}
                <TouchableOpacity 
                    style={styles.dialHelper} 
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL('tel:*565*0%23')}
                >
                    <Ionicons name="phone-portrait-outline" size={15} color="#D4AF37" />
                    <Text style={styles.dialHelperText}>Forgot BVN? Dial <Text style={{ fontWeight: 'bold' }}>*565*0#</Text> from your registered SIM</Text>
                </TouchableOpacity>

                {/* Input Card */}
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>ENTER BVN NUMBER</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="finger-print-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="11-digit BVN"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={(t) => setBvn(t.replace(/\D/g, ''))}
                        />
                        <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn} activeOpacity={0.8}>
                            <Text style={styles.pasteBtnText}>Paste</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.verifyBtn, (loading || bvn.length !== 11) && { opacity: 0.6 }]}
                        onPress={handleVerify}
                        disabled={loading || bvn.length !== 11}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#0B192C" size="small" />
                        ) : (
                            <>
                                <Ionicons name="shield-checkmark" size={16} color="#0B192C" style={{ marginRight: 6 }} />
                                <Text style={styles.verifyBtnText}>Verify BVN Now</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Result Card */}
                {result && (
                    <View style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.resultHeaderText}>Verified BVN Record</Text>
                        </View>

                        {/* Photo Display */}
                        {(result.image || result.photo) && (
                            <View style={{ alignItems: 'center', marginVertical: 8 }}>
                                <View style={styles.photoContainer}>
                                    <Image
                                        source={{ uri: (result.image || result.photo).startsWith('data:') ? (result.image || result.photo) : `data:image/jpeg;base64,${result.image || result.photo}` }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="cover"
                                    />
                                </View>
                            </View>
                        )}

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Full Name:</Text>
                            <Text style={styles.detailVal}>
                                {`${result.firstName || result.first_name || ''} ${result.middleName || result.middle_name || ''} ${result.lastName || result.surname || ''}`.trim() || result.fullName || result.name || 'BVN Holder'}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>BVN Number:</Text>
                            <Text style={[styles.detailVal, { color: '#B45309', fontWeight: '900' }]}>{result.idNumber || result.bvn || bvn}</Text>
                        </View>

                        {result.nin && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>NIN Number:</Text>
                                <Text style={[styles.detailVal, { color: '#10B981', fontWeight: '800' }]}>{result.nin}</Text>
                            </View>
                        )}

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Date of Birth:</Text>
                            <Text style={styles.detailVal}>{result.dateOfBirth || result.dob || result.birthdate || 'N/A'}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Phone:</Text>
                            <Text style={styles.detailVal}>{result.mobile || result.phoneNumber1 || result.phoneNumber || result.phone || 'N/A'}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Gender:</Text>
                            <Text style={styles.detailVal}>{result.gender || 'N/A'}</Text>
                        </View>

                        <TouchableOpacity 
                            style={styles.printBtn} 
                            onPress={handlePrintOrPdf}
                            activeOpacity={0.8}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#0B192C" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="print-outline" size={16} color="#0B192C" style={{ marginRight: 6 }} />
                                    <Text style={styles.printBtnText}>Print Record / Save PDF</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* History Section */}
                {historyList.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.historyTitle}>Recent Verifications</Text>
                        {historyList.slice(0, 4).map((item) => (
                            <TouchableOpacity 
                                key={item.id || item.bvn} 
                                style={styles.historyItem}
                                activeOpacity={0.8}
                                onPress={() => {
                                    setBvn(item.bvn);
                                    if (item.data) setResult(item.data);
                                }}
                            >
                                <View>
                                    <Text style={styles.historyName}>{item.name || 'BVN Holder'}</Text>
                                    <Text style={styles.historyBvn}>{item.bvn}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            <BrandAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    badge: { backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    badgeText: { color: '#D4AF37', fontSize: 9, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    dialHelper: { backgroundColor: '#FEF9E7', padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    dialHelperText: { fontSize: 11, color: '#78350f', marginLeft: 6, flex: 1 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, height: 44, marginBottom: 12 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B192C' },
    pasteBtn: { backgroundColor: '#FEF9E7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    pasteBtnText: { fontSize: 10, fontWeight: '700', color: '#0B192C' },
    verifyBtn: { backgroundColor: '#D4AF37', height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    verifyBtnText: { color: '#0B192C', fontSize: 13, fontWeight: '800' },
    resultCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginBottom: 12 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultHeaderText: { fontSize: 13, fontWeight: '800', color: '#0B192C', marginLeft: 6 },
    photoContainer: { width: 70, height: 85, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: '#D4AF37', backgroundColor: '#e2e8f0' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 11, color: '#64748b' },
    detailVal: { fontSize: 11, fontWeight: '700', color: '#0B192C', maxWidth: '60%', textAlign: 'right' },
    printBtn: { backgroundColor: '#D4AF37', height: 40, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    printBtnText: { color: '#0B192C', fontSize: 12, fontWeight: '800' },
    historySection: { marginTop: 4 },
    historyTitle: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
    historyItem: { backgroundColor: '#ffffff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyName: { fontSize: 12, fontWeight: '700', color: '#0B192C' },
    historyBvn: { fontSize: 10, color: '#64748b', marginTop: 1 },
});
