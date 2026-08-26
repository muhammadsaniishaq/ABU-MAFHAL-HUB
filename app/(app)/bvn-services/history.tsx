import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';
import * as Print from 'expo-print';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function BVNHistoryScreen() {
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionId, setActionId] = useState<string | null>(null);
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

    const showAlert = (title: string, message: string, type: AlertType = 'error') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            const list = await verificationHistory.getAll('bvn');
            const formatted = list.map((item: any) => {
                const raw = item.details?.data?.data || item.details?.data || item.details || {};
                const bvnNum = item.search_number || raw.idNumber || raw.bvn || item.details?.bvn || item.id;
                const fullName = extractFullName(raw, item.holder_name || item.name);
                return {
                    id: item.id,
                    bvn: bvnNum,
                    name: fullName,
                    service_type: item.service_type || 'bvn_verification',
                    date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently',
                    data: raw,
                    pdf_base64: item.details?.pdf_base64 || raw.pdf_base64,
                };
            });

            setHistory(formatted);
        } catch (e) {
            console.warn('Failed to load BVN history', e);
        } finally {
            setLoading(false);
        }
    };

    const getOfficialHtml = (item: any) => {
        const raw = item.data || {};
        const fn = raw.firstName || raw.first_name || '';
        const mn = raw.middleName || raw.middle_name || '';
        const ln = raw.lastName || raw.surname || '';
        const fullName = `${fn} ${mn} ${ln}`.trim() || raw.fullName || raw.name || item.name || 'BVN HOLDER';
        const bvnNum = raw.idNumber || raw.bvn || item.bvn || 'N/A';
        const ninNum = raw.nin || 'N/A';
        const dob = raw.dateOfBirth || raw.dob || raw.birthdate || 'N/A';
        const phone = raw.mobile || raw.phoneNumber1 || raw.phoneNumber || raw.phone || 'N/A';
        const gender = raw.gender || 'N/A';
        const state = raw.stateOfOrigin || raw.state || 'N/A';
        const lga = raw.lgaOfOrigin || raw.lga || 'N/A';
        const rawImg = raw.image || raw.photo || '';
        const photoSrc = rawImg ? (rawImg.startsWith('data:') ? rawImg : `data:image/jpeg;base64,${rawImg}`) : '';

        return `
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
                .slip-header { background: linear-gradient(135deg, #0B192C 0%, #1a365d 100%); color: #ffffff; padding: 16px 14px; text-align: center; border-bottom: 3px solid #D4AF37; position: relative; z-index: 1; }
                .slip-country { font-size: 11px; font-weight: 800; color: #D4AF37; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }
                .slip-title { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; }
                .slip-sub { font-size: 10px; color: #cbd5e1; margin-top: 3px; font-weight: 600; letter-spacing: 0.5px; }
                .slip-body { padding: 18px 16px; position: relative; z-index: 1; display: flex; gap: 16px; }
                .slip-photo-col { width: 120px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
                .photo-frame { width: 110px; height: 130px; border-radius: 8px; border: 2px solid #D4AF37; background: #FEF9E7; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.06); margin-bottom: 8px; }
                .photo-img { width: 100%; height: 100%; object-fit: cover; }
                .photo-placeholder { font-size: 36px; font-weight: 900; color: #B45309; }
                .verified-badge { background: #FEF9E7; border: 1px solid #D4AF37; color: #B45309; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; text-align: center; width: 100%; }
                .barcode-mock { width: 100%; height: 28px; background: repeating-linear-gradient(90deg, #0B192C 0, #0B192C 2px, transparent 2px, transparent 4px, #0B192C 4px, #0B192C 7px, transparent 7px, transparent 9px); margin-top: 8px; opacity: 0.75; }
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
                        <div class="barcode-mock"></div>
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
                                <div class="field-label">National Identity No (NIN)</div>
                                <div class="field-val" style="color: #10B981;">${ninNum}</div>
                            </div>
                            <div class="field-row">
                                <div class="field-label">Date of Birth</div>
                                <div class="field-val">${dob}</div>
                            </div>
                        </div>
                        <div class="field-grid">
                            <div class="field-row">
                                <div class="field-label">Gender</div>
                                <div class="field-val" style="text-transform: uppercase;">${gender}</div>
                            </div>
                            <div class="field-row">
                                <div class="field-label">Phone Number</div>
                                <div class="field-val">${phone}</div>
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field-label">State / LGA of Origin</div>
                            <div class="field-val">${state} / ${lga}</div>
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
    };

    const handlePrintSlip = async (item: any) => {
        setActionId(item.id || item.bvn);
        try {
            const html = getOfficialHtml(item);
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
            showAlert("Print Error", e.message || "Failed to print verification slip.", "error");
        } finally {
            setActionId(null);
        }
    };

    const handleDownloadPdf = async (item: any) => {
        setActionId(item.id || item.bvn);
        try {
            const pdfBase64 = item.pdf_base64 || item.data?.pdf_base64;
            if (pdfBase64 && pdfBase64.length > 50) {
                if (Platform.OS === 'web') {
                    const byteCharacters = atob(pdfBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `bvn_slip_${item.bvn || 'official'}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                    showAlert("Download Complete", "Official BVN Slip PDF downloaded.", "success");
                    return;
                } else {
                    const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                    const fileUri = `${docDir}bvn_slip_${item.bvn || 'official'}.pdf`;
                    await FileSystem.writeAsStringAsync(fileUri, pdfBase64, { encoding: ((FileSystem as any).EncodingType?.Base64 || 'base64') as any });
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download BVN Slip' });
                    }
                    return;
                }
            }

            // Fallback: Print/Generate PDF
            await handlePrintSlip(item);
        } catch (e: any) {
            showAlert("Download Error", e.message || "Failed to download PDF slip.", "error");
        } finally {
            setActionId(null);
        }
    };

    const handleDeleteItem = (item: any) => {
        Alert.alert(
            "Delete Record",
            `Remove record for ${item.name || item.bvn} from history?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await verificationHistory.delete(item.id);
                        setHistory(prev => prev.filter(x => x.id !== item.id));
                    }
                }
            ]
        );
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const filtered = history.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.bvn && item.bvn.includes(query))
        );
    });

    const handleClearHistory = () => {
        Alert.alert(
            "Clear History",
            "Are you sure you want to clear your local BVN history?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem('recent_bvn_verifications');
                        setHistory([]);
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 20 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    {history.length > 0 && (
                        <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={13} color="#ef4444" />
                            <Text style={styles.clearBtnText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={styles.titleText}>BVN History</Text>
                <Text style={styles.subText}>View past verified records and reprints</Text>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Name or BVN..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={15} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
                {loading ? (
                    <ActivityIndicator size="small" color="#D4AF37" style={{ marginTop: 30 }} />
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="folder-open-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No Verification History</Text>
                        <Text style={styles.emptyDesc}>All verified BVN records will appear here for free reprinting.</Text>
                    </View>
                ) : (
                    filtered.map((item) => (
                        <TouchableOpacity
                            key={item.id || item.bvn}
                            style={styles.card}
                            activeOpacity={0.8}
                            onPress={() => router.push({
                                pathname: '/(app)/bvn-services/verify',
                                params: { bvnNumber: item.bvn }
                            })}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="finger-print-outline" size={18} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.holderName} numberOfLines={1}>{item.name || 'BVN Holder'}</Text>
                                    <Text style={styles.bvnNumber}>{item.bvn}</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.deleteMiniBtn}
                                    activeOpacity={0.7}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDeleteItem(item);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={14} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.cardFooter}>
                                <Text style={styles.dateText}>{item.date || 'Recently'}</Text>
                                <View style={styles.cardActionGroup}>
                                    <TouchableOpacity 
                                        style={styles.downloadPdfBadge}
                                        activeOpacity={0.7}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDownloadPdf(item);
                                        }}
                                        disabled={actionId === (item.id || item.bvn)}
                                    >
                                        {actionId === (item.id || item.bvn) ? (
                                            <ActivityIndicator size="small" color="#0B192C" />
                                        ) : (
                                            <>
                                                <Ionicons name="document-text-outline" size={12} color="#0B192C" />
                                                <Text style={styles.downloadPdfBadgeText}>PDF</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={styles.reprintBadge}
                                        activeOpacity={0.7}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handlePrintSlip(item);
                                        }}
                                        disabled={actionId === (item.id || item.bvn)}
                                    >
                                        <Ionicons name="print-outline" size={12} color="#D4AF37" />
                                        <Text style={styles.reprintText}>Print</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
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
    clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    clearBtnText: { color: '#f87171', fontSize: 10, fontWeight: '700', marginLeft: 3 },
    titleText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, height: 38 },
    searchInput: { flex: 1, fontSize: 12, color: '#0B192C' },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 14, fontWeight: '800', color: '#475569', marginTop: 10 },
    emptyDesc: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4, lineHeight: 16 },
    card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF9E7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    holderName: { fontSize: 13, fontWeight: '800', color: '#0B192C' },
    bvnNumber: { fontSize: 11, color: '#B45309', marginTop: 1, fontWeight: '700' },
    deleteMiniBtn: { padding: 6, borderRadius: 6, backgroundColor: '#f1f5f9' },
    cardActionGroup: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    downloadPdfBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4AF37', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    downloadPdfBadgeText: { fontSize: 10, fontWeight: '800', color: '#0B192C', marginLeft: 3 },
    reprintBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B192C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#D4AF37' },
    reprintText: { fontSize: 10, fontWeight: '700', color: '#D4AF37', marginLeft: 3 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    dateText: { fontSize: 10, color: '#94a3b8' },
    statusPill: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusText: { fontSize: 9, fontWeight: '800', color: '#15803d' },
});
