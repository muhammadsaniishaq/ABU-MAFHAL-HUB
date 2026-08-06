import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, Text, Platform } from 'react-native';
import Svg, { 
    G, Circle, Rect, Path, Defs, LinearGradient as SvgGradient, 
    Stop 
} from 'react-native-svg';

// Try importing lottie-react-native safely on native platforms only
let LottieView: any = null;
if (Platform.OS !== 'web') {
    try {
        LottieView = require('lottie-react-native');
    } catch (e) {
        LottieView = null;
    }
}

interface Mascot3DProps {
    size?: number;
    greetingText?: string;
    isDarkMode?: boolean;
}

export default function Mascot3D({ size = 110, greetingText = "Welcome Back! 👋", isDarkMode = false }: Mascot3DProps) {
    const [lottieFailed, setLottieFailed] = useState(false);

    // Multi-Joint 60FPS Fluid Animation Controllers
    const floatAnim = useRef(new Animated.Value(0)).current;
    const headBobAnim = useRef(new Animated.Value(0)).current;
    const headRotateAnim = useRef(new Animated.Value(0)).current;
    const armWaveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const badgeFloatAnim = useRef(new Animated.Value(0)).current;
    const eyePupilX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Continuous Floating & Peeking Motion
        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -8,
                    duration: 1500,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 2,
                    duration: 1500,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        // Natural Head Bobbing Motion
        const bobLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(headBobAnim, {
                    toValue: -4,
                    duration: 1200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(headBobAnim, {
                    toValue: 2,
                    duration: 1200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Head Rotation (Curious Tilt)
        const rotateLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(headRotateAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(headRotateAnim, {
                    toValue: -1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Arm Gesturing & Waving Motion
        const waveLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(armWaveAnim, {
                    toValue: 1,
                    duration: 400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(armWaveAnim, {
                    toValue: -0.2,
                    duration: 400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(armWaveAnim, {
                    toValue: 0.8,
                    duration: 350,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(armWaveAnim, {
                    toValue: 0,
                    duration: 650,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Eye Blinking Loop
        const blinkLoop = Animated.loop(
            Animated.sequence([
                Animated.delay(2400),
                Animated.timing(blinkAnim, {
                    toValue: 0.05,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.delay(100),
                Animated.timing(blinkAnim, {
                    toValue: 0.05,
                    duration: 70,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 90,
                    useNativeDriver: true,
                }),
            ])
        );

        // Eye Pupil Looking Left/Right Motion
        const pupilLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(eyePupilX, { toValue: -2, duration: 1800, useNativeDriver: true }),
                Animated.timing(eyePupilX, { toValue: 2, duration: 1800, useNativeDriver: true }),
            ])
        );

        // Floating Speech Badge Loop
        const badgeLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(badgeFloatAnim, {
                    toValue: -6,
                    duration: 1300,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(badgeFloatAnim, {
                    toValue: 2,
                    duration: 1300,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        floatLoop.start();
        bobLoop.start();
        rotateLoop.start();
        waveLoop.start();
        blinkLoop.start();
        pupilLoop.start();
        badgeLoop.start();

        return () => {
            floatLoop.stop();
            bobLoop.stop();
            rotateLoop.stop();
            waveLoop.stop();
            blinkLoop.stop();
            pupilLoop.stop();
            badgeLoop.stop();
        };
    }, []);

    const headRotation = headRotateAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-4deg', '4deg'],
    });

    const armRotation = armWaveAnim.interpolate({
        inputRange: [-0.2, 1],
        outputRange: ['-10deg', '25deg'],
    });

    return (
        <View style={[styles.container, { width: size + 28, height: size + 22 }]}>
            
            {/* Animated Floating Speech Greeting Badge */}
            {greetingText ? (
                <Animated.View 
                    style={[
                        styles.greetingBadge, 
                        { 
                            transform: [{ translateY: badgeFloatAnim }],
                            backgroundColor: isDarkMode ? '#0E1A2E' : '#FFFFFF',
                            borderColor: isDarkMode ? '#08E4C7' : '#D9A73A',
                        }
                    ]}
                >
                    <Text style={[styles.greetingText, { color: isDarkMode ? '#08E4C7' : '#0E1A2E' }]}>
                        {greetingText}
                    </Text>
                </Animated.View>
            ) : null}

            {/* If Lottie is available and loaded, render 3D Lottie Male Avatar Animation */}
            {LottieView && !lottieFailed ? (
                <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                    <LottieView
                        source={{ uri: 'https://assets5.lottiefiles.com/packages/lf20_w51pcehl.json' }}
                        autoPlay
                        loop
                        style={{ width: size * 1.1, height: size * 1.1 }}
                        onError={() => setLottieFailed(true)}
                    />
                </View>
            ) : (
                /* High-End 60FPS Multi-Joint 3D Male Cartoon Character (Matches reference images) */
                <Animated.View
                    style={[
                        styles.characterWrapper,
                        {
                            transform: [
                                { translateY: floatAnim },
                            ],
                        },
                    ]}
                >
                    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
                        <Defs>
                            {/* 3D Skin Gradient */}
                            <SvgGradient id="skin3d" x1="0%" y1="0%" x2="100%" y2="100%">
                                <Stop offset="0%" stopColor="#FFF7ED" />
                                <Stop offset="40%" stopColor="#FED7AA" />
                                <Stop offset="100%" stopColor="#FDBA74" />
                            </SvgGradient>

                            {/* 3D Hair Gradient */}
                            <SvgGradient id="hair3d" x1="0%" y1="0%" x2="100%" y2="100%">
                                <Stop offset="0%" stopColor="#475569" />
                                <Stop offset="50%" stopColor="#1E293B" />
                                <Stop offset="100%" stopColor="#0F172A" />
                            </SvgGradient>

                            {/* Gold Highlight */}
                            <SvgGradient id="goldHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                                <Stop offset="0%" stopColor="#FEF08A" />
                                <Stop offset="100%" stopColor="#D9A73A" />
                            </SvgGradient>

                            {/* 3D Suit Gradient */}
                            <SvgGradient id="suit3d" x1="0%" y1="0%" x2="100%" y2="100%">
                                <Stop offset="0%" stopColor="#1E293B" />
                                <Stop offset="60%" stopColor="#0E1A2E" />
                                <Stop offset="100%" stopColor="#060D1A" />
                            </SvgGradient>

                            {/* Glasses Metal */}
                            <SvgGradient id="glassesMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                                <Stop offset="0%" stopColor="#334155" />
                                <Stop offset="50%" stopColor="#0F172A" />
                                <Stop offset="100%" stopColor="#020617" />
                            </SvgGradient>
                        </Defs>

                        {/* Ambient Aura Glow */}
                        <Circle cx="80" cy="80" r="72" fill={isDarkMode ? "#08E4C7" : "#D9A73A"} opacity="0.08" />

                        {/* Navy Suit / Sweater (Reference Image 1 & 2) */}
                        <G id="torso">
                            <Path d="M 30 118 C 30 102, 50 94, 80 94 C 110 94, 130 102, 130 118 L 134 160 L 26 160 Z" fill="url(#suit3d)" />
                            <Path d="M 64 94 L 80 120 L 96 94 Z" fill="#FFFFFF" />
                            <Path d="M 72 94 L 80 106 L 88 94 Z" fill="#F1F5F9" />
                            <Path d="M 76 102 L 84 102 L 82 136 L 80 142 L 78 136 Z" fill="#0284C7" />
                            <Path d="M 76 102 L 84 102 L 82 110 L 78 110 Z" fill="url(#goldHighlight)" />
                        </G>

                        {/* Neck */}
                        <Rect x="70" y="78" width="20" height="20" rx="6" fill="url(#skin3d)" />

                        {/* Animated Head (Bobbing & Tilting) */}
                        <G id="headGroup">
                            {/* Ears */}
                            <Circle cx="34" cy="58" r="8" fill="url(#skin3d)" />
                            <Circle cx="34" cy="58" r="5" fill="#FDBA74" opacity="0.5" />
                            <Circle cx="126" cy="58" r="8" fill="url(#skin3d)" />
                            <Circle cx="126" cy="58" r="5" fill="#FDBA74" opacity="0.5" />

                            {/* Main 3D Face Contour */}
                            <Rect x="38" y="24" width="84" height="70" rx="34" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="0.8" />

                            {/* Beard / Stubble Contour (Reference Image 1) */}
                            <Path d="M 42 62 C 42 84, 56 94, 80 94 C 104 94, 118 84, 118 62 C 118 74, 102 90, 80 90 C 58 90, 42 74, 42 62 Z" fill="#334155" opacity="0.32" />

                            {/* Hair Style */}
                            <Path d="M 34 40 C 30 16, 52 4, 80 4 C 108 4, 130 16, 126 40 C 120 26, 108 16, 80 18 C 52 16, 40 26, 34 40 Z" fill="url(#hair3d)" />
                            <Path d="M 42 28 Q 62 14 82 20 Q 102 12 116 28 Q 102 18 82 22 Q 62 16 42 28 Z" fill="url(#goldHighlight)" opacity="0.85" />

                            {/* Eyebrows */}
                            <Path d="M 48 42 Q 58 36 68 42" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
                            <Path d="M 92 42 Q 102 36 112 42" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />

                            {/* Cartoon Eyes */}
                            <G id="eyes">
                                <Circle cx="58" cy="52" r="9" fill="#FFFFFF" />
                                <Circle cx="59" cy="52" r="5.5" fill="#0F172A" />
                                <Circle cx="59" cy="52" r="3" fill="#0284C7" />
                                <Circle cx="61" cy="50" r="2.2" fill="#FFFFFF" />

                                <Circle cx="102" cy="52" r="9" fill="#FFFFFF" />
                                <Circle cx="101" cy="52" r="5.5" fill="#0F172A" />
                                <Circle cx="101" cy="52" r="3" fill="#0284C7" />
                                <Circle cx="103" cy="50" r="2.2" fill="#FFFFFF" />
                            </G>

                            {/* 3D Glasses (Reference Image 1) */}
                            <G id="glasses">
                                <Rect x="44" y="40" width="28" height="22" rx="8" fill="none" stroke="url(#glassesMetal)" strokeWidth="3.5" />
                                <Rect x="46" y="42" width="24" height="18" rx="6" fill="#0284C7" opacity="0.12" />
                                <Path d="M 48 44 L 58 44" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

                                <Rect x="88" y="40" width="28" height="22" rx="8" fill="none" stroke="url(#glassesMetal)" strokeWidth="3.5" />
                                <Rect x="90" y="42" width="24" height="18" rx="6" fill="#0284C7" opacity="0.12" />
                                <Path d="M 92 44 L 102 44" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

                                <Path d="M 72 48 Q 80 44 88 48" stroke="url(#glassesMetal)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                                <Path d="M 44 48 L 35 46" stroke="url(#glassesMetal)" strokeWidth="3" strokeLinecap="round" />
                                <Path d="M 116 48 L 125 46" stroke="url(#glassesMetal)" strokeWidth="3" strokeLinecap="round" />
                            </G>

                            {/* Nose */}
                            <Path d="M 78 56 Q 80 62 82 60" stroke="#FDBA74" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                            {/* Warm Smile */}
                            <Path d="M 66 70 Q 80 82 94 70" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
                            <Path d="M 70 72 Q 80 79 90 72" fill="#FFFFFF" />

                            {/* Rosy Cheeks */}
                            <Circle cx="46" cy="62" r="5" fill="#F43F5E" opacity="0.22" />
                            <Circle cx="114" cy="62" r="5" fill="#F43F5E" opacity="0.22" />
                        </G>

                        {/* Hands Peeking over Card & Smartphone (Reference Image 1 & 2) */}
                        <G id="handsPeeking">
                            <Rect x="36" y="108" width="24" height="14" rx="7" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="1" />
                            <Circle cx="42" cy="115" r="3" fill="#FED7AA" />
                            <Circle cx="48" cy="115" r="3" fill="#FED7AA" />
                            <Circle cx="54" cy="115" r="3" fill="#FED7AA" />

                            {/* Right Hand Holding Smartphone */}
                            <G transform="translate(98, 98)">
                                <Rect x="0" y="0" width="22" height="36" rx="5" fill="#0E1A2E" stroke="#08E4C7" strokeWidth="1.5" />
                                <Rect x="2" y="3" width="18" height="28" rx="3" fill="#08E4C7" opacity="0.9" />
                                <Rect x="5" y="8" width="12" height="2" rx="1" fill="#0E1A2E" />
                                <Rect x="5" y="13" width="8" height="2" rx="1" fill="#0E1A2E" />
                                <Circle cx="11" cy="24" r="3" fill="#D9A73A" />
                                <Rect x="-6" y="10" width="10" height="16" rx="5" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="0.8" />
                            </G>
                        </G>
                    </Svg>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    greetingBadge: {
        position: 'absolute',
        top: -12,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 99,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    greetingText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    characterWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
