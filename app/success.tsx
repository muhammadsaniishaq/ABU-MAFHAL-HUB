import { View, Text, TouchableOpacity, BackHandler, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { trackGooglePurchaseConversion } from '../services/googleAds';
import { ReceiptData } from '../services/receiptGenerator';
import ReceiptExportModal from '../components/ReceiptExportModal';
import { ratingService } from '../services/ratingService';
import AppRatingModal from '../components/AppRatingModal';

const G = {
  navyDark: '#020617',
  navyMid: '#0F172A',
  gold: '#FFD700',
  goldDk: '#DAA520',
  emerald: '#10B981',
  cardBg: '#FFFFFF',
  textMuted: '#94A3B8',
};

export default function SuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { amount, type, id, reference, description } = params;
    const [exportModalVisible, setExportModalVisible] = useState(false);

    // Trigger Google Ads conversion tracking and in-app rating prompt
    useEffect(() => {
        const numericAmount = amount ? Number(String(amount).replace(/[^0-9.-]+/g, '')) : 0;
        trackGooglePurchaseConversion(String(id || reference || ''), numericAmount);

        // Record successful action to prompt rating when appropriate
        ratingService.recordSuccessfulAction(String(type || 'Payment Service'));
    }, [amount, id, reference, type]);

    // Prevent back button from going back to form
    useEffect(() => {
        const backAction = () => {
            router.replace('/(app)/dashboard');
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, []);

    const receiptPayload: ReceiptData = {
        reference: String(reference || id || `TXN-${Date.now()}`),
        type: String(type || 'Payment Service'),
        description: String(description || `${type || 'Service'} Completed Successfully`),
        amount: String(amount || '0'),
        status: 'SUCCESSFUL',
        date: new Date(),
        paymentMethod: 'Wallet Balance'
    };

    return (
        <LinearGradient colors={['#020617', '#0F172A', '#1E293B']} style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Success Animation Orb */}
            <View style={s.iconOrb}>
                <Ionicons name="checkmark" size={54} color="#10B981" />
            </View>

            <Text style={s.title}>Payment Successful!</Text>
            <Text style={s.subtitle}>Your transaction was completed and recorded on the secure ledger.</Text>

            {/* Receipt Summary Card */}
            <View style={s.receiptCard}>
                <View style={s.cardRow}>
                    <Text style={s.cardLabel}>Amount Paid</Text>
                    <Text style={s.cardAmount}>{amount || '₦0.00'}</Text>
                </View>
                <View style={s.cardRow}>
                    <Text style={s.cardLabel}>Service</Text>
                    <Text style={s.cardVal}>{type || 'Payment'}</Text>
                </View>
                {(reference || id) && (
                    <View style={[s.cardRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                        <Text style={s.cardLabel}>Reference ID</Text>
                        <Text style={s.cardRef}>{String(reference || id).slice(-12)}</Text>
                    </View>
                )}
            </View>

            {/* Download Receipt Button (PDF / PNG Modal) */}
            <TouchableOpacity
                style={s.pdfBtn}
                onPress={() => setExportModalVisible(true)}
                activeOpacity={0.85}
            >
                <Ionicons name="download-outline" size={18} color="#0F172A" />
                <Text style={s.pdfBtnText}>Download Receipt (PDF / PNG)</Text>
            </TouchableOpacity>

            {/* Back to Home Button */}
            <TouchableOpacity
                style={s.homeBtn}
                onPress={() => router.replace('/(app)/dashboard')}
                activeOpacity={0.85}
            >
                <Text style={s.homeBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>

            {/* View in History */}
            <TouchableOpacity
                style={s.historyBtn}
                onPress={() => router.replace('/(app)/history')}
            >
                <Text style={s.historyBtnText}>View in Transaction History →</Text>
            </TouchableOpacity>

            {/* Modern Compact Rating Card ("Wajen Rate") */}
            <TouchableOpacity
                style={s.rateCard}
                onPress={() => ratingService.triggerPrompt({ force: true, actionName: String(type || 'Payment Service') })}
                activeOpacity={0.88}
            >
                <LinearGradient
                    colors={['rgba(245, 158, 11, 0.14)', 'rgba(217, 119, 6, 0.04)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.rateCardGradient}
                >
                    <View style={s.rateCardIconWrap}>
                        <Ionicons name="star" size={16} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                        <Text style={s.rateCardTitle}>Loving the instant delivery?</Text>
                        <Text style={s.rateCardSubtitle}>Tap to rate ABU MAFHAL SUB on Google Play</Text>
                    </View>
                    <View style={s.rateCardBadge}>
                        <Text style={s.rateCardBadgeText}>Rate 5★</Text>
                        <Ionicons name="chevron-forward" size={12} color="#F59E0B" />
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            {/* DUAL FORMAT RECEIPT EXPORT MODAL */}
            <ReceiptExportModal
                visible={exportModalVisible}
                onClose={() => setExportModalVisible(false)}
                receiptData={receiptPayload}
            />

            {/* IN-APP RATING MODAL */}
            <AppRatingModal />
        </LinearGradient>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    iconOrb: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 2,
        borderColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    subtitle: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 18,
        maxWidth: 320,
    },
    receiptCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(218, 165, 32, 0.35)',
        marginBottom: 20,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    cardLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    cardAmount: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: '900',
    },
    cardVal: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    cardRef: {
        color: '#E2E8F0',
        fontSize: 11,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    pdfBtn: {
        width: '100%',
        maxWidth: 380,
        height: 48,
        backgroundColor: '#FFD700',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#DAA520',
    },
    pdfBtnText: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    homeBtn: {
        width: '100%',
        maxWidth: 380,
        height: 46,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    homeBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    historyBtn: {
        paddingVertical: 8,
    },
    historyBtnText: {
        color: '#DAA520',
        fontSize: 12,
        fontWeight: '800',
    },
    rateCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    rateCardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    rateCardIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    rateCardTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    rateCardSubtitle: {
        color: '#94A3B8',
        fontSize: 10,
        marginTop: 1,
    },
    rateCardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    rateCardBadgeText: {
        color: '#F59E0B',
        fontSize: 10.5,
        fontWeight: '800',
    },
});
