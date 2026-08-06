import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { 
    G, Circle, Rect, Path, Defs, LinearGradient as SvgGradient, 
    Stop, Ellipse 
} from 'react-native-svg';

interface Mascot3DProps {
    size?: number;
    greetingText?: string;
    isDarkMode?: boolean;
}

export default function Mascot3D({ size = 110, greetingText = "Welcome Back! 👋", isDarkMode = false }: Mascot3DProps) {
    // Animation Controllers for "Motional" Character
    const floatAnim = useRef(new Animated.Value(0)).current;
    const peekAnim = useRef(new Animated.Value(0)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const headTiltAnim = useRef(new Animated.Value(0)).current;
    const badgeFloatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Continuous Peeking / Bobbing Motion (Peeking over card)
        const peekLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(peekAnim, {
                    toValue: -6,
                    duration: 1600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(peekAnim, {
                    toValue: 2,
                    duration: 1600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        // Head Tilt Motion (Life-like head movement)
        const tiltLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(headTiltAnim, {
                    toValue: 1,
                    duration: 2200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(headTiltAnim, {
                    toValue: -1,
                    duration: 2200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Phone / Hand Gesturing Motion
        const waveLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(waveAnim, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: -0.3,
                    duration: 500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: 0.8,
                    duration: 400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: 0,
                    duration: 700,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Eye Blinking Loop
        const blinkLoop = Animated.loop(
            Animated.sequence([
                Animated.delay(2800),
                Animated.timing(blinkAnim, {
                    toValue: 0.1,
                    duration: 90,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 110,
                    useNativeDriver: true,
                }),
                Animated.delay(120),
                Animated.timing(blinkAnim, {
                    toValue: 0.1,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ])
        );

        // Speech Badge Floating Loop
        const badgeLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(badgeFloatAnim, {
                    toValue: -5,
                    duration: 1400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(badgeFloatAnim, {
                    toValue: 2,
                    duration: 1400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        peekLoop.start();
        tiltLoop.start();
        waveLoop.start();
        blinkLoop.start();
        badgeLoop.start();

        return () => {
            peekLoop.stop();
            tiltLoop.stop();
            waveLoop.stop();
            blinkLoop.stop();
            badgeLoop.stop();
        };
    }, []);

    // Interpolate head tilt rotation angle
    const headRotation = headTiltAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-3deg', '3deg'],
    });

    const scale = size / 130;

    return (
        <View style={[styles.container, { width: size + 24, height: size + 20 }]}>
            
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

            {/* Motional Male Cartoon Character (Disney/Pixar Style as in reference images) */}
            <Animated.View
                style={[
                    styles.characterWrapper,
                    {
                        transform: [
                            { translateY: peekAnim },
                            { rotate: headRotation },
                        ],
                    },
                ]}
            >
                <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
                    <Defs>
                        {/* 3D Skin Gradient */}
                        <SvgGradient id="skin3d" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FFF7ED" />
                            <Stop offset="35%" stopColor="#FED7AA" />
                            <Stop offset="100%" stopColor="#FDBA74" />
                        </SvgGradient>

                        {/* 3D Volumetric Hair Gradient */}
                        <SvgGradient id="hair3d" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#475569" />
                            <Stop offset="45%" stopColor="#1E293B" />
                            <Stop offset="100%" stopColor="#0F172A" />
                        </SvgGradient>

                        {/* Gold Hair Highlight */}
                        <SvgGradient id="goldHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FEF08A" />
                            <Stop offset="100%" stopColor="#D9A73A" />
                        </SvgGradient>

                        {/* 3D Navy Suit / Sweater Gradient */}
                        <SvgGradient id="suit3d" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#1E293B" />
                            <Stop offset="50%" stopColor="#0E1A2E" />
                            <Stop offset="100%" stopColor="#060D1A" />
                        </SvgGradient>

                        {/* Glasses Frame Metallic Gradient */}
                        <SvgGradient id="glassesMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#334155" />
                            <Stop offset="50%" stopColor="#0F172A" />
                            <Stop offset="100%" stopColor="#020617" />
                        </SvgGradient>
                    </Defs>

                    {/* Background Glow */}
                    <Circle cx="80" cy="80" r="70" fill={isDarkMode ? "#08E4C7" : "#D9A73A"} opacity="0.08" />

                    {/* 3D Navy Suit / Sweater (As in reference images) */}
                    <G id="torso">
                        <Path d="M 32 120 C 32 105, 50 96, 80 96 C 110 96, 128 105, 128 120 L 132 160 L 28 160 Z" fill="url(#suit3d)" />
                        
                        {/* White Collared Shirt */}
                        <Path d="M 64 96 L 80 122 L 96 96 Z" fill="#FFFFFF" />
                        <Path d="M 72 96 L 80 108 L 88 96 Z" fill="#F1F5F9" />

                        {/* Stylish Blue Tie */}
                        <Path d="M 76 104 L 84 104 L 82 136 L 80 142 L 78 136 Z" fill="#0284C7" />
                        <Path d="M 76 104 L 84 104 L 82 112 L 78 112 Z" fill="url(#goldHighlight)" />
                    </G>

                    {/* Neck */}
                    <Rect x="70" y="80" width="20" height="20" rx="6" fill="url(#skin3d)" />
                    <Path d="M 70 92 Q 80 98 90 92" stroke="#FDBA74" strokeWidth="2" fill="none" />

                    {/* 3D Head Base */}
                    <G id="head">
                        {/* Ears */}
                        <Circle cx="35" cy="62" r="8" fill="url(#skin3d)" />
                        <Circle cx="35" cy="62" r="5" fill="#FDBA74" opacity="0.5" />
                        
                        <Circle cx="125" cy="62" r="8" fill="url(#skin3d)" />
                        <Circle cx="125" cy="62" r="5" fill="#FDBA74" opacity="0.5" />

                        {/* Main Face Contour */}
                        <Rect x="38" y="28" width="84" height="70" rx="34" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="0.8" />

                        {/* Neat Beard & Stubble Contour (As in Reference Image 1) */}
                        <Path d="M 42 66 C 42 88, 56 98, 80 98 C 104 98, 118 88, 118 66 C 118 78, 102 94, 80 94 C 58 94, 42 78, 42 66 Z" fill="#334155" opacity="0.35" />
                        <Path d="M 68 84 Q 80 90 92 84 Q 80 96 68 84 Z" fill="#1E293B" opacity="0.25" />

                        {/* 3D Volumetric Hair Style (As in Reference Image 1 & 2) */}
                        <Path d="M 34 44 C 30 20, 52 8, 80 8 C 108 8, 130 20, 126 44 C 120 30, 108 20, 80 20 C 52 20, 40 30, 34 44 Z" fill="url(#hair3d)" />
                        <Path d="M 38 34 Q 56 12 80 14 Q 104 12 122 34 Q 110 24 80 26 Q 50 24 38 34 Z" fill="url(#hair3d)" />
                        
                        {/* Front Hair Locks & Gold Specular Highlights */}
                        <Path d="M 44 32 Q 62 18 82 24 Q 102 16 116 32 Q 102 22 82 26 Q 62 20 44 32 Z" fill="url(#goldHighlight)" opacity="0.85" />

                        {/* Handsome Eyebrows */}
                        <Path d="M 48 46 Q 58 40 68 46" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
                        <Path d="M 92 46 Q 102 40 112 46" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />

                        {/* Expressive Friendly Cartoon Eyes */}
                        <G id="eyes">
                            {/* Left Eye */}
                            <Circle cx="58" cy="56" r="9" fill="#FFFFFF" />
                            <Circle cx="59" cy="56" r="5.5" fill="#0F172A" />
                            <Circle cx="59" cy="56" r="3" fill="#0284C7" />
                            <Circle cx="61" cy="54" r="2.2" fill="#FFFFFF" />

                            {/* Right Eye */}
                            <Circle cx="102" cy="56" r="9" fill="#FFFFFF" />
                            <Circle cx="101" cy="56" r="5.5" fill="#0F172A" />
                            <Circle cx="101" cy="56" r="3" fill="#0284C7" />
                            <Circle cx="103" cy="54" r="2.2" fill="#FFFFFF" />
                        </G>

                        {/* Stylish 3D Glasses (As in Reference Image 1) */}
                        <G id="glasses">
                            {/* Left Lens Frame */}
                            <Rect x="44" y="44" width="28" height="22" rx="8" fill="none" stroke="url(#glassesMetal)" strokeWidth="3.5" />
                            <Rect x="46" y="46" width="24" height="18" rx="6" fill="#0284C7" opacity="0.12" />
                            <Path d="M 48 48 L 58 48" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

                            {/* Right Lens Frame */}
                            <Rect x="88" y="44" width="28" height="22" rx="8" fill="none" stroke="url(#glassesMetal)" strokeWidth="3.5" />
                            <Rect x="90" y="46" width="24" height="18" rx="6" fill="#0284C7" opacity="0.12" />
                            <Path d="M 92 48 L 102 48" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

                            {/* Bridge */}
                            <Path d="M 72 52 Q 80 48 88 52" stroke="url(#glassesMetal)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                            
                            {/* Frame Temples */}
                            <Path d="M 44 52 L 35 50" stroke="url(#glassesMetal)" strokeWidth="3" strokeLinecap="round" />
                            <Path d="M 116 52 L 125 50" stroke="url(#glassesMetal)" strokeWidth="3" strokeLinecap="round" />
                        </G>

                        {/* Nose */}
                        <Path d="M 78 60 Q 80 66 82 64" stroke="#FDBA74" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                        {/* Warm Smile */}
                        <Path d="M 66 74 Q 80 86 94 74" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
                        <Path d="M 70 76 Q 80 83 90 76" fill="#FFFFFF" />

                        {/* Rosy Cheeks */}
                        <Circle cx="46" cy="66" r="5" fill="#F43F5E" opacity="0.22" />
                        <Circle cx="114" cy="66" r="5" fill="#F43F5E" opacity="0.22" />
                    </G>

                    {/* Hands Peeking & Holding Smartphone (As in Reference Image 1 & 2) */}
                    <G id="handsPeeking">
                        {/* Left Hand Resting on Card Ledge */}
                        <Rect x="36" y="112" width="24" height="14" rx="7" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="1" />
                        <Circle cx="42" cy="119" r="3" fill="#FED7AA" />
                        <Circle cx="48" cy="119" r="3" fill="#FED7AA" />
                        <Circle cx="54" cy="119" r="3" fill="#FED7AA" />

                        {/* Right Hand Holding Glowing Smartphone (Reference Image 2) */}
                        <G transform="translate(98, 102)">
                            {/* Smartphone Body */}
                            <Rect x="0" y="0" width="22" height="36" rx="5" fill="#0E1A2E" stroke="#08E4C7" strokeWidth="1.5" />
                            <Rect x="2" y="3" width="18" height="28" rx="3" fill="#08E4C7" opacity="0.9" />
                            {/* Phone Screen App Lines */}
                            <Rect x="5" y="8" width="12" height="2" rx="1" fill="#0E1A2E" />
                            <Rect x="5" y="13" width="8" height="2" rx="1" fill="#0E1A2E" />
                            <Circle cx="11" cy="24" r="3" fill="#D9A73A" />

                            {/* Fingers Wrapping Around Phone */}
                            <Rect x="-6" y="10" width="10" height="16" rx="5" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="0.8" />
                        </G>
                    </G>
                </Svg>
            </Animated.View>
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
