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
    const { options: activeOptions } = descriptors[activeRoute?.key || ''];

    if (activeOptions?.tabBarStyle?.display === 'none') {
        return null;
    }

    const allowedTabs = ['dashboard', 'wallet', 'qr-pay', 'history', 'profile'];

    return (
        <View style={s.tabBarContainer}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={90} tint="light" style={s.absoluteBlur} />
            ) : (
                <View style={[s.absoluteBlur, { backgroundColor: '#ffffff' }]} />
            )}
            
            <View style={s.tabBarInner}>
                {state.routes.map((route: any, index: number) => {
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

                    if (route.name === 'qr-pay') {
                        return (
                            <PayButton key={route.key} isFocused={isFocused} onPress={onPress} />
                        );
                    }

                    const getTabInfo = (name: string, focused: boolean) => {
                        switch (name) {
                            case 'dashboard': 
                                return { icon: focused ? 'grid' : 'grid-outline', label: 'Home' };
                            case 'wallet': 
                                return { icon: focused ? 'wallet' : 'wallet-outline', label: 'Wallet' };
                            case 'history': 
                                return { icon: focused ? 'receipt' : 'receipt-outline', label: 'History' };
                            case 'profile': 
                                return { icon: focused ? 'person' : 'person-outline', label: 'Profile' };
                            default: 
                                return { icon: 'help-outline', label: 'More' };
                        }
                    };

                    const { icon, label } = getTabInfo(route.name, isFocused);

                    return (
                        <TabItem 
                            key={route.key} 
                            isFocused={isFocused} 
                            onPress={onPress} 
                            icon={icon} 
                            label={label}
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
        scale.value = withSpring(isFocused ? 1.08 : 1, { damping: 12 });
    }, [isFocused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.payButtonWrapper}>
            <Animated.View style={animatedStyle}>
                <LinearGradient
                    colors={['#0d1b3e', '#142258']}
                    style={s.payButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="qr-code" size={20} color="#f5a623" />
                </LinearGradient>
            </Animated.View>
            <Text style={[s.payLabel, isFocused && s.payLabelActive]}>QR Pay</Text>
        </TouchableOpacity>
    );
}

function TabItem({ isFocused, onPress, icon, label }: { isFocused: boolean, onPress: () => void, icon: string, label: string }) {
    return (
        <TouchableOpacity onPress={onPress} style={s.tabItem} activeOpacity={0.7}>
            <View style={[s.iconBox, isFocused && s.iconBoxActive]}>
                <Ionicons name={icon as any} size={18} color={isFocused ? '#0d1b3e' : '#94a3b8'} />
            </View>
            <Text style={[s.tabLabel, isFocused && s.tabLabelActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 20 : 12,
        left: 16,
        right: 16,
        height: 60,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 50,
    },
    absoluteBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
    },
    tabBarInner: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        paddingVertical: 4,
    },
    iconBox: {
        width: 32,
        height: 28,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBoxActive: {
        backgroundColor: 'rgba(245, 166, 35, 0.18)',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 2,
    },
    tabLabelActive: {
        color: '#0d1b3e',
        fontWeight: '800',
    },
    payButtonWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -16,
        width: 54,
    },
    payButtonGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2.5,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    payLabel: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 2,
    },
    payLabelActive: {
        color: '#0d1b3e',
        fontWeight: '800',
    },
});
