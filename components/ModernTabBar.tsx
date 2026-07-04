import React, { useEffect } from 'react';
import { View, Platform, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    withTiming, 
    withSequence,
    withRepeat,
    Easing
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function ModernTabBar({ state, descriptors, navigation }: any) {
    const router = useRouter();

    const activeRoute = state.routes[state.index];
    const { options: activeOptions } = descriptors[activeRoute.key];

    if (activeOptions?.tabBarStyle?.display === 'none') {
        return null;
    }

    return (
        <View style={s.tabBarContainer}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={100} tint="light" style={s.absoluteBlur} />
            ) : (
                <View style={[s.absoluteBlur, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]} />
            )}
            
            <View style={s.tabBarInner}>
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];

                    const allowedTabs = ['dashboard', 'wallet', 'pay', 'history', 'profile'];
                    if (!allowedTabs.includes(route.name)) return null;

                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    if (route.name === 'pay') {
                        return (
                            <PayButton key={route.key} isFocused={isFocused} onPress={onPress} />
                        );
                    }

                    const getIcon = (name: string, focused: boolean) => {
                        switch (name) {
                            case 'dashboard': return focused ? 'grid' : 'grid-outline';
                            case 'wallet': return focused ? 'wallet' : 'wallet-outline';
                            case 'history': return focused ? 'time' : 'time-outline';
                            case 'profile': return focused ? 'person' : 'person-outline';
                            default: return 'help-outline';
                        }
                    };

                    return (
                        <TabItem 
                            key={route.key} 
                            isFocused={isFocused} 
                            onPress={onPress} 
                            icon={getIcon(route.name, isFocused)} 
                        />
                    );
                })}
            </View>
        </View>
    );
}

function PayButton({ isFocused, onPress }: { isFocused: boolean, onPress: () => void }) {
    const scale = useSharedValue(1);
    const rotate = useSharedValue(0);
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (isFocused) {
            scale.value = withSpring(1.1, { damping: 10 });
            rotate.value = withSequence(
                withTiming(15, { duration: 100 }),
                withTiming(-15, { duration: 100 }),
                withSpring(0)
            );
        } else {
            scale.value = withSpring(1);
        }
    }, [isFocused]);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotate.value}deg` }
        ],
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.payButtonWrapper}>
            <Animated.View style={[s.payOuterPulse, pulseStyle]} />
            <Animated.View style={animatedStyle}>
                <LinearGradient
                    colors={['#0d1b3e', '#142258', '#f5a623']}
                    locations={[0, 0.5, 1]}
                    style={s.payButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="qr-code" size={22} color="#ffffff" />
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
}

function TabItem({ isFocused, onPress, icon }: { isFocused: boolean, onPress: () => void, icon: string }) {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const dotScale = useSharedValue(0);
    const dotOpacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.25 : 0.9, { damping: 10, stiffness: 200 });
        translateY.value = withSpring(isFocused ? -8 : 0, { damping: 12 });
        dotScale.value = withSpring(isFocused ? 1 : 0.5, { damping: 10 });
        dotOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { translateY: translateY.value }],
    }));

    const animatedDotStyle = useAnimatedStyle(() => ({
        transform: [{ scale: dotScale.value }],
        opacity: dotOpacity.value,
    }));

    return (
        <TouchableOpacity onPress={onPress} style={s.tabItem} activeOpacity={0.6}>
            <Animated.View style={animatedIconStyle}>
                <Ionicons name={icon as any} size={20} color={isFocused ? '#f5a623' : '#a0aec0'} />
            </Animated.View>
            <Animated.View style={[s.dotIndicator, animatedDotStyle]} />
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 24 : 16,
        alignSelf: 'center',
        width: Math.min(width * 0.85, 340), // Very compact capsule
        height: 56, // Smaller height
        borderRadius: 28, // Perfect pill
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    },
    absoluteBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 28,
    },
    tabBarInner: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    dotIndicator: {
        position: 'absolute',
        bottom: 10,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#f5a623',
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 5,
    },
    payButtonWrapper: {
        top: -18,
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 60,
        zIndex: 20,
    },
    payOuterPulse: {
        position: 'absolute',
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: 'rgba(245, 166, 35, 0.25)', // Glowing aura
    },
    payButtonGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
});
