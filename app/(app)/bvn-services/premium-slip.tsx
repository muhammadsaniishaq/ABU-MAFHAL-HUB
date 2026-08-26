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
import * as Print from 'expo-print';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';

import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

export default function BVNPremiumSlipScreen() {
    const insets = useSafeAreaInsets();
    const [bvn, setBvn] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);
    const [userDetails, setUserDetails] = useState<any>(null);
    const [showNoticeModal, setShowNoticeModal] = useState(false);
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
                if (data) setUserBalance(Number(data.balance));
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
    }, []);

    const showAlert = (title: string, message: string, type: AlertType = 'error') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const handleGenerateSlip = async () => {
        const cleanBvn = bvn.trim().replace(/\D/g, '');
        if (!cleanBvn || cleanBvn.length !== 11) {
            showAlert("Invalid BVN", "Please enter a valid 11-digit BVN number.");
            return;
        }

        if (userBalance !== null && userBalance < 50) {
            showAlert("Insufficient Balance", "Your account balance is insufficient. Please fund your wallet to continue.");
            return;
        }

        setLoading(true);
        setGeneratedPdf(null);
        setUserDetails(null);

        try {
            const res = await api.identity.generateBVNPremiumSlip(cleanBvn, 'bvn_premium_slip');
            
            const pdfBase64 = res?.pdf_base64 || res?.data?.pdf_base64 || res?.data?.data?.pdf_base64;
            const uData = res?.data?.user_details?.data || res?.data?.user_details || res?.data?.data?.user_details || res?.data?.data || res?.data;

            if (res && res.isValid && (pdfBase64 || uData)) {
                setGeneratedPdf(pdfBase64 || 'ready');
                setUserDetails(uData);
                showAlert("Slip Generated", "BVN Premium Slip generated successfully!", "success");
                
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
                showAlert("Generation Failed", res?.message || "Could not generate slip for this BVN.");
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
            if (generatedPdf !== 'ready' && generatedPdf.length > 50) {
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
                    return;
                } else {
                    const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                    const fileUri = `${docDir}bvn_premium_slip_${bvn || 'official'}.pdf`;
                    await FileSystem.writeAsStringAsync(fileUri, generatedPdf, { encoding: ((FileSystem as any).EncodingType?.Base64 || 'base64') as any });
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download BVN Premium Slip' });
                        return;
                    }
                }
            }

            // Fallback: Generate official printable slip
            const fn = userDetails?.firstName || userDetails?.first_name || '';
            const mn = userDetails?.middleName || userDetails?.middle_name || '';
            const ln = userDetails?.lastName || userDetails?.surname || '';
            const fullName = `${fn} ${mn} ${ln}`.trim() || userDetails?.fullName || userDetails?.name || 'BVN HOLDER';
            const bvnNum = userDetails?.idNumber || userDetails?.bvn || bvn;
            const dob = userDetails?.dateOfBirth || userDetails?.dob || userDetails?.birthday || 'N/A';
            const phone = userDetails?.mobile || userDetails?.phoneNumber || userDetails?.phone || 'N/A';
            const gender = userDetails?.gender || 'N/A';
            const rawImg = userDetails?.photo || userDetails?.image || '';
            const photoSrc = rawImg ? (rawImg.startsWith('data:') ? rawImg : `data:image/jpeg;base64,${rawImg}`) : '';

            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Official BVN Slip - ${bvnNum}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; padding: 24px 12px; color: #0B192C; }
                    .slip-container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 2.5px solid #D4AF37; box-shadow: 0 10px 25px rgba(0,0,0,0.12); overflow: hidden; position: relative; }
                    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 52px; font-weight: 900; color: rgba(212,175,55,0.06); letter-spacing: 6px; pointer-events: none; text-transform: uppercase; z-index: 0; }
                    .slip-header { background: linear-gradient(135deg, #0B192C 0%, #1a365d 100%); color: #ffffff; padding: 16px 14px; text-align: center; border-bottom: 3px solid #D4AF37; }
                    .slip-country { font-size: 11px; font-weight: 800; color: #D4AF37; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }
                    .slip-title { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; }
                    .slip-sub { font-size: 10px; color: #cbd5e1; margin-top: 3px; font-weight: 600; letter-spacing: 0.5px; }
                    .slip-body { padding: 18px 16px; display: flex; gap: 16px; position: relative; z-index: 1; }
                    .slip-photo-col { width: 120px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
                    .photo-frame { width: 110px; height: 130px; border-radius: 8px; border: 2px solid #D4AF37; background: #FEF9E7; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
                    .photo-img { width: 100%; height: 100%; object-fit: cover; }
                    .photo-placeholder { font-size: 36px; font-weight: 900; color: #B45309; }
                    .verified-badge { background: #FEF9E7; border: 1px solid #D4AF37; color: #B45309; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; text-align: center; width: 100%; }
                    .slip-info-col { flex: 1; display: flex; flex-direction: column; gap: 7px; }
                    .bvn-hero-box { background: #FEF9E7; border: 1.5px solid #D4AF37; border-radius: 8px; padding: 8px 12px; margin-bottom: 4px; }
                    .bvn-hero-label { font-size: 9px; font-weight: 800; color: #78350f; text-transform: uppercase; letter-spacing: 0.5px; }
                    .bvn-hero-val { font-size: 18px; font-weight: 900; color: #B45309; letter-spacing: 2px; }
                    .field-row { display: flex; flex-direction: column; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
                    .field-label { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
                    .field-val { font-size: 12px; font-weight: 800; color: #0B192C; margin-top: 1px; }
                    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                    .slip-footer { background: #f8fafc; border-top: 1.5px solid #e2e8f0; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; }
                    .seal-box { font-weight: 800; color: #0B192C; display: flex; align-items: center; gap: 4px; }
                </style>
            </head>
            <body>
                <div class="slip-container">
                    <div class="watermark">NIBSS BVN VERIFIED</div>
                    <div class="slip-header">
                        <div class="slip-country">FEDERAL REPUBLIC OF NIGERIA</div>
                        <div class="slip-title">BANK VERIFICATION NUMBER (BVN) ENROLMENT SLIP</div>
                        <div class="slip-sub">NIBSS CENTRAL REPOSITORY • OFFICIAL IDENTITY RECORD</div>
                    </div>
                    <div class="slip-body">
                        <div class="slip-photo-col">
                            <div class="photo-frame">
                                ${photoSrc ? `<img src="${photoSrc}" class="photo-img" />` : `<div class="photo-placeholder">${fullName.charAt(0)}</div>`}
                            </div>
                            <div class="verified-badge">✓ ACTIVE RECORD</div>
                        </div>
                        <div class="slip-info-col">
                            <div class="bvn-hero-box">
                                <div class="bvn-hero-label">Bank Verification Number (BVN)</div>
                                <div class="bvn-hero-val">${bvnNum}</div>
                            </div>
                            <div class="field-row">
                                <div class="field-label">Full Name (Surname First)</div>
                                <div class="field-val" style="text-transform: uppercase;">${fullName}</div>
                            </div>
                            <div class="field-grid">
                                <div class="field-row">
                                    <div class="field-label">Date of Birth</div>
                                    <div class="field-val">${dob}</div>
                                </div>
                                <div class="field-row">
                                    <div class="field-label">Gender</div>
                                    <div class="field-val" style="text-transform: uppercase;">${gender}</div>
                                </div>
                            </div>
                            <div class="field-row">
                                <div class="field-label">Phone Number</div>
                                <div class="field-val">${phone}</div>
                            </div>
                        </div>
                    </div>
                    <div class="slip-footer">
                        <div>Abu-Mafhal Hub • Gateway ID: NIBSS-${Date.now().toString(36).toUpperCase()}</div>
                        <div class="seal-box">★ OFFICIAL VERIFIED RECORD</div>
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
            showAlert("Download Error", e.message || "Failed to download slip.");
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
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 22 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.noticeBadge}
                        onPress={() => setShowNoticeModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="information-circle-outline" size={13} color="#D4AF37" style={{ marginRight: 3 }} />
                        <Text style={styles.noticeBadgeText}>Guidelines</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.titleText}>BVN Premium Slip</Text>
                <Text style={styles.subText}>Generate and download official PDF slips</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Form Card */}
                <View style={styles.formCard}>
                    <View style={styles.labelRow}>
                        <Text style={styles.inputLabel}>TARGET BVN NUMBER</Text>
                        <Text style={styles.digitCounter}>{bvn.length}/11 digits</Text>
                    </View>
                    <View style={styles.inputRow}>
                        <Ionicons name="document-text-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 11-digit BVN"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={11}
                            value={bvn}
                            onChangeText={(t) => setBvn(t.replace(/\D/g, ''))}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, (loading || bvn.length !== 11) && { opacity: 0.6 }]}
                        onPress={handleGenerateSlip}
                        disabled={loading || bvn.length !== 11}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#0B192C" size="small" />
                        ) : (
                            <>
                                <Ionicons name="document-attach" size={16} color="#0B192C" style={{ marginRight: 6 }} />
                                <Text style={styles.btnText}>Generate Premium Slip</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Generated Result Card */}
                {generatedPdf && (
                    <View style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.resultHeaderText}>Slip Ready for Download</Text>
                        </View>

                        {/* User Identity Snapshot */}
                        {userDetails && (
                            <View style={styles.userSnapshot}>
                                {userPhotoUri ? (
                                    <Image source={{ uri: userPhotoUri }} style={styles.userPhoto} />
                                ) : (
                                    <View style={[styles.userPhoto, styles.photoPlaceholder]}>
                                        <Ionicons name="person" size={26} color="#94a3b8" />
                                    </View>
                                )}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.userName} numberOfLines={1}>{`${userDetails.firstName || ''} ${userDetails.middleName || ''} ${userDetails.lastName || ''}`.trim() || userDetails.nameOnCard || 'BVN Holder'}</Text>
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
                            <Ionicons name="download-outline" size={16} color="#0B192C" style={{ marginRight: 6 }} />
                            <Text style={styles.downloadBtnText}>Download PDF Slip</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Track History Card */}
                <View style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                        <View style={styles.historyIconBox}>
                            <Ionicons name="time-outline" size={18} color="#D4AF37" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.historyTitle}>Slip History</Text>
                            <Text style={styles.historyDesc}>View past slips and re-download anytime.</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.historyBtn}
                        onPress={() => router.push('/(app)/bvn-services/history')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.historyBtnText}>Go to Slip History</Text>
                        <Ionicons name="arrow-forward" size={14} color="#0B192C" />
                    </TouchableOpacity>
                </View>

                {/* Guidelines Card */}
                <View style={styles.guidelinesCard}>
                    <View style={styles.guidelinesHeader}>
                        <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                        <Text style={styles.guidelinesHeaderText}>Important Guidelines</Text>
                    </View>
                    <Text style={styles.guidelineItem}>• Ensure the 11-digit BVN format is correct.</Text>
                    <Text style={styles.guidelineItem}>• Failed generation due to provider error is automatically refunded.</Text>
                    <Text style={styles.guidelineItem}>• Download the PDF immediately after generation.</Text>
                </View>
            </ScrollView>

            {/* Terms Modal */}
            <Modal
                visible={showNoticeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowNoticeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="document-text-outline" size={24} color="#D4AF37" />
                        </View>
                        <Text style={styles.modalTitle}>Important Notice</Text>
                        <Text style={styles.modalBody}>
                            You are generating an official <Text style={{ fontWeight: 'bold', color: '#0B192C' }}>BVN Premium Slip</Text> for the provided Bank Verification Number.
                        </Text>
                        
                        <View style={styles.calloutBox}>
                            <Text style={styles.calloutText}>
                                Your wallet will only be charged upon successful generation.
                            </Text>
                        </View>

                        <Text style={[styles.modalBody, { marginTop: 6 }]}>
                            Once generated, download the PDF immediately or access it from your Slip History.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalBtn}
                            onPress={() => setShowNoticeModal(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalBtnText}>I Understand</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
    noticeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    noticeBadgeText: { color: '#D4AF37', fontSize: 10, fontWeight: '700' },
    titleText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', letterSpacing: 0.3 },
    digitCounter: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, height: 44, marginBottom: 12 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B192C' },
    btn: { backgroundColor: '#D4AF37', height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#0B192C', fontSize: 13, fontWeight: '800' },
    resultCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginBottom: 12 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    resultHeaderText: { fontSize: 13, fontWeight: '800', color: '#10B981', marginLeft: 6 },
    userSnapshot: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    userPhoto: { width: 54, height: 64, borderRadius: 6, backgroundColor: '#e2e8f0' },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    userName: { fontSize: 13, fontWeight: '800', color: '#0B192C' },
    userBvn: { fontSize: 11, fontWeight: '700', color: '#B45309', marginTop: 1 },
    userDetailRow: { fontSize: 10, color: '#64748b', marginTop: 1 },
    downloadBtn: { backgroundColor: '#D4AF37', height: 40, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    downloadBtnText: { color: '#0B192C', fontSize: 12, fontWeight: '800' },
    historyCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    historyCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    historyIconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FEF9E7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    historyTitle: { fontSize: 12, fontWeight: '800', color: '#0B192C' },
    historyDesc: { fontSize: 10, color: '#64748b', marginTop: 1 },
    historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF9E7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    historyBtnText: { fontSize: 11, fontWeight: '700', color: '#0B192C' },
    guidelinesCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    guidelinesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    guidelinesHeaderText: { fontSize: 11, fontWeight: '800', color: '#475569', marginLeft: 4 },
    guidelineItem: { fontSize: 10, color: '#64748b', lineHeight: 15, marginBottom: 3 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, alignItems: 'center' },
    modalIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF9E7', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#0B192C', marginBottom: 4 },
    modalBody: { fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 16 },
    calloutBox: { backgroundColor: '#FEF9E7', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, padding: 8, marginVertical: 8, width: '100%' },
    calloutText: { fontSize: 10, fontWeight: '700', color: '#B45309', textAlign: 'center', lineHeight: 14 },
    modalBtn: { backgroundColor: '#0B192C', width: '100%', height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    modalBtnText: { color: '#D4AF37', fontSize: 12, fontWeight: '800' },
});
