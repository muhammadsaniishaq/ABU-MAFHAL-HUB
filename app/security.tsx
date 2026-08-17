import { 
    View, 
    Text, 
    TouchableOpacity, 
    Switch, 
    Alert, 
    Platform, 
    ScrollView, 
    Modal, 
    TextInput, 
    ActivityIndicator, 
    Image 
} from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

// Executive Royal Navy & Gold Theme Palette
const L = {
    bg: '#0F172A',
    card: '#1E293B',
    cardBorder: 'rgba(245, 158, 11, 0.35)',
    navyHeader: '#020617',
    gold: '#F59E0B',
    goldDk: '#D97706',
    goldLight: '#FDE047',
    goldBg: 'rgba(245, 158, 11, 0.12)',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    inputBg: '#0F172A',
    inputBorder: '#334155',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.15)',
    emeraldBorder: '#059669',
    rose: '#EF4444',
    roseBg: 'rgba(239, 68, 68, 0.15)'
};

export default function SecurityScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Biometrics State
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    // 2FA / TOTP Authenticator States
    const [isMfaActive, setIsMfaActive] = useState(false);
    const [mfaFactor, setMfaFactor] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // 2FA Setup Modal States
    const [setupModalVisible, setSetupModalVisible] = useState(false);
    const [enrollData, setEnrollData] = useState<any>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        loadSettings();
        checkMfaStatus();
    }, []);

    const loadSettings = async () => {
        try {
            const bioEnabled = await AsyncStorage.getItem('biometrics_setup_completed');
            setBiometricEnabled(bioEnabled === 'true');
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
            }
        } catch (e) {
            console.error("Failed to load security settings:", e);
        }
    };

    const checkMfaStatus = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;
            if (data && data.totp) {
                const activeFactor = data.totp.find((f: any) => f.status === 'verified');
                setMfaFactor(activeFactor || null);
                setIsMfaActive(!!activeFactor);
            }
        } catch (e) {
            console.error("MFA status check failed:", e);
        }
    };

    // Toggle Google Authenticator 2FA
    const handleToggleMfa = async (value: boolean) => {
        if (value) {
            // Enable 2FA: Enroll TOTP factor via Supabase Auth MFA
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User session not found.");

                const { data, error } = await supabase.auth.mfa.enroll({
                    factorType: 'totp',
                    issuer: 'ABU MAFHAL SUB',
                    friendlyName: user.email || 'User Account'
                });

                if (error) throw error;

                setEnrollData(data);
                setSetupModalVisible(true);
            } catch (err: any) {
                Alert.alert("2FA Setup Error", err.message || "Could not initialize Google Authenticator 2FA.");
            } finally {
                setLoading(false);
            }
        } else {
            // Disable 2FA: Prompt confirmation first
            Alert.alert(
                "Disable Google Authenticator",
                "Are you sure you want to disable 2FA? This will lower your account security rating.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Disable 2FA",
                        style: "destructive",
                        onPress: async () => {
                            if (!mfaFactor) return;
                            setLoading(true);
                            try {
                                const { error } = await supabase.auth.mfa.unenroll({
                                    factorId: mfaFactor.id
                                });
                                if (error) throw error;

                                await AsyncStorage.setItem('mfa_verified_session', 'false');
                                Alert.alert("2FA Disabled 🔓", "Two-factor authentication has been turned off.");
                                await checkMfaStatus();
                            } catch (err: any) {
                                Alert.alert("Error", err.message || "Failed to disable 2FA.");
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        }
    };

    // Verify 6-digit Authenticator Code during setup
    const handleVerifySetup = async () => {
        const cleanCode = verificationCode.trim();
        if (cleanCode.length !== 6) {
            Alert.alert("Invalid Code ❌", "Please enter the complete 6-digit code from your Google Authenticator app.");
            return;
        }

        setVerifying(true);
        try {
            // 1. Challenge the factor
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: enrollData.id
            });
            if (challengeError) throw challengeError;

            // 2. Verify the 6-digit TOTP code
            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: enrollData.id,
                challengeId: challengeData.id,
                code: cleanCode
            });
            if (verifyError) throw verifyError;

            await AsyncStorage.setItem('mfa_verified_session', 'true');
            
            Alert.alert("2FA Active! 🎉", "Google Authenticator is now active on your account.", [
                {
                    text: "Done",
                    onPress: async () => {
                        setSetupModalVisible(false);
                        setVerificationCode('');
                        setEnrollData(null);
                        await checkMfaStatus();
                    }
                }
            ]);
        } catch (err: any) {
            Alert.alert("Verification Failed ❌", err.message || "Invalid 6-digit code. Please verify the code in Google Authenticator and try again.");
        } finally {
            setVerifying(false);
        }
    };

    const handleCancelSetup = async () => {
        if (enrollData?.id) {
            try {
                await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
            } catch (e) {}
        }
        setSetupModalVisible(false);
        setVerificationCode('');
        setEnrollData(null);
    };

    const handleCopySecret = async () => {
        if (enrollData?.totp?.secret) {
            await Clipboard.setStringAsync(enrollData.totp.secret);
            Alert.alert("Copied 📋", "Secret Key copied to clipboard! Paste it into Google Authenticator.");
        }
    };

    const handleBiometricToggle = async (value: boolean) => {
        if (value) {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                if (!hasHardware || !isEnrolled) {
                    Alert.alert(
                        "Not Supported", 
                        "Biometric authentication (FaceID/Fingerprint) is not available or registered on this device."
                    );
                    return;
                }

                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm Biometric Login Setup',
                    fallbackLabel: 'Use PIN',
                });

                if (result.success) {
                    await AsyncStorage.setItem('biometrics_setup_completed', 'true');
                    setBiometricEnabled(true);
                    Alert.alert("Biometrics Enabled 🎉", "FaceID / TouchID biometric login is active.");
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

    const qrUrl = enrollData?.totp?.uri
        ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(enrollData.totp.uri)}`
        : '';

    // Calculate Overall Security Score
    const securityScore = (isMfaActive ? 50 : 0) + (biometricEnabled ? 30 : 0) + 20;

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Mobile-First Container (Max 600px on Web, 100% on Mobile) */}
            <View style={{ flex: 1, width: '100%', maxWidth: 600, backgroundColor: L.bg }}>
                
                {/* Royal Navy Header */}
                <LinearGradient
                    colors={['#020617', '#0F172A', '#1E293B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ 
                        paddingTop: insets.top + 8, 
                        paddingBottom: 16, 
                        paddingHorizontal: 16, 
                        borderBottomLeftRadius: 20, 
                        borderBottomRightRadius: 20, 
                        borderBottomWidth: 1.5, 
                        borderColor: L.goldDk 
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TouchableOpacity 
                            onPress={() => router.back()} 
                            style={{ 
                                width: 34, 
                                height: 34, 
                                borderRadius: 10, 
                                backgroundColor: 'rgba(255,255,255,0.08)', 
                                borderWidth: 1, 
                                borderColor: L.gold, 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="arrow-back" size={18} color={L.gold} />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: 0.8 }}>
                            SECURITY & 2FA AUTHENTICATOR
                        </Text>

                        <View style={{ width: 34 }} />
                    </View>

                    {/* Overall Account Security Score Card */}
                    <View style={{ 
                        marginTop: 14, 
                        backgroundColor: 'rgba(15, 23, 42, 0.8)', 
                        borderRadius: 14, 
                        padding: 12, 
                        borderWidth: 1, 
                        borderColor: L.cardBorder, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between' 
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="shield-checkmark" size={20} color={L.gold} />
                            </View>
                            <View>
                                <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '900' }}>Account Protection Rating</Text>
                                <Text style={{ color: L.textMuted, fontSize: 9.5 }}>{userEmail || 'Active Security Engine'}</Text>
                            </View>
                        </View>
                        <View style={{ backgroundColor: securityScore >= 80 ? L.emeraldBg : L.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: securityScore >= 80 ? L.emeraldBorder : L.gold }}>
                            <Text style={{ color: securityScore >= 80 ? L.emerald : L.gold, fontSize: 11, fontWeight: '900' }}>{securityScore}% {securityScore >= 80 ? 'HIGH' : 'FAIR'}</Text>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                    
                    {/* SECTION 1: GOOGLE AUTHENTICATOR (2FA / TOTP) */}
                    <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                        🔐 Two-Factor Authentication (2FA)
                    </Text>
                    
                    <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: isMfaActive ? L.emeraldBorder : L.inputBorder, padding: 14, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isMfaActive ? L.emeraldBg : L.goldBg, borderWidth: 1, borderColor: isMfaActive ? L.emerald : L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="qr-code" size={22} color={isMfaActive ? L.emerald : L.gold} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '900' }}>Google Authenticator (2FA)</Text>
                                        <View style={{ backgroundColor: isMfaActive ? L.emeraldBg : L.roseBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 8 }}>
                                            <Text style={{ color: isMfaActive ? L.emerald : L.rose, fontSize: 8.5, fontWeight: '900' }}>
                                                {isMfaActive ? '✓ ACTIVE' : 'DISABLED'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2 }}>
                                        Requires a 6-digit TOTP code generated by Google Authenticator or Authy.
                                    </Text>
                                </View>
                            </View>

                            {loading ? (
                                <ActivityIndicator size="small" color={L.gold} />
                            ) : (
                                <Switch
                                    trackColor={{ false: '#334155', true: '#059669' }}
                                    thumbColor={isMfaActive ? L.emerald : L.textMuted}
                                    onValueChange={handleToggleMfa}
                                    value={isMfaActive}
                                    style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
                                />
                            )}
                        </View>

                        {/* Status Description Banner */}
                        <View style={{ marginTop: 12, backgroundColor: isMfaActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name={isMfaActive ? "checkmark-circle" : "warning"} size={16} color={isMfaActive ? L.emerald : L.gold} />
                            <Text style={{ color: isMfaActive ? L.emerald : L.textSecondary, fontSize: 9.5, flex: 1, fontWeight: '600' }}>
                                {isMfaActive 
                                    ? "Your account is protected by Google Authenticator 2FA." 
                                    : "Turn on Google Authenticator to stop unauthorized access to your wallet & balance."}
                            </Text>
                        </View>
                    </View>

                    {/* SECTION 2: BIOMETRICS SECURITY */}
                    <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                        👆 Hardware Biometrics
                    </Text>
                    
                    <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, padding: 14, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.12)', borderWidth: 1, borderColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="finger-print" size={22} color="#60A5FA" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '900' }}>FaceID / Fingerprint Unlock</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2 }}>
                                        Instant biometric device login upon app startup.
                                    </Text>
                                </View>
                            </View>

                            <Switch
                                trackColor={{ false: '#334155', true: '#1E40AF' }}
                                thumbColor={biometricEnabled ? '#60A5FA' : L.textMuted}
                                onValueChange={handleBiometricToggle}
                                value={biometricEnabled}
                                style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
                            />
                        </View>
                    </View>

                    {/* SECTION 3: CREDENTIALS MANAGEMENT */}
                    <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                        🔑 Access Credentials & Passcodes
                    </Text>

                    <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden' }}>
                        
                        {/* 4-Digit Transaction PIN Option */}
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderColor: L.inputBorder }}
                            onPress={() => router.push('/(auth)/pin-setup')}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="keypad" size={18} color={L.gold} />
                                </View>
                                <View>
                                    <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '800' }}>Change 4-Digit Transaction PIN</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5 }}>Used for approving airtime, data & funds transfer</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={L.textMuted} />
                        </TouchableOpacity>

                        {/* Account Password Option */}
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
                            onPress={() => router.push('/change-password')}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(148, 163, 184, 0.12)', borderWidth: 1, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="lock-closed" size={18} color="#CBD5E1" />
                                </View>
                                <View>
                                    <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '800' }}>Change Login Password</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5 }}>Update your primary account sign-in password</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={L.textMuted} />
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </View>

            {/* GOOGLE AUTHENTICATOR SETUP MODAL */}
            <Modal
                visible={setupModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={handleCancelSetup}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 460, backgroundColor: '#1E293B', borderRadius: 24, borderWidth: 1.5, borderColor: L.gold, padding: 20, maxHeight: '90%' }}>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Modal Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="qr-code" size={22} color={L.gold} />
                                    <Text style={{ color: L.textPrimary, fontSize: 15, fontWeight: '900' }}>Google Authenticator Setup</Text>
                                </View>
                                <TouchableOpacity onPress={handleCancelSetup} style={{ padding: 4 }}>
                                    <Ionicons name="close-circle" size={24} color={L.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Step 1: Scan QR Code */}
                            <Text style={{ color: L.goldLight, fontSize: 11, fontWeight: '900', marginBottom: 6 }}>
                                Step 1: Scan QR Code in Authenticator App 📷
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 10 }}>
                                Open Google Authenticator or Authy app on another phone or device and scan the QR code below:
                            </Text>

                            {/* Glowing Gold QR Container Box */}
                            <View style={{ 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                backgroundColor: '#FFFFFF', 
                                padding: 14, 
                                borderRadius: 20, 
                                alignSelf: 'center', 
                                marginBottom: 14,
                                borderWidth: 3,
                                borderColor: L.gold,
                                shadowColor: L.gold,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.35,
                                shadowRadius: 10,
                                elevation: 8
                            }}>
                                {qrUrl ? (
                                    <>
                                        <Image source={{ uri: qrUrl }} style={{ width: 200, height: 200 }} resizeMode="contain" />
                                        <View style={{ marginTop: 6, backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                                            <Text style={{ color: L.gold, fontSize: 9, fontWeight: '900' }}>📱 SCAN WITH GOOGLE AUTHENTICATOR</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
                                        <ActivityIndicator size="large" color={L.gold} />
                                        <Text style={{ color: '#0F172A', fontSize: 10, fontWeight: '700', marginTop: 8 }}>Generating Security QR...</Text>
                                    </View>
                                )}
                            </View>

                            {/* Step 2: Or Copy Secret Key */}
                            <Text style={{ color: L.goldLight, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>
                                Step 2: Or Copy Secret Setup Key
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 6 }}>
                                If you can't scan, tap below to copy the secret key into your Authenticator app:
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.bg, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, padding: 10, marginBottom: 14 }}>
                                <Text style={{ flex: 1, color: L.gold, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '900' }} numberOfLines={1}>
                                    {enrollData?.totp?.secret || 'Generating Secret...'}
                                </Text>
                                <TouchableOpacity 
                                    onPress={handleCopySecret}
                                    style={{ backgroundColor: L.goldBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: L.gold }}
                                >
                                    <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900' }}>Copy Key 📋</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Step 3: Enter 6-digit Code */}
                            <Text style={{ color: L.goldLight, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>
                                Step 3: Enter 6-Digit Verification Code
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 8 }}>
                                Type the 6-digit code shown in Google Authenticator to confirm setup:
                            </Text>

                            <TextInput
                                style={{ 
                                    backgroundColor: L.bg, 
                                    borderWidth: 1.5, 
                                    borderColor: verificationCode.length === 6 ? L.emerald : L.gold, 
                                    borderRadius: 14, 
                                    padding: 12, 
                                    color: L.textPrimary, 
                                    fontSize: 22, 
                                    fontWeight: '900', 
                                    textAlign: 'center', 
                                    letterSpacing: 8,
                                    marginBottom: 16 
                                }}
                                placeholder="000000"
                                placeholderTextColor={L.textMuted}
                                keyboardType="number-pad"
                                maxLength={6}
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                            />

                            {/* Action Buttons */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={handleCancelSetup}
                                    style={{ flex: 1, backgroundColor: L.bg, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                                >
                                    <Text style={{ color: L.textMuted, fontSize: 12, fontWeight: '800' }}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleVerifySetup}
                                    disabled={verifying}
                                    style={{ flex: 1.5, backgroundColor: L.gold, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {verifying ? (
                                        <ActivityIndicator color="#0F172A" />
                                    ) : (
                                        <Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '900' }}>Verify & Activate 🔒</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
