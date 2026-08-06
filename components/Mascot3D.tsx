import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { 
    G, Circle, Rect, Path, Defs, LinearGradient as SvgGradient, 
    Stop, Ellipse 
} from 'react-native-svg';

interface Mascot3DProps {
    size?: number;
    mode?: 'idle' | 'waving' | 'excited' | 'thinking';
    isDarkMode?: boolean;
}

export default function Mascot3D({ size = 110, mode = 'waving', isDarkMode = false }: Mascot3DProps) {
    // Animation Values
    const floatAnim = useRef(new Animated.Value(0)).current;
    const breathAnim = useRef(new Animated.Value(1)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const orbSpinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Continuous Floating Animation (Sine wave vertical movement)
        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -9,
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

        // Gentle Breathing Motion (Subtle scaling pulse)
        const breathLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(breathAnim, {
                    toValue: 1.05,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(breathAnim, {
                    toValue: 0.96,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );

        // Hand Waving Animation (Game Cartoon Style)
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
                    duration: 600,
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
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 120,
                    useNativeDriver: true,
                }),
                Animated.delay(120),
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
            ])
        );

        // Game Orb Orbit Rotation Loop
        const orbLoop = Animated.loop(
            Animated.timing(orbSpinAnim, {
                toValue: 1,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        floatLoop.start();
        breathLoop.start();
        waveLoop.start();
        blinkLoop.start();
        orbLoop.start();

        return () => {
            floatLoop.stop();
            breathLoop.stop();
            waveLoop.stop();
            blinkLoop.stop();
            orbLoop.stop();
        };
    }, []);

    // Interpolate shadow scale (shrinks when floating higher)
    const shadowScale = floatAnim.interpolate({
        inputRange: [-9, 0],
        outputRange: [0.7, 1],
    });

    const shadowOpacity = floatAnim.interpolate({
        inputRange: [-9, 0],
        outputRange: [0.2, 0.5],
    });

    const waveRotate = waveAnim.interpolate({
        inputRange: [-0.3, 1],
        outputRange: ['-10deg', '30deg'],
    });

    const orbRotate = orbSpinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const scale = size / 160;

    return (
        <View style={[styles.container, { width: size, height: size + 14 }]}>
            {/* Dynamic 3D Floating Game Shadow */}
            <Animated.View 
                style={[
                    styles.shadow, 
                    { 
                        width: size * 0.65, 
                        height: 10 * scale,
                        transform: [{ scaleX: shadowScale }],
                        opacity: shadowOpacity,
                        backgroundColor: isDarkMode ? '#08E4C7' : '#0E1A2E',
                    }
                ]} 
            />

            {/* 3D Game Cartoon Robot Body Levitation Container */}
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
                        {/* 3D Sphere Head Gradient */}
                        <SvgGradient id="head3dGrad" x1="20%" y1="10%" x2="80%" y2="90%">
                            <Stop offset="0%" stopColor="#334155" />
                            <Stop offset="30%" stopColor="#1E293B" />
                            <Stop offset="75%" stopColor="#0E1A2E" />
                            <Stop offset="100%" stopColor="#060D1A" />
                        </SvgGradient>

                        {/* Visor Glass Neon Gradient */}
                        <SvgGradient id="visor3dGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#08E4C7" />
                            <Stop offset="50%" stopColor="#02C39A" />
                            <Stop offset="100%" stopColor="#0077B6" />
                        </SvgGradient>

                        {/* 3D Gold Accent Gradient */}
                        <SvgGradient id="gold3dGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FEF08A" />
                            <Stop offset="40%" stopColor="#F59E0B" />
                            <Stop offset="100%" stopColor="#B45309" />
                        </SvgGradient>

                        {/* Ear Metallic Cup */}
                        <SvgGradient id="metalCupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#94A3B8" />
                            <Stop offset="50%" stopColor="#475569" />
                            <Stop offset="100%" stopColor="#0F172A" />
                        </SvgGradient>

                        {/* Chest Power Core Orb */}
                        <SvgGradient id="coreOrbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FFFFFF" />
                            <Stop offset="40%" stopColor="#08E4C7" />
                            <Stop offset="100%" stopColor="#0F766E" />
                        </SvgGradient>
                    </Defs>

                    {/* Floating Game Particles */}
                    <Circle cx="20" cy="35" r="3.5" fill="#08E4C7" opacity="0.8" />
                    <Circle cx="140" cy="25" r="4" fill="#F59E0B" opacity="0.9" />
                    <Circle cx="135" cy="115" r="3" fill="#08E4C7" opacity="0.7" />

                    {/* Game Halo Ring Above Head */}
                    <Ellipse cx="80" cy="18" rx="34" ry="7" fill="none" stroke="url(#gold3dGrad)" strokeWidth="3" opacity="0.9" />

                    {/* Antenna Crown */}
                    <Path d="M 80 18 L 80 32" stroke="url(#gold3dGrad)" strokeWidth="4" strokeLinecap="round" />
                    <Circle cx="80" cy="14" r="5" fill="#08E4C7" />

                    {/* Headphones / Side Boosters */}
                    <G id="earBoosters">
                        <Rect x="16" y="52" width="12" height="24" rx="6" fill="url(#metalCupGrad)" />
                        <Circle cx="22" cy="64" r="3.5" fill="#08E4C7" />

                        <Rect x="132" y="52" width="12" height="24" rx="6" fill="url(#metalCupGrad)" />
                        <Circle cx="138" cy="64" r="3.5" fill="#08E4C7" />
                    </G>

                    {/* 3D Round Cartoon Robot Head */}
                    <Rect x="26" y="30" width="108" height="82" rx="41" fill="url(#head3dGrad)" stroke="#08E4C7" strokeWidth="2" />
                    
                    {/* Head 3D Light Specular Highlight Arc */}
                    <Path d="M 44 38 Q 80 33 116 38" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                    {/* Visor Screen Box */}
                    <Rect x="38" y="44" width="84" height="52" rx="20" fill="#030712" stroke="#08E4C7" strokeWidth="1.2" />

                    {/* Visor 3D Light Sheen */}
                    <Path d="M 44 48 L 114 48 Q 118 60 114 62 L 48 62 Z" fill="rgba(8, 228, 199, 0.14)" />

                    {/* Game Character Glowing Eyes */}
                    <G id="eyes3d">
                        {/* Left Pupil */}
                        <Circle cx="62" cy="68" r="10" fill="url(#visor3dGrad)" />
                        <Circle cx="64" cy="65" r="3.5" fill="#FFFFFF" />
                        <Circle cx="59" cy="71" r="1.5" fill="#FFFFFF" opacity="0.8" />

                        {/* Right Pupil */}
                        <Circle cx="98" cy="68" r="10" fill="url(#visor3dGrad)" />
                        <Circle cx="100" cy="65" r="3.5" fill="#FFFFFF" />
                        <Circle cx="95" cy="71" r="1.5" fill="#FFFFFF" opacity="0.8" />
                    </G>

                    {/* Cute Game Smile Line */}
                    <Path d="M 73 82 Q 80 88 87 82" stroke="#08E4C7" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                    {/* Game Blush Cheek Glow */}
                    <Circle cx="51" cy="76" r="4.5" fill="#F43F5E" opacity="0.35" />
                    <Circle cx="109" cy="76" r="4.5" fill="#F43F5E" opacity="0.35" />

                    {/* 3D Robot Body */}
                    <Rect x="46" y="108" width="68" height="42" rx="20" fill="url(#head3dGrad)" stroke="url(#gold3dGrad)" strokeWidth="1.8" />

                    {/* Glowing Chest Game Energy Core */}
                    <Circle cx="80" cy="128" r="11" fill="url(#coreOrbGrad)" stroke="#FFFFFF" strokeWidth="1" />
                    <Path d="M 76 128 L 80 123 L 84 128 L 80 133 Z" fill="#0E1A2E" />

                    {/* Left Arm */}
                    <Rect x="28" y="112" width="14" height="26" rx="7" fill="url(#head3dGrad)" stroke="#08E4C7" strokeWidth="1.2" />
                    <Circle cx="35" cy="138" r="5" fill="url(#gold3dGrad)" />

                    {/* Right Arm (Animated Wave) */}
                    <G transform="translate(116, 120) rotate(-20)">
                        <Rect x="0" y="0" width="14" height="26" rx="7" fill="url(#head3dGrad)" stroke="#08E4C7" strokeWidth="1.2" />
                        <Circle cx="7" cy="26" r="5" fill="url(#gold3dGrad)" />
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
