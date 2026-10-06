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
    const slideAnim = useRef(new Animated.Value(40)).current;
    const scaleAnim = useRef(new Animated.Value(0.94)).current;
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

    // Android BackHandler
    useEffect(() => {
        if (!visible) return;

        const onBackPress = () => {
            handleClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [visible]);

    // Entrance Animation
    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(badgePulse, {
                        toValue: 1.05,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(badgePulse, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 80,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 80,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start();

            setTimeout(() => {
                triggerGlobalConfetti(SCREEN_WIDTH / 2, 220);
            }, 200);
        } else {
            slideAnim.setValue(40);
            scaleAnim.setValue(0.94);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const handleSelectStar = (stars: number) => {
        setSelectedStars(stars);

        try {
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(
                    stars >= 4
                        ? Haptics.ImpactFeedbackStyle.Medium
                        : Haptics.ImpactFeedbackStyle.Light
                );
            }
        } catch (_) {}

        const targetAnim = starScales[stars - 1];
        if (targetAnim) {
            Animated.sequence([
                Animated.timing(targetAnim, {
                    toValue: 1.25,
                    duration: 90,
                    useNativeDriver: true,
                }),
                Animated.spring(targetAnim, {
                    toValue: 1,
                    friction: 4,
                    tension: 90,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        if (stars === 5) {
            triggerGlobalConfetti(SCREEN_WIDTH / 2, 220);
        }
    };

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 30,
                duration: 140,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 140,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 140,
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
        await ratingService.neverAskAgain();
        handleClose();
    };

    if (!visible) return null;

    const isHighRating = selectedStars >= 4;

    const dynamicContent = {
        5: {
            emoji: '🏆',
            title: 'Loving ABU MAFHAL SUB? 😍',
            subtitle: 'Your 5-star rating on Google Play keeps our service fast, cheap and 100% reliable!',
            buttonLabel: 'Rate 5 Stars on Google Play ⭐',
            badge: '5-STAR EXCELLENCE',
            badgeBg: 'rgba(245, 158, 11, 0.15)',
            badgeBorder: 'rgba(245, 158, 11, 0.35)',
            badgeColor: '#F59E0B',
        },
        4: {
            emoji: '🌟',
            title: 'Thank You for Your Trust! 😊',
            subtitle: 'We are glad you are enjoying our service. A quick rating on Google Play helps us grow!',
            buttonLabel: 'Rate Us on Google Play ⭐',
            badge: 'GREAT EXPERIENCE',
            badgeBg: 'rgba(16, 185, 129, 0.15)',
            badgeBorder: 'rgba(16, 185, 129, 0.35)',
            badgeColor: '#10B981',
        },
        3: {
            emoji: '💡',
            title: 'How Can We Improve? 🤔',
            subtitle: 'We want your transactions to be 100% smooth. Share feedback with support right away!',
            buttonLabel: 'Chat with Support 💬',
            badge: 'FEEDBACK & IMPROVEMENT',
            badgeBg: 'rgba(59, 130, 246, 0.15)',
            badgeBorder: 'rgba(59, 130, 246, 0.35)',
            badgeColor: '#60A5FA',
        },
        2: {
            emoji: '🙏',
            title: 'Did Something Go Wrong? 😔',
            subtitle: 'Please chat with our 24/7 dedicated support team so we can resolve it immediately.',
            buttonLabel: 'Chat on WhatsApp 💬',
            badge: 'HERE TO HELP',
            badgeBg: 'rgba(245, 158, 11, 0.15)',
            badgeBorder: 'rgba(245, 158, 11, 0.35)',
            badgeColor: '#F59E0B',
        },
        1: {
            emoji: '🤝',
            title: 'Let Us Fix This For You! 💔',
            subtitle: 'We apologize for any inconvenience. Reach our support on WhatsApp for instant assistance.',
            buttonLabel: 'Contact Dedicated Support 💬',
            badge: 'PRIORITY SUPPORT',
            badgeBg: 'rgba(239, 68, 68, 0.15)',
            badgeBorder: 'rgba(239, 68, 68, 0.35)',
            badgeColor: '#F87171',
        },
    }[selectedStars as 1 | 2 | 3 | 4 | 5] || {
        emoji: '⭐',
        title: 'Rate Your Experience',
        subtitle: 'How was your experience using ABU MAFHAL SUB?',
        buttonLabel: 'Rate on Google Play',
        badge: 'RATING',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeBorder: 'rgba(245, 158, 11, 0.35)',
        badgeColor: '#F59E0B',
    };

    const starSize = IS_SMALL_DEVICE ? 20 : 22;
    const starOrbSize = IS_SMALL_DEVICE ? 34 : 38;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={[s.backdrop, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
                            <LinearGradient
                                colors={['#0B132B', '#0F172A', '#16223F']}
                                style={s.cardGradient}
                            >
                                {/* Top Header Row: Emblem + Badge + Close */}
                                <View style={s.topBar}>
                                    <View style={s.emblemWrap}>
                                        <LinearGradient
                                            colors={['#F59E0B', '#D97706']}
                                            style={s.emblemOrb}
                                        >
                                            <Text style={{ fontSize: 20 }}>{dynamicContent.emoji}</Text>
                                        </LinearGradient>
                                    </View>

                                    <Animated.View
                                        style={[
                                            s.topBadge,
                                            {
                                                backgroundColor: dynamicContent.badgeBg,
                                                borderColor: dynamicContent.badgeBorder,
                                                transform: [{ scale: badgePulse }],
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name="sparkles"
                                            size={10}
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

                                    <TouchableOpacity
                                        onPress={handleClose}
                                        style={s.closeBtn}
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    >
                                        <Ionicons name="close" size={17} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>

                                {/* Title & Concise Subtitle */}
                                <Text style={s.ratingTitle}>{dynamicContent.title}</Text>
                                <Text style={s.ratingSubtitle} numberOfLines={2}>
                                    {dynamicContent.subtitle}
                                </Text>

                                {/* Compact Interactive Star Bar */}
                                <View style={s.starsRow}>
                                    {[1, 2, 3, 4, 5].map((starIndex) => {
                                        const isFilled = starIndex <= selectedStars;
                                        const animatedScale = starScales[starIndex - 1];

                                        return (
                                            <TouchableOpacity
                                                key={starIndex}
                                                activeOpacity={0.7}
                                                onPress={() => handleSelectStar(starIndex)}
                                                style={s.starTouchable}
                                            >
                                                <Animated.View
                                                    style={{
                                                        transform: [{ scale: animatedScale }],
                                                    }}
                                                >
                                                    <View
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
                                                            color={isFilled ? '#F59E0B' : '#475569'}
                                                        />
                                                    </View>
                                                </Animated.View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Star Score Pill */}
                                <View style={s.scorePill}>
                                    <Text style={s.scorePillText}>
                                        {selectedStars} / 5 Stars Selected
                                    </Text>
                                </View>

                                {/* Primary Action Button (Compact 44px Height) */}
                                {isHighRating ? (
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        onPress={handleRateOnPlayStore}
                                        style={s.primaryBtnWrapper}
                                    >
                                        <LinearGradient
                                            colors={['#F59E0B', '#D97706']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={s.primaryBtnGradient}
                                        >
                                            <Ionicons
                                                name="logo-google-playstore"
                                                size={16}
                                                color="#FFFFFF"
                                                style={{ marginRight: 6 }}
                                            />
                                            <Text style={s.primaryBtnText}>
                                                {dynamicContent.buttonLabel}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        onPress={handleSendFeedback}
                                        style={s.primaryBtnWrapper}
                                    >
                                        <LinearGradient
                                            colors={['#2563EB', '#1D4ED8']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={s.primaryBtnGradient}
                                        >
                                            <Ionicons
                                                name="logo-whatsapp"
                                                size={16}
                                                color="#FFFFFF"
                                                style={{ marginRight: 6 }}
                                            />
                                            <Text style={s.primaryBtnText}>
                                                {dynamicContent.buttonLabel}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}

                                {/* Secondary Actions Row */}
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
                                            style={s.remindLaterBtn}
                                        >
                                            <Text style={[s.remindLaterText, { color: '#F59E0B' }]}>
                                                Play Store →
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        activeOpacity={0.6}
                                        onPress={handleNeverAsk}
                                        style={s.remindLaterBtn}
                                    >
                                        <Text style={s.neverAskText}>
                                            Don't ask again
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
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
        backgroundColor: 'rgba(2, 6, 23, 0.78)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 326,
        borderRadius: 22,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.32)',
    },
    cardGradient: {
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 14,
        alignItems: 'center',
    },
    topBar: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    emblemWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emblemOrb: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FEF3C7',
    },
    topBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
    },
    topBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingTitle: {
        fontSize: IS_SMALL_DEVICE ? 15 : 16,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    ratingSubtitle: {
        fontSize: IS_SMALL_DEVICE ? 11 : 11.5,
        lineHeight: 16,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 12,
        paddingHorizontal: 6,
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 8,
    },
    starTouchable: {
        padding: 2,
    },
    starBgOrb: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    starBgOrbActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
    },
    scorePill: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 2.5,
        borderRadius: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    scorePillText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#F59E0B',
    },
    primaryBtnWrapper: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 8,
    },
    primaryBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        paddingHorizontal: 14,
        minHeight: 42,
    },
    primaryBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    secondaryActionsRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: 2,
    },
    remindLaterBtn: {
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    remindLaterText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    neverAskText: {
        fontSize: 10.5,
        fontWeight: '500',
        color: '#475569',
    },
});
