import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecurityModal from '../../components/SecurityModal';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import ModernTabBar from '../../components/ModernTabBar';

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
                <Tabs.Screen name="crypto" options={{ href: null }} />
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
            </Tabs>
        </View>
    );
}
