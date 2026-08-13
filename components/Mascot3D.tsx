import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, Text, Platform, Image } from 'react-native';
import Svg, { 
    G, Circle, Rect, Path, Defs, LinearGradient as SvgGradient, 
    Stop 
} from 'react-native-svg';

const useNative = Platform.OS !== 'web';

interface Mascot3DProps {
    size?: number;
    greetingText?: string;
    isDarkMode?: boolean;
}

export default function Mascot3D({ size = 110, greetingText = "Welcome Back! 👋", isDarkMode = false }: Mascot3DProps) {
    const floatAnim = useRef(new Animated.Value(0)).current;
    const headBobAnim = useRef(new Animated.Value(0)).current;
    const headRotateAnim = useRef(new Animated.Value(0)).current;
    const armWaveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const badgeFloatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -6,
                    duration: 1600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: useNative,
                }),
                Animated.timing(floatAnim, {
                    toValue: 2,
                    duration: 1600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: useNative,
                }),
            ])
        );

        const badgeLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(badgeFloatAnim, {
                    toValue: -5,
                    duration: 1400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: useNative,
                }),
                Animated.timing(badgeFloatAnim, {
                    toValue: 2,
                    duration: 1400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: useNative,
                }),
            ])
        );

        floatLoop.start();
        badgeLoop.start();

        return () => {
            floatLoop.stop();
            badgeLoop.stop();
        };
    }, []);

    // Web Fallback: Render crisp brand logo image to ensure 100% web stability
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.container, { width: size + 28, height: size + 16 }]}>
                {greetingText ? (
                    <View 
                        style={[
                            styles.greetingBadge, 
                            { 
                                backgroundColor: isDarkMode ? '#0E1A2E' : '#FFFFFF',
                                borderColor: isDarkMode ? '#08E4C7' : '#D9A73A',
                            }
                        ]}
                    >
                        <Text style={[styles.greetingText, { color: isDarkMode ? '#08E4C7' : '#0E1A2E' }]}>
                            {greetingText}
                        </Text>
                    </View>
                ) : null}

                <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245, 166, 35, 0.1)', borderRadius: size / 2, borderWidth: 1.5, borderColor: '#f5a623' }}>
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={{ width: size * 0.65, height: size * 0.65 }}
                        resizeMode="contain"
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { width: size + 28, height: size + 22 }]}>
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

            <Animated.View style={[styles.characterWrapper, { transform: [{ translateY: floatAnim }] }]}>
                <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
                    <Defs>
                        <SvgGradient id="skin3d" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FFF7ED" />
                            <Stop offset="40%" stopColor="#FED7AA" />
                            <Stop offset="100%" stopColor="#FDBA74" />
                        </SvgGradient>
                        <SvgGradient id="hair3d" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#475569" />
                            <Stop offset="50%" stopColor="#1E293B" />
                            <Stop offset="100%" stopColor="#0F172A" />
                        </SvgGradient>
                        <SvgGradient id="goldHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#FEF08A" />
                            <Stop offset="100%" stopColor="#D9A73A" />
                        </SvgGradient>
                        <SvgGradient id="suit3d" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#1E293B" />
                            <Stop offset="60%" stopColor="#0E1A2E" />
                            <Stop offset="100%" stopColor="#060D1A" />
                        </SvgGradient>
                    </Defs>

                    <Circle cx="80" cy="80" r="72" fill={isDarkMode ? "#08E4C7" : "#D9A73A"} opacity="0.08" />

                    <G id="torso">
                        <Path d="M 30 118 C 30 102, 50 94, 80 94 C 110 94, 130 102, 130 118 L 134 160 L 26 160 Z" fill="url(#suit3d)" />
                        <Path d="M 64 94 L 80 120 L 96 94 Z" fill="#FFFFFF" />
                        <Path d="M 72 94 L 80 106 L 88 94 Z" fill="#F1F5F9" />
                    </G>

                    <Rect x="70" y="78" width="20" height="20" rx="6" fill="url(#skin3d)" />

                    <G id="headGroup">
                        <Circle cx="34" cy="58" r="8" fill="url(#skin3d)" />
                        <Circle cx="126" cy="58" r="8" fill="url(#skin3d)" />
                        <Rect x="38" y="24" width="84" height="70" rx="34" fill="url(#skin3d)" stroke="#FDBA74" strokeWidth="0.8" />
                        <Path d="M 34 40 C 30 16, 52 4, 80 4 C 108 4, 130 16, 126 40 C 120 26, 108 16, 80 18 C 52 16, 40 26, 34 40 Z" fill="url(#hair3d)" />

                        <G id="eyes">
                            <Circle cx="58" cy="52" r="9" fill="#FFFFFF" />
                            <Circle cx="59" cy="52" r="5.5" fill="#0F172A" />
                            <Circle cx="102" cy="52" r="9" fill="#FFFFFF" />
                            <Circle cx="101" cy="52" r="5.5" fill="#0F172A" />
                        </G>

                        <Path d="M 66 70 Q 80 82 94 70" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
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
