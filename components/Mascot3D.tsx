import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform, Text } from 'react-native';
import Svg, { 
    G, Circle, Rect, Path, Defs, LinearGradient as SvgGradient, 
    Stop, Filter, FeDropShadow, FeGaussianBlur 
} from 'react-native-svg';

interface Mascot3DProps {
    size?: number;
    mode?: 'idle' | 'waving' | 'excited' | 'thinking';
    isDarkMode?: boolean;
}

export default function Mascot3D({ size = 160, mode = 'waving', isDarkMode = false }: Mascot3DProps) {
    // Animation Values
    const floatAnim = useRef(new Animated.Value(0)).current;
    const breathAnim = useRef(new Animated.Value(1)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        // Continuous Floating Animation (Sine wave vertical movement)
        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -12,
                    duration: 2000,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        // Gentle Breathing Motion (Subtle scaling pulse)
        const breathLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(breathAnim, {
                    toValue: 1.04,
                    duration: 2200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(breathAnim, {
                    toValue: 0.98,
                    duration: 2200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Hand Waving Animation
        const waveLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(waveAnim, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: 0.8,
                    duration: 500,
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
                Animated.delay(3200),
                Animated.timing(blinkAnim, {
                    toValue: 0.1,
                    duration: 120,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 140,
                    useNativeDriver: true,
                }),
                Animated.delay(100),
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
            ])
        );

        // Pulsing Neon Visor Glow Loop
        const glowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.5,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        floatLoop.start();
        breathLoop.start();
        waveLoop.start();
        blinkLoop.start();
        glowLoop.start();

        return () => {
            floatLoop.stop();
            breathLoop.stop();
            waveLoop.stop();
            blinkLoop.stop();
            glowLoop.stop();
        };
    }, []);

    // Interpolate wave rotation
    const waveRotate = waveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '25deg'],
    });

    // Interpolate shadow scale (shrinks when floating higher)
    const shadowScale = floatAnim.interpolate({
        inputRange: [-12, 0],
        outputRange: [0.75, 1],
    });

    const shadowOpacity = floatAnim.interpolate({
        inputRange: [-12, 0],
        outputRange: [0.2, 0.45],
    });

    const scale = size / 200;

    return (
        <View style={[styles.container, { width: size, height: size + 20 }]}>
            {/* Animated Shadow underneath Mascot */}
            <Animated.View 
                style={[
                    styles.shadow, 
                    { 
                        width: size * 0.6, 
                        height: 12 * scale,
                        transform: [{ scaleX: shadowScale }],
                        opacity: shadowOpacity,
                        backgroundColor: isDarkMode ? '#08E4C7' : '#0E1A2E',
                    }
                ]} 
            />

            {/* 3D Floating & Breathing Mascot Canvas */}
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
                <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
                    <Defs>
                        {/* Metallic Head & Body Gradients */}
                        <SvgGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#1E293B" />
                            <Stop offset="50%" stopColor="#0E1A2E" />
                            <Stop offset="100%" stopColor="#060D1A" />
                        </SvgGradient>

                        <SvgGradient id="headGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#1E293B" />
                            <Stop offset="60%" stopColor="#0E1A2E" />
                            <Stop offset="100%" stopColor="#091322" />
                        </SvgGradient>

                        {/* Visor Cyan Neon Gradient */}
                        <SvgGradient id="visorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#08E4C7" />
                            <Stop offset="50%" stopColor="#02C39A" />
                            <Stop offset="100%" stopColor="#00A896" />
                        </SvgGradient>

                        {/* Gold Badge Gradient */}
                        <SvgGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FDE047" />
                            <Stop offset="50%" stopColor="#D9A73A" />
                            <Stop offset="100%" stopColor="#B45309" />
                        </SvgGradient>

                        {/* Ear Highlight Metallic */}
                        <SvgGradient id="earGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor="#D9A73A" />
                            <Stop offset="100%" stopColor="#08E4C7" />
                        </SvgGradient>
                    </Defs>

                    {/* Floating Tech Orbs/Sparkles background */}
                    <Circle cx="30" cy="50" r="4" fill="#08E4C7" opacity="0.6" />
                    <Circle cx="170" cy="40" r="5" fill="#D9A73A" opacity="0.7" />
                    <Circle cx="160" cy="140" r="3.5" fill="#08E4C7" opacity="0.5" />

                    {/* Antennas / Futuristic Headphones */}
                    <G id="headphones">
                        {/* Left Ear Cup */}
                        <Rect x="22" y="70" width="14" height="28" rx="7" fill="url(#earGradient)" />
                        <Circle cx="29" cy="84" r="4" fill="#08E4C7" />
                        
                        {/* Right Ear Cup */}
                        <Rect x="164" y="70" width="14" height="28" rx="7" fill="url(#earGradient)" />
                        <Circle cx="171" cy="84" r="4" fill="#08E4C7" />

                        {/* Top Headband */}
                        <Path d="M 32 75 A 68 68 0 0 1 168 75" stroke="url(#goldGradient)" strokeWidth="6" strokeLinecap="round" fill="none" />
                    </G>

                    {/* Cute Futuristic 3D Head */}
                    <Rect x="34" y="42" width="132" height="96" rx="42" fill="url(#headGradient)" stroke="#08E4C7" strokeWidth="2.5" />
                    
                    {/* Head 3D Specular Highlight */}
                    <Path d="M 54 50 Q 100 44 146 50" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="3" strokeLinecap="round" fill="none" />

                    {/* Visor Screen */}
                    <Rect x="48" y="58" width="104" height="62" rx="24" fill="#030712" stroke="#08E4C7" strokeWidth="1.5" />

                    {/* Visor Glass Reflection */}
                    <Path d="M 54 64 L 140 64 A 18 18 0 0 1 146 80 L 60 80 Z" fill="rgba(8, 228, 199, 0.12)" />

                    {/* Eyes - Left & Right */}
                    <G id="eyes">
                        {/* Left Eye */}
                        <Circle cx="78" cy="88" r="13" fill="url(#visorGradient)" />
                        <Circle cx="81" cy="85" r="4.5" fill="#FFFFFF" />
                        <Circle cx="75" cy="91" r="2" fill="#FFFFFF" opacity="0.8" />

                        {/* Right Eye */}
                        <Circle cx="122" cy="88" r="13" fill="url(#visorGradient)" />
                        <Circle cx="125" cy="85" r="4.5" fill="#FFFFFF" />
                        <Circle cx="119" cy="91" r="2" fill="#FFFFFF" opacity="0.8" />
                    </G>

                    {/* Happy Cute Mouth Curve */}
                    <Path d="M 92 104 Q 100 112 108 104" stroke="#08E4C7" strokeWidth="3" strokeLinecap="round" fill="none" />

                    {/* Cheeks Glow */}
                    <Circle cx="64" cy="98" r="6" fill="#F43F5E" opacity="0.35" />
                    <Circle cx="136" cy="98" r="6" fill="#F43F5E" opacity="0.35" />

                    {/* Robot Body */}
                    <Rect x="58" y="132" width="84" height="54" rx="24" fill="url(#bodyGradient)" stroke="#D9A73A" strokeWidth="2" />
                    
                    {/* ABUMAFHAL Gold Crest Shield Badge on Chest */}
                    <Circle cx="100" cy="156" r="14" fill="url(#goldGradient)" />
                    <Path d="M 94 156 L 100 149 L 106 156 L 100 163 Z" fill="#0E1A2E" />
                    <Circle cx="100" cy="156" r="3" fill="#08E4C7" />

                    {/* Left Arm (Resting) */}
                    <Rect x="36" y="138" width="18" height="34" rx="9" fill="url(#bodyGradient)" stroke="#08E4C7" strokeWidth="1.5" />
                    <Circle cx="45" cy="172" r="6" fill="url(#goldGradient)" />

                    {/* Right Arm (Waving) */}
                    <G transform="translate(146, 148) rotate(-25)">
                        <Rect x="0" y="0" width="18" height="34" rx="9" fill="url(#bodyGradient)" stroke="#08E4C7" strokeWidth="1.5" />
                        <Circle cx="9" cy="34" r="6" fill="url(#goldGradient)" />
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
    mascotWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    shadow: {
        position: 'absolute',
        bottom: 0,
        borderRadius: 99,
    },
});
