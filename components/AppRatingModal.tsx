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
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ratingService, PLAY_STORE_WEB_URL } from '../services/ratingService';
import { triggerGlobalConfetti } from './CelebrationConfetti';
import { useAppSettings } from '../hooks/useAppSettings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AppRatingModalProps {
    customPlayStoreUrl?: string;
    onDismiss?: () => void;
}

export default function AppRatingModal({
    customPlayStoreUrl,
    onDismiss
}: AppRatingModalProps) {
    const { settings } = useAppSettings();
    const [visible, setVisible] = useState(false);
    const [selectedStars, setSelectedStars] = useState(5);
    const [actionName, setActionName] = useState<string | null>(null);

    // Animations
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
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
        ratingService.registerHandler((options) => {
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

    // Entrance Animation
    useEffect(() => {
        if (visible) {
            // Pulse badge
            Animated.loop(
                Animated.sequence([
                    Animated.timing(badgePulse, {
                        toValue: 1.08,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(badgePulse, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Modal pop in
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            // Trigger confetti gently for 5 default stars
            setTimeout(() => {
                triggerGlobalConfetti(SCREEN_WIDTH / 2, 220);
            }, 300);
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const handleSelectStar = (stars: number) => {
        setSelectedStars(stars);

        // Haptic feedback
        try {
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(
                    stars >= 4
                        ? Haptics.ImpactFeedbackStyle.Medium
                        : Haptics.ImpactFeedbackStyle.Light
                );
            }
        } catch (_) {}

        // Animate clicked star with bounce
        const targetAnim = starScales[stars - 1];
        if (targetAnim) {
            Animated.sequence([
                Animated.timing(targetAnim, {
                    toValue: 1.35,
                    duration: 120,
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
            triggerGlobalConfetti(SCREEN_WIDTH / 2, 220);
        }
    };

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.88,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 180,
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
        await ratingService.openPlayStore(targetUrl);
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

    // Dynamic copy based on rating
    const isHighRating = selectedStars >= 4;

    const dynamicContent = {
        5: {
            emoji: '🏆',
            title: 'Madalla! Muna Alfahari Da Kai! 😍',
            subtitle:
                'Godiya marar iyaka da amincewarka da ABU MAFHAL SUB. Da fatan zaka bamu taurari 5 a Google Play Store domin karfafawa manhajarka gwiwa!',
            buttonLabel: 'Bamu Taurari a Play Store ⭐',
            badge: 'EXCELLENT EXPERIENCE',
            badgeBg: '#FEF3C7',
            badgeColor: '#B45309',
        },
        4: {
            emoji: '🌟',
            title: 'Nagari Sosai! Mun Gode! 😊',
            subtitle:
                "Muna matukar jin dadin yadda kake cin moriyar sabis dinmu. Taimaka mana da taurari a Play Store domin sauran 'yan uwa su amfana!",
            buttonLabel: 'Bamu Taurari a Play Store ⭐',
            badge: 'GREAT SERVICE',
            badgeBg: '#ECFDF5',
            badgeColor: '#065F46',
        },
        3: {
            emoji: '💡',
            title: 'Da Kyau! Yaya Za Mu Inganta? 🤔',
            subtitle:
                "Muna son jin ra'ayinka don mu kara inganta ayyukanmu. Sanar da mu abinda kake son mu kyautata domin ka ji dadi 100%.",
            buttonLabel: 'Tura Mana Shawara / Korafe 💬',
            badge: 'WE WANT TO IMPROVE',
            badgeBg: '#EFF6FF',
            badgeColor: '#1E40AF',
        },
        2: {
            emoji: '🙏',
            title: 'Muna Neman Afuwa! 😔',
            subtitle:
                'Yi hakuri idan ka fuskanci wata matsala ko tsaiko. Da fatan zaka sanar da mu kai tsaye ta WhatsApp/Support don mu warware maka nan take!',
            buttonLabel: 'Tuntuɓi Support Nan Take 💬',
            badge: 'NEED HELP?',
            badgeBg: '#FFFBEB',
            badgeColor: '#92400E',
        },
        1: {
            emoji: '🤝',
            title: 'Kayi Hakuri, Za Mu Gyara! 💔',
            subtitle:
                'Kada ka damu, muna nan don taimaka maka. Tuntuɓi sashen tallafinmu kai tsaye domin mu gano matsalar tare da magance ta cikin gaggawa.',
            buttonLabel: 'Aiko Kuka ta WhatsApp 💬',
            badge: 'URGENT ASSISTANCE',
            badgeBg: '#FEF2F2',
            badgeColor: '#991B1B',
        },
    }[selectedStars as 1 | 2 | 3 | 4 | 5] || {
        emoji: '⭐',
        title: 'Bamu Ra\'ayinka!',
        subtitle: 'Yaya ka ji dadin amfani da ABU MAFHAL SUB?',
        buttonLabel: 'Bamu Taurari a Play Store',
        badge: 'RATING',
        badgeBg: '#FEF3C7',
        badgeColor: '#B45309',
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={s.backdrop}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <Animated.View
                            style={[
                                s.modalCard,
                                {
                                    opacity: opacityAnim,
                                    transform: [{ scale: scaleAnim }],
                                },
                            ]}
                        >
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
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                                        <Text style={{ fontSize: 32 }}>{dynamicContent.emoji}</Text>
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

                            {/* Body */}
                            <View style={s.bodyContent}>
                                <Text style={s.ratingTitle}>{dynamicContent.title}</Text>
                                <Text style={s.ratingSubtitle}>
                                    {dynamicContent.subtitle}
                                </Text>

                                {/* Interactive Star Bar */}
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
                                                            isFilled && s.starBgOrbActive,
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name={isFilled ? 'star' : 'star-outline'}
                                                            size={28}
                                                            color={isFilled ? '#F59E0B' : '#94A3B8'}
                                                        />
                                                    </LinearGradient>
                                                </Animated.View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Star Score Label */}
                                <View style={s.scorePill}>
                                    <Ionicons name="sparkles" size={13} color="#D97706" />
                                    <Text style={s.scorePillText}>
                                        {selectedStars} / 5 Stars Selected
                                    </Text>
                                </View>

                                {/* Primary Action Button */}
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
                                                size={20}
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
                                                size={20}
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
                                            Wani Lokaci (Remind Later)
                                        </Text>
                                    </TouchableOpacity>

                                    {!isHighRating && (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={handleRateOnPlayStore}
                                            style={s.forcePlayStoreBtn}
                                        >
                                            <Text style={s.forcePlayStoreText}>
                                                Ci gaba zuwa Play Store →
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Footer Opt-out */}
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={handleNeverAsk}
                                    style={s.neverAskBtn}
                                >
                                    <Text style={s.neverAskText}>
                                        Kada a sake nunawa (Don't ask again)
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
        backgroundColor: 'rgba(2, 6, 23, 0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 390,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    headerGradient: {
        paddingTop: 24,
        paddingBottom: 20,
        alignItems: 'center',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    emblemContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    emblemAura: {
        position: 'absolute',
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
    },
    emblemOrb: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FEF3C7',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
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
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 20,
        alignItems: 'center',
    },
    ratingTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 6,
    },
    ratingSubtitle: {
        fontSize: 12.5,
        lineHeight: 18.5,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10,
    },
    starTouchable: {
        padding: 4,
    },
    starBgOrb: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    starBgOrbActive: {
        borderColor: '#FDE68A',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
    },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 18,
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
        marginBottom: 12,
    },
    primaryBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    primaryBtnText: {
        fontSize: 14,
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
        marginBottom: 10,
    },
    remindLaterBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    remindLaterText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    forcePlayStoreBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    forcePlayStoreText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D97706',
    },
    neverAskBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    neverAskText: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#94A3B8',
        textDecorationLine: 'underline',
    },
});
