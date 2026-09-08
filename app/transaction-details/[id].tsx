import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
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
                <ActivityIndicator size="large" color="#0056D2" />
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
                {/* Moniepoint-Style Capture Container */}
                <ViewShot
                    ref={viewShotRef}
                    options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
                    style={s.mpReceiptCaptureWrap}
                >
                    {/* Centered Brand Capsule Pill */}
                    <View style={s.mpOuterHeader}>
                        <View style={s.mpBrandCapsule}>
                            <Image source={{ uri: ABU_MAFHAL_LOGO_B64 }} style={s.mpBrandMiniLogo} />
                            <Text style={s.mpBrandCapsuleText}>Abu Mafhal Hub</Text>
                        </View>
                    </View>

                    {/* White Ticket Card */}
                    <View style={s.mpTicketCard}>
                        {/* Ticket Header Row: DEBIT Badge & Brand Icon */}
                        <View style={s.mpTicketHeaderRow}>
                            <View style={[s.mpDebitBadge, !isDebit && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                <Text style={[s.mpDebitBadgeText, !isDebit && { color: '#059669' }]}>
                                    {isDebit ? 'DEBIT' : 'CREDIT'}
                                </Text>
                            </View>
                            <View style={s.mpBrandAvatarCircle}>
                                <Text style={s.mpBrandAvatarLetter}>M</Text>
                            </View>
                        </View>

                        {/* Amount Hero */}
                        <Text style={s.mpAmountHeroText}>₦{absAmount}</Text>

                        {/* Hairline Divider */}
                        <View style={s.mpDividerLine} />

                        {/* Ticket Details Inner Card (Label on top, Value directly beneath) */}
                        <View style={s.mpDetailsBox}>
                            {/* 1. Transaction Type */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Transaction Type</Text>
                                <View style={s.mpTypeTag}>
                                    <Text style={s.mpTypeTagText}>
                                        {transaction.type === 'p2p' ? 'Wallet Transfer' : (transaction.type ? transaction.type.toUpperCase() : 'TRANSFER')}
                                    </Text>
                                </View>
                            </View>

                            {/* 2. Sender Name */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Sender Name</Text>
                                <Text style={s.mpFieldValue}>{senderProfile?.full_name || 'Abu Mafhal User'}</Text>
                            </View>

                            {/* 3. Source Institution */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Source Institution</Text>
                                <Text style={s.mpFieldValue}>Abu Mafhal Hub Wallet</Text>
                            </View>

                            {/* 4. Beneficiary */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Beneficiary</Text>
                                <Text style={[s.mpFieldValue, { textTransform: 'uppercase' }]}>
                                    {beneficiary}
                                </Text>
                            </View>

                            {/* 5. Beneficiary Institution */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Beneficiary Institution</Text>
                                <Text style={s.mpFieldValue}>{bankName}</Text>
                            </View>

                            {/* 6. Transaction Date */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Transaction Date</Text>
                                <Text style={s.mpFieldValue}>{formatMoniepointDate(transaction.created_at)}</Text>
                            </View>

                            {/* 7. Transaction Reference */}
                            <View style={s.mpFieldBlock}>
                                <Text style={s.mpFieldLabel}>Transaction Reference</Text>
                                <TouchableOpacity
                                    onPress={() => handleCopyReference(receiptNo)}
                                    style={s.mpRefCopyRow}
                                    activeOpacity={0.7}
                                >
                                    <Text style={s.mpRefText} numberOfLines={1}>
                                        TRF|{receiptNo}
                                    </Text>
                                    <Ionicons name={copiedRef ? "checkmark-circle" : "copy-outline"} size={13} color="#0056D2" />
                                </TouchableOpacity>
                            </View>

                            {/* 8. Business Name / Narration */}
                            <View style={[s.mpFieldBlock, { marginBottom: 0 }]}>
                                <Text style={s.mpFieldLabel}>Business Name</Text>
                                <Text style={s.mpFieldValue}>{narration}</Text>
                            </View>
                        </View>

                        {/* Scalloped Perforated Ticket Teeth Cut at the Bottom */}
                        <View style={s.scallopsWrapper}>
                            {Array.from({ length: 18 }).map((_, idx) => (
                                <View key={idx} style={s.scallopCircle} />
                            ))}
                        </View>
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
        backgroundColor: '#F1F5F9',
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
        backgroundColor: '#0056D2',
        borderRadius: 12,
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

    /* Moniepoint Ticket Card Styles */
    mpReceiptCaptureWrap: {
        backgroundColor: '#0056D2',
        borderRadius: 20,
        paddingTop: 16,
        paddingHorizontal: 12,
        paddingBottom: 10,
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    mpOuterHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    mpBrandCapsule: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    mpBrandMiniLogo: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    mpBrandCapsuleText: {
        color: '#0056D2',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    mpTicketCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    mpTicketHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    mpDebitBadge: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        borderRadius: 6,
    },
    mpDebitBadgeText: {
        color: '#1D4ED8',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    mpBrandAvatarCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#0056D2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mpBrandAvatarLetter: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
    },
    mpAmountHeroText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#000000',
        letterSpacing: -0.5,
        marginBottom: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    mpDividerLine: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 14,
    },
    mpDetailsBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    mpFieldBlock: {
        marginBottom: 13,
    },
    mpFieldLabel: {
        fontSize: 11,
        color: '#8E9BAE',
        fontWeight: '600',
        marginBottom: 2,
    },
    mpFieldValue: {
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '800',
    },
    mpTypeTag: {
        alignSelf: 'flex-start',
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        borderRadius: 6,
        marginTop: 2,
    },
    mpTypeTagText: {
        color: '#0284C7',
        fontSize: 11.5,
        fontWeight: '800',
    },
    mpRefCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#CBD5E1',
        marginTop: 2,
    },
    mpRefText: {
        color: '#0F172A',
        fontSize: 10.5,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        flex: 1,
        marginRight: 6,
    },
    scallopsWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: -8,
        marginHorizontal: -16,
        overflow: 'hidden',
    },
    scallopCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#0056D2',
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
