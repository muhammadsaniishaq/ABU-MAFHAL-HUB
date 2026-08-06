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
    // Animation Values
    const floatAnim = useRef(new Animated.Value(0)).current;
    const breathAnim = useRef(new Animated.Value(1)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const badgeFloatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Continuous Floating Animation (Sine wave vertical movement)
        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -8,
                    duration: 1800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        // Gentle Breathing Motion
        const breathLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(breathAnim, {
                    toValue: 1.04,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(breathAnim, {
                    toValue: 0.97,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Friendly Hand Waving Animation
        const waveLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(waveAnim, {
                    toValue: 1,
                    duration: 450,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: -0.2,
                    duration: 450,
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
                    duration: 600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Eye Blinking Loop
        const blinkLoop = Animated.loop(
            Animated.sequence([
                Animated.delay(3000),
                Animated.timing(blinkAnim, {
                    toValue: 0.1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 120,
                    useNativeDriver: true,
                }),
                Animated.delay(100),
                Animated.timing(blinkAnim, {
                    toValue: 0.1,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 110,
                    useNativeDriver: true,
                }),
            ])
        );

        // Speech Badge Floating Loop
        const badgeLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(badgeFloatAnim, {
                    toValue: -5,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(badgeFloatAnim, {
                    toValue: 2,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        floatLoop.start();
        breathLoop.start();
        waveLoop.start();
        blinkLoop.start();
        badgeLoop.start();

        return () => {
            floatLoop.stop();
            breathLoop.stop();
            waveLoop.stop();
            blinkLoop.stop();
            badgeLoop.stop();
        };
    }, []);

    // Interpolate shadow scale (shrinks when floating higher)
    const shadowScale = floatAnim.interpolate({
        inputRange: [-8, 0],
        outputRange: [0.75, 1],
    });

    const shadowOpacity = floatAnim.interpolate({
        inputRange: [-8, 0],
        outputRange: [0.2, 0.45],
    });

    const scale = size / 160;

    return (
        <View style={[styles.container, { width: size + 20, height: size + 24 }]}>
            
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

            {/* Dynamic 3D Floating Shadow */}
            <Animated.View 
                style={[
                    styles.shadow, 
                    { 
                        width: size * 0.65, 
                        height: 9 * scale,
                        transform: [{ scaleX: shadowScale }],
                        opacity: shadowOpacity,
                        backgroundColor: isDarkMode ? '#08E4C7' : '#0E1A2E',
                    }
                ]} 
            />

            {/* Handsome 3D Male Cartoon Character Levitation Wrapper */}
            <Animated.View
                style={[
                    styles.mascotWrapper,
                    {
                        transform: [
                            { translateY: floatAnim },
                            { scaleY: breathAnim },
                        ],
                    },
                ]}
            >
                <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
                    <Defs>
                        {/* Male Skin Tone 3D Gradient */}
                        <SvgGradient id="skin3dGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FFEDD5" />
                            <Stop offset="40%" stopColor="#FED7AA" />
                            <Stop offset="100%" stopColor="#FDBA74" />
                        </SvgGradient>

                        {/* Stylish Male Hair 3D Gradient */}
                        <SvgGradient id="hair3dGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#475569" />
                            <Stop offset="50%" stopColor="#1E293B" />
                            <Stop offset="100%" stopColor="#0F172A" />
                        </SvgGradient>

                        {/* Gold Hair Highlight */}
                        <SvgGradient id="hairGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FEF08A" />
                            <Stop offset="100%" stopColor="#D9A73A" />
                        </SvgGradient>

                        {/* Male Fintech Tech Jacket 3D Gradient */}
                        <SvgGradient id="jacket3dGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#1E293B" />
                            <Stop offset="60%" stopColor="#0E1A2E" />
                            <Stop offset="100%" stopColor="#060D1A" />
                        </SvgGradient>

                        {/* Mint Neon Collar Highlight */}
                        <SvgGradient id="mintCollarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#08E4C7" />
                            <Stop offset="100%" stopColor="#02C39A" />
                        </SvgGradient>
                    </Defs>

                    {/* Background Tech Sparkles */}
                    <Circle cx="18" cy="40" r="3" fill="#08E4C7" opacity="0.8" />
                    <Circle cx="142" cy="30" r="3.5" fill="#D9A73A" opacity="0.9" />
                    <Circle cx="138" cy="110" r="2.5" fill="#08E4C7" opacity="0.7" />

                    {/* Futuristic Headset/Earphone on Ear */}
                    <G id="headset">
                        <Rect x="20" y="60" width="10" height="20" rx="5" fill="#0E1A2E" stroke="#08E4C7" strokeWidth="1.2" />
                        <Circle cx="25" cy="70" r="3" fill="#08E4C7" />
                        <Path d="M 25 73 Q 32 84 42 82" stroke="#08E4C7" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </G>

                    {/* Male 3D Face Base */}
                    <Rect x="32" y="38" width="96" height="80" rx="36" fill="url(#skin3dGrad)" stroke="#FDBA74" strokeWidth="1" />

                    {/* Handsome Male 3D Hairstyle */}
                    <Path d="M 30 52 C 28 30, 48 18, 80 18 C 112 18, 132 30, 130 52 C 124 40, 110 32, 80 32 C 50 32, 36 40, 30 52 Z" fill="url(#hair3dGrad)" />
                    
                    {/* Stylish Hair Front Locks & Gold Highlights */}
                    <Path d="M 40 44 Q 54 28 72 38 Q 90 26 108 40 Q 120 46 124 54 Q 112 40 92 44 Q 74 38 56 46 Z" fill="url(#hair3dGrad)" />
                    <Path d="M 58 32 Q 74 24 90 30" stroke="url(#hairGoldGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                    {/* Handsome Eyebrows */}
                    <Path d="M 48 56 Q 58 50 68 56" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <Path d="M 92 56 Q 102 50 112 56" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                    {/* Cute Expressive Eyes (Animated Blinking) */}
                    <G id="eyes">
                        {/* Left Eye */}
                        <Circle cx="58" cy="68" r="9" fill="#0E1A2E" />
                        <Circle cx="58" cy="68" r="7" fill="#1E293B" />
                        <Circle cx="58" cy="68" r="4" fill="#08E4C7" />
                        <Circle cx="60" cy="65" r="3" fill="#FFFFFF" />
                        <Circle cx="56" cy="70" r="1.2" fill="#FFFFFF" opacity="0.8" />

                        {/* Right Eye */}
                        <Circle cx="102" cy="68" r="9" fill="#0E1A2E" />
                        <Circle cx="102" cy="68" r="7" fill="#1E293B" />
                        <Circle cx="102" cy="68" r="4" fill="#08E4C7" />
                        <Circle cx="104" cy="65" r="3" fill="#FFFFFF" />
                        <Circle cx="100" cy="70" r="1.2" fill="#FFFFFF" opacity="0.8" />
                    </G>

                    {/* Nose */}
                    <Path d="M 78 72 Q 80 77 82 76" stroke="#E5E7EB" strokeWidth="1.8" strokeLinecap="round" fill="none" />

                    {/* Handsome Warm Smile */}
                    <Path d="M 68 84 Q 80 94 92 84" stroke="#0E1A2E" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                    {/* Rosy Cheeks */}
                    <Circle cx="48" cy="78" r="5" fill="#F43F5E" opacity="0.25" />
                    <Circle cx="112" cy="78" r="5" fill="#F43F5E" opacity="0.25" />

                    {/* Male 3D Tech Hoodie / Jacket */}
                    <Rect x="40" y="106" width="80" height="46" rx="18" fill="url(#jacket3dGrad)" stroke="url(#mintCollarGrad)" strokeWidth="1.5" />
                    
                    {/* Inner Shirt Collar */}
                    <Path d="M 66 106 L 80 120 L 94 106 Z" fill="url(#mintCollarGrad)" />
                    <Path d="M 72 106 L 80 114 L 88 106 Z" fill="#FFFFFF" />

                    {/* Gold Zipper */}
                    <Path d="M 80 120 L 80 148" stroke="url(#hairGoldGrad)" strokeWidth="2" strokeDasharray="3 2" />

                    {/* ABUMAFHAL Gold Crest Shield Badge on Chest */}
                    <Circle cx="60" cy="126" r="6" fill="url(#hairGoldGrad)" />
                    <Path d="M 58 126 L 60 123 L 62 126 L 60 129 Z" fill="#0E1A2E" />

                    {/* Left Arm (Resting) */}
                    <Rect x="24" y="110" width="14" height="26" rx="7" fill="url(#jacket3dGrad)" stroke="#08E4C7" strokeWidth="1" />
                    <Circle cx="31" cy="136" r="5" fill="url(#skin3dGrad)" />

                    {/* Right Arm (Waving Hello 👋) */}
                    <G transform="translate(122, 116) rotate(-25)">
                        <Rect x="0" y="0" width="14" height="26" rx="7" fill="url(#jacket3dGrad)" stroke="#08E4C7" strokeWidth="1" />
                        <Circle cx="7" cy="26" r="5" fill="url(#skin3dGrad)" />
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
        top: -10,
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
    mascotWrapper: {
        alignItems: 'center',
        justify: 'center',
    },
    shadow: {
        position: 'absolute',
        bottom: 0,
        borderRadius: 99,
    },
});
