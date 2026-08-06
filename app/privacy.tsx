import React, { useState } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, LayoutAnimation, 
    UIManager, Platform, Share, StyleSheet, useWindowDimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthTheme } from '../hooks/useAuthTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRIVACY_SECTIONS = [
    {
        id: 'data_collection',
        icon: 'folder-open-outline',
        title: '1. Information We Collect',
        content: `To provide identity verification, CAC registration, and VTU services, ABUMAFHAL collects:\n\n• Personal Identifiers: Full Name, Email Address, Phone Number, Username, Date of Birth.\n• Identity Data: National Identification Number (NIN), Bank Verification Number (BVN), Corporate CAC Registration Data, and Tax ID numbers (processed under NDPR guidelines).\n• Financial Logs: Wallet funding histories, Paystack transaction receipts, and VTU usage records.`
    },
    {
        id: 'use_of_data',
        icon: 'cog-outline',
        title: '2. How We Use Your Data',
        content: `Your data is strictly utilized for the following operational purposes:\n\n• Processing requested identity modifications (NIN, BVN, CAC, TAX).\n• Executing automated VTU transactions (Airtime, Cheap Data, Electricity & Cable TV).\n• Maintaining secure wallet ledgers and sending real-time SMS/Email receipts.\n• Fraud detection, identity verification compliance, and preventing unauthorized account access.\n\nWe do NOT sell, rent, or trade your personal data to third-party advertisers under any circumstances.`
    },
    {
        id: 'data_security',
        icon: 'lock-closed-outline',
        title: '3. Data Protection & Security Standards',
        content: `We implement enterprise-grade security protocols to protect your personal identity and transaction data:\n\n• 256-Bit SSL/TLS Encryption across all client-server communications.\n• AES-256 encrypted database vaults for sensitive parameters.\n• Secure API gateway proxies protecting partner verification queries.`
    },
    {
        id: 'third_parties',
        icon: 'server-outline',
        title: '4. Third-Party Service Providers',
        content: `To execute authorized services, we interact with official regulatory bodies and licensed gateways:\n\n• NIMC (National Identity Management Commission) via authorized identity proxies.\n• NIBSS (Nigeria Inter-Bank Settlement System) for BVN validation.\n• CAC (Corporate Affairs Commission) for Business Registrations.\n• Licensed Payment Gateways (Paystack, Monnify, Flutterwave).`
    },
    {
        id: 'user_rights',
        icon: 'key-outline',
        title: '5. Your Rights & Data Erasure',
        content: `Under the Nigeria Data Protection Act (NDPA):\n\n• Access & Correction: You have the right to request a copy of your personal data or update incorrect account information.\n• Account Deletion: You may request account deletion or data erasure by contacting our Data Protection Officer at privacy@abumafhal.ng.`
    },
    {
        id: 'cookies',
        icon: 'hardware-chip-outline',
        title: '6. Storage & Session Security',
        content: `ABUMAFHAL uses secure local device storage (AsyncStorage & SecureStore) strictly to store encrypted authentication session tokens and user theme preferences.`
    }
];

export default function PrivacyScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const { isDark, theme } = useAuthTheme();

    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    const toggleAccordion = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const handleShare = async () => {
        try {
            await Share.share({ 
                title: 'ABUMAFHAL Privacy Policy',
                message: 'ABUMAFHAL Privacy Policy & Data Protection Policy: https://abumafhal.ng/privacy' 
            });
        } catch (error) {}
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
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Privacy Policy</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.gold }]}>NDPA & DATA PROTECTION</Text>
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
                            <Ionicons name="lock-closed" size={16} color="#08E4C7" />
                            <Text style={styles.heroBadgeText}>256-BIT ENCRYPTED & PROTECTED</Text>
                        </View>
                        <Text style={styles.heroTitle}>Privacy Policy</Text>
                        <Text style={styles.heroSubText}>
                            Your privacy and identity data security are our highest priority under the Nigeria Data Protection Act.
                        </Text>
                    </LinearGradient>

                    {/* Privacy Sections Accordion */}
                    <View style={styles.sectionContainer}>
                        {PRIVACY_SECTIONS.map((sec, idx) => {
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

                    {/* Support Box */}
                    <View style={[styles.supportBox, { backgroundColor: isDark ? '#0A1424' : '#F1F5F9', borderColor: theme.borderPrimary }]}>
                        <Ionicons name="mail-unread" size={24} color="#08E4C7" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.supportTitle, { color: theme.textPrimary }]}>Data Privacy Officer</Text>
                            <Text style={[styles.supportSubText, { color: theme.textSecondary }]}>
                                For data inquiries or account deletion: privacy@abumafhal.ng
                            </Text>
                        </View>
                    </View>

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
        justify: 'center',
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
    supportBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    supportTitle: {
        fontWeight: '800',
        fontSize: 13,
        marginBottom: 2,
    },
    supportSubText: {
        fontSize: 11,
        fontWeight: '500',
    },
    effectiveDate: {
        fontSize: 10.5,
        fontWeight: '600',
        textAlign: 'center',
    },
});
