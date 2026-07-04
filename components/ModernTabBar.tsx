import React, { useEffect } from 'react';
import { View, Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export default function ModernTabBar({ state, descriptors, navigation }: any) {
    const router = useRouter();

    const activeRoute = state.routes[state.index];
    const { options: activeOptions } = descriptors[activeRoute.key];

    // If a screen explicitly requests tabBarVisible: false (or tabBarStyle: {display: 'none'}) we respect it
    if (activeOptions?.tabBarStyle?.display === 'none') {
        return null;
    }

    return (
        <View style={s.tabBarContainer}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={80} tint="light" style={s.absoluteBlur} />
            ) : (
                <View style={[s.absoluteBlur, { backgroundColor: 'rgba(255,255,255,0.92)' }]} />
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
                            case 'dashboard': return focused ? 'home' : 'home-outline';
                            case 'wallet': return focused ? 'wallet' : 'wallet-outline';
                            case 'history': return focused ? 'time' : 'time-outline';
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

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.1 : 1, { damping: 12 });
    }, [isFocused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.payButtonWrapper}>
            <Animated.View style={[animatedStyle]}>
                <LinearGradient
                    colors={['#0d1b3e', '#142258', '#f5a623']}
                    style={[
                        s.payButtonGradient,
                        isFocused && { borderColor: '#f5a623', borderWidth: 2 }
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="qr-code" size={26} color="#ffffff" />
                </LinearGradient>
            </Animated.View>
            <Text style={[s.payLabel, isFocused && s.payLabelActive]}>Pay</Text>
        </TouchableOpacity>
    );
}

function TabItem({ isFocused, onPress, icon, label }: { isFocused: boolean, onPress: () => void, icon: string, label: string }) {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.15 : 1, { damping: 10, stiffness: 200 });
        translateY.value = withSpring(isFocused ? -4 : 0, { damping: 10, stiffness: 200 });
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { translateY: translateY.value }],
    }));

    return (
        <TouchableOpacity onPress={onPress} style={s.tabItem} activeOpacity={0.7}>
            <Animated.View style={[s.iconContainer, isFocused && s.iconContainerActive, animatedIconStyle]}>
                <Ionicons name={icon as any} size={22} color={isFocused ? '#0d1b3e' : '#64748b'} />
            </Animated.View>
            <Text style={[s.tabLabel, isFocused && s.tabLabelActive]}>{label}</Text>
            {isFocused && (
                <View style={s.activeIndicatorDot} />
            )}
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        height: 72,
        borderRadius: 36,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    },
    absoluteBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 36,
    },
    tabBarInner: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    iconContainer: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerActive: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 2,
    },
    tabLabelActive: {
        fontWeight: '800',
        color: '#0d1b3e',
    },
    payButtonWrapper: {
        top: -24,
        alignItems: 'center',
        justifyContent: 'center',
        width: 72,
        height: 80,
    },
    payButtonGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 4,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#f5a623',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 12,
    },
    payLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 2,
    },
    payLabelActive: {
        fontWeight: '800',
        color: '#f5a623',
    },
    activeIndicatorDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#f5a623',
        marginTop: 2,
        position: 'absolute',
        bottom: 8,
    },
});
