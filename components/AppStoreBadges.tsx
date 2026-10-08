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

// Authentic, Vibrant 4-Color Google Play SVG Logo (Rock-solid solid hex fills, no fragile gradient IDs)
export const GooglePlayIcon = ({ size = 26 }: { size?: number }) => (
    <View style={{ width: size, height: size * 1.05, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size * 1.05} viewBox="0 0 512 512" fill="none">
            {/* Left Wing (Blue) */}
            <Path
                d="M38.5 12.3c-9.8 5.6-15.8 16-15.8 28.4v430.6c0 12.4 6 22.8 15.8 28.4l267.4-243.7L38.5 12.3z"
                fill="#0086F8"
            />
            {/* Bottom Wing (Red) */}
            <Path
                d="M305.9 256L38.5 499.7c6.3 3.6 13.8 5.3 21.8 0.8l388.9-224.5L305.9 256z"
                fill="#FF334B"
            />
            {/* Top Wing (Green) */}
            <Path
                d="M449.2 276L305.9 256 38.5 12.3c8-4.5 15.5-2.8 21.8 0.8l388.9 224.5c19.6 11.3 19.6 30 0 38.4z"
                fill="#00E676"
            />
            {/* Right Beak (Yellow) */}
            <Path
                d="M449.2 237.6l-68.6-39.6L305.9 256l74.7 58 68.6-39.6c19.6-11.3 19.6-25.5 0-36.8z"
                fill="#FFBA00"
            />
        </Svg>
    </View>
);

// Modern Apple App Store SVG Logo with Metallic Sheen
export const AppleAppStoreIcon = ({ size = 26, isDark = true }: { size?: number; isDark?: boolean }) => (
    <View style={{ width: size, height: size * 1.15, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size * 1.15} viewBox="0 0 170 170" fill="none">
            <Path
                d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12.01-14.42-6.53-9.91-11.66-21.2-15.39-33.87-3.73-12.67-5.59-24.64-5.59-35.91 0-14.42 3.65-26.68 10.96-36.79 7.31-10.11 16.58-15.28 27.81-15.52 4.8 0 10.45 1.34 16.94 4.02 6.49 2.68 10.74 4.07 12.74 4.18 1.57 0 6.08-1.55 13.53-4.66 7.45-3.11 13.73-4.38 18.84-3.81 14.12 1.13 25.04 6.64 32.74 16.53-12.69 7.68-18.82 18.23-18.39 31.65.43 10.45 4.39 19.34 11.87 26.68 7.48 7.34 16.48 11.45 27 12.33-2.22 6.53-4.8 13.12-7.75 19.78zm-30.83-118.88c0 7.38-2.68 14.42-8.04 21.13-5.36 6.71-11.83 10.87-19.41 12.48-.43-1.09-.64-2.29-.64-3.6 0-7.39 2.9-14.49 8.7-21.31 5.8-6.82 12.28-10.84 19.43-12.06.21 1.14.32 2.26.32 3.36z"
                fill="#FFFFFF"
            />
        </Svg>
    </View>
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
