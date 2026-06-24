import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ReceiptScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [transaction, setTransaction] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const viewShotRef = useRef<any>(null);

    useEffect(() => {
        if (id) {
            fetchTransaction();
        }
    }, [id]);

    const fetchTransaction = async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (data) {
                setTransaction(data);
            }
        } catch (error) {
            console.error('Error fetching transaction:', error);
        } finally {
            setLoading(false);
        }
    };

    const shareReceipt = async () => {
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Share Receipt',
                        UTI: 'public.png'
                    });
                }
            }
        } catch (error) {
            console.error('Error capturing receipt:', error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <ActivityIndicator size="large" color="#ffffff" />
            </SafeAreaView>
        );
    }

    if (!transaction) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <Ionicons name="warning-outline" size={60} color="#f5a623" style={{marginBottom: 20}} />
                <Text style={s.notFoundText}>Transaction not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Text style={s.backBtnText}>Return to History</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const amount = parseFloat(transaction.amount.toString());
    const isIncome = transaction.type === 'deposit' || amount > 0;
    const absAmount = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const formattedDate = new Date(transaction.created_at).toLocaleString([], { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });

    return (
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Background Gradient */}
            <LinearGradient
                colors={['#0d1b3e', '#09122a', '#050a17']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Decorative background shapes */}
            <View style={s.bgShape1} />
            <View style={s.bgShape2} />

            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>E-Receipt</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={s.receiptWrapper}>
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={s.viewShot}>
                    {/* The main receipt card */}
                    <View style={s.receiptCard}>
                        
                        {/* Watermark Logo */}
                        <View style={s.watermarkContainer}>
                            <Ionicons name="shield-checkmark" size={200} color="rgba(241, 245, 249, 0.4)" />
                        </View>

                        {/* Top Header Section */}
                        <View style={s.receiptTop}>
                            <View style={s.logoWrapper}>
                                <Ionicons name="shield-checkmark" size={32} color="#ffffff" />
                            </View>
                            <Text style={s.brandName}>ABU MAFHAL HUB</Text>
                            <Text style={s.receiptSubtitle}>OFFICIAL TRANSACTION RECEIPT</Text>
                        </View>

                        {/* Amount Section */}
                        <View style={s.amountSection}>
                            <Text style={s.amountLabel}>TRANSACTION AMOUNT</Text>
                            <Text style={[s.amountValue, isIncome ? s.amountPlus : s.amountMinus]}>
                                ₦{absAmount}
                            </Text>
                            <View style={[s.statusBadge, transaction.status === 'success' ? s.badgeSuccess : s.badgePending]}>
                                <Ionicons 
                                    name={transaction.status === 'success' ? 'checkmark-circle' : 'time'} 
                                    size={16} 
                                    color={transaction.status === 'success' ? '#059669' : '#d97706'} 
                                    style={{marginRight: 6}}
                                />
                                <Text style={[s.statusText, transaction.status === 'success' ? s.textSuccess : s.textPending]}>
                                    {transaction.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        {/* Premium Divider */}
                        <View style={s.dividerContainer}>
                            <View style={s.dividerCircleLeft} />
                            <View style={s.dividerDashedLine} />
                            <View style={s.dividerCircleRight} />
                        </View>

                        {/* Details Section */}
                        <View style={s.detailsSection}>
                            <DetailRow label="Transaction Type" value={transaction.type.toUpperCase()} />
                            <DetailRow label="Description" value={transaction.description || 'N/A'} />
                            <DetailRow label="Reference No" value={transaction.reference || transaction.id.substring(0, 12).toUpperCase()} copyable />
                            <DetailRow label="Date & Time" value={formattedDate} />
                            
                            {/* Barcode/QR Placeholder */}
                            <View style={s.barcodeSection}>
                                <Ionicons name="barcode-outline" size={50} color="#0d1b3e" />
                                <Text style={s.barcodeText}>{transaction.id.substring(0, 18).toUpperCase()}</Text>
                            </View>
                        </View>

                        {/* Footer */}
                        <View style={s.receiptFooter}>
                            <Text style={s.footerText}>Thank you for choosing Abu Mafhal Hub!</Text>
                            <Text style={s.footerSub}>support@abumafhalhub.com</Text>
                        </View>
                    </View>
                </ViewShot>
            </View>

            {/* Action Buttons */}
            <View style={s.bottomActions}>
                <TouchableOpacity style={s.shareBtn} onPress={shareReceipt} activeOpacity={0.8}>
                    <LinearGradient 
                        colors={['#f5a623', '#d97706']} 
                        style={s.shareBtnGradient}
                        start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                    >
                        <Ionicons name="share-social" size={22} color="#ffffff" />
                        <Text style={s.shareBtnText}>Share E-Receipt</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}

function DetailRow({ label, value, copyable }: { label: string, value: string, copyable?: boolean }) {
    return (
        <View style={s.detailRow}>
            <Text style={s.detailLabel}>{label}</Text>
            <View style={s.detailValueWrapper}>
                <Text style={s.detailValue}>{value}</Text>
                {copyable && <Ionicons name="copy-outline" size={14} color="#94a3b8" style={{marginLeft: 6}} />}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1b3e',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#0d1b3e',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    notFoundText: {
        fontSize: 18,
        color: '#ffffff',
        fontWeight: '700',
        marginBottom: 24,
    },
    bgShape1: {
        position: 'absolute',
        top: -100,
        left: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(245, 166, 35, 0.1)',
    },
    bgShape2: {
        position: 'absolute',
        bottom: -50,
        right: -50,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 1,
    },
    receiptWrapper: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 20,
        justifyContent: 'center',
    },
    viewShot: {
        backgroundColor: 'transparent',
    },
    receiptCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 30,
        elevation: 15,
    },
    watermarkContainer: {
        position: 'absolute',
        top: '30%',
        left: '10%',
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
        pointerEvents: 'none',
    },
    receiptTop: {
        alignItems: 'center',
        paddingTop: 36,
        paddingBottom: 20,
        backgroundColor: '#0d1b3e',
        zIndex: 1,
    },
    logoWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f5a623',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    brandName: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 6,
    },
    receiptSubtitle: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 3,
    },
    amountSection: {
        alignItems: 'center',
        paddingVertical: 36,
        backgroundColor: '#ffffff',
        zIndex: 1,
    },
    amountLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 12,
    },
    amountValue: {
        fontSize: 42,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: -1,
    },
    amountPlus: {
        color: '#10b981',
    },
    amountMinus: {
        color: '#0f172a',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 24,
    },
    badgeSuccess: {
        backgroundColor: '#d1fae5',
    },
    badgePending: {
        backgroundColor: '#fef3c7',
    },
    textSuccess: {
        color: '#059669',
        fontWeight: '800',
        fontSize: 13,
    },
    textPending: {
        color: '#d97706',
        fontWeight: '800',
        fontSize: 13,
    },
    dividerContainer: {
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        position: 'relative',
        zIndex: 1,
    },
    dividerCircleLeft: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#09122a', // Matches background
        position: 'absolute',
        left: -15,
    },
    dividerCircleRight: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#09122a', // Matches background
        position: 'absolute',
        right: -15,
    },
    dividerDashedLine: {
        flex: 1,
        height: 1,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        marginHorizontal: 24,
    },
    detailsSection: {
        padding: 28,
        backgroundColor: '#ffffff',
        zIndex: 1,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    detailLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
        flex: 1,
    },
    detailValueWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1.5,
        justifyContent: 'flex-end',
    },
    detailValue: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '800',
        textAlign: 'right',
    },
    barcodeSection: {
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    barcodeText: {
        fontSize: 11,
        letterSpacing: 4,
        color: '#64748b',
        marginTop: 6,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    receiptFooter: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#f8fafc',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        zIndex: 1,
    },
    footerText: {
        fontSize: 13,
        color: '#0d1b3e',
        fontWeight: '800',
        marginBottom: 4,
    },
    footerSub: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
    },
    bottomActions: {
        paddingHorizontal: 24,
        paddingBottom: 30,
    },
    shareBtn: {
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    shareBtnGradient: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareBtnText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
        marginLeft: 10,
    },
    backBtn: {
        paddingVertical: 14,
        paddingHorizontal: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    backBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    }
});
