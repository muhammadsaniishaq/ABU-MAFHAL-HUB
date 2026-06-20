import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecurityModal from '../../components/SecurityModal';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export default function AppLayout() {
    const router = useRouter();
    const [isVerified, setIsVerified] = useState(false);
    const [loadingVerification, setLoadingVerification] = useState(true);
    usePushNotifications(); // Register for push notifications

    useEffect(() => {
        const checkInactivityLock = async () => {
            try {
                const lastVerificationStr = await AsyncStorage.getItem('last_security_verification_time');
                if (lastVerificationStr) {
                    const lastVerificationTime = parseInt(lastVerificationStr, 10);
                    const now = Date.now();
                    if (now - lastVerificationTime < LOCK_TIMEOUT) {
                        setIsVerified(true);
                        // Refresh timestamp to extend active session
                        await AsyncStorage.setItem('last_security_verification_time', String(now));
                        setLoadingVerification(false);
                        return;
                    }
                }
            } catch (e) {
                console.error("Error checking verification timeout:", e);
            }
            setLoadingVerification(false);
        };
        checkInactivityLock();
    }, []);

    useEffect(() => {
        if (isVerified) {
            AsyncStorage.setItem('last_security_verification_time', String(Date.now())).catch(err => console.log(err));
        }
    }, [isVerified]);

    const handleVerificationSuccess = async () => {
        try {
            await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));
        } catch (e) {
            console.error("Failed to save verification time:", e);
        }
        setIsVerified(true);
    };

    if (loadingVerification) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0d1b3e', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    if (!isVerified) {
        return (
            <SecurityModal
                visible={true}
                onClose={() => router.replace('/')}
                onSuccess={handleVerificationSuccess}
                title="Welcome Back"
            />
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
                <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
                <Tabs.Screen name="pay" options={{ title: 'Pay' }} />
                <Tabs.Screen name="history" options={{ title: 'History' }} />
                <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
                <Tabs.Screen name="referrals" options={{ href: null }} />
            </Tabs>
        </View>
    );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
    const router = useRouter();

    return (
        <View style={s.tabBarContainer}>
            {Platform.OS === 'ios' && (
                <BlurView
                    intensity={95}
                    tint="light"
                    style={s.absoluteBlur}
                />
            )}
            <View style={s.tabBarInner}>
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];

                    // Hide referrals or screens with href: null
                    if (options.href === null || route.name === 'referrals') return null;

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

                    // Render central Pay floating button
                    if (route.name === 'pay') {
                        return (
                            <TouchableOpacity
                                key={route.key}
                                onPress={() => router.push('/(app)/pay')}
                                style={s.payButtonWrapper}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#4f46e5', '#0056D2', '#06b6d4']}
                                    style={s.payButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="qr-code" size={24} color="#ffffff" />
                                </LinearGradient>
                                <Text style={s.payLabel}>Pay</Text>
                            </TouchableOpacity>
                        );
                    }

                    // Icon and label resolvers
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
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={s.tabItem}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                s.iconContainer, 
                                isFocused && s.iconContainerActive
                            ]}>
                                <Ionicons
                                    name={getIcon(route.name, isFocused) as any}
                                    size={20}
                                    color={isFocused ? '#0056D2' : '#64748b'}
                                />
                            </View>
                            <Text style={[
                                s.tabLabel, 
                                isFocused && s.tabLabelActive
                            ]}>
                                {getLabel(route.name)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        height: 76,
        borderRadius: 38,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.75)' : '#ffffff',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10,
        overflow: Platform.OS === 'ios' ? 'hidden' : 'visible', // Keep visible on Android for Pay button shadow
    },
    absoluteBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 38,
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
    iconContainer: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    iconContainerActive: {
        backgroundColor: 'rgba(0, 86, 210, 0.08)',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
    },
    tabLabelActive: {
        fontWeight: '800',
        color: '#0056D2',
    },
    payButtonWrapper: {
        top: -24,
        alignItems: 'center',
        justifyContent: 'center',
        width: 72,
        height: 80,
    },
    payButtonGradient: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 4,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 10,
    },
    payLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0056D2',
        marginTop: 4,
    },
});
