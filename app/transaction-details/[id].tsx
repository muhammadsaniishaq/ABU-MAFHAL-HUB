import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
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
                <ActivityIndicator size="large" color="#0056D2" />
            </SafeAreaView>
        );
    }

    if (!transaction) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <Ionicons name="warning-outline" size={40} color="#C5A059" style={{marginBottom: 16}} />
                <Text style={s.notFoundText}>Transaction not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Text style={s.backBtnText}>Return</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const amount = parseFloat(transaction.amount.toString());
    const isIncome = transaction.type === 'deposit' || amount > 0;
    const absAmount = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const formattedDate = new Date(transaction.created_at).toLocaleString([], { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });

    return (
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="chevron-back" size={20} color="#0056D2" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>E-Receipt</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={s.receiptWrapper}>
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={s.viewShot}>
                    <View style={s.receiptCard}>
                        
                        {/* Receipt Top Section */}
                        <View style={s.receiptTop}>
                            <View style={s.logoWrapper}>
                                <Ionicons name="shield-checkmark" size={24} color="#0056D2" />
                            </View>
                            <Text style={s.brandName}>ABU MAFHAL HUB</Text>
                            <Text style={s.receiptSubtitle}>TRANSACTION RECEIPT</Text>
                        </View>

                        {/* Amount Section */}
                        <View style={s.amountSection}>
                            <Text style={s.amountLabel}>AMOUNT</Text>
                            <Text style={[s.amountValue, isIncome ? s.amountPlus : s.amountMinus]}>
                                ₦{absAmount}
                            </Text>
                            <View style={[s.statusBadge, transaction.status === 'success' ? s.badgeSuccess : s.badgePending]}>
                                <Text style={[s.statusText, transaction.status === 'success' ? s.textSuccess : s.textPending]}>
                                    {transaction.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={s.dividerContainer}>
                            <View style={s.dividerCircleLeft} />
                            <View style={s.dividerDashedLine} />
                            <View style={s.dividerCircleRight} />
                        </View>

                        {/* Details Section */}
                        <View style={s.detailsSection}>
                            <DetailRow label="Type" value={transaction.type.toUpperCase()} />
                            <DetailRow label="Description" value={transaction.description || 'N/A'} />
                            <DetailRow label="Ref" value={transaction.reference || transaction.id.substring(0, 10).toUpperCase()} />
                            <DetailRow label="Date" value={formattedDate} />
                        </View>

                        {/* Footer */}
                        <View style={s.receiptFooter}>
                            <Ionicons name="checkmark-circle" size={14} color="#107C10" />
                            <Text style={s.footerText}>Verified by ABU MAFHAL HUB</Text>
                        </View>
                    </View>
                </ViewShot>
            </View>

            {/* Action Buttons */}
            <View style={s.bottomActions}>
                <TouchableOpacity style={s.shareBtn} onPress={shareReceipt} activeOpacity={0.8}>
                    <LinearGradient 
                        colors={['#0056D2', '#1E40AF']} 
                        style={s.shareBtnGradient}
                        start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                    >
                        <Ionicons name="share-social" size={18} color="#ffffff" />
                        <Text style={s.shareBtnText}>Share Receipt</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

function DetailRow({ label, value }: { label: string, value: string }) {
    return (
        <View style={s.detailRow}>
            <Text style={s.detailLabel}>{label}</Text>
            <Text style={s.detailValue}>{value}</Text>
        </View>
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
        padding: 20,
    },
    notFoundText: {
        fontSize: 16,
        color: '#0F172A',
        fontWeight: '600',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    receiptWrapper: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    viewShot: {
        backgroundColor: 'transparent',
    },
    receiptCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    receiptTop: {
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 16,
        backgroundColor: '#F8FAFC',
    },
    logoWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    brandName: {
        color: '#0056D2',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4,
    },
    receiptSubtitle: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
    },
    amountSection: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: '#FFFFFF',
    },
    amountLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    amountPlus: {
        color: '#107C10',
    },
    amountMinus: {
        color: '#0F172A',
    },
    statusBadge: {
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeSuccess: {
        backgroundColor: '#DCFCE7',
    },
    badgePending: {
        backgroundColor: '#FEF3C7',
    },
    textSuccess: {
        color: '#15803D',
        fontWeight: '700',
        fontSize: 11,
    },
    textPending: {
        color: '#B45309',
        fontWeight: '700',
        fontSize: 11,
    },
    dividerContainer: {
        height: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        position: 'relative',
        zIndex: 1,
    },
    dividerCircleLeft: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        position: 'absolute',
        left: -10,
        borderRightWidth: 1,
        borderColor: '#E2E8F0',
    },
    dividerCircleRight: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        position: 'absolute',
        right: -10,
        borderLeftWidth: 1,
        borderColor: '#E2E8F0',
    },
    dividerDashedLine: {
        flex: 1,
        height: 1,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        marginHorizontal: 16,
    },
    detailsSection: {
        padding: 20,
        backgroundColor: '#FFFFFF',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    detailLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 12,
        color: '#0F172A',
        fontWeight: '700',
    },
    receiptFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: '#F1F5F9',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    footerText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginLeft: 6,
    },
    bottomActions: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    shareBtn: {
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    shareBtnGradient: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 8,
    },
    backBtn: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
    },
    backBtnText: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '600',
    }
});
