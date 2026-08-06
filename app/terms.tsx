import React, { useState, useCallback } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, LayoutAnimation, 
    UIManager, Platform, Share, StyleSheet, useWindowDimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthTheme } from '../hooks/useAuthTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TERMS_SECTIONS = [
    {
        id: 'authorization',
        icon: 'person-circle-outline',
        title: '1. Authorization to Act on Your Behalf',
        content: `I, the user, hereby authorize ABUMAFHAL Hub and its authorized agents to access and process my personal data, including National Identification Number (NIN), Bank Verification Number (BVN), Corporate Affairs Commission (CAC) business data, and Tax ID data, solely for the purpose of executing the identity modification, retrieval, validation, or corporate service requested.\n\nI understand that ABUMAFHAL operates as an independent agent infrastructure and service provider in accordance with relevant Nigerian regulations.`
    },
    {
        id: 'voluntary_consent',
        icon: 'hand-right-outline',
        title: '2. Voluntary Consent & NDPR Compliance',
        content: `NIMC and relevant regulatory authorities recommend that identity modifications be performed personally. By agreeing to these terms, I confirm that due to technical complexity, literacy, distance, or personal convenience, I voluntarily authorize ABUMAFHAL to process this request on my behalf.\n\nThis authorization applies whether I am the direct identity owner or an authorized agent acting with full informed consent of the identity owner under the Nigeria Data Protection Act (NDPA/NDPR).`
    },
    {
        id: 'fees_and_refunds',
        icon: 'wallet-outline',
        title: '3. Service Fees & No-Refund Policy',
        content: `I agree to pay the designated service fee for processing identity, corporate, or VTU utility transactions.\n\n• Wallet Funds Policy: All deposited wallet funds are non-refundable and non-withdrawable.\n• Failed Transactions: If a service submission fails due to an verified Provider or System error, the full fee will automatically be credited back to your ABUMAFHAL wallet balance.\n• Incorrect Submissions: Submissions that fail due to incorrect user data, invalid NIN/BVN parameters provided by the user, or fraudulent data will incur standard processing fees.`
    },
    {
        id: 'user_responsibilities',
        icon: 'shield-checkmark-outline',
        title: '4. Account Security & User Responsibilities',
        content: `You are solely responsible for maintaining the confidentiality of your account credentials, login PIN, and transaction authorization codes.\n\n• Any transaction initiated using your authenticated account session is deemed authorized by you.\n• ABUMAFHAL will never ask for your password or secret transaction PIN via phone call or unverified messaging.`
    },
    {
        id: 'services_and_pricing',
        icon: 'flash-outline',
        title: '5. VTU, Identity & Digital Services',
        content: `ABUMAFHAL provides automated access to Virtual Top-Up (Airtime, Cheap Data, Cable TV, Electricity Bills), Identity Verifications (NIN, BVN, IPE Clearance, Slip Printing), CAC Business Name Registrations, and Tax ID generation.\n\n• Service pricing is subject to dynamic provider rates and admin margin updates.\n• Delivery times for manual modifications (such as NIMC IPE Clearance) depend on official government processing queues.`
    },
    {
        id: 'termination',
        icon: 'close-circle-outline',
        title: '6. Account Termination & Fraud Prevention',
        content: `ABUMAFHAL maintains zero tolerance for fraudulent identity lookups, stolen credit card funding, or unauthorized data queries.\n\nWe reserve the right to immediately suspend or permanently terminate any account engaged in suspicious activities, and report relevant details to law enforcement authorities.`
    },
    {
        id: 'dispute_resolution',
        icon: 'chatbubbles-outline',
        title: '7. Dispute Resolution & Support Contact',
        content: `For any inquiries, transaction disputes, or data clarification, please reach out to our official support team:\n\n• Support Email: support@abumafhal.ng\n• Phone / WhatsApp: +234 801 234 5678\n• Office: ABUMAFHAL Hub, Digital Identity Center, Nigeria.`
    }
];

export default function TermsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const { isDark, theme } = useAuthTheme();

    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
    const [isChecked, setIsChecked] = useState(false);
    const [alreadyAccepted, setAlreadyAccepted] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const checkAcceptance = async () => {
                try {
                    const accepted = await AsyncStorage.getItem('@terms_accepted');
                    if (accepted === 'true') {
                        setAlreadyAccepted(true);
                        setIsChecked(true);
                    }
                } catch (error) {
                    console.log("Error reading terms status", error);
                }
            };
            checkAcceptance();
        }, [])
    );

    const toggleAccordion = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const handleShare = async () => {
        try {
            await Share.share({ 
                title: 'ABUMAFHAL Terms of Agreement',
                message: 'ABUMAFHAL Terms of Agreement & Service Policy: https://abumafhal.ng/terms' 
            });
        } catch (error) {}
    };

    const handleAccept = async () => {
        if (isChecked || alreadyAccepted) {
            try {
                await AsyncStorage.setItem('@terms_accepted', 'true');
            } catch (error) {
                console.log("Error saving terms status", error);
            }
            router.back();
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={isDark ? "light" : "dark"} />

            <SafeAreaView style={{ flex: 1 }}>
                
                {/* Header Control Bar */}
                <View style={styles.headerBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleBox}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Terms of Agreement</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.gold }]}>LEGAL & SERVICE POLICIES</Text>
                    </View>

                    <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.8}>
                        <Ionicons name="share-social" size={18} color={theme.accentTeal} />
                    </TouchableOpacity>
                </View>

                <ScrollView 
                    contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}
                    showsVerticalScrollIndicator={false}
                >
                    
                    {/* Top Hero Banner */}
                    <LinearGradient
                        colors={['#0E1A2E', '#1E293B']}
                        style={styles.heroBanner}
                    >
                        <View style={styles.heroBadge}>
                            <Ionicons name="shield-checkmark" size={16} color="#08E4C7" />
                            <Text style={styles.heroBadgeText}>NDPR COMPLIANT & VERIFIED</Text>
                        </View>
                        <Text style={styles.heroTitle}>Terms of Service</Text>
                        <Text style={styles.heroSubText}>
                            Please review and agree to our terms before utilizing ABUMAFHAL Identity, CAC, Tax, and VTU Services.
                        </Text>
                    </LinearGradient>

                    {/* Terms Sections Accordion */}
                    <View style={styles.sectionContainer}>
                        {TERMS_SECTIONS.map((sec, idx) => {
                            const isExpanded = expandedIndex === idx;
                            return (
                                <View 
                                    key={sec.id}
                                    style={[
                                        styles.accordionCard,
                                        { backgroundColor: theme.bgInput, borderColor: isExpanded ? theme.borderFocus : theme.borderPrimary }
                                    ]}
                                >
                                    <TouchableOpacity 
                                        onPress={() => toggleAccordion(idx)}
                                        style={styles.accordionHeader}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.iconCircle}>
                                            <Ionicons name={sec.icon as any} size={18} color="#08E4C7" />
                                        </View>
                                        <Text style={[styles.accordionTitle, { color: theme.textPrimary }]}>
                                            {sec.title}
                                        </Text>
                                        <Ionicons 
                                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                                            size={18} 
                                            color={theme.textMuted} 
                                        />
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={[styles.accordionBody, { borderTopColor: theme.borderPrimary }]}>
                                            <Text style={[styles.accordionContentText, { color: theme.textSecondary }]}>
                                                {sec.content}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {/* Acceptance Checkbox Box */}
                    <View style={[styles.consentCard, { backgroundColor: isDark ? '#0A1424' : '#F1F5F9', borderColor: theme.borderPrimary }]}>
                        <TouchableOpacity 
                            onPress={() => setIsChecked(!isChecked)}
                            style={styles.consentCheckboxRow}
                            activeOpacity={0.8}
                        >
                            <View style={[
                                styles.checkbox,
                                (isChecked || alreadyAccepted) && { backgroundColor: '#08E4C7', borderColor: '#08E4C7' }
                            ]}>
                                {(isChecked || alreadyAccepted) && <Ionicons name="checkmark" size={14} color="#0E1A2E" />}
                            </View>
                            <Text style={[styles.consentText, { color: theme.textPrimary }]}>
                                I have read, understood, and voluntarily agree to ABUMAFHAL's Terms of Agreement & Privacy Policy.
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Primary Accept Action Button */}
                    <TouchableOpacity 
                        onPress={handleAccept}
                        disabled={!isChecked && !alreadyAccepted}
                        style={[
                            styles.acceptBtn,
                            (!isChecked && !alreadyAccepted) && { opacity: 0.5 }
                        ]}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#0E1A2E', '#1E293B']}
                            style={styles.btnGradient}
                        >
                            <Text style={styles.btnText}>
                                {alreadyAccepted ? 'Agreement Accepted ✓' : 'I Agree & Continue'}
                            </Text>
                            <Ionicons name="arrow-forward" size={16} color="#08E4C7" style={{ marginLeft: 6 }} />
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={[styles.effectiveDate, { color: theme.textMuted }]}>
                        Effective Date: January 1, 2026 • ABUMAFHAL Digital Hub
                    </Text>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleBox: {
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: '900',
        fontSize: 16,
    },
    headerSubtitle: {
        fontWeight: '800',
        fontSize: 9,
        letterSpacing: 0.5,
    },
    shareBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    desktopScrollContent: {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    heroBanner: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    heroBadgeText: {
        color: '#08E4C7',
        fontSize: 9.5,
        fontWeight: '800',
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    heroTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 22,
        marginBottom: 4,
    },
    heroSubText: {
        color: '#94A3B8',
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '500',
    },
    sectionContainer: {
        marginBottom: 16,
    },
    accordionCard: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
        overflow: 'hidden',
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(8, 228, 199, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    accordionTitle: {
        flex: 1,
        fontWeight: '800',
        fontSize: 13,
    },
    accordionBody: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    accordionContentText: {
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '500',
    },
    consentCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 14,
    },
    consentCheckboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        marginTop: 2,
    },
    consentText: {
        flex: 1,
        fontSize: 11.5,
        fontWeight: '600',
        lineHeight: 16,
    },
    acceptBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 16,
    },
    btnGradient: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 14,
    },
    effectiveDate: {
        fontSize: 10.5,
        fontWeight: '600',
        textAlign: 'center',
    },
});
