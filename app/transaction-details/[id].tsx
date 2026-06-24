import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

// Brand Colors
const NAVY = '#0d1b3e';
const GOLD = '#f5a623';

export default function ReceiptScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [transaction, setTransaction] = useState<any>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
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
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (txData) setTransaction(txData);

            // Fetch dynamic logo from app_settings
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('key, value');
            
            if (settingsData) {
                // Try fetching logo_icon first, else full banner, or fallback
                const iconSetting = settingsData.find(s => s.key === 'app_logo_icon');
                if (iconSetting?.value?.url) {
                    setLogoUrl(iconSetting.value.url);
                } else {
                    const logoSetting = settingsData.find(s => s.key === 'app_logo');
                    if (logoSetting?.value?.url) {
                        setLogoUrl(logoSetting.value.url);
                    }
                }
            }

        } catch (error) {
            console.error('Error fetching data:', error);
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
                <ActivityIndicator size="large" color={NAVY} />
            </SafeAreaView>
        );
    }

    if (!transaction) {
        return (
            <SafeAreaView style={s.centerContainer}>
                <Ionicons name="warning-outline" size={40} color={GOLD} style={{marginBottom: 16}} />
                <Text style={s.notFoundText}>Transaction not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Text style={s.backBtnText}>Return</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const amount = parseFloat(transaction.amount.toString());
    const absAmount = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const formattedDate = new Date(transaction.created_at).toLocaleDateString([], { 
        year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    const formattedTime = new Date(transaction.created_at).toLocaleTimeString([], { 
        hour: '2-digit', minute: '2-digit' 
    });

    const receiptNo = transaction.reference || transaction.id.substring(0, 8).toUpperCase();

    return (
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={s.appHeader}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="chevron-back" size={24} color={NAVY} />
                </TouchableOpacity>
                <Text style={s.appHeaderTitle}>Transaction Receipt</Text>
                <TouchableOpacity onPress={shareReceipt} style={s.iconButton}>
                    <Ionicons name="share-outline" size={22} color={NAVY} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={s.receiptWrapper}>
                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={s.viewShot}>
                        <View style={s.receiptCard}>
                            
                            {/* Top Brand Bar */}
                            <View style={s.topBar} />

                            <View style={s.receiptInner}>
                                {/* Header Section */}
                                <View style={s.headerSection}>
                                    <View style={s.logoSide}>
                                        <View style={s.logoCircle}>
                                            {logoUrl ? (
                                                <Image source={{ uri: logoUrl }} style={s.dynamicLogo} resizeMode="contain" />
                                            ) : (
                                                <Ionicons name="shield-checkmark" size={28} color="#ffffff" />
                                            )}
                                        </View>
                                        <Text style={s.receiptTitle}>Receipt</Text>
                                    </View>
                                    <View style={s.companySide}>
                                        <Text style={s.companyName}>ABU MAFHAL HUB</Text>
                                        <Text style={s.companyAddress}>Digital Services</Text>
                                        <Text style={s.companyAddress}>support@abumafhalhub.com</Text>
                                    </View>
                                </View>

                                {/* Info Section */}
                                <View style={s.infoSection}>
                                    <View style={s.infoLeft}>
                                        <Text style={s.infoLabel}>BILLED TO:</Text>
                                        <Text style={s.infoValueBold}>Customer</Text>
                                        <Text style={s.infoValue}>User ID: {transaction.user_id.substring(0,8)}...</Text>
                                    </View>
                                    <View style={s.infoRight}>
                                        <View style={s.infoRow}>
                                            <Text style={s.infoLabelRight}>RECEIPT #</Text>
                                            <Text style={s.infoValueRight}>{receiptNo}</Text>
                                        </View>
                                        <View style={s.infoRow}>
                                            <Text style={s.infoLabelRight}>DATE</Text>
                                            <Text style={s.infoValueRight}>{formattedDate}</Text>
                                        </View>
                                        <View style={s.infoRow}>
                                            <Text style={s.infoLabelRight}>TIME</Text>
                                            <Text style={s.infoValueRight}>{formattedTime}</Text>
                                        </View>
                                        <View style={s.infoRow}>
                                            <Text style={s.infoLabelRight}>STATUS</Text>
                                            <Text style={[s.infoValueRight, {color: transaction.status === 'success' ? '#107C10' : GOLD, fontWeight: '700'}]}>
                                                {transaction.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Table Section */}
                                <View style={s.tableContainer}>
                                    {/* Table Header */}
                                    <View style={s.tableHeader}>
                                        <Text style={[s.thText, {flex: 2}]}>DESCRIPTION</Text>
                                        <Text style={[s.thText, {flex: 1, textAlign: 'center'}]}>TYPE</Text>
                                        <Text style={[s.thText, {flex: 1, textAlign: 'right'}]}>AMOUNT</Text>
                                    </View>
                                    
                                    {/* Table Row */}
                                    <View style={s.tableRow}>
                                        <Text style={[s.tdText, {flex: 2, fontWeight: '500'}]}>{transaction.description || 'Transaction'}</Text>
                                        <Text style={[s.tdText, {flex: 1, textAlign: 'center', textTransform: 'capitalize'}]}>{transaction.type}</Text>
                                        <Text style={[s.tdText, {flex: 1, textAlign: 'right'}]}>₦{absAmount}</Text>
                                    </View>
                                </View>

                                {/* Summary Section */}
                                <View style={s.summarySection}>
                                    <View style={s.notesArea}>
                                        <Text style={s.notesLabel}>NOTES:</Text>
                                        <Text style={s.notesText}>This is an electronically generated receipt and does not require a physical signature.</Text>
                                    </View>
                                    <View style={s.totalArea}>
                                        <Text style={s.totalLabel}>TOTAL</Text>
                                        <Text style={s.totalValue}>₦{absAmount}</Text>
                                    </View>
                                </View>

                            </View>

                            {/* Footer Bar */}
                            <View style={s.footerBar}>
                                <Text style={s.footerText}>Powered by <Text style={{fontWeight: '800'}}>ABU MAFHAL HUB</Text></Text>
                            </View>

                        </View>
                    </ViewShot>
                </View>

                {/* Main Action Button */}
                <TouchableOpacity style={s.downloadBtn} onPress={shareReceipt} activeOpacity={0.8}>
                    <Ionicons name="download-outline" size={20} color="#ffffff" style={{marginRight: 8}} />
                    <Text style={s.downloadBtnText}>Download Receipt</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9', // Light grayish-blue background outside the receipt
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notFoundText: {
        fontSize: 16,
        color: NAVY,
        fontWeight: '600',
        marginBottom: 16,
    },
    backBtn: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
    },
    backBtnText: {
        color: NAVY,
        fontSize: 14,
        fontWeight: '600',
    },
    appHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 15,
        backgroundColor: '#F1F5F9',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    appHeaderTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: NAVY,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    receiptWrapper: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 20,
    },
    viewShot: {
        backgroundColor: '#F1F5F9', // Matches outer background so corners look clean
    },
    receiptCard: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 6,
        // Modern sharp-yet-smooth look
        borderRadius: 8,
    },
    topBar: {
        height: 12,
        backgroundColor: NAVY, // Primary Brand Color
        width: '100%',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    receiptInner: {
        padding: 24,
    },
    headerSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 40,
    },
    logoSide: {
        alignItems: 'flex-start',
    },
    logoCircle: {
        width: 56,
        height: 56,
        backgroundColor: '#ffffff',
        borderRadius: 12, 
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: NAVY,
        overflow: 'hidden',
    },
    dynamicLogo: {
        width: '100%',
        height: '100%',
    },
    receiptTitle: {
        fontSize: 32,
        fontWeight: '300',
        color: NAVY,
        letterSpacing: -1,
    },
    companySide: {
        alignItems: 'flex-end',
    },
    companyName: {
        fontSize: 16,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 4,
    },
    companyAddress: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 2,
    },
    infoSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    infoLeft: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 11,
        color: NAVY,
        fontWeight: '800',
        marginBottom: 8,
    },
    infoValueBold: {
        fontSize: 14,
        fontWeight: '700',
        color: NAVY,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 2,
    },
    infoRight: {
        flex: 1,
        alignItems: 'flex-end',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 6,
        width: '100%',
    },
    infoLabelRight: {
        fontSize: 11,
        color: NAVY,
        fontWeight: '800',
        marginRight: 16,
        textAlign: 'right',
    },
    infoValueRight: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'right',
        minWidth: 80,
    },
    tableContainer: {
        marginBottom: 40,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: NAVY,
        paddingBottom: 8,
        marginBottom: 16,
    },
    thText: {
        fontSize: 11,
        color: NAVY,
        fontWeight: '800',
    },
    tableRow: {
        flexDirection: 'row',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    tdText: {
        fontSize: 13,
        color: '#475569',
    },
    summarySection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: 10,
        marginBottom: 20,
    },
    notesArea: {
        flex: 1.5,
        paddingRight: 20,
    },
    notesLabel: {
        fontSize: 11,
        color: NAVY,
        fontWeight: '800',
        marginBottom: 6,
    },
    notesText: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 16,
    },
    totalArea: {
        flex: 1,
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontSize: 12,
        color: NAVY,
        fontWeight: '800',
        marginBottom: 6,
    },
    totalValue: {
        fontSize: 28,
        fontWeight: '800',
        color: NAVY,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    footerBar: {
        backgroundColor: 'rgba(13, 27, 62, 0.05)', 
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    footerText: {
        fontSize: 12,
        color: NAVY,
    },
    downloadBtn: {
        flexDirection: 'row',
        backgroundColor: NAVY,
        marginHorizontal: 16,
        marginTop: 10,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    downloadBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    }
});
