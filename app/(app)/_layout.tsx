import { Tabs, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Platform, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, Linking } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecurityModal from '../../components/SecurityModal';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import ModernTabBar from '../../components/ModernTabBar';
import { useAppSettings } from '../../hooks/useAppSettings';

const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export default function AppLayout() {
    const router = useRouter();
    const { settings } = useAppSettings();
    const [isVerified, setIsVerified] = useState(false);
    const [loadingVerification, setLoadingVerification] = useState(true);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    usePushNotifications(); // Register for push notifications

    useEffect(() => {
        // AI Button Pulse Animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            ])
        ).start();

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
                tabBar={(props) => <ModernTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
                <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
                <Tabs.Screen name="pay" options={{ title: 'Pay' }} />
                <Tabs.Screen name="history" options={{ title: 'History' }} />
                <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
                
                {/* Hidden service screens - tab bar will show when these are active */}
                <Tabs.Screen name="referrals" options={{ href: null }} />
                <Tabs.Screen name="social-boost" options={{ href: null }} />
                <Tabs.Screen name="social-orders" options={{ href: null }} />
                <Tabs.Screen name="data" options={{ href: null }} />
                <Tabs.Screen name="airtime" options={{ href: null }} />
                <Tabs.Screen name="bills" options={{ href: null }} />
                <Tabs.Screen name="education" options={{ href: null }} />
                <Tabs.Screen name="bvn-services" options={{ href: null }} />
                <Tabs.Screen name="crypto" options={{ href: null, tabBarStyle: { display: 'none' } }} />
                <Tabs.Screen name="kyc" options={{ href: null }} />
                <Tabs.Screen name="virtual-cards" options={{ href: null }} />
                <Tabs.Screen name="transfer" options={{ href: null }} />
                <Tabs.Screen name="saved-cards" options={{ href: null }} />
                <Tabs.Screen name="savings" options={{ href: null }} />
                <Tabs.Screen name="loans" options={{ href: null }} />
                <Tabs.Screen name="insurance" options={{ href: null }} />
                <Tabs.Screen name="investments" options={{ href: null }} />
                <Tabs.Screen name="qr-pay" options={{ href: null }} />
                <Tabs.Screen name="beneficiaries" options={{ href: null }} />
                <Tabs.Screen name="support" options={{ href: null }} />
                <Tabs.Screen name="nin-services" options={{ href: null }} />
                <Tabs.Screen name="about" options={{ href: null }} />
                <Tabs.Screen name="tickets/index" options={{ href: null }} />
            </Tabs>

            {/* FLOATING ACTION BUTTON (FAB) */}
            {isFabOpen && (
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => setIsFabOpen(false)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
                />
            )}
            
            <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 72, right: 20, zIndex: 50, alignItems: 'center' }}>
                {isFabOpen && (
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                        <TouchableOpacity 
                            onPress={() => { setIsFabOpen(false); Linking.openURL(`whatsapp://send?phone=${settings?.support_whatsapp || '2348145853539'}`).catch(() => alert('WhatsApp not installed')); }}
                            style={{ backgroundColor: '#25D366', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
                        >
                            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => { setIsFabOpen(false); router.push('/(app)/tickets'); }}
                            style={{ backgroundColor: '#e11d48', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
                        >
                            <Ionicons name="headset" size={20} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => { setIsFabOpen(false); router.push('/ai-chat'); }}
                            style={{ backgroundColor: '#4f46e5', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
                        >
                            <Ionicons name="sparkles" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity 
                        onPress={() => setIsFabOpen(!isFabOpen)}
                        style={{ backgroundColor: '#0d1b3e', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                        <Ionicons name={isFabOpen ? "close" : "add"} size={26} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
  // Floating Action Button
  fabContainer: {
    position: 'absolute',
    bottom: 90, // Positioned above the tab bar
    right: 20,
    zIndex: 999,
  },
  fab: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fabBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
});
