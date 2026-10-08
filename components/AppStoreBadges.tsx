import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useAppSettings } from '../hooks/useAppSettings';
import { useAuthTheme } from '../hooks/useAuthTheme';

// Authentic, Vibrant 4-Color Google Play SVG Logo
export const GooglePlayIcon = ({ size = 26 }: { size?: number }) => (
    <Svg width={size} height={size * 1.1} viewBox="0 0 512 560" fill="none">
        <Defs>
            <SvgGradient id="playBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#00C3FF" />
                <Stop offset="100%" stopColor="#0072F5" />
            </SvgGradient>
            <SvgGradient id="playGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#00F076" />
                <Stop offset="100%" stopColor="#00B84D" />
            </SvgGradient>
            <SvgGradient id="playYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFDE00" />
                <Stop offset="100%" stopColor="#FFA000" />
            </SvgGradient>
            <SvgGradient id="playRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FF3A44" />
                <Stop offset="100%" stopColor="#D91624" />
            </SvgGradient>
        </Defs>
        {/* Left Wing (Blue) */}
        <Path
            d="M32.5 10.2C24.1 14.8 19 23.5 19 33.7V478.3C19 488.5 24.1 497.2 32.5 501.8L278.4 256Z"
            fill="url(#playBlueGrad)"
        />
        {/* Bottom Wing (Red) */}
        <Path
            d="M278.4 256L32.5 501.8C37.8 504.8 44.1 506.2 50.8 502.5L380.6 312.2Z"
            fill="url(#playRedGrad)"
        />
        {/* Top Wing (Green) */}
        <Path
            d="M380.6 199.8L50.8 9.5C44.1 5.8 37.8 7.2 32.5 10.2L278.4 256Z"
            fill="url(#playGreenGrad)"
        />
        {/* Right Beak (Yellow) */}
        <Path
            d="M278.4 256L380.6 199.8L442.2 235.3C459.3 245.2 459.3 266.8 442.2 276.7L380.6 312.2Z"
            fill="url(#playYellowGrad)"
        />
    </Svg>
);

// Modern Apple App Store SVG Logo with Metallic Sheen
export const AppleAppStoreIcon = ({ size = 26, isDark = true }: { size?: number; isDark?: boolean }) => (
    <Svg width={size} height={size * 1.15} viewBox="0 0 24 28" fill="none">
        <Defs>
            <SvgGradient id="appleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="100%" stopColor="#D4D9E2" />
            </SvgGradient>
        </Defs>
        <Path
            d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
            fill="url(#appleGrad)"
        />
    </Svg>
);

interface AppStoreBadgesProps {
    compact?: boolean;
    style?: any;
    title?: string;
}

export const AppStoreBadges: React.FC<AppStoreBadgesProps> = ({
    compact = false,
    style,
    title = 'Official Abu Mafhal Mobile App',
}) => {
    const { settings } = useAppSettings();
    const { isDark } = useAuthTheme();

    const playStoreUrl =
        settings.play_store_url ||
        'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

    const appStoreUrl = settings.app_store_url || 'https://apps.apple.com/app/abu-mafhal-sub';
    const isAppStoreLive = settings.app_store_status === 'live';

    const handleGooglePlayPress = async () => {
        try {
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const supported = await Linking.canOpenURL(playStoreUrl);
            if (supported) {
                await Linking.openURL(playStoreUrl);
            } else {
                if (Platform.OS === 'web') {
                    window.open(playStoreUrl, '_blank');
                } else {
                    Linking.openURL(playStoreUrl);
                }
            }
        } catch (e) {
            console.warn('Could not open Google Play URL:', e);
            if (Platform.OS === 'web') {
                window.open(playStoreUrl, '_blank');
            }
        }
    };

    const handleAppStorePress = async () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        if (isAppStoreLive && appStoreUrl) {
            try {
                await Linking.openURL(appStoreUrl);
            } catch (e) {
                console.warn('Could not open App Store URL:', e);
            }
            return;
        }

        const msg =
            'Manhajar Abu Mafhal Sub ta Apple App Store (iOS) tana nan tafe nan kusa!\n\nOur iOS application is currently undergoing final review on the App Store. In the meantime, you can download our Android app on Google Play or use our web app!';

        if (Platform.OS === 'web') {
            alert('🍎 Apple App Store: COMING SOON!\n\n' + msg);
        } else {
            Alert.alert(
                '🍎 Apple App Store — Coming Soon!',
                msg,
                [{ text: 'To Madalla / OK', style: 'default' }]
            );
        }
    };

    // Modern Luxury Theme Tokens
    const containerBg = isDark ? '#0A1224' : '#FFFFFF';
    const containerBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(13, 27, 62, 0.12)';
    const textPrimary = isDark ? '#F8FAFC' : '#0B152B';
    const textMuted = isDark ? '#94A3B8' : '#64748B';

    return (
        <View style={[styles.container, { backgroundColor: containerBg, borderColor: containerBorder }, style]}>
            {/* Header Micro Bar */}
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <View style={styles.badgePulseIcon}>
                        <View style={styles.badgePulseDot} />
                    </View>
                    <Text style={[styles.headerTitle, { color: textPrimary }]}>
                        {title}
                    </Text>
                </View>
                <View style={styles.verifiedPill}>
                    <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                    <Text style={styles.verifiedText}>Google Play Verified</Text>
                </View>
            </View>

            {/* Store Buttons Grid */}
            <View style={styles.buttonsRow}>
                {/* 1. Google Play Store Modern Button */}
                <TouchableOpacity
                    style={styles.btnTouch}
                    onPress={handleGooglePlayPress}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#071126', '#0B1A3A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.storeCard,
                            styles.playCardGlow,
                        ]}
                    >
                        {/* Genuine Multi-color Google Play Vector */}
                        <View style={styles.iconContainer}>
                            <GooglePlayIcon size={24} />
                        </View>

                        <View style={styles.textContainer}>
                            <Text style={styles.subTextGoogle}>GET IT ON</Text>
                            <Text style={styles.mainTextStore}>Google Play</Text>
                        </View>

                        {/* Rating micro badge */}
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={9} color="#FFD700" />
                            <Text style={styles.ratingText}>4.9</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* 2. Apple App Store Modern Button */}
                <TouchableOpacity
                    style={styles.btnTouch}
                    onPress={handleAppStorePress}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#10162A', '#161D36']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.storeCard,
                            styles.appCardGlow,
                        ]}
                    >
                        {/* Coming Soon Pill Tag */}
                        {!isAppStoreLive && (
                            <View style={styles.comingSoonTag}>
                                <View style={styles.comingSoonDot} />
                                <Text style={styles.comingSoonLabel}>COMING SOON</Text>
                            </View>
                        )}

                        {/* Metallic Apple Vector */}
                        <View style={styles.iconContainer}>
                            <AppleAppStoreIcon size={23} />
                        </View>

                        <View style={styles.textContainer}>
                            <Text style={styles.subTextApple}>Download on</Text>
                            <Text style={styles.mainTextStore}>App Store</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Micro Feature Highlights */}
            <View style={styles.footerFeatures}>
                <Text style={[styles.featureItem, { color: textMuted }]}>
                    ⚡ 0.4s Instant Delivery
                </Text>
                <Text style={{ color: textMuted, fontSize: 10 }}>•</Text>
                <Text style={[styles.featureItem, { color: textMuted }]}>
                    🔒 Biometric Lock
                </Text>
                <Text style={{ color: textMuted, fontSize: 10 }}>•</Text>
                <Text style={[styles.featureItem, { color: textMuted }]}>
                    🎁 ₦500 Bonus
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 20,
        padding: 14,
        marginTop: 14,
        marginBottom: 8,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    badgePulseIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10B981',
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    verifiedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.35)',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 99,
    },
    verifiedText: {
        color: '#10B981',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    btnTouch: {
        flex: 1,
    },
    storeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        position: 'relative',
        minHeight: 52,
    },
    playCardGlow: {
        borderColor: 'rgba(0, 195, 255, 0.4)',
        shadowColor: '#00C3FF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    appCardGlow: {
        borderColor: 'rgba(245, 158, 11, 0.45)',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    iconContainer: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    subTextGoogle: {
        fontSize: 8,
        fontWeight: '700',
        color: '#38BDF8',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        lineHeight: 10,
    },
    subTextApple: {
        fontSize: 8,
        fontWeight: '700',
        color: '#CBD5E1',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        lineHeight: 10,
    },
    mainTextStore: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.2,
        lineHeight: 16,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 6,
        alignSelf: 'center',
    },
    ratingText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '800',
    },
    comingSoonTag: {
        position: 'absolute',
        top: -8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3.5,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FEF3C7',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4,
    },
    comingSoonDot: {
        width: 4.5,
        height: 4.5,
        borderRadius: 2.5,
        backgroundColor: '#0D1B3E',
    },
    comingSoonLabel: {
        color: '#0D1B3E',
        fontSize: 7.5,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    footerFeatures: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    featureItem: {
        fontSize: 9.5,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});

export default AppStoreBadges;
