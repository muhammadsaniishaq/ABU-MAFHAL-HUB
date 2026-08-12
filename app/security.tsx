import { View, Text, TouchableOpacity, Switch, Alert, Platform, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Executive Light Navy & Gold Design Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(245, 166, 35, 0.35)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',
    roseBg: '#FFF1F2'
};

export default function SecurityScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const bioEnabled = await AsyncStorage.getItem('biometrics_setup_completed');
                setBiometricEnabled(bioEnabled === 'true');
            } catch (e) {
                console.error("Failed to load security settings:", e);
            }
        };
        loadSettings();
    }, []);

    const handleBiometricToggle = async (value: boolean) => {
        if (value) {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                if (!hasHardware || !isEnrolled) {
                    Alert.alert(
                        "Not Supported", 
                        "Biometric authentication (FaceID/Fingerprint) is not supported or set up on this device."
                    );
                    return;
                }

                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm Biometric Login Setup',
                    fallbackLabel: 'Use Passcode',
                });

                if (result.success) {
                    await AsyncStorage.setItem('biometrics_setup_completed', 'true');
                    setBiometricEnabled(true);
                    Alert.alert("Biometrics Active 🎉", "Biometric FaceID / TouchID login has been enabled.");
                } else {
                    setBiometricEnabled(false);
                }
            } catch (e) {
                Alert.alert("Error", "Biometric setup failed.");
                setBiometricEnabled(false);
            }
        } else {
            await AsyncStorage.setItem('biometrics_setup_completed', 'false');
            setBiometricEnabled(false);
            Alert.alert("Disabled", "Biometric login disabled.");
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Mobile-First Container Wrapper (Max 600px for Desktop Web, 100% for Mobile) */}
            <View style={{ flex: 1, width: '100%', maxWidth: 600, backgroundColor: L.bg }}>
                
                {/* Royal Navy Header */}
                <LinearGradient
                    colors={['#0F172A', '#1C2541', '#0B132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: -0.2 }}>SECURITY & CREDENTIALS</Text>

                        <View style={{ width: 32 }} />
                    </View>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                    
                    {/* Credentials Section */}
                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Access Credentials & Security</Text>
                    <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.inputBorder, elevation: 1, overflow: 'hidden', marginBottom: 14 }}>
                        
                        {/* Transaction PIN Option */}
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: L.inputBorder }}
                            onPress={() => router.push('/(auth)/pin-setup')}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="keypad" size={14} color={L.goldAmber} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '800' }}>Change 4-Digit Transaction PIN</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9 }}>Used for approving airtime, data & transfer transactions</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={L.textMuted} />
                        </TouchableOpacity>

                        {/* Account Password Option */}
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}
                            onPress={() => router.push('/change-password')}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="lock-closed" size={14} color={L.navyHeader} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '800' }}>Change Login Password</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9 }}>Update your main account login password</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={L.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Biometrics Device Security Section */}
                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Device Hardware Security</Text>
                    <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.inputBorder, elevation: 1, padding: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="finger-print" size={16} color={L.emerald} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '800' }}>Biometric Login (FaceID / TouchID)</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9 }}>Instant hardware authentication on app launch</Text>
                                </View>
                            </View>
                            <Switch
                                trackColor={{ false: '#CBD5E1', true: L.navyHeader }}
                                thumbColor={biometricEnabled ? L.gold : '#FFFFFF'}
                                onValueChange={handleBiometricToggle}
                                value={biometricEnabled}
                                style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                            />
                        </View>
                    </View>

                </ScrollView>
            </View>
        </View>
    );
}
