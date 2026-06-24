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
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (txData) setTransaction(txData);

            // Fetch dynamic logo
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('key, value');
            
            if (settingsData) {
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
    const isIncome = transaction.type === 'deposit' || amount > 0;
    const absAmount = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
    
    const formattedDate = new Date(transaction.created_at).toLocaleDateString([], { 
        year: 'numeric', month: 'short', day: 'numeric' 
    });
    const formattedTime = new Date(transaction.created_at).toLocaleTimeString([], { 
        hour: '2-digit', minute: '2-digit' 
    });

    const receiptNo = transaction.reference || transaction.id.substring(0, 10).toUpperCase();
    const isSuccess = transaction.status === 'success';

    return (
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={s.appHeader}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="close" size={24} color={NAVY} />
                </TouchableOpacity>
                <Text style={s.appHeaderTitle}>E-Receipt</Text>
                <TouchableOpacity onPress={shareReceipt} style={s.iconButton}>
                    <Ionicons name="share-outline" size={22} color={NAVY} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={s.receiptWrapper}>
                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={s.viewShot}>
                        
                        {/* The Main Receipt Card */}
                        <View style={s.receiptCard}>
                            
                            {/* Logo Badge overlapping the top */}
                            <View style={s.logoBadgeContainer}>
                                <View style={s.logoCircle}>
                                    {logoUrl ? (
                                        <Image source={{ uri: logoUrl }} style={s.dynamicLogo} resizeMode="contain" />
                                    ) : (
                                        <Image source={require('../../assets/images/logo-icon.png')} style={s.dynamicLogo} resizeMode="contain" />
                                    )}
                                </View>
                            </View>

                            <View style={s.receiptInner}>
                                
                                {/* Status Icon */}
                                <View style={s.statusIconContainer}>
                                    <Ionicons 
                                        name={isSuccess ? "checkmark-circle" : "time"} 
                                        size={28} 
                                        color={isSuccess ? "#107C10" : GOLD} 
                                    />
                                    <Text style={[s.statusText, {color: isSuccess ? "#107C10" : GOLD}]}>
                                        {isSuccess ? 'Payment Successful' : 'Payment Pending'}
                                    </Text>
                                </View>

                                {/* Amount Section */}
                                <Text style={s.amountLabel}>Total Amount</Text>
                                <Text style={s.amountValue}>₦{absAmount}</Text>

                                {/* Dashed Divider */}
                                <View style={s.dashedDividerWrapper}>
                                    <View style={s.cutoutLeft} />
                                    <View style={s.dashedLine} />
                                    <View style={s.cutoutRight} />
                                </View>

                                {/* Details Section */}
                                <View style={s.detailsContainer}>
                                    
                                    <DetailRow label="Transaction Type" value={transaction.type.toUpperCase()} />
                                    <DetailRow label="Description" value={transaction.description || 'N/A'} />
                                    <DetailRow label="Reference No." value={receiptNo} />
                                    <DetailRow label="Date" value={formattedDate} />
                                    <DetailRow label="Time" value={formattedTime} />
                                    <DetailRow label="User ID" value={transaction.user_id.substring(0,8)} noBorder />
                                    
                                </View>

                                {/* Footer Logo / Watermark area */}
                                <View style={s.footerArea}>
                                    <Text style={s.footerBrandText}>ABU MAFHAL HUB</Text>
                                    <Text style={s.footerMotto}>Reliable Digital Services</Text>
                                </View>

                            </View>
                        </View>
                    </ViewShot>
                </View>

                {/* Bottom Action */}
                <TouchableOpacity style={s.downloadBtn} onPress={shareReceipt} activeOpacity={0.8}>
                    <Ionicons name="download-outline" size={20} color="#ffffff" style={{marginRight: 8}} />
                    <Text style={s.downloadBtnText}>Save Receipt</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

// Helper component for rows
function DetailRow({ label, value, noBorder = false }: { label: string, value: string, noBorder?: boolean }) {
    return (
        <View style={[s.detailRow, !noBorder && s.detailRowBorder]}>
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
        paddingBottom: 10,
        backgroundColor: '#F8FAFC',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    appHeaderTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: NAVY,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    receiptWrapper: {
        paddingHorizontal: 20,
        paddingTop: 30, // Extra padding for the floating logo
        paddingBottom: 20,
    },
    viewShot: {
        backgroundColor: '#F8FAFC', 
    },
    receiptCard: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        borderRadius: 24,
        marginTop: 30, // Push card down so logo can overlap
        paddingBottom: 24,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.08,
        shadowRadius: 32,
        elevation: 8,
    },
    logoBadgeContainer: {
        alignItems: 'center',
        marginTop: -36, // Pull logo up halfway out of the card
        marginBottom: 20,
        zIndex: 10,
    },
    logoCircle: {
        width: 72,
        height: 72,
        backgroundColor: '#FFFFFF',
        borderRadius: 36,
        padding: 4,
        borderWidth: 2,
        borderColor: '#F8FAFC', // faint border
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    dynamicLogo: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
    },
    receiptInner: {
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    statusIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 8,
    },
    amountLabel: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 36,
        fontWeight: '900',
        color: NAVY,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: -1,
    },
    dashedDividerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 30,
        position: 'relative',
    },
    cutoutLeft: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        position: 'absolute',
        left: -36, // pulls it to the very edge of the card
        zIndex: 2,
    },
    cutoutRight: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        position: 'absolute',
        right: -36,
        zIndex: 2,
    },
    dashedLine: {
        flex: 1,
        height: 1,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    detailsContainer: {
        width: '100%',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
    },
    detailRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    detailLabel: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 13,
        color: NAVY,
        fontWeight: '700',
        textAlign: 'right',
        flex: 1,
        marginLeft: 20,
    },
    footerArea: {
        marginTop: 40,
        alignItems: 'center',
    },
    footerBrandText: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: 1,
    },
    footerMotto: {
        fontSize: 10,
        color: GOLD,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 4,
        letterSpacing: 2,
    },
    downloadBtn: {
        flexDirection: 'row',
        backgroundColor: NAVY,
        marginHorizontal: 20,
        marginTop: 10,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    downloadBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    }
});
