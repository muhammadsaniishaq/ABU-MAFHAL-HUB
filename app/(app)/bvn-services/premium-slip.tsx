import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal, Image, StyleSheet } from 'react-native';
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
    const [userDetails, setUserDetails] = useState<any>(null);
    const [showNoticeModal, setShowNoticeModal] = useState(false);

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
            showAlert("Invalid BVN", "Please enter a valid 11-digit BVN number.");
            return;
        }

        if (userBalance !== null && userBalance < 200) {
            showAlert("Insufficient Balance", "Your account balance is insufficient (₦200.00 required) to generate BVN Premium Slip.");
            return;
        }

        setLoading(true);
        setGeneratedPdf(null);
        setUserDetails(null);

        try {
            const res = await api.identity.generateBVNPremiumSlip(cleanBvn, 'bvn_premium_slip');
            
            const pdfBase64 = res?.data?.pdf_base64 || res?.data?.data?.pdf_base64;
            const uData = res?.data?.user_details?.data || res?.data?.user_details || res?.data?.data?.user_details || res?.data;

            if (res && res.isValid && pdfBase64) {
                setGeneratedPdf(pdfBase64);
                setUserDetails(uData);
                showAlert("Slip Generated", "BVN Premium Slip generated successfully!", "success");
                
                // Save history
                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: 'bvn_premium_slip',
                    search_number: cleanBvn,
                    holder_name: `${uData?.firstName || ''} ${uData?.lastName || ''}`.trim() || extractFullName(res.data) || 'BVN Holder',
                    details: {
                        ...res.data,
                        bvn: cleanBvn,
                        pdf_base64: pdfBase64,
                        generatedAt: new Date().toISOString()
                    },
                });
                fetchWalletBalance();
            } else {
                showAlert("Generation Failed", res?.message || "The server could not generate the slip for this BVN.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while connecting to the server.");
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

    let userPhotoUri: string | null = null;
    if (userDetails?.photo) {
        userPhotoUri = userDetails.photo.startsWith('data:') ? userDetails.photo : `data:image/jpeg;base64,${userDetails.photo}`;
    }

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
                    <TouchableOpacity 
                        style={styles.noticeBadge}
                        onPress={() => setShowNoticeModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                        <Text style={styles.noticeBadgeText}>Notice & Rules</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>BVN Premium Slip</Text>
                <Text style={styles.subText}>Generate and download official BVN premium slips instantly</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Form Card */}
                <View style={styles.formCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={styles.inputLabel}>TARGET BVN NUMBER</Text>
                        <Text style={styles.digitCounter}>{bvn.length}/11 digits</Text>
                    </View>
                    <View style={styles.inputRow}>
                        <Ionicons name="document-text-outline" size={20} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter the 11-digit BVN"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={(t) => setBvn(t.replace(/\D/g, ''))}
                        />
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Generation Charge:</Text>
                        <Text style={styles.costVal}>₦200.00</Text>
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
                                <Text style={styles.btnText}>Generate Premium Slip</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Generated Result Card */}
                {generatedPdf && (
                    <View style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Ionicons name="checkmark-circle" size={24} color="#059669" />
                            <Text style={styles.resultHeaderText}>Official Slip Generated</Text>
                        </View>

                        {/* User Identity Snapshot */}
                        {userDetails && (
                            <View style={styles.userSnapshot}>
                                {userPhotoUri ? (
                                    <Image source={{ uri: userPhotoUri }} style={styles.userPhoto} />
                                ) : (
                                    <View style={[styles.userPhoto, styles.photoPlaceholder]}>
                                        <Ionicons name="person" size={32} color="#94a3b8" />
                                    </View>
                                )}
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={styles.userName}>{`${userDetails.firstName || ''} ${userDetails.middleName || ''} ${userDetails.lastName || ''}`.trim() || userDetails.nameOnCard || 'BVN Holder'}</Text>
                                    <Text style={styles.userBvn}>BVN: {userDetails.bvn || bvn}</Text>
                                    {userDetails.phoneNumber ? (
                                        <Text style={styles.userDetailRow}>Phone: {userDetails.phoneNumber}</Text>
                                    ) : null}
                                    {userDetails.gender ? (
                                        <Text style={styles.userDetailRow}>Gender: {userDetails.gender}</Text>
                                    ) : null}
                                    {userDetails.birthday ? (
                                        <Text style={styles.userDetailRow}>DOB: {userDetails.birthday}</Text>
                                    ) : null}
                                </View>
                            </View>
                        )}

                        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPdf} activeOpacity={0.8}>
                            <Ionicons name="download" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.downloadBtnText}>Download PDF Slip Now</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Track History Card */}
                <View style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                        <View style={styles.historyIconBox}>
                            <Ionicons name="document-text-outline" size={20} color="#0284c7" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.historyTitle}>Track Your History</Text>
                            <Text style={styles.historyDesc}>Monitor your previously generated slips securely from your history log. You can re-download PDFs here at any time.</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.historyBtn}
                        onPress={() => router.push('/(app)/bvn-services/history')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.historyBtnText}>Go to Slip History</Text>
                        <Ionicons name="arrow-forward" size={16} color="#0284c7" />
                    </TouchableOpacity>
                </View>

                {/* Guidelines Card */}
                <View style={styles.guidelinesCard}>
                    <View style={styles.guidelinesHeader}>
                        <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                        <Text style={styles.guidelinesHeaderText}>Important Guidelines</Text>
                    </View>
                    <Text style={styles.guidelineItem}>• Ensure the 11-digit BVN format is completely correct before submitting.</Text>
                    <Text style={styles.guidelineItem}>• If we fail to generate the slip due to a database error, your wallet will be instantly refunded.</Text>
                    <Text style={styles.guidelineItem}>• Please download the PDF immediately upon successful generation.</Text>
                </View>
            </ScrollView>

            {/* Important Notice Modal */}
            <Modal
                visible={showNoticeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowNoticeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="document-text" size={28} color="#0284c7" />
                        </View>
                        <Text style={styles.modalTitle}>Important Notice</Text>
                        <Text style={styles.modalBody}>
                            You are about to generate a <Text style={{ fontWeight: 'bold' }}>BVN Premium Slip</Text> for the provided Bank Verification Number.
                        </Text>
                        
                        <View style={styles.calloutBox}>
                            <Text style={styles.calloutText}>
                                Your wallet will only be charged if the slip is successfully generated by the database.
                            </Text>
                        </View>

                        <Text style={[styles.modalBody, { marginTop: 10 }]}>
                            Once generated, click the download button immediately to save your PDF slip to your device. You can also re-download it from your History.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setShowNoticeModal(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalBtnText}>I Understand & Agree</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    noticeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#38bdf8' },
    noticeBadgeText: { color: '#7dd3fc', fontSize: 11, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569' },
    digitCounter: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 16, fontWeight: '900', color: '#0284c7' },
    btn: { backgroundColor: '#0284c7', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    resultCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 16 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    resultHeaderText: { fontSize: 14, fontWeight: '800', color: '#059669', marginLeft: 8 },
    userSnapshot: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    userPhoto: { width: 64, height: 76, borderRadius: 8, backgroundColor: '#e2e8f0' },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    userName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    userBvn: { fontSize: 12, fontWeight: '700', color: '#0284c7', marginTop: 2 },
    userDetailRow: { fontSize: 11, color: '#64748b', marginTop: 2 },
    downloadBtn: { backgroundColor: '#0284c7', height: 44, paddingHorizontal: 20, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    downloadBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
    historyCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    historyCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    historyIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
    historyTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    historyDesc: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 2 },
    historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0f9ff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
    historyBtnText: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
    guidelinesCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    guidelinesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    guidelinesHeaderText: { fontSize: 12, fontWeight: '800', color: '#475569', marginLeft: 6 },
    guidelineItem: { fontSize: 11, color: '#64748b', lineHeight: 17, marginBottom: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
    modalIconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
    modalBody: { fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 18 },
    calloutBox: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 8, padding: 10, marginVertical: 10, width: '100%' },
    calloutText: { fontSize: 11, fontWeight: '700', color: '#0369a1', textAlign: 'center', lineHeight: 16 },
    modalBtn: { backgroundColor: '#0284c7', width: '100%', height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    modalBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
