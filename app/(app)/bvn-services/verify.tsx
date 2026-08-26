import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet, Linking, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';
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
    const [servicePrice, setServicePrice] = useState<number>(200);
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

    const fetchServicePrice = async () => {
        try {
            const { data } = await supabase
                .from('service_pricing')
                .select('cost_price, markup_price, selling_price')
                .eq('id', 'bvn_num_advanced')
                .maybeSingle();
            if (data) {
                const total = data.selling_price ? Number(data.selling_price) : (Number(data.cost_price || 0) + Number(data.markup_price || 0));
                if (total > 0) setServicePrice(total);
            }
        } catch (e) {
            console.warn('Failed to load BVN price', e);
        }
    };

    const loadHistory = async () => {
        try {
            const list = await verificationHistory.getAll('bvn');
            const stored = await AsyncStorage.getItem('recent_bvn_verifications');
            const localList = stored ? JSON.parse(stored) : [];

            const combinedMap = new Map();

            for (const item of localList) {
                const bvnNum = item.bvn || item.data?.idNumber || item.data?.bvn || item.id;
                if (bvnNum) {
                    combinedMap.set(bvnNum, item);
                }
            }

            if (list && list.length > 0) {
                for (const item of list) {
                    const bvnNum = item.search_number || item.details?.idNumber || item.details?.bvn || item.id;
                    combinedMap.set(bvnNum, {
                        id: item.id,
                        bvn: bvnNum,
                        name: item.holder_name,
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
        fetchServicePrice();
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

        if (userBalance !== null && userBalance < servicePrice) {
            showAlert("Insufficient Balance", `Your balance is ₦${userBalance.toLocaleString()}. Required fee is ₦${servicePrice.toLocaleString()}. Please fund your wallet.`, "error");
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

    const convertPdfBase64ToPng = async (pdfBase64: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined') return reject(new Error("Web only"));

            const runConversion = async () => {
                try {
                    const pdfjsLib = (window as any).pdfjsLib;
                    if (!pdfjsLib) return reject(new Error("pdf.js library not loaded"));
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                    const binaryString = atob(pdfBase64);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    const loadingTask = pdfjsLib.getDocument({ data: bytes });
                    const pdf = await loadingTask.promise;
                    const numPages = pdf.numPages;

                    const pages: { canvas: HTMLCanvasElement; width: number; height: number }[] = [];
                    let totalHeight = 0;
                    let maxWidth = 0;

                    for (let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 3.0 });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            await page.render({ canvasContext: ctx, viewport }).promise;
                            pages.push({ canvas, width: viewport.width, height: viewport.height });
                            totalHeight += viewport.height + (i > 1 ? 20 : 0);
                            maxWidth = Math.max(maxWidth, viewport.width);
                        }
                    }

                    if (pages.length === 0) return reject(new Error("No pages rendered"));

                    const mergedCanvas = document.createElement('canvas');
                    mergedCanvas.width = maxWidth;
                    mergedCanvas.height = totalHeight;
                    const mergedCtx = mergedCanvas.getContext('2d');
                    if (!mergedCtx) return reject(new Error("Canvas context creation failed"));

                    mergedCtx.fillStyle = '#ffffff';
                    mergedCtx.fillRect(0, 0, maxWidth, totalHeight);

                    let currentY = 0;
                    for (let i = 0; i < pages.length; i++) {
                        const { canvas, width, height } = pages[i];
                        const x = Math.floor((maxWidth - width) / 2);
                        mergedCtx.drawImage(canvas, x, currentY);
                        currentY += height + 20;
                    }

                    resolve(mergedCanvas.toDataURL('image/png'));
                } catch (err) {
                    reject(err);
                }
            };

            if ((window as any).pdfjsLib) {
                runConversion();
            } else {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = () => runConversion();
                script.onerror = (e) => reject(e);
                document.head.appendChild(script);
            }
        });
    };

    const handleDownloadPdf = async () => {
        if (!result) return;
        setIsSaving(true);
        try {
            const pdfBase64 = result.pdf_base64 || result.data?.pdf_base64 || result.data?.data?.pdf_base64;
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
                    link.download = `bvn_premium_slip_${bvn || 'official'}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                    showAlert("Download Complete", "Official BVN Premium Slip PDF downloaded.", "success");
                    return;
                } else {
                    const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                    const fileUri = `${docDir}bvn_premium_slip_${bvn || 'official'}.pdf`;
                    await FileSystem.writeAsStringAsync(fileUri, pdfBase64, { encoding: ((FileSystem as any).EncodingType?.Base64 || 'base64') as any });
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download Official BVN Slip (PDF)' });
                    } else {
                        showAlert("Downloaded", `PDF saved to device.`, "success");
                    }
                    return;
                }
            }

            // Fallback: Trigger Print or PDF generation
            await handlePrintOrPdf();
        } catch (e: any) {
            showAlert("Download Error", e.message || "Failed to download PDF slip.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPng = async () => {
        if (!result) return;
        setIsSaving(true);
        try {
            const pdfBase64 = result.pdf_base64 || result.data?.pdf_base64 || result.data?.data?.pdf_base64;
            if (pdfBase64 && Platform.OS === 'web') {
                try {
                    const pngDataUrl = await convertPdfBase64ToPng(pdfBase64);
                    const link = document.createElement('a');
                    link.download = `bvn_slip_${bvn || 'official'}.png`;
                    link.href = pngDataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showAlert("Download Complete", "Official BVN Slip PNG downloaded successfully.", "success");
                    return;
                } catch (err: any) {
                    console.warn("PDF to PNG conversion failed, falling back to print:", err);
                }
            }

            await handlePrintOrPdf();
        } catch (e: any) {
            showAlert("PNG Download Failed", e.message || "Failed to generate PNG image.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrintOrPdf = async () => {
        if (!result) return;
        setIsSaving(true);

        try {
            const fn = result.firstName || result.first_name || '';
            const mn = result.middleName || result.middle_name || '';
            const ln = result.lastName || result.surname || '';
            const fullName = `${fn} ${mn} ${ln}`.trim() || result.fullName || result.name || 'BVN HOLDER';
            const bvnNum = result.idNumber || result.bvn || bvn;
            const ninNum = result.nin || 'N/A';
            const dob = result.dateOfBirth || result.dob || result.birthdate || 'N/A';
            const phone = result.mobile || result.phoneNumber1 || result.phoneNumber || result.phone || 'N/A';
            const gender = result.gender || 'N/A';
            const state = result.stateOfOrigin || result.state || 'N/A';
            const lga = result.lgaOfOrigin || result.lga || 'N/A';
            const rawImg = result.image || result.photo || '';
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
            showAlert("Print Error", e.message || "Failed to generate print slip.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        if (!text) return;
        try {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            }
            showAlert("Copied", `BVN ${text} copied to clipboard!`, "info");
        } catch (_) {}
    };

    const fn = result?.firstName || result?.first_name || '';
    const mn = result?.middleName || result?.middle_name || '';
    const ln = result?.lastName || result?.surname || '';
    const displayFullName = `${fn} ${mn} ${ln}`.trim() || result?.fullName || result?.name || 'BVN HOLDER';
    const displayBvn = result?.idNumber || result?.bvn || bvn;
    const rawPhoto = result?.image || result?.photo || '';
    const photoUri = rawPhoto ? (rawPhoto.startsWith('data:') ? rawPhoto : `data:image/jpeg;base64,${rawPhoto}`) : null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header in Deep Navy & Gold */}
            <LinearGradient
                colors={['#0B192C', '#1E3E62']}
                style={[styles.headerGradient, { paddingTop: Platform.OS === 'ios' ? 8 : 12, paddingBottom: 16 }]}
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
                <Text style={styles.subText}>Official Bank Verification Number Record</Text>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.inputLabel}>ENTER BVN NUMBER</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9E7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#B45309' }}>Fee: ₦{servicePrice.toLocaleString()}</Text>
                        </View>
                    </View>
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
                                <Text style={styles.verifyBtnText}>Verify BVN (₦{servicePrice.toLocaleString()})</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Authentic Official BVN Slip / Card Design */}
                {result && (
                    <View style={styles.officialSlipCard}>
                        {/* Official Slip Top Header Bar */}
                        <View style={styles.slipTopHeader}>
                            <View style={styles.slipHeaderFlagRow}>
                                <View style={styles.coatOfArmsBox}>
                                    <Ionicons name="shield" size={16} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.slipCountryText}>FEDERAL REPUBLIC OF NIGERIA</Text>
                                    <Text style={styles.slipMainTitle}>BANK VERIFICATION NUMBER SLIP</Text>
                                    <Text style={styles.slipSubTitle}>NIBSS CENTRAL REPOSITORY • OFFICIAL RECORD</Text>
                                </View>
                            </View>
                        </View>

                        {/* Slip Body with Authentic Dual-Column Layout */}
                        <View style={styles.slipBody}>
                            {/* Left Column: Official Passport Photo & Security Marks */}
                            <View style={styles.slipPhotoCol}>
                                <View style={styles.officialPhotoFrame}>
                                    {photoUri ? (
                                        <Image
                                            source={{ uri: photoUri }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.photoFallback}>
                                            <Text style={styles.photoFallbackLetter}>{displayFullName.charAt(0)}</Text>
                                            <Ionicons name="person" size={20} color="#D4AF37" />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.activeStatusPill}>
                                    <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                                    <Text style={styles.activeStatusText}>VERIFIED</Text>
                                </View>

                                {/* Barcode Mockup */}
                                <View style={styles.barcodeBox}>
                                    <View style={styles.barcodeBars} />
                                </View>
                            </View>

                            {/* Right Column: Structured Identity Data */}
                            <View style={styles.slipDataCol}>
                                {/* BVN Primary Hero Card */}
                                <TouchableOpacity 
                                    style={styles.bvnHeroContainer}
                                    onPress={() => copyToClipboard(displayBvn)}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.bvnHeroLabel}>BVN NUMBER</Text>
                                        <Text style={styles.bvnHeroText}>{displayBvn}</Text>
                                    </View>
                                    <Ionicons name="copy-outline" size={16} color="#B45309" />
                                </TouchableOpacity>

                                {/* Full Name */}
                                <View style={styles.officialFieldRow}>
                                    <Text style={styles.officialFieldLabel}>FULL NAME</Text>
                                    <Text style={styles.officialFieldVal}>{displayFullName.toUpperCase()}</Text>
                                </View>

                                {/* 2-Col Grid: NIN & DOB */}
                                <View style={styles.twoColGrid}>
                                    <View style={[styles.officialFieldRow, { flex: 1 }]}>
                                        <Text style={styles.officialFieldLabel}>NIN NUMBER</Text>
                                        <Text style={[styles.officialFieldVal, { color: '#10B981' }]}>{result.nin || 'N/A'}</Text>
                                    </View>
                                    <View style={[styles.officialFieldRow, { flex: 1 }]}>
                                        <Text style={styles.officialFieldLabel}>DATE OF BIRTH</Text>
                                        <Text style={styles.officialFieldVal}>{result.dateOfBirth || result.dob || result.birthdate || 'N/A'}</Text>
                                    </View>
                                </View>

                                {/* 2-Col Grid: Gender & Phone */}
                                <View style={styles.twoColGrid}>
                                    <View style={[styles.officialFieldRow, { flex: 1 }]}>
                                        <Text style={styles.officialFieldLabel}>GENDER</Text>
                                        <Text style={styles.officialFieldVal}>{(result.gender || 'N/A').toUpperCase()}</Text>
                                    </View>
                                    <View style={[styles.officialFieldRow, { flex: 1 }]}>
                                        <Text style={styles.officialFieldLabel}>PHONE</Text>
                                        <Text style={styles.officialFieldVal}>{result.mobile || result.phoneNumber1 || result.phoneNumber || result.phone || 'N/A'}</Text>
                                    </View>
                                </View>

                                {/* Origin */}
                                <View style={[styles.officialFieldRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                                    <Text style={styles.officialFieldLabel}>STATE / LGA</Text>
                                    <Text style={styles.officialFieldVal}>{result.stateOfOrigin || result.state || 'N/A'} / {result.lgaOfOrigin || result.lga || 'N/A'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Official Slip Footer Bar */}
                        <View style={styles.slipFooterBar}>
                            <Text style={styles.slipFooterRef}>REF: NIBSS-{Date.now().toString(36).toUpperCase()}</Text>
                            <View style={styles.securitySealBadge}>
                                <Ionicons name="ribbon" size={12} color="#B45309" />
                                <Text style={styles.securitySealText}>AUTHENTIC RECORD</Text>
                            </View>
                        </View>

                        {/* Action Buttons Suite */}
                        <View style={styles.actionBtnContainer}>
                            <View style={styles.actionBtnRow}>
                                <TouchableOpacity 
                                    style={styles.downloadPdfBtn} 
                                    onPress={handleDownloadPdf}
                                    activeOpacity={0.8}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#0B192C" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="document-text" size={15} color="#0B192C" style={{ marginRight: 5 }} />
                                            <Text style={styles.downloadPdfBtnText}>Download PDF</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.downloadPngBtn} 
                                    onPress={handleDownloadPng}
                                    activeOpacity={0.8}
                                    disabled={isSaving}
                                >
                                    <Ionicons name="image" size={15} color="#D4AF37" style={{ marginRight: 5 }} />
                                    <Text style={styles.downloadPngBtnText}>Download PNG</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.actionBtnRow, { marginTop: 6 }]}>
                                <TouchableOpacity 
                                    style={styles.printSlipBtn} 
                                    onPress={handlePrintOrPdf}
                                    activeOpacity={0.8}
                                    disabled={isSaving}
                                >
                                    <Ionicons name="print-outline" size={14} color="#0B192C" style={{ marginRight: 5 }} />
                                    <Text style={styles.printSlipBtnText}>Print Official Slip</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.copyOfficialBtn} 
                                    onPress={() => copyToClipboard(displayBvn)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="copy-outline" size={14} color="#D4AF37" style={{ marginRight: 4 }} />
                                    <Text style={styles.copyOfficialBtnText}>Copy BVN</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
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
    formCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, height: 44, marginBottom: 12 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B192C' },
    pasteBtn: { backgroundColor: '#FEF9E7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    pasteBtnText: { fontSize: 10, fontWeight: '700', color: '#0B192C' },
    verifyBtn: { backgroundColor: '#D4AF37', height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    verifyBtnText: { color: '#0B192C', fontSize: 13, fontWeight: '800' },

    // Official Authentic BVN Slip Styles
    officialSlipCard: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 2, borderColor: '#D4AF37', overflow: 'hidden', marginBottom: 16, shadowColor: '#0B192C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    slipTopHeader: { backgroundColor: '#0B192C', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: '#D4AF37' },
    slipHeaderFlagRow: { flexDirection: 'row', alignItems: 'center' },
    coatOfArmsBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    slipCountryText: { color: '#D4AF37', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
    slipMainTitle: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 0.3, marginTop: 1 },
    slipSubTitle: { color: '#94a3b8', fontSize: 8, fontWeight: '600', marginTop: 1 },
    slipBody: { flexDirection: 'row', padding: 14, gap: 12, backgroundColor: '#ffffff' },
    slipPhotoCol: { width: 84, alignItems: 'center' },
    officialPhotoFrame: { width: 84, height: 102, borderRadius: 8, borderWidth: 1.5, borderColor: '#D4AF37', overflow: 'hidden', backgroundColor: '#FEF9E7', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    photoFallbackLetter: { fontSize: 28, fontWeight: '900', color: '#B45309', marginBottom: 2 },
    activeStatusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0', marginTop: 6, gap: 3 },
    activeStatusText: { fontSize: 8, fontWeight: '800', color: '#065f46' },
    barcodeBox: { width: 80, height: 20, backgroundColor: '#f8fafc', borderRadius: 3, marginTop: 6, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 2 },
    barcodeBars: { height: 14, width: '100%', backgroundColor: '#0B192C', opacity: 0.7 },
    slipDataCol: { flex: 1 },
    bvnHeroContainer: { backgroundColor: '#FEF9E7', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    bvnHeroLabel: { fontSize: 8, fontWeight: '800', color: '#78350f', letterSpacing: 0.5 },
    bvnHeroText: { fontSize: 14, fontWeight: '900', color: '#B45309', letterSpacing: 1 },
    officialFieldRow: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 4, marginBottom: 4 },
    officialFieldLabel: { fontSize: 7.5, fontWeight: '800', color: '#64748b', letterSpacing: 0.3 },
    officialFieldVal: { fontSize: 11, fontWeight: '800', color: '#0B192C', marginTop: 1 },
    twoColGrid: { flexDirection: 'row', gap: 8 },
    slipFooterBar: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    slipFooterRef: { fontSize: 8, fontWeight: '700', color: '#94a3b8' },
    securitySealBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    securitySealText: { fontSize: 8, fontWeight: '800', color: '#B45309' },
    actionBtnContainer: { padding: 10, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    actionBtnRow: { flexDirection: 'row', gap: 8 },
    downloadPdfBtn: { flex: 1, backgroundColor: '#D4AF37', height: 38, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
    downloadPdfBtnText: { color: '#0B192C', fontSize: 12, fontWeight: '800' },
    downloadPngBtn: { flex: 1, backgroundColor: '#0B192C', height: 38, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D4AF37' },
    downloadPngBtnText: { color: '#D4AF37', fontSize: 12, fontWeight: '800' },
    printSlipBtn: { flex: 1, backgroundColor: '#ffffff', height: 36, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
    printSlipBtnText: { color: '#0B192C', fontSize: 11, fontWeight: '700' },
    copyOfficialBtn: { backgroundColor: '#ffffff', paddingHorizontal: 12, height: 36, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
    copyOfficialBtnText: { color: '#475569', fontSize: 11, fontWeight: '700' },

    historySection: { marginTop: 4 },
    historyTitle: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
    historyItem: { backgroundColor: '#ffffff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyName: { fontSize: 12, fontWeight: '700', color: '#0B192C' },
    historyBvn: { fontSize: 10, color: '#64748b', marginTop: 1 },
});
