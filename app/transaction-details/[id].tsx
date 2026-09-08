import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import ViewShot from 'react-native-view-shot';
import * as Clipboard from 'expo-clipboard';
import { ABU_MAFHAL_LOGO_B64 } from '../../assets/images/logoB64';
import { formatMoniepointDate, shareReceiptFile, downloadReceiptAsPDF } from '../../services/receiptGenerator';

const { width } = Dimensions.get('window');

function parseTransactionDetails(tx: any) {
    let beneficiary = 'Abu Mafhal Member';
    let bankName = 'Abu Mafhal Hub Wallet';
    let narration = tx.description || 'Abu Mafhal Instant Settlement';

    if (tx.description) {
        const desc = String(tx.description);
        const parenMatch = desc.match(/\((.*?)\)/);
        if (parenMatch) {
            const inner = parenMatch[1];
            if (inner.includes('-')) {
                const parts = inner.split('-');
                bankName = parts[0].trim();
            } else {
                bankName = inner.trim();
            }
        }

        const toMatch = desc.match(/to\s+([^(]+)/i);
        if (toMatch && toMatch[1]) {
            beneficiary = toMatch[1].trim();
        } else {
            beneficiary = desc.replace(/^Transfer\s+/i, '').trim();
        }
    }

    if (tx.type === 'deposit') {
        beneficiary = 'Wallet Funding';
        bankName = 'Virtual Account Deposit';
    } else if (tx.type === 'withdrawal') {
        if (!bankName || bankName === 'Abu Mafhal Hub Wallet') {
            bankName = 'Bank Settlement';
        }
    }

    return { beneficiary, bankName, narration };
}

export default function ReceiptScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [transaction, setTransaction] = useState<any>(null);
    const [senderProfile, setSenderProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copiedRef, setCopiedRef] = useState(false);
    const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const viewShotRef = useRef<any>(null);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch transaction
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (txData) {
                setTransaction(txData);

                // Fetch sender name from profiles
                if (txData.user_id) {
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('full_name, phone_number, email')
                        .eq('id', txData.user_id)
                        .single();
                    if (prof) setSenderProfile(prof);
                }
            }
        } catch (error) {
            console.error('Error fetching receipt data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyReference = async (refStr: string) => {
        if (!refStr) return;
        try {
            await Clipboard.setStringAsync(refStr);
            setCopiedRef(true);
            setTimeout(() => setCopiedRef(false), 2200);
        } catch (_) {}
    };

    const handleShareWhatsApp = async () => {
        if (!transaction) return;
        setIsSharingWhatsApp(true);
        try {
            let customUri = '';
            if (viewShotRef.current?.capture) {
                try {
                    customUri = await viewShotRef.current.capture();
                } catch (_) {}
            }

            const { beneficiary, bankName, narration } = parseTransactionDetails(transaction);
            await shareReceiptFile(
                {
                    reference: transaction.reference || transaction.id.substring(0, 12).toUpperCase(),
                    type: transaction.type,
                    description: transaction.description || '',
                    amount: transaction.amount,
                    status: transaction.status,
                    date: transaction.created_at,
                    beneficiary,
                    recipientName: beneficiary,
                    bankName,
                    senderName: senderProfile?.full_name || 'Abu Mafhal User',
                    notes: narration,
                },
                customUri ? 'png' : 'pdf',
                customUri
            );
        } catch (err) {
            console.error('WhatsApp share error:', err);
        } finally {
            setIsSharingWhatsApp(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!transaction) return;
        setIsDownloadingPdf(true);
        try {
            const { beneficiary, bankName, narration } = parseTransactionDetails(transaction);
            await downloadReceiptAsPDF({
                reference: transaction.reference || transaction.id.substring(0, 12).toUpperCase(),
                type: transaction.type,
                description: transaction.description || '',
                amount: transaction.amount,
                status: transaction.status,
                date: transaction.created_at,
                beneficiary,
                recipientName: beneficiary,
                bankName,
                senderName: senderProfile?.full_name || 'Abu Mafhal User',
                notes: narration,
            });
        } catch (err) {
            console.error('Download PDF error:', err);
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <ActivityIndicator size="large" color="#D97706" />
            </SafeAreaView>
        );
    }

    if (!transaction) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <Ionicons name="warning-outline" size={42} color="#F59E0B" style={{ marginBottom: 16 }} />
                <Text style={s.notFoundText}>Transaction not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Text style={s.backBtnText}>Return to Previous</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const amountNum = parseFloat(transaction.amount?.toString() || '0');
    const isDebit = transaction.type !== 'deposit' && amountNum <= 0;
    const absAmount = Math.abs(amountNum).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const receiptNo = transaction.reference || transaction.id.substring(0, 12).toUpperCase();
    const { beneficiary, bankName, narration } = parseTransactionDetails(transaction);

    return (
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Top Navigation Bar */}
            <View style={s.appHeader}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <Text style={s.appHeaderTitle}>Transaction Receipt</Text>
                <TouchableOpacity onPress={handleShareWhatsApp} style={s.iconButton} activeOpacity={0.7}>
                    <Ionicons name="share-social-outline" size={20} color="#0F172A" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Abu Mafhal Luxury Receipt Container */}
                <ViewShot
                    ref={viewShotRef}
                    options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
                    style={s.receiptCaptureWrap}
                >
                    {/* Brand Header */}
                    <View style={s.receiptHeaderBrand}>
                        <View style={s.receiptBrandLeft}>
                            <Image source={{ uri: ABU_MAFHAL_LOGO_B64 }} style={s.receiptLogoImg} />
                            <View>
                                <Text style={s.receiptBrandTitle}>ABU MAFHAL HUB</Text>
                                <Text style={s.receiptBrandSub}>PREMIUM DIGITAL INFRASTRUCTURE</Text>
                            </View>
                        </View>
                        <View style={s.receiptVerifiedSeal}>
                            <View style={s.sealGreenDot} />
                            <Text style={s.receiptVerifiedSealText}>VERIFIED</Text>
                        </View>
                    </View>

                    {/* Midnight Obsidian Amount Card */}
                    <View style={s.detailAmountCard}>
                        <View style={s.amountCardTopRow}>
                            <View style={[s.debitPillTag, !isDebit && { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.5)' }]}>
                                <Text style={[s.debitPillText, !isDebit && { color: '#34D399' }]}>
                                    {isDebit ? 'DEBIT' : 'CREDIT'}
                                </Text>
                            </View>
                            <View style={s.statusSuccessTag}>
                                <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                                <Text style={s.statusSuccessText}>SUCCESSFUL</Text>
                            </View>
                        </View>

                        {/* Amount Hero */}
                        <Text style={s.detailAmountText}>₦{absAmount}</Text>
                        <Text style={s.detailAmountSubBreakdown}>Audited Electronic Settlement • 100% Guaranteed</Text>
                    </View>

                    {/* Details Information Card (Label on top, Bold Value directly beneath) */}
                    <View style={s.detailInfoCard}>
                        {/* 1. Transaction Type */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Transaction Type</Text>
                            <View style={s.typeTagPill}>
                                <Text style={s.typeTagText}>
                                    {transaction.type === 'p2p' ? 'P2P Wallet Transfer' : (transaction.type ? transaction.type.toUpperCase() : 'TRANSFER')}
                                </Text>
                            </View>
                        </View>

                        {/* 2. Sender Name */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Sender Name</Text>
                            <Text style={s.fieldValue}>{senderProfile?.full_name || 'Abu Mafhal User'}</Text>
                        </View>

                        {/* 3. Source Institution */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Source Institution</Text>
                            <Text style={s.fieldValue}>Abu Mafhal Hub Wallet</Text>
                        </View>

                        {/* 4. Beneficiary */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Beneficiary</Text>
                            <Text style={[s.fieldValue, { textTransform: 'uppercase' }]}>
                                {beneficiary}
                            </Text>
                        </View>

                        {/* 5. Beneficiary Institution */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Beneficiary Institution</Text>
                            <Text style={s.fieldValue}>{bankName}</Text>
                        </View>

                        {/* 6. Transaction Date */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Transaction Date</Text>
                            <Text style={s.fieldValue}>{formatMoniepointDate(transaction.created_at)}</Text>
                        </View>

                        {/* 7. Transaction Reference */}
                        <View style={s.fieldBlock}>
                            <Text style={s.fieldLabel}>Transaction Reference</Text>
                            <TouchableOpacity
                                onPress={() => handleCopyReference(receiptNo)}
                                style={s.refCopyRow}
                                activeOpacity={0.7}
                            >
                                <Text style={s.refText} numberOfLines={1}>
                                    TRF|{receiptNo}
                                </Text>
                                <Ionicons name={copiedRef ? "checkmark-circle" : "copy-outline"} size={13} color="#D97706" />
                            </TouchableOpacity>
                        </View>

                        {/* 8. Business Name / Narration */}
                        <View style={[s.fieldBlock, { marginBottom: 0 }]}>
                            <Text style={s.fieldLabel}>Business Name / Narration</Text>
                            <Text style={s.fieldValue}>{narration}</Text>
                        </View>
                    </View>

                    {/* Security Notice Row */}
                    <View style={s.securityNoticeRow}>
                        <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                        <Text style={s.securityNoticeText}>
                            Audited Proof of Payment • ABU MAFHAL LTD (RC-8979939)
                        </Text>
                    </View>
                </ViewShot>

                {/* Action Buttons Column */}
                <View style={s.actionsCol}>
                    <TouchableOpacity
                        onPress={handleDownloadPdf}
                        style={s.pdfReceiptBtn}
                        activeOpacity={0.85}
                        disabled={isDownloadingPdf}
                    >
                        {isDownloadingPdf ? (
                            <ActivityIndicator size="small" color="#0F172A" />
                        ) : (
                            <>
                                <Ionicons name="download-outline" size={16} color="#0F172A" />
                                <Text style={s.pdfReceiptBtnText}>Download Official Receipt (PDF / PNG)</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleShareWhatsApp}
                        style={s.whatsappSupportBtn}
                        activeOpacity={0.85}
                        disabled={isSharingWhatsApp}
                    >
                        {isSharingWhatsApp ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                                <Text style={s.whatsappSupportBtnText}>Share on WhatsApp (PDF / PNG File)</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleCopyReference(receiptNo)}
                        style={s.copyRefBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={copiedRef ? "checkmark-circle" : "copy-outline"} size={15} color="#0F172A" />
                        <Text style={s.copyRefBtnText}>{copiedRef ? 'Reference Copied!' : 'Copy Transaction Reference'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.closeSheetBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={s.closeSheetBtnText}>Back to Transactions</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notFoundText: {
        fontSize: 16,
        color: '#0F172A',
        fontWeight: '700',
        marginBottom: 16,
    },
    backBtn: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#0F172A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DAA520',
    },
    backBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    appHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
    },
    appHeaderTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0F172A',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
    },

    /* Abu Mafhal Luxury Receipt Card Styles */
    receiptCaptureWrap: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    receiptHeaderBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 10,
    },
    receiptBrandLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    receiptLogoImg: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DAA520',
    },
    receiptBrandTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 0.5,
    },
    receiptBrandSub: {
        fontSize: 8,
        fontWeight: '800',
        color: '#D97706',
        letterSpacing: 0.5,
        marginTop: 1,
    },
    receiptVerifiedSeal: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: '#A7F3D0',
    },
    sealGreenDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
    },
    receiptVerifiedSealText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#059669',
        letterSpacing: 0.5,
    },
    detailAmountCard: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.45)',
        marginBottom: 10,
    },
    amountCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 6,
    },
    debitPillTag: {
        backgroundColor: 'rgba(217, 119, 6, 0.2)',
        borderWidth: 0.8,
        borderColor: 'rgba(245, 158, 11, 0.5)',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6,
    },
    debitPillText: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    statusSuccessTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 0.8,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 12,
    },
    statusSuccessText: {
        color: '#34D399',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    detailAmountText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        marginBottom: 2,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    detailAmountSubBreakdown: {
        fontSize: 9,
        color: '#CBD5E1',
        fontWeight: '600',
        marginTop: 2,
    },
    detailInfoCard: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    fieldBlock: {
        marginBottom: 10,
    },
    fieldLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 2,
    },
    fieldValue: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '800',
    },
    typeTagPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#FEF3C7',
        borderWidth: 0.5,
        borderColor: '#FDE68A',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 5,
        marginTop: 2,
    },
    typeTagText: {
        color: '#B45309',
        fontSize: 11,
        fontWeight: '800',
    },
    refCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#CBD5E1',
        marginTop: 2,
    },
    refText: {
        color: '#0F172A',
        fontSize: 10.5,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        flex: 1,
        marginRight: 6,
    },
    securityNoticeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        marginTop: 2,
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    securityNoticeText: {
        fontSize: 8.5,
        fontWeight: '700',
        color: '#64748B',
    },

    /* Action Buttons */
    actionsCol: {
        gap: 8,
        marginTop: 2,
        marginBottom: 20,
    },
    pdfReceiptBtn: {
        backgroundColor: '#FFD700',
        height: 42,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#DAA520',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    pdfReceiptBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    copyRefBtn: {
        backgroundColor: '#FFFFFF',
        height: 40,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    copyRefBtnText: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '800',
    },
    whatsappSupportBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#25D366',
        borderWidth: 1,
        height: 40,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    whatsappSupportBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '900',
    },
    closeSheetBtn: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeSheetBtnText: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '800',
    },
});
