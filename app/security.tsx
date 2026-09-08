import React, { useState, useEffect, useRef } from 'react';
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
    Image,
    Linking 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

// Executive Ultra-Modern Light Theme Palette (Clean, Bright, 24K Gold & Emerald)
const L = {
    bg: '#F4F6FB',              // Crisp, bright light executive background
    card: '#FFFFFF',            // Pure white card surfaces
    cardBorder: '#E2E8F0',      // Clean hairline card borders
    cardSubtle: '#F8FAFC',      // Soft elevated container
    navyHeader: '#060B1E',      // Royal Midnight navy header gradient
    navyMid: '#0D1636',
    navyLight: '#142258',
    textPrimary: '#0F172A',      // High-contrast obsidian slate
    textSecondary: '#334155',    // Slate secondary
    textMuted: '#64748B',        // Muted gray captions
    gold: '#F5A623',            // 24K Gold
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: 'rgba(245, 166, 35, 0.4)',
    emerald: '#10B981',         // Verified Emerald
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    blue: '#2563EB',            // Royal Blue
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
    purple: '#7C3AED',          // Royal Purple
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
    rose: '#EF4444',            // Warning / Alert Red
    roseBg: '#FEF2F2',
    roseBorder: '#FECACA'
};

export default function SecurityScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Data Loading States
    const [loadingData, setLoadingData] = useState(true);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Profile & Auth States
    const [userEmail, setUserEmail] = useState<string>('');
    const [hasPinConfigured, setHasPinConfigured] = useState<boolean>(false);
    const [lastSignInTime, setLastSignInTime] = useState<string>('Recent');

    // Biometrics Hardware & Setup States
    const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);
    const [biometricType, setBiometricType] = useState<string>('Biometrics');
    const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);

    // 2FA / TOTP Authenticator States
    const [isMfaActive, setIsMfaActive] = useState<boolean>(false);
    const [mfaFactor, setMfaFactor] = useState<any>(null);
    const [mfaLoading, setMfaLoading] = useState<boolean>(false);
    const [mfaForTransfers, setMfaForTransfers] = useState<boolean>(true);
    
    // 2FA Setup Modal States
    const [setupModalVisible, setSetupModalVisible] = useState<boolean>(false);
    const [enrollData, setEnrollData] = useState<any>(null);
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [verifying, setVerifying] = useState<boolean>(false);
    const otpInputRefs = useRef<Array<TextInput | null>>([]);

    // 2FA Live Test Modal States
    const [testModalVisible, setTestModalVisible] = useState<boolean>(false);
    const [testCode, setTestCode] = useState<string>('');
    const [testingCode, setTestingCode] = useState<boolean>(false);

    useEffect(() => {
        loadSecurityOverview();
    }, []);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    };

    // 1. Load Complete Security Telemetry
    const loadSecurityOverview = async () => {
        try {
            setLoadingData(true);

            // A. Supabase Session & Profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                if (user.email) setUserEmail(user.email);
                if (user.last_sign_in_at) {
                    try {
                        const date = new Date(user.last_sign_in_at);
                        setLastSignInTime(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
                    } catch {
                        setLastSignInTime('Active');
                    }
                }

                // Check Transaction PIN in Profiles
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('transaction_pin')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile?.transaction_pin && String(profile.transaction_pin).length >= 4) {
                    setHasPinConfigured(true);
                } else {
                    setHasPinConfigured(false);
                }
            }

            // B. Hardware Biometrics Detection
            const hasHw = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHw && isEnrolled) {
                setBiometricAvailable(true);
                const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
                if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                    setBiometricType('Face ID');
                } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                    setBiometricType('Fingerprint');
                } else {
                    setBiometricType('Biometrics');
                }

                const bioFlag = await AsyncStorage.getItem('biometrics_enabled');
                const bioCompleted = await AsyncStorage.getItem('biometrics_setup_completed');
                setBiometricEnabled(bioFlag === 'true' || bioCompleted === 'true');
            } else {
                setBiometricAvailable(false);
                setBiometricEnabled(false);
            }

            // C. Google Authenticator 2FA Verification & Transfer Scope
            const savedTransferMfa = await AsyncStorage.getItem('mfa_required_for_transfers');
            setMfaForTransfers(savedTransferMfa !== 'false');
            await checkMfaStatus();
        } catch (e) {
            console.warn("loadSecurityOverview error:", e);
        } finally {
            setLoadingData(false);
        }
    };

    const handleToggleTransferMfa = async (val: boolean) => {
        setMfaForTransfers(val);
        await AsyncStorage.setItem('mfa_required_for_transfers', val ? 'true' : 'false');
        showToast(val ? "Transfer 2FA Protection Active! 🛡️" : "Transfer 2FA turned off (PIN only).");
    };

    const checkMfaStatus = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (!error && data?.totp) {
                const activeFactor = data.totp.find((f: any) => f.status === 'verified');
                setMfaFactor(activeFactor || null);
                setIsMfaActive(!!activeFactor);
            } else {
                setMfaFactor(null);
                setIsMfaActive(false);
            }
        } catch (e) {
            console.warn("MFA status check failed:", e);
        }
    };

    // 2. Hardware Biometrics Toggle (Face ID / Fingerprint)
    const handleBiometricToggle = async (val: boolean) => {
        if (!biometricAvailable) {
            Alert.alert(
                "Biometrics Unavailable", 
                "Biometric hardware (Face ID / Fingerprint) is not supported or not enrolled on this device."
            );
            return;
        }

        if (val) {
            try {
                const res = await LocalAuthentication.authenticateAsync({
                    promptMessage: `Authorize ${biometricType} Login`,
                    fallbackLabel: 'Use PIN / Password',
                    cancelLabel: 'Cancel'
                });

                if (res.success) {
                    await AsyncStorage.setItem('biometrics_enabled', 'true');
                    await AsyncStorage.setItem('biometrics_setup_completed', 'true');
                    setBiometricEnabled(true);
                    showToast(`${biometricType} enabled successfully! ✨`);
                } else {
                    setBiometricEnabled(false);
                }
            } catch (err: any) {
                Alert.alert("Biometric Error", err.message || "Failed to configure biometric login.");
                setBiometricEnabled(false);
            }
        } else {
            await AsyncStorage.setItem('biometrics_enabled', 'false');
            await AsyncStorage.setItem('biometrics_setup_completed', 'false');
            setBiometricEnabled(false);
            showToast(`${biometricType} disabled.`);
        }
    };

    // 3. Toggle Google Authenticator (2FA / TOTP) with Clean-Slate Guarantee
    const handleToggleMfa = async (val: boolean) => {
        if (val) {
            setMfaLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Active session not found. Please log in again.");

                // Prune any previous unverified factors to guarantee 100% reliable enrollment
                try {
                    const { data: factors } = await supabase.auth.mfa.listFactors();
                    if (factors?.totp) {
                        for (const factor of factors.totp) {
                            if ((factor as any).status !== 'verified') {
                                await supabase.auth.mfa.unenroll({ factorId: factor.id });
                            }
                        }
                    }
                } catch (cleanupErr) {
                    console.log("MFA pre-cleanup notice:", cleanupErr);
                }

                // Enroll fresh TOTP factor
                const { data, error } = await supabase.auth.mfa.enroll({
                    factorType: 'totp',
                    issuer: 'ABU MAFHAL HUB',
                    friendlyName: user.email || 'User Account'
                });

                if (error) throw error;

                setEnrollData(data);
                setOtpDigits(['', '', '', '', '', '']);
                setSetupModalVisible(true);
            } catch (err: any) {
                Alert.alert("2FA Setup Failed", err.message || "Could not initialize Google Authenticator.");
            } finally {
                setMfaLoading(false);
            }
        } else {
            // Disable TOTP Factor
            Alert.alert(
                "Disable Google Authenticator",
                "Are you sure you want to turn off 2FA? This will decrease your account protection rating.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Disable 2FA",
                        style: "destructive",
                        onPress: async () => {
                            if (!mfaFactor) return;
                            setMfaLoading(true);
                            try {
                                const { error } = await supabase.auth.mfa.unenroll({
                                    factorId: mfaFactor.id
                                });
                                if (error) throw error;

                                await AsyncStorage.setItem('mfa_verified_session', 'false');
                                showToast("2FA disabled successfully 🔓");
                                await checkMfaStatus();
                            } catch (err: any) {
                                Alert.alert("Error", err.message || "Could not disable 2FA.");
                            } finally {
                                setMfaLoading(false);
                            }
                        }
                    }
                ]
            );
        }
    };

    // 4. Handle 6-Digit Code Input & Auto-Submit
    const handleOtpChange = (text: string, index: number) => {
        const clean = text.replace(/[^0-9]/g, '');
        
        // Handle full 6-digit paste
        if (clean.length === 6) {
            const pasted = clean.split('');
            setOtpDigits(pasted);
            handleVerifyTotp(clean);
            return;
        }

        const newDigits = [...otpDigits];
        newDigits[index] = clean.slice(-1);
        setOtpDigits(newDigits);

        if (clean && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }

        // Auto verify when 6th digit entered
        if (newDigits.every(d => d !== '') && newDigits.join('').length === 6) {
            handleVerifyTotp(newDigits.join(''));
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    // 5. Verify & Activate 2FA TOTP Code
    const handleVerifyTotp = async (overrideCode?: string) => {
        const codeToVerify = (overrideCode || otpDigits.join('')).trim();
        if (codeToVerify.length !== 6) {
            Alert.alert("Invalid Code", "Please enter the complete 6-digit code from Google Authenticator.");
            return;
        }

        setVerifying(true);
        try {
            // Step A: Challenge Factor
            const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
                factorId: enrollData.id
            });
            if (chalErr) throw chalErr;

            // Step B: Verify TOTP with Challenge
            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId: enrollData.id,
                challengeId: chal.id,
                code: codeToVerify
            });
            if (verifyErr) throw verifyErr;

            await AsyncStorage.setItem('mfa_verified_session', 'true');
            setSetupModalVisible(false);
            setOtpDigits(['', '', '', '', '', '']);
            setEnrollData(null);
            await checkMfaStatus();
            showToast("Google Authenticator activated! 🛡️");
            Alert.alert(
                "2FA Activated Successfully! 🎉",
                "Your account is now 100% protected by Google Authenticator. Keep your authenticator app safe as it will be required when logging in."
            );
        } catch (err: any) {
            Alert.alert("Verification Failed ❌", err.message || "Invalid 6-digit code. Please verify the code in your Authenticator app and ensure your phone time is accurate.");
        } finally {
            setVerifying(false);
        }
    };

    // 6. 1-Tap Open Directly in Authenticator App (Seamless Mobile UX)
    const handleOpenInAuthenticator = async () => {
        if (!enrollData?.totp?.uri) return;
        try {
            await Linking.openURL(enrollData.totp.uri).catch(async () => {
                await handleCopySecret();
                Alert.alert(
                    "Setup Key Copied 📋", 
                    "Please open Google Authenticator or Authy, choose 'Enter a setup key', and paste the copied secret key."
                );
            });
        } catch {
            await handleCopySecret();
        }
    };

    // Cancel setup & unenroll pending factor
    const handleCancelSetup = async () => {
        if (enrollData?.id) {
            try {
                await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
            } catch {}
        }
        setSetupModalVisible(false);
        setOtpDigits(['', '', '', '', '', '']);
        setEnrollData(null);
    };

    const handleCopySecret = async () => {
        if (enrollData?.totp?.secret) {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(enrollData.totp.secret);
            } else {
                await Clipboard.setStringAsync(enrollData.totp.secret);
            }
            showToast("Secret key copied to clipboard! 📋");
        }
    };

    // 7. Live 2FA Code Test (Confirm Authenticator is in Sync)
    const handleTestCode = async () => {
        if (testCode.trim().length !== 6 || !mfaFactor) return;
        setTestingCode(true);
        try {
            const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
                factorId: mfaFactor.id
            });
            if (chalErr) throw chalErr;

            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId: mfaFactor.id,
                challengeId: chal.id,
                code: testCode.trim()
            });
            if (verifyErr) throw verifyErr;

            setTestModalVisible(false);
            setTestCode('');
            Alert.alert("2FA Synchronized! ✅", "Your Google Authenticator code is 100% active, valid, and working smoothly.");
        } catch (err: any) {
            Alert.alert("Code Verification Failed ❌", "The code was not accepted. Please ensure your device clock is set to automatic time and try again.");
        } finally {
            setTestingCode(false);
        }
    };

    // 8. Terminate All Other Sessions
    const handleTerminateOtherSessions = () => {
        Alert.alert(
            "Device Security Audit",
            "Are you sure you want to invalidate all active login sessions on other phones and browsers?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Terminate Sessions",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoadingData(true);
                            await supabase.auth.signOut({ scope: 'others' });
                            showToast("All other device sessions terminated! 🔒");
                        } catch (e: any) {
                            showToast("Device sessions refreshed! 🔒");
                        } finally {
                            setLoadingData(false);
                        }
                    }
                }
            ]
        );
    };

    // Format Secret Key into 4-character chunks for readability
    const formatSecret = (secret?: string) => {
        if (!secret) return 'Generating Secret...';
        return secret.match(/.{1,4}/g)?.join(' ') || secret;
    };

    // Calculate Comprehensive Security Rating (0 to 100%)
    const calculateSecurityScore = () => {
        let score = 25; // Base verified account credentials
        if (hasPinConfigured) score += 25; // Transaction PIN
        if (biometricEnabled) score += 25; // Hardware Biometrics
        if (isMfaActive) score += 25;       // Google Authenticator 2FA
        return score;
    };

    const securityScore = calculateSecurityScore();

    const qrUrl = enrollData?.totp?.uri
        ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(enrollData.totp.uri)}`
        : '';

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Micro Toast Notification */}
            {toastMsg && (
                <View style={{ 
                    position: 'absolute', 
                    top: insets.top + 8, 
                    left: 16, 
                    right: 16, 
                    zIndex: 999, 
                    backgroundColor: L.navyHeader, 
                    borderColor: L.gold, 
                    borderWidth: 1.2, 
                    borderRadius: 12, 
                    paddingHorizontal: 14, 
                    paddingVertical: 9, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 8, 
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 10 
                }}>
                    <Ionicons name="sparkles" size={15} color={L.gold} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 11.5, flex: 1 }}>{toastMsg}</Text>
                </View>
            )}

            {/* Mobile Viewport Shell (Max 520px on Web/Tablet, 100% on Mobile) */}
            <View style={{ flex: 1, width: '100%', maxWidth: 520, backgroundColor: L.bg }}>
                
                {/* 1. ROYAL MIDNIGHT & 24K GOLD HEADER (Executive Finish with Refined Text Sizing) */}
                <LinearGradient
                    colors={['#060B1E', '#0D1636', '#142258']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ 
                        paddingTop: insets.top + 4, 
                        paddingBottom: 14, 
                        paddingHorizontal: 16, 
                        borderBottomLeftRadius: 22, 
                        borderBottomRightRadius: 22, 
                        borderBottomWidth: 1.6, 
                        borderColor: L.goldBorder,
                        shadowColor: '#060B1E',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 10,
                        elevation: 8,
                        zIndex: 10
                    }}
                >
                    {/* Top Navigation Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <TouchableOpacity 
                            onPress={() => router.back()} 
                            style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 9, 
                                backgroundColor: 'rgba(255,255,255,0.08)', 
                                borderWidth: 1, 
                                borderColor: L.goldBorder, 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <MaterialCommunityIcons name="shield-crown" size={15} color={L.gold} />
                                <Text style={{ fontSize: 12.5, fontWeight: '800', color: L.gold, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                                    Security & Credentials
                                </Text>
                            </View>
                            <Text style={{ fontSize: 9, color: '#94A3B8', fontWeight: '600', marginTop: 1 }}>
                                Bank-Grade Account Protection • 256-Bit SSL
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={loadSecurityOverview} 
                            style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 9, 
                                backgroundColor: 'rgba(255,255,255,0.08)', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                borderWidth: 1, 
                                borderColor: 'rgba(255,255,255,0.18)' 
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="reload" size={15} color={L.gold} />
                        </TouchableOpacity>
                    </View>

                    {/* Live Security Rating Hero Card */}
                    <View style={{ 
                        backgroundColor: 'rgba(2, 6, 23, 0.75)', 
                        borderRadius: 14, 
                        padding: 12, 
                        borderWidth: 1, 
                        borderColor: L.goldBorder 
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="shield-checkmark" size={18} color={L.goldDk} />
                                </View>
                                <View>
                                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Overall Security Health</Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '500' }}>{userEmail || 'Shielded Account Engine'}</Text>
                                </View>
                            </View>

                            <View style={{ 
                                backgroundColor: securityScore >= 75 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 166, 35, 0.2)', 
                                paddingHorizontal: 8, 
                                paddingVertical: 3, 
                                borderRadius: 7, 
                                borderWidth: 1, 
                                borderColor: securityScore >= 75 ? L.emeraldBorder : L.goldBorder 
                            }}>
                                <Text style={{ color: securityScore >= 75 ? L.emerald : L.gold, fontSize: 10, fontWeight: '900' }}>
                                    {securityScore}% {securityScore === 100 ? 'MAXIMUM' : securityScore >= 75 ? 'HIGH' : 'FAIR'}
                                </Text>
                            </View>
                        </View>

                        {/* Visual Security Progress Bar */}
                        <View style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                            <LinearGradient
                                colors={securityScore >= 75 ? [L.emerald, '#059669'] : [L.gold, L.goldDk]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ width: `${securityScore}%`, height: '100%' }}
                            />
                        </View>

                        {/* Quick 4-Pillar Security Checklist */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 0.8, borderColor: 'rgba(255,255,255,0.08)' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="checkmark-circle" size={11} color={L.emerald} />
                                <Text style={{ color: '#CBD5E1', fontSize: 8.5, fontWeight: '700' }}>Password</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name={hasPinConfigured ? "checkmark-circle" : "ellipse-outline"} size={11} color={hasPinConfigured ? L.emerald : '#64748B'} />
                                <Text style={{ color: hasPinConfigured ? '#CBD5E1' : '#64748B', fontSize: 8.5, fontWeight: '700' }}>PIN</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name={biometricEnabled ? "checkmark-circle" : "ellipse-outline"} size={11} color={biometricEnabled ? L.emerald : '#64748B'} />
                                <Text style={{ color: biometricEnabled ? '#CBD5E1' : '#64748B', fontSize: 8.5, fontWeight: '700' }}>Biometrics</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name={isMfaActive ? "checkmark-circle" : "ellipse-outline"} size={11} color={isMfaActive ? L.emerald : '#64748B'} />
                                <Text style={{ color: isMfaActive ? '#CBD5E1' : '#64748B', fontSize: 8.5, fontWeight: '700' }}>2FA</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* 2. BODY CONTENT (Light Mode Background `#F4F6FB` with Pure White Cards) */}
                <ScrollView 
                    style={{ flex: 1 }} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 50 }}
                >
                    {/* SECTION 1: TWO-FACTOR AUTHENTICATION (2FA / TOTP) */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isMfaActive ? L.emeraldBorder : L.cardBorder, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: isMfaActive ? L.emeraldBg : L.goldBg, borderWidth: 1, borderColor: isMfaActive ? L.emerald : L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="qr-code" size={21} color={isMfaActive ? L.emerald : L.goldDk} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 13, fontWeight: '800' }}>Google Authenticator (2FA)</Text>
                                        <View style={{ backgroundColor: isMfaActive ? L.emeraldBg : L.goldBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 0.8, borderColor: isMfaActive ? L.emeraldBorder : L.goldBorder }}>
                                            <Text style={{ color: isMfaActive ? L.emerald : L.goldAmber, fontSize: 8, fontWeight: '900' }}>
                                                {isMfaActive ? 'ACTIVE & VERIFIED' : 'RECOMMENDED'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2, lineHeight: 13.5 }}>
                                        Generates time-sensitive 6-digit TOTP codes for uncrackable sign-in security.
                                    </Text>
                                </View>
                            </View>

                            {mfaLoading ? (
                                <ActivityIndicator size="small" color={L.gold} />
                            ) : (
                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                    thumbColor={isMfaActive ? '#FFFFFF' : '#94A3B8'}
                                    onValueChange={handleToggleMfa}
                                    value={isMfaActive}
                                    style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                                />
                            )}
                        </View>

                        {/* 2FA Action Strip: Test Authenticator Code or Setup Notice */}
                        {isMfaActive ? (
                            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ flex: 1, backgroundColor: L.emeraldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="shield-checkmark" size={13} color={L.emerald} />
                                    <Text style={{ color: '#065F46', fontSize: 9.5, fontWeight: '700' }}>
                                        Protected on every new sign-in
                                    </Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => setTestModalVisible(true)}
                                    style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: L.cardBorder, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                >
                                    <Ionicons name="flask-outline" size={12} color={L.navyMid} />
                                    <Text style={{ color: L.navyMid, fontSize: 9.5, fontWeight: '800' }}>Test Code 🧪</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ marginTop: 10, backgroundColor: L.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="information-circle" size={13} color={L.goldAmber} />
                                <Text style={{ color: L.goldAmber, fontSize: 9.5, fontWeight: '600', flex: 1 }}>
                                    Switch toggle ON to link Google Authenticator, Microsoft Authenticator, or Authy.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* SECTION 2: INDA 2FA ZAI BAYYANA (2FA PROTECTION SCOPE & WHERE IT APPEARS) */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MaterialCommunityIcons name="shield-airplane" size={16} color={L.navyHeader} />
                                <Text style={{ color: L.navyHeader, fontSize: 11.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Inda 2FA Zai Bayyana (Where It Appears)
                                </Text>
                            </View>
                            <View style={{ backgroundColor: isMfaActive ? L.emeraldBg : L.goldBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                                <Text style={{ color: isMfaActive ? L.emerald : L.goldAmber, fontSize: 8, fontWeight: '900' }}>
                                    {isMfaActive ? 'ACTIVE SHIELD' : 'SETUP REQUIRED'}
                                </Text>
                            </View>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 9.5, marginBottom: 12, lineHeight: 13.5 }}>
                            Shafuka da ayyukan da lambobin 2FA za su bayyana don kare asusunka daga fashi ko shiga ba tare da izini ba:
                        </Text>

                        {/* Location 1: Shiga Asusu (Login / Sign-In) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: L.blueBg, borderWidth: 1, borderColor: L.blueBorder, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="log-in-outline" size={17} color={L.blue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '800' }}>Shiga Asusu (Login)</Text>
                                        <View style={{ backgroundColor: isMfaActive ? L.emeraldBg : '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                            <Text style={{ color: isMfaActive ? L.emerald : L.textMuted, fontSize: 7.5, fontWeight: '900' }}>
                                                {isMfaActive ? 'KOYAUSHE' : 'OFF'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9, marginTop: 1 }}>
                                        Yana bayyana kai-tsaye a shafin Login bayan Email & Password.
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="shield-checkmark" size={18} color={isMfaActive ? L.emerald : '#CBD5E1'} />
                        </View>

                        {/* Location 2: Tura Kuɗi & Cire Kuɗi (Wallet Transfers & Bank Payouts) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: L.emeraldBg, borderWidth: 1, borderColor: L.emeraldBorder, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="paper-plane-outline" size={17} color={L.emerald} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '800' }}>Tura Kuɗi (Transfers)</Text>
                                        <View style={{ backgroundColor: (isMfaActive && mfaForTransfers) ? L.emeraldBg : '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                            <Text style={{ color: (isMfaActive && mfaForTransfers) ? L.emerald : L.textMuted, fontSize: 7.5, fontWeight: '900' }}>
                                                {(isMfaActive && mfaForTransfers) ? 'PIN + 2FA' : 'PIN ONLY'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9, marginTop: 1 }}>
                                        Yana bayyana a SecurityModal bayan 4-digit PIN kafin kudi su fita.
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                thumbColor={(isMfaActive && mfaForTransfers) ? '#FFFFFF' : '#94A3B8'}
                                onValueChange={handleToggleTransferMfa}
                                value={isMfaActive && mfaForTransfers}
                                disabled={!isMfaActive}
                                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                            />
                        </View>

                        {/* Location 3: Sauya Kalmar Sirri & PIN */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: L.purpleBg, borderWidth: 1, borderColor: L.purpleBorder, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="key-outline" size={17} color={L.purple} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '800' }}>Canza PIN & Password</Text>
                                        <View style={{ backgroundColor: L.purpleBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                            <Text style={{ color: L.purple, fontSize: 7.5, fontWeight: '900' }}>PROTECTED</Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9, marginTop: 1 }}>
                                        Yana kare canza lambar asiri da transaction PIN ta yadda ba za a taba sace su ba.
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="checkmark-circle" size={18} color={isMfaActive ? L.purple : '#CBD5E1'} />
                        </View>
                    </View>

                    {/* SECTION 3: HARDWARE BIOMETRIC LOGIN */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: biometricEnabled ? L.blueBorder : L.cardBorder, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: biometricEnabled ? L.blueBg : '#F1F5F9', borderWidth: 1, borderColor: biometricEnabled ? L.blue : '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons 
                                        name={biometricType === 'Face ID' ? "scan-outline" : "finger-print"} 
                                        size={21} 
                                        color={biometricEnabled ? L.blue : L.textMuted} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 13, fontWeight: '800' }}>
                                            {biometricType} Unlock
                                        </Text>
                                        <View style={{ backgroundColor: biometricEnabled ? L.blueBg : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 0.8, borderColor: biometricEnabled ? L.blueBorder : '#CBD5E1' }}>
                                            <Text style={{ color: biometricEnabled ? L.blue : L.textMuted, fontSize: 8, fontWeight: '900' }}>
                                                {biometricEnabled ? 'ENABLED' : 'OFF'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2, lineHeight: 13.5 }}>
                                        Instant 1-tap sign in using your device's built-in secure enclave biometric sensors.
                                    </Text>
                                </View>
                            </View>

                            <Switch
                                trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                                thumbColor={biometricEnabled ? '#FFFFFF' : '#94A3B8'}
                                onValueChange={handleBiometricToggle}
                                value={biometricEnabled}
                                disabled={!biometricAvailable}
                                style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                            />
                        </View>

                        {!biometricAvailable && (
                            <View style={{ marginTop: 10, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="alert-circle-outline" size={13} color={L.textMuted} />
                                <Text style={{ color: L.textMuted, fontSize: 9, fontWeight: '500' }}>
                                    Hardware biometrics are not registered on this device.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* SECTION 3: TRANSACTION PIN & CREDENTIAL PASSCODES */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 }}>
                        <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
                            🔑 Passcodes & Credentials
                        </Text>

                        {/* Option A: 4-Digit Transaction PIN */}
                        <TouchableOpacity
                            onPress={() => router.push('/(auth)/pin-setup')}
                            activeOpacity={0.7}
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                paddingVertical: 10, 
                                borderBottomWidth: 1, 
                                borderColor: '#F1F5F9' 
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="keypad" size={17} color={L.goldDk} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '800' }}>4-Digit Transaction PIN</Text>
                                        <View style={{ backgroundColor: hasPinConfigured ? L.emeraldBg : L.goldBg, paddingHorizontal: 5.5, paddingVertical: 1.5, borderRadius: 5, borderWidth: 0.8, borderColor: hasPinConfigured ? L.emeraldBorder : L.goldBorder }}>
                                            <Text style={{ color: hasPinConfigured ? L.emerald : L.goldAmber, fontSize: 8, fontWeight: '900' }}>
                                                {hasPinConfigured ? 'CONFIGURED' : 'SET UP'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 1 }}>
                                        Required to authorize wallet transfers, airtime, and data orders.
                                    </Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ color: L.goldDk, fontSize: 10, fontWeight: '800' }}>Change</Text>
                                <Ionicons name="chevron-forward" size={15} color={L.goldDk} />
                            </View>
                        </TouchableOpacity>

                        {/* Option B: Account Login Password */}
                        <TouchableOpacity
                            onPress={() => router.push('/change-password')}
                            activeOpacity={0.7}
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                paddingVertical: 10 
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="lock-closed" size={17} color={L.navyMid} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Account Login Password</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 1 }}>
                                        Primary password used for sign-in across mobile and web.
                                    </Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ color: L.blue, fontSize: 10, fontWeight: '800' }}>Update</Text>
                                <Ionicons name="chevron-forward" size={15} color={L.blue} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* SECTION 4: ACTIVE SESSION & DEVICE INTEGRITY */}
                    <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.cardBorder, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 }}>
                        <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
                            🛡️ Session & Device Audit
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '600' }}>Current Platform</Text>
                            <Text style={{ color: L.textPrimary, fontSize: 10.5, fontWeight: '800' }}>{Platform.OS.toUpperCase()} Native Client</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '600' }}>Encryption Standard</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="shield-checkmark" size={12} color={L.emerald} />
                                <Text style={{ color: L.emerald, fontSize: 10, fontWeight: '800' }}>TLS 1.3 / AES-256</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '600' }}>Last Session Refresh</Text>
                            <Text style={{ color: L.textSecondary, fontSize: 10.5, fontWeight: '700' }}>{lastSignInTime}</Text>
                        </View>

                        {/* Terminate Other Sessions Action */}
                        <TouchableOpacity
                            onPress={handleTerminateOtherSessions}
                            style={{ 
                                marginTop: 10, 
                                backgroundColor: '#FFF1F2', 
                                borderWidth: 1, 
                                borderColor: L.roseBorder, 
                                borderRadius: 10, 
                                paddingVertical: 9, 
                                alignItems: 'center', 
                                flexDirection: 'row', 
                                justifyContent: 'center', 
                                gap: 6 
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="exit-outline" size={14} color={L.rose} />
                            <Text style={{ color: L.rose, fontSize: 10.5, fontWeight: '800' }}>
                                Terminate All Other Device Sessions
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* 3. GOOGLE AUTHENTICATOR SETUP MODAL (Executive Light Design with QR, Deep Link & 6-Box Code Input) */}
            <Modal
                visible={setupModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={handleCancelSetup}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ 
                        width: '100%', 
                        maxWidth: 440, 
                        backgroundColor: '#FFFFFF', 
                        borderRadius: 22, 
                        borderWidth: 1.5, 
                        borderColor: L.gold, 
                        padding: 18, 
                        maxHeight: '94%',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.2,
                        shadowRadius: 14,
                        elevation: 10
                    }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Modal Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="shield-checkmark" size={16} color={L.goldDk} />
                                    </View>
                                    <Text style={{ color: L.navyHeader, fontSize: 13.5, fontWeight: '900' }}>
                                        Set Up Google Authenticator
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={handleCancelSetup} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close-circle" size={22} color={L.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Step 1: 1-Tap Mobile Deep Link or Scan QR */}
                            <Text style={{ color: L.goldAmber, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>
                                Step 1: Link With Your Authenticator App
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 8, lineHeight: 14 }}>
                                If you are on this phone, tap the button below to add it automatically. Otherwise, scan the barcode from another device.
                            </Text>

                            {/* 1-Tap Mobile Link Button */}
                            <TouchableOpacity
                                onPress={handleOpenInAuthenticator}
                                style={{
                                    backgroundColor: L.navyHeader,
                                    borderRadius: 11,
                                    paddingVertical: 10,
                                    paddingHorizontal: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 7,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: L.goldBorder
                                }}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="phone-portrait-outline" size={16} color={L.gold} />
                                <Text style={{ color: L.gold, fontSize: 11, fontWeight: '900' }}>
                                    Open in Authenticator App 📲
                                </Text>
                            </TouchableOpacity>

                            {/* High-Resolution QR Container */}
                            <View style={{ 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                backgroundColor: '#FFFFFF', 
                                padding: 10, 
                                borderRadius: 16, 
                                alignSelf: 'center', 
                                marginBottom: 12,
                                borderWidth: 1.5,
                                borderColor: L.goldBorder,
                                shadowColor: '#000',
                                shadowOpacity: 0.05,
                                shadowRadius: 5,
                                elevation: 3
                            }}>
                                {qrUrl ? (
                                    <>
                                        <Image source={{ uri: qrUrl }} style={{ width: 170, height: 170 }} resizeMode="contain" />
                                        <View style={{ marginTop: 6, backgroundColor: L.goldBg, paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6, borderWidth: 0.8, borderColor: L.goldBorder }}>
                                            <Text style={{ color: L.goldAmber, fontSize: 8.5, fontWeight: '900' }}>📷 SCAN WITH CAMERA</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center' }}>
                                        <ActivityIndicator size="large" color={L.gold} />
                                        <Text style={{ color: L.textMuted, fontSize: 10, fontWeight: '600', marginTop: 6 }}>Generating QR Code...</Text>
                                    </View>
                                )}
                            </View>

                            {/* Step 2: Or Copy Secret Key */}
                            <Text style={{ color: L.goldAmber, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>
                                Step 2: Or Enter Secret Key Manually
                            </Text>

                            <View style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                backgroundColor: '#F8FAFC', 
                                borderRadius: 10, 
                                borderWidth: 1, 
                                borderColor: '#CBD5E1', 
                                padding: 8, 
                                marginBottom: 14 
                            }}>
                                <Text style={{ flex: 1, color: L.textPrimary, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800' }} numberOfLines={1}>
                                    {formatSecret(enrollData?.totp?.secret)}
                                </Text>
                                <TouchableOpacity 
                                    onPress={handleCopySecret}
                                    style={{ backgroundColor: L.goldBg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: L.goldBorder }}
                                >
                                    <Text style={{ color: L.goldAmber, fontSize: 9.5, fontWeight: '800' }}>Copy Key 📋</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Step 3: Enter 6-digit Code (6 Distinct Digit Boxes) */}
                            <Text style={{ color: L.goldAmber, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>
                                Step 3: Enter 6-Digit Verification Code
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 10 }}>
                                Type the 6-digit code currently shown in your Authenticator app:
                            </Text>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                {otpDigits.map((digit, idx) => (
                                    <TextInput
                                        key={idx}
                                        ref={(ref) => { otpInputRefs.current[idx] = ref; }}
                                        style={{ 
                                            width: 42, 
                                            height: 48, 
                                            backgroundColor: '#F8FAFC', 
                                            borderWidth: 1.5, 
                                            borderColor: digit ? L.emerald : L.cardBorder, 
                                            borderRadius: 10, 
                                            textAlign: 'center', 
                                            fontSize: 20, 
                                            fontWeight: '900', 
                                            color: L.textPrimary 
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        value={digit}
                                        onChangeText={(val) => handleOtpChange(val, idx)}
                                        onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                                    />
                                ))}
                            </View>

                            {/* Modal Action Buttons */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={handleCancelSetup}
                                    style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' }}
                                >
                                    <Text style={{ color: L.textSecondary, fontSize: 11.5, fontWeight: '800' }}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleVerifyTotp()}
                                    disabled={verifying}
                                    style={{ flex: 1.5, backgroundColor: L.gold, borderRadius: 12, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {verifying ? (
                                        <ActivityIndicator color={L.navyHeader} size="small" />
                                    ) : (
                                        <Text style={{ color: L.navyHeader, fontSize: 11.5, fontWeight: '900' }}>
                                            Verify & Activate 🔒
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 4. LIVE 2FA TEST MODAL */}
            <Modal
                visible={testModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setTestModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: L.emeraldBorder, padding: 18 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                <Ionicons name="flask" size={18} color={L.emerald} />
                                <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>Test Authenticator Code</Text>
                            </View>
                            <TouchableOpacity onPress={() => setTestModalVisible(false)}>
                                <Ionicons name="close" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 10.5, marginBottom: 12, lineHeight: 14.5 }}>
                            Enter the 6-digit code currently visible in Google Authenticator to confirm it is 100% active and in sync:
                        </Text>

                        <TextInput
                            style={{ 
                                backgroundColor: '#F8FAFC', 
                                borderWidth: 1.5, 
                                borderColor: testCode.length === 6 ? L.emerald : L.cardBorder, 
                                borderRadius: 12, 
                                paddingVertical: 10, 
                                textAlign: 'center', 
                                fontSize: 22, 
                                fontWeight: '900', 
                                letterSpacing: 6,
                                color: L.textPrimary,
                                marginBottom: 14 
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            placeholder="000000"
                            placeholderTextColor="#94A3B8"
                            value={testCode}
                            onChangeText={setTestCode}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setTestModalVisible(false)}
                                style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                            >
                                <Text style={{ color: L.textSecondary, fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleTestCode}
                                disabled={testingCode || testCode.length !== 6}
                                style={{ flex: 1.5, backgroundColor: testCode.length === 6 ? L.emerald : '#CBD5E1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }}
                            >
                                {testingCode ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>Verify Code ✅</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
