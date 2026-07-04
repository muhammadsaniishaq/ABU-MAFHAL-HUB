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
    interpolateColor,
    withRepeat
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
                <BlurView intensity={90} tint="light" style={s.absoluteBlur} />
            ) : (
                <View style={[s.absoluteBlur, { backgroundColor: 'rgba(255,255,255,0.95)' }]} />
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
                            case 'history': return focused ? 'receipt' : 'receipt-outline';
                            case 'profile': return focused ? 'person' : 'person-outline';
                            default: return 'help-outline';
                        }
                    };

                    const getLabel = (name: string) => {
                        switch (name) {
                            case 'dashboard': return 'Home';
                            case 'wallet': return 'Wallet';
                            case 'history': return 'History';
                            case 'profile': return 'Profile';
                            default: return '';
                        }
                    };

                    return (
                        <TabItem 
                            key={route.key} 
                            isFocused={isFocused} 
                            onPress={onPress} 
                            icon={getIcon(route.name, isFocused)} 
                            label={getLabel(route.name)} 
                        />
                    );
                })}
            </View>
        </View>
    );
}

function PayButton({ isFocused, onPress }: { isFocused: boolean, onPress: () => void }) {
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (isFocused) {
            scale.value = withSpring(1.15, { damping: 10, stiffness: 150 });
            rotation.value = withSequence(
                withTiming(15, { duration: 150 }),
                withTiming(-15, { duration: 150 }),
                withSpring(0, { damping: 5 })
            );
        } else {
            scale.value = withSpring(1, { damping: 12 });
            rotation.value = withSpring(0);
        }
    }, [isFocused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` }
        ],
    }));

    const pulse = useSharedValue(1);
    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1500 }),
                withTiming(1, { duration: 1500 })
            ),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.payButtonWrapper}>
            <Animated.View style={[pulseStyle, s.payShadow]}>
                <Animated.View style={[animatedStyle]}>
                    <LinearGradient
                        colors={['#0d1b3e', '#1e3480', '#f5a623']}
                        locations={[0, 0.6, 1]}
                        style={s.payButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="scan" size={26} color="#ffffff" style={{ textShadowColor: 'rgba(255,255,255,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} />
                    </LinearGradient>
                </Animated.View>
            </Animated.View>
            {isFocused && <View style={s.payIndicator} />}
        </TouchableOpacity>
    );
}

function TabItem({ isFocused, onPress, icon, label }: { isFocused: boolean, onPress: () => void, icon: string, label: string }) {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.1 : 1, { damping: 12, stiffness: 150 });
        translateY.value = withSpring(isFocused ? -10 : 0, { damping: 12, stiffness: 150 });
        opacity.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { translateY: translateY.value }],
    }));

    const animatedBgStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }, { translateY: translateY.value }],
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <TouchableOpacity onPress={onPress} style={s.tabItem} activeOpacity={0.7}>
            <View style={s.iconWrapper}>
                <Animated.View style={[s.iconBg, animatedBgStyle]} />
                <Animated.View style={animatedIconStyle}>
                    <Ionicons name={icon as any} size={22} color={isFocused ? '#f5a623' : '#94a3b8'} />
                </Animated.View>
            </View>
            <Animated.Text style={[s.tabLabel, isFocused && s.tabLabelActive, animatedTextStyle]}>
                {label}
            </Animated.Text>
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 24 : 16,
        left: 20,
        right: 20,
        height: 66,
        borderRadius: 33,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 15,
        overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    },
    absoluteBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 33,
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
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
    },
    iconBg: {
        position: 'absolute',
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        position: 'absolute',
        bottom: -10,
    },
    tabLabelActive: {
        fontWeight: '800',
        color: '#0d1b3e',
    },
    payButtonWrapper: {
        top: -24,
        alignItems: 'center',
        justifyContent: 'center',
        width: 66,
        height: 66,
        zIndex: 10,
    },
    payShadow: {
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 15,
        elevation: 15,
    },
    payButtonGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    payIndicator: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#f5a623',
        position: 'absolute',
        bottom: -4,
    }
});
