import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Platform,
    TouchableWithoutFeedback,
    Dimensions,
    BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ratingService, PLAY_STORE_WEB_URL } from '../services/ratingService';
import { triggerGlobalConfetti } from './CelebrationConfetti';
import { useAppSettings } from '../hooks/useAppSettings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_WIDTH < 360;

interface AppRatingModalProps {
    customPlayStoreUrl?: string;
    onDismiss?: () => void;
}

export default function AppRatingModal({
    customPlayStoreUrl,
    onDismiss
}: AppRatingModalProps) {
    const { settings } = useAppSettings();
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [selectedStars, setSelectedStars] = useState(5);
    const [actionName, setActionName] = useState<string | null>(null);

    // Animations
    const slideAnim = useRef(new Animated.Value(60)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const starScales = useRef([
        new Animated.Value(1),
        new Animated.Value(1),
        new Animated.Value(1),
        new Animated.Value(1),
        new Animated.Value(1),
    ]).current;
    const badgePulse = useRef(new Animated.Value(1)).current;

    // Register global trigger handler with ratingService
    useEffect(() => {
        ratingService.registerHandler(async (options) => {
            // First verify user hasn't already rated
            if (!options?.force) {
                const state = await ratingService.getState();
                if (state.has_rated || state.dont_ask_again) {
                    return;
                }
            }

            if (options?.actionName) {
                setActionName(options.actionName);
            }
            setSelectedStars(5);
            setVisible(true);
        });

        return () => {
            ratingService.unregisterHandler();
        };
    }, []);

    // Mobile Android BackHandler integration
    useEffect(() => {
        if (!visible) return;

        const onBackPress = () => {
            handleClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [visible]);

    // Entrance Animation (Mobile-First Spring & Slide)
    useEffect(() => {
        if (visible) {
            // Pulse badge loop
            Animated.loop(
                Animated.sequence([
                    Animated.timing(badgePulse, {
                        toValue: 1.06,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(badgePulse, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Mobile modal entrance: slide up + spring scale + fade in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 70,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 70,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();

            // Confetti burst on opening with 5 stars
            setTimeout(() => {
                triggerGlobalConfetti(SCREEN_WIDTH / 2, 200);
            }, 250);
        } else {
            slideAnim.setValue(60);
            scaleAnim.setValue(0.92);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const handleSelectStar = (stars: number) => {
        setSelectedStars(stars);

        // Mobile Haptic feedback
        try {
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(
                    stars >= 4
                        ? Haptics.ImpactFeedbackStyle.Medium
                        : Haptics.ImpactFeedbackStyle.Light
                );
            }
        } catch (_) {}

        // Bounce animated star
        const targetAnim = starScales[stars - 1];
        if (targetAnim) {
            Animated.sequence([
                Animated.timing(targetAnim, {
                    toValue: 1.3,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.spring(targetAnim, {
                    toValue: 1,
                    friction: 4,
                    tension: 80,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        // Confetti for 5 stars
        if (stars === 5) {
            triggerGlobalConfetti(SCREEN_WIDTH / 2, 200);
        }
    };

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 40,
                duration: 160,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.94,
                duration: 160,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            onDismiss?.();
        });
    };

    const handleRateOnPlayStore = async () => {
        handleClose();
        const targetUrl = customPlayStoreUrl || settings?.play_store_url || PLAY_STORE_WEB_URL;
        // PERMANENT: Marks user as rated across local storage + Supabase metadata
        await ratingService.openPlayStore(targetUrl, selectedStars);
    };

    const handleSendFeedback = async () => {
        handleClose();
        const supportPhone = settings?.support_whatsapp || '2348145853539';
        await ratingService.openSupportFeedback(supportPhone, selectedStars);
    };

    const handleRemindLater = async () => {
        await ratingService.remindLater();
        handleClose();
    };

    const handleNeverAsk = async () => {
        // PERMANENT: Never prompt this user again
        await ratingService.neverAskAgain();
        handleClose();
    };

    if (!visible) return null;

    const isHighRating = selectedStars >= 4;

    const dynamicContent = {
        5: {
            emoji: '🏆',
            title: 'Loving ABU MAFHAL SUB? 😍',
            subtitle:
                'Thank you for trusting us! Please take 5 seconds to rate us on Google Play. Your 5-star review means everything to us!',
            buttonLabel: 'Rate Us on Play Store ⭐',
            badge: 'EXCELLENT EXPERIENCE',
            badgeBg: '#FEF3C7',
            badgeColor: '#B45309',
        },
        4: {
            emoji: '🌟',
            title: 'Thank You for Your Support! 😊',
            subtitle:
                'We are glad you are enjoying our service. A quick 5-star rating on Google Play would help us grow!',
            buttonLabel: 'Rate Us on Play Store ⭐',
            badge: 'GREAT SERVICE',
            badgeBg: '#ECFDF5',
            badgeColor: '#065F46',
        },
        3: {
            emoji: '💡',
            title: 'How Can We Do Better? 🤔',
            subtitle:
                'We want your experience to be 100% smooth. Tell us what we can improve, and we will work on it right away!',
            buttonLabel: 'Send Feedback / Chat Support 💬',
            badge: 'WE VALUE YOUR FEEDBACK',
            badgeBg: '#EFF6FF',
            badgeColor: '#1E40AF',
        },
        2: {
            emoji: '🙏',
            title: 'We Are Truly Sorry! 😔',
            subtitle:
                'Did you experience any issue? Please chat with our 24/7 support team right away so we can resolve it for you.',
            buttonLabel: 'Chat with Support on WhatsApp 💬',
            badge: 'NEED HELP?',
            badgeBg: '#FFFBEB',
            badgeColor: '#92400E',
        },
        1: {
            emoji: '🤝',
            title: 'Let Us Fix This For You! 💔',
            subtitle:
                'We apologize for any trouble. Reach out to our dedicated support team on WhatsApp and we will assist you immediately.',
            buttonLabel: 'Report Issue to Support 💬',
            badge: 'WE ARE HERE TO HELP',
            badgeBg: '#FEF2F2',
            badgeColor: '#991B1B',
        },
    }[selectedStars as 1 | 2 | 3 | 4 | 5] || {
        emoji: '⭐',
        title: 'Rate Your Experience',
        subtitle: 'How was your experience using ABU MAFHAL SUB?',
        buttonLabel: 'Rate on Google Play',
        badge: 'RATING',
        badgeBg: '#FEF3C7',
        badgeColor: '#B45309',
    };

    const starSize = IS_SMALL_DEVICE ? 24 : 28;
    const starOrbSize = IS_SMALL_DEVICE ? 42 : 48;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={[s.backdrop, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <Animated.View
                            style={[
                                s.modalCard,
                                {
                                    opacity: opacityAnim,
                                    transform: [
                                        { translateY: slideAnim },
                                        { scale: scaleAnim },
                                    ],
                                },
                            ]}
                        >
                            {/* Mobile Drag Sheet Handle Indicator */}
                            <View style={s.dragHandleContainer}>
                                <View style={s.dragHandle} />
                            </View>

                            {/* Header Gradient Arc */}
                            <LinearGradient
                                colors={['#0F172A', '#1E293B', '#0d1b3e']}
                                style={s.headerGradient}
                            >
                                {/* Top Close Button */}
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={s.closeBtn}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                                >
                                    <Ionicons name="close" size={20} color="#94A3B8" />
                                </TouchableOpacity>

                                {/* Glowing Top Emblem */}
                                <View style={s.emblemContainer}>
                                    <View style={s.emblemAura} />
                                    <LinearGradient
                                        colors={['#F59E0B', '#D97706', '#B45309']}
                                        style={s.emblemOrb}
                                    >
                                        <Text style={{ fontSize: 30 }}>{dynamicContent.emoji}</Text>
                                    </LinearGradient>
                                </View>

                                {/* Pulsing Badge */}
                                <Animated.View
                                    style={[
                                        s.topBadge,
                                        {
                                            backgroundColor: dynamicContent.badgeBg,
                                            transform: [{ scale: badgePulse }],
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="star"
                                        size={11}
                                        color={dynamicContent.badgeColor}
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text
                                        style={[
                                            s.topBadgeText,
                                            { color: dynamicContent.badgeColor },
                                        ]}
                                    >
                                        {dynamicContent.badge}
                                    </Text>
                                </Animated.View>
                            </LinearGradient>

                            {/* Body Content */}
                            <View style={s.bodyContent}>
                                <Text style={s.ratingTitle}>{dynamicContent.title}</Text>
                                <Text style={s.ratingSubtitle}>
                                    {dynamicContent.subtitle}
                                </Text>

                                {/* Interactive Star Bar (Thumb-Optimized) */}
                                <View style={s.starsRow}>
                                    {[1, 2, 3, 4, 5].map((starIndex) => {
                                        const isFilled = starIndex <= selectedStars;
                                        const animatedScale = starScales[starIndex - 1];

                                        return (
                                            <TouchableOpacity
                                                key={starIndex}
                                                activeOpacity={0.75}
                                                onPress={() => handleSelectStar(starIndex)}
                                                style={s.starTouchable}
                                            >
                                                <Animated.View
                                                    style={{
                                                        transform: [{ scale: animatedScale }],
                                                    }}
                                                >
                                                    <LinearGradient
                                                        colors={
                                                            isFilled
                                                                ? ['#FFFBEB', '#FEF3C7']
                                                                : ['#F8FAFC', '#F1F5F9']
                                                        }
                                                        style={[
                                                            s.starBgOrb,
                                                            {
                                                                width: starOrbSize,
                                                                height: starOrbSize,
                                                                borderRadius: starOrbSize / 2,
                                                            },
                                                            isFilled && s.starBgOrbActive,
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name={isFilled ? 'star' : 'star-outline'}
                                                            size={starSize}
                                                            color={isFilled ? '#F59E0B' : '#94A3B8'}
                                                        />
                                                    </LinearGradient>
                                                </Animated.View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Star Score Pill */}
                                <View style={s.scorePill}>
                                    <Ionicons name="sparkles" size={12} color="#D97706" />
                                    <Text style={s.scorePillText}>
                                        {selectedStars} / 5 Stars Selected
                                    </Text>
                                </View>

                                {/* Primary Action Button (Mobile 50px Height) */}
                                {isHighRating ? (
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        onPress={handleRateOnPlayStore}
                                        style={s.primaryBtnWrapper}
                                    >
                                        <LinearGradient
                                            colors={['#F59E0B', '#D97706', '#B45309']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={s.primaryBtnGradient}
                                        >
                                            <Ionicons
                                                name="logo-google-playstore"
                                                size={19}
                                                color="#FFFFFF"
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={s.primaryBtnText}>
                                                {dynamicContent.buttonLabel}
                                            </Text>
                                            <Ionicons
                                                name="arrow-forward"
                                                size={16}
                                                color="#FFFFFF"
                                                style={{ marginLeft: 6 }}
                                            />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        onPress={handleSendFeedback}
                                        style={s.primaryBtnWrapper}
                                    >
                                        <LinearGradient
                                            colors={['#10B981', '#059669', '#047857']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={s.primaryBtnGradient}
                                        >
                                            <Ionicons
                                                name="chatbubble-ellipses"
                                                size={19}
                                                color="#FFFFFF"
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={s.primaryBtnText}>
                                                {dynamicContent.buttonLabel}
                                            </Text>
                                            <Ionicons
                                                name="arrow-forward"
                                                size={16}
                                                color="#FFFFFF"
                                                style={{ marginLeft: 6 }}
                                            />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}

                                {/* Secondary Action Row */}
                                <View style={s.secondaryActionsRow}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={handleRemindLater}
                                        style={s.remindLaterBtn}
                                    >
                                        <Text style={s.remindLaterText}>
                                            Maybe Later
                                        </Text>
                                    </TouchableOpacity>

                                    {!isHighRating && (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={handleRateOnPlayStore}
                                            style={s.forcePlayStoreBtn}
                                        >
                                            <Text style={s.forcePlayStoreText}>
                                                Go to Play Store →
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Footer Opt-out (Permanently Remembers!) */}
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={handleNeverAsk}
                                    style={s.neverAskBtn}
                                >
                                    <Text style={s.neverAskText}>
                                        Don't show this again
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.76)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 384,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        overflow: 'hidden',
        elevation: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 26,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    dragHandleContainer: {
        backgroundColor: '#0F172A',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 2,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    headerGradient: {
        paddingTop: 16,
        paddingBottom: 18,
        alignItems: 'center',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 10,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    emblemContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emblemAura: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(245, 158, 11, 0.24)',
    },
    emblemOrb: {
        width: 62,
        height: 62,
        borderRadius: 31,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FEF3C7',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 6,
    },
    topBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        borderRadius: 12,
        marginTop: 4,
    },
    topBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    bodyContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 18,
        alignItems: 'center',
    },
    ratingTitle: {
        fontSize: IS_SMALL_DEVICE ? 15.5 : 17,
        fontWeight: '900',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 6,
    },
    ratingSubtitle: {
        fontSize: IS_SMALL_DEVICE ? 11.5 : 12.5,
        lineHeight: IS_SMALL_DEVICE ? 17 : 18.5,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: IS_SMALL_DEVICE ? 6 : 8,
        marginBottom: 8,
    },
    starTouchable: {
        padding: 3,
    },
    starBgOrb: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    starBgOrbActive: {
        borderColor: '#FDE68A',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 6,
        elevation: 3,
    },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 3.5,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    scorePillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#92400E',
    },
    primaryBtnWrapper: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        marginBottom: 10,
    },
    primaryBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 50,
    },
    primaryBtnText: {
        fontSize: IS_SMALL_DEVICE ? 13 : 14,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    secondaryActionsRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 8,
    },
    remindLaterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        minHeight: 36,
        justifyContent: 'center',
    },
    remindLaterText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    forcePlayStoreBtn: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        minHeight: 36,
        justifyContent: 'center',
    },
    forcePlayStoreText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D97706',
    },
    neverAskBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginTop: 2,
    },
    neverAskText: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#94A3B8',
        textDecorationLine: 'underline',
    },
});
